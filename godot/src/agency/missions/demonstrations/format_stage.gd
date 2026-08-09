extends VBoxContainer
class_name AdMarketFormatStage

signal arrangement_submitted(result: Dictionary)

const Measure = preload("res://src/agency/missions/demonstrations/format_measure.gd")

const GOOD := Color("3a7d44")
const NEEDS_WORK := Color("a64b37")
const NUDGE_STEP := 0.25
const SCALE_DOWN := 0.9
const SCALE_UP := 1.1

@onready var _instruction: Label = $DemonstrationInstruction
@onready var _keyboard_hint: Label = $KeyboardHint
@onready var _format_buttons: HBoxContainer = $Selectors/FormatPanel/FormatColumn/FormatButtons
@onready var _headline_buttons: HBoxContainer = $Selectors/HeadlinePanel/HeadlineColumn/HeadlineButtons
@onready var _format_name: Label = $Workspace/FormatInfo/InfoColumn/FormatName
@onready var _viewing_condition: Label = $Workspace/FormatInfo/InfoColumn/ViewingCondition
@onready var _format_limit: Label = $Workspace/FormatInfo/InfoColumn/FormatLimit
@onready var _coverage_requirement: Label = $Workspace/FormatInfo/InfoColumn/CoverageRequirement
@onready var _frame_holder: Control = $Workspace/FrameHolder
@onready var _frame_surface: Panel = $Workspace/FrameHolder/FrameSurface
@onready var _subject_art: TextureRect = $Workspace/FrameHolder/FrameSurface/SubjectArt
@onready var _headline: Label = $Workspace/FrameHolder/FrameSurface/Headline
@onready var _smaller_button: Button = $CompositionControls/SmallerButton
@onready var _larger_button: Button = $CompositionControls/LargerButton
@onready var _left_button: Button = $CompositionControls/LeftButton
@onready var _up_button: Button = $CompositionControls/UpButton
@onready var _down_button: Button = $CompositionControls/DownButton
@onready var _right_button: Button = $CompositionControls/RightButton
@onready var _word_count_reading: Label = $ReadoutRow/WordCountReading
@onready var _coverage_reading: Label = $ReadoutRow/CoverageReading
@onready var _containment_reading: Label = $ReadoutRow/ContainmentReading
@onready var _feedback: Label = $DemonstrationFeedback
@onready var _reset_button: Button = $ActionsRow/ResetButton
@onready var _check_button: Button = $ActionsRow/CheckButton

var _record: Dictionary = {}
var _format_id: String = ""
var _headline_id: String = ""
var _subject_rect: Rect2 = Rect2()
var _frame_scale: float = 1.0
var _dragging_subject: bool = false
var _awaiting_completion_ack: bool = false
var _pending_final_result: Dictionary = {}

func _ready() -> void:
	_reset_button.pressed.connect(reset_composition)
	_check_button.pressed.connect(_on_check_pressed)
	_smaller_button.pressed.connect(scale_subject.bind(SCALE_DOWN))
	_larger_button.pressed.connect(scale_subject.bind(SCALE_UP))
	_left_button.pressed.connect(nudge_subject.bind(Vector2(-NUDGE_STEP, 0)))
	_up_button.pressed.connect(nudge_subject.bind(Vector2(0, -NUDGE_STEP)))
	_down_button.pressed.connect(nudge_subject.bind(Vector2(0, NUDGE_STEP)))
	_right_button.pressed.connect(nudge_subject.bind(Vector2(NUDGE_STEP, 0)))
	_subject_art.gui_input.connect(_on_subject_gui_input)
	_frame_holder.resized.connect(_refresh_frame)

func configure(record: Dictionary) -> void:
	_record = record.duplicate(true)
	_instruction.text = String(
		_record.get(
			"instruction",
			"Choose a format and adapt the headline and product scale to its viewing conditions."
		)
	)
	_keyboard_hint.text = "Drag the product, or focus it and use the arrow keys. The visible move and size buttons do the same work."
	var texture_path := String(_record.get("subjectArt", ""))
	if not texture_path.is_empty():
		var texture := load(texture_path) as Texture2D
		if texture != null:
			_subject_art.texture = texture
	_build_selectors()
	reset_composition()

func reset_composition() -> void:
	_format_id = String(_record.get("initialFormatId", ""))
	_headline_id = String(_record.get("initialHeadlineId", ""))
	var initial_rect: Variant = _record.get("initialSubjectRect", Rect2())
	_subject_rect = initial_rect if typeof(initial_rect) == TYPE_RECT2 else Rect2()
	_awaiting_completion_ack = false
	_pending_final_result.clear()
	_dragging_subject = false
	_check_button.disabled = false
	_check_button.text = "Check composition"
	_set_workspace_enabled(true)
	_refresh()

func current_result() -> Dictionary:
	var result: Dictionary = Measure.evaluate({
		"formats": Array(_record.get("formats", [])).duplicate(true),
		"headlines": Array(_record.get("headlines", [])).duplicate(true),
		"formatId": _format_id,
		"headlineId": _headline_id,
		"subjectRect": _subject_rect
	})
	result["reason"] = describe(result)
	return result

func focus_target() -> void:
	var first := _format_button(_format_id)
	if first != null:
		first.grab_focus()
	else:
		_check_button.grab_focus()

func show_error(message: String) -> void:
	_feedback.text = message

func select_format(format_id: String) -> void:
	if _awaiting_completion_ack or _find_format(format_id).is_empty():
		return
	_format_id = format_id
	_refresh()

func select_headline(headline_id: String) -> void:
	if _awaiting_completion_ack or _find_headline(headline_id).is_empty():
		return
	_headline_id = headline_id
	_refresh()

func set_subject_rect(subject_rect: Rect2) -> void:
	if _awaiting_completion_ack or subject_rect.size.x <= 0.0 or subject_rect.size.y <= 0.0:
		return
	_subject_rect = subject_rect
	_refresh()

func nudge_subject(delta: Vector2) -> void:
	if _awaiting_completion_ack:
		return
	_subject_rect.position += delta
	_refresh()

func scale_subject(factor: float) -> void:
	if _awaiting_completion_ack or factor <= 0.0:
		return
	var centre := _subject_rect.get_center()
	var new_size := _subject_rect.size * factor
	new_size.x = clampf(new_size.x, 0.5, 32.0)
	new_size.y = clampf(new_size.y, 0.5, 32.0)
	_subject_rect = Rect2(centre - new_size * 0.5, new_size)
	_refresh()

func describe(result: Dictionary) -> String:
	var format: Dictionary = result.get("format", {})
	var substitutions := {
		"format": String(format.get("label", "Selected format")),
		"condition": String(format.get("viewingCondition", "the stated viewing conditions")),
		"words": int(result.get("headlineWordCount", 0)),
		"max_words": int(result.get("maxWords", 0)),
		"coverage": roundi(float(result.get("coverage", 0.0)) * 100.0)
	}
	if bool(result.get("passed", false)):
		return String(
			_record.get("wonSentence", "The composition now fits its viewing conditions.")
		).format(substitutions)
	var unmet: PackedStringArray = result.get("unmet", PackedStringArray())
	if unmet.is_empty():
		return "This composition could not be measured."
	var sentences: Dictionary = _record.get("unmetSentences", {})
	return String(
		sentences.get(unmet[0], "Change one part of the composition, then check again.")
	).format(substitutions)

func _build_selectors() -> void:
	_clear_children(_format_buttons)
	_clear_children(_headline_buttons)
	for format_value: Variant in Array(_record.get("formats", [])):
		if typeof(format_value) != TYPE_DICTIONARY:
			continue
		var format: Dictionary = format_value
		var format_id := String(format.get("id", ""))
		var button := Button.new()
		button.name = "Format_%s" % _safe_id(format_id)
		button.text = String(format.get("label", format_id))
		button.custom_minimum_size = Vector2(126, 32)
		button.toggle_mode = true
		button.tooltip_text = String(format.get("viewingCondition", ""))
		button.pressed.connect(select_format.bind(format_id))
		_format_buttons.add_child(button)
	for headline_value: Variant in Array(_record.get("headlines", [])):
		if typeof(headline_value) != TYPE_DICTIONARY:
			continue
		var headline: Dictionary = headline_value
		var headline_id := String(headline.get("id", ""))
		var button := Button.new()
		button.name = "Headline_%s" % _safe_id(headline_id)
		button.text = "%s · %d words" % [
			headline_id.capitalize(),
			int(headline.get("wordCount", 0))
		]
		button.custom_minimum_size = Vector2(126, 32)
		button.toggle_mode = true
		button.tooltip_text = String(headline.get("text", ""))
		button.pressed.connect(select_headline.bind(headline_id))
		_headline_buttons.add_child(button)

func _refresh() -> void:
	var result := current_result()
	var format: Dictionary = result.get("format", {})
	var headline: Dictionary = result.get("headline", {})
	for node: Node in _format_buttons.get_children():
		var button := node as Button
		button.set_pressed_no_signal(button.name == "Format_%s" % _safe_id(_format_id))
	for node: Node in _headline_buttons.get_children():
		var button := node as Button
		button.set_pressed_no_signal(button.name == "Headline_%s" % _safe_id(_headline_id))
	_format_name.text = String(format.get("label", "FORMAT")).to_upper()
	_viewing_condition.text = String(format.get("viewingCondition", "Viewing condition unavailable."))
	_format_limit.text = "HEADLINE LIMIT\n%d words" % int(result.get("maxWords", 0))
	_coverage_requirement.text = "PRODUCT SCALE\nat least %d%% of frame" % roundi(
		float(result.get("minCoverage", 0.0)) * 100.0
	)
	_headline.text = String(headline.get("text", ""))
	var words := int(result.get("headlineWordCount", 0))
	var max_words := int(result.get("maxWords", 0))
	var coverage := float(result.get("coverage", 0.0))
	var min_coverage := float(result.get("minCoverage", 0.0))
	_word_count_reading.text = "WORDS\n%d / %d" % [words, max_words]
	_coverage_reading.text = "PRODUCT\n%d%% / %d%%" % [
		roundi(coverage * 100.0),
		roundi(min_coverage * 100.0)
	]
	_containment_reading.text = (
		"FRAME\nwhole product inside"
		if bool(result.get("contained", false))
		else "FRAME\nproduct cut off"
	)
	_set_reading_colour(_word_count_reading, _check_passed(result, Measure.CHECK_WORD_CAP))
	_set_reading_colour(_coverage_reading, _check_passed(result, Measure.CHECK_COVERAGE))
	_set_reading_colour(_containment_reading, _check_passed(result, Measure.CHECK_CONTAINMENT))
	_feedback.text = describe(result)
	_refresh_frame()

func _refresh_frame() -> void:
	if not is_instance_valid(_frame_holder) or not is_instance_valid(_frame_surface):
		return
	var format := _find_format(_format_id)
	var aspect: Vector2 = format.get("aspect", Vector2.ONE)
	if aspect.x <= 0.0 or aspect.y <= 0.0:
		return
	var available := _frame_holder.size - Vector2(16, 16)
	if available.x <= 0.0 or available.y <= 0.0:
		available = _frame_holder.custom_minimum_size - Vector2(16, 16)
	_frame_scale = minf(available.x / aspect.x, available.y / aspect.y)
	var frame_size := aspect * _frame_scale
	_frame_surface.position = (_frame_holder.size - frame_size) * 0.5
	_frame_surface.size = frame_size
	_subject_art.position = _subject_rect.position * _frame_scale
	_subject_art.size = _subject_rect.size * _frame_scale
	_subject_art.pivot_offset = _subject_art.size * 0.5
	_headline.position = Vector2(frame_size.x * 0.04, frame_size.y * 0.04)
	_headline.size = Vector2(frame_size.x * 0.58, maxf(frame_size.y * 0.30, 38.0))

func _on_subject_gui_input(event: InputEvent) -> void:
	if _awaiting_completion_ack:
		return
	if event is InputEventMouseButton:
		var mouse_button := event as InputEventMouseButton
		if mouse_button.button_index == MOUSE_BUTTON_LEFT:
			_dragging_subject = mouse_button.pressed
			if mouse_button.pressed:
				_subject_art.grab_focus()
			_subject_art.accept_event()
	elif event is InputEventMouseMotion and _dragging_subject and _frame_scale > 0.0:
		var motion := event as InputEventMouseMotion
		nudge_subject(motion.relative / _frame_scale)
		_subject_art.accept_event()
	elif event is InputEventKey:
		var key := event as InputEventKey
		if not key.pressed or key.echo:
			return
		var step := NUDGE_STEP * (2.0 if key.shift_pressed else 1.0)
		var delta := Vector2.ZERO
		match key.keycode:
			KEY_LEFT:
				delta = Vector2(-step, 0)
			KEY_RIGHT:
				delta = Vector2(step, 0)
			KEY_UP:
				delta = Vector2(0, -step)
			KEY_DOWN:
				delta = Vector2(0, step)
		if delta != Vector2.ZERO:
			nudge_subject(delta)
			_subject_art.accept_event()

func _on_check_pressed() -> void:
	if _awaiting_completion_ack:
		_awaiting_completion_ack = false
		_check_button.disabled = true
		var submitted := _pending_final_result.duplicate(true)
		_pending_final_result.clear()
		arrangement_submitted.emit(submitted)
		return
	var result := current_result()
	if not bool(result.get("passed", false)):
		_feedback.text = describe(result)
		return
	result["evidence"] = _evidence_sentence(result)
	result["reason"] = ""
	_feedback.text = describe(result)
	_pending_final_result = result.duplicate(true)
	_awaiting_completion_ack = true
	_check_button.text = "Finish task"
	_set_workspace_enabled(false)
	_check_button.grab_focus()

func _set_workspace_enabled(enabled: bool) -> void:
	for parent: Container in [_format_buttons, _headline_buttons]:
		for child: Node in parent.get_children():
			(child as Button).disabled = not enabled
	for button: Button in [
		_smaller_button,
		_larger_button,
		_left_button,
		_up_button,
		_down_button,
		_right_button
	]:
		button.disabled = not enabled
	_subject_art.mouse_filter = Control.MOUSE_FILTER_STOP if enabled else Control.MOUSE_FILTER_IGNORE
	_reset_button.disabled = not enabled

func _evidence_sentence(result: Dictionary) -> String:
	var format: Dictionary = result.get("format", {})
	return String(_record.get("evidenceSentence", "")).format({
		"format": String(format.get("label", "Selected format")),
		"condition": String(format.get("viewingCondition", "the stated viewing conditions")),
		"words": int(result.get("headlineWordCount", 0)),
		"max_words": int(result.get("maxWords", 0)),
		"coverage": roundi(float(result.get("coverage", 0.0)) * 100.0)
	})

func _check_passed(result: Dictionary, check: String) -> bool:
	var checks: Dictionary = result.get("checks", {})
	return bool(Dictionary(checks.get(check, {})).get("passed", false))

func _set_reading_colour(label: Label, passed: bool) -> void:
	label.add_theme_color_override("font_color", GOOD if passed else NEEDS_WORK)

func _find_format(format_id: String) -> Dictionary:
	for value: Variant in Array(_record.get("formats", [])):
		if typeof(value) == TYPE_DICTIONARY and String(Dictionary(value).get("id", "")) == format_id:
			return Dictionary(value)
	return {}

func _find_headline(headline_id: String) -> Dictionary:
	for value: Variant in Array(_record.get("headlines", [])):
		if typeof(value) == TYPE_DICTIONARY and String(Dictionary(value).get("id", "")) == headline_id:
			return Dictionary(value)
	return {}

func _format_button(format_id: String) -> Button:
	return _format_buttons.get_node_or_null("Format_%s" % _safe_id(format_id)) as Button

func _safe_id(id: String) -> String:
	return id.replace("-", "_").replace(" ", "_")

func _clear_children(parent: Node) -> void:
	for child: Node in parent.get_children():
		parent.remove_child(child)
		child.queue_free()
