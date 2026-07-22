import { describe, expect, it } from "vitest";
import {
  AliasInputSchema,
  AwardInputSchema,
  ArtworkUploadSchema,
  CampaignSchema,
  MARKET_LIMITS,
  MarketRoomV1Schema,
  MarketRoomV2Schema,
  MarketRoomSchema,
  ReviewCampaignInputSchema,
  SubmitCampaignInputSchema,
  PurchaseInputSchema,
  TeamSchema,
  canonicalControlCommandPayload,
  canonicalAwardCommandPayload,
  canonicalFinishCommandPayload,
  canonicalPublishCommandPayload,
  canonicalRemoveTeamCommandPayload,
  canonicalReviewCommandPayload,
  normalizeMarketRoom,
  type MarketRoom
} from "./market-contracts";

const emptyRoom = (): MarketRoom => ({
  schemaVersion: 2,
  id: "room-1",
  revision: 0,
  phase: "building",
  marketMode: "purchases",
  openingWallet: 100,
  maxTeams: 15,
  createdAt: 1_000,
  updatedAt: 1_000,
  teams: {},
  campaigns: {},
  receipts: {},
  finishedAtByTeamId: {},
  artworkUploadsByTeam: {},
  marketCohort: null,
  commandReceipts: {},
  sessionBindings: { createdBy: null, joins: {} }
});

const legacyRoom = (phase: MarketRoom["phase"] = "building") => {
  const room = emptyRoom();
  const campaigns = Object.fromEntries(Object.entries(room.campaigns).map(([id, campaign]) => {
    const { submissionVersion: _submissionVersion, ...legacy } = campaign;
    return [id, legacy];
  }));
  const {
    marketMode: _marketMode,
    marketCohort: _marketCohort,
    commandReceipts: _commandReceipts,
    sessionBindings: _sessionBindings,
    ...legacy
  } = room;
  return { ...legacy, schemaVersion: 1 as const, phase, campaigns };
};

const validArtworkKey = (content = "c"): string =>
  `rooms/${"a".repeat(64)}/artwork/${"b".repeat(64)}/${content.repeat(64)}.png`;

describe("market contracts", () => {
  it("keeps team records alias-only and bounds classroom-safe aliases", () => {
    expect(TeamSchema.parse({ id: "team-1", alias: "Pixel Pirates", joinedAt: 1_000 }))
      .toEqual({ id: "team-1", alias: "Pixel Pirates", joinedAt: 1_000 });

    expect(TeamSchema.safeParse({
      id: "team-1",
      alias: "Pixel Pirates",
      joinedAt: 1_000,
      email: "student@example.test"
    }).success).toBe(false);
    expect(TeamSchema.safeParse({ id: "team-1", alias: " x", joinedAt: 1_000 }).success)
      .toBe(false);
    expect(TeamSchema.safeParse({
      id: "team-1",
      alias: "A".repeat(MARKET_LIMITS.aliasLength + 1),
      joinedAt: 1_000
    }).success).toBe(false);
  });

  it("canonicalizes harmless surrounding and repeated spaces before applying alias bounds", () => {
    expect(AliasInputSchema.parse("  Pixel   Pirates  ")).toBe("Pixel Pirates");
    expect(AliasInputSchema.safeParse("Pixel\tPirates").success).toBe(false);
    expect(AliasInputSchema.safeParse(`  ${"A".repeat(MARKET_LIMITS.aliasLength + 1)}  `).success)
      .toBe(false);
  });

  it("bounds teams, campaigns, text and timestamps", () => {
    const room = emptyRoom();
    for (let index = 1; index <= MARKET_LIMITS.teams + 1; index += 1) {
      const id = `team-${index}`;
      room.teams[id] = { id, alias: `Team ${index}`, joinedAt: 1_000 };
    }
    expect(MarketRoomSchema.safeParse(room).success).toBe(false);

    expect(CampaignSchema.safeParse({
      id: "campaign-1",
      sellerTeamId: "team-1",
      submissionVersion: 1,
      status: "pending",
      productName: "X".repeat(MARKET_LIMITS.productNameLength + 1),
      tagline: "A bright idea",
      price: 40,
      artworkKey: validArtworkKey(),
      submittedAt: 1_000
    }).success).toBe(false);

    expect(CampaignSchema.safeParse({
      id: "campaign-1",
      sellerTeamId: "team-1",
      submissionVersion: 1,
      status: "approved",
      productName: "Bright Bottle",
      price: 40,
      artworkKey: validArtworkKey(),
      submittedAt: MARKET_LIMITS.latestTimestamp + 1
    }).success).toBe(false);
  });

  it("allows premium product prices without coupling them to the opening wallet", () => {
    const premium = {
      id: "campaign-premium",
      sellerTeamId: "team-1",
      submissionVersion: 1,
      status: "pending" as const,
      productName: "Moon Base Holiday",
      price: 1_000_000_000_000,
      artworkKey: validArtworkKey(),
      submittedAt: 1_000
    };

    expect(CampaignSchema.safeParse(premium).success).toBe(true);
    expect(CampaignSchema.safeParse({ ...premium, price: premium.price + 1 }).success).toBe(false);
  });

  it("does not accept client-supplied seller or price in a purchase command", () => {
    const command = {
      expectedRevision: 7,
      buyerTeamId: "team-1",
      campaignId: "campaign-2",
      requestId: "request-1",
      receiptId: "receipt-1",
      now: 2_000
    };
    expect(PurchaseInputSchema.parse(command)).toEqual(command);
    expect(PurchaseInputSchema.safeParse({
      ...command,
      sellerTeamId: "team-3",
      price: 1
    }).success).toBe(false);
  });

  it("requires bounded command ids and the displayed submission version on replay-safe commands", () => {
    const publish = {
      expectedRevision: 7,
      commandId: "command-1",
      campaignId: "campaign-1",
      sellerTeamId: "team-1",
      productName: "Bright Bottle",
      price: 40,
      artworkKey: validArtworkKey(),
      now: 2_000
    };
    expect(SubmitCampaignInputSchema.safeParse(publish).success).toBe(true);
    expect(SubmitCampaignInputSchema.safeParse({ ...publish, commandId: undefined }).success).toBe(false);
    expect(SubmitCampaignInputSchema.safeParse({ ...publish, commandId: "x".repeat(65) }).success)
      .toBe(false);

    const review = {
      expectedRevision: 8,
      commandId: "command-2",
      campaignId: "campaign-1",
      submissionVersion: 1,
      status: "approved" as const,
      now: 2_100
    };
    expect(ReviewCampaignInputSchema.safeParse(review).success).toBe(true);
    expect(ReviewCampaignInputSchema.safeParse({ ...review, submissionVersion: undefined }).success)
      .toBe(false);
  });

  it("canonicalizes each semantic command payload with versioned fixed property order", () => {
    expect(canonicalAwardCommandPayload({
      voterTeamId: "team-1",
      campaignId: "campaign-2",
      medal: "gold"
    })).toBe('award:v1:{"voterTeamId":"team-1","campaignId":"campaign-2","medal":"gold"}');
    expect(canonicalPublishCommandPayload({
      campaignId: "campaign-1",
      sellerTeamId: "team-1",
      productName: "Bright Bottle",
      tagline: undefined,
      price: 40,
      artworkKey: validArtworkKey()
    })).toBe(`publish:v1:{"campaignId":"campaign-1","sellerTeamId":"team-1","productName":"Bright Bottle","tagline":null,"price":40,"artworkKey":"${validArtworkKey()}"}`);
    expect(canonicalFinishCommandPayload("team-1"))
      .toBe('finish:v1:{"teamId":"team-1"}');
    expect(canonicalReviewCommandPayload({
      campaignId: "campaign-1",
      submissionVersion: 2,
      status: "returned",
      reviewNote: undefined
    })).toBe('review:v1:{"campaignId":"campaign-1","submissionVersion":2,"status":"returned","reviewNote":null}');
    expect(canonicalControlCommandPayload("openMarket"))
      .toBe('openMarket:v1:{"action":"openMarket"}');
    expect(canonicalRemoveTeamCommandPayload("team-1"))
      .toBe('removeTeam:v1:{"teamId":"team-1"}');
  });

  it("accepts only a trusted medal choice on an award command", () => {
    const command = {
      expectedRevision: 7,
      commandId: "award-command-1",
      voterTeamId: "team-1",
      campaignId: "campaign-2",
      medal: "gold" as const,
      receiptId: "award-receipt-1",
      now: 2_000
    };
    expect(AwardInputSchema.parse(command)).toEqual(command);
    expect(AwardInputSchema.safeParse({ ...command, medal: "platinum" }).success).toBe(false);
    expect(AwardInputSchema.safeParse({ ...command, price: 1 }).success).toBe(false);
  });

  it("bounds registered artwork hashes, keys and byte counts", () => {
    const hash = "a".repeat(64);
    const upload = {
      contentHash: hash,
      artworkKey: `rooms/${"b".repeat(64)}/artwork/${"c".repeat(64)}/${hash}.png`,
      byteLength: 4 * 1_024 * 1_024,
      registeredAt: 1_000
    };
    expect(ArtworkUploadSchema.safeParse(upload).success).toBe(true);
    expect(ArtworkUploadSchema.safeParse({ ...upload, byteLength: upload.byteLength + 1 }).success)
      .toBe(false);
    expect(ArtworkUploadSchema.safeParse({ ...upload, artworkKey: "unhashed.png" }).success)
      .toBe(false);
  });

  it("rejects stored receipts whose trusted price or seller differs from the campaign", () => {
    const room = emptyRoom();
    room.teams["team-1"] = { id: "team-1", alias: "Pixel Pirates", joinedAt: 1_000 };
    room.teams["team-2"] = { id: "team-2", alias: "Bright Bunch", joinedAt: 1_000 };
    room.artworkUploadsByTeam["team-2"] = {
      ["d".repeat(64)]: {
        contentHash: "d".repeat(64),
        artworkKey: validArtworkKey("d"),
        byteLength: 1_024,
        registeredAt: 1_050
      }
    };
    room.campaigns["campaign-2"] = {
      id: "campaign-2",
      sellerTeamId: "team-2",
      submissionVersion: 1,
      status: "approved",
      productName: "Bright Bottle",
      price: 40,
      artworkKey: validArtworkKey("d"),
      submittedAt: 1_100,
      reviewedAt: 1_200
    };
    room.receipts["receipt-1"] = {
      id: "receipt-1",
      buyerTeamId: "team-1",
      sellerTeamId: "team-2",
      campaignId: "campaign-2",
      price: 1,
      requestId: "request-1",
      canonicalPayload: "purchase:v1:{\"campaignId\":\"campaign-2\"}",
      purchasedAt: 1_300
    };

    expect(MarketRoomSchema.safeParse(room).success).toBe(false);
    room.receipts["receipt-1"]!.price = 40;
    expect(MarketRoomSchema.safeParse(room).success).toBe(true);

    room.campaigns["campaign-2"]!.price = 101;
    room.receipts["receipt-1"]!.price = 101;
    expect(MarketRoomSchema.safeParse(room).success).toBe(false);
  });

  it("keeps v1 and v2 schemas strict and normalizes a building v1 room", () => {
    const legacy = legacyRoom();
    expect(MarketRoomV1Schema.safeParse(legacy).success).toBe(true);
    expect(MarketRoomV2Schema.safeParse(legacy).success).toBe(false);

    const normalized = normalizeMarketRoom(legacy);
    expect(normalized).toEqual({
      ...emptyRoom(),
      schemaVersion: 2,
      marketCohort: null,
      commandReceipts: {},
      sessionBindings: { createdBy: null, joins: {} }
    });
    expect(MarketRoomSchema).toBe(MarketRoomV2Schema);
    expect(MarketRoomV1Schema.safeParse({ ...legacy, extra: true }).success).toBe(false);
  });

  it("normalizes a live v1 room with all legacy buyers and approved sellers/campaigns", () => {
    const current = emptyRoom();
    current.phase = "market";
    current.teams["team-2"] = { id: "team-2", alias: "Bright Bunch", joinedAt: 1_000 };
    current.teams["team-1"] = { id: "team-1", alias: "Pixel Pirates", joinedAt: 1_000 };
    current.artworkUploadsByTeam["team-2"] = {
      ["d".repeat(64)]: {
        contentHash: "d".repeat(64),
        artworkKey: validArtworkKey("d"),
        byteLength: 1_024,
        registeredAt: 1_050
      }
    };
    current.campaigns["campaign-2"] = {
      id: "campaign-2",
      sellerTeamId: "team-2",
      submissionVersion: 1,
      status: "approved",
      productName: "Bright Bottle",
      price: 40,
      artworkKey: validArtworkKey("d"),
      submittedAt: 1_100,
      reviewedAt: 1_200
    };
    const legacy = legacyRoom("market");
    Object.assign(legacy, {
      teams: structuredClone(current.teams),
      campaigns: {
        "campaign-2": {
          id: "campaign-2",
          sellerTeamId: "team-2",
          status: "approved",
          productName: "Bright Bottle",
          price: 40,
          artworkKey: validArtworkKey("d"),
          submittedAt: 1_100,
          reviewedAt: 1_200
        }
      },
      artworkUploadsByTeam: structuredClone(current.artworkUploadsByTeam)
    });

    expect(normalizeMarketRoom(legacy)).toMatchObject({
      schemaVersion: 2,
      campaigns: { "campaign-2": { submissionVersion: 1 } },
      marketCohort: {
        buyerTeamIds: ["team-1", "team-2"],
        sellerTeamIds: ["team-2"],
        campaignIds: ["campaign-2"]
      },
      commandReceipts: {},
      sessionBindings: { createdBy: null, joins: {} }
    });
  });

  it("accepts bounded private v2 ledgers and rejects malformed v1 or v2 state", () => {
    const room = emptyRoom();
    const createIntent = "a".repeat(64);
    const joinIntent = "b".repeat(64);
    room.teams["team-1"] = { id: "team-1", alias: "Pixel Pirates", joinedAt: 1_000 };
    room.sessionBindings = {
      createdBy: { intentKey: createIntent, payloadHash: "c".repeat(64) },
      joins: { [joinIntent]: { teamId: "team-1", payloadHash: "d".repeat(64) } }
    };
    room.commandReceipts = {
      teacher: {
        "command-1": {
          operation: "openMarket",
          payloadHash: "e".repeat(64),
          committedAt: 1_100,
          committedRevision: 1,
          postcondition: { kind: "control", action: "openMarket" }
        }
      },
      "team:team-1": {
        "command-2": {
          operation: "finish",
          payloadHash: "f".repeat(64),
          committedAt: 1_200,
          committedRevision: 2,
          postcondition: { kind: "finish", finishedAt: 1_200 }
        }
      }
    };
    expect(MarketRoomV2Schema.safeParse(room).success).toBe(true);
    expect(normalizeMarketRoom(room)).toEqual(room);

    expect(normalizeMarketRoom({ ...room, schemaVersion: 2, extra: true })).toBeNull();
    expect(normalizeMarketRoom({
      ...room,
      sessionBindings: { ...room.sessionBindings, createdBy: { intentKey: "short", payloadHash: "c".repeat(64) } }
    })).toBeNull();
    expect(normalizeMarketRoom({
      ...room,
      commandReceipts: { "student:team-1": room.commandReceipts["team:team-1"] }
    })).toBeNull();
    expect(normalizeMarketRoom({ ...legacyRoom(), schemaVersion: 1, extra: true })).toBeNull();
  });

  it("requires sorted unique cohort ids and caps command receipts at 512 total", () => {
    const room = emptyRoom();
    room.marketCohort = {
      buyerTeamIds: ["team-2", "team-1"],
      sellerTeamIds: [],
      campaignIds: []
    };
    expect(MarketRoomV2Schema.safeParse(room).success).toBe(false);
    room.marketCohort.buyerTeamIds = ["team-1", "team-1"];
    expect(MarketRoomV2Schema.safeParse(room).success).toBe(false);

    room.marketCohort = null;
    room.commandReceipts.teacher = Object.fromEntries(Array.from({ length: 513 }, (_, index) => [
      `command-${index}`,
      {
        operation: "closeMarket",
        payloadHash: index.toString(16).padStart(64, "0"),
        committedAt: 1_100,
        committedRevision: index,
        postcondition: { kind: "control", action: "closeMarket" }
      }
    ]));
    expect(MarketRoomV2Schema.safeParse(room).success).toBe(false);
  });

  it("requires a frozen cohort only after building while accepting legacy asymmetric cohorts", () => {
    const room = emptyRoom();
    room.teams["team-1"] = { id: "team-1", alias: "Pixel Pirates", joinedAt: 1_000 };
    room.teams["team-2"] = { id: "team-2", alias: "Bright Bunch", joinedAt: 1_001 };
    room.marketCohort = {
      buyerTeamIds: ["team-1"],
      sellerTeamIds: [],
      campaignIds: []
    };
    expect(MarketRoomV2Schema.safeParse(room).success).toBe(false);

    room.phase = "market";
    expect(MarketRoomV2Schema.safeParse(room).success).toBe(true);
    room.marketCohort = null;
    expect(MarketRoomV2Schema.safeParse(room).success).toBe(false);

    room.marketCohort = {
      buyerTeamIds: ["team-1"],
      sellerTeamIds: [],
      campaignIds: []
    };
    room.finishedAtByTeamId["team-2"] = 1_200;
    expect(MarketRoomV2Schema.safeParse(room).success).toBe(false);
  });
});
