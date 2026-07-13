from __future__ import annotations

import copy
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Callable, get_args

import pytest
from pydantic import ValidationError

from asset_pipeline.product_shell_audition import (
    Archetype,
    ProductShellAuditionError,
    load_audition_source,
)
from asset_pipeline.product_shell_art import (
    GEOMETRY_BUILDERS,
    artwork_surface_for,
    render_audition_svg,
)
from conftest import REPO_ROOT as PROJECT_ROOT


MANIFEST_PATH = (
    PROJECT_ROOT
    / "catalog"
    / "source"
    / "product-shell-style-audition-v1"
    / "manifest.json"
)

EXPECTED = {
    "slim-can": "flat-skin",
    "sports-bottle": "flat-skin",
    "snack-pouch": "flat-skin",
    "takeaway-box": "flat-skin",
    "hoodie": "direct-surface",
    "trainer": "direct-surface",
    "smartphone": "direct-surface",
    "headphones": "direct-surface",
    "food-truck": "direct-surface",
    "garden-tool": "direct-surface",
    "aquarium": "direct-surface",
    "pet-shop": "direct-surface",
}

EXPECTED_RECORDS = [
    ("audition-slim-can", "Slim Drink Can", "drinks-snacks", "slim-can"),
    (
        "audition-sports-bottle",
        "Sports Drink Bottle",
        "drinks-snacks",
        "sports-bottle",
    ),
    ("audition-snack-pouch", "Snack Pouch", "drinks-snacks", "snack-pouch"),
    (
        "audition-takeaway-box",
        "Takeaway Box",
        "fast-food-hospitality",
        "takeaway-box",
    ),
    ("audition-hoodie", "Hoodie", "fashion-footwear", "hoodie"),
    ("audition-trainer", "Trainer", "fashion-footwear", "trainer"),
    ("audition-smartphone", "Smartphone", "tech-gadgets", "smartphone"),
    ("audition-headphones", "Headphones", "tech-gadgets", "headphones"),
    (
        "audition-food-truck",
        "Food Truck",
        "fast-food-hospitality",
        "food-truck",
    ),
    (
        "audition-garden-tool",
        "Garden Tool",
        "sport-outdoors",
        "garden-tool",
    ),
    ("audition-aquarium", "Aquarium", "pets-animals", "aquarium"),
    ("audition-pet-shop", "Pet Shop", "shops-services", "pet-shop"),
]

ALLOWED_REGIONS = {
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


def _manifest() -> dict:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def _write_manifest(tmp_path: Path, value: dict) -> Path:
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(value), encoding="utf-8")
    return path


def _assert_rejected(tmp_path: Path, value: dict) -> None:
    with pytest.raises((ProductShellAuditionError, ValidationError)):
        load_audition_source(_write_manifest(tmp_path, value))


def test_real_audition_manifest_has_twelve_diverse_brand_free_prototypes() -> None:
    source = load_audition_source(MANIFEST_PATH)

    assert {item.archetype: item.authoring_mode for item in source.prototypes} == EXPECTED
    assert [
        (item.id, item.title, item.family, item.archetype)
        for item in source.prototypes
    ] == EXPECTED_RECORDS
    assert len({item.id for item in source.prototypes}) == 12
    assert all(item.brand_free for item in source.prototypes)
    assert all(item.status == "audition" for item in source.prototypes)
    assert all(item.classroom_reviewed is False for item in source.prototypes)
    assert all(3 <= len(item.regions) <= 4 for item in source.prototypes)
    assert all(
        region.id in ALLOWED_REGIONS
        for item in source.prototypes
        for region in item.regions
    )


def test_audition_manifest_rejects_duplicate_prototype_ids(tmp_path: Path) -> None:
    candidate = _manifest()
    candidate["prototypes"][1]["id"] = candidate["prototypes"][0]["id"]

    with pytest.raises(ProductShellAuditionError, match="prototype IDs must be unique"):
        load_audition_source(_write_manifest(tmp_path, candidate))


@pytest.mark.parametrize(
    "mutate",
    [
        lambda value: value["prototypes"][0].update({"archetype": "unknown-shell"}),
        lambda value: value["prototypes"].append(copy.deepcopy(value["prototypes"][0])),
        lambda value: value["prototypes"].pop(),
    ],
    ids=["unknown-archetype", "extra-prototype", "missing-prototype"],
)
def test_audition_manifest_rejects_unknown_extra_or_missing_prototypes(
    tmp_path: Path, mutate: Callable[[dict], object]
) -> None:
    candidate = _manifest()
    mutate(candidate)

    _assert_rejected(tmp_path, candidate)


def test_audition_manifest_rejects_non_hex_region_colours(tmp_path: Path) -> None:
    candidate = _manifest()
    candidate["prototypes"][0]["regions"][0]["fill"] = "rgb(244, 241, 234)"

    _assert_rejected(tmp_path, candidate)


def test_audition_manifest_rejects_non_portable_ids(tmp_path: Path) -> None:
    candidate = _manifest()
    candidate["prototypes"][0]["id"] = "Audition Slim Can"

    _assert_rejected(tmp_path, candidate)


def test_audition_manifest_rejects_non_local_content(tmp_path: Path) -> None:
    candidate = _manifest()
    candidate["prototypes"][0]["sourceUrl"] = "https://example.test/shell.svg"

    _assert_rejected(tmp_path, candidate)


def test_audition_manifest_rejects_classroom_reviewed_true(tmp_path: Path) -> None:
    candidate = _manifest()
    candidate["prototypes"][0]["classroomReviewed"] = True

    _assert_rejected(tmp_path, candidate)


@pytest.mark.parametrize("view", ["authoring", "preview", "review"])
def test_all_audition_views_are_safe_parseable_semantic_svg(view: str) -> None:
    for prototype in load_audition_source(MANIFEST_PATH).prototypes:
        svg = render_audition_svg(prototype, view=view)
        root = ET.fromstring(svg)

        assert root.get("viewBox") == "0 0 1000 1000"
        assert root.get("data-shell-id") == prototype.id
        assert root.findall(".//*[@data-region]")

        lowered = svg.lower()
        forbidden = (
            "<text",
            "<image",
            "<script",
            " href=",
            "xlink:href",
            " onload=",
        )
        assert not any(token in lowered for token in forbidden)
        assert "<lineargradient" not in lowered
        assert "<radialgradient" not in lowered
        assert "vector-effect" not in lowered


def test_audition_views_use_the_exact_cel_shaded_style_and_guide_contract() -> None:
    for prototype in load_audition_source(MANIFEST_PATH).prototypes:
        authoring = render_audition_svg(prototype, view="authoring")
        preview = render_audition_svg(prototype, view="preview")
        review = render_audition_svg(prototype, view="review")

        assert 'stroke="#34414D"' in preview
        assert 'stroke-width="6"' in preview
        assert 'data-tone="shadow"' in preview
        assert 'data-tone="highlight"' in preview
        assert 'data-guide-overlay' not in preview
        assert 'data-print-area' not in preview
        assert 'data-guide-overlay="true" visibility="hidden"' in authoring
        assert 'data-guide-overlay="true" visibility="visible"' in review
        assert 'data-guide-overlay="true" visibility="visible" opacity="0.42"' in review
        assert "stroke-dasharray" not in authoring + preview + review
        assert 'data-artwork-surface="primary"' in authoring
        assert 'clip-path="url(#' in preview


def test_artwork_slots_use_prototype_prefixed_exact_clip_paths() -> None:
    for prototype in load_audition_source(MANIFEST_PATH).prototypes:
        root = ET.fromstring(render_audition_svg(prototype, view="preview"))
        clips = [
            element
            for element in root.iter()
            if element.tag.rsplit("}", 1)[-1] == "clipPath"
        ]
        assert len(clips) == 1
        clip_id = clips[0].get("id")
        assert clip_id is not None
        assert clip_id.startswith(f"{prototype.id}-")
        assert clips[0].find("./{*}path[@data-artwork-surface='primary']") is not None

        slots = [
            element
            for element in root.iter()
            if element.get("data-artwork-slot") == "primary"
        ]
        assert len(slots) == 1
        assert slots[0].get("clip-path") == f"url(#{clip_id})"


def test_authoring_surfaces_obey_flat_skin_and_direct_surface_modes() -> None:
    for prototype in load_audition_source(MANIFEST_PATH).prototypes:
        geometry = GEOMETRY_BUILDERS[prototype.archetype]()
        surface = artwork_surface_for(prototype.archetype)
        authoring = ET.fromstring(render_audition_svg(prototype, view="authoring"))
        surfaces = [
            element
            for element in authoring.iter()
            if element.get("data-artwork-surface") == "primary"
        ]
        assert surfaces

        if prototype.authoring_mode == "flat-skin":
            assert authoring.get("data-authoring-mode") == "flat-skin"
            width = float(surfaces[0].get("data-surface-width", "0"))
            height = float(surfaces[0].get("data-surface-height", "0"))
            assert width >= 680
            assert height >= 560
        else:
            assert authoring.get("data-authoring-mode") == "direct-surface"
            px, py, pw, ph = geometry.product_bounds
            sx, sy, sw, sh = surface.bounds
            assert px <= sx <= sx + sw <= px + pw
            assert py <= sy <= sy + sh <= py + ph


def test_editable_face_bounds_clear_family_coverage_floors() -> None:
    coverage_floors = {
        "slim-can": 0.70,
        "sports-bottle": 0.70,
        "snack-pouch": 0.70,
        "takeaway-box": 0.70,
        "hoodie": 0.55,
        "trainer": 0.55,
        "smartphone": 0.55,
        "headphones": 0.55,
        "food-truck": 0.35,
        "garden-tool": 0.35,
        "aquarium": 0.35,
        "pet-shop": 0.35,
    }

    assert set(GEOMETRY_BUILDERS) == set(get_args(Archetype))
    for archetype, floor in coverage_floors.items():
        geometry = GEOMETRY_BUILDERS[archetype]()
        _, _, product_width, product_height = geometry.product_bounds
        _, _, surface_width, surface_height = geometry.surface.bounds
        coverage = (surface_width * surface_height) / (
            product_width * product_height
        )
        assert coverage >= floor, f"{archetype} coverage {coverage:.1%} < {floor:.0%}"


def test_preview_and_authoring_keep_manifest_region_order() -> None:
    for prototype in load_audition_source(MANIFEST_PATH).prototypes:
        expected = [region.id for region in prototype.regions]
        ordered_views: list[list[str]] = []

        for view in ("authoring", "preview"):
            root = ET.fromstring(render_audition_svg(prototype, view=view))
            ordered_views.append(
                [
                    element.get("data-region", "")
                    for element in root.iter()
                    if element.get("data-region") is not None
                ]
            )

        assert ordered_views == [expected, expected]


def test_garden_tool_declares_a_recognisable_angled_hoe_head() -> None:
    prototype = next(
        item
        for item in load_audition_source(MANIFEST_PATH).prototypes
        if item.archetype == "garden-tool"
    )
    root = ET.fromstring(render_audition_svg(prototype, view="preview"))

    assert root.find(".//*[@data-product-part='angled-hoe-head']") is not None
