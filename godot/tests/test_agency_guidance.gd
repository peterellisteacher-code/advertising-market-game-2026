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
	assert(guide.get_node("%Controls").text.contains("WASD or arrow keys"))
	assert(guide.get_node("%ArtDirectorDefinition").text.contains("controls visual"))
	assert(guide.get_node("%StrategistDefinition").text.contains("controls audience"))
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
	assert(guide.get_node("%GuideTabs").current_tab == 3)
	assert(guide.orientation_required())
	guide.open_orientation()
	assert(guide.get_node("%OrientationPanel").visible)
	assert(guide.get_node("%OrientationTitle").text.contains("campaign goal"))
	guide.advance_orientation()
	guide.advance_orientation()
	guide.advance_orientation()
	assert(progress.orientation_acknowledged)
	assert(not guide.get_node("%OrientationPanel").visible)
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
