import { describe, expect, it, vi } from "vitest";
import type { StudioCoachRequest } from "../../../shared/studio-coach-contract";
import { StudioCoachClient, StudioCoachClientError } from "./studio-coach-client";

const request: StudioCoachRequest = {
  sessionId: "session-pair-7",
  teamId: "team-pair-7",
  documentId: "campaign-7",
  idempotencyKey: "coach-check-1",
  turn: 1,
  mode: "technique",
  techniqueId: "leading-lines",
  context: {
    productName: "Orbit Tumbler",
    priceLabel: "$24.00",
    audienceNeed: "A reusable drink bottle for after school.",
    audienceValues: "Convenience and less waste.",
    intendedEffect: "Make the product feel practical and easy to carry.",
    aidaStage: "attention"
  },
  current: {
    imageDataUrl: "data:image/jpeg;base64,/9j/2Q==",
    imageSha256: "a".repeat(64),
    width: 896,
    height: 504,
    objects: [{ id: "product", type: "product-shell", name: "Orbit Tumbler", zOrder: [0] }]
  }
};

const response = {
  turn: 1,
  mode: "technique",
  observation: "The diagonal edge points away from the product.",
  effect: "The eye leaves the product before reading the price.",
  nextMove: "Rotate the existing edge so it points towards the product.",
  selfCheck: "Does your eye land on the product before the price?",
  evidenceRefs: ["product"],
  certainty: "clear"
};

function json(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json", ...init.headers },
    ...init
  });
}

describe("StudioCoachClient", () => {
  it("posts one same-origin request and parses the strict response", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(response));
    const client = new StudioCoachClient({ fetch: fetcher });

    await expect(client.check(request)).resolves.toEqual(response);
    expect(fetcher).toHaveBeenCalledWith("/api/image-lab/coach", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      redirect: "error",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(request)
    }));
  });

  it("does not start a request for an already-aborted signal", async () => {
    const fetcher = vi.fn();
    const client = new StudioCoachClient({ fetch: fetcher });

    await expect(client.check(request, { signal: AbortSignal.abort() }))
      .rejects.toMatchObject({ code: "CANCELLED" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects extra provider fields and oversized JSON", async () => {
    const extra = new StudioCoachClient({
      fetch: vi.fn().mockResolvedValue(json({ ...response, invitation: "Ask again" }))
    });
    await expect(extra.check(request)).rejects.toMatchObject({ code: "INVALID_RESPONSE" });

    const oversized = new StudioCoachClient({
      fetch: vi.fn().mockResolvedValue(new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json", "content-length": String(64 * 1024 + 1) }
      }))
    });
    await expect(oversized.check(request)).rejects.toMatchObject({ code: "RESPONSE_TOO_LARGE" });
  });

  it.each([
    ["STUDIO_COACH_DISABLED", "COACH_DISABLED"],
    ["STUDIO_COACH_LOCKED", "COACH_LOCKED"],
    ["CHECK_IN_PROGRESS", "CHECK_IN_PROGRESS"],
    ["TURN_LIMIT_REACHED", "TURN_LIMIT_REACHED"],
    ["RATE_LIMITED", "RATE_LIMITED"]
  ] as const)("maps %s without exposing server text", async (serverCode, clientCode) => {
    const client = new StudioCoachClient({
      fetch: vi.fn().mockResolvedValue(json({ error: serverCode }, { status: 403 }))
    });
    await expect(client.check(request)).rejects.toMatchObject({
      code: clientCode,
      status: 403
    });
  });

  it("uses a typed error for a network failure", async () => {
    const client = new StudioCoachClient({
      fetch: vi.fn().mockRejectedValue(new TypeError("offline"))
    });
    await expect(client.check(request)).rejects.toBeInstanceOf(StudioCoachClientError);
    await expect(client.check(request)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });

  it("keeps the deadline active while reading the response body", async () => {
    const encoded = new TextEncoder().encode(JSON.stringify(response));
    const slowBody = new ReadableStream<Uint8Array>({
      async pull(controller) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, 30));
        controller.enqueue(encoded);
        controller.close();
      }
    });
    const client = new StudioCoachClient({
      timeoutMs: 5,
      fetch: vi.fn().mockResolvedValue(new Response(slowBody, {
        status: 200,
        headers: { "content-type": "application/json" }
      }))
    });

    await expect(client.check(request)).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("cancels a pending response reader when the deadline fires", async () => {
    const cancel = vi.fn();
    const slowBody = new ReadableStream<Uint8Array>({
      async pull(controller) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, 30));
        if (controller.desiredSize !== null) controller.close();
      },
      cancel
    });
    const client = new StudioCoachClient({
      timeoutMs: 5,
      fetch: vi.fn().mockResolvedValue(new Response(slowBody, {
        status: 200,
        headers: { "content-type": "application/json" }
      }))
    });

    await expect(client.check(request)).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(cancel).toHaveBeenCalledOnce();
  });
});
