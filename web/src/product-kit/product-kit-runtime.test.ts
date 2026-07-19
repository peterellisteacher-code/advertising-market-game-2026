import { describe, expect, it } from "vitest";
import { computeCertificationFingerprint } from "./certification-fingerprint";
import type {
  ProductKitCatalogue,
  ProductKitCatalogueContext,
  ProductKitComponent,
  ProductKitKit
} from "./product-kit-catalogue";
import { parseProductKitCatalogue } from "./product-kit-catalogue";
import { createProductKitRuntime } from "./product-kit-runtime";

const HASH = "a".repeat(64);
const CONTEXT = {
  packId: "pk1-runtime-pack",
  connectorFormulaVersion: "product-kit-connectors@1"
} as const;
const PROFILE = {
  familyId: "pk1-drinkware",
  perspectiveId: "pk1-front-view",
  geometryId: "pk1-bottle-lid",
  styleId: "pk1-clean-outline"
} as const;

function socketKit(referenceScale = 0.4): ProductKitKit {
  return {
    id: "pk1-bottle-kit",
    title: "Bottle",
    mode: "socket",
    compatibilityProfile: PROFILE,
    base: {
      assetId: "bottle-base",
      masterSha256: HASH,
      frame: {
        originalWidth: 1000,
        originalHeight: 1000,
        trimX: 0,
        trimY: 0,
        trimWidth: 1000,
        trimHeight: 1000
      }
    },
    priceAssetId: "pk1-price-bottle",
    mountFrames: [{
      id: "pk1-bottle-lid-frame",
      slotId: "pk1-bottle-lid-slot",
      mountType: "socket",
      point: { x: 0.5, y: 0.1 },
      normal: { x: 0, y: -1 },
      referenceScale,
      constraints: {
        minScale: 0.25,
        maxScale: 4,
        minRotationDegrees: -45,
        maxRotationDegrees: 45,
        maxNormalErrorDegrees: 1,
        mirrorAllowed: false
      }
    }],
    artworkBounds: [{ x: 0.2, y: 0.3, width: 0.6, height: 0.4 }]
  };
}

function socketComponent(): ProductKitComponent {
  return {
    id: "pk1-flip-lid",
    title: "Flip lid",
    slotId: "pk1-bottle-lid-slot",
    compatibilityProfile: PROFILE,
    componentFrame: {
      mountType: "socket",
      point: { x: 0.5, y: 0.9 },
      normal: { x: 0, y: -1 },
      referenceScale: 0.2
    },
    fragments: [{
      layer: "front",
      raster: {
        assetId: "flip-lid-front",
        masterSha256: "b".repeat(64),
        frame: {
          originalWidth: 400,
          originalHeight: 300,
          trimX: 0,
          trimY: 0,
          trimWidth: 400,
          trimHeight: 300
        }
      }
    }],
    priceAssetId: "pk1-price-flip-lid"
  };
}

function gripKit(): ProductKitKit {
  return {
    ...socketKit(),
    id: "pk1-cup-kit",
    title: "Cup",
    mode: "grip",
    priceAssetId: "pk1-price-cup",
    mountFrames: [{
      id: "pk1-cup-handle-frame",
      slotId: "pk1-cup-handle-slot",
      mountType: "grip",
      contacts: [{ x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }],
      constraints: {
        minScale: 0.25,
        maxScale: 4,
        minRotationDegrees: -90,
        maxRotationDegrees: 90,
        maxNormalErrorDegrees: 1,
        mirrorAllowed: false
      }
    }]
  };
}

function gripComponent(): ProductKitComponent {
  return {
    ...socketComponent(),
    id: "pk1-loop-handle",
    title: "Loop handle",
    slotId: "pk1-cup-handle-slot",
    componentFrame: {
      mountType: "grip",
      contacts: [{ x: 0.2, y: 0.35 }, { x: 0.2, y: 0.65 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    },
    fragments: [
      {
        layer: "rear",
        raster: {
          ...socketComponent().fragments[0]!.raster,
          assetId: "loop-handle-rear"
        }
      },
      {
        layer: "front",
        raster: {
          ...socketComponent().fragments[0]!.raster,
          assetId: "loop-handle-front",
          masterSha256: "d".repeat(64)
        }
      }
    ],
    priceAssetId: "pk1-price-loop-handle"
  };
}

function gridKit(plane: "floor" | "wall" = "floor"): ProductKitKit {
  return {
    ...socketKit(),
    id: `pk1-${plane}-kit`,
    title: `${plane} grid`,
    mode: "grid",
    priceAssetId: `pk1-price-${plane}`,
    mountFrames: [{
      id: `pk1-${plane}-frame`,
      slotId: `pk1-${plane}-slot`,
      mountType: "grid",
      origin: { x: 0.1, y: 0.2 },
      cellSize: { width: 0.1, height: 0.1 },
      columns: 4,
      rows: 4,
      plane,
      acceptedEdgeTypes: ["pk1-join"]
    }]
  };
}

function gridComponent(plane: "floor" | "wall" = "floor"): ProductKitComponent {
  return {
    ...socketComponent(),
    id: `pk1-${plane}-tile`,
    title: `${plane} tile`,
    slotId: `pk1-${plane}-slot`,
    componentFrame: {
      mountType: "grid",
      plane,
      footprint: { columns: 2, rows: 1 },
      edgeTypes: { east: "pk1-join", west: "pk1-join" }
    },
    fragments: [{
      layer: "overlay",
      raster: {
        ...socketComponent().fragments[0]!.raster,
        assetId: `${plane}-tile-overlay`
      }
    }],
    priceAssetId: `pk1-price-${plane}-tile`
  };
}

function catalogueFor(
  kit: ProductKitKit,
  component: ProductKitComponent
): ProductKitCatalogue {
  return catalogueForPairs([{ kit, component }]);
}

function catalogueForPairs(
  pairs: readonly {
    readonly kit: ProductKitKit;
    readonly component: ProductKitComponent;
  }[]
): ProductKitCatalogue {
  const direct = directCatalogueForPairs(pairs);
  const parsed = parseProductKitCatalogue(direct, contextForCatalogue(direct));
  if (!parsed) throw new Error("invalid bound test catalogue");
  return parsed;
}

function directCatalogueForPairs(
  pairs: readonly {
    readonly kit: ProductKitKit;
    readonly component: ProductKitComponent;
  }[]
): ProductKitCatalogue {
  const kits = [...new Map(pairs.map(({ kit }) => [kit.id, kit])).values()]
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  const components = [
    ...new Map(pairs.map(({ component }) => [component.id, component])).values()
  ].sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  const certifications = pairs.map(({ kit, component }, index) => {
    const frame = kit.mountFrames[0]!;
    const fingerprint = computeCertificationFingerprint(
      CONTEXT,
      kit,
      frame,
      component
    );
    if (fingerprint === null) throw new Error("invalid test fixture");
    return {
      id: `pk1-certification-${index + 1}`,
      kitId: kit.id,
      mountFrameId: frame.id,
      componentId: component.id,
      fingerprint
    };
  });
  return {
    schema: "product-kit@1",
    version: 1,
    packId: CONTEXT.packId,
    catalogPackId: "runtime-catalog",
    catalogSha256: "c".repeat(64),
    pricingVersion: "product-pricing@1",
    connectorFormulaVersion: CONTEXT.connectorFormulaVersion,
    kits,
    components,
    certifications
  };
}

function contextForCatalogue(
  catalogue: ProductKitCatalogue
): ProductKitCatalogueContext {
  const rasters = [
    ...catalogue.kits.map(({ base }) => base),
    ...catalogue.components.flatMap(({ fragments }) =>
      fragments.map(({ raster }) => raster)
    )
  ];
  const records = [...new Map(rasters.map((raster) => [raster.assetId, raster])).values()]
    .map((raster) => ({
      id: raster.assetId,
      masterSha256: raster.masterSha256,
      delivery: "offline",
      kind: "raster-master",
      files: {
        master: `/catalog/generated/${catalogue.catalogPackId}/assets/${raster.assetId}/master.png`
      },
      dimensions: {
        width: raster.frame.trimWidth,
        height: raster.frame.trimHeight
      },
      classroomReviewed: true,
      brandFree: true
    }));
  return {
    catalogPackId: catalogue.catalogPackId,
    catalogSha256: catalogue.catalogSha256,
    records
  };
}

function setPath(
  root: unknown,
  path: readonly (string | number)[],
  value: unknown
): void {
  let target = root as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) {
    target = target[key] as Record<string | number, unknown>;
  }
  target[path.at(-1)!] = value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const SOCKET_REQUEST = {
  kind: "socket",
  kitId: "pk1-bottle-kit",
  mountFrameId: "pk1-bottle-lid-frame",
  componentId: "pk1-flip-lid"
} as const;

describe("product-kit certified pair runtime", () => {
  it("does not trust a directly constructed catalogue with self-computed fingerprints", () => {
    const direct = directCatalogueForPairs([{
      kit: socketKit(),
      component: socketComponent()
    }]);
    const runtime = createProductKitRuntime(direct);

    expect(runtime.resolvePair(SOCKET_REQUEST)).toBeNull();
    expect(runtime.planComposition({
      kitId: SOCKET_REQUEST.kitId,
      placements: [{
        kind: SOCKET_REQUEST.kind,
        placementId: "placement-untrusted",
        mountFrameId: SOCKET_REQUEST.mountFrameId,
        componentId: SOCKET_REQUEST.componentId
      }]
    })).toBeNull();
  });

  it("returns null rather than invoking hostile catalogue shapes", () => {
    const proxy = new Proxy({}, {
      ownKeys() {
        throw new Error("hostile ownKeys trap");
      }
    });
    const methodOverride = directCatalogueForPairs([{
      kit: socketKit(),
      component: socketComponent()
    }]) as unknown as {
      kits: ProductKitKit[];
    };
    Object.defineProperty(methodOverride.kits, "map", {
      value: () => { throw new Error("caller-owned map"); },
      enumerable: false
    });
    let accessorReads = 0;
    const accessorCatalogue = directCatalogueForPairs([{
      kit: socketKit(),
      component: socketComponent()
    }]) as unknown as Record<string, unknown>;
    Object.defineProperty(accessorCatalogue, "kits", {
      enumerable: true,
      get() {
        accessorReads += 1;
        throw new Error("hostile getter");
      }
    });
    const inherited = Object.create(directCatalogueForPairs([{
      kit: socketKit(),
      component: socketComponent()
    }]));
    const calls = [
      () => createProductKitRuntime(proxy as never),
      () => createProductKitRuntime(methodOverride as never),
      () => createProductKitRuntime(accessorCatalogue as never),
      () => createProductKitRuntime(inherited as never)
    ];

    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
    expect(accessorReads).toBe(0);
  });

  it("resolves an exact socket certification through the connector transform", () => {
    const catalogue = catalogueFor(socketKit(), socketComponent());
    const before = JSON.stringify(catalogue);
    const runtime = createProductKitRuntime(catalogue);

    const pair = runtime.resolvePair(SOCKET_REQUEST);

    expect(pair).toMatchObject({
      kind: "socket",
      kitId: "pk1-bottle-kit",
      mountFrameId: "pk1-bottle-lid-frame",
      componentId: "pk1-flip-lid",
      transform: { scale: 2, rotationDegrees: 0 }
    });
    expect(Object.isFrozen(pair)).toBe(true);
    expect(JSON.stringify(catalogue)).toBe(before);
  });

  it("resolves an exact grip certification through the connector transform", () => {
    const runtime = createProductKitRuntime(catalogueFor(gripKit(), gripComponent()));

    const pair = runtime.resolvePair({
      kind: "grip",
      kitId: "pk1-cup-kit",
      mountFrameId: "pk1-cup-handle-frame",
      componentId: "pk1-loop-handle"
    });

    expect(pair).toMatchObject({
      kind: "grip",
      transform: { scale: 2, rotationDegrees: 0, mirrored: false }
    });
    expect(pair && "transform" in pair && Object.isFrozen(pair.transform)).toBe(true);
  });

  it("keeps exact cup-handle scale across differently sized certified bases", () => {
    const compact = structuredClone(gripKit()) as ProductKitKit;
    setPath(compact, ["id"], "pk1-cup-compact");
    setPath(compact, ["base", "assetId"], "cup-compact-base");
    setPath(compact, ["base", "frame", "originalWidth"], 600);
    setPath(compact, ["base", "frame", "originalHeight"], 600);
    setPath(compact, ["base", "frame", "trimWidth"], 600);
    setPath(compact, ["base", "frame", "trimHeight"], 600);
    setPath(compact, ["mountFrames", 0, "id"], "pk1-cup-compact-frame");
    setPath(compact, ["mountFrames", 0, "contacts", 0, "y"], 0.35);
    setPath(compact, ["mountFrames", 0, "contacts", 1, "y"], 0.65);

    const large = structuredClone(gripKit()) as ProductKitKit;
    setPath(large, ["id"], "pk1-cup-large");
    setPath(large, ["base", "assetId"], "cup-large-base");
    setPath(large, ["base", "frame", "originalWidth"], 1200);
    setPath(large, ["base", "frame", "originalHeight"], 1200);
    setPath(large, ["base", "frame", "trimWidth"], 1200);
    setPath(large, ["base", "frame", "trimHeight"], 1200);
    setPath(large, ["mountFrames", 0, "id"], "pk1-cup-large-frame");

    const component = gripComponent();
    const runtime = createProductKitRuntime(catalogueForPairs([
      { kit: compact, component },
      { kit: large, component }
    ]));

    const compactPair = runtime.resolvePair({
      kind: "grip",
      kitId: "pk1-cup-compact",
      mountFrameId: "pk1-cup-compact-frame",
      componentId: "pk1-loop-handle"
    });
    const largePair = runtime.resolvePair({
      kind: "grip",
      kitId: "pk1-cup-large",
      mountFrameId: "pk1-cup-large-frame",
      componentId: "pk1-loop-handle"
    });

    expect(compactPair && "transform" in compactPair
      ? compactPair.transform.scale
      : null).toBe(1);
    expect(largePair && "transform" in largePair
      ? largePair.transform.scale
      : null).toBe(2);
  });

  it("resolves only the certified grid plane and footprint", () => {
    const runtime = createProductKitRuntime(catalogueFor(gridKit(), gridComponent()));

    const pair = runtime.resolvePair({
      kind: "grid",
      kitId: "pk1-floor-kit",
      mountFrameId: "pk1-floor-frame",
      componentId: "pk1-floor-tile"
    });

    expect(pair).toEqual({
      kind: "grid",
      kitId: "pk1-floor-kit",
      mountFrameId: "pk1-floor-frame",
      componentId: "pk1-floor-tile",
      plane: "floor",
      footprint: { columns: 2, rows: 1 },
      edgeTypes: { east: "pk1-join", west: "pk1-join" }
    });
    expect(pair && "footprint" in pair && Object.isFrozen(pair.footprint)).toBe(true);
  });

  it.each([
    ["connector formula", ["connectorFormulaVersion"], "product-kit-connectors@2"],
    ["compatibility profile", ["kits", 0, "compatibilityProfile", "geometryId"], "pk1-stale-geometry"],
    ["mount frame", ["kits", 0, "mountFrames", 0, "point", "x"], 0.55],
    ["base raster", ["kits", 0, "base", "masterSha256"], "e".repeat(64)],
    ["fragment raster", ["components", 0, "fragments", 0, "raster", "masterSha256"], "f".repeat(64)],
    ["signed-zero geometry", ["kits", 0, "mountFrames", 0, "normal", "x"], -0]
  ] as const)("denies %s staleness before resolving a transform", (_label, path, value) => {
    const stale = structuredClone(
      catalogueFor(socketKit(), socketComponent())
    ) as ProductKitCatalogue;
    setPath(stale, path, value);

    const runtime = createProductKitRuntime(stale);
    expect(runtime.resolvePair(SOCKET_REQUEST)).toBeNull();
    expect(runtime.planComposition({
      kitId: SOCKET_REQUEST.kitId,
      placements: [{
        kind: SOCKET_REQUEST.kind,
        placementId: "placement-stale",
        mountFrameId: SOCKET_REQUEST.mountFrameId,
        componentId: SOCKET_REQUEST.componentId
      }]
    })).toBeNull();
  });

  it("fails closed for a malformed pair request", () => {
    const runtime = createProductKitRuntime(
      catalogueFor(socketKit(), socketComponent())
    );

    expect(runtime.resolvePair(null as never)).toBeNull();
    expect(runtime.resolvePair({
      ...SOCKET_REQUEST,
      unexpected: true
    } as never)).toBeNull();
  });

  it("returns null rather than invoking hostile pair requests", () => {
    const runtime = createProductKitRuntime(catalogueFor(socketKit(), socketComponent()));
    const proxy = new Proxy({}, {
      ownKeys() {
        throw new Error("hostile ownKeys trap");
      }
    });
    const calls = [
      () => runtime.resolvePair(proxy as never),
      () => runtime.resolvePair(Object.create(SOCKET_REQUEST) as never)
    ];

    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
  });

  it("rejects missing certification and request-kind mismatches", () => {
    const uncertified = structuredClone(
      catalogueFor(socketKit(), socketComponent())
    ) as ProductKitCatalogue;
    setPath(uncertified, ["certifications"], []);

    expect(createProductKitRuntime(uncertified).resolvePair(SOCKET_REQUEST)).toBeNull();
    expect(createProductKitRuntime(
      catalogueFor(socketKit(), socketComponent())
    ).resolvePair({ ...SOCKET_REQUEST, kind: "grip" })).toBeNull();
  });

  it("rejects exactly certified grid pairs with a different plane or overflowing footprint", () => {
    const wrongPlane = structuredClone(gridComponent("floor")) as ProductKitComponent;
    setPath(wrongPlane, ["componentFrame", "plane"], "wall");
    const oversized = structuredClone(gridComponent("floor")) as ProductKitComponent;
    setPath(oversized, ["componentFrame", "footprint", "columns"], 5);
    const request = {
      kind: "grid",
      kitId: "pk1-floor-kit",
      mountFrameId: "pk1-floor-frame",
      componentId: "pk1-floor-tile"
    } as const;

    expect(createProductKitRuntime(
      directCatalogueForPairs([{ kit: gridKit("floor"), component: wrongPlane }])
    ).resolvePair(request)).toBeNull();
    expect(createProductKitRuntime(
      directCatalogueForPairs([{ kit: gridKit("floor"), component: oversized }])
    ).resolvePair(request)).toBeNull();
  });
});

describe("product-kit composition runtime", () => {
  it("composes one certified socket placement into the complete layer plan", () => {
    const runtime = createProductKitRuntime(
      catalogueFor(socketKit(), socketComponent())
    );

    const plan = runtime.planComposition({
      kitId: "pk1-bottle-kit",
      placements: [{
        kind: "socket",
        placementId: "placement-lid",
        mountFrameId: "pk1-bottle-lid-frame",
        componentId: "pk1-flip-lid"
      }]
    });

    expect(plan?.layers.map(({ layer }) => layer)).toEqual([
      "rear",
      "body",
      "front",
      "artwork",
      "overlay"
    ]);
    expect(plan?.layers[2]?.entries[0]).toMatchObject({
      kind: "component-raster",
      placementId: "placement-lid",
      componentId: "pk1-flip-lid",
      geometry: { kind: "affine", transform: { scale: 2 } }
    });
    expect(plan?.pricedItems).toEqual([
      {
        kind: "base",
        itemId: "base:pk1-bottle-kit",
        priceAssetId: "pk1-price-bottle"
      },
      {
        kind: "component",
        itemId: "placement:placement-lid",
        placementId: "placement-lid",
        componentId: "pk1-flip-lid",
        priceAssetId: "pk1-price-flip-lid"
      }
    ]);
    expect(Object.isFrozen(plan)).toBe(true);
  });

  it("groups and validates repeated integer-cell grid placements per frame", () => {
    const runtime = createProductKitRuntime(
      catalogueFor(gridKit("floor"), gridComponent("floor"))
    );

    const plan = runtime.planComposition({
      kitId: "pk1-floor-kit",
      placements: [
        {
          kind: "grid",
          placementId: "placement-right",
          mountFrameId: "pk1-floor-frame",
          componentId: "pk1-floor-tile",
          column: 2,
          row: 0
        },
        {
          kind: "grid",
          placementId: "placement-left",
          mountFrameId: "pk1-floor-frame",
          componentId: "pk1-floor-tile",
          column: 0,
          row: 0
        }
      ]
    });

    const overlayEntries = plan?.layers[4]?.entries;
    expect(overlayEntries?.map((entry) =>
      entry.kind === "component-raster" ? entry.placementId : null
    )).toEqual(["placement-left", "placement-right"]);
    expect(overlayEntries?.[0]).toMatchObject({
      geometry: {
        kind: "grid",
        column: 0,
        row: 0,
        normalizedBounds: { x: 0.1, y: 0.2, width: 0.2, height: 0.1 }
      }
    });
    expect(plan?.pricedItems.slice(1).map(({ itemId }) => itemId)).toEqual([
      "placement:placement-left",
      "placement:placement-right"
    ]);
  });

  it("allows at most one fixed placement on a socket or grip mount frame", () => {
    const runtime = createProductKitRuntime(
      catalogueFor(socketKit(), socketComponent())
    );

    expect(runtime.planComposition({
      kitId: "pk1-bottle-kit",
      placements: [
        {
          kind: "socket",
          placementId: "placement-first",
          mountFrameId: "pk1-bottle-lid-frame",
          componentId: "pk1-flip-lid"
        },
        {
          kind: "socket",
          placementId: "placement-second",
          mountFrameId: "pk1-bottle-lid-frame",
          componentId: "pk1-flip-lid"
        }
      ]
    })).toBeNull();
  });

  it("fails closed for malformed composition requests", () => {
    const runtime = createProductKitRuntime(
      catalogueFor(socketKit(), socketComponent())
    );

    expect(runtime.planComposition(null as never)).toBeNull();
    expect(runtime.planComposition({
      kitId: "pk1-bottle-kit",
      placements: [null]
    } as never)).toBeNull();
    expect(runtime.planComposition({
      kitId: "pk1-bottle-kit",
      placements: [],
      unexpected: true
    } as never)).toBeNull();
    expect(runtime.planComposition({
      kitId: "pk1-bottle-kit",
      placements: [{
        kind: "socket",
        placementId: "placement-extra",
        mountFrameId: "pk1-bottle-lid-frame",
        componentId: "pk1-flip-lid",
        unexpected: true
      }]
    } as never)).toBeNull();

    const sparsePlacements = new Array(1);
    const resolveSparse = () => runtime.planComposition({
      kitId: "pk1-bottle-kit",
      placements: sparsePlacements
    } as never);
    expect(resolveSparse).not.toThrow();
    expect(resolveSparse()).toBeNull();
  });

  it("returns null rather than invoking hostile composition requests", () => {
    const runtime = createProductKitRuntime(catalogueFor(socketKit(), socketComponent()));
    const proxy = new Proxy({}, {
      ownKeys() {
        throw new Error("hostile ownKeys trap");
      }
    });
    const placements = [{
      kind: "socket" as const,
      placementId: "placement-one",
      mountFrameId: SOCKET_REQUEST.mountFrameId,
      componentId: SOCKET_REQUEST.componentId
    }];
    Object.defineProperty(placements, "every", {
      value: () => { throw new Error("caller-owned every"); },
      enumerable: false
    });
    const cyclic: Record<string, unknown> = {
      kitId: SOCKET_REQUEST.kitId,
      placements: []
    };
    (cyclic.placements as unknown[]).push(cyclic);
    const calls = [
      () => runtime.planComposition(proxy as never),
      () => runtime.planComposition(Object.create({
        kitId: SOCKET_REQUEST.kitId,
        placements: []
      }) as never),
      () => runtime.planComposition({
        kitId: SOCKET_REQUEST.kitId,
        placements
      }),
      () => runtime.planComposition(cyclic as never)
    ];

    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
  });

  it("rejects signed-zero grid placement coordinates", () => {
    const runtime = createProductKitRuntime(
      catalogueFor(gridKit("floor"), gridComponent("floor"))
    );

    expect(runtime.planComposition({
      kitId: "pk1-floor-kit",
      placements: [{
        kind: "grid",
        placementId: "placement-signed-zero",
        mountFrameId: "pk1-floor-frame",
        componentId: "pk1-floor-tile",
        column: -0,
        row: 0
      }]
    })).toBeNull();
  });

  it("rejects duplicate IDs, request-kind mismatch, and any invalid member without a partial plan", () => {
    const gridRuntime = createProductKitRuntime(
      catalogueFor(gridKit("floor"), gridComponent("floor"))
    );
    expect(gridRuntime.planComposition({
      kitId: "pk1-floor-kit",
      placements: [
        {
          kind: "grid",
          placementId: "placement-duplicate",
          mountFrameId: "pk1-floor-frame",
          componentId: "pk1-floor-tile",
          column: 0,
          row: 0
        },
        {
          kind: "grid",
          placementId: "placement-duplicate",
          mountFrameId: "pk1-floor-frame",
          componentId: "pk1-floor-tile",
          column: 2,
          row: 0
        }
      ]
    })).toBeNull();
    expect(gridRuntime.planComposition({
      kitId: "pk1-floor-kit",
      placements: [
        {
          kind: "grid",
          placementId: "placement-valid",
          mountFrameId: "pk1-floor-frame",
          componentId: "pk1-floor-tile",
          column: 0,
          row: 0
        },
        {
          kind: "grid",
          placementId: "placement-overlap",
          mountFrameId: "pk1-floor-frame",
          componentId: "pk1-floor-tile",
          column: 1,
          row: 0
        }
      ]
    })).toBeNull();

    const socketRuntime = createProductKitRuntime(
      catalogueFor(socketKit(), socketComponent())
    );
    expect(socketRuntime.planComposition({
      kitId: "pk1-bottle-kit",
      placements: [{
        kind: "grip",
        placementId: "placement-wrong-kind",
        mountFrameId: "pk1-bottle-lid-frame",
        componentId: "pk1-flip-lid"
      }]
    })).toBeNull();
  });

  it("composes a wall grid with exact integer-cell bounds", () => {
    const runtime = createProductKitRuntime(
      catalogueFor(gridKit("wall"), gridComponent("wall"))
    );

    const plan = runtime.planComposition({
      kitId: "pk1-wall-kit",
      placements: [{
        kind: "grid",
        placementId: "placement-wall",
        mountFrameId: "pk1-wall-frame",
        componentId: "pk1-wall-tile",
        column: 1,
        row: 2
      }]
    });

    expect(plan?.layers[4]?.entries[0]).toMatchObject({
      kind: "component-raster",
      placementId: "placement-wall",
      geometry: {
        kind: "grid",
        column: 1,
        row: 2,
        normalizedBounds: { x: 0.2, y: 0.4, width: 0.2, height: 0.1 }
      }
    });
  });

  it("leaves deeply frozen catalogue and request inputs unchanged", () => {
    const catalogue = deepFreeze(catalogueFor(socketKit(), socketComponent()));
    const request = deepFreeze({
      kitId: "pk1-bottle-kit",
      placements: [{
        kind: "socket" as const,
        placementId: "placement-frozen",
        mountFrameId: "pk1-bottle-lid-frame",
        componentId: "pk1-flip-lid"
      }]
    });
    const beforeCatalogue = JSON.stringify(catalogue);
    const beforeRequest = JSON.stringify(request);
    const runtime = createProductKitRuntime(catalogue);

    const plan = runtime.planComposition(request);

    expect(plan).not.toBeNull();
    expect(Object.isFrozen(runtime)).toBe(true);
    expect(Object.isFrozen(plan?.layers[2]?.entries[0])).toBe(true);
    expect(JSON.stringify(catalogue)).toBe(beforeCatalogue);
    expect(JSON.stringify(request)).toBe(beforeRequest);
  });
});
