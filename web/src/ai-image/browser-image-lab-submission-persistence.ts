import type { ImageLabSubmissionPersistence } from "./image-lab-runtime";
import { accountStorageNamespace } from "../account/account-storage-namespace";

const DEFAULT_LEGACY_PREFIX = "ad-market:image-lab-submission:v1:";
const DEFAULT_ACCOUNT_PREFIX = "ad-market:image-lab-submission:v2:";
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function availableLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function fingerprintKey(prefix: string, fingerprint: string): string {
  if (!FINGERPRINT_PATTERN.test(fingerprint)) {
    throw new Error("Image Lab submission fingerprint is invalid");
  }
  return `${prefix}${fingerprint}`;
}

function idempotencyKey(value: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new Error("Image Lab idempotency key is invalid");
  }
  return value;
}

export class BrowserImageLabSubmissionPersistence implements ImageLabSubmissionPersistence {
  readonly #storage: Storage | null;
  readonly #legacyPrefix: string;
  readonly #accountPrefix: string;
  #activePrefix: string | null = null;

  constructor(
    storage: Storage | null = availableLocalStorage(),
    legacyPrefix = DEFAULT_LEGACY_PREFIX,
    accountPrefix = DEFAULT_ACCOUNT_PREFIX
  ) {
    if (!legacyPrefix || legacyPrefix.length > 128 ||
      !accountPrefix || accountPrefix.length > 128) {
      throw new Error("Image Lab storage prefix is invalid");
    }
    this.#storage = storage;
    this.#legacyPrefix = legacyPrefix;
    this.#accountPrefix = accountPrefix;
  }

  async activateAccount(username: string): Promise<void> {
    this.#activePrefix = `${this.#accountPrefix}${await accountStorageNamespace(username)}:`;
  }

  deactivateAccount(): void {
    this.#activePrefix = null;
  }

  async resetAccount(username: string): Promise<void> {
    if (this.#storage === null) return;
    const prefix = `${this.#accountPrefix}${await accountStorageNamespace(username)}:`;
    const keys: string[] = [];
    for (let index = 0; index < this.#storage.length; index += 1) {
      const key = this.#storage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => this.#storage!.removeItem(key));
  }

  async load(fingerprint: string): Promise<string | null> {
    if (this.#storage === null) throw new Error("Image Lab retry storage is unavailable");
    const value = this.#storage.getItem(fingerprintKey(this.#storagePrefix(), fingerprint));
    if (value === null) return null;
    return idempotencyKey(value);
  }

  async store(fingerprint: string, value: string): Promise<void> {
    if (this.#storage === null) throw new Error("Image Lab retry storage is unavailable");
    this.#storage.setItem(
      fingerprintKey(this.#storagePrefix(), fingerprint),
      idempotencyKey(value)
    );
  }

  async remove(fingerprint: string): Promise<void> {
    if (this.#storage === null) throw new Error("Image Lab retry storage is unavailable");
    this.#storage.removeItem(fingerprintKey(this.#storagePrefix(), fingerprint));
  }

  #storagePrefix(): string {
    return this.#activePrefix ?? this.#legacyPrefix;
  }
}
