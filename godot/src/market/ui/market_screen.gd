# Godot 4.x — @export var, await, Control containers, instance.signal.connect(method)
extends Control
class_name AdMarketMarketScreen

signal fix_requested

const MarketViewState = preload("res://src/market/market_view_state.gd")
const MarketHost = preload("res://src/market/market_host.gd")
const LocalMarketSession = preload("res://src/market/local_market_session.gd")
const NAVY := Color("#17213b")
const BURNT_ORANGE := Color("#4d315f")
const ORANGE_HOVER := Color("#614074")
const OFF_WHITE := Color("#fff8eb")
const KRAFT := Color("#f6ead6")
const KRAFT_BORDER := Color("#d8c7a7")
const MUTED := Color("#526078")
const GOLD := Color("#f4bd4f")
const WHITE := Color("#ffffff")
const SCORE_CRITERIA := [
    ["audience", "Audience fit"],
    ["value", "Product value and price"],
    ["aida", "AIDA"],
    ["visual", "Visual technique"],
    ["claim", "Credible claim"]
]
const STUDENT_MARKET_ERRORS := {
    "INVALID_ROOM_CODE": "Enter the room code in the format ABC-234.",
    "ROOM_NOT_FOUND": "That room could not be found. Check the code and try again.",
    "ROOM_UNAVAILABLE": "That room is not available. Ask your teacher what to do next.",
    "CONNECTION_TIMEOUT": "The connection took too long. Check the network and try again.",
    "CONNECTION_UNAVAILABLE": "The market could not be reached. Check the network and try again.",
    "RATE_LIMITED": "Too many requests were sent. Wait briefly, then try again.",
    "SESSION_EXPIRED": "This market session has ended. Rejoin the room to continue."
}

@onready var market_frame: PanelContainer = %MarketFrame
@onready var room_code_label: Label = %MarketRoomCode
@onready var network_status: Label = %NetworkStatus
@onready var retry_button: Button = %RetryMarket
@onready var phase_status: Label = %PhaseStatus
@onready var team_surface: VBoxContainer = %TeamSurface
@onready var wallet_label: Label = %WalletLabel
@onready var spend_meter: ProgressBar = %SpendMeter
@onready var seller_progress: Label = %SellerProgress
@onready var market_criteria: PanelContainer = %MarketCriteria
@onready var finish_button: Button = %FinishMarket
@onready var campaign_status_title: Label = %CampaignStatusTitle
@onready var campaign_status_copy: Label = %CampaignStatusCopy
@onready var fix_button: Button = %FixCampaign
@onready var student_reveal: PanelContainer = %StudentReveal
@onready var student_reveal_copy: Label = %StudentRevealCopy
@onready var team_market_heading: Label = %TeamMarketHeading
@onready var team_cards: GridContainer = %TeamCards
@onready var teacher_surface: VBoxContainer = %TeacherSurface
@onready var teacher_stats: PanelContainer = %TeacherStats
@onready var seats_label: Label = %SeatsLabel
@onready var readiness_label: Label = %ReadinessLabel
@onready var teams_heading: Label = %TeamsHeading
@onready var teacher_teams: VBoxContainer = %TeacherTeams
@onready var moderation_heading: Label = %ModerationHeading
@onready var moderation_cards: GridContainer = %ModerationCards
@onready var open_market_button: Button = %OpenMarketControl
@onready var reveal_button: Button = %RevealControl
@onready var close_button: Button = %CloseControl
@onready var teacher_reveal: PanelContainer = %TeacherReveal
@onready var podium_list: VBoxContainer = %PodiumList
@onready var remove_team_dialog: ConfirmationDialog = %RemoveTeamDialog
@onready var poll_timer: Timer = %PollTimer

var market_host: Node
var _active_role: String = ""
var _room_code: String = ""
var _latest_snapshot: Dictionary = {}
var _latest_state: Dictionary = {}
var _purchase_sequence: int = 1
var _pending_purchases: Dictionary = {}
var _pending_awards: Dictionary = {}
var _scorecards: Dictionary = {}
var _scorecard_controls: Dictionary = {}
var _artwork_targets: Dictionary = {}
var _remove_team_id: String = ""
var _remove_team_alias: String = ""
var _remove_dialog_focus: Control
var _practice_mode: bool = false
var _ready_wired: bool = false

func _ready() -> void:
    if _ready_wired:
        return
    _ready_wired = true
    retry_button.pressed.connect(_retry_snapshot)
    finish_button.pressed.connect(_finish_shopping)
    fix_button.pressed.connect(func() -> void: fix_requested.emit())
    open_market_button.pressed.connect(_send_control.bind("openMarket"))
    reveal_button.pressed.connect(_send_control.bind("openReveal"))
    close_button.pressed.connect(_send_control.bind("closeMarket"))
    remove_team_dialog.confirmed.connect(_confirm_remove_team)
    remove_team_dialog.canceled.connect(_cancel_remove_team)
    poll_timer.timeout.connect(_poll_snapshot)
    resized.connect(_apply_columns)
    remove_team_dialog.get_ok_button().custom_minimum_size = Vector2(160, 44)
    remove_team_dialog.get_cancel_button().custom_minimum_size = Vector2(130, 44)
    remove_team_dialog.get_ok_button().focus_mode = Control.FOCUS_ALL
    remove_team_dialog.get_cancel_button().focus_mode = Control.FOCUS_ALL
    for dialog_button_value in remove_team_dialog.find_children("*", "Button", true, false):
        var dialog_button := dialog_button_value as Button
        if not dialog_button.text.is_empty():
            dialog_button.custom_minimum_size.y = 44.0
            dialog_button.focus_mode = Control.FOCUS_ALL
    retry_button.hide()
    team_surface.hide()
    teacher_surface.hide()
    student_reveal.hide()
    teacher_reveal.hide()
    fix_button.hide()

func set_market_host(value: Node) -> void:
    if market_host == value:
        return
    if market_host != null:
        _connect_host(false)
    market_host = value
    if market_host != null:
        _connect_host(true)

func enter_room(role: String, room_code: String) -> void:
    if role not in ["team", "teacher"]:
        _show_safe_diagnostic()
        return
    _active_role = role
    _room_code = room_code
    _practice_mode = room_code == "PRACTICE"
    _latest_snapshot.clear()
    _latest_state.clear()
    _pending_purchases.clear()
    _pending_awards.clear()
    _scorecards.clear()
    _scorecard_controls.clear()
    room_code_label.text = room_code
    network_status.text = "Practice market ready." if _practice_mode else "Live connection ready."
    retry_button.hide()
    team_surface.visible = role == "team"
    teacher_surface.visible = role == "teacher"
    student_reveal.hide()
    teacher_reveal.hide()
    show()
    if poll_timer.is_inside_tree():
        poll_timer.start()
    _apply_columns()

func stop_room() -> void:
    poll_timer.stop()
    _active_role = ""
    _practice_mode = false
    _latest_snapshot.clear()
    _latest_state.clear()
    _pending_purchases.clear()
    _pending_awards.clear()
    _scorecards.clear()
    _scorecard_controls.clear()
    hide()

func show_publication_waiting() -> void:
    phase_status.text = "Your market card is with the host."
    campaign_status_title.text = "Waiting for the host"
    campaign_status_copy.text = "The card is in the review queue. You may keep this screen open."
    fix_button.hide()
    team_surface.show()
    show()
    _refresh_keyboard_order()

func present_snapshot(snapshot: Dictionary) -> void:
    var derived: Dictionary = MarketViewState.new().derive(snapshot)
    if derived.get("ok") != true or derived.get("role") != _active_role:
        _show_safe_diagnostic()
        return
    _latest_snapshot = snapshot.duplicate(true)
    _latest_state = Dictionary(derived.get("state")).duplicate(true)
    network_status.text = "Practice market ready." if _practice_mode else "Live connection ready."
    retry_button.hide()
    phase_status.text = _phase_copy(str(_latest_state.get("phase")))
    _artwork_targets.clear()
    if _active_role == "team":
        _render_team(_latest_state)
    else:
        _render_teacher(_latest_state)
    _request_visible_artwork()
    _apply_columns()
    _refresh_keyboard_order()

func accessibility_state() -> Dictionary:
    var heading := (
        "Manage the class market."
        if _active_role == "teacher"
        else (
            team_market_heading.text
            if team_market_heading.visible
            else campaign_status_title.text
        )
    )
    var completion := (
        readiness_label.text
        if _active_role == "teacher"
        else seller_progress.text
    )
    return {
        "heading": heading,
        "currentInstruction": phase_status.text,
        "completionStatus": "%s %s" % [completion, network_status.text]
    }

func focus_initial_control() -> void:
    _refresh_keyboard_order()
    var controls := _keyboard_controls()
    if not controls.is_empty():
        var control := controls[0] as Control
        if control.is_inside_tree():
            control.grab_focus()

func columns_for_width(width: float) -> int:
    if width >= 1700.0:
        return 4
    if width >= 1100.0:
        return 3
    return 2

func _connect_host(connecting: bool) -> void:
    if market_host is MarketHost:
        _connect_live_host(market_host as MarketHost, connecting)
    elif market_host is LocalMarketSession:
        _connect_local_session(market_host as LocalMarketSession, connecting)

func _connect_live_host(host: MarketHost, connecting: bool) -> void:
    if connecting:
        if not host.snapshot_received.is_connected(_on_snapshot_received):
            host.snapshot_received.connect(_on_snapshot_received)
        if not host.artwork_received.is_connected(_on_artwork_received):
            host.artwork_received.connect(_on_artwork_received)
        if not host.diagnostic.is_connected(_on_market_diagnostic):
            host.diagnostic.connect(_on_market_diagnostic)
        if not host.market_request_failed.is_connected(_on_market_request_failed):
            host.market_request_failed.connect(_on_market_request_failed)
        if not host.purchase_completed.is_connected(_on_purchase_completed):
            host.purchase_completed.connect(_on_purchase_completed)
        if not host.award_completed.is_connected(_on_award_completed):
            host.award_completed.connect(_on_award_completed)
        if not host.control_completed.is_connected(_on_control_completed):
            host.control_completed.connect(_on_control_completed)
        if not host.campaign_published.is_connected(_on_campaign_published):
            host.campaign_published.connect(_on_campaign_published)
        return
    if host.snapshot_received.is_connected(_on_snapshot_received):
        host.snapshot_received.disconnect(_on_snapshot_received)
    if host.artwork_received.is_connected(_on_artwork_received):
        host.artwork_received.disconnect(_on_artwork_received)
    if host.diagnostic.is_connected(_on_market_diagnostic):
        host.diagnostic.disconnect(_on_market_diagnostic)
    if host.market_request_failed.is_connected(_on_market_request_failed):
        host.market_request_failed.disconnect(_on_market_request_failed)
    if host.purchase_completed.is_connected(_on_purchase_completed):
        host.purchase_completed.disconnect(_on_purchase_completed)
    if host.award_completed.is_connected(_on_award_completed):
        host.award_completed.disconnect(_on_award_completed)
    if host.control_completed.is_connected(_on_control_completed):
        host.control_completed.disconnect(_on_control_completed)
    if host.campaign_published.is_connected(_on_campaign_published):
        host.campaign_published.disconnect(_on_campaign_published)

func _connect_local_session(
    session: LocalMarketSession,
    connecting: bool
) -> void:
    if connecting:
        if not session.snapshot_received.is_connected(_on_snapshot_received):
            session.snapshot_received.connect(_on_snapshot_received)
        if not session.artwork_received.is_connected(_on_artwork_received):
            session.artwork_received.connect(_on_artwork_received)
        if not session.diagnostic.is_connected(_on_market_diagnostic):
            session.diagnostic.connect(_on_market_diagnostic)
        if not session.purchase_completed.is_connected(_on_purchase_completed):
            session.purchase_completed.connect(_on_purchase_completed)
        if not session.award_completed.is_connected(_on_award_completed):
            session.award_completed.connect(_on_award_completed)
        return
    if session.snapshot_received.is_connected(_on_snapshot_received):
        session.snapshot_received.disconnect(_on_snapshot_received)
    if session.artwork_received.is_connected(_on_artwork_received):
        session.artwork_received.disconnect(_on_artwork_received)
    if session.diagnostic.is_connected(_on_market_diagnostic):
        session.diagnostic.disconnect(_on_market_diagnostic)
    if session.purchase_completed.is_connected(_on_purchase_completed):
        session.purchase_completed.disconnect(_on_purchase_completed)
    if session.award_completed.is_connected(_on_award_completed):
        session.award_completed.disconnect(_on_award_completed)

func _render_team(state: Dictionary) -> void:
    team_surface.show()
    teacher_surface.hide()
    var readiness: Dictionary = state.get("finishReadiness", {})
    var watch_only := not bool(readiness.get("eligibleBuyer", true))
    var medal_mode := str(state.get("marketMode", "purchases")) == "medals"
    market_criteria.visible = medal_mode
    var already_finished := bool(readiness.get("alreadyFinished", false))
    if watch_only:
        wallet_label.text = "Market watcher"
        spend_meter.value = 0.0
        seller_progress.text = (
            "Browse every approved ad. Awarding is paused this round."
            if medal_mode
            else "Browse every approved stall. Buying is paused this round."
        )
        finish_button.text = "Watching this market"
        finish_button.disabled = true
        finish_button.tooltip_text = "Pair can browse the market. Results are frozen."
        team_market_heading.text = (
            "Browse the market gallery · watch mode"
            if medal_mode
            else "Browse the market floor · watch mode"
        )
        fix_button.hide()
        campaign_status_title.text = "You are watching this round"
        campaign_status_copy.text = (
            "The gallery was locked before this pair joined. Browsing is open. Awarding is paused this round."
            if medal_mode
            else "Market floor was locked before pair joined. Browsing is open. Buying is paused this round."
        )
    elif medal_mode:
        var award_summary: Dictionary = state.get("awardSummary", {})
        var by_medal: Dictionary = award_summary.get("byMedal", {})
        wallet_label.text = "Award one Gold, one Silver and one Bronze"
        spend_meter.value = float(int(award_summary.get("awardCount", 0))) * 100.0 / 3.0
        seller_progress.text = "Gold: %s · Silver: %s · Bronze: %s" % [
            "set" if by_medal.has("gold") else "open",
            "set" if by_medal.has("silver") else "open",
            "set" if by_medal.has("bronze") else "open"
        ]
        finish_button.text = "Medals submitted" if already_finished else "Submit medals"
        finish_button.disabled = already_finished or not bool(readiness.get("locallyReady", false))
        finish_button.tooltip_text = (
            "Submit the pair's Gold, Silver and Bronze choices."
            if not finish_button.disabled
            else "Award all three medals to three different ads."
        )
        team_market_heading.text = "Award the market gallery"
        _render_campaign_state(Array(state.get("cards", [])), str(state.get("phase")))
    else:
        var money: Dictionary = state.get("money", {})
        var purchase_summary: Dictionary = state.get("purchaseSummary", {})
        wallet_label.text = "%s remaining" % _format_currency(int(money.get("walletCents", 0)))
        spend_meter.value = float(money.get("spentPercent", 0.0))
        seller_progress.text = "%d of 2 different sellers backed" % int(
            purchase_summary.get("distinctSellerCount", 0)
        )
        finish_button.text = "Shopping finished" if already_finished else "Finish shopping"
        finish_button.disabled = already_finished or not bool(readiness.get("locallyReady", false))
        finish_button.tooltip_text = (
            "Live market checks final spend and seller mix."
            if not finish_button.disabled
            else "Back two different sellers. Meet the live market spending rule."
        )
        team_market_heading.text = "Browse the market floor"
        _render_campaign_state(Array(state.get("cards", [])), str(state.get("phase")))
    _scorecard_controls.clear()
    _clear_container(team_cards)
    var reveal_phase := str(state.get("phase")) in ["reveal", "closed"]
    student_reveal.visible = reveal_phase
    student_reveal_copy.text = (
        "Your Gold, Silver and Bronze choices are locked. The host will reveal the market podium."
        if medal_mode
        else "Practice round complete. You backed two different stalls and spent your market wallet. In a live room, the host reveals which advertisement earned the most."
        if _practice_mode
        else "Market reveal is on the host display."
    )
    team_market_heading.visible = not reveal_phase
    team_cards.visible = not reveal_phase
    if not reveal_phase:
        for card_value in state.get("cards", []):
            _add_team_card(Dictionary(card_value))
    if medal_mode:
        _sync_pending_awards(Dictionary(state.get("awardSummary", {})))
        _update_finish_score_gate()
    else:
        _sync_pending_purchases(Array(state.get("cards", [])))

func _render_campaign_state(cards: Array, phase: String) -> void:
    var own_card: Dictionary = {}
    for card_value in cards:
        var card: Dictionary = card_value
        if bool(card.get("isOwn", false)):
            own_card = card
            break
    fix_button.hide()
    if own_card.is_empty():
        campaign_status_title.text = "Ad preparing."
        campaign_status_copy.text = "Finish your ad. The host adds it to the gallery."
        return
    var status := str(own_card.get("status"))
    if status == "pending":
        campaign_status_title.text = "Waiting for the host"
        campaign_status_copy.text = "Card is in the review queue."
    elif status == "approved":
        campaign_status_title.text = "Your ad is live" if phase == "market" else "Approved and ready"
        campaign_status_copy.text = "Your product ad is ready for the market gallery."
    elif status == "returned":
        campaign_status_title.text = "Studio tweak"
        campaign_status_copy.text = str(
            own_card.get("reviewNote", "Host note added to this card.")
        )
        fix_button.show()
    else:
        campaign_status_title.text = "Ad not active"
        campaign_status_copy.text = "This version is not active in the gallery. Your pair may remain in the room."

func _add_team_card(card: Dictionary) -> void:
    var panel := _new_card_panel(str(card.get("id")))
    team_cards.add_child(panel)
    var content := VBoxContainer.new()
    content.name = "CardContent"
    content.add_theme_constant_override("separation", 8)
    panel.add_child(content)
    var artwork := _new_artwork(str(card.get("artworkKey")))
    content.add_child(artwork)
    _add_label(content, _team_badge(card), 14, BURNT_ORANGE)
    _add_label(content, str(card.get("productName")), 20, NAVY)
    if card.has("tagline"):
        _add_label(content, str(card.get("tagline")), 15, MUTED)
    _add_label(content, "BY %s" % str(card.get("sellerAlias")).to_upper(), 14, MUTED)
    _add_label(content, "Product value: %s" % _format_currency(int(card.get("priceCents"))), 17, NAVY)
    var medal_mode := str(_latest_state.get("marketMode", "purchases")) == "medals"
    if medal_mode:
        var campaign_id := str(card.get("id"))
        var awarded_medal := str(card.get("awardedMedal", ""))
        if not awarded_medal.is_empty():
            _add_label(content, "%s awarded" % awarded_medal.capitalize(), 16, BURNT_ORANGE)
        if bool(card.get("canAward", false)):
            _add_scorecard(content, campaign_id)
            var medal_row := HBoxContainer.new()
            medal_row.name = "MedalActions"
            medal_row.add_theme_constant_override("separation", 8)
            content.add_child(medal_row)
            for medal in ["gold", "silver", "bronze"]:
                var medal_name := str(medal)
                var is_current: bool = awarded_medal == medal_name
                var award_button := _new_button(
                    "%s awarded" % medal_name.capitalize() if is_current else medal_name.capitalize(),
                    "Award%s" % medal_name.capitalize(),
                    true
                )
                var base_disabled := (
                    is_current
                    or (not awarded_medal.is_empty() and not is_current)
                    or _pending_awards.has(medal_name)
                )
                var ready_tooltip := (
                    "%s is already on this ad." % medal_name.capitalize()
                    if is_current
                    else "Move the %s medal to this ad." % medal_name.capitalize()
                )
                award_button.set_meta("scoreBaseDisabled", base_disabled)
                award_button.set_meta("scoreReadyTooltip", ready_tooltip)
                award_button.disabled = base_disabled or not _scorecard_complete(campaign_id)
                award_button.tooltip_text = (
                    "Complete this advertisement's five scores before awarding a medal."
                    if not _scorecard_complete(campaign_id)
                    else ready_tooltip
                )
                award_button.pressed.connect(
                    _award_campaign.bind(campaign_id, medal_name, award_button)
                )
                medal_row.add_child(award_button)
                var controls: Dictionary = _scorecard_controls.get(campaign_id, {})
                var medal_buttons: Array = controls.get("medalButtons", [])
                medal_buttons.append(award_button)
                controls["medalButtons"] = medal_buttons
                _scorecard_controls[campaign_id] = controls
    elif bool(card.get("canBuy", false)):
        var buy := _new_button("Back this product", "Buy", true)
        buy.pressed.connect(_buy_campaign.bind(str(card.get("id")), buy))
        content.add_child(buy)

func _team_badge(card: Dictionary) -> String:
    if bool(card.get("isOwn", false)):
        return "YOUR CARD · %s" % str(card.get("displayStatus", "waiting")).to_upper()
    if str(_latest_state.get("marketMode", "purchases")) == "medals":
        if not str(card.get("awardedMedal", "")).is_empty():
            return "%s MEDAL" % str(card.get("awardedMedal")).to_upper()
        return "MARKET AD"
    if bool(card.get("isBought", false)):
        return "BACKED"
    if not bool(card.get("isAffordable", false)):
        return "OVER YOUR WALLET"
    return "OPEN STALL"

func _add_scorecard(parent: VBoxContainer, campaign_id: String) -> void:
    var scorecard := VBoxContainer.new()
    scorecard.name = "Scorecard"
    scorecard.add_theme_constant_override("separation", 7)
    parent.add_child(scorecard)
    _add_label(scorecard, "Score this advertisement", 17, NAVY)
    _add_label(
        scorecard,
        "Select 0, 1 or 2 for each criterion. The five scores produce a total out of 10.",
        14,
        MUTED
    )
    var saved_scores: Dictionary = _scorecards.get(campaign_id, {})
    for criterion_value in SCORE_CRITERIA:
        var criterion: Array = criterion_value
        var criterion_id := str(criterion[0])
        var criterion_label := str(criterion[1])
        var field := VBoxContainer.new()
        field.name = "%sField" % _score_control_name(criterion_id)
        field.add_theme_constant_override("separation", 3)
        scorecard.add_child(field)
        _add_label(field, criterion_label, 14, NAVY)
        var score_control := OptionButton.new()
        score_control.name = _score_control_name(criterion_id)
        score_control.custom_minimum_size = Vector2(0, 44)
        score_control.size_flags_horizontal = Control.SIZE_EXPAND_FILL
        score_control.focus_mode = Control.FOCUS_ALL
        score_control.add_theme_font_size_override("font_size", 15)
        score_control.add_item("Select a score")
        score_control.add_item("0 — missing")
        score_control.add_item("1 — partly clear")
        score_control.add_item("2 — clear")
        if saved_scores.has(criterion_id):
            score_control.select(int(saved_scores.get(criterion_id)) + 1)
        score_control.item_selected.connect(
            _set_score.bind(campaign_id, criterion_id)
        )
        field.add_child(score_control)
    var total_label := _add_label(
        scorecard,
        "Score: %d / 10" % _scorecard_total(campaign_id),
        17,
        BURNT_ORANGE
    )
    total_label.name = "ScoreTotal"
    var completion_label := _add_label(
        scorecard,
        (
            "Scorecard complete. Compare this total with the other advertisements."
            if _scorecard_complete(campaign_id)
            else "Complete all five scores before awarding a medal."
        ),
        14,
        MUTED
    )
    completion_label.name = "ScoreStatus"
    _scorecard_controls[campaign_id] = {
        "total": total_label,
        "status": completion_label,
        "medalButtons": []
    }

func _score_control_name(criterion_id: String) -> String:
    return "ScoreAida" if criterion_id == "aida" else "Score%s" % criterion_id.capitalize()

func _set_score(selected_index: int, campaign_id: String, criterion_id: String) -> void:
    var scorecard: Dictionary = _scorecards.get(campaign_id, {})
    if selected_index <= 0:
        scorecard.erase(criterion_id)
    else:
        scorecard[criterion_id] = selected_index - 1
    _scorecards[campaign_id] = scorecard
    _refresh_scorecard_controls(campaign_id)
    _update_finish_score_gate()
    _refresh_keyboard_order()

func _scorecard_complete(campaign_id: String) -> bool:
    var scorecard: Dictionary = _scorecards.get(campaign_id, {})
    for criterion_value in SCORE_CRITERIA:
        var criterion: Array = criterion_value
        var score: Variant = scorecard.get(str(criterion[0]))
        if (
            typeof(score) not in [TYPE_INT, TYPE_FLOAT]
            or int(score) < 0
            or int(score) > 2
        ):
            return false
    return true

func _scorecard_total(campaign_id: String) -> int:
    var scorecard: Dictionary = _scorecards.get(campaign_id, {})
    var total := 0
    for criterion_value in SCORE_CRITERIA:
        var criterion: Array = criterion_value
        var score: Variant = scorecard.get(str(criterion[0]))
        if typeof(score) in [TYPE_INT, TYPE_FLOAT]:
            total += clampi(int(score), 0, 2)
    return total

func _refresh_scorecard_controls(campaign_id: String) -> void:
    var controls: Dictionary = _scorecard_controls.get(campaign_id, {})
    if controls.is_empty():
        return
    var complete := _scorecard_complete(campaign_id)
    var total_label := controls.get("total") as Label
    var completion_label := controls.get("status") as Label
    if total_label != null:
        total_label.text = "Score: %d / 10" % _scorecard_total(campaign_id)
    if completion_label != null:
        completion_label.text = (
            "Scorecard complete. Compare this total with the other advertisements."
            if complete
            else "Complete all five scores before awarding a medal."
        )
    for button_value in controls.get("medalButtons", []):
        var medal_button := button_value as Button
        if medal_button == null or not is_instance_valid(medal_button):
            continue
        medal_button.disabled = bool(
            medal_button.get_meta("scoreBaseDisabled", false)
        ) or not complete
        medal_button.tooltip_text = (
            str(medal_button.get_meta("scoreReadyTooltip", "Award this medal."))
            if complete
            else "Complete this advertisement's five scores before awarding a medal."
        )

func _all_awardable_scorecards_complete(cards: Array) -> bool:
    var found_awardable := false
    for card_value in cards:
        var card: Dictionary = card_value
        if not bool(card.get("canAward", false)):
            continue
        found_awardable = true
        if not _scorecard_complete(str(card.get("id"))):
            return false
    return found_awardable

func _update_finish_score_gate() -> void:
    if str(_latest_state.get("marketMode", "purchases")) != "medals":
        return
    var readiness: Dictionary = _latest_state.get("finishReadiness", {})
    if not bool(readiness.get("eligibleBuyer", true)):
        finish_button.disabled = true
        finish_button.tooltip_text = "Pair can browse the market. Results are frozen."
        return
    if bool(readiness.get("alreadyFinished", false)):
        finish_button.disabled = true
        finish_button.tooltip_text = "The medal choices have been submitted."
        return
    if not _all_awardable_scorecards_complete(Array(_latest_state.get("cards", []))):
        finish_button.disabled = true
        finish_button.tooltip_text = "Score every other advertisement before submitting the medals."
        return
    finish_button.disabled = not bool(readiness.get("locallyReady", false))
    finish_button.tooltip_text = (
        "Submit the pair's Gold, Silver and Bronze choices."
        if not finish_button.disabled
        else "Award all three medals to three different advertisements."
    )

func _render_teacher(state: Dictionary) -> void:
    team_surface.hide()
    teacher_surface.show()
    var readiness: Dictionary = state.get("readiness", {})
    var capacity: Dictionary = state.get("capacity", {})
    if bool(capacity.get("known", false)):
        seats_label.text = "%d / %d seats · %d open" % [
            int(readiness.get("teamCount", 0)),
            int(capacity.get("maxTeams", 0)),
            int(capacity.get("availableSeats", 0))
        ]
    else:
        seats_label.text = "%d teams joined" % int(readiness.get("teamCount", 0))
    var cohort: Dictionary = state.get("cohort", {})
    if bool(cohort.get("frozen", false)):
        var active_word := "still awarding" if state.get("marketMode") == "medals" else "still shopping"
        readiness_label.text = "%d ready · %d %s · %d watching · %d waiting for review" % [
            int(readiness.get("finishedRequiredCount", 0)),
            int(readiness.get("requiredFinishedCount", 0))
                - int(readiness.get("finishedRequiredCount", 0)),
            active_word,
            int(readiness.get("spectatingCount", 0)),
            int(readiness.get("pendingReviewCount", 0))
        ]
    else:
        readiness_label.text = "%d ready · %d building · %d waiting for review" % [
            int(readiness.get("finishedCount", 0)),
            int(readiness.get("unfinishedCount", 0)),
            int(readiness.get("pendingReviewCount", 0))
        ]
    var reveal: Dictionary = state.get("reveal", {})
    var reveal_visible := bool(reveal.get("visible", false))
    teacher_stats.visible = not reveal_visible
    teams_heading.visible = not reveal_visible
    teacher_teams.visible = not reveal_visible
    moderation_heading.visible = not reveal_visible
    moderation_cards.visible = not reveal_visible
    if reveal_visible:
        _clear_container(teacher_teams)
        _clear_container(moderation_cards)
    else:
        _render_teacher_teams(Array(state.get("teams", [])), str(state.get("phase")))
        _render_moderation(Dictionary(state.get("moderation", {})))
    var controls: Dictionary = state.get("controls", {})
    open_market_button.disabled = not bool(controls.get("canOpenMarket", false))
    reveal_button.disabled = not bool(controls.get("canOpenReveal", false))
    close_button.disabled = not bool(controls.get("canCloseMarket", false))
    _render_teacher_reveal(reveal)

func _render_teacher_teams(teams: Array, phase: String) -> void:
    _clear_container(teacher_teams)
    for team_value in teams:
        var team: Dictionary = team_value
        var row := HBoxContainer.new()
        row.add_theme_constant_override("separation", 12)
        row.set_meta("teamId", str(team.get("id")))
        teacher_teams.add_child(row)
        var ready_copy := "READY" if bool(team.get("finished", false)) else "BUILDING"
        var label := _add_label(row, "%s  ·  %s" % [str(team.get("alias")), ready_copy], 16, NAVY)
        label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
        if phase == "building":
            var remove := _new_button("Remove", "RemoveTeam", false)
            remove.tooltip_text = "Confirm this exact team before removing it."
            remove.pressed.connect(
                _request_remove_confirmation.bind(
                    str(team.get("id")),
                    str(team.get("alias")),
                    remove
                )
            )
            row.add_child(remove)

func _render_moderation(moderation: Dictionary) -> void:
    _clear_container(moderation_cards)
    for group_name in ["waiting", "approved", "returned", "hidden"]:
        for campaign_value in moderation.get(group_name, []):
            _add_moderation_card(Dictionary(campaign_value), group_name)

func _add_moderation_card(campaign: Dictionary, group_name: String) -> void:
    var panel := _new_card_panel(str(campaign.get("id")))
    moderation_cards.add_child(panel)
    var content := VBoxContainer.new()
    content.name = "CardContent"
    content.add_theme_constant_override("separation", 8)
    panel.add_child(content)
    content.add_child(_new_artwork(str(campaign.get("artworkKey"))))
    _add_label(content, _moderation_tag(group_name), 14, BURNT_ORANGE)
    _add_label(content, str(campaign.get("productName")), 19, NAVY)
    _add_label(content, str(campaign.get("sellerAlias")), 15, MUTED)
    _add_label(
        content,
        _format_currency(int(campaign.get("priceCents"))),
        16,
        NAVY
    )
    if campaign.has("reviewNote"):
        _add_label(content, "HOST NOTE · %s" % str(campaign.get("reviewNote")), 14, MUTED)
    var note := LineEdit.new()
    note.name = "ReviewNote"
    note.custom_minimum_size = Vector2(0, 44)
    note.max_length = 240
    note.placeholder_text = "Short note when returning this card"
    note.focus_mode = Control.FOCUS_ALL
    content.add_child(note)
    var actions := HBoxContainer.new()
    actions.name = "ReviewActions"
    actions.add_theme_constant_override("separation", 6)
    content.add_child(actions)
    var approve := _new_button("Approve", "Approve", true)
    var return_button := _new_button("Return", "Return", false)
    var hide_button := _new_button("Hide", "Hide", false)
    var displayed_submission_version := _submission_version_for_campaign(
        str(campaign.get("id"))
    )
    approve.pressed.connect(
        _review_campaign.bind(
            str(campaign.get("id")), displayed_submission_version, "approved", note
        )
    )
    return_button.pressed.connect(
        _review_campaign.bind(
            str(campaign.get("id")), displayed_submission_version, "returned", note
        )
    )
    hide_button.pressed.connect(
        _review_campaign.bind(
            str(campaign.get("id")), displayed_submission_version, "hidden", note
        )
    )
    actions.add_child(approve)
    actions.add_child(return_button)
    actions.add_child(hide_button)

func _moderation_tag(group_name: String) -> String:
    if group_name == "waiting":
        return "WAITING FOR REVIEW"
    if group_name == "approved":
        return "LIVE"
    return group_name.to_upper()

func _render_teacher_reveal(reveal: Dictionary) -> void:
    _clear_container(podium_list)
    var visible := bool(reveal.get("visible", false))
    teacher_reveal.visible = visible
    if not visible:
        return
    for place_value in reveal.get("topThree", []):
        var place: Dictionary = place_value
        var line := ""
        if place.has("points"):
            line = "%d · %s · %d points · %d Gold · %d Silver · %d Bronze" % [
                int(place.get("place")),
                str(place.get("alias")),
                int(place.get("points")),
                int(place.get("gold")),
                int(place.get("silver")),
                int(place.get("bronze"))
            ]
        else:
            line = "%d · %s · %s · %d backers" % [
                int(place.get("place")),
                str(place.get("alias")),
                _format_currency(int(place.get("revenueCents"))),
                int(place.get("sales"))
            ]
        var label := _add_label(podium_list, line, 21, NAVY)
        label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER

func _buy_campaign(campaign_id: String, button: Button) -> void:
    if market_host == null or _pending_purchases.has(campaign_id):
        return
    var purchase_request_id := "buy-%d-%d" % [Time.get_ticks_msec(), _purchase_sequence]
    _purchase_sequence += 1
    _pending_purchases[campaign_id] = purchase_request_id
    button.disabled = true
    _refresh_keyboard_order()
    network_status.text = "Sending backing choice…"
    var request_id := str(market_host.call("purchase", campaign_id, purchase_request_id))
    if request_id.is_empty():
        _pending_purchases.erase(campaign_id)
        button.disabled = false
        _show_safe_diagnostic()

func _award_campaign(campaign_id: String, medal: String, button: Button) -> void:
    if market_host == null or _pending_awards.has(medal):
        return
    _pending_awards[medal] = campaign_id
    button.disabled = true
    _refresh_keyboard_order()
    network_status.text = "Sending %s choice…" % medal.capitalize()
    var request_id := str(market_host.call("award", campaign_id, medal))
    if request_id.is_empty():
        _pending_awards.erase(medal)
        button.disabled = false
        _show_safe_diagnostic()

func _sync_pending_awards(award_summary: Dictionary) -> void:
    var by_medal: Dictionary = award_summary.get("byMedal", {})
    for medal in _pending_awards.keys():
        if (
            by_medal.has(str(medal))
            and Dictionary(by_medal.get(str(medal))).get("campaignId") == _pending_awards.get(medal)
        ):
            _pending_awards.erase(medal)

func _sync_pending_purchases(cards: Array) -> void:
    var bought: Dictionary = {}
    for card_value in cards:
        var card: Dictionary = card_value
        if bool(card.get("isBought", false)):
            bought[str(card.get("id"))] = true
    for campaign_id in _pending_purchases.keys():
        if bought.has(str(campaign_id)):
            _pending_purchases.erase(campaign_id)

func _finish_shopping() -> void:
    if market_host == null or finish_button.disabled:
        return
    finish_button.disabled = true
    _refresh_keyboard_order()
    var choice_name := (
        "medals"
        if str(_latest_state.get("marketMode", "purchases")) == "medals"
        else "purchases"
    )
    network_status.text = (
        "Practice market: checking %s…" % choice_name
        if _practice_mode
        else "Live market: checking %s…" % choice_name
    )
    if str(market_host.call("finish")).is_empty():
        _show_safe_diagnostic()

func _review_campaign(
    campaign_id: String,
    submission_version: int,
    status: String,
    note_input: LineEdit
) -> void:
    if market_host == null:
        return
    var note: Variant = null
    if status == "returned":
        var trimmed_note: String = note_input.text.strip_edges()
        if trimmed_note.is_empty():
            network_status.text = "Add a brief reason before returning this card."
            note_input.grab_focus()
            return
        note = trimmed_note
    network_status.text = "Advertisement desk updating…"
    market_host.call("review_campaign", campaign_id, submission_version, status, note)

func _submission_version_for_campaign(campaign_id: String) -> int:
    if typeof(_latest_snapshot.get("campaigns")) != TYPE_ARRAY:
        return 0
    for campaign_value in _latest_snapshot.get("campaigns"):
        if (
            typeof(campaign_value) == TYPE_DICTIONARY
            and Dictionary(campaign_value).get("id") == campaign_id
        ):
            return int(Dictionary(campaign_value).get("submissionVersion", 0))
    return 0

func _send_control(action: String) -> void:
    if market_host == null:
        return
    network_status.text = "Live room updating…"
    market_host.call("control", action)

func _request_remove_confirmation(
    team_id: String,
    alias: String,
    source: Control = null
) -> void:
    if str(_latest_state.get("phase")) != "building":
        return
    _remove_team_id = team_id
    _remove_team_alias = alias
    _remove_dialog_focus = source
    if _remove_dialog_focus == null:
        var viewport: Viewport = get_viewport()
        _remove_dialog_focus = viewport.gui_get_focus_owner() if viewport != null else null
    remove_team_dialog.dialog_text = (
        "Remove %s from this room? This will end the current room session."
        % alias
    )
    remove_team_dialog.get_ok_button().text = "Remove %s" % alias
    if remove_team_dialog.is_inside_tree():
        remove_team_dialog.popup_centered(Vector2i(560, 220))
    else:
        remove_team_dialog.visible = true

func _confirm_remove_team() -> void:
    if (
        market_host == null
        or _remove_team_id.is_empty()
        or str(_latest_state.get("phase")) != "building"
    ):
        _restore_remove_dialog_focus()
        return
    var team_still_present := false
    for team_value in _latest_state.get("teams", []):
        if str(Dictionary(team_value).get("id")) == _remove_team_id:
            team_still_present = true
            break
    if not team_still_present:
        _remove_team_id = ""
        _remove_team_alias = ""
        _restore_remove_dialog_focus()
        return
    network_status.text = "Removing %s…" % _remove_team_alias
    market_host.call("control", "removeTeam", _remove_team_id)
    _remove_team_id = ""
    _remove_team_alias = ""
    _restore_remove_dialog_focus()

func _cancel_remove_team() -> void:
    _remove_team_id = ""
    _remove_team_alias = ""
    _restore_remove_dialog_focus()

func _restore_remove_dialog_focus() -> void:
    var target := _remove_dialog_focus
    _remove_dialog_focus = null
    if target != null and is_instance_valid(target) and target.is_inside_tree():
        target.grab_focus()

func _poll_snapshot() -> void:
    if market_host != null and not _active_role.is_empty() and visible:
        market_host.call("request_snapshot_silently")

func _retry_snapshot() -> void:
    if market_host == null:
        return
    network_status.text = "Retrying…"
    retry_button.hide()
    _refresh_keyboard_order()
    market_host.call("request_snapshot_silently")

func _on_snapshot_received(snapshot: Dictionary) -> void:
    if not _active_role.is_empty():
        present_snapshot(snapshot)

func _on_artwork_received(artwork_key: String, png_bytes: PackedByteArray) -> void:
    if not _artwork_targets.has(artwork_key):
        return
    var image := Image.new()
    if image.load_png_from_buffer(png_bytes) != OK:
        return
    var texture := ImageTexture.create_from_image(image)
    for target_value in _artwork_targets.get(artwork_key, []):
        var target := target_value as TextureRect
        if is_instance_valid(target):
            target.texture = texture

func _on_market_diagnostic(_message: String) -> void:
    _pending_purchases.clear()
    _pending_awards.clear()
    _show_safe_diagnostic()

func _on_market_request_failed(code: String, _message: String) -> void:
    _pending_purchases.clear()
    _pending_awards.clear()
    network_status.text = _student_market_error(code)
    retry_button.show()
    _refresh_keyboard_order()

func _on_purchase_completed(_result: Dictionary) -> void:
    network_status.text = "Backing recorded. Refreshing the stalls…"

func _on_award_completed(_result: Dictionary) -> void:
    network_status.text = "Medal recorded. Refreshing the gallery…"

func _on_control_completed(_action: String, _result: Dictionary) -> void:
    network_status.text = "Room update received."

func _on_campaign_published(_result: Dictionary) -> void:
    network_status.text = "Market card delivered to the host."

func _show_safe_diagnostic() -> void:
    network_status.text = (
        "Practice market update failed. Retry that move."
        if _practice_mode
        else "Live market update failed. Check the room connection, then retry."
    )
    retry_button.show()
    _refresh_keyboard_order()

func _student_market_error(code: String) -> String:
    var canonical: String = String({
        "ROOM_EXPIRED": "SESSION_EXPIRED",
        "MARKET_UNAVAILABLE": "CONNECTION_UNAVAILABLE",
        "TRANSPORT_ERROR": "CONNECTION_UNAVAILABLE",
        "TIMEOUT": "CONNECTION_TIMEOUT"
    }.get(code, code))
    return String(STUDENT_MARKET_ERRORS.get(
        canonical,
        STUDENT_MARKET_ERRORS.get("CONNECTION_UNAVAILABLE")
    ))

func _request_visible_artwork() -> void:
    if market_host == null:
        return
    for artwork_key in _artwork_targets:
        market_host.call("request_artwork", str(artwork_key))

func _new_artwork(artwork_key: String) -> TextureRect:
    var artwork := TextureRect.new()
    artwork.name = "Artwork"
    artwork.custom_minimum_size = Vector2(320, 180)
    artwork.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
    artwork.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
    artwork.mouse_filter = Control.MOUSE_FILTER_IGNORE
    artwork.set_meta("artworkKey", artwork_key)
    var targets: Array = _artwork_targets.get(artwork_key, [])
    targets.append(artwork)
    _artwork_targets[artwork_key] = targets
    return artwork

func _new_card_panel(id: String) -> PanelContainer:
    var panel := PanelContainer.new()
    panel.custom_minimum_size = Vector2(320, 0)
    panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
    panel.add_theme_stylebox_override("panel", _panel_style(OFF_WHITE, KRAFT_BORDER, 10, 16))
    panel.set_meta("campaignId", id)
    return panel

func _new_button(label: String, node_name: String, primary: bool) -> Button:
    var button := Button.new()
    button.name = node_name
    button.text = label
    button.custom_minimum_size = Vector2(96, 44)
    button.focus_mode = Control.FOCUS_ALL
    button.add_theme_font_size_override("font_size", 15)
    button.add_theme_color_override("font_color", WHITE)
    button.add_theme_color_override("font_hover_color", WHITE)
    button.add_theme_color_override("font_pressed_color", WHITE)
    button.add_theme_color_override("font_hover_pressed_color", WHITE)
    button.add_theme_color_override("font_focus_color", WHITE)
    button.add_theme_color_override("font_disabled_color", NAVY)
    var normal_color := GOLD if primary else NAVY
    var hover_color := GOLD.lightened(0.08) if primary else NAVY.lightened(0.08)
    var pressed_color := normal_color.darkened(0.06)
    if primary:
        button.add_theme_color_override("font_color", NAVY)
        button.add_theme_color_override("font_hover_color", NAVY)
        button.add_theme_color_override("font_pressed_color", NAVY)
        button.add_theme_color_override("font_hover_pressed_color", NAVY)
        button.add_theme_color_override("font_focus_color", NAVY)
    button.add_theme_stylebox_override("normal", _button_style(normal_color))
    button.add_theme_stylebox_override("hover", _button_style(hover_color))
    button.add_theme_stylebox_override("pressed", _button_style(pressed_color))
    button.add_theme_stylebox_override("hover_pressed", _button_style(pressed_color))
    button.add_theme_stylebox_override("focus", _focus_style())
    button.add_theme_stylebox_override("disabled", _button_style(KRAFT_BORDER))
    return button

func _public_controls_in_tree_order() -> Array[Control]:
    var controls: Array[Control] = []
    _append_public_controls(self, controls)
    return controls

func _append_public_controls(parent: Node, controls: Array[Control]) -> void:
    for child_value in parent.get_children(false):
        var child: Node = child_value as Node
        var control := child as Control
        if control != null:
            controls.append(control)
        _append_public_controls(child, controls)

func _is_visible_within_market(control: Control) -> bool:
    var current := control as CanvasItem
    while current != null:
        if not current.visible:
            return false
        if current == self:
            return true
        current = current.get_parent() as CanvasItem
    return false

func _keyboard_controls() -> Array[Control]:
    var controls: Array[Control] = []
    for control in _public_controls_in_tree_order():
        if (
            control.focus_mode != Control.FOCUS_ALL
            or not _is_visible_within_market(control)
        ):
            continue
        if control is BaseButton and (control as BaseButton).disabled:
            continue
        if control is LineEdit and not (control as LineEdit).editable:
            continue
        controls.append(control)
    return controls

func _refresh_keyboard_order() -> void:
    for control in _public_controls_in_tree_order():
        if control.focus_mode != Control.FOCUS_ALL:
            continue
        control.focus_next = NodePath()
        control.focus_previous = NodePath()
    var controls := _keyboard_controls()
    for index in controls.size():
        var control := controls[index] as Control
        if index > 0:
            control.focus_previous = control.get_path_to(controls[index - 1])
        if index + 1 < controls.size():
            control.focus_next = control.get_path_to(controls[index + 1])

func _add_label(parent: Node, copy: String, font_size: int, color: Color) -> Label:
    var label := Label.new()
    label.text = copy
    label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
    label.add_theme_font_size_override("font_size", font_size)
    label.add_theme_color_override("font_color", color)
    parent.add_child(label)
    return label

func _panel_style(background: Color, border: Color, radius: int, margin: int) -> StyleBoxFlat:
    var style := StyleBoxFlat.new()
    style.bg_color = background
    style.border_color = border
    style.set_border_width_all(1)
    style.set_corner_radius_all(radius)
    style.content_margin_left = margin
    style.content_margin_top = margin
    style.content_margin_right = margin
    style.content_margin_bottom = margin
    return style

func _button_style(background: Color) -> StyleBoxFlat:
    var style := StyleBoxFlat.new()
    style.bg_color = background
    style.set_corner_radius_all(8)
    style.content_margin_left = 14
    style.content_margin_right = 14
    style.content_margin_top = 10
    style.content_margin_bottom = 10
    return style

func _focus_style() -> StyleBoxFlat:
    var style := StyleBoxFlat.new()
    style.bg_color = Color(0, 0, 0, 0)
    style.border_color = GOLD
    style.set_border_width_all(3)
    style.set_corner_radius_all(10)
    return style

func _clear_container(container: Node) -> void:
    for child in container.get_children():
        container.remove_child(child)
        child.queue_free()

func _apply_columns() -> void:
    if not is_node_ready():
        return
    var width := size.x
    if width <= 0.0:
        return
    var columns := columns_for_width(width)
    team_cards.columns = columns
    moderation_cards.columns = columns

func _format_currency(cents: int) -> String:
    if cents % 100 == 0:
        return "$%d" % (cents / 100)
    return "$%.2f" % (float(cents) / 100.0)

func _phase_copy(phase: String) -> String:
    if phase == "building":
        return "Advertisements are being built and reviewed."
    if phase == "market":
        return (
            "The market gallery is open for awards."
            if str(_latest_state.get("marketMode", "purchases")) == "medals"
            else "The market floor is open for purchases."
        )
    if phase == "reveal":
        return "The market podium is ready for the reveal."
    if phase == "closed":
        return "The market is closed."
    return "The room is being prepared."
