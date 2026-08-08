extends RefCounted
class_name AdMarketTestSalienceMeasure

# Engine A replaces the salience writing gate with a demonstration. Two properties have
# to hold or the exercise stops teaching anything:
#
#   * the opening arrangement must NOT already pass, and
#   * a pass must come out of the measure rather than out of matching a stored solution.
#
# The second one is why there is no expected arrangement anywhere in this suite: every
# passing case here is produced by changing an object and re-measuring.

const Measure = preload("res://src/agency/missions/demonstrations/salience_measure.gd")
const Catalog = preload("res://src/agency/agency_mission_catalog.gd")
const StageScene = preload("res://src/agency/missions/demonstrations/SalienceStage.tscn")
const PanelScene = preload("res://src/agency/missions/AgencyMissionPanel.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")
const CONTROLLER_PATH := "res://src/agency/missions/agency_mission_controller.gd"

const STAGE := Vector2(800, 400)
const PLATE_CREAM := Color(0.98, 0.94, 0.82, 1)

func run() -> bool:
	assert(_each_lever_ranks_the_objects_it_names())
	assert(_a_tie_leaves_no_leader())
	assert(_a_lone_object_leads_nothing())
	assert(_a_contrast_lead_under_a_just_noticeable_difference_ties())
	assert(_the_topmost_neighbour_sets_the_surround())
	assert(_a_neighbour_changes_the_surround())
	assert(_a_corner_is_not_open_space())
	assert(_a_missing_plate_is_not_a_white_surround())
	assert(_real_sprites_describe_themselves())
	assert(await _a_missing_sprite_does_not_shift_the_others())
	assert(await _a_record_without_a_stage_size_falls_back_to_the_scene())
	assert(await _the_readout_and_the_sentence_come_from_the_record())
	assert(await _the_opening_arrangement_is_unsolved_and_solvable())
	assert(await _the_panel_records_measured_evidence())
	return true

# The two stage checks below run past a frame boundary on purpose: building the objects
# queues frees, and a node that the stage keeps a reference to must still be there
# afterwards.
func _settle() -> void:
	var tree := Engine.get_main_loop() as SceneTree
	await tree.process_frame
	await tree.process_frame

func _flat_grid() -> Dictionary:
	var cells := PackedColorArray()
	cells.resize(8)
	cells.fill(PLATE_CREAM)
	return {"cols": 4, "rows": 2, "cells": cells}

func _object(id: String, centre: Vector2, object_scale: float, colour: Color) -> Dictionary:
	return {
		"id": id,
		"baseSize": Vector2(100, 100),
		"baseArea": 8000.0,
		"baseColour": colour,
		"alphaCoverage": 0.8,
		"position": centre,
		"scale": object_scale,
		"tint": Color.WHITE
	}

# A neighbour large enough to cover another object's whole surround ring, so it claims
# the ring outright and the blended surround is exactly its own colour.
func _cover(id: String, colour: Color) -> Dictionary:
	return {
		"id": id,
		"baseSize": STAGE,
		"baseArea": STAGE.x * STAGE.y,
		"baseColour": colour,
		"alphaCoverage": 1.0,
		"position": STAGE * 0.5,
		"scale": 1.0,
		"tint": Color.WHITE
	}

func _scene(objects: Array, target_id: String) -> Dictionary:
	return {
		"size": STAGE,
		"targetId": target_id,
		"objects": objects,
		"plateGrid": _flat_grid()
	}

func _entry(result: Dictionary, id: String) -> Dictionary:
	for entry_value: Variant in result.get("objects", []):
		var entry: Dictionary = entry_value
		if String(entry.get("id")) == id:
			return entry
	return {}

# a is the largest, c has the most space around it, b differs most from the cream plate.
# They sit on the stage's midline so that c's isolation lead comes from the 150px gap to
# b, with the stage edge further away still. Closer to the top edge, b and c would tie on
# their distance to it and neither would lead.
func _fixture() -> Array:
	return [
		_object("a", Vector2(100, 200), 1.0, Color(0.95, 0.90, 0.80, 1)),
		_object("b", Vector2(300, 200), 0.5, Color(0.04, 0.14, 0.25, 1)),
		_object("c", Vector2(500, 200), 0.5, Color(0.90, 0.86, 0.78, 1))
	]

func _each_lever_ranks_the_objects_it_names() -> bool:
	var objects := _fixture()
	var by_size: Dictionary = Measure.evaluate(_scene(objects, "a"))
	assert(by_size.get("leaders").get("size") == "a")
	assert(by_size.get("leaders").get("isolation") == "c")
	assert(by_size.get("leaders").get("contrast") == "b")
	# Leading any one lever is enough, and it is the lever that gets reported back.
	assert(by_size.get("passed") == true)
	assert(PackedStringArray(by_size.get("wonLevers")) == PackedStringArray(["size"]))
	assert(Measure.evaluate(_scene(objects, "c")).get("wonLevers") == PackedStringArray(["isolation"]))
	assert(Measure.evaluate(_scene(objects, "b")).get("wonLevers") == PackedStringArray(["contrast"]))

	# Size is area over the largest area, so the leader sits at exactly 1.
	assert(is_equal_approx(float(_entry(by_size, "a").get("size")), 1.0))
	assert(is_equal_approx(float(_entry(by_size, "b").get("size")), 0.25))
	# Isolation is the gap to the nearest neighbour's box over the scene diagonal.
	assert(is_equal_approx(float(_entry(by_size, "c").get("isolation")), 150.0 / STAGE.length()))
	return true

func _a_tie_leaves_no_leader() -> bool:
	var objects := _fixture()
	# Shrinking a below the other two leaves b and c tied on size, and a tie means the
	# pair has not made anything lead.
	objects[0]["scale"] = 0.4
	objects[0]["position"] = Vector2(240, 200)
	var result: Dictionary = Measure.evaluate(_scene(objects, "a"))
	assert(result.get("leaders").get("size") == "")
	assert(result.get("passed") == false)
	assert(PackedStringArray(result.get("wonLevers")).is_empty())
	return true

func _a_lone_object_leads_nothing() -> bool:
	# Leading a lever means leading the other objects on it, and a record with one object
	# has no others. _sole_leader compared the only score against a runner-up of -INF, so a
	# one-object record reported itself solved on all three levers the moment it opened,
	# before the pair had touched anything.
	var solo := [_object("solo", Vector2(400, 200), 0.5, Color(0.04, 0.14, 0.25, 1))]
	var result: Dictionary = Measure.evaluate(_scene(solo, "solo"))
	for lever: String in Measure.LEVERS:
		assert(String(Dictionary(result.get("leaders")).get(lever, "")) == "")
	assert(result.get("passed") == false)
	assert(PackedStringArray(result.get("wonLevers")).is_empty())
	return true

func _a_contrast_lead_under_a_just_noticeable_difference_ties() -> bool:
	# The tie tolerance has to be read in each lever's own units. Size and isolation are
	# normalised into roughly [0, 1]; contrast is a raw CIE76 delta-E on a 0-100+ scale. One
	# absolute 0.0005 across both left contrast with no working tie mechanism, so its leader
	# was decided by plate-sampling noise rather than by a difference anyone can see.
	# These two sit symmetrically, so size and isolation tie by construction and contrast is
	# the only lever that can name a leader here.
	var objects := [
		_object("a", Vector2(200, 200), 0.5, Color(0.04, 0.14, 0.25, 1)),
		_object("b", Vector2(600, 200), 0.5, Color(0.05, 0.145, 0.255, 1))
	]
	var result: Dictionary = Measure.evaluate(_scene(objects, "a"))
	var gap := absf(
		float(_entry(result, "a").get("contrast")) - float(_entry(result, "b").get("contrast"))
	)
	# The fixture only tests what it claims to while it lands in the window the fix is
	# about: a real difference, below the smallest colour step an eye resolves.
	assert(gap > 0.0 and gap < 2.3)
	assert(result.get("leaders").get("contrast") == "")
	assert(result.get("passed") == false)
	return true

func _the_topmost_neighbour_sets_the_surround() -> bool:
	# Where two neighbours overlap inside the ring, only one of them is visible there. The
	# views are added in record order, so the last entry is the one drawn on top -- and the
	# blend handed the contested area to the first, the object buried underneath it.
	var bright := Color(0.95, 0.93, 0.88, 1)
	var dark := Color(0.05, 0.10, 0.18, 1)
	var target := _object("target", Vector2(400, 200), 0.5, Color(0.90, 0.45, 0.10, 1))
	var target_colour := Measure.tinted_colour(target)
	var dark_on_top: Dictionary = Measure.evaluate(
		_scene([target, _cover("lower", bright), _cover("upper", dark)], "target")
	)
	var bright_on_top: Dictionary = Measure.evaluate(
		_scene([target, _cover("lower", dark), _cover("upper", bright)], "target")
	)
	assert(is_equal_approx(
		float(_entry(dark_on_top, "target").get("contrast")),
		Measure.delta_e(target_colour, dark)
	))
	assert(is_equal_approx(
		float(_entry(bright_on_top, "target").get("contrast")),
		Measure.delta_e(target_colour, bright)
	))
	return true

func _a_neighbour_changes_the_surround() -> bool:
	# The surround is what is actually behind and beside the object, not just the plate.
	# Painted the plate's own colour, a starts with nothing to separate it from the
	# background at all.
	var far := _fixture()
	far[0]["baseColour"] = PLATE_CREAM
	var far_contrast := float(_entry(Measure.evaluate(_scene(far, "a")), "a").get("contrast"))
	assert(far_contrast < 1.0)
	var near := far.duplicate(true)
	# a keeps its colour and its size; only the dark neighbour moves close enough to sit
	# inside the ring that a's surround is sampled from.
	near[1]["position"] = Vector2(178, 200)
	var near_contrast := float(_entry(Measure.evaluate(_scene(near, "a")), "a").get("contrast"))
	assert(near_contrast > far_contrast + 1.0)
	return true

func _a_corner_is_not_open_space() -> bool:
	# The isolation win sentence says the target "now has the most space around it". An
	# object clamped into the corner has no space at all on two of its sides, so it must
	# not lead the lever. Measuring only the gaps between objects makes the exercise one
	# drag long: everything left behind in the cluster reads as gap 0 against a neighbour,
	# so the corner wins isolation by default and the game asserts something untrue.
	var objects := [
		_object("target", Vector2(25, 25), 0.5, PLATE_CREAM),
		_object("p", Vector2(400, 200), 0.5, PLATE_CREAM),
		_object("q", Vector2(440, 200), 0.5, PLATE_CREAM),
		_object("r", Vector2(420, 240), 0.5, PLATE_CREAM)
	]
	var result: Dictionary = Measure.evaluate(_scene(objects, "target"))
	assert(result.get("leaders").get("isolation") != "target")
	assert(not PackedStringArray(result.get("wonLevers")).has("isolation"))
	return true

func _a_missing_sprite_does_not_shift_the_others() -> bool:
	# An object whose texture fails to load is skipped while the stage is built, so the
	# built list is shorter than the record's. Pairing the two by position hands every later
	# object the pose of the one before it -- against the real record that gives the orange
	# the bananas' scale, and the exercise passes itself. A record with a broken sprite has
	# to arrange the survivors exactly as a record that never listed it would.
	var broken: Dictionary = Catalog.mission("salience").get("demonstration").duplicate(true)
	var broken_entries: Array = broken.get("objects", [])
	assert(broken_entries.size() >= 3)
	var dropped := String(Dictionary(broken_entries[0]).get("id"))
	assert(dropped != String(broken.get("targetId")))
	broken_entries[0]["texture"] = "res://assets/agency/salience/no-such-sprite.png"

	var without: Dictionary = Catalog.mission("salience").get("demonstration").duplicate(true)
	var without_entries: Array = without.get("objects", [])
	without_entries.remove_at(0)

	var broken_result := await _configured_result(broken)
	var listed_result := await _configured_result(without)
	assert(_entry(broken_result, dropped).is_empty())
	for source_value: Variant in without_entries:
		var id := String(Dictionary(source_value).get("id"))
		var with_gap := _entry(broken_result, id)
		var listed := _entry(listed_result, id)
		assert(not with_gap.is_empty() and not listed.is_empty())
		assert(is_equal_approx(float(with_gap.get("size")), float(listed.get("size"))))
		assert(is_equal_approx(float(with_gap.get("isolation")), float(listed.get("isolation"))))
	return true

func _configured_result(record: Dictionary) -> Dictionary:
	var tree := Engine.get_main_loop() as SceneTree
	var stage := StageScene.instantiate() as Control
	tree.root.add_child(stage)
	stage.call("configure", record)
	await _settle()
	var result: Dictionary = stage.call("current_result")
	stage.queue_free()
	return result

func _a_missing_plate_is_not_a_white_surround() -> bool:
	# A mistyped plate path leaves the grid empty. Falling back to white then measured every
	# object's distance from white instead, which ranks them, reads as a working lever and is
	# not one. With nothing behind the objects there is no colour difference to report.
	var scene := _scene(_fixture(), "a")
	scene.erase("plateGrid")
	var result: Dictionary = Measure.evaluate(scene)
	for entry_value: Variant in result.get("objects", []):
		assert(is_zero_approx(float(Dictionary(entry_value).get("contrast"))))
	assert(result.get("leaders").get("contrast") == "")
	return true

func _real_sprites_describe_themselves() -> bool:
	var orange := load("res://assets/agency/salience/fruit-orange.png") as Texture2D
	assert(orange != null)
	var described := Measure.describe_texture(orange)
	var base_size: Vector2 = described.get("baseSize")
	assert(base_size == Vector2(272, 283))
	# Alpha-weighted, so the opaque area is a real fraction of the bounding box.
	var coverage := float(described.get("alphaCoverage"))
	assert(coverage > 0.5 and coverage < 1.0)
	assert(is_equal_approx(float(described.get("baseArea")), coverage * base_size.x * base_size.y))
	var colour: Color = described.get("baseColour")
	assert(colour.r > colour.g and colour.g > colour.b)

	var plate := load("res://assets/agency/salience/fruit-table-plate.png") as Texture2D
	assert(plate != null)
	var grid := Measure.build_plate_grid(plate, 24, 12)
	assert(grid.get("cols") == 24 and grid.get("rows") == 12)
	assert(PackedColorArray(grid.get("cells")).size() == 288)
	return true

func _a_record_without_a_stage_size_falls_back_to_the_scene() -> bool:
	# The fallback shipped as 880x440 while the scene and the record both draw 880x320, so a
	# record that left stageSize out would measure and clamp against a stage 120px taller
	# than the one the pair can see.
	var unconfigured := StageScene.instantiate() as Control
	var authored: Vector2 = (unconfigured.get_node("PlateViewport/Stage") as Control).custom_minimum_size
	unconfigured.free()
	assert(authored.x > 0.0 and authored.y > 0.0)

	var record: Dictionary = Catalog.mission("salience").get("demonstration").duplicate(true)
	record.erase("stageSize")
	var tree := Engine.get_main_loop() as SceneTree
	var stage := StageScene.instantiate() as Control
	tree.root.add_child(stage)
	stage.call("configure", record)
	await _settle()
	assert((stage.get_node("PlateViewport/Stage") as Control).custom_minimum_size == authored)
	stage.queue_free()
	return true

func _the_readout_and_the_sentence_come_from_the_record() -> bool:
	# Engines B-G clone this stage with a different lever set, so renaming a lever in the
	# record has to reach both the readout column and the sentence. The columns were three
	# authored groups with the lever names typed into them, and the "does not lead" sentence
	# listed those same three names in line instead of reading leverPhrases -- so each clone
	# needed the scene and the script edited as well as its record.
	var record: Dictionary = Catalog.mission("salience").get("demonstration").duplicate(true)
	var phrases: Dictionary = record.get("leverPhrases")
	phrases[Measure.LEVER_ISOLATION] = "elbow room"
	var tree := Engine.get_main_loop() as SceneTree
	var stage := StageScene.instantiate() as Control
	tree.root.add_child(stage)
	stage.call("configure", record)
	await _settle()

	var readout := stage.get_node("ReadoutRow") as Control
	assert(readout.get_child_count() == Measure.LEVERS.size())
	var headings := PackedStringArray()
	for column in readout.get_children():
		# Built at runtime rather than authored, so the columns have to be shown taking up
		# room: a collapsed readout would still hold the right labels and show nothing.
		assert((column as Control).size.x > 0.0 and (column as Control).size.y > 0.0)
		for label in column.find_children("*", "Label", true, false):
			headings.append(String((label as Label).text))
			break
	assert(headings.has("ELBOW ROOM"))

	# The sentence that named the levers in line is the one that fires when no lever has a
	# leader at all.
	var leaders := {}
	for lever: String in Measure.LEVERS:
		leaders[lever] = ""
	var tied := {
		"objects": [],
		"leaders": leaders,
		"wonLevers": PackedStringArray(),
		"passed": false,
		"targetId": String(record.get("targetId"))
	}
	assert(String(stage.call("describe", tied)).contains("elbow room"))
	stage.queue_free()
	return true

func _stage_in_tree() -> Control:
	var tree := Engine.get_main_loop() as SceneTree
	var stage := StageScene.instantiate() as Control
	tree.root.add_child(stage)
	stage.call("configure", Catalog.mission("salience").get("demonstration"))
	return stage

func _the_opening_arrangement_is_unsolved_and_solvable() -> bool:
	var stage := _stage_in_tree()
	await _settle()
	# The ring that marks the selected object shares a parent with the objects, so it has
	# to survive the pass that builds them.
	var ring := stage.get_node_or_null("PlateViewport/Stage/Objects/SelectionRing") as Control
	assert(ring != null and ring.visible)

	var opening: Dictionary = stage.call("current_result")
	# Nothing has been changed yet, so the orange must still be behind on all three.
	assert(opening.get("passed") == false)
	assert(PackedStringArray(opening.get("wonLevers")).is_empty())
	assert(opening.get("leaders").get("size") == "bananas")
	assert(String(stage.call("describe", opening)).contains("does not lead"))

	# The orange is selected when the stage opens, so the size control acts on it.
	var slider := stage.get_node("ControlsRow/SizeSlider") as HSlider
	slider.value = 0.62
	var solved: Dictionary = stage.call("current_result")
	assert(solved.get("passed") == true)
	assert(PackedStringArray(solved.get("wonLevers"))[0] == "size")
	assert(solved.get("leaders").get("size") == "orange")
	# The sentence names the lever that was won, not just that the arrangement passed.
	assert(String(stage.call("describe", solved)).contains("largest"))

	# Putting it back must put the pass back too: the verdict tracks the arrangement.
	slider.value = 0.28
	assert(bool(Dictionary(stage.call("current_result")).get("passed")) == false)
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

	assert(controller.call("open_mission", "salience", "art-director").get("allowed") == true)
	assert(controller.call("choose", "largest-contrast").get("correct") == true)
	# The written gate is gone for this task: continuing lands on the demonstration.
	assert(controller.call("continue_to_transfer").get("state") == "demonstration")
	var host := panel.get_node("Backdrop/Dialog/Margin/Content/DemonstrationStage") as Control
	assert(host.visible)
	var stage := host.get_child(0) as Control
	assert(stage != null)
	await _settle()

	# An arrangement that has not been changed is refused, and refusing it must not
	# record anything.
	var refused: Dictionary = controller.call("submit_demonstration", stage.call("current_result"))
	assert(refused.get("accepted") == false)
	assert(Dictionary(progress.get("evidence_by_mission")).is_empty())

	(stage.get_node("ControlsRow/SizeSlider") as HSlider).value = 0.62
	(stage.get_node("ActionsRow/CheckButton") as Button).pressed.emit()
	assert(controller.call("snapshot").get("state") == "completed")
	var evidence: Dictionary = Dictionary(progress.get("evidence_by_mission")).get("salience", {})
	assert(evidence.get("decision") == "largest-contrast")
	# Evidence is generated from the measured result, so the writer's statement still has
	# the pair's own sentences to quote once the text box is gone.
	var effect := String(evidence.get("effect"))
	assert(effect.contains("orange") and effect.contains("largest"))
	assert(effect.contains("audience"))

	# The demonstration must not push the dialog past the shortest window the game
	# guarantees, or the buttons at its foot are drawn off the bottom of the screen.
	var dialog := panel.get_node("Backdrop/Dialog") as PanelContainer
	assert(dialog.get_combined_minimum_size().y <= 760.0)
	controller.free()
	panel.queue_free()
	return true
