"""Fail-closed writer for versioned ``product-kit@1`` catalogue files."""

from __future__ import annotations

import os
from os import PathLike
from pathlib import Path
from typing import Any, BinaryIO
from uuid import uuid4

from .schema import canonical_json_bytes, validate_product_kit_catalogue


def _temporary_path(destination: Path) -> Path:
    return destination.with_name(f".{destination.name}.{uuid4().hex}.tmp")


def _write_payload(stream: BinaryIO, payload: bytes) -> None:
    written = stream.write(payload)
    if written != len(payload):
        raise OSError(
            f"short product-kit temporary write: {written} of {len(payload)} bytes"
        )
    stream.flush()
    os.fsync(stream.fileno())


def _replace_file(source: Path, destination: Path) -> None:
    """Atomically publish ``source`` without ever replacing ``destination``."""

    if os.name == "nt":
        os.rename(source, destination)
        return

    linked = False
    try:
        os.link(source, destination)
        linked = True
        source.unlink()
    except BaseException:
        if linked:
            destination.unlink(missing_ok=True)
        raise


def write_product_kit_pack(
    value: Any,
    context: Any,
    destination: str | PathLike[str],
) -> Path:
    """Validate and write one canonical product-kit catalogue."""

    parsed = validate_product_kit_catalogue(value, context)
    output_path = Path(destination)
    if not output_path.parent.is_dir():
        raise FileNotFoundError(
            f"product-kit destination parent does not exist: {output_path.parent}"
        )
    if os.path.lexists(output_path):
        raise FileExistsError(
            f"product-kit destination already exists: {output_path}"
        )
    payload = canonical_json_bytes(parsed)
    temporary_path = _temporary_path(output_path)
    temporary_created = False
    try:
        with temporary_path.open("xb") as stream:
            temporary_created = True
            _write_payload(stream, payload)
        if os.path.lexists(output_path):
            raise FileExistsError(
                f"product-kit destination already exists: {output_path}"
            )
        _replace_file(temporary_path, output_path)
    except BaseException:
        if temporary_created:
            temporary_path.unlink(missing_ok=True)
        raise
    return output_path


__all__ = ["write_product_kit_pack"]
