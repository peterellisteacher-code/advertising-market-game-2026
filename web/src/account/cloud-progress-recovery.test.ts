import { describe, expect, it, vi } from "vitest";
import { createBlankCampaignDocument, type CampaignDocumentV1 } from "../domain/campaign-document";
import type {
  ImportCloudPracticeInput,
  LocalPracticeRecoveryV1
} from "../persistence/draft-store";
import { canonicalDurableDocumentHash } from "../persistence/draft-store";
import type {
  CloudProgressClient,
  CloudProgressDocumentMetadata,
  CloudProgressLoadResult
} from "./account-client";
import type { CloudProgressAssetRestoreResult } from "./cloud-asset-adapter";
import { AccountAssetClientError } from "./account-asset-client";
import { AccountClientError } from "./account-client";
import {
  CloudProgressRecovery,
  cloudRecoveryStatusMessage,
  type CloudProgressRecoveryResult
} from "./cloud-progress-recovery";

const savedAt = "2026-07-17T06:30:00.000Z";

function remoteDocument(revision = 4): CampaignDocumentV1 {
  const document = createBlankCampaignDocument({
    documentId: "practice-document-cloud",
    sessionId: "practice-session-cloud",
    teamId: "practice-team-cloud",
    mode: "offline"
  });
  document.revision = revision;
  document.updatedAt = "2026-07-17T05:00:00.000Z";
  document.gameplay.stage = "sell";
  return document;
}

function metadata(document = remoteDocument(), revision = 7): CloudProgressDocumentMetadata {
  return {
    documentId: document.documentId,
    revision,
    updatedAt: "2026-07-17T05:05:00.000Z"
  };
}

function client(options: {
  rows?: readonly CloudProgressDocumentMetadata[];
  loaded?: CloudProgressLoadResult;
} = {}): CloudProgressClient {
  return {
    list: vi.fn().mockResolvedValue(options.rows ?? []),
    load: vi.fn().mockResolvedValue(options.loaded ?? { status: "not-found" }),
    save: vi.fn()
  };
}

function harness(options: {
  local?: LocalPracticeRecoveryV1 | null;
  rows?: readonly CloudProgressDocumentMetadata[];
  loaded?: CloudProgressLoadResult;
  restored?: CloudProgressAssetRestoreResult;
  importFailure?: Error;
  metadataFailure?: Error;
  randomId?: string;
} = {}) {
  const cloud = client({
    ...(options.rows === undefined ? {} : { rows: options.rows }),
    ...(options.loaded === undefined ? {} : { loaded: options.loaded })
  });
  const resumeLocalPractice = vi.fn().mockResolvedValue(options.local ?? null);
  const importCloudPractice = options.importFailure === undefined
    ? vi.fn().mockResolvedValue(undefined)
    : vi.fn().mockRejectedValue(options.importFailure);
  const assets = {
    restore: vi.fn().mockResolvedValue(options.restored ?? {
      document: options.loaded?.status === "found" ? options.loaded.document : remoteDocument(),
      blobs: new Map<string, Blob>()
    })
  };
  const metadataStore = {
    setRevision: options.metadataFailure === undefined
      ? vi.fn()
      : vi.fn(() => { throw options.metadataFailure; })
  };
  const recovery = new CloudProgressRecovery({
    client: cloud,
    store: { resumeLocalPractice, importCloudPractice },
    assets,
    metadata: metadataStore,
    now: () => new Date(savedAt),
    randomId: () => options.randomId ?? "8c6c271b-00bf-45ed-bba1-c36bf4a524d8"
  });
  return { recovery, cloud, resumeLocalPractice, importCloudPractice, assets, metadataStore };
}

describe("CloudProgressRecovery", () => {
  it("preserves account and asset authentication expiry instead of reporting cloud unavailable", async () => {
    const accountExpired = new AccountClientError("AUTHENTICATION_REQUIRED");
    const listFailure = harness();
    vi.mocked(listFailure.cloud.list).mockRejectedValueOnce(accountExpired);
    await expect(listFailure.recovery.recoverLatest("team-one")).rejects.toBe(accountExpired);

    const assetExpired = new AccountAssetClientError("AUTHENTICATION_REQUIRED");
    const document = remoteDocument();
    const assetFailure = harness({
      rows: [metadata(document)],
      loaded: { status: "found", revision: 5, document, updatedAt: savedAt }
    });
    assetFailure.assets.restore.mockRejectedValueOnce(assetExpired);
    await expect(assetFailure.recovery.recoverLatest("team-one")).rejects.toBe(assetExpired);
  });

  it("always keeps an existing local practice run and performs no cloud request", async () => {
    const document = remoteDocument(3);
    const local = {
      checkpoint: {
        contract: "local-practice-checkpoint@1" as const,
        runId: "local-run",
        documentId: document.documentId,
        sessionId: document.sessionId,
        teamId: document.teamId!,
        teamAlias: "Local team",
        documentRevision: document.revision,
        documentHash: "a".repeat(64),
        stage: document.gameplay.stage,
        levelLocked: false,
        sequence: document.revision,
        operationId: "local-operation",
        savedAt
      },
      document,
      blobs: new Map<string, Blob>()
    } satisfies LocalPracticeRecoveryV1;
    const h = harness({ local, rows: [metadata()] });

    await expect(h.recovery.recoverLatest("team-one")).resolves.toEqual({
      status: "local-present",
      documentId: document.documentId
    });
    expect(h.cloud.list).not.toHaveBeenCalled();
    expect(h.cloud.load).not.toHaveBeenCalled();
    expect(h.assets.restore).not.toHaveBeenCalled();
    expect(h.importCloudPractice).not.toHaveBeenCalled();
    expect(h.metadataStore.setRevision).not.toHaveBeenCalled();
  });

  it("reports no cloud save without writing when discovery is empty", async () => {
    const h = harness();
    await expect(h.recovery.recoverLatest("team-one")).resolves.toEqual({ status: "no-cloud-save" });
    expect(h.cloud.list).toHaveBeenCalledOnce();
    expect(h.cloud.load).not.toHaveBeenCalled();
    expect(h.importCloudPractice).not.toHaveBeenCalled();
  });

  it("restores the newest cloud document and seeds its server CAS revision only after import", async () => {
    const document = remoteDocument();
    const newest = metadata(document, 7);
    const older = { ...metadata(remoteDocument(2), 3), documentId: "practice-document-older" };
    const loaded = {
      status: "found" as const,
      revision: 8,
      document,
      updatedAt: "2026-07-17T05:06:00.000Z"
    };
    const restored = { document: structuredClone(document), blobs: new Map<string, Blob>() };
    const h = harness({ rows: [newest, older], loaded, restored });

    expect(await canonicalDurableDocumentHash(restored.document))
      .toBe(await canonicalDurableDocumentHash(document));
    const result = await h.recovery.recoverLatest("team-one");
    expect(h.assets.restore).toHaveBeenCalledWith(document);
    expect(h.importCloudPractice).toHaveBeenCalledOnce();
    expect(result).toEqual({
      status: "restored",
      documentId: document.documentId,
      revision: 8
    });
    expect(h.cloud.load).toHaveBeenCalledWith(document.documentId);
    const input = h.importCloudPractice.mock.calls[0]![0] as ImportCloudPracticeInput;
    expect(input).toEqual({
      runId: "cloud-recovery-run:8c6c271b-00bf-45ed-bba1-c36bf4a524d8",
      teamAlias: "team-one",
      document,
      blobs: restored.blobs,
      levelLocked: false,
      operationId: "cloud-recovery-import:8c6c271b-00bf-45ed-bba1-c36bf4a524d8",
      savedAt
    });
    expect(h.metadataStore.setRevision).toHaveBeenCalledWith(document.documentId, 8);
    expect(h.importCloudPractice.mock.invocationCallOrder[0])
      .toBeLessThan(h.metadataStore.setRevision.mock.invocationCallOrder[0]!);
  });

  it("chooses a distinct bounded recovery run identity even when the first candidate collides", async () => {
    const randomId = "8c6c271b-00bf-45ed-bba1-c36bf4a524d8";
    const document = remoteDocument();
    document.sessionId = `cloud-recovery-run:${randomId}`;
    const loaded = {
      status: "found" as const,
      revision: 8,
      document,
      updatedAt: "2026-07-17T05:06:00.000Z"
    };
    const h = harness({
      rows: [metadata(document, 8)],
      loaded,
      restored: { document: structuredClone(document), blobs: new Map() },
      randomId
    });

    await expect(h.recovery.recoverLatest("team-one")).resolves.toMatchObject({ status: "restored" });
    const input = h.importCloudPractice.mock.calls[0]![0] as ImportCloudPracticeInput;
    expect(input.runId).toBe(`cloud-recovery-run:${randomId}:1`);
  });

  it("rejects recovery-incompatible cloud document identities before restoring assets", async () => {
    for (const mutate of [
      (document: CampaignDocumentV1) => { document.sessionId = document.teamId!; },
      (document: CampaignDocumentV1) => { document.teamId = "classroom-campaign"; },
      (document: CampaignDocumentV1) => { document.sessionId = "invalid identity"; },
      (document: CampaignDocumentV1) => { document.documentId = "Practice:Document"; }
    ]) {
      const document = remoteDocument();
      mutate(document);
      const h = harness({
        rows: [metadata(document)],
        loaded: { status: "found", revision: 5, document, updatedAt: savedAt }
      });

      await expect(h.recovery.recoverLatest("team-one"))
        .resolves.toEqual({ status: "unavailable" });
      expect(h.assets.restore).not.toHaveBeenCalled();
      expect(h.importCloudPractice).not.toHaveBeenCalled();
    }
  });

  it("treats a disappeared listed document as no cloud save", async () => {
    const h = harness({ rows: [metadata()], loaded: { status: "not-found" } });
    await expect(h.recovery.recoverLatest("team-one")).resolves.toEqual({ status: "no-cloud-save" });
    expect(h.assets.restore).not.toHaveBeenCalled();
    expect(h.metadataStore.setRevision).not.toHaveBeenCalled();
  });

  it("fails closed when restored asset identity diverges and leaves local storage untouched", async () => {
    const document = remoteDocument();
    const wrong = remoteDocument();
    wrong.documentId = "different-document";
    const h = harness({
      rows: [metadata(document)],
      loaded: { status: "found", revision: 5, document, updatedAt: savedAt },
      restored: { document: wrong, blobs: new Map() }
    });
    await expect(h.recovery.recoverLatest("team-one")).resolves.toEqual({ status: "unavailable" });
    expect(h.importCloudPractice).not.toHaveBeenCalled();
    expect(h.metadataStore.setRevision).not.toHaveBeenCalled();
  });

  it("fails closed before restore when the cloud document has a missing or empty team identity", async () => {
    for (const teamId of [undefined, ""]) {
      const document = remoteDocument();
      document.teamId = teamId;
      const h = harness({
        rows: [metadata(document)],
        loaded: { status: "found", revision: 5, document, updatedAt: savedAt }
      });

      await expect(h.recovery.recoverLatest("team-one")).resolves.toEqual({ status: "unavailable" });
      expect(h.assets.restore).not.toHaveBeenCalled();
      expect(h.importCloudPractice).not.toHaveBeenCalled();
      expect(h.metadataStore.setRevision).not.toHaveBeenCalled();
    }
  });

  it("fails closed when restored assets remove the cloud document team identity", async () => {
    const document = remoteDocument();
    const restored = structuredClone(document);
    restored.teamId = "";
    const h = harness({
      rows: [metadata(document)],
      loaded: { status: "found", revision: 5, document, updatedAt: savedAt },
      restored: { document: restored, blobs: new Map() }
    });

    await expect(h.recovery.recoverLatest("team-one")).resolves.toEqual({ status: "unavailable" });
    expect(h.importCloudPractice).not.toHaveBeenCalled();
    expect(h.metadataStore.setRevision).not.toHaveBeenCalled();
  });

  it("does not seed cloud metadata when the atomic local import fails", async () => {
    const document = remoteDocument();
    const h = harness({
      rows: [metadata(document)],
      loaded: { status: "found", revision: 5, document, updatedAt: savedAt },
      importFailure: new Error("local race")
    });
    await expect(h.recovery.recoverLatest("team-one")).resolves.toEqual({ status: "unavailable" });
    expect(h.metadataStore.setRevision).not.toHaveBeenCalled();
  });

  it("reports a local-only recovery honestly if CAS metadata cannot be stored after import", async () => {
    const document = remoteDocument();
    const h = harness({
      rows: [metadata(document)],
      loaded: { status: "found", revision: 5, document, updatedAt: savedAt },
      metadataFailure: new Error("storage unavailable")
    });
    await expect(h.recovery.recoverLatest("team-one")).resolves.toEqual({
      status: "restored-local-only",
      documentId: document.documentId
    });
    expect(h.importCloudPractice).toHaveBeenCalledOnce();
  });

  it("keeps cloud discovery failures non-blocking and does not write", async () => {
    const h = harness();
    vi.mocked(h.cloud.list).mockRejectedValueOnce(new Error("offline"));
    await expect(h.recovery.recoverLatest("team-one")).resolves.toEqual({ status: "unavailable" });
    expect(h.importCloudPractice).not.toHaveBeenCalled();
    expect(h.metadataStore.setRevision).not.toHaveBeenCalled();
  });

  it("uses concise, honest account status copy", () => {
    const values: CloudProgressRecoveryResult[] = [
      { status: "local-present", documentId: "local" },
      { status: "no-cloud-save" },
      { status: "restored", documentId: "remote", revision: 4 },
      { status: "restored-local-only", documentId: "remote" },
      { status: "unavailable" }
    ];
    expect(values.map(cloudRecoveryStatusMessage)).toEqual([
      "Continue from this device · cloud autosave ready",
      "Progress saves on this device first.",
      "Cloud save restored to this device · revision 4",
      "Cloud save restored here · cloud autosave will reconnect",
      "Cloud check paused · this device is unchanged"
    ]);
  });
});
