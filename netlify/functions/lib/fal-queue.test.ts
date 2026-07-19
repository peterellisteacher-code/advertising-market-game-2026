// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  FalQueueError,
  falImageUrl,
  falJobStatus,
  submitFalJob
} from "./fal-queue";

const requestId = "123e4567-e89b-42d3-a456-426614174000";

describe("fal queue boundary", () => {
  it("submits only a server-selected endpoint with retention and timeout controls", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      request_id: requestId,
      response_url: "https://queue.fal.run/fal-ai/flux/schnell/requests/id/response",
      status_url: "https://queue.fal.run/fal-ai/flux/schnell/requests/id/status",
      cancel_url: "https://queue.fal.run/fal-ai/flux/schnell/requests/id/cancel",
      queue_position: 0
    }));
    await expect(submitFalJob({
      fetch: fetcher,
      falKey: "secret-key",
      modelId: "fal-ai/flux/schnell",
      input: { prompt: "one object" },
      startTimeoutSeconds: 30,
      signal: AbortSignal.timeout(1_000)
    })).resolves.toBe(requestId);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://queue.fal.run/fal-ai/flux/schnell");
    expect(init).toMatchObject({
      method: "POST",
      redirect: "error",
      headers: {
        authorization: "Key secret-key",
        "content-type": "application/json",
        "x-fal-store-io": "0",
        "x-fal-object-lifecycle-preference": '{"expiration_duration_seconds":3600}',
        "x-fal-no-retry": "1",
        "x-app-fal-disable-fallback": "true",
        "x-fal-request-timeout": "30"
      },
      body: JSON.stringify({ prompt: "one object" })
    });
  });

  it("rejects malformed model IDs and queue responses", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ request_id: "not-an-id" }));
    await expect(submitFalJob({
      fetch: fetcher,
      falKey: "key",
      modelId: "https://evil.example/model",
      input: {},
      startTimeoutSeconds: 30,
      signal: AbortSignal.timeout(1_000)
    })).rejects.toThrow(FalQueueError);
    expect(fetcher).not.toHaveBeenCalled();

    await expect(submitFalJob({
      fetch: fetcher,
      falKey: "key",
      modelId: "fal-ai/flux/schnell",
      input: {},
      startTimeoutSeconds: 30,
      signal: AbortSignal.timeout(1_000)
    })).rejects.toThrow("invalid");
  });

  it("polls a constructed status URL and exposes only canonical states", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      status: "IN_PROGRESS",
      request_id: requestId,
      response_url: "https://queue.fal.run/ignored"
    }));
    await expect(falJobStatus({
      fetch: fetcher,
      falKey: "key",
      modelId: "fal-ai/flux/schnell",
      requestId,
      signal: AbortSignal.timeout(1_000)
    })).resolves.toEqual({ status: "working" });
    expect(String(fetcher.mock.calls[0]![0])).toBe(
      `https://queue.fal.run/fal-ai/flux/schnell/requests/${requestId}/status`
    );
    expect(fetcher.mock.calls[0]![1]?.headers).toMatchObject({
      "x-fal-no-retry": "1",
      "x-app-fal-disable-fallback": "true"
    });
  });

  it("retrieves a single safe fal media URL without returning model metadata", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      images: [{
        url: "https://v3.fal.media/files/rabbit/result.png",
        width: 512,
        height: 512,
        content_type: "image/png"
      }],
      prompt: "private prompt",
      seed: 42
    }));
    await expect(falImageUrl({
      fetch: fetcher,
      falKey: "key",
      modelId: "fal-ai/flux/schnell",
      requestId,
      signal: AbortSignal.timeout(1_000)
    })).resolves.toBe("https://v3.fal.media/files/rabbit/result.png");
    expect(String(fetcher.mock.calls[0]![0])).toBe(
      `https://queue.fal.run/fal-ai/flux/schnell/requests/${requestId}`
    );
    expect(fetcher.mock.calls[0]![1]?.headers).toMatchObject({
      "x-fal-no-retry": "1",
      "x-app-fal-disable-fallback": "true"
    });

    fetcher.mockResolvedValueOnce(Response.json({ images: [{ url: "https://evil.example/image.png" }] }));
    await expect(falImageUrl({
      fetch: fetcher,
      falKey: "key",
      modelId: "fal-ai/flux/schnell",
      requestId,
      signal: AbortSignal.timeout(1_000)
    })).rejects.toThrow("media URL");
  });
});
