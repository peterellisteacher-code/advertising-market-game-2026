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

    await store.save(first, new Map([...localBlobs(),
      ["shared", new Blob([new Uint8Array([1])], { type: "image/png" })]]));
    await store.save(second, new Map([...localBlobs(),
      ["shared", new Blob([new Uint8Array([2])], { type: "image/png" })]]));
    await store.save(CampaignDocumentSchema.parse({ ...first, revision: 1 }),
      new Map([...localBlobs(),
        ["shared", new Blob([new Uint8Array([3])], { type: "image/png" })]]));

    expect(await blobBytes((await store.load("team-one"))!.blobs.get("shared")!)).toEqual([3]);
    expect(await blobBytes((await store.load("team-two"))!.blobs.get("shared")!)).toEqual([2]);
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
