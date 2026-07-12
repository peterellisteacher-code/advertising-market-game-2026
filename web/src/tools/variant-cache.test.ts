import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ZoneStyles } from "./masked-variant-renderer";
import {
  VARIANT_CACHE_LIMIT,
  VariantObjectUrlCache,
  canonicalVariantIdentity,
  createVariantCacheKey,
  type ObjectUrlPort,
  type Sha256Port,
  type VariantAssetVersion
} from "./variant-cache";

const stylesA: ZoneStyles = {
  trim: { colour: "#222222", materialId: "rubber", opacity: 0.75 },
  body: { colour: "#eeeeee", materialId: "matte-plastic", opacity: 1 }
};

const stylesB: ZoneStyles = {
  body: { opacity: 1, materialId: "matte-plastic", colour: "#eeeeee" },
  trim: { opacity: 0.75, colour: "#222222", materialId: "rubber" }
};

const asset = (version: number, assetId = "product-1"): VariantAssetVersion => ({ assetId, version });
const SHA256 = webcrypto.subtle as unknown as Sha256Port;

function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T | PromiseLike<T>): void;
  reject(reason?: unknown): void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function labelledBlob(label: string): Blob {
  return Object.assign(new Blob([label], { type: "image/png" }), { diagnosticLabel: label });
}

function objectUrls(): { port: ObjectUrlPort; created: string[]; revoked: string[] } {
  const created: string[] = [];
  const revoked: string[] = [];
  return {
    created,
    revoked,
    port: {
      createObjectURL(blob) {
        const label = (blob as Blob & { diagnosticLabel?: string }).diagnosticLabel;
        const url = label ? `blob:${label}` : `blob:variant-${created.length + 1}`;
        created.push(url);
        return url;
      },
      revokeObjectURL(url) {
        revoked.push(url);
      }
    }
  };
}

describe("variant cache keys", () => {
  it("hashes asset identity and fixed-order zone styles as UTF-8 SHA-256", async () => {
    const identity = asset(7, "café-bottle");
    expect(canonicalVariantIdentity(identity, stylesA)).toBe(
      '{"assetId":"café-bottle","version":7,"styles":{"body":{"colour":"#eeeeee","materialId":"matte-plastic","opacity":1},"trim":{"colour":"#222222","materialId":"rubber","opacity":0.75}}}'
    );

    const first = await createVariantCacheKey(identity, stylesA, SHA256);
    const reordered = await createVariantCacheKey(identity, stylesB, SHA256);
    const newVersion = await createVariantCacheKey(asset(8, "café-bottle"), stylesA, SHA256);
    const newAsset = await createVariantCacheKey(asset(7, "café-cup"), stylesA, SHA256);

    expect(first).toBe("22533579031406ef58b94a53420b7b4c8b6817c9b330dba68136ac1462bae2b1");
    expect(reordered).toBe(first);
    expect(newVersion).not.toBe(first);
    expect(newAsset).not.toBe(first);
  });
});

describe("VariantObjectUrlCache", () => {
  it("deduplicates concurrent same-key renders and retries after failure", async () => {
    const urls = objectUrls();
    const cache = new VariantObjectUrlCache(urls.port, SHA256);
    let renders = 0;
    const rendering = deferred<Blob>();
    const firstPromise = cache.acquire(asset(1), stylesA, () => {
      renders += 1;
      return rendering.promise;
    });
    const secondPromise = cache.acquire(asset(1), stylesB, () => {
      renders += 1;
      return Promise.resolve(labelledBlob("duplicate"));
    });
    rendering.resolve(labelledBlob("shared"));

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(renders).toBe(1);
    expect(first.url).toBe("blob:shared");
    expect(second.url).toBe(first.url);
    first.release();
    second.release();

    let retries = 0;
    await expect(cache.acquire(asset(2), stylesA, async () => {
      retries += 1;
      throw new Error("render failed");
    })).rejects.toThrow("render failed");
    const retried = await cache.acquire(asset(2), stylesA, async () => {
      retries += 1;
      return labelledBlob("retry");
    });
    expect(retries).toBe(2);
    expect(retried.url).toBe("blob:retry");
    retried.release();
  });

  it("keeps out-of-order distinct renders attached to their own keys", async () => {
    const urls = objectUrls();
    const cache = new VariantObjectUrlCache(urls.port, SHA256);
    const slow = deferred<Blob>();
    const fast = deferred<Blob>();
    const slowLease = cache.acquire(asset(1, "slow"), stylesA, () => slow.promise);
    const fastLease = cache.acquire(asset(1, "fast"), stylesA, () => fast.promise);

    fast.resolve(labelledBlob("fast"));
    slow.resolve(labelledBlob("slow"));

    const [slowResult, fastResult] = await Promise.all([slowLease, fastLease]);
    expect(slowResult.url).toBe("blob:slow");
    expect(fastResult.url).toBe("blob:fast");
    slowResult.release();
    fastResult.release();
  });

  it("keeps exactly 48 variants, touches hits, and evicts the least-recently-used URL", async () => {
    const urls = objectUrls();
    const cache = new VariantObjectUrlCache(urls.port, SHA256);
    expect(VARIANT_CACHE_LIMIT).toBe(48);

    for (let version = 1; version <= VARIANT_CACHE_LIMIT; version += 1) {
      const lease = await cache.acquire(asset(version), stylesA, async () => new Blob([String(version)]));
      lease.release();
    }
    const touched = await cache.acquire(asset(1), stylesA, async () => {
      throw new Error("A cache hit must not render");
    });
    expect(touched.url).toBe("blob:variant-1");
    touched.release();

    const next = await cache.acquire(asset(VARIANT_CACHE_LIMIT + 1), stylesA, async () => new Blob(["next"]));
    next.release();

    expect(cache.size).toBe(VARIANT_CACHE_LIMIT);
    expect(urls.revoked).toEqual(["blob:variant-2"]);
    const stillCached = await cache.acquire(asset(1), stylesA, async () => {
      throw new Error("Touched entry was evicted");
    });
    expect(stillCached.url).toBe("blob:variant-1");
    stillCached.release();
  });

  it("defers revocation when an evicted or replaced URL is retained by a live consumer", async () => {
    const urls = objectUrls();
    const cache = new VariantObjectUrlCache(urls.port, SHA256);
    const retained = await cache.acquire(asset(1), stylesA, async () => labelledBlob("retained"));
    for (let version = 2; version <= VARIANT_CACHE_LIMIT + 1; version += 1) {
      const lease = await cache.acquire(asset(version), stylesA, async () => labelledBlob(`version-${version}`));
      lease.release();
    }

    expect(cache.size).toBe(VARIANT_CACHE_LIMIT);
    expect(urls.revoked).not.toContain(retained.url);
    retained.release();
    expect(urls.revoked).toContain("blob:retained");

    const oldLease = await cache.acquire(asset(100), stylesA, async () => labelledBlob("old"));
    const replacement = await cache.replace(asset(100), stylesB, labelledBlob("replacement"));

    expect(urls.revoked).not.toContain(oldLease.url);
    expect(urls.revoked).not.toContain(replacement.url);
    oldLease.release();
    expect(urls.revoked).toContain("blob:old");
    replacement.release();
    expect(urls.revoked).not.toContain("blob:replacement");
  });

  it("rejects late render resolution after dispose without leaking or double-revoking a URL", async () => {
    const urls = objectUrls();
    const cache = new VariantObjectUrlCache(urls.port, SHA256);
    const started = deferred<void>();
    const rendering = deferred<Blob>();
    const pending = cache.acquire(asset(1), stylesA, () => {
      started.resolve(undefined);
      return rendering.promise;
    });
    await started.promise;

    cache.dispose();
    rendering.resolve(labelledBlob("late"));

    await expect(pending).rejects.toThrow("disposed");
    cache.dispose();
    expect(urls.created).toEqual([]);
    expect(urls.revoked).toEqual([]);
  });

  it("revokes every unretained cached object URL exactly once on dispose", async () => {
    const urls = objectUrls();
    const cache = new VariantObjectUrlCache(urls.port, SHA256);
    const first = await cache.acquire(asset(1), stylesA, async () => new Blob(["one"]));
    const second = await cache.acquire(asset(2), stylesA, async () => new Blob(["two"]));
    first.release();
    second.release();

    cache.dispose();
    cache.dispose();

    expect(cache.size).toBe(0);
    expect(urls.revoked).toEqual(["blob:variant-1", "blob:variant-2"]);
  });
});
