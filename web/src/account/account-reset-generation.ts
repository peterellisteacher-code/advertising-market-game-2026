import type { AccountResettableStore } from "./account-reset-coordinator";
import { accountStorageNamespace } from "./account-storage-namespace";

const RESET_GENERATION_PREFIX = "admarket-account-reset-generation@1:";
const RESET_GENERATION =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

interface ResetGenerationStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const browserStorage = (): ResetGenerationStorage => globalThis.localStorage;

export class BrowserAccountResetGenerationGuard {
  readonly #stores: readonly AccountResettableStore[];
  readonly #storage: ResetGenerationStorage;

  constructor(
    stores: readonly AccountResettableStore[],
    storage: ResetGenerationStorage = browserStorage()
  ) {
    this.#stores = [...stores];
    this.#storage = storage;
  }

  async reconcile(username: string, generation: string | null): Promise<boolean> {
    if (generation === null) return false;
    if (!RESET_GENERATION.test(generation)) {
      throw new Error("Account reset generation is invalid");
    }
    const key = `${RESET_GENERATION_PREFIX}${await accountStorageNamespace(username)}`;
    if (this.#storage.getItem(key) === generation) return false;

    for (const store of this.#stores) {
      await store.resetAccount(username);
    }
    this.#storage.setItem(key, generation);
    return true;
  }
}
