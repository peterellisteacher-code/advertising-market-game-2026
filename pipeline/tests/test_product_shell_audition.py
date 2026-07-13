from __future__ import annotations

import copy
import hashlib
import json
import xml.etree.ElementTree as ET
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
    for prototype in load_audition_source(MANIFEST_PATH).prototypes:
        assert prototype.title in contact_sheet
        label = "Flat skin" if prototype.authoring_mode == "flat-skin" else "Direct surface"
        assert label in contact_sheet


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
