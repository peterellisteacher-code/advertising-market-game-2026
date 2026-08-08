extends RefCounted
class_name AdMarketCropMeasure

# Engine B — crop frame. One draggable, resizable rectangle over one raster image, plus
# the slogan the pair drags into place. Four checks decide whether the advertisement
# works, and each is in its own units:
#
#   subject         how far the frame cuts into the record's named subject region — the
#                   product. Image pixels, and zero when the whole region is inside
#   prominence      the subject's share of the frame's area, so a frame that keeps the
#                   whole room fails even though the subject is still inside it
#   messageInFrame  how far the slogan hangs outside the frame. Image pixels, and zero
#                   when the whole slogan is inside. A slogan outside the frame is not
#                   in the advertisement at all
#   messageClear    the share of the slogan's own area sitting on plain pixels, so a
#                   slogan laid across the picture fails. Read from the image's own
#                   pixels rather than authored
#
# The last two are what make the slogan a decision rather than a decoration. Nothing here
# searches for the best place to put it: the pair chooses, and the measure reads the
# picture underneath that choice.
#
# There is no authored correct crop. The record names what has to survive, not where the
# frame belongs, and every arrangement that satisfies the four checks passes. This shares
# no maths with salience_measure.gd: B is containment and cover, not size, isolation and
# contrast.

const CHECK_SUBJECT := "subject"
const CHECK_PROMINENCE := "prominence"
const CHECK_MESSAGE_IN_FRAME := "messageInFrame"
const CHECK_MESSAGE_CLEAR := "messageClear"
const CHECKS: Array[String] = [
    CHECK_SUBJECT, CHECK_PROMINENCE, CHECK_MESSAGE_IN_FRAME, CHECK_MESSAGE_CLEAR
]

# Every check is compared as `value >= required - tolerance`, and the tolerance is in that
# check's own units: the two containment checks are distances in image pixels, while the
# other two are dimensionless shares. A check with no declared tolerance reports itself
# unmet rather than borrowing another's — engine A shipped a contrast lever that inherited
# a normalised figure three orders of magnitude too small for its scale, and sampling
# noise picked the winner.
const CONTAINMENT_EPSILON_PX := 1.0
const SHARE_EPSILON := 0.001
const CHECK_EPSILON: Dictionary = {
    CHECK_SUBJECT: CONTAINMENT_EPSILON_PX,
    CHECK_PROMINENCE: SHARE_EPSILON,
    CHECK_MESSAGE_IN_FRAME: CONTAINMENT_EPSILON_PX,
    CHECK_MESSAGE_CLEAR: SHARE_EPSILON
}

# A cell counts as plain when its luminance standard deviation, on a 0-255 scale, falls
# below this. In the shipped image the plaster wall measures under 1.0 and the packed
# pews measure over 24, so anything from about 2 to 15 classifies the same cells: this
# figure is not sitting on an edge.
const PLAIN_STD := 6.0
const DETAIL_CELL := 32
const DETAIL_DOWNSCALE := 4

## Scores one arrangement. `scene` carries `imageSize` (Vector2, taken from the texture
## rather than the record), `subjectRegion` (Rect2), `crop` (Rect2), `slogan` (Rect2),
## `minSubjectShare`, `minPlainShare`, and `detailGrid` as returned by `build_detail_grid`.
static func evaluate(scene: Dictionary) -> Dictionary:
    var crop: Rect2 = scene.get("crop", Rect2())
    var subject: Rect2 = scene.get("subjectRegion", Rect2())
    var slogan: Rect2 = scene.get("slogan", Rect2())
    var crop_area := maxf(0.0, crop.size.x) * maxf(0.0, crop.size.y)
    if crop_area <= 0.0:
        # A frame with no area has no share to report and nothing to contain. Every check
        # is unmet, so a collapsed frame cannot pass.
        return _unmeasured(scene)

    # The subject's share is measured on the part of it the frame actually keeps, so the
    # figure stays truthful when the frame cuts the region rather than reporting a share
    # of something that is no longer in shot.
    var kept := crop.intersection(subject)
    var values := {
        CHECK_SUBJECT: -containment_overflow(crop, subject),
        CHECK_PROMINENCE: _area(kept) / crop_area,
        CHECK_MESSAGE_IN_FRAME: -containment_overflow(crop, slogan),
        CHECK_MESSAGE_CLEAR: plain_share(scene, slogan)
    }
    var required := {
        CHECK_SUBJECT: 0.0,
        CHECK_PROMINENCE: float(scene.get("minSubjectShare", 0.0)),
        CHECK_MESSAGE_IN_FRAME: 0.0,
        CHECK_MESSAGE_CLEAR: float(scene.get("minPlainShare", 0.0))
    }

    var checks := {}
    var unmet := PackedStringArray()
    for check: String in CHECKS:
        var value := float(values[check])
        var threshold := float(required[check])
        var met := _meets(check, value, threshold)
        checks[check] = {"value": value, "required": threshold, "passed": met}
        if not met:
            unmet.append(check)

    return {
        "checks": checks,
        "unmet": unmet,
        "crop": crop,
        "slogan": slogan,
        "passed": unmet.is_empty()
    }

## How far `inner` spills outside `outer`, on its worst side, in image pixels. Zero when
## `inner` lies wholly inside `outer`.
static func containment_overflow(outer: Rect2, inner: Rect2) -> float:
    return maxf(0.0, maxf(
        maxf(outer.position.x - inner.position.x, inner.end.x - outer.end.x),
        maxf(outer.position.y - inner.position.y, inner.end.y - outer.end.y)
    ))

## The share of `rect`'s own area that sits on plain pixels, 0 to 1. Cells are weighted by
## how much of each one the rectangle actually covers, so the figure moves smoothly as the
## slogan is dragged instead of stepping a whole cell at a time. The divisor is the
## rectangle's full area rather than the part overlapping the image, so a slogan pushed
## off the edge scores down for the part that is over nothing.
static func plain_share(scene: Dictionary, rect: Rect2) -> float:
    var area := _area(rect)
    if area <= 0.0:
        return 0.0
    var grid: Dictionary = scene.get("detailGrid", {})
    if not has_detail_grid(grid):
        # Without the grid there is nothing to read the picture from. Calling every
        # placement clear would pass them all, so the absent grid fails closed.
        return 0.0
    var cols := int(grid.get("cols", 0))
    var rows := int(grid.get("rows", 0))
    var cell := float(int(grid.get("cell", DETAIL_CELL)))
    var plain: PackedByteArray = grid.get("plain", PackedByteArray())

    var first_col := clampi(int(floor(rect.position.x / cell)), 0, cols - 1)
    var first_row := clampi(int(floor(rect.position.y / cell)), 0, rows - 1)
    var last_col := clampi(int(ceil(rect.end.x / cell)), 0, cols)
    var last_row := clampi(int(ceil(rect.end.y / cell)), 0, rows)

    var covered := 0.0
    for row in range(first_row, last_row):
        for col in range(first_col, last_col):
            if plain[row * cols + col] != 1:
                continue
            var overlap := rect.intersection(
                Rect2(Vector2(col * cell, row * cell), Vector2(cell, cell))
            )
            covered += _area(overlap)
    return covered / area

## Coarse plain/busy grid over the source image. The image is 1.2 million pixels, and
## reading them one at a time stalls the panel as it opens, so the engine does the
## reduction and the GDScript loop runs over the reduction — 76,800 samples for the
## shipped image. Cells past the last whole one are dropped, so an image whose size is not
## a multiple of the cell loses its right and bottom edge from the grid.
static func build_detail_grid(
    texture: Texture2D,
    cell: int = DETAIL_CELL,
    downscale: int = DETAIL_DOWNSCALE
) -> Dictionary:
    var empty := {"cols": 0, "rows": 0, "cell": cell, "plain": PackedByteArray()}
    if texture == null or cell <= 0 or downscale <= 0 or cell % downscale != 0:
        return empty
    var image := texture.get_image()
    if image == null:
        return empty
    image = image.duplicate()
    if image.is_compressed():
        image.decompress()
    var cols := image.get_width() / cell
    var rows := image.get_height() / cell
    var samples := cell / downscale
    if cols <= 0 or rows <= 0 or samples <= 0:
        return empty
    # Nearest, not one of the smoothing filters. This measures how much a cell varies, and
    # every averaging filter is a low-pass one: resampling the shipped image with Lanczos
    # moved 72 of its 1200 cells from busy to plain and changed five verdicts, because
    # averaging is exactly the operation that removes the variance being measured.
    # Subsampling leaves it alone — nearest disagreed with the full-resolution grid on 15
    # cells and changed no verdict at all.
    image.resize(cols * samples, rows * samples, Image.INTERPOLATE_NEAREST)

    var plain := PackedByteArray()
    plain.resize(cols * rows)
    var count := float(samples * samples)
    for row in rows:
        for col in cols:
            var total := 0.0
            var total_squares := 0.0
            for y in samples:
                for x in samples:
                    var value := image.get_pixel(col * samples + x, row * samples + y).get_luminance()
                    total += value
                    total_squares += value * value
            # Variance as the mean of the squares less the square of the mean, so one
            # pass over the cell is enough.
            var mean := total / count
            var variance := maxf(0.0, total_squares / count - mean * mean)
            plain[row * cols + col] = 1 if sqrt(variance) * 255.0 < PLAIN_STD else 0
    return {"cols": cols, "rows": rows, "cell": cell, "plain": plain}

## Whether the detail grid is present and complete enough to sample.
static func has_detail_grid(grid: Dictionary) -> bool:
    var cols := int(grid.get("cols", 0))
    var rows := int(grid.get("rows", 0))
    var plain: PackedByteArray = grid.get("plain", PackedByteArray())
    return cols > 0 and rows > 0 and plain.size() >= cols * rows

static func _meets(check: String, value: float, required: float) -> bool:
    # A check whose tolerance has not been declared cannot say whether it was met, so it
    # says no. Borrowing another check's figure is how a tolerance in the wrong units
    # ships without anyone noticing.
    if not CHECK_EPSILON.has(check):
        return false
    return value >= required - float(CHECK_EPSILON[check])

static func _unmeasured(scene: Dictionary) -> Dictionary:
    var checks := {}
    var unmet := PackedStringArray()
    for check: String in CHECKS:
        checks[check] = {"value": 0.0, "required": 0.0, "passed": false}
        unmet.append(check)
    return {
        "checks": checks,
        "unmet": unmet,
        "crop": scene.get("crop", Rect2()),
        "slogan": scene.get("slogan", Rect2()),
        "passed": false
    }

static func _area(rect: Rect2) -> float:
    return maxf(0.0, rect.size.x) * maxf(0.0, rect.size.y)
