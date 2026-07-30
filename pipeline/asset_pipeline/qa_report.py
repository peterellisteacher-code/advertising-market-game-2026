"""Deterministic catalogue verification and QA summaries."""

from __future__ import annotations

import argparse
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
import stat
from typing import Iterable, Mapping, Sequence

from PIL import Image, UnidentifiedImageError
from pydantic import TypeAdapter, ValidationError

from .schema import CatalogAsset, canonical_json_bytes


CORE_TREE_ROOT = "/catalog/generated/offline-core-v1/"
CATALOGUE_ADAPTER = TypeAdapter(list[CatalogAsset])


@dataclass(frozen=True, slots=True)
class _ImageExpectation:
    asset_id: str
    url: str
    role: str
    dimensions: tuple[int, int]


def _is_reparse_point(path: Path) -> bool:
    try:
        metadata = path.lstat()
    except OSError:
        return False
    attributes = getattr(metadata, "st_file_attributes", 0)
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)
    is_junction = getattr(path, "is_junction", lambda: False)
    return path.is_symlink() or bool(reparse_flag and attributes & reparse_flag) or is_junction()


def _path_has_reparse_component(path: Path, boundary: Path) -> bool:
    current = path
    while True:
        if _is_reparse_point(current):
            return True
        if current == boundary:
            return False
        if boundary not in current.parents:
            return True
        current = current.parent


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _canonical_records(payload: object, errors: list[str]) -> list[CatalogAsset]:
    if not isinstance(payload, list):
        errors.append("catalogue root must be an array")
        return []
    try:
        return CATALOGUE_ADAPTER.validate_python(payload, strict=True)
    except ValidationError as error:
        first = error.errors()[0]
        location = ".".join(str(part) for part in first.get("loc", ("unknown",)))
        errors.append(f"record {location} is invalid: {first['msg']}")
        return []


def _resolve_reference(
    url: str,
    root: Path,
    url_roots: Mapping[str, Path] | None,
) -> tuple[Path, Path] | None:
    if url_roots:
        for prefix, directory in sorted(url_roots.items(), key=lambda item: (-len(item[0]), item[0])):
            if url.startswith(prefix):
                boundary = directory.absolute()
                return boundary / url.removeprefix(prefix), boundary
    if not url.startswith("/"):
        return None
    boundary = root.absolute()
    return boundary.joinpath(*url[1:].split("/")), boundary


def _reference_expectations(records: Sequence[CatalogAsset]) -> list[_ImageExpectation]:
    expectations: list[_ImageExpectation] = []
    for record in records:
        dimensions = (record.dimensions.width, record.dimensions.height)
        expectations.extend(
            (
                _ImageExpectation(record.id, record.files.master, "master", dimensions),
                _ImageExpectation(record.id, record.files.preview, "preview", (640, 640)),
                _ImageExpectation(record.id, record.files.thumbnail, "thumbnail", (192, 192)),
            )
        )
        for zone, url in sorted((record.files.masks or {}).items()):
            expectations.append(_ImageExpectation(record.id, url, f"mask:{zone}", dimensions))
    return expectations


def _check_catalogue_graph(records: Sequence[CatalogAsset], errors: list[str]) -> None:
    ids = [record.id for record in records]
    if ids != sorted(ids):
        errors.append("catalogue records must be sorted by stable ID")
    if len(ids) != len(set(ids)):
        errors.append("catalogue record IDs must be unique")
    by_id = {record.id: record for record in records}
    for record in records:
        if record.virtual_parent_id is None:
            continue
        parent = by_id.get(record.virtual_parent_id)
        if parent is None or parent.virtual_parent_id is not None:
            errors.append(f"{record.id}: virtual parent must be one non-virtual catalogue record")
            continue
        if record.files != parent.files or record.master_sha256 != parent.master_sha256:
            errors.append(f"{record.id}: virtual asset must reuse its parent's exact files and master hash")
        if record.dimensions != parent.dimensions:
            errors.append(f"{record.id}: virtual asset dimensions must match its parent")


def _decode_references(
    expectations_by_path: Mapping[Path, Sequence[_ImageExpectation]],
    errors: list[str],
) -> None:
    for path in sorted(expectations_by_path, key=lambda item: expectations_by_path[item][0].url):
        expectations = expectations_by_path[path]
        display = expectations[0].url
        try:
            with Image.open(path) as opened:
                image_format = opened.format
                opened.load()
                mode = opened.mode
                size = opened.size
        except (OSError, UnidentifiedImageError) as error:
            errors.append(f"{display}: referenced file is not a decodable image ({type(error).__name__})")
            continue
        for expectation in expectations:
            if size != expectation.dimensions:
                errors.append(
                    f"{expectation.asset_id}: {expectation.role} dimensions are {size[0]}x{size[1]}, "
                    f"expected {expectation.dimensions[0]}x{expectation.dimensions[1]}"
                )
            if expectation.role == "master" or expectation.role.startswith("mask:"):
                if image_format != "PNG" or mode != "RGBA":
                    errors.append(f"{expectation.asset_id}: {expectation.role} must be an RGBA PNG")
            elif image_format != "WEBP":
                errors.append(f"{expectation.asset_id}: {expectation.role} must be WebP")


def catalogue_rows(records: Iterable[CatalogAsset]) -> list[dict[str, object]]:
    """Return stable per-record QA rows without host paths or timestamps."""

    rows: list[dict[str, object]] = []
    for record in sorted(records, key=lambda item: item.id):
        row: dict[str, object] = {
            "category": record.category,
            "id": record.id,
            "master": record.files.master,
            "masterSha256": record.master_sha256,
        }
        if record.virtual_parent_id is not None:
            row["virtualParentId"] = record.virtual_parent_id
        rows.append(row)
    return rows


def verify_catalogue(
    catalog_path: str | Path,
    root: str | Path,
    require_masters: int = 0,
    require_categories: int = 0,
    require_records: int = 0,
    *,
    url_roots: Mapping[str, Path] | None = None,
) -> dict[str, object]:
    """Verify a catalogue tree once per unique file and return a stable summary."""

    requirements = (require_masters, require_categories, require_records)
    if any(type(value) is not int or value < 0 for value in requirements):
        raise ValueError("QA requirements must be non-negative integers")
    catalogue = Path(catalog_path)
    project_root = Path(root)
    errors: list[str] = []
    try:
        raw = catalogue.read_bytes()
        payload = json.loads(raw.decode("utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        errors.append(f"catalogue cannot be read as UTF-8 JSON: {type(error).__name__}")
        payload = []
        raw = b""
    if raw and raw != canonical_json_bytes(payload):
        errors.append("catalogue JSON is not canonical sorted UTF-8 with one final LF")
    records = _canonical_records(payload, errors)
    _check_catalogue_graph(records, errors)

    expectations_by_path: dict[Path, list[_ImageExpectation]] = {}
    path_for_url: dict[str, Path] = {}
    resolution_cache: dict[str, Path | None] = {}
    for expectation in _reference_expectations(records):
        if expectation.url not in resolution_cache:
            resolved = _resolve_reference(expectation.url, project_root, url_roots)
            path: Path | None = None
            if resolved is None:
                errors.append(f"{expectation.asset_id}: invalid file reference {expectation.url}")
            else:
                candidate, boundary = resolved
                if boundary != candidate and boundary not in candidate.parents:
                    errors.append(f"{expectation.asset_id}: file reference escapes its catalogue root")
                elif not candidate.is_file():
                    errors.append(f"{expectation.asset_id}: missing file {expectation.url}")
                elif _path_has_reparse_component(candidate, boundary):
                    errors.append(f"{expectation.asset_id}: reparse-point file reference is forbidden")
                else:
                    path = candidate
            resolution_cache[expectation.url] = path
        path = resolution_cache[expectation.url]
        if path is None:
            continue
        path_for_url[expectation.url] = path
        expectations_by_path.setdefault(path, []).append(expectation)

    digest_by_path: dict[Path, str] = {}
    for record in records:
        master_path = path_for_url.get(record.files.master)
        if master_path is None:
            continue
        try:
            if master_path not in digest_by_path:
                digest_by_path[master_path] = _sha256(master_path)
            digest = digest_by_path[master_path]
        except OSError as error:
            errors.append(f"{record.id}: master cannot be hashed ({type(error).__name__})")
            continue
        if digest != record.master_sha256:
            errors.append(f"{record.id}: master SHA-256 does not match masterSha256")

    if not errors:
        _decode_references(expectations_by_path, errors)

    base_masters = len({record.files.master for record in records if record.virtual_parent_id is None})
    categories = len({record.category for record in records})
    if len(records) < require_records:
        errors.append(f"catalogue requires at least {require_records} records; found {len(records)}")
    if base_masters < require_masters:
        errors.append(f"catalogue requires at least {require_masters} base masters; found {base_masters}")
    if categories < require_categories:
        errors.append(f"catalogue requires at least {require_categories} categories; found {categories}")
    return {
        "assets": len(records),
        "baseMasters": base_masters,
        "categories": categories,
        "errors": sorted(set(errors)),
    }


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Verify a deterministic catalogue tree")
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--require-masters", type=int, default=0)
    parser.add_argument("--require-categories", type=int, default=0)
    parser.add_argument("--require-records", type=int, default=0)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = _parser().parse_args(argv)
    result = verify_catalogue(
        arguments.catalog,
        arguments.root,
        arguments.require_masters,
        arguments.require_categories,
        arguments.require_records,
    )
    print(canonical_json_bytes(result).decode("utf-8"), end="")
    return 1 if result["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())


__all__ = ["catalogue_rows", "main", "verify_catalogue"]
