import { describe, expect, it } from "vitest";
import type { PublishedCampaignJson } from "../bridge/contracts";
import { MarketClient, MarketClientError } from "./market-client";
import { MARKET_BRIDGE_CONTRACT, createMarketPublicApi } from "./market-public-api";
import { MarketSessionStore, type StoragePort } from "./market-session-store";

const COMMAND_ID = "55555555-5555-4555-8555-555555555555";

const pngBase64 = (width = 1600, height = 900): string => {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  new DataView(bytes.buffer).setUint32(8, 13);
  bytes.set(new TextEncoder().encode("IHDR"), 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = 6;
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

const publication = (): PublishedCampaignJson => ({
  contract: "published-campaign@1",
  documentId: "classroom-campaign",
  revision: 7,
  pngBase64: pngBase64(),
  metadata: {
    productName: "Orbit Bottle",
    priceCents: 6_000,
    brief: {
      targetAudienceId: "after-school-athletes",
      contextId: "city",
      purpose: "persuade",
      audienceNeeds: [],
      audienceValues: [],
      intendedEffects: [],
      techniques: []
    },
    evidence: { price: [], attention: [], interest: [], desire: [], action: [] },
    assetReferences: []
  }
});

class ClientHarness {
  calls: Array<{ method: string; values: unknown[] }> = [];

  createRoom(...values: unknown[]): Promise<unknown> {
    this.calls.push({ method: "createRoom", values });
    return Promise.resolve({ role: "teacher", roomCode: "ABC-234", snapshot: { phase: "building" } });
  }
  joinRoom(...values: unknown[]): Promise<unknown> {
    this.calls.push({ method: "joinRoom", values });
    return Promise.resolve({ role: "team", roomCode: "ABC-234", snapshot: { phase: "building" } });
  }
  resumeSession(...values: unknown[]): Promise<unknown> {
    this.calls.push({ method: "resumeSession", values });
    return Promise.resolve({ role: "team", roomCode: "ABC-234", snapshot: { phase: "market" } });
  }
  getSnapshot(...values: unknown[]): Promise<unknown> {
    this.calls.push({ method: "getSnapshot", values });
    return Promise.resolve({
      role: "team",
      roomCode: "ABC-234",
      snapshot: { phase: "market" }
    });
  }
  getArtwork(...values: unknown[]): Promise<Uint8Array> {
    this.calls.push({ method: "getArtwork", values });
    return Promise.resolve(Uint8Array.from(
      atob(pngBase64()),
      (character) => character.charCodeAt(0)
    ));
  }
  uploadArtwork(...values: unknown[]): Promise<string> {
    this.calls.push({ method: "uploadArtwork", values });
    return Promise.resolve("rooms/hash/media/team/hash.png");
  }
  publishCampaign(...values: unknown[]): Promise<unknown> {
    return this.call("publishCampaign", values);
  }
  purchase(...values: unknown[]): Promise<unknown> { return this.call("purchase", values); }
  award(...values: unknown[]): Promise<unknown> { return this.call("award", values); }
  finish(...values: unknown[]): Promise<unknown> { return this.call("finish", values); }
  reviewCampaign(...values: unknown[]): Promise<unknown> {
    return this.call("reviewCampaign", values);
  }
  control(...values: unknown[]): Promise<unknown> { return this.call("control", values); }

  private call(method: string, values: unknown[]): Promise<unknown> {
    this.calls.push({ method, values });
    return Promise.resolve({ method, accepted: true });
  }
}

const request = (requestId: string, method: string, payload: unknown): string => JSON.stringify({
  contract: MARKET_BRIDGE_CONTRACT,
  requestId,
  method,
  payload
});

describe("AdMarketRoom public API", () => {
  it("is one frozen JSON method and dispatches the room operations exactly", async () => {
    const client = new ClientHarness();
    const api = createMarketPublicApi(client);
    expect(Object.isFrozen(api)).toBe(true);
    expect(Reflect.ownKeys(api)).toEqual(["handle"]);

    const examples = [
      ["createRoom", { openingWallet: 10_000, classroomCode: "teacher-key", maxTeams: 15 }],
      ["joinRoom", { roomCode: "ABC-234", alias: "Neon Narwhals" }],
      ["resumeSession", null],
      ["getSnapshot", null],
      ["getArtwork", { artworkKey: "rooms/hash/media/team/hash.png" }],
      ["purchase", { campaignId: "campaign-team-2", requestId: "request-1" }],
      ["award", { commandId: COMMAND_ID, campaignId: "campaign-team-3", medal: "gold" }],
      ["finish", { commandId: COMMAND_ID }],
      ["reviewCampaign", {
        commandId: COMMAND_ID,
        campaignId: "campaign-team-1",
        submissionVersion: 3,
        status: "returned",
        reviewNote: "Try another title."
      }],
      ["control", { commandId: COMMAND_ID, action: "openMarket" }],
      ["control", { commandId: COMMAND_ID, action: "removeTeam", teamId: "team-3" }]
    ] as const;
    for (const [method, payload] of examples) {
      const response = JSON.parse(await api.handle(request(`request-${method}`, method, payload))) as unknown;
      expect(response).toMatchObject({
        contract: MARKET_BRIDGE_CONTRACT,
        requestId: `request-${method}`,
        ok: true
      });
    }

    expect(client.calls).toEqual([
      { method: "createRoom", values: [10_000, "teacher-key", 15] },
      { method: "joinRoom", values: ["ABC-234", "Neon Narwhals"] },
      { method: "resumeSession", values: [] },
      { method: "getSnapshot", values: [] },
      { method: "getArtwork", values: ["rooms/hash/media/team/hash.png"] },
      { method: "purchase", values: ["campaign-team-2", "request-1"] },
      { method: "award", values: ["campaign-team-3", "gold", COMMAND_ID] },
      { method: "finish", values: [COMMAND_ID] },
      {
        method: "reviewCampaign",
        values: ["campaign-team-1", 3, "returned", COMMAND_ID, "Try another title."]
      },
      { method: "control", values: [{ action: "openMarket" }, COMMAND_ID] },
      { method: "control", values: [{ action: "removeTeam", teamId: "team-3" }, COMMAND_ID] }
    ]);
  });

  it("unwraps the server snapshot envelope for Godot polling", async () => {
    const client = new ClientHarness();
    const response = JSON.parse(await createMarketPublicApi(client).handle(
      request("snapshot-1", "getSnapshot", null)
    ));

    expect(response).toEqual({
      contract: MARKET_BRIDGE_CONTRACT,
      requestId: "snapshot-1",
      ok: true,
      payload: { phase: "market" }
    });
  });

  it("returns only the safe room envelope for create, join and resume", async () => {
    const client = new ClientHarness();
    const api = createMarketPublicApi(client);

    for (const [requestId, method, payload] of [
      ["safe-create", "createRoom", {
        openingWallet: 10_000, classroomCode: "teacher-key", maxTeams: 15
      }],
      ["safe-join", "joinRoom", { roomCode: "ABC-234", alias: "Neon Narwhals" }],
      ["safe-resume", "resumeSession", null]
    ] as const) {
      const raw = await api.handle(request(requestId, method, payload));
      expect(JSON.parse(raw)).toMatchObject({
        ok: true,
        payload: { roomCode: "ABC-234", snapshot: expect.any(Object) }
      });
      expect(raw).not.toMatch(/token|authorization|session/i);
    }

    client.createRoom = () => Promise.resolve({
      role: "teacher",
      roomCode: "ABC-234",
      snapshot: { phase: "building" },
      session: { scheme: "Bearer", token: "payload.signature", expiresAt: 2_000_000_000 }
    });
    const refused = await api.handle(request("unsafe-create", "createRoom", {
      openingWallet: 10_000, classroomCode: "teacher-key", maxTeams: 15
    }));
    expect(JSON.parse(refused)).toMatchObject({
      ok: false,
      error: {
        code: "CONNECTION_UNAVAILABLE",
        message: "The market could not be reached. Check the network and try again."
      }
    });
    expect(refused).not.toContain("payload.signature");

    client.resumeSession = () => Promise.resolve({
      role: "team",
      roomCode: "ABC-234",
      snapshot: {
        phase: "market",
        nested: { token: "stolen.payload" }
      }
    });
    const nestedRefusal = await api.handle(request("unsafe-resume", "resumeSession", null));
    expect(JSON.parse(nestedRefusal)).toMatchObject({
      ok: false,
      error: {
        code: "CONNECTION_UNAVAILABLE",
        message: "The market could not be reached. Check the network and try again."
      }
    });
    expect(nestedRefusal).not.toContain("stolen.payload");
  });

  it("turns a published campaign into one PNG upload and one server-owned campaign submission", async () => {
    const client = new ClientHarness();
    const api = createMarketPublicApi(client);

    const raw = await api.handle(request("publish-1", "publishCampaign", {
      commandId: COMMAND_ID,
      publication: publication()
    }));
    const response = JSON.parse(raw) as Record<string, unknown>;

    expect(response).toMatchObject({
      contract: MARKET_BRIDGE_CONTRACT,
      requestId: "publish-1",
      ok: true,
      payload: { method: "publishCampaign", accepted: true }
    });
    expect(client.calls).toHaveLength(2);
    const uploaded = client.calls[0];
    expect(uploaded?.method).toBe("uploadArtwork");
    expect(uploaded?.values[0]).toBeInstanceOf(Uint8Array);
    expect((uploaded?.values[0] as Uint8Array).slice(0, 8)).toEqual(
      Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
    expect(client.calls[1]).toEqual({
      method: "publishCampaign",
      values: [{
        productName: "Orbit Bottle",
        priceCents: 6_000,
        artworkKey: "rooms/hash/media/team/hash.png"
      }, COMMAND_ID]
    });
    expect(raw).not.toContain("pngBase64");
  });

  it("rejects malformed requests and campaign images before any room mutation", async () => {
    const client = new ClientHarness();
    const api = createMarketPublicApi(client);
    const wrongDimensions = publication();
    wrongDimensions.pngBase64 = pngBase64(1599, 900);
    const malformed = [
      "{",
      JSON.stringify({ contract: "market-bridge@999", requestId: "bad", method: "finish", payload: null }),
      request("bad-method", "launch", null),
      request("bad-join", "joinRoom", { roomCode: "", alias: "x" }),
      request("bad-room-shape", "joinRoom", { roomCode: "ABC234", alias: "Neon Narwhals" }),
      request("bad-wallet", "createRoom", { openingWallet: 99, classroomCode: "teacher-key" }),
      request("bad-seats", "createRoom", { openingWallet: 10_000, classroomCode: "teacher-key", maxTeams: 2 }),
      request("bad-removal", "control", { action: "removeTeam" }),
      request("bad-command", "finish", { commandId: "not-a-uuid" }),
      request("bad-medal", "award", { commandId: COMMAND_ID, campaignId: "campaign-2", medal: "platinum" }),
      request("missing-command", "finish", null),
      request("missing-version", "reviewCampaign", {
        commandId: COMMAND_ID,
        campaignId: "campaign-team-1",
        status: "approved"
      }),
      request("bad-png", "publishCampaign", { commandId: COMMAND_ID, publication: wrongDimensions })
    ];

    for (const value of malformed) {
      const response = JSON.parse(await api.handle(value)) as Record<string, unknown>;
      expect(response.ok).toBe(false);
      expect(response).toHaveProperty("error.code");
      expect(response).not.toHaveProperty("payload");
    }
    expect(client.calls).toEqual([]);
  });

  it("uses the bounded student error contract without exposing bridge validation details", async () => {
    const api = createMarketPublicApi(new ClientHarness());

    const invalidRoom = JSON.parse(await api.handle(
      request("bad-room", "joinRoom", { roomCode: "ABC234", alias: "Neon Narwhals" })
    ));
    expect(invalidRoom).toEqual({
      contract: MARKET_BRIDGE_CONTRACT,
      requestId: "bad-room",
      ok: false,
      error: {
        code: "INVALID_ROOM_CODE",
        message: "Enter the room code in the format ABC-234."
      }
    });

    const invalidBridge = await api.handle("{");
    expect(JSON.parse(invalidBridge)).toEqual({
      contract: MARKET_BRIDGE_CONTRACT,
      requestId: "",
      ok: false,
      error: {
        code: "CONNECTION_UNAVAILABLE",
        message: "The market could not be reached. Check the network and try again."
      }
    });
    expect(invalidBridge).not.toMatch(/INVALID_REQUEST|valid JSON|Zod/i);
  });

  it("maps client failures once and never exposes raw server codes, bodies or messages", async () => {
    const failing = new ClientHarness();
    failing.getSnapshot = () => Promise.reject(Object.assign(new Error("OWN_CAMPAIGN"), {
      code: "OWN_CAMPAIGN",
      status: 409
    }));
    const failed = JSON.parse(await createMarketPublicApi(failing).handle(
      request("failure", "getSnapshot", null)
    ));
    expect(failed).toEqual({
      contract: MARKET_BRIDGE_CONTRACT,
      requestId: "failure",
      ok: false,
      error: {
        code: "ROOM_UNAVAILABLE",
        message: "That room is not available. Ask your teacher what to do next."
      }
    });
    expect(JSON.stringify(failed)).not.toMatch(/OWN_CAMPAIGN|409/);

    const unsafe = new ClientHarness();
    unsafe.getSnapshot = () => Promise.resolve({ bytes: new Uint8Array([1, 2, 3]) });
    const refused = JSON.parse(await createMarketPublicApi(unsafe).handle(
      request("unsafe", "getSnapshot", null)
    ));
    expect(refused).toMatchObject({
      ok: false,
      error: { code: "CONNECTION_UNAVAILABLE" }
    });
    expect(refused).not.toHaveProperty("payload");
  });

  it.each([
    ["ROOM_NOT_FOUND", 404, "ROOM_NOT_FOUND"],
    ["ROOM_EXPIRED", 410, "ROOM_UNAVAILABLE"],
    ["REQUEST_TIMEOUT", 0, "CONNECTION_TIMEOUT"],
    ["RATE_LIMITED", 429, "RATE_LIMITED"],
    ["SESSION_EXPIRED", 401, "SESSION_EXPIRED"],
    ["INVALID_RESPONSE", 200, "CONNECTION_UNAVAILABLE"]
  ] as const)(
    "maps internal %s at status %i to student error %s",
    async (internalCode, status, publicCode) => {
      const failing = new ClientHarness();
      failing.getSnapshot = () => Promise.reject(new MarketClientError(
        internalCode,
        status,
        internalCode === "RATE_LIMITED" ? 17 : undefined
      ));

      const raw = await createMarketPublicApi(failing).handle(
        request(`failure-${internalCode}`, "getSnapshot", null)
      );
      const response = JSON.parse(raw);

      expect(response.error.code).toBe(publicCode);
      expect(response.error.message).not.toContain(internalCode);
      if (internalCode === "RATE_LIMITED") {
        expect(response.error.retryAfterSeconds).toBe(17);
      } else {
        expect(response.error).not.toHaveProperty("retryAfterSeconds");
      }
      expect(raw).not.toMatch(/stack|body|status/i);
    }
  );

  it("keeps an echoed bearer out of the end-to-end Godot polling envelope", async () => {
    const token = "payload.signature";
    const values = new Map<string, string>();
    const storage: StoragePort = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: (key) => { values.delete(key); }
    };
    const coordinator = { coordinate: () => Promise.resolve(), close() {} };
    const store = new MarketSessionStore({
      storage,
      coordinator,
      nowSeconds: () => 1_000,
      randomUUID: () => "11111111-1111-4111-8111-111111111111"
    });
    store.activate({
      scheme: "Bearer",
      token,
      role: "team",
      roomCode: "ABC-234",
      expiresAt: 2_000
    });
    const client = new MarketClient(
      () => Promise.resolve(Response.json({ revision: 1, nested: { echo: token } })),
      { sessionStore: store }
    );

    const raw = await createMarketPublicApi(client).handle(
      request("secret-poll", "getSnapshot", null)
    );

    expect(JSON.parse(raw)).toMatchObject({
      ok: false,
      error: { code: "CONNECTION_UNAVAILABLE" }
    });
    expect(raw).not.toContain(token);
  });
});
