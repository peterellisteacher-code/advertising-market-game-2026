import { describe, expect, it, vi } from "vitest";
import {
  ImageLabClient,
  ImageLabClientError,
  type ImageLabJobRequest
} from "./image-lab-client";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

const expectClientError = async (promise: Promise<unknown>, code: string): Promise<ImageLabClientError> => {
  const error = await promise.catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(ImageLabClientError);
  expect(error).toMatchObject({ code });
  return error as ImageLabClientError;
};

const objectRequest = (): ImageLabJobRequest => ({
  stage: "object",
  idempotencyKey: "object-try-1",
  objectName: "Comet Cola can",
  category: "drink",
  style: "playful",
  colour: "electric blue"
});

describe("ImageLabClient account status", () => {
  it("loads disabled status for the authenticated account with same-origin JSON controls", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      enabled: false,
      reason: "disabled"
    }));
    const client = new ImageLabClient({ fetch: fetchMock });

    await expect(client.status()).resolves.toEqual({ enabled: false, reason: "disabled" });
    expect(fetchMock).toHaveBeenCalledWith("/api/image-lab/session", {
      method: "GET",
      credentials: "same-origin",
      redirect: "error",
      headers: { accept: "application/json" },
      signal: expect.any(AbortSignal)
    });
  });

  it("returns independent remaining and reserved counts for both stages", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      enabled: true,
      object: { remaining: 6, reserved: 1 },
      realise: { remaining: 2, reserved: 0 }
    }));
    const client = new ImageLabClient({ fetch: fetchMock });

    await expect(client.status()).resolves.toEqual({
      enabled: true,
      object: { remaining: 6, reserved: 1 },
      realise: { remaining: 2, reserved: 0 }
    });
  });

  it("sends no student-supplied identity or teacher capability controls", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ enabled: false, reason: "disabled" }));
    const client = new ImageLabClient({ fetch: fetchMock });

    await client.status();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/image-lab/session");
    expect(url).not.toContain("sessionId");
    expect(url).not.toContain("teamId");
    expect(new Headers(init.headers).has("x-image-lab-code")).toBe(false);
    expect(new Headers(init.headers).has("x-image-lab-user-id")).toBe(false);
  });
});

describe("ImageLabClient jobs", () => {
  it("posts the closed Object Forge policy shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      jobToken: "signed.object/token",
      stage: "object",
      remaining: { object: 5, realise: 2 }
    }));
    const client = new ImageLabClient({ fetch: fetchMock });

    await expect(client.createJob(objectRequest())).resolves.toEqual({
      jobToken: "signed.object/token",
      stage: "object",
      remaining: { object: 5, realise: 2 }
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/image-lab/jobs");
    expect(init).toMatchObject({
      method: "POST",
      credentials: "same-origin",
      redirect: "error",
      headers: { accept: "application/json", "content-type": "application/json" }
    });
    expect(JSON.parse(String(init.body))).toEqual(objectRequest());
  });

  it("posts the closed Make It Real policy shape", async () => {
    const request: ImageLabJobRequest = {
      stage: "realise",
      idempotencyKey: "realise-try-1",
      designDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      productKind: "soft drink can",
      scene: "bright supermarket shelf"
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      jobToken: "signed-realise-token",
      stage: "realise",
      remaining: { object: 5, realise: 1 }
    }));
    const client = new ImageLabClient({ fetch: fetchMock });

    await client.createJob(request);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual(request);
  });

  it("rejects model, slug, step, or dimension controls without fetching", async () => {
    const fetchMock = vi.fn();
    const client = new ImageLabClient({ fetch: fetchMock });

    await expectClientError(client.createJob({
      ...objectRequest(),
      model: "fal-ai/anything",
      steps: 99,
      width: 4096
    } as never), "INVALID_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects student-supplied session and team identity without fetching", async () => {
    const fetchMock = vi.fn();
    const client = new ImageLabClient({ fetch: fetchMock });

    await expectClientError(client.createJob({
      ...objectRequest(),
      sessionId: "student-supplied-session",
      teamId: "student-supplied-team"
    } as never), "INVALID_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a returned stage that does not match the submitted job", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      jobToken: "signed-token",
      stage: "realise",
      remaining: { object: 5, realise: 2 }
    }));
    const client = new ImageLabClient({ fetch: fetchMock });

    await expectClientError(client.createJob(objectRequest()), "INVALID_RESPONSE");
  });

  it("gets only the strict status shape using an encoded opaque token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "working", position: 2 }));
    const client = new ImageLabClient({ fetch: fetchMock });

    await expect(client.getJobStatus("signed token/+?")).resolves.toEqual({
      status: "working",
      position: 2
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/image-lab/jobs?job=signed+token%2F%2B%3F",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
        redirect: "error",
        headers: { accept: "application/json" }
      })
    );
  });

  it("posts only the opaque token when reconciling an uncertain request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "unknown" }));
    const client = new ImageLabClient({ fetch: fetchMock });

    await expect(client.reconcile("signed token/+?")).resolves.toEqual({ status: "unknown" });
    expect(fetchMock).toHaveBeenCalledWith("/api/image-lab/jobs/reconcile", {
      method: "POST",
      credentials: "same-origin",
      redirect: "error",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ jobToken: "signed token/+?" }),
      signal: expect.any(AbortSignal)
    });
  });

  it("rejects status records containing undeclared fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      status: "completed",
      imageUrl: "https://third-party.test/result.png"
    }));
    const client = new ImageLabClient({ fetch: fetchMock });

    await expectClientError(client.getJobStatus("token"), "INVALID_RESPONSE");
  });

  it("rejects an invalid opaque token asynchronously without fetching", async () => {
    const fetchMock = vi.fn();
    const client = new ImageLabClient({ fetch: fetchMock });

    await expectClientError(client.getJobStatus(""), "INVALID_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("downloads a bounded PNG asset from the same-origin route", async () => {
    const pngSignature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(pngSignature, {
      headers: { "content-type": "image/png", "content-length": "8" }
    }));
    const client = new ImageLabClient({ fetch: fetchMock });

    const blob = await client.getAsset("a/b+c");

    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(8);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/image-lab/assets?job=a%2Fb%2Bc",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
        redirect: "error",
        headers: { accept: "image/png, image/jpeg, image/webp" }
      })
    );
  });

  it.each(["image/gif", "image/png; charset=utf-8"])(
    "rejects the non-exact asset content type %s",
    async (contentType) => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1]), {
        headers: { "content-type": contentType }
      }));
      const client = new ImageLabClient({ fetch: fetchMock });

      await expectClientError(client.getAsset("token"), "UNEXPECTED_CONTENT_TYPE");
    }
  );

  it("rejects image bytes that do not match the exact declared media type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "image/png" }
    }));
    const client = new ImageLabClient({ fetch: fetchMock });

    await expectClientError(client.getAsset("token"), "INVALID_RESPONSE");
  });
});

describe("ImageLabClient bounded transport", () => {
  it("rejects oversized JSON from content-length without reading the body", async () => {
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array([123, 125]));
        controller.close();
      }
    });
    const getReader = vi.spyOn(body, "getReader");
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, {
      headers: { "content-type": "application/json", "content-length": "100000" }
    }));
    const client = new ImageLabClient({ fetch: fetchMock });

    await expectClientError(client.status(), "RESPONSE_TOO_LARGE");
    expect(getReader).not.toHaveBeenCalled();
  });

  it("stops a streaming JSON response once it crosses the read limit", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(40_000));
        controller.enqueue(new Uint8Array(40_000));
      },
      cancel() {
        cancelled = true;
      }
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, {
      headers: { "content-type": "application/json" }
    }));
    const client = new ImageLabClient({ fetch: fetchMock });

    await expectClientError(client.status(), "RESPONSE_TOO_LARGE");
    expect(cancelled).toBe(true);
  });

  it("rejects an oversized image before reading it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1]), {
      headers: { "content-type": "image/webp", "content-length": "10000000" }
    }));
    const client = new ImageLabClient({ fetch: fetchMock });

    await expectClientError(client.getAsset("token"), "RESPONSE_TOO_LARGE");
  });

  it("maps a known bounded server error to a stable typed client error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "ALLOWANCE_EXHAUSTED" }, 429));
    const client = new ImageLabClient({ fetch: fetchMock });

    const error = await expectClientError(client.createJob(objectRequest()), "ALLOWANCE_EXHAUSTED");
    expect(error.status).toBe(429);
  });

  it.each(["AUTHENTICATION_REQUIRED", "IMAGE_LAB_UNAVAILABLE", "JOB_OUTCOME_UNCERTAIN"])(
    "maps the account-bound server error %s to a stable typed client error",
    async (code) => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: code }, 409));
      const client = new ImageLabClient({ fetch: fetchMock });

      const error = await expectClientError(client.createJob(objectRequest()), code);
      expect(error.status).toBe(409);
    }
  );

  it("rejects a response that reports a redirect", async () => {
    const response = jsonResponse({ enabled: false, reason: "disabled" });
    Object.defineProperty(response, "redirected", { value: true });
    const client = new ImageLabClient({ fetch: vi.fn().mockResolvedValue(response) });

    await expectClientError(client.status(), "REDIRECT_BLOCKED");
  });

  it("maps AbortError to cancellation and composes the caller signal with its deadline", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError"));
    const client = new ImageLabClient({ fetch: fetchMock });

    await expectClientError(client.status({ signal: controller.signal }), "CANCELLED");
    const requestSignal = (fetchMock.mock.calls[0]?.[1] as RequestInit).signal;
    expect(requestSignal).toBeInstanceOf(AbortSignal);
    expect(requestSignal).not.toBe(controller.signal);
  });

  it("returns TIMEOUT when a JSON request stalls before headers", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
        }));
      const client = new ImageLabClient({
        fetch: fetchMock,
        jsonTimeoutMs: 15_000,
        assetTimeoutMs: 60_000
      });

      const pending = expectClientError(client.status(), "TIMEOUT");
      await vi.advanceTimersByTimeAsync(15_000);

      await pending;
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns TIMEOUT when an image response stalls mid-body", async () => {
    vi.useFakeTimers();
    try {
      const response = new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
        }
      }), { headers: { "content-type": "image/png" } });
      const client = new ImageLabClient({
        fetch: vi.fn().mockResolvedValue(response),
        jsonTimeoutMs: 15_000,
        assetTimeoutMs: 60_000
      });

      const pending = expectClientError(client.getAsset("token"), "TIMEOUT");
      await vi.advanceTimersByTimeAsync(60_000);

      await pending;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("ImageLabClient polling", () => {
  it("polls through queued and working states up to a completed state", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: "queued", position: 3 }))
      .mockResolvedValueOnce(jsonResponse({ status: "working" }))
      .mockResolvedValueOnce(jsonResponse({ status: "completed" }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = new ImageLabClient({ fetch: fetchMock, sleep });

    await expect(client.pollJob("token", { maxAttempts: 3, intervalMs: 25 })).resolves.toEqual({
      status: "completed"
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 25, undefined);
  });

  it("returns a failed terminal status without another poll", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "failed" }));
    const sleep = vi.fn();
    const client = new ImageLabClient({ fetch: fetchMock, sleep });

    await expect(client.pollJob("token")).resolves.toEqual({ status: "failed" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("returns an unknown terminal status so the student can choose Check request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: "unknown" }));
    const sleep = vi.fn();
    const client = new ImageLabClient({ fetch: fetchMock, sleep });

    await expect(client.pollJob("token")).resolves.toEqual({ status: "unknown" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("stops at the bounded attempt limit", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse({ status: "queued" }))
    );
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = new ImageLabClient({ fetch: fetchMock, sleep });

    await expectClientError(client.pollJob("token", { maxAttempts: 2, intervalMs: 0 }), "POLL_LIMIT");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it("rejects unbounded polling options without fetching", async () => {
    const fetchMock = vi.fn();
    const client = new ImageLabClient({ fetch: fetchMock });

    await expectClientError(client.pollJob("token", { maxAttempts: 1_000 }), "INVALID_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
