// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { createAdvertisingGameBackendHandler } from "../../../supabase/functions/advertising-game-backend/handler";

const projectUrl = "https://jftpeajvpqmxabuscoml.supabase.co";
const gatewaySecret = "g".repeat(43);
const serviceKey = `sb_secret_${"s".repeat(32)}`;
const environment = {
  SUPABASE_URL: projectUrl,
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: serviceKey })
};
const userId = "b9b32e20-0ba8-4896-b89f-44efdfc52942";
const syntheticEmail = `${"a".repeat(64)}@accounts.admarket.invalid`;

const json = (body: unknown, status = 200): Response => Response.json(body, { status });

const request = (body: unknown, secret = gatewaySecret): Request => new Request(
  `${projectUrl}/functions/v1/advertising-game-backend`,
  {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-advertising-game-gateway-secret": secret
    },
    body: JSON.stringify(body)
  }
);

const handlerWith = (fetcher: typeof fetch) => createAdvertisingGameBackendHandler({
  environment,
  fetcher
});

describe("Advertising-game Supabase Edge broker", () => {
  it("rejects a missing or unauthorised gateway secret without reflecting it", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(false));
    const handler = handlerWith(fetcher);

    const missing = await handler(new Request(
      `${projectUrl}/functions/v1/advertising-game-backend`,
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }
    ));
    expect(missing.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();

    const wrongSecret = "w".repeat(43);
    const rejected = await handler(request({ operation: "progress", input: {} }, wrongSecret));
    expect(rejected.status).toBe(401);
    expect(await rejected.text()).toBe('{"error":"AUTHENTICATION_REQUIRED"}');
    expect(await Promise.resolve(JSON.stringify([...rejected.headers]))).not.toContain(wrongSecret);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("authorises then creates only a confirmed synthetic-email pair account", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({ id: userId }, 201));
    const response = await handlerWith(fetcher)(request({
      operation: "create_user",
      email: syntheticEmail,
      password: "student-password",
      username: "team-one"
    }));

    expect(response.status).toBe(204);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      `${projectUrl}/rest/v1/rpc/advertising_game_backend_authorized`
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      p_candidate: gatewaySecret
    });
    expect(fetcher.mock.calls[1]?.[0]).toBe(`${projectUrl}/auth/v1/admin/users`);
    expect(fetcher.mock.calls[1]?.[1]?.headers).toEqual(expect.objectContaining({
      apikey: serviceKey
    }));
    expect(fetcher.mock.calls[1]?.[1]?.headers).not.toHaveProperty("authorization");
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      email: syntheticEmail,
      password: "student-password",
      email_confirm: true,
      app_metadata: { advertising_game_username: "team-one" }
    });
  });

  it("maps only an upstream duplicate to the bounded username response", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({ code: "email_exists", detail: gatewaySecret }, 422));
    const response = await handlerWith(fetcher)(request({
      operation: "create_user",
      email: syntheticEmail,
      password: "student-password",
      username: "team-one"
    }));

    expect(response.status).toBe(409);
    expect(await response.text()).toBe('{"error":"USERNAME_UNAVAILABLE"}');
  });

  it("validates and translates a bounded progress envelope to the existing service-only RPC", async () => {
    const document = {
      schemaVersion: 1,
      documentId: "campaign-main",
      mode: "offline",
      teamId: "practice-team",
      revision: 0
    };
    const upstream = {
      status: "saved",
      revision: 1,
      updatedAt: "2026-07-19T08:00:00.000Z"
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json(upstream));
    const response = await handlerWith(fetcher)(request({
      operation: "progress",
      input: {
        userId,
        operation: "save",
        documentId: "campaign-main",
        schema: "advertising-game-progress",
        version: 1,
        expectedRevision: 0,
        document
      }
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(upstream);
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      `${projectUrl}/rest/v1/rpc/advertising_game_progress_rpc`
    );
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      p_user_id: userId,
      p_operation: "save",
      p_document_id: "campaign-main",
      p_document_schema: "advertising-game-progress",
      p_schema_version: 1,
      p_expected_revision: 0,
      p_document: document
    });
  });

  it("fails closed for extra fields, invalid identities, malformed JSON, and upstream details", async () => {
    const authorised = () => vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(true));
    for (const body of [
      { operation: "create_user", email: syntheticEmail, password: "student-password", username: "Team One" },
      { operation: "progress", input: { userId: "not-a-uuid", operation: "list", schema: "advertising-game-progress", version: 1 } },
      { operation: "progress", input: { userId, operation: "list", schema: "advertising-game-progress", version: 1 }, extra: true }
    ]) {
      const response = await handlerWith(authorised())(request(body));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "INVALID_REQUEST" });
    }

    const malformedFetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(true));
    const malformed = await handlerWith(malformedFetcher)(new Request(
      `${projectUrl}/functions/v1/advertising-game-backend`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-advertising-game-gateway-secret": gatewaySecret
        },
        body: "{"
      }
    ));
    expect(malformed.status).toBe(400);

    const failedFetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({ detail: gatewaySecret }, 500));
    const failed = await handlerWith(failedFetcher)(request({
      operation: "progress",
      input: { userId, operation: "list", schema: "advertising-game-progress", version: 1 }
    }));
    expect(failed.status).toBe(503);
    expect(await failed.text()).toBe('{"error":"BACKEND_UNAVAILABLE"}');
  });
});
