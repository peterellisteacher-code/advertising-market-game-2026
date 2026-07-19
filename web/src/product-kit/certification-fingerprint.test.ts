import { describe, expect, it } from "vitest";
import {
  canonicalCertificationInput,
  certificationFingerprintMatches,
  computeCertificationFingerprint,
  type ProductKitCertificationContext
} from "./certification-fingerprint";
import type {
  ProductKitComponent,
  ProductKitKit,
  ProductKitMountFrame
} from "./product-kit-catalogue";

const CONTEXT: ProductKitCertificationContext = {
  packId: "pk1-pilot",
  connectorFormulaVersion: "product-kit-connectors@1"
};

const SOCKET_KIT: ProductKitKit = {
  id: "pk1-socket-kit",
  title: "Travel Bottle",
  mode: "socket",
  compatibilityProfile: {
    familyId: "pk1-drinkware",
    perspectiveId: "pk1-front-view",
    geometryId: "pk1-bottle-lid",
    styleId: "pk1-outline-clean"
  },
  base: {
    assetId: "asset-socket-base",
    masterSha256: "1".repeat(64),
    frame: {
      originalWidth: 1200,
      originalHeight: 1000,
      trimX: 100,
      trimY: 50,
      trimWidth: 900,
      trimHeight: 800
    }
  },
  priceAssetId: "pk1-price-socket-base",
  mountFrames: [{
    id: "pk1-socket-frame",
    slotId: "pk1-lid-slot",
    mountType: "socket",
    point: { x: 0.5, y: 0.08 },
    normal: { x: 0, y: -1 },
    referenceScale: 0.22,
    constraints: {
      minScale: 0.5,
      maxScale: 2,
      minRotationDegrees: -45,
      maxRotationDegrees: 45,
      maxNormalErrorDegrees: 5,
      mirrorAllowed: false
    }
  }],
  artworkBounds: [{ x: 0.2, y: 0.3, width: 0.6, height: 0.45 }]
};

const SOCKET_COMPONENT: ProductKitComponent = {
  id: "pk1-socket-component",
  title: "Flip Lid",
  slotId: "pk1-lid-slot",
  compatibilityProfile: {
    familyId: "pk1-drinkware",
    perspectiveId: "pk1-front-view",
    geometryId: "pk1-bottle-lid",
    styleId: "pk1-outline-clean"
  },
  componentFrame: {
    mountType: "socket",
    point: { x: 0.5, y: 0.9 },
    normal: { x: 0, y: -1 },
    referenceScale: 0.2
  },
  fragments: [{
    layer: "front",
    raster: {
      assetId: "asset-socket-part",
      masterSha256: "2".repeat(64),
      frame: {
        originalWidth: 500,
        originalHeight: 400,
        trimX: 10,
        trimY: 20,
        trimWidth: 300,
        trimHeight: 200
      }
    }
  }],
  priceAssetId: "pk1-price-flip-lid"
};

const GRIP_KIT: ProductKitKit = {
  id: "pk1-grip-kit",
  title: "Reusable Cup",
  mode: "grip",
  compatibilityProfile: {
    familyId: "pk1-drinkware",
    perspectiveId: "pk1-front-view",
    geometryId: "pk1-cup-handle",
    styleId: "pk1-outline-clean"
  },
  base: {
    assetId: "asset-grip-base",
    masterSha256: "3".repeat(64),
    frame: {
      originalWidth: 1000,
      originalHeight: 1200,
      trimX: 0,
      trimY: 100,
      trimWidth: 900,
      trimHeight: 1000
    }
  },
  priceAssetId: "pk1-price-grip-base",
  mountFrames: [{
    id: "pk1-grip-frame",
    slotId: "pk1-handle-slot",
    mountType: "grip",
    contacts: [{ x: 0.82, y: 0.35 }, { x: 0.82, y: 0.7 }],
    normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }],
    constraints: {
      minScale: 0.5,
      maxScale: 2,
      minRotationDegrees: -90,
      maxRotationDegrees: 90,
      maxNormalErrorDegrees: 3,
      mirrorAllowed: true
    }
  }],
  artworkBounds: [{ x: 0.25, y: 0.25, width: 0.45, height: 0.5 }]
};

const GRIP_COMPONENT: ProductKitComponent = {
  id: "pk1-grip-component",
  title: "Loop Handle",
  slotId: "pk1-handle-slot",
  compatibilityProfile: {
    familyId: "pk1-drinkware",
    perspectiveId: "pk1-front-view",
    geometryId: "pk1-cup-handle",
    styleId: "pk1-outline-clean"
  },
  componentFrame: {
    mountType: "grip",
    contacts: [{ x: 0.18, y: 0.25 }, { x: 0.18, y: 0.75 }],
    normals: [{ x: -1, y: 0 }, { x: -1, y: 0 }]
  },
  fragments: [
    {
      layer: "rear",
      raster: {
        assetId: "asset-grip-rear",
        masterSha256: "4".repeat(64),
        frame: {
          originalWidth: 600,
          originalHeight: 800,
          trimX: 20,
          trimY: 30,
          trimWidth: 500,
          trimHeight: 700
        }
      }
    },
    {
      layer: "front",
      raster: {
        assetId: "asset-grip-front",
        masterSha256: "5".repeat(64),
        frame: {
          originalWidth: 620,
          originalHeight: 820,
          trimX: 21,
          trimY: 31,
          trimWidth: 501,
          trimHeight: 701
        }
      }
    }
  ],
  priceAssetId: "pk1-price-loop-handle"
};

const GRID_KIT: ProductKitKit = {
  id: "pk1-grid-kit",
  title: "Escape Room Wall",
  mode: "grid",
  compatibilityProfile: {
    familyId: "pk1-escape-room",
    perspectiveId: "pk1-front-view",
    geometryId: "pk1-wall-grid",
    styleId: "pk1-outline-clean"
  },
  base: {
    assetId: "asset-grid-base",
    masterSha256: "6".repeat(64),
    frame: {
      originalWidth: 1600,
      originalHeight: 1000,
      trimX: 40,
      trimY: 20,
      trimWidth: 1500,
      trimHeight: 900
    }
  },
  priceAssetId: "pk1-price-grid-base",
  mountFrames: [{
    id: "pk1-grid-frame",
    slotId: "pk1-grid-slot",
    mountType: "grid",
    origin: { x: 0.1, y: 0.15 },
    cellSize: { width: 0.1, height: 0.12 },
    columns: 8,
    rows: 6,
    plane: "wall",
    acceptedEdgeTypes: ["pk1-door", "pk1-panel"]
  }],
  artworkBounds: []
};

const GRID_COMPONENT: ProductKitComponent = {
  id: "pk1-grid-component",
  title: "Secret Door",
  slotId: "pk1-grid-slot",
  compatibilityProfile: {
    familyId: "pk1-escape-room",
    perspectiveId: "pk1-front-view",
    geometryId: "pk1-wall-grid",
    styleId: "pk1-outline-clean"
  },
  componentFrame: {
    mountType: "grid",
    plane: "wall",
    footprint: { columns: 2, rows: 3 },
    edgeTypes: { north: "pk1-panel", south: "pk1-door" }
  },
  fragments: [{
    layer: "overlay",
    raster: {
      assetId: "asset-grid-part",
      masterSha256: "7".repeat(64),
      frame: {
        originalWidth: 420,
        originalHeight: 640,
        trimX: 10,
        trimY: 15,
        trimWidth: 400,
        trimHeight: 600
      }
    }
  }],
  priceAssetId: "pk1-price-secret-door"
};

const SOCKET_CANONICAL = `{"schema":"product-kit-certification@1","version":1,"packId":"pk1-pilot","connectorFormulaVersion":"product-kit-connectors@1","kit":{"id":"pk1-socket-kit","mode":"socket","compatibilityProfile":{"familyId":"pk1-drinkware","perspectiveId":"pk1-front-view","geometryId":"pk1-bottle-lid","styleId":"pk1-outline-clean"},"base":{"assetId":"asset-socket-base","masterSha256":"${"1".repeat(64)}","frame":{"originalWidth":1200,"originalHeight":1000,"trimX":100,"trimY":50,"trimWidth":900,"trimHeight":800}},"mountFrame":{"id":"pk1-socket-frame","slotId":"pk1-lid-slot","mountType":"socket","point":{"x":0.5,"y":0.08},"normal":{"x":0,"y":-1},"referenceScale":0.22,"constraints":{"minScale":0.5,"maxScale":2,"minRotationDegrees":-45,"maxRotationDegrees":45,"maxNormalErrorDegrees":5,"mirrorAllowed":false}}},"component":{"id":"pk1-socket-component","slotId":"pk1-lid-slot","compatibilityProfile":{"familyId":"pk1-drinkware","perspectiveId":"pk1-front-view","geometryId":"pk1-bottle-lid","styleId":"pk1-outline-clean"},"componentFrame":{"mountType":"socket","point":{"x":0.5,"y":0.9},"normal":{"x":0,"y":-1},"referenceScale":0.2},"fragments":[{"layer":"front","raster":{"assetId":"asset-socket-part","masterSha256":"${"2".repeat(64)}","frame":{"originalWidth":500,"originalHeight":400,"trimX":10,"trimY":20,"trimWidth":300,"trimHeight":200}}}]}}`;

const GRIP_CANONICAL = `{"schema":"product-kit-certification@1","version":1,"packId":"pk1-pilot","connectorFormulaVersion":"product-kit-connectors@1","kit":{"id":"pk1-grip-kit","mode":"grip","compatibilityProfile":{"familyId":"pk1-drinkware","perspectiveId":"pk1-front-view","geometryId":"pk1-cup-handle","styleId":"pk1-outline-clean"},"base":{"assetId":"asset-grip-base","masterSha256":"${"3".repeat(64)}","frame":{"originalWidth":1000,"originalHeight":1200,"trimX":0,"trimY":100,"trimWidth":900,"trimHeight":1000}},"mountFrame":{"id":"pk1-grip-frame","slotId":"pk1-handle-slot","mountType":"grip","contacts":[{"x":0.82,"y":0.35},{"x":0.82,"y":0.7}],"normals":[{"x":1,"y":0},{"x":1,"y":0}],"constraints":{"minScale":0.5,"maxScale":2,"minRotationDegrees":-90,"maxRotationDegrees":90,"maxNormalErrorDegrees":3,"mirrorAllowed":true}}},"component":{"id":"pk1-grip-component","slotId":"pk1-handle-slot","compatibilityProfile":{"familyId":"pk1-drinkware","perspectiveId":"pk1-front-view","geometryId":"pk1-cup-handle","styleId":"pk1-outline-clean"},"componentFrame":{"mountType":"grip","contacts":[{"x":0.18,"y":0.25},{"x":0.18,"y":0.75}],"normals":[{"x":-1,"y":0},{"x":-1,"y":0}]},"fragments":[{"layer":"rear","raster":{"assetId":"asset-grip-rear","masterSha256":"${"4".repeat(64)}","frame":{"originalWidth":600,"originalHeight":800,"trimX":20,"trimY":30,"trimWidth":500,"trimHeight":700}}},{"layer":"front","raster":{"assetId":"asset-grip-front","masterSha256":"${"5".repeat(64)}","frame":{"originalWidth":620,"originalHeight":820,"trimX":21,"trimY":31,"trimWidth":501,"trimHeight":701}}}]}}`;

const GRID_CANONICAL = `{"schema":"product-kit-certification@1","version":1,"packId":"pk1-pilot","connectorFormulaVersion":"product-kit-connectors@1","kit":{"id":"pk1-grid-kit","mode":"grid","compatibilityProfile":{"familyId":"pk1-escape-room","perspectiveId":"pk1-front-view","geometryId":"pk1-wall-grid","styleId":"pk1-outline-clean"},"base":{"assetId":"asset-grid-base","masterSha256":"${"6".repeat(64)}","frame":{"originalWidth":1600,"originalHeight":1000,"trimX":40,"trimY":20,"trimWidth":1500,"trimHeight":900}},"mountFrame":{"id":"pk1-grid-frame","slotId":"pk1-grid-slot","mountType":"grid","origin":{"x":0.1,"y":0.15},"cellSize":{"width":0.1,"height":0.12},"columns":8,"rows":6,"plane":"wall","acceptedEdgeTypes":["pk1-door","pk1-panel"]}},"component":{"id":"pk1-grid-component","slotId":"pk1-grid-slot","compatibilityProfile":{"familyId":"pk1-escape-room","perspectiveId":"pk1-front-view","geometryId":"pk1-wall-grid","styleId":"pk1-outline-clean"},"componentFrame":{"mountType":"grid","plane":"wall","footprint":{"columns":2,"rows":3},"edgeTypes":{"north":"pk1-panel","east":null,"south":"pk1-door","west":null}},"fragments":[{"layer":"overlay","raster":{"assetId":"asset-grid-part","masterSha256":"${"7".repeat(64)}","frame":{"originalWidth":420,"originalHeight":640,"trimX":10,"trimY":15,"trimWidth":400,"trimHeight":600}}}]}}`;

const EXPECTED_FINGERPRINTS = {
  socket: "141f2fa929ec7f4336f5b6addb845993c44a686c882baf7543a1221750e55771",
  grip: "769ac88a116a1d19e83928b19d6087f4aa868009493decfcbac9f690e994060a",
  grid: "ce6ab5b80432b613a3d41321761857bd650b09e16e60f57004c61f384762414b"
} as const;

interface EvidenceFixture {
  context: ProductKitCertificationContext;
  kit: ProductKitKit;
  component: ProductKitComponent;
}

const fixtures = {
  socket: { context: CONTEXT, kit: SOCKET_KIT, component: SOCKET_COMPONENT },
  grip: { context: CONTEXT, kit: GRIP_KIT, component: GRIP_COMPONENT },
  grid: { context: CONTEXT, kit: GRID_KIT, component: GRID_COMPONENT }
} satisfies Record<string, EvidenceFixture>;

function frameOf(fixture: EvidenceFixture): ProductKitMountFrame {
  return fixture.kit.mountFrames[0]!;
}

function fingerprintOf(fixture: EvidenceFixture): string | null {
  return computeCertificationFingerprint(
    fixture.context,
    fixture.kit,
    frameOf(fixture),
    fixture.component
  );
}

function cloneFixture(fixture: EvidenceFixture): EvidenceFixture {
  return structuredClone(fixture);
}

function setPath(root: unknown, path: readonly (string | number)[], value: unknown): void {
  let target = root as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) {
    target = target[key] as Record<string | number, unknown>;
  }
  target[path.at(-1)!] = value;
}

function reverseInsertionOrder<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => reverseInsertionOrder(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).reverse().map(([key, item]) => [key, reverseInsertionOrder(item)])
    ) as T;
  }
  return value;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

describe("certification canonical input", () => {
  it.each([
    ["socket", fixtures.socket, SOCKET_CANONICAL, EXPECTED_FINGERPRINTS.socket],
    ["grip", fixtures.grip, GRIP_CANONICAL, EXPECTED_FINGERPRINTS.grip],
    ["grid", fixtures.grid, GRID_CANONICAL, EXPECTED_FINGERPRINTS.grid]
  ] as const)("pins the exact %s evidence and fingerprint", (_kind, fixture, canonical, fingerprint) => {
    const actual = canonicalCertificationInput(
      fixture.context,
      fixture.kit,
      frameOf(fixture),
      fixture.component
    );

    expect(actual).toBe(canonical);
    expect(actual?.endsWith("\n")).toBe(false);
    expect(computeCertificationFingerprint(
      fixture.context,
      fixture.kit,
      frameOf(fixture),
      fixture.component
    )).toBe(fingerprint);
  });

  it("encodes every absent grid edge as null", () => {
    const canonical = canonicalCertificationInput(
      CONTEXT,
      GRID_KIT,
      frameOf(fixtures.grid),
      GRID_COMPONENT
    );

    expect(JSON.parse(canonical!).component.componentFrame.edgeTypes).toEqual({
      north: "pk1-panel",
      east: null,
      south: "pk1-door",
      west: null
    });
  });

  it("is independent of property insertion order at every object depth", () => {
    const reordered = reverseInsertionOrder(fixtures.grip);

    expect(canonicalCertificationInput(
      reordered.context,
      reordered.kit,
      frameOf(reordered),
      reordered.component
    )).toBe(GRIP_CANONICAL);
    expect(fingerprintOf(reordered)).toBe(EXPECTED_FINGERPRINTS.grip);
  });

  it("does not mutate deeply frozen evidence", () => {
    const frozen = deepFreeze(cloneFixture(fixtures.grip));
    const before = JSON.stringify(frozen);

    expect(fingerprintOf(frozen)).toBe(EXPECTED_FINGERPRINTS.grip);
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it.each([
    ["an inconsistent kit/frame discriminant", ["kit", "mode"], "socket"],
    ["an inconsistent component/frame discriminant", ["component", "componentFrame", "mountType"], "socket"],
    ["an unknown frame discriminant", ["kit", "mountFrames", 0, "mountType"], "unknown"],
    ["non-finite geometry", ["kit", "mountFrames", 0, "origin", "x"], Number.NaN],
    ["malformed UTF-16", ["context", "packId"], "pk1-bad\uD800"],
    ["terminal LF in an ID", ["context", "packId"], "pk1-pilot\n"],
    ["signed-zero evidence", ["kit", "mountFrames", 0, "origin", "x"], -0]
  ] as const)("fails closed for %s", (_label, path, changedValue) => {
    const changed = cloneFixture(fixtures.grid);
    setPath(changed, path, changedValue);

    expect(canonicalCertificationInput(
      changed.context,
      changed.kit,
      frameOf(changed),
      changed.component
    )).toBeNull();
    expect(fingerprintOf(changed)).toBeNull();
  });

  it("rejects sparse evidence arrays instead of omitting holes", () => {
    const changed = cloneFixture(fixtures.grid);
    const sparseFrames = new Array<ProductKitMountFrame>(2);
    sparseFrames[0] = frameOf(changed);
    (changed.kit as unknown as {
      mountFrames: ProductKitMountFrame[];
    }).mountFrames = sparseFrames;

    expect(fingerprintOf(changed)).toBeNull();
  });

  it("returns null without invoking hostile evidence shapes", () => {
    const proxy = new Proxy({}, {
      ownKeys() {
        throw new Error("hostile ownKeys trap");
      }
    });
    const methodOverride = cloneFixture(fixtures.socket);
    Object.defineProperty(methodOverride.component.fragments, "map", {
      value: () => { throw new Error("caller-owned map"); },
      enumerable: false
    });
    let accessorReads = 0;
    const accessorKit = cloneFixture(fixtures.socket).kit as unknown as Record<string, unknown>;
    Object.defineProperty(accessorKit, "base", {
      enumerable: true,
      get() {
        accessorReads += 1;
        throw new Error("hostile getter");
      }
    });

    const calls = [
      () => canonicalCertificationInput(
        proxy as never,
        SOCKET_KIT,
        frameOf(fixtures.socket),
        SOCKET_COMPONENT
      ),
      () => canonicalCertificationInput(
        CONTEXT,
        Object.create(SOCKET_KIT) as never,
        frameOf(fixtures.socket),
        SOCKET_COMPONENT
      ),
      () => canonicalCertificationInput(
        CONTEXT,
        accessorKit as never,
        frameOf(fixtures.socket),
        SOCKET_COMPONENT
      ),
      () => computeCertificationFingerprint(
        CONTEXT,
        methodOverride.kit,
        frameOf(methodOverride),
        methodOverride.component
      )
    ];
    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
    expect(accessorReads).toBe(0);
  });

  it.each([
    ["negative raster dimensions", "socket", ["kit", "base", "frame", "originalWidth"], -1],
    ["raster trim overflow", "socket", ["kit", "base", "frame", "trimX"], 1199],
    ["point outside the unit rectangle", "socket", ["kit", "mountFrames", 0, "point", "x"], 1.1],
    ["zero normal", "socket", ["component", "componentFrame", "normal"], { x: 0, y: 0 }],
    ["inverted transform constraints", "socket", ["kit", "mountFrames", 0, "constraints", "minScale"], 3],
    ["zero grid columns", "grid", ["kit", "mountFrames", 0, "columns"], 0],
    ["grid extent overflow", "grid", ["kit", "mountFrames", 0, "origin", "x"], 0.9],
    ["zero component footprint", "grid", ["component", "componentFrame", "footprint", "columns"], 0]
  ] as const)("rejects out-of-contract %s", (_label, fixtureName, path, changedValue) => {
    const changed = cloneFixture(fixtures[fixtureName]);
    setPath(changed, path, changedValue);

    expect(canonicalCertificationInput(
      changed.context,
      changed.kit,
      frameOf(changed),
      changed.component
    )).toBeNull();
    expect(fingerprintOf(changed)).toBeNull();
  });

  it.each([
    ["kit title", ["kit", "title"], "Renamed kit"],
    ["kit artwork bounds", ["kit", "artworkBounds"], [{ x: 0, y: 0, width: 1, height: 1 }]],
    ["kit price ID", ["kit", "priceAssetId"], "pk1-another-kit-price"],
    ["component title", ["component", "title"], "Renamed component"],
    ["component price ID", ["component", "priceAssetId"], "pk1-another-component-price"]
  ] as const)("excludes %s", (_label, path, changedValue) => {
    const changed = cloneFixture(fixtures.socket);
    setPath(changed, path, changedValue);

    expect(fingerprintOf(changed)).toBe(EXPECTED_FINGERPRINTS.socket);
  });
});

const socketIncludedChanges = [
  ["pack ID", ["context", "packId"], "pk1-another-pack"],
  ["connector formula version", ["context", "connectorFormulaVersion"], "product-kit-connectors@2"],
  ["kit ID", ["kit", "id"], "pk1-another-socket-kit"],
  ["kit mode", ["kit", "mode"], "grip"],
  ["kit family profile", ["kit", "compatibilityProfile", "familyId"], "pk1-another-family"],
  ["kit perspective profile", ["kit", "compatibilityProfile", "perspectiveId"], "pk1-side-view"],
  ["kit geometry profile", ["kit", "compatibilityProfile", "geometryId"], "pk1-another-geometry"],
  ["kit style profile", ["kit", "compatibilityProfile", "styleId"], "pk1-another-style"],
  ["base asset ID", ["kit", "base", "assetId"], "asset-another-base"],
  ["base hash", ["kit", "base", "masterSha256"], "a".repeat(64)],
  ["base original width", ["kit", "base", "frame", "originalWidth"], 1201],
  ["base original height", ["kit", "base", "frame", "originalHeight"], 1001],
  ["base trim x", ["kit", "base", "frame", "trimX"], 101],
  ["base trim y", ["kit", "base", "frame", "trimY"], 51],
  ["base trim width", ["kit", "base", "frame", "trimWidth"], 901],
  ["base trim height", ["kit", "base", "frame", "trimHeight"], 801],
  ["mount-frame ID", ["kit", "mountFrames", 0, "id"], "pk1-another-socket-frame"],
  ["mount-frame slot", ["kit", "mountFrames", 0, "slotId"], "pk1-another-slot"],
  ["mount point x", ["kit", "mountFrames", 0, "point", "x"], 0.51],
  ["mount point y", ["kit", "mountFrames", 0, "point", "y"], 0.09],
  ["mount normal x", ["kit", "mountFrames", 0, "normal", "x"], 0.1],
  ["mount normal y", ["kit", "mountFrames", 0, "normal", "y"], -0.9],
  ["mount reference scale", ["kit", "mountFrames", 0, "referenceScale"], 0.23],
  ["minimum scale", ["kit", "mountFrames", 0, "constraints", "minScale"], 0.4],
  ["maximum scale", ["kit", "mountFrames", 0, "constraints", "maxScale"], 2.1],
  ["minimum rotation", ["kit", "mountFrames", 0, "constraints", "minRotationDegrees"], -44],
  ["maximum rotation", ["kit", "mountFrames", 0, "constraints", "maxRotationDegrees"], 44],
  ["normal-error limit", ["kit", "mountFrames", 0, "constraints", "maxNormalErrorDegrees"], 4],
  ["mirror permission", ["kit", "mountFrames", 0, "constraints", "mirrorAllowed"], true],
  ["component ID", ["component", "id"], "pk1-another-socket-component"],
  ["component slot", ["component", "slotId"], "pk1-another-slot"],
  ["component family profile", ["component", "compatibilityProfile", "familyId"], "pk1-another-family"],
  ["component perspective profile", ["component", "compatibilityProfile", "perspectiveId"], "pk1-side-view"],
  ["component geometry profile", ["component", "compatibilityProfile", "geometryId"], "pk1-another-geometry"],
  ["component style profile", ["component", "compatibilityProfile", "styleId"], "pk1-another-style"],
  ["component point x", ["component", "componentFrame", "point", "x"], 0.51],
  ["component point y", ["component", "componentFrame", "point", "y"], 0.91],
  ["component normal x", ["component", "componentFrame", "normal", "x"], 0.1],
  ["component normal y", ["component", "componentFrame", "normal", "y"], -0.9],
  ["component reference scale", ["component", "componentFrame", "referenceScale"], 0.21],
  ["fragment layer", ["component", "fragments", 0, "layer"], "overlay"],
  ["fragment asset ID", ["component", "fragments", 0, "raster", "assetId"], "asset-another-part"],
  ["fragment hash", ["component", "fragments", 0, "raster", "masterSha256"], "b".repeat(64)],
  ["fragment original width", ["component", "fragments", 0, "raster", "frame", "originalWidth"], 501],
  ["fragment original height", ["component", "fragments", 0, "raster", "frame", "originalHeight"], 401],
  ["fragment trim x", ["component", "fragments", 0, "raster", "frame", "trimX"], 11],
  ["fragment trim y", ["component", "fragments", 0, "raster", "frame", "trimY"], 21],
  ["fragment trim width", ["component", "fragments", 0, "raster", "frame", "trimWidth"], 301],
  ["fragment trim height", ["component", "fragments", 0, "raster", "frame", "trimHeight"], 201]
] as const;

const gripIncludedChanges = [
  ["first mount contact x", ["kit", "mountFrames", 0, "contacts", 0, "x"], 0.81],
  ["first mount contact y", ["kit", "mountFrames", 0, "contacts", 0, "y"], 0.34],
  ["second mount contact x", ["kit", "mountFrames", 0, "contacts", 1, "x"], 0.83],
  ["second mount contact y", ["kit", "mountFrames", 0, "contacts", 1, "y"], 0.71],
  ["first mount normal x", ["kit", "mountFrames", 0, "normals", 0, "x"], 0.9],
  ["first mount normal y", ["kit", "mountFrames", 0, "normals", 0, "y"], 0.1],
  ["second mount normal x", ["kit", "mountFrames", 0, "normals", 1, "x"], 0.9],
  ["second mount normal y", ["kit", "mountFrames", 0, "normals", 1, "y"], 0.1],
  ["first component contact x", ["component", "componentFrame", "contacts", 0, "x"], 0.17],
  ["first component contact y", ["component", "componentFrame", "contacts", 0, "y"], 0.24],
  ["second component contact x", ["component", "componentFrame", "contacts", 1, "x"], 0.19],
  ["second component contact y", ["component", "componentFrame", "contacts", 1, "y"], 0.76],
  ["first component normal x", ["component", "componentFrame", "normals", 0, "x"], -0.9],
  ["first component normal y", ["component", "componentFrame", "normals", 0, "y"], 0.1],
  ["second component normal x", ["component", "componentFrame", "normals", 1, "x"], -0.9],
  ["second component normal y", ["component", "componentFrame", "normals", 1, "y"], 0.1],
  ["second fragment layer", ["component", "fragments", 1, "layer"], "overlay"],
  ["second fragment asset", ["component", "fragments", 1, "raster", "assetId"], "asset-another-front"]
] as const;

const gridIncludedChanges = [
  ["grid origin x", ["kit", "mountFrames", 0, "origin", "x"], 0.11],
  ["grid origin y", ["kit", "mountFrames", 0, "origin", "y"], 0.16],
  ["grid cell width", ["kit", "mountFrames", 0, "cellSize", "width"], 0.09],
  ["grid cell height", ["kit", "mountFrames", 0, "cellSize", "height"], 0.11],
  ["grid columns", ["kit", "mountFrames", 0, "columns"], 7],
  ["grid rows", ["kit", "mountFrames", 0, "rows"], 5],
  ["grid plane", ["kit", "mountFrames", 0, "plane"], "floor"],
  ["accepted edge type", ["kit", "mountFrames", 0, "acceptedEdgeTypes", 0], "pk1-another-edge"],
  ["component grid plane", ["component", "componentFrame", "plane"], "floor"],
  ["footprint columns", ["component", "componentFrame", "footprint", "columns"], 1],
  ["footprint rows", ["component", "componentFrame", "footprint", "rows"], 2],
  ["north edge", ["component", "componentFrame", "edgeTypes", "north"], "pk1-door"],
  ["east edge", ["component", "componentFrame", "edgeTypes", "east"], "pk1-panel"],
  ["south edge", ["component", "componentFrame", "edgeTypes", "south"], "pk1-panel"],
  ["west edge", ["component", "componentFrame", "edgeTypes", "west"], "pk1-door"]
] as const;

describe("certification fingerprint staleness", () => {
  it.each(socketIncludedChanges)("invalidates a changed %s", (_label, path, value) => {
    const changed = cloneFixture(fixtures.socket);
    setPath(changed, path, value);
    expect(fingerprintOf(changed)).not.toBe(EXPECTED_FINGERPRINTS.socket);
  });

  it.each(gripIncludedChanges)("invalidates a changed grip %s", (_label, path, value) => {
    const changed = cloneFixture(fixtures.grip);
    setPath(changed, path, value);
    expect(fingerprintOf(changed)).not.toBe(EXPECTED_FINGERPRINTS.grip);
  });

  it.each(gridIncludedChanges)("invalidates a changed %s", (_label, path, value) => {
    const changed = cloneFixture(fixtures.grid);
    setPath(changed, path, value);
    expect(fingerprintOf(changed)).not.toBe(EXPECTED_FINGERPRINTS.grid);
  });
});

describe("certificationFingerprintMatches", () => {
  it("accepts only the exact lowercase 64-character fingerprint", () => {
    const fingerprint = EXPECTED_FINGERPRINTS.socket;
    const args = [CONTEXT, SOCKET_KIT, frameOf(fixtures.socket), SOCKET_COMPONENT] as const;

    expect(certificationFingerprintMatches(...args, fingerprint)).toBe(true);
    expect(certificationFingerprintMatches(...args, fingerprint.toUpperCase())).toBe(false);
    expect(certificationFingerprintMatches(...args, fingerprint.slice(0, -1))).toBe(false);
    expect(certificationFingerprintMatches(...args, `${fingerprint}0`)).toBe(false);
    expect(certificationFingerprintMatches(...args, `${fingerprint}\n`)).toBe(false);
    expect(certificationFingerprintMatches(...args, `${"g"}${fingerprint.slice(1)}`)).toBe(false);
    expect(certificationFingerprintMatches(...args, "0".repeat(64))).toBe(false);
  });

  it("returns false rather than throwing for hostile evidence", () => {
    const proxy = new Proxy({}, {
      ownKeys() {
        throw new Error("hostile ownKeys trap");
      }
    });
    const call = () => certificationFingerprintMatches(
      proxy as never,
      SOCKET_KIT,
      frameOf(fixtures.socket),
      SOCKET_COMPONENT,
      EXPECTED_FINGERPRINTS.socket
    );

    expect(call).not.toThrow();
    expect(call()).toBe(false);
  });
});
