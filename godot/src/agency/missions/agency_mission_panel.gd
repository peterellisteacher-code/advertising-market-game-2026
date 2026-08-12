extends Control
class_name AdMarketAgencyMissionPanel

signal choice_selected(choice_id: String)
signal demonstration_submitted(result: Dictionary)
signal continue_requested
signal retry_requested
signal next_requested
signal close_requested

const Tokens = preload("res://src/ui/agency_academy_tokens.gd")
const MISSION_THEME := preload("res://src/ui/agency_mission_theme.tres")

const CHOICE_COLOURS: Array[Color] = [
    Color("f8d165"),
    Color("42ccd1"),
    Color("ff7a66"),
    Color("9bd67a")
]
const INK := Color("10243e")
const PAPER := Color("fffaf0")
const FOCUS := Color("ffffff")

@onready var dialog: PanelContainer = $Backdrop/Dialog
@onready var academy_header: AdMarketAgencyAcademyHeader = %AcademyHeader
@onready var mission_badge: Label = $Backdrop/Dialog/Margin/Content/Header/MissionBadge
@onready var close_button: Button = $Backdrop/Dialog/Margin/Content/Header/CloseButton
@onready var title_label: Label = $Backdrop/Dialog/Margin/Content/Title
@onready var goal_label: Label = $Backdrop/Dialog/Margin/Content/Goal
@onready var mission_step: Label = $Backdrop/Dialog/Margin/Content/MissionStep
@onready var instruction_label: Label = $Backdrop/Dialog/Margin/Content/Instruction
@onready var reference_toggle: Button = $Backdrop/Dialog/Margin/Content/ReferenceToggle
@onready var reference_card: PanelContainer = $Backdrop/Dialog/Margin/Content/ReferenceCard
@onready var reference_label: Label = $Backdrop/Dialog/Margin/Content/ReferenceCard/ReferenceLabel
@onready var choice_stage: VBoxContainer = $Backdrop/Dialog/Margin/Content/ChoiceStage
@onready var choice_grid: GridContainer = $Backdrop/Dialog/Margin/Content/ChoiceStage/ChoiceGrid
@onready var choice_buttons: Array[Button] = [
    $Backdrop/Dialog/Margin/Content/ChoiceStage/ChoiceGrid/ChoiceOne,
    $Backdrop/Dialog/Margin/Content/ChoiceStage/ChoiceGrid/ChoiceTwo,
    $Backdrop/Dialog/Margin/Content/ChoiceStage/ChoiceGrid/ChoiceThree,
    $Backdrop/Dialog/Margin/Content/ChoiceStage/ChoiceGrid/ChoiceFour
]
@onready var choice_keyboard_hint: Label = $Backdrop/Dialog/Margin/Content/ChoiceStage/KeyboardHint
@onready var effect_stage: VBoxContainer = $Backdrop/Dialog/Margin/Content/EffectStage
@onready var effect_heading: Label = $Backdrop/Dialog/Margin/Content/EffectStage/EffectHeading
@onready var effect_label: Label = $Backdrop/Dialog/Margin/Content/EffectStage/EffectCard/EffectLabel
@onready var retry_button: Button = $Backdrop/Dialog/Margin/Content/EffectStage/EffectActions/RetryButton
@onready var continue_button: Button = $Backdrop/Dialog/Margin/Content/EffectStage/EffectActions/ContinueButton
@onready var demonstration_stage: VBoxContainer = $Backdrop/Dialog/Margin/Content/DemonstrationStage
@onready var completed_stage: VBoxContainer = $Backdrop/Dialog/Margin/Content/CompletedStage
@onready var completed_heading: Label = $Backdrop/Dialog/Margin/Content/CompletedStage/CompletedHeading
@onready var reward_label: Label = $Backdrop/Dialog/Margin/Content/CompletedStage/RewardCard/RewardLabel
@onready var application_summary: Label = $Backdrop/Dialog/Margin/Content/CompletedStage/ApplicationSummary
@onready var completed_close_button: Button = $Backdrop/Dialog/Margin/Content/CompletedStage/CompletedCloseButton
@onready var feedback_strip: PanelContainer = %FeedbackStrip
@onready var feedback_status: Label = %FeedbackStatus
@onready var action_row: HBoxContainer = %ActionRow
@onready var primary_action: Button = %PrimaryAction

var _record: Dictionary = {}
var _demonstration_view: Control = null
var _demonstration_scene_path: String = ""
var _choice_ids: Array[String] = ["", "", "", ""]
var _reference_visible: bool = true
var _reference_name: String = "task reference"
var _completed_opens_next: bool = false

func _ready() -> void:
    _apply_visual_theme()
    demonstration_stage.theme = MISSION_THEME
    academy_header.close_requested.connect(_request_close)
    academy_header.brief_requested.connect(_toggle_reference)
    close_button.pressed.connect(_request_close)
    retry_button.pressed.connect(_request_retry)
    continue_button.pressed.connect(_request_continue)
    completed_close_button.pressed.connect(_request_completed_action)
    primary_action.pressed.connect(_request_primary_action)
    reference_toggle.pressed.connect(_toggle_reference)
    for index in choice_buttons.size():
        choice_buttons[index].pressed.connect(_select_choice.bind(index))
        _style_choice_button(choice_buttons[index], CHOICE_COLOURS[index])

func show_choice(record: Dictionary, _active_role: String, _allowed: bool) -> void:
    _record = record.duplicate(true)
    _set_common_text()
    _set_reference_text(record)
    mission_step.text = "1. Click one answer"
    instruction_label.text = "Click one answer."
    var choices: Array = record.get("choices", [])
    for index in choice_buttons.size():
        var button := choice_buttons[index]
        if index < choices.size() and typeof(choices[index]) == TYPE_DICTIONARY:
            var choice: Dictionary = choices[index]
            _choice_ids[index] = String(choice.get("id"))
            button.text = "%d  %s" % [index + 1, String(choice.get("label"))]
            button.disabled = false
            button.visible = true
        else:
            _choice_ids[index] = ""
            button.visible = false
    _show_stage(choice_stage)
    _set_reference_visible(true)
    choice_keyboard_hint.text = "Click an answer, or use Tab and Return or number keys 1–4. Esc closes."
    feedback_status.text = "Choose the answer that best supports the audience."
    _configure_primary_action("", "", false)
    visible = true
    _focus_first_choice()

func show_effect(record: Dictionary, evaluation: Dictionary) -> void:
    _record = record.duplicate(true)
    _set_common_text()
    var correct := bool(evaluation.get("correct"))
    mission_step.text = "2. Check what the choice does"
    instruction_label.text = (
        "Read the effect, then select Apply this decision."
        if correct
        else "Read the effect, then select Try another treatment."
    )
    effect_heading.text = "WHY THIS %s" % ("WORKS" if correct else "NEEDS REVISION")
    effect_label.text = String(evaluation.get("effect"))
    feedback_status.text = (
        "Great decision. Read why it works, then apply it."
        if correct
        else "Not quite. Read why, then try another answer."
    )
    retry_button.visible = not correct
    continue_button.visible = correct
    _show_stage(effect_stage)
    _configure_primary_action(
        "Apply this decision" if correct else "Try another answer",
        "continue" if correct else "retry",
        true
    )
    visible = true
    primary_action.call_deferred("grab_focus")

## Mounts the demonstration named by the mission record, keeping this panel
## independent of each engine's working-surface implementation.
func show_demonstration(record: Dictionary) -> void:
    _record = record.duplicate(true)
    _set_common_text()
    var demonstration: Dictionary = _record.get("demonstration", {})
    mission_step.text = "3. Show the decision in the layout"
    feedback_status.text = "Make the layout meet every measure, then use the task check button."
    _configure_primary_action("", "", false)
    _mount_demonstration(demonstration)
    _show_stage(demonstration_stage)
    visible = true
    if is_instance_valid(_demonstration_view) and _demonstration_view.has_method("focus_target"):
        _demonstration_view.call_deferred("focus_target")

func show_demonstration_error(message: String) -> void:
    feedback_status.text = message
    if is_instance_valid(_demonstration_view) and _demonstration_view.has_method("show_error"):
        _demonstration_view.call("show_error", message)

func show_completed(record: Dictionary, result: Dictionary) -> void:
    _record = record.duplicate(true)
    for key in ["taskIndex", "taskTotal"]:
        if result.has(key):
            _record[key] = result.get(key)
    _set_common_text()
    var required := bool(result.get("required", true))
    var task_index := int(result.get("taskIndex", 0))
    var task_total := int(result.get("taskTotal", 0))
    _completed_opens_next = required and bool(result.get("hasNextRequired", false))
    if required:
        mission_step.text = "Task %d of %d complete" % [task_index, task_total]
        instruction_label.text = (
            "Task complete. Continue straight to the next task."
            if _completed_opens_next
            else "All required tasks complete."
        )
        completed_heading.text = "TASK %d OF %d COMPLETE" % [task_index, task_total]
        reward_label.text = "Result saved."
        application_summary.visible = false
        completed_close_button.text = "Next task" if _completed_opens_next else "Finish required tasks"
        feedback_status.text = (
            "Task complete. Your decision is saved."
            if _completed_opens_next
            else "All seven required advertising decisions are complete."
        )
    else:
        mission_step.text = "Optional practice complete"
        instruction_label.text = "Review the result, then return to the agency."
        completed_heading.text = "OPTIONAL PRACTICE COMPLETE"
        reward_label.text = "PORTFOLIO STAMP: %s\nPRESENTATION FLOURISH: %s" % [
            String(result.get("portfolioStamp")),
            String(result.get("presentationFlourish")).capitalize()
        ]
        application_summary.text = String(result.get("applicationObjective"))
        application_summary.visible = true
        completed_close_button.text = "Return to agency"
        feedback_status.text = "Optional practice complete. Your result is saved."
    _show_stage(completed_stage)
    _configure_primary_action(completed_close_button.text, "completed", true)
    visible = true
    primary_action.call_deferred("grab_focus")

func close_panel() -> void:
    visible = false
    _record = {}

func _set_common_text() -> void:
    var required := bool(_record.get("required", true))
    var badge_kind := "OPTIONAL PRACTICE" if not required else "AGENCY TASK"
    var task_index := int(_record.get("taskIndex", 0))
    var task_total := int(_record.get("taskTotal", 0))
    if required and task_index > 0 and task_total > 0:
        badge_kind = "TASK %d OF %d" % [task_index, task_total]
    var term := String(_record.get("term", "")).strip_edges()
    mission_badge.text = badge_kind if term.is_empty() else "%s · %s" % [badge_kind, term]
    title_label.text = String(_record.get("title"))
    goal_label.text = String(_record.get("goal"))
    var header_index := maxi(task_index - 1, 0)
    var header_total := maxi(task_total, 1)
    var completed_count := clampi(header_index, 0, header_total)
    academy_header.configure(
        String(_record.get("title", "Agency task")),
        term if not term.is_empty() else "Advertising decision",
        completed_count,
        header_total,
        clampi(header_index, 0, header_total - 1)
    )

func _mount_demonstration(demonstration: Dictionary) -> void:
    var scene_path := String(demonstration.get("scene", ""))
    if scene_path.is_empty():
        return
    if scene_path != _demonstration_scene_path or not is_instance_valid(_demonstration_view):
        for child in demonstration_stage.get_children():
            child.queue_free()
        var scene := load(scene_path) as PackedScene
        if scene == null:
            return
        _demonstration_view = scene.instantiate() as Control
        _demonstration_scene_path = scene_path
        demonstration_stage.add_child(_demonstration_view)
        _style_demonstration_view(_demonstration_view)
        if _demonstration_view.has_signal("arrangement_submitted"):
            _demonstration_view.connect("arrangement_submitted", _submit_demonstration)
    if _demonstration_view.has_method("configure"):
        _demonstration_view.call("configure", demonstration)

func _style_demonstration_view(view: Control) -> void:
    view.theme = MISSION_THEME
    for node: Node in view.find_children("*", "PanelContainer", true, false):
        var panel := node as PanelContainer
        if panel != null:
            panel.theme_type_variation = &"WorkSurface"
    var check_button := view.find_child("CheckButton", true, false) as Button
    if check_button != null:
        check_button.theme_type_variation = &"PrimaryAction"
        check_button.custom_minimum_size.x = maxf(check_button.custom_minimum_size.x, 220.0)
        check_button.custom_minimum_size.y = maxf(check_button.custom_minimum_size.y, 44.0)
    var reset_button := view.find_child("ResetButton", true, false) as Button
    if reset_button != null:
        reset_button.custom_minimum_size.x = maxf(reset_button.custom_minimum_size.x, 170.0)
        reset_button.custom_minimum_size.y = maxf(reset_button.custom_minimum_size.y, 44.0)

func _submit_demonstration(result: Dictionary) -> void:
    demonstration_submitted.emit(result)

func _show_stage(active_stage: Control) -> void:
    choice_stage.visible = active_stage == choice_stage
    effect_stage.visible = active_stage == effect_stage
    demonstration_stage.visible = active_stage == demonstration_stage
    completed_stage.visible = active_stage == completed_stage
    # The demonstration is a working surface rather than something to read, so the
    # framing that set the choice up is dropped and the layout gets the height instead.
    var showing_demonstration := active_stage == demonstration_stage
    title_label.visible = not showing_demonstration
    goal_label.visible = not showing_demonstration
    instruction_label.visible = not showing_demonstration
    var showing_choice := active_stage == choice_stage
    reference_toggle.visible = showing_choice and not reference_label.text.is_empty()
    reference_card.visible = showing_choice and _reference_visible and not reference_label.text.is_empty()
    feedback_strip.visible = not showing_demonstration
    action_row.visible = false

func _set_reference_text(record: Dictionary) -> void:
    var facts_value: Variant = record.get("referenceFacts", {})
    _reference_name = "audience brief" if record.has("referenceFacts") else "task reference"
    var lines: Array[String] = []
    if typeof(facts_value) == TYPE_DICTIONARY:
        var facts: Dictionary = facts_value
        for entry: Dictionary in [
            {"key": "context", "label": "CONTEXT"},
            {"key": "need", "label": "NEED"},
            {"key": "values", "label": "VALUES"},
            {"key": "intendedResponse", "label": "INTENDED RESPONSE"},
        ]:
            var value := String(facts.get(String(entry.get("key")), ""))
            if not value.is_empty():
                lines.append("%s: %s" % [String(entry.get("label")), value])
    elif typeof(facts_value) == TYPE_ARRAY:
        for fact_value: Variant in facts_value:
            if typeof(fact_value) != TYPE_DICTIONARY:
                continue
            var fact: Dictionary = fact_value
            var label := String(fact.get("label", "FACT"))
            var text := String(fact.get("text", ""))
            if not text.is_empty():
                lines.append("%s: %s" % [label, text])
    if lines.is_empty():
        lines.append(String(record.get("instruction", record.get("goal", "Check the task goal."))))
    reference_label.text = "\n".join(lines)

func _set_reference_visible(is_visible: bool) -> void:
    _reference_visible = is_visible
    reference_card.visible = is_visible and choice_stage.visible and not reference_label.text.is_empty()
    if _reference_name == "audience brief":
        reference_toggle.text = "Hide audience brief" if is_visible else "Show audience brief"
    else:
        reference_toggle.text = "Hide task reference" if is_visible else "Show task reference"

func _select_choice(index: int) -> void:
    if index < 0 or index >= _choice_ids.size():
        return
    var choice_id := _choice_ids[index]
    if not choice_id.is_empty() and not choice_buttons[index].disabled:
        choice_selected.emit(choice_id)

func _request_continue() -> void:
    continue_requested.emit()

func _request_retry() -> void:
    retry_requested.emit()

func _configure_primary_action(label: String, action: String, is_visible: bool) -> void:
    primary_action.text = label
    primary_action.set_meta("mission_action", action)
    action_row.visible = is_visible

func _request_primary_action() -> void:
    match String(primary_action.get_meta("mission_action", "")):
        "retry":
            _request_retry()
        "continue":
            _request_continue()
        "completed":
            _request_completed_action()

func layout_contract(viewport: Vector2) -> Dictionary:
    var safe_viewport := Vector2(maxf(viewport.x, 1.0), maxf(viewport.y, 1.0))
    var header_height := clampf(safe_viewport.y * 0.14, 96.0, 118.0)
    var action_height := 58.0
    var feedback_height := 52.0
    var inset := clampf(safe_viewport.x * 0.03, 24.0, 52.0)
    var header_rect := Rect2(Vector2(inset, inset), Vector2(safe_viewport.x - inset * 2.0, header_height))
    var action_rect := Rect2(
        Vector2(inset, safe_viewport.y - inset - action_height),
        Vector2(safe_viewport.x - inset * 2.0, action_height)
    )
    var feedback_rect := Rect2(
        Vector2(inset, action_rect.position.y - 8.0 - feedback_height),
        Vector2(safe_viewport.x - inset * 2.0, feedback_height)
    )
    var work_rect := Rect2(
        Vector2(inset, header_rect.end.y + 8.0),
        Vector2(safe_viewport.x - inset * 2.0, feedback_rect.position.y - header_rect.end.y - 16.0)
    )
    var bounds := Rect2(Vector2.ZERO, safe_viewport)
    return {
        "header": header_rect,
        "work": work_rect,
        "feedback": feedback_rect,
        "action": action_rect,
        "withinViewport": (
            bounds.encloses(header_rect)
            and bounds.encloses(work_rect)
            and bounds.encloses(feedback_rect)
            and bounds.encloses(action_rect)
        ),
        "singleInputOwner": mouse_filter == Control.MOUSE_FILTER_STOP,
    }

func _request_completed_action() -> void:
    if _completed_opens_next:
        next_requested.emit()
    else:
        close_requested.emit()

func _toggle_reference() -> void:
    _set_reference_visible(not _reference_visible)

func _request_close() -> void:
    close_requested.emit()

func _apply_visual_theme() -> void:
    var margin: MarginContainer = $Backdrop/Dialog/Margin
    var content: VBoxContainer = $Backdrop/Dialog/Margin/Content
    margin.add_theme_constant_override("margin_left", 32)
    margin.add_theme_constant_override("margin_top", 26)
    margin.add_theme_constant_override("margin_right", 32)
    margin.add_theme_constant_override("margin_bottom", 26)
    content.add_theme_constant_override("separation", 10)
    choice_grid.add_theme_constant_override("h_separation", 12)
    choice_grid.add_theme_constant_override("v_separation", 12)
    dialog.add_theme_color_override("font_color", INK)
    mission_badge.add_theme_font_size_override("font_size", 16)
    mission_badge.add_theme_color_override("font_color", Color("0087a8"))
    title_label.add_theme_font_size_override("font_size", 30)
    goal_label.add_theme_font_size_override("font_size", 18)
    mission_step.add_theme_font_size_override("font_size", 15)
    reference_label.add_theme_font_size_override("font_size", 15)
    instruction_label.add_theme_font_size_override("font_size", 17)
    choice_keyboard_hint.add_theme_font_size_override("font_size", 14)
    effect_heading.add_theme_font_size_override("font_size", 24)
    effect_heading.add_theme_color_override("font_color", INK)
    effect_label.add_theme_font_size_override("font_size", 22)
    completed_heading.add_theme_font_size_override("font_size", 28)
    completed_heading.add_theme_color_override("font_color", Color("00785c"))
    reward_label.add_theme_font_size_override("font_size", 24)
    application_summary.add_theme_font_size_override("font_size", 18)
    for button in [close_button, reference_toggle, retry_button, continue_button, completed_close_button, primary_action]:
        button.add_theme_font_size_override("font_size", 16)

func _focus_first_choice() -> void:
    for button in choice_buttons:
        if button.visible and not button.disabled:
            button.call_deferred("grab_focus")
            return

func _style_choice_button(button: Button, colour: Color) -> void:
    var normal := StyleBoxFlat.new()
    normal.bg_color = colour
    normal.border_color = INK
    normal.set_border_width_all(3)
    normal.corner_radius_top_left = 10
    normal.corner_radius_top_right = 10
    normal.corner_radius_bottom_left = 10
    normal.corner_radius_bottom_right = 10
    normal.content_margin_left = 18.0
    normal.content_margin_right = 18.0
    normal.content_margin_top = 16.0
    normal.content_margin_bottom = 16.0
    var hover := normal.duplicate() as StyleBoxFlat
    hover.bg_color = colour.lightened(0.12)
    hover.set_border_width_all(4)
    var pressed := normal.duplicate() as StyleBoxFlat
    pressed.bg_color = colour.darkened(0.08)
    # The answer swatches keep their own colour identity while they can be clicked, but
    # they take the shared theme's grey the moment they cannot: grey means unclickable,
    # and nothing else in this panel is grey.
    var disabled: StyleBoxFlat = normal.duplicate() as StyleBoxFlat
    var theme_disabled := get_theme_stylebox("disabled", "Button") as StyleBoxFlat
    disabled.bg_color = theme_disabled.bg_color if theme_disabled != null else PAPER
    disabled.border_color = theme_disabled.border_color if theme_disabled != null else INK
    disabled.set_border_width_all(2)
    var focus := normal.duplicate() as StyleBoxFlat
    focus.border_color = FOCUS
    focus.set_border_width_all(6)
    button.add_theme_stylebox_override("normal", normal)
    button.add_theme_stylebox_override("hover", hover)
    button.add_theme_stylebox_override("pressed", pressed)
    button.add_theme_stylebox_override("disabled", disabled)
    button.add_theme_stylebox_override("focus", focus)
    button.add_theme_color_override("font_color", INK)
    button.add_theme_color_override("font_hover_color", INK)
    button.add_theme_color_override("font_pressed_color", INK)
    button.add_theme_color_override("font_focus_color", INK)
    button.add_theme_color_override("font_disabled_color", get_theme_color("font_disabled_color", "Button"))

func _unhandled_key_input(event: InputEvent) -> void:
    if not visible or not event.is_pressed() or event.is_echo():
        return
    var key_event := event as InputEventKey
    if key_event == null:
        return
    if key_event.keycode == KEY_ESCAPE:
        close_requested.emit()
        get_viewport().set_input_as_handled()
        return
    if not choice_stage.visible:
        return
    var choice_index := _choice_index_for_key(key_event.keycode)
    if choice_index >= 0:
        _select_choice(choice_index)
        get_viewport().set_input_as_handled()

func _choice_index_for_key(keycode: Key) -> int:
    match keycode:
        KEY_1, KEY_KP_1:
            return 0
        KEY_2, KEY_KP_2:
            return 1
        KEY_3, KEY_KP_3:
            return 2
        KEY_4, KEY_KP_4:
            return 3
    return -1
