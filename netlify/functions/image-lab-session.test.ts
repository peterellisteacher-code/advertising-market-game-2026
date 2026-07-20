// @vitest-environment node

import { describe, expect, it } from "vitest";
import { IMAGE_LAB_COOKIE, readCapability } from "./lib/image-lab-auth";
import { ImageLabStateService, MemoryImageLabStateRepository } from "./lib/image-lab-state";
import { createImageLabSessionHandler } from "./image-lab-session.mjs";

const secret = "0123456789abcdef0123456789abcdef";
const environment = {
  IMAGE_LAB_ENABLED: "true",
  IMAGE_LAB_SCHOOL_APPROVED: "true",
  IMAGE_LAB_FAL_MINOR_USE_APPROVED: "true",
  IMAGE_LAB_ACCOUNT_CAP_USD: "2.00",
  IMAGE_LAB_CLASSROOM_CODE: "Market-2026!",
  IMAGE_LAB_SIGNING_SECRET: secret,
  FAL_KEY: "fal-key"
};

const request = (path: string, init?: RequestInit): Request =>
  new Request(`https://game.example${path}`, init);

const createState = (): ImageLabStateService =>
  new ImageLabStateService(new MemoryImageLabStateRepository());

describe("Image Lab session function", () => {
  it("reports a disabled-by-default, zero-secret configuration", async () => {
    const handler = createImageLabSessionHandler({ environment: {}, nowSeconds: () => 1_000 });
    const response = await handler(request("/api/image-lab/config"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enabled: false, reason: "disabled" });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("reports bounded public settings without leaking secrets", async () => {
    const handler = createImageLabSessionHandler({ environment, nowSeconds: () => 1_000 });
    const response = await handler(request("/api/image-lab/config"));
    const body = await response.json();
    expect(body).toEqual({
      enabled: true,
      unlocked: false,
      accountCapUsd: 2,
      objectAllowance: 6,
      realiseAllowance: 2
    });
    expect(JSON.stringify(body)).not.toContain("fal-key");
    expect(JSON.stringify(body)).not.toContain("Market-2026");
    expect(JSON.stringify(body)).not.toContain(secret);
  });

  it("unlocks one pair with a scoped, signed HttpOnly cookie", async () => {
    const handler = createImageLabSessionHandler({
      environment,
      nowSeconds: () => 1_000,
      secureCookies: true,
      state: createState()
    });
    const response = await handler(request("/api/image-lab/unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: "Market-2026!",
        sessionId: "session-a",
        teamId: "pair-3"
      })
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      unlocked: true,
      remainingObject: 6,
      remainingRealise: 2,
      expiresAt: 5_500
    });
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain(`${IMAGE_LAB_COOKIE}=`);
    const token = cookie.match(new RegExp(`${IMAGE_LAB_COOKIE}=([^;]+)`))?.[1];
    expect(readCapability(token!, secret, 1_000)).toMatchObject({
      sessionId: "session-a",
      teamId: "pair-3",
      remainingObject: 6,
      remainingRealise: 2,
      expiresAt: 5_500
    });
  });

  it("closes Image Lab immediately with an expired pair capability cookie", async () => {
    const handler = createImageLabSessionHandler({
      environment,
      nowSeconds: () => 1_000,
      secureCookies: true
    });
    const response = await handler(request("/api/image-lab/lock", { method: "POST" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ unlocked: false });
    const cookie = response.headers.get("set-cookie")!;
    expect(cookie).toContain(`${IMAGE_LAB_COOKIE}=;`);
    expect(cookie).toContain("Path=/api/image-lab");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Secure");
  });

  it("does not reset spent sparks when the teacher unlock is replayed", async () => {
    const state = createState();
    await state.unlock({ sessionId: "session-a", teamId: "pair-3" }, {
      objectAllowance: 6,
      realiseAllowance: 2,
      expiresAt: 8_200
    });
    await state.reserve({ sessionId: "session-a", teamId: "pair-3" }, {
      idempotencyKey: "123e4567-e89b-42d3-a456-426614174000",
      requestHash: "a".repeat(64),
      stage: "object-forge",
      profileId: "object-forge-v1",
      nowSeconds: 1_000
    });
    const handler = createImageLabSessionHandler({
      environment,
      nowSeconds: () => 1_100,
      secureCookies: true,
      state
    });
    const response = await handler(request("/api/image-lab/unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "Market-2026!", sessionId: "session-a", teamId: "pair-3" })
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ remainingObject: 5, remainingRealise: 2 });
  });

  it("rejects wrong codes and malformed or oversized requests without setting a cookie", async () => {
    const handler = createImageLabSessionHandler({ environment, nowSeconds: () => 1_000 });
    const wrong = await handler(request("/api/image-lab/unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "Wrong-2026!", sessionId: "session-a", teamId: "pair-3" })
    }));
    expect(wrong.status).toBe(401);
    expect(wrong.headers.has("set-cookie")).toBe(false);

    const extra = await handler(request("/api/image-lab/unlock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: "Market-2026!",
        sessionId: "session-a",
        teamId: "pair-3",
        model: "any-model"
      })
    }));
    expect(extra.status).toBe(400);

    const oversized = await handler(request("/api/image-lab/unlock", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "9000" },
      body: "{}"
    }));
    expect(oversized.status).toBe(413);
  });

  it("uses exact routes, methods and JSON media types", async () => {
    const handler = createImageLabSessionHandler({ environment, nowSeconds: () => 1_000 });
    expect((await handler(request("/api/image-lab/config", { method: "POST" }))).status).toBe(405);
    expect((await handler(request("/api/image-lab/lock", { method: "GET" }))).status).toBe(405);
    expect((await handler(request("/api/image-lab/unlock", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}"
    }))).status).toBe(415);
    expect((await handler(request("/api/image-lab/unknown"))).status).toBe(404);
  });
});
