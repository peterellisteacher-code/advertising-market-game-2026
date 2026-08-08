extends VBoxContainer
class_name AdMarketCropStage

# Engine B — crop frame. One raster image with a draggable, resizable rectangle over it,
# and the advertisement's slogan as a second thing the pair drags. The four checks are
# measured live and the arrangement is accepted when all four are met.
#
# The slogan is placed by the pair, not by this scene. That is the whole point: the
# measure reads the picture underneath wherever they put it, so "leave the message
# somewhere it can be read" is a decision they make and see the result of, rather than a
# status word about space they never had to use.
#
# Nothing about the checks is authored into this scene: the readout builds one column per
# entry in Measure.CHECKS and titles it from the record, so an engine measuring a
# different set only has to name its own phrases.

signal arrangement_submitted(result: Dictionary)

const Measure = preload("res://src/agency/missions/demonstrations/crop_measure.gd")

# The key the record's win and evidence sentences are stored under. Engine A names the
# lever it won; engine B passes on all four checks at once, so there is a single one.
const EVIDENCE_KEY := "crop"

const DEFAULT_MIN_CROP_SIZE := Vector2(480, 320)
const DEFAULT_SLOGAN_SIZE := Vector2(480, 192)
const NUDGE_STEP := 8.0
const COARSE_NUDGE_STEP := 32.0
# Corner handles are sized in screen pixels and converted into image pixels against the
# current fit factor, so they stay a 48px touch target however far the image is scaled
# down to fit the dialog.
const HANDLE_SCREEN_SIZE := 48.0
const CORNERS: Array[Vector2i] = [
    Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1), Vector2i(1, 1)
]
# The slogan's own furniture, in image pixels, laid out against whatever size the record
# gives it rather than against fixed numbers.
const SLOGAN_PAD_SHARE := 0.075
const SLOGAN_GAP_SHARE := 0.062
const SLOGAN_MARK_SHARE := 0.55
const SLOGAN_NAME_SHARE := 0.27
const SLOGAN_LINE_SHARE := 0.14

const SHADE := Color(0.04, 0.14, 0.25, 0.55)
const FOCUS_RING := Color(0.965, 0.72, 0.21, 1)
const PAPER := Color(0.98, 0.965, 0.91, 1)
const INK := Color(0.04, 0.14, 0.25, 1)
const CHECK_NAME_INK := Color(0, 0.48, 0.62, 1)
const MET_INK := Color(0, 0.47, 0.36, 1)
const UNMET_INK := Color(0.55, 0.24, 0.16, 1)

@onready var instruction_label: Label = %DemonstrationInstruction
@onready var image_viewport: Control = %ImageViewport
@onready var stage: Control = %Stage
@onready var source_image: TextureRect = %SourceImage
@onready var shade: Control = %Shade
@onready var frame: Panel = %Frame
@onready var slogan: Panel = %Slogan
@onready var slogan_mark: TextureRect = %SloganMark
@onready var slogan_name: Label = %SloganName
@onready var slogan_line: Label = %SloganLine
@onready var handles_root: Control = %Handles
@onready var readout_row: HBoxContainer = %ReadoutRow
@onready var feedback_label: Label = %DemonstrationFeedback
@onready var reset_button: Button = %ResetButton
@onready var check_button: Button = %CheckButton

var check_status: Dictionary = {}

var _record: Dictionary = {}
var _detail_grid: Dictionary = {}
var _image_size: Vector2 = Vector2.ZERO
var _min_crop_size: Vector2 = DEFAULT_MIN_CROP_SIZE
var _slogan_size: Vector2 = DEFAULT_SLOGAN_SIZE
var _crop: Rect2 = Rect2()
var _slogan: Rect2 = Rect2()
var _shade_rects: Array[ColorRect] = []
var _handles: Dictionary = {}
var _dragging_corner: Vector2i = Vector2i(-1, -1)
var _corner_offset: Vector2 = Vector2.ZERO
var _moving_frame: bool = false
var _moving_slogan: bool = false
var _drag_offset: Vector2 = Vector2.ZERO
var _slogan_offset: Vector2 = Vector2.ZERO
var _fit_factor: float = 1.0
var _last_result: Dictionary = {}

func _ready() -> void:
    reset_button.pressed.connect(_on_reset_pressed)
    check_button.pressed.connect(_on_check_pressed)
    image_viewport.resized.connect(_fit_stage)
    frame.gui_input.connect(_on_frame_input)
    frame.mouse_filter = Control.MOUSE_FILTER_STOP
    frame.focus_mode = Control.FOCUS_ALL
    frame.add_theme_stylebox_override("panel", _frame_style(false))
    # Both labels sit on the panel's cream, and a Label takes its colour from the theme
    # rather than from the dialog's own font_color override, so left alone they draw white
    # on cream and cannot be read.
    instruction_label.add_theme_color_override("font_color", INK)
    feedback_label.add_theme_color_override("font_color", INK)
    shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
    handles_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
    # The slogan sits after the frame in the scene, so it takes the pointer first where
    # the two overlap. The frame's panel stops input across its whole rectangle, not just
    # its border, so a slogan below it in the tree could never be picked up at all.
    slogan.mouse_filter = Control.MOUSE_FILTER_STOP
    slogan.focus_mode = Control.FOCUS_ALL
    slogan.tooltip_text = "Drag the slogan to where it can be read"
    slogan.gui_input.connect(_on_slogan_input)
    slogan.focus_entered.connect(_restyle_slogan)
    slogan.focus_exited.connect(_restyle_slogan)
    for part: Control in [slogan_mark, slogan_name, slogan_line]:
        part.mouse_filter = Control.MOUSE_FILTER_IGNORE
    slogan_mark.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
    slogan_mark.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
    slogan_name.add_theme_color_override("font_color", PAPER)
    slogan_line.add_theme_color_override("font_color", PAPER)
    _build_shade()
    _build_handles()

## `demonstration` is the record's demonstration block: image, subjectRegion, the two
## thresholds, the slogan's art and words, the phrases used for the readout, and the
## sentences used for feedback.
func configure(demonstration: Dictionary) -> void:
    _record = demonstration.duplicate(true)
    var texture := load(String(_record.get("image", ""))) as Texture2D
    if texture == null:
        # Without the image there is nothing to crop and nothing to read the picture from.
        # A mistyped path has to say so rather than quietly shipping an exercise whose
        # message check can never be met.
        push_warning("Crop stage: no image texture at %s" % String(_record.get("image", "")))
        _image_size = Vector2.ZERO
        _detail_grid = {}
    else:
        # The image's own size is the space the record's subject region, the frame and the
        # slogan are written in. Reading it from the texture rather than from the record
        # means the two cannot disagree about how big the picture is.
        _image_size = texture.get_size()
        _detail_grid = Measure.build_detail_grid(texture)
    source_image.texture = texture
    stage.custom_minimum_size = _image_size
    stage.size = _image_size
    source_image.size = _image_size
    instruction_label.text = String(_record.get("instruction", ""))
    slogan_mark.texture = load(String(_record.get("sloganMark", ""))) as Texture2D
    slogan_name.text = String(_record.get("sloganName", ""))
    slogan_line.text = String(_record.get("sloganLine", ""))
    _min_crop_size = _record.get("minCropSize", DEFAULT_MIN_CROP_SIZE)
    _slogan_size = _record.get("sloganSize", DEFAULT_SLOGAN_SIZE)
    _layout_slogan()
    _build_readout()
    _fit_stage()
    reset_arrangement()

## The opening arrangement, which the record sets to the whole picture with the slogan
## lying across it: the frame contains the subject but keeps so much of the church that
## the bottle reads small, and the slogan starts on top of the picture, so the exercise
## cannot pass itself before the pair has touched anything.
func reset_arrangement() -> void:
    _set_slogan(_record.get("sloganStart", Vector2.ZERO))
    _set_crop(_record.get("openingCrop", Rect2(Vector2.ZERO, _image_size)))

func current_result() -> Dictionary:
    var result := _last_result.duplicate(true)
    # Both sentences are written here, from this engine's own record, and the controller
    # relays whichever one it is handed. Looking them up there instead would mean the
    # controller had to know what each engine measures and what its record calls things.
    if bool(result.get("passed", false)):
        result["evidence"] = _sentence("evidenceSentences", EVIDENCE_KEY)
    else:
        result["reason"] = describe(_last_result)
    return result

## Puts keyboard focus on the frame, so the arrow keys move something meaningful the
## moment the stage opens.
func focus_target() -> void:
    frame.grab_focus()

func show_error(message: String) -> void:
    if not message.is_empty():
        feedback_label.text = message

func _build_shade() -> void:
    for rect in _shade_rects:
        rect.queue_free()
    _shade_rects.clear()
    # Four rectangles around the frame rather than one drawn mask: the same idiom the
    # salience stage uses for its selection ring, and no pixels are drawn in code.
    for _index in 4:
        var rect := ColorRect.new()
        rect.color = SHADE
        rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
        shade.add_child(rect)
        _shade_rects.append(rect)

func _build_handles() -> void:
    for handle_value: Variant in _handles.values():
        (handle_value as Control).queue_free()
    _handles.clear()
    for corner: Vector2i in CORNERS:
        var handle := Panel.new()
        handle.mouse_filter = Control.MOUSE_FILTER_STOP
        handle.focus_mode = Control.FOCUS_ALL
        handle.tooltip_text = "Resize the frame from this corner"
        handle.add_theme_stylebox_override("panel", _handle_style(false))
        handle.gui_input.connect(_on_handle_input.bind(corner))
        handle.focus_entered.connect(_on_handle_focus.bind(corner, true))
        handle.focus_exited.connect(_on_handle_focus.bind(corner, false))
        handles_root.add_child(handle)
        _handles[corner] = handle

func _build_readout() -> void:
    for child in readout_row.get_children():
        child.queue_free()
    check_status.clear()
    for check: String in Measure.CHECKS:
        var column := VBoxContainer.new()
        column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
        column.add_theme_constant_override("separation", 2)
        var name_label := Label.new()
        name_label.text = _check_phrase(check).to_upper()
        name_label.add_theme_color_override("font_color", CHECK_NAME_INK)
        name_label.add_theme_font_size_override("font_size", 13)
        name_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
        var status_label := Label.new()
        status_label.add_theme_font_size_override("font_size", 15)
        column.add_child(name_label)
        column.add_child(status_label)
        readout_row.add_child(column)
        check_status[check] = status_label

## Lays the slogan's mark and two lines out inside whatever size the record gives it. The
## whole lockup lives in the picture's coordinates, so it scales with the picture and its
## size relative to the frame is the same whatever dialog it is shown in.
func _layout_slogan() -> void:
    var box := _slogan_size
    if box.x <= 0.0 or box.y <= 0.0:
        return
    var pad := box.y * SLOGAN_PAD_SHARE
    var mark := box.y * SLOGAN_MARK_SHARE
    slogan_mark.position = Vector2(pad, (box.y - mark) * 0.5)
    slogan_mark.size = Vector2(mark, mark)
    var text_x := pad + mark + box.y * SLOGAN_GAP_SHARE
    var text_width := maxf(0.0, box.x - text_x - pad)
    var name_size := box.y * SLOGAN_NAME_SHARE
    var line_size := box.y * SLOGAN_LINE_SHARE
    var block := name_size * 1.2 + line_size * 1.35
    var top := (box.y - block) * 0.5
    slogan_name.position = Vector2(text_x, top)
    slogan_name.size = Vector2(text_width, name_size * 1.2)
    slogan_name.add_theme_font_size_override("font_size", int(name_size))
    slogan_line.position = Vector2(text_x, top + name_size * 1.2)
    slogan_line.size = Vector2(text_width, line_size * 1.35)
    slogan_line.add_theme_font_size_override("font_size", int(line_size))

func _frame_style(focused: bool) -> StyleBoxFlat:
    var box := StyleBoxFlat.new()
    box.bg_color = Color(0, 0, 0, 0)
    # Ink rather than cream: most of what the frame is drawn over is the plain wall the
    # pair is being asked to keep, and a cream line disappears against it.
    box.border_color = FOCUS_RING if focused else INK
    box.set_border_width_all(4 if focused else 3)
    return box

func _handle_style(focused: bool) -> StyleBoxFlat:
    var box := StyleBoxFlat.new()
    box.bg_color = PAPER
    box.border_color = FOCUS_RING if focused else INK
    box.set_border_width_all(4 if focused else 2)
    box.set_corner_radius_all(4)
    return box

## The slogan's own block. Its edge carries the one check the pair cannot otherwise see:
## a slogan outside the frame is still on screen, because the excluded picture is only
## dimmed, so the edge says whether it is actually in the advertisement.
func _slogan_style(focused: bool, in_frame: bool) -> StyleBoxFlat:
    var box := StyleBoxFlat.new()
    box.bg_color = INK
    box.border_color = FOCUS_RING if focused else (PAPER if in_frame else UNMET_INK)
    box.set_border_width_all(6 if focused or not in_frame else 3)
    box.set_corner_radius_all(10)
    return box

func _restyle_slogan() -> void:
    var checks: Dictionary = _last_result.get("checks", {})
    var in_frame := bool(
        Dictionary(checks.get(Measure.CHECK_MESSAGE_IN_FRAME, {})).get("passed", false)
    )
    slogan.add_theme_stylebox_override("panel", _slogan_style(slogan.has_focus(), in_frame))

func _fit_stage() -> void:
    var available := image_viewport.size
    if available.x <= 0.0 or available.y <= 0.0 or _image_size.x <= 0.0 or _image_size.y <= 0.0:
        return
    _fit_factor = minf(available.x / _image_size.x, available.y / _image_size.y)
    stage.scale = Vector2(_fit_factor, _fit_factor)
    stage.position = (available - _image_size * _fit_factor) * 0.5
    _position_frame()

func _on_frame_input(event: InputEvent) -> void:
    var button_event := event as InputEventMouseButton
    if button_event != null and button_event.button_index == MOUSE_BUTTON_LEFT:
        if button_event.pressed:
            _moving_frame = true
            _drag_offset = _crop.position - _stage_point(frame, button_event.position)
            frame.grab_focus()
        else:
            _moving_frame = false
        accept_event()
        return
    var motion := event as InputEventMouseMotion
    if motion != null and _moving_frame:
        _set_crop(Rect2(_stage_point(frame, motion.position) + _drag_offset, _crop.size))
        accept_event()
        return
    var delta := _nudge_delta(event)
    if delta != Vector2.ZERO:
        _set_crop(Rect2(_crop.position + delta, _crop.size))
        accept_event()

func _on_slogan_input(event: InputEvent) -> void:
    var button_event := event as InputEventMouseButton
    if button_event != null and button_event.button_index == MOUSE_BUTTON_LEFT:
        if button_event.pressed:
            _moving_slogan = true
            _slogan_offset = _slogan.position - _stage_point(slogan, button_event.position)
            slogan.grab_focus()
        else:
            _moving_slogan = false
        accept_event()
        return
    var motion := event as InputEventMouseMotion
    if motion != null and _moving_slogan:
        _set_slogan(_stage_point(slogan, motion.position) + _slogan_offset)
        accept_event()
        return
    var delta := _nudge_delta(event)
    if delta != Vector2.ZERO:
        _set_slogan(_slogan.position + delta)
        accept_event()

func _on_handle_input(event: InputEvent, corner: Vector2i) -> void:
    var button_event := event as InputEventMouseButton
    if button_event != null and button_event.button_index == MOUSE_BUTTON_LEFT:
        if button_event.pressed:
            _dragging_corner = corner
            # Where the corner sits relative to the grab, so a handle pushed inside the
            # picture edge does not jump the corner to meet the pointer.
            _corner_offset = _corner_point(corner) - _stage_point(
                _handles[corner] as Control, button_event.position
            )
            (_handles[corner] as Control).grab_focus()
        else:
            _dragging_corner = Vector2i(-1, -1)
        accept_event()
        return
    var motion := event as InputEventMouseMotion
    if motion != null and _dragging_corner == corner:
        _resize_corner(
            corner,
            _stage_point(_handles[corner] as Control, motion.position) + _corner_offset
        )
        accept_event()
        return
    var delta := _nudge_delta(event)
    if delta != Vector2.ZERO:
        _resize_corner(corner, _corner_point(corner) + delta)
        accept_event()

func _on_handle_focus(corner: Vector2i, focused: bool) -> void:
    var handle := _handles.get(corner) as Panel
    if handle != null:
        handle.add_theme_stylebox_override("panel", _handle_style(focused))

func _nudge_delta(event: InputEvent) -> Vector2:
    var key := event as InputEventKey
    if key == null or not key.pressed:
        return Vector2.ZERO
    var step := COARSE_NUDGE_STEP if key.shift_pressed else NUDGE_STEP
    match key.keycode:
        KEY_LEFT: return Vector2(-step, 0)
        KEY_RIGHT: return Vector2(step, 0)
        KEY_UP: return Vector2(0, -step)
        KEY_DOWN: return Vector2(0, step)
    return Vector2.ZERO

## Where a pointer event on `control` falls in the picture's own coordinates. Taken from
## the event rather than from the global mouse position, so a drag can be driven and its
## effect checked without moving the real pointer.
func _stage_point(control: Control, local: Vector2) -> Vector2:
    return control.position + local

func _corner_point(corner: Vector2i) -> Vector2:
    return Vector2(
        _crop.position.x if corner.x == 0 else _crop.end.x,
        _crop.position.y if corner.y == 0 else _crop.end.y
    )

func _resize_corner(corner: Vector2i, point: Vector2) -> void:
    # The dragged corner is measured against the one diagonally opposite, which stays put.
    var anchor := Vector2(
        _crop.end.x if corner.x == 0 else _crop.position.x,
        _crop.end.y if corner.y == 0 else _crop.position.y
    )
    var moved := Vector2(
        clampf(point.x, 0.0, _image_size.x),
        clampf(point.y, 0.0, _image_size.y)
    )
    # Stop the dragged corner at the minimum frame rather than letting it cross the
    # anchor, which would turn the frame inside out.
    moved.x = minf(moved.x, anchor.x - _min_crop_size.x) if corner.x == 0 else maxf(moved.x, anchor.x + _min_crop_size.x)
    moved.y = minf(moved.y, anchor.y - _min_crop_size.y) if corner.y == 0 else maxf(moved.y, anchor.y + _min_crop_size.y)
    _set_crop(Rect2(
        Vector2(minf(anchor.x, moved.x), minf(anchor.y, moved.y)),
        (anchor - moved).abs()
    ))

func _set_crop(rect: Rect2) -> void:
    if _image_size.x <= 0.0 or _image_size.y <= 0.0:
        return
    var size := Vector2(
        clampf(rect.size.x, minf(_min_crop_size.x, _image_size.x), _image_size.x),
        clampf(rect.size.y, minf(_min_crop_size.y, _image_size.y), _image_size.y)
    )
    _crop = Rect2(
        Vector2(
            clampf(rect.position.x, 0.0, _image_size.x - size.x),
            clampf(rect.position.y, 0.0, _image_size.y - size.y)
        ),
        size
    )
    _refresh()

## The slogan keeps the size the record gives it and only moves. Resizing it would let a
## pair shrink the message until it fitted any gap, which is the opposite of the decision
## being asked for.
func _set_slogan(position: Vector2) -> void:
    if _image_size.x <= 0.0 or _image_size.y <= 0.0:
        return
    _slogan = Rect2(
        Vector2(
            clampf(position.x, 0.0, maxf(0.0, _image_size.x - _slogan_size.x)),
            clampf(position.y, 0.0, maxf(0.0, _image_size.y - _slogan_size.y))
        ),
        _slogan_size
    )
    _refresh()

func _refresh() -> void:
    _position_frame()
    _last_result = Measure.evaluate({
        "imageSize": _image_size,
        "subjectRegion": _record.get("subjectRegion", Rect2()),
        "crop": _crop,
        "slogan": _slogan,
        "minSubjectShare": float(_record.get("minSubjectShare", 0.0)),
        "minPlainShare": float(_record.get("minPlainShare", 0.0)),
        "detailGrid": _detail_grid
    })
    slogan.position = _slogan.position
    slogan.size = _slogan.size
    _restyle_slogan()
    _update_readout(_last_result)

func _position_frame() -> void:
    frame.position = _crop.position
    frame.size = _crop.size
    if _shade_rects.size() == 4:
        # Above, below, and the two bands beside the frame, so the excluded picture is
        # visibly excluded rather than merely outlined.
        _shade_rects[0].position = Vector2.ZERO
        _shade_rects[0].size = Vector2(_image_size.x, _crop.position.y)
        _shade_rects[1].position = Vector2(0.0, _crop.end.y)
        _shade_rects[1].size = Vector2(_image_size.x, _image_size.y - _crop.end.y)
        _shade_rects[2].position = Vector2(0.0, _crop.position.y)
        _shade_rects[2].size = Vector2(_crop.position.x, _crop.size.y)
        _shade_rects[3].position = Vector2(_crop.end.x, _crop.position.y)
        _shade_rects[3].size = Vector2(_image_size.x - _crop.end.x, _crop.size.y)
    var handle_size := Vector2.ONE * HANDLE_SCREEN_SIZE / maxf(_fit_factor, 0.0001)
    for corner: Vector2i in CORNERS:
        var handle := _handles.get(corner) as Panel
        if handle == null:
            continue
        handle.size = handle_size
        # Kept inside the picture: a handle centred on a corner that sits on the picture's
        # edge is half outside the clipped viewport, leaving a quarter of it to grab.
        var limit := Vector2(
            maxf(0.0, _image_size.x - handle_size.x),
            maxf(0.0, _image_size.y - handle_size.y)
        )
        handle.position = (_corner_point(corner) - handle_size * 0.5).clamp(Vector2.ZERO, limit)

func _update_readout(result: Dictionary) -> void:
    var checks: Dictionary = result.get("checks", {})
    for check: String in Measure.CHECKS:
        var status_label := check_status.get(check) as Label
        if status_label == null:
            continue
        var met := bool(Dictionary(checks.get(check, {})).get("passed", false))
        status_label.text = "Kept" if met else "Not yet"
        status_label.add_theme_color_override("font_color", MET_INK if met else UNMET_INK)
    feedback_label.text = describe(result)

## The sentence the pair reads, and the sentence that becomes their recorded evidence.
## While the arrangement does not work it names one thing to change rather than four,
## taking the checks in the order the measure declares them: get the bottle inside the
## frame, then get close enough to it, then get the slogan into the frame, then get it off
## the picture.
func describe(result: Dictionary) -> String:
    var unmet: PackedStringArray = result.get("unmet", PackedStringArray())
    if unmet.is_empty():
        return _sentence("wonSentences", EVIDENCE_KEY)
    return _sentence("unmetSentences", unmet[0])

func _sentence(group: String, key: String) -> String:
    return String(Dictionary(_record.get(group, {})).get(key, "")).format({
        "subject": _subject_phrase()
    })

func _subject_phrase() -> String:
    return String(_record.get("subjectPhrase", "the subject"))

func _check_phrase(check: String) -> String:
    return String(Dictionary(_record.get("checkPhrases", {})).get(check, check))

func _on_reset_pressed() -> void:
    reset_arrangement()

func _on_check_pressed() -> void:
    arrangement_submitted.emit(current_result())
