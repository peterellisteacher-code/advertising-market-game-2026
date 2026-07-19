import { describe, expect, it } from "vitest";
import {
  applyTransform,
  resolveGripTransform,
  resolveSocketTransform,
  type GripFrame,
  type Point,
  type SocketFrame,
  type TransformConstraints
} from "./connector-transform";

const constraints = (overrides: Partial<TransformConstraints> = {}): TransformConstraints => ({
  minScale: 0.5,
  maxScale: 3,
  minRotationDegrees: -180,
  maxRotationDegrees: 180,
  maxNormalErrorDegrees: 2,
  mirrorAllowed: false,
  ...overrides
});

function expectPointClose(actual: Point, expected: Point): void {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
}

describe("socket connector transforms", () => {
  it("maps the authored point and uses the reference-scale ratio", () => {
    const result = resolveSocketTransform(
      { point: { x: 2, y: 3 }, normal: { x: 1, y: 0 }, referenceScale: 4 },
      { point: { x: 10, y: 20 }, normal: { x: 0, y: 1 }, referenceScale: 8 },
      constraints()
    );

    expect(result).toMatchObject({ scale: 2, rotationDegrees: 90, mirrored: false });
    expectPointClose(applyTransform(result!.matrix, { x: 2, y: 3 }), { x: 10, y: 20 });
  });

  it.each([
    ["non-finite point", { point: { x: Number.NaN, y: 0 }, normal: { x: 1, y: 0 }, referenceScale: 1 }],
    ["infinite point", { point: { x: Number.POSITIVE_INFINITY, y: 0 }, normal: { x: 1, y: 0 }, referenceScale: 1 }],
    ["zero normal", { point: { x: 0, y: 0 }, normal: { x: 0, y: 0 }, referenceScale: 1 }],
    ["negative reference scale", { point: { x: 0, y: 0 }, normal: { x: 1, y: 0 }, referenceScale: -1 }]
  ])("rejects a %s", (_label, source) => {
    expect(resolveSocketTransform(source, {
      point: { x: 1, y: 1 },
      normal: { x: 1, y: 0 },
      referenceScale: 1
    }, constraints())).toBeNull();
  });

  it("fails closed when finite inputs overflow the derived affine matrix", () => {
    expect(resolveSocketTransform({
      point: { x: Number.MAX_VALUE, y: 0 },
      normal: { x: 1, y: 0 },
      referenceScale: 1
    }, {
      point: { x: 0, y: 0 },
      normal: { x: 1, y: 0 },
      referenceScale: 2
    }, constraints())).toBeNull();
  });

  it("accepts finite non-zero normals and positive reference scales below 1e-9", () => {
    expect(resolveSocketTransform({
      point: { x: 0, y: 0 },
      normal: { x: 1e-10, y: 0 },
      referenceScale: 1e-10
    }, {
      point: { x: 1, y: 1 },
      normal: { x: 1e-10, y: 0 },
      referenceScale: 1e-10
    }, constraints())).not.toBeNull();
  });

  it("preserves a genuine tiny socket rotation across the atan2 branch cut", () => {
    expect(resolveSocketTransform({
      point: { x: 0, y: 0 },
      normal: { x: -1, y: -1e-16 },
      referenceScale: 1
    }, {
      point: { x: 0, y: 0 },
      normal: { x: -1, y: 1e-16 },
      referenceScale: 1
    }, constraints({
      minRotationDegrees: 0,
      maxRotationDegrees: 0,
      maxNormalErrorDegrees: 0
    }))).toBeNull();
  });
});

describe("two-contact grip transforms", () => {
  const source: GripFrame = {
    contacts: [{ x: 0, y: 0 }, { x: 2, y: 0 }],
    normals: [{ x: 0, y: -1 }, { x: 0, y: -1 }]
  };

  it("maps both contacts exactly and reports deterministic scale and rotation", () => {
    const result = resolveGripTransform(source, {
      contacts: [{ x: 10, y: 10 }, { x: 10, y: 14 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    }, constraints());

    expect(result).toMatchObject({ scale: 2, rotationDegrees: 90, mirrored: false });
    expectPointClose(applyTransform(result!.matrix, source.contacts[0]), { x: 10, y: 10 });
    expectPointClose(applyTransform(result!.matrix, source.contacts[1]), { x: 10, y: 14 });
  });

  it("derives three cup-size scales from the same authored handle", () => {
    const handle: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    };
    const scaleFor = (height: number) => resolveGripTransform(handle, {
      contacts: [{ x: 4, y: 2 }, { x: 4, y: 2 + height }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    }, constraints())?.scale;

    expect(scaleFor(0.8)).toBeCloseTo(0.8, 10);
    expect(scaleFor(1)).toBeCloseTo(1, 10);
    expect(scaleFor(1.25)).toBeCloseTo(1.25, 10);
  });

  it("uses mirroring only when it is permitted and normals require it", () => {
    const target: GripFrame = {
      contacts: [{ x: 10, y: 10 }, { x: 8, y: 10 }],
      normals: [{ x: 0, y: -1 }, { x: 0, y: -1 }]
    };

    expect(resolveGripTransform(source, target, constraints())).toBeNull();
    expect(resolveGripTransform(source, target, constraints({ mirrorAllowed: true })))
      .toMatchObject({ mirrored: true, rotationDegrees: 0, scale: 1 });
  });

  it("fails closed for degenerate frames and breached scale or rotation limits", () => {
    const degenerate: GripFrame = {
      contacts: [{ x: 1, y: 1 }, { x: 1, y: 1 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    };
    expect(resolveGripTransform(degenerate, source, constraints())).toBeNull();
    expect(resolveGripTransform(source, {
      contacts: [{ x: 0, y: 0 }, { x: 8, y: 0 }],
      normals: source.normals
    }, constraints({ maxScale: 2 }))).toBeNull();
    expect(resolveGripTransform(source, {
      contacts: [{ x: 0, y: 0 }, { x: 0, y: 2 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    }, constraints({ minRotationDegrees: -30, maxRotationDegrees: 30 }))).toBeNull();
  });

  it("rejects invalid bounds and normals outside the authored tolerance", () => {
    const target: GripFrame = {
      contacts: source.contacts,
      normals: [
        { x: Math.sin(Math.PI / 180), y: -Math.cos(Math.PI / 180) },
        { x: Math.sin(Math.PI / 180), y: -Math.cos(Math.PI / 180) }
      ]
    };

    expect(resolveGripTransform(source, target, constraints({ minScale: 2, maxScale: 1 })))
      .toBeNull();
    expect(resolveGripTransform(source, target, constraints({
      minRotationDegrees: 20,
      maxRotationDegrees: -20
    }))).toBeNull();
    expect(resolveGripTransform(source, target, constraints({ maxNormalErrorDegrees: 0.5 })))
      .toBeNull();
    expect(resolveGripTransform(source, target, constraints({ maxNormalErrorDegrees: 1.1 })))
      .not.toBeNull();
  });

  it("does not mutate frozen source, target or constraints", () => {
    const frozenSource = Object.freeze({
      contacts: Object.freeze([
        Object.freeze({ x: 0, y: 0 }),
        Object.freeze({ x: 2, y: 0 })
      ]),
      normals: Object.freeze([
        Object.freeze({ x: 0, y: -1 }),
        Object.freeze({ x: 0, y: -1 })
      ])
    }) as GripFrame;
    const frozenTarget = Object.freeze({
      contacts: Object.freeze([
        Object.freeze({ x: 3, y: 4 }),
        Object.freeze({ x: 5, y: 4 })
      ]),
      normals: Object.freeze([
        Object.freeze({ x: 0, y: -1 }),
        Object.freeze({ x: 0, y: -1 })
      ])
    }) as GripFrame;
    const frozenConstraints = Object.freeze(constraints());
    const before = JSON.stringify([frozenSource, frozenTarget, frozenConstraints]);

    expect(resolveGripTransform(frozenSource, frozenTarget, frozenConstraints)).not.toBeNull();
    expect(JSON.stringify([frozenSource, frozenTarget, frozenConstraints])).toBe(before);
  });

  it("normalizes very large finite vectors without understating their angular error", () => {
    const largePositive = { x: 1e308, y: Number.MAX_VALUE };
    const largeNegative = { x: 1e308, y: -Number.MAX_VALUE };
    const target: GripFrame = {
      contacts: source.contacts,
      normals: [largeNegative, largeNegative]
    };

    expect(resolveGripTransform({
      contacts: source.contacts,
      normals: [largePositive, largePositive]
    }, target, constraints({ maxNormalErrorDegrees: 100 }))).toBeNull();
  });

  it("accepts exact oblique normal alignment at a zero-degree tolerance", () => {
    const oblique: GripFrame = {
      contacts: source.contacts,
      normals: [{ x: 1, y: 1 }, { x: 1, y: 1 }]
    };

    expect(resolveGripTransform(
      oblique,
      oblique,
      constraints({ maxNormalErrorDegrees: 0 })
    )).not.toBeNull();
  });

  it("accepts distinct finite contacts below an absolute 1e-9 separation", () => {
    const tiny: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: 1e-10, y: 0 }],
      normals: [{ x: 0, y: -1e-10 }, { x: 0, y: -1e-10 }]
    };

    expect(resolveGripTransform(tiny, tiny, constraints())).toMatchObject({ scale: 1 });
  });

  it("accepts an identity transform for equal large finite spans", () => {
    const large: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: Number.MAX_VALUE, y: Number.MAX_VALUE }],
      normals: [{ x: 0, y: -1 }, { x: 0, y: -1 }]
    };

    expect(resolveGripTransform(large, large, constraints())).toMatchObject({
      scale: 1,
      rotationDegrees: 0,
      mirrored: false
    });
  });

  it("accepts a finite huge grip scale without an overflowing intermediate", () => {
    const exponentUnit = 2 ** 1023;
    const sourceContact = { x: 2 ** -3, y: 2 ** -1 };
    const hugeSource: GripFrame = {
      contacts: [{ x: 0, y: 0 }, sourceContact],
      normals: [{ x: 1, y: 4 }, { x: 1, y: 4 }]
    };
    const hugeTarget: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: exponentUnit, y: 0 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    };
    const result = resolveGripTransform(hugeSource, hugeTarget, constraints({
      minScale: Number.MIN_VALUE,
      maxScale: Number.MAX_VALUE
    }));

    expect(result).not.toBeNull();
    expect(hugeTarget.contacts[1].x / sourceContact.y).toBe(Number.POSITIVE_INFINITY);
    const expectedScale = hugeTarget.contacts[1].x /
      Math.hypot(sourceContact.x, sourceContact.y);
    expect(Math.abs(result!.scale - expectedScale) / expectedScale)
      .toBeLessThanOrEqual(Number.EPSILON * 4);
    expect(Object.values(result!.matrix).every(Number.isFinite)).toBe(true);
    for (let index = 0; index < 2; index += 1) {
      const mapped = applyTransform(result!.matrix, hugeSource.contacts[index]!);
      const target = hugeTarget.contacts[index]!;
      expect(Math.abs(mapped.x - target.x)).toBeLessThanOrEqual(1e-8);
      expect(Math.abs(mapped.y - target.y)).toBeLessThanOrEqual(1e-8);
    }
  });

  it("rejects an extreme transform whose absolute contact residual exceeds 1e-8", () => {
    const offsetSource: GripFrame = {
      contacts: [{ x: 1e16, y: 1e16 }, { x: 1e16 + 2, y: 1e16 }],
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    };
    const offsetTarget: GripFrame = {
      contacts: [{ x: 1e16, y: 1e16 }, { x: 1e16 + 2, y: 1e16 + 2 }],
      normals: [
        { x: Math.SQRT1_2, y: Math.SQRT1_2 },
        { x: Math.SQRT1_2, y: Math.SQRT1_2 }
      ]
    };

    expect(resolveGripTransform(
      offsetSource,
      offsetTarget,
      constraints({ maxNormalErrorDegrees: 1 })
    )).toBeNull();
  });

  it("keeps the tiny rotation across the span-angle branch cut", () => {
    const sourceAcrossCut: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: -1e8, y: -1e-9 }],
      normals: [{ x: 0, y: -1 }, { x: 0, y: -1 }]
    };
    const targetAcrossCut: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: -1e8, y: 1e-9 }],
      normals: [{ x: 0, y: -1 }, { x: 0, y: -1 }]
    };

    const result = resolveGripTransform(sourceAcrossCut, targetAcrossCut, constraints());
    expect(result).not.toBeNull();
    expect(result?.mirrored).toBe(false);
    expect(result?.rotationDegrees).toBeCloseTo(0, 10);
    expectPointClose(
      applyTransform(result!.matrix, sourceAcrossCut.contacts[1]),
      targetAcrossCut.contacts[1]
    );
  });

  it("accepts exact rotated normal alignment at a zero-degree tolerance", () => {
    const rotatedSource: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      normals: [{ x: 2, y: 1 }, { x: 2, y: 1 }]
    };
    const rotatedTarget: GripFrame = {
      contacts: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
      normals: [{ x: -1, y: 2 }, { x: -1, y: 2 }]
    };

    expect(resolveGripTransform(
      rotatedSource,
      rotatedTarget,
      constraints({ maxNormalErrorDegrees: 0 })
    )).toMatchObject({ rotationDegrees: 90, mirrored: false });
  });

  it("does not erase a genuine tiny normal mismatch at zero tolerance", () => {
    const alignedSource: GripFrame = {
      contacts: source.contacts,
      normals: [{ x: 1, y: 0 }, { x: 1, y: 0 }]
    };
    const mismatchedTarget: GripFrame = {
      contacts: source.contacts,
      normals: [{ x: 1, y: 1e-16 }, { x: 1, y: 1e-16 }]
    };

    expect(resolveGripTransform(
      alignedSource,
      mismatchedTarget,
      constraints({ maxNormalErrorDegrees: 0 })
    )).toBeNull();
  });

  it("does not erase a tiny grip-normal mismatch across the atan2 branch cut", () => {
    const branchSource: GripFrame = {
      contacts: source.contacts,
      normals: [{ x: -1, y: -1e-16 }, { x: -1, y: -1e-16 }]
    };
    const branchTarget: GripFrame = {
      contacts: source.contacts,
      normals: [{ x: -1, y: 1e-16 }, { x: -1, y: 1e-16 }]
    };

    expect(resolveGripTransform(
      branchSource,
      branchTarget,
      constraints({ maxNormalErrorDegrees: 0 })
    )).toBeNull();
  });
});

describe("connector structural fail-closed guards", () => {
  const socket: SocketFrame = {
    point: { x: 0, y: 0 },
    normal: { x: 1, y: 0 },
    referenceScale: 1
  };
  const grip: GripFrame = {
    contacts: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    normals: [{ x: 0, y: -1 }, { x: 0, y: -1 }]
  };

  it("returns null for null socket/grip frames or constraints", () => {
    expect(resolveSocketTransform(null as never, socket, constraints())).toBeNull();
    expect(resolveSocketTransform(socket, null as never, constraints())).toBeNull();
    expect(resolveSocketTransform(socket, socket, null as never)).toBeNull();
    expect(resolveGripTransform(null as never, grip, constraints())).toBeNull();
    expect(resolveGripTransform(grip, null as never, constraints())).toBeNull();
    expect(resolveGripTransform(grip, grip, null as never)).toBeNull();
  });

  it("rejects grip arrays with anything other than exactly two entries", () => {
    expect(resolveGripTransform({
      ...grip,
      contacts: [...grip.contacts, { x: 2, y: 0 }]
    } as never, grip, constraints())).toBeNull();
    expect(resolveGripTransform({
      ...grip,
      normals: [...grip.normals, { x: 0, y: -1 }]
    } as never, grip, constraints())).toBeNull();
  });

  it.each(["contacts", "normals"] as const)(
    "returns null without throwing for a length-two sparse %s array",
    (field) => {
      const sparse = new Array(2);
      sparse[0] = grip[field][0];
      const malformed = { ...grip, [field]: sparse } as GripFrame;
      const resolve = () => resolveGripTransform(malformed, grip, constraints());

      expect(resolve).not.toThrow();
      expect(resolve()).toBeNull();
    }
  );

  it("rejects signed zero at connector numeric boundaries", () => {
    expect(resolveSocketTransform({
      ...socket,
      point: { x: -0, y: 0 }
    }, socket, constraints())).toBeNull();
    expect(resolveGripTransform({
      ...grip,
      normals: [{ x: -0, y: -1 }, { x: 0, y: -1 }]
    }, grip, constraints())).toBeNull();
    expect(resolveSocketTransform(
      socket,
      socket,
      constraints({ maxNormalErrorDegrees: -0 })
    )).toBeNull();
  });

  it("accepts valid structural frame subtypes carrying parsed mount metadata", () => {
    const socketMount = {
      ...socket,
      id: "pk1-socket-frame",
      slotId: "pk1-lid-slot",
      mountType: "socket" as const,
      constraints: constraints()
    };
    const gripMount = {
      ...grip,
      id: "pk1-grip-frame",
      slotId: "pk1-handle-slot",
      mountType: "grip" as const,
      constraints: constraints()
    };

    expect(resolveSocketTransform(socket, socketMount, constraints())).not.toBeNull();
    expect(resolveGripTransform(grip, gripMount, constraints())).not.toBeNull();
  });

  it("returns null without invoking hostile proxy, accessor, or array methods", () => {
    const proxy = new Proxy({}, {
      get() {
        throw new Error("hostile get trap");
      }
    });
    let accessorReads = 0;
    const accessorFrame = { ...socket } as Record<string, unknown>;
    Object.defineProperty(accessorFrame, "point", {
      enumerable: true,
      get() {
        accessorReads += 1;
        throw new Error("hostile getter");
      }
    });
    const normals = [...grip.normals];
    Object.defineProperty(normals, "map", {
      value: () => { throw new Error("caller-owned map"); },
      enumerable: false
    });

    const calls = [
      () => resolveSocketTransform(proxy as never, socket, constraints()),
      () => resolveSocketTransform(accessorFrame as never, socket, constraints()),
      () => resolveSocketTransform(Object.create(socket) as never, socket, constraints()),
      () => resolveGripTransform({ ...grip, normals } as never, grip, constraints()),
      () => resolveGripTransform(grip, proxy as never, constraints()),
      () => resolveGripTransform(grip, grip, proxy as never)
    ];
    for (const call of calls) {
      expect(call).not.toThrow();
      expect(call()).toBeNull();
    }
    expect(accessorReads).toBe(0);
  });
});
