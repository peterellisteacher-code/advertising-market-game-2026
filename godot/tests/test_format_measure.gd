extends RefCounted
class_name AdMarketTestFormatMeasure

# Engine G measures the chosen composition inside its selected viewing frame. The format
# name alone never passes: headline length, subject scale and containment all matter.

const Measure = preload("res://src/agency/missions/demonstrations/format_measure.gd")
const Catalog = preload("res://src/agency/agency_mission_catalog.gd")
const PanelScene = preload("res://src/agency/missions/AgencyMissionPanel.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")
const CONTROLLER_PATH := "res://src/agency/missions/agency_mission_controller.gd"
const STAGE_PATH := "res://src/agency/missions/demonstrations/FormatStage.tscn"

const FORMATS := [
	{
		"id": "billboard",
		"label": "Billboard",
		"aspect": Vector2(16, 6),
		"viewingCondition": "Seen briefly from a distance.",
		"maxWords": 6,
		"minSubjectCoverage": 0.18
	},
	{
		"id": "vertical",
		"label": "Vertical screen",
		"aspect": Vector2(9, 16),
		"viewingCondition": "Seen nearby in a tall frame.",
		"maxWords": 12,
		"minSubjectCoverage": 0.20
	},
	{
		"id": "poster",
		"label": "Poster",
		"aspect": Vector2(4, 5),
		"viewingCondition": "Seen at walking distance for several seconds.",
		"maxWords": 18,
		"minSubjectCoverage": 0.16
	}
]
const HEADLINES := [
	{"id": "short", "text": "Control your hour. Keep priorities visible.", "wordCount": 6},
	{"id": "medium", "text": "Control your hour and keep every changing priority clearly visible.", "wordCount": 10},
	{"id": "long", "text": "A complete planning system for every changing priority in your productive and independent after-school hour.", "wordCount": 15}
]

func run() -> bool:
	assert(_billboard_composition_passes())
	assert(_word_cap_failure_is_reported())
	assert(_coverage_failure_is_reported())
	assert(_containment_failure_is_reported())
	assert(_coverage_boundary_and_tolerance_are_stable())
	assert(_malformed_frame_data_fails_closed())
	assert(_more_than_one_format_can_pass())
	assert(_negative_control_rejects_the_format_name_alone())
	assert(ResourceLoader.exists(STAGE_PATH), "Engine G FormatStage.tscn has not been built.")
	assert(_catalog_supplies_the_format_record())
	assert(await _the_stage_builds_the_record_contract())
	assert(await _selectors_and_controls_change_the_measured_composition())
	assert(await _the_stage_accepts_all_three_formats())
	assert(await _completion_waits_for_an_explicit_finish())
	assert(await _the_panel_fits_focuses_and_records_evidence())
	return true

func _record(
	format_id: String,
	headline_id: String,
	subject_rect: Rect2,
	overrides: Dictionary = {}
) -> Dictionary:
	var record: Dictionary = {
		"formats": FORMATS.duplicate(true),
		"headlines": HEADLINES.duplicate(true),
		"formatId": format_id,
		"headlineId": headline_id,
		"subjectRect": subject_rect
	}
	for key: Variant in overrides:
		record[key] = overrides[key]
	return record

func _check_passed(result: Dictionary, check: String) -> bool:
	var checks: Dictionary = result.get("checks", {})
	return bool(Dictionary(checks.get(check, {})).get("passed", false))

func _billboard_composition_passes() -> bool:
	var result: Dictionary = Measure.evaluate(
		_record("billboard", "short", Rect2(3, 0.5, 5, 5))
	)
	return (
		bool(result.get("passed"))
		and is_equal_approx(float(result.get("coverage", 0.0)), 25.0 / 96.0)
		and bool(result.get("contained"))
		and _check_passed(result, Measure.CHECK_WORD_CAP)
		and _check_passed(result, Measure.CHECK_COVERAGE)
		and _check_passed(result, Measure.CHECK_CONTAINMENT)
	)

func _word_cap_failure_is_reported() -> bool:
	var result: Dictionary = Measure.evaluate(
		_record("billboard", "medium", Rect2(3, 0.5, 5, 5))
	)
	return (
		not bool(result.get("passed"))
		and int(result.get("headlineWordCount", -1)) == 10
		and int(result.get("maxWords", -1)) == 6
		and not _check_passed(result, Measure.CHECK_WORD_CAP)
		and _check_passed(result, Measure.CHECK_COVERAGE)
	)

func _coverage_failure_is_reported() -> bool:
	var result: Dictionary = Measure.evaluate(
		_record("billboard", "short", Rect2(5.5, 1.5, 3, 3))
	)
	return (
		not bool(result.get("passed"))
		and float(result.get("coverage", 1.0)) < 0.18
		and not _check_passed(result, Measure.CHECK_COVERAGE)
		and _check_passed(result, Measure.CHECK_CONTAINMENT)
	)

func _containment_failure_is_reported() -> bool:
	var result: Dictionary = Measure.evaluate(
		_record("billboard", "short", Rect2(13, 1, 5, 5))
	)
	return (
		not bool(result.get("passed"))
		and not bool(result.get("contained"))
		and not _check_passed(result, Measure.CHECK_CONTAINMENT)
	)

func _coverage_boundary_and_tolerance_are_stable() -> bool:
	var formats := [{
		"id": "square",
		"label": "Square",
		"aspect": Vector2(10, 10),
		"viewingCondition": "Test frame",
		"maxWords": 6,
		"minSubjectCoverage": 0.20
	}]
	var exact: Dictionary = Measure.evaluate(
		_record("square", "short", Rect2(1, 1, 5, 4), {"formats": formats})
	)
	var within_tolerance: Dictionary = Measure.evaluate(
		_record("square", "short", Rect2(1, 1, 5, 3.999), {"formats": formats})
	)
	var outside_tolerance: Dictionary = Measure.evaluate(
		_record("square", "short", Rect2(1, 1, 5, 3.97), {"formats": formats})
	)
	return (
		bool(exact.get("passed"))
		and bool(within_tolerance.get("passed"))
		and not bool(outside_tolerance.get("passed"))
		and not _check_passed(outside_tolerance, Measure.CHECK_COVERAGE)
	)

func _malformed_frame_data_fails_closed() -> bool:
	var bad_aspect := FORMATS.duplicate(true)
	bad_aspect[0]["aspect"] = Vector2(0, 6)
	var aspect_result: Dictionary = Measure.evaluate(
		_record("billboard", "short", Rect2(3, 0.5, 5, 5), {"formats": bad_aspect})
	)
	var bad_coverage := FORMATS.duplicate(true)
	bad_coverage[0]["minSubjectCoverage"] = 1.2
	var coverage_result: Dictionary = Measure.evaluate(
		_record("billboard", "short", Rect2(3, 0.5, 5, 5), {"formats": bad_coverage})
	)
	var bad_rect: Dictionary = Measure.evaluate(
		_record("billboard", "short", Rect2(3, 0.5, -5, 5))
	)
	var unknown: Dictionary = Measure.evaluate(
		_record("invented", "short", Rect2(3, 0.5, 5, 5))
	)
	return (
		not bool(aspect_result.get("passed"))
		and not bool(coverage_result.get("passed"))
		and not bool(bad_rect.get("passed"))
		and not bool(unknown.get("passed"))
		and not _check_passed(aspect_result, Measure.CHECK_DECLARATIONS)
		and not _check_passed(coverage_result, Measure.CHECK_DECLARATIONS)
		and not _check_passed(bad_rect, Measure.CHECK_DECLARATIONS)
		and not _check_passed(unknown, Measure.CHECK_DECLARATIONS)
	)

func _more_than_one_format_can_pass() -> bool:
	var billboard: Dictionary = Measure.evaluate(
		_record("billboard", "short", Rect2(3, 0.5, 5, 5))
	)
	var vertical: Dictionary = Measure.evaluate(
		_record("vertical", "medium", Rect2(1.5, 5, 6, 6))
	)
	var poster: Dictionary = Measure.evaluate(
		_record("poster", "long", Rect2(1, 1.5, 2, 2))
	)
	return bool(billboard.get("passed")) and bool(vertical.get("passed")) and bool(poster.get("passed"))

func _negative_control_rejects_the_format_name_alone() -> bool:
	# The authored mission choice names the billboard, but an overlong headline and tiny
	# subject still fail. A format-ID-only implementation would incorrectly accept it.
	var result: Dictionary = Measure.evaluate(
		_record("billboard", "long", Rect2(6.5, 2, 2, 2))
	)
	return (
		not bool(result.get("passed"))
		and String(result.get("formatId", "")) == "billboard"
		and not _check_passed(result, Measure.CHECK_WORD_CAP)
		and not _check_passed(result, Measure.CHECK_COVERAGE)
	)

func _stage_record() -> Dictionary:
	return {
		"engine": "format-fit",
		"scene": STAGE_PATH,
		"instruction": "Choose a format and headline, then move and resize the product so the composition can be understood under that format's viewing conditions.",
		"subjectArt": "res://assets/agency/colour/product-mug.png",
		"formats": FORMATS.duplicate(true),
		"headlines": HEADLINES.duplicate(true),
		"initialFormatId": "billboard",
		"initialHeadlineId": "long",
		"initialSubjectRect": Rect2(6.5, 2, 2, 2),
		"checkPhrases": {
			Measure.CHECK_WORD_CAP: "headline fits the viewing time",
			Measure.CHECK_COVERAGE: "product is large enough",
			Measure.CHECK_CONTAINMENT: "whole product remains in the frame"
		},
		"unmetSentences": {
			Measure.CHECK_DECLARATIONS: "This format task is incomplete.",
			Measure.CHECK_WORD_CAP: "The {format} allows {max_words} words, but this headline has {words}. Choose a shorter headline.",
			Measure.CHECK_COVERAGE: "The product fills only {coverage}% of the frame. Make it larger for this viewing condition.",
			Measure.CHECK_CONTAINMENT: "Part of the product is outside the frame. Move it back inside."
		},
		"wonSentence": "The {format} composition now fits its viewing conditions: {words} words, {coverage}% product coverage and the whole product inside the frame.",
		"evidenceSentence": "The {format} composition suits {condition}: its headline uses {words} of {max_words} words, the product fills {coverage}% of the frame, and the whole product remains inside.",
		"subjectPhrase": "the format-fit composition"
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

func _format_button(stage: Control, format_id: String) -> Button:
	return stage.get_node_or_null(
		"Selectors/FormatPanel/FormatColumn/FormatButtons/Format_%s" % format_id
	) as Button

func _catalog_supplies_the_format_record() -> bool:
	var demonstration: Dictionary = Catalog.sidequest("media-match").get("demonstration", {})
	return (
		not demonstration.is_empty()
		and String(demonstration.get("scene", "")) == STAGE_PATH
		and Array(demonstration.get("formats", [])).size() == 3
		and Array(demonstration.get("headlines", [])).size() == 3
		and String(demonstration.get("initialFormatId", "")) == "billboard"
		and String(demonstration.get("initialHeadlineId", "")) == "long"
		and not String(demonstration.get("evidenceSentence", "")).is_empty()
	)

func _the_stage_builds_the_record_contract() -> bool:
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	var formats := stage.get_node(
		"Selectors/FormatPanel/FormatColumn/FormatButtons"
	) as Container
	var headlines := stage.get_node(
		"Selectors/HeadlinePanel/HeadlineColumn/HeadlineButtons"
	) as Container
	var condition := stage.get_node(
		"Workspace/FormatInfo/InfoColumn/ViewingCondition"
	) as Label
	var frame := stage.get_node("Workspace/FrameHolder/FrameSurface") as Control
	var subject := stage.get_node("Workspace/FrameHolder/FrameSurface/SubjectArt") as TextureRect
	var opening: Dictionary = stage.call("current_result")
	stage.call("focus_target")
	await _settle_stage()
	var billboard := _format_button(stage, "billboard")
	var holds := (
		formats.get_child_count() == 3
		and headlines.get_child_count() == 3
		and not bool(opening.get("passed"))
		and not _check_passed(opening, Measure.CHECK_WORD_CAP)
		and not _check_passed(opening, Measure.CHECK_COVERAGE)
		and _check_passed(opening, Measure.CHECK_CONTAINMENT)
		and condition.text.contains("Seen briefly from a distance")
		and is_equal_approx(frame.size.x / frame.size.y, 16.0 / 6.0)
		and subject.texture != null
		and billboard != null
		and stage.get_viewport().gui_get_focus_owner() == billboard
	)
	stage.queue_free()
	return holds

func _selectors_and_controls_change_the_measured_composition() -> bool:
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	var frame := stage.get_node("Workspace/FrameHolder/FrameSurface") as Control
	var condition := stage.get_node(
		"Workspace/FormatInfo/InfoColumn/ViewingCondition"
	) as Label
	stage.call("select_format", "vertical")
	stage.call("select_headline", "medium")
	stage.call("set_subject_rect", Rect2(1.5, 5, 6, 6))
	await _settle_stage()
	var selected: Dictionary = stage.call("current_result")
	var before_rect: Rect2 = selected.get("subjectRect", Rect2())
	var right := stage.get_node("CompositionControls/RightButton") as Button
	var larger := stage.get_node("CompositionControls/LargerButton") as Button
	right.pressed.emit()
	larger.pressed.emit()
	await _settle_stage()
	var adjusted: Dictionary = stage.call("current_result")
	var after_rect: Rect2 = adjusted.get("subjectRect", Rect2())
	var holds := (
		bool(selected.get("passed"))
		and String(selected.get("formatId", "")) == "vertical"
		and String(selected.get("headlineId", "")) == "medium"
		and condition.text.contains("tall frame")
		and is_equal_approx(frame.size.x / frame.size.y, 9.0 / 16.0)
		and after_rect.get_center().x > before_rect.get_center().x
		and after_rect.size.x > before_rect.size.x
	)
	stage.queue_free()
	return holds

func _the_stage_accepts_all_three_formats() -> bool:
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	var passing := 0
	for candidate: Dictionary in [
		{"format": "billboard", "headline": "short", "rect": Rect2(3, 0.5, 5, 5)},
		{"format": "vertical", "headline": "medium", "rect": Rect2(1.5, 5, 6, 6)},
		{"format": "poster", "headline": "long", "rect": Rect2(1, 1.5, 2, 2)}
	]:
		stage.call("select_format", String(candidate.get("format", "")))
		stage.call("select_headline", String(candidate.get("headline", "")))
		stage.call("set_subject_rect", candidate.get("rect", Rect2()))
		if bool(Dictionary(stage.call("current_result")).get("passed")):
			passing += 1
	stage.queue_free()
	return passing == 3

func _completion_waits_for_an_explicit_finish() -> bool:
	var stage := _stage_in_tree(_stage_record())
	if stage == null:
		return false
	await _settle_stage()
	var submitted := []
	stage.connect("arrangement_submitted", func(result: Dictionary) -> void: submitted.append(result))
	stage.call("select_headline", "short")
	stage.call("set_subject_rect", Rect2(3, 0.5, 5, 5))
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
		and evidence.contains("Billboard")
		and evidence.contains("Seen briefly from a distance")
		and evidence.contains("6 of 6 words")
		and evidence.contains("26%")
	)
	stage.queue_free()
	return holds

func _the_panel_fits_focuses_and_records_evidence() -> bool:
	var tree := Engine.get_main_loop() as SceneTree
	var progress: RefCounted = AgencyProgress.new()
	if not bool(progress.call("begin")):
		return false
	var panel := PanelScene.instantiate() as Control
	tree.root.add_child(panel)
	var controller := (load(CONTROLLER_PATH) as Script).new() as Node
	controller.call("configure", progress, panel)
	var opened: Dictionary = controller.call("open_mission", "media-match", "strategist")
	var chosen: Dictionary = controller.call("choose", "billboard-brief")
	var continued: Dictionary = controller.call("continue_to_transfer")
	await _settle_stage()
	var host := panel.get_node("Backdrop/Dialog/Margin/Content/DemonstrationStage") as Control
	var stage := host.get_child(0) as Control if host.get_child_count() == 1 else null
	if stage == null:
		controller.free()
		panel.queue_free()
		return false
	var focused := stage.get_viewport().gui_get_focus_owner() == _format_button(stage, "billboard")
	var dialog := panel.get_node("Backdrop/Dialog") as PanelContainer
	var fits := dialog.get_combined_minimum_size().y <= 760.0
	var submitted := []
	stage.connect("arrangement_submitted", func(result: Dictionary) -> void: submitted.append(result))
	stage.call("select_headline", "short")
	stage.call("set_subject_rect", Rect2(3, 0.5, 5, 5))
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
		and Array(progress.get("completed_sidequest_ids")).has("media-match")
		and submitted.size() == 1
		and effect.contains("Billboard")
		and effect.contains("26%")
	)
	controller.free()
	panel.queue_free()
	return holds
