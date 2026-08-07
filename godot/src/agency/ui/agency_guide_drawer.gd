extends Control
class_name AdMarketAgencyGuideDrawer

signal direct_travel_requested(station_id: String)
signal role_handoff_requested(role: String)
signal audio_settings_requested
signal audio_settings_changed(settings: Dictionary)
signal tucked_changed(tucked: bool)
signal reading_state_changed(active: bool)

const OVERALL_GOAL := "Create and pitch one persuasive advertisement for the audience in the client brief."
const SECTION_INDEX := {
	"goal": 0,
	"objective": 1,
	"controls": 2,
	"roles": 3,
	"progress": 4,
}
const ORIENTATION_ITEM_SUFFIXES: Array[String] = ["One", "Two", "Three"]
# The panel is anchored to the full viewport rather than centred at a fixed size, so
# resuming the quick start insets it by this margin instead of restoring a half-size.
const ORIENTATION_PANEL_MARGIN := Vector2(48.0, 48.0)
const ORIENTATION_CONTENT_MAX_WIDTH := 1120.0
const ORIENTATION_CONTENT_MIN_INSET := 32.0
const ORIENTATION_STEPS := [
	{
		"overview": true,
		"title": "You and your partner will make and pitch one ad.",
		"action": "Read the brief. Complete seven short tasks. Build one ad. Pitch it.",
		"items": [
			{
				"label": "MAKE",
				"text": "Make an ad that gives the audience a clear reason to act.",
			},
			{
				"label": "PRACTISE",
				"text": "Practise choosing advertising techniques and explaining their effect.",
			},
			{
				"label": "EARN",
				"text": "Each required task prepares the ad for the final pitch.",
			},
		],
		"button": "How do we start?",
	},
	{
		"title": "Move to the first task",
		"action": "Go to Client Briefing, then open the first task.",
		"items": [
			{
				"label": "MOVE",
				"text": "Use WASD or arrow keys.",
			},
			{
				"label": "USE A ROOM",
				"text": "Walk near a room, then click Start task. E, Space or Enter also works.",
			},
			{
				"label": "TRACKPAD",
				"text": "You can click every menu, button and answer.",
			},
		],
		"button": "Who leads each choice?",
	},
	{
		"title": "Share the decisions",
		"action": "The lead role makes the first recommendation. Both partners discuss the decision.",
		"items": [
			{
				"label": "STRATEGIST",
				"text": "Leads choices about the audience, message, evidence and offer.",
			},
			{
				"label": "ART DIRECTOR",
				"text": "Leads choices about layout, colour, type and image.",
			},
			{
				"label": "BOTH PARTNERS",
				"text": "Have the same controls and access. The roles divide responsibility, not permissions.",
			},
		],
		"button": "Why complete each task?",
	},
	{
		"title": "Begin the work",
		"action": "Start at Client Briefing. Every required task moves your ad towards the final pitch.",
		"items": [
			{
				"label": "READ",
				"text": "Read the audience brief before making ad choices.",
			},
			{
				"label": "BUILD",
				"text": "Apply each completed task when you create the ad.",
			},
			{
				"label": "PITCH",
				"text": "Explain how your choices persuade the client audience.",
			},
		],
		"button": "Go to Client Briefing",
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
	_set_label_text("%CurrentObjective", String(objective.get("title", "Next task")))
	_set_label_text("%ObjectiveAction", "Action: %s" % String(objective.get("action", "Read the task and choose the next useful room.")))
	_set_label_text("%ObjectiveReason", "Reason: %s" % String(objective.get("reason", "This decision supplies evidence for the next advertisement choice.")))
	var owner_role := String(objective.get("ownerRole", "strategist"))
	_set_label_text("%ObjectiveOwner", "%s leads this decision." % _role_title(owner_role))
	_set_label_text(
		"%PartnerHoldingAction",
		"Partner holding action: %s" % String(objective.get("holdingAction", "Check that the decision still serves the audience."))
	)

func set_progress(required_done: int, required_total: int, optional_done: int) -> void:
	_set_label_text("%RequiredProgress", "%d of %d required tasks complete" % [required_done, required_total])
	_set_label_text("%OptionalProgress", "%d optional practice activities complete" % optional_done)
	var readiness := "Ready for the final pitch" if required_total > 0 and required_done >= required_total else "Final pitch unlocks after every required task"
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
	_update_resume_orientation()
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
	resume_orientation()

func minimise_orientation() -> void:
	if not orientation_required():
		return
	set_tucked(true)
	_set_orientation_visible(false)
	_update_resume_orientation()
	reading_state_changed.emit(false)
	var resume_button := get_node_or_null("%ResumeOrientation") as Button
	if resume_button != null and resume_button.is_inside_tree():
		resume_button.grab_focus()

func resume_orientation() -> void:
	if not orientation_required():
		return
	var guide_tab := get_node_or_null("%GuideTab") as Control
	var guide_panel := get_node_or_null("%GuidePanel") as Control
	if guide_tab != null:
		guide_tab.visible = false
	if guide_panel != null:
		guide_panel.visible = false
	_set_orientation_visible(true)
	_update_resume_orientation()
	_update_orientation()
	var panel := get_node_or_null("%OrientationPanel") as Control
	if panel != null:
		panel.offset_left = ORIENTATION_PANEL_MARGIN.x
		panel.offset_top = ORIENTATION_PANEL_MARGIN.y
		panel.offset_right = -ORIENTATION_PANEL_MARGIN.x
		panel.offset_bottom = -ORIENTATION_PANEL_MARGIN.y
	reading_state_changed.emit(true)

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
		_set_orientation_visible(false)
		set_tucked(true)
		_update_resume_orientation()
		reading_state_changed.emit(false)
		direct_travel_requested.emit("client-briefing")
		return
	_update_orientation()

func previous_orientation() -> void:
	if not orientation_required():
		return
	_orientation_step = maxi(0, _orientation_step - 1)
	_update_orientation()

func _set_orientation_visible(is_visible: bool) -> void:
	var layer := get_node_or_null("%OrientationLayer") as Control
	var panel := get_node_or_null("%OrientationPanel") as Control
	if layer != null:
		layer.visible = is_visible
	if panel != null:
		panel.visible = is_visible
		if is_visible:
			if not panel.resized.is_connected(_update_orientation_content_width):
				panel.resized.connect(_update_orientation_content_width)
			_update_orientation_content_width()

func _update_orientation_content_width() -> void:
	# The card spans the screen so no game shows beside it, but a line of text that wide
	# stops being readable. The content column keeps its own width and the card centres
	# it, which is what the extra space on a wide monitor is for.
	var panel := get_node_or_null("%OrientationPanel") as Control
	var margin := get_node_or_null("%OrientationMargin") as MarginContainer
	if panel == null or margin == null:
		return
	var side := maxf(
		ORIENTATION_CONTENT_MIN_INSET,
		floorf((panel.size.x - ORIENTATION_CONTENT_MAX_WIDTH) * 0.5)
	)
	margin.add_theme_constant_override("margin_left", int(side))
	margin.add_theme_constant_override("margin_right", int(side))

func _update_resume_orientation() -> void:
	var resume_button := get_node_or_null("%ResumeOrientation") as Button
	var orientation_panel := get_node_or_null("%OrientationPanel") as Control
	var orientation_visible := orientation_panel != null and orientation_panel.visible
	if resume_button != null:
		resume_button.text = "Continue quick start"
		resume_button.visible = orientation_required() and _tucked and not orientation_visible

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
	_connect_button("%OrientationPrevious", _on_orientation_previous_pressed)
	_connect_button("%OrientationNext", _on_orientation_next_pressed)
	_connect_button("%MinimiseOrientation", _on_minimise_orientation_pressed)
	_connect_button("%ResumeOrientation", _on_resume_orientation_pressed)
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
		"Overall volume: " + str(roundi(float(settings.get("masterVolume", 0.7)) * 100.0)) + "%"
	)

func _on_audio_setting_changed(_value: Variant) -> void:
	var settings := _audio_settings_from_controls()
	if _progress != null:
		_progress.audio_settings = settings.duplicate(true)
	_update_audio_control_state()
	audio_settings_changed.emit(settings)

func _update_orientation() -> void:
	var step: Dictionary = ORIENTATION_STEPS[_orientation_step]
	_set_label_text("%OrientationStep", "Quick start %d of %d" % [_orientation_step + 1, ORIENTATION_STEPS.size()])
	_set_label_text("%OrientationTitle", String(step.get("title", "Quick start")))
	_set_label_text("%OrientationAction", String(step.get("action", "Choose the next action.")))
	var overview := get_node_or_null("%OrientationOverview") as Control
	if overview != null:
		overview.visible = bool(step.get("overview", false))
	var items: Array = step.get("items", [])
	for item_index in ORIENTATION_ITEM_SUFFIXES.size():
		var suffix := ORIENTATION_ITEM_SUFFIXES[item_index]
		var row := get_node_or_null("%OrientationItem" + suffix) as Control
		var item: Dictionary = items[item_index] if item_index < items.size() else {}
		if row != null:
			row.visible = not item.is_empty()
		_set_label_text("%OrientationItem" + suffix + "Label", String(item.get("label", "")))
		_set_label_text("%OrientationItem" + suffix + "Text", String(item.get("text", "")))
	var next_button := get_node_or_null("%OrientationNext") as Button
	var previous_button := get_node_or_null("%OrientationPrevious") as Button
	if previous_button != null:
		previous_button.visible = _orientation_step > 0
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
			minimise_orientation()
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

func _on_orientation_previous_pressed() -> void:
	previous_orientation()

func _on_minimise_orientation_pressed() -> void:
	minimise_orientation()

func _on_resume_orientation_pressed() -> void:
	resume_orientation()

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
