extends RefCounted
class_name AdMarketTestAgencyGuidance

const GuideScene = preload("res://src/agency/ui/AgencyGuideDrawer.tscn")
const HudScene = preload("res://src/agency/ui/AgencyHud.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")
const MissionCatalog = preload("res://src/agency/agency_mission_catalog.gd")

var _requested_station_id: String = ""
var _requested_task_station_id: String = ""
var _requested_guide_section: String = ""

func run() -> bool:
	var progress := AgencyProgress.new()
	assert(progress.begin())
	await _assert_guide(progress)
	await _assert_acknowledged_progress_closes_stale_orientation()
	await _assert_hud(progress)
	return true

func _assert_guide(progress: AdMarketAgencyProgress) -> void:
	var guide := GuideScene.instantiate()
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	tree.root.add_child(guide)
	guide.configure(progress, MissionCatalog)
	await tree.process_frame
	assert(guide.get_node("%OverallGoal").text.contains("Create and pitch"))
	assert(guide.get_node("%CurrentObjective").text.contains("Meet the client"))
	assert(guide.get_node("%ObjectiveReason").text.contains("shared account"))
	var controls: String = guide.get_node("%Controls").text
	assert(controls.contains("WASD or arrow keys"))
	assert(controls.contains("E, Space or Enter"))
	assert(controls.contains("G or F1"))
	assert(not controls.contains("role"))
	assert(guide.get_node_or_null("GuidePanel/GuideMargin/GuideScroll/GuideContent/GuideTabs/Roles") == null)
	assert(guide.get_node_or_null("%Roles") == null)
	assert(guide.get_node("%GuideTabs").get_tab_count() == 4)
	assert(guide.get_node("%GoToObjective").focus_mode == Control.FOCUS_ALL)
	guide.direct_travel_requested.connect(_capture_station)
	guide.objective_task_requested.connect(_capture_task_station)
	guide.go_to_objective()
	assert(_requested_task_station_id == "client-briefing")
	guide.set_progress(2, 7, 1)
	assert(guide.get_node("%RequiredProgress").text.contains("2 of 7 required"))
	assert(guide.get_node("%OptionalProgress").text.contains("1 optional"))
	assert(guide.get_node("%MasterVolumeLabel").text == "Overall volume: 70%")
	guide.set_tucked(true)
	assert(guide.get_node("%GuideTab").visible)
	assert(not guide.get_node("%GuidePanel").visible)
	guide.open_guide("objective")
	await tree.process_frame
	assert(not guide.get_node("%GuideTab").visible)
	var guide_panel := guide.get_node("%GuidePanel") as Control
	assert(guide_panel.visible)
	var viewport_size := guide_panel.get_viewport_rect().size
	var guide_rect := guide_panel.get_global_rect()
	assert(guide_rect.position.y >= 0.0)
	assert(guide_rect.end.y <= viewport_size.y)
	var guide_contract: Dictionary = guide.layout_contract(Vector2(1280, 800))
	assert(guide_contract.get("withinViewport") == true)
	assert(guide_contract.get("contentScrolls") == true)
	assert(guide.get_node("%GuideScroll") is ScrollContainer)
	assert(guide_contract.get("singleInputOwner") == true)
	guide.set_tucked(true)
	assert(guide_panel.mouse_filter == Control.MOUSE_FILTER_IGNORE)
	assert((guide.get_node("%OrientationLayer") as Control).mouse_filter == Control.MOUSE_FILTER_IGNORE)
	guide.open_guide("objective")
	_requested_task_station_id = ""
	await _click_button(guide.get_node("%GoToObjective") as Button, tree)
	assert(_requested_task_station_id == "client-briefing")
	assert(not guide_panel.visible)
	guide.open_guide("objective")
	assert(guide.orientation_required())
	guide.open_orientation()
	await tree.process_frame
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
	# The card fills its layer rather than sitting at a fixed size, so what the contract
	# fixes is the inset: no bare game may show between the card and the screen edge
	# beyond this margin, at any viewport.
	var card_margin := AdMarketAgencyGuideDrawer.ORIENTATION_PANEL_MARGIN
	assert(
		is_equal_approx(orientation_card.size.x, orientation_layer.size.x - card_margin.x * 2.0),
		"Orientation card outer size=%s layer=%s" % [orientation_card.size, orientation_layer.size]
	)
	assert(
		is_equal_approx(orientation_card.size.y, orientation_layer.size.y - card_margin.y * 2.0),
		"Orientation card outer size=%s layer=%s" % [orientation_card.size, orientation_layer.size]
	)
	assert(
		orientation_card.global_position.y >= 48.0,
		"Orientation card y=%s size=%s" % [orientation_card.global_position.y, orientation_card.size]
	)
	var card_bottom := orientation_card.global_position.y + orientation_card.size.y
	assert(orientation_minimise.global_position.y + orientation_minimise.size.y <= card_bottom)
	assert(orientation_next.global_position.y + orientation_next.size.y <= card_bottom)
	assert(guide.get_node("%OrientationTitle").text.contains("make one ad and pitch it"))
	assert(guide.get_node("%OrientationAction").text.contains("seven required tasks"))
	assert(guide.get_node("%OrientationItemOneLabel").text == "THE WORK")
	assert(guide.get_node("%OrientationItemOneText").text.contains("a reason to act"))
	assert(guide.get_node("%OrientationItemTwoLabel").text == "THE TASKS")
	assert(guide.get_node("%OrientationItemTwoText").text.contains("advertising technique"))
	assert(guide.get_node("%OrientationItemThreeLabel").text == "THE PITCH")
	assert(guide.get_node("%OrientationItemThreeText").text.contains("explain your decisions"))
	var minimise := guide.get_node("%MinimiseOrientation") as Button
	var resume := guide.get_node("%ResumeOrientation") as Button
	assert(not progress.guide_tucked)
	await _click_button(minimise, tree)
	assert(not orientation_layer.visible)
	assert(progress.guide_tucked)
	assert(resume.visible)
	assert(not progress.orientation_acknowledged)
	assert(not guide.reading_active())
	await _activate_button_with_keyboard(resume, tree)
	assert(orientation_layer.visible)
	assert(not resume.visible)
	assert(guide.get_node("%OrientationTitle").text.contains("make one ad and pitch it"))
	await _click_button(orientation_next as Button, tree)
	assert(guide.get_node("%OrientationTitle").text == "Move to the first task")
	assert(guide.get_node("%OrientationAction").text.contains("Go to Client Briefing"))
	assert(guide.get_node("%OrientationItemOneText").text.contains("WASD or arrow keys"))
	assert(guide.get_node("%OrientationItemTwoText").text.contains("click Start task"))
	assert(guide.get_node("%OrientationItemThreeText").text.contains("click"))
	await _click_button(orientation_next as Button, tree)
	assert(guide.get_node("%OrientationTitle").text == "Begin the work")
	assert(guide.get_node("%OrientationItemOneLabel").text == "READ")
	assert(guide.get_node("%OrientationItemTwoLabel").text == "BUILD")
	assert(guide.get_node("%OrientationItemThreeLabel").text == "PITCH")
	_requested_station_id = ""
	await _click_button(orientation_next as Button, tree)
	assert(progress.orientation_acknowledged)
	assert(not orientation_layer.visible)
	assert(not orientation_card.visible)
	assert(not resume.visible)
	assert(_requested_station_id == "client-briefing")
	assert(not guide.get_node("%GuidePanel").visible)
	guide.free()

func _assert_acknowledged_progress_closes_stale_orientation() -> void:
	var stale_progress := AgencyProgress.new()
	assert(stale_progress.begin())
	var guide := GuideScene.instantiate()
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	tree.root.add_child(guide)
	guide.configure(stale_progress, MissionCatalog)
	guide.open_orientation()
	await tree.process_frame
	var orientation_layer := guide.get_node("%OrientationLayer") as Control
	var orientation_card := guide.get_node("%OrientationPanel") as Control
	assert(orientation_layer.visible)
	assert(orientation_card.visible)
	var restored_progress := AgencyProgress.new()
	assert(restored_progress.begin())
	restored_progress.orientation_acknowledged = true
	restored_progress.guide_tucked = true
	guide.configure(restored_progress, MissionCatalog)
	await tree.process_frame
	assert(
		not orientation_layer.visible,
		"An acknowledged saved run must not inherit the preview quick-start overlay"
	)
	assert(not orientation_card.visible)
	assert(not guide.reading_active())
	guide.free()

func _assert_hud(progress: AdMarketAgencyProgress) -> void:
	var hud := HudScene.instantiate()
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	tree.root.add_child(hud)
	var objective := MissionCatalog.objective(progress.current_objective_id)
	hud.show_objective(objective)
	hud.set_progress(0, 7, 0)
	await tree.process_frame
	assert(hud.get_node("%HudGoal").text.contains("Create and pitch"))
	assert(hud.get_node("%HudObjective").text.contains("Meet the client"))
	assert(hud.get_node("%HudProgress").text.contains("0 of 7"))
	assert(hud.is_compact())
	var hud_contract: Dictionary = hud.layout_contract(Vector2(1280, 800))
	assert(float(hud_contract.get("compactHeight", 0.0)) <= 112.0)
	assert(hud_contract.get("directCampaignAction") == true)
	var expanded_details := hud.get_node("HudMargin/HudStack/ExpandedDetails") as Control
	assert(not expanded_details.visible)
	assert(not hud.get_node("HudMargin/HudStack/PrimaryRow/ObjectiveBlock/ObjectiveEyebrow").visible)
	assert(not hud.get_node("%HudOwner").visible)
	assert(hud.get_node("HudMargin/HudStack/PrimaryRow/ObjectiveBlock").visible)
	assert(hud.get_node("%HudGoToObjective").visible)
	assert(hud.get_node("%HudGuideButton").visible)
	var tuck_toggle := hud.get_node("%HudTuckToggle") as Button
	assert(tuck_toggle.text == "Work details")
	assert(hud.size.x >= hud.custom_minimum_size.x)
	assert(tuck_toggle.position.x + tuck_toggle.size.x <= hud.size.x)
	assert(
		hud.size.y <= 84.0,
		"Compact HUD size=%s minimum=%s" % [hud.size, hud.custom_minimum_size]
	)
	tuck_toggle.pressed.emit()
	assert(not hud.is_compact())
	assert(expanded_details.visible)
	assert(hud.get_node("HudMargin/HudStack/PrimaryRow/ObjectiveBlock/ObjectiveEyebrow").visible)
	assert(hud.get_node("%HudOwner").visible)
	assert(hud.get_node("HudMargin/HudStack/ExpandedDetails/GoalBlock").visible)
	assert(hud.get_node("HudMargin/HudStack/ExpandedDetails/ProgressBlock").visible)
	assert(hud.get_node("HudMargin/HudStack/ExpandedDetails/TravelBlock").visible)
	assert(hud.get_node("%HudSoundToggle").visible)
	assert(tuck_toggle.text == "Hide details")
	assert(tuck_toggle.position.x + tuck_toggle.size.x <= hud.size.x)
	assert(hud.size.y >= 120.0)
	tuck_toggle.pressed.emit()
	assert(hud.is_compact())
	assert(hud.get_node("%HudGuideButton").focus_mode == Control.FOCUS_ALL)
	assert(hud.get_node("%HudGoToObjective").focus_mode == Control.FOCUS_ALL)
	hud.direct_travel_requested.connect(_capture_station)
	hud.objective_task_requested.connect(_capture_task_station)
	hud.guide_requested.connect(_capture_guide_section)
	_requested_task_station_id = ""
	hud.go_to_objective()
	assert(_requested_task_station_id == "client-briefing")
	hud.open_guide("controls")
	assert(_requested_guide_section == "controls")
	hud.free()

func _click_button(button: Button, tree: SceneTree) -> void:
	assert(button != null and button.visible and not button.disabled)
	var viewport := button.get_viewport()
	assert(viewport != null)
	var centre := button.get_global_rect().get_center()
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.button_mask = MOUSE_BUTTON_MASK_LEFT
	press.pressed = true
	press.position = centre
	press.global_position = centre
	viewport.push_input(press, true)
	await tree.process_frame
	var release := press.duplicate() as InputEventMouseButton
	release.button_mask = 0
	release.pressed = false
	viewport.push_input(release, true)
	await tree.process_frame

func _activate_button_with_keyboard(button: Button, tree: SceneTree) -> void:
	assert(button != null and button.visible and not button.disabled)
	button.grab_focus()
	await tree.process_frame
	assert(button.has_focus())
	var viewport := button.get_viewport()
	assert(viewport != null)
	var press := InputEventAction.new()
	press.action = &"ui_accept"
	press.pressed = true
	viewport.push_input(press)
	await tree.process_frame
	var release := InputEventAction.new()
	release.action = &"ui_accept"
	release.pressed = false
	viewport.push_input(release)
	await tree.process_frame

func _capture_station(station_id: String) -> void:
	_requested_station_id = station_id

func _capture_task_station(station_id: String) -> void:
	_requested_task_station_id = station_id

func _capture_guide_section(section: String) -> void:
	_requested_guide_section = section
