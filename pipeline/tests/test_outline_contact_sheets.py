from __future__ import annotations

import json
import xml.etree.ElementTree as ET
from pathlib import Path

from asset_pipeline.outline_contact_sheets import build_outline_contact_sheets


def test_builds_fifty_item_vector_sheets_with_bare_recoloured_outlines(tmp_path: Path) -> None:
    pack = tmp_path / "pack"
    shells = []
    for index in range(51):
        shell_id = f"fixture-{index:02d}"
        directory = pack / "shells" / shell_id
        directory.mkdir(parents=True)
        (directory / "authoring.svg").write_text(
            f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
              <g data-region="body" fill="#E66B3F"><rect x="200" y="100" width="600" height="800"/></g>
              <rect data-print-area="front" x="300" y="300" width="400" height="400"
                fill="none" stroke="#2E6AE6"/>
            </svg>''',
            encoding="utf-8",
        )
        shells.append(
            {
                "id": shell_id,
                "title": f"Fixture {index:02d}",
                "family": "drinks-snacks",
                "authoringSvg": f"shells/{shell_id}/authoring.svg",
            }
        )
    (pack / "catalog.json").write_text(
        json.dumps({"schema": "product-shell-catalog@1", "shells": shells}),
        encoding="utf-8",
    )

    outputs = build_outline_contact_sheets(pack, tmp_path / "reports", per_sheet=50)

    assert [path.name for path in outputs] == ["outline-sheet-01.svg", "outline-sheet-02.svg"]
    first_text = outputs[0].read_text(encoding="utf-8")
    first = ET.parse(outputs[0]).getroot()
    items = first.findall(".//*[@data-contact-item]")
    assert len(items) == 50
    assert "#E66B3F" not in first_text
    assert "#24313D" in first_text
    assert "#2E6AE6" in first_text
    assert first.get("viewBox") == "0 0 5000 2700"
