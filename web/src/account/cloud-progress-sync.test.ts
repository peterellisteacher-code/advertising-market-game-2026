import { describe, expect, it, vi } from "vitest";
import { createBlankCampaignDocument, type CampaignDocumentV1 } from "../domain/campaign-document";
import { SerializedAutosave, type AutosaveState } from "../persistence/serialized-autosave";
import {
  AccountClientError,
  type CloudProgressClient
} from "./account-client";
import { AccountAssetClientError } from "./account-asset-client";
import type {
  CloudProgressOutbox,
  CloudProgressOutboxEntry
} from "./cloud-progress-outbox";
import {
  BrowserCloudSyncMetadataStore,
  CloudProgressSync,
  queueCloudProgressAfterLocalSave,
  type CloudProgressAssetAdapter,
  type CloudProgressSyncState,
  type CloudSyncStorage
} from "./cloud-progress-sync";

class MemoryStorage implements CloudSyncStorage {
  readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

class MemoryOutbox implements CloudProgressOutbox {
  readonly accounts = new Map<string, Map<string, CloudProgressOutboxEntry>>();
  #active: Map<string, CloudProgressOutboxEntry> | null = null;
  #sequence = 0;

  async activateAccount(username: string): Promise<void> {
    let account = this.accounts.get(username);
    if (!account) {
      account = new Map();
      this.accounts.set(username, account);
    }
    this.#active = account;
  }

  deactivateAccount(): void {
    this.#active = null;
  }

  async resetAccount(username: string): Promise<void> {
    const account = this.accounts.get(username);
    if (this.#active === account) this.#active = null;
    this.accounts.delete(username);
  }

  async put(document: CampaignDocumentV1): Promise<CloudProgressOutboxEntry> {
    if (!this.#active) throw new Error("Outbox locked");
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function offlineDocument(documentId = "campaign-main"): CampaignDocumentV1 {
  return createBlankCampaignDocument({
    documentId,
    sessionId: "practice-session",
    mode: "offline"
  });
}

function client(overrides: Partial<CloudProgressClient> = {}): CloudProgressClient {
  return {
    save: vi.fn().mockResolvedValue({
      status: "saved",
      revision: 1,
      updatedAt: "2026-07-17T01:02:03.000Z"
    }),
    load: vi.fn().mockResolvedValue({ status: "not-found" }),
    list: vi.fn().mockResolvedValue([]),
    ...overrides
  };
}

describe("CloudProgressSync", () => {
  it("treats asset authentication expiry during preparation as a signed-out account", async () => {
    const onAuthenticationRequired = vi.fn();
    const states: CloudProgressSyncState[] = [];
    const sync = new CloudProgressSync({
      client: client(),
      metadata: new BrowserCloudSyncMetadataStore(new MemoryStorage()),
      assetAdapter: {
        prepare: vi.fn().mockRejectedValue(new AccountAssetClientError("AUTHENTICATION_REQUIRED"))
      },
      onAuthenticationRequired,
      onState: (state) => states.push(state)
    });
    await sync.setAccount("team-one");

    sync.enqueue(offlineDocument());
    await sync.settled();

    expect(states.at(-1)).toEqual({ phase: "signed-out" });
    expect(onAuthenticationRequired).toHaveBeenCalledOnce();
  });

  it("keeps the 300ms serialized local save successful when cloud is offline", async () => {
    const storage = new MemoryStorage();
    const states: CloudProgressSyncState[] = [];
    const cloud = client({
      save: vi.fn().mockRejectedValue(new AccountClientError("PROGRESS_UNAVAILABLE"))
    });
    const sync = new CloudProgressSync({
      client: cloud,
      metadata: new BrowserCloudSyncMetadataStore(storage),
      onState: (state) => states.push(state)
    });
    await sync.setAccount("team-one");
    const document = offlineDocument();
    const autosaveStates: AutosaveState<{ document: CampaignDocumentV1 }>[] = [];
    const localCommit = vi.fn<
      (_operationId: string, _version: number) => Promise<{ document: CampaignDocumentV1 }>
    >().mockResolvedValue({ document });
    const autosave = new SerializedAutosave<{ document: CampaignDocumentV1 }>({
      delayMs: 300,
      createOperationId: () => "autosave-operation",
      commit: localCommit,
      onCommitResult: (result) => queueCloudProgressAfterLocalSave(sync, result.document),
      onState: (state) => autosaveStates.push(state)
    });

    autosave.schedule();
    await autosave.flush();
    await sync.settled();

    expect(localCommit).toHaveBeenCalledOnce();
    expect(autosaveStates.at(-1)).toMatchObject({ phase: "saved" });
    expect(states.at(-1)).toEqual({ phase: "offline", documentId: "campaign-main" });
  });

  it("uses separate CAS metadata and prepares immutable referenced assets before each PUT", async () => {
    const storage = new MemoryStorage();
    const save = vi.fn()
      .mockResolvedValueOnce({
        status: "saved",
        revision: 1,
        updatedAt: "2026-07-17T01:02:03.000Z"
      })
      .mockResolvedValueOnce({
        status: "saved",
        revision: 2,
        updatedAt: "2026-07-17T01:03:03.000Z"
      });
    const adapter: CloudProgressAssetAdapter = { prepare: vi.fn(async (value) => structuredClone(value)) };
    const sync = new CloudProgressSync({
      client: client({ save }),
      metadata: new BrowserCloudSyncMetadataStore(storage),
      assetAdapter: adapter
    });
    await sync.setAccount("team-one");
    const document = offlineDocument();

    sync.enqueue(document);
    await sync.settled();
    document.revision = 1;
    sync.enqueue(document);
    await sync.settled();

    expect(adapter.prepare).toHaveBeenCalledTimes(2);
    expect(save.mock.calls.map(([, revision]) => revision)).toEqual([0, 1]);
    const resumedMetadata = new BrowserCloudSyncMetadataStore(storage);
    await resumedMetadata.activateAccount("team-one");
    expect(resumedMetadata.getRevision("campaign-main")).toBe(2);
  });

  it("stops blind retry on conflict, fetches the remote document, and retains local work", async () => {
    const local = offlineDocument();
    local.product.name = "Local bottle";
    const remote = offlineDocument();
    remote.product.name = "Remote bottle";
    const save = vi.fn().mockResolvedValue({ status: "conflict", currentRevision: 7 });
    const load = vi.fn().mockResolvedValue({
      status: "found",
      revision: 7,
      document: remote,
      updatedAt: "2026-07-17T01:02:03.000Z"
    });
    const states: CloudProgressSyncState[] = [];
    const sync = new CloudProgressSync({
      client: client({ save, load }),
      metadata: new BrowserCloudSyncMetadataStore(new MemoryStorage()),
      onState: (state) => states.push(state)
    });
    await sync.setAccount("team-one");

    sync.enqueue(local);
    await sync.settled();
    sync.enqueue(local);
    await sync.settled();

    expect(save).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledWith("campaign-main");
    expect(states.at(-1)).toMatchObject({
      phase: "conflict",
      documentId: "campaign-main",
      currentRevision: 7,
      remote: { document: { product: { name: "Remote bottle" } } }
    });
    expect(local.product.name).toBe("Local bottle");
  });

  it("retains hashed per-account revision metadata across logout and account switching", async () => {
    const storage = new MemoryStorage();
    const metadata = new BrowserCloudSyncMetadataStore(storage);
    const sync = new CloudProgressSync({ client: client(), metadata });
    await sync.setAccount("team-one");
    metadata.setRevision("campaign-main", 4);

    sync.signOut();

    const resumed = new BrowserCloudSyncMetadataStore(storage);
    await resumed.activateAccount("team-one");
    expect(resumed.getRevision("campaign-main")).toBe(4);
    await resumed.activateAccount("team-two");
    expect(resumed.getRevision("campaign-main")).toBe(0);
    resumed.setRevision("campaign-main", 5);
    await resumed.activateAccount("team-one");
    expect(resumed.getRevision("campaign-main")).toBe(4);
    expect([...storage.values.keys()].join(" ")).not.toContain("team-one");
    expect([...storage.values.keys()].join(" ")).not.toContain("team-two");
  });

  it("removes only the selected account's revision metadata", async () => {
    const storage = new MemoryStorage();
    const metadata = new BrowserCloudSyncMetadataStore(storage);
    await metadata.activateAccount("team-one");
    metadata.setRevision("campaign-main", 4);
    await metadata.activateAccount("team-two");
    metadata.setRevision("campaign-main", 7);

    await metadata.resetAccount("team-one");

    expect(metadata.getRevision("campaign-main")).toBe(7);
    await metadata.activateAccount("team-one");
    expect(metadata.getRevision("campaign-main")).toBe(0);
    await metadata.activateAccount("team-two");
    expect(metadata.getRevision("campaign-main")).toBe(7);
  });

  it("resumes a returning account with its preserved CAS revision instead of revision zero", async () => {
    const storage = new MemoryStorage();
    const firstMetadata = new BrowserCloudSyncMetadataStore(storage);
    const firstSession = new CloudProgressSync({ client: client(), metadata: firstMetadata });
    await firstSession.setAccount("team-one");
    firstMetadata.setRevision("campaign-main", 4);
    firstSession.signOut();

    const save = vi.fn().mockResolvedValue({
      status: "saved",
      revision: 5,
      updatedAt: "2026-07-17T01:02:03.000Z"
    });
    const returningSession = new CloudProgressSync({
      client: client({ save }),
      metadata: new BrowserCloudSyncMetadataStore(storage)
    });
    await returningSession.setAccount("team-one");
    returningSession.enqueue(offlineDocument());
    await returningSession.settled();

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ documentId: "campaign-main" }), 4);
  });

  it("never syncs live-room documents", async () => {
    const save = vi.fn();
    const sync = new CloudProgressSync({
      client: client({ save }),
      metadata: new BrowserCloudSyncMetadataStore(new MemoryStorage())
    });
    await sync.setAccount("team-one");
    const room = createBlankCampaignDocument({
      documentId: "room-campaign",
      sessionId: "room-session",
      mode: "room",
      roomId: "room-one",
      teamId: "team-one"
    });

    sync.enqueue(room);
    await sync.settled();

    expect(save).not.toHaveBeenCalled();
  });

  it("never carries queued progress or stale acknowledgements across an account change", async () => {
    const first = deferred<{
      status: "saved";
      revision: number;
      updatedAt: string;
    }>();
    const save = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue({
        status: "saved",
        revision: 1,
        updatedAt: "2026-07-17T01:02:03.000Z"
      });
    const storage = new MemoryStorage();
    const metadata = new BrowserCloudSyncMetadataStore(storage);
    const sync = new CloudProgressSync({ client: client({ save }), metadata });
    await sync.setAccount("team-one");
    sync.enqueue(offlineDocument("campaign-first"));
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    sync.enqueue(offlineDocument("campaign-queued"));

    sync.signOut();
    await sync.setAccount("team-two");
    first.resolve({
      status: "saved",
      revision: 8,
      updatedAt: "2026-07-17T01:02:03.000Z"
    });
    await sync.settled();

    expect(save).toHaveBeenCalledOnce();
    expect(metadata.getRevision("campaign-first")).toBe(0);
    expect(metadata.getRevision("campaign-queued")).toBe(0);
    const resumed = new BrowserCloudSyncMetadataStore(storage);
    await resumed.activateAccount("team-one");
    expect(resumed.getRevision("campaign-first")).toBe(8);
    expect(resumed.getRevision("campaign-queued")).toBe(0);
    await resumed.activateAccount("team-two");
    expect(resumed.getRevision("campaign-first")).toBe(0);
  });

  it("never lets a captured late acknowledgement lower or cross account revision metadata", async () => {
    const storage = new MemoryStorage();
    const metadata = new BrowserCloudSyncMetadataStore(storage);
    await metadata.activateAccount("team-one");
    metadata.setRevision("campaign-main", 10);
    const accountOneScope = metadata.captureScope();
    expect(accountOneScope).not.toBeNull();

    metadata.deactivateAccount();
    await metadata.activateAccount("team-two");
    accountOneScope?.setRevision("campaign-main", 8);

    expect(metadata.getRevision("campaign-main")).toBe(0);
    await metadata.activateAccount("team-one");
    expect(metadata.getRevision("campaign-main")).toBe(10);
  });

  it("surfaces reauthentication without clearing local or CAS metadata", async () => {
    const storage = new MemoryStorage();
    const metadata = new BrowserCloudSyncMetadataStore(storage);
    const onAuthenticationRequired = vi.fn();
    const states: CloudProgressSyncState[] = [];
    const sync = new CloudProgressSync({
      client: client({
        save: vi.fn().mockRejectedValue(new AccountClientError("AUTHENTICATION_REQUIRED"))
      }),
      metadata,
      onAuthenticationRequired,
      onState: (state) => states.push(state)
    });
    await sync.setAccount("team-one");
    metadata.setRevision("campaign-main", 3);

    sync.enqueue(offlineDocument());
    await sync.settled();

    expect(onAuthenticationRequired).toHaveBeenCalledOnce();
    expect(states.at(-1)).toEqual({ phase: "signed-out" });
    const resumedMetadata = new BrowserCloudSyncMetadataStore(storage);
    await resumedMetadata.activateAccount("team-one");
    expect(resumedMetadata.getRevision("campaign-main")).toBe(3);
  });

  it("guards local-save acknowledgement from a synchronous cloud adapter failure", () => {
    const document = offlineDocument();
    expect(() => queueCloudProgressAfterLocalSave({
      enqueue() { throw new Error("cloud bug"); }
    }, document)).not.toThrow();
  });

  it("saves only the transformed prepared snapshot after asset preparation", async () => {
    const preparation = deferred<CampaignDocumentV1>();
    const save = vi.fn().mockResolvedValue({
      status: "saved", revision: 1, updatedAt: "2026-07-17T01:02:03.000Z"
    });
    const adapter: CloudProgressAssetAdapter = {
      prepare: vi.fn(() => preparation.promise)
    };
    const sync = new CloudProgressSync({
      client: client({ save }), metadata: new BrowserCloudSyncMetadataStore(new MemoryStorage()), assetAdapter: adapter
    });
    const document = offlineDocument();
    await sync.setAccount("team-one");
    sync.enqueue(document);
    await vi.waitFor(() => expect(adapter.prepare).toHaveBeenCalledOnce());
    expect(save).not.toHaveBeenCalled();

    const prepared = structuredClone(document);
    prepared.assetReferences.push({ kind: "cloud-blob", objectId: "photo", blobKey: "photo", mimeType: "image/png", byteLength: 24, sha256: "a".repeat(64) });
    preparation.resolve(prepared);
    await sync.settled();

    expect(save).toHaveBeenCalledWith(prepared, 0);
    expect(document.assetReferences).toEqual([]);
  });

  it("does not write progress when preparation fails or its account epoch becomes stale", async () => {
    const save = vi.fn();
    const failing: CloudProgressAssetAdapter = { prepare: vi.fn().mockRejectedValue(new Error("asset missing")) };
    const metadata = new BrowserCloudSyncMetadataStore(new MemoryStorage());
    const sync = new CloudProgressSync({ client: client({ save }), metadata, assetAdapter: failing });
    await sync.setAccount("team-one");
    sync.enqueue(offlineDocument());
    await sync.settled();
    expect(save).not.toHaveBeenCalled();

    const delayed = deferred<CampaignDocumentV1>();
    const staleAdapter: CloudProgressAssetAdapter = { prepare: vi.fn(() => delayed.promise) };
    const stale = new CloudProgressSync({ client: client({ save }), metadata, assetAdapter: staleAdapter });
    await stale.setAccount("team-one");
    stale.enqueue(offlineDocument("stale-campaign"));
    await vi.waitFor(() => expect(staleAdapter.prepare).toHaveBeenCalledOnce());
    await stale.setAccount("team-two");
    delayed.resolve(offlineDocument("stale-campaign"));
    await stale.settled();
    expect(save).not.toHaveBeenCalled();
  });

  it("coalesces a burst to the newest durable snapshot before the cloud write", async () => {
    const outbox = new MemoryOutbox();
    const save = vi.fn().mockResolvedValue({
      status: "saved", revision: 1, updatedAt: "2026-07-17T01:02:03.000Z"
    });
    const sync = new CloudProgressSync({
      client: client({ save }),
      metadata: new BrowserCloudSyncMetadataStore(new MemoryStorage()),
      outbox,
      sendDelayMs: 500
    });
    await sync.setAccount("team-one");

    for (let index = 0; index < 100; index += 1) {
      const document = offlineDocument();
      document.product.name = `Version ${index}`;
      document.revision = index;
      sync.enqueue(document);
    }
    await sync.settled();

    expect(save).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      revision: 99,
      product: expect.objectContaining({ name: "Version 99" })
    }), 0);
    await expect(outbox.list()).resolves.toEqual([]);
  });

  it("replays an account's durable pending snapshot after a new sync runtime activates", async () => {
    const outbox = new MemoryOutbox();
    await outbox.activateAccount("team-one");
    await outbox.put(offlineDocument("campaign-reload"));
    outbox.deactivateAccount();
    const save = vi.fn().mockResolvedValue({
      status: "saved", revision: 3, updatedAt: "2026-07-17T01:02:03.000Z"
    });
    const sync = new CloudProgressSync({
      client: client({ save }),
      metadata: new BrowserCloudSyncMetadataStore(new MemoryStorage()),
      outbox
    });

    await sync.setAccount("team-one");
    await sync.settled();

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: "campaign-reload" }),
      0
    );
    await expect(outbox.list()).resolves.toEqual([]);
  });

  it("keeps local work retryable when loading the conflicting cloud copy fails", async () => {
    const outbox = new MemoryOutbox();
    const save = vi.fn()
      .mockResolvedValueOnce({ status: "conflict", currentRevision: 7 })
      .mockResolvedValueOnce({
        status: "saved", revision: 8, updatedAt: "2026-07-17T01:03:03.000Z"
      });
    const load = vi.fn().mockRejectedValueOnce(new AccountClientError("PROGRESS_UNAVAILABLE"));
    const states: CloudProgressSyncState[] = [];
    const metadata = new BrowserCloudSyncMetadataStore(new MemoryStorage());
    const sync = new CloudProgressSync({
      client: client({ save, load }),
      metadata,
      outbox,
      onState: (state) => states.push(state)
    });
    await sync.setAccount("team-one");
    sync.enqueue(offlineDocument());
    await sync.settled();

    expect(states.at(-1)).toMatchObject({
      phase: "conflict",
      documentId: "campaign-main",
      currentRevision: 7,
      retryable: true,
      local: { documentId: "campaign-main" }
    });
    metadata.setRevision("campaign-main", 7);
    sync.retry("campaign-main");
    await sync.settled();

    expect(save).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toMatchObject({ phase: "synced", revision: 8 });
    await expect(outbox.list()).resolves.toEqual([]);
  });

  it("coalesces newer local edits while a conflict is waiting and keeps the newest copy", async () => {
    const outbox = new MemoryOutbox();
    const remote = offlineDocument();
    remote.product.name = "Cloud version";
    const save = vi.fn()
      .mockResolvedValueOnce({ status: "conflict", currentRevision: 7 })
      .mockResolvedValueOnce({
        status: "saved", revision: 8, updatedAt: "2026-07-17T01:03:03.000Z"
      });
    const sync = new CloudProgressSync({
      client: client({
        save,
        load: vi.fn().mockResolvedValue({
          status: "found",
          documentId: remote.documentId,
          revision: 7,
          document: remote,
          updatedAt: "2026-07-17T01:02:03.000Z"
        })
      }),
      metadata: new BrowserCloudSyncMetadataStore(new MemoryStorage()),
      outbox
    });
    await sync.setAccount("team-one");
    sync.enqueue(offlineDocument());
    await sync.settled();

    const newest = offlineDocument();
    newest.product.name = "Newest local version";
    newest.revision = 1;
    sync.enqueue(newest);
    await sync.settled();
    await expect(outbox.get("campaign-main")).resolves.toMatchObject({
      document: {
        revision: 1,
        product: { name: "Newest local version" }
      }
    });

    await sync.resolveConflict("campaign-main", "keep-local");
    await sync.settled();

    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({
      revision: 1,
      product: expect.objectContaining({ name: "Newest local version" })
    }), 7);
    await expect(outbox.list()).resolves.toEqual([]);
  });

  it("passes the newest durable local snapshot to use-cloud and removes only that snapshot", async () => {
    const outbox = new MemoryOutbox();
    const remote = offlineDocument();
    remote.product.name = "Cloud version";
    const onUseCloud = vi.fn().mockResolvedValue(undefined);
    const sync = new CloudProgressSync({
      client: client({
        save: vi.fn().mockResolvedValue({ status: "conflict", currentRevision: 7 }),
        load: vi.fn().mockResolvedValue({
          status: "found",
          documentId: remote.documentId,
          revision: 7,
          document: remote,
          updatedAt: "2026-07-17T01:02:03.000Z"
        })
      }),
      metadata: new BrowserCloudSyncMetadataStore(new MemoryStorage()),
      outbox,
      onUseCloud
    });
    await sync.setAccount("team-one");
    sync.enqueue(offlineDocument());
    await sync.settled();
    const newest = offlineDocument();
    newest.product.name = "Newest local version";
    newest.revision = 1;
    sync.enqueue(newest);
    await sync.settled();

    await sync.resolveConflict("campaign-main", "use-cloud");

    expect(onUseCloud).toHaveBeenCalledWith(
      expect.objectContaining({
        revision: 7,
        document: expect.objectContaining({
          product: expect.objectContaining({ name: "Cloud version" })
        })
      }),
      expect.objectContaining({
        revision: 1,
        product: expect.objectContaining({ name: "Newest local version" })
      })
    );
    await expect(outbox.list()).resolves.toEqual([]);
  });
});
