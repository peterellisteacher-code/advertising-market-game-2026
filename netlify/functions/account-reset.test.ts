// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { ACCOUNT_ACCESS_COOKIE } from "./lib/account-primitives";
import type { AccountAssetResetPlan } from "./lib/account-assets";
import { config, createAccountResetHandler } from "./account-reset.mjs";

const environment = {
  SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${"p".repeat(32)}`,
  ADVERTISING_GAME_EDGE_GATEWAY_SECRET: "g".repeat(43),
  ADVERTISING_GAME_USERNAME_HMAC_SECRET: "h".repeat(32),
  ADVERTISING_GAME_CLASSROOM_CODE: "classroom-access",
  ADVERTISING_GAME_ASSET_NAMESPACE_SECRET: "n".repeat(32)
};
const userId = "b9b32e20-0ba8-4896-b89f-44efdfc52942";
const operationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const plan: AccountAssetResetPlan = {
  namespace: "a".repeat(64),
  objectDigests: ["b".repeat(64)]
};

const json = (body: unknown, status = 200): Response => Response.json(body, { status });
const userResponse = (): Response => json({
  id: userId,
  email: "opaque@accounts.admarket.invalid",
  app_metadata: { advertising_game_username: "team-one" }
});
const body = (overrides: Record<string, unknown> = {}) => ({
  schema: "advertising-game-account-reset",
  version: 1,
  operationId,
  confirmation: "RESET",
  ...overrides
});
const request = (
  requestBody: unknown = body(),
  init: { method?: string; origin?: string; cookie?: string; account?: string } = {}
): Request => new Request("https://game.example/api/account/reset", {
  method: init.method ?? "POST",
  headers: {
    origin: init.origin ?? "https://game.example",
    cookie: init.cookie ?? `${ACCOUNT_ACCESS_COOKIE}=access-token`,
    "x-admarket-account": init.account ?? "team-one",
    "content-type": "application/json"
  },
  ...(init.method === "GET" ? {} : { body: JSON.stringify(requestBody) })
});

describe("account reset API", () => {
  it("rejects non-POST and cross-origin mutations before any backend call", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const service = {
      planReset: vi.fn(),
      executeReset: vi.fn()
    };
    const handler = createAccountResetHandler({ environment, fetcher, service });

    const method = await handler(request(undefined, { method: "GET" }));
    expect(method.status).toBe(405);
    expect(method.headers.get("allow")).toBe("POST");

    const crossOrigin = await handler(request(body(), { origin: "https://other.example" }));
    expect(crossOrigin.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
    expect(service.planReset).not.toHaveBeenCalled();
  });

  it("requires an authenticated matching account identity", async () => {
    const service = { planReset: vi.fn(), executeReset: vi.fn() };
    const unauthenticated = await createAccountResetHandler({
      environment,
      fetcher: vi.fn<typeof fetch>(),
      service
    })(request(body(), { cookie: "" }));
    expect(unauthenticated.status).toBe(401);

    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(userResponse());
    const changed = await createAccountResetHandler({ environment, fetcher, service })(
      request(body(), { account: "team-two" })
    );
    expect(changed.status).toBe(409);
    await expect(changed.json()).resolves.toEqual({ error: "ACCOUNT_IDENTITY_CHANGED" });
    expect(service.planReset).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...body(), extra: true }],
    [body({ schema: "wrong" })],
    [body({ version: 2 })],
    [body({ operationId: "not-a-uuid" })],
    [body({ operationId: operationId.toUpperCase() })],
    [body({ confirmation: "reset" })],
    [body({ confirmation: " RESET " })],
    [null]
  ])("rejects malformed reset bodies without touching state", async (requestBody) => {
    const fetcher = vi.fn<typeof fetch>();
    const service = { planReset: vi.fn(), executeReset: vi.fn() };
    const response = await createAccountResetHandler({ environment, fetcher, service })(
      request(requestBody)
    );
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
    expect(service.planReset).not.toHaveBeenCalled();
  });

  it("plans exact assets before resetting progress and deletes the planned assets last", async () => {
    const events: string[] = [];
    const fetcher = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => {
        events.push("session");
        return userResponse();
      })
      .mockImplementationOnce(async () => {
        events.push("progress");
        return json({ status: "reset" });
      });
    const service = {
      planReset: vi.fn(async () => {
        events.push("plan");
        return plan;
      }),
      executeReset: vi.fn(async () => {
        events.push("assets");
      })
    };

    const response = await createAccountResetHandler({ environment, fetcher, service })(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "reset", operationId });
    expect(events).toEqual(["session", "plan", "progress", "assets"]);
    expect(service.planReset).toHaveBeenCalledWith(userId);
    expect(service.executeReset).toHaveBeenCalledWith(plan);
    const rpcEnvelope = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body));
    expect(rpcEnvelope).toEqual({
      operation: "progress",
      input: {
        userId,
        operation: "reset",
        schema: "advertising-game-progress",
        version: 1
      }
    });
  });

  it("returns a stable retryable response when exact asset cleanup fails after progress reset", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(userResponse())
      .mockResolvedValueOnce(json({ status: "reset" }));
    const service = {
      planReset: vi.fn().mockResolvedValue(plan),
      executeReset: vi.fn().mockRejectedValue(new Error("private storage detail"))
    };

    const response = await createAccountResetHandler({ environment, fetcher, service })(request());
    const responseCopy = response.clone();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "RESET_INCOMPLETE",
      operationId,
      retryable: true
    });
    expect(await responseCopy.text()).not.toContain("private storage detail");
  });

  it("accepts replay of the same operation after state is already absent", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(userResponse())
      .mockResolvedValueOnce(json({ status: "reset" }))
      .mockResolvedValueOnce(userResponse())
      .mockResolvedValueOnce(json({ status: "reset" }));
    const emptyPlan = { ...plan, objectDigests: [] };
    const service = {
      planReset: vi.fn().mockResolvedValue(emptyPlan),
      executeReset: vi.fn().mockResolvedValue(undefined)
    };
    const handler = createAccountResetHandler({ environment, fetcher, service });

    await expect((await handler(request())).json()).resolves.toEqual({ status: "reset", operationId });
    await expect((await handler(request())).json()).resolves.toEqual({ status: "reset", operationId });
    expect(service.planReset).toHaveBeenCalledTimes(2);
    expect(service.executeReset).toHaveBeenCalledTimes(2);
  });

  it("retains the classroom-NAT-safe mutation limit", () => {
    expect(config.rateLimit).toEqual({
      windowLimit: 300,
      windowSize: 60,
      aggregateBy: ["ip", "domain"]
    });
  });
});
