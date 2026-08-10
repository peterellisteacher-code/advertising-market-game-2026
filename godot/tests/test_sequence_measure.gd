extends RefCounted
class_name AdMarketTestSequenceMeasure

# Engine E measures prerequisite edges in a sequence. It does not compare the
# arrangement with one hidden authored order when the declared partial order permits
# more than one valid solution.

const Measure = preload("res://src/agency/missions/demonstrations/sequence_measure.gd")
const Catalog = preload("res://src/agency/agency_mission_catalog.gd")
const PanelScene = preload("res://src/agency/missions/AgencyMissionPanel.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")
const CONTROLLER_PATH := "res://src/agency/missions/agency_mission_controller.gd"
const STAGE_PATH := "res://src/agency/missions/demonstrations/SequenceStage.tscn"

const AIDA_CARDS := [
	{"id": "attention", "label": "Attention"},
	{"id": "interest", "label": "Interest"},
	{"id": "desire", "label": "Desire"},
	{"id": "action", "label": "Action"}
]
const AIDA_CONSTRAINTS := [
	{"before": "attention", "after": "interest"},
	{"before": "interest", "after": "desire"},
	{"before": "desire", "after": "action"}
]

func run() -> bool:
	assert(_aida_order_passes())
	assert(_violated_prerequisite_fails())
	assert(_partial_order_accepts_two_distinct_orders())
	assert(_missing_duplicate_and_unknown_cards_fail_closed())
	assert(_malformed_constraints_fail_closed())
	assert(_negative_control_rejects_independent_stage_matching())
	assert(ResourceLoader.exists(STAGE_PATH), "Engine E SequenceStage.tscn has not been built.")
	assert(_catalog_supplies_two_distinct_sequence_records())
	assert(await _the_stage_builds_the_record_contract())
	assert(await _button_keyboard_and_drag_reordering_work())
	assert(await _reading_path_changes_with_the_sequence())
	assert(await _completion_waits_for_an_explicit_finish())
	assert(await _the_panel_focuses_the_first_card_and_records_evidence())
	return true

func _record(order: Array, overrides: Dictionary = {}) -> Dictionary:
	var record := {
		"cards": AIDA_CARDS.duplicate(true),
		"constraints": AIDA_CONSTRAINTS.duplicate(true),
		"order": order.duplicate()
	}
	for key: Variant in overrides:
		record[key] = overrides[key]
	return record

func _check_passed(result: Dictionary, check: String) -> bool:
	var checks: Dictionary = result.get("checks", {})
	return bool(Dictionary(checks.get(check, {})).get("passed", false))

func _aida_order_passes() -> bool:
	var result: Dictionary = Measure.evaluate(
		_record(["attention", "interest", "desire", "action"])
	)
	return (
		bool(result.get("passed"))
		and int(result.get("metConstraintCount", -1)) == 3
		and PackedStringArray(result.get("unmetConstraints", PackedStringArray())).is_empty()
		and _check_passed(result, Measure.CHECK_DECLARATIONS)
		and _check_passed(result, Measure.CHECK_PERMUTATION)
		and _check_passed(result, Measure.CHECK_CONSTRAINTS)
	)

func _violated_prerequisite_fails() -> bool:
	var result: Dictionary = Measure.evaluate(
		_record(["attention", "desire", "interest", "action"])
	)
	return (
		not bool(result.get("passed"))
		and PackedStringArray(result.get("unmetConstraints", PackedStringArray())) == PackedStringArray(["interest->desire"])
		and not _check_passed(result, Measure.CHECK_CONSTRAINTS)
	)

func _partial_order_accepts_two_distinct_orders() -> bool:
	var cards := [
		{"id": "image", "label": "Product image"},
		{"id": "headline", "label": "Headline"},
		{"id": "proof", "label": "Proof detail"},
		{"id": "action", "label": "Action"}
	]
	var constraints := [
		{"before": "image", "after": "headline"},
		{"before": "headline", "after": "action"}
	]
	var first: Dictionary = Measure.evaluate({
		"cards": cards,
		"constraints": constraints,
		"order": ["image", "headline", "proof", "action"]
	})
	var second: Dictionary = Measure.evaluate({
		"cards": cards,
		"constraints": constraints,
		"order": ["proof", "image", "headline", "action"]
	})
	return bool(first.get("passed")) and bool(second.get("passed"))

func _missing_duplicate_and_unknown_cards_fail_closed() -> bool:
	var missing: Dictionary = Measure.evaluate(
		_record(["attention", "interest", "desire"])
	)
	var duplicate: Dictionary = Measure.evaluate(
		_record(["attention", "interest", "desire", "desire"])
	)
	var unknown: Dictionary = Measure.evaluate(
		_record(["attention", "interest", "desire", "invented"])
	)
	return (
		not bool(missing.get("passed"))
		and PackedStringArray(missing.get("missingCards", PackedStringArray())) == PackedStringArray(["action"])
		and not bool(duplicate.get("passed"))
		and PackedStringArray(duplicate.get("duplicateCards", PackedStringArray())) == PackedStringArray(["desire"])
		and not bool(unknown.get("passed"))
		and PackedStringArray(unknown.get("unknownCards", PackedStringArray())) == PackedStringArray(["invented"])
	)

func _malformed_constraints_fail_closed() -> bool:
	var unknown_edge: Dictionary = Measure.evaluate(
		_record(
			["attention", "interest", "desire", "action"],
			{"constraints": [{"before": "attention", "after": "invented"}]}
		)
	)
	var self_edge: Dictionary = Measure.evaluate(
		_record(
			["attention", "interest", "desire", "action"],
			{"constraints": [{"before": "attention", "after": "attention"}]}
		)
	)
	return (
		not bool(unknown_edge.get("passed"))
		and not _check_passed(unknown_edge, Measure.CHECK_DECLARATIONS)
		and not bool(self_edge.get("passed"))
		and not _check_passed(self_edge, Measure.CHECK_DECLARATIONS)
	)

func _negative_control_rejects_independent_stage_matching() -> bool:
	# All four correct AIDA labels are present. Treating them as independent cards would
	# accept this arrangement, but the prerequisite edge Interest -> Desire is broken.
	var result: Dictionary = Measure.evaluate(
		_record(["attention", "desire", "interest", "action"])
	)
	return (
		not bool(result.get("passed"))
		and int(result.get("cardCount", -1)) == AIDA_CARDS.size()
		and not _check_passed(result, Measure.CHECK_CONSTRAINTS)
	)

func _stage_record() -> Dictionary:
	return {
		"engine": "sequence-cards",
		"scene": STAGE_PATH,
		"instruction": "Put the AIDA stages in the order that builds a reason to act.",
		"cards": AIDA_CARDS.duplicate(true),
		"constraints": AIDA_CONSTRAINTS.duplicate(true),
		"initialOrder": ["action", "desire", "interest", "attention"],
		"drawPath": false,
		"checkPhrases": {
			Measure.CHECK_PERMUTATION: "every stage used once",
			Measure.CHECK_CONSTRAINTS: "each stage prepares the next"
		},
		"unmetSentences": {
			Measure.CHECK_DECLARATIONS: "This sequence task is incomplete.",
			Measure.CHECK_PERMUTATION: "Use every stage exactly once.",
			Measure.CHECK_CONSTRAINTS: "{before} must come before {after}. Move one card, then check again."
		},
		"wonSentence": "The sequence now moves from {first} to {last} through every required stage.",
		"evidenceSentence": "The sequence places {order}, so each stage prepares the audience for the next.",
		"subjectPhrase": "the AIDA sequence"
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

func _card_button(stage: Control, card_id: String) -> Button:
	return stage.get_node_or_null(
		"Workspace/SequencePanel/SequenceColumn/CardSurface/CardGrid/Card_%s" % _safe_id(card_id)
	) as Button

func _visual_card_order(stage: Control) -> PackedStringArray:
	var visual_order := PackedStringArray()
	var grid := stage.get_node(
		"Workspace/SequencePanel/SequenceColumn/CardSurface/CardGrid"
	) as GridContainer
	for child: Node in grid.get_children():
		visual_order.append(String(child.get_meta("card_id", "")))
	return visual_order

func _path_matches_visual_card_order(stage: Control, line: Line2D) -> bool:
	var grid := stage.get_node(
		"Workspace/SequencePanel/SequenceColumn/CardSurface/CardGrid"
	) as GridContainer
	if line.points.size() != grid.get_child_count():
		return false
	for index in range(grid.get_child_count()):
		var button := grid.get_child(index) as Button
		var expected := line.to_local(button.get_global_rect().get_center())
		if line.points[index].distance_to(expected) > 1.0:
			return false
	return true

func _catalog_supplies_two_distinct_sequence_records() -> bool:
	var aida: Dictionary = Catalog.mission("aida").get("demonstration", {})
	var reading_path: Dictionary = Catalog.mission("reading-path").get("demonstration", {})
	return (
		not aida.is_empty()
		and not reading_path.is_empty()
		and aida != reading_path
		and String(aida.get("scene", "")) == STAGE_PATH
		and String(reading_path.get("scene", "")) == STAGE_PATH
		and Array(aida.get("cards", [])).size() == 4
		and Array(reading_path.get("cards", [])).size() == 3
		and Array(aida.get("constraints", [])).size() == 3
		and Array(reading_path.get("constraints", [])).size() == 2
		and not bool(aida.get("drawPath", true))
		and bool(reading_path.get("drawPath", false))
		and not String(aida.get("evidenceSentence", "")).is_empty()
		and not String(reading_path.get("evidenceSentence", "")).is_empty()
	)

func _the_stage_builds_the_record_contract() -> bool:
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	var grid := stage.get_node(
		"Workspace/SequencePanel/SequenceColumn/CardSurface/CardGrid"
	) as Control
	var opening: Dictionary = stage.call("current_result")
	stage.call("focus_target")
	await _settle_stage()
	var first := _card_button(stage, "attention")
	var holds := (
		grid.get_child_count() == 4
		and PackedStringArray(opening.get("order", PackedStringArray())) == PackedStringArray(["action", "desire", "interest", "attention"])
		and not bool(opening.get("passed"))
		and first != null
		and stage.get_viewport().gui_get_focus_owner() == first
	)
	stage.queue_free()
	return holds

func _button_keyboard_and_drag_reordering_work() -> bool:
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	var attention := _card_button(stage, "attention")
	var action := _card_button(stage, "action")
	var move_left := stage.get_node("MoveRow/MoveLeftButton") as Button
	if attention == null or action == null or move_left == null:
		stage.queue_free()
		return false
	attention.pressed.emit()
	move_left.pressed.emit()
	await _settle_stage()
	var button_order: PackedStringArray = stage.call("order_ids")
	var button_works := (
		button_order == PackedStringArray(["action", "desire", "attention", "interest"])
		and _visual_card_order(stage) == button_order
	)

	var key := InputEventKey.new()
	key.keycode = KEY_LEFT
	key.pressed = true
	attention.gui_input.emit(key)
	await _settle_stage()
	var keyboard_order: PackedStringArray = stage.call("order_ids")
	var keyboard_works := (
		keyboard_order == PackedStringArray(["action", "attention", "desire", "interest"])
		and _visual_card_order(stage) == keyboard_order
	)

	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	press.global_position = attention.get_global_rect().get_center()
	attention.gui_input.emit(press)
	var release := InputEventMouseButton.new()
	release.button_index = MOUSE_BUTTON_LEFT
	release.pressed = false
	release.global_position = action.get_global_rect().get_center()
	attention.gui_input.emit(release)
	await _settle_stage()
	var drag_order: PackedStringArray = stage.call("order_ids")
	var drag_works := drag_order[0] == "attention" and _visual_card_order(stage) == drag_order

	(stage.get_node("ActionsRow/ResetButton") as Button).pressed.emit()
	await _settle_stage()
	var reset_order: PackedStringArray = stage.call("order_ids")
	var reset_works := (
		reset_order == PackedStringArray(["action", "desire", "interest", "attention"])
		and _visual_card_order(stage) == reset_order
	)
	stage.queue_free()
	return button_works and keyboard_works and drag_works and reset_works

func _reading_path_changes_with_the_sequence() -> bool:
	var record: Dictionary = Catalog.mission("reading-path").get("demonstration", {})
	var stage := _stage_in_tree(record)
	if stage == null:
		return false
	await _settle_stage()
	var line := stage.get_node(
		"Workspace/SequencePanel/SequenceColumn/CardSurface/ReadingPath"
	) as Line2D
	var before_order := _visual_card_order(stage)
	stage.call("move_card", "image", -1)
	await _settle_stage()
	var after_order := _visual_card_order(stage)
	var holds := (
		line.visible
		and before_order != after_order
		and after_order == PackedStringArray(stage.call("order_ids"))
		and _path_matches_visual_card_order(stage, line)
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
	stage.call("set_order", ["attention", "interest", "desire", "action"])
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
		and String(final.get("evidence", "")).contains("Attention")
		and String(final.get("evidence", "")).contains("Action")
	)
	stage.queue_free()
	return holds

func _the_panel_focuses_the_first_card_and_records_evidence() -> bool:
	var tree := Engine.get_main_loop() as SceneTree
	var progress: RefCounted = AgencyProgress.new()
	if not bool(progress.call("begin")):
		return false
	var panel := PanelScene.instantiate() as Control
	tree.root.add_child(panel)
	var controller := (load(CONTROLLER_PATH) as Script).new() as Node
	controller.call("configure", progress, panel)
	var opened: Dictionary = controller.call("open_mission", "aida", "strategist")
	var chosen: Dictionary = controller.call("choose", "aida-complete")
	var continued: Dictionary = controller.call("continue_to_demonstration")
	await _settle_stage()
	var host := panel.get_node("Backdrop/Dialog/Margin/Content/DemonstrationStage") as Control
	var stage := host.get_child(0) as Control if host.get_child_count() == 1 else null
	if stage == null:
		controller.free()
		panel.queue_free()
		return false
	var first := _card_button(stage, "attention")
	var focused := stage.get_viewport().gui_get_focus_owner() == first
	var dialog := panel.get_node("Backdrop/Dialog") as PanelContainer
	var fits := dialog.get_combined_minimum_size().y <= 760.0
	stage.call("set_order", ["attention", "interest", "desire", "action"])
	var check := stage.get_node("ActionsRow/CheckButton") as Button
	check.pressed.emit()
	await _settle_stage()
	var completion_visible := (
		String(controller.call("snapshot").get("state", "")) == "demonstration"
		and check.text == "Finish task"
	)
	check.pressed.emit()
	await _settle_stage()
	var evidence: Dictionary = Dictionary(progress.get("evidence_by_mission")).get("aida", {})
	var effect := String(evidence.get("effect", ""))
	var holds := (
		bool(opened.get("allowed"))
		and bool(chosen.get("correct"))
		and String(continued.get("state", "")) == "demonstration"
		and focused
		and fits
		and completion_visible
		and String(controller.call("snapshot").get("state", "")) == "completed"
		and String(evidence.get("decision", "")) == "aida-complete"
		and effect.contains("Attention")
		and effect.contains("Action")
	)
	controller.free()
	panel.queue_free()
	return holds
