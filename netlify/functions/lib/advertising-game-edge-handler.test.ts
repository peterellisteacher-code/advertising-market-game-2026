// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { createAdvertisingGameBackendHandler } from "../../../supabase/functions/advertising-game-backend/handler";

const projectUrl = "https://abcdefghijklmnopqrst.supabase.co";
const gatewaySecret = "g".repeat(43);
const serviceKey = `sb_secret_${"s".repeat(32)}`;
const environment = {
  SUPABASE_URL: projectUrl,
  SUPABASE_SECRET_KEYS: JSON.stringify({ default: serviceKey })
};
const userId = "b9b32e20-0ba8-4896-b89f-44efdfc52942";
const syntheticEmail = `${"a".repeat(64)}@accounts.admarket.invalid`;
const secondUserId = "99250725-52e0-44c9-b569-593167786eaf";
const secondSyntheticEmail = `${"b".repeat(64)}@accounts.admarket.invalid`;

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

  it("forwards an exact account-wide progress reset without a document identifier", async () => {
    const upstream = { status: "reset" };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json(upstream));

    const response = await handlerWith(fetcher)(request({
      operation: "progress",
      input: {
        userId,
        operation: "reset",
        schema: "advertising-game-progress",
        version: 1
      }
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(upstream);
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      p_user_id: userId,
      p_operation: "reset",
      p_document_id: null,
      p_document_schema: "advertising-game-progress",
      p_schema_version: 1
    });
  });

  it("validates and translates an exact Image Lab ledger envelope to the service-only RPC", async () => {
    const upstream = {
      status: "reserved",
      enabled: true,
      object: { granted: 3, consumed: 0, reserved: 1, remaining: 2 },
      realise: { granted: 1, consumed: 0, reserved: 0, remaining: 1 }
    };
    const input = {
      userId,
      ledgerOperation: "reserve",
      stage: "object",
      amount: 1,
      operationId: "image-job:request-123",
      jobKey: "request-123",
      requestHash: "a".repeat(64)
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json(upstream));

    const response = await handlerWith(fetcher)(request({
      operation: "image_lab",
      input
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(upstream);
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      `${projectUrl}/rest/v1/rpc/advertising_game_image_lab_rpc`
    );
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      p_user_id: userId,
      p_operation: "reserve",
      p_stage: "object",
      p_amount: 1,
      p_operation_id: "image-job:request-123",
      p_job_key: "request-123",
      p_request_hash: "a".repeat(64)
    });
    expect(fetcher.mock.calls[1]?.[1]?.headers).toEqual(expect.objectContaining({
      apikey: serviceKey
    }));
  });

  it("maps private Image Lab user IDs to bounded account aliases only inside the broker", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({
        status: "available",
        enabled: true,
        object: { granted: 2, consumed: 0, reserved: 0, remaining: 2 },
        realise: { granted: 1, consumed: 0, reserved: 0, remaining: 1 },
        accounts: [{
          userId,
          object: { granted: 4, consumed: 1, reserved: 1, remaining: 2 },
          realise: { granted: 1, consumed: 0, reserved: 0, remaining: 1 }
        }]
      }))
      .mockResolvedValueOnce(json({
        users: [
          {
            id: userId,
            email: syntheticEmail,
            created_at: "2026-07-20T00:00:00.000Z",
            last_sign_in_at: null,
            app_metadata: { advertising_game_username: "team-one" }
          },
          {
            id: secondUserId,
            email: secondSyntheticEmail,
            created_at: "2026-07-20T00:01:00.000Z",
            last_sign_in_at: null,
            app_metadata: { advertising_game_username: "team-two" }
          }
        ],
        next_page: null
      }));

    const response = await handlerWith(fetcher)(request({
      operation: "image_lab",
      input: {
        ledgerOperation: "list",
        operationId: "teacher-list:request-123",
        requestHash: "b".repeat(64)
      }
    }));

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody).toEqual({
      status: "available",
      enabled: true,
      object: { granted: 2, consumed: 0, reserved: 0, remaining: 2 },
      realise: { granted: 1, consumed: 0, reserved: 0, remaining: 1 },
      accounts: [
        {
          alias: "team-one",
          object: { granted: 4, consumed: 1, reserved: 1, remaining: 2 },
          realise: { granted: 1, consumed: 0, reserved: 0, remaining: 1 }
        },
        {
          alias: "team-two",
          object: { granted: 0, consumed: 0, reserved: 0, remaining: 0 },
          realise: { granted: 0, consumed: 0, reserved: 0, remaining: 0 }
        }
      ]
    });
    expect(JSON.stringify(responseBody)).not.toContain(userId);
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      p_user_id: null,
      p_operation: "list",
      p_stage: null,
      p_amount: null,
      p_operation_id: "teacher-list:request-123",
      p_job_key: null,
      p_request_hash: "b".repeat(64)
    });
  });

  it("rejects malformed Image Lab fields and sanitises ledger failures", async () => {
    const valid = {
      operation: "image_lab",
      input: {
        userId,
        ledgerOperation: "reserve",
        stage: "object",
        amount: 1,
        operationId: "image-job:request-123",
        jobKey: "request-123",
        requestHash: "a".repeat(64)
      }
    };
    for (const invalid of [
      { ...valid, extra: true },
      { ...valid, input: { ...valid.input, userId: "not-a-uuid" } },
      { ...valid, input: { ...valid.input, stage: "both" } },
      { ...valid, input: { ...valid.input, amount: 101 } },
      { ...valid, input: { ...valid.input, operationId: "../unsafe" } },
      { ...valid, input: { ...valid.input, requestHash: "not-a-hash" } },
      { ...valid, input: { ...valid.input, surprise: true } }
    ]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(true));
      const response = await handlerWith(fetcher)(request(invalid));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "INVALID_REQUEST" });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }

    const failedFetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({ detail: gatewaySecret }, 500));
    const failed = await handlerWith(failedFetcher)(request(valid));
    expect(failed.status).toBe(503);
    expect(await failed.text()).toBe('{"error":"BACKEND_UNAVAILABLE"}');
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

  it("lists only bounded advertising accounts, excludes the playtest identity and sorts aliases", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({
        users: [
          {
            id: userId,
            email: syntheticEmail,
            created_at: "2026-07-20T00:00:00.000Z",
            last_sign_in_at: null,
            app_metadata: { advertising_game_username: "team-zed" }
          },
          {
            id: "e5be4a1b-4476-4fa8-957b-3cf722bd641e",
            email: `${"c".repeat(64)}@accounts.admarket.invalid`,
            created_at: "2026-07-21T00:00:00.000Z",
            last_sign_in_at: null,
            app_metadata: { advertising_game_username: "teacher-playtest" }
          },
          {
            id: secondUserId,
            email: secondSyntheticEmail,
            created_at: "2026-07-19T00:00:00.000Z",
            last_sign_in_at: "2026-07-26T01:00:00.000Z",
            app_metadata: { advertising_game_username: "team-alpha" }
          },
          {
            id: "not-an-advertising-user",
            email: "ordinary@example.com",
            app_metadata: {}
          }
        ],
        next_page: null
      }));

    const response = await handlerWith(fetcher)(request({ operation: "list_users" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      users: [
        {
          userId: secondUserId,
          username: "team-alpha",
          createdAt: "2026-07-19T00:00:00.000Z",
          lastSignInAt: "2026-07-26T01:00:00.000Z"
        },
        {
          userId,
          username: "team-zed",
          createdAt: "2026-07-20T00:00:00.000Z",
          lastSignInAt: null
        }
      ]
    });
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      `${projectUrl}/auth/v1/admin/users?page=1&per_page=1000`
    );
    expect(fetcher.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      method: "GET",
      redirect: "error"
    }));
  });

  it("fails closed rather than omitting a second Admin user page", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({ users: [], next_page: 2 }));

    const response = await handlerWith(fetcher)(request({ operation: "list_users" }));

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":"BACKEND_UNAVAILABLE"}');
  });

  it("matches both synthetic email and app metadata before replacing a password", async () => {
    const epoch = "db782ac2-521d-4ef7-b4ee-2c78f90cb6e0";
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({
        users: [{
          id: userId,
          email: syntheticEmail,
          created_at: "2026-07-20T00:00:00.000Z",
          last_sign_in_at: "2026-07-26T01:00:00.000Z",
          app_metadata: { advertising_game_username: "team-one" }
        }],
        next_page: null
      }))
      .mockResolvedValueOnce(json({
        id: userId,
        app_metadata: {
          advertising_game_username: "team-one",
          advertising_game_session_epoch: epoch
        }
      }));
    const handler = createAdvertisingGameBackendHandler({
      environment,
      fetcher,
      randomUUID: () => epoch
    });

    const response = await handler(request({
      operation: "replace_password",
      email: syntheticEmail,
      username: "team-one",
      password: "replacement-password"
    }));

    expect(response.status).toBe(204);
    expect(fetcher.mock.calls[2]?.[0]).toBe(
      `${projectUrl}/auth/v1/admin/users/${userId}`
    );
    expect(fetcher.mock.calls[2]?.[1]).toEqual(expect.objectContaining({
      method: "PUT",
      redirect: "error"
    }));
    expect(JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body))).toEqual({
      password: "replacement-password",
      app_metadata: {
        advertising_game_username: "team-one",
        advertising_game_session_epoch: epoch
      }
    });
  });

  it("rejects conflicting identities and reserves ensure-user for the teacher playtest", async () => {
    const conflictFetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({
        users: [{
          id: userId,
          email: syntheticEmail,
          created_at: "2026-07-20T00:00:00.000Z",
          last_sign_in_at: null,
          app_metadata: { advertising_game_username: "another-team" }
        }],
        next_page: null
      }));
    const conflict = await handlerWith(conflictFetcher)(request({
      operation: "find_user",
      email: syntheticEmail,
      username: "team-one"
    }));
    expect(conflict.status).toBe(503);

    const playtestEmail = `${"d".repeat(64)}@accounts.admarket.invalid`;
    const ensureFetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(true))
      .mockResolvedValueOnce(json({ users: [], next_page: null }))
      .mockResolvedValueOnce(json({
        id: secondUserId,
        email: playtestEmail,
        created_at: "2026-07-27T00:00:00.000Z",
        last_sign_in_at: null,
        app_metadata: { advertising_game_username: "teacher-playtest" }
      }, 201));
    const ensured = await handlerWith(ensureFetcher)(request({
      operation: "ensure_user",
      email: playtestEmail,
      username: "teacher-playtest",
      password: "server-derived-password"
    }));
    expect(ensured.status).toBe(200);
    await expect(ensured.json()).resolves.toEqual({
      user: {
        userId: secondUserId,
        username: "teacher-playtest",
        createdAt: "2026-07-27T00:00:00.000Z",
        lastSignInAt: null
      }
    });
    expect(JSON.parse(String(ensureFetcher.mock.calls[2]?.[1]?.body))).toEqual({
      email: playtestEmail,
      password: "server-derived-password",
      email_confirm: true,
      app_metadata: { advertising_game_username: "teacher-playtest" }
    });

    for (const body of [
      {
        operation: "create_user",
        email: playtestEmail,
        username: "teacher-playtest",
        password: "student-password"
      },
      {
        operation: "ensure_user",
        email: syntheticEmail,
        username: "team-one",
        password: "student-password"
      }
    ]) {
      const response = await handlerWith(
        vi.fn<typeof fetch>().mockResolvedValueOnce(json(true))
      )(request(body));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "INVALID_REQUEST" });
    }
  });
});
