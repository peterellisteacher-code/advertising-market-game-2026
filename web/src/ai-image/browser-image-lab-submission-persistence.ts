import type { ImageLabSubmissionPersistence } from "./image-lab-runtime";

const DEFAULT_PREFIX = "ad-market:image-lab-submission:v1:";
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
  readonly #prefix: string;

  constructor(storage: Storage | null = availableLocalStorage(), prefix = DEFAULT_PREFIX) {
    if (!prefix || prefix.length > 128) throw new Error("Image Lab storage prefix is invalid");
    this.#storage = storage;
    this.#prefix = prefix;
  }

  async load(fingerprint: string): Promise<string | null> {
    if (this.#storage === null) throw new Error("Image Lab retry storage is unavailable");
    const value = this.#storage.getItem(fingerprintKey(this.#prefix, fingerprint));
    if (value === null) return null;
    return idempotencyKey(value);
  }

  async store(fingerprint: string, value: string): Promise<void> {
    if (this.#storage === null) throw new Error("Image Lab retry storage is unavailable");
    this.#storage.setItem(
      fingerprintKey(this.#prefix, fingerprint),
      idempotencyKey(value)
    );
  }

  async remove(fingerprint: string): Promise<void> {
    if (this.#storage === null) throw new Error("Image Lab retry storage is unavailable");
    this.#storage.removeItem(fingerprintKey(this.#prefix, fingerprint));
  }
}
