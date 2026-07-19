// @vitest-environment node

import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_ASSET_SCHEMA,
  ACCOUNT_ASSET_VERSION,
  AccountAssetError
} from "./lib/account-assets";
import { ACCOUNT_ACCESS_COOKIE, ACCOUNT_REFRESH_COOKIE } from "./lib/account-primitives";
import { createAccountAssetsHandler } from "./account-assets.mjs";

const USER_A = "b9b32e20-0ba8-4896-b89f-44efdfc52942";
const USER_B = "99250725-52e0-44c9-b569-593167786eaf";
const environment = {
  SUPABASE_URL: "https://jftpeajvpqmxabuscoml.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${"p".repeat(32)}`,
  ADVERTISING_GAME_EDGE_GATEWAY_SECRET: "g".repeat(43),
  ADVERTISING_GAME_USERNAME_HMAC_SECRET: "h".repeat(32),
  ADVERTISING_GAME_CLASSROOM_CODE: "classroom-access",
  ADVERTISING_GAME_ASSET_NAMESPACE_SECRET: "n".repeat(32)
};

const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01
]);
const digest = createHash("sha256").update(png).digest("hex");
const path = `/api/account/assets/${digest}`;

const json = (body: unknown, status = 200): Response => Response.json(body, { status });
const userResponse = (userId = USER_A, username = "team-one"): Response => json({
  id: userId,
  email: "opaque@accounts.admarket.invalid",
  app_metadata: { advertising_game_username: username }
});

const bufferFor = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const request = (
  method: "GET" | "PUT" | "DELETE",
  suffix = path,
  options: { body?: Uint8Array; headers?: Record<string, string> } = {}
): Request => new Request(`https://game.example${suffix}`, {
  method,
  headers: {
    cookie: `${ACCOUNT_ACCESS_COOKIE}=access-token`,
    "x-admarket-account": "team-one",
    ...(method === "PUT" ? {
      origin: "https://game.example",
      "content-type": "image/png"
    } : {}),
    ...options.headers
  },
  ...(options.body === undefined ? {} : { body: bufferFor(options.body) })
});

const manifest = {
  schema: ACCOUNT_ASSET_SCHEMA,
  version: ACCOUNT_ASSET_VERSION,
  asset: {
    id: digest,
    sha256: digest,
    contentType: "image/png" as const,
    byteLength: png.byteLength,
    href: path
  }
};

const fakeService = () => ({
  put: vi.fn().mockResolvedValue({ created: true, manifest }),
  get: vi.fn().mockResolvedValue({
    descriptor: { sha256: digest, contentType: "image/png", byteLength: png.byteLength },
    bytes: png
  })
});

describe("account asset API", () => {
  it("rejects a stale tab identity before asset storage and preserves rotated current-account cookies", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({
        access_token: "current-b-access",
        refresh_token: "current-b-refresh",
        expires_in: 1800
      }))
      .mockResolvedValueOnce(userResponse(USER_B, "team-two"));
    const service = fakeService();

    const response = await createAccountAssetsHandler({ environment, fetcher, service })(
      request("PUT", path, {
        body: png,
        headers: {
          cookie: `${ACCOUNT_ACCESS_COOKIE}=stale-access; ` +
            `${ACCOUNT_REFRESH_COOKIE}=current-b-refresh-before-rotation`,
          "x-admarket-account": "team-one"
        }
      })
    );

    expect(response.status).toBe(409);
    expect(await response.text()).toBe('{"error":"ACCOUNT_IDENTITY_CHANGED"}');
    expect(service.put).not.toHaveBeenCalled();
    expect(service.get).not.toHaveBeenCalled();
    const cookies = response.headers.get("set-cookie") ?? "";
    expect(cookies).toContain(`${ACCOUNT_ACCESS_COOKIE}=current-b-access`);
    expect(cookies).toContain(`${ACCOUNT_REFRESH_COOKIE}=current-b-refresh`);
    expect(cookies).not.toContain("Max-Age=0");
  });

  it("accepts an authenticated same-origin immutable PUT and returns only manifest metadata", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(userResponse());
    const service = fakeService();
    const response = await createAccountAssetsHandler({ environment, fetcher, service })(
      request("PUT", path, { body: png })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(manifest);
    expect(service.put).toHaveBeenCalledWith(USER_A, digest, "image/png", png);
    const responseMetadata = JSON.stringify({
      headers: [...response.headers.entries()].filter(([name]) => name !== "set-cookie"),
      manifest
    });
    expect(responseMetadata).not.toContain(USER_A);
    expect(responseMetadata).not.toContain("access-token");
    expect(responseMetadata).not.toContain(environment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 200 for an idempotent repeat PUT", async () => {
    const service = fakeService();
    service.put.mockResolvedValue({ created: false, manifest });
    const response = await createAccountAssetsHandler({
      environment,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(userResponse()),
      service
    })(request("PUT", path, { body: png }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(manifest);
  });

  it("returns authenticated binary bytes with private no-store and anti-sniff headers", async () => {
    const service = fakeService();
    const response = await createAccountAssetsHandler({
      environment,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(userResponse()),
      service
    })(request("GET"));
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(png);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-length")).toBe(String(png.byteLength));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(service.get).toHaveBeenCalledWith(USER_A, digest);
  });

  it("refreshes authentication before storage and rotates both cookies", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({
        access_token: "rotated-access",
        refresh_token: "rotated-refresh",
        expires_in: 1800
      }))
      .mockResolvedValueOnce(userResponse());
    const response = await createAccountAssetsHandler({
      environment,
      fetcher,
      service: fakeService()
    })(request("GET", path, {
      headers: {
        cookie: `${ACCOUNT_ACCESS_COOKIE}=expired-access; ` +
          `${ACCOUNT_REFRESH_COOKIE}=refresh-token`
      }
    }));
    expect(response.status).toBe(200);
    const cookies = response.headers.get("set-cookie") ?? "";
    expect(cookies).toContain(`${ACCOUNT_ACCESS_COOKIE}=rotated-access`);
    expect(cookies).toContain(`${ACCOUNT_REFRESH_COOKIE}=rotated-refresh`);
  });

  it("preserves rotated cookies when downstream asset storage fails", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({
        access_token: "rotated-access",
        refresh_token: "rotated-refresh",
        expires_in: 1800
      }))
      .mockResolvedValueOnce(userResponse());
    const service = fakeService();
    service.get.mockRejectedValue(new AccountAssetError("ASSET_UNAVAILABLE"));
    const response = await createAccountAssetsHandler({ environment, fetcher, service })(
      request("GET", path, {
        headers: {
          cookie: `${ACCOUNT_ACCESS_COOKIE}=expired-access; ` +
            `${ACCOUNT_REFRESH_COOKIE}=refresh-token`
        }
      })
    );

    expect(response.status).toBe(503);
    const cookies = response.headers.get("set-cookie") ?? "";
    expect(cookies).toContain(`${ACCOUNT_ACCESS_COOKIE}=rotated-access`);
    expect(cookies).toContain(`${ACCOUNT_REFRESH_COOKIE}=rotated-refresh`);
  });

  it("requires authentication and clears expired cookies before asset access", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({ message: "refresh expired" }, 400));
    const service = fakeService();
    const response = await createAccountAssetsHandler({ environment, fetcher, service })(
      request("GET", path, {
        headers: {
          cookie: `${ACCOUNT_ACCESS_COOKIE}=expired-access; ` +
            `${ACCOUNT_REFRESH_COOKIE}=expired-refresh`
        }
      })
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "AUTHENTICATION_REQUIRED" });
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(service.get).not.toHaveBeenCalled();
  });

  it("rejects cross-origin PUT, user-ID query parameters, SVG, and unsupported methods before storage", async () => {
    for (const candidate of [
      request("PUT", path, { body: png, headers: { origin: "https://evil.example" } }),
      request("GET", `${path}?userId=${USER_A}`),
      request("PUT", path, {
        body: new TextEncoder().encode("<svg></svg>"),
        headers: { "content-type": "image/svg+xml" }
      }),
      request("DELETE")
    ]) {
      const fetcher = vi.fn<typeof fetch>();
      const service = fakeService();
      const response = await createAccountAssetsHandler({ environment, fetcher, service })(candidate);
      expect([400, 403, 405, 415]).toContain(response.status);
      expect(fetcher).not.toHaveBeenCalled();
      expect(service.put).not.toHaveBeenCalled();
      expect(service.get).not.toHaveBeenCalled();
    }
  });

  it("rejects declared and streamed bodies above 4 MiB", async () => {
    const handler = createAccountAssetsHandler({
      environment,
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(userResponse()),
      service: fakeService()
    });
    const declared = await handler(request("PUT", path, {
      body: png,
      headers: { "content-length": String(4 * 1_024 * 1_024 + 1) }
    }));
    expect(declared.status).toBe(413);

    const oversized = new Uint8Array(4 * 1_024 * 1_024 + 1);
    const streamed = await handler(request("PUT", path, { body: oversized }));
    expect(streamed.status).toBe(413);
  });

  it("maps domain and storage failures to bounded token-free errors", async () => {
    const cases = [
      [new AccountAssetError("ASSET_HASH_MISMATCH"), 422, "ASSET_HASH_MISMATCH"],
      [new AccountAssetError("ASSET_QUOTA_EXCEEDED"), 409, "ASSET_QUOTA_EXCEEDED"],
      [new AccountAssetError("ASSET_NOT_FOUND"), 404, "ASSET_NOT_FOUND"],
      [new Error(environment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET), 503, "ASSET_UNAVAILABLE"]
    ] as const;
    for (const [error, status, code] of cases) {
      const service = fakeService();
      service.get.mockRejectedValue(error);
      const response = await createAccountAssetsHandler({
        environment,
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(userResponse()),
        service
      })(request("GET"));
      expect(response.status).toBe(status);
      const text = await response.text();
      expect(text).toBe(`{"error":"${code}"}`);
      expect(text).not.toContain(environment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET);
    }
  });

  it("fails closed without the namespace secret and never calls storage", async () => {
    const service = fakeService();
    const response = await createAccountAssetsHandler({
      environment: { ...environment, ADVERTISING_GAME_ASSET_NAMESPACE_SECRET: undefined },
      fetcher: vi.fn<typeof fetch>(),
      service
    })(request("GET"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "ASSETS_NOT_CONFIGURED" });
    expect(service.get).not.toHaveBeenCalled();
  });
});
