import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  StudioCoachRequest,
  StudioCoachResponse
} from "../../../shared/studio-coach-contract";
import type { StudioCoachCanvasEvidence } from "./canvas-evidence";
import { StudioCoachRuntime } from "./studio-coach-runtime";

const campaign = {
  sessionId: "session-pair-7",
  teamId: "team-pair-7",
  documentId: "campaign-7",
  productName: "Orbit Tumbler",
  priceLabel: "$24.00",
  audienceNeed: "A reusable bottle for after school.",
  audienceValues: "Convenience and less waste.",
  intendedEffect: "Make it feel practical.",
  aidaStage: "attention"
} as const;

beforeEach(() => {
  globalThis.sessionStorage.clear();
});

function evidence(hash: string): StudioCoachCanvasEvidence {
  return {
    imageDataUrl: "data:image/jpeg;base64,/9j/2Q==",
    imageSha256: hash.repeat(64),
    width: 896,
    height: 504,
    objects: [{ id: "product", type: "product-shell", name: "Orbit Tumbler", zOrder: [0] }]
  };
}

const firstResponse: StudioCoachResponse = {
  turn: 1,
  mode: "technique",
  observation: "The line points away from the product.",
  effect: "The audience may leave the main reading path.",
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
  why: "The product is now on the strongest reading path.",
  evidenceRefs: ["product"],
  certainty: "clear"
};

describe("StudioCoachRuntime", () => {
  it("permits one recommendation and one changed-image comparison, then closes", async () => {
    const captures = [evidence("a"), evidence("b")];
    const capture = vi.fn(async () => captures.shift()!);
    const check = vi.fn(async (request: StudioCoachRequest) =>
      request.turn === 1 ? firstResponse : finalResponse);
    const runtime = new StudioCoachRuntime({
      client: { check },
      capture,
      createId: vi.fn().mockReturnValueOnce("check-one").mockReturnValueOnce("check-two")
    });
    runtime.setCampaign(campaign);

    await expect(runtime.requestInitial("technique", "leading-lines")).resolves.toEqual(firstResponse);
    expect(runtime.state()).toMatchObject({ phase: "advice", attemptsUsed: 1, changedSinceFirst: false });
    await expect(runtime.requestRevision()).rejects.toThrow("Change the advertisement first");
    expect(check).toHaveBeenCalledTimes(1);

    runtime.markCanvasChanged();
    await expect(runtime.requestRevision()).resolves.toEqual(finalResponse);
    expect(runtime.state()).toMatchObject({ phase: "complete", attemptsUsed: 2, changedSinceFirst: true });
    await expect(runtime.requestRevision()).rejects.toThrow("Studio Coach is complete");
    await expect(runtime.requestInitial("whole-ad")).rejects.toThrow("Studio Coach is complete");
    expect(check).toHaveBeenCalledTimes(2);

    const secondRequest = check.mock.calls[1]![0];
    expect(secondRequest).toMatchObject({
      turn: 2,
      mode: "revision",
      idempotencyKey: "check-two",
      previous: { imageSha256: "a".repeat(64) },
      current: { imageSha256: "b".repeat(64) }
    });
    expect(secondRequest).not.toHaveProperty("messages");
  });

  it("requires a current campaign and the selected technique for a technique check", async () => {
    const runtime = new StudioCoachRuntime({
      client: { check: vi.fn() },
      capture: vi.fn()
    });
    await expect(runtime.requestInitial("whole-ad")).rejects.toThrow(/campaign/i);
    runtime.setCampaign(campaign);
    await expect(runtime.requestInitial("technique")).rejects.toThrow(/technique/i);
  });

  it("aborts an in-flight request and clears responses when the campaign changes", async () => {
    let requestSignal: AbortSignal | undefined;
    const check = vi.fn((_request: StudioCoachRequest, options?: { signal?: AbortSignal }) => {
      requestSignal = options?.signal;
      return new Promise<StudioCoachResponse>((_resolve, reject) => {
        requestSignal?.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")));
      });
    });
    const runtime = new StudioCoachRuntime({ client: { check }, capture: vi.fn().mockResolvedValue(evidence("a")) });
    runtime.setCampaign(campaign);
    const pending = runtime.requestInitial("whole-ad");
    await vi.waitFor(() => expect(check).toHaveBeenCalledOnce());

    runtime.setCampaign({ ...campaign, documentId: "campaign-8" });

    expect(requestSignal?.aborted).toBe(true);
    await expect(pending).rejects.toThrow();
    expect(runtime.state()).toMatchObject({ phase: "ready", attemptsUsed: 0, first: null, final: null });
  });

  it("counts a failed provider request locally and never performs an automatic retry", async () => {
    const check = vi.fn().mockRejectedValue(new Error("offline"));
    const runtime = new StudioCoachRuntime({ client: { check }, capture: vi.fn().mockResolvedValue(evidence("a")) });
    runtime.setCampaign(campaign);

    await expect(runtime.requestInitial("whole-ad")).rejects.toThrow("offline");
    expect(runtime.state()).toMatchObject({ phase: "error", attemptsUsed: 1 });
    expect(check).toHaveBeenCalledOnce();

    const restored = new StudioCoachRuntime({
      client: { check: vi.fn().mockResolvedValue(firstResponse) },
      capture: vi.fn().mockResolvedValue(evidence("b")),
      createId: () => "check-two"
    });
    restored.setCampaign(campaign);
    expect(restored.state()).toMatchObject({
      phase: "error",
      attemptsUsed: 1,
      first: null,
      error: expect.stringMatching(/one final check remains/i)
    });
    await expect(restored.requestInitial("technique", "contrast")).resolves.toEqual(firstResponse);
    expect(restored.state()).toMatchObject({
      phase: "complete",
      attemptsUsed: 2,
      first: firstResponse,
      error: expect.stringMatching(/no comparison remains/i)
    });
  });

  it("replays the identical request after an ambiguous network outcome without consuming another provider turn", async () => {
    const ambiguous = Object.assign(new Error("The reply may still have completed."), { code: "TIMEOUT" });
    const check = vi.fn()
      .mockRejectedValueOnce(ambiguous)
      .mockResolvedValueOnce(firstResponse);
    const capture = vi.fn().mockResolvedValue(evidence("a"));
    const createId = vi.fn().mockReturnValue("check-one");
    const runtime = new StudioCoachRuntime({ client: { check }, capture, createId });
    runtime.setCampaign(campaign);

    await expect(runtime.requestInitial("technique", "leading-lines")).rejects.toBe(ambiguous);
    await expect(runtime.requestInitial("whole-ad")).resolves.toEqual(firstResponse);

    expect(createId).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenCalledOnce();
    expect(check).toHaveBeenCalledTimes(2);
    expect(check.mock.calls[1]![0]).toEqual(check.mock.calls[0]![0]);
    expect(runtime.state()).toMatchObject({ phase: "advice", attemptsUsed: 1, first: firstResponse });
  });

  it("persists an ambiguous first request before transmission and resumes it after reload", async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }
    };
    const ambiguous = Object.assign(new Error("The reply may still have completed."), { code: "TIMEOUT" });
    let sent: StudioCoachRequest | null = null;
    const firstRuntime = new StudioCoachRuntime({
      client: {
        check: vi.fn(async (request: StudioCoachRequest) => {
          sent = structuredClone(request);
          expect([...values.values()].some((value) => value.includes('"idempotencyKey":"check-one"'))).toBe(true);
          throw ambiguous;
        })
      },
      capture: vi.fn().mockResolvedValue(evidence("a")),
      createId: () => "check-one",
      storage
    });
    firstRuntime.setCampaign(campaign);
    await expect(firstRuntime.requestInitial("technique", "leading-lines")).rejects.toBe(ambiguous);

    const resumedCheck = vi.fn().mockResolvedValue(firstResponse);
    const resumedCapture = vi.fn();
    const resumedRuntime = new StudioCoachRuntime({
      client: { check: resumedCheck },
      capture: resumedCapture,
      createId: () => "must-not-create-another-id",
      storage
    });
    resumedRuntime.setCampaign(campaign);

    expect(resumedRuntime.state()).toMatchObject({ phase: "error", attemptsUsed: 1, first: null });
    await expect(resumedRuntime.requestInitial("whole-ad")).resolves.toEqual(firstResponse);
    expect(resumedCapture).not.toHaveBeenCalled();
    expect(resumedCheck).toHaveBeenCalledWith(sent, expect.anything());
    expect(resumedRuntime.state()).toMatchObject({ phase: "advice", attemptsUsed: 1, first: firstResponse });
  });

  it("persists and resumes the identical final comparison after an ambiguous outcome", async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }
    };
    const ambiguous = Object.assign(new Error("The reply may still have completed."), { code: "NETWORK_ERROR" });
    let sentRevision: StudioCoachRequest | null = null;
    const firstRuntime = new StudioCoachRuntime({
      client: {
        check: vi.fn(async (request: StudioCoachRequest) => {
          if (request.turn === 1) return firstResponse;
          sentRevision = structuredClone(request);
          throw ambiguous;
        })
      },
      capture: vi.fn()
        .mockResolvedValueOnce(evidence("a"))
        .mockResolvedValueOnce(evidence("b")),
      createId: vi.fn().mockReturnValueOnce("check-one").mockReturnValueOnce("check-two"),
      storage
    });
    firstRuntime.setCampaign(campaign);
    await firstRuntime.requestInitial("technique", "leading-lines");
    firstRuntime.markCanvasChanged();
    await expect(firstRuntime.requestRevision()).rejects.toBe(ambiguous);

    const resumedCheck = vi.fn().mockResolvedValue(finalResponse);
    const resumedCapture = vi.fn();
    const resumedRuntime = new StudioCoachRuntime({
      client: { check: resumedCheck },
      capture: resumedCapture,
      createId: () => "must-not-create-another-id",
      storage
    });
    resumedRuntime.setCampaign(campaign);

    expect(resumedRuntime.state()).toMatchObject({ phase: "error", attemptsUsed: 2, first: firstResponse });
    await expect(resumedRuntime.requestRevision()).resolves.toEqual(finalResponse);
    expect(resumedCapture).not.toHaveBeenCalled();
    expect(resumedCheck).toHaveBeenCalledWith(sentRevision, expect.anything());
    expect(resumedRuntime.state()).toMatchObject({ phase: "complete", attemptsUsed: 2, final: finalResponse });
  });

  it("labels a response as earlier-version evidence when the canvas changes during the check", async () => {
    let resolveCheck!: (response: StudioCoachResponse) => void;
    const check = vi.fn(() => new Promise<StudioCoachResponse>((resolve) => { resolveCheck = resolve; }));
    const runtime = new StudioCoachRuntime({
      client: { check },
      capture: vi.fn().mockResolvedValue(evidence("a")),
      createId: () => "check-one"
    });
    runtime.setCampaign(campaign);
    const pending = runtime.requestInitial("technique", "leading-lines");
    await vi.waitFor(() => expect(check).toHaveBeenCalledOnce());

    runtime.markCanvasChanged();
    resolveCheck(firstResponse);
    await expect(pending).resolves.toEqual(firstResponse);

    expect(runtime.state()).toMatchObject({
      phase: "advice",
      attemptsUsed: 1,
      changedSinceFirst: true,
      first: firstResponse,
      error: expect.stringMatching(/earlier version/i)
    });
  });

  it("updates current campaign facts without resetting an active two-check session", async () => {
    const check = vi.fn().mockResolvedValue(firstResponse);
    const runtime = new StudioCoachRuntime({ client: { check }, capture: vi.fn().mockResolvedValue(evidence("a")) });
    runtime.setCampaign(campaign);
    await runtime.requestInitial("technique", "contrast");

    runtime.updateCampaign({ ...campaign, priceLabel: "$29.00", aidaStage: "interest" });

    expect(runtime.state()).toMatchObject({ phase: "advice", attemptsUsed: 1, first: firstResponse });
  });

  it("restores the first response and before image after a same-tab reload", async () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); }
    };
    const firstRuntime = new StudioCoachRuntime({
      client: { check: vi.fn().mockResolvedValue(firstResponse) },
      capture: vi.fn().mockResolvedValue(evidence("a")),
      createId: () => "check-one",
      storage
    });
    firstRuntime.setCampaign(campaign);
    await firstRuntime.requestInitial("technique", "leading-lines");

    const revisionCheck = vi.fn().mockResolvedValue(finalResponse);
    const restoredRuntime = new StudioCoachRuntime({
      client: { check: revisionCheck },
      capture: vi.fn().mockResolvedValue(evidence("b")),
      createId: () => "check-two",
      storage
    });
    restoredRuntime.setCampaign(campaign);

    expect(restoredRuntime.state()).toMatchObject({
      phase: "advice",
      attemptsUsed: 1,
      first: firstResponse
    });
    restoredRuntime.markCanvasChanged();
    await expect(restoredRuntime.requestRevision()).resolves.toEqual(finalResponse);
    expect(revisionCheck.mock.calls[0]![0]).toMatchObject({
      previous: { imageSha256: "a".repeat(64) },
      current: { imageSha256: "b".repeat(64) }
    });
  });

  it("keeps same-tab recovery compatible with the earlier version-one snapshot", () => {
    const values = new Map<string, string>();
    const key = `ad-market:studio-coach:v1:${[campaign.sessionId, campaign.teamId, campaign.documentId]
      .map((part) => encodeURIComponent(part)).join(":")}`;
    values.set(key, JSON.stringify({
      version: 1,
      attemptsUsed: 1,
      first: firstResponse,
      final: null,
      firstEvidence: evidence("a")
    }));
    const runtime = new StudioCoachRuntime({
      client: { check: vi.fn() },
      capture: vi.fn(),
      storage: {
        getItem: (itemKey: string) => values.get(itemKey) ?? null,
        setItem: (itemKey: string, value: string) => { values.set(itemKey, value); }
      }
    });

    runtime.setCampaign(campaign);

    expect(runtime.state()).toMatchObject({ phase: "advice", attemptsUsed: 1, first: firstResponse });
  });
});
