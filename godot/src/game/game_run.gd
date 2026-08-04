extends RefCounted
class_name AdMarketGameRun

const AgencyProgress = preload("res://src/agency/agency_progress.gd")
const LEVELS := ["invent", "sell", "irresistible"]
const PITCH_PHASES := ["invent", "sell", "irresistible", "publish-check"]
const PITCH_SNAPSHOT_CONTRACT := "pitch-run@2"
const LEGACY_PITCH_SNAPSHOT_CONTRACT := "pitch-run@1"
const MINIMUM_SELLERS := 2
const MINIMUM_SPEND_PERCENT := 80
const MAX_WALLET_CENTS := 1000000
const MEDALS := ["gold", "silver", "bronze"]

var phase: String = "lobby"
var team_alias: String = ""
var session_id: String = ""
var team_id: String = ""
var wallet_cents: int = 0
var market_mode: String = ""
var last_error: String = ""

var _starting_wallet_cents: int = 0
var _ready_levels: Dictionary = {}
var _purchases: Array[Dictionary] = []
var _awards: Dictionary = {}
var _agency_progress: RefCounted = AgencyProgress.new()

func begin(alias: String, next_session_id: String, next_team_id: String) -> bool:
    if phase != "lobby":
        return _fail("This game has already started")
    if alias.is_empty() or alias != alias.strip_edges() or alias.length() > 40:
        return _fail("Team alias must not have surrounding spaces")
    if not _safe_id(next_session_id) or not _safe_id(next_team_id):
        return _fail("Session and team IDs must be safe non-empty values")
    var next_agency: RefCounted = AgencyProgress.new()
    if not next_agency.begin():
		return _fail("The agency work could not start")
    team_alias = alias
    session_id = next_session_id
    team_id = next_team_id
    phase = LEVELS[0]
    _agency_progress = next_agency
    return _succeed()

func mark_current_level_ready() -> bool:
    if not LEVELS.has(phase):
        return _fail("Only a playable level can be marked ready")
    _ready_levels[phase] = true
    return _succeed()

func invalidate_current_level() -> bool:
    if not LEVELS.has(phase):
        return _fail("Only a playable level can be reopened")
    _ready_levels.erase(phase)
    return _succeed()

func is_current_level_ready() -> bool:
    return LEVELS.has(phase) and _ready_levels.get(phase, false) == true

func agency_progress() -> RefCounted:
    return _agency_progress

func pitch_snapshot() -> Dictionary:
    if not PITCH_PHASES.has(phase):
        return {}
    var ready_levels: Array[String] = []
    for level in LEVELS:
        if _ready_levels.get(level, false) == true:
            ready_levels.append(level)
    return {
        "contract": PITCH_SNAPSHOT_CONTRACT,
        "phase": phase,
        "teamAlias": team_alias,
        "sessionId": session_id,
        "teamId": team_id,
        "readyLevels": ready_levels,
        "agency": _agency_progress.snapshot()
    }

func restore_pitch_snapshot(value: Variant) -> bool:
    if typeof(value) != TYPE_DICTIONARY:
        return _fail("Saved pitch progress must be a dictionary")
    var snapshot: Dictionary = value
    var contract_value: Variant = snapshot.get("contract")
    var is_legacy: bool = contract_value == LEGACY_PITCH_SNAPSHOT_CONTRACT
    if not is_legacy and contract_value != PITCH_SNAPSHOT_CONTRACT:
        return _fail("Saved pitch progress contract is unsupported")
    var allowed_keys := ["contract", "phase", "teamAlias", "sessionId", "teamId", "readyLevels"]
    if not is_legacy:
        allowed_keys.append("agency")
    if snapshot.size() != allowed_keys.size():
        return _fail("Saved pitch progress has unexpected fields")
    for key in allowed_keys:
        if not snapshot.has(key):
            return _fail("Saved pitch progress is missing %s" % key)
    if typeof(snapshot.get("phase")) != TYPE_STRING:
        return _fail("Saved pitch phase must be a string")
    var next_phase := String(snapshot.get("phase"))
    if not PITCH_PHASES.has(next_phase):
        return _fail("Saved pitch phase is unsupported")
    if typeof(snapshot.get("teamAlias")) != TYPE_STRING:
        return _fail("Saved pair alias must be a string")
    var next_alias := String(snapshot.get("teamAlias"))
    if next_alias.is_empty() or next_alias != next_alias.strip_edges() or next_alias.length() > 40:
        return _fail("Saved pair alias is invalid")
    if typeof(snapshot.get("sessionId")) != TYPE_STRING or typeof(snapshot.get("teamId")) != TYPE_STRING:
        return _fail("Saved session and team IDs must be strings")
    var next_session_id := String(snapshot.get("sessionId"))
    var next_team_id := String(snapshot.get("teamId"))
    if not _safe_id(next_session_id) or not _safe_id(next_team_id):
        return _fail("Saved session and team IDs are invalid")
    if typeof(snapshot.get("readyLevels")) != TYPE_ARRAY:
        return _fail("Saved ready levels must be an array")
    var ready_value: Array = snapshot.get("readyLevels")
    var required_count := LEVELS.size() if next_phase == "publish-check" else LEVELS.find(next_phase)
    var maximum_count := required_count if next_phase == "publish-check" else required_count + 1
    if ready_value.size() < required_count or ready_value.size() > maximum_count:
        return _fail("Saved ready levels do not match the pitch phase")
    var next_ready_levels: Dictionary = {}
    for index in ready_value.size():
        if typeof(ready_value[index]) != TYPE_STRING or String(ready_value[index]) != LEVELS[index]:
            return _fail("Saved ready levels must be an ordered level prefix")
        next_ready_levels[String(ready_value[index])] = true

    var agency_snapshot: Dictionary
    if is_legacy:
        agency_snapshot = AgencyProgress.from_legacy_pitch(next_phase, ready_value)
    else:
        if typeof(snapshot.get("agency")) != TYPE_DICTIONARY:
            return _fail("Saved agency progress must be a dictionary")
        agency_snapshot = Dictionary(snapshot.get("agency")).duplicate(true)
    var next_agency: RefCounted = AgencyProgress.new()
    if agency_snapshot.is_empty() or not next_agency.restore_snapshot(agency_snapshot):
        return _fail("Saved agency progress is invalid")

    phase = next_phase
    team_alias = next_alias
    session_id = next_session_id
    team_id = next_team_id
    _ready_levels = next_ready_levels
    _agency_progress = next_agency
    _starting_wallet_cents = 0
    wallet_cents = 0
    market_mode = ""
    _purchases.clear()
    _awards.clear()
    return _succeed()

func advance_level() -> bool:
    var index := LEVELS.find(phase)
    if index < 0:
        return _fail("There is no level to advance from")
    if _ready_levels.get(phase, false) != true:
        return _fail("Finish this level before moving on")
    phase = "publish-check" if index == LEVELS.size() - 1 else LEVELS[index + 1]
    return _succeed()

func open_market(starting_wallet_cents: int) -> bool:
    if phase != "publish-check":
        return _fail("The market opens after all three levels")
    if starting_wallet_cents <= 0 or starting_wallet_cents > MAX_WALLET_CENTS:
        return _fail("Market wallet is outside the safe game range")
    _starting_wallet_cents = starting_wallet_cents
    wallet_cents = starting_wallet_cents
    market_mode = "purchases"
    _purchases.clear()
    _awards.clear()
    phase = "market"
    return _succeed()

func open_medal_market() -> bool:
    if phase != "publish-check":
        return _fail("The market opens after all three levels")
    _starting_wallet_cents = 0
    wallet_cents = 0
    market_mode = "medals"
    _purchases.clear()
    _awards.clear()
    phase = "market"
    return _succeed()

func purchase(campaign_id: String, seller_team_id: String, price_cents: int) -> bool:
    if phase != "market":
        return _fail("Shopping is not open")
    if market_mode != "purchases":
        return _fail("This market awards medals instead of purchases")
    if not _safe_id(campaign_id) or not _safe_id(seller_team_id):
        return _fail("Product and seller IDs must be safe non-empty values")
    if seller_team_id == team_id:
        return _fail("You cannot buy your own product")
    if price_cents <= 0 or price_cents > MAX_WALLET_CENTS:
        return _fail("Product price is outside the safe game range")
    for purchase_record in _purchases:
        if purchase_record.get("campaignId") == campaign_id:
            return _fail("That product is already in your basket")
    if price_cents > wallet_cents:
        return _fail("That product costs more than your remaining wallet")
    _purchases.append({
        "campaignId": campaign_id,
        "sellerTeamId": seller_team_id,
        "priceCents": price_cents
    })
    wallet_cents -= price_cents
    return _succeed()

func award(campaign_id: String, seller_team_id: String, medal: String) -> bool:
    if phase != "market":
        return _fail("Medal voting is not open")
    if market_mode != "medals":
        return _fail("This saved market uses purchases instead of medals")
    if not _safe_id(campaign_id) or not _safe_id(seller_team_id):
		return _fail("Advertisement and seller IDs must be safe non-empty values")
    if seller_team_id == team_id:
		return _fail("You cannot award your own advertisement")
    if not MEDALS.has(medal):
        return _fail("Choose Gold, Silver or Bronze")
    for existing_medal in MEDALS:
        if existing_medal == medal or not _awards.has(existing_medal):
            continue
        var existing: Dictionary = _awards.get(existing_medal)
        if str(existing.get("campaignId")) == campaign_id:
		return _fail("Each medal must go to a different advertisement")
    _awards[medal] = {
        "campaignId": campaign_id,
        "sellerTeamId": seller_team_id,
        "medal": medal
    }
    return _succeed()

func finish_shopping() -> bool:
    if phase != "market":
        return _fail("Shopping is not open")
    if market_mode != "purchases":
        return _fail("This market awards medals instead of purchases")
    var sellers: Dictionary = {}
    for purchase_record in _purchases:
        sellers[purchase_record.get("sellerTeamId")] = true
    if sellers.size() < MINIMUM_SELLERS:
        return _fail("Visit at least two different sellers")
    if spent_cents() * 100 < _starting_wallet_cents * MINIMUM_SPEND_PERCENT:
        return _fail("Spend at least 80% of your wallet")
    phase = "reveal"
    return _succeed()

func finish_market() -> bool:
    if phase != "market":
        return _fail("Market choices are not open")
    if market_mode == "purchases":
        return finish_shopping()
    if market_mode != "medals":
        return _fail("Market mode is unavailable")
    for medal in MEDALS:
        if not _awards.has(medal):
            return _fail("Award Gold, Silver and Bronze before finishing")
    phase = "reveal"
    return _succeed()

func spent_cents() -> int:
    return _starting_wallet_cents - wallet_cents

func purchases() -> Array[Dictionary]:
    return _purchases.duplicate(true)

func awards() -> Array[Dictionary]:
    var result: Array[Dictionary] = []
    for medal in MEDALS:
        if _awards.has(medal):
            result.append(Dictionary(_awards.get(medal)).duplicate(true))
    return result

func _safe_id(value: String) -> bool:
    return not value.is_empty() and value == value.strip_edges() and value.length() <= 100

func _fail(message: String) -> bool:
    last_error = message
    return false

func _succeed() -> bool:
    last_error = ""
    return true
