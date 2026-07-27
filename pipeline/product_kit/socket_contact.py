from __future__ import annotations

from collections import deque
from dataclasses import dataclass
import hashlib
from math import atan2, cos, degrees, hypot, isfinite, sin
from pathlib import Path
from typing import Any, Literal, Mapping, Sequence

from PIL import Image


AlphaMask = tuple[bool, ...]
RasterFrame = Mapping[str, int]
NormalizedTransform = Mapping[str, float]


@dataclass(frozen=True)
class SocketRasterFragment:
    layer: Literal["front", "rear"]
    image: Image.Image
    frame: RasterFrame
    normalized_transform: NormalizedTransform
    target_point: Mapping[str, float] | None = None
    target_normal: Mapping[str, float] | None = None


@dataclass(frozen=True)
class SocketContactResult:
    certification_id: str
    overlap_pixels: int
    gap_pixels: int
    maximum_gap_pixels: int
    detached_components: int


class SocketContactError(ValueError):
    def __init__(
        self,
        result: SocketContactResult,
        *,
        overlap_depth_pixels: int,
        maximum_attachment_band_pixels: int,
    ) -> None:
        self.result = result
        self.overlap_depth_pixels = overlap_depth_pixels
        self.maximum_attachment_band_pixels = maximum_attachment_band_pixels
        super().__init__(
            f"{result.certification_id} failed rendered socket contact: "
            f"gap_pixels={result.gap_pixels} "
            f"maximum_gap_pixels={result.maximum_gap_pixels} "
            f"overlap_pixels={result.overlap_pixels} "
            f"overlap_depth_pixels={overlap_depth_pixels} "
            f"maximum_attachment_band_pixels={maximum_attachment_band_pixels} "
            f"detached_components={result.detached_components}"
        )


def _record_by_id(values: object, label: str) -> dict[str, Mapping[str, Any]]:
    if not isinstance(values, list):
        raise ValueError(f"{label} must be an array")
    records: dict[str, Mapping[str, Any]] = {}
    for value in values:
        if not isinstance(value, dict) or not isinstance(value.get("id"), str):
            raise ValueError(f"{label} contains a record without an ID")
        record_id = value["id"]
        if record_id in records:
            raise ValueError(f"{label} contains duplicate ID {record_id}")
        records[record_id] = value
    return records


def _normalised_vector(value: object) -> tuple[float, float]:
    if (
        not isinstance(value, dict)
        or set(value) != {"x", "y"}
        or type(value["x"]) not in (int, float)
        or type(value["y"]) not in (int, float)
        or not isfinite(value["x"])
        or not isfinite(value["y"])
    ):
        raise ValueError("socket normal is invalid")
    length = hypot(value["x"], value["y"])
    if length == 0:
        raise ValueError("socket normal is zero")
    return value["x"] / length, value["y"] / length


def _point(value: object) -> tuple[float, float]:
    if (
        not isinstance(value, dict)
        or set(value) != {"x", "y"}
        or type(value["x"]) not in (int, float)
        or type(value["y"]) not in (int, float)
        or not isfinite(value["x"])
        or not isfinite(value["y"])
    ):
        raise ValueError("socket point is invalid")
    return value["x"], value["y"]


def resolve_socket_normalized_transform(
    source_frame: Mapping[str, Any],
    target_frame: Mapping[str, Any],
) -> dict[str, float]:
    if (
        source_frame.get("mountType") != "socket"
        or target_frame.get("mountType") != "socket"
    ):
        raise ValueError("rendered socket certification requires socket frames")
    source_x, source_y = _point(source_frame.get("point"))
    target_x, target_y = _point(target_frame.get("point"))
    source_normal_x, source_normal_y = _normalised_vector(source_frame.get("normal"))
    target_normal_x, target_normal_y = _normalised_vector(target_frame.get("normal"))
    source_scale = source_frame.get("referenceScale")
    target_scale = target_frame.get("referenceScale")
    if (
        type(source_scale) not in (int, float)
        or type(target_scale) not in (int, float)
        or not isfinite(source_scale)
        or not isfinite(target_scale)
        or source_scale <= 0
        or target_scale <= 0
    ):
        raise ValueError("socket reference scale is invalid")
    scale = target_scale / source_scale
    cosine = (
        source_normal_x * target_normal_x
        + source_normal_y * target_normal_y
    )
    sine = (
        source_normal_x * target_normal_y
        - source_normal_y * target_normal_x
    )
    unit_length = hypot(cosine, sine)
    if unit_length == 0:
        raise ValueError("socket rotation is undefined")
    cosine /= unit_length
    sine /= unit_length
    rotation_degrees = degrees(atan2(sine, cosine))
    constraints = target_frame.get("constraints")
    if not isinstance(constraints, dict):
        raise ValueError("socket constraints are missing")
    numeric_constraints = (
        "minScale",
        "maxScale",
        "minRotationDegrees",
        "maxRotationDegrees",
        "maxNormalErrorDegrees",
    )
    if any(
        type(constraints.get(key)) not in (int, float)
        or not isfinite(constraints[key])
        for key in numeric_constraints
    ):
        raise ValueError("socket constraints are invalid")
    if (
        scale < constraints["minScale"]
        or scale > constraints["maxScale"]
        or rotation_degrees < constraints["minRotationDegrees"]
        or rotation_degrees > constraints["maxRotationDegrees"]
    ):
        raise ValueError("socket transform breaches its constraints")
    rotation_radians = atan2(sine, cosine)
    matrix_a = cos(rotation_radians) * scale
    matrix_b = sin(rotation_radians) * scale
    matrix_c = -sin(rotation_radians) * scale
    matrix_d = cos(rotation_radians) * scale
    return {
        "a": matrix_a,
        "b": matrix_b,
        "c": matrix_c,
        "d": matrix_d,
        "e": target_x - (matrix_a * source_x + matrix_c * source_y),
        "f": target_y - (matrix_b * source_x + matrix_d * source_y),
    }


def _master_image(
    repo_root: Path,
    record: Mapping[str, Any],
    raster: Mapping[str, Any],
) -> Image.Image:
    files = record.get("files")
    master_url = files.get("master") if isinstance(files, dict) else None
    if (
        not isinstance(master_url, str)
        or not master_url.startswith("/catalog/")
        or "\\" in master_url
    ):
        raise ValueError(f"{record.get('id')} has a non-canonical master path")
    master_path = repo_root.joinpath(*master_url.removeprefix("/").split("/")).resolve()
    resolved_root = repo_root.resolve()
    if not master_path.is_relative_to(resolved_root) or not master_path.is_file():
        raise ValueError(f"{record.get('id')} master file is missing")
    expected_hash = raster.get("masterSha256")
    if (
        record.get("masterSha256") != expected_hash
        or hashlib.sha256(master_path.read_bytes()).hexdigest() != expected_hash
    ):
        raise ValueError(f"{record.get('id')} master hash does not match")
    image = Image.open(master_path)
    image.load()
    return image.convert("RGBA")


def verify_product_kit_catalogue_contacts(
    catalogue: object,
    product_kit: object,
    repo_root: Path,
    *,
    maximum_gap_pixels: int = 2,
    maximum_attachment_band_pixels: int = 40,
) -> list[SocketContactResult]:
    records = _record_by_id(catalogue, "catalogue")
    if not isinstance(product_kit, dict):
        raise ValueError("Product Kit pack must be an object")
    kits = _record_by_id(product_kit.get("kits"), "Product Kit kits")
    components = _record_by_id(
        product_kit.get("components"),
        "Product Kit components",
    )
    certifications = product_kit.get("certifications")
    if not isinstance(certifications, list):
        raise ValueError("Product Kit certifications must be an array")
    results: list[SocketContactResult] = []
    for certification in certifications:
        if not isinstance(certification, dict):
            raise ValueError("Product Kit certification must be an object")
        certification_id = certification.get("id")
        kit = kits.get(certification.get("kitId"))
        component = components.get(certification.get("componentId"))
        if (
            not isinstance(certification_id, str)
            or kit is None
            or component is None
        ):
            raise ValueError("Product Kit certification binding is invalid")
        mount_frames = kit.get("mountFrames")
        if not isinstance(mount_frames, list):
            raise ValueError(f"{certification_id} has no mount frames")
        matching_frames = [
            frame
            for frame in mount_frames
            if isinstance(frame, dict)
            and frame.get("id") == certification.get("mountFrameId")
        ]
        if len(matching_frames) != 1:
            raise ValueError(f"{certification_id} mount frame binding is invalid")
        mount_frame = matching_frames[0]
        component_frame = component.get("componentFrame")
        if not isinstance(component_frame, dict):
            raise ValueError(f"{certification_id} component frame is invalid")
        transform = resolve_socket_normalized_transform(
            component_frame,
            mount_frame,
        )
        base_raster = kit.get("base")
        if not isinstance(base_raster, dict):
            raise ValueError(f"{certification_id} base raster is invalid")
        base_record = records.get(base_raster.get("assetId"))
        if base_record is None:
            raise ValueError(f"{certification_id} base asset is missing")
        base_image = _master_image(repo_root, base_record, base_raster)
        base_frame = base_raster.get("frame")
        if not isinstance(base_frame, dict):
            raise ValueError(f"{certification_id} base frame is invalid")
        fragment_values = component.get("fragments")
        if not isinstance(fragment_values, list):
            raise ValueError(f"{certification_id} fragments are invalid")
        fragments: list[SocketRasterFragment] = []
        for fragment_value in fragment_values:
            if not isinstance(fragment_value, dict):
                raise ValueError(f"{certification_id} fragment is invalid")
            layer = fragment_value.get("layer")
            raster = fragment_value.get("raster")
            if layer not in ("front", "rear") or not isinstance(raster, dict):
                raise ValueError(f"{certification_id} fragment metadata is invalid")
            record = records.get(raster.get("assetId"))
            frame = raster.get("frame")
            if record is None or not isinstance(frame, dict):
                raise ValueError(f"{certification_id} fragment asset is missing")
            fragments.append(
                SocketRasterFragment(
                    layer=layer,
                    image=_master_image(repo_root, record, raster),
                    frame=frame,
                    normalized_transform=transform,
                    target_point=mount_frame.get("point"),
                    target_normal=mount_frame.get("normal"),
                )
            )
        results.append(
            verify_socket_contact(
                certification_id,
                base_image,
                base_frame,
                fragments,
                maximum_gap_pixels=maximum_gap_pixels,
                maximum_attachment_band_pixels=maximum_attachment_band_pixels,
            )
        )
    return results


def _frame_values(frame: RasterFrame) -> tuple[int, int, int, int, int, int]:
    keys = (
        "originalWidth",
        "originalHeight",
        "trimX",
        "trimY",
        "trimWidth",
        "trimHeight",
    )
    if set(frame) != set(keys):
        raise ValueError("raster frame has the wrong fields")
    values = tuple(frame[key] for key in keys)
    if any(type(value) is not int for value in values):
        raise ValueError("raster frame values must be integers")
    width, height, trim_x, trim_y, trim_width, trim_height = values
    if (
        width <= 0
        or height <= 0
        or trim_x < 0
        or trim_y < 0
        or trim_width <= 0
        or trim_height <= 0
        or trim_x + trim_width > width
        or trim_y + trim_height > height
    ):
        raise ValueError("raster frame is outside its original canvas")
    return values


def _transform_values(
    transform: NormalizedTransform,
) -> tuple[float, float, float, float, float, float]:
    keys = ("a", "b", "c", "d", "e", "f")
    if set(transform) != set(keys):
        raise ValueError("normalized transform has the wrong fields")
    values = tuple(transform[key] for key in keys)
    if any(type(value) not in (int, float) or not isfinite(value) for value in values):
        raise ValueError("normalized transform values must be finite")
    return values


def _alpha_mask(image: Image.Image, minimum_alpha: int) -> AlphaMask:
    alpha = image.getchannel("A")
    return tuple(value >= minimum_alpha for value in alpha.getdata())


def _base_canvas(
    base_image: Image.Image,
    frame: RasterFrame,
) -> Image.Image:
    width, height, trim_x, trim_y, trim_width, trim_height = _frame_values(frame)
    image = base_image.convert("RGBA")
    if image.size != (trim_width, trim_height):
        raise ValueError("base master dimensions do not match its trim frame")
    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    canvas.alpha_composite(image, (trim_x, trim_y))
    return canvas


def _render_fragment(
    fragment: SocketRasterFragment,
    base_frame: RasterFrame,
) -> Image.Image:
    base_width, base_height, *_ = _frame_values(base_frame)
    (
        source_width,
        source_height,
        trim_x,
        trim_y,
        trim_width,
        trim_height,
    ) = _frame_values(fragment.frame)
    source = fragment.image.convert("RGBA")
    if source.size != (trim_width, trim_height):
        raise ValueError("component master dimensions do not match its trim frame")
    a, b, c, d, e, f = _transform_values(fragment.normalized_transform)

    forward_a = a * base_width / source_width
    forward_b = b * base_height / source_width
    forward_c = c * base_width / source_height
    forward_d = d * base_height / source_height
    forward_e = base_width * (
        a * trim_x / source_width
        + c * trim_y / source_height
        + e
    )
    forward_f = base_height * (
        b * trim_x / source_width
        + d * trim_y / source_height
        + f
    )
    determinant = forward_a * forward_d - forward_b * forward_c
    if not isfinite(determinant) or determinant == 0:
        raise ValueError("component transform is singular")
    inverse = (
        forward_d / determinant,
        -forward_c / determinant,
        (forward_c * forward_f - forward_d * forward_e) / determinant,
        -forward_b / determinant,
        forward_a / determinant,
        (forward_b * forward_e - forward_a * forward_f) / determinant,
    )
    if not all(isfinite(value) for value in inverse):
        raise ValueError("component transform inverse is not finite")
    return source.transform(
        (base_width, base_height),
        Image.Transform.AFFINE,
        inverse,
        resample=Image.Resampling.BICUBIC,
    )


def _connected_components(
    mask: AlphaMask,
    width: int,
    height: int,
    minimum_pixels: int,
) -> list[tuple[int, ...]]:
    seen = bytearray(width * height)
    components: list[tuple[int, ...]] = []
    for start, opaque in enumerate(mask):
        if not opaque or seen[start]:
            continue
        seen[start] = 1
        pending = deque([start])
        pixels: list[int] = []
        while pending:
            index = pending.popleft()
            pixels.append(index)
            x = index % width
            y = index // width
            for next_y in range(max(0, y - 1), min(height, y + 2)):
                row = next_y * width
                for next_x in range(max(0, x - 1), min(width, x + 2)):
                    neighbour = row + next_x
                    if mask[neighbour] and not seen[neighbour]:
                        seen[neighbour] = 1
                        pending.append(neighbour)
        if len(pixels) >= minimum_pixels:
            components.append(tuple(pixels))
    return components


def _attachment_components(
    component_mask: AlphaMask,
    width: int,
    height: int,
    target_point: Mapping[str, float],
    target_normal: Mapping[str, float],
    search_band_pixels: int,
    minimum_component_pixels: int,
) -> list[tuple[int, ...]]:
    target_x, target_y = _point(target_point)
    normal_x, normal_y = _normalised_vector(
        {
            "x": target_normal.get("x", 0) * width,
            "y": target_normal.get("y", 0) * height,
        }
    )
    target_pixel_x = target_x * width
    target_pixel_y = target_y * height
    attachment_mask = tuple(
        opaque
        and abs(
            ((index % width) + 0.5 - target_pixel_x) * normal_x
            + ((index // width) + 0.5 - target_pixel_y) * normal_y
        )
        <= search_band_pixels
        for index, opaque in enumerate(component_mask)
    )
    return _connected_components(
        attachment_mask,
        width,
        height,
        minimum_component_pixels,
    )


def _chebyshev_distances(
    source_mask: AlphaMask,
    width: int,
    height: int,
) -> list[int]:
    unreachable = width + height + 1
    distances = [0 if value else unreachable for value in source_mask]
    for y in range(height):
        row = y * width
        for x in range(width):
            index = row + x
            distance = distances[index]
            if x:
                distance = min(distance, distances[index - 1] + 1)
            if y:
                distance = min(distance, distances[index - width] + 1)
                if x:
                    distance = min(distance, distances[index - width - 1] + 1)
                if x + 1 < width:
                    distance = min(distance, distances[index - width + 1] + 1)
            distances[index] = distance
    for y in range(height - 1, -1, -1):
        row = y * width
        for x in range(width - 1, -1, -1):
            index = row + x
            distance = distances[index]
            if x + 1 < width:
                distance = min(distance, distances[index + 1] + 1)
            if y + 1 < height:
                distance = min(distance, distances[index + width] + 1)
                if x:
                    distance = min(distance, distances[index + width - 1] + 1)
                if x + 1 < width:
                    distance = min(distance, distances[index + width + 1] + 1)
            distances[index] = distance
    return distances


def _maximum_overlap_depth(
    base_mask: AlphaMask,
    component_mask: AlphaMask,
    layer: Literal["front", "rear"],
    width: int,
    height: int,
) -> int:
    overlap = tuple(
        base_opaque and component_opaque
        for base_opaque, component_opaque in zip(
            base_mask,
            component_mask,
            strict=True,
        )
    )
    if not any(overlap):
        return 0
    visible_reference = (
        tuple(
            base_opaque and not component_opaque
            for base_opaque, component_opaque in zip(
                base_mask,
                component_mask,
                strict=True,
            )
        )
        if layer == "front"
        else tuple(
            component_opaque and not base_opaque
            for base_opaque, component_opaque in zip(
                base_mask,
                component_mask,
                strict=True,
            )
        )
    )
    if not any(visible_reference):
        return width + height
    distances = _chebyshev_distances(visible_reference, width, height)
    return max(
        distance
        for distance, overlaps in zip(distances, overlap, strict=True)
        if overlaps
    )


def verify_socket_contact(
    certification_id: str,
    base_image: Image.Image,
    base_frame: RasterFrame,
    fragments: Sequence[SocketRasterFragment],
    *,
    maximum_gap_pixels: int = 2,
    maximum_attachment_band_pixels: int = 40,
    attachment_search_band_pixels: int = 24,
    minimum_alpha: int = 16,
    minimum_component_pixels: int = 4,
) -> SocketContactResult:
    if not certification_id:
        raise ValueError("certification ID is required")
    if (
        type(maximum_gap_pixels) is not int
        or maximum_gap_pixels < 0
        or type(maximum_attachment_band_pixels) is not int
        or maximum_attachment_band_pixels < 0
        or type(attachment_search_band_pixels) is not int
        or attachment_search_band_pixels <= 0
        or type(minimum_alpha) is not int
        or not 1 <= minimum_alpha <= 255
        or type(minimum_component_pixels) is not int
        or minimum_component_pixels <= 0
    ):
        raise ValueError("socket contact limits are invalid")
    base_canvas = _base_canvas(base_image, base_frame)
    width, height = base_canvas.size
    base_mask = _alpha_mask(base_canvas, minimum_alpha)
    if not any(base_mask):
        raise ValueError("base master has no qualifying alpha")
    base_distances = _chebyshev_distances(base_mask, width, height)

    overlap_pixels = 0
    maximum_gap = 0
    maximum_overlap_depth = 0
    detached_components = 0
    component_count = 0
    for fragment in fragments:
        if fragment.layer not in ("front", "rear"):
            raise ValueError("component fragment layer must be front or rear")
        rendered = _render_fragment(fragment, base_frame)
        component_mask = _alpha_mask(rendered, minimum_alpha)
        if (fragment.target_point is None) != (fragment.target_normal is None):
            raise ValueError("fragment target point and normal must be supplied together")
        components = (
            _attachment_components(
                component_mask,
                width,
                height,
                fragment.target_point,
                fragment.target_normal,
                attachment_search_band_pixels,
                minimum_component_pixels,
            )
            if fragment.target_point is not None
            and fragment.target_normal is not None
            else _connected_components(
                component_mask,
                width,
                height,
                minimum_component_pixels,
            )
        )
        if not components:
            detached_components += 1
            continue
        component_count += len(components)
        overlap_pixels += sum(
            base_opaque and component_opaque
            for base_opaque, component_opaque in zip(
                base_mask,
                component_mask,
                strict=True,
            )
        )
        maximum_overlap_depth = max(
            maximum_overlap_depth,
            _maximum_overlap_depth(
                base_mask,
                component_mask,
                fragment.layer,
                width,
                height,
            ),
        )
        for component in components:
            nearest_pixel_distance = min(base_distances[index] for index in component)
            gap = max(0, nearest_pixel_distance - 1)
            maximum_gap = max(maximum_gap, gap)
            if gap > maximum_gap_pixels:
                detached_components += 1

    if component_count == 0 and detached_components == 0:
        detached_components = 1
    result = SocketContactResult(
        certification_id=certification_id,
        overlap_pixels=overlap_pixels,
        gap_pixels=maximum_gap,
        maximum_gap_pixels=maximum_gap_pixels,
        detached_components=detached_components,
    )
    if (
        detached_components > 0
        or maximum_overlap_depth > maximum_attachment_band_pixels
    ):
        raise SocketContactError(
            result,
            overlap_depth_pixels=maximum_overlap_depth,
            maximum_attachment_band_pixels=maximum_attachment_band_pixels,
        )
    return result


__all__ = [
    "SocketContactError",
    "SocketContactResult",
    "SocketRasterFragment",
    "resolve_socket_normalized_transform",
    "verify_product_kit_catalogue_contacts",
    "verify_socket_contact",
]
