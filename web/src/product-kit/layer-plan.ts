import type { ResolvedMountTransform } from "./connector-transform";
import type {
  ProductKitAssetReference,
  ProductKitComponent,
  ProductKitKit
} from "./product-kit-catalogue";
import { snapshotPlainData } from "./plain-data";

export const PRODUCT_KIT_LAYER_ORDER = Object.freeze([
  "rear",
  "body",
  "front",
  "artwork",
  "overlay"
] as const);

export type ProductKitRenderLayer = typeof PRODUCT_KIT_LAYER_ORDER[number];

export interface ProductKitAffinePlacement {
  readonly kind: "affine";
  readonly placementId: string;
  readonly mountFrameId: string;
  readonly component: ProductKitComponent;
  readonly transform: ResolvedMountTransform;
}

export interface ProductKitGridPlacement {
  readonly kind: "grid";
  readonly placementId: string;
  readonly mountFrameId: string;
  readonly component: ProductKitComponent;
  readonly column: number;
  readonly row: number;
  readonly normalizedBounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export type ProductKitResolvedPlacement =
  | ProductKitAffinePlacement
  | ProductKitGridPlacement;

export interface ProductKitBaseRasterEntry {
  readonly kind: "base-raster";
  readonly itemId: string;
  readonly raster: ProductKitAssetReference;
}

export interface ProductKitComponentRasterEntry {
  readonly kind: "component-raster";
  readonly itemId: string;
  readonly placementId: string;
  readonly mountFrameId: string;
  readonly componentId: string;
  readonly raster: ProductKitAssetReference;
  readonly geometry:
    | { readonly kind: "affine"; readonly transform: ResolvedMountTransform }
    | {
      readonly kind: "grid";
      readonly column: number;
      readonly row: number;
      readonly normalizedBounds: {
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
      };
    };
}

export interface ProductKitArtworkSlotEntry {
  readonly kind: "artwork-slot";
  readonly itemId: string;
  readonly index: number;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export type ProductKitLayerEntry =
  | ProductKitBaseRasterEntry
  | ProductKitComponentRasterEntry
  | ProductKitArtworkSlotEntry;

export interface ProductKitLayerBucket {
  readonly layer: ProductKitRenderLayer;
  readonly entries: readonly ProductKitLayerEntry[];
}

export type ProductKitPricedItem =
  | {
    readonly kind: "base";
    readonly itemId: string;
    readonly priceAssetId: string;
  }
  | {
    readonly kind: "component";
    readonly itemId: string;
    readonly placementId: string;
    readonly componentId: string;
    readonly priceAssetId: string;
  };

export interface ProductKitLayerPlan {
  readonly kitId: string;
  readonly layers: readonly ProductKitLayerBucket[];
  readonly pricedItems: readonly ProductKitPricedItem[];
}

const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;
const SHA256 = /^[0-9a-f]{64}(?![\s\S])/;
const FRAGMENT_LAYER_INDEX = { rear: 0, front: 1, overlay: 2 } as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function isSafeContractInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    !Object.is(value, -0);
}

function isRaster(value: unknown): value is ProductKitAssetReference {
  if (!isRecord(value) || typeof value.assetId !== "string" ||
    !PORTABLE_ID.test(value.assetId) || typeof value.masterSha256 !== "string" ||
    !SHA256.test(value.masterSha256) || !isRecord(value.frame)) return false;
  const frame = value.frame;
  const dimensions = [
    frame.originalWidth,
    frame.originalHeight,
    frame.trimX,
    frame.trimY,
    frame.trimWidth,
    frame.trimHeight
  ];
  return dimensions.every(isSafeContractInteger) &&
    (frame.originalWidth as number) >= 1 && (frame.originalWidth as number) <= 8192 &&
    (frame.originalHeight as number) >= 1 && (frame.originalHeight as number) <= 8192 &&
    (frame.trimX as number) >= 0 && (frame.trimY as number) >= 0 &&
    (frame.trimWidth as number) >= 1 && (frame.trimHeight as number) >= 1 &&
    (frame.trimX as number) + (frame.trimWidth as number) <=
      (frame.originalWidth as number) &&
    (frame.trimY as number) + (frame.trimHeight as number) <=
      (frame.originalHeight as number);
}

function isArtworkBounds(value: unknown): value is ProductKitKit["artworkBounds"][number] {
  if (!isRecord(value)) return false;
  const numbers = [value.x, value.y, value.width, value.height];
  return numbers.every(isFiniteContractNumber) &&
    (value.x as number) >= 0 && (value.y as number) >= 0 &&
    (value.width as number) > 0 && (value.height as number) > 0 &&
    (value.x as number) + (value.width as number) <= 1 &&
    (value.y as number) + (value.height as number) <= 1;
}

function cloneRaster(raster: ProductKitAssetReference): ProductKitAssetReference {
  return {
    assetId: raster.assetId,
    masterSha256: raster.masterSha256,
    frame: { ...raster.frame }
  };
}

function cloneTransform(transform: ResolvedMountTransform): ResolvedMountTransform {
  return {
    matrix: { ...transform.matrix },
    scale: transform.scale,
    rotationDegrees: transform.rotationDegrees,
    mirrored: transform.mirrored,
    maxNormalErrorDegrees: transform.maxNormalErrorDegrees
  };
}

function finiteTransform(value: unknown): value is ResolvedMountTransform {
  if (!isRecord(value) || !isRecord(value.matrix)) return false;
  const transform = value as unknown as ResolvedMountTransform;
  const values = [
    transform.matrix.a,
    transform.matrix.b,
    transform.matrix.c,
    transform.matrix.d,
    transform.matrix.e,
    transform.matrix.f,
    transform.scale,
    transform.rotationDegrees,
    transform.maxNormalErrorDegrees
  ];
  return values.every(isFiniteContractNumber) && transform.scale > 0 &&
    transform.rotationDegrees >= -180 && transform.rotationDegrees <= 180 &&
    transform.maxNormalErrorDegrees >= 0 && transform.maxNormalErrorDegrees <= 180 &&
    typeof transform.mirrored === "boolean";
}

function finiteGridPlacement(placement: ProductKitGridPlacement): boolean {
  const { normalizedBounds } = placement;
  return isRecord(normalizedBounds) &&
    isSafeContractInteger(placement.column) && placement.column >= 0 &&
    isSafeContractInteger(placement.row) && placement.row >= 0 &&
    [
      normalizedBounds.x,
      normalizedBounds.y,
      normalizedBounds.width,
      normalizedBounds.height
    ].every(isFiniteContractNumber) &&
    normalizedBounds.x >= 0 && normalizedBounds.y >= 0 &&
    normalizedBounds.width > 0 && normalizedBounds.height > 0 &&
    normalizedBounds.x + normalizedBounds.width <= 1 &&
    normalizedBounds.y + normalizedBounds.height <= 1;
}

function placementIsValid(
  kit: ProductKitKit,
  value: unknown
): value is ProductKitResolvedPlacement {
  if (!isRecord(value) || typeof value.placementId !== "string" ||
    typeof value.mountFrameId !== "string" || !isRecord(value.component)) return false;
  const placement = value as unknown as ProductKitResolvedPlacement;
  if (!PORTABLE_ID.test(placement.placementId) || placement.placementId.length > 80 ||
    !PORTABLE_ID.test(placement.mountFrameId) || placement.mountFrameId.length > 80 ||
    !isRecord(placement.component.componentFrame) ||
    !Array.isArray(placement.component.fragments) ||
    !hasOwnDenseIndices(placement.component.fragments) ||
    placement.component.fragments.length === 0 ||
    typeof placement.component.id !== "string" ||
    typeof placement.component.priceAssetId !== "string" ||
    !PORTABLE_ID.test(placement.component.id) ||
    !PORTABLE_ID.test(placement.component.priceAssetId) ||
    !placement.component.fragments.every((fragment, index, fragments) =>
      isRecord(fragment) &&
      (fragment.layer === "rear" || fragment.layer === "front" ||
        fragment.layer === "overlay") && isRaster(fragment.raster) &&
      (index === 0 || FRAGMENT_LAYER_INDEX[
        fragments[index - 1]!.layer as keyof typeof FRAGMENT_LAYER_INDEX
      ] < FRAGMENT_LAYER_INDEX[fragment.layer])
    )) {
    return false;
  }
  if (placement.kind === "affine") {
    return (kit.mode === "socket" || kit.mode === "grip") &&
      placement.component.componentFrame.mountType === kit.mode &&
      finiteTransform(placement.transform);
  }
  if (placement.kind !== "grid") return false;
  return kit.mode === "grid" && placement.component.componentFrame.mountType === "grid" &&
    finiteGridPlacement(placement);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function comparePlacements(
  left: ProductKitResolvedPlacement,
  right: ProductKitResolvedPlacement
): number {
  if (left.kind === "grid" && right.kind === "grid") {
    return left.row - right.row || left.column - right.column ||
      compareCodeUnits(left.placementId, right.placementId);
  }
  if (left.kind !== right.kind) return compareCodeUnits(left.kind, right.kind);
  return compareCodeUnits(left.mountFrameId, right.mountFrameId) ||
    compareCodeUnits(left.placementId, right.placementId);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function createProductKitLayerPlanFromSnapshot(
  kit: ProductKitKit,
  placements: readonly ProductKitResolvedPlacement[]
): ProductKitLayerPlan | null {
  if (!isRecord(kit) || !Array.isArray(placements) ||
    !hasOwnDenseIndices(placements) ||
    typeof kit.id !== "string" || typeof kit.priceAssetId !== "string" ||
    !PORTABLE_ID.test(kit.id) || !PORTABLE_ID.test(kit.priceAssetId) ||
    !isRaster(kit.base) || !Array.isArray(kit.artworkBounds) ||
    !hasOwnDenseIndices(kit.artworkBounds) ||
    !kit.artworkBounds.every(isArtworkBounds) ||
    (kit.mode !== "whole" && kit.mode !== "socket" &&
      kit.mode !== "grip" && kit.mode !== "grid")) return null;
  if (kit.mode === "whole" && placements.length > 0) return null;
  if (!placements.every((placement) => placementIsValid(kit, placement))) return null;

  const placementIds = new Set<string>();
  for (const placement of placements) {
    if (placementIds.has(placement.placementId)) return null;
    placementIds.add(placement.placementId);
  }

  const sortedPlacements = [...placements].sort(comparePlacements);
  const entries = new Map<ProductKitRenderLayer, ProductKitLayerEntry[]>(
    PRODUCT_KIT_LAYER_ORDER.map((layer) => [layer, []])
  );
  const baseItemId = `base:${kit.id}`;
  entries.get("body")!.push({
    kind: "base-raster",
    itemId: baseItemId,
    raster: cloneRaster(kit.base)
  });
  kit.artworkBounds.forEach((bounds, index) => {
    entries.get("artwork")!.push({
      kind: "artwork-slot",
      itemId: `artwork:${kit.id}:${index}`,
      index,
      bounds: { ...bounds }
    });
  });

  const pricedItems: ProductKitPricedItem[] = [{
    kind: "base",
    itemId: baseItemId,
    priceAssetId: kit.priceAssetId
  }];
  for (const placement of sortedPlacements) {
    const geometry: ProductKitComponentRasterEntry["geometry"] = placement.kind === "affine"
      ? { kind: "affine", transform: cloneTransform(placement.transform) }
      : {
        kind: "grid",
        column: placement.column,
        row: placement.row,
        normalizedBounds: { ...placement.normalizedBounds }
      };
    for (const fragment of placement.component.fragments) {
      entries.get(fragment.layer)!.push({
        kind: "component-raster",
        itemId: `fragment:${placement.placementId}:${fragment.layer}`,
        placementId: placement.placementId,
        mountFrameId: placement.mountFrameId,
        componentId: placement.component.id,
        raster: cloneRaster(fragment.raster),
        geometry
      });
    }
    pricedItems.push({
      kind: "component",
      itemId: `placement:${placement.placementId}`,
      placementId: placement.placementId,
      componentId: placement.component.id,
      priceAssetId: placement.component.priceAssetId
    });
  }

  return deepFreeze({
    kitId: kit.id,
    layers: PRODUCT_KIT_LAYER_ORDER.map((layer) => ({
      layer,
      entries: entries.get(layer)!
    })),
    pricedItems
  });
}

export function createProductKitLayerPlan(
  kit: ProductKitKit,
  placements: readonly ProductKitResolvedPlacement[]
): ProductKitLayerPlan | null {
  const snapshot = snapshotPlainData(
    [kit, placements] as const,
    { maxNodes: 4_000_000, maxArrayLength: 131_072 }
  );
  return snapshot === null
    ? null
    : createProductKitLayerPlanFromSnapshot(...snapshot);
}
