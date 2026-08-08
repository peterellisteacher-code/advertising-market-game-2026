extends RefCounted
class_name AdMarketSalienceMeasure

# Scores every object in an arrangement on the three salience levers, each normalised
# across the objects in the scene:
#
#   size      object area / largest object area
#   isolation distance to the nearest neighbour's bounding box / scene diagonal
#   contrast  colour difference between the object's mean colour and the mean of its
#             local surround
#
# The arrangement passes when the named target leads every other object on at least one
# lever. There is no authored target arrangement to compare against: a pass has to come
# out of the measure, or the exercise is only asking students to find a hidden answer.

const LEVER_SIZE := "size"
const LEVER_ISOLATION := "isolation"
const LEVER_CONTRAST := "contrast"
const LEVERS: Array[String] = [LEVER_SIZE, LEVER_ISOLATION, LEVER_CONTRAST]

# Two objects whose scores differ by less than this are treated as tied, so neither
# leads. Float noise from dragging must not decide whether the stage passes.
const LEAD_EPSILON := 0.0005
# The surround ring reaches this far past the object, or a quarter of its longer side.
const MIN_SURROUND_MARGIN := 24.0
const SURROUND_MARGIN_RATIO := 0.25

## Scores one arrangement. `scene` carries `size` (Vector2), `targetId`, `objects`, and
## `plateGrid` as returned by `build_plate_grid`. Each object carries `id`, `baseSize`,
## `baseArea` (opaque pixels at scale 1), `baseColour`, `alphaCoverage`, `position`
## (centre), `scale` and `tint`.
static func evaluate(scene: Dictionary) -> Dictionary:
    var objects: Array = scene.get("objects", [])
    var stage_size: Vector2 = scene.get("size", Vector2.ZERO)
    var target_id := String(scene.get("targetId", ""))
    if objects.is_empty() or stage_size.x <= 0.0 or stage_size.y <= 0.0:
        return {
            "objects": [],
            "leaders": {},
            "wonLevers": PackedStringArray(),
            "passed": false,
            "targetId": target_id
        }

    var rects: Array[Rect2] = []
    var areas: Array[float] = []
    for object_value: Variant in objects:
        var object: Dictionary = object_value
        rects.append(rect_of(object))
        areas.append(area_of(object))

    var diagonal := stage_size.length()
    var stage := Rect2(Vector2.ZERO, stage_size)
    var largest_area := 0.0
    for area: float in areas:
        largest_area = maxf(largest_area, area)

    var scored: Array[Dictionary] = []
    for index in objects.size():
        var object: Dictionary = objects[index]
        scored.append({
            "id": String(object.get("id", "")),
            LEVER_SIZE: areas[index] / largest_area if largest_area > 0.0 else 0.0,
            LEVER_ISOLATION: _nearest_gap(rects, index, stage) / diagonal,
            LEVER_CONTRAST: _surround_contrast(scene, objects, rects, index)
        })

    for lever: String in LEVERS:
        var highest := 0.0
        for entry: Dictionary in scored:
            highest = maxf(highest, float(entry.get(lever, 0.0)))
        for entry: Dictionary in scored:
            entry["%sShare" % lever] = float(entry.get(lever, 0.0)) / highest if highest > 0.0 else 0.0

    var leaders := {}
    var won_levers := PackedStringArray()
    for lever: String in LEVERS:
        var leader := _sole_leader(scored, lever)
        leaders[lever] = leader
        if not leader.is_empty() and leader == target_id:
            won_levers.append(lever)

    return {
        "objects": scored,
        "leaders": leaders,
        "wonLevers": won_levers,
        "passed": not won_levers.is_empty(),
        "targetId": target_id
    }

static func rect_of(object: Dictionary) -> Rect2:
    var base_size: Vector2 = object.get("baseSize", Vector2.ZERO)
    var drawn := base_size * float(object.get("scale", 1.0))
    var centre: Vector2 = object.get("position", Vector2.ZERO)
    return Rect2(centre - drawn * 0.5, drawn)

static func area_of(object: Dictionary) -> float:
    var object_scale := float(object.get("scale", 1.0))
    return float(object.get("baseArea", 0.0)) * object_scale * object_scale

static func tinted_colour(object: Dictionary) -> Color:
    var base: Color = object.get("baseColour", Color.WHITE)
    var tint: Color = object.get("tint", Color.WHITE)
    return Color(base.r * tint.r, base.g * tint.g, base.b * tint.b, 1.0)

## Mean opaque colour, opaque pixel count and opaque fraction of one sprite texture.
static func describe_texture(texture: Texture2D) -> Dictionary:
    var image := texture.get_image()
    if image == null:
        return {}
    if image.is_compressed():
        image.decompress()
    var width := image.get_width()
    var height := image.get_height()
    var total := Vector3.ZERO
    var weight := 0.0
    for y in height:
        for x in width:
            var pixel := image.get_pixel(x, y)
            if pixel.a <= 0.0:
                continue
            total += Vector3(pixel.r, pixel.g, pixel.b) * pixel.a
            weight += pixel.a
    var mean := total / weight if weight > 0.0 else Vector3.ZERO
    return {
        "baseSize": Vector2(width, height),
        # Alpha-weighted, so a loose silhouette such as a bunch of grapes is not
        # credited with the empty pixels inside its bounding box.
        "baseArea": weight,
        "baseColour": Color(mean.x, mean.y, mean.z, 1.0),
        "alphaCoverage": weight / float(width * height) if width * height > 0 else 0.0
    }

## Coarse mean-colour grid over the background plate, so the surround of a dragged
## object can be integrated without resampling the texture every frame. The downscale
## runs in the engine rather than as a GDScript pixel loop: the plate is 1.6 million
## pixels, and reading them one at a time stalls the panel as it opens.
static func build_plate_grid(texture: Texture2D, cols: int, rows: int) -> Dictionary:
    var empty := {"cols": 0, "rows": 0, "cells": PackedColorArray()}
    if texture == null or cols <= 0 or rows <= 0:
        return empty
    var image := texture.get_image()
    if image == null:
        return empty
    image = image.duplicate()
    if image.is_compressed():
        image.decompress()
    image.resize(cols, rows, Image.INTERPOLATE_LANCZOS)
    var cells := PackedColorArray()
    cells.resize(cols * rows)
    for row in rows:
        for col in cols:
            var pixel := image.get_pixel(col, row)
            cells[row * cols + col] = Color(pixel.r, pixel.g, pixel.b, 1.0)
    return {"cols": cols, "rows": rows, "cells": cells}

static func _nearest_gap(rects: Array[Rect2], index: int, stage: Rect2) -> float:
    # Space around an object means space on every side, so the stage edge counts as a
    # neighbour like any other. Measuring only the gaps between objects lets an object
    # shoved into a corner read as the most isolated thing on the table while two of its
    # sides have no room at all, and the win sentence then tells the pair it has the most
    # space around it.
    var nearest := _edge_gap(rects[index], stage)
    for other in rects.size():
        if other == index:
            continue
        nearest = minf(nearest, _rect_gap(rects[index], rects[other]))
    return nearest if is_finite(nearest) else 0.0

## Distance from the object to the nearest stage edge. Clamped at zero so an object that
## hangs over the edge reads as touching it rather than as having negative room.
static func _edge_gap(rect: Rect2, stage: Rect2) -> float:
    return maxf(0.0, minf(
        minf(rect.position.x - stage.position.x, stage.end.x - rect.end.x),
        minf(rect.position.y - stage.position.y, stage.end.y - rect.end.y)
    ))

static func _rect_gap(a: Rect2, b: Rect2) -> float:
    var dx := maxf(0.0, maxf(a.position.x - b.end.x, b.position.x - a.end.x))
    var dy := maxf(0.0, maxf(a.position.y - b.end.y, b.position.y - a.end.y))
    return Vector2(dx, dy).length()

static func _surround_contrast(
    scene: Dictionary,
    objects: Array,
    rects: Array[Rect2],
    index: int
) -> float:
    var stage := Rect2(Vector2.ZERO, scene.get("size", Vector2.ZERO))
    var inner := rects[index].intersection(stage)
    var margin := maxf(
        MIN_SURROUND_MARGIN,
        SURROUND_MARGIN_RATIO * maxf(rects[index].size.x, rects[index].size.y)
    )
    var outer := rects[index].grow(margin).intersection(stage)
    var ring_area := _area(outer) - _area(inner)
    if ring_area <= 0.0:
        return 0.0

    var surround := Vector3.ZERO
    var claimed := 0.0
    for other in objects.size():
        if other == index:
            continue
        var overlap := _area(outer.intersection(rects[other])) - _area(inner.intersection(rects[other]))
        if overlap <= 0.0:
            continue
        # A neighbour only covers the fraction of its own box that is actually opaque.
        var share := clampf(
            overlap * float(objects[other].get("alphaCoverage", 1.0)) / ring_area,
            0.0,
            1.0
        )
        share = minf(share, 1.0 - claimed)
        claimed += share
        var colour := tinted_colour(objects[other])
        surround += Vector3(colour.r, colour.g, colour.b) * share

    var plate := _plate_mean(scene, outer, inner)
    surround += Vector3(plate.r, plate.g, plate.b) * (1.0 - claimed)
    return delta_e(
        tinted_colour(objects[index]),
        Color(surround.x, surround.y, surround.z, 1.0)
    )

static func _plate_mean(scene: Dictionary, outer: Rect2, inner: Rect2) -> Color:
    var grid: Dictionary = scene.get("plateGrid", {})
    var cols := int(grid.get("cols", 0))
    var rows := int(grid.get("rows", 0))
    var cells: PackedColorArray = grid.get("cells", PackedColorArray())
    if cols <= 0 or rows <= 0 or cells.size() < cols * rows:
        return Color.WHITE
    var outer_total := _grid_integral(scene, cells, cols, rows, outer)
    var inner_total := _grid_integral(scene, cells, cols, rows, inner)
    var weight := outer_total.w - inner_total.w
    if weight <= 0.0:
        return Color.WHITE
    var mean := (Vector3(outer_total.x, outer_total.y, outer_total.z)
        - Vector3(inner_total.x, inner_total.y, inner_total.z)) / weight
    return Color(mean.x, mean.y, mean.z, 1.0)

## Area-weighted sum of grid colours over `region`, with the covered area in `w`.
static func _grid_integral(
    scene: Dictionary,
    cells: PackedColorArray,
    cols: int,
    rows: int,
    region: Rect2
) -> Vector4:
    if _area(region) <= 0.0:
        return Vector4.ZERO
    var stage_size: Vector2 = scene.get("size", Vector2.ZERO)
    var cell_size := Vector2(stage_size.x / cols, stage_size.y / rows)
    var first_col := clampi(int(floor(region.position.x / cell_size.x)), 0, cols - 1)
    var last_col := clampi(int(floor((region.end.x - 0.0001) / cell_size.x)), 0, cols - 1)
    var first_row := clampi(int(floor(region.position.y / cell_size.y)), 0, rows - 1)
    var last_row := clampi(int(floor((region.end.y - 0.0001) / cell_size.y)), 0, rows - 1)
    var total := Vector4.ZERO
    for row in range(first_row, last_row + 1):
        for col in range(first_col, last_col + 1):
            var cell := Rect2(Vector2(col, row) * cell_size, cell_size)
            var covered := _area(cell.intersection(region))
            if covered <= 0.0:
                continue
            var colour := cells[row * cols + col]
            total += Vector4(colour.r, colour.g, colour.b, 1.0) * covered
    return total

static func _sole_leader(scored: Array[Dictionary], lever: String) -> String:
    var best := -INF
    var runner_up := -INF
    var leader := ""
    for entry: Dictionary in scored:
        var value := float(entry.get(lever, 0.0))
        if value > best:
            runner_up = best
            best = value
            leader = String(entry.get("id", ""))
        elif value > runner_up:
            runner_up = value
    if best - runner_up <= LEAD_EPSILON:
        return ""
    return leader

static func _area(rect: Rect2) -> float:
    return maxf(0.0, rect.size.x) * maxf(0.0, rect.size.y)

## CIE76 colour difference. Enough to rank "which object separates most from what is
## behind it"; the exercise never reports the number itself.
static func delta_e(a: Color, b: Color) -> float:
    return (_to_lab(a) - _to_lab(b)).length()

static func _to_lab(colour: Color) -> Vector3:
    var r := _srgb_to_linear(colour.r)
    var g := _srgb_to_linear(colour.g)
    var b := _srgb_to_linear(colour.b)
    var x := _lab_curve((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047)
    var y := _lab_curve(0.2126729 * r + 0.7151522 * g + 0.0721750 * b)
    var z := _lab_curve((0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883)
    return Vector3(116.0 * y - 16.0, 500.0 * (x - y), 200.0 * (y - z))

static func _srgb_to_linear(channel: float) -> float:
    if channel <= 0.04045:
        return channel / 12.92
    return pow((channel + 0.055) / 1.055, 2.4)

static func _lab_curve(value: float) -> float:
    if value > 0.008856:
        return pow(value, 1.0 / 3.0)
    return 7.787 * value + 16.0 / 116.0
