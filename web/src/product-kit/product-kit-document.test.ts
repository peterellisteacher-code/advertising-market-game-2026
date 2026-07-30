import { describe, expect, it } from "vitest";
import type { ProductKitLayerPlan, ProductKitPricedItem } from "./layer-plan";
import type { ProductKitPrice, ProductKitPricingIndex } from "./product-kit-pricing";
import type { ProductKitCompositionRequest } from "./product-kit-runtime";
import {
  parseProductKitCompositionReference,
  type ProductKitCompositionReference,
  type ProductKitDocumentContext
} from "./product-kit-document";

const CATALOG_HASH = "8".repeat(64);
const ASSET_HASH = "a".repeat(64);

const request = (): ProductKitCompositionRequest => ({
  kitId: "pk1-tumbler-kit",
  placements: [{
    kind: "socket",
    placementId: "lid-one",
    mountFrameId: "pk1-lid-frame",
    componentId: "pk1-flat-lid"
  }]
});

const pricedItems = (): readonly ProductKitPricedItem[] => [{
  kind: "base",
  itemId: "base:pk1-tumbler-kit",
  priceAssetId: "pk1-price-tumbler"
}, {
  kind: "component",
  itemId: "placement:lid-one",
  placementId: "lid-one",
  componentId: "pk1-flat-lid",
  priceAssetId: "pk1-price-flat-lid"
}];

function raster(assetId: string) {
  return {
    assetId,
    masterSha256: ASSET_HASH,
    frame: {
      originalWidth: 400, originalHeight: 500,
      trimX: 0, trimY: 0, trimWidth: 400, trimHeight: 500
    }
  };
}

function plan(): ProductKitLayerPlan {
  return {
    kitId: "pk1-tumbler-kit",
    layers: [{ layer: "rear", entries: [] }, {
      layer: "body",
      entries: [{
        kind: "base-raster",
        itemId: "base:pk1-tumbler-kit",
        raster: raster("asset-tumbler")
      }]
    }, {
      layer: "front",
      entries: [{
        kind: "component-raster",
        itemId: "fragment:lid-one:front",
        placementId: "lid-one",
        mountFrameId: "pk1-lid-frame",
        componentId: "pk1-flat-lid",
        raster: raster("asset-lid"),
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
    pricedItems: pricedItems()
  };
}

function pricing(): ProductKitPricingIndex {
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

function context(): ProductKitDocumentContext {
  const expectedRequest = request();
  return {
    catalogue: {
      packId: "pk1-pilot-drinkware",
      catalogPackId: "offline-core-v1",
      catalogSha256: CATALOG_HASH,
      kits: [{ id: "pk1-tumbler-kit" }]
    } as never,
    runtime: {
      resolvePair: () => null,
      planComposition: (candidate) =>
        JSON.stringify(candidate) === JSON.stringify(expectedRequest) ? plan() : null
    },
    pricing: pricing()
  };
}

function reference(): ProductKitCompositionReference {
  return {
    kind: "product-kit-composition",
    version: 1,
    objectId: "product-kit-root",
    productKitPackId: "pk1-pilot-drinkware",
    catalogPackId: "offline-core-v1",
    catalogSha256: CATALOG_HASH,
    request: request(),
    pricedItems: pricedItems()
  };
}

describe("parseProductKitCompositionReference", () => {
  it("round-trips an exact admitted reference as detached frozen data", () => {
    const source = reference();
    const parsed = parseProductKitCompositionReference(source, context());

    expect(parsed).toEqual(source);
    expect(parsed).not.toBe(source);
    expect(parsed?.request).not.toBe(source.request);
    expect(parsed?.pricedItems).not.toBe(source.pricedItems);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed?.request)).toBe(true);
    expect(Object.isFrozen(parsed?.request.placements)).toBe(true);
    expect(Object.isFrozen(parsed?.pricedItems[0])).toBe(true);

    (source.request.placements as unknown as Array<{ componentId: string }>)[0]!.componentId =
      "pk1-changed-lid";
    expect(parsed?.request.placements[0]?.componentId).toBe("pk1-flat-lid");
  });

  it("denies extra keys, stale identity, duplicate placements and priced-item drift", () => {
    expect(parseProductKitCompositionReference({
      ...reference(), unexpected: true
    }, context())).toBeNull();
    expect(parseProductKitCompositionReference({
      ...reference(), catalogSha256: "9".repeat(64)
    }, context())).toBeNull();
    expect(parseProductKitCompositionReference({
      ...reference(), productKitPackId: "pk1-other-pack"
    }, context())).toBeNull();
    expect(parseProductKitCompositionReference({
      ...reference(),
      request: {
        ...request(),
        placements: [{
          ...request().placements[0]!, componentId: "pk1-other-lid"
        }]
      }
    }, context())).toBeNull();
    expect(parseProductKitCompositionReference({
      ...reference(),
      request: {
        ...request(),
        placements: [request().placements[0]!, request().placements[0]!]
      }
    }, context())).toBeNull();
    expect(parseProductKitCompositionReference({
      ...reference(),
      pricedItems: [{
        ...pricedItems()[0]!, priceAssetId: "pk1-price-changed"
      }, pricedItems()[1]!]
    }, context())).toBeNull();
  });

  it.each([
    ["path", { filePath: "C:\\private\\product.png" }],
    ["URL", { sourceUrl: "blob:https://example.test/private" }],
    ["Fabric JSON", { fabricState: { objects: [] } }],
    ["SVG", { svg: "<svg><path /></svg>" }]
  ])("denies embedded %s fields", (_label, forbidden) => {
    expect(parseProductKitCompositionReference({
      ...reference(), ...forbidden
    }, context())).toBeNull();
  });

  it("denies sparse arrays, accessors and hostile proxies without throwing", () => {
    const placements = new Array(2);
    placements[0] = request().placements[0];
    expect(parseProductKitCompositionReference({
      ...reference(), request: { ...request(), placements }
    }, context())).toBeNull();

    const priced = new Array(2);
    priced[0] = pricedItems()[0];
    expect(parseProductKitCompositionReference({
      ...reference(), pricedItems: priced
    }, context())).toBeNull();

    let reads = 0;
    const accessor = reference() as unknown as Record<string, unknown>;
    Object.defineProperty(accessor, "request", {
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

    expect(() => parseProductKitCompositionReference(accessor, context())).not.toThrow();
    expect(parseProductKitCompositionReference(accessor, context())).toBeNull();
    expect(reads).toBe(0);
    expect(() => parseProductKitCompositionReference(hostile, context())).not.toThrow();
    expect(parseProductKitCompositionReference(hostile, context())).toBeNull();
  });
});
