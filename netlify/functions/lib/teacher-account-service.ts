import { createHmac } from "node:crypto";
import { getStore } from "@netlify/blobs";
import {
  SupabaseAccountError,
  type AccountAdminRecord,
  type ProgressRpcInput
} from "./account-backend";
import type { AccountAssetResetPlan } from "./account-assets";
import {
  deriveSyntheticAccountEmail,
  normaliseAccountUsername
} from "./account-primitives";

const OPERATION_STORE_NAME = "advertising-game-teacher-operations-v1";
const OPERATION_SCHEMA = "ad-market-teacher-operation";
const OPERATION_CONTEXT = "ad-market-teacher-operation-v1\0";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const TEACHER_PLAYTEST_USERNAME = "teacher-playtest";

export interface TeacherPairSummary {
  readonly username: string;
  readonly createdAt: string;
  readonly lastSignInAt: string | null;
}

export type TeacherAccountMutationResult =
  | {
      readonly status: "created";
      readonly operationId: string;
      readonly account: TeacherPairSummary;
    }
  | {
      readonly status: "password-replaced" | "reset";
      readonly operationId: string;
      readonly username: string;
    };

type TeacherAccountOperationAction = "create" | "password" | "reset";

export interface TeacherAccountOperationRecord {
  readonly schema: typeof OPERATION_SCHEMA;
  readonly version: 1;
  readonly action: TeacherAccountOperationAction;
  readonly username: string;
  readonly requestDigest: string;
  readonly state: "started" | "completed";
  readonly result?: TeacherAccountMutationResult;
}

export interface TeacherAccountOperationEntry {
  readonly value: unknown;
  readonly etag: string;
}

export interface TeacherAccountOperationStore {
  read(key: string): Promise<TeacherAccountOperationEntry | null>;
  create(key: string, value: TeacherAccountOperationRecord): Promise<boolean>;
  compareAndSwap(
    key: string,
    value: TeacherAccountOperationRecord,
    etag: string
  ): Promise<boolean>;
}

export interface TeacherAccountClient {
  listAdvertisingGameUsers(): Promise<readonly AccountAdminRecord[]>;
  findAdvertisingGameUser(username: string): Promise<AccountAdminRecord | null>;
  createConfirmedUser(email: string, password: string, username: string): Promise<void>;
  replaceAdvertisingGamePassword(username: string, password: string): Promise<void>;
  progressRpc(input: ProgressRpcInput): Promise<unknown>;
}

export interface TeacherAccountAssetService {
  planReset(userId: string): Promise<AccountAssetResetPlan>;
  executeReset(plan: AccountAssetResetPlan): Promise<void>;
}

export class TeacherAccountServiceError extends Error {
  constructor(
    readonly code:
      | "ACCOUNT_NOT_FOUND"
      | "IDEMPOTENCY_CONFLICT"
      | "OPERATION_INCOMPLETE"
      | "RESET_INCOMPLETE"
      | "TEACHER_UNAVAILABLE"
      | "USERNAME_UNAVAILABLE",
    readonly status: number,
    readonly retryable = false,
    readonly retryAfter?: number
  ) {
    super(code);
    this.name = "TeacherAccountServiceError";
  }
}

interface TeacherAccountServiceDependencies {
  readonly client: TeacherAccountClient;
  readonly assets: TeacherAccountAssetService;
  readonly operations: TeacherAccountOperationStore;
  readonly usernameHmacSecret: string;
  readonly operationSecret: string;
}

interface MutationInput {
  readonly operationId: string;
  readonly username: string;
  readonly password?: string;
}

interface ClaimedOperation {
  readonly key: string;
  readonly etag: string;
  readonly record: TeacherAccountOperationRecord;
}

const summary = (record: AccountAdminRecord): TeacherPairSummary => ({
  username: record.username,
  createdAt: record.createdAt,
  lastSignInAt: record.lastSignInAt
});

const validPassword = (value: unknown): value is string =>
  typeof value === "string" &&
  !value.includes("\0") &&
  Buffer.byteLength(value, "utf8") >= 8 &&
  Buffer.byteLength(value, "utf8") <= 128;

const operationFailure = (action: TeacherAccountOperationAction): TeacherAccountServiceError =>
  action === "reset"
    ? new TeacherAccountServiceError("RESET_INCOMPLETE", 409, false)
    : new TeacherAccountServiceError("OPERATION_INCOMPLETE", 409, false);

const parseStoredOperation = (value: unknown): TeacherAccountOperationRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
  }
  const record = value as Record<string, unknown>;
  const baseValid =
    record.schema === OPERATION_SCHEMA &&
    record.version === 1 &&
    (record.action === "create" || record.action === "password" || record.action === "reset") &&
    typeof record.username === "string" &&
    typeof record.requestDigest === "string" &&
    SHA256_PATTERN.test(record.requestDigest) &&
    (record.state === "started" || record.state === "completed");
  if (!baseValid) {
    throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
  }
  if (
    (record.state === "started" && record.result !== undefined) ||
    (record.state === "completed" && record.result === undefined)
  ) {
    throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
  }
  return record as unknown as TeacherAccountOperationRecord;
};

export class TeacherAccountService {
  constructor(private readonly dependencies: TeacherAccountServiceDependencies) {
    for (const secret of [
      dependencies.usernameHmacSecret,
      dependencies.operationSecret
    ]) {
      if (
        typeof secret !== "string" ||
        secret.trim() !== secret ||
        Buffer.byteLength(secret, "utf8") < 32 ||
        Buffer.byteLength(secret, "utf8") > 256
      ) {
        throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
      }
    }
  }

  async listAccounts(): Promise<readonly TeacherPairSummary[]> {
    const users = await this.dependencies.client.listAdvertisingGameUsers();
    return users
      .map(summary)
      .sort((left, right) => left.username.localeCompare(right.username));
  }

  async createAccount(input: Required<MutationInput>): Promise<TeacherAccountMutationResult> {
    const parsed = this.parseMutation(input, true);
    const claimed = await this.claim("create", parsed);
    if ("replay" in claimed) return claimed.replay;
    try {
      if (await this.dependencies.client.findAdvertisingGameUser(parsed.username) !== null) {
        throw new TeacherAccountServiceError("USERNAME_UNAVAILABLE", 409);
      }
      await this.dependencies.client.createConfirmedUser(
        deriveSyntheticAccountEmail(parsed.username, this.dependencies.usernameHmacSecret),
        parsed.password!,
        parsed.username
      );
      const created = await this.dependencies.client.findAdvertisingGameUser(parsed.username);
      if (created === null || created.username !== parsed.username) {
        throw new TeacherAccountServiceError("OPERATION_INCOMPLETE", 409);
      }
      const result: TeacherAccountMutationResult = {
        status: "created",
        operationId: parsed.operationId,
        account: summary(created)
      };
      await this.complete(claimed, result);
      return result;
    } catch (error) {
      if (error instanceof TeacherAccountServiceError) throw error;
      if (error instanceof SupabaseAccountError && error.kind === "duplicate_user") {
        throw new TeacherAccountServiceError("USERNAME_UNAVAILABLE", 409);
      }
      throw operationFailure("create");
    }
  }

  async replacePassword(input: Required<MutationInput>): Promise<TeacherAccountMutationResult> {
    const parsed = this.parseMutation(input, true);
    const claimed = await this.claim("password", parsed);
    if ("replay" in claimed) return claimed.replay;
    try {
      if (await this.dependencies.client.findAdvertisingGameUser(parsed.username) === null) {
        throw new TeacherAccountServiceError("ACCOUNT_NOT_FOUND", 404);
      }
      await this.dependencies.client.replaceAdvertisingGamePassword(
        parsed.username,
        parsed.password!
      );
      const result: TeacherAccountMutationResult = {
        status: "password-replaced",
        operationId: parsed.operationId,
        username: parsed.username
      };
      await this.complete(claimed, result);
      return result;
    } catch (error) {
      if (error instanceof TeacherAccountServiceError) throw error;
      throw operationFailure("password");
    }
  }

  async resetAccount(input: Omit<MutationInput, "password">): Promise<TeacherAccountMutationResult> {
    const parsed = this.parseMutation(input, false);
    const claimed = await this.claim("reset", parsed);
    if ("replay" in claimed) return claimed.replay;
    try {
      const user = await this.dependencies.client.findAdvertisingGameUser(parsed.username);
      if (user === null) throw new TeacherAccountServiceError("ACCOUNT_NOT_FOUND", 404);
      const plan = await this.dependencies.assets.planReset(user.userId);
      await this.dependencies.client.progressRpc({
        userId: user.userId,
        operation: "reset",
        schema: "advertising-game-progress",
        version: 1
      });
      await this.dependencies.assets.executeReset(plan);
      const result: TeacherAccountMutationResult = {
        status: "reset",
        operationId: parsed.operationId,
        username: parsed.username
      };
      await this.complete(claimed, result);
      return result;
    } catch (error) {
      if (
        error instanceof TeacherAccountServiceError &&
        error.code === "ACCOUNT_NOT_FOUND"
      ) {
        throw error;
      }
      throw operationFailure("reset");
    }
  }

  private parseMutation(
    input: MutationInput,
    passwordRequired: boolean
  ): Required<MutationInput> {
    let username: string;
    try {
      username = normaliseAccountUsername(input.username);
    } catch {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }
    if (
      username === TEACHER_PLAYTEST_USERNAME ||
      !UUID_PATTERN.test(input.operationId) ||
      (passwordRequired && !validPassword(input.password)) ||
      (!passwordRequired && input.password !== undefined)
    ) {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }
    return {
      operationId: input.operationId,
      username,
      password: input.password ?? ""
    };
  }

  private operationDigest(
    action: TeacherAccountOperationAction,
    input: Required<MutationInput>
  ): string {
    return createHmac("sha256", this.dependencies.operationSecret)
      .update(OPERATION_CONTEXT, "utf8")
      .update(action, "utf8")
      .update("\0", "utf8")
      .update(input.operationId, "utf8")
      .update("\0", "utf8")
      .update(input.username, "utf8")
      .digest("hex");
  }

  private requestDigest(
    action: TeacherAccountOperationAction,
    input: Required<MutationInput>
  ): string {
    return createHmac("sha256", this.dependencies.operationSecret)
      .update("ad-market-teacher-request-v1\0", "utf8")
      .update(JSON.stringify({
        action,
        operationId: input.operationId,
        username: input.username,
        password: input.password
      }), "utf8")
      .digest("hex");
  }

  private async claim(
    action: TeacherAccountOperationAction,
    input: Required<MutationInput>
  ): Promise<ClaimedOperation | { readonly replay: TeacherAccountMutationResult }> {
    const key = `operation/${this.operationDigest(action, input)}`;
    const requestDigest = this.requestDigest(action, input);
    const started: TeacherAccountOperationRecord = {
      schema: OPERATION_SCHEMA,
      version: 1,
      action,
      username: input.username,
      requestDigest,
      state: "started"
    };
    let createdByThisCall = false;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const existing = await this.dependencies.operations.read(key);
      if (existing === null) {
        if (await this.dependencies.operations.create(key, started)) {
          createdByThisCall = true;
        }
        continue;
      }
      if (
        typeof existing.etag !== "string" ||
        existing.etag.length < 1 ||
        existing.etag.length > 256
      ) {
        throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
      }
      const record = parseStoredOperation(existing.value);
      if (
        record.action !== action ||
        record.username !== input.username ||
        record.requestDigest !== requestDigest
      ) {
        throw new TeacherAccountServiceError("IDEMPOTENCY_CONFLICT", 409);
      }
      if (record.state === "completed" && record.result !== undefined) {
        return { replay: record.result };
      }
      if (createdByThisCall) {
        return { key, etag: existing.etag, record };
      }
      return Promise.reject(operationFailure(action));
    }
    throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
  }

  private async complete(
    claimed: ClaimedOperation,
    result: TeacherAccountMutationResult
  ): Promise<void> {
    const completed: TeacherAccountOperationRecord = {
      ...claimed.record,
      state: "completed",
      result
    };
    if (!await this.dependencies.operations.compareAndSwap(
      claimed.key,
      completed,
      claimed.etag
    )) {
      throw operationFailure(claimed.record.action);
    }
  }
}

interface NetlifyOperationStore {
  getWithMetadata(
    key: string,
    options: { type: "json" }
  ): Promise<{ data: unknown; etag?: string } | null>;
  setJSON(
    key: string,
    value: TeacherAccountOperationRecord,
    options: { onlyIfNew: true } | { onlyIfMatch: string }
  ): Promise<{ modified: boolean }>;
}

export function createNetlifyTeacherAccountOperationStore(
  store: NetlifyOperationStore
): TeacherAccountOperationStore {
  return {
    async read(key) {
      const entry = await store.getWithMetadata(key, { type: "json" });
      if (entry === null) return null;
      if (typeof entry.etag !== "string") {
        throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
      }
      return { value: entry.data, etag: entry.etag };
    },
    async create(key, value) {
      return (await store.setJSON(key, value, { onlyIfNew: true })).modified;
    },
    async compareAndSwap(key, value, etag) {
      return (await store.setJSON(key, value, { onlyIfMatch: etag })).modified;
    }
  };
}

let sharedOperationStore: TeacherAccountOperationStore | null = null;

export function defaultTeacherAccountOperationStore(): TeacherAccountOperationStore {
  sharedOperationStore ??= createNetlifyTeacherAccountOperationStore(
    getStore({ name: OPERATION_STORE_NAME, consistency: "strong" }) as unknown as
      NetlifyOperationStore
  );
  return sharedOperationStore;
}
