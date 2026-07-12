"""Frozen chroma-distance and binary-component primitives."""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite, sqrt
from typing import Iterable

from PIL import Image, ImageChops

RGB = tuple[int, int, int]
Bounds = tuple[int, int, int, int]
Run = tuple[int, int, int]

_D65 = (0.95047, 1.0, 1.08883)
_DELTA = 6.0 / 29.0
_DELTA_CUBED = _DELTA**3
_DELTA_LINEAR = 3.0 * _DELTA**2


@dataclass(frozen=True, slots=True)
class BinaryComponent:
    """One deterministic 8-connected component in a byte mask."""

    bounds: Bounds
    area: int
    touches_border: bool
    runs: tuple[Run, ...]


def _validated_rgb(value: Iterable[int]) -> RGB:
    channels = tuple(value)
    if len(channels) != 3 or any(type(channel) is not int or not 0 <= channel <= 255 for channel in channels):
        raise ValueError("RGB colours must contain three integer channels from 0 to 255")
    return channels  # type: ignore[return-value]


def _linear_channel(channel: int) -> float:
    value = channel / 255.0
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def _lab(rgb: RGB) -> tuple[float, float, float]:
    red, green, blue = (_linear_channel(channel) for channel in rgb)
    x = (0.4124564 * red + 0.3575761 * green + 0.1804375 * blue) / _D65[0]
    y = (0.2126729 * red + 0.7151522 * green + 0.0721750 * blue) / _D65[1]
    z = (0.0193339 * red + 0.1191920 * green + 0.9503041 * blue) / _D65[2]

    def pivot(value: float) -> float:
        return value ** (1.0 / 3.0) if value > _DELTA_CUBED else value / _DELTA_LINEAR + 4.0 / 29.0

    fx, fy, fz = pivot(x), pivot(y), pivot(z)
    return 116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz)


def cie76_distance(first: RGB, second: RGB) -> float:
    """Return CIE76 distance after the frozen sRGB-to-D65-Lab conversion."""

    first_lab = _lab(_validated_rgb(first))
    second_lab = _lab(_validated_rgb(second))
    return sqrt(sum((left - right) ** 2 for left, right in zip(first_lab, second_lab, strict=True)))


def _validate_classifier(threshold: float, alpha_cutoff: int) -> None:
    if not isfinite(threshold) or threshold < 0:
        raise ValueError("Chroma threshold must be finite and non-negative")
    if type(alpha_cutoff) is not int or not 0 <= alpha_cutoff <= 255:
        raise ValueError("Alpha cutoff must be an integer from 0 to 255")


def visible_non_chroma_mask(
    image: Image.Image,
    chroma_rgb: RGB,
    threshold: float,
    alpha_cutoff: int,
) -> bytearray:
    """Build a mask for visible pixels outside the inclusive CIE76 threshold."""

    _validate_classifier(threshold, alpha_cutoff)
    target_lab = _lab(_validated_rgb(chroma_rgb))
    threshold_squared = threshold * threshold
    rgba = image if image.mode == "RGBA" else image.convert("RGBA")
    raw = rgba.tobytes()
    result = bytearray(rgba.width * rgba.height)
    cache: dict[int, bool] = {}
    pixel_index = 0
    for source_index in range(0, len(raw), 4):
        alpha = raw[source_index + 3]
        if alpha > 0 and alpha >= alpha_cutoff:
            packed = raw[source_index] << 16 | raw[source_index + 1] << 8 | raw[source_index + 2]
            is_chroma = cache.get(packed)
            if is_chroma is None:
                colour_lab = _lab((raw[source_index], raw[source_index + 1], raw[source_index + 2]))
                distance_squared = sum(
                    (left - right) ** 2 for left, right in zip(colour_lab, target_lab, strict=True)
                )
                is_chroma = distance_squared <= threshold_squared
                cache[packed] = is_chroma
            if not is_chroma:
                result[pixel_index] = 1
        pixel_index += 1
    return result


def _candidate_chroma_mask(
    image: Image.Image,
    chroma_rgb: RGB,
    threshold: float,
    alpha_cutoff: int,
) -> bytearray:
    _validate_classifier(threshold, alpha_cutoff)
    target_lab = _lab(_validated_rgb(chroma_rgb))
    threshold_squared = threshold * threshold
    rgba = image if image.mode == "RGBA" else image.convert("RGBA")
    colours = rgba.getcolors(maxcolors=4096)
    if colours is not None:
        chroma_colours: set[RGB] = set()
        for _, (red, green, blue, alpha) in colours:
            if alpha <= 0 or alpha < alpha_cutoff:
                continue
            colour_lab = _lab((red, green, blue))
            distance_squared = sum(
                (left - right) ** 2 for left, right in zip(colour_lab, target_lab, strict=True)
            )
            if distance_squared <= threshold_squared:
                chroma_colours.add((red, green, blue))
        if len(chroma_colours) <= 32:
            red_band, green_band, blue_band, alpha_band = rgba.split()
            candidate = Image.new("L", rgba.size, 0)
            for red, green, blue in sorted(chroma_colours):
                red_match = red_band.point([255 if value == red else 0 for value in range(256)])
                green_match = green_band.point([255 if value == green else 0 for value in range(256)])
                blue_match = blue_band.point([255 if value == blue else 0 for value in range(256)])
                match = ImageChops.multiply(ImageChops.multiply(red_match, green_match), blue_match)
                candidate = ImageChops.lighter(candidate, match)
            visible = alpha_band.point([
                255 if value > 0 and value >= alpha_cutoff else 0
                for value in range(256)
            ])
            candidate = ImageChops.multiply(candidate, visible)
            return bytearray(candidate.point([0] + [1] * 255).tobytes())

    raw = rgba.tobytes()
    result = bytearray(rgba.width * rgba.height)
    cache: dict[int, bool] = {}
    pixel_index = 0
    for source_index in range(0, len(raw), 4):
        alpha = raw[source_index + 3]
        if alpha > 0 and alpha >= alpha_cutoff:
            packed = raw[source_index] << 16 | raw[source_index + 1] << 8 | raw[source_index + 2]
            is_chroma = cache.get(packed)
            if is_chroma is None:
                colour_lab = _lab((raw[source_index], raw[source_index + 1], raw[source_index + 2]))
                distance_squared = sum(
                    (left - right) ** 2 for left, right in zip(colour_lab, target_lab, strict=True)
                )
                is_chroma = distance_squared <= threshold_squared
                cache[packed] = is_chroma
            if is_chroma:
                result[pixel_index] = 1
        pixel_index += 1
    return result


def connected_components_8(mask: bytearray, width: int, height: int) -> list[BinaryComponent]:
    """Label an 8-connected byte mask using deterministic horizontal runs."""

    if width <= 0 or height <= 0 or len(mask) != width * height:
        raise ValueError("Binary mask dimensions do not match its byte length")

    runs: list[Run] = []
    parents: list[int] = []
    previous: list[int] = []

    def find(index: int) -> int:
        root = index
        while parents[root] != root:
            root = parents[root]
        while parents[index] != index:
            parent = parents[index]
            parents[index] = root
            index = parent
        return root

    def union(left: int, right: int) -> None:
        left_root, right_root = find(left), find(right)
        if left_root == right_root:
            return
        if left_root < right_root:
            parents[right_root] = left_root
        else:
            parents[left_root] = right_root

    for y in range(height):
        row_start, row_end = y * width, (y + 1) * width
        current: list[int] = []
        cursor = row_start
        while cursor < row_end:
            start = mask.find(b"\x01", cursor, row_end)
            if start < 0:
                break
            end = mask.find(b"\x00", start, row_end)
            if end < 0:
                end = row_end
            run_index = len(runs)
            runs.append((y, start - row_start, end - row_start))
            parents.append(run_index)
            current.append(run_index)
            cursor = end

        previous_cursor = 0
        for current_index in current:
            _, current_start, current_end = runs[current_index]
            while previous_cursor < len(previous) and runs[previous[previous_cursor]][2] < current_start:
                previous_cursor += 1
            candidate = previous_cursor
            while candidate < len(previous) and runs[previous[candidate]][1] <= current_end:
                union(current_index, previous[candidate])
                candidate += 1
        previous = current

    grouped: dict[int, list[Run]] = {}
    for index, run in enumerate(runs):
        grouped.setdefault(find(index), []).append(run)

    components: list[BinaryComponent] = []
    for component_runs in grouped.values():
        top = min(run[0] for run in component_runs)
        bottom = max(run[0] for run in component_runs) + 1
        left = min(run[1] for run in component_runs)
        right = max(run[2] for run in component_runs)
        area = sum(run[2] - run[1] for run in component_runs)
        touches_border = top == 0 or left == 0 or bottom == height or right == width
        components.append(BinaryComponent((left, top, right, bottom), area, touches_border, tuple(component_runs)))

    components.sort(key=lambda component: (
        component.bounds[1],
        component.bounds[0],
        component.bounds[3],
        component.bounds[2],
        component.area,
    ))
    return components


def remove_border_connected_chroma(
    image: Image.Image,
    chroma_rgb: RGB,
    threshold: float,
    alpha_cutoff: int,
) -> Image.Image:
    """Clear only chroma candidates connected to the crop border."""

    rgba = image.convert("RGBA")
    candidates = _candidate_chroma_mask(rgba, chroma_rgb, threshold, alpha_cutoff)
    components = connected_components_8(candidates, rgba.width, rgba.height)
    raw = bytearray(rgba.tobytes())
    for component in components:
        if not component.touches_border:
            continue
        for y, start, end in component.runs:
            byte_start = (y * rgba.width + start) * 4
            byte_end = (y * rgba.width + end) * 4
            raw[byte_start:byte_end] = b"\x00" * (byte_end - byte_start)
    return Image.frombytes("RGBA", rgba.size, bytes(raw))
