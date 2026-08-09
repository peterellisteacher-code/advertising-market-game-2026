"""Measure the generated colour wheel's actual pixels.

The stage reads hue and saturation from the pixel the pair clicks, so the art is the
authority. That only works if the art is actually a wheel: twelve distinct hues evenly
spread, and three rings whose saturations are far enough apart that choosing an outer
wedge really does make a colour stronger than an inner one.
"""
import colorsys
import math
import sys

from PIL import Image

path = sys.argv[1]
img = Image.open(path).convert("RGBA")
w, h = img.size
cx, cy = w / 2.0, h / 2.0
px = img.load()


def hsv_at(x, y):
    r, g, b, a = px[int(x), int(y)]
    if a < 200:
        return None
    hh, ss, vv = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
    return hh * 360.0, ss, vv


# Outer radius: furthest opaque pixel, median over many rays so one ragged edge cannot
# move it.
radii = []
for deg in range(0, 360, 5):
    a = math.radians(deg)
    last = 0
    for r in range(int(min(cx, cy)) - 2, 0, -1):
        x, y = cx + r * math.cos(a), cy - r * math.sin(a)
        if px[int(x), int(y)][3] > 200:
            last = r
            break
    radii.append(last)
radii.sort()
R = radii[len(radii) // 2]

# Inner cream circle: scan out from the centre until saturation rises off the cream hub.
r_in = 0
for r in range(4, R):
    vals = [hsv_at(cx + r * math.cos(math.radians(d)), cy - r * math.sin(math.radians(d)))
            for d in range(0, 360, 30)]
    vals = [v for v in vals if v]
    if vals and sum(v[1] for v in vals) / len(vals) > 0.12:
        r_in = r
        break

print(f"image {w}x{h}  outer radius {R}  hub radius {r_in}")

band = (R - r_in) / 3.0
ring_r = [r_in + band * 0.5, r_in + band * 1.5, r_in + band * 2.5]

for name, rr in zip(("inner", "middle", "outer"), ring_r):
    # Walk the ring one degree at a time and cut it into segments wherever the hue jumps.
    samples = []
    for deg in range(360):
        a = math.radians(deg)
        v = hsv_at(cx + rr * math.cos(a), cy - rr * math.sin(a))
        samples.append((deg, v))
    segments = []
    current = []
    for deg, v in samples:
        if v is None:
            continue
        if current and min(abs(v[0] - current[-1][1][0]),
                           360 - abs(v[0] - current[-1][1][0])) > 8:
            segments.append(current)
            current = []
        current.append((deg, v))
    if current:
        segments.append(current)
    # The wheel wraps, so a segment starting at 0 and one ending at 359 are one wedge.
    if len(segments) > 1 and min(
        abs(segments[0][0][1][0] - segments[-1][-1][1][0]),
        360 - abs(segments[0][0][1][0] - segments[-1][-1][1][0])) <= 8:
        segments[0] = segments[-1] + segments[0]
        segments.pop()
    kept = [s for s in segments if len(s) >= 12]
    print(f"\n{name} ring (r={rr:.0f}) — {len(kept)} wedges of 12")
    hues = []
    for seg in kept:
        mid = seg[len(seg) // 2][1]
        hues.append(mid[0])
        print(f"  arc {seg[0][0]:3d}-{seg[-1][0]:3d}deg  hue {mid[0]:6.1f}  sat {mid[1]:.3f}  val {mid[2]:.3f}")
    if len(hues) >= 2:
        ordered = sorted(hues)
        gaps = [ordered[i + 1] - ordered[i] for i in range(len(ordered) - 1)]
        gaps.append(360 - ordered[-1] + ordered[0])
        print(f"  hue gaps: min {min(gaps):.1f}  max {max(gaps):.1f}  (even wheel = 30.0)")

# Strength separation, measured on one wedge at a time so a hue that renders pale
# everywhere cannot hide behind a hue that renders strong.
print("\nsaturation by ring, sampled every 30 degrees:")
worst = 1.0
for deg in range(0, 360, 30):
    a = math.radians(deg)
    row = []
    for rr in ring_r:
        v = hsv_at(cx + rr * math.cos(a), cy - rr * math.sin(a))
        row.append(v[1] if v else float("nan"))
    step = min(row[1] - row[0], row[2] - row[1])
    worst = min(worst, step)
    print(f"  {deg:3d}deg  inner {row[0]:.3f}  middle {row[1]:.3f}  outer {row[2]:.3f}"
          f"   smallest step {step:+.3f}")
print(f"\nsmallest saturation step anywhere on the wheel: {worst:+.3f}")
