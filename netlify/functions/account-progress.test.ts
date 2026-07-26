// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createBlankCampaignDocument } from "../../web/src/domain/campaign-document";
import { ACCOUNT_ACCESS_COOKIE, ACCOUNT_REFRESH_COOKIE } from "./lib/account-primitives";
import { createAccountProgressHandler } from "./account-progress.mjs";

const environment = {
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${"p".repeat(32)}`,
  ADVERTISING_GAME_EDGE_GATEWAY_SECRET: "g".repeat(43),
  ADVERTISING_GAME_USERNAME_HMAC_SECRET: "h".repeat(32),
  ADVERTISING_GAME_CLASSROOM_CODE: "classroom-access"
};

const USER_A = "b9b32e20-0ba8-4896-b89f-44efdfc52942";
const USER_B = "99250725-52e0-44c9-b569-593167786eaf";
const json = (body: unknown, status = 200): Response => Response.json(body, { status });

const userResponse = (userId: string, username: string): Response => json({
  id: userId,
  email: "opaque@accounts.admarket.invalid",
  app_metadata: { advertising_game_username: username }
});

const progressRequest = (
  method: "GET" | "PUT",
  suffix = "?documentId=campaign-main",
  body?: unknown,
  headers: Record<string, string> = {}
): Request => new Request(`https://game.example/api/account/progress${suffix}`, {
  method,
  headers: {
    cookie: `${ACCOUNT_ACCESS_COOKIE}=access-token`,
    "x-admarket-account": "team-one",
    ...(method === "PUT" ? { origin: "https://game.example" } : {}),
    ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...headers
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});

const validCampaignDocument = (documentId = "campaign-main") => {
  const document = createBlankCampaignDocument({
    documentId,
    sessionId: "practice-session",
    mode: "offline",
    teamId: "practice-team"
  });
  document.revision = 3;
  return document;
};

const saveBody = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  schema: "advertising-game-progress",
  version: 1,
  documentId: "campaign-main",
  expectedRevision: 0,
  document: validCampaignDocument(),
  ...overrides
});

const rpcBody = (fetcher: ReturnType<typeof vi.fn<typeof fetch>>, callIndex: number) => {
  const envelope = JSON.parse(String(fetcher.mock.calls[callIndex]?.[1]?.body)) as {
    operation?: unknown;
    input?: unknown;
  };
  expect(envelope.operation).toBe("progress");
  return envelope.input as Record<string, unknown>;
};

describe("account progress API", () => {
  it("rejects a stale tab identity before a progress RPC and preserves rotated current-account cookies", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({
        access_token: "current-b-access",
        refresh_token: "current-b-refresh",
        expires_in: 1800
      }))
      .mockResolvedValueOnce(userResponse(USER_B, "team-two"));

    const response = await createAccountProgressHandler({ environment, fetcher })(
      progressRequest("PUT", "", saveBody(), {
        cookie: `${ACCOUNT_ACCESS_COOKIE}=stale-access; ` +
          `${ACCOUNT_REFRESH_COOKIE}=current-b-refresh-before-rotation`,
        "x-admarket-account": "team-one"
      })
    );

    expect(response.status).toBe(409);
    expect(await response.text()).toBe('{"error":"ACCOUNT_IDENTITY_CHANGED"}');
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.some(([url]) => String(url).includes("progress_rpc"))).toBe(false);
    const cookies = response.headers.get("set-cookie") ?? "";
    expect(cookies).toContain(`${ACCOUNT_ACCESS_COOKIE}=current-b-access`);
    expect(cookies).toContain(`${ACCOUNT_REFRESH_COOKIE}=current-b-refresh`);
    expect(cookies).not.toContain("Max-Age=0");
  });

  it("lists only bounded metadata for each independently authenticated account", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(userResponse(USER_A, "team-one"))
      .mockResolvedValueOnce(json({
        status: "listed",
        documents: [
          {
            documentId: "latest",
            revision: 7,
            updatedAt: "2026-07-17T03:02:03.000Z"
          },
          {
            documentId: "alpha",
            revision: 2,
            updatedAt: "2026-07-17T01:02:03.000Z"
          }
        ]
      }))
      .mockResolvedValueOnce(userResponse(USER_B, "team-two"))
      .mockResolvedValueOnce(json({
        status: "listed",
        documents: [{
          documentId: "other-account",
          revision: 1,
          updatedAt: "2026-07-16T01:02:03.000Z"
        }]
      }));
    const handler = createAccountProgressHandler({ environment, fetcher });

    const responseA = await handler(progressRequest("GET", "", undefined, {
      cookie: `${ACCOUNT_ACCESS_COOKIE}=access-a`
    }));
    const responseB = await handler(progressRequest("GET", "", undefined, {
      cookie: `${ACCOUNT_ACCESS_COOKIE}=access-b`,
      "x-admarket-account": "team-two"
    }));

    expect(responseA.status).toBe(200);
    const responseABody = await responseA.json() as Record<string, unknown>;
    expect(responseABody).toEqual({
      schema: "advertising-game-progress",
      version: 1,
      documents: [
        {
          documentId: "latest",
          revision: 7,
          updatedAt: "2026-07-17T03:02:03.000Z"
        },
        {
          documentId: "alpha",
          revision: 2,
          updatedAt: "2026-07-17T01:02:03.000Z"
        }
      ]
    });
    await expect(responseB.json()).resolves.toEqual({
      schema: "advertising-game-progress",
      version: 1,
      documents: [{
        documentId: "other-account",
        revision: 1,
        updatedAt: "2026-07-16T01:02:03.000Z"
      }]
    });
    expect(rpcBody(fetcher, 1)).toEqual({
      userId: USER_A,
      operation: "list",
      schema: "advertising-game-progress",
      version: 1
    });
    expect(rpcBody(fetcher, 3).userId).toBe(USER_B);
    expect(responseABody.documents).toEqual(expect.arrayContaining([
      expect.not.objectContaining({ document: expect.anything() })
    ]));
  });

  it("rejects malformed, over-limit, duplicate, or non-deterministic list RPC output", async () => {
    const valid = (documentId: string, updatedAt: string) => ({
      documentId,
      revision: 1,
      updatedAt
    });
    const malformedResults: unknown[] = [
      { status: "listed", documents: [], extra: true },
      { status: "found", documents: [] },
      { status: "listed", documents: "not-an-array" },
      { status: "listed", documents: Array.from({ length: 17 }, (_, index) => valid(
        `document-${String(index).padStart(2, "0")}`,
        `2026-07-${String(17 - index).padStart(2, "0")}T01:02:03.000Z`
      )) },
      { status: "listed", documents: [{ ...valid("alpha", "2026-07-17T01:02:03.000Z"), document: {} }] },
      { status: "listed", documents: [valid("../other", "2026-07-17T01:02:03.000Z")] },
      { status: "listed", documents: [{ ...valid("alpha", "2026-07-17T01:02:03.000Z"), revision: 0 }] },
      { status: "listed", documents: [valid("alpha", "not-a-timestamp")] },
      { status: "listed", documents: [
        valid("alpha", "2026-07-16T01:02:03.000Z"),
        valid("later", "2026-07-17T01:02:03.000Z")
      ] },
      { status: "listed", documents: [
        valid("zulu", "2026-07-17T01:02:03.000Z"),
        valid("alpha", "2026-07-17T01:02:03.000Z")
      ] },
      { status: "listed", documents: [
        valid("alpha", "2026-07-17T01:02:03.000Z"),
        valid("alpha", "2026-07-17T01:02:03.000Z")
      ] }
    ];

    for (const result of malformedResults) {
      const fetcher = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(userResponse(USER_A, "team-one"))
        .mockResolvedValueOnce(json(result));
      const response = await createAccountProgressHandler({ environment, fetcher })(
        progressRequest("GET", "")
      );
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ error: "PROGRESS_UNAVAILABLE" });
    }
  });

  it("accepts ASCII-ordinal document ID ties independently of runtime locale", async () => {
    const updatedAt = "2026-07-17T01:02:03.000Z";
    const documents = ["a-thing", "a.thing", "a_thing"].map((documentId) => ({
      documentId,
      revision: 1,
      updatedAt
    }));
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(userResponse(USER_A, "team-one"))
      .mockResolvedValueOnce(json({ status: "listed", documents }));

    const response = await createAccountProgressHandler({ environment, fetcher })(
      progressRequest("GET", "")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      schema: "advertising-game-progress",
      version: 1,
      documents
    });
  });

  it("loads exactly one authenticated account document using the derived Auth user ID", async () => {
    const document = validCampaignDocument();
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(userResponse(USER_A, "team-one"))
      .mockResolvedValueOnce(json({
        status: "found",
        revision: 4,
        document,
        updatedAt: "2026-07-17T01:02:03.000Z"
      }));
    const response = await createAccountProgressHandler({ environment, fetcher })(
      progressRequest("GET")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      schema: "advertising-game-progress",
      version: 1,
      documentId: "campaign-main",
      revision: 4,
      document,
      updatedAt: "2026-07-17T01:02:03.000Z"
    });
    expect(rpcBody(fetcher, 1)).toEqual({
      userId: USER_A,
      operation: "load",
      documentId: "campaign-main",
      schema: "advertising-game-progress",
      version: 1
    });
    expect(fetcher.mock.calls[1]?.[1]?.headers).toEqual(expect.objectContaining({
      "x-advertising-game-gateway-secret": environment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET
    }));
    expect(fetcher.mock.calls[1]?.[1]?.headers).not.toHaveProperty("authorization");
  });

  it("fails closed instead of returning a non-canonical document from the progress RPC", async () => {
    const invalidDocument = validCampaignDocument();
    invalidDocument.roomId = "room-data-must-not-enter-private-progress";
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(userResponse(USER_A, "team-one"))
      .mockResolvedValueOnce(json({
        status: "found",
        revision: 4,
        document: invalidDocument,
        updatedAt: "2026-07-17T01:02:03.000Z"
      }));

    const response = await createAccountProgressHandler({ environment, fetcher })(
      progressRequest("GET")
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "PROGRESS_UNAVAILABLE" });
  });

  it("saves the first revision with compare-and-swap inputs and no caller user ID", async () => {
    const document = validCampaignDocument();
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(userResponse(USER_A, "team-one"))
      .mockResolvedValueOnce(json({
        status: "saved",
        revision: 1,
        updatedAt: "2026-07-17T01:02:03.000Z"
      }));
    const response = await createAccountProgressHandler({ environment, fetcher })(
      progressRequest("PUT", "", saveBody({ document }))
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      schema: "advertising-game-progress",
      version: 1,
      documentId: "campaign-main",
      revision: 1,
      updatedAt: "2026-07-17T01:02:03.000Z"
    });
    expect(rpcBody(fetcher, 1)).toEqual({
      userId: USER_A,
      operation: "save",
      documentId: "campaign-main",
      schema: "advertising-game-progress",
      version: 1,
      expectedRevision: 0,
      document
    });
  });

  it("rejects malformed, live-room, mismatched, and unsafe-asset snapshots before authentication", async () => {
    const roomDocument = createBlankCampaignDocument({
      documentId: "campaign-main",
      sessionId: "room-session",
      mode: "room",
      roomId: "room-one",
      teamId: "team-one"
    });
    const unsafeAssetDocument = validCampaignDocument();
    unsafeAssetDocument.fabricState.objects = [{
      type: "image",
      objectId: "image-one",
      elementKind: "image",
      accessibleName: "Uploaded image",
      src: "blob:https://game.example/temporary"
    }];
    unsafeAssetDocument.assetReferences = [{
      kind: "local-blob",
      objectId: "image-one",
      blobKey: "photo",
      mimeType: "image/png"
    }];

    for (const document of [
      { headline: "not a campaign" },
      roomDocument,
      validCampaignDocument("other-document"),
      unsafeAssetDocument
    ]) {
      const fetcher = vi.fn<typeof fetch>();
      const response = await createAccountProgressHandler({ environment, fetcher })(
        progressRequest("PUT", "", saveBody({ document }))
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: "INVALID_REQUEST" });
      expect(fetcher).not.toHaveBeenCalled();
    }
  });

  it("returns only the current revision on a CAS conflict", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(userResponse(USER_A, "team-one"))
      .mockResolvedValueOnce(json({
        status: "conflict",
        currentRevision: 7,
        document: { private: "must not escape" },
        otherUserDocument: { private: true }
      }));
    const response = await createAccountProgressHandler({ environment, fetcher })(
      progressRequest("PUT", "", saveBody({ expectedRevision: 4 }))
    );
    expect(response.status).toBe(409);
    const text = await response.text();
    expect(text).toBe('{"error":"REVISION_CONFLICT","currentRevision":7}');
    expect(text).not.toContain("private");
    expect(text).not.toContain("document");
  });

  it("isolates identical document IDs by the independently derived authenticated user", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(userResponse(USER_A, "team-one"))
      .mockResolvedValueOnce(json({ status: "not_found" }))
      .mockResolvedValueOnce(userResponse(USER_B, "team-two"))
      .mockResolvedValueOnce(json({ status: "not_found" }));
    const handler = createAccountProgressHandler({ environment, fetcher });

    await handler(progressRequest("GET", "?documentId=shared", undefined, {
      cookie: `${ACCOUNT_ACCESS_COOKIE}=access-a`
    }));
    await handler(progressRequest("GET", "?documentId=shared", undefined, {
      cookie: `${ACCOUNT_ACCESS_COOKIE}=access-b`,
      "x-admarket-account": "team-two"
    }));

    expect(rpcBody(fetcher, 1).userId).toBe(USER_A);
    expect(rpcBody(fetcher, 3).userId).toBe(USER_B);
    expect(rpcBody(fetcher, 1).documentId).toBe("shared");
    expect(rpcBody(fetcher, 3).documentId).toBe("shared");
  });

  it("rejects caller-supplied user IDs, invalid contracts, and cross-origin PUTs before RPC", async () => {
    for (const request of [
      progressRequest("GET", `?documentId=campaign-main&userId=${USER_B}`),
      progressRequest("GET", "?unexpected=value"),
      progressRequest("GET", "?documentId=campaign-main&documentId=other"),
      progressRequest("GET", "?documentId="),
      progressRequest("GET", "?documentId=../other"),
      progressRequest("PUT", "", saveBody({ userId: USER_B })),
      progressRequest("PUT", "", saveBody({ schema: "signal-lost-progress" })),
      progressRequest("PUT", "", saveBody({ version: 2 })),
      progressRequest("PUT", "", saveBody(), { origin: "https://evil.example" })
    ]) {
      const fetcher = vi.fn<typeof fetch>();
      const response = await createAccountProgressHandler({ environment, fetcher })(request);
      expect([400, 403]).toContain(response.status);
      expect(fetcher).not.toHaveBeenCalled();
    }
  });

  it("keeps the SQL list branch caller-scoped, metadata-only, bounded, and deterministic", () => {
    const sql = readFileSync(
      new URL("../../docs/operations/advertising-game-account-progress.sql", import.meta.url),
      "utf8"
    );
    expect(sql).toMatch(/p_operation\s*=\s*'list'/u);
    expect(sql).toMatch(/where\s+progress\.user_id\s*=\s*p_user_id/iu);
    expect(sql).toMatch(
      /order by\s+progress\.updated_at\s+desc,\s*progress\.document_id\s+collate\s+"C"\s+asc/iu
    );
    expect(sql).toMatch(/limit\s+16/iu);
    const listBranch = sql.match(/if p_operation = 'list' then(?<body>[\s\S]*?)end if;/u)?.groups?.body;
    expect(listBranch).toBeDefined();
    expect(listBranch).not.toMatch(/progress\.document(?:\s|,|\))/iu);
  });

  it("keeps SQL save defense checks aligned with the offline CampaignDocument contract", () => {
    const sql = readFileSync(
      new URL("../../docs/operations/advertising-game-account-progress.sql", import.meta.url),
      "utf8"
    );
    expect(sql).toMatch(/p_document\s*->\s*'schemaVersion'[\s\S]*?'1'::(?:pg_catalog\.)?jsonb/iu);
    expect(sql).toMatch(/p_document\s*->>\s*'documentId'\s+is\s+distinct\s+from\s+p_document_id/iu);
    expect(sql).toMatch(/p_document\s*->>\s*'mode'\s+is\s+distinct\s+from\s+'offline'/iu);
    expect(sql).toMatch(/p_document\s*\?\s*'roomId'/iu);
    expect(sql).toMatch(/jsonb_typeof\s*\(\s*p_document\s*->\s*'teamId'\s*\)\s+is\s+distinct\s+from\s+'string'/iu);
    expect(sql).toMatch(/p_document\s*->>\s*'teamId'\s*=\s*''/iu);
    expect(sql).toMatch(/jsonb_typeof\s*\(\s*p_document\s*->\s*'revision'\s*\)/iu);
    expect(sql).toMatch(
      /if\s+p_operation\s+is\s+null\s+or\s+p_operation\s+not\s+in\s*\(\s*'list'\s*,\s*'load'\s*,\s*'save'\s*,\s*'reset'\s*\)/iu
    );
  });

  it("fails closed on every dedicated progress object collision before creation", () => {
    const sql = readFileSync(
      new URL("../../docs/operations/advertising-game-account-progress.sql", import.meta.url),
      "utf8"
    );
    const preflight = sql.match(
      /do\s+\$collision_preflight\$(?<body>[\s\S]*?)\$collision_preflight\$\s*;/iu
    )?.groups?.body;

    expect(preflight).toBeDefined();
    expect(preflight).toMatch(/from\s+pg_catalog\.pg_namespace[\s\S]*?advertising_game/iu);
    expect(preflight).toMatch(
      /from\s+pg_catalog\.pg_class[\s\S]*?advertising_game[\s\S]*?progress/iu
    );
    expect(preflight).toMatch(
      /from\s+pg_catalog\.pg_proc[\s\S]*?public[\s\S]*?advertising_game_progress_rpc/iu
    );
    expect(sql).not.toMatch(/\bif\s+not\s+exists\b/iu);
    expect(sql).not.toMatch(/\bcreate\s+or\s+replace\b/iu);
  });

  it("keeps ownership with the managed migration role without mutating role memberships", () => {
    const sql = readFileSync(
      new URL("../../docs/operations/advertising-game-account-progress.sql", import.meta.url),
      "utf8"
    );
    expect(sql).not.toMatch(/\bcreate\s+role\b/iu);
    expect(sql).not.toMatch(/\bgrant\s+\w+\s+to\s+current_user\b/iu);
    expect(sql).not.toMatch(/\brevoke\s+\w+\s+from\s+current_user\b/iu);
    expect(sql).not.toMatch(/\balter\s+(?:schema|table|function)[\s\S]*?\bowner\s+to\b/iu);
    expect(sql).not.toMatch(/\bset\s+role\b/iu);
  });

  it("keeps the SECURITY DEFINER RPC null-safe and executable only by service_role", () => {
    const sql = readFileSync(
      new URL("../../docs/operations/advertising-game-account-progress.sql", import.meta.url),
      "utf8"
    );

    expect(sql).toMatch(
      /if\s+p_operation\s+is\s+null\s+or\s+p_operation\s+not\s+in\s*\(\s*'list'\s*,\s*'load'\s*,\s*'save'\s*,\s*'reset'\s*\)/iu
    );
    expect(sql).toMatch(/security\s+definer[\s\S]*?set\s+search_path\s*=\s*''/iu);
    expect(sql).toMatch(
      /revoke\s+all[\s\S]*?on\s+function\s+public\.advertising_game_progress_rpc\([\s\S]*?\)[\s\S]*?from\s+public\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role/iu
    );
    expect(sql).toMatch(
      /grant\s+execute[\s\S]*?on\s+function\s+public\.advertising_game_progress_rpc\([\s\S]*?\)[\s\S]*?to\s+service_role/iu
    );
    expect(sql).not.toMatch(/grant\s+execute[\s\S]*?to\s+(?:public|anon|authenticated)\b/iu);
  });

  it("enforces the 256 KiB request envelope before authentication or RPC", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const response = await createAccountProgressHandler({ environment, fetcher })(new Request(
      "https://game.example/api/account/progress",
      {
        method: "PUT",
        headers: {
          origin: "https://game.example",
          cookie: `${ACCOUNT_ACCESS_COOKIE}=access-token`,
          "content-type": "application/json",
          "content-length": String(256 * 1_024 + 1)
        },
        body: "{}"
      }
    ));
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "REQUEST_TOO_LARGE" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refreshes before progress access and rotates cookies", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({
        access_token: "rotated-access",
        refresh_token: "rotated-refresh",
        expires_in: 1800
      }))
      .mockResolvedValueOnce(userResponse(USER_A, "team-one"))
      .mockResolvedValueOnce(json({ status: "not_found" }));
    const response = await createAccountProgressHandler({ environment, fetcher })(
      progressRequest("GET", "?documentId=campaign-main", undefined, {
        cookie: `${ACCOUNT_ACCESS_COOKIE}=expired-access; ` +
          `${ACCOUNT_REFRESH_COOKIE}=refresh-token`
      })
    );
    expect(response.status).toBe(404);
    const cookieHeader = response.headers.get("set-cookie") ?? "";
    expect(cookieHeader).toContain(`${ACCOUNT_ACCESS_COOKIE}=rotated-access`);
    expect(cookieHeader).toContain(`${ACCOUNT_REFRESH_COOKIE}=rotated-refresh`);
    expect(rpcBody(fetcher, 3).userId).toBe(USER_A);
  });

  it("maps expired sessions to 401 and clears stale cookies", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({ message: "refresh expired" }, 400));
    const response = await createAccountProgressHandler({ environment, fetcher })(
      progressRequest("GET", "?documentId=campaign-main", undefined, {
        cookie: `${ACCOUNT_ACCESS_COOKIE}=expired-access; ` +
          `${ACCOUNT_REFRESH_COOKIE}=expired-refresh`
      })
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "AUTHENTICATION_REQUIRED" });
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("maps Auth or RPC upstream failures to one secret-free unavailable response", async () => {
    const authFailure = await createAccountProgressHandler({
      environment,
      fetcher: vi.fn<typeof fetch>().mockRejectedValue(new Error(environment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET))
    })(progressRequest("GET"));
    expect(authFailure.status).toBe(503);
    expect(await authFailure.text()).toBe('{"error":"PROGRESS_UNAVAILABLE"}');

    const rpcFailure = await createAccountProgressHandler({
      environment,
      fetcher: vi.fn<typeof fetch>()
        .mockResolvedValueOnce(userResponse(USER_A, "team-one"))
        .mockResolvedValueOnce(json({ detail: environment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET }, 500))
    })(progressRequest("GET"));
    expect(rpcFailure.status).toBe(503);
    const text = await rpcFailure.text();
    expect(text).toBe('{"error":"PROGRESS_UNAVAILABLE"}');
    expect(text).not.toContain(environment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET);
  });

  it("preserves rotated cookies when a downstream progress RPC fails", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ message: "expired" }, 401))
      .mockResolvedValueOnce(json({
        access_token: "rotated-access",
        refresh_token: "rotated-refresh",
        expires_in: 1800
      }))
      .mockResolvedValueOnce(userResponse(USER_A, "team-one"))
      .mockResolvedValueOnce(json({ detail: environment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET }, 500));
    const response = await createAccountProgressHandler({ environment, fetcher })(
      progressRequest("GET", "?documentId=campaign-main", undefined, {
        cookie: `${ACCOUNT_ACCESS_COOKIE}=expired-access; ` +
          `${ACCOUNT_REFRESH_COOKIE}=refresh-token`
      })
    );

    expect(response.status).toBe(503);
    expect(await response.text()).toBe('{"error":"PROGRESS_UNAVAILABLE"}');
    const cookieHeader = response.headers.get("set-cookie") ?? "";
    expect(cookieHeader).toContain(`${ACCOUNT_ACCESS_COOKIE}=rotated-access`);
    expect(cookieHeader).toContain(`${ACCOUNT_REFRESH_COOKIE}=rotated-refresh`);
  });
});
