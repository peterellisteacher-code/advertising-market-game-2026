import type { CampaignDocumentV1 } from "../domain/campaign-document";
import { accountStorageNamespace } from "../account/account-storage-namespace";
import {
  IndexedDbDraftStore,
  type BeginLocalPracticeInput,
  type CommitLocalPracticeInput,
  type ImportCloudPracticeInput,
  type LocalPracticeCheckpointV1,
  type LocalPracticeDraftStore,
  type LocalPracticeRecoveryV1
} from "./draft-store";

const ACCOUNT_DATABASE_PREFIX = "advertising-market-campaign-drafts-account-";

export interface AccountScopedDraftStoreOptions {
  readonly factory?: IDBFactory;
}

export async function accountDraftDatabaseName(username: string): Promise<string> {
  return `${ACCOUNT_DATABASE_PREFIX}${await accountStorageNamespace(username)}`;
}

export class AccountScopedDraftStore implements LocalPracticeDraftStore {
  readonly #factory: IDBFactory | undefined;
  #activationGeneration = 0;
  #active: LocalPracticeDraftStore | null = null;

  constructor(options: AccountScopedDraftStoreOptions = {}) {
    this.#factory = options.factory;
  }

  async activateAccount(username: string): Promise<void> {
    const generation = ++this.#activationGeneration;
    this.#active = null;
    const databaseName = await accountDraftDatabaseName(username);
    if (generation !== this.#activationGeneration) {
      throw new DOMException("Account storage activation was superseded", "AbortError");
    }
    const candidate = this.#factory === undefined
      ? new IndexedDbDraftStore({ databaseName })
      : new IndexedDbDraftStore({ databaseName, factory: this.#factory });
    await candidate.resumeLocalPractice();
    if (generation !== this.#activationGeneration) {
      throw new DOMException("Account storage activation was superseded", "AbortError");
    }
    this.#active = candidate;
  }

  deactivateAccount(): void {
    this.#activationGeneration += 1;
    this.#active = null;
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
