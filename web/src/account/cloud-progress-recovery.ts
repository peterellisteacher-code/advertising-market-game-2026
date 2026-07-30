import type { CampaignDocumentV1 } from "../domain/campaign-document";
import {
  hasCloudProgressPracticeDocumentIdentities,
  selectDistinctPracticeRunIdentity
} from "../domain/practice-identity";
import {
  canonicalDurableDocumentHash,
  type ImportCloudPracticeInput,
  type LocalPracticeRecoveryV1
} from "../persistence/draft-store";
import { AccountClientError, type CloudProgressClient } from "./account-client";
import { AccountAssetClientError } from "./account-asset-client";
import type { CloudProgressAssetRestoreResult } from "./cloud-asset-adapter";

const ACCOUNT_USERNAME = /^[a-z0-9][a-z0-9_-]{2,23}$/u;
const SAFE_RANDOM_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/u;

export interface CloudPracticeRecoveryStore {
  resumeLocalPractice(): Promise<LocalPracticeRecoveryV1 | null>;
  importCloudPractice(input: ImportCloudPracticeInput): Promise<unknown>;
}

export interface CloudProgressAssetRestorePort {
  restore(document: CampaignDocumentV1): Promise<CloudProgressAssetRestoreResult>;
}

export interface CloudProgressRecoveryMetadata {
  setRevision(documentId: string, revision: number): void;
}

export interface CloudProgressRecoveryOptions {
  readonly client: Pick<CloudProgressClient, "list" | "load">;
  readonly store: CloudPracticeRecoveryStore;
  readonly assets: CloudProgressAssetRestorePort;
  readonly metadata: CloudProgressRecoveryMetadata;
  readonly now?: () => Date;
  readonly randomId?: () => string;
}

export type CloudProgressRecoveryResult =
  | { readonly status: "local-present"; readonly documentId: string }
  | { readonly status: "no-cloud-save" }
  | { readonly status: "restored"; readonly documentId: string; readonly revision: number }
  | { readonly status: "restored-local-only"; readonly documentId: string }
  | { readonly status: "unavailable" };

export class CloudProgressRecovery {
  readonly #client: Pick<CloudProgressClient, "list" | "load">;
  readonly #store: CloudPracticeRecoveryStore;
  readonly #assets: CloudProgressAssetRestorePort;
  readonly #metadata: CloudProgressRecoveryMetadata;
  readonly #now: () => Date;
  readonly #randomId: () => string;

  constructor(options: CloudProgressRecoveryOptions) {
    this.#client = options.client;
    this.#store = options.store;
    this.#assets = options.assets;
    this.#metadata = options.metadata;
    this.#now = options.now ?? (() => new Date());
    this.#randomId = options.randomId ?? (() => globalThis.crypto.randomUUID());
  }

  async recoverLatest(username: string): Promise<CloudProgressRecoveryResult> {
    try {
      if (!ACCOUNT_USERNAME.test(username)) return { status: "unavailable" };
      const local = await this.#store.resumeLocalPractice();
      if (local !== null) {
        return { status: "local-present", documentId: local.document.documentId };
      }

      const documents = await this.#client.list();
      const newest = documents[0];
      if (newest === undefined) return { status: "no-cloud-save" };
      const remote = await this.#client.load(newest.documentId);
      if (remote.status === "not-found") return { status: "no-cloud-save" };
      if (remote.document.mode !== "offline" || remote.document.roomId !== undefined ||
        !hasCloudProgressPracticeDocumentIdentities(remote.document) ||
        remote.document.documentId !== newest.documentId) {
        return { status: "unavailable" };
      }

      const restored = await this.#assets.restore(remote.document);
      if (restored.document.mode !== "offline" || restored.document.roomId !== undefined ||
        !hasCloudProgressPracticeDocumentIdentities(restored.document) ||
        restored.document.documentId !== remote.document.documentId ||
        restored.document.sessionId !== remote.document.sessionId ||
        restored.document.teamId !== remote.document.teamId ||
        restored.document.revision !== remote.document.revision ||
        await canonicalDurableDocumentHash(restored.document) !==
          await canonicalDurableDocumentHash(remote.document)) {
        return { status: "unavailable" };
      }

      const id = this.#randomId();
      const now = this.#now();
      if (!SAFE_RANDOM_ID.test(id) || Number.isNaN(now.getTime())) {
        return { status: "unavailable" };
      }
      const runId = selectDistinctPracticeRunIdentity(
        `cloud-recovery-run:${id}`,
        restored.document
      );
      if (runId === undefined) return { status: "unavailable" };
      await this.#store.importCloudPractice({
        runId,
        teamAlias: username,
        document: restored.document,
        blobs: restored.blobs,
        levelLocked: false,
        operationId: `cloud-recovery-import:${id}`,
        savedAt: now.toISOString()
      });

      try {
        this.#metadata.setRevision(remote.document.documentId, remote.revision);
      } catch {
        return { status: "restored-local-only", documentId: remote.document.documentId };
      }
      return {
        status: "restored",
        documentId: remote.document.documentId,
        revision: remote.revision
      };
    } catch (error) {
      if ((error instanceof AccountClientError || error instanceof AccountAssetClientError) &&
        error.code === "AUTHENTICATION_REQUIRED") {
        throw error;
      }
      return { status: "unavailable" };
    }
  }
}

export function cloudRecoveryStatusMessage(result: CloudProgressRecoveryResult): string {
  switch (result.status) {
    case "local-present":
      return "Continue from this device · cloud autosave ready";
    case "no-cloud-save":
      return "Progress saves on this device first.";
    case "restored":
      return "Cloud save restored to this device.";
    case "restored-local-only":
      return "Cloud save restored here · cloud autosave will reconnect";
    case "unavailable":
      return "Saved on this device · cloud copy paused";
  }
}
