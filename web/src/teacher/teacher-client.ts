export interface TeacherPairSummary {
  readonly username: string;
  readonly createdAt: string;
  readonly lastSignInAt: string | null;
}

export interface TeacherClient {
  session(): Promise<{ authenticated: boolean }>;
  login(password: string): Promise<void>;
  logout(): Promise<void>;
  listAccounts(): Promise<readonly TeacherPairSummary[]>;
  createAccount(input: {
    operationId: string;
    username: string;
    password: string;
  }): Promise<TeacherPairSummary>;
  replacePassword(input: {
    operationId: string;
    username: string;
    password: string;
  }): Promise<void>;
  resetAccount(input: {
    operationId: string;
    username: string;
    confirmation: string;
  }): Promise<void>;
}

export class TeacherClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly retryable = false
  ) {
    super(code);
    this.name = "TeacherClientError";
  }
}

interface HttpTeacherClientOptions {
  readonly fetcher?: typeof fetch;
  readonly delay?: (milliseconds: number) => Promise<void>;
  readonly timeoutMilliseconds?: number;
}

const RESPONSE_LIMIT = 64 * 1_024;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,23}$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (record: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
};

const validIsoTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) &&
  Number.isFinite(Date.parse(value));

const parseSummary = (value: unknown): TeacherPairSummary => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["username", "createdAt", "lastSignInAt"]) ||
    typeof value.username !== "string" ||
    !USERNAME_PATTERN.test(value.username) ||
    !validIsoTimestamp(value.createdAt) ||
    (value.lastSignInAt !== null && !validIsoTimestamp(value.lastSignInAt))
  ) {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  return {
    username: value.username,
    createdAt: value.createdAt,
    lastSignInAt: value.lastSignInAt
  };
};

const readBoundedJson = async (response: Response): Promise<unknown> => {
  if (response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
    "application/json") {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > RESPONSE_LIMIT)) {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  if (response.body === null) throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > RESPONSE_LIMIT) {
      await reader.cancel();
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
};

const responseError = async (response: Response): Promise<TeacherClientError> => {
  let code = "TEACHER_UNAVAILABLE";
  let retryable = response.status >= 500 || response.status === 429;
  try {
    const value = await readBoundedJson(response);
    if (isRecord(value) && typeof value.error === "string" &&
      /^[A-Z][A-Z0-9_]{1,63}$/u.test(value.error)) {
      code = value.error;
    }
    if (isRecord(value) && typeof value.retryable === "boolean") {
      retryable = value.retryable;
    }
  } catch {
    // A bounded generic error is safer than reflecting an invalid upstream body.
  }
  return new TeacherClientError(code, response.status, retryable);
};

export class HttpTeacherClient implements TeacherClient {
  readonly #fetcher: typeof fetch;
  readonly #delay: (milliseconds: number) => Promise<void>;
  readonly #timeoutMilliseconds: number;

  constructor(options: HttpTeacherClientOptions = {}) {
    this.#fetcher = options.fetcher ?? fetch;
    this.#delay = options.delay ?? ((milliseconds) =>
      new Promise((resolve) => window.setTimeout(resolve, milliseconds)));
    this.#timeoutMilliseconds = options.timeoutMilliseconds ?? 8_000;
    if (
      !Number.isInteger(this.#timeoutMilliseconds) ||
      this.#timeoutMilliseconds < 1_000 ||
      this.#timeoutMilliseconds > 30_000
    ) {
      throw new Error("Teacher request timeout is invalid");
    }
  }

  async session(): Promise<{ authenticated: boolean }> {
    const value = await this.#requestJson("/api/teacher/session", "GET");
    if (
      !isRecord(value) ||
      !hasExactKeys(value, ["authenticated"]) ||
      typeof value.authenticated !== "boolean"
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    return { authenticated: value.authenticated };
  }

  async login(password: string): Promise<void> {
    const value = await this.#requestJson("/api/teacher/login", "POST", { password });
    if (
      !isRecord(value) ||
      !hasExactKeys(value, ["authenticated"]) ||
      value.authenticated !== true
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
  }

  async logout(): Promise<void> {
    await this.#requestNoContent("/api/teacher/logout", "POST");
  }

  async listAccounts(): Promise<readonly TeacherPairSummary[]> {
    const value = await this.#requestJson("/api/teacher/accounts", "GET");
    if (
      !isRecord(value) ||
      !hasExactKeys(value, ["accounts"]) ||
      !Array.isArray(value.accounts) ||
      value.accounts.length > 1_000
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    const accounts = value.accounts.map(parseSummary);
    if (
      new Set(accounts.map(({ username }) => username)).size !== accounts.length
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    return accounts.sort((left, right) => left.username.localeCompare(right.username));
  }

  async createAccount(input: {
    operationId: string;
    username: string;
    password: string;
  }): Promise<TeacherPairSummary> {
    const value = await this.#requestJson("/api/teacher/accounts", "POST", {
      schema: "ad-market-teacher-account-create",
      version: 1,
      operationId: input.operationId,
      username: input.username,
      password: input.password
    });
    if (
      !isRecord(value) ||
      !hasExactKeys(value, ["status", "operationId", "account"]) ||
      value.status !== "created" ||
      value.operationId !== input.operationId
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    return parseSummary(value.account);
  }

  async replacePassword(input: {
    operationId: string;
    username: string;
    password: string;
  }): Promise<void> {
    const value = await this.#requestJson(
      `/api/teacher/accounts/${encodeURIComponent(input.username)}/password`,
      "PUT",
      {
        schema: "ad-market-teacher-password-replace",
        version: 1,
        operationId: input.operationId,
        password: input.password
      }
    );
    this.#assertMutationResult(value, "password-replaced", input);
  }

  async resetAccount(input: {
    operationId: string;
    username: string;
    confirmation: string;
  }): Promise<void> {
    const value = await this.#requestJson(
      `/api/teacher/accounts/${encodeURIComponent(input.username)}/reset`,
      "POST",
      {
        schema: "ad-market-teacher-account-reset",
        version: 1,
        operationId: input.operationId,
        confirmation: input.confirmation
      }
    );
    this.#assertMutationResult(value, "reset", input);
  }

  #assertMutationResult(
    value: unknown,
    status: "password-replaced" | "reset",
    input: { operationId: string; username: string }
  ): void {
    if (
      !isRecord(value) ||
      !hasExactKeys(value, ["status", "operationId", "username"]) ||
      value.status !== status ||
      value.operationId !== input.operationId ||
      value.username !== input.username
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
  }

  async #requestJson(
    path: string,
    method: "GET" | "POST" | "PUT",
    body?: Readonly<Record<string, unknown>>
  ): Promise<unknown> {
    const response = await this.#request(path, method, body, method === "GET");
    if (!response.ok) throw await responseError(response);
    return readBoundedJson(response);
  }

  async #requestNoContent(path: string, method: "POST"): Promise<void> {
    const response = await this.#request(path, method, undefined, false);
    if (!response.ok) throw await responseError(response);
    if (response.status !== 204 || response.body !== null) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
  }

  async #request(
    path: string,
    method: "GET" | "POST" | "PUT",
    body: Readonly<Record<string, unknown>> | undefined,
    safeRetry: boolean
  ): Promise<Response> {
    for (let attempt = 0; attempt < (safeRetry ? 2 : 1); attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), this.#timeoutMilliseconds);
      let response: Response;
      try {
        response = await this.#fetcher(path, {
          method,
          credentials: "same-origin",
          redirect: "error",
          headers: body === undefined
            ? { accept: "application/json" }
            : {
                accept: "application/json",
                "content-type": "application/json"
              },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal
        });
      } catch {
        throw new TeacherClientError("TEACHER_UNAVAILABLE", 503, true);
      } finally {
        window.clearTimeout(timeout);
      }
      if (response.redirected) {
        throw new TeacherClientError("TEACHER_UNAVAILABLE", 503, true);
      }
      if (response.status === 429 && safeRetry && attempt === 0) {
        const retryAfter = response.headers.get("retry-after");
        if (retryAfter !== null && /^(?:[1-5])$/u.test(retryAfter)) {
          await this.#delay(Number(retryAfter) * 1_000);
          continue;
        }
      }
      return response;
    }
    throw new TeacherClientError("TEACHER_UNAVAILABLE", 503, true);
  }
}

export function createTeacherOperationId(): string {
  const value = crypto.randomUUID();
  if (!UUID_PATTERN.test(value)) throw new Error("Operation ID is unavailable");
  return value;
}
