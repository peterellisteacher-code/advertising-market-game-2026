extends RefCounted
class_name AdMarketTestAgencyButtonTheme

# The project carried no Theme resource, so every button that did not define a
# StyleBoxFlat inline fell through to Godot's default grey slab — including the mission
# panel's action buttons. The rule for the shared theme that replaced it is that grey
# means unclickable, and only that.

const THEME_PATH := "res://src/agency/ui/agency_theme.tres"
const MissionPanelScene = preload("res://src/agency/missions/AgencyMissionPanel.tscn")
const GuideDrawerScene = preload("res://src/agency/ui/AgencyGuideDrawer.tscn")
const HudScene = preload("res://src/agency/ui/AgencyHud.tscn")
const WorldScene = preload("res://src/agency/AgencyWorld.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")

const DISABLED_FILL := Color(0.78, 0.78, 0.78, 1)
const DISABLED_TEXT := Color(0.42, 0.42, 0.42, 1)
const TEAL := Color(0, 0.48, 0.62, 1)
const CREAM := Color(0.98, 0.965, 0.91, 1)

# The three buttons in AgencyWorld.tscn that sit outside the themed scenes and carried
# no inline style of their own. Every other button there already defines all four states.
const WORLD_BUTTON_PATHS: Array[String] = [
	"HUD/HUDRoot/StationPanel/StationMargin/StationContent/StationHeader/StationDetailsToggle",
	"HUD/HUDRoot/StationPanel/StationMargin/StationContent/StationHeader/StationPanelTuck",
	"HUD/HUDRoot/StationPanelTab"
]

func run() -> bool:
	_assert_theme_resource()
	var tree := Engine.get_main_loop() as SceneTree
	assert(tree != null)
	for scene: PackedScene in [MissionPanelScene, GuideDrawerScene, HudScene]:
		var root := scene.instantiate() as Control
		assert(root != null)
		assert(root.theme != null and root.theme.resource_path == THEME_PATH)
		# In the tree so _ready() runs: the mission panel styles its four answer
		# swatches in code, and that path has to obey the same rule as the theme.
		tree.root.add_child(root)
		_assert_subtree(root)
		tree.root.remove_child(root)
		root.free()
	var world := WorldScene.instantiate()
	var progress := AgencyProgress.new()
	assert(progress.begin())
	world.configure(progress)
	world.set_reduced_motion_enabled(true)
	tree.root.add_child(world)
	for path: String in WORLD_BUTTON_PATHS:
		var button := world.get_node_or_null(path) as Button
		assert(button != null)
		_assert_button(button)
	world.queue_free()
	return true

func _assert_theme_resource() -> void:
	var theme := load(THEME_PATH) as Theme
	assert(theme != null)
	assert(theme.get_type_variation_base("PrimaryAction") == &"Button")
	# Secondary is cream with a teal border; primary is filled teal.
	assert(_fill(theme, "normal", "Button").is_equal_approx(CREAM))
	assert(_fill(theme, "normal", "PrimaryAction").is_equal_approx(TEAL))
	for type_name: String in ["Button", "OptionButton", "PrimaryAction"]:
		assert(_fill(theme, "disabled", type_name).is_equal_approx(DISABLED_FILL))
		assert(theme.get_color("font_disabled_color", type_name).is_equal_approx(DISABLED_TEXT))
		for state: String in ["normal", "hover", "pressed"]:
			assert(not _is_grey(_fill(theme, state, type_name)))

func _fill(theme: Theme, state: String, type_name: String) -> Color:
	var box := theme.get_stylebox(state, type_name) as StyleBoxFlat
	assert(box != null)
	return box.bg_color

func _assert_subtree(node: Node) -> void:
	var button := node as Button
	if button != null:
		_assert_button(button)
	for child: Node in node.get_children():
		_assert_subtree(child)

func _assert_button(button: Button) -> void:
	var normal := button.get_theme_stylebox("normal") as StyleBoxFlat
	assert(normal != null)
	if button is CheckButton:
		# A switch draws no slab, so its unclickable state is carried by the label.
		assert(normal.bg_color.a == 0.0)
		assert(button.get_theme_color("font_disabled_color").is_equal_approx(DISABLED_TEXT))
		return
	# Nothing clickable is grey.
	assert(not _is_grey(normal.bg_color))
	var hover := button.get_theme_stylebox("hover") as StyleBoxFlat
	assert(hover != null and not _is_grey(hover.bg_color))
	# Everything unclickable is.
	var disabled := button.get_theme_stylebox("disabled") as StyleBoxFlat
	assert(disabled != null and disabled.bg_color.is_equal_approx(DISABLED_FILL))
	assert(button.get_theme_color("font_disabled_color").is_equal_approx(DISABLED_TEXT))

func _is_grey(colour: Color) -> bool:
	if is_zero_approx(colour.a):
		return false
	return absf(colour.r - colour.g) < 0.02 and absf(colour.g - colour.b) < 0.02
