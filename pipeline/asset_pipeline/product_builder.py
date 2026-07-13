"""Strict source contract for the compact combinatorial product-builder pilot.

The source file contains data only.  It may select geometry identifiers from
the registries below, but all SVG paths and rendering logic remain trusted
Python code.
"""

from __future__ import annotations

import json
from pathlib import Path
import re
from typing import Any, Literal, Mapping

from pydantic import (
    ConfigDict,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)

from .schema import (
    ContractModel,
    MATERIAL_PROFILES,
    canonical_json_bytes,
    validate_portable_ids,
)


MAX_SOURCE_BYTES = 1_000_000
HEX_COLOUR = re.compile(r"^#[0-9A-Fa-f]{6}$")
PLAIN_TITLE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 &'()+,.\-]*$")
URL_LIKE_TITLE = re.compile(
    r"(?i)(?:\bwww\.|\b[a-z0-9-]+\.(?:com|org|net|edu|gov|io|co|au)\b)"
)

REGISTERED_BODY_IDENTITIES = {
    "bags-backpack": ("bags", "body-backpack", "carry-system"),
    "bags-carry-bag": ("bags", "body-carry-bag", "carry-system"),
    "bags-tote": ("bags", "body-tote", "carry-system"),
    "bags-weekender": ("bags", "body-weekender", "carry-system"),
    "drinkware-classic-can": ("drinkware", "body-classic-can", "top"),
    "drinkware-slim-can": ("drinkware", "body-slim-can", "top"),
    "drinkware-sports-bottle": ("drinkware", "body-sports-bottle", "top"),
    "drinkware-takeaway-cup": ("drinkware", "body-takeaway-cup", "top"),
    "food-packaging-burger-box": (
        "food-packaging",
        "body-burger-box",
        "closure",
    ),
    "food-packaging-meal-box": ("food-packaging", "body-meal-box", "closure"),
    "food-packaging-noodle-tub": (
        "food-packaging",
        "body-noodle-tub",
        "closure",
    ),
    "food-packaging-snack-pouch": (
        "food-packaging",
        "body-snack-pouch",
        "closure",
    ),
}
REGISTERED_PART_IDENTITIES = {
    "bags-carry-cutout": ("bags", "part-carry-cutout", "carry-system"),
    "bags-carry-long-straps": (
        "bags",
        "part-carry-long-straps",
        "carry-system",
    ),
    "bags-carry-loop": ("bags", "part-carry-loop", "carry-system"),
    "bags-carry-short-straps": (
        "bags",
        "part-carry-short-straps",
        "carry-system",
    ),
    "drinkware-top-flat": ("drinkware", "part-top-flat", "top"),
    "drinkware-top-ring": ("drinkware", "part-top-ring", "top"),
    "drinkware-top-spout": ("drinkware", "part-top-spout", "top"),
    "drinkware-top-straw": ("drinkware", "part-top-straw", "top"),
    "food-packaging-closure-folded": (
        "food-packaging",
        "part-closure-folded",
        "closure",
    ),
    "food-packaging-closure-sleeved": (
        "food-packaging",
        "part-closure-sleeved",
        "closure",
    ),
    "food-packaging-closure-tabbed": (
        "food-packaging",
        "part-closure-tabbed",
        "closure",
    ),
    "food-packaging-closure-zip": (
        "food-packaging",
        "part-closure-zip",
        "closure",
    ),
}
REGISTERED_BODY_GEOMETRY_FAMILIES = {
    geometry_id: family_id
    for family_id, geometry_id, _slot_id in REGISTERED_BODY_IDENTITIES.values()
}
REGISTERED_COMPONENT_GEOMETRY_FAMILIES = {
    geometry_id: family_id
    for family_id, geometry_id, _slot_id in REGISTERED_PART_IDENTITIES.values()
}
REGISTERED_BODY_GEOMETRY_IDS = frozenset(REGISTERED_BODY_GEOMETRY_FAMILIES)
REGISTERED_COMPONENT_GEOMETRY_IDS = frozenset(
    REGISTERED_COMPONENT_GEOMETRY_FAMILIES
)
REQUIRED_FAMILY_IDS = frozenset({"bags", "drinkware", "food-packaging"})
REQUIRED_MATERIAL_IDS = frozenset(MATERIAL_PROFILES)


class ProductBuilderContractError(ValueError):
    """Raised when a product-builder source is missing, malformed or unsafe."""


def _as_tuple(value: Any, label: str) -> tuple[Any, ...]:
    if not isinstance(value, (list, tuple)):
        raise ValueError(f"{label} must be an array")
    return tuple(value)


def _portable_id(value: str, label: str) -> str:
    try:
        return validate_portable_ids([value])[0]
    except ValueError as error:
        raise ValueError(f"{label}: {error}") from error


def _plain_title(value: str, label: str) -> str:
    if (
        not isinstance(value, str)
        or value != value.strip()
        or not 1 <= len(value) <= 80
        or PLAIN_TITLE.fullmatch(value) is None
        or URL_LIKE_TITLE.search(value) is not None
        or ".." in value
    ):
        raise ValueError(f"{label} must be short plain text without markup or URLs")
    return value


def _sorted_unique_ids(values: tuple[str, ...], label: str) -> tuple[str, ...]:
    checked = tuple(_portable_id(value, label) for value in values)
    if checked != tuple(sorted(set(checked))):
        raise ValueError(f"{label} values must be sorted and unique")
    return checked


class FrozenContractModel(ContractModel):
    """Closed external contract whose values cannot be reassigned."""

    model_config = ConfigDict(frozen=True)


class BuilderFamily(FrozenContractModel):
    id: str
    title: str
    component_slot_id: str

    @field_validator("id", "component_slot_id")
    @classmethod
    def validate_id(cls, value: str, info: Any) -> str:
        return _portable_id(value, info.field_name)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _plain_title(value, "family title")


class NormalizedAnchor(FrozenContractModel):
    x: float = Field(strict=True, ge=0.0, le=1.0, allow_inf_nan=False)
    y: float = Field(strict=True, ge=0.0, le=1.0, allow_inf_nan=False)


class NormalizedBounds(FrozenContractModel):
    x: float = Field(strict=True, ge=0.0, lt=1.0, allow_inf_nan=False)
    y: float = Field(strict=True, ge=0.0, lt=1.0, allow_inf_nan=False)
    width: float = Field(strict=True, gt=0.0, le=1.0, allow_inf_nan=False)
    height: float = Field(strict=True, gt=0.0, le=1.0, allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_containment(self) -> "NormalizedBounds":
        if self.x + self.width > 1.0 or self.y + self.height > 1.0:
            raise ValueError("artwork bounds must fit inside the normalized body")
        return self


class BuilderBody(FrozenContractModel):
    id: str
    title: str
    family_id: str
    geometry_id: str
    component_slot_id: str
    component_anchor: NormalizedAnchor
    artwork_bounds: NormalizedBounds
    compatible_part_ids: tuple[str, ...]

    @field_validator("compatible_part_ids", mode="before")
    @classmethod
    def tuple_compatible_parts(cls, value: Any) -> tuple[Any, ...]:
        return _as_tuple(value, "compatiblePartIds")

    @field_validator("id", "family_id", "component_slot_id")
    @classmethod
    def validate_id(cls, value: str, info: Any) -> str:
        return _portable_id(value, info.field_name)

    @field_validator("geometry_id")
    @classmethod
    def validate_geometry_id(cls, value: str) -> str:
        if value not in REGISTERED_BODY_GEOMETRY_IDS:
            raise ValueError("body geometryId must select registered trusted geometry")
        return value

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _plain_title(value, "body title")

    @field_validator("compatible_part_ids")
    @classmethod
    def validate_compatible_parts(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        value = _sorted_unique_ids(value, "compatible part ID")
        if len(value) != 4:
            raise ValueError("each body requires exactly four compatible parts")
        return value


class BuilderPart(FrozenContractModel):
    id: str
    title: str
    family_id: str
    slot_id: str
    geometry_id: str

    @field_validator("id", "family_id", "slot_id")
    @classmethod
    def validate_id(cls, value: str, info: Any) -> str:
        return _portable_id(value, info.field_name)

    @field_validator("geometry_id")
    @classmethod
    def validate_geometry_id(cls, value: str) -> str:
        if value not in REGISTERED_COMPONENT_GEOMETRY_IDS:
            raise ValueError("part geometryId must select registered trusted geometry")
        return value

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _plain_title(value, "part title")


class PaletteColours(FrozenContractModel):
    body: str
    trim: str
    accent: str
    label: str

    @field_validator("body", "trim", "accent", "label")
    @classmethod
    def validate_colour(cls, value: str) -> str:
        if HEX_COLOUR.fullmatch(value) is None:
            raise ValueError("palette colours must be six-digit hexadecimal values")
        return value.upper()


class BuilderPalette(FrozenContractModel):
    id: str
    title: str
    colours: PaletteColours

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return _portable_id(value, "palette ID")

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _plain_title(value, "palette title")


class BuilderMaterial(FrozenContractModel):
    id: str
    title: str

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        value = _portable_id(value, "material ID")
        if value not in REQUIRED_MATERIAL_IDS:
            raise ValueError("material ID must use an existing material profile")
        return value

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _plain_title(value, "material title")


class ProductBuilderSource(FrozenContractModel):
    schema_id: Literal["product-builder-source@1"] = Field(alias="schema")
    pack_id: str
    families: tuple[BuilderFamily, ...]
    bodies: tuple[BuilderBody, ...]
    parts: tuple[BuilderPart, ...]
    palettes: tuple[BuilderPalette, ...]
    materials: tuple[BuilderMaterial, ...]

    @field_validator(
        "families", "bodies", "parts", "palettes", "materials", mode="before"
    )
    @classmethod
    def tuple_collections(cls, value: Any, info: Any) -> tuple[Any, ...]:
        return _as_tuple(value, info.field_name)

    @field_validator("pack_id")
    @classmethod
    def validate_pack_id(cls, value: str) -> str:
        return _portable_id(value, "pack ID")

    @model_validator(mode="after")
    def validate_graph(self) -> "ProductBuilderSource":
        collections = {
            "family": self.families,
            "body": self.bodies,
            "part": self.parts,
            "palette": self.palettes,
            "material": self.materials,
        }
        for label, records in collections.items():
            ids = tuple(record.id for record in records)
            validate_portable_ids(ids)
            if ids != tuple(sorted(ids)):
                raise ValueError(f"{label} records must be sorted by unique ID")

        family_ids = {family.id for family in self.families}
        if len(self.families) != 3 or family_ids != REQUIRED_FAMILY_IDS:
            raise ValueError("pilot requires exactly the three registered families")
        if len(self.bodies) != 12:
            raise ValueError("pilot requires exactly twelve bodies")
        if len(self.parts) != 12:
            raise ValueError("pilot requires exactly twelve reusable parts")
        if len(self.palettes) != 16:
            raise ValueError("pilot requires exactly sixteen palettes")
        palette_colours = {
            (
                palette.colours.body,
                palette.colours.trim,
                palette.colours.accent,
                palette.colours.label,
            )
            for palette in self.palettes
        }
        if len(palette_colours) != 16:
            raise ValueError("palette colour combinations must be unique")
        material_ids = {material.id for material in self.materials}
        if len(self.materials) != 8 or material_ids != REQUIRED_MATERIAL_IDS:
            raise ValueError("pilot requires exactly the existing eight materials")

        body_geometry_ids = {body.geometry_id for body in self.bodies}
        if body_geometry_ids != REGISTERED_BODY_GEOMETRY_IDS:
            raise ValueError(
                "pilot must select each registered body geometry exactly once"
            )
        part_geometry_ids = {part.geometry_id for part in self.parts}
        if part_geometry_ids != REGISTERED_COMPONENT_GEOMETRY_IDS:
            raise ValueError("pilot must select each registered part geometry exactly once")
        for body in self.bodies:
            if REGISTERED_BODY_IDENTITIES.get(body.id) != (
                body.family_id,
                body.geometry_id,
                body.component_slot_id,
            ):
                raise ValueError(
                    "body ID must use its registered family, geometry and slot"
                )
        for part in self.parts:
            if REGISTERED_PART_IDENTITIES.get(part.id) != (
                part.family_id,
                part.geometry_id,
                part.slot_id,
            ):
                raise ValueError(
                    "part ID must use its registered family, geometry and slot"
                )

        family_lookup = {family.id: family for family in self.families}
        part_lookup = {part.id: part for part in self.parts}
        for family_id, family in family_lookup.items():
            family_bodies = [body for body in self.bodies if body.family_id == family_id]
            family_parts = [part for part in self.parts if part.family_id == family_id]
            if len(family_bodies) != 4 or len(family_parts) != 4:
                raise ValueError("each pilot family requires four bodies and four parts")
            if any(part.slot_id != family.component_slot_id for part in family_parts):
                raise ValueError("part slot must match its family component slot")

        for body in self.bodies:
            family = family_lookup.get(body.family_id)
            if family is None:
                raise ValueError("body references an unknown family")
            if body.component_slot_id != family.component_slot_id:
                raise ValueError("body slot must match its family component slot")
            if REGISTERED_BODY_GEOMETRY_FAMILIES[body.geometry_id] != body.family_id:
                raise ValueError("body geometry belongs to a different family")
            compatible = [
                part_lookup.get(part_id) for part_id in body.compatible_part_ids
            ]
            if any(part is None for part in compatible):
                raise ValueError("body references an unknown compatible part")
            if any(
                part.family_id != body.family_id
                or part.slot_id != body.component_slot_id
                or REGISTERED_COMPONENT_GEOMETRY_FAMILIES[part.geometry_id]
                != body.family_id
                for part in compatible
                if part is not None
            ):
                raise ValueError("body compatible parts must share its family and slot")

        if self.virtual_count != 6_144:
            raise ValueError("pilot virtual count must be exactly 6144")
        return self

    @property
    def virtual_count(self) -> int:
        return virtual_variant_count(self)


def parse_product_builder_source(raw: Mapping[str, Any]) -> ProductBuilderSource:
    """Validate one already-decoded source mapping."""

    if not isinstance(raw, Mapping):
        raise ProductBuilderContractError("product-builder source must be a JSON object")
    return ProductBuilderSource.model_validate(dict(raw), strict=True)


def load_product_builder_source(path: Path) -> ProductBuilderSource:
    """Load a bounded UTF-8 JSON source file and validate the closed contract."""

    path = Path(path)
    if not path.is_file():
        raise ProductBuilderContractError("product-builder source manifest does not exist")
    if path.stat().st_size > MAX_SOURCE_BYTES:
        raise ProductBuilderContractError("product-builder source exceeds 1 MB")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return parse_product_builder_source(raw)
    except (OSError, UnicodeError, json.JSONDecodeError, ValidationError, ValueError) as error:
        if isinstance(error, ProductBuilderContractError):
            raise
        raise ProductBuilderContractError(str(error)) from error


def virtual_variant_count(source: ProductBuilderSource) -> int:
    """Return the lazy body × compatible part × palette × material count."""

    return (
        sum(len(body.compatible_part_ids) for body in source.bodies)
        * len(source.palettes)
        * len(source.materials)
    )


def canonical_product_builder_json(source: ProductBuilderSource) -> bytes:
    """Serialize one validated source deterministically as compact UTF-8 JSON."""

    return canonical_json_bytes(source)


__all__ = [
    "ProductBuilderContractError",
    "ProductBuilderSource",
    "REGISTERED_BODY_GEOMETRY_IDS",
    "REGISTERED_COMPONENT_GEOMETRY_IDS",
    "canonical_product_builder_json",
    "load_product_builder_source",
    "parse_product_builder_source",
    "virtual_variant_count",
]
