"""Reproducible large catalogue fixture with one shared real image tree."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path
from typing import Sequence

from PIL import Image

from .normalize import NormalizationError, normalize_master
from .qa_report import verify_catalogue
from .schema import CatalogAsset, canonical_json_bytes


PERFORMANCE_ASSET_ROOT = "/catalog/generated/performance-fixtures/assets/synthetic-00000"
MAX_SYNTHETIC_RECORDS = 20_000
_CATEGORIES = (
    "bags",
    "drinkware",
    "food-packaging",
    "footwear",
    "home-desk",
    "leisure-outdoor",
    "personal-care",
    "small-electronics",
    "transport-travel",
    "wearable-accessories",
)


class SyntheticCatalogError(ValueError):
    """Raised before a synthetic fixture can replace or emit invalid data."""


def _require_fixture_location(out: Path) -> Path:
    parent = out.parent
    if parent.name != "performance-fixtures" or parent.parent.name != "generated" or parent.parent.parent.name != "catalog":
        raise SyntheticCatalogError(
            "synthetic output must be below catalog/generated/performance-fixtures"
        )
    return parent.parent.parent.parent


def _require_empty_parent(out: Path) -> None:
    if out.parent.exists() and (not out.parent.is_dir() or any(out.parent.iterdir())):
        raise SyntheticCatalogError("synthetic output directory must be absent or empty")


def _variant_metadata(seed: int, index: int) -> tuple[str, list[str]]:
    digest = hashlib.sha256(f"{seed}:{index}".encode("ascii")).digest()
    category = _CATEGORIES[digest[0] % len(_CATEGORIES)]
    tags = sorted({"performance-fixture", category, f"variant-{digest[1] % 100:02d}"})
    return category, tags


def _shared_images(seed: int, source: Path, directory: Path) -> tuple[str, tuple[int, int]]:
    digest = hashlib.sha256(f"synthetic-image:{seed}".encode("ascii")).digest()
    colour = (digest[0], digest[1], digest[2], 255)
    source.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGBA", (16, 12), colour).save(
        source,
        format="PNG",
        compress_level=9,
        optimize=False,
    )
    try:
        normalized = normalize_master(source, directory)
    except NormalizationError as error:
        raise SyntheticCatalogError(f"synthetic image normalization failed: {error}") from error
    return normalized.master_sha256, normalized.dimensions


def _record(
    index: int,
    width: int,
    seed: int,
    master_sha256: str,
    dimensions: tuple[int, int],
) -> CatalogAsset:
    asset_id = f"synthetic-{index:0{width}d}"
    category, tags = _variant_metadata(seed, index)
    value: dict[str, object] = {
        "schema": "catalog-asset@1",
        "delivery": "offline",
        "id": asset_id,
        "version": 1,
        "kind": "raster-master",
        "title": f"Synthetic catalogue asset {index:0{width}d}",
        "category": category,
        "tags": tags,
        "files": {
            "thumbnail": f"{PERFORMANCE_ASSET_ROOT}/thumbnail-192.webp",
            "preview": f"{PERFORMANCE_ASSET_ROOT}/preview-640.webp",
            "master": f"{PERFORMANCE_ASSET_ROOT}/master.png",
        },
        "masterSha256": master_sha256,
        "dimensions": {"width": dimensions[0], "height": dimensions[1]},
        "recolourZones": [],
        "anchors": [],
        "materialProfiles": [],
        "classroomReviewed": False,
        "brandFree": False,
        "attribution": {
            "creator": "Deterministic synthetic fixture",
            "sourceUrl": "local",
            "license": "Classroom fixture",
        },
    }
    if index:
        value["virtualParentId"] = f"synthetic-{0:0{width}d}"
    return CatalogAsset.model_validate(value, strict=True)


def generate_synthetic_catalog(count: int, seed: int, out: str | Path) -> list[CatalogAsset]:
    """Generate ``count`` stable records that reuse exactly one image tree."""

    if type(count) is not int or not 1 <= count <= MAX_SYNTHETIC_RECORDS:
        raise SyntheticCatalogError("count must be an integer from 1 to 20000")
    if type(seed) is not int or not -(2**63) <= seed < 2**63:
        raise SyntheticCatalogError("seed must be a signed 64-bit integer")
    destination = Path(out)
    project_root = _require_fixture_location(destination)
    _require_empty_parent(destination)

    asset_directory = destination.parent / "assets" / "synthetic-00000"
    # The final JSON path temporarily holds the deterministic seed PNG. This
    # keeps the normalization destination empty and leaves no fourth asset or
    # cleanup obligation; the canonical JSON write below replaces the seed.
    master_sha256, dimensions = _shared_images(seed, destination, asset_directory)
    width = max(5, len(str(count - 1)))
    base = _record(0, width, seed, master_sha256, dimensions)
    records = [base]
    for index in range(1, count):
        category, tags = _variant_metadata(seed, index)
        records.append(base.model_copy(update={
            "id": f"synthetic-{index:0{width}d}",
            "title": f"Synthetic catalogue asset {index:0{width}d}",
            "category": category,
            "tags": tags,
            "virtual_parent_id": base.id,
        }))
    destination.write_bytes(
        canonical_json_bytes([
            record.model_dump(mode="json", by_alias=True, exclude_none=True)
            for record in records
        ])
    )
    summary = verify_catalogue(
        destination,
        project_root,
        require_masters=1,
        require_categories=1,
        require_records=count,
    )
    if summary["errors"]:
        raise SyntheticCatalogError("generated synthetic catalogue failed deterministic QA")
    return records


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate the deterministic performance catalogue")
    parser.add_argument("--count", type=int, required=True)
    parser.add_argument("--seed", type=int, required=True)
    parser.add_argument("--out", type=Path, required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = _parser().parse_args(argv)
    records = generate_synthetic_catalog(arguments.count, arguments.seed, arguments.out)
    print(canonical_json_bytes({"assets": len(records), "status": "ok"}).decode("utf-8"), end="")
    return 0


if __name__ == "__main__":  # pragma: no cover - exercised through the CLI.
    raise SystemExit(main())


__all__ = ["SyntheticCatalogError", "generate_synthetic_catalog", "main"]
