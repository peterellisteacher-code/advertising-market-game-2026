extends VBoxContainer
class_name AdMarketTargetStage

signal arrangement_submitted(result: Dictionary)

const Measure = preload("res://src/agency/missions/demonstrations/target_measure.gd")

const GOOD := Color("3a7d44")
const NEEDS_WORK := Color("a64b37")

@onready var _instruction: Label = $DemonstrationInstruction
@onready var _keyboard_hint: Label = $KeyboardHint
@onready var _source_heading: Label = $Workspace/EvidencePanel/EvidenceColumn/SourceHeading
@onready var _evidence_bank: VBoxContainer = $Workspace/EvidencePanel/EvidenceColumn/EvidenceBank
@onready var _target_heading: Label = $Workspace/StatementsPanel/StatementsColumn/TargetHeading
@onready var _statement_cards: GridContainer = $Workspace/StatementsPanel/StatementsColumn/StatementCards
@onready var _placed_reading: Label = $ReadoutRow/PlacedReading
@onready var _support_reading: Label = $ReadoutRow/SupportReading
@onready var _empty_reading: Label = $ReadoutRow/EmptyReading
@onready var _feedback: Label = $DemonstrationFeedback
@onready var _reset_button: Button = $ActionsRow/ResetButton
@onready var _check_button: Button = $ActionsRow/CheckButton

var _record: Dictionary = {}
var _assignments: Dictionary = {}
var _selected_evidence: String = ""
var _drag_evidence: String = ""
var _awaiting_completion_ack: bool = false
var _pending_final_result: Dictionary = {}

func _ready() -> void:
	_reset_button.pressed.connect(reset_arrangement)
	_check_button.pressed.connect(_on_check_pressed)

func configure(record: Dictionary) -> void:
	_record = record.duplicate(true)
	_instruction.text = String(
		_record.get("instruction", "Place every evidence chip on a statement it supports.")
	)
	_keyboard_hint.text = "Select a card, then select the statement it proves. Select a placed card to move it."
	_source_heading.text = String(_record.get("sourceHeading", "EVIDENCE"))
	_target_heading.text = String(_record.get("targetHeading", "STATEMENTS"))
	reset_arrangement()

func reset_arrangement() -> void:
	_assignments.clear()
	_selected_evidence = ""
	_drag_evidence = ""
	_awaiting_completion_ack = false
	_pending_final_result.clear()
	_check_button.disabled = false
	_check_button.text = "Check matches"
	_reset_button.disabled = false
	_build_workspace()
	_set_workspace_enabled(true)
	_refresh_feedback()

func current_result() -> Dictionary:
	var result: Dictionary = Measure.evaluate({
		"evidence": Array(_record.get("evidence", [])).duplicate(true),
		"statements": Array(_record.get("statements", [])).duplicate(true),
		"supports": Dictionary(_record.get("supports", {})).duplicate(true),
		"assignments": _assignments.duplicate(true)
	})
	result["selectedEvidence"] = _selected_evidence
	result["reason"] = describe(result)
	return result

func focus_target() -> void:
	var evidence: Array = _record.get("evidence", [])
	if evidence.is_empty():
		_check_button.grab_focus()
		return
	var first_id := String(Dictionary(evidence[0]).get("id", ""))
	var first := _evidence_button(first_id)
	if first != null:
		first.grab_focus()

func show_error(message: String) -> void:
	_feedback.text = message

func assign_evidence(evidence_id: String, statement_id: String) -> void:
	if _awaiting_completion_ack:
		return
	if not _has_record_id("evidence", evidence_id) or not _has_record_id("statements", statement_id):
		return
	_assignments[evidence_id] = statement_id
	_selected_evidence = ""
	_build_workspace()
	_refresh_feedback()

func unassign_evidence(evidence_id: String) -> void:
	if _awaiting_completion_ack:
		return
	_assignments.erase(evidence_id)
	if _selected_evidence == evidence_id:
		_selected_evidence = ""
	_build_workspace()
	_refresh_feedback()

func describe(result: Dictionary) -> String:
	var supported_statement := _first_supported_statement(result)
	var substitutions := {
		"statement": _statement_label(supported_statement),
		"subject": String(_record.get("subjectPhrase", "the supported statement")),
		"evidence": "the evidence"
	}
	if bool(result.get("passed", false)):
		return String(
			_record.get("wonSentence", "Every chip supports the statement on which it is placed.")
		).format(substitutions)
	var unmet: PackedStringArray = result.get("unmet", PackedStringArray())
	if unmet.is_empty():
		return "This evidence arrangement could not be measured."
	var first_check := unmet[0]
	if first_check == Measure.CHECK_SUPPORTS:
		var unsupported: PackedStringArray = result.get(
			"unsupportedAssignments", PackedStringArray()
		)
		if not unsupported.is_empty():
			var parts := unsupported[0].split("->", false, 1)
			if parts.size() == 2:
				substitutions["evidence"] = _evidence_label(parts[0])
				substitutions["statement"] = _statement_label(parts[1])
	elif first_check == Measure.CHECK_UNSUPPORTED_EMPTY:
		var occupied: PackedStringArray = result.get(
			"occupiedUnsupportable", PackedStringArray()
		)
		if not occupied.is_empty():
			substitutions["statement"] = _statement_label(occupied[0])
	var sentences: Dictionary = _record.get("unmetSentences", {})
	return String(
		sentences.get(first_check, "Move one evidence chip, then check the support again.")
	).format(substitutions)

func _build_workspace() -> void:
	_clear_children(_evidence_bank)
	_clear_children(_statement_cards)
	for statement_value: Variant in Array(_record.get("statements", [])):
		if typeof(statement_value) != TYPE_DICTIONARY:
			continue
		_build_statement_card(Dictionary(statement_value))
	for evidence_value: Variant in Array(_record.get("evidence", [])):
		if typeof(evidence_value) != TYPE_DICTIONARY:
			continue
		var evidence := Dictionary(evidence_value)
		var evidence_id := String(evidence.get("id", ""))
		var button := _make_evidence_button(evidence)
		var statement_id := String(_assignments.get(evidence_id, ""))
		var destination := _assigned_container(statement_id)
		if destination == null:
			_evidence_bank.add_child(button)
		else:
			destination.add_child(button)
	_refresh_selection()

func _build_statement_card(statement: Dictionary) -> void:
	var statement_id := String(statement.get("id", ""))
	var card := VBoxContainer.new()
	card.name = "Statement_%s" % _safe_id(statement_id)
	card.custom_minimum_size = Vector2(250, 108)
	card.add_theme_constant_override("separation", 4)
	card.set_meta("statement_id", statement_id)
	var statement_label := Label.new()
	statement_label.name = "StatementLabel"
	statement_label.text = String(statement.get("label", statement_id))
	statement_label.custom_minimum_size = Vector2(0, 44)
	statement_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	statement_label.add_theme_font_size_override("font_size", 13)
	card.add_child(statement_label)
	var assign_button := Button.new()
	assign_button.name = "StatementButton"
	assign_button.text = "Put selected card here"
	assign_button.custom_minimum_size = Vector2(0, 34)
	assign_button.pressed.connect(_on_statement_pressed.bind(statement_id))
	card.add_child(assign_button)
	var assigned := VBoxContainer.new()
	assigned.name = "AssignedChips"
	assigned.add_theme_constant_override("separation", 2)
	card.add_child(assigned)
	_statement_cards.add_child(card)

func _make_evidence_button(evidence: Dictionary) -> Button:
	var evidence_id := String(evidence.get("id", ""))
	var label := String(evidence.get("label", evidence_id))
	var button := Button.new()
	button.name = "Evidence_%s" % _safe_id(evidence_id)
	button.text = label
	button.tooltip_text = label
	button.custom_minimum_size = Vector2(0, 36)
	button.toggle_mode = true
	button.set_meta("evidence_id", evidence_id)
	button.pressed.connect(_on_evidence_pressed.bind(evidence_id))
	button.gui_input.connect(_on_evidence_gui_input.bind(evidence_id, button))
	return button

func _on_evidence_pressed(evidence_id: String) -> void:
	if _awaiting_completion_ack:
		return
	if _assignments.has(evidence_id):
		unassign_evidence(evidence_id)
		return
	_selected_evidence = evidence_id
	_refresh_selection()
	_feedback.text = "Selected: %s. Now select the statement this card proves." % _evidence_label(evidence_id)

func _on_statement_pressed(statement_id: String) -> void:
	if _awaiting_completion_ack:
		return
	if _selected_evidence.is_empty():
		_feedback.text = "Select a card first."
		return
	assign_evidence(_selected_evidence, statement_id)

func _on_evidence_gui_input(event: InputEvent, evidence_id: String, button: Button) -> void:
	if _awaiting_completion_ack or not (event is InputEventMouseButton):
		return
	var click := event as InputEventMouseButton
	if click.button_index != MOUSE_BUTTON_LEFT:
		return
	if click.pressed:
		_drag_evidence = evidence_id
		_selected_evidence = evidence_id
		_refresh_selection()
		return
	if _drag_evidence != evidence_id:
		return
	var statement_id := _statement_at(click.global_position)
	_drag_evidence = ""
	if not statement_id.is_empty():
		assign_evidence(evidence_id, statement_id)
		button.accept_event()

func _statement_at(global_point: Vector2) -> String:
	for child: Node in _statement_cards.get_children():
		var card := child as Control
		if card != null and card.get_global_rect().has_point(global_point):
			return String(card.get_meta("statement_id", ""))
	return ""

func _refresh_selection() -> void:
	for node: Node in find_children("Evidence_*", "Button", true, false):
		var button := node as Button
		var evidence_id := String(button.get_meta("evidence_id", ""))
		button.set_pressed_no_signal(evidence_id == _selected_evidence)

func _refresh_feedback() -> void:
	var result := current_result()
	var evidence_count := int(result.get("evidenceCount", 0))
	var placed_count := int(result.get("placedCount", 0))
	var unsupported: PackedStringArray = result.get("unsupportedAssignments", PackedStringArray())
	var invalid: PackedStringArray = result.get("invalidAssignments", PackedStringArray())
	var occupied: PackedStringArray = result.get("occupiedUnsupportable", PackedStringArray())
	_placed_reading.text = "CARDS MATCHED\n%d / %d" % [placed_count, evidence_count]
	_support_reading.text = "WRONG MATCHES\n%d to fix" % (unsupported.size() + invalid.size())
	_empty_reading.text = "UNSUPPORTED FILLED\n%d to clear" % occupied.size()
	_set_reading_colour(_placed_reading, placed_count == evidence_count and evidence_count > 0)
	_set_reading_colour(_support_reading, unsupported.is_empty() and invalid.is_empty())
	_set_reading_colour(_empty_reading, occupied.is_empty())
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
	result["evidence"] = _evidence_sentence(result)
	result["reason"] = ""
	_feedback.text = describe(result)
	_pending_final_result = result.duplicate(true)
	_awaiting_completion_ack = true
	_check_button.text = "Finish task"
	_set_workspace_enabled(false)
	_check_button.grab_focus()

func _set_workspace_enabled(enabled: bool) -> void:
	for node: Node in $Workspace.find_children("*", "Button", true, false):
		(node as Button).disabled = not enabled
	_reset_button.disabled = not enabled

func _evidence_sentence(result: Dictionary) -> String:
	var statement_id := _first_supported_statement(result)
	return String(_record.get("evidenceSentence", "")).format({
		"statement": _statement_label(statement_id),
		"subject": String(_record.get("subjectPhrase", "the supported statement")),
		"evidence_count": int(result.get("evidenceCount", 0))
	})

func _first_supported_statement(result: Dictionary) -> String:
	var ids: PackedStringArray = result.get("supportedStatements", PackedStringArray())
	return ids[0] if not ids.is_empty() else ""

func _evidence_label(evidence_id: String) -> String:
	for value: Variant in Array(_record.get("evidence", [])):
		var evidence := Dictionary(value)
		if String(evidence.get("id", "")) == evidence_id:
			return String(evidence.get("label", evidence_id))
	return evidence_id

func _statement_label(statement_id: String) -> String:
	for value: Variant in Array(_record.get("statements", [])):
		var statement := Dictionary(value)
		if String(statement.get("id", "")) == statement_id:
			return String(statement.get("label", statement_id))
	return statement_id

func _has_record_id(key: String, id: String) -> bool:
	if id.is_empty():
		return false
	for value: Variant in Array(_record.get(key, [])):
		if typeof(value) == TYPE_DICTIONARY and String(Dictionary(value).get("id", "")) == id:
			return true
	return false

func _evidence_button(evidence_id: String) -> Button:
	return find_child("Evidence_%s" % _safe_id(evidence_id), true, false) as Button

func _assigned_container(statement_id: String) -> VBoxContainer:
	if statement_id.is_empty():
		return null
	return _statement_cards.get_node_or_null(
		"Statement_%s/AssignedChips" % _safe_id(statement_id)
	) as VBoxContainer

func _safe_id(id: String) -> String:
	return id.replace("-", "_").replace(" ", "_")

func _clear_children(parent: Node) -> void:
	for child: Node in parent.get_children():
		parent.remove_child(child)
		child.queue_free()
