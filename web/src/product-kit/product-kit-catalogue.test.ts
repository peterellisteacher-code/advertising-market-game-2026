import { describe, expect, expectTypeOf, it } from "vitest";
import {
  parseProductKitCatalogue,
  type ProductKitCatalogueContext,
  type ProductKitPoint
} from "./product-kit-catalogue";

const CATALOGUE_SHA = "f".repeat(64);
const HASHES = {
  gridBase: "a".repeat(64),
  gridPart: "b".repeat(64),
  gripBase: "c".repeat(64),
  gripFront: "d".repeat(64),
  gripRear: "e".repeat(64),
  socketBase: "1".repeat(64),
  socketPart: "2".repeat(64),
  wholeBase: "3".repeat(64)
} as const;

const FRAME = {
  originalWidth: 100,
  originalHeight: 100,
  trimX: 0,
  trimY: 0,
  trimWidth: 100,
  trimHeight: 100
} as const;

const CONSTRAINTS = {
  minScale: 0.5,
  maxScale: 2,
  minRotationDegrees: -45,
  maxRotationDegrees: 45,
  maxNormalErrorDegrees: 5,
  mirrorAllowed: false
} as const;

const asset = (id: string, masterSha256: string, kind = "raster-master") => ({
  id,
  masterSha256,
  delivery: "offline" as const,
  kind,
  files: {
    master: `/catalog/generated/offline-core-v1/assets/${id}/master.png`
  },
  dimensions: { width: 100, height: 100 },
  classroomReviewed: true,
  brandFree: true
});

const contextFixture = (): ProductKitCatalogueContext => ({
  catalogPackId: "offline-core-v1",
  catalogSha256: CATALOGUE_SHA,
  records: [
    asset("asset-grid-base", HASHES.gridBase),
    asset("asset-grid-part", HASHES.gridPart, "component"),
    asset("asset-grip-base", HASHES.gripBase),
    asset("asset-grip-front", HASHES.gripFront, "component"),
    asset("asset-grip-rear", HASHES.gripRear, "component"),
    asset("asset-socket-base", HASHES.socketBase),
    asset("asset-socket-part", HASHES.socketPart, "component"),
    asset("asset-whole-base", HASHES.wholeBase)
  ]
});

const raster = (assetId: string, masterSha256: string) => ({
  assetId,
  masterSha256,
  frame: { ...FRAME }
});

const profile = (familyId: string, geometryId: string) => ({
  familyId,
  perspectiveId: "pk1-front-view",
  geometryId,
  styleId: "pk1-outline-clean"
});

const fixture = () => ({
  schema: "product-kit@1",
  version: 1,
  packId: "pk1-pilot",
  catalogPackId: "offline-core-v1",
  catalogSha256: CATALOGUE_SHA,
  pricingVersion: "product-pricing@1",
  connectorFormulaVersion: "product-kit-connectors@1",
  kits: [
    {
      id: "pk1-grid-kit",
      title: "Escape Room Wall",
      mode: "grid",
      compatibilityProfile: profile("pk1-escape-room", "pk1-wall-grid"),
      base: raster("asset-grid-base", HASHES.gridBase),
      priceAssetId: "pk1-price-grid-base",
      mountFrames: [{
        id: "pk1-grid-frame",
        slotId: "pk1-grid-slot",
        mountType: "grid",
        origin: { x: 0.1, y: 0.1 },
        cellSize: { width: 0.1, height: 0.1 },
        columns: 8,
        rows: 6,
        plane: "wall",
        acceptedEdgeTypes: ["pk1-door", "pk1-panel"]
      }],
      artworkBounds: []
    },
    {
      id: "pk1-grip-kit",
      title: "Reusable Cup",
      mode: "grip",
      compatibilityProfile: profile("pk1-drinkware", "pk1-cup-handle"),
      base: raster("asset-grip-base", HASHES.gripBase),
      priceAssetId: "pk1-price-grip-base",
      mountFrames: [{
        id: "pk1-grip-frame",
        slotId: "pk1-handle-slot",
        mountType: "grip",
        contacts: [{ x: 0.82, y: 0.35 }, { x: 0.82, y: 0.7 }],
        normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }],
        constraints: { ...CONSTRAINTS, mirrorAllowed: true }
      }],
      artworkBounds: [{ x: 0.25, y: 0.25, width: 0.45, height: 0.5 }]
    },
    {
      id: "pk1-socket-kit",
      title: "Travel Bottle",
      mode: "socket",
      compatibilityProfile: profile("pk1-drinkware", "pk1-bottle-lid"),
      base: raster("asset-socket-base", HASHES.socketBase),
      priceAssetId: "pk1-price-socket-base",
      mountFrames: [{
        id: "pk1-socket-frame",
        slotId: "pk1-lid-slot",
        mountType: "socket",
        point: { x: 0.5, y: 0.08 },
        normal: { x: 0, y: -1 },
        referenceScale: 0.22,
        constraints: { ...CONSTRAINTS }
      }],
      artworkBounds: [{ x: 0.2, y: 0.3, width: 0.6, height: 0.45 }]
    },
    {
      id: "pk1-whole-kit",
      title: "Complete Mug",
      mode: "whole",
      compatibilityProfile: profile("pk1-drinkware", "pk1-complete-mug"),
      base: raster("asset-whole-base", HASHES.wholeBase),
      priceAssetId: "pk1-price-whole-base",
      mountFrames: [],
      artworkBounds: [{ x: 0.25, y: 0.25, width: 0.45, height: 0.5 }]
    }
  ],
  components: [
    {
      id: "pk1-grid-component",
      title: "Secret Door",
      slotId: "pk1-grid-slot",
      compatibilityProfile: profile("pk1-escape-room", "pk1-wall-grid"),
      componentFrame: {
        mountType: "grid",
        plane: "wall",
        footprint: { columns: 2, rows: 3 },
        edgeTypes: { north: "pk1-panel", south: "pk1-door" }
      },
      fragments: [{
        layer: "front",
        raster: raster("asset-grid-part", HASHES.gridPart)
      }],
      priceAssetId: "pk1-price-secret-door"
    },
    {
      id: "pk1-grip-component",
      title: "Loop Handle",
      slotId: "pk1-handle-slot",
      compatibilityProfile: profile("pk1-drinkware", "pk1-cup-handle"),
      componentFrame: {
        mountType: "grip",
        contacts: [{ x: 0.18, y: 0.25 }, { x: 0.18, y: 0.75 }],
        normals: [{ x: -1, y: 0 }, { x: -1, y: 0 }]
      },
      fragments: [
        { layer: "rear", raster: raster("asset-grip-rear", HASHES.gripRear) },
        { layer: "front", raster: raster("asset-grip-front", HASHES.gripFront) }
      ],
      priceAssetId: "pk1-price-loop-handle"
    },
    {
      id: "pk1-socket-component",
      title: "Flip Lid",
      slotId: "pk1-lid-slot",
      compatibilityProfile: profile("pk1-drinkware", "pk1-bottle-lid"),
      componentFrame: {
        mountType: "socket",
        point: { x: 0.5, y: 0.9 },
        normal: { x: 0, y: -1 },
        referenceScale: 0.2
      },
      fragments: [{
        layer: "front",
        raster: raster("asset-socket-part", HASHES.socketPart)
      }],
      priceAssetId: "pk1-price-flip-lid"
    }
  ],
  certifications: [
    {
      id: "pk1-cert-grid",
      kitId: "pk1-grid-kit",
      mountFrameId: "pk1-grid-frame",
      componentId: "pk1-grid-component",
      fingerprint: "4".repeat(64)
    },
    {
      id: "pk1-cert-grip",
      kitId: "pk1-grip-kit",
      mountFrameId: "pk1-grip-frame",
      componentId: "pk1-grip-component",
      fingerprint: "5".repeat(64)
    },
    {
      id: "pk1-cert-socket",
      kitId: "pk1-socket-kit",
      mountFrameId: "pk1-socket-frame",
      componentId: "pk1-socket-component",
      fingerprint: "6".repeat(64)
    }
  ]
});

function isDeeplyFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((item) => isDeeplyFrozen(item, seen));
}

type MutableRecord = Record<string, unknown>;
const rows = (value: MutableRecord, key: string): MutableRecord[] =>
  value[key] as MutableRecord[];

describe("product-kit catalogue parser", () => {
  it("accepts all four modes, preserves one logical split component, and freezes only its clone", () => {
    const value = fixture();
    const context = contextFixture();
    const before = JSON.stringify({ value, context });

    const parsed = parseProductKitCatalogue(value, context);

    expect(parsed).not.toBeNull();
    expect(parsed?.kits.map(({ mode }) => mode)).toEqual(["grid", "grip", "socket", "whole"]);
    expect(parsed?.components[1]).toMatchObject({
      id: "pk1-grip-component",
      priceAssetId: "pk1-price-loop-handle"
    });
    expect(parsed?.components[1]?.fragments.map(({ layer }) => layer)).toEqual(["rear", "front"]);
    expect(isDeeplyFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(value)).toBe(false);
    expect(Object.isFrozen(value.kits[0])).toBe(false);
    expect(Object.isFrozen(context)).toBe(false);
    expect(Object.isFrozen(context.records[0])).toBe(false);
    expect(JSON.stringify({ value, context })).toBe(before);

    const gripFrame = parsed?.components[1]?.componentFrame;
    expect(gripFrame?.mountType).toBe("grip");
    if (gripFrame?.mountType === "grip") {
      expectTypeOf(gripFrame.contacts).toEqualTypeOf<
        readonly [ProductKitPoint, ProductKitPoint]
      >();
      expectTypeOf(gripFrame.normals).toEqualTypeOf<
        readonly [ProductKitPoint, ProductKitPoint]
      >();
    }
  });

  it.each([
    ["top-level extras", (value: MutableRecord) => { value.extra = true; }],
    ["unsorted kit IDs", (value: MutableRecord) => { rows(value, "kits").reverse(); }],
    ["whole kit frames", (value: MutableRecord) => {
      rows(value, "kits")[3]!.mountFrames = structuredClone(rows(value, "kits")[2]!.mountFrames);
    }],
    ["structural mode/frame mismatch", (value: MutableRecord) => {
      rows(value, "kits")[1]!.mode = "socket";
    }],
    ["duplicate mount-frame IDs", (value: MutableRecord) => {
      const frames = rows(value, "kits")[1]!.mountFrames as MutableRecord[];
      frames.push(structuredClone(frames[0]!));
    }],
    ["mount-frame ID reused by another kit", (value: MutableRecord) => {
      const reusedId = (rows(value, "kits")[1]!.mountFrames as MutableRecord[])[0]!.id;
      ((rows(value, "kits")[2]!.mountFrames as MutableRecord[])[0]!).id = reusedId;
      rows(value, "certifications")[2]!.mountFrameId = reusedId;
    }],
    ["unknown certified kit", (value: MutableRecord) => {
      rows(value, "certifications")[0]!.kitId = "pk1-missing-kit";
    }],
    ["unknown certified frame", (value: MutableRecord) => {
      rows(value, "certifications")[0]!.mountFrameId = "pk1-missing-frame";
    }],
    ["unknown certified component", (value: MutableRecord) => {
      rows(value, "certifications")[0]!.componentId = "pk1-missing-component";
    }],
    ["duplicate certified pair", (value: MutableRecord) => {
      const duplicate = structuredClone(rows(value, "certifications")[0]!);
      duplicate.id = "pk1-cert-grid-copy";
      rows(value, "certifications").splice(1, 0, duplicate);
    }],
    ["mismatched slot", (value: MutableRecord) => {
      rows(value, "components")[0]!.slotId = "pk1-other-slot";
    }],
    ["mismatched compatibility profile", (value: MutableRecord) => {
      (rows(value, "components")[1]!.compatibilityProfile as MutableRecord).styleId = "pk1-other-style";
    }],
    ["mismatched component frame type", (value: MutableRecord) => {
      rows(value, "components")[2]!.componentFrame = structuredClone(
        rows(value, "components")[1]!.componentFrame
      );
    }],
    ["socket geometry outside certified scale limits", (value: MutableRecord) => {
      const frame = rows(value, "components")[2]!.componentFrame as MutableRecord;
      frame.referenceScale = 0.01;
    }],
    ["grip geometry outside certified scale limits", (value: MutableRecord) => {
      const frame = rows(value, "components")[1]!.componentFrame as MutableRecord;
      frame.contacts = [{ x: 0.18, y: 0.25 }, { x: 0.18, y: 0.3 }];
    }],
    ["grid edge type outside the certified surface", (value: MutableRecord) => {
      const frame = rows(value, "components")[0]!.componentFrame as MutableRecord;
      frame.edgeTypes = { north: "pk1-unsupported-edge" };
    }],
    ["grid footprint larger than the certified surface", (value: MutableRecord) => {
      const frame = rows(value, "components")[0]!.componentFrame as MutableRecord;
      frame.footprint = { columns: 9, rows: 3 };
    }],
    ["out-of-order component layers", (value: MutableRecord) => {
      (rows(value, "components")[1]!.fragments as MutableRecord[]).reverse();
    }],
    ["duplicate component layers", (value: MutableRecord) => {
      const fragments = rows(value, "components")[1]!.fragments as MutableRecord[];
      fragments[1]!.layer = "rear";
    }],
    ["unsorted component IDs", (value: MutableRecord) => {
      rows(value, "components").reverse();
    }],
    ["duplicate component IDs", (value: MutableRecord) => {
      rows(value, "components")[1]!.id = rows(value, "components")[0]!.id;
    }],
    ["unsorted certification IDs", (value: MutableRecord) => {
      rows(value, "certifications").reverse();
    }],
    ["duplicate certification IDs", (value: MutableRecord) => {
      rows(value, "certifications")[1]!.id = rows(value, "certifications")[0]!.id;
    }],
    ["unsorted grid edge types", (value: MutableRecord) => {
      const frame = (rows(value, "kits")[0]!.mountFrames as MutableRecord[])[0]!;
      (frame.acceptedEdgeTypes as string[]).reverse();
    }],
    ["nested frame extras", (value: MutableRecord) => {
      ((rows(value, "kits")[1]!.mountFrames as MutableRecord[])[0]!).extra = true;
    }],
    ["zero normal", (value: MutableRecord) => {
      const frame = (rows(value, "kits")[2]!.mountFrames as MutableRecord[])[0]!;
      frame.normal = { x: 0, y: 0 };
    }],
    ["grid outside the design rectangle", (value: MutableRecord) => {
      const frame = (rows(value, "kits")[0]!.mountFrames as MutableRecord[])[0]!;
      frame.cellSize = { width: 0.2, height: 0.1 };
    }],
    ["trim rectangle outside original dimensions", (value: MutableRecord) => {
      const frame = ((rows(value, "kits")[0]!.base as MutableRecord).frame) as MutableRecord;
      frame.originalWidth = 99;
    }]
  ])("rejects %s", (_label, mutate) => {
    const value = fixture() as unknown as MutableRecord;
    mutate(value);
    expect(parseProductKitCatalogue(value, contextFixture())).toBeNull();
  });

  it.each(["familyId", "perspectiveId", "geometryId", "styleId"])(
    "rejects a certified %s mismatch",
    (profileKey) => {
      const value = fixture() as unknown as MutableRecord;
      const profileValue = rows(value, "components")[1]!.compatibilityProfile as MutableRecord;
      profileValue[profileKey] = `pk1-other-${profileKey.toLowerCase()}`;

      expect(parseProductKitCatalogue(value, contextFixture())).toBeNull();
    }
  );

  it.each([
    ["point coordinate", (value: MutableRecord) => {
      const frame = (rows(value, "kits")[0]!.mountFrames as MutableRecord[])[0]!;
      (frame.origin as MutableRecord).x = -0;
    }],
    ["normal coordinate", (value: MutableRecord) => {
      const frame = (rows(value, "kits")[2]!.mountFrames as MutableRecord[])[0]!;
      (frame.normal as MutableRecord).x = -0;
    }],
    ["constraint boundary", (value: MutableRecord) => {
      const frame = (rows(value, "kits")[2]!.mountFrames as MutableRecord[])[0]!;
      (frame.constraints as MutableRecord).maxNormalErrorDegrees = -0;
    }],
    ["integer trim offset", (value: MutableRecord) => {
      const frame = ((rows(value, "kits")[0]!.base as MutableRecord).frame) as MutableRecord;
      frame.trimX = -0;
    }]
  ])("rejects signed zero in a %s", (_label, mutate) => {
    const value = fixture() as unknown as MutableRecord;
    mutate(value);

    expect(parseProductKitCatalogue(value, contextFixture())).toBeNull();
  });

  it.each([
    ["product-kit ID", (value: MutableRecord) => {
      value.packId = "pk1-pilot\n";
    }],
    ["SHA-256", (value: MutableRecord) => {
      value.catalogSha256 = `${CATALOGUE_SHA}\n`;
    }]
  ])("rejects a terminal LF in a %s", (_label, mutate) => {
    const value = fixture() as unknown as MutableRecord;
    mutate(value);

    expect(parseProductKitCatalogue(value, contextFixture())).toBeNull();
  });

  it.each([
    ["wrong catalogue pack", (_value: MutableRecord, context: MutableRecord) => {
      context.catalogPackId = "another-pack";
    }],
    ["wrong catalogue hash", (_value: MutableRecord, context: MutableRecord) => {
      context.catalogSha256 = "0".repeat(64);
    }],
    ["unknown raster asset", (value: MutableRecord) => {
      ((rows(value, "kits")[0]!.base as MutableRecord).assetId) = "asset-missing";
    }],
    ["stale raster hash", (value: MutableRecord) => {
      ((rows(value, "kits")[0]!.base as MutableRecord).masterSha256) = "0".repeat(64);
    }],
    ["unreviewed raster", (_value: MutableRecord, context: MutableRecord) => {
      (rows(context, "records")[0]!).classroomReviewed = false;
    }],
    ["branded raster", (_value: MutableRecord, context: MutableRecord) => {
      (rows(context, "records")[0]!).brandFree = false;
    }],
    ["non-offline raster", (_value: MutableRecord, context: MutableRecord) => {
      (rows(context, "records")[0]!).delivery = "live-photo";
    }],
    ["SVG master", (_value: MutableRecord, context: MutableRecord) => {
      ((rows(context, "records")[0]!.files as MutableRecord).master) =
        "/catalog/generated/offline-core-v1/assets/asset-grid-base/master.svg";
    }],
    ["trim/catalogue dimension drift", (value: MutableRecord) => {
      const frame = ((rows(value, "kits")[0]!.base as MutableRecord).frame) as MutableRecord;
      frame.trimWidth = 99;
    }]
  ])("rejects %s", (_label, mutate) => {
    const value = fixture() as unknown as MutableRecord;
    const context = contextFixture() as unknown as MutableRecord;
    mutate(value, context);
    expect(parseProductKitCatalogue(
      value,
      context as unknown as ProductKitCatalogueContext
    )).toBeNull();
  });

  it("returns null without invoking hostile catalogue or context shapes", () => {
    const proxy = new Proxy({}, {
      ownKeys() {
        throw new Error("hostile ownKeys trap");
      }
    });
    let accessorReads = 0;
    const accessorCatalogue = fixture() as unknown as MutableRecord;
    Object.defineProperty(accessorCatalogue, "kits", {
      enumerable: true,
      get() {
        accessorReads += 1;
        throw new Error("hostile getter");
      }
    });
    const methodOverrideCatalogue = fixture();
    Object.defineProperty(methodOverrideCatalogue.kits, "map", {
      value: () => { throw new Error("caller-owned map"); },
      enumerable: false
    });
    const cyclicCatalogue = fixture() as unknown as MutableRecord;
    cyclicCatalogue.self = cyclicCatalogue;

    const calls = [
      () => parseProductKitCatalogue(proxy, contextFixture()),
      () => parseProductKitCatalogue(fixture(), proxy as never),
      () => parseProductKitCatalogue(accessorCatalogue, contextFixture()),
      () => parseProductKitCatalogue(Object.create(fixture()), contextFixture()),
      () => parseProductKitCatalogue(methodOverrideCatalogue, contextFixture()),
      () => parseProductKitCatalogue(cyclicCatalogue, contextFixture())
    ];
    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
    expect(accessorReads).toBe(0);
  });
});
