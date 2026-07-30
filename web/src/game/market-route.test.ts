import { describe, expect, it } from "vitest";
import {
  ADVERTISING_MEDIA,
  MARKET_ZONES,
  PRODUCT_TRAITS,
  commitMarketRoute,
  createMarketRoute,
  createProductSignal,
  evaluateCommittedMarketRoute,
  type CommittedMarketRoute
} from "./market-route";

describe("market route catalogues", () => {
  it("offers broad classroom-manageable zones, media and product signals", () => {
    expect(MARKET_ZONES.map((zone) => zone.id)).toEqual([
      "neighbourhood",
      "city",
      "regional",
      "national",
      "global",
      "destination"
    ]);
    expect(ADVERTISING_MEDIA.map((medium) => medium.id)).toEqual([
      "billboard",
      "transit",
      "storefront",
      "magazine",
      "social-feed",
      "search",
      "streaming-video",
      "podcast-audio",
      "cinema",
      "event-sponsorship",
      "direct"
    ]);
    expect(PRODUCT_TRAITS.map((trait) => trait.id)).toEqual([
      "value",
      "premium",
      "portability",
      "durability",
      "visibility",
      "capacity",
      "comfort",
      "sustainability",
      "novelty",
      "convenience",
      "experience-escape",
      "space-property"
    ]);
  });

  it("keeps every catalogue immutable and its student copy plain and lively", () => {
    const catalogues = [MARKET_ZONES, ADVERTISING_MEDIA, PRODUCT_TRAITS];

    for (const catalogue of catalogues) {
      expect(Object.isFrozen(catalogue)).toBe(true);
      for (const entry of catalogue) {
        expect(Object.isFrozen(entry)).toBe(true);
      }
    }

    const studentCopy = JSON.stringify(catalogues);
    expect(studentCopy).not.toMatch(/\b(?:assignment|unit|task|budget|cap)\b/i);
  });
});

describe("market route lifecycle", () => {
  it("combines an audience, fictional zone and one or more media without mutation", () => {
    const input = {
      audienceBriefId: " after-school-wanderers ",
      zoneId: " city ",
      mediaIds: ["search", "billboard"],
      proofPoint: " Insulated steel keeps the drink cool. "
    };
    const snapshot = structuredClone(input);

    const draft = createMarketRoute(input);
    const committed = commitMarketRoute(draft);

    expect(input).toEqual(snapshot);
    expect(draft).toEqual({
      audienceBriefId: "after-school-wanderers",
      zoneId: "city",
      mediaIds: ["billboard", "search"],
      proofPoint: "Insulated steel keeps the drink cool.",
      committed: false
    });
    expect(committed).toEqual({ ...draft, committed: true });
    expect(Object.isFrozen(draft)).toBe(true);
    expect(Object.isFrozen(draft.mediaIds)).toBe(true);
    expect(Object.isFrozen(committed)).toBe(true);
    expect(Object.isFrozen(committed.mediaIds)).toBe(true);
  });

  it("rejects unknown, duplicate and empty route selections", () => {
    expect(() => createMarketRoute({
      audienceBriefId: "unknown-audience",
      zoneId: "city",
      mediaIds: ["billboard"]
    })).toThrow("Unknown audience brief: unknown-audience");
    expect(() => createMarketRoute({
      audienceBriefId: "after-school-wanderers",
      zoneId: " ",
      mediaIds: ["billboard"]
    })).toThrow("zoneId must be non-blank");
    expect(() => createMarketRoute({
      audienceBriefId: "after-school-wanderers",
      zoneId: "moon-base",
      mediaIds: ["billboard"]
    })).toThrow("Unknown market zone: moon-base");
    expect(() => createMarketRoute({
      audienceBriefId: "after-school-wanderers",
      zoneId: "city",
      mediaIds: []
    })).toThrow("Choose at least one advertising medium");
    expect(() => createMarketRoute({
      audienceBriefId: "after-school-wanderers",
      zoneId: "city",
      mediaIds: ["skywriting"]
    })).toThrow("Unknown advertising medium: skywriting");
    expect(() => createMarketRoute({
      audienceBriefId: "after-school-wanderers",
      zoneId: "city",
      mediaIds: ["social-feed", " social-feed "]
    })).toThrow("Duplicate advertising medium: social-feed");
  });

  it("requires a nonblank proof point before a route can be committed", () => {
    const draft = createMarketRoute({
      audienceBriefId: "after-school-wanderers",
      zoneId: "city",
      mediaIds: ["transit"],
      proofPoint: " "
    });

    expect(draft.proofPoint).toBe("");
    expect(() => commitMarketRoute(draft)).toThrow("proof point");
  });
});

describe("product signals", () => {
  it("uses the pair's audience price position instead of universal dollar thresholds", () => {
    const premiumInput = {
      pricePosition: "premium" as const,
      traitIds: ["space-property"]
    };
    const snapshot = structuredClone(premiumInput);

    const premium = createProductSignal(premiumInput);
    const budget = createProductSignal({
      pricePosition: "budget",
      traitIds: ["portability"]
    });
    const everyday = createProductSignal({
      pricePosition: "everyday",
      traitIds: ["experience-escape"]
    });

    expect(premiumInput).toEqual(snapshot);
    expect(premium).toEqual({
      pricePosition: "premium",
      selectedTraitIds: ["space-property"],
      effectiveTraitIds: ["premium", "space-property"]
    });
    expect(budget).toEqual({
      pricePosition: "budget",
      selectedTraitIds: ["portability"],
      effectiveTraitIds: ["value", "portability"]
    });
    expect(everyday).toEqual({
      pricePosition: "everyday",
      selectedTraitIds: ["experience-escape"],
      effectiveTraitIds: ["experience-escape"]
    });
    for (const signal of [premium, budget, everyday]) {
      expect(Object.isFrozen(signal)).toBe(true);
      expect(Object.isFrozen(signal.selectedTraitIds)).toBe(true);
      expect(Object.isFrozen(signal.effectiveTraitIds)).toBe(true);
    }
  });

  it("rejects unknown positions and unknown, duplicate or empty trait selections", () => {
    expect(() => createProductSignal({
      pricePosition: "luxury" as never,
      traitIds: ["value"]
    })).toThrow("pricePosition must be budget, everyday or premium");
    expect(() => createProductSignal({
      pricePosition: "everyday",
      traitIds: []
    })).toThrow("Choose at least one product trait");
    expect(() => createProductSignal({
      pricePosition: "everyday",
      traitIds: ["teleportation"]
    })).toThrow("Unknown product trait: teleportation");
    expect(() => createProductSignal({
      pricePosition: "everyday",
      traitIds: ["comfort", " comfort "]
    })).toThrow("Duplicate product trait: comfort");
  });
});

describe("committed route feedback", () => {
  it("does not reveal route feedback before commitment", () => {
    const product = createProductSignal({
      pricePosition: "everyday",
      traitIds: ["portability"]
    });
    const draft = createMarketRoute({
      audienceBriefId: "after-school-wanderers",
      zoneId: "city",
      mediaIds: ["transit"]
    });

    expect(() => evaluateCommittedMarketRoute(
      product,
      draft as unknown as CommittedMarketRoute
    )).toThrow("Commit the market route before feedback");
  });

  it("recognises multiple defensible strong routes instead of one hidden answer", () => {
    const product = createProductSignal({
      pricePosition: "everyday",
      traitIds: ["portability", "convenience"]
    });
    const cityRoute = commitMarketRoute(createMarketRoute({
      audienceBriefId: "after-school-wanderers",
      zoneId: "city",
      mediaIds: ["transit"],
      proofPoint: "The carry loop fits around one hand."
    }));
    const localRoute = commitMarketRoute(createMarketRoute({
      audienceBriefId: "after-school-wanderers",
      zoneId: "neighbourhood",
      mediaIds: ["social-feed"],
      proofPoint: "The lid remains sealed when the bottle is inverted."
    }));

    const cityFeedback = evaluateCommittedMarketRoute(product, cityRoute);
    const localFeedback = evaluateCommittedMarketRoute(product, localRoute);

    expect(cityFeedback.outcome).toBe("strong");
    expect(localFeedback.outcome).toBe("strong");
    expect(cityFeedback.evidence.map((item) => item.kind)).toEqual([
      "audience",
      "zone",
      "media"
    ]);
    expect(cityFeedback.evidence[0]?.reason).toContain(
      "A method to make the window productive."
    );
    expect(cityFeedback.evidence[0]?.reason).toContain("independence");
    expect(cityFeedback.evidence[0]?.reason).toMatch(
      /(?:supports|support) independence and belonging\. It also addresses this need:/
    );
    expect(cityFeedback.evidence[1]?.reason).toContain("City Pulse");
    expect(cityFeedback.evidence[2]?.reason).toContain("Transit");
    expect(localFeedback.evidence[1]?.reason).toContain("Neighbourhood Loop");
    expect(localFeedback.evidence[2]?.reason).toContain("Social feed");
    expect(cityFeedback.nextMove.trim().length).toBeGreaterThan(0);
    expect(cityFeedback).not.toHaveProperty("score");
    expect(cityFeedback).not.toHaveProperty("rank");
  });

  it("returns deterministic promising and risky feedback while keeping every route available", () => {
    const portableProduct = createProductSignal({
      pricePosition: "everyday",
      traitIds: ["portability"]
    });
    const promisingRoute = commitMarketRoute(createMarketRoute({
      audienceBriefId: "after-school-wanderers",
      zoneId: "global",
      mediaIds: ["transit"],
      proofPoint: "The carry loop fits around one hand."
    }));
    const premiumProperty = createProductSignal({
      pricePosition: "premium",
      traitIds: ["space-property"]
    });
    const riskyRoute = commitMarketRoute(createMarketRoute({
      audienceBriefId: "careful-spenders",
      zoneId: "destination",
      mediaIds: ["cinema"],
      proofPoint: "The courtyard receives direct morning light."
    }));
    const productSnapshot = structuredClone(premiumProperty);
    const routeSnapshot = structuredClone(riskyRoute);

    const promising = evaluateCommittedMarketRoute(portableProduct, promisingRoute);
    const risky = evaluateCommittedMarketRoute(premiumProperty, riskyRoute);
    const repeatedRisky = evaluateCommittedMarketRoute(premiumProperty, riskyRoute);

    expect(promising.outcome).toBe("promising");
    expect(promising.evidence.map((item) => item.fit)).toEqual([
      "supports",
      "stretch",
      "supports"
    ]);
    expect(risky.outcome).toBe("risky");
    expect(risky).toEqual(repeatedRisky);
    expect(risky.nextMove.trim().length).toBeGreaterThan(0);
    expect(JSON.stringify(risky)).not.toMatch(/\b(?:assignment|unit|task|budget|cap)\b/i);
    expect(premiumProperty).toEqual(productSnapshot);
    expect(riskyRoute).toEqual(routeSnapshot);
    expect(Object.isFrozen(risky)).toBe(true);
    expect(Object.isFrozen(risky.evidence)).toBe(true);
    for (const item of risky.evidence) {
      expect(Object.isFrozen(item)).toBe(true);
    }
  });
});
