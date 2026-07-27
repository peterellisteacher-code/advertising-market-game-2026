// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  createTeacherSessionClaims,
  createTeacherSessionToken,
  TEACHER_SESSION_COOKIE
} from "./lib/teacher-auth";
import { TeacherAccountServiceError } from "./lib/teacher-account-service";
import {
  config as teacherAccountsConfig,
  createTeacherAccountsHandler
} from "./teacher-accounts.mjs";

const nowSeconds = 1_800_000_000;
const operationId = "2d90c112-4de8-4e7b-92d2-0d655738987f";
const environment = {
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${"p".repeat(32)}`,
  ADVERTISING_GAME_EDGE_GATEWAY_SECRET: "g".repeat(43),
  ADVERTISING_GAME_USERNAME_HMAC_SECRET: "h".repeat(32),
  ADVERTISING_GAME_CLASSROOM_CODE: "classroom-access",
  ADVERTISING_GAME_ASSET_NAMESPACE_SECRET: "a".repeat(32),
  ADVERTISING_GAME_TEACHER_PASSWORD: "teacher-password",
  ADVERTISING_GAME_TEACHER_SESSION_SECRET: "t".repeat(32),
  ADVERTISING_GAME_TEACHER_SESSION_HOURS: "8"
};

const teacherCookie = (): string => {
  const token = createTeacherSessionToken(
    createTeacherSessionClaims(nowSeconds, 8 * 60 * 60, "AAAAAAAAAAAAAAAAAAAAAA"),
    environment.ADVERTISING_GAME_TEACHER_SESSION_SECRET
  );
  return `${TEACHER_SESSION_COOKIE}=${token}`;
};

const request = (
  path: string,
  method: "GET" | "POST" | "PUT",
  body?: unknown,
  authenticated = true,
  origin = "https://game.example"
): Request => new Request(`https://game.example${path}`, {
  method,
  headers: {
    ...(method === "GET" ? {} : { origin }),
    ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...(authenticated ? { cookie: teacherCookie() } : {})
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});

const service = () => ({
  listAccounts: vi.fn().mockResolvedValue([{
    username: "team-one",
    createdAt: "2026-07-20T01:02:03.000Z",
    lastSignInAt: null
  }]),
  createAccount: vi.fn().mockResolvedValue({
    status: "created",
    operationId,
    account: {
      username: "team-one",
      createdAt: "2026-07-20T01:02:03.000Z",
      lastSignInAt: null
    }
  }),
  replacePassword: vi.fn().mockResolvedValue({
    status: "password-replaced",
    operationId,
    username: "team-one"
  }),
  resetAccount: vi.fn().mockResolvedValue({
    status: "reset",
    operationId,
    username: "team-one"
  })
});

describe("teacher account API", () => {
  it("keeps teacher-account traffic on a separate bounded rate limit", () => {
    expect(teacherAccountsConfig.rateLimit).toEqual({
      windowLimit: 60,
      windowSize: 60,
      aggregateBy: ["ip", "domain"]
    });
  });

  it("requires a verified teacher session on every account route", async () => {
    const fake = service();
    const handler = createTeacherAccountsHandler({
      environment,
      service: fake,
      nowSeconds: () => nowSeconds
    });
    const cases = [
      request("/api/teacher/accounts", "GET", undefined, false),
      request("/api/teacher/accounts", "POST", {
        schema: "ad-market-teacher-account-create",
        version: 1,
        operationId,
        username: "team-one",
        password: "chosen-password"
      }, false),
      request("/api/teacher/accounts/team-one/password", "PUT", {
        schema: "ad-market-teacher-password-replace",
        version: 1,
        operationId,
        password: "chosen-password"
      }, false),
      request("/api/teacher/accounts/team-one/reset", "POST", {
        schema: "ad-market-teacher-account-reset",
        version: 1,
        operationId,
        confirmation: "team-one"
      }, false)
    ];
    for (const item of cases) {
      const response = await handler(item);
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({
        error: "AUTHENTICATION_REQUIRED"
      });
    }
    expect(fake.listAccounts).not.toHaveBeenCalled();
    expect(fake.createAccount).not.toHaveBeenCalled();
    expect(fake.replacePassword).not.toHaveBeenCalled();
    expect(fake.resetAccount).not.toHaveBeenCalled();
  });

  it("lists only browser-safe pair summaries", async () => {
    const fake = service();
    const response = await createTeacherAccountsHandler({
      environment,
      service: fake,
      nowSeconds: () => nowSeconds
    })(request("/api/teacher/accounts", "GET"));

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({
      accounts: [{
        username: "team-one",
        createdAt: "2026-07-20T01:02:03.000Z",
        lastSignInAt: null
      }]
    });
    expect(text).not.toContain("userId");
    expect(text).not.toContain("accounts.admarket.invalid");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("accepts exact creation, editable-password, and typed-reset contracts", async () => {
    const fake = service();
    const handler = createTeacherAccountsHandler({
      environment,
      service: fake,
      nowSeconds: () => nowSeconds
    });
    const created = await handler(request("/api/teacher/accounts", "POST", {
      schema: "ad-market-teacher-account-create",
      version: 1,
      operationId,
      username: " TEAM-One ",
      password: "chosen-password"
    }));
    const replaced = await handler(request(
      "/api/teacher/accounts/team-one/password",
      "PUT",
      {
        schema: "ad-market-teacher-password-replace",
        version: 1,
        operationId,
        password: "replacement-password"
      }
    ));
    const reset = await handler(request(
      "/api/teacher/accounts/team-one/reset",
      "POST",
      {
        schema: "ad-market-teacher-account-reset",
        version: 1,
        operationId,
        confirmation: "team-one"
      }
    ));

    expect(created.status).toBe(201);
    expect(replaced.status).toBe(200);
    expect(reset.status).toBe(200);
    expect(fake.createAccount).toHaveBeenCalledWith({
      operationId,
      username: "team-one",
      password: "chosen-password"
    });
    expect(fake.replacePassword).toHaveBeenCalledWith({
      operationId,
      username: "team-one",
      password: "replacement-password"
    });
    expect(fake.resetAccount).toHaveBeenCalledWith({
      operationId,
      username: "team-one"
    });
  });

  it("rejects ambiguous bodies, wrong confirmation, and cross-origin mutations", async () => {
    const fake = service();
    const handler = createTeacherAccountsHandler({
      environment,
      service: fake,
      nowSeconds: () => nowSeconds
    });
    const malformed = await handler(request("/api/teacher/accounts", "POST", {
      schema: "ad-market-teacher-account-create",
      version: 1,
      operationId,
      username: "team-one",
      password: "chosen-password",
      unexpected: true
    }));
    const wrongConfirmation = await handler(request(
      "/api/teacher/accounts/team-one/reset",
      "POST",
      {
        schema: "ad-market-teacher-account-reset",
        version: 1,
        operationId,
        confirmation: "RESET"
      }
    ));
    const crossOrigin = await handler(request(
      "/api/teacher/accounts/team-one/password",
      "PUT",
      {
        schema: "ad-market-teacher-password-replace",
        version: 1,
        operationId,
        password: "replacement-password"
      },
      true,
      "https://evil.example"
    ));

    for (const response of [malformed, wrongConfirmation]) {
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "INVALID_REQUEST" });
    }
    expect(crossOrigin.status).toBe(403);
    await expect(crossOrigin.json()).resolves.toEqual({ error: "CSRF_REJECTED" });
    expect(fake.createAccount).not.toHaveBeenCalled();
    expect(fake.replacePassword).not.toHaveBeenCalled();
    expect(fake.resetAccount).not.toHaveBeenCalled();
  });

  it("returns stable incomplete-reset details and propagates a bounded Retry-After", async () => {
    const fake = service();
    fake.resetAccount.mockRejectedValueOnce(
      new TeacherAccountServiceError("RESET_INCOMPLETE", 409, false)
    );
    fake.listAccounts.mockRejectedValueOnce(
      new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true, 12)
    );
    const handler = createTeacherAccountsHandler({
      environment,
      service: fake,
      nowSeconds: () => nowSeconds
    });

    const reset = await handler(request(
      "/api/teacher/accounts/team-one/reset",
      "POST",
      {
        schema: "ad-market-teacher-account-reset",
        version: 1,
        operationId,
        confirmation: "team-one"
      }
    ));
    expect(reset.status).toBe(409);
    await expect(reset.json()).resolves.toEqual({
      error: "RESET_INCOMPLETE",
      operationId,
      retryable: false
    });

    const unavailable = await handler(request("/api/teacher/accounts", "GET"));
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get("retry-after")).toBe("12");
    await expect(unavailable.json()).resolves.toEqual({
      error: "TEACHER_UNAVAILABLE",
      retryable: true
    });
  });
});
