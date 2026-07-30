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

const stylesUppercase: ZoneStyles = {
  body: { opacity: 1, materialId: "matte-plastic", colour: "#EEEEEE" },
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

function pngBlob(contents: string): Blob {
  return new Blob([contents], { type: "image/png" });
}

function waitForNextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
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

function outOfOrderSameIdentitySha256(): { port: Sha256Port; resolutionOrder: string[] } {
  const releaseFirst = deferred<void>();
  const resolutionOrder: string[] = [];
  let calls = 0;
  return {
    resolutionOrder,
    port: {
      digest(algorithm, data) {
        calls += 1;
        const digest = SHA256.digest(algorithm, data);
        if (calls === 1) {
          return releaseFirst.promise
            .then(() => digest)
            .then((value) => {
              resolutionOrder.push("first");
              return value;
            });
        }
        if (calls === 2) {
          return digest.then((value) => {
            resolutionOrder.push("second");
            queueMicrotask(() => queueMicrotask(() => releaseFirst.resolve(undefined)));
            return value;
          });
        }
        return digest;
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
    const uppercase = await createVariantCacheKey(identity, stylesUppercase, SHA256);
    const newVersion = await createVariantCacheKey(asset(8, "café-bottle"), stylesA, SHA256);
    const newAsset = await createVariantCacheKey(asset(7, "café-cup"), stylesA, SHA256);

    expect(first).toBe("22533579031406ef58b94a53420b7b4c8b6817c9b330dba68136ac1462bae2b1");
    expect(reordered).toBe(first);
    expect(uppercase).toBe(first);
    expect(newVersion).not.toBe(first);
    expect(newAsset).not.toBe(first);
  });
});

describe("VariantObjectUrlCache", () => {
  it.each([
    ["a non-Blob value", "not-a-blob" as unknown as Blob],
    ["an empty PNG", new Blob([], { type: "image/png" })],
    ["the wrong MIME type", new Blob(["pixels"], { type: "image/jpeg" })]
  ])("rejects %s before creating a cache URL", async (_label, renderedValue) => {
    const urls = objectUrls();
    const cache = new VariantObjectUrlCache(urls.port, SHA256);

    await expect(cache.acquire(asset(1), stylesA, async () => renderedValue))
      .rejects.toThrow("non-empty image/png Blob");

    expect(cache.size).toBe(0);
    expect(urls.created).toEqual([]);
  });

  it("gives the first same-identity caller render ownership when its digest resolves second", async () => {
    const urls = objectUrls();
    const sha256 = outOfOrderSameIdentitySha256();
    const cache = new VariantObjectUrlCache(urls.port, sha256.port);
    let renders = 0;
    const firstPromise = cache.acquire(asset(1), stylesA, async () => {
      renders += 1;
      return labelledBlob("shared");
    });
    const secondPromise = cache.acquire(asset(1), stylesB, async () => {
      renders += 1;
      return labelledBlob("duplicate");
    });

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(sha256.resolutionOrder).toEqual(["second", "first"]);
    expect(renders).toBe(1);
    expect(first.url).toBe("blob:shared");
    expect(second.url).toBe(first.url);

    const replacement = await cache.replace(asset(1), stylesB, labelledBlob("replacement"));
    expect(urls.revoked).toEqual([]);
    first.release();
    expect(urls.revoked).toEqual([]);
    second.release();
    expect(urls.revoked).toEqual(["blob:shared"]);
    replacement.release();

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

  it("waits for a coalesced follower that is still hashing before replacing", async () => {
    const urls = objectUrls();
    const followerDigestStarted = deferred<void>();
    const releaseFollowerDigest = deferred<void>();
    let digestCalls = 0;
    const sha256: Sha256Port = {
      digest(algorithm, data) {
        digestCalls += 1;
        const digest = SHA256.digest(algorithm, data);
        if (digestCalls === 2) {
          followerDigestStarted.resolve(undefined);
          return releaseFollowerDigest.promise.then(() => digest);
        }
        return digest;
      }
    };
    const cache = new VariantObjectUrlCache(urls.port, sha256);
    const leaderRenderStarted = deferred<void>();
    const leaderRender = deferred<Blob>();
    const leading = cache.acquire(asset(19), stylesA, () => {
      leaderRenderStarted.resolve(undefined);
      return leaderRender.promise;
    });
    await leaderRenderStarted.promise;

    const following = cache.acquire(asset(19), stylesB, async () => labelledBlob("duplicate"));
    await followerDigestStarted.promise;
    leaderRender.resolve(labelledBlob("leader"));
    const leader = await leading;

    let replacementSettled = false;
    const replacing = cache.replace(asset(19), stylesA, labelledBlob("replacement"))
      .then((lease) => {
        replacementSettled = true;
        return lease;
      });
    await waitForNextTask();
    const replacementSettledBeforeFollower = replacementSettled;
    releaseFollowerDigest.resolve(undefined);

    const [follower, replacement] = await Promise.all([following, replacing]);
    const current = await cache.acquire(asset(19), stylesA, async () => {
      throw new Error("Replacement did not remain cached");
    });
    expect(replacementSettledBeforeFollower).toBe(false);
    expect(urls.created).toEqual(["blob:leader", "blob:replacement"]);
    expect(leader.url).toBe("blob:leader");
    expect(follower.url).toBe(leader.url);
    expect(current.url).toBe(replacement.url);
    expect(urls.revoked).toEqual([]);

    leader.release();
    expect(urls.revoked).toEqual([]);
    follower.release();
    expect(urls.revoked).toEqual(["blob:leader"]);
    replacement.release();
    current.release();
    cache.dispose();
    expect(urls.revoked).toEqual(["blob:leader", "blob:replacement"]);
  });

  it.each(["hashing", "rendering"] as const)(
    "waits for a same-identity acquire that is still %s before replacing it",
    async (phase) => {
      const urls = objectUrls();
      const phaseReached = deferred<void>();
      const releaseAcquire = deferred<void>();
      let digestCalls = 0;
      const sha256: Sha256Port = {
        digest() {
          digestCalls += 1;
          if (phase === "hashing" && digestCalls === 1) {
            phaseReached.resolve(undefined);
            return releaseAcquire.promise.then(() => new ArrayBuffer(32));
          }
          return Promise.resolve(new ArrayBuffer(32));
        }
      };
      const cache = new VariantObjectUrlCache(urls.port, sha256);
      const acquiring = cache.acquire(asset(20), stylesA, async () => {
        if (phase === "rendering") {
          phaseReached.resolve(undefined);
          await releaseAcquire.promise;
        }
        return labelledBlob("rendered");
      });
      await phaseReached.promise;

      const replacing = cache.replace(asset(20), stylesB, labelledBlob("replacement"));
      await waitForNextTask();
      expect(urls.created).toEqual([]);

      releaseAcquire.resolve(undefined);
      const [rendered, replacement] = await Promise.all([acquiring, replacing]);
      expect(urls.created).toEqual(["blob:rendered", "blob:replacement"]);
      expect(rendered.url).toBe("blob:rendered");
      expect(replacement.url).toBe("blob:replacement");
      rendered.release();
      expect(urls.revoked).toEqual(["blob:rendered"]);
      replacement.release();
      cache.dispose();
      expect(urls.revoked).toEqual(["blob:rendered", "blob:replacement"]);
    }
  );

  it("closes an identity before replacement hashing so a later acquire uses the replacement", async () => {
    const urls = objectUrls();
    const replaceDigestStarted = deferred<void>();
    const releaseReplaceDigest = deferred<void>();
    let digestCalls = 0;
    const sha256: Sha256Port = {
      digest() {
        digestCalls += 1;
        if (digestCalls === 1) {
          replaceDigestStarted.resolve(undefined);
          return releaseReplaceDigest.promise.then(() => new ArrayBuffer(32));
        }
        return Promise.resolve(new ArrayBuffer(32));
      }
    };
    const cache = new VariantObjectUrlCache(urls.port, sha256);
    const replacing = cache.replace(asset(21), stylesA, labelledBlob("replacement"));
    await replaceDigestStarted.promise;
    let renders = 0;
    const acquiring = cache.acquire(asset(21), stylesB, async () => {
      renders += 1;
      return labelledBlob("rendered");
    });
    expect(digestCalls).toBe(1);
    expect(renders).toBe(0);
    releaseReplaceDigest.resolve(undefined);

    const [replacement, acquired] = await Promise.all([replacing, acquiring]);
    expect(renders).toBe(0);
    expect(urls.created).toEqual(["blob:replacement"]);
    expect(acquired.url).toBe(replacement.url);
    expect(urls.revoked).toEqual([]);

    replacement.release();
    acquired.release();
    expect(urls.revoked).toEqual([]);
    cache.dispose();
    expect(urls.revoked).toEqual(["blob:replacement"]);
  });

  it("snapshots the canonical replacement identity before yielding", async () => {
    const urls = objectUrls();
    const cache = new VariantObjectUrlCache(urls.port, SHA256);
    const mutableStyles: ZoneStyles = {
      body: { ...stylesA.body! },
      trim: { ...stylesA.trim! }
    };
    const originalStyles: ZoneStyles = {
      body: { ...stylesA.body! },
      trim: { ...stylesA.trim! }
    };

    const replacing = cache.replace(asset(25), mutableStyles, labelledBlob("replacement"));
    mutableStyles.body!.colour = "#101010";
    let renders = 0;
    const acquiring = cache.acquire(asset(25), originalStyles, async () => {
      renders += 1;
      return labelledBlob("unexpected-render");
    });

    const [replacement, acquired] = await Promise.all([replacing, acquiring]);
    expect(renders).toBe(0);
    expect(urls.created).toEqual(["blob:replacement"]);
    expect(acquired.url).toBe(replacement.url);

    replacement.release();
    acquired.release();
    cache.dispose();
    expect(urls.revoked).toEqual(["blob:replacement"]);
  });

  it("snapshots an acquire identity before waiting behind a replacement gate", async () => {
    const urls = objectUrls();
    const replaceDigestStarted = deferred<void>();
    const releaseReplaceDigest = deferred<void>();
    let digestCalls = 0;
    const sha256: Sha256Port = {
      digest(algorithm, data) {
        digestCalls += 1;
        const digest = SHA256.digest(algorithm, data);
        if (digestCalls === 1) {
          replaceDigestStarted.resolve(undefined);
          return releaseReplaceDigest.promise.then(() => digest);
        }
        return digest;
      }
    };
    const cache = new VariantObjectUrlCache(urls.port, sha256);
    const mutableStyles: ZoneStyles = {
      body: { ...stylesA.body! },
      trim: { ...stylesA.trim! }
    };
    const replacing = cache.replace(asset(29), stylesA, labelledBlob("replacement"));
    await replaceDigestStarted.promise;

    let renders = 0;
    const acquiring = cache.acquire(asset(29), mutableStyles, async () => {
      renders += 1;
      return labelledBlob("unexpected-render");
    });
    expect(digestCalls).toBe(1);
    mutableStyles.body!.colour = "#101010";
    releaseReplaceDigest.resolve(undefined);

    const [replacement, acquired] = await Promise.all([replacing, acquiring]);
    expect(renders).toBe(0);
    expect(urls.created).toEqual(["blob:replacement"]);
    expect(acquired.url).toBe(replacement.url);

    replacement.release();
    acquired.release();
    cache.dispose();
    expect(urls.revoked).toEqual(["blob:replacement"]);
  });

  it("keeps a createObjectURL re-entrant acquire behind the replacement gate", async () => {
    const urls = objectUrls();
    let digestCalls = 0;
    const sha256: Sha256Port = {
      digest(algorithm, data) {
        digestCalls += 1;
        return SHA256.digest(algorithm, data);
      }
    };
    let cache!: VariantObjectUrlCache;
    let reentrantAcquire: Promise<Awaited<ReturnType<VariantObjectUrlCache["acquire"]>>> | undefined;
    let digestCallsDuringCreate = -1;
    let renders = 0;
    const port: ObjectUrlPort = {
      createObjectURL(blob) {
        const url = urls.port.createObjectURL(blob);
        reentrantAcquire = cache.acquire(asset(22), stylesB, async () => {
          renders += 1;
          return labelledBlob("reentrant-render");
        });
        digestCallsDuringCreate = digestCalls;
        return url;
      },
      revokeObjectURL: (url) => urls.port.revokeObjectURL(url)
    };
    cache = new VariantObjectUrlCache(port, sha256);

    const replacement = await cache.replace(asset(22), stylesA, labelledBlob("replacement"));
    const acquired = await reentrantAcquire!;

    expect(digestCallsDuringCreate).toBe(1);
    expect(digestCalls).toBe(2);
    expect(renders).toBe(0);
    expect(urls.created).toEqual(["blob:replacement"]);
    expect(acquired.url).toBe(replacement.url);

    replacement.release();
    acquired.release();
    cache.dispose();
    expect(urls.revoked).toEqual(["blob:replacement"]);
  });

  it("does not block a different identity while a replacement gate is closed", async () => {
    const urls = objectUrls();
    const replaceDigestStarted = deferred<void>();
    const releaseReplaceDigest = deferred<void>();
    let digestCalls = 0;
    const sha256: Sha256Port = {
      digest() {
        digestCalls += 1;
        if (digestCalls === 1) {
          replaceDigestStarted.resolve(undefined);
          return releaseReplaceDigest.promise.then(() => new ArrayBuffer(32));
        }
        return Promise.resolve(new ArrayBuffer(32));
      }
    };
    const cache = new VariantObjectUrlCache(urls.port, sha256);
    let replacementSettled = false;
    const replacing = cache.replace(
      asset(23, "blocked-product"),
      stylesA,
      labelledBlob("replacement")
    ).then((lease) => {
      replacementSettled = true;
      return lease;
    });
    await replaceDigestStarted.promise;

    const unrelated = await cache.acquire(
      asset(23, "unrelated-product"),
      stylesA,
      async () => labelledBlob("unrelated")
    );

    expect(replacementSettled).toBe(false);
    expect(unrelated.url).toBe("blob:unrelated");
    expect(urls.created).toEqual(["blob:unrelated"]);

    releaseReplaceDigest.resolve(undefined);
    const replacement = await replacing;
    expect(replacement.url).toBe("blob:replacement");
    expect(urls.created).toEqual(["blob:unrelated", "blob:replacement"]);

    unrelated.release();
    replacement.release();
    cache.dispose();
    expect(urls.revoked).toEqual(["blob:unrelated", "blob:replacement"]);
  });

  it("queues same-identity replacements in call order and admits acquires to the last result", async () => {
    const urls = objectUrls();
    const firstDigestStarted = deferred<void>();
    const releaseFirstDigest = deferred<void>();
    let digestCalls = 0;
    const sha256: Sha256Port = {
      digest() {
        digestCalls += 1;
        if (digestCalls === 1) {
          firstDigestStarted.resolve(undefined);
          return releaseFirstDigest.promise.then(() => new ArrayBuffer(32));
        }
        return Promise.resolve(new ArrayBuffer(32));
      }
    };
    const cache = new VariantObjectUrlCache(urls.port, sha256);
    const firstReplacing = cache.replace(asset(24), stylesA, labelledBlob("first-replacement"));
    await firstDigestStarted.promise;
    const secondReplacing = cache.replace(asset(24), stylesB, labelledBlob("second-replacement"));
    let renders = 0;
    const acquiring = cache.acquire(asset(24), stylesA, async () => {
      renders += 1;
      return labelledBlob("unexpected-render");
    });
    expect(digestCalls).toBe(1);
    expect(urls.created).toEqual([]);

    releaseFirstDigest.resolve(undefined);
    const [first, second, acquired] = await Promise.all([
      firstReplacing,
      secondReplacing,
      acquiring
    ]);

    expect(urls.created).toEqual(["blob:first-replacement", "blob:second-replacement"]);
    expect(first.url).toBe("blob:first-replacement");
    expect(second.url).toBe("blob:second-replacement");
    expect(acquired.url).toBe(second.url);
    expect(renders).toBe(0);
    expect(urls.revoked).toEqual([]);

    first.release();
    expect(urls.revoked).toEqual(["blob:first-replacement"]);
    second.release();
    acquired.release();
    cache.dispose();
    expect(urls.revoked).toEqual(["blob:first-replacement", "blob:second-replacement"]);
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
      const lease = await cache.acquire(asset(version), stylesA, async () => pngBlob(String(version)));
      lease.release();
    }
    const touched = await cache.acquire(asset(1), stylesA, async () => {
      throw new Error("A cache hit must not render");
    });
    expect(touched.url).toBe("blob:variant-1");
    touched.release();

    const next = await cache.acquire(asset(VARIANT_CACHE_LIMIT + 1), stylesA, async () => pngBlob("next"));
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

  it.each([
    ["a non-Blob value", "not-a-blob" as unknown as Blob],
    ["an empty PNG", new Blob([], { type: "image/png" })],
    ["the wrong MIME type", new Blob(["pixels"], { type: "image/jpeg" })]
  ])("keeps the old entry usable when replacement receives %s", async (_label, replacementValue) => {
    const urls = objectUrls();
    const cache = new VariantObjectUrlCache(urls.port, SHA256);
    const oldLease = await cache.acquire(asset(1), stylesA, async () => labelledBlob("old"));

    await expect(cache.replace(asset(1), stylesB, replacementValue))
      .rejects.toThrow("non-empty image/png Blob");
    const reused = await cache.acquire(asset(1), stylesA, async () => {
      throw new Error("Failed replacement detached the old entry");
    });

    expect(reused.url).toBe(oldLease.url);
    expect(urls.revoked).toEqual([]);
    reused.release();
    oldLease.release();
  });

  it("keeps the old entry usable when replacement URL creation throws", async () => {
    const urls = objectUrls();
    let failCreation = false;
    const port: ObjectUrlPort = {
      createObjectURL(blob) {
        if (failCreation) throw new Error("URL creation failed");
        return urls.port.createObjectURL(blob);
      },
      revokeObjectURL: (url) => urls.port.revokeObjectURL(url)
    };
    const cache = new VariantObjectUrlCache(port, SHA256);
    const oldLease = await cache.acquire(asset(1), stylesA, async () => labelledBlob("old"));

    failCreation = true;
    await expect(cache.replace(asset(1), stylesB, labelledBlob("new")))
      .rejects.toThrow("URL creation failed");
    failCreation = false;
    const reused = await cache.acquire(asset(1), stylesA, async () => {
      throw new Error("Failed URL creation detached the old entry");
    });

    expect(reused.url).toBe(oldLease.url);
    expect(urls.revoked).toEqual([]);
    reused.release();
    oldLease.release();
  });

  it("does not orphan a committed replacement when old-URL revocation throws", async () => {
    const urls = objectUrls();
    const port: ObjectUrlPort = {
      createObjectURL: (blob) => urls.port.createObjectURL(blob),
      revokeObjectURL(url) {
        urls.port.revokeObjectURL(url);
        if (url === "blob:old") throw new Error("revocation failed");
      }
    };
    const cache = new VariantObjectUrlCache(port, SHA256);
    const old = await cache.acquire(asset(26), stylesA, async () => labelledBlob("old"));
    old.release();

    const replacement = await cache.replace(asset(26), stylesA, labelledBlob("replacement"));
    const current = await cache.acquire(asset(26), stylesB, async () => {
      throw new Error("Committed replacement was not reusable");
    });

    expect(current.url).toBe(replacement.url);
    expect(urls.revoked).toEqual(["blob:old"]);
    replacement.release();
    current.release();
    cache.dispose();
    expect(urls.revoked).toEqual(["blob:old", "blob:replacement"]);
  });

  it("finishes disposing every entry when individual URL revocations throw", async () => {
    const urls = objectUrls();
    const attempted: string[] = [];
    const port: ObjectUrlPort = {
      createObjectURL: (blob) => urls.port.createObjectURL(blob),
      revokeObjectURL(url) {
        attempted.push(url);
        throw new Error(`Could not revoke ${url}`);
      }
    };
    const cache = new VariantObjectUrlCache(port, SHA256);
    const first = await cache.acquire(asset(27), stylesA, async () => labelledBlob("first"));
    const second = await cache.acquire(asset(28), stylesA, async () => labelledBlob("second"));
    first.release();
    second.release();

    expect(() => cache.dispose()).not.toThrow();
    expect(cache.size).toBe(0);
    expect(attempted).toEqual(["blob:first", "blob:second"]);
    cache.dispose();
    expect(attempted).toEqual(["blob:first", "blob:second"]);
  });

  it("rejects and revokes a replacement URL when URL creation disposes the cache", async () => {
    const urls = objectUrls();
    let cache!: VariantObjectUrlCache;
    const port: ObjectUrlPort = {
      createObjectURL(blob) {
        const url = urls.port.createObjectURL(blob);
        cache.dispose();
        return url;
      },
      revokeObjectURL: (url) => urls.port.revokeObjectURL(url)
    };
    cache = new VariantObjectUrlCache(port, SHA256);

    await expect(cache.replace(asset(1), stylesA, labelledBlob("replacement")))
      .rejects.toThrow("disposed");
    expect(cache.size).toBe(0);
    expect(urls.created).toEqual(["blob:replacement"]);
    expect(urls.revoked).toEqual(["blob:replacement"]);
    cache.dispose();
    expect(urls.revoked).toEqual(["blob:replacement"]);
    await expect(cache.acquire(asset(1), stylesA, async () => labelledBlob("resurrected")))
      .rejects.toThrow("disposed");
  });

  it("refreshes a successful replacement to the most-recently-used position", async () => {
    const urls = objectUrls();
    const cache = new VariantObjectUrlCache(urls.port, SHA256);
    for (let version = 1; version <= VARIANT_CACHE_LIMIT; version += 1) {
      const lease = await cache.acquire(asset(version), stylesA, async () => pngBlob(String(version)));
      lease.release();
    }

    const replacement = await cache.replace(asset(1), stylesB, pngBlob("replacement"));
    replacement.release();
    const next = await cache.acquire(
      asset(VARIANT_CACHE_LIMIT + 1),
      stylesA,
      async () => pngBlob("next")
    );
    next.release();

    expect(urls.revoked).toEqual(["blob:variant-1", "blob:variant-2"]);
    const stillCached = await cache.acquire(asset(1), stylesA, async () => {
      throw new Error("Replacement remained in the least-recently-used position");
    });
    expect(stillCached.url).toBe("blob:variant-49");
    stillCached.release();
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
    const first = await cache.acquire(asset(1), stylesA, async () => pngBlob("one"));
    const second = await cache.acquire(asset(2), stylesA, async () => pngBlob("two"));
    first.release();
    second.release();

    cache.dispose();
    cache.dispose();

    expect(cache.size).toBe(0);
    expect(urls.revoked).toEqual(["blob:variant-1", "blob:variant-2"]);
  });
});
