const REQUEST_LIMIT = 280 * 1_024;
const RESPONSE_LIMIT = 280 * 1_024;
const AUTHORIZATION_RPC = "/rest/v1/rpc/advertising_game_backend_authorized";
const PROGRESS_RPC = "/rest/v1/rpc/advertising_game_progress_rpc";
const ADMIN_USERS = "/auth/v1/admin/users";

const PROJECT_URL_PATTERN = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/u;
const MODERN_SECRET_PATTERN = /^sb_secret_[A-Za-z0-9_-]{24,256}$/u;
const GATEWAY_SECRET_PATTERN = /^[A-Za-z0-9_-]{32,256}$/u;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,23}$/u;
const SYNTHETIC_EMAIL_PATTERN = /^[a-f0-9]{64}@accounts\.admarket\.invalid$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DOCUMENT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/u;

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "cross-origin-resource-policy": "same-origin",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff"
};

export interface AdvertisingGameBackendDependencies {
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly fetcher?: typeof fetch;
}

interface EdgeEnvironment {
  readonly supabaseUrl: string;
  readonly serviceKey: string;
}

class InvalidRequestError extends Error {}
class UpstreamError extends Error {}
class ConfigurationError extends Error {}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (record: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const byteLength = (value: string): number => new TextEncoder().encode(value).byteLength;

const jsonResponse = (body: unknown, status: number): Response => Response.json(body, {
  status,
  headers: SECURITY_HEADERS
});

const noContent = (): Response => new Response(null, { status: 204, headers: SECURITY_HEADERS });

const decodeBase64Url = (value: string): string => {
  const padded = value.replace(/-/gu, "+").replace(/_/gu, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "="
  );
  return atob(padded);
};

const legacyServiceRoleKey = (value: string): boolean => {
  if (value.length < 80 || value.length > 2_048) return false;
  const parts = value.split(".");
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/u.test(part))) return false;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]!)) as unknown;
    return isRecord(payload) && payload.role === "service_role";
  } catch {
    return false;
  }
};

const parseEnvironment = (
  environment: Readonly<Record<string, string | undefined>>
): EdgeEnvironment => {
  const supabaseUrl = environment.SUPABASE_URL;
  if (typeof supabaseUrl !== "string" || !PROJECT_URL_PATTERN.test(supabaseUrl)) {
    throw new ConfigurationError();
  }

  let modernKey: unknown;
  try {
    const keys = environment.SUPABASE_SECRET_KEYS === undefined
      ? undefined
      : JSON.parse(environment.SUPABASE_SECRET_KEYS) as unknown;
    modernKey = isRecord(keys) ? keys.default : undefined;
  } catch {
    throw new ConfigurationError();
  }
  const legacyKey = environment.SUPABASE_SERVICE_ROLE_KEY;
  const serviceKey = typeof modernKey === "string" && MODERN_SECRET_PATTERN.test(modernKey)
    ? modernKey
    : typeof legacyKey === "string" && legacyServiceRoleKey(legacyKey)
      ? legacyKey
      : undefined;
  if (serviceKey === undefined) throw new ConfigurationError();
  return { supabaseUrl, serviceKey };
};

const serviceHeaders = (serviceKey: string): Record<string, string> => {
  const headers: Record<string, string> = {
    apikey: serviceKey,
    "content-type": "application/json"
  };
  if (!serviceKey.startsWith("sb_secret_")) headers.authorization = `Bearer ${serviceKey}`;
  return headers;
};

const readBoundedBytes = async (
  body: ReadableStream<Uint8Array> | null,
  maximumBytes: number
): Promise<Uint8Array> => {
  if (body === null) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maximumBytes) {
      await reader.cancel();
      throw new InvalidRequestError();
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

const parseJsonBytes = (bytes: Uint8Array): unknown => {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new InvalidRequestError();
  }
};

const safeFetch = async (
  fetcher: typeof fetch,
  url: string,
  init: RequestInit
): Promise<Response> => {
  try {
    const response = await fetcher(url, { ...init, redirect: "error" });
    if (response.redirected) throw new UpstreamError();
    return response;
  } catch {
    throw new UpstreamError();
  }
};

const upstreamJson = async (response: Response, limit = RESPONSE_LIMIT): Promise<unknown> => {
  if (!response.ok) throw new UpstreamError();
  try {
    return parseJsonBytes(await readBoundedBytes(response.body, limit));
  } catch {
    throw new UpstreamError();
  }
};

const gatewayAuthorised = async (
  environment: EdgeEnvironment,
  gatewaySecret: string,
  fetcher: typeof fetch
): Promise<boolean> => {
  const response = await safeFetch(fetcher, `${environment.supabaseUrl}${AUTHORIZATION_RPC}`, {
    method: "POST",
    headers: serviceHeaders(environment.serviceKey),
    body: JSON.stringify({ p_candidate: gatewaySecret })
  });
  const result = await upstreamJson(response, 16);
  if (typeof result !== "boolean") throw new UpstreamError();
  return result;
};

interface CreateUserInput {
  readonly operation: "create_user";
  readonly email: string;
  readonly password: string;
  readonly username: string;
}

const parseCreateUser = (record: Record<string, unknown>): CreateUserInput => {
  if (!hasExactKeys(record, ["operation", "email", "password", "username"]) ||
    record.operation !== "create_user" ||
    typeof record.email !== "string" || !SYNTHETIC_EMAIL_PATTERN.test(record.email) ||
    typeof record.username !== "string" || !USERNAME_PATTERN.test(record.username) ||
    typeof record.password !== "string" || record.password.includes("\0") ||
    byteLength(record.password) < 8 || byteLength(record.password) > 128) {
    throw new InvalidRequestError();
  }
  return {
    operation: "create_user",
    email: record.email,
    password: record.password,
    username: record.username
  };
};

interface ProgressInput {
  readonly userId: string;
  readonly operation: "list" | "load" | "save";
  readonly documentId?: string;
  readonly schema: "advertising-game-progress";
  readonly version: 1;
  readonly expectedRevision?: number;
  readonly document?: Record<string, unknown>;
}

const parseProgress = (record: Record<string, unknown>): ProgressInput => {
  if (!hasExactKeys(record, ["operation", "input"]) || record.operation !== "progress" ||
    !isRecord(record.input)) throw new InvalidRequestError();
  const input = record.input;
  if (typeof input.userId !== "string" || !UUID_PATTERN.test(input.userId) ||
    input.schema !== "advertising-game-progress" || input.version !== 1 ||
    (input.operation !== "list" && input.operation !== "load" && input.operation !== "save")) {
    throw new InvalidRequestError();
  }

  const expectedKeys = input.operation === "list"
    ? ["userId", "operation", "schema", "version"]
    : input.operation === "load"
      ? ["userId", "operation", "documentId", "schema", "version"]
      : ["userId", "operation", "documentId", "schema", "version", "expectedRevision", "document"];
  if (!hasExactKeys(input, expectedKeys)) throw new InvalidRequestError();
  if (input.operation !== "list" &&
    (typeof input.documentId !== "string" || !DOCUMENT_ID_PATTERN.test(input.documentId))) {
    throw new InvalidRequestError();
  }
  if (input.operation === "save" &&
    (typeof input.expectedRevision !== "number" ||
      !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 ||
      !isRecord(input.document))) {
    throw new InvalidRequestError();
  }
  return input as unknown as ProgressInput;
};

const createUser = async (
  input: CreateUserInput,
  environment: EdgeEnvironment,
  fetcher: typeof fetch
): Promise<Response> => {
  const response = await safeFetch(fetcher, `${environment.supabaseUrl}${ADMIN_USERS}`, {
    method: "POST",
    headers: serviceHeaders(environment.serviceKey),
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: { advertising_game_username: input.username }
    })
  });
  if (response.ok) return noContent();
  if (response.status === 409) return jsonResponse({ error: "USERNAME_UNAVAILABLE" }, 409);
  if (response.status === 422) {
    let body: unknown;
    try {
      body = parseJsonBytes(await readBoundedBytes(response.body, 8 * 1_024));
    } catch {
      throw new UpstreamError();
    }
    if (isRecord(body) && (body.code === "email_exists" || body.code === "user_already_exists")) {
      return jsonResponse({ error: "USERNAME_UNAVAILABLE" }, 409);
    }
  }
  throw new UpstreamError();
};

const progress = async (
  input: ProgressInput,
  environment: EdgeEnvironment,
  fetcher: typeof fetch
): Promise<Response> => {
  const response = await safeFetch(fetcher, `${environment.supabaseUrl}${PROGRESS_RPC}`, {
    method: "POST",
    headers: serviceHeaders(environment.serviceKey),
    body: JSON.stringify({
      p_user_id: input.userId,
      p_operation: input.operation,
      p_document_id: input.documentId ?? null,
      p_document_schema: input.schema,
      p_schema_version: input.version,
      ...(input.expectedRevision === undefined
        ? {}
        : { p_expected_revision: input.expectedRevision }),
      ...(input.document === undefined ? {} : { p_document: input.document })
    })
  });
  const result = await upstreamJson(response);
  if (!isRecord(result) || typeof result.status !== "string") throw new UpstreamError();
  return jsonResponse(result, 200);
};

export function createAdvertisingGameBackendHandler(
  dependencies: AdvertisingGameBackendDependencies = {}
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      if (request.method !== "POST") return jsonResponse({ error: "METHOD_NOT_ALLOWED" }, 405);
      const url = new URL(request.url);
      if (url.search !== "" || url.hash !== "") throw new InvalidRequestError();
      if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
        "application/json") throw new InvalidRequestError();
      const declaredLength = request.headers.get("content-length");
      if (declaredLength !== null &&
        (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > REQUEST_LIMIT)) {
        throw new InvalidRequestError();
      }

      const gatewaySecret = request.headers.get("x-advertising-game-gateway-secret");
      if (gatewaySecret === null || !GATEWAY_SECRET_PATTERN.test(gatewaySecret)) {
        return jsonResponse({ error: "AUTHENTICATION_REQUIRED" }, 401);
      }
      const environment = parseEnvironment(dependencies.environment ?? {});
      const fetcher = dependencies.fetcher ?? fetch;
      if (!await gatewayAuthorised(environment, gatewaySecret, fetcher)) {
        return jsonResponse({ error: "AUTHENTICATION_REQUIRED" }, 401);
      }

      const body = parseJsonBytes(await readBoundedBytes(request.body, REQUEST_LIMIT));
      if (!isRecord(body)) throw new InvalidRequestError();
      if (body.operation === "create_user") {
        return await createUser(parseCreateUser(body), environment, fetcher);
      }
      if (body.operation === "progress") {
        return await progress(parseProgress(body), environment, fetcher);
      }
      throw new InvalidRequestError();
    } catch (error) {
      if (error instanceof InvalidRequestError) return jsonResponse({ error: "INVALID_REQUEST" }, 400);
      return jsonResponse({ error: "BACKEND_UNAVAILABLE" }, 503);
    }
  };
}
