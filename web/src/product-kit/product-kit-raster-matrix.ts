import type {
  ProductKitBaseRasterEntry,
  ProductKitComponentRasterEntry
} from "./layer-plan";
import type { ProductKitRasterFrame } from "./product-kit-catalogue";
import { snapshotPlainData } from "./plain-data";

export type ProductKitRasterMatrix =
  readonly [number, number, number, number, number, number];

interface NormalizedAffineMatrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
}

const MAX_FRAME_DIMENSION = 8192;
const UNIT_INTERVAL_ENDPOINT_TOLERANCE = Number.EPSILON * 2;
const IDENTITY_MATRIX: NormalizedAffineMatrix = Object.freeze({
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0
});

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

function isContractNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    !Object.is(value, -0);
}

function isFrameInteger(value: unknown, minimum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    !Object.is(value, -0) && value >= minimum && value <= MAX_FRAME_DIMENSION;
}

function isRasterFrame(value: unknown): value is ProductKitRasterFrame {
  if (!isRecord(value) || !hasExactKeys(value, [
    "originalWidth",
    "originalHeight",
    "trimX",
    "trimY",
    "trimWidth",
    "trimHeight"
  ]) ||
    !isFrameInteger(value.originalWidth, 1) ||
    !isFrameInteger(value.originalHeight, 1) ||
    !isFrameInteger(value.trimX, 0) ||
    !isFrameInteger(value.trimY, 0) ||
    !isFrameInteger(value.trimWidth, 1) ||
    !isFrameInteger(value.trimHeight, 1)) return false;
  return value.trimX + value.trimWidth <= value.originalWidth &&
    value.trimY + value.trimHeight <= value.originalHeight;
}

function sameRasterFrame(
  left: ProductKitRasterFrame,
  right: ProductKitRasterFrame
): boolean {
  return left.originalWidth === right.originalWidth &&
    left.originalHeight === right.originalHeight &&
    left.trimX === right.trimX && left.trimY === right.trimY &&
    left.trimWidth === right.trimWidth && left.trimHeight === right.trimHeight;
}

function isAffineMatrix(value: unknown): value is NormalizedAffineMatrix {
  return isRecord(value) && hasExactKeys(value, ["a", "b", "c", "d", "e", "f"]) && [
    value.a,
    value.b,
    value.c,
    value.d,
    value.e,
    value.f
  ].every(isContractNumber);
}

function canonicalUnitExtent(start: number, extent: number): number | null {
  const endpoint = start + extent;
  if (endpoint < 1) return extent;
  if (endpoint > 1 + UNIT_INTERVAL_ENDPOINT_TOLERANCE) return null;
  const canonical = 1 - start;
  return isContractNumber(canonical) && canonical > 0 ? canonical : null;
}

function gridMatrix(value: unknown): NormalizedAffineMatrix | null {
  if (!isRecord(value) || !hasExactKeys(value, ["x", "y", "width", "height"]) ||
    !isContractNumber(value.x) || value.x < 0 || value.x > 1 ||
    !isContractNumber(value.y) || value.y < 0 || value.y > 1 ||
    !isContractNumber(value.width) || value.width <= 0 || value.width > 1 ||
    !isContractNumber(value.height) || value.height <= 0 || value.height > 1) return null;
  const width = canonicalUnitExtent(value.x, value.width);
  const height = canonicalUnitExtent(value.y, value.height);
  if (width === null || height === null) return null;
  return {
    a: width,
    b: 0,
    c: 0,
    d: height,
    e: value.x,
    f: value.y
  };
}

function accurateFiniteSum(values: readonly number[]): number | null {
  const partials: number[] = [];
  for (const value of values) {
    if (!Number.isFinite(value)) return null;
    let next = value;
    let writeIndex = 0;
    for (let readIndex = 0; readIndex < partials.length; readIndex += 1) {
      let partial = partials[readIndex]!;
      if (Math.abs(next) < Math.abs(partial)) {
        const swap = next;
        next = partial;
        partial = swap;
      }
      const high = next + partial;
      if (!Number.isFinite(high)) return null;
      const low = partial - (high - next);
      if (!Number.isFinite(low)) return null;
      if (low !== 0) {
        partials[writeIndex] = low;
        writeIndex += 1;
      }
      next = high;
    }
    partials.length = writeIndex;
    partials.push(next);
  }
  let result = 0;
  for (const partial of partials) {
    result += partial;
    if (!Number.isFinite(result)) return null;
  }
  return Object.is(result, -0) ? 0 : result;
}

function accurateTranslationCombination(
  baseDimension: number,
  firstOutputCoefficient: number,
  firstMatrixCoefficient: number,
  firstTrimCentre: number,
  firstSourceDimension: number,
  secondOutputCoefficient: number,
  secondMatrixCoefficient: number,
  secondTrimCentre: number,
  secondSourceDimension: number,
  offset: number
): number | null {
  const pixelResult = accurateFiniteSum([
    firstOutputCoefficient * firstTrimCentre,
    secondOutputCoefficient * secondTrimCentre,
    baseDimension * offset,
    -baseDimension / 2
  ]);
  if (pixelResult !== null) return pixelResult;

  const normalized = accurateFiniteSum([
    firstMatrixCoefficient * (firstTrimCentre / firstSourceDimension),
    secondMatrixCoefficient * (secondTrimCentre / secondSourceDimension),
    offset,
    -0.5
  ]);
  if (normalized === null) return null;
  const result = baseDimension * normalized;
  if (!Number.isFinite(result)) return null;
  return Object.is(result, -0) ? 0 : result;
}

function isRasterReference(
  value: unknown
): value is ProductKitBaseRasterEntry["raster"] {
  return isRecord(value) && hasExactKeys(value, [
    "assetId",
    "masterSha256",
    "frame"
  ]) && typeof value.assetId === "string" &&
    typeof value.masterSha256 === "string" && isRasterFrame(value.frame);
}

function isBaseRasterEntry(value: unknown): value is ProductKitBaseRasterEntry {
  return isRecord(value) && hasExactKeys(value, ["kind", "itemId", "raster"]) &&
    value.kind === "base-raster" && typeof value.itemId === "string" &&
    isRasterReference(value.raster);
}

function isResolvedTransform(
  value: unknown
): value is Extract<
  ProductKitComponentRasterEntry["geometry"],
  { readonly kind: "affine" }
>["transform"] {
  if (!isRecord(value) || !hasExactKeys(value, [
    "matrix",
    "scale",
    "rotationDegrees",
    "mirrored",
    "maxNormalErrorDegrees"
  ]) || !isAffineMatrix(value.matrix) ||
    !isContractNumber(value.scale) || value.scale <= 0 ||
    !isContractNumber(value.rotationDegrees) ||
    value.rotationDegrees < -180 || value.rotationDegrees > 180 ||
    typeof value.mirrored !== "boolean" ||
    !isContractNumber(value.maxNormalErrorDegrees) ||
    value.maxNormalErrorDegrees < 0 || value.maxNormalErrorDegrees > 180) return false;
  return true;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    !Object.is(value, -0) && value >= 0;
}

function isComponentGeometry(
  value: unknown
): value is ProductKitComponentRasterEntry["geometry"] {
  if (!isRecord(value)) return false;
  if (value.kind === "affine") {
    return hasExactKeys(value, ["kind", "transform"]) &&
      isResolvedTransform(value.transform);
  }
  return value.kind === "grid" && hasExactKeys(value, [
    "kind",
    "column",
    "row",
    "normalizedBounds"
  ]) && isNonNegativeSafeInteger(value.column) &&
    isNonNegativeSafeInteger(value.row) && gridMatrix(value.normalizedBounds) !== null;
}

function isComponentRasterEntry(
  value: unknown
): value is ProductKitComponentRasterEntry {
  return isRecord(value) && hasExactKeys(value, [
    "kind",
    "itemId",
    "placementId",
    "mountFrameId",
    "componentId",
    "raster",
    "geometry"
  ]) && value.kind === "component-raster" &&
    typeof value.itemId === "string" && typeof value.placementId === "string" &&
    typeof value.mountFrameId === "string" && typeof value.componentId === "string" &&
    isRasterReference(value.raster) && isComponentGeometry(value.geometry);
}

function productKitRasterMatrixFromSnapshot(
  baseFrame: unknown,
  entry: unknown
): ProductKitRasterMatrix | null {
  if (!isRasterFrame(baseFrame)) return null;

  let sourceFrame: ProductKitRasterFrame;
  let matrix: NormalizedAffineMatrix;
  if (isBaseRasterEntry(entry)) {
    if (!sameRasterFrame(baseFrame, entry.raster.frame)) return null;
    sourceFrame = baseFrame;
    matrix = IDENTITY_MATRIX;
  } else if (isComponentRasterEntry(entry)) {
    sourceFrame = entry.raster.frame;
    if (entry.geometry.kind === "affine") {
      matrix = entry.geometry.transform.matrix;
    } else {
      const normalizedBoundsMatrix = gridMatrix(entry.geometry.normalizedBounds);
      if (normalizedBoundsMatrix === null) return null;
      matrix = normalizedBoundsMatrix;
    }
  } else {
    return null;
  }

  const sourceWidth = sourceFrame.originalWidth;
  const sourceHeight = sourceFrame.originalHeight;
  const baseWidth = baseFrame.originalWidth;
  const baseHeight = baseFrame.originalHeight;
  const trimCentreX = sourceFrame.trimX + sourceFrame.trimWidth / 2;
  const trimCentreY = sourceFrame.trimY + sourceFrame.trimHeight / 2;
  const a = matrix.a * (baseWidth / sourceWidth);
  const b = matrix.b * (baseHeight / sourceWidth);
  const c = matrix.c * (baseWidth / sourceHeight);
  const d = matrix.d * (baseHeight / sourceHeight);
  const e = accurateTranslationCombination(
    baseWidth,
    a,
    matrix.a,
    trimCentreX,
    sourceWidth,
    c,
    matrix.c,
    trimCentreY,
    sourceHeight,
    matrix.e
  );
  const f = accurateTranslationCombination(
    baseHeight,
    b,
    matrix.b,
    trimCentreX,
    sourceWidth,
    d,
    matrix.d,
    trimCentreY,
    sourceHeight,
    matrix.f
  );
  if (e === null || f === null) return null;
  const result: ProductKitRasterMatrix = [
    a,
    b,
    c,
    d,
    e,
    f
  ];
  return result.every(isContractNumber) ? Object.freeze(result) : null;
}

export function productKitRasterMatrix(
  baseFrame: ProductKitRasterFrame,
  entry: ProductKitBaseRasterEntry | ProductKitComponentRasterEntry
): ProductKitRasterMatrix | null {
  const snapshot = snapshotPlainData(
    [baseFrame, entry] as const,
    { maxDepth: 8, maxNodes: 128, maxArrayLength: 2 }
  );
  return snapshot === null
    ? null
    : productKitRasterMatrixFromSnapshot(snapshot[0], snapshot[1]);
}
