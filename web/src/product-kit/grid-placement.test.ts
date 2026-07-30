import { describe, expect, it } from "vitest";
import type {
  ProductKitComponent,
  ProductKitMountFrame,
  ProductKitPoint
} from "./product-kit-catalogue";
import {
  createProductKitGridOccupancy,
  snapProductKitGridCell,
  type ProductKitGridTile
} from "./grid-placement";

type GridMountFrame = Extract<ProductKitMountFrame, { readonly mountType: "grid" }>;

function gridFrame(overrides: Partial<GridMountFrame> = {}): GridMountFrame {
  return {
    id: "pk1-grid-frame",
    slotId: "pk1-grid-slot",
    mountType: "grid",
    origin: { x: 0, y: 0 },
    cellSize: { width: 0.25, height: 0.25 },
    columns: 4,
    rows: 4,
    plane: "floor",
    acceptedEdgeTypes: ["pk1-door", "pk1-panel"],
    ...overrides
  };
}

function gridComponent(
  plane: "floor" | "wall" = "floor",
  footprint: { readonly columns: number; readonly rows: number } = {
    columns: 1,
    rows: 1
  },
  edgeTypes: {
    readonly north?: string;
    readonly east?: string;
    readonly south?: string;
    readonly west?: string;
  } = {}
): ProductKitComponent {
  return {
    id: "pk1-grid-component",
    title: "Grid component",
    slotId: "pk1-grid-slot",
    compatibilityProfile: {
      familyId: "pk1-grid-family",
      perspectiveId: "pk1-grid-perspective",
      geometryId: "pk1-grid-geometry",
      styleId: "pk1-grid-style"
    },
    componentFrame: {
      mountType: "grid",
      plane,
      footprint,
      edgeTypes
    },
    fragments: [{
      layer: "front",
      raster: {
        assetId: "asset-grid-component",
        masterSha256: "a".repeat(64),
        frame: {
          originalWidth: 10,
          originalHeight: 10,
          trimX: 0,
          trimY: 0,
          trimWidth: 10,
          trimHeight: 10
        }
      }
    }],
    priceAssetId: "pk1-grid-component-price"
  };
}

function gridTile(
  placementId: string,
  column: number,
  row: number,
  overrides: Partial<ProductKitGridTile> = {}
): ProductKitGridTile {
  return {
    placementId,
    componentId: `pk1-component-${placementId}`,
    column,
    row,
    footprint: { columns: 1, rows: 1 },
    edgeTypes: {},
    ...overrides
  };
}

describe("snapProductKitGridCell", () => {
  it("snaps floor top-left ties east and south", () => {
    const desiredTopLeft: ProductKitPoint = { x: 0.125, y: 0.375 };

    expect(snapProductKitGridCell(
      gridFrame(),
      gridComponent(),
      desiredTopLeft
    )).toEqual({ column: 1, row: 2 });
  });

  it("snaps wall top-left coordinates when the planes match", () => {
    expect(snapProductKitGridCell(
      gridFrame({
        origin: { x: 0.125, y: 0.125 },
        cellSize: { width: 0.125, height: 0.125 },
        plane: "wall"
      }),
      gridComponent("wall"),
      { x: 0.3125, y: 0.1875 }
    )).toEqual({ column: 2, row: 1 });
  });

  it.each(["floor", "wall"] as const)(
    "treats computed decimal half-cells as east/south ties on a %s grid",
    (plane) => {
      const frame = gridFrame({
        origin: { x: 0.1, y: 0.1 },
        cellSize: { width: 0.1, height: 0.1 },
        plane
      });
      const tie = frame.origin.x + frame.cellSize.width * 1.5;

      expect(snapProductKitGridCell(
        frame,
        gridComponent(plane),
        { x: tie, y: tie }
      )).toEqual({ column: 2, row: 2 });
    }
  );

  it("distinguishes the adjacent floats around a computed decimal midpoint", () => {
    const frame = gridFrame({
      origin: { x: 0.1, y: 0.1 },
      cellSize: { width: 0.1, height: 0.1 }
    });
    const tie = frame.origin.x + frame.cellSize.width * 1.5;
    const values = new Float64Array([tie]);
    const bits = new BigUint64Array(values.buffer);
    bits[0] = bits[0]! - 1n;
    const below = values[0]!;
    bits[0] = bits[0]! + 2n;
    const above = values[0]!;

    expect(snapProductKitGridCell(
      frame,
      gridComponent(),
      { x: below, y: below }
    )).toEqual({ column: 1, row: 1 });
    expect(snapProductKitGridCell(
      frame,
      gridComponent(),
      { x: tie, y: tie }
    )).toEqual({ column: 2, row: 2 });
    expect(snapProductKitGridCell(
      frame,
      gridComponent(),
      { x: above, y: above }
    )).toEqual({ column: 2, row: 2 });
  });

  it("rejects a floor and wall plane mismatch", () => {
    expect(snapProductKitGridCell(
      gridFrame({ plane: "wall" }),
      gridComponent("floor"),
      { x: 0, y: 0 }
    )).toBeNull();
  });

  it.each([
    [Number.NaN, 0],
    [0, Number.POSITIVE_INFINITY]
  ])("rejects a non-finite desired top-left (%s, %s)", (x, y) => {
    expect(snapProductKitGridCell(
      gridFrame(),
      gridComponent(),
      { x, y }
    )).toBeNull();
  });

  it("rejects a desired top-left outside the grid before rounding", () => {
    expect(snapProductKitGridCell(
      gridFrame({ origin: { x: 0.25, y: 0.25 }, columns: 2, rows: 2 }),
      gridComponent(),
      { x: 0.24, y: 0.25 }
    )).toBeNull();
  });

  it("rejects a snapped footprint that overflows the grid", () => {
    expect(snapProductKitGridCell(
      gridFrame(),
      gridComponent("floor", { columns: 2, rows: 2 }),
      { x: 0.75, y: 0.75 }
    )).toBeNull();
  });

  it.each([
    ["unsafe frame columns", gridFrame({ columns: Number.MAX_SAFE_INTEGER + 1 }), gridComponent()],
    ["fractional footprint", gridFrame(), gridComponent("floor", { columns: 1.5, rows: 1 })],
    ["zero cell width", gridFrame({ cellSize: { width: 0, height: 0.25 } }), gridComponent()],
    ["grid beyond normalized bounds", gridFrame({
      origin: { x: 0.9, y: 0 },
      cellSize: { width: 0.25, height: 0.25 },
      columns: 1
    }), gridComponent()]
  ])("rejects %s", (_label, frame, component) => {
    expect(snapProductKitGridCell(frame, component, frame.origin)).toBeNull();
  });

  it("returns a frozen cell detached from the desired point", () => {
    const desiredTopLeft = { x: 0, y: 0 };
    const result = snapProductKitGridCell(
      gridFrame(),
      gridComponent(),
      desiredTopLeft
    );

    expect(result).toEqual({ column: 0, row: 0 });
    expect(result).not.toBe(desiredTopLeft);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("returns null rather than invoking hostile snap inputs", () => {
    const proxy = new Proxy({}, {
      get() {
        throw new Error("hostile get trap");
      }
    });
    const inheritedPoint = Object.create({ x: 0.125, y: 0.125 });
    const calls = [
      () => snapProductKitGridCell(proxy as never, gridComponent(), { x: 0, y: 0 }),
      () => snapProductKitGridCell(gridFrame(), proxy as never, { x: 0, y: 0 }),
      () => snapProductKitGridCell(gridFrame(), gridComponent(), proxy as never),
      () => snapProductKitGridCell(gridFrame(), gridComponent(), inheritedPoint)
    ];

    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
  });
});

describe("createProductKitGridOccupancy", () => {
  it("returns row-major cells and deterministic placement order", () => {
    const result = createProductKitGridOccupancy(
      gridFrame({ rows: 3 }),
      [
        gridTile("c", 2, 1, { footprint: { columns: 2, rows: 1 } }),
        gridTile("b", 1, 0),
        gridTile("a", 0, 2)
      ]
    );

    expect(result).toEqual({
      columns: 4,
      rows: 3,
      cells: [
        null, "b", null, null,
        null, null, "c", "c",
        "a", null, null, null
      ],
      placements: [
        gridTile("b", 1, 0),
        gridTile("c", 2, 1, { footprint: { columns: 2, rows: 1 } }),
        gridTile("a", 0, 2)
      ]
    });
  });

  it("rejects duplicate placement IDs even when the tiles do not overlap", () => {
    expect(createProductKitGridOccupancy(gridFrame(), [
      gridTile("duplicate", 0, 0),
      gridTile("duplicate", 3, 3)
    ])).toBeNull();
  });

  it.each([
    ["fractional column", gridTile("bad", 0.5, 0)],
    ["fractional row", gridTile("bad", 0, 0.5)],
    ["unsafe column", gridTile("bad", Number.MAX_SAFE_INTEGER + 1, 0)],
    ["fractional footprint columns", gridTile("bad", 0, 0, {
      footprint: { columns: 1.5, rows: 1 }
    })],
    ["fractional footprint rows", gridTile("bad", 0, 0, {
      footprint: { columns: 1, rows: 1.5 }
    })]
  ])("rejects %s", (_label, placement) => {
    expect(createProductKitGridOccupancy(gridFrame(), [placement])).toBeNull();
  });

  it.each([
    ["negative column", gridTile("bad", -1, 0)],
    ["negative row", gridTile("bad", 0, -1)],
    ["zero footprint", gridTile("bad", 0, 0, {
      footprint: { columns: 0, rows: 1 }
    })],
    ["footprint wider than the frame", gridTile("bad", 0, 0, {
      footprint: { columns: 5, rows: 1 }
    })],
    ["column plus footprint overflow", gridTile("bad", 3, 0, {
      footprint: { columns: 2, rows: 1 }
    })],
    ["row plus footprint overflow", gridTile("bad", 0, 3, {
      footprint: { columns: 1, rows: 2 }
    })]
  ])("rejects out-of-bounds geometry: %s", (_label, placement) => {
    expect(createProductKitGridOccupancy(gridFrame(), [placement])).toBeNull();
  });

  it("rejects overlapping footprints", () => {
    expect(createProductKitGridOccupancy(gridFrame(), [
      gridTile("large", 0, 0, { footprint: { columns: 2, rows: 2 } }),
      gridTile("overlap", 1, 1)
    ])).toBeNull();
  });

  it("accepts a tile only when every declared edge is accepted by the frame", () => {
    expect(createProductKitGridOccupancy(gridFrame(), [
      gridTile("accepted", 1, 1, {
        edgeTypes: {
          north: "pk1-door",
          east: "pk1-panel",
          south: "pk1-door",
          west: "pk1-panel"
        }
      })
    ])).not.toBeNull();

    expect(createProductKitGridOccupancy(gridFrame(), [
      gridTile("rejected", 1, 1, {
        edgeTypes: { east: "pk1-unaccepted" }
      })
    ])).toBeNull();
  });

  it("rejects a non-string declared edge at runtime", () => {
    const malformed = gridTile("malformed", 0, 0, {
      edgeTypes: { north: null as unknown as string }
    });

    expect(createProductKitGridOccupancy(gridFrame(), [malformed])).toBeNull();
  });

  it("rejects unknown edge directions instead of silently dropping them", () => {
    const malformed = gridTile("malformed", 0, 0);
    (malformed.edgeTypes as Record<string, string>).diagonal = "pk1-door";

    expect(createProductKitGridOccupancy(gridFrame(), [malformed])).toBeNull();
  });

  it("rejects an array-shaped edge map instead of normalising it to empty", () => {
    const malformed = gridTile("malformed", 0, 0, {
      edgeTypes: [] as unknown as ProductKitGridTile["edgeTypes"]
    });

    expect(createProductKitGridOccupancy(gridFrame(), [malformed])).toBeNull();
  });

  it("rejects an accepted-edge list that is not sorted and unique", () => {
    expect(createProductKitGridOccupancy(
      gridFrame({ acceptedEdgeTypes: ["pk1-panel", "pk1-door"] }),
      []
    )).toBeNull();
    expect(createProductKitGridOccupancy(
      gridFrame({ acceptedEdgeTypes: ["pk1-door", "pk1-door"] }),
      []
    )).toBeNull();
  });

  it("rejects sparse accepted-edge and placement arrays without throwing", () => {
    const sparseEdges = new Array<string>(2);
    sparseEdges[0] = "pk1-door";
    const sparsePlacements = new Array<ProductKitGridTile>(1);
    const resolveEdges = () => createProductKitGridOccupancy(
      gridFrame({ acceptedEdgeTypes: sparseEdges }),
      []
    );
    const resolvePlacements = () => createProductKitGridOccupancy(
      gridFrame(),
      sparsePlacements
    );

    expect(resolveEdges).not.toThrow();
    expect(resolveEdges()).toBeNull();
    expect(resolvePlacements).not.toThrow();
    expect(resolvePlacements()).toBeNull();
  });

  it("returns null rather than invoking hostile occupancy inputs", () => {
    const proxy = new Proxy({}, {
      get() {
        throw new Error("hostile get trap");
      }
    });
    const placements = [gridTile("one", 0, 0)];
    Object.defineProperty(placements, "sort", {
      value: () => { throw new Error("caller-owned sort"); },
      enumerable: false
    });
    const calls = [
      () => createProductKitGridOccupancy(proxy as never, []),
      () => createProductKitGridOccupancy(gridFrame(), proxy as never),
      () => createProductKitGridOccupancy(gridFrame(), placements)
    ];

    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
  });

  it.each([
    [
      "east/west",
      gridTile("left", 0, 0, { edgeTypes: { east: "pk1-door" } }),
      gridTile("right", 1, 0, { edgeTypes: { west: "pk1-door" } })
    ],
    [
      "south/north",
      gridTile("top", 0, 0, { edgeTypes: { south: "pk1-panel" } }),
      gridTile("bottom", 0, 1, { edgeTypes: { north: "pk1-panel" } })
    ],
    [
      "both absent",
      gridTile("left", 0, 0),
      gridTile("right", 1, 0)
    ],
    [
      "partial rectangle side",
      gridTile("large", 0, 0, {
        footprint: { columns: 2, rows: 2 },
        edgeTypes: { east: "pk1-door" }
      }),
      gridTile("small", 2, 1, { edgeTypes: { west: "pk1-door" } })
    ]
  ])("allows exact %s touching-edge compatibility", (_label, first, second) => {
    expect(createProductKitGridOccupancy(gridFrame(), [first, second])).not.toBeNull();
  });

  it.each([
    [
      "east only",
      gridTile("left", 0, 0, { edgeTypes: { east: "pk1-door" } }),
      gridTile("right", 1, 0)
    ],
    [
      "west only",
      gridTile("left", 0, 0),
      gridTile("right", 1, 0, { edgeTypes: { west: "pk1-door" } })
    ],
    [
      "different east/west edges",
      gridTile("left", 0, 0, { edgeTypes: { east: "pk1-door" } }),
      gridTile("right", 1, 0, { edgeTypes: { west: "pk1-panel" } })
    ],
    [
      "south only",
      gridTile("top", 0, 0, { edgeTypes: { south: "pk1-door" } }),
      gridTile("bottom", 0, 1)
    ],
    [
      "north only",
      gridTile("top", 0, 0),
      gridTile("bottom", 0, 1, { edgeTypes: { north: "pk1-door" } })
    ],
    [
      "different south/north edges",
      gridTile("top", 0, 0, { edgeTypes: { south: "pk1-door" } }),
      gridTile("bottom", 0, 1, { edgeTypes: { north: "pk1-panel" } })
    ]
  ])("rejects touching rectangles with %s", (_label, first, second) => {
    expect(createProductKitGridOccupancy(gridFrame(), [first, second])).toBeNull();
  });

  it("does not impose edge compatibility on diagonal contact", () => {
    expect(createProductKitGridOccupancy(gridFrame(), [
      gridTile("north-west", 0, 0, {
        edgeTypes: { east: "pk1-door", south: "pk1-door" }
      }),
      gridTile("south-east", 1, 1, {
        edgeTypes: { north: "pk1-panel", west: "pk1-panel" }
      })
    ])).not.toBeNull();
  });

  it("does not invent an outer-boundary edge rule", () => {
    expect(createProductKitGridOccupancy(
      gridFrame({ columns: 2, rows: 2 }),
      [gridTile("boundary", 0, 0, {
        footprint: { columns: 2, rows: 2 },
        edgeTypes: {
          north: "pk1-door",
          east: "pk1-door",
          south: "pk1-door",
          west: "pk1-door"
        }
      })]
    )).not.toBeNull();
  });

  it("returns a detached deeply frozen occupancy without mutating input order", () => {
    const late = gridTile("late", 2, 2);
    const early = gridTile("early", 0, 0, {
      edgeTypes: { north: "pk1-door" }
    });
    const input: ProductKitGridTile[] = [late, early];

    const result = createProductKitGridOccupancy(gridFrame(), input);

    expect(result).not.toBeNull();
    expect(input.map(({ placementId }) => placementId)).toEqual(["late", "early"]);
    expect(result!.placements.map(({ placementId }) => placementId)).toEqual([
      "early",
      "late"
    ]);
    expect(result!.placements).not.toBe(input);
    expect(result!.placements[0]).not.toBe(early);
    expect(result!.placements[0]!.footprint).not.toBe(early.footprint);
    expect(result!.placements[0]!.edgeTypes).not.toBe(early.edgeTypes);

    (early as { placementId: string }).placementId = "mutated";
    (early.footprint as { columns: number }).columns = 3;
    (early.edgeTypes as { north?: string }).north = "pk1-panel";
    expect(result!.placements[0]).toMatchObject({
      placementId: "early",
      footprint: { columns: 1, rows: 1 },
      edgeTypes: { north: "pk1-door" }
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result!.cells)).toBe(true);
    expect(Object.isFrozen(result!.placements)).toBe(true);
    expect(Object.isFrozen(result!.placements[0])).toBe(true);
    expect(Object.isFrozen(result!.placements[0]!.footprint)).toBe(true);
    expect(Object.isFrozen(result!.placements[0]!.edgeTypes)).toBe(true);
  });

  it("is deterministic across placement input order", () => {
    const first = gridTile("first", 0, 0);
    const second = gridTile("second", 2, 2);

    expect(createProductKitGridOccupancy(gridFrame(), [first, second])).toEqual(
      createProductKitGridOccupancy(gridFrame(), [second, first])
    );
  });
});
