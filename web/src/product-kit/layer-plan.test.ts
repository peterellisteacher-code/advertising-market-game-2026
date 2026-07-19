import { describe, expect, it } from "vitest";
import type {
  ProductKitAssetReference,
  ProductKitComponent,
  ProductKitKit
} from "./product-kit-catalogue";
import {
  PRODUCT_KIT_LAYER_ORDER,
  createProductKitLayerPlan,
  type ProductKitResolvedPlacement
} from "./layer-plan";

const hash = (character: string) => character.repeat(64);
const raster = (assetId: string, character: string): ProductKitAssetReference => ({
  assetId,
  masterSha256: hash(character),
  frame: {
    originalWidth: 100,
    originalHeight: 100,
    trimX: 0,
    trimY: 0,
    trimWidth: 100,
    trimHeight: 100
  }
});
const profile = {
  familyId: "pk1-drinkware",
  perspectiveId: "pk1-front-view",
  geometryId: "pk1-cup-medium",
  styleId: "pk1-clean-outline"
} as const;

const kit = (): ProductKitKit => ({
  id: "pk1-cup-kit",
  title: "Cup",
  mode: "grip",
  compatibilityProfile: profile,
  base: raster("cup-base", "a"),
  priceAssetId: "pk1-price-cup",
  mountFrames: [],
  artworkBounds: [
    { x: 0.2, y: 0.2, width: 0.5, height: 0.4 },
    { x: 0.3, y: 0.65, width: 0.3, height: 0.15 }
  ]
});

const handle = (): ProductKitComponent => ({
  id: "pk1-loop-handle",
  title: "Loop handle",
  slotId: "pk1-handle-slot",
  compatibilityProfile: profile,
  componentFrame: {
    mountType: "grip",
    contacts: [{ x: 0, y: 0.2 }, { x: 0, y: 0.8 }],
    normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
  },
  fragments: [
    { layer: "rear", raster: raster("handle-rear", "b") },
    { layer: "front", raster: raster("handle-front", "c") }
  ],
  priceAssetId: "pk1-price-loop-handle"
});

const gridComponent = (): ProductKitComponent => ({
  id: "pk1-patio-tile",
  title: "Patio tile",
  slotId: "pk1-patio-slot",
  compatibilityProfile: profile,
  componentFrame: {
    mountType: "grid",
    plane: "floor",
    footprint: { columns: 1, rows: 1 },
    edgeTypes: {}
  },
  fragments: [{ layer: "overlay", raster: raster("patio-tile", "d") }],
  priceAssetId: "pk1-price-patio-tile"
});

const transform = {
  matrix: { a: 1, b: 0, c: 0, d: 1, e: 0.2, f: 0.1 },
  scale: 1,
  rotationDegrees: 0,
  mirrored: false,
  maxNormalErrorDegrees: 0
} as const;

const affinePlacement = (): Extract<ProductKitResolvedPlacement, { kind: "affine" }> => ({
  kind: "affine",
  placementId: "placement-handle",
  mountFrameId: "pk1-handle-frame",
  component: handle(),
  transform
});

describe("product-kit layer planning", () => {
  it("always emits the exact five buckets with one body and artwork slots", () => {
    const result = createProductKitLayerPlan(kit(), []);

    expect(result?.layers.map(({ layer }) => layer)).toEqual(PRODUCT_KIT_LAYER_ORDER);
    expect(result?.layers.map(({ entries }) => entries.length)).toEqual([0, 1, 0, 2, 0]);
    expect(result?.layers[1]?.entries[0]).toMatchObject({
      kind: "base-raster",
      itemId: "base:pk1-cup-kit",
      raster: { assetId: "cup-base" }
    });
    expect(result?.layers[3]?.entries.map(({ kind }) => kind)).toEqual([
      "artwork-slot",
      "artwork-slot"
    ]);
    expect(result?.pricedItems).toEqual([{
      kind: "base",
      itemId: "base:pk1-cup-kit",
      priceAssetId: "pk1-price-cup"
    }]);
  });

  it("renders a split handle twice but prices its logical placement once", () => {
    const result = createProductKitLayerPlan(kit(), [affinePlacement()]);

    expect(result?.layers[0]?.entries).toHaveLength(1);
    expect(result?.layers[2]?.entries).toHaveLength(1);
    expect(result?.layers[0]?.entries[0]).toMatchObject({
      kind: "component-raster",
      placementId: "placement-handle",
      componentId: "pk1-loop-handle",
      raster: { assetId: "handle-rear" },
      geometry: { kind: "affine", transform }
    });
    expect(result?.pricedItems).toEqual([
      {
        kind: "base",
        itemId: "base:pk1-cup-kit",
        priceAssetId: "pk1-price-cup"
      },
      {
        kind: "component",
        itemId: "placement:placement-handle",
        placementId: "placement-handle",
        componentId: "pk1-loop-handle",
        priceAssetId: "pk1-price-loop-handle"
      }
    ]);
  });

  it("orders repeated grid instances by row, column and ID and prices each one", () => {
    const component = gridComponent();
    const placements: ProductKitResolvedPlacement[] = [
      {
        kind: "grid",
        placementId: "placement-z",
        mountFrameId: "pk1-patio-grid",
        component,
        column: 2,
        row: 1,
        normalizedBounds: { x: 0.5, y: 0.25, width: 0.25, height: 0.25 }
      },
      {
        kind: "grid",
        placementId: "placement-a",
        mountFrameId: "pk1-patio-grid",
        component,
        column: 0,
        row: 0,
        normalizedBounds: { x: 0, y: 0, width: 0.25, height: 0.25 }
      }
    ];

    const result = createProductKitLayerPlan({ ...kit(), mode: "grid" }, placements);

    expect(result?.layers[4]?.entries.map((entry) =>
      entry.kind === "component-raster" ? entry.placementId : null
    )).toEqual(["placement-a", "placement-z"]);
    expect(result?.pricedItems.slice(1).map(({ itemId }) => itemId)).toEqual([
      "placement:placement-a",
      "placement:placement-z"
    ]);
    expect(placements[0]?.placementId).toBe("placement-z");
  });

  it("rejects duplicate placement IDs and malformed resolved geometry", () => {
    const first = affinePlacement();
    expect(createProductKitLayerPlan(kit(), [first, { ...first }])).toBeNull();
    expect(createProductKitLayerPlan(kit(), [{
      ...first,
      placementId: "placement-bad",
      transform: { ...transform, scale: Number.NaN }
    }])).toBeNull();
    expect(createProductKitLayerPlan({ ...kit(), mode: "grid" }, [{
      kind: "grid",
      placementId: "placement-bad-grid",
      mountFrameId: "pk1-patio-grid",
      component: gridComponent(),
      column: -1,
      row: 0,
      normalizedBounds: { x: 0, y: 0, width: 0.25, height: 0.25 }
    }])).toBeNull();
  });

  it("fails closed for null or unknown placement discriminants", () => {
    expect(createProductKitLayerPlan(null as never, [])).toBeNull();
    expect(createProductKitLayerPlan(kit(), [null] as never)).toBeNull();
    expect(createProductKitLayerPlan({ ...kit(), mode: "grid" }, [{
      kind: "bogus",
      placementId: "placement-bogus",
      mountFrameId: "pk1-patio-grid",
      component: gridComponent(),
      column: 0,
      row: 0,
      normalizedBounds: { x: 0, y: 0, width: 0.25, height: 0.25 }
    }] as never)).toBeNull();
  });

  it("returns null without throwing for sparse placement and nested arrays", () => {
    const sparsePlacements = new Array<ProductKitResolvedPlacement>(1);
    const sparseArtwork = new Array<ProductKitKit["artworkBounds"][number]>(1);
    const placement = affinePlacement();
    const sparseFragments = new Array<ProductKitComponent["fragments"][number]>(1);
    const resolvePlacements = () => createProductKitLayerPlan(kit(), sparsePlacements);
    const resolveArtwork = () => createProductKitLayerPlan({
      ...kit(),
      artworkBounds: sparseArtwork
    }, []);
    const resolveFragments = () => createProductKitLayerPlan(kit(), [{
      ...placement,
      component: { ...placement.component, fragments: sparseFragments }
    }]);

    expect(resolvePlacements).not.toThrow();
    expect(resolvePlacements()).toBeNull();
    expect(resolveArtwork).not.toThrow();
    expect(resolveArtwork()).toBeNull();
    expect(resolveFragments).not.toThrow();
    expect(resolveFragments()).toBeNull();
  });

  it("rejects signed zero in layer-plan geometry", () => {
    expect(createProductKitLayerPlan(kit(), [{
      ...affinePlacement(),
      transform: {
        ...transform,
        matrix: { ...transform.matrix, e: -0 }
      }
    }])).toBeNull();
    expect(createProductKitLayerPlan({ ...kit(), mode: "grid" }, [{
      kind: "grid",
      placementId: "placement-signed-zero",
      mountFrameId: "pk1-patio-grid",
      component: gridComponent(),
      column: -0,
      row: 0,
      normalizedBounds: { x: 0, y: 0, width: 0.25, height: 0.25 }
    }])).toBeNull();
  });

  it("rejects malformed raster, artwork and fragment records without normalising", () => {
    expect(createProductKitLayerPlan({
      ...kit(),
      base: {} as ProductKitAssetReference
    }, [])).toBeNull();
    expect(createProductKitLayerPlan({
      ...kit(),
      artworkBounds: [null] as never
    }, [])).toBeNull();

    const placement = affinePlacement();
    const malformedComponent = {
      ...placement.component,
      fragments: [{ layer: "front", raster: {} }]
    } as unknown as ProductKitComponent;
    expect(createProductKitLayerPlan(kit(), [{
      ...placement,
      component: malformedComponent
    }])).toBeNull();
  });

  it("keeps the authoritative layer order frozen at runtime", () => {
    expect(Object.isFrozen(PRODUCT_KIT_LAYER_ORDER)).toBe(true);
    expect(() => (
      PRODUCT_KIT_LAYER_ORDER as unknown as string[]
    ).reverse()).toThrow(TypeError);
    expect(createProductKitLayerPlan(kit(), [])?.layers.map(({ layer }) => layer))
      .toEqual(["rear", "body", "front", "artwork", "overlay"]);
  });

  it("returns null rather than invoking hostile planning inputs", () => {
    const proxy = new Proxy({}, {
      get() {
        throw new Error("hostile get trap");
      }
    });
    const placements = [affinePlacement()];
    Object.defineProperty(placements, "sort", {
      value: () => { throw new Error("caller-owned sort"); },
      enumerable: false
    });
    let accessorReads = 0;
    const accessorKit = kit() as unknown as Record<string, unknown>;
    Object.defineProperty(accessorKit, "base", {
      enumerable: true,
      get() {
        accessorReads += 1;
        throw new Error("hostile getter");
      }
    });
    const calls = [
      () => createProductKitLayerPlan(proxy as never, []),
      () => createProductKitLayerPlan(kit(), proxy as never),
      () => createProductKitLayerPlan(Object.create(kit()), []),
      () => createProductKitLayerPlan(accessorKit as never, []),
      () => createProductKitLayerPlan(kit(), placements)
    ];

    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
    expect(accessorReads).toBe(0);
  });

  it("returns a detached deeply frozen plan without freezing caller values", () => {
    const mutableKit = kit() as ProductKitKit;
    const placement = affinePlacement();
    const result = createProductKitLayerPlan(mutableKit, [placement]);

    expect(Object.isFrozen(mutableKit)).toBe(false);
    expect(Object.isFrozen(placement)).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result?.layers)).toBe(true);
    expect(Object.isFrozen(result?.layers[0]?.entries[0])).toBe(true);
    expect(Object.isFrozen(result?.pricedItems)).toBe(true);
  });
});
