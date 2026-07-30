const ACCOUNT_COOKIE_LOCK_NAME = "advertising-market-account-cookie@1";

export interface AccountCookieRequestSerialiser {
  run<T>(operation: () => Promise<T>): Promise<T>;
}

export class AccountCookieSerialisationUnavailableError extends Error {
  constructor() {
    super("Cross-tab account-cookie serialisation is unavailable");
    this.name = "AccountCookieSerialisationUnavailableError";
  }
}

const browserLockManager = (): LockManager | undefined => {
  if (typeof navigator === "undefined") return undefined;
  return navigator.locks;
};

export class BrowserAccountCookieRequestSerialiser implements AccountCookieRequestSerialiser {
  constructor(private readonly locks: LockManager | undefined = browserLockManager()) {}

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.locks === undefined) throw new AccountCookieSerialisationUnavailableError();
    return this.locks.request(
      ACCOUNT_COOKIE_LOCK_NAME,
      { mode: "exclusive" },
      async () => operation()
    );
  }
}

class SameTabAccountCookieRequestSerialiser implements AccountCookieRequestSerialiser {
  private tail: Promise<void> = Promise.resolve();

  run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

export const immediateAccountCookieRequestSerialiser: AccountCookieRequestSerialiser =
  Object.freeze({ run: <T>(operation: () => Promise<T>): Promise<T> => operation() });

const sameTabAccountCookieRequestSerialiser = new SameTabAccountCookieRequestSerialiser();

export function defaultAccountCookieRequestSerialiser(
  fetcher: typeof fetch,
  locks: LockManager | undefined = browserLockManager()
): AccountCookieRequestSerialiser {
  if (fetcher !== globalThis.fetch) return immediateAccountCookieRequestSerialiser;
  if (locks !== undefined) return new BrowserAccountCookieRequestSerialiser(locks);
  console.warn("[AdMarket account cookie lock unavailable]", { fallback: "same-tab" });
  return sameTabAccountCookieRequestSerialiser;
}
