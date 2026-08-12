extends RefCounted
class_name AdMarketTestWordChipMeasure

# Engine F measures two visible editing constraints: headline length and preservation of
# the declared benefit. It does not compare with one authored shortening.

const Measure = preload("res://src/agency/missions/demonstrations/word_chip_measure.gd")
const Catalog = preload("res://src/agency/agency_mission_catalog.gd")
const PanelScene = preload("res://src/agency/missions/AgencyMissionPanel.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")
const CONTROLLER_PATH := "res://src/agency/missions/agency_mission_controller.gd"
const STAGE_PATH := "res://src/agency/missions/demonstrations/WordChipStage.tscn"

const CHIPS := [
	{"id": "the", "text": "The", "wordCount": 1},
	{"id": "best", "text": "best,", "wordCount": 1},
	{"id": "greatest", "text": "greatest and", "wordCount": 2},
	{"id": "amazing", "text": "most amazing", "wordCount": 2},
	{"id": "solution", "text": "solution for everyone:", "wordCount": 3},
	{"id": "control", "text": "control", "wordCount": 1},
	{"id": "your-hour", "text": "your hour.", "wordCount": 2},
	{"id": "keep", "text": "Keep", "wordCount": 1},
	{"id": "your-priorities", "text": "your priorities", "wordCount": 2},
	{"id": "visible", "text": "visible.", "wordCount": 1}
]
const REQUIRED := ["control", "your-hour", "keep", "your-priorities", "visible"]

func run() -> bool:
	assert(_missing_benefit_under_the_cap_fails())
	assert(_complete_benefit_over_the_cap_fails())
	assert(_duplicate_and_unknown_tokens_fail_closed())
	assert(_the_exact_word_boundary_passes())
	assert(_two_distinct_edits_can_pass())
	assert(_malformed_declarations_fail_closed())
	assert(_negative_control_rejects_short_but_empty_copy())
	assert(ResourceLoader.exists(STAGE_PATH), "Engine F WordChipStage.tscn has not been built.")
	assert(_catalog_supplies_the_headline_record())
	assert(await _the_stage_builds_the_record_contract())
	assert(await _removing_and_restoring_a_chip_preserves_authored_order())
	assert(await _preview_and_live_count_change_together())
	assert(await _completion_waits_for_an_explicit_finish())
	assert(await _the_panel_focuses_the_first_chip_and_records_evidence())
	return true

func _record(retained: Array, overrides: Dictionary = {}) -> Dictionary:
	var record := {
		"chips": CHIPS.duplicate(true),
		"requiredBenefitTokens": REQUIRED.duplicate(),
		"maxWords": 9,
		"retainedIds": retained.duplicate()
	}
	for key: Variant in overrides:
		record[key] = overrides[key]
	return record

func _check_passed(result: Dictionary, check: String) -> bool:
	var checks: Dictionary = result.get("checks", {})
	return bool(Dictionary(checks.get(check, {})).get("passed", false))

func _missing_benefit_under_the_cap_fails() -> bool:
	var result: Dictionary = Measure.evaluate(
		_record(["control", "your-hour", "keep", "visible"])
	)
	return (
		not bool(result.get("passed"))
		and int(result.get("retainedWordCount", -1)) == 5
		and PackedStringArray(result.get("missingBenefitTokens", PackedStringArray())) == PackedStringArray(["your-priorities"])
		and _check_passed(result, Measure.CHECK_WORD_CAP)
		and not _check_passed(result, Measure.CHECK_BENEFIT)
	)

func _complete_benefit_over_the_cap_fails() -> bool:
	var all_ids: Array[String] = []
	for chip: Dictionary in CHIPS:
		all_ids.append(String(chip.get("id", "")))
	var result: Dictionary = Measure.evaluate(_record(all_ids))
	return (
		not bool(result.get("passed"))
		and int(result.get("retainedWordCount", -1)) == 16
		and not _check_passed(result, Measure.CHECK_WORD_CAP)
		and _check_passed(result, Measure.CHECK_BENEFIT)
	)

func _duplicate_and_unknown_tokens_fail_closed() -> bool:
	var duplicate := REQUIRED.duplicate()
	duplicate.append("visible")
	var unknown := REQUIRED.duplicate()
	unknown.append("invented")
	var duplicate_result: Dictionary = Measure.evaluate(_record(duplicate))
	var unknown_result: Dictionary = Measure.evaluate(_record(unknown))
	return (
		not bool(duplicate_result.get("passed"))
		and PackedStringArray(duplicate_result.get("duplicateTokens", PackedStringArray())) == PackedStringArray(["visible"])
		and not bool(unknown_result.get("passed"))
		and PackedStringArray(unknown_result.get("unknownTokens", PackedStringArray())) == PackedStringArray(["invented"])
		and not _check_passed(duplicate_result, Measure.CHECK_DECLARATIONS)
		and not _check_passed(unknown_result, Measure.CHECK_DECLARATIONS)
	)

func _the_exact_word_boundary_passes() -> bool:
	var retained := REQUIRED.duplicate()
	retained.append("greatest")
	var result: Dictionary = Measure.evaluate(_record(retained))
	return (
		bool(result.get("passed"))
		and int(result.get("retainedWordCount", -1)) == 9
		and _check_passed(result, Measure.CHECK_WORD_CAP)
		and _check_passed(result, Measure.CHECK_BENEFIT)
	)

func _two_distinct_edits_can_pass() -> bool:
	var shortest: Dictionary = Measure.evaluate(_record(REQUIRED.duplicate()))
	var alternative := REQUIRED.duplicate()
	alternative.append_array(["the", "best"])
	var second: Dictionary = Measure.evaluate(_record(alternative))
	return (
		bool(shortest.get("passed"))
		and int(shortest.get("retainedWordCount", -1)) == 7
		and bool(second.get("passed"))
		and int(second.get("retainedWordCount", -1)) == 9
		and String(shortest.get("headline", "")) != String(second.get("headline", ""))
	)

func _malformed_declarations_fail_closed() -> bool:
	var duplicate_chips := CHIPS.duplicate(true)
	duplicate_chips.append({"id": "control", "text": "duplicate", "wordCount": 1})
	var duplicate: Dictionary = Measure.evaluate(
		_record(REQUIRED.duplicate(), {"chips": duplicate_chips})
	)
	var unknown_required := REQUIRED.duplicate()
	unknown_required.append("invented")
	var required: Dictionary = Measure.evaluate(
		_record(REQUIRED.duplicate(), {"requiredBenefitTokens": unknown_required})
	)
	var invalid_cap: Dictionary = Measure.evaluate(
		_record(REQUIRED.duplicate(), {"maxWords": 0})
	)
	return (
		not bool(duplicate.get("passed"))
		and not bool(required.get("passed"))
		and not bool(invalid_cap.get("passed"))
		and not _check_passed(duplicate, Measure.CHECK_DECLARATIONS)
		and not _check_passed(required, Measure.CHECK_DECLARATIONS)
		and not _check_passed(invalid_cap, Measure.CHECK_DECLARATIONS)
	)

func _negative_control_rejects_short_but_empty_copy() -> bool:
	# The empty praise is below the cap after editing, but it drops the stated product
	# benefit. A word-count-only implementation would incorrectly accept it.
	var result: Dictionary = Measure.evaluate(
		_record(["the", "best", "greatest", "amazing"])
	)
	return (
		not bool(result.get("passed"))
		and int(result.get("retainedWordCount", -1)) == 6
		and _check_passed(result, Measure.CHECK_WORD_CAP)
		and not _check_passed(result, Measure.CHECK_BENEFIT)
	)

func _stage_record() -> Dictionary:
	return {
		"engine": "removable-word-chips",
		"scene": STAGE_PATH,
		"instruction": "Remove empty praise while keeping the product benefit. Keep the headline at nine words or fewer.",
		"chips": CHIPS.duplicate(true),
		"requiredBenefitTokens": REQUIRED.duplicate(),
		"maxWords": 9,
		"checkPhrases": {
			Measure.CHECK_WORD_CAP: "headline at nine words or fewer",
			Measure.CHECK_BENEFIT: "product benefit preserved"
		},
		"unmetSentences": {
			Measure.CHECK_DECLARATIONS: "This headline task is incomplete.",
			Measure.CHECK_WORD_CAP: "The headline has {words} words. Remove at least one empty phrase to reach {max_words}.",
			Measure.CHECK_BENEFIT: "The headline has lost {missing}. Restore that benefit chip."
		},
		"wonSentence": "The headline keeps the product benefit in {words} words.",
		"evidenceSentence": "The headline was reduced to {words} words while retaining the benefit: {headline}",
		"subjectPhrase": "the revised headline"
	}

func _settle_stage() -> void:
	var tree := Engine.get_main_loop() as SceneTree
	await tree.process_frame
	await tree.process_frame

func _stage_in_tree(record: Dictionary) -> Control:
	var packed := load(STAGE_PATH) as PackedScene
	if packed == null:
		return null
	var tree := Engine.get_main_loop() as SceneTree
	var stage := packed.instantiate() as Control
	tree.root.add_child(stage)
	stage.call("configure", record)
	return stage

func _safe_id(id: String) -> String:
	return id.replace("-", "_").replace(" ", "_")

func _retained_button(stage: Control, chip_id: String) -> Button:
	return stage.get_node_or_null(
		"Workspace/RetainedPanel/RetainedColumn/RetainedBank/Chip_%s" % _safe_id(chip_id)
	) as Button

func _removed_button(stage: Control, chip_id: String) -> Button:
	return stage.get_node_or_null(
		"Workspace/RemovedPanel/RemovedColumn/RemovedBank/Chip_%s" % _safe_id(chip_id)
	) as Button

func _catalog_supplies_the_headline_record() -> bool:
	var demonstration: Dictionary = Catalog.sidequest("headline-surgery").get("demonstration", {})
	var chips: Array = demonstration.get("chips", [])
	return (
		not demonstration.is_empty()
		and String(demonstration.get("scene", "")) == STAGE_PATH
		and chips.size() == 10
		and int(demonstration.get("maxWords", 0)) == 9
		and Array(demonstration.get("requiredBenefitTokens", [])).size() == 5
		and not String(demonstration.get("evidenceSentence", "")).is_empty()
	)

func _the_stage_builds_the_record_contract() -> bool:
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	var retained := stage.get_node(
		"Workspace/RetainedPanel/RetainedColumn/RetainedBank"
	) as Control
	var removed := stage.get_node(
		"Workspace/RemovedPanel/RemovedColumn/RemovedBank"
	) as Control
	var preview := stage.get_node("PreviewPanel/PreviewColumn/HeadlinePreview") as Label
	var opening: Dictionary = stage.call("current_result")
	stage.call("focus_target")
	await _settle_stage()
	var first := _retained_button(stage, "the")
	var holds := (
		retained.get_child_count() == 10
		and removed.get_child_count() == 0
		and int(opening.get("retainedWordCount", -1)) == 16
		and not bool(opening.get("passed"))
		and preview.text.begins_with("The best")
		and first != null
		and stage.get_viewport().gui_get_focus_owner() == first
	)
	stage.queue_free()
	return holds

func _removing_and_restoring_a_chip_preserves_authored_order() -> bool:
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	var original := _retained_button(stage, "the")
	if original == null:
		stage.queue_free()
		return false
	original.pressed.emit()
	await _settle_stage()
	var removed := _removed_button(stage, "the")
	var after_remove: Dictionary = stage.call("current_result")
	var removed_ok := (
		removed != null
		and not String(after_remove.get("headline", "")).begins_with("The ")
	)
	removed.pressed.emit()
	await _settle_stage()
	var after_restore: Dictionary = stage.call("current_result")
	var bank := stage.get_node(
		"Workspace/RetainedPanel/RetainedColumn/RetainedBank"
	) as Control
	var restored := _retained_button(stage, "the")
	var restored_ok := (
		restored != null
		and bank.get_child(0) == restored
		and String(after_restore.get("headline", "")).begins_with("The best")
	)
	stage.queue_free()
	return removed_ok and restored_ok

func _preview_and_live_count_change_together() -> bool:
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	var preview := stage.get_node("PreviewPanel/PreviewColumn/HeadlinePreview") as Label
	var count := stage.get_node("ReadoutRow/WordCountReading") as Label
	var before_preview := preview.text
	var before_count := count.text
	stage.call("remove_chip", "solution")
	await _settle_stage()
	var result: Dictionary = stage.call("current_result")
	var holds := (
		preview.text != before_preview
		and count.text != before_count
		and int(result.get("retainedWordCount", -1)) == 13
		and not preview.text.contains("solution for everyone")
	)
	stage.queue_free()
	return holds

func _completion_waits_for_an_explicit_finish() -> bool:
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	var submitted := []
	stage.connect("arrangement_submitted", func(result: Dictionary) -> void: submitted.append(result))
	stage.call("set_retained_ids", REQUIRED.duplicate())
	var check := stage.get_node("ActionsRow/CheckButton") as Button
	check.pressed.emit()
	await _settle_stage()
	var awaiting_finish := submitted.is_empty() and check.text == "Finish task" and not check.disabled
	check.pressed.emit()
	await _settle_stage()
	var final: Dictionary = submitted[0] if submitted.size() == 1 else {}
	var evidence := String(final.get("evidence", ""))
	var holds := (
		awaiting_finish
		and submitted.size() == 1
		and bool(final.get("passed"))
		and evidence.contains("7 words")
		and evidence.contains("control your hour")
		and evidence.contains("priorities visible")
	)
	stage.queue_free()
	return holds

func _the_panel_focuses_the_first_chip_and_records_evidence() -> bool:
	var tree := Engine.get_main_loop() as SceneTree
	var progress: RefCounted = AgencyProgress.new()
	if not bool(progress.call("begin")):
		return false
	var panel := PanelScene.instantiate() as Control
	tree.root.add_child(panel)
	var controller := (load(CONTROLLER_PATH) as Script).new() as Node
	controller.call("configure", progress, panel)
	var opened: Dictionary = controller.call("open_mission", "headline-surgery", "strategist")
	var chosen: Dictionary = controller.call("choose", "control-your-hour")
	var continued: Dictionary = controller.call("continue_to_demonstration")
	await _settle_stage()
	var host := panel.get_node("Backdrop/Dialog/Margin/Content/DemonstrationStage") as Control
	var stage := host.get_child(0) as Control if host.get_child_count() == 1 else null
	if stage == null:
		controller.free()
		panel.queue_free()
		return false
	var first := _retained_button(stage, "the")
	var focus_owner := stage.get_viewport().gui_get_focus_owner()
	var focused := focus_owner == first
	assert(focused, "focus owner=%s first=%s" % [focus_owner, first])
	var dialog := panel.get_node("Backdrop/Dialog") as PanelContainer
	var demonstration_height := dialog.get_combined_minimum_size().y
	var fits := demonstration_height <= 760.0
	assert(fits, "Word chip demonstration dialog=%s stage=%s workspace=%s" % [
		demonstration_height,
		stage.get_combined_minimum_size(),
		(stage.get_node("Workspace") as Control).get_combined_minimum_size(),
	])
	var submitted := []
	stage.connect("arrangement_submitted", func(result: Dictionary) -> void: submitted.append(result))
	stage.call("set_retained_ids", REQUIRED.duplicate())
	var check := stage.get_node("ActionsRow/CheckButton") as Button
	check.pressed.emit()
	await _settle_stage()
	var completion_visible := (
		String(controller.call("snapshot").get("state", "")) == "demonstration"
		and check.text == "Finish task"
	)
	check.pressed.emit()
	await _settle_stage()
	var submitted_result: Dictionary = submitted[0] if submitted.size() == 1 else {}
	var effect := String(submitted_result.get("evidence", ""))
	var holds := (
		bool(opened.get("allowed"))
		and bool(chosen.get("correct"))
		and String(continued.get("state", "")) == "demonstration"
		and focused
		and fits
		and completion_visible
		and String(controller.call("snapshot").get("state", "")) == "completed"
		and Array(progress.get("completed_sidequest_ids")).has("headline-surgery")
		and submitted.size() == 1
		and effect.contains("control your hour")
		and effect.contains("priorities visible")
	)
	controller.free()
	panel.queue_free()
	return holds
