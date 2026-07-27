import { createHash, createHmac } from "node:crypto";
import { getStore } from "@netlify/blobs";
import {
  SupabaseAccountError,
  type AccountAdminRecord,
  type ProgressRpcInput
} from "./account-backend";
import type { AccountAssetResetPlan } from "./account-assets";
import {
  type ImageLabAllowanceSnapshot,
  type ImageLabAllowanceStore,
  type TeacherImageLabAccount,
  type TeacherImageLabPrivateAccount
} from "./image-lab-allowance-store";
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

export interface TeacherImageLabOverview {
  readonly enabled: boolean;
  readonly defaults: {
    readonly object: number;
    readonly realise: number;
  };
  readonly accounts: readonly TeacherImageLabAccount[];
}

export type TeacherImageLabAccountOperation = "set" | "add" | "revoke";

export type TeacherImageLabMutationResult =
  | {
      readonly status: "updated";
      readonly operationId: string;
      readonly operation: "global";
      readonly enabled: boolean;
      readonly defaults: {
        readonly object: number;
        readonly realise: number;
      };
    }
  | {
      readonly status: "updated";
      readonly operationId: string;
      readonly operation: TeacherImageLabAccountOperation;
      readonly alias: string;
      readonly account: TeacherImageLabAccount;
    }
  | {
      readonly status: "updated";
      readonly operationId: string;
      readonly operation: "batch-add";
      readonly aliases: readonly string[];
      readonly accounts: readonly TeacherImageLabAccount[];
    };

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
  beginAdvertisingGameReset(username: string, operationId: string): Promise<void>;
  completeAdvertisingGameReset(username: string, operationId: string): Promise<void>;
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
      | "USERNAME_UNAVAILABLE"
      | "IMAGE_LAB_MUTATION_UNCERTAIN",
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
  readonly allowances: ImageLabAllowanceStore;
  readonly operations: TeacherAccountOperationStore;
  readonly usernameHmacSecret: string;
  readonly operationSecret: string;
}

interface MutationInput {
  readonly operationId: string;
  readonly username: string;
  readonly password?: string;
}

interface ImageLabGlobalMutationInput {
  readonly operationId: string;
  readonly enabled: boolean;
  readonly objectDefault: number;
  readonly realiseDefault: number;
}

interface ImageLabAccountMutationInput {
  readonly operationId: string;
  readonly alias: string;
  readonly object: number;
  readonly realise: number;
}

interface ImageLabBatchMutationInput {
  readonly operationId: string;
  readonly aliases: readonly string[];
  readonly object: number;
  readonly realise: number;
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

const validAllowanceAmount = (value: unknown, minimum = 0): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= minimum &&
  value <= 100;

const imageLabAccount = (
  alias: string,
  account: Pick<TeacherImageLabPrivateAccount, "object" | "realise">
): TeacherImageLabAccount => ({
  alias,
  object: account.object,
  realise: account.realise
});

const imageLabDefaults = (
  snapshot: ImageLabAllowanceSnapshot
): TeacherImageLabOverview["defaults"] => ({
  object: snapshot.object.granted,
  realise: snapshot.realise.granted
});

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
      const defaults = await this.dependencies.allowances.globalStatus();
      await this.dependencies.allowances.teacherMutate({
        ledgerOperation: "initialize",
        userIds: [created.userId],
        object: defaults.object.granted,
        realise: defaults.realise.granted,
        ...this.imageLabIdentity(
          parsed.operationId,
          "teacher-create-allowances",
          {
            alias: created.username,
            userId: created.userId,
            object: defaults.object.granted,
            realise: defaults.realise.granted
          }
        )
      });
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
      await this.dependencies.client.beginAdvertisingGameReset(
        parsed.username,
        parsed.operationId
      );
      const plan = await this.dependencies.assets.planReset(user.userId);
      await this.dependencies.client.progressRpc({
        userId: user.userId,
        operation: "reset",
        schema: "advertising-game-progress",
        version: 1
      });
      await this.dependencies.assets.executeReset(plan);
      await this.dependencies.client.completeAdvertisingGameReset(
        parsed.username,
        parsed.operationId
      );
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

  async imageLabStatus(): Promise<TeacherImageLabOverview> {
    try {
      const [global, accounts] = await Promise.all([
        this.dependencies.allowances.globalStatus(),
        this.dependencies.allowances.list()
      ]);
      return {
        enabled: global.enabled,
        defaults: imageLabDefaults(global),
        accounts: [...accounts].sort((left, right) =>
          left.alias.localeCompare(right.alias))
      };
    } catch {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
    }
  }

  async setImageLabGlobal(
    input: ImageLabGlobalMutationInput
  ): Promise<TeacherImageLabMutationResult> {
    if (
      !UUID_PATTERN.test(input.operationId) ||
      typeof input.enabled !== "boolean" ||
      !validAllowanceAmount(input.objectDefault) ||
      !validAllowanceAmount(input.realiseDefault)
    ) {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }
    try {
      const result = await this.dependencies.allowances.teacherMutate({
        ledgerOperation: "set_global",
        userIds: [],
        enabled: input.enabled,
        object: input.objectDefault,
        realise: input.realiseDefault,
        ...this.imageLabIdentity(input.operationId, "teacher-global-atomic", {
          enabled: input.enabled,
          object: input.objectDefault,
          realise: input.realiseDefault
        })
      });
      return {
        status: "updated",
        operationId: input.operationId,
        operation: "global",
        enabled: result.snapshot.enabled,
        defaults: imageLabDefaults(result.snapshot)
      };
    } catch {
      throw new TeacherAccountServiceError(
        "IMAGE_LAB_MUTATION_UNCERTAIN",
        409,
        false
      );
    }
  }

  async mutateImageLabAccount(
    operation: TeacherImageLabAccountOperation,
    input: ImageLabAccountMutationInput
  ): Promise<TeacherImageLabMutationResult> {
    const alias = this.parseImageLabAlias(input.alias);
    const minimum = operation === "set" ? 0 : 1;
    if (
      !UUID_PATTERN.test(input.operationId) ||
      !validAllowanceAmount(input.object) ||
      !validAllowanceAmount(input.realise) ||
      (minimum === 1 && input.object === 0 && input.realise === 0)
    ) {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }

    let user: AccountAdminRecord;
    try {
      const found = await this.dependencies.client.findAdvertisingGameUser(alias);
      if (found === null) {
        throw new TeacherAccountServiceError("ACCOUNT_NOT_FOUND", 404);
      }
      user = found;
    } catch (error) {
      if (error instanceof TeacherAccountServiceError) throw error;
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
    }

    try {
      const result = await this.dependencies.allowances.teacherMutate({
        ledgerOperation: operation,
        userIds: [user.userId],
        object: input.object,
        realise: input.realise,
        ...this.imageLabIdentity(input.operationId, `teacher-${operation}-atomic`, {
          alias,
          userId: user.userId,
          object: input.object,
          realise: input.realise
        })
      });
      const account = result.accounts[0];
      if (account === undefined || account.userId !== user.userId) throw new Error();
      return {
        status: "updated",
        operationId: input.operationId,
        operation,
        alias,
        account: imageLabAccount(alias, account)
      };
    } catch {
      throw new TeacherAccountServiceError(
        "IMAGE_LAB_MUTATION_UNCERTAIN",
        409,
        false
      );
    }
  }

  async batchAddImageLab(
    input: ImageLabBatchMutationInput
  ): Promise<TeacherImageLabMutationResult> {
    if (
      !UUID_PATTERN.test(input.operationId) ||
      !Array.isArray(input.aliases) ||
      input.aliases.length < 1 ||
      input.aliases.length > 100 ||
      !validAllowanceAmount(input.object) ||
      !validAllowanceAmount(input.realise) ||
      (input.object === 0 && input.realise === 0)
    ) {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }
    const aliases = input.aliases.map((alias) => this.parseImageLabAlias(alias));
    if (new Set(aliases).size !== aliases.length) {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }

    let users: AccountAdminRecord[];
    try {
      users = await Promise.all(aliases.map(async (alias) => {
        const user = await this.dependencies.client.findAdvertisingGameUser(alias);
        if (user === null) {
          throw new TeacherAccountServiceError("ACCOUNT_NOT_FOUND", 404);
        }
        return user;
      }));
    } catch (error) {
      if (error instanceof TeacherAccountServiceError) throw error;
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503, true);
    }

    try {
      const userIds = users.map(({ userId }) => userId);
      const result = await this.dependencies.allowances.teacherMutate({
        ledgerOperation: "batch_add",
        userIds,
        object: input.object,
        realise: input.realise,
        ...this.imageLabIdentity(input.operationId, "teacher-batch-atomic", {
          aliases,
          userIds,
          object: input.object,
          realise: input.realise
        })
      });
      if (result.accounts.length !== users.length) throw new Error();
      const accounts = result.accounts.map((account, index) => {
        const user = users[index]!;
        if (account.userId !== user.userId) throw new Error();
        return imageLabAccount(aliases[index]!, account);
      });
      return {
        status: "updated",
        operationId: input.operationId,
        operation: "batch-add",
        aliases,
        accounts
      };
    } catch {
      throw new TeacherAccountServiceError(
        "IMAGE_LAB_MUTATION_UNCERTAIN",
        409,
        false
      );
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

  private parseImageLabAlias(value: unknown): string {
    let alias: string;
    try {
      alias = normaliseAccountUsername(value);
    } catch {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }
    if (alias === TEACHER_PLAYTEST_USERNAME) {
      throw new TeacherAccountServiceError("TEACHER_UNAVAILABLE", 503);
    }
    return alias;
  }

  private imageLabIdentity(
    rootOperationId: string,
    action: string,
    request: Readonly<Record<string, unknown>>
  ): { readonly operationId: string; readonly requestHash: string } {
    return {
      operationId: `${rootOperationId}:${action}`,
      requestHash: createHash("sha256")
        .update(JSON.stringify({
          schema: "ad-market-teacher-image-lab-mutation",
          version: 1,
          rootOperationId,
          action,
          request
        }), "utf8")
        .digest("hex")
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
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const existing = await this.dependencies.operations.read(key);
      if (existing === null) {
        await this.dependencies.operations.create(key, started);
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
      return { key, etag: existing.etag, record };
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
