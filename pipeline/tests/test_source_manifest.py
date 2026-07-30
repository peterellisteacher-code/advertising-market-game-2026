from __future__ import annotations

import copy
import json

import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError

from conftest import REPO_ROOT
from asset_pipeline.schema import SourceManifest


def source_manifest() -> dict:
    return {
        "schema": "asset-source@1",
        "packId": "fixture-pack",
        "sheets": [],
        "assets": [
            {
                "id": "bottle-basic",
                "accepted": True,
                "sourcePath": "assets/bottle.png",
                "sourceSha256": "a" * 64,
                "title": "Basic bottle",
                "category": "drinkware",
                "tags": ["bottle", "drinkware"],
                "kind": "raster-master",
                "masks": {"body": "masks/bottle-body.png"},
                "recolourZones": ["body"],
                "anchors": [{"id": "lid", "x": 0.5, "y": 0.1, "accepts": ["cap"]}],
                "materialProfiles": ["matte-plastic"],
                "classroomReviewed": False,
                "brandFree": False,
                "attribution": {
                    "creator": "Fixture author",
                    "sourceUrl": "local",
                    "license": "Classroom fixture",
                },
            },
            {
                "id": "rejected-logo",
                "accepted": False,
                "sourcePath": "rejected/logo.png",
                "sourceSha256": "b" * 64,
                "rejectionReason": "Visible brand",
                "title": "Rejected logo",
                "category": "drinkware",
                "tags": [],
                "kind": "raster-master",
                "masks": {},
                "recolourZones": [],
                "anchors": [],
                "materialProfiles": [],
                "classroomReviewed": False,
                "brandFree": False,
                "attribution": {
                    "creator": "Fixture author",
                    "sourceUrl": "local",
                    "license": "Classroom fixture",
                },
            },
        ],
        "virtualAssets": [
            {
                "id": "bottle-basic-blue",
                "parentId": "bottle-basic",
                "title": "Basic blue bottle",
                "tags": ["blue", "bottle"],
                "defaultZoneStyles": {
                    "body": {"colour": "#3366CC", "materialId": "matte-plastic", "opacity": 1.0}
                },
            }
        ],
    }


def test_source_manifest_accepts_base_rejection_and_one_level_virtual():
    manifest = SourceManifest.model_validate(source_manifest(), strict=True)
    assert [asset.id for asset in manifest.assets if asset.accepted] == ["bottle-basic"]
    assert manifest.virtual_assets[0].parent_id == "bottle-basic"


def test_source_manifest_fixture_matches_the_machine_readable_schema():
    schema = json.loads((REPO_ROOT / "catalog" / "schemas" / "asset-source-v1.schema.json").read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    assert list(Draft202012Validator(schema).iter_errors(source_manifest())) == []


@pytest.mark.parametrize(
    "mutate",
    [
        lambda value: value["assets"][0].update({"sourcePath": "../escape.png"}),
        lambda value: value["assets"][0].update({"sheetId": "sheet-one", "sheetOutputId": "bottle-basic"}),
        lambda value: value["assets"][1].pop("rejectionReason"),
        lambda value: value["virtualAssets"].append({"id": "chain", "parentId": "bottle-basic-blue", "title": "Chain", "tags": []}),
        lambda value: value["virtualAssets"].append({"id": "orphan", "parentId": "missing", "title": "Orphan", "tags": []}),
        lambda value: value["assets"].append(copy.deepcopy(value["assets"][0])),
    ],
)
def test_source_manifest_rejects_ambiguous_sources_rejections_or_virtual_graphs(mutate):
    candidate = source_manifest()
    mutate(candidate)
    with pytest.raises((ValidationError, ValueError)):
        SourceManifest.model_validate(candidate, strict=True)
