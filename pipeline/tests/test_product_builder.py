from __future__ import annotations

import copy
import importlib
import json
from pathlib import Path
import re
from typing import Any
from xml.etree import ElementTree

import pytest
from pydantic import ValidationError


PROJECT_ROOT = Path(__file__).resolve().parents[2]
SOURCE_PATH = (
    PROJECT_ROOT
    / "catalog"
    / "source"
    / "product-builder-pilot-v1"
    / "manifest.json"
)
EXPECTED_BODY_TITLES = {
    "Backpack",
    "Burger Box",
    "Carry Bag",
    "Classic Can",
    "Meal Box",
    "Noodle Tub",
    "Slim Can",
    "Snack Pouch",
    "Sports Bottle",
    "Takeaway Cup",
    "Tote",
    "Weekender",
}
EXPECTED_MATERIAL_IDS = {
    "brushed-metal",
    "cardboard",
    "fabric",
    "glass",
    "gloss-plastic",
    "matte-plastic",
    "rubber",
    "wood",
}


def builder_module():
    try:
        return importlib.import_module("asset_pipeline.product_builder")
    except ModuleNotFoundError:
        pytest.fail("asset_pipeline.product_builder has not been implemented")


def source_dict() -> dict[str, Any]:
    assert SOURCE_PATH.is_file(), "the pilot source manifest has not been created"
    return json.loads(SOURCE_PATH.read_text(encoding="utf-8"))


def parse_source(raw: dict[str, Any] | None = None):
    module = builder_module()
    return module.parse_product_builder_source(source_dict() if raw is None else raw)


def reverse_mapping_keys(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: reverse_mapping_keys(value[key])
            for key in reversed(tuple(value.keys()))
        }
    if isinstance(value, list):
        return [reverse_mapping_keys(item) for item in value]
    return value


def svg_root(svg: str) -> ElementTree.Element:
    return ElementTree.fromstring(svg)


def assert_passive_safe_svg(svg: str) -> None:
    lowered = svg.casefold().replace('xmlns="http://www.w3.org/2000/svg"', "")
    for forbidden in (
        "<script",
        "<image",
        "<text",
        "<foreignobject",
        "javascript:",
        "data:",
        "http://",
        "https://",
        "xlink:href",
        " logo",
        " price",
    ):
        assert forbidden not in lowered
    assert re.search(r'url\((?!#[a-z0-9-]+\))', lowered) is None


def test_manifest_defines_the_fixed_three_family_twelve_body_contract():
    module = builder_module()
    source = module.load_product_builder_source(SOURCE_PATH)

    assert source.schema_id == "product-builder-source@1"
    assert source.pack_id == "product-builder-pilot-v1"
    assert len(source.families) == 3
    assert {family.id for family in source.families} == {
        "bags",
        "drinkware",
        "food-packaging",
    }
    assert len(source.bodies) == 12
    assert {body.title for body in source.bodies} == EXPECTED_BODY_TITLES
    assert all(
        sum(body.family_id == family.id for body in source.bodies) == 4
        for family in source.families
    )
    assert module.virtual_variant_count(source) == 6_144
    assert source.virtual_count == 6_144


def test_each_body_has_four_compatible_registered_parts_and_normalized_surfaces():
    module = builder_module()
    source = parse_source()
    parts_by_family = {
        family.id: {part.id for part in source.parts if part.family_id == family.id}
        for family in source.families
    }

    assert len(source.parts) == 12
    assert all(len(parts) == 4 for parts in parts_by_family.values())
    for body in source.bodies:
        assert len(body.compatible_part_ids) == 4
        assert set(body.compatible_part_ids) == parts_by_family[body.family_id]
        assert body.geometry_id in module.REGISTERED_BODY_GEOMETRY_IDS
        assert 0.0 <= body.component_anchor.x <= 1.0
        assert 0.0 <= body.component_anchor.y <= 1.0
        bounds = body.artwork_bounds
        assert 0.0 <= bounds.x < 1.0
        assert 0.0 <= bounds.y < 1.0
        assert 0.0 < bounds.width <= 1.0
        assert 0.0 < bounds.height <= 1.0
        assert bounds.x + bounds.width <= 1.0
        assert bounds.y + bounds.height <= 1.0
        for part_id in body.compatible_part_ids:
            part = next(part for part in source.parts if part.id == part_id)
            assert part.slot_id == body.component_slot_id

    assert all(
        part.geometry_id in module.REGISTERED_COMPONENT_GEOMETRY_IDS
        for part in source.parts
    )


def test_parser_rejects_same_family_body_geometry_swap():
    raw = source_dict()
    first, second = raw["bodies"][0], raw["bodies"][1]
    first["geometryId"], second["geometryId"] = (
        second["geometryId"],
        first["geometryId"],
    )

    with pytest.raises(
        ValueError,
        match="body ID must use its registered family, geometry and slot",
    ):
        parse_source(raw)


def test_parser_rejects_same_family_part_geometry_swap():
    raw = source_dict()
    first, second = raw["parts"][0], raw["parts"][1]
    first["geometryId"], second["geometryId"] = (
        second["geometryId"],
        first["geometryId"],
    )

    with pytest.raises(
        ValueError,
        match="part ID must use its registered family, geometry and slot",
    ):
        parse_source(raw)


def test_manifest_defines_sixteen_complete_four_zone_palettes():
    source = parse_source()

    assert len(source.palettes) == 16
    assert len({palette.id for palette in source.palettes}) == 16
    for palette in source.palettes:
        assert set(palette.colours.model_dump()) == {
            "body",
            "trim",
            "accent",
            "label",
        }
        assert all(
            value.startswith("#") and len(value) == 7
            for value in palette.colours.model_dump().values()
        )


def test_parser_rejects_duplicate_four_colour_palette_tuple():
    raw = source_dict()
    raw["palettes"][1]["colours"] = copy.deepcopy(
        raw["palettes"][0]["colours"]
    )

    with pytest.raises(ValueError, match="palette colour combinations must be unique"):
        parse_source(raw)


def test_manifest_uses_exactly_the_existing_eight_material_ids():
    source = parse_source()

    assert len(source.materials) == 8
    assert {material.id for material in source.materials} == EXPECTED_MATERIAL_IDS


@pytest.mark.parametrize(
    ("case", "mutate"),
    [
        ("path traversal", lambda raw: raw.__setitem__("packId", "../escape")),
        (
            "raw HTML",
            lambda raw: raw["bodies"][0].__setitem__(
                "title", "<script>alert(1)</script>"
            ),
        ),
        (
            "external URL",
            lambda raw: raw["parts"][0].__setitem__(
                "title", "https://example.test/part"
            ),
        ),
        (
            "data URL",
            lambda raw: raw["palettes"][0].__setitem__(
                "title", "data:image/svg+xml;base64,PHN2Zz4="
            ),
        ),
        (
            "arbitrary body SVG",
            lambda raw: raw["bodies"][0].__setitem__(
                "geometryId", "<svg-onload-alert>"
            ),
        ),
        (
            "arbitrary component path",
            lambda raw: raw["parts"][0].__setitem__(
                "geometryId", "M0 0L1 1"
            ),
        ),
        (
            "raw SVG field",
            lambda raw: raw["parts"][0].__setitem__("rawSvg", "<svg/>")
        ),
        (
            "external URL field",
            lambda raw: raw["bodies"][0].__setitem__(
                "sourceUrl", "https://example.test/body.svg"
            ),
        ),
    ],
)
def test_parser_rejects_executable_or_external_manifest_content(case: str, mutate):
    raw = source_dict()
    mutate(raw)

    with pytest.raises((ValidationError, ValueError), match=".+"):
        parse_source(raw)


@pytest.mark.parametrize(
    "url_like_title",
    (
        "www.example.com",
        "example.dev",
        "example.xyz",
        "example.info",
        "192.168.1.1",
    ),
)
def test_parser_rejects_url_like_title_without_a_scheme(url_like_title: str):
    raw = source_dict()
    raw["bodies"][0]["title"] = url_like_title

    with pytest.raises(ValueError, match="without markup or URLs"):
        parse_source(raw)


@pytest.mark.parametrize(
    "mutate",
    [
        lambda raw: raw["families"].pop(),
        lambda raw: raw["bodies"].pop(),
        lambda raw: raw["bodies"][0].__setitem__(
            "compatiblePartIds", raw["bodies"][0]["compatiblePartIds"][:3]
        ),
        lambda raw: raw["palettes"].pop(),
        lambda raw: raw["materials"].pop(),
        lambda raw: raw["materials"][0].__setitem__("id", "polished-stone"),
        lambda raw: raw["bodies"][0].__setitem__("familyId", "unknown-family"),
        lambda raw: raw["bodies"][0].__setitem__(
            "compatiblePartIds",
            [
                *raw["bodies"][0]["compatiblePartIds"][:3],
                "unknown-part",
            ],
        ),
    ],
)
def test_parser_rejects_count_or_reference_drift(mutate):
    raw = copy.deepcopy(source_dict())
    mutate(raw)

    with pytest.raises((ValidationError, ValueError), match=".+"):
        parse_source(raw)


def test_models_are_frozen_and_collection_values_are_immutable():
    source = parse_source()

    assert isinstance(source.families, tuple)
    assert isinstance(source.bodies, tuple)
    assert isinstance(source.bodies[0].compatible_part_ids, tuple)
    with pytest.raises(ValidationError, match="frozen"):
        source.pack_id = "replacement-pack"
    with pytest.raises(AttributeError):
        source.bodies.append(source.bodies[0])


def test_canonical_source_json_is_stable_compact_utf8_with_one_final_lf():
    module = builder_module()
    raw = source_dict()
    first = parse_source(raw)
    second = parse_source(reverse_mapping_keys(raw))

    first_bytes = module.canonical_product_builder_json(first)
    second_bytes = module.canonical_product_builder_json(second)
    assert first_bytes == second_bytes
    assert first_bytes.endswith(b"\n") and not first_bytes.endswith(b"\n\n")
    assert b"\r" not in first_bytes
    assert b": " not in first_bytes and b", " not in first_bytes
    assert json.loads(first_bytes) == json.loads(second_bytes)


def test_trusted_geometry_registries_cover_every_manifest_identity():
    module = builder_module()
    source = parse_source()

    assert set(module.BODY_GEOMETRIES) == {
        body.geometry_id for body in source.bodies
    }
    assert set(module.COMPONENT_GEOMETRIES) == {
        part.geometry_id for part in source.parts
    }
    assert all(
        module.BODY_GEOMETRIES[body.geometry_id].family_id == body.family_id
        for body in source.bodies
    )
    assert all(
        module.COMPONENT_GEOMETRIES[part.geometry_id].family_id == part.family_id
        for part in source.parts
    )


def test_authoring_svgs_are_deterministic_safe_and_follow_the_required_layer_order():
    module = builder_module()
    source = parse_source()
    default_palette = source.palettes[0]
    default_material = source.materials[0]

    for body in source.bodies:
        first = module.render_body_authoring_svg(source, body.id)
        second = module.render_body_authoring_svg(source, body.id)
        assert first == second
        assert first.endswith("\n") and not first.endswith("\n\n")
        assert_passive_safe_svg(first)
        root = svg_root(first)
        assert root.attrib["data-body-id"] == body.id
        assert root.attrib["data-family-id"] == body.family_id
        assert root.attrib["data-geometry-id"] == body.geometry_id
        assert root.attrib["data-palette-id"] == default_palette.id
        assert root.attrib["data-material-id"] == default_material.id
        assert root.attrib["data-component-slot-id"] == body.component_slot_id
        assert root.attrib["data-artwork-bounds"] == " ".join(
            f"{value:g}"
            for value in (
                body.artwork_bounds.x,
                body.artwork_bounds.y,
                body.artwork_bounds.width,
                body.artwork_bounds.height,
            )
        )
        layers = [
            child.attrib["data-layer"]
            for child in root
            if "data-layer" in child.attrib
        ]
        assert layers == [
            "base-shell",
            "artwork-slot",
            "tone-detail",
            "editor-guides",
        ]
        artwork = next(
            child for child in root if child.attrib.get("data-layer") == "artwork-slot"
        )
        assert artwork.attrib["data-artwork-slot"] == "primary"
        assert artwork.attrib["clip-path"].startswith("url(#")
        guides = next(
            child for child in root if child.attrib.get("data-layer") == "editor-guides"
        )
        assert guides.attrib == {
            "data-layer": "editor-guides",
            "data-editor-only": "true",
            "data-export": "false",
        }


def test_preview_svgs_keep_structure_above_artwork_and_omit_editor_guides():
    module = builder_module()
    source = parse_source()

    for body in source.bodies:
        svg = module.render_body_preview_svg(source, body.id)
        assert_passive_safe_svg(svg)
        root = svg_root(svg)
        assert root.attrib["data-view"] == "preview"
        layers = [
            child.attrib["data-layer"]
            for child in root
            if "data-layer" in child.attrib
        ]
        assert layers == [
            "preview-grounding",
            "base-shell",
            "artwork-slot",
            "tone-detail",
        ]
        assert "data-editor-only" not in svg
        assert "editor-guides" not in svg
        assert layers.index("artwork-slot") < layers.index("tone-detail")


def test_component_fragments_declare_identity_slot_and_normalized_bounds():
    module = builder_module()
    source = parse_source()

    for part in source.parts:
        svg = module.render_component_svg(source, part.id)
        assert svg == module.render_component_svg(source, part.id)
        assert_passive_safe_svg(svg)
        root = svg_root(svg)
        assert root.attrib["viewBox"] == "0 0 1 1"
        assert root.attrib["data-part-id"] == part.id
        assert root.attrib["data-family-id"] == part.family_id
        assert root.attrib["data-slot-id"] == part.slot_id
        assert root.attrib["data-geometry-id"] == part.geometry_id
        bounds = tuple(float(value) for value in root.attrib["data-bounds"].split())
        assert len(bounds) == 4
        x, y, width, height = bounds
        assert 0.0 <= x < 1.0
        assert 0.0 <= y < 1.0
        assert 0.0 < width <= 1.0
        assert 0.0 < height <= 1.0
        assert x + width <= 1.0
        assert y + height <= 1.0
        layers = [
            child.attrib["data-layer"]
            for child in root
            if "data-layer" in child.attrib
        ]
        assert layers == ["component-structure"]


@pytest.mark.parametrize(
    ("renderer", "unknown_id"),
    [
        ("render_body_authoring_svg", "unknown-body"),
        ("render_body_preview_svg", "unknown-body"),
        ("render_component_svg", "unknown-part"),
    ],
)
def test_renderers_fail_closed_for_unknown_catalogue_id(renderer: str, unknown_id: str):
    module = builder_module()

    with pytest.raises(module.ProductBuilderRenderError, match="unknown"):
        getattr(module, renderer)(parse_source(), unknown_id)


def test_pack_plan_is_compact_and_shares_palette_and_material_definitions(tmp_path: Path):
    module = builder_module()
    source = parse_source()
    target = tmp_path / "pilot"

    plan = module.plan_product_builder_pack(source, target)
    files = {output.relative_path: output.payload for output in plan.files}

    assert plan.output_dir == target
    assert len(files) == 39
    assert len([path for path in files if path.endswith("/authoring.svg")]) == 12
    assert len([path for path in files if path.endswith("/preview.svg")]) == 12
    assert len([path for path in files if path.startswith("components/")]) == 12
    assert set(files) >= {"catalogue.json", "source.json", "qa.json"}
    catalogue = json.loads(files["catalogue.json"])
    assert set(catalogue) == {
        "schema",
        "version",
        "packId",
        "virtualCount",
        "families",
        "bodies",
        "parts",
        "palettes",
        "materials",
    }
    assert catalogue["schema"] == "product-builder-catalogue@1"
    assert catalogue["version"] == 1
    assert catalogue["packId"] == source.pack_id
    assert catalogue["virtualCount"] == 6_144
    assert len(catalogue["bodies"]) == 12
    assert len(catalogue["parts"]) == 12
    assert len(catalogue["palettes"]) == 16
    assert len(catalogue["materials"]) == 8
    assert "variants" not in catalogue
    assert not any("palette" in body for body in catalogue["bodies"])
    assert not any("material" in body for body in catalogue["bodies"])
    assert [record["id"] for record in catalogue["families"]] == sorted(
        record["id"] for record in catalogue["families"]
    )
    assert [record["id"] for record in catalogue["bodies"]] == sorted(
        record["id"] for record in catalogue["bodies"]
    )
    assert [record["id"] for record in catalogue["parts"]] == sorted(
        record["id"] for record in catalogue["parts"]
    )
    assert [record["id"] for record in catalogue["palettes"]] == sorted(
        record["id"] for record in catalogue["palettes"]
    )
    assert [record["id"] for record in catalogue["materials"]] == sorted(
        record["id"] for record in catalogue["materials"]
    )
    for body in catalogue["bodies"]:
        assert set(body) == {
            "id",
            "title",
            "familyId",
            "geometryId",
            "componentSlotId",
            "componentAnchor",
            "artworkBounds",
            "compatiblePartIds",
            "authoringSvg",
            "previewSvg",
        }
        assert body["authoringSvg"] == f"bodies/{body['id']}/authoring.svg"
        assert body["previewSvg"] == f"bodies/{body['id']}/preview.svg"
        assert body["authoringSvg"] in files
        assert body["previewSvg"] in files
    for part in catalogue["parts"]:
        assert set(part) == {
            "id",
            "title",
            "familyId",
            "slotId",
            "geometryId",
            "componentSvg",
        }
        assert part["componentSvg"] == f"components/{part['id']}.svg"
        assert part["componentSvg"] in files
    qa = json.loads(files["qa.json"])
    assert qa["fileCount"] == 39
    assert qa["renderedSvgCount"] == 36
    assert len(qa["sha256"]) == 38
    assert target.exists() is False


@pytest.mark.parametrize(
    "existing_kind", ("empty-directory", "file", "nonempty-directory")
)
def test_pack_plan_and_writer_fail_closed_when_target_already_exists(
    tmp_path: Path, existing_kind: str
):
    module = builder_module()
    source = parse_source()
    target = tmp_path / "pilot"
    if existing_kind == "file":
        target.write_text("occupied", encoding="utf-8")
    else:
        target.mkdir()
        if existing_kind == "nonempty-directory":
            (target / "keep.txt").write_text("keep", encoding="utf-8")

    with pytest.raises(module.ProductBuilderRenderError, match="must not exist"):
        module.plan_product_builder_pack(source, target)
    with pytest.raises(module.ProductBuilderRenderError, match="must not exist"):
        module.write_product_builder_pack(source, target)


def test_writer_emits_the_exact_planned_pack_once(tmp_path: Path):
    module = builder_module()
    source = parse_source()
    target = tmp_path / "pilot"
    plan = module.plan_product_builder_pack(source, target)

    result = module.write_product_builder_pack(source, target)

    assert result.output_dir == target
    assert result.file_count == 39
    actual = {
        path.relative_to(target).as_posix(): path.read_bytes()
        for path in target.rglob("*")
        if path.is_file()
    }
    assert actual == {
        output.relative_path: output.payload for output in plan.files
    }
    with pytest.raises(module.ProductBuilderRenderError, match="must not exist"):
        module.write_product_builder_pack(source, target)
