"""Slice the three generated sheets into the files engine C ships, and report provenance.

Every sheet is generated large and resampled down ONCE, which is what the crop assets did.
Lanczos is the right filter for producing art and is not the smoothing ban that applies
inside a variance measurement — nothing here is measured by variance.
"""
import hashlib
import pathlib
import sys

from PIL import Image

OUT = pathlib.Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
wheel_src, elements_src, products_src = sys.argv[2], sys.argv[3], sys.argv[4]

rows = []


def record(name, path, generated, note):
    img = Image.open(path)
    digest = hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
    rows.append((name, generated, f"{img.size[0]} x {img.size[1]}", digest, note))


def columns_of_content(img, threshold=16):
    """Split the sheet where it is actually empty, not into equal fractions.

    The generated cells are not evenly filled — several elements sit hard against an equal
    quarter boundary, and cutting there shaves a column off the shape. The transparent
    gutters between elements are unambiguous, so cut down the middle of those instead.
    """
    w, h = img.size
    alpha = img.getchannel("A")
    filled = []
    for x in range(w):
        col = alpha.crop((x, 0, x + 1, h))
        filled.append(col.getextrema()[1] > threshold)
    spans = []
    start = None
    for x, on in enumerate(filled):
        if on and start is None:
            start = x
        elif not on and start is not None:
            spans.append((start, x))
            start = None
    if start is not None:
        spans.append((start, w))
    return spans


def slice_sheet(src, count, names, scale, notes):
    img = Image.open(src).convert("RGBA")
    w, h = img.size
    spans = columns_of_content(img)
    if len(spans) == count:
        cuts = [(max(0, s - 4), min(w, e + 4)) for s, e in spans]
    else:
        print(f"WARNING: {src} split into {len(spans)} runs, expected {count} — "
              f"falling back to equal cells")
        cell = w // count
        cuts = [(i * cell, (i + 1) * cell) for i in range(count)]
    for i, name in enumerate(names):
        part = img.crop((cuts[i][0], 0, cuts[i][1], h))
        # getbbox() treats any non-zero alpha as content, and these sheets carry a haze of
        # alpha 1-8 across the whole cell, so it returns the full rectangle and trims
        # nothing. Threshold first: the sprite is what is actually visible.
        solid = part.getchannel("A").point(lambda a: 255 if a > 16 else 0)
        bbox = solid.getbbox()
        if bbox is None:
            raise SystemExit(f"cell {i} of {src} is empty")
        pad = 4
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad),
                min(part.width, bbox[2] + pad), min(part.height, bbox[3] + pad))
        part = part.crop(bbox)
        # Clear the same haze rather than shipping it. At 6% opacity it is invisible on a
        # white page, but these four shapes get tinted to a saturated hue at runtime, and a
        # film of strong colour over the whole rectangle would not be.
        alpha = part.getchannel("A").point(lambda a: 0 if a <= 16 else a)
        part.putalpha(alpha)
        part = part.resize(
            (max(1, part.width // scale), max(1, part.height // scale)), Image.LANCZOS
        )
        out = OUT / f"{name}.png"
        part.save(out)
        record(name, out, f"x {cuts[i][0]}-{cuts[i][1]} of {w} x {h}", notes[i])


# The wheel ships square and whole; its geometry is the asset.
wheel = Image.open(wheel_src).convert("RGBA")
wheel_out = OUT / "colour-wheel.png"
wheel.resize((768, 768), Image.LANCZOS).save(wheel_out)
record("colour-wheel", wheel_out, f"{wheel.size[0]} x {wheel.size[1]}",
       "hue and saturation corrected per cell after generation; geometry, linework and "
       "shading as generated")

slice_sheet(
    elements_src, 4,
    ["poster-panel", "poster-headline", "poster-body", "poster-action"], 2,
    ["tinted at runtime", "tinted at runtime", "tinted at runtime", "tinted at runtime"],
)
slice_sheet(
    products_src, 3,
    ["product-sleep-tea", "product-skateboard", "product-mug"], 2,
    ["calm brief", "urgent brief", "restrained brief"],
)

print(f"{'file':<26} {'generated':<28} {'shipped':<14} sha256")
for name, generated, shipped, digest, note in rows:
    print(f"{name + '.png':<26} {generated:<28} {shipped:<14} {digest}")
print()
for name, _, _, _, note in rows:
    print(f"  {name}.png — {note}")
