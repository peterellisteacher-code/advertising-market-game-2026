extends Control
class_name AdMarketAgencyGuideDrawer

signal direct_travel_requested(station_id: String)
signal role_handoff_requested(role: String)
signal audio_settings_requested
signal audio_settings_changed(settings: Dictionary)
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
		"title": "Your goal: win the client pitch",
		"body": (
			"1. Read the client brief.\n"
			+ "2. Build one advertisement for that audience.\n"
			+ "3. Complete the required practice missions.\n"
			+ "4. Pitch the finished advertisement and explain why it should persuade the audience.\n\n"
			+ "The pitch unlocks only after every required mission is complete. At the pitch, you will see your own advertisement in three display formats and receive a client response. Optional contracts add portfolio stamps; they never block completion. The market can award Gold, Silver and Bronze medals."
		),
		"button": "Next: learn the controls",
	},
	{
		"title": "How to reach each task",
		"body": (
			"Walk: WASD or arrow keys.\n"
			+ "Use a nearby station: E, Space or Enter.\n"
			+ "Go straight to a task: choose its room from Direct travel.\n\n"
			+ "Start at Client Brief. It tells you who the advertisement must persuade."
		),
		"button": "Next: understand the roles",
	},
	{
		"title": "How the pair roles differ",
		"body": (
			"Strategist: leads choices about the audience, message, evidence, offer and call to action. "
			+ "This partner explains why the advertisement should persuade the audience.\n\n"
			+ "Art Director: leads choices about layout, colour, type, images and visual emphasis. "
			+ "This partner explains where the audience will look first and why.\n\n"
			+ "Both partners can use every control and station. The roles divide responsibility; "
			+ "they do not unlock different tools. Press H whenever the other partner takes the lead."
		),
		"button": "Go to Client Brief",
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
	_sync_audio_settings(progress.audio_settings)

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
		if tabs.is_inside_tree():
			tabs.grab_focus()
		_stabilise_guide_layout(tabs, target_tab)

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
	var layer := get_node_or_null("%OrientationLayer") as Control
	var panel := get_node_or_null("%OrientationPanel") as Control
	var guide_tab := get_node_or_null("%GuideTab") as Control
	var guide_panel := get_node_or_null("%GuidePanel") as Control
	if layer != null:
		layer.visible = true
	if panel != null:
		panel.visible = true
	if guide_tab != null:
		guide_tab.visible = false
	if guide_panel != null:
		guide_panel.visible = false
	_update_orientation()
	if panel != null:
		panel.reset_size()

func reading_active() -> bool:
	var guide_panel := get_node_or_null("%GuidePanel") as Control
	var orientation_panel := get_node_or_null("%OrientationPanel") as Control
	return (
		(guide_panel != null and guide_panel.visible)
		or (orientation_panel != null and orientation_panel.visible)
	)

func advance_orientation() -> void:
	if not orientation_required():
		return
	_orientation_step += 1
	if _orientation_step >= ORIENTATION_STEPS.size():
		_progress.orientation_acknowledged = true
		var layer := get_node_or_null("%OrientationLayer") as Control
		var panel := get_node_or_null("%OrientationPanel") as Control
		if layer != null:
			layer.visible = false
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
	_connect_audio_controls()

func _connect_button(path: String, callback: Callable) -> void:
	var button := get_node_or_null(path) as Button
	if button != null and not button.pressed.is_connected(callback):
		button.pressed.connect(callback)

func _connect_audio_controls() -> void:
	var audio_enabled := get_node_or_null("%AudioEnabled") as CheckButton
	var music_enabled := get_node_or_null("%MusicEnabled") as CheckButton
	var sfx_enabled := get_node_or_null("%SfxEnabled") as CheckButton
	var master_volume := get_node_or_null("%MasterVolume") as HSlider
	if audio_enabled != null and not audio_enabled.toggled.is_connected(_on_audio_setting_changed):
		audio_enabled.toggled.connect(_on_audio_setting_changed)
	if music_enabled != null and not music_enabled.toggled.is_connected(_on_audio_setting_changed):
		music_enabled.toggled.connect(_on_audio_setting_changed)
	if sfx_enabled != null and not sfx_enabled.toggled.is_connected(_on_audio_setting_changed):
		sfx_enabled.toggled.connect(_on_audio_setting_changed)
	if master_volume != null and not master_volume.value_changed.is_connected(_on_audio_setting_changed):
		master_volume.value_changed.connect(_on_audio_setting_changed)

func _sync_audio_settings(settings: Dictionary) -> void:
	var audio_enabled := get_node_or_null("%AudioEnabled") as CheckButton
	var music_enabled := get_node_or_null("%MusicEnabled") as CheckButton
	var sfx_enabled := get_node_or_null("%SfxEnabled") as CheckButton
	var master_volume := get_node_or_null("%MasterVolume") as HSlider
	if audio_enabled != null:
		audio_enabled.set_pressed_no_signal(bool(settings.get("enabled", true)))
	if music_enabled != null:
		music_enabled.set_pressed_no_signal(bool(settings.get("musicEnabled", true)))
	if sfx_enabled != null:
		sfx_enabled.set_pressed_no_signal(bool(settings.get("sfxEnabled", true)))
	if master_volume != null:
		master_volume.set_value_no_signal(float(settings.get("masterVolume", 0.7)))
	_update_audio_control_state()

func _audio_settings_from_controls() -> Dictionary:
	var audio_enabled := get_node_or_null("%AudioEnabled") as CheckButton
	var music_enabled := get_node_or_null("%MusicEnabled") as CheckButton
	var sfx_enabled := get_node_or_null("%SfxEnabled") as CheckButton
	var master_volume := get_node_or_null("%MasterVolume") as HSlider
	return {
		"enabled": audio_enabled == null or audio_enabled.button_pressed,
		"musicEnabled": music_enabled == null or music_enabled.button_pressed,
		"sfxEnabled": sfx_enabled == null or sfx_enabled.button_pressed,
		"masterVolume": 0.7 if master_volume == null else master_volume.value,
	}

func _update_audio_control_state() -> void:
	var settings := _audio_settings_from_controls()
	var audio_enabled := bool(settings.get("enabled", true))
	var music_control := get_node_or_null("%MusicEnabled") as CheckButton
	var sfx_control := get_node_or_null("%SfxEnabled") as CheckButton
	var volume_control := get_node_or_null("%MasterVolume") as HSlider
	if music_control != null:
		music_control.disabled = not audio_enabled
	if sfx_control != null:
		sfx_control.disabled = not audio_enabled
	if volume_control != null:
		volume_control.editable = audio_enabled
	_set_label_text(
		"%MasterVolumeLabel",
		"Overall volume: %d%%" % roundi(float(settings.get("masterVolume", 0.7)) * 100.0)
	)

func _on_audio_setting_changed(_value: Variant) -> void:
	var settings := _audio_settings_from_controls()
	if _progress != null:
		_progress.audio_settings = settings.duplicate(true)
	_update_audio_control_state()
	audio_settings_changed.emit(settings)

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
	var panel := get_node_or_null("%AudioSettingsPanel") as Control
	if panel != null:
		panel.visible = not panel.visible
	var button := get_node_or_null("%AudioSettings") as Button
	if button != null and panel != null:
		button.text = "Close sound settings" if panel.visible else "Sound settings"
	audio_settings_requested.emit()