// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { MarketEnvironment } from "./lib/market-auth";
import {
  MarketRoomService,
  type MarketRoomEnvelope,
  type MarketRoomRepository
} from "./lib/netlify-market-room";
import { marketPngFixture as png } from "./test-support/market-png-fixture";
import { createMarketRoomHandler } from "./market-room.mjs";
import { createMarketSessionHandler } from "./market-session.mjs";

class MemoryRepository implements MarketRoomRepository {
  readonly rooms = new Map<string, { value: MarketRoomEnvelope; etag: number }>();
  readonly artwork = new Map<string, Uint8Array>();
  failArtworkWrites = false;
  artworkWriteAttempts = 0;
  casAttempts = 0;
  yieldBeforeCas = false;

  async read(roomCode: string) {
    const entry = this.rooms.get(roomCode);
    return entry ? { value: structuredClone(entry.value), etag: String(entry.etag) } : null;
  }

  async create(roomCode: string, value: MarketRoomEnvelope): Promise<boolean> {
    if (this.rooms.has(roomCode)) return false;
    this.rooms.set(roomCode, { value: structuredClone(value), etag: 1 });
    return true;
  }

  async compareAndSwap(roomCode: string, value: MarketRoomEnvelope, etag: string): Promise<boolean> {
    this.casAttempts += 1;
    if (this.yieldBeforeCas) await Promise.resolve();
    const entry = this.rooms.get(roomCode);
    if (!entry || String(entry.etag) !== etag) return false;
    this.rooms.set(roomCode, { value: structuredClone(value), etag: entry.etag + 1 });
    return true;
  }

  async putArtwork(key: string, bytes: Uint8Array): Promise<boolean> {
    this.artworkWriteAttempts += 1;
    if (this.failArtworkWrites) throw new Error("artwork store unavailable");
    if (this.artwork.has(key)) return false;
    this.artwork.set(key, bytes.slice());
    return true;
  }

  async getArtwork(key: string): Promise<Uint8Array | null> {
    return this.artwork.get(key)?.slice() ?? null;
  }
}

const environment: MarketEnvironment = {
  enabled: true,
  classroomCode: "CLASS-2026",
  signingSecret: "s".repeat(32)
};

const cookieFrom = (response: Response): string => response.headers.get("set-cookie")!.split(";", 1)[0]!;
const tokenFromCookie = (cookie: string): string => cookie.slice(cookie.indexOf("=") + 1);
const json = async (response: Response): Promise<Record<string, any>> => response.json();

const jsonRequest = (
  path: string,
  method: "POST" | "GET",
  cookie?: string,
  body?: unknown
): Request => new Request(`https://example.test${path}`, {
  method,
  headers: {
    origin: "https://example.test",
    "sec-fetch-site": "same-origin",
    ...(cookie ? { cookie } : {}),
    ...(body === undefined ? {} : { "content-type": "application/json" })
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
});

function fixture(now = 1_000) {
  const repository = new MemoryRepository();
  const service = new MarketRoomService(repository);
  const sessionIds = ["room-server", "team-1", "team-2", "team-3"];
  let receipt = 0;
  const session = createMarketSessionHandler({
    environment,
    nowSeconds: () => now,
    secureCookies: true,
    roomCode: () => "ABC-234",
    newId: () => sessionIds.shift() ?? "team-extra",
    service
  });
  const room = createMarketRoomHandler({
    environment,
    nowSeconds: () => now,
    newId: () => `receipt-${++receipt}`,
    service
  });
  return { repository, service, session, room };
}

async function createAndJoin(setup: ReturnType<typeof fixture>) {
  const created = await setup.session(jsonRequest("/api/market/create", "POST", undefined, {
    classroomCode: "CLASS-2026",
    openingWalletCents: 10_000
  }));
  const teacher = cookieFrom(created);
  const teams: Array<{ cookie: string; id: string; alias: string }> = [];
  for (const alias of ["Pixel Pirates", "Bright Bunch", "Idea Owls"]) {
    const joined = await setup.session(jsonRequest("/api/market/join", "POST", undefined, {
      roomCode: "ABC-234",
      alias
    }));
    const body = await json(joined);
    teams.push({ cookie: cookieFrom(joined), id: body.snapshot.own.teamId, alias });
  }
  return { teacher, teams };
}

const defaultPng = png();

async function upload(
  handler: ReturnType<typeof createMarketRoomHandler>,
  cookie: string,
  bytes = defaultPng
) {
  const response = await handler(new Request("https://example.test/api/market/artwork", {
    method: "PUT",
    headers: {
      cookie,
      "content-type": "image/png",
      origin: "https://example.test",
      "sec-fetch-site": "same-origin"
    },
    body: Uint8Array.from(bytes).buffer
  }));
  return { response, body: await json(response) };
}

describe("market room authentication, routing and artwork", () => {
  it("uses a supplied bearer as the tab identity and never falls back to a valid cookie", async () => {
    const setup = fixture();
    const identities = await createAndJoin(setup);
    const request = (authorization: string) => setup.room(new Request(
      "https://example.test/api/market/snapshot",
      { headers: {
        cookie: identities.teacher,
        authorization,
        origin: "https://example.test",
        "sec-fetch-site": "same-origin"
      } }
    ));

    const team = await request(`Bearer ${tokenFromCookie(identities.teams[0]!.cookie)}`);
    expect(team.status).toBe(200);
    expect(await json(team)).toMatchObject({
      role: "team",
      snapshot: { own: { teamId: identities.teams[0]!.id } }
    });

    const invalid = await request("Bearer malformed");
    expect(invalid.status).toBe(401);
    expect(await json(invalid)).toEqual({ error: "INVALID_SESSION" });
  });

  it("resumes teacher and team sessions through a dedicated room envelope", async () => {
    const setup = fixture();
    const identities = await createAndJoin(setup);

    const teacher = await setup.room(jsonRequest(
      "/api/market/resume",
      "GET",
      identities.teacher
    ));
    expect(teacher.status).toBe(200);
    expect(await json(teacher)).toMatchObject({
      role: "teacher",
      roomCode: "ABC-234",
      snapshot: { roomId: "room-server", phase: "building" }
    });

    const team = await setup.room(jsonRequest(
      "/api/market/resume",
      "GET",
      identities.teams[1]!.cookie
    ));
    expect(team.status).toBe(200);
    expect(await json(team)).toMatchObject({
      role: "team",
      roomCode: "ABC-234",
      snapshot: { own: { teamId: identities.teams[1]!.id } }
    });
  });

  it("accepts same-origin browser evidence and rejects cross-origin or missing evidence", async () => {
    const setup = fixture();
    const { teacher } = await createAndJoin(setup);
    const snapshot = (headers: Record<string, string>) => setup.room(new Request(
      "https://example.test/api/market/snapshot",
      { headers: { cookie: teacher, ...headers } }
    ));

    expect((await snapshot({ origin: "https://example.test" })).status).toBe(200);
    expect((await snapshot({ "sec-fetch-site": "same-origin" })).status).toBe(200);
    expect((await snapshot({
      origin: "https://example.test",
      "sec-fetch-site": "same-origin"
    })).status).toBe(200);
    expect((await snapshot({
      origin: "https://attacker.example",
      "sec-fetch-site": "cross-site"
    })).status).toBe(403);
    expect((await snapshot({
      origin: "https://example.test",
      "sec-fetch-site": "same-site"
    })).status).toBe(403);
    expect((await snapshot({})).status).toBe(403);
  });

  it("guards methods, roles, missing configuration and unsigned requests", async () => {
    const setup = fixture();
    const identities = await createAndJoin(setup);
    expect((await setup.room(new Request("https://example.test/api/market/unknown"))).status).toBe(404);
    const wrongMethod = await setup.room(new Request("https://example.test/api/market/publish", {
      method: "GET",
      headers: { cookie: identities.teams[0]!.cookie }
    }));
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("allow")).toBe("POST");
    expect((await setup.room(jsonRequest("/api/market/snapshot", "GET"))).status).toBe(401);
    expect((await setup.room(jsonRequest("/api/market/review", "POST", identities.teams[0]!.cookie, {
      campaignId: "campaign-team-1",
      status: "approved"
    }))).status).toBe(403);
    expect((await setup.room(jsonRequest("/api/market/purchase", "POST", identities.teacher, {
      campaignId: "campaign-team-1",
      requestId: "request-1"
    }))).status).toBe(403);

    const disabled = createMarketRoomHandler({
      environment: { enabled: false },
      nowSeconds: () => 1_000,
      service: setup.service
    });
    expect((await disabled(jsonRequest("/api/market/snapshot", "GET", identities.teacher))).status)
      .toBe(503);
  });

  it("accepts only bounded 1600x900 PNGs from teams and stores content idempotently", async () => {
    const setup = fixture();
    const { teacher, teams } = await createAndJoin(setup);
    const valid = await upload(setup.room, teams[0]!.cookie);
    expect(valid.response.status).toBe(201);
    expect(valid.body.registered).toBe(true);
    expect(valid.body.artworkKey).toMatch(/^rooms\/[0-9a-f]{64}\/artwork\/[0-9a-f]{64}\/[0-9a-f]{64}\.png$/);
    const revision = setup.repository.rooms.get("ABC-234")!.value.state.revision;
    const replay = await upload(setup.room, teams[0]!.cookie);
    expect(replay.response.status).toBe(200);
    expect(replay.body).toMatchObject({ artworkKey: valid.body.artworkKey, registered: false });
    expect(setup.repository.rooms.get("ABC-234")!.value.state.revision).toBe(revision);
    expect(setup.repository.artworkWriteAttempts).toBe(1);
    expect((await upload(setup.room, teams[0]!.cookie, png(800, 450))).response.status).toBe(400);
    expect((await upload(setup.room, teacher)).response.status).toBe(403);

    const wrongType = await setup.room(new Request("https://example.test/api/market/artwork", {
      method: "PUT",
      headers: {
        cookie: teams[0]!.cookie,
        "content-type": "image/jpeg",
        origin: "https://example.test",
        "sec-fetch-site": "same-origin"
      },
      body: Uint8Array.from(png()).buffer
    }));
    expect(wrongType.status).toBe(415);
    const tooLarge = await setup.room(new Request("https://example.test/api/market/artwork", {
      method: "PUT",
      headers: {
        cookie: teams[0]!.cookie,
        "content-type": "image/png",
        origin: "https://example.test",
        "sec-fetch-site": "same-origin",
        "content-length": String(4 * 1_024 * 1_024 + 1)
      },
      body: Uint8Array.from(png()).buffer
    }));
    expect(tooLarge.status).toBe(413);
  });

  it("does not register artwork when its durable blob write fails", async () => {
    const setup = fixture();
    const { teams } = await createAndJoin(setup);
    setup.repository.failArtworkWrites = true;

    const failed = await upload(setup.room, teams[0]!.cookie);

    expect(failed.response.status).toBe(503);
    expect(failed.body).toEqual({ error: "MARKET_UNAVAILABLE" });
    expect(setup.repository.rooms.get("ABC-234")!.value.state.artworkUploadsByTeam)
      .toEqual({});
  });

  it("enforces the four-object upload ledger before writing blobs and unlocks revision after return", async () => {
    const setup = fixture();
    const { teacher, teams } = await createAndJoin(setup);
    await upload(setup.room, teams[0]!.cookie);
    for (let marker = 1; marker < 4; marker += 1) {
      expect((await upload(setup.room, teams[0]!.cookie, png(1_600, 900, marker))).response.status)
        .toBe(201);
    }
    const fifthBytes = png(1_600, 900, 4);
    const fifth = await upload(setup.room, teams[0]!.cookie, fifthBytes);
    expect(fifth.response.status).toBe(409);
    expect(fifth.body).toEqual({ error: "ARTWORK_QUOTA_EXHAUSTED" });
    expect(setup.repository.artwork.size).toBe(4);

    const secondSetup = fixture();
    const identities = await createAndJoin(secondSetup);
    const registered = await upload(secondSetup.room, identities.teams[0]!.cookie);
    const published = await secondSetup.room(jsonRequest(
      "/api/market/publish",
      "POST",
      identities.teams[0]!.cookie,
      {
        commandId: "publish-team-1-v1",
        productName: "Revision One",
        priceCents: 4_000,
        artworkKey: registered.body.artworkKey
      }
    ));
    expect(published.status).toBe(200);
    const blocked = await upload(secondSetup.room, identities.teams[0]!.cookie, png(1_600, 900, 9));
    expect(blocked.response.status).toBe(409);
    expect(blocked.body).toEqual({ error: "ARTWORK_UPLOAD_NOT_ALLOWED" });
    expect(secondSetup.repository.artwork.size).toBe(1);
    const forgedKey = (registered.body.artworkKey as string)
      .replace(/[0-9a-f]{64}\.png$/u, `${"f".repeat(64)}.png`);
    const forged = await secondSetup.room(jsonRequest(
      "/api/market/publish",
      "POST",
      identities.teams[0]!.cookie,
      {
        commandId: "publish-team-1-forged",
        productName: "Forged",
        priceCents: 4_000,
        artworkKey: forgedKey
      }
    ));
    expect(forged.status).toBe(409);
    expect(await json(forged)).toEqual({ error: "ARTWORK_NOT_REGISTERED" });
    await secondSetup.room(jsonRequest("/api/market/review", "POST", identities.teacher, {
      commandId: "return-team-1-v1",
      campaignId: "campaign-team-1",
      submissionVersion: 1,
      status: "returned"
    }));
    expect((await upload(
      secondSetup.room,
      identities.teams[0]!.cookie,
      png(1_600, 900, 9)
    )).response.status).toBe(201);
  });

  it("lets only the teacher revoke a team during building and immediately reclaims its alias and seat", async () => {
    const setup = fixture();
    const created = await setup.session(jsonRequest("/api/market/create", "POST", undefined, {
      classroomCode: "CLASS-2026",
      maxTeams: 3
    }));
    const teacher = cookieFrom(created);
    const teams: Array<{ cookie: string; id: string }> = [];
    for (const alias of ["Pixel Pirates", "Bright Bunch", "Idea Owls"]) {
      const joined = await setup.session(jsonRequest("/api/market/join", "POST", undefined, {
        roomCode: "ABC-234",
        alias
      }));
      const body = await json(joined);
      teams.push({ cookie: cookieFrom(joined), id: body.snapshot.own.teamId });
    }
    const full = await setup.session(jsonRequest("/api/market/join", "POST", undefined, {
      roomCode: "ABC-234",
      alias: "Late Legends"
    }));
    expect(full.status).toBe(409);
    expect(await json(full)).toEqual({ error: "LIMIT_REACHED" });

    const removed = await setup.room(jsonRequest("/api/market/control", "POST", teacher, {
      commandId: "remove-team-2",
      action: "removeTeam",
      teamId: teams[1]!.id
    }));
    expect(removed.status).toBe(200);
    const removedBody = await json(removed);
    expect(removedBody).toMatchObject({
      replayed: false,
      postcondition: { kind: "removeTeam", teamId: teams[1]!.id },
      snapshot: { maxTeams: 3, availableSeats: 1 }
    });
    expect((await setup.room(jsonRequest(
      "/api/market/snapshot",
      "GET",
      teams[1]!.cookie
    ))).status).toBe(404);
    const reclaimed = await setup.session(jsonRequest("/api/market/join", "POST", undefined, {
      roomCode: "ABC-234",
      alias: "  Bright   Bunch "
    }));
    expect(reclaimed.status).toBe(201);
    expect((await json(reclaimed)).snapshot.own.alias).toBe("Bright Bunch");
    const revisionAfterRejoin = setup.repository.rooms.get("ABC-234")!.value.state.revision;
    const replayedRemoval = await setup.room(jsonRequest("/api/market/control", "POST", teacher, {
      commandId: "remove-team-2",
      action: "removeTeam",
      teamId: teams[1]!.id
    }));
    expect(replayedRemoval.status).toBe(200);
    expect(await json(replayedRemoval)).toMatchObject({
      replayed: true,
      postcondition: { kind: "removeTeam", teamId: teams[1]!.id },
      snapshot: { revision: revisionAfterRejoin, availableSeats: 0 }
    });
    expect(setup.repository.rooms.get("ABC-234")!.value.state.revision).toBe(revisionAfterRejoin);
    expect((await setup.room(jsonRequest("/api/market/control", "POST", teams[0]!.cookie, {
      commandId: "remove-team-3",
      action: "removeTeam",
      teamId: teams[2]!.id
    }))).status).toBe(403);
  });

  it("serves only campaign-linked PNGs authorized for that teacher or team", async () => {
    const setup = fixture();
    const { teacher, teams } = await createAndJoin(setup);
    const first = await upload(setup.room, teams[0]!.cookie);
    const key = first.body.artworkKey as string;

    expect((await setup.room(jsonRequest(
      `/api/market/artwork?key=${encodeURIComponent(key)}`,
      "GET",
      teams[0]!.cookie
    ))).status).toBe(403);
    const published = await setup.room(jsonRequest("/api/market/publish", "POST", teams[0]!.cookie, {
      commandId: "publish-team-1-v1",
      productName: "Bright Bottle",
      tagline: "Glow as you go",
      priceCents: 4_000,
      artworkKey: key
    }));
    expect(published.status).toBe(200);
    expect((await json(published)).campaignId).toBe("campaign-team-1");

    expect((await setup.room(jsonRequest(
      `/api/market/artwork?key=${encodeURIComponent(key)}`,
      "GET",
      teams[1]!.cookie
    ))).status).toBe(403);
    const teacherImage = await setup.room(jsonRequest(
      `/api/market/artwork?key=${encodeURIComponent(key)}`,
      "GET",
      teacher
    ));
    expect(teacherImage.status).toBe(200);
    expect(teacherImage.headers.get("content-type")).toBe("image/png");
    expect(teacherImage.headers.get("cache-control")).toBe("private, no-store");
    expect(teacherImage.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await teacherImage.arrayBuffer())).toEqual(png());

    await setup.room(jsonRequest("/api/market/review", "POST", teacher, {
      commandId: "approve-team-1-v1",
      campaignId: "campaign-team-1",
      submissionVersion: 1,
      status: "approved"
    }));
    expect((await setup.room(jsonRequest(
      `/api/market/artwork?key=${encodeURIComponent(key)}`,
      "GET",
      teams[1]!.cookie
    ))).status).toBe(200);
    const unlinked = `rooms/${"a".repeat(64)}/artwork/${"b".repeat(64)}/${"c".repeat(64)}.png`;
    expect((await setup.room(jsonRequest(
      `/api/market/artwork?key=${encodeURIComponent(unlinked)}`,
      "GET",
      teacher
    ))).status).toBe(403);
  });

  it("revokes approved artwork reads when the viewing team is removed", async () => {
    const setup = fixture();
    const { teacher, teams } = await createAndJoin(setup);
    const uploaded = await upload(setup.room, teams[0]!.cookie);
    const key = uploaded.body.artworkKey as string;
    await setup.room(jsonRequest("/api/market/publish", "POST", teams[0]!.cookie, {
      commandId: "publish-team-1-v1",
      productName: "Bright Bottle",
      priceCents: 4_000,
      artworkKey: key
    }));
    await setup.room(jsonRequest("/api/market/review", "POST", teacher, {
      commandId: "approve-team-1-v1",
      campaignId: "campaign-team-1",
      submissionVersion: 1,
      status: "approved"
    }));
    await setup.room(jsonRequest("/api/market/control", "POST", teacher, {
      commandId: "remove-team-2",
      action: "removeTeam",
      teamId: teams[1]!.id
    }));

    const staleRead = await setup.room(jsonRequest(
      `/api/market/artwork?key=${encodeURIComponent(key)}`,
      "GET",
      teams[1]!.cookie
    ));

    expect(staleRead.status).toBe(401);
    expect(await json(staleRead)).toEqual({ error: "AUTH_REQUIRED" });
  });

  it("commits one publish under concurrent CAS and replays its stored postcondition after review", async () => {
    const setup = fixture();
    const { teacher, teams } = await createAndJoin(setup);
    const artwork = await upload(setup.room, teams[0]!.cookie);
    const before = setup.repository.rooms.get("ABC-234")!.value.state.revision;
    const casBefore = setup.repository.casAttempts;
    const body = {
      commandId: "publish-team-1-v1",
      productName: "Bright Bottle",
      priceCents: 4_000,
      artworkKey: artwork.body.artworkKey
    };
    setup.repository.yieldBeforeCas = true;

    const responses = await Promise.all([
      setup.room(jsonRequest("/api/market/publish", "POST", teams[0]!.cookie, body)),
      setup.room(jsonRequest("/api/market/publish", "POST", teams[0]!.cookie, body))
    ]);
    const payloads = await Promise.all(responses.map(json));

    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    expect(payloads.map(({ replayed }) => replayed).sort()).toEqual([false, true]);
    expect(payloads.map(({ postcondition }) => postcondition)).toEqual([
      { kind: "publish", campaignId: "campaign-team-1", submissionVersion: 1 },
      { kind: "publish", campaignId: "campaign-team-1", submissionVersion: 1 }
    ]);
    expect(setup.repository.rooms.get("ABC-234")!.value.state.revision).toBe(before + 1);
    expect(setup.repository.casAttempts - casBefore).toBe(2);

    const reviewed = await setup.room(jsonRequest("/api/market/review", "POST", teacher, {
      commandId: "approve-team-1-v1",
      campaignId: "campaign-team-1",
      submissionVersion: 1,
      status: "approved"
    }));
    expect(reviewed.status).toBe(200);
    expect(await json(reviewed)).toMatchObject({
      replayed: false,
      postcondition: {
        kind: "review",
        campaignId: "campaign-team-1",
        submissionVersion: 1,
        status: "approved"
      },
      snapshot: { campaigns: [{ submissionVersion: 1 }] }
    });
    const afterReview = setup.repository.rooms.get("ABC-234")!.value.state.revision;

    const replay = await setup.room(jsonRequest(
      "/api/market/publish",
      "POST",
      teams[0]!.cookie,
      body
    ));
    expect(replay.status).toBe(200);
    expect(await json(replay)).toMatchObject({
      replayed: true,
      campaignId: "campaign-team-1",
      submissionVersion: 1,
      postcondition: { kind: "publish", campaignId: "campaign-team-1", submissionVersion: 1 },
      snapshot: { revision: afterReview, campaigns: [{ status: "approved" }] }
    });
    expect(setup.repository.rooms.get("ABC-234")!.value.state.revision).toBe(afterReview);
    expect(JSON.stringify((await json(await setup.room(jsonRequest(
      "/api/market/snapshot",
      "GET",
      teacher
    )))).snapshot)).not.toMatch(/commandReceipts|payloadHash|postcondition/u);

    const conflict = await setup.room(jsonRequest("/api/market/publish", "POST", teams[0]!.cookie, {
      ...body,
      productName: "Changed Bottle"
    }));
    expect(conflict.status).toBe(409);
    expect(await json(conflict)).toEqual({ error: "COMMAND_CONFLICT" });
  });
});

describe("complete live market HTTP flow", () => {
  it("publishes exact cohort counts and spectator eligibility without private state", async () => {
    const setup = fixture();
    const { teacher, teams } = await createAndJoin(setup);
    const spectatorJoin = await setup.session(jsonRequest("/api/market/join", "POST", undefined, {
      roomCode: "ABC-234",
      alias: "Market Sparks"
    }));
    const spectatorBody = await json(spectatorJoin);
    const spectator = {
      cookie: cookieFrom(spectatorJoin),
      id: spectatorBody.snapshot.own.teamId
    };
    const campaignIds: string[] = [];

    for (let index = 0; index < teams.length; index += 1) {
      const artwork = await upload(setup.room, teams[index]!.cookie);
      const published = await json(await setup.room(jsonRequest(
        "/api/market/publish",
        "POST",
        teams[index]!.cookie,
        {
          commandId: `publish-cohort-team-${index + 1}`,
          productName: `Cohort Product ${index + 1}`,
          priceCents: 4_000,
          artworkKey: artwork.body.artworkKey
        }
      )));
      campaignIds.push(published.campaignId);
      expect((await setup.room(jsonRequest("/api/market/review", "POST", teacher, {
        commandId: `approve-cohort-team-${index + 1}`,
        campaignId: published.campaignId,
        submissionVersion: 1,
        status: "approved"
      }))).status).toBe(200);
    }

    const building = await json(await setup.room(jsonRequest(
      "/api/market/snapshot",
      "GET",
      teacher
    )));
    expect(building.snapshot.controls).toMatchObject({
      canOpenMarket: true,
      canOpenReveal: false,
      canCloseMarket: false
    });
    expect(building.snapshot.cohort).toEqual({
      frozen: false,
      totalJoined: 4,
      participating: 3,
      spectating: 1,
      buyers: 3,
      sellers: 3,
      requiredFinished: 0,
      finishedRequired: 0
    });

    const opened = await json(await setup.room(jsonRequest("/api/market/control", "POST", teacher, {
      commandId: "open-cohort-market",
      action: "openMarket"
    })));
    expect(opened.snapshot.cohort).toEqual({
      frozen: true,
      totalJoined: 4,
      participating: 3,
      spectating: 1,
      buyers: 3,
      sellers: 3,
      requiredFinished: 3,
      finishedRequired: 0
    });
    expect(opened.snapshot.teams.find((team: Record<string, unknown>) => team.id === spectator.id))
      .toMatchObject({
        marketEligibility: {
          state: "frozen",
          role: "spectator",
          reason: "no-campaign"
        }
      });

    const spectatorSnapshot = await json(await setup.room(jsonRequest(
      "/api/market/snapshot",
      "GET",
      spectator.cookie
    )));
    expect(spectatorSnapshot.snapshot.own.marketEligibility).toEqual({
      state: "frozen",
      role: "spectator",
      reason: "no-campaign"
    });
    expect(spectatorSnapshot.snapshot.campaigns.map((campaign: Record<string, unknown>) => campaign.id))
      .toEqual(campaignIds);
    const spectatorPurchase = await setup.room(jsonRequest("/api/market/purchase", "POST", spectator.cookie, {
      campaignId: campaignIds[0],
      requestId: "spectator-purchase"
    }));
    expect(spectatorPurchase.status).toBe(403);
    expect(await json(spectatorPurchase)).toEqual({ error: "MARKET_NOT_ELIGIBLE" });
    const spectatorFinish = await setup.room(jsonRequest("/api/market/finish", "POST", spectator.cookie, {
      commandId: "spectator-finish"
    }));
    expect(spectatorFinish.status).toBe(403);
    expect(await json(spectatorFinish)).toEqual({ error: "MARKET_NOT_ELIGIBLE" });

    const serialized = JSON.stringify(opened.snapshot);
    expect(serialized).not.toMatch(
      /commandReceipts|sessionBindings|canonicalPayload|payloadHash|intentKey|postcondition|token/u
    );
  });

  it("publishes, moderates, shops idempotently, finishes and reveals without leaking student data", async () => {
    const setup = fixture();
    const { teacher, teams } = await createAndJoin(setup);
    const campaignIds: string[] = [];

    for (let index = 0; index < teams.length; index += 1) {
      const artwork = await upload(setup.room, teams[index]!.cookie);
      const published = await setup.room(jsonRequest("/api/market/publish", "POST", teams[index]!.cookie, {
        commandId: `publish-team-${index + 1}-v1`,
        productName: `Product ${index + 1}`,
        tagline: `A bright idea ${index + 1}`,
        priceCents: 4_000,
        artworkKey: artwork.body.artworkKey
      }));
      expect(published.status).toBe(200);
      campaignIds.push((await json(published)).campaignId);
    }

    const beforeReveal = await json(await setup.room(jsonRequest(
      "/api/market/snapshot",
      "GET",
      teacher
    )));
    expect(beforeReveal.snapshot).not.toHaveProperty("reveal");
    expect(beforeReveal.snapshot.campaigns).toHaveLength(3);

    for (const campaignId of campaignIds) {
      const reviewed = await setup.room(jsonRequest("/api/market/review", "POST", teacher, {
        commandId: `approve-${campaignId}-v1`,
        campaignId,
        submissionVersion: 1,
        status: "approved"
      }));
      expect(reviewed.status).toBe(200);
    }
    const opened = await setup.room(jsonRequest("/api/market/control", "POST", teacher, {
      commandId: "open-market",
      action: "openMarket"
    }));
    expect((await json(opened)).snapshot.phase).toBe("market");
    const earlyClose = await setup.room(jsonRequest("/api/market/control", "POST", teacher, {
      commandId: "early-close-market",
      action: "closeMarket"
    }));
    expect(earlyClose.status).toBe(409);
    expect(await json(earlyClose)).toEqual({ error: "WRONG_PHASE" });
    const marketSnapshot = await json(await setup.room(jsonRequest(
      "/api/market/snapshot",
      "GET",
      teacher
    )));
    expect(marketSnapshot.snapshot).not.toHaveProperty("reveal");
    expect(marketSnapshot.snapshot.controls.canCloseMarket).toBe(false);
    expect((await setup.room(jsonRequest("/api/market/control", "POST", teacher, {
      commandId: "remove-team-3-after-open",
      action: "removeTeam",
      teamId: teams[2]!.id
    }))).status).toBe(409);

    expect((await setup.room(jsonRequest("/api/market/purchase", "POST", teams[0]!.cookie, {
      campaignId: campaignIds[0],
      requestId: "self-request"
    }))).status).toBe(403);
    expect((await setup.room(jsonRequest("/api/market/finish", "POST", teams[0]!.cookie, {
      commandId: "finish-team-1-early"
    }))).status)
      .toBe(409);

    const firstPurchase = await setup.room(jsonRequest("/api/market/purchase", "POST", teams[0]!.cookie, {
      campaignId: campaignIds[1],
      requestId: "team-1-request-1"
    }));
    const firstBody = await json(firstPurchase);
    const firstRevision = firstBody.snapshot.revision;
    expect(firstBody).toMatchObject({ replayed: false, receipt: { price: 4_000 } });
    expect(firstBody.receipt).not.toHaveProperty("buyerTeamId");
    expect(firstBody.receipt).not.toHaveProperty("requestId");

    const replay = await json(await setup.room(jsonRequest(
      "/api/market/purchase",
      "POST",
      teams[0]!.cookie,
      { campaignId: campaignIds[1], requestId: "team-1-request-1" }
    )));
    expect(replay.replayed).toBe(true);
    expect(replay.receipt).toEqual(firstBody.receipt);
    expect(replay.snapshot.revision).toBe(firstRevision);
    expect((await setup.room(jsonRequest("/api/market/purchase", "POST", teams[0]!.cookie, {
      campaignId: campaignIds[2],
      requestId: "team-1-request-1"
    }))).status).toBe(409);

    let sequence = 2;
    for (let buyer = 0; buyer < teams.length; buyer += 1) {
      for (let seller = 0; seller < teams.length; seller += 1) {
        if (buyer === seller || buyer === 0 && seller === 1) continue;
        const purchase = await setup.room(jsonRequest("/api/market/purchase", "POST", teams[buyer]!.cookie, {
          campaignId: campaignIds[seller],
          requestId: `team-${buyer + 1}-request-${sequence++}`
        }));
        expect(purchase.status).toBe(200);
      }
      const finished = await setup.room(jsonRequest("/api/market/finish", "POST", teams[buyer]!.cookie, {
        commandId: `finish-team-${buyer + 1}`
      }));
      expect(finished.status).toBe(200);
    }

    const revealed = await json(await setup.room(jsonRequest(
      "/api/market/control",
      "POST",
      teacher,
      { commandId: "open-reveal", action: "openReveal" }
    )));
    expect(revealed.snapshot.phase).toBe("reveal");
    expect(revealed.snapshot.reveal.standings).toEqual([
      expect.objectContaining({ revenue: 8_000, sales: 2 }),
      expect.objectContaining({ revenue: 8_000, sales: 2 }),
      expect.objectContaining({ revenue: 8_000, sales: 2 })
    ]);

    const student = await json(await setup.room(jsonRequest(
      "/api/market/snapshot",
      "GET",
      teams[0]!.cookie
    )));
    expect(student.snapshot.own).toMatchObject({ wallet: 2_000, spent: 8_000, finished: true });
    expect(student.snapshot).not.toHaveProperty("reveal");
    expect(student.snapshot).not.toHaveProperty("standings");
    expect(student.snapshot.teams.every((team: Record<string, unknown>) =>
      !Object.hasOwn(team, "wallet") && !Object.hasOwn(team, "revenue"))).toBe(true);
    expect(student.snapshot.myPurchases.every((purchase: Record<string, unknown>) =>
      !Object.hasOwn(purchase, "buyerTeamId") && !Object.hasOwn(purchase, "requestId"))).toBe(true);
    const closed = await json(await setup.room(jsonRequest(
      "/api/market/control",
      "POST",
      teacher,
      { commandId: "close-market", action: "closeMarket" }
    )));
    expect(closed.snapshot.phase).toBe("closed");
    expect(closed.snapshot.reveal.standings).toEqual(revealed.snapshot.reveal.standings);
  });

  it("rejects client-owned campaign IDs, trusted price fields and malformed controls", async () => {
    const setup = fixture();
    const { teacher, teams } = await createAndJoin(setup);
    const artwork = await upload(setup.room, teams[0]!.cookie);
    const premium = await setup.room(jsonRequest("/api/market/publish", "POST", teams[0]!.cookie, {
      commandId: "publish-premium",
      productName: "Moon Base Holiday",
      priceCents: 1_000_000_000_000,
      artworkKey: artwork.body.artworkKey
    }));
    expect(premium.status).toBe(200);
    expect((await setup.room(jsonRequest("/api/market/publish", "POST", teams[0]!.cookie, {
      productName: "Missing Command",
      priceCents: 4_000,
      artworkKey: artwork.body.artworkKey
    }))).status).toBe(400);
    expect((await setup.room(jsonRequest("/api/market/review", "POST", teacher, {
      commandId: "review-without-version",
      campaignId: "campaign-team-1",
      status: "approved"
    }))).status).toBe(400);
    expect((await setup.room(jsonRequest("/api/market/finish", "POST", teams[0]!.cookie, {}))).status)
      .toBe(400);
    expect((await setup.room(jsonRequest("/api/market/control", "POST", teacher, {
      action: "openMarket"
    }))).status).toBe(400);
    expect((await setup.room(jsonRequest("/api/market/publish", "POST", teams[0]!.cookie, {
      commandId: "publish-stolen",
      campaignId: "stolen-id",
      productName: "Product",
      priceCents: 1_000_000_000_000,
      artworkKey: artwork.body.artworkKey
    }))).status).toBe(400);
    expect((await setup.room(jsonRequest("/api/market/control", "POST", teacher, {
      commandId: "bad-control",
      action: "startAssignment"
    }))).status).toBe(400);
  });
});
