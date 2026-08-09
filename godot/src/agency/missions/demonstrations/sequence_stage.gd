extends VBoxContainer
class_name AdMarketSequenceStage

signal arrangement_submitted(result: Dictionary)

const Measure = preload("res://src/agency/missions/demonstrations/sequence_measure.gd")

const GOOD := Color("3a7d44")
const NEEDS_WORK := Color("a64b37")

@onready var _instruction: Label = $DemonstrationInstruction
@onready var _keyboard_hint: Label = $KeyboardHint
@onready var _heading: Label = $Workspace/SequencePanel/SequenceColumn/SequenceHeading
@onready var _card_grid: GridContainer = $Workspace/SequencePanel/SequenceColumn/CardSurface/CardGrid
@onready var _reading_path: Line2D = $Workspace/SequencePanel/SequenceColumn/CardSurface/ReadingPath
@onready var _move_left: Button = $MoveRow/MoveLeftButton
@onready var _move_right: Button = $MoveRow/MoveRightButton
@onready var _selected_reading: Label = $MoveRow/SelectedReading
@onready var _order_reading: Label = $ReadoutRow/OrderReading
@onready var _constraint_reading: Label = $ReadoutRow/ConstraintReading
@onready var _feedback: Label = $DemonstrationFeedback
@onready var _reset_button: Button = $ActionsRow/ResetButton
@onready var _check_button: Button = $ActionsRow/CheckButton

var _record: Dictionary = {}
var _order: PackedStringArray = PackedStringArray()
var _selected_card: String = ""
var _drag_card: String = ""
var _awaiting_completion_ack: bool = false
var _pending_final_result: Dictionary = {}

func _ready() -> void:
	_move_left.pressed.connect(_move_selected.bind(-1))
	_move_right.pressed.connect(_move_selected.bind(1))
	_reset_button.pressed.connect(reset_sequence)
	_check_button.pressed.connect(_on_check_pressed)

func configure(record: Dictionary) -> void:
	_record = record.duplicate(true)
	_instruction.text = String(
		_record.get("instruction", "Put the cards in an order that satisfies every required step.")
	)
	_keyboard_hint.text = "Drag one card over another, or select a card and use Move left, Move right, or the Left and Right arrow keys."
	_heading.text = String(_record.get("heading", "BUILD THE SEQUENCE"))
	_reading_path.visible = bool(_record.get("drawPath", false))
	reset_sequence()

func reset_sequence() -> void:
	_order = _string_array(_record.get("initialOrder", []))
	if _order.is_empty():
		for card_value: Variant in Array(_record.get("cards", [])):
			if typeof(card_value) == TYPE_DICTIONARY:
				_order.append(String(Dictionary(card_value).get("id", "")))
	_selected_card = ""
	_drag_card = ""
	_awaiting_completion_ack = false
	_pending_final_result.clear()
	_check_button.disabled = false
	_check_button.text = "Check sequence"
	_reset_button.disabled = false
	_set_workspace_enabled(true)
	_build_cards()
	_refresh_feedback()

func current_result() -> Dictionary:
	var result: Dictionary = Measure.evaluate({
		"cards": Array(_record.get("cards", [])).duplicate(true),
		"constraints": Array(_record.get("constraints", [])).duplicate(true),
		"order": Array(_order)
	})
	result["selectedCard"] = _selected_card
	result["reason"] = describe(result)
	return result

func order_ids() -> PackedStringArray:
	return PackedStringArray(_order)

func set_order(value: Array) -> void:
	if _awaiting_completion_ack:
		return
	_order = _string_array(value)
	_selected_card = ""
	_refresh_feedback()

func focus_target() -> void:
	var cards: Array = _record.get("cards", [])
	if cards.is_empty():
		_check_button.grab_focus()
		return
	var first_id := String(Dictionary(cards[0]).get("id", ""))
	var first := _card_button(first_id)
	if first != null:
		first.grab_focus()

func show_error(message: String) -> void:
	_feedback.text = message

func move_card(card_id: String, direction: int) -> void:
	if _awaiting_completion_ack or direction == 0:
		return
	var from := _order.find(card_id)
	if from < 0:
		return
	var to := clampi(from + signi(direction), 0, _order.size() - 1)
	if to == from:
		return
	var swap := _order[to]
	_order[to] = card_id
	_order[from] = swap
	_selected_card = card_id
	_refresh_feedback()

func describe(result: Dictionary) -> String:
	var substitutions := {
		"before": "one required card",
		"after": "the card it prepares",
		"first": _card_short_label(_order[0]) if not _order.is_empty() else "the first card",
		"last": _card_short_label(_order[-1]) if not _order.is_empty() else "the final card",
		"order": _order_label_text()
	}
	if bool(result.get("passed", false)):
		return String(
			_record.get("wonSentence", "Every required step now prepares the step that follows.")
		).format(substitutions)
	var unmet: PackedStringArray = result.get("unmet", PackedStringArray())
	if unmet.is_empty():
		return "This sequence could not be measured."
	var first_check := unmet[0]
	if first_check == Measure.CHECK_CONSTRAINTS:
		var edges: PackedStringArray = result.get("unmetConstraints", PackedStringArray())
		if not edges.is_empty():
			var parts := edges[0].split("->", false, 1)
			if parts.size() == 2:
				substitutions["before"] = _card_short_label(parts[0])
				substitutions["after"] = _card_short_label(parts[1])
	var sentences: Dictionary = _record.get("unmetSentences", {})
	return String(
		sentences.get(first_check, "Move one card, then check the sequence again.")
	).format(substitutions)

func _build_cards() -> void:
	_clear_children(_card_grid)
	for card_value: Variant in Array(_record.get("cards", [])):
		if typeof(card_value) != TYPE_DICTIONARY:
			continue
		var card: Dictionary = card_value
		var card_id := String(card.get("id", ""))
		var button := Button.new()
		button.name = "Card_%s" % _safe_id(card_id)
		button.custom_minimum_size = Vector2(410, 86)
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.toggle_mode = true
		button.tooltip_text = String(card.get("label", card_id))
		button.set_meta("card_id", card_id)
		button.pressed.connect(_on_card_pressed.bind(card_id))
		button.gui_input.connect(_on_card_gui_input.bind(card_id, button))
		_card_grid.add_child(button)
	_refresh_cards()

func _refresh_cards() -> void:
	for card_value: Variant in Array(_record.get("cards", [])):
		if typeof(card_value) != TYPE_DICTIONARY:
			continue
		var card: Dictionary = card_value
		var card_id := String(card.get("id", ""))
		var button := _card_button(card_id)
		if button == null:
			continue
		var sequence_number := _order.find(card_id) + 1
		var short_label := String(card.get("shortLabel", card.get("label", card_id)))
		var detail := String(card.get("label", short_label))
		button.text = "%d. %s\n%s" % [sequence_number, short_label, detail]
		button.set_pressed_no_signal(card_id == _selected_card)
	_selected_reading.text = (
		"SELECTED: %s" % _card_short_label(_selected_card)
		if not _selected_card.is_empty()
		else "SELECT A CARD TO MOVE"
	)
	_move_left.disabled = _awaiting_completion_ack or _selected_card.is_empty() or _order.find(_selected_card) <= 0
	_move_right.disabled = (
		_awaiting_completion_ack
		or _selected_card.is_empty()
		or _order.find(_selected_card) < 0
		or _order.find(_selected_card) >= _order.size() - 1
	)
	call_deferred("_update_path")

func _on_card_pressed(card_id: String) -> void:
	if _awaiting_completion_ack:
		return
	_selected_card = card_id
	_refresh_cards()
	_feedback.text = "Selected %s. Move it left or right in the sequence." % _card_short_label(card_id)

func _move_selected(direction: int) -> void:
	if _selected_card.is_empty():
		return
	move_card(_selected_card, direction)

func _on_card_gui_input(event: InputEvent, card_id: String, button: Button) -> void:
	if _awaiting_completion_ack:
		return
	if event is InputEventKey:
		var key := event as InputEventKey
		if key.pressed and not key.echo and key.keycode in [KEY_LEFT, KEY_RIGHT]:
			_selected_card = card_id
			move_card(card_id, -1 if key.keycode == KEY_LEFT else 1)
			button.accept_event()
		return
	if not (event is InputEventMouseButton):
		return
	var click := event as InputEventMouseButton
	if click.button_index != MOUSE_BUTTON_LEFT:
		return
	if click.pressed:
		_drag_card = card_id
		_selected_card = card_id
		_refresh_cards()
		return
	if _drag_card != card_id:
		return
	var target_id := _card_at(click.global_position)
	_drag_card = ""
	if not target_id.is_empty() and target_id != card_id:
		_move_card_to(card_id, target_id)
		button.accept_event()

func _move_card_to(card_id: String, target_id: String) -> void:
	var from := _order.find(card_id)
	var to := _order.find(target_id)
	if from < 0 or to < 0 or from == to:
		return
	_order.remove_at(from)
	_order.insert(to, card_id)
	_selected_card = card_id
	_refresh_feedback()

func _card_at(global_point: Vector2) -> String:
	for child: Node in _card_grid.get_children():
		var button := child as Button
		if button != null and button.get_global_rect().has_point(global_point):
			return String(button.get_meta("card_id", ""))
	return ""

func _update_path() -> void:
	if not is_instance_valid(_reading_path):
		return
	if not bool(_record.get("drawPath", false)):
		_reading_path.visible = false
		_reading_path.clear_points()
		return
	_reading_path.visible = true
	_reading_path.clear_points()
	for card_id: String in _order:
		var button := _card_button(card_id)
		if button != null:
			_reading_path.add_point(_reading_path.to_local(button.get_global_rect().get_center()))

func _refresh_feedback() -> void:
	_refresh_cards()
	var result := current_result()
	var constraint_results: Array = result.get("constraintResults", [])
	var met := int(result.get("metConstraintCount", 0))
	_order_reading.text = "CURRENT ORDER\n%s" % _order_label_text()
	_constraint_reading.text = "REQUIRED LINKS\n%d / %d correct" % [met, constraint_results.size()]
	_set_reading_colour(_order_reading, bool(Dictionary(result.get("checks", {})).get(Measure.CHECK_PERMUTATION, {}).get("passed", false)))
	_set_reading_colour(_constraint_reading, bool(Dictionary(result.get("checks", {})).get(Measure.CHECK_CONSTRAINTS, {}).get("passed", false)))
	_feedback.text = describe(result)

func _set_reading_colour(label: Label, passed: bool) -> void:
	label.add_theme_color_override("font_color", GOOD if passed else NEEDS_WORK)

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
	result["evidence"] = _evidence_sentence()
	result["reason"] = ""
	_feedback.text = describe(result)
	_pending_final_result = result.duplicate(true)
	_awaiting_completion_ack = true
	_check_button.text = "Finish task"
	_set_workspace_enabled(false)
	_check_button.grab_focus()

func _set_workspace_enabled(enabled: bool) -> void:
	for node: Node in _card_grid.find_children("Card_*", "Button", true, false):
		(node as Button).disabled = not enabled
	_reset_button.disabled = not enabled
	if not enabled:
		_move_left.disabled = true
		_move_right.disabled = true

func _evidence_sentence() -> String:
	return String(_record.get("evidenceSentence", "")).format({
		"first": _card_short_label(_order[0]) if not _order.is_empty() else "",
		"last": _card_short_label(_order[-1]) if not _order.is_empty() else "",
		"order": _order_label_text()
	})

func _order_label_text() -> String:
	var labels: Array[String] = []
	for card_id: String in _order:
		labels.append(_card_short_label(card_id))
	return " → ".join(labels)

func _card_short_label(card_id: String) -> String:
	for value: Variant in Array(_record.get("cards", [])):
		if typeof(value) != TYPE_DICTIONARY:
			continue
		var card: Dictionary = value
		if String(card.get("id", "")) == card_id:
			return String(card.get("shortLabel", card.get("label", card_id)))
	return card_id

func _card_button(card_id: String) -> Button:
	return _card_grid.get_node_or_null("Card_%s" % _safe_id(card_id)) as Button

func _safe_id(id: String) -> String:
	return id.replace("-", "_").replace(" ", "_")

func _string_array(value: Variant) -> PackedStringArray:
	var strings := PackedStringArray()
	if typeof(value) == TYPE_PACKED_STRING_ARRAY:
		return PackedStringArray(value)
	if typeof(value) != TYPE_ARRAY:
		return strings
	for item: Variant in Array(value):
		strings.append(String(item))
	return strings

func _clear_children(parent: Node) -> void:
	for child: Node in parent.get_children():
		parent.remove_child(child)
		child.queue_free()
