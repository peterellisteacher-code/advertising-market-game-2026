import { describe, expect, it, vi } from "vitest";
import {
  AccountClientError,
  HttpAccountClient,
  HttpCloudProgressClient
} from "./account-client";
import { BrowserAccountIdentityBinding } from "./account-identity-binding";
import { createBlankCampaignDocument } from "../domain/campaign-document";
import {
  AccountCookieSerialisationUnavailableError,
  type AccountCookieRequestSerialiser
} from "./account-cookie-request-serialiser";

const activeBinding = (username = "team-one"): BrowserAccountIdentityBinding => {
  const binding = new BrowserAccountIdentityBinding();
  binding.activate(username);
  return binding;
};

const quietPublisher = () => ({ publish: vi.fn<() => void>() });

const nestedRecord = (depth: number): Record<string, unknown> => {
  let value: Record<string, unknown> = { leaf: true };
  for (let index = 0; index < depth; index += 1) value = { child: value };
  return value;
};

const queuedSerialiser = (): AccountCookieRequestSerialiser => {
  let tail = Promise.resolve();
  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      const result = tail.then(operation);
      tail = result.then(() => undefined, () => undefined);
      return result;
    }
  };
};

describe("HttpAccountClient", () => {
  it("invokes the browser fetch implementation with the global receiver", async () => {
    const fetcher = (function (this: unknown): Promise<Response> {
      if (this !== globalThis) return Promise.reject(new TypeError("Illegal invocation"));
      return Promise.resolve(Response.json({ authenticated: false }));
    }) as typeof fetch;
    const client = new HttpAccountClient(
      new BrowserAccountIdentityBinding(), quietPublisher(), fetcher
    );

    await expect(client.session()).resolves.toEqual({ authenticated: false });
  });

  it("fails closed before account fetch when cookie ordering is unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const unavailable: AccountCookieRequestSerialiser = {
      run: async () => { throw new AccountCookieSerialisationUnavailableError(); }
    };
    const client = new HttpAccountClient(
      new BrowserAccountIdentityBinding(), quietPublisher(), fetcher, unavailable
    );

    await expect(client.session()).rejects.toEqual(
      new AccountClientError("ACCOUNT_UNAVAILABLE")
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("serialises a matched logout response before a newer login can begin", async () => {
    let releaseLogout!: () => void;
    const logoutResponse = new Promise<Response>((resolve) => {
      releaseLogout = () => resolve(new Response(null, { status: 204 }));
    });
    const order: string[] = [];
    const logoutFetch = vi.fn<typeof fetch>(async () => {
      order.push("logout-start");
      const response = await logoutResponse;
      order.push("logout-finish");
      return response;
    });
    const loginFetch = vi.fn<typeof fetch>(async () => {
      order.push("login");
      return Response.json({ authenticated: true, username: "team-b" });
    });
    const serialiser = queuedSerialiser();
    const a = new HttpAccountClient(
      activeBinding("team-a"), quietPublisher(), logoutFetch, serialiser
    );
    const b = new HttpAccountClient(
      new BrowserAccountIdentityBinding(), quietPublisher(), loginFetch, serialiser
    );

    const logout = a.logout();
    await vi.waitFor(() => expect(logoutFetch).toHaveBeenCalledOnce());
    const login = b.login({ username: "team-b", password: "password-123" });
    await Promise.resolve();
    expect(loginFetch).not.toHaveBeenCalled();

    releaseLogout();
    await expect(Promise.all([logout, login])).resolves.toBeDefined();
    expect(order).toEqual(["logout-start", "logout-finish", "login"]);
  });

  it("uses bounded streaming JSON and rejects an unexpected redirect", async () => {
    const response = Response.json({ authenticated: false });
    const json = vi.spyOn(response, "json").mockRejectedValue(new Error("unbounded parser used"));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
    const binding = activeBinding();
    const publisher = quietPublisher();
    const client = new HttpAccountClient(binding, publisher, fetcher);

    await expect(client.session()).resolves.toEqual({ authenticated: false });
    expect(binding.current()).toBeNull();
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledWith("/api/account/session", expect.objectContaining({
      redirect: "error"
    }));

    fetcher.mockResolvedValueOnce({ ok: true, redirected: true } as Response);
    await expect(client.session()).rejects.toMatchObject({ code: "ACCOUNT_UNAVAILABLE" });
  });

  it("loads only the exact username-only cookie session contract", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      authenticated: true,
      username: "team-one"
    }));
    const binding = new BrowserAccountIdentityBinding();
    const publisher = quietPublisher();
    const client = new HttpAccountClient(binding, publisher, fetcher);

    await expect(client.session()).resolves.toEqual({
      authenticated: true,
      username: "team-one"
    });
    expect(binding.current()).toBe("team-one");
    expect(publisher.publish).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledWith("/api/account/session", {
      method: "GET",
      credentials: "same-origin",
      redirect: "error",
      headers: { accept: "application/json" }
    });

    fetcher.mockResolvedValueOnce(Response.json({
      authenticated: true,
      username: "team-one",
      userId: "must-not-enter-browser-contract"
    }));
    await expect(client.session()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("sends exact signup/login JSON with same-origin cookie auth and returns no tokens", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ authenticated: true, username: "team-one" }, {
        status: 201
      }))
      .mockResolvedValueOnce(Response.json({ authenticated: true, username: "team-one" }));
    const binding = new BrowserAccountIdentityBinding();
    const publisher = quietPublisher();
    const client = new HttpAccountClient(binding, publisher, fetcher);

    await expect(client.signup({
      username: "team-one",
      password: "student-password",
      classroomCode: "classroom-access"
    })).resolves.toEqual({ authenticated: true, username: "team-one" });
    await expect(client.login({
      username: "team-one",
      password: "student-password"
    })).resolves.toEqual({ authenticated: true, username: "team-one" });
    expect(binding.current()).toBe("team-one");
    expect(publisher.publish).toHaveBeenCalledTimes(2);

    expect(fetcher.mock.calls.map(([path, init]) => [path, {
      method: init?.method,
      credentials: init?.credentials,
      redirect: init?.redirect,
      headers: init?.headers,
      body: JSON.parse(String(init?.body))
    }])).toEqual([
      ["/api/account/signup", {
        method: "POST",
        credentials: "same-origin",
        redirect: "error",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: {
          username: "team-one",
          password: "student-password",
          classroomCode: "classroom-access"
        }
      }],
      ["/api/account/login", {
        method: "POST",
        credentials: "same-origin",
        redirect: "error",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: { username: "team-one", password: "student-password" }
      }]
    ]);
  });

  it("maps bounded public account errors without retaining an upstream body", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      error: "INVALID_CREDENTIALS"
    }, { status: 401 }));
    const client = new HttpAccountClient(
      new BrowserAccountIdentityBinding(),
      quietPublisher(),
      fetcher
    );

    await expect(client.login({ username: "team-one", password: "wrong-password" }))
      .rejects.toEqual(new AccountClientError("INVALID_CREDENTIALS"));
  });

  it("logs a bounded response diagnostic when an account endpoint returns non-JSON", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const body = `<html><body>Password protected site ${"x".repeat(400)}</body></html>`;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, {
      status: 401,
      headers: { "content-type": "text/html; charset=utf-8" }
    }));
    const client = new HttpAccountClient(
      new BrowserAccountIdentityBinding(), quietPublisher(), fetcher
    );

    try {
      await expect(client.login({ username: "team-one", password: "student-password" }))
        .rejects.toMatchObject({ code: "INVALID_RESPONSE" });
      expect(warning).toHaveBeenCalledWith(
        `[AdMarket account request failed] ${JSON.stringify({
          path: "/api/account/login",
          status: 401,
          contentType: "text/html; charset=utf-8",
          body: body.slice(0, 200)
        })}`
      );
    } finally {
      warning.mockRestore();
    }
  });

  it("logs the error name and message when an account fetch throws", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));
    const client = new HttpAccountClient(
      new BrowserAccountIdentityBinding(), quietPublisher(), fetcher
    );

    try {
      await expect(client.session()).rejects.toMatchObject({ code: "ACCOUNT_UNAVAILABLE" });
      expect(warning).toHaveBeenCalledWith(
        `[AdMarket account request failed] ${JSON.stringify({
          path: "/api/account/session",
          name: "TypeError",
          message: "Failed to fetch"
        })}`
      );
    } finally {
      warning.mockRestore();
    }
  });

  it("uses redirect:error for logout and rejects a returned redirect", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce({ ok: true, redirected: true } as Response);
    const binding = activeBinding();
    const publisher = quietPublisher();
    const client = new HttpAccountClient(binding, publisher, fetcher);

    await expect(client.logout()).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith("/api/account/logout", {
      method: "POST",
      credentials: "same-origin",
      redirect: "error",
      headers: { accept: "application/json", "x-admarket-account": "team-one" }
    });
    expect(binding.current()).toBeNull();
    expect(publisher.publish).toHaveBeenCalledTimes(1);
    binding.activate("team-one");
    await expect(client.logout()).rejects.toMatchObject({ code: "ACCOUNT_UNAVAILABLE" });
  });

  it("keeps the stale tab binding when logout detects another cookie identity", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      error: "ACCOUNT_IDENTITY_CHANGED"
    }, { status: 409 }));
    const binding = activeBinding("team-one");
    const publisher = quietPublisher();
    const client = new HttpAccountClient(binding, publisher, fetcher);

    await expect(client.logout()).rejects.toEqual(
      new AccountClientError("AUTHENTICATION_REQUIRED")
    );
    expect(fetcher).toHaveBeenCalledWith("/api/account/logout", expect.objectContaining({
      headers: { accept: "application/json", "x-admarket-account": "team-one" }
    }));
    expect(binding.current()).toBe("team-one");
    expect(publisher.publish).not.toHaveBeenCalled();
  });
});

describe("HttpCloudProgressClient", () => {
  it("invokes the browser fetch implementation with the global receiver", async () => {
    const fetcher = (function (this: unknown): Promise<Response> {
      if (this !== globalThis) return Promise.reject(new TypeError("Illegal invocation"));
      return Promise.resolve(Response.json({
        schema: "advertising-game-progress",
        version: 1,
        documents: []
      }));
    }) as typeof fetch;
    const client = new HttpCloudProgressClient(activeBinding(), fetcher);

    await expect(client.list()).resolves.toEqual([]);
  });

  it("fails closed before progress fetch when cookie ordering is unavailable", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const unavailable: AccountCookieRequestSerialiser = {
      run: async () => { throw new AccountCookieSerialisationUnavailableError(); }
    };
    const client = new HttpCloudProgressClient(activeBinding(), fetcher, unavailable);

    await expect(client.list()).rejects.toEqual(
      new AccountClientError("PROGRESS_UNAVAILABLE")
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects excessive non-Fabric nesting before save and after load", async () => {
    const document = createBlankCampaignDocument({
      documentId: "campaign-main",
      sessionId: "practice-session",
      teamId: "practice-team",
      mode: "offline"
    });
    document.drawingLayers = [{ settings: nestedRecord(140) }];
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      schema: "advertising-game-progress",
      version: 1,
      documentId: "campaign-main",
      revision: 1,
      document,
      updatedAt: "2026-07-17T01:02:03.000Z"
    }));
    const client = new HttpCloudProgressClient(activeBinding(), fetcher);

    await expect(client.save(document, 0)).rejects.toEqual(
      new AccountClientError("INVALID_REQUEST")
    );
    expect(fetcher).not.toHaveBeenCalled();

    await expect(client.load("campaign-main")).rejects.toEqual(
      new AccountClientError("INVALID_RESPONSE")
    );
  });

  it("holds the shared cookie lock through a progress response before login begins", async () => {
    let releaseProgress!: () => void;
    const progressResponse = new Promise<Response>((resolve) => {
      releaseProgress = () => resolve(Response.json({
        schema: "advertising-game-progress",
        version: 1,
        documents: []
      }));
    });
    const order: string[] = [];
    const progressFetch = vi.fn<typeof fetch>(async () => {
      order.push("progress-start");
      const response = await progressResponse;
      order.push("progress-finish");
      return response;
    });
    const loginFetch = vi.fn<typeof fetch>(async () => {
      order.push("login");
      return Response.json({ authenticated: true, username: "team-b" });
    });
    const serialiser = queuedSerialiser();
    const progressClient = new HttpCloudProgressClient(
      activeBinding("team-a"), progressFetch, serialiser
    );
    const accountClient = new HttpAccountClient(
      new BrowserAccountIdentityBinding(), quietPublisher(), loginFetch, serialiser
    );

    const progress = progressClient.list();
    await vi.waitFor(() => expect(progressFetch).toHaveBeenCalledOnce());
    const login = accountClient.login({ username: "team-b", password: "password-123" });
    await Promise.resolve();
    expect(loginFetch).not.toHaveBeenCalled();

    releaseProgress();
    await expect(Promise.all([progress, login])).resolves.toBeDefined();
    expect(order).toEqual(["progress-start", "progress-finish", "login"]);
  });

  it("uses bounded streaming progress JSON and rejects unexpected redirects", async () => {
    const response = Response.json({
      schema: "advertising-game-progress",
      version: 1,
      documents: []
    });
    const json = vi.spyOn(response, "json").mockRejectedValue(new Error("unbounded parser used"));
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);
    const client = new HttpCloudProgressClient(activeBinding(), fetcher);

    await expect(client.list()).resolves.toEqual([]);
    expect(json).not.toHaveBeenCalled();

    fetcher.mockResolvedValueOnce({ ok: true, redirected: true } as Response);
    await expect(client.list()).rejects.toMatchObject({ code: "PROGRESS_UNAVAILABLE" });
  });

  it("saves exact progress v1 JSON and parses saved and conflict responses", async () => {
    const document = createBlankCampaignDocument({
      documentId: "campaign-main",
      sessionId: "practice-session",
      teamId: "practice-team",
      mode: "offline"
    });
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({
        schema: "advertising-game-progress",
        version: 1,
        documentId: "campaign-main",
        revision: 4,
        updatedAt: "2026-07-17T01:02:03.000Z"
      }))
      .mockResolvedValueOnce(Response.json({
        error: "REVISION_CONFLICT",
        currentRevision: 7
      }, { status: 409 }));
    const client = new HttpCloudProgressClient(activeBinding(), fetcher);

    await expect(client.save(document, 3)).resolves.toEqual({
      status: "saved",
      revision: 4,
      updatedAt: "2026-07-17T01:02:03.000Z"
    });
    await expect(client.save(document, 4)).resolves.toEqual({
      status: "conflict",
      currentRevision: 7
    });
    const [path, init] = fetcher.mock.calls[0]!;
    expect(path).toBe("/api/account/progress");
    expect(init).toMatchObject({
      method: "PUT",
      credentials: "same-origin",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-admarket-account": "team-one"
      }
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      schema: "advertising-game-progress",
      version: 1,
      documentId: "campaign-main",
      expectedRevision: 3,
      document
    });
    expect(String(init?.body)).not.toContain("blob:");
  });

  it("loads and validates an exact remote CampaignDocument without caller identity", async () => {
    const document = createBlankCampaignDocument({
      documentId: "campaign-main",
      sessionId: "practice-session",
      teamId: "practice-team",
      mode: "offline"
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      schema: "advertising-game-progress",
      version: 1,
      documentId: "campaign-main",
      revision: 6,
      document,
      updatedAt: "2026-07-17T01:02:03.000Z"
    }));
    const client = new HttpCloudProgressClient(activeBinding(), fetcher);

    await expect(client.load("campaign-main")).resolves.toEqual({
      status: "found",
      revision: 6,
      document,
      updatedAt: "2026-07-17T01:02:03.000Z"
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/account/progress?documentId=campaign-main",
      {
        method: "GET",
        credentials: "same-origin",
        redirect: "error",
        headers: { accept: "application/json", "x-admarket-account": "team-one" }
      }
    );
  });

  it("rejects a room identifier even when a remote or outgoing document claims offline mode", async () => {
    const document = createBlankCampaignDocument({
      documentId: "campaign-main",
      sessionId: "practice-session",
      teamId: "practice-team",
      mode: "offline"
    });
    document.roomId = "room-that-must-not-enter-private-progress";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      schema: "advertising-game-progress",
      version: 1,
      documentId: "campaign-main",
      revision: 6,
      document,
      updatedAt: "2026-07-17T01:02:03.000Z"
    }));
    const client = new HttpCloudProgressClient(activeBinding(), fetcher);

    await expect(client.save(document, 0)).rejects.toEqual(
      new AccountClientError("INVALID_REQUEST")
    );
    expect(fetcher).not.toHaveBeenCalled();

    fetcher.mockResolvedValueOnce(Response.json({
      schema: "advertising-game-progress",
      version: 1,
      documentId: "campaign-main",
      revision: 6,
      document,
      updatedAt: "2026-07-17T01:02:03.000Z"
    }));
    await expect(client.load("campaign-main")).rejects.toEqual(
      new AccountClientError("INVALID_RESPONSE")
    );
  });

  it("rejects missing or empty team identity before saving and after loading cloud progress", async () => {
    const missingTeam = createBlankCampaignDocument({
      documentId: "campaign-main",
      sessionId: "practice-session",
      mode: "offline"
    });
    const emptyTeam = structuredClone(missingTeam);
    emptyTeam.teamId = "";
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      schema: "advertising-game-progress",
      version: 1,
      documentId: "campaign-main",
      revision: 6,
      document: missingTeam,
      updatedAt: "2026-07-17T01:02:03.000Z"
    }));
    const client = new HttpCloudProgressClient(activeBinding(), fetcher);

    await expect(client.save(missingTeam, 0)).rejects.toEqual(
      new AccountClientError("INVALID_REQUEST")
    );
    await expect(client.save(emptyTeam, 0)).rejects.toEqual(
      new AccountClientError("INVALID_REQUEST")
    );
    expect(fetcher).not.toHaveBeenCalled();

    await expect(client.load("campaign-main")).rejects.toEqual(
      new AccountClientError("INVALID_RESPONSE")
    );
  });

  it("rejects recovery-incompatible identities before saving and after loading", async () => {
    const invalid = createBlankCampaignDocument({
      documentId: "campaign-main",
      sessionId: "practice-team",
      teamId: "practice-team",
      mode: "offline"
    });
    const fetcher = vi.fn<typeof fetch>();
    const client = new HttpCloudProgressClient(activeBinding(), fetcher);

    await expect(client.save(invalid, 0)).rejects.toEqual(
      new AccountClientError("INVALID_REQUEST")
    );
    expect(fetcher).not.toHaveBeenCalled();

    fetcher.mockResolvedValueOnce(Response.json({
      schema: "advertising-game-progress",
      version: 1,
      documentId: "campaign-main",
      revision: 6,
      document: invalid,
      updatedAt: "2026-07-17T01:02:03.000Z"
    }));
    await expect(client.load("campaign-main")).rejects.toEqual(
      new AccountClientError("INVALID_RESPONSE")
    );
  });

  it("lists bounded, newest-first cloud document metadata with no mode data", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      schema: "advertising-game-progress",
      version: 1,
      documents: [
        { documentId: "campaign-z", revision: 4, updatedAt: "2026-07-17T01:02:04.000Z" },
        { documentId: "campaign-a", revision: 1, updatedAt: "2026-07-17T01:02:03.000Z" }
      ]
    }));
    const client = new HttpCloudProgressClient(activeBinding(), fetcher);

    await expect(client.list()).resolves.toEqual([
      { documentId: "campaign-z", revision: 4, updatedAt: "2026-07-17T01:02:04.000Z" },
      { documentId: "campaign-a", revision: 1, updatedAt: "2026-07-17T01:02:03.000Z" }
    ]);
    expect(fetcher).toHaveBeenCalledWith("/api/account/progress", {
      method: "GET",
      credentials: "same-origin",
      redirect: "error",
      headers: { accept: "application/json", "x-admarket-account": "team-one" }
    });
  });

  it("rejects malformed, duplicate, or unsorted progress lists and maps list transport failure", async () => {
    const valid = { documentId: "campaign-a", revision: 1, updatedAt: "2026-07-17T01:02:03.000Z" };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce({ redirected: true } as Response)
      .mockResolvedValueOnce(Response.json({
        schema: "advertising-game-progress", version: 1, documents: [valid, valid]
      }))
      .mockResolvedValueOnce(Response.json({
        schema: "advertising-game-progress", version: 1, documents: [
          valid,
          { documentId: "campaign-z", revision: 2, updatedAt: "2026-07-17T01:02:04.000Z" }
        ]
      }))
      .mockRejectedValueOnce(new TypeError("redirect rejected"));
    const client = new HttpCloudProgressClient(activeBinding(), fetcher);

    await expect(client.list()).rejects.toMatchObject({ code: "PROGRESS_UNAVAILABLE" });
    await expect(client.list()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(client.list()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(client.list()).rejects.toMatchObject({ code: "PROGRESS_UNAVAILABLE" });
  });

  it("rejects oversized progress before fetch and maps reauthentication exactly", async () => {
    const document = createBlankCampaignDocument({
      documentId: "campaign-main",
      sessionId: "practice-session",
      teamId: "practice-team",
      mode: "offline"
    });
    document.brief.audienceNeeds = ["x".repeat(256 * 1_024)];
    const fetcher = vi.fn<typeof fetch>();
    const client = new HttpCloudProgressClient(activeBinding(), fetcher);

    await expect(client.save(document, 0)).rejects.toMatchObject({ code: "PROGRESS_TOO_LARGE" });
    expect(fetcher).not.toHaveBeenCalled();

    fetcher.mockResolvedValueOnce(Response.json({ error: "AUTHENTICATION_REQUIRED" }, {
      status: 401
    }));
    await expect(client.load("campaign-main")).rejects.toMatchObject({
      code: "AUTHENTICATION_REQUIRED"
    });
  });

  it("fails closed on a 401 progress status before parsing an absent or hostile body", async () => {
    const document = createBlankCampaignDocument({
      documentId: "campaign-main",
      sessionId: "practice-session",
      teamId: "practice-team",
      mode: "offline"
    });
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response("x".repeat(300 * 1_024), { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    const client = new HttpCloudProgressClient(activeBinding(), fetcher);

    await expect(client.load("campaign-main")).rejects.toEqual(
      new AccountClientError("AUTHENTICATION_REQUIRED")
    );
    await expect(client.list()).rejects.toEqual(
      new AccountClientError("AUTHENTICATION_REQUIRED")
    );
    await expect(client.save(document, 0)).rejects.toEqual(
      new AccountClientError("AUTHENTICATION_REQUIRED")
    );
  });

  it("refuses unbound requests before fetch and maps identity drift without hiding CAS conflicts", async () => {
    const document = createBlankCampaignDocument({
      documentId: "campaign-main",
      sessionId: "practice-session",
      teamId: "practice-team",
      mode: "offline"
    });
    const fetcher = vi.fn<typeof fetch>();
    const binding = new BrowserAccountIdentityBinding();
    const client = new HttpCloudProgressClient(binding, fetcher);

    await expect(client.list()).rejects.toEqual(
      new AccountClientError("AUTHENTICATION_REQUIRED")
    );
    await expect(client.load("campaign-main")).rejects.toEqual(
      new AccountClientError("AUTHENTICATION_REQUIRED")
    );
    await expect(client.save(document, 0)).rejects.toEqual(
      new AccountClientError("AUTHENTICATION_REQUIRED")
    );
    expect(fetcher).not.toHaveBeenCalled();

    binding.activate("team-one");
    fetcher
      .mockResolvedValueOnce(Response.json({ error: "ACCOUNT_IDENTITY_CHANGED" }, { status: 409 }))
      .mockResolvedValueOnce(Response.json({
        error: "REVISION_CONFLICT",
        currentRevision: 9
      }, { status: 409 }));

    await expect(client.list()).rejects.toEqual(
      new AccountClientError("AUTHENTICATION_REQUIRED")
    );
    await expect(client.save(document, 0)).resolves.toEqual({
      status: "conflict",
      currentRevision: 9
    });
  });
});
