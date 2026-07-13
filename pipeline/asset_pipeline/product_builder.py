"""Strict source contract for the compact combinatorial product-builder pilot.

The source file contains data only.  It may select geometry identifiers from
the registries below, but all SVG paths and rendering logic remain trusted
Python code.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from html import escape
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
from .product_shell_art import (
    DETAIL_INK,
    DETAIL_STROKE,
    GUIDE,
    INK,
    OUTER_STROKE,
)


MAX_SOURCE_BYTES = 1_000_000
HEX_COLOUR = re.compile(r"^#[0-9A-Fa-f]{6}$")
PLAIN_TITLE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 &'()+,.\-]*$")
URL_LIKE_TITLE = re.compile(
    r"(?i)(?:\bwww\.|"
    r"\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}\b|"
    r"\b(?:\d{1,3}\.){3}\d{1,3}\b)"
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


class ProductBuilderRenderError(ValueError):
    """Raised before unsafe geometry or an existing output target is touched."""


@dataclass(frozen=True, slots=True)
class BodyGeometry:
    """Trusted SVG fragments for one bare product body."""

    family_id: str
    product_bounds: tuple[float, float, float, float]
    body: str
    trim: str
    accent: str
    artwork_path: str
    shadow_path: str
    highlight_path: str
    details: str


@dataclass(frozen=True, slots=True)
class ComponentGeometry:
    """Trusted normalized SVG fragment for one interchangeable part."""

    family_id: str
    slot_id: str
    bounds: tuple[float, float, float, float]
    markup: str


@dataclass(frozen=True, slots=True)
class ProductBuilderOutput:
    relative_path: str
    payload: bytes


@dataclass(frozen=True, slots=True)
class ProductBuilderPackPlan:
    pack_id: str
    output_dir: Path
    files: tuple[ProductBuilderOutput, ...]


@dataclass(frozen=True, slots=True)
class ProductBuilderBuildResult:
    pack_id: str
    output_dir: Path
    file_count: int


BODY_GEOMETRIES: dict[str, BodyGeometry] = {
    "body-classic-can": BodyGeometry(
        family_id="drinkware",
        product_bounds=(320, 145, 360, 720),
        body='<path d="M360 165Q320 185 320 230V790Q320 835 360 850H640Q680 835 680 790V230Q680 185 640 165Z"/>',
        trim='<ellipse cx="500" cy="170" rx="178" ry="34"/><ellipse cx="500" cy="835" rx="166" ry="25"/>',
        accent='<path d="M326 255Q500 285 674 255V302Q500 330 326 302Z"/>',
        artwork_path="M334 286Q500 316 666 286V760Q500 790 334 760Z",
        shadow_path="M590 198Q665 205 680 235V790Q674 825 630 843H582Z",
        highlight_path="M352 240Q382 220 408 234V755Q382 770 352 752Z",
        details='<ellipse cx="500" cy="170" rx="142" ry="22"/><path d="M452 169Q500 145 548 169Q500 191 452 169Z"/><path d="M360 818Q500 850 640 818"/>',
    ),
    "body-slim-can": BodyGeometry(
        family_id="drinkware",
        product_bounds=(350, 110, 300, 780),
        body='<path d="M385 125H615Q650 140 650 185V820Q650 865 615 875H385Q350 865 350 820V185Q350 140 385 125Z"/>',
        trim='<ellipse cx="500" cy="135" rx="149" ry="27"/><ellipse cx="500" cy="862" rx="143" ry="23"/>',
        accent='<path d="M354 215Q500 242 646 215V258Q500 282 354 258Z"/>',
        artwork_path="M358 245Q500 272 642 245V785Q500 812 358 785Z",
        shadow_path="M565 151Q635 158 650 188V820Q642 852 608 871H558Z",
        highlight_path="M378 210Q400 188 424 202V776Q404 794 378 776Z",
        details='<ellipse cx="500" cy="135" rx="119" ry="18"/><path d="M458 134Q500 114 542 134Q500 153 458 134Z"/><path d="M380 842Q500 871 620 842"/>',
    ),
    "body-sports-bottle": BodyGeometry(
        family_id="drinkware",
        product_bounds=(275, 110, 450, 770),
        body='<path d="M385 205H615Q625 250 690 295Q725 320 725 380V805Q725 850 675 875H325Q275 850 275 805V380Q275 320 310 295Q375 250 385 205Z"/>',
        trim='<rect x="370" y="112" width="260" height="104" rx="28"/><path d="M322 310Q500 360 678 310V352Q500 398 322 352Z"/>',
        accent='<path d="M282 430Q500 480 718 430V492Q500 538 282 492Z"/>',
        artwork_path="M288 350Q500 402 712 350V815Q500 860 288 815Z",
        shadow_path="M600 237Q725 285 725 380V805Q725 850 675 875H590Z",
        highlight_path="M326 345Q366 300 408 276L423 792Q382 824 326 805Z",
        details='<path d="M395 130V198M435 130V198M475 130V198M515 130V198M555 130V198M595 130V198"/><path d="M310 760Q500 806 690 760"/>',
    ),
    "body-takeaway-cup": BodyGeometry(
        family_id="drinkware",
        product_bounds=(300, 155, 400, 710),
        body='<path d="M320 220H680L625 858H375Z"/>',
        trim='<ellipse cx="500" cy="210" rx="205" ry="45"/><rect x="290" y="170" width="420" height="70" rx="30"/>',
        accent='<path d="M333 385Q500 420 667 385L660 465Q500 498 340 465Z"/>',
        artwork_path="M340 300Q500 332 660 300L630 770Q500 800 370 770Z",
        shadow_path="M590 232L680 220L625 858H565Z",
        highlight_path="M365 286Q394 264 423 278L405 754Q382 770 365 750Z",
        details='<path d="M315 220Q500 270 685 220"/><path d="M385 825Q500 846 615 825"/>',
    ),
    "body-burger-box": BodyGeometry(
        family_id="food-packaging",
        product_bounds=(140, 230, 720, 570),
        body='<path d="M170 460L720 445L700 748L220 805Z"/>',
        trim='<path d="M150 275L680 220L855 350L720 445L170 460Z"/>',
        accent='<path d="M720 445L855 350L845 640L700 748Z"/>',
        artwork_path="M205 500L675 488L658 700L245 748Z",
        shadow_path="M720 445L855 350L845 640L700 748Z",
        highlight_path="M188 298L650 248L700 285L250 340Z",
        details='<path d="M170 460L720 445L855 350"/><path d="M230 520L650 508L638 680L255 718"/><path d="M740 480L815 425L808 610L728 665"/>',
    ),
    "body-meal-box": BodyGeometry(
        family_id="food-packaging",
        product_bounds=(150, 250, 700, 520),
        body='<path d="M180 400H820L760 770H240Z"/>',
        trim='<path d="M180 400L260 250H740L820 400Z"/>',
        accent='<path d="M760 420H812L760 735H712Z"/>',
        artwork_path="M245 455H755L718 690H282Z",
        shadow_path="M680 400H820L760 770H680Z",
        highlight_path="M265 430H340L310 720H255Z",
        details='<path d="M180 400H820"/><path d="M260 250L500 335L740 250"/><path d="M270 730H730"/>',
    ),
    "body-noodle-tub": BodyGeometry(
        family_id="food-packaging",
        product_bounds=(270, 170, 460, 680),
        body='<path d="M285 250H715L665 850H335Z"/>',
        trim='<ellipse cx="500" cy="240" rx="230" ry="58"/><path d="M280 245Q500 315 720 245V290Q500 355 280 290Z"/>',
        accent='<path d="M310 690Q500 730 690 690L680 775Q500 810 320 775Z"/>',
        artwork_path="M315 340Q500 385 685 340L657 675Q500 708 343 675Z",
        shadow_path="M600 285H720L665 850H585Z",
        highlight_path="M332 332Q365 310 400 324L380 665Q352 682 332 665Z",
        details='<path d="M285 250Q500 320 715 250"/><path d="M338 820Q500 845 662 820"/>',
    ),
    "body-snack-pouch": BodyGeometry(
        family_id="food-packaging",
        product_bounds=(200, 135, 600, 730),
        body='<path d="M230 140H770L800 820Q742 860 680 842Q590 875 500 850Q410 875 320 842Q258 860 200 820Z"/>',
        trim='<path d="M230 140H770L778 205Q500 230 222 205Z"/><path d="M205 790Q500 842 795 790L800 820Q742 860 680 842Q590 875 500 850Q410 875 320 842Q258 860 200 820Z"/>',
        accent='<path d="M230 205L282 830L210 805L200 820Z"/><path d="M770 205L718 830L790 805L800 820Z"/>',
        artwork_path="M245 245Q500 270 755 245L780 775Q710 810 650 795Q500 825 350 795Q290 810 220 775Z",
        shadow_path="M670 214L770 205L800 820Q742 860 680 842L650 795Z",
        highlight_path="M280 255Q325 235 365 242L390 755Q342 780 305 764Z",
        details='<path d="M242 172H758"/><path d="M260 220L300 810M740 220L700 810"/><path d="M340 824Q500 790 660 824"/>',
    ),
    "body-backpack": BodyGeometry(
        family_id="bags",
        product_bounds=(245, 160, 510, 700),
        body='<path d="M330 230Q350 160 500 160Q650 160 670 230L750 790Q720 855 650 860H350Q280 855 250 790Z"/>',
        trim='<path d="M310 300Q500 245 690 300L705 410Q500 360 295 410Z"/><path d="M330 780Q500 825 670 780V835Q500 875 330 835Z"/>',
        accent='<path d="M335 600Q500 555 665 600V755Q500 795 335 755Z"/>',
        artwork_path="M330 360Q500 315 670 360L690 585Q500 535 310 585Z",
        shadow_path="M610 220Q690 250 705 400L750 790Q720 855 650 860H590Z",
        highlight_path="M300 355Q330 300 380 280L405 750Q355 780 320 748Z",
        details='<path d="M300 420Q500 365 700 420"/><path d="M350 635Q500 600 650 635"/><path d="M500 170V830"/>',
    ),
    "body-carry-bag": BodyGeometry(
        family_id="bags",
        product_bounds=(190, 220, 620, 610),
        body='<path d="M220 260H780L810 830H190Z"/>',
        trim='<path d="M220 260H780L785 325Q500 355 215 325Z"/>',
        accent='<path d="M195 720Q500 760 805 720L810 830H190Z"/>',
        artwork_path="M245 365Q500 395 755 365L778 690Q500 725 222 690Z",
        shadow_path="M690 260H780L810 830H660Z",
        highlight_path="M245 350Q282 330 320 342L345 680Q300 700 265 682Z",
        details='<path d="M220 325Q500 355 780 325"/><path d="M235 760Q500 792 765 760"/>',
    ),
    "body-tote": BodyGeometry(
        family_id="bags",
        product_bounds=(220, 230, 560, 620),
        body='<path d="M250 250H750L780 850H220Z"/>',
        trim='<path d="M250 250H750L755 315Q500 345 245 315Z"/>',
        accent='<path d="M228 760Q500 800 772 760L780 850H220Z"/>',
        artwork_path="M270 355Q500 382 730 355L752 728Q500 760 248 728Z",
        shadow_path="M660 250H750L780 850H640Z",
        highlight_path="M268 350Q300 328 335 340L355 718Q315 738 280 720Z",
        details='<path d="M250 315Q500 345 750 315"/><path d="M260 790Q500 820 740 790"/>',
    ),
    "body-weekender": BodyGeometry(
        family_id="bags",
        product_bounds=(130, 300, 740, 500),
        body='<path d="M190 350Q220 300 300 300H700Q780 300 810 350L870 750Q840 800 780 800H220Q160 800 130 750Z"/>',
        trim='<path d="M170 420Q500 350 830 420L845 505Q500 440 155 505Z"/>',
        accent='<path d="M160 670Q500 720 840 670L860 765Q500 820 140 765Z"/>',
        artwork_path="M220 500Q500 445 780 500L815 650Q500 700 185 650Z",
        shadow_path="M700 300Q780 300 810 350L870 750Q840 800 780 800H665Z",
        highlight_path="M195 430Q245 380 300 365L330 650Q265 675 215 645Z",
        details='<path d="M155 505Q500 440 845 505"/><path d="M500 315V780"/><path d="M205 735Q500 775 795 735"/>',
    ),
}


COMPONENT_GEOMETRIES: dict[str, ComponentGeometry] = {
    "part-carry-cutout": ComponentGeometry(
        "bags",
        "carry-system",
        (0.22, 0.28, 0.56, 0.44),
        '<path d="M.25 .7V.5Q.25 .3 .5 .3Q.75 .3 .75 .5V.7H.64V.52Q.64 .42 .5 .42Q.36 .42 .36 .52V.7Z"/>',
    ),
    "part-carry-long-straps": ComponentGeometry(
        "bags",
        "carry-system",
        (0.14, 0.08, 0.72, 0.84),
        '<path d="M.2 .9V.4Q.2 .1 .5 .1Q.8 .1 .8 .4V.9M.35 .9V.46Q.35 .3 .5 .3Q.65 .3 .65 .46V.9" fill="none"/>',
    ),
    "part-carry-loop": ComponentGeometry(
        "bags",
        "carry-system",
        (0.14, 0.2, 0.72, 0.68),
        '<path d="M.16 .86V.52Q.16 .22 .36 .22Q.5 .22 .5 .48Q.5 .22 .64 .22Q.84 .22 .84 .52V.86" fill="none"/>',
    ),
    "part-carry-short-straps": ComponentGeometry(
        "bags",
        "carry-system",
        (0.18, 0.3, 0.64, 0.58),
        '<path d="M.2 .86V.62Q.2 .32 .5 .32Q.8 .32 .8 .62V.86M.32 .86V.65Q.32 .48 .5 .48Q.68 .48 .68 .65V.86" fill="none"/>',
    ),
    "part-top-flat": ComponentGeometry(
        "drinkware",
        "top",
        (0.08, 0.34, 0.84, 0.32),
        '<ellipse cx=".5" cy=".5" rx=".4" ry=".14"/><ellipse cx=".5" cy=".5" rx=".3" ry=".08" fill="none"/>',
    ),
    "part-top-ring": ComponentGeometry(
        "drinkware",
        "top",
        (0.08, 0.25, 0.84, 0.5),
        '<ellipse cx=".5" cy=".55" rx=".4" ry=".15"/><ellipse cx=".5" cy=".48" rx=".24" ry=".2" fill="none"/>',
    ),
    "part-top-spout": ComponentGeometry(
        "drinkware",
        "top",
        (0.24, 0.1, 0.52, 0.78),
        '<path d="M.3 .84V.42Q.3 .16 .5 .16Q.7 .16 .7 .42V.84Z"/><ellipse cx=".5" cy=".26" rx=".16" ry=".09" fill="none"/>',
    ),
    "part-top-straw": ComponentGeometry(
        "drinkware",
        "top",
        (0.16, 0.06, 0.68, 0.84),
        '<ellipse cx=".5" cy=".76" rx=".32" ry=".11"/><path d="M.5 .76V.22Q.5 .1 .66 .1H.78" fill="none"/>',
    ),
    "part-closure-folded": ComponentGeometry(
        "food-packaging",
        "closure",
        (0.08, 0.24, 0.84, 0.52),
        '<path d="M.1 .7L.28 .28H.72L.9 .7Z"/><path d="M.28 .28L.5 .58L.72 .28" fill="none"/>',
    ),
    "part-closure-sleeved": ComponentGeometry(
        "food-packaging",
        "closure",
        (0.08, 0.3, 0.84, 0.4),
        '<rect x=".1" y=".32" width=".8" height=".36" rx=".08"/><path d="M.28 .32V.68M.72 .32V.68" fill="none"/>',
    ),
    "part-closure-tabbed": ComponentGeometry(
        "food-packaging",
        "closure",
        (0.1, 0.2, 0.8, 0.6),
        '<path d="M.12 .72V.3H.4L.5 .18L.6 .3H.88V.72Z"/><path d="M.38 .5H.62" fill="none"/>',
    ),
    "part-closure-zip": ComponentGeometry(
        "food-packaging",
        "closure",
        (0.06, 0.32, 0.88, 0.36),
        '<path d="M.08 .4H.92V.62H.08Z"/><path d="M.14 .51H.76M.2 .42V.6M.3 .42V.6M.4 .42V.6M.5 .42V.6M.6 .42V.6M.7 .42V.6" fill="none"/><circle cx=".84" cy=".51" r=".08"/>',
    ),
}


def _format_number(value: float) -> str:
    rendered = f"{value:.6f}".rstrip("0").rstrip(".")
    return rendered or "0"


def _body_lookup(source: ProductBuilderSource, body_id: str) -> BuilderBody:
    try:
        body = next(body for body in source.bodies if body.id == body_id)
    except StopIteration as error:
        raise ProductBuilderRenderError(f"unknown body ID: {body_id}") from error
    geometry = BODY_GEOMETRIES.get(body.geometry_id)
    if geometry is None or geometry.family_id != body.family_id:
        raise ProductBuilderRenderError("body selects unavailable trusted geometry")
    return body


def _part_lookup(source: ProductBuilderSource, part_id: str) -> BuilderPart:
    try:
        part = next(part for part in source.parts if part.id == part_id)
    except StopIteration as error:
        raise ProductBuilderRenderError(f"unknown part ID: {part_id}") from error
    geometry = COMPONENT_GEOMETRIES.get(part.geometry_id)
    if (
        geometry is None
        or geometry.family_id != part.family_id
        or geometry.slot_id != part.slot_id
    ):
        raise ProductBuilderRenderError("part selects unavailable trusted geometry")
    return part


def _artwork_bounds(body: BuilderBody) -> str:
    bounds = body.artwork_bounds
    return " ".join(
        _format_number(value)
        for value in (bounds.x, bounds.y, bounds.width, bounds.height)
    )


def _body_svg(source: ProductBuilderSource, body_id: str, *, preview: bool) -> str:
    body = _body_lookup(source, body_id)
    geometry = BODY_GEOMETRIES[body.geometry_id]
    palette = source.palettes[0]
    material = source.materials[0]
    clip_id = f"{body.id}-primary-artwork-clip"
    body_id_xml = escape(body.id, quote=True)
    geometry_id_xml = escape(body.geometry_id, quote=True)
    family_id_xml = escape(body.family_id, quote=True)
    slot_id_xml = escape(body.component_slot_id, quote=True)
    view = "preview" if preview else "authoring"
    colours = palette.colours
    grounding = ""
    if preview:
        _x, y, width, height = geometry.product_bounds
        grounding = (
            '<ellipse data-layer="preview-grounding" cx="500" '
            f'cy="{_format_number(min(y + height + 24, 930))}" '
            f'rx="{_format_number(width * 0.42)}" '
            f'ry="{_format_number(max(14, height * 0.028))}" '
            f'fill="{INK}" opacity="0.14"/>'
        )
    guides = ""
    if not preview:
        guides = (
            '<g data-layer="editor-guides" data-editor-only="true" '
            'data-export="false">'
            f'<path data-selection-outline="primary" d="{geometry.artwork_path}" '
            f'fill="{GUIDE}" fill-opacity="0.12" stroke="{GUIDE}" '
            f'stroke-width="{OUTER_STROKE}" stroke-linejoin="round"/>'
            "</g>"
        )
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" '
        f'data-view="{view}" data-body-id="{body_id_xml}" '
        f'data-family-id="{family_id_xml}" data-geometry-id="{geometry_id_xml}" '
        f'data-component-slot-id="{slot_id_xml}" '
        f'data-artwork-bounds="{_artwork_bounds(body)}" '
        f'data-palette-id="{escape(palette.id, quote=True)}" '
        f'data-material-id="{escape(material.id, quote=True)}" '
        'data-light-direction="top-left">'
        f'<defs><clipPath id="{clip_id}"><path '
        f'data-artwork-surface="primary" d="{geometry.artwork_path}"/>'
        "</clipPath></defs>"
        f"{grounding}"
        f'<g data-layer="base-shell" data-product-shell="true" stroke="{INK}" '
        f'stroke-width="{OUTER_STROKE}" stroke-linecap="round" '
        f'stroke-linejoin="round"><g data-region="body" fill="{colours.body}">'
        f'{geometry.body}</g><g data-region="trim" fill="{colours.trim}">'
        f'{geometry.trim}</g><g data-region="accent" fill="{colours.accent}">'
        f'{geometry.accent}</g><g data-region="label" fill="{colours.label}">'
        f'<path d="{geometry.artwork_path}"/></g></g>'
        f'<g data-layer="artwork-slot" data-artwork-slot="primary" '
        f'clip-path="url(#{clip_id})"></g>'
        f'<g data-layer="tone-detail"><path data-tone="shadow" '
        f'd="{geometry.shadow_path}" fill="{INK}" opacity="0.1" stroke="none"/>'
        f'<path data-tone="highlight" d="{geometry.highlight_path}" '
        'fill="#FFFFFF" opacity="0.34" stroke="none"/>'
        f'<g data-structural-details="true" fill="none" stroke="{DETAIL_INK}" '
        f'stroke-width="{DETAIL_STROKE}" stroke-linecap="round" '
        f'stroke-linejoin="round">{geometry.details}</g></g>{guides}</svg>\n'
    )


def render_body_authoring_svg(source: ProductBuilderSource, body_id: str) -> str:
    """Render one deterministic editable body with editor-only guides."""

    return _body_svg(source, body_id, preview=False)


def render_body_preview_svg(source: ProductBuilderSource, body_id: str) -> str:
    """Render one clean product preview with no editor-only guide content."""

    return _body_svg(source, body_id, preview=True)


def render_component_svg(source: ProductBuilderSource, part_id: str) -> str:
    """Render one passive normalized component fragment from trusted geometry."""

    part = _part_lookup(source, part_id)
    geometry = COMPONENT_GEOMETRIES[part.geometry_id]
    bounds = " ".join(_format_number(value) for value in geometry.bounds)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" '
        f'data-part-id="{escape(part.id, quote=True)}" '
        f'data-family-id="{escape(part.family_id, quote=True)}" '
        f'data-slot-id="{escape(part.slot_id, quote=True)}" '
        f'data-geometry-id="{escape(part.geometry_id, quote=True)}" '
        f'data-bounds="{bounds}"><g data-layer="component-structure" '
        'data-colour-zone="trim" fill="currentColor" color="#34414D" '
        'stroke="#34414D" stroke-width=".035" stroke-linecap="round" '
        f'stroke-linejoin="round">{geometry.markup}</g></svg>\n'
    )


def _canonical_json(value: object) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")


def _require_absent(output_dir: Path) -> None:
    if output_dir.exists():
        raise ProductBuilderRenderError("product-builder output directory must not exist")


def _catalogue(source: ProductBuilderSource) -> dict[str, object]:
    return {
        "schema": "product-builder-catalogue@1",
        "version": 1,
        "packId": source.pack_id,
        "virtualCount": source.virtual_count,
        "families": [
            family.model_dump(by_alias=True, mode="json")
            for family in source.families
        ],
        "bodies": [
            {
                **body.model_dump(by_alias=True, mode="json"),
                "authoringSvg": f"bodies/{body.id}/authoring.svg",
                "previewSvg": f"bodies/{body.id}/preview.svg",
            }
            for body in source.bodies
        ],
        "parts": [
            {
                **part.model_dump(by_alias=True, mode="json"),
                "componentSvg": f"components/{part.id}.svg",
            }
            for part in source.parts
        ],
        "palettes": [
            palette.model_dump(by_alias=True, mode="json")
            for palette in source.palettes
        ],
        "materials": [
            material.model_dump(by_alias=True, mode="json")
            for material in source.materials
        ],
    }


def plan_product_builder_pack(
    source: ProductBuilderSource, output_dir: Path
) -> ProductBuilderPackPlan:
    """Prepare all 39 compact pack files in memory without touching the target."""

    output_dir = Path(output_dir)
    _require_absent(output_dir)
    files: dict[str, bytes] = {}
    for body in source.bodies:
        files[f"bodies/{body.id}/authoring.svg"] = render_body_authoring_svg(
            source, body.id
        ).encode("utf-8")
        files[f"bodies/{body.id}/preview.svg"] = render_body_preview_svg(
            source, body.id
        ).encode("utf-8")
    for part in source.parts:
        files[f"components/{part.id}.svg"] = render_component_svg(
            source, part.id
        ).encode("utf-8")
    files["catalogue.json"] = _canonical_json(_catalogue(source))
    files["source.json"] = canonical_product_builder_json(source)
    qa = {
        "schema": "product-builder-qa@1",
        "packId": source.pack_id,
        "fileCount": 39,
        "renderedSvgCount": 36,
        "bodyCount": len(source.bodies),
        "componentCount": len(source.parts),
        "virtualCount": source.virtual_count,
        "sha256": {
            path: hashlib.sha256(payload).hexdigest()
            for path, payload in sorted(files.items())
        },
    }
    files["qa.json"] = _canonical_json(qa)
    if len(files) != 39:
        raise ProductBuilderRenderError("compact product-builder plan must contain 39 files")
    return ProductBuilderPackPlan(
        pack_id=source.pack_id,
        output_dir=output_dir,
        files=tuple(
            ProductBuilderOutput(path, payload)
            for path, payload in sorted(files.items())
        ),
    )


def write_product_builder_pack(
    source: ProductBuilderSource, output_dir: Path
) -> ProductBuilderBuildResult:
    """Write one new compact pack, refusing every pre-existing target."""

    plan = plan_product_builder_pack(source, output_dir)
    try:
        plan.output_dir.mkdir(exist_ok=False)
    except FileExistsError as error:
        raise ProductBuilderRenderError(
            "product-builder output directory must not exist"
        ) from error
    for output in plan.files:
        target = plan.output_dir / Path(output.relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(output.payload)
    return ProductBuilderBuildResult(
        pack_id=plan.pack_id,
        output_dir=plan.output_dir,
        file_count=len(plan.files),
    )


__all__ = [
    "BODY_GEOMETRIES",
    "COMPONENT_GEOMETRIES",
    "ProductBuilderContractError",
    "ProductBuilderBuildResult",
    "ProductBuilderPackPlan",
    "ProductBuilderRenderError",
    "ProductBuilderSource",
    "REGISTERED_BODY_GEOMETRY_IDS",
    "REGISTERED_COMPONENT_GEOMETRY_IDS",
    "canonical_product_builder_json",
    "load_product_builder_source",
    "plan_product_builder_pack",
    "parse_product_builder_source",
    "render_body_authoring_svg",
    "render_body_preview_svg",
    "render_component_svg",
    "virtual_variant_count",
    "write_product_builder_pack",
]
