import { createHash, timingSafeEqual } from "node:crypto";
import {
  ACCOUNT_ACCESS_COOKIE,
  ACCOUNT_REFRESH_COOKIE,
  normaliseAccountUsername
} from "./account-primitives";

export const ACCOUNT_JSON_LIMIT = 16 * 1_024;
export const PROGRESS_JSON_LIMIT = 256 * 1_024;

const UPSTREAM_JSON_LIMIT = 64 * 1_024;
const PROGRESS_UPSTREAM_JSON_LIMIT = PROGRESS_JSON_LIMIT + 16 * 1_024;
const PROGRESS_LIST_UPSTREAM_JSON_LIMIT = 4 * 1_024;
const ACCOUNT_TOKEN_PATTERN = /^[A-Za-z0-9._~-]{1,4096}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MODERN_PUBLISHABLE_PATTERN = /^sb_publishable_[A-Za-z0-9_-]{24,256}$/u;
const EDGE_BACKEND_PATH = "/functions/v1/advertising-game-backend";

export interface AccountEnvironment {
  readonly supabaseUrl: string;
  readonly publishableKey: string;
  readonly edgeGatewaySecret: string;
  readonly usernameHmacSecret: string;
  readonly classroomCode: string;
}

export type AccountEnvironmentRecord = Readonly<Record<string, string | undefined>>;

export class AccountConfigurationError extends Error {
  constructor() {
    super("Account backend configuration is invalid");
    this.name = "AccountConfigurationError";
  }
}

export class AccountRequestError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = "AccountRequestError";
  }
}

export type SupabaseAccountErrorKind =
  | "duplicate_user"
  | "expired_session"
  | "invalid_credentials"
  | "upstream";

export class SupabaseAccountError extends Error {
  constructor(readonly kind: SupabaseAccountErrorKind) {
    super(`Supabase account request failed (${kind})`);
    this.name = "SupabaseAccountError";
  }
}

const boundedString = (
  value: string | undefined,
  minimumBytes: number,
  maximumBytes: number
): string => {
  if (typeof value !== "string" || value.trim() !== value) {
    throw new AccountConfigurationError();
  }
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes < minimumBytes || bytes > maximumBytes) throw new AccountConfigurationError();
  return value;
};

const legacyKeyHasRole = (value: string, expectedRole: "anon" | "service_role"): boolean => {
  if (value.length < 80 || value.length > 2_048) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/u.test(part))) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as unknown;
    return typeof payload === "object" && payload !== null &&
      (payload as { role?: unknown }).role === expectedRole;
  } catch {
    return false;
  }
};

const parseApiKey = (
  value: string | undefined,
  modernPattern: RegExp,
  legacyRole: "anon" | "service_role"
): string => {
  const key = boundedString(value, 32, 2_048);
  if (!modernPattern.test(key) && !legacyKeyHasRole(key, legacyRole)) {
    throw new AccountConfigurationError();
  }
  return key;
};

export function parseAccountEnvironment(environment: AccountEnvironmentRecord): AccountEnvironment {
  const supabaseUrl = boundedString(environment.SUPABASE_URL, 40, 256);
  let url: URL;
  try {
    url = new URL(supabaseUrl);
  } catch {
    throw new AccountConfigurationError();
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "" ||
    !/^[a-z0-9]{20}\.supabase\.co$/u.test(url.hostname) ||
    `${url.protocol}//${url.host}` !== supabaseUrl
  ) {
    throw new AccountConfigurationError();
  }

  const classroomCode = boundedString(
    environment.ADVERTISING_GAME_CLASSROOM_CODE,
    8,
    128
  );
  if (!/^[\x20-\x7e]+$/u.test(classroomCode)) throw new AccountConfigurationError();

  const publishableKey = parseApiKey(
    environment.SUPABASE_PUBLISHABLE_KEY,
    MODERN_PUBLISHABLE_PATTERN,
    "anon"
  );
  const edgeGatewaySecret = boundedString(
    environment.ADVERTISING_GAME_EDGE_GATEWAY_SECRET,
    32,
    256
  );
  const usernameHmacSecret = boundedString(
    environment.ADVERTISING_GAME_USERNAME_HMAC_SECRET,
    32,
    256
  );
  if (
    publishableKey === edgeGatewaySecret ||
    usernameHmacSecret === edgeGatewaySecret ||
    classroomCode === edgeGatewaySecret
  ) throw new AccountConfigurationError();

  return {
    supabaseUrl,
    publishableKey,
    edgeGatewaySecret,
    usernameHmacSecret,
    classroomCode
  };
}

export function secureAccountCodeMatches(candidate: unknown, expected: string): boolean {
  const validCandidate = typeof candidate === "string" &&
    Buffer.byteLength(candidate, "utf8") >= 1 &&
    Buffer.byteLength(candidate, "utf8") <= 128 &&
    /^[\x20-\x7e]+$/u.test(candidate);
  const candidateDigest = createHash("sha256")
    .update(validCandidate ? candidate as string : "", "utf8")
    .digest();
  const expectedDigest = createHash("sha256").update(expected, "utf8").digest();
  return validCandidate && timingSafeEqual(candidateDigest, expectedDigest);
}

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "cross-origin-resource-policy": "same-origin",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
};

export function accountJson(
  body: unknown,
  status = 200,
  cookies: readonly string[] = [],
  extraHeaders: HeadersInit = {}
): Response {
  const headers = new Headers({
    ...SECURITY_HEADERS,
    ...Object.fromEntries(new Headers(extraHeaders))
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return Response.json(body, { status, headers });
}

export function accountNoContent(cookies: readonly string[] = []): Response {
  const headers = new Headers(SECURITY_HEADERS);
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(null, { status: 204, headers });
}

export function assertSameOriginMutation(
  request: Request,
  expectedMethod: "POST" | "PUT"
): void {
  let requestUrl: URL;
  try {
    requestUrl = new URL(request.url);
  } catch {
    throw new AccountRequestError("CSRF_REJECTED", 403);
  }

  const firstForwardedValue = (value: string | null): string | null => {
    const first = value?.split(",", 1)[0]?.trim();
    return first ? first : null;
  };
  const deploymentHost = firstForwardedValue(request.headers.get("x-forwarded-host")) ??
    firstForwardedValue(request.headers.get("host")) ?? requestUrl.host;
  const forwardedProtocol = firstForwardedValue(request.headers.get("x-forwarded-proto"));
  const deploymentProtocol = forwardedProtocol ?? requestUrl.protocol.slice(0, -1);

  let deploymentOrigin: string;
  try {
    if (deploymentProtocol !== "https" && deploymentProtocol !== "http") throw new Error();
    const candidate = new URL(`${deploymentProtocol}://${deploymentHost}`);
    if (
      candidate.username !== "" || candidate.password !== "" || candidate.pathname !== "/" ||
      candidate.search !== "" || candidate.hash !== "" ||
      candidate.host.toLowerCase() !== deploymentHost.toLowerCase()
    ) throw new Error();
    deploymentOrigin = candidate.origin;
  } catch {
    throw new AccountRequestError("CSRF_REJECTED", 403);
  }

  if (request.method !== expectedMethod || request.headers.get("origin") !== deploymentOrigin) {
    throw new AccountRequestError("CSRF_REJECTED", 403);
  }
}

export function assertSameOriginPost(request: Request): void {
  assertSameOriginMutation(request, "POST");
}

const readBoundedBytes = async (responseBody: ReadableStream<Uint8Array> | null, limit: number) => {
  if (responseBody === null) return new Uint8Array();
  const reader = responseBody.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new AccountRequestError("REQUEST_TOO_LARGE", 413);
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
};

export async function readAccountJson(request: Request, maximumBytes: number): Promise<unknown> {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new AccountRequestError("UNSUPPORTED_MEDIA_TYPE", 415);
  }
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > maximumBytes)) {
    throw new AccountRequestError("REQUEST_TOO_LARGE", 413);
  }
  const bytes = await readBoundedBytes(request.body, maximumBytes);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch (error) {
    if (error instanceof AccountRequestError) throw error;
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
}

export interface AccountCookies {
  readonly accessToken?: string;
  readonly refreshToken?: string;
}

export function parseAccountCookies(request: Request): AccountCookies {
  const found: { accessToken?: string; refreshToken?: string } = {};
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return found;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!ACCOUNT_TOKEN_PATTERN.test(value)) continue;
    if (name === ACCOUNT_ACCESS_COOKIE) found.accessToken = value;
    if (name === ACCOUNT_REFRESH_COOKIE) found.refreshToken = value;
  }
  return found;
}

export interface AccountAuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

export interface AccountIdentity {
  readonly userId: string;
  readonly username: string;
}

export interface ProgressRpcInput {
  readonly userId: string;
  readonly operation: "list" | "load" | "save";
  readonly documentId?: string;
  readonly schema: string;
  readonly version: number;
  readonly expectedRevision?: number;
  readonly document?: Readonly<Record<string, unknown>>;
}

const parseJsonResponse = async (
  response: Response,
  maximumBytes = UPSTREAM_JSON_LIMIT
): Promise<unknown> => {
  try {
    const bytes = await readBoundedBytes(response.body, maximumBytes);
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new SupabaseAccountError("upstream");
  }
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

const parseAuthTokens = (value: unknown): AccountAuthTokens => {
  const record = asRecord(value);
  const accessToken = record?.access_token;
  const refreshToken = record?.refresh_token;
  const expiresIn = record?.expires_in;
  if (
    typeof accessToken !== "string" || !ACCOUNT_TOKEN_PATTERN.test(accessToken) ||
    typeof refreshToken !== "string" || !ACCOUNT_TOKEN_PATTERN.test(refreshToken) ||
    typeof expiresIn !== "number" || !Number.isInteger(expiresIn) ||
    expiresIn < 1 || expiresIn > 86_400
  ) {
    throw new SupabaseAccountError("upstream");
  }
  return { accessToken, refreshToken, expiresIn };
};

export class SupabaseAccountClient {
  constructor(
    private readonly environment: AccountEnvironment,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  private async request(path: string, init: RequestInit): Promise<Response> {
    try {
      const response = await this.fetcher(`${this.environment.supabaseUrl}${path}`, {
        ...init,
        redirect: "error"
      });
      if (response.redirected) throw new SupabaseAccountError("upstream");
      return response;
    } catch {
      throw new SupabaseAccountError("upstream");
    }
  }

  private publishableHeaders(authorization?: string): Record<string, string> {
    const headers: Record<string, string> = {
      apikey: this.environment.publishableKey,
      "content-type": "application/json"
    };
    if (authorization !== undefined) {
      headers.authorization = `Bearer ${authorization}`;
    } else if (!this.environment.publishableKey.startsWith("sb_publishable_")) {
      headers.authorization = `Bearer ${this.environment.publishableKey}`;
    }
    return headers;
  }

  private edgeHeaders(): Record<string, string> {
    return {
      "content-type": "application/json",
      "x-advertising-game-gateway-secret": this.environment.edgeGatewaySecret
    };
  }

  async createConfirmedUser(email: string, password: string, username: string): Promise<void> {
    const response = await this.request(EDGE_BACKEND_PATH, {
      method: "POST",
      headers: this.edgeHeaders(),
      body: JSON.stringify({
        operation: "create_user",
        email,
        password,
        username
      })
    });
    if (response.ok) return;
    if (response.status === 409) {
      throw new SupabaseAccountError("duplicate_user");
    }
    throw new SupabaseAccountError("upstream");
  }

  async signInWithPassword(email: string, password: string): Promise<AccountAuthTokens> {
    const response = await this.request("/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: this.publishableHeaders(),
      body: JSON.stringify({ email, password })
    });
    if (!response.ok) {
      if ([400, 401, 422].includes(response.status)) {
        throw new SupabaseAccountError("invalid_credentials");
      }
      throw new SupabaseAccountError("upstream");
    }
    return parseAuthTokens(await parseJsonResponse(response));
  }

  async refreshSession(refreshToken: string): Promise<AccountAuthTokens> {
    const response = await this.request("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      headers: this.publishableHeaders(),
      body: JSON.stringify({ refresh_token: refreshToken })
    });
    if (!response.ok) {
      if ([400, 401, 403, 422].includes(response.status)) {
        throw new SupabaseAccountError("expired_session");
      }
      throw new SupabaseAccountError("upstream");
    }
    return parseAuthTokens(await parseJsonResponse(response));
  }

  async getUser(accessToken: string): Promise<AccountIdentity> {
    const response = await this.request("/auth/v1/user", {
      method: "GET",
      headers: this.publishableHeaders(accessToken)
    });
    if (!response.ok) {
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        throw new SupabaseAccountError("expired_session");
      }
      throw new SupabaseAccountError("upstream");
    }
    const record = asRecord(await parseJsonResponse(response));
    const id = record?.id;
    const appMetadata = asRecord(record?.app_metadata);
    const rawUsername = appMetadata?.advertising_game_username;
    if (typeof id !== "string" || !UUID_PATTERN.test(id) || typeof rawUsername !== "string") {
      throw new SupabaseAccountError("upstream");
    }
    try {
      return { userId: id, username: normaliseAccountUsername(rawUsername) };
    } catch {
      throw new SupabaseAccountError("upstream");
    }
  }

  async logout(accessToken: string): Promise<void> {
    const response = await this.request("/auth/v1/logout?scope=global", {
      method: "POST",
      headers: this.publishableHeaders(accessToken)
    });
    if (response.ok) return;
    if (response.status === 401 || response.status === 403) {
      throw new SupabaseAccountError("expired_session");
    }
    throw new SupabaseAccountError("upstream");
  }

  async progressRpc(input: ProgressRpcInput): Promise<unknown> {
    const response = await this.request(EDGE_BACKEND_PATH, {
      method: "POST",
      headers: this.edgeHeaders(),
      body: JSON.stringify({
        operation: "progress",
        input
      })
    });
    if (!response.ok) throw new SupabaseAccountError("upstream");
    return parseJsonResponse(
      response,
      input.operation === "list" ? PROGRESS_LIST_UPSTREAM_JSON_LIMIT : PROGRESS_UPSTREAM_JSON_LIMIT
    );
  }
}

export type ResolvedAccountSession =
  | {
    readonly authenticated: true;
    readonly identity: AccountIdentity;
    readonly rotatedTokens?: AccountAuthTokens;
  }
  | {
    readonly authenticated: false;
    readonly clearCookies: boolean;
  };

export async function resolveAccountSession(
  client: SupabaseAccountClient,
  cookies: AccountCookies
): Promise<ResolvedAccountSession> {
  if (cookies.accessToken !== undefined) {
    try {
      return { authenticated: true, identity: await client.getUser(cookies.accessToken) };
    } catch (error) {
      if (!(error instanceof SupabaseAccountError) || error.kind !== "expired_session") throw error;
    }
  }
  if (cookies.refreshToken === undefined) {
    return { authenticated: false, clearCookies: cookies.accessToken !== undefined };
  }
  try {
    const rotatedTokens = await client.refreshSession(cookies.refreshToken);
    const identity = await client.getUser(rotatedTokens.accessToken);
    return { authenticated: true, identity, rotatedTokens };
  } catch (error) {
    if (error instanceof SupabaseAccountError && error.kind === "expired_session") {
      return { authenticated: false, clearCookies: true };
    }
    throw error;
  }
}
