import { getStore } from "@netlify/blobs";
import {
  AccountAssetService,
  type AccountAssetBlobMetadata,
  type AccountAssetIndex,
  type AccountAssetRepository
} from "./account-assets";

const STORE_NAME = "advertising-game-account-assets-v1";
const OPAQUE_NAMESPACE_PATTERN = /^[a-f0-9]{64}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;

interface BlobWriteResult {
  readonly modified: boolean;
}

interface BlobStoreEntry {
  readonly data: unknown;
  readonly etag?: string;
  readonly metadata?: unknown;
}

interface AccountAssetBlobStore {
  getWithMetadata(
    key: string,
    options: { type: "arrayBuffer" | "json" }
  ): Promise<BlobStoreEntry | null>;
  setJSON(
    key: string,
    value: AccountAssetIndex,
    options: { onlyIfNew: true } | { onlyIfMatch: string }
  ): Promise<BlobWriteResult>;
  set(
    key: string,
    value: ArrayBuffer,
    options: { onlyIfNew: true; metadata: AccountAssetBlobMetadata }
  ): Promise<BlobWriteResult>;
}

const requireKeyParts = (namespace: string, digest?: string): void => {
  if (!OPAQUE_NAMESPACE_PATTERN.test(namespace) ||
    (digest !== undefined && !SHA256_PATTERN.test(digest))) {
    throw new Error("invalid account asset key");
  }
};

export function accountAssetIndexKey(namespace: string): string {
  requireKeyParts(namespace);
  return `accounts/${namespace}/index-v1`;
}

export function accountAssetObjectKey(namespace: string, digest: string): string {
  requireKeyParts(namespace, digest);
  return `accounts/${namespace}/objects/${digest}`;
}

const copyToArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const binaryBytes = (value: unknown): Uint8Array => {
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (value instanceof Uint8Array) return value.slice();
  throw new Error("account asset storage unavailable");
};

export function createNetlifyAccountAssetRepository(
  store: AccountAssetBlobStore
): AccountAssetRepository {
  return {
    async readIndex(namespace) {
      const entry = await store.getWithMetadata(accountAssetIndexKey(namespace), { type: "json" });
      if (entry === null) return null;
      if (
        typeof entry.etag !== "string" ||
        entry.etag.length < 1 ||
        entry.etag.length > 256 ||
        /[\r\n]/u.test(entry.etag)
      ) {
        throw new Error("account asset storage unavailable");
      }
      return { value: entry.data, etag: entry.etag };
    },
    async createIndex(namespace, value) {
      const result = await store.setJSON(accountAssetIndexKey(namespace), value, {
        onlyIfNew: true
      });
      return result.modified;
    },
    async compareAndSwapIndex(namespace, value, etag) {
      const result = await store.setJSON(accountAssetIndexKey(namespace), value, {
        onlyIfMatch: etag
      });
      return result.modified;
    },
    async putObject(namespace, digest, bytes, metadata) {
      const result = await store.set(
        accountAssetObjectKey(namespace, digest),
        copyToArrayBuffer(bytes),
        { onlyIfNew: true, metadata }
      );
      return result.modified;
    },
    async getObject(namespace, digest) {
      const entry = await store.getWithMetadata(accountAssetObjectKey(namespace, digest), {
        type: "arrayBuffer"
      });
      if (entry === null) return null;
      return { bytes: binaryBytes(entry.data), metadata: entry.metadata };
    }
  };
}

let sharedRepository: Promise<AccountAssetRepository> | null = null;

export async function defaultAccountAssetService(
  namespaceSecret: string
): Promise<AccountAssetService> {
  sharedRepository ??= Promise.resolve().then(() => {
    const store = getStore({ name: STORE_NAME, consistency: "strong" }) as unknown as
      AccountAssetBlobStore;
    return createNetlifyAccountAssetRepository(store);
  });
  return new AccountAssetService(await sharedRepository, namespaceSecret);
}
