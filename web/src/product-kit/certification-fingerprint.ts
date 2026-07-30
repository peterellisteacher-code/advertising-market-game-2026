import type {
  ProductKitComponent,
  ProductKitKit,
  ProductKitMountFrame
} from "./product-kit-catalogue";
import { snapshotPlainData } from "./plain-data";
import { sha256Utf8 } from "./utf8-sha256";

const SHA256 = /^[0-9a-f]{64}(?![\s\S])/;
const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;
const PRODUCT_KIT_ID = /^pk1-[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;
const CERTIFICATION_SCHEMA = "product-kit-certification@1";
const CERTIFICATION_VERSION = 1;
const INVALID_EDGE = Symbol("invalid-grid-edge");

type CanonicalObject = Readonly<Record<string, unknown>>;

export interface ProductKitCertificationContext {
  readonly packId: string;
  readonly connectorFormulaVersion: string;
}

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

function isWellFormedString(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    !Object.is(value, -0);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    !Object.is(value, -0);
}

function isPortableId(value: unknown): value is string {
  return isWellFormedString(value) && value.length <= 80 && PORTABLE_ID.test(value);
}

function isProductKitId(value: unknown): value is string {
  return isWellFormedString(value) && value.length <= 80 && PRODUCT_KIT_ID.test(value);
}

function canonicalPoint(value: unknown): CanonicalObject | null {
  if (!isRecord(value) || !hasExactKeys(value, ["x", "y"]) ||
    !isFiniteNumber(value.x) || value.x < 0 || value.x > 1 ||
    !isFiniteNumber(value.y) || value.y < 0 || value.y > 1) {
    return null;
  }
  return { x: value.x, y: value.y };
}

function canonicalNormal(value: unknown): CanonicalObject | null {
  if (!isRecord(value) || !hasExactKeys(value, ["x", "y"]) ||
    !isFiniteNumber(value.x) || value.x < -1 || value.x > 1 ||
    !isFiniteNumber(value.y) || value.y < -1 || value.y > 1 ||
    (value.x === 0 && value.y === 0)) return null;
  return { x: value.x, y: value.y };
}

function canonicalProfile(value: unknown): CanonicalObject | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "familyId", "perspectiveId", "geometryId", "styleId"
  ]) || !isProductKitId(value.familyId) ||
    !isProductKitId(value.perspectiveId) ||
    !isProductKitId(value.geometryId) ||
    !isProductKitId(value.styleId)) return null;
  return {
    familyId: value.familyId,
    perspectiveId: value.perspectiveId,
    geometryId: value.geometryId,
    styleId: value.styleId
  };
}

function canonicalRasterFrame(value: unknown): CanonicalObject | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "originalWidth", "originalHeight", "trimX", "trimY", "trimWidth", "trimHeight"
  ]) ||
    !isSafeInteger(value.originalWidth) ||
    !isSafeInteger(value.originalHeight) ||
    !isSafeInteger(value.trimX) ||
    !isSafeInteger(value.trimY) ||
    !isSafeInteger(value.trimWidth) ||
    !isSafeInteger(value.trimHeight) ||
    value.originalWidth < 1 || value.originalWidth > 8192 ||
    value.originalHeight < 1 || value.originalHeight > 8192 ||
    value.trimX < 0 || value.trimX > 8191 ||
    value.trimY < 0 || value.trimY > 8191 ||
    value.trimWidth < 1 || value.trimWidth > 8192 ||
    value.trimHeight < 1 || value.trimHeight > 8192 ||
    value.trimX + value.trimWidth > value.originalWidth ||
    value.trimY + value.trimHeight > value.originalHeight) return null;
  return {
    originalWidth: value.originalWidth,
    originalHeight: value.originalHeight,
    trimX: value.trimX,
    trimY: value.trimY,
    trimWidth: value.trimWidth,
    trimHeight: value.trimHeight
  };
}

function canonicalRaster(value: unknown): CanonicalObject | null {
  if (!isRecord(value) || !hasExactKeys(value, ["assetId", "masterSha256", "frame"]) ||
    !isPortableId(value.assetId) ||
    typeof value.masterSha256 !== "string" ||
    !SHA256.test(value.masterSha256)) return null;
  const frame = canonicalRasterFrame(value.frame);
  if (!frame) return null;
  return {
    assetId: value.assetId,
    masterSha256: value.masterSha256,
    frame
  };
}

function canonicalConstraints(value: unknown): CanonicalObject | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "minScale", "maxScale", "minRotationDegrees", "maxRotationDegrees",
    "maxNormalErrorDegrees", "mirrorAllowed"
  ]) ||
    !isFiniteNumber(value.minScale) ||
    !isFiniteNumber(value.maxScale) ||
    !isFiniteNumber(value.minRotationDegrees) ||
    !isFiniteNumber(value.maxRotationDegrees) ||
    !isFiniteNumber(value.maxNormalErrorDegrees) ||
    typeof value.mirrorAllowed !== "boolean" ||
    value.minScale <= 0 || value.minScale > 8 ||
    value.maxScale <= 0 || value.maxScale > 8 || value.minScale > value.maxScale ||
    value.minRotationDegrees < -180 || value.minRotationDegrees > 180 ||
    value.maxRotationDegrees < -180 || value.maxRotationDegrees > 180 ||
    value.minRotationDegrees > value.maxRotationDegrees ||
    value.maxNormalErrorDegrees < 0 || value.maxNormalErrorDegrees > 45) return null;
  return {
    minScale: value.minScale,
    maxScale: value.maxScale,
    minRotationDegrees: value.minRotationDegrees,
    maxRotationDegrees: value.maxRotationDegrees,
    maxNormalErrorDegrees: value.maxNormalErrorDegrees,
    mirrorAllowed: value.mirrorAllowed
  };
}

function canonicalPair(
  value: unknown,
  canonicalItem: (item: unknown) => CanonicalObject | null
): readonly [CanonicalObject, CanonicalObject] | null {
  if (!Array.isArray(value) || value.length !== 2 ||
    !hasOwnDenseIndices(value)) return null;
  const first = canonicalItem(value[0]);
  const second = canonicalItem(value[1]);
  return first && second ? [first, second] : null;
}

function canonicalMountFrame(value: unknown): CanonicalObject | null {
  if (!isRecord(value) ||
    !isProductKitId(value.id) ||
    !isProductKitId(value.slotId)) return null;

  if (value.mountType === "socket") {
    if (!hasExactKeys(value, [
      "id", "slotId", "mountType", "point", "normal", "referenceScale", "constraints"
    ])) return null;
    const point = canonicalPoint(value.point);
    const normal = canonicalNormal(value.normal);
    const constraints = canonicalConstraints(value.constraints);
    if (!point || !normal || !isFiniteNumber(value.referenceScale) ||
      value.referenceScale <= 0 || value.referenceScale > 2 || !constraints) return null;
    return {
      id: value.id,
      slotId: value.slotId,
      mountType: "socket",
      point,
      normal,
      referenceScale: value.referenceScale,
      constraints
    };
  }

  if (value.mountType === "grip") {
    if (!hasExactKeys(value, [
      "id", "slotId", "mountType", "contacts", "normals", "constraints"
    ])) return null;
    const contacts = canonicalPair(value.contacts, canonicalPoint);
    const normals = canonicalPair(value.normals, canonicalNormal);
    const constraints = canonicalConstraints(value.constraints);
    if (!contacts || !normals || !constraints || sameCanonicalValue(
      contacts[0], contacts[1]
    )) return null;
    return {
      id: value.id,
      slotId: value.slotId,
      mountType: "grip",
      contacts,
      normals,
      constraints
    };
  }

  if (value.mountType === "grid") {
    if (!hasExactKeys(value, [
      "id", "slotId", "mountType", "origin", "cellSize", "columns", "rows",
      "plane", "acceptedEdgeTypes"
    ])) return null;
    const origin = canonicalPoint(value.origin);
    if (!isRecord(value.cellSize) || !hasExactKeys(value.cellSize, ["width", "height"]) ||
      !isFiniteNumber(value.cellSize.width) ||
      !isFiniteNumber(value.cellSize.height) ||
      !isSafeInteger(value.columns) ||
      !isSafeInteger(value.rows) ||
      (value.plane !== "floor" && value.plane !== "wall") ||
      !Array.isArray(value.acceptedEdgeTypes) ||
      !hasOwnDenseIndices(value.acceptedEdgeTypes) ||
      value.acceptedEdgeTypes.length > 32 ||
      !value.acceptedEdgeTypes.every(isProductKitId) ||
      !value.acceptedEdgeTypes.every((edge, index, edges) =>
        index === 0 || edges[index - 1]! < edge
      ) || !origin || value.cellSize.width <= 0 || value.cellSize.width > 1 ||
      value.cellSize.height <= 0 || value.cellSize.height > 1 ||
      value.columns < 1 || value.columns > 64 || value.rows < 1 || value.rows > 64 ||
      (origin.x as number) + value.cellSize.width * value.columns > 1 ||
      (origin.y as number) + value.cellSize.height * value.rows > 1) return null;
    return {
      id: value.id,
      slotId: value.slotId,
      mountType: "grid",
      origin,
      cellSize: {
        width: value.cellSize.width,
        height: value.cellSize.height
      },
      columns: value.columns,
      rows: value.rows,
      plane: value.plane,
      acceptedEdgeTypes: [...value.acceptedEdgeTypes]
    };
  }

  return null;
}

function canonicalOptionalEdge(value: unknown): string | null | typeof INVALID_EDGE {
  if (value === undefined) return null;
  return isProductKitId(value) ? value : INVALID_EDGE;
}

function canonicalComponentFrame(value: unknown): CanonicalObject | null {
  if (!isRecord(value)) return null;

  if (value.mountType === "socket") {
    if (!hasExactKeys(value, ["mountType", "point", "normal", "referenceScale"])) {
      return null;
    }
    const point = canonicalPoint(value.point);
    const normal = canonicalNormal(value.normal);
    if (!point || !normal || !isFiniteNumber(value.referenceScale) ||
      value.referenceScale <= 0 || value.referenceScale > 2) return null;
    return {
      mountType: "socket",
      point,
      normal,
      referenceScale: value.referenceScale
    };
  }

  if (value.mountType === "grip") {
    if (!hasExactKeys(value, ["mountType", "contacts", "normals"])) return null;
    const contacts = canonicalPair(value.contacts, canonicalPoint);
    const normals = canonicalPair(value.normals, canonicalNormal);
    if (!contacts || !normals || sameCanonicalValue(contacts[0], contacts[1])) return null;
    return { mountType: "grip", contacts, normals };
  }

  if (value.mountType === "grid") {
    if (!hasExactKeys(value, ["mountType", "plane", "footprint", "edgeTypes"]) ||
      (value.plane !== "floor" && value.plane !== "wall") ||
      !isRecord(value.footprint) ||
      !hasExactKeys(value.footprint, ["columns", "rows"]) ||
      !isSafeInteger(value.footprint.columns) ||
      !isSafeInteger(value.footprint.rows) ||
      value.footprint.columns < 1 || value.footprint.columns > 64 ||
      value.footprint.rows < 1 || value.footprint.rows > 64 ||
      !isRecord(value.edgeTypes) || Reflect.ownKeys(value.edgeTypes).some((key) =>
        typeof key !== "string" || !["north", "east", "south", "west"].includes(key)
      )) return null;
    const north = canonicalOptionalEdge(value.edgeTypes.north);
    const east = canonicalOptionalEdge(value.edgeTypes.east);
    const south = canonicalOptionalEdge(value.edgeTypes.south);
    const west = canonicalOptionalEdge(value.edgeTypes.west);
    if (north === INVALID_EDGE || east === INVALID_EDGE ||
      south === INVALID_EDGE || west === INVALID_EDGE) return null;
    return {
      mountType: "grid",
      plane: value.plane,
      footprint: {
        columns: value.footprint.columns,
        rows: value.footprint.rows
      },
      edgeTypes: { north, east, south, west }
    };
  }

  return null;
}

function canonicalFragment(value: unknown): CanonicalObject | null {
  if (!isRecord(value) || !hasExactKeys(value, ["layer", "raster"]) ||
    (value.layer !== "rear" && value.layer !== "front" && value.layer !== "overlay")) {
    return null;
  }
  const raster = canonicalRaster(value.raster);
  return raster ? { layer: value.layer, raster } : null;
}

function canonicalFragments(value: unknown): readonly CanonicalObject[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 3 ||
    !hasOwnDenseIndices(value)) return null;
  const fragments: CanonicalObject[] = [];
  for (const fragment of value) {
    const canonical = canonicalFragment(fragment);
    if (!canonical) return null;
    if (fragments.length > 0) {
      const order = { rear: 0, front: 1, overlay: 2 } as const;
      const previous = fragments.at(-1)!.layer as keyof typeof order;
      const current = canonical.layer as keyof typeof order;
      if (order[previous] >= order[current]) return null;
    }
    fragments.push(canonical);
  }
  return fragments;
}

function sameCanonicalValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function canonicalCertificationInputFromSnapshot(
  context: ProductKitCertificationContext,
  kit: ProductKitKit,
  frame: ProductKitMountFrame,
  component: ProductKitComponent
): string | null {
  if (!isRecord(context) || !hasExactKeys(context, [
    "packId", "connectorFormulaVersion"
  ]) || !isProductKitId(context.packId) ||
    !isWellFormedString(context.connectorFormulaVersion) ||
    !isRecord(kit) || !isProductKitId(kit.id) ||
    !isRecord(frame) || !isRecord(component) ||
    !isProductKitId(component.id) || !isProductKitId(component.slotId)) return null;

  if ((kit.mode !== "socket" && kit.mode !== "grip" && kit.mode !== "grid") ||
    frame.mountType !== kit.mode || !isRecord(component.componentFrame) ||
    component.componentFrame.mountType !== kit.mode || frame.slotId !== component.slotId) {
    return null;
  }

  const kitProfile = canonicalProfile(kit.compatibilityProfile);
  const componentProfile = canonicalProfile(component.compatibilityProfile);
  const base = canonicalRaster(kit.base);
  const mountFrame = canonicalMountFrame(frame);
  const componentFrame = canonicalComponentFrame(component.componentFrame);
  const fragments = canonicalFragments(component.fragments);
  if (!kitProfile || !componentProfile || !sameCanonicalValue(kitProfile, componentProfile) ||
    !base || !mountFrame || !componentFrame || !fragments ||
    !Array.isArray(kit.mountFrames) || kit.mountFrames.length === 0 ||
    !hasOwnDenseIndices(kit.mountFrames) ||
    kit.mountFrames.length > 32 || kit.mountFrames.some((candidate) =>
      canonicalMountFrame(candidate) === null
    )) return null;

  const selectedFrames = kit.mountFrames.filter((candidate) =>
    isRecord(candidate) && candidate.id === frame.id
  );
  if (selectedFrames.length !== 1) return null;
  const selectedFrame = canonicalMountFrame(selectedFrames[0]);
  if (!selectedFrame || !sameCanonicalValue(selectedFrame, mountFrame)) return null;

  return JSON.stringify({
    schema: CERTIFICATION_SCHEMA,
    version: CERTIFICATION_VERSION,
    packId: context.packId,
    connectorFormulaVersion: context.connectorFormulaVersion,
    kit: {
      id: kit.id,
      mode: kit.mode,
      compatibilityProfile: kitProfile,
      base,
      mountFrame
    },
    component: {
      id: component.id,
      slotId: component.slotId,
      compatibilityProfile: componentProfile,
      componentFrame,
      fragments
    }
  });
}

export function canonicalCertificationInput(
  context: ProductKitCertificationContext,
  kit: ProductKitKit,
  frame: ProductKitMountFrame,
  component: ProductKitComponent
): string | null {
  const snapshot = snapshotPlainData(
    [context, kit, frame, component] as const,
    { maxNodes: 10_000, maxArrayLength: 64 }
  );
  return snapshot === null
    ? null
    : canonicalCertificationInputFromSnapshot(...snapshot);
}

export function computeCertificationFingerprint(
  context: ProductKitCertificationContext,
  kit: ProductKitKit,
  frame: ProductKitMountFrame,
  component: ProductKitComponent
): string | null {
  const input = canonicalCertificationInput(context, kit, frame, component);
  return input === null ? null : sha256Utf8(input);
}

export function certificationFingerprintMatches(
  context: ProductKitCertificationContext,
  kit: ProductKitKit,
  frame: ProductKitMountFrame,
  component: ProductKitComponent,
  fingerprint: string
): boolean {
  if (typeof fingerprint !== "string" || !SHA256.test(fingerprint)) return false;
  const computed = computeCertificationFingerprint(context, kit, frame, component);
  if (computed === null) return false;

  let difference = 0;
  for (let index = 0; index < 64; index += 1) {
    difference |= computed.charCodeAt(index) ^ fingerprint.charCodeAt(index);
  }
  return difference === 0;
}
