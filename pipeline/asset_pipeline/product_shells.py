"""Compile reviewed semantic product-shell sources into safe deterministic SVG."""

from __future__ import annotations

from dataclasses import dataclass
import argparse
import html
import json
import math
from pathlib import Path
import re
from typing import Literal

from pydantic import Field, ValidationError, field_validator, model_validator

from .schema import ContractModel


PORTABLE_ID = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
HEX_COLOUR = re.compile(r"^#[0-9A-Fa-f]{6}$")
MAX_SOURCE_BYTES = 8 * 1024 * 1024
SUPPORTED_TEMPLATES = {
    "awning",
    "bag",
    "ball",
    "bottle",
    "bowl",
    "box",
    "can",
    "carton",
    "clock",
    "controller",
    "cup",
    "device",
    "headphones",
    "jar",
    "jersey",
    "luggage",
    "panel",
    "pot",
    "pouch",
    "shoe",
    "sign",
    "skateboard",
    "storefront",
    "surfboard",
    "tank",
    "tube",
    "vehicle",
    "watch",
}


class ProductShellError(ValueError):
    """Raised before an invalid or unsafe shell pack is written."""


def _portable_id(value: str, label: str) -> str:
    if not PORTABLE_ID.fullmatch(value):
        raise ValueError(f"{label} must be a portable kebab-case ID")
    return value


def _trimmed(value: str, label: str, maximum: int = 120) -> str:
    if value != value.strip() or not value or len(value) > maximum:
        raise ValueError(f"{label} must be non-empty trimmed text")
    return value


class ShellFamily(ContractModel):
    id: str
    title: str

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return _portable_id(value, "family ID")

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _trimmed(value, "family title")


class ShellRegion(ContractModel):
    id: str
    fill: str

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return _portable_id(value, "region ID")

    @field_validator("fill")
    @classmethod
    def validate_fill(cls, value: str) -> str:
        if not HEX_COLOUR.fullmatch(value):
            raise ValueError("region fill must be a six-digit hex colour")
        return value.upper()


class PrintArea(ContractModel):
    id: str
    x: float = Field(strict=True, ge=0.0, le=1.0, allow_inf_nan=False)
    y: float = Field(strict=True, ge=0.0, le=1.0, allow_inf_nan=False)
    width: float = Field(strict=True, gt=0.0, le=1.0, allow_inf_nan=False)
    height: float = Field(strict=True, gt=0.0, le=1.0, allow_inf_nan=False)
    safe_inset: float = Field(
        alias="safeInset", strict=True, ge=0.0, le=0.5, allow_inf_nan=False
    )

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return _portable_id(value, "print-area ID")

    @model_validator(mode="after")
    def validate_bounds(self) -> "PrintArea":
        if self.x + self.width > 1.0 or self.y + self.height > 1.0:
            raise ValueError("print area must fit inside the normalized canvas")
        if self.safe_inset * 2 >= min(self.width, self.height):
            raise ValueError("safe area must fit inside print area")
        return self


class PartSlot(ContractModel):
    id: str
    accepts: list[str] = Field(min_length=1, max_length=32)

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return _portable_id(value, "part-slot ID")

    @field_validator("accepts")
    @classmethod
    def validate_accepts(cls, values: list[str]) -> list[str]:
        checked = [_portable_id(value, "accepted part ID") for value in values]
        if checked != sorted(set(checked)):
            raise ValueError("accepted part IDs must be sorted and unique")
        return checked


class PreviewRecipe(ContractModel):
    kind: Literal["soft-2.5d"]
    highlight: float = Field(strict=True, ge=0.0, le=1.0, allow_inf_nan=False)
    shadow: float = Field(strict=True, ge=0.0, le=1.0, allow_inf_nan=False)


class ProductShell(ContractModel):
    id: str
    title: str
    family: str
    template: str
    parameters: dict[str, float]
    regions: list[ShellRegion] = Field(min_length=1, max_length=16)
    print_areas: list[PrintArea] = Field(
        alias="printAreas", min_length=1, max_length=8
    )
    part_slots: list[PartSlot] = Field(alias="partSlots", max_length=16)
    preview: PreviewRecipe
    classroom_reviewed: bool = Field(alias="classroomReviewed", strict=True)
    brand_free: bool = Field(alias="brandFree", strict=True)

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return _portable_id(value, "shell ID")

    @field_validator("family")
    @classmethod
    def validate_family(cls, value: str) -> str:
        return _portable_id(value, "shell family")

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _trimmed(value, "shell title")

    @model_validator(mode="after")
    def validate_contract(self) -> "ProductShell":
        if self.template not in SUPPORTED_TEMPLATES:
            raise ValueError("unsupported shell template")
        if set(self.parameters) != {"width", "height", "rounding"}:
            raise ValueError("panel parameters must be width, height and rounding")
        width = self.parameters["width"]
        height = self.parameters["height"]
        rounding = self.parameters["rounding"]
        if not all(math.isfinite(value) for value in (width, height, rounding)):
            raise ValueError("shell parameters must be finite")
        if not (0.2 <= width <= 0.95 and 0.2 <= height <= 0.95):
            raise ValueError("panel width and height must be within 0.2 and 0.95")
        if not (0.0 <= rounding <= 0.25):
            raise ValueError("panel rounding must be within 0 and 0.25")

        region_ids = [region.id for region in self.regions]
        if len(region_ids) != len(set(region_ids)):
            raise ValueError("region IDs must be unique")
        if "body" not in region_ids:
            raise ValueError("every shell requires a body region")
        print_ids = [area.id for area in self.print_areas]
        if len(print_ids) != len(set(print_ids)):
            raise ValueError("print-area IDs must be unique")
        slot_ids = [slot.id for slot in self.part_slots]
        if len(slot_ids) != len(set(slot_ids)):
            raise ValueError("part-slot IDs must be unique")
        return self


class ShellVariant(ContractModel):
    id: str
    title: str
    parameters: dict[str, float]

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        return _portable_id(value, "shell-variant ID")

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _trimmed(value, "shell-variant title")


class ShellSeries(ContractModel):
    family: str
    template: str
    regions: list[ShellRegion] = Field(min_length=1, max_length=16)
    print_areas: list[PrintArea] = Field(
        alias="printAreas", min_length=1, max_length=8
    )
    part_slots: list[PartSlot] = Field(alias="partSlots", max_length=16)
    preview: PreviewRecipe
    classroom_reviewed: bool = Field(alias="classroomReviewed", strict=True)
    brand_free: bool = Field(alias="brandFree", strict=True)
    variants: list[ShellVariant] = Field(min_length=1, max_length=64)

    @field_validator("family")
    @classmethod
    def validate_family(cls, value: str) -> str:
        return _portable_id(value, "shell-series family")

    @field_validator("template")
    @classmethod
    def validate_template(cls, value: str) -> str:
        if value not in SUPPORTED_TEMPLATES:
            raise ValueError("unsupported shell template")
        return value

    def expand(self) -> list[ProductShell]:
        shared = {
            "family": self.family,
            "template": self.template,
            "regions": [region.model_dump(by_alias=True) for region in self.regions],
            "printAreas": [
                area.model_dump(by_alias=True) for area in self.print_areas
            ],
            "partSlots": [
                slot.model_dump(by_alias=True) for slot in self.part_slots
            ],
            "preview": self.preview.model_dump(by_alias=True),
            "classroomReviewed": self.classroom_reviewed,
            "brandFree": self.brand_free,
        }
        return [
            ProductShell.model_validate(
                {
                    **shared,
                    "id": variant.id,
                    "title": variant.title,
                    "parameters": variant.parameters,
                },
                strict=True,
            )
            for variant in self.variants
        ]


class ProductShellSource(ContractModel):
    schema_id: Literal["product-shell-source@1"] = Field(alias="schema")
    pack_id: str = Field(alias="packId")
    families: list[ShellFamily]
    shells: list[ProductShell] = Field(default_factory=list)
    series: list[ShellSeries] = Field(default_factory=list)

    @field_validator("pack_id")
    @classmethod
    def validate_pack_id(cls, value: str) -> str:
        return _portable_id(value, "pack ID")

    @model_validator(mode="after")
    def validate_content(self) -> "ProductShellSource":
        if not self.shells and not self.series:
            raise ValueError("product shell source requires shells or series")
        return self

    def expanded_shells(self) -> list[ProductShell]:
        return [
            *self.shells,
            *(shell for series in self.series for shell in series.expand()),
        ]


@dataclass(frozen=True, slots=True)
class ProductShellBuildResult:
    family_count: int
    shell_count: int
    output_dir: Path
    report_dir: Path


def _require_empty(path: Path, label: str) -> None:
    if path.exists() and (not path.is_dir() or any(path.iterdir())):
        raise ProductShellError(f"{label} must be absent or empty")


def _canonical_json(value: object) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")


def _format_number(value: float) -> str:
    rendered = f"{value:.3f}".rstrip("0").rstrip(".")
    return rendered or "0"


def _scaled_area(area: PrintArea) -> tuple[float, float, float, float, float]:
    return (
        area.x * 1000,
        area.y * 1000,
        area.width * 1000,
        area.height * 1000,
        area.safe_inset * 1000,
    )


def _template_shapes(
    template: str, x: float, y: float, width: float, height: float, radius: float
) -> dict[str, str]:
    q = _format_number
    cx = x + width / 2
    cy = y + height / 2
    common = {
        "body": (
            f'<rect x="{q(x)}" y="{q(y)}" width="{q(width)}" '
            f'height="{q(height)}" rx="{q(radius)}"/>'
        ),
        "trim": (
            f'<rect x="{q(x)}" y="{q(y + height * 0.9)}" '
            f'width="{q(width)}" height="{q(height * 0.1)}"/>'
        ),
        "accent": (
            f'<rect x="{q(x + width * 0.08)}" y="{q(y + height * 0.08)}" '
            f'width="{q(width * 0.08)}" height="{q(height * 0.78)}" '
            f'rx="{q(radius * 0.4)}"/>'
        ),
        "label": (
            f'<rect x="{q(x + width * 0.2)}" y="{q(y + height * 0.24)}" '
            f'width="{q(width * 0.6)}" height="{q(height * 0.48)}" '
            f'rx="{q(radius * 0.5)}"/>'
        ),
    }
    if template == "panel":
        return common
    if template == "awning":
        return {
            "body": common["body"],
            "trim": (
                f'<path d="M {q(x)} {q(y + height * 0.24)} H {q(x + width)} '
                f'L {q(x + width * 0.92)} {q(y + height * 0.42)} '
                f'H {q(x + width * 0.08)} Z"/>'
                f'<path d="M {q(x + width * 0.08)} {q(y + height * 0.42)} '
                f'Q {q(x + width * 0.18)} {q(y + height * 0.5)} '
                f'{q(x + width * 0.28)} {q(y + height * 0.42)} '
                f'T {q(x + width * 0.48)} {q(y + height * 0.42)} '
                f'T {q(x + width * 0.68)} {q(y + height * 0.42)} '
                f'T {q(x + width * 0.92)} {q(y + height * 0.42)}" '
                'fill="none" stroke="currentColor" stroke-width="16"/>'
            ),
            "accent": (
                f'<rect x="{q(x + width * 0.1)}" y="{q(y + height * 0.5)}" '
                f'width="{q(width * 0.34)}" height="{q(height * 0.42)}"/>'
                f'<rect x="{q(x + width * 0.56)}" y="{q(y + height * 0.5)}" '
                f'width="{q(width * 0.34)}" height="{q(height * 0.42)}"/>'
            ),
            "label": (
                f'<rect x="{q(x + width * 0.16)}" y="{q(y + height * 0.06)}" '
                f'width="{q(width * 0.68)}" height="{q(height * 0.16)}" '
                f'rx="{q(radius * 0.4)}"/>'
            ),
        }
    if template == "bag":
        return {
            "body": (
                f'<path d="M {q(x + width * 0.08)} {q(y + height * 0.24)} '
                f'H {q(x + width * 0.92)} L {q(x + width * 0.82)} '
                f'{q(y + height * 0.96)} H {q(x + width * 0.18)} Z"/>'
            ),
            "trim": (
                f'<path d="M {q(x + width * 0.3)} {q(y + height * 0.28)} '
                f'V {q(y + height * 0.14)} Q {q(cx)} {q(y - height * 0.04)} '
                f'{q(x + width * 0.7)} {q(y + height * 0.14)} '
                f'V {q(y + height * 0.28)}" fill="none" '
                f'stroke="currentColor" stroke-width="{q(max(12, width * 0.045))}"/>'
            ),
            "accent": (
                f'<rect x="{q(x + width * 0.12)}" y="{q(y + height * 0.72)}" '
                f'width="{q(width * 0.76)}" height="{q(height * 0.12)}"/>'
            ),
            "label": common["label"],
        }
    if template == "bowl":
        return {
            "body": (
                f'<path d="M {q(x + width * 0.06)} {q(y + height * 0.3)} '
                f'Q {q(x + width * 0.16)} {q(y + height * 0.92)} '
                f'{q(cx)} {q(y + height * 0.94)} Q {q(x + width * 0.84)} '
                f'{q(y + height * 0.92)} {q(x + width * 0.94)} '
                f'{q(y + height * 0.3)} Z"/>'
            ),
            "trim": (
                f'<ellipse cx="{q(cx)}" cy="{q(y + height * 0.3)}" '
                f'rx="{q(width * 0.47)}" ry="{q(height * 0.12)}"/>'
            ),
            "accent": (
                f'<rect x="{q(x + width * 0.3)}" y="{q(y + height * 0.84)}" '
                f'width="{q(width * 0.4)}" height="{q(height * 0.09)}" '
                f'rx="{q(radius)}"/>'
            ),
            "label": (
                f'<rect x="{q(x + width * 0.33)}" y="{q(y + height * 0.48)}" '
                f'width="{q(width * 0.34)}" height="{q(height * 0.18)}" '
                f'rx="{q(radius * 0.5)}"/>'
            ),
        }
    if template == "box":
        return {
            "body": common["body"],
            "trim": (
                f'<path d="M {q(x)} {q(y + height * 0.22)} '
                f'L {q(x + width * 0.14)} {q(y)} H {q(x + width * 0.86)} '
                f'L {q(x + width)} {q(y + height * 0.22)} Z"/>'
            ),
            "accent": (
                f'<path d="M {q(x + width * 0.78)} {q(y + height * 0.22)} '
                f'L {q(x + width)} {q(y + height * 0.34)} V {q(y + height)} '
                f'H {q(x + width * 0.78)} Z"/>'
            ),
            "label": common["label"],
        }
    if template == "carton":
        return {
            "body": (
                f'<path d="M {q(x + width * 0.08)} {q(y + height * 0.24)} '
                f'L {q(x + width * 0.28)} {q(y)} H {q(x + width * 0.72)} '
                f'L {q(x + width * 0.92)} {q(y + height * 0.24)} '
                f'V {q(y + height)} H {q(x + width * 0.08)} Z"/>'
            ),
            "trim": (
                f'<path d="M {q(x + width * 0.28)} {q(y)} '
                f'L {q(cx)} {q(y + height * 0.24)} '
                f'L {q(x + width * 0.72)} {q(y)}" fill="none" '
                f'stroke="currentColor" stroke-width="{q(max(10, width * 0.035))}"/>'
            ),
            "accent": (
                f'<rect x="{q(x + width * 0.08)}" y="{q(y + height * 0.78)}" '
                f'width="{q(width * 0.84)}" height="{q(height * 0.1)}"/>'
            ),
            "label": common["label"],
        }
    if template == "clock":
        clock_radius = min(width, height) / 2
        return {
            "body": f'<circle cx="{q(cx)}" cy="{q(cy)}" r="{q(clock_radius)}"/>',
            "trim": (
                f'<circle cx="{q(cx)}" cy="{q(cy)}" r="{q(clock_radius * 0.9)}" '
                f'fill="none" stroke="currentColor" '
                f'stroke-width="{q(max(12, clock_radius * 0.08))}"/>'
            ),
            "accent": (
                f'<path d="M {q(cx)} {q(cy)} V {q(cy - clock_radius * 0.48)} '
                f'M {q(cx)} {q(cy)} L {q(cx + clock_radius * 0.38)} '
                f'{q(cy + clock_radius * 0.18)}" fill="none" '
                f'stroke="currentColor" stroke-width="{q(max(10, clock_radius * 0.06))}" '
                'stroke-linecap="round"/>'
            ),
            "label": (
                f'<circle cx="{q(cx)}" cy="{q(cy)}" '
                f'r="{q(clock_radius * 0.16)}"/>'
            ),
        }
    if template == "controller":
        return {
            "body": (
                f'<path d="M {q(x + width * 0.16)} {q(y + height * 0.18)} '
                f'Q {q(x + width * 0.04)} {q(y + height * 0.2)} '
                f'{q(x + width * 0.02)} {q(y + height * 0.5)} '
                f'L {q(x)} {q(y + height * 0.9)} Q {q(x + width * 0.12)} '
                f'{q(y + height)} {q(x + width * 0.28)} {q(y + height * 0.72)} '
                f'H {q(x + width * 0.72)} Q {q(x + width * 0.88)} '
                f'{q(y + height)} {q(x + width)} {q(y + height * 0.9)} '
                f'L {q(x + width * 0.98)} {q(y + height * 0.5)} '
                f'Q {q(x + width * 0.96)} {q(y + height * 0.2)} '
                f'{q(x + width * 0.84)} {q(y + height * 0.18)} Z"/>'
            ),
            "trim": (
                f'<circle cx="{q(x + width * 0.28)}" cy="{q(y + height * 0.5)}" '
                f'r="{q(min(width, height) * 0.1)}"/><circle '
                f'cx="{q(x + width * 0.72)}" cy="{q(y + height * 0.5)}" '
                f'r="{q(min(width, height) * 0.1)}"/>'
            ),
            "accent": (
                f'<circle cx="{q(x + width * 0.79)}" cy="{q(y + height * 0.34)}" '
                f'r="{q(min(width, height) * 0.035)}"/><circle '
                f'cx="{q(x + width * 0.86)}" cy="{q(y + height * 0.43)}" '
                f'r="{q(min(width, height) * 0.035)}"/>'
            ),
            "label": (
                f'<rect x="{q(x + width * 0.4)}" y="{q(y + height * 0.25)}" '
                f'width="{q(width * 0.2)}" height="{q(height * 0.18)}" '
                f'rx="{q(radius)}"/>'
            ),
        }
    if template == "cup":
        return {
            "body": (
                f'<path d="M {q(x + width * 0.12)} {q(y + height * 0.16)} '
                f'H {q(x + width * 0.88)} L {q(x + width * 0.76)} '
                f'{q(y + height * 0.96)} H {q(x + width * 0.24)} Z"/>'
            ),
            "trim": (
                f'<ellipse cx="{q(cx)}" cy="{q(y + height * 0.16)}" '
                f'rx="{q(width * 0.42)}" ry="{q(height * 0.055)}"/>'
                f'<rect x="{q(x + width * 0.08)}" y="{q(y + height * 0.09)}" '
                f'width="{q(width * 0.84)}" height="{q(height * 0.09)}" '
                f'rx="{q(radius * 0.35)}"/>'
            ),
            "accent": (
                f'<path d="M {q(x + width * 0.65)} {q(y + height * 0.1)} '
                f'L {q(x + width * 0.72)} {q(y - height * 0.14)}" '
                f'fill="none" stroke="currentColor" '
                f'stroke-width="{q(max(10, width * 0.04))}"/>'
            ),
            "label": common["label"],
        }
    if template == "headphones":
        return {
            "body": (
                f'<path d="M {q(x + width * 0.16)} {q(y + height * 0.56)} '
                f'V {q(y + height * 0.34)} Q {q(x + width * 0.16)} {q(y)} '
                f'{q(cx)} {q(y)} Q {q(x + width * 0.84)} {q(y)} '
                f'{q(x + width * 0.84)} {q(y + height * 0.34)} '
                f'V {q(y + height * 0.56)}" fill="none" '
                f'stroke="currentColor" stroke-width="{q(max(20, width * 0.085))}"/>'
            ),
            "trim": (
                f'<rect x="{q(x + width * 0.02)}" y="{q(y + height * 0.45)}" '
                f'width="{q(width * 0.25)}" height="{q(height * 0.45)}" '
                f'rx="{q(radius * 2)}"/><rect x="{q(x + width * 0.73)}" '
                f'y="{q(y + height * 0.45)}" width="{q(width * 0.25)}" '
                f'height="{q(height * 0.45)}" rx="{q(radius * 2)}"/>'
            ),
            "accent": (
                f'<rect x="{q(x + width * 0.08)}" y="{q(y + height * 0.53)}" '
                f'width="{q(width * 0.13)}" height="{q(height * 0.29)}" '
                f'rx="{q(radius)}"/><rect x="{q(x + width * 0.79)}" '
                f'y="{q(y + height * 0.53)}" width="{q(width * 0.13)}" '
                f'height="{q(height * 0.29)}" rx="{q(radius)}"/>'
            ),
            "label": (
                f'<circle cx="{q(x + width * 0.145)}" cy="{q(y + height * 0.675)}" '
                f'r="{q(min(width, height) * 0.07)}"/><circle '
                f'cx="{q(x + width * 0.855)}" cy="{q(y + height * 0.675)}" '
                f'r="{q(min(width, height) * 0.07)}"/>'
            ),
        }
    if template == "jar":
        return {
            "body": (
                f'<rect x="{q(x + width * 0.08)}" y="{q(y + height * 0.18)}" '
                f'width="{q(width * 0.84)}" height="{q(height * 0.78)}" '
                f'rx="{q(radius * 1.5)}"/>'
            ),
            "trim": (
                f'<rect x="{q(x)}" y="{q(y + height * 0.05)}" '
                f'width="{q(width)}" height="{q(height * 0.2)}" '
                f'rx="{q(radius * 0.7)}"/>'
            ),
            "accent": (
                f'<rect x="{q(x + width * 0.12)}" y="{q(y + height * 0.78)}" '
                f'width="{q(width * 0.76)}" height="{q(height * 0.08)}"/>'
            ),
            "label": common["label"],
        }
    if template == "jersey":
        return {
            "body": (
                f'<path d="M {q(x + width * 0.28)} {q(y + height * 0.08)} '
                f'L {q(x + width * 0.08)} {q(y + height * 0.22)} '
                f'L {q(x)} {q(y + height * 0.5)} L {q(x + width * 0.22)} '
                f'{q(y + height * 0.58)} V {q(y + height * 0.96)} '
                f'H {q(x + width * 0.78)} V {q(y + height * 0.58)} '
                f'L {q(x + width)} {q(y + height * 0.5)} '
                f'L {q(x + width * 0.92)} {q(y + height * 0.22)} '
                f'L {q(x + width * 0.72)} {q(y + height * 0.08)} '
                f'Q {q(cx)} {q(y + height * 0.25)} '
                f'{q(x + width * 0.28)} {q(y + height * 0.08)} Z"/>'
            ),
            "trim": (
                f'<path d="M {q(x + width * 0.37)} {q(y + height * 0.08)} '
                f'Q {q(cx)} {q(y + height * 0.24)} '
                f'{q(x + width * 0.63)} {q(y + height * 0.08)}" '
                f'fill="none" stroke="currentColor" '
                f'stroke-width="{q(max(10, width * 0.035))}"/>'
            ),
            "accent": (
                f'<path d="M {q(x + width * 0.22)} {q(y + height * 0.58)} '
                f'V {q(y + height * 0.96)} H {q(x + width * 0.31)} '
                f'V {q(y + height * 0.54)} Z"/><path '
                f'd="M {q(x + width * 0.78)} {q(y + height * 0.58)} '
                f'V {q(y + height * 0.96)} H {q(x + width * 0.69)} '
                f'V {q(y + height * 0.54)} Z"/>'
            ),
            "label": common["label"],
        }
    if template == "pot":
        return {
            "body": (
                f'<path d="M {q(x + width * 0.12)} {q(y + height * 0.2)} '
                f'H {q(x + width * 0.88)} L {q(x + width * 0.72)} '
                f'{q(y + height * 0.94)} H {q(x + width * 0.28)} Z"/>'
            ),
            "trim": (
                f'<rect x="{q(x)}" y="{q(y + height * 0.12)}" '
                f'width="{q(width)}" height="{q(height * 0.18)}" '
                f'rx="{q(radius * 0.6)}"/>'
            ),
            "accent": (
                f'<rect x="{q(x + width * 0.26)}" y="{q(y + height * 0.82)}" '
                f'width="{q(width * 0.48)}" height="{q(height * 0.08)}"/>'
            ),
            "label": common["label"],
        }
    if template == "pouch":
        return {
            "body": (
                f'<path d="M {q(x + width * 0.1)} {q(y + height * 0.08)} '
                f'Q {q(x + width * 0.24)} {q(y)} {q(x + width * 0.36)} '
                f'{q(y + height * 0.08)} T {q(x + width * 0.62)} '
                f'{q(y + height * 0.08)} T {q(x + width * 0.9)} '
                f'{q(y + height * 0.08)} L {q(x + width * 0.82)} '
                f'{q(y + height * 0.96)} H {q(x + width * 0.18)} Z"/>'
            ),
            "trim": (
                f'<rect x="{q(x + width * 0.1)}" y="{q(y + height * 0.12)}" '
                f'width="{q(width * 0.8)}" height="{q(height * 0.08)}"/>'
            ),
            "accent": (
                f'<path d="M {q(x + width * 0.18)} {q(y + height * 0.82)} '
                f'H {q(x + width * 0.82)} L {q(x + width * 0.78)} '
                f'{q(y + height * 0.94)} H {q(x + width * 0.22)} Z"/>'
            ),
            "label": common["label"],
        }
    if template == "skateboard":
        return {
            "body": (
                f'<path d="M {q(x + width * 0.08)} {q(y + height * 0.28)} '
                f'Q {q(x)} {q(cy)} {q(x + width * 0.08)} '
                f'{q(y + height * 0.72)} H {q(x + width * 0.92)} '
                f'Q {q(x + width)} {q(cy)} {q(x + width * 0.92)} '
                f'{q(y + height * 0.28)} Z"/>'
            ),
            "trim": (
                f'<circle cx="{q(x + width * 0.2)}" cy="{q(y + height * 0.85)}" '
                f'r="{q(height * 0.1)}"/><circle cx="{q(x + width * 0.8)}" '
                f'cy="{q(y + height * 0.85)}" r="{q(height * 0.1)}"/>'
            ),
            "accent": (
                f'<rect x="{q(x + width * 0.14)}" y="{q(y + height * 0.66)}" '
                f'width="{q(width * 0.18)}" height="{q(height * 0.09)}"/>'
                f'<rect x="{q(x + width * 0.68)}" y="{q(y + height * 0.66)}" '
                f'width="{q(width * 0.18)}" height="{q(height * 0.09)}"/>'
            ),
            "label": (
                f'<rect x="{q(x + width * 0.28)}" y="{q(y + height * 0.36)}" '
                f'width="{q(width * 0.44)}" height="{q(height * 0.28)}" '
                f'rx="{q(radius)}"/>'
            ),
        }
    if template == "surfboard":
        return {
            "body": (
                f'<path d="M {q(x)} {q(cy)} Q {q(cx)} {q(y)} '
                f'{q(x + width)} {q(cy)} Q {q(cx)} {q(y + height)} '
                f'{q(x)} {q(cy)} Z"/>'
            ),
            "trim": (
                f'<path d="M {q(x + width * 0.08)} {q(cy)} '
                f'Q {q(cx)} {q(y + height * 0.12)} '
                f'{q(x + width * 0.92)} {q(cy)} Q {q(cx)} '
                f'{q(y + height * 0.88)} {q(x + width * 0.08)} {q(cy)}" '
                f'fill="none" stroke="currentColor" '
                f'stroke-width="{q(max(10, height * 0.045))}"/>'
            ),
            "accent": (
                f'<path d="M {q(cx + width * 0.18)} {q(cy)} '
                f'L {q(cx + width * 0.28)} {q(cy + height * 0.24)} '
                f'L {q(cx + width * 0.12)} {q(cy + height * 0.12)} Z"/>'
            ),
            "label": (
                f'<rect x="{q(x + width * 0.28)}" y="{q(y + height * 0.32)}" '
                f'width="{q(width * 0.44)}" height="{q(height * 0.36)}" '
                f'rx="{q(radius)}"/>'
            ),
        }
    if template == "vehicle":
        return {
            "body": (
                f'<path d="M {q(x + width * 0.05)} {q(y + height * 0.38)} '
                f'H {q(x + width * 0.34)} L {q(x + width * 0.48)} '
                f'{q(y + height * 0.14)} H {q(x + width * 0.82)} '
                f'L {q(x + width * 0.96)} {q(y + height * 0.42)} '
                f'V {q(y + height * 0.78)} H {q(x + width * 0.05)} Z"/>'
            ),
            "trim": (
                f'<circle cx="{q(x + width * 0.23)}" cy="{q(y + height * 0.78)}" '
                f'r="{q(height * 0.13)}"/><circle cx="{q(x + width * 0.78)}" '
                f'cy="{q(y + height * 0.78)}" r="{q(height * 0.13)}"/>'
            ),
            "accent": (
                f'<path d="M {q(x + width * 0.5)} {q(y + height * 0.18)} '
                f'H {q(x + width * 0.78)} L {q(x + width * 0.89)} '
                f'{q(y + height * 0.4)} H {q(x + width * 0.5)} Z"/>'
            ),
            "label": (
                f'<rect x="{q(x + width * 0.34)}" y="{q(y + height * 0.46)}" '
                f'width="{q(width * 0.38)}" height="{q(height * 0.2)}" '
                f'rx="{q(radius * 0.5)}"/>'
            ),
        }
    if template == "watch":
        return {
            "body": (
                f'<rect x="{q(x + width * 0.38)}" y="{q(y)}" '
                f'width="{q(width * 0.24)}" height="{q(height)}" '
                f'rx="{q(radius)}"/><circle cx="{q(cx)}" cy="{q(cy)}" '
                f'r="{q(min(width, height) * 0.28)}"/>'
            ),
            "trim": (
                f'<circle cx="{q(cx)}" cy="{q(cy)}" '
                f'r="{q(min(width, height) * 0.25)}" fill="none" '
                f'stroke="currentColor" stroke-width="{q(max(10, width * 0.035))}"/>'
            ),
            "accent": (
                f'<rect x="{q(cx + min(width, height) * 0.27)}" '
                f'y="{q(cy - height * 0.04)}" width="{q(width * 0.08)}" '
                f'height="{q(height * 0.08)}" rx="{q(radius * 0.3)}"/>'
            ),
            "label": (
                f'<circle cx="{q(cx)}" cy="{q(cy)}" '
                f'r="{q(min(width, height) * 0.16)}"/>'
            ),
        }
    if template == "can":
        return {
            "body": common["body"],
            "trim": (
                f'<ellipse cx="{q(cx)}" cy="{q(y + height * 0.035)}" '
                f'rx="{q(width / 2)}" ry="{q(height * 0.055)}"/>'
                f'<ellipse cx="{q(cx)}" cy="{q(y + height * 0.965)}" '
                f'rx="{q(width / 2)}" ry="{q(height * 0.055)}"/>'
            ),
            "accent": common["accent"],
            "label": common["label"],
        }
    if template == "storefront":
        return {
            "body": common["body"],
            "trim": (
                f'<path d="M {q(x)} {q(y + height * 0.22)} H {q(x + width)} '
                f'L {q(x + width * 0.92)} {q(y + height * 0.36)} '
                f'H {q(x + width * 0.08)} Z"/>'
            ),
            "accent": (
                f'<rect x="{q(x + width * 0.12)}" y="{q(y + height * 0.46)}" '
                f'width="{q(width * 0.3)}" height="{q(height * 0.42)}"/>'
                f'<rect x="{q(x + width * 0.58)}" y="{q(y + height * 0.46)}" '
                f'width="{q(width * 0.3)}" height="{q(height * 0.42)}"/>'
            ),
            "label": (
                f'<rect x="{q(x + width * 0.16)}" y="{q(y + height * 0.06)}" '
                f'width="{q(width * 0.68)}" height="{q(height * 0.15)}" '
                f'rx="{q(radius * 0.45)}"/>'
            ),
        }
    if template == "shoe":
        return {
            "body": (
                f'<path d="M {q(x + width * 0.06)} {q(y + height * 0.64)} '
                f'C {q(x + width * 0.18)} {q(y + height * 0.45)}, '
                f'{q(x + width * 0.28)} {q(y + height * 0.2)}, '
                f'{q(x + width * 0.46)} {q(y + height * 0.22)} '
                f'C {q(x + width * 0.62)} {q(y + height * 0.24)}, '
                f'{q(x + width * 0.68)} {q(y + height * 0.5)}, '
                f'{q(x + width * 0.94)} {q(y + height * 0.62)} '
                f'L {q(x + width * 0.98)} {q(y + height * 0.78)} '
                f'H {q(x + width * 0.08)} Z"/>'
            ),
            "trim": (
                f'<path d="M {q(x + width * 0.04)} {q(y + height * 0.75)} '
                f'Q {q(cx)} {q(y + height * 0.88)} '
                f'{q(x + width * 0.98)} {q(y + height * 0.76)} '
                f'L {q(x + width * 0.96)} {q(y + height * 0.88)} '
                f'Q {q(cx)} {q(y + height * 0.96)} '
                f'{q(x + width * 0.06)} {q(y + height * 0.88)} Z"/>'
            ),
            "accent": (
                f'<path d="M {q(x + width * 0.34)} {q(y + height * 0.28)} '
                f'L {q(x + width * 0.55)} {q(y + height * 0.34)} '
                f'L {q(x + width * 0.67)} {q(y + height * 0.62)} '
                f'L {q(x + width * 0.45)} {q(y + height * 0.58)} Z"/>'
            ),
            "label": (
                f'<rect x="{q(x + width * 0.5)}" y="{q(y + height * 0.46)}" '
                f'width="{q(width * 0.22)}" height="{q(height * 0.12)}" '
                f'rx="{q(radius * 0.35)}"/>'
            ),
        }
    if template == "tube":
        return {
            "body": (
                f'<path d="M {q(x + width * 0.12)} {q(y)} '
                f'H {q(x + width * 0.88)} L {q(x + width * 0.78)} '
                f'{q(y + height * 0.84)} H {q(x + width * 0.22)} Z"/>'
            ),
            "trim": (
                f'<rect x="{q(x + width * 0.2)}" y="{q(y + height * 0.82)}" '
                f'width="{q(width * 0.6)}" height="{q(height * 0.16)}" '
                f'rx="{q(radius * 0.25)}"/>'
            ),
            "accent": common["accent"],
            "label": common["label"],
        }
    if template == "device":
        return {
            "body": common["body"],
            "trim": (
                f'<rect x="{q(x + width * 0.06)}" y="{q(y + height * 0.06)}" '
                f'width="{q(width * 0.88)}" height="{q(height * 0.88)}" '
                f'rx="{q(radius)}" fill="none" stroke="currentColor" '
                f'stroke-width="{q(max(8, width * 0.025))}"/>'
            ),
            "accent": (
                f'<circle cx="{q(x + width * 0.85)}" cy="{q(y + height * 0.84)}" '
                f'r="{q(min(width, height) * 0.035)}"/>'
            ),
            "label": (
                f'<rect x="{q(x + width * 0.12)}" y="{q(y + height * 0.12)}" '
                f'width="{q(width * 0.76)}" height="{q(height * 0.6)}" '
                f'rx="{q(radius * 0.55)}"/>'
            ),
        }
    if template == "ball":
        radius_ball = min(width, height) / 2
        return {
            "body": f'<circle cx="{q(cx)}" cy="{q(cy)}" r="{q(radius_ball)}"/>',
            "trim": (
                f'<path d="M {q(cx - radius_ball * 0.85)} {q(cy - radius_ball * 0.45)} '
                f'Q {q(cx)} {q(cy)} {q(cx + radius_ball * 0.85)} '
                f'{q(cy + radius_ball * 0.45)}" fill="none" '
                f'stroke="currentColor" stroke-width="{q(radius_ball * 0.1)}"/>'
            ),
            "accent": (
                f'<path d="M {q(cx - radius_ball * 0.5)} {q(cy + radius_ball * 0.86)} '
                f'Q {q(cx)} {q(cy)} {q(cx + radius_ball * 0.5)} '
                f'{q(cy - radius_ball * 0.86)}" fill="none" '
                f'stroke="currentColor" stroke-width="{q(radius_ball * 0.08)}"/>'
            ),
            "label": (
                f'<circle cx="{q(cx)}" cy="{q(cy)}" r="{q(radius_ball * 0.24)}"/>'
            ),
        }
    if template == "bottle":
        return {
            "body": (
                f'<path d="M {q(x + width * 0.34)} {q(y + height * 0.08)} '
                f'H {q(x + width * 0.66)} V {q(y + height * 0.2)} '
                f'C {q(x + width * 0.66)} {q(y + height * 0.26)}, '
                f'{q(x + width * 0.84)} {q(y + height * 0.28)}, '
                f'{q(x + width * 0.84)} {q(y + height * 0.4)} '
                f'V {q(y + height * 0.94)} H {q(x + width * 0.16)} '
                f'V {q(y + height * 0.4)} C {q(x + width * 0.16)} '
                f'{q(y + height * 0.28)}, {q(x + width * 0.34)} '
                f'{q(y + height * 0.26)}, {q(x + width * 0.34)} '
                f'{q(y + height * 0.2)} Z"/>'
            ),
            "trim": (
                f'<rect x="{q(x + width * 0.31)}" y="{q(y)}" '
                f'width="{q(width * 0.38)}" height="{q(height * 0.11)}" '
                f'rx="{q(radius * 0.35)}"/>'
            ),
            "accent": (
                f'<rect x="{q(x + width * 0.27)}" y="{q(y + height * 0.19)}" '
                f'width="{q(width * 0.46)}" height="{q(height * 0.06)}"/>'
            ),
            "label": common["label"],
        }
    if template == "luggage":
        return {
            "body": common["body"],
            "trim": (
                f'<path d="M {q(x + width * 0.34)} {q(y)} V '
                f'{q(y - height * 0.1)} H {q(x + width * 0.66)} V {q(y)}" '
                f'fill="none" stroke="currentColor" '
                f'stroke-width="{q(max(10, width * 0.04))}"/>'
                f'<circle cx="{q(x + width * 0.22)}" cy="{q(y + height * 0.98)}" '
                f'r="{q(width * 0.06)}"/><circle cx="{q(x + width * 0.78)}" '
                f'cy="{q(y + height * 0.98)}" r="{q(width * 0.06)}"/>'
            ),
            "accent": (
                f'<rect x="{q(x + width * 0.26)}" y="{q(y + height * 0.08)}" '
                f'width="{q(width * 0.08)}" height="{q(height * 0.78)}"/>'
                f'<rect x="{q(x + width * 0.66)}" y="{q(y + height * 0.08)}" '
                f'width="{q(width * 0.08)}" height="{q(height * 0.78)}"/>'
            ),
            "label": common["label"],
        }
    if template == "tank":
        return {
            "body": common["body"],
            "trim": (
                f'<rect x="{q(x)}" y="{q(y)}" width="{q(width)}" '
                f'height="{q(height)}" rx="{q(radius)}" fill="none" '
                f'stroke="currentColor" stroke-width="{q(max(12, width * 0.045))}"/>'
            ),
            "accent": (
                f'<rect x="{q(x + width * 0.05)}" y="{q(y + height * 0.38)}" '
                f'width="{q(width * 0.9)}" height="{q(height * 0.55)}"/>'
            ),
            "label": (
                f'<rect x="{q(x + width * 0.3)}" y="{q(y + height * 0.06)}" '
                f'width="{q(width * 0.4)}" height="{q(height * 0.17)}" '
                f'rx="{q(radius * 0.35)}"/>'
            ),
        }
    if template == "sign":
        return {
            "body": common["body"],
            "trim": (
                f'<rect x="{q(x + width * 0.04)}" y="{q(y + height * 0.04)}" '
                f'width="{q(width * 0.92)}" height="{q(height * 0.92)}" '
                f'rx="{q(radius)}" fill="none" stroke="currentColor" '
                f'stroke-width="{q(max(10, width * 0.035))}"/>'
            ),
            "accent": (
                f'<rect x="{q(x + width * 0.12)}" y="{q(y + height * 0.78)}" '
                f'width="{q(width * 0.76)}" height="{q(height * 0.08)}"/>'
            ),
            "label": (
                f'<rect x="{q(x + width * 0.12)}" y="{q(y + height * 0.18)}" '
                f'width="{q(width * 0.76)}" height="{q(height * 0.48)}" '
                f'rx="{q(radius * 0.45)}"/>'
            ),
        }
    raise ProductShellError("unsupported shell template")


def _render_panel(shell: ProductShell, *, preview: bool) -> str:
    shell_id = html.escape(shell.id, quote=True)
    width = shell.parameters["width"] * 1000
    height = shell.parameters["height"] * 1000
    x = (1000 - width) / 2
    y = (1000 - height) / 2
    radius = min(width, height) * shell.parameters["rounding"]

    definitions = []
    for area in shell.print_areas:
        px, py, pwidth, pheight, _ = _scaled_area(area)
        definitions.append(
            f'<clipPath id="{shell_id}--clip-{html.escape(area.id, quote=True)}">'
            f'<rect x="{_format_number(px)}" y="{_format_number(py)}" '
            f'width="{_format_number(pwidth)}" height="{_format_number(pheight)}"/>'
            "</clipPath>"
        )
    if preview:
        definitions.append(
            f'<linearGradient id="{shell_id}--preview-gradient" x1="0" y1="0" x2="1" y2="0">'
            '<stop offset="0" stop-color="#000000" stop-opacity="0.18"/>'
            '<stop offset="0.42" stop-color="#FFFFFF" stop-opacity="0.22"/>'
            '<stop offset="1" stop-color="#000000" stop-opacity="0.2"/>'
            "</linearGradient>"
        )

    shapes = _template_shapes(shell.template, x, y, width, height, radius)
    region_markup = []
    for index, region in enumerate(shell.regions):
        region_id = html.escape(region.id, quote=True)
        fill = html.escape(region.fill, quote=True)
        shape = shapes.get(region.id)
        if shape is None:
            stripe_height = max(12.0, height * 0.055)
            stripe_y = y + height - stripe_height * index
            shape = (
                f'<rect x="{_format_number(x)}" y="{_format_number(stripe_y)}" '
                f'width="{_format_number(width)}" height="{_format_number(stripe_height)}" '
                "/>"
            )
        region_markup.append(
            f'<g id="{shell_id}--region-{region_id}" data-region="{region_id}" '
            f'fill="{fill}" color="{fill}">{shape}</g>'
        )

    print_markup = []
    for area in shell.print_areas:
        area_id = html.escape(area.id, quote=True)
        px, py, pwidth, pheight, inset = _scaled_area(area)
        print_markup.append(
            f'<rect id="{shell_id}--print-{area_id}" data-print-area="{area_id}" '
            f'x="{_format_number(px)}" y="{_format_number(py)}" '
            f'width="{_format_number(pwidth)}" height="{_format_number(pheight)}" '
            'fill="none" stroke="#2E6AE6" stroke-width="4" stroke-dasharray="12 8"/>'
        )
        print_markup.append(
            f'<rect id="{shell_id}--safe-{area_id}" data-safe-area="{area_id}" '
            f'x="{_format_number(px + inset)}" y="{_format_number(py + inset)}" '
            f'width="{_format_number(pwidth - 2 * inset)}" '
            f'height="{_format_number(pheight - 2 * inset)}" '
            'fill="none" stroke="#20A464" stroke-width="3" stroke-dasharray="8 8"/>'
        )
        print_markup.append(
            f'<g id="{shell_id}--artwork-{area_id}" '
            f'clip-path="url(#{shell_id}--clip-{area_id})"></g>'
        )

    preview_underlay = ""
    preview_overlay = ""
    if preview:
        shadow_opacity = _format_number(shell.preview.shadow)
        depth_opacity = _format_number(shell.preview.shadow * 0.72)
        overlay_opacity = _format_number(shell.preview.highlight)
        preview_underlay = (
            f'<ellipse id="{shell_id}--preview-shadow" cx="500" '
            f'cy="{_format_number(y + height + 28)}" rx="{_format_number(width * 0.44)}" '
            f'ry="22" fill="#000000" opacity="{shadow_opacity}"/>'
            f'<g id="{shell_id}--preview-depth" fill="#20262D" color="#20262D" '
            f'opacity="{depth_opacity}" transform="translate(22 16)">'
            f'{shapes["body"]}</g>'
        )
        preview_overlay = (
            f'<g id="{shell_id}--preview-overlay" '
            f'fill="url(#{shell_id}--preview-gradient)" '
            f'opacity="{overlay_opacity}">{shapes["body"]}</g>'
        )
    print_guides = "" if preview else "".join(print_markup)

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" '
        f'data-shell-id="{shell_id}" data-template="{html.escape(shell.template, quote=True)}">'
        f'<defs>{"".join(definitions)}</defs>'
        f'{preview_underlay}'
        f'<g id="{shell_id}--regions">{"".join(region_markup)}</g>'
        f'<g id="{shell_id}--print-guides">{print_guides}</g>'
        f'{preview_overlay}</svg>\n'
    )


def _validate_source(
    source: ProductShellSource, shells: list[ProductShell]
) -> None:
    family_ids = [family.id for family in source.families]
    if len(family_ids) != 10:
        raise ProductShellError("product shell source requires exactly ten launch families")
    if len(family_ids) != len(set(family_ids)):
        raise ProductShellError("family IDs must be unique")
    shell_ids = [shell.id for shell in shells]
    if len(shell_ids) < 60:
        raise ProductShellError("product shell source requires at least sixty shells")
    if len(shell_ids) != len(set(shell_ids)):
        raise ProductShellError("shell IDs must be unique")
    known_families = set(family_ids)
    if any(shell.family not in known_families for shell in shells):
        raise ProductShellError("every shell must reference a declared family")
    if {shell.family for shell in shells} != known_families:
        raise ProductShellError("every launch family requires at least one shell")
    if any(not shell.classroom_reviewed for shell in shells):
        raise ProductShellError("every launch shell must be classroom reviewed")
    if any(not shell.brand_free for shell in shells):
        raise ProductShellError("every launch shell must be brand free")


def _render_contact_sheet(
    source: ProductShellSource,
    families: list[ShellFamily],
    shells: list[ProductShell],
) -> str:
    family_titles = {family.id: family.title for family in families}
    options = "".join(
        f'<option value="{html.escape(family.id, quote=True)}">'
        f'{html.escape(family.title)}</option>'
        for family in families
    )
    cards = []
    for shell in shells:
        shell_id = html.escape(shell.id, quote=True)
        family_id = html.escape(shell.family, quote=True)
        title = html.escape(shell.title)
        family_title = html.escape(family_titles[shell.family])
        regions = ", ".join(html.escape(region.id) for region in shell.regions)
        print_areas = ", ".join(
            f'{html.escape(area.id)} (safe {area.safe_inset:.3f})'
            for area in shell.print_areas
        )
        parts = "; ".join(
            f'{html.escape(slot.id)}: '
            + ", ".join(html.escape(part) for part in slot.accepts)
            for slot in shell.part_slots
        )
        authoring_path = f"shells/{shell_id}/authoring.svg"
        preview_path = f"shells/{shell_id}/preview.svg"
        cards.append(
            f'<article class="shell-card" data-shell-id="{shell_id}" '
            f'data-family="{family_id}"><header><p>{family_title}</p>'
            f'<h2>{title}</h2><code>{shell_id}</code></header>'
            '<div class="pair">'
            '<figure><figcaption>Flat authoring</figcaption>'
            f'<a href="{authoring_path}" target="_blank" rel="noopener">'
            f'<img src="{authoring_path}" alt="Flat authoring view of {title}"></a>'
            '</figure><figure><figcaption>2.5D preview</figcaption>'
            f'<a href="{preview_path}" target="_blank" rel="noopener">'
            f'<img src="{preview_path}" alt="Preview of {title}"></a></figure></div>'
            '<dl>'
            f'<dt>Template</dt><dd>{html.escape(shell.template)}</dd>'
            f'<dt>Regions</dt><dd>{regions}</dd>'
            f'<dt>Print area</dt><dd>{print_areas}</dd>'
            f'<dt>Part slots</dt><dd>{parts or "None"}</dd>'
            '<dt>Review</dt><dd>PASS · classroom reviewed · brand free</dd>'
            '</dl></article>'
        )

    pack_id = html.escape(source.pack_id)
    return (
        '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>{pack_id} review</title><style>'
        ':root{color-scheme:light;--ink:#20262d;--paper:#f6f1e7;--card:#fffdf8;'
        '--line:#c9c0b1;--blue:#2e6ae6;--green:#168653}'
        '*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);'
        'font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.4}'
        'main{max-width:1680px;margin:auto;padding:24px}.mast{display:grid;gap:12px;'
        'grid-template-columns:1fr auto;align-items:end;border-bottom:2px solid var(--ink);'
        'padding-bottom:18px}.mast h1{margin:0;font-size:clamp(1.8rem,4vw,3.2rem)}'
        '.mast p{margin:.25rem 0}.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap}'
        'select{min-height:44px;padding:0 12px;border:2px solid var(--ink);background:white}'
        '.status,.legend,.rubric{margin:18px 0;padding:14px;border:1px solid var(--line);'
        'background:#fffaf0}.status strong{color:#08633d}.legend span{margin-right:18px}'
        '.swatch{display:inline-block;width:28px;border-top:4px dashed;vertical-align:middle}'
        '.print{border-color:var(--blue)}.safe{border-color:var(--green)}'
        '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(390px,1fr));gap:18px}'
        '.shell-card{background:var(--card);border:1px solid var(--line);padding:14px;'
        'box-shadow:0 6px 18px #32291412}.shell-card[hidden]{display:none}'
        '.shell-card header p,.shell-card h2{margin:0}.shell-card header p{font-size:.8rem;'
        'font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#5a5145}'
        '.shell-card code{font-size:.72rem}.pair{display:grid;grid-template-columns:1fr 1fr;'
        'gap:10px;margin-top:12px}figure{margin:0}figcaption{font-weight:750;margin-bottom:5px}'
        'figure a{display:block;border:1px solid var(--line);background:#f2eee6}'
        'figure img{display:block;width:100%;aspect-ratio:1;object-fit:contain}'
        'dl{display:grid;grid-template-columns:92px 1fr;gap:5px 10px;margin:12px 0 0}'
        'dt{font-weight:750}dd{margin:0;overflow-wrap:anywhere}.rubric ul{margin:.5rem 0 0;'
        'padding-left:1.2rem}@media(max-width:620px){main{padding:14px}.mast{grid-template-columns:1fr}'
        '.grid{grid-template-columns:1fr}.pair{grid-template-columns:1fr 1fr}}'
        '</style></head><body><main><section class="mast"><div>'
        f'<p>Deterministic teacher review · {len(families)} families · {len(shells)} shells</p>'
        f'<h1>{pack_id}</h1></div><div class="controls"><label for="family-filter">'
        'Family</label><select id="family-filter"><option value="">All families</option>'
        f'{options}</select><strong id="visible-count">{len(shells)} shown</strong></div></section>'
        '<section class="status" aria-label="Automated checks"><strong>PASS</strong> · '
        'unique IDs · safe SVG · Body region · contained safe areas · preview pair · '
        'classroom reviewed · brand free</section><section class="legend" aria-label="Guide legend">'
        '<span><i class="swatch print"></i> Print area</span>'
        '<span><i class="swatch safe"></i> Safe area</span></section>'
        '<section class="rubric"><strong>Reject a shell if:</strong><ul>'
        '<li>regions are unclear or the print area is cramped or off the product;</li>'
        '<li>the flat and preview silhouettes disagree or the projection misleads;</li>'
        '<li>a variant changes only colour rather than silhouette or useful parts.</li>'
        '</ul></section><section class="grid" id="shell-grid">'
        f'{"".join(cards)}</section></main><script>'
        'const filter=document.querySelector("#family-filter");'
        'const count=document.querySelector("#visible-count");'
        'const cards=[...document.querySelectorAll(".shell-card")];'
        'filter.addEventListener("change",()=>{let shown=0;for(const card of cards){'
        'card.hidden=Boolean(filter.value)&&card.dataset.family!==filter.value;'
        'if(!card.hidden)shown+=1}count.textContent=`${shown} shown`});'
        '</script></body></html>\n'
    )


def compile_product_shells(
    source_path: Path, output_dir: Path, report_dir: Path
) -> ProductShellBuildResult:
    """Validate and compile one source manifest without destructive cleanup."""

    source_path = Path(source_path)
    output_dir = Path(output_dir)
    report_dir = Path(report_dir)
    _require_empty(output_dir, "product-shell output directory")
    _require_empty(report_dir, "product-shell report directory")
    if not source_path.is_file():
        raise ProductShellError("product-shell source manifest does not exist")
    if source_path.stat().st_size > MAX_SOURCE_BYTES:
        raise ProductShellError("product-shell source manifest exceeds 8 MiB")
    try:
        raw = json.loads(source_path.read_text(encoding="utf-8"))
        source = ProductShellSource.model_validate(raw, strict=True)
    except (OSError, UnicodeError, json.JSONDecodeError, ValidationError, ValueError) as error:
        raise ProductShellError(str(error)) from error
    expanded_shells = source.expanded_shells()
    _validate_source(source, expanded_shells)

    ordered_families = sorted(source.families, key=lambda family: family.id)
    ordered_shells = sorted(expanded_shells, key=lambda shell: shell.id)
    prepared = [
        (shell, _render_panel(shell, preview=False), _render_panel(shell, preview=True))
        for shell in ordered_shells
    ]
    catalogue = {
        "schema": "product-shell-catalog@1",
        "version": 1,
        "packId": source.pack_id,
        "families": [family.model_dump(by_alias=True) for family in ordered_families],
        "shells": [
            {
                "id": shell.id,
                "title": shell.title,
                "family": shell.family,
                "template": shell.template,
                "authoringSvg": f"shells/{shell.id}/authoring.svg",
                "previewSvg": f"shells/{shell.id}/preview.svg",
                "regions": [region.id for region in shell.regions],
                "printAreas": [
                    area.model_dump(by_alias=True) for area in shell.print_areas
                ],
                "partSlots": [
                    slot.model_dump(by_alias=True) for slot in shell.part_slots
                ],
                "preview": shell.preview.model_dump(by_alias=True),
                "classroomReviewed": shell.classroom_reviewed,
                "brandFree": shell.brand_free,
            }
            for shell in ordered_shells
        ],
    }
    qa = {
        "schema": "product-shell-qa@1",
        "packId": source.pack_id,
        "familyCount": len(ordered_families),
        "shellCount": len(ordered_shells),
        "errors": [],
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "catalog.json").write_bytes(_canonical_json(catalogue))
    for shell, authoring, preview in prepared:
        shell_dir = output_dir / "shells" / shell.id
        shell_dir.mkdir(parents=True, exist_ok=True)
        (shell_dir / "authoring.svg").write_text(authoring, encoding="utf-8", newline="\n")
        (shell_dir / "preview.svg").write_text(preview, encoding="utf-8", newline="\n")
        report_shell_dir = report_dir / "shells" / shell.id
        report_shell_dir.mkdir(parents=True, exist_ok=True)
        (report_shell_dir / "authoring.svg").write_text(
            authoring, encoding="utf-8", newline="\n"
        )
        (report_shell_dir / "preview.svg").write_text(
            preview, encoding="utf-8", newline="\n"
        )
    (report_dir / "qa.json").write_bytes(_canonical_json(qa))
    (report_dir / "contact-sheet.html").write_text(
        _render_contact_sheet(source, ordered_families, ordered_shells),
        encoding="utf-8",
        newline="\n",
    )

    return ProductShellBuildResult(
        family_count=len(ordered_families),
        shell_count=len(ordered_shells),
        output_dir=output_dir,
        report_dir=report_dir,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args(argv)
    result = compile_product_shells(args.source, args.out, args.report)
    print(
        json.dumps(
            {"families": result.family_count, "shells": result.shell_count},
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
