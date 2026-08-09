extends VBoxContainer
class_name AdMarketColourStage

signal arrangement_submitted(result: Dictionary)

const Measure = preload("res://src/agency/missions/demonstrations/colour_measure.gd")

const HUE_STEP := 30.0
const MIN_SAMPLE_ALPHA := 0.5
# The shipped cream hub/spokes stay below 0.25; the weakest colour ring is 0.35.
const MIN_SAMPLE_STRENGTH := 0.3
const ELEMENT_NODE_PATHS := {
    "panel": "CompositionArea/PosterHitArea/PanelArtwork",
    "headline": "CompositionArea/PosterHitArea/HeadlineArtwork",
    "body": "CompositionArea/PosterHitArea/BodyArtwork",
    "action": "CompositionArea/PosterHitArea/ActionArtwork"
}
const ELEMENT_BUTTON_PATHS := {
    "panel": "ElementButtons/PanelButton",
    "headline": "ElementButtons/HeadlineButton",
    "body": "ElementButtons/BodyButton",
    "action": "ElementButtons/ActionButton"
}

@onready var _instruction: Label = $DemonstrationInstruction
@onready var _client_portrait: TextureRect = $CompositionArea/ClientCard/ClientPortrait
@onready var _client_identity: Label = $CompositionArea/ClientCard/ClientCopy/ClientIdentity
@onready var _client_dialogue: Label = $CompositionArea/ClientCard/ClientCopy/ClientDialogue
@onready var _job_progress: Label = $JobRow/JobProgress
@onready var _brief: Label = $JobRow/BriefLabel
@onready var _selected_label: Label = $JobRow/SelectedLabel
@onready var _wheel: TextureRect = $CompositionArea/ColourWheel
@onready var _product: TextureRect = $CompositionArea/PosterHitArea/ProductArtwork
@onready var _readout: HBoxContainer = $ReadoutRow
@onready var _feedback: Label = $DemonstrationFeedback
@onready var _reset_button: Button = $ActionsRow/ResetButton
@onready var _check_button: Button = $ActionsRow/CheckButton

var _record: Dictionary = {}
var _jobs: Array = []
var _job_index: int = 0
var _elements: Array = []
var _selected_element: String = "panel"
var _completed_results: Array = []
var _wheel_image: Image
var _awaiting_completion_ack: bool = false
var _pending_final_result: Dictionary = {}

func _ready() -> void:
    _wheel.gui_input.connect(_on_wheel_gui_input)
    _reset_button.pressed.connect(reset_arrangement)
    _check_button.pressed.connect(_on_check_pressed)
    for element_id: String in ELEMENT_BUTTON_PATHS:
        var button := get_node(String(ELEMENT_BUTTON_PATHS[element_id])) as Button
        button.pressed.connect(_on_element_selected.bind(element_id))

func configure(record: Dictionary) -> void:
    _record = _expanded_record(record)
    _jobs.clear()
    for value: Variant in Array(_record.get("jobs", [])):
        if typeof(value) == TYPE_DICTIONARY:
            _jobs.append(Dictionary(value).duplicate(true))
    _instruction.text = String(_record.get("instruction", "Select an element, then choose a colour from the wheel."))
    var client_name := String(_record.get("clientName", ""))
    var client_role := String(_record.get("clientRole", ""))
    _client_identity.text = "%s — %s" % [client_name, client_role] if not client_role.is_empty() else client_name
    _client_identity.visible = not _client_identity.text.is_empty()
    _load_record_art()
    _build_readout()
    reset_arrangement()

func reset_arrangement() -> void:
    _job_index = 0
    _completed_results.clear()
    _awaiting_completion_ack = false
    _pending_final_result.clear()
    _check_button.disabled = false
    _check_button.text = "Check palette"
    _set_palette_controls_enabled(true)
    if _jobs.is_empty():
        _elements.clear()
        _job_progress.text = "No palettes available"
        _brief.text = ""
        _feedback.text = "No product briefs were supplied."
        _set_client_dialogue("opening")
        _update_readout(current_result())
        return
    _load_job()

func current_result() -> Dictionary:
    if _jobs.is_empty() or _job_index < 0 or _job_index >= _jobs.size():
        return {
            "checks": {},
            "unmet": PackedStringArray(Measure.CHECKS),
            "elements": [],
            "jobs": _completed_results.duplicate(true),
            "passed": false,
            "reason": "No product brief is available."
        }
    var job := _current_job()
    var measured: Dictionary = Measure.evaluate({
        "elements": _elements.duplicate(true),
        "actionElement": String(_record.get("actionElement", "action")),
        "toneHue": float(job.get("toneHue", 0.0)),
        "minAccentSeparation": float(_record.get("minAccentSeparation", 0.0)),
        "minAccentStrength": float(_record.get("minAccentStrength", 0.0)),
        "minSupportStrength": float(_record.get("minSupportStrength", 0.0)),
        "maxSupportSpread": float(_record.get("maxSupportSpread", Measure.OPPOSITE)),
        "maxToneDistance": float(_record.get("maxToneDistance", Measure.OPPOSITE))
    })
    measured["elements"] = _elements.duplicate(true)
    measured["jobId"] = String(job.get("id", ""))
    measured["product"] = String(job.get("product", ""))
    measured["feeling"] = String(job.get("feeling", ""))
    measured["toneHue"] = float(job.get("toneHue", 0.0))
    measured["jobIndex"] = _job_index
    measured["jobCount"] = _jobs.size()
    measured["selectedElement"] = _selected_element
    measured["jobs"] = _completed_results.duplicate(true)
    measured["reason"] = describe(measured)
    return measured

func focus_target() -> void:
    var target := get_node(String(ELEMENT_BUTTON_PATHS.get(_selected_element, ELEMENT_BUTTON_PATHS["panel"]))) as Control
    target.grab_focus()

func show_error(message: String) -> void:
    _feedback.text = message

func describe(result: Dictionary) -> String:
    var job := _current_job()
    var substitutions := {
        "product": String(job.get("product", "the product")),
        "feeling": String(job.get("feeling", "the intended feeling")),
        "subject": String(_record.get("subjectPhrase", "the product palettes"))
    }
    if bool(result.get("passed", false)):
        var won: Dictionary = _record.get("wonSentences", {})
        return String(won.get("job", "This palette meets the product brief.")).format(substitutions)
    var unmet: PackedStringArray = result.get("unmet", PackedStringArray())
    if unmet.is_empty():
        return "This palette could not be measured."
    var sentences: Dictionary = _record.get("unmetSentences", {})
    return String(sentences.get(unmet[0], "Change one colour, then check the palette again.")).format(substitutions)

func _load_record_art() -> void:
    var portrait_path := String(_record.get("clientPortrait", ""))
    if portrait_path.is_empty():
        _client_portrait.texture = null
    else:
        _assign_texture(_client_portrait, portrait_path, "client portrait")
    _client_portrait.visible = _client_portrait.texture != null
    _assign_texture(_wheel, String(_record.get("wheel", "")), "colour wheel")
    _assign_texture(get_node(String(ELEMENT_NODE_PATHS["panel"])) as TextureRect, String(_record.get("panelArt", "")), "poster panel")
    _assign_texture(get_node(String(ELEMENT_NODE_PATHS["headline"])) as TextureRect, String(_record.get("headlineArt", "")), "headline")
    _assign_texture(get_node(String(ELEMENT_NODE_PATHS["body"])) as TextureRect, String(_record.get("bodyArt", "")), "body copy")
    _assign_texture(get_node(String(ELEMENT_NODE_PATHS["action"])) as TextureRect, String(_record.get("actionArt", "")), "action")
    _wheel_image = _wheel.texture.get_image() if _wheel.texture != null else null

func _assign_texture(node: TextureRect, path: String, description: String) -> void:
    node.texture = load(path) as Texture2D if not path.is_empty() else null
    if node.texture == null:
        push_warning("Colour demonstration could not load the %s texture: %s" % [description, path])

func _load_job() -> void:
    var job := _current_job()
    _elements.clear()
    for value: Variant in Array(job.get("elements", [])):
        if typeof(value) == TYPE_DICTIONARY:
            _elements.append(Dictionary(value).duplicate(true))
    _job_progress.text = "Palette %d of %d" % [_job_index + 1, _jobs.size()]
    var guidance := String(job.get("paletteGuidance", ""))
    _brief.text = "%s — %s" % [String(job.get("product", "Product")), String(job.get("feeling", "feeling"))]
    if not guidance.is_empty():
        _brief.text += " — %s" % guidance
    _assign_texture(_product, String(job.get("productImage", "")), "product")
    _set_client_dialogue("opening" if _completed_results.is_empty() else "next")
    _select_element("panel")
    _apply_palette()
    _refresh_feedback()

func _current_job() -> Dictionary:
    if _jobs.is_empty() or _job_index < 0 or _job_index >= _jobs.size():
        return {}
    return Dictionary(_jobs[_job_index])

func _on_element_selected(element_id: String) -> void:
    if _awaiting_completion_ack:
        return
    _select_element(element_id)

func _select_element(element_id: String) -> void:
    if not ELEMENT_NODE_PATHS.has(element_id):
        return
    _selected_element = element_id
    var labels: Dictionary = _record.get("elementLabels", {})
    _selected_label.text = "Selected: %s" % String(labels.get(element_id, element_id.capitalize()))
    for candidate: String in ELEMENT_BUTTON_PATHS:
        var button := get_node(String(ELEMENT_BUTTON_PATHS[candidate])) as Button
        button.set_pressed_no_signal(candidate == _selected_element)

func _on_wheel_gui_input(event: InputEvent) -> void:
    if _awaiting_completion_ack:
        return
    if not (event is InputEventMouseButton):
        return
    var click := event as InputEventMouseButton
    if click.button_index != MOUSE_BUTTON_LEFT or not click.pressed:
        return
    var sample := _sample_wheel(click.position)
    if sample.is_empty():
        _feedback.text = "Choose a coloured section of the wheel."
        _wheel.accept_event()
        return
    _set_element_colour(_selected_element, float(sample.get("hue", 0.0)), float(sample.get("strength", 0.0)))
    _wheel.accept_event()

func _sample_wheel(local_point: Vector2) -> Dictionary:
    if _wheel_image == null or _wheel_image.is_empty() or _wheel.size.x <= 0.0 or _wheel.size.y <= 0.0:
        return {}
    var source_size := Vector2(_wheel_image.get_size())
    var scale := minf(_wheel.size.x / source_size.x, _wheel.size.y / source_size.y)
    if scale <= 0.0:
        return {}
    var displayed_size := source_size * scale
    var offset := (_wheel.size - displayed_size) * 0.5
    if not Rect2(offset, displayed_size).has_point(local_point):
        return {}
    var source_point := (local_point - offset) / scale
    var pixel := Vector2i(
        clampi(floori(source_point.x), 0, _wheel_image.get_width() - 1),
        clampi(floori(source_point.y), 0, _wheel_image.get_height() - 1)
    )
    var sampled := _wheel_image.get_pixelv(pixel)
    if sampled.a < MIN_SAMPLE_ALPHA or sampled.s < MIN_SAMPLE_STRENGTH:
        return {}
    var hue := wrapf(roundf(sampled.h * 360.0 / HUE_STEP) * HUE_STEP, 0.0, 360.0)
    return {"hue": hue, "strength": sampled.s}

func _set_element_colour(element_id: String, hue: float, strength: float) -> void:
    for index in range(_elements.size()):
        var element := Dictionary(_elements[index])
        if String(element.get("id", "")) != element_id:
            continue
        element["hue"] = wrapf(hue, 0.0, 360.0)
        element["strength"] = clampf(strength, 0.0, 1.0)
        _elements[index] = element
        break
    _apply_palette()
    _refresh_feedback()

func _apply_palette() -> void:
    for value: Variant in _elements:
        var element := Dictionary(value)
        var element_id := String(element.get("id", ""))
        if not ELEMENT_NODE_PATHS.has(element_id):
            continue
        var node := get_node(String(ELEMENT_NODE_PATHS[element_id])) as TextureRect
        node.modulate = Color.from_hsv(
            wrapf(float(element.get("hue", 0.0)), 0.0, 360.0) / 360.0,
            clampf(float(element.get("strength", 0.0)), 0.0, 1.0),
            1.0,
            1.0
        )

func _build_readout() -> void:
    for child: Node in _readout.get_children():
        _readout.remove_child(child)
        child.queue_free()
    var phrases: Dictionary = _record.get("checkPhrases", {})
    for check: String in Measure.CHECKS:
        var column := VBoxContainer.new()
        column.name = "%sColumn" % check
        column.custom_minimum_size = Vector2(0, 58)
        column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
        column.add_theme_constant_override("separation", 2)
        var heading := Label.new()
        heading.text = String(phrases.get(check, check)).to_upper()
        heading.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
        heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
        heading.custom_minimum_size = Vector2(0, 30)
        heading.add_theme_font_size_override("font_size", 11)
        column.add_child(heading)
        var reading := Label.new()
        reading.name = "Reading"
        reading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
        reading.add_theme_font_size_override("font_size", 13)
        column.add_child(reading)
        _readout.add_child(column)

func _refresh_feedback() -> void:
    var result := current_result()
    _update_readout(result)
    _feedback.text = describe(result)

func _update_readout(result: Dictionary) -> void:
    var checks: Dictionary = result.get("checks", {})
    for index in range(mini(_readout.get_child_count(), Measure.CHECKS.size())):
        var check := Measure.CHECKS[index]
        var column := _readout.get_child(index) as VBoxContainer
        var reading := column.get_node("Reading") as Label
        var measured: Dictionary = checks.get(check, {})
        reading.text = _format_reading(check, measured)
        reading.add_theme_color_override(
            "font_color",
            Color("3a7d44") if bool(measured.get("passed", false)) else Color("a64b37")
        )

func _format_reading(check: String, measured: Dictionary) -> String:
    var value := float(measured.get("value", 0.0))
    var required := float(measured.get("required", 0.0))
    var comparison := String(Measure.CHECK_COMPARISON.get(check, ""))
    var relation := "minimum" if comparison == Measure.COMPARE_AT_LEAST else "maximum"
    if check == Measure.CHECK_ACCENT_STRENGTH:
        return "%.2f · %.2f %s" % [value, required, relation]
    return "%.0f° · %.0f° %s" % [value, required, relation]

func _on_check_pressed() -> void:
    if _awaiting_completion_ack:
        _awaiting_completion_ack = false
        _check_button.disabled = true
        var submitted := _pending_final_result.duplicate(true)
        _pending_final_result.clear()
        arrangement_submitted.emit(submitted)
        return
    var result := current_result()
    if not bool(result.get("passed", false)):
        _feedback.text = describe(result)
        return
    _completed_results.append(result.duplicate(true))
    if _job_index + 1 < _jobs.size():
        _job_index += 1
        _load_job()
        return
    var final_result := result.duplicate(true)
    final_result["jobs"] = _completed_results.duplicate(true)
    final_result["evidence"] = _evidence_sentence()
    final_result["reason"] = ""
    var won: Dictionary = _record.get("wonSentences", {})
    _feedback.text = String(won.get("complete", "All product palettes meet their briefs."))
    _set_client_dialogue("complete")
    _pending_final_result = final_result
    _awaiting_completion_ack = true
    _check_button.text = "Finish task"
    _set_palette_controls_enabled(false)
    _check_button.grab_focus()

func _set_palette_controls_enabled(enabled: bool) -> void:
    _wheel.mouse_filter = Control.MOUSE_FILTER_STOP if enabled else Control.MOUSE_FILTER_IGNORE
    _reset_button.disabled = not enabled
    for element_id: String in ELEMENT_BUTTON_PATHS:
        var button := get_node(String(ELEMENT_BUTTON_PATHS[element_id])) as Button
        button.disabled = not enabled

func _evidence_sentence() -> String:
    var sentences: Dictionary = _record.get("evidenceSentences", {})
    return String(sentences.get("colour", "")).format({
        "subject": String(_record.get("subjectPhrase", "the product palettes"))
    })

func _expanded_record(record: Dictionary) -> Dictionary:
    var overlay := record.duplicate(true)
    var base_value: Variant = overlay.get("baseRecord", {})
    overlay.erase("baseRecord")
    if typeof(base_value) != TYPE_DICTIONARY:
        return overlay
    return _merge_dictionaries(Dictionary(base_value), overlay)

func _merge_dictionaries(base: Dictionary, overlay: Dictionary) -> Dictionary:
    var merged := base.duplicate(true)
    for key: Variant in overlay:
        var overlay_value: Variant = overlay[key]
        var base_value: Variant = merged.get(key)
        if typeof(base_value) == TYPE_DICTIONARY and typeof(overlay_value) == TYPE_DICTIONARY:
            merged[key] = _merge_dictionaries(Dictionary(base_value), Dictionary(overlay_value))
        elif typeof(overlay_value) == TYPE_DICTIONARY:
            merged[key] = Dictionary(overlay_value).duplicate(true)
        elif typeof(overlay_value) == TYPE_ARRAY:
            merged[key] = Array(overlay_value).duplicate(true)
        else:
            merged[key] = overlay_value
    return merged

func _set_client_dialogue(phase: String) -> void:
    var dialogue: Dictionary = _record.get("clientDialogue", {})
    var job := _current_job()
    _client_dialogue.text = String(dialogue.get(phase, "")).format({
        "product": String(job.get("product", "the next product")),
        "feeling": String(job.get("feeling", "the intended feeling"))
    })
    _client_dialogue.visible = not _client_dialogue.text.is_empty()
