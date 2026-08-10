extends Node2D
class_name AdMarketAgencyWorld

signal station_requested(station_id: String)
signal role_handoff_requested(role: String)
signal guide_requested
signal audio_settings_requested
signal audio_settings_changed(settings: Dictionary)

const AgencyProgress = preload("res://src/agency/agency_progress.gd")
const MissionCatalog = preload("res://src/agency/agency_mission_catalog.gd")
const STATION_ORDER := [
	"reception",
	"client-briefing",
	"strategy-room",
	"art-studio",
	"copy-room",
	"production-studio",
	"media-desk",
	"sound-booth",
	"pitch-theatre",
]
const STATION_NODE_NAMES := {
	"reception": "Reception",
	"client-briefing": "ClientBriefing",
	"strategy-room": "StrategyRoom",
	"art-studio": "ArtStudio",
	"copy-room": "CopyRoom",
	"production-studio": "ProductionStudio",
	"media-desk": "MediaDesk",
	"sound-booth": "SoundBooth",
	"pitch-theatre": "PitchTheatre",
}
const STATION_ARRIVAL_OFFSETS := {
	"reception": Vector2(59.329586, -24.0),
	"client-briefing": Vector2(0.0, 90.0),
	"strategy-room": Vector2(-59.329586, -24.0),
	"art-studio": Vector2(-64.0, 0.0),
	"copy-room": Vector2(64.0, 0.0),
	"production-studio": Vector2(64.0, 0.0),
	"media-desk": Vector2(64.0, 0.0),
	"sound-booth": Vector2(-64.0, 0.0),
	"pitch-theatre": Vector2(-64.0, 0.0),
}
const STATION_DATA := {
	"reception": {
		"id": "reception",
		"title": "Agency reception",
		"ownerRole": "strategist",
		"position": Vector2(319.9, 290.9),
		"ownerAction": "Check the goal and decide which room the pair needs next.",
		"holdingAction": "Keep the saved advertisement and pair login visible before the pair moves on.",
		"sharedEvidence": "Both partners can state the next task and the next useful room.",
	},
	"client-briefing": {
		"id": "client-briefing",
		"title": "Client briefing",
		"ownerRole": "strategist",
		"position": Vector2(421.0, 408.0),
		"ownerAction": "Read the audience situation, need and values, then name the intended response.",
		"holdingAction": "Check that every claim comes from the brief rather than an assumption.",
		"sharedEvidence": "Both partners can explain who the audience is, what they need and what response the advertisement should produce.",
	},
	"strategy-room": {
		"id": "strategy-room",
		"title": "Strategy room",
		"ownerRole": "strategist",
		"position": Vector2(639.0, 289.4),
		"ownerAction": "Choose the message, claim and persuasive sequence that best serve the audience purpose.",
		"holdingAction": "Test whether the visual plan makes that message easier to notice and understand.",
		"sharedEvidence": "Both partners can connect the advertisement decision to a specific audience effect.",
	},
	"art-studio": {
		"id": "art-studio",
		"title": "Art studio",
		"ownerRole": "art-director",
		"position": Vector2(949.3, 301.9),
		"ownerAction": "Shape colour, scale, contrast and layout so the most important element is seen first.",
		"holdingAction": "Check that the visual hierarchy still supports the agreed audience and message.",
		"sharedEvidence": "Both partners can point to the first, second and third things an audience will notice and explain why.",
	},
	"copy-room": {
		"id": "copy-room",
		"title": "Copy room",
		"ownerRole": "strategist",
		"position": Vector2(226.5, 502.1),
		"ownerAction": "Write and order the headline, support line and call to action for the intended audience response.",
		"holdingAction": "Make sure the type treatment remains readable and visually prominent in the composition.",
		"sharedEvidence": "Both partners can read the message quickly and identify the action it asks the audience to take.",
	},
	"production-studio": {
		"id": "production-studio",
		"title": "Production studio",
		"ownerRole": "art-director",
		"position": Vector2(164.4, 709.1),
		"ownerAction": "Refine image framing, object placement and finish so the advertisement looks deliberate.",
		"holdingAction": "Check every production choice against the advertisement claim and audience purpose.",
		"sharedEvidence": "Both partners can identify what the final framing includes, excludes and makes salient.",
	},
	"media-desk": {
		"id": "media-desk",
		"title": "Media desk",
		"ownerRole": "strategist",
		"position": Vector2(635.4, 554.4),
		"ownerAction": "Choose the format and placement most likely to reach the intended audience in the right context.",
		"holdingAction": "Adapt the layout so it remains clear within the chosen billboard, magazine or screen shape.",
		"sharedEvidence": "Both partners can explain why the selected medium suits the audience situation.",
	},
	"sound-booth": {
		"id": "sound-booth",
		"title": "Sound booth",
		"ownerRole": "art-director",
		"position": Vector2(973.3, 500.9),
		"ownerAction": "Choose restrained music and sound cues that support attention without obscuring the message.",
		"holdingAction": "Check that every cue reinforces the intended tone and audience response.",
		"sharedEvidence": "Both partners can explain what the sound adds and confirm that the advertisement still works with audio muted.",
	},
	"pitch-theatre": {
		"id": "pitch-theatre",
		"title": "Pitch theatre",
		"ownerRole": "strategist",
		"position": Vector2(996.6, 671.2),
		"ownerAction": "Present the audience problem, advertisement decision and evidence in a clear sequence.",
		"holdingAction": "Control the visual reveal and make the finished advertisement easy to see.",
		"sharedEvidence": "Both partners can defend how the finished advertisement is likely to influence its intended audience.",
	},
}
const OBJECTIVE_STATIONS := {
	"meet-client": "client-briefing",
	"build-product": "production-studio",
	"direct-attention": "art-studio",
	"shape-message": "strategy-room",
	"set-campaign-tone": "art-studio",
	"focus-image": "production-studio",
	"prove-value": "strategy-room",
	"polish-campaign": "production-studio",
	"prepare-pitch": "pitch-theatre",
	"present-campaign": "pitch-theatre",
}
const CENTRAL_TRAVEL_POINT := Vector2(618.3, 413.4)
const NEAR_STATION_DISTANCE := 92.0

var reduced_motion_enabled: bool = false
var _progress: AdMarketAgencyProgress
var _current_station_id: String = "reception"
var _travel_tween: Tween
var _travel_target: Vector2
var _station_details_visible: bool = false
var _station_panel_tucked: bool = false

func _ready() -> void:
	_connect_controls()
	_ensure_travel_items()
	_configure_stations()
	if _progress == null:
		var preview_progress := AgencyProgress.new()
		preview_progress.begin()
		configure(preview_progress)
	else:
		_configure_guidance()
		_refresh_world()
		_show_orientation_if_required()

func _physics_process(_delta: float) -> void:
	var pair := _pair()
	if pair == null or not pair.input_enabled or pair.modal_open:
		return
	var nearest := _nearest_station_id(pair.position)
	if nearest.is_empty():
		return
	pair.set_nearest_station(nearest)
	if pair.position.distance_to(_station_position(nearest)) <= NEAR_STATION_DISTANCE:
		_set_current_station(nearest, true)

func _unhandled_input(event: InputEvent) -> void:
	var pair := _pair()
	if pair == null or not pair.input_enabled or pair.modal_open:
		return
	if event.is_action_pressed("guide"):
		_on_guide_pressed()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("role_handoff"):
		_show_handoff_dialog()
		get_viewport().set_input_as_handled()

func configure(progress: AdMarketAgencyProgress) -> void:
	_progress = progress
	_current_station_id = progress.current_station_id
	_ensure_travel_items()
	_configure_stations()
	_configure_missions()
	_configure_guidance()
	_refresh_world()
	_show_orientation_if_required()

func set_input_enabled(enabled: bool) -> void:
	var pair := _pair()
	if pair != null:
		pair.set_input_enabled(enabled)

func set_reduced_motion_enabled(enabled: bool) -> void:
	reduced_motion_enabled = enabled
	var pair := _pair()
	if enabled:
		var had_direct_travel := _travel_tween != null or (pair != null and pair.is_auto_travelling())
		_cancel_direct_travel(true)
		if had_direct_travel and pair != null and not pair.modal_open:
			pair.set_input_enabled(true)
	if pair != null:
		pair.set_reduced_motion_enabled(enabled)
	var ambient := _ambient_motion()
	if ambient != null:
		ambient.set_reduced_motion_enabled(enabled)

func direct_travel(station_id: String) -> bool:
	if not STATION_DATA.has(station_id):
		return false
	if _progress != null and not _progress.travel_to(station_id):
		return false
	_current_station_id = station_id
	_update_station_state()
	var pair := _pair()
	if pair == null:
		return true
	var target := _station_arrival_position(station_id)
	if not is_inside_tree() or reduced_motion_enabled:
		var had_direct_travel := _travel_tween != null or pair.is_auto_travelling()
		_cancel_direct_travel()
		pair.position = target
		pair.set_nearest_station(station_id)
		pair.end_auto_travel()
		if had_direct_travel and not pair.modal_open:
			pair.set_input_enabled(true)
		return true
	_begin_direct_travel(pair, target)
	return true

func reading_active() -> bool:
	var guide := _guide()
	if guide != null and guide.reading_active():
		return true
	for path in ["%AgencyMissionPanel", "%HandoffPanel"]:
		var panel := get_node_or_null(String(path)) as Control
		if panel != null and panel.visible:
			return true
	return false

func current_station_id() -> String:
	return _current_station_id

func objective_station_id() -> String:
	if _progress == null:
		return "client-briefing"
	return String(OBJECTIVE_STATIONS.get(_progress.current_objective_id, "reception"))

func accessibility_state() -> Dictionary:
	var objective_id := "meet-client" if _progress == null else _progress.current_objective_id
	var objective: Dictionary = MissionCatalog.objective(objective_id)
	var station: Dictionary = STATION_DATA.get(_current_station_id, STATION_DATA.get("reception", {}))
	var active_role := "strategist" if _progress == null else _progress.active_role
	var role_name := "Art Director" if active_role == "art-director" else "Strategist"
	var action_button := get_node_or_null("%StationActionButton") as Button
	var station_prompt := (
		String(action_button.text)
		if action_button != null
		else String(station.get("ownerAction", "Choose the next useful action."))
	)
	var required_done := 0 if _progress == null else _progress.completed_mission_ids.size()
	var required_total := MissionCatalog.required_missions().size()
	var optional_done := 0 if _progress == null else _progress.completed_sidequest_ids.size()
	return {
		"eyebrow": "ADVERTISEMENT WORK",
		"heading": "Create and pitch one persuasive advertisement for the audience in the client brief.",
		"currentInstruction": (
			"Next task: %s. Current room: %s. Active role: %s. %s"
			% [
				String(objective.get("title", objective_id.capitalize())),
				String(station.get("title", "Agency reception")),
				role_name,
				station_prompt,
			]
		),
		"completionStatus": (
			"%d of %d required tasks complete; %d optional practice activities complete."
			% [required_done, required_total, optional_done]
		),
	}

func _connect_controls() -> void:
	var pair := _pair()
	if pair != null and not pair.interaction_requested.is_connected(_on_pair_interaction_requested):
		pair.interaction_requested.connect(_on_pair_interaction_requested)
	var hud := _hud()
	if hud != null:
		if not hud.direct_travel_requested.is_connected(_on_guidance_travel_requested):
			hud.direct_travel_requested.connect(_on_guidance_travel_requested)
		if not hud.guide_requested.is_connected(_on_hud_guide_requested):
			hud.guide_requested.connect(_on_hud_guide_requested)
		if not hud.sound_muted_requested.is_connected(_on_hud_sound_muted_requested):
			hud.sound_muted_requested.connect(_on_hud_sound_muted_requested)
	var guide := _guide()
	if guide != null:
		if not guide.direct_travel_requested.is_connected(_on_guidance_travel_requested):
			guide.direct_travel_requested.connect(_on_guidance_travel_requested)
		if not guide.role_handoff_requested.is_connected(_on_guide_role_handoff_requested):
			guide.role_handoff_requested.connect(_on_guide_role_handoff_requested)
		if not guide.audio_settings_requested.is_connected(_on_guide_audio_settings_requested):
			guide.audio_settings_requested.connect(_on_guide_audio_settings_requested)
		if not guide.audio_settings_changed.is_connected(_on_guide_audio_settings_changed):
			guide.audio_settings_changed.connect(_on_guide_audio_settings_changed)
		if not guide.tucked_changed.is_connected(_on_guide_tucked_changed):
			guide.tucked_changed.connect(_on_guide_tucked_changed)
		if not guide.reading_state_changed.is_connected(_on_guide_reading_state_changed):
			guide.reading_state_changed.connect(_on_guide_reading_state_changed)
	var guide_button := get_node_or_null("%GuideButton") as Button
	if guide_button != null and not guide_button.pressed.is_connected(_on_guide_pressed):
		guide_button.pressed.connect(_on_guide_pressed)
	var direct_travel_menu := get_node_or_null("%DirectTravel") as OptionButton
	if direct_travel_menu != null and not direct_travel_menu.item_selected.is_connected(_on_direct_travel_selected):
		direct_travel_menu.item_selected.connect(_on_direct_travel_selected)
	var station_action := get_node_or_null("%StationActionButton") as Button
	if station_action != null and not station_action.pressed.is_connected(_on_station_action_pressed):
		station_action.pressed.connect(_on_station_action_pressed)
	var details_button := get_node_or_null("%StationDetailsToggle") as Button
	if details_button != null and not details_button.pressed.is_connected(_on_station_details_pressed):
		details_button.pressed.connect(_on_station_details_pressed)
	var tuck_button := get_node_or_null("%StationPanelTuck") as Button
	if tuck_button != null and not tuck_button.pressed.is_connected(_on_station_panel_tuck_pressed):
		tuck_button.pressed.connect(_on_station_panel_tuck_pressed)
	var station_tab := get_node_or_null("%StationPanelTab") as Button
	if station_tab != null and not station_tab.pressed.is_connected(_on_station_panel_tab_pressed):
		station_tab.pressed.connect(_on_station_panel_tab_pressed)
	var art_button := get_node_or_null("%ArtDirectorHandoff") as Button
	if art_button != null and not art_button.pressed.is_connected(_on_art_director_handoff_pressed):
		art_button.pressed.connect(_on_art_director_handoff_pressed)
	var strategy_button := get_node_or_null("%StrategistHandoff") as Button
	if strategy_button != null and not strategy_button.pressed.is_connected(_on_strategist_handoff_pressed):
		strategy_button.pressed.connect(_on_strategist_handoff_pressed)
	var cancel_button := get_node_or_null("%CancelHandoff") as Button
	if cancel_button != null and not cancel_button.pressed.is_connected(_hide_handoff_dialog):
		cancel_button.pressed.connect(_hide_handoff_dialog)

func _configure_stations() -> void:
	for station_id in STATION_ORDER:
		var station := _station_node(station_id)
		if station == null:
			continue
		station.configure(STATION_DATA.get(station_id, {}))
		if not station.requested.is_connected(_on_station_requested):
			station.requested.connect(_on_station_requested)

func _ensure_travel_items() -> void:
	var menu := get_node_or_null("%DirectTravel") as OptionButton
	if menu != null:
		menu.clear()
	var records: Array[Dictionary] = []
	for station_id in STATION_ORDER:
		var record: Dictionary = STATION_DATA.get(station_id, {})
		records.append(record.duplicate(true))
		if menu != null:
			menu.add_item(String(record.get("title", station_id.capitalize())))
			menu.set_item_metadata(menu.item_count - 1, station_id)
	var hud := _hud()
	if hud != null:
		hud.configure_stations(records, _current_station_id)

func _configure_missions() -> void:
	var controller := _mission_controller()
	if controller == null or _progress == null:
		return
	var panel := _mission_panel()
	controller.configure(_progress, panel)
	if panel != null and not panel.role_handoff_requested.is_connected(_on_mission_role_handoff_requested):
		panel.role_handoff_requested.connect(_on_mission_role_handoff_requested)
	if not controller.mission_completed.is_connected(_on_mission_completed):
		controller.mission_completed.connect(_on_mission_completed)
	if not controller.sidequest_completed.is_connected(_on_sidequest_completed):
		controller.sidequest_completed.connect(_on_sidequest_completed)
	if not controller.state_changed.is_connected(_on_mission_controller_state_changed):
		controller.state_changed.connect(_on_mission_controller_state_changed)

func _configure_guidance() -> void:
	if _progress == null:
		return
	var guide := _guide()
	if guide != null:
		guide.configure(_progress, MissionCatalog)
		_hide_embedded_guide_tab(guide)
	var hud := _hud()
	if hud != null:
		hud.set_tucked(_progress.guide_tucked)
		hud.set_sound_muted(not bool(_progress.audio_settings.get("enabled", true)))

func _hide_embedded_guide_tab(guide: AdMarketAgencyGuideDrawer) -> void:
	var guide_tab := guide.get_node_or_null("GuideTab") as Button
	if guide_tab != null:
		guide_tab.visible = false

func _refresh_world() -> void:
	var pair := _pair()
	if pair != null:
		pair.position = _station_arrival_position(_current_station_id)
		if _progress != null:
			pair.set_active_role(_progress.active_role)
		pair.set_nearest_station(_current_station_id)
	_update_objective_bar()
	_update_station_state()

func _set_current_station(station_id: String, update_progress: bool) -> void:
	if not STATION_DATA.has(station_id) or station_id == _current_station_id:
		return
	_current_station_id = station_id
	if update_progress and _progress != null:
		_progress.travel_to(station_id)
	_update_station_state()

func _update_objective_bar() -> void:
	var objective_id := "meet-client" if _progress == null else _progress.current_objective_id
	var objective: Dictionary = MissionCatalog.objective(objective_id)
	var objective_label := get_node_or_null("%ObjectiveLabel") as Label
	if objective_label != null:
		objective_label.text = String(objective.get("title", objective_id.capitalize()))
	var required_done := 0 if _progress == null else _progress.completed_mission_ids.size()
	var required_total := MissionCatalog.required_missions().size()
	var optional_done := 0 if _progress == null else _progress.completed_sidequest_ids.size()
	var hud := _hud()
	if hud != null:
		hud.show_objective(objective)
		hud.set_progress(required_done, required_total, optional_done)
	var guide := _guide()
	if guide != null:
		guide.show_objective(objective)
		guide.set_progress(required_done, required_total, optional_done)

func _update_station_state() -> void:
	var record: Dictionary = STATION_DATA.get(_current_station_id, {})
	var pair := _pair()
	if pair != null:
		pair.emphasise_station_owner(String(record.get("ownerRole", "strategist")))
		pair.set_nearest_station(_current_station_id)
	for station_id in STATION_ORDER:
		var station := _station_node(station_id)
		if station != null:
			station.set_highlighted(station_id == _current_station_id)
	var title_label := get_node_or_null("%StationTitle") as Label
	var responsibilities := get_node_or_null("%StationResponsibilities") as Label
	var action_button := get_node_or_null("%StationActionButton") as Button
	if title_label != null:
		title_label.text = String(record.get("title", "Agency room"))
	if responsibilities != null:
		var station_node := _station_node(_current_station_id)
		responsibilities.text = station_node.responsibility_summary() if station_node != null else ""
	if action_button != null:
		var next_mission := _next_mission_for_station(_current_station_id)
		if next_mission.is_empty():
			action_button.text = "No open work at %s" % String(record.get("title", "this room"))
			action_button.disabled = true
		else:
			var action_prefix := "Start task" if bool(next_mission.get("required", true)) else "Optional practice"
			action_button.text = "%s: %s" % [action_prefix, String(next_mission.get("title", "Agency task"))]
			action_button.disabled = false
	var menu := get_node_or_null("%DirectTravel") as OptionButton
	if menu != null:
		var selected_index := STATION_ORDER.find(_current_station_id)
		if selected_index >= 0:
			menu.select(selected_index)
	var hud := _hud()
	if hud != null:
		hud.select_station(_current_station_id)
	_set_station_details_visible(_station_details_visible)
	_set_station_panel_tucked(_station_panel_tucked)

func _set_station_details_visible(visible: bool) -> void:
	_station_details_visible = visible
	var responsibilities := get_node_or_null("%StationResponsibilities") as Control
	if responsibilities != null:
		responsibilities.visible = visible
	var button := get_node_or_null("%StationDetailsToggle") as Button
	if button != null:
		button.text = "Hide room details" if visible else "Show room details"

func _set_station_panel_tucked(tucked: bool) -> void:
	_station_panel_tucked = tucked
	var panel := get_node_or_null("%StationPanel") as Control
	var tab := get_node_or_null("%StationPanelTab") as Button
	if panel != null:
		panel.visible = not tucked
	if tab != null:
		var record: Dictionary = STATION_DATA.get(_current_station_id, {})
		tab.text = "Open %s" % String(record.get("title", "room card"))
		tab.visible = tucked

func _focus_visible_station_control() -> void:
	if reading_active():
		return
	var pair := _pair()
	if pair != null and (pair.modal_open or not pair.input_enabled):
		return
	var target_path := "%StationPanelTab" if _station_panel_tucked else "%StationActionButton"
	var target := get_node_or_null(target_path) as Button
	if target != null and target.is_visible_in_tree() and not target.disabled:
		target.grab_focus()

func _begin_direct_travel(pair: AdMarketAgencyPair, target: Vector2) -> void:
	_cancel_direct_travel()
	_travel_target = target
	var departure := pair.position
	pair.set_input_enabled(false)
	var points: Array[Vector2] = []
	if departure.distance_to(target) > 260.0:
		points.append(CENTRAL_TRAVEL_POINT)
	points.append(target)
	pair.begin_auto_travel(points.front() - departure)
	_travel_tween = get_tree().create_tween()
	for point in points:
		var direction := point - departure
		if point != points.front():
			_travel_tween.tween_callback(_begin_direct_travel_leg.bind(pair, direction))
		var duration := clampf(departure.distance_to(point) / 1200.0, 0.12, 0.34)
		_travel_tween.tween_property(pair, "position", point, duration).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
		departure = point
	_travel_tween.finished.connect(_finish_direct_travel)

func _begin_direct_travel_leg(pair: AdMarketAgencyPair, direction: Vector2) -> void:
	pair.update_auto_travel_direction(direction)

func _finish_direct_travel() -> void:
	var pair := _pair()
	var can_restore_input := false
	if pair != null:
		can_restore_input = not pair.modal_open and not reading_active()
		if can_restore_input:
			pair.set_input_enabled(true)
		pair.set_nearest_station(_current_station_id)
		pair.end_auto_travel()
	_travel_tween = null
	_travel_target = Vector2.ZERO
	if can_restore_input:
		_focus_visible_station_control()

func _on_pair_interaction_requested() -> void:
	var pair := _pair()
	if pair == null:
		return
	var nearest := _nearest_station_id(pair.position)
	if nearest.is_empty() or pair.position.distance_to(_station_position(nearest)) > NEAR_STATION_DISTANCE:
		return
	_set_current_station(nearest, true)
	_request_station_work(nearest)

func _on_station_requested(station_id: String) -> void:
	_set_current_station(station_id, true)
	_request_station_work(station_id)

func _on_station_action_pressed() -> void:
	_request_station_work(_current_station_id)

func _on_station_details_pressed() -> void:
	_set_station_details_visible(not _station_details_visible)

func _on_station_panel_tuck_pressed() -> void:
	_set_station_panel_tucked(true)
	call_deferred("_focus_visible_station_control")

func _on_station_panel_tab_pressed() -> void:
	_set_station_panel_tucked(false)
	call_deferred("_focus_visible_station_control")

func _request_station_work(station_id: String) -> void:
	station_requested.emit(station_id)
	if _progress == null:
		return
	var record := _next_mission_for_station(station_id)
	if record.is_empty():
		return
	var controller := _mission_controller()
	if controller != null:
		controller.open_mission(String(record.get("id")), _progress.active_role)

func _on_mission_completed(_mission_id: String, _evidence: Dictionary) -> void:
	_refresh_mission_progress()

func _on_sidequest_completed(_sidequest_id: String) -> void:
	_refresh_mission_progress()

func _on_mission_controller_state_changed(state: Dictionary) -> void:
	_set_guidance_modal(String(state.get("state", "closed")) != "closed")

func _on_mission_role_handoff_requested(role: String) -> void:
	if _progress == null or not _progress.handoff_to(role):
		var panel := _mission_panel()
		if panel != null and panel.has_method("show_handoff_error"):
			panel.call("show_handoff_error")
		return
	var pair := _pair()
	if pair != null:
		pair.set_active_role(role)
	role_handoff_requested.emit(role)
	var controller := _mission_controller()
	if controller != null:
		controller.refresh_active_role(role)

func _refresh_mission_progress() -> void:
	_update_objective_bar()
	_update_station_state()

func _on_direct_travel_selected(index: int) -> void:
	var menu := get_node_or_null("%DirectTravel") as OptionButton
	if menu == null or index < 0 or index >= menu.item_count:
		return
	direct_travel(String(menu.get_item_metadata(index)))

func _on_guide_pressed() -> void:
	_open_guide("objective")

func _open_guide(section: String) -> void:
	var guide := _guide()
	if guide != null:
		guide.open_guide(section)
		_set_guidance_modal(true)
	guide_requested.emit()

func _on_hud_guide_requested(section: String) -> void:
	_open_guide(section)

func _on_hud_sound_muted_requested(muted: bool) -> void:
	if _progress == null:
		return
	var settings := _progress.audio_settings.duplicate(true)
	settings["enabled"] = not muted
	_progress.audio_settings = settings
	_configure_guidance()
	audio_settings_changed.emit(settings.duplicate(true))

func _on_guidance_travel_requested(station_id: String) -> void:
	direct_travel(station_id)

func _on_guide_tucked_changed(tucked: bool) -> void:
	var hud := _hud()
	if hud != null:
		hud.set_tucked(tucked)
	var guide := _guide()
	if guide != null:
		_hide_embedded_guide_tab(guide)
	var orientation := guide.get_node_or_null("%OrientationPanel") as Control if guide != null else null
	var orientation_active := orientation != null and orientation.visible
	if tucked and not orientation_active:
		var hud_guide_button := get_node_or_null("%HudGuideButton") as Button
		if hud_guide_button != null and hud_guide_button.visible and hud_guide_button.is_inside_tree():
			call_deferred("_focus_visible_hud_guide_button")
	_set_guidance_modal(not tucked or orientation_active)

func _focus_visible_hud_guide_button() -> void:
	# A role handoff can open synchronously while this tuck-focus is deferred.
	# Never move focus behind a modal that appeared in the meantime.
	if reading_active():
		return
	var hud_guide_button := get_node_or_null("%HudGuideButton") as Button
	if hud_guide_button != null and hud_guide_button.visible and hud_guide_button.is_inside_tree():
		hud_guide_button.grab_focus()

func _on_guide_reading_state_changed(active: bool) -> void:
	_set_guidance_modal(active)

func _unhandled_key_input(event: InputEvent) -> void:
	var key_event: InputEventKey = event as InputEventKey
	if key_event == null or not key_event.pressed or key_event.echo:
		return
	var pair: AdMarketAgencyPair = _pair()
	if pair == null or not pair.input_enabled or pair.modal_open:
		return
	var viewport := get_viewport()
	if key_event.keycode == KEY_H:
		_show_handoff_dialog()
		if viewport != null:
			viewport.set_input_as_handled()
	elif key_event.keycode == KEY_G:
		_on_guide_pressed()
		if viewport != null:
			viewport.set_input_as_handled()

func _on_guide_role_handoff_requested(role: String) -> void:
	var guide := _guide()
	if guide != null:
		guide.set_tucked(true)
	_show_handoff_dialog()
	var button_path := "%ArtDirectorHandoff" if role == "art-director" else "%StrategistHandoff"
	var requested_button := get_node_or_null(button_path) as Button
	if requested_button != null and is_inside_tree():
		requested_button.grab_focus()

func _on_guide_audio_settings_requested() -> void:
	audio_settings_requested.emit()

func _on_guide_audio_settings_changed(settings: Dictionary) -> void:
	audio_settings_changed.emit(settings.duplicate(true))

func _show_orientation_if_required() -> void:
	var guide := _guide()
	if guide == null or not guide.orientation_required():
		return
	guide.open_orientation()
	_set_guidance_modal(true)

func _set_guidance_modal(is_open: bool) -> void:
	if is_open:
		_cancel_direct_travel()
	var pair := _pair()
	if pair == null:
		return
	pair.set_modal_open(is_open)
	pair.set_input_enabled(not is_open)

func _show_handoff_dialog() -> void:
	_cancel_direct_travel()
	var panel := get_node_or_null("%HandoffPanel") as Control
	var explanation := get_node_or_null("%HandoffExplanation") as Label
	if panel == null:
		return
	var station := _station_node(_current_station_id)
	if explanation != null and station != null:
		explanation.text = (
			"Choose who controls the next decision. This does not remove either partner's job.\n\n%s"
			% station.responsibility_summary()
		)
	var active_role := "strategist" if _progress == null else _progress.active_role
	var art_button := get_node_or_null("%ArtDirectorHandoff") as Button
	var strategist_button := get_node_or_null("%StrategistHandoff") as Button
	if art_button != null:
		art_button.disabled = active_role == "art-director"
	if strategist_button != null:
		strategist_button.disabled = active_role == "strategist"
	panel.visible = true
	set_input_enabled(false)
	var pair := _pair()
	if pair != null:
		pair.set_modal_open(true)
	var available_button := strategist_button if active_role == "art-director" else art_button
	if available_button != null and available_button.is_visible_in_tree():
		available_button.grab_focus()

func _on_art_director_handoff_pressed() -> void:
	_complete_handoff("art-director")

func _on_strategist_handoff_pressed() -> void:
	_complete_handoff("strategist")

func _complete_handoff(role: String) -> void:
	if _progress == null or not _progress.handoff_to(role):
		return
	var pair := _pair()
	if pair != null:
		pair.set_active_role(role)
	role_handoff_requested.emit(role)
	_hide_handoff_dialog()

func _hide_handoff_dialog() -> void:
	var panel := get_node_or_null("%HandoffPanel") as Control
	if panel != null:
		panel.visible = false
	var pair := _pair()
	if pair != null:
		pair.set_modal_open(false)
	set_input_enabled(true)
	_focus_visible_station_control()

func _cancel_direct_travel(teleport_to_target: bool = false) -> void:
	if _travel_tween != null and _travel_tween.is_valid():
		_travel_tween.kill()
	_travel_tween = null
	var pair := _pair()
	if pair != null:
		if teleport_to_target and not _travel_target.is_zero_approx():
			pair.position = _travel_target
			pair.set_nearest_station(_current_station_id)
		pair.end_auto_travel()
	_travel_target = Vector2.ZERO

func _nearest_station_id(from_position: Vector2) -> String:
	var nearest_id := ""
	var nearest_distance := INF
	for station_id in STATION_ORDER:
		var distance := from_position.distance_squared_to(_station_position(station_id))
		if distance < nearest_distance:
			nearest_distance = distance
			nearest_id = station_id
	return nearest_id

func _station_position(station_id: String) -> Vector2:
	var station: AdMarketAgencyStation = _station_node(station_id)
	if is_instance_valid(station):
		return station.position
	var record: Dictionary = STATION_DATA.get(station_id, STATION_DATA.get("reception", {}))
	return record.get("position", Vector2(318.0, 318.0)) as Vector2

func _station_arrival_position(station_id: String) -> Vector2:
	var offset := STATION_ARRIVAL_OFFSETS.get(station_id, Vector2(64.0, 0.0)) as Vector2
	return _station_position(station_id) + offset

func _station_node(station_id: String) -> AdMarketAgencyStation:
	var node_name := String(STATION_NODE_NAMES.get(station_id, ""))
	if node_name.is_empty():
		return null
	return get_node_or_null("Stations/%s" % node_name) as AdMarketAgencyStation

func _next_mission_for_station(station_id: String) -> Dictionary:
	if _progress == null:
		return {}
	var required_records: Array[Dictionary] = MissionCatalog.required_missions()
	for record: Dictionary in required_records:
		var mission_id := String(record.get("id"))
		if String(record.get("stationId")) == station_id and not _progress.completed_mission_ids.has(mission_id):
			return record.duplicate(true)
	var sidequest_records: Array[Dictionary] = MissionCatalog.sidequests()
	for record: Dictionary in sidequest_records:
		var sidequest_id := String(record.get("id"))
		if String(record.get("stationId")) == station_id and not _progress.completed_sidequest_ids.has(sidequest_id):
			return record.duplicate(true)
	return {}

func _mission_controller() -> AdMarketAgencyMissionController:
	return get_node_or_null("%AgencyMissionController") as AdMarketAgencyMissionController

func _mission_panel() -> AdMarketAgencyMissionPanel:
	return get_node_or_null("%AgencyMissionPanel") as AdMarketAgencyMissionPanel

func _hud() -> AdMarketAgencyHud:
	return get_node_or_null("%AgencyHud") as AdMarketAgencyHud

func _guide() -> AdMarketAgencyGuideDrawer:
	return get_node_or_null("%AgencyGuideDrawer") as AdMarketAgencyGuideDrawer

func _ambient_motion() -> AdMarketAgencyAmbientMotion:
	return get_node_or_null("%AgencyAmbientMotion") as AdMarketAgencyAmbientMotion

func _pair() -> AdMarketAgencyPair:
	return get_node_or_null("%AgencyPair") as AdMarketAgencyPair
