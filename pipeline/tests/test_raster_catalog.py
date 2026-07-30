from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

from asset_pipeline import raster_catalog as raster_catalog_module
from asset_pipeline.raster_catalog import RasterCatalogError, build_raster_catalog
from asset_pipeline.schema import CatalogAsset
from conftest import tree_digest


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _make_reviewed_sheet(
    extracted_root: Path,
    source_png: Path,
    *,
    review: int,
    body_colour: tuple[int, int, int, int],
    columns: int = 5,
    rows: int = 5,
    row_counts: tuple[int, ...] | None = None,
) -> Path:
    sheet_id = f"23-sofa-forms-reviewed-v{review}"
    sheet = extracted_root / sheet_id
    assets: list[dict[str, object]] = []
    counts = row_counts or (columns,) * rows
    for row, row_count in enumerate(counts, start=1):
        for column in range(1, row_count + 1):
            extracted_id = f"{sheet_id}-r{row:02}c{column:02}"
            asset_dir = sheet / "assets" / extracted_id
            asset_dir.mkdir(parents=True)
            master = Image.new("RGBA", (32, 24), (0, 0, 0, 0))
            draw = ImageDraw.Draw(master)
            draw.rounded_rectangle((4, 4, 27, 19), radius=3, fill=body_colour, outline="#202830", width=2)
            master.save(asset_dir / "master.png")
            silhouette = master.getchannel("A")
            silhouette.save(asset_dir / "silhouette-mask.png")
            ink = Image.new("RGBA", master.size, (0, 0, 0, 0))
            ImageDraw.Draw(ink).rounded_rectangle((4, 4, 27, 19), radius=3, outline="#202830", width=2)
            ink.save(asset_dir / "ink-overlay.png")
            metadata = {
                "schema": "generated-raster-template@1",
                "id": extracted_id,
                "sheetId": sheet_id,
                "type": "base",
                "category": "sofas",
                "tags": ["furniture", "sofa"],
                "grid": {"row": row, "column": column},
                "dimensions": {"width": 32, "height": 24},
                "files": {
                    "master": "master.png",
                    "silhouetteMask": "silhouette-mask.png",
                    "inkOverlay": "ink-overlay.png",
                },
                "qa": {
                    "edgeContact": False,
                    "safeInsetBreach": False,
                    "opaquePixelCount": 300,
                    "shortEdge": 16,
                },
            }
            _write_json(asset_dir / "metadata.json", metadata)
            assets.append(metadata)
    report = {
        "schema": "generated-raster-sheet@1",
        "sheetId": sheet_id,
        "source": str(source_png),
        "sourceSha256": hashlib.sha256(source_png.read_bytes()).hexdigest(),
        "type": "base",
        "category": "sofas",
        "grid": {"columns": columns, "rows": rows},
        "extractionMode": "detected-subjects",
        "assetCount": sum(counts),
        "edgeContactCount": 0,
        "safeInsetBreachCount": 0,
        "assets": assets,
    }
    if row_counts is not None:
        report["rowCounts"] = list(row_counts)
    _write_json(sheet / "sheet-report.json", report)
    return sheet


def _make_fixture(
    tmp_path: Path,
    *,
    nested_tiles: bool = False,
    columns: int = 5,
    rows: int = 5,
    row_counts: tuple[int, ...] | None = None,
) -> tuple[Path, Path]:
    source_root = tmp_path / "source"
    source_directory = source_root / "tiles" if nested_tiles else source_root
    source_png = source_directory / "23-sofa-forms.png"
    source_png.parent.mkdir(parents=True)
    Image.new("RGB", (100, 100), "#00ff00").save(source_png)
    _write_json(source_directory / "23-sofa-forms.inventory.json", {
        "schema": "contact-sheet-inventory@1",
        "sheetNumber": 23,
        "sourcePng": "23-sofa-forms.png",
        "items": [
            {
                "row": row,
                "column": column,
                "label": f"Modular sofa form {row}-{column}",
                "tags": ["modular", "seat", "sofa"],
            }
            for row, row_count in enumerate(row_counts or (columns,) * rows, start=1)
            for column in range(1, row_count + 1)
        ],
    })
    _write_json(source_root / "raster-production-pricing-rules.json", {
        "schema": "raster-production-pricing-rules@1",
        "packId": "offline-core-v1",
        "pricingVersion": 1,
        "categoryRoleCosts": {
            "sofas": {
                "base": 3_200,
            }
        },
        "assetOverrides": {},
    })
    extracted_root = tmp_path / "extracted"
    _make_reviewed_sheet(
        extracted_root,
        source_png,
        review=1,
        body_colour=(220, 80, 80, 255),
        columns=columns,
        rows=rows,
        row_counts=row_counts,
    )
    _make_reviewed_sheet(
        extracted_root,
        source_png,
        review=2,
        body_colour=(255, 255, 255, 255),
        columns=columns,
        rows=rows,
        row_counts=row_counts,
    )
    return extracted_root, source_root


def _inventory_path(inventory_root: Path) -> Path:
    direct = inventory_root / "23-sofa-forms.inventory.json"
    return direct if direct.is_file() else inventory_root / "tiles" / direct.name


def _set_master_override(inventory_root: Path, value: object) -> None:
    inventory_path = _inventory_path(inventory_root)
    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
    inventory["items"][0]["masterOverride"] = value
    _write_json(inventory_path, inventory)


def _make_override(
    inventory_root: Path,
    *,
    relative_path: str = "corrections/23-sofa-forms-r01c01-v2.png",
) -> tuple[Path, str]:
    override_path = inventory_root.joinpath(*relative_path.split("/"))
    override_path.parent.mkdir(parents=True, exist_ok=True)
    override = Image.new("RGBA", (40, 30), (0, 0, 0, 0))
    ImageDraw.Draw(override).ellipse((5, 4, 34, 25), fill=(40, 120, 220, 220))
    override.save(override_path, format="PNG")
    source_sha256 = hashlib.sha256(override_path.read_bytes()).hexdigest()
    _set_master_override(
        inventory_root,
        {"path": relative_path, "sha256": source_sha256},
    )
    return override_path, source_sha256


def test_builds_latest_reviewed_cells_as_individual_searchable_raster_assets(tmp_path: Path) -> None:
    extracted, inventory = _make_fixture(tmp_path)
    output = tmp_path / "catalog" / "generated" / "offline-core-v1"
    report = tmp_path / "catalog" / "reports" / "raster-core"

    records = build_raster_catalog(extracted, inventory, output, report)

    assert len(records) == 25
    assert records[0].id == "23-sofa-forms-r01c01"
    assert records[0].title == "Modular sofa form 1-1"
    assert records[0].kind == "raster-master"
    assert records[0].tags == ["base", "furniture", "modular", "seat", "sofa"]
    assert records[0].recolour_zones == ["body"]
    assert records[0].files.masks == {
        "body": "/catalog/generated/offline-core-v1/assets/23-sofa-forms-r01c01/masks/body.png"
    }
    assert all(record.classroom_reviewed and record.brand_free for record in records)
    assert all(
        CatalogAsset.model_validate(
            record.model_dump(by_alias=True, exclude_none=True),
            strict=True,
        )
        for record in records
    )

    asset_dir = output / "assets" / records[0].id
    assert {path.name for path in asset_dir.iterdir()} == {
        "master.png", "thumbnail-192.webp", "preview-640.webp", "masks"
    }
    with Image.open(asset_dir / "master.png") as master:
        assert master.getpixel((10, 10))[:3] == (255, 255, 255)
    with Image.open(asset_dir / "masks" / "body.png") as mask:
        assert mask.size == (32, 24)
        assert mask.getchannel("A").getbbox() is not None

    payload = json.loads((output / "catalog.json").read_text(encoding="utf-8"))
    assert payload == [record.model_dump(by_alias=True, exclude_none=True) for record in records]
    pricing = json.loads((output / "pricing.json").read_text(encoding="utf-8"))
    assert pricing["schema"] == "raster-production-pricing@1"
    assert pricing["catalogSha256"] == hashlib.sha256((output / "catalog.json").read_bytes()).hexdigest()
    assert len(pricing["entries"]) == 25
    assert pricing["entries"][0] == {
        "assetId": "23-sofa-forms-r01c01", "costCents": 3_200, "role": "base"
    }
    qa = json.loads((report / "qa.json").read_text(encoding="utf-8"))
    assert qa == {"assets": 25, "baseMasters": 25, "categories": 1, "errors": []}
    provenance = json.loads((report / "source-selection.json").read_text(encoding="utf-8"))
    assert provenance[0]["selectedReview"] == 2
    assert provenance[0]["ignoredOlderReviews"] == [1]


def test_build_is_deterministic_across_unrelated_roots(tmp_path: Path) -> None:
    first_extracted, first_inventory = _make_fixture(tmp_path / "first")
    second_extracted, second_inventory = _make_fixture(tmp_path / "elsewhere" / "second")
    first_out = tmp_path / "first" / "catalog" / "generated" / "offline-core-v1"
    first_report = tmp_path / "first" / "catalog" / "reports" / "raster-core"
    second_out = tmp_path / "elsewhere" / "second" / "catalog" / "generated" / "offline-core-v1"
    second_report = tmp_path / "elsewhere" / "second" / "catalog" / "reports" / "raster-core"

    build_raster_catalog(first_extracted, first_inventory, first_out, first_report)
    build_raster_catalog(second_extracted, second_inventory, second_out, second_report)

    assert tree_digest(first_out) == tree_digest(second_out)
    assert tree_digest(first_report) == tree_digest(second_report)


def test_master_override_changes_only_its_selected_master_and_alpha_mask(tmp_path: Path) -> None:
    baseline_extracted, baseline_inventory = _make_fixture(tmp_path / "baseline")
    override_extracted, override_inventory = _make_fixture(tmp_path / "override")
    _, source_sha256 = _make_override(override_inventory)
    baseline_out, baseline_report = tmp_path / "baseline-out", tmp_path / "baseline-report"
    override_out, override_report = tmp_path / "override-out", tmp_path / "override-report"

    baseline_records = build_raster_catalog(
        baseline_extracted, baseline_inventory, baseline_out, baseline_report
    )
    override_records = build_raster_catalog(
        override_extracted, override_inventory, override_out, override_report
    )

    baseline_by_id = {record.id: record for record in baseline_records}
    override_by_id = {record.id: record for record in override_records}
    asset_id = "23-sofa-forms-r01c01"
    assert override_by_id[asset_id].dimensions.width == 40
    assert override_by_id[asset_id].dimensions.height == 30
    assert override_by_id[asset_id].master_sha256 != baseline_by_id[asset_id].master_sha256
    override_asset_dir = override_out / "assets" / asset_id
    assert override_by_id[asset_id].master_sha256 == hashlib.sha256(
        (override_asset_dir / "master.png").read_bytes()
    ).hexdigest()
    with Image.open(override_asset_dir / "master.png") as master, Image.open(
        override_asset_dir / "masks" / "body.png"
    ) as mask:
        assert mask.size == master.size == (40, 30)
        assert mask.getchannel("A").tobytes() == master.getchannel("A").tobytes()

    for other_id in sorted(set(baseline_by_id) - {asset_id}):
        assert override_by_id[other_id].model_dump() == baseline_by_id[other_id].model_dump()
        assert tree_digest(override_out / "assets" / other_id) == tree_digest(
            baseline_out / "assets" / other_id
        )

    provenance = json.loads(
        (override_report / "source-selection.json").read_text(encoding="utf-8")
    )
    assert provenance[0]["masterOverrides"] == [{
        "assetId": asset_id,
        "path": "corrections/23-sofa-forms-r01c01-v2.png",
        "sourceSha256": source_sha256,
    }]
    assert str(tmp_path) not in (override_report / "source-selection.json").read_text(
        encoding="utf-8"
    )


@pytest.mark.parametrize(
    ("value", "message"),
    [
        (None, "must be an object"),
        ({}, "exactly path and sha256"),
        ({"path": "corrections/fix.png"}, "exactly path and sha256"),
        ({"sha256": "a" * 64}, "exactly path and sha256"),
        (
            {"path": "corrections/fix.png", "sha256": "a" * 64, "note": "no"},
            "exactly path and sha256",
        ),
        ({"path": "corrections/fix.png", "sha256": "A" * 64}, "lowercase SHA-256"),
        ({"path": "corrections/fix.png", "sha256": "a" * 63}, "lowercase SHA-256"),
    ],
)
def test_rejects_malformed_master_override_before_writing(
    tmp_path: Path,
    value: object,
    message: str,
) -> None:
    extracted, inventory = _make_fixture(tmp_path)
    _set_master_override(inventory, value)
    output, report = tmp_path / "out", tmp_path / "report"

    with pytest.raises(RasterCatalogError, match=message):
        build_raster_catalog(extracted, inventory, output, report)

    assert not output.exists()
    assert not report.exists()


@pytest.mark.parametrize(
    "relative_path",
    [
        "",
        "/absolute/fix.png",
        "C:/absolute/fix.png",
        "corrections\\fix.png",
        "corrections/../fix.png",
        "corrections/./fix.png",
        "corrections//fix.png",
        "corrections/fix.jpg",
    ],
)
def test_rejects_unsafe_master_override_path_before_writing(
    tmp_path: Path,
    relative_path: str,
) -> None:
    extracted, inventory = _make_fixture(tmp_path)
    _set_master_override(
        inventory,
        {"path": relative_path, "sha256": "a" * 64},
    )
    output, report = tmp_path / "out", tmp_path / "report"

    with pytest.raises(RasterCatalogError, match="safe slash-relative PNG path"):
        build_raster_catalog(extracted, inventory, output, report)

    assert not output.exists()
    assert not report.exists()


def test_rejects_unknown_inventory_item_key_before_writing(tmp_path: Path) -> None:
    extracted, inventory = _make_fixture(tmp_path)
    inventory_path = _inventory_path(inventory)
    value = json.loads(inventory_path.read_text(encoding="utf-8"))
    value["items"][0]["unexpected"] = True
    _write_json(inventory_path, value)
    output, report = tmp_path / "out", tmp_path / "report"

    with pytest.raises(RasterCatalogError, match="inventory item 1.*malformed"):
        build_raster_catalog(extracted, inventory, output, report)

    assert not output.exists()
    assert not report.exists()


def test_rejects_missing_or_hash_mismatched_master_override_before_writing(tmp_path: Path) -> None:
    extracted, inventory = _make_fixture(tmp_path / "missing")
    _set_master_override(
        inventory,
        {"path": "corrections/missing-v2.png", "sha256": "a" * 64},
    )
    missing_out, missing_report = tmp_path / "missing-out", tmp_path / "missing-report"
    with pytest.raises(RasterCatalogError, match="missing or unsafe"):
        build_raster_catalog(extracted, inventory, missing_out, missing_report)
    assert not missing_out.exists()
    assert not missing_report.exists()

    extracted, inventory = _make_fixture(tmp_path / "mismatch")
    override_path, _ = _make_override(inventory)
    override_path.write_bytes(override_path.read_bytes() + b"changed")
    mismatch_out, mismatch_report = tmp_path / "mismatch-out", tmp_path / "mismatch-report"
    with pytest.raises(RasterCatalogError, match="hash does not match"):
        build_raster_catalog(extracted, inventory, mismatch_out, mismatch_report)
    assert not mismatch_out.exists()
    assert not mismatch_report.exists()


def test_rejects_invalid_override_png_before_writing(tmp_path: Path) -> None:
    extracted, inventory = _make_fixture(tmp_path)
    relative_path = "corrections/invalid-v2.png"
    override_path = inventory / "corrections" / "invalid-v2.png"
    override_path.parent.mkdir(parents=True)
    override_path.write_bytes(b"not a PNG")
    _set_master_override(inventory, {
        "path": relative_path,
        "sha256": hashlib.sha256(override_path.read_bytes()).hexdigest(),
    })
    output, report = tmp_path / "out", tmp_path / "report"

    with pytest.raises(RasterCatalogError, match="valid raster master"):
        build_raster_catalog(extracted, inventory, output, report)

    assert not output.exists()
    assert not report.exists()


@pytest.mark.parametrize("reparse_part", ["corrections", "23-sofa-forms-r01c01-v2.png"])
def test_rejects_master_override_reparse_component_before_writing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    reparse_part: str,
) -> None:
    extracted, inventory = _make_fixture(tmp_path)
    override_path, _ = _make_override(inventory)
    original = raster_catalog_module._is_reparse_point
    monkeypatch.setattr(
        raster_catalog_module,
        "_is_reparse_point",
        lambda path: path.name == reparse_part or original(path),
    )
    output, report = tmp_path / "out", tmp_path / "report"

    with pytest.raises(RasterCatalogError, match="symlink or reparse point"):
        build_raster_catalog(extracted, inventory, output, report)

    assert override_path.is_file()
    assert not output.exists()
    assert not report.exists()


def test_master_override_does_not_bypass_reviewed_layer_validation(tmp_path: Path) -> None:
    extracted, inventory = _make_fixture(tmp_path)
    _make_override(inventory)
    reviewed_asset = (
        extracted
        / "23-sofa-forms-reviewed-v2"
        / "assets"
        / "23-sofa-forms-reviewed-v2-r01c01"
    )
    (reviewed_asset / "ink-overlay.png").unlink()
    output, report = tmp_path / "out", tmp_path / "report"

    with pytest.raises(RasterCatalogError, match="missing a safe raster layer"):
        build_raster_catalog(extracted, inventory, output, report)

    assert not output.exists()
    assert not report.exists()


def test_master_override_build_is_deterministic_across_unrelated_roots(tmp_path: Path) -> None:
    first_extracted, first_inventory = _make_fixture(tmp_path / "first")
    second_extracted, second_inventory = _make_fixture(tmp_path / "elsewhere" / "second")
    _make_override(first_inventory)
    _make_override(second_inventory)
    first_out, first_report = tmp_path / "first-out", tmp_path / "first-report"
    second_out, second_report = tmp_path / "second-out", tmp_path / "second-report"

    build_raster_catalog(first_extracted, first_inventory, first_out, first_report)
    build_raster_catalog(second_extracted, second_inventory, second_out, second_report)

    assert tree_digest(first_out) == tree_digest(second_out)
    assert tree_digest(first_report) == tree_digest(second_report)


def test_accepts_the_reviewed_tiles_subdirectory_without_relaxing_the_source_boundary(tmp_path: Path) -> None:
    extracted, inventory = _make_fixture(tmp_path, nested_tiles=True)

    records = build_raster_catalog(extracted, inventory, tmp_path / "out", tmp_path / "report")

    assert len(records) == 25
    assert (tmp_path / "out" / "pricing.json").is_file()


def test_accepts_an_exact_reviewed_eight_by_six_sheet(tmp_path: Path) -> None:
    extracted, inventory = _make_fixture(tmp_path, columns=8, rows=6)

    records = build_raster_catalog(extracted, inventory, tmp_path / "out", tmp_path / "report")

    assert len(records) == 48
    assert records[-1].id == "23-sofa-forms-r06c08"
    assert json.loads((tmp_path / "report" / "qa.json").read_text(encoding="utf-8"))["assets"] == 48


def test_rejects_unapproved_grid_dimensions_before_writing(tmp_path: Path) -> None:
    extracted, inventory = _make_fixture(tmp_path, columns=6, rows=6)
    output, report = tmp_path / "out", tmp_path / "report"

    with pytest.raises(RasterCatalogError, match="supported exact grid"):
        build_raster_catalog(extracted, inventory, output, report)

    assert not output.exists()
    assert not report.exists()


def test_accepts_the_approved_food_packaging_sparse_layout(tmp_path: Path) -> None:
    row_counts = (6, 7, 8, 8, 8, 8)
    extracted, inventory = _make_fixture(
        tmp_path,
        columns=8,
        rows=6,
        row_counts=row_counts,
    )

    records = build_raster_catalog(extracted, inventory, tmp_path / "out", tmp_path / "report")

    assert len(records) == 45
    assert records[5].id == "23-sofa-forms-r01c06"
    assert records[6].id == "23-sofa-forms-r02c01"


def test_rejects_an_unapproved_sparse_layout_before_writing(tmp_path: Path) -> None:
    extracted, inventory = _make_fixture(
        tmp_path,
        columns=8,
        rows=6,
        row_counts=(7, 7, 8, 8, 8, 8),
    )
    output, report = tmp_path / "out", tmp_path / "report"

    with pytest.raises(RasterCatalogError, match="supported exact layout"):
        build_raster_catalog(extracted, inventory, output, report)

    assert not output.exists()
    assert not report.exists()


def test_refuses_missing_or_malformed_inventory_and_nonempty_targets(tmp_path: Path) -> None:
    extracted, inventory = _make_fixture(tmp_path)
    (inventory / "23-sofa-forms.inventory.json").unlink()
    with pytest.raises(RasterCatalogError, match="inventory"):
        build_raster_catalog(extracted, inventory, tmp_path / "out-missing", tmp_path / "report-missing")

    extracted, inventory = _make_fixture(tmp_path / "duplicate")
    inventory_path = inventory / "23-sofa-forms.inventory.json"
    value = json.loads(inventory_path.read_text(encoding="utf-8"))
    value["items"][1]["row"] = 1
    value["items"][1]["column"] = 1
    _write_json(inventory_path, value)
    with pytest.raises(RasterCatalogError, match="25 unique"):
        build_raster_catalog(extracted, inventory, tmp_path / "out-bad", tmp_path / "report-bad")

    extracted, inventory = _make_fixture(tmp_path / "occupied")
    output, report = tmp_path / "occupied-out", tmp_path / "occupied-report"
    output.mkdir()
    report.mkdir()
    (output / "keep.txt").write_text("unchanged", encoding="utf-8")
    (report / "keep.txt").write_text("unchanged", encoding="utf-8")
    with pytest.raises(RasterCatalogError, match="empty"):
        build_raster_catalog(extracted, inventory, output, report)
    assert (output / "keep.txt").read_text(encoding="utf-8") == "unchanged"
    assert (report / "keep.txt").read_text(encoding="utf-8") == "unchanged"


def test_rejects_failed_sheet_qa_before_writing(tmp_path: Path) -> None:
    extracted, inventory = _make_fixture(tmp_path)
    latest_report = extracted / "23-sofa-forms-reviewed-v2" / "sheet-report.json"
    value = json.loads(latest_report.read_text(encoding="utf-8"))
    value["safeInsetBreachCount"] = 1
    _write_json(latest_report, value)

    output, report = tmp_path / "out", tmp_path / "report"
    with pytest.raises(RasterCatalogError, match="safe-inset"):
        build_raster_catalog(extracted, inventory, output, report)
    assert not output.exists()
    assert not report.exists()


def test_can_enforce_the_two_thousand_asset_classroom_floor_before_writing(tmp_path: Path) -> None:
    extracted, inventory = _make_fixture(tmp_path)
    output, report = tmp_path / "out", tmp_path / "report"

    with pytest.raises(RasterCatalogError, match="at least 2000"):
        build_raster_catalog(
            extracted,
            inventory,
            output,
            report,
            minimum_records=2_000,
        )

    assert not output.exists()
    assert not report.exists()

    with pytest.raises(RasterCatalogError, match="priced product records"):
        build_raster_catalog(
            extracted,
            inventory,
            tmp_path / "product-out",
            tmp_path / "product-report",
            minimum_product_records=2_000,
        )


def test_packages_reviewed_placement_frames_as_searchable_raster_masters(tmp_path: Path) -> None:
    extracted, inventory = _make_fixture(tmp_path)
    sheet = extracted / "23-sofa-forms-reviewed-v2"
    report_path = sheet / "sheet-report.json"
    report_value = json.loads(report_path.read_text(encoding="utf-8"))
    report_value["type"] = "placement-frame"
    for asset in report_value["assets"]:
        asset["type"] = "placement-frame"
        metadata_path = sheet / "assets" / asset["id"] / "metadata.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        metadata["type"] = "placement-frame"
        _write_json(metadata_path, metadata)
    _write_json(report_path, report_value)
    pricing_path = inventory / "raster-production-pricing-rules.json"
    pricing_rules = json.loads(pricing_path.read_text(encoding="utf-8"))
    pricing_rules["categoryRoleCosts"]["sofas"] = {"placement-frame": 900}
    _write_json(pricing_path, pricing_rules)

    records = build_raster_catalog(
        extracted,
        inventory,
        tmp_path / "out",
        tmp_path / "report",
    )

    assert len(records) == 25
    assert all(record.kind == "raster-master" for record in records)
    assert all("placement-frame" in record.tags for record in records)
    pricing = json.loads((tmp_path / "out" / "pricing.json").read_text(encoding="utf-8"))
    assert all(entry["role"] == "media" and entry["costCents"] == 900 for entry in pricing["entries"])
