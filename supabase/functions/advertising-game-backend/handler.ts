const REQUEST_LIMIT = 280 * 1_024;
const RESPONSE_LIMIT = 280 * 1_024;
const AUTHORIZATION_RPC = "/rest/v1/rpc/advertising_game_backend_authorized";
const PROGRESS_RPC = "/rest/v1/rpc/advertising_game_progress_rpc";
const IMAGE_LAB_RPC = "/rest/v1/rpc/advertising_game_image_lab_rpc";
const IMAGE_LAB_TEACHER_RPC = "/rest/v1/rpc/advertising_game_image_lab_teacher_rpc";
const ADMIN_USERS = "/auth/v1/admin/users";

const PROJECT_URL_PATTERN = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/u;
const MODERN_SECRET_PATTERN = /^sb_secret_[A-Za-z0-9_-]{24,256}$/u;
const GATEWAY_SECRET_PATTERN = /^[A-Za-z0-9_-]{32,256}$/u;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,23}$/u;
const SYNTHETIC_EMAIL_PATTERN = /^[a-f0-9]{64}@accounts\.admarket\.invalid$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const DOCUMENT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/u;
const SAFE_OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SESSION_EPOCH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const TEACHER_PLAYTEST_USERNAME = "teacher-playtest";
const ADMIN_USERS_LIMIT = 1_000;
const ADMIN_USERS_RESPONSE_LIMIT = 1_024 * 1_024;

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
  readonly randomUUID?: () => string;
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
    record.username === TEACHER_PLAYTEST_USERNAME ||
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

type AccountAdminOperation =
  | { readonly operation: "list_users" }
  | {
      readonly operation: "find_user";
      readonly email: string;
      readonly username: string;
    }
  | {
      readonly operation: "replace_password";
      readonly email: string;
      readonly username: string;
      readonly password: string;
    }
  | {
      readonly operation: "ensure_user";
      readonly email: string;
      readonly username: typeof TEACHER_PLAYTEST_USERNAME;
      readonly password: string;
    }
  | {
      readonly operation: "begin_reset";
      readonly email: string;
      readonly username: string;
      readonly operationId: string;
    }
  | {
      readonly operation: "complete_reset";
      readonly email: string;
      readonly username: string;
      readonly operationId: string;
    };

interface AccountAdminRecord {
  readonly userId: string;
  readonly username: string;
  readonly createdAt: string;
  readonly lastSignInAt: string | null;
}

interface ParsedAdminUser {
  readonly record: AccountAdminRecord;
  readonly email: string;
  readonly appMetadata: Readonly<Record<string, unknown>>;
}

const validPassword = (value: unknown): value is string =>
  typeof value === "string" &&
  !value.includes("\0") &&
  byteLength(value) >= 8 &&
  byteLength(value) <= 128;

const parseAccountAdminOperation = (
  record: Record<string, unknown>
): AccountAdminOperation => {
  if (record.operation === "list_users") {
    if (!hasExactKeys(record, ["operation"])) throw new InvalidRequestError();
    return { operation: "list_users" };
  }
  if (
    record.operation !== "find_user" &&
    record.operation !== "replace_password" &&
    record.operation !== "ensure_user" &&
    record.operation !== "begin_reset" &&
    record.operation !== "complete_reset"
  ) {
    throw new InvalidRequestError();
  }
  const includesPassword =
    record.operation === "replace_password" || record.operation === "ensure_user";
  const includesOperationId =
    record.operation === "begin_reset" || record.operation === "complete_reset";
  const keys = includesPassword
    ? ["operation", "email", "username", "password"]
    : includesOperationId
      ? ["operation", "email", "username", "operationId"]
      : ["operation", "email", "username"];
  if (
    !hasExactKeys(record, keys) ||
    typeof record.email !== "string" ||
    !SYNTHETIC_EMAIL_PATTERN.test(record.email) ||
    typeof record.username !== "string" ||
    !USERNAME_PATTERN.test(record.username) ||
    (includesPassword && !validPassword(record.password)) ||
    (includesOperationId &&
      (typeof record.operationId !== "string" || !UUID_PATTERN.test(record.operationId)))
  ) {
    throw new InvalidRequestError();
  }
  if (
    (record.operation === "ensure_user") !==
    (record.username === TEACHER_PLAYTEST_USERNAME)
  ) {
    throw new InvalidRequestError();
  }
  if (
    record.operation === "replace_password" &&
    record.username === TEACHER_PLAYTEST_USERNAME
  ) {
    throw new InvalidRequestError();
  }
  if (includesOperationId && record.username === TEACHER_PLAYTEST_USERNAME) {
    throw new InvalidRequestError();
  }
  return record as AccountAdminOperation;
};

const validIsoTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) &&
  Number.isFinite(Date.parse(value));

const parseAdminUser = (value: unknown): ParsedAdminUser | null => {
  if (!isRecord(value)) return null;
  const metadata = isRecord(value.app_metadata) ? value.app_metadata : null;
  const username = metadata?.advertising_game_username;
  const lastSignInAt =
    value.last_sign_in_at === undefined ? null : value.last_sign_in_at;
  if (
    typeof value.id !== "string" ||
    !UUID_PATTERN.test(value.id) ||
    typeof value.email !== "string" ||
    !SYNTHETIC_EMAIL_PATTERN.test(value.email) ||
    typeof username !== "string" ||
    !USERNAME_PATTERN.test(username) ||
    !validIsoTimestamp(value.created_at) ||
    (lastSignInAt !== null && !validIsoTimestamp(lastSignInAt))
  ) {
    return null;
  }
  return {
    email: value.email,
    appMetadata: metadata ?? {},
    record: {
      userId: value.id,
      username,
      createdAt: value.created_at,
      lastSignInAt
    }
  };
};

const listAdminUsers = async (
  environment: EdgeEnvironment,
  fetcher: typeof fetch
): Promise<readonly ParsedAdminUser[]> => {
  const response = await safeFetch(
    fetcher,
    `${environment.supabaseUrl}${ADMIN_USERS}?page=1&per_page=${ADMIN_USERS_LIMIT}`,
    {
      method: "GET",
      headers: serviceHeaders(environment.serviceKey)
    }
  );
  const body = await upstreamJson(response, ADMIN_USERS_RESPONSE_LIMIT);
  if (!isRecord(body) || !Array.isArray(body.users) ||
    body.users.length >= ADMIN_USERS_LIMIT ||
    (body.next_page !== undefined && body.next_page !== null && body.next_page !== 0)) {
    throw new UpstreamError();
  }

  const result: ParsedAdminUser[] = [];
  for (const candidate of body.users) {
    const parsed = parseAdminUser(candidate);
    if (parsed !== null) {
      result.push(parsed);
      continue;
    }
    if (isRecord(candidate)) {
      const metadata = isRecord(candidate.app_metadata) ? candidate.app_metadata : null;
      if (
        (typeof candidate.email === "string" &&
          SYNTHETIC_EMAIL_PATTERN.test(candidate.email)) ||
        (typeof metadata?.advertising_game_username === "string" &&
          USERNAME_PATTERN.test(metadata.advertising_game_username))
      ) {
        throw new UpstreamError();
      }
    }
  }
  const identifiers = new Set<string>();
  for (const user of result) {
    for (const identity of [
      `id:${user.record.userId}`,
      `email:${user.email}`,
      `username:${user.record.username}`
    ]) {
      if (identifiers.has(identity)) throw new UpstreamError();
      identifiers.add(identity);
    }
  }
  return result;
};

const findAdminUser = (
  users: readonly ParsedAdminUser[],
  email: string,
  username: string
): ParsedAdminUser | null => {
  const matches = users.filter((user) =>
    user.email === email && user.record.username === username
  );
  if (
    matches.length > 1 ||
    users.some((user) =>
      (user.email === email || user.record.username === username) &&
      (user.email !== email || user.record.username !== username))
  ) {
    throw new UpstreamError();
  }
  return matches[0] ?? null;
};

const accountAdmin = async (
  input: AccountAdminOperation,
  environment: EdgeEnvironment,
  fetcher: typeof fetch,
  randomUUID: () => string
): Promise<Response> => {
  const users = await listAdminUsers(environment, fetcher);
  if (input.operation === "list_users") {
    return jsonResponse({
      users: users
        .filter(({ record }) => record.username !== TEACHER_PLAYTEST_USERNAME)
        .map(({ record }) => record)
        .sort((left, right) => left.username.localeCompare(right.username))
    }, 200);
  }

  const current = findAdminUser(users, input.email, input.username);
  if (input.operation === "find_user") {
    return jsonResponse({ user: current?.record ?? null }, 200);
  }
  if (input.operation === "ensure_user") {
    if (current !== null) return jsonResponse({ user: current.record }, 200);
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
    const created = parseAdminUser(await upstreamJson(response));
    if (
      created === null ||
      created.email !== input.email ||
      created.record.username !== input.username
    ) {
      throw new UpstreamError();
    }
    return jsonResponse({ user: created.record }, 200);
  }
  if (current === null) {
    return jsonResponse({ error: "ACCOUNT_NOT_FOUND" }, 404);
  }
  if (input.operation === "begin_reset" || input.operation === "complete_reset") {
    const existingEpoch = current.appMetadata.advertising_game_session_epoch;
    const existingGeneration =
      current.appMetadata.advertising_game_reset_generation;
    const existingOperation = current.appMetadata.advertising_game_reset_operation;
    const existingPending = current.appMetadata.advertising_game_reset_pending;
    const hasResetBoundary = [
      existingEpoch,
      existingGeneration,
      existingOperation,
      existingPending
    ].some((value) => value !== undefined);
    if (
      hasResetBoundary &&
      (
        typeof existingEpoch !== "string" ||
        !SESSION_EPOCH_PATTERN.test(existingEpoch) ||
        typeof existingGeneration !== "string" ||
        !SESSION_EPOCH_PATTERN.test(existingGeneration) ||
        typeof existingOperation !== "string" ||
        !UUID_PATTERN.test(existingOperation) ||
        typeof existingPending !== "boolean"
      )
    ) {
      throw new UpstreamError();
    }
    if (input.operation === "complete_reset") {
      if (!hasResetBoundary || existingOperation !== input.operationId) {
        throw new UpstreamError();
      }
      if (existingPending === false) return noContent();
      const response = await safeFetch(
        fetcher,
        `${environment.supabaseUrl}${ADMIN_USERS}/${current.record.userId}`,
        {
          method: "PUT",
          headers: serviceHeaders(environment.serviceKey),
          body: JSON.stringify({
            app_metadata: {
              ...current.appMetadata,
              advertising_game_reset_pending: false
            }
          })
        }
      );
      if (!response.ok) throw new UpstreamError();
      return noContent();
    }
    if (
      hasResetBoundary &&
      existingPending === true &&
      existingOperation !== input.operationId
    ) {
      throw new UpstreamError();
    }
    let epoch: string;
    let resetGeneration: string;
    if (!hasResetBoundary || existingOperation !== input.operationId) {
      epoch = randomUUID();
      resetGeneration = randomUUID();
      if (
        !SESSION_EPOCH_PATTERN.test(epoch) ||
        !SESSION_EPOCH_PATTERN.test(resetGeneration)
      ) {
        throw new UpstreamError();
      }
    } else {
      if (
        typeof existingEpoch !== "string" ||
        typeof existingGeneration !== "string"
      ) {
        throw new UpstreamError();
      }
      epoch = existingEpoch;
      resetGeneration = existingGeneration;
    }
    const response = await safeFetch(
      fetcher,
      `${environment.supabaseUrl}${ADMIN_USERS}/${current.record.userId}`,
      {
        method: "PUT",
        headers: serviceHeaders(environment.serviceKey),
        body: JSON.stringify({
          app_metadata: {
            ...current.appMetadata,
            advertising_game_username: input.username,
            advertising_game_session_epoch: epoch,
            advertising_game_reset_generation: resetGeneration,
            advertising_game_reset_operation: input.operationId,
            advertising_game_reset_pending: true
          }
        })
      }
    );
    if (!response.ok) throw new UpstreamError();
    return noContent();
  }
  const epoch = randomUUID();
  if (!SESSION_EPOCH_PATTERN.test(epoch)) throw new UpstreamError();
  const response = await safeFetch(
    fetcher,
    `${environment.supabaseUrl}${ADMIN_USERS}/${current.record.userId}`,
    {
      method: "PUT",
      headers: serviceHeaders(environment.serviceKey),
      body: JSON.stringify({
        password: input.password,
        app_metadata: {
          ...current.appMetadata,
          advertising_game_username: input.username,
          advertising_game_session_epoch: epoch
        }
      })
    }
  );
  if (!response.ok) throw new UpstreamError();
  return noContent();
};

interface ProgressInput {
  readonly userId: string;
  readonly operation: "list" | "load" | "save" | "reset";
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
    (input.operation !== "list" && input.operation !== "load" &&
      input.operation !== "save" && input.operation !== "reset")) {
    throw new InvalidRequestError();
  }

  const expectedKeys = input.operation === "list"
    ? ["userId", "operation", "schema", "version"]
    : input.operation === "load"
      ? ["userId", "operation", "documentId", "schema", "version"]
      : input.operation === "reset"
        ? ["userId", "operation", "schema", "version"]
        : ["userId", "operation", "documentId", "schema", "version", "expectedRevision", "document"];
  if (!hasExactKeys(input, expectedKeys)) throw new InvalidRequestError();
  if (input.operation !== "list" && input.operation !== "reset" &&
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

type ImageLabLedgerOperation =
  | "status"
  | "global_status"
  | "set_global"
  | "set"
  | "add"
  | "revoke"
  | "reserve"
  | "complete"
  | "refund"
  | "mark_uncertain"
  | "list";

interface ImageLabLedgerInput {
  readonly userId?: string;
  readonly ledgerOperation: ImageLabLedgerOperation;
  readonly stage?: "object" | "realise";
  readonly amount?: number;
  readonly operationId: string;
  readonly jobKey?: string;
  readonly requestHash: string;
}

interface ImageLabCounts {
  readonly granted: number;
  readonly consumed: number;
  readonly reserved: number;
  readonly remaining: number;
}

interface ImageLabSnapshot {
  readonly status: "available" | "disabled" | "reserved" | "completed" | "refunded" | "uncertain";
  readonly enabled: boolean;
  readonly object: ImageLabCounts;
  readonly realise: ImageLabCounts;
}

interface ImageLabPrivateAccount {
  readonly userId: string;
  readonly object: ImageLabCounts;
  readonly realise: ImageLabCounts;
}

type ImageLabTeacherLedgerOperation =
  | "initialize"
  | "set_global"
  | "set"
  | "add"
  | "revoke"
  | "batch_add";

interface ImageLabTeacherInput {
  readonly ledgerOperation: ImageLabTeacherLedgerOperation;
  readonly userIds: readonly string[];
  readonly enabled?: boolean;
  readonly object: number;
  readonly realise: number;
  readonly operationId: string;
  readonly requestHash: string;
}

const imageLabBaseKeys = ["ledgerOperation", "operationId", "requestHash"] as const;

const parseImageLab = (record: Record<string, unknown>): ImageLabLedgerInput => {
  if (!hasExactKeys(record, ["operation", "input"]) ||
    record.operation !== "image_lab" || !isRecord(record.input)) {
    throw new InvalidRequestError();
  }
  const input = record.input;
  const ledgerOperation = input.ledgerOperation;
  if (
    ledgerOperation !== "status" &&
    ledgerOperation !== "global_status" &&
    ledgerOperation !== "set_global" &&
    ledgerOperation !== "set" &&
    ledgerOperation !== "add" &&
    ledgerOperation !== "revoke" &&
    ledgerOperation !== "reserve" &&
    ledgerOperation !== "complete" &&
    ledgerOperation !== "refund" &&
    ledgerOperation !== "mark_uncertain" &&
    ledgerOperation !== "list"
  ) throw new InvalidRequestError();
  if (
    typeof input.operationId !== "string" ||
    !SAFE_OPERATION_ID_PATTERN.test(input.operationId) ||
    typeof input.requestHash !== "string" ||
    !SHA256_PATTERN.test(input.requestHash)
  ) throw new InvalidRequestError();

  const accountMutation = ledgerOperation === "set" ||
    ledgerOperation === "add" ||
    ledgerOperation === "revoke";
  const reservationMutation = ledgerOperation === "reserve" ||
    ledgerOperation === "complete" ||
    ledgerOperation === "refund" ||
    ledgerOperation === "mark_uncertain";
  const expectedKeys = ledgerOperation === "status"
    ? [...imageLabBaseKeys, "userId"]
    : ledgerOperation === "global_status" || ledgerOperation === "list"
      ? [...imageLabBaseKeys]
      : ledgerOperation === "set_global"
        ? input.stage === undefined
          ? [...imageLabBaseKeys, "amount"]
          : [...imageLabBaseKeys, "stage", "amount"]
        : accountMutation
          ? [...imageLabBaseKeys, "userId", "stage", "amount"]
          : [...imageLabBaseKeys, "userId", "stage", "amount", "jobKey"];
  if (!hasExactKeys(input, expectedKeys)) throw new InvalidRequestError();

  if (
    (ledgerOperation === "status" || accountMutation || reservationMutation) &&
    (typeof input.userId !== "string" || !UUID_PATTERN.test(input.userId))
  ) throw new InvalidRequestError();
  if (
    (accountMutation || reservationMutation ||
      (ledgerOperation === "set_global" && input.stage !== undefined)) &&
    input.stage !== "object" &&
    input.stage !== "realise"
  ) throw new InvalidRequestError();
  if (
    ledgerOperation === "set_global" &&
    input.stage === undefined &&
    input.amount !== 0 &&
    input.amount !== 1
  ) throw new InvalidRequestError();
  if (
    (ledgerOperation === "set_global" || accountMutation) &&
    (
      typeof input.amount !== "number" ||
      !Number.isInteger(input.amount) ||
      input.amount < (ledgerOperation === "add" || ledgerOperation === "revoke" ? 1 : 0) ||
      input.amount > 100
    )
  ) throw new InvalidRequestError();
  if (
    reservationMutation &&
    (
      input.amount !== 1 ||
      typeof input.jobKey !== "string" ||
      !SAFE_OPERATION_ID_PATTERN.test(input.jobKey)
    )
  ) throw new InvalidRequestError();
  return input as unknown as ImageLabLedgerInput;
};

const parseImageLabTeacher = (record: Record<string, unknown>): ImageLabTeacherInput => {
  if (!hasExactKeys(record, ["operation", "input"]) ||
    record.operation !== "image_lab_teacher" || !isRecord(record.input)) {
    throw new InvalidRequestError();
  }
  const input = record.input;
  const ledgerOperation = input.ledgerOperation;
  if (
    ledgerOperation !== "initialize" &&
    ledgerOperation !== "set_global" &&
    ledgerOperation !== "set" &&
    ledgerOperation !== "add" &&
    ledgerOperation !== "revoke" &&
    ledgerOperation !== "batch_add"
  ) throw new InvalidRequestError();
  const global = ledgerOperation === "set_global";
  if (!hasExactKeys(
    input,
    global
      ? [
          "ledgerOperation",
          "userIds",
          "enabled",
          "object",
          "realise",
          "operationId",
          "requestHash"
        ]
      : [
          "ledgerOperation",
          "userIds",
          "object",
          "realise",
          "operationId",
          "requestHash"
        ]
  )) throw new InvalidRequestError();
  if (
    !Array.isArray(input.userIds) ||
    input.userIds.some((userId) => typeof userId !== "string" || !UUID_PATTERN.test(userId)) ||
    new Set(input.userIds).size !== input.userIds.length ||
    typeof input.object !== "number" ||
    !Number.isInteger(input.object) ||
    input.object < 0 ||
    input.object > 100 ||
    typeof input.realise !== "number" ||
    !Number.isInteger(input.realise) ||
    input.realise < 0 ||
    input.realise > 100 ||
    typeof input.operationId !== "string" ||
    !SAFE_OPERATION_ID_PATTERN.test(input.operationId) ||
    typeof input.requestHash !== "string" ||
    !SHA256_PATTERN.test(input.requestHash)
  ) throw new InvalidRequestError();
  if (
    global
      ? input.userIds.length !== 0 || typeof input.enabled !== "boolean"
      : (
          input.enabled !== undefined ||
          input.userIds.length < 1 ||
          input.userIds.length > 100 ||
          (ledgerOperation !== "batch_add" && input.userIds.length !== 1)
        )
  ) throw new InvalidRequestError();
  if (
    (ledgerOperation === "add" ||
      ledgerOperation === "revoke" ||
      ledgerOperation === "batch_add") &&
    input.object === 0 &&
    input.realise === 0
  ) throw new InvalidRequestError();
  return input as unknown as ImageLabTeacherInput;
};

const parseImageLabCounts = (value: unknown): ImageLabCounts => {
  if (!isRecord(value) ||
    !hasExactKeys(value, ["granted", "consumed", "reserved", "remaining"])) {
    throw new UpstreamError();
  }
  const { granted, consumed, reserved, remaining } = value;
  if (
    ![granted, consumed, reserved, remaining].every((count) =>
      typeof count === "number" &&
      Number.isInteger(count) &&
      count >= 0 &&
      count <= 100
    ) ||
    (consumed as number) + (reserved as number) > (granted as number) ||
    remaining !== (granted as number) - (consumed as number) - (reserved as number)
  ) throw new UpstreamError();
  return {
    granted: granted as number,
    consumed: consumed as number,
    reserved: reserved as number,
    remaining: remaining as number
  };
};

const parseImageLabSnapshotFields = (
  value: Record<string, unknown>
): ImageLabSnapshot => {
  if (
    value.status !== "available" &&
    value.status !== "disabled" &&
    value.status !== "reserved" &&
    value.status !== "completed" &&
    value.status !== "refunded" &&
    value.status !== "uncertain"
  ) throw new UpstreamError();
  if (typeof value.enabled !== "boolean" ||
    (value.status === "disabled" && value.enabled)) throw new UpstreamError();
  return {
    status: value.status,
    enabled: value.enabled,
    object: parseImageLabCounts(value.object),
    realise: parseImageLabCounts(value.realise)
  };
};

const parseImageLabSnapshot = (value: unknown): ImageLabSnapshot => {
  if (!isRecord(value) ||
    !hasExactKeys(value, ["status", "enabled", "object", "realise"])) {
    throw new UpstreamError();
  }
  return parseImageLabSnapshotFields(value);
};

const parseImageLabList = (
  value: unknown
): { readonly snapshot: ImageLabSnapshot; readonly accounts: readonly ImageLabPrivateAccount[] } => {
  if (!isRecord(value) ||
    !hasExactKeys(value, ["status", "enabled", "object", "realise", "accounts"]) ||
    !Array.isArray(value.accounts) ||
    value.accounts.length > ADMIN_USERS_LIMIT) {
    throw new UpstreamError();
  }
  const accounts = value.accounts.map((candidate): ImageLabPrivateAccount => {
    if (!isRecord(candidate) ||
      !hasExactKeys(candidate, ["userId", "object", "realise"]) ||
      typeof candidate.userId !== "string" ||
      !UUID_PATTERN.test(candidate.userId)) throw new UpstreamError();
    return {
      userId: candidate.userId,
      object: parseImageLabCounts(candidate.object),
      realise: parseImageLabCounts(candidate.realise)
    };
  });
  if (new Set(accounts.map(({ userId }) => userId)).size !== accounts.length) {
    throw new UpstreamError();
  }
  return {
    snapshot: parseImageLabSnapshotFields(value),
    accounts
  };
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

const imageLab = async (
  input: ImageLabLedgerInput,
  environment: EdgeEnvironment,
  fetcher: typeof fetch
): Promise<Response> => {
  const response = await safeFetch(fetcher, `${environment.supabaseUrl}${IMAGE_LAB_RPC}`, {
    method: "POST",
    headers: serviceHeaders(environment.serviceKey),
    body: JSON.stringify({
      p_user_id: input.userId ?? null,
      p_operation: input.ledgerOperation,
      p_stage: input.stage ?? null,
      p_amount: input.amount ?? null,
      p_operation_id: input.operationId,
      p_job_key: input.jobKey ?? null,
      p_request_hash: input.requestHash
    })
  });
  const result = await upstreamJson(response);
  if (input.ledgerOperation !== "list") {
    return jsonResponse(parseImageLabSnapshot(result), 200);
  }

  const ledger = parseImageLabList(result);
  const pairUsers = (await listAdminUsers(environment, fetcher))
    .filter(({ record }) => record.username !== TEACHER_PLAYTEST_USERNAME);
  const pairById = new Map(pairUsers.map((user) => [user.record.userId, user] as const));
  if (ledger.accounts.some(({ userId }) => !pairById.has(userId))) {
    throw new UpstreamError();
  }
  const allowanceById = new Map(ledger.accounts.map((account) => [account.userId, account] as const));
  const zero: ImageLabCounts = {
    granted: 0,
    consumed: 0,
    reserved: 0,
    remaining: 0
  };
  return jsonResponse({
    ...ledger.snapshot,
    accounts: pairUsers
      .map(({ record }) => {
        const allowance = allowanceById.get(record.userId);
        return {
          alias: record.username,
          object: allowance?.object ?? zero,
          realise: allowance?.realise ?? zero
        };
      })
      .sort((left, right) => left.alias.localeCompare(right.alias))
  }, 200);
};

const imageLabTeacher = async (
  input: ImageLabTeacherInput,
  environment: EdgeEnvironment,
  fetcher: typeof fetch
): Promise<Response> => {
  const response = await safeFetch(fetcher, `${environment.supabaseUrl}${IMAGE_LAB_TEACHER_RPC}`, {
    method: "POST",
    headers: serviceHeaders(environment.serviceKey),
    body: JSON.stringify({
      p_operation: input.ledgerOperation,
      p_user_ids: input.userIds,
      p_enabled: input.enabled ?? null,
      p_object_amount: input.object,
      p_realise_amount: input.realise,
      p_operation_id: input.operationId,
      p_request_hash: input.requestHash
    })
  });
  const result = parseImageLabList(await upstreamJson(response));
  if (
    result.accounts.length !== input.userIds.length ||
    result.accounts.some(({ userId }, index) => userId !== input.userIds[index])
  ) throw new UpstreamError();
  return jsonResponse({
    ...result.snapshot,
    accounts: result.accounts
  }, 200);
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
      if (body.operation === "image_lab") {
        return await imageLab(parseImageLab(body), environment, fetcher);
      }
      if (body.operation === "image_lab_teacher") {
        return await imageLabTeacher(parseImageLabTeacher(body), environment, fetcher);
      }
      if (
        body.operation === "list_users" ||
        body.operation === "find_user" ||
        body.operation === "replace_password" ||
        body.operation === "ensure_user" ||
        body.operation === "begin_reset" ||
        body.operation === "complete_reset"
      ) {
        return await accountAdmin(
          parseAccountAdminOperation(body),
          environment,
          fetcher,
          dependencies.randomUUID ?? (() => crypto.randomUUID())
        );
      }
      throw new InvalidRequestError();
    } catch (error) {
      if (error instanceof InvalidRequestError) return jsonResponse({ error: "INVALID_REQUEST" }, 400);
      return jsonResponse({ error: "BACKEND_UNAVAILABLE" }, 503);
    }
  };
}
