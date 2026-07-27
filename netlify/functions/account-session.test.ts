// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_ACCESS_COOKIE,
  ACCOUNT_REFRESH_COOKIE,
  ACCOUNT_RESET_GENERATION_COOKIE,
  deriveSyntheticAccountEmail
} from "./lib/account-primitives";
import {
  config as accountSessionConfig,
  createAccountSessionHandler
} from "./account-session.mjs";

const environment = {
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${"p".repeat(32)}`,
  ADVERTISING_GAME_EDGE_GATEWAY_SECRET: "g".repeat(43),
  ADVERTISING_GAME_USERNAME_HMAC_SECRET: "h".repeat(32),
  ADVERTISING_GAME_CLASSROOM_CODE: "classroom-access"
};

const json = (body: unknown, status = 200): Response => Response.json(body, { status });

const accountRequest = (
  path: string,
  method: "GET" | "POST",
  body?: unknown,
  headers: Record<string, string> = {}
): Request => new Request(`https://game.example${path}`, {
  method,
  headers: {
    ...(method === "POST" ? { origin: "https://game.example" } : {}),
    ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...headers
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});

const setCookies = (response: Response): string[] => {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return headers.getSetCookie?.() ?? (headers.get("set-cookie")?.split(/,\s*(?=[^;]+=)/u) ?? []);
};

const validTokens = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_in: 3600
};

const accessJwt = (sessionEpoch: string): string => {
  const encode = (value: unknown): string => Buffer.from(JSON.stringify(value), "utf8")
    .toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
    app_metadata: { advertising_game_session_epoch: sessionEpoch },
    exp: 4_102_444_800
  })}.${"x".repeat(43)}`;
};

describe("account session API", () => {
  it("keeps shared-school-network capacity above a full class start", () => {
    expect(accountSessionConfig.rateLimit).toEqual({
      windowLimit: 300,
      windowSize: 60,
      aggregateBy: ["ip", "domain"]
    });
  });

  it("does not let a stale tab log out the current account or clear its rotated cookies", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({
        access_token: "current-b-access",
        refresh_token: "current-b-refresh",
        expires_in: 1800
      }))
      .mockResolvedValueOnce(json({
        id: "99250725-52e0-44c9-b569-593167786eaf",
        email: "synthetic@accounts.admarket.invalid",
        app_metadata: { advertising_game_username: "team-two" }
      }));

    const response = await createAccountSessionHandler({ environment, fetcher })(
      accountRequest("/api/account/logout", "POST", undefined, {
        cookie: `${ACCOUNT_ACCESS_COOKIE}=stale-access; ` +
          `${ACCOUNT_REFRESH_COOKIE}=current-b-refresh-before-rotation`,
        "x-admarket-account": "team-one"
      })
    );

    expect(response.status).toBe(409);
    expect(await response.text()).toBe('{"error":"ACCOUNT_IDENTITY_CHANGED"}');
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("/logout"))).toBe(false);
    const cookies = setCookies(response);
    expect(cookies).toEqual([
      expect.stringContaining(`${ACCOUNT_ACCESS_COOKIE}=current-b-access;`),
      expect.stringContaining(`${ACCOUNT_REFRESH_COOKIE}=current-b-refresh;`),
      expect.stringContaining(`${ACCOUNT_RESET_GENERATION_COOKIE}=;`)
    ]);
    expect(cookies.slice(0, 2).every((cookie) => !cookie.includes("Max-Age=0"))).toBe(true);
    expect(cookies[2]).toContain("Max-Age=0");
  });

  it("rejects query parameters and non-contract URL shapes on every account route", async () => {
    const handler = createAccountSessionHandler({ environment, fetcher: vi.fn<typeof fetch>() });
    const requests = [
      accountRequest("/api/account/signup?next=%2F", "POST", {
        username: "team-one",
        password: "student-password",
        classroomCode: "classroom-access"
      }),
      accountRequest("/api/account/login?", "POST", {
        username: "team-one",
        password: "student-password"
      }),
      accountRequest("/api/account/session?refresh=true", "GET"),
      accountRequest("/api/account/logout?next=%2F", "POST"),
      accountRequest("/api/account/session/", "GET"),
      accountRequest("/api//account/session", "GET")
    ];

    for (const request of requests.slice(0, 4)) {
      const response = await handler(request);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "INVALID_REQUEST" });
    }
    for (const request of requests.slice(4)) {
      const response = await handler(request);
      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "NOT_FOUND" });
    }
  });

  it("creates a confirmed opaque account, signs it in, and returns only username state", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ id: "b9b32e20-0ba8-4896-b89f-44efdfc52942" }, 201))
      .mockResolvedValueOnce(json(validTokens))
      .mockResolvedValueOnce(json({
        id: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        app_metadata: { advertising_game_username: "team-one" }
      }));
    const handler = createAccountSessionHandler({ environment, fetcher });

    const response = await handler(accountRequest("/api/account/signup", "POST", {
      username: "  TEAM-One  ",
      password: "student-password",
      classroomCode: "classroom-access"
    }));

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload).toEqual({
      authenticated: true,
      username: "team-one",
      resetGeneration: null
    });
    const responseText = JSON.stringify({
      payload,
      headers: [...response.headers.entries()].filter(([name]) => name !== "set-cookie")
    });
    expect(responseText).not.toContain(environment.SUPABASE_URL);
    expect(responseText).not.toContain(environment.SUPABASE_PUBLISHABLE_KEY);
    expect(responseText).not.toContain(environment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET);
    expect(responseText).not.toContain("access-token");
    expect(responseText).not.toContain("refresh-token");
    expect(responseText).not.toContain("accounts.admarket.invalid");
    expect(responseText).not.toContain("b9b32e20-0ba8-4896-b89f-44efdfc52942");

    const adminBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(adminBody.email).toBe(deriveSyntheticAccountEmail(
      "team-one",
      environment.ADVERTISING_GAME_USERNAME_HMAC_SECRET
    ));
    expect(adminBody.email).not.toContain("team-one");
    expect(setCookies(response)).toEqual([
      `${ACCOUNT_ACCESS_COOKIE}=access-token; Path=/api; HttpOnly; SameSite=Strict; ` +
        "Max-Age=3600; Secure",
      `${ACCOUNT_REFRESH_COOKIE}=refresh-token; Path=/api; HttpOnly; SameSite=Strict; ` +
        "Max-Age=2592000; Secure",
      `${ACCOUNT_RESET_GENERATION_COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; ` +
        "Max-Age=0; Secure"
    ]);
  });

  it("verifies a fresh password login against the current server epoch before issuing cookies", async () => {
    const sessionEpoch = "2d90c112-4de8-4e7b-92d2-0d655738987f";
    const resetGeneration = "7440e792-3ddc-4484-ae32-a53088d0d679";
    const jwt = accessJwt(sessionEpoch);
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({
        access_token: jwt,
        refresh_token: "refresh-token",
        expires_in: 3600
      }))
      .mockResolvedValueOnce(json({
        id: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        app_metadata: {
          advertising_game_username: "team-one",
          advertising_game_session_epoch: sessionEpoch,
          advertising_game_reset_generation: resetGeneration,
          advertising_game_reset_pending: false
        }
      }));
    const response = await createAccountSessionHandler({ environment, fetcher })(
      accountRequest("/api/account/login", "POST", {
        username: "team-one",
        password: "student-password"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      username: "team-one",
      resetGeneration
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("/auth/v1/user");
    expect(setCookies(response)).toEqual([
      expect.stringContaining(`${ACCOUNT_ACCESS_COOKIE}=${jwt};`),
      expect.stringContaining(`${ACCOUNT_REFRESH_COOKIE}=refresh-token;`),
      expect.stringContaining(`${ACCOUNT_RESET_GENERATION_COOKIE}=${resetGeneration};`)
    ]);
  });

  it("fails closed without issuing cookies when a fresh login carries a stale epoch", async () => {
    const jwt = accessJwt("2d90c112-4de8-4e7b-92d2-0d655738987f");
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({
        access_token: jwt,
        refresh_token: "refresh-token",
        expires_in: 3600
      }))
      .mockResolvedValueOnce(json({
        id: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        app_metadata: {
          advertising_game_username: "team-one",
          advertising_game_session_epoch: "7440e792-3ddc-4484-ae32-a53088d0d679"
        }
      }));
    const response = await createAccountSessionHandler({ environment, fetcher })(
      accountRequest("/api/account/login", "POST", {
        username: "team-one",
        password: "student-password"
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "ACCOUNT_UNAVAILABLE" });
    expect(setCookies(response)).toEqual([]);
  });

  it("clears an otherwise unexpired access cookie after a password replacement changes its epoch", async () => {
    const jwt = accessJwt("2d90c112-4de8-4e7b-92d2-0d655738987f");
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({
        id: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        app_metadata: {
          advertising_game_username: "team-one",
          advertising_game_session_epoch: "7440e792-3ddc-4484-ae32-a53088d0d679"
        }
      }))
      .mockResolvedValueOnce(json({ message: "refresh revoked" }, 400));
    const response = await createAccountSessionHandler({ environment, fetcher })(
      accountRequest("/api/account/session", "GET", undefined, {
        cookie: `${ACCOUNT_ACCESS_COOKIE}=${jwt}; ${ACCOUNT_REFRESH_COOKIE}=revoked-refresh`
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
    expect(setCookies(response).every((cookie) => cookie.includes("Max-Age=0"))).toBe(true);
  });

  it("rejects an invalid classroom access code before any Supabase call", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const response = await createAccountSessionHandler({ environment, fetcher })(
      accountRequest("/api/account/signup", "POST", {
        username: "team-one",
        password: "student-password",
        classroomCode: "wrong-code"
      })
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "SIGNUP_DENIED" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("maps duplicate signup to one bounded username-unavailable response", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({ error: "USERNAME_UNAVAILABLE" }, 409));
    const response = await createAccountSessionHandler({ environment, fetcher })(
      accountRequest("/api/account/signup", "POST", {
        username: "team-one",
        password: "student-password",
        classroomCode: "classroom-access"
      })
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "USERNAME_UNAVAILABLE" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not misclassify a non-duplicate Supabase signup rejection", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({
      code: "weak_password",
      message: environment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET
    }, 422));
    const response = await createAccountSessionHandler({ environment, fetcher })(
      accountRequest("/api/account/signup", "POST", {
        username: "team-one",
        password: "student-password",
        classroomCode: "classroom-access"
      })
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":"ACCOUNT_UNAVAILABLE"}');
  });

  it("returns the same generic login error for every rejected password flow", async () => {
    for (const upstreamStatus of [400, 401, 422]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({
        error: environment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET,
        email: "synthetic@accounts.admarket.invalid"
      }, upstreamStatus));
      const response = await createAccountSessionHandler({ environment, fetcher })(
        accountRequest("/api/account/login", "POST", {
          username: "team-one",
          password: "wrong-password"
        })
      );
      expect(response.status).toBe(401);
      expect(await response.text()).toBe('{"error":"INVALID_CREDENTIALS"}');
    }
  });

  it("requires same-origin POSTs and rejects oversized or malformed account bodies", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handler = createAccountSessionHandler({ environment, fetcher });
    const crossOrigin = await handler(accountRequest("/api/account/login", "POST", {
      username: "team-one",
      password: "student-password"
    }, { origin: "https://evil.example" }));
    expect(crossOrigin.status).toBe(403);
    await expect(crossOrigin.json()).resolves.toEqual({ error: "CSRF_REJECTED" });

    const oversized = await handler(new Request("https://game.example/api/account/login", {
      method: "POST",
      headers: {
        origin: "https://game.example",
        "content-type": "application/json",
        "content-length": "20000"
      },
      body: "{}"
    }));
    expect(oversized.status).toBe(413);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refreshes an expired access cookie and rotates both cookies safely", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({
        access_token: "rotated-access",
        refresh_token: "rotated-refresh",
        expires_in: 1800
      }))
      .mockResolvedValueOnce(json({
        id: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        email: "synthetic@accounts.admarket.invalid",
        app_metadata: { advertising_game_username: "team-one" }
      }));
    const response = await createAccountSessionHandler({ environment, fetcher })(
      accountRequest("/api/account/session", "GET", undefined, {
        cookie: `${ACCOUNT_ACCESS_COOKIE}=expired-access; ` +
          `${ACCOUNT_REFRESH_COOKIE}=refresh-token`
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      username: "team-one",
      resetGeneration: null
    });
    expect(setCookies(response)).toEqual([
      expect.stringContaining(`${ACCOUNT_ACCESS_COOKIE}=rotated-access;`),
      expect.stringContaining(`${ACCOUNT_REFRESH_COOKIE}=rotated-refresh;`),
      expect.stringContaining(`${ACCOUNT_RESET_GENERATION_COOKIE}=;`)
    ]);
  });

  it("reports an expired session without throwing and clears stale cookies", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({ message: "refresh expired" }, 400));
    const response = await createAccountSessionHandler({ environment, fetcher })(
      accountRequest("/api/account/session", "GET", undefined, {
        cookie: `${ACCOUNT_ACCESS_COOKIE}=expired-access; ` +
          `${ACCOUNT_REFRESH_COOKIE}=expired-refresh`
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
    expect(setCookies(response)).toEqual([
      `${ACCOUNT_ACCESS_COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0; Secure`,
      `${ACCOUNT_REFRESH_COOKIE}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0; Secure`,
      `${ACCOUNT_RESET_GENERATION_COOKIE}=; Path=/api; HttpOnly; ` +
        "SameSite=Strict; Max-Age=0; Secure"
    ]);
  });

  it("logs out upstream when possible and always clears local cookies", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({
        id: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        email: "synthetic@accounts.admarket.invalid",
        app_metadata: { advertising_game_username: "team-one" }
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await createAccountSessionHandler({ environment, fetcher })(
      accountRequest("/api/account/logout", "POST", undefined, {
        cookie: `${ACCOUNT_ACCESS_COOKIE}=access-token; ${ACCOUNT_REFRESH_COOKIE}=refresh-token`,
        "x-admarket-account": "team-one"
      })
    );
    expect(response.status).toBe(204);
    expect(fetcher).toHaveBeenCalledWith(
      `${environment.SUPABASE_URL}/auth/v1/logout?scope=global`,
      expect.objectContaining({ method: "POST" })
    );
    expect(setCookies(response)).toHaveLength(3);
    expect(setCookies(response).every((cookie) => cookie.includes("Max-Age=0"))).toBe(true);
  });

  it("refreshes and revokes a valid remote session when the access cookie is absent", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({
        access_token: "rotated-access",
        refresh_token: "rotated-refresh",
        expires_in: 1800
      }))
      .mockResolvedValueOnce(json({
        id: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        email: "synthetic@accounts.admarket.invalid",
        app_metadata: { advertising_game_username: "team-one" }
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await createAccountSessionHandler({ environment, fetcher })(
      accountRequest("/api/account/logout", "POST", undefined, {
        cookie: `${ACCOUNT_REFRESH_COOKIE}=refresh-token`,
        "x-admarket-account": "team-one"
      })
    );

    expect(response.status).toBe(204);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("grant_type=refresh_token");
    expect(fetcher.mock.calls[2]?.[1]?.headers).toEqual(expect.objectContaining({
      authorization: "Bearer rotated-access"
    }));
    expect(setCookies(response)).toHaveLength(3);
  });

  it("refreshes and revokes after an expired access token instead of treating 401 as success", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({
        access_token: "rotated-access",
        refresh_token: "rotated-refresh",
        expires_in: 1800
      }))
      .mockResolvedValueOnce(json({
        id: "b9b32e20-0ba8-4896-b89f-44efdfc52942",
        email: "synthetic@accounts.admarket.invalid",
        app_metadata: { advertising_game_username: "team-one" }
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const response = await createAccountSessionHandler({ environment, fetcher })(
      accountRequest("/api/account/logout", "POST", undefined, {
        cookie: `${ACCOUNT_ACCESS_COOKIE}=expired-access; ${ACCOUNT_REFRESH_COOKIE}=refresh-token`,
        "x-admarket-account": "team-one"
      })
    );

    expect(response.status).toBe(204);
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("grant_type=refresh_token");
    expect(fetcher.mock.calls[3]?.[1]?.headers).toEqual(expect.objectContaining({
      authorization: "Bearer rotated-access"
    }));
  });

  it("fails closed when configuration or Supabase is unavailable without echoing secrets", async () => {
    const notConfigured = await createAccountSessionHandler({
      environment: { ...environment, ADVERTISING_GAME_EDGE_GATEWAY_SECRET: undefined },
      fetcher: vi.fn<typeof fetch>()
    })(accountRequest("/api/account/login", "POST", {
      username: "team-one",
      password: "student-password"
    }));
    expect(notConfigured.status).toBe(503);
    await expect(notConfigured.json()).resolves.toEqual({ error: "ACCOUNT_NOT_CONFIGURED" });

    const unavailable = await createAccountSessionHandler({
      environment,
      fetcher: vi.fn<typeof fetch>().mockRejectedValue(new Error(environment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET))
    })(accountRequest("/api/account/login", "POST", {
      username: "team-one",
      password: "student-password"
    }));
    expect(unavailable.status).toBe(503);
    const text = await unavailable.text();
    expect(text).toBe('{"error":"ACCOUNT_UNAVAILABLE"}');
    expect(text).not.toContain(environment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET);
  });
});
