from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Literal

from PIL import Image


@dataclass(frozen=True)
class BoundedLineworkProfile:
    line_darkness_threshold: int
    minimum_alpha: int
    colour_distance: int
    minimum_region_pixels: int
    maximum_region_fraction: float


@dataclass(frozen=True)
class PixelBounds:
    left: int
    top: int
    right: int
    bottom: int


@dataclass(frozen=True)
class RegionMeasurement:
    pixel_count: int
    bounds: PixelBounds


@dataclass(frozen=True)
class ConnectedSectionCertification:
    status: Literal["certified", "insufficient-bounded-regions"]
    regions: tuple[RegionMeasurement, ...]


@dataclass(frozen=True)
class OpaqueBodyCertification:
    status: Literal["certified", "empty-body"]
    opaque_pixels: int
    bounds: PixelBounds | None


def _validate_profile(profile: BoundedLineworkProfile) -> None:
    if not 0 <= profile.line_darkness_threshold <= 255:
        raise ValueError("line darkness threshold must be from 0 to 255")
    if not 1 <= profile.minimum_alpha <= 255:
        raise ValueError("minimum alpha must be from 1 to 255")
    if not 0 <= profile.colour_distance <= 441:
        raise ValueError("colour distance must be from 0 to 441")
    if profile.minimum_region_pixels < 1:
        raise ValueError("minimum region pixels must be positive")
    if not 0 < profile.maximum_region_fraction <= 1:
        raise ValueError("maximum region fraction must be above zero and at most one")


def _is_traversable(pixel: tuple[int, int, int, int], profile: BoundedLineworkProfile) -> bool:
    red, green, blue, alpha = pixel
    return alpha >= profile.minimum_alpha and (
        red + green + blue
    ) / 3 > profile.line_darkness_threshold


def certify_connected_sections(
    source: Image.Image,
    profile: BoundedLineworkProfile,
) -> ConnectedSectionCertification:
    _validate_profile(profile)
    image = source.convert("RGBA")
    width, height = image.size
    if width < 1 or height < 1:
        raise ValueError("source image dimensions must be positive")
    pixels = list(image.getdata())
    opaque_pixels = sum(1 for pixel in pixels if pixel[3] >= profile.minimum_alpha)
    if opaque_pixels == 0:
        return ConnectedSectionCertification("insufficient-bounded-regions", ())

    visited = bytearray(width * height)
    regions: list[tuple[int, RegionMeasurement]] = []
    for start, pixel in enumerate(pixels):
        if visited[start] or not _is_traversable(pixel, profile):
            continue
        visited[start] = 1
        queue: deque[int] = deque([start])
        indices: list[int] = []
        bounded = True
        left = right = start % width
        top = bottom = start // width

        while queue:
            index = queue.popleft()
            indices.append(index)
            x = index % width
            y = index // width
            left = min(left, x)
            right = max(right, x)
            top = min(top, y)
            bottom = max(bottom, y)
            for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if next_x < 0 or next_y < 0 or next_x >= width or next_y >= height:
                    bounded = False
                    continue
                next_index = next_y * width + next_x
                next_pixel = pixels[next_index]
                if next_pixel[3] < profile.minimum_alpha:
                    bounded = False
                    continue
                if visited[next_index] or not _is_traversable(next_pixel, profile):
                    continue
                visited[next_index] = 1
                queue.append(next_index)

        count = len(indices)
        if not bounded or count < profile.minimum_region_pixels:
            continue
        if count / opaque_pixels > profile.maximum_region_fraction:
            continue
        regions.append((
            start,
            RegionMeasurement(
                pixel_count=count,
                bounds=PixelBounds(left=left, top=top, right=right, bottom=bottom),
            ),
        ))

    ordered = tuple(measurement for _, measurement in sorted(regions, key=lambda value: value[0]))
    return ConnectedSectionCertification(
        "certified" if len(ordered) >= 2 else "insufficient-bounded-regions",
        ordered,
    )


def certify_opaque_body(source: Image.Image, *, minimum_alpha: int) -> OpaqueBodyCertification:
    if not 1 <= minimum_alpha <= 255:
        raise ValueError("minimum alpha must be from 1 to 255")
    image = source.convert("RGBA")
    width, height = image.size
    opaque = [
        (index % width, index // width)
        for index, pixel in enumerate(image.getdata())
        if pixel[3] >= minimum_alpha
    ]
    if not opaque:
        return OpaqueBodyCertification("empty-body", 0, None)
    xs = [point[0] for point in opaque]
    ys = [point[1] for point in opaque]
    return OpaqueBodyCertification(
        "certified",
        len(opaque),
        PixelBounds(min(xs), min(ys), max(xs), max(ys)),
    )
