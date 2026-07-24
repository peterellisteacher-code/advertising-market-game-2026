# Godot 4.x — @export var, await, Control containers, instance.signal.connect(method)
extends Control

signal fix_requested

const MarketViewState = preload("res://src/market/MarketViewState.gd")
const NAVY := Color("#17212b")
const BURNT_ORANGE := Color("#b63a15")
const ORANGE_HOVER := Color("#c3471b")
const OFF_WHITE := Color("#fffaf0")
const KRAFT := Color("#f4ead6")
const KRAFT_BORDER := Color("#d7c7aa")
const MUTED := Color("#505a64")
const WHITE := Color("#ffffff")

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
var _active_role := ""
var _room_code := ""
var _latest_snapshot: Dictionary = {}
var _latest_state: Dictionary = {}
var _purchase_sequence := 1
var _pending_purchases: Dictionary = {}
var _pending_awards: Dictionary = {}
var _artwork_targets: Dictionary = {}
var _remove_team_id := ""
var _remove_team_alias := ""
var _practice_mode := false
var _ready_wired := false

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
    hide()

func show_publication_waiting() -> void:
    phase_status.text = "Your market card is with the host."
    campaign_status_title.text = "Waiting for the host"
    campaign_status_copy.text = "The card is in the review queue. You may keep this screen open."
    fix_button.hide()
    team_surface.show()
    show()

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

func columns_for_width(width: float) -> int:
    if width >= 1700.0:
        return 4
    if width >= 1100.0:
        return 3
    return 2

func _connect_host(connecting: bool) -> void:
    var bindings := [
        ["snapshot_received", Callable(self, "_on_snapshot_received")],
        ["artwork_received", Callable(self, "_on_artwork_received")],
        ["diagnostic", Callable(self, "_on_market_diagnostic")],
        ["purchase_completed", Callable(self, "_on_purchase_completed")],
        ["award_completed", Callable(self, "_on_award_completed")],
        ["control_completed", Callable(self, "_on_control_completed")],
        ["campaign_published", Callable(self, "_on_campaign_published")]
    ]
    for binding in bindings:
        var signal_name := str(binding[0])
        var callback: Callable = binding[1]
        if not market_host.has_signal(signal_name):
            continue
        if connecting and not market_host.is_connected(signal_name, callback):
            market_host.connect(signal_name, callback)
        elif not connecting and market_host.is_connected(signal_name, callback):
            market_host.disconnect(signal_name, callback)

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
    _clear_container(team_cards)
    var reveal_phase := str(state.get("phase")) in ["reveal", "closed"]
    student_reveal.visible = reveal_phase
    student_reveal_copy.text = (
        "Your Gold, Silver and Bronze choices are locked. The host will reveal the market podium."
        if medal_mode
        else "Practice round complete. You backed two different stalls and spent your market wallet. In a live room, the host reveals which campaign earned the most."
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
        var awarded_medal := str(card.get("awardedMedal", ""))
        if not awarded_medal.is_empty():
            _add_label(content, "%s awarded" % awarded_medal.capitalize(), 16, BURNT_ORANGE)
        if bool(card.get("canAward", false)):
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
                award_button.disabled = (
                    is_current
                    or (not awarded_medal.is_empty() and not is_current)
                    or _pending_awards.has(medal_name)
                )
                award_button.tooltip_text = (
                    "%s is already on this ad." % medal_name.capitalize()
                    if is_current
                    else "Move the %s medal to this ad." % medal_name.capitalize()
                )
                award_button.pressed.connect(
                    _award_campaign.bind(str(card.get("id")), medal_name, award_button)
                )
                medal_row.add_child(award_button)
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
                _request_remove_confirmation.bind(str(team.get("id")), str(team.get("alias")))
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
    network_status.text = (
        "Practice market: checking medals…"
        if _practice_mode
        else "Live market: checking medals…"
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
        var trimmed_note := note_input.text.strip_edges()
        if trimmed_note.is_empty():
            network_status.text = "Add a brief reason before returning this card."
            note_input.grab_focus()
            return
        note = trimmed_note
    network_status.text = "Campaign desk updating…"
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

func _request_remove_confirmation(team_id: String, alias: String) -> void:
    if str(_latest_state.get("phase")) != "building":
        return
    _remove_team_id = team_id
    _remove_team_alias = alias
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
        return
    var team_still_present := false
    for team_value in _latest_state.get("teams", []):
        if str(Dictionary(team_value).get("id")) == _remove_team_id:
            team_still_present = true
            break
    if not team_still_present:
        _remove_team_id = ""
        _remove_team_alias = ""
        return
    network_status.text = "Removing %s…" % _remove_team_alias
    market_host.call("control", "removeTeam", _remove_team_id)
    _remove_team_id = ""
    _remove_team_alias = ""

func _poll_snapshot() -> void:
    if market_host != null and not _active_role.is_empty() and visible:
        market_host.call("request_snapshot_silently")

func _retry_snapshot() -> void:
    if market_host == null:
        return
    network_status.text = "Retrying…"
    retry_button.hide()
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
    var normal_color := BURNT_ORANGE if primary else NAVY
    var hover_color := ORANGE_HOVER if primary else NAVY.lightened(0.08)
    button.add_theme_stylebox_override("normal", _button_style(normal_color))
    button.add_theme_stylebox_override("hover", _button_style(hover_color))
    button.add_theme_stylebox_override("pressed", _button_style(normal_color.darkened(0.04)))
    button.add_theme_stylebox_override("focus", _focus_style())
    return button

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
    style.border_color = BURNT_ORANGE
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
        return "Campaigns are being built and reviewed."
    if phase == "market":
        return "The market gallery is open for awards."
    if phase == "reveal":
        return "The market podium is ready for the reveal."
    if phase == "closed":
        return "The market is closed."
    return "The room is being prepared."
