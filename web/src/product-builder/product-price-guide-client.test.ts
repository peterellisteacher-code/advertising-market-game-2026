import { describe, expect, it, vi } from "vitest";
import type { ProductPriceGuideRequest } from "../../../shared/product-price-guide-contract";
import {
  ProductPriceGuideClient,
  ProductPriceGuideClientError
} from "./product-price-guide-client";

const fingerprint = "a".repeat(64);
const request: ProductPriceGuideRequest = {
  sessionId: "session-1",
  teamId: "team-1",
  documentId: "document-1",
  idempotencyKey: "price-check-1",
  productFingerprint: fingerprint,
  product: { name: "Orbit Tumbler", features: ["Insulated body"] }
};
const guide = {
  schema: "product-price-guide@1",
  productFingerprint: fingerprint,
  currency: "AUD",
  checkedAt: "2026-07-23T01:02:03.000Z",
  confidence: "low",
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

function json(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json", ...init.headers },
    ...init
  });
}

describe("ProductPriceGuideClient", () => {
  it("posts one same-origin product-only request and parses the guide", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(guide));
    const client = new ProductPriceGuideClient({ fetch: fetcher });

    await expect(client.research(request)).resolves.toEqual(guide);
    expect(fetcher).toHaveBeenCalledWith("/api/product-price-guide", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      redirect: "error",
      body: JSON.stringify(request)
    }));
  });

  it("rejects a response for another product", async () => {
    const client = new ProductPriceGuideClient({
      fetch: vi.fn().mockResolvedValue(json({ ...guide, productFingerprint: "b".repeat(64) }))
    });
    await expect(client.research(request)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it.each([
    ["PRODUCT_PRICE_GUIDE_DISABLED", "PRICE_GUIDE_DISABLED"],
    ["PRODUCT_PRICE_GUIDE_LOCKED", "PRICE_GUIDE_LOCKED"],
    ["LOOKUP_IN_PROGRESS", "LOOKUP_IN_PROGRESS"],
    ["INSUFFICIENT_EVIDENCE", "INSUFFICIENT_EVIDENCE"],
    ["UPSTREAM_TIMEOUT", "UPSTREAM_UNAVAILABLE"],
    ["RATE_LIMITED", "RATE_LIMITED"]
  ] as const)("maps %s without exposing server text", async (serverCode, clientCode) => {
    const client = new ProductPriceGuideClient({
      fetch: vi.fn().mockResolvedValue(json({ error: serverCode }, { status: 403 }))
    });
    await expect(client.research(request)).rejects.toMatchObject({ code: clientCode, status: 403 });
  });

  it("uses a typed network error and keeps the caller's retry key unchanged", async () => {
    const client = new ProductPriceGuideClient({
      fetch: vi.fn().mockRejectedValue(new TypeError("offline"))
    });
    await expect(client.research(request)).rejects.toBeInstanceOf(ProductPriceGuideClientError);
    await expect(client.research(request)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(request.idempotencyKey).toBe("price-check-1");
  });

  it("keeps the deadline active while reading the response body", async () => {
    const encoded = new TextEncoder().encode(JSON.stringify(guide));
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, 30));
        controller.enqueue(encoded);
        controller.close();
      }
    });
    const client = new ProductPriceGuideClient({
      timeoutMs: 5,
      fetch: vi.fn().mockResolvedValue(new Response(body, {
        status: 200,
        headers: { "content-type": "application/json" }
      }))
    });

    await expect(client.research(request)).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
