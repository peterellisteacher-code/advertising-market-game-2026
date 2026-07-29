extends PanelContainer
class_name AdMarketAgencyHud

signal direct_travel_requested(station_id: String)
signal guide_requested(section: String)

const OVERALL_GOAL := "Create and pitch a persuasive advertisement for the client audience."

var _objective: Dictionary = {}
var _station_ids: Array[String] = []
var _guide_tucked: bool = true

func _ready() -> void:
	_set_label_text("HudMargin/HudRow/GoalBlock/HudGoal", OVERALL_GOAL)
	_connect_controls()

func show_objective(objective: Dictionary) -> void:
	_objective = objective.duplicate(true)
	_set_label_text("HudMargin/HudRow/ObjectiveBlock/HudObjective", String(objective.get("title", "Current objective")))
	var owner_role := String(objective.get("ownerRole", "strategist"))
	_set_label_text("HudMargin/HudRow/ObjectiveBlock/HudOwner", "%s leads" % ("Art Director" if owner_role == "art-director" else "Strategist"))

func set_progress(required_done: int, required_total: int, optional_done: int) -> void:
	_set_label_text("HudMargin/HudRow/ProgressBlock/HudProgress", "%d of %d required · %d optional" % [required_done, required_total, optional_done])

func configure_stations(records: Array[Dictionary], selected_station_id: String = "") -> void:
	var menu := get_node_or_null("HudMargin/HudRow/TravelBlock/HudDirectTravel") as OptionButton
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
	var menu := get_node_or_null("HudMargin/HudRow/TravelBlock/HudDirectTravel") as OptionButton
	var index := _station_ids.find(station_id)
	if menu != null and index >= 0:
		menu.select(index)

func open_guide(section: String = "objective") -> void:
	guide_requested.emit(section)

func set_tucked(tucked: bool) -> void:
	_guide_tucked = tucked
	var button := get_node_or_null("HudMargin/HudRow/HudGuideButton") as Button
	if button != null:
		button.text = "Open guide · G" if tucked else "Guide open"

func go_to_objective() -> void:
	var station_id := String(_objective.get("stationId", ""))
	if not station_id.is_empty():
		direct_travel_requested.emit(station_id)

func _connect_controls() -> void:
	var guide_button := get_node_or_null("HudMargin/HudRow/HudGuideButton") as Button
	if guide_button != null and not guide_button.pressed.is_connected(_on_guide_pressed):
		guide_button.pressed.connect(_on_guide_pressed)
	var objective_button := get_node_or_null("HudMargin/HudRow/HudGoToObjective") as Button
	if objective_button != null and not objective_button.pressed.is_connected(_on_objective_pressed):
		objective_button.pressed.connect(_on_objective_pressed)
	var travel_menu := get_node_or_null("HudMargin/HudRow/TravelBlock/HudDirectTravel") as OptionButton
	if travel_menu != null and not travel_menu.item_selected.is_connected(_on_direct_travel_selected):
		travel_menu.item_selected.connect(_on_direct_travel_selected)

func _set_label_text(path: String, value: String) -> void:
	var label := get_node_or_null(path) as Label
	if is_instance_valid(label):
		label.text = value

func _on_guide_pressed() -> void:
	open_guide("objective")

func _on_objective_pressed() -> void:
	go_to_objective()

func _on_direct_travel_selected(index: int) -> void:
	var menu := get_node_or_null("HudMargin/HudRow/TravelBlock/HudDirectTravel") as OptionButton
	if menu == null or index < 0 or index >= menu.item_count:
		return
	direct_travel_requested.emit(String(menu.get_item_metadata(index)))