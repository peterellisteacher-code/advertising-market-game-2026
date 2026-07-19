import type { CampaignDocumentV1 } from "../domain/campaign-document";
import { accountStorageNamespace } from "./account-storage-namespace";
import {
  AccountClientError,
  type CloudProgressClient,
  type CloudProgressLoadResult
} from "./account-client";
import { AccountAssetClientError } from "./account-asset-client";

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
  captureScope(): CloudSyncRevisionScope | null;
  getRevision(documentId: string): number;
  setRevision(documentId: string, revision: number): void;
}

export interface CloudSyncRevisionScope {
  getRevision(documentId: string): number;
  setRevision(documentId: string, revision: number): void;
}

export class BrowserCloudSyncMetadataStore implements CloudSyncMetadataStore {
  #activationGeneration = 0;
  #namespace: string | null = null;

  constructor(private readonly storage: CloudSyncStorage = globalThis.localStorage) {}

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
    const raw = this.storage.getItem(key);
    if (raw === null || !/^\d+$/u.test(raw)) return 0;
    const revision = Number(raw);
    return Number.isSafeInteger(revision) && revision > 0 ? revision : 0;
  }

  #setRevision(namespace: string, documentId: string, revision: number): void {
    const key = this.#revisionKey(namespace, documentId);
    if (key === null || !Number.isSafeInteger(revision) || revision < 1) return;
    if (revision <= this.#getRevision(namespace, documentId)) return;
    this.storage.setItem(key, String(revision));
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
    readonly remote?: Extract<CloudProgressLoadResult, { status: "found" }>;
  };

export interface CloudProgressSyncOptions {
  readonly client: CloudProgressClient;
  readonly metadata: CloudSyncMetadataStore;
  readonly assetAdapter?: CloudProgressAssetAdapter;
  readonly onState?: (state: CloudProgressSyncState) => void;
  readonly onAuthenticationRequired?: () => void;
}

const noopAssetAdapter: CloudProgressAssetAdapter = {
  prepare: async (document) => structuredClone(document)
};

export class CloudProgressSync {
  readonly #client: CloudProgressClient;
  readonly #metadata: CloudSyncMetadataStore;
  readonly #assetAdapter: CloudProgressAssetAdapter;
  readonly #onState: ((state: CloudProgressSyncState) => void) | undefined;
  readonly #onAuthenticationRequired: (() => void) | undefined;
  readonly #blockedDocuments = new Set<string>();
  #account: string | null = null;
  #accountEpoch = 0;
  #tail: Promise<void> = Promise.resolve();

  constructor(options: CloudProgressSyncOptions) {
    this.#client = options.client;
    this.#metadata = options.metadata;
    this.#assetAdapter = options.assetAdapter ?? noopAssetAdapter;
    this.#onState = options.onState;
    this.#onAuthenticationRequired = options.onAuthenticationRequired;
  }

  async setAccount(username: string): Promise<void> {
    const accountEpoch = ++this.#accountEpoch;
    this.#account = null;
    this.#blockedDocuments.clear();
    await this.#metadata.activateAccount(username);
    if (accountEpoch !== this.#accountEpoch) return;
    this.#account = username;
    this.#emit({ phase: "idle" });
  }

  signOut(): void {
    this.#accountEpoch += 1;
    this.#account = null;
    this.#blockedDocuments.clear();
    this.#metadata.deactivateAccount();
    this.#emit({ phase: "signed-out" });
  }

  enqueue(document: CampaignDocumentV1): void {
    if (this.#account === null || document.mode !== "offline" ||
      this.#blockedDocuments.has(document.documentId)) return;
    let snapshot: CampaignDocumentV1;
    try {
      snapshot = structuredClone(document);
    } catch {
      this.#emit({ phase: "offline", documentId: document.documentId });
      return;
    }
    const accountEpoch = this.#accountEpoch;
    this.#tail = this.#tail
      .catch(() => undefined)
      .then(() => this.#sync(snapshot, accountEpoch));
  }

  async settled(): Promise<void> {
    await this.#tail;
  }

  async #sync(document: CampaignDocumentV1, accountEpoch: number): Promise<void> {
    if (!this.#isCurrentAccount(accountEpoch) || this.#blockedDocuments.has(document.documentId)) return;
    const metadataScope = this.#metadata.captureScope();
    if (metadataScope === null) return;
    this.#emit({ phase: "syncing", documentId: document.documentId });
    try {
      const prepared = await this.#assetAdapter.prepare(document);
      if (!this.#isCurrentAccount(accountEpoch)) return;
      if (prepared.mode !== "offline" || prepared.documentId !== document.documentId ||
        prepared.revision !== document.revision) {
        throw new Error("Prepared cloud progress document identity does not match");
      }
      const expectedRevision = metadataScope.getRevision(prepared.documentId);
      const result = await this.#client.save(prepared, expectedRevision);
      if (result.status === "saved") {
        metadataScope.setRevision(document.documentId, result.revision);
        if (!this.#isCurrentAccount(accountEpoch)) return;
        this.#emit({
          phase: "synced",
          documentId: document.documentId,
          revision: result.revision
        });
        return;
      }
      if (!this.#isCurrentAccount(accountEpoch)) return;
      this.#blockedDocuments.add(document.documentId);
      const remote = await this.#client.load(document.documentId);
      if (!this.#isCurrentAccount(accountEpoch)) return;
      this.#emit(remote.status === "found"
        ? {
          phase: "conflict",
          documentId: document.documentId,
          currentRevision: result.currentRevision,
          remote
        }
        : {
          phase: "conflict",
          documentId: document.documentId,
          currentRevision: result.currentRevision
        });
    } catch (error) {
      if (!this.#isCurrentAccount(accountEpoch)) return;
      if ((error instanceof AccountClientError || error instanceof AccountAssetClientError) &&
        error.code === "AUTHENTICATION_REQUIRED") {
        this.#accountEpoch += 1;
        this.#account = null;
        this.#blockedDocuments.clear();
        this.#metadata.deactivateAccount();
        this.#emit({ phase: "signed-out" });
        try { this.#onAuthenticationRequired?.(); } catch {}
        return;
      }
      this.#emit({ phase: "offline", documentId: document.documentId });
    }
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
