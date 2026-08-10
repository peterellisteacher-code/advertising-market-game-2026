"""Correct the generated colour wheel's hues and saturations to true values.

The generated wheel's GEOMETRY is good — twelve wedges about 29 degrees each, three
concentric rings, crisp cream linework, pixel-art surface. Its COLORIMETRY is not: the
twelve hues land between 6.8 and 91.9 degrees apart instead of 30, and on four wedges the
middle and outer rings carry the same saturation to within 0.02.

Both matter here. The wheel is a teaching asset, so a student reading "the colour opposite
is its complement" off a wheel whose opposite wedge is 160 degrees away is being taught
something false. And the stage reads saturation as the strength of a colour, so two rings
that measure the same leave the pair unable to make the action stronger than the
supporting elements no matter which ring they click.

This rewrites hue and saturation per cell and changes nothing else. Every pixel keeps its
own value, so the shading, the paper texture and the cream linework survive exactly as
generated. The wedge and ring boundaries are read off the image rather than assumed, so
the corrected cells land on the generated geometry.
"""
import colorsys
import math
import sys

from PIL import Image

RING_SATURATION = (0.35, 0.65, 1.0)  # muted, mid, full — the strength scale the stage reads
LINE_MAX_SAT = 0.25   # cream linework and the hub: pale and bright
LINE_MIN_VAL = 0.88

src_path, out_path = sys.argv[1], sys.argv[2]
img = Image.open(src_path).convert("RGBA")
w, h = img.size
cx, cy = w / 2.0, h / 2.0
px = img.load()


def hsv_at(x, y):
    r, g, b, a = px[int(x), int(y)]
    if a < 200:
        return None
    hh, ss, vv = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
    return hh * 360.0, ss, vv


# Outer radius by COLOUR, not by alpha. The generated file has no alpha channel at all, so
# an "is this pixel opaque" scan answers yes at the very first radius it tries and returns
# the scan bound rather than the wheel — which leaves a ring of painted checkerboard inside
# the cut. The wheel's outer ring is fully saturated and the checkerboard is neutral, so
# the last saturated pixel along a ray is the real edge; the cream rim line sits just
# outside it.
RIM_ALLOWANCE = 14
radii = []
for deg in range(0, 360, 5):
    a = math.radians(deg)
    for r in range(int(min(cx, cy)) - 2, 0, -1):
        v = hsv_at(cx + r * math.cos(a), cy - r * math.sin(a))
        if v and v[1] > 0.15:
            radii.append(r)
            break
radii.sort()
R = radii[len(radii) // 2] + RIM_ALLOWANCE

# Ring boundaries: the artwork draws them, as cream arcs, so read those rather than
# inferring them from a saturation profile. Saturation only steps clearly at the FIRST
# boundary — the middle and outer rings were generated nearly equally saturated, which is
# half of what this script exists to repair, so it cannot also be the signal used to find
# them. Rays are cast down wedge CENTRES, where no radial spoke can be mistaken for an arc.
hub = max(8, int(R * 0.045))
hits = []
for k in range(12):
    a = math.radians(90.0 - k * 30.0)
    run = []
    # Start well clear of the hub: its own cream edge is crossed by every ray too, and it
    # is not a ring boundary.
    for r in range(int(R * 0.20), int(R * 0.95)):
        v = hsv_at(cx + r * math.cos(a), cy - r * math.sin(a))
        if v and v[1] < LINE_MAX_SAT and v[2] > LINE_MIN_VAL:
            run.append(r)
        elif run:
            hits.append(sum(run) / len(run))
            run = []
    if run:
        hits.append(sum(run) / len(run))

edges = []
for r in sorted(hits):
    if not edges or r - edges[-1][-1] > R // 10:
        edges.append([r])
    else:
        edges[-1].append(r)
# Keep the two most-agreed arcs: a real boundary is crossed by every one of the twelve
# rays, a smudge by one or two.
print("candidate arcs (radius, rays agreeing):",
      [(int(sum(g) / len(g)), len(g)) for g in edges])
edges.sort(key=len, reverse=True)
if len(edges) < 2:
    raise SystemExit(
        f"ring-boundary detection failed: expected at least 2 drawn arcs, found {len(edges)}"
    )
edges = sorted(int(sum(g) / len(g)) for g in edges[:2])
print(f"radius {R}  hub {hub}  ring boundaries at {edges}")

# Wedge boundaries: read the drawn radial spokes, exactly as the ring arcs were read. The
# generated spokes are NEAR an even 30-degree grid but not on it, and assuming the ideal
# grid leaves a thin sliver of the neighbouring hue down one side of several wedges —
# visible, and wrong in a teaching asset, because it puts a second hue inside a wedge that
# is meant to carry one.
probe = (edges[1] + R) / 2.0
cream = []
step = 0.2
d = 0.0
while d < 360.0:
    a = math.radians(d)
    v = hsv_at(cx + probe * math.cos(a), cy - probe * math.sin(a))
    if v and v[1] < LINE_MAX_SAT and v[2] > LINE_MIN_VAL:
        cream.append(d)
    d += step

spokes = []
for angle in cream:
    if spokes and angle - spokes[-1][-1] <= 2.0:
        spokes[-1].append(angle)
    else:
        spokes.append([angle])
if len(spokes) > 1 and (360.0 - spokes[-1][-1]) + spokes[0][0] <= 2.0:
    spokes[0] = spokes[-1] + spokes[0]
    spokes.pop()
spokes = sorted((sum(g) / len(g)) % 360.0 for g in spokes)
print(f"detected {len(spokes)} spokes at {[round(s, 1) for s in spokes]}")
if len(spokes) != 12:
    raise SystemExit(
        f"spoke detection failed: expected 12 drawn spokes, found {len(spokes)}"
    )

# Each wedge lies between consecutive spokes. Its canonical hue comes from where its
# centre sits relative to straight up, so the spectrum still runs clockwise from red.
wedge_hue = []
for i in range(len(spokes)):
    lo = spokes[i]
    hi = spokes[(i + 1) % len(spokes)]
    span = (hi - lo) % 360.0
    centre = (lo + span / 2.0) % 360.0
    k = int(round(((90.0 - centre) % 360.0) / 30.0)) % 12
    wedge_hue.append(k * 30.0)


def hue_for(deg_screen):
    for i in range(len(spokes)):
        lo = spokes[i]
        if (deg_screen - lo) % 360.0 < (spokes[(i + 1) % len(spokes)] - lo) % 360.0:
            return wedge_hue[i]
    return wedge_hue[0]


out = Image.new("RGBA", (w, h))
op = out.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        # The generated file has NO alpha channel — gpt-image-2 painted a checkerboard as
        # literal grey and white squares instead of producing transparency, so "outside the
        # wheel" has to be cut here. The wheel is a circle whose radius is already measured,
        # so that cut is exact; the two sprite sheets have no such geometry and go through
        # background removal instead.
        dist_now = math.hypot(x - cx, cy - y)
        if dist_now > R:
            op[x, y] = (r, g, b, 0)
            continue
        if a < 8:
            op[x, y] = (r, g, b, a)
            continue
        hh, ss, vv = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
        dx, dy = x - cx, cy - y
        dist = math.hypot(dx, dy)
        # Linework, hub and anything outside the wheel keep exactly what was generated.
        if dist < hub or dist > R or (ss < LINE_MAX_SAT and vv > LINE_MIN_VAL):
            op[x, y] = (r, g, b, a)
            continue
        ring = 0 if dist < edges[0] else (1 if dist < edges[1] else 2)
        target = hue_for(math.degrees(math.atan2(dy, dx)) % 360.0)
        nr, ng, nb = colorsys.hsv_to_rgb(target / 360.0, RING_SATURATION[ring], vv)
        op[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)

out.save(out_path)
print(f"wrote {out_path}")
