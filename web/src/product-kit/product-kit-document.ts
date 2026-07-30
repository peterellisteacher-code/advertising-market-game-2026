import { z } from "zod";
import type { ProductKitLayerPlan, ProductKitPricedItem } from "./layer-plan";
import { snapshotPlainData } from "./plain-data";
import type { ProductKitCatalogue } from "./product-kit-catalogue";
import { quoteProductKitComposition } from "./product-kit-economics";
import type { ProductKitPricingIndex } from "./product-kit-pricing";
import type {
  ProductKitCompositionRequest,
  ProductKitRuntime
} from "./product-kit-runtime";

const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;
const OBJECT_ID = /^[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)*(?![\s\S])/;
const BASE_ITEM_ID = /^base:[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;
const PLACEMENT_ITEM_ID = /^placement:[a-z0-9]+(?:-[a-z0-9]+)*(?![\s\S])/;
const SHA256 = /^[0-9a-f]{64}(?![\s\S])/;

const portableId = z.string().min(1).max(80).regex(PORTABLE_ID);
const objectId = z.string().min(1).max(128).regex(OBJECT_ID);
const sha256 = z.string().regex(SHA256);
const nonNegativeSafeInteger = z.number().int().nonnegative()
  .refine(Number.isSafeInteger)
  .refine((value) => !Object.is(value, -0));

const FixedPlacementSchema = z.strictObject({
  kind: z.enum(["socket", "grip"]),
  placementId: portableId,
  mountFrameId: portableId,
  componentId: portableId
});

const GridPlacementSchema = z.strictObject({
  kind: z.literal("grid"),
  placementId: portableId,
  mountFrameId: portableId,
  componentId: portableId,
  column: nonNegativeSafeInteger,
  row: nonNegativeSafeInteger
});

const CompositionRequestSchema = z.strictObject({
  kitId: portableId,
  placements: z.array(z.discriminatedUnion("kind", [
    FixedPlacementSchema,
    GridPlacementSchema
  ])).max(131_072)
}).superRefine((request, context) => {
  const placementIds = request.placements.map(({ placementId }) => placementId);
  if (new Set(placementIds).size !== placementIds.length) {
    context.addIssue({
      code: "custom",
      path: ["placements"],
      message: "Product Kit placement IDs must be unique"
    });
  }
});

const BasePricedItemSchema = z.strictObject({
  kind: z.literal("base"),
  itemId: z.string().min(1).max(100).regex(BASE_ITEM_ID),
  priceAssetId: portableId
});

const ComponentPricedItemSchema = z.strictObject({
  kind: z.literal("component"),
  itemId: z.string().min(1).max(100).regex(PLACEMENT_ITEM_ID),
  placementId: portableId,
  componentId: portableId,
  priceAssetId: portableId
}).refine(({ itemId, placementId }) => itemId === `placement:${placementId}`, {
  path: ["itemId"],
  message: "Product Kit component item ID must match its placement"
});

const PricedItemSchema = z.discriminatedUnion("kind", [
  BasePricedItemSchema,
  ComponentPricedItemSchema
]);

export const ProductKitCompositionReferenceSchema = z.strictObject({
  kind: z.literal("product-kit-composition"),
  version: z.literal(1),
  objectId,
  productKitPackId: portableId,
  catalogPackId: portableId,
  catalogSha256: sha256,
  request: CompositionRequestSchema,
  pricedItems: z.array(PricedItemSchema).min(1).max(131_073)
}).superRefine((reference, context) => {
  const itemIds = reference.pricedItems.map(({ itemId }) => itemId);
  if (new Set(itemIds).size !== itemIds.length) {
    context.addIssue({
      code: "custom",
      path: ["pricedItems"],
      message: "Product Kit priced item IDs must be unique"
    });
  }
  const bases = reference.pricedItems.filter(({ kind }) => kind === "base");
  if (bases.length !== 1 || bases[0]?.itemId !== `base:${reference.request.kitId}`) {
    context.addIssue({
      code: "custom",
      path: ["pricedItems"],
      message: "Product Kit references require the exact base item"
    });
  }
  const requestPlacements = new Map(reference.request.placements.map((placement) => [
    placement.placementId,
    placement.componentId
  ]));
  const pricedPlacements = reference.pricedItems.filter((item) => item.kind === "component");
  if (pricedPlacements.length !== requestPlacements.size || pricedPlacements.some((item) =>
    requestPlacements.get(item.placementId) !== item.componentId
  )) {
    context.addIssue({
      code: "custom",
      path: ["pricedItems"],
      message: "Product Kit priced components must match the request placements"
    });
  }
});

export interface ProductKitCompositionReference {
  readonly kind: "product-kit-composition";
  readonly version: 1;
  readonly objectId: string;
  readonly productKitPackId: string;
  readonly catalogPackId: string;
  readonly catalogSha256: string;
  readonly request: ProductKitCompositionRequest;
  readonly pricedItems: readonly ProductKitPricedItem[];
}

export interface ProductKitDocumentContext {
  readonly catalogue: ProductKitCatalogue;
  readonly runtime: ProductKitRuntime;
  readonly pricing: ProductKitPricingIndex;
}

function pricedItemsEqual(
  left: readonly ProductKitPricedItem[],
  right: readonly ProductKitPricedItem[]
): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const expected = right[index];
    if (!expected || item.kind !== expected.kind || item.itemId !== expected.itemId ||
      item.priceAssetId !== expected.priceAssetId) return false;
    return item.kind === "base" && expected.kind === "base" ||
      item.kind === "component" && expected.kind === "component" &&
      item.placementId === expected.placementId &&
      item.componentId === expected.componentId;
  });
}

function admittedPlan(
  reference: ProductKitCompositionReference,
  context: ProductKitDocumentContext
): ProductKitLayerPlan | null {
  if (reference.productKitPackId !== context.catalogue.packId ||
    reference.productKitPackId !== context.pricing.packId ||
    reference.catalogPackId !== context.catalogue.catalogPackId ||
    reference.catalogSha256 !== context.catalogue.catalogSha256 ||
    !context.catalogue.kits.some(({ id }) => id === reference.request.kitId)) return null;
  const plan = context.runtime.planComposition(reference.request);
  if (!plan || plan.kitId !== reference.request.kitId ||
    !pricedItemsEqual(reference.pricedItems, plan.pricedItems)) return null;
  const quote = quoteProductKitComposition(plan, context.pricing);
  return quote && quote.packId === reference.productKitPackId &&
    quote.blueprintId === reference.request.kitId
    ? plan
    : null;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function parseProductKitCompositionReference(
  value: unknown,
  context: ProductKitDocumentContext
): ProductKitCompositionReference | null {
  try {
    const snapshot = snapshotPlainData(value, {
      maxNodes: 2_000_000,
      maxArrayLength: 131_073
    });
    if (snapshot === null) return null;
    const parsed = ProductKitCompositionReferenceSchema.safeParse(snapshot);
    if (!parsed.success) return null;
    const reference = parsed.data as ProductKitCompositionReference;
    if (!admittedPlan(reference, context)) return null;
    return deepFreeze(reference);
  } catch {
    return null;
  }
}

export const validateProductKitCompositionReference =
  parseProductKitCompositionReference;
