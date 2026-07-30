import "fake-indexeddb/auto";
import { Blob as NodeBlob } from "node:buffer";
import {
  IDBDatabase as FakeIDBDatabase,
  IDBFactory,
  IDBIndex as FakeIDBIndex,
  IDBObjectStore as FakeIDBObjectStore
} from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CampaignDocumentSchema,
  createBlankCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import { migrateCampaignDocument } from "./draft-migrations";
import {
  canonicalDurableDocumentHash,
  IndexedDbDraftStore,
  rehydrateLocalAssetBlobs,
  type ObjectUrlPort
} from "./draft-store";

// fake-indexeddb uses Node structuredClone; jsdom's Blob is not cloneable by it.
Object.defineProperty(globalThis, "Blob", { configurable: true, value: NodeBlob });

const nestedRecord = (depth: number): Record<string, unknown> => {
  let value: Record<string, unknown> = { leaf: true };
  for (let index = 0; index < depth; index += 1) value = { child: value };
  return value;
};

function campaignFixture(documentId = "campaign-a"): CampaignDocumentV1 {
  const blank = createBlankCampaignDocument({
    documentId,
    sessionId: `session-${documentId}`,
    mode: "offline"
  });
  return CampaignDocumentSchema.parse({
    ...blank,
    updatedAt: "2026-07-12T00:00:00.000Z",
    product: { name: "Solar Sprint", priceCents: 2499 },
    fabricState: {
      version: "7.4.0",
      objects: [
        {
          type: "textbox",
          objectId: "headline",
          elementKind: "text",
          accessibleName: "Campaign headline",
          text: "Charge into tomorrow",
          left: 420,
          top: 170,
          scaleX: 1.15,
          scaleY: 0.92,
          angle: -7,
          flipX: false,
          flipY: false
        },
        {
          type: "image",
          objectId: "photo",
          elementKind: "image",
          assetId: "openverse-solar-runner",
          sourceHash: "sha256-photo",
          accessibleName: "Runner carrying a solar backpack",
          src: "local-blob:photo-png",
          cropX: 80,
          cropY: 40,
          width: 520,
          height: 360,
          cropFocalX: 0.65,
          cropFocalY: 0.4
        },
        {
          type: "path",
          objectId: "burst-drawing",
          elementKind: "drawing",
          accessibleName: "Hand-drawn energy burst",
          path: [["M", 40, 40], ["L", 260, 120]],
          stroke: "#f59e0b",
          strokeWidth: 16
        },
        {
          type: "image",
          objectId: "masked-product",
          elementKind: "masked-component",
          assetId: "solar-pack-master",
          sourceHash: "sha256-masked-variant",
          accessibleName: "Recoloured solar backpack",
          src: "local-blob:variant-png",
          variant: {
            body: { colour: "#0f766e", materialId: "fabric", opacity: 1 },
            trim: { colour: "#facc15", materialId: "rubber", opacity: 1 }
          },
          localBlobId: "variant-png"
        }
      ]
    },
    drawingLayers: [{
      objectId: "burst-drawing",
      tool: "marker",
      path: "M 40 40 L 260 120"
    }],
    evidence: {
      price: ["headline"],
      attention: ["burst-drawing"],
      interest: ["photo"],
      desire: ["masked-product"],
      action: ["headline"]
    },
    assetReferences: [
      {
        kind: "local-blob",
        objectId: "photo",
        assetId: "openverse-solar-runner",
        blobKey: "photo-png",
        mimeType: "image/png"
      },
      {
        kind: "local-blob",
        objectId: "masked-product",
        assetId: "solar-pack-master",
        blobKey: "variant-png",
        mimeType: "image/png"
      }
    ]
  });
}

function nestedLocalBlobCampaignFixture(documentId = "nested-local-blob"): CampaignDocumentV1 {
  const blank = createBlankCampaignDocument({
    documentId,
    sessionId: `session-${documentId}`,
    mode: "offline"
  });
  return CampaignDocumentSchema.parse({
    ...blank,
    updatedAt: "2026-07-14T00:00:00.000Z",
    product: { name: "Citrus Spark", priceCents: 299 },
    fabricState: {
      version: "7.4.0",
      objects: [{
        type: "Group",
        objectId: "product-shell",
        elementKind: "product-shell",
        accessibleName: "Citrus Spark can",
        clipPath: {
          type: "Path",
          objectId: "nested-artwork",
          elementKind: "image",
          accessibleName: "Decorative clip path must not satisfy the asset reference"
        },
        objects: [
          {
            type: "Path",
            productLayer: "base-shell",
            shellRegion: "body",
            fill: "#fef3c7"
          },
          {
            type: "Group",
            productLayer: "artwork-slot",
            artworkSlotId: "primary",
            objects: [{
              type: "FabricImage",
              objectId: "nested-artwork",
              elementKind: "image",
              assetId: "citrus-slice",
              sourceHash: "sha256-citrus-slice",
              accessibleName: "Sliced citrus artwork",
              src: "blob:http://localhost/transient-nested-artwork"
            }]
          }
        ]
      }]
    },
    evidence: {
      ...blank.evidence,
      interest: ["nested-artwork"]
    },
    assetReferences: [{
      kind: "local-blob",
      objectId: "nested-artwork",
      assetId: "citrus-slice",
      blobKey: "nested-artwork-png",
      mimeType: "image/png"
    }]
  });
}

function nestedArtworkObject(document: CampaignDocumentV1): Record<string, unknown> {
  const shellChildren = document.fabricState.objects[0]?.objects;
  if (!Array.isArray(shellChildren)) throw new Error("Missing product-shell children");
  const slot = shellChildren[1];
  if (slot === null || typeof slot !== "object" || Array.isArray(slot)) {
    throw new Error("Missing artwork slot");
  }
  const slotChildren = (slot as Record<string, unknown>).objects;
  if (!Array.isArray(slotChildren)) throw new Error("Missing artwork-slot children");
  const artwork = slotChildren[0];
  if (artwork === null || typeof artwork !== "object" || Array.isArray(artwork)) {
    throw new Error("Missing nested artwork");
  }
  return artwork as Record<string, unknown>;
}

function localBlobs(seed = 1): ReadonlyMap<string, Blob> {
  return new Map([
    ["photo-png", new Blob([new Uint8Array([seed, 2, 3, 4])], { type: "image/png" })],
    ["variant-png", new Blob([new Uint8Array([9, 8, 7, seed])], { type: "image/png" })]
  ]);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error), { once: true });
  });
}

async function rawDocumentRecords(factory: IDBFactory, databaseName: string): Promise<Array<{
  documentId: string;
  revision: number;
  document: CampaignDocumentV1;
}>> {
  const database = await requestResult(factory.open(databaseName));
  const transaction = database.transaction("documents", "readonly");
  const values = await requestResult(transaction.objectStore("documents").getAll()) as Array<{
    documentId: string;
    revision: number;
    document: CampaignDocumentV1;
  }>;
  await transactionComplete(transaction);
  database.close();
  return values;
}

async function rawStoreRecords(
  factory: IDBFactory,
  databaseName: string,
  storeName: string
): Promise<unknown[]> {
  const database = await requestResult(factory.open(databaseName));
  const transaction = database.transaction(storeName, "readonly");
  const values = await requestResult(transaction.objectStore(storeName).getAll()) as unknown[];
  await transactionComplete(transaction);
  database.close();
  return values;
}

async function mutateRawRecord(
  factory: IDBFactory,
  databaseName: string,
  storeName: string,
  key: IDBValidKey,
  mutate: (record: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  const database = await requestResult(factory.open(databaseName));
  const transaction = database.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  const record = await requestResult(store.get(key)) as Record<string, unknown> | undefined;
  if (!record) throw new Error(`Missing raw ${storeName} record`);
  store.put(mutate(structuredClone(record)));
  await transactionComplete(transaction);
  database.close();
}

async function rawRecord(
  factory: IDBFactory,
  databaseName: string,
  storeName: string,
  key: IDBValidKey
): Promise<Record<string, unknown> | undefined> {
  const database = await requestResult(factory.open(databaseName));
  const transaction = database.transaction(storeName, "readonly");
  const record = await requestResult(transaction.objectStore(storeName).get(key)) as
    Record<string, unknown> | undefined;
  await transactionComplete(transaction);
  database.close();
  return record;
}

async function deleteRawRecord(
  factory: IDBFactory,
  databaseName: string,
  storeName: string,
  key: IDBValidKey
): Promise<void> {
  const database = await requestResult(factory.open(databaseName));
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(key);
  await transactionComplete(transaction);
  database.close();
}

async function mutateCheckpointAndOperation(
  factory: IDBFactory,
  databaseName: string,
  operationId: string,
  mutate: (checkpoint: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  await mutateRawRecord(
    factory,
    databaseName,
    "local-practice-checkpoints",
    "active",
    (record) => ({
      ...record,
      checkpoint: mutate(record.checkpoint as Record<string, unknown>)
    })
  );
  await mutateRawRecord(
    factory,
    databaseName,
    "local-practice-operations",
    operationId,
    (record) => ({
      ...record,
      checkpoint: mutate(record.checkpoint as Record<string, unknown>)
    })
  );
}

async function blobBytes(blob: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

async function rejectionWithin(promise: Promise<unknown>): Promise<unknown> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then(
        () => new Error("Promise resolved instead of rejecting"),
        (error: unknown) => error
      ),
      new Promise<Error>((resolve) => {
        timer = setTimeout(() => resolve(new Error("Timed out waiting for rejection")), 50);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function requestDouble<T>(options: {
  result?: () => T;
  error?: () => DOMException | null;
} = {}): IDBRequest<T> {
  const request = new EventTarget();
  Object.defineProperties(request, {
    result: { configurable: true, get: options.result ?? (() => undefined as T) },
    error: { configurable: true, get: options.error ?? (() => null) },
    readyState: { configurable: true, get: () => "pending" },
    source: { configurable: true, get: () => null },
    transaction: { configurable: true, get: () => null }
  });
  return request as IDBRequest<T>;
}

function codeUnitCanonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(codeUnitCanonicalise);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, codeUnitCanonicalise(child)]));
  }
  return value;
}

async function codeUnitCanonicalHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(codeUnitCanonicalise(value)));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

afterEach(() => vi.restoreAllMocks());

describe("IndexedDbDraftStore", () => {
  it("rejects excessive non-Fabric nesting before canonical hashing", async () => {
    const document = campaignFixture("deep-canonical-input");
    document.drawingLayers = [{ settings: nestedRecord(140) }];

    await expect(canonicalDurableDocumentHash(document))
      .rejects.toThrow("Campaign JSON exceeds safe traversal bounds");
  });

  it("rejects cyclic or aliased non-Fabric metadata before cloning or hashing", async () => {
    const cyclic = campaignFixture("cyclic-canonical-input");
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    cyclic.drawingLayers = [{ settings: cycle }];

    const aliased = campaignFixture("aliased-canonical-input");
    const shared = { value: true };
    aliased.drawingLayers = [{ left: shared, right: shared }];

    for (const document of [cyclic, aliased]) {
      await expect(canonicalDurableDocumentHash(document))
        .rejects.toThrow("Campaign JSON exceeds safe traversal bounds");
    }
  });

  it("canonically hashes valid non-Fabric metadata near the depth boundary", async () => {
    const document = campaignFixture("bounded-canonical-input");
    document.drawingLayers = [{ settings: nestedRecord(120) }];

    await expect(canonicalDurableDocumentHash(document))
      .resolves.toMatch(/^[a-f0-9]{64}$/u);
  });

  it("upgrades a version-1 draft database without changing its saved revision or blobs", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-v1-upgrade";
    const source = campaignFixture("local-practice-v1-upgrade-document");
    const open = factory.open(databaseName, 1);
    open.addEventListener("upgradeneeded", () => {
      const database = open.result;
      const documents = database.createObjectStore("documents", {
        keyPath: ["documentId", "revision"]
      });
      documents.createIndex("by-document-id", "documentId");
      const blobs = database.createObjectStore("blobs", {
        keyPath: ["documentId", "revision", "blobKey"]
      });
      blobs.createIndex("by-document-revision", ["documentId", "revision"]);
    });
    const legacyDatabase = await requestResult(open);
    const legacyTransaction = legacyDatabase.transaction(["documents", "blobs"], "readwrite");
    legacyTransaction.objectStore("documents").put({
      documentId: source.documentId,
      revision: source.revision,
      document: structuredClone(source)
    });
    for (const [blobKey, blob] of localBlobs(6)) {
      legacyTransaction.objectStore("blobs").put({
        documentId: source.documentId,
        revision: source.revision,
        blobKey,
        blob
      });
    }
    await transactionComplete(legacyTransaction);
    legacyDatabase.close();

    const store = new IndexedDbDraftStore({ databaseName, factory });
    const loaded = await store.loadRevision(source.documentId, 0);

    expect(loaded?.document).toEqual(source);
    expect(await blobBytes(loaded!.blobs.get("photo-png")!)).toEqual([6, 2, 3, 4]);
    expect(await store.resumeLocalPractice()).toBeNull();
    const upgradedDatabase = await requestResult(factory.open(databaseName));
    expect(upgradedDatabase.version).toBe(2);
    expect([...upgradedDatabase.objectStoreNames]).toEqual(expect.arrayContaining([
      "documents",
      "blobs",
      "local-practice-checkpoints",
      "local-practice-operations",
      "local-practice-runs"
    ]));
    upgradedDatabase.close();
  });

  it("loads an exact immutable campaign revision instead of the latest revision", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "exact-revision-load",
      factory: new IDBFactory()
    });
    const revisionZero = campaignFixture("exact-revision-load");
    const revisionOne = CampaignDocumentSchema.parse({
      ...revisionZero,
      revision: 1,
      product: { ...revisionZero.product, name: "Revision one" }
    });
    await store.save(revisionZero, localBlobs(1));
    await store.save(revisionOne, localBlobs(2));

    const loaded = await store.loadRevision(revisionZero.documentId, 0);

    expect(loaded?.document.product.name).toBe("Solar Sprint");
    expect(loaded?.document.revision).toBe(0);
    expect(await blobBytes(loaded!.blobs.get("photo-png")!)).toEqual([1, 2, 3, 4]);
  });

  it("begins and resumes one offline local-practice run from an exact checkpoint", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "local-practice-begin-resume",
      factory: new IDBFactory()
    });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-document-1"),
      sessionId: "local-practice-session-1",
      teamId: "local-practice-team-1"
    });
    const savedAt = "2026-07-17T01:02:03.000Z";

    const checkpoint = await store.beginLocalPractice({
      runId: "local-practice-run-1",
      teamAlias: "Pixel Pair",
      document,
      blobs: localBlobs(4),
      levelLocked: false,
      operationId: "begin-operation-1",
      savedAt
    });

    expect(checkpoint).toEqual({
      contract: "local-practice-checkpoint@1",
      runId: "local-practice-run-1",
      documentId: document.documentId,
      sessionId: document.sessionId,
      teamId: document.teamId,
      teamAlias: "Pixel Pair",
      documentRevision: 0,
      documentHash: await canonicalDurableDocumentHash(document),
      stage: "invent",
      levelLocked: false,
      sequence: 0,
      operationId: "begin-operation-1",
      savedAt
    });
    const recovery = await store.resumeLocalPractice();
    expect(recovery?.checkpoint).toEqual(checkpoint);
    expect(recovery?.document).toEqual(document);
    expect(await blobBytes(recovery!.blobs.get("photo-png")!)).toEqual([4, 2, 3, 4]);
  });

  it("passes typed-array views to WebCrypto when fingerprinting local-practice blobs", async () => {
    const originalDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    const digestInputs: BufferSource[] = [];
    const digestSpy = vi.spyOn(globalThis.crypto.subtle, "digest")
      .mockImplementation(async (algorithm, data) => {
        digestInputs.push(data);
        return originalDigest(algorithm, data);
      });
    const store = new IndexedDbDraftStore({
      databaseName: "local-practice-webcrypto-view",
      factory: new IDBFactory()
    });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-webcrypto-view-document"),
      sessionId: "local-practice-webcrypto-view-session",
      teamId: "local-practice-webcrypto-view-team"
    });

    try {
      await store.beginLocalPractice({
        runId: "local-practice-webcrypto-view-run",
        teamAlias: "View Pair",
        document,
        blobs: localBlobs(4),
        levelLocked: false,
        operationId: "local-practice-webcrypto-view-operation",
        savedAt: "2026-07-20T05:00:00.000Z"
      });
    } finally {
      digestSpy.mockRestore();
    }

    expect(digestInputs.length).toBeGreaterThan(0);
    expect(digestInputs.every((input) => ArrayBuffer.isView(input))).toBe(true);
  });

  it("reads active recovery records from one consistent IndexedDB snapshot", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "local-practice-single-read-snapshot",
      factory: new IDBFactory()
    });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-single-read-document"),
      sessionId: "local-practice-single-read-session",
      teamId: "local-practice-single-read-team"
    });
    await store.beginLocalPractice({
      runId: "local-practice-single-read-run",
      teamAlias: "Snapshot Pair",
      document,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "single-read-begin",
      savedAt: "2026-07-17T01:10:00.000Z"
    });
    const originalTransaction = FakeIDBDatabase.prototype.transaction;
    const readonlyStores: string[][] = [];
    vi.spyOn(FakeIDBDatabase.prototype, "transaction").mockImplementation(function (
      this: IDBDatabase,
      ...args: unknown[]
    ): IDBTransaction {
      const transaction = Reflect.apply(originalTransaction, this, args) as IDBTransaction;
      if (transaction.mode === "readonly") {
        readonlyStores.push([...transaction.objectStoreNames]);
      }
      return transaction;
    } as typeof originalTransaction);

    await store.resumeLocalPractice();

    expect(readonlyStores).toEqual([expect.arrayContaining([
      "documents",
      "blobs",
      "local-practice-checkpoints",
      "local-practice-operations",
      "local-practice-runs"
    ])]);
  });

  it("returns an exact begin retry only while its checkpoint remains active", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-begin-retry";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-begin-retry-document"),
      sessionId: "local-practice-begin-retry-session",
      teamId: "local-practice-begin-retry-team"
    });
    const operation = {
      runId: "local-practice-begin-retry-run",
      teamAlias: "Begin Retry Pair",
      document,
      blobs: localBlobs(3),
      levelLocked: false,
      operationId: "begin-retry-operation",
      savedAt: "2026-07-17T01:12:00.000Z"
    } as const;

    const first = await store.beginLocalPractice(operation);
    const retried = await store.beginLocalPractice(operation);
    const advancedDocument = CampaignDocumentSchema.parse({ ...document, revision: 1 });
    const advanced = await store.commitLocalPractice({
      expectedDocumentRevision: 0,
      expectedSequence: 0,
      document: advancedDocument,
      blobs: localBlobs(4),
      levelLocked: false,
      operationId: "begin-retry-advance",
      savedAt: "2026-07-17T01:13:00.000Z"
    });

    expect(retried).toEqual(first);
    await expect(store.beginLocalPractice(operation)).rejects.toThrow(/stale/i);
    expect((await store.resumeLocalPractice())?.checkpoint).toEqual(advanced);
    expect(await rawDocumentRecords(factory, databaseName)).toHaveLength(2);
  });

  it("rejects reuse of a local-practice run identity for a different campaign", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "local-practice-run-identity-unique",
      factory: new IDBFactory()
    });
    const first = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-identity-document-1"),
      sessionId: "local-practice-identity-session-1",
      teamId: "local-practice-identity-team-1"
    });
    await store.beginLocalPractice({
      runId: "local-practice-identity-run",
      teamAlias: "First Pair",
      document: first,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "identity-begin-1",
      savedAt: "2026-07-17T01:20:00.000Z"
    });
    const second = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-identity-document-2"),
      sessionId: "local-practice-identity-session-2",
      teamId: "local-practice-identity-team-2"
    });

    await expect(store.beginLocalPractice({
      runId: "local-practice-identity-run",
      teamAlias: "Second Pair",
      document: second,
      blobs: localBlobs(2),
      levelLocked: false,
      operationId: "identity-begin-2",
      savedAt: "2026-07-17T01:21:00.000Z"
    })).rejects.toThrow(/identity.*already in use|ConstraintError/i);
    expect((await store.resumeLocalPractice())?.checkpoint.documentId).toBe(first.documentId);
    expect(await store.loadRevision(second.documentId, 0)).toBeNull();
  });

  it("rejects local-practice identity values outside the strict checkpoint contract", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "local-practice-strict-identity",
      factory: new IDBFactory()
    });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-strict-document"),
      sessionId: "local-practice-strict-session",
      teamId: "local-practice-strict-team"
    });

    await expect(store.beginLocalPractice({
      runId: "invalid run identity",
      teamAlias: "Strict Pair",
      document,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "strict-begin",
      savedAt: "2026-07-17T01:25:00.000Z"
    })).rejects.toThrow(/invalid string|runId/i);
    expect(await store.resumeLocalPractice()).toBeNull();
  });

  it("requires distinct run, document, session and team identities", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "local-practice-distinct-identities",
      factory: new IDBFactory()
    });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("reused-local-practice-identity"),
      sessionId: "reused-local-practice-identity",
      teamId: "reused-local-practice-identity"
    });

    await expect(store.beginLocalPractice({
      runId: "reused-local-practice-identity",
      teamAlias: "Distinct Pair",
      document,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "distinct-begin",
      savedAt: "2026-07-17T01:26:00.000Z"
    })).rejects.toThrow(/identities must be distinct/i);
    expect(await store.resumeLocalPractice()).toBeNull();
  });

  it.each([0, 3])(
    "atomically imports and resumes an exact cloud-practice revision %i with referenced blobs",
    async (revision) => {
      const factory = new IDBFactory();
      const databaseName = `cloud-practice-import-revision-${revision}`;
      const store = new IndexedDbDraftStore({ databaseName, factory });
      const document = CampaignDocumentSchema.parse({
        ...campaignFixture(`cloud-import-document-${revision}`),
        sessionId: `cloud-import-session-${revision}`,
        teamId: `cloud-import-team-${revision}`,
        revision,
        gameplay: {
          stage: revision === 0 ? "invent" : "sell",
          pair: {
            activeRole: "strategist",
            handoffCount: revision,
            artDirectorActions: revision,
            strategistActions: revision
          }
        }
      });
      const blobs = new Map(localBlobs(6));
      blobs.set("unreferenced-png", new Blob([Uint8Array.of(99)], { type: "image/png" }));

      const checkpoint = await store.importCloudPractice({
        runId: `cloud-import-run-${revision}`,
        teamAlias: "Cloud Pair",
        document,
        blobs,
        levelLocked: revision > 0,
        operationId: `cloud-import-operation-${revision}`,
        savedAt: "2026-07-17T06:10:00.000Z"
      });

      expect(checkpoint.documentRevision).toBe(revision);
      expect(checkpoint.sequence).toBe(revision);
      const recovery = await store.resumeLocalPractice();
      expect(recovery?.checkpoint).toEqual(checkpoint);
      expect(recovery?.document).toEqual(document);
      expect([...recovery!.blobs.keys()].sort()).toEqual(["photo-png", "variant-png"]);
      expect(await blobBytes(recovery!.blobs.get("photo-png")!)).toEqual([6, 2, 3, 4]);
      expect((await store.loadRevision(document.documentId, revision))?.blobs.has("unreferenced-png"))
        .toBe(false);
    }
  );

  it("rejects a local-only document identity at the cloud import boundary", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "cloud-practice-import-cloud-document-id",
      factory: new IDBFactory()
    });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("Practice:Document"),
      sessionId: "cloud-import-safe-session",
      teamId: "cloud-import-safe-team",
      revision: 1
    });

    await expect(store.importCloudPractice({
      runId: "cloud-import-safe-run",
      teamAlias: "Cloud Pair",
      document,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "cloud-import-safe-operation",
      savedAt: "2026-07-17T06:09:00.000Z"
    })).rejects.toThrow(/cloud.*document identit/i);
    expect(await store.resumeLocalPractice()).toBeNull();
  });

  it("refuses a cloud import while any local-practice checkpoint is active", async () => {
    const factory = new IDBFactory();
    const databaseName = "cloud-practice-import-active-guard";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const activeDocument = CampaignDocumentSchema.parse({
      ...campaignFixture("cloud-import-active-document"),
      sessionId: "cloud-import-active-session",
      teamId: "cloud-import-active-team"
    });
    const activeCheckpoint = await store.beginLocalPractice({
      runId: "cloud-import-active-run",
      teamAlias: "Active Pair",
      document: activeDocument,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "cloud-import-active-begin",
      savedAt: "2026-07-17T06:11:00.000Z"
    });
    const importedDocument = CampaignDocumentSchema.parse({
      ...campaignFixture("cloud-import-blocked-document"),
      sessionId: "cloud-import-blocked-session",
      teamId: "cloud-import-blocked-team",
      revision: 2
    });

    await expect(store.importCloudPractice({
      runId: "cloud-import-blocked-run",
      teamAlias: "Blocked Pair",
      document: importedDocument,
      blobs: localBlobs(2),
      levelLocked: true,
      operationId: "cloud-import-blocked-operation",
      savedAt: "2026-07-17T06:12:00.000Z"
    })).rejects.toThrow(/active local-practice checkpoint/i);

    expect((await store.resumeLocalPractice())?.checkpoint).toEqual(activeCheckpoint);
    expect(await store.loadRevision(importedDocument.documentId, 2)).toBeNull();
    expect(await rawRecord(factory, databaseName, "local-practice-runs", "cloud-import-blocked-run"))
      .toBeUndefined();
    expect(await rawRecord(
      factory,
      databaseName,
      "local-practice-operations",
      "cloud-import-blocked-operation"
    )).toBeUndefined();
  });

  it("refuses a cloud import when any revision of its document identity already exists", async () => {
    const factory = new IDBFactory();
    const databaseName = "cloud-practice-import-document-collision";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const existing = campaignFixture("cloud-import-colliding-document");
    await store.save(existing, localBlobs(1));
    const imported = CampaignDocumentSchema.parse({
      ...existing,
      sessionId: "cloud-import-collision-session",
      teamId: "cloud-import-collision-team",
      revision: 4
    });

    await expect(store.importCloudPractice({
      runId: "cloud-import-collision-run",
      teamAlias: "Collision Pair",
      document: imported,
      blobs: localBlobs(4),
      levelLocked: true,
      operationId: "cloud-import-collision-operation",
      savedAt: "2026-07-17T06:13:00.000Z"
    })).rejects.toThrow(/document identity.*already in use/i);

    expect(await store.resumeLocalPractice()).toBeNull();
    expect(await store.loadRevision(existing.documentId, 4)).toBeNull();
    expect(await rawRecord(factory, databaseName, "local-practice-runs", "cloud-import-collision-run"))
      .toBeUndefined();
  });

  it.each(["run", "operation"] as const)(
    "refuses a cloud import that reuses a durable %s identity",
    async (identityKind) => {
      const factory = new IDBFactory();
      const databaseName = `cloud-practice-import-reused-${identityKind}`;
      const store = new IndexedDbDraftStore({ databaseName, factory });
      const firstDocument = CampaignDocumentSchema.parse({
        ...campaignFixture(`cloud-import-reused-${identityKind}-document-1`),
        sessionId: `cloud-import-reused-${identityKind}-session-1`,
        teamId: `cloud-import-reused-${identityKind}-team-1`,
        revision: 1
      });
      await store.importCloudPractice({
        runId: `cloud-import-reused-${identityKind}-run`,
        teamAlias: "First Cloud Pair",
        document: firstDocument,
        blobs: localBlobs(1),
        levelLocked: false,
        operationId: `cloud-import-reused-${identityKind}-operation`,
        savedAt: "2026-07-17T06:14:00.000Z"
      });
      await deleteRawRecord(factory, databaseName, "local-practice-checkpoints", "active");
      const secondDocument = CampaignDocumentSchema.parse({
        ...campaignFixture(`cloud-import-reused-${identityKind}-document-2`),
        sessionId: `cloud-import-reused-${identityKind}-session-2`,
        teamId: `cloud-import-reused-${identityKind}-team-2`,
        revision: 2
      });

      await expect(store.importCloudPractice({
        runId: identityKind === "run"
          ? `cloud-import-reused-${identityKind}-run`
          : `cloud-import-reused-${identityKind}-run-2`,
        teamAlias: "Second Cloud Pair",
        document: secondDocument,
        blobs: localBlobs(2),
        levelLocked: true,
        operationId: identityKind === "operation"
          ? `cloud-import-reused-${identityKind}-operation`
          : `cloud-import-reused-${identityKind}-operation-2`,
        savedAt: "2026-07-17T06:15:00.000Z"
      })).rejects.toThrow(new RegExp(`${identityKind}.*already (?:used|in use)`, "i"));

      expect(await store.loadRevision(secondDocument.documentId, 2)).toBeNull();
      expect(await store.resumeLocalPractice()).toBeNull();
    }
  );

  it("rolls back all five stores when a cloud import write fails", async () => {
    const factory = new IDBFactory();
    const databaseName = "cloud-practice-import-atomic-rollback";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("cloud-import-rollback-document"),
      sessionId: "cloud-import-rollback-session",
      teamId: "cloud-import-rollback-team",
      revision: 5
    });
    const originalAdd = FakeIDBObjectStore.prototype.add;
    vi.spyOn(FakeIDBObjectStore.prototype, "add").mockImplementation(function (
      this: IDBObjectStore,
      ...args: unknown[]
    ): IDBRequest<IDBValidKey> {
      const value = args[0] as Record<string, unknown> | undefined;
      if (this.name === "local-practice-operations" &&
        value?.operationId === "cloud-import-rollback-operation") {
        throw new DOMException("Synthetic cloud import write failure", "DataError");
      }
      return Reflect.apply(originalAdd, this, args) as IDBRequest<IDBValidKey>;
    } as typeof originalAdd);

    await expect(store.importCloudPractice({
      runId: "cloud-import-rollback-run",
      teamAlias: "Rollback Cloud Pair",
      document,
      blobs: localBlobs(5),
      levelLocked: true,
      operationId: "cloud-import-rollback-operation",
      savedAt: "2026-07-17T06:16:00.000Z"
    })).rejects.toThrow("Synthetic cloud import write failure");

    expect(await store.resumeLocalPractice()).toBeNull();
    expect(await store.loadRevision(document.documentId, 5)).toBeNull();
    expect(await rawRecord(
      factory,
      databaseName,
      "blobs",
      [document.documentId, 5, "photo-png"]
    )).toBeUndefined();
    expect(await rawRecord(factory, databaseName, "local-practice-checkpoints", "active"))
      .toBeUndefined();
    expect(await rawRecord(
      factory,
      databaseName,
      "local-practice-operations",
      "cloud-import-rollback-operation"
    )).toBeUndefined();
    expect(await rawRecord(factory, databaseName, "local-practice-runs", "cloud-import-rollback-run"))
      .toBeUndefined();
  });

  it.each(["run", "document", "session", "team"] as const)(
    "rejects classroom-campaign as the %s identity",
    async (identityKind) => {
      const factory = new IDBFactory();
      const store = new IndexedDbDraftStore({
        databaseName: `local-practice-reserved-${identityKind}`,
        factory
      });
      const document = CampaignDocumentSchema.parse({
        ...campaignFixture(identityKind === "document"
          ? "classroom-campaign"
          : `local-practice-reserved-document-${identityKind}`),
        sessionId: identityKind === "session"
          ? "classroom-campaign"
          : `local-practice-reserved-session-${identityKind}`,
        teamId: identityKind === "team"
          ? "classroom-campaign"
          : `local-practice-reserved-team-${identityKind}`
      });

      await expect(store.beginLocalPractice({
        runId: identityKind === "run"
          ? "classroom-campaign"
          : `local-practice-reserved-run-${identityKind}`,
        teamAlias: "Reserved Pair",
        document,
        blobs: localBlobs(1),
        levelLocked: false,
        operationId: `reserved-begin-${identityKind}`,
        savedAt: "2026-07-17T01:27:00.000Z"
      })).rejects.toThrow(/must not reuse classroom-campaign/i);
      expect(await store.resumeLocalPractice()).toBeNull();
    }
  );

  it.each(["session", "team"] as const)(
    "rejects reuse of a durable local-practice %s identity",
    async (identityKind) => {
      const factory = new IDBFactory();
      const databaseName = `local-practice-reused-${identityKind}`;
      const store = new IndexedDbDraftStore({ databaseName, factory });
      const first = CampaignDocumentSchema.parse({
        ...campaignFixture(`local-practice-reused-${identityKind}-document-1`),
        sessionId: `local-practice-reused-${identityKind}-session-1`,
        teamId: `local-practice-reused-${identityKind}-team-1`
      });
      await store.beginLocalPractice({
        runId: `local-practice-reused-${identityKind}-run-1`,
        teamAlias: "First Pair",
        document: first,
        blobs: localBlobs(1),
        levelLocked: false,
        operationId: `reused-${identityKind}-begin-1`,
        savedAt: "2026-07-17T01:28:00.000Z"
      });
      const second = CampaignDocumentSchema.parse({
        ...campaignFixture(`local-practice-reused-${identityKind}-document-2`),
        sessionId: identityKind === "session"
          ? first.sessionId
          : `local-practice-reused-${identityKind}-session-2`,
        teamId: identityKind === "team"
          ? first.teamId
          : `local-practice-reused-${identityKind}-team-2`
      });

      await expect(store.beginLocalPractice({
        runId: `local-practice-reused-${identityKind}-run-2`,
        teamAlias: "Second Pair",
        document: second,
        blobs: localBlobs(2),
        levelLocked: false,
        operationId: `reused-${identityKind}-begin-2`,
        savedAt: "2026-07-17T01:29:00.000Z"
      })).rejects.toBeDefined();
      expect((await store.resumeLocalPractice())?.checkpoint.documentId).toBe(first.documentId);
      expect(await store.loadRevision(second.documentId, 0)).toBeNull();
    }
  );

  it("fails recovery when a checkpoint run identity no longer matches its durable run", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-corrupt-run-identity";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-corrupt-run-document"),
      sessionId: "local-practice-corrupt-run-session",
      teamId: "local-practice-corrupt-run-team"
    });
    await store.beginLocalPractice({
      runId: "local-practice-corrupt-run",
      teamAlias: "Truth Pair",
      document,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "corrupt-run-begin",
      savedAt: "2026-07-17T01:30:00.000Z"
    });
    await mutateRawRecord(factory, databaseName, "local-practice-checkpoints", "active", (record) => ({
      ...record,
      checkpoint: {
        ...(record.checkpoint as Record<string, unknown>),
        runId: "local-practice-forged-run"
      }
    }));

    await expect(store.resumeLocalPractice()).rejects.toThrow(/run identity/i);
  });

  it("fails recovery when checkpoint sequence diverges from its durable operation result", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-corrupt-sequence";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-corrupt-sequence-document"),
      sessionId: "local-practice-corrupt-sequence-session",
      teamId: "local-practice-corrupt-sequence-team"
    });
    await store.beginLocalPractice({
      runId: "local-practice-corrupt-sequence-run",
      teamAlias: "Sequence Pair",
      document,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "corrupt-sequence-begin",
      savedAt: "2026-07-17T01:40:00.000Z"
    });
    await mutateRawRecord(factory, databaseName, "local-practice-checkpoints", "active", (record) => ({
      ...record,
      checkpoint: {
        ...(record.checkpoint as Record<string, unknown>),
        sequence: 99
      }
    }));

    await expect(store.resumeLocalPractice()).rejects.toThrow(/operation result/i);
  });

  it("fails recovery when the active checkpoint points to a missing exact revision", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-corrupt-revision";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-corrupt-revision-document"),
      sessionId: "local-practice-corrupt-revision-session",
      teamId: "local-practice-corrupt-revision-team"
    });
    const operationId = "corrupt-revision-begin";
    await store.beginLocalPractice({
      runId: "local-practice-corrupt-revision-run",
      teamAlias: "Revision Pair",
      document,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId,
      savedAt: "2026-07-17T01:45:00.000Z"
    });
    await mutateCheckpointAndOperation(factory, databaseName, operationId, (checkpoint) => ({
      ...checkpoint,
      documentRevision: 1
    }));

    await expect(store.resumeLocalPractice()).rejects.toThrow(/revision is missing/i);
    expect(await store.loadRevision(document.documentId, 0)).not.toBeNull();
  });

  it("fails recovery when the exact revision identity differs from its checkpoint", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-corrupt-document-identity";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-corrupt-identity-document"),
      sessionId: "local-practice-corrupt-identity-session",
      teamId: "local-practice-corrupt-identity-team"
    });
    await store.beginLocalPractice({
      runId: "local-practice-corrupt-identity-run",
      teamAlias: "Identity Pair",
      document,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "corrupt-identity-begin",
      savedAt: "2026-07-17T01:46:00.000Z"
    });
    await mutateRawRecord(
      factory,
      databaseName,
      "documents",
      [document.documentId, 0],
      (record) => ({
        ...record,
        document: {
          ...(record.document as Record<string, unknown>),
          sessionId: "local-practice-forged-session"
        }
      })
    );

    await expect(store.resumeLocalPractice()).rejects.toThrow(/identity does not match/i);
    expect(await store.loadRevision(document.documentId, 0)).not.toBeNull();
  });

  it("fails closed on a checkpoint stage mismatch and retains the corrupt records", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-corrupt-stage";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-corrupt-stage-document"),
      sessionId: "local-practice-corrupt-stage-session",
      teamId: "local-practice-corrupt-stage-team"
    });
    const operationId = "corrupt-stage-begin";
    await store.beginLocalPractice({
      runId: "local-practice-corrupt-stage-run",
      teamAlias: "Stage Pair",
      document,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId,
      savedAt: "2026-07-17T01:50:00.000Z"
    });
    await mutateCheckpointAndOperation(factory, databaseName, operationId, (checkpoint) => ({
      ...checkpoint,
      stage: "sell"
    }));

    await expect(store.resumeLocalPractice()).rejects.toThrow(/stage/i);
    expect(await store.loadRevision(document.documentId, 0)).not.toBeNull();
    await expect(store.resumeLocalPractice()).rejects.toThrow(/stage/i);
  });

  it("fails closed when the checkpoint durable hash does not match the exact revision", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-corrupt-hash";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-corrupt-hash-document"),
      sessionId: "local-practice-corrupt-hash-session",
      teamId: "local-practice-corrupt-hash-team"
    });
    const operationId = "corrupt-hash-begin";
    await store.beginLocalPractice({
      runId: "local-practice-corrupt-hash-run",
      teamAlias: "Hash Pair",
      document,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId,
      savedAt: "2026-07-17T01:51:00.000Z"
    });
    await mutateCheckpointAndOperation(factory, databaseName, operationId, (checkpoint) => ({
      ...checkpoint,
      documentHash: "0".repeat(64)
    }));

    await expect(store.resumeLocalPractice()).rejects.toThrow(/hash/i);
    expect(await store.loadRevision(document.documentId, 0)).not.toBeNull();
  });

  it("fails closed when a stored practice revision is no longer offline", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-corrupt-mode";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-corrupt-mode-document"),
      sessionId: "local-practice-corrupt-mode-session",
      teamId: "local-practice-corrupt-mode-team"
    });
    await store.beginLocalPractice({
      runId: "local-practice-corrupt-mode-run",
      teamAlias: "Offline Pair",
      document,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "corrupt-mode-begin",
      savedAt: "2026-07-17T01:52:00.000Z"
    });
    await mutateRawRecord(
      factory,
      databaseName,
      "documents",
      [document.documentId, 0],
      (record) => ({
        ...record,
        document: {
          ...(record.document as Record<string, unknown>),
          mode: "room",
          roomId: "forged-room"
        }
      })
    );

    await expect(store.resumeLocalPractice()).rejects.toThrow(/offline/i);
    expect(await store.loadRevision(document.documentId, 0)).not.toBeNull();
  });

  it("fails closed when a referenced blob has the wrong MIME type", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-corrupt-mime";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-corrupt-mime-document"),
      sessionId: "local-practice-corrupt-mime-session",
      teamId: "local-practice-corrupt-mime-team"
    });
    await store.beginLocalPractice({
      runId: "local-practice-corrupt-mime-run",
      teamAlias: "MIME Pair",
      document,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "corrupt-mime-begin",
      savedAt: "2026-07-17T01:53:00.000Z"
    });
    await mutateRawRecord(
      factory,
      databaseName,
      "blobs",
      [document.documentId, 0, "photo-png"],
      (record) => ({
        ...record,
        blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "text/plain" })
      })
    );

    await expect(store.resumeLocalPractice()).rejects.toThrow(/MIME type image\/png/i);
    expect(await store.loadRevision(document.documentId, 0)).not.toBeNull();
  });

  it("fails closed without writes when referenced blob bytes change at the same MIME and size", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-corrupt-blob-body";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-corrupt-blob-body-document"),
      sessionId: "local-practice-corrupt-blob-body-session",
      teamId: "local-practice-corrupt-blob-body-team"
    });
    const checkpoint = await store.beginLocalPractice({
      runId: "local-practice-corrupt-blob-body-run",
      teamAlias: "Integrity Pair",
      document,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "corrupt-blob-body-begin",
      savedAt: "2026-07-17T01:54:00.000Z"
    });
    const replacement = new Blob([new Uint8Array([9, 8, 7, 6])], { type: "image/png" });
    await mutateRawRecord(
      factory,
      databaseName,
      "blobs",
      [document.documentId, 0, "photo-png"],
      (record) => ({ ...record, blob: replacement })
    );

    await expect(store.resumeLocalPractice()).rejects.toThrow(/integrity|fingerprint/i);
    await expect(store.resumeLocalPractice()).rejects.toThrow(/integrity|fingerprint/i);

    const persistedCheckpoint = await rawRecord(
      factory,
      databaseName,
      "local-practice-checkpoints",
      "active"
    );
    const persistedBlob = await rawRecord(
      factory,
      databaseName,
      "blobs",
      [document.documentId, 0, "photo-png"]
    );
    expect(persistedCheckpoint?.checkpoint).toEqual(checkpoint);
    expect(await blobBytes(persistedBlob?.blob as Blob)).toEqual([9, 8, 7, 6]);
    expect(await rawDocumentRecords(factory, databaseName)).toHaveLength(1);
  });

  it("fails closed when an exact revision references a missing blob body", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-corrupt-missing-blob";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const document = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-corrupt-missing-document"),
      sessionId: "local-practice-corrupt-missing-session",
      teamId: "local-practice-corrupt-missing-team"
    });
    const operationId = "corrupt-missing-begin";
    await store.beginLocalPractice({
      runId: "local-practice-corrupt-missing-run",
      teamAlias: "Missing Pair",
      document,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId,
      savedAt: "2026-07-17T01:54:00.000Z"
    });
    const missingDocument = structuredClone(document);
    const photoReference = missingDocument.assetReferences.find((reference) =>
      reference.kind === "local-blob" && reference.objectId === "photo"
    ) as Record<string, unknown> | undefined;
    if (!photoReference) throw new Error("Missing photo reference fixture");
    photoReference.blobKey = "missing-photo-png";
    const photo = missingDocument.fabricState.objects.find(({ objectId }) => objectId === "photo");
    if (!photo) throw new Error("Missing photo fixture");
    photo.src = "local-blob:missing-photo-png";
    const corruptDocument = CampaignDocumentSchema.parse(missingDocument);
    const corruptHash = await canonicalDurableDocumentHash(corruptDocument);
    await mutateRawRecord(
      factory,
      databaseName,
      "documents",
      [document.documentId, 0],
      (record) => ({ ...record, document: structuredClone(corruptDocument) })
    );
    await mutateCheckpointAndOperation(factory, databaseName, operationId, (checkpoint) => ({
      ...checkpoint,
      documentHash: corruptHash
    }));

    await expect(store.resumeLocalPractice()).rejects.toThrow(/Missing local blob missing-photo-png/i);
    expect(await store.loadRevision(document.documentId, 0)).not.toBeNull();
  });

  it("atomically commits a new revision and campaign-owned stage and pair transition", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "local-practice-commit-transition",
      factory: new IDBFactory()
    });
    const initial = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-transition-document"),
      sessionId: "local-practice-transition-session",
      teamId: "local-practice-transition-team"
    });
    await store.beginLocalPractice({
      runId: "local-practice-transition-run",
      teamAlias: "Bright Sparks",
      document: initial,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "transition-begin",
      savedAt: "2026-07-17T02:00:00.000Z"
    });
    const next = CampaignDocumentSchema.parse({
      ...initial,
      revision: 1,
      gameplay: {
        stage: "sell",
        pair: {
          activeRole: "strategist",
          handoffCount: 1,
          artDirectorActions: 3,
          strategistActions: 2
        }
      },
      updatedAt: "2026-07-17T02:01:00.000Z"
    });

    const checkpoint = await store.commitLocalPractice({
      expectedDocumentRevision: 0,
      expectedSequence: 0,
      document: next,
      blobs: localBlobs(5),
      levelLocked: true,
      operationId: "transition-commit-1",
      savedAt: "2026-07-17T02:01:00.000Z"
    });

    expect(checkpoint.documentRevision).toBe(1);
    expect(checkpoint.sequence).toBe(1);
    expect(checkpoint.stage).toBe("sell");
    expect(checkpoint.levelLocked).toBe(true);
    const recovery = await store.resumeLocalPractice();
    expect(recovery?.checkpoint).toEqual(checkpoint);
    expect(recovery?.document.gameplay).toEqual(next.gameplay);
    expect(await blobBytes(recovery!.blobs.get("photo-png")!)).toEqual([5, 2, 3, 4]);
    expect((await store.loadRevision(initial.documentId, 0))?.document.gameplay.stage)
      .toBe("invent");
  });

  it("returns an exact commit retry only while its checkpoint remains active", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-exact-retry";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const initial = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-retry-document"),
      sessionId: "local-practice-retry-session",
      teamId: "local-practice-retry-team"
    });
    await store.beginLocalPractice({
      runId: "local-practice-retry-run",
      teamAlias: "Retry Pair",
      document: initial,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "retry-begin",
      savedAt: "2026-07-17T03:00:00.000Z"
    });
    const document = CampaignDocumentSchema.parse({ ...initial, revision: 1 });
    const operation = {
      expectedDocumentRevision: 0,
      expectedSequence: 0,
      document,
      blobs: localBlobs(7),
      levelLocked: false,
      operationId: "retry-commit",
      savedAt: "2026-07-17T03:01:00.000Z"
    } as const;

    const first = await store.commitLocalPractice(operation);
    const immediateRetry = await store.commitLocalPractice({
      ...operation,
      document: CampaignDocumentSchema.parse({
        ...operation.document,
        updatedAt: "2026-07-17T03:01:30.000Z"
      }),
      savedAt: "2026-07-17T03:01:30.000Z"
    });
    const revisionTwo = CampaignDocumentSchema.parse({
      ...document,
      revision: 2,
      product: { ...document.product, name: "Advanced active revision" }
    });
    const activeAfterAdvance = await store.commitLocalPractice({
      expectedDocumentRevision: 1,
      expectedSequence: 1,
      document: revisionTwo,
      blobs: localBlobs(8),
      levelLocked: true,
      operationId: "retry-commit-2",
      savedAt: "2026-07-17T03:02:00.000Z"
    });
    const staleRetry = store.commitLocalPractice({
      ...operation,
      document: CampaignDocumentSchema.parse({
        ...operation.document,
        updatedAt: "2026-07-17T03:09:00.000Z"
      }),
      savedAt: "2026-07-17T03:09:00.000Z"
    });

    expect(immediateRetry).toEqual(first);
    expect(immediateRetry.savedAt).toBe("2026-07-17T03:01:00.000Z");
    await expect(staleRetry).rejects.toThrow(/stale/i);
    expect((await rawDocumentRecords(factory, databaseName)).map(({ revision }) => revision).sort())
      .toEqual([0, 1, 2]);
    expect((await store.resumeLocalPractice())?.checkpoint).toEqual(activeAfterAdvance);
  });

  it("rejects a prior commit retry after a different local-practice run becomes active", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "local-practice-inactive-run-retry",
      factory: new IDBFactory()
    });
    const firstDocument = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-inactive-document-1"),
      sessionId: "local-practice-inactive-session-1",
      teamId: "local-practice-inactive-team-1"
    });
    await store.beginLocalPractice({
      runId: "local-practice-inactive-run-1",
      teamAlias: "Archived Pair",
      document: firstDocument,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "inactive-begin-1",
      savedAt: "2026-07-17T03:10:00.000Z"
    });
    const committedDocument = CampaignDocumentSchema.parse({
      ...firstDocument,
      revision: 1,
      updatedAt: "2026-07-17T03:11:00.000Z"
    });
    const operation = {
      expectedDocumentRevision: 0,
      expectedSequence: 0,
      document: committedDocument,
      blobs: localBlobs(2),
      levelLocked: true,
      operationId: "inactive-commit-1",
      savedAt: "2026-07-17T03:11:00.000Z"
    } as const;
    const firstResult = await store.commitLocalPractice(operation);
    const secondDocument = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-inactive-document-2"),
      sessionId: "local-practice-inactive-session-2",
      teamId: "local-practice-inactive-team-2"
    });
    const activeSecondRun = await store.beginLocalPractice({
      runId: "local-practice-inactive-run-2",
      teamAlias: "Active Pair",
      document: secondDocument,
      blobs: localBlobs(3),
      levelLocked: false,
      operationId: "inactive-begin-2",
      savedAt: "2026-07-17T03:12:00.000Z"
    });

    const staleRetry = store.commitLocalPractice({
      ...operation,
      document: CampaignDocumentSchema.parse({
        ...operation.document,
        updatedAt: "2026-07-17T03:20:00.000Z"
      }),
      savedAt: "2026-07-17T03:20:00.000Z"
    });

    await expect(staleRetry).rejects.toThrow(/stale/i);
    expect(firstResult).not.toEqual(activeSecondRun);
    expect((await store.resumeLocalPractice())?.checkpoint).toEqual(activeSecondRun);
  });

  it("rejects a reused operation ID when referenced blob input has changed", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "local-practice-altered-retry",
      factory: new IDBFactory()
    });
    const initial = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-altered-document"),
      sessionId: "local-practice-altered-session",
      teamId: "local-practice-altered-team"
    });
    await store.beginLocalPractice({
      runId: "local-practice-altered-run",
      teamAlias: "Altered Pair",
      document: initial,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "altered-begin",
      savedAt: "2026-07-17T04:00:00.000Z"
    });
    const document = CampaignDocumentSchema.parse({ ...initial, revision: 1 });
    const operation = {
      expectedDocumentRevision: 0,
      expectedSequence: 0,
      document,
      blobs: localBlobs(7),
      levelLocked: false,
      operationId: "altered-commit",
      savedAt: "2026-07-17T04:01:00.000Z"
    } as const;
    await store.commitLocalPractice(operation);

    await expect(store.commitLocalPractice({ ...operation, blobs: localBlobs(8) }))
      .rejects.toThrow(/operation ID.*different input/i);
    const recovery = await store.resumeLocalPractice();
    expect(await blobBytes(recovery!.blobs.get("photo-png")!)).toEqual([7, 2, 3, 4]);
  });

  it("rejects semantic document, stage or lock changes under a reused operation ID", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "local-practice-semantic-operation-change",
      factory: new IDBFactory()
    });
    const initial = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-semantic-document"),
      sessionId: "local-practice-semantic-session",
      teamId: "local-practice-semantic-team"
    });
    await store.beginLocalPractice({
      runId: "local-practice-semantic-run",
      teamAlias: "Semantic Pair",
      document: initial,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "semantic-begin",
      savedAt: "2026-07-17T04:10:00.000Z"
    });
    const document = CampaignDocumentSchema.parse({ ...initial, revision: 1 });
    const operation = {
      expectedDocumentRevision: 0,
      expectedSequence: 0,
      document,
      blobs: localBlobs(2),
      levelLocked: false,
      operationId: "semantic-commit",
      savedAt: "2026-07-17T04:11:00.000Z"
    } as const;
    const committed = await store.commitLocalPractice(operation);

    await expect(store.commitLocalPractice({
      ...operation,
      document: CampaignDocumentSchema.parse({
        ...document,
        product: { ...document.product, name: "Changed content" }
      })
    })).rejects.toThrow(/operation ID.*different input/i);
    await expect(store.commitLocalPractice({
      ...operation,
      document: CampaignDocumentSchema.parse({
        ...document,
        gameplay: { ...document.gameplay, stage: "sell" }
      })
    })).rejects.toThrow(/operation ID.*different input/i);
    await expect(store.commitLocalPractice({
      ...operation,
      levelLocked: true
    })).rejects.toThrow(/operation ID.*different input/i);
    expect((await store.resumeLocalPractice())?.checkpoint).toEqual(committed);
  });

  it("rejects stale revision or sequence bases without writing a campaign revision", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-stale-cas";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const initial = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-stale-document"),
      sessionId: "local-practice-stale-session",
      teamId: "local-practice-stale-team"
    });
    await store.beginLocalPractice({
      runId: "local-practice-stale-run",
      teamAlias: "CAS Pair",
      document: initial,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "stale-begin",
      savedAt: "2026-07-17T05:00:00.000Z"
    });
    const committedDocument = CampaignDocumentSchema.parse({ ...initial, revision: 1 });
    const committed = await store.commitLocalPractice({
      expectedDocumentRevision: 0,
      expectedSequence: 0,
      document: committedDocument,
      blobs: localBlobs(2),
      levelLocked: false,
      operationId: "stale-first-commit",
      savedAt: "2026-07-17T05:01:00.000Z"
    });

    await expect(store.commitLocalPractice({
      expectedDocumentRevision: 0,
      expectedSequence: 0,
      document: CampaignDocumentSchema.parse({
        ...committedDocument,
        product: { ...committedDocument.product, name: "Stale overwrite" }
      }),
      blobs: localBlobs(9),
      levelLocked: true,
      operationId: "stale-revision-attempt",
      savedAt: "2026-07-17T05:02:00.000Z"
    })).rejects.toThrow(/base is stale/i);
    await expect(store.commitLocalPractice({
      expectedDocumentRevision: 1,
      expectedSequence: 0,
      document: CampaignDocumentSchema.parse({ ...committedDocument, revision: 2 }),
      blobs: localBlobs(9),
      levelLocked: true,
      operationId: "stale-sequence-attempt",
      savedAt: "2026-07-17T05:03:00.000Z"
    })).rejects.toThrow(/base is stale/i);

    expect((await store.resumeLocalPractice())?.checkpoint).toEqual(committed);
    expect(await store.loadRevision(initial.documentId, 2)).toBeNull();
    expect((await rawDocumentRecords(factory, databaseName)).map(({ revision }) => revision).sort())
      .toEqual([0, 1]);
  });

  it("rolls back document, blobs, operation and checkpoint when an atomic commit write fails", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-atomic-rollback";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const initial = CampaignDocumentSchema.parse({
      ...campaignFixture("local-practice-rollback-document"),
      sessionId: "local-practice-rollback-session",
      teamId: "local-practice-rollback-team"
    });
    const initialCheckpoint = await store.beginLocalPractice({
      runId: "local-practice-rollback-run",
      teamAlias: "Rollback Pair",
      document: initial,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "rollback-begin",
      savedAt: "2026-07-17T06:00:00.000Z"
    });
    const originalAdd = FakeIDBObjectStore.prototype.add;
    vi.spyOn(FakeIDBObjectStore.prototype, "add").mockImplementation(function (
      this: IDBObjectStore,
      ...args: unknown[]
    ): IDBRequest<IDBValidKey> {
      const value = args[0] as Record<string, unknown> | undefined;
      if (this.name === "local-practice-operations" &&
        value?.operationId === "rollback-failing-commit") {
        throw new DOMException("Synthetic operation write failure", "DataError");
      }
      return Reflect.apply(originalAdd, this, args) as IDBRequest<IDBValidKey>;
    } as typeof originalAdd);

    await expect(store.commitLocalPractice({
      expectedDocumentRevision: 0,
      expectedSequence: 0,
      document: CampaignDocumentSchema.parse({ ...initial, revision: 1 }),
      blobs: localBlobs(9),
      levelLocked: true,
      operationId: "rollback-failing-commit",
      savedAt: "2026-07-17T06:01:00.000Z"
    })).rejects.toThrow("Synthetic operation write failure");

    const recovery = await store.resumeLocalPractice();
    expect(recovery?.checkpoint).toEqual(initialCheckpoint);
    expect(await blobBytes(recovery!.blobs.get("photo-png")!)).toEqual([1, 2, 3, 4]);
    expect(await store.loadRevision(initial.documentId, 1)).toBeNull();
  });

  it("round-trips the canonical editable campaign and caller-owned immutable revisions", async () => {
    const factory = new IDBFactory();
    const databaseName = "task-7-round-trip";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const document = campaignFixture();
    const sourceSnapshot = structuredClone(document);
    const blobs = localBlobs();

    await store.save(document, blobs);

    expect(document).toEqual(sourceSnapshot);
    expect(document.revision).toBe(0);
    const loaded = await store.load(document.documentId);
    expect(loaded).not.toBeNull();
    expect(await canonicalDurableDocumentHash(loaded!.document))
      .toBe(await canonicalDurableDocumentHash(sourceSnapshot));
    expect(loaded!.document.revision).toBe(0);
    expect(loaded!.document.fabricState.objects).toHaveLength(4);
    expect(loaded!.blobs).not.toBe(blobs);
    for (const [blobId, sourceBlob] of blobs) {
      const loadedBlob = loaded!.blobs.get(blobId);
      expect(loadedBlob).toBeInstanceOf(Blob);
      expect(loadedBlob).not.toBe(sourceBlob);
      expect(loadedBlob?.type).toBe(sourceBlob.type);
      expect(await blobBytes(loadedBlob!)).toEqual(await blobBytes(sourceBlob));
    }

    loaded!.document.product.name = "Mutated return value";
    loaded!.blobs.clear();
    const loadedAgain = await store.load(document.documentId);
    expect(await canonicalDurableDocumentHash(loadedAgain!.document))
      .toBe(await canonicalDurableDocumentHash(sourceSnapshot));
    expect(loadedAgain!.blobs.size).toBe(2);

    const revisionOne = CampaignDocumentSchema.parse({ ...document, revision: 1 });
    const revisionOneSnapshot = structuredClone(revisionOne);
    await store.save(revisionOne, localBlobs(5));
    expect(revisionOne).toEqual(revisionOneSnapshot);
    const latest = await store.load(document.documentId);
    expect(latest?.document.revision).toBe(1);
    expect(await blobBytes(latest!.blobs.get("photo-png")!)).toEqual([5, 2, 3, 4]);
    const revisions = await rawDocumentRecords(factory, databaseName);
    expect(revisions.map(({ revision }) => revision).sort()).toEqual([0, 1]);
    expect(revisions.find(({ revision }) => revision === 0)?.document)
      .toEqual(sourceSnapshot);
  });

  it("persists only blobs referenced by the current document revision", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "current-references-only",
      factory: new IDBFactory()
    });
    const document = campaignFixture("current-references-only");
    const staleBlob = new Blob([new Uint8Array([99, 98, 97])], { type: "image/png" });
    const blobs = new Map([...localBlobs(), ["undone-placement", staleBlob]]);

    await store.save(document, blobs);
    const loaded = await store.load(document.documentId);

    expect(loaded).not.toBeNull();
    expect([...loaded!.blobs.keys()].sort()).toEqual(["photo-png", "variant-png"]);
    expect(blobs.get("undone-placement")).toBe(staleBlob);
  });

  it("rehydrates only declared local blobs with fresh owned URLs and an idempotent release", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "task-7-rehydrate",
      factory: new IDBFactory()
    });
    const source = campaignFixture("rehydrate");
    await store.save(source, localBlobs());
    const loaded = (await store.load(source.documentId))!;
    const loadedSnapshot = structuredClone(loaded.document);
    const created: Array<{ url: string; blob: Blob }> = [];
    const revoked: string[] = [];
    const urls: ObjectUrlPort = {
      createObjectURL(blob) {
        const url = `blob:${window.location.origin}/owned-${created.length + 1}`;
        created.push({ url, blob });
        return url;
      },
      revokeObjectURL(url) { revoked.push(url); }
    };

    const hydrated = rehydrateLocalAssetBlobs(loaded.document, loaded.blobs, urls);

    expect(loaded.document).toEqual(loadedSnapshot);
    expect(hydrated.document.fabricState.objects.find(({ objectId }) => objectId === "photo")?.src)
      .toBe(created[0]?.url);
    expect(hydrated.document.fabricState.objects.find(({ objectId }) => objectId === "masked-product")?.src)
      .toBe(created[1]?.url);
    expect(hydrated.ownedUrls).toEqual(new Set(created.map(({ url }) => url)));
    expect(created.map(({ blob }) => blob.type)).toEqual(["image/png", "image/png"]);
    expect(await canonicalDurableDocumentHash(hydrated.document))
      .toBe(await canonicalDurableDocumentHash(loaded.document));
    hydrated.release();
    hydrated.release();
    expect(revoked).toEqual(created.map(({ url }) => url));
  });

  it("normalises fresh object URLs before saving an edited rehydrated revision", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "task-7-rehydrated-resave",
      factory: new IDBFactory()
    });
    const source = campaignFixture("rehydrated-resave");
    await store.save(source, localBlobs());
    const loaded = (await store.load(source.documentId))!;
    let nextUrl = 0;
    const hydrated = rehydrateLocalAssetBlobs(loaded.document, loaded.blobs, {
      createObjectURL: () => `blob:${window.location.origin}/resave-${++nextUrl}`,
      revokeObjectURL: () => undefined
    });
    const headline = hydrated.document.fabricState.objects
      .find(({ objectId }) => objectId === "headline")!;
    headline.left = 512;
    const revisionOne = CampaignDocumentSchema.parse({ ...hydrated.document, revision: 1 });

    await store.save(revisionOne, loaded.blobs);
    const reloaded = (await store.load(source.documentId))!;

    expect(reloaded.document.fabricState.objects.find(({ objectId }) => objectId === "photo")?.src)
      .toBe("local-blob:photo-png");
    expect(reloaded.document.fabricState.objects.find(({ objectId }) => objectId === "masked-product")?.src)
      .toBe("local-blob:variant-png");
    expect(reloaded.document.fabricState.objects.find(({ objectId }) => objectId === "headline")?.left)
      .toBe(512);
    hydrated.release();
  });

  it("persists and rehydrates a nested local-blob image across a complete draft lifecycle", async () => {
    const factory = new IDBFactory();
    const databaseName = "recursive-draft-nested-local-blob";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    const source = nestedLocalBlobCampaignFixture();
    const sourceSnapshot = structuredClone(source);
    const blobKey = "nested-artwork-png";
    const blobs = new Map([
      [blobKey, new Blob([new Uint8Array([4, 3, 2, 1])], { type: "image/png" })]
    ]);

    await store.save(source, blobs);

    expect(source).toEqual(sourceSnapshot);
    const storedRecords = await rawDocumentRecords(factory, databaseName);
    expect(storedRecords).toHaveLength(1);
    expect(nestedArtworkObject(storedRecords[0]!.document).src)
      .toBe(`local-blob:${blobKey}`);

    const loaded = await store.load(source.documentId);
    expect(loaded).not.toBeNull();
    expect(nestedArtworkObject(loaded!.document).src).toBe(`local-blob:${blobKey}`);
    const loadedSnapshot = structuredClone(loaded!.document);
    const durableHash = await canonicalDurableDocumentHash(loaded!.document);
    const ownedUrl = `blob:${window.location.origin}/owned-nested-artwork`;
    const created: Array<{ blob: Blob; url: string }> = [];
    const revoked: string[] = [];
    const urls: ObjectUrlPort = {
      createObjectURL(blob) {
        created.push({ blob, url: ownedUrl });
        return ownedUrl;
      },
      revokeObjectURL(url) { revoked.push(url); }
    };

    const hydrated = rehydrateLocalAssetBlobs(loaded!.document, loaded!.blobs, urls);

    expect(loaded!.document).toEqual(loadedSnapshot);
    expect(nestedArtworkObject(hydrated.document).src).toBe(ownedUrl);
    expect(ownedUrl).not.toBe(nestedArtworkObject(sourceSnapshot).src);
    expect(created).toEqual([{ blob: loaded!.blobs.get(blobKey), url: ownedUrl }]);
    expect(hydrated.ownedUrls).toEqual(new Set([ownedUrl]));
    expect(await canonicalDurableDocumentHash(hydrated.document)).toBe(durableHash);

    const revisionOne = CampaignDocumentSchema.parse({
      ...hydrated.document,
      revision: 1
    });
    const revisionOneSnapshot = structuredClone(revisionOne);
    await store.save(revisionOne, loaded!.blobs);
    expect(revisionOne).toEqual(revisionOneSnapshot);
    const reloaded = await store.load(source.documentId);
    expect(nestedArtworkObject(reloaded!.document).src).toBe(`local-blob:${blobKey}`);

    hydrated.release();
    hydrated.release();
    expect(revoked).toEqual([ownedUrl]);
  });

  it("scopes identical blob IDs by document and revision", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "task-7-blob-scope",
      factory: new IDBFactory()
    });
    const first = campaignFixture("team-one");
    const second = campaignFixture("team-two");

    await store.save(first, localBlobs(1));
    await store.save(second, localBlobs(2));
    await store.save(CampaignDocumentSchema.parse({ ...first, revision: 1 }),
      localBlobs(3));

    expect(await blobBytes((await store.load("team-one"))!.blobs.get("photo-png")!))
      .toEqual([3, 2, 3, 4]);
    expect(await blobBytes((await store.load("team-two"))!.blobs.get("photo-png")!))
      .toEqual([2, 2, 3, 4]);
  });

  it("rejects duplicate or stale revisions without changing committed documents or blobs", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "task-7-stale-revision",
      factory: new IDBFactory()
    });
    const first = campaignFixture("strict-revision");
    await store.save(first, localBlobs(1));
    const duplicate = CampaignDocumentSchema.parse({
      ...first,
      product: { ...first.product, name: "Must not commit" }
    });

    await expect(store.save(duplicate, localBlobs(9))).rejects.toThrow(/newer than revision 0/);

    const loaded = (await store.load(first.documentId))!;
    expect(loaded.document.product.name).toBe("Solar Sprint");
    expect(loaded.document.revision).toBe(0);
    expect(await blobBytes(loaded.blobs.get("photo-png")!)).toEqual([1, 2, 3, 4]);
  });

  it("does not resolve save until its readwrite transaction completes", async () => {
    const originalTransaction = FakeIDBDatabase.prototype.transaction;
    let writeComplete = false;
    vi.spyOn(FakeIDBDatabase.prototype, "transaction").mockImplementation(function (
      this: IDBDatabase,
      ...args: unknown[]
    ): IDBTransaction {
      const transaction = Reflect.apply(originalTransaction, this, args) as IDBTransaction;
      if (transaction.mode === "readwrite") {
        transaction.addEventListener("complete", () => { writeComplete = true; }, { once: true });
      }
      return transaction;
    } as typeof originalTransaction);
    const store = new IndexedDbDraftStore({
      databaseName: "task-7-complete",
      factory: new IDBFactory()
    });

    await store.save(campaignFixture(), localBlobs());

    expect(writeComplete).toBe(true);
  });

  it("aborts the whole revision when any blob write fails", async () => {
    const originalPut = FakeIDBObjectStore.prototype.put;
    let injectedFailure = false;
    vi.spyOn(FakeIDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: unknown[]
    ): IDBRequest<IDBValidKey> {
      if (this.name === "blobs" && !injectedFailure) {
        injectedFailure = true;
        throw new DOMException("Synthetic blob write failure", "DataError");
      }
      return Reflect.apply(originalPut, this, args) as IDBRequest<IDBValidKey>;
    } as typeof originalPut);
    const store = new IndexedDbDraftStore({
      databaseName: "task-7-abort",
      factory: new IDBFactory()
    });

    await expect(store.save(campaignFixture(), localBlobs()))
      .rejects.toThrow("Synthetic blob write failure");
    expect(await store.load("campaign-a")).toBeNull();
  });

  it("rejects a blocked database open promptly and closes a late success result", async () => {
    let lateDatabase: IDBDatabase | undefined;
    const request = requestDouble<IDBDatabase>({
      result: () => lateDatabase!
    }) as IDBOpenDBRequest;
    const factory = {
      open: () => request
    } as unknown as IDBFactory;
    const store = new IndexedDbDraftStore({ databaseName: "task-7-blocked-open", factory });
    const pendingLoad = store.load("blocked-document");

    request.dispatchEvent(new Event("blocked"));

    const rejection = await rejectionWithin(pendingLoad);
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toMatch(/blocked/i);

    const close = vi.fn();
    lateDatabase = { close } as unknown as IDBDatabase;
    request.dispatchEvent(new Event("success"));
    expect(close).toHaveBeenCalledOnce();
  });

  it("consumes both a cursor request error and its transaction abort rejection", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "task-7-read-error-abort",
      factory: new IDBFactory()
    });
    const source = campaignFixture("read-error-abort");
    await store.save(source, localBlobs());
    const originalOpenCursor = FakeIDBIndex.prototype.openCursor;
    const failure = new DOMException("Synthetic cursor request failure", "UnknownError");
    vi.spyOn(FakeIDBIndex.prototype, "openCursor").mockImplementation(function (
      this: IDBIndex,
      ...args: unknown[]
    ): IDBRequest<IDBCursorWithValue | null> {
      Reflect.apply(originalOpenCursor, this, args);
      const transaction = this.objectStore.transaction;
      const request = requestDouble<IDBCursorWithValue | null>({ error: () => failure });
      queueMicrotask(() => {
        request.dispatchEvent(new Event("error"));
        transaction.abort();
      });
      return request;
    } as typeof originalOpenCursor);
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => { unhandled.push(reason); };
    process.on("unhandledRejection", onUnhandled);

    try {
      const rejection = await rejectionWithin(store.load(source.documentId));
      expect(rejection).toBe(failure);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("rejects instead of hanging when cursor success processing throws synchronously", async () => {
    const store = new IndexedDbDraftStore({
      databaseName: "task-7-cursor-processing-throw",
      factory: new IDBFactory()
    });
    const source = campaignFixture("cursor-processing-throw");
    await store.save(source, localBlobs());
    const originalOpenCursor = FakeIDBIndex.prototype.openCursor;
    vi.spyOn(FakeIDBIndex.prototype, "openCursor").mockImplementation(function (
      this: IDBIndex,
      ...args: unknown[]
    ): IDBRequest<IDBCursorWithValue | null> {
      Reflect.apply(originalOpenCursor, this, args);
      const request = requestDouble<IDBCursorWithValue | null>({
        result: () => { throw new Error("Synthetic cursor processing failure"); }
      });
      queueMicrotask(() => request.dispatchEvent(new Event("success")));
      return request;
    } as typeof originalOpenCursor);

    const rejection = await rejectionWithin(store.load(source.documentId));
    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toBe("Synthetic cursor processing failure");
  });

  it("uses deterministic UTF-16 code-unit ordering for non-ASCII canonical hashes", async () => {
    const document = campaignFixture("non-ascii-hash-order");
    const headline = document.fabricState.objects.find(({ objectId }) => objectId === "headline")!;
    headline.z = "code-unit-first";
    headline["ä"] = "code-unit-last";

    expect(await canonicalDurableDocumentHash(document))
      .toBe(await codeUnitCanonicalHash(document));
  });

  it("retains only five complete revisions and their matching blobs and operation results", async () => {
    const factory = new IDBFactory();
    const databaseName = "local-practice-bounded-retention";
    const store = new IndexedDbDraftStore({ databaseName, factory });
    let document = CampaignDocumentSchema.parse({
      ...campaignFixture("bounded-retention-document"),
      sessionId: "bounded-retention-session",
      teamId: "bounded-retention-team"
    });
    await store.beginLocalPractice({
      runId: "bounded-retention-run",
      teamAlias: "Retention pair",
      document,
      blobs: localBlobs(0),
      levelLocked: false,
      operationId: "bounded-retention-0",
      savedAt: "2026-07-23T00:00:00.000Z"
    });
    for (let revision = 1; revision <= 8; revision += 1) {
      document = CampaignDocumentSchema.parse({
        ...document,
        revision,
        updatedAt: `2026-07-23T00:00:0${revision}.000Z`
      });
      await store.commitLocalPractice({
        expectedDocumentRevision: revision - 1,
        expectedSequence: revision - 1,
        document,
        blobs: localBlobs(revision),
        levelLocked: false,
        operationId: `bounded-retention-${revision}`,
        savedAt: `2026-07-23T00:00:0${revision}.000Z`
      });
    }

    const documents = await rawDocumentRecords(factory, databaseName);
    expect(documents.map(({ revision }) => revision).sort((a, b) => a - b))
      .toEqual([4, 5, 6, 7, 8]);
    expect(await rawStoreRecords(factory, databaseName, "blobs")).toHaveLength(10);
    expect(await rawStoreRecords(factory, databaseName, "local-practice-operations"))
      .toHaveLength(5);
    await expect(store.loadRevision(document.documentId, 3)).resolves.toBeNull();
    await expect(store.loadRevision(document.documentId, 4)).resolves.not.toBeNull();
    await expect(store.resumeLocalPractice()).resolves.toMatchObject({
      checkpoint: { documentRevision: 8 },
      document: { revision: 8 }
    });
  });

  it("prunes and retries a generic save once after an injected quota failure", async () => {
    const factory = new IDBFactory();
    const databaseName = "draft-save-quota-retry";
    const attempts: number[] = [];
    const store = new IndexedDbDraftStore({
      databaseName,
      factory,
      writeAttemptHook(kind, attempt) {
        if (kind !== "save") return;
        attempts.push(attempt);
        if (attempt === 0) throw new DOMException("quota", "QuotaExceededError");
      }
    });
    const first = campaignFixture("quota-save-document");
    await new IndexedDbDraftStore({ databaseName, factory }).save(first, localBlobs(1));
    const second = CampaignDocumentSchema.parse({ ...first, revision: 1 });

    await store.save(second, localBlobs(2));

    expect(attempts).toEqual([0, 1]);
    await expect(store.loadRevision(first.documentId, 0)).resolves.not.toBeNull();
    await expect(store.loadRevision(first.documentId, 1)).resolves.not.toBeNull();
  });

  it("preserves the prior active checkpoint and retries a practice commit once after quota", async () => {
    const factory = new IDBFactory();
    const databaseName = "practice-commit-quota-retry";
    const attempts: number[] = [];
    const store = new IndexedDbDraftStore({
      databaseName,
      factory,
      writeAttemptHook(kind, attempt) {
        if (kind !== "commit") return;
        attempts.push(attempt);
        if (attempt === 0) throw new DOMException("quota", "QuotaExceededError");
      }
    });
    const initial = CampaignDocumentSchema.parse({
      ...campaignFixture("quota-practice-document"),
      sessionId: "quota-practice-session",
      teamId: "quota-practice-team"
    });
    await store.beginLocalPractice({
      runId: "quota-practice-run",
      teamAlias: "Quota pair",
      document: initial,
      blobs: localBlobs(1),
      levelLocked: false,
      operationId: "quota-practice-begin",
      savedAt: "2026-07-23T00:00:00.000Z"
    });
    const next = CampaignDocumentSchema.parse({ ...initial, revision: 1 });

    await store.commitLocalPractice({
      expectedDocumentRevision: 0,
      expectedSequence: 0,
      document: next,
      blobs: localBlobs(2),
      levelLocked: false,
      operationId: "quota-practice-commit",
      savedAt: "2026-07-23T00:00:01.000Z"
    });

    expect(attempts).toEqual([0, 1]);
    await expect(store.loadRevision(initial.documentId, 0)).resolves.not.toBeNull();
    await expect(store.resumeLocalPractice()).resolves.toMatchObject({
      checkpoint: { documentRevision: 1 },
      document: { revision: 1 }
    });
  });
});

describe("campaign draft migrations", () => {
  it("migrates the explicit schema-zero defaults without mutating its source", () => {
    const current = campaignFixture("legacy");
    const {
      drawingLayers: _drawingLayers,
      evidence,
      brief,
      ...withoutReservedFields
    } = current;
    const { price: _price, ...legacyEvidence } = evidence;
    const legacy = {
      ...withoutReservedFields,
      schemaVersion: 0,
      brief: {
        targetAudienceId: brief.targetAudienceId,
        contextId: brief.contextId,
        purpose: brief.purpose
      },
      evidence: legacyEvidence
    };
    const sourceSnapshot = structuredClone(legacy);

    const migrated = migrateCampaignDocument(legacy);

    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.drawingLayers).toEqual([]);
    expect(migrated.brief).toEqual({
      targetAudienceId: brief.targetAudienceId,
      contextId: brief.contextId,
      purpose: "persuade",
      audienceNeeds: [],
      audienceValues: [],
      intendedEffects: [],
      techniques: []
    });
    expect(migrated.evidence).toEqual({ ...legacyEvidence, price: [] });
    expect(legacy).toEqual(sourceSnapshot);
    migrated.evidence.attention.push("later-change");
    expect(legacy).toEqual(sourceSnapshot);
  });

  it.each([2, 99, -1, "1", undefined])("rejects unknown or future schema version %s", (schemaVersion) => {
    expect(() => migrateCampaignDocument({
      ...campaignFixture("unsupported"),
      schemaVersion
    })).toThrow(/Unsupported campaign schema version/);
  });
});
