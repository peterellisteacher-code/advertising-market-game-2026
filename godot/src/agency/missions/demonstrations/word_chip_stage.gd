extends VBoxContainer
class_name AdMarketWordChipStage

signal arrangement_submitted(result: Dictionary)

const Measure = preload("res://src/agency/missions/demonstrations/word_chip_measure.gd")

const GOOD := Color("3a7d44")
const NEEDS_WORK := Color("a64b37")

@onready var _instruction: Label = $DemonstrationInstruction
@onready var _keyboard_hint: Label = $KeyboardHint
@onready var _preview: Label = $PreviewPanel/PreviewColumn/HeadlinePreview
@onready var _retained_bank: GridContainer = $Workspace/RetainedPanel/RetainedColumn/RetainedBank
@onready var _removed_bank: GridContainer = $Workspace/RemovedPanel/RemovedColumn/RemovedBank
@onready var _word_count_reading: Label = $ReadoutRow/WordCountReading
@onready var _benefit_reading: Label = $ReadoutRow/BenefitReading
@onready var _feedback: Label = $DemonstrationFeedback
@onready var _reset_button: Button = $ActionsRow/ResetButton
@onready var _check_button: Button = $ActionsRow/CheckButton

var _record: Dictionary = {}
var _retained_ids: PackedStringArray = PackedStringArray()
var _awaiting_completion_ack: bool = false
var _pending_final_result: Dictionary = {}

func _ready() -> void:
	_reset_button.pressed.connect(reset_headline)
	_check_button.pressed.connect(_on_check_pressed)

func configure(record: Dictionary) -> void:
	_record = record.duplicate(true)
	_instruction.text = String(
		_record.get("instruction", "Remove empty words. Keep the product benefit.")
	)
	_keyboard_hint.text = "Activate a retained chip to remove it. Activate a removed chip to restore it in the original order."
	reset_headline()

func reset_headline() -> void:
	_retained_ids.clear()
	for chip_value: Variant in Array(_record.get("chips", [])):
		if typeof(chip_value) == TYPE_DICTIONARY:
			_retained_ids.append(String(Dictionary(chip_value).get("id", "")))
	_awaiting_completion_ack = false
	_pending_final_result.clear()
	_check_button.disabled = false
	_check_button.text = "Check headline"
	_reset_button.disabled = false
	_set_workspace_enabled(true)
	_rebuild_and_refresh()

func current_result() -> Dictionary:
	var result: Dictionary = Measure.evaluate({
		"chips": Array(_record.get("chips", [])).duplicate(true),
		"requiredBenefitTokens": Array(_record.get("requiredBenefitTokens", [])).duplicate(),
		"maxWords": int(_record.get("maxWords", 0)),
		"retainedIds": Array(_retained_ids)
	})
	result["reason"] = describe(result)
	return result

func focus_target() -> void:
	var chips: Array = _record.get("chips", [])
	if chips.is_empty():
		_check_button.grab_focus()
		return
	_focus_chip(String(Dictionary(chips[0]).get("id", "")))

func show_error(message: String) -> void:
	_feedback.text = message

func set_retained_ids(value: Array) -> void:
	if _awaiting_completion_ack:
		return
	_retained_ids = _string_array(value)
	_rebuild_and_refresh()

func remove_chip(chip_id: String) -> void:
	if _awaiting_completion_ack or not _retained_ids.has(chip_id):
		return
	_retained_ids.remove_at(_retained_ids.find(chip_id))
	_rebuild_and_refresh()
	call_deferred("_focus_chip", chip_id)

func restore_chip(chip_id: String) -> void:
	if _awaiting_completion_ack or _retained_ids.has(chip_id) or not _has_chip(chip_id):
		return
	_retained_ids.append(chip_id)
	_rebuild_and_refresh()
	call_deferred("_focus_chip", chip_id)

func describe(result: Dictionary) -> String:
	var missing: PackedStringArray = result.get("missingBenefitTokens", PackedStringArray())
	var substitutions := {
		"words": int(result.get("retainedWordCount", 0)),
		"max_words": int(result.get("maxWords", _record.get("maxWords", 0))),
		"missing": _chip_text(missing[0]) if not missing.is_empty() else "one benefit phrase",
		"headline": String(result.get("headline", ""))
	}
	if bool(result.get("passed", false)):
		return String(
			_record.get("wonSentence", "The revised headline is concise and keeps its benefit.")
		).format(substitutions)
	var unmet: PackedStringArray = result.get("unmet", PackedStringArray())
	if unmet.is_empty():
		return "This headline could not be measured."
	var sentences: Dictionary = _record.get("unmetSentences", {})
	return String(
		sentences.get(unmet[0], "Change one chip, then check the headline again.")
	).format(substitutions)

func _rebuild_and_refresh() -> void:
	_build_banks()
	_refresh_feedback()

func _build_banks() -> void:
	_clear_children(_retained_bank)
	_clear_children(_removed_bank)
	for chip_value: Variant in Array(_record.get("chips", [])):
		if typeof(chip_value) != TYPE_DICTIONARY:
			continue
		var chip: Dictionary = chip_value
		var chip_id := String(chip.get("id", ""))
		var retained := _retained_ids.has(chip_id)
		var button := Button.new()
		button.name = "Chip_%s" % _safe_id(chip_id)
		button.text = String(chip.get("text", chip_id))
		button.tooltip_text = (
			"Remove this chip from the headline."
			if retained
			else "Restore this chip in its original position."
		)
		# A real width is essential here: an autowrapped zero-width button reports a
		# multi-line minimum thousands of pixels tall before the GridContainer lays it out.
		button.custom_minimum_size = Vector2(150, 42)
		button.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		button.set_meta("chip_id", chip_id)
		button.pressed.connect(_toggle_chip.bind(chip_id))
		(_retained_bank if retained else _removed_bank).add_child(button)

func _toggle_chip(chip_id: String) -> void:
	if _retained_ids.has(chip_id):
		remove_chip(chip_id)
	else:
		restore_chip(chip_id)

func _refresh_feedback() -> void:
	var result := current_result()
	_preview.text = String(result.get("headline", ""))
	var word_count := int(result.get("retainedWordCount", 0))
	var max_words := int(result.get("maxWords", 0))
	var missing: PackedStringArray = result.get("missingBenefitTokens", PackedStringArray())
	_word_count_reading.text = "WORDS\n%d / %d" % [word_count, max_words]
	_benefit_reading.text = (
		"BENEFIT\nkept"
		if missing.is_empty()
		else "BENEFIT\n%d chip%s missing" % [missing.size(), "" if missing.size() == 1 else "s"]
	)
	_set_reading_colour(_word_count_reading, word_count <= max_words and max_words > 0)
	_set_reading_colour(_benefit_reading, missing.is_empty())
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
	for bank: GridContainer in [_retained_bank, _removed_bank]:
		for node: Node in bank.find_children("Chip_*", "Button", true, false):
			(node as Button).disabled = not enabled
	_reset_button.disabled = not enabled

func _evidence_sentence(result: Dictionary) -> String:
	return String(_record.get("evidenceSentence", "")).format({
		"words": int(result.get("retainedWordCount", 0)),
		"max_words": int(result.get("maxWords", 0)),
		"headline": String(result.get("headline", ""))
	})

func _focus_chip(chip_id: String) -> void:
	var button := _chip_button(_retained_bank, chip_id)
	if button == null:
		button = _chip_button(_removed_bank, chip_id)
	if button != null:
		button.grab_focus()

func _chip_button(bank: GridContainer, chip_id: String) -> Button:
	return bank.get_node_or_null("Chip_%s" % _safe_id(chip_id)) as Button

func _has_chip(chip_id: String) -> bool:
	for value: Variant in Array(_record.get("chips", [])):
		if typeof(value) == TYPE_DICTIONARY and String(Dictionary(value).get("id", "")) == chip_id:
			return true
	return false

func _chip_text(chip_id: String) -> String:
	for value: Variant in Array(_record.get("chips", [])):
		if typeof(value) != TYPE_DICTIONARY:
			continue
		var chip: Dictionary = value
		if String(chip.get("id", "")) == chip_id:
			return String(chip.get("text", chip_id))
	return chip_id

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
