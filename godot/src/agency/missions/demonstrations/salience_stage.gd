extends VBoxContainer
class_name AdMarketSalienceStage

# Engine A — arrange for salience. Objects with real alpha sit over a background plate.
# The pair moves, resizes and recolours them; the three levers are measured live and the
# arrangement is accepted when the named target leads any one of them.
#
# The objects are built from the record rather than authored into the scene, because the
# same engine serves more than one task with a different set of objects each time.

signal arrangement_submitted(result: Dictionary)

const Measure = preload("res://src/agency/missions/demonstrations/salience_measure.gd")

const PLATE_GRID_COLS := 24
const PLATE_GRID_ROWS := 12
const NUDGE_STEP := 8.0
const COARSE_NUDGE_STEP := 32.0
const SELECTION_INSET := 6.0
const FOCUS_RING := Color(0.965, 0.72, 0.21, 1)
const INK := Color(0.04, 0.14, 0.25, 1)

@onready var instruction_label: Label = %DemonstrationInstruction
@onready var plate_viewport: Control = %PlateViewport
@onready var stage: Control = %Stage
@onready var plate: TextureRect = %Plate
@onready var objects_root: Control = %Objects
@onready var selection_ring: Panel = %SelectionRing
@onready var selected_label: Label = %SelectedLabel
@onready var size_slider: HSlider = %SizeSlider
@onready var swatch_row: HBoxContainer = %SwatchRow
@onready var feedback_label: Label = %DemonstrationFeedback
@onready var reset_button: Button = %ResetButton
@onready var check_button: Button = %CheckButton
@onready var lever_bars: Dictionary = {
    Measure.LEVER_SIZE: %SizeLeverBar,
    Measure.LEVER_ISOLATION: %IsolationLeverBar,
    Measure.LEVER_CONTRAST: %ContrastLeverBar
}
@onready var lever_leaders: Dictionary = {
    Measure.LEVER_SIZE: %SizeLeverLeader,
    Measure.LEVER_ISOLATION: %IsolationLeverLeader,
    Measure.LEVER_CONTRAST: %ContrastLeverLeader
}

var _record: Dictionary = {}
var _objects: Array[Dictionary] = []
var _views: Dictionary = {}
var _plate_grid: Dictionary = {}
var _stage_size: Vector2 = Vector2(880, 440)
var _selected_id: String = ""
var _dragging_id: String = ""
var _drag_offset: Vector2 = Vector2.ZERO
var _last_result: Dictionary = {}

func _ready() -> void:
    size_slider.value_changed.connect(_on_size_changed)
    reset_button.pressed.connect(_on_reset_pressed)
    check_button.pressed.connect(_on_check_pressed)
    plate_viewport.resized.connect(_fit_stage)
    selection_ring.add_theme_stylebox_override("panel", _selection_style())
    selection_ring.visible = false

## `demonstration` is the record's demonstration block: plate, stageSize, targetId,
## objects, tints and the sentences used for feedback.
func configure(demonstration: Dictionary) -> void:
    _record = demonstration.duplicate(true)
    _stage_size = _record.get("stageSize", Vector2(880, 440))
    stage.custom_minimum_size = _stage_size
    stage.size = _stage_size
    plate.size = _stage_size
    objects_root.size = _stage_size
    var plate_texture := load(String(_record.get("plate", ""))) as Texture2D
    plate.texture = plate_texture
    _plate_grid = Measure.build_plate_grid(plate_texture, PLATE_GRID_COLS, PLATE_GRID_ROWS)
    instruction_label.text = String(_record.get("instruction", ""))
    _build_objects()
    _build_swatches()
    _fit_stage()
    reset_arrangement()

func reset_arrangement() -> void:
    for index in _objects.size():
        # The opening pose is carried on the object itself rather than looked up in the
        # record by position. An object whose texture fails to load is skipped while
        # building, so the two lists stop lining up and every later object would be reset
        # to the pose of the one before it.
        _objects[index]["position"] = _objects[index].get("openingPosition", Vector2.ZERO)
        _objects[index]["scale"] = float(_objects[index].get("openingScale", 1.0))
        _objects[index]["tint"] = Color.WHITE
    _select(String(_record.get("targetId", "")))
    _refresh()

func current_result() -> Dictionary:
    return _last_result.duplicate(true)

## Puts keyboard focus on the object the pair has to promote, so the arrow keys move
## something meaningful the moment the stage opens.
func focus_target() -> void:
    var view := _views.get(String(_record.get("targetId", ""))) as Control
    if view != null:
        view.grab_focus()

func show_error(message: String) -> void:
    if not message.is_empty():
        feedback_label.text = message

func _build_objects() -> void:
    # The selection ring shares this parent with the objects, so clearing the parent
    # wholesale would free it a frame later and leave the stage writing to nothing.
    for child in objects_root.get_children():
        if child != selection_ring:
            child.queue_free()
    _objects.clear()
    _views.clear()
    for entry_value: Variant in _record.get("objects", []):
        var entry: Dictionary = entry_value
        var texture := load(String(entry.get("texture", ""))) as Texture2D
        if texture == null:
            # One engine serves several missions, so a mistyped path has to say so rather
            # than quietly shipping the exercise with an object missing from the table.
            push_warning("Salience stage: no texture at %s" % String(entry.get("texture", "")))
            continue
        var described := Measure.describe_texture(texture)
        var id := String(entry.get("id", ""))
        var object := {
            "id": id,
            "name": String(entry.get("name", id)),
            "baseSize": described.get("baseSize", Vector2.ONE),
            "baseArea": described.get("baseArea", 0.0),
            "baseColour": described.get("baseColour", Color.WHITE),
            "alphaCoverage": described.get("alphaCoverage", 1.0),
            "position": entry.get("position", Vector2.ZERO),
            "scale": float(entry.get("scale", 1.0)),
            "openingPosition": entry.get("position", Vector2.ZERO),
            "openingScale": float(entry.get("scale", 1.0)),
            "tint": Color.WHITE
        }
        _objects.append(object)
        var view := TextureRect.new()
        view.texture = texture
        view.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
        # The drawn box is always the source size times one factor, so a resized object
        # can never end up stretched out of its own proportions.
        view.stretch_mode = TextureRect.STRETCH_SCALE
        view.mouse_filter = Control.MOUSE_FILTER_STOP
        view.focus_mode = Control.FOCUS_ALL
        view.tooltip_text = String(object.get("name"))
        view.gui_input.connect(_on_object_input.bind(id))
        view.focus_entered.connect(_select.bind(id))
        objects_root.add_child(view)
        _views[id] = view
    objects_root.move_child(selection_ring, objects_root.get_child_count() - 1)

func _build_swatches() -> void:
    for child in swatch_row.get_children():
        child.queue_free()
    for tint_value: Variant in _record.get("tints", []):
        var tint: Dictionary = tint_value
        var button := Button.new()
        button.text = String(tint.get("label", ""))
        button.custom_minimum_size = Vector2(0, 48)
        button.add_theme_font_size_override("font_size", 14)
        _style_swatch(button, tint.get("colour", Color.WHITE))
        button.pressed.connect(_on_tint_pressed.bind(tint.get("colour", Color.WHITE)))
        swatch_row.add_child(button)

func _style_swatch(button: Button, colour: Color) -> void:
    # The swatch shows the tint it applies, so it has to carry that colour rather than
    # the shared button theme. Grey is left alone: it still only means unclickable.
    var normal := StyleBoxFlat.new()
    normal.bg_color = Color(colour.r, colour.g, colour.b, 1.0)
    normal.border_color = INK
    normal.set_border_width_all(2)
    normal.set_corner_radius_all(8)
    normal.content_margin_left = 12.0
    normal.content_margin_right = 12.0
    normal.content_margin_top = 8.0
    normal.content_margin_bottom = 8.0
    var hover := normal.duplicate() as StyleBoxFlat
    hover.set_border_width_all(4)
    var focus := normal.duplicate() as StyleBoxFlat
    focus.border_color = FOCUS_RING
    focus.set_border_width_all(4)
    button.add_theme_stylebox_override("normal", normal)
    button.add_theme_stylebox_override("hover", hover)
    button.add_theme_stylebox_override("pressed", hover)
    button.add_theme_stylebox_override("focus", focus)
    for state: String in ["font_color", "font_hover_color", "font_pressed_color", "font_focus_color"]:
        button.add_theme_color_override(state, INK if colour.get_luminance() > 0.45 else Color.WHITE)

func _selection_style() -> StyleBoxFlat:
    var box := StyleBoxFlat.new()
    box.bg_color = Color(0, 0, 0, 0)
    box.border_color = FOCUS_RING
    box.set_border_width_all(3)
    box.set_corner_radius_all(8)
    return box

func _fit_stage() -> void:
    var available := plate_viewport.size
    if available.x <= 0.0 or available.y <= 0.0:
        return
    var factor := minf(available.x / _stage_size.x, available.y / _stage_size.y)
    stage.scale = Vector2(factor, factor)
    stage.position = (available - _stage_size * factor) * 0.5

func _on_object_input(event: InputEvent, id: String) -> void:
    var button_event := event as InputEventMouseButton
    if button_event != null and button_event.button_index == MOUSE_BUTTON_LEFT:
        if button_event.pressed:
            _select(id)
            _dragging_id = id
            _drag_offset = _object(id).get("position", Vector2.ZERO) - stage.get_local_mouse_position()
            _views[id].grab_focus()
        else:
            _dragging_id = ""
        accept_event()
        return
    var motion := event as InputEventMouseMotion
    if motion != null and _dragging_id == id:
        _move_to(id, stage.get_local_mouse_position() + _drag_offset)
        accept_event()
        return
    var key := event as InputEventKey
    if key != null and key.pressed:
        var step := COARSE_NUDGE_STEP if key.shift_pressed else NUDGE_STEP
        var delta := Vector2.ZERO
        match key.keycode:
            KEY_LEFT: delta = Vector2(-step, 0)
            KEY_RIGHT: delta = Vector2(step, 0)
            KEY_UP: delta = Vector2(0, -step)
            KEY_DOWN: delta = Vector2(0, step)
            _: return
        _move_to(id, _object(id).get("position", Vector2.ZERO) + delta)
        accept_event()

func _move_to(id: String, target: Vector2) -> void:
    var index := _index_of(id)
    if index < 0:
        return
    var half: Vector2 = Vector2(_objects[index].get("baseSize")) * float(_objects[index].get("scale")) * 0.5
    _objects[index]["position"] = Vector2(
        clampf(target.x, half.x, _stage_size.x - half.x),
        clampf(target.y, half.y, _stage_size.y - half.y)
    )
    _refresh()

func _on_size_changed(value: float) -> void:
    var index := _index_of(_selected_id)
    if index < 0:
        return
    _objects[index]["scale"] = value
    # Growing an object can push it past the plate edge, so re-clamp its centre.
    _move_to(_selected_id, _objects[index].get("position", Vector2.ZERO))

func _on_tint_pressed(colour: Color) -> void:
    var index := _index_of(_selected_id)
    if index < 0:
        return
    _objects[index]["tint"] = colour
    _refresh()

func _on_reset_pressed() -> void:
    reset_arrangement()

func _on_check_pressed() -> void:
    arrangement_submitted.emit(current_result())

func _select(id: String) -> void:
    if _index_of(id) < 0:
        return
    _selected_id = id
    var object := _object(id)
    selected_label.text = "Selected: %s" % String(object.get("name", id))
    size_slider.set_block_signals(true)
    size_slider.min_value = float(_record.get("minScale", 0.12))
    size_slider.max_value = float(_record.get("maxScale", 0.9))
    size_slider.step = 0.01
    size_slider.value = float(object.get("scale", 1.0))
    size_slider.set_block_signals(false)
    _refresh()

func _refresh() -> void:
    for object: Dictionary in _objects:
        var view := _views.get(String(object.get("id"))) as TextureRect
        if view == null:
            continue
        var drawn: Vector2 = Vector2(object.get("baseSize")) * float(object.get("scale"))
        view.size = drawn
        view.position = Vector2(object.get("position")) - drawn * 0.5
        view.modulate = object.get("tint", Color.WHITE)
    _position_selection_ring()
    _last_result = Measure.evaluate({
        "size": _stage_size,
        "targetId": String(_record.get("targetId", "")),
        "objects": _objects,
        "plateGrid": _plate_grid
    })
    _update_readout(_last_result)

func _position_selection_ring() -> void:
    var view := _views.get(_selected_id) as TextureRect
    if view == null:
        selection_ring.visible = false
        return
    selection_ring.visible = true
    selection_ring.position = view.position - Vector2.ONE * SELECTION_INSET
    selection_ring.size = view.size + Vector2.ONE * SELECTION_INSET * 2.0

func _update_readout(result: Dictionary) -> void:
    var target_id := String(_record.get("targetId", ""))
    for lever: String in Measure.LEVERS:
        var bar := lever_bars.get(lever) as ProgressBar
        var leader_label := lever_leaders.get(lever) as Label
        if bar == null or leader_label == null:
            continue
        bar.value = _share_for(result, target_id, lever) * 100.0
        var leader_id := String(Dictionary(result.get("leaders", {})).get(lever, ""))
        leader_label.text = (
            "Tied" if leader_id.is_empty() else "Leading: %s" % _name_of(leader_id)
        )
    feedback_label.text = describe(result)

## The sentence the pair reads, and the sentence that becomes their recorded evidence.
## It names the lever that was won, so the vocabulary still lands even though leading on
## one lever is enough to pass.
func describe(result: Dictionary) -> String:
    var target_name := _name_of(String(_record.get("targetId", "")))
    var won: PackedStringArray = result.get("wonLevers", PackedStringArray())
    if won.is_empty():
        var closest := _closest_lever(result)
        var leader := String(Dictionary(result.get("leaders", {})).get(closest, ""))
        if leader.is_empty():
            return "The %s does not lead on size, space or colour difference yet." % target_name
        # The leader sits in a naming slot rather than in front of the verb, because a
        # fruit name here can be plural: "the bananas leads" would be wrong.
        return "The %s does not lead yet. It is closest on %s, where the leader is still the %s." % [
            target_name, _lever_phrase(closest), _name_of(leader)
        ]
    return String(Dictionary(_record.get("wonSentences", {})).get(won[0], "")).format({
        "target": target_name
    })

func _closest_lever(result: Dictionary) -> String:
    var target_id := String(_record.get("targetId", ""))
    var best := Measure.LEVER_SIZE
    var best_share := -1.0
    for lever: String in Measure.LEVERS:
        var share := _share_for(result, target_id, lever)
        if share > best_share:
            best_share = share
            best = lever
    return best

func _share_for(result: Dictionary, id: String, lever: String) -> float:
    for entry_value: Variant in result.get("objects", []):
        var entry: Dictionary = entry_value
        if String(entry.get("id", "")) == id:
            return float(entry.get("%sShare" % lever, 0.0))
    return 0.0

func _lever_phrase(lever: String) -> String:
    return String(Dictionary(_record.get("leverPhrases", {})).get(lever, lever))

func _name_of(id: String) -> String:
    var object := _object(id)
    return String(object.get("name", id)) if not object.is_empty() else id

func _object(id: String) -> Dictionary:
    var index := _index_of(id)
    return _objects[index] if index >= 0 else {}

func _index_of(id: String) -> int:
    for index in _objects.size():
        if String(_objects[index].get("id", "")) == id:
            return index
    return -1
