import { IDBFactory } from "fake-indexeddb";
import { Blob as NodeBlob } from "node:buffer";
import { describe, expect, it } from "vitest";
import {
  CampaignDocumentSchema,
  createBlankCampaignDocument
} from "../domain/campaign-document";
import {
  AccountScopedDraftStore,
  accountDraftDatabaseName
} from "./account-scoped-draft-store";
import {
  DEFAULT_DRAFT_DATABASE_NAME,
  IndexedDbDraftStore
} from "./draft-store";
import { LocalPracticeService } from "./local-practice-service";

// fake-indexeddb uses Node structuredClone; jsdom's Blob is not cloneable by it.
Object.defineProperty(globalThis, "Blob", { configurable: true, value: NodeBlob });

describe("AccountScopedDraftStore", () => {
  it("keeps cloud-practice imports account-locked and delegates them to the active account", async () => {
    const factory = new IDBFactory();
    const store = new AccountScopedDraftStore({ factory });
    const document = CampaignDocumentSchema.parse({
      ...createBlankCampaignDocument({
        documentId: "account-cloud-import-document",
        sessionId: "account-cloud-import-session",
        mode: "offline"
      }),
      teamId: "account-cloud-import-team",
      revision: 2
    });
    const input = {
      runId: "account-cloud-import-run",
      teamAlias: "Account Cloud Pair",
      document,
      blobs: new Map<string, Blob>(),
      levelLocked: true,
      operationId: "account-cloud-import-operation",
      savedAt: "2026-07-17T06:20:00.000Z"
    } as const;

    await expect(store.importCloudPractice(input)).rejects.toThrow(/account storage is locked/i);
    await store.activateAccount("team-one");
    const checkpoint = await store.importCloudPractice(input);
    expect((await store.resumeLocalPractice())?.checkpoint).toEqual(checkpoint);

    await store.activateAccount("team-two");
    expect(await store.resumeLocalPractice()).toBeNull();
    await store.activateAccount("team-one");
    expect((await store.resumeLocalPractice())?.checkpoint).toEqual(checkpoint);
  });

  it("isolates drafts and the active practice slot between two accounts in one browser", async () => {
    const factory = new IDBFactory();
    const store = new AccountScopedDraftStore({ factory });
    const practice = new LocalPracticeService(store, {
      now: () => new Date("2026-07-17T06:00:00.000Z")
    });

    await expect(store.load("anything")).rejects.toThrow(/account storage is locked/i);

    await store.activateAccount("team-one");
    const accountA = await practice.begin("Signal Foxes", "account-a-begin");
    const accountADocument = CampaignDocumentSchema.parse({
      ...createBlankCampaignDocument({
        documentId: "account-a-private-draft",
        sessionId: "account-a-private-session",
        mode: "offline"
      }),
      fabricState: {
        version: "7.4.0",
        objects: [{
          type: "image",
          objectId: "account-a-private-image",
          elementKind: "image",
          accessibleName: "Account A private image",
          src: "local-blob:account-a-private-png"
        }]
      },
      assetReferences: [{
        kind: "local-blob",
        objectId: "account-a-private-image",
        blobKey: "account-a-private-png",
        mimeType: "image/png"
      }]
    });
    await store.save(accountADocument, new Map([[
      "account-a-private-png",
      new Blob([Uint8Array.of(1, 2, 3, 4)], { type: "image/png" })
    ]]));

    await store.activateAccount("team-two");
    expect(await practice.resume()).toBeNull();
    expect(await store.load(accountA.document.documentId)).toBeNull();
    expect(await store.load(accountADocument.documentId)).toBeNull();
    const accountB = await practice.begin("Neon Narwhals", "account-b-begin");

    await store.activateAccount("team-one");
    expect((await practice.resume())?.checkpoint).toEqual(accountA.checkpoint);
    const restoredAccountA = await store.load(accountADocument.documentId);
    expect(restoredAccountA?.document).toEqual(accountADocument);
    expect(Array.from(new Uint8Array(
      await restoredAccountA!.blobs.get("account-a-private-png")!.arrayBuffer()
    ))).toEqual([1, 2, 3, 4]);
    expect(await store.load(accountB.document.documentId)).toBeNull();
  });

  it("derives a deterministic opaque safe database namespace from a validated username", async () => {
    const accountA = await accountDraftDatabaseName("team-one");
    const accountAAgain = await accountDraftDatabaseName("team-one");
    const accountB = await accountDraftDatabaseName("team-two");

    expect(accountAAgain).toBe(accountA);
    expect(accountB).not.toBe(accountA);
    expect(accountA).toMatch(/^advertising-market-campaign-drafts-account-[a-f0-9]{64}$/u);
    expect(accountA).not.toContain("team-one");
    await expect(accountDraftDatabaseName("Team-One")).rejects.toThrow(/validated username/i);
  });

  it("never attaches the legacy unscoped database to an account", async () => {
    const factory = new IDBFactory();
    const legacy = new IndexedDbDraftStore({ factory });
    expect(legacy.databaseName).toBe(DEFAULT_DRAFT_DATABASE_NAME);
    const legacyDocument = createBlankCampaignDocument({
      documentId: "legacy-private-draft",
      sessionId: "legacy-private-session",
      mode: "offline"
    });
    await legacy.save(legacyDocument, new Map());

    const scoped = new AccountScopedDraftStore({ factory });
    await scoped.activateAccount("team-one");

    expect(await scoped.load(legacyDocument.documentId)).toBeNull();
    expect((await legacy.load(legacyDocument.documentId))?.document).toEqual(legacyDocument);
  });

  it("locks future operations after deactivation without deleting account work", async () => {
    const factory = new IDBFactory();
    const store = new AccountScopedDraftStore({ factory });
    const document = createBlankCampaignDocument({
      documentId: "durable-after-deactivation",
      sessionId: "durable-after-deactivation-session",
      mode: "offline"
    });
    await store.activateAccount("team-one");
    await store.save(document, new Map());

    store.deactivateAccount();
    await expect(store.load(document.documentId)).rejects.toThrow(/account storage is locked/i);

    await store.activateAccount("team-one");
    expect((await store.load(document.documentId))?.document).toEqual(document);
  });

  it("fails closed instead of retaining the previous account when replacement activation fails", async () => {
    const store = new AccountScopedDraftStore({ factory: new IDBFactory() });
    await store.activateAccount("team-one");

    await expect(store.activateAccount("Team-Two")).rejects.toThrow(/validated username/i);

    await expect(store.resumeLocalPractice()).rejects.toThrow(/account storage is locked/i);
  });

  it("lets an already-started account A write finish only in A's captured database", async () => {
    const store = new AccountScopedDraftStore({ factory: new IDBFactory() });
    const document = createBlankCampaignDocument({
      documentId: "account-a-in-flight-draft",
      sessionId: "account-a-in-flight-session",
      mode: "offline"
    });
    await store.activateAccount("team-one");

    const accountAWrite = store.save(document, new Map());
    await store.activateAccount("team-two");
    await accountAWrite;

    expect(await store.load(document.documentId)).toBeNull();
    await store.activateAccount("team-one");
    expect((await store.load(document.documentId))?.document).toEqual(document);
  });

  it("uses an isolated volatile practice store when scoped IndexedDB cannot be opened", async () => {
    const unavailableFactory = {
      open: () => { throw new Error("synthetic indexeddb denial"); }
    } as unknown as IDBFactory;
    const store = new AccountScopedDraftStore({ factory: unavailableFactory });
    const practice = new LocalPracticeService(store, {
      now: () => new Date("2026-07-28T03:30:00.000Z")
    });

    await expect(store.activateAccount("team-one")).resolves.toBeUndefined();
    const started = await practice.begin("Meidi Pair", "volatile-begin");
    const locked = await practice.setLock({
      checkpoint: started.checkpoint,
      levelLocked: true,
      operationId: "volatile-lock"
    });
    expect(locked.checkpoint.sequence).toBe(1);
    expect((await practice.resume())?.checkpoint).toEqual(locked.checkpoint);

    await store.activateAccount("team-two");
    expect(await practice.resume()).toBeNull();
    await store.activateAccount("team-one");
    expect(await practice.resume()).toBeNull();
  });

  it("resets only the exact account database", async () => {
    const factory = new IDBFactory();
    const store = new AccountScopedDraftStore({ factory });
    const accountA = createBlankCampaignDocument({
      documentId: "account-a-reset-draft",
      sessionId: "account-a-reset-session",
      mode: "offline"
    });
    const accountB = createBlankCampaignDocument({
      documentId: "account-b-kept-draft",
      sessionId: "account-b-kept-session",
      mode: "offline"
    });
    await store.activateAccount("team-one");
    await store.save(accountA, new Map());
    await store.activateAccount("team-two");
    await store.save(accountB, new Map());

    await store.resetAccount("team-one");

    expect((await store.load(accountB.documentId))?.document).toEqual(accountB);
    await store.activateAccount("team-one");
    expect(await store.load(accountA.documentId)).toBeNull();
    await store.activateAccount("team-two");
    expect((await store.load(accountB.documentId))?.document).toEqual(accountB);
  });
});
