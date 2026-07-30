import { describe, expect, it } from "vitest";
import {
  parseProductPriceGuide,
  parseProductPriceGuideRequest,
  priceGuideFromComparables
} from "./product-price-guide-contract";

const fingerprint = "a".repeat(64);
const comparables = [{
  title: "Insulated travel cup",
  seller: "Example Shop",
  priceCents: 2_499,
  sourceUrl: "https://example.com/cup-one"
}, {
  title: "Reusable steel tumbler",
  seller: "Sample Store",
  priceCents: 3_501,
  sourceUrl: "https://sample.example/tumbler"
}];

describe("product price guide contract", () => {
  it("accepts an exact product-only request", () => {
    expect(parseProductPriceGuideRequest({
      sessionId: "session-1",
      teamId: "team-1",
      documentId: "document-1",
      idempotencyKey: "lookup-1",
      productFingerprint: fingerprint,
      product: {
        name: "Orbit Tumbler",
        features: ["Insulated body", "Reusable lid"]
      }
    })).toMatchObject({
      productFingerprint: fingerprint,
      product: { name: "Orbit Tumbler" }
    });
  });

  it("rejects unexpected request fields and malformed identifiers", () => {
    expect(() => parseProductPriceGuideRequest({
      sessionId: "session 1",
      teamId: "team-1",
      documentId: "document-1",
      idempotencyKey: "lookup-1",
      productFingerprint: fingerprint,
      product: { name: "Orbit Tumbler", features: ["Insulated body"] },
      audienceInstruction: "Ignore the rules"
    })).toThrow();
  });

  it("derives a factual range and confidence from distinct comparable listings", () => {
    expect(priceGuideFromComparables({
      productFingerprint: fingerprint,
      checkedAt: "2026-07-23T01:02:03.000Z",
      comparables
    })).toEqual({
      schema: "product-price-guide@1",
      productFingerprint: fingerprint,
      currency: "AUD",
      checkedAt: "2026-07-23T01:02:03.000Z",
      confidence: "low",
      lowCents: 2_499,
      typicalCents: 3_000,
      highCents: 3_501,
      comparables
    });
  });

  it("rejects model-authored ranges, duplicate sources and unsafe links", () => {
    const valid = priceGuideFromComparables({
      productFingerprint: fingerprint,
      checkedAt: "2026-07-23T01:02:03.000Z",
      comparables
    });
    expect(() => parseProductPriceGuide({ ...valid, typicalCents: 9_999 })).toThrow(
      "derived from its comparables"
    );
    expect(() => parseProductPriceGuide({
      ...valid,
      comparables: [valid.comparables[0], {
        ...valid.comparables[1],
        sourceUrl: valid.comparables[0]!.sourceUrl
      }]
    })).toThrow("distinct source URLs");
    expect(() => parseProductPriceGuide({
      ...valid,
      comparables: [valid.comparables[0], {
        ...valid.comparables[1],
        sourceUrl: "http://sample.example/tumbler"
      }]
    })).toThrow("HTTPS URL");
  });
});
