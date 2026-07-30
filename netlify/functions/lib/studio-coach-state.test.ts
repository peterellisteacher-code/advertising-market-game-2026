import { describe, expect, it } from "vitest";
import type { StudioCoachResponse } from "../../../shared/studio-coach-contract";
import {
  MemoryStudioCoachStateRepository,
  StudioCoachStateError,
  StudioCoachStateService
} from "./studio-coach-state";

const identity = { sessionId: "session-pair-7", teamId: "team-pair-7" };
const campaignId = "campaign-7";
const firstInput = {
  idempotencyKey: "check-one",
  requestHash: "1".repeat(64),
  turn: 1 as const,
  mode: "technique" as const,
  currentImageHash: "a".repeat(64),
  nowSeconds: 1_000
};
const secondInput = {
  idempotencyKey: "check-two",
  requestHash: "2".repeat(64),
  turn: 2 as const,
  mode: "revision" as const,
  previousImageHash: "a".repeat(64),
  currentImageHash: "b".repeat(64),
  nowSeconds: 1_001
};
const firstResponse: StudioCoachResponse = {
  turn: 1,
  mode: "technique",
  observation: "The line points away from the product.",
  effect: "The eye leaves the main reading path.",
  nextMove: "Angle the existing line towards the product.",
  selfCheck: "Does your eye reach the product first?",
  evidenceRefs: ["product"],
  certainty: "clear"
};
const finalResponse: StudioCoachResponse = {
  turn: 2,
  mode: "revision",
  verdict: "clearer",
  whatChanged: "The line now points towards the product.",
  why: "The product is now the first reading point.",
  evidenceRefs: ["product"],
  certainty: "clear"
};

function service(): StudioCoachStateService {
  return new StudioCoachStateService(new MemoryStudioCoachStateRepository());
}

describe("StudioCoachStateService", () => {
  it("reserves exactly two provider attempts and replays completed idempotent requests", async () => {
    const state = service();
    const first = await state.reserve(identity, campaignId, firstInput);
    expect(first.created).toBe(true);
    await state.complete(identity, campaignId, firstInput.idempotencyKey, firstResponse);

    const replay = await state.reserve(identity, campaignId, firstInput);
    expect(replay).toMatchObject({ created: false, attempt: { state: "complete", response: firstResponse } });

    expect((await state.reserve(identity, campaignId, secondInput)).created).toBe(true);
    await state.complete(identity, campaignId, secondInput.idempotencyKey, finalResponse);

    await expect(state.reserve(identity, campaignId, {
      ...secondInput,
      idempotencyKey: "check-three",
      requestHash: "3".repeat(64),
      currentImageHash: "c".repeat(64)
    })).rejects.toMatchObject({ code: "TURN_LIMIT_REACHED" });
  });

  it("does not allow a different request while an attempt is in progress", async () => {
    const state = service();
    await state.reserve(identity, campaignId, firstInput);
    await expect(state.reserve(identity, campaignId, {
      ...firstInput,
      idempotencyKey: "other-check",
      requestHash: "9".repeat(64)
    })).rejects.toMatchObject({ code: "CHECK_IN_PROGRESS" });
  });

  it("expires an orphaned reservation without consuming either completed check", async () => {
    const state = service();
    await state.reserve(identity, campaignId, firstInput);
    await expect(state.reserve(identity, campaignId, {
      ...firstInput,
      idempotencyKey: "too-soon",
      requestHash: "8".repeat(64),
      nowSeconds: 1_029
    })).rejects.toMatchObject({ code: "CHECK_IN_PROGRESS" });

    const finalAttempt = {
      ...firstInput,
      idempotencyKey: "after-lease",
      requestHash: "7".repeat(64),
      nowSeconds: 1_030
    };
    expect((await state.reserve(identity, campaignId, finalAttempt)).created).toBe(true);
    await state.complete(identity, campaignId, finalAttempt.idempotencyKey, firstResponse);
    expect((await state.reserve(identity, campaignId, {
      ...secondInput,
      idempotencyKey: "revision-after-expiry",
      requestHash: "6".repeat(64),
      nowSeconds: 1_031
    })).created).toBe(true);
  });

  it("binds the two-attempt budget to the authenticated pair instead of a client-minted document ID", async () => {
    const state = service();
    await state.reserve(identity, campaignId, firstInput);
    await state.complete(identity, campaignId, firstInput.idempotencyKey, firstResponse);
    await state.reserve(identity, campaignId, secondInput);
    await state.complete(identity, campaignId, secondInput.idempotencyKey, finalResponse);

    await expect(state.reserve(identity, "invented-document-id", {
      ...firstInput,
      idempotencyKey: "new-document-check",
      requestHash: "5".repeat(64)
    })).rejects.toMatchObject({ code: "TURN_LIMIT_REACHED" });
  });

  it("removes failed reservations so only completed checks consume the budget", async () => {
    const state = service();
    await state.reserve(identity, campaignId, firstInput);
    await state.fail(identity, campaignId, firstInput.idempotencyKey, "UPSTREAM_FAILED");
    const retry = {
      ...firstInput,
      idempotencyKey: "check-two",
      requestHash: "2".repeat(64),
      nowSeconds: 1_001
    };
    expect((await state.reserve(identity, campaignId, retry)).created).toBe(true);
    await state.complete(identity, campaignId, retry.idempotencyKey, firstResponse);
    expect((await state.reserve(identity, campaignId, {
      ...secondInput,
      idempotencyKey: "check-three",
      requestHash: "3".repeat(64),
      nowSeconds: 1_002
    })).created).toBe(true);
    await state.complete(identity, campaignId, "check-three", finalResponse);
    await expect(state.reserve(identity, campaignId, {
      ...secondInput,
      idempotencyKey: "check-four",
      requestHash: "4".repeat(64),
      currentImageHash: "c".repeat(64),
      nowSeconds: 1_003
    })).rejects.toMatchObject({ code: "TURN_LIMIT_REACHED" });
  });

  it("requires the stored first image and a changed image for the revision", async () => {
    const state = service();
    await state.reserve(identity, campaignId, firstInput);
    await state.complete(identity, campaignId, firstInput.idempotencyKey, firstResponse);

    await expect(state.reserve(identity, campaignId, {
      ...secondInput,
      previousImageHash: "f".repeat(64)
    })).rejects.toMatchObject({ code: "REVISION_MISMATCH" });
    await expect(state.reserve(identity, campaignId, {
      ...secondInput,
      currentImageHash: secondInput.previousImageHash
    })).rejects.toMatchObject({ code: "REVISION_UNCHANGED" });
  });

  it("rejects idempotency reuse with a different request", async () => {
    const state = service();
    await state.reserve(identity, campaignId, firstInput);
    await expect(state.reserve(identity, campaignId, {
      ...firstInput,
      requestHash: "f".repeat(64)
    })).rejects.toBeInstanceOf(StudioCoachStateError);
    await expect(state.reserve(identity, campaignId, {
      ...firstInput,
      requestHash: "f".repeat(64)
    })).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
});
