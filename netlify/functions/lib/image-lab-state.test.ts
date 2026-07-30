import { describe, expect, it } from "vitest";
import {
  ImageLabStateError,
  ImageLabStateService,
  MemoryImageLabStateRepository
} from "./image-lab-state";

const accountA = { userId: "123e4567-e89b-42d3-a456-426614174000" };
const accountB = { userId: "223e4567-e89b-42d3-a456-426614174000" };
const job = (idempotencyKey: string, requestHash = "a".repeat(64)) => ({
  idempotencyKey,
  requestHash,
  stage: "object-forge" as const,
  profileId: "object-forge-v1",
  nowSeconds: 1_000
});

function service(): ImageLabStateService {
  return new ImageLabStateService(new MemoryImageLabStateRepository());
}

describe("ImageLabStateService", () => {
  it("atomically creates one account-bound job for concurrent identical requests", async () => {
    const state = service();
    const input = job("323e4567-e89b-42d3-a456-426614174000");

    const results = await Promise.all([
      state.reserve(accountA, input),
      state.reserve(accountA, input)
    ]);

    expect(results.filter(({ created }) => created)).toHaveLength(1);
    expect(results.every(({ stored }) =>
      stored.id === input.idempotencyKey && stored.state === "reserving"
    )).toBe(true);
  });

  it("keeps identical idempotency keys isolated between pair accounts", async () => {
    const state = service();
    const input = job("323e4567-e89b-42d3-a456-426614174000");

    const [first, second] = await Promise.all([
      state.reserve(accountA, input),
      state.reserve(accountB, input)
    ]);

    expect(first.created).toBe(true);
    expect(second.created).toBe(true);
  });

  it("rejects an idempotency key reused for different input", async () => {
    const state = service();
    const id = "323e4567-e89b-42d3-a456-426614174000";
    await state.reserve(accountA, job(id));

    await expect(state.reserve(accountA, job(id, "b".repeat(64))))
      .rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("allows exactly one submitter after the ledger reservation is recorded", async () => {
    const state = service();
    const id = "323e4567-e89b-42d3-a456-426614174000";
    await state.reserve(accountA, job(id));
    await state.markReserved(accountA, id);

    const results = await Promise.all([
      state.beginSubmission(accountA, id),
      state.beginSubmission(accountA, id)
    ]);

    expect(results.filter(({ began }) => began)).toHaveLength(1);
    expect(results.every(({ stored }) => stored.state === "submitting")).toBe(true);
  });

  it("binds one upstream request and preserves it through an uncertain outcome", async () => {
    const state = service();
    const id = "323e4567-e89b-42d3-a456-426614174000";
    const requestId = "423e4567-e89b-42d3-a456-426614174000";
    await state.reserve(accountA, job(id));
    await state.markReserved(accountA, id);
    await state.beginSubmission(accountA, id);

    await expect(state.attachRequest(accountA, id, requestId))
      .resolves.toMatchObject({ state: "submitted", requestId });
    await expect(state.markUncertain(accountA, id))
      .resolves.toMatchObject({ state: "uncertain", requestId });
    await expect(state.reserve(accountA, job(id)))
      .resolves.toMatchObject({
        created: false,
        stored: { state: "uncertain", requestId }
      });
  });

  it("records an upstream request when attaching it becomes uncertain", async () => {
    const state = service();
    const id = "323e4567-e89b-42d3-a456-426614174000";
    const requestId = "423e4567-e89b-42d3-a456-426614174000";
    await state.reserve(accountA, job(id));
    await state.markReserved(accountA, id);
    await state.beginSubmission(accountA, id);

    await expect(state.markUncertain(accountA, id, requestId))
      .resolves.toMatchObject({ state: "uncertain", requestId });
  });

  it("makes terminal settlement idempotent and refuses reversal", async () => {
    const state = service();
    const id = "323e4567-e89b-42d3-a456-426614174000";
    await state.reserve(accountA, job(id));
    await state.markReserved(accountA, id);
    await state.beginSubmission(accountA, id);
    await state.attachRequest(accountA, id, "423e4567-e89b-42d3-a456-426614174000");

    await expect(state.markCompleted(accountA, id))
      .resolves.toMatchObject({ state: "completed" });
    await expect(state.markCompleted(accountA, id))
      .resolves.toMatchObject({ state: "completed" });
    await expect(state.markRefunded(accountA, id))
      .rejects.toBeInstanceOf(ImageLabStateError);
  });

  it("records allowance denial without opening a submit race", async () => {
    const state = service();
    const id = "323e4567-e89b-42d3-a456-426614174000";
    await state.reserve(accountA, job(id));

    await expect(state.markDenied(accountA, id))
      .resolves.toMatchObject({ state: "denied" });
    await expect(state.beginSubmission(accountA, id))
      .resolves.toMatchObject({ began: false, stored: { state: "denied" } });
  });
});
