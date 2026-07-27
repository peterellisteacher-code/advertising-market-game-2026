import {
  CampaignDocumentSchema,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import { assertBoundedCampaignJson } from "../domain/bounded-campaign-json";
import {
  hasCloudProgressPracticeDocumentIdentities,
  isCloudProgressDocumentId
} from "../domain/practice-identity";
import {
  ACCOUNT_IDENTITY_HEADER,
  type AccountIdentityBinding,
  type AccountMutationPublisher
} from "./account-identity-binding";
import {
  AccountCookieSerialisationUnavailableError,
  defaultAccountCookieRequestSerialiser,
  type AccountCookieRequestSerialiser
} from "./account-cookie-request-serialiser";

const ACCOUNT_USERNAME = /^[a-z0-9][a-z0-9_-]{2,23}$/u;
const RESET_OPERATION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PROGRESS_SCHEMA = "advertising-game-progress";
const PROGRESS_VERSION = 1;
const ACCOUNT_RESET_SCHEMA = "advertising-game-account-reset";
const ACCOUNT_RESET_VERSION = 1;
const PROGRESS_JSON_LIMIT = 256 * 1_024;
const ACCOUNT_JSON_LIMIT = 8 * 1_024;
const ERROR_JSON_LIMIT = 8 * 1_024;
const LIST_JSON_LIMIT = 16 * 1_024;
const PROGRESS_RESPONSE_JSON_LIMIT = PROGRESS_JSON_LIMIT + 16 * 1_024;
const ACCOUNT_DIAGNOSTIC_BODY_LIMIT = 200;
const DEFAULT_ACCOUNT_REQUEST_TIMEOUT_MS = 12_000;
const MAX_ACCOUNT_RATE_LIMIT_RETRIES = 1;
const MAX_AUTOMATIC_RETRY_AFTER_MS = 5_000;
const RATE_LIMIT_JITTER_MS = 250;

type Sleep = (milliseconds: number) => Promise<void>;

export interface AccountRequestPolicyOptions {
  readonly requestTimeoutMs?: number;
  readonly sleep?: Sleep;
  readonly random?: () => number;
}

export type AccountSession =
  | { readonly authenticated: false }
  | { readonly authenticated: true; readonly username: string };

export interface AccountSignupInput {
  readonly username: string;
  readonly password: string;
  readonly classroomCode: string;
}

export interface AccountLoginInput {
  readonly username: string;
  readonly password: string;
}

export interface AccountResetInput {
  readonly operationId: string;
  readonly confirmation: "RESET";
}

export type AccountClientErrorCode =
  | "ACCOUNT_NOT_CONFIGURED"
  | "ACCOUNT_RATE_LIMITED"
  | "ACCOUNT_UNAVAILABLE"
  | "AUTHENTICATION_REQUIRED"
  | "DOCUMENT_LIMIT_REACHED"
  | "INVALID_CREDENTIALS"
  | "INVALID_REQUEST"
  | "INVALID_RESPONSE"
  | "PROGRESS_NOT_CONFIGURED"
  | "PROGRESS_TOO_LARGE"
  | "PROGRESS_UNAVAILABLE"
  | "RESET_INCOMPLETE"
  | "SIGNUP_DENIED"
  | "USERNAME_UNAVAILABLE";

export class AccountClientError extends Error {
  constructor(
    readonly code: AccountClientErrorCode,
    readonly retryAfterSeconds?: number
  ) {
    super(code);
    this.name = "AccountClientError";
  }
}

export interface AccountSessionClient {
  session(): Promise<AccountSession>;
  signup(input: AccountSignupInput): Promise<Extract<AccountSession, { authenticated: true }>>;
  login(input: AccountLoginInput): Promise<Extract<AccountSession, { authenticated: true }>>;
  logout(): Promise<void>;
}

export interface AccountResetClient {
  reset(input: AccountResetInput): Promise<"reset">;
}

export type CloudProgressSaveResult =
  | { readonly status: "saved"; readonly revision: number; readonly updatedAt: string }
  | { readonly status: "conflict"; readonly currentRevision: number };

export type CloudProgressLoadResult =
  | { readonly status: "not-found" }
  | {
    readonly status: "found";
    readonly revision: number;
    readonly document: CampaignDocumentV1;
    readonly updatedAt: string;
  };

export interface CloudProgressDocumentMetadata {
  readonly documentId: string;
  readonly revision: number;
  readonly updatedAt: string;
}

export interface CloudProgressClient {
  save(document: CampaignDocumentV1, expectedRevision: number): Promise<CloudProgressSaveResult>;
  load(documentId: string): Promise<CloudProgressLoadResult>;
  list(): Promise<readonly CloudProgressDocumentMetadata[]>;
}

export interface CloudProgressHttpScope {
  readonly path?: string;
  readonly includeAccountIdentityHeader?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function parsedSession(value: unknown): AccountSession | null {
  if (!isRecord(value) || typeof value.authenticated !== "boolean") return null;
  if (!value.authenticated) {
    return exactKeys(value, ["authenticated"]) ? { authenticated: false } : null;
  }
  return exactKeys(value, ["authenticated", "username"]) &&
    typeof value.username === "string" && ACCOUNT_USERNAME.test(value.username)
    ? { authenticated: true, username: value.username }
    : null;
}

function validRevision(value: unknown, allowZero = false): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) &&
    value >= (allowZero ? 0 : 1);
}

function validUpdatedAt(value: unknown): value is string {
  return typeof value === "string" && value.length >= 20 && value.length <= 64 &&
    !Number.isNaN(Date.parse(value));
}

const publicErrorCodes = new Set<AccountClientErrorCode>([
  "ACCOUNT_NOT_CONFIGURED",
  "ACCOUNT_UNAVAILABLE",
  "AUTHENTICATION_REQUIRED",
  "DOCUMENT_LIMIT_REACHED",
  "INVALID_CREDENTIALS",
  "INVALID_REQUEST",
  "PROGRESS_NOT_CONFIGURED",
  "PROGRESS_UNAVAILABLE",
  "SIGNUP_DENIED",
  "USERNAME_UNAVAILABLE"
]);

async function responseBytes(response: Response, limit: number): Promise<Uint8Array> {
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
}

async function responseTextPrefix(response: Response, limit: number): Promise<string> {
  const body = response.clone().body;
  if (body === null) return "";
  const reader = body.getReader();
  const bytes = new Uint8Array(limit);
  let length = 0;
  try {
    while (length < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      const take = Math.min(value.byteLength, limit - length);
      bytes.set(value.subarray(0, take), length);
      length += take;
      if (take < value.byteLength || length === limit) {
        void reader.cancel().catch(() => undefined);
        break;
      }
    }
  } catch {
    return "<response body unavailable>";
  }
  return new TextDecoder().decode(bytes.subarray(0, length));
}

async function logAccountResponseFailure(path: string, response: Response): Promise<void> {
  let body = "<response body unavailable>";
  try {
    body = await responseTextPrefix(response, ACCOUNT_DIAGNOSTIC_BODY_LIMIT);
  } catch {
    // Keep the diagnostic bounded even when cloning is unavailable.
  }
  console.warn(`[AdMarket account request failed] ${JSON.stringify({
    path,
    status: typeof response.status === "number" ? response.status : 0,
    contentType: response.headers?.get?.("content-type") ?? "",
    body
  })}`);
}

function logAccountFetchFailure(path: string, error: unknown): void {
  console.warn(`[AdMarket account request failed] ${JSON.stringify({
    path,
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error)
  })}`);
}

async function jsonBody(response: Response, limit: number): Promise<unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(await responseBytes(response, limit))) as unknown;
  } catch {
    throw new AccountClientError("INVALID_RESPONSE");
  }
}

function retryAfterSeconds(response: Response): number {
  const value = response.headers.get("retry-after")?.trim() ?? "";
  if (/^\d+$/u.test(value)) return Math.max(1, Math.min(180, Number(value)));
  const timestamp = Date.parse(value);
  if (!Number.isNaN(timestamp)) {
    return Math.max(1, Math.min(180, Math.ceil((timestamp - Date.now()) / 1_000)));
  }
  return 1;
}

const defaultSleep: Sleep = (milliseconds) => new Promise((resolve) => {
  globalThis.setTimeout(resolve, milliseconds);
});

async function responseError(response: Response): Promise<AccountClientError> {
  if (response.status === 429) {
    return new AccountClientError("ACCOUNT_RATE_LIMITED", retryAfterSeconds(response));
  }
  const value = await jsonBody(response, ERROR_JSON_LIMIT);
  if (isRecord(value) && exactKeys(value, ["error", "operationId", "retryable"]) &&
    value.error === "RESET_INCOMPLETE" &&
    typeof value.operationId === "string" && RESET_OPERATION_ID.test(value.operationId) &&
    value.retryable === true) {
    return new AccountClientError("RESET_INCOMPLETE");
  }
  if (isRecord(value) && exactKeys(value, ["error"]) &&
    value.error === "ACCOUNT_IDENTITY_CHANGED") {
    return new AccountClientError("AUTHENTICATION_REQUIRED");
  }
  if (isRecord(value) && exactKeys(value, ["error"]) &&
    typeof value.error === "string" &&
    publicErrorCodes.has(value.error as AccountClientErrorCode)) {
    return new AccountClientError(value.error as AccountClientErrorCode);
  }
  return new AccountClientError(response.status >= 500 ? "ACCOUNT_UNAVAILABLE" : "INVALID_RESPONSE");
}

export class HttpAccountClient implements AccountSessionClient, AccountResetClient {
  readonly #requestTimeoutMs: number;
  readonly #sleep: Sleep;
  readonly #random: () => number;

  constructor(
    private readonly identity: AccountIdentityBinding,
    private readonly mutations: AccountMutationPublisher,
    private readonly fetcher: typeof fetch = globalThis.fetch,
    private readonly cookieRequests: AccountCookieRequestSerialiser =
      defaultAccountCookieRequestSerialiser(fetcher),
    requestPolicy: AccountRequestPolicyOptions = {}
  ) {
    this.#requestTimeoutMs = requestPolicy.requestTimeoutMs ?? DEFAULT_ACCOUNT_REQUEST_TIMEOUT_MS;
    if (!Number.isFinite(this.#requestTimeoutMs) || this.#requestTimeoutMs <= 0) {
      throw new TypeError("Account request timeout must be a positive finite number");
    }
    this.#sleep = requestPolicy.sleep ?? defaultSleep;
    this.#random = requestPolicy.random ?? Math.random;
  }

  async session(): Promise<AccountSession> {
    return this.#serialise(async () => {
      const response = await this.#request("/api/account/session", "GET");
      const session = parsedSession(await jsonBody(response, ACCOUNT_JSON_LIMIT));
      if (!session) throw new AccountClientError("INVALID_RESPONSE");
      if (session.authenticated) this.identity.activate(session.username);
      else this.identity.deactivate();
      return session;
    });
  }

  signup(input: AccountSignupInput): Promise<Extract<AccountSession, { authenticated: true }>> {
    return this.#authenticate("/api/account/signup", input);
  }

  login(input: AccountLoginInput): Promise<Extract<AccountSession, { authenticated: true }>> {
    return this.#authenticate("/api/account/login", input);
  }

  async logout(): Promise<void> {
    return this.#serialise(async () => {
      const expectedAccount = this.identity.current();
      if (expectedAccount === null) throw new AccountClientError("AUTHENTICATION_REQUIRED");
      const response = await this.#request(
        "/api/account/logout",
        "POST",
        undefined,
        expectedAccount
      );
      if (response.status !== 204) throw new AccountClientError("INVALID_RESPONSE");
      this.identity.deactivate();
      this.mutations.publish();
    });
  }

  async reset(input: AccountResetInput): Promise<"reset"> {
    if (!RESET_OPERATION_ID.test(input.operationId) || input.confirmation !== "RESET") {
      throw new AccountClientError("INVALID_REQUEST");
    }
    return this.#serialise(async () => {
      const expectedAccount = this.identity.current();
      if (expectedAccount === null) throw new AccountClientError("AUTHENTICATION_REQUIRED");
      const response = await this.#request(
        "/api/account/reset",
        "POST",
        {
          schema: ACCOUNT_RESET_SCHEMA,
          version: ACCOUNT_RESET_VERSION,
          operationId: input.operationId,
          confirmation: input.confirmation
        },
        expectedAccount
      );
      const value = await jsonBody(response, ACCOUNT_JSON_LIMIT);
      if (!isRecord(value) || !exactKeys(value, ["operationId", "status"]) ||
        value.status !== "reset" || value.operationId !== input.operationId) {
        throw new AccountClientError("INVALID_RESPONSE");
      }
      return "reset" as const;
    });
  }

  async #authenticate(
    path: "/api/account/signup" | "/api/account/login",
    input: AccountSignupInput | AccountLoginInput
  ): Promise<Extract<AccountSession, { authenticated: true }>> {
    return this.#serialise(async () => {
      const response = await this.#request(path, "POST", input);
      const session = parsedSession(await jsonBody(response, ACCOUNT_JSON_LIMIT));
      if (!session?.authenticated) throw new AccountClientError("INVALID_RESPONSE");
      this.identity.activate(session.username);
      this.mutations.publish();
      return session;
    });
  }

  async #serialise<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await this.cookieRequests.run(operation);
    } catch (error) {
      if (error instanceof AccountCookieSerialisationUnavailableError) {
        throw new AccountClientError("ACCOUNT_UNAVAILABLE");
      }
      throw error;
    }
  }

  async #request(
    path: string,
    method: "GET" | "POST",
    body?: object,
    expectedAccount?: string
  ): Promise<Response> {
    const headers: Record<string, string> = body === undefined
      ? { accept: "application/json" }
      : { accept: "application/json", "content-type": "application/json" };
    if (expectedAccount !== undefined) headers[ACCOUNT_IDENTITY_HEADER] = expectedAccount;
    const init: RequestInit = {
      method,
      credentials: "same-origin",
      redirect: "error",
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    };
    let response: Response;
    try {
      response = await this.#fetchWithPolicy(path, init);
    } catch (error) {
      logAccountFetchFailure(path, error);
      throw new AccountClientError("ACCOUNT_UNAVAILABLE");
    }
    if (response.redirected) {
      await logAccountResponseFailure(path, response);
      throw new AccountClientError("ACCOUNT_UNAVAILABLE");
    }
    if (!response.ok) {
      await logAccountResponseFailure(path, response);
      throw await responseError(response);
    }
    return response;
  }

  async #fetchWithPolicy(path: string, init: RequestInit): Promise<Response> {
    for (let attempt = 0; ; attempt += 1) {
      const response = await this.#fetchWithTimeout(path, init);
      if (response.status !== 429 || attempt >= MAX_ACCOUNT_RATE_LIMIT_RETRIES) return response;
      const serverDelay = retryAfterSeconds(response) * 1_000;
      if (serverDelay > MAX_AUTOMATIC_RETRY_AFTER_MS) return response;
      const random = Math.max(0, Math.min(1, this.#random()));
      await this.#sleep(serverDelay + Math.floor(random * RATE_LIMIT_JITTER_MS));
    }
  }

  async #fetchWithTimeout(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = globalThis.setTimeout(() => {
        const error = new DOMException("Account request timed out", "TimeoutError");
        controller.abort(error);
        reject(error);
      }, this.#requestTimeoutMs);
    });
    try {
      return await Promise.race([
        this.fetcher.call(globalThis, path, { ...init, signal: controller.signal }),
        timeout
      ]);
    } finally {
      if (timer !== undefined) globalThis.clearTimeout(timer);
    }
  }
}

export class HttpCloudProgressClient implements CloudProgressClient {
  constructor(
    private readonly identity: AccountIdentityBinding | null,
    private readonly fetcher: typeof fetch = globalThis.fetch,
    private readonly cookieRequests: AccountCookieRequestSerialiser =
      defaultAccountCookieRequestSerialiser(fetcher),
    private readonly scope: CloudProgressHttpScope = {}
  ) {}

  async save(
    document: CampaignDocumentV1,
    expectedRevision: number
  ): Promise<CloudProgressSaveResult> {
    return this.#serialise(async () => {
    if (!validRevision(expectedRevision, true)) throw new AccountClientError("INVALID_REQUEST");
    try {
      assertBoundedCampaignJson(document);
    } catch {
      throw new AccountClientError("INVALID_REQUEST");
    }
    const parsedSnapshot = CampaignDocumentSchema.safeParse(structuredClone(document));
    if (!parsedSnapshot.success) throw new AccountClientError("INVALID_REQUEST");
    const snapshot = parsedSnapshot.data;
    try {
      assertBoundedCampaignJson(snapshot);
    } catch {
      throw new AccountClientError("INVALID_REQUEST");
    }
    if (snapshot.mode !== "offline" || snapshot.roomId !== undefined ||
      !hasCloudProgressPracticeDocumentIdentities(snapshot)) {
      throw new AccountClientError("INVALID_REQUEST");
    }
    const body = JSON.stringify({
      schema: PROGRESS_SCHEMA,
      version: PROGRESS_VERSION,
      documentId: snapshot.documentId,
      expectedRevision,
      document: snapshot
    });
    if (new TextEncoder().encode(body).byteLength > PROGRESS_JSON_LIMIT) {
      throw new AccountClientError("PROGRESS_TOO_LARGE");
    }
    const response = await this.#fetch(this.#progressPath(), {
      method: "PUT",
      credentials: "same-origin",
      headers: { accept: "application/json", "content-type": "application/json" },
      body
    });
    const value = await jsonBody(response, PROGRESS_RESPONSE_JSON_LIMIT);
    if (response.status === 409 && isRecord(value) &&
      exactKeys(value, ["error", "currentRevision"]) &&
      value.error === "REVISION_CONFLICT" && validRevision(value.currentRevision, true)) {
      return { status: "conflict", currentRevision: value.currentRevision };
    }
    if (!response.ok) throw await this.#progressError(response, value);
    if (!isRecord(value) || !exactKeys(value, [
      "schema", "version", "documentId", "revision", "updatedAt"
    ]) || value.schema !== PROGRESS_SCHEMA || value.version !== PROGRESS_VERSION ||
      value.documentId !== snapshot.documentId || !validRevision(value.revision) ||
      !validUpdatedAt(value.updatedAt)) {
      throw new AccountClientError("INVALID_RESPONSE");
    }
      return { status: "saved", revision: value.revision, updatedAt: value.updatedAt };
    });
  }

  async load(documentId: string): Promise<CloudProgressLoadResult> {
    return this.#serialise(async () => {
    if (!isCloudProgressDocumentId(documentId)) throw new AccountClientError("INVALID_REQUEST");
    const response = await this.#fetch(
      `${this.#progressPath()}?documentId=${encodeURIComponent(documentId)}`,
      {
        method: "GET",
        credentials: "same-origin",
        headers: { accept: "application/json" }
      }
    );
    const value = await jsonBody(response, PROGRESS_RESPONSE_JSON_LIMIT);
    if (response.status === 404 && isRecord(value) && exactKeys(value, ["error"]) &&
      value.error === "PROGRESS_NOT_FOUND") {
      return { status: "not-found" };
    }
    if (!response.ok) throw await this.#progressError(response, value);
    if (!isRecord(value) || !exactKeys(value, [
      "schema", "version", "documentId", "revision", "document", "updatedAt"
    ]) || value.schema !== PROGRESS_SCHEMA || value.version !== PROGRESS_VERSION ||
      value.documentId !== documentId || !validRevision(value.revision) ||
      !validUpdatedAt(value.updatedAt)) {
      throw new AccountClientError("INVALID_RESPONSE");
    }
    try {
      assertBoundedCampaignJson(value.document);
    } catch {
      throw new AccountClientError("INVALID_RESPONSE");
    }
    const document = CampaignDocumentSchema.safeParse(value.document);
    if (!document.success || document.data.mode !== "offline" ||
      document.data.roomId !== undefined ||
      !hasCloudProgressPracticeDocumentIdentities(document.data) ||
      document.data.documentId !== documentId) {
      throw new AccountClientError("INVALID_RESPONSE");
    }
    try {
      assertBoundedCampaignJson(document.data);
    } catch {
      throw new AccountClientError("INVALID_RESPONSE");
    }
      return {
        status: "found",
        revision: value.revision,
        document: document.data,
        updatedAt: value.updatedAt
      };
    });
  }

  async list(): Promise<readonly CloudProgressDocumentMetadata[]> {
    return this.#serialise(async () => {
    const response = await this.#fetch(this.#progressPath(), {
      method: "GET",
      credentials: "same-origin",
      redirect: "error",
      headers: { accept: "application/json" }
    });
    if (response.redirected) throw new AccountClientError("PROGRESS_UNAVAILABLE");
    const value = await jsonBody(response, LIST_JSON_LIMIT);
    if (!response.ok) throw await this.#progressError(response, value);
    if (!isRecord(value) || !exactKeys(value, ["schema", "version", "documents"]) ||
      value.schema !== PROGRESS_SCHEMA || value.version !== PROGRESS_VERSION ||
      !Array.isArray(value.documents) || value.documents.length > 16) {
      throw new AccountClientError("INVALID_RESPONSE");
    }
    const documents: CloudProgressDocumentMetadata[] = [];
    const ids = new Set<string>();
    let previous: CloudProgressDocumentMetadata | undefined;
    for (const entry of value.documents) {
      if (!isRecord(entry) || !exactKeys(entry, ["documentId", "revision", "updatedAt"]) ||
        !isCloudProgressDocumentId(entry.documentId) ||
        !validRevision(entry.revision) || !validUpdatedAt(entry.updatedAt) || ids.has(entry.documentId)) {
        throw new AccountClientError("INVALID_RESPONSE");
      }
      const document = {
        documentId: entry.documentId,
        revision: entry.revision,
        updatedAt: entry.updatedAt
      };
      if (previous !== undefined && !orderedBefore(previous, document)) {
        throw new AccountClientError("INVALID_RESPONSE");
      }
      ids.add(document.documentId);
      documents.push(document);
      previous = document;
    }
      return documents;
    });
  }

  async #serialise<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await this.cookieRequests.run(operation);
    } catch (error) {
      if (error instanceof AccountCookieSerialisationUnavailableError) {
        throw new AccountClientError("PROGRESS_UNAVAILABLE");
      }
      throw error;
    }
  }

  async #fetch(path: string, init: RequestInit): Promise<Response> {
    const headers = { ...(init.headers as Record<string, string> | undefined) };
    if (this.scope.includeAccountIdentityHeader !== false) {
      const expectedAccount = this.identity?.current() ?? null;
      if (expectedAccount === null) throw new AccountClientError("AUTHENTICATION_REQUIRED");
      headers[ACCOUNT_IDENTITY_HEADER] = expectedAccount;
    }
    let response: Response;
    try {
      response = await this.fetcher.call(globalThis, path, { ...init, redirect: "error", headers });
    } catch {
      throw new AccountClientError("PROGRESS_UNAVAILABLE");
    }
    if (response.redirected) throw new AccountClientError("PROGRESS_UNAVAILABLE");
    // Fetch exposes the response only after response headers (including
    // Set-Cookie) have been processed. Ignore an untrusted 401 body rather than
    // parsing it; the cookie-order lock has already covered the cookie change.
    if (response.status === 401) throw new AccountClientError("AUTHENTICATION_REQUIRED");
    return response;
  }

  #progressPath(): string {
    return this.scope.path ?? "/api/account/progress";
  }

  async #progressError(response: Response, value: unknown): Promise<AccountClientError> {
    if (isRecord(value) && exactKeys(value, ["error"]) &&
      value.error === "ACCOUNT_IDENTITY_CHANGED") {
      return new AccountClientError("AUTHENTICATION_REQUIRED");
    }
    if (isRecord(value) && exactKeys(value, ["error"]) &&
      typeof value.error === "string" && publicErrorCodes.has(value.error as AccountClientErrorCode)) {
      return new AccountClientError(value.error as AccountClientErrorCode);
    }
    return new AccountClientError(response.status >= 500 ? "PROGRESS_UNAVAILABLE" : "INVALID_RESPONSE");
  }
}

function orderedBefore(
  earlier: CloudProgressDocumentMetadata,
  later: CloudProgressDocumentMetadata
): boolean {
  const earlierTime = Date.parse(earlier.updatedAt);
  const laterTime = Date.parse(later.updatedAt);
  return earlierTime > laterTime || (earlierTime === laterTime && earlier.documentId < later.documentId);
}
