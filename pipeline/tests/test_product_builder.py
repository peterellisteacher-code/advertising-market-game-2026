from __future__ import annotations

import copy
import importlib
import json
from pathlib import Path
from typing import Any

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

