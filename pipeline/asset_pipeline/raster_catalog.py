"""Package reviewed contact-sheet extractions as a searchable raster catalogue."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import json
from pathlib import Path, PurePosixPath, PureWindowsPath
import re
import stat
from typing import Any, Sequence

from PIL import Image, ImageChops, UnidentifiedImageError
from pydantic import ValidationError

from .masks import MaskValidationError, prepare_masks
from .normalize import NormalizationError, load_canonical_rgba, normalize_master
from .qa_report import verify_catalogue
from .schema import CatalogAsset, canonical_json_bytes


CATALOGUE_ROOT = "/catalog/generated/offline-core-v1"
CATALOGUE_ASSET_ROOT = f"{CATALOGUE_ROOT}/assets"
REVIEWED_DIRECTORY = re.compile(r"^(?P<concept>[a-z0-9]+(?:-[a-z0-9]+)*)-reviewed-v(?P<review>[1-9][0-9]*)$")
PORTABLE_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SUPPORTED_LAYOUTS = {
    (5, 5, (5, 5, 5, 5, 5)),
    (8, 6, (8, 8, 8, 8, 8, 8)),
    (8, 6, (6, 7, 8, 8, 8, 8)),
    (8, 6, (8, 8, 8, 8, 8, 7)),
    (8, 6, (8, 7, 7, 8, 8, 7)),
}
SUPPORTED_ASSET_TYPES = {"base", "add-on", "placement-frame", "scene"}
PRICING_RULES_FILENAME = "raster-production-pricing-rules.json"
PRICING_ROLE = {"base": "base", "scene": "base", "add-on": "part", "placement-frame": "media"}


class RasterCatalogError(ValueError):
    """Raised before an unsafe or incomplete raster pack can be published."""


@dataclass(frozen=True, slots=True)
class _MasterOverride:
    relative_path: str
    source_sha256: str
    path: Path


@dataclass(frozen=True, slots=True)
class _InventoryItem:
    label: str
    tags: tuple[str, ...]
    master_override: _MasterOverride | None


@dataclass(frozen=True, slots=True)
class _PreparedAsset:
    id: str
    title: str
    category: str
    tags: tuple[str, ...]
    kind: str
    asset_type: str
    master: Path
    silhouette: Path
    master_override: _MasterOverride | None


@dataclass(frozen=True, slots=True)
class _SelectedSheet:
    source_stem: str
    review: int
    ignored_reviews: tuple[int, ...]
    sheet_id: str
    category: str
    asset_type: str
    source_sha256: str
    assets: tuple[_PreparedAsset, ...]


@dataclass(frozen=True, slots=True)
class _PricingRules:
    pack_id: str
    pricing_version: int
    category_role_costs: dict[tuple[str, str], int]
    asset_overrides: dict[str, int]


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
    if not path.is_dir() or _is_reparse_point(path):
        raise RasterCatalogError(f"{label} must be a plain existing directory")
    return path.absolute()


def _require_empty_target(path: Path, label: str) -> None:
    current = path.absolute()
    while True:
        if _is_reparse_point(current):
            raise RasterCatalogError(f"{label} may not use a symlink or reparse point")
        parent = current.parent
        if parent == current:
            break
        current = parent
    if path.exists() and (not path.is_dir() or next(path.iterdir(), None) is not None):
        raise RasterCatalogError(f"{label} must be absent or empty")


def _overlap(first: Path, second: Path) -> bool:
    left, right = first.absolute(), second.absolute()
    return left == right or left in right.parents or right in left.parents


def _read_json(path: Path, label: str) -> dict[str, Any]:
    if not path.is_file() or _is_reparse_point(path):
        raise RasterCatalogError(f"{label} is missing or unsafe")
    try:
        value = json.loads(path.read_bytes().decode("utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RasterCatalogError(f"{label} is not valid UTF-8 JSON") from error
    if not isinstance(value, dict):
        raise RasterCatalogError(f"{label} must contain one JSON object")
    return value


def _trimmed_text(value: object, label: str, maximum: int) -> str:
    if (
        not isinstance(value, str)
        or not value
        or value != value.strip()
        or len(value) > maximum
        or any(ord(character) < 32 for character in value)
    ):
        raise RasterCatalogError(f"{label} must be safe trimmed text")
    return value


def _sorted_tags(value: object, label: str) -> tuple[str, ...]:
    if not isinstance(value, list) or not value or len(value) > 64:
        raise RasterCatalogError(f"{label} must be a non-empty tag list")
    tags = tuple(_trimmed_text(tag, label, 80) for tag in value)
    if tags != tuple(sorted(set(tags))):
        raise RasterCatalogError(f"{label} must be sorted and unique")
    return tags


def _market_cost_cents(value: object, label: str) -> int:
    if type(value) is not int or value <= 0 or value > 1_000_000:
        raise RasterCatalogError(f"{label} must be a positive integer up to 1000000 cents")
    return value


def _pricing_rules(
    path: Path,
    selected_sheets: Sequence[_SelectedSheet],
    all_assets: Sequence[_PreparedAsset],
) -> _PricingRules:
    value = _read_json(path, "raster production pricing rules")
    if set(value) != {"schema", "packId", "pricingVersion", "categoryRoleCosts", "assetOverrides"} or \
        value.get("schema") != "raster-production-pricing-rules@1" or \
        value.get("packId") != "offline-core-v1":
        raise RasterCatalogError("raster production pricing rules have the wrong schema or pack")
    pricing_version = value.get("pricingVersion")
    if type(pricing_version) is not int or pricing_version < 1 or pricing_version > 1_000_000:
        raise RasterCatalogError("pricingVersion must be a positive bounded integer")

    raw_costs = value.get("categoryRoleCosts")
    if not isinstance(raw_costs, dict) or not raw_costs or len(raw_costs) > 128 or \
        list(raw_costs) != sorted(raw_costs):
        raise RasterCatalogError("categoryRoleCosts must be a non-empty, sorted object")
    costs: dict[tuple[str, str], int] = {}
    for category, roles in raw_costs.items():
        if _trimmed_text(category, "pricing category", 80) != category or \
            not isinstance(roles, dict) or not roles or list(roles) != sorted(roles):
            raise RasterCatalogError(f"pricing roles for {category} must be a non-empty, sorted object")
        for source_type, cost in roles.items():
            if source_type not in SUPPORTED_ASSET_TYPES:
                raise RasterCatalogError(f"pricing role {source_type} for {category} is unsupported")
            costs[(category, source_type)] = _market_cost_cents(
                cost, f"pricing cost for {category}/{source_type}"
            )

    expected_pairs = {(sheet.category, sheet.asset_type) for sheet in selected_sheets}
    if set(costs) != expected_pairs:
        missing = sorted(expected_pairs.difference(costs))
        unknown = sorted(set(costs).difference(expected_pairs))
        raise RasterCatalogError(f"pricing rules must exactly cover selected category/type pairs; missing={missing}, unknown={unknown}")

    raw_overrides = value.get("assetOverrides")
    if not isinstance(raw_overrides, dict) or len(raw_overrides) > 20_000 or \
        list(raw_overrides) != sorted(raw_overrides):
        raise RasterCatalogError("assetOverrides must be a sorted object")
    asset_ids = {asset.id for asset in all_assets}
    overrides: dict[str, int] = {}
    for asset_id, cost in raw_overrides.items():
        if not isinstance(asset_id, str) or not PORTABLE_ID.fullmatch(asset_id) or asset_id not in asset_ids:
            raise RasterCatalogError(f"pricing override {asset_id!r} does not name a selected asset")
        overrides[asset_id] = _market_cost_cents(cost, f"pricing override for {asset_id}")
    return _PricingRules("offline-core-v1", pricing_version, costs, overrides)


def _hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _master_override(
    value: object,
    inventory_root: Path,
    label: str,
) -> _MasterOverride:
    if not isinstance(value, dict):
        raise RasterCatalogError(f"{label} must be an object")
    if set(value) != {"path", "sha256"}:
        raise RasterCatalogError(f"{label} must contain exactly path and sha256")
    relative_path = value.get("path")
    components = relative_path.split("/") if isinstance(relative_path, str) else []
    if (
        not isinstance(relative_path, str)
        or not relative_path
        or relative_path != relative_path.strip()
        or any(ord(character) < 32 for character in relative_path)
        or "\\" in relative_path
        or ":" in relative_path
        or PurePosixPath(relative_path).is_absolute()
        or bool(PureWindowsPath(relative_path).drive)
        or any(component in {"", ".", ".."} for component in components)
        or PurePosixPath(relative_path).suffix != ".png"
    ):
        raise RasterCatalogError(f"{label} path must be a safe slash-relative PNG path")
    source_sha256 = value.get("sha256")
    if not isinstance(source_sha256, str) or re.fullmatch(r"[0-9a-f]{64}", source_sha256) is None:
        raise RasterCatalogError(f"{label} sha256 must be a 64-character lowercase SHA-256")

    root = inventory_root.absolute()
    candidate = root.joinpath(*components).absolute()
    if root not in candidate.parents:
        raise RasterCatalogError(f"{label} path must resolve inside the inventory root")
    current = root
    for index, component in enumerate(components):
        current /= component
        if _is_reparse_point(current):
            raise RasterCatalogError(f"{label} path may not use a symlink or reparse point")
        if index < len(components) - 1 and not current.is_dir():
            raise RasterCatalogError(f"{label} file is missing or unsafe")
    try:
        metadata = candidate.lstat()
        resolved_root = root.resolve(strict=True)
        resolved_candidate = candidate.resolve(strict=True)
    except OSError as error:
        raise RasterCatalogError(f"{label} file is missing or unsafe") from error
    if (
        not stat.S_ISREG(metadata.st_mode)
        or _is_reparse_point(candidate)
        or resolved_root not in resolved_candidate.parents
    ):
        raise RasterCatalogError(f"{label} file is missing or unsafe")
    try:
        actual_sha256 = _hash(candidate)
    except OSError as error:
        raise RasterCatalogError(f"{label} file is missing or unsafe") from error
    if _is_reparse_point(candidate):
        raise RasterCatalogError(f"{label} path may not use a symlink or reparse point")
    if actual_sha256 != source_sha256:
        raise RasterCatalogError(f"{label} hash does not match its file")
    try:
        canonical = load_canonical_rgba(candidate)
        canonical.close()
    except NormalizationError as error:
        raise RasterCatalogError(f"{label} file must be a valid raster master") from error
    return _MasterOverride(relative_path, source_sha256, candidate)


def _inventory(
    path: Path,
    inventory_root: Path,
    source_stem: str,
    expected_coordinates: set[tuple[int, int]],
) -> dict[tuple[int, int], _InventoryItem]:
    value = _read_json(path, f"inventory for {source_stem}")
    allowed = {"schema", "sheetId", "sheetNumber", "sourcePng", "items"}
    if (
        not {"schema", "items"}.issubset(value)
        or not set(value).issubset(allowed)
        or value.get("schema") != "contact-sheet-inventory@1"
    ):
        raise RasterCatalogError(f"inventory for {source_stem} has the wrong schema")
    if "sheetId" in value and value.get("sheetId") != source_stem:
        raise RasterCatalogError(f"inventory for {source_stem} has a mismatched sheetId")
    if "sourcePng" in value and value.get("sourcePng") != f"{source_stem}.png":
        raise RasterCatalogError(f"inventory for {source_stem} has a mismatched sourcePng")
    number_match = re.match(r"^([0-9]+)-", source_stem)
    if "sheetNumber" in value and (
        number_match is None
        or type(value.get("sheetNumber")) is not int
        or value.get("sheetNumber") != int(number_match.group(1))
    ):
        raise RasterCatalogError(f"inventory for {source_stem} has a mismatched sheetNumber")
    if not any(key in value for key in ("sheetId", "sourcePng", "sheetNumber")):
        raise RasterCatalogError(f"inventory for {source_stem} has no source identity")
    items = value.get("items")
    expected_count = len(expected_coordinates)
    if not isinstance(items, list) or len(items) != expected_count:
        raise RasterCatalogError(
            f"inventory for {source_stem} must contain exactly {expected_count} items"
        )
    result: dict[tuple[int, int], _InventoryItem] = {}
    for index, item in enumerate(items):
        required_item_keys = {"row", "column", "label", "tags"}
        if (
            not isinstance(item, dict)
            or not required_item_keys.issubset(item)
            or not set(item).issubset(required_item_keys | {"masterOverride"})
        ):
            raise RasterCatalogError(f"inventory item {index + 1} for {source_stem} is malformed")
        row, column = item.get("row"), item.get("column")
        if type(row) is not int or type(column) is not int:
            raise RasterCatalogError(f"inventory coordinates for {source_stem} must be integers")
        coordinate = (row, column)
        if coordinate not in expected_coordinates or coordinate in result:
            raise RasterCatalogError(
                f"inventory for {source_stem} requires {expected_count} unique grid coordinates"
            )
        override = (
            _master_override(
                item.get("masterOverride"),
                inventory_root,
                f"masterOverride for {source_stem} r{row:02}c{column:02}",
            )
            if "masterOverride" in item
            else None
        )
        result[coordinate] = _InventoryItem(
            label=_trimmed_text(item.get("label"), f"inventory label for {source_stem}", 160),
            tags=_sorted_tags(item.get("tags"), f"inventory tags for {source_stem}"),
            master_override=override,
        )
    if set(result) != expected_coordinates:
        raise RasterCatalogError(
            f"inventory for {source_stem} requires {expected_count} unique grid coordinates"
        )
    return result


def _asset_files(sheet: Path, metadata: dict[str, Any], label: str) -> tuple[Path, Path]:
    asset_id = metadata.get("id")
    if not isinstance(asset_id, str) or not PORTABLE_ID.fullmatch(asset_id) or len(asset_id) > 120:
        raise RasterCatalogError(f"{label} has an invalid extracted asset ID")
    asset_dir = sheet / "assets" / asset_id
    if not asset_dir.is_dir() or _is_reparse_point(asset_dir):
        raise RasterCatalogError(f"{label} asset directory is missing or unsafe")
    files = metadata.get("files")
    expected = {
        "master": "master.png",
        "silhouetteMask": "silhouette-mask.png",
        "inkOverlay": "ink-overlay.png",
    }
    if files != expected:
        raise RasterCatalogError(f"{label} must use the reviewed raster layer filenames")
    master, silhouette, ink = (asset_dir / expected[key] for key in ("master", "silhouetteMask", "inkOverlay"))
    if any(not path.is_file() or _is_reparse_point(path) for path in (master, silhouette, ink)):
        raise RasterCatalogError(f"{label} is missing a safe raster layer")
    try:
        with Image.open(master) as opened_master, Image.open(silhouette) as opened_mask, Image.open(ink) as opened_ink:
            opened_master.load()
            opened_mask.load()
            opened_ink.load()
            rgba = opened_master.convert("RGBA")
            mask = opened_mask.convert("L")
            ink_rgba = opened_ink.convert("RGBA")
    except (OSError, UnidentifiedImageError) as error:
        raise RasterCatalogError(f"{label} contains an invalid raster layer") from error
    if rgba.size != mask.size or rgba.size != ink_rgba.size or rgba.getchannel("A").getbbox() is None:
        raise RasterCatalogError(f"{label} layers are empty or dimensionally inconsistent")
    if ink_rgba.getchannel("A").getbbox() is None:
        raise RasterCatalogError(f"{label} has no ink overlay")
    alpha = rgba.getchannel("A")
    if ImageChops.difference(alpha, mask).getbbox() is not None:
        raise RasterCatalogError(f"{label} silhouette does not match its master alpha")
    border_maxima = (
        alpha.crop((0, 0, alpha.width, 1)).getextrema()[1],
        alpha.crop((0, alpha.height - 1, alpha.width, alpha.height)).getextrema()[1],
        alpha.crop((0, 0, 1, alpha.height)).getextrema()[1],
        alpha.crop((alpha.width - 1, 0, alpha.width, alpha.height)).getextrema()[1],
    )
    if any(border_maxima):
        raise RasterCatalogError(f"{label} touches its raster edge")
    return master, silhouette


def _preflight_sheet(
    sheet: Path,
    report: dict[str, Any],
    inventory_root: Path,
    review: int,
    ignored_reviews: tuple[int, ...],
) -> _SelectedSheet:
    sheet_id = _trimmed_text(report.get("sheetId"), "sheetId", 160)
    if sheet_id != sheet.name or report.get("schema") != "generated-raster-sheet@1":
        raise RasterCatalogError(f"sheet report for {sheet.name} has a mismatched identity")
    grid = report.get("grid")
    if not isinstance(grid, dict) or set(grid) != {"columns", "rows"}:
        raise RasterCatalogError(f"sheet {sheet_id} does not declare a supported exact grid")
    columns, rows = grid.get("columns"), grid.get("rows")
    if type(columns) is not int or type(rows) is not int:
        raise RasterCatalogError(f"sheet {sheet_id} does not declare a supported exact grid")
    raw_row_counts = report.get("rowCounts")
    if raw_row_counts is None:
        row_counts = (columns,) * rows
        if (columns, rows, row_counts) not in SUPPORTED_LAYOUTS:
            raise RasterCatalogError(f"sheet {sheet_id} does not declare a supported exact grid")
    elif (
        not isinstance(raw_row_counts, list)
        or len(raw_row_counts) != rows
        or any(type(count) is not int or count < 1 for count in raw_row_counts)
    ):
        raise RasterCatalogError(f"sheet {sheet_id} does not declare a supported exact layout")
    else:
        row_counts = tuple(raw_row_counts)
        if max(row_counts, default=0) != columns or (columns, rows, row_counts) not in SUPPORTED_LAYOUTS:
            raise RasterCatalogError(f"sheet {sheet_id} does not declare a supported exact layout")
    expected_coordinates = {
        (row, column)
        for row, row_count in enumerate(row_counts, start=1)
        for column in range(1, row_count + 1)
    }
    expected_count = len(expected_coordinates)
    if report.get("assetCount") != expected_count:
        raise RasterCatalogError(
            f"sheet {sheet_id} asset count does not match its supported exact grid"
        )
    if report.get("edgeContactCount") != 0:
        raise RasterCatalogError(f"sheet {sheet_id} has edge-contact failures")
    if report.get("safeInsetBreachCount") != 0:
        raise RasterCatalogError(f"sheet {sheet_id} has safe-inset failures")
    asset_type = report.get("type")
    if asset_type not in SUPPORTED_ASSET_TYPES:
        raise RasterCatalogError(f"sheet {sheet_id} has an unsupported asset type")
    category = _trimmed_text(report.get("category"), f"category for {sheet_id}", 80)
    source_value = report.get("source")
    if not isinstance(source_value, str):
        raise RasterCatalogError(f"sheet {sheet_id} has no source image")
    source_path = Path(source_value).absolute()
    source_stem = source_path.stem
    allowed_source_parents = {inventory_root, (inventory_root / "tiles").absolute()}
    expected_source = (source_path.parent / f"{source_stem}.png").absolute()
    if source_path.parent not in allowed_source_parents or source_path != expected_source or \
        not source_path.is_file() or _is_reparse_point(source_path):
        raise RasterCatalogError(f"sheet {sheet_id} source is outside the inventory root")
    source_sha256 = report.get("sourceSha256")
    if not isinstance(source_sha256, str) or source_sha256 != _hash(source_path):
        raise RasterCatalogError(f"sheet {sheet_id} source hash does not match")
    item_inventory = _inventory(
        source_path.with_suffix(".inventory.json"),
        inventory_root,
        source_stem,
        expected_coordinates,
    )
    report_assets = report.get("assets")
    if not isinstance(report_assets, list) or len(report_assets) != expected_count:
        raise RasterCatalogError(
            f"sheet {sheet_id} report must contain exactly {expected_count} asset records"
        )
    prepared: list[_PreparedAsset] = []
    coordinates: set[tuple[int, int]] = set()
    for index, asset in enumerate(report_assets):
        if not isinstance(asset, dict):
            raise RasterCatalogError(f"sheet {sheet_id} asset {index + 1} is malformed")
        grid = asset.get("grid")
        if not isinstance(grid, dict):
            raise RasterCatalogError(f"sheet {sheet_id} asset {index + 1} has no grid coordinate")
        coordinate = (grid.get("row"), grid.get("column"))
        if coordinate not in expected_coordinates or coordinate in coordinates:
            raise RasterCatalogError(
                f"sheet {sheet_id} assets require {expected_count} unique grid coordinates"
            )
        coordinates.add(coordinate)
        if asset.get("schema") != "generated-raster-template@1" or asset.get("sheetId") != sheet_id:
            raise RasterCatalogError(f"sheet {sheet_id} asset {index + 1} has a mismatched identity")
        if asset.get("type") != asset_type or asset.get("category") != category:
            raise RasterCatalogError(f"sheet {sheet_id} asset {index + 1} conflicts with its sheet")
        qa = asset.get("qa")
        if not isinstance(qa, dict) or qa.get("edgeContact") is not False or qa.get("safeInsetBreach") is not False:
            raise RasterCatalogError(f"sheet {sheet_id} asset {index + 1} failed extraction QA")
        generic_tags = _sorted_tags(asset.get("tags"), f"extraction tags for {sheet_id}")
        inventory_item = item_inventory[coordinate]
        master, silhouette = _asset_files(sheet, asset, f"{sheet_id} r{coordinate[0]}c{coordinate[1]}")
        if inventory_item.master_override is not None:
            master = inventory_item.master_override.path
        stable_id = f"{source_stem}-r{coordinate[0]:02}c{coordinate[1]:02}"
        if len(stable_id) > 80 or not PORTABLE_ID.fullmatch(stable_id):
            raise RasterCatalogError(f"stable catalogue ID {stable_id} is not portable")
        prepared.append(_PreparedAsset(
            id=stable_id,
            title=inventory_item.label,
            category=category,
            tags=tuple(sorted(set((*generic_tags, *inventory_item.tags, asset_type)))),
            kind="component" if asset_type == "add-on" else "raster-master",
            asset_type=asset_type,
            master=master,
            silhouette=silhouette,
            master_override=inventory_item.master_override,
        ))
    if coordinates != expected_coordinates:
        raise RasterCatalogError(
            f"sheet {sheet_id} assets require {expected_count} unique grid coordinates"
        )
    return _SelectedSheet(
        source_stem=source_stem,
        review=review,
        ignored_reviews=ignored_reviews,
        sheet_id=sheet_id,
        category=category,
        asset_type=asset_type,
        source_sha256=source_sha256,
        assets=tuple(sorted(prepared, key=lambda asset: asset.id)),
    )


def _select_reports(extracted_root: Path) -> list[tuple[Path, dict[str, Any], int, tuple[int, ...]]]:
    grouped: dict[str, list[tuple[int, Path, dict[str, Any]]]] = {}
    for directory in sorted(extracted_root.iterdir(), key=lambda path: path.name):
        match = REVIEWED_DIRECTORY.fullmatch(directory.name)
        if not match or not directory.is_dir() or _is_reparse_point(directory):
            continue
        report = _read_json(directory / "sheet-report.json", f"sheet report for {directory.name}")
        source_value = report.get("source")
        if not isinstance(source_value, str):
            raise RasterCatalogError(f"sheet report for {directory.name} has no source")
        grouped.setdefault(Path(source_value).stem, []).append((int(match.group("review")), directory, report))
    if not grouped:
        raise RasterCatalogError("no reviewed raster extraction sheets were found")
    selected: list[tuple[Path, dict[str, Any], int, tuple[int, ...]]] = []
    for source_stem, versions in sorted(grouped.items()):
        versions.sort(key=lambda entry: entry[0])
        review, directory, report = versions[-1]
        ignored = tuple(item[0] for item in versions[:-1])
        selected.append((directory, report, review, ignored))
    return selected


def build_raster_catalog(
    extracted: str | Path,
    inventory: str | Path,
    out: str | Path,
    report: str | Path,
    *,
    minimum_records: int = 0,
    minimum_product_records: int = 0,
) -> list[CatalogAsset]:
    """Build an additive, deterministic offline pack from reviewed raster cells."""

    if type(minimum_records) is not int or minimum_records < 0 or minimum_records > 20_000:
        raise RasterCatalogError("minimum records must be an integer from 0 to 20000")
    if type(minimum_product_records) is not int or minimum_product_records < 0 or minimum_product_records > 20_000:
        raise RasterCatalogError("minimum product records must be an integer from 0 to 20000")
    extracted_root = _require_plain_directory(Path(extracted), "extracted raster root")
    inventory_root = _require_plain_directory(Path(inventory), "contact-sheet inventory root")
    output_path, report_path = Path(out), Path(report)
    _require_empty_target(output_path, "output directory")
    _require_empty_target(report_path, "report directory")
    if _overlap(output_path, report_path):
        raise RasterCatalogError("output and report directories must be separate")
    if any(_overlap(root, target) for root in (extracted_root, inventory_root) for target in (output_path, report_path)):
        raise RasterCatalogError("output and report directories may not overlap source roots")

    selected_sheets = [
        _preflight_sheet(directory, payload, inventory_root, review, ignored)
        for directory, payload, review, ignored in _select_reports(extracted_root)
    ]
    all_assets = [asset for sheet in selected_sheets for asset in sheet.assets]
    if len(all_assets) > 20_000 or len({asset.id for asset in all_assets}) != len(all_assets):
        raise RasterCatalogError("reviewed raster catalogue has duplicate IDs or exceeds 20,000 records")
    if len(all_assets) < minimum_records:
        raise RasterCatalogError(
            f"reviewed raster catalogue must contain at least {minimum_records} records; "
            f"found {len(all_assets)}"
        )
    rules = _pricing_rules(inventory_root / PRICING_RULES_FILENAME, selected_sheets, all_assets)
    product_assets = [asset for asset in all_assets if PRICING_ROLE[asset.asset_type] != "media"]
    if len(product_assets) < minimum_product_records:
        raise RasterCatalogError(
            f"reviewed raster catalogue must contain at least {minimum_product_records} priced product records; "
            f"found {len(product_assets)}"
        )

    output_path.mkdir(parents=True, exist_ok=True)
    report_path.mkdir(parents=True, exist_ok=True)
    records: list[CatalogAsset] = []
    try:
        for asset in sorted(all_assets, key=lambda item: item.id):
            destination = output_path / "assets" / asset.id
            normalized = normalize_master(asset.master, destination)
            masks = prepare_masks(
                normalized.master_path,
                {
                    "body": normalized.master_path
                    if asset.master_override is not None
                    else asset.silhouette
                },
                ["body"],
                destination / "masks",
            )
            base = f"{CATALOGUE_ASSET_ROOT}/{asset.id}"
            records.append(CatalogAsset.model_validate({
                "schema": "catalog-asset@1",
                "delivery": "offline",
                "id": asset.id,
                "version": 1,
                "kind": asset.kind,
                "title": asset.title,
                "category": asset.category,
                "tags": list(asset.tags),
                "files": {
                    "thumbnail": f"{base}/thumbnail-192.webp",
                    "preview": f"{base}/preview-640.webp",
                    "master": f"{base}/master.png",
                    "masks": {"body": f"{base}/masks/body.png"},
                },
                "masterSha256": normalized.master_sha256,
                "dimensions": {"width": normalized.dimensions[0], "height": normalized.dimensions[1]},
                "recolourZones": ["body"],
                "anchors": [],
                "materialProfiles": ["matte-plastic"],
                "classroomReviewed": True,
                "brandFree": True,
                "attribution": {
                    "creator": "Peter Ellis classroom asset pack",
                    "sourceUrl": "local",
                    "license": "Classroom-session use",
                },
                "defaultZoneStyles": {
                    "body": {"colour": "#F4F4F4", "materialId": "matte-plastic", "opacity": 1.0}
                },
            }, strict=True))
            if set(masks) != {"body"}:
                raise RasterCatalogError(f"asset {asset.id} did not produce its body mask")
    except (OSError, NormalizationError, MaskValidationError, ValidationError) as error:
        raise RasterCatalogError(f"raster catalogue could not be written: {error}") from error

    records.sort(key=lambda record: record.id)
    catalog_bytes = canonical_json_bytes([
        record.model_dump(by_alias=True, exclude_none=True) for record in records
    ])
    (output_path / "catalog.json").write_bytes(catalog_bytes)
    pricing_entries = [
        {
            "assetId": asset.id,
            "costCents": rules.asset_overrides.get(
                asset.id,
                rules.category_role_costs[(asset.category, asset.asset_type)],
            ),
            "role": PRICING_ROLE[asset.asset_type],
        }
        for asset in sorted(all_assets, key=lambda item: item.id)
    ]
    (output_path / "pricing.json").write_bytes(canonical_json_bytes({
        "schema": "raster-production-pricing@1",
        "packId": rules.pack_id,
        "pricingVersion": rules.pricing_version,
        "catalogSha256": hashlib.sha256(catalog_bytes).hexdigest(),
        "entries": pricing_entries,
    }))
    selection: list[dict[str, Any]] = []
    for sheet in selected_sheets:
        selected_source: dict[str, Any] = {
            "assetCount": len(sheet.assets),
            "category": sheet.category,
            "ignoredOlderReviews": list(sheet.ignored_reviews),
            "selectedReview": sheet.review,
            "sheetId": sheet.sheet_id,
            "sourceSha256": sheet.source_sha256,
            "sourceStem": sheet.source_stem,
            "type": sheet.asset_type,
        }
        overrides = [
            {
                "assetId": asset.id,
                "path": asset.master_override.relative_path,
                "sourceSha256": asset.master_override.source_sha256,
            }
            for asset in sorted(sheet.assets, key=lambda item: item.id)
            if asset.master_override is not None
        ]
        if overrides:
            selected_source["masterOverrides"] = overrides
        selection.append(selected_source)
    (report_path / "source-selection.json").write_bytes(canonical_json_bytes(selection))
    qa = verify_catalogue(
        output_path / "catalog.json",
        output_path,
        require_masters=len(records),
        require_categories=len({record.category for record in records}),
        require_records=len(records),
        url_roots={f"{CATALOGUE_ROOT}/": output_path},
    )
    (report_path / "qa.json").write_bytes(canonical_json_bytes(qa))
    role_counts = {
        role: sum(1 for entry in pricing_entries if entry["role"] == role)
        for role in ("base", "media", "part")
    }
    (report_path / "pricing-qa.json").write_bytes(canonical_json_bytes({
        "entries": len(pricing_entries),
        "mediaAssets": role_counts["media"],
        "productAssets": role_counts["base"] + role_counts["part"],
        "roleCounts": role_counts,
    }))
    if qa["errors"]:
        raise RasterCatalogError(f"written raster catalogue failed QA: {qa['errors']}")
    return records


def main(argv: Sequence[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Package reviewed raster templates")
    parser.add_argument("--extracted", type=Path, required=True)
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--minimum-records", type=int, default=2_000)
    parser.add_argument("--minimum-product-records", type=int, default=2_000)
    arguments = parser.parse_args(argv)
    records = build_raster_catalog(
        arguments.extracted,
        arguments.inventory,
        arguments.out,
        arguments.report,
        minimum_records=arguments.minimum_records,
        minimum_product_records=arguments.minimum_product_records,
    )
    print(f"Packaged {len(records)} reviewed raster assets")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


__all__ = ["RasterCatalogError", "build_raster_catalog", "main"]
