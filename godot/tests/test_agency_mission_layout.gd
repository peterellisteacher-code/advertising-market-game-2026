extends RefCounted
class_name AdMarketTestAgencyMissionLayout

const PANEL_SCENE_PATH := "res://src/agency/missions/AgencyMissionPanel.tscn"
const CATALOG_PATH := "res://src/agency/agency_mission_catalog.gd"

func run() -> bool:
	assert(await _layout_stays_bounded_at(Vector2i(1280, 800)))
	assert(await _layout_stays_bounded_at(Vector2i(1440, 900)))
	assert(await _record_identity_and_accessibility_are_visible())
	assert(await _primary_action_tracks_the_current_stage())
	return true

func _layout_stays_bounded_at(viewport_size: Vector2i) -> bool:
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	var panel := _mount_panel()
	var record := _required_record("contrast")
	panel.call("show_choice", record, String(record.get("ownerRole")), true)
	await tree.process_frame
	var contract: Dictionary = panel.call("layout_contract", Vector2(viewport_size))
	assert(contract.get("withinViewport") == true)
	assert(contract.get("singleInputOwner") == true)
	for rect_name: String in ["header", "work", "feedback", "action"]:
		var rect: Rect2 = contract.get(rect_name, Rect2())
		assert(rect.size.x > 0.0 and rect.size.y > 0.0)
		assert(rect.position.x >= 0.0 and rect.position.y >= 0.0)
		assert(rect.end.x <= viewport_size.x and rect.end.y <= viewport_size.y)
	panel.free()
	return true

func _record_identity_and_accessibility_are_visible() -> bool:
	var panel := _mount_panel()
	var record := _required_record("salience")
	panel.call("show_choice", record, String(record.get("ownerRole")), true)
	var header := panel.get_node("%AcademyHeader") as AdMarketAgencyAcademyHeader
	assert(header != null)
	assert((header.get_node("%SurfaceTitle") as Label).text == String(record.get("title")))
	assert((header.get_node("%TermLabel") as Label).text == String(record.get("term")))
	assert((header.get_node("%TaskProgressLabel") as Label).text == "Task %d of %d" % [
		int(record.get("taskIndex")),
		int(record.get("taskTotal")),
	])
	assert(panel.find_child("*Score*", true, false) == null)
	assert(not (panel.get_node("%RoleDefinitionLabel") as Label).visible)
	assert(not (panel.get_node("%HoldingLabel") as Label).visible)
	var status := panel.get_node("%FeedbackStatus") as Label
	assert(status != null and not status.text.is_empty())
	assert((panel.get_node("%ChoiceOne") as Button).focus_mode != Control.FOCUS_NONE)
	assert((panel.get_node("%PrimaryAction") as Button).focus_mode != Control.FOCUS_NONE)
	panel.free()
	return true

func _primary_action_tracks_the_current_stage() -> bool:
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	var panel := _mount_panel()
	var record := _required_record("salience")
	panel.call("show_effect", record, {"correct": true, "effect": "The product is noticed first."})
	await tree.process_frame
	var action_row := panel.get_node("%ActionRow") as HBoxContainer
	var primary_action := panel.get_node("%PrimaryAction") as Button
	assert(action_row.visible)
	assert(primary_action.text == "Apply this decision")
	panel.call("show_completed", record, {
		"required": true,
		"taskIndex": 4,
		"taskTotal": 7,
		"hasNextRequired": true,
	})
	await tree.process_frame
	assert(action_row.visible)
	assert(primary_action.text == "Next task")
	panel.free()
	return true

func _mount_panel() -> AdMarketAgencyMissionPanel:
	var scene := load(PANEL_SCENE_PATH) as PackedScene
	assert(scene != null)
	var panel := scene.instantiate() as AdMarketAgencyMissionPanel
	assert(panel != null)
	var tree := Engine.get_main_loop() as SceneTree
	tree.root.add_child(panel)
	return panel

func _required_record(mission_id: String) -> Dictionary:
	var catalog := load(CATALOG_PATH) as Script
	assert(catalog != null)
	var records: Array = catalog.call("required_missions")
	for index: int in range(records.size()):
		var value: Variant = records[index]
		if typeof(value) != TYPE_DICTIONARY:
			continue
		var record := Dictionary(value).duplicate(true)
		if String(record.get("id")) == mission_id:
			record["taskIndex"] = index + 1
			record["taskTotal"] = records.size()
			return record
	return {}
