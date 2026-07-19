import type { Config, Context } from "@netlify/functions";
import {
  AccountConfigurationError,
  AccountRequestError,
  SupabaseAccountClient,
  accountJson,
  assertSameOriginMutation,
  parseAccountCookies,
  resolveAccountSession,
  type AccountAuthTokens,
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
  clearAccountAccessCookie,
  clearAccountRefreshCookie,
  serialiseAccountAccessCookie,
  serialiseAccountRefreshCookie
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
  readonly service?: AccountAssetServicePort;
  readonly serviceFactory?: (namespaceSecret: string) => Promise<AccountAssetServicePort>;
}

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

const sessionCookies = (tokens: AccountAuthTokens): readonly string[] => [
  serialiseAccountAccessCookie(tokens.accessToken, tokens.expiresIn, true),
  serialiseAccountRefreshCookie(tokens.refreshToken, REFRESH_COOKIE_MAX_AGE_SECONDS, true)
];

const expiredCookies = (): readonly string[] => [
  clearAccountAccessCookie(true),
  clearAccountRefreshCookie(true)
];

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
          session.clearCookies ? expiredCookies() : []
        );
      }
      responseCookies = session.rotatedTokens === undefined
        ? []
        : sessionCookies(session.rotatedTokens);
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
