export const MAX_CAMPAIGN_JSON_DEPTH = 128;
export const MAX_CAMPAIGN_JSON_NODES = 120_000;

const ERROR_MESSAGE = "Campaign JSON exceeds safe traversal bounds";

export class CampaignJsonTraversalError extends Error {
  constructor() {
    super(ERROR_MESSAGE);
    this.name = "CampaignJsonTraversalError";
  }
}

const fail = (): never => { throw new CampaignJsonTraversalError(); };

const assertPrimitive = (value: unknown): void => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  fail();
};

const childrenOf = (value: object): unknown[] => {
  if (Array.isArray(value)) {
    if (Object.getOwnPropertySymbols(value).length > 0) fail();
    const keys = Object.keys(value);
    if (keys.length !== value.length) fail();
    const children: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      if (keys[index] !== String(index)) fail();
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined) throw new CampaignJsonTraversalError();
      if (!("value" in descriptor)) throw new CampaignJsonTraversalError();
      children.push(descriptor.value);
    }
    return children;
  }

  if (Object.getPrototypeOf(value) !== Object.prototype ||
    Object.getOwnPropertySymbols(value).length > 0) fail();
  const children: unknown[] = [];
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) throw new CampaignJsonTraversalError();
    if (!("value" in descriptor)) throw new CampaignJsonTraversalError();
    children.push(descriptor.value);
  }
  return children;
};

export function assertBoundedCampaignJson(value: unknown): void {
  const active = new WeakSet<object>();
  const complete = new WeakSet<object>();
  const stack: Array<{ value: unknown; depth: number; complete?: true }> = [{
    value,
    depth: 0
  }];
  let nodes = 0;

  while (stack.length > 0) {
    const entry = stack.pop()!;
    if (entry.value === null || typeof entry.value !== "object") {
      assertPrimitive(entry.value);
      continue;
    }
    if (entry.complete) {
      active.delete(entry.value);
      complete.add(entry.value);
      continue;
    }
    if (entry.depth >= MAX_CAMPAIGN_JSON_DEPTH ||
      ++nodes > MAX_CAMPAIGN_JSON_NODES ||
      active.has(entry.value) || complete.has(entry.value)) fail();

    const children = childrenOf(entry.value);
    active.add(entry.value);
    stack.push({ value: entry.value, depth: entry.depth, complete: true });
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ value: children[index], depth: entry.depth + 1 });
    }
  }
}
