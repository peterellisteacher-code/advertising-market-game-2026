from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
from PIL import Image

import asset_pipeline.build_pack as pack_module
from conftest import tree_digest
from asset_pipeline.build_pack import PackBuildError, build_pack
from asset_pipeline.schema import CatalogAsset
from asset_pipeline.qa_report import verify_catalogue


def canonical_write(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes((json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8"))


def make_source_pack(root: Path, *, reverse_manifest=False) -> Path:
    assets = root / "assets"
    masks = root / "masks"
    assets.mkdir(parents=True)
    masks.mkdir(parents=True)
    master = assets / "bottle.png"
    body = masks / "bottle-body.png"
    Image.new("RGBA", (12, 20), (120, 160, 220, 255)).save(master, compress_level=9, optimize=False)
    Image.new("L", (12, 20), 255).save(body, compress_level=9, optimize=False)
    base = {
        "id": "bottle-basic",
        "accepted": True,
        "sourcePath": "assets/bottle.png",
        "sourceSha256": hashlib.sha256(master.read_bytes()).hexdigest(),
        "title": "Basic bottle",
        "category": "drinkware",
        "tags": ["bottle", "drinkware"],
        "kind": "raster-master",
        "masks": {"body": "masks/bottle-body.png"},
        "recolourZones": ["body"],
        "anchors": [{"id": "lid", "x": 0.5, "y": 0.1, "accepts": ["cap"]}],
        "materialProfiles": ["matte-plastic"],
        "classroomReviewed": False,
        "brandFree": False,
        "attribution": {
            "creator": "Fixture author",
            "sourceUrl": "local",
            "license": "Classroom fixture",
        },
    }
    rejected = {
        **base,
        "id": "rejected-logo",
        "accepted": False,
        "title": "Rejected logo",
        "rejectionReason": "Visible brand",
    }
    manifest = {
        "schema": "asset-source@1",
        "packId": "fixture-pack",
        "sheets": [],
        "assets": [rejected, base] if reverse_manifest else [base, rejected],
        "virtualAssets": [
            {
                "id": "bottle-basic-blue",
                "parentId": "bottle-basic",
                "title": "Basic blue bottle",
                "tags": ["blue", "bottle"],
                "defaultZoneStyles": {
                    "body": {"colour": "#3366CC", "materialId": "matte-plastic", "opacity": 1.0}
                },
            }
        ],
    }
    canonical_write(root / "manifest.json", manifest)
    return root


def test_pack_build_is_cross_root_deterministic_and_virtual_records_reuse_bytes(tmp_path: Path):
    first_source = make_source_pack(tmp_path / "source-a")
    second_source = make_source_pack(tmp_path / "unrelated" / "source-b", reverse_manifest=True)
    first_out, first_report = tmp_path / "out-a", tmp_path / "report-a"
    second_out, second_report = tmp_path / "another-root" / "out-b", tmp_path / "another-root" / "report-b"

    first_records = build_pack(first_source, first_out, first_report)
    second_records = build_pack(second_source, second_out, second_report)

    assert [record.id for record in first_records] == ["bottle-basic", "bottle-basic-blue"]
    assert [record.id for record in second_records] == ["bottle-basic", "bottle-basic-blue"]
    assert tree_digest(first_out) == tree_digest(second_out)
    assert tree_digest(first_report) == tree_digest(second_report)
    base, virtual = first_records
    assert virtual.virtual_parent_id == base.id
    assert virtual.files == base.files
    assert virtual.master_sha256 == base.master_sha256
    assert len(list((first_out / "assets").rglob("master.png"))) == 1


def test_pack_catalogue_is_canonical_valid_and_every_reference_and_hash_resolves(tmp_path: Path):
    output = tmp_path / "catalog" / "generated" / "offline-core-v1"
    report = tmp_path / "catalog" / "reports" / "fixture-pack"
    records = build_pack(make_source_pack(tmp_path / "source"), output, report)
    payload = output.joinpath("catalog.json").read_bytes()

    assert payload.endswith(b"\n")
    assert json.loads(payload) == [record.model_dump(by_alias=True, exclude_none=True) for record in records]
    for value in json.loads(payload):
        record = CatalogAsset.model_validate(value, strict=True)
        master = tmp_path / record.files.master.lstrip("/")
        assert master.is_file()
        assert hashlib.sha256(master.read_bytes()).hexdigest() == record.master_sha256
        for url in [record.files.thumbnail, record.files.preview, *record.files.masks.values()]:
            assert (tmp_path / url.lstrip("/")).is_file()

    qa = verify_catalogue(output / "catalog.json", tmp_path, require_masters=1, require_categories=1, require_records=2)
    assert qa == {"assets": 2, "baseMasters": 1, "categories": 1, "errors": []}
    assert json.loads((report / "qa.json").read_text(encoding="utf-8"))["errors"] == []


def test_pack_refuses_hash_mismatch_and_nonempty_destinations_without_mutation(tmp_path: Path):
    source = make_source_pack(tmp_path / "source")
    manifest_path = source / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["assets"][0]["sourceSha256"] = "0" * 64
    canonical_write(manifest_path, manifest)
    with pytest.raises(PackBuildError, match="hash"):
        build_pack(source, tmp_path / "hash-out", tmp_path / "hash-report")

    clean_source = make_source_pack(tmp_path / "clean-source")
    output = tmp_path / "existing-output"
    report = tmp_path / "existing-report"
    output.mkdir()
    report.mkdir()
    output_sentinel = output / "keep.txt"
    report_sentinel = report / "keep.txt"
    output_sentinel.write_bytes(b"output unchanged")
    report_sentinel.write_bytes(b"report unchanged")
    with pytest.raises(PackBuildError, match="empty"):
        build_pack(clean_source, output, report)
    assert output_sentinel.read_bytes() == b"output unchanged"
    assert report_sentinel.read_bytes() == b"report unchanged"


def test_pack_preflights_rejected_asset_hashes(tmp_path: Path):
    source = make_source_pack(tmp_path / "source")
    manifest_path = source / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["assets"][1]["sourceSha256"] = "0" * 64
    canonical_write(manifest_path, manifest)

    with pytest.raises(PackBuildError, match="rejected-logo source hash"):
        build_pack(source, tmp_path / "out", tmp_path / "report")


def test_pack_rejects_reparse_output_target_before_writing(tmp_path: Path, monkeypatch):
    source = make_source_pack(tmp_path / "source")
    output = tmp_path / "output-junction"
    output.mkdir()
    original = pack_module._is_reparse_point
    monkeypatch.setattr(
        pack_module,
        "_is_reparse_point",
        lambda path: Path(path) == output or original(Path(path)),
    )

    with pytest.raises(PackBuildError, match="output directory.*reparse"):
        build_pack(source, output, tmp_path / "report")

    assert list(output.iterdir()) == []


def test_pack_rejects_reparse_output_ancestor_before_writing(tmp_path: Path, monkeypatch):
    source = make_source_pack(tmp_path / "source")
    output_parent = tmp_path / "output-junction"
    output_parent.mkdir()
    output = output_parent / "nested-output"
    original = pack_module._is_reparse_point
    monkeypatch.setattr(
        pack_module,
        "_is_reparse_point",
        lambda path: Path(path) == output_parent or original(Path(path)),
    )

    with pytest.raises(PackBuildError, match="output directory.*reparse"):
        build_pack(source, output, tmp_path / "report")

    assert list(output_parent.iterdir()) == []


def test_pack_hashes_one_shared_authored_source_only_once(tmp_path: Path, monkeypatch):
    source = make_source_pack(tmp_path / "source")
    manifest_path = source / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    shared = {**manifest["assets"][0], "id": "bottle-second", "title": "Second bottle"}
    manifest["assets"].insert(1, shared)
    canonical_write(manifest_path, manifest)
    calls = 0
    original = pack_module._sha256

    def counted(path):
        nonlocal calls
        calls += 1
        return original(path)

    monkeypatch.setattr(pack_module, "_sha256", counted)
    build_pack(source, tmp_path / "out", tmp_path / "report")

    assert calls == 1


def test_pack_consumes_explicit_sheet_output_ids_without_enumeration_identity(tmp_path: Path):
    source = tmp_path / "sheet-source"
    sheet_path = source / "sheets" / "products.png"
    sheet_path.parent.mkdir(parents=True)
    image = Image.new("RGBA", (24, 12), (0, 255, 0, 255))
    for x in range(2, 7):
        for y in range(2, 9):
            image.putpixel((x, y), (220, 30, 30, 255))
    for x in range(15, 21):
        for y in range(3, 9):
            image.putpixel((x, y), (30, 60, 220, 255))
    image.save(sheet_path, compress_level=9, optimize=False)
    sheet_hash = hashlib.sha256(sheet_path.read_bytes()).hexdigest()
    common = {
        "accepted": True,
        "sourceSha256": sheet_hash,
        "category": "products",
        "tags": ["product"],
        "kind": "raster-master",
        "masks": {},
        "recolourZones": [],
        "anchors": [],
        "materialProfiles": [],
        "classroomReviewed": False,
        "brandFree": False,
        "attribution": {
            "creator": "Sheet fixture",
            "sourceUrl": "local",
            "license": "Classroom fixture",
        },
        "sheetId": "products-sheet",
    }
    manifest = {
        "schema": "asset-source@1",
        "packId": "sheet-pack",
        "sheets": [{
            "schema": "asset-sheet@1",
            "sheetId": "products-sheet",
            "sourcePath": "sheets/products.png",
            "sourceSha256": sheet_hash,
            "chromaRgb": [0, 255, 0],
            "colourDistanceFormula": "cie76-srgb-d65",
            "threshold": 2.0,
            "alphaCutoff": 8,
            "componentAreaFloor": 8,
            "padding": 0,
            "gutter": 2,
            "expectedComponentCount": 2,
            "outputIds": ["red-product", "blue-product"],
        }],
        "assets": [
            {**common, "id": "blue-product", "sheetOutputId": "blue-product", "title": "Blue product"},
            {**common, "id": "red-product", "sheetOutputId": "red-product", "title": "Red product"},
        ],
        "virtualAssets": [],
    }
    canonical_write(source / "manifest.json", manifest)

    records = build_pack(source, tmp_path / "out", tmp_path / "report")

    assert [record.id for record in records] == ["blue-product", "red-product"]
    assert (tmp_path / "out" / "assets" / "blue-product" / "master.png").is_file()
    assert (tmp_path / "out" / "assets" / "red-product" / "master.png").is_file()
    assert sorted(path.name for path in (tmp_path / "report" / "sheet-components" / "products-sheet").glob("*.png")) == [
        "blue-product.png",
        "red-product.png",
    ]
