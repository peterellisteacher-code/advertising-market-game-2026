import {
  parseProductPriceGuide,
  type ProductPriceGuide,
  type ProductPriceGuideRequest
} from "../../../shared/product-price-guide-contract";

const JSON_RESPONSE_LIMIT = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 22_000;

export type ProductPriceGuideClientErrorCode =
  | "INVALID_REQUEST"
  | "NETWORK_ERROR"
  | "CANCELLED"
  | "TIMEOUT"
  | "REDIRECT_BLOCKED"
  | "HTTP_ERROR"
  | "UNEXPECTED_CONTENT_TYPE"
  | "RESPONSE_TOO_LARGE"
  | "INVALID_RESPONSE"
  | "PRICE_GUIDE_DISABLED"
  | "PRICE_GUIDE_LOCKED"
  | "LOOKUP_IN_PROGRESS"
  | "INSUFFICIENT_EVIDENCE"
  | "UPSTREAM_UNAVAILABLE"
  | "RATE_LIMITED";

export class ProductPriceGuideClientError extends Error {
  constructor(
    readonly code: ProductPriceGuideClientErrorCode,
    message: string,
    readonly status?: number,
    options: { cause?: unknown } = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ProductPriceGuideClientError";
  }
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface ProductPriceGuideClientDependencies {
  fetch?: FetchLike;
  timeoutMs?: number;
}

function fail(
  code: ProductPriceGuideClientErrorCode,
  message: string,
  options: { status?: number; cause?: unknown } = {}
): never {
  throw new ProductPriceGuideClientError(code, message, options.status, { cause: options.cause });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isAbort(cause: unknown): boolean {
  return typeof cause === "object" && cause !== null && "name" in cause &&
    ((cause as { name?: unknown }).name === "AbortError" ||
      (cause as { name?: unknown }).name === "TimeoutError");
}

async function boundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    fail("UNEXPECTED_CONTENT_TYPE", "The price check expected a JSON response.", {
      status: response.status
    });
  }
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    if (!/^\d+$/.test(declared)) fail("INVALID_RESPONSE", "The price check returned an invalid length.");
    if (Number(declared) > JSON_RESPONSE_LIMIT) {
      fail("RESPONSE_TOO_LARGE", "The price check returned too much data.");
    }
  }
  if (!response.body) fail("INVALID_RESPONSE", "The price check returned an empty response.");
  const reader = response.body.getReader();
  const cancelReader = (): void => {
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
      const next = await reader.read();
      if (signal.aborted) throw new DOMException("cancelled", "AbortError");
      if (next.done) break;
      if (!next.value) continue;
      total += next.value.byteLength;
      if (total > JSON_RESPONSE_LIMIT) {
        await reader.cancel();
        fail("RESPONSE_TOO_LARGE", "The price check returned too much data.");
      }
      chunks.push(next.value);
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
    fail("INVALID_RESPONSE", "The price check returned invalid JSON.", {
      status: response.status,
      cause
    });
  }
}

const SERVER_ERROR_MAP: Readonly<Record<string, ProductPriceGuideClientErrorCode>> = Object.freeze({
  INVALID_REQUEST: "INVALID_REQUEST",
  PRODUCT_PRICE_GUIDE_DISABLED: "PRICE_GUIDE_DISABLED",
  PRODUCT_PRICE_GUIDE_LOCKED: "PRICE_GUIDE_LOCKED",
  LOOKUP_IN_PROGRESS: "LOOKUP_IN_PROGRESS",
  INSUFFICIENT_EVIDENCE: "INSUFFICIENT_EVIDENCE",
  UPSTREAM_TIMEOUT: "UPSTREAM_UNAVAILABLE",
  UPSTREAM_FAILED: "UPSTREAM_UNAVAILABLE",
  PRODUCT_PRICE_GUIDE_UNAVAILABLE: "UPSTREAM_UNAVAILABLE",
  RATE_LIMITED: "RATE_LIMITED"
});

export class ProductPriceGuideClient {
  readonly #fetch: FetchLike;
  readonly #timeoutMs: number;

  constructor(dependencies: ProductPriceGuideClientDependencies = {}) {
    this.#fetch = dependencies.fetch ?? ((input, init) => globalThis.fetch(input, init));
    this.#timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async research(
    request: ProductPriceGuideRequest,
    options: { signal?: AbortSignal } = {}
  ): Promise<ProductPriceGuide> {
    if (options.signal?.aborted) fail("CANCELLED", "The price check was cancelled.");
    const controller = new AbortController();
    let timedOut = false;
    const timeout = globalThis.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMs);
    const onAbort = (): void => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      let response: Response;
      try {
        response = await this.#fetch("/api/product-price-guide", {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json" },
          credentials: "same-origin",
          redirect: "error",
          body: JSON.stringify(request),
          signal: controller.signal
        });
      } catch (cause) {
        if (options.signal?.aborted) fail("CANCELLED", "The price check was cancelled.", { cause });
        if (timedOut) fail("TIMEOUT", "The price check took too long. Try the same check again.", { cause });
        if (isAbort(cause)) fail("CANCELLED", "The price check was cancelled.", { cause });
        fail("NETWORK_ERROR", "The price check could not connect. You can still compare prices yourselves.", {
          cause
        });
      }
      if (response.redirected) {
        fail("REDIRECT_BLOCKED", "The price check was redirected.", { status: response.status });
      }
      let value: unknown;
      try {
        value = await boundedJson(response, controller.signal);
      } catch (cause) {
        if (cause instanceof ProductPriceGuideClientError) throw cause;
        if (options.signal?.aborted) fail("CANCELLED", "The price check was cancelled.", { cause });
        if (timedOut) fail("TIMEOUT", "The price check took too long. Try the same check again.", { cause });
        if (isAbort(cause)) fail("CANCELLED", "The price check was cancelled.", { cause });
        fail("INVALID_RESPONSE", "The price check could not read its response.", {
          status: response.status,
          cause
        });
      }
      if (!response.ok) {
        if (isRecord(value) && Object.keys(value).length === 1 && typeof value.error === "string") {
          const mapped = SERVER_ERROR_MAP[value.error];
          if (mapped) {
            fail(mapped, "The price check is not available for this request.", { status: response.status });
          }
        }
        fail("HTTP_ERROR", `The price check returned HTTP ${response.status}.`, { status: response.status });
      }
      try {
        const guide = parseProductPriceGuide(value);
        if (guide.productFingerprint !== request.productFingerprint) {
          fail("INVALID_RESPONSE", "The price check returned evidence for a different product.", {
            status: response.status
          });
        }
        return guide;
      } catch (cause) {
        if (cause instanceof ProductPriceGuideClientError) throw cause;
        fail("INVALID_RESPONSE", "The price check returned invalid evidence.", {
          status: response.status,
          cause
        });
      }
    } finally {
      globalThis.clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onAbort);
    }
    fail("INVALID_RESPONSE", "The price check did not return a response.");
  }
}
