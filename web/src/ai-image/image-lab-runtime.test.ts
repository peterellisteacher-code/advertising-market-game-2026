import { describe, expect, it, vi } from "vitest";
import type { GeneratedRasterPlacement } from "../catalogue/catalogue-runtime";
import {
  ImageLabRuntime,
  type ImageLabRuntimeClient,
  type ImageLabSubmissionPersistence
} from "./image-lab-runtime";

function client(overrides: Partial<ImageLabRuntimeClient> = {}): ImageLabRuntimeClient {
  return {
    status: vi.fn().mockResolvedValue({
      enabled: true,
      object: { remaining: 6, reserved: 0 },
      realise: { remaining: 2, reserved: 0 }
    }),
    createJob: vi.fn().mockResolvedValue({
      jobToken: "opaque-job-token",
      stage: "object",
      remaining: { object: 5, realise: 2 }
    }),
    pollJob: vi.fn().mockResolvedValue({ status: "completed" }),
    reconcile: vi.fn().mockResolvedValue({ status: "completed" }),
    getAsset: vi.fn().mockResolvedValue(new Blob([Uint8Array.of(0x89, 0x50, 0x4e, 0x47)], {
      type: "image/png"
    })),
    ...overrides
  };
}

const objectChoice = {
  sessionId: "session-a",
  teamId: "team-a",
  objectName: "lamp",
  category: "home and garden",
  style: "clean 3D cutout",
  colour: "yellow",
  removeWhiteBackground: true
};

const preparedObject = () => ({
  blob: new Blob([Uint8Array.of(1, 2, 3)], { type: "image/png" }),
  dataUrl: "data:image/png;base64,AQID",
  width: 512,
  height: 512
});

describe("ImageLabRuntime", () => {
  it("loads fresh account status and restarts an aborted first lookup", async () => {
    const calls: AbortSignal[] = [];
    const status = vi.fn().mockImplementation(({ signal }: { signal?: AbortSignal }) => {
      if (!signal) throw new Error("Expected a config signal");
      calls.push(signal);
      if (calls.length > 1) {
        return Promise.resolve({
          enabled: true,
          object: { remaining: 6, reserved: 1 },
          realise: { remaining: 2, reserved: 0 }
        });
      }
      return new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")), {
          once: true
        });
      });
    });
    const runtime = new ImageLabRuntime({
      client: client({ status }),
      exportDesign: vi.fn(),
      place: vi.fn(),
      prepare: vi.fn(),
      isCurrentPair: () => true
    });
    const first = new AbortController();
    const initial = runtime.status(first.signal);
    first.abort();
    await expect(initial).rejects.toThrow("cancelled");

    await expect(runtime.status(new AbortController().signal)).resolves.toMatchObject({
      enabled: true,
      object: { remaining: 6, reserved: 1 }
    });
    await expect(runtime.status(new AbortController().signal)).resolves.toMatchObject({
      enabled: true,
      object: { remaining: 6, reserved: 1 }
    });
    expect(status).toHaveBeenCalledTimes(3);
  });

  it("forges, removes white, and places owned pixels without browser model controls", async () => {
    const api = client({
      status: vi.fn().mockResolvedValue({
        enabled: true,
        object: { remaining: 5, reserved: 0 },
        realise: { remaining: 2, reserved: 0 }
      })
    });
    const prepared = new Blob([Uint8Array.of(1, 2, 3)], { type: "image/png" });
    const prepare = vi.fn().mockResolvedValue({
      blob: prepared,
      dataUrl: "data:image/png;base64,AQID",
      width: 512,
      height: 512
    });
    const placed: GeneratedRasterPlacement[] = [];
    const runtime = new ImageLabRuntime({
      client: api,
      exportDesign: vi.fn(),
      place: vi.fn(async (_pair, input) => { placed.push(input); }),
      prepare,
      createId: () => "generation-object-1",
      isCurrentPair: () => true
    });

    const result = await runtime.forgeObject({
      sessionId: "session-a",
      teamId: "team-a",
      objectName: "curved drink bottle",
      category: "drink packaging",
      style: "clean 3D cutout",
      colour: "electric blue",
      removeWhiteBackground: true
    }, new AbortController().signal);

    expect(api.createJob).toHaveBeenCalledWith({
      stage: "object",
      idempotencyKey: "generation-object-1",
      objectName: "curved drink bottle",
      category: "drink packaging",
      style: "clean 3D cutout",
      colour: "electric blue"
    }, { signal: expect.any(AbortSignal) });
    expect(api.pollJob).toHaveBeenCalledWith("opaque-job-token", {
      signal: expect.any(AbortSignal),
      maxAttempts: 60,
      intervalMs: 2_000
    });
    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/png;base64,/),
      "object-forge", { removeWhiteBackground: true });
    expect(placed).toEqual([expect.objectContaining({
      assetId: "ai-generation-object-1",
      title: "Curved drink bottle",
      blob: prepared,
      stage: "object-forge",
      profileId: "object-forge-v1",
      requestId: "generation-object-1"
    })]);
    expect(result).toEqual({
      enabled: true,
      object: { remaining: 5, reserved: 0 },
      realise: { remaining: 2, reserved: 0 }
    });
    expect(api.status).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
  });

  it("sends an exact canvas reference through Make It Real and places the showcase separately", async () => {
    const api = client({
      createJob: vi.fn().mockResolvedValue({
        jobToken: "opaque-realise-token",
        stage: "realise",
        remaining: { object: 6, realise: 1 }
      })
    });
    const exported = "data:image/png;base64,iVBORw0KGgo=";
    const preparedReference = "data:image/png;base64,cmVmZXJlbmNl";
    const prepare = vi.fn().mockResolvedValue({
      blob: new Blob(["reference"], { type: "image/png" }),
      dataUrl: preparedReference,
      width: 1024,
      height: 576
    });
    const exportDesign = vi.fn(() => exported);
    const place = vi.fn().mockResolvedValue(undefined);
    const runtime = new ImageLabRuntime({
      client: api,
      exportDesign,
      place,
      prepare,
      createId: () => "generation-real-1",
      isCurrentPair: () => true
    });

    await runtime.makeReal({
      sessionId: "session-a",
      teamId: "team-a",
      productKind: "Fizz Finch bottle",
      scene: "bright shop shelf"
    }, new AbortController().signal);

    expect(prepare).toHaveBeenCalledWith(exported, "make-it-real", {
      removeWhiteBackground: false
    });
    expect(exportDesign).toHaveBeenCalledWith({ sessionId: "session-a", teamId: "team-a" });
    expect(api.createJob).toHaveBeenCalledWith(expect.objectContaining({
      stage: "realise",
      idempotencyKey: "generation-real-1",
      designDataUrl: preparedReference,
      productKind: "Fizz Finch bottle",
      scene: "bright shop shelf"
    }), { signal: expect.any(AbortSignal) });
    expect(api.createJob).toHaveBeenCalledWith(expect.not.objectContaining({
      sessionId: expect.anything(),
      teamId: expect.anything()
    }), expect.anything());
    expect(place).toHaveBeenCalledWith(
      { sessionId: "session-a", teamId: "team-a" },
      expect.objectContaining({
        stage: "make-it-real",
        profileId: "make-it-real-v1",
        requestId: "generation-real-1"
      })
    );
  });

  it("does not fetch or place a failed generation", async () => {
    const api = client({ pollJob: vi.fn().mockResolvedValue({ status: "failed" }) });
    const place = vi.fn();
    const runtime = new ImageLabRuntime({
      client: api,
      exportDesign: vi.fn(),
      place,
      prepare: vi.fn(),
      createId: () => "generation-failed",
      isCurrentPair: () => true
    });

    await expect(runtime.forgeObject({
      sessionId: "session-a",
      teamId: "team-a",
      objectName: "lamp",
      category: "home and garden",
      style: "clean 3D cutout",
      colour: "yellow",
      removeWhiteBackground: true
    }, new AbortController().signal)).rejects.toThrow("failed");
    expect(api.getAsset).not.toHaveBeenCalled();
    expect(place).not.toHaveBeenCalled();
  });

  it("stops immediately after job creation when the operation was cancelled", async () => {
    const controller = new AbortController();
    const api = client({
      createJob: vi.fn().mockImplementation(async () => {
        controller.abort();
        return {
          jobToken: "possibly-created-job",
          stage: "object" as const,
          remaining: { object: 5, realise: 2 }
        };
      })
    });
    const runtime = new ImageLabRuntime({
      client: api,
      exportDesign: vi.fn(),
      place: vi.fn(),
      prepare: vi.fn(),
      isCurrentPair: () => true
    });

    await expect(runtime.forgeObject(objectChoice, controller.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(api.pollJob).not.toHaveBeenCalled();
  });

  it("stops after polling when cancellation arrives with the terminal status", async () => {
    const controller = new AbortController();
    const api = client({
      pollJob: vi.fn().mockImplementation(async () => {
        controller.abort();
        return { status: "completed" as const };
      })
    });
    const runtime = new ImageLabRuntime({
      client: api,
      exportDesign: vi.fn(),
      place: vi.fn(),
      prepare: vi.fn(),
      isCurrentPair: () => true
    });

    await expect(runtime.forgeObject(objectChoice, controller.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(api.getAsset).not.toHaveBeenCalled();
  });

  it("stops after asset download when cancellation arrives with the image", async () => {
    const controller = new AbortController();
    const asset = new Blob([Uint8Array.of(0x89, 0x50, 0x4e, 0x47)], { type: "image/png" });
    const arrayBuffer = vi.spyOn(asset, "arrayBuffer");
    const api = client({
      getAsset: vi.fn().mockImplementation(async () => {
        controller.abort();
        return asset;
      })
    });
    const prepare = vi.fn();
    const runtime = new ImageLabRuntime({
      client: api,
      exportDesign: vi.fn(),
      place: vi.fn(),
      prepare,
      isCurrentPair: () => true
    });

    await expect(runtime.forgeObject(objectChoice, controller.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });

  it("stops after image byte conversion when cancellation arrives with the bytes", async () => {
    const controller = new AbortController();
    const asset = new Blob([Uint8Array.of(0x89, 0x50, 0x4e, 0x47)], { type: "image/png" });
    vi.spyOn(asset, "arrayBuffer").mockImplementation(async () => {
      controller.abort();
      return Uint8Array.of(0x89, 0x50, 0x4e, 0x47).buffer;
    });
    const prepare = vi.fn();
    const runtime = new ImageLabRuntime({
      client: client({ getAsset: vi.fn().mockResolvedValue(asset) }),
      exportDesign: vi.fn(),
      place: vi.fn(),
      prepare,
      isCurrentPair: () => true
    });

    await expect(runtime.forgeObject(objectChoice, controller.signal))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(prepare).not.toHaveBeenCalled();
  });

  it.each(["cancelled", "stale"] as const)(
    "does not place pixels when preparation finishes for a %s operation",
    async (reason) => {
      const controller = new AbortController();
      let current = true;
      const prepare = vi.fn().mockImplementation(async () => {
        if (reason === "cancelled") controller.abort();
        else current = false;
        return preparedObject();
      });
      const place = vi.fn();
      const runtime = new ImageLabRuntime({
        client: client(),
        exportDesign: vi.fn(),
        place,
        prepare,
        isCurrentPair: () => current
      });

      await expect(runtime.forgeObject(objectChoice, controller.signal))
        .rejects.toMatchObject({ name: "AbortError" });
      expect(place).not.toHaveBeenCalled();
    }
  );

  it("stops Make It Real after an export that completed during cancellation", async () => {
    const controller = new AbortController();
    const prepare = vi.fn();
    const api = client();
    const runtime = new ImageLabRuntime({
      client: api,
      exportDesign: vi.fn(async () => {
        controller.abort();
        return "data:image/png;base64,iVBORw0KGgo=";
      }),
      place: vi.fn(),
      prepare,
      isCurrentPair: () => true
    });

    await expect(runtime.makeReal({
      sessionId: "session-a",
      teamId: "team-a",
      productKind: "lamp",
      scene: "clean studio display"
    }, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(prepare).not.toHaveBeenCalled();
    expect(api.createJob).not.toHaveBeenCalled();
  });

  it("reuses the persisted submission key when job creation may already have reached the server", async () => {
    const pending = new Map<string, string>();
    const persistence: ImageLabSubmissionPersistence = {
      load: vi.fn(async (fingerprint) => pending.get(fingerprint) ?? null),
      store: vi.fn(async (fingerprint, idempotencyKey) => { pending.set(fingerprint, idempotencyKey); }),
      remove: vi.fn(async (fingerprint) => { pending.delete(fingerprint); })
    };
    const createJob = vi.fn()
      .mockRejectedValueOnce(new Error("connection lost after submit"))
      .mockResolvedValueOnce({
        jobToken: "resumed-job",
        stage: "object" as const,
        remaining: { object: 5, realise: 2 }
      });
    let nextId = 0;
    const createId = vi.fn(() =>
      `00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`);
    const dependencies = {
      client: client({ createJob }),
      exportDesign: vi.fn(),
      place: vi.fn().mockResolvedValue(undefined),
      prepare: vi.fn().mockResolvedValue(preparedObject()),
      createId,
      isCurrentPair: () => true,
      submissionPersistence: persistence
    };
    const firstRuntime = new ImageLabRuntime(dependencies);

    await expect(firstRuntime.forgeObject(objectChoice, new AbortController().signal))
      .rejects.toMatchObject({ code: "JOB_OUTCOME_UNCERTAIN" });
    const reloadedRuntime = new ImageLabRuntime(dependencies);
    await reloadedRuntime.forgeObject(objectChoice, new AbortController().signal);

    const requests = createJob.mock.calls.map(([request]) => request as { idempotencyKey: string });
    expect(requests).toHaveLength(2);
    expect(requests[0]?.idempotencyKey).toBe(requests[1]?.idempotencyKey);
    expect(createId).toHaveBeenCalledOnce();
    expect(persistence.store).toHaveBeenCalledOnce();
    expect(persistence.remove).toHaveBeenCalledOnce();
    const fingerprint = vi.mocked(persistence.store).mock.calls[0]?.[0];
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint).not.toContain(objectChoice.objectName);
    expect(pending.size).toBe(0);
    expect(dependencies.client.reconcile).toHaveBeenCalledWith("resumed-job", {
      signal: expect.any(AbortSignal)
    });
    expect(dependencies.client.pollJob).not.toHaveBeenCalled();
  });

  it("keeps an unknown job pending and reconciles it without a second provider submission", async () => {
    const pending = new Map<string, string>();
    const persistence: ImageLabSubmissionPersistence = {
      load: async (fingerprint) => pending.get(fingerprint) ?? null,
      store: async (fingerprint, idempotencyKey) => { pending.set(fingerprint, idempotencyKey); },
      remove: async (fingerprint) => { pending.delete(fingerprint); }
    };
    const createJob = vi.fn().mockResolvedValue({
      jobToken: "uncertain-job",
      stage: "object" as const,
      remaining: { object: 5, realise: 2 }
    });
    const pollJob = vi.fn().mockResolvedValue({ status: "unknown" });
    const reconcile = vi.fn().mockResolvedValue({ status: "completed" });
    const runtime = new ImageLabRuntime({
      client: client({ createJob, pollJob, reconcile }),
      exportDesign: vi.fn(),
      place: vi.fn().mockResolvedValue(undefined),
      prepare: vi.fn().mockResolvedValue(preparedObject()),
      createId: () => "00000000-0000-4000-8000-000000000001",
      isCurrentPair: () => true,
      submissionPersistence: persistence
    });

    await expect(runtime.forgeObject(objectChoice, new AbortController().signal))
      .rejects.toMatchObject({ code: "JOB_OUTCOME_UNCERTAIN" });
    await runtime.forgeObject(objectChoice, new AbortController().signal);

    expect(createJob).toHaveBeenCalledTimes(2);
    expect(pollJob).toHaveBeenCalledOnce();
    expect(reconcile).toHaveBeenCalledOnce();
    expect(pending.size).toBe(0);
  });

  it("does not pin a definitively failed job to the next retry", async () => {
    const pending = new Map<string, string>();
    const persistence: ImageLabSubmissionPersistence = {
      load: async (fingerprint) => pending.get(fingerprint) ?? null,
      store: async (fingerprint, idempotencyKey) => { pending.set(fingerprint, idempotencyKey); },
      remove: async (fingerprint) => { pending.delete(fingerprint); }
    };
    let nextId = 0;
    const createJob = vi.fn().mockImplementation(async (request) => ({
      jobToken: `job-${String(nextId)}`,
      stage: "object" as const,
      remaining: { object: 5, realise: 2 },
      request
    }));
    const pollJob = vi.fn()
      .mockResolvedValueOnce({ status: "failed" })
      .mockResolvedValueOnce({ status: "completed" });
    const runtime = new ImageLabRuntime({
      client: client({ createJob, pollJob }),
      exportDesign: vi.fn(),
      place: vi.fn().mockResolvedValue(undefined),
      prepare: vi.fn().mockResolvedValue(preparedObject()),
      createId: () => `00000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`,
      isCurrentPair: () => true,
      submissionPersistence: persistence
    });

    await expect(runtime.forgeObject(objectChoice, new AbortController().signal))
      .rejects.toThrow("failed");
    await runtime.forgeObject(objectChoice, new AbortController().signal);

    const requests = createJob.mock.calls.map(([request]) => request as { idempotencyKey: string });
    expect(requests[0]?.idempotencyKey).not.toBe(requests[1]?.idempotencyKey);
  });
});
