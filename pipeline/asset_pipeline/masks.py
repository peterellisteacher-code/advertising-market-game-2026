"""Validation and deterministic preparation of recolouring masks."""

from __future__ import annotations

from pathlib import Path
from typing import Mapping, Sequence

from PIL import Image, ImageChops, ImageOps, UnidentifiedImageError

MASK_ZONES = ("body", "trim", "accent", "label")
MASK_PRECEDENCE = ("label", "accent", "trim", "body")


class MaskValidationError(ValueError):
    """Raised before invalid masks can be emitted."""


def _require_empty_output(output_dir: Path) -> None:
    if output_dir.exists() and (not output_dir.is_dir() or any(output_dir.iterdir())):
        raise MaskValidationError("mask output directory must be absent or empty")


def _coverage(image: Image.Image) -> Image.Image:
    if "A" in image.getbands() or "transparency" in image.info:
        return image.convert("RGBA").getchannel("A")
    return image.convert("L")


def _strong_mask(coverage: Image.Image) -> Image.Image:
    return coverage.point(lambda value: 255 if value >= 128 else 0, mode="1")


def _count_on(mask: Image.Image) -> int:
    histogram = mask.histogram()
    return histogram[255] if len(histogram) > 255 else histogram[-1]


def prepare_masks(
    master_path: Path,
    mask_paths: Mapping[str, Path],
    recolour_zones: Sequence[str],
    output_dir: Path,
) -> dict[str, Path]:
    """Validate, precedence-clip and emit canonical RGBA masks."""

    master_path = Path(master_path)
    output_dir = Path(output_dir)
    _require_empty_output(output_dir)
    zones = list(recolour_zones)
    if len(zones) != len(set(zones)) or any(zone not in MASK_ZONES for zone in zones):
        raise MaskValidationError("recolour zones must be unique and use exactly the supported zone IDs")
    if set(mask_paths) != set(zones):
        raise MaskValidationError("mask files must match recolour zones exactly")

    try:
        with Image.open(master_path) as opened_master:
            opened_master.load()
            master = opened_master.convert("RGBA")
    except (OSError, UnidentifiedImageError) as error:
        raise MaskValidationError("master is not a valid image") from error
    master_alpha = master.getchannel("A")
    master_visible = master_alpha.point(lambda value: 255 if value > 0 else 0, mode="L")
    master_invisible = ImageOps.invert(master_visible)

    coverages: dict[str, Image.Image] = {}
    strong: dict[str, Image.Image] = {}
    for zone in zones:
        try:
            with Image.open(mask_paths[zone]) as opened_mask:
                opened_mask.load()
                if opened_mask.size != master.size:
                    raise MaskValidationError(f"{zone} mask dimensions do not match the master")
                coverage = _coverage(opened_mask)
        except MaskValidationError:
            raise
        except (OSError, UnidentifiedImageError) as error:
            raise MaskValidationError(f"{zone} mask is not a valid image") from error
        if coverage.getbbox() is None:
            raise MaskValidationError(f"{zone} mask is empty")
        if ImageChops.multiply(coverage, master_invisible).getbbox() is not None:
            raise MaskValidationError(f"{zone} mask extends beyond the visible master")
        coverages[zone] = coverage
        strong[zone] = _strong_mask(coverage)

    union = Image.new("1", master.size, 0)
    overlap = Image.new("1", master.size, 0)
    for zone in zones:
        overlap = ImageChops.logical_or(overlap, ImageChops.logical_and(union, strong[zone]))
        union = ImageChops.logical_or(union, strong[zone])
    union_count = _count_on(union)
    overlap_count = _count_on(overlap)
    if union_count and overlap_count * 100 > union_count * 2:
        raise MaskValidationError("mask overlap exceeds 2 percent of the covered union")

    clipped: dict[str, Image.Image] = {}
    occupied = Image.new("1", master.size, 0)
    for zone in MASK_PRECEDENCE:
        if zone not in coverages:
            continue
        value = coverages[zone].copy()
        value.paste(0, mask=occupied)
        clipped[zone] = value
        occupied = ImageChops.logical_or(occupied, strong[zone])

    output_dir.mkdir(parents=True, exist_ok=True)
    results: dict[str, Path] = {}
    for zone in zones:
        alpha = clipped[zone]
        output = Image.new("RGBA", master.size, (255, 255, 255, 0))
        output.putalpha(alpha)
        path = output_dir / f"{zone}.png"
        output.save(path, format="PNG", compress_level=9, optimize=False)
        results[zone] = path
    return results
