extends Control
class_name AdMarketAgencyMissionPanel

signal choice_selected(choice_id: String)
signal evidence_submitted(text: String)
signal continue_requested
signal retry_requested
signal close_requested
signal role_handoff_requested(role: String)

const CHOICE_COLOURS: Array[Color] = [
    Color("f8d165"),
    Color("42ccd1"),
    Color("ff7a66"),
    Color("9bd67a")
]
const INK := Color("10243e")
const PAPER := Color("fffaf0")
const FOCUS := Color("ffffff")
const MAX_EVIDENCE_LENGTH := 400
const ROLE_DEFINITION := "Both partners use the same controls. Strategist decides audience, purpose, product and message. Art Director decides visual design and execution."

@onready var dialog: PanelContainer = $Backdrop/Dialog
@onready var mission_badge: Label = $Backdrop/Dialog/Margin/Content/Header/MissionBadge
@onready var close_button: Button = $Backdrop/Dialog/Margin/Content/Header/CloseButton
@onready var title_label: Label = $Backdrop/Dialog/Margin/Content/Title
@onready var goal_label: Label = $Backdrop/Dialog/Margin/Content/Goal
@onready var owner_label: Label = $Backdrop/Dialog/Margin/Content/OwnerCard/OwnerLabel
@onready var role_definition_label: Label = $Backdrop/Dialog/Margin/Content/OwnerCard/RoleDefinitionLabel
@onready var holding_label: Label = $Backdrop/Dialog/Margin/Content/OwnerCard/HoldingLabel
@onready var mission_step: Label = $Backdrop/Dialog/Margin/Content/MissionStep
@onready var role_details_toggle: Button = $Backdrop/Dialog/Margin/Content/OwnerCard/RoleDetailsToggle
@onready var role_handoff_button: Button = $Backdrop/Dialog/Margin/Content/RoleHandoffButton
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
@onready var transfer_stage: VBoxContainer = $Backdrop/Dialog/Margin/Content/TransferStage
@onready var transfer_prompt: Label = $Backdrop/Dialog/Margin/Content/TransferStage/TransferPrompt
@onready var application_objective: Label = $Backdrop/Dialog/Margin/Content/TransferStage/ApplicationObjective
@onready var evidence_edit: TextEdit = $Backdrop/Dialog/Margin/Content/TransferStage/EvidenceEdit
@onready var evidence_count: Label = $Backdrop/Dialog/Margin/Content/TransferStage/EvidenceFooter/EvidenceCount
@onready var validation_label: Label = $Backdrop/Dialog/Margin/Content/TransferStage/ValidationLabel
@onready var submit_button: Button = $Backdrop/Dialog/Margin/Content/TransferStage/SubmitButton
@onready var completed_stage: VBoxContainer = $Backdrop/Dialog/Margin/Content/CompletedStage
@onready var completed_heading: Label = $Backdrop/Dialog/Margin/Content/CompletedStage/CompletedHeading
@onready var reward_label: Label = $Backdrop/Dialog/Margin/Content/CompletedStage/RewardCard/RewardLabel
@onready var application_summary: Label = $Backdrop/Dialog/Margin/Content/CompletedStage/ApplicationSummary
@onready var completed_close_button: Button = $Backdrop/Dialog/Margin/Content/CompletedStage/CompletedCloseButton

var _record: Dictionary = {}
var _choice_ids: Array[String] = ["", "", "", ""]
var _role_details_visible: bool = false
var _reference_visible: bool = true
var _reference_name: String = "task reference"

func _ready() -> void:
    _apply_visual_theme()
    close_button.pressed.connect(_request_close)
    retry_button.pressed.connect(_request_retry)
    continue_button.pressed.connect(_request_continue)
    submit_button.pressed.connect(_submit_evidence)
    completed_close_button.pressed.connect(_request_close)
    role_details_toggle.pressed.connect(_toggle_role_details)
    role_handoff_button.pressed.connect(_request_role_handoff)
    reference_toggle.pressed.connect(_toggle_reference)
    evidence_edit.text_changed.connect(_update_evidence_count)
    for index in choice_buttons.size():
        choice_buttons[index].pressed.connect(_select_choice.bind(index))
        _style_choice_button(choice_buttons[index], CHOICE_COLOURS[index])
    _update_evidence_count()

func show_choice(record: Dictionary, active_role: String, allowed: bool) -> void:
    _record = record.duplicate(true)
    _set_common_text()
    _set_reference_text(record)
    var owner_role := String(record.get("ownerRole"))
    var owner_name := _role_name(owner_role)
    mission_step.text = "1. Click one answer" if allowed else "1. Make %s active" % owner_name
    owner_label.text = "%s leads this choice." % owner_name
    role_definition_label.text = ROLE_DEFINITION
    holding_label.text = "Partner job: %s" % String(record.get("holdingAction"))
    instruction_label.text = (
        "Click one answer."
        if allowed
        else "Make the %s active to answer this question." % owner_name
    )
    var choices: Array = record.get("choices", [])
    for index in choice_buttons.size():
        var button := choice_buttons[index]
        if index < choices.size() and typeof(choices[index]) == TYPE_DICTIONARY:
            var choice: Dictionary = choices[index]
            _choice_ids[index] = String(choice.get("id"))
            button.text = "%d  %s" % [index + 1, String(choice.get("label"))]
            button.disabled = not allowed
            button.visible = true
        else:
            _choice_ids[index] = ""
            button.visible = false
    _show_stage(choice_stage)
    _set_reference_visible(true)
    choice_stage.visible = allowed
    if not allowed:
        reference_toggle.visible = false
        reference_card.visible = false
    role_handoff_button.visible = not allowed
    role_handoff_button.text = "Make %s active" % owner_name
    choice_keyboard_hint.text = "Click an answer, or use Tab and Return or number keys 1–4. Esc closes."
    visible = true
    if allowed:
        _focus_first_choice()
    else:
        role_handoff_button.call_deferred("grab_focus")

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
    effect_heading.text = "EFFECT EXPLANATION — %s" % ("EFFECTIVE" if correct else "TRY AGAIN")
    effect_label.text = String(evaluation.get("effect"))
    retry_button.visible = not correct
    continue_button.visible = correct
    _show_stage(effect_stage)
    visible = true
    if correct:
        continue_button.call_deferred("grab_focus")
    else:
        retry_button.call_deferred("grab_focus")

func show_transfer(record: Dictionary, objective_text: String) -> void:
    _record = record.duplicate(true)
    _set_common_text()
    mission_step.text = "3. Explain how you will use it"
    transfer_prompt.text = String(record.get("transferPrompt"))
    application_objective.text = objective_text
    instruction_label.text = (
        "Write one specific sentence that names the audience, the technique and what you will change."
    )
    evidence_edit.text = ""
    validation_label.text = "Write 30–400 characters. Name the audience and the technique or design change."
    _show_stage(transfer_stage)
    visible = true
    _update_evidence_count()
    evidence_edit.call_deferred("grab_focus")

func show_completed(record: Dictionary, result: Dictionary) -> void:
    _record = record.duplicate(true)
    _set_common_text()
    mission_step.text = "Complete"
    var required := bool(result.get("required", true))
    instruction_label.text = "Review the result, then return to the agency."
    completed_heading.text = "TASK COMPLETE" if required else "OPTIONAL PRACTICE COMPLETE"
    if required:
        reward_label.text = "REWARD: %s" % String(result.get("reward"))
    else:
        reward_label.text = "PORTFOLIO STAMP: %s\nPRESENTATION FLOURISH: %s" % [
            String(result.get("portfolioStamp")),
            String(result.get("presentationFlourish")).capitalize()
        ]
    application_summary.text = String(result.get("applicationObjective"))
    _show_stage(completed_stage)
    visible = true
    completed_close_button.call_deferred("grab_focus")

func show_validation_error(message: String) -> void:
    validation_label.text = message
    evidence_edit.call_deferred("grab_focus")

func show_handoff_error() -> void:
    mission_step.text = "1. Hand control over again"
    instruction_label.text = "Control did not change. Select the handover button again."
    role_handoff_button.call_deferred("grab_focus")

func close_panel() -> void:
    visible = false
    _record = {}
    evidence_edit.text = ""
    validation_label.text = ""

func _set_common_text() -> void:
    mission_badge.text = "OPTIONAL PRACTICE" if not bool(_record.get("required", true)) else "AGENCY TASK"
    title_label.text = String(_record.get("title"))
    goal_label.text = String(_record.get("goal"))

func _show_stage(active_stage: Control) -> void:
    choice_stage.visible = active_stage == choice_stage
    effect_stage.visible = active_stage == effect_stage
    transfer_stage.visible = active_stage == transfer_stage
    completed_stage.visible = active_stage == completed_stage
    var showing_choice := active_stage == choice_stage
    reference_toggle.visible = showing_choice and not reference_label.text.is_empty()
    reference_card.visible = showing_choice and _reference_visible and not reference_label.text.is_empty()
    role_details_toggle.visible = active_stage == choice_stage
    role_handoff_button.visible = false
    _set_role_details_visible(false)

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

func _set_role_details_visible(is_visible: bool) -> void:
    _role_details_visible = is_visible
    role_definition_label.visible = is_visible
    holding_label.visible = is_visible
    role_details_toggle.text = "Hide pair roles" if is_visible else "Show pair roles"

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

func _submit_evidence() -> void:
    evidence_submitted.emit(evidence_edit.text)

func _request_continue() -> void:
    continue_requested.emit()

func _request_retry() -> void:
    retry_requested.emit()

func _toggle_role_details() -> void:
    _set_role_details_visible(not _role_details_visible)

func _toggle_reference() -> void:
    _set_reference_visible(not _reference_visible)

func _request_role_handoff() -> void:
    role_handoff_requested.emit(String(_record.get("ownerRole", "strategist")))

func _request_close() -> void:
    close_requested.emit()

func _update_evidence_count() -> void:
    if evidence_edit.text.length() > MAX_EVIDENCE_LENGTH:
        evidence_edit.text = evidence_edit.text.left(MAX_EVIDENCE_LENGTH)
        evidence_edit.set_caret_line(evidence_edit.get_line_count() - 1)
        evidence_edit.set_caret_column(evidence_edit.get_line(evidence_edit.get_line_count() - 1).length())
    evidence_count.text = "%d / %d characters" % [evidence_edit.text.length(), MAX_EVIDENCE_LENGTH]

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
    owner_label.add_theme_font_size_override("font_size", 16)
    owner_label.add_theme_color_override("font_color", Color("007a92"))
    role_definition_label.add_theme_font_size_override("font_size", 15)
    reference_label.add_theme_font_size_override("font_size", 15)
    holding_label.add_theme_font_size_override("font_size", 15)
    instruction_label.add_theme_font_size_override("font_size", 17)
    choice_keyboard_hint.add_theme_font_size_override("font_size", 14)
    effect_heading.add_theme_font_size_override("font_size", 24)
    effect_label.add_theme_font_size_override("font_size", 22)
    transfer_prompt.add_theme_font_size_override("font_size", 21)
    application_objective.add_theme_font_size_override("font_size", 16)
    evidence_edit.add_theme_font_size_override("font_size", 17)
    validation_label.add_theme_color_override("font_color", Color("b62d1f"))
    completed_heading.add_theme_font_size_override("font_size", 28)
    completed_heading.add_theme_color_override("font_color", Color("00785c"))
    reward_label.add_theme_font_size_override("font_size", 24)
    application_summary.add_theme_font_size_override("font_size", 18)
    for button in [close_button, role_details_toggle, role_handoff_button, reference_toggle, retry_button, continue_button, submit_button, completed_close_button]:
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
    var disabled: StyleBoxFlat = normal.duplicate() as StyleBoxFlat
    disabled.bg_color = colour.lerp(PAPER, 0.55)
    disabled.border_color = INK.lightened(0.3)
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
    button.add_theme_color_override("font_disabled_color", INK.lightened(0.12))

func _role_name(role_id: String) -> String:
    if role_id == "art-director":
        return "Art Director"
    if role_id == "strategist":
        return "Strategist"
    return "Partner"

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
