import { describe, expect, it } from "vitest";
import {
  ImageLabStateError,
  ImageLabStateService,
  MemoryImageLabStateRepository
} from "./image-lab-state";

const pair = { sessionId: "session-a", teamId: "pair-3" };
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
  it("does not reset a pair's allowance when the teacher unlock is replayed", async () => {
    const state = service();
    await state.unlock(pair, { objectAllowance: 2, realiseAllowance: 1, expiresAt: 2_000 });
    await state.reserve(pair, job("123e4567-e89b-42d3-a456-426614174000"));

    await expect(state.unlock(pair, {
      objectAllowance: 12,
      realiseAllowance: 4,
      expiresAt: 2_500
    })).resolves.toEqual({ object: 1, realise: 1, expiresAt: 2_500 });
  });

  it("atomically returns one job and spends one spark for concurrent identical requests", async () => {
    const state = service();
    await state.unlock(pair, { objectAllowance: 2, realiseAllowance: 1, expiresAt: 2_000 });
    const input = job("123e4567-e89b-42d3-a456-426614174000");

    const results = await Promise.all([state.reserve(pair, input), state.reserve(pair, input)]);

    expect(results.filter(({ created }) => created)).toHaveLength(1);
    expect(results.map(({ job: stored }) => stored.id)).toEqual([input.idempotencyKey, input.idempotencyKey]);
    expect(results.every(({ object }) => object === 1)).toBe(true);
  });

  it("allows only one of two concurrent jobs to spend the final spark", async () => {
    const state = service();
    await state.unlock(pair, { objectAllowance: 1, realiseAllowance: 1, expiresAt: 2_000 });

    const outcomes = await Promise.allSettled([
      state.reserve(pair, job("123e4567-e89b-42d3-a456-426614174000")),
      state.reserve(pair, job("223e4567-e89b-42d3-a456-426614174000", "b".repeat(64)))
    ]);

    expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find(({ status }) => status === "rejected");
    expect(rejected).toMatchObject({ reason: expect.objectContaining({ code: "ALLOWANCE_EXHAUSTED" }) });
  });

  it("rejects an idempotency key reused for different input", async () => {
    const state = service();
    await state.unlock(pair, { objectAllowance: 2, realiseAllowance: 1, expiresAt: 2_000 });
    const id = "123e4567-e89b-42d3-a456-426614174000";
    await state.reserve(pair, job(id));

    await expect(state.reserve(pair, job(id, "b".repeat(64))))
      .rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });

  it("keeps an ambiguous dispatch indeterminate and never turns replay into a new job", async () => {
    const state = service();
    await state.unlock(pair, { objectAllowance: 2, realiseAllowance: 1, expiresAt: 2_000 });
    const input = job("123e4567-e89b-42d3-a456-426614174000");
    await state.reserve(pair, input);
    await state.markIndeterminate(pair, input.idempotencyKey);

    await expect(state.reserve(pair, input)).resolves.toMatchObject({
      created: false,
      object: 1,
      job: { state: "indeterminate" }
    });
  });

  it("binds the upstream request only once", async () => {
    const state = service();
    await state.unlock(pair, { objectAllowance: 2, realiseAllowance: 1, expiresAt: 2_000 });
    const input = job("123e4567-e89b-42d3-a456-426614174000");
    await state.reserve(pair, input);
    await expect(state.attachRequest(
      pair,
      input.idempotencyKey,
      "323e4567-e89b-42d3-a456-426614174000"
    )).resolves.toMatchObject({ state: "submitted" });
    await expect(state.attachRequest(
      pair,
      input.idempotencyKey,
      "423e4567-e89b-42d3-a456-426614174000"
    )).rejects.toBeInstanceOf(ImageLabStateError);
  });
});
