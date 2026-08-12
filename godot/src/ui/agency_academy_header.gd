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
		var dot := Label.new()
		dot.custom_minimum_size = Vector2(18, 22)
		dot.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		dot.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		dot.text = "●" if state != "remaining" else "○"
		dot.tooltip_text = "Task %d: %s" % [index + 1, state]
		dot.set_meta("progress_state", state)
		match state:
			"complete":
				dot.add_theme_color_override("font_color", Tokens.SUCCESS)
			"current":
				dot.add_theme_color_override("font_color", Tokens.GOLD)
			_:
				dot.add_theme_color_override("font_color", Color("#A9ADC0"))
		progress_dots.add_child(dot)

func _on_brief_pressed() -> void:
	brief_requested.emit()

func _on_close_pressed() -> void:
	close_requested.emit()
