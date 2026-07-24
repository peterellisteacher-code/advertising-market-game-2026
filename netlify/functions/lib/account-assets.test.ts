// @vitest-environment node

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ASSET_SCHEMA,
  ACCOUNT_ASSET_VERSION,
  AccountAssetError,
  AccountAssetService,
  deriveAccountAssetNamespace,
  inspectAccountImage,
  parseAccountAssetEnvironment,
  type AccountAssetBlobMetadata,
  type AccountAssetIndex,
  type AccountAssetRepository
} from "./account-assets";

const USER_A = "b9b32e20-0ba8-4896-b89f-44efdfc52942";
const USER_B = "99250725-52e0-44c9-b569-593167786eaf";
const namespaceSecret = "n".repeat(32);

const environment = {
  SUPABASE_URL: "https://jftpeajvpqmxabuscoml.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: `sb_publishable_${"p".repeat(32)}`,
  ADVERTISING_GAME_EDGE_GATEWAY_SECRET: "g".repeat(43),
  ADVERTISING_GAME_USERNAME_HMAC_SECRET: "h".repeat(32),
  ADVERTISING_GAME_CLASSROOM_CODE: "classroom-access",
  ADVERTISING_GAME_ASSET_NAMESPACE_SECRET: namespaceSecret
};

const pngBytes = (): Uint8Array => Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01
]);

const jpegBytes = (): Uint8Array => Uint8Array.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10,
  0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0xff, 0xd9
]);

const webpBytes = (): Uint8Array => Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x08, 0x00, 0x00, 0x00,
  0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20
]);

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

interface StoredIndex {
  value: AccountAssetIndex;
  etag: number;
}

class MemoryAccountAssetRepository implements AccountAssetRepository {
  readonly indexes = new Map<string, StoredIndex>();
  readonly objects = new Map<string, {
    bytes: Uint8Array;
    metadata: AccountAssetBlobMetadata;
  }>();
  failNextObjectWrite = false;
  readonly deletionLog: string[] = [];

  async readIndex(namespace: string) {
    const entry = this.indexes.get(namespace);
    return entry === undefined
      ? null
      : { value: structuredClone(entry.value), etag: String(entry.etag) };
  }

  async createIndex(namespace: string, value: AccountAssetIndex) {
    if (this.indexes.has(namespace)) return false;
    this.indexes.set(namespace, { value: structuredClone(value), etag: 1 });
    return true;
  }

  async compareAndSwapIndex(namespace: string, value: AccountAssetIndex, etag: string) {
    const entry = this.indexes.get(namespace);
    if (entry === undefined || String(entry.etag) !== etag) return false;
    this.indexes.set(namespace, { value: structuredClone(value), etag: entry.etag + 1 });
    return true;
  }

  async putObject(
    namespace: string,
    digest: string,
    bytes: Uint8Array,
    metadata: AccountAssetBlobMetadata
  ) {
    if (this.failNextObjectWrite) {
      this.failNextObjectWrite = false;
      throw new Error("storage unavailable");
    }
    const key = `${namespace}/${digest}`;
    if (this.objects.has(key)) return false;
    this.objects.set(key, { bytes: bytes.slice(), metadata: structuredClone(metadata) });
    return true;
  }

  async getObject(namespace: string, digest: string) {
    const entry = this.objects.get(`${namespace}/${digest}`);
    return entry === undefined
      ? null
      : { bytes: entry.bytes.slice(), metadata: structuredClone(entry.metadata) };
  }

  async deleteObject(namespace: string, digest: string) {
    this.deletionLog.push(`object:${namespace}:${digest}`);
    this.objects.delete(`${namespace}/${digest}`);
  }

  async deleteIndex(namespace: string) {
    this.deletionLog.push(`index:${namespace}`);
    this.indexes.delete(namespace);
  }
}

describe("account asset environment and namespace", () => {
  it("requires a separate bounded server-only namespace secret", () => {
    expect(parseAccountAssetEnvironment(environment)).toMatchObject({
      supabaseUrl: environment.SUPABASE_URL,
      assetNamespaceSecret: namespaceSecret
    });
    for (const value of [undefined, "short", "x".repeat(257), environment.ADVERTISING_GAME_USERNAME_HMAC_SECRET]) {
      expect(() => parseAccountAssetEnvironment({
        ...environment,
        ADVERTISING_GAME_ASSET_NAMESPACE_SECRET: value
      })).toThrow("Account backend configuration is invalid");
    }
  });

  it("derives a stable non-guessable namespace without embedding the Auth user ID", () => {
    const first = deriveAccountAssetNamespace(USER_A, namespaceSecret);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(first).not.toContain(USER_A);
    expect(deriveAccountAssetNamespace(USER_A, namespaceSecret)).toBe(first);
    expect(deriveAccountAssetNamespace(USER_B, namespaceSecret)).not.toBe(first);
  });
});

describe("account image inspection", () => {
  it.each([
    ["image/png", pngBytes()],
    ["image/jpeg", jpegBytes()],
    ["image/webp", webpBytes()]
  ] as const)("accepts %s only when signature, MIME, size, and hash agree", (contentType, bytes) => {
    expect(inspectAccountImage(bytes, contentType, sha256(bytes), 4 * 1_024 * 1_024)).toEqual({
      sha256: sha256(bytes),
      contentType,
      byteLength: bytes.byteLength
    });
  });

  it("rejects SVG and MIME/signature mismatches", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(() => inspectAccountImage(svg, "image/svg+xml", sha256(svg), 1024))
      .toThrowError(expect.objectContaining({ code: "UNSUPPORTED_ASSET" }));
    expect(() => inspectAccountImage(pngBytes(), "image/jpeg", sha256(pngBytes()), 1024))
      .toThrowError(expect.objectContaining({ code: "UNSUPPORTED_ASSET" }));
  });

  it("rejects wrong hashes, empty files, and files above the per-object limit", () => {
    expect(() => inspectAccountImage(pngBytes(), "image/png", "0".repeat(64), 1024))
      .toThrowError(expect.objectContaining({ code: "ASSET_HASH_MISMATCH" }));
    expect(() => inspectAccountImage(new Uint8Array(), "image/png", sha256(new Uint8Array()), 1024))
      .toThrowError(expect.objectContaining({ code: "UNSUPPORTED_ASSET" }));
    expect(() => inspectAccountImage(pngBytes(), "image/png", sha256(pngBytes()), 8))
      .toThrowError(expect.objectContaining({ code: "ASSET_TOO_LARGE" }));
  });
});

describe("immutable account asset service", () => {
  const limits = { maxAssetBytes: 32, maxAssets: 2, maxTotalBytes: 40, maxCasAttempts: 6 };

  it("reserves quota, stores once, and returns a bounded versioned manifest", async () => {
    const repository = new MemoryAccountAssetRepository();
    const service = new AccountAssetService(repository, namespaceSecret, limits);
    const bytes = pngBytes();
    const digest = sha256(bytes);

    const first = await service.put(USER_A, digest, "image/png", bytes);
    const repeat = await service.put(USER_A, digest, "image/png", bytes);

    expect(first).toEqual({
      created: true,
      manifest: {
        schema: ACCOUNT_ASSET_SCHEMA,
        version: ACCOUNT_ASSET_VERSION,
        asset: {
          id: digest,
          sha256: digest,
          contentType: "image/png",
          byteLength: bytes.byteLength,
          href: `/api/account/assets/${digest}`
        }
      }
    });
    expect(repeat).toEqual({ ...first, created: false });
    expect(repository.indexes.size).toBe(1);
    expect(repository.objects.size).toBe(1);
  });

  it("isolates the same digest in distinct HMAC account namespaces", async () => {
    const repository = new MemoryAccountAssetRepository();
    const service = new AccountAssetService(repository, namespaceSecret, limits);
    const bytes = pngBytes();
    const digest = sha256(bytes);

    await service.put(USER_A, digest, "image/png", bytes);
    await expect(service.get(USER_B, digest)).rejects.toMatchObject({ code: "ASSET_NOT_FOUND" });
    await service.put(USER_B, digest, "image/png", bytes);

    expect(repository.indexes.size).toBe(2);
    expect(repository.objects.size).toBe(2);
    await expect(service.get(USER_A, digest)).resolves.toMatchObject({
      descriptor: { sha256: digest, contentType: "image/png" }
    });
  });

  it("enforces count and total-byte quota before writing another object", async () => {
    const repository = new MemoryAccountAssetRepository();
    const service = new AccountAssetService(repository, namespaceSecret, {
      ...limits,
      maxAssets: 1,
      maxTotalBytes: 32
    });
    const first = pngBytes();
    const second = Uint8Array.from([...pngBytes(), 0x01]);
    await service.put(USER_A, sha256(first), "image/png", first);
    await expect(service.put(USER_A, sha256(second), "image/png", second))
      .rejects.toMatchObject({ code: "ASSET_QUOTA_EXCEEDED" });
    expect(repository.objects.size).toBe(1);
  });

  it("serializes concurrent reservations so quota cannot be exceeded", async () => {
    const repository = new MemoryAccountAssetRepository();
    const service = new AccountAssetService(repository, namespaceSecret, {
      ...limits,
      maxAssets: 1
    });
    const first = pngBytes();
    const second = Uint8Array.from([...pngBytes(), 0x02]);
    const results = await Promise.allSettled([
      service.put(USER_A, sha256(first), "image/png", first),
      service.put(USER_A, sha256(second), "image/png", second)
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(repository.objects.size).toBe(1);
  });

  it("repairs a reserved but interrupted immutable upload on repeat PUT", async () => {
    const repository = new MemoryAccountAssetRepository();
    const service = new AccountAssetService(repository, namespaceSecret, limits);
    const bytes = pngBytes();
    const digest = sha256(bytes);
    repository.failNextObjectWrite = true;

    await expect(service.put(USER_A, digest, "image/png", bytes)).rejects.toBeInstanceOf(Error);
    expect(repository.indexes.size).toBe(1);
    expect(repository.objects.size).toBe(0);
    await expect(service.put(USER_A, digest, "image/png", bytes)).resolves.toMatchObject({
      created: false,
      manifest: { asset: { sha256: digest } }
    });
    expect(repository.objects.size).toBe(1);
  });

  it("fails closed when stored bytes or metadata do not match the reserved descriptor", async () => {
    const repository = new MemoryAccountAssetRepository();
    const service = new AccountAssetService(repository, namespaceSecret, limits);
    const bytes = pngBytes();
    const digest = sha256(bytes);
    await service.put(USER_A, digest, "image/png", bytes);
    const namespace = deriveAccountAssetNamespace(USER_A, namespaceSecret);
    const key = `${namespace}/${digest}`;
    const stored = repository.objects.get(key)!;
    repository.objects.set(key, {
      bytes: stored.bytes,
      metadata: { ...stored.metadata, byteLength: stored.metadata.byteLength + 1 }
    });

    await expect(service.get(USER_A, digest)).rejects.toMatchObject({ code: "ASSET_UNAVAILABLE" });
  });

  it("plans bounded account deletion from the validated index and deletes the index last", async () => {
    const repository = new MemoryAccountAssetRepository();
    const service = new AccountAssetService(repository, namespaceSecret, {
      ...limits,
      maxTotalBytes: 64
    });
    const first = pngBytes();
    const second = Uint8Array.from([...pngBytes(), 0x03]);
    const assets = [
      { bytes: first, digest: sha256(first) },
      { bytes: second, digest: sha256(second) }
    ].sort((left, right) => left.digest.localeCompare(right.digest));
    const digests = assets.map(({ digest }) => digest);
    for (const asset of assets) {
      await service.put(USER_A, asset.digest, "image/png", asset.bytes);
    }

    const plan = await service.planReset(USER_A);
    const namespace = deriveAccountAssetNamespace(USER_A, namespaceSecret);
    expect(plan).toEqual({ namespace, objectDigests: digests });

    await service.executeReset(plan);
    expect(repository.deletionLog).toEqual([
      `object:${namespace}:${digests[0]}`,
      `object:${namespace}:${digests[1]}`,
      `index:${namespace}`
    ]);
    expect(repository.objects.size).toBe(0);
    expect(repository.indexes.size).toBe(0);
  });

  it("treats a missing index as a replay-safe empty plan", async () => {
    const repository = new MemoryAccountAssetRepository();
    const service = new AccountAssetService(repository, namespaceSecret, limits);
    const namespace = deriveAccountAssetNamespace(USER_A, namespaceSecret);

    await expect(service.planReset(USER_A)).resolves.toEqual({
      namespace,
      objectDigests: []
    });
  });

  it("does not delete anything when the bounded account index is malformed", async () => {
    const repository = new MemoryAccountAssetRepository();
    const service = new AccountAssetService(repository, namespaceSecret, limits);
    const namespace = deriveAccountAssetNamespace(USER_A, namespaceSecret);
    repository.indexes.set(namespace, {
      value: {
        schema: "advertising-game-account-asset-index",
        version: 1,
        revision: 1,
        assets: { ["x".repeat(64)]: { contentType: "image/png", byteLength: 24 } }
      } as AccountAssetIndex,
      etag: 1
    });

    await expect(service.planReset(USER_A)).rejects.toMatchObject({ code: "ASSET_UNAVAILABLE" });
    expect(repository.deletionLog).toEqual([]);
  });

  it("uses typed domain errors without embedding account IDs or storage keys", () => {
    const error = new AccountAssetError("ASSET_UNAVAILABLE");
    expect(String(error)).toBe("AccountAssetError: ASSET_UNAVAILABLE");
    expect(String(error)).not.toContain(USER_A);
    expect(String(error)).not.toContain(namespaceSecret);
  });
});
