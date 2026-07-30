import {
  CampaignDocumentSchema,
  type CampaignDocumentV1
} from "../../../web/src/domain/campaign-document";
import { assertBoundedCampaignJson } from "../../../web/src/domain/bounded-campaign-json";
import { campaignSemanticObjectMap } from "../../../web/src/domain/campaign-semantic-objects";
import {
  hasCloudProgressPracticeDocumentIdentities
} from "../../../web/src/domain/practice-identity";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_ASSET_BYTES = 4 * 1_024 * 1_024;
const MAX_FABRIC_TRAVERSAL_DEPTH = 100;
const MAX_FABRIC_TRAVERSAL_NODES = 100_000;
const CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

interface LocalBlobReference {
  readonly objectId: string;
  readonly blobKey: string;
  readonly mimeType: string;
}

interface CloudBlobDescriptor extends LocalBlobReference {
  readonly byteLength: number;
  readonly sha256: string;
}

interface FabricLocalSource {
  readonly objectId: string;
  readonly blobKey: string;
  readonly object: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
};

const descriptorKey = ({ objectId, blobKey }: Pick<FabricLocalSource, "objectId" | "blobKey">): string =>
  `${objectId}\u0000${blobKey}`;

const hasBlobProtocol = (source: string): boolean => {
  try {
    return new URL(source).protocol === "blob:";
  } catch {
    return false;
  }
};

const hasLocalBlobProtocol = (source: string): boolean => {
  try {
    return new URL(source).protocol === "local-blob:";
  } catch {
    return false;
  }
};

const inspectFabricState = (objects: unknown): FabricLocalSource[] => {
  const complete = new WeakSet<object>();
  const active = new WeakSet<object>();
  const localSources: FabricLocalSource[] = [];
  const stack: Array<{ value: unknown; depth: number; complete?: true }> = [{
    value: objects,
    depth: 0
  }];
  let nodes = 0;

  while (stack.length > 0) {
    const entry = stack.pop()!;
    if (typeof entry.value === "string") {
      if (hasBlobProtocol(entry.value)) {
        throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
      }
      continue;
    }
    if (entry.value === null || typeof entry.value !== "object") continue;

    if (entry.complete) {
      active.delete(entry.value);
      complete.add(entry.value);
      continue;
    }
    if (entry.depth > MAX_FABRIC_TRAVERSAL_DEPTH ||
      ++nodes > MAX_FABRIC_TRAVERSAL_NODES || active.has(entry.value)) {
      throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
    }
    if (complete.has(entry.value)) {
      throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
    }

    active.add(entry.value);
    stack.push({ value: entry.value, depth: entry.depth, complete: true });
    if (!Array.isArray(entry.value)) {
      const record = entry.value as Record<string, unknown>;
      if (typeof record.src === "string" && hasLocalBlobProtocol(record.src)) {
        const prefix = "local-blob:";
        const blobKey = record.src.slice(prefix.length);
        if (!record.src.startsWith(prefix) || typeof record.objectId !== "string" ||
          record.objectId.length === 0 || blobKey.length === 0) {
          throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
        }
        localSources.push({ objectId: record.objectId, blobKey, object: record });
      }
    }
    const children = Array.isArray(entry.value)
      ? entry.value
      : Object.values(entry.value);
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ value: children[index], depth: entry.depth + 1 });
    }
  }
  return localSources;
};

const parseLocalBlob = (value: unknown): LocalBlobReference | undefined => {
  if (!isRecord(value) || value.kind !== "local-blob") return undefined;
  const baseKeys = ["kind", "objectId", "blobKey", "mimeType"] as const;
  const hasCatalogueIdentity = Object.hasOwn(value, "assetId");
  if (!(hasExactKeys(value, baseKeys) ||
      hasExactKeys(value, [...baseKeys, "assetId"])) ||
    typeof value.objectId !== "string" || value.objectId.length === 0 ||
    typeof value.blobKey !== "string" || value.blobKey.length === 0 ||
    typeof value.mimeType !== "string" || !CONTENT_TYPES.has(value.mimeType) ||
    (hasCatalogueIdentity &&
      (typeof value.assetId !== "string" || value.assetId.length === 0 || value.assetId.length > 256))) {
    throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
  }
  return {
    objectId: value.objectId,
    blobKey: value.blobKey,
    mimeType: value.mimeType
  };
};

const parseCloudBlob = (value: unknown): CloudBlobDescriptor | undefined => {
  if (!isRecord(value) || value.kind !== "cloud-blob") return undefined;
  if (!hasExactKeys(value, [
    "kind", "objectId", "blobKey", "mimeType", "byteLength", "sha256"
  ]) || typeof value.objectId !== "string" || value.objectId.length === 0 ||
    typeof value.blobKey !== "string" || value.blobKey.length === 0 ||
    typeof value.mimeType !== "string" || !CONTENT_TYPES.has(value.mimeType) ||
    typeof value.byteLength !== "number" || !Number.isSafeInteger(value.byteLength) ||
    value.byteLength < 1 || value.byteLength > MAX_ASSET_BYTES ||
    typeof value.sha256 !== "string" || !SHA256_PATTERN.test(value.sha256)) {
    throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
  }
  return {
    objectId: value.objectId,
    blobKey: value.blobKey,
    mimeType: value.mimeType,
    byteLength: value.byteLength,
    sha256: value.sha256
  };
};

export function parseCloudProgressDocument(
  value: unknown,
  envelopeDocumentId: string
): CampaignDocumentV1 {
  try {
    assertBoundedCampaignJson(value);
    if (!isRecord(value)) throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
    inspectFabricState(value.fabricState);
    const document = CampaignDocumentSchema.parse(value);
    assertBoundedCampaignJson(document);
    if (document.mode !== "offline" || document.roomId !== undefined ||
      document.documentId !== envelopeDocumentId ||
      !hasCloudProgressPracticeDocumentIdentities(document)) {
      throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
    }
    const fabricLocalSources = inspectFabricState(document.fabricState);
    const objects = campaignSemanticObjectMap(document.fabricState);

    const localByKey = new Map<string, LocalBlobReference>();
    const cloudByKey = new Map<string, CloudBlobDescriptor>();
    for (const reference of document.assetReferences) {
      const local = parseLocalBlob(reference);
      if (local !== undefined) {
        const key = descriptorKey(local);
        if (localByKey.has(key)) throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
        localByKey.set(key, local);
      }
      const cloud = parseCloudBlob(reference);
      if (cloud !== undefined) {
        const key = descriptorKey(cloud);
        if (cloudByKey.has(key)) throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
        cloudByKey.set(key, cloud);
      }
    }

    if (cloudByKey.size !== localByKey.size) {
      throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
    }
    for (const source of fabricLocalSources) {
      const semanticObject = objects.get(source.objectId)?.object;
      if (!localByKey.has(descriptorKey(source)) || semanticObject !== source.object) {
        throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
      }
    }
    for (const [key, local] of localByKey) {
      const cloud = cloudByKey.get(key);
      const object = objects.get(local.objectId)?.object;
      if (cloud === undefined || cloud.mimeType !== local.mimeType ||
        object?.src !== `local-blob:${local.blobKey}`) {
        throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
      }
    }
    for (const key of cloudByKey.keys()) {
      if (!localByKey.has(key)) throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
    }

    const descriptorByBlobKey = new Map<string, CloudBlobDescriptor>();
    const descriptorByHash = new Map<string, CloudBlobDescriptor>();
    for (const descriptor of cloudByKey.values()) {
      const blobKeyMatch = descriptorByBlobKey.get(descriptor.blobKey);
      if (blobKeyMatch !== undefined && (blobKeyMatch.mimeType !== descriptor.mimeType ||
        blobKeyMatch.byteLength !== descriptor.byteLength ||
        blobKeyMatch.sha256 !== descriptor.sha256)) {
        throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
      }
      descriptorByBlobKey.set(descriptor.blobKey, descriptor);

      const hashMatch = descriptorByHash.get(descriptor.sha256);
      if (hashMatch !== undefined && (hashMatch.mimeType !== descriptor.mimeType ||
        hashMatch.byteLength !== descriptor.byteLength)) {
        throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
      }
      descriptorByHash.set(descriptor.sha256, descriptor);
    }
    return document;
  } catch {
    throw new Error("INVALID_CLOUD_PROGRESS_DOCUMENT");
  }
}
