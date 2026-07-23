import { describe, expect, it } from "vitest";
import {
  MemoryProductPriceGuideStateRepository,
  PRODUCT_PRICE_RESERVATION_TTL_SECONDS,
  ProductPriceGuideStateError,
  ProductPriceGuideStateService
} from "./product-price-guide-state";

const identity = { sessionId: "session-1", teamId: "team-1" };
const fingerprint = "a".repeat(64);
const guide = {
  schema: "product-price-guide@1" as const,
  productFingerprint: fingerprint,
  currency: "AUD" as const,
  checkedAt: "2026-07-23T01:02:03.000Z",
  confidence: "low" as const,
  lowCents: 2_000,
  typicalCents: 3_000,
  highCents: 4_000,
  comparables: [{
    title: "Cup one",
    seller: "Seller one",
    priceCents: 2_000,
    sourceUrl: "https://example.com/one"
  }, {
    title: "Cup two",
    seller: "Seller two",
    priceCents: 4_000,
    sourceUrl: "https://example.com/two"
  }]
};

const input = (idempotencyKey = "lookup-1", nowSeconds = 100) => ({
  documentId: "document-1",
  productFingerprint: fingerprint,
  idempotencyKey,
  nowSeconds
});

describe("ProductPriceGuideStateService", () => {
  it("reserves one lookup and replays a completed guide without another charge", async () => {
    const service = new ProductPriceGuideStateService(new MemoryProductPriceGuideStateRepository());
    await expect(service.reserve(identity, input())).resolves.toMatchObject({ created: true });
    await service.complete(identity, fingerprint, "lookup-1", guide);

    await expect(service.reserve(identity, input("new-browser-key", 500))).resolves.toMatchObject({
      created: false,
      attempt: { state: "complete", response: guide }
    });
  });

  it("keeps the same ambiguous attempt idempotent and blocks a competing one", async () => {
    const service = new ProductPriceGuideStateService(new MemoryProductPriceGuideStateRepository());
    await service.reserve(identity, input());

    await expect(service.reserve(identity, input())).resolves.toMatchObject({
      created: false,
      attempt: { state: "reserved", idempotencyKey: "lookup-1" }
    });
    await expect(service.reserve(identity, input("lookup-2"))).rejects.toMatchObject({
      code: "LOOKUP_IN_PROGRESS"
    });
  });

  it("allows the same key to retry after a definite provider failure", async () => {
    const service = new ProductPriceGuideStateService(new MemoryProductPriceGuideStateRepository());
    await service.reserve(identity, input());
    await service.fail(identity, fingerprint, "lookup-1");

    await expect(service.reserve(identity, input("lookup-1", 101))).resolves.toMatchObject({
      created: true,
      attempt: { state: "reserved", createdAt: 101 }
    });
  });

  it("releases a stale reservation through conditional replacement", async () => {
    const service = new ProductPriceGuideStateService(new MemoryProductPriceGuideStateRepository());
    await service.reserve(identity, input());

    await expect(service.reserve(identity, input(
      "lookup-2",
      100 + PRODUCT_PRICE_RESERVATION_TTL_SECONDS
    ))).resolves.toMatchObject({
      created: true,
      attempt: { idempotencyKey: "lookup-2" }
    });
  });

  it("rejects completion under another idempotency key", async () => {
    const service = new ProductPriceGuideStateService(new MemoryProductPriceGuideStateRepository());
    await service.reserve(identity, input());
    await expect(service.complete(identity, fingerprint, "lookup-2", guide))
      .rejects.toBeInstanceOf(ProductPriceGuideStateError);
  });
});
