const ACCOUNT_USERNAME = /^[a-z0-9][a-z0-9_-]{2,23}$/u;
const RESET_OPERATION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export const ACCOUNT_IDENTITY_HEADER = "x-admarket-account";
export const ACCOUNT_MUTATION_STORAGE_KEY = "admarket-account-mutation@1";

export interface AccountIdentityBinding {
  current(): string | null;
  activate(username: string): void;
  deactivate(): void;
}

export interface AccountMutationPublisher {
  publish(mutation?: AccountMutation): void;
}

export interface AccountMutationBus extends AccountMutationPublisher {
  subscribe(listener: (mutation: AccountMutation) => void): () => void;
}

export type AccountMutation =
  | { readonly kind: "session" }
  | {
    readonly kind: "reset-pending" | "reset-complete";
    readonly username: string;
    readonly operationId: string;
  };

export class BrowserAccountIdentityBinding implements AccountIdentityBinding {
  #username: string | null = null;

  current(): string | null {
    return this.#username;
  }

  activate(username: string): void {
    if (!ACCOUNT_USERNAME.test(username)) throw new TypeError("Invalid canonical account identity");
    this.#username = username;
  }

  deactivate(): void {
    this.#username = null;
  }
}

type MutationStorage = Pick<Storage, "setItem">;
type MutationEventSource = Pick<Window, "addEventListener" | "removeEventListener">;

export class BrowserAccountMutationBus implements AccountMutationBus {
  constructor(
    private readonly storage: MutationStorage = globalThis.localStorage,
    private readonly eventSource: MutationEventSource = globalThis.window,
    private readonly nonce: () => string = () => globalThis.crypto.randomUUID()
  ) {}

  publish(mutation: AccountMutation = { kind: "session" }): void {
    try {
      const nonce = this.nonce();
      const value = mutation.kind === "session"
        ? nonce
        : JSON.stringify({ ...mutation, nonce });
      this.storage.setItem(ACCOUNT_MUTATION_STORAGE_KEY, value);
    } catch {
      // The expected-account request header remains the hard boundary when storage is unavailable.
    }
  }

  subscribe(listener: (mutation: AccountMutation) => void): () => void {
    const onStorage = (event: Event): void => {
      const mutation = event as StorageEvent;
      if (mutation.key === ACCOUNT_MUTATION_STORAGE_KEY && typeof mutation.newValue === "string") {
        const parsed = this.#parse(mutation.newValue);
        if (parsed !== null) listener(parsed);
      }
    };
    this.eventSource.addEventListener("storage", onStorage);
    return () => this.eventSource.removeEventListener("storage", onStorage);
  }

  #parse(value: string): AccountMutation | null {
    if (!value.startsWith("{")) return { kind: "session" };
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      const record = parsed as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      if (keys.join(",") !== "kind,nonce,operationId,username" ||
        record.kind !== "reset-pending" && record.kind !== "reset-complete" ||
        typeof record.username !== "string" || !ACCOUNT_USERNAME.test(record.username) ||
        typeof record.operationId !== "string" ||
        !RESET_OPERATION_ID.test(record.operationId) ||
        typeof record.nonce !== "string" || record.nonce.length < 1) return null;
      return {
        kind: record.kind,
        username: record.username,
        operationId: record.operationId
      };
    } catch {
      return null;
    }
  }
}
