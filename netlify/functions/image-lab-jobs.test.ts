// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  createJobToken,
  readJobToken
} from "./lib/image-lab-auth";
import type { ResolvedAccountSession } from "./lib/account-backend";
import type {
  ImageLabAllowanceSnapshot,
  ImageLabAllowanceStore
} from "./lib/image-lab-allowance-store";
import {
  MAKE_IT_REAL_PROFILE,
  OBJECT_FORGE_PROFILE,
  composeAdvertisementRealisationPrompt,
  composeMakeItRealPrompt,
  composeObjectForgePrompt,
  parseMakeItRealRequest,
  parseAdvertisementRealisationRequest,
  parseObjectForgeRequest
} from "./lib/fal-image-policy";
import {
  ADVERTISEMENT_REALISATION_PROFILE_ID,
  IMAGE_LAB_ASSET_MAX_BYTES,
  LEGACY_MAKE_IT_REAL_PROFILE_ID,
  MAKE_IT_REAL_PROFILE_ID,
  OBJECT_FORGE_PROFILE_ID,
  config,
  createImageLabJobsHandler,
  type ImageLabJobsState
} from "./image-lab-jobs.mjs";
import {
  ImageLabStateError,
  type ImageLabStoredJob
} from "./lib/image-lab-state";

const secret = "test-only-test-only-test-only-test-only";
const requestId = "123e4567-e89b-42d3-a456-426614174000";
const jobId = "018f0e2d-3b4c-7a89-8def-0123456789ab";
const userId = "223e4567-e89b-42d3-a456-426614174000";
const environment = {
  IMAGE_LAB_ENABLED: "true",
  IMAGE_LAB_SCHOOL_APPROVED: "true",
  IMAGE_LAB_ACCOUNT_CAP_USD: "2.00",
  IMAGE_LAB_CLASSROOM_CODE: "Market-2026!",
  IMAGE_LAB_SIGNING_SECRET: secret,
  FAL_KEY: "fal-secret"
} as const;

const identity = {
  idempotencyKey: jobId
};

const objectRequest = {
  stage: "object",
  ...identity,
  objectName: "sports drink bottle",
  category: "drink packaging",
  style: "clean 3D cutout",
  colour: "cobalt blue"
} as const;

const pngBytes = (width = 1_024, height = 1_024, size = 45): Uint8Array => {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(bytes.buffer).setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes.set([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82], size - 12);
  return bytes;
};

const jpegBytes = (width = 1_024, height = 1_024): Uint8Array => new Uint8Array([
  0xff, 0xd8,
  0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
  0xff, 0xc0, 0x00, 0x0b, 0x08,
  (height >>> 8) & 0xff, height & 0xff,
  (width >>> 8) & 0xff, width & 0xff,
  0x01, 0x01, 0x11, 0x00,
  0xff, 0xd9
]);

const webpBytes = (width = 1_024, height = 1_024): Uint8Array => {
  const bytes = new Uint8Array(30);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  new DataView(bytes.buffer).setUint32(4, 22, true);
  bytes.set([0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58], 8);
  new DataView(bytes.buffer).setUint32(16, 10, true);
  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;
  bytes.set([
    widthMinusOne & 0xff,
    (widthMinusOne >>> 8) & 0xff,
    (widthMinusOne >>> 16) & 0xff,
    heightMinusOne & 0xff,
    (heightMinusOne >>> 8) & 0xff,
    (heightMinusOne >>> 16) & 0xff
  ], 24);
  return bytes;
};

const responseBody = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const designDataUrl = `data:image/png;base64,${Buffer.from(pngBytes(1_024, 576)).toString("base64")}`;

const advertisementRequest = {
  stage: "realise",
  mode: "advertisement",
  ...identity,
  designDataUrl,
  context: {
    productName: "Orbit Bottle",
    productFunction: "Keeps water cold through the school day",
    targetAudience: "Senior students who carry water all day",
    advertisingLocation: "Bus shelter near school",
    attention: "The icy bottle against a hot orange background",
    interest: "A temperature display and replaceable filter",
    desire: "Feel prepared, calm and refreshed all day",
    action: "Scan the code to choose a colour"
  }
} as const;

const authenticatedSession: ResolvedAccountSession = {
  authenticated: true,
  identity: { userId, username: "team-three", resetGeneration: null }
};

const makeRequest = (path: string, init: RequestInit = {}): Request =>
  new Request(`https://game.example${path}`, init);

const post = (body: unknown): Request => makeRequest("/api/image-lab/jobs", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body)
});

interface StateFixtureOptions {
  reserveError?: ImageLabStateError;
  initialJob?: ImageLabStoredJob;
}

const storedObjectJob = (overrides: Partial<ImageLabStoredJob> = {}): ImageLabStoredJob => ({
  id: jobId,
  requestHash: "a".repeat(64),
  stage: "object-forge",
  profileId: OBJECT_FORGE_PROFILE_ID,
  state: "submitted",
  requestId,
  createdAt: 1_000,
  ...overrides
});

const localObjectJob = (
  state: "reserving" | "reserved" | "submitting" | "uncertain" | "refunded"
): ImageLabStoredJob => {
  const { requestId: _requestId, ...job } = storedObjectJob();
  return { ...job, state };
};

const stateFixture = (options: StateFixtureOptions = {}): ImageLabJobsState => {
  const jobs = new Map<string, ImageLabStoredJob>();
  if (options.initialJob) jobs.set(options.initialJob.id, options.initialJob);
  return {
    reserve: vi.fn(async (_pair, input) => {
      if (options.reserveError) throw options.reserveError;
      const existing = jobs.get(input.idempotencyKey);
      if (existing) {
        return { created: false, stored: existing };
      }
      const created: ImageLabStoredJob = {
        id: input.idempotencyKey,
        requestHash: input.requestHash,
        stage: input.stage,
        profileId: input.profileId,
        state: "reserving",
        createdAt: input.nowSeconds
      };
      jobs.set(created.id, created);
      return { created: true, stored: created };
    }),
    markReserved: vi.fn(async (_pair, id) => {
      const current = jobs.get(id);
      if (!current) throw new ImageLabStateError("JOB_NOT_FOUND");
      const reserved = { ...current, state: "reserved" as const };
      jobs.set(id, reserved);
      return reserved;
    }),
    beginSubmission: vi.fn(async (_pair, id) => {
      const current = jobs.get(id);
      if (!current) throw new ImageLabStateError("JOB_NOT_FOUND");
      if (current.state !== "reserved") return { began: false, stored: current };
      const submitting = { ...current, state: "submitting" as const };
      jobs.set(id, submitting);
      return { began: true, stored: submitting };
    }),
    attachRequest: vi.fn(async (_pair, id, upstreamRequestId) => {
      const current = jobs.get(id);
      if (!current) throw new ImageLabStateError("JOB_NOT_FOUND");
      const submitted = { ...current, state: "submitted" as const, requestId: upstreamRequestId };
      jobs.set(id, submitted);
      return submitted;
    }),
    markUncertain: vi.fn(async (_pair, id, upstreamRequestId) => {
      const current = jobs.get(id);
      if (!current) throw new ImageLabStateError("JOB_NOT_FOUND");
      const uncertain = {
        ...current,
        state: "uncertain" as const,
        ...(upstreamRequestId ? { requestId: upstreamRequestId } : {})
      };
      jobs.set(id, uncertain);
      return uncertain;
    }),
    markCompleted: vi.fn(async (_pair, id) => {
      const current = jobs.get(id);
      if (!current) throw new ImageLabStateError("JOB_NOT_FOUND");
      const completed = { ...current, state: "completed" as const };
      jobs.set(id, completed);
      return completed;
    }),
    markRefunded: vi.fn(async (_pair, id) => {
      const current = jobs.get(id);
      if (!current) throw new ImageLabStateError("JOB_NOT_FOUND");
      const refunded = { ...current, state: "refunded" as const };
      jobs.set(id, refunded);
      return refunded;
    }),
    markDenied: vi.fn(async (_pair, id) => {
      const current = jobs.get(id);
      if (!current) throw new ImageLabStateError("JOB_NOT_FOUND");
      const denied = { ...current, state: "denied" as const };
      jobs.set(id, denied);
      return denied;
    }),
    getJob: vi.fn(async (_pair, id) => {
      let current = jobs.get(id);
      if (!current && id === jobId) {
        current = storedObjectJob();
        jobs.set(id, current);
      }
      if (!current) throw new ImageLabStateError("JOB_NOT_FOUND");
      return current;
    })
  };
};

const allowanceSnapshot = (
  status: ImageLabAllowanceSnapshot["status"] = "reserved",
  objectRemaining = 1,
  realiseRemaining = 1
): ImageLabAllowanceSnapshot => ({
  status,
  enabled: status !== "disabled",
  object: {
    granted: 2,
    consumed: status === "completed" ? 1 : 0,
    reserved: status === "reserved" || status === "uncertain" ? 1 : 0,
    remaining: objectRemaining
  },
  realise: {
    granted: 1,
    consumed: 0,
    reserved: 0,
    remaining: realiseRemaining
  }
});

const allowanceFixture = (
  reserveResult?: ImageLabAllowanceSnapshot
): ImageLabAllowanceStore => ({
  status: vi.fn(async () => allowanceSnapshot("available")),
  globalStatus: vi.fn(),
  list: vi.fn(),
  setGlobal: vi.fn(),
  set: vi.fn(),
  add: vi.fn(),
  revoke: vi.fn(),
  teacherMutate: vi.fn(),
  reserve: vi.fn(async (input) => reserveResult ?? (
    input.stage === "object"
      ? allowanceSnapshot("reserved", 1, 1)
      : allowanceSnapshot("reserved", 2, 0)
  )),
  complete: vi.fn(async () => allowanceSnapshot("completed")),
  refund: vi.fn(async () => allowanceSnapshot("refunded", 2)),
  markUncertain: vi.fn(async () => allowanceSnapshot("uncertain"))
});

const handlerWith = (
  fetcher: typeof fetch,
  nowSeconds = 1_000,
  state: ImageLabJobsState = stateFixture(),
  allowances: ImageLabAllowanceStore = allowanceFixture(),
  resolveSession: (request: Request) => Promise<ResolvedAccountSession> =
    async () => authenticatedSession
) => createImageLabJobsHandler({
  environment,
  fetch: fetcher,
  nowSeconds: () => nowSeconds,
  createDeadlineSignal: () => new AbortController().signal,
  state,
  allowances,
  resolveSession
});

const handlerWithEnvironment = (
  selectedEnvironment: Readonly<Record<string, string | undefined>>,
  fetcher: typeof fetch,
  state: ImageLabJobsState = stateFixture(),
  allowances: ImageLabAllowanceStore = allowanceFixture()
) => createImageLabJobsHandler({
  environment: selectedEnvironment,
  fetch: fetcher,
  nowSeconds: () => 1_000,
  createDeadlineSignal: () => new AbortController().signal,
  state,
  allowances,
  resolveSession: async () => authenticatedSession
});

const jobToken = (
  stage: "object-forge" | "make-it-real" = "object-forge",
  profileId = stage === "object-forge" ? OBJECT_FORGE_PROFILE_ID : MAKE_IT_REAL_PROFILE_ID,
  overrides: Partial<{ userId: string }> = {}
): string => createJobToken({
  jobId,
  stage,
  profileId,
  userId,
  expiresAt: 2_000,
  ...overrides
}, secret);

const authenticatedGet = (path: string): Request => makeRequest(path);

const completedQueueResponses = (
  media: Response,
  mediaUrl = "https://v3.fal.media/files/rabbit/result.png"
): ReturnType<typeof vi.fn<typeof fetch>> => vi.fn<typeof fetch>()
  .mockResolvedValueOnce(Response.json({ status: "COMPLETED", request_id: requestId }))
  .mockResolvedValueOnce(Response.json({ images: [{ url: mediaUrl }] }))
  .mockResolvedValueOnce(media);

describe("Image Lab jobs transport", () => {
  it("declares only the three static same-origin routes", () => {
    expect(config).toMatchObject({
      path: [
        "/api/image-lab/jobs",
        "/api/image-lab/jobs/reconcile",
        "/api/image-lab/assets"
      ],
      rateLimit: { windowLimit: 1_200, windowSize: 60 }
    });
  });

  it("stays disabled by default before reading credentials or calling fal", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handler = createImageLabJobsHandler({
      environment: {},
      fetch: fetcher,
      nowSeconds: () => 1_000,
      createDeadlineSignal: () => new AbortController().signal
    });

    const response = await handler(post(objectRequest));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "IMAGE_LAB_DISABLED" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires an authenticated pair account", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const state = stateFixture();
    const handler = handlerWith(
      fetcher,
      1_000,
      state,
      allowanceFixture(),
      async () => ({ authenticated: false, clearCookies: false })
    );
    const response = await handler(makeRequest("/api/image-lab/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(objectRequest)
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "AUTHENTICATION_REQUIRED" });
    expect(state.reserve).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("clears an expired pair session and never touches state or fal", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const state = stateFixture();
    const response = await handlerWith(
      fetcher,
      2_000,
      state,
      allowanceFixture(),
      async () => ({ authenticated: false, clearCookies: true })
    )(post(objectRequest));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "AUTHENTICATION_REQUIRED" });
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(state.reserve).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rotates refreshed account cookies even when a confirmed provider request fails", async () => {
    const session: ResolvedAccountSession = {
      ...authenticatedSession,
      rotatedTokens: {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        expiresIn: 3_600
      }
    };
    const response = await handlerWith(
      vi.fn<typeof fetch>().mockResolvedValue(new Response("rejected", { status: 503 })),
      1_000,
      stateFixture(),
      allowanceFixture(),
      async () => session
    )(post(objectRequest));

    expect(response.status).toBe(502);
    const cookies = response.headers.get("set-cookie") ?? "";
    expect(cookies).toContain("admarket_account_access=new-access-token");
    expect(cookies).toContain("admarket_account_refresh=new-refresh-token");
    expect(cookies).toContain("Path=/api");
  });

  it("submits the exact server-owned Object Forge profile after the ledger reserves allowance", async () => {
    expect(OBJECT_FORGE_PROFILE_ID).toBe("object-forge-gpt-image-2-low-v1");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ request_id: requestId }));
    const allowances = allowanceFixture();
    const response = await handlerWith(
      fetcher,
      1_000,
      stateFixture(),
      allowances
    )(post(objectRequest));

    expect(response.status).toBe(202);
    const body = await response.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      stage: "object",
      remaining: { object: 1, realise: 1 }
    });
    expect(typeof body.jobToken).toBe("string");
    expect(JSON.stringify(body)).not.toContain(requestId);
    expect(JSON.stringify(body)).not.toContain(OBJECT_FORGE_PROFILE.model);
    expect(JSON.stringify(body)).not.toContain("prompt");

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(`https://queue.fal.run/${OBJECT_FORGE_PROFILE.model}`);
    expect(JSON.parse(String(init?.body))).toEqual({
      prompt: composeObjectForgePrompt(parseObjectForgeRequest(objectRequest)),
      image_size: { width: 1_024, height: 1_024 },
      quality: "low",
      num_images: 1,
      output_format: "png"
    });
    expect(allowances.reserve).toHaveBeenCalledOnce();
    expect(fetcher.mock.invocationCallOrder[0]).toBeGreaterThan(
      vi.mocked(allowances.reserve).mock.invocationCallOrder[0]!
    );
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("maps Make It Real to the documented GPT Image 2 edit input", async () => {
    expect(MAKE_IT_REAL_PROFILE_ID).toBe("make-it-real-gpt-image-2-high-v2");
    const request = {
      stage: "realise",
      ...identity,
      designDataUrl,
      productKind: "soft drink can",
      scene: "bright shop shelf"
    } as const;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ request_id: requestId }));
    const response = await handlerWith(fetcher)(post(request));

    expect(response.status).toBe(202);
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({
      image_urls: [designDataUrl],
      image_size: { width: 1_280, height: 720 },
      quality: "high",
      output_format: "png",
      num_images: 1,
      prompt: composeMakeItRealPrompt(parseMakeItRealRequest(request))
    });
    expect(await response.json()).toMatchObject({
      stage: "realise",
      remaining: { object: 2, realise: 0 }
    });
  });

  it("pins advertisement realisation to GPT Image 2 edit and the shared realise allowance", async () => {
    expect(ADVERTISEMENT_REALISATION_PROFILE_ID).toBe("make-it-real-advertisement-v1");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ request_id: requestId }));
    const state = stateFixture();
    const allowances = allowanceFixture();
    const response = await handlerWith(fetcher, 1_000, state, allowances)(post(advertisementRequest));

    expect(response.status).toBe(202);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe(`https://queue.fal.run/${MAKE_IT_REAL_PROFILE.model}`);
    expect(JSON.parse(String(init?.body))).toEqual({
      image_urls: [designDataUrl],
      image_size: { width: 1_280, height: 720 },
      quality: "high",
      output_format: "png",
      num_images: 1,
      prompt: composeAdvertisementRealisationPrompt(
        parseAdvertisementRealisationRequest(advertisementRequest)
      )
    });
    expect(state.reserve).toHaveBeenCalledWith(
      { userId },
      expect.objectContaining({ profileId: ADVERTISEMENT_REALISATION_PROFILE_ID })
    );
    expect(allowances.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ userId, stage: "realise", jobKey: jobId })
    );
    const body = await response.json() as { jobToken: string };
    expect(readJobToken(body.jobToken, secret, { userId, nowSeconds: 1_000 }).profileId)
      .toBe(ADVERTISEMENT_REALISATION_PROFILE_ID);
  });

  it("submits the exact server-owned Z-Image LoRA A/B profile and binds its stable ID", async () => {
    const loraUrl = "https://v3.fal.media/files/style/catalogue-house-style.safetensors";
    const selectedEnvironment = {
      ...environment,
      IMAGE_LAB_OBJECT_PROFILE_ID: "z-image-lora-v1",
      IMAGE_LAB_Z_LORA_URL: loraUrl
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ request_id: requestId }));
    const state = stateFixture();
    const response = await handlerWithEnvironment(selectedEnvironment, fetcher, state)(post(objectRequest));

    expect(response.status).toBe(202);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://queue.fal.run/fal-ai/z-image/turbo/lora");
    expect(JSON.parse(String(init?.body))).toEqual({
      prompt: composeObjectForgePrompt(parseObjectForgeRequest(objectRequest)),
      image_size: { width: 512, height: 512 },
      num_inference_steps: 8,
      num_images: 1,
      enable_safety_checker: true,
      output_format: "png",
      acceleration: "regular",
      enable_prompt_expansion: false,
      loras: [{ path: loraUrl, scale: 1 }]
    });
    expect(state.reserve).toHaveBeenCalledWith(
      { userId },
      expect.objectContaining({ profileId: "z-image-lora-v1" })
    );
    const body = await response.json() as { jobToken: string };
    expect(readJobToken(body.jobToken, secret, {
      userId,
      nowSeconds: 1_000
    }).profileId).toBe("z-image-lora-v1");
    expect(JSON.stringify(body)).not.toContain(loraUrl);
  });

  it("submits the exact server-owned FLUX 2 Turbo Edit A/B profile without Qwen-only fields", async () => {
    const request = {
      stage: "realise",
      ...identity,
      designDataUrl,
      productKind: "soft drink can",
      scene: "bright shop shelf"
    } as const;
    const selectedEnvironment = {
      ...environment,
      IMAGE_LAB_REALISE_PROFILE_ID: "flux2-turbo-edit-v1"
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ request_id: requestId }));
    const state = stateFixture();
    const response = await handlerWithEnvironment(selectedEnvironment, fetcher, state)(post(request));

    expect(response.status).toBe(202);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(String(url)).toBe("https://queue.fal.run/fal-ai/flux-2/turbo/edit");
    expect(JSON.parse(String(init?.body))).toEqual({
      image_urls: [designDataUrl],
      image_size: { width: 1_024, height: 576 },
      guidance_scale: 2.5,
      enable_safety_checker: true,
      output_format: "png",
      num_images: 1,
      enable_prompt_expansion: false,
      prompt: composeMakeItRealPrompt(parseMakeItRealRequest(request))
    });
    expect(state.reserve).toHaveBeenCalledWith(
      { userId },
      expect.objectContaining({ profileId: "flux2-turbo-edit-v1" })
    );
    const body = await response.json() as { jobToken: string };
    expect(readJobToken(body.jobToken, secret, {
      userId,
      nowSeconds: 1_000
    }).profileId).toBe("flux2-turbo-edit-v1");
  });

  it.each([
    ["unknown object profile", { IMAGE_LAB_OBJECT_PROFILE_ID: "unknown-v1" }],
    ["unknown realise profile", { IMAGE_LAB_REALISE_PROFILE_ID: "unknown-v1" }],
    ["missing LoRA URL", { IMAGE_LAB_OBJECT_PROFILE_ID: "z-image-lora-v1" }],
    ["padded LoRA URL", {
      IMAGE_LAB_OBJECT_PROFILE_ID: "z-image-lora-v1",
      IMAGE_LAB_Z_LORA_URL: " https://fal.media/style.safetensors"
    }],
    ["non-HTTPS LoRA URL", {
      IMAGE_LAB_OBJECT_PROFILE_ID: "z-image-lora-v1",
      IMAGE_LAB_Z_LORA_URL: "http://fal.media/style.safetensors"
    }],
    ["credentialed LoRA URL", {
      IMAGE_LAB_OBJECT_PROFILE_ID: "z-image-lora-v1",
      IMAGE_LAB_Z_LORA_URL: "https://user:secret@fal.media/style.safetensors"
    }],
    ["fragmented LoRA URL", {
      IMAGE_LAB_OBJECT_PROFILE_ID: "z-image-lora-v1",
      IMAGE_LAB_Z_LORA_URL: "https://fal.media/style.safetensors#secret"
    }],
    ["ported LoRA URL", {
      IMAGE_LAB_OBJECT_PROFILE_ID: "z-image-lora-v1",
      IMAGE_LAB_Z_LORA_URL: "https://fal.media:444/style.safetensors"
    }],
    ["overlong LoRA URL", {
      IMAGE_LAB_OBJECT_PROFILE_ID: "z-image-lora-v1",
      IMAGE_LAB_Z_LORA_URL: `https://fal.media/${"a".repeat(2_048)}`
    }]
  ] as const)("fails closed before reserving state for %s", async (_label, overrides) => {
    const fetcher = vi.fn<typeof fetch>();
    const state = stateFixture();
    const response = await handlerWithEnvironment({ ...environment, ...overrides }, fetcher, state)(
      post(objectRequest)
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "IMAGE_PROFILE_CONFIGURATION_INVALID" });
    expect(state.reserve).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not require or validate a LoRA URL while the default Object Forge profile is selected", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ request_id: requestId }));
    const response = await handlerWithEnvironment({
      ...environment,
      IMAGE_LAB_Z_LORA_URL: "not-a-url"
    }, fetcher)(post(objectRequest));

    expect(response.status).toBe(202);
    expect(String(fetcher.mock.calls[0]![0])).toBe(`https://queue.fal.run/${OBJECT_FORGE_PROFILE.model}`);
  });

  it("rejects browser-supplied authority and provider settings", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handler = handlerWith(fetcher);
    const browserUserId = await handler(post({ ...objectRequest, userId }));
    const browserPair = await handler(post({
      ...objectRequest,
      sessionId: "student-session",
      teamId: "student-team"
    }));
    const modelOverride = await handler(post({ ...objectRequest, model: "fal-ai/other" }));

    expect(browserUserId.status).toBe(400);
    expect(await browserUserId.json()).toEqual({ error: "INVALID_REQUEST" });
    expect(browserPair.status).toBe(400);
    expect(await browserPair.json()).toEqual({ error: "INVALID_REQUEST" });
    expect(modelOverride.status).toBe(400);
    expect(await modelOverride.json()).toEqual({ error: "INVALID_REQUEST" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses authoritative ledger allowance and makes ambiguous submissions non-retryable", async () => {
    const exhaustedFetcher = vi.fn<typeof fetch>();
    const exhaustedState = stateFixture();
    const exhaustedAllowances = allowanceFixture(allowanceSnapshot("available", 0));
    const exhausted = await handlerWith(
      exhaustedFetcher,
      1_000,
      exhaustedState,
      exhaustedAllowances
    )(post(objectRequest));
    expect(exhausted.status).toBe(429);
    expect(await exhausted.json()).toEqual({ error: "ALLOWANCE_EXHAUSTED" });
    expect(exhaustedState.markDenied).toHaveBeenCalledOnce();
    expect(exhaustedFetcher).not.toHaveBeenCalled();

    const failedState = stateFixture();
    const failedAllowances = allowanceFixture();
    const failedFetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("socket reset"));
    const failed = await handlerWith(
      failedFetcher,
      1_000,
      failedState,
      failedAllowances
    )(post(objectRequest));
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "IMAGE_SERVICE_UNAVAILABLE" });
    expect(failed.headers.has("set-cookie")).toBe(false);
    expect(failedState.markUncertain).toHaveBeenCalledOnce();
    expect(failedAllowances.markUncertain).toHaveBeenCalledOnce();
    expect(failedAllowances.refund).not.toHaveBeenCalled();
  });

  it("refunds one confirmed provider submission rejection and never marks it uncertain", async () => {
    const state = stateFixture();
    const allowances = allowanceFixture();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("rejected", { status: 503 })
    );

    const response = await handlerWith(
      fetcher,
      1_000,
      state,
      allowances
    )(post(objectRequest));

    expect(response.status).toBe(502);
    expect(allowances.refund).toHaveBeenCalledOnce();
    expect(allowances.markUncertain).not.toHaveBeenCalled();
    expect(state.markRefunded).toHaveBeenCalledOnce();
  });

  it("reserves the matching ledger stage for both image workflows", async () => {
    const objectAllowances = allowanceFixture();
    const realiseAllowances = allowanceFixture();
    const objectFetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ request_id: requestId })
    );
    const realiseFetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ request_id: requestId })
    );
    const realiseRequest = {
      stage: "realise",
      ...identity,
      designDataUrl,
      productKind: "soft drink can",
      scene: "bright shop shelf"
    } as const;

    await handlerWith(
      objectFetcher,
      1_000,
      stateFixture(),
      objectAllowances
    )(post(objectRequest));
    await handlerWith(
      realiseFetcher,
      1_000,
      stateFixture(),
      realiseAllowances
    )(post(realiseRequest));

    expect(objectAllowances.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ userId, stage: "object", jobKey: jobId })
    );
    expect(realiseAllowances.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ userId, stage: "realise", jobKey: jobId })
    );
  });

  it("replays an accepted idempotency key without submitting a second fal job", async () => {
    const state = stateFixture();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ request_id: requestId }));
    const handler = handlerWith(fetcher, 1_000, state);

    const first = await handler(post(objectRequest));
    const replay = await handler(post(objectRequest));

    expect(first.status).toBe(202);
    expect(replay.status).toBe(202);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(state.reserve).toHaveBeenCalledTimes(2);
    expect(await replay.json()).toMatchObject({
      stage: "object",
      remaining: { object: 1, realise: 1 }
    });
  });

  it("fails closed when authoritative state is unavailable", async () => {
    const state = stateFixture({ reserveError: new ImageLabStateError("STATE_UNAVAILABLE") });
    const fetcher = vi.fn<typeof fetch>();
    const response = await handlerWith(fetcher, 1_000, state)(post(objectRequest));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "IMAGE_STATE_UNAVAILABLE" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("bounds JSON bodies and accepts only the exact JSON media type", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handler = handlerWith(fetcher);
    const oversized = await handler(makeRequest("/api/image-lab/jobs", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "5000000"
      },
      body: "{}"
    }));
    const wrongType = await handler(makeRequest("/api/image-lab/jobs", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}"
    }));

    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toEqual({ error: "REQUEST_TOO_LARGE" });
    expect(wrongType.status).toBe(415);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns only a canonical status for a job bound to the authenticated account", async () => {
    const token = jobToken();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      status: "IN_QUEUE",
      request_id: requestId,
      queue_position: 3,
      logs: [{ message: "private" }]
    }));
    const response = await handlerWith(fetcher)(authenticatedGet(`/api/image-lab/jobs?job=${encodeURIComponent(token)}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "queued", position: 3 });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("refunds a confirmed failed provider job once and keeps terminal replays stable", async () => {
    const token = jobToken();
    const state = stateFixture({ initialJob: storedObjectJob() });
    const allowances = allowanceFixture();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      status: "COMPLETED",
      request_id: requestId,
      error: "provider rejected the image"
    }));
    const handler = handlerWith(fetcher, 1_000, state, allowances);

    const first = await handler(authenticatedGet(
      `/api/image-lab/jobs?job=${encodeURIComponent(token)}`
    ));
    const replay = await handler(makeRequest("/api/image-lab/jobs/reconcile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobToken: token })
    }));

    expect(await first.json()).toEqual({ status: "failed" });
    expect(await replay.json()).toEqual({ status: "failed" });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(allowances.refund).toHaveBeenCalledOnce();
    expect(state.markRefunded).toHaveBeenCalledOnce();
  });

  it("reconciles an uncertain existing request to failed without submitting again", async () => {
    const token = jobToken();
    const state = stateFixture({ initialJob: storedObjectJob() });
    const allowances = allowanceFixture();
    const fetcher = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("status timeout"))
      .mockResolvedValueOnce(Response.json({
        status: "COMPLETED",
        request_id: requestId,
        error: "provider rejected the image"
      }));
    const handler = handlerWith(fetcher, 1_000, state, allowances);

    const unknown = await handler(authenticatedGet(
      `/api/image-lab/jobs?job=${encodeURIComponent(token)}`
    ));
    const reconciled = await handler(makeRequest("/api/image-lab/jobs/reconcile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobToken: token })
    }));

    expect(await unknown.json()).toEqual({ status: "unknown" });
    expect(await reconciled.json()).toEqual({ status: "failed" });
    expect(fetcher.mock.calls.every(([, init]) => init?.method === "GET")).toBe(true);
    expect(allowances.markUncertain).toHaveBeenCalledOnce();
    expect(allowances.refund).toHaveBeenCalledOnce();
  });

  it("polls an existing Z-Image LoRA job by its stored profile after the selector returns to default", async () => {
    const token = jobToken("object-forge", "z-image-lora-v1");
    const state = stateFixture({
      initialJob: storedObjectJob({ profileId: "z-image-lora-v1" })
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      status: "IN_PROGRESS",
      request_id: requestId
    }));
    const response = await handlerWith(fetcher, 1_000, state)(authenticatedGet(
      `/api/image-lab/jobs?job=${encodeURIComponent(token)}`
    ));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "working" });
    expect(String(fetcher.mock.calls[0]![0])).toBe(
      `https://queue.fal.run/fal-ai/z-image/turbo/lora/requests/${requestId}/status`
    );
  });

  it("reads an existing FLUX 2 Turbo Edit result by its stored profile after the selector returns to default", async () => {
    const token = jobToken("make-it-real", "flux2-turbo-edit-v1");
    const state = stateFixture({
      initialJob: storedObjectJob({
        stage: "make-it-real",
        profileId: "flux2-turbo-edit-v1"
      })
    });
    const bytes = pngBytes(1_024, 576);
    const fetcher = completedQueueResponses(new Response(responseBody(bytes), {
      headers: { "content-type": "image/png", "content-length": String(bytes.byteLength) }
    }));
    const response = await handlerWith(fetcher, 1_000, state)(authenticatedGet(
      `/api/image-lab/assets?job=${encodeURIComponent(token)}`
    ));

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(fetcher.mock.calls.slice(0, 2).map(([url]) => String(url))).toEqual([
      `https://queue.fal.run/fal-ai/flux-2/turbo/edit/requests/${requestId}/status`,
      `https://queue.fal.run/fal-ai/flux-2/turbo/edit/requests/${requestId}`
    ]);
  });

  it("accepts the exact GPT Image 2 dimensions requested by the current Make It Real profile", async () => {
    const token = jobToken("make-it-real", MAKE_IT_REAL_PROFILE_ID);
    const state = stateFixture({
      initialJob: storedObjectJob({
        stage: "make-it-real",
        profileId: MAKE_IT_REAL_PROFILE_ID
      })
    });
    const bytes = pngBytes(1_280, 720);
    const fetcher = completedQueueResponses(new Response(responseBody(bytes), {
      headers: { "content-type": "image/png", "content-length": String(bytes.byteLength) }
    }));
    const response = await handlerWith(fetcher, 1_000, state)(authenticatedGet(
      `/api/image-lab/assets?job=${encodeURIComponent(token)}`
    ));

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it("keeps already-issued v1 Make It Real jobs readable at their historical dimensions", async () => {
    const token = jobToken("make-it-real", LEGACY_MAKE_IT_REAL_PROFILE_ID);
    const state = stateFixture({
      initialJob: storedObjectJob({
        stage: "make-it-real",
        profileId: LEGACY_MAKE_IT_REAL_PROFILE_ID
      })
    });
    const bytes = pngBytes(1_088, 608);
    const fetcher = completedQueueResponses(new Response(responseBody(bytes), {
      headers: { "content-type": "image/png", "content-length": String(bytes.byteLength) }
    }));
    const response = await handlerWith(fetcher, 1_000, state)(authenticatedGet(
      `/api/image-lab/assets?job=${encodeURIComponent(token)}`
    ));

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  it.each([
    [MAKE_IT_REAL_PROFILE_ID, 1_024, 576],
    ["flux2-turbo-edit-v1", 1_280, 720]
  ] as const)(
    "rejects an asset whose dimensions belong to the other Make It Real profile: %s",
    async (profileId, width, height) => {
      const token = jobToken("make-it-real", profileId);
      const state = stateFixture({
        initialJob: storedObjectJob({ stage: "make-it-real", profileId })
      });
      const bytes = pngBytes(width, height);
      const fetcher = completedQueueResponses(new Response(responseBody(bytes), {
        headers: { "content-type": "image/png", "content-length": String(bytes.byteLength) }
      }));
      const response = await handlerWith(fetcher, 1_000, state)(authenticatedGet(
        `/api/image-lab/assets?job=${encodeURIComponent(token)}`
      ));

      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({ error: "INVALID_IMAGE_RESULT" });
    }
  );

  it("resolves local submitting and uncertain states without contacting fal", async () => {
    const token = jobToken();
    const fetcher = vi.fn<typeof fetch>();
    const submittingState = stateFixture({
      initialJob: localObjectJob("submitting")
    });
    const uncertainState = stateFixture({
      initialJob: localObjectJob("uncertain")
    });

    const queued = await handlerWith(fetcher, 1_000, submittingState)(authenticatedGet(
      `/api/image-lab/jobs?job=${encodeURIComponent(token)}`
    ));
    const unknown = await handlerWith(fetcher, 1_000, uncertainState)(authenticatedGet(
      `/api/image-lab/jobs?job=${encodeURIComponent(token)}`
    ));
    const unavailableAsset = await handlerWith(fetcher, 1_000, uncertainState)(authenticatedGet(
      `/api/image-lab/assets?job=${encodeURIComponent(token)}`
    ));

    expect(await queued.json()).toEqual({ status: "queued" });
    expect(await unknown.json()).toEqual({ status: "unknown" });
    expect(unavailableAsset.status).toBe(409);
    expect(await unavailableAsset.json()).toEqual({ error: "JOB_OUTCOME_UNCERTAIN" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("hides wrong-account, malformed and profile-mismatched job tokens", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handler = handlerWith(fetcher);
    const wrongAccount = await handler(authenticatedGet(
      `/api/image-lab/jobs?job=${encodeURIComponent(jobToken("object-forge", OBJECT_FORGE_PROFILE_ID, {
        userId: "323e4567-e89b-42d3-a456-426614174000"
      }))}`
    ));
    const mismatchedProfile = await handler(authenticatedGet(
      `/api/image-lab/jobs?job=${encodeURIComponent(jobToken("object-forge", MAKE_IT_REAL_PROFILE_ID))}`
    ));
    const malformedQuery = await handler(authenticatedGet("/api/image-lab/jobs?job=a&job=b"));

    expect(wrongAccount.status).toBe(404);
    expect(mismatchedProfile.status).toBe(404);
    expect(await wrongAccount.json()).toEqual({ error: "JOB_NOT_FOUND" });
    expect(await mismatchedProfile.json()).toEqual({ error: "JOB_NOT_FOUND" });
    expect(malformedQuery.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ["PNG", "image/png", pngBytes()],
    ["JPEG", "image/jpeg", jpegBytes()],
    ["WebP", "image/webp", webpBytes()]
  ])("proxies a validated same-origin %s asset without exposing its fal URL", async (_label, contentType, bytes) => {
    const token = jobToken();
    const fetcher = completedQueueResponses(new Response(responseBody(bytes), {
      headers: { "content-type": contentType, "content-length": String(bytes.byteLength) }
    }));
    const response = await handlerWith(fetcher)(authenticatedGet(
      `/api/image-lab/assets?job=${encodeURIComponent(token)}`
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(contentType);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    const mediaCall = fetcher.mock.calls[2]!;
    expect(String(mediaCall[0])).toBe("https://v3.fal.media/files/rabbit/result.png");
    expect(mediaCall[1]).toMatchObject({
      method: "GET",
      redirect: "error",
      headers: { accept: "image/png, image/jpeg, image/webp" }
    });
    expect(JSON.stringify(mediaCall[1])).not.toContain("fal-secret");
  });

  it("completes the ledger only after fully validating the image and does not complete twice", async () => {
    const token = jobToken();
    const state = stateFixture({ initialJob: storedObjectJob() });
    const allowances = allowanceFixture();
    const bytes = pngBytes();
    const fetcher = vi.fn<typeof fetch>();
    for (let replay = 0; replay < 2; replay += 1) {
      fetcher
        .mockResolvedValueOnce(Response.json({ status: "COMPLETED", request_id: requestId }))
        .mockResolvedValueOnce(Response.json({
          images: [{ url: "https://v3.fal.media/files/rabbit/result.png" }]
        }))
        .mockResolvedValueOnce(new Response(responseBody(bytes), {
          headers: { "content-type": "image/png" }
        }));
    }
    const handler = handlerWith(fetcher, 1_000, state, allowances);

    const first = await handler(authenticatedGet(
      `/api/image-lab/assets?job=${encodeURIComponent(token)}`
    ));
    const replay = await handler(authenticatedGet(
      `/api/image-lab/assets?job=${encodeURIComponent(token)}`
    ));

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(allowances.complete).toHaveBeenCalledOnce();
    expect(state.markCompleted).toHaveBeenCalledOnce();
  });

  it("refunds one completed job whose result is conclusively empty", async () => {
    const token = jobToken();
    const state = stateFixture({ initialJob: storedObjectJob() });
    const allowances = allowanceFixture();
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ status: "COMPLETED", request_id: requestId }))
      .mockResolvedValueOnce(Response.json({ images: [] }));

    const response = await handlerWith(
      fetcher,
      1_000,
      state,
      allowances
    )(authenticatedGet(`/api/image-lab/assets?job=${encodeURIComponent(token)}`));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "INVALID_IMAGE_RESULT" });
    expect(allowances.refund).toHaveBeenCalledOnce();
    expect(state.markRefunded).toHaveBeenCalledOnce();
  });

  it("refuses assets before completion and unsafe fal result URLs", async () => {
    const token = jobToken();
    const queuedFetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      status: "IN_PROGRESS",
      request_id: requestId
    }));
    const queued = await handlerWith(queuedFetcher)(authenticatedGet(
      `/api/image-lab/assets?job=${encodeURIComponent(token)}`
    ));
    expect(queued.status).toBe(409);
    expect(await queued.json()).toEqual({ error: "JOB_NOT_READY" });

    const unsafeFetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ status: "COMPLETED", request_id: requestId }))
      .mockResolvedValueOnce(Response.json({ images: [{ url: "https://evil.example/result.png" }] }));
    const unsafe = await handlerWith(unsafeFetcher)(authenticatedGet(
      `/api/image-lab/assets?job=${encodeURIComponent(token)}`
    ));
    expect(unsafe.status).toBe(502);
    expect(await unsafe.json()).toEqual({ error: "INVALID_IMAGE_RESULT" });
    expect(unsafeFetcher).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["MIME-signature mismatch", "image/png", jpegBytes(), {}],
    ["wrong dimensions", "image/png", pngBytes(640, 480), {}],
    ["unsupported type", "image/svg+xml", new TextEncoder().encode("<svg/>") , {}],
    ["declared over ceiling", "image/png", pngBytes(), { "content-length": String(IMAGE_LAB_ASSET_MAX_BYTES + 1) }]
  ])("rejects an invalid upstream asset: %s", async (_label, contentType, bytes, extraHeaders) => {
    const fetcher = completedQueueResponses(new Response(responseBody(bytes), {
      headers: { "content-type": contentType, ...extraHeaders }
    }));
    const response = await handlerWith(fetcher)(authenticatedGet(
      `/api/image-lab/assets?job=${encodeURIComponent(jobToken())}`
    ));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "INVALID_IMAGE_RESULT" });
  });

  it("uses exact routes, methods and query keys", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const handler = handlerWith(fetcher);
    const wrongJobsMethod = await handler(makeRequest("/api/image-lab/jobs", { method: "DELETE" }));
    const wrongAssetsMethod = await handler(makeRequest("/api/image-lab/assets", { method: "POST" }));
    const unknown = await handler(makeRequest("/api/image-lab/other"));
    const postQuery = await handler(makeRequest("/api/image-lab/jobs?job=unexpected", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(objectRequest)
    }));

    expect(wrongJobsMethod.status).toBe(405);
    expect(wrongJobsMethod.headers.get("allow")).toBe("GET, POST");
    expect(wrongAssetsMethod.status).toBe(405);
    expect(unknown.status).toBe(404);
    expect(postQuery.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
