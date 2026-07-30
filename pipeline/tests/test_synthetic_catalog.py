from __future__ import annotations

import hashlib
import json
from pathlib import Path
import time

import pytest
from pydantic import TypeAdapter

from conftest import tree_digest
from asset_pipeline.schema import CatalogAsset
from asset_pipeline.synthetic_catalog import SyntheticCatalogError, generate_synthetic_catalog


def test_15000_record_fixture_is_reproducible_valid_and_reuses_real_image_bytes(tmp_path: Path):
    started = time.perf_counter()
    first_root = tmp_path / "root-a"
    second_root = tmp_path / "a-very-different-absolute-root"
    first = first_root / "catalog" / "generated" / "performance-fixtures" / "catalog-15000.json"
    second = second_root / "catalog" / "generated" / "performance-fixtures" / "catalog-15000.json"

    generate_synthetic_catalog(count=15_000, seed=20_260_710, out=first)
    generate_synthetic_catalog(count=15_000, seed=20_260_710, out=second)

    assert tree_digest(first.parent) == tree_digest(second.parent)
    assert hashlib.sha256(first.read_bytes()).hexdigest() == "fe070f60e05f6125bda8b28d8c438ba16756e062db64c532516ba1810e5b6855"
    payload = json.loads(first.read_text(encoding="utf-8"))
    assert len(payload) == 15_000
    assert len({record["id"] for record in payload}) == 15_000
    parsed = TypeAdapter(list[CatalogAsset]).validate_python(payload, strict=True)
    assert all(record.classroom_reviewed is False and record.brand_free is False for record in parsed)
    assert parsed[0].virtual_parent_id is None
    assert all(record.virtual_parent_id == parsed[0].id for record in parsed[1:])
    assert all(record.files == parsed[0].files for record in parsed)
    image_files = sorted(path for path in first.parent.rglob("*") if path.suffix in {".png", ".webp"})
    assert [path.name for path in image_files] == ["master.png", "preview-640.webp", "thumbnail-192.webp"]
    for url in [parsed[0].files.master, parsed[0].files.preview, parsed[0].files.thumbnail]:
        assert (first_root / url.lstrip("/")).is_file()
    assert time.perf_counter() - started < 60.0


def test_synthetic_fixture_refuses_existing_output_and_invalid_counts_without_mutation(tmp_path: Path):
    output = tmp_path / "catalog" / "generated" / "performance-fixtures" / "catalog-15000.json"
    output.parent.mkdir(parents=True)
    sentinel = output.parent / "keep.txt"
    sentinel.write_bytes(b"unchanged")

    with pytest.raises(SyntheticCatalogError, match="empty"):
        generate_synthetic_catalog(count=10, seed=1, out=output)
    assert sentinel.read_bytes() == b"unchanged"

    empty_output = tmp_path / "empty" / "catalog-15000.json"
    with pytest.raises(SyntheticCatalogError, match="count"):
        generate_synthetic_catalog(count=0, seed=1, out=empty_output)
    with pytest.raises(SyntheticCatalogError, match="count"):
        generate_synthetic_catalog(count=20_001, seed=1, out=empty_output)
