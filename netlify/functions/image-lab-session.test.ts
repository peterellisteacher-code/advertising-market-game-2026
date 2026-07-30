// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import type { ResolvedAccountSession } from "./lib/account-backend";
import type { ImageLabAllowanceSnapshot } from "./lib/image-lab-allowance-store";
import { createImageLabSessionHandler } from "./image-lab-session.mjs";

const userId = "b9b32e20-0ba8-4896-b89f-44efdfc52942";
const environment = {
  IMAGE_LAB_ENABLED: "true",
  IMAGE_LAB_SCHOOL_APPROVED: "true",
  IMAGE_LAB_ACCOUNT_CAP_USD: "2.00",
  IMAGE_LAB_SIGNING_SECRET: "test-only-test-only-test-only-test-only",
  FAL_KEY: "fal-key"
};

const authenticated = (
  rotatedTokens?: Extract<ResolvedAccountSession, { authenticated: true }>["rotatedTokens"]
): ResolvedAccountSession => ({
  authenticated: true,
  identity: { userId, username: "team-one", resetGeneration: null },
  ...(rotatedTokens === undefined ? {} : { rotatedTokens })
});

const allowance = (
  overrides: Partial<ImageLabAllowanceSnapshot> = {}
): ImageLabAllowanceSnapshot => ({
  status: "available",
  enabled: true,
  object: { granted: 3, consumed: 0, reserved: 1, remaining: 2 },
  realise: { granted: 1, consumed: 0, reserved: 0, remaining: 1 },
  ...overrides
});

const request = (path = "/api/image-lab/session", init?: RequestInit): Request =>
  new Request(`https://game.example${path}`, init);

describe("Image Lab account-bound session function", () => {
  it("requires a pair account before reading server-authoritative status", async () => {
    const status = vi.fn();
    const handler = createImageLabSessionHandler({
      environment,
      resolveSession: vi.fn().mockResolvedValue({
        authenticated: false,
        clearCookies: false
      }),
      allowances: { status }
    });

    const response = await handler(request());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "AUTHENTICATION_REQUIRED" });
    expect(status).not.toHaveBeenCalled();
  });

  it("returns only remaining and reserved counts for the authenticated account", async () => {
    const status = vi.fn().mockResolvedValue(allowance());
    const handler = createImageLabSessionHandler({
      environment,
      resolveSession: vi.fn().mockResolvedValue(authenticated()),
      allowances: { status }
    });

    const response = await handler(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      enabled: true,
      object: { remaining: 2, reserved: 1 },
      realise: { remaining: 1, reserved: 0 }
    });
    expect(status).toHaveBeenCalledWith(userId);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("accepts zero remaining and keeps disabled distinct from unavailable", async () => {
    const zero = vi.fn().mockResolvedValue(allowance({
      object: { granted: 1, consumed: 1, reserved: 0, remaining: 0 },
      realise: { granted: 0, consumed: 0, reserved: 0, remaining: 0 }
    }));
    const zeroHandler = createImageLabSessionHandler({
      environment,
      resolveSession: vi.fn().mockResolvedValue(authenticated()),
      allowances: { status: zero }
    });
    await expect((await zeroHandler(request())).json()).resolves.toEqual({
      enabled: true,
      object: { remaining: 0, reserved: 0 },
      realise: { remaining: 0, reserved: 0 }
    });

    const disabledStatus = vi.fn().mockResolvedValue(allowance({
      status: "disabled",
      enabled: false
    }));
    const disabledHandler = createImageLabSessionHandler({
      environment,
      resolveSession: vi.fn().mockResolvedValue(authenticated()),
      allowances: { status: disabledStatus }
    });
    await expect((await disabledHandler(request())).json()).resolves.toEqual({
      enabled: false,
      reason: "disabled"
    });

    const unavailableHandler = createImageLabSessionHandler({
      environment,
      resolveSession: vi.fn().mockResolvedValue(authenticated()),
      allowances: { status: vi.fn().mockRejectedValue(new Error("private detail")) }
    });
    const unavailable = await unavailableHandler(request());
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({ error: "IMAGE_LAB_UNAVAILABLE" });
  });

  it("keeps static safety gates disabled without exposing their configuration", async () => {
    const status = vi.fn();
    const handler = createImageLabSessionHandler({
      environment: {},
      resolveSession: vi.fn().mockResolvedValue(authenticated()),
      allowances: { status }
    });
    const response = await handler(request());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enabled: false, reason: "disabled" });
    expect(status).not.toHaveBeenCalled();
  });

  it("preserves rotated account cookies without minting an Image Lab capability", async () => {
    const handler = createImageLabSessionHandler({
      environment,
      resolveSession: vi.fn().mockResolvedValue(authenticated({
        accessToken: "rotated-access",
        refreshToken: "rotated-refresh",
        expiresIn: 3_600
      })),
      allowances: { status: vi.fn().mockResolvedValue(allowance()) }
    });
    const response = await handler(request());
    const cookies = response.headers.get("set-cookie") ?? "";
    expect(cookies).toContain("admarket_account_access=rotated-access");
    expect(cookies).toContain("admarket_account_refresh=rotated-refresh");
    expect(cookies).not.toContain("admarket_image_lab");
  });

  it("rejects student-supplied identities, codes and retired routes", async () => {
    const status = vi.fn().mockResolvedValue(allowance());
    const handler = createImageLabSessionHandler({
      environment,
      resolveSession: vi.fn().mockResolvedValue(authenticated()),
      allowances: { status }
    });
    for (const untrusted of [
      request("/api/image-lab/session?userId=someone-else"),
      request("/api/image-lab/session?sessionId=session-a"),
      request("/api/image-lab/session", { headers: { "x-admarket-account": "team-one" } }),
      request("/api/image-lab/session", { headers: { "x-image-lab-code": "teacher-code" } })
    ]) {
      expect((await handler(untrusted)).status).toBe(400);
    }
    expect((await handler(request("/api/image-lab/unlock", { method: "POST" }))).status)
      .toBe(404);
    expect((await handler(request("/api/image-lab/lock", { method: "POST" }))).status)
      .toBe(404);
    expect((await handler(request("/api/image-lab/config"))).status).toBe(404);
    expect((await handler(request("/api/image-lab/session", { method: "POST" }))).status)
      .toBe(405);
    expect(status).not.toHaveBeenCalled();
  });
});
