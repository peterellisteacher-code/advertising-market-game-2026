export interface MarketCoordinationMessageEvent {
  readonly data: unknown;
}

export type MarketCoordinationMessageListener = (event: MarketCoordinationMessageEvent) => void;

export interface MarketCoordinationChannel {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: MarketCoordinationMessageListener): void;
  removeEventListener(type: "message", listener: MarketCoordinationMessageListener): void;
  close(): void;
}

export interface MarketCoordinationLock {
  readonly name: string;
  readonly mode: "exclusive";
}

export interface MarketCoordinationLockManager {
  request<T>(
    name: string,
    options: { readonly mode: "exclusive"; readonly ifAvailable: true },
    callback: (lock: MarketCoordinationLock | null) => T | PromiseLike<T>
  ): Promise<T>;
}

export interface MarketTabCoordinationPort {
  coordinate(clientId: string, rotate: () => string): Promise<void>;
  close(): void;
}

export interface MarketTabCoordinatorOptions {
  /** BroadcastChannel is retained only as a closeable compatibility/diagnostic port. */
  readonly channel?: MarketCoordinationChannel | null;
  readonly lockManager?: MarketCoordinationLockManager | null;
}

const LOCK_PREFIX = "advertising-market:tab-identity@1:";
const MAX_COLLISION_ROTATIONS = 8;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

const defaultChannel = (): MarketCoordinationChannel | null => {
  try {
    if (typeof globalThis.BroadcastChannel !== "function") return null;
    return new globalThis.BroadcastChannel(
      "advertising-market:tab-collision@1"
    ) as unknown as MarketCoordinationChannel;
  } catch {
    return null;
  }
};

const defaultLockManager = (): MarketCoordinationLockManager | null => {
  try {
    const locks = globalThis.navigator?.locks;
    return locks && typeof locks.request === "function"
      ? locks as unknown as MarketCoordinationLockManager
      : null;
  } catch {
    return null;
  }
};

export class MarketTabCoordinationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "MarketTabCoordinationError";
  }
}

/**
 * Holds one exclusive Web Lock for the lifetime of the tab identity. A copied
 * tab cannot acquire that identity, so it rotates its copied state and then
 * leases the new identity before market traffic is allowed to proceed.
 */
export class MarketTabCoordinator implements MarketTabCoordinationPort {
  readonly #channel: MarketCoordinationChannel | null;
  readonly #lockManager: MarketCoordinationLockManager | null;
  #clientId: string | null = null;
  #ready: Promise<void> | null = null;
  #resolveReady: (() => void) | null = null;
  #rejectReady: ((reason: MarketTabCoordinationError) => void) | null = null;
  #releaseLease: (() => void) | null = null;
  #closed = false;
  #fatal: MarketTabCoordinationError | null = null;

  constructor(options: MarketTabCoordinatorOptions = {}) {
    this.#channel = options.channel === undefined ? defaultChannel() : options.channel;
    this.#lockManager = options.lockManager === undefined
      ? defaultLockManager()
      : options.lockManager;
  }

  coordinate(clientId: string, rotate: () => string): Promise<void> {
    if (this.#fatal) return Promise.reject(this.#fatal);
    if (this.#closed) {
      return Promise.reject(new MarketTabCoordinationError("TAB_COORDINATION_CLOSED"));
    }
    if (!this.#lockManager) {
      return Promise.reject(new MarketTabCoordinationError("TAB_COORDINATION_UNAVAILABLE"));
    }
    if (!isUuid(clientId)) {
      return Promise.reject(new MarketTabCoordinationError("TAB_COORDINATION_FAILED"));
    }
    if (this.#ready) {
      if (this.#clientId !== clientId) {
        return Promise.reject(new MarketTabCoordinationError("TAB_COORDINATION_FAILED"));
      }
      return this.#ready;
    }

    this.#clientId = clientId;
    this.#ready = new Promise<void>((resolve, reject) => {
      this.#resolveReady = resolve;
      this.#rejectReady = reject;
    });
    this.#tryAcquire(clientId, rotate, 0);
    return this.#ready;
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#channel?.close();
    if (!this.#releaseLease) {
      this.#rejectReady?.(new MarketTabCoordinationError("TAB_COORDINATION_CLOSED"));
    }
    this.#releaseLease?.();
    this.#releaseLease = null;
  }

  #tryAcquire(clientId: string, rotate: () => string, rotations: number): void {
    const lockManager = this.#lockManager;
    if (!lockManager) {
      this.#fail("TAB_COORDINATION_UNAVAILABLE");
      return;
    }
    void lockManager.request(
      `${LOCK_PREFIX}${clientId}`,
      { mode: "exclusive", ifAvailable: true },
      (lock) => {
        if (this.#closed) return;
        if (lock === null) {
          if (rotations >= MAX_COLLISION_ROTATIONS) {
            this.#fail("TAB_COORDINATION_FAILED");
            return;
          }
          let rotated: string;
          try {
            rotated = rotate();
          } catch {
            this.#fail("TAB_COORDINATION_FAILED");
            return;
          }
          if (!isUuid(rotated) || rotated === clientId) {
            this.#fail("TAB_COORDINATION_FAILED");
            return;
          }
          this.#clientId = rotated;
          this.#tryAcquire(rotated, rotate, rotations + 1);
          return;
        }

        this.#clientId = clientId;
        const lease = new Promise<void>((resolve) => { this.#releaseLease = resolve; });
        this.#resolveReady?.();
        return lease;
      }
    ).catch(() => { this.#fail("TAB_COORDINATION_FAILED"); });
  }

  #fail(code: string): void {
    if (this.#fatal || this.#closed) return;
    const error = new MarketTabCoordinationError(code);
    this.#fatal = error;
    this.#rejectReady?.(error);
    this.#releaseLease?.();
    this.#releaseLease = null;
    this.#channel?.close();
  }
}
