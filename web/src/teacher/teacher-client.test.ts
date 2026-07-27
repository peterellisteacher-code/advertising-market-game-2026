import { describe, expect, it, vi } from "vitest";
import {
  HttpTeacherClient,
  TeacherClientError
} from "./teacher-client";

const operationId = "2d90c112-4de8-4e7b-92d2-0d655738987f";
const summary = {
  username: "team-one",
  createdAt: "2026-07-20T01:02:03.000Z",
  lastSignInAt: null
};

describe("HttpTeacherClient", () => {
  it("uses exact same-origin session and account-list GET contracts", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ authenticated: true }))
      .mockResolvedValueOnce(Response.json({ accounts: [summary] }));
    const client = new HttpTeacherClient({ fetcher });

    await expect(client.session()).resolves.toEqual({ authenticated: true });
    await expect(client.listAccounts()).resolves.toEqual([summary]);

    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/teacher/session", {
      method: "GET",
      credentials: "same-origin",
      redirect: "error",
      headers: { accept: "application/json" },
      signal: expect.any(AbortSignal)
    });
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/teacher/accounts", {
      method: "GET",
      credentials: "same-origin",
      redirect: "error",
      headers: { accept: "application/json" },
      signal: expect.any(AbortSignal)
    });
  });

  it("sends exact schemas for login, chosen credentials, password replacement, reset and logout", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ authenticated: true }))
      .mockResolvedValueOnce(Response.json({
        status: "created",
        operationId,
        account: summary
      }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({
        status: "password-replaced",
        operationId,
        username: "team-one"
      }))
      .mockResolvedValueOnce(Response.json({
        status: "reset",
        operationId,
        username: "team-one"
      }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = new HttpTeacherClient({ fetcher });

    await client.login("teacher-password");
    await expect(client.createAccount({
      operationId,
      username: "team-one",
      password: "class-pair-12"
    })).resolves.toEqual(summary);
    await client.replacePassword({
      operationId,
      username: "team-one",
      password: "new-pair-password"
    });
    await client.resetAccount({
      operationId,
      username: "team-one",
      confirmation: "team-one"
    });
    await client.logout();

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/teacher/login",
      "/api/teacher/accounts",
      "/api/teacher/accounts/team-one/password",
      "/api/teacher/accounts/team-one/reset",
      "/api/teacher/logout"
    ]);
    expect(fetcher.mock.calls.map(([, init]) => init?.method)).toEqual([
      "POST", "POST", "PUT", "POST", "POST"
    ]);
    expect(fetcher.mock.calls.slice(0, 4).map(([, init]) =>
      JSON.parse(String(init?.body)))).toEqual([
      { password: "teacher-password" },
      {
        schema: "ad-market-teacher-account-create",
        version: 1,
        operationId,
        username: "team-one",
        password: "class-pair-12"
      },
      {
        schema: "ad-market-teacher-password-replace",
        version: 1,
        operationId,
        password: "new-pair-password"
      },
      {
        schema: "ad-market-teacher-account-reset",
        version: 1,
        operationId,
        confirmation: "team-one"
      }
    ]);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.credentials).toBe("same-origin");
      expect(init?.redirect).toBe("error");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("retries one bounded 429 only for a safe GET", async () => {
    const delay = vi.fn().mockResolvedValue(undefined);
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: "RATE_LIMITED" }, {
        status: 429,
        headers: { "retry-after": "2" }
      }))
      .mockResolvedValueOnce(Response.json({ accounts: [summary] }));
    const client = new HttpTeacherClient({ fetcher, delay });

    await expect(client.listAccounts()).resolves.toEqual([summary]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(2_000);

    fetcher.mockReset();
    fetcher.mockResolvedValue(Response.json({ error: "RATE_LIMITED" }, {
      status: 429,
      headers: { "retry-after": "2" }
    }));
    await expect(client.createAccount({
      operationId,
      username: "team-one",
      password: "class-pair-12"
    })).rejects.toMatchObject({ status: 429 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects redirected, non-JSON, malformed and oversized responses", async () => {
    const redirected = Response.json({ authenticated: true });
    Object.defineProperty(redirected, "redirected", { value: true });
    for (const response of [
      redirected,
      new Response("not json", { headers: { "content-type": "text/plain" } }),
      Response.json({ authenticated: "yes" }),
      Response.json({ accounts: [], padding: "x".repeat(70 * 1_024) })
    ]) {
      const client = new HttpTeacherClient({
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(response)
      });
      const operation = response === redirected ||
        response.headers.get("content-type") === "text/plain" ||
        response.headers.get("content-length") === null &&
          response !== redirected && response.headers.get("content-type")?.includes("json") &&
          (await response.clone().text()).includes("authenticated")
        ? client.session()
        : client.listAccounts();
      const caught = await operation.catch((error: unknown) => error);
      expect(caught).toBeInstanceOf(TeacherClientError);
    }
  });
});
