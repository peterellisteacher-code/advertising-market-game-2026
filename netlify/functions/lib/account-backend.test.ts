// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { createBlankCampaignDocument } from "../../../web/src/domain/campaign-document";
import {
  ACCOUNT_RESET_GENERATION_COOKIE,
  deriveSyntheticAccountEmail
} from "./account-primitives";
import {
  ACCOUNT_JSON_LIMIT,
  PROGRESS_JSON_LIMIT,
  AccountConfigurationError,
  AccountRequestError,
  SupabaseAccountClient,
  SupabaseAccountError,
  accountJson,
  assertSameOriginPost,
  parseAccountCookies,
  parseAccountEnvironment,
  readAccountJson,
  resolveAccountSession,
  secureAccountCodeMatches
} from "./account-backend";

const modernEnvironment = {
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${"p".repeat(32)}`,
  ADVERTISING_GAME_EDGE_GATEWAY_SECRET: "g".repeat(43),
  ADVERTISING_GAME_USERNAME_HMAC_SECRET: "h".repeat(32),
  ADVERTISING_GAME_CLASSROOM_CODE: "classroom-access"
};

const validCampaignDocument = () => createBlankCampaignDocument({
  documentId: "campaign-main",
  sessionId: "practice-session",
  mode: "offline"
});

const responseJson = (body: unknown, status = 200): Response => Response.json(body, { status });

const legacyJwt = (role: "anon" | "service_role"): string => {
  const encode = (value: unknown): string => Buffer.from(JSON.stringify(value), "utf8")
    .toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role, exp: 4_102_444_800 })}.${"x".repeat(43)}`;
};

const accessJwt = (sessionEpoch: string): string => {
  const encode = (value: unknown): string => Buffer.from(JSON.stringify(value), "utf8")
    .toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    app_metadata: { advertising_game_session_epoch: sessionEpoch },
    exp: 4_102_444_800
  })}.${"x".repeat(43)}`;
};

describe("account environment", () => {
  it("accepts a strict Supabase project URL and modern server-bounded values", () => {
    expect(parseAccountEnvironment(modernEnvironment)).toEqual({
      supabaseUrl: modernEnvironment.SUPABASE_URL,
      publishableKey: modernEnvironment.SUPABASE_PUBLISHABLE_KEY,
      edgeGatewaySecret: modernEnvironment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET,
      usernameHmacSecret: modernEnvironment.ADVERTISING_GAME_USERNAME_HMAC_SECRET,
      classroomCode: modernEnvironment.ADVERTISING_GAME_CLASSROOM_CODE
    });
  });

  it("accepts a legacy anon publishable key without requiring a service-role key", () => {
    const parsed = parseAccountEnvironment({
      ...modernEnvironment,
      SUPABASE_PUBLISHABLE_KEY: legacyJwt("anon")
    });
    expect(parsed.publishableKey).toBe(legacyJwt("anon"));
    expect(parsed.edgeGatewaySecret).toBe(modernEnvironment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET);

    expect(() => parseAccountEnvironment({
      ...modernEnvironment,
      SUPABASE_PUBLISHABLE_KEY: legacyJwt("service_role")
    })).toThrow(AccountConfigurationError);
  });

  it("fails closed for missing, oversized, non-HTTPS, or non-Supabase configuration", () => {
    for (const environment of [
      { ...modernEnvironment, SUPABASE_URL: "http://abcdefghijklmnopqrst.supabase.co" },
      { ...modernEnvironment, SUPABASE_URL: "https://supabase.co.evil.example" },
      { ...modernEnvironment, SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co/rest/v1" },
      { ...modernEnvironment, ADVERTISING_GAME_EDGE_GATEWAY_SECRET: undefined },
      { ...modernEnvironment, ADVERTISING_GAME_EDGE_GATEWAY_SECRET: "short" },
      { ...modernEnvironment, ADVERTISING_GAME_USERNAME_HMAC_SECRET: "short" },
      { ...modernEnvironment, ADVERTISING_GAME_CLASSROOM_CODE: "short" },
      { ...modernEnvironment, ADVERTISING_GAME_CLASSROOM_CODE: "x".repeat(129) }
    ]) {
      expect(() => parseAccountEnvironment(environment)).toThrow(AccountConfigurationError);
    }
  });

  it("compares classroom codes without accepting type, length, or content mismatches", () => {
    expect(secureAccountCodeMatches("classroom-access", "classroom-access")).toBe(true);
    expect(secureAccountCodeMatches("classroom-accesx", "classroom-access")).toBe(false);
    expect(secureAccountCodeMatches("short", "classroom-access")).toBe(false);
    expect(secureAccountCodeMatches(42, "classroom-access")).toBe(false);
    expect(secureAccountCodeMatches("x".repeat(129), "classroom-access")).toBe(false);
  });
});

describe("account HTTP boundaries", () => {
  it("requires an exact same-origin Origin header for POST mutations", () => {
    expect(() => assertSameOriginPost(new Request("https://game.example/api/account/login", {
      method: "POST",
      headers: { origin: "https://game.example" }
    }))).not.toThrow();
    for (const origin of [undefined, "https://evil.example", "null", "https://game.example.evil"] as const) {
      const headers = origin === undefined ? {} : { origin };
      expect(() => assertSameOriginPost(new Request(
        "https://game.example/api/account/login",
        { method: "POST", headers }
      ))).toThrow(AccountRequestError);
    }
  });

  it("compares Origin with the deployment host forwarded by Netlify", () => {
    const previewHost = "6a5cb0208d23f2460d575fbd--advertising-market-game-2026.netlify.app";
    expect(() => assertSameOriginPost(new Request(
      "https://advertising-market-game-2026.netlify.app/api/account/login",
      {
        method: "POST",
        headers: {
          origin: `https://${previewHost}`,
          "x-forwarded-host": previewHost,
          "x-forwarded-proto": "https"
        }
      }
    ))).not.toThrow();

    expect(() => assertSameOriginPost(new Request(
      "https://advertising-market-game-2026.netlify.app/api/account/login",
      {
        method: "POST",
        headers: {
          origin: "https://evil.example",
          "x-forwarded-host": previewHost,
          "x-forwarded-proto": "https"
        }
      }
    ))).toThrow(AccountRequestError);
  });

  it("rejects malformed forwarded deployment hosts", () => {
    expect(() => assertSameOriginPost(new Request("https://game.example/api/account/login", {
      method: "POST",
      headers: {
        origin: "https://game.example",
        "x-forwarded-host": "game.example/evil",
        "x-forwarded-proto": "https"
      }
    }))).toThrow(AccountRequestError);
  });

  it("parses only the three bounded account cookie values", () => {
    const request = new Request("https://game.example/api/account/session", {
      headers: {
        cookie: "other=x; admarket_account_access=access.jwt; admarket_account_refresh=refresh_1; " +
          `${ACCOUNT_RESET_GENERATION_COOKIE}=7440e792-3ddc-4484-ae32-a53088d0d679`
      }
    });
    expect(parseAccountCookies(request)).toEqual({
      accessToken: "access.jwt",
      refreshToken: "refresh_1",
      resetGeneration: "7440e792-3ddc-4484-ae32-a53088d0d679"
    });
    expect(parseAccountCookies(new Request("https://game.example", {
      headers: { cookie: "admarket_account_access=bad%0d%0aheader" }
    }))).toEqual({});
  });

  it("enforces declared and actual JSON byte limits and media type", async () => {
    const valid = new Request("https://game.example/api/account/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "team-one" })
    });
    await expect(readAccountJson(valid, ACCOUNT_JSON_LIMIT)).resolves.toEqual({
      username: "team-one"
    });

    const declared = new Request("https://game.example/api/account/progress", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "content-length": String(PROGRESS_JSON_LIMIT + 1)
      },
      body: "{}"
    });
    await expect(readAccountJson(declared, PROGRESS_JSON_LIMIT)).rejects.toMatchObject({
      code: "REQUEST_TOO_LARGE",
      status: 413
    });

    const actual = new Request("https://game.example/api/account/progress", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: `{"value":"${"é".repeat(PROGRESS_JSON_LIMIT)}"}`
    });
    await expect(readAccountJson(actual, PROGRESS_JSON_LIMIT)).rejects.toMatchObject({
      code: "REQUEST_TOO_LARGE"
    });

    const form = new Request("https://game.example/api/account/login", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}"
    });
    await expect(readAccountJson(form, ACCOUNT_JSON_LIMIT)).rejects.toMatchObject({
      code: "UNSUPPORTED_MEDIA_TYPE",
      status: 415
    });
  });

  it("adds no-store and defensive same-origin API headers", async () => {
    const response = accountJson({ authenticated: false }, 200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-security-policy")).toBe("default-src 'none'; frame-ancestors 'none'");
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    await expect(response.json()).resolves.toEqual({ authenticated: false });
  });
});

describe("Supabase account transport", () => {
  it("rejects cross-origin redirected broker responses without exposing the gateway secret", async () => {
    const redirected = (): Response => {
      const response = responseJson({ leaked: true });
      Object.defineProperty(response, "redirected", { value: true });
      Object.defineProperty(response, "url", { value: "https://attacker.example/capture" });
      return response;
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(redirected());
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);

    for (const operation of [
      () => client.createConfirmedUser(
        "opaque@accounts.admarket.invalid",
        "student-password",
        "team-one"
      ),
      () => client.progressRpc({
        userId: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        operation: "load",
        documentId: "campaign-main",
        schema: "advertising-game-progress",
        version: 1
      })
    ]) {
      const caught = await operation().catch((error: unknown) => error);
      expect(caught).toBeInstanceOf(SupabaseAccountError);
      expect(caught).toMatchObject({ kind: "upstream" });
      expect(String(caught)).not.toContain(modernEnvironment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET);
    }

    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [, init] of fetcher.mock.calls) expect(init?.redirect).toBe("error");
  });

  it("disables redirect following for publishable-key requests", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(responseJson({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600
    }));
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);

    await client.signInWithPassword("opaque@accounts.admarket.invalid", "student-password");

    expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe("error");
  });

  it("creates a confirmed synthetic-email user and signs in without leaking keys in errors", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(responseJson({ id: "b9b32e20-0ba8-4896-b89f-44efdfc52942" }, 201))
      .mockResolvedValueOnce(responseJson({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600
      }));
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);

    await client.createConfirmedUser(
      "opaque@accounts.admarket.invalid",
      "student-password",
      "team-one"
    );
    const tokens = await client.signInWithPassword(
      "opaque@accounts.admarket.invalid",
      "student-password"
    );

    expect(tokens).toEqual({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresIn: 3600
    });
    expect(fetcher).toHaveBeenNthCalledWith(1,
      `${modernEnvironment.SUPABASE_URL}/functions/v1/advertising-game-backend`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-advertising-game-gateway-secret": modernEnvironment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET
        })
      })
    );
    expect(fetcher.mock.calls[0]?.[1]?.headers).not.toHaveProperty("authorization");
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      operation: "create_user",
      email: "opaque@accounts.admarket.invalid",
      password: "student-password",
      username: "team-one"
    });
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("grant_type=password");
    expect(fetcher.mock.calls[1]?.[1]?.headers).toEqual(expect.objectContaining({
      apikey: modernEnvironment.SUPABASE_PUBLISHABLE_KEY
    }));
    expect(fetcher.mock.calls[1]?.[1]?.headers).not.toHaveProperty("authorization");
  });

  it("uses Bearer API-key authorization only for a legacy publishable JWT", async () => {
    const legacyEnvironment = {
      ...modernEnvironment,
      SUPABASE_PUBLISHABLE_KEY: legacyJwt("anon")
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(responseJson({ id: "b9b32e20-0ba8-4896-b89f-44efdfc52942" }, 201))
      .mockResolvedValueOnce(responseJson({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600
      }))
      .mockResolvedValueOnce(responseJson({ status: "found", revision: 1, document: {} }));
    const client = new SupabaseAccountClient(parseAccountEnvironment(legacyEnvironment), fetcher);

    await client.createConfirmedUser("opaque@accounts.admarket.invalid", "student-password", "team-one");
    await client.signInWithPassword("opaque@accounts.admarket.invalid", "student-password");
    await client.progressRpc({
      userId: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
      operation: "load",
      documentId: "campaign-main",
      schema: "advertising-game-progress",
      version: 1
    });

    expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual(expect.objectContaining({
      "x-advertising-game-gateway-secret": legacyEnvironment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET
    }));
    expect(fetcher.mock.calls[0]?.[1]?.headers).not.toHaveProperty("authorization");
    expect(fetcher.mock.calls[1]?.[1]?.headers).toEqual(expect.objectContaining({
      apikey: legacyEnvironment.SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${legacyEnvironment.SUPABASE_PUBLISHABLE_KEY}`
    }));
    expect(fetcher.mock.calls[2]?.[1]?.headers).toEqual(expect.objectContaining({
      "x-advertising-game-gateway-secret": legacyEnvironment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET
    }));
    expect(fetcher.mock.calls[2]?.[1]?.headers).not.toHaveProperty("authorization");
  });

  it("classifies duplicates, generic credentials, expired sessions, and upstream failures", async () => {
    const duplicate = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment),
      vi.fn<typeof fetch>().mockResolvedValue(responseJson({ error: "USERNAME_UNAVAILABLE" }, 409)));
    await expect(duplicate.createConfirmedUser("opaque@accounts.admarket.invalid", "password-1", "team"))
      .rejects.toMatchObject({ kind: "duplicate_user" });

    const invalid = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment),
      vi.fn<typeof fetch>().mockResolvedValue(responseJson({ message: "Invalid login credentials" }, 400)));
    await expect(invalid.signInWithPassword("opaque@accounts.admarket.invalid", "bad-password"))
      .rejects.toMatchObject({ kind: "invalid_credentials" });
    await expect(invalid.getUser("expired-access"))
      .rejects.toMatchObject({ kind: "expired_session" });
    const expiredLogout = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment),
      vi.fn<typeof fetch>().mockResolvedValue(responseJson({ message: "expired" }, 401)));
    await expect(expiredLogout.logout("expired-access"))
      .rejects.toMatchObject({ kind: "expired_session" });

    const failed = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment),
      vi.fn<typeof fetch>().mockRejectedValue(new Error(modernEnvironment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET)));
    const caught = await failed.signInWithPassword("opaque@accounts.admarket.invalid", "password-1")
      .catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(SupabaseAccountError);
    expect(caught).toMatchObject({ kind: "upstream" });
    expect(String(caught)).not.toContain(modernEnvironment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET);
  });

  it("rotates a refresh token, verifies the user, and exposes only validated identity fields", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(responseJson({ message: "expired" }, 401))
      .mockResolvedValueOnce(responseJson({
        access_token: "rotated-access",
        refresh_token: "rotated-refresh",
        expires_in: 1800
      }))
      .mockResolvedValueOnce(responseJson({
        id: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        email: "must-not-be-returned@accounts.admarket.invalid",
        app_metadata: { advertising_game_username: "team-one" }
      }));
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);

    await expect(resolveAccountSession(client, {
      accessToken: "expired-access",
      refreshToken: "refresh-token"
    })).resolves.toEqual({
      authenticated: true,
      identity: {
        userId: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        username: "team-one",
        resetGeneration: null
      },
      rotatedTokens: {
        accessToken: "rotated-access",
        refreshToken: "rotated-refresh",
        expiresIn: 1800
      }
    });
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("grant_type=refresh_token");
    expect(fetcher.mock.calls[2]?.[1]?.headers).toEqual(expect.objectContaining({
      apikey: modernEnvironment.SUPABASE_PUBLISHABLE_KEY,
      authorization: "Bearer rotated-access"
    }));
  });

  it("returns an unauthenticated result when both access and refresh are expired", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(responseJson({ message: "expired" }, 401))
      .mockResolvedValueOnce(responseJson({ message: "expired refresh" }, 400));
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);
    await expect(resolveAccountSession(client, {
      accessToken: "expired-access",
      refreshToken: "expired-refresh"
    })).resolves.toEqual({ authenticated: false, clearCookies: true });
  });

  it("does not let an old refresh cookie reopen a session across a teacher reset", async () => {
    const currentEpoch = "2d90c112-4de8-4e7b-92d2-0d655738987f";
    const currentGeneration = "7440e792-3ddc-4484-ae32-a53088d0d679";
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(responseJson({ message: "expired" }, 401))
      .mockResolvedValueOnce(responseJson({
        access_token: accessJwt(currentEpoch),
        refresh_token: "rotated-refresh",
        expires_in: 1800
      }))
      .mockResolvedValueOnce(responseJson({
        id: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        app_metadata: {
          advertising_game_username: "team-one",
          advertising_game_session_epoch: currentEpoch,
          advertising_game_reset_generation: currentGeneration,
          advertising_game_reset_pending: false
        }
      }));
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);

    await expect(resolveAccountSession(client, {
      accessToken: "expired-access",
      refreshToken: "old-refresh",
      resetGeneration: "7f977c9a-c73c-47c7-93ee-5a40ce302415"
    })).resolves.toEqual({ authenticated: false, clearCookies: true });
  });

  it("calls the scoped Edge broker with the gateway secret and server-derived user ID", async () => {
    const document = validCampaignDocument();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(responseJson({
      status: "saved",
      revision: 1,
      updatedAt: "2026-07-17T01:02:03.000Z"
    }));
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);
    await client.progressRpc({
      userId: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
      operation: "save",
      documentId: "campaign-main",
      schema: "advertising-game-progress",
      version: 1,
      expectedRevision: 0,
      document
    });

    expect(fetcher).toHaveBeenCalledWith(
      `${modernEnvironment.SUPABASE_URL}/functions/v1/advertising-game-backend`,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-advertising-game-gateway-secret": modernEnvironment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET
        })
      })
    );
    expect(fetcher.mock.calls[0]?.[1]?.headers).not.toHaveProperty("authorization");
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(body).toEqual({
      operation: "progress",
      input: {
        userId: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        operation: "save",
        documentId: "campaign-main",
        schema: "advertising-game-progress",
        version: 1,
        expectedRevision: 0,
        document
      }
    });
    expect(JSON.stringify(body)).not.toContain("callerUserId");
  });

  it("uses one exact server-only envelope for an atomic teacher allowance mutation", async () => {
    const result = {
      status: "available",
      enabled: true,
      object: { granted: 4, consumed: 0, reserved: 0, remaining: 4 },
      realise: { granted: 2, consumed: 0, reserved: 0, remaining: 2 },
      accounts: [{
        userId: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        object: { granted: 4, consumed: 0, reserved: 0, remaining: 4 },
        realise: { granted: 2, consumed: 0, reserved: 0, remaining: 2 }
      }]
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(responseJson(result));
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);
    const input = {
      ledgerOperation: "set" as const,
      userIds: ["b9b32e20-0ba8-4896-b89f-44efdfc52942"],
      object: 4,
      realise: 2,
      operationId: "teacher-atomic:1",
      requestHash: "a".repeat(64)
    };

    await expect(client.imageLabTeacherRpc(input)).resolves.toEqual(result);
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      operation: "image_lab_teacher",
      input
    });
    expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual(expect.objectContaining({
      "x-advertising-game-gateway-secret":
        modernEnvironment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET
    }));
    expect(fetcher.mock.calls[0]?.[1]?.headers).not.toHaveProperty("authorization");
  });

  it("sends an exact account-wide reset operation to the scoped Edge broker", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(responseJson({ status: "reset" }));
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);

    await expect(client.progressRpc({
      userId: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
      operation: "reset",
      schema: "advertising-game-progress",
      version: 1
    })).resolves.toEqual({ status: "reset" });

    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      operation: "progress",
      input: {
        userId: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        operation: "reset",
        schema: "advertising-game-progress",
        version: 1
      }
    });
  });

  it("sends an exact bounded Image Lab ledger envelope to the scoped Edge broker", async () => {
    const snapshot = {
      status: "reserved",
      enabled: true,
      object: { granted: 3, consumed: 0, reserved: 1, remaining: 2 },
      realise: { granted: 1, consumed: 0, reserved: 0, remaining: 1 }
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(responseJson(snapshot));
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);
    const input = {
      userId: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
      ledgerOperation: "reserve" as const,
      stage: "object" as const,
      amount: 1,
      operationId: "image-job:request-123",
      jobKey: "request-123",
      requestHash: "a".repeat(64)
    };

    await expect(client.imageLabRpc(input)).resolves.toEqual(snapshot);
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      operation: "image_lab",
      input
    });

    const oversized = vi.fn<typeof fetch>().mockResolvedValue(responseJson({
      ...snapshot,
      padding: "x".repeat(300 * 1_024)
    }));
    await expect(new SupabaseAccountClient(
      parseAccountEnvironment(modernEnvironment),
      oversized
    ).imageLabRpc(input)).rejects.toMatchObject({ kind: "upstream" });
  });

  it("accepts a valid progress RPC response larger than the generic upstream limit", async () => {
    const document = validCampaignDocument();
    document.drawingLayers = [{ notes: "x".repeat(PROGRESS_JSON_LIMIT - 64) }];
    const response = {
      status: "found",
      revision: 7,
      document,
      updatedAt: "2026-07-17T01:02:03.000Z"
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(responseJson(response));
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);

    await expect(client.progressRpc({
      userId: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
      operation: "load",
      documentId: "campaign-main",
      schema: "advertising-game-progress",
      version: 1
    })).resolves.toEqual(response);
  });

  it("uses an exact bounded list RPC request and rejects oversized discovery output", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(responseJson({
      status: "listed",
      documents: [],
      padding: "x".repeat(8 * 1_024)
    }));
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);

    await expect(client.progressRpc({
      userId: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
      operation: "list",
      schema: "advertising-game-progress",
      version: 1
    })).rejects.toMatchObject({ kind: "upstream" });
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      operation: "progress",
      input: {
        userId: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        operation: "list",
        schema: "advertising-game-progress",
        version: 1
      }
    });
  });

  it("uses exact server-only envelopes for bounded account administration", async () => {
    const pairRecord = {
      userId: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
      username: "team-one",
      createdAt: "2026-07-20T01:02:03.000Z",
      lastSignInAt: "2026-07-21T04:05:06.000Z"
    };
    const playtestRecord = {
      userId: "99250725-52e0-44c9-b569-593167786eaf",
      username: "teacher-playtest",
      createdAt: "2026-07-20T02:03:04.000Z",
      lastSignInAt: null
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(responseJson({ users: [pairRecord] }))
      .mockResolvedValueOnce(responseJson({ user: pairRecord }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(responseJson({ user: playtestRecord }));
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);
    const resetOperationId = "7440e792-3ddc-4484-ae32-a53088d0d679";

    await expect(client.listAdvertisingGameUsers()).resolves.toEqual([pairRecord]);
    await expect(client.findAdvertisingGameUser("team-one")).resolves.toEqual(pairRecord);
    await expect(client.replaceAdvertisingGamePassword(
      "team-one",
      "replacement-password"
    )).resolves.toBeUndefined();
    await expect(client.beginAdvertisingGameReset(
      "team-one",
      resetOperationId
    )).resolves.toBeUndefined();
    await expect(client.completeAdvertisingGameReset(
      "team-one",
      resetOperationId
    )).resolves.toBeUndefined();
    await expect(client.ensureAdvertisingGameUser(
      "teacher-playtest",
      "playtest-password"
    )).resolves.toEqual(playtestRecord);

    const syntheticPairEmail = deriveSyntheticAccountEmail(
      "team-one",
      modernEnvironment.ADVERTISING_GAME_USERNAME_HMAC_SECRET
    );
    const syntheticPlaytestEmail = deriveSyntheticAccountEmail(
      "teacher-playtest",
      modernEnvironment.ADVERTISING_GAME_USERNAME_HMAC_SECRET
    );
    expect(fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { operation: "list_users" },
      { operation: "find_user", email: syntheticPairEmail, username: "team-one" },
      {
        operation: "replace_password",
        email: syntheticPairEmail,
        username: "team-one",
        password: "replacement-password"
      },
      {
        operation: "begin_reset",
        email: syntheticPairEmail,
        username: "team-one",
        operationId: resetOperationId
      },
      {
        operation: "complete_reset",
        email: syntheticPairEmail,
        username: "team-one",
        operationId: resetOperationId
      },
      {
        operation: "ensure_user",
        email: syntheticPlaytestEmail,
        username: "teacher-playtest",
        password: "playtest-password"
      }
    ]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.headers).toEqual(expect.objectContaining({
        "x-advertising-game-gateway-secret":
          modernEnvironment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET
      }));
      expect(init?.headers).not.toHaveProperty("authorization");
    }
  });

  it("rejects malformed or oversized account-administration responses without reflecting them", async () => {
    const malformed = new SupabaseAccountClient(
      parseAccountEnvironment(modernEnvironment),
      vi.fn<typeof fetch>().mockResolvedValue(responseJson({
        users: [{
          userId: "not-a-user-id",
          username: "team-one",
          createdAt: "not-a-time",
          lastSignInAt: null,
          email: "must-not-be-reflected@accounts.admarket.invalid"
        }]
      }))
    );
    const malformedError = await malformed.listAdvertisingGameUsers()
      .catch((error: unknown) => error);
    expect(malformedError).toBeInstanceOf(SupabaseAccountError);
    expect(String(malformedError)).not.toContain("must-not-be-reflected");

    const oversized = new SupabaseAccountClient(
      parseAccountEnvironment(modernEnvironment),
      vi.fn<typeof fetch>().mockResolvedValue(responseJson({
        users: [],
        padding: "x".repeat(600 * 1_024)
      }))
    );
    await expect(oversized.listAdvertisingGameUsers())
      .rejects.toMatchObject({ kind: "upstream" });
  });

  it("accepts a verified current session epoch and preserves legacy accounts without one", async () => {
    const sessionEpoch = "2d90c112-4de8-4e7b-92d2-0d655738987f";
    const jwt = accessJwt(sessionEpoch);
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(responseJson({
        id: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        app_metadata: {
          advertising_game_username: "team-one",
          advertising_game_session_epoch: sessionEpoch
        }
      }))
      .mockResolvedValueOnce(responseJson({
        id: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        app_metadata: { advertising_game_username: "team-one" }
      }));
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);

    await expect(client.getUser(jwt)).resolves.toEqual({
      userId: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
      username: "team-one",
      resetGeneration: null
    });
    await expect(client.getUser("legacy-opaque-access")).resolves.toEqual({
      userId: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
      username: "team-one",
      resetGeneration: null
    });
  });

  it("exposes a validated reset generation and locks the account during reset cleanup", async () => {
    const sessionEpoch = "2d90c112-4de8-4e7b-92d2-0d655738987f";
    const resetGeneration = "7440e792-3ddc-4484-ae32-a53088d0d679";
    const jwt = accessJwt(sessionEpoch);
    const identity = {
      id: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
      app_metadata: {
        advertising_game_username: "team-one",
        advertising_game_session_epoch: sessionEpoch,
        advertising_game_reset_generation: resetGeneration,
        advertising_game_reset_pending: false
      }
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(responseJson(identity))
      .mockResolvedValueOnce(responseJson({
        ...identity,
        app_metadata: {
          ...identity.app_metadata,
          advertising_game_reset_pending: true
        }
      }));
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);

    await expect(client.getUser(jwt)).resolves.toEqual({
      userId: identity.id,
      username: "team-one",
      resetGeneration
    });
    await expect(client.getUser(jwt)).rejects.toMatchObject({ kind: "expired_session" });
  });

  it("rejects an otherwise valid old access token after the server epoch changes", async () => {
    const oldJwt = accessJwt("2d90c112-4de8-4e7b-92d2-0d655738987f");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(responseJson({
      id: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
      app_metadata: {
        advertising_game_username: "team-one",
        advertising_game_session_epoch: "7440e792-3ddc-4484-ae32-a53088d0d679"
      }
    }));
    const client = new SupabaseAccountClient(parseAccountEnvironment(modernEnvironment), fetcher);

    await expect(client.getUser(oldJwt)).rejects.toMatchObject({ kind: "expired_session" });
  });
});
