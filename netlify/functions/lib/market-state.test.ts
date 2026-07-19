import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  MarketStateError,
  canCloseMarket,
  canOpenMarket,
  canOpenReveal,
  closeMarket,
  computeReveal,
  createMarketRoom,
  finishTeam,
  joinTeam,
  joinTeamWithSessionBinding,
  openMarket,
  openReveal,
  purchaseCampaign,
  registerArtworkUpload,
  removeTeam,
  reviewCampaign,
  studentMarketSnapshot,
  submitCampaign
} from "./market-state";
import { MARKET_LIMITS, MarketRoomSchema, type MarketRoom } from "./market-contracts";

const teamAliases = [
  "Pixel Pirates",
  "Bright Bunch",
  "Idea Owls",
  "Market Sparks",
  "Design Foxes"
] as const;

function room(openingWallet = 100, maxTeams?: number): MarketRoom {
  return createMarketRoom({
    roomId: "room-1",
    openingWallet,
    ...(maxTeams === undefined ? {} : { maxTeams }),
    now: 1_000
  });
}

const hashFor = (value: number): string => value.toString(16).repeat(64).slice(0, 64);

function register(
  state: MarketRoom,
  teamNumber: number,
  value = teamNumber,
  byteLength = 1_024
) {
  const contentHash = hashFor(value);
  const artworkKey = `rooms/${"a".repeat(64)}/artwork/${hashFor(teamNumber + 5)}/${contentHash}.png`;
  return registerArtworkUpload(state, {
    expectedRevision: state.revision,
    teamId: `team-${teamNumber}`,
    contentHash,
    artworkKey,
    byteLength,
    now: 1_050 + state.revision
  });
}

function addTeam(state: MarketRoom, number: number): MarketRoom {
  return joinTeam(state, {
    expectedRevision: state.revision,
    teamId: `team-${number}`,
    alias: teamAliases[number - 1]!,
    now: 1_000 + state.revision + 1
  });
}

function addApprovedCampaign(state: MarketRoom, teamNumber: number, price: number): MarketRoom {
  const campaignId = `campaign-${teamNumber}`;
  const registered = register(state, teamNumber, teamNumber);
  let next = submitCampaign(registered.state, {
    expectedRevision: registered.state.revision,
    commandId: `publish-${campaignId}`,
    campaignId,
    sellerTeamId: `team-${teamNumber}`,
    productName: `Product ${teamNumber}`,
    tagline: `A bright idea ${teamNumber}`,
    price,
    artworkKey: registered.upload.artworkKey,
    now: 1_100 + state.revision
  });
  next = reviewCampaign(next, {
    expectedRevision: next.revision,
    commandId: `review-${campaignId}`,
    campaignId,
    submissionVersion: next.campaigns[campaignId]!.submissionVersion,
    status: "approved",
    now: 1_200 + next.revision
  });
  return next;
}

function addPendingCampaign(state: MarketRoom, teamNumber: number, price: number): MarketRoom {
  const campaignId = `campaign-${teamNumber}`;
  const registered = register(state, teamNumber, teamNumber);
  return submitCampaign(registered.state, {
    expectedRevision: registered.state.revision,
    commandId: `publish-${campaignId}`,
    campaignId,
    sellerTeamId: `team-${teamNumber}`,
    productName: `Product ${teamNumber}`,
    tagline: `A bright idea ${teamNumber}`,
    price,
    artworkKey: registered.upload.artworkKey,
    now: 1_100 + state.revision
  });
}

function readyRoom(prices: readonly number[] = [40, 40, 40]): MarketRoom {
  let state = room();
  for (let number = 1; number <= prices.length; number += 1) state = addTeam(state, number);
  for (let number = 1; number <= prices.length; number += 1) {
    state = addApprovedCampaign(state, number, prices[number - 1]!);
  }
  return state;
}

function buy(
  state: MarketRoom,
  buyerNumber: number,
  campaignNumber: number,
  sequence: number,
  expectedRevision = state.revision
) {
  return purchaseCampaign(state, {
    expectedRevision,
    buyerTeamId: `team-${buyerNumber}`,
    campaignId: `campaign-${campaignNumber}`,
    requestId: `request-${buyerNumber}-${sequence}`,
    receiptId: `receipt-${buyerNumber}-${sequence}`,
    now: 2_000 + sequence
  });
}

describe("market state revision discipline", () => {
  it("creates strict v2 defaults without exposing private ledgers in public snapshots", () => {
    const state = room();
    expect(state).toMatchObject({
      schemaVersion: 2,
      marketCohort: null,
      commandReceipts: {},
      sessionBindings: { createdBy: null, joins: {} }
    });
    expect(JSON.stringify(studentMarketSnapshot(addTeam(state, 1), "team-1")))
      .not.toMatch(/commandReceipts|sessionBindings/u);
  });

  it("increments exactly once and rejects a stale mutation for later CAS storage", () => {
    const initial = room();
    const joined = addTeam(initial, 1);

    expect(joined.revision).toBe(initial.revision + 1);
    expect(() => joinTeam(joined, {
      expectedRevision: initial.revision,
      teamId: "team-2",
      alias: "Bright Bunch",
      now: 1_010
    })).toThrow(expect.objectContaining({ code: "REVISION_CONFLICT" }));
    expect(initial.teams).toEqual({});
  });

  it("rejects duplicate aliases without storing names or contact fields", () => {
    const once = addTeam(room(), 1);
    expect(() => joinTeam(once, {
      expectedRevision: once.revision,
      teamId: "team-2",
      alias: "pixel pirates",
      now: 1_010
    })).toThrow(expect.objectContaining({ code: "ALIAS_TAKEN" }));
  });

  it("canonicalizes aliases before storage and uniqueness checks", () => {
    const first = joinTeam(room(), {
      expectedRevision: 0,
      teamId: "team-1",
      alias: "  Pixel   Pirates  ",
      now: 1_001
    });
    expect(first.teams["team-1"]?.alias).toBe("Pixel Pirates");
    expect(() => joinTeam(first, {
      expectedRevision: first.revision,
      teamId: "team-2",
      alias: " Pixel Pirates ",
      now: 1_002
    })).toThrow(expect.objectContaining({ code: "ALIAS_TAKEN" }));
  });

  it("atomically binds a join intent and replays the original team without a revision", () => {
    const intentKey = "a".repeat(64);
    const payloadHash = "b".repeat(64);
    const first = joinTeamWithSessionBinding(room(), {
      expectedRevision: 0,
      teamId: "team-1",
      alias: "  Pixel   Pirates  ",
      intentKey,
      payloadHash,
      now: 1_001
    });
    const replay = joinTeamWithSessionBinding(first.state, {
      expectedRevision: 0,
      teamId: "unused-team-id",
      alias: "Pixel Pirates",
      intentKey,
      payloadHash,
      now: 1_500
    });

    expect(first).toMatchObject({ replayed: false, team: { id: "team-1" } });
    expect(first.state.sessionBindings.joins[intentKey]).toEqual({
      teamId: "team-1",
      payloadHash
    });
    expect(replay).toMatchObject({ replayed: true, team: { id: "team-1" } });
    expect(replay.state.revision).toBe(first.state.revision);
    expect(replay.state.updatedAt).toBe(first.state.updatedAt);
  });

  it("rejects a reused join intent with a different payload and removes bindings with teams", () => {
    const intentKey = "a".repeat(64);
    const joined = joinTeamWithSessionBinding(room(), {
      expectedRevision: 0,
      teamId: "team-1",
      alias: "Pixel Pirates",
      intentKey,
      payloadHash: "b".repeat(64),
      now: 1_001
    });

    expect(() => joinTeamWithSessionBinding(joined.state, {
      expectedRevision: joined.state.revision,
      teamId: "team-2",
      alias: "Bright Bunch",
      intentKey,
      payloadHash: "c".repeat(64),
      now: 1_002
    })).toThrow(expect.objectContaining({ code: "IDEMPOTENCY_CONFLICT" }));

    const removed = removeTeam(joined.state, {
      expectedRevision: joined.state.revision,
      commandId: "remove-team-1",
      teamId: "team-1",
      now: 1_003
    });
    expect(removed.sessionBindings.joins[intentKey]).toBeUndefined();
  });

  it("enforces the teacher-selected seat count and removes a team only during building", () => {
    let state = room(100, 3);
    for (let number = 1; number <= 3; number += 1) state = addTeam(state, number);
    expect(() => joinTeam(state, {
      expectedRevision: state.revision,
      teamId: "team-4",
      alias: "Market Sparks",
      now: 1_010
    })).toThrow(expect.objectContaining({ code: "LIMIT_REACHED" }));

    const uploaded = register(state, 1);
    const submitted = submitCampaign(uploaded.state, {
      expectedRevision: uploaded.state.revision,
      commandId: "publish-team-1",
      campaignId: "campaign-1",
      sellerTeamId: "team-1",
      productName: "Product 1",
      price: 40,
      artworkKey: uploaded.upload.artworkKey,
      now: 1_100
    });
    const removed = removeTeam(submitted, {
      expectedRevision: submitted.revision,
      commandId: "remove-team-1",
      teamId: "team-1",
      now: 1_200
    });
    expect(removed.teams["team-1"]).toBeUndefined();
    expect(removed.campaigns["campaign-1"]).toBeUndefined();
    expect(removed.artworkUploadsByTeam["team-1"]).toBeUndefined();
    expect(joinTeam(removed, {
      expectedRevision: removed.revision,
      teamId: "team-4",
      alias: " Pixel   Pirates ",
      now: 1_300
    }).teams["team-4"]?.alias).toBe("Pixel Pirates");
  });
});

describe("registered artwork", () => {
  it("registers by hash once without charging the same upload twice", () => {
    const state = addTeam(room(), 1);
    const first = register(state, 1, 1, 2_048);
    const replay = registerArtworkUpload(first.state, {
      expectedRevision: state.revision,
      teamId: "team-1",
      contentHash: first.upload.contentHash,
      artworkKey: first.upload.artworkKey,
      byteLength: first.upload.byteLength,
      now: 1_200
    });

    expect(first.registered).toBe(true);
    expect(replay).toEqual({ state: first.state, upload: first.upload, registered: false });
    expect(Object.keys(replay.state.artworkUploadsByTeam["team-1"]!)).toHaveLength(1);
  });

  it("enforces four uploads, the byte budget, campaign eligibility and building phase", () => {
    let state = addTeam(room(), 1);
    for (let value = 1; value <= 4; value += 1) {
      state = register(state, 1, value, 4 * 1_024 * 1_024).state;
    }
    expect(() => register(state, 1, 5, 1)).toThrow(
      expect.objectContaining({ code: "ARTWORK_QUOTA_EXHAUSTED" })
    );

    let campaignState = addTeam(room(), 1);
    const first = register(campaignState, 1);
    campaignState = submitCampaign(first.state, {
      expectedRevision: first.state.revision,
      commandId: "publish-team-1-v1",
      campaignId: "campaign-1",
      sellerTeamId: "team-1",
      productName: "Product 1",
      price: 40,
      artworkKey: first.upload.artworkKey,
      now: 1_100
    });
    expect(() => register(campaignState, 1, 2)).toThrow(
      expect.objectContaining({ code: "ARTWORK_UPLOAD_NOT_ALLOWED" })
    );
    campaignState = reviewCampaign(campaignState, {
      expectedRevision: campaignState.revision,
      commandId: "review-team-1-v1",
      campaignId: "campaign-1",
      submissionVersion: campaignState.campaigns["campaign-1"]!.submissionVersion,
      status: "returned",
      now: 1_200
    });
    expect(register(campaignState, 1, 2).registered).toBe(true);
  });

  it("will not publish an artwork key that was never registered", () => {
    const state = addTeam(room(), 1);
    expect(() => submitCampaign(state, {
      expectedRevision: state.revision,
      commandId: "publish-team-1-v1",
      campaignId: "campaign-1",
      sellerTeamId: "team-1",
      productName: "Product 1",
      price: 40,
      artworkKey: `rooms/${"a".repeat(64)}/artwork/${"b".repeat(64)}/${"c".repeat(64)}.png`,
      now: 1_100
    })).toThrow(expect.objectContaining({ code: "ARTWORK_NOT_REGISTERED" }));
  });

  it("starts campaign submission versions at one and increments returned resubmissions", () => {
    let state = addTeam(room(), 1);
    const firstUpload = register(state, 1, 1);
    state = submitCampaign(firstUpload.state, {
      expectedRevision: firstUpload.state.revision,
      commandId: "publish-team-1-v1",
      campaignId: "campaign-1",
      sellerTeamId: "team-1",
      productName: "First Product",
      price: 40,
      artworkKey: firstUpload.upload.artworkKey,
      now: 1_100
    });
    expect(state.campaigns["campaign-1"]?.submissionVersion).toBe(1);
    state = reviewCampaign(state, {
      expectedRevision: state.revision,
      commandId: "review-team-1-v1",
      campaignId: "campaign-1",
      submissionVersion: state.campaigns["campaign-1"]!.submissionVersion,
      status: "returned",
      now: 1_200
    });
    const secondUpload = register(state, 1, 2);
    state = submitCampaign(secondUpload.state, {
      expectedRevision: secondUpload.state.revision,
      commandId: "publish-team-1-v2",
      campaignId: "campaign-1",
      sellerTeamId: "team-1",
      productName: "Improved Product",
      price: 45,
      artworkKey: secondUpload.upload.artworkKey,
      now: 1_300
    });
    expect(state.campaigns["campaign-1"]?.submissionVersion).toBe(2);
  });
});

describe("replay-safe domain commands", () => {
  it("commits publish and its receipt once, then replays the original version after later review", () => {
    const joined = addTeam(room(), 1);
    const registered = register(joined, 1);
    const command = {
      expectedRevision: registered.state.revision,
      commandId: "publish-team-1-v1",
      campaignId: "campaign-1",
      sellerTeamId: "team-1",
      productName: "First Product",
      price: 40,
      artworkKey: registered.upload.artworkKey,
      now: 1_100
    };
    const first = submitCampaign(registered.state, command);
    const receipt = first.commandReceipts["team:team-1"]![command.commandId]!;

    expect(first.revision).toBe(registered.state.revision + 1);
    expect(first.campaigns["campaign-1"]?.submissionVersion).toBe(1);
    expect(receipt).toMatchObject({
      operation: "publish",
      committedRevision: first.revision,
      postcondition: { kind: "publish", campaignId: "campaign-1", submissionVersion: 1 }
    });
    expect(receipt.payloadHash).toBe(createHash("sha256").update(
      `publish:v1:{"campaignId":"campaign-1","sellerTeamId":"team-1","productName":"First Product","tagline":null,"price":40,"artworkKey":"${registered.upload.artworkKey}"}`,
      "utf8"
    ).digest("hex"));

    const immediate = submitCampaign(first, { ...command, expectedRevision: 0, now: 1_200 });
    expect(immediate).toEqual(first);
    expect(immediate.revision).toBe(first.revision);

    const reviewed = reviewCampaign(first, {
      expectedRevision: first.revision,
      commandId: "review-team-1-v1",
      campaignId: "campaign-1",
      submissionVersion: 1,
      status: "approved",
      now: 1_300
    });
    const replayAfterReview = submitCampaign(reviewed, {
      ...command,
      expectedRevision: 0,
      now: 1_400
    });
    expect(replayAfterReview).toEqual(reviewed);
    expect(replayAfterReview.campaigns["campaign-1"]?.status).toBe("approved");
    expect(replayAfterReview.commandReceipts["team:team-1"]![command.commandId])
      .toEqual(receipt);
  });

  it("rejects mismatched command reuse before stale revision and current eligibility checks", () => {
    const joined = addTeam(room(), 1);
    const registered = register(joined, 1);
    const first = submitCampaign(registered.state, {
      expectedRevision: registered.state.revision,
      commandId: "publish-team-1",
      campaignId: "campaign-1",
      sellerTeamId: "team-1",
      productName: "First Product",
      price: 40,
      artworkKey: registered.upload.artworkKey,
      now: 1_100
    });
    const reviewed = reviewCampaign(first, {
      expectedRevision: first.revision,
      commandId: "review-team-1",
      campaignId: "campaign-1",
      submissionVersion: 1,
      status: "approved",
      now: 1_200
    });

    expect(() => submitCampaign(reviewed, {
      expectedRevision: 0,
      commandId: "publish-team-1",
      campaignId: "campaign-1",
      sellerTeamId: "team-1",
      productName: "Changed Product",
      price: 40,
      artworkKey: registered.upload.artworkKey,
      now: 1_300
    })).toThrow(expect.objectContaining({ code: "COMMAND_CONFLICT" }));
    expect(() => removeTeam(reviewed, {
      expectedRevision: 0,
      commandId: "review-team-1",
      teamId: "team-1",
      now: 1_300
    })).toThrow(expect.objectContaining({ code: "COMMAND_CONFLICT" }));
  });

  it("isolates the same command id across team actors", () => {
    let state = addTeam(addTeam(room(), 1), 2);
    const firstUpload = register(state, 1);
    const secondUpload = register(firstUpload.state, 2);
    state = submitCampaign(secondUpload.state, {
      expectedRevision: secondUpload.state.revision,
      commandId: "shared-command",
      campaignId: "campaign-1",
      sellerTeamId: "team-1",
      productName: "First Product",
      price: 40,
      artworkKey: firstUpload.upload.artworkKey,
      now: 1_100
    });
    state = submitCampaign(state, {
      expectedRevision: state.revision,
      commandId: "shared-command",
      campaignId: "campaign-2",
      sellerTeamId: "team-2",
      productName: "Second Product",
      price: 40,
      artworkKey: secondUpload.upload.artworkKey,
      now: 1_200
    });

    expect(state.commandReceipts["team:team-1"]?.["shared-command"]?.postcondition)
      .toMatchObject({ campaignId: "campaign-1" });
    expect(state.commandReceipts["team:team-2"]?.["shared-command"]?.postcondition)
      .toMatchObject({ campaignId: "campaign-2" });
  });

  it("replays an old review after resubmission but rejects a new stale displayed version", () => {
    let state = addTeam(room(), 1);
    const firstUpload = register(state, 1);
    state = submitCampaign(firstUpload.state, {
      expectedRevision: firstUpload.state.revision,
      commandId: "publish-v1",
      campaignId: "campaign-1",
      sellerTeamId: "team-1",
      productName: "First Product",
      price: 40,
      artworkKey: firstUpload.upload.artworkKey,
      now: 1_100
    });
    const firstReview = {
      expectedRevision: state.revision,
      commandId: "return-v1",
      campaignId: "campaign-1",
      submissionVersion: 1,
      status: "returned" as const,
      now: 1_200
    };
    state = reviewCampaign(state, firstReview);
    const secondUpload = register(state, 1, 2);
    state = submitCampaign(secondUpload.state, {
      expectedRevision: secondUpload.state.revision,
      commandId: "publish-v2",
      campaignId: "campaign-1",
      sellerTeamId: "team-1",
      productName: "Improved Product",
      price: 45,
      artworkKey: secondUpload.upload.artworkKey,
      now: 1_300
    });
    const current = state;

    expect(reviewCampaign(current, { ...firstReview, expectedRevision: 0, now: 1_400 }))
      .toEqual(current);
    expect(() => reviewCampaign(current, {
      ...firstReview,
      expectedRevision: current.revision,
      commandId: "stale-new-review",
      now: 1_500
    })).toThrow(expect.objectContaining({ code: "SUBMISSION_VERSION_CONFLICT" }));
  });

  it("replays finish, controls and remove-team after later state changes", () => {
    const prepared = readyRoom();
    let state = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market",
      now: 1_500
    });
    const opened = state;
    state = buy(state, 1, 2, 1).state;
    expect(openMarket(state, { expectedRevision: 0, commandId: "open-market", now: 2_000 }))
      .toEqual(state);

    state = buy(state, 1, 3, 2).state;
    state = finishTeam(state, {
      expectedRevision: state.revision,
      commandId: "finish-team-1",
      teamId: "team-1",
      now: 2_100
    });
    const finished = state;
    state = buy(state, 2, 1, 3).state;
    expect(finishTeam(state, {
      expectedRevision: opened.revision,
      commandId: "finish-team-1",
      teamId: "team-1",
      now: 2_200
    })).toEqual(state);
    expect(state.commandReceipts["team:team-1"]?.["finish-team-1"]?.postcondition)
      .toEqual({ kind: "finish", finishedAt: finished.finishedAtByTeamId["team-1"] });

    let building = addTeam(addTeam(room(), 1), 2);
    building = removeTeam(building, {
      expectedRevision: building.revision,
      commandId: "remove-team-1",
      teamId: "team-1",
      now: 1_100
    });
    building = addTeam(building, 3);
    expect(removeTeam(building, {
      expectedRevision: 0,
      commandId: "remove-team-1",
      teamId: "team-1",
      now: 1_300
    })).toEqual(building);
    expect(building.commandReceipts.teacher?.["remove-team-1"]?.postcondition)
      .toEqual({ kind: "removeTeam", teamId: "team-1" });
  });

  it("never evicts a full ledger and still permits an existing receipt replay", () => {
    let state = addTeam(addTeam(room(), 1), 2);
    state = removeTeam(state, {
      expectedRevision: state.revision,
      commandId: "remove-team-1",
      teamId: "team-1",
      now: 1_100
    });
    const teacher = state.commandReceipts.teacher!;
    state = {
      ...state,
      commandReceipts: {
        ...state.commandReceipts,
        teacher: {
          ...teacher,
          ...Object.fromEntries(Array.from({ length: MARKET_LIMITS.commandReceipts - 1 }, (_, index) => [
            `filler-${index}`,
            {
              operation: "closeMarket" as const,
              payloadHash: hashFor(index),
              committedAt: 1_100,
              committedRevision: state.revision,
              postcondition: { kind: "control" as const, action: "closeMarket" as const }
            }
          ]))
        }
      }
    };

    expect(removeTeam(state, {
      expectedRevision: 0,
      commandId: "remove-team-1",
      teamId: "team-1",
      now: 1_200
    })).toEqual(state);
    expect(() => removeTeam(state, {
      expectedRevision: 0,
      commandId: "remove-team-2",
      teamId: "team-2",
      now: 1_200
    })).toThrow(expect.objectContaining({ code: "COMMAND_LEDGER_FULL" }));
    expect(Object.values(state.commandReceipts)
      .reduce((total, receipts) => total + Object.keys(receipts).length, 0))
      .toBe(MARKET_LIMITS.commandReceipts);
  });
});

describe("opening the live market", () => {
  it("opens only when every team can afford products from two other sellers", () => {
    const prepared = readyRoom([30, 40, 50]);
    const opened = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market",
      now: 1_500
    });

    expect(opened.phase).toBe("market");
    expect(opened.revision).toBe(prepared.revision + 1);
  });

  it("rejects fewer than three approved campaigns", () => {
    let prepared = room();
    for (let number = 1; number <= 3; number += 1) prepared = addTeam(prepared, number);
    prepared = addApprovedCampaign(prepared, 1, 30);
    prepared = addApprovedCampaign(prepared, 2, 30);

    expect(() => openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market",
      now: 1_500
    })).toThrow(expect.objectContaining({ code: "MARKET_NOT_READY" }));
  });

  it("freezes sorted current approved teams and makes an unapproved team a spectator", () => {
    let prepared = readyRoom([30, 40, 50]);
    prepared = addTeam(prepared, 4);
    prepared = addPendingCampaign(prepared, 4, 1);

    expect(canOpenMarket(prepared)).toEqual({
      allowed: true,
      errorCode: null,
      cohort: {
        buyerTeamIds: ["team-1", "team-2", "team-3"],
        sellerTeamIds: ["team-1", "team-2", "team-3"],
        campaignIds: ["campaign-1", "campaign-2", "campaign-3"]
      }
    });

    const opened = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market-with-spectator",
      now: 1_500
    });
    expect(opened.marketCohort).toEqual({
      buyerTeamIds: ["team-1", "team-2", "team-3"],
      sellerTeamIds: ["team-1", "team-2", "team-3"],
      campaignIds: ["campaign-1", "campaign-2", "campaign-3"]
    });
    expect(studentMarketSnapshot(opened, "team-4").own.marketEligibility).toEqual({
      state: "frozen",
      role: "spectator",
      reason: "campaign-pending"
    });
    expect(studentMarketSnapshot(opened, "team-1").own.marketEligibility).toEqual({
      state: "frozen",
      role: "buyer-seller",
      reason: "approved-campaign"
    });
    expect(studentMarketSnapshot(opened, "team-4").campaigns.map(({ id }) => id))
      .toEqual(["campaign-1", "campaign-2", "campaign-3"]);

    expect(() => reviewCampaign(opened, {
      expectedRevision: opened.revision,
      commandId: "late-hide-campaign-1",
      campaignId: "campaign-1",
      submissionVersion: 1,
      status: "hidden",
      now: 1_600
    })).toThrow(expect.objectContaining({ code: "WRONG_PHASE" }));
    expect(() => openMarket(opened, {
      expectedRevision: opened.revision,
      commandId: "open-market-again-with-different-command",
      now: 1_601
    })).toThrow(expect.objectContaining({ code: "WRONG_PHASE" }));
    expect(opened.marketCohort).toEqual({
      buyerTeamIds: ["team-1", "team-2", "team-3"],
      sellerTeamIds: ["team-1", "team-2", "team-3"],
      campaignIds: ["campaign-1", "campaign-2", "campaign-3"]
    });
  });

  it("requires three distinct current approved sellers even when three campaigns are approved", () => {
    let prepared = room();
    for (let number = 1; number <= 3; number += 1) prepared = addTeam(prepared, number);
    prepared = addApprovedCampaign(prepared, 1, 30);
    prepared = addApprovedCampaign(prepared, 2, 30);
    prepared = submitCampaign(prepared, {
      expectedRevision: prepared.revision,
      commandId: "publish-campaign-1-new",
      campaignId: "campaign-1-new",
      sellerTeamId: "team-1",
      productName: "Product 1 New",
      price: 30,
      artworkKey: prepared.campaigns["campaign-1"]!.artworkKey,
      now: 1_450
    });
    prepared = reviewCampaign(prepared, {
      expectedRevision: prepared.revision,
      commandId: "review-campaign-1-new",
      campaignId: "campaign-1-new",
      submissionVersion: 1,
      status: "approved",
      now: 1_460
    });

    expect(Object.values(prepared.campaigns).filter(({ status }) => status === "approved"))
      .toHaveLength(3);
    expect(canOpenMarket(prepared)).toMatchObject({ allowed: false, errorCode: "MARKET_NOT_READY" });
    expect(() => openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market-two-sellers",
      now: 1_500
    })).toThrow(expect.objectContaining({ code: "MARKET_NOT_READY" }));
  });

  it("rejects a market where one team cannot afford a two-seller pair", () => {
    const prepared = readyRoom([1, 60, 60]);
    expect(() => openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market",
      now: 1_500
    })).toThrow(expect.objectContaining({ code: "MARKET_NOT_READY" }));
  });
});

describe("server-authoritative purchases", () => {
  it("copies trusted seller and price from an approved campaign", () => {
    const prepared = readyRoom([30, 40, 50]);
    const opened = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market",
      now: 1_500
    });
    const result = buy(opened, 1, 2, 1);

    expect(result.replayed).toBe(false);
    expect(result.receipt).toMatchObject({
      buyerTeamId: "team-1",
      sellerTeamId: "team-2",
      campaignId: "campaign-2",
      price: 40
    });
  });

  it("rejects own, unapproved, duplicate and unaffordable campaigns", () => {
    let prepared = readyRoom([10, 70, 40, 30, 30]);
    prepared = reviewCampaign(prepared, {
      expectedRevision: prepared.revision,
      commandId: "hide-campaign-5",
      campaignId: "campaign-5",
      submissionVersion: prepared.campaigns["campaign-5"]!.submissionVersion,
      status: "hidden",
      now: 1_400
    });
    const opened = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market",
      now: 1_500
    });

    expect(() => buy(opened, 1, 1, 1)).toThrow(expect.objectContaining({ code: "OWN_CAMPAIGN" }));
    expect(() => purchaseCampaign(opened, {
      expectedRevision: opened.revision,
      buyerTeamId: "team-1",
      campaignId: "campaign-5",
      requestId: "pending-request",
      receiptId: "pending-receipt",
      now: 2_000
    })).toThrow(expect.objectContaining({ code: "CAMPAIGN_NOT_APPROVED" }));

    const first = buy(opened, 1, 2, 2);
    expect(() => buy(first.state, 1, 2, 3)).toThrow(
      expect.objectContaining({ code: "ALREADY_PURCHASED" })
    );
    expect(() => buy(first.state, 1, 3, 4)).toThrow(
      expect.objectContaining({ code: "INSUFFICIENT_FUNDS" })
    );
  });

  it("returns the original receipt for an identical replay even with a stale revision", () => {
    const prepared = readyRoom();
    const opened = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market",
      now: 1_500
    });
    const first = buy(opened, 1, 2, 1);
    const replay = purchaseCampaign(first.state, {
      expectedRevision: opened.revision,
      buyerTeamId: "team-1",
      campaignId: "campaign-2",
      requestId: "request-1-1",
      receiptId: "a-new-unused-server-id",
      now: 2_100
    });

    expect(replay).toEqual({ state: first.state, receipt: first.receipt, replayed: true });
  });

  it("conflicts when the same actor and request id carries a different canonical payload", () => {
    const prepared = readyRoom();
    const opened = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market",
      now: 1_500
    });
    const first = buy(opened, 1, 2, 1);

    expect(() => purchaseCampaign(first.state, {
      expectedRevision: opened.revision,
      buyerTeamId: "team-1",
      campaignId: "campaign-3",
      requestId: "request-1-1",
      receiptId: "receipt-conflict",
      now: 2_100
    })).toThrow(expect.objectContaining({ code: "IDEMPOTENCY_CONFLICT" }));
  });

  it("rejects purchases and finish commands from a frozen spectator", () => {
    let prepared = readyRoom();
    prepared = addTeam(prepared, 4);
    prepared = addPendingCampaign(prepared, 4, 10);
    const opened = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market-with-spectator",
      now: 1_500
    });

    expect(() => buy(opened, 4, 1, 1)).toThrow(
      expect.objectContaining({ code: "MARKET_NOT_ELIGIBLE" })
    );
    expect(() => finishTeam(opened, {
      expectedRevision: opened.revision,
      commandId: "finish-spectator",
      teamId: "team-4",
      now: 2_100
    })).toThrow(expect.objectContaining({ code: "MARKET_NOT_ELIGIBLE" }));
  });
});

describe("finishing and reveal", () => {
  it("normally requires two sellers and at least 80 percent of the wallet spent", () => {
    const prepared = readyRoom();
    const opened = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market",
      now: 1_500
    });
    const first = buy(opened, 1, 2, 1).state;
    expect(() => finishTeam(first, {
      expectedRevision: first.revision,
      commandId: "finish-team-1",
      teamId: "team-1",
      now: 2_100
    })).toThrow(expect.objectContaining({ code: "FINISH_NOT_ALLOWED" }));

    const second = buy(first, 1, 3, 2).state;
    expect(finishTeam(second, {
      expectedRevision: second.revision,
      commandId: "finish-team-1",
      teamId: "team-1",
      now: 2_200
    }).finishedAtByTeamId["team-1"]).toBe(2_200);
  });

  it("allows two sellers below 80 percent only when no affordable purchase remains", () => {
    const prepared = readyRoom([10, 30, 30, 50]);
    const opened = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market",
      now: 1_500
    });
    const afterTwo = buy(buy(opened, 1, 2, 1).state, 1, 3, 2).state;

    expect(finishTeam(afterTwo, {
      expectedRevision: afterTwo.revision,
      commandId: "finish-team-1",
      teamId: "team-1",
      now: 2_200
    }).finishedAtByTeamId["team-1"]).toBe(2_200);
  });

  it("does not allow the low-spend exception while an affordable purchase remains", () => {
    const prepared = readyRoom([10, 30, 30, 40]);
    const opened = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market",
      now: 1_500
    });
    const afterTwo = buy(buy(opened, 1, 2, 1).state, 1, 3, 2).state;

    expect(() => finishTeam(afterTwo, {
      expectedRevision: afterTwo.revision,
      commandId: "finish-team-1",
      teamId: "team-1",
      now: 2_200
    })).toThrow(expect.objectContaining({ code: "FINISH_NOT_ALLOWED" }));
  });

  it("ignores affordable approved campaigns outside the frozen current-campaign cohort", () => {
    let prepared = readyRoom([10, 30, 30]);
    prepared = addTeam(prepared, 4);
    prepared = addApprovedCampaign(prepared, 4, 1);
    prepared = submitCampaign(prepared, {
      expectedRevision: prepared.revision,
      commandId: "publish-current-campaign-4",
      campaignId: "campaign-4-current",
      sellerTeamId: "team-4",
      productName: "Current Product 4",
      price: 1,
      artworkKey: prepared.campaigns["campaign-4"]!.artworkKey,
      now: 1_400
    });
    const opened = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market-excluding-old-approved",
      now: 1_500
    });
    expect(opened.marketCohort).toEqual({
      buyerTeamIds: ["team-1", "team-2", "team-3"],
      sellerTeamIds: ["team-1", "team-2", "team-3"],
      campaignIds: ["campaign-1", "campaign-2", "campaign-3"]
    });
    expect(() => purchaseCampaign(opened, {
      expectedRevision: opened.revision,
      buyerTeamId: "team-1",
      campaignId: "campaign-4",
      requestId: "request-excluded-approved",
      receiptId: "receipt-excluded-approved",
      now: 2_000
    })).toThrow(expect.objectContaining({ code: "CAMPAIGN_NOT_APPROVED" }));

    const afterTwo = buy(buy(opened, 1, 2, 1).state, 1, 3, 2).state;
    expect(finishTeam(afterTwo, {
      expectedRevision: afterTwo.revision,
      commandId: "finish-with-excluded-affordable-campaign",
      teamId: "team-1",
      now: 2_200
    }).finishedAtByTeamId["team-1"]).toBe(2_200);
  });

  it("runs a complete three-team market, recomputes revenue, and redacts student data", () => {
    const prepared = readyRoom();
    let state = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market",
      now: 1_500
    });
    let sequence = 1;
    for (let buyer = 1; buyer <= 3; buyer += 1) {
      for (let seller = 1; seller <= 3; seller += 1) {
        if (buyer === seller) continue;
        state = buy(state, buyer, seller, sequence++).state;
      }
      state = finishTeam(state, {
        expectedRevision: state.revision,
        commandId: `finish-team-${buyer}`,
        teamId: `team-${buyer}`,
        now: 2_100 + sequence
      });
    }
    state = openReveal(state, {
      expectedRevision: state.revision,
      commandId: "open-reveal",
      now: 2_500
    });

    expect(computeReveal(state).standings).toEqual([
      { rank: 1, teamId: "team-1", alias: "Pixel Pirates", revenue: 80, sales: 2 },
      { rank: 2, teamId: "team-2", alias: "Bright Bunch", revenue: 80, sales: 2 },
      { rank: 3, teamId: "team-3", alias: "Idea Owls", revenue: 80, sales: 2 }
    ]);

    const snapshot = studentMarketSnapshot(state, "team-1");
    expect(snapshot.own).toMatchObject({ wallet: 20, spent: 80, finished: true });
    expect(snapshot.teams.every((team) => !Object.hasOwn(team, "wallet"))).toBe(true);
    expect(snapshot.myPurchases).toHaveLength(2);
    expect(snapshot.myPurchases.every((receipt) =>
      !Object.hasOwn(receipt, "buyerTeamId") &&
      !Object.hasOwn(receipt, "requestId") &&
      !Object.hasOwn(receipt, "canonicalPayload")
    )).toBe(true);
    expect(Object.hasOwn(snapshot, "standings")).toBe(false);
    expect(Object.hasOwn(snapshot, "revenue")).toBe(false);

    state = closeMarket(state, {
      expectedRevision: state.revision,
      commandId: "close-market",
      now: 2_600
    });
    expect(state.phase).toBe("closed");
  });

  it("requires exactly the frozen buyers, excludes spectators from reveal, and shares readiness predicates", () => {
    let prepared = readyRoom();
    prepared = addTeam(prepared, 4);
    prepared = addPendingCampaign(prepared, 4, 10);
    let state = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market-with-spectator",
      now: 1_500
    });
    expect(canOpenMarket(state)).toMatchObject({ allowed: false, errorCode: "WRONG_PHASE" });
    expect(canOpenReveal(state)).toEqual({ allowed: false, errorCode: "REVEAL_NOT_READY" });
    expect(canCloseMarket(state)).toEqual({ allowed: false, errorCode: "WRONG_PHASE" });

    let sequence = 1;
    for (let buyer = 1; buyer <= 3; buyer += 1) {
      for (let seller = 1; seller <= 3; seller += 1) {
        if (buyer === seller) continue;
        state = buy(state, buyer, seller, sequence++).state;
      }
      state = finishTeam(state, {
        expectedRevision: state.revision,
        commandId: `finish-frozen-team-${buyer}`,
        teamId: `team-${buyer}`,
        now: 2_100 + sequence
      });
    }

    expect(canOpenReveal(state)).toEqual({ allowed: true, errorCode: null });
    state = openReveal(state, {
      expectedRevision: state.revision,
      commandId: "open-reveal-with-spectator",
      now: 2_500
    });
    expect(canCloseMarket(state)).toEqual({ allowed: true, errorCode: null });
    expect(computeReveal(state).standings.map(({ teamId }) => teamId))
      .toEqual(["team-1", "team-2", "team-3"]);
  });

  it("keeps asymmetric legacy live cohorts valid for shared readiness", () => {
    let prepared = readyRoom();
    prepared = addTeam(prepared, 4);
    const opened = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market-before-legacy-shape",
      now: 1_500
    });
    const legacyLive = MarketRoomSchema.parse({
      ...opened,
      marketCohort: {
        buyerTeamIds: ["team-1", "team-2", "team-3", "team-4"],
        sellerTeamIds: ["team-1", "team-2", "team-3"],
        campaignIds: ["campaign-1", "campaign-2", "campaign-3"]
      },
      finishedAtByTeamId: {
        "team-1": 2_100,
        "team-2": 2_101,
        "team-3": 2_102,
        "team-4": 2_103
      }
    });

    expect(canOpenReveal(legacyLive)).toEqual({ allowed: true, errorCode: null });
    expect(studentMarketSnapshot(legacyLive, "team-4").own.marketEligibility).toEqual({
      state: "frozen",
      role: "buyer",
      reason: "legacy-cohort"
    });
  });

  it("will not reveal until every team has finished", () => {
    const prepared = readyRoom();
    const opened = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market",
      now: 1_500
    });
    expect(() => openReveal(opened, {
      expectedRevision: opened.revision,
      commandId: "open-reveal",
      now: 2_500
    })).toThrow(expect.objectContaining({ code: "REVEAL_NOT_READY" }));
  });

  it("does not close or expose standings before reveal readiness", () => {
    const prepared = readyRoom();
    const opened = openMarket(prepared, {
      expectedRevision: prepared.revision,
      commandId: "open-market",
      now: 1_500
    });
    expect(() => closeMarket(opened, {
      expectedRevision: opened.revision,
      commandId: "close-market",
      now: 1_600
    })).toThrow(expect.objectContaining({ code: "WRONG_PHASE" }));
  });
});

it("exports a typed market error", () => {
  expect(new MarketStateError("WRONG_PHASE")).toMatchObject({
    name: "MarketStateError",
    code: "WRONG_PHASE"
  });
});
