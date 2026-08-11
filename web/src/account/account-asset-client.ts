import {
  ACCOUNT_IDENTITY_HEADER,
  type AccountIdentityBinding
} from "./account-identity-binding";
import {
  AccountCookieSerialisationUnavailableError,
  defaultAccountCookieRequestSerialiser,
  type AccountCookieRequestSerialiser
} from "./account-cookie-request-serialiser";
import { MAX_ACCOUNT_ASSET_BYTES } from "./account-asset-limits";

const ACCOUNT_ASSET_SCHEMA = "advertising-game-account-asset";
const ACCOUNT_ASSET_VERSION = 1;
const MAX_ASSET_BYTES = MAX_ACCOUNT_ASSET_BYTES;
const MAX_ASSET_DOWNLOAD_BYTES = MAX_ASSET_BYTES + 1;
const JSON_RESPONSE_LIMIT = 16 * 1_024;
const SHA256 = /^[a-f0-9]{64}$/u;
const CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
const PUBLIC_ERROR_CODES = new Set<string>([
  "ASSET_NOT_FOUND", "ASSET_QUOTA_EXCEEDED", "ASSET_TOO_LARGE", "ASSET_UNAVAILABLE",
  "AUTHENTICATION_REQUIRED", "UNSUPPORTED_ASSET"
]);

export type AccountAssetContentType = typeof CONTENT_TYPES[number];

export interface AccountAssetDescriptor {
  readonly sha256: string;
  readonly contentType: AccountAssetContentType;
  readonly byteLength: number;
}

export interface AccountAssetDownload extends AccountAssetDescriptor {
  readonly blob: Blob;
}

export interface AccountAssetClient {
  put(blob: Blob, options?: { signal?: AbortSignal }): Promise<AccountAssetDescriptor>;
  get(sha256: string, options?: { signal?: AbortSignal }): Promise<AccountAssetDownload>;
}

export interface AccountAssetClientDeadlines {
  readonly headerTimeoutMs?: number;
  readonly transferTimeoutMs?: number;
}

export interface AccountAssetHttpScope {
  readonly path?: (digest: string) => string;
  readonly includeAccountIdentityHeader?: boolean;
}

export type AccountAssetClientErrorCode =
  | "ASSET_INTEGRITY_FAILED"
  | "ASSET_NOT_FOUND"
  | "ASSET_QUOTA_EXCEEDED"
  | "ASSET_TOO_LARGE"
  | "ASSET_UNAVAILABLE"
  | "AUTHENTICATION_REQUIRED"
  | "INVALID_REQUEST"
  | "INVALID_RESPONSE"
  | "TIMEOUT"
  | "UNSUPPORTED_ASSET";

export class AccountAssetClientError extends Error {
  constructor(readonly code: AccountAssetClientErrorCode) {
    super(code);
    this.name = "AccountAssetClientError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const exactKeys = (record: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const contentType = (value: string): AccountAssetContentType | null => {
  const normalised = value.trim().toLowerCase();
  return (CONTENT_TYPES as readonly string[]).includes(normalised)
    ? normalised as AccountAssetContentType
    : null;
};

const hasPrefix = (bytes: Uint8Array, prefix: readonly number[]): boolean =>
  prefix.every((byte, index) => bytes[index] === byte);

const asciiAt = (bytes: Uint8Array, offset: number, value: string): boolean =>
  [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));

const readUint32Le = (bytes: Uint8Array, offset: number): number => (
  (bytes[offset] ?? 0) |
  ((bytes[offset + 1] ?? 0) << 8) |
  ((bytes[offset + 2] ?? 0) << 16) |
  ((bytes[offset + 3] ?? 0) << 24)
) >>> 0;

const sniffContentType = (bytes: Uint8Array): AccountAssetContentType | null => {
  if (
    bytes.byteLength >= 24 &&
    hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) &&
    hasPrefix(bytes.subarray(8), [0x00, 0x00, 0x00, 0x0d]) && asciiAt(bytes, 12, "IHDR")
  ) return "image/png";
  if (
    bytes.byteLength >= 4 && hasPrefix(bytes, [0xff, 0xd8, 0xff]) &&
    bytes[bytes.byteLength - 2] === 0xff && bytes[bytes.byteLength - 1] === 0xd9
  ) return "image/jpeg";
  if (
    bytes.byteLength >= 16 && asciiAt(bytes, 0, "RIFF") &&
    readUint32Le(bytes, 4) + 8 === bytes.byteLength && asciiAt(bytes, 8, "WEBP") &&
    (["VP8 ", "VP8L", "VP8X"] as const).some((chunk) => asciiAt(bytes, 12, chunk))
  ) return "image/webp";
  return null;
};

const sha256 = async (bytes: Uint8Array): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const assetPath = (digest: string): string => `/api/account/assets/${digest}`;

const exactAsset = (value: unknown): AccountAssetDescriptor | null => {
  if (!isRecord(value) || !exactKeys(value, ["schema", "version", "asset"]) ||
    value.schema !== ACCOUNT_ASSET_SCHEMA || value.version !== ACCOUNT_ASSET_VERSION ||
    !isRecord(value.asset) || !exactKeys(value.asset, ["id", "sha256", "contentType", "byteLength", "href"]) ||
    typeof value.asset.id !== "string" || typeof value.asset.sha256 !== "string" ||
    typeof value.asset.contentType !== "string" || contentType(value.asset.contentType) === null ||
    typeof value.asset.byteLength !== "number" || !Number.isSafeInteger(value.asset.byteLength) ||
    value.asset.byteLength < 1 || value.asset.byteLength > MAX_ASSET_BYTES || typeof value.asset.href !== "string"
  ) return null;
  return {
    sha256: value.asset.sha256,
    contentType: contentType(value.asset.contentType)!,
    byteLength: value.asset.byteLength
  };
};

const exactErrorCode = (value: unknown): AccountAssetClientErrorCode | null => {
  if (!isRecord(value) || !exactKeys(value, ["error"]) || typeof value.error !== "string") return null;
  return PUBLIC_ERROR_CODES.has(value.error)
    ? value.error as AccountAssetClientErrorCode
    : null;
};

const responseBytes = async (
  response: Response,
  limit: number,
  signal?: AbortSignal
): Promise<Uint8Array> => {
  if (response.body === null) throw new Error("Response body missing");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      signal?.throwIfAborted();
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
      signal?.throwIfAborted();
      const { done, value } = next;
      if (done) break;
      if (value.byteLength > limit - length) {
        await reader.cancel().catch(() => undefined);
        throw new Error("Response body too large");
      }
      chunks.push(value);
      length += value.byteLength;
    }
  } catch (error) {
    if (signal?.aborted) throw signal.reason ?? error;
    throw new Error("Response body unreadable");
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const jsonBody = async (response: Response, signal?: AbortSignal): Promise<unknown> =>
  JSON.parse(new TextDecoder().decode(
    await responseBytes(response, JSON_RESPONSE_LIMIT, signal)
  )) as unknown;

const errorFor = async (response: Response, signal?: AbortSignal): Promise<AccountAssetClientError> => {
  // Fetch has already processed Set-Cookie before exposing these headers. Keep
  // hostile 401 bodies unread while the outer cookie-order lock covers the
  // response-header mutation.
  if (response.status === 401) return new AccountAssetClientError("AUTHENTICATION_REQUIRED");
  let body: unknown = null;
  try {
    body = await jsonBody(response, signal);
  } catch {
    // Error bodies are never surfaced to callers.
  }
  if (isRecord(body) && exactKeys(body, ["error"]) &&
    body.error === "ACCOUNT_IDENTITY_CHANGED") {
    return new AccountAssetClientError("AUTHENTICATION_REQUIRED");
  }
  const code = exactErrorCode(body);
  if (code !== null) return new AccountAssetClientError(code);
  if (response.status >= 500) return new AccountAssetClientError("ASSET_UNAVAILABLE");
  return new AccountAssetClientError("INVALID_RESPONSE");
};

class AccountAssetDeadline {
  readonly #controller = new AbortController();
  readonly #external: AbortSignal | undefined;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #timedOut = false;
  readonly #onExternalAbort = (): void => {
    if (!this.#controller.signal.aborted) this.#controller.abort(this.#external?.reason);
  };

  constructor(external?: AbortSignal) {
    this.#external = external;
    if (external?.aborted) this.#onExternalAbort();
    else external?.addEventListener("abort", this.#onExternalAbort, { once: true });
  }

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  get timedOut(): boolean {
    return this.#timedOut;
  }

  arm(milliseconds: number): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timedOut = true;
      this.#controller.abort(new DOMException("Account asset request timed out", "TimeoutError"));
    }, milliseconds);
  }

  dispose(): void {
    if (this.#timer !== null) clearTimeout(this.#timer);
    this.#timer = null;
    this.#external?.removeEventListener("abort", this.#onExternalAbort);
  }
}

export class HttpAccountAssetClient implements AccountAssetClient {
  constructor(
    private readonly identity: AccountIdentityBinding | null,
    private readonly fetcher: typeof fetch = globalThis.fetch,
    private readonly cookieRequests: AccountCookieRequestSerialiser =
      defaultAccountCookieRequestSerialiser(fetcher),
    private readonly deadlines: AccountAssetClientDeadlines = {},
    private readonly scope: AccountAssetHttpScope = {}
  ) {}

  async put(blob: Blob, options: { signal?: AbortSignal } = {}): Promise<AccountAssetDescriptor> {
    return this.#serialise(async () => {
    const deadline = new AccountAssetDeadline(options.signal);
    const headerTimeoutMs = this.deadlines.headerTimeoutMs ?? 12_000;
    const transferTimeoutMs = this.deadlines.transferTimeoutMs ?? 60_000;
    try {
    const expectedAccount = this.#expectedAccount();
    const declaredContentType = contentType(blob.type);
    if (declaredContentType === null || blob.size < 1) {
      throw new AccountAssetClientError("UNSUPPORTED_ASSET");
    }
    if (blob.size > MAX_ASSET_BYTES) throw new AccountAssetClientError("ASSET_TOO_LARGE");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.byteLength < 1) throw new AccountAssetClientError("UNSUPPORTED_ASSET");
    if (bytes.byteLength > MAX_ASSET_BYTES) throw new AccountAssetClientError("ASSET_TOO_LARGE");
    if (sniffContentType(bytes) !== declaredContentType) {
      throw new AccountAssetClientError("UNSUPPORTED_ASSET");
    }
    const digest = await sha256(bytes);
    let response: Response;
    try {
      deadline.arm(headerTimeoutMs);
      response = await this.fetcher.call(globalThis, this.#assetPath(digest), {
        method: "PUT",
        credentials: "same-origin",
        redirect: "error",
        headers: this.#headers({
          accept: "application/json",
          "content-type": declaredContentType
        }, expectedAccount),
        body: blob,
        signal: deadline.signal
      });
    } catch {
      if (deadline.timedOut) throw new AccountAssetClientError("TIMEOUT");
      throw new AccountAssetClientError("ASSET_UNAVAILABLE");
    }
    deadline.arm(transferTimeoutMs);
    if (response.redirected) throw new AccountAssetClientError("ASSET_UNAVAILABLE");
    if (!response.ok) {
      try {
        throw await errorFor(response, deadline.signal);
      } catch (error) {
        if (deadline.timedOut) throw new AccountAssetClientError("TIMEOUT");
        throw error;
      }
    }
    let value: unknown;
    try {
      value = await jsonBody(response, deadline.signal);
    } catch {
      if (deadline.timedOut) throw new AccountAssetClientError("TIMEOUT");
      throw new AccountAssetClientError("INVALID_RESPONSE");
    }
    const descriptor = exactAsset(value);
    if (descriptor === null) throw new AccountAssetClientError("INVALID_RESPONSE");
    if (!SHA256.test(descriptor.sha256) || !isRecord(value) || !isRecord(value.asset) ||
      value.asset.id !== descriptor.sha256 ||
      value.asset.href !== this.#assetPath(descriptor.sha256) ||
      descriptor.sha256 !== digest || descriptor.contentType !== declaredContentType ||
      descriptor.byteLength !== bytes.byteLength) {
      throw new AccountAssetClientError("ASSET_INTEGRITY_FAILED");
    }
      return descriptor;
    } finally {
      deadline.dispose();
    }
    });
  }

  async get(digest: string, options: { signal?: AbortSignal } = {}): Promise<AccountAssetDownload> {
    return this.#serialise(async () => {
    const deadline = new AccountAssetDeadline(options.signal);
    const headerTimeoutMs = this.deadlines.headerTimeoutMs ?? 12_000;
    const transferTimeoutMs = this.deadlines.transferTimeoutMs ?? 60_000;
    try {
    const expectedAccount = this.#expectedAccount();
    if (!SHA256.test(digest)) throw new AccountAssetClientError("INVALID_REQUEST");
    let response: Response;
    try {
      deadline.arm(headerTimeoutMs);
      response = await this.fetcher.call(globalThis, this.#assetPath(digest), {
        method: "GET",
        credentials: "same-origin",
        redirect: "error",
        headers: this.#headers({
          accept: "image/png, image/jpeg, image/webp"
        }, expectedAccount),
        signal: deadline.signal
      });
    } catch {
      if (deadline.timedOut) throw new AccountAssetClientError("TIMEOUT");
      throw new AccountAssetClientError("ASSET_UNAVAILABLE");
    }
    deadline.arm(transferTimeoutMs);
    if (response.redirected) throw new AccountAssetClientError("ASSET_UNAVAILABLE");
    if (!response.ok) {
      try {
        throw await errorFor(response, deadline.signal);
      } catch (error) {
        if (deadline.timedOut) throw new AccountAssetClientError("TIMEOUT");
        throw error;
      }
    }
    const responseContentType = contentType(response.headers.get("content-type") ?? "");
    const contentLength = response.headers.get("content-length");
    if (responseContentType === null || (contentLength !== null && !/^\d+$/u.test(contentLength))) {
      throw new AccountAssetClientError("INVALID_RESPONSE");
    }
    const declaredLength = contentLength === null ? null : Number(contentLength);
    if (declaredLength !== null && (!Number.isSafeInteger(declaredLength) ||
      declaredLength < 1 || declaredLength > MAX_ASSET_BYTES)) {
      throw new AccountAssetClientError("ASSET_INTEGRITY_FAILED");
    }
    let bytes: Uint8Array;
    try {
      bytes = await responseBytes(response, MAX_ASSET_DOWNLOAD_BYTES, deadline.signal);
    } catch {
      if (deadline.timedOut) throw new AccountAssetClientError("TIMEOUT");
      throw new AccountAssetClientError("ASSET_INTEGRITY_FAILED");
    }
    if ((declaredLength !== null && bytes.byteLength !== declaredLength) ||
      sniffContentType(bytes) !== responseContentType) {
      throw new AccountAssetClientError("ASSET_INTEGRITY_FAILED");
    }
    let actualDigest: string;
    try {
      actualDigest = await sha256(bytes);
    } catch {
      throw new AccountAssetClientError("ASSET_UNAVAILABLE");
    }
    if (actualDigest !== digest) throw new AccountAssetClientError("ASSET_INTEGRITY_FAILED");
      return {
        sha256: digest,
        contentType: responseContentType,
        byteLength: bytes.byteLength,
        blob: (() => {
          const body = new ArrayBuffer(bytes.byteLength);
          new Uint8Array(body).set(bytes);
          return new Blob([body], { type: responseContentType });
        })()
      };
    } finally {
      deadline.dispose();
    }
    });
  }

  async #serialise<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await this.cookieRequests.run(operation);
    } catch (error) {
      if (error instanceof AccountCookieSerialisationUnavailableError) {
        throw new AccountAssetClientError("ASSET_UNAVAILABLE");
      }
      throw error;
    }
  }

  #assetPath(digest: string): string {
    return this.scope.path?.(digest) ?? assetPath(digest);
  }

  #headers(
    base: Record<string, string>,
    expectedAccount: string | null
  ): Record<string, string> {
    return expectedAccount === null
      ? base
      : { ...base, [ACCOUNT_IDENTITY_HEADER]: expectedAccount };
  }

  #expectedAccount(): string | null {
    if (this.scope.includeAccountIdentityHeader === false) return null;
    const username = this.identity?.current() ?? null;
    if (username === null) throw new AccountAssetClientError("AUTHENTICATION_REQUIRED");
    return username;
  }
}
