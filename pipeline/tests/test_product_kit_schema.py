from __future__ import annotations

import copy
import importlib
import json
import math
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest
from jsonschema import Draft202012Validator
from pydantic import ValidationError

from pipeline.asset_pipeline.json_schema import catalog_schema_validator


CATALOGUE_SHA = "f" * 64
REPO_ROOT = Path(__file__).resolve().parents[2]
HASHES = {
    "grid_base": "a" * 64,
    "grid_part": "b" * 64,
    "grip_base": "c" * 64,
    "grip_front": "d" * 64,
    "grip_rear": "e" * 64,
    "socket_base": "1" * 64,
    "socket_part": "2" * 64,
    "whole_base": "3" * 64,
}
FRAME = {
    "originalWidth": 100,
    "originalHeight": 100,
    "trimX": 0,
    "trimY": 0,
    "trimWidth": 100,
    "trimHeight": 100,
}
CONSTRAINTS = {
    "minScale": 0.5,
    "maxScale": 2.0,
    "minRotationDegrees": -45.0,
    "maxRotationDegrees": 45.0,
    "maxNormalErrorDegrees": 5.0,
    "mirrorAllowed": False,
}


def _contract() -> ModuleType:
    try:
        module = importlib.import_module("pipeline.product_kit.schema")
    except ModuleNotFoundError:
        pytest.fail("product_kit.schema has not been implemented")
    required = {
        "ProductKitCatalogue",
        "ProductKitCatalogueContext",
        "canonical_json_bytes",
        "parse_product_kit_catalogue",
    }
    missing = sorted(required.difference(vars(module)))
    assert missing == [], f"missing public contract symbols: {missing}"
    return module


def _asset(asset_id: str, master_sha256: str, kind: str = "raster-master") -> dict[str, Any]:
    return {
        "id": asset_id,
        "masterSha256": master_sha256,
        "delivery": "offline",
        "kind": kind,
        "files": {
            "master": f"/catalog/generated/offline-core-v1/assets/{asset_id}/master.png"
        },
        "dimensions": {"width": 100, "height": 100},
        "classroomReviewed": True,
        "brandFree": True,
    }


def context_fixture() -> dict[str, Any]:
    return {
        "catalogPackId": "offline-core-v1",
        "catalogSha256": CATALOGUE_SHA,
        "records": [
            _asset("asset-grid-base", HASHES["grid_base"]),
            _asset("asset-grid-part", HASHES["grid_part"], "component"),
            _asset("asset-grip-base", HASHES["grip_base"]),
            _asset("asset-grip-front", HASHES["grip_front"], "component"),
            _asset("asset-grip-rear", HASHES["grip_rear"], "component"),
            _asset("asset-socket-base", HASHES["socket_base"]),
            _asset("asset-socket-part", HASHES["socket_part"], "component"),
            _asset("asset-whole-base", HASHES["whole_base"]),
        ],
    }


def _raster(asset_id: str, master_sha256: str) -> dict[str, Any]:
    return {
        "assetId": asset_id,
        "masterSha256": master_sha256,
        "frame": dict(FRAME),
    }


def _profile(family_id: str, geometry_id: str) -> dict[str, str]:
    return {
        "familyId": family_id,
        "perspectiveId": "pk1-front-view",
        "geometryId": geometry_id,
        "styleId": "pk1-outline-clean",
    }


def catalogue_fixture() -> dict[str, Any]:
    return {
        "schema": "product-kit@1",
        "version": 1,
        "packId": "pk1-pilot",
        "catalogPackId": "offline-core-v1",
        "catalogSha256": CATALOGUE_SHA,
        "pricingVersion": "product-pricing@1",
        "connectorFormulaVersion": "product-kit-connectors@1",
        "kits": [
            {
                "id": "pk1-grid-kit",
                "title": "Escape Room Wall",
                "mode": "grid",
                "compatibilityProfile": _profile("pk1-escape-room", "pk1-wall-grid"),
                "base": _raster("asset-grid-base", HASHES["grid_base"]),
                "priceAssetId": "pk1-price-grid-base",
                "mountFrames": [
                    {
                        "id": "pk1-grid-frame",
                        "slotId": "pk1-grid-slot",
                        "mountType": "grid",
                        "origin": {"x": 0.1, "y": 0.1},
                        "cellSize": {"width": 0.1, "height": 0.1},
                        "columns": 8,
                        "rows": 6,
                        "plane": "wall",
                        "acceptedEdgeTypes": ["pk1-door", "pk1-panel"],
                    }
                ],
                "artworkBounds": [],
            },
            {
                "id": "pk1-grip-kit",
                "title": "Reusable Cup",
                "mode": "grip",
                "compatibilityProfile": _profile("pk1-drinkware", "pk1-cup-handle"),
                "base": _raster("asset-grip-base", HASHES["grip_base"]),
                "priceAssetId": "pk1-price-grip-base",
                "mountFrames": [
                    {
                        "id": "pk1-grip-frame",
                        "slotId": "pk1-handle-slot",
                        "mountType": "grip",
                        "contacts": [
                            {"x": 0.82, "y": 0.35},
                            {"x": 0.82, "y": 0.7},
                        ],
                        "normals": [
                            {"x": 1.0, "y": 0.0},
                            {"x": 1.0, "y": 0.0},
                        ],
                        "constraints": {**CONSTRAINTS, "mirrorAllowed": True},
                    }
                ],
                "artworkBounds": [
                    {"x": 0.25, "y": 0.25, "width": 0.45, "height": 0.5}
                ],
            },
            {
                "id": "pk1-socket-kit",
                "title": "Travel Bottle",
                "mode": "socket",
                "compatibilityProfile": _profile("pk1-drinkware", "pk1-bottle-lid"),
                "base": _raster("asset-socket-base", HASHES["socket_base"]),
                "priceAssetId": "pk1-price-socket-base",
                "mountFrames": [
                    {
                        "id": "pk1-socket-frame",
                        "slotId": "pk1-lid-slot",
                        "mountType": "socket",
                        "point": {"x": 0.5, "y": 0.08},
                        "normal": {"x": 0.0, "y": -1.0},
                        "referenceScale": 0.22,
                        "constraints": dict(CONSTRAINTS),
                    }
                ],
                "artworkBounds": [
                    {"x": 0.2, "y": 0.3, "width": 0.6, "height": 0.45}
                ],
            },
            {
                "id": "pk1-whole-kit",
                "title": "Complete Mug",
                "mode": "whole",
                "compatibilityProfile": _profile("pk1-drinkware", "pk1-complete-mug"),
                "base": _raster("asset-whole-base", HASHES["whole_base"]),
                "priceAssetId": "pk1-price-whole-base",
                "mountFrames": [],
                "artworkBounds": [
                    {"x": 0.25, "y": 0.25, "width": 0.45, "height": 0.5}
                ],
            },
        ],
        "components": [
            {
                "id": "pk1-grid-component",
                "title": "Secret Door",
                "slotId": "pk1-grid-slot",
                "compatibilityProfile": _profile("pk1-escape-room", "pk1-wall-grid"),
                "componentFrame": {
                    "mountType": "grid",
                    "plane": "wall",
                    "footprint": {"columns": 2, "rows": 3},
                    "edgeTypes": {"north": "pk1-panel", "south": "pk1-door"},
                },
                "fragments": [
                    {
                        "layer": "front",
                        "raster": _raster("asset-grid-part", HASHES["grid_part"]),
                    }
                ],
                "priceAssetId": "pk1-price-secret-door",
            },
            {
                "id": "pk1-grip-component",
                "title": "Loop Handle",
                "slotId": "pk1-handle-slot",
                "compatibilityProfile": _profile("pk1-drinkware", "pk1-cup-handle"),
                "componentFrame": {
                    "mountType": "grip",
                    "contacts": [
                        {"x": 0.18, "y": 0.25},
                        {"x": 0.18, "y": 0.75},
                    ],
                    "normals": [
                        {"x": -1.0, "y": 0.0},
                        {"x": -1.0, "y": 0.0},
                    ],
                },
                "fragments": [
                    {
                        "layer": "rear",
                        "raster": _raster("asset-grip-rear", HASHES["grip_rear"]),
                    },
                    {
                        "layer": "front",
                        "raster": _raster("asset-grip-front", HASHES["grip_front"]),
                    },
                ],
                "priceAssetId": "pk1-price-loop-handle",
            },
            {
                "id": "pk1-socket-component",
                "title": "Flip Lid",
                "slotId": "pk1-lid-slot",
                "compatibilityProfile": _profile("pk1-drinkware", "pk1-bottle-lid"),
                "componentFrame": {
                    "mountType": "socket",
                    "point": {"x": 0.5, "y": 0.9},
                    "normal": {"x": 0.0, "y": -1.0},
                    "referenceScale": 0.2,
                },
                "fragments": [
                    {
                        "layer": "front",
                        "raster": _raster("asset-socket-part", HASHES["socket_part"]),
                    }
                ],
                "priceAssetId": "pk1-price-flip-lid",
            },
        ],
        "certifications": [
            {
                "id": "pk1-cert-grid",
                "kitId": "pk1-grid-kit",
                "mountFrameId": "pk1-grid-frame",
                "componentId": "pk1-grid-component",
                "fingerprint": "4" * 64,
            },
            {
                "id": "pk1-cert-grip",
                "kitId": "pk1-grip-kit",
                "mountFrameId": "pk1-grip-frame",
                "componentId": "pk1-grip-component",
                "fingerprint": "5" * 64,
            },
            {
                "id": "pk1-cert-socket",
                "kitId": "pk1-socket-kit",
                "mountFrameId": "pk1-socket-frame",
                "componentId": "pk1-socket-component",
                "fingerprint": "6" * 64,
            },
        ],
    }


def _set_path(root: Any, path: tuple[str | int, ...], value: Any) -> None:
    target = root
    for segment in path[:-1]:
        target = target[segment]
    target[path[-1]] = value


def test_shared_cross_language_corpus_has_matching_python_verdicts() -> None:
    contract = _contract()
    corpus = json.loads(
        (REPO_ROOT / "catalog" / "schemas" / "product-kit-v1.corpus.json").read_text(
            encoding="utf-8"
        )
    )
    valid = corpus["valid"][0]["value"]
    context = corpus["context"]

    assert contract.parse_product_kit_catalogue(valid, context) is not None
    for case in corpus["derivedValid"]:
        candidate = copy.deepcopy(valid)
        candidate_context = copy.deepcopy(context)
        target = candidate if case["target"] == "value" else candidate_context
        _set_path(target, tuple(case["path"]), case["value"])
        assert (
            contract.parse_product_kit_catalogue(candidate, candidate_context)
            is not None
        ), case["name"]
    for case in corpus["derivedInvalid"]:
        candidate = copy.deepcopy(valid)
        candidate_context = copy.deepcopy(context)
        target = candidate if case["target"] == "value" else candidate_context
        _set_path(target, tuple(case["path"]), case["value"])
        assert (
            contract.parse_product_kit_catalogue(candidate, candidate_context) is None
        ), case["name"]


def test_draft_2020_schema_matches_shared_structural_corpus_verdicts() -> None:
    schema = json.loads(
        (REPO_ROOT / "catalog" / "schemas" / "product-kit-v1.schema.json").read_text(
            encoding="utf-8"
        )
    )
    corpus = json.loads(
        (REPO_ROOT / "catalog" / "schemas" / "product-kit-v1.corpus.json").read_text(
            encoding="utf-8"
        )
    )
    Draft202012Validator.check_schema(schema)
    validator = catalog_schema_validator(schema)
    valid = corpus["valid"][0]["value"]

    assert list(validator.iter_errors(valid)) == []
    for case in corpus["derivedValid"]:
        candidate = copy.deepcopy(valid)
        if case["target"] == "value":
            _set_path(candidate, tuple(case["path"]), case["value"])
        assert list(validator.iter_errors(candidate)) == [], case["name"]
    for case in corpus["derivedInvalid"]:
        candidate = copy.deepcopy(valid)
        if case["target"] == "value":
            _set_path(candidate, tuple(case["path"]), case["value"])
        errors = list(validator.iter_errors(candidate))
        if case["structural"]:
            assert errors, case["name"]
        else:
            assert errors == [], case["name"]


SYNTAX_CASES = (
    "top-level extras",
    "nested frame extras",
    "wrong schema literal",
    "wrong connector formula literal",
    "snake-case input key",
    "unprefixed product-kit ID",
    "uppercase hash",
    "empty title",
    "outer title whitespace",
    "control character in title",
    "overlong title",
    "overlong UTF-16 title",
    "JavaScript-trimmed title whitespace",
    "coerced version",
    "boolean version",
    "non-integral grid count",
    "boolean numeric constraint",
    "non-finite point",
    "infinite normal",
    "zero normal",
    "identical grip contacts",
    "grid outside design rectangle",
    "trim rectangle outside original dimensions",
    "artwork bounds outside design rectangle",
    "unknown grid edge key",
    "too many mount frames",
    "empty component fragments",
    "context extras",
)


def _apply_syntax_case(name: str, value: dict[str, Any], context: dict[str, Any]) -> None:
    match name:
        case "top-level extras":
            value["extra"] = True
        case "nested frame extras":
            value["kits"][1]["mountFrames"][0]["extra"] = True
        case "wrong schema literal":
            value["schema"] = "product-kit@2"
        case "wrong connector formula literal":
            value["connectorFormulaVersion"] = "product-kit-connectors@2"
        case "snake-case input key":
            value["catalog_pack_id"] = value.pop("catalogPackId")
        case "unprefixed product-kit ID":
            value["packId"] = "pilot"
        case "uppercase hash":
            value["catalogSha256"] = "A" * 64
        case "empty title":
            value["kits"][0]["title"] = ""
        case "outer title whitespace":
            value["kits"][0]["title"] = " Escape Room Wall"
        case "control character in title":
            value["kits"][0]["title"] = "Escape\nRoom"
        case "overlong title":
            value["kits"][0]["title"] = "x" * 81
        case "overlong UTF-16 title":
            value["kits"][0]["title"] = "\U0001f600" * 41
        case "JavaScript-trimmed title whitespace":
            value["kits"][0]["title"] = "\ufeffEscape Room Wall"
        case "coerced version":
            value["version"] = "1"
        case "boolean version":
            value["version"] = True
        case "non-integral grid count":
            value["kits"][0]["mountFrames"][0]["columns"] = 8.5
        case "boolean numeric constraint":
            value["kits"][1]["mountFrames"][0]["constraints"]["minScale"] = True
        case "non-finite point":
            value["kits"][2]["mountFrames"][0]["point"]["x"] = math.nan
        case "infinite normal":
            value["kits"][2]["mountFrames"][0]["normal"]["x"] = math.inf
        case "zero normal":
            value["kits"][2]["mountFrames"][0]["normal"] = {"x": 0.0, "y": 0.0}
        case "identical grip contacts":
            contacts = value["components"][1]["componentFrame"]["contacts"]
            contacts[1] = copy.deepcopy(contacts[0])
        case "grid outside design rectangle":
            value["kits"][0]["mountFrames"][0]["cellSize"] = {
                "width": 0.2,
                "height": 0.1,
            }
        case "trim rectangle outside original dimensions":
            value["kits"][0]["base"]["frame"]["originalWidth"] = 99
        case "artwork bounds outside design rectangle":
            value["kits"][1]["artworkBounds"][0]["width"] = 0.9
        case "unknown grid edge key":
            value["components"][0]["componentFrame"]["edgeTypes"]["diagonal"] = "pk1-panel"
        case "too many mount frames":
            frame = value["kits"][1]["mountFrames"][0]
            value["kits"][1]["mountFrames"] = [copy.deepcopy(frame) for _ in range(33)]
        case "empty component fragments":
            value["components"][0]["fragments"] = []
        case "context extras":
            context["extra"] = True
        case _:
            raise AssertionError(f"unknown syntax case: {name}")


GRAPH_CASES = (
    "unsorted kit IDs",
    "whole kit frames",
    "structural mode/frame mismatch",
    "duplicate mount-frame IDs",
    "mount-frame ID reused by another kit",
    "unsorted mount-frame IDs",
    "unknown certified kit",
    "unknown certified frame",
    "unknown certified component",
    "duplicate certified pair",
    "mismatched slot",
    "mismatched family profile",
    "mismatched perspective profile",
    "mismatched geometry profile",
    "mismatched style profile",
    "mismatched component frame type",
    "socket geometry outside scale limits",
    "socket geometry outside rotation limits",
    "grip geometry outside scale limits",
    "grip geometry requires forbidden mirror",
    "grid edge outside certified surface",
    "grid footprint larger than surface",
    "grid plane mismatch",
    "out-of-order component layers",
    "duplicate component layers",
    "unsorted component IDs",
    "duplicate component IDs",
    "unsorted certification IDs",
    "duplicate certification IDs",
    "unsorted grid edge types",
    "duplicate grid edge types",
    "wrong catalogue pack",
    "wrong catalogue hash",
    "duplicate context record IDs",
    "unknown raster asset",
    "stale raster hash",
    "unreviewed raster",
    "branded raster",
    "non-offline raster",
    "disallowed raster kind",
    "noncanonical raster path",
    "trim/catalogue dimension drift",
)


def _apply_graph_case(name: str, value: dict[str, Any], context: dict[str, Any]) -> None:
    match name:
        case "unsorted kit IDs":
            value["kits"].reverse()
        case "whole kit frames":
            value["kits"][3]["mountFrames"] = copy.deepcopy(value["kits"][2]["mountFrames"])
        case "structural mode/frame mismatch":
            value["kits"][1]["mode"] = "socket"
        case "duplicate mount-frame IDs":
            frames = value["kits"][1]["mountFrames"]
            frames.append(copy.deepcopy(frames[0]))
        case "mount-frame ID reused by another kit":
            reused_id = value["kits"][1]["mountFrames"][0]["id"]
            value["kits"][2]["mountFrames"][0]["id"] = reused_id
            value["certifications"][2]["mountFrameId"] = reused_id
        case "unsorted mount-frame IDs":
            frame = copy.deepcopy(value["kits"][1]["mountFrames"][0])
            frame["id"] = "pk1-alpha-frame"
            value["kits"][1]["mountFrames"].append(frame)
        case "unknown certified kit":
            value["certifications"][0]["kitId"] = "pk1-missing-kit"
        case "unknown certified frame":
            value["certifications"][0]["mountFrameId"] = "pk1-missing-frame"
        case "unknown certified component":
            value["certifications"][0]["componentId"] = "pk1-missing-component"
        case "duplicate certified pair":
            duplicate = copy.deepcopy(value["certifications"][0])
            duplicate["id"] = "pk1-cert-grid-copy"
            value["certifications"].insert(1, duplicate)
        case "mismatched slot":
            value["components"][0]["slotId"] = "pk1-other-slot"
        case name if name.startswith("mismatched ") and name.endswith(" profile"):
            key = name.removeprefix("mismatched ").removesuffix(" profile") + "Id"
            value["components"][1]["compatibilityProfile"][key] = f"pk1-other-{key.lower()}"
        case "mismatched component frame type":
            value["components"][2]["componentFrame"] = copy.deepcopy(
                value["components"][1]["componentFrame"]
            )
        case "socket geometry outside scale limits":
            value["components"][2]["componentFrame"]["referenceScale"] = 0.01
        case "socket geometry outside rotation limits":
            value["components"][2]["componentFrame"]["normal"] = {"x": 1.0, "y": 0.0}
        case "grip geometry outside scale limits":
            value["components"][1]["componentFrame"]["contacts"] = [
                {"x": 0.18, "y": 0.25},
                {"x": 0.18, "y": 0.3},
            ]
        case "grip geometry requires forbidden mirror":
            value["kits"][1]["mountFrames"][0]["constraints"]["mirrorAllowed"] = False
        case "grid edge outside certified surface":
            value["components"][0]["componentFrame"]["edgeTypes"] = {
                "north": "pk1-unsupported-edge"
            }
        case "grid footprint larger than surface":
            value["components"][0]["componentFrame"]["footprint"] = {
                "columns": 9,
                "rows": 3,
            }
        case "grid plane mismatch":
            value["components"][0]["componentFrame"]["plane"] = "floor"
        case "out-of-order component layers":
            value["components"][1]["fragments"].reverse()
        case "duplicate component layers":
            value["components"][1]["fragments"][1]["layer"] = "rear"
        case "unsorted component IDs":
            value["components"].reverse()
        case "duplicate component IDs":
            value["components"][1]["id"] = value["components"][0]["id"]
        case "unsorted certification IDs":
            value["certifications"].reverse()
        case "duplicate certification IDs":
            value["certifications"][1]["id"] = value["certifications"][0]["id"]
        case "unsorted grid edge types":
            value["kits"][0]["mountFrames"][0]["acceptedEdgeTypes"].reverse()
        case "duplicate grid edge types":
            value["kits"][0]["mountFrames"][0]["acceptedEdgeTypes"] = [
                "pk1-panel",
                "pk1-panel",
            ]
        case "wrong catalogue pack":
            context["catalogPackId"] = "another-pack"
        case "wrong catalogue hash":
            context["catalogSha256"] = "0" * 64
        case "duplicate context record IDs":
            context["records"].append(copy.deepcopy(context["records"][0]))
        case "unknown raster asset":
            value["kits"][0]["base"]["assetId"] = "asset-missing"
        case "stale raster hash":
            value["kits"][0]["base"]["masterSha256"] = "0" * 64
        case "unreviewed raster":
            context["records"][0]["classroomReviewed"] = False
        case "branded raster":
            context["records"][0]["brandFree"] = False
        case "non-offline raster":
            context["records"][0]["delivery"] = "live-photo"
        case "disallowed raster kind":
            context["records"][0]["kind"] = "photo"
        case "noncanonical raster path":
            context["records"][0]["files"]["master"] = (
                "/catalog/generated/offline-core-v1/assets/asset-grid-base/master.svg"
            )
        case "trim/catalogue dimension drift":
            value["kits"][0]["base"]["frame"]["trimWidth"] = 99
        case _:
            raise AssertionError(f"unknown graph case: {name}")


def test_accepts_valid_four_mode_catalogue_and_emits_exact_canonical_camel_case_bytes() -> None:
    contract = _contract()
    value = catalogue_fixture()
    context = context_fixture()
    before = copy.deepcopy((value, context))

    parsed = contract.parse_product_kit_catalogue(value, context)

    assert isinstance(parsed, contract.ProductKitCatalogue)
    assert [kit.mode for kit in parsed.kits] == ["grid", "grip", "socket", "whole"]
    assert [fragment.layer for fragment in parsed.components[1].fragments] == ["rear", "front"]
    assert parsed.catalog_pack_id == "offline-core-v1"
    assert (value, context) == before

    expected = (
        json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    ).encode("utf-8")
    encoded = contract.canonical_json_bytes(parsed)
    assert encoded == expected
    assert contract.canonical_json_bytes(parsed) == encoded
    assert b'"catalogPackId":"offline-core-v1"' in encoded
    assert b"catalog_pack_id" not in encoded
    assert encoded.endswith(b"\n")
    assert not encoded.startswith(b"\xef\xbb\xbf")


@pytest.mark.parametrize("case", SYNTAX_CASES)
def test_rejects_strict_browser_syntax_cases(case: str) -> None:
    contract = _contract()
    value = catalogue_fixture()
    context = context_fixture()
    _apply_syntax_case(case, value, context)

    assert contract.parse_product_kit_catalogue(value, context) is None, case


@pytest.mark.parametrize("case", GRAPH_CASES)
def test_rejects_browser_graph_and_binding_cases(case: str) -> None:
    contract = _contract()
    value = catalogue_fixture()
    context = context_fixture()
    _apply_graph_case(case, value, context)

    assert contract.parse_product_kit_catalogue(value, context) is None, case


def test_accepts_tiny_positive_socket_and_grip_geometry_without_absolute_epsilon_cutoffs() -> None:
    contract = _contract()
    value = catalogue_fixture()

    socket_mount = value["kits"][2]["mountFrames"][0]
    socket_component = value["components"][2]["componentFrame"]
    socket_mount.update({"normal": {"x": 1e-10, "y": 0.0}, "referenceScale": 1e-10})
    socket_component.update({"normal": {"x": 1e-10, "y": 0.0}, "referenceScale": 1e-10})

    grip_mount = value["kits"][1]["mountFrames"][0]
    grip_component = value["components"][1]["componentFrame"]
    tiny_contacts = [{"x": 0.0, "y": 0.0}, {"x": 1e-10, "y": 0.0}]
    tiny_normals = [{"x": 0.0, "y": -1e-10}, {"x": 0.0, "y": -1e-10}]
    grip_mount.update(
        {
            "contacts": copy.deepcopy(tiny_contacts),
            "normals": copy.deepcopy(tiny_normals),
            "constraints": {**CONSTRAINTS, "mirrorAllowed": False},
        }
    )
    grip_component.update(
        {"contacts": copy.deepcopy(tiny_contacts), "normals": copy.deepcopy(tiny_normals)}
    )

    assert contract.parse_product_kit_catalogue(value, context_fixture()) is not None


def test_accepts_integral_decimal_json_numbers_like_browser_and_json_schema() -> None:
    contract = _contract()
    value = catalogue_fixture()
    value["version"] = 1.0
    value["kits"][0]["mountFrames"][0]["columns"] = 8.0
    value["kits"][0]["base"]["frame"]["originalWidth"] = 100.0

    parsed = contract.parse_product_kit_catalogue(value, context_fixture())

    assert parsed is not None
    assert parsed.version == 1
    assert parsed.kits[0].mount_frames[0].columns == 8
    assert parsed.kits[0].base.frame.original_width == 100


@pytest.mark.parametrize(
    "path",
    [
        ("kits", 0, "mountFrames", 0, "origin", "x"),
        ("kits", 2, "mountFrames", 0, "normal", "x"),
        ("kits", 2, "mountFrames", 0, "constraints", "maxNormalErrorDegrees"),
        ("kits", 0, "base", "frame", "trimX"),
    ],
)
def test_rejects_signed_zero_before_float_or_json_integer_coercion(
    path: tuple[str | int, ...],
) -> None:
    contract = _contract()
    value = catalogue_fixture()
    _set_path(value, path, -0.0)

    assert contract.parse_product_kit_catalogue(value, context_fixture()) is None


@pytest.mark.parametrize(
    ("path", "changed_value"),
    [
        (("packId",), "pk1-pilot\n"),
        (("catalogSha256",), f"{CATALOGUE_SHA}\n"),
    ],
)
def test_rejects_terminal_lf_in_ids_and_hashes(
    path: tuple[str | int, ...],
    changed_value: str,
) -> None:
    contract = _contract()
    value = catalogue_fixture()
    _set_path(value, path, changed_value)

    assert contract.parse_product_kit_catalogue(value, context_fixture()) is None


def test_exact_oblique_grip_alignment_passes_at_zero_normal_tolerance() -> None:
    contract = _contract()
    value = catalogue_fixture()
    grip_mount = value["kits"][1]["mountFrames"][0]
    grip_component = value["components"][1]["componentFrame"]
    common_contacts = [{"x": 0.1, "y": 0.2}, {"x": 0.8, "y": 0.7}]
    common_normals = [{"x": 1.0, "y": 1.0}, {"x": 1.0, "y": 1.0}]
    grip_mount.update(
        {
            "contacts": copy.deepcopy(common_contacts),
            "normals": copy.deepcopy(common_normals),
            "constraints": {
                **CONSTRAINTS,
                "mirrorAllowed": False,
                "maxNormalErrorDegrees": 0.0,
            },
        }
    )
    grip_component.update(
        {
            "contacts": copy.deepcopy(common_contacts),
            "normals": copy.deepcopy(common_normals),
        }
    )

    assert contract.parse_product_kit_catalogue(value, context_fixture()) is not None


def test_does_not_erase_genuine_tiny_socket_or_grip_angle_mismatches() -> None:
    contract = _contract()

    socket_value = catalogue_fixture()
    socket_mount = socket_value["kits"][2]["mountFrames"][0]
    socket_component = socket_value["components"][2]["componentFrame"]
    socket_mount.update(
        {
            "normal": {"x": -1.0, "y": 1e-16},
            "constraints": {
                **CONSTRAINTS,
                "minRotationDegrees": 0.0,
                "maxRotationDegrees": 0.0,
                "maxNormalErrorDegrees": 0.0,
            },
        }
    )
    socket_component["normal"] = {"x": -1.0, "y": -1e-16}
    assert contract.parse_product_kit_catalogue(socket_value, context_fixture()) is None

    grip_value = catalogue_fixture()
    grip_mount = grip_value["kits"][1]["mountFrames"][0]
    grip_component = grip_value["components"][1]["componentFrame"]
    common_contacts = [{"x": 0.0, "y": 0.0}, {"x": 1.0, "y": 0.0}]
    grip_mount.update(
        {
            "contacts": copy.deepcopy(common_contacts),
            "normals": [{"x": 1.0, "y": 0.0}, {"x": 1.0, "y": 0.0}],
            "constraints": {
                **CONSTRAINTS,
                "mirrorAllowed": False,
                "maxNormalErrorDegrees": 0.0,
            },
        }
    )
    grip_component.update(
        {
            "contacts": copy.deepcopy(common_contacts),
            "normals": [
                {"x": 1.0, "y": 1e-16},
                {"x": 1.0, "y": 1e-16},
            ],
        }
    )
    assert contract.parse_product_kit_catalogue(grip_value, context_fixture()) is None


def test_model_classes_are_alias_only_strict_and_context_is_independently_validated() -> None:
    contract = _contract()
    catalogue = contract.ProductKitCatalogue.model_validate(catalogue_fixture())
    context = contract.ProductKitCatalogueContext.model_validate(context_fixture())

    assert catalogue.catalog_pack_id == context.catalog_pack_id
    with pytest.raises(ValidationError):
        contract.ProductKitCatalogue.model_validate(
            {**catalogue_fixture(), "catalogPackId": None}
        )
    with pytest.raises(ValidationError):
        contract.ProductKitCatalogueContext.model_validate(
            {**context_fixture(), "records": "not-an-array"}
        )


def test_validation_revalidates_mutated_model_instances_and_detaches_valid_models() -> None:
    contract = _contract()
    original = contract.validate_product_kit_catalogue(
        catalogue_fixture(), context_fixture()
    )
    context = contract.ProductKitCatalogueContext.model_validate(context_fixture())
    valid_clone = contract.validate_product_kit_catalogue(original, context)

    assert valid_clone is not original
    invalid_version = original.model_copy(update={"version": 2})
    assert contract.parse_product_kit_catalogue(invalid_version, context) is None

    invalid_nested = original.model_copy(deep=True)
    invalid_nested.kits.clear()
    assert contract.parse_product_kit_catalogue(invalid_nested, context) is None

    invalid_extra = original.model_copy(update={"unexpected": True})
    assert contract.parse_product_kit_catalogue(invalid_extra, context) is None

    invalid_explicit_null = original.model_copy(deep=True)
    edge_types = invalid_explicit_null.components[0].component_frame.edge_types
    object.__setattr__(edge_types, "north", None)
    assert "north" in edge_types.__pydantic_fields_set__
    assert contract.parse_product_kit_catalogue(invalid_explicit_null, context) is None

    invalid_omitted_field = original.model_copy(deep=True)
    omitted_edges = invalid_omitted_field.components[0].component_frame.edge_types
    assert "east" not in omitted_edges.__pydantic_fields_set__
    object.__setattr__(omitted_edges, "east", "not-a-product-kit-id")
    assert contract.parse_product_kit_catalogue(invalid_omitted_field, context) is None

    invalid_valid_omitted_field = original.model_copy(deep=True)
    valid_omitted_edges = (
        invalid_valid_omitted_field.components[0].component_frame.edge_types
    )
    assert "east" not in valid_omitted_edges.__pydantic_fields_set__
    object.__setattr__(valid_omitted_edges, "east", "pk1-panel")
    assert (
        contract.parse_product_kit_catalogue(invalid_valid_omitted_field, context)
        is None
    )

    invalid_deleted_optional = original.model_copy(deep=True)
    deleted_edges = invalid_deleted_optional.components[0].component_frame.edge_types
    assert "east" not in deleted_edges.__pydantic_fields_set__
    object.__delattr__(deleted_edges, "east")
    assert contract.parse_product_kit_catalogue(invalid_deleted_optional, context) is None

    cyclic_extra: list[object] = []
    cyclic_extra.append(cyclic_extra)
    invalid_cycle = original.model_copy(update={"unexpected": cyclic_extra})
    assert contract.parse_product_kit_catalogue(invalid_cycle, context) is None

    deeply_nested_extra: object = []
    for _ in range(1_500):
        deeply_nested_extra = [deeply_nested_extra]
    invalid_depth = original.model_copy(update={"unexpected": deeply_nested_extra})
    assert contract.parse_product_kit_catalogue(invalid_depth, context) is None

    invalid_required_fields_set = original.model_copy(deep=True)
    invalid_required_fields_set.__pydantic_fields_set__.discard("version")
    assert (
        contract.parse_product_kit_catalogue(invalid_required_fields_set, context)
        is None
    )

    invalid_unknown_fields_set = original.model_copy(deep=True)
    invalid_unknown_fields_set.__pydantic_fields_set__.add("unexpected")
    assert contract.parse_product_kit_catalogue(invalid_unknown_fields_set, context) is None

    class InternalStringKey(str):
        pass

    invalid_fields_set_key = original.model_copy(deep=True)
    invalid_fields_set_key.__pydantic_fields_set__.remove("version")
    invalid_fields_set_key.__pydantic_fields_set__.add(InternalStringKey("version"))
    assert contract.parse_product_kit_catalogue(invalid_fields_set_key, context) is None

    invalid_model_dict_key = original.model_copy(deep=True)
    schema_value = invalid_model_dict_key.__dict__.pop("schema_id")
    invalid_model_dict_key.__dict__[InternalStringKey("schema_id")] = schema_value
    assert contract.parse_product_kit_catalogue(invalid_model_dict_key, context) is None

    invalid_private_state = original.model_copy(deep=True)
    object.__setattr__(invalid_private_state, "__pydantic_private__", {"hidden": True})
    assert contract.parse_product_kit_catalogue(invalid_private_state, context) is None

    class FalseyState(dict[str, object]):
        def __bool__(self) -> bool:
            return False

    invalid_falsey_private = original.model_copy(deep=True)
    object.__setattr__(
        invalid_falsey_private,
        "__pydantic_private__",
        FalseyState({"hidden": True}),
    )
    assert contract.parse_product_kit_catalogue(invalid_falsey_private, context) is None

    invalid_falsey_extra = original.model_copy(deep=True)
    object.__setattr__(
        invalid_falsey_extra,
        "__pydantic_extra__",
        FalseyState({"unexpected": True}),
    )
    assert contract.parse_product_kit_catalogue(invalid_falsey_extra, context) is None

    class EvilString(str):
        def __eq__(self, other: object) -> bool:
            return str(self) == str(other)

    invalid_scalar_subclass = original.model_copy(deep=True)
    object.__setattr__(
        invalid_scalar_subclass,
        "pack_id",
        EvilString(original.pack_id),
    )
    assert contract.parse_product_kit_catalogue(invalid_scalar_subclass, context) is None

    class CatalogueSubclass(contract.ProductKitCatalogue):
        pass

    invalid_model_subclass = CatalogueSubclass.model_validate(catalogue_fixture())
    assert contract.parse_product_kit_catalogue(invalid_model_subclass, context) is None

    invalid_nested_mapping = original.model_copy(deep=True)
    invalid_nested_mapping.kits[0] = invalid_nested_mapping.kits[0].model_dump(
        by_alias=True
    )  # type: ignore[assignment]
    assert contract.parse_product_kit_catalogue(invalid_nested_mapping, context) is None

    invalid_model_number = original.model_copy(deep=True)
    object.__setattr__(invalid_model_number, "version", 1.0)
    assert contract.parse_product_kit_catalogue(invalid_model_number, context) is None

    invalid_nested_model_type = original.model_copy(deep=True)
    socket_frame = invalid_nested_model_type.kits[2].mount_frames[0]
    wrong_point_model = contract.Normal.model_validate({"x": 0.5, "y": 0.08})
    object.__setattr__(socket_frame, "point", wrong_point_model)
    assert contract.parse_product_kit_catalogue(invalid_nested_model_type, context) is None

    raw_model_hybrid = catalogue_fixture()
    raw_model_hybrid["kits"][2]["mountFrames"][0]["point"] = (
        contract.Point.model_validate({"x": 0.5, "y": 0.08})
    )
    assert contract.parse_product_kit_catalogue(
        raw_model_hybrid,
        context_fixture(),
    ) is None

    class EqualToNone:
        def __eq__(self, other: object) -> bool:
            return other is None

    invalid_equal_default = original.model_copy(deep=True)
    equal_default_edges = invalid_equal_default.components[0].component_frame.edge_types
    object.__setattr__(equal_default_edges, "east", EqualToNone())
    assert contract.parse_product_kit_catalogue(invalid_equal_default, context) is None

    class EqualityExplosion:
        def __eq__(self, _other: object) -> bool:
            raise RuntimeError("equality must not run at the parser boundary")

    invalid_exploding_default = original.model_copy(deep=True)
    exploding_edges = invalid_exploding_default.components[0].component_frame.edge_types
    object.__setattr__(exploding_edges, "east", EqualityExplosion())
    assert contract.parse_product_kit_catalogue(invalid_exploding_default, context) is None

    from decimal import Decimal

    invalid_decimal = catalogue_fixture()
    invalid_decimal["kits"][2]["mountFrames"][0]["point"]["x"] = Decimal("0.5")
    assert contract.parse_product_kit_catalogue(invalid_decimal, context_fixture()) is None

    class StringKey(str):
        pass

    invalid_key = catalogue_fixture()
    invalid_key[StringKey("schema")] = invalid_key.pop("schema")
    assert contract.parse_product_kit_catalogue(invalid_key, context_fixture()) is None
