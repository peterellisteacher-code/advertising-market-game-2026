import { createHash, createHmac } from "node:crypto";
import {
  AccountConfigurationError,
  parseAccountEnvironment,
  type AccountEnvironment,
  type AccountEnvironmentRecord
} from "./account-backend";

export const ACCOUNT_ASSET_SCHEMA = "advertising-game-account-asset";
export const ACCOUNT_ASSET_VERSION = 1;

export const ACCOUNT_ASSET_LIMITS = Object.freeze({
  maxAssetBytes: 4 * 1_024 * 1_024,
  maxAssets: 32,
  maxTotalBytes: 32 * 1_024 * 1_024,
  maxCasAttempts: 12
});

const INDEX_SCHEMA = "advertising-game-account-asset-index";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type AccountAssetContentType = typeof CONTENT_TYPES[number];

export interface AccountAssetEnvironment extends AccountEnvironment {
  readonly assetNamespaceSecret: string;
}

export interface AccountAssetLimits {
  readonly maxAssetBytes: number;
  readonly maxAssets: number;
  readonly maxTotalBytes: number;
  readonly maxCasAttempts: number;
}

export interface AccountAssetDescriptor {
  readonly sha256: string;
  readonly contentType: AccountAssetContentType;
  readonly byteLength: number;
}

export interface AccountAssetManifest {
  readonly schema: typeof ACCOUNT_ASSET_SCHEMA;
  readonly version: typeof ACCOUNT_ASSET_VERSION;
  readonly asset: {
    readonly id: string;
    readonly sha256: string;
    readonly contentType: AccountAssetContentType;
    readonly byteLength: number;
    readonly href: string;
  };
}

export interface AccountAssetIndexEntry {
  readonly contentType: AccountAssetContentType;
  readonly byteLength: number;
}

export interface AccountAssetIndex {
  readonly schema: typeof INDEX_SCHEMA;
  readonly version: 1;
  readonly revision: number;
  readonly assets: Readonly<Record<string, AccountAssetIndexEntry>>;
}

export interface AccountAssetBlobMetadata {
  readonly schema: typeof ACCOUNT_ASSET_SCHEMA;
  readonly version: typeof ACCOUNT_ASSET_VERSION;
  readonly sha256: string;
  readonly contentType: AccountAssetContentType;
  readonly byteLength: number;
}

export interface AccountAssetRepository {
  readIndex(namespace: string): Promise<{ value: unknown; etag: string } | null>;
  createIndex(namespace: string, value: AccountAssetIndex): Promise<boolean>;
  compareAndSwapIndex(
    namespace: string,
    value: AccountAssetIndex,
    etag: string
  ): Promise<boolean>;
  putObject(
    namespace: string,
    digest: string,
    bytes: Uint8Array,
    metadata: AccountAssetBlobMetadata
  ): Promise<boolean>;
  getObject(
    namespace: string,
    digest: string
  ): Promise<{ bytes: Uint8Array; metadata: unknown } | null>;
  deleteObject(namespace: string, digest: string): Promise<void>;
  deleteIndex(namespace: string): Promise<void>;
}

export interface AccountAssetResetPlan {
  readonly namespace: string;
  readonly objectDigests: readonly string[];
}

export type AccountAssetErrorCode =
  | "ASSET_HASH_MISMATCH"
  | "ASSET_NOT_FOUND"
  | "ASSET_QUOTA_EXCEEDED"
  | "ASSET_TOO_LARGE"
  | "ASSET_UNAVAILABLE"
  | "UNSUPPORTED_ASSET";

export class AccountAssetError extends Error {
  constructor(readonly code: AccountAssetErrorCode) {
    super(code);
    this.name = "AccountAssetError";
  }
}

const byteLength = (value: string): number => Buffer.byteLength(value, "utf8");

export function parseAccountAssetEnvironment(
  environment: AccountEnvironmentRecord
): AccountAssetEnvironment {
  const accountEnvironment = parseAccountEnvironment(environment);
  const assetNamespaceSecret = environment.ADVERTISING_GAME_ASSET_NAMESPACE_SECRET;
  if (
    typeof assetNamespaceSecret !== "string" ||
    assetNamespaceSecret.trim() !== assetNamespaceSecret ||
    byteLength(assetNamespaceSecret) < 32 ||
    byteLength(assetNamespaceSecret) > 256 ||
    assetNamespaceSecret === accountEnvironment.usernameHmacSecret
  ) {
    throw new AccountConfigurationError();
  }
  return { ...accountEnvironment, assetNamespaceSecret };
}

export function deriveAccountAssetNamespace(userId: string, secret: string): string {
  if (!UUID_PATTERN.test(userId) || byteLength(secret) < 32 || byteLength(secret) > 256) {
    throw new AccountAssetError("ASSET_UNAVAILABLE");
  }
  return createHmac("sha256", secret)
    .update("advertising-game/account-asset-namespace/v1\0", "utf8")
    .update(userId, "utf8")
    .digest("hex");
}

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  signature.every((value, index) => bytes[index] === value);

const asciiAt = (bytes: Uint8Array, offset: number, value: string): boolean =>
  [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));

const readUint32Le = (bytes: Uint8Array, offset: number): number =>
  (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)
  ) >>> 0;

const sniffContentType = (bytes: Uint8Array): AccountAssetContentType | null => {
  if (
    bytes.byteLength >= 24 &&
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) &&
    startsWith(bytes.subarray(8), [0x00, 0x00, 0x00, 0x0d]) &&
    asciiAt(bytes, 12, "IHDR")
  ) {
    return "image/png";
  }
  if (
    bytes.byteLength >= 4 &&
    startsWith(bytes, [0xff, 0xd8, 0xff]) &&
    bytes[bytes.byteLength - 2] === 0xff &&
    bytes[bytes.byteLength - 1] === 0xd9
  ) {
    return "image/jpeg";
  }
  if (
    bytes.byteLength >= 16 &&
    asciiAt(bytes, 0, "RIFF") &&
    readUint32Le(bytes, 4) + 8 === bytes.byteLength &&
    asciiAt(bytes, 8, "WEBP") &&
    (["VP8 ", "VP8L", "VP8X"] as const).some((chunk) => asciiAt(bytes, 12, chunk))
  ) {
    return "image/webp";
  }
  return null;
};

export function inspectAccountImage(
  bytes: Uint8Array,
  declaredContentType: string,
  declaredSha256: string,
  maximumBytes: number
): AccountAssetDescriptor {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 1 || bytes.byteLength > maximumBytes) {
    throw new AccountAssetError("ASSET_TOO_LARGE");
  }
  const detectedContentType = sniffContentType(bytes);
  if (detectedContentType === null || detectedContentType !== declaredContentType) {
    throw new AccountAssetError("UNSUPPORTED_ASSET");
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (!SHA256_PATTERN.test(declaredSha256) || digest !== declaredSha256) {
    throw new AccountAssetError("ASSET_HASH_MISMATCH");
  }
  return {
    sha256: digest,
    contentType: detectedContentType,
    byteLength: bytes.byteLength
  };
}

const ownRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const exactKeys = (record: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(record).sort().join("\0") === [...keys].sort().join("\0");

const isContentType = (value: unknown): value is AccountAssetContentType =>
  typeof value === "string" && (CONTENT_TYPES as readonly string[]).includes(value);

const parseIndex = (value: unknown, limits: AccountAssetLimits): AccountAssetIndex => {
  const record = ownRecord(value);
  const assetsRecord = ownRecord(record?.assets);
  if (
    record === null ||
    !exactKeys(record, ["schema", "version", "revision", "assets"]) ||
    record.schema !== INDEX_SCHEMA ||
    record.version !== 1 ||
    typeof record.revision !== "number" ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 1 ||
    assetsRecord === null
  ) {
    throw new AccountAssetError("ASSET_UNAVAILABLE");
  }
  const entries = Object.entries(assetsRecord);
  if (entries.length > limits.maxAssets) throw new AccountAssetError("ASSET_UNAVAILABLE");
  const assets: Record<string, AccountAssetIndexEntry> = {};
  let totalBytes = 0;
  for (const [digest, rawEntry] of entries) {
    const entry = ownRecord(rawEntry);
    if (
      !SHA256_PATTERN.test(digest) ||
      entry === null ||
      !exactKeys(entry, ["contentType", "byteLength"]) ||
      !isContentType(entry.contentType) ||
      typeof entry.byteLength !== "number" ||
      !Number.isSafeInteger(entry.byteLength) ||
      entry.byteLength < 1 ||
      entry.byteLength > limits.maxAssetBytes
    ) {
      throw new AccountAssetError("ASSET_UNAVAILABLE");
    }
    totalBytes += entry.byteLength;
    if (totalBytes > limits.maxTotalBytes) throw new AccountAssetError("ASSET_UNAVAILABLE");
    assets[digest] = {
      contentType: entry.contentType,
      byteLength: entry.byteLength
    };
  }
  return {
    schema: INDEX_SCHEMA,
    version: 1,
    revision: record.revision,
    assets
  };
};

const manifestFor = (descriptor: AccountAssetDescriptor): AccountAssetManifest => ({
  schema: ACCOUNT_ASSET_SCHEMA,
  version: ACCOUNT_ASSET_VERSION,
  asset: {
    id: descriptor.sha256,
    sha256: descriptor.sha256,
    contentType: descriptor.contentType,
    byteLength: descriptor.byteLength,
    href: `/api/account/assets/${descriptor.sha256}`
  }
});

const metadataFor = (descriptor: AccountAssetDescriptor): AccountAssetBlobMetadata => ({
  schema: ACCOUNT_ASSET_SCHEMA,
  version: ACCOUNT_ASSET_VERSION,
  sha256: descriptor.sha256,
  contentType: descriptor.contentType,
  byteLength: descriptor.byteLength
});

const validateLimits = (limits: AccountAssetLimits): void => {
  if (
    !Number.isSafeInteger(limits.maxAssetBytes) || limits.maxAssetBytes < 1 ||
    !Number.isSafeInteger(limits.maxAssets) || limits.maxAssets < 1 || limits.maxAssets > 1_024 ||
    !Number.isSafeInteger(limits.maxTotalBytes) || limits.maxTotalBytes < limits.maxAssetBytes ||
    !Number.isSafeInteger(limits.maxCasAttempts) || limits.maxCasAttempts < 1 ||
    limits.maxCasAttempts > 100
  ) {
    throw new AccountAssetError("ASSET_UNAVAILABLE");
  }
};

const sameDescriptor = (
  entry: AccountAssetIndexEntry,
  descriptor: AccountAssetDescriptor
): boolean => entry.contentType === descriptor.contentType &&
  entry.byteLength === descriptor.byteLength;

const validateBlobMetadata = (
  metadata: unknown,
  descriptor: AccountAssetDescriptor
): boolean => {
  const record = ownRecord(metadata);
  return record !== null &&
    exactKeys(record, ["schema", "version", "sha256", "contentType", "byteLength"]) &&
    record.schema === ACCOUNT_ASSET_SCHEMA &&
    record.version === ACCOUNT_ASSET_VERSION &&
    record.sha256 === descriptor.sha256 &&
    record.contentType === descriptor.contentType &&
    record.byteLength === descriptor.byteLength;
};

export class AccountAssetService {
  private readonly limits: AccountAssetLimits;

  constructor(
    private readonly repository: AccountAssetRepository,
    private readonly namespaceSecret: string,
    limits: AccountAssetLimits = ACCOUNT_ASSET_LIMITS
  ) {
    validateLimits(limits);
    this.limits = { ...limits };
  }

  async put(
    userId: string,
    digest: string,
    contentType: string,
    bytes: Uint8Array
  ): Promise<{ created: boolean; manifest: AccountAssetManifest }> {
    const descriptor = inspectAccountImage(
      bytes,
      contentType,
      digest,
      this.limits.maxAssetBytes
    );
    const namespace = deriveAccountAssetNamespace(userId, this.namespaceSecret);
    let created = false;
    let reserved = false;

    for (let attempt = 0; attempt < this.limits.maxCasAttempts; attempt += 1) {
      const current = await this.repository.readIndex(namespace);
      if (current === null) {
        const next: AccountAssetIndex = {
          schema: INDEX_SCHEMA,
          version: 1,
          revision: 1,
          assets: {
            [descriptor.sha256]: {
              contentType: descriptor.contentType,
              byteLength: descriptor.byteLength
            }
          }
        };
        if (await this.repository.createIndex(namespace, next)) {
          created = true;
          reserved = true;
          break;
        }
        continue;
      }

      const index = parseIndex(current.value, this.limits);
      const existing = index.assets[descriptor.sha256];
      if (existing !== undefined) {
        if (!sameDescriptor(existing, descriptor)) {
          throw new AccountAssetError("ASSET_UNAVAILABLE");
        }
        reserved = true;
        break;
      }

      const entries = Object.values(index.assets);
      const currentBytes = entries.reduce((total, entry) => total + entry.byteLength, 0);
      if (
        entries.length >= this.limits.maxAssets ||
        currentBytes + descriptor.byteLength > this.limits.maxTotalBytes
      ) {
        throw new AccountAssetError("ASSET_QUOTA_EXCEEDED");
      }
      const next: AccountAssetIndex = {
        ...index,
        revision: index.revision + 1,
        assets: {
          ...index.assets,
          [descriptor.sha256]: {
            contentType: descriptor.contentType,
            byteLength: descriptor.byteLength
          }
        }
      };
      if (await this.repository.compareAndSwapIndex(namespace, next, current.etag)) {
        created = true;
        reserved = true;
        break;
      }
    }

    if (!reserved) throw new AccountAssetError("ASSET_UNAVAILABLE");

    const stored = await this.repository.putObject(
      namespace,
      descriptor.sha256,
      bytes.slice(),
      metadataFor(descriptor)
    );
    if (!stored) {
      const existing = await this.repository.getObject(namespace, descriptor.sha256);
      if (existing === null) throw new AccountAssetError("ASSET_UNAVAILABLE");
      this.validateStoredObject(existing, descriptor);
    }
    return { created, manifest: manifestFor(descriptor) };
  }

  async get(
    userId: string,
    digest: string
  ): Promise<{ descriptor: AccountAssetDescriptor; bytes: Uint8Array }> {
    if (!SHA256_PATTERN.test(digest)) throw new AccountAssetError("ASSET_NOT_FOUND");
    const namespace = deriveAccountAssetNamespace(userId, this.namespaceSecret);
    const current = await this.repository.readIndex(namespace);
    if (current === null) throw new AccountAssetError("ASSET_NOT_FOUND");
    const index = parseIndex(current.value, this.limits);
    const indexEntry = index.assets[digest];
    if (indexEntry === undefined) throw new AccountAssetError("ASSET_NOT_FOUND");
    const descriptor: AccountAssetDescriptor = {
      sha256: digest,
      contentType: indexEntry.contentType,
      byteLength: indexEntry.byteLength
    };
    const stored = await this.repository.getObject(namespace, digest);
    if (stored === null) throw new AccountAssetError("ASSET_UNAVAILABLE");
    return { descriptor, bytes: this.validateStoredObject(stored, descriptor) };
  }

  async planReset(userId: string): Promise<AccountAssetResetPlan> {
    const namespace = deriveAccountAssetNamespace(userId, this.namespaceSecret);
    const current = await this.repository.readIndex(namespace);
    if (current === null) return { namespace, objectDigests: [] };
    const index = parseIndex(current.value, this.limits);
    return {
      namespace,
      objectDigests: Object.keys(index.assets).sort()
    };
  }

  async executeReset(plan: AccountAssetResetPlan): Promise<void> {
    if (
      !SHA256_PATTERN.test(plan.namespace) ||
      plan.objectDigests.length > this.limits.maxAssets ||
      new Set(plan.objectDigests).size !== plan.objectDigests.length ||
      plan.objectDigests.some((digest) => !SHA256_PATTERN.test(digest))
    ) {
      throw new AccountAssetError("ASSET_UNAVAILABLE");
    }
    for (const digest of plan.objectDigests) {
      await this.repository.deleteObject(plan.namespace, digest);
    }
    await this.repository.deleteIndex(plan.namespace);
  }

  private validateStoredObject(
    stored: { bytes: Uint8Array; metadata: unknown },
    descriptor: AccountAssetDescriptor
  ): Uint8Array {
    if (!validateBlobMetadata(stored.metadata, descriptor)) {
      throw new AccountAssetError("ASSET_UNAVAILABLE");
    }
    let inspected: AccountAssetDescriptor;
    try {
      inspected = inspectAccountImage(
        stored.bytes,
        descriptor.contentType,
        descriptor.sha256,
        this.limits.maxAssetBytes
      );
    } catch {
      throw new AccountAssetError("ASSET_UNAVAILABLE");
    }
    if (inspected.byteLength !== descriptor.byteLength) {
      throw new AccountAssetError("ASSET_UNAVAILABLE");
    }
    return stored.bytes.slice();
  }
}
