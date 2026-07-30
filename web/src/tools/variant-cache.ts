import type { RecolourZone } from "../catalogue/catalogue-types";
import { assertUsablePngBlob, type ZoneStyles } from "./masked-variant-renderer";

export const VARIANT_CACHE_LIMIT = 48;
const ZONE_ORDER: readonly RecolourZone[] = ["body", "trim", "accent", "label"];

export interface VariantAssetVersion {
  assetId: string;
  version: number;
}

export interface ObjectUrlPort {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export interface Sha256Port {
  digest(algorithm: "SHA-256", data: BufferSource): Promise<ArrayBuffer>;
}

export interface VariantUrlLease {
  readonly url: string;
  release(): void;
}

interface CacheEntry {
  readonly key: string;
  readonly url: string;
  retainCount: number;
  detached: boolean;
  revoked: boolean;
}

interface PendingEntry {
  promise: Promise<CacheEntry>;
  waiters: number;
}

interface IdentityPendingEntry extends PendingEntry {
  entry?: CacheEntry;
}

interface IdentityOperation {
  readonly promise: Promise<void>;
  finish(): void;
}

interface IdentityReplacementTurn {
  readonly ready: Promise<void>;
  finish(): void;
}

const browserObjectUrls: ObjectUrlPort = {
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url)
};

function browserSha256(): Sha256Port {
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto SHA-256 is unavailable");
  return globalThis.crypto.subtle;
}

function validateIdentity(identity: VariantAssetVersion): void {
  if (!identity.assetId.trim()) throw new Error("Variant assetId must not be empty");
  if (!Number.isSafeInteger(identity.version) || identity.version <= 0) {
    throw new Error("Variant version must be a positive safe integer");
  }
}

export function canonicalVariantIdentity(identity: VariantAssetVersion, styles: ZoneStyles): string {
  validateIdentity(identity);
  const sortedStyles: Record<string, { colour: string; materialId: string; opacity: number }> = {};
  for (const zone of ZONE_ORDER) {
    const style = styles[zone];
    if (!style) continue;
    sortedStyles[zone] = {
      colour: style.colour.toLowerCase(),
      materialId: style.materialId,
      opacity: style.opacity
    };
  }
  return JSON.stringify({ assetId: identity.assetId, version: identity.version, styles: sortedStyles });
}

async function hashCanonicalVariantIdentity(
  canonicalIdentity: string,
  sha256: Sha256Port
): Promise<string> {
  const encoded = new TextEncoder().encode(canonicalIdentity);
  const digest = await sha256.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function createVariantCacheKey(
  identity: VariantAssetVersion,
  styles: ZoneStyles,
  sha256: Sha256Port = browserSha256()
): Promise<string> {
  return hashCanonicalVariantIdentity(canonicalVariantIdentity(identity, styles), sha256);
}

export class VariantObjectUrlCache {
  readonly #entries = new Map<string, CacheEntry>();
  readonly #pending = new Map<string, PendingEntry>();
  readonly #identityPending = new Map<string, IdentityPendingEntry>();
  readonly #identityOperations = new Map<string, Set<IdentityOperation>>();
  readonly #identityReplacementTails = new Map<string, Promise<void>>();
  readonly #objectUrls: ObjectUrlPort;
  readonly #sha256: Sha256Port;
  #disposed = false;

  constructor(
    objectUrls: ObjectUrlPort = browserObjectUrls,
    sha256: Sha256Port = browserSha256()
  ) {
    this.#objectUrls = objectUrls;
    this.#sha256 = sha256;
  }

  get size(): number {
    return this.#entries.size;
  }

  async acquire(
    identity: VariantAssetVersion,
    styles: ZoneStyles,
    render: () => Promise<Blob>
  ): Promise<VariantUrlLease> {
    this.#assertActive();
    const canonicalIdentity = canonicalVariantIdentity(identity, styles);
    while (true) {
      const replacementTail = this.#identityReplacementTails.get(canonicalIdentity);
      if (!replacementTail) break;
      await replacementTail;
      this.#assertActive();
    }
    const operation = this.#startIdentityOperation(canonicalIdentity);
    try {
      const alreadyPendingIdentity = this.#identityPending.get(canonicalIdentity);
      if (alreadyPendingIdentity) {
        this.#reserveIdentityWaiter(alreadyPendingIdentity);
        try {
          await hashCanonicalVariantIdentity(canonicalIdentity, this.#sha256);
          this.#assertActive();
          return this.#lease(await alreadyPendingIdentity.promise);
        } catch (error) {
          this.#cancelIdentityWaiter(alreadyPendingIdentity);
          throw error;
        }
      }

      const pendingIdentity: IdentityPendingEntry = {
        waiters: 1,
        promise: Promise.resolve(undefined as never)
      };
      this.#identityPending.set(canonicalIdentity, pendingIdentity);
      pendingIdentity.promise = this.#acquireEntry(canonicalIdentity, render).then((entry) => {
        entry.retainCount += pendingIdentity.waiters - 1;
        pendingIdentity.entry = entry;
        return entry;
      });
      try {
        return this.#lease(await pendingIdentity.promise);
      } finally {
        if (this.#identityPending.get(canonicalIdentity) === pendingIdentity) {
          this.#identityPending.delete(canonicalIdentity);
        }
      }
    } finally {
      operation.finish();
    }
  }

  async #acquireEntry(
    canonicalIdentity: string,
    render: () => Promise<Blob>
  ): Promise<CacheEntry> {
    const key = await hashCanonicalVariantIdentity(canonicalIdentity, this.#sha256);
    this.#assertActive();
    const cached = this.#entries.get(key);
    if (cached) {
      cached.retainCount += 1;
      this.#touch(key, cached);
      return cached;
    }

    const alreadyPending = this.#pending.get(key);
    if (alreadyPending) {
      alreadyPending.waiters += 1;
      return await alreadyPending.promise;
    }

    const pending: PendingEntry = {
      waiters: 1,
      promise: Promise.resolve(undefined as never)
    };
    pending.promise = Promise.resolve()
      .then(render)
      .then((blob) => {
        this.#assertActive();
        assertUsablePngBlob(blob);
        const entry: CacheEntry = {
          key,
          url: this.#objectUrls.createObjectURL(blob),
          retainCount: pending.waiters,
          detached: false,
          revoked: false
        };
        if (this.#disposed) {
          this.#revoke(entry);
          throw new Error("Variant cache is disposed");
        }
        this.#entries.set(key, entry);
        this.#evictOverflow();
        return entry;
      });
    this.#pending.set(key, pending);
    try {
      return await pending.promise;
    } finally {
      if (this.#pending.get(key) === pending) this.#pending.delete(key);
    }
  }

  async replace(
    identity: VariantAssetVersion,
    styles: ZoneStyles,
    blob: Blob
  ): Promise<VariantUrlLease> {
    this.#assertActive();
    const canonicalIdentity = canonicalVariantIdentity(identity, styles);
    const replacementTurn = this.#queueIdentityReplacement(canonicalIdentity);
    try {
      await replacementTurn.ready;
      this.#assertActive();
      const key = await hashCanonicalVariantIdentity(canonicalIdentity, this.#sha256);
      this.#assertActive();
      const awaited = new Set<Promise<unknown>>();
      while (true) {
        const pending = [
          this.#identityOperations.get(canonicalIdentity)?.values().next().value?.promise,
          this.#pending.get(key)?.promise
        ].find((candidate) => candidate && !awaited.has(candidate));
        if (!pending) break;
        awaited.add(pending);
        try {
          await pending;
        } catch {
          // A failed in-flight render does not prevent an explicit replacement.
        }
        this.#assertActive();
      }
      assertUsablePngBlob(blob);
      const url = this.#objectUrls.createObjectURL(blob);
      const existing = this.#entries.get(key);
      const entry: CacheEntry = {
        key,
        url,
        retainCount: 1,
        detached: false,
        revoked: false
      };
      if (this.#disposed) {
        this.#revoke(entry);
        throw new Error("Variant cache is disposed");
      }
      if (existing) this.#entries.delete(key);
      this.#entries.set(key, entry);
      if (existing) this.#detach(existing);
      this.#evictOverflow();
      return this.#lease(entry);
    } finally {
      replacementTurn.finish();
    }
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const entry of this.#entries.values()) this.#detach(entry);
    this.#entries.clear();
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error("Variant cache is disposed");
  }

  #touch(key: string, entry: CacheEntry): void {
    this.#entries.delete(key);
    this.#entries.set(key, entry);
  }

  #startIdentityOperation(canonicalIdentity: string): IdentityOperation {
    let operations = this.#identityOperations.get(canonicalIdentity);
    if (!operations) {
      operations = new Set<IdentityOperation>();
      this.#identityOperations.set(canonicalIdentity, operations);
    }
    let resolve!: () => void;
    let finished = false;
    const promise = new Promise<void>((onResolve) => {
      resolve = onResolve;
    });
    let operation!: IdentityOperation;
    operation = {
      promise,
      finish: () => {
        if (finished) return;
        finished = true;
        operations.delete(operation);
        if (operations.size === 0 && this.#identityOperations.get(canonicalIdentity) === operations) {
          this.#identityOperations.delete(canonicalIdentity);
        }
        resolve();
      }
    };
    operations.add(operation);
    return operation;
  }

  #queueIdentityReplacement(canonicalIdentity: string): IdentityReplacementTurn {
    const ready = this.#identityReplacementTails.get(canonicalIdentity) ?? Promise.resolve();
    let resolve!: () => void;
    let finished = false;
    const completion = new Promise<void>((onResolve) => {
      resolve = onResolve;
    });
    const tail = ready.then(() => completion);
    this.#identityReplacementTails.set(canonicalIdentity, tail);
    void tail.then(() => {
      if (this.#identityReplacementTails.get(canonicalIdentity) === tail) {
        this.#identityReplacementTails.delete(canonicalIdentity);
      }
    });
    return {
      ready,
      finish: () => {
        if (finished) return;
        finished = true;
        resolve();
      }
    };
  }

  #reserveIdentityWaiter(pending: IdentityPendingEntry): void {
    if (pending.entry) pending.entry.retainCount += 1;
    else pending.waiters += 1;
  }

  #cancelIdentityWaiter(pending: IdentityPendingEntry): void {
    if (!pending.entry) {
      pending.waiters = Math.max(0, pending.waiters - 1);
      return;
    }
    pending.entry.retainCount = Math.max(0, pending.entry.retainCount - 1);
    if (pending.entry.detached && pending.entry.retainCount === 0) {
      this.#revoke(pending.entry);
    }
  }

  #lease(entry: CacheEntry): VariantUrlLease {
    let released = false;
    return Object.freeze({
      url: entry.url,
      release: () => {
        if (released) return;
        released = true;
        entry.retainCount = Math.max(0, entry.retainCount - 1);
        if (entry.detached && entry.retainCount === 0) this.#revoke(entry);
      }
    });
  }

  #evictOverflow(): void {
    while (this.#entries.size > VARIANT_CACHE_LIMIT) {
      const oldest = this.#entries.entries().next().value as [string, CacheEntry] | undefined;
      if (!oldest) return;
      this.#entries.delete(oldest[0]);
      this.#detach(oldest[1]);
    }
  }

  #detach(entry: CacheEntry): void {
    if (entry.detached) return;
    entry.detached = true;
    if (entry.retainCount === 0) this.#revoke(entry);
  }

  #revoke(entry: CacheEntry): void {
    if (entry.revoked) return;
    entry.revoked = true;
    try {
      this.#objectUrls.revokeObjectURL(entry.url);
    } catch {
      // Browser revocation is best-effort; adapter failures must not corrupt cache ownership.
    }
  }
}
