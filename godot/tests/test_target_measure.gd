extends RefCounted
class_name AdMarketTestTargetMeasure

# Engine D measures whether evidence actually supports the statement it is placed on.
# It does not compare chip positions or order with an authored layout.

const Measure = preload("res://src/agency/missions/demonstrations/target_measure.gd")
const Catalog = preload("res://src/agency/agency_mission_catalog.gd")
const PanelScene = preload("res://src/agency/missions/AgencyMissionPanel.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")
const CONTROLLER_PATH := "res://src/agency/missions/agency_mission_controller.gd"
const STAGE_PATH := "res://src/agency/missions/demonstrations/TargetStage.tscn"

const EVIDENCE := [
	{"id": "context", "label": "Teenagers have one hour after school."},
	{"id": "need", "label": "They need a productive use for the hour."},
	{"id": "independence", "label": "They value independence."},
	{"id": "belonging", "label": "They value belonging."}
]
const STATEMENTS := [
	{"id": "self-directed", "label": "A productive option should still feel self-directed."},
	{"id": "cheapest", "label": "The lowest price is the audience's main need."},
	{"id": "adult-control", "label": "Adults should organise every part of the hour."}
]
const SUPPORTS := {
	"context": ["self-directed"],
	"need": ["self-directed"],
	"independence": ["self-directed"],
	"belonging": ["self-directed"]
}

func run() -> bool:
	assert(_all_supported_evidence_passes())
	assert(_dictionary_order_does_not_change_the_result())
	assert(_a_declared_choice_between_two_targets_can_pass())
	assert(_one_unplaced_chip_fails())
	assert(_one_wrong_target_fails())
	assert(_an_unsupportable_statement_must_stay_empty())
	assert(_unknown_and_duplicate_ids_fail_closed())
	assert(_malformed_support_relations_fail_closed())
	assert(_negative_control_rejects_the_surface_word_match())
	assert(ResourceLoader.exists(STAGE_PATH), "Engine D TargetStage.tscn has not been built.")
	assert(_catalog_supplies_two_distinct_target_records())
	assert(await _the_stage_builds_the_record_contract())
	assert(await _click_assignment_and_reset_work())
	assert(await _dragging_a_chip_to_a_supported_statement_works())
	assert(await _completion_waits_for_an_explicit_finish())
	assert(await _the_panel_focuses_the_first_chip_and_records_evidence())
	return true

func _record(assignments: Dictionary, overrides: Dictionary = {}) -> Dictionary:
	var record := {
		"evidence": EVIDENCE.duplicate(true),
		"statements": STATEMENTS.duplicate(true),
		"supports": SUPPORTS.duplicate(true),
		"assignments": assignments.duplicate(true)
	}
	for key: Variant in overrides:
		record[key] = overrides[key]
	return record

func _passing_assignments() -> Dictionary:
	return {
		"context": "self-directed",
		"need": "self-directed",
		"independence": "self-directed",
		"belonging": "self-directed"
	}

func _check_passed(result: Dictionary, check: String) -> bool:
	var checks: Dictionary = result.get("checks", {})
	return bool(Dictionary(checks.get(check, {})).get("passed", false))

func _all_supported_evidence_passes() -> bool:
	var result: Dictionary = Measure.evaluate(_record(_passing_assignments()))
	return (
		bool(result.get("passed"))
		and int(result.get("placedCount", -1)) == EVIDENCE.size()
		and PackedStringArray(result.get("unplaced", PackedStringArray())).is_empty()
		and PackedStringArray(result.get("unsupportedAssignments", PackedStringArray())).is_empty()
		and PackedStringArray(result.get("occupiedUnsupportable", PackedStringArray())).is_empty()
		and PackedStringArray(result.get("supportedStatements", PackedStringArray())) == PackedStringArray(["self-directed"])
		and _check_passed(result, Measure.CHECK_DECLARATIONS)
		and _check_passed(result, Measure.CHECK_ALL_PLACED)
		and _check_passed(result, Measure.CHECK_SUPPORTS)
		and _check_passed(result, Measure.CHECK_UNSUPPORTED_EMPTY)
	)

func _dictionary_order_does_not_change_the_result() -> bool:
	var reversed := {
		"belonging": "self-directed",
		"independence": "self-directed",
		"need": "self-directed",
		"context": "self-directed"
	}
	var result: Dictionary = Measure.evaluate(_record(reversed))
	return bool(result.get("passed")) and int(result.get("placedCount", -1)) == 4

func _a_declared_choice_between_two_targets_can_pass() -> bool:
	var evidence := [{"id": "shared", "label": "This fact supports either precise statement."}]
	var statements := [
		{"id": "first", "label": "First supported statement"},
		{"id": "second", "label": "Second supported statement"},
		{"id": "absolute", "label": "Unsupported absolute statement"}
	]
	var common := {
		"evidence": evidence,
		"statements": statements,
		"supports": {"shared": ["first", "second"]}
	}
	var first: Dictionary = Measure.evaluate(common.merged({"assignments": {"shared": "first"}}, true))
	var second: Dictionary = Measure.evaluate(common.merged({"assignments": {"shared": "second"}}, true))
	return bool(first.get("passed")) and bool(second.get("passed"))

func _one_unplaced_chip_fails() -> bool:
	var assignments := _passing_assignments()
	assignments.erase("belonging")
	var result: Dictionary = Measure.evaluate(_record(assignments))
	return (
		not bool(result.get("passed"))
		and PackedStringArray(result.get("unplaced", PackedStringArray())) == PackedStringArray(["belonging"])
		and not _check_passed(result, Measure.CHECK_ALL_PLACED)
		and _check_passed(result, Measure.CHECK_SUPPORTS)
	)

func _one_wrong_target_fails() -> bool:
	var assignments := _passing_assignments()
	assignments["context"] = "cheapest"
	var result: Dictionary = Measure.evaluate(_record(assignments))
	return (
		not bool(result.get("passed"))
		and PackedStringArray(result.get("unsupportedAssignments", PackedStringArray())) == PackedStringArray(["context->cheapest"])
		and not _check_passed(result, Measure.CHECK_SUPPORTS)
	)

func _an_unsupportable_statement_must_stay_empty() -> bool:
	var assignments := _passing_assignments()
	assignments["belonging"] = "adult-control"
	var result: Dictionary = Measure.evaluate(_record(assignments))
	return (
		not bool(result.get("passed"))
		and PackedStringArray(result.get("occupiedUnsupportable", PackedStringArray())) == PackedStringArray(["adult-control"])
		and not _check_passed(result, Measure.CHECK_UNSUPPORTED_EMPTY)
	)

func _unknown_and_duplicate_ids_fail_closed() -> bool:
	var unknown_assignments := _passing_assignments()
	unknown_assignments["invented"] = "self-directed"
	var unknown: Dictionary = Measure.evaluate(_record(unknown_assignments))
	var duplicate_evidence := EVIDENCE.duplicate(true)
	duplicate_evidence.append({"id": "context", "label": "Duplicate"})
	var duplicate: Dictionary = Measure.evaluate(
		_record(_passing_assignments(), {"evidence": duplicate_evidence})
	)
	return (
		not bool(unknown.get("passed"))
		and not _check_passed(unknown, Measure.CHECK_DECLARATIONS)
		and PackedStringArray(unknown.get("invalidAssignments", PackedStringArray())) == PackedStringArray(["invented->self-directed"])
		and not bool(duplicate.get("passed"))
		and not _check_passed(duplicate, Measure.CHECK_DECLARATIONS)
		and not PackedStringArray(duplicate.get("declarationErrors", PackedStringArray())).is_empty()
	)

func _malformed_support_relations_fail_closed() -> bool:
	var unknown_target: Dictionary = Measure.evaluate(
		_record(_passing_assignments(), {"supports": SUPPORTS.merged({"context": ["invented"]}, true)})
	)
	var missing_relation := SUPPORTS.duplicate(true)
	missing_relation.erase("need")
	var missing: Dictionary = Measure.evaluate(
		_record(_passing_assignments(), {"supports": missing_relation})
	)
	return (
		not bool(unknown_target.get("passed"))
		and not bool(missing.get("passed"))
		and not _check_passed(unknown_target, Measure.CHECK_DECLARATIONS)
		and not _check_passed(missing, Measure.CHECK_DECLARATIONS)
	)

func _negative_control_rejects_the_surface_word_match() -> bool:
	# "Belonging" and "trend" can sound socially related, but the brief does not support
	# the whole trend-copy claim. Moving only that chip must turn a known pass into a fail.
	var statements := STATEMENTS.duplicate(true)
	statements.append({"id": "trend-copy", "label": "Belonging means copying every trend."})
	var assignments := _passing_assignments()
	assignments["belonging"] = "trend-copy"
	var result: Dictionary = Measure.evaluate(
		_record(assignments, {"statements": statements})
	)
	return (
		not bool(result.get("passed"))
		and PackedStringArray(result.get("unsupportedAssignments", PackedStringArray())).has("belonging->trend-copy")
	)

func _stage_record() -> Dictionary:
	return {
		"engine": "drag-to-target",
		"scene": STAGE_PATH,
		"instruction": "Place every brief fact on the interpretation it supports.",
		"sourceHeading": "BRIEF FACTS",
		"targetHeading": "AUDIENCE INTERPRETATIONS",
		"evidence": EVIDENCE.duplicate(true),
		"statements": STATEMENTS.duplicate(true),
		"supports": SUPPORTS.duplicate(true),
		"checkPhrases": {
			Measure.CHECK_ALL_PLACED: "all facts placed",
			Measure.CHECK_SUPPORTS: "each fact supports its statement",
			Measure.CHECK_UNSUPPORTED_EMPTY: "unsupported statements empty"
		},
		"unmetSentences": {
			Measure.CHECK_DECLARATIONS: "This evidence task is incomplete.",
			Measure.CHECK_ALL_PLACED: "Place every brief fact before checking.",
			Measure.CHECK_SUPPORTS: "{evidence} does not support {statement}. Move it to a statement supported by the whole fact.",
			Measure.CHECK_UNSUPPORTED_EMPTY: "{statement} has no supporting evidence. Return its chips to the brief."
		},
		"wonSentence": "All four brief facts support {statement}.",
		"evidenceSentence": "The four brief facts support {statement}, so the audience decision uses the stated context, need and values.",
		"subjectPhrase": "the audience interpretation"
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

func _evidence_button(stage: Control, evidence_id: String) -> Button:
	return stage.get_node_or_null(
		"Workspace/EvidencePanel/EvidenceColumn/EvidenceBank/Evidence_%s" % _safe_id(evidence_id)
	) as Button

func _statement_button(stage: Control, statement_id: String) -> Button:
	return stage.get_node_or_null(
		"Workspace/StatementsPanel/StatementsColumn/StatementCards/Statement_%s/StatementButton" % _safe_id(statement_id)
	) as Button

func _catalog_supplies_two_distinct_target_records() -> bool:
	var audience: Dictionary = Catalog.mission("audience-brief").get("demonstration", {})
	var claim: Dictionary = Catalog.mission("claim-proof").get("demonstration", {})
	var audience_supports: Dictionary = audience.get("supports", {})
	var claim_supports: Dictionary = claim.get("supports", {})
	return (
		not audience.is_empty()
		and not claim.is_empty()
		and audience != claim
		and String(audience.get("scene", "")) == STAGE_PATH
		and String(claim.get("scene", "")) == STAGE_PATH
		and Array(audience.get("evidence", [])).size() == 4
		and Array(claim.get("evidence", [])).size() == 3
		and Array(audience_supports.get("belonging", [])).has("self-directed")
		and String(audience.get("instruction", "")).begins_with("Match each brief fact")
		and String(audience.get("sourceHeading", "")) == "FACTS FROM THE BRIEF"
		and String(audience.get("targetHeading", "")) == "WHAT THE FACTS PROVE"
		and Array(claim_supports.get("reorder", [])).has("qualified-benefit")
		and not String(audience.get("evidenceSentence", "")).is_empty()
		and not String(claim.get("evidenceSentence", "")).is_empty()
	)

func _the_stage_builds_the_record_contract() -> bool:
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	var bank := stage.get_node("Workspace/EvidencePanel/EvidenceColumn/EvidenceBank") as Control
	var cards := stage.get_node("Workspace/StatementsPanel/StatementsColumn/StatementCards") as Control
	var opening: Dictionary = stage.call("current_result")
	stage.call("focus_target")
	await _settle_stage()
	var first := _evidence_button(stage, "context")
	var first_statement := _statement_button(stage, "self-directed")
	var keyboard_hint := stage.get_node("KeyboardHint") as Label
	var check_button := stage.get_node("ActionsRow/CheckButton") as Button
	var holds := (
		bank.get_child_count() == 4
		and first_statement.text == "Put selected card here"
		and keyboard_hint.text.begins_with("Select a card")
		and check_button.text == "Check matches"
		and cards.get_child_count() == 3
		and int(opening.get("placedCount", -1)) == 0
		and PackedStringArray(opening.get("unplaced", PackedStringArray())).size() == 4
		and not bool(opening.get("passed"))
		and first != null
		and stage.get_viewport().gui_get_focus_owner() == first
	)
	stage.queue_free()
	return holds

func _click_assignment_and_reset_work() -> bool:
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	var evidence := _evidence_button(stage, "context")
	var supported := _statement_button(stage, "self-directed")
	if evidence == null or supported == null:
		stage.queue_free()
		return false
	evidence.pressed.emit()
	supported.pressed.emit()
	await _settle_stage()
	var placed: Dictionary = stage.call("current_result")
	var placed_correctly := (
		int(placed.get("placedCount", -1)) == 1
		and String(Dictionary(placed.get("assignments", {})).get("context", "")) == "self-directed"
	)
	var reset := stage.get_node("ActionsRow/ResetButton") as Button
	reset.pressed.emit()
	await _settle_stage()
	var restored: Dictionary = stage.call("current_result")
	var holds := placed_correctly and int(restored.get("placedCount", -1)) == 0
	stage.queue_free()
	return holds

func _dragging_a_chip_to_a_supported_statement_works() -> bool:
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	var evidence := _evidence_button(stage, "context")
	var target := _statement_button(stage, "self-directed")
	if evidence == null or target == null:
		stage.queue_free()
		return false
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	press.position = evidence.size * 0.5
	press.global_position = evidence.get_global_rect().get_center()
	evidence.gui_input.emit(press)
	var release := InputEventMouseButton.new()
	release.button_index = MOUSE_BUTTON_LEFT
	release.pressed = false
	release.position = evidence.size * 0.5
	release.global_position = target.get_global_rect().get_center()
	evidence.gui_input.emit(release)
	await _settle_stage()
	var result: Dictionary = stage.call("current_result")
	var holds := String(Dictionary(result.get("assignments", {})).get("context", "")) == "self-directed"
	stage.queue_free()
	return holds

func _completion_waits_for_an_explicit_finish() -> bool:
	var record := _stage_record()
	var stage := _stage_in_tree(record)
	if stage == null:
		return false
	await _settle_stage()
	var submitted := []
	stage.connect("arrangement_submitted", func(result: Dictionary) -> void: submitted.append(result))
	for evidence_value: Variant in Array(record.get("evidence", [])):
		stage.call("assign_evidence", String(Dictionary(evidence_value).get("id", "")), "self-directed")
	var check := stage.get_node("ActionsRow/CheckButton") as Button
	check.pressed.emit()
	await _settle_stage()
	var awaiting_finish := submitted.is_empty() and check.text == "Finish task" and not check.disabled
	check.pressed.emit()
	await _settle_stage()
	var final: Dictionary = submitted[0] if submitted.size() == 1 else {}
	var holds := (
		awaiting_finish
		and submitted.size() == 1
		and bool(final.get("passed"))
		and String(final.get("evidence", "")).contains("audience")
		and String(final.get("evidence", "")).contains("four brief facts")
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
	var opened: Dictionary = controller.call("open_mission", "audience-brief", "strategist")
	var chosen: Dictionary = controller.call("choose", "independence")
	var continued: Dictionary = controller.call("continue_to_demonstration")
	await _settle_stage()
	var host := panel.get_node("Backdrop/Dialog/Margin/Content/DemonstrationStage") as Control
	var stage := host.get_child(0) as Control if host.get_child_count() == 1 else null
	if stage == null:
		controller.free()
		panel.queue_free()
		return false
	var first := _evidence_button(stage, "context")
	var focus_owner := stage.get_viewport().gui_get_focus_owner()
	var focused := focus_owner == first
	assert(focused, "focus owner=%s first=%s" % [focus_owner, first])
	var dialog := panel.get_node("Backdrop/Dialog") as PanelContainer
	var dialog_minimum := dialog.get_combined_minimum_size()
	var fits := dialog_minimum.y <= 760.0
	assert(fits, "dialog minimum=%s" % dialog_minimum)
	var demonstration: Dictionary = Catalog.mission("audience-brief").get("demonstration", {})
	for evidence_value: Variant in Array(demonstration.get("evidence", [])):
		stage.call("assign_evidence", String(Dictionary(evidence_value).get("id", "")), "self-directed")
	var check := stage.get_node("ActionsRow/CheckButton") as Button
	check.pressed.emit()
	await _settle_stage()
	var completion_visible := (
		String(controller.call("snapshot").get("state", "")) == "demonstration"
		and check.text == "Finish task"
	)
	check.pressed.emit()
	await _settle_stage()
	var evidence: Dictionary = Dictionary(progress.get("evidence_by_mission")).get("audience-brief", {})
	var effect := String(evidence.get("effect", ""))
	var holds := (
		bool(opened.get("allowed"))
		and bool(chosen.get("correct"))
		and String(continued.get("state", "")) == "demonstration"
		and focused
		and fits
		and completion_visible
		and String(controller.call("snapshot").get("state", "")) == "completed"
		and String(evidence.get("decision", "")) == "independence"
		and effect.contains("audience")
		and effect.contains("brief facts")
	)
	controller.free()
	panel.queue_free()
	return holds
