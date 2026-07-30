import { snapshotPlainData } from "./plain-data";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Vector {
  readonly x: number;
  readonly y: number;
}

export interface AffineTransform {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

export interface SocketFrame {
  readonly point: Point;
  readonly normal: Vector;
  readonly referenceScale: number;
}

export interface GripFrame {
  readonly contacts: readonly [Point, Point];
  readonly normals: readonly [Vector, Vector];
}

export interface TransformConstraints {
  readonly minScale: number;
  readonly maxScale: number;
  readonly minRotationDegrees: number;
  readonly maxRotationDegrees: number;
  readonly maxNormalErrorDegrees: number;
  readonly mirrorAllowed: boolean;
}

export interface ResolvedMountTransform {
  readonly matrix: AffineTransform;
  readonly scale: number;
  readonly rotationDegrees: number;
  readonly mirrored: boolean;
  readonly maxNormalErrorDegrees: number;
}

interface Candidate extends ResolvedMountTransform {
  readonly averageNormalErrorDegrees: number;
}

interface MagnitudeParts {
  readonly largestComponent: number;
  readonly scaledLength: number;
}

interface UnitRotation {
  readonly cosine: number;
  readonly sine: number;
  readonly radians: number;
  readonly degrees: number;
}

const CONTACT_TOLERANCE = 1e-8;
const RAD_TO_DEGREES = 180 / Math.PI;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[]
): boolean {
  const keys = Reflect.ownKeys(value);
  return keys.length === expected.length && keys.every((key) =>
    typeof key === "string" && expected.includes(key)
  );
}

function hasOwnDenseIndices(value: readonly unknown[]): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) return false;
  }
  return true;
}

function isFiniteContractNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    !Object.is(value, -0);
}

const finitePoint = (value: unknown): value is Point =>
  isRecord(value) && hasExactKeys(value, ["x", "y"]) &&
  isFiniteContractNumber(value.x) && isFiniteContractNumber(value.y);

const finiteComputedPoint = (value: unknown): value is Point =>
  isRecord(value) && hasExactKeys(value, ["x", "y"]) &&
  typeof value.x === "number" && Number.isFinite(value.x) &&
  typeof value.y === "number" && Number.isFinite(value.y);

function spanBetween(first: Point, second: Point): Vector | null {
  const span = { x: second.x - first.x, y: second.y - first.y };
  return finiteComputedPoint(span) ? span : null;
}

function magnitudeParts(value: Vector): MagnitudeParts | null {
  const largestComponent = Math.max(Math.abs(value.x), Math.abs(value.y));
  if (largestComponent === 0) return null;
  return {
    largestComponent,
    scaledLength: Math.hypot(value.x / largestComponent, value.y / largestComponent)
  };
}

function magnitudeRatio(
  target: MagnitudeParts,
  source: MagnitudeParts
): number {
  if (target.scaledLength <= source.scaledLength) {
    return (target.largestComponent /
      (source.scaledLength / target.scaledLength)) / source.largestComponent;
  }
  return target.largestComponent /
    (source.largestComponent / (target.scaledLength / source.scaledLength));
}

function normalized(value: Vector): Vector | null {
  if (!finiteComputedPoint(value)) return null;
  const largestComponent = Math.max(Math.abs(value.x), Math.abs(value.y));
  if (largestComponent === 0) return null;
  const scaledX = value.x / largestComponent;
  const scaledY = value.y / largestComponent;
  const scaledLength = Math.hypot(scaledX, scaledY);
  return { x: scaledX / scaledLength, y: scaledY / scaledLength };
}

function validConstraints(value: unknown): value is TransformConstraints {
  if (!isRecord(value) || !hasExactKeys(value, [
    "minScale",
    "maxScale",
    "minRotationDegrees",
    "maxRotationDegrees",
    "maxNormalErrorDegrees",
    "mirrorAllowed"
  ])) return false;
  const constraints = value as unknown as TransformConstraints;
  return isFiniteContractNumber(constraints.minScale) && constraints.minScale > 0 &&
    isFiniteContractNumber(constraints.maxScale) &&
    constraints.maxScale >= constraints.minScale &&
    isFiniteContractNumber(constraints.minRotationDegrees) &&
    constraints.minRotationDegrees >= -180 &&
    isFiniteContractNumber(constraints.maxRotationDegrees) &&
    constraints.maxRotationDegrees <= 180 &&
    constraints.maxRotationDegrees >= constraints.minRotationDegrees &&
    isFiniteContractNumber(constraints.maxNormalErrorDegrees) &&
    constraints.maxNormalErrorDegrees >= 0 &&
    constraints.maxNormalErrorDegrees <= 180 &&
    typeof constraints.mirrorAllowed === "boolean";
}

function validSocketFrame(value: unknown): value is SocketFrame {
  return isRecord(value) && finitePoint(value.point) && finitePoint(value.normal) &&
    isFiniteContractNumber(value.referenceScale) && value.referenceScale > 0;
}

function validGripFrame(value: unknown): value is GripFrame {
  return isRecord(value) &&
    Array.isArray(value.contacts) && value.contacts.length === 2 &&
    hasOwnDenseIndices(value.contacts) &&
    value.contacts.every(finitePoint) &&
    Array.isArray(value.normals) && value.normals.length === 2 &&
    hasOwnDenseIndices(value.normals) &&
    value.normals.every(finitePoint);
}

function rotationBetween(source: Vector, target: Vector): UnitRotation | null {
  const cosine = source.x * target.x + source.y * target.y;
  const sine = source.x * target.y - source.y * target.x;
  const unit = normalized({ x: cosine, y: sine });
  if (!unit) return null;
  const radians = Math.atan2(unit.y, unit.x);
  const degrees = radians * RAD_TO_DEGREES;
  return {
    cosine: unit.x,
    sine: unit.y,
    radians: Object.is(radians, -0) ? 0 : radians,
    degrees: Object.is(degrees, -0) ? 0 : degrees
  };
}

function withinConstraints(
  scale: number,
  rotationDegrees: number,
  constraints: TransformConstraints
): boolean {
  return Number.isFinite(scale) && Number.isFinite(rotationDegrees) &&
    scale >= constraints.minScale && scale <= constraints.maxScale &&
    rotationDegrees >= constraints.minRotationDegrees &&
    rotationDegrees <= constraints.maxRotationDegrees;
}

const finiteMatrix = (matrix: AffineTransform): boolean =>
  Object.values(matrix).every(Number.isFinite);

function affineFor(
  sourcePoint: Point,
  targetPoint: Point,
  scale: number,
  rotation: UnitRotation,
  mirrored: boolean
): AffineTransform {
  const mirrorX = mirrored ? -1 : 1;
  const a = rotation.cosine * scale * mirrorX;
  const b = rotation.sine * scale * mirrorX;
  const c = -rotation.sine * scale;
  const d = rotation.cosine * scale;
  const withoutNegativeZero = (value: number): number =>
    Object.is(value, -0) ? 0 : value;
  return {
    a: withoutNegativeZero(a),
    b: withoutNegativeZero(b),
    c: withoutNegativeZero(c),
    d: withoutNegativeZero(d),
    e: withoutNegativeZero(targetPoint.x - (a * sourcePoint.x + c * sourcePoint.y)),
    f: withoutNegativeZero(targetPoint.y - (b * sourcePoint.x + d * sourcePoint.y))
  };
}

function transformedNormal(
  source: Vector,
  rotation: UnitRotation,
  mirrored: boolean
): Vector {
  const x = mirrored ? -source.x : source.x;
  return {
    x: rotation.cosine * x - rotation.sine * source.y,
    y: rotation.sine * x + rotation.cosine * source.y
  };
}

function angularErrorDegrees(left: Vector, right: Vector): number {
  const cross = left.x * right.y - left.y * right.x;
  const dot = left.x * right.x + left.y * right.y;
  return Math.atan2(Math.abs(cross), dot) * RAD_TO_DEGREES;
}

function contactResidualIsAcceptable(
  matrix: AffineTransform,
  source: Point,
  target: Point
): boolean {
  const transformed = applyTransform(matrix, source);
  if (!finiteComputedPoint(transformed)) return false;
  const residual = Math.hypot(transformed.x - target.x, transformed.y - target.y);
  return Number.isFinite(residual) && residual <= CONTACT_TOLERANCE;
}

export function applyTransform(matrix: AffineTransform, point: Point): Point {
  return {
    x: matrix.a * point.x + matrix.c * point.y + matrix.e,
    y: matrix.b * point.x + matrix.d * point.y + matrix.f
  };
}

export function resolveSocketTransform(
  source: SocketFrame,
  target: SocketFrame,
  constraints: TransformConstraints
): ResolvedMountTransform | null {
  const safeSource = snapshotPlainData(source, { maxNodes: 256 });
  const safeTarget = snapshotPlainData(target, { maxNodes: 256 });
  const safeConstraints = snapshotPlainData(constraints, { maxNodes: 64 });
  if (!safeSource || !safeTarget || !safeConstraints ||
    !validConstraints(safeConstraints) || !validSocketFrame(safeSource) ||
    !validSocketFrame(safeTarget)) return null;
  const sourceNormal = normalized(safeSource.normal);
  const targetNormal = normalized(safeTarget.normal);
  if (!sourceNormal || !targetNormal) return null;

  const scale = safeTarget.referenceScale / safeSource.referenceScale;
  const rotation = rotationBetween(sourceNormal, targetNormal);
  if (!rotation || !withinConstraints(scale, rotation.degrees, safeConstraints)) return null;

  const matrix = affineFor(safeSource.point, safeTarget.point, scale, rotation, false);
  if (!finiteMatrix(matrix)) return null;
  const normalError = angularErrorDegrees(
    transformedNormal(sourceNormal, rotation, false),
    targetNormal
  );
  if (normalError > safeConstraints.maxNormalErrorDegrees ||
    !contactResidualIsAcceptable(matrix, safeSource.point, safeTarget.point)) return null;

  return {
    matrix,
    scale,
    rotationDegrees: rotation.degrees,
    mirrored: false,
    maxNormalErrorDegrees: normalError
  };
}

function gripCandidate(
  source: GripFrame,
  target: GripFrame,
  sourceNormals: readonly [Vector, Vector],
  targetNormals: readonly [Vector, Vector],
  scale: number,
  constraints: TransformConstraints,
  mirrored: boolean
): Candidate | null {
  const sourceSpan = {
    x: source.contacts[1].x - source.contacts[0].x,
    y: source.contacts[1].y - source.contacts[0].y
  };
  const targetSpan = {
    x: target.contacts[1].x - target.contacts[0].x,
    y: target.contacts[1].y - target.contacts[0].y
  };
  const reflectedSourceSpan = {
    x: mirrored ? -sourceSpan.x : sourceSpan.x,
    y: sourceSpan.y
  };
  const sourceDirection = normalized(reflectedSourceSpan);
  const targetDirection = normalized(targetSpan);
  if (!sourceDirection || !targetDirection) return null;
  const rotation = rotationBetween(sourceDirection, targetDirection);
  if (!rotation || !withinConstraints(scale, rotation.degrees, constraints)) return null;

  const matrix = affineFor(
    source.contacts[0],
    target.contacts[0],
    scale,
    rotation,
    mirrored
  );
  if (!finiteMatrix(matrix) ||
    !contactResidualIsAcceptable(matrix, source.contacts[0], target.contacts[0]) ||
    !contactResidualIsAcceptable(matrix, source.contacts[1], target.contacts[1])) return null;

  const errors = sourceNormals.map((normal, index) => angularErrorDegrees(
    transformedNormal(normal, rotation, mirrored),
    targetNormals[index]!
  ));
  const maxNormalErrorDegrees = Math.max(...errors);
  if (maxNormalErrorDegrees > constraints.maxNormalErrorDegrees) return null;

  return {
    matrix,
    scale,
    rotationDegrees: rotation.degrees,
    mirrored,
    maxNormalErrorDegrees,
    averageNormalErrorDegrees: (errors[0]! + errors[1]!) / 2
  };
}

export function resolveGripTransform(
  source: GripFrame,
  target: GripFrame,
  constraints: TransformConstraints
): ResolvedMountTransform | null {
  const safeSource = snapshotPlainData(source, { maxNodes: 256 });
  const safeTarget = snapshotPlainData(target, { maxNodes: 256 });
  const safeConstraints = snapshotPlainData(constraints, { maxNodes: 64 });
  if (!safeSource || !safeTarget || !safeConstraints ||
    !validConstraints(safeConstraints) || !validGripFrame(safeSource) ||
    !validGripFrame(safeTarget)) return null;

  const sourceNormals = safeSource.normals.map(normalized);
  const targetNormals = safeTarget.normals.map(normalized);
  if (sourceNormals.some((value) => value === null) ||
    targetNormals.some((value) => value === null)) return null;

  const sourceSpan = spanBetween(safeSource.contacts[0], safeSource.contacts[1]);
  const targetSpan = spanBetween(safeTarget.contacts[0], safeTarget.contacts[1]);
  if (!sourceSpan || !targetSpan) return null;
  const sourceMagnitude = magnitudeParts(sourceSpan);
  const targetMagnitude = magnitudeParts(targetSpan);
  if (!sourceMagnitude || !targetMagnitude) return null;
  const scale = magnitudeRatio(targetMagnitude, sourceMagnitude);
  const normalizedSource = sourceNormals as unknown as readonly [Vector, Vector];
  const normalizedTarget = targetNormals as unknown as readonly [Vector, Vector];
  const candidates = [
    gripCandidate(
      safeSource,
      safeTarget,
      normalizedSource,
      normalizedTarget,
      scale,
      safeConstraints,
      false
    ),
    safeConstraints.mirrorAllowed
      ? gripCandidate(
        safeSource,
        safeTarget,
        normalizedSource,
        normalizedTarget,
        scale,
        safeConstraints,
        true
      )
      : null
  ].filter((candidate): candidate is Candidate => candidate !== null);

  candidates.sort((left, right) =>
    left.maxNormalErrorDegrees - right.maxNormalErrorDegrees ||
    left.averageNormalErrorDegrees - right.averageNormalErrorDegrees ||
    Number(left.mirrored) - Number(right.mirrored)
  );
  const best = candidates[0];
  if (!best) return null;
  const { averageNormalErrorDegrees: _average, ...resolved } = best;
  return resolved;
}
