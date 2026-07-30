import { describe, expect, it } from "vitest";
import type { ProductKitRasterFrame } from "./product-kit-catalogue";
import type {
  ProductKitBaseRasterEntry,
  ProductKitComponentRasterEntry
} from "./layer-plan";
import {
  productKitRasterMatrix,
  type ProductKitRasterMatrix
} from "./product-kit-raster-matrix";

type AffineMatrix = Extract<
  ProductKitComponentRasterEntry["geometry"],
  { readonly kind: "affine" }
>["transform"]["matrix"];

const HASH = "a".repeat(64);
const PILOT_BASE_FRAME: ProductKitRasterFrame = {
  originalWidth: 400,
  originalHeight: 500,
  trimX: 127,
  trimY: 240,
  trimWidth: 146,
  trimHeight: 238
};
const PILOT_LID_FRAME: ProductKitRasterFrame = {
  originalWidth: 400,
  originalHeight: 500,
  trimX: 83,
  trimY: 80,
  trimWidth: 233,
  trimHeight: 164
};

function baseEntry(
  frame: ProductKitRasterFrame = PILOT_BASE_FRAME
): ProductKitBaseRasterEntry {
  return {
    kind: "base-raster",
    itemId: "base:pk1-tumbler-kit",
    raster: {
      assetId: "89-beverage-container-bases-r03c05",
      masterSha256: HASH,
      frame
    }
  };
}

function affineEntry(
  frame: ProductKitRasterFrame,
  matrix: AffineMatrix,
  scale = 1,
  rotationDegrees = 0
): ProductKitComponentRasterEntry {
  return {
    kind: "component-raster",
    itemId: "fragment:placement-lid:front",
    placementId: "placement-lid",
    mountFrameId: "pk1-tumbler-lid-frame",
    componentId: "pk1-flat-lid",
    raster: {
      assetId: "90-beverage-container-add-ons-r04c01",
      masterSha256: HASH,
      frame
    },
    geometry: {
      kind: "affine",
      transform: {
        matrix,
        scale,
        rotationDegrees,
        mirrored: false,
        maxNormalErrorDegrees: 0
      }
    }
  };
}

function gridEntry(
  frame: ProductKitRasterFrame,
  normalizedBounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }
): ProductKitComponentRasterEntry {
  return {
    kind: "component-raster",
    itemId: "fragment:placement-tile:overlay",
    placementId: "placement-tile",
    mountFrameId: "pk1-grid-frame",
    componentId: "pk1-grid-tile",
    raster: {
      assetId: "grid-tile",
      masterSha256: HASH,
      frame
    },
    geometry: {
      kind: "grid",
      column: 1,
      row: 2,
      normalizedBounds
    }
  };
}

function mapLocalPoint(
  matrix: ProductKitRasterMatrix,
  baseFrame: ProductKitRasterFrame,
  x: number,
  y: number
): { readonly x: number; readonly y: number } {
  const [a, b, c, d, e, f] = matrix;
  return {
    x: a * x + c * y + e + baseFrame.originalWidth / 2,
    y: b * x + d * y + f + baseFrame.originalHeight / 2
  };
}

describe("Product Kit raster matrices", () => {
  it("places the 400 by 500 pilot base from its exact trim centre", () => {
    const result = productKitRasterMatrix(PILOT_BASE_FRAME, baseEntry());

    expect(result).toEqual([1, 0, 0, 1, 0, 109]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("seats the pilot lid 30 pixels into the body rim at scale 0.7", () => {
    const lidContact = { x: 0.49875, y: 0.448 } as const;
    const baseContact = { x: 0.5, y: 0.58 } as const;
    const scale = 0.7;
    const connectorMatrix = {
      a: scale,
      b: 0,
      c: 0,
      d: scale,
      e: baseContact.x - scale * lidContact.x,
      f: baseContact.y - scale * lidContact.y
    } as const;
    const result = productKitRasterMatrix(
      PILOT_BASE_FRAME,
      affineEntry(PILOT_LID_FRAME, connectorMatrix, scale)
    );

    expect(result).not.toBeNull();
    const lidContactFromTrimCentre = {
      x: lidContact.x * PILOT_LID_FRAME.originalWidth -
        (PILOT_LID_FRAME.trimX + PILOT_LID_FRAME.trimWidth / 2),
      y: lidContact.y * PILOT_LID_FRAME.originalHeight -
        (PILOT_LID_FRAME.trimY + PILOT_LID_FRAME.trimHeight / 2)
    };
    expect(lidContactFromTrimCentre).toEqual({ x: 0, y: 62 });
    const mappedContact = mapLocalPoint(
      result!,
      PILOT_BASE_FRAME,
      lidContactFromTrimCentre.x,
      lidContactFromTrimCentre.y
    );
    expect(mappedContact.x).toBeCloseTo(200, 12);
    expect(mappedContact.y).toBeCloseTo(290, 12);
    expect(Math.hypot(result![0], result![1]) * PILOT_LID_FRAME.trimWidth)
      .toBeCloseTo(163.1, 12);
  });

  it("maps the compact carry-case handle onto the repaired socket", () => {
    const baseFrame: ProductKitRasterFrame = {
      originalWidth: 400,
      originalHeight: 500,
      trimX: 105,
      trimY: 190,
      trimWidth: 189,
      trimHeight: 159
    };
    const handleFrame: ProductKitRasterFrame = {
      originalWidth: 400,
      originalHeight: 500,
      trimX: 69,
      trimY: 100,
      trimWidth: 262,
      trimHeight: 135
    };
    const result = productKitRasterMatrix(
      baseFrame,
      affineEntry(
        handleFrame,
        { a: 0.55, b: 0, c: 0, d: 0.55, e: 0.225, f: 0.2165 },
        0.55
      )
    );

    expect(result).not.toBeNull();
    expect(result![0]).toBeCloseTo(0.55, 12);
    expect(result![1]).toBe(0);
    expect(result![2]).toBe(0);
    expect(result![3]).toBeCloseTo(0.55, 12);
    expect(result![4]).toBeCloseTo(0, 12);
    expect(result![5]).toBeCloseTo(-49.625, 12);
    const connectorFromTrimCentre = {
      x: 0.5 * handleFrame.originalWidth -
        (handleFrame.trimX + handleFrame.trimWidth / 2),
      y: 0.37 * handleFrame.originalHeight -
        (handleFrame.trimY + handleFrame.trimHeight / 2)
    };
    expect(mapLocalPoint(
      result!,
      baseFrame,
      connectorFromTrimCentre.x,
      connectorFromTrimCentre.y
    )).toEqual({ x: 200, y: 210 });
  });

  it("converts rotation correctly when source and base aspect ratios differ", () => {
    const sourceFrame: ProductKitRasterFrame = {
      originalWidth: 200,
      originalHeight: 100,
      trimX: 0,
      trimY: 0,
      trimWidth: 200,
      trimHeight: 100
    };
    const result = productKitRasterMatrix(PILOT_BASE_FRAME, affineEntry(
      sourceFrame,
      { a: 0, b: 2, c: -2, d: 0, e: 0.75, f: 0.2 },
      2,
      90
    ));

    expect(result).toEqual([0, 5, -8, 0, -300, 350]);
  });

  it("maps grid bounds as an axis-aligned normalized transform", () => {
    const sourceFrame: ProductKitRasterFrame = {
      originalWidth: 200,
      originalHeight: 100,
      trimX: 0,
      trimY: 0,
      trimWidth: 200,
      trimHeight: 100
    };

    expect(productKitRasterMatrix(PILOT_BASE_FRAME, gridEntry(sourceFrame, {
      x: 0.25,
      y: 0.125,
      width: 0.5,
      height: 0.25
    }))).toEqual([1, 0, 0, 1.25, 0, -125]);
  });

  it.each([
    ["a null base frame", null, baseEntry()],
    ["a zero original width", { ...PILOT_BASE_FRAME, originalWidth: 0 }, baseEntry()],
    ["a fractional dimension", { ...PILOT_BASE_FRAME, originalHeight: 499.5 }, baseEntry()],
    ["signed zero in a frame", { ...PILOT_BASE_FRAME, trimX: -0 }, baseEntry()],
    [
      "base trim overflow",
      { ...PILOT_BASE_FRAME, trimX: 300, trimWidth: 101 },
      baseEntry()
    ],
    [
      "source trim overflow",
      PILOT_BASE_FRAME,
      baseEntry({ ...PILOT_BASE_FRAME, trimY: 400, trimHeight: 101 })
    ]
  ])("rejects %s", (_label, baseFrame, entry) => {
    expect(productKitRasterMatrix(
      baseFrame as ProductKitRasterFrame,
      entry as ProductKitBaseRasterEntry
    )).toBeNull();
  });

  it("rejects signed zero and non-finite affine coefficients", () => {
    expect(productKitRasterMatrix(PILOT_BASE_FRAME, affineEntry(
      PILOT_LID_FRAME,
      { a: 1, b: -0, c: 0, d: 1, e: 0, f: 0 }
    ))).toBeNull();
    expect(productKitRasterMatrix(PILOT_BASE_FRAME, affineEntry(
      PILOT_LID_FRAME,
      { a: 1, b: 0, c: Number.NaN, d: 1, e: 0, f: 0 }
    ))).toBeNull();
  });

  it("rejects finite input whose derived matrix overflows", () => {
    expect(productKitRasterMatrix(PILOT_BASE_FRAME, affineEntry(
      PILOT_LID_FRAME,
      { a: Number.MAX_VALUE, b: 0, c: 0, d: 1, e: 0, f: 0 },
      Number.MAX_VALUE
    ))).toBeNull();
  });

  it("rejects malformed grid bounds and non-raster entries", () => {
    expect(productKitRasterMatrix(PILOT_BASE_FRAME, gridEntry(
      PILOT_LID_FRAME,
      { x: -0, y: 0, width: 0.5, height: 0.5 }
    ))).toBeNull();
    expect(productKitRasterMatrix(PILOT_BASE_FRAME, {
      kind: "artwork-slot",
      itemId: "artwork:pk1-tumbler-kit:0",
      index: 0,
      bounds: { x: 0, y: 0, width: 1, height: 1 }
    } as never)).toBeNull();
  });

  it("rejects hostile accessors and revoked proxies without invoking getters", () => {
    let getterReads = 0;
    const accessorFrame = { ...PILOT_BASE_FRAME } as Record<string, unknown>;
    Object.defineProperty(accessorFrame, "originalWidth", {
      enumerable: true,
      get() {
        getterReads += 1;
        throw new Error("matrix validation must not invoke caller accessors");
      }
    });
    let accessorResult: ProductKitRasterMatrix | null | undefined;
    expect(() => {
      accessorResult = productKitRasterMatrix(
        accessorFrame as unknown as ProductKitRasterFrame,
        baseEntry()
      );
    }).not.toThrow();
    expect(accessorResult).toBeNull();
    expect(getterReads).toBe(0);

    const revocable = Proxy.revocable(baseEntry(), {});
    revocable.revoke();
    let proxyResult: ProductKitRasterMatrix | null | undefined;
    expect(() => {
      proxyResult = productKitRasterMatrix(
        PILOT_BASE_FRAME,
        revocable.proxy
      );
    }).not.toThrow();
    expect(proxyResult).toBeNull();
  });

  it.each((() => {
    const affine = affineEntry(
      PILOT_LID_FRAME,
      { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
    );
    if (affine.geometry.kind !== "affine") throw new Error("invalid test fixture");
    const grid = gridEntry(PILOT_LID_FRAME, {
      x: 0,
      y: 0,
      width: 0.5,
      height: 0.5
    });
    if (grid.geometry.kind !== "grid") throw new Error("invalid test fixture");
    return [
      ["base frame", { ...PILOT_BASE_FRAME, extra: true }, baseEntry()],
      ["base entry", PILOT_BASE_FRAME, { ...baseEntry(), extra: true }],
      [
        "raster reference",
        PILOT_BASE_FRAME,
        { ...affine, raster: { ...affine.raster, extra: true } }
      ],
      [
        "source frame",
        PILOT_BASE_FRAME,
        {
          ...affine,
          raster: {
            ...affine.raster,
            frame: { ...affine.raster.frame, extra: true }
          }
        }
      ],
      [
        "affine geometry",
        PILOT_BASE_FRAME,
        { ...affine, geometry: { ...affine.geometry, extra: true } }
      ],
      [
        "resolved transform",
        PILOT_BASE_FRAME,
        {
          ...affine,
          geometry: {
            ...affine.geometry,
            transform: { ...affine.geometry.transform, extra: true }
          }
        }
      ],
      [
        "affine matrix",
        PILOT_BASE_FRAME,
        {
          ...affine,
          geometry: {
            ...affine.geometry,
            transform: {
              ...affine.geometry.transform,
              matrix: { ...affine.geometry.transform.matrix, extra: true }
            }
          }
        }
      ],
      [
        "grid bounds",
        PILOT_BASE_FRAME,
        {
          ...grid,
          geometry: {
            ...grid.geometry,
            normalizedBounds: {
              ...grid.geometry.normalizedBounds,
              extra: true
            }
          }
        }
      ]
    ] as const;
  })())("rejects extra properties on the %s", (_label, baseFrame, entry) => {
    expect(productKitRasterMatrix(
      baseFrame as ProductKitRasterFrame,
      entry as ProductKitBaseRasterEntry | ProductKitComponentRasterEntry
    )).toBeNull();
  });

  it("rejects a base entry whose valid raster frame differs from the base frame", () => {
    expect(productKitRasterMatrix(PILOT_BASE_FRAME, baseEntry({
      ...PILOT_BASE_FRAME,
      trimX: PILOT_BASE_FRAME.trimX - 1
    }))).toBeNull();
  });

  it("keeps mathematically finite extreme coefficients and translations finite", () => {
    const coefficientFrame: ProductKitRasterFrame = {
      originalWidth: 8192,
      originalHeight: 1,
      trimX: 0,
      trimY: 0,
      trimWidth: 1,
      trimHeight: 1
    };
    const coefficientResult = productKitRasterMatrix(
      coefficientFrame,
      affineEntry(coefficientFrame, {
        a: Number.MAX_VALUE,
        b: 0,
        c: 0,
        d: 1,
        e: 0,
        f: 0
      }, Number.MAX_VALUE)
    );
    expect(coefficientResult).not.toBeNull();
    expect(coefficientResult![0]).toBe(Number.MAX_VALUE);
    expect(coefficientResult![4]).toBe(Number.MAX_VALUE / 2);

    const narrowBaseFrame: ProductKitRasterFrame = {
      originalWidth: 1,
      originalHeight: 1,
      trimX: 0,
      trimY: 0,
      trimWidth: 1,
      trimHeight: 1
    };
    const wideSourceFrame: ProductKitRasterFrame = {
      originalWidth: 8192,
      originalHeight: 1,
      trimX: 4095,
      trimY: 0,
      trimWidth: 2,
      trimHeight: 1
    };
    const translationResult = productKitRasterMatrix(
      narrowBaseFrame,
      affineEntry(wideSourceFrame, {
        a: Number.MAX_VALUE,
        b: 0,
        c: 0,
        d: 1,
        e: 0,
        f: 0
      }, Number.MAX_VALUE)
    );
    expect(translationResult).not.toBeNull();
    expect(translationResult![0]).toBe(Number.MAX_VALUE / 8192);
    expect(translationResult![4]).toBe(Number.MAX_VALUE / 2);
    expect(translationResult!.every(Number.isFinite)).toBe(true);
  });

  it("cancels opposite extreme translation terms before they overflow", () => {
    const baseFrame: ProductKitRasterFrame = {
      originalWidth: 6,
      originalHeight: 3,
      trimX: 0,
      trimY: 0,
      trimWidth: 6,
      trimHeight: 3
    };
    const sourceFrame: ProductKitRasterFrame = {
      originalWidth: 3,
      originalHeight: 3,
      trimX: 0,
      trimY: 0,
      trimWidth: 3,
      trimHeight: 3
    };

    expect(productKitRasterMatrix(baseFrame, affineEntry(sourceFrame, {
      a: Number.MAX_VALUE / 2,
      b: 0,
      c: -Number.MAX_VALUE / 2,
      d: 1,
      e: 0,
      f: 0
    }, Number.MAX_VALUE / 2))).toEqual([
      Number.MAX_VALUE,
      0,
      -Number.MAX_VALUE,
      1,
      -3,
      0
    ]);
  });

  it("preserves small translation terms across exact extreme cancellation", () => {
    const frame: ProductKitRasterFrame = {
      originalWidth: 1,
      originalHeight: 1,
      trimX: 0,
      trimY: 0,
      trimWidth: 1,
      trimHeight: 1
    };

    expect(productKitRasterMatrix(frame, affineEntry(frame, {
      a: Number.MAX_VALUE,
      b: 0,
      c: 2,
      d: 1,
      e: -Number.MAX_VALUE / 2,
      f: 0
    }, Number.MAX_VALUE))).toEqual([
      Number.MAX_VALUE,
      0,
      2,
      1,
      0.5,
      0
    ]);
  });

  it("canonicalizes a one-ULP grid endpoint excess to exactly one", () => {
    const frame: ProductKitRasterFrame = {
      originalWidth: 1,
      originalHeight: 1,
      trimX: 0,
      trimY: 0,
      trimWidth: 1,
      trimHeight: 1
    };
    const x = 0.18288883638079825;
    const width = 0.8171111636192019;
    expect(x + width).toBe(1 + Number.EPSILON);

    const result = productKitRasterMatrix(frame, gridEntry(frame, {
      x,
      y: 0,
      width,
      height: 1
    }));

    expect(result).not.toBeNull();
    expect(result![0]).toBe(1 - x);
    expect(x + result![0]).toBe(1);
  });

  it("rejects material grid endpoint overflow", () => {
    const frame: ProductKitRasterFrame = {
      originalWidth: 1,
      originalHeight: 1,
      trimX: 0,
      trimY: 0,
      trimWidth: 1,
      trimHeight: 1
    };

    expect(productKitRasterMatrix(frame, gridEntry(frame, {
      x: 0.2,
      y: 0,
      width: 0.800001,
      height: 1
    }))).toBeNull();
  });
});
