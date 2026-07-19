from __future__ import annotations

import argparse
import json
import re
import textwrap
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


CELL_WIDTH = 280
CELL_HEIGHT = 280
COLUMNS = 6
HEADER_HEIGHT = 86
THUMBNAIL_SIZE = 192


def _read_catalog(path: Path) -> list[dict[str, object]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list) or not all(isinstance(item, dict) for item in payload):
        raise ValueError(f"catalog must be an array of objects: {path}")
    return payload


def _source_stem(asset_id: str) -> str:
    return re.sub(r"-r\d+c\d+$", "", asset_id)


def _safe_filename(value: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", value.lower()).strip("-")


def build_contact_sheets(
    current_catalog: Path,
    staged_catalog: Path,
    staged_root: Path,
    output_dir: Path,
) -> dict[str, object]:
    if output_dir.exists() and any(output_dir.iterdir()):
        raise ValueError(f"output directory must be absent or empty: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)

    current_ids = {str(record["id"]) for record in _read_catalog(current_catalog)}
    added = [record for record in _read_catalog(staged_catalog) if str(record["id"]) not in current_ids]
    grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
    for record in added:
        grouped[_source_stem(str(record["id"]))].append(record)

    font = ImageFont.load_default(size=16)
    small_font = ImageFont.load_default(size=13)
    manifest_groups: list[dict[str, object]] = []

    for group_index, (stem, records) in enumerate(sorted(grouped.items()), start=1):
        records.sort(key=lambda item: str(item["id"]))
        rows = (len(records) + COLUMNS - 1) // COLUMNS
        canvas = Image.new(
            "RGB",
            (CELL_WIDTH * COLUMNS, HEADER_HEIGHT + CELL_HEIGHT * rows),
            "#F7F2E8",
        )
        draw = ImageDraw.Draw(canvas)
        draw.rectangle((0, 0, canvas.width, HEADER_HEIGHT), fill="#10253F")
        draw.text((24, 18), stem, fill="#FFFFFF", font=font)
        draw.text(
            (24, 48),
            f"{len(records)} newly staged raster assets · visual audit sheet",
            fill="#AEE7F5",
            font=small_font,
        )

        manifest_assets: list[dict[str, object]] = []
        for index, record in enumerate(records):
            asset_id = str(record["id"])
            title = str(record.get("title", ""))
            row, column = divmod(index, COLUMNS)
            left = column * CELL_WIDTH
            top = HEADER_HEIGHT + row * CELL_HEIGHT
            draw.rounded_rectangle(
                (left + 7, top + 7, left + CELL_WIDTH - 7, top + CELL_HEIGHT - 7),
                radius=14,
                fill="#FFFFFF",
                outline="#D4CDBF",
                width=2,
            )

            thumb_path = staged_root / "assets" / asset_id / "thumbnail-192.webp"
            if not thumb_path.is_file():
                raise FileNotFoundError(thumb_path)
            with Image.open(thumb_path) as thumb:
                rgba = thumb.convert("RGBA")
                rgba.thumbnail((THUMBNAIL_SIZE, THUMBNAIL_SIZE), Image.Resampling.LANCZOS)
                image_left = left + (CELL_WIDTH - rgba.width) // 2
                image_top = top + 16 + (THUMBNAIL_SIZE - rgba.height) // 2
                canvas.paste(rgba, (image_left, image_top), rgba)

            text_top = top + 214
            draw.text((left + 16, text_top), asset_id, fill="#17324D", font=small_font)
            for line_index, line in enumerate(textwrap.wrap(title, width=31)[:2]):
                draw.text(
                    (left + 16, text_top + 20 + line_index * 17),
                    line,
                    fill="#2F2F2F",
                    font=small_font,
                )
            manifest_assets.append(
                {
                    "id": asset_id,
                    "masterSha256": record.get("masterSha256"),
                    "title": title,
                }
            )

        filename = f"{group_index:02d}-{_safe_filename(stem)}.png"
        canvas.save(output_dir / filename, format="PNG", optimize=True)
        manifest_groups.append(
            {
                "assetCount": len(records),
                "assets": manifest_assets,
                "contactSheet": filename,
                "sourceStem": stem,
            }
        )

    manifest: dict[str, object] = {
        "addedAssetCount": len(added),
        "groupCount": len(manifest_groups),
        "groups": manifest_groups,
    }
    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--current-catalog", type=Path, required=True)
    parser.add_argument("--staged-catalog", type=Path, required=True)
    parser.add_argument("--staged-root", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    manifest = build_contact_sheets(
        args.current_catalog,
        args.staged_catalog,
        args.staged_root,
        args.out,
    )
    print(
        f"Built {manifest['groupCount']} contact sheets for "
        f"{manifest['addedAssetCount']} added assets"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
