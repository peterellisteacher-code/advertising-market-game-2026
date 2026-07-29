extends Control
class_name AdMarketAgencyGuideDrawer

signal direct_travel_requested(station_id: String)
signal role_handoff_requested(role: String)
signal audio_settings_requested
signal tucked_changed(tucked: bool)

const OVERALL_GOAL := "Create and pitch one persuasive advertisement for the audience in the client brief."
const SECTION_INDEX := {
	"goal": 0,
	"objective": 1,
	"controls": 2,
	"roles": 3,
	"progress": 4,
}
const ORIENTATION_STEPS := [
	{
		"title": "The campaign goal",
		"body": "Create one advertisement for the supplied audience, then pitch why its visual and message choices are likely to make that audience act.",
		"button": "Show movement controls",
	},
	{
		"title": "Movement and direct travel",
		"body": "Use WASD or the arrow keys to walk. Use the direct-travel menu when the pair needs a particular room immediately. Press E, Space or Enter to work at a nearby station.",
		"button": "Show the pair roles",
	},
	{
		"title": "The two pair roles",
		"body": "The Art Director leads visual decisions. The Strategist leads audience, message and offer decisions. Both partners use the same controls. Press H when control should pass to the other partner.",
		"button": "Start with the client brief",
	},
]

var _progress: AdMarketAgencyProgress
var _catalog: Variant
var _objective: Dictionary = {}
var _orientation_step: int = 0
var _tucked: bool = true
var _opener: Control

func _ready() -> void:
	_connect_controls()
	set_tucked(_tucked)

func configure(progress: AdMarketAgencyProgress, catalog: Variant) -> void:
	_progress = progress
	_catalog = catalog
	var objective: Dictionary = catalog.objective(progress.current_objective_id)
	show_objective(objective)
	set_progress(
		progress.completed_mission_ids.size(),
		catalog.required_missions().size(),
		progress.completed_sidequest_ids.size()
	)
	set_tucked(progress.guide_tucked)

func show_objective(objective: Dictionary) -> void:
	_objective = objective.duplicate(true)
	_set_label_text("%CurrentObjective", String(objective.get("title", "Current objective")))
	_set_label_text("%ObjectiveAction", "Action: %s" % String(objective.get("action", "Read the objective and choose the next useful station.")))
	_set_label_text("%ObjectiveReason", "Reason: %s" % String(objective.get("reason", "This decision supplies evidence for the next campaign choice.")))
	var owner_role := String(objective.get("ownerRole", "strategist"))
	_set_label_text("%ObjectiveOwner", "%s leads this decision." % _role_title(owner_role))
	_set_label_text(
		"%PartnerHoldingAction",
		"Partner holding action: %s" % String(objective.get("holdingAction", "Check that the decision still serves the audience."))
	)

func set_progress(required_done: int, required_total: int, optional_done: int) -> void:
	_set_label_text("%RequiredProgress", "%d of %d required missions complete" % [required_done, required_total])
	_set_label_text("%OptionalProgress", "%d optional contracts complete" % optional_done)
	var readiness := "Ready for the final pitch" if required_total > 0 and required_done >= required_total else "Final pitch unlocks after every required mission"
	_set_label_text("%PitchReadiness", readiness)

func open_guide(section: String = "objective") -> void:
	var guide_tab := get_node_or_null("%GuideTab") as Control
	if guide_tab != null and guide_tab.has_focus():
		_opener = guide_tab
	set_tucked(false)
	var tabs := get_node_or_null("%GuideTabs") as TabContainer
	if tabs != null:
		var target_tab := int(SECTION_INDEX.get(section, SECTION_INDEX["objective"]))
		_stabilise_guide_layout(tabs, target_tab)
		if tabs.is_inside_tree():
			tabs.grab_focus()

func set_tucked(tucked: bool) -> void:
	_tucked = tucked
	if _progress != null:
		_progress.guide_tucked = tucked
	var guide_tab := get_node_or_null("%GuideTab") as Control
	var guide_panel := get_node_or_null("%GuidePanel") as Control
	if guide_tab != null:
		guide_tab.visible = tucked
	if guide_panel != null:
		guide_panel.visible = not tucked
	if tucked:
		var focus_target := _opener if is_instance_valid(_opener) and _opener.visible else guide_tab
		if focus_target != null and focus_target.is_inside_tree():
			focus_target.grab_focus()
	tucked_changed.emit(tucked)

func go_to_objective() -> void:
	var station_id := String(_objective.get("stationId", ""))
	if station_id.is_empty():
		return
	set_tucked(true)
	direct_travel_requested.emit(station_id)

func orientation_required() -> bool:
	return _progress != null and not _progress.orientation_acknowledged

func open_orientation() -> void:
	if not orientation_required():
		return
	_orientation_step = 0
	var panel := get_node_or_null("%OrientationPanel") as Control
	var guide_tab := get_node_or_null("%GuideTab") as Control
	var guide_panel := get_node_or_null("%GuidePanel") as Control
	if panel != null:
		panel.visible = true
	if guide_tab != null:
		guide_tab.visible = false
	if guide_panel != null:
		guide_panel.visible = false
	_update_orientation()
	if panel != null:
		panel.reset_size()

func advance_orientation() -> void:
	if not orientation_required():
		return
	_orientation_step += 1
	if _orientation_step >= ORIENTATION_STEPS.size():
		_progress.orientation_acknowledged = true
		var panel := get_node_or_null("%OrientationPanel") as Control
		if panel != null:
			panel.visible = false
		open_guide("objective")
		return
	_update_orientation()

func _stabilise_guide_layout(tabs: TabContainer, target_tab: int) -> void:
	for tab_index in range(tabs.get_tab_count()):
		tabs.current_tab = tab_index
	tabs.current_tab = clampi(target_tab, 0, maxi(0, tabs.get_tab_count() - 1))
	var panel := get_node_or_null("%GuidePanel") as Control
	if panel != null:
		panel.reset_size()

func _connect_controls() -> void:
	_connect_button("%GuideTab", _on_guide_tab_pressed)
	_connect_button("%CloseGuide", _on_close_guide_pressed)
	_connect_button("%GoToObjective", _on_go_to_objective_pressed)
	_connect_button("%OrientationNext", _on_orientation_next_pressed)
	_connect_button("%ArtDirectorControl", _on_art_director_pressed)
	_connect_button("%StrategistControl", _on_strategist_pressed)
	_connect_button("%AudioSettings", _on_audio_settings_pressed)

func _connect_button(path: String, callback: Callable) -> void:
	var button := get_node_or_null(path) as Button
	if button != null and not button.pressed.is_connected(callback):
		button.pressed.connect(callback)

func _update_orientation() -> void:
	var step: Dictionary = ORIENTATION_STEPS[_orientation_step]
	_set_label_text("%OrientationStep", "Orientation %d of %d" % [_orientation_step + 1, ORIENTATION_STEPS.size()])
	_set_label_text("%OrientationTitle", String(step.get("title", "Agency orientation")))
	_set_label_text("%OrientationBody", String(step.get("body", "")))
	var next_button := get_node_or_null("%OrientationNext") as Button
	if next_button != null:
		next_button.text = String(step.get("button", "Continue"))
		if next_button.is_inside_tree():
			next_button.grab_focus()

func _set_label_text(path: String, value: String) -> void:
	var label := get_node_or_null(path) as Label
	if label != null:
		label.text = value

func _role_title(role: String) -> String:
	return "Art Director" if role == "art-director" else "Strategist"

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		var orientation := get_node_or_null("%OrientationPanel") as Control
		if orientation != null and orientation.visible:
			get_viewport().set_input_as_handled()
			return
		var panel := get_node_or_null("%GuidePanel") as Control
		if panel != null and panel.visible:
			set_tucked(true)
			get_viewport().set_input_as_handled()

func _on_guide_tab_pressed() -> void:
	open_guide("objective")

func _on_close_guide_pressed() -> void:
	set_tucked(true)

func _on_go_to_objective_pressed() -> void:
	go_to_objective()

func _on_orientation_next_pressed() -> void:
	advance_orientation()

func _on_art_director_pressed() -> void:
	role_handoff_requested.emit("art-director")

func _on_strategist_pressed() -> void:
	role_handoff_requested.emit("strategist")

func _on_audio_settings_pressed() -> void:
	audio_settings_requested.emit()