import { describe, expect, it, vi } from "vitest";
import {
  MarketClient,
  MarketClientError,
  isMarketSafeJson
} from "./market-client";
import { MarketSessionStore, type StoragePort } from "./market-session-store";
import {
  MarketTabCoordinationError,
  type MarketTabCoordinationPort
} from "./market-tab-coordinator";
import { isJoinOperationIdForRoom } from "../../../shared/market-operation-id";

const UUID_1 = "11111111-1111-4111-8111-111111111111";
const UUID_2 = "22222222-2222-4222-8222-222222222222";
const UUID_3 = "33333333-3333-4333-8333-333333333333";
const UUID_4 = "44444444-4444-4444-8444-444444444444";
const COMMAND_PUBLISH = "55555555-5555-4555-8555-555555555555";
const COMMAND_FINISH = "66666666-6666-4666-8666-666666666666";
const COMMAND_REVIEW = "77777777-7777-4777-8777-777777777777";
const COMMAND_CONTROL = "88888888-8888-4888-8888-888888888888";
const COMMAND_REMOVE = "99999999-9999-4999-8999-999999999999";
const COMMAND_AWARD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ROOM_CODE = "ABC-234";
const TOKEN = "header.signature";
const EXPIRES_AT = 2_000;
const PNG_BYTES = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

class MemoryStorage implements StoragePort {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

const makeStore = (
  ids: readonly string[] = [UUID_1, UUID_2, UUID_3, UUID_4],
  active = false,
  coordinator: MarketTabCoordinationPort = {
    coordinate: () => Promise.resolve(),
    close() {}
  }
): MarketSessionStore => {
  let index = 0;
  const store = new MarketSessionStore({
    storage: new MemoryStorage(),
    nowSeconds: () => 1_000,
    randomUUID: () => ids[index++] ?? UUID_4,
    coordinator
  });
  if (active) {
    store.activate({
      scheme: "Bearer", token: TOKEN, role: "teacher", roomCode: ROOM_CODE,
      expiresAt: EXPIRES_AT
    });
  }
  return store;
};

const sessionResponse = (
  role: "teacher" | "team" = "teacher",
  roomCode = ROOM_CODE,
  snapshot: unknown = { phase: "building" },
  token = TOKEN
) => ({
  role,
  roomCode,
  snapshot,
  session: { scheme: "Bearer", token, expiresAt: EXPIRES_AT }
});

const jsonResponse = (value: unknown, status = 200): Response => new Response(
  JSON.stringify(value),
  { status, headers: { "content-type": "application/json" } }
);

const fetchCall = (mock: ReturnType<typeof vi.fn>, index = 0): [URL | RequestInfo, RequestInit] => {
  const call = mock.mock.calls[index];
  if (!call) throw new Error(`Missing fetch call ${index}`);
  return call as [URL | RequestInfo, RequestInit];
};

describe("MarketClient", () => {
  it("uses only the same-origin room routes with credentialed, bounded JSON requests", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse(sessionResponse()))
      .mockResolvedValueOnce(jsonResponse(sessionResponse("team")))
      .mockResolvedValueOnce(jsonResponse({ phase: "market" }))
      .mockResolvedValueOnce(jsonResponse({ snapshot: { phase: "building" } }))
      .mockResolvedValueOnce(jsonResponse({ receipt: { id: "receipt-1" } }))
      .mockResolvedValueOnce(jsonResponse({ snapshot: { myAwards: [{ medal: "gold" }] } }))
      .mockResolvedValueOnce(jsonResponse({ snapshot: { own: { finished: true } } }))
      .mockResolvedValueOnce(jsonResponse({ snapshot: { campaigns: [] } }))
      .mockResolvedValueOnce(jsonResponse({ snapshot: { phase: "market" } }))
      .mockResolvedValueOnce(jsonResponse({ snapshot: { phase: "building" } }));
    const client = new MarketClient(fetcher, {
      sessionStore: makeStore(),
      fingerprint: async () => "a".repeat(64)
    });

    await client.createRoom(10_000, "teacher-key", 15);
    await client.joinRoom("ABC-234", "Neon Narwhals");
    await client.getSnapshot();
    await client.publishCampaign({
      productName: "Orbit Bottle",
      priceCents: 6_000,
      artworkKey: "rooms/hash/media/team/hash.png"
    }, COMMAND_PUBLISH);
    await client.purchase("campaign-2", "request-1");
    await client.award("campaign-3", "gold", COMMAND_AWARD);
    await client.finish(COMMAND_FINISH);
    await client.reviewCampaign("campaign-1", 4, "approved", COMMAND_REVIEW);
    await client.control({ action: "openMarket" }, COMMAND_CONTROL);
    await client.control({ action: "removeTeam", teamId: "team-3" }, COMMAND_REMOVE);

    expect(fetcher).toHaveBeenCalledTimes(10);
    expect(fetchCall(fetcher, 0)).toEqual(["/api/market/create", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      body: JSON.stringify({
        classroomCode: "teacher-key", openingWalletCents: 10_000, maxTeams: 15,
        clientId: UUID_1, operationId: UUID_2
      })
    })]);
    expect(fetchCall(fetcher, 1)).toEqual(["/api/market/join", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      body: expect.any(String)
    })]);
    const joinBody = JSON.parse(String(fetchCall(fetcher, 1)[1].body));
    expect(joinBody).toMatchObject({
      roomCode: ROOM_CODE, alias: "Neon Narwhals", clientId: UUID_1
    });
    expect(isJoinOperationIdForRoom(joinBody.operationId, ROOM_CODE)).toBe(true);
    expect(fetchCall(fetcher, 2)).toEqual(["/api/market/snapshot", expect.objectContaining({
      method: "GET",
      credentials: "same-origin"
    })]);
    expect(fetchCall(fetcher, 3)[1].body).toBe(JSON.stringify({
      commandId: COMMAND_PUBLISH,
      productName: "Orbit Bottle",
      priceCents: 6_000,
      artworkKey: "rooms/hash/media/team/hash.png"
    }));
    expect(fetchCall(fetcher, 4)[1].body).toBe(JSON.stringify({
      campaignId: "campaign-2",
      requestId: "request-1"
    }));
    expect(fetchCall(fetcher, 5)[1].body).toBe(JSON.stringify({
      commandId: COMMAND_AWARD,
      campaignId: "campaign-3",
      medal: "gold"
    }));
    expect(fetchCall(fetcher, 6)[1].body).toBe(JSON.stringify({
      commandId: COMMAND_FINISH
    }));
    expect(fetchCall(fetcher, 7)[1].body).toBe(JSON.stringify({
      commandId: COMMAND_REVIEW,
      campaignId: "campaign-1",
      submissionVersion: 4,
      status: "approved"
    }));
    expect(fetchCall(fetcher, 8)[1].body).toBe(JSON.stringify({
      commandId: COMMAND_CONTROL,
      action: "openMarket"
    }));
    expect(fetchCall(fetcher, 9)[1].body).toBe(JSON.stringify({
      commandId: COMMAND_REMOVE,
      action: "removeTeam",
      teamId: "team-3"
    }));
    for (const [, init] of fetcher.mock.calls as Array<[string, RequestInit]>) {
      expect(init.credentials).toBe("same-origin");
      expect(init.redirect).toBe("error");
    }
    for (const [, init] of (fetcher.mock.calls as Array<[string, RequestInit]>).slice(2)) {
      expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    }
  });

  it("uploads and retrieves authenticated PNG artwork without turning it into JSON", async () => {
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        artworkKey: "rooms/hash/media/team/hash.png",
        registered: true
      }))
      .mockResolvedValueOnce(new Response(png, {
        status: 200,
        headers: { "content-type": "image/png", "content-length": String(png.byteLength) }
      }));
    const client = new MarketClient(fetcher, { sessionStore: makeStore(undefined, true) });

    expect(await client.uploadArtwork(png)).toBe("rooms/hash/media/team/hash.png");
    expect(await client.getArtwork("rooms/hash/media/team/hash.png")).toEqual(png);

    const upload = fetchCall(fetcher, 0);
    expect(upload[0]).toBe("/api/market/artwork");
    expect(upload[1]).toMatchObject({
      method: "PUT",
      credentials: "same-origin",
      headers: { "content-type": "image/png", authorization: `Bearer ${TOKEN}` }
    });
    expect(upload[1].body).toBe(png);
    const retrieve = fetchCall(fetcher, 1);
    expect(retrieve[0]).toBe(
      "/api/market/artwork?key=rooms%2Fhash%2Fmedia%2Fteam%2Fhash.png"
    );
    expect(new Headers(retrieve[1].headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
  });

  it("rejects a request that does not settle before the configured deadline", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => {});
      });
      const client = new MarketClient(fetcher, {
        requestTimeoutMs: 25, sessionStore: makeStore(undefined, true)
      });

      const pending = client.getSnapshot();
      const rejected = expect(pending).rejects.toMatchObject({ code: "REQUEST_TIMEOUT", status: 0 });
      await vi.advanceTimersByTimeAsync(25);

      await rejected;
      expect(signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the request deadline active while JSON and PNG bodies are still streaming", async () => {
    vi.useFakeTimers();
    try {
      const pendingBody = (contentType: string): Response => new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(Uint8Array.of(0x7b));
          }
        }),
        { status: 200, headers: { "content-type": contentType } }
      );
      const signals: AbortSignal[] = [];
      const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.signal) signals.push(init.signal);
        return Promise.resolve(pendingBody(
          signals.length === 1 ? "application/json" : "image/png"
        ));
      });
      const client = new MarketClient(fetcher, {
        requestTimeoutMs: 25, sessionStore: makeStore(undefined, true)
      });

      const jsonRejected = expect(client.getSnapshot()).rejects.toMatchObject({
        code: "REQUEST_TIMEOUT",
        status: 0
      });
      const pngRejected = expect(client.getArtwork("safe-key")).rejects.toMatchObject({
        code: "REQUEST_TIMEOUT",
        status: 0
      });
      await vi.advanceTimersByTimeAsync(25);

      await Promise.all([jsonRejected, pngRejected]);
      expect(signals).toHaveLength(2);
      expect(signals.every(({ aborted }) => aborted)).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels oversized streamed JSON and PNG bodies despite missing or lying lengths", async () => {
    const streamed = (
      contentType: string,
      chunkSize: number,
      totalChunks: number,
      declared?: string
    ) => {
      let pulls = 0;
      let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls += 1;
          if (pulls > totalChunks) {
            controller.close();
            return;
          }
          const chunk = new Uint8Array(chunkSize);
          if (pulls === 1 && contentType === "image/png") chunk.set(PNG_BYTES.slice(0, 8));
          controller.enqueue(chunk);
        },
        cancel() { cancelled = true; }
      });
      const headers: Record<string, string> = { "content-type": contentType };
      if (declared !== undefined) headers["content-length"] = declared;
      return {
        response: new Response(body, { status: 200, headers }),
        state: () => ({ pulls, cancelled })
      };
    };
    const json = streamed("application/json", 256 * 1024, 10);
    const png = streamed("image/png", 1024 * 1024, 8, "8");
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json.response)
      .mockResolvedValueOnce(png.response);
    const client = new MarketClient(fetcher, { sessionStore: makeStore(undefined, true) });

    await expect(client.getSnapshot()).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
    await expect(client.getArtwork("safe-key")).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });

    expect(json.state()).toMatchObject({ cancelled: true });
    expect(json.state().pulls).toBeLessThan(10);
    expect(png.state()).toMatchObject({ cancelled: true });
    expect(png.state().pulls).toBeLessThan(8);
  });

  it("rejects non-finite configured request deadlines", () => {
    expect(() => new MarketClient(vi.fn(), { requestTimeoutMs: Infinity })).toThrow(RangeError);
  });

  it("preserves a successful response while clearing its deadline timer", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return Promise.resolve(jsonResponse({ phase: "market" }));
      });
      const client = new MarketClient(fetcher, {
        requestTimeoutMs: 25, sessionStore: makeStore(undefined, true)
      });

      await expect(client.getSnapshot()).resolves.toEqual({ phase: "market" });
      expect(signal?.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(25);
      expect(signal?.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves server failures while clearing their deadline timer", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return Promise.resolve(jsonResponse({ error: "OWN_CAMPAIGN" }, 409));
      });
      const client = new MarketClient(fetcher, {
        requestTimeoutMs: 25, sessionStore: makeStore(undefined, true)
      });

      await expect(client.purchase("campaign-1", "request-1")).rejects.toMatchObject({
        code: "OWN_CAMPAIGN",
        status: 409
      });
      expect(signal?.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("turns bounded server errors into stable client errors and rejects unsafe responses", async () => {
    const denied = new MarketClient(
      vi.fn().mockResolvedValue(jsonResponse({ error: "OWN_CAMPAIGN" }, 409)),
      { sessionStore: makeStore(undefined, true) }
    );
    await expect(denied.purchase("campaign-1", "request-1")).rejects.toEqual(
      expect.objectContaining<Partial<MarketClientError>>({ code: "OWN_CAMPAIGN", status: 409 })
    );

    const wrongType = new MarketClient(vi.fn().mockResolvedValue(new Response("hello", {
      status: 200,
      headers: { "content-type": "text/plain" }
    })), { sessionStore: makeStore(undefined, true) });
    await expect(wrongType.getSnapshot()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });

    const tooLarge = new MarketClient(vi.fn().mockResolvedValue(new Response("x".repeat(1_048_577), {
      status: 200,
      headers: { "content-type": "application/json", "content-length": "1048577" }
    })), { sessionStore: makeStore(undefined, true) });
    await expect(tooLarge.getSnapshot()).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });

    const badArtwork = new MarketClient(vi.fn().mockResolvedValue(new Response("not png", {
      status: 200,
      headers: { "content-type": "text/plain" }
    })), { sessionStore: makeStore(undefined, true) });
    await expect(badArtwork.getArtwork("safe-key")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("fingerprints fixed-order inputs, reuses failed intents, stores the token and strips it from results", async () => {
    const canonicalInputs: string[] = [];
    const store = makeStore();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: "MARKET_UNAVAILABLE" }, 503))
      .mockResolvedValueOnce(jsonResponse(sessionResponse()));
    const client = new MarketClient(fetcher, {
      sessionStore: store,
      fingerprint: async (canonicalJson) => {
        canonicalInputs.push(canonicalJson);
        return "a".repeat(64);
      }
    });

    await expect(client.createRoom(10_000, "teacher-key", 15)).rejects.toMatchObject({
      code: "MARKET_UNAVAILABLE", status: 503
    });
    await expect(client.createRoom(10_000, "teacher-key", 15)).resolves.toEqual({
      role: "teacher", roomCode: ROOM_CODE, snapshot: { phase: "building" }
    });

    expect(canonicalInputs).toEqual([
      '{"classroomCode":"teacher-key","openingWalletCents":10000,"maxTeams":15}',
      '{"classroomCode":"teacher-key","openingWalletCents":10000,"maxTeams":15}'
    ]);
    const firstBody = JSON.parse(String(fetchCall(fetcher, 0)[1].body));
    const secondBody = JSON.parse(String(fetchCall(fetcher, 1)[1].body));
    expect(firstBody).toEqual({
      classroomCode: "teacher-key", openingWalletCents: 10_000, maxTeams: 15,
      clientId: UUID_1, operationId: UUID_2
    });
    expect(secondBody).toEqual(firstBody);
    expect(store.readActive()).toEqual({
      scheme: "Bearer", token: TOKEN, role: "teacher", roomCode: ROOM_CODE,
      expiresAt: EXPIRES_AT
    });
    expect(store.readIntent()).toBeNull();
  });

  it("uses SHA-256 for the default canonical-input fingerprint", async () => {
    const store = makeStore();
    const client = new MarketClient(
      vi.fn().mockResolvedValue(jsonResponse({ error: "MARKET_UNAVAILABLE" }, 503)),
      { sessionStore: store }
    );

    await expect(client.createRoom(10_000, "teacher-key", 15)).rejects.toMatchObject({
      code: "MARKET_UNAVAILABLE"
    });
    expect(store.readIntent()?.fingerprint).toBe(
      "02e7c5d7c6553d88ad513dc98e6623a1423237c4c0e600be3e1131392bf0af1a"
    );
  });

  it("keeps distinct client identities for distinct tab session stores", async () => {
    const firstFetcher = vi.fn().mockResolvedValue(jsonResponse(sessionResponse("team")));
    const secondFetcher = vi.fn().mockResolvedValue(jsonResponse(sessionResponse("team")));
    const fingerprint = async () => "b".repeat(64);
    const first = new MarketClient(firstFetcher, {
      sessionStore: makeStore([UUID_1, UUID_2]), fingerprint
    });
    const second = new MarketClient(secondFetcher, {
      sessionStore: makeStore([UUID_3, UUID_4]), fingerprint
    });

    await Promise.all([
      first.joinRoom(ROOM_CODE, "Neon Narwhals"),
      second.joinRoom(ROOM_CODE, "Pixel Pirates")
    ]);

    expect(JSON.parse(String(fetchCall(firstFetcher)[1].body))).toMatchObject({ clientId: UUID_1 });
    expect(JSON.parse(String(fetchCall(secondFetcher)[1].body))).toMatchObject({ clientId: UUID_3 });
  });

  it("rejects a stale session response without activating or clearing the newer operation", async () => {
    let resolveFirst!: (response: Response) => void;
    const store = makeStore();
    const fetcher = vi.fn()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(jsonResponse(sessionResponse("team", ROOM_CODE, { phase: "market" }, "newer.token")));
    const client = new MarketClient(fetcher, {
      sessionStore: store,
      fingerprint: async (value) => value.includes("teacher-key") ? "a".repeat(64) : "b".repeat(64)
    });

    const stale = client.createRoom(10_000, "teacher-key", 15);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    await expect(client.joinRoom(ROOM_CODE, "Pixel Pirates")).resolves.toEqual({
      role: "team", roomCode: ROOM_CODE, snapshot: { phase: "market" }
    });
    resolveFirst(jsonResponse(sessionResponse("teacher", ROOM_CODE, { phase: "building" }, "older.token")));

    await expect(stale).rejects.toMatchObject({ code: "STALE_OPERATION", status: 0 });
    expect(store.readActive()).toMatchObject({ role: "team", token: "newer.token" });
    expect(store.readIntent()).toBeNull();
  });

  it("strictly rejects malformed internal session envelopes without activating them", async () => {
    const invalid = [
      { ...sessionResponse(), extra: true },
      sessionResponse("teacher", ROOM_CODE, {}, "not a token"),
      {
        ...sessionResponse(),
        session: { scheme: "Bearer", token: TOKEN, expiresAt: 1_000 }
      }
    ];

    for (const payload of invalid) {
      const store = makeStore();
      const client = new MarketClient(vi.fn().mockResolvedValue(jsonResponse(payload)), {
        sessionStore: store, fingerprint: async () => "a".repeat(64)
      });
      await expect(client.createRoom(10_000, "teacher-key", 15)).rejects.toMatchObject({
        code: "INVALID_RESPONSE"
      });
      expect(store.readActive()).toBeNull();
      expect(store.readIntent()).not.toBeNull();
    }
  });

  it("rejects create and join snapshots that contain the issued bearer anywhere", async () => {
    for (const [method, snapshot] of [
      ["create", { nested: [{ echo: TOKEN }] }],
      ["join", { nested: { echo: `Bearer ${TOKEN}` } }]
    ] as const) {
      const store = makeStore();
      const client = new MarketClient(
        vi.fn().mockResolvedValue(jsonResponse(sessionResponse(
          method === "create" ? "teacher" : "team",
          ROOM_CODE,
          snapshot
        ))),
        { sessionStore: store, fingerprint: async () => "a".repeat(64) }
      );

      const pending = method === "create"
        ? client.createRoom(10_000, "teacher-key", 15)
        : client.joinRoom(ROOM_CODE, "Pixel Pirates");
      await expect(pending).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
      expect(store.readActive()).toBeNull();
    }
  });

  it("rejects resume snapshots containing the captured bearer or sensitive field names", async () => {
    for (const snapshot of [
      { nested: [{ echo: TOKEN }] },
      { nested: { authorization: "redacted" } },
      { nested: { cookieJar: "redacted" } },
      { nested: { sessionToken: "redacted" } }
    ]) {
      const store = makeStore(undefined, true);
      const client = new MarketClient(vi.fn().mockResolvedValue(jsonResponse({
        role: "teacher", roomCode: ROOM_CODE, snapshot
      })), { sessionStore: store });

      await expect(client.resumeSession()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
      expect(store.readActive()).toMatchObject({ token: TOKEN });
    }
  });

  it("rejects protected responses that echo either captured bearer form under innocent keys", async () => {
    for (const echoed of [TOKEN, `Bearer ${TOKEN}`]) {
      const client = new MarketClient(vi.fn().mockResolvedValue(jsonResponse({
        revision: 1,
        nested: { echo: echoed }
      })), { sessionStore: makeStore(undefined, true) });

      await expect(client.getSnapshot()).rejects.toMatchObject({
        code: "INVALID_RESPONSE",
        status: 200
      });
    }
  });

  it("rejects an ABA resume success even when the active bearer returns to the same value", async () => {
    const store = makeStore(undefined, true);
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    const client = new MarketClient(fetcher, { sessionStore: store });

    const pending = client.resumeSession();
    await vi.waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(1); });
    store.activate({
      scheme: "Bearer", token: "different.signature", role: "teacher",
      roomCode: ROOM_CODE, expiresAt: EXPIRES_AT
    });
    store.activate({
      scheme: "Bearer", token: TOKEN, role: "teacher",
      roomCode: ROOM_CODE, expiresAt: EXPIRES_AT
    });
    resolveFetch?.(jsonResponse({
      role: "teacher", roomCode: ROOM_CODE, snapshot: { phase: "market" }
    }));

    await expect(pending).rejects.toMatchObject({ code: "STALE_OPERATION" });
  });

  it("does not clear a newer ABA session for an older terminal resume result", async () => {
    const store = makeStore(undefined, true);
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    const client = new MarketClient(fetcher, { sessionStore: store });

    const pending = client.resumeSession();
    await vi.waitFor(() => { expect(fetcher).toHaveBeenCalledTimes(1); });
    store.activate({
      scheme: "Bearer", token: "different.signature", role: "teacher",
      roomCode: ROOM_CODE, expiresAt: EXPIRES_AT
    });
    store.activate({
      scheme: "Bearer", token: TOKEN, role: "teacher",
      roomCode: ROOM_CODE, expiresAt: EXPIRES_AT
    });
    const currentGeneration = store.readActiveIdentity()?.generation;
    resolveFetch?.(jsonResponse({ error: "SESSION_EXPIRED" }, 401));

    await expect(pending).resolves.toBeNull();
    expect(store.readActive()).toMatchObject({ token: TOKEN });
    expect(store.readActiveIdentity()?.generation).toBe(currentGeneration);
  });

  it("exports a bounded JSON validator for the public serialization boundary", () => {
    expect(isMarketSafeJson({ campaigns: [{ title: "Orbit", price: 500 }] })).toBe(true);
    expect(isMarketSafeJson({ nested: { value: TOKEN } }, [TOKEN])).toBe(false);
    expect(isMarketSafeJson({ nested: { token: "redacted" } })).toBe(false);
    expect(isMarketSafeJson({ nested: { authorization: "redacted" } })).toBe(false);
    expect(isMarketSafeJson({ nested: { cookie: "redacted" } })).toBe(false);
    expect(isMarketSafeJson({ nested: { session: "redacted" } })).toBe(false);

    let tooDeep: unknown = "leaf";
    for (let depth = 0; depth < 40; depth += 1) tooDeep = [tooDeep];
    expect(isMarketSafeJson(tooDeep)).toBe(false);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(isMarketSafeJson(cyclic)).toBe(false);
  });

  it("rejects every protected JSON and artwork operation locally without an active session", async () => {
    const fetcher = vi.fn();
    const client = new MarketClient(fetcher, { sessionStore: makeStore() });
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const protectedCalls = [
      () => client.getSnapshot(),
      () => client.uploadArtwork(png),
      () => client.getArtwork("safe-key"),
      () => client.publishCampaign(
        { productName: "Bottle", priceCents: 500, artworkKey: "safe-key" },
        COMMAND_PUBLISH
      ),
      () => client.purchase("campaign-1", "request-1"),
      () => client.award("campaign-1", "gold", COMMAND_AWARD),
      () => client.finish(COMMAND_FINISH),
      () => client.reviewCampaign("campaign-1", 4, "approved", COMMAND_REVIEW),
      () => client.control({ action: "openMarket" }, COMMAND_CONTROL)
    ];

    for (const call of protectedCalls) {
      await expect(call()).rejects.toMatchObject({ code: "AUTH_REQUIRED" });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("resumes only an active matching session and returns a strict safe envelope", async () => {
    const noSessionFetcher = vi.fn();
    const noSession = new MarketClient(noSessionFetcher, { sessionStore: makeStore() });
    await expect(noSession.resumeSession()).resolves.toBeNull();
    expect(noSessionFetcher).not.toHaveBeenCalled();

    const store = makeStore(undefined, true);
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      role: "teacher", roomCode: ROOM_CODE, snapshot: { phase: "market" }
    }));
    const client = new MarketClient(fetcher, { sessionStore: store });

    await expect(client.resumeSession()).resolves.toEqual({
      role: "teacher", roomCode: ROOM_CODE, snapshot: { phase: "market" }
    });
    expect(fetchCall(fetcher)).toEqual(["/api/market/resume", expect.objectContaining({
      method: "GET", credentials: "same-origin", redirect: "error"
    })]);
    expect(new Headers(fetchCall(fetcher)[1].headers).get("authorization")).toBe(`Bearer ${TOKEN}`);

    const mismatched = new MarketClient(vi.fn().mockResolvedValue(jsonResponse({
      role: "team", roomCode: ROOM_CODE, snapshot: { phase: "market" }
    })), { sessionStore: store });
    await expect(mismatched.resumeSession()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    expect(store.readActive()).not.toBeNull();
  });

  it.each([
    ["AUTH_REQUIRED", 401],
    ["INVALID_SESSION", 401],
    ["SESSION_EXPIRED", 401],
    ["ROOM_NOT_FOUND", 404],
    ["ROOM_EXPIRED", 410]
  ])("clears the matching active session and returns null for terminal resume error %s", async (code, status) => {
    const store = makeStore(undefined, true);
    const client = new MarketClient(
      vi.fn().mockResolvedValue(jsonResponse({ error: code }, status)),
      { sessionStore: store }
    );

    await expect(client.resumeSession()).resolves.toBeNull();
    expect(store.readActive()).toBeNull();
  });

  it("retains the active session and throws on a transient resume failure", async () => {
    const store = makeStore(undefined, true);
    const client = new MarketClient(
      vi.fn().mockResolvedValue(jsonResponse({ error: "MARKET_UNAVAILABLE" }, 503)),
      { sessionStore: store }
    );

    await expect(client.resumeSession()).rejects.toMatchObject({
      code: "MARKET_UNAVAILABLE", status: 503
    });
    expect(store.readActive()).toMatchObject({ token: TOKEN, roomCode: ROOM_CODE });
  });

  it("does not clear a newer token for the same room when an older resume ends terminally", async () => {
    let resolveResume!: (response: Response) => void;
    const store = makeStore(undefined, true);
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { resolveResume = resolve; }));
    const client = new MarketClient(fetcher, { sessionStore: store });

    const pending = client.resumeSession();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    store.activate({
      scheme: "Bearer", token: "newer.token", role: "teacher", roomCode: ROOM_CODE,
      expiresAt: EXPIRES_AT
    });
    resolveResume(jsonResponse({ error: "SESSION_EXPIRED" }, 401));

    await expect(pending).resolves.toBeNull();
    expect(store.readActive()).toMatchObject({
      token: "newer.token", role: "teacher", roomCode: ROOM_CODE
    });
  });

  it("rejects a successful stale resume after another session becomes active", async () => {
    let resolveResume!: (response: Response) => void;
    const store = makeStore(undefined, true);
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { resolveResume = resolve; }));
    const client = new MarketClient(fetcher, { sessionStore: store });

    const pending = client.resumeSession();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    store.activate({
      scheme: "Bearer", token: "newer.token", role: "teacher", roomCode: ROOM_CODE,
      expiresAt: EXPIRES_AT
    });
    resolveResume(jsonResponse({
      role: "teacher", roomCode: ROOM_CODE, snapshot: { phase: "market" }
    }));

    await expect(pending).rejects.toMatchObject({ code: "STALE_OPERATION", status: 0 });
    expect(store.readActive()).toMatchObject({ token: "newer.token" });
  });

  it("waits for duplicate-tab readiness before create and resume requests", async () => {
    for (const operation of ["create", "resume"] as const) {
      let release!: () => void;
      const ready = new Promise<void>((resolve) => { release = resolve; });
      const coordinator: MarketTabCoordinationPort = {
        coordinate: () => ready,
        close() {}
      };
      const store = makeStore(undefined, operation === "resume", coordinator);
      const fetcher = vi.fn().mockResolvedValue(operation === "create"
        ? jsonResponse(sessionResponse())
        : jsonResponse({ role: "teacher", roomCode: ROOM_CODE, snapshot: { phase: "market" } }));
      const client = new MarketClient(fetcher, {
        sessionStore: store, fingerprint: async () => "a".repeat(64)
      });

      const pending = operation === "create"
        ? client.createRoom(10_000, "teacher-key", 15)
        : client.resumeSession();
      await Promise.resolve();
      expect(fetcher).not.toHaveBeenCalled();
      release();
      await expect(pending).resolves.toBeTruthy();
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it("rotates and clears a cloned bearer before resume can issue a request", async () => {
    const coordinator: MarketTabCoordinationPort = {
      coordinate(_clientId, rotate) {
        rotate();
        return Promise.resolve();
      },
      close() {}
    };
    const store = makeStore([UUID_1, UUID_2], true, coordinator);
    const fetcher = vi.fn();
    const client = new MarketClient(fetcher, { sessionStore: store });

    await expect(client.resumeSession()).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    expect(store.getClientId()).toBe(UUID_2);
    expect(store.readActive()).toBeNull();
    expect(store.readIntent()).toBeNull();
  });

  it("fails explicitly without issuing a request when tab coordination is unavailable", async () => {
    const coordinator: MarketTabCoordinationPort = {
      coordinate: () => Promise.reject(
        new MarketTabCoordinationError("TAB_COORDINATION_UNAVAILABLE")
      ),
      close() {}
    };
    const fetcher = vi.fn();
    const client = new MarketClient(fetcher, {
      sessionStore: makeStore(undefined, true, coordinator)
    });

    await expect(client.resumeSession()).rejects.toMatchObject({
      code: "TAB_COORDINATION_UNAVAILABLE", status: 0
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
