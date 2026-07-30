import { describe, expect, it } from "vitest";
import { snapshotPlainData } from "./plain-data";

function throwingProxy(): object {
  return new Proxy({}, {
    ownKeys() {
      throw new Error("hostile ownKeys trap");
    }
  });
}

describe("product-kit plain-data snapshot", () => {
  it("detaches ordinary frozen data without losing signed zero", () => {
    const input = Object.freeze({
      values: Object.freeze([-0, 1, "two", true, null]),
      nested: Object.freeze({ value: 3 })
    });

    const snapshot = snapshotPlainData(input);

    expect(snapshot).toEqual(input);
    expect(snapshot).not.toBe(input);
    expect(snapshot?.values).not.toBe(input.values);
    expect(Object.is(snapshot?.values[0], -0)).toBe(true);
    expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(snapshot?.values)).toBe(Array.prototype);
  });

  it.each([
    ["an object with inherited data", () => Object.create({ required: 1 })],
    ["a null-prototype object", () => Object.assign(Object.create(null), { required: 1 })],
    ["a class instance", () => new (class Data { required = 1; })()],
    ["a symbol-keyed object", () => ({ required: 1, [Symbol("extra")]: true })],
    ["a sparse array", () => {
      const value = new Array(2);
      value[0] = 1;
      return value;
    }],
    ["an array with an extra own property", () => Object.assign([1, 2], { extra: true })],
    ["an array with a caller-owned method override", () => {
      const value = [1, 2];
      Object.defineProperty(value, "map", { value: () => [], enumerable: false });
      return value;
    }],
    ["an array with a nonstandard prototype", () => {
      const value = [1, 2];
      Object.setPrototypeOf(value, Object.create(Array.prototype));
      return value;
    }]
  ])("rejects %s", (_label, createValue) => {
    expect(snapshotPlainData(createValue())).toBeNull();
  });

  it("rejects accessors without invoking them", () => {
    let reads = 0;
    const value = {};
    Object.defineProperty(value, "required", {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error("getter must not run");
      }
    });

    expect(snapshotPlainData(value)).toBeNull();
    expect(reads).toBe(0);
  });

  it("rejects accessor-based limits without invoking them", () => {
    let reads = 0;
    const limits = {};
    Object.defineProperty(limits, "maxDepth", {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error("limit getter must not run");
      }
    });

    expect(snapshotPlainData({ value: 1 }, limits)).toBeNull();
    expect(reads).toBe(0);
  });

  it("returns null rather than throwing for throwing and revoked proxies", () => {
    const revocable = Proxy.revocable({}, {});
    revocable.revoke();

    expect(() => snapshotPlainData(throwingProxy())).not.toThrow();
    expect(snapshotPlainData(throwingProxy())).toBeNull();
    expect(() => snapshotPlainData(revocable.proxy)).not.toThrow();
    expect(snapshotPlainData(revocable.proxy)).toBeNull();
  });

  it("rejects cycles and enforces traversal bounds", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    expect(snapshotPlainData(cyclic)).toBeNull();
    expect(snapshotPlainData([1, 2, 3], { maxArrayLength: 2 })).toBeNull();
    expect(snapshotPlainData({ one: 1, two: 2 }, { maxObjectProperties: 1 })).toBeNull();
    expect(snapshotPlainData({ child: { value: 1 } }, { maxDepth: 0 })).toBeNull();
    expect(snapshotPlainData({ one: 1, two: 2 }, { maxNodes: 2 })).toBeNull();
  });

  it("reapplies limits and detaches an earlier snapshot", () => {
    const first = snapshotPlainData({ child: { value: 1 } });
    expect(first).not.toBeNull();

    const second = snapshotPlainData(first);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second?.child).not.toBe(first?.child);
    expect(snapshotPlainData(first, { maxDepth: 0 })).toBeNull();
    expect(snapshotPlainData(first, { maxNodes: 1 })).toBeNull();
  });
});
