extends RefCounted
class_name AdMarketTestAgencyAcademyHeader

const TOKENS_PATH := "res://src/ui/agency_academy_tokens.gd"
const HEADER_SCENE_PATH := "res://src/ui/AgencyAcademyHeader.tscn"

func run() -> bool:
	assert(_progress_states_are_truthful())
	assert(_header_exposes_seven_task_progress_and_actions())
	return true

func _progress_states_are_truthful() -> bool:
	var tokens_script := load(TOKENS_PATH) as Script
	assert(tokens_script != null)
	var states: Array = tokens_script.call("progress_states", 2, 7, 2)
	assert(states == ["complete", "complete", "current", "remaining", "remaining", "remaining", "remaining"])
	assert(tokens_script.call("progress_states", -4, 0, 99).is_empty())
	return true

func _header_exposes_seven_task_progress_and_actions() -> bool:
	var header_scene := load(HEADER_SCENE_PATH) as PackedScene
	assert(header_scene != null)
	var header := header_scene.instantiate() as Control
	assert(header != null)
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	tree.root.add_child(header)
	header.call("configure", "Audience Brief", "Salience and AIDA Attention", 2, 7, 2)
	assert((header.get_node("%SurfaceTitle") as Label).text == "Audience Brief")
	assert((header.get_node("%TaskProgressLabel") as Label).text == "Task 3 of 7")
	assert((header.get_node("%TermLabel") as Label).text == "Salience and AIDA Attention")
	var progress_dots := header.get_node("%ProgressDots") as HBoxContainer
	assert(progress_dots.get_child_count() == 7)
	var observed_states: Array[String] = []
	for dot: Control in progress_dots.get_children():
		observed_states.append(String(dot.get_meta("progress_state", "")))
		assert(not dot.tooltip_text.is_empty())
	assert(observed_states == ["complete", "complete", "current", "remaining", "remaining", "remaining", "remaining"])
	assert(header.find_child("*Score*", true, false) == null)
	var requested: Array[String] = []
	header.brief_requested.connect(func() -> void: requested.append("brief"))
	header.teacher_requested.connect(func() -> void: requested.append("teacher"))
	header.close_requested.connect(func() -> void: requested.append("close"))
	(header.get_node("%BriefButton") as Button).pressed.emit()
	(header.get_node("%TeacherButton") as Button).pressed.emit()
	(header.get_node("%CloseButton") as Button).pressed.emit()
	assert(requested == ["brief", "teacher", "close"])
	header.free()
	return true
