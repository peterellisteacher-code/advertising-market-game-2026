from __future__ import annotations

import copy
import json

import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError

from conftest import REPO_ROOT
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
    errors = sorted(Draft202012Validator(schema).iter_errors(canonical), key=lambda error: list(error.path))

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
        "defaultZoneStyles": None,
    })
    live.pop("masterSha256")

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
    validator = Draft202012Validator(schema)

    for case in corpus["valid"]:
        assert CatalogAsset.model_validate(case["value"], strict=True)
        assert list(validator.iter_errors(case["value"])) == [], case["name"]

    for case in corpus["invalid"]:
        with pytest.raises(ValidationError):
            CatalogAsset.model_validate(case["value"], strict=True)
        assert list(validator.iter_errors(case["value"])), case["name"]
