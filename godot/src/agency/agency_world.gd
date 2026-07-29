extends Node2D
class_name AdMarketAgencyWorld

signal station_requested(station_id: String)
signal role_handoff_requested(role: String)
signal guide_requested

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
	"client-briefing": Vector2(-64.0, 0.0),
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
		"position": Vector2(318.0, 318.0),
		"ownerAction": "Check the campaign goal and decide which room the pair needs next.",
		"holdingAction": "Keep the saved campaign and pair login visible before the pair moves on.",
		"sharedEvidence": "Both partners can state the current objective and the next useful station.",
	},
	"client-briefing": {
		"id": "client-briefing",
		"title": "Client briefing",
		"ownerRole": "strategist",
		"position": Vector2(430.0, 370.0),
		"ownerAction": "Read the audience situation, need and values, then name the intended response.",
		"holdingAction": "Check that every claim comes from the brief rather than an assumption.",
		"sharedEvidence": "Both partners can explain who the audience is, what they need and what response the advertisement should produce.",
	},
	"strategy-room": {
		"id": "strategy-room",
		"title": "Strategy room",
		"ownerRole": "strategist",
		"position": Vector2(640.0, 320.0),
		"ownerAction": "Choose the message, claim and persuasive sequence that best serve the audience purpose.",
		"holdingAction": "Test whether the visual plan makes that message easier to notice and understand.",
		"sharedEvidence": "Both partners can connect the campaign decision to a specific audience effect.",
	},
	"art-studio": {
		"id": "art-studio",
		"title": "Art studio",
		"ownerRole": "art-director",
		"position": Vector2(1040.0, 310.0),
		"ownerAction": "Shape colour, scale, contrast and layout so the most important element is seen first.",
		"holdingAction": "Check that the visual hierarchy still supports the agreed audience and message.",
		"sharedEvidence": "Both partners can point to the first, second and third things an audience will notice and explain why.",
	},
	"copy-room": {
		"id": "copy-room",
		"title": "Copy room",
		"ownerRole": "strategist",
		"position": Vector2(228.0, 518.0),
		"ownerAction": "Write and order the headline, support line and call to action for the intended audience response.",
		"holdingAction": "Make sure the type treatment remains readable and visually prominent in the composition.",
		"sharedEvidence": "Both partners can read the message quickly and identify the action it asks the audience to take.",
	},
	"production-studio": {
		"id": "production-studio",
		"title": "Production studio",
		"ownerRole": "art-director",
		"position": Vector2(178.0, 706.0),
		"ownerAction": "Refine image framing, object placement and finish so the campaign looks deliberate.",
		"holdingAction": "Check every production choice against the campaign claim and audience purpose.",
		"sharedEvidence": "Both partners can identify what the final framing includes, excludes and makes salient.",
	},
	"media-desk": {
		"id": "media-desk",
		"title": "Media desk",
		"ownerRole": "strategist",
		"position": Vector2(640.0, 532.0),
		"ownerAction": "Choose the format and placement most likely to reach the intended audience in the right context.",
		"holdingAction": "Adapt the layout so it remains clear within the chosen billboard, magazine or screen shape.",
		"sharedEvidence": "Both partners can explain why the selected medium suits the audience situation.",
	},
	"sound-booth": {
		"id": "sound-booth",
		"title": "Sound booth",
		"ownerRole": "art-director",
		"position": Vector2(982.0, 518.0),
		"ownerAction": "Choose restrained music and sound cues that support attention without obscuring the message.",
		"holdingAction": "Check that every cue reinforces the intended tone and audience response.",
		"sharedEvidence": "Both partners can explain what the sound adds and confirm that the campaign still works with audio muted.",
	},
	"pitch-theatre": {
		"id": "pitch-theatre",
		"title": "Pitch theatre",
		"ownerRole": "strategist",
		"position": Vector2(1012.0, 708.0),
		"ownerAction": "Present the audience problem, campaign decision and evidence in a clear sequence.",
		"holdingAction": "Control the visual reveal and make the finished advertisement easy to see.",
		"sharedEvidence": "Both partners can defend how the finished campaign is likely to influence its intended audience.",
	},
}
const OBJECTIVE_STATIONS := {
	"meet-client": "client-briefing",
	"build-product": "art-studio",
	"direct-attention": "art-studio",
	"shape-message": "copy-room",
	"set-campaign-tone": "art-studio",
	"focus-image": "production-studio",
	"prove-value": "strategy-room",
	"polish-campaign": "production-studio",
	"prepare-pitch": "pitch-theatre",
	"present-campaign": "pitch-theatre",
}
const CENTRAL_TRAVEL_POINT := Vector2(640.0, 430.0)
const NEAR_STATION_DISTANCE := 92.0

var reduced_motion_enabled: bool = false
var _progress: AdMarketAgencyProgress
var _current_station_id: String = "reception"
var _travel_tween: Tween

func _ready() -> void:
	_connect_controls()
	_ensure_travel_items()
	_configure_stations()
	if _progress == null:
		var preview_progress := AgencyProgress.new()
		preview_progress.begin()
		configure(preview_progress)
	else:
		_refresh_world()

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
	_refresh_world()

func set_input_enabled(enabled: bool) -> void:
	var pair := _pair()
	if pair != null:
		pair.set_input_enabled(enabled)

func set_reduced_motion_enabled(enabled: bool) -> void:
	reduced_motion_enabled = enabled

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
		pair.position = target
		pair.set_nearest_station(station_id)
		return true
	_begin_direct_travel(pair, target)
	return true

func current_station_id() -> String:
	return _current_station_id

func objective_station_id() -> String:
	if _progress == null:
		return "client-briefing"
	return String(OBJECTIVE_STATIONS.get(_progress.current_objective_id, "reception"))

func _connect_controls() -> void:
	var pair := _pair()
	if pair != null and not pair.interaction_requested.is_connected(_on_pair_interaction_requested):
		pair.interaction_requested.connect(_on_pair_interaction_requested)
	var guide_button := get_node_or_null("%GuideButton") as Button
	if guide_button != null and not guide_button.pressed.is_connected(_on_guide_pressed):
		guide_button.pressed.connect(_on_guide_pressed)
	var direct_travel_menu := get_node_or_null("%DirectTravel") as OptionButton
	if direct_travel_menu != null and not direct_travel_menu.item_selected.is_connected(_on_direct_travel_selected):
		direct_travel_menu.item_selected.connect(_on_direct_travel_selected)
	var station_action := get_node_or_null("%StationActionButton") as Button
	if station_action != null and not station_action.pressed.is_connected(_on_station_action_pressed):
		station_action.pressed.connect(_on_station_action_pressed)
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
	if menu == null:
		return
	menu.clear()
	for station_id in STATION_ORDER:
		var record: Dictionary = STATION_DATA.get(station_id, {})
		menu.add_item(String(record.get("title", station_id.capitalize())))
		menu.set_item_metadata(menu.item_count - 1, station_id)

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
	var objective_label := get_node_or_null("%ObjectiveLabel") as Label
	if objective_label == null:
		return
	if _progress == null:
		objective_label.text = "Meet the client"
		return
	var objective := MissionCatalog.objective(_progress.current_objective_id)
	objective_label.text = String(objective.get("title", _progress.current_objective_id.capitalize()))

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
		title_label.text = String(record.get("title", "Agency station"))
	if responsibilities != null:
		var station_node := _station_node(_current_station_id)
		responsibilities.text = station_node.responsibility_summary() if station_node != null else ""
	if action_button != null:
		action_button.text = "Work at %s" % String(record.get("title", "this station"))
	var menu := get_node_or_null("%DirectTravel") as OptionButton
	if menu != null:
		var selected_index := STATION_ORDER.find(_current_station_id)
		if selected_index >= 0:
			menu.select(selected_index)

func _begin_direct_travel(pair: AdMarketAgencyPair, target: Vector2) -> void:
	if _travel_tween != null and _travel_tween.is_valid():
		_travel_tween.kill()
	pair.set_input_enabled(false)
	var points: Array[Vector2] = []
	if pair.position.distance_to(target) > 260.0:
		points.append(CENTRAL_TRAVEL_POINT)
	points.append(target)
	_travel_tween = get_tree().create_tween()
	for point in points:
		var duration := clampf(pair.position.distance_to(point) / 1200.0, 0.12, 0.34)
		_travel_tween.tween_property(pair, "position", point, duration).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN_OUT)
	_travel_tween.finished.connect(_finish_direct_travel)

func _finish_direct_travel() -> void:
	var pair := _pair()
	if pair != null:
		pair.set_input_enabled(true)
		pair.set_nearest_station(_current_station_id)
	var action_button := get_node_or_null("%StationActionButton") as Button
	if action_button != null:
		action_button.grab_focus()

func _on_pair_interaction_requested() -> void:
	var pair := _pair()
	if pair == null:
		return
	var nearest := _nearest_station_id(pair.position)
	if nearest.is_empty() or pair.position.distance_to(_station_position(nearest)) > NEAR_STATION_DISTANCE:
		return
	_set_current_station(nearest, true)
	station_requested.emit(nearest)

func _on_station_requested(station_id: String) -> void:
	_set_current_station(station_id, true)
	station_requested.emit(station_id)

func _on_station_action_pressed() -> void:
	station_requested.emit(_current_station_id)

func _on_direct_travel_selected(index: int) -> void:
	var menu := get_node_or_null("%DirectTravel") as OptionButton
	if menu == null or index < 0 or index >= menu.item_count:
		return
	direct_travel(String(menu.get_item_metadata(index)))

func _on_guide_pressed() -> void:
	guide_requested.emit()

func _show_handoff_dialog() -> void:
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
	panel.visible = true
	set_input_enabled(false)
	var pair := _pair()
	if pair != null:
		pair.set_modal_open(true)
	var active_button := get_node_or_null(
		"%StrategistHandoff" if _progress != null and _progress.active_role == "art-director" else "%ArtDirectorHandoff"
	) as Button
	if active_button != null:
		active_button.grab_focus()

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
	var action_button := get_node_or_null("%StationActionButton") as Button
	if action_button != null:
		action_button.grab_focus()

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

func _pair() -> AdMarketAgencyPair:
	return get_node_or_null("%AgencyPair") as AdMarketAgencyPair