from __future__ import annotations

import copy
import json
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from asset_pipeline.product_shells import ProductShellError, compile_product_shells


FAMILIES = [
    ("drinks-snacks", "Drinks & Snacks"),
    ("fast-food-hospitality", "Fast Food & Hospitality"),
    ("fashion-footwear", "Fashion & Footwear"),
    ("beauty-care", "Beauty & Care"),
    ("tech-gadgets", "Tech & Gadgets"),
    ("sport-outdoors", "Sport & Outdoors"),
    ("home-lifestyle", "Home & Lifestyle"),
    ("travel-transport", "Travel & Transport"),
    ("pets-animals", "Pets & Animals"),
    ("shops-services", "Shops & Services"),
]


def source_manifest() -> dict:
    shells = []
    for family_id, family_title in FAMILIES:
        for index in range(6):
            shell_id = f"{family_id}-panel-{index + 1:02d}"
            shells.append(
                {
                    "id": shell_id,
                    "title": f"{family_title} Panel {index + 1}",
                    "family": family_id,
                    "template": "panel",
                    "parameters": {
                        "width": 0.62 + index * 0.025,
                        "height": 0.72 - index * 0.02,
                        "rounding": 0.04 + index * 0.005,
                    },
                    "regions": [
                        {"id": "body", "fill": "#E9E5DC"},
                        {"id": "trim", "fill": "#35383C"},
                    ],
                    "printAreas": [
                        {
                            "id": "front",
                            "x": 0.24,
                            "y": 0.24,
                            "width": 0.52,
                            "height": 0.48,
                            "safeInset": 0.04,
                        }
                    ],
                    "partSlots": [
                        {"id": "top", "accepts": ["badge", "cap"]}
                    ],
                    "preview": {
                        "kind": "soft-2.5d",
                        "highlight": 0.16,
                        "shadow": 0.18,
                    },
                    "classroomReviewed": True,
                    "brandFree": True,
                }
            )
    return {
        "schema": "product-shell-source@1",
        "packId": "product-shells-v1",
        "families": [
            {"id": family_id, "title": family_title}
            for family_id, family_title in FAMILIES
        ],
        "shells": shells,
    }


def write_source(path: Path, value: dict) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def test_compiler_emits_deterministic_safe_authoring_and_preview_svg(tmp_path: Path):
    source = tmp_path / "manifest.json"
    write_source(source, source_manifest())

    first = compile_product_shells(source, tmp_path / "out-a", tmp_path / "report-a")
    second = compile_product_shells(source, tmp_path / "out-b", tmp_path / "report-b")

    assert first.family_count == 10
    assert first.shell_count == 60
    assert second.family_count == first.family_count
    assert second.shell_count == first.shell_count
    assert (tmp_path / "out-a" / "catalog.json").read_bytes() == (
        tmp_path / "out-b" / "catalog.json"
    ).read_bytes()
    assert (tmp_path / "report-a" / "qa.json").read_bytes() == (
        tmp_path / "report-b" / "qa.json"
    ).read_bytes()
    assert (tmp_path / "report-a" / "contact-sheet.html").read_bytes() == (
        tmp_path / "report-b" / "contact-sheet.html"
    ).read_bytes()

    shell_id = "drinks-snacks-panel-01"
    authoring = (tmp_path / "out-a" / "shells" / shell_id / "authoring.svg").read_text(
        encoding="utf-8"
    )
    preview = (tmp_path / "out-a" / "shells" / shell_id / "preview.svg").read_text(
        encoding="utf-8"
    )
    assert f'id="{shell_id}--region-body"' in authoring
    assert f'id="{shell_id}--print-front"' in authoring
    assert f'clip-path="url(#{shell_id}--clip-front)"' in authoring
    assert f'id="{shell_id}--preview-overlay"' in preview
    assert f'id="{shell_id}--preview-depth"' in preview
    assert "data-print-area=" not in preview
    assert "data-safe-area=" not in preview
    forbidden = ("<text", "<image", "<script", " href=", " xlink:href=", " onload=")
    assert not any(token in authoring.lower() for token in forbidden)
    assert not any(token in preview.lower() for token in forbidden)

    catalogue = json.loads((tmp_path / "out-a" / "catalog.json").read_text("utf-8"))
    assert catalogue["schema"] == "product-shell-catalog@1"
    assert len(catalogue["families"]) == 10
    assert len(catalogue["shells"]) == 60
    assert catalogue["shells"][0]["regions"] == ["body", "trim"]
    assert catalogue["shells"][0]["printAreas"][0]["id"] == "front"

    contact_sheet = (tmp_path / "report-a" / "contact-sheet.html").read_text(
        "utf-8"
    )
    assert '<select id="family-filter"' in contact_sheet
    assert contact_sheet.count('data-shell-id="') == 60
    assert contact_sheet.count('data-family="drinks-snacks"') == 6
    assert contact_sheet.count("authoring.svg") == 120
    assert contact_sheet.count("preview.svg") == 120
    assert "Print area" in contact_sheet and "Safe area" in contact_sheet
    assert "http://" not in contact_sheet and "https://" not in contact_sheet


def test_compiler_rejects_safe_area_that_cannot_fit_inside_print_area(tmp_path: Path):
    manifest = source_manifest()
    manifest["shells"][0]["printAreas"][0]["safeInset"] = 0.3
    source = tmp_path / "manifest.json"
    write_source(source, manifest)

    with pytest.raises(ProductShellError, match="safe area must fit inside print area"):
        compile_product_shells(source, tmp_path / "out", tmp_path / "report")


def test_compiler_rejects_duplicate_regions_and_unknown_external_content(tmp_path: Path):
    duplicate = source_manifest()
    duplicate["shells"][0]["regions"].append(
        {"id": "body", "fill": "#FFFFFF"}
    )
    duplicate_source = tmp_path / "duplicate.json"
    write_source(duplicate_source, duplicate)

    with pytest.raises(ProductShellError, match="region IDs must be unique"):
        compile_product_shells(
            duplicate_source,
            tmp_path / "duplicate-out",
            tmp_path / "duplicate-report",
        )

    unsafe = copy.deepcopy(source_manifest())
    unsafe["shells"][0]["template"] = "https://example.test/product.svg"
    unsafe_source = tmp_path / "unsafe.json"
    write_source(unsafe_source, unsafe)

    with pytest.raises(ProductShellError, match="unsupported shell template"):
        compile_product_shells(
            unsafe_source,
            tmp_path / "unsafe-out",
            tmp_path / "unsafe-report",
        )


def test_compiler_requires_ten_families_sixty_reviewed_brand_free_shells(tmp_path: Path):
    manifest = source_manifest()
    manifest["families"].pop()
    manifest["shells"] = [
        shell
        for shell in manifest["shells"]
        if shell["family"] != "shops-services"
    ]
    manifest["shells"][0]["classroomReviewed"] = False
    source = tmp_path / "manifest.json"
    write_source(source, manifest)

    with pytest.raises(ProductShellError, match="exactly ten launch families"):
        compile_product_shells(source, tmp_path / "out", tmp_path / "report")


def test_compiler_expands_compact_series_and_renders_distinct_shell_templates(
    tmp_path: Path,
):
    templates = [
        "can",
        "storefront",
        "shoe",
        "tube",
        "device",
        "ball",
        "bottle",
        "luggage",
        "tank",
        "sign",
    ]
    series = []
    for family_index, (family_id, family_title) in enumerate(FAMILIES):
        variants = []
        for variant_index in range(6):
            variants.append(
                {
                    "id": f"{family_id}-{templates[family_index]}-{variant_index + 1:02d}",
                    "title": f"{family_title} Shape {variant_index + 1}",
                    "parameters": {
                        "width": 0.54 + variant_index * 0.035,
                        "height": 0.8 - variant_index * 0.025,
                        "rounding": 0.04 + variant_index * 0.008,
                    },
                }
            )
        series.append(
            {
                "family": family_id,
                "template": templates[family_index],
                "regions": [
                    {"id": "body", "fill": "#E9E5DC"},
                    {"id": "trim", "fill": "#35383C"},
                    {"id": "accent", "fill": "#D9863B"},
                    {"id": "label", "fill": "#F7F3EA"},
                ],
                "printAreas": [
                    {
                        "id": "front",
                        "x": 0.29,
                        "y": 0.28,
                        "width": 0.42,
                        "height": 0.42,
                        "safeInset": 0.035,
                    }
                ],
                "partSlots": [
                    {"id": "feature", "accepts": ["badge", "handle"]}
                ],
                "preview": {
                    "kind": "soft-2.5d",
                    "highlight": 0.16,
                    "shadow": 0.18,
                },
                "classroomReviewed": True,
                "brandFree": True,
                "variants": variants,
            }
        )
    manifest = {
        "schema": "product-shell-source@1",
        "packId": "product-shells-v1",
        "families": [
            {"id": family_id, "title": family_title}
            for family_id, family_title in FAMILIES
        ],
        "series": series,
    }
    source = tmp_path / "series.json"
    write_source(source, manifest)

    result = compile_product_shells(source, tmp_path / "out", tmp_path / "report")

    assert result.shell_count == 60
    can_svg = (
        tmp_path
        / "out"
        / "shells"
        / "drinks-snacks-can-01"
        / "authoring.svg"
    ).read_text("utf-8")
    shoe_svg = (
        tmp_path
        / "out"
        / "shells"
        / "fashion-footwear-shoe-01"
        / "authoring.svg"
    ).read_text("utf-8")
    tank_svg = (
        tmp_path
        / "out"
        / "shells"
        / "pets-animals-tank-01"
        / "authoring.svg"
    ).read_text("utf-8")
    assert 'data-template="can"' in can_svg
    assert "<ellipse" in can_svg
    assert 'data-template="shoe"' in shoe_svg
    assert "<path" in shoe_svg
    assert 'data-template="tank"' in tank_svg
    assert 'data-region="accent"' in tank_svg


def test_compiler_renders_additional_semantic_regions_as_valid_svg(tmp_path: Path):
    manifest = source_manifest()
    manifest["shells"][0]["regions"].append(
        {"id": "detail", "fill": "#B8C8D8"}
    )
    source = tmp_path / "source.json"
    write_source(source, manifest)

    compile_product_shells(source, tmp_path / "out", tmp_path / "report")

    svg = (
        tmp_path
        / "out"
        / "shells"
        / "drinks-snacks-panel-01"
        / "authoring.svg"
    )
    root = ET.parse(svg).getroot()
    detail = root.find(".//*[@data-region='detail']")
    assert detail is not None
    assert any(child.tag.endswith("rect") for child in detail)


def test_launch_manifest_compiles_useful_varied_shells_for_all_families(
    tmp_path: Path,
):
    project_root = Path(__file__).resolve().parents[2]
    source = project_root / "catalog" / "source" / "product-shells-v1" / "manifest.json"

    result = compile_product_shells(source, tmp_path / "out", tmp_path / "report")

    assert result.shell_count >= 60
    catalogue = json.loads((tmp_path / "out" / "catalog.json").read_text("utf-8"))
    titles = [shell["title"] for shell in catalogue["shells"]]
    assert all("Shape" not in title and "Panel" not in title for title in titles)
    assert all(
        any(keyword in title for title in titles)
        for keyword in ["Can", "Takeaway", "Trainer", "Aquarium", "Pet Shop"]
    )
    for family_id, _ in FAMILIES:
        family_shells = [
            shell for shell in catalogue["shells"] if shell["family"] == family_id
        ]
        assert len(family_shells) >= 6
        assert len({shell["template"] for shell in family_shells}) >= 3


def test_compiler_supports_the_launch_shell_template_vocabulary(tmp_path: Path):
    templates = [
        "awning",
        "bag",
        "bowl",
        "box",
        "carton",
        "clock",
        "controller",
        "cup",
        "headphones",
        "jar",
        "jersey",
        "pot",
        "pouch",
        "skateboard",
        "surfboard",
        "vehicle",
        "watch",
    ]
    manifest = source_manifest()
    launch_shells = manifest["shells"][: len(templates)]
    for shell, template in zip(launch_shells, templates, strict=True):
        shell["template"] = template
    source = tmp_path / "source.json"
    write_source(source, manifest)

    compile_product_shells(source, tmp_path / "out", tmp_path / "report")

    for shell, template in zip(launch_shells, templates, strict=True):
        svg = (
            tmp_path / "out" / "shells" / shell["id"] / "authoring.svg"
        ).read_text("utf-8")
        assert f'data-template="{template}"' in svg
        ET.fromstring(svg)
