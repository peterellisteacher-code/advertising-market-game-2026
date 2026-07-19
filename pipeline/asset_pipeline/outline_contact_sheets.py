"""Build dense vector contact sheets from editable product-shell SVGs."""

from __future__ import annotations

import argparse
from copy import deepcopy
import json
from pathlib import Path
import xml.etree.ElementTree as ET


SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
DRAWABLE = {"circle", "ellipse", "line", "path", "polygon", "polyline", "rect"}
REGION_FILLS = {
    "body": "#FFFDF8",
    "trim": "#E8EEF5",
    "accent": "#F8E9E5",
    "label": "#FFFFFF",
}
SHEET_WIDTH = 5000
SHEET_HEIGHT = 2700
GRID_COLUMNS = 10
GRID_ROWS = 5
CELL_WIDTH = 500
CELL_HEIGHT = 500
GRID_TOP = 150


class OutlineContactSheetError(ValueError):
    """Raised when an outline contact sheet cannot be built safely."""


def _svg(tag: str) -> str:
    return f"{{{SVG_NS}}}{tag}"


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _style_region(group: ET.Element, region: str) -> ET.Element:
    clone = deepcopy(group)
    clone.attrib.pop("fill", None)
    clone.attrib.pop("color", None)
    fill = REGION_FILLS.get(region, "#FFFDF8")
    for element in clone.iter():
        if _local_name(element.tag) not in DRAWABLE:
            continue
        original_fill = element.get("fill")
        element.set("fill", "none" if original_fill == "none" else fill)
        element.set("stroke", "#24313D")
        element.set("stroke-width", "10")
        element.set("stroke-linecap", "round")
        element.set("stroke-linejoin", "round")
        element.set("vector-effect", "non-scaling-stroke")
        element.attrib.pop("color", None)
        element.attrib.pop("stroke-dasharray", None)
    return clone


def _outline_parts(svg_path: Path) -> tuple[list[ET.Element], ET.Element | None]:
    try:
        source_root = ET.parse(svg_path).getroot()
    except (ET.ParseError, OSError) as error:
        raise OutlineContactSheetError(f"Could not read product shell {svg_path}") from error
    regions: list[ET.Element] = []
    print_area: ET.Element | None = None
    for element in source_root.iter():
        region = element.get("data-region")
        if region:
            regions.append(_style_region(element, region))
        if print_area is None and element.get("data-print-area"):
            print_area = deepcopy(element)
            print_area.set("fill", "none")
            print_area.set("stroke", "#2E6AE6")
            print_area.set("stroke-width", "8")
            print_area.set("stroke-dasharray", "20 14")
            print_area.set("stroke-linecap", "round")
            print_area.set("vector-effect", "non-scaling-stroke")
    if not regions:
        raise OutlineContactSheetError(f"Product shell has no semantic regions: {svg_path}")
    return regions, print_area


def _add_text(parent: ET.Element, x: float, y: float, value: str, **attributes: str) -> None:
    element = ET.SubElement(parent, _svg("text"), {"x": str(x), "y": str(y), **attributes})
    element.text = value


def _build_sheet(pack: Path, records: list[dict[str, object]], sheet_index: int) -> ET.Element:
    root = ET.Element(
        _svg("svg"),
        {
            "viewBox": f"0 0 {SHEET_WIDTH} {SHEET_HEIGHT}",
            "width": str(SHEET_WIDTH),
            "height": str(SHEET_HEIGHT),
            "role": "img",
            "aria-label": f"Bare outline product templates sheet {sheet_index}",
        },
    )
    ET.SubElement(root, _svg("rect"), {
        "width": str(SHEET_WIDTH),
        "height": str(SHEET_HEIGHT),
        "fill": "#F3EFE7",
    })
    _add_text(
        root,
        70,
        92,
        f"Bare outline product templates · Sheet {sheet_index:02d} · {len(records)} designs",
        fill="#24313D",
        **{"font-family": "system-ui, sans-serif", "font-size": "46", "font-weight": "800"},
    )
    _add_text(
        root,
        4930,
        92,
        "white space = student design space · blue dash = suggested branding zone",
        fill="#52606D",
        **{
            "font-family": "system-ui, sans-serif",
            "font-size": "24",
            "text-anchor": "end",
        },
    )

    for index, record in enumerate(records):
        shell_id = record.get("id")
        title = record.get("title")
        authoring = record.get("authoringSvg")
        if not isinstance(shell_id, str) or not isinstance(title, str) or not isinstance(authoring, str):
            raise OutlineContactSheetError(f"Product shell record {index} is incomplete")
        if ".." in authoring or authoring.startswith(("/", "\\")):
            raise OutlineContactSheetError(f"Product shell {shell_id} has a non-local authoring path")
        regions, print_area = _outline_parts(pack / Path(authoring))
        column = index % GRID_COLUMNS
        row = index // GRID_COLUMNS
        x = column * CELL_WIDTH
        y = GRID_TOP + row * CELL_HEIGHT
        item = ET.SubElement(root, _svg("g"), {
            "data-contact-item": shell_id,
            "transform": f"translate({x} {y})",
        })
        ET.SubElement(item, _svg("rect"), {
            "x": "16",
            "y": "12",
            "width": "468",
            "height": "472",
            "rx": "28",
            "fill": "#FFFFFF",
            "stroke": "#D5CEC1",
            "stroke-width": "3",
        })
        art = ET.SubElement(item, _svg("g"), {"transform": "translate(60 32) scale(.38)"})
        for region in regions:
            art.append(region)
        if print_area is not None:
            art.append(print_area)
        _add_text(
            item,
            250,
            448,
            f"{sheet_index:02d}.{index + 1:02d}  {title}",
            fill="#24313D",
            **{
                "font-family": "system-ui, sans-serif",
                "font-size": "22",
                "font-weight": "700",
                "text-anchor": "middle",
            },
        )
    return root


def build_outline_contact_sheets(
    pack: Path,
    output: Path,
    *,
    per_sheet: int = 50,
) -> list[Path]:
    """Build 10-by-5 outline SVG sheets without changing the source pack."""
    if per_sheet < 1 or per_sheet > GRID_COLUMNS * GRID_ROWS:
        raise OutlineContactSheetError("per_sheet must be between 1 and 50")
    try:
        catalogue = json.loads((pack / "catalog.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise OutlineContactSheetError("Product shell catalogue is missing or malformed") from error
    records = catalogue.get("shells") if isinstance(catalogue, dict) else None
    if not isinstance(records, list) or not records:
        raise OutlineContactSheetError("Product shell catalogue has no shells")
    output.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for offset in range(0, len(records), per_sheet):
        sheet_index = len(paths) + 1
        root = _build_sheet(pack, records[offset : offset + per_sheet], sheet_index)
        path = output / f"outline-sheet-{sheet_index:02d}.svg"
        ET.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True)
        paths.append(path)
    return paths


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pack", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--per-sheet", type=int, default=50)
    arguments = parser.parse_args()
    outputs = build_outline_contact_sheets(
        arguments.pack,
        arguments.output,
        per_sheet=arguments.per_sheet,
    )
    for path in outputs:
        print(path)


if __name__ == "__main__":
    main()
