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
	assert(_a_neighbour_changes_the_surround())
	assert(_real_sprites_describe_themselves())
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
func _fixture() -> Array:
	return [
		_object("a", Vector2(100, 100), 1.0, Color(0.95, 0.90, 0.80, 1)),
		_object("b", Vector2(300, 100), 0.5, Color(0.04, 0.14, 0.25, 1)),
		_object("c", Vector2(500, 100), 0.5, Color(0.90, 0.86, 0.78, 1))
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
	objects[0]["position"] = Vector2(240, 100)
	var result: Dictionary = Measure.evaluate(_scene(objects, "a"))
	assert(result.get("leaders").get("size") == "")
	assert(result.get("passed") == false)
	assert(PackedStringArray(result.get("wonLevers")).is_empty())
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
	near[1]["position"] = Vector2(178, 100)
	var near_contrast := float(_entry(Measure.evaluate(_scene(near, "a")), "a").get("contrast"))
	assert(near_contrast > far_contrast + 1.0)
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
