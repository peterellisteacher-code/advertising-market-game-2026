extends RefCounted
class_name AdMarketTestCropMeasure

# Engine B replaces the framing writing gate with a demonstration. The same two properties
# engine A has to hold apply here:
#
#   * the opening arrangement must NOT already pass, and
#   * a pass must come out of the measure rather than out of matching a stored rectangle.
#
# The second one is established rather than asserted in a comment: five structurally
# different arrangements are shown to pass, which no authored answer could allow.

const Measure = preload("res://src/agency/missions/demonstrations/crop_measure.gd")
const Catalog = preload("res://src/agency/agency_mission_catalog.gd")
const StageScene = preload("res://src/agency/missions/demonstrations/CropStage.tscn")
const PanelScene = preload("res://src/agency/missions/AgencyMissionPanel.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")
const CONTROLLER_PATH := "res://src/agency/missions/agency_mission_controller.gd"

const PICTURE := Vector2(384, 192)
const SUBJECT := Rect2(32, 32, 64, 64)
const SLOGAN_SIZE := Vector2(64, 32)
# Wholly inside the plain block the pattern below lays down, wholly inside the busy left,
# and straddling the boundary between them.
const ON_PLAIN := Vector2(224, 96)
const ON_BUSY := Vector2(32, 96)
const HALF_ON := Vector2(160, 96)

var _record_grid: Dictionary = {}

func run() -> bool:
	assert(_each_check_reads_what_it_names())
	assert(_the_message_checks_are_independent_of_each_other())
	assert(_partly_covering_the_picture_scores_between())
	assert(_every_declared_check_declares_its_own_tolerance())
	assert(_the_containment_tolerance_is_read_in_pixels())
	assert(_a_missing_grid_leaves_the_message_unreadable())
	assert(_a_collapsed_frame_cannot_pass())
	assert(_the_picture_carries_what_the_record_names())
	assert(_the_untouched_arrangement_does_not_pass())
	assert(_many_different_arrangements_pass())
	assert(_a_reason_from_the_stage_reaches_the_pair())
	assert(await _dragging_solves_it_and_resetting_undoes_it())
	assert(await _the_readout_comes_from_the_record())
	assert(await _the_panel_records_measured_evidence())
	return true

# Building the readout and the handles queues frees, and a node the stage keeps a
# reference to has to still be there afterwards.
func _settle() -> void:
	var tree := Engine.get_main_loop() as SceneTree
	await tree.process_frame
	await tree.process_frame

# A detail grid written out as characters, one per cell of picture: '.' is plain, '#' is
# busy. Twelve columns by six rows of 32px cells is the 384x192 picture these unit checks
# use, so the plain block below is x 192..384, y 64..160.
func _grid(pattern: PackedStringArray) -> Dictionary:
	var rows := pattern.size()
	var cols := pattern[0].length()
	var plain := PackedByteArray()
	plain.resize(cols * rows)
	for row in rows:
		for col in cols:
			plain[row * cols + col] = 1 if pattern[row][col] == "." else 0
	return {"cols": cols, "rows": rows, "cell": Measure.DETAIL_CELL, "plain": plain}

func _pattern() -> PackedStringArray:
	return PackedStringArray([
		"############",
		"############",
		"######......",
		"######......",
		"######......",
		"############"
	])

func _scene(crop: Rect2, slogan_position: Vector2, overrides: Dictionary = {}) -> Dictionary:
	var scene := {
		"imageSize": PICTURE,
		"subjectRegion": SUBJECT,
		"crop": crop,
		"slogan": Rect2(slogan_position, SLOGAN_SIZE),
		"minSubjectShare": 0.05,
		"minPlainShare": 0.9,
		"detailGrid": _grid(_pattern())
	}
	for key: Variant in overrides:
		scene[key] = overrides[key]
	return scene

func _value(result: Dictionary, check: String) -> float:
	return float(Dictionary(Dictionary(result.get("checks", {})).get(check, {})).get("value", 0.0))

func _met(result: Dictionary, check: String) -> bool:
	return bool(Dictionary(Dictionary(result.get("checks", {})).get(check, {})).get("passed", false))

func _each_check_reads_what_it_names() -> bool:
	# Containment is a distance in picture pixels and is zero while the whole region is in
	# frame, negative by however far the worst side cuts into it.
	var whole: Dictionary = Measure.evaluate(_scene(Rect2(Vector2.ZERO, PICTURE), ON_PLAIN))
	assert(is_zero_approx(_value(whole, Measure.CHECK_SUBJECT)))
	var cutting: Dictionary = Measure.evaluate(_scene(Rect2(52, 32, 200, 150), ON_PLAIN))
	assert(is_equal_approx(_value(cutting, Measure.CHECK_SUBJECT), -20.0))
	assert(not _met(cutting, Measure.CHECK_SUBJECT))

	# Prominence is the kept subject over the frame: 64x64 of a 384x192 picture.
	assert(is_equal_approx(_value(whole, Measure.CHECK_PROMINENCE), 4096.0 / 73728.0))
	# The slogan is wholly on the plain block, so all of its own area is on plain pixels.
	assert(is_equal_approx(_value(whole, Measure.CHECK_MESSAGE_CLEAR), 1.0))
	assert(is_zero_approx(_value(whole, Measure.CHECK_MESSAGE_IN_FRAME)))
	assert(whole.get("passed") == true)

	# Each threshold moves only its own check.
	var too_small: Dictionary = Measure.evaluate(
		_scene(Rect2(Vector2.ZERO, PICTURE), ON_PLAIN, {"minSubjectShare": 0.5})
	)
	assert(not _met(too_small, Measure.CHECK_PROMINENCE))
	assert(_met(too_small, Measure.CHECK_MESSAGE_CLEAR))
	assert(PackedStringArray(too_small.get("unmet")) == PackedStringArray([Measure.CHECK_PROMINENCE]))
	assert(too_small.get("passed") == false)

	# A slogan laid across the busy side reads none of its area as plain.
	var covering: Dictionary = Measure.evaluate(_scene(Rect2(Vector2.ZERO, PICTURE), ON_BUSY))
	assert(is_zero_approx(_value(covering, Measure.CHECK_MESSAGE_CLEAR)))
	assert(not _met(covering, Measure.CHECK_MESSAGE_CLEAR))
	assert(covering.get("passed") == false)
	return true

func _the_message_checks_are_independent_of_each_other() -> bool:
	# Being inside the frame and being readable are separate failures with separate fixes,
	# so neither may stand in for the other. A slogan sitting perfectly on the plain block
	# but outside the frame is not in the advertisement at all.
	var outside: Dictionary = Measure.evaluate(_scene(Rect2(0, 0, 192, 192), ON_PLAIN))
	assert(not _met(outside, Measure.CHECK_MESSAGE_IN_FRAME))
	assert(is_equal_approx(_value(outside, Measure.CHECK_MESSAGE_IN_FRAME), -96.0))
	assert(_met(outside, Measure.CHECK_MESSAGE_CLEAR))
	assert(outside.get("passed") == false)

	# And the reverse: inside the frame, lying across the picture.
	var covered: Dictionary = Measure.evaluate(_scene(Rect2(Vector2.ZERO, PICTURE), ON_BUSY))
	assert(_met(covered, Measure.CHECK_MESSAGE_IN_FRAME))
	assert(not _met(covered, Measure.CHECK_MESSAGE_CLEAR))
	return true

func _partly_covering_the_picture_scores_between() -> bool:
	# Cells are weighted by how much of each one the slogan actually covers, so the figure
	# moves as the slogan is dragged instead of stepping a whole cell at a time. Half on the
	# plain block reads half, which is what stops a slogan being nudged one pixel clear of a
	# cell boundary and counting as fully readable.
	var half: Dictionary = Measure.evaluate(_scene(Rect2(Vector2.ZERO, PICTURE), HALF_ON))
	assert(is_equal_approx(_value(half, Measure.CHECK_MESSAGE_CLEAR), 0.5))
	assert(not _met(half, Measure.CHECK_MESSAGE_CLEAR))

	# A quarter of the way further across is a quarter more readable: the figure is a real
	# proportion and not three states wearing a float.
	var mostly: Dictionary = Measure.evaluate(
		_scene(Rect2(Vector2.ZERO, PICTURE), HALF_ON + Vector2(16, 0))
	)
	assert(is_equal_approx(_value(mostly, Measure.CHECK_MESSAGE_CLEAR), 0.75))
	return true

func _every_declared_check_declares_its_own_tolerance() -> bool:
	# A check with no declared tolerance reports itself unmet rather than borrowing
	# another's. Engine A shipped a contrast lever that inherited a normalised figure three
	# orders of magnitude too small for its scale, and sampling noise picked the winner.
	# The guard only helps while every check that exists is actually listed.
	for check: String in Measure.CHECKS:
		assert(Measure.CHECK_EPSILON.has(check))
	# The two containment checks are in picture pixels and the other two are dimensionless
	# shares, so one figure cannot serve all four.
	assert(
		float(Measure.CHECK_EPSILON[Measure.CHECK_SUBJECT])
		!= float(Measure.CHECK_EPSILON[Measure.CHECK_PROMINENCE])
	)
	assert(
		float(Measure.CHECK_EPSILON[Measure.CHECK_MESSAGE_IN_FRAME])
		== float(Measure.CHECK_EPSILON[Measure.CHECK_SUBJECT])
	)
	return true

func _the_containment_tolerance_is_read_in_pixels() -> bool:
	# Dragging produces fractional positions, so a frame a fraction of a pixel short of the
	# region still counts as holding it, while one visibly short of it does not. Both
	# containment checks read the same way.
	var rounding: Dictionary = Measure.evaluate(_scene(Rect2(32.5, 32, 200, 150), ON_PLAIN))
	assert(_met(rounding, Measure.CHECK_SUBJECT))
	var short: Dictionary = Measure.evaluate(_scene(Rect2(34, 32, 200, 150), ON_PLAIN))
	assert(not _met(short, Measure.CHECK_SUBJECT))

	var slogan_rounding: Dictionary = Measure.evaluate(
		_scene(Rect2(0, 0, 287.5, 192), ON_PLAIN)
	)
	assert(_met(slogan_rounding, Measure.CHECK_MESSAGE_IN_FRAME))
	var slogan_short: Dictionary = Measure.evaluate(_scene(Rect2(0, 0, 286, 192), ON_PLAIN))
	assert(not _met(slogan_short, Measure.CHECK_MESSAGE_IN_FRAME))
	return true

func _a_missing_grid_leaves_the_message_unreadable() -> bool:
	# A mistyped image path leaves the grid empty. Calling every placement readable would
	# pass everything the pair could do, so the absent grid has to fail closed.
	var scene := _scene(Rect2(Vector2.ZERO, PICTURE), ON_PLAIN)
	scene.erase("detailGrid")
	var result: Dictionary = Measure.evaluate(scene)
	assert(is_zero_approx(_value(result, Measure.CHECK_MESSAGE_CLEAR)))
	assert(not _met(result, Measure.CHECK_MESSAGE_CLEAR))
	assert(result.get("passed") == false)
	return true

func _a_collapsed_frame_cannot_pass() -> bool:
	var result: Dictionary = Measure.evaluate(_scene(Rect2(100, 100, 0, 0), ON_PLAIN))
	assert(result.get("passed") == false)
	for check: String in Measure.CHECKS:
		assert(not _met(result, check))
	return true

func _demonstration() -> Dictionary:
	return Catalog.mission("framing").get("demonstration")

func _picture_texture() -> Texture2D:
	return load(String(_demonstration().get("image"))) as Texture2D

func _the_picture_carries_what_the_record_names() -> bool:
	var record := _demonstration()
	var texture := _picture_texture()
	assert(texture != null)
	# The lockup is drawn at one aspect and the record gives it a box. If those disagree the
	# art letterboxes inside the panel instead of filling it, which reads as a mistake, and
	# the alternative — letting it stretch — would distort the wordmark.
	var art := load(String(record.get("sloganArt"))) as Texture2D
	assert(art != null)
	var box: Vector2 = record.get("sloganSize")
	assert(is_equal_approx(art.get_size().x / art.get_size().y, box.x / box.y))
	# The stage reads the picture's size from the texture rather than from the record, so
	# everything the record places has to lie inside the real file.
	var picture := Rect2(Vector2.ZERO, texture.get_size())
	assert(picture.encloses(Rect2(record.get("subjectRegion"))))
	assert(picture.encloses(Rect2(record.get("sloganStart"), record.get("sloganSize"))))

	var grid := Measure.build_detail_grid(texture)
	assert(Measure.has_detail_grid(grid))
	var plain: PackedByteArray = grid.get("plain")
	var plain_cells := 0
	for value in plain:
		plain_cells += value
	# The exercise only works while the picture has both a plain area to put the slogan on
	# and enough busy picture to be worth cropping away.
	assert(plain_cells > 0 and plain_cells < plain.size())
	return true

func _record_scene(crop: Rect2, slogan_position: Vector2) -> Dictionary:
	var record := _demonstration()
	var texture := _picture_texture()
	if _record_grid.is_empty():
		# Reducing the shipped picture costs 76,800 samples, and every case below wants the
		# same grid, so it is built once rather than once per case.
		_record_grid = Measure.build_detail_grid(texture)
	return {
		"imageSize": texture.get_size(),
		"subjectRegion": record.get("subjectRegion"),
		"crop": crop,
		"slogan": Rect2(slogan_position, record.get("sloganSize")),
		"minSubjectShare": float(record.get("minSubjectShare")),
		"minPlainShare": float(record.get("minPlainShare")),
		"detailGrid": _record_grid
	}

func _the_untouched_arrangement_does_not_pass() -> bool:
	# The frame opens on the whole picture with the slogan lying across the aisle. The
	# subject is in shot and the slogan is inside the frame, so the exercise turns on the
	# other two: the bottle fills too little of the frame, and the slogan is on the picture.
	var record := _demonstration()
	var result: Dictionary = Measure.evaluate(_record_scene(
		Rect2(Vector2.ZERO, _picture_texture().get_size()), record.get("sloganStart")
	))
	assert(_met(result, Measure.CHECK_SUBJECT))
	assert(_met(result, Measure.CHECK_MESSAGE_IN_FRAME))
	assert(not _met(result, Measure.CHECK_PROMINENCE))
	assert(not _met(result, Measure.CHECK_MESSAGE_CLEAR))
	assert(result.get("passed") == false)
	return true

func _many_different_arrangements_pass() -> bool:
	# There is no authored correct rectangle. If there were, one arrangement would pass and
	# the rest would not, so showing that five structurally different ones all pass is what
	# establishes that the verdict comes from the measure. They differ in frame width, in
	# frame height, in where the frame starts and in where the slogan sits.
	var passing: Array[Array] = [
		[Rect2(842, 0, 1078, 640), Vector2(1400, 155)],
		[Rect2(842, 16, 1040, 608), Vector2(1400, 160)],
		[Rect2(800, 60, 1080, 533), Vector2(1387, 173)],
		[Rect2(700, 40, 1187, 573), Vector2(1393, 200)],
		[Rect2(820, 0, 1100, 640), Vector2(1420, 260)]
	]
	for arrangement: Array in passing:
		assert(Measure.evaluate(_record_scene(arrangement[0], arrangement[1])).get("passed") == true)
	for index in passing.size():
		for other in range(index + 1, passing.size()):
			assert(passing[index][0] != passing[other][0])

	# A good frame with the slogan left across the bottle keeps everything else and still
	# fails: the message covering the product is its own defect.
	var covering: Dictionary = Measure.evaluate(_record_scene(Rect2(842, 0, 1078, 640), Vector2(867, 200)))
	assert(_met(covering, Measure.CHECK_SUBJECT))
	assert(_met(covering, Measure.CHECK_PROMINENCE))
	assert(_met(covering, Measure.CHECK_MESSAGE_IN_FRAME))
	assert(not _met(covering, Measure.CHECK_MESSAGE_CLEAR))
	assert(covering.get("passed") == false)

	# Half on the plaster and half on the pews is not good enough either, which is what
	# stops the slogan being parked at the edge of the wall.
	var straddling: Dictionary = Measure.evaluate(_record_scene(Rect2(842, 0, 1078, 640), Vector2(1267, 155)))
	assert(not _met(straddling, Measure.CHECK_MESSAGE_CLEAR))
	assert(straddling.get("passed") == false)

	# A frame that cuts into the bottle fails whatever else it does, whether it cuts from
	# the side or from the top.
	for cut: Rect2 in [Rect2(1133, 0, 787, 640), Rect2(842, 93, 1078, 533)]:
		var result: Dictionary = Measure.evaluate(_record_scene(cut, Vector2(1400, 267)))
		assert(not _met(result, Measure.CHECK_SUBJECT))
		assert(result.get("passed") == false)
	return true

func _a_reason_from_the_stage_reaches_the_pair() -> bool:
	# The refusal sentence was engine A's, written into the controller: every later engine
	# would have told the pair that the named object does not lead on any of the three,
	# whatever its own measure checks. A stage that says why now has its own words relayed.
	var controller := (load(CONTROLLER_PATH) as Script).new() as Node
	var progress: RefCounted = AgencyProgress.new()
	assert(progress.call("begin"))
	controller.call("configure", progress, null)
	assert(controller.call("open_mission", "framing", "art-director").get("allowed") == true)
	assert(controller.call("choose", "useful-close-crop").get("correct") == true)
	assert(controller.call("continue_to_transfer").get("state") == "demonstration")

	var refused: Dictionary = controller.call("submit_demonstration", {
		"passed": false,
		"reason": "The slogan is outside the frame."
	})
	assert(refused.get("accepted") == false)
	assert(String(refused.get("reason")) == "The slogan is outside the frame.")

	# A stage that says nothing still gets engine A's sentence rather than an empty one.
	var silent: Dictionary = controller.call("submit_demonstration", {"passed": false})
	assert(not String(silent.get("reason")).is_empty())
	controller.free()
	return true

func _stage_in_tree(record: Dictionary) -> Control:
	var tree := Engine.get_main_loop() as SceneTree
	var stage := StageScene.instantiate() as Control
	tree.root.add_child(stage)
	stage.call("configure", record)
	return stage

func _handle(stage: Control, index: int) -> Control:
	return stage.get_node("ImageViewport/Stage/Handles").get_child(index) as Control

func _slogan(stage: Control) -> Control:
	return stage.get_node("ImageViewport/Stage/Slogan") as Control

# Drives a real pointer drag through the control's own gui_input, so the drag maths is
# exercised rather than a private setter.
func _drag(control: Control, from_picture_point: Vector2, to_picture_point: Vector2) -> void:
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	press.position = from_picture_point - control.position
	control.gui_input.emit(press)
	var motion := InputEventMouseMotion.new()
	motion.position = to_picture_point - control.position
	control.gui_input.emit(motion)
	var release := InputEventMouseButton.new()
	release.button_index = MOUSE_BUTTON_LEFT
	release.pressed = false
	release.position = motion.position
	control.gui_input.emit(release)

func _dragging_solves_it_and_resetting_undoes_it() -> bool:
	var record := _demonstration()
	var stage := _stage_in_tree(record)
	await _settle()
	var opening: Dictionary = stage.call("current_result")
	assert(opening.get("passed") == false)
	# While it does not work the pair is told one thing to change, not four.
	assert(String(stage.call("describe", opening)).contains("smaller"))

	# CORNERS lists the top-left handle first. Pulling it right cuts away the wide dead left
	# of the picture, which is the whole point of a picture shipped too wide to use.
	_drag(_handle(stage, 0), Vector2(0, 0), Vector2(842, 0))
	var cropped: Dictionary = stage.call("current_result")
	assert(Rect2(cropped.get("crop")) == Rect2(842, 0, 1078, 640))
	# Cropping alone is not enough: the slogan the pair has not moved is now outside the
	# frame, and that is the next thing they are told about.
	assert(cropped.get("passed") == false)
	assert(String(stage.call("describe", cropped)).contains("outside the frame"))

	# The slogan is dragged the same way the frame is, through its own gui_input.
	_drag(_slogan(stage), record.get("sloganStart"), Vector2(1400, 155))
	var solved: Dictionary = stage.call("current_result")
	assert(Rect2(solved.get("slogan")) == Rect2(Vector2(1400, 155), record.get("sloganSize")))
	assert(solved.get("passed") == true)
	assert(String(solved.get("evidence")).contains("slogan"))
	# The scene node tracks the measured rectangle, so what the pair sees is what was read.
	assert(_slogan(stage).position == Vector2(1400, 155))

	# Putting it back must put the refusal back too: the verdict tracks the arrangement.
	stage.call("reset_arrangement")
	assert(bool(Dictionary(stage.call("current_result")).get("passed")) == false)
	assert(_slogan(stage).position == Vector2(record.get("sloganStart")))

	# The slogan cannot be dragged off the picture, which would put it somewhere no crop
	# could ever contain and leave the pair stuck.
	_drag(_slogan(stage), record.get("sloganStart"), Vector2(4000, 4000))
	var pushed: Rect2 = Dictionary(stage.call("current_result")).get("slogan")
	assert(Rect2(Vector2.ZERO, _picture_texture().get_size()).encloses(pushed))

	# The frame cannot be turned inside out by dragging a corner past its opposite one.
	stage.call("reset_arrangement")
	_drag(_handle(stage, 0), Vector2(0, 0), Vector2(1900, 620))
	var crushed: Rect2 = Dictionary(stage.call("current_result")).get("crop")
	assert(crushed.size.x > 0.0 and crushed.size.y > 0.0)
	assert(crushed.size == Vector2(record.get("minCropSize")))
	stage.queue_free()
	return true

func _the_readout_comes_from_the_record() -> bool:
	# Engines C-G clone this stage with a different set of checks, so renaming one in the
	# record has to reach the readout column without the scene being edited too.
	var record: Dictionary = _demonstration().duplicate(true)
	var phrases: Dictionary = record.get("checkPhrases")
	phrases[Measure.CHECK_MESSAGE_CLEAR] = "room for words"
	var stage := _stage_in_tree(record)
	await _settle()

	var readout := stage.get_node("ReadoutRow") as Control
	assert(readout.get_child_count() == Measure.CHECKS.size())
	var headings := PackedStringArray()
	for column in readout.get_children():
		# Built at runtime rather than authored, so the columns have to be shown taking up
		# room: a collapsed readout would still hold the right labels and show nothing.
		assert((column as Control).size.x > 0.0 and (column as Control).size.y > 0.0)
		for label in column.find_children("*", "Label", true, false):
			headings.append(String((label as Label).text))
			break
	assert(headings.has("ROOM FOR WORDS"))
	stage.queue_free()
	return true

func _the_panel_records_measured_evidence() -> bool:
	var tree := Engine.get_main_loop() as SceneTree
	var progress: RefCounted = AgencyProgress.new()
	assert(progress.call("begin"))
	var panel := PanelScene.instantiate() as Control
	tree.root.add_child(panel)
	var controller := (load(CONTROLLER_PATH) as Script).new() as Node
	controller.call("configure", progress, panel)

	assert(controller.call("open_mission", "framing", "art-director").get("allowed") == true)
	assert(controller.call("choose", "useful-close-crop").get("correct") == true)
	# The written gate is gone for this task: continuing lands on the demonstration.
	assert(controller.call("continue_to_transfer").get("state") == "demonstration")
	var host := panel.get_node("Backdrop/Dialog/Margin/Content/DemonstrationStage") as Control
	assert(host.visible)
	var stage := host.get_child(0) as Control
	assert(stage != null)
	await _settle()

	# The demonstration is what makes this dialog tall, so the height has to be measured
	# while the demonstration is the stage on show. Checking it after the task completes
	# measures the completed stage, which is short, and lets an overflowing demonstration
	# through: this dialog stood 828px tall in the 800px window while an assertion written
	# that way passed.
	#
	# 760, matching test_salience_measure.gd, rather than the window's own 800. The dialog
	# is centred in an 800px window with a 25px margin, so 750 is what actually fits; a
	# guard set at the window height would pass a demonstration that had already eaten the
	# margin. This stage measures 715.
	var dialog := panel.get_node("Backdrop/Dialog") as PanelContainer
	assert(dialog.get_combined_minimum_size().y <= 760.0)

	# The untouched arrangement is refused, and refusing it must not record anything.
	var refused: Dictionary = controller.call("submit_demonstration", stage.call("current_result"))
	assert(refused.get("accepted") == false)
	assert(String(refused.get("reason")).contains("frame"))
	assert(Dictionary(progress.get("evidence_by_mission")).is_empty())

	_drag(_handle(stage, 0), Vector2(0, 0), Vector2(842, 0))
	_drag(_slogan(stage), _demonstration().get("sloganStart"), Vector2(1400, 155))
	(stage.get_node("ActionsRow/CheckButton") as Button).pressed.emit()
	assert(controller.call("snapshot").get("state") == "completed")
	var evidence: Dictionary = Dictionary(progress.get("evidence_by_mission")).get("framing", {})
	assert(evidence.get("decision") == "useful-close-crop")
	# Evidence is generated from the measured result, so the writer's statement still has
	# the pair's own sentences to quote once the text box is gone.
	var effect := String(evidence.get("effect"))
	assert(effect.contains("cropped") and effect.contains("slogan"))
	assert(effect.contains("audience"))
	# The record's own phrase reached the sentence rather than a name written into the code.
	assert(effect.contains(String(_demonstration().get("subjectPhrase"))))
	controller.free()
	panel.queue_free()
	return true
