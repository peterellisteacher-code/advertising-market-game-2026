extends RefCounted
class_name AdMarketTestAgencyWorld

const WorldScene = preload("res://src/agency/AgencyWorld.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")
const CampaignController = preload("res://src/agency/agency_campaign_controller.gd")
const GameRun = preload("res://src/game/game_run.gd")

var _workspace_requested: bool = false

func run() -> bool:
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	await _assert_quick_start_opens_product_workspace(tree)
	var world := WorldScene.instantiate()
	var progress := AgencyProgress.new()
	assert(progress.begin())
	world.configure(progress)
	assert(world.objective_station_id() == "client-briefing")
	progress.completed_mission_ids.append("audience-brief")
	assert(world.objective_station_id() == "art-studio")
	progress.completed_mission_ids.erase("audience-brief")
	world.set_reduced_motion_enabled(true)
	tree.root.add_child(world)
	await tree.process_frame
	await tree.physics_frame
	if not world.is_node_ready():
		world.call("_ready")
	var agency_floor := world.get_node("AgencyFloor") as Sprite2D
	assert(agency_floor.z_index >= 0)
	var pair := world.get_node("%AgencyPair") as CharacterBody2D
	var guide := world.get_node("%AgencyGuideDrawer") as AdMarketAgencyGuideDrawer
	var orientation := guide.get_node("OrientationLayer") as Control
	var guide_panel := guide.get_node("GuidePanel") as Control
	assert(orientation.visible)
	assert(not pair.input_enabled)
	assert(pair.modal_open)
	guide.advance_orientation()
	guide.advance_orientation()
	guide.advance_orientation()
	guide.advance_orientation()
	assert(not orientation.visible)
	assert(not guide_panel.visible)
	assert(not guide.orientation_required())
	assert(pair.input_enabled)
	assert(not pair.modal_open)
	assert(not guide.get_node("GuideTab").visible)
	var agency_hud := world.get_node("%AgencyHud") as AdMarketAgencyHud
	agency_hud.open_guide("roles")
	assert(guide_panel.visible)
	assert(not pair.input_enabled)
	assert(pair.modal_open)
	guide.set_tucked(true)
	await tree.process_frame
	assert(not guide_panel.visible)
	var visible_guide_button := world.get_node("%HudGuideButton") as Button
	assert(world.get_viewport().gui_get_focus_owner() == visible_guide_button)
	assert(pair.input_enabled)
	assert(not pair.modal_open)
	agency_hud.open_guide("roles")
	guide.role_handoff_requested.emit("art-director")
	await tree.process_frame
	var handoff_panel := world.get_node("%HandoffPanel") as Control
	var requested_handoff := world.get_node("%ArtDirectorHandoff") as Button
	assert(handoff_panel.visible)
	assert(world.get_viewport().gui_get_focus_owner() == requested_handoff)
	(world.get_node("%CancelHandoff") as Button).pressed.emit()
	assert(not handoff_panel.visible)
	await _assert_station_card_can_be_tucked(world, progress, tree)
	_assert_station_mission_panel_uses_role_and_modal_state(world, progress)
	_assert_keyboard_handoff_and_guide_shortcuts(world, progress)
	await _assert_modal_shortcuts_and_station_focus(world, progress, tree)
	assert(world.direct_travel("reception"))
	assert(world.current_station_id() == "reception")
	_assert_pair_arrives_at_safe_station_marker(world, "Reception")
	_assert_station_labels_are_unique_and_contextual(world, "Reception")
	_assert_pair_has_single_visual_and_collision_set(world)
	_assert_world_travel_and_label_contract(world)
	_assert_motion_and_ambient_contract(world)
	var strategy_station := world.get_node("Stations/StrategyRoom") as Area2D
	strategy_station.position += Vector2(0.0, -28.0)
	assert(world.direct_travel("strategy-room"))
	assert(world.current_station_id() == "strategy-room")
	_assert_pair_arrives_at_safe_station_marker(world, "StrategyRoom")
	_assert_station_labels_are_unique_and_contextual(world, "StrategyRoom")
	assert(not world.direct_travel("executive-lift"))
	world.set_input_enabled(false)
	assert(not pair.input_enabled)
	assert(agency_hud != null)
	assert(guide != null)
	assert(not guide.get_node("GuideTab").visible)
	var hud_guide_button := (
		agency_hud.get_node("HudMargin/HudStack/PrimaryRow/HudGuideButton") as Button
	)
	var hud_travel_menu := agency_hud.get_node(
		"HudMargin/HudStack/ExpandedDetails/TravelBlock/HudDirectTravel"
	) as OptionButton
	assert(hud_guide_button.focus_mode == Control.FOCUS_ALL)
	assert(hud_travel_menu.item_count == 9)
	assert(world.get_node("HUD/HUDRoot/ObjectiveBar").visible == false)
	world.free()
	return true

func _assert_quick_start_opens_product_workspace(tree: SceneTree) -> void:
	_workspace_requested = false
	var game_run := GameRun.new() as AdMarketGameRun
	assert(is_instance_valid(game_run))
	assert(game_run.begin("North Star Studio", "session-workspace-route", "team-workspace-route"))
	var controller := CampaignController.new() as AdMarketAgencyCampaignController
	assert(is_instance_valid(controller))
	controller.begin_agency(game_run, {
		"product": {},
		"gameplay": {
			"pair": {
				"activeRole": "art-director",
				"handoffCount": 0,
			},
		},
	})
	var progress := game_run.agency_progress() as AdMarketAgencyProgress
	assert(progress != null and progress.current_objective_id == "meet-client")
	var world := WorldScene.instantiate() as AdMarketAgencyWorld
	assert(is_instance_valid(world))
	world.configure(progress)
	world.set_reduced_motion_enabled(true)
	world.station_requested.connect(controller.open_station)
	controller.creator_requested.connect(_capture_workspace_request)
	tree.root.add_child(world)
	await tree.process_frame
	await tree.physics_frame
	var guide := world.get_node("%AgencyGuideDrawer") as AdMarketAgencyGuideDrawer
	var orientation := guide.get_node("%OrientationLayer") as Control
	var orientation_next := guide.get_node("%OrientationNext") as Button
	assert(orientation.visible)
	for expected_title: String in [
		"Move to the first task",
		"Share the decisions",
		"Begin the work",
	]:
		await _click_button(orientation_next, tree)
		assert((guide.get_node("%OrientationTitle") as Label).text == expected_title)
	await _click_button(orientation_next, tree)
	assert(progress.orientation_acknowledged)
	assert(not orientation.visible)
	assert(world.current_station_id() == "client-briefing")
	var agency_hud := world.get_node("%AgencyHud") as AdMarketAgencyHud
	var objective_label := agency_hud.get_node(
		"HudMargin/HudStack/PrimaryRow/ObjectiveBlock/HudObjective"
	) as Label
	var go_to_task := agency_hud.get_node(
		"HudMargin/HudStack/PrimaryRow/HudGoToObjective"
	) as Button
	assert(objective_label.text.begins_with("Task 1 of 7"))
	assert(go_to_task.visible and not go_to_task.disabled)
	await _activate_button_with_keyboard(go_to_task, tree)
	var mission_panel := world.get_node("%AgencyMissionPanel") as Control
	var mission_controller := world.get_node("%AgencyMissionController") as Node
	assert(mission_panel.visible)
	assert(mission_controller.call("snapshot").get("missionId") == "audience-brief")
	mission_controller.call("close")
	assert(controller.complete_mission("audience-brief", {
		"decision": "independence",
		"effect": "The offer supports the audience's need to control the hour after school.",
	}))
	world.configure(progress)
	await tree.process_frame
	assert(objective_label.text.begins_with("Task 2 of 7"))
	await _activate_button_with_keyboard(go_to_task, tree)
	assert(world.current_station_id() == "art-studio")
	assert(mission_panel.visible)
	assert(mission_controller.call("snapshot").get("missionId") == "salience")
	mission_controller.call("close")
	assert(world.direct_travel("production-studio"))
	var station_action := world.get_node("%StationActionButton") as Button
	assert(station_action.visible and not station_action.disabled)
	await _click_button(station_action, tree)
	assert(_workspace_requested)
	world.queue_free()
	await tree.process_frame

func _capture_workspace_request() -> void:
	_workspace_requested = true

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
	assert(
		button != null and button.is_visible_in_tree() and not button.disabled,
		_control_visibility_chain(button)
	)
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

func _control_visibility_chain(control: Control) -> String:
	var entries: Array[String] = []
	var node: Node = control
	while node != null:
		var canvas_item := node as CanvasItem
		if canvas_item != null:
			entries.append("%s visible=%s tree=%s" % [
				node.name,
				canvas_item.visible,
				canvas_item.is_visible_in_tree(),
			])
		node = node.get_parent()
	return " | ".join(entries)

func _assert_station_card_can_be_tucked(
	world: Node,
	progress: RefCounted,
	tree: SceneTree
) -> void:
	var station_panel := world.get_node("%StationPanel") as Control
	var station_tab := world.get_node("%StationPanelTab") as Button
	var details := world.get_node("%StationResponsibilities") as Label
	var details_toggle := world.get_node("%StationDetailsToggle") as Button
	var tuck := world.get_node("%StationPanelTuck") as Button
	assert(station_panel.visible)
	assert(not station_tab.visible)

	assert(not details.visible)
	assert(details_toggle.text == "Show room details")
	await _click_button(details_toggle, tree)
	assert(details.visible)
	assert(details_toggle.text == "Hide room details")
	var viewport_size := station_panel.get_viewport_rect().size
	var expanded_rect := station_panel.get_global_rect()
	assert(expanded_rect.position.y >= 0.0)
	assert(expanded_rect.end.y <= viewport_size.y)
	await _click_button(details_toggle, tree)
	assert(not details.visible)
	var station_before := world.call("current_station_id") as String
	await _click_button(tuck, tree)
	assert(not station_panel.visible)
	assert(station_tab.visible)
	assert(station_tab.text.contains("Open"))
	assert(world.call("current_station_id") == station_before)
	assert(progress.get("current_station_id") == station_before)
	await _click_button(station_tab, tree)
	assert(station_panel.visible)
	assert(not station_tab.visible)

func _assert_world_travel_and_label_contract(world: Node) -> void:
	var pair := world.get_node("%AgencyPair") as CharacterBody2D
	var station_records := [
		["reception", "Reception"],
		["client-briefing", "ClientBriefing"],
		["strategy-room", "StrategyRoom"],
		["art-studio", "ArtStudio"],
		["copy-room", "CopyRoom"],
		["production-studio", "ProductionStudio"],
		["media-desk", "MediaDesk"],
		["sound-booth", "SoundBooth"],
		["pitch-theatre", "PitchTheatre"],
	]
	for record: Array in station_records:
		var station_id := String(record[0])
		var station := world.get_node("Stations/%s" % String(record[1])) as Area2D
		assert(world.direct_travel(station_id))
		assert(pair.movement_bounds.has_point(pair.position))
		_assert_pair_arrives_at_safe_station_marker(world, String(record[1]))
		_assert_pair_clear_of_world_collision(world, String(record[0]))
	assert(world.direct_travel("client-briefing"))
	var client_station := world.get_node("Stations/ClientBriefing") as Area2D
	assert(pair.position.is_equal_approx(client_station.position + Vector2(0.0, 48.0)))
	var world_bounds := world.get_node("WorldBounds") as StaticBody2D
	var client_collision := world.get_node("WorldBounds/ClientBriefingFixture") as CollisionShape2D
	var client_shape := client_collision.shape as RectangleShape2D
	var pair_collision := pair.get_node("BodyCollision") as CollisionShape2D
	var pair_shape := pair_collision.shape as CapsuleShape2D
	var fixture_bottom := client_collision.global_position.y + client_shape.size.y * 0.5
	var pair_top := pair_collision.global_position.y - pair_shape.height * 0.5
	assert(pair_top >= fixture_bottom)
	assert(not client_collision.disabled)
	assert((pair.collision_mask & world_bounds.collision_layer) != 0)
	var motion_parameters := PhysicsTestMotionParameters2D.new()
	motion_parameters.from = pair.global_transform
	motion_parameters.motion = Vector2(0.0, -90.0)
	var motion_result := PhysicsTestMotionResult2D.new()
	assert(PhysicsServer2D.body_test_motion(pair.get_rid(), motion_parameters, motion_result))
	assert(motion_result.get_collider_id() == world_bounds.get_instance_id())
	assert(motion_result.get_travel().y > motion_parameters.motion.y)
	assert(pair.position.y > client_station.position.y)
	var labels := client_station.find_children("*", "Label", true, false)
	assert(labels.size() == 1)
	assert(client_station.get_node_or_null("OwnerRoleBadge") == null)
	assert((labels.front() as Label).get_theme_stylebox("normal") != null)
	assert(pair.find_children("*", "Label", true, false).is_empty())
	var tuck := world.get_node("%StationPanelTuck") as Button
	var tab := world.get_node("%StationPanelTab") as Button
	tuck.pressed.emit()
	assert(tab.text == "Open Client briefing")
	tab.pressed.emit()

func _assert_station_mission_panel_uses_role_and_modal_state(
	world: Node,
	progress: RefCounted
) -> void:
	assert(world.call("direct_travel", "client-briefing"))
	var pair: CharacterBody2D = world.get_node("%AgencyPair") as CharacterBody2D
	var panel: Control = world.get_node("%AgencyMissionPanel") as Control
	if not panel.is_node_ready():
		panel.call("_ready")
	var controller: Node = world.get_node("%AgencyMissionController") as Node
	var station_action: Button = world.get_node("%StationActionButton") as Button
	station_action.pressed.emit()
	assert(panel.visible)
	assert(controller.call("snapshot").get("state") == "holding")
	var content_path: String = "Backdrop/Dialog/Margin/Content"
	var holding_label: Label = panel.get_node("%s/OwnerCard/HoldingLabel" % content_path) as Label
	assert(not holding_label.visible)
	var instruction: Label = panel.get_node("%s/Instruction" % content_path) as Label
	assert(instruction.text == "Make the Strategist active to answer this question.")
	var choice_stage: VBoxContainer = panel.get_node("%s/ChoiceStage" % content_path) as VBoxContainer
	assert(not choice_stage.visible)
	var handoff_button: Button = panel.get_node("%s/RoleHandoffButton" % content_path) as Button
	assert(handoff_button.visible)
	assert(handoff_button.text == "Make Strategist active")
	assert(not pair.input_enabled)
	assert(pair.modal_open)
	handoff_button.pressed.emit()
	assert(progress.get("active_role") == "strategist")
	assert(pair.get("active_role") == "strategist")
	assert(panel.visible)
	assert(controller.call("snapshot").get("state") == "choice")
	assert(choice_stage.visible)
	assert(not handoff_button.visible)
	var choice_one: Button = panel.get_node("%s/ChoiceStage/ChoiceGrid/ChoiceOne" % content_path) as Button
	assert(not choice_one.disabled)
	assert(_perceived_luminance(choice_one.get_theme_color("font_disabled_color")) < 0.45)
	_assert_mission_panel_is_readable_and_bounded(panel)
	controller.call("close")
	assert(not panel.visible)
	assert(pair.input_enabled)
	assert(not pair.modal_open)

func _assert_keyboard_handoff_and_guide_shortcuts(world: Node, progress: RefCounted) -> void:
	var pair: CharacterBody2D = world.get_node("%AgencyPair") as CharacterBody2D
	var handoff_panel: Control = world.get_node("%HandoffPanel") as Control
	var handoff_event: InputEventKey = InputEventKey.new()
	handoff_event.keycode = KEY_H
	handoff_event.pressed = true
	world.call("_unhandled_key_input", handoff_event)
	assert(handoff_panel.visible)
	assert(pair.modal_open)
	var art_director_button: Button = world.get_node("%ArtDirectorHandoff") as Button
	art_director_button.pressed.emit()
	assert(progress.get("active_role") == "art-director")
	assert(pair.get("active_role") == "art-director")
	assert(not handoff_panel.visible)
	assert(not pair.modal_open)
	var guide_event: InputEventKey = InputEventKey.new()
	guide_event.keycode = KEY_G
	guide_event.pressed = true
	world.call("_unhandled_key_input", guide_event)
	var guide := world.get_node("%AgencyGuideDrawer") as AdMarketAgencyGuideDrawer
	assert((guide.get_node("GuidePanel") as Control).visible)
	guide.set_tucked(true)

func _assert_modal_shortcuts_and_station_focus(
	world: Node,
	progress: RefCounted,
	tree: SceneTree
) -> void:
	var pair: CharacterBody2D = world.get_node("%AgencyPair") as CharacterBody2D
	var handoff_panel: Control = world.get_node("%HandoffPanel") as Control
	var guide: AdMarketAgencyGuideDrawer = world.get_node("%AgencyGuideDrawer") as AdMarketAgencyGuideDrawer
	var guide_panel: Control = guide.get_node("GuidePanel") as Control
	var station_panel: Control = world.get_node("%StationPanel") as Control
	var station_tab: Button = world.get_node("%StationPanelTab") as Button
	var station_tuck: Button = world.get_node("%StationPanelTuck") as Button
	var art_button: Button = world.get_node("%ArtDirectorHandoff") as Button
	var strategist_button: Button = world.get_node("%StrategistHandoff") as Button
	if not station_tab.visible:
		station_tuck.pressed.emit()
	assert(station_tab.visible)
	world.call("_show_handoff_dialog")
	var active_role: String = String(progress.get("active_role"))
	assert(art_button.disabled == (active_role == "art-director"))
	assert(strategist_button.disabled == (active_role == "strategist"))
	var available_handoff: Button = strategist_button if active_role == "art-director" else art_button
	assert(world.get_viewport().gui_get_focus_owner() == available_handoff)
	var guide_event: InputEventAction = InputEventAction.new()
	guide_event.action = &"guide"
	guide_event.pressed = true
	world.call("_unhandled_input", guide_event)
	assert(handoff_panel.visible)
	assert(not guide_panel.visible)
	assert(pair.modal_open)
	assert(not pair.input_enabled)
	assert(pair.modal_open)
	assert(not pair.input_enabled)
	assert(world.get_viewport().gui_get_focus_owner() == available_handoff)
	(world.get_node("%CancelHandoff") as Button).pressed.emit()
	assert(not handoff_panel.visible)
	assert(station_tab.visible)
	assert(world.get_viewport().gui_get_focus_owner() == station_tab)
	station_tab.pressed.emit()
	await tree.process_frame
	assert(station_panel.visible)
	station_tuck.pressed.emit()
	assert(station_tab.visible)
	world.call("_show_handoff_dialog")
	assert(world.get_viewport().gui_get_focus_owner() == available_handoff)
	await tree.process_frame
	assert(handoff_panel.visible)
	assert(pair.modal_open)
	assert(not pair.input_enabled)
	assert(world.get_viewport().gui_get_focus_owner() == available_handoff)
	(world.get_node("%CancelHandoff") as Button).pressed.emit()
	assert(not handoff_panel.visible)
	assert(station_tab.visible)
	assert(world.get_viewport().gui_get_focus_owner() == station_tab)

func _assert_mission_panel_is_readable_and_bounded(panel: Control) -> void:
	# The panel is the full-screen backdrop, so it tracks the viewport rather than the
	# 1280x800 design size. Readability is the Dialog's job, asserted just below.
	var viewport := panel.get_viewport_rect().size
	assert(panel.size.x >= viewport.x and panel.size.y >= viewport.y)
	var dialog := panel.get_node("Backdrop/Dialog") as Control
	assert(dialog.size.x <= 980.0)
	assert(dialog.size.y <= 700.0)
	var content_path := "Backdrop/Dialog/Margin/Content"
	var readable_labels := [
		panel.get_node("%s/Title" % content_path) as Label,
		panel.get_node("%s/Goal" % content_path) as Label,
		panel.get_node("%s/OwnerCard/HoldingLabel" % content_path) as Label,
		panel.get_node("%s/Instruction" % content_path) as Label,
		panel.get_node("%s/ChoiceStage/KeyboardHint" % content_path) as Label,
		panel.get_node("%s/EffectStage/EffectHeading" % content_path) as Label,
		panel.get_node("%s/CompletedStage/CompletedHeading" % content_path) as Label,
	]
	for label in readable_labels:
		assert(_perceived_luminance(label.get_theme_color("font_color")) < 0.45)
	var choice_one := panel.get_node("%s/ChoiceStage/ChoiceGrid/ChoiceOne" % content_path) as Button
	assert(_perceived_luminance(choice_one.get_theme_color("font_focus_color")) < 0.45)

func _perceived_luminance(color: Color) -> float:
	return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722

func _assert_pair_arrives_at_safe_station_marker(world: Node, station_name: String) -> void:
	var pair := world.get_node("%AgencyPair") as CharacterBody2D
	var station := world.get_node("Stations/%s" % station_name) as Area2D
	assert(pair.position.distance_to(station.position) <= 48.0)

func _assert_pair_clear_of_world_collision(world: Node, station_id: String) -> void:
	var pair := world.get_node("%AgencyPair") as CharacterBody2D
	var body_collision := pair.get_node("BodyCollision") as CollisionShape2D
	var world_bounds := world.get_node("WorldBounds") as StaticBody2D
	var query := PhysicsShapeQueryParameters2D.new()
	query.shape = body_collision.shape
	query.transform = body_collision.global_transform
	query.collision_mask = pair.collision_mask
	query.collide_with_areas = false
	query.collide_with_bodies = true
	query.exclude = [pair.get_rid()]
	var collisions: Array[Dictionary] = (
		world.get_world_2d().direct_space_state.intersect_shape(query, 16)
	)
	for collision: Dictionary in collisions:
		assert(
			collision.get("collider") != world_bounds,
			"Arrival for %s overlaps WorldBounds shape %s" % [
				station_id,
				str(collision.get("collider_shape", "unknown")),
			]
		)


func _assert_station_labels_are_unique_and_contextual(world: Node, current_station_name: String) -> void:
	var stations := world.get_node("Stations")
	for station in stations.get_children():
		var labels := station.find_children("*", "Label", true, false)
		assert(labels.size() == 1)
		var visible_label_count := 0
		for label in labels:
			if (label as Label).visible:
				visible_label_count += 1
		assert(visible_label_count == (1 if station.name == current_station_name else 0))

func _assert_pair_has_single_visual_and_collision_set(world: Node) -> void:
	var pair := world.get_node("%AgencyPair") as CharacterBody2D
	assert(pair.find_children("*", "AnimatedSprite2D", true, false).size() == 2)
	assert(pair.find_children("*", "Label", true, false).is_empty())
	assert(pair.find_children("*", "CollisionShape2D", true, false).size() == 2)
	assert(pair.find_children("*", "Area2D", true, false).size() == 1)
	assert(pair.find_children("*", "NavigationAgent2D", true, false).size() == 1)

func _assert_motion_and_ambient_contract(world: Node) -> void:
	var pair := world.get_node("%AgencyPair") as AdMarketAgencyPair
	var ambient := world.get_node("%AgencyAmbientMotion") as Node2D
	var body_collision := pair.get_node("BodyCollision") as CollisionShape2D
	var interaction_area := pair.get_node("InteractionRadius") as Area2D
	var art_director := pair.get_node("%ArtDirectorSprite") as AnimatedSprite2D
	var strategist := pair.get_node("%StrategistSprite") as AnimatedSprite2D
	var expected_sprite_scale := Vector2(0.5, 0.5)
	var expected_sprite_size := Vector2(48.5, 69.0)
	var root_position := Vector2.ZERO
	var body_position := body_collision.position
	var interaction_position := interaction_area.position
	assert(ambient != null)
	assert(art_director.scale.is_equal_approx(expected_sprite_scale))
	assert(strategist.scale.is_equal_approx(expected_sprite_scale))
	# The atlas is authored at twice the rendered size, so what the contract fixes is
	# the on-screen footprint rather than the scale factor on its own.
	for sprite: AnimatedSprite2D in [art_director, strategist]:
		var frame_size := sprite.sprite_frames.get_frame_texture(sprite.animation, 0).get_size()
		assert((frame_size * sprite.scale).is_equal_approx(expected_sprite_size))
	assert(world.direct_travel("copy-room"))
	root_position = pair.position
	world.set_reduced_motion_enabled(false)
	assert(world.direct_travel("strategy-room"))
	assert(pair.position != root_position)
	assert(not pair.call("is_auto_travelling"))
	assert(pair.call("visual_motion_state") == "idle")
	root_position = pair.position
	pair.set_input_enabled(false)
	pair.call("begin_auto_travel", Vector2.RIGHT)
	# The sheet carries a real gait, so the frames have to be running while the pair
	# walks and held on the standing pose whenever it is not.
	assert(art_director.is_playing())
	assert(strategist.is_playing())
	pair.call("_physics_process", 0.016)
	assert(pair.call("visual_motion_state") == "walking")
	assert(pair.facing_direction == "right")
	assert(art_director.rotation > 0.0)
	pair.call("update_auto_travel_direction", Vector2(-59.0, -134.0))
	pair.call("_physics_process", 0.016)
	assert(pair.call("visual_motion_state") == "walking")
	assert(pair.facing_direction == "back")
	assert(art_director.rotation > 0.0)
	pair.call("advance_visual_motion", 0.16)
	assert(pair.position == root_position)
	assert(body_collision.position == body_position)
	assert(interaction_area.position == interaction_position)
	assert(art_director.scale.is_equal_approx(expected_sprite_scale))
	assert(strategist.scale.is_equal_approx(expected_sprite_scale))
	assert(pair.call("sprite_transforms_are_neutral") == false)
	pair.call("end_auto_travel")
	pair.set_input_enabled(true)
	assert(pair.call("visual_motion_state") == "idle")
	assert(not art_director.is_playing())
	assert(not strategist.is_playing())
	assert(not pair.call("is_auto_travelling"))
	ambient.call("advance_ambient_motion", 0.25)
	assert(ambient.call("pulse_amount") > 0.0)
	assert(world.direct_travel("copy-room"))
	assert(not pair.call("is_auto_travelling"))
	world.set_reduced_motion_enabled(true)
	assert(pair.call("visual_motion_state") == "idle")
	assert(not art_director.is_playing())
	assert(not strategist.is_playing())
	assert(not pair.call("is_auto_travelling"))
	assert(pair.input_enabled)
	assert(pair.call("sprite_transforms_are_neutral"))
	assert(art_director.scale.is_equal_approx(expected_sprite_scale))
	assert(strategist.scale.is_equal_approx(expected_sprite_scale))
	assert(ambient.call("pulse_amount") == 0.0)
