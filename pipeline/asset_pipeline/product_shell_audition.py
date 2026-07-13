"""Strict source contract for the product-shell visual-style audition."""

from __future__ import annotations

import argparse
import hashlib
import html
import json
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


def _require_empty(path: Path, label: str) -> None:
    if path.exists() and (not path.is_dir() or any(path.iterdir())):
        raise ProductShellAuditionError(f"{label} must be absent or empty")


def _require_disjoint_targets(output_dir: Path, report_dir: Path) -> None:
    resolved_output = output_dir.resolve(strict=False)
    resolved_report = report_dir.resolve(strict=False)
    if (
        resolved_output == resolved_report
        or resolved_output.is_relative_to(resolved_report)
        or resolved_report.is_relative_to(resolved_output)
    ):
        raise ProductShellAuditionError(
            "audition output and report directories must not overlap"
        )


def _canonical_json(value: object) -> bytes:
    return (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")


def _sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


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


def _render_contact_sheet(
    prepared: list[tuple[AuditionPrototype, str, str]],
) -> bytes:
    cards: list[str] = []
    for prototype, preview, review in prepared:
        title = html.escape(prototype.title)
        mode = (
            "Flat skin"
            if prototype.authoring_mode == "flat-skin"
            else "Direct surface"
        )
        cards.append(
            '<article class="prototype-card">'
            '<div class="view-pair">'
            '<figure><figcaption>Clean preview</figcaption>'
            f'<div class="view" data-view="preview">{preview}</div></figure>'
            '<figure><figcaption>Editor-selected</figcaption>'
            f'<div class="view" data-view="review">{review}</div></figure>'
            "</div>"
            f"<footer><h2>{title}</h2><p>{mode}</p></footer>"
            "</article>"
        )
    document = (
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        "<title>Product-shell style audition</title><style>"
        "*{box-sizing:border-box}body{margin:0;padding:24px;background:#F4F1EA;"
        "color:#34414D;font-family:system-ui,sans-serif}main{max-width:1800px;"
        "margin:0 auto}.audition-grid{display:grid;"
        "grid-template-columns:repeat(4,minmax(0,1fr));"
        "grid-template-rows:repeat(3,auto);gap:16px}.prototype-card{"
        "min-width:0;background:#FFFFFF;border:1px solid #D7D2C8;"
        "border-radius:10px;padding:12px}.view-pair{display:grid;"
        "grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}figure{margin:0;"
        "min-width:0}figcaption{margin:0 0 6px;font-size:11px;font-weight:700;"
        "letter-spacing:.04em;text-transform:uppercase}.view{background:#FAF8F3;"
        "border:1px solid #E7E2D8;border-radius:6px;overflow:hidden}.view svg{"
        "display:block;width:100%;height:auto}footer{padding:10px 2px 0}h2{"
        "margin:0;font-size:16px;line-height:1.2}p{margin:4px 0 0;font-size:13px;"
        "color:#6A7580}</style></head><body><main><section class=\"audition-grid\" "
        f'aria-label="Twelve product-shell prototypes">{"".join(cards)}'
        "</section></main></body></html>\n"
    )
    return document.encode("utf-8")


def build_product_shell_audition(
    source_path: Path, output_dir: Path, report_dir: Path
) -> AuditionBuildResult:
    """Build one deterministic audition iteration without touching other packs."""

    from .product_shell_art import artwork_surface_for, render_audition_svg

    source_path = Path(source_path)
    output_dir = Path(output_dir)
    report_dir = Path(report_dir)
    _require_disjoint_targets(output_dir, report_dir)
    _require_empty(output_dir, "audition output directory")
    _require_empty(report_dir, "audition report directory")

    source = load_audition_source(source_path)
    prototypes = sorted(source.prototypes, key=lambda prototype: prototype.id)
    source_snapshot = {
        "schema": source.schema_id,
        "packId": source.pack_id,
        "prototypes": [
            prototype.model_dump(by_alias=True, mode="json")
            for prototype in prototypes
        ],
    }
    source_bytes = _canonical_json(source_snapshot)

    runtime_files: dict[str, bytes] = {}
    report_files: dict[str, bytes] = {}
    catalogue_records: list[dict[str, object]] = []
    contact_sheet_records: list[tuple[AuditionPrototype, str, str]] = []
    svg_hashes: dict[str, str] = {}
    for prototype in prototypes:
        authoring = render_audition_svg(prototype, view="authoring")
        preview = render_audition_svg(prototype, view="preview")
        review = render_audition_svg(prototype, view="review")
        surface = artwork_surface_for(prototype.archetype)
        authoring_path = f"prototypes/{prototype.id}/authoring.svg"
        preview_path = f"prototypes/{prototype.id}/preview.svg"
        review_path = f"prototypes/{prototype.id}/review.svg"
        runtime_files[authoring_path] = authoring.encode("utf-8")
        runtime_files[preview_path] = preview.encode("utf-8")
        report_files[review_path] = review.encode("utf-8")
        svg_hashes[f"runtime/{authoring_path}"] = _sha256(
            runtime_files[authoring_path]
        )
        svg_hashes[f"runtime/{preview_path}"] = _sha256(
            runtime_files[preview_path]
        )
        svg_hashes[f"report/{review_path}"] = _sha256(report_files[review_path])
        catalogue_records.append(
            {
                "id": prototype.id,
                "title": prototype.title,
                "family": prototype.family,
                "archetype": prototype.archetype,
                "authoringMode": prototype.authoring_mode,
                "authoringSvg": authoring_path,
                "previewSvg": preview_path,
                "regions": [region.id for region in prototype.regions],
                "artworkSurface": {
                    "path": surface.path,
                    "bounds": list(surface.bounds),
                },
                "classroomReviewed": prototype.classroom_reviewed,
                "brandFree": prototype.brand_free,
                "status": prototype.status,
            }
        )
        contact_sheet_records.append((prototype, preview, review))

    audition = {
        "schema": "product-shell-style-audition-output@1",
        "version": 1,
        "packId": source.pack_id,
        "status": "audition",
        "sourceSnapshot": "source.json",
        "prototypes": catalogue_records,
    }
    qa = {
        "schema": "product-shell-style-audition-qa@1",
        "packId": source.pack_id,
        "prototypeCount": len(prototypes),
        "errors": [],
        "reviewStatus": "PENDING_VISUAL_PANEL",
        "sourceSnapshot": {
            "path": "source.json",
            "sha256": _sha256(source_bytes),
        },
        "svgSha256": dict(sorted(svg_hashes.items())),
    }
    runtime_files["audition.json"] = _canonical_json(audition)
    runtime_files["source.json"] = source_bytes
    report_files["qa.json"] = _canonical_json(qa)
    report_files["contact-sheet.html"] = _render_contact_sheet(
        contact_sheet_records
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)
    for relative_path, payload in sorted(runtime_files.items()):
        destination = output_dir / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(payload)
    for relative_path, payload in sorted(report_files.items()):
        destination = report_dir / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(payload)

    return AuditionBuildResult(
        prototype_count=len(prototypes),
        output_dir=output_dir,
        report_dir=report_dir,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    arguments = parser.parse_args(argv)
    result = build_product_shell_audition(
        arguments.source, arguments.out, arguments.report
    )
    print(json.dumps({"prototypes": result.prototype_count}, sort_keys=True))
    return 0


__all__ = [
    "Archetype",
    "AuditionBuildResult",
    "AuditionPrototype",
    "AuditionSource",
    "AuthoringMode",
    "ProductShellAuditionError",
    "build_product_shell_audition",
    "load_audition_source",
]


if __name__ == "__main__":
    raise SystemExit(main())
