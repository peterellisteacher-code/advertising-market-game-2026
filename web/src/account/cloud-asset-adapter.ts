import {
  CampaignDocumentSchema,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import {
  AccountAssetClientError,
  type AccountAssetClient,
  type AccountAssetContentType,
  type AccountAssetDescriptor
} from "./account-asset-client";

const SHA256 = /^[a-f0-9]{64}$/u;
const MAX_ASSET_BYTES = 4 * 1_024 * 1_024;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

export interface CloudAssetRevisionSource {
  loadRevision(
    documentId: string,
    revision: number
  ): Promise<{ document: CampaignDocumentV1; blobs: ReadonlyMap<string, Blob> } | null>;
}

export class CloudAssetAdapterError extends Error {
  constructor() {
    super("CLOUD_ASSET_PREPARATION_FAILED");
    this.name = "CloudAssetAdapterError";
  }
}

export interface CloudProgressAssetAdapterOptions {
  readonly revisionSource: CloudAssetRevisionSource;
  readonly client: AccountAssetClient;
}

interface LocalBlobReference {
  readonly objectId: string;
  readonly blobKey: string;
  readonly mimeType: AccountAssetContentType;
}

interface CloudBlobDescriptor extends LocalBlobReference {
  readonly byteLength: number;
  readonly sha256: string;
}

const isContentType = (value: unknown): value is AccountAssetContentType =>
  value === "image/png" || value === "image/jpeg" || value === "image/webp";

const localBlobReferences = (document: CampaignDocumentV1): LocalBlobReference[] =>
  document.assetReferences.flatMap((reference) => {
    if (reference.kind !== "local-blob") return [];
    const { objectId, blobKey, mimeType } = reference;
    if (typeof objectId !== "string" || !objectId || typeof blobKey !== "string" || !blobKey ||
      !isContentType(mimeType)) throw new CloudAssetAdapterError();
    return [{ objectId, blobKey, mimeType }];
  });

const hashBlob = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const descriptorMatches = (
  descriptor: AccountAssetDescriptor,
  digest: string,
  blob: Blob,
  mimeType: AccountAssetContentType
): boolean => descriptor.sha256 === digest && descriptor.contentType === mimeType &&
  descriptor.byteLength === blob.size;

const descriptorKey = ({ objectId, blobKey }: LocalBlobReference): string =>
  `${objectId}\u0000${blobKey}`;

const exactCloudBlobDescriptor = (value: unknown): CloudBlobDescriptor | null => {
  if (!isRecord(value) || !exactKeys(value, [
    "kind", "objectId", "blobKey", "mimeType", "byteLength", "sha256"
  ]) || value.kind !== "cloud-blob" || typeof value.objectId !== "string" || !value.objectId ||
    typeof value.blobKey !== "string" || !value.blobKey || !isContentType(value.mimeType) ||
    typeof value.byteLength !== "number" || !Number.isSafeInteger(value.byteLength) ||
    value.byteLength < 1 || value.byteLength > MAX_ASSET_BYTES ||
    typeof value.sha256 !== "string" || !SHA256.test(value.sha256)) {
    return null;
  }
  return {
    objectId: value.objectId,
    blobKey: value.blobKey,
    mimeType: value.mimeType,
    byteLength: value.byteLength,
    sha256: value.sha256
  };
};

export class CloudProgressAssetAdapter {
  readonly #revisionSource: CloudAssetRevisionSource;
  readonly #client: AccountAssetClient;

  constructor(options: CloudProgressAssetAdapterOptions) {
    this.#revisionSource = options.revisionSource;
    this.#client = options.client;
  }

  async prepare(document: CampaignDocumentV1): Promise<CampaignDocumentV1> {
    try {
      if (document.mode !== "offline") throw new CloudAssetAdapterError();
      const loaded = await this.#revisionSource.loadRevision(document.documentId, document.revision);
      if (loaded === null || loaded.document.mode !== "offline" ||
        loaded.document.documentId !== document.documentId || loaded.document.revision !== document.revision) {
        throw new CloudAssetAdapterError();
      }
      const localReferences = localBlobReferences(loaded.document);
      const descriptors = new Map<string, AccountAssetDescriptor>();
      const cloudReferences: Record<string, unknown>[] = [];
      const cloudReferenceKeys = new Set<string>();
      for (const reference of localReferences) {
        const blob = loaded.blobs.get(reference.blobKey);
        if (!(blob instanceof Blob) || blob.type !== reference.mimeType) {
          throw new CloudAssetAdapterError();
        }
        const digest = await hashBlob(blob);
        let descriptor = descriptors.get(digest);
        if (descriptor === undefined) {
          descriptor = await this.#client.put(blob);
          descriptors.set(digest, descriptor);
        }
        if (!descriptorMatches(descriptor, digest, blob, reference.mimeType)) {
          throw new CloudAssetAdapterError();
        }
        const referenceKey = `${reference.objectId}\u0000${reference.blobKey}`;
        if (cloudReferenceKeys.has(referenceKey)) continue;
        cloudReferenceKeys.add(referenceKey);
        cloudReferences.push({
          kind: "cloud-blob",
          objectId: reference.objectId,
          blobKey: reference.blobKey,
          mimeType: reference.mimeType,
          byteLength: descriptor.byteLength,
          sha256: descriptor.sha256
        });
      }
      const prepared = structuredClone(loaded.document);
      prepared.assetReferences = [
        ...prepared.assetReferences.filter((reference) => reference.kind !== "cloud-blob"),
        ...cloudReferences
      ];
      return CampaignDocumentSchema.parse(prepared);
    } catch (error) {
      if (error instanceof AccountAssetClientError && error.code === "AUTHENTICATION_REQUIRED") {
        throw error;
      }
      if (error instanceof CloudAssetAdapterError) throw error;
      throw new CloudAssetAdapterError();
    }
  }
}

export interface CloudProgressAssetRestoreOptions {
  readonly client: AccountAssetClient;
}

export interface CloudProgressAssetRestoreResult {
  readonly document: CampaignDocumentV1;
  readonly blobs: ReadonlyMap<string, Blob>;
}

export class CloudProgressAssetRestore {
  readonly #client: AccountAssetClient;

  constructor(options: CloudProgressAssetRestoreOptions) {
    this.#client = options.client;
  }

  async restore(document: CampaignDocumentV1): Promise<CloudProgressAssetRestoreResult> {
    try {
      if (document.mode !== "offline") throw new CloudAssetAdapterError();
      const localReferences = localBlobReferences(document);
      const localByKey = new Map<string, LocalBlobReference>();
      for (const reference of localReferences) {
        const key = descriptorKey(reference);
        if (localByKey.has(key)) {
          throw new CloudAssetAdapterError();
        }
        localByKey.set(key, reference);
      }

      const descriptors = new Map<string, CloudBlobDescriptor>();
      for (const reference of document.assetReferences) {
        if (reference.kind !== "cloud-blob") continue;
        const descriptor = exactCloudBlobDescriptor(reference);
        if (descriptor === null) throw new CloudAssetAdapterError();
        const key = descriptorKey(descriptor);
        if (!localByKey.has(key) || descriptors.has(key)) throw new CloudAssetAdapterError();
        descriptors.set(key, descriptor);
      }
      if (descriptors.size !== localReferences.length) throw new CloudAssetAdapterError();
      for (const [key, local] of localByKey) {
        const descriptor = descriptors.get(key);
        if (descriptor === undefined || descriptor.mimeType !== local.mimeType) {
          throw new CloudAssetAdapterError();
        }
      }
      const descriptorByBlobKey = new Map<string, CloudBlobDescriptor>();
      for (const descriptor of descriptors.values()) {
        const existing = descriptorByBlobKey.get(descriptor.blobKey);
        if (existing !== undefined && (existing.mimeType !== descriptor.mimeType ||
          existing.sha256 !== descriptor.sha256 || existing.byteLength !== descriptor.byteLength)) {
          throw new CloudAssetAdapterError();
        }
        descriptorByBlobKey.set(descriptor.blobKey, descriptor);
      }
      const descriptorByHash = new Map<string, CloudBlobDescriptor>();
      for (const descriptor of descriptors.values()) {
        const existing = descriptorByHash.get(descriptor.sha256);
        if (existing !== undefined && (existing.mimeType !== descriptor.mimeType ||
          existing.byteLength !== descriptor.byteLength)) {
          throw new CloudAssetAdapterError();
        }
        descriptorByHash.set(descriptor.sha256, descriptor);
      }

      const downloads = new Map<string, Blob>();
      for (const descriptor of descriptors.values()) {
        if (downloads.has(descriptor.sha256)) continue;
        const downloaded = await this.#client.get(descriptor.sha256);
        if (downloaded.sha256 !== descriptor.sha256 || downloaded.contentType !== descriptor.mimeType ||
          downloaded.byteLength !== descriptor.byteLength || !(downloaded.blob instanceof Blob) ||
          downloaded.blob.size !== descriptor.byteLength || downloaded.blob.type !== descriptor.mimeType) {
          throw new CloudAssetAdapterError();
        }
        const bytes = await downloaded.blob.arrayBuffer();
        if (bytes.byteLength !== descriptor.byteLength) throw new CloudAssetAdapterError();
        downloads.set(descriptor.sha256, new Blob([bytes], { type: descriptor.mimeType }));
      }

      const blobs = new Map<string, Blob>();
      for (const local of localReferences) {
        const descriptor = descriptors.get(descriptorKey(local));
        const blob = descriptor === undefined ? undefined : downloads.get(descriptor.sha256);
        if (blob === undefined) throw new CloudAssetAdapterError();
        const bytes = await blob.arrayBuffer();
        blobs.set(local.blobKey, new Blob([bytes], { type: local.mimeType }));
      }
      return { document: structuredClone(document), blobs };
    } catch (error) {
      if (error instanceof AccountAssetClientError && error.code === "AUTHENTICATION_REQUIRED") {
        throw error;
      }
      if (error instanceof CloudAssetAdapterError) throw error;
      throw new CloudAssetAdapterError();
    }
  }
}
