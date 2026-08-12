extends PanelContainer
class_name AdMarketAgencyHud

signal direct_travel_requested(station_id: String)
signal objective_task_requested(station_id: String)
signal guide_requested(section: String)
signal sound_muted_requested(muted: bool)

const OVERALL_GOAL := "Create and pitch a persuasive advertisement for the client audience."

var _objective: Dictionary = {}
var _station_ids: Array[String] = []
var _guide_tucked: bool = true
var _sound_muted: bool = false
var _compact: bool = true

func _ready() -> void:
	_set_label_text("HudMargin/HudStack/ExpandedDetails/GoalBlock/HudGoal", OVERALL_GOAL)
	_connect_controls()
	set_compact(true)

func show_objective(objective: Dictionary) -> void:
	_objective = objective.duplicate(true)
	_set_label_text("HudMargin/HudStack/PrimaryRow/ObjectiveBlock/HudObjective", String(objective.get("title", "Next task")))
	_set_label_text("HudMargin/HudStack/PrimaryRow/ObjectiveBlock/HudOwner", "Decide together")

func set_progress(required_done: int, required_total: int, optional_done: int) -> void:
	_set_label_text("HudMargin/HudStack/ExpandedDetails/ProgressBlock/HudProgress", "%d of %d required · %d optional" % [required_done, required_total, optional_done])

func configure_stations(records: Array[Dictionary], selected_station_id: String = "") -> void:
	var menu := get_node_or_null("HudMargin/HudStack/ExpandedDetails/TravelBlock/HudDirectTravel") as OptionButton
	_station_ids.clear()
	if menu == null:
		return
	menu.clear()
	for record in records:
		var station_id := String(record.get("id", ""))
		if station_id.is_empty():
			continue
		_station_ids.append(station_id)
		menu.add_item(String(record.get("title", station_id.capitalize())))
		menu.set_item_metadata(menu.item_count - 1, station_id)
	select_station(selected_station_id)

func select_station(station_id: String) -> void:
	var menu := get_node_or_null("HudMargin/HudStack/ExpandedDetails/TravelBlock/HudDirectTravel") as OptionButton
	var index := _station_ids.find(station_id)
	if menu != null and index >= 0:
		menu.select(index)

func open_guide(section: String = "objective") -> void:
	guide_requested.emit(section)

func set_tucked(tucked: bool) -> void:
	_guide_tucked = tucked
	var button := get_node_or_null("HudMargin/HudStack/PrimaryRow/HudGuideButton") as Button
	if button != null:
		button.text = "Guide · G" if tucked else "Guide open"

func set_compact(compact: bool) -> void:
	_compact = compact
	var details := get_node_or_null("HudMargin/HudStack/ExpandedDetails") as Control
	if details != null:
		details.visible = not compact
	for path in [
		"HudMargin/HudStack/PrimaryRow/ObjectiveBlock/ObjectiveEyebrow",
		"HudMargin/HudStack/PrimaryRow/ObjectiveBlock/HudOwner",
	]:
		var secondary_label := get_node_or_null(path) as Control
		if secondary_label != null:
			secondary_label.visible = not compact
	var margin := get_node_or_null("HudMargin") as MarginContainer
	var vertical_margin := 8 if compact else 12
	if margin != null:
		margin.add_theme_constant_override("margin_top", vertical_margin)
		margin.add_theme_constant_override("margin_bottom", vertical_margin)
	var target_height := 84.0 if compact else 164.0
	# Width comes from the anchors so the bar spans whatever viewport the stretch mode
	# hands it. Only the height is this panel's to set.
	custom_minimum_size.y = target_height
	# The height is applied through the bottom offset rather than through size, because
	# the left and right anchors differ and writing size warns about that. Vertically the
	# anchors are equal, so the offset is what actually carries the height, and it lands
	# in the same frame the caller asks for it.
	offset_bottom = offset_top + target_height
	var button := get_node_or_null("HudMargin/HudStack/PrimaryRow/HudTuckToggle") as Button
	if button != null:
		button.text = "Work details" if compact else "Hide details"
		button.tooltip_text = "Show work details" if compact else "Hide work details"

func is_compact() -> bool:
	return _compact

func layout_contract(viewport: Vector2) -> Dictionary:
	var safe_height := maxf(viewport.y, 1.0)
	var compact_height := 84.0
	var expanded_height := 164.0
	return {
		"compactHeight": compact_height,
		"expandedHeight": expanded_height,
		"floorShare": maxf(0.0, (safe_height - compact_height) / safe_height),
		"directCampaignAction": get_node_or_null("%HudGoToObjective") != null,
		"optionalPracticeLabelled": true,
	}

func set_sound_muted(muted: bool) -> void:
	_sound_muted = muted
	var button := get_node_or_null("HudMargin/HudStack/ExpandedDetails/HudSoundToggle") as Button
	if button != null:
		button.text = "Turn sound on" if muted else "Mute sound"
		button.tooltip_text = "Turn advertisement sound on" if muted else "Mute advertisement sound"

func go_to_objective() -> void:
	var station_id := String(_objective.get("stationId", ""))
	if not station_id.is_empty():
		objective_task_requested.emit(station_id)

func _connect_controls() -> void:
	var guide_button := get_node_or_null("HudMargin/HudStack/PrimaryRow/HudGuideButton") as Button
	if guide_button != null and not guide_button.pressed.is_connected(_on_guide_pressed):
		guide_button.pressed.connect(_on_guide_pressed)
	var objective_button := get_node_or_null("HudMargin/HudStack/PrimaryRow/HudGoToObjective") as Button
	if objective_button != null and not objective_button.pressed.is_connected(_on_objective_pressed):
		objective_button.pressed.connect(_on_objective_pressed)
	var travel_menu := get_node_or_null("HudMargin/HudStack/ExpandedDetails/TravelBlock/HudDirectTravel") as OptionButton
	if travel_menu != null and not travel_menu.item_selected.is_connected(_on_direct_travel_selected):
		travel_menu.item_selected.connect(_on_direct_travel_selected)
	var sound_button := get_node_or_null("HudMargin/HudStack/ExpandedDetails/HudSoundToggle") as Button
	if sound_button != null and not sound_button.pressed.is_connected(_on_sound_pressed):
		sound_button.pressed.connect(_on_sound_pressed)
	var tuck_button := get_node_or_null("HudMargin/HudStack/PrimaryRow/HudTuckToggle") as Button
	if tuck_button != null and not tuck_button.pressed.is_connected(_on_tuck_pressed):
		tuck_button.pressed.connect(_on_tuck_pressed)

func _set_label_text(path: String, value: String) -> void:
	var label := get_node_or_null(path) as Label
	if is_instance_valid(label):
		label.text = value

func _on_guide_pressed() -> void:
	open_guide("objective")

func _on_objective_pressed() -> void:
	go_to_objective()

func _on_sound_pressed() -> void:
	set_sound_muted(not _sound_muted)
	sound_muted_requested.emit(_sound_muted)

func _on_tuck_pressed() -> void:
	set_compact(not _compact)

func _on_direct_travel_selected(index: int) -> void:
	var menu := get_node_or_null("HudMargin/HudStack/ExpandedDetails/TravelBlock/HudDirectTravel") as OptionButton
	if menu == null or index < 0 or index >= menu.item_count:
		return
	direct_travel_requested.emit(String(menu.get_item_metadata(index)))
