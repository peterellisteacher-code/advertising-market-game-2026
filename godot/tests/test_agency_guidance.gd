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
	assert(role_access.contains("every control and room"))
	assert(role_access.contains("divide responsibility"))
	assert(role_access.contains("do not unlock different controls"))
	assert(guide.get_node("%GuideTabs").get_tab_count() == 5)
	assert(guide.get_node("%GoToObjective").focus_mode == Control.FOCUS_ALL)
	guide.direct_travel_requested.connect(_capture_station)
	guide.go_to_objective()
	assert(_requested_station_id == "client-briefing")
	guide.set_progress(2, 7, 1)
	assert(guide.get_node("%RequiredProgress").text.contains("2 of 7 required"))
	assert(guide.get_node("%OptionalProgress").text.contains("1 optional"))
	assert(guide.get_node("%MasterVolumeLabel").text == "Overall volume: 70%")
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
	var orientation_minimise := guide.get_node("%MinimiseOrientation") as Control
	var orientation_next := guide.get_node("%OrientationNext") as Control
	assert(orientation_layer.visible)
	assert(orientation_layer.anchor_left == 0.0)
	assert(orientation_layer.anchor_top == 0.0)
	assert(orientation_layer.anchor_right == 1.0)
	assert(orientation_layer.anchor_bottom == 1.0)
	assert(orientation_layer.mouse_filter == Control.MOUSE_FILTER_STOP)
	assert(orientation_card.size.x <= 960.0)
	assert(orientation_card.size.y <= 560.0)
	assert(orientation_card.global_position.y >= 48.0)
	assert(orientation_minimise.global_position.y + orientation_minimise.size.y <= 760.0)
	assert(orientation_next.global_position.y + orientation_next.size.y <= 760.0)
	assert(guide.get_node("%OrientationTitle").text == "Make one advertisement for one client")
	assert(guide.get_node("%OrientationAction").text.contains("Build one advertisement"))
	assert(guide.get_node("%OrientationItemOneLabel").text == "START")
	assert(guide.get_node("%OrientationItemOneText").text.contains("client brief"))
	assert(guide.get_node("%OrientationItemTwoLabel").text == "FINISH")
	assert(guide.get_node("%OrientationItemTwoText").text.contains("required missions"))
	assert(not guide.get_node("%OrientationItemThree").visible)
	var minimise := guide.get_node("%MinimiseOrientation") as Button
	var resume := guide.get_node("%ResumeOrientation") as Button
	assert(not progress.guide_tucked)
	minimise.pressed.emit()
	assert(not orientation_layer.visible)
	assert(progress.guide_tucked)
	assert(resume.visible)
	assert(not progress.orientation_acknowledged)
	assert(not guide.reading_active())
	resume.pressed.emit()
	assert(orientation_layer.visible)
	assert(not resume.visible)
	assert(guide.get_node("%OrientationTitle").text == "Make one advertisement for one client")
	guide.advance_orientation()
	assert(guide.get_node("%OrientationTitle").text == "Go to Client Briefing")
	assert(guide.get_node("%OrientationAction").text == "Move there, then open the first task.")
	assert(guide.get_node("%OrientationItemOneText").text.contains("WASD or arrow keys"))
	assert(guide.get_node("%OrientationItemTwoText").text.contains("E, Space or Enter"))
	assert(guide.get_node("%OrientationItemThreeText").text.contains("click"))
	guide.advance_orientation()
	assert(guide.get_node("%OrientationTitle").text == "Know who leads each decision")
	assert(guide.get_node("%OrientationItemOneLabel").text == "STRATEGIST")
	assert(guide.get_node("%OrientationItemOneText").text.contains("audience, message, evidence and offer"))
	assert(guide.get_node("%OrientationItemTwoLabel").text == "ART DIRECTOR")
	assert(guide.get_node("%OrientationItemTwoText").text.contains("layout, colour, type and image"))
	assert(guide.get_node("%OrientationItemThreeText").text.contains("same controls and access"))
	_requested_station_id = ""
	guide.advance_orientation()
	assert(progress.orientation_acknowledged)
	assert(not orientation_layer.visible)
	assert(not orientation_card.visible)
	assert(not resume.visible)
	assert(_requested_station_id == "client-briefing")
	assert(not guide.get_node("%GuidePanel").visible)
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
	assert(hud.is_compact())
	assert(not hud.get_node("HudMargin/HudRow/GoalBlock").visible)
	assert(not hud.get_node("HudMargin/HudRow/ProgressBlock").visible)
	assert(not hud.get_node("HudMargin/HudRow/TravelBlock").visible)
	assert(not hud.get_node("%HudSoundToggle").visible)
	assert(hud.get_node("HudMargin/HudRow/ObjectiveBlock").visible)
	assert(hud.get_node("%HudGoToObjective").visible)
	assert(hud.get_node("%HudGuideButton").visible)
	var tuck_toggle := hud.get_node("%HudTuckToggle") as Button
	assert(tuck_toggle.text == "Show work details")
	assert(hud.size.x <= hud.custom_minimum_size.x)
	assert(tuck_toggle.position.x + tuck_toggle.size.x <= hud.size.x)
	assert(hud.size.y <= 80.0)
	tuck_toggle.pressed.emit()
	assert(not hud.is_compact())
	assert(hud.get_node("HudMargin/HudRow/GoalBlock").visible)
	assert(hud.get_node("HudMargin/HudRow/ProgressBlock").visible)
	assert(hud.get_node("HudMargin/HudRow/TravelBlock").visible)
	assert(hud.get_node("%HudSoundToggle").visible)
	assert(tuck_toggle.text == "Hide work details")
	assert(tuck_toggle.position.x + tuck_toggle.size.x <= hud.custom_minimum_size.x)
	assert(hud.size.y >= 120.0)
	tuck_toggle.pressed.emit()
	assert(hud.is_compact())
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
