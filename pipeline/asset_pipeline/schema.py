"""Strict, deterministic contracts for source packs and catalogue records.

The Python models deliberately keep idiomatic snake_case attribute names while
accepting and emitting the camelCase names used by the browser runtime.  File
and identifier checks live here so every pipeline entry point shares the same
portable boundary.
"""

from __future__ import annotations

import json
import math
import re
import unicodedata
from pathlib import PurePosixPath
from typing import Annotated, Any, Iterable, Literal, Mapping, Sequence

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)


PORTABLE_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)
HEX_COLOUR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")
WINDOWS_RESERVED_NAMES = frozenset(
    {
        "con",
        "prn",
        "aux",
        "nul",
        "clock$",
        *(f"com{number}" for number in range(1, 10)),
        *(f"lpt{number}" for number in range(1, 10)),
    }
)

OFFLINE_ROOTS = (
    "/catalog/generated/offline-core-v1/assets/",
    "/catalog/generated/performance-fixtures/assets/",
)
LIVE_IMAGE_PREFIX = "/api/openverse-image/"
MAX_SOURCE_PATH_LENGTH = 180
MAX_AUTHORED_BASES = 1_000
MAX_CATALOGUE_RECORDS = 20_000

RecolourZone = Literal["body", "trim", "accent", "label"]
AssetKind = Literal[
    "raster-master",
    "component",
    "svg",
    "texture",
    "shape",
    "photo",
    "shell",
]
MaterialProfile = Literal[
    "matte-plastic",
    "gloss-plastic",
    "rubber",
    "cardboard",
    "fabric",
    "glass",
    "brushed-metal",
    "wood",
]

ZONE_ORDER: tuple[RecolourZone, ...] = ("body", "trim", "accent", "label")
MATERIAL_PROFILES: frozenset[str] = frozenset(
    {
        "matte-plastic",
        "gloss-plastic",
        "rubber",
        "cardboard",
        "fabric",
        "glass",
        "brushed-metal",
        "wood",
    }
)

StrictPositiveInt = Annotated[int, Field(strict=True, gt=0)]
StrictByte = Annotated[int, Field(strict=True, ge=0, le=255)]
StrictNonNegativeInt = Annotated[int, Field(strict=True, ge=0)]
StrictUnitFloat = Annotated[
    float,
    Field(strict=True, ge=0.0, le=1.0, allow_inf_nan=False),
]


def _to_camel(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in tail)


class ContractModel(BaseModel):
    """Base model for closed, strict external contracts."""

    model_config = ConfigDict(
        alias_generator=_to_camel,
        extra="forbid",
        populate_by_name=True,
        strict=True,
        validate_default=True,
    )


def _portable_collision_key(value: str) -> str:
    return unicodedata.normalize("NFKC", value).casefold()


def validate_portable_ids(ids: Iterable[str]) -> list[str]:
    """Return canonical IDs or reject IDs unsafe on Windows and web paths.

    Collision detection happens before syntax validation so visually equivalent
    Unicode spellings cannot silently collapse even when both spellings are
    otherwise non-canonical.
    """

    if isinstance(ids, (str, bytes)):
        raise ValueError("portable IDs must be supplied as a sequence")

    values = list(ids)
    seen: dict[str, str] = {}
    for value in values:
        if not isinstance(value, str):
            raise ValueError("portable IDs must be strings")
        key = _portable_collision_key(value)
        if key in seen:
            raise ValueError(
                f"portable ID collision between {seen[key]!r} and {value!r}"
            )
        seen[key] = value

    for value in values:
        if not 1 <= len(value) <= 80:
            raise ValueError("portable IDs must contain between 1 and 80 characters")
        if value != value.strip() or value.endswith((".", " ")):
            raise ValueError(f"portable ID has a trailing dot or space: {value!r}")
        if not value.isascii() or PORTABLE_ID_PATTERN.fullmatch(value) is None:
            raise ValueError(
                f"portable ID must be lowercase ASCII kebab case: {value!r}"
            )
        if value.casefold() in WINDOWS_RESERVED_NAMES:
            raise ValueError(f"portable ID is reserved on Windows: {value!r}")

    return values


def _portable_id(value: str) -> str:
    return validate_portable_ids([value])[0]


def _trimmed_text(value: str, label: str, *, maximum: int) -> str:
    if not value or value != value.strip():
        raise ValueError(f"{label} must be non-empty and have no outer whitespace")
    if len(value) > maximum:
        raise ValueError(f"{label} may not exceed {maximum} characters")
    if any(ord(character) < 32 for character in value):
        raise ValueError(f"{label} may not contain control characters")
    return value


def _sorted_unique_text(
    values: Sequence[str],
    label: str,
    *,
    maximum_items: int = 64,
    maximum_length: int = 80,
    require_sorted: bool = True,
) -> list[str]:
    result = [
        _trimmed_text(value, f"{label} entry", maximum=maximum_length)
        for value in values
    ]
    if len(result) > maximum_items:
        raise ValueError(f"{label} may not contain more than {maximum_items} entries")
    keys = [_portable_collision_key(value) for value in result]
    if len(keys) != len(set(keys)):
        raise ValueError(f"{label} entries must be unique after Unicode normalization")
    if require_sorted and result != sorted(result):
        raise ValueError(f"{label} entries must be sorted")
    return result


def _sha256(value: str) -> str:
    if SHA256_PATTERN.fullmatch(value) is None:
        raise ValueError("SHA-256 must be exactly 64 lowercase hexadecimal characters")
    return value


def _relative_source_path(value: str) -> str:
    _trimmed_text(value, "source path", maximum=MAX_SOURCE_PATH_LENGTH)
    if "\\" in value or "\0" in value:
        raise ValueError("source paths must use POSIX separators")
    if any(character in value for character in ("?", "#", "%", ":")):
        raise ValueError("source paths must be literal relative POSIX paths")
    path = PurePosixPath(value)
    if path.is_absolute() or value.startswith("/"):
        raise ValueError("source paths must be relative")
    if any(part in ("", ".", "..") for part in value.split("/")):
        raise ValueError("source paths may not contain empty, dot, or parent segments")
    if path.as_posix() != value:
        raise ValueError("source paths must be canonical POSIX paths")
    for part in path.parts:
        if part.endswith((".", " ")) or part.casefold().split(".", 1)[0] in WINDOWS_RESERVED_NAMES:
            raise ValueError("source paths contain a Windows-unsafe segment")
    return value


def _offline_path(value: str) -> str:
    _trimmed_text(value, "offline file path", maximum=512)
    if "\\" in value or "\0" in value:
        raise ValueError("offline file paths must use POSIX separators")
    if any(character in value for character in ("?", "#", "%", ":")):
        raise ValueError("offline file paths must be literal same-origin paths")
    if not any(value.startswith(root) for root in OFFLINE_ROOTS):
        raise ValueError("offline file paths must use a canonical generated asset root")
    if value.startswith("//") or any(
        part in ("", ".", "..") for part in value[1:].split("/")
    ):
        raise ValueError("offline file paths must be canonical POSIX paths")
    if PurePosixPath(value).as_posix() != value:
        raise ValueError("offline file paths must be canonical POSIX paths")
    return value


def _live_path(value: str, asset_id: str, variant: Literal["thumbnail", "full"]) -> str:
    expected = (
        f"{LIVE_IMAGE_PREFIX}{asset_id}?variant=thumbnail"
        if variant == "thumbnail"
        else f"{LIVE_IMAGE_PREFIX}{asset_id}"
    )
    if value != expected:
        raise ValueError(f"live photo path must be exactly {expected!r}")
    return value


def _zones(values: Sequence[RecolourZone]) -> list[RecolourZone]:
    result = list(values)
    if len(result) != len(set(result)):
        raise ValueError("recolour zones must be unique")
    expected = [zone for zone in ZONE_ORDER if zone in result]
    if result != expected:
        raise ValueError("recolour zones must use body, trim, accent, label order")
    return result


def _materials(values: Sequence[str]) -> list[str]:
    result = list(values)
    unknown = sorted(set(result).difference(MATERIAL_PROFILES))
    if unknown:
        raise ValueError(f"unknown material profile: {unknown[0]}")
    return _sorted_unique_text(result, "material profiles", maximum_items=8)


class Dimensions(ContractModel):
    width: Annotated[int, Field(strict=True, gt=0, le=16384)]
    height: Annotated[int, Field(strict=True, gt=0, le=16384)]

    @model_validator(mode="after")
    def validate_pixel_limit(self) -> "Dimensions":
        if self.width * self.height > 64_000_000:
            raise ValueError("asset dimensions may not exceed 64 megapixels")
        return self


class Attribution(ContractModel):
    creator: str
    source_url: str
    license: str

    @field_validator("creator", "source_url", "license")
    @classmethod
    def validate_text(cls, value: str, info: Any) -> str:
        return _trimmed_text(value, info.field_name, maximum=2_048)


class Anchor(ContractModel):
    id: str
    x: StrictUnitFloat
    y: StrictUnitFloat
    accepts: list[str] = Field(default_factory=list, max_length=256)

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return _portable_id(value)

    @field_validator("x", "y")
    @classmethod
    def validate_finite_coordinate(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("anchor coordinates must be finite")
        return value

    @field_validator("accepts")
    @classmethod
    def validate_accepts(cls, value: list[str]) -> list[str]:
        validate_portable_ids(value)
        if value != sorted(value):
            raise ValueError("anchor accepts values must be sorted")
        return value


class ZoneStyle(ContractModel):
    colour: str
    material_id: MaterialProfile
    opacity: StrictUnitFloat

    @field_validator("colour")
    @classmethod
    def validate_colour(cls, value: str) -> str:
        if HEX_COLOUR_PATTERN.fullmatch(value) is None:
            raise ValueError("zone colour must be a six-digit hexadecimal colour")
        return value

    @field_validator("opacity")
    @classmethod
    def validate_finite_opacity(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("zone opacity must be finite")
        return value


class CatalogFiles(ContractModel):
    thumbnail: str
    preview: str
    master: str
    masks: dict[RecolourZone, str] | None = None


class CatalogAsset(ContractModel):
    schema_id: Literal["catalog-asset@1"] = Field(alias="schema")
    delivery: Literal["offline", "live-photo"]
    id: str
    version: Literal[1]
    kind: AssetKind
    title: str
    category: str
    tags: list[str] = Field(max_length=64)
    files: CatalogFiles
    master_sha256: str | None = None
    dimensions: Dimensions
    recolour_zones: list[RecolourZone] = Field(max_length=4)
    anchors: list[Anchor] = Field(max_length=256)
    material_profiles: list[MaterialProfile] = Field(max_length=8)
    classroom_reviewed: bool
    brand_free: bool
    attribution: Attribution
    virtual_parent_id: str | None = None
    default_zone_styles: dict[RecolourZone, ZoneStyle] | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _trimmed_text(value, "title", maximum=160)

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        return _trimmed_text(value, "category", maximum=80)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: list[str]) -> list[str]:
        return _sorted_unique_text(value, "tags")

    @field_validator("recolour_zones")
    @classmethod
    def validate_zones(cls, value: list[RecolourZone]) -> list[RecolourZone]:
        return _zones(value)

    @field_validator("anchors")
    @classmethod
    def validate_anchors(cls, value: list[Anchor]) -> list[Anchor]:
        ids = [anchor.id for anchor in value]
        validate_portable_ids(ids)
        if ids != sorted(ids):
            raise ValueError("anchors must be sorted by ID")
        return value

    @field_validator("material_profiles")
    @classmethod
    def validate_materials(cls, value: list[MaterialProfile]) -> list[MaterialProfile]:
        return _materials(value)  # type: ignore[return-value]

    @model_validator(mode="after")
    def validate_delivery_contract(self) -> "CatalogAsset":
        mask_paths = self.files.masks
        mask_zones = set(mask_paths or {})
        declared_zones = set(self.recolour_zones)
        if mask_zones != declared_zones:
            raise ValueError("mask files must match recolourZones exactly")

        if self.default_zone_styles is not None:
            unknown_style_zones = set(self.default_zone_styles).difference(declared_zones)
            if unknown_style_zones:
                raise ValueError("default zone styles must target declared recolour zones")
            allowed_materials = set(self.material_profiles)
            if any(
                style.material_id not in allowed_materials
                for style in self.default_zone_styles.values()
            ):
                raise ValueError("default zone styles must use an asset material profile")

        if self.delivery == "offline":
            _portable_id(self.id)
            if self.dimensions.width > 8192 or self.dimensions.height > 8192:
                raise ValueError("offline asset dimensions may not exceed 8192 per axis")
            if self.master_sha256 is None:
                raise ValueError("offline assets require masterSha256")
            _sha256(self.master_sha256)
            if self.virtual_parent_id is not None:
                _portable_id(self.virtual_parent_id)
                if self.virtual_parent_id == self.id:
                    raise ValueError("an offline asset may not be its own virtual parent")

            thumbnail = _offline_path(self.files.thumbnail)
            preview = _offline_path(self.files.preview)
            master = _offline_path(self.files.master)
            if not thumbnail.endswith("/thumbnail-192.webp"):
                raise ValueError("offline thumbnails must be named thumbnail-192.webp")
            if not preview.endswith("/preview-640.webp"):
                raise ValueError("offline previews must be named preview-640.webp")
            if not master.endswith("/master.png"):
                raise ValueError("offline masters must be named master.png")

            parent = master.removesuffix("/master.png")
            if thumbnail != f"{parent}/thumbnail-192.webp" or preview != f"{parent}/preview-640.webp":
                raise ValueError("offline master, preview and thumbnail must share one asset directory")
            for zone, path in (mask_paths or {}).items():
                _offline_path(path)
                if path != f"{parent}/masks/{zone}.png":
                    raise ValueError("offline mask paths must use the canonical mask filename")
            return self

        if UUID_PATTERN.fullmatch(self.id) is None:
            raise ValueError("live photo IDs must be canonical lowercase UUIDs")
        if self.kind != "photo":
            raise ValueError("live-photo delivery requires kind photo")
        if self.master_sha256 is not None or self.virtual_parent_id is not None:
            raise ValueError("live photos may not contain offline identity fields")
        if self.default_zone_styles is not None:
            raise ValueError("live photos may not contain default zone styles")
        if mask_paths is not None:
            raise ValueError("live photos may not contain masks")
        if self.recolour_zones or self.anchors or self.material_profiles:
            raise ValueError("live photos may not contain offline editing metadata")
        if self.classroom_reviewed or self.brand_free:
            raise ValueError("live photos must remain unreviewed and not brand-free")
        _live_path(self.files.thumbnail, self.id, "thumbnail")
        _live_path(self.files.preview, self.id, "full")
        _live_path(self.files.master, self.id, "full")
        return self


class AssetSheet(ContractModel):
    schema_id: Literal["asset-sheet@1"] = Field(alias="schema")
    sheet_id: str
    source_path: str | None = None
    source_sha256: str
    chroma_rgb: list[StrictByte] = Field(min_length=3, max_length=3)
    colour_distance_formula: Literal["cie76-srgb-d65"]
    threshold: Annotated[
        float,
        Field(strict=True, ge=0.0, le=200.0, allow_inf_nan=False),
    ]
    alpha_cutoff: StrictByte
    component_area_floor: Annotated[int, Field(strict=True, gt=0, le=16_777_216)]
    padding: Annotated[int, Field(strict=True, ge=0, le=4096)]
    gutter: Annotated[int, Field(strict=True, ge=0, le=4096)]
    expected_component_count: Annotated[int, Field(strict=True, gt=0, le=256)]
    output_ids: list[str] = Field(min_length=1, max_length=256)

    @field_validator("sheet_id")
    @classmethod
    def validate_sheet_id(cls, value: str) -> str:
        return _portable_id(value)

    @field_validator("source_path")
    @classmethod
    def validate_source_path(cls, value: str | None) -> str | None:
        return None if value is None else _relative_source_path(value)

    @field_validator("source_sha256")
    @classmethod
    def validate_source_sha256(cls, value: str) -> str:
        return _sha256(value)

    @field_validator("threshold")
    @classmethod
    def validate_finite_threshold(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("chroma threshold must be finite")
        return value

    @field_validator("output_ids")
    @classmethod
    def validate_output_ids(cls, value: list[str]) -> list[str]:
        return validate_portable_ids(value)

    @model_validator(mode="after")
    def validate_output_count(self) -> "AssetSheet":
        if self.expected_component_count != len(self.output_ids):
            raise ValueError("expectedComponentCount must equal the number of outputIds")
        return self


class SourceAsset(ContractModel):
    id: str
    accepted: bool
    source_path: str | None = None
    sheet_id: str | None = None
    sheet_output_id: str | None = None
    source_sha256: str
    rejection_reason: str | None = None
    title: str
    category: str
    tags: list[str] = Field(max_length=64)
    kind: AssetKind
    masks: dict[RecolourZone, str] = Field(default_factory=dict)
    recolour_zones: list[RecolourZone] = Field(max_length=4)
    anchors: list[Anchor] = Field(max_length=256)
    material_profiles: list[MaterialProfile] = Field(max_length=8)
    classroom_reviewed: bool = False
    brand_free: bool = False
    attribution: Attribution
    default_zone_styles: dict[RecolourZone, ZoneStyle] | None = None

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return _portable_id(value)

    @field_validator("source_path")
    @classmethod
    def validate_source_path(cls, value: str | None) -> str | None:
        return None if value is None else _relative_source_path(value)

    @field_validator("sheet_id", "sheet_output_id")
    @classmethod
    def validate_sheet_reference(cls, value: str | None) -> str | None:
        return None if value is None else _portable_id(value)

    @field_validator("source_sha256")
    @classmethod
    def validate_source_sha256(cls, value: str) -> str:
        return _sha256(value)

    @field_validator("rejection_reason")
    @classmethod
    def validate_reason(cls, value: str | None) -> str | None:
        return None if value is None else _trimmed_text(value, "rejection reason", maximum=500)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _trimmed_text(value, "title", maximum=160)

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        return _trimmed_text(value, "category", maximum=80)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: list[str]) -> list[str]:
        return _sorted_unique_text(value, "tags")

    @field_validator("masks")
    @classmethod
    def validate_masks(cls, value: dict[RecolourZone, str]) -> dict[RecolourZone, str]:
        return {zone: _relative_source_path(path) for zone, path in value.items()}

    @field_validator("recolour_zones")
    @classmethod
    def validate_zones(cls, value: list[RecolourZone]) -> list[RecolourZone]:
        return _zones(value)

    @field_validator("anchors")
    @classmethod
    def validate_anchors(cls, value: list[Anchor]) -> list[Anchor]:
        ids = [anchor.id for anchor in value]
        validate_portable_ids(ids)
        if ids != sorted(ids):
            raise ValueError("anchors must be sorted by ID")
        return value

    @field_validator("material_profiles")
    @classmethod
    def validate_materials(cls, value: list[MaterialProfile]) -> list[MaterialProfile]:
        return _materials(value)  # type: ignore[return-value]

    @model_validator(mode="after")
    def validate_source_and_metadata(self) -> "SourceAsset":
        has_path = self.source_path is not None
        has_sheet_id = self.sheet_id is not None
        has_sheet_output = self.sheet_output_id is not None
        if has_path == (has_sheet_id and has_sheet_output):
            raise ValueError("a base asset must use exactly one source form")
        if has_sheet_id != has_sheet_output:
            raise ValueError("sheetId and sheetOutputId must be provided together")

        if self.accepted and self.rejection_reason is not None:
            raise ValueError("accepted assets may not have a rejection reason")
        if not self.accepted and self.rejection_reason is None:
            raise ValueError("rejected assets require a rejection reason")

        if set(self.masks) != set(self.recolour_zones):
            raise ValueError("mask files must match recolourZones exactly")
        if self.default_zone_styles is not None:
            if set(self.default_zone_styles).difference(self.recolour_zones):
                raise ValueError("default zone styles must target declared recolour zones")
            if any(
                style.material_id not in self.material_profiles
                for style in self.default_zone_styles.values()
            ):
                raise ValueError("default zone styles must use an asset material profile")
        return self


class VirtualAsset(ContractModel):
    id: str
    parent_id: str
    title: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    default_zone_styles: dict[RecolourZone, ZoneStyle] | None = None

    @field_validator("id", "parent_id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return _portable_id(value)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        return None if value is None else _trimmed_text(value, "title", maximum=160)

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str | None) -> str | None:
        return None if value is None else _trimmed_text(value, "category", maximum=80)

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else _sorted_unique_text(value, "tags")


class SourceManifest(ContractModel):
    schema_id: Literal["asset-source@1"] = Field(alias="schema")
    pack_id: str
    sheets: list[AssetSheet] = Field(default_factory=list, max_length=256)
    assets: list[SourceAsset] = Field(max_length=MAX_AUTHORED_BASES)
    virtual_assets: list[VirtualAsset] = Field(default_factory=list)

    @field_validator("pack_id")
    @classmethod
    def validate_pack_id(cls, value: str) -> str:
        return _portable_id(value)

    @model_validator(mode="after")
    def validate_manifest_graph(self) -> "SourceManifest":
        sheet_ids = [sheet.sheet_id for sheet in self.sheets]
        validate_portable_ids(sheet_ids)

        all_asset_ids = [asset.id for asset in self.assets] + [
            asset.id for asset in self.virtual_assets
        ]
        validate_portable_ids(all_asset_ids)

        accepted = {asset.id: asset for asset in self.assets if asset.accepted}
        if len(accepted) + len(self.virtual_assets) > MAX_CATALOGUE_RECORDS:
            raise ValueError("source manifest exceeds the catalogue record limit")

        sheet_lookup = {sheet.sheet_id: sheet for sheet in self.sheets}
        used_outputs: set[tuple[str, str]] = set()
        for sheet in self.sheets:
            if sheet.source_path is None:
                raise ValueError("sheets embedded in a source manifest require sourcePath")

        for asset in self.assets:
            if asset.sheet_id is None:
                continue
            sheet = sheet_lookup.get(asset.sheet_id)
            if sheet is None:
                raise ValueError(f"unknown sheetId: {asset.sheet_id}")
            reference = (asset.sheet_id, asset.sheet_output_id or "")
            if asset.sheet_output_id not in sheet.output_ids:
                raise ValueError(f"unknown sheet output: {asset.sheet_output_id}")
            if reference in used_outputs:
                raise ValueError("sheet outputs may be referenced only once")
            used_outputs.add(reference)

        expected_outputs = {
            (sheet.sheet_id, output_id)
            for sheet in self.sheets
            for output_id in sheet.output_ids
        }
        if used_outputs != expected_outputs:
            raise ValueError("every declared sheet output must map to exactly one base asset")

        for virtual in self.virtual_assets:
            parent = accepted.get(virtual.parent_id)
            if parent is None:
                raise ValueError("virtual assets must reference one accepted base asset")
            if virtual.default_zone_styles is not None:
                if set(virtual.default_zone_styles).difference(parent.recolour_zones):
                    raise ValueError("virtual styles must target parent recolour zones")
                if any(
                    style.material_id not in parent.material_profiles
                    for style in virtual.default_zone_styles.values()
                ):
                    raise ValueError("virtual styles must use a parent material profile")
        return self


def canonical_json_bytes(value: BaseModel | Mapping[str, Any] | Sequence[Any]) -> bytes:
    """Serialize canonical UTF-8 JSON with aliases, no BOM and one final LF."""

    if isinstance(value, BaseModel):
        payload: Any = value.model_dump(
            mode="json",
            by_alias=True,
            exclude_none=True,
        )
    else:
        payload = value
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )
    return f"{encoded}\n".encode("utf-8")


def validate_catalog_corpus_case(case: Mapping[str, Any]) -> bool:
    """Validate one shared corpus case and return whether it is accepted.

    This tiny helper lets Python and TypeScript loaders consume the same corpus
    without embedding test-only behavior in the models.
    """

    try:
        CatalogAsset.model_validate(case["value"], strict=True)
    except (KeyError, TypeError, ValidationError, ValueError):
        return False
    return True


__all__ = [
    "Anchor",
    "AssetSheet",
    "Attribution",
    "CatalogAsset",
    "CatalogFiles",
    "Dimensions",
    "SourceAsset",
    "SourceManifest",
    "VirtualAsset",
    "ZoneStyle",
    "canonical_json_bytes",
    "validate_catalog_corpus_case",
    "validate_portable_ids",
]
