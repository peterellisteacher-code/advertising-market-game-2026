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

export async function createVariantCacheKey(
  identity: VariantAssetVersion,
  styles: ZoneStyles,
  sha256: Sha256Port = browserSha256()
): Promise<string> {
  const encoded = new TextEncoder().encode(canonicalVariantIdentity(identity, styles));
  const digest = await sha256.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

export class VariantObjectUrlCache {
  readonly #entries = new Map<string, CacheEntry>();
  readonly #pending = new Map<string, PendingEntry>();
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
    const key = await createVariantCacheKey(identity, styles, this.#sha256);
    this.#assertActive();
    const cached = this.#entries.get(key);
    if (cached) {
      cached.retainCount += 1;
      this.#touch(key, cached);
      return this.#lease(cached);
    }

    const alreadyPending = this.#pending.get(key);
    if (alreadyPending) {
      alreadyPending.waiters += 1;
      return this.#lease(await alreadyPending.promise);
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
      return this.#lease(await pending.promise);
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
    const key = await createVariantCacheKey(identity, styles, this.#sha256);
    this.#assertActive();
    const pending = this.#pending.get(key);
    if (pending) {
      try {
        await pending.promise;
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
    if (existing) this.#entries.delete(key);
    this.#entries.set(key, entry);
    if (existing) this.#detach(existing);
    this.#evictOverflow();
    return this.#lease(entry);
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
    this.#objectUrls.revokeObjectURL(entry.url);
  }
}
