import { readFileSync } from "node:fs";
import { FabricImage, FabricObject, FixedLayout, Group } from "fabric";
import { describe, expect, it, vi } from "vitest";
import PRODUCT_KIT_SIDECAR from "../../../catalog/generated/offline-core-v1/product-kit-v1.json";
import { computeCertificationFingerprint } from "./certification-fingerprint";
import type { ProductKitLayerPlan } from "./layer-plan";
import {
  parseProductKitCatalogue,
  type ProductKitCatalogue,
  type ProductKitCatalogueContext
} from "./product-kit-catalogue";
import type { ProductKitRasterSource } from "./product-kit-loader";
import { createProductKitRuntime } from "./product-kit-runtime";
import {
  FabricProductKitCompositor,
  type FabricProductKitImageLoader,
  type FabricProductKitInput
} from "./fabric-product-kit-compositor";

const REAR_ID = "pk1-rear-fragment";
const FRONT_ID = "90-beverage-container-add-ons-r04c01";
const OVERLAY_ID = "pk1-overlay-fragment";
const BASE_ID = "89-beverage-container-bases-r03c05";
const REAR_HASH = "b".repeat(64);
const OVERLAY_HASH = "c".repeat(64);
const PILOT_BASE_ALPHA_TOP = 20;
const PILOT_LID_ALPHA_BOTTOM = 144;

interface CompositorFixture {
  readonly catalogue: ProductKitCatalogue;
  readonly plan: ProductKitLayerPlan;
  readonly sources: ReadonlyMap<string, ProductKitRasterSource>;
  readonly dimensions: ReadonlyMap<string, readonly [number, number]>;
}

function fixture(): CompositorFixture {
  const value = structuredClone(PRODUCT_KIT_SIDECAR) as any;
  const component = value.components[0]!;
  component.fragments = [
    {
      layer: "rear",
      raster: {
        assetId: REAR_ID,
        masterSha256: REAR_HASH,
        frame: {
          originalWidth: 400,
          originalHeight: 500,
          trimX: 110,
          trimY: 95,
          trimWidth: 180,
          trimHeight: 120
        }
      }
    },
    component.fragments[0]!,
    {
      layer: "overlay",
      raster: {
        assetId: OVERLAY_ID,
        masterSha256: OVERLAY_HASH,
        frame: {
          originalWidth: 400,
          originalHeight: 500,
          trimX: 100,
          trimY: 70,
          trimWidth: 200,
          trimHeight: 190
        }
      }
    }
  ];
  const fingerprint = computeCertificationFingerprint(
    {
      packId: value.packId,
      connectorFormulaVersion: value.connectorFormulaVersion
    },
    value.kits[0]!,
    value.kits[0]!.mountFrames[0]!,
    component
  );
  if (!fingerprint) throw new Error("invalid compositor fixture fingerprint");
  value.certifications[0]!.fingerprint = fingerprint;

  const rasters = [
    value.kits[0]!.base,
    ...value.components.flatMap((item: any) =>
      item.fragments.map((fragment: any) => fragment.raster)
    )
  ];
  const records = [...new Map(rasters.map((raster) => [raster.assetId, raster])).values()]
    .map((raster) => ({
      id: raster.assetId,
      masterSha256: raster.masterSha256,
      delivery: "offline",
      kind: "raster-master",
      files: {
        master: `/catalog/generated/${value.catalogPackId}/assets/${raster.assetId}/master.png`
      },
      dimensions: {
        width: raster.frame.trimWidth,
        height: raster.frame.trimHeight
      },
      classroomReviewed: true,
      brandFree: true
    })) satisfies ProductKitCatalogueContext["records"];
  const catalogue = parseProductKitCatalogue(value, {
    catalogPackId: value.catalogPackId,
    catalogSha256: value.catalogSha256,
    records
  });
  if (!catalogue) throw new Error("invalid parsed compositor fixture");
  const plan = createProductKitRuntime(catalogue).planComposition({
    kitId: "pk1-tumbler-kit",
    placements: [{
      kind: "socket",
      placementId: "placement-lid",
      mountFrameId: "pk1-tumbler-lid-frame",
      componentId: "pk1-flat-lid"
    }]
  });
  if (!plan) throw new Error("invalid compositor fixture plan");
  return {
    catalogue,
    plan,
    sources: new Map(records.map((record) => [record.id, {
      assetId: record.id,
      masterSha256: record.masterSha256,
      masterUrl: record.files.master
    }])),
    dimensions: new Map(records.map((record) => [
      record.id,
      [record.dimensions.width, record.dimensions.height] as const
    ]))
  };
}

function image(width: number, height: number): FabricImage {
  const element = document.createElement("img");
  Object.defineProperties(element, {
    naturalWidth: { value: width },
    naturalHeight: { value: height }
  });
  element.width = width;
  element.height = height;
  const raster = new FabricImage(element);
  raster.set({
    objectId: "loader-owned-object",
    elementKind: "image",
    accessibleName: "Loader-owned raster"
  });
  return raster;
}

function loaderFor(
  current: CompositorFixture
): ReturnType<typeof vi.fn<FabricProductKitImageLoader>> {
  return vi.fn<FabricProductKitImageLoader>(async (url) => {
    const assetId = [...current.sources.keys()].find((candidate) =>
      url.endsWith(`/assets/${candidate}/master.png`)
    );
    const dimensions = assetId ? current.dimensions.get(assetId) : undefined;
    if (!dimensions) throw new Error("unknown PNG source");
    return image(dimensions[0], dimensions[1]);
  });
}

function inputFor(
  current: CompositorFixture,
  overrides: Partial<FabricProductKitInput> = {}
): FabricProductKitInput {
  return {
    id: "product-kit-object-1",
    accessibleName: "Reusable tumbler with flat lid",
    catalogue: current.catalogue,
    plan: current.plan,
    rasterSources: current.sources,
    ...overrides
  };
}

function withBaseMasterUrl(
  current: CompositorFixture,
  masterUrl: string
): ReadonlyMap<string, ProductKitRasterSource> {
  const sources = new Map(current.sources);
  sources.set(BASE_ID, { ...sources.get(BASE_ID)!, masterUrl });
  return sources;
}

function custom(group: Group): Group & Record<string, unknown> {
  return group as Group & Record<string, unknown>;
}

function visibleChildBounds(group: Group) {
  const children = group.getObjects().filter(({ productLayer }) =>
    productLayer !== "artwork-slot"
  );
  const rectangles = children.map((child) => child.getBoundingRect());
  const left = Math.min(...rectangles.map((bounds) => bounds.left));
  const top = Math.min(...rectangles.map((bounds) => bounds.top));
  const right = Math.max(...rectangles.map((bounds) => bounds.left + bounds.width));
  const bottom = Math.max(...rectangles.map((bounds) => bounds.top + bounds.height));
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2
  };
}

function expectExactPilotTransforms(group: Group): void {
  const base = group.getObjects().find(({ productLayer }) => productLayer === "body");
  const lid = group.getObjects().find(({ productLayer }) => productLayer === "front");
  expect(base).toBeDefined();
  expect(lid).toBeDefined();
  const expectedLinearMatrices = [
    [base!.calcOwnMatrix().slice(0, 4), [1, 0, 0, 1]],
    [lid!.calcOwnMatrix().slice(0, 4), [0.7, 0, 0, 0.7]]
  ] as const;
  for (const [actual, expected] of expectedLinearMatrices) {
    expect(actual).toHaveLength(expected.length);
    expected.forEach((value, index) => expect(actual[index]).toBeCloseTo(value, 12));
  }
  expect(base).toMatchObject({
    angle: 0,
    skewX: 0,
    skewY: 0,
    flipX: false,
    flipY: false
  });
  expect(lid).toMatchObject({
    angle: 0,
    skewX: 0,
    skewY: 0,
    flipX: false,
    flipY: false
  });
  for (const [object, expectedScale] of [
    [base!, { scaleX: 1, scaleY: 1 }],
    [lid!, { scaleX: 0.7, scaleY: 0.7 }]
  ] as const) {
    expect(object.scaleX).toBeCloseTo(expectedScale.scaleX, 12);
    expect(object.scaleY).toBeCloseTo(expectedScale.scaleY, 12);
  }
  expect(base!.left - lid!.left).toBeCloseTo(0, 12);
  expect(base!.top - lid!.top).toBeCloseTo(112.4, 12);
}

function expectPilotLidSeated(group: Group): void {
  const base = group.getObjects().find(({ productLayer }) => productLayer === "body");
  const lid = group.getObjects().find(({ productLayer }) => productLayer === "front");
  expect(base).toBeDefined();
  expect(lid).toBeDefined();

  const baseVisibleTop = base!.top +
    (PILOT_BASE_ALPHA_TOP - base!.height / 2) * base!.scaleY;
  const lidVisibleBottom = lid!.top +
    (PILOT_LID_ALPHA_BOTTOM - lid!.height / 2) * lid!.scaleY;
  const seatingDepth = lidVisibleBottom - baseVisibleTop;

  expect(seatingDepth).toBeGreaterThanOrEqual(25);
  expect(seatingDepth).toBeLessThanOrEqual(35);
}

describe("FabricProductKitCompositor", () => {
  it("preloads PNGs in fixed layer order and fits the semantic root to visible product geometry", async () => {
    const current = fixture();
    const loadImage = loaderFor(current);
    const group = await new FabricProductKitCompositor(loadImage).create(inputFor(current));

    expect(loadImage.mock.calls.map(([url]) => new URL(url).pathname)).toEqual([
      expect.stringContaining(`/assets/${REAR_ID}/master.png`),
      expect.stringContaining(`/assets/${BASE_ID}/master.png`),
      expect.stringContaining(`/assets/${FRONT_ID}/master.png`),
      expect.stringContaining(`/assets/${OVERLAY_ID}/master.png`)
    ]);
    expect(loadImage.mock.calls.every(([url]) => !url.toLowerCase().includes("svg")))
      .toBe(true);
    expect(group).toBeInstanceOf(Group);
    expect(group.layoutManager.strategy).toBeInstanceOf(FixedLayout);
    const bounds = visibleChildBounds(group);
    expect(group).toMatchObject({
      originX: "center",
      originY: "center",
      selectable: true,
      evented: true,
      cornerSize: 44,
      touchCornerSize: 44,
      transparentCorners: false,
      borderScaleFactor: 3,
      borderColor: "#075985",
      cornerColor: "#f4c95d",
      cornerStrokeColor: "#172033"
    });
    const expectedScale = Math.min(2, 720 / group.width, 630 / group.height);
    expect(group.scaleX).toBeCloseTo(expectedScale, 8);
    expect(group.scaleY).toBeCloseTo(expectedScale, 8);
    expect(group.getScaledWidth()).toBeCloseTo(bounds.width, 8);
    expect(group.getScaledHeight()).toBeCloseTo(bounds.height, 8);
    const fittedRatio = Math.max(
      group.getScaledWidth() / 720,
      group.getScaledHeight() / 630
    );
    expect(fittedRatio).toBeLessThanOrEqual(1);
    expect(fittedRatio).toBeCloseTo(Math.max(
      expectedScale * group.width / 720,
      expectedScale * group.height / 630
    ), 8);
    expect(group.left).toBeCloseTo(800, 8);
    expect(group.top).toBeCloseTo(450, 8);
    expect(bounds.centerX).toBeCloseTo(800, 8);
    expect(bounds.centerY).toBeCloseTo(450, 8);
    expect([group.width, group.height]).not.toEqual([400, 500]);
    expect(custom(group)).toMatchObject({
      objectId: "product-kit-object-1",
      elementKind: "product-kit",
      accessibleName: "Reusable tumbler with flat lid",
      productKitPackId: "pk1-pilot-drinkware",
      productKitId: "pk1-tumbler-kit",
      productKitCatalogSha256: current.catalogue.catalogSha256
    });
    expect(group.getObjects().map((child) => child.productLayer)).toEqual([
      "rear",
      "body",
      "front",
      "artwork-slot",
      "overlay"
    ]);
    expect(group.getObjects().every((child) =>
      child.selectable === false && child.evented === false &&
      child.objectId === undefined && child.elementKind === undefined
    )).toBe(true);
    expectPilotLidSeated(group);
    const artwork = group.getObjects()[3];
    expect(artwork).toBeInstanceOf(Group);
    expect(artwork).toMatchObject({
      height: 125,
      artworkSlotId: "artwork:pk1-tumbler-kit:0"
    });
    expect(artwork!.width).toBeCloseTo(112, 12);
    const base = group.getObjects().find(({ productLayer }) => productLayer === "body")!;
    expect(artwork!.left - base.left).toBeCloseTo(0, 12);
    expect(artwork!.top - base.top).toBeCloseTo(-6.5, 12);
    const slotGeometry = (artwork as Group).getObjects();
    expect(slotGeometry).toHaveLength(1);
    expect(slotGeometry[0]).toMatchObject({
      height: 125,
      fill: "rgba(0,0,0,0)",
      selectable: false,
      evented: false
    });
    expect(slotGeometry[0]!.width).toBeCloseTo(112, 12);
  });

  it("rejects source identity, hash, path, dimension, and load failures atomically", async () => {
    const current = fixture();
    const cases = [
      ["asset identity", { assetId: "pk1-wrong-source" }],
      ["hash", { masterSha256: "d".repeat(64) }],
      ["PNG path", { masterUrl: `/catalog/assets/${BASE_ID}/master.svg` }]
    ] as const;
    for (const [_label, patch] of cases) {
      const sources = new Map(current.sources);
      sources.set(BASE_ID, { ...sources.get(BASE_ID)!, ...patch });
      const loadImage = loaderFor(current);
      await expect(new FabricProductKitCompositor(loadImage).create(inputFor(current, {
        rasterSources: sources
      }))).rejects.toThrow();
      expect(loadImage).not.toHaveBeenCalled();
    }

    const wrongDimensions = loaderFor(current);
    wrongDimensions.mockImplementationOnce(async () => image(1, 1));
    await expect(new FabricProductKitCompositor(wrongDimensions).create(inputFor(current)))
      .rejects.toThrow(/dimension/i);

    const failingLoader = loaderFor(current);
    failingLoader.mockImplementationOnce(async () => {
      throw new Error("synthetic PNG failure");
    });
    await expect(new FabricProductKitCompositor(failingLoader).create(inputFor(current)))
      .rejects.toThrow("synthetic PNG failure");
  });

  it.each([
    ["foreign origin", (path: string) => `https://foreign.invalid${path}`],
    ["credentials", (path: string) => {
      const url = new URL(path, window.location.href);
      url.username = "student";
      url.password = "secret";
      return url.href;
    }],
    ["query", (path: string) => `${path}?version=1`],
    ["hash", (path: string) => `${path}#asset`],
    ["path-relative form", (path: string) => path.slice(1)],
    ["repeated slash", (path: string) => path.replace("/generated/", "//generated/")],
    ["literal dot segment", (path: string) => path.replace("/generated/", "/./generated/")],
    ["percent encoding", (path: string) => path.replace("offline-core-v1", "offline%2Dcore-v1")],
    ["backslash", (path: string) => path.replaceAll("/", "\\")],
    ["control character", (path: string) => `\u0001${path}`],
    ["misleading PNG suffix", (path: string) =>
      path.replace("/offline-core-v1/assets/", "/offline-core-v1/decoy/assets/")]
  ])("rejects a %s master URL before loading", async (_label, changeUrl) => {
    const current = fixture();
    const canonicalPath = current.sources.get(BASE_ID)!.masterUrl;
    const loadImage = loaderFor(current);

    await expect(new FabricProductKitCompositor(loadImage).create(inputFor(current, {
      rasterSources: withBaseMasterUrl(current, changeUrl(canonicalPath))
    }))).rejects.toThrow(/source|catalogue/i);
    expect(loadImage).not.toHaveBeenCalled();
  });

  it.each([
    ["root-relative", (path: string) => path],
    ["same-origin absolute", (path: string) => new URL(path, window.location.href).href]
  ])("accepts the exact %s canonical master URLs", async (_label, makeUrl) => {
    const current = fixture();
    const sources = new Map([...current.sources].map(([assetId, source]) => [assetId, {
      ...source,
      masterUrl: makeUrl(source.masterUrl)
    }]));
    const loadImage = loaderFor(current);

    const group = await new FabricProductKitCompositor(loadImage).create(inputFor(current, {
      rasterSources: sources
    }));

    expect(group).toBeInstanceOf(Group);
    expect(loadImage).toHaveBeenCalledTimes(4);
  });

  it("requires parser provenance and an exact detached runtime plan before loading", async () => {
    const current = fixture();
    const loadImage = loaderFor(current);
    await expect(new FabricProductKitCompositor(loadImage).create(inputFor(current, {
      catalogue: structuredClone(current.catalogue)
    }))).rejects.toThrow(/catalogue/i);
    expect(loadImage).not.toHaveBeenCalled();

    const plan = structuredClone(current.plan) as any;
    const front = plan.layers[2]!.entries[0]!;
    if (front.kind !== "component-raster" || front.geometry.kind !== "affine") {
      throw new Error("invalid test fixture front entry");
    }
    front.geometry.transform.matrix.a = Number.NaN;
    await expect(new FabricProductKitCompositor(loadImage).create(inputFor(current, { plan })))
      .rejects.toThrow(/plan|matrix/i);
    expect(loadImage).not.toHaveBeenCalled();
  });

  it("keeps the provenance-checked catalogue authoritative across deferred PNG loading", async () => {
    const current = fixture();
    const immediateLoader = loaderFor(current);
    let loadingStarted!: () => void;
    let releaseLoads!: () => void;
    const started = new Promise<void>((resolve) => { loadingStarted = resolve; });
    const release = new Promise<void>((resolve) => { releaseLoads = resolve; });
    const deferredLoader: FabricProductKitImageLoader = async (...args) => {
      loadingStarted();
      await release;
      return immediateLoader(...args);
    };
    const input = inputFor(current);
    const creating = new FabricProductKitCompositor(deferredLoader).create(input);
    await started;

    Reflect.set(input, "catalogue", {
      ...structuredClone(current.catalogue),
      packId: "pk1-raced-pack",
      catalogSha256: "e".repeat(64)
    });
    releaseLoads();
    const group = await creating;

    expect(custom(group)).toMatchObject({
      productKitPackId: current.catalogue.packId,
      productKitCatalogSha256: current.catalogue.catalogSha256
    });
  });

  it("serializes and reloads Product Kit identity and exact child order", async () => {
    const current = fixture();
    const original = await new FabricProductKitCompositor(loaderFor(current))
      .create(inputFor(current));
    const serialized = original.toObject();

    expect(serialized).toMatchObject({
      objectId: "product-kit-object-1",
      elementKind: "product-kit",
      accessibleName: "Reusable tumbler with flat lid",
      productKitPackId: "pk1-pilot-drinkware",
      productKitId: "pk1-tumbler-kit",
      productKitCatalogSha256: current.catalogue.catalogSha256
    });
    const restored = await Group.fromObject(serialized);
    expect(custom(restored)).toMatchObject({
      objectId: "product-kit-object-1",
      elementKind: "product-kit",
      productKitPackId: "pk1-pilot-drinkware",
      productKitId: "pk1-tumbler-kit",
      productKitCatalogSha256: current.catalogue.catalogSha256
    });
    expect(restored.getObjects().map((child) => child.productLayer)).toEqual([
      "rear",
      "body",
      "front",
      "artwork-slot",
      "overlay"
    ]);
  }, 15_000);

  it("preserves Product Kit identity through two complete serialize and reload cycles", async () => {
    const current = fixture();
    let group = await new FabricProductKitCompositor(loaderFor(current))
      .create(inputFor(current));
    const originalGeometry = {
      left: group.left,
      top: group.top,
      width: group.width,
      height: group.height,
      scaleX: group.scaleX,
      scaleY: group.scaleY
    };

    for (let cycle = 0; cycle < 2; cycle += 1) {
      const serialized = group.toObject();
      expect(serialized).toMatchObject({
        productKitPackId: current.catalogue.packId,
        productKitId: current.plan.kitId,
        productKitCatalogSha256: current.catalogue.catalogSha256
      });
      group = await Group.fromObject(serialized);
      expect(group.left).toBeCloseTo(originalGeometry.left, 8);
      expect(group.top).toBeCloseTo(originalGeometry.top, 8);
      expect(group.width).toBeCloseTo(originalGeometry.width, 8);
      expect(group.height).toBeCloseTo(originalGeometry.height, 8);
      expect(group.scaleX).toBeCloseTo(originalGeometry.scaleX, 4);
      expect(group.scaleY).toBeCloseTo(originalGeometry.scaleY, 4);
      const bounds = visibleChildBounds(group);
      expect(group.getScaledWidth()).toBeCloseTo(bounds.width, 8);
      expect(group.getScaledHeight()).toBeCloseTo(bounds.height, 8);
      expect(group.left).toBeCloseTo(bounds.centerX, 8);
      expect(group.top).toBeCloseTo(bounds.centerY, 8);
      expectExactPilotTransforms(group);
    }

    expect(custom(group)).toMatchObject({
      productKitPackId: current.catalogue.packId,
      productKitId: current.plan.kitId,
      productKitCatalogSha256: current.catalogue.catalogSha256
    });
    expect(FabricObject.customProperties).toContain("objectId");
    for (const property of [
      "productKitPackId",
      "productKitId",
      "productKitCatalogSha256"
    ]) {
      expect(FabricObject.customProperties.filter((candidate) => candidate === property))
        .toHaveLength(1);
    }
    expect(new Set(FabricObject.customProperties).size)
      .toBe(FabricObject.customProperties.length);
  }, 15_000);

  it("preserves the exact base and certified lid transforms after grouping and reload", async () => {
    const current = fixture();
    const group = await new FabricProductKitCompositor(loaderFor(current))
      .create(inputFor(current));

    expectExactPilotTransforms(group);
    const restored = await Group.fromObject(group.toObject());
    expectExactPilotTransforms(restored);
  }, 15_000);

  it("contains no SVG import or SVG loading path", () => {
    const source = readFileSync(
      "web/src/product-kit/fabric-product-kit-compositor.ts",
      "utf8"
    );
    expect(source).not.toMatch(/loadSVG|\.svg/i);
  });
});
