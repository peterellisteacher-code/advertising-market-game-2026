import {
  parseCampaignDocument,
  type CampaignDocumentV1,
  type ProductBuildSnapshotV1
} from "../domain/campaign-document";
import { campaignSemanticObjectMap } from "../domain/campaign-semantic-objects";
import type { RasterAssetPrice, RasterPricingIndex } from "../catalogue/raster-pricing";
import {
  parseProductKitCompositionReference,
  type ProductKitCompositionReference,
  type ProductKitDocumentContext
} from "../product-kit/product-kit-document";
import { quoteProductKitComposition } from "../product-kit/product-kit-economics";
import { createProductBuildSnapshot } from "./product-economics";

interface PricedPlacement {
  objectId: string;
  assetId: string;
  price: RasterAssetPrice;
}

type CampaignProductKitReference = ProductKitCompositionReference &
  Record<string, unknown>;

function isProductKitReference(
  reference: CampaignDocumentV1["assetReferences"][number]
): reference is CampaignProductKitReference {
  return reference.kind === "product-kit-composition";
}

function sameBuild(
  left: ProductBuildSnapshotV1,
  right: ProductBuildSnapshotV1
): boolean {
  return left.schema === right.schema &&
    left.primaryObjectId === right.primaryObjectId &&
    left.packId === right.packId &&
    left.pricingVersion === right.pricingVersion &&
    left.blueprintId === right.blueprintId &&
    left.unitCostCents === right.unitCostCents &&
    left.selections.length === right.selections.length &&
    left.selections.every((selection, index) => {
      const expected = right.selections[index];
      return expected !== undefined && selection.groupId === expected.groupId &&
        selection.choiceIds.length === expected.choiceIds.length &&
        selection.choiceIds.every((choiceId, choiceIndex) =>
          choiceId === expected.choiceIds[choiceIndex]
        );
    }) &&
    left.costLines.length === right.costLines.length &&
    left.costLines.every((line, index) => {
      const expected = right.costLines[index];
      return expected !== undefined && line.groupId === expected.groupId &&
        line.groupLabel === expected.groupLabel && line.kind === expected.kind &&
        line.choiceId === expected.choiceId && line.label === expected.label &&
        line.costCents === expected.costCents;
    });
}

function hasProductKitIntent(
  document: CampaignDocumentV1,
  productKitReferences: readonly ProductKitCompositionReference[],
  hasProductKitRoot: boolean,
  context: ProductKitDocumentContext | undefined
): boolean {
  if (hasProductKitRoot || productKitReferences.length > 0) return true;
  const build = document.product.build;
  if (!build) return false;
  if (context && (build.packId === context.pricing.packId ||
    context.catalogue.kits.some(({ id }) => id === build.blueprintId))) return true;
  return build.packId.startsWith("pk1-") && build.blueprintId.startsWith("pk1-");
}

function reconcileProductKitBuild(
  document: CampaignDocumentV1,
  references: readonly ProductKitCompositionReference[],
  context: ProductKitDocumentContext
): ProductBuildSnapshotV1 | null {
  const current = document.product.build;
  if (!current) return null;
  const objects = campaignSemanticObjectMap(document.fabricState);
  const root = objects.get(current.primaryObjectId);
  if (!root || root.elementKind !== "product-kit" || root.path.length !== 1) return null;
  const matching = references.filter(({ objectId }) => objectId === current.primaryObjectId);
  if (matching.length !== 1) return null;
  const reference = parseProductKitCompositionReference(matching[0], context);
  if (!reference || root.object.productKitPackId !== reference.productKitPackId ||
    root.object.productKitId !== reference.request.kitId ||
    root.object.productKitCatalogSha256 !== reference.catalogSha256) return null;
  const plan = context.runtime.planComposition(reference.request);
  const quote = plan ? quoteProductKitComposition(plan, context.pricing) : null;
  if (!quote) return null;
  const expected = createProductBuildSnapshot(quote, root.objectId) as ProductBuildSnapshotV1;
  return sameBuild(current, expected) ? expected : null;
}

function activeAssetReferences(
  document: CampaignDocumentV1,
  activeIds: ReadonlySet<string>
): CampaignDocumentV1["assetReferences"] {
  return document.assetReferences.filter((reference) =>
    typeof reference.objectId === "string" && activeIds.has(reference.objectId)
  ).map((reference) => structuredClone(reference));
}

function genericBuild(
  document: CampaignDocumentV1,
  references: CampaignDocumentV1["assetReferences"],
  pricing: RasterPricingIndex
): ProductBuildSnapshotV1 | null {
  const objects = campaignSemanticObjectMap(document.fabricState);
  const placements = new Map<string, PricedPlacement>();
  for (const reference of references) {
    if (reference.kind !== "catalog" || typeof reference.objectId !== "string" ||
      typeof reference.assetId !== "string") continue;
    const object = objects.get(reference.objectId);
    const price = pricing.byAssetId.get(reference.assetId);
    if (!object || !price || object.object.assetId !== reference.assetId ||
      (object.elementKind !== "image" && object.elementKind !== "masked-component")) continue;
    if (placements.has(reference.objectId)) {
      throw new Error(`Duplicate catalogue reference for ${reference.objectId}`);
    }
    placements.set(reference.objectId, {
      objectId: reference.objectId,
      assetId: reference.assetId,
      price
    });
  }

  const products = [...placements.values()].filter(({ price }) => price.role !== "media");
  const bases = products.filter(({ price }) => price.role === "base")
    .sort((left, right) => left.objectId.localeCompare(right.objectId));
  const parts = products.filter(({ price }) => price.role === "part")
    .sort((left, right) => left.objectId.localeCompare(right.objectId));
  if (bases.length === 0) return null;
  if ([...bases, ...parts].some(({ objectId }) => objectId.length > 100)) {
    throw new Error("Priced product object IDs may not exceed 100 characters");
  }

  const currentPrimary = document.product.build?.primaryObjectId;
  const primaryObjectId = bases.some(({ objectId }) => objectId === currentPrimary)
    ? currentPrimary!
    : bases[0]!.objectId;
  const selections = [{
    groupId: "raster-bases",
    choiceIds: bases.map(({ objectId }) => objectId)
  }, ...(parts.length > 0 ? [{
    groupId: "raster-add-ons",
    choiceIds: parts.map(({ objectId }) => objectId)
  }] : [])];
  const lines = [...bases.map(({ objectId, price }) => ({
    groupId: "raster-bases",
    groupLabel: "Product base",
    kind: "base" as const,
    choiceId: objectId,
    label: price.title,
    costCents: price.costCents
  })), ...parts.map(({ objectId, price }) => ({
    groupId: "raster-add-ons",
    groupLabel: "Added feature",
    kind: "part" as const,
    choiceId: objectId,
    label: price.title,
    costCents: price.costCents
  }))];
  return {
    schema: "product-build@1",
    primaryObjectId,
    packId: pricing.packId,
    pricingVersion: pricing.pricingVersion,
    blueprintId: "raster-product",
    selections,
    costLines: lines,
    unitCostCents: lines.reduce((sum, line) => sum + line.costCents, 0)
  };
}

export function reconcileRasterProductBuild(
  document: CampaignDocumentV1,
  pricing: RasterPricingIndex,
  productKitContext?: ProductKitDocumentContext
): CampaignDocumentV1 {
  const clone = structuredClone(document);
  const objects = campaignSemanticObjectMap(clone.fabricState);
  const activeIds = new Set(objects.keys());
  const productKitReferences = clone.assetReferences.filter(isProductKitReference);
  const productKitIntent = hasProductKitIntent(
    clone,
    productKitReferences,
    [...objects.values()].some(({ elementKind }) => elementKind === "product-kit"),
    productKitContext
  );
  const references = activeAssetReferences(clone, activeIds);
  const currentBuild = clone.product.build;
  const keepVariant = currentBuild !== null && activeIds.has(currentBuild.primaryObjectId) &&
    references.some((reference) => reference.kind === "product-builder-variant" &&
      reference.objectId === currentBuild.primaryObjectId);
  const build = productKitIntent
    ? productKitContext
      ? reconcileProductKitBuild(clone, productKitReferences, productKitContext)
      : null
    : keepVariant
      ? structuredClone(currentBuild)
      : genericBuild(clone, references, pricing);
  const choices = new Set(build?.selections.flatMap(({ choiceIds }) => choiceIds) ?? []);
  return parseCampaignDocument({
    ...clone,
    product: { ...clone.product, build },
    strategy: {
      ...clone.strategy,
      marketedChoiceIds: clone.strategy.marketedChoiceIds.filter((id) => choices.has(id)),
      marketRoute: build === null ? null : clone.strategy.marketRoute
    },
    evidence: Object.fromEntries(Object.entries(clone.evidence).map(([slot, ids]) => [
      slot,
      ids.filter((id) => activeIds.has(id))
    ])),
    assetReferences: references
  });
}
