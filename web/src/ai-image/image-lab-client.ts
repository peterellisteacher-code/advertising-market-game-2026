const JSON_RESPONSE_LIMIT = 64 * 1024;
const IMAGE_RESPONSE_LIMIT = 8 * 1024 * 1024;
const DESIGN_DATA_URL_LIMIT = 10 * 1024 * 1024;
const DEFAULT_POLL_ATTEMPTS = 30;
const MAX_POLL_ATTEMPTS = 60;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const MAX_POLL_INTERVAL_MS = 10_000;

const JSON_HEADERS = { accept: "application/json" } as const;
const JSON_POST_HEADERS = {
  accept: "application/json",
  "content-type": "application/json"
} as const;
const IMAGE_HEADERS = { accept: "image/png, image/jpeg, image/webp" } as const;

export interface ImageLabRemaining {
  object: number;
  realise: number;
}

export interface ImageLabStageAllowance {
  remaining: number;
  reserved: number;
}

export type StudentImageLabStatus =
  | { enabled: false; reason: "disabled" }
  | {
      enabled: true;
      object: ImageLabStageAllowance;
      realise: ImageLabStageAllowance;
    };

export interface ObjectForgeJobRequest {
  stage: "object";
  idempotencyKey: string;
  objectName: string;
  category: string;
  style: string;
  colour: string;
}

export interface ProductRealisationJobRequest {
  stage: "realise";
  idempotencyKey: string;
  designDataUrl: string;
  productKind: string;
  scene: string;
}

export type RealiseJobRequest = ProductRealisationJobRequest;

export interface AdvertisementRealisationContext {
  productName: string;
  productFunction: string;
  targetAudience: string;
  advertisingLocation: string;
  attention: string;
  interest: string;
  desire: string;
  action: string;
}

export interface AdvertisementRealisationSource {
  documentId: string;
  context: AdvertisementRealisationContext;
}

export interface AdvertisementRealisationJobRequest {
  stage: "realise";
  mode: "advertisement";
  idempotencyKey: string;
  documentId: string;
  designDataUrl: string;
  finish: string;
  improvements: string[];
  context: AdvertisementRealisationContext;
}

export type ImageLabJobRequest = ObjectForgeJobRequest |
  ProductRealisationJobRequest |
  AdvertisementRealisationJobRequest;
export type ImageLabStage = ImageLabJobRequest["stage"];

export interface ImageLabJobCreated {
  jobToken: string;
  stage: ImageLabStage;
  remaining: ImageLabRemaining;
}

export type ImageLabJobState = "queued" | "working" | "completed" | "failed" | "unknown";
export type ImageLabJobStatus =
  | { status: ImageLabJobState }
  | { status: ImageLabJobState; position: number };

export type ImageLabClientErrorCode =
  | "INVALID_REQUEST"
  | "NETWORK_ERROR"
  | "CANCELLED"
  | "REDIRECT_BLOCKED"
  | "HTTP_ERROR"
  | "UNEXPECTED_CONTENT_TYPE"
  | "RESPONSE_TOO_LARGE"
  | "INVALID_RESPONSE"
  | "POLL_LIMIT"
  | "IMAGE_LAB_DISABLED"
  | "ALLOWANCE_EXHAUSTED"
  | "AUTHENTICATION_REQUIRED"
  | "IMAGE_LAB_UNAVAILABLE"
  | "JOB_OUTCOME_UNCERTAIN"
  | "JOB_NOT_FOUND"
  | "RATE_LIMITED"
  | "TIMEOUT";

export class ImageLabClientError extends Error {
  readonly code: ImageLabClientErrorCode;
  readonly status: number | undefined;

  constructor(
    code: ImageLabClientErrorCode,
    message: string,
    options: { status?: number; cause?: unknown } = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ImageLabClientError";
    this.code = code;
    this.status = options.status;
  }
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type SleepLike = (milliseconds: number, signal?: AbortSignal) => Promise<void>;

export interface ImageLabClientDependencies {
  fetch?: FetchLike;
  sleep?: SleepLike;
  jsonTimeoutMs?: number;
  assetTimeoutMs?: number;
}

export interface ImageLabRequestOptions {
  signal?: AbortSignal | undefined;
}

export interface ImageLabPollOptions extends ImageLabRequestOptions {
  maxAttempts?: number;
  intervalMs?: number;
}

const ownRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const hasExactKeys = (record: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
};

const boundedString = (value: unknown, maxLength: number): value is string =>
  typeof value === "string" && value.length >= 1 && value.length <= maxLength &&
  value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);

const boundedInteger = (value: unknown, maximum: number): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= maximum;

function fail(
  code: ImageLabClientErrorCode,
  message: string,
  options?: { status?: number; cause?: unknown }
): never {
  throw new ImageLabClientError(code, message, options);
}

const isAbort = (cause: unknown, signal?: AbortSignal): boolean => {
  if (signal?.aborted) return true;
  return typeof cause === "object" && cause !== null && "name" in cause &&
    (cause as { name?: unknown }).name === "AbortError";
};

const throwIfCancelled = (signal?: AbortSignal): void => {
  if (signal?.aborted) fail("CANCELLED", "The Image Lab request was cancelled.");
};

const defaultSleep: SleepLike = (milliseconds, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(new ImageLabClientError("CANCELLED", "The Image Lab request was cancelled."));
    return;
  }
  const timer = globalThis.setTimeout(() => {
    signal?.removeEventListener("abort", onAbort);
    resolve();
  }, milliseconds);
  const onAbort = (): void => {
    globalThis.clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    reject(new ImageLabClientError("CANCELLED", "The Image Lab request was cancelled."));
  };
  signal?.addEventListener("abort", onAbort, { once: true });
});

class ImageLabDeadline {
  readonly #controller = new AbortController();
  readonly #external: AbortSignal | undefined;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #timedOut = false;
  readonly #onExternalAbort = (): void => {
    if (!this.#controller.signal.aborted) this.#controller.abort(this.#external?.reason);
  };

  constructor(external: AbortSignal | undefined, milliseconds: number) {
    this.#external = external;
    if (external?.aborted) this.#onExternalAbort();
    else external?.addEventListener("abort", this.#onExternalAbort, { once: true });
    this.#timer = setTimeout(() => {
      this.#timedOut = true;
      this.#controller.abort(new DOMException("Image Lab request timed out", "TimeoutError"));
    }, milliseconds);
  }

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  get timedOut(): boolean {
    return this.#timedOut;
  }

  dispose(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    this.#external?.removeEventListener("abort", this.#onExternalAbort);
  }
}

const readBoundedBytes = async (
  response: Response,
  maximum: number,
  signal?: AbortSignal
): Promise<Uint8Array> => {
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) fail("INVALID_RESPONSE", "The response length is invalid.");
    if (Number(declared) > maximum) {
      fail("RESPONSE_TOO_LARGE", "The Image Lab response exceeded its byte limit.");
    }
  }
  throwIfCancelled(signal);
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      throwIfCancelled(signal);
      let removeAbort = (): void => undefined;
      const aborted = new Promise<never>((_resolve, reject) => {
        if (!signal) return;
        const onAbort = () => {
          void reader.cancel(signal.reason).catch(() => undefined);
          reject(signal.reason ?? new DOMException("Operation aborted", "AbortError"));
        };
        signal.addEventListener("abort", onAbort, { once: true });
        removeAbort = () => signal.removeEventListener("abort", onAbort);
      });
      let next: ReadableStreamReadResult<Uint8Array>;
      try {
        next = signal ? await Promise.race([reader.read(), aborted]) : await reader.read();
      } finally {
        removeAbort();
      }
      throwIfCancelled(signal);
      const { done, value } = next;
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maximum) {
        await reader.cancel();
        fail("RESPONSE_TOO_LARGE", "The Image Lab response exceeded its byte limit.");
      }
      chunks.push(value);
    }
  } catch (cause) {
    if (cause instanceof ImageLabClientError) throw cause;
    if (isAbort(cause, signal)) {
      try {
        await reader.cancel();
      } catch {
        // The request has already been cancelled.
      }
      fail("CANCELLED", "The Image Lab request was cancelled.", { cause });
    }
    fail("INVALID_RESPONSE", "The Image Lab response could not be read.", { cause });
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const decodeJson = async (
  response: Response,
  signal?: AbortSignal
): Promise<unknown> => {
  if (response.headers.get("content-type") !== "application/json") {
    fail("UNEXPECTED_CONTENT_TYPE", "Expected an application/json response.", {
      status: response.status
    });
  }
  const bytes = await readBoundedBytes(response, JSON_RESPONSE_LIMIT, signal);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch (cause) {
    fail("INVALID_RESPONSE", "The Image Lab response was not valid JSON.", {
      status: response.status,
      cause
    });
  }
};

const SERVER_ERROR_CODES = new Set<ImageLabClientErrorCode>([
  "INVALID_REQUEST",
  "IMAGE_LAB_DISABLED",
  "ALLOWANCE_EXHAUSTED",
  "AUTHENTICATION_REQUIRED",
  "IMAGE_LAB_UNAVAILABLE",
  "JOB_OUTCOME_UNCERTAIN",
  "JOB_NOT_FOUND",
  "RATE_LIMITED"
]);

const throwServerError = async (response: Response, signal?: AbortSignal): Promise<never> => {
  const value = ownRecord(await decodeJson(response, signal));
  if (value && hasExactKeys(value, ["error"]) && typeof value.error === "string" &&
    SERVER_ERROR_CODES.has(value.error as ImageLabClientErrorCode)) {
    fail(value.error as ImageLabClientErrorCode, `Image Lab returned ${value.error}.`, {
      status: response.status
    });
  }
  fail("HTTP_ERROR", `Image Lab returned HTTP ${response.status}.`, { status: response.status });
};

const parseRemaining = (value: unknown): ImageLabRemaining | null => {
  const record = ownRecord(value);
  if (!record || !hasExactKeys(record, ["object", "realise"]) ||
    !boundedInteger(record.object, 100) || !boundedInteger(record.realise, 100)) return null;
  return { object: record.object, realise: record.realise };
};

const parseStageAllowance = (value: unknown): ImageLabStageAllowance | null => {
  const record = ownRecord(value);
  if (!record || !hasExactKeys(record, ["remaining", "reserved"]) ||
    !boundedInteger(record.remaining, 100) || !boundedInteger(record.reserved, 100)) return null;
  return { remaining: record.remaining, reserved: record.reserved };
};

const parseStatus = (value: unknown): StudentImageLabStatus => {
  const record = ownRecord(value);
  if (!record) fail("INVALID_RESPONSE", "Image Lab account status was invalid.");
  if (record.enabled === false && hasExactKeys(record, ["enabled", "reason"]) &&
    record.reason === "disabled") {
    return { enabled: false, reason: "disabled" };
  }
  const object = parseStageAllowance(record.object);
  const realise = parseStageAllowance(record.realise);
  if (record.enabled === true && hasExactKeys(record, ["enabled", "object", "realise"]) &&
    object && realise) {
    return {
      enabled: true,
      object,
      realise
    };
  }
  fail("INVALID_RESPONSE", "Image Lab account status was invalid.");
};

const parseJobCreated = (value: unknown): ImageLabJobCreated => {
  const record = ownRecord(value);
  const remaining = record ? parseRemaining(record.remaining) : null;
  if (!record || !hasExactKeys(record, ["jobToken", "stage", "remaining"]) ||
    !boundedString(record.jobToken, 4_096) || (record.stage !== "object" && record.stage !== "realise") ||
    !remaining) {
    fail("INVALID_RESPONSE", "The Image Lab job response was invalid.");
  }
  return { jobToken: record.jobToken, stage: record.stage, remaining };
};

const parseJobStatus = (value: unknown): ImageLabJobStatus => {
  const record = ownRecord(value);
  const validState = record?.status === "queued" || record?.status === "working" ||
    record?.status === "completed" || record?.status === "failed" || record?.status === "unknown";
  if (!record || !validState ||
    (!hasExactKeys(record, ["status"]) && !hasExactKeys(record, ["status", "position"])) ||
    ("position" in record && !boundedInteger(record.position, 10_000))) {
    fail("INVALID_RESPONSE", "The Image Lab job status was invalid.");
  }
  return "position" in record
    ? { status: record.status as ImageLabJobState, position: record.position as number }
    : { status: record.status as ImageLabJobState };
};

const commonJobFieldsAreValid = (record: Record<string, unknown>): boolean =>
  boundedString(record.idempotencyKey, 128);

const boundedStringArray = (value: unknown, maxEntries: number): value is string[] =>
  Array.isArray(value) && value.length <= maxEntries &&
  value.every((entry) => boundedString(entry, 64));

const validateJobRequest = (value: unknown): ImageLabJobRequest => {
  const record = ownRecord(value);
  if (!record || !commonJobFieldsAreValid(record)) {
    fail("INVALID_REQUEST", "The Image Lab job request was invalid.");
  }
  if (record.stage === "object" && hasExactKeys(record, [
    "stage", "idempotencyKey", "objectName", "category", "style", "colour"
  ]) && boundedString(record.objectName, 128) && boundedString(record.category, 64) &&
    boundedString(record.style, 64) && boundedString(record.colour, 64)) {
    return {
      stage: "object",
      idempotencyKey: record.idempotencyKey as string,
      objectName: record.objectName,
      category: record.category,
      style: record.style,
      colour: record.colour
    };
  }
  if (record.stage === "realise" && hasExactKeys(record, [
    "stage", "idempotencyKey", "designDataUrl", "productKind", "scene"
  ]) && boundedString(record.designDataUrl, DESIGN_DATA_URL_LIMIT) &&
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(record.designDataUrl) &&
    boundedString(record.productKind, 128) && boundedString(record.scene, 256)) {
    return {
      stage: "realise",
      idempotencyKey: record.idempotencyKey as string,
      designDataUrl: record.designDataUrl,
      productKind: record.productKind,
      scene: record.scene
    };
  }
  const context = ownRecord(record.context);
  if (record.stage === "realise" && record.mode === "advertisement" &&
    hasExactKeys(record, [
      "stage", "mode", "idempotencyKey", "documentId", "designDataUrl",
      "finish", "improvements", "context"
    ]) && boundedString(record.documentId, 64) &&
    boundedString(record.finish, 64) &&
    boundedStringArray(record.improvements, 5) &&
    boundedString(record.designDataUrl, DESIGN_DATA_URL_LIMIT) &&
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(record.designDataUrl) &&
    context && hasExactKeys(context, [
      "productName", "productFunction", "targetAudience", "advertisingLocation",
      "attention", "interest", "desire", "action"
    ]) && boundedString(context.productName, 96) &&
    boundedString(context.productFunction, 280) &&
    boundedString(context.targetAudience, 160) &&
    boundedString(context.advertisingLocation, 160) &&
    boundedString(context.attention, 280) && boundedString(context.interest, 280) &&
    boundedString(context.desire, 280) && boundedString(context.action, 280)) {
    return {
      stage: "realise",
      mode: "advertisement",
      idempotencyKey: record.idempotencyKey as string,
      documentId: record.documentId,
      designDataUrl: record.designDataUrl,
      finish: record.finish,
      improvements: [...record.improvements],
      context: {
        productName: context.productName,
        productFunction: context.productFunction,
        targetAudience: context.targetAudience,
        advertisingLocation: context.advertisingLocation,
        attention: context.attention,
        interest: context.interest,
        desire: context.desire,
        action: context.action
      }
    };
  }
  fail("INVALID_REQUEST", "The Image Lab job request was invalid.");
};

const validateJobToken = (value: unknown): string => {
  if (!boundedString(value, 4_096)) fail("INVALID_REQUEST", "The Image Lab job token was invalid.");
  return value;
};

const hasImageSignature = (bytes: Uint8Array, contentType: string): boolean => {
  if (contentType === "image/png") {
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return png.every((byte, index) => bytes[index] === byte);
  }
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  return bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
};

export class ImageLabClient {
  private readonly fetchImpl: FetchLike;
  private readonly sleepImpl: SleepLike;
  private readonly jsonTimeoutMs: number;
  private readonly assetTimeoutMs: number;

  constructor(dependencies: ImageLabClientDependencies = {}) {
    this.fetchImpl = dependencies.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.sleepImpl = dependencies.sleep ?? defaultSleep;
    this.jsonTimeoutMs = dependencies.jsonTimeoutMs ?? 15_000;
    this.assetTimeoutMs = dependencies.assetTimeoutMs ?? 60_000;
    if (!Number.isFinite(this.jsonTimeoutMs) || this.jsonTimeoutMs <= 0 ||
      !Number.isFinite(this.assetTimeoutMs) || this.assetTimeoutMs <= 0) {
      throw new TypeError("Image Lab deadlines must be positive finite milliseconds.");
    }
  }

  private async response(path: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    throwIfCancelled(signal);
    let response: Response;
    try {
      response = await this.fetchImpl(path, init);
    } catch (cause) {
      if (isAbort(cause, signal)) {
        fail("CANCELLED", "The Image Lab request was cancelled.", { cause });
      }
      fail("NETWORK_ERROR", "The Image Lab request could not reach the server.", { cause });
    }
    if (response.redirected) {
      fail("REDIRECT_BLOCKED", "The Image Lab server attempted a redirect.", {
        status: response.status
      });
    }
    return response;
  }

  private async json<T>(
    path: string,
    init: RequestInit,
    parse: (value: unknown) => T,
    signal?: AbortSignal
  ): Promise<T> {
    const deadline = new ImageLabDeadline(signal, this.jsonTimeoutMs);
    try {
      const response = await this.response(path, { ...init, signal: deadline.signal }, deadline.signal);
      if (!response.ok) return throwServerError(response, deadline.signal);
      return parse(await decodeJson(response, deadline.signal));
    } catch (cause) {
      if (deadline.timedOut) {
        fail("TIMEOUT", "The Image Lab request timed out.", { cause });
      }
      throw cause;
    } finally {
      deadline.dispose();
    }
  }

  status(options: ImageLabRequestOptions = {}): Promise<StudentImageLabStatus> {
    return this.json("/api/image-lab/session", {
      method: "GET",
      credentials: "same-origin",
      redirect: "error",
      headers: JSON_HEADERS,
      signal: options.signal ?? null
    }, parseStatus, options.signal);
  }

  async createJob(
    request: ImageLabJobRequest,
    options: ImageLabRequestOptions = {}
  ): Promise<ImageLabJobCreated> {
    const body = validateJobRequest(request);
    const created = await this.json("/api/image-lab/jobs", {
      method: "POST",
      credentials: "same-origin",
      redirect: "error",
      headers: JSON_POST_HEADERS,
      body: JSON.stringify(body),
      signal: options.signal ?? null
    }, parseJobCreated, options.signal);
    if (created.stage !== body.stage) {
      fail("INVALID_RESPONSE", "The Image Lab returned a job for the wrong stage.");
    }
    return created;
  }

  async getJobStatus(
    jobToken: string,
    options: ImageLabRequestOptions = {}
  ): Promise<ImageLabJobStatus> {
    const query = new URLSearchParams({ job: validateJobToken(jobToken) });
    return this.json(`/api/image-lab/jobs?${query.toString()}`, {
      method: "GET",
      credentials: "same-origin",
      redirect: "error",
      headers: JSON_HEADERS,
      signal: options.signal ?? null
    }, parseJobStatus, options.signal);
  }

  async reconcile(
    jobToken: string,
    options: ImageLabRequestOptions = {}
  ): Promise<ImageLabJobStatus> {
    const body = { jobToken: validateJobToken(jobToken) };
    return this.json("/api/image-lab/jobs/reconcile", {
      method: "POST",
      credentials: "same-origin",
      redirect: "error",
      headers: JSON_POST_HEADERS,
      body: JSON.stringify(body),
      signal: options.signal ?? null
    }, parseJobStatus, options.signal);
  }

  async getAsset(jobToken: string, options: ImageLabRequestOptions = {}): Promise<Blob> {
    const query = new URLSearchParams({ job: validateJobToken(jobToken) });
    const deadline = new ImageLabDeadline(options.signal, this.assetTimeoutMs);
    try {
      const response = await this.response(`/api/image-lab/assets?${query.toString()}`, {
        method: "GET",
        credentials: "same-origin",
        redirect: "error",
        headers: IMAGE_HEADERS,
        signal: deadline.signal
      }, deadline.signal);
      if (!response.ok) return throwServerError(response, deadline.signal);
      const contentType = response.headers.get("content-type");
      if (contentType !== "image/png" && contentType !== "image/jpeg" && contentType !== "image/webp") {
        fail("UNEXPECTED_CONTENT_TYPE", "Expected a PNG, JPEG, or WebP Image Lab asset.", {
          status: response.status
        });
      }
      const bytes = await readBoundedBytes(response, IMAGE_RESPONSE_LIMIT, deadline.signal);
      if (!hasImageSignature(bytes, contentType)) {
        fail("INVALID_RESPONSE", "The Image Lab asset did not match its declared image type.", {
          status: response.status
        });
      }
      const ownedBytes = new Uint8Array(bytes.byteLength);
      ownedBytes.set(bytes);
      return new Blob([ownedBytes.buffer], { type: contentType });
    } catch (cause) {
      if (deadline.timedOut) {
        fail("TIMEOUT", "The Image Lab asset download timed out.", { cause });
      }
      throw cause;
    } finally {
      deadline.dispose();
    }
  }

  async pollJob(jobToken: string, options: ImageLabPollOptions = {}): Promise<ImageLabJobStatus> {
    const maxAttempts = options.maxAttempts ?? DEFAULT_POLL_ATTEMPTS;
    const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAX_POLL_ATTEMPTS ||
      !Number.isInteger(intervalMs) || intervalMs < 0 || intervalMs > MAX_POLL_INTERVAL_MS) {
      fail("INVALID_REQUEST", "Image Lab polling limits were invalid.");
    }
    validateJobToken(jobToken);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const status = await this.getJobStatus(
        jobToken,
        options.signal ? { signal: options.signal } : {}
      );
      if (status.status === "completed" || status.status === "failed" ||
        status.status === "unknown") return status;
      if (attempt === maxAttempts) break;
      throwIfCancelled(options.signal);
      try {
        await this.sleepImpl(intervalMs, options.signal);
      } catch (cause) {
        if (cause instanceof ImageLabClientError) throw cause;
        if (isAbort(cause, options.signal)) {
          fail("CANCELLED", "The Image Lab request was cancelled.", { cause });
        }
        fail("NETWORK_ERROR", "Image Lab polling was interrupted.", { cause });
      }
    }
    fail("POLL_LIMIT", "Image Lab did not finish within the polling limit.");
  }
}
