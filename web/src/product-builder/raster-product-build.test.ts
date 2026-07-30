import { describe, expect, it } from "vitest";
import { createBlankCampaignDocument, parseCampaignDocument } from "../domain/campaign-document";
import type { RasterAssetPrice, RasterPricingIndex } from "../catalogue/raster-pricing";
import type { ProductKitLayerPlan } from "../product-kit/layer-plan";
import type { ProductKitPrice, ProductKitPricingIndex } from "../product-kit/product-kit-pricing";
import type {
  ProductKitCompositionReference,
  ProductKitDocumentContext
} from "../product-kit/product-kit-document";
import { quoteProductKitComposition } from "../product-kit/product-kit-economics";
import { createProductBuildSnapshot } from "./product-economics";
import { reconcileRasterProductBuild } from "./raster-product-build";

const pricing = (): RasterPricingIndex => Object.freeze({
  packId: "offline-core-v1" as const,
  pricingVersion: 1,
  catalogSha256: "a".repeat(64),
  byAssetId: new Map<string, RasterAssetPrice>([
    ["bottle-base", Object.freeze({ role: "base" as const, costCents: 2_500, title: "Bottle body" })],
    ["bottle-cap", Object.freeze({ role: "part" as const, costCents: 350, title: "Flip cap" })],
    ["billboard-frame", Object.freeze({ role: "media" as const, costCents: 900, title: "Billboard frame" })]
  ])
});

const image = (objectId: string, assetId: string) => ({
  type: "FabricImage",
  objectId,
  elementKind: "image" as const,
  assetId,
  accessibleName: assetId,
  src: `/catalog/generated/offline-core-v1/assets/${assetId}/master.png`
});

const reference = (objectId: string, assetId: string) => ({
  kind: "catalog",
  objectId,
  assetId,
  assetVersion: 1,
  attribution: { creator: "Classroom pack", sourceUrl: "local", license: "classroom-session" }
});

function documentWith(objects: Array<ReturnType<typeof image>>) {
  return parseCampaignDocument({
    ...createBlankCampaignDocument({
      documentId: "campaign-1", sessionId: "session-1", mode: "offline"
    }),
    fabricState: { version: "7.4.0", objects },
    assetReferences: objects.map(({ objectId, assetId }) => reference(objectId, assetId))
  });
}

const PRODUCT_KIT_HASH = "8".repeat(64);

function productKitPlan(): ProductKitLayerPlan {
  const raster = (assetId: string) => ({
    assetId,
    masterSha256: "a".repeat(64),
    frame: {
      originalWidth: 400, originalHeight: 500,
      trimX: 0, trimY: 0, trimWidth: 400, trimHeight: 500
    }
  });
  return {
    kitId: "pk1-tumbler-kit",
    layers: [{ layer: "rear", entries: [] }, {
      layer: "body",
      entries: [{
        kind: "base-raster",
        itemId: "base:pk1-tumbler-kit",
        raster: raster("bottle-base")
      }]
    }, {
      layer: "front",
      entries: [{
        kind: "component-raster",
        itemId: "fragment:lid-one:front",
        placementId: "lid-one",
        mountFrameId: "pk1-lid-frame",
        componentId: "pk1-flat-lid",
        raster: raster("bottle-cap"),
        geometry: {
          kind: "affine",
          transform: {
            matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
            scale: 1,
            rotationDegrees: 0,
            mirrored: false,
            maxNormalErrorDegrees: 0
          }
        }
      }]
    }, { layer: "artwork", entries: [] }, { layer: "overlay", entries: [] }],
    pricedItems: [{
      kind: "base",
      itemId: "base:pk1-tumbler-kit",
      priceAssetId: "pk1-price-tumbler"
    }, {
      kind: "component",
      itemId: "placement:lid-one",
      placementId: "lid-one",
      componentId: "pk1-flat-lid",
      priceAssetId: "pk1-price-flat-lid"
    }]
  };
}

function productKitPricing(): ProductKitPricingIndex {
  const values: ProductKitPrice[] = [{
    priceAssetId: "pk1-price-tumbler",
    groupId: "pk1-base-group",
    groupLabel: "Product body",
    kind: "base",
    label: "Product body",
    costCents: 480
  }, {
    priceAssetId: "pk1-price-flat-lid",
    groupId: "pk1-lid-group",
    groupLabel: "Lid",
    kind: "part",
    label: "Flat lid",
    costCents: 70
  }];
  return {
    packId: "pk1-pilot-drinkware",
    pricingVersion: 1,
    blueprintTitleByKitId: new Map([["pk1-tumbler-kit", "Reusable tumbler"]]),
    byPriceAssetId: new Map(values.map((value) => [value.priceAssetId, value]))
  };
}

function productKitReference(
  overrides: Partial<ProductKitCompositionReference> = {}
): ProductKitCompositionReference {
  return {
    kind: "product-kit-composition",
    version: 1,
    objectId: "product-kit-root",
    productKitPackId: "pk1-pilot-drinkware",
    catalogPackId: "offline-core-v1",
    catalogSha256: PRODUCT_KIT_HASH,
    request: {
      kitId: "pk1-tumbler-kit",
      placements: [{
        kind: "socket",
        placementId: "lid-one",
        mountFrameId: "pk1-lid-frame",
        componentId: "pk1-flat-lid"
      }]
    },
    pricedItems: productKitPlan().pricedItems,
    ...overrides
  };
}

function productKitContext(): ProductKitDocumentContext {
  return {
    catalogue: {
      packId: "pk1-pilot-drinkware",
      catalogPackId: "offline-core-v1",
      catalogSha256: PRODUCT_KIT_HASH,
      kits: [{ id: "pk1-tumbler-kit" }]
    } as never,
    runtime: {
      resolvePair: () => null,
      planComposition: (request) => request.kitId === "pk1-tumbler-kit" &&
        request.placements.length === 1 &&
        request.placements[0]?.placementId === "lid-one" &&
        request.placements[0]?.mountFrameId === "pk1-lid-frame" &&
        request.placements[0]?.componentId === "pk1-flat-lid"
        ? productKitPlan()
        : null
    },
    pricing: productKitPricing()
  };
}

function productKitRoot() {
  return {
    type: "Group",
    objectId: "product-kit-root",
    elementKind: "product-kit" as const,
    accessibleName: "Reusable tumbler",
    productKitPackId: "pk1-pilot-drinkware",
    productKitId: "pk1-tumbler-kit",
    productKitCatalogSha256: PRODUCT_KIT_HASH,
    objects: [image("product-kit-base-fragment", "bottle-base"),
      image("product-kit-lid-fragment", "bottle-cap")]
  };
}

function productKitDocument() {
  const quote = quoteProductKitComposition(productKitPlan(), productKitPricing());
  if (!quote) throw new Error("Product Kit quote fixture is invalid");
  const build = createProductBuildSnapshot(quote, "product-kit-root");
  const blank = createBlankCampaignDocument({
    documentId: "product-kit-campaign",
    sessionId: "product-kit-session",
    mode: "offline"
  });
  return parseCampaignDocument({
    ...blank,
    fabricState: { version: "7.4.0", objects: [productKitRoot()] },
    product: { ...blank.product, build },
    brief: {
      ...blank.brief,
      targetAudienceId: "audience-1",
      contextId: "audience-1"
    },
    strategy: {
      ...blank.strategy,
      marketedChoiceIds: ["placement:lid-one"],
      marketRoute: {
        audienceBriefId: "audience-1",
        zoneId: "city",
        mediaIds: ["billboard"],
        committed: true
      }
    },
    assetReferences: [productKitReference(),
      reference("product-kit-base-fragment", "bottle-base"),
      reference("product-kit-lid-fragment", "bottle-cap")]
  });
}

describe("reconcileRasterProductBuild", () => {
  it("prices placed bases and add-ons while retaining media as a separate visual cost", () => {
    const result = reconcileRasterProductBuild(documentWith([
      image("base-object", "bottle-base"),
      image("cap-object", "bottle-cap"),
      image("media-object", "billboard-frame")
    ]), pricing());

    expect(result.assetReferences).toHaveLength(3);
    expect(result.product.build).toMatchObject({
      primaryObjectId: "base-object",
      packId: "offline-core-v1",
      pricingVersion: 1,
      blueprintId: "raster-product",
      unitCostCents: 2_850
    });
    expect(result.product.build?.costLines).toEqual([
      expect.objectContaining({ choiceId: "base-object", kind: "base", label: "Bottle body", costCents: 2_500 }),
      expect.objectContaining({ choiceId: "cap-object", kind: "part", label: "Flip cap", costCents: 350 })
    ]);
  });

  it("counts repeated placements rather than deduplicating their asset ID", () => {
    const result = reconcileRasterProductBuild(documentWith([
      image("base-a", "bottle-base"), image("base-b", "bottle-base")
    ]), pricing());

    expect(result.product.build?.unitCostCents).toBe(5_000);
    expect(result.product.build?.costLines.map(({ choiceId }) => choiceId)).toEqual(["base-a", "base-b"]);
  });

  it("drops stale references and dependent strategy when the last base disappears", () => {
    const initial = reconcileRasterProductBuild(documentWith([
      image("base-object", "bottle-base"), image("cap-object", "bottle-cap")
    ]), pricing());
    const routed = parseCampaignDocument({
      ...structuredClone(initial),
      brief: {
        ...structuredClone(initial.brief),
        targetAudienceId: "audience-1",
        contextId: "audience-1"
      },
      strategy: {
        ...structuredClone(initial.strategy),
        marketedChoiceIds: ["base-object"],
        marketRoute: {
          audienceBriefId: "audience-1",
          zoneId: "city",
          mediaIds: ["billboard"],
          committed: true
        }
      }
    });
    const removed = structuredClone(routed);
    removed.fabricState.objects = [image("cap-object", "bottle-cap")];

    const result = reconcileRasterProductBuild(removed, pricing());

    expect(result.assetReferences.map(({ objectId }) => objectId)).toEqual(["cap-object"]);
    expect(result.product.build).toBeNull();
    expect(result.strategy.marketedChoiceIds).toEqual([]);
    expect(result.strategy.marketRoute).toBeNull();
  });

  it("preserves an exact Product Kit build through contextual reconciliation", () => {
    const source = productKitDocument();
    const result = reconcileRasterProductBuild(source, pricing(), productKitContext());

    expect(result.product.build).toEqual(source.product.build);
    expect(result.product.build).not.toBe(source.product.build);
    expect(result.product.build).toMatchObject({
      primaryObjectId: "product-kit-root",
      packId: "pk1-pilot-drinkware",
      pricingVersion: 1,
      blueprintId: "pk1-tumbler-kit",
      unitCostCents: 550
    });
    expect(result.strategy.marketedChoiceIds).toEqual(["placement:lid-one"]);
    expect(result.strategy.marketRoute).not.toBeNull();
  });

  it("clears Product Kit economics when its root is removed without generic fallback", () => {
    const removed = structuredClone(productKitDocument());
    const root = removed.fabricState.objects[0] as ReturnType<typeof productKitRoot>;
    removed.fabricState.objects = root.objects;

    const result = reconcileRasterProductBuild(removed, pricing(), productKitContext());

    expect(result.assetReferences.map((entry) => entry.objectId)).toEqual([
      "product-kit-base-fragment", "product-kit-lid-fragment"
    ]);
    expect(result.product.build).toBeNull();
    expect(result.strategy.marketedChoiceIds).toEqual([]);
    expect(result.strategy.marketRoute).toBeNull();
  });

  it("clears Product Kit economics for missing context or a missing reference", () => {
    const withoutContext = reconcileRasterProductBuild(productKitDocument(), pricing());
    expect(withoutContext.product.build).toBeNull();
    expect(withoutContext.strategy.marketedChoiceIds).toEqual([]);
    expect(withoutContext.strategy.marketRoute).toBeNull();

    const missingReference = structuredClone(productKitDocument());
    missingReference.assetReferences = missingReference.assetReferences.filter(
      (entry) => entry.kind !== "product-kit-composition"
    );
    const reconciled = reconcileRasterProductBuild(
      missingReference,
      pricing(),
      productKitContext()
    );
    expect(reconciled.product.build).toBeNull();
    expect(reconciled.strategy.marketedChoiceIds).toEqual([]);
    expect(reconciled.strategy.marketRoute).toBeNull();
  });

  it("clears Product Kit economics for duplicate or contextually stale references", () => {
    const duplicate = structuredClone(productKitDocument());
    duplicate.assetReferences.push(structuredClone(duplicate.assetReferences[0]!));
    expect(reconcileRasterProductBuild(
      duplicate,
      pricing(),
      productKitContext()
    ).product.build).toBeNull();

    const stale = structuredClone(productKitDocument());
    (stale.assetReferences[0] as { catalogSha256: string }).catalogSha256 =
      "9".repeat(64);
    expect(reconcileRasterProductBuild(
      stale,
      pricing(),
      productKitContext()
    ).product.build).toBeNull();

    const pricedDrift = structuredClone(productKitDocument());
    const composition = pricedDrift.assetReferences[0] as unknown as {
      pricedItems: Array<{ priceAssetId: string }>;
    };
    composition.pricedItems[1]!.priceAssetId = "pk1-price-other-lid";
    expect(reconcileRasterProductBuild(
      pricedDrift,
      pricing(),
      productKitContext()
    ).product.build).toBeNull();
  });

  it("clears Product Kit economics for ledger or root identity drift", () => {
    const ledgerDrift = structuredClone(productKitDocument());
    ledgerDrift.product.build!.costLines[1]!.label = "Changed lid";
    expect(reconcileRasterProductBuild(
      ledgerDrift,
      pricing(),
      productKitContext()
    ).product.build).toBeNull();

    const buildIdentityDrift = structuredClone(productKitDocument());
    buildIdentityDrift.product.build!.packId = "pk1-other-pack";
    expect(reconcileRasterProductBuild(
      buildIdentityDrift,
      pricing(),
      productKitContext()
    ).product.build).toBeNull();

    const pricingIdentityDrift = structuredClone(productKitDocument());
    pricingIdentityDrift.product.build!.pricingVersion = 2;
    expect(reconcileRasterProductBuild(
      pricingIdentityDrift,
      pricing(),
      productKitContext()
    ).product.build).toBeNull();

    const rootIdentityDrift = structuredClone(productKitDocument());
    (rootIdentityDrift.fabricState.objects[0] as unknown as {
      productKitId: string;
    }).productKitId = "pk1-other-kit";
    const result = reconcileRasterProductBuild(
      rootIdentityDrift,
      pricing(),
      productKitContext()
    );
    expect(result.product.build).toBeNull();
    expect(result.strategy.marketedChoiceIds).toEqual([]);
    expect(result.strategy.marketRoute).toBeNull();
  });
});
