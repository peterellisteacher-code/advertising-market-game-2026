import { describe, expect, it } from "vitest";
import {
  assertBoundedCampaignJson,
  CampaignJsonTraversalError,
  MAX_CAMPAIGN_JSON_DEPTH,
  MAX_CAMPAIGN_JSON_NODES
} from "./bounded-campaign-json";

const nestedRecord = (depth: number): Record<string, unknown> => {
  let value: Record<string, unknown> = { leaf: true };
  for (let index = 0; index < depth; index += 1) value = { child: value };
  return value;
};

describe("bounded campaign JSON", () => {
  it("accepts plain finite JSON at the depth boundary", () => {
    expect(() => assertBoundedCampaignJson({ value: nestedRecord(
      MAX_CAMPAIGN_JSON_DEPTH - 2
    ) })).not.toThrow();
  });

  it("rejects excessive depth and node counts without recursion", () => {
    expect(() => assertBoundedCampaignJson(nestedRecord(MAX_CAMPAIGN_JSON_DEPTH)))
      .toThrow(CampaignJsonTraversalError);
    expect(() => assertBoundedCampaignJson(Array.from(
      { length: MAX_CAMPAIGN_JSON_NODES },
      () => ({})
    ))).toThrow(CampaignJsonTraversalError);
  });

  it("rejects cycles, aliases, sparse arrays, accessors and non-JSON values", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const shared = { value: true };
    const sparse = new Array(2);
    sparse[1] = "value";
    const accessor: Record<string, unknown> = {};
    Object.defineProperty(accessor, "value", { enumerable: true, get: () => true });

    for (const value of [
      cyclic,
      { left: shared, right: shared },
      sparse,
      accessor,
      { missing: undefined },
      { invalid: Number.NaN },
      { invalid: 1n },
      new Map()
    ]) {
      expect(() => assertBoundedCampaignJson(value)).toThrow(CampaignJsonTraversalError);
    }
  });
});
