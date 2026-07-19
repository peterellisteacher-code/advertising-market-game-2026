from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import cv2
import numpy as np
from PIL import Image


SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


@dataclass(frozen=True)
class SheetCell:
    row: int
    column: int
    image: Image.Image


@dataclass(frozen=True)
class CellReport:
    bounding_box: tuple[int, int, int, int] | None
    opaque_pixel_count: int
    short_edge: int
    edge_contact: bool
    safe_inset_breach: bool


@dataclass(frozen=True)
class PreparedCell:
    master: Image.Image
    silhouette: Image.Image
    ink_overlay: Image.Image
    report: CellReport


def split_sheet(sheet: Image.Image, *, columns: int, rows: int) -> list[SheetCell]:
    if columns < 1 or rows < 1:
        raise ValueError("Grid columns and rows must be positive")
    if sheet.width < columns or sheet.height < rows:
        raise ValueError("Grid is larger than the source sheet")

    cells: list[SheetCell] = []
    for row_index in range(rows):
        top = sheet.height * row_index // rows
        bottom = sheet.height * (row_index + 1) // rows
        for column_index in range(columns):
            left = sheet.width * column_index // columns
            right = sheet.width * (column_index + 1) // columns
            cells.append(SheetCell(
                row=row_index + 1,
                column=column_index + 1,
                image=sheet.crop((left, top, right, bottom)),
            ))
    return cells


def detect_grid_subjects(
    sheet: Image.Image,
    *,
    columns: int,
    rows: int,
    source_padding: int = 32,
    minimum_component_pixels: int = 12,
    alpha_threshold: int = 8,
) -> list[SheetCell]:
    """Group complete connected subjects by their nearest expected grid cell."""
    if columns < 1 or rows < 1:
        raise ValueError("Grid columns and rows must be positive")
    return detect_row_layout_subjects(
        sheet,
        row_counts=(columns,) * rows,
        source_padding=source_padding,
        minimum_component_pixels=minimum_component_pixels,
        alpha_threshold=alpha_threshold,
    )


def detect_row_layout_subjects(
    sheet: Image.Image,
    *,
    row_counts: tuple[int, ...],
    source_padding: int = 32,
    minimum_component_pixels: int = 12,
    alpha_threshold: int = 8,
) -> list[SheetCell]:
    """Group subjects into a bounded number of evenly spaced slots per row."""
    if not row_counts or any(type(count) is not int or count < 1 for count in row_counts):
        raise ValueError("Row counts must be positive integers")
    if sheet.width < max(row_counts) or sheet.height < len(row_counts):
        raise ValueError("Row layout is larger than the source sheet")
    if source_padding < 0:
        raise ValueError("source_padding must be non-negative")
    if minimum_component_pixels < 1:
        raise ValueError("minimum_component_pixels must be positive")

    keyed_sheet = key_chroma(sheet)
    alpha = np.asarray(keyed_sheet.getchannel("A"))
    binary = (alpha > alpha_threshold).astype(np.uint8)
    component_count, labels, stats, centroids = cv2.connectedComponentsWithStats(
        binary,
        connectivity=8,
    )
    groups: dict[tuple[int, int], list[tuple[int, int, int, int, int]]] = {}
    for component_index in range(1, component_count):
        left = int(stats[component_index, cv2.CC_STAT_LEFT])
        top = int(stats[component_index, cv2.CC_STAT_TOP])
        width = int(stats[component_index, cv2.CC_STAT_WIDTH])
        height = int(stats[component_index, cv2.CC_STAT_HEIGHT])
        area = int(stats[component_index, cv2.CC_STAT_AREA])
        if area < minimum_component_pixels:
            continue
        centre_x, centre_y = centroids[component_index]
        row_index = min(
            len(row_counts) - 1,
            max(0, int(centre_y * len(row_counts) / sheet.height)),
        )
        columns_in_row = row_counts[row_index]
        column_index = min(
            columns_in_row - 1,
            max(0, int(centre_x * columns_in_row / sheet.width)),
        )
        groups.setdefault((row_index, column_index), []).append((
            component_index,
            left,
            top,
            left + width,
            top + height,
        ))

    keyed_pixels = np.asarray(keyed_sheet).copy()
    cells: list[SheetCell] = []
    for row_index, columns_in_row in enumerate(row_counts):
        for column_index in range(columns_in_row):
            boxes = groups.get((row_index, column_index), [])
            if not boxes:
                raise ValueError(
                    f"No subject detected for row {row_index + 1}, column {column_index + 1}"
                )
            component_ids = [box[0] for box in boxes]
            left = max(0, min(box[1] for box in boxes) - source_padding)
            top = max(0, min(box[2] for box in boxes) - source_padding)
            right = min(sheet.width, max(box[3] for box in boxes) + source_padding)
            bottom = min(sheet.height, max(box[4] for box in boxes) + source_padding)
            crop_pixels = keyed_pixels[top:bottom, left:right].copy()
            assigned_pixels = np.isin(
                labels[top:bottom, left:right],
                component_ids,
            )
            crop_pixels[~assigned_pixels, 3] = 0
            cells.append(SheetCell(
                row=row_index + 1,
                column=column_index + 1,
                image=Image.fromarray(crop_pixels),
            ))
    return cells


def detect_ordered_row_subjects(
    sheet: Image.Image,
    *,
    row_counts: tuple[int, ...],
    source_padding: int = 32,
    minimum_component_pixels: int = 12,
    alpha_threshold: int = 8,
) -> list[SheetCell]:
    """Sort one complete connected component per subject within each expected row."""
    if not row_counts or any(type(count) is not int or count < 1 for count in row_counts):
        raise ValueError("Row counts must be positive integers")
    if sheet.width < max(row_counts) or sheet.height < len(row_counts):
        raise ValueError("Row layout is larger than the source sheet")
    if source_padding < 0:
        raise ValueError("source_padding must be non-negative")
    if minimum_component_pixels < 1:
        raise ValueError("minimum_component_pixels must be positive")

    keyed_sheet = key_chroma(sheet)
    alpha = np.asarray(keyed_sheet.getchannel("A"))
    binary = (alpha > alpha_threshold).astype(np.uint8)
    component_count, labels, stats, centroids = cv2.connectedComponentsWithStats(
        binary,
        connectivity=8,
    )
    rows: list[list[tuple[float, int, int, int, int, int]]] = [
        [] for _ in row_counts
    ]
    for component_index in range(1, component_count):
        left = int(stats[component_index, cv2.CC_STAT_LEFT])
        top = int(stats[component_index, cv2.CC_STAT_TOP])
        width = int(stats[component_index, cv2.CC_STAT_WIDTH])
        height = int(stats[component_index, cv2.CC_STAT_HEIGHT])
        area = int(stats[component_index, cv2.CC_STAT_AREA])
        if area < minimum_component_pixels:
            continue
        centre_x, centre_y = centroids[component_index]
        row_index = min(
            len(row_counts) - 1,
            max(0, int(centre_y * len(row_counts) / sheet.height)),
        )
        rows[row_index].append((
            float(centre_x),
            component_index,
            left,
            top,
            left + width,
            top + height,
        ))

    keyed_pixels = np.asarray(keyed_sheet).copy()
    cells: list[SheetCell] = []
    for row_index, (components, expected_count) in enumerate(zip(rows, row_counts, strict=True)):
        components.sort(key=lambda component: component[0])
        if len(components) != expected_count:
            raise ValueError(
                f"Expected {expected_count} complete subjects in row {row_index + 1}, "
                f"found {len(components)}"
            )
        for column_index, component in enumerate(components):
            _, component_id, box_left, box_top, box_right, box_bottom = component
            left = max(0, box_left - source_padding)
            top = max(0, box_top - source_padding)
            right = min(sheet.width, box_right + source_padding)
            bottom = min(sheet.height, box_bottom + source_padding)
            crop_pixels = keyed_pixels[top:bottom, left:right].copy()
            assigned_pixels = labels[top:bottom, left:right] == component_id
            crop_pixels[~assigned_pixels, 3] = 0
            cells.append(SheetCell(
                row=row_index + 1,
                column=column_index + 1,
                image=Image.fromarray(crop_pixels),
            ))
    return cells


def _clamp_channel(value: float) -> int:
    return max(0, min(255, round(value)))


def key_chroma(source: Image.Image, *, minimum_green_dominance: int = 16) -> Image.Image:
    """Remove #00ff00 while reconstructing neutral anti-aliased edge colours.

    Generated subjects are constrained to neutral white/grey/black art with no
    near-green pixels. For green-dominant pixels, foreground coverage is inferred
    from both red/blue contribution and green missing from the exact key colour.
    """
    if not 0 <= minimum_green_dominance <= 255:
        raise ValueError("minimum_green_dominance must be between 0 and 255")

    rgba = source.convert("RGBA")
    output: list[tuple[int, int, int, int]] = []
    for red, green, blue, alpha in rgba.getdata():
        if green >= 180 and red <= 64 and blue <= 64:
            output.append((0, 0, 0, 0))
            continue
        dominance = green - max(red, blue)
        if dominance < minimum_green_dominance:
            output.append((red, green, blue, alpha))
            continue

        coverage = max(max(red, blue) / 255.0, (255 - green) / 255.0)
        coverage = max(0.0, min(1.0, coverage))
        next_alpha = _clamp_channel(alpha * coverage)
        if next_alpha == 0 or coverage == 0:
            output.append((0, 0, 0, 0))
            continue

        key_share = 1.0 - coverage
        foreground_red = red / coverage
        foreground_green = (green - (key_share * 255.0)) / coverage
        foreground_blue = blue / coverage
        neutral = _clamp_channel(
            (foreground_red + foreground_green + foreground_blue) / 3.0
        )
        output.append((neutral, neutral, neutral, next_alpha))

    keyed = Image.new("RGBA", rgba.size)
    keyed.putdata(output)
    return keyed


def analyse_cell(
    keyed: Image.Image,
    *,
    safe_inset_ratio: float = 0.08,
    alpha_threshold: int = 8,
) -> CellReport:
    if not 0 <= safe_inset_ratio < 0.5:
        raise ValueError("safe_inset_ratio must be at least 0 and below 0.5")
    if not 0 <= alpha_threshold <= 255:
        raise ValueError("alpha_threshold must be between 0 and 255")

    alpha = keyed.convert("RGBA").getchannel("A")
    thresholded = alpha.point(lambda value: 255 if value > alpha_threshold else 0)
    bounding_box = thresholded.getbbox()
    opaque_pixel_count = sum(1 for value in alpha.getdata() if value > alpha_threshold)
    if bounding_box is None:
        return CellReport(None, opaque_pixel_count, 0, False, False)

    left, top, right, bottom = bounding_box
    inset_x = round(keyed.width * safe_inset_ratio)
    inset_y = round(keyed.height * safe_inset_ratio)
    edge_contact = left == 0 or top == 0 or right == keyed.width or bottom == keyed.height
    safe_inset_breach = (
        left < inset_x
        or top < inset_y
        or right > keyed.width - inset_x
        or bottom > keyed.height - inset_y
    )
    return CellReport(
        bounding_box=bounding_box,
        opaque_pixel_count=opaque_pixel_count,
        short_edge=min(right - left, bottom - top),
        edge_contact=edge_contact,
        safe_inset_breach=safe_inset_breach,
    )


def _ink_overlay(master: Image.Image) -> Image.Image:
    pixels: list[tuple[int, int, int, int]] = []
    for red, green, blue, alpha in master.convert("RGBA").getdata():
        luminance = (299 * red + 587 * green + 114 * blue) / 1000.0
        ink_alpha = _clamp_channel(alpha * (255.0 - luminance) / 255.0)
        pixels.append((red, green, blue, ink_alpha))
    overlay = Image.new("RGBA", master.size)
    overlay.putdata(pixels)
    return overlay


def prepare_cell(
    source: Image.Image,
    *,
    trim_padding: int = 8,
    safe_inset_ratio: float = 0.08,
) -> PreparedCell:
    if trim_padding < 0:
        raise ValueError("trim_padding must be non-negative")
    keyed = key_chroma(source)
    source_report = analyse_cell(keyed, safe_inset_ratio=safe_inset_ratio)
    if source_report.bounding_box is None:
        raise ValueError("Contact-sheet cell contains no subject")

    left, top, right, bottom = source_report.bounding_box
    subject = keyed.crop((left, top, right, bottom))
    minimum_safe_padding = math.ceil(
        max(subject.width, subject.height)
        * safe_inset_ratio
        / (1.0 - 2.0 * safe_inset_ratio)
    )
    padding = max(1, trim_padding, minimum_safe_padding + 1)
    master = Image.new(
        "RGBA",
        (subject.width + padding * 2, subject.height + padding * 2),
        (0, 0, 0, 0),
    )
    master.alpha_composite(subject, (padding, padding))
    report = analyse_cell(master, safe_inset_ratio=safe_inset_ratio)
    silhouette = master.getchannel("A")
    return PreparedCell(
        master=master,
        silhouette=silhouette,
        ink_overlay=_ink_overlay(master),
        report=report,
    )


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _require_slug(value: str, label: str) -> str:
    if not SLUG.fullmatch(value):
        raise ValueError(f"{label} must be a lowercase hyphenated ID")
    return value


def _metadata_record(
    *,
    asset_id: str,
    sheet_id: str,
    sheet_type: str,
    category: str,
    tags: Iterable[str],
    cell: SheetCell,
    prepared: PreparedCell,
) -> dict[str, object]:
    return {
        "schema": "generated-raster-template@1",
        "id": asset_id,
        "sheetId": sheet_id,
        "type": sheet_type,
        "category": category,
        "tags": sorted(set(tags)),
        "grid": {"row": cell.row, "column": cell.column},
        "dimensions": {"width": prepared.master.width, "height": prepared.master.height},
        "files": {
            "master": "master.png",
            "silhouetteMask": "silhouette-mask.png",
            "inkOverlay": "ink-overlay.png",
        },
        "qa": {
            "edgeContact": prepared.report.edge_contact,
            "safeInsetBreach": prepared.report.safe_inset_breach,
            "opaquePixelCount": prepared.report.opaque_pixel_count,
            "shortEdge": prepared.report.short_edge,
        },
    }


def extract_sheet(args: argparse.Namespace) -> dict[str, object]:
    sheet_path = Path(args.sheet).resolve()
    output_root = Path(args.output).resolve()
    sheet_id = _require_slug(args.sheet_id, "sheet-id")
    category = _require_slug(args.category, "category")
    sheet_type = args.sheet_type
    if sheet_type not in {"base", "add-on", "scene", "placement-frame"}:
        raise ValueError("sheet-type is invalid")
    if not sheet_path.is_file():
        raise FileNotFoundError(f"Source sheet does not exist: {sheet_path}")

    target = output_root / sheet_id
    if target.exists():
        raise FileExistsError(f"Refusing to overwrite existing extraction: {target}")

    with Image.open(sheet_path) as opened:
        source = opened.convert("RGBA")
    row_counts = args.row_counts
    if row_counts is not None:
        if args.fixed_grid:
            raise ValueError("row-counts cannot be combined with fixed-grid")
        if len(row_counts) != args.rows or max(row_counts) != args.columns:
            raise ValueError("row-counts must match rows and the maximum column count")
        detector = (
            detect_ordered_row_subjects
            if args.ordered_row_components
            else detect_row_layout_subjects
        )
        cells = detector(
            source,
            row_counts=row_counts,
            source_padding=args.detection_padding,
            minimum_component_pixels=args.minimum_component_pixels,
        )
    elif args.ordered_row_components:
        raise ValueError("ordered-row-components requires row-counts")
    elif args.fixed_grid:
        cells = split_sheet(source, columns=args.columns, rows=args.rows)
    else:
        cells = detect_grid_subjects(
            source,
            columns=args.columns,
            rows=args.rows,
            source_padding=args.detection_padding,
            minimum_component_pixels=args.minimum_component_pixels,
        )
    prepared_cells = [
        (cell, prepare_cell(
            cell.image,
            trim_padding=args.trim_padding,
            safe_inset_ratio=args.safe_inset_ratio,
        ))
        for cell in cells
    ]

    records: list[dict[str, object]] = []
    assets_root = target / "assets"
    assets_root.mkdir(parents=True, exist_ok=False)
    for cell, prepared in prepared_cells:
        asset_id = f"{sheet_id}-r{cell.row:02d}c{cell.column:02d}"
        asset_root = assets_root / asset_id
        asset_root.mkdir()
        prepared.master.save(asset_root / "master.png", format="PNG", optimize=True)
        prepared.silhouette.save(asset_root / "silhouette-mask.png", format="PNG", optimize=True)
        prepared.ink_overlay.save(asset_root / "ink-overlay.png", format="PNG", optimize=True)
        record = _metadata_record(
            asset_id=asset_id,
            sheet_id=sheet_id,
            sheet_type=sheet_type,
            category=category,
            tags=args.tag,
            cell=cell,
            prepared=prepared,
        )
        (asset_root / "metadata.json").write_text(
            json.dumps(record, indent=2) + "\n",
            encoding="utf-8",
        )
        records.append(record)

    report = {
        "schema": "generated-raster-sheet@1",
        "sheetId": sheet_id,
        "source": str(sheet_path),
        "sourceSha256": _sha256(sheet_path),
        "type": sheet_type,
        "category": category,
        "grid": {"columns": args.columns, "rows": args.rows},
        "extractionMode": (
            "detected-ordered-row-components"
            if row_counts is not None and args.ordered_row_components
            else "detected-row-layout" if row_counts is not None
            else "fixed-grid" if args.fixed_grid else "detected-subjects"
        ),
        "assetCount": len(records),
        "edgeContactCount": sum(
            1 for record in records if bool(record["qa"]["edgeContact"])  # type: ignore[index]
        ),
        "safeInsetBreachCount": sum(
            1 for record in records if bool(record["qa"]["safeInsetBreach"])  # type: ignore[index]
        ),
        "assets": records,
    }
    if row_counts is not None:
        report["rowCounts"] = list(row_counts)
    (target / "sheet-report.json").write_text(
        json.dumps(report, indent=2) + "\n",
        encoding="utf-8",
    )
    return report


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        description="Split an exact-grid chroma contact sheet into additive raster template layers.",
    )
    result.add_argument("--sheet", required=True)
    result.add_argument("--output", required=True)
    result.add_argument("--sheet-id", required=True)
    result.add_argument("--sheet-type", required=True)
    result.add_argument("--category", required=True)
    result.add_argument("--columns", type=int, default=5)
    result.add_argument("--rows", type=int, default=5)
    result.add_argument(
        "--row-counts",
        type=lambda value: tuple(int(part) for part in value.split(",")),
        help="Comma-separated occupied slots per row for an approved irregular layout.",
    )
    result.add_argument("--trim-padding", type=int, default=8)
    result.add_argument("--safe-inset-ratio", type=float, default=0.08)
    result.add_argument("--detection-padding", type=int, default=32)
    result.add_argument("--minimum-component-pixels", type=int, default=12)
    result.add_argument("--fixed-grid", action="store_true")
    result.add_argument(
        "--ordered-row-components",
        action="store_true",
        help="Require and sort one complete connected component per occupied row slot.",
    )
    result.add_argument("--tag", action="append", default=[])
    return result


def main() -> int:
    args = parser().parse_args()
    report = extract_sheet(args)
    print(json.dumps({
        "sheetId": report["sheetId"],
        "assetCount": report["assetCount"],
        "edgeContactCount": report["edgeContactCount"],
        "safeInsetBreachCount": report["safeInsetBreachCount"],
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
