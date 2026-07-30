import {
  LocalPracticeRecoverySchema,
  nextPracticeStage,
  type LocalPracticeRecoveryV1,
  type PracticeAdvanceInput,
  type PracticeRunHandler,
  type PracticeSaveProgressInput,
  type PracticeSetLockInput
} from "../bridge/practice-contracts";
import {
  CampaignDocumentSchema,
  createBlankCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import {
  canonicalDurableDocumentHash,
  selectReferencedLocalAssetBlobs,
  type LocalPracticeDraftStore,
  type LocalPracticeCheckpointV1 as StoredCheckpointV1,
  type LocalPracticeRecoveryV1 as StoredRecoveryV1
} from "./draft-store";

export interface LocalPracticeServiceOptions {
  now?: () => Date;
}

export interface AdoptCloudPracticeInput {
  readonly document: CampaignDocumentV1;
  readonly blobs: ReadonlyMap<string, Blob>;
  readonly operationId: string;
}

function nextUpdatedAt(current: string, now: Date): string {
  const currentTimestamp = Date.parse(current);
  const nextTimestamp = Math.max(
    now.getTime(),
    Number.isFinite(currentTimestamp) ? currentTimestamp + 1 : 0
  );
  return new Date(nextTimestamp).toISOString();
}

async function stableIdSuffix(operationId: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(operationId)
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

function publicRecovery(value: Pick<StoredRecoveryV1, "checkpoint" | "document">): LocalPracticeRecoveryV1 {
  return LocalPracticeRecoverySchema.parse({
    checkpoint: structuredClone(value.checkpoint),
    document: structuredClone(value.document)
  }) as LocalPracticeRecoveryV1;
}

export class LocalPracticeService implements PracticeRunHandler {
  readonly #now: () => Date;

  constructor(
    private readonly store: LocalPracticeDraftStore,
    options: LocalPracticeServiceOptions = {}
  ) {
    this.#now = options.now ?? (() => new Date());
  }

  async resume(): Promise<LocalPracticeRecoveryV1 | null> {
    const recovery = await this.store.resumeLocalPractice();
    return recovery === null ? null : publicRecovery(recovery);
  }

  async begin(teamAlias: string, operationId: string): Promise<LocalPracticeRecoveryV1> {
    const suffix = await stableIdSuffix(operationId);
    const savedAt = this.#now().toISOString();
    const document = createBlankCampaignDocument({
      documentId: `practice-document-${suffix}`,
      sessionId: `practice-session-${suffix}`,
      teamId: `practice-team-${suffix}`,
      mode: "offline"
    });
    document.updatedAt = savedAt;
    const checkpoint = await this.store.beginLocalPractice({
      runId: `practice-run-${suffix}`,
      teamAlias,
      document,
      blobs: new Map(),
      levelLocked: false,
      operationId,
      savedAt
    });
    return this.#recoveryForCheckpoint(checkpoint);
  }

  async setLock(input: PracticeSetLockInput): Promise<LocalPracticeRecoveryV1> {
    const base = await this.#loadBase(input.checkpoint);
    const document = this.#nextDocument(base.document, base.document.gameplay.stage);
    const checkpoint = await this.store.commitLocalPractice({
      expectedDocumentRevision: input.checkpoint.documentRevision,
      expectedSequence: input.checkpoint.sequence,
      document,
      blobs: base.blobs,
      levelLocked: input.levelLocked,
      operationId: input.operationId,
      savedAt: this.#now().toISOString()
    });
    return this.#recoveryForCheckpoint(checkpoint);
  }

  async advance(input: PracticeAdvanceInput): Promise<LocalPracticeRecoveryV1> {
    if (nextPracticeStage(input.checkpoint.stage) !== input.nextStage) {
      throw new Error("Practice advance must move to the next pitch stage");
    }
    const base = await this.#loadBase(input.checkpoint);
    const document = this.#nextDocument(base.document, input.nextStage);
    const checkpoint = await this.store.commitLocalPractice({
      expectedDocumentRevision: input.checkpoint.documentRevision,
      expectedSequence: input.checkpoint.sequence,
      document,
      blobs: base.blobs,
      levelLocked: false,
      operationId: input.operationId,
      savedAt: this.#now().toISOString()
    });
    return this.#recoveryForCheckpoint(checkpoint);
  }

  async commitEditorSnapshot(
    value: CampaignDocumentV1,
    blobs: ReadonlyMap<string, Blob>,
    operationId: string
  ): Promise<LocalPracticeRecoveryV1 | null> {
    const active = await this.store.resumeLocalPractice();
    if (active === null) return null;
    const snapshot = CampaignDocumentSchema.parse(structuredClone(value));
    if (snapshot.mode !== "offline" ||
      snapshot.documentId !== active.checkpoint.documentId ||
      snapshot.sessionId !== active.checkpoint.sessionId ||
      snapshot.teamId !== active.checkpoint.teamId) {
      return null;
    }
    if (snapshot.revision !== active.checkpoint.documentRevision) {
      throw new Error(
        `Editor snapshot revision ${snapshot.revision} is stale; active revision is ${active.checkpoint.documentRevision}`
      );
    }
    if (snapshot.gameplay.stage !== active.checkpoint.stage) {
      throw new Error("Editor snapshot stage does not match the active practice checkpoint");
    }
    const document = CampaignDocumentSchema.parse({
      ...snapshot,
      revision: active.checkpoint.documentRevision + 1,
      updatedAt: nextUpdatedAt(snapshot.updatedAt, this.#now())
    });
    const checkpoint = await this.store.commitLocalPractice({
      expectedDocumentRevision: active.checkpoint.documentRevision,
      expectedSequence: active.checkpoint.sequence,
      document,
      blobs,
      levelLocked: false,
      operationId,
      savedAt: this.#now().toISOString()
    });
    return this.#recoveryForCheckpoint(checkpoint);
  }

  async saveProgress(input: PracticeSaveProgressInput): Promise<LocalPracticeRecoveryV1> {
    const base = await this.#loadBase(input.checkpoint);
    const document = this.#nextDocument(base.document, base.document.gameplay.stage);
    const checkpoint = await this.store.commitLocalPractice({
      expectedDocumentRevision: input.checkpoint.documentRevision,
      expectedSequence: input.checkpoint.sequence,
      document,
      blobs: base.blobs,
      levelLocked: base.checkpoint.levelLocked,
      pitch: input.pitch,
      operationId: input.operationId,
      savedAt: this.#now().toISOString()
    });
    return this.#recoveryForCheckpoint(checkpoint);
  }

  async adoptCloudSnapshot(input: AdoptCloudPracticeInput): Promise<LocalPracticeRecoveryV1> {
    const active = await this.store.resumeLocalPractice();
    if (active === null) throw new Error("There is no active local-practice run");
    const remote = CampaignDocumentSchema.parse(structuredClone(input.document));
    if (remote.mode !== "offline" || remote.roomId !== undefined ||
      remote.documentId !== active.checkpoint.documentId ||
      remote.sessionId !== active.checkpoint.sessionId ||
      remote.teamId !== active.checkpoint.teamId) {
      throw new Error("Cloud snapshot does not match the active local-practice run");
    }
    const now = this.#now();
    const document = CampaignDocumentSchema.parse({
      ...remote,
      revision: active.checkpoint.documentRevision + 1,
      updatedAt: nextUpdatedAt(remote.updatedAt, now)
    });
    const checkpoint = await this.store.commitLocalPractice({
      expectedDocumentRevision: active.checkpoint.documentRevision,
      expectedSequence: active.checkpoint.sequence,
      document,
      blobs: input.blobs,
      levelLocked: false,
      operationId: input.operationId,
      savedAt: now.toISOString()
    });
    return this.#recoveryForCheckpoint(checkpoint);
  }

  async #loadBase(token: PracticeSetLockInput["checkpoint"]): Promise<StoredRecoveryV1> {
    const loaded = await this.store.loadRevision(token.documentId, token.documentRevision);
    if (loaded === null) throw new Error("Practice checkpoint campaign revision is missing");
    const active = await this.store.resumeLocalPractice();
    if (active === null || active.checkpoint.runId !== token.runId) {
      throw new Error("Practice checkpoint run identity is not active");
    }
    if (loaded.document.documentId !== token.documentId ||
      loaded.document.gameplay.stage !== token.stage) {
      throw new Error("Practice checkpoint does not match its campaign revision");
    }
    return {
      checkpoint: {
        ...active.checkpoint,
        documentRevision: token.documentRevision,
        stage: token.stage,
        sequence: token.sequence
      },
      document: loaded.document,
      blobs: selectReferencedLocalAssetBlobs(loaded.document, loaded.blobs)
    };
  }

  #nextDocument(
    base: CampaignDocumentV1,
    stage: CampaignDocumentV1["gameplay"]["stage"]
  ): CampaignDocumentV1 {
    return CampaignDocumentSchema.parse({
      ...structuredClone(base),
      revision: base.revision + 1,
      gameplay: { ...structuredClone(base.gameplay), stage },
      updatedAt: nextUpdatedAt(base.updatedAt, this.#now())
    });
  }

  async #recoveryForCheckpoint(checkpoint: StoredCheckpointV1): Promise<LocalPracticeRecoveryV1> {
    const loaded = await this.store.loadRevision(checkpoint.documentId, checkpoint.documentRevision);
    if (loaded === null) throw new Error("Practice checkpoint campaign revision is missing");
    if (loaded.document.documentId !== checkpoint.documentId ||
      loaded.document.sessionId !== checkpoint.sessionId ||
      loaded.document.teamId !== checkpoint.teamId ||
      loaded.document.revision !== checkpoint.documentRevision ||
      loaded.document.gameplay.stage !== checkpoint.stage ||
      await canonicalDurableDocumentHash(loaded.document) !== checkpoint.documentHash) {
      throw new Error("Practice checkpoint does not match its exact campaign revision");
    }
    selectReferencedLocalAssetBlobs(loaded.document, loaded.blobs);
    return publicRecovery({ checkpoint, document: loaded.document });
  }
}
