from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Callable

import pytest
from pydantic import ValidationError

from asset_pipeline.product_shell_audition import (
    ProductShellAuditionError,
    load_audition_source,
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
