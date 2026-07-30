// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { TEACHER_SESSION_COOKIE } from "./lib/teacher-auth";
import {
  config as teacherSessionConfig,
  createTeacherSessionHandler
} from "./teacher-session.mjs";

const environment = {
  ADVERTISING_GAME_TEACHER_PASSWORD: "classroom-password",
  ADVERTISING_GAME_TEACHER_SESSION_SECRET: "s".repeat(48),
  ADVERTISING_GAME_TEACHER_SESSION_HOURS: "8"
};

const request = (
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

describe("teacher session API", () => {
  it("uses an independent bounded teacher-login rate limit", () => {
    expect(teacherSessionConfig).toEqual({
      path: [
        "/api/teacher/login",
        "/api/teacher/session",
        "/api/teacher/logout"
      ],
      rateLimit: {
        windowLimit: 30,
        windowSize: 60,
        aggregateBy: ["ip", "domain"]
      }
    });
  });

  it("creates a secure teacher session without reflecting credentials", async () => {
    const handler = createTeacherSessionHandler({
      environment,
      nowSeconds: () => 1_000,
      nonce: () => "AQIDBAUGBwgJCgsMDQ4PEA"
    });

    const response = await handler(request("/api/teacher/login", "POST", {
      password: "classroom-password"
    }));

    const publicResponse = `${await response.clone().text()}\n${[...response.headers.entries()]}`;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: true });
    expect(setCookies(response)).toEqual([
      expect.stringMatching(
        new RegExp(`^${TEACHER_SESSION_COOKIE}=[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+; `)
      )
    ]);
    expect(setCookies(response)[0]).toContain("Path=/api/teacher; HttpOnly; Secure; SameSite=Strict");
    expect(setCookies(response)[0]).toContain("Max-Age=28800");
    expect(publicResponse).not.toContain(environment.ADVERTISING_GAME_TEACHER_PASSWORD);
    expect(publicResponse).not.toContain(environment.ADVERTISING_GAME_TEACHER_SESSION_SECRET);
  });

  it("reports only authenticated state and clears only the teacher cookie", async () => {
    const handler = createTeacherSessionHandler({
      environment,
      nowSeconds: () => 1_500,
      nonce: () => "AQIDBAUGBwgJCgsMDQ4PEA"
    });
    const login = await handler(request("/api/teacher/login", "POST", {
      password: "classroom-password"
    }));
    const cookie = setCookies(login)[0]!.split(";", 1)[0]!;

    const active = await handler(request("/api/teacher/session", "GET", undefined, {
      cookie
    }));
    expect(active.status).toBe(200);
    await expect(active.json()).resolves.toEqual({ authenticated: true });

    const missing = await handler(request("/api/teacher/session", "GET"));
    await expect(missing.json()).resolves.toEqual({ authenticated: false });

    const logout = await handler(request("/api/teacher/logout", "POST", undefined, {
      cookie: `${cookie}; admarket_access=pair-token`
    }));
    expect(logout.status).toBe(204);
    expect(setCookies(logout)).toEqual([
      `${TEACHER_SESSION_COOKIE}=; Path=/api/teacher; HttpOnly; Secure; ` +
      "SameSite=Strict; Max-Age=0"
    ]);
    expect(setCookies(logout).join("\n")).not.toContain("admarket_access");
  });

  it("returns one generic error for every wrong submitted password", async () => {
    const handler = createTeacherSessionHandler({ environment });
    for (const password of ["wrong-password", "", "line\nbreak"]) {
      const response = await handler(request("/api/teacher/login", "POST", { password }));
      const text = await response.text();
      expect(response.status).toBe(401);
      expect(text).toBe('{"error":"INVALID_CREDENTIALS"}');
      if (password !== "") expect(text).not.toContain(password);
    }
  });

  it("rejects widened routes, methods, queries, origins, fields and bodies", async () => {
    const handler = createTeacherSessionHandler({ environment });
    const cases: Array<[Request, number, string]> = [
      [request("/api/teacher/login?next=%2Fteacher", "POST", {
        password: "classroom-password"
      }), 400, "INVALID_REQUEST"],
      [request("/api/teacher/login/", "POST", {
        password: "classroom-password"
      }), 404, "NOT_FOUND"],
      [request("/api/teacher/session", "POST"), 405, "METHOD_NOT_ALLOWED"],
      [request("/api/teacher/logout", "GET"), 405, "METHOD_NOT_ALLOWED"],
      [request("/api/teacher/login", "POST", {
        password: "classroom-password",
        role: "teacher"
      }), 400, "INVALID_REQUEST"],
      [request("/api/teacher/login", "POST", {
        password: "classroom-password"
      }, { origin: "https://evil.example" }), 403, "CSRF_REJECTED"]
    ];
    for (const [input, status, error] of cases) {
      const response = await handler(input);
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({ error });
    }

    const oversized = await handler(new Request("https://game.example/api/teacher/login", {
      method: "POST",
      headers: {
        origin: "https://game.example",
        "content-type": "application/json",
        "content-length": "20000"
      },
      body: "{}"
    }));
    expect(oversized.status).toBe(413);
    await expect(oversized.json()).resolves.toEqual({ error: "REQUEST_TOO_LARGE" });
  });

  it("fails closed when runtime configuration is absent", async () => {
    const response = await createTeacherSessionHandler({ environment: {} })(
      request("/api/teacher/session", "GET")
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "TEACHER_NOT_CONFIGURED" });
  });

  it("never calls an external dependency", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const handler = createTeacherSessionHandler({ environment });
    await handler(request("/api/teacher/session", "GET"));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
