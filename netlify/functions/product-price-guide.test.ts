import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  canonicalProductPriceSubject,
  type ProductPriceGuideRequest
} from "../../shared/product-price-guide-contract";
import { createCapability, IMAGE_LAB_COOKIE } from "./lib/image-lab-auth";
import {
  MemoryProductPriceGuideStateRepository,
  ProductPriceGuideStateService
} from "./lib/product-price-guide-state";
import {
  PRODUCT_PRICE_GUIDE_MODEL,
  PRODUCT_PRICE_GUIDE_SYSTEM_PROMPT,
  createProductPriceGuideHandler
} from "./product-price-guide.mjs";

const secret = "s".repeat(48);
const environment = {
  PRODUCT_PRICE_GUIDE_ENABLED: "true",
  PRODUCT_PRICE_GUIDE_SCHOOL_APPROVED: "true",
  PRODUCT_PRICE_GUIDE_ACCOUNT_CAP_USD: "5",
  IMAGE_LAB_SIGNING_SECRET: secret,
  OPENROUTER_API_KEY: "openrouter-test-key"
};
const product = {
  name: "Orbit Tumbler",
  features: ["Material: Insulated steel", "Feature: Reusable lid"]
};
const fingerprint = createHash("sha256")
  .update(canonicalProductPriceSubject(product), "utf8")
  .digest("hex");

function body(idempotencyKey = "price-check-1"): ProductPriceGuideRequest {
  return {
    sessionId: "session-pair-7",
    teamId: "team-pair-7",
    documentId: "campaign-7",
    idempotencyKey,
    productFingerprint: fingerprint,
    product
  };
}

function capability(sessionId = "session-pair-7", teamId = "team-pair-7"): string {
  return createCapability({
    sessionId,
    teamId,
    remainingObject: 6,
    remainingRealise: 1,
    expiresAt: 2_000
  }, secret);
}

function incoming(value: unknown, options: { cookie?: string; contentLength?: string } = {}): Request {
  return new Request("https://draft.example/api/product-price-guide", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: `${IMAGE_LAB_COOKIE}=${options.cookie ?? capability()}`,
      ...(options.contentLength === undefined ? {} : { "content-length": options.contentLength })
    },
    body: JSON.stringify(value)
  });
}

function provider(value: unknown, model = PRODUCT_PRICE_GUIDE_MODEL): Response {
  return Response.json({
    model,
    choices: [{ message: { content: JSON.stringify(value) } }]
  });
}

const providerResult = {
  found: true,
  comparables: [{
    title: "Insulated steel travel cup",
    seller: "Example Shop",
    priceCents: 2_499,
    sourceUrl: "https://example.com/cup"
  }, {
    title: "Reusable steel tumbler",
    seller: "Sample Store",
    priceCents: 3_501,
    sourceUrl: "https://sample.example/tumbler"
  }]
};

function state(): ProductPriceGuideStateService {
  return new ProductPriceGuideStateService(new MemoryProductPriceGuideStateRepository());
}

describe("product price guide function", () => {
  it("sends one pinned web-search request and derives the range in application code", async () => {
    const fetcher = vi.fn().mockResolvedValue(provider(providerResult));
    const handler = createProductPriceGuideHandler({
      environment,
      fetch: fetcher,
      state: state(),
      nowSeconds: () => 1_000,
      nowIso: () => "2026-07-23T01:02:03.000Z",
      createDeadlineSignal: () => new AbortController().signal
    });

    const response = await handler(incoming(body()));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      schema: "product-price-guide@1",
      productFingerprint: fingerprint,
      currency: "AUD",
      checkedAt: "2026-07-23T01:02:03.000Z",
      confidence: "low",
      lowCents: 2_499,
      typicalCents: 3_000,
      highCents: 3_501,
      comparables: providerResult.comparables
    });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const requestBody = JSON.parse(String(init.body)) as Record<string, any>;
    expect(requestBody).toMatchObject({
      model: "google/gemini-3.1-flash-lite",
      max_tokens: 640,
      reasoning: { effort: "minimal" },
      provider: {
        allow_fallbacks: false,
        require_parameters: true,
        data_collection: "deny",
        zdr: true
      },
      plugins: [{ id: "web", max_results: 4 }],
      response_format: { type: "json_schema", json_schema: { strict: true } }
    });
    expect(String(requestBody.messages[1].content)).not.toContain("audience");
    expect(String(requestBody.messages[1].content)).not.toContain("image_url");
    expect(requestBody.messages[0].content).toMatch(/untrusted/i);
    expect(PRODUCT_PRICE_GUIDE_SYSTEM_PROMPT).toMatch(/Do not choose.*student's selling price/is);
  });

  it("replays a completed product fingerprint without another paid lookup", async () => {
    const fetcher = vi.fn().mockResolvedValue(provider(providerResult));
    const service = state();
    const handler = createProductPriceGuideHandler({
      environment,
      fetch: fetcher,
      state: service,
      nowSeconds: () => 1_000,
      nowIso: () => "2026-07-23T01:02:03.000Z",
      createDeadlineSignal: () => new AbortController().signal
    });

    expect((await handler(incoming(body()))).status).toBe(200);
    expect((await handler(incoming(body("another-browser-key")))).status).toBe(200);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("releases a definite upstream failure for an explicit retry with the same key", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("upstream", { status: 503 }))
      .mockResolvedValueOnce(provider(providerResult));
    const handler = createProductPriceGuideHandler({
      environment,
      fetch: fetcher,
      state: state(),
      nowSeconds: () => 1_000,
      nowIso: () => "2026-07-23T01:02:03.000Z",
      createDeadlineSignal: () => new AbortController().signal
    });

    expect((await handler(incoming(body()))).status).toBe(502);
    expect((await handler(incoming(body()))).status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns insufficient evidence instead of accepting invented comparables", async () => {
    const fetcher = vi.fn().mockResolvedValue(provider({ found: false, comparables: [] }));
    const handler = createProductPriceGuideHandler({
      environment,
      fetch: fetcher,
      state: state(),
      nowSeconds: () => 1_000,
      createDeadlineSignal: () => new AbortController().signal
    });

    const response = await handler(incoming(body()));
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "INSUFFICIENT_EVIDENCE" });
  });

  it("fails closed before billing for disabled, locked, mismatched and malformed requests", async () => {
    const fetcher = vi.fn();
    const base = { fetch: fetcher, state: state(), nowSeconds: () => 1_000 };
    const disabled = createProductPriceGuideHandler({
      ...base,
      environment: { ...environment, PRODUCT_PRICE_GUIDE_ENABLED: "false" }
    });
    expect((await disabled(incoming(body()))).status).toBe(503);

    const handler = createProductPriceGuideHandler({ ...base, environment });
    expect((await handler(incoming(body(), { cookie: "invalid" }))).status).toBe(401);
    expect((await handler(incoming(body(), { cookie: capability("wrong-session") }))).status).toBe(401);
    expect((await handler(incoming({ ...body(), extra: true }))).status).toBe(400);
    expect((await handler(incoming({ ...body(), productFingerprint: "f".repeat(64) }))).status).toBe(400);
    expect((await handler(incoming(body(), { contentLength: String(16 * 1024 + 1) }))).status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects prose fields, unsafe URLs and a substituted model family", async () => {
    for (const upstream of [
      provider({ ...providerResult, recommendation: "Charge $49" }),
      provider({
        ...providerResult,
        comparables: [providerResult.comparables[0], {
          ...providerResult.comparables[1],
          sourceUrl: "http://sample.example/tumbler"
        }]
      }),
      provider(providerResult, "another/model")
    ]) {
      const fetcher = vi.fn().mockResolvedValue(upstream);
      const handler = createProductPriceGuideHandler({
        environment,
        fetch: fetcher,
        state: state(),
        nowSeconds: () => 1_000,
        createDeadlineSignal: () => new AbortController().signal
      });
      expect((await handler(incoming(body()))).status).toBe(502);
      expect(fetcher).toHaveBeenCalledOnce();
    }
  });
});
