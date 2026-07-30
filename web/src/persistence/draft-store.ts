import {
  LOCAL_PRACTICE_CHECKPOINT_CONTRACT as PRACTICE_CHECKPOINT_CONTRACT,
  LocalPracticeCheckpointSchema as PracticeCheckpointSchema,
  type AgencyRunSnapshotV1,
  type LocalPracticeCheckpointV1 as PracticeCheckpointV1
} from "../bridge/practice-contracts";
import {
  CampaignDocumentSchema,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import { assertBoundedCampaignJson } from "../domain/bounded-campaign-json";
import { campaignSemanticObjectMap } from "../domain/campaign-semantic-objects";
import { hasCloudProgressPracticeDocumentIdentities } from "../domain/practice-identity";
import { migrateCampaignDocument } from "./draft-migrations";

export const DEFAULT_DRAFT_DATABASE_NAME = "advertising-market-campaign-drafts";
const DATABASE_VERSION = 2;
const DOCUMENTS_STORE = "documents";
const BLOBS_STORE = "blobs";
const LOCAL_PRACTICE_CHECKPOINTS_STORE = "local-practice-checkpoints";
const LOCAL_PRACTICE_OPERATIONS_STORE = "local-practice-operations";
const LOCAL_PRACTICE_RUNS_STORE = "local-practice-runs";
const DOCUMENT_ID_INDEX = "by-document-id";
const DOCUMENT_REVISION_INDEX = "by-document-revision";
const ACTIVE_LOCAL_PRACTICE_SLOT = "active";
const LOCAL_PRACTICE_DOCUMENT_INDEX = "by-document-id";
const LOCAL_PRACTICE_SESSION_INDEX = "by-session-id";
const LOCAL_PRACTICE_TEAM_INDEX = "by-team-id";
const DEFAULT_RETAINED_REVISIONS = 5;

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

interface LocalPracticeCheckpointRecord {
  slot: typeof ACTIVE_LOCAL_PRACTICE_SLOT;
  checkpoint: unknown;
}

interface LocalPracticeOperationRecord {
  operationId: string;
  fingerprint: string;
  checkpoint: unknown;
}

interface LocalPracticeRunRecord {
  runId: string;
  documentId: string;
  sessionId: string;
  teamId: string;
  teamAlias: string;
}

export const LOCAL_PRACTICE_CHECKPOINT_CONTRACT = PRACTICE_CHECKPOINT_CONTRACT;
export const LocalPracticeCheckpointSchema = PracticeCheckpointSchema;
export type LocalPracticeCheckpointV1 = PracticeCheckpointV1;

export interface LocalPracticeRecoveryV1 {
  checkpoint: LocalPracticeCheckpointV1;
  document: CampaignDocumentV1;
  blobs: Map<string, Blob>;
}

export interface BeginLocalPracticeInput {
  runId: string;
  teamAlias: string;
  document: CampaignDocumentV1;
  blobs: ReadonlyMap<string, Blob>;
  levelLocked: boolean;
  operationId: string;
  savedAt: string;
}

export interface ImportCloudPracticeInput {
  runId: string;
  teamAlias: string;
  document: CampaignDocumentV1;
  blobs: ReadonlyMap<string, Blob>;
  levelLocked: boolean;
  operationId: string;
  savedAt: string;
}

export interface CommitLocalPracticeInput {
  expectedDocumentRevision: number;
  expectedSequence: number;
  document: CampaignDocumentV1;
  blobs: ReadonlyMap<string, Blob>;
  levelLocked: boolean;
  pitch?: AgencyRunSnapshotV1;
  operationId: string;
  savedAt: string;
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
  loadRevision(
    documentId: string,
    revision: number
  ): Promise<{ document: CampaignDocumentV1; blobs: Map<string, Blob> } | null>;
}

export interface LocalPracticeDraftStore extends DraftStore {
  importCloudPractice(input: ImportCloudPracticeInput): Promise<LocalPracticeCheckpointV1>;
  beginLocalPractice(input: BeginLocalPracticeInput): Promise<LocalPracticeCheckpointV1>;
  resumeLocalPractice(): Promise<LocalPracticeRecoveryV1 | null>;
  commitLocalPractice(input: CommitLocalPracticeInput): Promise<LocalPracticeCheckpointV1>;
}

export interface IndexedDbDraftStoreOptions {
  databaseName?: string;
  factory?: IDBFactory;
  retainedRevisions?: number;
  writeAttemptHook?: (kind: "save" | "commit", attempt: 0 | 1) => void;
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

function requestResult<T>(request: IDBRequest<T>, fallbackMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(
      request.error ?? new Error(fallbackMessage)
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

function isQuotaExceededError(error: unknown): boolean {
  return typeof error === "object" && error !== null &&
    "name" in error && error.name === "QuotaExceededError";
}

function deleteCursorRange(request: IDBRequest<IDBCursorWithValue | null>): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    request.addEventListener("error", () => reject(
      request.error ?? new Error("Unable to prune old campaign records")
    ), { once: true });
    request.addEventListener("success", () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    });
  });
}

function queueRetentionPrune(
  transaction: IDBTransaction,
  documentId: string,
  newestRevision: number,
  retainedRevisions: number
): Promise<void> {
  const firstRetained = newestRevision - retainedRevisions + 1;
  if (firstRetained <= 0) return Promise.resolve();
  const oldRevisionRange = IDBKeyRange.bound(
    [documentId, 0],
    [documentId, firstRetained - 1]
  );
  const documents = transaction.objectStore(DOCUMENTS_STORE);
  const blobs = transaction.objectStore(BLOBS_STORE);
  const operations = transaction.objectStore(LOCAL_PRACTICE_OPERATIONS_STORE);
  const documentDeletion = deleteCursorRange(documents.openCursor(oldRevisionRange));
  const blobDeletion = deleteCursorRange(
    blobs.index(DOCUMENT_REVISION_INDEX).openCursor(oldRevisionRange)
  );
  const operationDeletion = requestResult(
    operations.getAll() as IDBRequest<LocalPracticeOperationRecord[]>,
    "Unable to inspect old local-practice operations"
  ).then((records) => {
    for (const record of records) {
      try {
        const checkpoint = LocalPracticeCheckpointSchema.parse(record.checkpoint);
        if (checkpoint.documentId === documentId &&
          checkpoint.documentRevision < firstRetained) {
          operations.delete(record.operationId);
        }
      } catch {
        // Do not destroy an unrecognised operation record during routine retention.
      }
    }
  });
  return Promise.all([documentDeletion, blobDeletion, operationDeletion]).then(() => undefined);
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

export function selectReferencedLocalAssetBlobs(
  document: CampaignDocumentV1,
  blobs: ReadonlyMap<string, Blob>
): Map<string, Blob> {
  const selected = new Map<string, Blob>();
  for (const reference of parseLocalBlobReferences(document)) {
    const blob = blobs.get(reference.blobKey);
    if (!(blob instanceof Blob)) throw new Error(`Missing local blob ${reference.blobKey}`);
    if (blob.type !== reference.mimeType) {
      throw new Error(`Local blob ${reference.blobKey} must have MIME type ${reference.mimeType}`);
    }
    if (!selected.has(reference.blobKey)) {
      selected.set(reference.blobKey, blob.slice(0, blob.size, blob.type));
    }
  }
  return selected;
}

function canonicaliseUnchecked(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicaliseUnchecked);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, canonicaliseUnchecked(child)]));
  }
  return value;
}

function canonicalise(value: unknown): unknown {
  assertBoundedCampaignJson(value);
  return canonicaliseUnchecked(value);
}

async function sha256Hex(bytes: BufferSource): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function canonicalValueHash(value: unknown): Promise<string> {
  return sha256Hex(new TextEncoder().encode(JSON.stringify(canonicalise(value))));
}

async function localPracticeOperationFingerprint(
  metadata: Record<string, unknown>,
  blobs: ReadonlyMap<string, Blob>
): Promise<string> {
  const blobEntries = [...blobs.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  const blobFingerprints = await Promise.all(blobEntries.map(async ([blobKey, blob]) => ({
    blobKey,
    mimeType: blob.type,
    size: blob.size,
    bodyHash: await sha256Hex(new Uint8Array(await blob.arrayBuffer()))
  })));
  return canonicalValueHash({ ...metadata, blobs: blobFingerprints });
}

function semanticCheckpointInput(checkpoint: LocalPracticeCheckpointV1): Omit<
  LocalPracticeCheckpointV1,
  "savedAt" | "documentHash"
> {
  const {
    savedAt: _attemptTimestamp,
    documentHash: _timestampSensitiveDocumentHash,
    ...semantic
  } = checkpoint;
  return semantic;
}

async function semanticDurableDocumentInputHash(document: CampaignDocumentV1): Promise<string> {
  const {
    updatedAt: _attemptTimestamp,
    ...semantic
  } = normaliseDurableSources(document);
  return canonicalValueHash(semantic);
}

function checkpointsMatch(
  left: LocalPracticeCheckpointV1,
  right: LocalPracticeCheckpointV1
): boolean {
  return JSON.stringify(canonicalise(left)) === JSON.stringify(canonicalise(right));
}

async function recoveryOperationFingerprint(
  checkpoint: LocalPracticeCheckpointV1,
  document: CampaignDocumentV1,
  blobs: ReadonlyMap<string, Blob>
): Promise<string> {
  const documentInputHash = await semanticDurableDocumentInputHash(document);
  if (checkpoint.documentRevision === 0 && checkpoint.sequence === 0) {
    return localPracticeOperationFingerprint({
      kind: "begin",
      checkpoint: semanticCheckpointInput(checkpoint),
      documentInputHash
    }, blobs);
  }
  if (checkpoint.documentRevision === 0 || checkpoint.sequence === 0) {
    throw new Error("Active local-practice checkpoint progression is invalid");
  }
  return localPracticeOperationFingerprint({
    kind: "commit",
    expectedDocumentRevision: checkpoint.documentRevision - 1,
    expectedSequence: checkpoint.sequence - 1,
    levelLocked: checkpoint.levelLocked,
    ...(checkpoint.pitch === undefined ? {} : { pitch: checkpoint.pitch }),
    documentInputHash
  }, blobs);
}

function normaliseDurableSources(document: CampaignDocumentV1): CampaignDocumentV1 {
  assertBoundedCampaignJson(document);
  const clone = CampaignDocumentSchema.parse(structuredClone(document));
  assertBoundedCampaignJson(clone);
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
  return sha256Hex(new TextEncoder().encode(canonicalJson));
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

interface VolatileDraftRevision {
  readonly document: CampaignDocumentV1;
  readonly blobs: Map<string, Blob>;
}

function cloneVolatileBlobs(blobs: ReadonlyMap<string, Blob>): Map<string, Blob> {
  return new Map([...blobs].map(([key, blob]) => [
    key,
    blob.slice(0, blob.size, blob.type)
  ]));
}

/**
 * A deliberately session-only draft store for browsers that deny IndexedDB.
 * Its owner must create a fresh instance for each account activation.
 */
export class VolatileDraftStore implements LocalPracticeDraftStore {
  readonly #documents = new Map<string, Map<number, VolatileDraftRevision>>();
  readonly #operations = new Map<string, LocalPracticeOperationRecord>();
  readonly #runs = new Map<string, LocalPracticeRunRecord>();
  #activeCheckpoint: LocalPracticeCheckpointV1 | null = null;

  async importCloudPractice(
    input: ImportCloudPracticeInput
  ): Promise<LocalPracticeCheckpointV1> {
    const source = normaliseDurableSources(
      CampaignDocumentSchema.parse(structuredClone(input.document))
    );
    if (source.mode !== "offline" || source.roomId !== undefined) {
      throw new Error("Cloud practice import requires an offline campaign document without a room");
    }
    if (!source.teamId) {
      throw new Error("Cloud practice import requires a team identity in the campaign document");
    }
    this.#validateStartIdentities(input.runId, source);
    if (!hasCloudProgressPracticeDocumentIdentities(source)) {
      throw new Error("Cloud-practice document identity is not cloud-addressable");
    }
    const blobSnapshot = selectReferencedLocalAssetBlobs(source, input.blobs);
    const checkpoint = LocalPracticeCheckpointSchema.parse({
      contract: LOCAL_PRACTICE_CHECKPOINT_CONTRACT,
      runId: input.runId,
      documentId: source.documentId,
      sessionId: source.sessionId,
      teamId: source.teamId,
      teamAlias: input.teamAlias,
      documentRevision: source.revision,
      documentHash: await canonicalDurableDocumentHash(source),
      stage: source.gameplay.stage,
      levelLocked: input.levelLocked,
      sequence: source.revision,
      operationId: input.operationId,
      savedAt: input.savedAt
    });
    const fingerprint = await recoveryOperationFingerprint(
      checkpoint,
      source,
      blobSnapshot
    );
    if (this.#activeCheckpoint !== null) {
      throw new Error("An active local-practice checkpoint already exists");
    }
    if (this.#operations.has(input.operationId)) {
      throw new Error(`Cloud-practice operation identity ${input.operationId} was already used`);
    }
    this.#assertUnusedRun(checkpoint);
    if (this.#documents.has(source.documentId)) {
      throw new Error(`Cloud-practice document identity ${source.documentId} is already in use`);
    }
    this.#putRevision(source, blobSnapshot);
    this.#activeCheckpoint = structuredClone(checkpoint);
    this.#operations.set(input.operationId, {
      operationId: input.operationId,
      fingerprint,
      checkpoint: structuredClone(checkpoint)
    });
    this.#runs.set(input.runId, {
      runId: input.runId,
      documentId: source.documentId,
      sessionId: source.sessionId,
      teamId: source.teamId,
      teamAlias: input.teamAlias
    });
    return LocalPracticeCheckpointSchema.parse(structuredClone(checkpoint));
  }

  async beginLocalPractice(
    input: BeginLocalPracticeInput
  ): Promise<LocalPracticeCheckpointV1> {
    const source = normaliseDurableSources(
      CampaignDocumentSchema.parse(structuredClone(input.document))
    );
    if (source.mode !== "offline" || source.roomId !== undefined) {
      throw new Error("Local practice requires an offline campaign document");
    }
    if (source.revision !== 0) {
      throw new Error("A local-practice run must begin at campaign revision 0");
    }
    if (!source.teamId) {
      throw new Error("Local practice requires a team identity in the campaign document");
    }
    this.#validateStartIdentities(input.runId, source);
    const blobSnapshot = selectReferencedLocalAssetBlobs(source, input.blobs);
    const checkpoint = LocalPracticeCheckpointSchema.parse({
      contract: LOCAL_PRACTICE_CHECKPOINT_CONTRACT,
      runId: input.runId,
      documentId: source.documentId,
      sessionId: source.sessionId,
      teamId: source.teamId,
      teamAlias: input.teamAlias,
      documentRevision: source.revision,
      documentHash: await canonicalDurableDocumentHash(source),
      stage: source.gameplay.stage,
      levelLocked: input.levelLocked,
      sequence: 0,
      operationId: input.operationId,
      savedAt: input.savedAt
    });
    const fingerprint = await localPracticeOperationFingerprint({
      kind: "begin",
      checkpoint: semanticCheckpointInput(checkpoint),
      documentInputHash: await semanticDurableDocumentInputHash(source)
    }, blobSnapshot);
    const prior = this.#operations.get(input.operationId);
    if (prior) {
      if (prior.fingerprint !== fingerprint) {
        throw new Error("Local-practice operation ID was already used with different input");
      }
      const priorCheckpoint = LocalPracticeCheckpointSchema.parse(prior.checkpoint);
      if (this.#activeCheckpoint === null ||
        !checkpointsMatch(this.#activeCheckpoint, priorCheckpoint)) {
        throw new Error("Local-practice operation retry is stale");
      }
      return LocalPracticeCheckpointSchema.parse(structuredClone(priorCheckpoint));
    }
    this.#assertUnusedRun(checkpoint);
    if (this.#documents.has(source.documentId)) {
      throw new Error(`Local-practice document identity ${source.documentId} is already in use`);
    }
    this.#putRevision(source, blobSnapshot);
    this.#activeCheckpoint = structuredClone(checkpoint);
    this.#operations.set(input.operationId, {
      operationId: input.operationId,
      fingerprint,
      checkpoint: structuredClone(checkpoint)
    });
    this.#runs.set(input.runId, {
      runId: input.runId,
      documentId: source.documentId,
      sessionId: source.sessionId,
      teamId: source.teamId,
      teamAlias: input.teamAlias
    });
    return LocalPracticeCheckpointSchema.parse(structuredClone(checkpoint));
  }

  async resumeLocalPractice(): Promise<LocalPracticeRecoveryV1 | null> {
    if (this.#activeCheckpoint === null) return null;
    const checkpoint = LocalPracticeCheckpointSchema.parse(
      structuredClone(this.#activeCheckpoint)
    );
    const run = this.#runs.get(checkpoint.runId);
    if (!run || run.documentId !== checkpoint.documentId ||
      run.sessionId !== checkpoint.sessionId || run.teamId !== checkpoint.teamId ||
      run.teamAlias !== checkpoint.teamAlias) {
      throw new Error("Active local-practice checkpoint run identity is invalid");
    }
    const operation = this.#operations.get(checkpoint.operationId);
    if (!operation || !/^[0-9a-f]{64}$/u.test(operation.fingerprint)) {
      throw new Error("Active local-practice checkpoint operation result is invalid");
    }
    const operationCheckpoint = LocalPracticeCheckpointSchema.parse(operation.checkpoint);
    if (!checkpointsMatch(operationCheckpoint, checkpoint)) {
      throw new Error("Active local-practice checkpoint diverges from its operation result");
    }
    const stored = await this.loadRevision(
      checkpoint.documentId,
      checkpoint.documentRevision
    );
    if (!stored) throw new Error("Active local-practice campaign revision is missing");
    const { document } = stored;
    if (document.mode !== "offline" || document.roomId !== undefined ||
      document.documentId !== checkpoint.documentId ||
      document.sessionId !== checkpoint.sessionId ||
      document.teamId !== checkpoint.teamId ||
      document.revision !== checkpoint.documentRevision) {
      throw new Error("Active local-practice checkpoint identity does not match its campaign");
    }
    if (document.gameplay.stage !== checkpoint.stage) {
      throw new Error("Active local-practice checkpoint stage does not match its campaign");
    }
    if (await canonicalDurableDocumentHash(document) !== checkpoint.documentHash) {
      throw new Error("Active local-practice checkpoint hash does not match its campaign");
    }
    const referencedBlobs = selectReferencedLocalAssetBlobs(document, stored.blobs);
    if (await recoveryOperationFingerprint(
      checkpoint,
      document,
      referencedBlobs
    ) !== operation.fingerprint) {
      throw new Error("Active local-practice recovery integrity fingerprint does not match its operation");
    }
    return {
      checkpoint: LocalPracticeCheckpointSchema.parse(structuredClone(checkpoint)),
      document,
      blobs: referencedBlobs
    };
  }

  async commitLocalPractice(
    input: CommitLocalPracticeInput
  ): Promise<LocalPracticeCheckpointV1> {
    if (!Number.isSafeInteger(input.expectedDocumentRevision) ||
      input.expectedDocumentRevision < 0 ||
      !Number.isSafeInteger(input.expectedSequence) ||
      input.expectedSequence < 0) {
      throw new Error("Expected local-practice revision and sequence must be non-negative safe integers");
    }
    const source = normaliseDurableSources(
      CampaignDocumentSchema.parse(structuredClone(input.document))
    );
    if (source.mode !== "offline" || source.roomId !== undefined) {
      throw new Error("Local practice requires an offline campaign document");
    }
    if (source.revision !== input.expectedDocumentRevision + 1) {
      throw new Error("A local-practice commit must advance the campaign revision by exactly one");
    }
    const blobSnapshot = selectReferencedLocalAssetBlobs(source, input.blobs);
    const active = await this.resumeLocalPractice();
    if (!active) throw new Error("There is no active local-practice run");
    const pitch = input.pitch ?? active.checkpoint.pitch;
    const fingerprint = await localPracticeOperationFingerprint({
      kind: "commit",
      expectedDocumentRevision: input.expectedDocumentRevision,
      expectedSequence: input.expectedSequence,
      levelLocked: input.levelLocked,
      ...(pitch === undefined ? {} : { pitch }),
      documentInputHash: await semanticDurableDocumentInputHash(source)
    }, blobSnapshot);
    const checkpoint = LocalPracticeCheckpointSchema.parse({
      ...active.checkpoint,
      documentRevision: source.revision,
      documentHash: await canonicalDurableDocumentHash(source),
      stage: source.gameplay.stage,
      levelLocked: input.levelLocked,
      sequence: input.expectedSequence + 1,
      operationId: input.operationId,
      savedAt: input.savedAt,
      ...(pitch === undefined ? {} : { pitch })
    });
    const prior = this.#operations.get(input.operationId);
    if (prior) {
      if (prior.fingerprint !== fingerprint) {
        throw new Error("Local-practice operation ID was already used with different input");
      }
      const priorCheckpoint = LocalPracticeCheckpointSchema.parse(prior.checkpoint);
      if (this.#activeCheckpoint === null ||
        !checkpointsMatch(this.#activeCheckpoint, priorCheckpoint)) {
        throw new Error("Local-practice operation retry is stale");
      }
      return LocalPracticeCheckpointSchema.parse(structuredClone(priorCheckpoint));
    }
    const current = this.#activeCheckpoint;
    if (current === null) throw new Error("There is no active local-practice run");
    if (current.documentRevision !== input.expectedDocumentRevision ||
      current.sequence !== input.expectedSequence) {
      throw new Error("Local-practice commit base is stale");
    }
    if (source.documentId !== current.documentId ||
      source.sessionId !== current.sessionId ||
      source.teamId !== current.teamId) {
      throw new Error("Local-practice campaign identity cannot change during a run");
    }
    if (this.#latestRevision(source.documentId) !== input.expectedDocumentRevision) {
      throw new Error("Local-practice campaign revision base is stale");
    }
    this.#putRevision(source, blobSnapshot);
    this.#activeCheckpoint = structuredClone(checkpoint);
    this.#operations.set(input.operationId, {
      operationId: input.operationId,
      fingerprint,
      checkpoint: structuredClone(checkpoint)
    });
    this.#prune(source.documentId);
    return LocalPracticeCheckpointSchema.parse(structuredClone(checkpoint));
  }

  async save(
    document: CampaignDocumentV1,
    blobs: ReadonlyMap<string, Blob>
  ): Promise<void> {
    const source = normaliseDurableSources(
      CampaignDocumentSchema.parse(structuredClone(document))
    );
    const blobSnapshot = selectReferencedLocalAssetBlobs(source, blobs);
    const latest = this.#latestRevision(source.documentId);
    if (latest === null && source.revision !== 0) {
      throw new Error("The first campaign revision must be 0");
    }
    if (latest !== null && source.revision <= latest) {
      throw new Error(
        `Campaign revision ${source.revision} must be newer than revision ${latest}`
      );
    }
    this.#putRevision(source, blobSnapshot);
    this.#prune(source.documentId);
  }

  async load(documentId: string): Promise<{
    document: CampaignDocumentV1;
    blobs: Map<string, Blob>;
  } | null> {
    if (!documentId) throw new Error("Document ID must not be empty");
    const latest = this.#latestRevision(documentId);
    return latest === null ? null : this.loadRevision(documentId, latest);
  }

  async loadRevision(documentId: string, revision: number): Promise<{
    document: CampaignDocumentV1;
    blobs: Map<string, Blob>;
  } | null> {
    if (!documentId) throw new Error("Document ID must not be empty");
    if (!Number.isSafeInteger(revision) || revision < 0) {
      throw new Error("Campaign revision must be a non-negative safe integer");
    }
    const stored = this.#documents.get(documentId)?.get(revision);
    if (!stored) return null;
    const document = migrateCampaignDocument(structuredClone(stored.document));
    if (document.documentId !== documentId || document.revision !== revision) {
      throw new Error("Stored campaign revision key does not match its document");
    }
    return {
      document,
      blobs: cloneVolatileBlobs(stored.blobs)
    };
  }

  #validateStartIdentities(runId: string, source: CampaignDocumentV1): void {
    const identities = [
      ["run", runId],
      ["document", source.documentId],
      ["session", source.sessionId],
      ["team", source.teamId]
    ] as const;
    if (new Set(identities.map(([, identity]) => identity)).size !== identities.length) {
      throw new Error("Local-practice run, document, session and team identities must be distinct");
    }
    for (const [label, identity] of identities) {
      if (identity === "classroom-campaign") {
        throw new Error(`Local-practice ${label} identity must not reuse classroom-campaign`);
      }
    }
  }

  #assertUnusedRun(checkpoint: LocalPracticeCheckpointV1): void {
    for (const run of this.#runs.values()) {
      if (run.runId === checkpoint.runId ||
        run.documentId === checkpoint.documentId ||
        run.sessionId === checkpoint.sessionId ||
        run.teamId === checkpoint.teamId) {
        throw new Error("Local-practice run identity is already in use");
      }
    }
  }

  #putRevision(
    document: CampaignDocumentV1,
    blobs: ReadonlyMap<string, Blob>
  ): void {
    let revisions = this.#documents.get(document.documentId);
    if (!revisions) {
      revisions = new Map();
      this.#documents.set(document.documentId, revisions);
    }
    revisions.set(document.revision, {
      document: structuredClone(document),
      blobs: cloneVolatileBlobs(blobs)
    });
  }

  #latestRevision(documentId: string): number | null {
    const revisions = this.#documents.get(documentId);
    if (!revisions || revisions.size === 0) return null;
    return Math.max(...revisions.keys());
  }

  #prune(documentId: string): void {
    const revisions = this.#documents.get(documentId);
    if (!revisions || revisions.size <= DEFAULT_RETAINED_REVISIONS) return;
    const ordered = [...revisions.keys()].sort((left, right) => left - right);
    for (const revision of ordered.slice(0, -DEFAULT_RETAINED_REVISIONS)) {
      revisions.delete(revision);
    }
  }
}

export class IndexedDbDraftStore implements LocalPracticeDraftStore {
  readonly databaseName: string;
  readonly #factory: IDBFactory;
  readonly #retainedRevisions: number;
  readonly #writeAttemptHook:
    ((kind: "save" | "commit", attempt: 0 | 1) => void) | undefined;

  constructor(options: IndexedDbDraftStoreOptions = {}) {
    this.databaseName = options.databaseName ?? DEFAULT_DRAFT_DATABASE_NAME;
    this.#factory = options.factory ?? globalThis.indexedDB;
    this.#retainedRevisions = options.retainedRevisions ?? DEFAULT_RETAINED_REVISIONS;
    if (!Number.isSafeInteger(this.#retainedRevisions) ||
      this.#retainedRevisions < 2 || this.#retainedRevisions > 50) {
      throw new Error("Draft retention must keep between 2 and 50 complete revisions");
    }
    this.#writeAttemptHook = options.writeAttemptHook;
  }

  async importCloudPractice(input: ImportCloudPracticeInput): Promise<LocalPracticeCheckpointV1> {
    const source = normaliseDurableSources(
      CampaignDocumentSchema.parse(structuredClone(input.document))
    );
    if (source.mode !== "offline" || source.roomId !== undefined) {
      throw new Error("Cloud practice import requires an offline campaign document without a room");
    }
    if (!source.teamId) {
      throw new Error("Cloud practice import requires a team identity in the campaign document");
    }
    const identities = [
      ["run", input.runId],
      ["document", source.documentId],
      ["session", source.sessionId],
      ["team", source.teamId]
    ] as const;
    if (new Set(identities.map(([, identity]) => identity)).size !== identities.length) {
      throw new Error("Cloud-practice run, document, session and team identities must be distinct");
    }
    for (const [label, identity] of identities) {
      if (identity === "classroom-campaign") {
        throw new Error(`Cloud-practice ${label} identity must not reuse classroom-campaign`);
      }
    }
    if (!hasCloudProgressPracticeDocumentIdentities(source)) {
      throw new Error("Cloud-practice document identity is not cloud-addressable");
    }
    const blobSnapshot = selectReferencedLocalAssetBlobs(source, input.blobs);
    const checkpoint = LocalPracticeCheckpointSchema.parse({
      contract: LOCAL_PRACTICE_CHECKPOINT_CONTRACT,
      runId: input.runId,
      documentId: source.documentId,
      sessionId: source.sessionId,
      teamId: source.teamId,
      teamAlias: input.teamAlias,
      documentRevision: source.revision,
      documentHash: await canonicalDurableDocumentHash(source),
      stage: source.gameplay.stage,
      levelLocked: input.levelLocked,
      sequence: source.revision,
      operationId: input.operationId,
      savedAt: input.savedAt
    });
    const operationFingerprint = await recoveryOperationFingerprint(
      checkpoint,
      source,
      blobSnapshot
    );

    const database = await this.#open();
    const transaction = database.transaction([
      DOCUMENTS_STORE,
      BLOBS_STORE,
      LOCAL_PRACTICE_CHECKPOINTS_STORE,
      LOCAL_PRACTICE_OPERATIONS_STORE,
      LOCAL_PRACTICE_RUNS_STORE
    ], "readwrite");
    const completion = transactionComplete(transaction);
    const documents = transaction.objectStore(DOCUMENTS_STORE);
    const blobStore = transaction.objectStore(BLOBS_STORE);
    const checkpoints = transaction.objectStore(LOCAL_PRACTICE_CHECKPOINTS_STORE);
    const operations = transaction.objectStore(LOCAL_PRACTICE_OPERATIONS_STORE);
    const runs = transaction.objectStore(LOCAL_PRACTICE_RUNS_STORE);
    const activeRequest = checkpoints.get(ACTIVE_LOCAL_PRACTICE_SLOT);
    const operationRequest = operations.get(input.operationId);
    const runRequest = runs.get(input.runId);
    const documentRequest = documents.index(DOCUMENT_ID_INDEX).openCursor(source.documentId);

    const queued = Promise.all([
      requestResult(activeRequest, "Unable to check the active local-practice checkpoint"),
      requestResult(operationRequest, "Unable to check the cloud-practice import operation"),
      requestResult(runRequest, "Unable to check the cloud-practice import run"),
      requestResult(documentRequest, "Unable to check the cloud-practice document identity")
    ]).then(([active, operation, run, documentCursor]) => {
      try {
        if (active) {
          throw new Error("An active local-practice checkpoint already exists");
        }
        if (operation) {
          throw new Error(`Cloud-practice operation identity ${input.operationId} was already used`);
        }
        if (run) {
          throw new Error(`Cloud-practice run identity ${input.runId} is already in use`);
        }
        if (documentCursor) {
          throw new Error(`Cloud-practice document identity ${source.documentId} is already in use`);
        }
        documents.add({
          documentId: source.documentId,
          revision: source.revision,
          document: structuredClone(source)
        } satisfies DocumentRecord);
        for (const [blobKey, blob] of blobSnapshot) {
          blobStore.add({
            documentId: source.documentId,
            revision: source.revision,
            blobKey,
            blob
          } satisfies BlobRecord);
        }
        checkpoints.add({
          slot: ACTIVE_LOCAL_PRACTICE_SLOT,
          checkpoint: structuredClone(checkpoint)
        } satisfies LocalPracticeCheckpointRecord);
        operations.add({
          operationId: checkpoint.operationId,
          fingerprint: operationFingerprint,
          checkpoint: structuredClone(checkpoint)
        } satisfies LocalPracticeOperationRecord);
        runs.add({
          runId: checkpoint.runId,
          documentId: checkpoint.documentId,
          sessionId: checkpoint.sessionId,
          teamId: checkpoint.teamId,
          teamAlias: checkpoint.teamAlias
        } satisfies LocalPracticeRunRecord);
      } catch (error) {
        abortQuietly(transaction);
        throw error;
      }
    });

    try {
      await queued;
      await completion;
      return LocalPracticeCheckpointSchema.parse(structuredClone(checkpoint));
    } catch (error) {
      abortQuietly(transaction);
      await completion.catch(() => undefined);
      throw error;
    } finally {
      database.close();
    }
  }

  async beginLocalPractice(input: BeginLocalPracticeInput): Promise<LocalPracticeCheckpointV1> {
    const source = normaliseDurableSources(
      CampaignDocumentSchema.parse(structuredClone(input.document))
    );
    if (source.mode !== "offline" || source.roomId !== undefined) {
      throw new Error("Local practice requires an offline campaign document");
    }
    if (source.revision !== 0) {
      throw new Error("A local-practice run must begin at campaign revision 0");
    }
    if (!source.teamId) {
      throw new Error("Local practice requires a team identity in the campaign document");
    }
    const identities = [
      ["run", input.runId],
      ["document", source.documentId],
      ["session", source.sessionId],
      ["team", source.teamId]
    ] as const;
    if (new Set(identities.map(([, identity]) => identity)).size !== identities.length) {
      throw new Error("Local-practice run, document, session and team identities must be distinct");
    }
    for (const [label, identity] of identities) {
      if (identity === "classroom-campaign") {
        throw new Error(`Local-practice ${label} identity must not reuse classroom-campaign`);
      }
    }
    const blobSnapshot = selectReferencedLocalAssetBlobs(source, input.blobs);
    const checkpoint = LocalPracticeCheckpointSchema.parse({
      contract: LOCAL_PRACTICE_CHECKPOINT_CONTRACT,
      runId: input.runId,
      documentId: source.documentId,
      sessionId: source.sessionId,
      teamId: source.teamId,
      teamAlias: input.teamAlias,
      documentRevision: source.revision,
      documentHash: await canonicalDurableDocumentHash(source),
      stage: source.gameplay.stage,
      levelLocked: input.levelLocked,
      sequence: 0,
      operationId: input.operationId,
      savedAt: input.savedAt
    });
    const operationFingerprint = await localPracticeOperationFingerprint({
      kind: "begin",
      checkpoint: semanticCheckpointInput(checkpoint),
      documentInputHash: await semanticDurableDocumentInputHash(source)
    }, blobSnapshot);

    const database = await this.#open();
    const transaction = database.transaction([
      DOCUMENTS_STORE,
      BLOBS_STORE,
      LOCAL_PRACTICE_CHECKPOINTS_STORE,
      LOCAL_PRACTICE_OPERATIONS_STORE,
      LOCAL_PRACTICE_RUNS_STORE
    ], "readwrite");
    const completion = transactionComplete(transaction);
    const documents = transaction.objectStore(DOCUMENTS_STORE);
    const blobStore = transaction.objectStore(BLOBS_STORE);
    const checkpoints = transaction.objectStore(LOCAL_PRACTICE_CHECKPOINTS_STORE);
    const operations = transaction.objectStore(LOCAL_PRACTICE_OPERATIONS_STORE);
    const runs = transaction.objectStore(LOCAL_PRACTICE_RUNS_STORE);
    let priorCheckpoint: LocalPracticeCheckpointV1 | undefined;
    const queued = new Promise<void>((resolve, reject) => {
      const operationRequest = operations.get(input.operationId);
      operationRequest.addEventListener("error", () => reject(
        operationRequest.error ?? new Error("Unable to read local-practice operation")
      ), { once: true });
      operationRequest.addEventListener("success", () => {
        try {
          const prior = operationRequest.result as LocalPracticeOperationRecord | undefined;
          if (prior) {
            if (prior.fingerprint !== operationFingerprint) {
              throw new Error("Local-practice operation ID was already used with different input");
            }
            const resultCheckpoint = LocalPracticeCheckpointSchema.parse(prior.checkpoint);
            const activeRequest = checkpoints.get(ACTIVE_LOCAL_PRACTICE_SLOT);
            activeRequest.addEventListener("error", () => reject(
              activeRequest.error ?? new Error("Unable to compare active local-practice checkpoint")
            ), { once: true });
            activeRequest.addEventListener("success", () => {
              try {
                const activeRecord = activeRequest.result as LocalPracticeCheckpointRecord | undefined;
                if (!activeRecord || !checkpointsMatch(
                  LocalPracticeCheckpointSchema.parse(activeRecord.checkpoint),
                  resultCheckpoint
                )) {
                  throw new Error("Local-practice operation retry is stale");
                }
                priorCheckpoint = resultCheckpoint;
                resolve();
              } catch (error) {
                abortQuietly(transaction);
                reject(error);
              }
            }, { once: true });
            return;
          }
          const runRequest = runs.get(checkpoint.runId);
          runRequest.addEventListener("error", () => reject(
            runRequest.error ?? new Error("Unable to check local-practice run identity")
          ), { once: true });
          runRequest.addEventListener("success", () => {
            try {
              if (runRequest.result) {
                throw new Error(`Local-practice run identity ${checkpoint.runId} is already in use`);
              }
              const latestRequest = documents.index(DOCUMENT_ID_INDEX)
                .openCursor(source.documentId, "prev");
              latestRequest.addEventListener("error", () => reject(
                latestRequest.error ?? new Error("Unable to check local-practice campaign identity")
              ), { once: true });
              latestRequest.addEventListener("success", () => {
                try {
                  if (latestRequest.result) {
                    throw new Error(`Local-practice document identity ${source.documentId} is already in use`);
                  }
                  documents.add({
                    documentId: source.documentId,
                    revision: source.revision,
                    document: structuredClone(source)
                  } satisfies DocumentRecord);
                  for (const [blobKey, blob] of blobSnapshot) {
                    blobStore.add({
                      documentId: source.documentId,
                      revision: source.revision,
                      blobKey,
                      blob
                    } satisfies BlobRecord);
                  }
                  checkpoints.put({
                    slot: ACTIVE_LOCAL_PRACTICE_SLOT,
                    checkpoint: structuredClone(checkpoint)
                  } satisfies LocalPracticeCheckpointRecord);
                  operations.add({
                    operationId: checkpoint.operationId,
                    fingerprint: operationFingerprint,
                    checkpoint: structuredClone(checkpoint)
                  } satisfies LocalPracticeOperationRecord);
                  runs.add({
                    runId: checkpoint.runId,
                    documentId: checkpoint.documentId,
                    sessionId: checkpoint.sessionId,
                    teamId: checkpoint.teamId,
                    teamAlias: checkpoint.teamAlias
                  } satisfies LocalPracticeRunRecord);
                  resolve();
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
        } catch (error) {
          abortQuietly(transaction);
          reject(error);
        }
      }, { once: true });
    });

    try {
      await queued;
      await completion;
      return LocalPracticeCheckpointSchema.parse(structuredClone(priorCheckpoint ?? checkpoint));
    } catch (error) {
      abortQuietly(transaction);
      await completion.catch(() => undefined);
      throw error;
    } finally {
      database.close();
    }
  }

  async resumeLocalPractice(): Promise<LocalPracticeRecoveryV1 | null> {
    const database = await this.#open();
    const transaction = database.transaction([
      DOCUMENTS_STORE,
      BLOBS_STORE,
      LOCAL_PRACTICE_CHECKPOINTS_STORE,
      LOCAL_PRACTICE_OPERATIONS_STORE,
      LOCAL_PRACTICE_RUNS_STORE
    ], "readonly");
    const completion = transactionComplete(transaction);
    const activeRequest = transaction.objectStore(LOCAL_PRACTICE_CHECKPOINTS_STORE)
      .get(ACTIVE_LOCAL_PRACTICE_SLOT);
    const read = new Promise<{
      checkpoint: LocalPracticeCheckpointV1;
      run: LocalPracticeRunRecord | undefined;
      operation: LocalPracticeOperationRecord | undefined;
      documentRecord: DocumentRecord | undefined;
      blobRecords: BlobRecord[];
    } | null>((resolve, reject) => {
      activeRequest.addEventListener("error", () => reject(
        activeRequest.error ?? new Error("Unable to read active local-practice checkpoint")
      ), { once: true });
      activeRequest.addEventListener("success", () => {
        try {
          const activeRecord = activeRequest.result as LocalPracticeCheckpointRecord | undefined;
          if (!activeRecord) {
            resolve(null);
            return;
          }
          const checkpoint = LocalPracticeCheckpointSchema.parse(activeRecord.checkpoint);
          const runRequest = transaction.objectStore(LOCAL_PRACTICE_RUNS_STORE)
            .get(checkpoint.runId);
          const operationRequest = transaction.objectStore(LOCAL_PRACTICE_OPERATIONS_STORE)
            .get(checkpoint.operationId);
          const documentRequest = transaction.objectStore(DOCUMENTS_STORE)
            .get([checkpoint.documentId, checkpoint.documentRevision]);
          const blobsRequest = transaction.objectStore(BLOBS_STORE)
            .index(DOCUMENT_REVISION_INDEX)
            .getAll([checkpoint.documentId, checkpoint.documentRevision]);
          Promise.all([
            requestResult(runRequest, "Unable to read local-practice run identity"),
            requestResult(operationRequest, "Unable to read local-practice operation result"),
            requestResult(documentRequest, "Unable to read active local-practice campaign revision"),
            requestResult(blobsRequest, "Unable to read active local-practice blobs")
          ]).then(([run, operation, documentRecord, blobRecords]) => resolve({
            checkpoint,
            run: run as LocalPracticeRunRecord | undefined,
            operation: operation as LocalPracticeOperationRecord | undefined,
            documentRecord: documentRecord as DocumentRecord | undefined,
            blobRecords: blobRecords as BlobRecord[]
          }), reject);
        } catch (error) {
          abortQuietly(transaction);
          reject(error);
        }
      }, { once: true });
    });
    let snapshot: Awaited<typeof read>;
    try {
      [snapshot] = await Promise.all([read, completion]);
    } finally {
      database.close();
    }
    if (!snapshot) return null;
    const { checkpoint, run, operation, documentRecord, blobRecords } = snapshot;
    if (!run || run.runId !== checkpoint.runId || run.documentId !== checkpoint.documentId ||
      run.sessionId !== checkpoint.sessionId || run.teamId !== checkpoint.teamId ||
      run.teamAlias !== checkpoint.teamAlias) {
      throw new Error("Active local-practice checkpoint run identity is invalid");
    }
    if (!operation || operation.operationId !== checkpoint.operationId ||
      !/^[0-9a-f]{64}$/.test(operation.fingerprint)) {
      throw new Error("Active local-practice checkpoint operation result is invalid");
    }
    const operationCheckpoint = LocalPracticeCheckpointSchema.parse(operation.checkpoint);
    if (!checkpointsMatch(operationCheckpoint, checkpoint)) {
      throw new Error("Active local-practice checkpoint diverges from its operation result");
    }
    if (!documentRecord) throw new Error("Active local-practice campaign revision is missing");
    const document = migrateCampaignDocument(documentRecord.document);
    if (documentRecord.documentId !== checkpoint.documentId ||
      documentRecord.revision !== checkpoint.documentRevision ||
      document.documentId !== checkpoint.documentId ||
      document.revision !== checkpoint.documentRevision) {
      throw new Error("Stored campaign revision key does not match its document");
    }
    const loadedBlobs = new Map(blobRecords.map(({ blobKey, blob }) => [
      blobKey,
      blob.slice(0, blob.size, blob.type)
    ]));
    if (document.mode !== "offline" || document.roomId !== undefined) {
      throw new Error("Active local-practice campaign must be offline");
    }
    if (document.documentId !== checkpoint.documentId ||
      document.sessionId !== checkpoint.sessionId ||
      document.teamId !== checkpoint.teamId) {
      throw new Error("Active local-practice checkpoint identity does not match its campaign");
    }
    if (document.revision !== checkpoint.documentRevision) {
      throw new Error("Active local-practice checkpoint revision does not match its campaign");
    }
    if (document.gameplay.stage !== checkpoint.stage) {
      throw new Error("Active local-practice checkpoint stage does not match its campaign");
    }
    const documentHash = await canonicalDurableDocumentHash(document);
    if (documentHash !== checkpoint.documentHash) {
      throw new Error("Active local-practice checkpoint hash does not match its campaign");
    }
    const referencedBlobs = selectReferencedLocalAssetBlobs(document, loadedBlobs);
    const recomputedFingerprint = await recoveryOperationFingerprint(
      checkpoint,
      document,
      referencedBlobs
    );
    if (recomputedFingerprint !== operation.fingerprint) {
      throw new Error("Active local-practice recovery integrity fingerprint does not match its operation");
    }
    return {
      checkpoint: LocalPracticeCheckpointSchema.parse(structuredClone(checkpoint)),
      document,
      blobs: referencedBlobs
    };
  }

  async commitLocalPractice(input: CommitLocalPracticeInput): Promise<LocalPracticeCheckpointV1> {
    try {
      this.#writeAttemptHook?.("commit", 0);
      return await this.#commitLocalPracticeOnce(input);
    } catch (error) {
      if (!isQuotaExceededError(error)) throw error;
      await this.#pruneAggressively(input.document.documentId);
      this.#writeAttemptHook?.("commit", 1);
      return this.#commitLocalPracticeOnce(input);
    }
  }

  async #commitLocalPracticeOnce(
    input: CommitLocalPracticeInput
  ): Promise<LocalPracticeCheckpointV1> {
    if (!Number.isSafeInteger(input.expectedDocumentRevision) || input.expectedDocumentRevision < 0 ||
      !Number.isSafeInteger(input.expectedSequence) || input.expectedSequence < 0) {
      throw new Error("Expected local-practice revision and sequence must be non-negative safe integers");
    }
    const source = normaliseDurableSources(
      CampaignDocumentSchema.parse(structuredClone(input.document))
    );
    if (source.mode !== "offline" || source.roomId !== undefined) {
      throw new Error("Local practice requires an offline campaign document");
    }
    if (source.revision !== input.expectedDocumentRevision + 1) {
      throw new Error("A local-practice commit must advance the campaign revision by exactly one");
    }
    const blobSnapshot = selectReferencedLocalAssetBlobs(source, input.blobs);
    const active = await this.resumeLocalPractice();
    if (!active) throw new Error("There is no active local-practice run");
    const pitch = input.pitch ?? active.checkpoint.pitch;
    const operationFingerprint = await localPracticeOperationFingerprint({
      kind: "commit",
      expectedDocumentRevision: input.expectedDocumentRevision,
      expectedSequence: input.expectedSequence,
      levelLocked: input.levelLocked,
      ...(pitch === undefined ? {} : { pitch }),
      documentInputHash: await semanticDurableDocumentInputHash(source)
    }, blobSnapshot);
    const checkpoint = LocalPracticeCheckpointSchema.parse({
      ...active.checkpoint,
      documentRevision: source.revision,
      documentHash: await canonicalDurableDocumentHash(source),
      stage: source.gameplay.stage,
      levelLocked: input.levelLocked,
      sequence: input.expectedSequence + 1,
      operationId: input.operationId,
      savedAt: input.savedAt,
      ...(pitch === undefined ? {} : { pitch })
    });

    const database = await this.#open();
    const transaction = database.transaction([
      DOCUMENTS_STORE,
      BLOBS_STORE,
      LOCAL_PRACTICE_CHECKPOINTS_STORE,
      LOCAL_PRACTICE_OPERATIONS_STORE
    ], "readwrite");
    const completion = transactionComplete(transaction);
    const documents = transaction.objectStore(DOCUMENTS_STORE);
    const blobStore = transaction.objectStore(BLOBS_STORE);
    const checkpoints = transaction.objectStore(LOCAL_PRACTICE_CHECKPOINTS_STORE);
    const operations = transaction.objectStore(LOCAL_PRACTICE_OPERATIONS_STORE);
    let priorCheckpoint: LocalPracticeCheckpointV1 | undefined;
    const queued = new Promise<void>((resolve, reject) => {
      const operationRequest = operations.get(input.operationId);
      operationRequest.addEventListener("error", () => reject(
        operationRequest.error ?? new Error("Unable to read local-practice operation")
      ), { once: true });
      operationRequest.addEventListener("success", () => {
        try {
          const prior = operationRequest.result as LocalPracticeOperationRecord | undefined;
          if (prior && prior.fingerprint !== operationFingerprint) {
            throw new Error("Local-practice operation ID was already used with different input");
          }
          const activeRequest = checkpoints.get(ACTIVE_LOCAL_PRACTICE_SLOT);
          activeRequest.addEventListener("error", () => reject(
            activeRequest.error ?? new Error("Unable to compare active local-practice checkpoint")
          ), { once: true });
          activeRequest.addEventListener("success", () => {
            try {
              const currentRecord = activeRequest.result as LocalPracticeCheckpointRecord | undefined;
              if (!currentRecord) throw new Error("There is no active local-practice run");
              const current = LocalPracticeCheckpointSchema.parse(currentRecord.checkpoint);
              if (prior) {
                const resultCheckpoint = LocalPracticeCheckpointSchema.parse(prior.checkpoint);
                if (!checkpointsMatch(current, resultCheckpoint)) {
                  throw new Error("Local-practice operation retry is stale");
                }
                priorCheckpoint = resultCheckpoint;
                resolve();
                return;
              }
              if (current.documentRevision !== input.expectedDocumentRevision ||
                current.sequence !== input.expectedSequence) {
                throw new Error("Local-practice commit base is stale");
              }
              if (source.documentId !== current.documentId ||
                source.sessionId !== current.sessionId ||
                source.teamId !== current.teamId) {
                throw new Error("Local-practice campaign identity cannot change during a run");
              }
              if (current.runId !== checkpoint.runId || current.documentId !== checkpoint.documentId ||
                current.sessionId !== checkpoint.sessionId || current.teamId !== checkpoint.teamId) {
                throw new Error("Active local-practice identity changed before commit");
              }
              const latestRequest = documents.index(DOCUMENT_ID_INDEX)
                .openCursor(source.documentId, "prev");
              latestRequest.addEventListener("error", () => reject(
                latestRequest.error ?? new Error("Unable to compare latest campaign revision")
              ), { once: true });
              latestRequest.addEventListener("success", () => {
                try {
                  const latest = latestRequest.result?.value as DocumentRecord | undefined;
                  if (!latest || latest.revision !== input.expectedDocumentRevision) {
                    throw new Error("Local-practice campaign revision base is stale");
                  }
                  documents.add({
                    documentId: source.documentId,
                    revision: source.revision,
                    document: structuredClone(source)
                  } satisfies DocumentRecord);
                  for (const [blobKey, blob] of blobSnapshot) {
                    blobStore.add({
                      documentId: source.documentId,
                      revision: source.revision,
                      blobKey,
                      blob
                    } satisfies BlobRecord);
                  }
                  checkpoints.put({
                    slot: ACTIVE_LOCAL_PRACTICE_SLOT,
                    checkpoint: structuredClone(checkpoint)
                  } satisfies LocalPracticeCheckpointRecord);
                   operations.add({
                     operationId: checkpoint.operationId,
                     fingerprint: operationFingerprint,
                     checkpoint: structuredClone(checkpoint)
                   } satisfies LocalPracticeOperationRecord);
                   void queueRetentionPrune(
                     transaction,
                     source.documentId,
                     source.revision,
                     this.#retainedRevisions
                   ).then(resolve, reject);
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
        } catch (error) {
          abortQuietly(transaction);
          reject(error);
        }
      }, { once: true });
    });

    try {
      await queued;
      await completion;
      return LocalPracticeCheckpointSchema.parse(structuredClone(priorCheckpoint ?? checkpoint));
    } catch (error) {
      abortQuietly(transaction);
      await completion.catch(() => undefined);
      throw error;
    } finally {
      database.close();
    }
  }

  async save(document: CampaignDocumentV1, blobs: ReadonlyMap<string, Blob>): Promise<void> {
    try {
      this.#writeAttemptHook?.("save", 0);
      await this.#saveOnce(document, blobs);
    } catch (error) {
      if (!isQuotaExceededError(error)) throw error;
      await this.#pruneAggressively(document.documentId);
      this.#writeAttemptHook?.("save", 1);
      await this.#saveOnce(document, blobs);
    }
  }

  async #saveOnce(
    document: CampaignDocumentV1,
    blobs: ReadonlyMap<string, Blob>
  ): Promise<void> {
    const source = normaliseDurableSources(
      CampaignDocumentSchema.parse(structuredClone(document))
    );
    const blobSnapshot = selectReferencedLocalAssetBlobs(source, blobs);

    const database = await this.#open();
    const transaction = database.transaction([
      DOCUMENTS_STORE,
      BLOBS_STORE,
      LOCAL_PRACTICE_OPERATIONS_STORE
    ], "readwrite");
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
           void queueRetentionPrune(
             transaction,
             source.documentId,
             source.revision,
             this.#retainedRevisions
           ).then(resolve, reject);
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

  async loadRevision(documentId: string, revision: number): Promise<{
    document: CampaignDocumentV1;
    blobs: Map<string, Blob>;
  } | null> {
    if (!documentId) throw new Error("Document ID must not be empty");
    if (!Number.isSafeInteger(revision) || revision < 0) {
      throw new Error("Campaign revision must be a non-negative safe integer");
    }
    const database = await this.#open();
    const transaction = database.transaction([DOCUMENTS_STORE, BLOBS_STORE], "readonly");
    const completion = transactionComplete(transaction);
    const documents = transaction.objectStore(DOCUMENTS_STORE);
    const blobStore = transaction.objectStore(BLOBS_STORE);
    const read = new Promise<{ record: DocumentRecord; blobs: BlobRecord[] } | null>((resolve, reject) => {
      const documentRequest = documents.get([documentId, revision]);
      documentRequest.addEventListener("error", () => reject(
        documentRequest.error ?? new Error("Unable to read campaign revision")
      ), { once: true });
      documentRequest.addEventListener("success", () => {
        const record = documentRequest.result as DocumentRecord | undefined;
        if (!record) {
          resolve(null);
          return;
        }
        const blobsRequest = blobStore.index(DOCUMENT_REVISION_INDEX)
          .getAll([documentId, revision]);
        blobsRequest.addEventListener("error", () => reject(
          blobsRequest.error ?? new Error("Unable to read campaign blobs")
        ), { once: true });
        blobsRequest.addEventListener("success", () => resolve({
          record,
          blobs: blobsRequest.result as BlobRecord[]
        }), { once: true });
      }, { once: true });
    });

    try {
      const [result] = await Promise.all([read, completion]);
      if (!result) return null;
      const parsed = migrateCampaignDocument(result.record.document);
      if (parsed.documentId !== documentId || parsed.revision !== revision ||
        result.record.documentId !== documentId || result.record.revision !== revision) {
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

  async #pruneAggressively(documentId: string): Promise<void> {
    if (!documentId) return;
    const database = await this.#open();
    const transaction = database.transaction([
      DOCUMENTS_STORE,
      BLOBS_STORE,
      LOCAL_PRACTICE_OPERATIONS_STORE
    ], "readwrite");
    const completion = transactionComplete(transaction);
    const cursorRequest = transaction.objectStore(DOCUMENTS_STORE)
      .index(DOCUMENT_ID_INDEX)
      .openCursor(documentId, "prev");
    const queued = new Promise<void>((resolve, reject) => {
      cursorRequest.addEventListener("error", () => reject(
        cursorRequest.error ?? new Error("Unable to inspect drafts before quota recovery")
      ), { once: true });
      cursorRequest.addEventListener("success", () => {
        const latest = cursorRequest.result?.value as DocumentRecord | undefined;
        if (!latest) {
          resolve();
          return;
        }
        void queueRetentionPrune(
          transaction,
          documentId,
          latest.revision,
          1
        ).then(resolve, reject);
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

  async #loadLocalPracticeOperation(
    operationId: string
  ): Promise<LocalPracticeOperationRecord | undefined> {
    const database = await this.#open();
    const transaction = database.transaction(LOCAL_PRACTICE_OPERATIONS_STORE, "readonly");
    const completion = transactionComplete(transaction);
    const request = transaction.objectStore(LOCAL_PRACTICE_OPERATIONS_STORE).get(operationId);
    const read = new Promise<LocalPracticeOperationRecord | undefined>((resolve, reject) => {
      request.addEventListener("success", () => resolve(
        request.result as LocalPracticeOperationRecord | undefined
      ), { once: true });
      request.addEventListener("error", () => reject(
        request.error ?? new Error("Unable to read local-practice operation")
      ), { once: true });
    });
    try {
      const [operation] = await Promise.all([read, completion]);
      return operation;
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
      if (!database.objectStoreNames.contains(LOCAL_PRACTICE_CHECKPOINTS_STORE)) {
        database.createObjectStore(LOCAL_PRACTICE_CHECKPOINTS_STORE, { keyPath: "slot" });
      }
      if (!database.objectStoreNames.contains(LOCAL_PRACTICE_OPERATIONS_STORE)) {
        database.createObjectStore(LOCAL_PRACTICE_OPERATIONS_STORE, { keyPath: "operationId" });
      }
      const runs = database.objectStoreNames.contains(LOCAL_PRACTICE_RUNS_STORE)
        ? transaction.objectStore(LOCAL_PRACTICE_RUNS_STORE)
        : database.createObjectStore(LOCAL_PRACTICE_RUNS_STORE, { keyPath: "runId" });
      if (!runs.indexNames.contains(LOCAL_PRACTICE_DOCUMENT_INDEX)) {
        runs.createIndex(LOCAL_PRACTICE_DOCUMENT_INDEX, "documentId", { unique: true });
      }
      if (!runs.indexNames.contains(LOCAL_PRACTICE_SESSION_INDEX)) {
        runs.createIndex(LOCAL_PRACTICE_SESSION_INDEX, "sessionId", { unique: true });
      }
      if (!runs.indexNames.contains(LOCAL_PRACTICE_TEAM_INDEX)) {
        runs.createIndex(LOCAL_PRACTICE_TEAM_INDEX, "teamId", { unique: true });
      }
    });
    return openRequestResult(request, this.databaseName);
  }
}
