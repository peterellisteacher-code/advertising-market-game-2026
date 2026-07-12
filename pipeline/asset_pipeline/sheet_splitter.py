"""Deterministic splitting of authored chroma asset sheets."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
from pathlib import Path

from PIL import Image, UnidentifiedImageError

from .chroma import connected_components_8, remove_border_connected_chroma
from .schema import AssetSheet

MAX_ENCODED_SOURCE_BYTES = 64 * 1024 * 1024
MAX_SHEET_AXIS = 4096
MAX_SHEET_PIXELS = 16_777_216
MAX_COMPONENTS = 256


class SheetSplitError(ValueError):
    """Raised before an unsafe or ambiguous sheet split."""


@dataclass(frozen=True, slots=True)
class SplitComponent:
    asset_id: str
    source_bounds: tuple[int, int, int, int]
    path: Path


def _require_empty_output(output_dir: Path) -> None:
    if output_dir.exists() and (not output_dir.is_dir() or any(output_dir.iterdir())):
        raise SheetSplitError("sheet output directory must be absent or empty")


def _source_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _expanded(bounds: tuple[int, int, int, int], padding: int) -> tuple[int, int, int, int]:
    left, top, right, bottom = bounds
    return left - padding, top - padding, right + padding, bottom + padding


def _intersects(first: tuple[int, int, int, int], second: tuple[int, int, int, int]) -> bool:
    return first[0] < second[2] and second[0] < first[2] and first[1] < second[3] and second[1] < first[3]


def split_sheet(source_path: Path, sheet: AssetSheet, output_dir: Path) -> list[SplitComponent]:
    """Split a verified sheet and map spatial components to explicit IDs."""

    source_path = Path(source_path)
    output_dir = Path(output_dir)
    _require_empty_output(output_dir)
    if not source_path.is_file():
        raise SheetSplitError("sheet source file does not exist")
    if source_path.stat().st_size > MAX_ENCODED_SOURCE_BYTES:
        raise SheetSplitError("sheet encoded size exceeds 64 MiB")
    if _source_hash(source_path) != sheet.source_sha256:
        raise SheetSplitError("sheet source hash does not match sourceSha256")
    if sheet.colour_distance_formula != "cie76-srgb-d65":
        raise SheetSplitError("sheet colour-distance formula is unsupported")

    try:
        with Image.open(source_path) as opened:
            width, height = opened.size
            if width <= 0 or height <= 0 or width > MAX_SHEET_AXIS or height > MAX_SHEET_AXIS or width * height > MAX_SHEET_PIXELS:
                raise SheetSplitError("sheet dimensions exceed the 4096-axis or 16777216-pixel size limit")
            opened.load()
            rgba = opened.convert("RGBA")
    except SheetSplitError:
        raise
    except (OSError, UnidentifiedImageError) as error:
        raise SheetSplitError("sheet source is not a valid image") from error

    rgba = remove_border_connected_chroma(
        rgba,
        tuple(sheet.chroma_rgb),
        sheet.threshold,
        sheet.alpha_cutoff,
    )
    foreground = bytearray(rgba.getchannel("A").point([
        1 if alpha > 0 and alpha >= sheet.alpha_cutoff else 0
        for alpha in range(256)
    ]).tobytes())
    components = [
        component
        for component in connected_components_8(foreground, width, height)
        if component.area >= sheet.component_area_floor
    ]
    if len(components) != sheet.expected_component_count:
        raise SheetSplitError(
            f"sheet expected {sheet.expected_component_count} components but found {len(components)}"
        )
    if len(components) > MAX_COMPONENTS:
        raise SheetSplitError("sheet contains more than 256 components")
    if len(sheet.output_ids) != len(components):
        raise SheetSplitError("sheet output ID count does not match the detected component count")

    expanded_bounds: list[tuple[int, int, int, int]] = []
    for component in components:
        left, top, right, bottom = component.bounds
        if component.touches_border:
            raise SheetSplitError("sheet component is clipped by the sheet edge")
        expanded = _expanded(component.bounds, sheet.padding)
        if expanded[0] < 0 or expanded[1] < 0 or expanded[2] > width or expanded[3] > height:
            raise SheetSplitError("component padding extends beyond the sheet edge")
        expanded_bounds.append(expanded)

    for index, first in enumerate(expanded_bounds):
        for second in expanded_bounds[index + 1 :]:
            if _intersects(first, second):
                raise SheetSplitError("component padding regions collide")

    prepared: list[tuple[str, tuple[int, int, int, int], Image.Image]] = []
    for asset_id, component, crop_bounds in zip(sheet.output_ids, components, expanded_bounds, strict=True):
        cleared = rgba.crop(crop_bounds)
        gutter = sheet.gutter
        output = Image.new("RGBA", (cleared.width + 2 * gutter, cleared.height + 2 * gutter), (0, 0, 0, 0))
        output.paste(cleared, (gutter, gutter))
        prepared.append((asset_id, component.bounds, output))

    output_dir.mkdir(parents=True, exist_ok=True)
    results: list[SplitComponent] = []
    for asset_id, bounds, image in prepared:
        path = output_dir / f"{asset_id}.png"
        image.save(path, format="PNG", compress_level=9, optimize=False)
        results.append(SplitComponent(asset_id=asset_id, source_bounds=bounds, path=path))
    return results
