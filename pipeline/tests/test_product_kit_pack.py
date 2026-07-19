from __future__ import annotations

import importlib
import json
from pathlib import Path
from types import ModuleType
from typing import Any

import pytest
from pydantic import ValidationError

from pipeline.product_kit.schema import (
    ProductKitCatalogueContext,
    canonical_json_bytes,
    validate_product_kit_catalogue,
)


REPO_ROOT = Path(__file__).resolve().parents[2]


def _pack() -> ModuleType:
    try:
        module = importlib.import_module("pipeline.product_kit.pack")
    except ModuleNotFoundError:
        pytest.fail("product_kit.pack has not been implemented")
    assert hasattr(module, "write_product_kit_pack")
    return module


def _valid_contract() -> tuple[dict[str, Any], dict[str, Any]]:
    corpus = json.loads(
        (REPO_ROOT / "catalog" / "schemas" / "product-kit-v1.corpus.json").read_text(
            encoding="utf-8"
        )
    )
    return corpus["valid"][0]["value"], corpus["context"]


def test_writes_exact_canonical_bytes_to_new_versioned_destination(
    tmp_path: Path,
) -> None:
    module = _pack()
    value, context = _valid_contract()
    destination = tmp_path / "product-kit-v1.json"

    result = module.write_product_kit_pack(value, context, destination)

    assert result == destination
    expected = canonical_json_bytes(validate_product_kit_catalogue(value, context))
    assert destination.read_bytes() == expected
    assert list(tmp_path.iterdir()) == [destination]


def test_rejects_invalid_manifest_before_creating_any_file(tmp_path: Path) -> None:
    module = _pack()
    value, context = _valid_contract()
    value["schema"] = "product-kit@2"
    destination = tmp_path / "product-kit-v1.json"

    with pytest.raises(ValidationError):
        module.write_product_kit_pack(value, context, destination)

    assert destination.exists() is False
    assert list(tmp_path.iterdir()) == []


def test_requires_an_existing_parent_directory(tmp_path: Path) -> None:
    module = _pack()
    value, context = _valid_contract()
    missing_parent = tmp_path / "missing"
    destination = missing_parent / "product-kit-v1.json"

    with pytest.raises(FileNotFoundError):
        module.write_product_kit_pack(value, context, destination)

    assert missing_parent.exists() is False


def test_refuses_to_overwrite_an_existing_destination(tmp_path: Path) -> None:
    module = _pack()
    value, context = _valid_contract()
    destination = tmp_path / "product-kit-v1.json"
    destination.write_bytes(b"keep-existing\n")

    with pytest.raises(FileExistsError):
        module.write_product_kit_pack(value, context, destination)

    assert destination.read_bytes() == b"keep-existing\n"
    assert list(tmp_path.iterdir()) == [destination]


def test_exclusively_creates_the_sibling_temporary_file(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _pack()
    value, context = _valid_contract()
    destination = tmp_path / "product-kit-v1.json"
    occupied_temporary = tmp_path / ".product-kit-v1.json.occupied.tmp"
    occupied_temporary.write_bytes(b"foreign-temporary\n")
    monkeypatch.setattr(
        module,
        "_temporary_path",
        lambda _destination: occupied_temporary,
        raising=False,
    )

    with pytest.raises(FileExistsError):
        module.write_product_kit_pack(value, context, destination)

    assert destination.exists() is False
    assert occupied_temporary.read_bytes() == b"foreign-temporary\n"


def test_simulated_partial_write_leaves_no_output_or_temporary_residue(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _pack()
    value, context = _valid_contract()
    destination = tmp_path / "product-kit-v1.json"

    def fail_after_partial_write(stream: Any, payload: bytes) -> None:
        assert Path(stream.name).parent == destination.parent
        assert Path(stream.name) != destination
        stream.write(payload[:17])
        raise OSError("simulated write failure")

    monkeypatch.setattr(
        module,
        "_write_payload",
        fail_after_partial_write,
        raising=False,
    )

    with pytest.raises(OSError, match="simulated write failure"):
        module.write_product_kit_pack(value, context, destination)

    assert destination.exists() is False
    assert list(tmp_path.iterdir()) == []


def test_simulated_atomic_replace_failure_removes_the_complete_temporary_file(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _pack()
    value, context = _valid_contract()
    destination = tmp_path / "product-kit-v1.json"

    def fail_replace(source: Path, target: Path) -> None:
        assert source.parent == destination.parent
        assert source.is_file()
        assert target == destination
        assert destination.exists() is False
        raise OSError("simulated replace failure")

    monkeypatch.setattr(module, "_replace_file", fail_replace, raising=False)

    with pytest.raises(OSError, match="simulated replace failure"):
        module.write_product_kit_pack(value, context, destination)

    assert destination.exists() is False
    assert list(tmp_path.iterdir()) == []


def test_never_overwrites_a_destination_created_during_atomic_publish(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _pack()
    value, context = _valid_contract()
    destination = tmp_path / "product-kit-v1.json"
    publish = module._replace_file

    def create_competing_destination_then_publish(source: Path, target: Path) -> None:
        target.write_bytes(b"competing-writer\n")
        publish(source, target)

    monkeypatch.setattr(
        module,
        "_replace_file",
        create_competing_destination_then_publish,
    )

    with pytest.raises(FileExistsError):
        module.write_product_kit_pack(value, context, destination)

    assert destination.read_bytes() == b"competing-writer\n"
    assert list(tmp_path.iterdir()) == [destination]


def test_simulated_fsync_failure_leaves_no_output_or_temporary_residue(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    module = _pack()
    value, context = _valid_contract()
    destination = tmp_path / "product-kit-v1.json"

    def fail_fsync(_file_descriptor: int) -> None:
        raise OSError("simulated fsync failure")

    monkeypatch.setattr(module.os, "fsync", fail_fsync)

    with pytest.raises(OSError, match="simulated fsync failure"):
        module.write_product_kit_pack(value, context, destination)

    assert destination.exists() is False
    assert list(tmp_path.iterdir()) == []


def test_revalidates_mutated_model_instances_before_any_write(tmp_path: Path) -> None:
    module = _pack()
    value, context_value = _valid_contract()
    parsed = validate_product_kit_catalogue(value, context_value)
    context = ProductKitCatalogueContext.model_validate(context_value)

    invalid_version = parsed.model_copy(update={"version": 2})
    version_destination = tmp_path / "invalid-version.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(invalid_version, context, version_destination)

    invalid_nested = parsed.model_copy(deep=True)
    invalid_nested.kits.clear()
    nested_destination = tmp_path / "invalid-nested.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(invalid_nested, context, nested_destination)

    invalid_extra = parsed.model_copy(update={"unexpected": True})
    extra_destination = tmp_path / "invalid-extra.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(invalid_extra, context, extra_destination)

    invalid_explicit_null = parsed.model_copy(deep=True)
    edge_types = invalid_explicit_null.components[0].component_frame.edge_types
    object.__setattr__(edge_types, "north", None)
    explicit_null_destination = tmp_path / "invalid-explicit-null.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_explicit_null,
            context,
            explicit_null_destination,
        )

    invalid_omitted_field = parsed.model_copy(deep=True)
    omitted_edges = invalid_omitted_field.components[0].component_frame.edge_types
    assert "east" not in omitted_edges.__pydantic_fields_set__
    object.__setattr__(omitted_edges, "east", "not-a-product-kit-id")
    omitted_field_destination = tmp_path / "invalid-omitted-field.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_omitted_field,
            context,
            omitted_field_destination,
        )

    invalid_valid_omitted_field = parsed.model_copy(deep=True)
    valid_omitted_edges = (
        invalid_valid_omitted_field.components[0].component_frame.edge_types
    )
    assert "east" not in valid_omitted_edges.__pydantic_fields_set__
    object.__setattr__(valid_omitted_edges, "east", "pk1-panel")
    valid_omitted_destination = tmp_path / "invalid-valid-omitted-field.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_valid_omitted_field,
            context,
            valid_omitted_destination,
        )

    invalid_deleted_optional = parsed.model_copy(deep=True)
    deleted_edges = invalid_deleted_optional.components[0].component_frame.edge_types
    assert "east" not in deleted_edges.__pydantic_fields_set__
    object.__delattr__(deleted_edges, "east")
    deleted_optional_destination = tmp_path / "invalid-deleted-optional.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_deleted_optional,
            context,
            deleted_optional_destination,
        )

    cyclic_extra: list[object] = []
    cyclic_extra.append(cyclic_extra)
    invalid_cycle = parsed.model_copy(update={"unexpected": cyclic_extra})
    cyclic_destination = tmp_path / "invalid-cycle.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(invalid_cycle, context, cyclic_destination)

    deeply_nested_extra: object = []
    for _ in range(1_500):
        deeply_nested_extra = [deeply_nested_extra]
    invalid_depth = parsed.model_copy(update={"unexpected": deeply_nested_extra})
    depth_destination = tmp_path / "invalid-depth.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(invalid_depth, context, depth_destination)

    invalid_required_fields_set = parsed.model_copy(deep=True)
    invalid_required_fields_set.__pydantic_fields_set__.discard("version")
    required_set_destination = tmp_path / "invalid-required-fields-set.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_required_fields_set,
            context,
            required_set_destination,
        )

    invalid_unknown_fields_set = parsed.model_copy(deep=True)
    invalid_unknown_fields_set.__pydantic_fields_set__.add("unexpected")
    unknown_set_destination = tmp_path / "invalid-unknown-fields-set.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_unknown_fields_set,
            context,
            unknown_set_destination,
        )

    invalid_private_state = parsed.model_copy(deep=True)
    object.__setattr__(invalid_private_state, "__pydantic_private__", {"hidden": True})
    private_destination = tmp_path / "invalid-private-state.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_private_state,
            context,
            private_destination,
        )

    class FalseyState(dict[str, object]):
        def __bool__(self) -> bool:
            return False

    invalid_falsey_private = parsed.model_copy(deep=True)
    object.__setattr__(
        invalid_falsey_private,
        "__pydantic_private__",
        FalseyState({"hidden": True}),
    )
    falsey_private_destination = tmp_path / "invalid-falsey-private.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_falsey_private,
            context,
            falsey_private_destination,
        )

    invalid_falsey_extra = parsed.model_copy(deep=True)
    object.__setattr__(
        invalid_falsey_extra,
        "__pydantic_extra__",
        FalseyState({"unexpected": True}),
    )
    falsey_extra_destination = tmp_path / "invalid-falsey-extra.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_falsey_extra,
            context,
            falsey_extra_destination,
        )

    class CatalogueSubclass(type(parsed)):
        pass

    invalid_model_subclass = CatalogueSubclass.model_validate(value)
    subclass_destination = tmp_path / "invalid-model-subclass.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_model_subclass,
            context,
            subclass_destination,
        )

    invalid_nested_mapping = parsed.model_copy(deep=True)
    invalid_nested_mapping.kits[0] = invalid_nested_mapping.kits[0].model_dump(
        by_alias=True
    )  # type: ignore[assignment]
    mapping_destination = tmp_path / "invalid-nested-mapping.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_nested_mapping,
            context,
            mapping_destination,
        )

    invalid_model_number = parsed.model_copy(deep=True)
    object.__setattr__(invalid_model_number, "version", 1.0)
    number_destination = tmp_path / "invalid-model-number.json"
    with pytest.raises(ValidationError):
        module.write_product_kit_pack(
            invalid_model_number,
            context,
            number_destination,
        )

    assert list(tmp_path.iterdir()) == []
