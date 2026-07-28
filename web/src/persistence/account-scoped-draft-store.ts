import type { CampaignDocumentV1 } from "../domain/campaign-document";
import { accountStorageNamespace } from "../account/account-storage-namespace";
import {
  IndexedDbDraftStore,
  VolatileDraftStore,
  type BeginLocalPracticeInput,
  type CommitLocalPracticeInput,
  type ImportCloudPracticeInput,
  type LocalPracticeCheckpointV1,
  type LocalPracticeDraftStore,
  type LocalPracticeRecoveryV1
} from "./draft-store";

const ACCOUNT_DATABASE_PREFIX = "advertising-market-campaign-drafts-account-";

export interface AccountScopedDraftStoreOptions {
  readonly factory?: IDBFactory | null;
}

export async function accountDraftDatabaseName(username: string): Promise<string> {
  return `${ACCOUNT_DATABASE_PREFIX}${await accountStorageNamespace(username)}`;
}

export class AccountScopedDraftStore implements LocalPracticeDraftStore {
  readonly #factory: IDBFactory | null;
  #activationGeneration = 0;
  #active: LocalPracticeDraftStore | null = null;
  #activeDatabaseName: string | null = null;

  constructor(options: AccountScopedDraftStoreOptions = {}) {
    if (options.factory !== undefined) {
      this.#factory = options.factory;
      return;
    }
    try {
      this.#factory = typeof globalThis.indexedDB === "object"
        ? globalThis.indexedDB
        : null;
    } catch {
      this.#factory = null;
    }
  }

  async activateAccount(username: string): Promise<void> {
    const generation = ++this.#activationGeneration;
    this.#active = null;
    this.#activeDatabaseName = null;
    const databaseName = await accountDraftDatabaseName(username);
    if (generation !== this.#activationGeneration) {
      throw new DOMException("Account storage activation was superseded", "AbortError");
    }
    let candidate: LocalPracticeDraftStore;
    if (this.#factory === null) {
      candidate = new VolatileDraftStore();
    } else {
      const durable = new IndexedDbDraftStore({
        databaseName,
        factory: this.#factory
      });
      try {
        await durable.resumeLocalPractice();
        candidate = durable;
      } catch {
        candidate = new VolatileDraftStore();
      }
    }
    if (generation !== this.#activationGeneration) {
      throw new DOMException("Account storage activation was superseded", "AbortError");
    }
    this.#active = candidate;
    this.#activeDatabaseName = databaseName;
  }

  deactivateAccount(): void {
    this.#activationGeneration += 1;
    this.#active = null;
    this.#activeDatabaseName = null;
  }

  async resetAccount(username: string): Promise<void> {
    const databaseName = await accountDraftDatabaseName(username);
    if (this.#activeDatabaseName === databaseName) this.deactivateAccount();
    const factory = this.#factory;
    if (factory === null) return;
    await new Promise<void>((resolve, reject) => {
      const request = factory.deleteDatabase(databaseName);
      request.addEventListener("success", () => resolve(), { once: true });
      request.addEventListener("error", () => reject(
        request.error ?? new Error("Unable to reset account drafts")
      ), { once: true });
      request.addEventListener("blocked", () => reject(
        new Error("Account draft reset is blocked")
      ), { once: true });
    });
  }

  async importCloudPractice(input: ImportCloudPracticeInput): Promise<LocalPracticeCheckpointV1> {
    return this.#store().importCloudPractice(input);
  }

  async beginLocalPractice(input: BeginLocalPracticeInput): Promise<LocalPracticeCheckpointV1> {
    return this.#store().beginLocalPractice(input);
  }

  async resumeLocalPractice(): Promise<LocalPracticeRecoveryV1 | null> {
    return this.#store().resumeLocalPractice();
  }

  async commitLocalPractice(input: CommitLocalPracticeInput): Promise<LocalPracticeCheckpointV1> {
    return this.#store().commitLocalPractice(input);
  }

  async save(document: CampaignDocumentV1, blobs: ReadonlyMap<string, Blob>): Promise<void> {
    return this.#store().save(document, blobs);
  }

  async load(documentId: string): Promise<{
    document: CampaignDocumentV1;
    blobs: Map<string, Blob>;
  } | null> {
    return this.#store().load(documentId);
  }

  async loadRevision(documentId: string, revision: number): Promise<{
    document: CampaignDocumentV1;
    blobs: Map<string, Blob>;
  } | null> {
    return this.#store().loadRevision(documentId, revision);
  }

  #store(): LocalPracticeDraftStore {
    if (this.#active === null) throw new Error("Account storage is locked");
    return this.#active;
  }
}
