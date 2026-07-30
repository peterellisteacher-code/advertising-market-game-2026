"""Strict offline authoring contract for ``product-kit@1`` catalogues.

The browser implementation in ``web/src/product-kit`` is authoritative.  This
module mirrors its closed camelCase syntax and its catalogue-bound graph checks
while exposing idiomatic snake_case attributes to Python callers.
"""

from __future__ import annotations

import json
import math
import re
import types
from dataclasses import dataclass
from typing import Annotated, Any, Literal, Mapping, Sequence, Union, get_args, get_origin

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)


PORTABLE_ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*\Z")
PRODUCT_KIT_ID_PATTERN = re.compile(r"^pk1-[a-z0-9]+(?:-[a-z0-9]+)*\Z")
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}\Z")
MAX_COLLECTION = 10_000
CONTACT_TOLERANCE = 1e-8
RAD_TO_DEGREES = 180.0 / math.pi
COMPONENT_LAYER_ORDER = {"rear": 0, "front": 1, "overlay": 2}
ALLOWED_RASTER_KINDS = frozenset({"component", "raster-master", "shell"})
JAVASCRIPT_TRIM_CHARACTERS = (
    "\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680"
    "\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a"
    "\u2028\u2029\u202f\u205f\u3000\ufeff"
)


def _to_camel(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(part[:1].upper() + part[1:] for part in tail)


class ContractModel(BaseModel):
    """Closed strict model accepting aliases, never Python field names."""

    model_config = ConfigDict(
        alias_generator=_to_camel,
        extra="forbid",
        strict=True,
        validate_by_alias=True,
        validate_by_name=False,
        validate_default=True,
        revalidate_instances="always",
        frozen=True,
    )


def _validate_title(value: str) -> str:
    utf16_length = len(value.encode("utf-16-le", errors="surrogatepass")) // 2
    if utf16_length > 80:
        raise ValueError("title may not exceed 80 UTF-16 code units")
    if value != value.strip(JAVASCRIPT_TRIM_CHARACTERS):
        raise ValueError("title must not contain outer whitespace")
    if any(ord(character) < 32 for character in value):
        raise ValueError("title must not contain control characters")
    return value


def _validate_portable_id(value: str) -> str:
    if PORTABLE_ID_PATTERN.fullmatch(value) is None:
        raise ValueError("value must be a portable ID")
    return value


def _validate_product_kit_id(value: str) -> str:
    if PRODUCT_KIT_ID_PATTERN.fullmatch(value) is None:
        raise ValueError("value must be a product-kit ID")
    return value


def _validate_sha256(value: str) -> str:
    if SHA256_PATTERN.fullmatch(value) is None:
        raise ValueError("value must be a lowercase SHA-256")
    return value


def _reject_signed_zero(value: Any) -> Any:
    if type(value) is float and value == 0.0 and math.copysign(1.0, value) < 0.0:
        raise ValueError("signed zero is not part of the product-kit numeric contract")
    return value


def _validate_json_integer(value: Any) -> int:
    _reject_signed_zero(value)
    if isinstance(value, bool):
        raise ValueError("JSON integer fields may not be booleans")
    if isinstance(value, int):
        return value
    if isinstance(value, float) and math.isfinite(value) and value.is_integer():
        return int(value)
    raise ValueError("value must be a finite integral JSON number")


PortableId = Annotated[
    str,
    Field(
        strict=True,
        min_length=1,
        max_length=80,
    ),
    AfterValidator(_validate_portable_id),
]
ProductKitId = Annotated[
    str,
    Field(
        strict=True,
        min_length=1,
        max_length=80,
    ),
    AfterValidator(_validate_product_kit_id),
]
Sha256 = Annotated[
    str,
    Field(strict=True, min_length=64, max_length=64),
    AfterValidator(_validate_sha256),
]
Title = Annotated[
    str,
    Field(strict=True, min_length=1, max_length=80),
    AfterValidator(_validate_title),
]
FiniteNumber = Annotated[
    float,
    BeforeValidator(_reject_signed_zero),
    Field(strict=True, allow_inf_nan=False),
]
UnitNumber = Annotated[
    float,
    BeforeValidator(_reject_signed_zero),
    Field(strict=True, ge=0.0, le=1.0, allow_inf_nan=False),
]
PositiveUnitNumber = Annotated[
    float,
    BeforeValidator(_reject_signed_zero),
    Field(strict=True, gt=0.0, le=1.0, allow_inf_nan=False),
]
NormalNumber = Annotated[
    float,
    BeforeValidator(_reject_signed_zero),
    Field(strict=True, ge=-1.0, le=1.0, allow_inf_nan=False),
]
PositiveReferenceScale = Annotated[
    float,
    BeforeValidator(_reject_signed_zero),
    Field(strict=True, gt=0.0, le=2.0, allow_inf_nan=False),
]
PixelDimension = Annotated[
    int,
    BeforeValidator(_validate_json_integer),
    Field(strict=True, ge=1, le=8192),
]
TrimOffset = Annotated[
    int,
    BeforeValidator(_validate_json_integer),
    Field(strict=True, ge=0, le=8191),
]
GridCount = Annotated[
    int,
    BeforeValidator(_validate_json_integer),
    Field(strict=True, ge=1, le=64),
]


class Point(ContractModel):
    x: UnitNumber
    y: UnitNumber


class Normal(ContractModel):
    x: NormalNumber
    y: NormalNumber

    @model_validator(mode="after")
    def validate_nonzero(self) -> "Normal":
        if self.x == 0.0 and self.y == 0.0:
            raise ValueError("normal must be non-zero")
        return self


class Bounds(ContractModel):
    x: UnitNumber
    y: UnitNumber
    width: PositiveUnitNumber
    height: PositiveUnitNumber

    @model_validator(mode="after")
    def validate_design_rectangle(self) -> "Bounds":
        if self.x + self.width > 1.0 or self.y + self.height > 1.0:
            raise ValueError("bounds must remain inside the design rectangle")
        return self


class RasterFrame(ContractModel):
    original_width: PixelDimension
    original_height: PixelDimension
    trim_x: TrimOffset
    trim_y: TrimOffset
    trim_width: PixelDimension
    trim_height: PixelDimension

    @model_validator(mode="after")
    def validate_trim_rectangle(self) -> "RasterFrame":
        if (
            self.trim_x + self.trim_width > self.original_width
            or self.trim_y + self.trim_height > self.original_height
        ):
            raise ValueError("trim rectangle must fit inside original dimensions")
        return self


class AssetReference(ContractModel):
    asset_id: PortableId
    master_sha256: Sha256
    frame: RasterFrame


class CompatibilityProfile(ContractModel):
    family_id: ProductKitId
    perspective_id: ProductKitId
    geometry_id: ProductKitId
    style_id: ProductKitId


class TransformConstraints(ContractModel):
    min_scale: Annotated[
        float,
        BeforeValidator(_reject_signed_zero),
        Field(strict=True, gt=0.0, le=8.0, allow_inf_nan=False),
    ]
    max_scale: Annotated[
        float,
        BeforeValidator(_reject_signed_zero),
        Field(strict=True, gt=0.0, le=8.0, allow_inf_nan=False),
    ]
    min_rotation_degrees: Annotated[
        float,
        BeforeValidator(_reject_signed_zero),
        Field(strict=True, ge=-180.0, le=180.0, allow_inf_nan=False),
    ]
    max_rotation_degrees: Annotated[
        float,
        BeforeValidator(_reject_signed_zero),
        Field(strict=True, ge=-180.0, le=180.0, allow_inf_nan=False),
    ]
    max_normal_error_degrees: Annotated[
        float,
        BeforeValidator(_reject_signed_zero),
        Field(strict=True, ge=0.0, le=45.0, allow_inf_nan=False),
    ]
    mirror_allowed: bool

    @model_validator(mode="after")
    def validate_ranges(self) -> "TransformConstraints":
        if self.min_scale > self.max_scale:
            raise ValueError("minScale must not exceed maxScale")
        if self.min_rotation_degrees > self.max_rotation_degrees:
            raise ValueError("minRotationDegrees must not exceed maxRotationDegrees")
        return self


class SocketMountFrame(ContractModel):
    id: ProductKitId
    slot_id: ProductKitId
    mount_type: Literal["socket"]
    point: Point
    normal: Normal
    reference_scale: PositiveReferenceScale
    constraints: TransformConstraints


class GripMountFrame(ContractModel):
    id: ProductKitId
    slot_id: ProductKitId
    mount_type: Literal["grip"]
    contacts: list[Point] = Field(min_length=2, max_length=2)
    normals: list[Normal] = Field(min_length=2, max_length=2)
    constraints: TransformConstraints

    @model_validator(mode="after")
    def validate_distinct_contacts(self) -> "GripMountFrame":
        if _same_point(self.contacts[0], self.contacts[1]):
            raise ValueError("grip contacts must be distinct")
        return self


class CellSize(ContractModel):
    width: PositiveUnitNumber
    height: PositiveUnitNumber


class GridMountFrame(ContractModel):
    id: ProductKitId
    slot_id: ProductKitId
    mount_type: Literal["grid"]
    origin: Point
    cell_size: CellSize
    columns: GridCount
    rows: GridCount
    plane: Literal["floor", "wall"]
    accepted_edge_types: list[ProductKitId] = Field(max_length=32)

    @model_validator(mode="after")
    def validate_design_rectangle(self) -> "GridMountFrame":
        if (
            self.origin.x + self.cell_size.width * self.columns > 1.0
            or self.origin.y + self.cell_size.height * self.rows > 1.0
        ):
            raise ValueError("grid must remain inside the design rectangle")
        return self


MountFrame = Annotated[
    SocketMountFrame | GripMountFrame | GridMountFrame,
    Field(discriminator="mount_type"),
]


class SocketComponentFrame(ContractModel):
    mount_type: Literal["socket"]
    point: Point
    normal: Normal
    reference_scale: PositiveReferenceScale


class GripComponentFrame(ContractModel):
    mount_type: Literal["grip"]
    contacts: list[Point] = Field(min_length=2, max_length=2)
    normals: list[Normal] = Field(min_length=2, max_length=2)

    @model_validator(mode="after")
    def validate_distinct_contacts(self) -> "GripComponentFrame":
        if _same_point(self.contacts[0], self.contacts[1]):
            raise ValueError("grip contacts must be distinct")
        return self


class Footprint(ContractModel):
    columns: GridCount
    rows: GridCount


class EdgeTypes(ContractModel):
    north: ProductKitId | None = None
    east: ProductKitId | None = None
    south: ProductKitId | None = None
    west: ProductKitId | None = None

    @model_validator(mode="after")
    def reject_explicit_null(self) -> "EdgeTypes":
        if any(getattr(self, name) is None for name in self.__pydantic_fields_set__):
            raise ValueError("edge types may be omitted but may not be null")
        return self


class GridComponentFrame(ContractModel):
    mount_type: Literal["grid"]
    plane: Literal["floor", "wall"]
    footprint: Footprint
    edge_types: EdgeTypes


ComponentFrame = Annotated[
    SocketComponentFrame | GripComponentFrame | GridComponentFrame,
    Field(discriminator="mount_type"),
]


class Kit(ContractModel):
    id: ProductKitId
    title: Title
    mode: Literal["whole", "socket", "grip", "grid"]
    compatibility_profile: CompatibilityProfile
    base: AssetReference
    price_asset_id: ProductKitId
    mount_frames: list[MountFrame] = Field(max_length=32)
    artwork_bounds: list[Bounds] = Field(max_length=8)


class Fragment(ContractModel):
    layer: Literal["rear", "front", "overlay"]
    raster: AssetReference


class Component(ContractModel):
    id: ProductKitId
    title: Title
    slot_id: ProductKitId
    compatibility_profile: CompatibilityProfile
    component_frame: ComponentFrame
    fragments: list[Fragment] = Field(min_length=1, max_length=3)
    price_asset_id: ProductKitId


class Certification(ContractModel):
    id: ProductKitId
    kit_id: ProductKitId
    mount_frame_id: ProductKitId
    component_id: ProductKitId
    fingerprint: Sha256


class ProductKitCatalogue(ContractModel):
    schema_id: Literal["product-kit@1"] = Field(alias="schema")
    version: Literal[1]
    pack_id: ProductKitId
    catalog_pack_id: PortableId
    catalog_sha256: Sha256
    pricing_version: Literal["product-pricing@1"]
    connector_formula_version: Literal["product-kit-connectors@1"]
    kits: list[Kit] = Field(min_length=1, max_length=MAX_COLLECTION)
    components: list[Component] = Field(max_length=MAX_COLLECTION)
    certifications: list[Certification] = Field(max_length=MAX_COLLECTION)

    @field_validator("version", mode="before")
    @classmethod
    def validate_version_number(cls, value: Any) -> int:
        return _validate_json_integer(value)


class AssetRecordFiles(ContractModel):
    master: str


class AssetRecordDimensions(ContractModel):
    width: PixelDimension
    height: PixelDimension


class ProductKitCatalogueAssetRecord(ContractModel):
    id: PortableId
    master_sha256: Sha256
    delivery: str
    kind: str
    files: AssetRecordFiles
    dimensions: AssetRecordDimensions
    classroom_reviewed: bool
    brand_free: bool


class ProductKitCatalogueContext(ContractModel):
    catalog_pack_id: PortableId
    catalog_sha256: Sha256
    records: list[ProductKitCatalogueAssetRecord] = Field(max_length=20_000)


def _same_point(left: Point, right: Point) -> bool:
    return left.x == right.x and left.y == right.y


def _sorted_unique_by_id(values: Sequence[Any]) -> bool:
    return all(values[index - 1].id < values[index].id for index in range(1, len(values)))


def _sorted_unique_strings(values: Sequence[str]) -> bool:
    return all(values[index - 1] < values[index] for index in range(1, len(values)))


def _same_profile(left: CompatibilityProfile, right: CompatibilityProfile) -> bool:
    return (
        left.family_id == right.family_id
        and left.perspective_id == right.perspective_id
        and left.geometry_id == right.geometry_id
        and left.style_id == right.style_id
    )


def _raster_is_bound(
    raster: AssetReference,
    records: Mapping[str, ProductKitCatalogueAssetRecord],
    pack_id: str,
) -> bool:
    record = records.get(raster.asset_id)
    if record is None:
        return False
    expected_master = f"/catalog/generated/{pack_id}/assets/{record.id}/master.png"
    return (
        record.master_sha256 == raster.master_sha256
        and record.delivery == "offline"
        and record.classroom_reviewed
        and record.brand_free
        and record.kind in ALLOWED_RASTER_KINDS
        and record.files.master == expected_master
        and record.dimensions.width == raster.frame.trim_width
        and record.dimensions.height == raster.frame.trim_height
    )


def _fragments_are_canonical(fragments: Sequence[Fragment]) -> bool:
    return all(
        COMPONENT_LAYER_ORDER[fragments[index - 1].layer]
        < COMPONENT_LAYER_ORDER[fragments[index].layer]
        for index in range(1, len(fragments))
    )


Vector = tuple[float, float]
Matrix = tuple[float, float, float, float, float, float]


@dataclass(frozen=True)
class _Rotation:
    cosine: float
    sine: float
    radians: float
    degrees: float


@dataclass(frozen=True)
class _Candidate:
    max_normal_error_degrees: float
    average_normal_error_degrees: float
    mirrored: bool


def _vector(value: Point | Normal) -> Vector:
    return value.x, value.y


def _finite_vector(value: Vector) -> bool:
    return math.isfinite(value[0]) and math.isfinite(value[1])


def _span_between(first: Point, second: Point) -> Vector | None:
    span = second.x - first.x, second.y - first.y
    return span if _finite_vector(span) else None


def _magnitude_parts(value: Vector) -> tuple[float, float] | None:
    largest_component = max(abs(value[0]), abs(value[1]))
    if largest_component == 0.0 or not math.isfinite(largest_component):
        return None
    scaled_length = math.hypot(
        value[0] / largest_component,
        value[1] / largest_component,
    )
    if not math.isfinite(scaled_length):
        return None
    return largest_component, scaled_length


def _normalized(value: Vector) -> Vector | None:
    if not _finite_vector(value):
        return None
    largest_component = max(abs(value[0]), abs(value[1]))
    if largest_component == 0.0:
        return None
    scaled_x = value[0] / largest_component
    scaled_y = value[1] / largest_component
    scaled_length = math.hypot(scaled_x, scaled_y)
    if scaled_length == 0.0 or not math.isfinite(scaled_length):
        return None
    return scaled_x / scaled_length, scaled_y / scaled_length


def _dot_cross(left: Vector, right: Vector) -> tuple[float, float]:
    """Return dot and signed cross products without angle clamping.

    Callers normalize vectors using largest-component scaling first.  Keeping
    both products feeds ``atan2`` directly, preserving genuine tiny errors and
    avoiding the overflow/precision loss of ``acos(dot)``.
    """

    return (
        left[0] * right[0] + left[1] * right[1],
        left[0] * right[1] - left[1] * right[0],
    )


def _rotation_between(source: Vector, target: Vector) -> _Rotation | None:
    cosine, sine = _dot_cross(source, target)
    unit = _normalized((cosine, sine))
    if unit is None:
        return None
    radians = math.atan2(unit[1], unit[0])
    degrees = radians * RAD_TO_DEGREES
    if radians == 0.0:
        radians = 0.0
    if degrees == 0.0:
        degrees = 0.0
    return _Rotation(unit[0], unit[1], radians, degrees)


def _within_constraints(
    scale: float,
    rotation_degrees: float,
    constraints: TransformConstraints,
) -> bool:
    return (
        math.isfinite(scale)
        and math.isfinite(rotation_degrees)
        and constraints.min_scale <= scale <= constraints.max_scale
        and constraints.min_rotation_degrees
        <= rotation_degrees
        <= constraints.max_rotation_degrees
    )


def _affine_for(
    source_point: Point,
    target_point: Point,
    scale: float,
    rotation: _Rotation,
    mirrored: bool,
) -> Matrix:
    mirror_x = -1.0 if mirrored else 1.0
    a = rotation.cosine * scale * mirror_x
    b = rotation.sine * scale * mirror_x
    c = -rotation.sine * scale
    d = rotation.cosine * scale
    e = target_point.x - (a * source_point.x + c * source_point.y)
    f = target_point.y - (b * source_point.x + d * source_point.y)
    return a, b, c, d, e, f


def _finite_matrix(matrix: Matrix) -> bool:
    return all(math.isfinite(value) for value in matrix)


def _transformed_normal(source: Vector, rotation: _Rotation, mirrored: bool) -> Vector:
    x = -source[0] if mirrored else source[0]
    return (
        rotation.cosine * x - rotation.sine * source[1],
        rotation.sine * x + rotation.cosine * source[1],
    )


def _angular_error_degrees(left: Vector, right: Vector) -> float:
    dot, cross = _dot_cross(left, right)
    return math.atan2(abs(cross), dot) * RAD_TO_DEGREES


def _apply_transform(matrix: Matrix, point: Point) -> Vector:
    a, b, c, d, e, f = matrix
    return (
        a * point.x + c * point.y + e,
        b * point.x + d * point.y + f,
    )


def _contact_residual(matrix: Matrix, source: Point, target: Point) -> float:
    transformed = _apply_transform(matrix, source)
    if not _finite_vector(transformed):
        return math.inf
    residual = math.hypot(transformed[0] - target.x, transformed[1] - target.y)
    return residual if math.isfinite(residual) else math.inf


def _socket_transform_is_feasible(
    source: SocketComponentFrame,
    target: SocketMountFrame,
    constraints: TransformConstraints,
) -> bool:
    source_normal = _normalized(_vector(source.normal))
    target_normal = _normalized(_vector(target.normal))
    if source_normal is None or target_normal is None:
        return False
    scale = target.reference_scale / source.reference_scale
    rotation = _rotation_between(source_normal, target_normal)
    if rotation is None or not _within_constraints(scale, rotation.degrees, constraints):
        return False
    matrix = _affine_for(source.point, target.point, scale, rotation, False)
    if not _finite_matrix(matrix):
        return False
    normal_error = _angular_error_degrees(
        _transformed_normal(source_normal, rotation, False),
        target_normal,
    )
    return (
        normal_error <= constraints.max_normal_error_degrees
        and _contact_residual(matrix, source.point, target.point) <= CONTACT_TOLERANCE
    )


def _grip_candidate(
    source: GripComponentFrame,
    target: GripMountFrame,
    source_normals: tuple[Vector, Vector],
    target_normals: tuple[Vector, Vector],
    scale: float,
    constraints: TransformConstraints,
    mirrored: bool,
) -> _Candidate | None:
    source_span = (
        source.contacts[1].x - source.contacts[0].x,
        source.contacts[1].y - source.contacts[0].y,
    )
    target_span = (
        target.contacts[1].x - target.contacts[0].x,
        target.contacts[1].y - target.contacts[0].y,
    )
    reflected_source_span = (
        -source_span[0] if mirrored else source_span[0],
        source_span[1],
    )
    source_direction = _normalized(reflected_source_span)
    target_direction = _normalized(target_span)
    if source_direction is None or target_direction is None:
        return None
    rotation = _rotation_between(source_direction, target_direction)
    if rotation is None or not _within_constraints(scale, rotation.degrees, constraints):
        return None
    matrix = _affine_for(
        source.contacts[0],
        target.contacts[0],
        scale,
        rotation,
        mirrored,
    )
    if (
        not _finite_matrix(matrix)
        or _contact_residual(matrix, source.contacts[0], target.contacts[0])
        > CONTACT_TOLERANCE
        or _contact_residual(matrix, source.contacts[1], target.contacts[1])
        > CONTACT_TOLERANCE
    ):
        return None
    errors = tuple(
        _angular_error_degrees(
            _transformed_normal(source_normals[index], rotation, mirrored),
            target_normals[index],
        )
        for index in range(2)
    )
    max_error = max(errors)
    if max_error > constraints.max_normal_error_degrees:
        return None
    return _Candidate(max_error, (errors[0] + errors[1]) / 2.0, mirrored)


def _grip_transform_is_feasible(
    source: GripComponentFrame,
    target: GripMountFrame,
    constraints: TransformConstraints,
) -> bool:
    normalized_source = tuple(_normalized(_vector(normal)) for normal in source.normals)
    normalized_target = tuple(_normalized(_vector(normal)) for normal in target.normals)
    if any(value is None for value in (*normalized_source, *normalized_target)):
        return False
    source_span = _span_between(source.contacts[0], source.contacts[1])
    target_span = _span_between(target.contacts[0], target.contacts[1])
    if source_span is None or target_span is None:
        return False
    source_magnitude = _magnitude_parts(source_span)
    target_magnitude = _magnitude_parts(target_span)
    if source_magnitude is None or target_magnitude is None:
        return False
    scale = (target_magnitude[0] / source_magnitude[0]) * (
        target_magnitude[1] / source_magnitude[1]
    )
    source_normals = normalized_source  # narrowed by the explicit None check above
    target_normals = normalized_target
    candidates = [
        _grip_candidate(
            source,
            target,
            source_normals,  # type: ignore[arg-type]
            target_normals,  # type: ignore[arg-type]
            scale,
            constraints,
            False,
        )
    ]
    if constraints.mirror_allowed:
        candidates.append(
            _grip_candidate(
                source,
                target,
                source_normals,  # type: ignore[arg-type]
                target_normals,  # type: ignore[arg-type]
                scale,
                constraints,
                True,
            )
        )
    feasible = [candidate for candidate in candidates if candidate is not None]
    feasible.sort(
        key=lambda candidate: (
            candidate.max_normal_error_degrees,
            candidate.average_normal_error_degrees,
            candidate.mirrored,
        )
    )
    return bool(feasible)


def _certified_geometry_is_valid(frame: MountFrame, component_frame: ComponentFrame) -> bool:
    if isinstance(frame, SocketMountFrame) and isinstance(component_frame, SocketComponentFrame):
        return _socket_transform_is_feasible(component_frame, frame, frame.constraints)
    if isinstance(frame, GripMountFrame) and isinstance(component_frame, GripComponentFrame):
        return _grip_transform_is_feasible(component_frame, frame, frame.constraints)
    if isinstance(frame, GridMountFrame) and isinstance(component_frame, GridComponentFrame):
        accepted = set(frame.accepted_edge_types)
        edge_types = (
            component_frame.edge_types.north,
            component_frame.edge_types.east,
            component_frame.edge_types.south,
            component_frame.edge_types.west,
        )
        return (
            frame.plane == component_frame.plane
            and component_frame.footprint.columns <= frame.columns
            and component_frame.footprint.rows <= frame.rows
            and all(edge_type in accepted for edge_type in edge_types if edge_type is not None)
        )
    return False


def _validate_graph(
    catalogue: ProductKitCatalogue,
    context: ProductKitCatalogueContext,
) -> None:
    if catalogue.catalog_pack_id != context.catalog_pack_id:
        raise ValueError("catalogue pack does not match its binding context")
    if catalogue.catalog_sha256 != context.catalog_sha256:
        raise ValueError("catalogue hash does not match its binding context")
    if not _sorted_unique_by_id(catalogue.kits):
        raise ValueError("kits must have sorted unique IDs")
    if not _sorted_unique_by_id(catalogue.components):
        raise ValueError("components must have sorted unique IDs")
    if not _sorted_unique_by_id(catalogue.certifications):
        raise ValueError("certifications must have sorted unique IDs")

    records = {record.id: record for record in context.records}
    if len(records) != len(context.records):
        raise ValueError("catalogue context record IDs must be unique")
    kits = {kit.id: kit for kit in catalogue.kits}
    components = {component.id: component for component in catalogue.components}
    all_frame_ids = [frame.id for kit in catalogue.kits for frame in kit.mount_frames]
    if len(set(all_frame_ids)) != len(all_frame_ids):
        raise ValueError("mount-frame IDs must be globally unique")

    for kit in catalogue.kits:
        if not _raster_is_bound(kit.base, records, context.catalog_pack_id):
            raise ValueError("kit base raster is not bound to the reviewed offline catalogue")
        if not _sorted_unique_by_id(kit.mount_frames):
            raise ValueError("mount frames must have sorted unique IDs")
        if kit.mode == "whole":
            if kit.mount_frames:
                raise ValueError("whole kits may not contain mount frames")
        elif not kit.mount_frames or any(
            frame.mount_type != kit.mode for frame in kit.mount_frames
        ):
            raise ValueError("kit mode and mount-frame types must match exactly")
        for frame in kit.mount_frames:
            if isinstance(frame, GridMountFrame) and not _sorted_unique_strings(
                frame.accepted_edge_types
            ):
                raise ValueError("accepted grid edge types must be sorted and unique")

    for component in catalogue.components:
        if not _fragments_are_canonical(component.fragments):
            raise ValueError("component fragments must use canonical unique layer order")
        if any(
            not _raster_is_bound(fragment.raster, records, context.catalog_pack_id)
            for fragment in component.fragments
        ):
            raise ValueError("component raster is not bound to the reviewed offline catalogue")

    certified_pairs: set[tuple[str, str, str]] = set()
    for certification in catalogue.certifications:
        kit = kits.get(certification.kit_id)
        component = components.get(certification.component_id)
        frame = (
            next(
                (
                    candidate
                    for candidate in kit.mount_frames
                    if candidate.id == certification.mount_frame_id
                ),
                None,
            )
            if kit is not None
            else None
        )
        pair = (
            certification.kit_id,
            certification.mount_frame_id,
            certification.component_id,
        )
        if (
            kit is None
            or component is None
            or frame is None
            or kit.mode == "whole"
            or pair in certified_pairs
            or frame.slot_id != component.slot_id
            or frame.mount_type != component.component_frame.mount_type
            or not _same_profile(kit.compatibility_profile, component.compatibility_profile)
            or not _certified_geometry_is_valid(frame, component.component_frame)
        ):
            raise ValueError("certification does not bind an exact feasible kit/component pair")
        certified_pairs.add(pair)


def _model_value_for_revalidation(
    value: Any,
    unexpected_attributes: list[str],
    path: str = "$",
    active_ids: set[int] | None = None,
    model_state: bool = False,
    expected_annotation: Any = Any,
    allow_model_instances: bool = True,
) -> Any:
    """Rebuild model instances with aliases without dropping invalid state.

    Pydantic's direct ``revalidate_instances`` path exposes field-name mappings,
    which conflicts with this contract's deliberate alias-only input boundary.
    ``model_dump`` is also insufficient because it silently omits attributes
    injected by ``model_copy(update=...)``.  This traversal preserves explicit
    values (including explicit ``None``) and records every non-field attribute so
    the target model can reject the input rather than sanitising it.
    """

    plain_scalar_types = (bool, int, float, str, bytes)
    if isinstance(value, plain_scalar_types) and type(value) not in plain_scalar_types:
        unexpected_attributes.append(f"{path}:scalar-subclass")
        return value
    if isinstance(value, list) and type(value) is not list:
        unexpected_attributes.append(f"{path}:list-subclass")
        return None
    if isinstance(value, tuple) and type(value) is not tuple:
        unexpected_attributes.append(f"{path}:tuple-subclass")
        return None
    if isinstance(value, Mapping) and not isinstance(value, BaseModel) and type(value) is not dict:
        unexpected_attributes.append(f"{path}:mapping-subclass")
        return None
    if model_state and isinstance(value, Mapping) and not isinstance(value, BaseModel):
        unexpected_attributes.append(f"{path}:mapping-inside-model")
        return None

    if active_ids is None:
        active_ids = set()
    tracked = isinstance(value, (BaseModel, Mapping, list, tuple))
    identity = id(value)
    if tracked:
        if identity in active_ids:
            unexpected_attributes.append(f"{path}:cycle")
            return None
        active_ids.add(identity)

    try:
        if isinstance(value, BaseModel):
            expected_models = _annotation_model_types(expected_annotation)
            if not allow_model_instances:
                unexpected_attributes.append(f"{path}:model-inside-raw-mapping")
            if expected_annotation is not Any and type(value) not in expected_models:
                unexpected_attributes.append(f"{path}:unexpected-model-type")
            if not isinstance(value, ContractModel) or type(value).__bases__ != (ContractModel,):
                unexpected_attributes.append(f"{path}:model-subclass")
            fields = type(value).model_fields
            raw_fields_set = value.__pydantic_fields_set__
            if type(raw_fields_set) is not set:
                unexpected_attributes.append(f"{path}:fields-set-subclass")
                fields_set: set[str] = set()
            else:
                fields_set = set()
                for raw_name in raw_fields_set:
                    if type(raw_name) is not str:
                        unexpected_attributes.append(
                            f"{path}:non-plain-string-field-set-key"
                        )
                        continue
                    fields_set.add(raw_name)
            field_names = set(fields)
            model_values: dict[str, Any] = {}
            for raw_name, item in value.__dict__.items():
                if type(raw_name) is not str:
                    unexpected_attributes.append(
                        f"{path}:non-plain-string-model-key"
                    )
                    continue
                model_values[raw_name] = item
            rebuilt: dict[str, Any] = {}
            for name in fields_set - field_names:
                unexpected_attributes.append(f"{path}.{name}:unknown-field-set")
            if value.__pydantic_private__ is not None:
                unexpected_attributes.append(f"{path}:private-state")
            if value.__pydantic_extra__ is not None:
                unexpected_attributes.append(f"{path}:extra-state")
            for name, field in fields.items():
                if field.is_required() and name not in fields_set:
                    unexpected_attributes.append(f"{path}.{name}:required-not-set")
                if name not in model_values:
                    unexpected_attributes.append(f"{path}.{name}:missing")
                    continue
                item = model_values[name]
                if name not in fields_set and not field.is_required():
                    default = field.get_default(call_default_factory=False)
                    unchanged = item is default
                    if type(item) is type(default) and isinstance(
                        default,
                        (bool, int, float, str, bytes),
                    ):
                        unchanged = item == default
                    if not unchanged:
                        unexpected_attributes.append(f"{path}.{name}:not-set")
                    continue
                if isinstance(item, (bool, int, float, str, bytes)) and not (
                    _annotation_accepts_exact_scalar(field.annotation, item)
                ):
                    unexpected_attributes.append(f"{path}.{name}:scalar-type-drift")
                alias = field.alias or name
                rebuilt[alias] = _model_value_for_revalidation(
                    item,
                    unexpected_attributes,
                    f"{path}.{alias}",
                    active_ids,
                    True,
                    field.annotation,
                    allow_model_instances,
                )

            for name in model_values:
                if name not in fields:
                    unexpected_attributes.append(f"{path}.{name}")
            return rebuilt

        if isinstance(value, Mapping):
            rebuilt_mapping: dict[Any, Any] = {}
            for key, item in value.items():
                if type(key) is not str:
                    unexpected_attributes.append(f"{path}:non-plain-string-key")
                rebuilt_mapping[key] = _model_value_for_revalidation(
                    item,
                    unexpected_attributes,
                    f"{path}.{key}",
                    active_ids,
                    model_state,
                    Any,
                    allow_model_instances,
                )
            return rebuilt_mapping
        if isinstance(value, list):
            return [
                _model_value_for_revalidation(
                    item,
                    unexpected_attributes,
                    f"{path}[{index}]",
                    active_ids,
                    model_state,
                    _sequence_item_annotation(expected_annotation, index),
                    allow_model_instances,
                )
                for index, item in enumerate(value)
            ]
        if isinstance(value, tuple):
            return tuple(
                _model_value_for_revalidation(
                    item,
                    unexpected_attributes,
                    f"{path}[{index}]",
                    active_ids,
                    model_state,
                    _sequence_item_annotation(expected_annotation, index),
                    allow_model_instances,
                )
                for index, item in enumerate(value)
            )
        if value is not None and type(value) not in (bool, int, float, str, bytes):
            unexpected_attributes.append(f"{path}:non-json-value")
            return None
        return value
    finally:
        if tracked:
            active_ids.remove(identity)


def _annotation_accepts_exact_scalar(annotation: Any, value: Any) -> bool:
    origin = get_origin(annotation)
    if origin is Annotated:
        return _annotation_accepts_exact_scalar(get_args(annotation)[0], value)
    if origin is Literal:
        return any(type(value) is type(option) and value == option for option in get_args(annotation))
    if origin in (Union, types.UnionType):
        return any(_annotation_accepts_exact_scalar(option, value) for option in get_args(annotation))
    if annotation in (bool, int, float, str, bytes):
        return type(value) is annotation
    return False


def _annotation_model_types(annotation: Any) -> tuple[type[BaseModel], ...]:
    origin = get_origin(annotation)
    if origin is Annotated:
        return _annotation_model_types(get_args(annotation)[0])
    if origin in (Union, types.UnionType):
        return tuple(
            model_type
            for option in get_args(annotation)
            for model_type in _annotation_model_types(option)
        )
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return (annotation,)
    return ()


def _sequence_item_annotation(annotation: Any, index: int) -> Any:
    origin = get_origin(annotation)
    if origin is Annotated:
        return _sequence_item_annotation(get_args(annotation)[0], index)
    if origin is list:
        arguments = get_args(annotation)
        return arguments[0] if arguments else Any
    if origin is tuple:
        arguments = get_args(annotation)
        if len(arguments) == 2 and arguments[1] is Ellipsis:
            return arguments[0]
        return arguments[index] if index < len(arguments) else Any
    return Any


def _input_for_revalidation(value: Any, expected_model: type[BaseModel]) -> Any:
    unexpected_attributes: list[str] = []
    if isinstance(value, BaseModel) and type(value) is not expected_model:
        unexpected_attributes.append("$:unexpected-root-model")
    rebuilt = _model_value_for_revalidation(
        value,
        unexpected_attributes,
        model_state=isinstance(value, BaseModel),
        expected_annotation=expected_model,
        allow_model_instances=isinstance(value, BaseModel),
    )
    if unexpected_attributes and isinstance(rebuilt, dict):
        rebuilt["unexpectedModelAttributes"] = sorted(set(unexpected_attributes))
    return rebuilt


def validate_product_kit_catalogue(
    value: Any,
    context: Any,
) -> ProductKitCatalogue:
    """Validate syntax and catalogue-bound graph semantics, raising on failure."""

    catalogue = ProductKitCatalogue.model_validate(
        _input_for_revalidation(value, ProductKitCatalogue)
    )
    parsed_context = ProductKitCatalogueContext.model_validate(
        _input_for_revalidation(context, ProductKitCatalogueContext)
    )
    _validate_graph(catalogue, parsed_context)
    return catalogue


def parse_product_kit_catalogue(
    value: Any,
    context: Any,
) -> ProductKitCatalogue | None:
    """Return a validated catalogue or ``None``, matching the browser parser."""

    try:
        return validate_product_kit_catalogue(value, context)
    except Exception:
        return None


def canonical_json_bytes(
    value: BaseModel | Mapping[str, Any] | Sequence[Any],
) -> bytes:
    """Serialize sorted compact camelCase JSON as UTF-8 with one final LF."""

    payload: Any
    if isinstance(value, BaseModel):
        payload = value.model_dump(mode="json", by_alias=True, exclude_none=True)
    else:
        payload = value
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    )
    return f"{encoded}\n".encode("utf-8")


__all__ = [
    "AssetReference",
    "Bounds",
    "Certification",
    "CompatibilityProfile",
    "Component",
    "Fragment",
    "GridComponentFrame",
    "GridMountFrame",
    "GripComponentFrame",
    "GripMountFrame",
    "Kit",
    "Point",
    "ProductKitCatalogue",
    "ProductKitCatalogueAssetRecord",
    "ProductKitCatalogueContext",
    "RasterFrame",
    "SocketComponentFrame",
    "SocketMountFrame",
    "TransformConstraints",
    "canonical_json_bytes",
    "parse_product_kit_catalogue",
    "validate_product_kit_catalogue",
]
