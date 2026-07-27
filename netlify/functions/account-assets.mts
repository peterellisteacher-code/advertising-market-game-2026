import type { Config, Context } from "@netlify/functions";
import {
  AccountConfigurationError,
  AccountRequestError,
  SupabaseAccountClient,
  accountJson,
  assertSameOriginMutation,
  parseAccountCookies,
  resolveAccountSession,
  type AccountEnvironmentRecord
} from "./lib/account-backend";
import {
  ACCOUNT_ASSET_LIMITS,
  AccountAssetError,
  parseAccountAssetEnvironment,
  type AccountAssetDescriptor,
  type AccountAssetEnvironment,
  type AccountAssetManifest
} from "./lib/account-assets";
import { defaultAccountAssetService } from "./lib/netlify-account-assets";
import {
  accountIdentityMatches,
  clearAccountSessionCookies,
  serialiseAccountSessionCookies
} from "./lib/account-primitives";

const ASSET_PATH_PREFIX = "/api/account/assets/";
const ASSET_PATH_PATTERN = /^\/api\/account\/assets\/([a-f0-9]{64})$/u;
const SUPPORTED_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const ENVIRONMENT_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "ADVERTISING_GAME_EDGE_GATEWAY_SECRET",
  "ADVERTISING_GAME_USERNAME_HMAC_SECRET",
  "ADVERTISING_GAME_CLASSROOM_CODE",
  "ADVERTISING_GAME_ASSET_NAMESPACE_SECRET"
] as const;

interface AccountAssetServicePort {
  put(
    userId: string,
    digest: string,
    contentType: string,
    bytes: Uint8Array
  ): Promise<{ created: boolean; manifest: AccountAssetManifest }>;
  get(
    userId: string,
    digest: string
  ): Promise<{ descriptor: AccountAssetDescriptor; bytes: Uint8Array }>;
}

interface AccountAssetsDependencies {
  readonly environment?: AccountAssetEnvironment | AccountEnvironmentRecord;
  readonly fetcher?: typeof fetch;
  readonly reportStorageFailure?: (kind: AccountAssetStorageFailureKind) => void;
  readonly service?: AccountAssetServicePort;
  readonly serviceFactory?: (namespaceSecret: string) => Promise<AccountAssetServicePort>;
}

export type AccountAssetStorageFailureKind =
  | "ASSET_STATE_UNAVAILABLE"
  | "BLOBS_CONSISTENCY_CONTEXT"
  | "BLOBS_DATA_SHAPE"
  | "BLOBS_ENVIRONMENT_CONTEXT"
  | "BLOBS_FETCH_FAILED"
  | "BLOBS_INTERNAL"
  | "BLOBS_MODULE_MISSING"
  | "BLOBS_STORE_FACTORY"
  | "NON_ERROR_STORAGE_FAILURE"
  | "UNEXPECTED_STORAGE_FAILURE";

export function classifyAccountAssetStorageFailure(
  error: unknown
): AccountAssetStorageFailureKind | null {
  if (error instanceof AccountRequestError || error instanceof AccountConfigurationError) return null;
  if (error instanceof AccountAssetError) {
    return error.code === "ASSET_UNAVAILABLE" ? "ASSET_STATE_UNAVAILABLE" : null;
  }
  if (!(error instanceof Error)) return "NON_ERROR_STORAGE_FAILURE";
  if (error.name === "BlobsConsistencyError") return "BLOBS_CONSISTENCY_CONTEXT";
  if (error.name === "MissingBlobsEnvironmentError") return "BLOBS_ENVIRONMENT_CONTEXT";
  if (error.name === "BlobsInternalError") return "BLOBS_INTERNAL";
  const errorCode = (error as Error & { code?: unknown }).code;
  const cause = (error as Error & { cause?: unknown }).cause;
  const causeCode = cause instanceof Error
    ? (cause as Error & { code?: unknown }).code
    : undefined;
  if (errorCode === "ERR_MODULE_NOT_FOUND" || causeCode === "ERR_MODULE_NOT_FOUND") {
    return "BLOBS_MODULE_MISSING";
  }
  if (error.message === "fetch failed") return "BLOBS_FETCH_FAILED";
  if (error.message === "account asset storage unavailable") return "BLOBS_DATA_SHAPE";
  if (error.message.includes("getStore") && error.message.includes("not a function")) {
    return "BLOBS_STORE_FACTORY";
  }
  return "UNEXPECTED_STORAGE_FAILURE";
}

const reportStorageFailure = (kind: AccountAssetStorageFailureKind): void => {
  console.error(JSON.stringify({ event: "account_asset_storage_failure", kind }));
};

const runtimeEnvironment = (): AccountEnvironmentRecord => Object.fromEntries(
  ENVIRONMENT_KEYS.map((key) => [key, Netlify.env.get(key)])
);

const configuredEnvironment = (
  dependency: AccountAssetEnvironment | AccountEnvironmentRecord | undefined
): AccountAssetEnvironment => {
  if (
    dependency &&
    typeof dependency.supabaseUrl === "string" &&
    typeof dependency.publishableKey === "string" &&
    typeof dependency.edgeGatewaySecret === "string" &&
    typeof dependency.usernameHmacSecret === "string" &&
    typeof dependency.classroomCode === "string" &&
    typeof dependency.assetNamespaceSecret === "string"
  ) {
    return dependency as AccountAssetEnvironment;
  }
  return parseAccountAssetEnvironment(
    dependency === undefined ? runtimeEnvironment() : dependency as AccountEnvironmentRecord
  );
};

const readBoundedAsset = async (request: Request): Promise<Uint8Array> => {
  if (request.body === null) throw new AccountAssetError("UNSUPPORTED_ASSET");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > ACCOUNT_ASSET_LIMITS.maxAssetBytes) {
      await reader.cancel();
      throw new AccountAssetError("ASSET_TOO_LARGE");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const assetBinary = (
  descriptor: AccountAssetDescriptor,
  bytes: Uint8Array,
  cookies: readonly string[]
): Response => {
  const headers = new Headers({
    "cache-control": "private, no-store",
    "content-length": String(bytes.byteLength),
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "content-type": descriptor.contentType,
    "cross-origin-resource-policy": "same-origin",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff"
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, { status: 200, headers });
};

const assetErrorResponse = (
  error: unknown,
  cookies: readonly string[] = []
): Response => {
  if (error instanceof AccountRequestError) {
    return accountJson({ error: error.code }, error.status, cookies);
  }
  if (error instanceof AccountConfigurationError) {
    return accountJson({ error: "ASSETS_NOT_CONFIGURED" }, 503, cookies);
  }
  if (error instanceof AccountAssetError) {
    const status = error.code === "ASSET_NOT_FOUND"
      ? 404
      : error.code === "ASSET_TOO_LARGE"
        ? 413
        : error.code === "UNSUPPORTED_ASSET"
          ? 415
          : error.code === "ASSET_HASH_MISMATCH"
            ? 422
            : error.code === "ASSET_QUOTA_EXCEEDED"
              ? 409
              : 503;
    return accountJson({ error: error.code }, status, cookies);
  }
  return accountJson({ error: "ASSET_UNAVAILABLE" }, 503, cookies);
};

export function createAccountAssetsHandler(
  dependencies: AccountAssetsDependencies = {}
): (request: Request, context?: Context) => Promise<Response> {
  return async (request) => {
    let responseCookies: readonly string[] = [];
    const url = new URL(request.url);
    if (!url.pathname.startsWith(ASSET_PATH_PREFIX)) {
      return accountJson({ error: "NOT_FOUND" }, 404);
    }
    const match = ASSET_PATH_PATTERN.exec(url.pathname);
    if (match === null || [...url.searchParams.keys()].length !== 0) {
      return accountJson({ error: "INVALID_REQUEST" }, 400);
    }
    if (request.method !== "GET" && request.method !== "PUT") {
      return accountJson({ error: "METHOD_NOT_ALLOWED" }, 405, [], { allow: "GET, PUT" });
    }
    const digest = match[1]!;

    try {
      let contentType: string | undefined;
      if (request.method === "PUT") {
        assertSameOriginMutation(request, "PUT");
        contentType = request.headers.get("content-type")?.trim().toLowerCase();
        if (contentType === undefined || !SUPPORTED_CONTENT_TYPES.has(contentType) ||
          ![null, "identity"].includes(request.headers.get("content-encoding"))) {
          throw new AccountAssetError("UNSUPPORTED_ASSET");
        }
        const declaredLength = request.headers.get("content-length");
        if (declaredLength !== null) {
          if (!/^\d+$/u.test(declaredLength)) {
            throw new AccountRequestError("INVALID_REQUEST", 400);
          }
          const parsedLength = Number(declaredLength);
          if (parsedLength > ACCOUNT_ASSET_LIMITS.maxAssetBytes) {
            throw new AccountAssetError("ASSET_TOO_LARGE");
          }
          if (parsedLength < 1) throw new AccountAssetError("UNSUPPORTED_ASSET");
        }
      }

      const environment = configuredEnvironment(dependencies.environment);
      const client = new SupabaseAccountClient(environment, dependencies.fetcher ?? fetch);
      const session = await resolveAccountSession(client, parseAccountCookies(request));
      if (!session.authenticated) {
        return accountJson(
          { error: "AUTHENTICATION_REQUIRED" },
          401,
          session.clearCookies ? clearAccountSessionCookies(true) : []
        );
      }
      responseCookies = session.rotatedTokens === undefined
        ? []
        : serialiseAccountSessionCookies(
          session.rotatedTokens,
          session.identity.resetGeneration,
          REFRESH_COOKIE_MAX_AGE_SECONDS,
          true
        );
      if (!accountIdentityMatches(request, session.identity.username)) {
        return accountJson({ error: "ACCOUNT_IDENTITY_CHANGED" }, 409, responseCookies);
      }
      const service = dependencies.service ?? await (
        dependencies.serviceFactory ?? defaultAccountAssetService
      )(environment.assetNamespaceSecret);

      if (request.method === "PUT") {
        const bytes = await readBoundedAsset(request);
        const result = await service.put(session.identity.userId, digest, contentType!, bytes);
        return accountJson(result.manifest, result.created ? 201 : 200, responseCookies);
      }

      const result = await service.get(session.identity.userId, digest);
      return assetBinary(result.descriptor, result.bytes, responseCookies);
    } catch (error) {
      const failureKind = classifyAccountAssetStorageFailure(error);
      if (failureKind !== null) {
        (dependencies.reportStorageFailure ?? reportStorageFailure)(failureKind);
      }
      return assetErrorResponse(error, responseCookies);
    }
  };
}

export default createAccountAssetsHandler();

export const config: Config = {
  path: ["/api/account/assets/:sha256"],
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
