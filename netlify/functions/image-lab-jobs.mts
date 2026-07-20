import type { Config, Context } from "@netlify/functions";
import { createHash } from "node:crypto";
import {
  FAL_IMAGE_MAX_BYTES,
  FLUX2_TURBO_EDIT_PROFILE,
  FalImagePolicyError,
  MAKE_IT_REAL_PROFILE,
  OBJECT_FORGE_PROFILE,
  Z_IMAGE_LORA_PROFILE,
  assertGptImage2ConcreteSize,
  composeMakeItRealPrompt,
  composeObjectForgePrompt,
  parseFalImageRequest,
  type FalImageRequest,
  type MakeItRealRequest,
  type ObjectForgeRequest
} from "./lib/fal-image-policy";
import {
  IMAGE_LAB_COOKIE,
  ImageLabAuthError,
  createCapability,
  createJobToken,
  parseImageLabEnvironment,
  readCapability,
  readJobToken,
  serialiseCapabilityCookie,
  type ImageLabCapability,
  type ImageLabJobToken,
  type ImageLabStage,
  type ReadyImageLabEnvironment
} from "./lib/image-lab-auth";
import {
  ImageLabStateError,
  type ImageLabJobReservation,
  type ImageLabStoredJob
} from "./lib/image-lab-state";
import { defaultImageLabStateService } from "./lib/netlify-image-lab-state";
import {
  FalQueueError,
  falImageUrl,
  falJobStatus,
  submitFalJob
} from "./lib/fal-queue";
import {
  OpenverseError,
  countedImageStream,
  parseSafeImageContentType,
  readValidatedImageHeader
} from "./lib/openverse";

export const OBJECT_FORGE_PROFILE_ID = "object-forge-gpt-image-2-low-v1";
export const LEGACY_MAKE_IT_REAL_PROFILE_ID = "make-it-real-gpt-image-2-high-v1";
export const MAKE_IT_REAL_PROFILE_ID = "make-it-real-gpt-image-2-high-v2";
export const Z_IMAGE_LORA_PROFILE_ID = "z-image-lora-v1";
export const FLUX2_TURBO_EDIT_PROFILE_ID = "flux2-turbo-edit-v1";
export const IMAGE_LAB_ASSET_MAX_BYTES = 8 * 1_048_576;

const JOB_JSON_MAX_BYTES = 4 * Math.ceil(FAL_IMAGE_MAX_BYTES / 3) + 16 * 1_024;
const JOB_TOKEN_MAX_LENGTH = 4_096;
const JOB_LIFETIME_SECONDS = 3_600;
const UPSTREAM_TIMEOUT_MS = 12_000;
const FAL_START_TIMEOUT_SECONDS = 30;
const ENVIRONMENT_KEYS = [
  "IMAGE_LAB_ENABLED",
  "IMAGE_LAB_SCHOOL_APPROVED",
  "IMAGE_LAB_ACCOUNT_CAP_USD",
  "IMAGE_LAB_CLASSROOM_CODE",
  "IMAGE_LAB_SIGNING_SECRET",
  "IMAGE_LAB_SESSION_MINUTES",
  "IMAGE_LAB_OBJECT_ALLOWANCE",
  "IMAGE_LAB_REALISE_ALLOWANCE",
  "IMAGE_LAB_OBJECT_PROFILE_ID",
  "IMAGE_LAB_REALISE_PROFILE_ID",
  "IMAGE_LAB_Z_LORA_URL",
  "FAL_KEY"
] as const;

type ImageLabEnvironmentRecord = Readonly<Record<string, string | undefined>>;
type DeadlineOperation = "submit" | "status" | "asset";

export interface ImageLabJobsDependencies {
  environment?: ImageLabEnvironmentRecord;
  fetch?: typeof fetch;
  nowSeconds?: () => number;
  secureCookies?: boolean;
  createDeadlineSignal?: (operation: DeadlineOperation) => AbortSignal;
  state?: ImageLabJobsState;
}

export interface ImageLabJobsState {
  reserve(
    identity: { sessionId: string; teamId: string },
    input: {
      idempotencyKey: string;
      requestHash: string;
      stage: ImageLabStage;
      profileId: string;
      nowSeconds: number;
    }
  ): Promise<ImageLabJobReservation>;
  attachRequest(
    identity: { sessionId: string; teamId: string },
    jobId: string,
    requestId: string
  ): Promise<ImageLabStoredJob>;
  markIndeterminate(
    identity: { sessionId: string; teamId: string },
    jobId: string
  ): Promise<ImageLabStoredJob>;
  getJob(
    identity: { sessionId: string; teamId: string },
    jobId: string
  ): Promise<ImageLabStoredJob>;
}

interface ResolvedDependencies {
  environment?: ImageLabEnvironmentRecord;
  fetch: typeof fetch;
  nowSeconds: () => number;
  secureCookies?: boolean;
  createDeadlineSignal: (operation: DeadlineOperation) => AbortSignal;
  state?: ImageLabJobsState;
}

interface JobBinding {
  job: ImageLabJobToken;
  stored: ImageLabStoredJob;
  modelId: string;
  width: number;
  height: number;
}

interface SubmissionProfile {
  readonly profileId: string;
  readonly modelId: string;
  readonly width: number;
  readonly height: number;
  readonly input: Readonly<Record<string, unknown>>;
}

class ImageLabJobsError extends Error {
  constructor(
    readonly code: string,
    readonly status: number
  ) {
    super(code);
    this.name = "ImageLabJobsError";
  }
}

const runtimeEnvironment = (): ImageLabEnvironmentRecord => Object.fromEntries(
  ENVIRONMENT_KEYS.map((key) => [key, Netlify.env.get(key)])
);

const json = (body: unknown, status = 200, headers: HeadersInit = {}): Response =>
  Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      ...Object.fromEntries(new Headers(headers))
    }
  });

const methodNotAllowed = (allow: string): Response =>
  json({ error: "METHOD_NOT_ALLOWED" }, 405, { allow });

const resolveDependencies = (dependencies: ImageLabJobsDependencies): ResolvedDependencies => ({
  ...(dependencies.environment === undefined ? {} : { environment: dependencies.environment }),
  fetch: dependencies.fetch ?? ((input, init) => fetch(input, init)),
  nowSeconds: dependencies.nowSeconds ?? (() => Math.floor(Date.now() / 1_000)),
  ...(dependencies.secureCookies === undefined ? {} : { secureCookies: dependencies.secureCookies }),
  createDeadlineSignal: dependencies.createDeadlineSignal ?? (() => AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)),
  ...(dependencies.state === undefined ? {} : { state: dependencies.state })
});

function requireReadyEnvironment(record: ImageLabEnvironmentRecord): ReadyImageLabEnvironment {
  const environment = parseImageLabEnvironment(record);
  if (!environment.enabled) throw new ImageLabJobsError("IMAGE_LAB_DISABLED", 503);
  return environment;
}

function readCookieValue(request: Request): string {
  const header = request.headers.get("cookie");
  if (!header) throw new ImageLabJobsError("IMAGE_LAB_LOCKED", 401);
  const values: string[] = [];
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name === IMAGE_LAB_COOKIE) values.push(part.slice(separator + 1).trim());
  }
  if (values.length !== 1 || !values[0] || values[0].length > JOB_TOKEN_MAX_LENGTH) {
    throw new ImageLabJobsError("IMAGE_LAB_LOCKED", 401);
  }
  return values[0];
}

function requireCapability(
  request: Request,
  environment: ReadyImageLabEnvironment,
  nowSeconds: number
): ImageLabCapability {
  try {
    return readCapability(readCookieValue(request), environment.signingSecret, nowSeconds);
  } catch (error) {
    if (error instanceof ImageLabJobsError) throw error;
    if (error instanceof ImageLabAuthError && error.code === "EXPIRED_TOKEN") {
      throw new ImageLabJobsError("SESSION_EXPIRED", 401);
    }
    throw new ImageLabJobsError("IMAGE_LAB_LOCKED", 401);
  }
}

function stateFailure(error: unknown): ImageLabJobsError {
  if (!(error instanceof ImageLabStateError)) {
    return new ImageLabJobsError("IMAGE_STATE_UNAVAILABLE", 503);
  }
  switch (error.code) {
    case "PAIR_NOT_UNLOCKED": return new ImageLabJobsError("IMAGE_LAB_LOCKED", 401);
    case "SESSION_EXPIRED": return new ImageLabJobsError("SESSION_EXPIRED", 401);
    case "ALLOWANCE_EXHAUSTED": return new ImageLabJobsError("ALLOWANCE_EXHAUSTED", 429);
    case "IDEMPOTENCY_CONFLICT": return new ImageLabJobsError("IDEMPOTENCY_CONFLICT", 409);
    case "JOB_NOT_FOUND": return new ImageLabJobsError("JOB_NOT_FOUND", 404);
    default: return new ImageLabJobsError("IMAGE_STATE_UNAVAILABLE", 503);
  }
}

function requireNoQuery(url: URL): void {
  if ([...url.searchParams.keys()].length !== 0) {
    throw new ImageLabJobsError("INVALID_PARAMETERS", 400);
  }
}

function requireJobQuery(url: URL): string {
  const keys = [...url.searchParams.keys()];
  const values = url.searchParams.getAll("job");
  if (keys.length !== 1 || keys[0] !== "job" || values.length !== 1 ||
    !values[0] || values[0].length > JOB_TOKEN_MAX_LENGTH) {
    throw new ImageLabJobsError("INVALID_PARAMETERS", 400);
  }
  return values[0];
}

async function readRequestJson(request: Request): Promise<unknown> {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const encoding = request.headers.get("content-encoding")?.trim().toLowerCase();
  if (mediaType !== "application/json" || encoding && encoding !== "identity") {
    throw new ImageLabJobsError("UNSUPPORTED_MEDIA_TYPE", 415);
  }
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > JOB_JSON_MAX_BYTES)) {
    throw new ImageLabJobsError("REQUEST_TOO_LARGE", 413);
  }
  if (!request.body) throw new ImageLabJobsError("INVALID_REQUEST", 400);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      byteLength += next.value.byteLength;
      if (byteLength > JOB_JSON_MAX_BYTES) {
        await reader.cancel();
        throw new ImageLabJobsError("REQUEST_TOO_LARGE", 413);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    throw new ImageLabJobsError("INVALID_REQUEST", 400);
  }
}

function identityMatches(request: FalImageRequest, capability: ImageLabCapability): boolean {
  return request.sessionId === capability.sessionId && request.teamId === capability.teamId;
}

function jobStage(request: FalImageRequest): ImageLabStage {
  return request.stage === "object" ? "object-forge" : "make-it-real";
}

function gptImage2InputSize(size: { width: number; height: number }): Readonly<{
  width: number;
  height: number;
}> {
  try {
    return assertGptImage2ConcreteSize(size);
  } catch (error) {
    if (error instanceof FalImagePolicyError && error.code === "INVALID_PROFILE_DIMENSIONS") {
      throw new ImageLabJobsError("IMAGE_PROFILE_CONFIGURATION_INVALID", 503);
    }
    throw error;
  }
}

function objectForgeInput(request: ObjectForgeRequest): Readonly<Record<string, unknown>> {
  return {
    prompt: composeObjectForgePrompt(request),
    image_size: gptImage2InputSize({
      width: OBJECT_FORGE_PROFILE.width,
      height: OBJECT_FORGE_PROFILE.height
    }),
    quality: OBJECT_FORGE_PROFILE.quality,
    num_images: OBJECT_FORGE_PROFILE.images,
    output_format: OBJECT_FORGE_PROFILE.outputFormat
  };
}

function zImageLoraInput(
  request: ObjectForgeRequest,
  loraUrl: string
): Readonly<Record<string, unknown>> {
  return {
    prompt: composeObjectForgePrompt(request),
    image_size: { width: Z_IMAGE_LORA_PROFILE.width, height: Z_IMAGE_LORA_PROFILE.height },
    num_inference_steps: Z_IMAGE_LORA_PROFILE.steps,
    num_images: Z_IMAGE_LORA_PROFILE.images,
    enable_safety_checker: Z_IMAGE_LORA_PROFILE.safetyChecker,
    output_format: Z_IMAGE_LORA_PROFILE.outputFormat,
    acceleration: Z_IMAGE_LORA_PROFILE.acceleration,
    enable_prompt_expansion: Z_IMAGE_LORA_PROFILE.promptExpansion,
    loras: [{ path: loraUrl, scale: Z_IMAGE_LORA_PROFILE.loraScale }]
  };
}

function makeItRealInput(request: MakeItRealRequest): Readonly<Record<string, unknown>> {
  return {
    image_urls: [request.designDataUrl],
    image_size: gptImage2InputSize(MAKE_IT_REAL_PROFILE.imageSize),
    quality: MAKE_IT_REAL_PROFILE.quality,
    output_format: MAKE_IT_REAL_PROFILE.outputFormat,
    num_images: MAKE_IT_REAL_PROFILE.images,
    prompt: composeMakeItRealPrompt(request)
  };
}

function flux2TurboEditInput(request: MakeItRealRequest): Readonly<Record<string, unknown>> {
  return {
    image_urls: [request.designDataUrl],
    image_size: {
      width: FLUX2_TURBO_EDIT_PROFILE.width,
      height: FLUX2_TURBO_EDIT_PROFILE.height
    },
    guidance_scale: FLUX2_TURBO_EDIT_PROFILE.guidance,
    enable_safety_checker: FLUX2_TURBO_EDIT_PROFILE.safetyChecker,
    output_format: FLUX2_TURBO_EDIT_PROFILE.outputFormat,
    num_images: FLUX2_TURBO_EDIT_PROFILE.images,
    enable_prompt_expansion: FLUX2_TURBO_EDIT_PROFILE.promptExpansion,
    prompt: composeMakeItRealPrompt(request)
  };
}

const PROFILE_URL_MAX_LENGTH = 2_048;

function requireSafeLoraUrl(value: string | undefined): string {
  if (typeof value !== "string" || value.length < 1 || value.length > PROFILE_URL_MAX_LENGTH ||
    value !== value.trim() || /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value)) {
    throw new ImageLabJobsError("IMAGE_PROFILE_CONFIGURATION_INVALID", 503);
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.port || url.hash) {
      throw new Error("unsafe URL");
    }
  } catch {
    throw new ImageLabJobsError("IMAGE_PROFILE_CONFIGURATION_INVALID", 503);
  }
  return value;
}

function resolveSubmissionProfile(
  request: FalImageRequest,
  environment: ImageLabEnvironmentRecord
): SubmissionProfile {
  const objectProfileId = environment.IMAGE_LAB_OBJECT_PROFILE_ID ?? OBJECT_FORGE_PROFILE_ID;
  const realiseProfileId = environment.IMAGE_LAB_REALISE_PROFILE_ID ?? MAKE_IT_REAL_PROFILE_ID;
  if (objectProfileId !== OBJECT_FORGE_PROFILE_ID && objectProfileId !== Z_IMAGE_LORA_PROFILE_ID ||
    realiseProfileId !== MAKE_IT_REAL_PROFILE_ID && realiseProfileId !== FLUX2_TURBO_EDIT_PROFILE_ID) {
    throw new ImageLabJobsError("IMAGE_PROFILE_CONFIGURATION_INVALID", 503);
  }

  if (request.stage === "object") {
    if (objectProfileId === Z_IMAGE_LORA_PROFILE_ID) {
      return {
        profileId: Z_IMAGE_LORA_PROFILE_ID,
        modelId: Z_IMAGE_LORA_PROFILE.model,
        width: Z_IMAGE_LORA_PROFILE.width,
        height: Z_IMAGE_LORA_PROFILE.height,
        input: zImageLoraInput(request, requireSafeLoraUrl(environment.IMAGE_LAB_Z_LORA_URL))
      };
    }
    return {
      profileId: OBJECT_FORGE_PROFILE_ID,
      modelId: OBJECT_FORGE_PROFILE.model,
      width: OBJECT_FORGE_PROFILE.width,
      height: OBJECT_FORGE_PROFILE.height,
      input: objectForgeInput(request)
    };
  }

  if (realiseProfileId === FLUX2_TURBO_EDIT_PROFILE_ID) {
    return {
      profileId: FLUX2_TURBO_EDIT_PROFILE_ID,
      modelId: FLUX2_TURBO_EDIT_PROFILE.model,
      width: FLUX2_TURBO_EDIT_PROFILE.width,
      height: FLUX2_TURBO_EDIT_PROFILE.height,
      input: flux2TurboEditInput(request)
    };
  }
  return {
    profileId: MAKE_IT_REAL_PROFILE_ID,
    modelId: MAKE_IT_REAL_PROFILE.model,
    width: MAKE_IT_REAL_PROFILE.width,
    height: MAKE_IT_REAL_PROFILE.height,
    input: makeItRealInput(request)
  };
}

function canonicalRequestHash(request: FalImageRequest, profile: SubmissionProfile): string {
  return createHash("sha256").update(JSON.stringify({
    stage: jobStage(request),
    profileId: profile.profileId,
    modelId: profile.modelId,
    input: profile.input
  }), "utf8").digest("hex");
}

function rotatedCapabilityCookie(
  capability: ImageLabCapability,
  remaining: { object: number; realise: number; expiresAt: number },
  environment: ReadyImageLabEnvironment,
  nowSeconds: number,
  secure: boolean
): string {
  const token = createCapability({
    sessionId: capability.sessionId,
    teamId: capability.teamId,
    remainingObject: remaining.object,
    remainingRealise: remaining.realise,
    expiresAt: remaining.expiresAt
  }, environment.signingSecret);
  return serialiseCapabilityCookie(token, remaining.expiresAt - nowSeconds, secure);
}

function serviceFailure(signal: AbortSignal): ImageLabJobsError {
  return signal.aborted
    ? new ImageLabJobsError("IMAGE_SERVICE_TIMEOUT", 504)
    : new ImageLabJobsError("IMAGE_SERVICE_UNAVAILABLE", 502);
}

async function submitJob(
  request: Request,
  url: URL,
  dependencies: ResolvedDependencies,
  environment: ReadyImageLabEnvironment,
  environmentRecord: ImageLabEnvironmentRecord,
  capability: ImageLabCapability,
  nowSeconds: number,
  state: ImageLabJobsState
): Promise<Response> {
  requireNoQuery(url);
  let parsed: FalImageRequest;
  try {
    parsed = parseFalImageRequest(await readRequestJson(request));
  } catch (error) {
    if (error instanceof ImageLabJobsError) throw error;
    if (error instanceof FalImagePolicyError) {
      throw new ImageLabJobsError(
        error.code === "IMAGE_TOO_LARGE" ? "REQUEST_TOO_LARGE" : "INVALID_REQUEST",
        error.code === "IMAGE_TOO_LARGE" ? 413 : 400
      );
    }
    throw error;
  }
  if (!identityMatches(parsed, capability)) {
    throw new ImageLabJobsError("IDENTITY_MISMATCH", 403);
  }

  const profile = resolveSubmissionProfile(parsed, environmentRecord);
  const stage = jobStage(parsed);
  const identity = { sessionId: capability.sessionId, teamId: capability.teamId };
  let reservation: ImageLabJobReservation;
  try {
    reservation = await state.reserve(identity, {
      idempotencyKey: parsed.idempotencyKey,
      requestHash: canonicalRequestHash(parsed, profile),
      stage,
      profileId: profile.profileId,
      nowSeconds
    });
  } catch (error) {
    throw stateFailure(error);
  }

  if (reservation.created) {
    const signal = dependencies.createDeadlineSignal("submit");
    let requestId: string;
    try {
      requestId = await submitFalJob({
        fetch: dependencies.fetch,
        falKey: environment.falKey,
        modelId: profile.modelId,
        input: profile.input,
        startTimeoutSeconds: FAL_START_TIMEOUT_SECONDS,
        signal
      });
    } catch {
      await state.markIndeterminate(identity, reservation.job.id).catch(() => undefined);
      throw serviceFailure(signal);
    }
    try {
      reservation = {
        ...reservation,
        job: await state.attachRequest(identity, reservation.job.id, requestId)
      };
    } catch (error) {
      await state.markIndeterminate(identity, reservation.job.id).catch(() => undefined);
      throw stateFailure(error);
    }
  }

  const token = createJobToken({
    jobId: reservation.job.id,
    stage,
    profileId: reservation.job.profileId,
    sessionId: capability.sessionId,
    teamId: capability.teamId,
    expiresAt: nowSeconds + JOB_LIFETIME_SECONDS
  }, environment.signingSecret);
  const secure = dependencies.secureCookies ?? url.protocol === "https:";
  return json({
    jobToken: token,
    stage: parsed.stage,
    remaining: {
      object: reservation.object,
      realise: reservation.realise
    }
  }, 202, {
    "set-cookie": rotatedCapabilityCookie(capability, reservation, environment, nowSeconds, secure)
  });
}

async function requireBoundJob(
  token: string,
  capability: ImageLabCapability,
  environment: ReadyImageLabEnvironment,
  nowSeconds: number,
  state: ImageLabJobsState
): Promise<JobBinding> {
  let job: ImageLabJobToken;
  try {
    job = readJobToken(token, environment.signingSecret, {
      sessionId: capability.sessionId,
      teamId: capability.teamId,
      nowSeconds
    });
  } catch {
    throw new ImageLabJobsError("JOB_NOT_FOUND", 404);
  }
  let stored: ImageLabStoredJob;
  try {
    stored = await state.getJob({
      sessionId: capability.sessionId,
      teamId: capability.teamId
    }, job.jobId);
  } catch (error) {
    throw stateFailure(error);
  }
  if (stored.id !== job.jobId || stored.stage !== job.stage || stored.profileId !== job.profileId) {
    throw new ImageLabJobsError("JOB_NOT_FOUND", 404);
  }
  if (job.stage === "object-forge" && job.profileId === OBJECT_FORGE_PROFILE_ID) {
    return {
      job,
      stored,
      modelId: OBJECT_FORGE_PROFILE.model,
      width: OBJECT_FORGE_PROFILE.width,
      height: OBJECT_FORGE_PROFILE.height
    };
  }
  if (job.stage === "object-forge" && job.profileId === Z_IMAGE_LORA_PROFILE_ID) {
    return {
      job,
      stored,
      modelId: Z_IMAGE_LORA_PROFILE.model,
      width: Z_IMAGE_LORA_PROFILE.width,
      height: Z_IMAGE_LORA_PROFILE.height
    };
  }
  if (job.stage === "make-it-real" && job.profileId === MAKE_IT_REAL_PROFILE_ID) {
    return {
      job,
      stored,
      modelId: MAKE_IT_REAL_PROFILE.model,
      width: MAKE_IT_REAL_PROFILE.width,
      height: MAKE_IT_REAL_PROFILE.height
    };
  }
  if (job.stage === "make-it-real" && job.profileId === LEGACY_MAKE_IT_REAL_PROFILE_ID) {
    return {
      job,
      stored,
      modelId: MAKE_IT_REAL_PROFILE.model,
      width: 1_088,
      height: 608
    };
  }
  if (job.stage === "make-it-real" && job.profileId === FLUX2_TURBO_EDIT_PROFILE_ID) {
    return {
      job,
      stored,
      modelId: FLUX2_TURBO_EDIT_PROFILE.model,
      width: FLUX2_TURBO_EDIT_PROFILE.width,
      height: FLUX2_TURBO_EDIT_PROFILE.height
    };
  }
  throw new ImageLabJobsError("JOB_NOT_FOUND", 404);
}

async function readStatus(
  binding: JobBinding,
  dependencies: ResolvedDependencies,
  environment: ReadyImageLabEnvironment
): Promise<Response> {
  if (binding.stored.state === "indeterminate") return json({ status: "failed" });
  if (binding.stored.state === "submitting" || !binding.stored.requestId) {
    return json({ status: "queued" });
  }
  const signal = dependencies.createDeadlineSignal("status");
  try {
    const status = await falJobStatus({
      fetch: dependencies.fetch,
      falKey: environment.falKey,
      modelId: binding.modelId,
      requestId: binding.stored.requestId,
      signal
    });
    return json(status);
  } catch {
    throw serviceFailure(signal);
  }
}

function isAllowedFalMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash &&
      (host === "fal.media" || host.endsWith(".fal.media"));
  } catch {
    return false;
  }
}

function declaredAssetLengthIsInvalid(response: Response): boolean {
  const value = response.headers.get("content-length");
  return value !== null && (!/^\d+$/.test(value) || Number(value) > IMAGE_LAB_ASSET_MAX_BYTES);
}

async function readAsset(
  binding: JobBinding,
  dependencies: ResolvedDependencies,
  environment: ReadyImageLabEnvironment
): Promise<Response> {
  if (binding.stored.state === "indeterminate") {
    throw new ImageLabJobsError("JOB_FAILED", 422);
  }
  if (binding.stored.state === "submitting" || !binding.stored.requestId) {
    throw new ImageLabJobsError("JOB_NOT_READY", 409);
  }
  const signal = dependencies.createDeadlineSignal("asset");
  let status;
  try {
    status = await falJobStatus({
      fetch: dependencies.fetch,
      falKey: environment.falKey,
      modelId: binding.modelId,
      requestId: binding.stored.requestId,
      signal
    });
  } catch {
    throw serviceFailure(signal);
  }
  if (status.status === "failed") throw new ImageLabJobsError("JOB_FAILED", 422);
  if (status.status !== "completed") throw new ImageLabJobsError("JOB_NOT_READY", 409);

  let mediaUrl: string;
  try {
    mediaUrl = await falImageUrl({
      fetch: dependencies.fetch,
      falKey: environment.falKey,
      modelId: binding.modelId,
      requestId: binding.stored.requestId,
      signal
    });
  } catch (error) {
    if (error instanceof FalQueueError && error.code === "INVALID_RESPONSE") {
      throw new ImageLabJobsError("INVALID_IMAGE_RESULT", 502);
    }
    throw serviceFailure(signal);
  }
  if (!isAllowedFalMediaUrl(mediaUrl)) throw new ImageLabJobsError("INVALID_IMAGE_RESULT", 502);

  let mediaResponse: Response;
  try {
    mediaResponse = await dependencies.fetch(mediaUrl, {
      method: "GET",
      redirect: "error",
      signal,
      headers: { accept: "image/png, image/jpeg, image/webp" }
    });
  } catch {
    throw serviceFailure(signal);
  }
  if (!mediaResponse.ok || declaredAssetLengthIsInvalid(mediaResponse)) {
    await mediaResponse.body?.cancel().catch(() => undefined);
    throw new ImageLabJobsError("INVALID_IMAGE_RESULT", 502);
  }
  const contentType = parseSafeImageContentType(mediaResponse.headers.get("content-type"));
  if (!contentType || !mediaResponse.body) {
    await mediaResponse.body?.cancel().catch(() => undefined);
    throw new ImageLabJobsError("INVALID_IMAGE_RESULT", 502);
  }

  try {
    const { reader, initialChunks, dimensions } = await readValidatedImageHeader(
      mediaResponse.body,
      contentType,
      signal
    );
    if (dimensions.width !== binding.width || dimensions.height !== binding.height) {
      await reader.cancel();
      reader.releaseLock();
      throw new ImageLabJobsError("INVALID_IMAGE_RESULT", 502);
    }
    return new Response(countedImageStream(
      reader,
      initialChunks,
      signal,
      IMAGE_LAB_ASSET_MAX_BYTES
    ), {
      headers: {
        "content-type": contentType,
        "cache-control": "no-store",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (error) {
    if (error instanceof ImageLabJobsError) throw error;
    if (error instanceof OpenverseError) {
      throw new ImageLabJobsError("INVALID_IMAGE_RESULT", 502);
    }
    throw serviceFailure(signal);
  }
}

export function createImageLabJobsHandler(
  suppliedDependencies: ImageLabJobsDependencies = {}
): (request: Request, context?: Context) => Promise<Response> {
  const dependencies = resolveDependencies(suppliedDependencies);
  return async (request) => {
    const url = new URL(request.url);
    const isJobs = url.pathname === "/api/image-lab/jobs";
    const isAssets = url.pathname === "/api/image-lab/assets";
    if (!isJobs && !isAssets) return json({ error: "NOT_FOUND" }, 404);
    if (isJobs && request.method !== "GET" && request.method !== "POST") {
      return methodNotAllowed("GET, POST");
    }
    if (isAssets && request.method !== "GET") return methodNotAllowed("GET");

    try {
      const environmentRecord = dependencies.environment ?? runtimeEnvironment();
      const environment = requireReadyEnvironment(environmentRecord);
      const nowSeconds = Math.floor(dependencies.nowSeconds());
      const capability = requireCapability(request, environment, nowSeconds);
      let state: ImageLabJobsState;
      try {
        state = dependencies.state ?? await defaultImageLabStateService();
      } catch {
        throw new ImageLabJobsError("IMAGE_STATE_UNAVAILABLE", 503);
      }
      if (isJobs && request.method === "POST") {
        return await submitJob(
          request,
          url,
          dependencies,
          environment,
          environmentRecord,
          capability,
          nowSeconds,
          state
        );
      }

      const token = requireJobQuery(url);
      const binding = await requireBoundJob(token, capability, environment, nowSeconds, state);
      return isJobs
        ? await readStatus(binding, dependencies, environment)
        : await readAsset(binding, dependencies, environment);
    } catch (error) {
      if (error instanceof ImageLabJobsError) return json({ error: error.code }, error.status);
      return json({ error: "INTERNAL_ERROR" }, 500);
    }
  };
}

export default createImageLabJobsHandler();

export const config: Config = {
  path: ["/api/image-lab/jobs", "/api/image-lab/assets"],
  rateLimit: {
    windowLimit: 1_200,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
