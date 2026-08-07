extends RefCounted
class_name AdMarketTestAgencyHudLayout

const WorldScene = preload("res://src/agency/AgencyWorld.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")

# The project stretches with aspect "expand", so a window wider or taller than 16:10
# hands the HUD a logical viewport larger than the 1280x800 design size. Anything the
# HUD sizes to 1280x800 therefore leaves bare game showing beside it, which is what a
# full-screen overlay must never do.
const WIDE_WINDOW := Vector2i(1920, 800)
const TALL_WINDOW := Vector2i(1280, 1200)

func run() -> bool:
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	var restore_size := tree.root.size
	var world := WorldScene.instantiate()
	var progress := AgencyProgress.new()
	assert(progress.begin())
	world.configure(progress)
	world.set_reduced_motion_enabled(true)
	tree.root.add_child(world)
	await tree.process_frame
	for window: Vector2i in [WIDE_WINDOW, TALL_WINDOW]:
		tree.root.size = window
		await tree.process_frame
		await tree.process_frame
		var viewport := tree.root.get_visible_rect().size
		# Guard the guard: if the stretch settings ever stop expanding, this suite would
		# pass against a viewport that never exceeds the design size and prove nothing.
		assert(viewport.x > 1280.0 or viewport.y > 800.0)
		_assert_covers_viewport(world, "HUD/HUDRoot", viewport)
		_assert_covers_viewport(
			world,
			"HUD/HUDRoot/AgencyGuideDrawer/OrientationLayer/OrientationScrim",
			viewport
		)
		_assert_covers_viewport(world, "HUD/HUDRoot/AgencyMissionPanel", viewport)
		# The two top bars are inset rather than full-bleed, so they span the viewport
		# less their gutter. Left at the design width they would strand a third of a
		# wide screen as empty floor beside them.
		_assert_spans_width(world, "HUD/HUDRoot/ObjectiveBar", viewport)
		_assert_spans_width(world, "HUD/HUDRoot/AgencyHud", viewport)
	world.queue_free()
	tree.root.size = restore_size
	await tree.process_frame
	return true

const BAR_GUTTER := 16.0

func _assert_spans_width(world: Node, node_path: String, viewport: Vector2) -> void:
	var control := world.get_node_or_null(node_path) as Control
	assert(control != null)
	var rect := control.get_rect()
	assert(is_equal_approx(rect.position.x, BAR_GUTTER))
	assert(is_equal_approx(rect.size.x, viewport.x - BAR_GUTTER * 2.0))

func _assert_covers_viewport(world: Node, node_path: String, viewport: Vector2) -> void:
	var control := world.get_node_or_null(node_path) as Control
	assert(control != null)
	var rect := control.get_rect()
	assert(rect.position.x <= 0.0 and rect.position.y <= 0.0)
	assert(rect.size.x >= viewport.x and rect.size.y >= viewport.y)
