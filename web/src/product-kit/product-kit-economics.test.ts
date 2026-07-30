import { describe, expect, it } from "vitest";
import type { ProductKitLayerPlan, ProductKitPricedItem } from "./layer-plan";
import type {
  ProductKitPrice,
  ProductKitPricingIndex
} from "./product-kit-pricing";
import { quoteProductKitComposition } from "./product-kit-economics";

const HASH = "a".repeat(64);

function raster(assetId: string) {
  return {
    assetId,
    masterSha256: HASH,
    frame: {
      originalWidth: 400,
      originalHeight: 500,
      trimX: 0,
      trimY: 0,
      trimWidth: 400,
      trimHeight: 500
    }
  };
}

function componentEntry(
  placementId: string,
  layer: "rear" | "front" | "overlay",
  mountFrameId = "pk1-lid-frame",
  componentId = "pk1-flat-lid"
) {
  return {
    kind: "component-raster" as const,
    itemId: `fragment:${placementId}:${layer}`,
    placementId,
    mountFrameId,
    componentId,
    raster: raster(`asset-${placementId}-${layer}`),
    geometry: {
      kind: "affine" as const,
      transform: {
        matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
        scale: 1,
        rotationDegrees: 0,
        mirrored: false,
        maxNormalErrorDegrees: 0
      }
    }
  };
}

function plan(options: {
  readonly placements?: readonly string[];
  readonly splitFirst?: boolean;
} = {}): ProductKitLayerPlan {
  const placements = options.placements ?? ["lid-one"];
  const rear = options.splitFirst && placements[0]
    ? [componentEntry(placements[0], "rear")]
    : [];
  const front = placements.map((placementId) => componentEntry(placementId, "front"));
  return {
    kitId: "pk1-tumbler-kit",
    layers: [{ layer: "rear", entries: rear }, {
      layer: "body",
      entries: [{
        kind: "base-raster",
        itemId: "base:pk1-tumbler-kit",
        raster: raster("asset-tumbler")
      }]
    }, {
      layer: "front",
      entries: front
    }, {
      layer: "artwork",
      entries: [{
        kind: "artwork-slot",
        itemId: "artwork:pk1-tumbler-kit:0",
        index: 0,
        bounds: { x: 0.3, y: 0.4, width: 0.2, height: 0.2 }
      }]
    }, {
      layer: "overlay",
      entries: []
    }],
    pricedItems: [{
      kind: "base",
      itemId: "base:pk1-tumbler-kit",
      priceAssetId: "pk1-price-tumbler"
    }, ...placements.map((placementId) => ({
      kind: "component" as const,
      itemId: `placement:${placementId}`,
      placementId,
      componentId: "pk1-flat-lid",
      priceAssetId: "pk1-price-flat-lid"
    }))]
  };
}

function price(
  priceAssetId: string,
  overrides: Partial<ProductKitPrice> = {}
): ProductKitPrice {
  const base = priceAssetId === "pk1-price-tumbler";
  return Object.freeze({
    priceAssetId,
    groupId: base ? "pk1-base-group" : "pk1-lid-group",
    groupLabel: base ? "Product body" : "Lid",
    kind: base ? "base" as const : "part" as const,
    label: base ? "Product body" : "Flat lid",
    costCents: base ? 480 : 70,
    ...overrides
  });
}

function pricing(overrides: {
  readonly base?: Partial<ProductKitPrice>;
  readonly lid?: Partial<ProductKitPrice>;
  readonly omit?: string;
} = {}): ProductKitPricingIndex {
  const values = [
    price("pk1-price-tumbler", overrides.base),
    price("pk1-price-flat-lid", overrides.lid)
  ].filter(({ priceAssetId }) => priceAssetId !== overrides.omit);
  return Object.freeze({
    packId: "pk1-pilot-drinkware",
    pricingVersion: 1,
    blueprintTitleByKitId: new Map([["pk1-tumbler-kit", "Reusable tumbler"]]),
    byPriceAssetId: new Map(values.map((value) => [value.priceAssetId, value]))
  });
}

describe("quoteProductKitComposition", () => {
  it("prices split raster fragments once using indexed group IDs", () => {
    const quote = quoteProductKitComposition(plan({ splitFirst: true }), pricing());

    expect(quote).toEqual({
      packId: "pk1-pilot-drinkware",
      pricingVersion: 1,
      blueprintId: "pk1-tumbler-kit",
      blueprintTitle: "Reusable tumbler",
      selections: [{
        groupId: "pk1-base-group",
        choiceIds: ["base:pk1-tumbler-kit"]
      }, {
        groupId: "pk1-lid-group",
        choiceIds: ["placement:lid-one"]
      }],
      costLines: [{
        groupId: "pk1-base-group",
        groupLabel: "Product body",
        kind: "base",
        choiceId: "base:pk1-tumbler-kit",
        label: "Product body",
        costCents: 480
      }, {
        groupId: "pk1-lid-group",
        groupLabel: "Lid",
        kind: "part",
        choiceId: "placement:lid-one",
        label: "Flat lid",
        costCents: 70
      }],
      unitCostCents: 550,
      suggestedPrice: { minimumCents: 700, maximumCents: 1_000 }
    });
  });

  it("keeps repeated placements as distinct cost lines", () => {
    const quote = quoteProductKitComposition(
      plan({ placements: ["lid-one", "lid-two"] }),
      pricing()
    );

    expect(quote?.unitCostCents).toBe(620);
    expect(quote?.selections[1]).toEqual({
      groupId: "pk1-lid-group",
      choiceIds: ["placement:lid-one", "placement:lid-two"]
    });
    expect(quote?.costLines.map(({ choiceId }) => choiceId)).toEqual([
      "base:pk1-tumbler-kit",
      "placement:lid-one",
      "placement:lid-two"
    ]);
  });

  it("requires every price identity and one pricing group per mount frame", () => {
    expect(quoteProductKitComposition(plan(), pricing({
      omit: "pk1-price-flat-lid"
    }))).toBeNull();

    const changed = structuredClone(plan({ placements: ["lid-one", "lid-two"] }));
    (changed.pricedItems as ProductKitPricedItem[])[2] = {
      ...changed.pricedItems[2]!,
      priceAssetId: "pk1-price-tall-lid"
    } as never;
    const index = pricing();
    const conflicting = {
      ...index,
      byPriceAssetId: new Map([
        ...index.byPriceAssetId,
        ["pk1-price-tall-lid", price("pk1-price-tall-lid", {
          groupId: "pk1-other-lid-group"
        })]
      ])
    };
    expect(quoteProductKitComposition(changed, conflicting)).toBeNull();

    const split = structuredClone(plan({ splitFirst: true }));
    (split.layers[2]!.entries[0] as { mountFrameId: string }).mountFrameId =
      "pk1-different-frame";
    expect(quoteProductKitComposition(split, pricing())).toBeNull();
  });

  it("rejects a component-first plan that reuses the base pricing group", () => {
    const source = plan();
    const reordered: ProductKitLayerPlan = {
      ...source,
      pricedItems: [source.pricedItems[1]!, source.pricedItems[0]!]
    };

    expect(quoteProductKitComposition(reordered, pricing({
      lid: { groupId: "pk1-base-group" }
    }))).toBeNull();
  });

  it("rejects duplicate item identities and safe-integer overflow", () => {
    const duplicate = structuredClone(plan({ placements: ["lid-one", "lid-two"] }));
    (duplicate.pricedItems as ProductKitPricedItem[])[2] = {
      ...duplicate.pricedItems[2]!,
      itemId: "placement:lid-one"
    } as never;
    expect(quoteProductKitComposition(duplicate, pricing())).toBeNull();

    expect(quoteProductKitComposition(plan(), pricing({
      base: { costCents: 5_000_000_000_000_000 },
      lid: { costCents: 5_000_000_000_000_000 }
    }))).toBeNull();
  });

  it("returns a detached deeply frozen quote", () => {
    const sourcePlan = plan();
    const sourcePricing = pricing();
    const quote = quoteProductKitComposition(sourcePlan, sourcePricing)!;

    (sourcePlan.pricedItems as unknown as Array<{ itemId: string }>)[0]!.itemId = "changed";
    (sourcePricing.byPriceAssetId as Map<string, ProductKitPrice>).set(
      "pk1-price-tumbler",
      price("pk1-price-tumbler", { costCents: 1 })
    );

    expect(quote.costLines[0]?.choiceId).toBe("base:pk1-tumbler-kit");
    expect(quote.costLines[0]?.costCents).toBe(480);
    expect(Object.isFrozen(quote)).toBe(true);
    expect(Object.isFrozen(quote.selections)).toBe(true);
    expect(Object.isFrozen(quote.selections[0]?.choiceIds)).toBe(true);
    expect(Object.isFrozen(quote.costLines[0])).toBe(true);
    expect(Object.isFrozen(quote.suggestedPrice)).toBe(true);
  });

  it("default-denies extra keys, sparse arrays, accessors and hostile proxies", () => {
    expect(quoteProductKitComposition({ ...plan(), unexpected: true } as never, pricing()))
      .toBeNull();

    const sparseItems = new Array<ProductKitPricedItem>(2);
    sparseItems[0] = plan().pricedItems[0]!;
    expect(quoteProductKitComposition({
      ...plan(), pricedItems: sparseItems
    }, pricing())).toBeNull();

    let reads = 0;
    const accessor = structuredClone(plan()) as unknown as Record<string, unknown>;
    Object.defineProperty(accessor, "pricedItems", {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error("must not read");
      }
    });
    const hostile = new Proxy({}, {
      ownKeys() {
        throw new Error("hostile ownKeys");
      }
    });

    expect(() => quoteProductKitComposition(accessor as never, pricing())).not.toThrow();
    expect(quoteProductKitComposition(accessor as never, pricing())).toBeNull();
    expect(reads).toBe(0);
    expect(() => quoteProductKitComposition(hostile as never, pricing())).not.toThrow();
    expect(quoteProductKitComposition(hostile as never, pricing())).toBeNull();
  });
});
