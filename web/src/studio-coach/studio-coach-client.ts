import {
  parseStudioCoachResponse,
  type StudioCoachRequest,
  type StudioCoachResponse
} from "../../../shared/studio-coach-contract";

const JSON_RESPONSE_LIMIT = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 16_000;

export type StudioCoachClientErrorCode =
  | "INVALID_REQUEST"
  | "NETWORK_ERROR"
  | "CANCELLED"
  | "TIMEOUT"
  | "REDIRECT_BLOCKED"
  | "HTTP_ERROR"
  | "UNEXPECTED_CONTENT_TYPE"
  | "RESPONSE_TOO_LARGE"
  | "INVALID_RESPONSE"
  | "COACH_DISABLED"
  | "COACH_LOCKED"
  | "CHECK_IN_PROGRESS"
  | "TURN_LIMIT_REACHED"
  | "RATE_LIMITED";

export class StudioCoachClientError extends Error {
  readonly code: StudioCoachClientErrorCode;
  readonly status: number | undefined;

  constructor(
    code: StudioCoachClientErrorCode,
    message: string,
    options: { status?: number; cause?: unknown } = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "StudioCoachClientError";
    this.code = code;
    this.status = options.status;
  }
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface StudioCoachClientDependencies {
  fetch?: FetchLike;
  timeoutMs?: number;
}

export interface StudioCoachCheckOptions {
  signal?: AbortSignal;
}

function fail(
  code: StudioCoachClientErrorCode,
  message: string,
  options?: { status?: number; cause?: unknown }
): never {
  throw new StudioCoachClientError(code, message, options);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isAbort(cause: unknown): boolean {
  return typeof cause === "object" && cause !== null && "name" in cause &&
    (cause as { name?: unknown }).name === "AbortError";
}

async function boundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    fail("UNEXPECTED_CONTENT_TYPE", "Studio Coach expected a JSON response.", { status: response.status });
  }
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) fail("INVALID_RESPONSE", "Studio Coach returned an invalid response length.");
    if (Number(declared) > JSON_RESPONSE_LIMIT) {
      fail("RESPONSE_TOO_LARGE", "Studio Coach returned too much data.");
    }
  }
  if (!response.body) fail("INVALID_RESPONSE", "Studio Coach returned an empty response.");
  const reader = response.body.getReader();
  const cancelReader = () => {
    void reader.cancel(signal.reason).catch(() => {
      // The body may already have completed or failed.
    });
  };
  signal.addEventListener("abort", cancelReader, { once: true });
  if (signal.aborted) cancelReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      if (signal.aborted) throw new DOMException("cancelled", "AbortError");
      const result = await reader.read();
      if (signal.aborted) throw new DOMException("cancelled", "AbortError");
      const { done, value } = result;
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > JSON_RESPONSE_LIMIT) {
        await reader.cancel();
        fail("RESPONSE_TOO_LARGE", "Studio Coach returned too much data.");
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", cancelReader);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch (cause) {
    fail("INVALID_RESPONSE", "Studio Coach returned invalid JSON.", { status: response.status, cause });
  }
}

const SERVER_ERROR_MAP: Readonly<Record<string, StudioCoachClientErrorCode>> = Object.freeze({
  INVALID_REQUEST: "INVALID_REQUEST",
  STUDIO_COACH_DISABLED: "COACH_DISABLED",
  STUDIO_COACH_LOCKED: "COACH_LOCKED",
  CHECK_IN_PROGRESS: "CHECK_IN_PROGRESS",
  TURN_LIMIT_REACHED: "TURN_LIMIT_REACHED",
  RATE_LIMITED: "RATE_LIMITED"
});

export class StudioCoachClient {
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;

  constructor(dependencies: StudioCoachClientDependencies = {}) {
    this.#fetch = dependencies.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.#timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async check(
    request: StudioCoachRequest,
    options: StudioCoachCheckOptions = {}
  ): Promise<StudioCoachResponse> {
    if (options.signal?.aborted) fail("CANCELLED", "The Studio Coach check was cancelled.");
    const controller = new AbortController();
    let timedOut = false;
    const timeout = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMs);
    const onAbort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      let response: Response;
      try {
        response = await this.#fetch("/api/image-lab/coach", {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          credentials: "same-origin",
          redirect: "error",
          body: JSON.stringify(request),
          signal: controller.signal
        });
      } catch (cause) {
        if (options.signal?.aborted) {
          fail("CANCELLED", "The Studio Coach check was cancelled.", { cause });
        }
        if (timedOut) fail("TIMEOUT", "Studio Coach took too long to answer.", { cause });
        if (isAbort(cause)) fail("CANCELLED", "The Studio Coach check was cancelled.", { cause });
        fail("NETWORK_ERROR", "Studio Coach could not connect. Keep designing with the built-in guide.", { cause });
      }
      if (response.redirected) fail("REDIRECT_BLOCKED", "Studio Coach was redirected.", { status: response.status });
      let value: unknown;
      try {
        value = await boundedJson(response, controller.signal);
      } catch (cause) {
        if (cause instanceof StudioCoachClientError) throw cause;
        if (options.signal?.aborted) {
          fail("CANCELLED", "The Studio Coach check was cancelled.", { cause });
        }
        if (timedOut) fail("TIMEOUT", "Studio Coach took too long to answer.", { cause });
        if (isAbort(cause)) fail("CANCELLED", "The Studio Coach check was cancelled.", { cause });
        fail("INVALID_RESPONSE", "Studio Coach could not read its response.", {
          status: response.status,
          cause
        });
      }
      if (!response.ok) {
        if (isRecord(value) && Object.keys(value).length === 1 && typeof value.error === "string") {
          const mapped = SERVER_ERROR_MAP[value.error];
          if (mapped) fail(mapped, "Studio Coach is not available for this check.", { status: response.status });
        }
        fail("HTTP_ERROR", `Studio Coach returned HTTP ${response.status}.`, { status: response.status });
      }
      try {
        return parseStudioCoachResponse(value);
      } catch (cause) {
        fail("INVALID_RESPONSE", "Studio Coach returned an invalid check.", { status: response.status, cause });
      }
    } finally {
      globalThis.clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onAbort);
    }
    fail("INVALID_RESPONSE", "Studio Coach did not return a response.");
  }
}
