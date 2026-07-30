from __future__ import annotations

import hashlib
import struct
import zlib
from pathlib import Path

import pytest
from PIL import Image, ImageCms

from conftest import tree_digest
from asset_pipeline.normalize import NormalizationError, normalize_master


def png_header(width: int, height: int) -> bytes:
    payload = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    chunk = b"IHDR" + payload
    return b"\x89PNG\r\n\x1a\n" + struct.pack(">I", len(payload)) + chunk + struct.pack(">I", zlib.crc32(chunk))


def test_normalize_applies_exif_orientation_and_writes_metadata_free_rgba(tmp_path: Path):
    source = tmp_path / "rotated.jpg"
    image = Image.new("RGB", (20, 10), (220, 30, 30))
    exif = Image.Exif()
    exif[274] = 6
    image.save(source, quality=100, exif=exif)

    result = normalize_master(source, tmp_path / "out")

    with Image.open(result.master_path) as master:
        assert master.mode == "RGBA"
        assert master.size == (10, 20)
        assert "exif" not in master.info
        assert "icc_profile" not in master.info
    assert result.dimensions == (10, 20)
    assert result.master_sha256 == hashlib.sha256(result.master_path.read_bytes()).hexdigest()


def test_normalize_converts_valid_icc_and_cmyk_but_rejects_malformed_profiles(tmp_path: Path):
    valid = tmp_path / "profiled.jpg"
    profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
    Image.new("CMYK", (4, 3), (0, 180, 180, 0)).convert("RGB").save(valid, icc_profile=profile)
    result = normalize_master(valid, tmp_path / "valid-out")
    assert Image.open(result.master_path).mode == "RGBA"

    cmyk = tmp_path / "cmyk.jpg"
    Image.new("CMYK", (5, 2), (0, 120, 255, 10)).save(cmyk)
    assert normalize_master(cmyk, tmp_path / "cmyk-out").dimensions == (5, 2)

    malformed = tmp_path / "bad-profile.jpg"
    Image.new("RGB", (2, 2), "white").save(malformed, icc_profile=b"not-an-icc-profile")
    with pytest.raises(NormalizationError, match="ICC"):
        normalize_master(malformed, tmp_path / "bad-out")


def test_previews_never_upscale_and_use_frozen_floor_centering(tmp_path: Path):
    source = tmp_path / "tiny.png"
    Image.new("RGBA", (3, 1), (255, 0, 0, 255)).save(source)

    result = normalize_master(source, tmp_path / "out")

    for path, size, expected_box in [
        (result.thumbnail_path, 192, (94, 95, 97, 96)),
        (result.preview_path, 640, (318, 319, 321, 320)),
    ]:
        with Image.open(path) as preview:
            assert preview.mode == "RGBA"
            assert preview.size == (size, size)
            assert preview.getchannel("A").getbbox() == expected_box
            assert not preview.info.get("exif")
            assert not preview.info.get("icc_profile")


def test_normalization_is_byte_identical_in_different_absolute_roots(tmp_path: Path):
    source = tmp_path / "source.png"
    image = Image.new("RGBA", (17, 11), (80, 120, 220, 0))
    for x in range(2, 15):
        for y in range(1, 10):
            image.putpixel((x, y), (x * 10, y * 12, 180, 255))
    image.save(source, pnginfo=None)

    first = tmp_path / "root-a" / "nested" / "out"
    second = tmp_path / "a-completely-different-root" / "out"
    normalize_master(source, first)
    normalize_master(source, second)

    assert tree_digest(first) == tree_digest(second)
    assert [path.read_bytes() for path in sorted(first.iterdir())] == [
        path.read_bytes() for path in sorted(second.iterdir())
    ]


def test_normalize_rejects_corrupt_oversized_headers_and_encoded_files(tmp_path: Path):
    corrupt = tmp_path / "corrupt.png"
    corrupt.write_bytes(b"not an image")
    with pytest.raises(NormalizationError):
        normalize_master(corrupt, tmp_path / "corrupt-out")

    oversized_header = tmp_path / "oversized.png"
    oversized_header.write_bytes(png_header(8193, 1))
    with pytest.raises(NormalizationError, match="dimension"):
        normalize_master(oversized_header, tmp_path / "oversized-out")

    oversized_file = tmp_path / "encoded-too-large.bin"
    with oversized_file.open("wb") as handle:
        handle.truncate(64 * 1024 * 1024 + 1)
    with pytest.raises(NormalizationError, match="64 MiB"):
        normalize_master(oversized_file, tmp_path / "large-out")


def test_normalize_refuses_nonempty_output_without_touching_the_sentinel(tmp_path: Path):
    source = tmp_path / "source.png"
    Image.new("RGBA", (2, 2), "white").save(source)
    output = tmp_path / "existing"
    output.mkdir()
    sentinel = output / "keep.txt"
    sentinel.write_bytes(b"unchanged")

    with pytest.raises(NormalizationError, match="empty"):
        normalize_master(source, output)
    assert sentinel.read_bytes() == b"unchanged"
