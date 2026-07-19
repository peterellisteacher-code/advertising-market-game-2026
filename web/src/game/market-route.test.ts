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
      mediaIds: ["search", "billboard"]
    };
    const snapshot = structuredClone(input);

    const draft = createMarketRoute(input);
    const committed = commitMarketRoute(draft);

    expect(input).toEqual(snapshot);
    expect(draft).toEqual({
      audienceBriefId: "after-school-wanderers",
      zoneId: "city",
      mediaIds: ["billboard", "search"],
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
});

describe("product signals", () => {
  it("treats cost as a value or premium clue without mutating the chosen traits", () => {
    const highCostInput = {
      costCents: Number.MAX_SAFE_INTEGER,
      traitIds: ["space-property"]
    };
    const snapshot = structuredClone(highCostInput);

    const highCost = createProductSignal(highCostInput);
    const zeroCost = createProductSignal({
      costCents: 0,
      traitIds: ["portability"]
    });
    const everydayCost = createProductSignal({
      costCents: 50_000,
      traitIds: ["experience-escape"]
    });

    expect(highCostInput).toEqual(snapshot);
    expect(highCost).toEqual({
      costCents: Number.MAX_SAFE_INTEGER,
      costSignal: "premium",
      selectedTraitIds: ["space-property"],
      effectiveTraitIds: ["premium", "space-property"]
    });
    expect(zeroCost).toEqual({
      costCents: 0,
      costSignal: "value",
      selectedTraitIds: ["portability"],
      effectiveTraitIds: ["value", "portability"]
    });
    expect(everydayCost).toEqual({
      costCents: 50_000,
      costSignal: "everyday",
      selectedTraitIds: ["experience-escape"],
      effectiveTraitIds: ["experience-escape"]
    });
    for (const signal of [highCost, zeroCost, everydayCost]) {
      expect(Object.isFrozen(signal)).toBe(true);
      expect(Object.isFrozen(signal.selectedTraitIds)).toBe(true);
      expect(Object.isFrozen(signal.effectiveTraitIds)).toBe(true);
    }
  });

  it("rejects unsafe costs and unknown, duplicate or empty trait selections", () => {
    for (const costCents of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN, Infinity]) {
      expect(() => createProductSignal({
        costCents,
        traitIds: ["value"]
      })).toThrow("costCents must be a non-negative safe integer");
    }
    expect(() => createProductSignal({
      costCents: 100,
      traitIds: []
    })).toThrow("Choose at least one product trait");
    expect(() => createProductSignal({
      costCents: 100,
      traitIds: ["teleportation"]
    })).toThrow("Unknown product trait: teleportation");
    expect(() => createProductSignal({
      costCents: 100,
      traitIds: ["comfort", " comfort "]
    })).toThrow("Duplicate product trait: comfort");
  });
});

describe("committed route feedback", () => {
  it("does not reveal route feedback before commitment", () => {
    const product = createProductSignal({
      costCents: 50_000,
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
      costCents: 50_000,
      traitIds: ["portability", "convenience"]
    });
    const cityRoute = commitMarketRoute(createMarketRoute({
      audienceBriefId: "after-school-wanderers",
      zoneId: "city",
      mediaIds: ["transit"]
    }));
    const localRoute = commitMarketRoute(createMarketRoute({
      audienceBriefId: "after-school-wanderers",
      zoneId: "neighbourhood",
      mediaIds: ["social-feed"]
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
      "A simple way to make that hour feel worthwhile."
    );
    expect(cityFeedback.evidence[0]?.reason).toContain("independence");
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
      costCents: 50_000,
      traitIds: ["portability"]
    });
    const promisingRoute = commitMarketRoute(createMarketRoute({
      audienceBriefId: "after-school-wanderers",
      zoneId: "global",
      mediaIds: ["transit"]
    }));
    const premiumProperty = createProductSignal({
      costCents: Number.MAX_SAFE_INTEGER,
      traitIds: ["space-property"]
    });
    const riskyRoute = commitMarketRoute(createMarketRoute({
      audienceBriefId: "careful-spenders",
      zoneId: "destination",
      mediaIds: ["cinema"]
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
