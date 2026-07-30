import { describe, expect, it } from "vitest";
import {
  campaignSemanticObjectMap,
  collectCampaignSemanticObjects
} from "./campaign-semantic-objects";

const nestedState = {
  version: "7.4.0",
  objects: [{
    type: "Group",
    objectId: "product-1",
    elementKind: "product-shell",
    accessibleName: "Classic can",
    clipPath: {
      type: "Path",
      objectId: "nested-image",
      elementKind: "image",
      accessibleName: "Clip path must not count"
    },
    objects: [
      { type: "Path", productLayer: "base-shell", shellRegion: "body" },
      {
        type: "Group",
        productLayer: "artwork-slot",
        artworkSlotId: "primary",
        objects: [{
          type: "FabricImage",
          objectId: "nested-image",
          elementKind: "image",
          accessibleName: "Sliced citrus",
          assetId: "fruit-1",
          src: "/catalog/fruit.png"
        }]
      }
    ]
  }]
};

describe("campaign semantic object tree", () => {
  it("collects root and nested semantic objects while ignoring decoration and clip paths", () => {
    const collected = collectCampaignSemanticObjects(nestedState);

    expect(collected.map(({ objectId, path }) => ({ objectId, path }))).toEqual([
      { objectId: "product-1", path: [0] },
      { objectId: "nested-image", path: [0, 1, 0] }
    ]);
    expect(campaignSemanticObjectMap(nestedState).get("nested-image")?.object)
      .toMatchObject({ assetId: "fruit-1", src: "/catalog/fruit.png" });
  });

  it("rejects partial nested semantic metadata", () => {
    const malformed = structuredClone(nestedState);
    malformed.objects[0]!.objects[1]!.objects = [{
      type: "Textbox",
      objectId: "partial-child"
    } as never];

    expect(() => collectCampaignSemanticObjects(malformed))
      .toThrow("partial-child");
  });

  it("rejects duplicate IDs across root and nested objects", () => {
    const duplicate = structuredClone(nestedState);
    duplicate.objects[0]!.objects[1]!.objects![0]!.objectId = "product-1";

    expect(() => collectCampaignSemanticObjects(duplicate))
      .toThrow("Duplicate Fabric object ID product-1");
  });

  it("rejects malformed descendant object arrays", () => {
    const malformed = structuredClone(nestedState) as Record<string, unknown>;
    const root = (malformed.objects as Array<Record<string, unknown>>)[0]!;
    root.objects = "not-an-array";

    expect(() => collectCampaignSemanticObjects(malformed))
      .toThrow("children must be an array");
  });

  it("fails closed on cyclic or excessively deep Fabric object graphs without recursion", () => {
    const cyclic: Record<string, unknown> = { type: "Group", objects: [] };
    (cyclic.objects as unknown[]).push(cyclic);
    expect(() => collectCampaignSemanticObjects({ version: "7.4.0", objects: [cyclic] }))
      .toThrow("cycles or aliases");

    const root: Record<string, unknown> = { type: "Group", objects: [] };
    let current = root;
    for (let depth = 0; depth < 102; depth += 1) {
      const child: Record<string, unknown> = { type: "Group", objects: [] };
      (current.objects as unknown[]).push(child);
      current = child;
    }
    expect(() => collectCampaignSemanticObjects({ version: "7.4.0", objects: [root] }))
      .toThrow("maximum depth");
  });
});
