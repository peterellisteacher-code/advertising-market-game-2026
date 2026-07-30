export interface TeacherPairSummary {
  readonly username: string;
  readonly createdAt: string;
  readonly lastSignInAt: string | null;
}

export interface TeacherImageLabCounts {
  readonly granted: number;
  readonly consumed: number;
  readonly reserved: number;
  readonly remaining: number;
}

export interface TeacherImageLabAccount {
  readonly alias: string;
  readonly object: TeacherImageLabCounts;
  readonly realise: TeacherImageLabCounts;
}

export interface TeacherImageLabOverview {
  readonly enabled: boolean;
  readonly defaults: {
    readonly object: number;
    readonly realise: number;
  };
  readonly accounts: readonly TeacherImageLabAccount[];
}

export interface TeacherImageLabGlobalResult {
  readonly status: "updated";
  readonly operationId: string;
  readonly operation: "global";
  readonly enabled: boolean;
  readonly defaults: {
    readonly object: number;
    readonly realise: number;
  };
}

export interface TeacherImageLabAccountResult {
  readonly status: "updated";
  readonly operationId: string;
  readonly operation: "set" | "add" | "revoke";
  readonly alias: string;
  readonly account: TeacherImageLabAccount;
}

export interface TeacherImageLabBatchResult {
  readonly status: "updated";
  readonly operationId: string;
  readonly operation: "batch-add";
  readonly aliases: readonly string[];
  readonly accounts: readonly TeacherImageLabAccount[];
}

interface TeacherImageLabAccountMutationInput {
  readonly operationId: string;
  readonly alias: string;
  readonly object: number;
  readonly realise: number;
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
  imageLabStatus(): Promise<TeacherImageLabOverview>;
  setImageLabGlobal(input: {
    operationId: string;
    enabled: boolean;
    objectDefault: number;
    realiseDefault: number;
  }): Promise<TeacherImageLabGlobalResult>;
  setImageLabAccount(
    input: TeacherImageLabAccountMutationInput
  ): Promise<TeacherImageLabAccountResult>;
  addImageLabAccount(
    input: TeacherImageLabAccountMutationInput
  ): Promise<TeacherImageLabAccountResult>;
  revokeImageLabAccount(
    input: TeacherImageLabAccountMutationInput
  ): Promise<TeacherImageLabAccountResult>;
  batchAddImageLab(input: {
    operationId: string;
    aliases: readonly string[];
    object: number;
    realise: number;
  }): Promise<TeacherImageLabBatchResult>;
}

export class TeacherClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly retryable = false,
    readonly refreshRequired = false
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

const validAllowanceAmount = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 100;

const parseImageLabCounts = (value: unknown): TeacherImageLabCounts => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["granted", "consumed", "reserved", "remaining"]) ||
    !validAllowanceAmount(value.granted) ||
    !validAllowanceAmount(value.consumed) ||
    !validAllowanceAmount(value.reserved) ||
    !validAllowanceAmount(value.remaining) ||
    value.consumed + value.reserved > value.granted ||
    value.remaining !== value.granted - value.consumed - value.reserved
  ) {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  return {
    granted: value.granted,
    consumed: value.consumed,
    reserved: value.reserved,
    remaining: value.remaining
  };
};

const parseImageLabAccount = (value: unknown): TeacherImageLabAccount => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["alias", "object", "realise"]) ||
    typeof value.alias !== "string" ||
    !USERNAME_PATTERN.test(value.alias) ||
    value.alias === "teacher-playtest"
  ) {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  return {
    alias: value.alias,
    object: parseImageLabCounts(value.object),
    realise: parseImageLabCounts(value.realise)
  };
};

const parseImageLabDefaults = (
  value: unknown
): TeacherImageLabOverview["defaults"] => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["object", "realise"]) ||
    !validAllowanceAmount(value.object) ||
    !validAllowanceAmount(value.realise)
  ) {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  return { object: value.object, realise: value.realise };
};

const parseImageLabOverview = (value: unknown): TeacherImageLabOverview => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["enabled", "defaults", "accounts"]) ||
    typeof value.enabled !== "boolean" ||
    !Array.isArray(value.accounts) ||
    value.accounts.length > 1_000
  ) {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  const accounts = value.accounts.map(parseImageLabAccount);
  if (new Set(accounts.map(({ alias }) => alias)).size !== accounts.length) {
    throw new TeacherClientError("INVALID_RESPONSE", 503, true);
  }
  return {
    enabled: value.enabled,
    defaults: parseImageLabDefaults(value.defaults),
    accounts: accounts.sort((left, right) => left.alias.localeCompare(right.alias))
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
  let refreshRequired = false;
  try {
    const value = await readBoundedJson(response);
    if (isRecord(value) && typeof value.error === "string" &&
      /^[A-Z][A-Z0-9_]{1,63}$/u.test(value.error)) {
      code = value.error;
    }
    if (isRecord(value) && typeof value.retryable === "boolean") {
      retryable = value.retryable;
    }
    if (isRecord(value) && typeof value.refreshRequired === "boolean") {
      refreshRequired = value.refreshRequired;
    }
  } catch {
    // A bounded generic error is safer than reflecting an invalid upstream body.
  }
  return new TeacherClientError(code, response.status, retryable, refreshRequired);
};

export class HttpTeacherClient implements TeacherClient {
  readonly #fetcher: typeof fetch;
  readonly #delay: (milliseconds: number) => Promise<void>;
  readonly #timeoutMilliseconds: number;

  constructor(options: HttpTeacherClientOptions = {}) {
    this.#fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
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

  async imageLabStatus(): Promise<TeacherImageLabOverview> {
    return parseImageLabOverview(
      await this.#requestJson("/api/teacher/image-lab", "GET")
    );
  }

  async setImageLabGlobal(input: {
    operationId: string;
    enabled: boolean;
    objectDefault: number;
    realiseDefault: number;
  }): Promise<TeacherImageLabGlobalResult> {
    const value = await this.#requestJson("/api/teacher/image-lab/global", "PUT", {
      schema: "ad-market-teacher-image-lab-global",
      version: 1,
      operationId: input.operationId,
      enabled: input.enabled,
      objectDefault: input.objectDefault,
      realiseDefault: input.realiseDefault
    });
    if (
      !isRecord(value) ||
      !hasExactKeys(value, [
        "status",
        "operationId",
        "operation",
        "enabled",
        "defaults"
      ]) ||
      value.status !== "updated" ||
      value.operationId !== input.operationId ||
      value.operation !== "global" ||
      typeof value.enabled !== "boolean"
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    return {
      status: "updated",
      operationId: input.operationId,
      operation: "global",
      enabled: value.enabled,
      defaults: parseImageLabDefaults(value.defaults)
    };
  }

  async setImageLabAccount(
    input: TeacherImageLabAccountMutationInput
  ): Promise<TeacherImageLabAccountResult> {
    return this.#mutateImageLabAccount("set", input);
  }

  async addImageLabAccount(
    input: TeacherImageLabAccountMutationInput
  ): Promise<TeacherImageLabAccountResult> {
    return this.#mutateImageLabAccount("add", input);
  }

  async revokeImageLabAccount(
    input: TeacherImageLabAccountMutationInput
  ): Promise<TeacherImageLabAccountResult> {
    return this.#mutateImageLabAccount("revoke", input);
  }

  async batchAddImageLab(input: {
    operationId: string;
    aliases: readonly string[];
    object: number;
    realise: number;
  }): Promise<TeacherImageLabBatchResult> {
    const value = await this.#requestJson("/api/teacher/image-lab/batch", "POST", {
      schema: "ad-market-teacher-image-lab-batch-add",
      version: 1,
      operationId: input.operationId,
      aliases: input.aliases,
      object: input.object,
      realise: input.realise
    });
    if (
      !isRecord(value) ||
      !hasExactKeys(value, [
        "status",
        "operationId",
        "operation",
        "aliases",
        "accounts"
      ]) ||
      value.status !== "updated" ||
      value.operationId !== input.operationId ||
      value.operation !== "batch-add" ||
      !Array.isArray(value.aliases) ||
      !Array.isArray(value.accounts)
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    const aliases = value.aliases as unknown[];
    const rawAccounts = value.accounts as unknown[];
    if (
      aliases.length !== rawAccounts.length ||
      !aliases.every((alias) =>
        typeof alias === "string" && USERNAME_PATTERN.test(alias)) ||
      aliases.some((alias, index) => alias !== input.aliases[index])
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    const accounts = rawAccounts.map(parseImageLabAccount);
    if (accounts.some((account, index) => account.alias !== aliases[index])) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    return {
      status: "updated",
      operationId: input.operationId,
      operation: "batch-add",
      aliases: aliases as string[],
      accounts
    };
  }

  async #mutateImageLabAccount(
    operation: "set" | "add" | "revoke",
    input: TeacherImageLabAccountMutationInput
  ): Promise<TeacherImageLabAccountResult> {
    const suffix = operation === "set" ? "" : `/${operation}`;
    const value = await this.#requestJson(
      `/api/teacher/image-lab/accounts/${encodeURIComponent(input.alias)}${suffix}`,
      operation === "set" ? "PUT" : "POST",
      {
        schema: `ad-market-teacher-image-lab-account-${operation}`,
        version: 1,
        operationId: input.operationId,
        object: input.object,
        realise: input.realise
      }
    );
    if (
      !isRecord(value) ||
      !hasExactKeys(value, [
        "status",
        "operationId",
        "operation",
        "alias",
        "account"
      ]) ||
      value.status !== "updated" ||
      value.operationId !== input.operationId ||
      value.operation !== operation ||
      value.alias !== input.alias
    ) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    const account = parseImageLabAccount(value.account);
    if (account.alias !== input.alias) {
      throw new TeacherClientError("INVALID_RESPONSE", 503, true);
    }
    return {
      status: "updated",
      operationId: input.operationId,
      operation,
      alias: input.alias,
      account
    };
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
    if (response.status !== 204) {
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
