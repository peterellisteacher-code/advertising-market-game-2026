extends Control
class_name AdMarketMain

const WebCreatorTransport = preload("res://src/creator/transport/web_creator_transport.gd")
const WebMarketTransport = preload("res://src/market/transport/web_market_transport.gd")
const PracticeBridge = preload("res://src/practice/practice_bridge.gd")
const WebPracticeTransport = preload("res://src/practice/transport/web_practice_transport.gd")
const LocalMarketSession = preload("res://src/market/local_market_session.gd")
const MarketScreen = preload("res://src/market/ui/market_screen.gd")
const MarketViewState = preload("res://src/market/market_view_state.gd")
const GameRun = preload("res://src/game/game_run.gd")
const WebRunProgressStore = preload("res://src/game/web_run_progress_store.gd")
const GameAccessibilityMirror = preload("res://src/main/game_accessibility_mirror.gd")
const AGENCY_CAMPAIGN_CONTROLLER_PATH := "res://src/agency/agency_campaign_controller.gd"
const MARKET_COMPATIBILITY_WALLET_CENTS := 10000
const LIVE_PROGRESS_CONTRACT := WebRunProgressStore.CONTRACT
const MAX_LIVE_PROGRESS_BYTES := WebRunProgressStore.MAX_PROGRESS_BYTES
const STUDENT_MARKET_ERRORS := {
    "INVALID_ROOM_CODE": "Enter the room code in the format ABC-234.",
    "ROOM_NOT_FOUND": "That room could not be found. Check the code and try again.",
    "ROOM_UNAVAILABLE": "That room is not available. Ask your teacher what to do next.",
    "CONNECTION_TIMEOUT": "The connection took too long. Check the network and try again.",
    "CONNECTION_UNAVAILABLE": "The market could not be reached. Check the network and try again.",
    "RATE_LIMITED": "Too many requests were sent. Wait briefly, then try again.",
    "SESSION_EXPIRED": "This market session has ended. Rejoin the room to continue."
}
const LEVEL_COPY := {
    "invent": {
        "eyebrow": "LEVEL 1 // INVENT IT",
        "heading": "Design a product that meets one customer need the audience has not yet recognised.",
        "clue": "Identify one customer need. Design a product for it, then give the product a distinctive name."
    },
    "sell": {
        "eyebrow": "LEVEL 2 // SELL IT",
        "heading": "Apply the four AIDA stages — Attention, Interest, Desire, Action — to the Level 1 product.",
        "clue": "Capture Attention, hold Interest, build Desire, then state the next Action."
    },
    "irresistible": {
        "eyebrow": "LEVEL 3 // FINALISE IT",
        "heading": "Refine the advertisement so it communicates the product's value to the audience.",
        "clue": "Choose the product price and market route, select its strongest features, then refine the final appearance."
    }
}

const AIDA_NEXT_ACTIONS := {
    "attention": "Next: link one choice to Attention.",
    "interest": "Next: link one choice to Interest.",
    "desire": "Next: link one choice to Desire.",
    "action": "Next: link one choice to Action."
}

@onready var creator_host: Node = %CreatorHost
@onready var market_host: Node = %MarketHost
@onready var market_screen: MarketScreen = %MarketScreen as MarketScreen
@onready var agency_world: AdMarketAgencyWorld = %AgencyWorld as AdMarketAgencyWorld
@onready var pitch_theatre: AdMarketPitchTheatre = %PitchTheatre as AdMarketPitchTheatre
@onready var agency_audio: AdMarketAgencyAudioManager = %AgencyAudio as AdMarketAgencyAudioManager
@onready var launch_button: Button = %LaunchCreator
@onready var status: Label = %Status
@onready var hero_heading: Label = $MainMargin/GameInput/HeroHeading
@onready var lobby_heading: Label = $MainMargin/GameInput/LobbyPanel/LobbyContent/LobbyHeading
@onready var lobby_panel: Control = %LobbyPanel
@onready var team_alias: LineEdit = %TeamAlias
@onready var room_code: LineEdit = %RoomCode
@onready var join_live_market: Button = %JoinLiveMarket
@onready var join_area: Control = %JoinArea
@onready var join_market_toggle: Button = %JoinMarketToggle
@onready var teacher_setup_toggle: Button = %TeacherSetupToggle
@onready var host_area: Control = %HostArea
@onready var classroom_code: LineEdit = %ClassroomCode
@onready var max_teams: SpinBox = %MaxTeams
@onready var create_live_market: Button = %CreateLiveMarket
@onready var start_button: Button = %StartRun
@onready var run_panel: Control = %RunPanel
@onready var level_progress: HBoxContainer = %LevelProgress
@onready var level_eyebrow: Label = %LevelEyebrow
@onready var level_heading: Label = %LevelHeading
@onready var level_clue: Label = %LevelClue
@onready var lock_level: Button = %LockLevel
@onready var advance_level: Button = %AdvanceLevel
@onready var publish_campaign: Button = %PublishCampaign
@onready var enter_market: Button = %EnterMarket
@onready var review_instructions: Button = %ReviewInstructions
@onready var role_guide: Button = %RoleGuide
@onready var instructions_dialog: AcceptDialog = %InstructionsDialog
@onready var instructions_text: RichTextLabel = %InstructionsText
@onready var role_guide_dialog: AcceptDialog = %RoleGuideDialog
@onready var role_guide_text: RichTextLabel = %RoleGuideText
@onready var keyboard_hint: Label = %KeyboardHint
@onready var final_review: Control = %FinalReview
@onready var review_audience: CheckBox = %ReviewAudience
@onready var review_value: CheckBox = %ReviewValue
@onready var review_aida: CheckBox = %ReviewAida
@onready var review_visual: CheckBox = %ReviewVisual
@onready var review_claim: CheckBox = %ReviewClaim
@onready var final_review_status: Label = %FinalReviewStatus
@onready var invent_chip: Label = %InventChip
@onready var sell_chip: Label = %SellChip
@onready var irresistible_chip: Label = %IrresistibleChip

var _game_run: RefCounted = GameRun.new()
var _agency_campaign: AdMarketAgencyCampaignController
var _campaign_document: Dictionary = {}
var _level_locked: bool = false
var creator_transport_override: RefCounted
var market_transport_override: RefCounted
var practice_transport_override: RefCounted
var run_progress_store_override: RefCounted
var _publish_after_open: bool = false
var _published_campaign: Dictionary = {}
var _room_role: String = ""
var _room_code: String = ""
var _room_campaign_submitted: bool = false
var _live_publication_pending: bool = false
var _pitch_finished: bool = false
var _pitch_market_ready: bool = false
var _pitch_waiting_for_market: bool = false
var _latest_market_snapshot: Dictionary = {}
var _local_market_session: Node
var _ready_wired: bool = false
var _practice_bridge: Node
var _practice_recovery: Dictionary = {}
var _practice_pending_method: String = ""
var _practice_pending_request_id: String = ""
var _practice_pending_context: String = ""
var _practice_ready: bool = false
var _practice_operation_counter: int = 0
var _pending_creator_document: Dictionary = {}
var _practice_pending_operation: Dictionary = {}
var _practice_retry_operation: Dictionary = {}
var _queued_practice_pitch: Dictionary = {}
var _startup_state: String = "idle"
var _run_progress_store: RefCounted
var _last_saved_live_progress: Dictionary = {}
var _suspend_agency_progress_persistence: bool = false
var _startup_progress_matched: bool = false
var _startup_expected_document_revision: int = -1
var _accessibility_mirror: RefCounted = GameAccessibilityMirror.new()
var _dialog_focus_target: Control

func _process(_delta: float) -> void:
    if agency_audio != null and agency_world != null:
        agency_audio.set_reading_active(agency_world.visible and agency_world.reading_active())
    if lobby_panel.visible:
        _accessibility_mirror.update(
            "FIRST MOVE",
            hero_heading.text,
            lobby_heading.text,
            status.text,
            _focused_control_label(),
            keyboard_hint.text
        )
    elif run_panel.visible:
        _accessibility_mirror.update(
            level_eyebrow.text,
            level_heading.text,
            level_clue.text,
            status.text,
            _focused_control_label(),
            keyboard_hint.text
        )
    elif agency_world != null and agency_world.visible:
        var agency_accessibility: Dictionary = agency_world.accessibility_state()
        _accessibility_mirror.update(
            String(agency_accessibility.get("eyebrow", "ADVERTISEMENT WORK")),
            String(agency_accessibility.get("heading", "Create and pitch one persuasive advertisement.")),
            String(agency_accessibility.get("currentInstruction", "Follow the next task in the agency guide.")),
            String(agency_accessibility.get("completionStatus", status.text)),
            _focused_control_label(),
            keyboard_hint.text
        )
    else:
        var market_accessibility: Dictionary = market_screen.call("accessibility_state")
        _accessibility_mirror.update(
            "LIVE MARKET",
            String(market_accessibility.get("heading", "The class market is open.")),
            String(market_accessibility.get("currentInstruction", "")),
            String(market_accessibility.get("completionStatus", status.text)),
            _focused_control_label(),
            keyboard_hint.text
        )

func _ready() -> void:
    if _ready_wired:
        return
    _ready_wired = true
    _accessibility_mirror.reduced_motion_changed.connect(_on_reduced_motion_changed)
    _accessibility_mirror.bind_reduced_motion()
    _on_reduced_motion_changed(_accessibility_mirror.reduced_motion_enabled())
    _campaign_document = _blank_campaign_document()
    var agency_controller_script: Script = load(AGENCY_CAMPAIGN_CONTROLLER_PATH) as Script
    _agency_campaign = agency_controller_script.new() as AdMarketAgencyCampaignController
    agency_world.station_requested.connect(_on_agency_station_requested)
    agency_world.role_handoff_requested.connect(_on_agency_role_handoff_requested)
    agency_world.audio_settings_requested.connect(_on_agency_audio_settings_requested)
    agency_world.audio_settings_changed.connect(_on_agency_audio_settings_changed)
    _agency_campaign.creator_requested.connect(_open_creator)
    _agency_campaign.publish_requested.connect(_publish_campaign)
    _agency_campaign.market_requested.connect(_enter_market)
    _agency_campaign.progress_changed.connect(_on_agency_progress_changed)
    _agency_campaign.status_changed.connect(_on_agency_status_changed)
    var mission_controller: AdMarketAgencyMissionController = (
        agency_world.get_node_or_null("%AgencyMissionController")
        as AdMarketAgencyMissionController
    )
    if mission_controller != null:
        mission_controller.mission_completed.connect(_on_agency_mission_completed)
        mission_controller.sidequest_completed.connect(_on_agency_sidequest_completed)
    var selected_transport: RefCounted = creator_transport_override
    if selected_transport == null:
        selected_transport = WebCreatorTransport.new()
    if selected_transport.has_signal("diagnostic"):
        selected_transport.connect("diagnostic", _show_diagnostic)
    creator_host.set_transport(selected_transport)
    creator_host.game_input_root = %GameInput
    creator_host.launch_button = launch_button
    creator_host.diagnostic.connect(_show_diagnostic)
    creator_host.creator_opened.connect(_on_creator_opened)
    creator_host.creator_closed.connect(_on_creator_closed)
    creator_host.creator_state_received.connect(_on_creator_state_received)
    creator_host.latest_draft_received.connect(_on_latest_draft_received)
    creator_host.creator_published.connect(_on_creator_published)
    pitch_theatre.pitch_finished.connect(_on_pitch_finished)
    pitch_theatre.format_changed.connect(_on_pitch_setting_changed)
    pitch_theatre.animation_changed.connect(_on_pitch_setting_changed)
    pitch_theatre.sound_requested.connect(_on_pitch_sound_requested)
    var selected_market_transport: RefCounted = market_transport_override
    if selected_market_transport == null:
        selected_market_transport = WebMarketTransport.new()
    market_host.set_transport(selected_market_transport)
    market_host.diagnostic.connect(_show_market_diagnostic)
    market_host.room_created.connect(_on_room_created)
    market_host.room_joined.connect(_on_room_joined)
    market_host.room_join_failed.connect(_on_room_join_failed)
    market_host.room_resumed.connect(_on_room_resumed)
    market_host.room_resume_failed.connect(_on_room_resume_failed)
    market_host.snapshot_received.connect(_on_market_snapshot)
    market_host.campaign_published.connect(_on_market_campaign_published)
    market_host.market_request_failed.connect(_on_market_request_failed)
    if not market_screen.is_node_ready():
        market_screen.call("_ready")
    market_screen.set_market_host(market_host)
    market_screen.fix_requested.connect(_reopen_returned_campaign)
    join_live_market.pressed.connect(_join_live_room)
    join_market_toggle.pressed.connect(_toggle_join_market)
    teacher_setup_toggle.pressed.connect(_toggle_teacher_setup)
    create_live_market.pressed.connect(_create_live_room)
    start_button.pressed.connect(_start_run)
    launch_button.pressed.connect(_open_creator)
    lock_level.pressed.connect(_lock_current_level)
    advance_level.pressed.connect(_advance_level)
    publish_campaign.pressed.connect(_publish_campaign)
    enter_market.pressed.connect(_enter_market)
    review_instructions.pressed.connect(_show_instructions)
    role_guide.pressed.connect(_show_role_guide)
    instructions_dialog.confirmed.connect(_restore_dialog_focus)
    instructions_dialog.canceled.connect(_restore_dialog_focus)
    role_guide_dialog.confirmed.connect(_restore_dialog_focus)
    role_guide_dialog.canceled.connect(_restore_dialog_focus)
    for review_check in _final_review_checks():
        review_check.toggled.connect(_on_final_review_changed)
    run_panel.hide()
    market_screen.hide()
    _hide_agency()
    _setup_practice_recovery()
    _run_progress_store = run_progress_store_override
    if _run_progress_store == null:
        _run_progress_store = WebRunProgressStore.new()
    _begin_startup()
    _focus_if_ready(team_alias)

func _on_reduced_motion_changed(enabled: bool) -> void:
    if agency_world != null:
        agency_world.set_reduced_motion_enabled(enabled)
    if pitch_theatre != null:
        pitch_theatre.set_reduced_motion_enabled(enabled)

func _begin_agency() -> void:
    if _agency_campaign == null:
        return
    var run: AdMarketGameRun = _game_run as AdMarketGameRun
    if run != null:
        _agency_campaign.begin_agency(run, _campaign_document)

func _show_agency() -> void:
    if agency_world == null or _agency_campaign == null:
        return
    var run: AdMarketGameRun = _game_run as AdMarketGameRun
    if run == null:
        return
    _agency_campaign.restore_agency(run, _campaign_document)
    var progress := run.agency_progress() as AdMarketAgencyProgress
    agency_world.configure(progress)
    if agency_audio != null and progress != null:
        agency_audio.apply_settings(progress.audio_settings)
        agency_audio.play_ambience("office")
    lobby_panel.hide()
    market_screen.hide()
    run_panel.hide()
    agency_world.show()
    _set_agency_surface_visible(true)
    agency_world.set_input_enabled(not bool(creator_host.get("creator_is_open")))

func _hide_agency() -> void:
    if agency_world == null:
        return
    agency_world.set_input_enabled(false)
    _set_agency_surface_visible(false)
    agency_world.hide()

func _set_agency_surface_visible(is_visible: bool) -> void:
    var surface := agency_world.get_node_or_null("HUD") as CanvasLayer
    if surface != null:
        surface.visible = is_visible

func _on_agency_station_requested(station_id: String) -> void:
    if _agency_campaign == null:
        return
    agency_audio.confirm_user_gesture()
    agency_audio.play_sfx("ui-confirm")
    agency_audio.play_ambience("office")
    var result: Dictionary = _agency_campaign.open_station(station_id)
    if not bool(result.get("allowed", false)):
        status.text = String(result.get("reason", "That room is not available yet."))

func _on_agency_role_handoff_requested(role: String) -> void:
    agency_audio.confirm_user_gesture()
    agency_audio.play_sfx("ui-confirm")
    agency_audio.play_ambience("office")
    if _agency_campaign != null:
        _agency_campaign.handoff_to(role)

func _on_agency_mission_completed(mission_id: String, evidence: Dictionary) -> void:
    if _agency_campaign == null:
        return
    if _agency_campaign.complete_mission(mission_id, evidence):
        agency_audio.play_cue("portfolio-stamp")
        _agency_campaign.reconcile_level_readiness(_readiness_clue())
        _render_level()

func _on_agency_sidequest_completed(sidequest_id: String) -> void:
    if _agency_campaign != null and _agency_campaign.complete_sidequest(sidequest_id):
        agency_audio.play_cue("portfolio-stamp")

func _on_agency_progress_changed() -> void:
    var run: AdMarketGameRun = _game_run as AdMarketGameRun
    if run == null:
        return
    if _agency_campaign != null:
        _campaign_document = _agency_campaign.document()
    if agency_world != null:
        agency_world.configure(run.agency_progress() as AdMarketAgencyProgress)
    if not _suspend_agency_progress_persistence:
        _save_live_progress()

func _on_agency_status_changed(message: String) -> void:
    status.text = message

func _on_agency_audio_settings_requested() -> void:
    agency_audio.confirm_user_gesture()
    agency_audio.play_sfx("ui-move")
    agency_audio.play_ambience("office")

func _on_agency_audio_settings_changed(settings: Dictionary) -> void:
    agency_audio.confirm_user_gesture()
    agency_audio.apply_settings(settings)
    agency_audio.play_sfx("ui-confirm")
    agency_audio.play_ambience("office")
    var run := _game_run as AdMarketGameRun
    var progress := run.agency_progress() as AdMarketAgencyProgress if run != null else null
    if progress != null:
        progress.audio_settings = settings.duplicate(true)
        _on_agency_progress_changed()

func _toggle_teacher_setup() -> void:
    host_area.visible = not host_area.visible
    teacher_setup_toggle.text = "Hide teacher setup" if host_area.visible else "Teacher setup"
    _focus_if_ready(classroom_code if host_area.visible else team_alias)

func _toggle_join_market() -> void:
    join_area.visible = not join_area.visible
    join_market_toggle.text = "Hide the class market" if join_area.visible else "Join the class market"
    _focus_if_ready(room_code if join_area.visible else team_alias)

func _setup_practice_recovery() -> void:
    _practice_bridge = PracticeBridge.new()
    add_child(_practice_bridge)
    var selected_transport: RefCounted = practice_transport_override
    if selected_transport == null:
        selected_transport = WebPracticeTransport.new()
    _practice_bridge.set_transport(selected_transport)
    _practice_bridge.request_succeeded.connect(_on_practice_request_succeeded)
    _practice_bridge.request_failed.connect(_on_practice_request_failed)

func _begin_startup() -> void:
    _startup_state = "live-resume"
    start_button.disabled = false
    status.text = "Checking live market status. Practice is ready now."
    market_host.resume_session()

func _on_room_resumed(wrapper: Variant) -> void:
    if _startup_state != "live-resume":
        return
    if wrapper == null:
        _startup_state = "practice-resume"
        status.text = "Checking this computer for a saved pitch."
        _issue_practice_resume("startup")
        return
    if typeof(wrapper) != TYPE_DICTIONARY:
        _on_room_resume_failed("INVALID_ROOM_RESPONSE", "Live resume was invalid.")
        return
    var resumed: Dictionary = wrapper
    match String(resumed.get("role", "")):
        "teacher":
            _startup_state = "complete"
            _on_room_created(resumed)
        "team":
            _begin_resumed_team(resumed)
        _:
            _on_room_resume_failed("INVALID_ROOM_RESPONSE", "Live resume role was invalid.")

func _on_room_resume_failed(code: String, _message: String) -> void:
    if _startup_state != "live-resume":
        return
    _startup_state = "live-error"
    _practice_ready = true
    start_button.disabled = false
    lobby_panel.show()
    run_panel.hide()
    market_screen.hide()
    status.text = _student_market_error(code)

func _on_latest_draft_received(document: Variant) -> void:
    if _startup_state != "team-hydrating":
        return
    if document == null:
        if _startup_progress_matched and _startup_expected_document_revision > 0:
            _fail_live_hydration()
            return
        _finish_resumed_team(_campaign_document)
        return
    if typeof(document) != TYPE_DICTIONARY:
        _fail_live_hydration()
        return
    var latest: Dictionary = document
    if not _live_document_identity_matches(latest):
        _fail_live_hydration()
        return
    if (
        _startup_progress_matched
        and int(latest.get("revision", -1)) != _startup_expected_document_revision
    ):
        _fail_live_hydration()
        return
    _finish_resumed_team(latest)

func _issue_practice_resume(context: String) -> void:
    if not _practice_pending_method.is_empty():
        return
    _begin_practice_request("resume", context)
    var request_id: String = _practice_bridge.resume()
    _remember_practice_request_id("resume", request_id)

func _begin_practice_request(method: String, context: String) -> void:
    _practice_pending_method = method
    _practice_pending_request_id = ""
    _practice_pending_context = context

func _remember_practice_request_id(method: String, request_id: String) -> void:
    if _practice_pending_method != method:
        return
    _practice_pending_request_id = request_id
    if request_id.is_empty():
        _clear_practice_request()

func _practice_request_matches(request_id: String, method: String) -> bool:
    return (
        _practice_pending_method == method
        and (
            _practice_pending_request_id.is_empty()
            or _practice_pending_request_id == request_id
        )
    )

func _clear_practice_request() -> void:
    _practice_pending_method = ""
    _practice_pending_request_id = ""
    _practice_pending_context = ""
    _practice_pending_operation.clear()

func _abandon_practice_request() -> void:
    _clear_practice_request()
    _practice_retry_operation.clear()
    _queued_practice_pitch.clear()
    _pending_creator_document.clear()
    start_button.disabled = false

func _on_practice_request_succeeded(request_id: String, method: String, payload: Variant) -> void:
    if not _practice_request_matches(request_id, method):
        return
    var context := _practice_pending_context
    _practice_retry_operation.clear()
    _clear_practice_request()
    if method == "resume" and payload == null:
        _practice_ready = true
        start_button.disabled = false
        if context == "startup":
            _startup_state = "complete"
            status.text = "Choose your pair name, then enter the market."
        elif context == "creator-refresh":
            status.text = _saved_campaign_status()
        return
    if typeof(payload) != TYPE_DICTIONARY:
        _practice_failure(context)
        return
    var recovery: Dictionary = payload
    if context == "creator-refresh" and not _pending_creator_document.is_empty():
        var refreshed_document: Dictionary = recovery.get("document", {})
        if (
            refreshed_document.get("documentId") != _pending_creator_document.get("documentId")
            or int(refreshed_document.get("revision", -1)) != int(_pending_creator_document.get("revision", -2))
        ):
            _practice_failure(context)
            return
    if context == "progress":
        if not _apply_practice_progress_ack(recovery):
            _practice_failure(context)
            return
        _practice_ready = true
        _queued_practice_pitch.clear()
        _render_level()
        status.text = "Advertisement progress saved on this computer."
        return
    if not _apply_practice_recovery(recovery):
        _practice_failure(context)
        return
    _practice_ready = true
    start_button.disabled = false
    match context:
        "startup":
            lobby_panel.hide()
            run_panel.show()
            market_screen.hide()
            _render_level()
            status.text = "Saved pitch restored. Continue from where your pair stopped."
        "begin":
            lobby_panel.hide()
            run_panel.show()
            market_screen.hide()
            _begin_agency()
            _render_level()
            status.text = "Open the studio. Build one product with your pair."
            _focus_if_ready(launch_button)
        "lock":
            _render_level()
            status.text = _locked_level_status()
            _focus_if_ready(advance_level)
        "advance":
            _render_level()
            status.text = (
                "Final check unlocked. Complete the five-part final review."
                if _game_run.phase == "publish-check"
                else "Next level unlocked. Open the studio when your pair is ready."
            )
        "creator-refresh":
            _render_level()
            var readiness_clue := _level_completion_clue()
            if readiness_clue.is_empty():
                status.text = _saved_campaign_status()
            else:
                status.text = readiness_clue
                _focus_if_ready(lock_level)

func _on_practice_request_failed(request_id: String, method_or_code: String, code_or_message: String, maybe_message: String = "") -> void:
    var method := _practice_pending_method
    var code := method_or_code
    var message := code_or_message
    if not maybe_message.is_empty():
        method = method_or_code
        code = code_or_message
        message = maybe_message
    if not _practice_request_matches(request_id, method):
        return
    var context := _practice_pending_context
    var failed_operation := _practice_pending_operation.duplicate(true)
    _clear_practice_request()
    if code in [
        "TRANSPORT_ERROR",
        "INVALID_RESPONSE",
        "UNSUPPORTED_CONTRACT",
        "REQUEST_ID_MISMATCH",
        "INVALID_RECOVERY_RESPONSE"
    ] and not failed_operation.is_empty():
        _practice_retry_operation = failed_operation
    else:
        _practice_retry_operation.clear()
    _practice_failure(context)
    if code == "PRACTICE_UNAVAILABLE":
        status.text = "Saved practice is not available here. Live rooms are still ready."
    elif not message.is_empty() and context != "startup":
        status.text = "Save failed. No state change. Retry."

func _practice_failure(context: String) -> void:
    _pending_creator_document.clear()
    start_button.disabled = false
    if context == "startup":
        _startup_state = "complete"
        _practice_ready = true
        lobby_panel.show()
        run_panel.hide()
        status.text = "Saved progress could not be verified. Data unchanged. Start fresh, or join live."
    elif context == "begin":
        start_button.disabled = false
        status.text = "Practice could not start safely. Retry."
    elif context == "progress":
        _suspend_agency_progress_persistence = true
        _render_level()
        _suspend_agency_progress_persistence = false
        status.text = "Advertisement progress could not be saved. Your current screen is unchanged."
    else:
        _render_level()
        status.text = "Save failed. No state change. Retry."

func _apply_practice_progress_ack(recovery: Dictionary) -> bool:
    var checkpoint_value: Variant = recovery.get("checkpoint")
    var document_value: Variant = recovery.get("document")
    if typeof(checkpoint_value) != TYPE_DICTIONARY or typeof(document_value) != TYPE_DICTIONARY:
        return false
    var checkpoint: Dictionary = checkpoint_value
    var document: Dictionary = document_value
    if typeof(checkpoint.get("pitch")) != TYPE_DICTIONARY:
        return false
    var run := _game_run as AdMarketGameRun
    var progress := run.agency_progress() as AdMarketAgencyProgress if run != null else null
    if progress == null:
        return false
    var current_pitch := progress.snapshot()
    if (
        not _agency_pitches_match(current_pitch, checkpoint.get("pitch"))
        and (
            _queued_practice_pitch.is_empty()
            or not _agency_pitches_match(current_pitch, _queued_practice_pitch)
        )
    ):
        return false
    if (
        _campaign_document.get("documentId") != document.get("documentId")
        or _campaign_document.get("sessionId") != document.get("sessionId")
        or _campaign_document.get("teamId") != document.get("teamId")
    ):
        return false
    var merged_document := _campaign_document.duplicate(true)
    merged_document["revision"] = document.get("revision")
    merged_document["updatedAt"] = document.get("updatedAt")
    _campaign_document = merged_document
    _practice_recovery = recovery.duplicate(true)
    _level_locked = bool(checkpoint.get("levelLocked", false))
    _pending_creator_document.clear()
    _room_role = ""
    _room_code = ""
    _room_campaign_submitted = false
    _live_publication_pending = false
    return true

func _apply_practice_recovery(recovery: Dictionary) -> bool:
    var checkpoint_value: Variant = recovery.get("checkpoint")
    var document_value: Variant = recovery.get("document")
    if typeof(checkpoint_value) != TYPE_DICTIONARY or typeof(document_value) != TYPE_DICTIONARY:
        return false
    var checkpoint: Dictionary = checkpoint_value
    var document: Dictionary = document_value
    var phase := String(checkpoint.get("stage", ""))
    var locked := bool(checkpoint.get("levelLocked", false))
    if locked and not _readiness_clue_for(phase, document).is_empty():
        return false
    var levels := ["invent", "sell", "irresistible"]
    var ready_levels: Array[String] = []
    if phase == "publish-check":
        ready_levels.assign(levels)
    else:
        var active_index := levels.find(phase)
        if active_index < 0:
            return false
        for index in active_index:
            ready_levels.append(levels[index])
        if locked:
            ready_levels.append(phase)
    var pitch_snapshot := {
        "contract": "pitch-run@1",
        "phase": phase,
        "teamAlias": String(checkpoint.get("teamAlias", "")),
        "sessionId": String(checkpoint.get("sessionId", "")),
        "teamId": String(checkpoint.get("teamId", "")),
        "readyLevels": ready_levels
    }
    if checkpoint.has("pitch"):
        if typeof(checkpoint.get("pitch")) != TYPE_DICTIONARY:
            return false
        pitch_snapshot["contract"] = "pitch-run@2"
        pitch_snapshot["agency"] = Dictionary(checkpoint.get("pitch")).duplicate(true)
    var next_run: RefCounted = GameRun.new()
    if not next_run.restore_pitch_snapshot(pitch_snapshot):
        return false
    _game_run = next_run
    _campaign_document = document.duplicate(true)
    _practice_recovery = recovery.duplicate(true)
    _level_locked = locked
    _pending_creator_document.clear()
    _room_role = ""
    _room_code = ""
    _room_campaign_submitted = false
    _live_publication_pending = false
    return true

func _practice_token() -> Dictionary:
    var checkpoint: Dictionary = _practice_recovery.get("checkpoint", {})
    if checkpoint.is_empty():
        return {}
    return {
        "runId": checkpoint.get("runId"),
        "documentId": checkpoint.get("documentId"),
        "documentRevision": checkpoint.get("documentRevision"),
        "sequence": checkpoint.get("sequence"),
        "stage": checkpoint.get("stage")
    }

func _new_practice_operation_id(kind: String) -> String:
    _practice_operation_counter += 1
    return "%s-%d-%d" % [
        kind,
        int(Time.get_unix_time_from_system() * 1000000.0),
        _practice_operation_counter
    ]

func _practice_operation_id(kind: String, input: Dictionary) -> String:
    var operation_id := ""
    if (
        _practice_retry_operation.get("kind") == kind
        and _practice_retry_operation.get("input") == input
    ):
        operation_id = String(_practice_retry_operation.get("operationId", ""))
    if operation_id.is_empty():
        _practice_retry_operation.clear()
        operation_id = _new_practice_operation_id(kind)
    _practice_pending_operation = {
        "kind": kind,
        "input": input.duplicate(true),
        "operationId": operation_id
    }
    return operation_id

func _choose_new_route() -> void:
    _startup_state = "manual"
    market_host.call("invalidate_room_intent")

func _start_run() -> void:
    if _startup_state in ["live-resume", "practice-resume", "live-error"]:
        _abandon_practice_request()
        _practice_ready = true
        _choose_new_route()
    if not _practice_ready or not _practice_pending_method.is_empty():
        status.text = "Saved progress verification in progress."
        return
    var alias := team_alias.text.strip_edges()
    if alias.length() < 2 or alias.length() > 32 or alias != team_alias.text:
        status.text = "Pair alias must be 2 to 32 characters, no leading or trailing spaces."
        _focus_if_ready(team_alias)
        return
    _choose_new_route()
    _room_role = ""
    _room_code = ""
    _room_campaign_submitted = false
    _live_publication_pending = false
    market_screen.call("stop_room")
    market_screen.call("set_market_host", market_host)
    _practice_recovery.clear()
    start_button.disabled = true
    status.text = "Preparing a place for the pitch."
    _begin_practice_request("begin", "begin")
    var operation_id := _practice_operation_id("begin", {"teamAlias": alias})
    var request_id: String = _practice_bridge.begin(alias, operation_id)
    _remember_practice_request_id("begin", request_id)

func _join_live_room() -> void:
    _abandon_practice_request()
    market_screen.call("set_market_host", market_host)
    var alias := team_alias.text.strip_edges()
    var code := room_code.text.strip_edges().to_upper()
    if alias.length() < 2:
        status.text = "Pair alias must be at least 2 characters."
        _focus_if_ready(team_alias)
        return
    _choose_new_route()
    status.text = "Joining live market."
    market_host.join_room(code, alias)

func _create_live_room() -> void:
    _abandon_practice_request()
    market_screen.call("set_market_host", market_host)
    var code := classroom_code.text.strip_edges()
    if code.is_empty():
        status.text = "Enter the classroom code before opening the market."
        _focus_if_ready(classroom_code)
        return
    _choose_new_route()
    status.text = "Opening class market."
    market_host.create_room(MARKET_COMPATIBILITY_WALLET_CENTS, code, int(max_teams.value))

func _begin_resumed_team(wrapper: Dictionary) -> void:
    var context := _team_room_context(wrapper)
    if context.is_empty():
        _fail_live_hydration()
        return
    var snapshot: Dictionary = context.get("snapshot")
    var room_id := String(context.get("roomId"))
    var team_id := String(context.get("teamId"))
    var alias := String(context.get("alias"))
    var session_id := "room-session-%s" % team_id
    var canonical_document := _room_campaign_document(room_id, team_id, session_id)
    var next_run: RefCounted = GameRun.new()
    if not next_run.begin(alias, session_id, team_id):
        _fail_live_hydration()
        return

    _startup_progress_matched = false
    _startup_expected_document_revision = -1
    var stored: Variant = _run_progress_store.load() if _run_progress_store != null else {}
    var restored := _validated_live_progress(stored, {
        "roomCode": String(wrapper.get("roomCode")),
        "roomId": room_id,
        "teamId": team_id,
        "sessionId": session_id,
        "documentId": String(canonical_document.get("documentId"))
    })
    if not restored.is_empty():
        next_run = restored.get("run")
        var progress: Dictionary = restored.get("value")
        _level_locked = bool(progress.get("levelLocked"))
        _last_saved_live_progress = progress.duplicate(true)
        _startup_progress_matched = true
        _startup_expected_document_revision = int(progress.get("documentRevision"))
    else:
        _level_locked = false

    _game_run = next_run
    _room_role = "team"
    _room_code = String(wrapper.get("roomCode"))
    _latest_market_snapshot = snapshot.duplicate(true)
    _room_campaign_submitted = _team_has_campaign(snapshot, team_id)
    _live_publication_pending = false
    _practice_recovery.clear()
    _campaign_document = canonical_document
    market_screen.call("enter_room", "team", _room_code)
    market_screen.call("present_snapshot", snapshot)
    lobby_panel.show()
    run_panel.hide()
    market_screen.hide()
    launch_button.disabled = true
    _startup_state = "team-hydrating"
    status.text = "Restoring this pair's live advertisement."
    if creator_host.load_latest(String(canonical_document.get("documentId"))).is_empty():
        _fail_live_hydration()

func _finish_resumed_team(document: Dictionary) -> void:
    if _startup_state != "team-hydrating":
        return
    _campaign_document = document.duplicate(true)
    _startup_state = "complete"
    launch_button.disabled = false
    lobby_panel.hide()
    var server_phase := String(_latest_market_snapshot.get("phase", "building"))
    _apply_market_completion(_latest_market_snapshot)
    if _room_campaign_submitted or server_phase in ["market", "reveal", "closed"]:
        enter_market.hide()
        run_panel.hide()
        market_screen.show()
        status.text = "Live room restored. Continue from the host display."
        market_screen.call("focus_initial_control")
        return
    market_screen.hide()
    run_panel.show()
    _render_level()
    status.text = "Live pitch restored. Continue from where your pair stopped."
    _focus_if_ready(launch_button)

func _fail_live_hydration() -> void:
    if _startup_state == "manual":
        return
    _startup_state = "live-error"
    launch_button.disabled = true
    start_button.disabled = false
    lobby_panel.show()
    run_panel.hide()
    market_screen.hide()
    status.text = "Live room restored. The saved advertisement could not be verified. Progress is unchanged."

func _team_room_context(wrapper: Dictionary) -> Dictionary:
    var snapshot_value: Variant = wrapper.get("snapshot")
    if typeof(snapshot_value) != TYPE_DICTIONARY:
        return {}
    var snapshot: Dictionary = snapshot_value
    var derived: Dictionary = MarketViewState.new().derive(snapshot)
    if derived.get("ok") != true or derived.get("role") != "team":
        return {}
    var state: Dictionary = derived.get("state")
    var own_value: Variant = state.get("own")
    if typeof(own_value) != TYPE_DICTIONARY:
        return {}
    var own: Dictionary = own_value
    return {
        "snapshot": snapshot,
        "roomId": String(state.get("roomId")),
        "teamId": String(own.get("teamId")),
        "alias": String(own.get("alias"))
    }

func _on_room_joined(wrapper: Dictionary) -> void:
    var context := _team_room_context(wrapper)
    if context.is_empty():
        _show_market_diagnostic("")
        return
    var snapshot: Dictionary = context.get("snapshot")
    var room_id := String(context.get("roomId"))
    var team_id := String(context.get("teamId"))
    var alias := String(context.get("alias"))
    var session_id := "room-session-%s" % team_id
    _game_run = GameRun.new()
    if not _game_run.begin(alias, session_id, team_id):
        status.text = "Pair could not enter pitch levels safely."
        return
    _room_role = "team"
    _practice_recovery.clear()
    _level_locked = false
    _room_code = str(wrapper.get("roomCode"))
    _room_campaign_submitted = false
    _live_publication_pending = false
    _latest_market_snapshot = snapshot.duplicate(true)
    _campaign_document = _room_campaign_document(room_id, team_id, session_id)
    launch_button.disabled = false
    market_screen.call("enter_room", "team", _room_code)
    market_screen.call("present_snapshot", snapshot)
    enter_market.hide()
    market_screen.hide()
    lobby_panel.hide()
    run_panel.show()
    status.text = "Room joined. Open the studio and build one product."
    _begin_agency()
    _render_level()
    _save_live_progress()
    _focus_if_ready(launch_button)

func _on_room_join_failed(code: String, _message: String) -> void:
    status.text = _student_market_error(
        "INVALID_ROOM_CODE" if code == "INVALID_REQUEST" else code
    )
    _focus_if_ready(room_code)

func _on_room_created(wrapper: Dictionary) -> void:
    var snapshot_value: Variant = wrapper.get("snapshot")
    if typeof(snapshot_value) != TYPE_DICTIONARY:
        _show_market_diagnostic("")
        return
    _room_role = "teacher"
    _room_code = str(wrapper.get("roomCode"))
    _latest_market_snapshot = Dictionary(snapshot_value).duplicate(true)
    lobby_panel.hide()
    run_panel.hide()
    enter_market.hide()
    market_screen.call("enter_room", "teacher", _room_code)
    market_screen.call("present_snapshot", _latest_market_snapshot)
    market_screen.show()
    status.text = "The class market is open. Share the room code shown on the host display with the teams."

func _on_market_snapshot(snapshot: Dictionary) -> void:
    if _room_role.is_empty():
        return
    _latest_market_snapshot = snapshot.duplicate(true)
    market_screen.call("present_snapshot", snapshot)
    if _room_role == "teacher":
        lobby_panel.hide()
        run_panel.hide()
        enter_market.hide()
        market_screen.show()
        return
    var server_phase := str(snapshot.get("phase"))
    var entry_gate_visible := enter_market.visible
    var prior_phase := String(_game_run.phase)
    _apply_market_completion(snapshot)
    if _pitch_waiting_for_market:
        market_screen.hide()
        return
    if prior_phase != _game_run.phase and not entry_gate_visible:
        _render_level()
    if _room_campaign_submitted or server_phase in ["market", "reveal", "closed"]:
        lobby_panel.hide()
        if entry_gate_visible:
            run_panel.show()
            market_screen.hide()
            return
        run_panel.hide()
        market_screen.show()

func _apply_market_completion(snapshot: Dictionary) -> bool:
    if _game_run.phase != "publish-check":
        return _game_run.phase in ["market", "reveal"]
    if String(snapshot.get("phase", "")) not in ["market", "reveal", "closed"]:
        return false
    if String(snapshot.get("marketMode", "purchases")) == "medals":
        _game_run.open_medal_market()
    else:
        var own_value: Variant = snapshot.get("own")
        if typeof(own_value) != TYPE_DICTIONARY:
            return false
        var own: Dictionary = own_value
        var opening_wallet := int(own.get("wallet", 0)) + int(own.get("spent", 0))
        if not _game_run.open_market(opening_wallet):
            return false
    return _game_run.phase in ["market", "reveal"]

func _on_market_campaign_published(_result: Dictionary) -> void:
    if _room_role != "team":
        return
    _live_publication_pending = false
    _room_campaign_submitted = true
    _pitch_market_ready = true
    publish_campaign.disabled = false
    creator_host.close_creator()
    market_screen.call("show_publication_waiting")
    if _pitch_waiting_for_market:
        market_screen.hide()
    status.text = "Advertisement delivered. Finish the client pitch when your pair is ready."
    _complete_pitch_when_ready()

func _reopen_returned_campaign() -> void:
    if _room_role != "team" or _live_publication_pending:
        return
    _reset_pitch_state()
    if _startup_state == "team-hydrating":
        status.text = "Restoring this pair's saved live advertisement. The studio will reopen when the restore is complete."
        return
    enter_market.hide()
    market_screen.hide()
    run_panel.show()
    _render_level()
    status.text = "Reopening the studio. The host note is loaded with the advertisement."
    _set_campaign_stage_for_phase()
    if creator_host.open_creator(_campaign_document).is_empty():
        status.text = "The saved advertisement could not be reopened. Try again."
        market_screen.show()

func _show_market_diagnostic(_message: String) -> void:
    if _live_publication_pending:
        _cancel_pitch_after_market_failure(_student_market_error("CONNECTION_UNAVAILABLE"))
        return
    status.text = _student_market_error("CONNECTION_UNAVAILABLE")

func _on_market_request_failed(code: String, _message: String) -> void:
    if _live_publication_pending:
        _cancel_pitch_after_market_failure(_student_market_error(code))
        return
    status.text = _student_market_error(code)

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

func _open_creator() -> void:
    if not LEVEL_COPY.has(_game_run.phase):
        status.text = "The creative studio opens during the three pitch levels."
        return
    status.text = "Opening the creative studio."
    _set_campaign_stage_for_phase()
    creator_host.open_creator(_campaign_document)

func _on_creator_opened() -> void:
    if agency_world != null:
        agency_world.set_input_enabled(false)
    if _publish_after_open:
        status.text = "Building the market card."
        if creator_host.publish_creator().is_empty():
            _publish_after_open = false
            publish_campaign.disabled = false
            status.text = "The market card could not be built. Try again."
        return
    status.text = "Advertisement editor open. Game input paused."

func _on_creator_closed() -> void:
    if agency_world != null and agency_world.visible:
        agency_world.set_input_enabled(true)
    if enter_market.visible:
        status.text = "Market card built. Select Enter market to continue."
        _focus_if_ready(enter_market)
        return
    if _room_role == "team" and _game_run.phase == "publish-check":
        status.text = "Studio saved. Complete the final review before building the refreshed market card."
        _focus_if_ready(_final_review_focus_target())
        return
    if _game_run.phase in ["market", "reveal"]:
        status.text = (
            "The market podium is ready for the reveal."
            if _game_run.phase == "reveal"
            else (
                "Practice market ready."
                if _room_role.is_empty()
                else "Market card live. Browse the gallery and award Gold, Silver and Bronze."
            )
        )
        return
    if _room_role == "team" and _room_campaign_submitted:
        status.text = "Market card delivered. Continue in the live market."
        return
    status.text = "Studio saved. Lock this level when your pair is ready."
    _focus_if_ready(lock_level)

func _on_creator_state_received(document: Dictionary) -> void:
    if _room_role.is_empty() and not _practice_recovery.is_empty():
        _pending_creator_document = document.duplicate(true)
        if _practice_pending_method.is_empty():
            status.text = "Checking the saved advertisement."
            _issue_practice_resume("creator-refresh")
        return
    if _room_role == "team":
        if not _live_document_identity_matches(document):
            status.text = "An advertisement for another live pair was ignored. Your saved progress was kept untouched."
            return
        if int(document.get("revision", -1)) < int(_campaign_document.get("revision", 0)):
            status.text = "An older advertisement save was ignored. Your latest live progress is still safe."
            return
    _campaign_document = document.duplicate(true)
    if _agency_campaign != null:
        _suspend_agency_progress_persistence = true
        _agency_campaign.on_creator_returned(_campaign_document)
        _suspend_agency_progress_persistence = false
        _campaign_document = _agency_campaign.document()
    if _level_locked:
        var readiness_clue := _level_completion_clue()
        if not readiness_clue.is_empty():
            _level_locked = false
            _game_run.invalidate_current_level()
            _save_live_progress()
            _render_level()
            status.text = readiness_clue
            _focus_if_ready(launch_button)
            return
    if _room_role == "team":
        _save_live_progress()
    _render_level()
    status.text = _saved_campaign_status()

func _lock_current_level() -> void:
    var readiness_clue := _level_completion_clue()
    if not readiness_clue.is_empty():
        status.text = readiness_clue
        _render_level()
        _focus_if_ready(launch_button)
        return
    if _room_role.is_empty():
        if not _practice_pending_method.is_empty() or _practice_recovery.is_empty():
            status.text = "Saved progress is still catching up. Try Lock again in a moment."
            return
        var token := _practice_token()
        if token.is_empty():
            status.text = "The saved pitch marker is missing. Return to the studio and try again."
            return
        lock_level.disabled = true
        status.text = "Saving this level lock."
        _begin_practice_request("setLock", "lock")
        var operation_id := _practice_operation_id("lock", {
            "checkpoint": token.duplicate(true),
            "levelLocked": true
        })
        var request_id: String = _practice_bridge.set_level_lock(
            token,
            true,
            operation_id
        )
        _remember_practice_request_id("setLock", request_id)
        return
    if not _game_run.mark_current_level_ready():
        status.text = _game_run.last_error
        return
    _level_locked = true
    lock_level.disabled = true
    advance_level.disabled = false
    status.text = _locked_level_status()
    _save_live_progress()
    _focus_if_ready(advance_level)

func _advance_level() -> void:
    if not _level_locked:
        status.text = "Lock this level before moving on."
        _focus_if_ready(lock_level)
        return
    var readiness_clue := _level_completion_clue()
    if not readiness_clue.is_empty():
        _level_locked = false
        _game_run.invalidate_current_level()
        _render_level()
        status.text = readiness_clue
        _focus_if_ready(launch_button)
        return
    if _room_role.is_empty():
        if not _practice_pending_method.is_empty() or _practice_recovery.is_empty():
            status.text = "Saved progress is still catching up. Try %s again in a moment." % _advance_label()
            return
        var next_by_stage := {
            "invent": "sell",
            "sell": "irresistible",
            "irresistible": "publish-check"
        }
        var next_stage := String(next_by_stage.get(_game_run.phase, ""))
        if next_stage.is_empty():
            status.text = "There is no next pitch level."
            return
        advance_level.disabled = true
        status.text = "Saving the %s reveal." % _advance_label().to_lower()
        _begin_practice_request("advance", "advance")
        var operation_id := _practice_operation_id("advance", {
            "checkpoint": _practice_token().duplicate(true),
            "nextStage": next_stage
        })
        var request_id: String = _practice_bridge.advance(
            _practice_token(),
            next_stage,
            operation_id
        )
        _remember_practice_request_id("advance", request_id)
        return
    if not _game_run.advance_level():
        status.text = _game_run.last_error
        return
    _level_locked = false
    _render_level()
    _save_live_progress()

func _publish_campaign() -> void:
    if (
        _game_run.phase != "publish-check"
        or _publish_after_open
        or publish_campaign.disabled
        or not _final_review_complete()
    ):
        return
    _publish_after_open = true
    publish_campaign.disabled = true
    _set_campaign_stage_for_phase()
    if creator_host.creator_is_open:
        _on_creator_opened()
        return
    status.text = "Reopening your saved advertisement for the final market card."
    if creator_host.open_creator(_campaign_document).is_empty():
        _publish_after_open = false
        publish_campaign.disabled = false
        status.text = "The saved advertisement could not be reopened. Try again."

func _on_creator_published(publication: Dictionary) -> void:
    _publish_after_open = false
    var run: AdMarketGameRun = _game_run as AdMarketGameRun
    var progress: AdMarketAgencyProgress = (
        run.agency_progress() as AdMarketAgencyProgress
        if run != null
        else null
    )
    if not pitch_theatre.present(publication, progress, agency_world.reduced_motion_enabled):
        publish_campaign.disabled = false
        status.text = "The finished advertisement image could not be prepared. Return to the studio and publish it again."
        return
    _published_campaign = publication.duplicate(true)
    if _agency_campaign != null:
        _agency_campaign.on_publication(publication)
    _pitch_finished = false
    _pitch_market_ready = false
    _pitch_waiting_for_market = true
    _prepare_pitch_surface()
    creator_host.close_creator()
    if _room_role == "team":
        _live_publication_pending = true
        status.text = "Sending the finished advertisement to the host while your pair presents it to the client."
        if market_host.publish_campaign(publication).is_empty():
            _cancel_pitch_after_market_failure(
                "The market card could not be sent. Check the room connection, then try again."
            )
        return
    if (
        _game_run.phase == "publish-check"
        and not _game_run.open_medal_market()
    ):
        _cancel_pitch_after_market_failure(_game_run.last_error)
        return
    if _game_run.phase not in ["market", "reveal"]:
        _cancel_pitch_after_market_failure(
            "The practice market could not open safely. Try building the card again."
        )
        return
    if _local_market_session == null:
        _local_market_session = LocalMarketSession.new()
        add_child(_local_market_session)
    var initial_snapshot: Dictionary = _local_market_session.call(
        "configure",
        _game_run,
        publication,
        _game_run.team_alias
    )
    if initial_snapshot.is_empty():
        _cancel_pitch_after_market_failure(
            "The practice market could not load its stalls. Try building the card again."
        )
        return
    market_screen.call("set_market_host", _local_market_session)
    market_screen.call("enter_room", "team", "PRACTICE")
    market_screen.call("present_snapshot", initial_snapshot)
    market_screen.hide()
    _pitch_market_ready = true
    status.text = "The practice market is ready. Finish the client pitch when your pair is satisfied."
    _complete_pitch_when_ready()

func _prepare_pitch_surface() -> void:
    agency_audio.confirm_user_gesture()
    agency_audio.play_music("pitch")
    _hide_agency()
    lobby_panel.hide()
    run_panel.hide()
    market_screen.hide()
    enter_market.hide()
    var finish_button := pitch_theatre.get_node_or_null("%EnterMarket") as Button
    if finish_button != null:
        finish_button.disabled = false
        finish_button.text = "Finish client pitch"

func _on_pitch_finished() -> void:
    _pitch_finished = true
    if not _pitch_market_ready:
        var finish_button := pitch_theatre.get_node_or_null("%EnterMarket") as Button
        if finish_button != null:
            finish_button.disabled = true
            finish_button.text = "Delivering advertisement..."
        status.text = "The pitch is complete. Waiting for the advertisement to reach the host."
    _complete_pitch_when_ready()

func _on_pitch_setting_changed(_setting_id: String) -> void:
    _on_agency_progress_changed()

func _on_pitch_sound_requested(cue_id: String) -> void:
    agency_audio.play_sfx(cue_id)

func _complete_pitch_when_ready() -> void:
    if not _pitch_waiting_for_market or not _pitch_finished or not _pitch_market_ready:
        return
    _pitch_waiting_for_market = false
    pitch_theatre.hide()
    agency_audio.stop_all()
    var finish_button := pitch_theatre.get_node_or_null("%EnterMarket") as Button
    if finish_button != null:
        finish_button.disabled = false
        finish_button.text = "Finish client pitch"
    _show_market_entry_gate()

func _cancel_pitch_after_market_failure(message: String) -> void:
    _live_publication_pending = false
    publish_campaign.disabled = false
    _reset_pitch_state()
    run_panel.show()
    _render_level()
    status.text = message
    _set_campaign_stage_for_phase()
    if creator_host.open_creator(_campaign_document).is_empty():
        status.text = "%s The saved advertisement could not be reopened; select Build market card to try again." % message

func _reset_pitch_state() -> void:
    _pitch_finished = false
    _pitch_market_ready = false
    _pitch_waiting_for_market = false
    pitch_theatre.hide()
    var finish_button := pitch_theatre.get_node_or_null("%EnterMarket") as Button
    if finish_button != null:
        finish_button.disabled = false
        finish_button.text = "Finish client pitch"

func _render_level() -> void:
    var phase: String = _game_run.phase
    if phase in ["invent", "sell", "irresistible", "publish-check"]:
        _show_agency()
    else:
        _hide_agency()
    enter_market.hide()
    level_progress.visible = phase != "publish-check"
    var level_order := ["invent", "sell", "irresistible"]
    var active_index := level_order.find(phase)
    var chips: Array[Label] = [invent_chip, sell_chip, irresistible_chip]
    for index in chips.size():
        var chip := chips[index]
        chip.add_theme_color_override(
            "font_color",
            Color("#17212b") if index == active_index else Color("#68727d")
        )
        chip.modulate.a = 1.0 if index <= active_index or active_index < 0 else 0.55

    if phase != "publish-check":
        final_review.hide()
        _reset_final_review()

    if phase == "publish-check":
        level_eyebrow.text = "MARKET GATE"
        level_heading.text = "Complete the final review."
        level_clue.text = "Check the five statements against the completed advertisement. Then build the market card."
        launch_button.hide()
        lock_level.hide()
        advance_level.hide()
        final_review.show()
        publish_campaign.show()
        _update_final_review()
        _focus_if_ready(_final_review_focus_target())
        status.text = "Three levels complete. Confirm each final-review statement."
        return

    if phase == "market":
        level_eyebrow.text = "LIVE MARKET"
        level_heading.text = "Your ad is live. Award the medals."
        level_clue.text = "Score every other ad, then award one Gold, one Silver and one Bronze to three different ads."
        launch_button.hide()
        lock_level.hide()
        advance_level.hide()
        publish_campaign.hide()
        status.text = "Market card built. Loading the other ads."
        return

    var copy: Dictionary = LEVEL_COPY.get(phase, {})
    level_eyebrow.text = str(copy.get("eyebrow", "PITCH LEVEL"))
    level_heading.text = str(copy.get("heading", "Make the next move."))
    var readiness_clue := _level_completion_clue()
    var ready_to_lock := readiness_clue.is_empty()
    if not readiness_clue.is_empty():
        level_clue.text = readiness_clue
    elif _level_locked:
        level_clue.text = (
            "Level 3 is locked. Choose Final check."
            if phase == "irresistible"
            else "This level is locked. Choose Next level."
        )
    else:
        level_clue.text = (
            "Level 3 is ready. Lock it to open the final check."
            if phase == "irresistible"
            else "This level is ready. Lock it to reveal the next level."
        )
    advance_level.text = _advance_label()
    launch_button.visible = not _level_locked
    lock_level.visible = not _level_locked and ready_to_lock
    advance_level.visible = _level_locked
    publish_campaign.hide()
    lock_level.disabled = _level_locked
    advance_level.disabled = not _level_locked

func _show_market_entry_gate() -> void:
    _hide_agency()
    lobby_panel.hide()
    market_screen.hide()
    run_panel.show()
    level_progress.hide()
    final_review.hide()
    launch_button.hide()
    lock_level.hide()
    advance_level.hide()
    publish_campaign.hide()
    enter_market.disabled = false
    enter_market.show()
    level_eyebrow.text = "LIVE MARKET"
    level_heading.text = "Your market card is ready."
    level_clue.text = "Select Enter market to continue to the gallery."
    status.text = "Market card built. Select Enter market to continue."
    _focus_if_ready(enter_market)

func _enter_market() -> void:
    if (
        not enter_market.visible
        or (
            _room_role == "team"
            and not _room_campaign_submitted
            and _game_run.phase not in ["market", "reveal"]
        )
        or (
            _room_role.is_empty()
            and _game_run.phase not in ["market", "reveal"]
        )
    ):
        return
    enter_market.hide()
    _hide_agency()
    run_panel.hide()
    market_screen.show()
    market_screen.call("focus_initial_control")
    status.text = (
        "Practice market ready. Score each advertisement, then award the three medals."
        if _room_role.is_empty()
        else (
            "Market card delivered. Wait for the host to open the gallery."
            if String(_latest_market_snapshot.get("phase", "building")) == "building"
            else "Market gallery ready. Score each advertisement, then award the three medals."
        )
    )

func _show_instructions() -> void:
    _dialog_focus_target = get_viewport().gui_get_focus_owner()
    instructions_dialog.popup_centered(Vector2i(920, 640))
    _focus_if_ready(instructions_text)

func _show_role_guide() -> void:
    _dialog_focus_target = get_viewport().gui_get_focus_owner()
    role_guide_dialog.popup_centered(Vector2i(720, 420))
    _focus_if_ready(role_guide_text)

func _restore_dialog_focus() -> void:
    var target := _dialog_focus_target
    _dialog_focus_target = null
    if target != null and is_instance_valid(target):
        _focus_if_ready(target)

func _final_review_checks() -> Array[CheckBox]:
    return [
        review_audience,
        review_value,
        review_aida,
        review_visual,
        review_claim
    ]

func _on_final_review_changed(_pressed: bool) -> void:
    _update_final_review()

func _final_review_complete() -> bool:
    for review_check in _final_review_checks():
        if not review_check.button_pressed:
            return false
    return true

func _update_final_review() -> void:
    if not final_review.visible:
        return
    var complete := _final_review_complete()
    publish_campaign.disabled = not complete
    review_claim.focus_next = (
        review_claim.get_path_to(publish_campaign)
        if complete
        else NodePath()
    )
    final_review_status.text = (
        "Final review complete. Build the market card."
        if complete
        else "Select all five review statements."
    )

func _reset_final_review() -> void:
    for review_check in _final_review_checks():
        review_check.set_pressed_no_signal(false)
    final_review_status.text = "Select all five review statements."

func _final_review_focus_target() -> Control:
    for review_check in _final_review_checks():
        if not review_check.button_pressed:
            return review_check
    return publish_campaign

func _advance_label() -> String:
    return "Final check" if _game_run.phase == "irresistible" else "Next level"

func _locked_level_status() -> String:
    return (
        "Level 3 locked. Ready for the final check."
        if _game_run.phase == "irresistible"
        else "Level locked. Ready for the next reveal."
    )

func _saved_campaign_status() -> String:
    return (
        "Advertisement saved. Lock Level 3 to open the final check."
        if _game_run.phase == "irresistible"
        else "Advertisement saved for the next level."
    )

func _show_diagnostic(message: String) -> void:
    if _startup_state == "team-hydrating":
        _fail_live_hydration()
        return
    if _publish_after_open:
        _publish_after_open = false
        publish_campaign.disabled = false
    status.text = message

func _focus_if_ready(control: Control) -> void:
    if control.is_inside_tree():
        control.grab_focus()

func _focused_control_label() -> String:
    var viewport := get_viewport()
    if viewport == null:
        return ""
    var focused := viewport.gui_get_focus_owner()
    if focused == null:
        return ""
    var label := String(focused.get_meta("accessibilityLabel", "")).strip_edges()
    if label.is_empty() and focused is OptionButton:
        var option := focused as OptionButton
        if option.selected >= 0:
            label = option.get_item_text(option.selected).strip_edges()
    elif label.is_empty() and focused is BaseButton:
        label = String((focused as BaseButton).text).strip_edges()
    elif label.is_empty() and focused is LineEdit:
        label = String((focused as LineEdit).placeholder_text).strip_edges()
    if label.is_empty():
        label = String(focused.name).capitalize()
    return label

func _readiness_clue() -> String:
    return _readiness_clue_for(_game_run.phase, _campaign_document)

func _level_completion_clue() -> String:
    var document_clue := _readiness_clue()
    if not document_clue.is_empty():
        return document_clue
    if (
        _agency_campaign != null
        and _game_run.phase in ["invent", "sell", "irresistible"]
        and not _agency_campaign.missions_complete_for_level(_game_run.phase)
    ):
        return "Next: complete this level's required agency tasks. Follow the next task in the agency guide."
    return ""

func _readiness_clue_for(phase: String, document: Dictionary) -> String:
    if phase == "invent":
        var product := _dictionary_child(document, "product")
        var brief := _dictionary_child(document, "brief")
        if product.get("build", null) == null:
            return "Next: build a product in the studio."
        if not _is_nonblank_string(product.get("name")):
            return "Next: add a product name."
        if not _is_nonblank_string(brief.get("targetAudienceId")):
            return "Next: choose an audience brief."
        var gameplay := _dictionary_child(document, "gameplay")
        var pair := _dictionary_child(gameplay, "pair")
        if int(pair.get("handoffCount", 0)) < 1:
            return "Next: swap roles once."
        if int(pair.get("artDirectorActions", 0)) < 1:
            return "Next: the Art Director makes one visible image change."
        if int(pair.get("strategistActions", 0)) < 1:
            return "Next: the Strategist makes one visible message change."
    elif phase == "sell":
        var strategy := _dictionary_child(document, "strategy")
        var aida_plan := _dictionary_child(strategy, "aidaPlan")
        var evidence := _dictionary_child(document, "evidence")
        for move in ["attention", "interest", "desire", "action"]:
            if (
                not _is_nonblank_string(aida_plan.get(move))
                or not _has_nonblank_evidence(evidence.get(move))
            ):
                return String(AIDA_NEXT_ACTIONS[move])
    elif phase == "irresistible":
        var product := _dictionary_child(document, "product")
        var strategy := _dictionary_child(document, "strategy")
        var evidence := _dictionary_child(document, "evidence")
        var price_cents: Variant = product.get("priceCents", null)
        var route: Variant = strategy.get("marketRoute", null)
        var price_is_positive: bool = (
            typeof(price_cents) in [TYPE_INT, TYPE_FLOAT]
            and is_finite(float(price_cents))
            and float(price_cents) > 0.0
        )
        var route_is_committed: bool = (
            typeof(route) == TYPE_DICTIONARY
            and route.get("committed", false) == true
        )
        if not price_is_positive or not _has_nonblank_evidence(evidence.get("price")):
            return "Next: add a price."
        if not route_is_committed:
            return "Next: choose and lock a market route."
        if not _is_nonblank_string(route.get("proofPoint")):
            return "Next: add a proof point to the market route."
    return ""

func _dictionary_child(source: Dictionary, key: String) -> Dictionary:
    var child: Variant = source.get(key, {})
    if typeof(child) != TYPE_DICTIONARY:
        return {}
    return child

func _is_nonblank_string(value: Variant) -> bool:
    return typeof(value) == TYPE_STRING and str(value).strip_edges() != ""

func _has_nonblank_evidence(value: Variant) -> bool:
    if typeof(value) != TYPE_ARRAY:
        return false
    for object_id in value:
        if _is_nonblank_string(object_id):
            return true
    return false

func _pair_has_completed_turn(document: Dictionary) -> bool:
    var gameplay := _dictionary_child(document, "gameplay")
    var pair := _dictionary_child(gameplay, "pair")
    return (
        int(pair.get("handoffCount", 0)) >= 1
        and int(pair.get("artDirectorActions", 0)) >= 1
        and int(pair.get("strategistActions", 0)) >= 1
    )

func _set_campaign_stage_for_phase() -> void:
    if _room_role.is_empty():
        return
    var gameplay := _dictionary_child(_campaign_document, "gameplay")
    if gameplay.is_empty():
        gameplay = {
            "stage": "invent",
            "pair": {
                "activeRole": "art-director",
                "handoffCount": 0,
                "artDirectorActions": 0,
                "strategistActions": 0
            }
        }
    gameplay["stage"] = _game_run.phase
    _campaign_document["gameplay"] = gameplay

func _validated_live_progress(value: Variant, identity: Dictionary) -> Dictionary:
    var progress := WebRunProgressStore.validated_envelope(value)
    if progress.is_empty():
        return {}
    for key in ["roomCode", "roomId", "teamId", "sessionId", "documentId"]:
        if typeof(progress.get(key)) != TYPE_STRING or progress.get(key) != identity.get(key):
            return {}
    if not _is_nonnegative_integer_number(progress.get("documentRevision")):
        return {}
    if typeof(progress.get("levelLocked")) != TYPE_BOOL:
        return {}
    var restored_run: RefCounted = GameRun.new()
    if not restored_run.restore_pitch_snapshot(progress.get("pitch")):
        return {}
    if bool(progress.get("levelLocked")) != bool(restored_run.is_current_level_ready()):
        return {}
    return {"run": restored_run, "value": progress.duplicate(true)}

func _agency_pitches_match(left: Variant, right: Variant) -> bool:
    if typeof(left) != TYPE_DICTIONARY or typeof(right) != TYPE_DICTIONARY:
        return false
    var left_progress := AdMarketAgencyProgress.new()
    var right_progress := AdMarketAgencyProgress.new()
    if not left_progress.restore_snapshot(left) or not right_progress.restore_snapshot(right):
        return false
    return left_progress.snapshot() == right_progress.snapshot()

func _save_practice_progress() -> void:
    if _practice_bridge == null or _practice_recovery.is_empty():
        return
    var run := _game_run as AdMarketGameRun
    var progress := run.agency_progress() as AdMarketAgencyProgress if run != null else null
    if progress == null:
        return
    var pitch := progress.snapshot()
    var checkpoint: Dictionary = _practice_recovery.get("checkpoint", {})
    if _agency_pitches_match(pitch, checkpoint.get("pitch", {})):
        _queued_practice_pitch.clear()
        return
    if not _practice_pending_method.is_empty():
        _queued_practice_pitch = pitch.duplicate(true)
        return
    var token := _practice_token()
    if token.is_empty():
        return
    var input := {
        "checkpoint": token.duplicate(true),
        "pitch": pitch.duplicate(true)
    }
    _begin_practice_request("saveProgress", "progress")
    var operation_id := _practice_operation_id("saveProgress", input)
    var request_id: String = _practice_bridge.save_progress(token, pitch, operation_id)
    _remember_practice_request_id("saveProgress", request_id)

func _save_live_progress() -> void:
    if _room_role.is_empty():
        _save_practice_progress()
        return
    if _room_role != "team" or _run_progress_store == null:
        return
    var pitch: Dictionary = _game_run.pitch_snapshot()
    if pitch.is_empty() or not _live_document_identity_matches(_campaign_document):
        return
    var room_id := String(_latest_market_snapshot.get("roomId", ""))
    var envelope := {
        "contract": LIVE_PROGRESS_CONTRACT,
        "roomCode": _room_code,
        "roomId": room_id,
        "teamId": String(_game_run.team_id),
        "sessionId": String(_game_run.session_id),
        "documentId": String(_campaign_document.get("documentId")),
        "documentRevision": int(_campaign_document.get("revision", 0)),
        "pitch": pitch,
        "levelLocked": _level_locked
    }
    if envelope == _last_saved_live_progress:
        return
    if (
        JSON.stringify(envelope).to_utf8_buffer().size() <= MAX_LIVE_PROGRESS_BYTES
        and bool(_run_progress_store.save(envelope))
    ):
        _last_saved_live_progress = envelope.duplicate(true)

func _live_document_identity_matches(document: Dictionary) -> bool:
    if _room_role != "team":
        return false
    var room_id := String(_latest_market_snapshot.get("roomId", ""))
    var team_id := String(_game_run.team_id)
    var session_id := String(_game_run.session_id)
    return (
        document.get("mode") == "room"
        and document.get("roomId") == room_id
        and document.get("teamId") == team_id
        and document.get("sessionId") == session_id
        and document.get("documentId") == "room-%s-team-%s-campaign" % [room_id, team_id]
        and _is_nonnegative_integer_number(document.get("revision"))
    )

func _is_nonnegative_integer_number(value: Variant) -> bool:
    if typeof(value) == TYPE_INT:
        return int(value) >= 0
    if typeof(value) != TYPE_FLOAT:
        return false
    var number := float(value)
    return is_finite(number) and number >= 0.0 and number == floor(number)

func _team_has_campaign(snapshot: Dictionary, team_id: String) -> bool:
    var campaigns_value: Variant = snapshot.get("campaigns", [])
    if typeof(campaigns_value) != TYPE_ARRAY:
        return false
    for campaign_value in campaigns_value:
        if (
            typeof(campaign_value) == TYPE_DICTIONARY
            and campaign_value.get("sellerTeamId") == team_id
        ):
            return true
    return false

func _room_campaign_document(room_id: String, team_id: String, session_id: String) -> Dictionary:
    var document := _blank_campaign_document()
    document["documentId"] = "room-%s-team-%s-campaign" % [room_id, team_id]
    document["sessionId"] = session_id
    document["mode"] = "room"
    document["roomId"] = room_id
    document["teamId"] = team_id
    return document

func _blank_campaign_document() -> Dictionary:
    return {
        "schemaVersion": 1,
        "editorVersion": "0.1.0",
        "documentId": "classroom-campaign",
        "sessionId": "local-session",
        "mode": "offline",
        "revision": 0,
        "canvas": {"width": 1600, "height": 900, "background": "#ffffff"},
        "fabricState": {"version": "7.4.0", "objects": []},
        "drawingLayers": [],
        "product": {"name": "", "priceCents": null, "build": null},
        "brief": {
            "targetAudienceId": "",
            "contextId": "",
            "purpose": "persuade",
            "audienceNeeds": [],
            "audienceValues": [],
            "intendedEffects": [],
            "techniques": []
        },
        "gameplay": {
            "stage": "invent",
            "pair": {
                "activeRole": "art-director",
                "handoffCount": 0,
                "artDirectorActions": 0,
                "strategistActions": 0
            }
        },
        "strategy": {
            "productTraitIds": [],
            "marketedChoiceIds": [],
            "marketRoute": null,
            "aidaPlan": {"attention": "", "interest": "", "desire": "", "action": ""}
        },
        "evidence": {
            "price": [],
            "attention": [],
            "interest": [],
            "desire": [],
            "action": []
        },
        "assetReferences": [],
        "updatedAt": "1970-01-01T00:00:00.000Z"
    }
