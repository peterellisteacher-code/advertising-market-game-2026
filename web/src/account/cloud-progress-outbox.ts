import {
  CampaignDocumentSchema,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import { isCloudProgressDocumentId } from "../domain/practice-identity";
import { accountStorageNamespace } from "./account-storage-namespace";

const DEFAULT_DATABASE_PREFIX = "advertising-market-cloud-outbox-";
const DATABASE_VERSION = 1;
const PENDING_STORE = "pending";
const META_STORE = "meta";
const SEQUENCE_KEY = "queue-sequence";

interface PendingRecord {
  readonly documentId: string;
  readonly queueRevision: number;
  readonly document: CampaignDocumentV1;
}

interface MetaRecord {
  readonly key: typeof SEQUENCE_KEY;
  readonly value: number;
}

export interface CloudProgressOutboxEntry {
  readonly documentId: string;
  readonly queueRevision: number;
  readonly document: CampaignDocumentV1;
}

export interface CloudProgressOutbox {
  activateAccount(username: string): Promise<void>;
  deactivateAccount(): void;
  put(document: CampaignDocumentV1): Promise<CloudProgressOutboxEntry>;
  get(documentId: string): Promise<CloudProgressOutboxEntry | null>;
  list(): Promise<readonly CloudProgressOutboxEntry[]>;
  removeIfRevision(documentId: string, queueRevision: number): Promise<boolean>;
}

export interface BrowserCloudProgressOutboxOptions {
  readonly factory?: IDBFactory;
  readonly databasePrefix?: string;
}

function requestResult<T>(request: IDBRequest<T>, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error(message)), {
      once: true
    });
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(
      transaction.error ?? new Error("Cloud outbox transaction aborted")
    ), { once: true });
    transaction.addEventListener("error", () => reject(
      transaction.error ?? new Error("Cloud outbox transaction failed")
    ), { once: true });
  });
}

function cloneEntry(record: PendingRecord): CloudProgressOutboxEntry {
  return {
    documentId: record.documentId,
    queueRevision: record.queueRevision,
    document: structuredClone(record.document)
  };
}

function validatedDocument(value: CampaignDocumentV1): CampaignDocumentV1 {
  const document = CampaignDocumentSchema.parse(structuredClone(value));
  if (document.mode !== "offline" || document.roomId !== undefined ||
    !isCloudProgressDocumentId(document.documentId)) {
    throw new Error("Cloud outbox accepts only cloud-addressable offline campaign documents");
  }
  return document;
}

export class BrowserCloudProgressOutbox implements CloudProgressOutbox {
  readonly #factory: IDBFactory;
  readonly #databasePrefix: string;
  #activationGeneration = 0;
  #database: IDBDatabase | null = null;

  constructor(options: BrowserCloudProgressOutboxOptions = {}) {
    this.#factory = options.factory ?? globalThis.indexedDB;
    this.#databasePrefix = options.databasePrefix ?? DEFAULT_DATABASE_PREFIX;
    if (this.#databasePrefix.length < 1 || this.#databasePrefix.length > 128) {
      throw new Error("Cloud outbox database prefix is invalid");
    }
  }

  async activateAccount(username: string): Promise<void> {
    const generation = ++this.#activationGeneration;
    this.#close();
    const databaseName = `${this.#databasePrefix}${await accountStorageNamespace(username)}`;
    if (generation !== this.#activationGeneration) {
      throw new DOMException("Cloud outbox activation was superseded", "AbortError");
    }
    const database = await this.#open(databaseName);
    if (generation !== this.#activationGeneration) {
      database.close();
      throw new DOMException("Cloud outbox activation was superseded", "AbortError");
    }
    this.#database = database;
  }

  deactivateAccount(): void {
    this.#activationGeneration += 1;
    this.#close();
  }

  async put(value: CampaignDocumentV1): Promise<CloudProgressOutboxEntry> {
    const document = validatedDocument(value);
    const database = this.#active();
    const transaction = database.transaction([PENDING_STORE, META_STORE], "readwrite");
    const completion = transactionComplete(transaction);
    const pending = transaction.objectStore(PENDING_STORE);
    const meta = transaction.objectStore(META_STORE);
    const storedMeta = await requestResult(
      meta.get(SEQUENCE_KEY) as IDBRequest<MetaRecord | undefined>,
      "Unable to read the cloud outbox sequence"
    );
    const previous = storedMeta?.value ?? 0;
    if (!Number.isSafeInteger(previous) || previous < 0 ||
      previous >= Number.MAX_SAFE_INTEGER) {
      transaction.abort();
      await completion.catch(() => undefined);
      throw new Error("Cloud outbox sequence is invalid");
    }
    const queueRevision = previous + 1;
    const record: PendingRecord = {
      documentId: document.documentId,
      queueRevision,
      document
    };
    meta.put({ key: SEQUENCE_KEY, value: queueRevision } satisfies MetaRecord);
    pending.put(record);
    await completion;
    return cloneEntry(record);
  }

  async get(documentId: string): Promise<CloudProgressOutboxEntry | null> {
    if (!isCloudProgressDocumentId(documentId)) return null;
    const transaction = this.#active().transaction(PENDING_STORE, "readonly");
    const completion = transactionComplete(transaction);
    const record = await requestResult(
      transaction.objectStore(PENDING_STORE).get(documentId) as IDBRequest<PendingRecord | undefined>,
      "Unable to read pending cloud progress"
    );
    await completion;
    return record === undefined ? null : cloneEntry(record);
  }

  async list(): Promise<readonly CloudProgressOutboxEntry[]> {
    const transaction = this.#active().transaction(PENDING_STORE, "readonly");
    const completion = transactionComplete(transaction);
    const records = await requestResult(
      transaction.objectStore(PENDING_STORE).getAll() as IDBRequest<PendingRecord[]>,
      "Unable to list pending cloud progress"
    );
    await completion;
    return records
      .sort((left, right) => left.documentId.localeCompare(right.documentId))
      .map(cloneEntry);
  }

  async removeIfRevision(documentId: string, queueRevision: number): Promise<boolean> {
    if (!isCloudProgressDocumentId(documentId) ||
      !Number.isSafeInteger(queueRevision) || queueRevision < 1) return false;
    const transaction = this.#active().transaction(PENDING_STORE, "readwrite");
    const completion = transactionComplete(transaction);
    const store = transaction.objectStore(PENDING_STORE);
    const record = await requestResult(
      store.get(documentId) as IDBRequest<PendingRecord | undefined>,
      "Unable to inspect pending cloud progress"
    );
    const matches = record?.queueRevision === queueRevision;
    if (matches) store.delete(documentId);
    await completion;
    return matches;
  }

  #active(): IDBDatabase {
    if (this.#database === null) throw new Error("Cloud outbox is locked");
    return this.#database;
  }

  #close(): void {
    this.#database?.close();
    this.#database = null;
  }

  #open(databaseName: string): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.#factory.open(databaseName, DATABASE_VERSION);
      request.addEventListener("upgradeneeded", () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PENDING_STORE)) {
          database.createObjectStore(PENDING_STORE, { keyPath: "documentId" });
        }
        if (!database.objectStoreNames.contains(META_STORE)) {
          database.createObjectStore(META_STORE, { keyPath: "key" });
        }
      });
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(
        request.error ?? new Error("Unable to open the cloud outbox")
      ), { once: true });
      request.addEventListener("blocked", () => reject(
        new Error("Cloud outbox upgrade is blocked")
      ), { once: true });
    });
  }
}
