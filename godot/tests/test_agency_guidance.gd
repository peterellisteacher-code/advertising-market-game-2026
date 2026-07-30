extends RefCounted
class_name AdMarketTestAgencyGuidance

const GuideScene = preload("res://src/agency/ui/AgencyGuideDrawer.tscn")
const HudScene = preload("res://src/agency/ui/AgencyHud.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")
const MissionCatalog = preload("res://src/agency/agency_mission_catalog.gd")

var _requested_station_id: String = ""
var _requested_guide_section: String = ""

func run() -> bool:
	var progress := AgencyProgress.new()
	assert(progress.begin())
	_assert_guide(progress)
	_assert_hud(progress)
	return true

func _assert_guide(progress: AdMarketAgencyProgress) -> void:
	var guide := GuideScene.instantiate()
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	tree.root.add_child(guide)
	guide.configure(progress, MissionCatalog)
	assert(guide.get_node("%OverallGoal").text.contains("Create and pitch"))
	assert(guide.get_node("%CurrentObjective").text.contains("Meet the client"))
	assert(guide.get_node("%ObjectiveReason").text.contains("shared account"))
	var controls: String = guide.get_node("%Controls").text
	assert(controls.contains("WASD or arrow keys"))
	assert(controls.contains("E, Space or Enter"))
	assert(controls.contains("G or F1"))
	assert(controls.contains("H"))
	var art_role: String = guide.get_node("%ArtDirectorDefinition").text
	assert(art_role.contains("layout, colour, type, images and visual emphasis"))
	assert(art_role.contains("where the audience will look first"))
	var strategy_role: String = guide.get_node("%StrategistDefinition").text
	assert(strategy_role.contains("audience, message, evidence, offer and call to action"))
	assert(strategy_role.contains("why those choices should persuade the intended audience"))
	var role_access: String = guide.get_node("GuidePanel/GuideMargin/GuideContent/GuideTabs/Roles/RoleTurnOrder").text
	assert(role_access.contains("every control and station"))
	assert(role_access.contains("divide responsibility"))
	assert(role_access.contains("do not unlock different tools"))
	assert(guide.get_node("%GuideTabs").get_tab_count() == 5)
	assert(guide.get_node("%GoToObjective").focus_mode == Control.FOCUS_ALL)
	guide.direct_travel_requested.connect(_capture_station)
	guide.go_to_objective()
	assert(_requested_station_id == "client-briefing")
	guide.set_progress(2, 7, 1)
	assert(guide.get_node("%RequiredProgress").text.contains("2 of 7 required"))
	assert(guide.get_node("%OptionalProgress").text.contains("1 optional"))
	guide.set_tucked(true)
	assert(guide.get_node("%GuideTab").visible)
	assert(not guide.get_node("%GuidePanel").visible)
	guide.open_guide("roles")
	assert(not guide.get_node("%GuideTab").visible)
	assert(guide.get_node("%GuidePanel").visible)
	assert(guide.orientation_required())
	guide.open_orientation()
	var orientation_layer := guide.get_node("%OrientationLayer") as Control
	var orientation_card := guide.get_node("%OrientationPanel") as Control
	assert(orientation_layer.visible)
	assert(orientation_layer.anchor_left == 0.0)
	assert(orientation_layer.anchor_top == 0.0)
	assert(orientation_layer.anchor_right == 1.0)
	assert(orientation_layer.anchor_bottom == 1.0)
	assert(orientation_layer.mouse_filter == Control.MOUSE_FILTER_STOP)
	assert(orientation_card.size.x <= 960.0)
	assert(orientation_card.size.y <= 720.0)
	assert(guide.get_node("%OrientationTitle").text == "Your goal: win the client pitch")
	var goal_copy: String = guide.get_node("%OrientationBody").text
	assert(goal_copy.contains("Read the client brief"))
	assert(goal_copy.contains("Build one advertisement"))
	assert(goal_copy.contains("required practice missions"))
	assert(goal_copy.contains("Pitch the finished advertisement"))
	assert(goal_copy.contains("unlocks only after every required mission"))
	assert(goal_copy.contains("three display formats"))
	assert(goal_copy.contains("client response"))
	assert(goal_copy.contains("portfolio stamps"))
	assert(goal_copy.contains("never block completion"))
	assert(goal_copy.contains("Gold, Silver and Bronze"))
	guide.advance_orientation()
	assert(guide.get_node("%OrientationTitle").text == "How to reach each task")
	var controls_copy: String = guide.get_node("%OrientationBody").text
	assert(controls_copy.contains("Walk: WASD or arrow keys"))
	assert(controls_copy.contains("Use a nearby station: E, Space or Enter"))
	assert(controls_copy.contains("Direct travel"))
	assert(controls_copy.contains("Start at Client Brief"))
	guide.advance_orientation()
	assert(guide.get_node("%OrientationTitle").text == "How the pair roles differ")
	var roles_copy: String = guide.get_node("%OrientationBody").text
	assert(roles_copy.contains("Strategist:"))
	assert(roles_copy.contains("Art Director:"))
	assert(roles_copy.contains("Both partners can use every control and station"))
	assert(roles_copy.contains("roles divide responsibility"))
	assert(roles_copy.contains("Press H"))
	guide.advance_orientation()
	assert(progress.orientation_acknowledged)
	assert(not orientation_layer.visible)
	assert(not orientation_card.visible)
	guide.free()

func _assert_hud(progress: AdMarketAgencyProgress) -> void:
	var hud := HudScene.instantiate()
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	tree.root.add_child(hud)
	var objective := MissionCatalog.objective(progress.current_objective_id)
	hud.show_objective(objective)
	hud.set_progress(0, 7, 0)
	assert(hud.get_node("%HudGoal").text.contains("Create and pitch"))
	assert(hud.get_node("%HudObjective").text.contains("Meet the client"))
	assert(hud.get_node("%HudProgress").text.contains("0 of 7"))
	assert(hud.get_node("%HudGuideButton").focus_mode == Control.FOCUS_ALL)
	assert(hud.get_node("%HudGoToObjective").focus_mode == Control.FOCUS_ALL)
	hud.direct_travel_requested.connect(_capture_station)
	hud.guide_requested.connect(_capture_guide_section)
	_requested_station_id = ""
	hud.go_to_objective()
	assert(_requested_station_id == "client-briefing")
	hud.open_guide("controls")
	assert(_requested_guide_section == "controls")
	hud.free()

func _capture_station(station_id: String) -> void:
	_requested_station_id = station_id

func _capture_guide_section(section: String) -> void:
	_requested_guide_section = section
