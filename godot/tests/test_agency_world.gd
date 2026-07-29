extends RefCounted
class_name AdMarketTestAgencyWorld

const WorldScene = preload("res://src/agency/AgencyWorld.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")

func run() -> bool:
	var world := WorldScene.instantiate()
	var progress := AgencyProgress.new()
	assert(progress.begin())
	world.configure(progress)
	assert(world.current_station_id() == "reception")
	_assert_pair_arrives_beside_station(world, "Reception")
	_assert_pair_clears_upper_divider(world, "Reception")
	_assert_station_labels_are_unique_and_contextual(world, "Reception")
	_assert_pair_has_single_visual_and_collision_set(world)
	_assert_role_labels_clear_the_pair(world)
	var strategy_station := world.get_node("Stations/StrategyRoom") as Area2D
	strategy_station.position += Vector2(0.0, -28.0)
	assert(world.direct_travel("strategy-room"))
	assert(world.current_station_id() == "strategy-room")
	_assert_pair_arrives_beside_station(world, "StrategyRoom")
	_assert_pair_clears_upper_divider(world, "StrategyRoom")
	_assert_station_labels_are_unique_and_contextual(world, "StrategyRoom")
	assert(not world.direct_travel("executive-lift"))
	world.set_input_enabled(false)
	assert(not world.get_node("%AgencyPair").get("input_enabled"))
	assert(world.get_node("%GuideButton").focus_mode == Control.FOCUS_ALL)
	assert(world.get_node("%DirectTravel").item_count == 9)
	world.free()
	return true

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
		assert(labels.size() == 2)
		var visible_label_count := 0
		for label in labels:
			if (label as Label).visible:
				visible_label_count += 1
		assert(visible_label_count == (2 if station.name == current_station_name else 0))

func _assert_role_labels_clear_the_pair(world: Node) -> void:
	var pair := world.get_node("%AgencyPair") as CharacterBody2D
	for label in pair.find_children("*", "Label", true, false):
		assert((label as Label).position.y <= -40.0)
		assert((label as Label).position.x >= -20.0)

func _assert_pair_has_single_visual_and_collision_set(world: Node) -> void:
	var pair := world.get_node("%AgencyPair") as CharacterBody2D
	assert(pair.find_children("*", "AnimatedSprite2D", true, false).size() == 2)
	assert(pair.find_children("*", "Label", true, false).size() == 2)
	assert(pair.find_children("*", "CollisionShape2D", true, false).size() == 2)
	assert(pair.find_children("*", "Area2D", true, false).size() == 1)
	assert(pair.find_children("*", "NavigationAgent2D", true, false).size() == 1)
