import { describe, expect, it } from "vitest";
import { createBlankCampaignDocument, parseCampaignDocument } from "./campaign-document";

describe("CampaignDocumentV1", () => {
  it("creates a blank 1600 by 900 revision-zero document", () => {
    const doc = createBlankCampaignDocument({
      documentId: "doc-1",
      sessionId: "local-1",
      mode: "offline"
    });

    expect(doc.canvas).toEqual({ width: 1600, height: 900, background: "#ffffff" });
    expect(doc.revision).toBe(0);
    expect(doc.fabricState).toEqual({ version: "7.4.0", objects: [] });
    expect(doc.product).toEqual({
      name: "",
      priceCents: null,
      pricePosition: null,
      priceDecisionFingerprint: null,
      priceGuide: null,
      priceLookup: null,
      build: null
    });
    expect(doc.evidence).toEqual({
      price: [], attention: [], interest: [], desire: [], action: []
    });
    expect(doc.brief).toEqual({
      targetAudienceId: "",
      contextId: "",
      purpose: "persuade",
      audienceNeeds: [],
      audienceValues: [],
      intendedEffects: [],
      techniques: []
    });
    expect(doc.strategy).toEqual({
      productTraitIds: [],
      marketedChoiceIds: [],
      marketRoute: null,
      aidaPlan: { attention: "", interest: "", desire: "", action: "" }
    });
    expect(doc.gameplay).toEqual({
      stage: "invent",
      pair: {
        activeRole: "art-director",
        handoffCount: 0,
        artDirectorActions: 0,
        strategistActions: 0,
        roleGuideAcknowledged: false
      }
    });
  });

  it("round-trips the authoritative creator level and bounded pair progress", () => {
    const doc = createBlankCampaignDocument({
      documentId: "pair-doc",
      sessionId: "pair-session",
      mode: "offline"
    });
    const gameplay = {
      stage: "sell" as const,
      pair: {
        activeRole: "strategist" as const,
        handoffCount: 3,
        artDirectorActions: 4,
        strategistActions: 2,
        roleGuideAcknowledged: true
      }
    };

    expect(parseCampaignDocument({ ...doc, gameplay }).gameplay).toEqual(gameplay);
    expect(() => parseCampaignDocument({
      ...doc,
      gameplay: { ...gameplay, stage: "secret-fourth-level" }
    })).toThrow();
    expect(() => parseCampaignDocument({
      ...doc,
      gameplay: {
        ...gameplay,
        pair: { ...gameplay.pair, strategistActions: -1 }
      }
    })).toThrow();
  });

  it("loads pair progress from before the role guide with acknowledgement false", () => {
    const document = createBlankCampaignDocument({
      documentId: "legacy-role-guide",
      sessionId: "legacy-role-guide-session",
      mode: "offline"
    });
    const legacy = structuredClone(document) as unknown as {
      gameplay: { pair: Record<string, unknown> };
    };
    delete legacy.gameplay.pair.roleGuideAcknowledged;

    expect(parseCampaignDocument(legacy).gameplay.pair.roleGuideAcknowledged).toBe(false);
  });

  it("rejects a malformed document", () => {
    expect(() => parseCampaignDocument({ schemaVersion: 1, canvas: { width: 99 } })).toThrow();
  });

  it("rejects a saved Fabric object without application metadata", () => {
    const doc = createBlankCampaignDocument({
      documentId: "doc-1",
      sessionId: "local-1",
      mode: "offline"
    });

    expect(() => parseCampaignDocument({
      ...doc,
      fabricState: { version: "7.4.0", objects: [{ type: "rect" }] }
    })).toThrow();
  });

  it("requires room and team identifiers in room mode", () => {
    expect(() => createBlankCampaignDocument({
      documentId: "doc-1",
      sessionId: "room-session",
      mode: "room"
    })).toThrow();
  });

  it("accepts complete nested semantic objects and rejects partial nested metadata", () => {
    const doc = createBlankCampaignDocument({
      documentId: "nested-doc",
      sessionId: "nested-session",
      mode: "offline"
    });
    const product = {
      objectId: "product-1",
      elementKind: "product-shell",
      accessibleName: "Classic can",
      objects: [{ productLayer: "base-shell" }, {
        productLayer: "artwork-slot",
        objects: [{
          objectId: "nested-image",
          elementKind: "image",
          accessibleName: "Sliced citrus",
          assetId: "fruit-1"
        }]
      }]
    };

    expect(parseCampaignDocument({
      ...doc,
      fabricState: { version: "7.4.0", objects: [product] }
    }).fabricState.objects[0]).toMatchObject(product);

    const malformed = structuredClone(product);
    malformed.objects[1]!.objects![0] = { objectId: "partial-child" } as never;
    expect(() => parseCampaignDocument({
      ...doc,
      fabricState: { version: "7.4.0", objects: [malformed] }
    })).toThrow("partial-child");
  });

  it("persists a renderer-independent product cost ledger", () => {
    const doc = createBlankCampaignDocument({
      documentId: "priced-doc",
      sessionId: "priced-session",
      mode: "offline"
    });
    const build = {
      schema: "product-build@1" as const,
      primaryObjectId: "product-1",
      packId: "durable-goods-v1",
      pricingVersion: 4,
      blueprintId: "courtyard-house",
      selections: [{ groupId: "house", choiceIds: ["courtyard-house"] }, {
        groupId: "features",
        choiceIds: ["solar-patio"]
      }],
      costLines: [{
        groupId: "house",
        groupLabel: "House",
        kind: "base" as const,
        choiceId: "courtyard-house",
        label: "Courtyard house",
        costCents: 25_000_000
      }, {
        groupId: "features",
        groupLabel: "Features",
        kind: "feature" as const,
        choiceId: "solar-patio",
        label: "Solar patio",
        costCents: 7_500_000
      }],
      unitCostCents: 32_500_000
    };

    expect(parseCampaignDocument({
      ...doc,
      product: { ...doc.product, priceCents: 50_000_000, build }
    }).product).toEqual({
      name: "",
      priceCents: 50_000_000,
      pricePosition: null,
      priceDecisionFingerprint: null,
      priceGuide: null,
      priceLookup: null,
      build
    });
  });

  it("persists comparable-price evidence and a student-owned audience position", () => {
    const doc = createBlankCampaignDocument({
      documentId: "guide-doc",
      sessionId: "guide-session",
      mode: "offline"
    });
    const productFingerprint = "a".repeat(64);
    const priceGuide = {
      schema: "product-price-guide@1" as const,
      productFingerprint,
      currency: "AUD" as const,
      checkedAt: "2026-07-23T01:02:03.000Z",
      confidence: "low" as const,
      lowCents: 2_000,
      typicalCents: 3_000,
      highCents: 4_000,
      comparables: [{
        title: "Steel travel cup",
        seller: "Example Shop",
        priceCents: 2_000,
        sourceUrl: "https://example.com/cup"
      }, {
        title: "Insulated tumbler",
        seller: "Sample Store",
        priceCents: 4_000,
        sourceUrl: "https://sample.example/tumbler"
      }]
    };

    expect(parseCampaignDocument({
      ...doc,
      product: {
        ...doc.product,
        priceCents: 3_500,
        pricePosition: "premium",
        priceGuide
      }
    }).product).toMatchObject({
      priceCents: 3_500,
      pricePosition: "premium",
      priceGuide
    });
  });

  it("loads legacy product records with safe price-research defaults", () => {
    const doc = createBlankCampaignDocument({
      documentId: "legacy-price-doc",
      sessionId: "legacy-price-session",
      mode: "offline"
    });
    const legacy = structuredClone(doc) as unknown as { product: Record<string, unknown> };
    delete legacy.product.pricePosition;
    delete legacy.product.priceDecisionFingerprint;
    delete legacy.product.priceGuide;
    delete legacy.product.priceLookup;

    expect(parseCampaignDocument(legacy).product).toMatchObject({
      pricePosition: null,
      priceDecisionFingerprint: null,
      priceGuide: null,
      priceLookup: null
    });
  });

  it("loads a saved market route from before proof points were introduced", () => {
    const doc = createBlankCampaignDocument({
      documentId: "legacy-route-doc",
      sessionId: "legacy-route-session",
      mode: "offline"
    });
    doc.brief.targetAudienceId = "after-school-wanderers";
    const legacy = {
      ...structuredClone(doc),
      strategy: {
        ...structuredClone(doc.strategy),
        marketRoute: {
          audienceBriefId: "after-school-wanderers",
          zoneId: "city",
          mediaIds: ["transit"],
          committed: true
        }
      }
    };

    expect(parseCampaignDocument(legacy).strategy.marketRoute?.proofPoint).toBe("");
  });

  it("rejects a product ledger whose lines do not add up to its unit cost", () => {
    const doc = createBlankCampaignDocument({
      documentId: "bad-cost-doc",
      sessionId: "bad-cost-session",
      mode: "offline"
    });

    expect(() => parseCampaignDocument({
      ...doc,
      product: {
        ...doc.product,
        build: {
          schema: "product-build@1",
          primaryObjectId: "product-1",
          packId: "pilot-v1",
          pricingVersion: 1,
          blueprintId: "bottle",
          selections: [{ groupId: "shape", choiceIds: ["bottle"] }],
          costLines: [{
            groupId: "shape",
            groupLabel: "Shape",
            kind: "base",
            choiceId: "bottle",
            label: "Bottle",
            costCents: 2_500
          }],
          unitCostCents: 2_400
        }
      }
    })).toThrow("unit cost");
  });

  it("persists a committed audience, zone and media route with its selling points", () => {
    const doc = createBlankCampaignDocument({
      documentId: "route-doc",
      sessionId: "route-session",
      mode: "offline"
    });
    const strategy = {
      productTraitIds: ["portability", "convenience"],
      marketedChoiceIds: [],
      marketRoute: {
        audienceBriefId: "after-school-wanderers",
        zoneId: "city",
        mediaIds: ["transit", "social-feed"],
        proofPoint: "The carry loop fits around one hand.",
        committed: true as const
      },
      aidaPlan: {
        attention: "Lead with one bright moving image.",
        interest: "Show how quickly it fits the trip home.",
        desire: "Make the spare hour feel worth claiming.",
        action: "Invite them to try it after school."
      }
    };

    const parsed = parseCampaignDocument({
      ...doc,
      brief: {
        ...doc.brief,
        targetAudienceId: "after-school-wanderers",
        contextId: "after-school-wanderers"
      },
      strategy
    });

    expect(parsed.strategy).toEqual(strategy);
  });

  it("rejects unknown, duplicate or audience-mismatched market strategy IDs", () => {
    const doc = createBlankCampaignDocument({
      documentId: "bad-route-doc",
      sessionId: "bad-route-session",
      mode: "offline"
    });
    const strategy = {
      ...doc.strategy,
      productTraitIds: ["comfort", "comfort"],
      marketRoute: {
        audienceBriefId: "careful-spenders",
        zoneId: "moon-base",
        mediaIds: ["billboard", "billboard"],
        committed: true
      }
    };

    expect(() => parseCampaignDocument({
      ...doc,
      brief: {
        ...doc.brief,
        targetAudienceId: "after-school-wanderers",
        contextId: "after-school-wanderers"
      },
      strategy
    })).toThrow();
  });

  it("round-trips the exact structural Product Kit reference and root kind", () => {
    const doc = createBlankCampaignDocument({
      documentId: "product-kit-doc",
      sessionId: "product-kit-session",
      mode: "offline"
    });
    const composition = {
      kind: "product-kit-composition" as const,
      version: 1 as const,
      objectId: "product-kit-root",
      productKitPackId: "pk1-pilot-drinkware",
      catalogPackId: "offline-core-v1",
      catalogSha256: "8".repeat(64),
      request: {
        kitId: "pk1-tumbler-kit",
        placements: [{
          kind: "socket" as const,
          placementId: "lid-one",
          mountFrameId: "pk1-lid-frame",
          componentId: "pk1-flat-lid"
        }]
      },
      pricedItems: [{
        kind: "base" as const,
        itemId: "base:pk1-tumbler-kit",
        priceAssetId: "pk1-price-tumbler"
      }, {
        kind: "component" as const,
        itemId: "placement:lid-one",
        placementId: "lid-one",
        componentId: "pk1-flat-lid",
        priceAssetId: "pk1-price-flat-lid"
      }]
    };

    const parsed = parseCampaignDocument({
      ...doc,
      fabricState: {
        version: "7.4.0",
        objects: [{
          type: "Group",
          objectId: "product-kit-root",
          elementKind: "product-kit",
          accessibleName: "Reusable tumbler"
        }]
      },
      assetReferences: [composition]
    });

    expect(parsed.assetReferences).toEqual([composition]);
    expect(parsed.fabricState.objects[0]).toMatchObject({
      objectId: "product-kit-root",
      elementKind: "product-kit"
    });
  });

  it("does not reinterpret a malformed Product Kit reference as a generic record", () => {
    const doc = createBlankCampaignDocument({
      documentId: "bad-product-kit-doc",
      sessionId: "bad-product-kit-session",
      mode: "offline"
    });
    const baseReference = {
      kind: "product-kit-composition",
      version: 1,
      objectId: "product-kit-root",
      productKitPackId: "pk1-pilot-drinkware",
      catalogPackId: "offline-core-v1",
      catalogSha256: "8".repeat(64),
      request: { kitId: "pk1-tumbler-kit", placements: [] },
      pricedItems: [{
        kind: "base",
        itemId: "base:pk1-tumbler-kit",
        priceAssetId: "pk1-price-tumbler"
      }]
    };

    expect(() => parseCampaignDocument({
      ...doc,
      assetReferences: [{ ...baseReference, sourceUrl: "https://example.test/product.svg" }]
    })).toThrow();
    expect(() => parseCampaignDocument({
      ...doc,
      assetReferences: [{
        ...baseReference,
        request: { ...baseReference.request, placements: new Array(1) }
      }]
    })).toThrow();
  });
});
