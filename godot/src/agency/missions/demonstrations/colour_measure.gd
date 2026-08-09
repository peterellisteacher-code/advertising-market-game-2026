extends RefCounted
class_name AdMarketColourMeasure

# Engine C — colour wheel. One poster whose elements the pair colours from a twelve-hue
# wheel, one job per product. Four checks decide whether the palette works, and each is in
# its own units:
#
#   accentSeparation  how far round the wheel the action's hue sits from the hue the
#                     supporting elements share. Degrees, 0 to 180
#   accentStrength    how much stronger the action's colour is than the strongest
#                     supporting colour. Strength, on the 0 to 1 scale the wheel's rings
#                     carry. This is where the plan's "only one element carries the
#                     accent" is measured: a support matching the action leaves the margin
#                     at zero, so the count is entailed by the margin rather than counted
#                     beside it. One number, one thing to change
#   supportHarmony    the widest gap between any two supporting hues. Degrees. Supports
#                     scattered round the wheel give the accent no base to contrast with,
#                     which is the fault colour-clinic exists to repair
#   toneMatch         how far the supporting base hue sits from the hue the brief asks
#                     for. Degrees. This is the check that makes Kate's three products
#                     different from one another: the same wheel has a different right
#                     answer for a calm product than for an urgent one
#
# There is no authored palette. The record names what the colours have to do — a
# separation, a margin, a spread and a feeling — never which wedges to click, and every
# palette satisfying the four passes. This shares no maths with salience_measure.gd or
# crop_measure.gd: C is circular statistics on the hue wheel, not CIE76 distance in Lab
# and not rectangle containment.
#
# Hue is degrees clockwise from red, 0 to 360, and every comparison between two hues wraps
# — 350 and 10 are twenty degrees apart, not three hundred and forty. Strength is the
# wheel ring, 0 to 1. The wheel offers no unsaturated ring, so no element is ever neutral
# and every element has a hue that means something.

const CHECK_ACCENT_SEPARATION := "accentSeparation"
const CHECK_ACCENT_STRENGTH := "accentStrength"
const CHECK_SUPPORT_HARMONY := "supportHarmony"
const CHECK_TONE_MATCH := "toneMatch"
const CHECKS: Array[String] = [
    CHECK_ACCENT_SEPARATION,
    CHECK_ACCENT_STRENGTH,
    CHECK_SUPPORT_HARMONY,
    CHECK_TONE_MATCH
]

# Two of the four want a floor and two want a ceiling, so the comparison is declared per
# check rather than assumed. Engine B could compare all four of its checks the same way
# because all four were floors; reading a spread or a distance-from-target as "at least"
# would pass exactly the palettes it exists to reject.
const COMPARE_AT_LEAST := "atLeast"
const COMPARE_AT_MOST := "atMost"
const CHECK_COMPARISON: Dictionary = {
    CHECK_ACCENT_SEPARATION: COMPARE_AT_LEAST,
    CHECK_ACCENT_STRENGTH: COMPARE_AT_LEAST,
    CHECK_SUPPORT_HARMONY: COMPARE_AT_MOST,
    CHECK_TONE_MATCH: COMPARE_AT_MOST
}

# In each check's own units. The wheel's wedges are 30 degrees apart and its rings are far
# enough apart that neither figure ever decides a case on its own: they absorb float
# error, nothing more. A check with no declared tolerance reports itself unmet rather than
# borrowing another's — engine A shipped a contrast lever that inherited a normalised
# figure three orders of magnitude too small for its scale, and sampling noise picked the
# winner.
const DEGREE_EPSILON := 0.5
const STRENGTH_EPSILON := 0.001
const CHECK_EPSILON: Dictionary = {
    CHECK_ACCENT_SEPARATION: DEGREE_EPSILON,
    CHECK_ACCENT_STRENGTH: STRENGTH_EPSILON,
    CHECK_SUPPORT_HARMONY: DEGREE_EPSILON,
    CHECK_TONE_MATCH: DEGREE_EPSILON
}

# Below this the summed unit vectors of the supporting hues are too short to point
# anywhere. Supports on opposite sides of the wheel have no base hue between them, and
# choosing one would invent a number the pair never picked.
const RESULTANT_EPSILON := 0.001

const HUE_UNDEFINED := -1.0
const OPPOSITE := 180.0

## Scores one job — one product's poster, one palette. `scene` carries `elements` (an
## Array of Dictionaries, each with `id`, `hue` in degrees and `strength` 0 to 1),
## `actionElement` (the id of the element carrying the thing the audience is asked to do),
## `toneHue` (the hue the brief's feeling asks for), and the four thresholds
## `minAccentSeparation`, `minAccentStrength`, `maxSupportSpread` and `maxToneDistance`.
static func evaluate(scene: Dictionary) -> Dictionary:
    var elements: Array = scene.get("elements", [])
    var action_id := String(scene.get("actionElement", ""))
    var action := _element(elements, action_id)
    var supports := _supporting(elements, action_id)
    if action.is_empty() or supports.is_empty():
        # A poster with no action element, or one carrying nothing but the action, has
        # nothing to reserve the accent against. There is no palette to judge, so no check
        # passes.
        return _unmeasured(scene)

    var support_hues := hues_of(supports)
    var base_hue := circular_mean(support_hues)
    var has_base := base_hue >= 0.0
    var accent_hue := float(action.get("hue", 0.0))

    # When the supports point nowhere the two base-dependent checks still have to report a
    # number. These are the honest worst readings rather than sentinels: no separation has
    # been established against a base that does not exist, and a palette with no base hue
    # is as far from the asked-for feeling as the wheel goes. The spread below is measured
    # either way, and is the reading that tells the pair what to actually fix.
    var separation := hue_distance(accent_hue, base_hue) if has_base else 0.0
    var tone_distance := hue_distance(base_hue, float(scene.get("toneHue", 0.0))) if has_base else OPPOSITE

    var values := {
        CHECK_ACCENT_SEPARATION: separation,
        CHECK_ACCENT_STRENGTH: float(action.get("strength", 0.0)) - strongest(supports),
        CHECK_SUPPORT_HARMONY: widest_gap(support_hues),
        CHECK_TONE_MATCH: tone_distance
    }
    var required := {
        CHECK_ACCENT_SEPARATION: float(scene.get("minAccentSeparation", 0.0)),
        CHECK_ACCENT_STRENGTH: float(scene.get("minAccentStrength", 0.0)),
        CHECK_SUPPORT_HARMONY: float(scene.get("maxSupportSpread", OPPOSITE)),
        CHECK_TONE_MATCH: float(scene.get("maxToneDistance", OPPOSITE))
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
        "baseHue": base_hue,
        "accentHue": accent_hue,
        "passed": unmet.is_empty()
    }

## The shorter way round the wheel between two hues, in degrees, 0 to 180. Either hue may
## be `HUE_UNDEFINED`, in which case there is no distance to report and the pair is as far
## from the target as the wheel allows.
static func hue_distance(first: float, second: float) -> float:
    if first < 0.0 or second < 0.0:
        return OPPOSITE
    var gap := absf(wrapf(first, 0.0, 360.0) - wrapf(second, 0.0, 360.0))
    return minf(gap, 360.0 - gap)

## The hue the supporting elements share, in degrees, or `HUE_UNDEFINED` when they do not
## share one. Hues are directions, not quantities: the arithmetic mean of 350 and 10 is
## 180, the colour furthest from both. Summing unit vectors and taking the angle of the
## result gives 0, which is the hue actually between them.
static func circular_mean(hues: PackedFloat32Array) -> float:
    if hues.is_empty():
        return HUE_UNDEFINED
    var x := 0.0
    var y := 0.0
    for hue in hues:
        var radians := deg_to_rad(hue)
        x += cos(radians)
        y += sin(radians)
    var count := float(hues.size())
    x /= count
    y /= count
    # The resultant length falls to zero exactly when the hues cancel — two supports
    # opposite each other, or four at the corners of the wheel. There is no hue between
    # them to report.
    if sqrt(x * x + y * y) < RESULTANT_EPSILON:
        return HUE_UNDEFINED
    return wrapf(rad_to_deg(atan2(y, x)), 0.0, 360.0)

## The widest gap between any two of these hues, in degrees, 0 to 180. Measured pairwise
## rather than against the mean: three supports at 0, 90 and 180 all sit 90 from a mean
## that means nothing, while the pair can see they span half the wheel.
static func widest_gap(hues: PackedFloat32Array) -> float:
    var widest := 0.0
    for first in range(hues.size()):
        for second in range(first + 1, hues.size()):
            widest = maxf(widest, hue_distance(hues[first], hues[second]))
    return widest

## The strength of the strongest element in this list, 0 to 1.
static func strongest(elements: Array) -> float:
    var top := 0.0
    for element: Variant in elements:
        top = maxf(top, float(Dictionary(element).get("strength", 0.0)))
    return top

## The hues of these elements, in list order.
static func hues_of(elements: Array) -> PackedFloat32Array:
    var hues := PackedFloat32Array()
    for element: Variant in elements:
        hues.append(float(Dictionary(element).get("hue", 0.0)))
    return hues

static func _element(elements: Array, id: String) -> Dictionary:
    if id.is_empty():
        return {}
    for element: Variant in elements:
        var candidate := Dictionary(element)
        if String(candidate.get("id", "")) == id:
            return candidate
    return {}

static func _supporting(elements: Array, action_id: String) -> Array:
    var supports := []
    for element: Variant in elements:
        var candidate := Dictionary(element)
        if String(candidate.get("id", "")) != action_id:
            supports.append(candidate)
    return supports

static func _meets(check: String, value: float, required: float) -> bool:
    # A check whose tolerance or comparison has not been declared cannot say whether it
    # was met, so it says no. Borrowing another check's figure is how a tolerance in the
    # wrong units ships without anyone noticing.
    if not CHECK_EPSILON.has(check) or not CHECK_COMPARISON.has(check):
        return false
    var tolerance := float(CHECK_EPSILON[check])
    match String(CHECK_COMPARISON[check]):
        COMPARE_AT_LEAST:
            return value >= required - tolerance
        COMPARE_AT_MOST:
            return value <= required + tolerance
        _:
            return false

static func _unmeasured(scene: Dictionary) -> Dictionary:
    var checks := {}
    var unmet := PackedStringArray()
    for check: String in CHECKS:
        checks[check] = {"value": 0.0, "required": 0.0, "passed": false}
        unmet.append(check)
    return {
        "checks": checks,
        "unmet": unmet,
        "baseHue": HUE_UNDEFINED,
        "accentHue": HUE_UNDEFINED,
        "passed": false
    }
