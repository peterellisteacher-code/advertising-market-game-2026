const ACCOUNT_USERNAME = /^[a-z0-9][a-z0-9_-]{2,23}$/u;

export const ACCOUNT_IDENTITY_HEADER = "x-admarket-account";
export const ACCOUNT_MUTATION_STORAGE_KEY = "admarket-account-mutation@1";

export interface AccountIdentityBinding {
  current(): string | null;
  activate(username: string): void;
  deactivate(): void;
}

export interface AccountMutationPublisher {
  publish(): void;
}

export interface AccountMutationBus extends AccountMutationPublisher {
  subscribe(listener: () => void): () => void;
}

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

  publish(): void {
    try {
      this.storage.setItem(ACCOUNT_MUTATION_STORAGE_KEY, this.nonce());
    } catch {
      // The expected-account request header remains the hard boundary when storage is unavailable.
    }
  }

  subscribe(listener: () => void): () => void {
    const onStorage = (event: Event): void => {
      const mutation = event as StorageEvent;
      if (mutation.key === ACCOUNT_MUTATION_STORAGE_KEY && typeof mutation.newValue === "string") {
        listener();
      }
    };
    this.eventSource.addEventListener("storage", onStorage);
    return () => this.eventSource.removeEventListener("storage", onStorage);
  }
}
