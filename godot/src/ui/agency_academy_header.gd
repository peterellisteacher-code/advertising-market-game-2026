extends PanelContainer
class_name AdMarketAgencyAcademyHeader

signal brief_requested
signal close_requested

const Tokens = preload("res://src/ui/agency_academy_tokens.gd")

@onready var surface_title: Label = %SurfaceTitle
@onready var task_progress_label: Label = %TaskProgressLabel
@onready var term_label: Label = %TermLabel
@onready var progress_dots: HBoxContainer = %ProgressDots
@onready var brief_button: Button = %BriefButton
@onready var close_button: Button = %CloseButton

func _ready() -> void:
	brief_button.pressed.connect(_on_brief_pressed)
	close_button.pressed.connect(_on_close_pressed)

func configure(
	new_surface_title: String,
	subtitle: String,
	completed: int,
	total: int,
	current_index: int
) -> void:
	surface_title.text = new_surface_title
	term_label.text = subtitle
	task_progress_label.text = "Task %d of %d" % [current_index + 1, total]
	_render_progress(Tokens.progress_states(completed, total, current_index))

func _render_progress(states: Array[String]) -> void:
	for child: Node in progress_dots.get_children():
		child.queue_free()
	for index: int in range(states.size()):
		var state: String = states[index]
		var holder := CenterContainer.new()
		holder.custom_minimum_size = Vector2(18, 22)
		holder.tooltip_text = "Task %d: %s" % [index + 1, state]
		holder.set_meta("progress_state", state)
		holder.add_child(_build_progress_dot(state))
		progress_dots.add_child(holder)

## Draws each task marker as a shape rather than a font glyph. The bullet
## characters used before are absent from the exported web font and showed as
## empty boxes. A filled disc marks a done or current task; an outlined ring
## marks one still to come.
func _build_progress_dot(state: String) -> Panel:
	var diameter := 14.0
	var dot := Panel.new()
	dot.custom_minimum_size = Vector2(diameter, diameter)
	dot.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var style := StyleBoxFlat.new()
	style.set_corner_radius_all(int(diameter / 2.0))
	match state:
		"complete":
			style.bg_color = Tokens.SUCCESS
		"current":
			style.bg_color = Tokens.GOLD
		_:
			style.bg_color = Color(0, 0, 0, 0)
			style.border_color = Color("#A9ADC0")
			style.set_border_width_all(2)
	dot.add_theme_stylebox_override("panel", style)
	return dot

func _on_brief_pressed() -> void:
	brief_requested.emit()

func _on_close_pressed() -> void:
	close_requested.emit()
