"""Strict source contract for the product-shell visual-style audition."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal, get_args

from pydantic import Field, field_validator, model_validator

from .product_shells import ShellRegion
from .schema import ContractModel, validate_portable_ids


AuthoringMode = Literal["flat-skin", "direct-surface"]
Archetype = Literal[
    "slim-can",
    "sports-bottle",
    "snack-pouch",
    "takeaway-box",
    "hoodie",
    "trainer",
    "smartphone",
    "headphones",
    "food-truck",
    "garden-tool",
    "aquarium",
    "pet-shop",
]

MAX_SOURCE_BYTES = 1_048_576
REGION_IDS = frozenset(
    {
        "body",
        "trim",
        "accent",
        "label",
        "screen",
        "glass",
        "handle",
        "sole",
        "upper",
        "awning",
        "sign",
        "window",
    }
)


class ProductShellAuditionError(ValueError):
    """Raised when an audition source cannot satisfy the frozen roster."""


def _portable_id(value: str, label: str) -> str:
    try:
        return validate_portable_ids([value])[0]
    except ValueError as error:
        raise ValueError(f"{label} must be a portable kebab-case ID") from error


def _trimmed(value: str, label: str, maximum: int = 120) -> str:
    if value != value.strip() or not value or len(value) > maximum:
        raise ValueError(f"{label} must be non-empty trimmed text")
    if any(ord(character) < 32 for character in value):
        raise ValueError(f"{label} may not contain control characters")
    return value


class AuditionPrototype(ContractModel):
    id: str
    title: str
    family: str
    archetype: Archetype
    authoring_mode: AuthoringMode = Field(alias="authoringMode")
    regions: list[ShellRegion] = Field(min_length=3, max_length=4)
    classroom_reviewed: Literal[False] = Field(alias="classroomReviewed")
    brand_free: Literal[True] = Field(alias="brandFree")
    status: Literal["audition"]

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return _portable_id(value, "prototype ID")

    @field_validator("family")
    @classmethod
    def validate_family(cls, value: str) -> str:
        return _portable_id(value, "prototype family")

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _trimmed(value, "prototype title")

    @model_validator(mode="after")
    def validate_regions(self) -> "AuditionPrototype":
        region_ids = [region.id for region in self.regions]
        if len(region_ids) != len(set(region_ids)):
            raise ValueError("prototype region IDs must be unique")
        if not set(region_ids).issubset(REGION_IDS):
            raise ValueError("prototype contains an unsupported semantic region")
        return self


class AuditionSource(ContractModel):
    schema_id: Literal["product-shell-style-audition@1"] = Field(alias="schema")
    pack_id: Literal["product-shell-style-audition-v1"] = Field(alias="packId")
    prototypes: list[AuditionPrototype]


@dataclass(frozen=True, slots=True)
class AuditionBuildResult:
    prototype_count: int
    output_dir: Path
    report_dir: Path


def load_audition_source(path: Path) -> AuditionSource:
    """Load one small local UTF-8 audition manifest and freeze its roster."""

    path = Path(path)
    if not path.is_file() or path.stat().st_size > MAX_SOURCE_BYTES:
        raise ProductShellAuditionError("audition manifest is missing or too large")
    source = AuditionSource.model_validate_json(path.read_text("utf-8"), strict=True)
    if len(source.prototypes) != 12:
        raise ProductShellAuditionError("audition requires exactly twelve prototypes")
    if len({item.id for item in source.prototypes}) != 12:
        raise ProductShellAuditionError("prototype IDs must be unique")
    if {item.archetype for item in source.prototypes} != set(get_args(Archetype)):
        raise ProductShellAuditionError("audition archetype roster is incomplete")
    return source


__all__ = [
    "Archetype",
    "AuditionBuildResult",
    "AuditionPrototype",
    "AuditionSource",
    "AuthoringMode",
    "ProductShellAuditionError",
    "load_audition_source",
]
