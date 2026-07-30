import {
  suggestedPriceForCost,
  type ProductBuildQuote,
  type ProductCostLine,
  type ProductGroupSelection
} from "../product-builder/product-economics";
import {
  PRODUCT_KIT_LAYER_ORDER,
  type ProductKitLayerEntry,
  type ProductKitLayerPlan,
  type ProductKitPricedItem
} from "./layer-plan";
import { snapshotPlainData } from "./plain-data";
import type {
  ProductKitPrice,
  ProductKitPricingIndex
} from "./product-kit-pricing";

const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;
const SHA256 = /^[0-9a-f]{64}(?![\s\S])/;
const PRODUCT_CHOICE_KINDS = new Set([
  "base", "size", "capacity", "material", "finish", "feature", "part"
]);

interface ComponentPlacementIdentity {
  readonly componentId: string;
  readonly mountFrameId: string;
}

interface ValidatedPlan {
  readonly plan: ProductKitLayerPlan;
  readonly mountByPlacementId: ReadonlyMap<string, ComponentPlacementIdentity>;
}

interface PricingParts {
  readonly packId: string;
  readonly pricingVersion: number;
  readonly blueprintTitleByKitId: ReadonlyMap<string, string>;
  readonly byPriceAssetId: ReadonlyMap<string, ProductKitPrice>;
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

function validPortableId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 80 && PORTABLE_ID.test(value);
}

function validItemId(value: unknown): value is string {
  return typeof value === "string" && value === value.trim() &&
    value.length > 0 && value.length <= 100;
}

function validLabel(value: unknown): value is string {
  return typeof value === "string" && value === value.trim() &&
    value.length > 0 && value.length <= 80;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0);
}

function safeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    !Object.is(value, -0) && value >= 0;
}

function validBounds(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["x", "y", "width", "height"])) {
    return false;
  }
  const values = [value.x, value.y, value.width, value.height];
  return values.every(finiteNumber) && (value.x as number) >= 0 &&
    (value.y as number) >= 0 && (value.width as number) > 0 &&
    (value.height as number) > 0 &&
    (value.x as number) + (value.width as number) <= 1 &&
    (value.y as number) + (value.height as number) <= 1;
}

function validRaster(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, ["assetId", "masterSha256", "frame"]) ||
    !validPortableId(value.assetId) || typeof value.masterSha256 !== "string" ||
    !SHA256.test(value.masterSha256) || !isRecord(value.frame) ||
    !hasExactKeys(value.frame, [
      "originalWidth", "originalHeight", "trimX", "trimY", "trimWidth", "trimHeight"
    ])) return false;
  const frame = value.frame;
  const dimensions = [
    frame.originalWidth, frame.originalHeight, frame.trimX,
    frame.trimY, frame.trimWidth, frame.trimHeight
  ];
  return dimensions.every(safeNonNegativeInteger) &&
    (frame.originalWidth as number) >= 1 && (frame.originalWidth as number) <= 8192 &&
    (frame.originalHeight as number) >= 1 && (frame.originalHeight as number) <= 8192 &&
    (frame.trimWidth as number) >= 1 && (frame.trimHeight as number) >= 1 &&
    (frame.trimX as number) + (frame.trimWidth as number) <=
      (frame.originalWidth as number) &&
    (frame.trimY as number) + (frame.trimHeight as number) <=
      (frame.originalHeight as number);
}

function validTransform(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, [
    "matrix", "scale", "rotationDegrees", "mirrored", "maxNormalErrorDegrees"
  ]) || !isRecord(value.matrix) || !hasExactKeys(value.matrix, [
    "a", "b", "c", "d", "e", "f"
  ])) return false;
  return [
    value.matrix.a, value.matrix.b, value.matrix.c, value.matrix.d,
    value.matrix.e, value.matrix.f, value.scale, value.rotationDegrees,
    value.maxNormalErrorDegrees
  ].every(finiteNumber) && (value.scale as number) > 0 &&
    (value.rotationDegrees as number) >= -180 &&
    (value.rotationDegrees as number) <= 180 &&
    typeof value.mirrored === "boolean" &&
    (value.maxNormalErrorDegrees as number) >= 0 &&
    (value.maxNormalErrorDegrees as number) <= 180;
}

function validGeometry(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.kind === "affine") {
    return hasExactKeys(value, ["kind", "transform"]) && validTransform(value.transform);
  }
  return value.kind === "grid" && hasExactKeys(value, [
    "kind", "column", "row", "normalizedBounds"
  ]) && safeNonNegativeInteger(value.column) && safeNonNegativeInteger(value.row) &&
    validBounds(value.normalizedBounds);
}

function validLayerEntry(value: unknown): value is ProductKitLayerEntry {
  if (!isRecord(value) || !validItemId(value.itemId)) return false;
  if (value.kind === "base-raster") {
    return hasExactKeys(value, ["kind", "itemId", "raster"]) && validRaster(value.raster);
  }
  if (value.kind === "artwork-slot") {
    return hasExactKeys(value, ["kind", "itemId", "index", "bounds"]) &&
      safeNonNegativeInteger(value.index) && validBounds(value.bounds);
  }
  return value.kind === "component-raster" && hasExactKeys(value, [
    "kind", "itemId", "placementId", "mountFrameId", "componentId", "raster", "geometry"
  ]) && validPortableId(value.placementId) && validPortableId(value.mountFrameId) &&
    validPortableId(value.componentId) && validRaster(value.raster) &&
    validGeometry(value.geometry);
}

function validPricedItem(value: unknown): value is ProductKitPricedItem {
  if (!isRecord(value) || !validItemId(value.itemId) ||
    !validPortableId(value.priceAssetId)) return false;
  if (value.kind === "base") {
    return hasExactKeys(value, ["kind", "itemId", "priceAssetId"]);
  }
  return value.kind === "component" && hasExactKeys(value, [
    "kind", "itemId", "placementId", "componentId", "priceAssetId"
  ]) && validPortableId(value.placementId) && validPortableId(value.componentId);
}

function validatePlan(value: unknown): ValidatedPlan | null {
  if (!isRecord(value) || !hasExactKeys(value, ["kitId", "layers", "pricedItems"]) ||
    !validPortableId(value.kitId) || !Array.isArray(value.layers) ||
    value.layers.length !== PRODUCT_KIT_LAYER_ORDER.length ||
    !Array.isArray(value.pricedItems) || value.pricedItems.length < 1 ||
    value.pricedItems[0]?.kind !== "base") return null;

  const entryIds = new Set<string>();
  const baseEntries: ProductKitLayerEntry[] = [];
  const components = new Map<string, ComponentPlacementIdentity>();
  for (let index = 0; index < value.layers.length; index += 1) {
    const bucket = value.layers[index];
    if (!isRecord(bucket) || !hasExactKeys(bucket, ["layer", "entries"]) ||
      bucket.layer !== PRODUCT_KIT_LAYER_ORDER[index] || !Array.isArray(bucket.entries)) {
      return null;
    }
    for (const entry of bucket.entries) {
      if (!validLayerEntry(entry) || entryIds.has(entry.itemId)) return null;
      entryIds.add(entry.itemId);
      if (entry.kind === "base-raster") {
        if (bucket.layer !== "body") return null;
        baseEntries.push(entry);
      } else if (entry.kind === "artwork-slot") {
        if (bucket.layer !== "artwork") return null;
      } else {
        if (bucket.layer !== "rear" && bucket.layer !== "front" &&
          bucket.layer !== "overlay") return null;
        const prior = components.get(entry.placementId);
        if (prior && (prior.componentId !== entry.componentId ||
          prior.mountFrameId !== entry.mountFrameId)) return null;
        components.set(entry.placementId, {
          componentId: entry.componentId,
          mountFrameId: entry.mountFrameId
        });
      }
    }
  }
  if (baseEntries.length !== 1) return null;

  const pricedIds = new Set<string>();
  const pricedPlacements = new Set<string>();
  let baseCount = 0;
  for (const item of value.pricedItems) {
    if (!validPricedItem(item) || pricedIds.has(item.itemId)) return null;
    pricedIds.add(item.itemId);
    if (item.kind === "base") {
      baseCount += 1;
      if (item.itemId !== baseEntries[0]!.itemId) return null;
      continue;
    }
    const component = components.get(item.placementId);
    if (!component || component.componentId !== item.componentId ||
      pricedPlacements.has(item.placementId)) return null;
    pricedPlacements.add(item.placementId);
  }
  if (baseCount !== 1 || pricedPlacements.size !== components.size) return null;
  return {
    plan: value as unknown as ProductKitLayerPlan,
    mountByPlacementId: components
  };
}

function pricingParts(value: unknown): PricingParts | null {
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (!hasExactKeys(descriptors, [
    "packId", "pricingVersion", "blueprintTitleByKitId", "byPriceAssetId"
  ])) return null;
  const part = (key: keyof PricingParts): unknown => {
    const descriptor = descriptors[key];
    return descriptor && "value" in descriptor && descriptor.enumerable
      ? descriptor.value
      : undefined;
  };
  const packId = part("packId");
  const pricingVersion = part("pricingVersion");
  const blueprintTitleByKitId = part("blueprintTitleByKitId");
  const byPriceAssetId = part("byPriceAssetId");
  if (!validPortableId(packId) || !safeNonNegativeInteger(pricingVersion) ||
    pricingVersion < 1 || !isRecord(blueprintTitleByKitId) ||
    !isRecord(byPriceAssetId) && !(byPriceAssetId instanceof Map)) return null;
  return {
    packId,
    pricingVersion,
    blueprintTitleByKitId: blueprintTitleByKitId as unknown as ReadonlyMap<string, string>,
    byPriceAssetId: byPriceAssetId as unknown as ReadonlyMap<string, ProductKitPrice>
  };
}

function mapGet<Key, Value>(map: ReadonlyMap<Key, Value>, key: Key): Value | undefined {
  const method = Reflect.get(map as object, "get");
  return typeof method === "function"
    ? Reflect.apply(method, map, [key]) as Value | undefined
    : undefined;
}

function snapshotPrice(value: unknown, expectedId: string): ProductKitPrice | null {
  const snapshot = snapshotPlainData(value, { maxNodes: 32, maxArrayLength: 0 });
  if (!isRecord(snapshot) || !hasExactKeys(snapshot, [
    "priceAssetId", "groupId", "groupLabel", "kind", "label", "costCents"
  ]) || snapshot.priceAssetId !== expectedId || !validPortableId(snapshot.groupId) ||
    !validLabel(snapshot.groupLabel) || !PRODUCT_CHOICE_KINDS.has(snapshot.kind as string) ||
    !validLabel(snapshot.label) || !safeNonNegativeInteger(snapshot.costCents)) return null;
  return snapshot as unknown as ProductKitPrice;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function quoteProductKitComposition(
  plan: ProductKitLayerPlan,
  pricing: ProductKitPricingIndex
): ProductBuildQuote | null {
  try {
    const snapshot = snapshotPlainData(plan, {
      maxNodes: 4_000_000,
      maxArrayLength: 131_072
    });
    const validated = snapshot === null ? null : validatePlan(snapshot);
    const index = pricingParts(pricing);
    if (!validated || !index) return null;
    const blueprintTitle = mapGet(index.blueprintTitleByKitId, validated.plan.kitId);
    if (!validLabel(blueprintTitle)) return null;

    const selections: ProductGroupSelection[] = [];
    const lines: ProductCostLine[] = [];
    const selectionByGroup = new Map<string, { groupId: string; choiceIds: string[] }>();
    const groupByMountFrame = new Map<string, string>();
    const mountFrameByGroup = new Map<string, string>();
    let total = 0;
    let baseGroupId: string | null = null;

    for (const item of validated.plan.pricedItems) {
      const price = snapshotPrice(
        mapGet(index.byPriceAssetId, item.priceAssetId),
        item.priceAssetId
      );
      if (!price || item.kind === "base" && price.kind !== "base" ||
        item.kind === "component" && price.kind === "base") return null;

      if (item.kind === "base") {
        if (baseGroupId !== null || mountFrameByGroup.has(price.groupId)) return null;
        baseGroupId = price.groupId;
      } else {
        const identity = validated.mountByPlacementId.get(item.placementId);
        if (!identity || identity.componentId !== item.componentId) return null;
        const expectedGroup = groupByMountFrame.get(identity.mountFrameId);
        const expectedFrame = mountFrameByGroup.get(price.groupId);
        if (expectedGroup !== undefined && expectedGroup !== price.groupId ||
          expectedFrame !== undefined && expectedFrame !== identity.mountFrameId ||
          price.groupId === baseGroupId) return null;
        groupByMountFrame.set(identity.mountFrameId, price.groupId);
        mountFrameByGroup.set(price.groupId, identity.mountFrameId);
      }

      let selection = selectionByGroup.get(price.groupId);
      if (!selection) {
        selection = { groupId: price.groupId, choiceIds: [] };
        selectionByGroup.set(price.groupId, selection);
        selections.push(selection);
      }
      selection.choiceIds.push(item.itemId);
      lines.push({
        groupId: price.groupId,
        groupLabel: price.groupLabel,
        kind: price.kind,
        choiceId: item.itemId,
        label: price.label,
        costCents: price.costCents
      });
      const nextTotal = total + price.costCents;
      if (!Number.isSafeInteger(nextTotal)) return null;
      total = nextTotal;
    }
    if (baseGroupId === null || selections[0]?.groupId !== baseGroupId) return null;
    const suggestedPrice = suggestedPriceForCost(total);
    if (!suggestedPrice) return null;
    return deepFreeze({
      packId: index.packId,
      pricingVersion: index.pricingVersion,
      blueprintId: validated.plan.kitId,
      blueprintTitle,
      selections,
      costLines: lines,
      unitCostCents: total,
      suggestedPrice: { ...suggestedPrice }
    });
  } catch {
    return null;
  }
}
