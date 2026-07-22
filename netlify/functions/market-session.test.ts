// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  MARKET_COOKIE,
  deriveMarketRoomCode,
  deriveMarketSessionIntentKey,
  readMarketSessionToken,
  type MarketEnvironment
} from "./lib/market-auth";
import { createMarketRoom } from "./lib/market-state";
import {
  MarketRoomService,
  type MarketRoomEnvelope,
  type MarketRoomRepository
} from "./lib/netlify-market-room";
import { createMarketSessionHandler } from "./market-session.mjs";

class MemoryRepository implements MarketRoomRepository {
  readonly rooms = new Map<string, { value: MarketRoomEnvelope; etag: number }>();
  readonly artwork = new Map<string, Uint8Array>();
  readCount = 0;

  async read(roomCode: string) {
    this.readCount += 1;
    const entry = this.rooms.get(roomCode);
    return entry
      ? { value: structuredClone(entry.value), etag: String(entry.etag) }
      : null;
  }

  async create(roomCode: string, value: MarketRoomEnvelope): Promise<boolean> {
    if (this.rooms.has(roomCode)) return false;
    this.rooms.set(roomCode, { value: structuredClone(value), etag: 1 });
    return true;
  }

  async compareAndSwap(roomCode: string, value: MarketRoomEnvelope, etag: string): Promise<boolean> {
    const entry = this.rooms.get(roomCode);
    if (!entry || String(entry.etag) !== etag) return false;
    this.rooms.set(roomCode, { value: structuredClone(value), etag: entry.etag + 1 });
    return true;
  }

  async putArtwork(key: string, bytes: Uint8Array): Promise<boolean> {
    if (this.artwork.has(key)) return false;
    this.artwork.set(key, bytes.slice());
    return true;
  }

  async getArtwork(key: string): Promise<Uint8Array | null> {
    return this.artwork.get(key)?.slice() ?? null;
  }
}

const enabledEnvironment: MarketEnvironment = {
  enabled: true,
  classroomCode: "CLASS-2026",
  signingSecret: "s".repeat(32)
};

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const CREATE_OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const ORDINARY_JOIN_OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const JOIN_OPERATION_ID = "4254008b-4455-8677-8899-aabbccddeeff";
const SECOND_JOIN_OPERATION_ID = "4254008b-4455-8677-8899-aabbccddee00";

const request = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://example.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body)
  });

const read = async (response: Response): Promise<Record<string, unknown>> =>
  response.json() as Promise<Record<string, unknown>>;

const cookieToken = (response: Response): string => {
  const match = new RegExp(`^${MARKET_COOKIE}=([^;]+)`).exec(
    response.headers.get("set-cookie") ?? ""
  );
  if (!match?.[1]) throw new Error("Expected a market session cookie");
  return match[1];
};

function fixture(options: {
  environment?: MarketEnvironment;
  roomCodes?: readonly string[];
  ids?: readonly string[];
  nowSeconds?: () => number;
} = {}) {
  const repository = new MemoryRepository();
  const service = new MarketRoomService(repository);
  const roomCodes = [...(options.roomCodes ?? ["ABC-234"])];
  const ids = [...(options.ids ?? ["room-server", "team-server"] )];
  const handler = createMarketSessionHandler({
    environment: options.environment ?? enabledEnvironment,
    nowSeconds: options.nowSeconds ?? (() => 1_000),
    secureCookies: true,
    roomCode: () => roomCodes.shift() ?? "XYZ-567",
    newId: () => ids.shift() ?? "server-id",
    service
  });
  return { handler, repository, service };
}

describe("POST /api/market/create", () => {
  it("creates a bounded room, signs a teacher cookie, and returns no secret", async () => {
    const { handler, repository } = fixture();
    const response = await handler(request("/api/market/create", {
      classroomCode: "CLASS-2026",
      openingWalletCents: 12_500,
      maxTeams: 3
    }));
    const body = await read(response);

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toMatch(
      new RegExp(`^${MARKET_COOKIE}=.+; Path=/api/market; HttpOnly; SameSite=Strict; Max-Age=21600; Secure$`)
    );
    expect(body).toMatchObject({
      role: "teacher",
      roomCode: "ABC-234",
      snapshot: {
        roomCode: "ABC-234",
        revision: 0,
        phase: "building",
        marketMode: "medals",
        maxTeams: 3,
        availableSeats: 3,
        teams: [],
        campaigns: []
      }
    });
    expect(body).not.toHaveProperty("snapshot.openingWalletCents");
    expect(JSON.stringify(body)).not.toContain("CLASS-2026");
    expect(JSON.stringify(body)).not.toContain("ssssssss");
    expect(repository.rooms.get("ABC-234")?.value.expiresAt).toBe(22_600);
    const session = body.session as Record<string, unknown>;
    expect(session).toMatchObject({ scheme: "Bearer", expiresAt: 22_600 });
    expect(readMarketSessionToken(String(session.token), enabledEnvironment.signingSecret, 1_000))
      .toMatchObject({ role: "teacher", roomCode: "ABC-234" });
    expect(readMarketSessionToken(cookieToken(response), enabledEnvironment.signingSecret, 1_000))
      .toMatchObject({ role: "teacher", roomCode: "ABC-234" });
  });

  it("defaults to 10000 cents and retries a generated room-code collision", async () => {
    const setup = fixture({ roomCodes: ["ABC-234", "DEF-567"], ids: ["room-1", "room-2"] });
    const first = await setup.handler(request("/api/market/create", {
      classroomCode: "CLASS-2026"
    }));
    const second = await setup.handler(request("/api/market/create", {
      classroomCode: "CLASS-2026"
    }));

    expect((await read(first)).roomCode).toBe("ABC-234");
    expect((await read(second)).roomCode).toBe("DEF-567");
    expect(setup.repository.rooms.get("ABC-234")?.value.state.openingWallet).toBe(10_000);
    expect(setup.repository.rooms.get("ABC-234")?.value.state.maxTeams).toBe(15);
  });

  it("replays a deterministic create after a lost response with its original expiry and revision", async () => {
    let now = 1_000;
    const setup = fixture({
      ids: ["room-first", "room-unused"],
      nowSeconds: () => now
    });
    const body = {
      classroomCode: "CLASS-2026",
      clientId: CLIENT_ID,
      operationId: CREATE_OPERATION_ID,
      openingWalletCents: 12_500,
      maxTeams: 3
    };
    const first = await setup.handler(request("/api/market/create", body));
    const firstBody = await read(first);
    const roomCode = String(firstBody.roomCode);
    const stored = setup.repository.rooms.get(roomCode)!;

    now = 1_100;
    const replay = await setup.handler(request("/api/market/create", body));
    const replayBody = await read(replay);

    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replayBody).toMatchObject({
      roomCode,
      snapshot: { roomId: "room-first", revision: 0 }
    });
    expect((replayBody.session as Record<string, unknown>).expiresAt).toBe(22_600);
    expect(replay.headers.get("set-cookie")).toContain("Max-Age=21500");
    expect(setup.repository.rooms.size).toBe(1);
    expect(setup.repository.rooms.get(roomCode)).toEqual(stored);
  });

  it("rejects a deterministic create intent reused with a different semantic payload", async () => {
    const setup = fixture();
    const intent = { clientId: CLIENT_ID, operationId: CREATE_OPERATION_ID };
    await setup.handler(request("/api/market/create", {
      classroomCode: "CLASS-2026",
      openingWalletCents: 10_000,
      ...intent
    }));
    const conflict = await setup.handler(request("/api/market/create", {
      classroomCode: "CLASS-2026",
      openingWalletCents: 12_500,
      ...intent
    }));

    expect(conflict.status).toBe(409);
    expect(await read(conflict)).toEqual({ error: "IDEMPOTENCY_CONFLICT" });
  });

  it("tries exactly eight deterministic room candidates before failing unrelated collisions", async () => {
    const setup = fixture();
    const intentKey = deriveMarketSessionIntentKey(
      "create",
      CLIENT_ID,
      CREATE_OPERATION_ID
    );
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = deriveMarketRoomCode(
        enabledEnvironment.signingSecret,
        intentKey,
        attempt
      );
      const state = createMarketRoom({
        roomId: `collision-${attempt}`,
        openingWallet: 10_000,
        now: 900
      });
      await setup.service.create(code, {
        ...state,
        sessionBindings: {
          ...state.sessionBindings,
          createdBy: { intentKey: "f".repeat(64), payloadHash: "e".repeat(64) }
        }
      }, 22_600);
    }

    const response = await setup.handler(request("/api/market/create", {
      classroomCode: "CLASS-2026",
      clientId: CLIENT_ID,
      operationId: CREATE_OPERATION_ID
    }));

    expect(response.status).toBe(503);
    expect(await read(response)).toEqual({ error: "ROOM_CODE_UNAVAILABLE" });
    expect(setup.repository.rooms.size).toBe(8);
  });

  it("fails closed for missing configuration, wrong code, extra fields or wallet bounds", async () => {
    const disabled = fixture({ environment: { enabled: false } }).handler;
    expect((await disabled(request("/api/market/create", {
      classroomCode: "CLASS-2026"
    }))).status).toBe(503);

    const { handler } = fixture();
    expect((await handler(request("/api/market/create", {
      classroomCode: "WRONG-CODE"
    }))).status).toBe(401);
    expect((await handler(request("/api/market/create", {
      classroomCode: "CLASS-2026",
      openingWalletCents: 99
    }))).status).toBe(400);
    expect((await handler(request("/api/market/create", {
      classroomCode: "CLASS-2026",
      maxTeams: 31
    }))).status).toBe(400);
    expect((await handler(request("/api/market/create", {
      classroomCode: "CLASS-2026",
      openingWalletCents: 10_000,
      teacherName: "Peter"
    }))).status).toBe(400);
    expect((await handler(request("/api/market/create", {
      classroomCode: "CLASS-2026",
      clientId: CLIENT_ID
    }))).status).toBe(400);
    expect((await handler(request("/api/market/create", {
      classroomCode: "CLASS-2026",
      clientId: "not-a-uuid",
      operationId: CREATE_OPERATION_ID
    }))).status).toBe(400);
  });
});

describe("POST /api/market/join", () => {
  it("joins with an alias-only team identity and returns the private team snapshot", async () => {
    const setup = fixture();
    await setup.handler(request("/api/market/create", { classroomCode: "CLASS-2026" }));
    const response = await setup.handler(request("/api/market/join", {
      roomCode: "ABC-234",
      alias: "  Pixel   Pirates  "
    }));
    const body = await read(response);

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      role: "team",
      roomCode: "ABC-234",
      snapshot: {
        roomId: "room-server",
        revision: 1,
        phase: "building",
        marketMode: "medals",
        own: {
          teamId: "team-server",
          alias: "Pixel Pirates",
          finished: false
        },
        myAwards: []
      }
    });
    expect(body).not.toHaveProperty("snapshot.own.wallet");
    expect(body).not.toHaveProperty("snapshot.own.spent");
    expect(body).not.toHaveProperty("teamName");
    expect(body).not.toHaveProperty("email");
    expect(response.headers.get("set-cookie")).toContain(`${MARKET_COOKIE}=`);
    const session = body.session as Record<string, unknown>;
    expect(session).toMatchObject({ scheme: "Bearer", expiresAt: 22_600 });
    expect(readMarketSessionToken(String(session.token), enabledEnvironment.signingSecret, 1_000))
      .toMatchObject({ role: "team", roomCode: "ABC-234", teamId: "team-server" });
    expect(readMarketSessionToken(cookieToken(response), enabledEnvironment.signingSecret, 1_000))
      .toMatchObject({ role: "team", roomCode: "ABC-234", teamId: "team-server" });
  });

  it("accepts a UUIDv8 join operation scoped to the requested room", async () => {
    const setup = fixture();
    await setup.handler(request("/api/market/create", { classroomCode: "CLASS-2026" }));

    const response = await setup.handler(request("/api/market/join", {
      roomCode: "ABC-234",
      alias: "Pixel Pirates",
      clientId: CLIENT_ID,
      operationId: JOIN_OPERATION_ID
    }));

    expect(response.status).toBe(201);
    expect(setup.repository.rooms.get("ABC-234")?.value.state).toMatchObject({
      revision: 1,
      teams: { "team-server": { alias: "Pixel Pirates" } }
    });
  });

  it("rejects an ordinary UUID operation before reading or mutating a join room", async () => {
    const setup = fixture();
    await setup.handler(request("/api/market/create", { classroomCode: "CLASS-2026" }));
    const before = structuredClone(setup.repository.rooms.get("ABC-234"));

    const response = await setup.handler(request("/api/market/join", {
      roomCode: "ABC-234",
      alias: "Pixel Pirates",
      clientId: CLIENT_ID,
      operationId: ORDINARY_JOIN_OPERATION_ID
    }));

    expect(response.status).toBe(409);
    expect(await read(response)).toEqual({ error: "IDEMPOTENCY_CONFLICT" });
    expect(setup.repository.readCount).toBe(0);
    expect(setup.repository.rooms.get("ABC-234")).toEqual(before);
  });

  it("rejects cross-room reuse of an exact join pair without touching either room", async () => {
    const setup = fixture({
      roomCodes: ["ABC-234", "DEF-567"],
      ids: ["room-a", "room-b", "team-a", "unused-team"]
    });
    await setup.handler(request("/api/market/create", { classroomCode: "CLASS-2026" }));
    await setup.handler(request("/api/market/create", { classroomCode: "CLASS-2026" }));
    const pair = { clientId: CLIENT_ID, operationId: JOIN_OPERATION_ID };
    expect((await setup.handler(request("/api/market/join", {
      roomCode: "ABC-234",
      alias: "Pixel Pirates",
      ...pair
    }))).status).toBe(201);
    const roomABefore = structuredClone(setup.repository.rooms.get("ABC-234"));
    const roomBBefore = structuredClone(setup.repository.rooms.get("DEF-567"));
    const readsBefore = setup.repository.readCount;

    const conflict = await setup.handler(request("/api/market/join", {
      roomCode: "DEF-567",
      alias: "Bright Bunch",
      ...pair
    }));

    expect(conflict.status).toBe(409);
    expect(await read(conflict)).toEqual({ error: "IDEMPOTENCY_CONFLICT" });
    expect(setup.repository.readCount).toBe(readsBefore);
    expect(setup.repository.rooms.get("ABC-234")).toEqual(roomABefore);
    expect(setup.repository.rooms.get("DEF-567")).toEqual(roomBBefore);
    expect(roomBBefore?.value.state).toMatchObject({
      revision: 0,
      teams: {},
      sessionBindings: { joins: {} }
    });
  });

  it("rejects malformed UUIDv8 input before reading or mutating a join room", async () => {
    const setup = fixture();
    await setup.handler(request("/api/market/create", { classroomCode: "CLASS-2026" }));
    const before = structuredClone(setup.repository.rooms.get("ABC-234"));

    const response = await setup.handler(request("/api/market/join", {
      roomCode: "ABC-234",
      alias: "Pixel Pirates",
      clientId: CLIENT_ID,
      operationId: "4254008b-4455-8677-8899-aabbccddeef"
    }));

    expect(response.status).toBe(400);
    expect(await read(response)).toEqual({ error: "INVALID_REQUEST" });
    expect(setup.repository.readCount).toBe(0);
    expect(setup.repository.rooms.get("ABC-234")).toEqual(before);
  });

  it("replays the bound team without a revision after the room leaves building", async () => {
    const setup = fixture();
    await setup.handler(request("/api/market/create", { classroomCode: "CLASS-2026" }));
    const joinBody = {
      roomCode: "ABC-234",
      alias: "Pixel Pirates",
      clientId: CLIENT_ID,
      operationId: JOIN_OPERATION_ID
    };
    const first = await setup.handler(request("/api/market/join", joinBody));
    const firstBody = await read(first);
    const teamId = String((firstBody.snapshot as { own: { teamId: string } }).own.teamId);
    const stored = setup.repository.rooms.get("ABC-234")!;
    stored.value = {
      ...stored.value,
      state: {
        ...stored.value.state,
        revision: stored.value.state.revision + 1,
        phase: "market",
        updatedAt: 1_010,
        marketCohort: {
          buyerTeamIds: [teamId],
          sellerTeamIds: [],
          campaignIds: []
        }
      }
    };
    stored.etag += 1;
    const revisionBeforeReplay = stored.value.state.revision;
    const etagBeforeReplay = stored.etag;

    const replay = await setup.handler(request("/api/market/join", joinBody));
    const replayBody = await read(replay);

    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replayBody).toMatchObject({
      snapshot: { revision: revisionBeforeReplay, phase: "market", own: { teamId } }
    });
    expect(setup.repository.rooms.get("ABC-234")?.etag).toBe(etagBeforeReplay);
    expect(Object.keys(stored.value.state.teams)).toEqual([teamId]);
  });

  it("rejects a join intent reused with a different canonical payload", async () => {
    const setup = fixture();
    await setup.handler(request("/api/market/create", { classroomCode: "CLASS-2026" }));
    const intent = { clientId: CLIENT_ID, operationId: JOIN_OPERATION_ID };
    await setup.handler(request("/api/market/join", {
      roomCode: "ABC-234",
      alias: "Pixel Pirates",
      ...intent
    }));
    const conflict = await setup.handler(request("/api/market/join", {
      roomCode: "ABC-234",
      alias: "Bright Bunch",
      ...intent
    }));

    expect(conflict.status).toBe(409);
    expect(await read(conflict)).toEqual({ error: "IDEMPOTENCY_CONFLICT" });
  });

  it("uses distinct operations to consume distinct seats", async () => {
    const setup = fixture({ ids: ["room-server", "team-1", "team-2"] });
    await setup.handler(request("/api/market/create", { classroomCode: "CLASS-2026" }));
    const first = await setup.handler(request("/api/market/join", {
      roomCode: "ABC-234",
      alias: "Pixel Pirates",
      clientId: CLIENT_ID,
      operationId: JOIN_OPERATION_ID
    }));
    const second = await setup.handler(request("/api/market/join", {
      roomCode: "ABC-234",
      alias: "Bright Bunch",
      clientId: CLIENT_ID,
      operationId: SECOND_JOIN_OPERATION_ID
    }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(Object.keys(setup.repository.rooms.get("ABC-234")!.value.state.teams).sort())
      .toEqual(["team-1", "team-2"]);
    expect(setup.repository.rooms.get("ABC-234")!.value.state.revision).toBe(2);
  });

  it("maps duplicate aliases, expired rooms and malformed joins safely", async () => {
    const setup = fixture({ ids: ["room-server", "team-1", "team-2"] });
    await setup.handler(request("/api/market/create", { classroomCode: "CLASS-2026" }));
    await setup.handler(request("/api/market/join", {
      roomCode: "ABC-234",
      alias: "Pixel Pirates"
    }));
    const duplicate = await setup.handler(request("/api/market/join", {
      roomCode: "ABC-234",
      alias: "pixel pirates"
    }));
    expect(duplicate.status).toBe(409);
    expect(await read(duplicate)).toEqual({ error: "ALIAS_TAKEN" });

    const stored = setup.repository.rooms.get("ABC-234")!;
    stored.value = { ...stored.value, expiresAt: 1_000 };
    expect((await setup.handler(request("/api/market/join", {
      roomCode: "ABC-234",
      alias: "Bright Bunch"
    }))).status).toBe(410);
    expect((await setup.handler(request("/api/market/join", {
      roomCode: "abc-234",
      alias: "Bright Bunch",
      studentName: "A Student"
    }))).status).toBe(400);
    expect((await setup.handler(request("/api/market/join", {
      roomCode: "ABC-234",
      alias: "Bright Bunch",
      operationId: JOIN_OPERATION_ID
    }))).status).toBe(400);
  });
});

describe("market session initialization boundary", () => {
  it("validates request JSON before service creation and catches service initialization failure", async () => {
    let serviceCalls = 0;
    const handler = createMarketSessionHandler({
      environment: enabledEnvironment,
      nowSeconds: () => 1_000,
      serviceFactory: async () => {
        serviceCalls += 1;
        throw new Error("blob initialization failed");
      }
    });
    const malformed = await handler(new Request("https://example.test/api/market/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    }));
    expect(malformed.status).toBe(400);
    expect(serviceCalls).toBe(0);

    const valid = await handler(request("/api/market/create", {
      classroomCode: "CLASS-2026"
    }));
    expect(valid.status).toBe(503);
    expect(await read(valid)).toEqual({ error: "MARKET_UNAVAILABLE" });
    expect(serviceCalls).toBe(1);
  });
});

describe("market session route guards", () => {
  it("rejects unknown paths, wrong methods and unsupported or oversized JSON", async () => {
    const { handler } = fixture();
    expect((await handler(new Request("https://example.test/api/market/unknown"))).status).toBe(404);
    const wrongMethod = await handler(new Request("https://example.test/api/market/create"));
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("allow")).toBe("POST");

    expect((await handler(new Request("https://example.test/api/market/create", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}"
    }))).status).toBe(415);
    expect((await handler(new Request("https://example.test/api/market/create", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "20000" },
      body: "{}"
    }))).status).toBe(413);
  });
});
