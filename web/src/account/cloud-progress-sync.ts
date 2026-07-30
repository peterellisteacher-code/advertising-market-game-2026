import type { CampaignDocumentV1 } from "../domain/campaign-document";
import { accountStorageNamespace } from "./account-storage-namespace";
import {
  AccountClientError,
  type CloudProgressClient,
  type CloudProgressLoadResult
} from "./account-client";
import { AccountAssetClientError } from "./account-asset-client";
import type {
  CloudProgressOutbox,
  CloudProgressOutboxEntry
} from "./cloud-progress-outbox";

const STORAGE_PREFIX = "admarket-cloud-sync@2:";
const REVISION_PREFIX = `${STORAGE_PREFIX}revision:`;
const DOCUMENT_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/u;

export interface CloudSyncStorage {
  readonly length: number;
  clear(): void;
  getItem(key: string): string | null;
  key(index: number): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface CloudSyncMetadataStore {
  activateAccount(username: string): void | Promise<void>;
  deactivateAccount(): void;
  resetAccount(username: string): Promise<void>;
  captureScope(): CloudSyncRevisionScope | null;
  getRevision(documentId: string): number;
  setRevision(documentId: string, revision: number): void;
}

export interface CloudSyncRevisionScope {
  getRevision(documentId: string): number;
  setRevision(documentId: string, revision: number): void;
}

class VolatileCloudSyncStorage implements CloudSyncStorage {
  readonly #values = new Map<string, string>();

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}

function browserCloudSyncStorage(): CloudSyncStorage | null {
  try {
    return typeof globalThis.localStorage === "object"
      ? globalThis.localStorage
      : null;
  } catch {
    return null;
  }
}

export class BrowserCloudSyncMetadataStore implements CloudSyncMetadataStore {
  #activationGeneration = 0;
  #namespace: string | null = null;
  readonly #storage: CloudSyncStorage;

  constructor(storage: CloudSyncStorage | null = browserCloudSyncStorage()) {
    this.#storage = storage ?? new VolatileCloudSyncStorage();
  }

  async activateAccount(username: string): Promise<void> {
    const generation = ++this.#activationGeneration;
    this.#namespace = null;
    const namespace = await accountStorageNamespace(username);
    if (generation !== this.#activationGeneration) {
      throw new DOMException("Cloud metadata activation was superseded", "AbortError");
    }
    this.#namespace = namespace;
  }

  deactivateAccount(): void {
    this.#activationGeneration += 1;
    this.#namespace = null;
  }

  async resetAccount(username: string): Promise<void> {
    const namespace = await accountStorageNamespace(username);
    if (this.#namespace === namespace) this.deactivateAccount();
    const prefix = `${REVISION_PREFIX}${namespace}:`;
    const keys: string[] = [];
    for (let index = 0; index < this.#storage.length; index += 1) {
      const key = this.#storage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => this.#storage.removeItem(key));
  }

  captureScope(): CloudSyncRevisionScope | null {
    const namespace = this.#namespace;
    if (namespace === null) return null;
    return {
      getRevision: (documentId) => this.#getRevision(namespace, documentId),
      setRevision: (documentId, revision) => this.#setRevision(namespace, documentId, revision)
    };
  }

  getRevision(documentId: string): number {
    if (this.#namespace === null) return 0;
    return this.#getRevision(this.#namespace, documentId);
  }

  setRevision(documentId: string, revision: number): void {
    if (this.#namespace === null) return;
    this.#setRevision(this.#namespace, documentId, revision);
  }

  #getRevision(namespace: string, documentId: string): number {
    const key = this.#revisionKey(namespace, documentId);
    if (key === null) return 0;
    const raw = this.#storage.getItem(key);
    if (raw === null || !/^\d+$/u.test(raw)) return 0;
    const revision = Number(raw);
    return Number.isSafeInteger(revision) && revision > 0 ? revision : 0;
  }

  #setRevision(namespace: string, documentId: string, revision: number): void {
    const key = this.#revisionKey(namespace, documentId);
    if (key === null || !Number.isSafeInteger(revision) || revision < 1) return;
    if (revision <= this.#getRevision(namespace, documentId)) return;
    this.#storage.setItem(key, String(revision));
  }

  #revisionKey(namespace: string, documentId: string): string | null {
    if (!DOCUMENT_ID.test(documentId)) return null;
    return `${REVISION_PREFIX}${namespace}:${documentId}`;
  }
}

export interface CloudProgressAssetAdapter {
  /** Uploads any immutable, hash-addressed referenced assets before progress JSON is written. */
  prepare(document: CampaignDocumentV1): Promise<CampaignDocumentV1>;
}

export type CloudProgressSyncState =
  | { readonly phase: "idle" }
  | { readonly phase: "syncing"; readonly documentId: string }
  | { readonly phase: "synced"; readonly documentId: string; readonly revision: number }
  | { readonly phase: "offline"; readonly documentId: string }
  | { readonly phase: "signed-out" }
  | {
    readonly phase: "conflict";
    readonly documentId: string;
    readonly currentRevision: number;
    readonly local: CampaignDocumentV1;
    readonly retryable: boolean;
    readonly remote?: Extract<CloudProgressLoadResult, { status: "found" }>;
  };

export interface CloudProgressSyncOptions {
  readonly client: CloudProgressClient;
  readonly metadata: CloudSyncMetadataStore;
  readonly outbox?: CloudProgressOutbox;
  readonly assetAdapter?: CloudProgressAssetAdapter;
  readonly sendDelayMs?: number;
  readonly onState?: (state: CloudProgressSyncState) => void;
  readonly onAuthenticationRequired?: () => void;
  readonly onUseCloud?: (
    remote: Extract<CloudProgressLoadResult, { status: "found" }>,
    local: CampaignDocumentV1
  ) => Promise<void>;
}

const noopAssetAdapter: CloudProgressAssetAdapter = {
  prepare: async (document) => structuredClone(document)
};

class VolatileCloudProgressOutbox implements CloudProgressOutbox {
  readonly #accounts = new Map<string, Map<string, CloudProgressOutboxEntry>>();
  #active: Map<string, CloudProgressOutboxEntry> | null = null;
  #sequence = 0;

  async activateAccount(username: string): Promise<void> {
    let account = this.#accounts.get(username);
    if (!account) {
      account = new Map();
      this.#accounts.set(username, account);
    }
    this.#active = account;
  }

  deactivateAccount(): void {
    this.#active = null;
  }

  async resetAccount(username: string): Promise<void> {
    const account = this.#accounts.get(username);
    if (this.#active === account) this.#active = null;
    this.#accounts.delete(username);
  }

  async put(document: CampaignDocumentV1): Promise<CloudProgressOutboxEntry> {
    if (!this.#active) throw new Error("Cloud outbox is locked");
    const entry = {
      documentId: document.documentId,
      queueRevision: ++this.#sequence,
      document: structuredClone(document)
    };
    this.#active.set(document.documentId, entry);
    return structuredClone(entry);
  }

  async get(documentId: string): Promise<CloudProgressOutboxEntry | null> {
    const entry = this.#active?.get(documentId);
    return entry ? structuredClone(entry) : null;
  }

  async list(): Promise<readonly CloudProgressOutboxEntry[]> {
    return [...(this.#active?.values() ?? [])].map((entry) => structuredClone(entry));
  }

  async removeIfRevision(documentId: string, queueRevision: number): Promise<boolean> {
    const entry = this.#active?.get(documentId);
    if (!entry || entry.queueRevision !== queueRevision) return false;
    this.#active!.delete(documentId);
    return true;
  }
}

interface CloudProgressConflict {
  readonly entry: CloudProgressOutboxEntry;
  readonly currentRevision: number;
  readonly remote?: Extract<CloudProgressLoadResult, { status: "found" }>;
}

export type CloudProgressConflictChoice = "keep-local" | "use-cloud";

export class CloudProgressSync {
  readonly #client: CloudProgressClient;
  readonly #metadata: CloudSyncMetadataStore;
  readonly #outbox: CloudProgressOutbox;
  readonly #assetAdapter: CloudProgressAssetAdapter;
  readonly #sendDelayMs: number;
  readonly #onState: ((state: CloudProgressSyncState) => void) | undefined;
  readonly #onAuthenticationRequired: (() => void) | undefined;
  readonly #onUseCloud: ((
    remote: Extract<CloudProgressLoadResult, { status: "found" }>,
    local: CampaignDocumentV1
  ) => Promise<void>) | undefined;
  readonly #blockedDocuments = new Set<string>();
  readonly #conflicts = new Map<string, CloudProgressConflict>();
  #account: string | null = null;
  #accountEpoch = 0;
  #writeTail: Promise<void> = Promise.resolve();
  #drain: Promise<void> | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: CloudProgressSyncOptions) {
    this.#client = options.client;
    this.#metadata = options.metadata;
    this.#outbox = options.outbox ?? new VolatileCloudProgressOutbox();
    this.#assetAdapter = options.assetAdapter ?? noopAssetAdapter;
    this.#sendDelayMs = options.sendDelayMs ?? 350;
    if (!Number.isSafeInteger(this.#sendDelayMs) || this.#sendDelayMs < 0 ||
      this.#sendDelayMs > 60_000) {
      throw new Error("Cloud progress send delay is invalid");
    }
    this.#onState = options.onState;
    this.#onAuthenticationRequired = options.onAuthenticationRequired;
    this.#onUseCloud = options.onUseCloud;
  }

  async setAccount(username: string): Promise<void> {
    const accountEpoch = ++this.#accountEpoch;
    this.#account = null;
    this.#blockedDocuments.clear();
    this.#conflicts.clear();
    this.#cancelTimer();
    this.#drain = null;
    await this.#writeTail.catch(() => undefined);
    await Promise.all([
      this.#metadata.activateAccount(username),
      this.#outbox.activateAccount(username)
    ]);
    if (accountEpoch !== this.#accountEpoch) return;
    this.#account = username;
    this.#emit({ phase: "idle" });
    this.#schedule(0, accountEpoch);
  }

  signOut(): void {
    this.#accountEpoch += 1;
    this.#account = null;
    this.#blockedDocuments.clear();
    this.#conflicts.clear();
    this.#cancelTimer();
    this.#drain = null;
    this.#metadata.deactivateAccount();
    this.#outbox.deactivateAccount();
    this.#emit({ phase: "signed-out" });
  }

  enqueue(document: CampaignDocumentV1): void {
    if (this.#account === null || document.mode !== "offline") return;
    let snapshot: CampaignDocumentV1;
    try {
      snapshot = structuredClone(document);
    } catch {
      this.#emit({ phase: "offline", documentId: document.documentId });
      return;
    }
    const accountEpoch = this.#accountEpoch;
    this.#writeTail = this.#writeTail
      .catch(() => undefined)
      .then(async () => {
        if (!this.#isCurrentAccount(accountEpoch)) return;
        try {
          await this.#outbox.put(snapshot);
          if (this.#isCurrentAccount(accountEpoch) &&
            !this.#blockedDocuments.has(snapshot.documentId)) {
            this.#schedule(this.#sendDelayMs, accountEpoch);
          }
        } catch {
          if (this.#isCurrentAccount(accountEpoch)) {
            this.#emit({ phase: "offline", documentId: snapshot.documentId });
          }
        }
      });
  }

  async settled(): Promise<void> {
    for (;;) {
      const writes = this.#writeTail;
      await writes;
      this.#cancelTimer();
      const accountEpoch = this.#accountEpoch;
      await this.#startDrain(accountEpoch);
      if (writes === this.#writeTail && this.#drain === null && this.#timer === null) return;
    }
  }

  retry(documentId: string): void {
    if (this.#account === null || !this.#conflicts.has(documentId)) return;
    this.#blockedDocuments.delete(documentId);
    this.#conflicts.delete(documentId);
    this.#schedule(0, this.#accountEpoch);
  }

  async resolveConflict(
    documentId: string,
    choice: CloudProgressConflictChoice
  ): Promise<void> {
    const initialConflict = this.#conflicts.get(documentId);
    if (!initialConflict || this.#account === null) {
      throw new Error("Cloud conflict is no longer available");
    }
    const accountEpoch = this.#accountEpoch;
    await this.#writeTail;
    if (!this.#isCurrentAccount(accountEpoch)) {
      throw new Error("Cloud conflict is no longer available");
    }
    const conflict = this.#conflicts.get(documentId);
    if (!conflict) throw new Error("Cloud conflict is no longer available");
    const metadataScope = this.#metadata.captureScope();
    if (metadataScope === null) throw new Error("Cloud metadata is unavailable");
    const newestEntry = await this.#outbox.get(documentId) ?? conflict.entry;
    if (!this.#isCurrentAccount(accountEpoch)) {
      throw new Error("Cloud conflict is no longer available");
    }
    if (choice === "keep-local") {
      metadataScope.setRevision(documentId, conflict.currentRevision);
      this.#blockedDocuments.delete(documentId);
      this.#conflicts.delete(documentId);
      this.#schedule(0, accountEpoch);
      return;
    }
    if (!conflict.remote || !this.#onUseCloud) {
      throw new Error("Cloud copy could not be loaded safely");
    }
    await this.#onUseCloud(
      structuredClone(conflict.remote),
      structuredClone(newestEntry.document)
    );
    if (!this.#isCurrentAccount(accountEpoch)) return;
    metadataScope.setRevision(documentId, conflict.remote.revision);
    const removed = await this.#outbox.removeIfRevision(documentId, newestEntry.queueRevision);
    this.#blockedDocuments.delete(documentId);
    this.#conflicts.delete(documentId);
    this.#emit({
      phase: "synced",
      documentId,
      revision: conflict.remote.revision
    });
    if (!removed) this.#schedule(0, accountEpoch);
  }

  async #drainOutbox(accountEpoch: number): Promise<void> {
    if (!this.#isCurrentAccount(accountEpoch)) return;
    let entries: readonly CloudProgressOutboxEntry[];
    try {
      entries = await this.#outbox.list();
    } catch {
      return;
    }
    for (const initial of entries) {
      let entry: CloudProgressOutboxEntry | null = initial;
      while (entry !== null && this.#isCurrentAccount(accountEpoch) &&
        !this.#blockedDocuments.has(entry.documentId)) {
        const saved = await this.#syncEntry(entry, accountEpoch);
        if (!saved || !this.#isCurrentAccount(accountEpoch)) break;
        const removed = await this.#outbox.removeIfRevision(
          entry.documentId,
          entry.queueRevision
        );
        if (removed) break;
        entry = await this.#outbox.get(entry.documentId);
      }
    }
  }

  async #syncEntry(
    entry: CloudProgressOutboxEntry,
    accountEpoch: number
  ): Promise<boolean> {
    const document = entry.document;
    if (!this.#isCurrentAccount(accountEpoch) ||
      this.#blockedDocuments.has(document.documentId)) return false;
    const metadataScope = this.#metadata.captureScope();
    if (metadataScope === null) return false;
    this.#emit({ phase: "syncing", documentId: document.documentId });
    try {
      const prepared = await this.#assetAdapter.prepare(document);
      if (!this.#isCurrentAccount(accountEpoch)) return false;
      if (prepared.mode !== "offline" || prepared.documentId !== document.documentId ||
        prepared.revision !== document.revision) {
        throw new Error("Prepared cloud progress document identity does not match");
      }
      const expectedRevision = metadataScope.getRevision(prepared.documentId);
      const result = await this.#client.save(prepared, expectedRevision);
      if (result.status === "saved") {
        metadataScope.setRevision(document.documentId, result.revision);
        if (!this.#isCurrentAccount(accountEpoch)) return false;
        this.#emit({
          phase: "synced",
          documentId: document.documentId,
          revision: result.revision
        });
        return true;
      }
      if (!this.#isCurrentAccount(accountEpoch)) return false;
      this.#blockedDocuments.add(document.documentId);
      let remote: Extract<CloudProgressLoadResult, { status: "found" }> | undefined;
      try {
        const loaded = await this.#client.load(document.documentId);
        if (loaded.status === "found") remote = loaded;
      } catch (error) {
        if ((error instanceof AccountClientError || error instanceof AccountAssetClientError) &&
          error.code === "AUTHENTICATION_REQUIRED") throw error;
      }
      if (!this.#isCurrentAccount(accountEpoch)) return false;
      const conflict: CloudProgressConflict = {
        entry: structuredClone(entry),
        currentRevision: result.currentRevision,
        ...(remote === undefined ? {} : { remote: structuredClone(remote) })
      };
      this.#conflicts.set(document.documentId, conflict);
      this.#emit({
          phase: "conflict",
          documentId: document.documentId,
          currentRevision: result.currentRevision,
          local: structuredClone(document),
          retryable: true,
          ...(remote === undefined ? {} : { remote: structuredClone(remote) })
      });
      return false;
    } catch (error) {
      if (!this.#isCurrentAccount(accountEpoch)) return false;
      if ((error instanceof AccountClientError || error instanceof AccountAssetClientError) &&
        error.code === "AUTHENTICATION_REQUIRED") {
        this.#accountEpoch += 1;
        this.#account = null;
        this.#blockedDocuments.clear();
        this.#conflicts.clear();
        this.#cancelTimer();
        this.#metadata.deactivateAccount();
        this.#outbox.deactivateAccount();
        this.#emit({ phase: "signed-out" });
        try { this.#onAuthenticationRequired?.(); } catch {}
        return false;
      }
      this.#emit({ phase: "offline", documentId: document.documentId });
      return false;
    }
  }

  #schedule(delayMs: number, accountEpoch: number): void {
    if (!this.#isCurrentAccount(accountEpoch) || this.#timer !== null) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.#startDrain(accountEpoch);
    }, delayMs);
  }

  #startDrain(accountEpoch: number): Promise<void> {
    if (!this.#isCurrentAccount(accountEpoch)) return Promise.resolve();
    if (this.#drain !== null) return this.#drain;
    const operation = this.#drainOutbox(accountEpoch)
      .catch(() => undefined)
      .finally(() => {
        if (this.#drain === operation) this.#drain = null;
      });
    this.#drain = operation;
    return operation;
  }

  #cancelTimer(): void {
    if (this.#timer === null) return;
    clearTimeout(this.#timer);
    this.#timer = null;
  }

  #isCurrentAccount(accountEpoch: number): boolean {
    return this.#account !== null && this.#accountEpoch === accountEpoch;
  }

  #emit(state: CloudProgressSyncState): void {
    try { this.#onState?.(state); } catch {}
  }
}

export function queueCloudProgressAfterLocalSave(
  sync: Pick<CloudProgressSync, "enqueue"> | null,
  document: CampaignDocumentV1
): void {
  try { sync?.enqueue(document); } catch {}
}
