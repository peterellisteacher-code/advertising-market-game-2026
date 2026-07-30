// @vitest-environment node

import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createBlankCampaignDocument } from "../../web/src/domain/campaign-document";
import {
  createTeacherSessionClaims,
  createTeacherSessionToken,
  TEACHER_SESSION_COOKIE
} from "./lib/teacher-auth";
import {
  config as teacherPlaytestConfig,
  createTeacherPlaytestHandler
} from "./teacher-playtest.mjs";

const nowSeconds = 1_800_000_000;
const operationId = "2d90c112-4de8-4e7b-92d2-0d655738987f";
const userId = "b9b32e20-0ba8-4896-b89f-44efdfc52942";
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

const teacherCookie = (): string => `${TEACHER_SESSION_COOKIE}=${createTeacherSessionToken(
  createTeacherSessionClaims(nowSeconds, 8 * 60 * 60, "AAAAAAAAAAAAAAAAAAAAAA"),
  environment.ADVERTISING_GAME_TEACHER_SESSION_SECRET
)}`;

const request = (
  path: string,
  method: "GET" | "PUT" | "POST",
  body?: BodyInit,
  contentType?: string,
  authenticated = true
): Request => new Request(`https://game.example${path}`, {
  method,
  headers: {
    ...(method === "GET" ? {} : { origin: "https://game.example" }),
    ...(contentType === undefined ? {} : { "content-type": contentType }),
    ...(authenticated ? { cookie: teacherCookie() } : {})
  },
  ...(body === undefined ? {} : { body })
});

const document = createBlankCampaignDocument({
  documentId: "campaign-main",
  sessionId: "teacher-playtest-session",
  mode: "offline",
  teamId: "teacher-playtest"
});

const dependencies = () => {
  const events: string[] = [];
  const client = {
    ensureAdvertisingGameUser: vi.fn().mockImplementation(async (
      username: string,
      password: string
    ) => {
      events.push("ensure");
      return {
        userId,
        username,
        createdAt: "2026-07-27T00:00:00.000Z",
        lastSignInAt: null,
        password
      };
    }),
    progressRpc: vi.fn().mockImplementation(async (input) => {
      events.push(`progress:${input.operation}`);
      if (input.operation === "list") return { status: "listed", documents: [] };
      if (input.operation === "load") return { status: "not_found" };
      if (input.operation === "reset") return { status: "reset" };
      return {
        status: "saved",
        revision: 1,
        updatedAt: "2026-07-27T01:02:03.000Z"
      };
    })
  };
  const assets = {
    put: vi.fn().mockImplementation(async (
      _resolvedUserId: string,
      digest: string,
      contentType: string,
      bytes: Uint8Array
    ) => {
      events.push("asset:put");
      return {
        created: true,
        manifest: {
          schema: "advertising-game-account-asset",
          version: 1,
          asset: {
            id: digest,
            sha256: digest,
            contentType,
            byteLength: bytes.byteLength,
            href: `/api/account/assets/${digest}`
          }
        }
      };
    }),
    get: vi.fn(),
    planReset: vi.fn().mockImplementation(async () => {
      events.push("plan");
      return { namespace: "a".repeat(64), objectDigests: [] };
    }),
    executeReset: vi.fn().mockImplementation(async () => {
      events.push("assets:reset");
    })
  };
  return { events, client, assets };
};

describe("teacher playtest API", () => {
  it("uses separate shared-network capacity and exact routes", () => {
    expect(teacherPlaytestConfig).toEqual({
      path: [
        "/api/teacher/playtest/progress",
        "/api/teacher/playtest/assets/:digest",
        "/api/teacher/playtest/reset"
      ],
      rateLimit: {
        windowLimit: 300,
        windowSize: 60,
        aggregateBy: ["ip", "domain"]
      }
    });
  });

  it("requires the teacher session before resolving the reserved identity", async () => {
    const setup = dependencies();
    const response = await createTeacherPlaytestHandler({
      environment,
      client: setup.client,
      assets: setup.assets,
      nowSeconds: () => nowSeconds
    })(request("/api/teacher/playtest/progress", "GET", undefined, undefined, false));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "AUTHENTICATION_REQUIRED"
    });
    expect(setup.client.ensureAdvertisingGameUser).not.toHaveBeenCalled();
  });

  it("lists, loads and saves progress only for the reserved playtest user", async () => {
    const setup = dependencies();
    const handler = createTeacherPlaytestHandler({
      environment,
      client: setup.client,
      assets: setup.assets,
      nowSeconds: () => nowSeconds
    });
    const listed = await handler(request("/api/teacher/playtest/progress", "GET"));
    const loaded = await handler(request(
      "/api/teacher/playtest/progress?documentId=campaign-main",
      "GET"
    ));
    const saved = await handler(request(
      "/api/teacher/playtest/progress",
      "PUT",
      JSON.stringify({
        schema: "advertising-game-progress",
        version: 1,
        documentId: "campaign-main",
        expectedRevision: 0,
        document
      }),
      "application/json"
    ));

    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toEqual({
      schema: "advertising-game-progress",
      version: 1,
      documents: []
    });
    expect(loaded.status).toBe(404);
    expect(saved.status).toBe(200);
    expect(setup.client.progressRpc.mock.calls.map(([input]) => input.userId))
      .toEqual([userId, userId, userId]);
    expect(setup.client.ensureAdvertisingGameUser).toHaveBeenCalledTimes(3);
    for (const [username, password] of setup.client.ensureAdvertisingGameUser.mock.calls) {
      expect(username).toBe("teacher-playtest");
      expect(password).toMatch(/^[A-Za-z0-9_-]{43}$/u);
      expect(password).not.toContain("teacher-playtest");
    }
    const responseText = [
      await loaded.clone().text(),
      await saved.clone().text()
    ].join("\n");
    expect(responseText).not.toContain(userId);
    expect(responseText).not.toContain("teacher-playtest");
  });

  it("puts playtest assets under the reserved user without pair cookies or identity headers", async () => {
    const setup = dependencies();
    const bytes = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01
    ]);
    const digest = createHash("sha256").update(bytes).digest("hex");
    const response = await createTeacherPlaytestHandler({
      environment,
      client: setup.client,
      assets: setup.assets,
      nowSeconds: () => nowSeconds
    })(request(
      `/api/teacher/playtest/assets/${digest}`,
      "PUT",
      bytes,
      "image/png"
    ));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      asset: {
        href: `/api/teacher/playtest/assets/${digest}`
      }
    });
    expect(setup.assets.put).toHaveBeenCalledWith(
      userId,
      digest,
      "image/png",
      bytes
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("factory reset requires RESET and preserves the reserved Auth identity", async () => {
    const setup = dependencies();
    const handler = createTeacherPlaytestHandler({
      environment,
      client: setup.client,
      assets: setup.assets,
      nowSeconds: () => nowSeconds
    });
    const denied = await handler(request(
      "/api/teacher/playtest/reset",
      "POST",
      JSON.stringify({
        schema: "ad-market-teacher-playtest-reset",
        version: 1,
        operationId,
        confirmation: "reset"
      }),
      "application/json"
    ));
    expect(denied.status).toBe(400);
    expect(setup.client.ensureAdvertisingGameUser).not.toHaveBeenCalled();

    const reset = await handler(request(
      "/api/teacher/playtest/reset",
      "POST",
      JSON.stringify({
        schema: "ad-market-teacher-playtest-reset",
        version: 1,
        operationId,
        confirmation: "RESET"
      }),
      "application/json"
    ));
    expect(reset.status).toBe(200);
    await expect(reset.json()).resolves.toEqual({
      status: "reset",
      operationId
    });
    expect(setup.events).toEqual([
      "ensure",
      "plan",
      "progress:reset",
      "assets:reset"
    ]);
    expect(setup.client.ensureAdvertisingGameUser).toHaveBeenCalledWith(
      "teacher-playtest",
      expect.any(String)
    );
    expect(setup.client).not.toHaveProperty("replaceAdvertisingGamePassword");
  });

  it("reports RESET_INCOMPLETE without automatically repeating an uncertain asset reset", async () => {
    const setup = dependencies();
    setup.assets.executeReset.mockRejectedValueOnce(new Error("uncertain"));
    const response = await createTeacherPlaytestHandler({
      environment,
      client: setup.client,
      assets: setup.assets,
      nowSeconds: () => nowSeconds
    })(request(
      "/api/teacher/playtest/reset",
      "POST",
      JSON.stringify({
        schema: "ad-market-teacher-playtest-reset",
        version: 1,
        operationId,
        confirmation: "RESET"
      }),
      "application/json"
    ));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "RESET_INCOMPLETE",
      operationId,
      retryable: false
    });
    expect(setup.client.progressRpc).toHaveBeenCalledTimes(1);
    expect(setup.assets.executeReset).toHaveBeenCalledTimes(1);
  });
});
