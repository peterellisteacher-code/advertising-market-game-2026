from __future__ import annotations

import copy
import hashlib
import json
import xml.etree.ElementTree as ET
from dataclasses import FrozenInstanceError, is_dataclass
from pathlib import Path
from typing import Callable, get_args

import pytest
from pydantic import ValidationError

import asset_pipeline.product_shell_audition as audition_module
from asset_pipeline.product_shell_audition import (
    Archetype,
    ProductShellAuditionError,
    load_audition_source,
)
from asset_pipeline.product_shell_art import (
    DETAIL_INK,
    DETAIL_STROKE,
    GEOMETRY_BUILDERS,
    GUIDE,
    artwork_surface_for,
    flat_skin_geometry_for,
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
        "Garden Watering Can",
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


def _prototype(archetype: str):
    return next(
        item
        for item in load_audition_source(MANIFEST_PATH).prototypes
        if item.archetype == archetype
    )


def _write_manifest(tmp_path: Path, value: dict) -> Path:
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(value), encoding="utf-8")
    return path


def _assert_rejected(tmp_path: Path, value: dict) -> None:
    with pytest.raises((ProductShellAuditionError, ValidationError)):
        load_audition_source(_write_manifest(tmp_path, value))


def _tree_bytes(root: Path) -> dict[str, bytes]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def _assert_canonical_json(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    expected = (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        + "\n"
    ).encode("utf-8")
    assert path.read_bytes() == expected
    return value


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

        text_nodes = root.findall(".//{*}text")
        orientation_guides = root.findall(
            ".//*[@data-panel-orientation-guides='true']"
        )
        if view == "review" and prototype.archetype == "takeaway-box":
            assert len(orientation_guides) == 1
            assert text_nodes == orientation_guides[0].findall(".//{*}text")
        else:
            assert text_nodes == []
            assert orientation_guides == []


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
        assert 'data-guide-overlay="true"' in authoring
        assert 'visibility="hidden"' in authoring
        assert 'data-guide-overlay="true"' in review
        assert 'visibility="visible"' in review
        assert "stroke-dasharray" not in authoring + preview + review
        assert 'data-artwork-surface="primary"' in authoring
        assert 'clip-path="url(#' in preview


def test_review_selection_uses_high_contrast_exact_surface_outline() -> None:
    for prototype in load_audition_source(MANIFEST_PATH).prototypes:
        authoring = ET.fromstring(render_audition_svg(prototype, view="authoring"))
        preview = ET.fromstring(render_audition_svg(prototype, view="preview"))
        review = ET.fromstring(render_audition_svg(prototype, view="review"))

        review_guides = review.findall(".//*[@data-guide-overlay='true']")
        assert len(review_guides) == 1
        assert review_guides[0].get("visibility") == "visible"
        assert review_guides[0].get("opacity") is None
        assert review_guides[0].get("data-editor-only") == "true"
        assert review_guides[0].get("data-export") == "false"

        outlines = review.findall(".//*[@data-selection-outline='primary']")
        assert len(outlines) == 1
        artwork_surface = review.find(".//*[@data-artwork-surface='primary']")
        assert artwork_surface is not None
        assert outlines[0].get("d") == artwork_surface.get("d")
        assert outlines[0].get("stroke") == GUIDE
        assert float(outlines[0].get("stroke-width", "0")) >= 5

        tint = review.find(".//*[@data-print-area='primary']")
        assert tint is not None
        assert 0.12 <= float(tint.get("fill-opacity", "0")) <= 0.18
        corners = review.find(".//*[@data-corner-guides='true']")
        assert corners is not None
        assert float(corners.get("stroke-width", "0")) >= 5

        authoring_guides = authoring.find(".//*[@data-guide-overlay='true']")
        assert authoring_guides is not None
        assert authoring_guides.get("visibility") == "hidden"
        assert preview.find(".//*[@data-guide-overlay='true']") is None
        assert preview.find(".//*[@data-print-area='primary']") is None
        assert preview.find(".//*[@data-selection-outline='primary']") is None

        combined = "".join(
            render_audition_svg(prototype, view=view)
            for view in ("authoring", "preview", "review")
        )
        assert "stroke-dasharray" not in combined


def test_selection_chrome_keeps_three_to_one_contrast_across_shell_palette() -> None:
    def relative_luminance(hex_colour: str) -> float:
        channels = [int(hex_colour[index : index + 2], 16) / 255 for index in (1, 3, 5)]
        linear = [
            channel / 12.92
            if channel <= 0.04045
            else ((channel + 0.055) / 1.055) ** 2.4
            for channel in channels
        ]
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]

    guide_luminance = relative_luminance(GUIDE)
    shell_colours = ("#F4F1EA", "#FAF8F3", "#FFFFFF", "#A8B8C4", "#E9C8B8")

    for shell_colour in shell_colours:
        shell_luminance = relative_luminance(shell_colour)
        contrast = (max(guide_luminance, shell_luminance) + 0.05) / (
            min(guide_luminance, shell_luminance) + 0.05
        )
        assert contrast >= 3.0, f"{GUIDE} has only {contrast:.2f}:1 against {shell_colour}"


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


def test_packaging_uses_four_distinct_product_specific_flat_skins() -> None:
    archetypes = ("slim-can", "sports-bottle", "snack-pouch", "takeaway-box")
    skins = [flat_skin_geometry_for(item) for item in archetypes]
    assert len({skin.surface.path for skin in skins}) == 4
    assert {skin.mapping_target for skin in skins} == set(archetypes)
    assert all(skin.surface.bounds[2] >= 680 for skin in skins)
    assert all(skin.surface.bounds[3] >= 560 for skin in skins)


@pytest.mark.parametrize(
    ("archetype", "markers"),
    [
        ("slim-can", {"wrap-seam", "can-rim"}),
        ("sports-bottle", {"bottle-shoulder", "wrap-seam"}),
        ("snack-pouch", {"pouch-seal", "pouch-gusset"}),
        ("takeaway-box", {"box-fold", "box-flap"}),
    ],
)
def test_flat_skin_review_explains_its_product_mapping(
    archetype: str, markers: set[str]
) -> None:
    root = ET.fromstring(render_audition_svg(_prototype(archetype), "review"))
    shell = root.find(".//*[@data-product-shell='flat-skin']")
    assert shell is not None
    assert shell.get("data-mapping-target") == archetype
    actual = {
        item.get("data-mapping-part")
        for item in root.findall(".//*[@data-mapping-part]")
    }
    assert markers <= actual


def test_takeaway_box_declares_immutable_panel_roles_and_other_skins_do_not() -> None:
    box_skin = flat_skin_geometry_for("takeaway-box")
    roles = box_skin.panel_roles

    assert isinstance(roles, tuple)
    assert [(role.role, role.label) for role in roles] == [
        ("front", "Front"),
        ("lid-top", "Lid / Top"),
        ("side", "Side"),
    ]
    assert all(is_dataclass(role) for role in roles)
    assert all(type(role).__dataclass_params__.frozen for role in roles)
    assert all(len(role.bounds) == 4 for role in roles)
    assert all(role.bounds[2] > 0 and role.bounds[3] > 0 for role in roles)
    assert all(role.top_direction in {"up", "right", "down", "left"} for role in roles)
    with pytest.raises(FrozenInstanceError):
        roles[0].label = "Changed"

    for archetype in ("slim-can", "sports-bottle", "snack-pouch"):
        assert flat_skin_geometry_for(archetype).panel_roles == ()


def test_takeaway_box_orientation_metadata_is_editor_only_and_export_isolated() -> None:
    prototype = _prototype("takeaway-box")
    skin = flat_skin_geometry_for("takeaway-box")
    declared_roles = {role.role for role in skin.panel_roles}
    declared_labels = {role.label for role in skin.panel_roles}

    authoring = ET.fromstring(render_audition_svg(prototype, "authoring"))
    authoring_metadata = authoring.findall(
        ".//*[@data-panel-role-metadata='true']"
    )
    assert len(authoring_metadata) == 1
    assert authoring_metadata[0].get("visibility") == "hidden"
    assert authoring_metadata[0].get("data-editor-only") == "true"
    assert authoring_metadata[0].get("data-export") == "false"
    authoring_roles = authoring_metadata[0].findall(".//*[@data-panel-role]")
    assert {item.get("data-panel-role") for item in authoring_roles} == declared_roles
    assert {item.get("data-panel-label") for item in authoring_roles} == declared_labels
    assert all(item.get("data-panel-bounds") for item in authoring_roles)
    assert all(item.get("data-top-direction") for item in authoring_roles)
    assert authoring.findall(".//{*}text") == []

    review = ET.fromstring(render_audition_svg(prototype, "review"))
    review_guides = review.findall(
        ".//*[@data-panel-orientation-guides='true']"
    )
    assert len(review_guides) == 1
    guide = review_guides[0]
    assert guide.get("visibility") == "visible"
    assert guide.get("data-editor-only") == "true"
    assert guide.get("data-export") == "false"
    review_roles = guide.findall(".//*[@data-panel-role]")
    assert {item.get("data-panel-role") for item in review_roles} == declared_roles
    text_nodes = review.findall(".//{*}text")
    assert text_nodes == guide.findall(".//{*}text")
    assert {item.text for item in text_nodes} == declared_labels
    assert all(item.get("data-top-direction") for item in review_roles)

    preview_svg = render_audition_svg(prototype, "preview")
    preview = ET.fromstring(preview_svg)
    assert preview.find(".//*[@data-panel-role-metadata]") is None
    assert preview.find(".//*[@data-panel-orientation-guides]") is None
    assert preview.find(".//*[@data-panel-role]") is None
    assert preview.find(".//*[@data-top-direction]") is None
    assert preview.findall(".//{*}text") == []
    assert "Front" not in preview_svg
    assert "Lid / Top" not in preview_svg
    assert "Side" not in preview_svg

    for view in (authoring, review):
        for item in view.findall(
            ".//*[@data-region]/{*}path"
        ) + view.findall(".//*[@data-artwork-surface='primary']"):
            path_data = item.get("d", "").lower()
            assert all(role not in path_data for role in declared_roles)

    for archetype in ("slim-can", "sports-bottle", "snack-pouch"):
        other_skin = flat_skin_geometry_for(archetype)
        assert other_skin.panel_roles == ()
        other_review = ET.fromstring(
            render_audition_svg(_prototype(archetype), "review")
        )
        assert other_review.find(".//*[@data-panel-orientation-guides]") is None
        assert other_review.findall(".//{*}text") == []


def test_editable_face_bounds_clear_family_coverage_floors() -> None:
    coverage_floors = {
        "slim-can": 0.70,
        "sports-bottle": 0.70,
        "snack-pouch": 0.70,
        "takeaway-box": 0.70,
        "hoodie": 0.55,
        "trainer": 0.55,
        "smartphone": 0.55,
        "headphones": 0.32,
        "food-truck": 0.12,
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


def test_garden_proof_is_an_unmistakable_broad_surface_watering_can() -> None:
    root = ET.fromstring(render_audition_svg(_prototype("garden-tool"), "preview"))
    assert root.find(".//*[@data-product-part='watering-can-body']") is not None
    assert root.find(".//*[@data-product-part='watering-can-handle']") is not None
    assert root.find(".//*[@data-product-part='watering-can-spout']") is not None
    surface = artwork_surface_for("garden-tool")
    assert surface.bounds[2] >= 430
    assert surface.bounds[3] >= 300


@pytest.mark.parametrize(
    ("archetype", "part"),
    [
        ("aquarium", "full-front-glass"),
        ("hoodie", "hoodie-chest"),
        ("trainer", "athletic-upper"),
        ("pet-shop", "pet-shop-fascia"),
    ],
)
def test_revised_direct_surfaces_declare_the_intended_large_face(
    archetype: str, part: str
) -> None:
    root = ET.fromstring(render_audition_svg(_prototype(archetype), "preview"))
    assert root.find(f".//*[@data-product-part='{part}']") is not None


def test_revised_direct_surface_bounds_are_large_and_product_specific() -> None:
    expected = {
        "garden-tool": (430, 300),
        "aquarium": (680, 340),
        "hoodie": (470, 360),
        "trainer": (570, 250),
        "pet-shop": (700, 170),
    }
    for archetype, (minimum_width, minimum_height) in expected.items():
        _, _, width, height = artwork_surface_for(archetype).bounds
        assert width >= minimum_width
        assert height >= minimum_height


def test_food_truck_primary_target_is_uninterrupted_lower_side_panel() -> None:
    surface = artwork_surface_for("food-truck")
    x, y, width, height = surface.bounds
    assert width >= 500
    assert height >= 110
    assert y >= 565
    assert y + height <= 690
    assert x + width < 720

    review = ET.fromstring(render_audition_svg(_prototype("food-truck"), "review"))
    outline = review.find(".//*[@data-selection-outline='primary']")
    assert outline is not None
    assert outline.get("d") == surface.path

    preview = ET.fromstring(render_audition_svg(_prototype("food-truck"), "preview"))
    detail_layer = preview.find(".//*[@data-detail-layer='true']")
    assert detail_layer is not None
    window_bars = [
        path
        for path in detail_layer.findall("./{*}path")
        if "M270 345V535" in path.get("d", "")
    ]
    assert len(window_bars) == 1
    assert window_bars[0].get("d", "").count("V535") == 6
    service_sill = [
        path
        for path in detail_layer.findall("./{*}path")
        if path.get("d", "").startswith("M245 535H635")
    ]
    assert len(service_sill) == 1
    assert y >= 565


def test_headphones_selection_targets_exterior_cap_not_cushion() -> None:
    preview = ET.fromstring(render_audition_svg(_prototype("headphones"), "preview"))
    caps = preview.findall(".//*[@data-product-part='headphones-exterior-cap']")
    assert len(caps) == 1
    cap_path = caps[0].get("d")
    assert cap_path
    assert caps[0].get("data-editable") == "true"

    surface = artwork_surface_for("headphones")
    assert surface.path == cap_path
    _, _, width, height = surface.bounds
    assert width >= 380
    assert height >= 360

    for part in (
        "headphones-fixed-cushion",
        "headphones-headband",
        "headphones-rear-cup",
    ):
        fixed = preview.findall(f".//*[@data-product-part='{part}']")
        assert len(fixed) == 1
        assert fixed[0].get("data-editable") == "false"
        assert fixed[0].get("d") != cap_path

    review = ET.fromstring(render_audition_svg(_prototype("headphones"), "review"))
    clip = review.find(".//*[@data-artwork-surface='primary']")
    outline = review.find(".//*[@data-selection-outline='primary']")
    assert clip is not None
    assert outline is not None
    assert clip.get("d") == cap_path
    assert outline.get("d") == cap_path


def test_trainer_laces_are_light_ordered_crisscross_structure() -> None:
    root = ET.fromstring(render_audition_svg(_prototype("trainer"), "preview"))
    laces = root.findall(".//*[@data-product-part='trainer-lace']")
    assert len(laces) == 8
    assert {lace.get("data-lace-row") for lace in laces} == {"1", "2", "3", "4"}

    for row in ("1", "2", "3", "4"):
        pair = [lace for lace in laces if lace.get("data-lace-row") == row]
        assert len(pair) == 2
        assert {lace.get("data-lace-direction") for lace in pair} == {
            "left-to-right",
            "right-to-left",
        }

    assert all(lace.get("fill") == "none" for lace in laces)
    assert all(lace.get("stroke") == DETAIL_INK for lace in laces)
    assert all(
        float(lace.get("stroke-width", "99")) <= DETAIL_STROKE for lace in laces
    )
    opacities = {lace.get("opacity") for lace in laces}
    assert len(opacities) == 1
    assert all(0 < float(opacity or "0") <= 0.75 for opacity in opacities)
    assert all("Z" not in lace.get("d", "").upper() for lace in laces)


def test_aquarium_has_no_fixed_mid_glass_water_wave() -> None:
    root = ET.fromstring(render_audition_svg(_prototype("aquarium"), "preview"))
    assert root.find(".//*[@data-product-part='fixed-water-wave']") is None


def test_audition_roots_declare_the_shared_top_left_light_direction() -> None:
    for prototype in load_audition_source(MANIFEST_PATH).prototypes:
        for view in ("authoring", "preview", "review"):
            root = ET.fromstring(render_audition_svg(prototype, view))
            assert root.get("data-light-direction") == "top-left"


def test_audition_build_is_byte_deterministic_across_directory_pairs(
    tmp_path: Path,
) -> None:
    first_output = tmp_path / "first-output"
    first_report = tmp_path / "first-report"
    second_output = tmp_path / "second-output"
    second_report = tmp_path / "second-report"

    first = audition_module.build_product_shell_audition(
        MANIFEST_PATH, first_output, first_report
    )
    second = audition_module.build_product_shell_audition(
        MANIFEST_PATH, second_output, second_report
    )

    assert first.prototype_count == second.prototype_count == 12
    assert _tree_bytes(first_output) == _tree_bytes(second_output)
    assert _tree_bytes(first_report) == _tree_bytes(second_report)
    assert set(_tree_bytes(first_output)) == {
        "audition.json",
        "source.json",
        *(
            f"prototypes/{prototype.id}/{view}.svg"
            for prototype in load_audition_source(MANIFEST_PATH).prototypes
            for view in ("authoring", "preview")
        ),
    }
    assert set(_tree_bytes(first_report)) == {
        "contact-sheet.html",
        "qa.json",
        *(
            f"prototypes/{prototype.id}/review.svg"
            for prototype in load_audition_source(MANIFEST_PATH).prototypes
        ),
    }


def test_audition_build_emits_isolated_catalogue_snapshot_and_hashed_qa(
    tmp_path: Path,
) -> None:
    output_dir = tmp_path / "output"
    report_dir = tmp_path / "report"
    audition_module.build_product_shell_audition(MANIFEST_PATH, output_dir, report_dir)

    audition = _assert_canonical_json(output_dir / "audition.json")
    snapshot = _assert_canonical_json(output_dir / "source.json")
    qa = _assert_canonical_json(report_dir / "qa.json")

    assert audition["schema"] == "product-shell-style-audition-output@1"
    assert audition["status"] == "audition"
    assert len(audition["prototypes"]) == 12
    assert audition["prototypes"][0].keys() >= {
        "id",
        "title",
        "family",
        "archetype",
        "authoringMode",
        "authoringSvg",
        "previewSvg",
        "regions",
        "artworkSurface",
        "brandFree",
    }
    assert [item["id"] for item in audition["prototypes"]] == sorted(
        item["id"] for item in audition["prototypes"]
    )
    assert [item["id"] for item in snapshot["prototypes"]] == sorted(
        item["id"] for item in snapshot["prototypes"]
    )
    assert not (output_dir / "catalog.json").exists()
    assert not (report_dir / "catalog.json").exists()

    expected_hashes: dict[str, str] = {}
    for prototype in audition["prototypes"]:
        prototype_id = prototype["id"]
        runtime_dir = output_dir / "prototypes" / prototype_id
        review_dir = report_dir / "prototypes" / prototype_id
        assert prototype["authoringSvg"] == (
            f"prototypes/{prototype_id}/authoring.svg"
        )
        assert prototype["previewSvg"] == f"prototypes/{prototype_id}/preview.svg"
        assert "reviewSvg" not in prototype
        for view in ("authoring", "preview"):
            path = runtime_dir / f"{view}.svg"
            assert path.is_file()
            expected_hashes[f"runtime/prototypes/{prototype_id}/{view}.svg"] = (
                hashlib.sha256(path.read_bytes()).hexdigest()
            )
        assert not (runtime_dir / "review.svg").exists()
        review = review_dir / "review.svg"
        assert review.is_file()
        assert not (review_dir / "authoring.svg").exists()
        assert not (review_dir / "preview.svg").exists()
        expected_hashes[f"report/prototypes/{prototype_id}/review.svg"] = (
            hashlib.sha256(review.read_bytes()).hexdigest()
        )

    snapshot_bytes = (output_dir / "source.json").read_bytes()
    assert qa["prototypeCount"] == 12
    assert qa["errors"] == []
    assert qa["reviewStatus"] == "PENDING_VISUAL_PANEL"
    assert qa["svgSha256"] == dict(sorted(expected_hashes.items()))
    assert qa["sourceSnapshot"] == {
        "path": "source.json",
        "sha256": hashlib.sha256(snapshot_bytes).hexdigest(),
    }


def test_audition_contact_sheet_is_self_contained_four_by_three_evidence(
    tmp_path: Path,
) -> None:
    output_dir = tmp_path / "output"
    report_dir = tmp_path / "report"
    audition_module.build_product_shell_audition(MANIFEST_PATH, output_dir, report_dir)

    contact_sheet = (report_dir / "contact-sheet.html").read_text(encoding="utf-8")

    assert "grid-template-columns:repeat(4,minmax(0,1fr))" in contact_sheet
    assert "grid-template-rows:repeat(3,auto)" in contact_sheet
    assert "background:#F4F1EA" in contact_sheet
    assert "border:1px solid #D7D2C8" in contact_sheet
    assert contact_sheet.count('<article class="prototype-card"') == 12
    assert contact_sheet.count('data-view="preview"') == 12
    assert contact_sheet.count('data-view="review"') == 12
    assert contact_sheet.count("<svg ") == 24
    assert "<script" not in contact_sheet.lower()
    assert "<img" not in contact_sheet.lower()
    assert 'src="http' not in contact_sheet.lower()
    assert 'href="http' not in contact_sheet.lower()
    assert "url(http" not in contact_sheet.lower()
    assert "@import" not in contact_sheet.lower()
    assert "stroke-dasharray" not in contact_sheet.lower()
    assert "blue" not in contact_sheet.lower()
    prototypes = sorted(
        load_audition_source(MANIFEST_PATH).prototypes,
        key=lambda prototype: prototype.id,
    )
    cards = contact_sheet.split('<article class="prototype-card">')[1:]
    assert len(cards) == len(prototypes) == 12
    for prototype, card in zip(prototypes, cards, strict=True):
        assert f"<h2>{prototype.title}</h2>" in card
        label = (
            "Flat skin"
            if prototype.authoring_mode == "flat-skin"
            else "Direct surface"
        )
        assert f"<p>{label}</p>" in card
        assert card.count("<figcaption>") == 2
        if prototype.authoring_mode == "flat-skin":
            preview_caption = "Mapped product preview"
            review_caption = "Editable product skin"
        else:
            preview_caption = "Clean preview"
            review_caption = "Editor-selected"
        assert f"<figcaption>{preview_caption}</figcaption>" in card
        assert f"<figcaption>{review_caption}</figcaption>" in card


@pytest.mark.parametrize(
    ("output_relative", "report_relative"),
    [
        ("alias/../shared", "shared"),
        ("report/alias/../nested-output", "report"),
        ("output", "output/alias/../nested-report"),
    ],
    ids=["equal", "output-under-report", "report-under-output"],
)
def test_audition_build_rejects_resolved_overlapping_targets_before_any_write(
    tmp_path: Path, output_relative: str, report_relative: str
) -> None:
    output_dir = tmp_path / output_relative
    report_dir = tmp_path / report_relative
    assert not output_dir.exists()
    assert not report_dir.exists()

    with pytest.raises(
        ProductShellAuditionError,
        match="audition output and report directories must not overlap",
    ):
        audition_module.build_product_shell_audition(
            MANIFEST_PATH, output_dir, report_dir
        )

    assert not output_dir.exists()
    assert not report_dir.exists()


@pytest.mark.parametrize("occupied", ["output", "report"])
def test_audition_build_rejects_non_empty_target_before_any_write(
    tmp_path: Path, occupied: str
) -> None:
    output_dir = tmp_path / "output"
    report_dir = tmp_path / "report"
    occupied_dir = output_dir if occupied == "output" else report_dir
    untouched_dir = report_dir if occupied == "output" else output_dir
    occupied_dir.mkdir()
    sentinel = occupied_dir / "sentinel.txt"
    sentinel.write_bytes(b"keep me")

    with pytest.raises(
        ProductShellAuditionError,
        match=f"audition {occupied} directory must be absent or empty",
    ):
        audition_module.build_product_shell_audition(
            MANIFEST_PATH, output_dir, report_dir
        )

    assert sentinel.read_bytes() == b"keep me"
    assert not untouched_dir.exists()


def test_audition_build_prepares_all_bytes_before_creating_targets(
    tmp_path: Path,
) -> None:
    candidate = _manifest()
    hoodie = next(
        item for item in candidate["prototypes"] if item["archetype"] == "hoodie"
    )
    hoodie["regions"][0]["id"] = "glass"
    source_path = _write_manifest(tmp_path, candidate)
    output_dir = tmp_path / "output"
    report_dir = tmp_path / "report"

    with pytest.raises(ValueError, match="hoodie has no geometry for region glass"):
        audition_module.build_product_shell_audition(
            source_path, output_dir, report_dir
        )

    assert not output_dir.exists()
    assert not report_dir.exists()
