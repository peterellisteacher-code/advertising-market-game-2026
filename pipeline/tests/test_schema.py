from __future__ import annotations

import copy
import json

import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError

from conftest import REPO_ROOT
from asset_pipeline.json_schema import catalog_schema_validator
from asset_pipeline.schema import (
    CatalogAsset,
    canonical_json_bytes,
    validate_portable_ids,
)


def test_catalogue_model_and_draft_2020_schema_share_a_canonical_record(valid_asset_dict):
    schema_path = REPO_ROOT / "catalog" / "schemas" / "catalog-asset-v1.schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)

    model = CatalogAsset.model_validate(valid_asset_dict, strict=True)
    canonical = json.loads(canonical_json_bytes(model).decode("utf-8"))
    errors = sorted(catalog_schema_validator(schema).iter_errors(canonical), key=lambda error: list(error.path))

    assert errors == []
    assert canonical_json_bytes(model).endswith(b"\n")
    assert not canonical_json_bytes(model).startswith(b"\xef\xbb\xbf")
    assert b'"dimensions":{"height":640,"width":320}' in canonical_json_bytes(model)


@pytest.mark.parametrize(
    ("path", "replacement"),
    [
        (("files", "master"), "C:/absolute/master.png"),
        (("files", "master"), "/catalog/generated/offline-core-v1/../secret.png"),
        (("files", "master"), "\\catalog\\master.png"),
        (("files", "master"), "https://example.test/master.png"),
        (("masterSha256",), "A" * 64),
    ],
)
def test_offline_records_reject_noncanonical_paths_and_hashes(valid_asset_dict, path, replacement):
    candidate = copy.deepcopy(valid_asset_dict)
    target = candidate
    for segment in path[:-1]:
        target = target[segment]
    target[path[-1]] = replacement

    with pytest.raises(ValidationError):
        CatalogAsset.model_validate(candidate, strict=True)


def test_live_photo_contract_is_discriminated_from_offline_assets(valid_asset_dict):
    live = copy.deepcopy(valid_asset_dict)
    live.update({
        "delivery": "live-photo",
        "kind": "photo",
        "id": "04730a38-97d4-46dc-b9fa-58c0c91a7d62",
        "files": {
            "thumbnail": "/api/openverse-image/04730a38-97d4-46dc-b9fa-58c0c91a7d62?variant=thumbnail",
            "preview": "/api/openverse-image/04730a38-97d4-46dc-b9fa-58c0c91a7d62",
            "master": "/api/openverse-image/04730a38-97d4-46dc-b9fa-58c0c91a7d62",
        },
        "dimensions": {"width": 653, "height": 1024},
        "recolourZones": [],
        "anchors": [],
        "materialProfiles": [],
        "classroomReviewed": False,
        "brandFree": False,
    })
    live.pop("masterSha256")
    live.pop("defaultZoneStyles")

    assert CatalogAsset.model_validate(live, strict=True).delivery == "live-photo"

    live["masterSha256"] = "a" * 64
    with pytest.raises(ValidationError):
        CatalogAsset.model_validate(live, strict=True)


@pytest.mark.parametrize(
    "mutate",
    [
        lambda value: value.update({"brandFree": None}),
        lambda value: value.update({"classroomReviewed": None}),
        lambda value: value["anchors"].append({"id": "lid", "x": 0.2, "y": 0.2, "accepts": []}),
        lambda value: value["anchors"].append({"id": "Upper", "x": 0.2, "y": 0.2, "accepts": []}),
        lambda value: value["anchors"].append({"id": "bad", "x": 1.01, "y": 0.2, "accepts": []}),
        lambda value: value.update({"materialProfiles": ["unknown-material"]}),
        lambda value: value.update({"recolourZones": []}),
        lambda value: value["anchors"][0].update({"accepts": ["z", "a"]}),
        lambda value: value.update({"unexpected": True}),
    ],
)
def test_catalogue_model_is_strict_and_enforces_cross_field_rules(valid_asset_dict, mutate):
    candidate = copy.deepcopy(valid_asset_dict)
    mutate(candidate)
    with pytest.raises(ValidationError):
        CatalogAsset.model_validate(candidate, strict=True)


@pytest.mark.parametrize(
    "ids",
    [
        ["Bottle", "bottle"],
        ["con"],
        ["aux.component"],
        ["trail."],
        ["trail "],
        ["café", "cafe\u0301"],
        ["../escape"],
        ["a" * 81],
    ],
)
def test_portable_id_validation_rejects_windows_and_unicode_collisions(ids):
    with pytest.raises(ValueError):
        validate_portable_ids(ids)


def test_portable_id_validation_returns_stable_normalised_ids():
    assert validate_portable_ids(["bottle-basic", "cap-small"]) == ["bottle-basic", "cap-small"]


def test_shared_corpus_has_identical_pydantic_and_json_schema_verdicts():
    schema = json.loads((REPO_ROOT / "catalog" / "schemas" / "catalog-asset-v1.schema.json").read_text(encoding="utf-8"))
    corpus = json.loads((REPO_ROOT / "catalog" / "schemas" / "catalog-asset-v1.corpus.json").read_text(encoding="utf-8"))
    validator = catalog_schema_validator(schema)

    for case in corpus["valid"]:
        assert CatalogAsset.model_validate(case["value"], strict=True)
        assert list(validator.iter_errors(case["value"])) == [], case["name"]

    for case in corpus["invalid"]:
        with pytest.raises(ValidationError):
            CatalogAsset.model_validate(case["value"], strict=True)
        assert list(validator.iter_errors(case["value"])), case["name"]

    for case in corpus["derivedInvalid"]:
        candidate = copy.deepcopy(corpus["valid"][case["baseValid"]]["value"])
        target = candidate
        for segment in case["path"][:-1]:
            target = target[segment]
        target[case["path"][-1]] = case["value"]
        with pytest.raises(ValidationError):
            CatalogAsset.model_validate(candidate, strict=True)
        assert list(validator.iter_errors(candidate)), case["name"]


def test_json_schema_enforces_canonical_order_pixel_product_and_anchor_identity(valid_asset_dict):
    schema = json.loads((REPO_ROOT / "catalog" / "schemas" / "catalog-asset-v1.schema.json").read_text(encoding="utf-8"))
    validator = catalog_schema_validator(schema)
    cases = []

    unsorted = copy.deepcopy(valid_asset_dict)
    unsorted["tags"] = ["drinkware", "bottle"]
    cases.append(("unsorted tags", unsorted))

    oversized = copy.deepcopy(valid_asset_dict)
    oversized["dimensions"] = {"width": 8192, "height": 8192}
    cases.append(("64 megapixel product", oversized))

    duplicate_anchor = copy.deepcopy(valid_asset_dict)
    duplicate_anchor["anchors"].append({"id": "lid", "x": 0.6, "y": 0.2, "accepts": ["cap"]})
    cases.append(("duplicate anchor ID", duplicate_anchor))

    for name, candidate in cases:
        with pytest.raises(ValidationError):
            CatalogAsset.model_validate(candidate, strict=True)
        assert list(validator.iter_errors(candidate)), name


def test_pydantic_rejects_explicit_null_live_fields_empty_styles_and_unsafe_attribution(valid_asset_dict):
    corpus = json.loads((REPO_ROOT / "catalog" / "schemas" / "catalog-asset-v1.corpus.json").read_text(encoding="utf-8"))
    live_with_null = copy.deepcopy(corpus["valid"][1]["value"])
    live_with_null["masterSha256"] = None

    empty_styles = copy.deepcopy(valid_asset_dict)
    empty_styles["defaultZoneStyles"] = {}

    unsafe_attribution = copy.deepcopy(valid_asset_dict)
    unsafe_attribution["attribution"]["sourceUrl"] = "file:///classroom-secret"

    for candidate in (live_with_null, empty_styles, unsafe_attribution):
        with pytest.raises(ValidationError):
            CatalogAsset.model_validate(candidate, strict=True)


def test_exact_pixel_limit_keeps_a_narrow_8192_axis_asset_valid(valid_asset_dict):
    candidate = copy.deepcopy(valid_asset_dict)
    candidate["dimensions"] = {"width": 8192, "height": 1}

    assert CatalogAsset.model_validate(candidate, strict=True).dimensions.width == 8192
