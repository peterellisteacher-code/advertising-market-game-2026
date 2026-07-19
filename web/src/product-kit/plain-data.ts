export interface PlainDataSnapshotLimits {
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly maxArrayLength: number;
  readonly maxObjectProperties: number;
  readonly maxStringLength: number;
}

const DEFAULT_LIMITS: PlainDataSnapshotLimits = Object.freeze({
  maxDepth: 64,
  maxNodes: 1_000_000,
  maxArrayLength: 131_072,
  maxObjectProperties: 128,
  maxStringLength: 1_000_000
});

const FAILURE = Symbol("plain-data-snapshot-failure");

const arrayIsArray = Array.isArray;
const defineProperty = Object.defineProperty;
const freeze = Object.freeze;
const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors;
const getPrototypeOf = Object.getPrototypeOf;
const hasOwnProperty = Object.prototype.hasOwnProperty;
const reflectApply = Reflect.apply;
const reflectOwnKeys = Reflect.ownKeys;

interface SnapshotState {
  readonly limits: PlainDataSnapshotLimits;
  readonly active: WeakSet<object>;
  readonly clones: WeakMap<object, object>;
  nodes: number;
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return reflectApply(hasOwnProperty, value, [key]) as boolean;
}

function validLimit(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function resolveLimits(
  overrides: Partial<PlainDataSnapshotLimits> | undefined
): PlainDataSnapshotLimits | null {
  if (overrides === undefined) return DEFAULT_LIMITS;
  try {
    if (overrides === null || typeof overrides !== "object" ||
      arrayIsArray(overrides) || getPrototypeOf(overrides) !== Object.prototype) {
      return null;
    }
    const descriptors = getOwnPropertyDescriptors(overrides);
    const keys = reflectOwnKeys(descriptors);
    if (keys.length > 5) return null;
    const limits = {
      maxDepth: DEFAULT_LIMITS.maxDepth,
      maxNodes: DEFAULT_LIMITS.maxNodes,
      maxArrayLength: DEFAULT_LIMITS.maxArrayLength,
      maxObjectProperties: DEFAULT_LIMITS.maxObjectProperties,
      maxStringLength: DEFAULT_LIMITS.maxStringLength
    };
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (typeof key !== "string") return null;
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable ||
        !validLimit(descriptor.value)) return null;
      if (key === "maxDepth") limits.maxDepth = descriptor.value;
      else if (key === "maxNodes") limits.maxNodes = descriptor.value;
      else if (key === "maxArrayLength") limits.maxArrayLength = descriptor.value;
      else if (key === "maxObjectProperties") {
        limits.maxObjectProperties = descriptor.value;
      } else if (key === "maxStringLength") limits.maxStringLength = descriptor.value;
      else return null;
    }
    return limits;
  } catch {
    return null;
  }
}

function recordNode(state: SnapshotState): boolean {
  state.nodes += 1;
  return state.nodes <= state.limits.maxNodes;
}

function cloneArray(
  value: readonly unknown[],
  depth: number,
  state: SnapshotState
): readonly unknown[] | typeof FAILURE {
  if (getPrototypeOf(value) !== Array.prototype) return FAILURE;
  const lengthDescriptor = getOwnPropertyDescriptor(value, "length");
  if (!lengthDescriptor || !("value" in lengthDescriptor) ||
    !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0 ||
    lengthDescriptor.value > state.limits.maxArrayLength) return FAILURE;
  const length = lengthDescriptor.value as number;
  const descriptors = getOwnPropertyDescriptors(value);
  const keys = reflectOwnKeys(descriptors);
  if (keys.length !== length + 1 || !hasOwn(descriptors, "length")) return FAILURE;

  const clone: unknown[] = new Array(length);
  state.clones.set(value, clone);
  state.active.add(value);
  for (let index = 0; index < length; index += 1) {
    const key = String(index);
    if (!hasOwn(descriptors, key)) return FAILURE;
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return FAILURE;
    const nested = cloneValue(descriptor.value, depth + 1, state);
    if (nested === FAILURE) return FAILURE;
    defineProperty(clone, key, {
      value: nested,
      enumerable: true,
      writable: true,
      configurable: true
    });
  }
  state.active.delete(value);
  freeze(clone);
  return clone;
}

function cloneObject(
  value: Readonly<Record<PropertyKey, unknown>>,
  depth: number,
  state: SnapshotState
): Readonly<Record<string, unknown>> | typeof FAILURE {
  if (getPrototypeOf(value) !== Object.prototype) return FAILURE;
  const descriptors = getOwnPropertyDescriptors(value);
  const keys = reflectOwnKeys(descriptors);
  if (keys.length > state.limits.maxObjectProperties) return FAILURE;
  const clone: Record<string, unknown> = {};
  state.clones.set(value, clone);
  state.active.add(value);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (typeof key !== "string") return FAILURE;
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return FAILURE;
    const nested = cloneValue(descriptor.value, depth + 1, state);
    if (nested === FAILURE) return FAILURE;
    defineProperty(clone, key, {
      value: nested,
      enumerable: true,
      writable: true,
      configurable: true
    });
  }
  state.active.delete(value);
  freeze(clone);
  return clone;
}

function cloneValue(
  value: unknown,
  depth: number,
  state: SnapshotState
): unknown | typeof FAILURE {
  if (depth > state.limits.maxDepth || !recordNode(state)) return FAILURE;
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return value.length <= state.limits.maxStringLength ? value : FAILURE;
  }
  if (typeof value !== "object") return FAILURE;
  if (state.active.has(value)) return FAILURE;
  const existing = state.clones.get(value);
  if (existing) return existing;
  return arrayIsArray(value)
    ? cloneArray(value, depth, state)
    : cloneObject(value as Readonly<Record<PropertyKey, unknown>>, depth, state);
}

export function snapshotPlainData<T>(
  value: T,
  limits?: Partial<PlainDataSnapshotLimits>
): T | null {
  const resolvedLimits = resolveLimits(limits);
  if (!resolvedLimits) return null;
  try {
    const snapshot = cloneValue(value, 0, {
      limits: resolvedLimits,
      active: new WeakSet<object>(),
      clones: new WeakMap<object, object>(),
      nodes: 0
    });
    return snapshot === FAILURE ? null : snapshot as T;
  } catch {
    return null;
  }
}
