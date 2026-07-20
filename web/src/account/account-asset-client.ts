import {
  ACCOUNT_IDENTITY_HEADER,
  type AccountIdentityBinding
} from "./account-identity-binding";
import {
  AccountCookieSerialisationUnavailableError,
  defaultAccountCookieRequestSerialiser,
  type AccountCookieRequestSerialiser
} from "./account-cookie-request-serialiser";

const ACCOUNT_ASSET_SCHEMA = "advertising-game-account-asset";
const ACCOUNT_ASSET_VERSION = 1;
const MAX_ASSET_BYTES = 4 * 1_024 * 1_024;
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
  put(blob: Blob): Promise<AccountAssetDescriptor>;
  get(sha256: string): Promise<AccountAssetDownload>;
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

const responseBytes = async (response: Response, limit: number): Promise<Uint8Array> => {
  if (response.body === null) throw new Error("Response body missing");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.byteLength > limit - length) {
        await reader.cancel().catch(() => undefined);
        throw new Error("Response body too large");
      }
      chunks.push(value);
      length += value.byteLength;
    }
  } catch {
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

const jsonBody = async (response: Response): Promise<unknown> =>
  JSON.parse(new TextDecoder().decode(await responseBytes(response, JSON_RESPONSE_LIMIT))) as unknown;

const errorFor = async (response: Response): Promise<AccountAssetClientError> => {
  // Fetch has already processed Set-Cookie before exposing these headers. Keep
  // hostile 401 bodies unread while the outer cookie-order lock covers the
  // response-header mutation.
  if (response.status === 401) return new AccountAssetClientError("AUTHENTICATION_REQUIRED");
  let body: unknown = null;
  try {
    body = await jsonBody(response);
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

export class HttpAccountAssetClient implements AccountAssetClient {
  constructor(
    private readonly identity: AccountIdentityBinding,
    private readonly fetcher: typeof fetch = globalThis.fetch,
    private readonly cookieRequests: AccountCookieRequestSerialiser =
      defaultAccountCookieRequestSerialiser(fetcher)
  ) {}

  async put(blob: Blob): Promise<AccountAssetDescriptor> {
    return this.#serialise(async () => {
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
      response = await this.fetcher.call(globalThis, assetPath(digest), {
        method: "PUT",
        credentials: "same-origin",
        redirect: "error",
        headers: {
          accept: "application/json",
          "content-type": declaredContentType,
          [ACCOUNT_IDENTITY_HEADER]: expectedAccount
        },
        body: blob
      });
    } catch {
      throw new AccountAssetClientError("ASSET_UNAVAILABLE");
    }
    if (response.redirected) throw new AccountAssetClientError("ASSET_UNAVAILABLE");
    if (!response.ok) throw await errorFor(response);
    let value: unknown;
    try {
      value = await jsonBody(response);
    } catch {
      throw new AccountAssetClientError("INVALID_RESPONSE");
    }
    const descriptor = exactAsset(value);
    if (descriptor === null) throw new AccountAssetClientError("INVALID_RESPONSE");
    if (!SHA256.test(descriptor.sha256) || !isRecord(value) || !isRecord(value.asset) ||
      value.asset.id !== descriptor.sha256 || value.asset.href !== assetPath(descriptor.sha256) ||
      descriptor.sha256 !== digest || descriptor.contentType !== declaredContentType ||
      descriptor.byteLength !== bytes.byteLength) {
      throw new AccountAssetClientError("ASSET_INTEGRITY_FAILED");
    }
      return descriptor;
    });
  }

  async get(digest: string): Promise<AccountAssetDownload> {
    return this.#serialise(async () => {
    const expectedAccount = this.#expectedAccount();
    if (!SHA256.test(digest)) throw new AccountAssetClientError("INVALID_REQUEST");
    let response: Response;
    try {
      response = await this.fetcher.call(globalThis, assetPath(digest), {
        method: "GET",
        credentials: "same-origin",
        redirect: "error",
        headers: {
          accept: "image/png, image/jpeg, image/webp",
          [ACCOUNT_IDENTITY_HEADER]: expectedAccount
        }
      });
    } catch {
      throw new AccountAssetClientError("ASSET_UNAVAILABLE");
    }
    if (response.redirected) throw new AccountAssetClientError("ASSET_UNAVAILABLE");
    if (!response.ok) throw await errorFor(response);
    const responseContentType = contentType(response.headers.get("content-type") ?? "");
    const contentLength = response.headers.get("content-length");
    if (responseContentType === null || contentLength === null || !/^\d+$/u.test(contentLength)) {
      throw new AccountAssetClientError("INVALID_RESPONSE");
    }
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 1 || declaredLength > MAX_ASSET_BYTES) {
      throw new AccountAssetClientError("ASSET_INTEGRITY_FAILED");
    }
    let bytes: Uint8Array;
    try {
      bytes = await responseBytes(response, MAX_ASSET_DOWNLOAD_BYTES);
    } catch {
      throw new AccountAssetClientError("ASSET_INTEGRITY_FAILED");
    }
    if (bytes.byteLength !== declaredLength || sniffContentType(bytes) !== responseContentType) {
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

  #expectedAccount(): string {
    const username = this.identity.current();
    if (username === null) throw new AccountAssetClientError("AUTHENTICATION_REQUIRED");
    return username;
  }
}
