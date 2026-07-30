"""Deterministic normalization for authored raster assets."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
from io import BytesIO
from pathlib import Path
import struct

from PIL import Image, ImageCms, ImageOps, UnidentifiedImageError


MAX_ENCODED_BYTES = 64 * 1024 * 1024
MAX_AXIS_PIXELS = 8_192
MAX_IMAGE_PIXELS = 64_000_000


class NormalizationError(ValueError):
    """Raised when a source cannot be normalized safely and deterministically."""


@dataclass(frozen=True, slots=True)
class NormalizationResult:
    """Paths and canonical identity produced for one normalized source."""

    master_path: Path
    thumbnail_path: Path
    preview_path: Path
    dimensions: tuple[int, int]
    master_sha256: str


def _validate_dimensions(
    width: int,
    height: int,
    *,
    max_axis_pixels: int = MAX_AXIS_PIXELS,
    max_image_pixels: int = MAX_IMAGE_PIXELS,
) -> None:
    if width < 1 or height < 1:
        raise NormalizationError("Image dimensions must be positive")
    if width > max_axis_pixels or height > max_axis_pixels:
        raise NormalizationError(
            f"Image dimension exceeds the {max_axis_pixels}-pixel axis limit"
        )
    if width * height > max_image_pixels:
        if max_image_pixels == MAX_IMAGE_PIXELS:
            raise NormalizationError("Image exceeds the 64 megapixel limit")
        raise NormalizationError(f"Image exceeds the {max_image_pixels}-pixel limit")


def _validate_png_header(
    source_path: Path,
    *,
    max_axis_pixels: int = MAX_AXIS_PIXELS,
    max_image_pixels: int = MAX_IMAGE_PIXELS,
) -> None:
    """Reject oversized PNG IHDR values even when the rest is truncated."""

    try:
        with source_path.open("rb") as source:
            header = source.read(24)
    except OSError as exc:
        raise NormalizationError(f"Cannot read source image: {source_path}") from exc

    if (
        len(header) == 24
        and header[:8] == b"\x89PNG\r\n\x1a\n"
        and header[8:12] == b"\x00\x00\x00\r"
        and header[12:16] == b"IHDR"
    ):
        _validate_dimensions(
            *struct.unpack(">II", header[16:24]),
            max_axis_pixels=max_axis_pixels,
            max_image_pixels=max_image_pixels,
        )


def _convert_to_canonical_rgba(image: Image.Image, icc_bytes: bytes | None) -> Image.Image:
    if icc_bytes is not None:
        try:
            source_profile = ImageCms.ImageCmsProfile(BytesIO(icc_bytes))
            target_profile = ImageCms.createProfile("sRGB")

            alpha = image.getchannel("A") if image.mode in {"RGBA", "LA"} else None
            if image.mode == "CMYK":
                colour_source = image
            else:
                colour_source = image.convert("RGB")

            converted = ImageCms.profileToProfile(
                colour_source,
                source_profile,
                target_profile,
                outputMode="RGB",
            ).convert("RGBA")
            if alpha is not None:
                converted.putalpha(alpha)
        except Exception as exc:
            raise NormalizationError("Embedded ICC profile is malformed or unusable") from exc
    elif image.mode == "CMYK":
        converted = image.convert("RGB").convert("RGBA")
    elif image.mode == "RGB":
        converted = image.convert("RGBA")
    elif image.mode == "RGBA":
        converted = image.copy()
    else:
        converted = image.convert("RGBA")

    # Pillow copies source metadata into many conversions.  The canonical image
    # deliberately carries pixels only, so encoders cannot re-emit EXIF or ICC.
    converted.info.clear()
    return converted


def load_canonical_rgba(
    source_path: str | Path,
    *,
    max_encoded_bytes: int = MAX_ENCODED_BYTES,
    max_axis_pixels: int = MAX_AXIS_PIXELS,
    max_image_pixels: int = MAX_IMAGE_PIXELS,
) -> Image.Image:
    """Decode one source with shared EXIF, ICC and metadata-free semantics."""

    source_path = Path(source_path)
    try:
        size = source_path.stat().st_size
    except OSError as exc:
        raise NormalizationError(f"Cannot read source image: {source_path}") from exc

    if size > max_encoded_bytes:
        if max_encoded_bytes % (1024 * 1024) == 0:
            limit = f"{max_encoded_bytes // (1024 * 1024)} MiB"
        else:
            limit = f"{max_encoded_bytes} bytes"
        raise NormalizationError(f"Encoded source exceeds the {limit} limit")

    _validate_png_header(
        source_path,
        max_axis_pixels=max_axis_pixels,
        max_image_pixels=max_image_pixels,
    )

    try:
        with Image.open(source_path) as source:
            # Image.open parses the header lazily; reject unreasonable dimensions
            # before asking the decoder to allocate the full pixel buffer.
            _validate_dimensions(
                *source.size,
                max_axis_pixels=max_axis_pixels,
                max_image_pixels=max_image_pixels,
            )
            icc_value = source.info.get("icc_profile")
            if icc_value is not None and not isinstance(icc_value, bytes):
                raise NormalizationError("Embedded ICC profile is malformed or unusable")

            source.load()
            oriented = ImageOps.exif_transpose(source)
            _validate_dimensions(
                *oriented.size,
                max_axis_pixels=max_axis_pixels,
                max_image_pixels=max_image_pixels,
            )
            return _convert_to_canonical_rgba(oriented, icc_value)
    except NormalizationError:
        raise
    except (
        Image.DecompressionBombError,
        UnidentifiedImageError,
        OSError,
        SyntaxError,
        ValueError,
    ) as exc:
        raise NormalizationError(f"Source is not a valid decodable image: {source_path}") from exc


def _aspect_fit(image: Image.Image, canvas_size: int) -> Image.Image:
    width, height = image.size
    if width <= canvas_size and height <= canvas_size:
        fitted = image.copy()
    else:
        scale = min(canvas_size / width, canvas_size / height)
        fitted_size = (
            max(1, min(canvas_size, round(width * scale))),
            max(1, min(canvas_size, round(height * scale))),
        )
        fitted = image.resize(fitted_size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    left = (canvas_size - fitted.width) // 2
    top = (canvas_size - fitted.height) // 2
    # Paste without a mask so RGB values beneath fully transparent source
    # pixels survive for the WebP encoder's exact-lossless mode.
    canvas.paste(fitted, (left, top))
    canvas.info.clear()
    return canvas


def _save_webp(image: Image.Image, path: Path) -> None:
    image.save(
        path,
        format="WEBP",
        lossless=True,
        quality=100,
        alpha_quality=100,
        method=6,
        exact=True,
    )


def normalize_master(source_path: str | Path, output_dir: str | Path) -> NormalizationResult:
    """Normalize one raster source and write its fixed master and previews."""

    source = Path(source_path)
    destination = Path(output_dir)
    if destination.exists():
        try:
            if not destination.is_dir() or next(destination.iterdir(), None) is not None:
                raise NormalizationError("Normalization output directory must be empty")
        except OSError as exc:
            raise NormalizationError(f"Cannot inspect normalization output: {destination}") from exc
    canonical = load_canonical_rgba(source)

    try:
        destination.mkdir(parents=True, exist_ok=True)
        master_path = destination / "master.png"
        thumbnail_path = destination / "thumbnail-192.webp"
        preview_path = destination / "preview-640.webp"

        canonical.save(
            master_path,
            format="PNG",
            compress_level=9,
            optimize=False,
        )
        _save_webp(_aspect_fit(canonical, 192), thumbnail_path)
        _save_webp(_aspect_fit(canonical, 640), preview_path)
    except OSError as exc:
        raise NormalizationError(f"Could not write normalized image set: {destination}") from exc

    master_sha256 = hashlib.sha256(master_path.read_bytes()).hexdigest()
    return NormalizationResult(
        master_path=master_path,
        thumbnail_path=thumbnail_path,
        preview_path=preview_path,
        dimensions=canonical.size,
        master_sha256=master_sha256,
    )


__all__ = [
    "NormalizationError",
    "NormalizationResult",
    "load_canonical_rgba",
    "normalize_master",
]
