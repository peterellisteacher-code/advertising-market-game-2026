"""Source-manifest-driven deterministic offline catalogue builder."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import stat
from typing import Mapping, Sequence

from pydantic import ValidationError

from .masks import MaskValidationError, prepare_masks
from .normalize import NormalizationError, normalize_master
from .qa_report import CORE_TREE_ROOT, catalogue_rows, verify_catalogue
from .schema import CatalogAsset, SourceAsset, SourceManifest, canonical_json_bytes
from .sheet_splitter import SheetSplitError, split_sheet


MAX_MANIFEST_BYTES = 16 * 1024 * 1024
MAX_SOURCE_BYTES = 64 * 1024 * 1024
CATALOGUE_ASSET_ROOT = "/catalog/generated/offline-core-v1/assets"


class PackBuildError(ValueError):
    """Raised when a pack cannot be built without weakening its contract."""


def _absolute(path: Path) -> Path:
    return Path(path).absolute()


def _is_reparse_point(path: Path) -> bool:
    try:
        metadata = path.lstat()
    except OSError:
        return False
    attributes = getattr(metadata, "st_file_attributes", 0)
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)
    is_junction = getattr(path, "is_junction", lambda: False)
    return path.is_symlink() or bool(reparse_flag and attributes & reparse_flag) or is_junction()


def _require_plain_directory(path: Path, label: str) -> Path:
    if not path.is_dir():
        raise PackBuildError(f"{label} must be an existing directory")
    if _is_reparse_point(path):
        raise PackBuildError(f"{label} may not be a symlink or reparse point")
    return _absolute(path)


def _require_empty_target(path: Path, label: str) -> None:
    if path.exists() and (not path.is_dir() or any(path.iterdir())):
        raise PackBuildError(f"{label} must be absent or empty")


def _overlap(first: Path, second: Path) -> bool:
    left, right = _absolute(first), _absolute(second)
    return left == right or left in right.parents or right in left.parents


def _safe_source_file(root: Path, value: str, label: str) -> Path:
    relative = PurePosixPath(value)
    candidate = root.joinpath(*relative.parts)
    current = root
    for part in relative.parts:
        current = current / part
        if _is_reparse_point(current):
            raise PackBuildError(f"{label} may not use a symlink or reparse point")
    if not candidate.is_file():
        raise PackBuildError(f"{label} does not exist")
    if candidate.stat().st_size > MAX_SOURCE_BYTES:
        raise PackBuildError(f"{label} exceeds the 64 MiB encoded-source limit")
    return candidate


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _load_manifest(source_root: Path) -> SourceManifest:
    manifest_path = _safe_source_file(source_root, "manifest.json", "source manifest")
    if manifest_path.stat().st_size > MAX_MANIFEST_BYTES:
        raise PackBuildError("source manifest exceeds 16 MiB")
    try:
        payload = json.loads(manifest_path.read_bytes().decode("utf-8"))
        return SourceManifest.model_validate(payload, strict=True)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValidationError, ValueError) as error:
        raise PackBuildError(f"source manifest is invalid: {error}") from error


def _preflight_sources(
    source_root: Path,
    manifest: SourceManifest,
) -> tuple[dict[str, Path], dict[str, dict[str, Path]], dict[str, Path]]:
    accepted = sorted((asset for asset in manifest.assets if asset.accepted), key=lambda asset: asset.id)
    ordinary: dict[str, Path] = {}
    masks: dict[str, dict[str, Path]] = {}
    sheet_sources: dict[str, Path] = {}
    digest_cache: dict[Path, str] = {}
    sheet_by_id = {sheet.sheet_id: sheet for sheet in manifest.sheets}

    def checked_hash(path: Path, expected: str, label: str) -> None:
        try:
            if path not in digest_cache:
                digest_cache[path] = _sha256(path)
            actual = digest_cache[path]
        except OSError as error:
            raise PackBuildError(f"{label} cannot be hashed") from error
        if actual != expected:
            raise PackBuildError(f"{label} hash does not match sourceSha256")

    required_sheet_ids = {asset.sheet_id for asset in accepted if asset.sheet_id is not None}
    for sheet_id in sorted(required_sheet_ids):
        sheet = sheet_by_id[sheet_id]
        if sheet.source_path is None:  # SourceManifest also enforces this.
            raise PackBuildError(f"sheet {sheet_id} has no source path")
        path = _safe_source_file(source_root, sheet.source_path, f"sheet {sheet_id}")
        checked_hash(path, sheet.source_sha256, f"sheet {sheet_id}")
        sheet_sources[sheet_id] = path

    for asset in accepted:
        if asset.source_path is not None:
            path = _safe_source_file(source_root, asset.source_path, f"asset {asset.id} source")
            checked_hash(path, asset.source_sha256, f"asset {asset.id} source")
            ordinary[asset.id] = path
        else:
            sheet = sheet_by_id[asset.sheet_id or ""]
            if asset.source_sha256 != sheet.source_sha256:
                raise PackBuildError(
                    f"asset {asset.id} hash must match its declared sheet source hash before decoding"
                )

        masks[asset.id] = {
            zone: _safe_source_file(source_root, path, f"asset {asset.id} {zone} mask")
            for zone, path in sorted(asset.masks.items())
        }
    return ordinary, masks, sheet_sources


def _catalogue_record(
    asset: SourceAsset,
    master_sha256: str,
    dimensions: tuple[int, int],
    mask_urls: Mapping[str, str],
) -> CatalogAsset:
    base = f"{CATALOGUE_ASSET_ROOT}/{asset.id}"
    return CatalogAsset.model_validate(
        {
            "schema": "catalog-asset@1",
            "delivery": "offline",
            "id": asset.id,
            "version": 1,
            "kind": asset.kind,
            "title": asset.title,
            "category": asset.category,
            "tags": asset.tags,
            "files": {
                "thumbnail": f"{base}/thumbnail-192.webp",
                "preview": f"{base}/preview-640.webp",
                "master": f"{base}/master.png",
                **({"masks": dict(mask_urls)} if mask_urls else {}),
            },
            "masterSha256": master_sha256,
            "dimensions": {"width": dimensions[0], "height": dimensions[1]},
            "recolourZones": asset.recolour_zones,
            "anchors": [anchor.model_dump(by_alias=True, exclude_none=True) for anchor in asset.anchors],
            "materialProfiles": asset.material_profiles,
            "classroomReviewed": asset.classroom_reviewed,
            "brandFree": asset.brand_free,
            "attribution": asset.attribution.model_dump(by_alias=True, exclude_none=True),
            **(
                {"defaultZoneStyles": {
                    zone: style.model_dump(by_alias=True, exclude_none=True)
                    for zone, style in sorted(asset.default_zone_styles.items())
                }}
                if asset.default_zone_styles is not None
                else {}
            ),
        },
        strict=True,
    )


def _virtual_record(base: CatalogAsset, virtual: object) -> CatalogAsset:
    # VirtualAsset is kept structural here so the builder remains a thin
    # consumer of the shared schema instead of revalidating its graph.
    value = base.model_dump(by_alias=True, exclude_none=True)
    value["id"] = virtual.id
    value["virtualParentId"] = base.id
    for attribute, alias in (("title", "title"), ("category", "category"), ("tags", "tags")):
        override = getattr(virtual, attribute)
        if override is not None:
            value[alias] = override
    if virtual.default_zone_styles is not None:
        value["defaultZoneStyles"] = {
            zone: style.model_dump(by_alias=True, exclude_none=True)
            for zone, style in sorted(virtual.default_zone_styles.items())
        }
    return CatalogAsset.model_validate(value, strict=True)


def build_pack(
    source: str | Path,
    out: str | Path,
    report: str | Path,
    materials: str | Path | None = None,
) -> list[CatalogAsset]:
    """Build one deterministic pack without replacing or pruning any target."""

    source_path, output_path, report_path = Path(source), Path(out), Path(report)
    _require_empty_target(output_path, "output directory")
    _require_empty_target(report_path, "report directory")
    if _overlap(output_path, report_path):
        raise PackBuildError("output and report directories must be separate and non-overlapping")
    source_root = _require_plain_directory(source_path, "source directory")
    if _overlap(source_root, output_path) or _overlap(source_root, report_path):
        raise PackBuildError("output and report directories may not overlap the source directory")
    if materials is not None:
        _require_plain_directory(Path(materials), "materials directory")

    manifest = _load_manifest(source_root)
    ordinary, mask_sources, sheet_sources = _preflight_sources(source_root, manifest)

    output_path.mkdir(parents=True, exist_ok=True)
    report_path.mkdir(parents=True, exist_ok=True)
    try:
        component_sources: dict[tuple[str, str], Path] = {}
        sheet_by_id = {sheet.sheet_id: sheet for sheet in manifest.sheets}
        for sheet_id, source_file in sorted(sheet_sources.items()):
            components = split_sheet(
                source_file,
                sheet_by_id[sheet_id],
                report_path / "sheet-components" / sheet_id,
            )
            component_sources.update(
                ((sheet_id, component.asset_id), component.path) for component in components
            )

        accepted = sorted((asset for asset in manifest.assets if asset.accepted), key=lambda asset: asset.id)
        records: list[CatalogAsset] = []
        for asset in accepted:
            source_file = ordinary.get(asset.id)
            if source_file is None:
                source_file = component_sources[(asset.sheet_id or "", asset.sheet_output_id or "")]
            asset_directory = output_path / "assets" / asset.id
            normalized = normalize_master(source_file, asset_directory)
            prepared_masks = (
                prepare_masks(
                    normalized.master_path,
                    mask_sources[asset.id],
                    asset.recolour_zones,
                    asset_directory / "masks",
                )
                if asset.recolour_zones
                else {}
            )
            base_url = f"{CATALOGUE_ASSET_ROOT}/{asset.id}/masks"
            mask_urls = {zone: f"{base_url}/{zone}.png" for zone in prepared_masks}
            records.append(
                _catalogue_record(asset, normalized.master_sha256, normalized.dimensions, mask_urls)
            )

        base_by_id = {record.id: record for record in records}
        records.extend(
            _virtual_record(base_by_id[virtual.parent_id], virtual)
            for virtual in sorted(manifest.virtual_assets, key=lambda item: item.id)
        )
        records.sort(key=lambda record: record.id)
        (output_path / "catalog.json").write_bytes(
            canonical_json_bytes([
                record.model_dump(mode="json", by_alias=True, exclude_none=True)
                for record in records
            ])
        )

        summary = verify_catalogue(
            output_path / "catalog.json",
            output_path.parent,
            url_roots={CORE_TREE_ROOT: output_path},
        )
        report_payload = {
            **summary,
            "packId": manifest.pack_id,
            "records": catalogue_rows(records),
        }
        (report_path / "qa.json").write_bytes(canonical_json_bytes(report_payload))
        if summary["errors"]:
            raise PackBuildError("generated catalogue failed deterministic QA")
        return records
    except PackBuildError:
        raise
    except (KeyError, OSError, NormalizationError, MaskValidationError, SheetSplitError, ValidationError, ValueError) as error:
        raise PackBuildError(f"pack build failed: {error}") from error


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Build a deterministic offline catalogue pack")
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--materials", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = _parser().parse_args(argv)
    records = build_pack(arguments.source, arguments.out, arguments.report, arguments.materials)
    print(canonical_json_bytes({"assets": len(records), "status": "ok"}).decode("utf-8"), end="")
    return 0


if __name__ == "__main__":  # pragma: no cover - exercised through the CLI.
    raise SystemExit(main())


__all__ = ["PackBuildError", "build_pack", "main"]
