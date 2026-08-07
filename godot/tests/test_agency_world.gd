extends RefCounted
class_name AdMarketTestAgencyWorld

const WorldScene = preload("res://src/agency/AgencyWorld.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")

func run() -> bool:
	var world := WorldScene.instantiate()
	var progress := AgencyProgress.new()
	assert(progress.begin())
	world.configure(progress)
	world.set_reduced_motion_enabled(true)
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
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
	assert(not guide_panel.visible)
	assert(pair.input_enabled)
	assert(not pair.modal_open)
	_assert_station_card_can_be_tucked(world, progress)
	_assert_station_mission_panel_uses_role_and_modal_state(world, progress)
	_assert_keyboard_handoff_and_guide_shortcuts(world, progress)
	assert(world.direct_travel("reception"))
	assert(world.current_station_id() == "reception")
	_assert_pair_arrives_beside_station(world, "Reception")
	_assert_pair_clears_upper_divider(world, "Reception")
	_assert_station_labels_are_unique_and_contextual(world, "Reception")
	_assert_pair_has_single_visual_and_collision_set(world)
	_assert_world_travel_and_label_contract(world)
	_assert_motion_and_ambient_contract(world)
	var strategy_station := world.get_node("Stations/StrategyRoom") as Area2D
	strategy_station.position += Vector2(0.0, -28.0)
	assert(world.direct_travel("strategy-room"))
	assert(world.current_station_id() == "strategy-room")
	_assert_pair_arrives_beside_station(world, "StrategyRoom")
	_assert_pair_clears_upper_divider(world, "StrategyRoom")
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

func _assert_station_card_can_be_tucked(world: Node, progress: RefCounted) -> void:
	var station_panel := world.get_node("%StationPanel") as Control
	var station_tab := world.get_node("%StationPanelTab") as Button
	var details := world.get_node("%StationResponsibilities") as Label
	var details_toggle := world.get_node("%StationDetailsToggle") as Button
	var tuck := world.get_node("%StationPanelTuck") as Button
	assert(station_panel.visible)
	assert(not station_tab.visible)

	assert(not details.visible)
	assert(details_toggle.text == "Show room details")
	details_toggle.pressed.emit()
	assert(details.visible)
	assert(details_toggle.text == "Hide room details")
	details_toggle.pressed.emit()
	assert(not details.visible)
	var station_before := world.call("current_station_id") as String
	tuck.pressed.emit()
	assert(not station_panel.visible)
	assert(station_tab.visible)
	assert(station_tab.text.contains("Open"))
	assert(world.call("current_station_id") == station_before)
	assert(progress.get("current_station_id") == station_before)
	station_tab.pressed.emit()
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
		assert(pair.position.distance_to(station.position) <= 92.0)
	assert(world.direct_travel("client-briefing"))
	assert(pair.position == Vector2(421.0, 498.0))
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
	var client_station := world.get_node("Stations/ClientBriefing") as Area2D
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

func _assert_mission_panel_is_readable_and_bounded(panel: Control) -> void:
	assert(panel.size == Vector2(1280.0, 800.0))
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
		panel.get_node("%s/TransferStage/TransferPrompt" % content_path) as Label,
		panel.get_node("%s/CompletedStage/CompletedHeading" % content_path) as Label,
	]
	for label in readable_labels:
		assert(_perceived_luminance(label.get_theme_color("font_color")) < 0.45)
	var choice_one := panel.get_node("%s/ChoiceStage/ChoiceGrid/ChoiceOne" % content_path) as Button
	assert(_perceived_luminance(choice_one.get_theme_color("font_focus_color")) < 0.45)

func _perceived_luminance(color: Color) -> float:
	return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722

func _assert_pair_arrives_beside_station(world: Node, station_name: String) -> void:
	var pair := world.get_node("%AgencyPair") as CharacterBody2D
	var station := world.get_node("Stations/%s" % station_name) as Area2D
	var arrival_distance := pair.position.distance_to(station.position)
	assert(is_equal_approx(arrival_distance, 64.0))

func _assert_pair_clears_upper_divider(world: Node, station_name: String) -> void:
	var pair := world.get_node("%AgencyPair") as CharacterBody2D
	var station := world.get_node("Stations/%s" % station_name) as Area2D
	assert(pair.position.y <= station.position.y - 20.0)

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
	assert(pair.call("visual_motion_state") == "walking")
	pair.call("_physics_process", 0.016)
	assert(pair.call("visual_motion_state") == "walking")
	assert(pair.facing_direction == "right")
	assert(art_director.rotation > 0.0)
	world.call("_begin_direct_travel_leg", pair, Vector2(-59.0, -134.0))
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
	world.call("_finish_direct_travel")
	assert(pair.call("visual_motion_state") == "idle")
	assert(not pair.call("is_auto_travelling"))
	ambient.call("advance_ambient_motion", 0.25)
	assert(ambient.call("pulse_amount") > 0.0)
	assert(world.direct_travel("copy-room"))
	assert(pair.call("is_auto_travelling"))
	world.set_reduced_motion_enabled(true)
	assert(pair.call("visual_motion_state") == "idle")
	assert(not pair.call("is_auto_travelling"))
	assert(pair.input_enabled)
	assert(pair.call("sprite_transforms_are_neutral"))
	assert(art_director.scale.is_equal_approx(expected_sprite_scale))
	assert(strategist.scale.is_equal_approx(expected_sprite_scale))
	assert(ambient.call("pulse_amount") == 0.0)
