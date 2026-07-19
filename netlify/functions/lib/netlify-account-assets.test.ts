// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_ASSET_SCHEMA,
  ACCOUNT_ASSET_VERSION,
  type AccountAssetBlobMetadata,
  type AccountAssetIndex
} from "./account-assets";
import {
  accountAssetIndexKey,
  accountAssetObjectKey,
  createNetlifyAccountAssetRepository
} from "./netlify-account-assets";

const namespace = "a".repeat(64);
const digest = "b".repeat(64);
const index: AccountAssetIndex = {
  schema: "advertising-game-account-asset-index",
  version: 1,
  revision: 1,
  assets: {
    [digest]: { contentType: "image/png", byteLength: 24 }
  }
};
const metadata: AccountAssetBlobMetadata = {
  schema: ACCOUNT_ASSET_SCHEMA,
  version: ACCOUNT_ASSET_VERSION,
  sha256: digest,
  contentType: "image/png",
  byteLength: 24
};

const fakeStore = () => ({
  getWithMetadata: vi.fn(),
  setJSON: vi.fn(),
  set: vi.fn()
});

describe("Netlify account asset key isolation", () => {
  it("uses only a validated opaque namespace and content digest", () => {
    expect(accountAssetIndexKey(namespace)).toBe(`accounts/${namespace}/index-v1`);
    expect(accountAssetObjectKey(namespace, digest)).toBe(
      `accounts/${namespace}/objects/${digest}`
    );
    expect(() => accountAssetIndexKey("../../other")).toThrow("invalid account asset key");
    expect(() => accountAssetObjectKey(namespace, "../digest")).toThrow(
      "invalid account asset key"
    );
  });
});

describe("Netlify account asset repository", () => {
  it("reads and conditionally creates the versioned per-account index", async () => {
    const store = fakeStore();
    store.getWithMetadata.mockResolvedValue({ data: index, etag: '"etag-1"', metadata: {} });
    store.setJSON.mockResolvedValue({ modified: true });
    const repository = createNetlifyAccountAssetRepository(store);

    await expect(repository.readIndex(namespace)).resolves.toEqual({
      value: index,
      etag: '"etag-1"'
    });
    await expect(repository.createIndex(namespace, index)).resolves.toBe(true);

    expect(store.getWithMetadata).toHaveBeenCalledWith(
      accountAssetIndexKey(namespace),
      { type: "json" }
    );
    expect(store.setJSON).toHaveBeenCalledWith(
      accountAssetIndexKey(namespace),
      index,
      { onlyIfNew: true }
    );
  });

  it("uses ETag compare-and-swap for quota index updates", async () => {
    const store = fakeStore();
    store.setJSON.mockResolvedValue({ modified: false });
    const repository = createNetlifyAccountAssetRepository(store);
    await expect(repository.compareAndSwapIndex(namespace, index, '"etag-1"'))
      .resolves.toBe(false);
    expect(store.setJSON).toHaveBeenCalledWith(
      accountAssetIndexKey(namespace),
      index,
      { onlyIfMatch: '"etag-1"' }
    );
  });

  it("stores immutable binary data with bounded validation metadata", async () => {
    const store = fakeStore();
    store.set.mockResolvedValue({ modified: true });
    const repository = createNetlifyAccountAssetRepository(store);
    const bytes = Uint8Array.from([1, 2, 3, 4]);
    await expect(repository.putObject(namespace, digest, bytes, metadata)).resolves.toBe(true);

    const [key, stored, options] = store.set.mock.calls[0]!;
    expect(key).toBe(accountAssetObjectKey(namespace, digest));
    expect(stored).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(stored as ArrayBuffer)]).toEqual([1, 2, 3, 4]);
    expect(options).toEqual({ onlyIfNew: true, metadata });
  });

  it("loads binary data and metadata without exposing a store key", async () => {
    const store = fakeStore();
    store.getWithMetadata.mockResolvedValue({
      data: Uint8Array.from([5, 6, 7]).buffer,
      etag: '"asset-etag"',
      metadata
    });
    const repository = createNetlifyAccountAssetRepository(store);
    await expect(repository.getObject(namespace, digest)).resolves.toEqual({
      bytes: Uint8Array.from([5, 6, 7]),
      metadata
    });
    expect(store.getWithMetadata).toHaveBeenCalledWith(
      accountAssetObjectKey(namespace, digest),
      { type: "arrayBuffer" }
    );
  });

  it("returns null for missing entries and fails closed on malformed ETags or binary data", async () => {
    const store = fakeStore();
    const repository = createNetlifyAccountAssetRepository(store);
    store.getWithMetadata.mockResolvedValueOnce(null);
    await expect(repository.readIndex(namespace)).resolves.toBeNull();
    store.getWithMetadata.mockResolvedValueOnce({ data: index, metadata: {} });
    await expect(repository.readIndex(namespace)).rejects.toThrow("account asset storage unavailable");
    store.getWithMetadata.mockResolvedValueOnce({ data: "not-binary", metadata });
    await expect(repository.getObject(namespace, digest)).rejects.toThrow(
      "account asset storage unavailable"
    );
  });
});
