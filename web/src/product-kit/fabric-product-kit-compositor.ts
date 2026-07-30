import {
  FabricImage,
  FabricObject,
  FixedLayout,
  Group,
  LayoutManager,
  Rect,
  util
} from "fabric";
import "../fabric/fabric-custom-properties";
import {
  PRODUCT_KIT_LAYER_ORDER,
  type ProductKitComponentRasterEntry,
  type ProductKitLayerEntry,
  type ProductKitLayerPlan,
  type ProductKitRenderLayer
} from "./layer-plan";
import {
  isParsedProductKitCatalogue,
  type ProductKitCatalogue
} from "./product-kit-catalogue";
import type { ProductKitRasterSource } from "./product-kit-loader";
import {
  productKitRasterMatrix,
  type ProductKitRasterMatrix
} from "./product-kit-raster-matrix";
import {
  createProductKitRuntime,
  type ProductKitCompositionPlacementRequest,
  type ProductKitCompositionRequest
} from "./product-kit-runtime";
import { snapshotPlainData } from "./plain-data";
import { FABRIC_SELECTION_STYLE } from "../fabric/object-factory";
import { CREATOR_CONFIG } from "../config";

declare module "fabric" {
  interface FabricObject {
    productKitPackId?: string;
    productKitId?: string;
    productKitCatalogSha256?: string;
  }

  interface SerializedObjectProps {
    productKitPackId?: string;
    productKitId?: string;
    productKitCatalogSha256?: string;
  }
}

const LOGICAL_WIDTH = 400;
const LOGICAL_HEIGHT = 500;
const DEFAULT_MAX_WIDTH = 720;
const DEFAULT_MAX_HEIGHT = 630;
const DEFAULT_MAX_SCALE = 2;
const CLOSE_UP_MAX_WIDTH = 1520;
const CLOSE_UP_MAX_HEIGHT = 1500;
const CLOSE_UP_MAX_SCALE = 5;
const MIN_ARTWORK_WIDTH = 480;
const MIN_ARTWORK_HEIGHT = 260;
const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;
const SHA256 = /^[0-9a-f]{64}(?![\s\S])/;
const PRODUCT_KIT_IDENTITY_PROPERTIES = Object.freeze([
  "productKitPackId",
  "productKitId",
  "productKitCatalogSha256"
] as const);
const missingProductKitIdentityProperties = PRODUCT_KIT_IDENTITY_PROPERTIES.filter(
  (property) => !FabricObject.customProperties.includes(property)
);
if (missingProductKitIdentityProperties.length > 0) {
  FabricObject.customProperties = [
    ...FabricObject.customProperties,
    ...missingProductKitIdentityProperties
  ];
}

export interface FabricProductKitInput {
  readonly id: string;
  readonly accessibleName: string;
  readonly catalogue: ProductKitCatalogue;
  readonly plan: ProductKitLayerPlan;
  readonly rasterSources: ReadonlyMap<string, ProductKitRasterSource>;
}

export type FabricProductKitImageLoader = (
  url: string,
  loadOptions: {
    readonly crossOrigin: "anonymous";
    readonly signal: AbortSignal;
  },
  imageOptions: { readonly objectCaching: true }
) => Promise<FabricImage>;

interface InputDataProperties {
  readonly id: unknown;
  readonly accessibleName: unknown;
  readonly catalogue: unknown;
  readonly plan: unknown;
  readonly rasterSources: unknown;
}

interface ProductKitInputSnapshot {
  readonly id: string;
  readonly accessibleName: string;
  readonly catalogue: ProductKitCatalogue;
  readonly plan: ProductKitLayerPlan;
  readonly rasterSources: readonly (readonly [string, ProductKitRasterSource])[];
}

interface ValidatedProductKitInput {
  readonly snapshot: ProductKitInputSnapshot;
  readonly catalogue: ProductKitCatalogue;
}

interface ResolvedRasterWork {
  readonly layer: ProductKitRenderLayer;
  readonly entry: Exclude<ProductKitLayerEntry, { readonly kind: "artwork-slot" }>;
  readonly url: string;
  readonly matrix: ProductKitRasterMatrix;
}

interface ObjectBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly centerX: number;
  readonly centerY: number;
}

function unionBounds(objects: readonly FabricObject[]): ObjectBounds {
  if (objects.length === 0) throw new Error("Product Kit has no visible geometry");
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const object of objects) {
    const bounds = object.getBoundingRect();
    if (![bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite)) {
      throw new Error("Product Kit geometry bounds are invalid");
    }
    left = Math.min(left, bounds.left);
    top = Math.min(top, bounds.top);
    right = Math.max(right, bounds.left + bounds.width);
    bottom = Math.max(bottom, bounds.top + bounds.height);
  }
  const width = right - left;
  const height = bottom - top;
  if (!(width > 0) || !(height > 0)) {
    throw new Error("Product Kit geometry bounds are invalid");
  }
  return {
    left,
    top,
    width,
    height,
    centerX: left + width / 2,
    centerY: top + height / 2
  };
}

const defaultImageLoader: FabricProductKitImageLoader = (
  url,
  loadOptions,
  imageOptions
) => FabricImage.fromURL(url, loadOptions, imageOptions);

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

function inputDataProperties(value: unknown): InputDataProperties | null {
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
  const keys = [
    "id",
    "accessibleName",
    "catalogue",
    "plan",
    "rasterSources"
  ] as const;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (!hasExactKeys(descriptors, keys)) return null;
  const result: Partial<Record<typeof keys[number], unknown>> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
    result[key] = descriptor.value;
  }
  return result as unknown as InputDataProperties;
}

function readonlyMapEntries(value: unknown): readonly (readonly [unknown, unknown])[] | null {
  if (value === null || typeof value !== "object") return null;
  try {
    const entries: Array<readonly [unknown, unknown]> = [];
    for (const entry of value as ReadonlyMap<unknown, unknown>) {
      if (!Array.isArray(entry) || entry.length !== 2) return null;
      entries.push([entry[0], entry[1]]);
      if (entries.length > 20_000) return null;
    }
    return entries;
  } catch {
    return null;
  }
}

function plainValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || left === null ||
    typeof right !== "object" || right === null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((value, index) => plainValuesEqual(value, right[index]));
  }
  const leftKeys = Reflect.ownKeys(left).filter((key): key is string =>
    typeof key === "string"
  ).sort();
  const rightKeys = Reflect.ownKeys(right).filter((key): key is string =>
    typeof key === "string"
  ).sort();
  return leftKeys.length === Reflect.ownKeys(left).length &&
    rightKeys.length === Reflect.ownKeys(right).length &&
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && plainValuesEqual(
      (left as Readonly<Record<string, unknown>>)[key],
      (right as Readonly<Record<string, unknown>>)[key]
    ));
}

function snapshotInput(value: FabricProductKitInput): ValidatedProductKitInput | null {
  const properties = inputDataProperties(value);
  if (!properties || !isParsedProductKitCatalogue(properties.catalogue)) return null;
  const sourceEntries = readonlyMapEntries(properties.rasterSources);
  if (!sourceEntries) return null;
  const snapshot = snapshotPlainData({
    id: properties.id,
    accessibleName: properties.accessibleName,
    catalogue: properties.catalogue,
    plan: properties.plan,
    rasterSources: sourceEntries
  }, {
    maxDepth: 64,
    maxNodes: 4_000_000,
    maxArrayLength: 131_072,
    maxObjectProperties: 128,
    maxStringLength: 1_000_000
  });
  if (!snapshot || typeof snapshot.id !== "string" || !snapshot.id.trim() ||
    snapshot.id.length > 256 || typeof snapshot.accessibleName !== "string" ||
    !snapshot.accessibleName.trim() || snapshot.accessibleName.length > 1_000) return null;
  return {
    snapshot: snapshot as unknown as ProductKitInputSnapshot,
    catalogue: properties.catalogue
  };
}

function canonicalMasterUrl(
  value: string,
  assetId: string,
  catalogPackId: string
): string | null {
  if (/[%\\\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const resolved = new URL(value, window.location.href);
    if ((resolved.protocol !== "http:" && resolved.protocol !== "https:") ||
      resolved.origin !== window.location.origin || resolved.username || resolved.password ||
      resolved.search || resolved.hash || resolved.pathname.includes("//") ||
      resolved.pathname.split("/").some((segment) => segment === "." || segment === "..")) {
      return null;
    }
    const rawPath = value.startsWith("/") && !value.startsWith("//")
      ? value
      : value.startsWith(`${window.location.origin}/`)
        ? value.slice(window.location.origin.length)
        : null;
    const expectedPath =
      `/catalog/generated/${catalogPackId}/assets/${assetId}/master.png`;
    if (!rawPath || rawPath !== resolved.pathname ||
      resolved.pathname !== expectedPath) return null;
    return resolved.href;
  } catch {
    return null;
  }
}

function sourceMapFromSnapshot(
  snapshot: ProductKitInputSnapshot,
  catalogue: ProductKitCatalogue
): ReadonlyMap<string, ProductKitRasterSource> | null {
  const sources = new Map<string, ProductKitRasterSource>();
  for (const entry of snapshot.rasterSources) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" ||
      !isRecord(entry[1]) || !hasExactKeys(entry[1], [
        "assetId",
        "masterSha256",
        "masterUrl"
      ]) || typeof entry[1].assetId !== "string" ||
      !PORTABLE_ID.test(entry[1].assetId) || entry[1].assetId !== entry[0] ||
      typeof entry[1].masterSha256 !== "string" ||
      !SHA256.test(entry[1].masterSha256) ||
      typeof entry[1].masterUrl !== "string" ||
      canonicalMasterUrl(
        entry[1].masterUrl,
        entry[1].assetId,
        catalogue.catalogPackId
      ) === null ||
      sources.has(entry[0])) return null;
    sources.set(entry[0], {
      assetId: entry[1].assetId,
      masterSha256: entry[1].masterSha256,
      masterUrl: entry[1].masterUrl
    });
  }
  return sources;
}

function catalogueRasterSources(
  catalogue: ProductKitCatalogue
): ReadonlyMap<string, { readonly masterSha256: string }> | null {
  const expected = new Map<string, { readonly masterSha256: string }>();
  const rasters = [
    ...catalogue.kits.map((kit) => kit.base),
    ...catalogue.components.flatMap((component) =>
      component.fragments.map((fragment) => fragment.raster)
    )
  ];
  for (const raster of rasters) {
    const previous = expected.get(raster.assetId);
    if (previous && previous.masterSha256 !== raster.masterSha256) return null;
    expected.set(raster.assetId, { masterSha256: raster.masterSha256 });
  }
  return expected;
}

function sourcesMatchCatalogue(
  catalogue: ProductKitCatalogue,
  sources: ReadonlyMap<string, ProductKitRasterSource>
): boolean {
  const expected = catalogueRasterSources(catalogue);
  if (!expected || sources.size !== expected.size) return false;
  for (const [assetId, raster] of expected) {
    const source = sources.get(assetId);
    if (!source || source.assetId !== assetId ||
      source.masterSha256 !== raster.masterSha256) return false;
  }
  return true;
}

function requestFromPlan(
  plan: unknown,
  catalogue: ProductKitCatalogue
): ProductKitCompositionRequest | null {
  if (!isRecord(plan) || typeof plan.kitId !== "string" ||
    !Array.isArray(plan.layers)) return null;
  const kit = catalogue.kits.find((candidate) => candidate.id === plan.kitId);
  if (!kit) return null;
  const placements = new Map<string, ProductKitCompositionPlacementRequest>();
  for (const bucket of plan.layers) {
    if (!isRecord(bucket) || !Array.isArray(bucket.entries)) return null;
    for (const entry of bucket.entries) {
      if (!isRecord(entry) || entry.kind !== "component-raster") continue;
      if (typeof entry.placementId !== "string" ||
        typeof entry.mountFrameId !== "string" ||
        typeof entry.componentId !== "string" || !isRecord(entry.geometry)) return null;
      let placement: ProductKitCompositionPlacementRequest;
      if (entry.geometry.kind === "affine" &&
        (kit.mode === "socket" || kit.mode === "grip")) {
        placement = {
          kind: kit.mode,
          placementId: entry.placementId,
          mountFrameId: entry.mountFrameId,
          componentId: entry.componentId
        };
      } else if (entry.geometry.kind === "grid" && kit.mode === "grid" &&
        typeof entry.geometry.column === "number" &&
        typeof entry.geometry.row === "number") {
        placement = {
          kind: "grid",
          placementId: entry.placementId,
          mountFrameId: entry.mountFrameId,
          componentId: entry.componentId,
          column: entry.geometry.column,
          row: entry.geometry.row
        };
      } else {
        return null;
      }
      const previous = placements.get(placement.placementId);
      if (previous && !plainValuesEqual(previous, placement)) return null;
      placements.set(placement.placementId, placement);
    }
  }
  return { kitId: plan.kitId, placements: [...placements.values()] };
}

function canonicalPlan(
  plan: ProductKitLayerPlan,
  catalogue: ProductKitCatalogue
): ProductKitLayerPlan | null {
  const request = requestFromPlan(plan, catalogue);
  if (!request) return null;
  const canonical = createProductKitRuntime(catalogue).planComposition(request);
  return canonical && plainValuesEqual(plan, canonical) ? canonical : null;
}

function resolveRasterWork(
  plan: ProductKitLayerPlan,
  catalogue: ProductKitCatalogue,
  sources: ReadonlyMap<string, ProductKitRasterSource>
): readonly ResolvedRasterWork[] | null {
  const kit = catalogue.kits.find((candidate) => candidate.id === plan.kitId);
  if (!kit || kit.base.frame.originalWidth !== LOGICAL_WIDTH ||
    kit.base.frame.originalHeight !== LOGICAL_HEIGHT ||
    plan.layers.length !== PRODUCT_KIT_LAYER_ORDER.length) return null;
  const work: ResolvedRasterWork[] = [];
  for (let layerIndex = 0; layerIndex < plan.layers.length; layerIndex += 1) {
    const bucket = plan.layers[layerIndex]!;
    if (bucket.layer !== PRODUCT_KIT_LAYER_ORDER[layerIndex]) return null;
    for (const entry of bucket.entries) {
      if (entry.kind === "artwork-slot") continue;
      const source = sources.get(entry.raster.assetId);
      if (!source || source.assetId !== entry.raster.assetId ||
        source.masterSha256 !== entry.raster.masterSha256) return null;
      const url = canonicalMasterUrl(
        source.masterUrl,
        source.assetId,
        catalogue.catalogPackId
      );
      const matrix = productKitRasterMatrix(kit.base.frame, entry);
      if (!url || !matrix) return null;
      work.push({ layer: bucket.layer, entry, url, matrix });
    }
  }
  return work;
}

function validLoadedImage(
  image: unknown,
  entry: ResolvedRasterWork["entry"]
): image is FabricImage {
  if (!(image instanceof FabricImage)) return false;
  const size = image.getOriginalSize();
  return Number.isSafeInteger(size.width) && Number.isSafeInteger(size.height) &&
    size.width === entry.raster.frame.trimWidth &&
    size.height === entry.raster.frame.trimHeight &&
    image.width === entry.raster.frame.trimWidth &&
    image.height === entry.raster.frame.trimHeight;
}

function configureImage(image: FabricImage, work: ResolvedRasterWork): void {
  for (const property of [
    "objectId",
    "elementKind",
    "accessibleName",
    "productKitPackId",
    "productKitId",
    "productKitCatalogSha256"
  ]) {
    if (!Reflect.deleteProperty(image, property) ||
      Reflect.get(image, property) !== undefined) {
      throw new Error("Product Kit raster child identity could not be cleared");
    }
  }
  image.set({
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
    objectCaching: true,
    productLayer: work.layer
  });
  const matrix: [number, number, number, number, number, number] = [...work.matrix];
  util.applyTransformToObject(image, matrix);
  const transform = [
    image.left,
    image.top,
    image.scaleX,
    image.scaleY,
    image.angle,
    image.skewX,
    image.skewY
  ];
  if (!transform.every((value) => typeof value === "number" && Number.isFinite(value)) ||
    !(image.scaleX > 0) || !(image.scaleY > 0)) {
    throw new Error("Product Kit raster matrix is not representable by Fabric");
  }
  image.setCoords();
}

function artworkSlot(
  entry: Extract<ProductKitLayerEntry, { readonly kind: "artwork-slot" }>
): Group {
  const width = entry.bounds.width * LOGICAL_WIDTH;
  const height = entry.bounds.height * LOGICAL_HEIGHT;
  const rect = new Rect({
    width,
    height,
    left: 0,
    top: 0,
    originX: "center",
    originY: "center",
    fill: "rgba(0,0,0,0)",
    selectable: false,
    evented: false,
    objectCaching: false
  });
  const group = new Group([rect], {
    width,
    height,
    left: 0,
    top: 0,
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
    objectCaching: false,
    subTargetCheck: false,
    interactive: false,
    layoutManager: new LayoutManager(new FixedLayout())
  });
  group.set({
    left: (entry.bounds.x + entry.bounds.width / 2) * LOGICAL_WIDTH -
      LOGICAL_WIDTH / 2,
    top: (entry.bounds.y + entry.bounds.height / 2) * LOGICAL_HEIGHT -
      LOGICAL_HEIGHT / 2,
    productLayer: "artwork-slot",
    artworkSlotId: entry.itemId
  });
  group.setCoords();
  return group;
}

function placedProductScale(group: Group, children: readonly (FabricImage | Group)[]): number {
  const baseline = Math.min(
    DEFAULT_MAX_SCALE,
    DEFAULT_MAX_WIDTH / group.width,
    DEFAULT_MAX_HEIGHT / group.height
  );
  const maximum = Math.min(
    CLOSE_UP_MAX_SCALE,
    CLOSE_UP_MAX_WIDTH / group.width,
    CLOSE_UP_MAX_HEIGHT / group.height
  );
  const artwork = children.find(({ productLayer }) => productLayer === "artwork-slot");
  if (!(artwork instanceof Group) || !(artwork.width > 0) || !(artwork.height > 0)) {
    return baseline;
  }
  const surface = Math.max(
    MIN_ARTWORK_WIDTH / artwork.width,
    MIN_ARTWORK_HEIGHT / artwork.height
  );
  return Math.min(maximum, Math.max(baseline, surface));
}

export class FabricProductKitCompositor {
  constructor(
    private readonly loadImage: FabricProductKitImageLoader = defaultImageLoader
  ) {}

  async create(input: FabricProductKitInput): Promise<Group> {
    const validated = snapshotInput(input);
    if (!validated) {
      throw new Error("Product Kit input requires a parsed catalogue and plain fields");
    }
    const { snapshot, catalogue } = validated;
    const sources = sourceMapFromSnapshot(snapshot, catalogue);
    if (!sources || !sourcesMatchCatalogue(catalogue, sources)) {
      throw new Error("Product Kit raster sources do not match the parsed catalogue");
    }
    const plan = canonicalPlan(snapshot.plan, catalogue);
    if (!plan) throw new Error("Product Kit plan is invalid or uncertified");
    const work = resolveRasterWork(plan, catalogue, sources);
    if (!work) throw new Error("Product Kit raster source or matrix is invalid");

    const controller = new AbortController();
    let images: FabricImage[];
    try {
      images = await Promise.all(work.map(({ url }) => this.loadImage(
        url,
        { crossOrigin: "anonymous", signal: controller.signal },
        { objectCaching: true }
      )));
    } catch (error) {
      controller.abort();
      throw error;
    }
    if (new Set(images).size !== images.length || images.some((image, index) =>
      !validLoadedImage(image, work[index]!.entry)
    )) {
      controller.abort();
      throw new Error("Product Kit PNG dimensions do not match the layer plan");
    }

    images.forEach((image, index) => configureImage(image, work[index]!));
    const imageByEntry = new Map<ProductKitLayerEntry, FabricImage>();
    work.forEach(({ entry }, index) => imageByEntry.set(entry, images[index]!));
    const children = plan.layers.flatMap(({ entries }) => entries.map((entry) =>
      entry.kind === "artwork-slot" ? artworkSlot(entry) : imageByEntry.get(entry)
    ));
    if (children.some((child) => child === undefined)) {
      throw new Error("Product Kit layer plan did not resolve atomically");
    }
    const productChildren = children as Array<FabricImage | Group>;
    const visibleBounds = unionBounds(productChildren.filter(({ productLayer }) =>
      productLayer !== "artwork-slot"
    ));
    const allBounds = unionBounds(productChildren);

    const group = new Group(productChildren, {
      width: visibleBounds.width,
      height: visibleBounds.height,
      left: 0,
      top: 0,
      originX: "center",
      originY: "center",
      selectable: true,
      evented: true,
      objectCaching: true,
      subTargetCheck: false,
      interactive: false,
      layoutManager: new LayoutManager(new FixedLayout()),
      ...FABRIC_SELECTION_STYLE
    });
    const dx = allBounds.centerX - visibleBounds.centerX;
    const dy = allBounds.centerY - visibleBounds.centerY;
    group.getObjects().forEach((child) => {
      child.set({ left: child.left + dx, top: child.top + dy });
      child.setCoords();
    });
    group.set({
      left: CREATOR_CONFIG.canvasWidth / 2,
      top: CREATOR_CONFIG.canvasHeight / 2
    });
    group.scale(placedProductScale(group, productChildren));
    Reflect.set(group, "objectId", snapshot.id);
    Reflect.set(group, "elementKind", "product-kit");
    Reflect.set(group, "accessibleName", snapshot.accessibleName);
    Reflect.set(group, "productKitPackId", catalogue.packId);
    Reflect.set(group, "productKitId", plan.kitId);
    Reflect.set(group, "productKitCatalogSha256", catalogue.catalogSha256);
    group.setCoords();
    return group;
  }
}
