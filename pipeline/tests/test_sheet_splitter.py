from __future__ import annotations

import hashlib
import time
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

from asset_pipeline.chroma import cie76_distance
from asset_pipeline.schema import AssetSheet
from asset_pipeline.sheet_splitter import SheetSplitError, split_sheet


GREEN = (0, 255, 0, 255)
RED = (220, 20, 30, 255)


def save_sheet(path: Path, image: Image.Image) -> str:
    image.save(path, compress_level=9, optimize=False)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def spec(source_hash: str, output_ids: list[str], **overrides) -> AssetSheet:
    value = {
        "schema": "asset-sheet@1",
        "sheetId": "fixture-sheet",
        "sourceSha256": source_hash,
        "chromaRgb": [0, 255, 0],
        "colourDistanceFormula": "cie76-srgb-d65",
        "threshold": 2.0,
        "alphaCutoff": 8,
        "componentAreaFloor": 4,
        "padding": 0,
        "gutter": 2,
        "expectedComponentCount": len(output_ids),
        "outputIds": output_ids,
    }
    value.update(overrides)
    return AssetSheet.model_validate(value, strict=True)


def test_cie76_uses_the_frozen_srgb_d65_formula():
    assert cie76_distance((0, 255, 0), (0, 255, 0)) == pytest.approx(0.0)
    assert cie76_distance((0, 0, 0), (255, 255, 255)) == pytest.approx(100.0, abs=0.02)
    assert cie76_distance((255, 0, 0), (0, 255, 0)) == pytest.approx(170.565, abs=0.02)


def test_splitter_maps_spatial_components_to_explicit_ids_and_preserves_special_pixels(tmp_path: Path):
    image = Image.new("RGBA", (24, 14), GREEN)
    draw = ImageDraw.Draw(image)
    draw.rectangle((2, 2, 6, 7), fill=RED)
    image.putpixel((4, 4), GREEN)  # enclosed product pixel, not border-connected background
    image.putpixel((3, 3), (0, 0, 0, 0))  # authored transparent hole
    draw.rectangle((14, 3, 19, 8), fill=(20, 80, 220, 255))
    draw.rectangle((16, 9, 19, 9), fill=(70, 70, 70, 80))  # connected soft shadow
    image.putpixel((11, 12), RED)  # dust below component-area floor
    source = tmp_path / "sheet.png"
    source_hash = save_sheet(source, image)

    components = split_sheet(source, spec(source_hash, ["first-object", "second-object"]), tmp_path / "out")

    assert [component.asset_id for component in components] == ["first-object", "second-object"]
    assert [component.source_bounds for component in components] == [(2, 2, 7, 8), (14, 3, 20, 10)]
    with Image.open(components[0].path) as first:
        assert first.mode == "RGBA"
        assert first.getpixel((4, 4))[3] == 255  # source (4,4) plus two-pixel gutter
        assert first.getpixel((3, 3))[3] == 0
    with Image.open(components[1].path) as second:
        assert second.getpixel((4, 8))[3] == 80


def test_enclosed_chroma_pixels_can_be_the_only_bridge_inside_one_object(tmp_path: Path):
    image = Image.new("RGBA", (12, 10), GREEN)
    draw = ImageDraw.Draw(image)
    draw.rectangle((2, 4, 3, 5), fill=RED)
    draw.rectangle((6, 4, 7, 5), fill=(0, 0, 255, 255))
    draw.rectangle((4, 4, 5, 4), fill=GREEN)
    for point in [(3, 3), (4, 3), (5, 3), (6, 3), (4, 5), (5, 5)]:
        image.putpixel(point, (0, 0, 0, 0))
    source = tmp_path / "enclosed-bridge.png"
    source_hash = save_sheet(source, image)

    components = split_sheet(source, spec(source_hash, ["bridged-object"]), tmp_path / "bridge-out")

    assert [component.source_bounds for component in components] == [(2, 4, 8, 6)]
    with Image.open(components[0].path) as output:
        assert output.getpixel((4, 2))[3] == 255


def test_splitter_rejects_fused_diagonal_components_padding_collisions_and_edge_clips(tmp_path: Path):
    diagonal = Image.new("RGBA", (12, 12), GREEN)
    ImageDraw.Draw(diagonal).rectangle((2, 2, 4, 4), fill=RED)
    ImageDraw.Draw(diagonal).rectangle((5, 5, 7, 7), fill=RED)
    diagonal_path = tmp_path / "diagonal.png"
    diagonal_hash = save_sheet(diagonal_path, diagonal)
    with pytest.raises(SheetSplitError, match="expected 2"):
        split_sheet(diagonal_path, spec(diagonal_hash, ["one", "two"]), tmp_path / "diagonal-out")

    close = Image.new("RGBA", (16, 10), GREEN)
    ImageDraw.Draw(close).rectangle((2, 2, 4, 6), fill=RED)
    ImageDraw.Draw(close).rectangle((7, 2, 9, 6), fill=(0, 0, 255, 255))
    close_path = tmp_path / "close.png"
    close_hash = save_sheet(close_path, close)
    with pytest.raises(SheetSplitError, match="padding"):
        split_sheet(close_path, spec(close_hash, ["one", "two"], padding=2), tmp_path / "close-out")

    edge = Image.new("RGBA", (10, 10), GREEN)
    ImageDraw.Draw(edge).rectangle((0, 2, 3, 5), fill=RED)
    edge_path = tmp_path / "edge.png"
    edge_hash = save_sheet(edge_path, edge)
    with pytest.raises(SheetSplitError, match="edge"):
        split_sheet(edge_path, spec(edge_hash, ["edge-object"]), tmp_path / "edge-out")


def test_splitter_rejects_hash_mismatch_and_nonempty_output_without_touching_sentinel(tmp_path: Path):
    image = Image.new("RGBA", (10, 10), GREEN)
    ImageDraw.Draw(image).rectangle((2, 2, 5, 5), fill=RED)
    source = tmp_path / "sheet.png"
    source_hash = save_sheet(source, image)

    with pytest.raises(SheetSplitError, match="hash"):
        split_sheet(source, spec("0" * 64, ["object"]), tmp_path / "hash-out")

    output = tmp_path / "existing"
    output.mkdir()
    sentinel = output / "keep.txt"
    sentinel.write_bytes(b"do not change")
    with pytest.raises(SheetSplitError, match="empty"):
        split_sheet(source, spec(source_hash, ["object"]), output)
    assert sentinel.read_bytes() == b"do not change"


def test_sparse_maximum_sheet_benchmark_is_bounded(tmp_path: Path):
    image = Image.new("RGBA", (4096, 4096), GREEN)
    ImageDraw.Draw(image).rectangle((2040, 2040, 2055, 2055), fill=RED)
    source = tmp_path / "maximum.png"
    source_hash = save_sheet(source, image)

    started = time.perf_counter()
    result = split_sheet(source, spec(source_hash, ["centre"]), tmp_path / "maximum-out")

    assert len(result) == 1
    assert time.perf_counter() - started < 8.0
