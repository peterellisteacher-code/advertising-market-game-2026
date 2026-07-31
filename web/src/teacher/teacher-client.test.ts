import { describe, expect, it, vi } from "vitest";
import {
  HttpTeacherClient,
  TeacherClientError
} from "./teacher-client";

const operationId = "2d90c112-4de8-4e7b-92d2-0d655738987f";
const summary = {
  username: "team-one",
  password: "class-pair-12",
  createdAt: "2026-07-20T01:02:03.000Z",
  lastSignInAt: null
};
const pending = {
  username: "bright-ideas",
  password: "classroom-only-password",
  requestedAt: "2026-07-31T00:00:00.000Z"
};
const counts = (granted: number, consumed = 0, reserved = 0) => ({
  granted,
  consumed,
  reserved,
  remaining: granted - consumed - reserved
});
const imageLabStatus = {
  enabled: true,
  defaults: { object: 0, realise: 0 },
  accounts: [{
    alias: "team-one",
    object: counts(2, 0, 1),
    realise: counts(1)
  }]
};

describe("HttpTeacherClient", () => {
  it("binds the default browser fetcher to the global receiver", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockImplementation(
      function (this: unknown): Promise<Response> {
        expect(this).toBe(globalThis);
        return Promise.resolve(Response.json({ authenticated: false }));
      }
    );

    try {
      const client = new HttpTeacherClient();
      await expect(client.session()).resolves.toEqual({ authenticated: false });
    } finally {
      fetcher.mockRestore();
    }
  });

  it("uses exact same-origin session and account-list GET contracts", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ authenticated: true }))
      .mockResolvedValueOnce(Response.json({ accounts: [summary], pending: [pending] }));
    const client = new HttpTeacherClient({ fetcher });

    await expect(client.session()).resolves.toEqual({ authenticated: true });
    await expect(client.listAccounts()).resolves.toEqual({
      accounts: [summary],
      pending: [pending]
    });

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

  it("approves one pending pair without sending its password back through the browser", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      status: "approved",
      operationId,
      account: {
        username: "bright-ideas",
        password: "classroom-only-password",
        createdAt: "2026-07-31T00:10:00.000Z",
        lastSignInAt: null
      }
    }, { status: 201 }));
    const client = new HttpTeacherClient({ fetcher });

    await expect(client.approveRegistration({
      operationId,
      username: "bright-ideas"
    })).resolves.toMatchObject({
      username: "bright-ideas",
      password: "classroom-only-password"
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/teacher/accounts/bright-ideas/approve",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          schema: "ad-market-teacher-registration-approve",
          version: 1,
          operationId
        })
      })
    );
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).not.toContain("classroom-only-password");
  });

  it("accepts a hosted 204 whose browser exposes an empty response stream", async () => {
    const hostedNoContent = {
      body: new ReadableStream({
        start(controller) {
          controller.close();
        }
      }),
      headers: new Headers(),
      ok: true,
      redirected: false,
      status: 204
    } as unknown as Response;
    const client = new HttpTeacherClient({
      fetcher: vi.fn<typeof fetch>().mockResolvedValue(hostedNoContent)
    });

    await expect(client.logout()).resolves.toBeUndefined();
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

  it("uses exact alias-only Image Lab status and mutation contracts", async () => {
    const accountResult = {
      status: "updated",
      operationId,
      operation: "set",
      alias: "team-one",
      account: imageLabStatus.accounts[0]
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(imageLabStatus))
      .mockResolvedValueOnce(Response.json({
        status: "updated",
        operationId,
        operation: "global",
        enabled: false,
        defaults: { object: 3, realise: 1 }
      }))
      .mockResolvedValueOnce(Response.json(accountResult))
      .mockResolvedValueOnce(Response.json({ ...accountResult, operation: "add" }))
      .mockResolvedValueOnce(Response.json({ ...accountResult, operation: "revoke" }))
      .mockResolvedValueOnce(Response.json({
        status: "updated",
        operationId,
        operation: "batch-add",
        aliases: ["team-one"],
        accounts: [imageLabStatus.accounts[0]]
      }));
    const client = new HttpTeacherClient({ fetcher });

    await expect(client.imageLabStatus()).resolves.toEqual(imageLabStatus);
    await client.setImageLabGlobal({
      operationId,
      enabled: false,
      objectDefault: 3,
      realiseDefault: 1
    });
    await client.setImageLabAccount({ operationId, alias: "team-one", object: 2, realise: 1 });
    await client.addImageLabAccount({ operationId, alias: "team-one", object: 1, realise: 0 });
    await client.revokeImageLabAccount({ operationId, alias: "team-one", object: 1, realise: 1 });
    await client.batchAddImageLab({
      operationId,
      aliases: ["team-one"],
      object: 2,
      realise: 0
    });

    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/teacher/image-lab",
      "/api/teacher/image-lab/global",
      "/api/teacher/image-lab/accounts/team-one",
      "/api/teacher/image-lab/accounts/team-one/add",
      "/api/teacher/image-lab/accounts/team-one/revoke",
      "/api/teacher/image-lab/batch"
    ]);
    expect(fetcher.mock.calls.map(([, init]) => init?.method))
      .toEqual(["GET", "PUT", "PUT", "POST", "POST", "POST"]);
    expect(fetcher.mock.calls.slice(1).map(([, init]) =>
      JSON.parse(String(init?.body)))).toEqual([
      {
        schema: "ad-market-teacher-image-lab-global",
        version: 1,
        operationId,
        enabled: false,
        objectDefault: 3,
        realiseDefault: 1
      },
      {
        schema: "ad-market-teacher-image-lab-account-set",
        version: 1,
        operationId,
        object: 2,
        realise: 1
      },
      {
        schema: "ad-market-teacher-image-lab-account-add",
        version: 1,
        operationId,
        object: 1,
        realise: 0
      },
      {
        schema: "ad-market-teacher-image-lab-account-revoke",
        version: 1,
        operationId,
        object: 1,
        realise: 1
      },
      {
        schema: "ad-market-teacher-image-lab-batch-add",
        version: 1,
        operationId,
        aliases: ["team-one"],
        object: 2,
        realise: 0
      }
    ]);
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("userId");
  });

  it("marks an uncertain mutation as refresh-required without retrying it", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      error: "IMAGE_LAB_MUTATION_UNCERTAIN",
      operationId,
      retryable: false,
      refreshRequired: true
    }, { status: 409 }));
    const client = new HttpTeacherClient({ fetcher });

    await expect(client.addImageLabAccount({
      operationId,
      alias: "team-one",
      object: 1,
      realise: 0
    })).rejects.toMatchObject({
      code: "IMAGE_LAB_MUTATION_UNCERTAIN",
      retryable: false,
      refreshRequired: true
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("retries one bounded 429 only for a safe GET", async () => {
    const delay = vi.fn().mockResolvedValue(undefined);
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: "RATE_LIMITED" }, {
        status: 429,
        headers: { "retry-after": "2" }
      }))
      .mockResolvedValueOnce(Response.json({ accounts: [summary], pending: [] }));
    const client = new HttpTeacherClient({ fetcher, delay });

    await expect(client.listAccounts()).resolves.toEqual({ accounts: [summary], pending: [] });
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
