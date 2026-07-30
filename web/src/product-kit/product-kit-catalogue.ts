import { z } from "zod";
import { resolveGripTransform, resolveSocketTransform } from "./connector-transform";
import { snapshotPlainData } from "./plain-data";

const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;
const SHA256 = /^[0-9a-f]{64}(?![\s\S])/;
const MAX_COLLECTION = 10_000;
const parsedProductKitCatalogues = new WeakSet<object>();
const COMPONENT_LAYER_ORDER = new Map([
  ["rear", 0],
  ["front", 1],
  ["overlay", 2]
] as const);

const rejectsSignedZero = (value: number): boolean => !Object.is(value, -0);
const finiteNumber = z.number().finite().refine(rejectsSignedZero);
const jsonInteger = z.number().int().refine(rejectsSignedZero);
const unitNumber = finiteNumber.min(0).max(1);
const portableId = z.string().min(1).max(80).regex(PORTABLE_ID);
const productKitId = portableId.refine((value) => value.startsWith("pk1-"));
const sha256 = z.string().regex(SHA256);

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) return true;
      index += 1;
    } else if (code >= 0xDC00 && code <= 0xDFFF) {
      return true;
    }
  }
  return false;
}

const title = z.string().min(1).max(80).refine((value) =>
  value === value.trim() && !hasUnpairedSurrogate(value) &&
  ![...value].some((character) => character.charCodeAt(0) < 32)
);

const PointSchema = z.strictObject({ x: unitNumber, y: unitNumber });
const NormalSchema = z.strictObject({
  x: finiteNumber.min(-1).max(1),
  y: finiteNumber.min(-1).max(1)
}).refine(({ x, y }) => x !== 0 || y !== 0);

const BoundsSchema = z.strictObject({
  x: unitNumber,
  y: unitNumber,
  width: unitNumber.gt(0),
  height: unitNumber.gt(0)
}).refine(({ x, y, width, height }) => x + width <= 1 && y + height <= 1);

const RasterFrameSchema = z.strictObject({
  originalWidth: jsonInteger.min(1).max(8192),
  originalHeight: jsonInteger.min(1).max(8192),
  trimX: jsonInteger.min(0).max(8191),
  trimY: jsonInteger.min(0).max(8191),
  trimWidth: jsonInteger.min(1).max(8192),
  trimHeight: jsonInteger.min(1).max(8192)
}).refine(({ originalWidth, originalHeight, trimX, trimY, trimWidth, trimHeight }) =>
  trimX + trimWidth <= originalWidth && trimY + trimHeight <= originalHeight
);

const AssetReferenceSchema = z.strictObject({
  assetId: portableId,
  masterSha256: sha256,
  frame: RasterFrameSchema
});

const CompatibilityProfileSchema = z.strictObject({
  familyId: productKitId,
  perspectiveId: productKitId,
  geometryId: productKitId,
  styleId: productKitId
});

const TransformConstraintsSchema = z.strictObject({
  minScale: finiteNumber.gt(0).max(8),
  maxScale: finiteNumber.gt(0).max(8),
  minRotationDegrees: finiteNumber.min(-180).max(180),
  maxRotationDegrees: finiteNumber.min(-180).max(180),
  maxNormalErrorDegrees: finiteNumber.min(0).max(45),
  mirrorAllowed: z.boolean()
}).refine(({ minScale, maxScale, minRotationDegrees, maxRotationDegrees }) =>
  minScale <= maxScale && minRotationDegrees <= maxRotationDegrees
);

const MountIdentitySchema = {
  id: productKitId,
  slotId: productKitId
} as const;

const SocketMountFrameSchema = z.strictObject({
  ...MountIdentitySchema,
  mountType: z.literal("socket"),
  point: PointSchema,
  normal: NormalSchema,
  referenceScale: finiteNumber.gt(0).max(2),
  constraints: TransformConstraintsSchema
});

const GripMountFrameSchema = z.strictObject({
  ...MountIdentitySchema,
  mountType: z.literal("grip"),
  contacts: z.tuple([PointSchema, PointSchema]).refine(([first, second]) =>
    first.x !== second.x || first.y !== second.y
  ),
  normals: z.tuple([NormalSchema, NormalSchema]),
  constraints: TransformConstraintsSchema
});

const GridMountFrameSchema = z.strictObject({
  ...MountIdentitySchema,
  mountType: z.literal("grid"),
  origin: PointSchema,
  cellSize: z.strictObject({
    width: unitNumber.gt(0),
    height: unitNumber.gt(0)
  }),
  columns: jsonInteger.min(1).max(64),
  rows: jsonInteger.min(1).max(64),
  plane: z.enum(["floor", "wall"]),
  acceptedEdgeTypes: z.array(productKitId).max(32)
}).refine(({ origin, cellSize, columns, rows }) =>
  origin.x + cellSize.width * columns <= 1 &&
  origin.y + cellSize.height * rows <= 1
);

const MountFrameSchema = z.discriminatedUnion("mountType", [
  SocketMountFrameSchema,
  GripMountFrameSchema,
  GridMountFrameSchema
]);

const SocketComponentFrameSchema = z.strictObject({
  mountType: z.literal("socket"),
  point: PointSchema,
  normal: NormalSchema,
  referenceScale: finiteNumber.gt(0).max(2)
});

const GripComponentFrameSchema = z.strictObject({
  mountType: z.literal("grip"),
  contacts: z.tuple([PointSchema, PointSchema]).refine(([first, second]) =>
    first.x !== second.x || first.y !== second.y
  ),
  normals: z.tuple([NormalSchema, NormalSchema])
});

const GridComponentFrameSchema = z.strictObject({
  mountType: z.literal("grid"),
  plane: z.enum(["floor", "wall"]),
  footprint: z.strictObject({
    columns: jsonInteger.min(1).max(64),
    rows: jsonInteger.min(1).max(64)
  }),
  edgeTypes: z.strictObject({
    north: productKitId.optional(),
    east: productKitId.optional(),
    south: productKitId.optional(),
    west: productKitId.optional()
  })
});

const ComponentFrameSchema = z.discriminatedUnion("mountType", [
  SocketComponentFrameSchema,
  GripComponentFrameSchema,
  GridComponentFrameSchema
]);

const KitSchema = z.strictObject({
  id: productKitId,
  title,
  mode: z.enum(["whole", "socket", "grip", "grid"]),
  compatibilityProfile: CompatibilityProfileSchema,
  base: AssetReferenceSchema,
  priceAssetId: productKitId,
  mountFrames: z.array(MountFrameSchema).max(32),
  artworkBounds: z.array(BoundsSchema).max(8)
});

const FragmentSchema = z.strictObject({
  layer: z.enum(["rear", "front", "overlay"]),
  raster: AssetReferenceSchema
});

const ComponentSchema = z.strictObject({
  id: productKitId,
  title,
  slotId: productKitId,
  compatibilityProfile: CompatibilityProfileSchema,
  componentFrame: ComponentFrameSchema,
  fragments: z.array(FragmentSchema).min(1).max(3),
  priceAssetId: productKitId
});

const CertificationSchema = z.strictObject({
  id: productKitId,
  kitId: productKitId,
  mountFrameId: productKitId,
  componentId: productKitId,
  fingerprint: sha256
});

const CatalogueSchema = z.strictObject({
  schema: z.literal("product-kit@1"),
  version: z.literal(1),
  packId: productKitId,
  catalogPackId: portableId,
  catalogSha256: sha256,
  pricingVersion: z.literal("product-pricing@1"),
  connectorFormulaVersion: z.literal("product-kit-connectors@1"),
  kits: z.array(KitSchema).min(1).max(MAX_COLLECTION),
  components: z.array(ComponentSchema).max(MAX_COLLECTION),
  certifications: z.array(CertificationSchema).max(MAX_COLLECTION)
});

const AssetRecordSchema = z.strictObject({
  id: portableId,
  masterSha256: sha256,
  delivery: z.string(),
  kind: z.string(),
  files: z.strictObject({ master: z.string() }),
  dimensions: z.strictObject({
    width: jsonInteger.min(1).max(8192),
    height: jsonInteger.min(1).max(8192)
  }),
  classroomReviewed: z.boolean(),
  brandFree: z.boolean()
});

const ContextSchema = z.strictObject({
  catalogPackId: portableId,
  catalogSha256: sha256,
  records: z.array(AssetRecordSchema).max(20_000)
});

type ParsedCatalogue = z.infer<typeof CatalogueSchema>;
type ParsedContext = z.infer<typeof ContextSchema>;

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly [unknown, ...unknown[]]
    ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
    : T extends readonly (infer Item)[]
      ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type ProductKitPoint = DeepReadonly<z.infer<typeof PointSchema>>;
export type ProductKitNormal = DeepReadonly<z.infer<typeof NormalSchema>>;
export type ProductKitRasterFrame = DeepReadonly<z.infer<typeof RasterFrameSchema>>;
export type ProductKitAssetReference = DeepReadonly<z.infer<typeof AssetReferenceSchema>>;
export type ProductKitCompatibilityProfile = DeepReadonly<z.infer<typeof CompatibilityProfileSchema>>;
export type ProductKitMountFrame = DeepReadonly<z.infer<typeof MountFrameSchema>>;
export type ProductKitComponentFrame = DeepReadonly<z.infer<typeof ComponentFrameSchema>>;
export type ProductKitKit = DeepReadonly<z.infer<typeof KitSchema>>;
export type ProductKitComponent = DeepReadonly<z.infer<typeof ComponentSchema>>;
export type ProductKitCertification = DeepReadonly<z.infer<typeof CertificationSchema>>;
export type ProductKitCatalogue = DeepReadonly<ParsedCatalogue>;

export interface ProductKitCatalogueAssetRecord {
  readonly id: string;
  readonly masterSha256: string;
  readonly delivery: string;
  readonly kind: string;
  readonly files: { readonly master: string };
  readonly dimensions: { readonly width: number; readonly height: number };
  readonly classroomReviewed: boolean;
  readonly brandFree: boolean;
}

export interface ProductKitCatalogueContext {
  readonly catalogPackId: string;
  readonly catalogSha256: string;
  readonly records: readonly ProductKitCatalogueAssetRecord[];
}

function sortedUniqueById(values: readonly { readonly id: string }[]): boolean {
  return values.every((value, index) =>
    index === 0 || values[index - 1]!.id < value.id
  );
}

function sortedUniqueStrings(values: readonly string[]): boolean {
  return values.every((value, index) => index === 0 || values[index - 1]! < value);
}

function sameProfile(
  left: z.infer<typeof CompatibilityProfileSchema>,
  right: z.infer<typeof CompatibilityProfileSchema>
): boolean {
  return left.familyId === right.familyId &&
    left.perspectiveId === right.perspectiveId &&
    left.geometryId === right.geometryId &&
    left.styleId === right.styleId;
}

function rasterIsBound(
  raster: z.infer<typeof AssetReferenceSchema>,
  records: ReadonlyMap<string, z.infer<typeof AssetRecordSchema>>,
  packId: string
): boolean {
  const record = records.get(raster.assetId);
  if (!record || record.masterSha256 !== raster.masterSha256 ||
    record.delivery !== "offline" || !record.classroomReviewed || !record.brandFree ||
    !["component", "raster-master", "shell"].includes(record.kind) ||
    record.files.master !==
      `/catalog/generated/${packId}/assets/${record.id}/master.png`) return false;
  return record.dimensions.width === raster.frame.trimWidth &&
    record.dimensions.height === raster.frame.trimHeight;
}

function fragmentsAreCanonical(
  fragments: readonly z.infer<typeof FragmentSchema>[]
): boolean {
  return fragments.every((fragment, index) => {
    if (index === 0) return true;
    return COMPONENT_LAYER_ORDER.get(fragments[index - 1]!.layer)! <
      COMPONENT_LAYER_ORDER.get(fragment.layer)!;
  });
}

function certifiedGeometryIsValid(
  frame: z.infer<typeof MountFrameSchema>,
  componentFrame: z.infer<typeof ComponentFrameSchema>
): boolean {
  if (frame.mountType === "socket" && componentFrame.mountType === "socket") {
    return resolveSocketTransform(componentFrame, frame, frame.constraints) !== null;
  }
  if (frame.mountType === "grip" && componentFrame.mountType === "grip") {
    return resolveGripTransform(componentFrame, frame, frame.constraints) !== null;
  }
  if (frame.mountType === "grid" && componentFrame.mountType === "grid") {
    const accepted = new Set(frame.acceptedEdgeTypes);
    const edgeTypes = Object.values(componentFrame.edgeTypes).filter(
      (value): value is string => value !== undefined
    );
    return frame.plane === componentFrame.plane &&
      componentFrame.footprint.columns <= frame.columns &&
      componentFrame.footprint.rows <= frame.rows &&
      edgeTypes.every((edgeType) => accepted.has(edgeType));
  }
  return false;
}

function graphIsValid(catalogue: ParsedCatalogue, context: ParsedContext): boolean {
  if (catalogue.catalogPackId !== context.catalogPackId ||
    catalogue.catalogSha256 !== context.catalogSha256 ||
    !sortedUniqueById(catalogue.kits) ||
    !sortedUniqueById(catalogue.components) ||
    !sortedUniqueById(catalogue.certifications)) return false;

  const records = new Map(context.records.map((record) => [record.id, record]));
  if (records.size !== context.records.length) return false;
  const kits = new Map(catalogue.kits.map((kit) => [kit.id, kit]));
  const components = new Map(catalogue.components.map((component) => [component.id, component]));
  const allFrameIds = catalogue.kits.flatMap((kit) =>
    kit.mountFrames.map((frame) => frame.id)
  );
  if (new Set(allFrameIds).size !== allFrameIds.length) return false;

  for (const kit of catalogue.kits) {
    if (!rasterIsBound(kit.base, records, context.catalogPackId) ||
      !sortedUniqueById(kit.mountFrames)) return false;
    if (kit.mode === "whole") {
      if (kit.mountFrames.length !== 0) return false;
    } else if (kit.mountFrames.length === 0 ||
      kit.mountFrames.some((frame) => frame.mountType !== kit.mode)) return false;
    for (const frame of kit.mountFrames) {
      if (frame.mountType === "grid" && !sortedUniqueStrings(frame.acceptedEdgeTypes)) return false;
    }
  }

  for (const component of catalogue.components) {
    if (!fragmentsAreCanonical(component.fragments) ||
      component.fragments.some(({ raster }) =>
        !rasterIsBound(raster, records, context.catalogPackId)
      )) return false;
  }

  const certifiedPairs = new Set<string>();
  for (const certification of catalogue.certifications) {
    const kit = kits.get(certification.kitId);
    const component = components.get(certification.componentId);
    const frame = kit?.mountFrames.find(({ id }) => id === certification.mountFrameId);
    const pair = `${certification.kitId}\0${certification.mountFrameId}\0${certification.componentId}`;
    if (!kit || !component || !frame || kit.mode === "whole" || certifiedPairs.has(pair) ||
      frame.slotId !== component.slotId ||
      frame.mountType !== component.componentFrame.mountType ||
      !sameProfile(kit.compatibilityProfile, component.compatibilityProfile) ||
      !certifiedGeometryIsValid(frame, component.componentFrame)) return false;
    certifiedPairs.add(pair);
  }
  return true;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): DeepReadonly<T> {
  if (value === null || typeof value !== "object" || seen.has(value) ||
    Object.isFrozen(value)) {
    return value as DeepReadonly<T>;
  }
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value) as DeepReadonly<T>;
}

export function snapshotProductKitCatalogueData(
  value: unknown
): ProductKitCatalogue | null {
  const snapshot = snapshotPlainData(value, {
    maxNodes: 4_000_000,
    maxArrayLength: 20_000
  });
  if (!snapshot || !CatalogueSchema.safeParse(snapshot).success) return null;
  return snapshot as ProductKitCatalogue;
}

export function parseProductKitCatalogue(
  value: unknown,
  context: ProductKitCatalogueContext
): ProductKitCatalogue | null {
  const catalogueSnapshot = snapshotProductKitCatalogueData(value);
  const contextSnapshot = snapshotPlainData(context, {
    maxNodes: 500_000,
    maxArrayLength: 20_000
  });
  if (!catalogueSnapshot || !contextSnapshot) return null;
  const parsedContext = ContextSchema.safeParse(contextSnapshot);
  if (!parsedContext.success || !graphIsValid(
    catalogueSnapshot as unknown as ParsedCatalogue,
    parsedContext.data
  )) return null;
  const parsed = deepFreeze(catalogueSnapshot as unknown as ParsedCatalogue);
  parsedProductKitCatalogues.add(parsed as object);
  return parsed;
}

export function isParsedProductKitCatalogue(
  value: unknown
): value is ProductKitCatalogue {
  return value !== null && typeof value === "object" &&
    parsedProductKitCatalogues.has(value);
}
