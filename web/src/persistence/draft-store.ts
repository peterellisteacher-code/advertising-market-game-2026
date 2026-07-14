import { CampaignDocumentSchema, type CampaignDocumentV1 } from "../domain/campaign-document";
import { campaignSemanticObjectMap } from "../domain/campaign-semantic-objects";
import { migrateCampaignDocument } from "./draft-migrations";

export const DEFAULT_DRAFT_DATABASE_NAME = "advertising-market-campaign-drafts";
const DATABASE_VERSION = 1;
const DOCUMENTS_STORE = "documents";
const BLOBS_STORE = "blobs";
const DOCUMENT_ID_INDEX = "by-document-id";
const DOCUMENT_REVISION_INDEX = "by-document-revision";

interface DocumentRecord {
  documentId: string;
  revision: number;
  document: unknown;
}

interface BlobRecord {
  documentId: string;
  revision: number;
  blobKey: string;
  blob: Blob;
}

export interface LocalBlobAssetReference {
  kind: "local-blob";
  objectId: string;
  blobKey: string;
  mimeType: string;
}

export interface DraftStore {
  save(document: CampaignDocumentV1, blobs: ReadonlyMap<string, Blob>): Promise<void>;
  load(documentId: string): Promise<{ document: CampaignDocumentV1; blobs: Map<string, Blob> } | null>;
}

export interface IndexedDbDraftStoreOptions {
  databaseName?: string;
  factory?: IDBFactory;
}

export interface ObjectUrlPort {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

export interface RehydratedCampaignDocument {
  document: CampaignDocumentV1;
  ownedUrls: ReadonlySet<string>;
  release(): void;
}

function openRequestResult(request: IDBOpenDBRequest, databaseName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    request.addEventListener("success", () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      resolve(database);
    });
    request.addEventListener("error", () => {
      if (settled) return;
      settled = true;
      reject(request.error ?? new Error("IndexedDB open request failed"));
    });
    request.addEventListener("blocked", () => {
      if (settled) return;
      settled = true;
      reject(new Error(`IndexedDB open for ${databaseName} was blocked`));
    }, { once: true });
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(
      transaction.error ?? new DOMException("IndexedDB transaction aborted", "AbortError")
    ), { once: true });
  });
}

function abortQuietly(transaction: IDBTransaction): void {
  try {
    transaction.abort();
  } catch {
    // The transaction may already have completed or begun aborting.
  }
}

function parseLocalBlobReferences(document: CampaignDocumentV1): LocalBlobAssetReference[] {
  return document.assetReferences.flatMap((reference) => {
    if (reference.kind !== "local-blob") return [];
    const { objectId, blobKey, mimeType } = reference;
    if (typeof objectId !== "string" || !objectId ||
      typeof blobKey !== "string" || !blobKey ||
      typeof mimeType !== "string" || !mimeType) {
      throw new Error("Local blob references require objectId, blobKey and mimeType");
    }
    return [{ kind: "local-blob", objectId, blobKey, mimeType }];
  });
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, canonicalise(child)]));
  }
  return value;
}

function normaliseDurableSources(document: CampaignDocumentV1): CampaignDocumentV1 {
  const clone = CampaignDocumentSchema.parse(structuredClone(document));
  const objects = campaignSemanticObjectMap(clone.fabricState);
  const referencedObjects = new Set<string>();
  for (const reference of parseLocalBlobReferences(clone)) {
    if (referencedObjects.has(reference.objectId)) {
      throw new Error(`Duplicate local blob reference for ${reference.objectId}`);
    }
    referencedObjects.add(reference.objectId);
    const entry = objects.get(reference.objectId);
    if (!entry) throw new Error(`Missing Fabric object ${reference.objectId}`);
    entry.object.src = `local-blob:${reference.blobKey}`;
  }
  return clone;
}

export async function canonicalDurableDocumentHash(document: CampaignDocumentV1): Promise<string> {
  const canonicalJson = JSON.stringify(canonicalise(normaliseDurableSources(document)));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

const browserObjectUrls: ObjectUrlPort = {
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url)
};

export function rehydrateLocalAssetBlobs(
  document: CampaignDocumentV1,
  blobs: ReadonlyMap<string, Blob>,
  urls: ObjectUrlPort = browserObjectUrls
): RehydratedCampaignDocument {
  const clone = CampaignDocumentSchema.parse(structuredClone(document));
  const objects = campaignSemanticObjectMap(clone.fabricState);
  const references = parseLocalBlobReferences(clone);
  const targets = references.map((reference) => {
    const entry = objects.get(reference.objectId);
    if (!entry) throw new Error(`Missing Fabric object ${reference.objectId}`);
    const blob = blobs.get(reference.blobKey);
    if (!(blob instanceof Blob)) throw new Error(`Missing local blob ${reference.blobKey}`);
    if (blob.type !== reference.mimeType) {
      throw new Error(`Local blob ${reference.blobKey} must have MIME type ${reference.mimeType}`);
    }
    return { reference, entry, blob };
  });
  const urlsByBlobKey = new Map<string, string>();
  const ownedUrls = new Set<string>();

  try {
    for (const { reference, entry, blob } of targets) {
      let url = urlsByBlobKey.get(reference.blobKey);
      if (!url) {
        url = urls.createObjectURL(blob);
        urlsByBlobKey.set(reference.blobKey, url);
        ownedUrls.add(url);
      }
      entry.object.src = url;
    }
  } catch (error) {
    ownedUrls.forEach((url) => urls.revokeObjectURL(url));
    throw error;
  }

  let released = false;
  return {
    document: clone,
    ownedUrls,
    release() {
      if (released) return;
      released = true;
      ownedUrls.forEach((url) => urls.revokeObjectURL(url));
    }
  };
}

export class IndexedDbDraftStore implements DraftStore {
  readonly databaseName: string;
  readonly #factory: IDBFactory;

  constructor(options: IndexedDbDraftStoreOptions = {}) {
    this.databaseName = options.databaseName ?? DEFAULT_DRAFT_DATABASE_NAME;
    this.#factory = options.factory ?? globalThis.indexedDB;
  }

  async save(document: CampaignDocumentV1, blobs: ReadonlyMap<string, Blob>): Promise<void> {
    const source = normaliseDurableSources(
      CampaignDocumentSchema.parse(structuredClone(document))
    );
    const blobSnapshot = new Map<string, Blob>();
    for (const [blobKey, blob] of blobs) {
      if (!blobKey) throw new Error("Blob keys must not be empty");
      if (!(blob instanceof Blob)) throw new Error(`Blob ${blobKey} must be a Blob`);
      blobSnapshot.set(blobKey, blob.slice(0, blob.size, blob.type));
    }
    for (const reference of parseLocalBlobReferences(source)) {
      const blob = blobSnapshot.get(reference.blobKey);
      if (!blob) throw new Error(`Missing local blob ${reference.blobKey}`);
      if (blob.type !== reference.mimeType) {
        throw new Error(`Local blob ${reference.blobKey} must have MIME type ${reference.mimeType}`);
      }
    }

    const database = await this.#open();
    const transaction = database.transaction([DOCUMENTS_STORE, BLOBS_STORE], "readwrite");
    const completion = transactionComplete(transaction);
    const documents = transaction.objectStore(DOCUMENTS_STORE);
    const blobStore = transaction.objectStore(BLOBS_STORE);
    const queued = new Promise<void>((resolve, reject) => {
      const latestRequest = documents.index(DOCUMENT_ID_INDEX).openCursor(source.documentId, "prev");
      latestRequest.addEventListener("error", () => reject(
        latestRequest.error ?? new Error("Unable to read latest campaign revision")
      ), { once: true });
      latestRequest.addEventListener("success", () => {
        try {
          const latest = latestRequest.result?.value as DocumentRecord | undefined;
          if (!latest && source.revision !== 0) {
            throw new Error("The first campaign revision must be 0");
          }
          if (latest && source.revision <= latest.revision) {
            throw new Error(`Campaign revision ${source.revision} must be newer than revision ${latest.revision}`);
          }
          documents.put({
            documentId: source.documentId,
            revision: source.revision,
            document: structuredClone(source)
          } satisfies DocumentRecord);
          for (const [blobKey, blob] of blobSnapshot) {
            blobStore.put({
              documentId: source.documentId,
              revision: source.revision,
              blobKey,
              blob
            } satisfies BlobRecord);
          }
          resolve();
        } catch (error) {
          abortQuietly(transaction);
          reject(error);
        }
      }, { once: true });
    });

    try {
      await queued;
      await completion;
    } catch (error) {
      abortQuietly(transaction);
      await completion.catch(() => undefined);
      throw error;
    } finally {
      database.close();
    }
  }

  async load(documentId: string): Promise<{
    document: CampaignDocumentV1;
    blobs: Map<string, Blob>;
  } | null> {
    if (!documentId) throw new Error("Document ID must not be empty");
    const database = await this.#open();
    const transaction = database.transaction([DOCUMENTS_STORE, BLOBS_STORE], "readonly");
    const completion = transactionComplete(transaction);
    const documents = transaction.objectStore(DOCUMENTS_STORE);
    const blobStore = transaction.objectStore(BLOBS_STORE);
    const read = new Promise<{ record: DocumentRecord; blobs: BlobRecord[] } | null>((resolve, reject) => {
      const latestRequest = documents.index(DOCUMENT_ID_INDEX).openCursor(documentId, "prev");
      latestRequest.addEventListener("error", () => reject(
        latestRequest.error ?? new Error("Unable to read latest campaign revision")
      ), { once: true });
      latestRequest.addEventListener("success", () => {
        try {
          const cursor = latestRequest.result;
          if (!cursor) {
            resolve(null);
            return;
          }
          const record = cursor.value as DocumentRecord;
          const blobsRequest = blobStore.index(DOCUMENT_REVISION_INDEX)
            .getAll([record.documentId, record.revision]);
          blobsRequest.addEventListener("error", () => reject(
            blobsRequest.error ?? new Error("Unable to read campaign blobs")
          ), { once: true });
          blobsRequest.addEventListener("success", () => {
            try {
              resolve({
                record,
                blobs: blobsRequest.result as BlobRecord[]
              });
            } catch (error) {
              abortQuietly(transaction);
              reject(error);
            }
          }, { once: true });
        } catch (error) {
          abortQuietly(transaction);
          reject(error);
        }
      }, { once: true });
    });

    try {
      const [result] = await Promise.all([read, completion]);
      if (!result) return null;
      const parsed = migrateCampaignDocument(result.record.document);
      if (parsed.documentId !== result.record.documentId || parsed.revision !== result.record.revision) {
        throw new Error("Stored campaign revision key does not match its document");
      }
      return {
        document: parsed,
        blobs: new Map(result.blobs.map(({ blobKey, blob }) => [
          blobKey,
          blob.slice(0, blob.size, blob.type)
        ]))
      };
    } finally {
      database.close();
    }
  }

  async #open(): Promise<IDBDatabase> {
    const request = this.#factory.open(this.databaseName, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      const transaction = request.transaction;
      if (!transaction) throw new Error("Missing IndexedDB upgrade transaction");
      const documents = database.objectStoreNames.contains(DOCUMENTS_STORE)
        ? transaction.objectStore(DOCUMENTS_STORE)
        : database.createObjectStore(DOCUMENTS_STORE, { keyPath: ["documentId", "revision"] });
      if (!documents.indexNames.contains(DOCUMENT_ID_INDEX)) {
        documents.createIndex(DOCUMENT_ID_INDEX, "documentId");
      }
      const blobs = database.objectStoreNames.contains(BLOBS_STORE)
        ? transaction.objectStore(BLOBS_STORE)
        : database.createObjectStore(BLOBS_STORE, {
          keyPath: ["documentId", "revision", "blobKey"]
        });
      if (!blobs.indexNames.contains(DOCUMENT_REVISION_INDEX)) {
        blobs.createIndex(DOCUMENT_REVISION_INDEX, ["documentId", "revision"]);
      }
    });
    return openRequestResult(request, this.databaseName);
  }
}
