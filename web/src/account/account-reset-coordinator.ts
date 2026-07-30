import { accountStorageNamespace } from "./account-storage-namespace";
import type {
  AccountIdentityBinding,
  AccountMutationPublisher
} from "./account-identity-binding";
import type { AccountResetClient } from "./account-client";

const RESET_PENDING_PREFIX = "admarket-account-reset@1:";
const ACCOUNT_USERNAME = /^[a-z0-9][a-z0-9_-]{2,23}$/u;
const OPERATION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

interface ResetPendingRecord {
  readonly schema: "advertising-game-account-reset-pending";
  readonly version: 1;
  readonly phase: "pending";
  readonly username: string;
  readonly operationId: string;
}

export interface AccountResettableStore {
  resetAccount(username: string): Promise<void>;
}

interface ResetPendingStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface AccountResetCoordinatorOptions {
  readonly client: AccountResetClient;
  readonly identity: AccountIdentityBinding;
  readonly mutations: AccountMutationPublisher;
  readonly stores: readonly AccountResettableStore[];
  readonly quiesce: () => void | Promise<void>;
  readonly storage?: ResetPendingStorage;
  readonly createOperationId?: () => string;
  readonly reload?: () => void;
}

function browserStorage(): ResetPendingStorage {
  return globalThis.localStorage;
}

function exactRecord(value: unknown): ResetPendingRecord | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !==
    "operationId,phase,schema,username,version" ||
    record.schema !== "advertising-game-account-reset-pending" ||
    record.version !== 1 || record.phase !== "pending" ||
    typeof record.username !== "string" || !ACCOUNT_USERNAME.test(record.username) ||
    typeof record.operationId !== "string" || !OPERATION_ID.test(record.operationId)) return null;
  return record as unknown as ResetPendingRecord;
}

export class AccountResetCoordinator {
  readonly #client: AccountResetClient;
  readonly #identity: AccountIdentityBinding;
  readonly #mutations: AccountMutationPublisher;
  readonly #stores: readonly AccountResettableStore[];
  readonly #quiesce: () => void | Promise<void>;
  readonly #storage: ResetPendingStorage;
  readonly #createOperationId: () => string;
  readonly #reload: () => void;
  #active: Promise<void> | null = null;

  constructor(options: AccountResetCoordinatorOptions) {
    this.#client = options.client;
    this.#identity = options.identity;
    this.#mutations = options.mutations;
    this.#stores = [...options.stores];
    this.#quiesce = options.quiesce;
    this.#storage = options.storage ?? browserStorage();
    this.#createOperationId = options.createOperationId ??
      (() => globalThis.crypto.randomUUID());
    this.#reload = options.reload ?? (() => globalThis.location.reload());
  }

  reset(confirmation: "RESET"): Promise<void> {
    if (confirmation !== "RESET") {
      return Promise.reject(new Error("Type RESET exactly to confirm."));
    }
    return this.#start();
  }

  retry(): Promise<void> {
    return this.#start();
  }

  #start(): Promise<void> {
    if (this.#active !== null) return this.#active;
    const operation = this.#run();
    const active = operation.finally(() => {
      if (this.#active === active) this.#active = null;
    });
    this.#active = active;
    return active;
  }

  async #run(): Promise<void> {
    const username = this.#identity.current();
    if (username === null || !ACCOUNT_USERNAME.test(username)) {
      throw new Error("An authenticated account is required to reset progress.");
    }
    const pendingKey =
      `${RESET_PENDING_PREFIX}${await accountStorageNamespace(username)}`;
    const pending = this.#readPending(pendingKey, username) ??
      this.#newPending(username);
    this.#storage.setItem(pendingKey, JSON.stringify(pending));
    this.#mutations.publish({
      kind: "reset-pending",
      username,
      operationId: pending.operationId
    });
    await this.#quiesce();
    await this.#client.reset({
      operationId: pending.operationId,
      confirmation: "RESET"
    });
    for (const store of this.#stores) await store.resetAccount(username);
    this.#storage.removeItem(pendingKey);
    this.#mutations.publish({
      kind: "reset-complete",
      username,
      operationId: pending.operationId
    });
    this.#reload();
  }

  #readPending(key: string, username: string): ResetPendingRecord | null {
    const raw = this.#storage.getItem(key);
    if (raw === null) return null;
    try {
      const parsed = exactRecord(JSON.parse(raw) as unknown);
      return parsed?.username === username ? parsed : null;
    } catch {
      return null;
    }
  }

  #newPending(username: string): ResetPendingRecord {
    const operationId = this.#createOperationId();
    if (!OPERATION_ID.test(operationId)) {
      throw new Error("Unable to create a reset operation.");
    }
    return {
      schema: "advertising-game-account-reset-pending",
      version: 1,
      phase: "pending",
      username,
      operationId
    };
  }
}
