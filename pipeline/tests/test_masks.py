from __future__ import annotations

from pathlib import Path

import pytest
from PIL import Image

from asset_pipeline.masks import MaskValidationError, prepare_masks


def save_mask(path: Path, size: tuple[int, int], covered: set[tuple[int, int]], mode="L") -> Path:
    image = Image.new(mode, size, 0 if mode == "L" else (0, 0, 0))
    for point in covered:
        image.putpixel(point, 255 if mode == "L" else (255, 255, 255))
    image.save(path)
    return path


def test_exact_two_percent_overlap_is_clipped_by_zone_precedence(tmp_path: Path):
    master = tmp_path / "master.png"
    Image.new("RGBA", (10, 10), (100, 100, 100, 255)).save(master)
    body = save_mask(tmp_path / "body.png", (10, 10), {(x, y) for x in range(10) for y in range(10)})
    label = save_mask(tmp_path / "label.png", (10, 10), {(0, 0), (1, 0)}, mode="RGB")

    output = prepare_masks(master, {"body": body, "label": label}, ["body", "label"], tmp_path / "out")

    assert list(output) == ["body", "label"]
    for path in output.values():
        with Image.open(path) as mask:
            assert mask.mode == "RGBA"
            assert mask.size == (10, 10)
    with Image.open(output["body"]) as body_result, Image.open(output["label"]) as label_result:
        assert body_result.getpixel((0, 0))[3] == 0
        assert label_result.getpixel((0, 0))[3] == 255


def test_overlap_above_two_percent_is_rejected(tmp_path: Path):
    master = tmp_path / "master.png"
    Image.new("RGBA", (10, 10), "white").save(master)
    all_pixels = {(x, y) for x in range(10) for y in range(10)}
    body = save_mask(tmp_path / "body.png", (10, 10), all_pixels)
    label = save_mask(tmp_path / "label.png", (10, 10), {(0, 0), (1, 0), (2, 0)})

    with pytest.raises(MaskValidationError, match="2 percent"):
        prepare_masks(master, {"body": body, "label": label}, ["body", "label"], tmp_path / "out")


def test_masks_must_match_master_visibility_dimensions_and_declared_zones(tmp_path: Path):
    master = tmp_path / "master.png"
    image = Image.new("RGBA", (4, 4), (80, 80, 80, 255))
    image.putpixel((3, 3), (0, 0, 0, 0))
    image.save(master)

    outside = save_mask(tmp_path / "outside.png", (4, 4), {(3, 3)})
    with pytest.raises(MaskValidationError, match="visible master"):
        prepare_masks(master, {"body": outside}, ["body"], tmp_path / "outside-out")

    wrong_size = save_mask(tmp_path / "wrong.png", (3, 4), {(0, 0)})
    with pytest.raises(MaskValidationError, match="dimensions"):
        prepare_masks(master, {"body": wrong_size}, ["body"], tmp_path / "size-out")

    valid = save_mask(tmp_path / "valid.png", (4, 4), {(0, 0)})
    with pytest.raises(MaskValidationError, match="exactly"):
        prepare_masks(master, {"body": valid}, ["trim"], tmp_path / "zone-out")


def test_nonempty_mask_output_is_refused_without_touching_existing_files(tmp_path: Path):
    master = tmp_path / "master.png"
    Image.new("RGBA", (2, 2), "white").save(master)
    body = save_mask(tmp_path / "body.png", (2, 2), {(0, 0)})
    output = tmp_path / "existing"
    output.mkdir()
    sentinel = output / "keep.txt"
    sentinel.write_bytes(b"unchanged")

    with pytest.raises(MaskValidationError, match="empty"):
        prepare_masks(master, {"body": body}, ["body"], output)
    assert sentinel.read_bytes() == b"unchanged"
