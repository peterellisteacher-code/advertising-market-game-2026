import { findByLabelText, findByRole, getByRole } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatorPublicApi } from "./bridge/creator-public-api";
import {
  CREATOR_BRIDGE_CONTRACT,
  CreatorResponseSchema,
  type CreatorMethod,
  type CreatorResponse
} from "./bridge/contracts";
import {
  CampaignDocumentSchema,
  createBlankCampaignDocument,
  type CampaignDocumentV1
} from "./domain/campaign-document";

const runtime = vi.hoisted(() => ({
  adapterConstructed: vi.fn(),
  adapterDisposed: vi.fn(),
  canvasConstructed: vi.fn(),
  canvasDisposed: vi.fn(),
  exporterConstructed: vi.fn(),
  publish: vi.fn(),
  load: vi.fn(),
  loadDraft: vi.fn(),
  save: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
  state: { version: "7.4.0", objects: [] } as Record<string, unknown>,
  drafts: new Map<string, { document: CampaignDocumentV1; blobs: Map<string, Blob> }>(),
  loadFailure: null as Error | null,
  saveFailure: null as Error | null,
  publishFailure: null as Error | null,
  createdUrls: [] as Array<{ url: string; blob: Blob }>,
  revokedUrls: [] as string[],
  nextUrl: 0,
  canvasFailure: null as Error | null,
  adapterDisposeFailure: null as Error | null,
  canvasDisposeFailure: null as Error | null,
  canvasDisposePromise: null as Promise<void> | null
}));

vi.mock("fabric", () => ({
  Canvas: class {
    constructor(element: HTMLCanvasElement) {
      runtime.canvasConstructed(element);
      if (runtime.canvasFailure) throw runtime.canvasFailure;
    }

    dispose(): Promise<void> {
      runtime.canvasDisposed();
      if (runtime.canvasDisposeFailure) return Promise.reject(runtime.canvasDisposeFailure);
      return runtime.canvasDisposePromise ?? Promise.resolve();
    }
  }
}));

vi.mock("./fabric/fabric-canvas-adapter", () => ({
  FabricCanvasAdapter: class {
    constructor(canvas: unknown) {
      runtime.adapterConstructed(canvas);
    }

    async load(value: Record<string, unknown>): Promise<void> {
      runtime.load(value);
      if (runtime.loadFailure) throw runtime.loadFailure;
      runtime.state = structuredClone(value);
    }

    serialize(): Record<string, unknown> {
      return structuredClone(runtime.state);
    }

    async addRaster(input: {
      id: string;
      assetId: string;
      sameOriginUrl: string;
      accessibleName: string;
    }): Promise<void> {
      const objects = runtime.state.objects;
      if (!Array.isArray(objects)) throw new Error("Test canvas state has no objects");
      objects.push({
        type: "image",
        objectId: input.id,
        elementKind: "image",
        assetId: input.assetId,
        accessibleName: input.accessibleName,
        src: new URL(input.sameOriginUrl, window.location.href).href
      });
    }

    async addProductShell(input: {
      id: string;
      shellId: string;
      svg: string;
      accessibleName: string;
    }): Promise<void> {
      const objects = runtime.state.objects;
      if (!Array.isArray(objects)) throw new Error("Test canvas state has no objects");
      objects.push({
        type: "group",
        objectId: input.id,
        elementKind: "product-shell",
        shellId: input.shellId,
        accessibleName: input.accessibleName,
        regionColours: {
          body: "#EFE8D8",
          accent: "#E66B3F",
          label: "#FFF7E8"
        }
      });
    }

    setProductShellRegion(id: string, region: string, colour: string): void {
      const object = (runtime.state.objects as Array<Record<string, unknown>>)
        .find((candidate) => candidate.objectId === id);
      if (!object) throw new Error(`Missing object ${id}`);
      (object.regionColours as Record<string, string>)[region] = colour;
    }

    getProductShellRegionColours(id: string): Readonly<Record<string, string>> {
      const object = (runtime.state.objects as Array<Record<string, unknown>>)
        .find((candidate) => candidate.objectId === id);
      if (!object) throw new Error(`Missing object ${id}`);
      return structuredClone(object.regionColours as Record<string, string>);
    }

    remove(id: string): void {
      const objects = runtime.state.objects;
      if (!Array.isArray(objects)) throw new Error("Test canvas state has no objects");
      const index = objects.findIndex((object) =>
        typeof object === "object" && object !== null &&
        (object as Record<string, unknown>).objectId === id);
      if (index >= 0) objects.splice(index, 1);
    }

    setSelected(): void {}

    exportCleanPngDataUrl(): string {
      return "data:image/png;base64,AA==";
    }

    dispose(): void {
      runtime.adapterDisposed();
      if (runtime.adapterDisposeFailure) throw runtime.adapterDisposeFailure;
    }
  }
}));

vi.mock("./persistence/draft-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./persistence/draft-store")>();
  return {
    ...actual,
    IndexedDbDraftStore: class {
      async load(documentId: string): Promise<{
        document: CampaignDocumentV1;
        blobs: Map<string, Blob>;
      } | null> {
        runtime.loadDraft(documentId);
        const stored = runtime.drafts.get(documentId);
        if (!stored) return null;
        return {
          document: structuredClone(stored.document),
          blobs: new Map([...stored.blobs].map(([key, blob]) => [
            key,
            blob.slice(0, blob.size, blob.type)
          ]))
        };
      }

      async save(document: CampaignDocumentV1, blobs: ReadonlyMap<string, Blob>): Promise<void> {
        runtime.save(document, blobs);
        if (runtime.saveFailure) throw runtime.saveFailure;
        const latest = runtime.drafts.get(document.documentId);
        if (latest && document.revision <= latest.document.revision) {
          throw new Error(`Campaign revision ${document.revision} must be newer than revision ${latest.document.revision}`);
        }
        const durableDocument = structuredClone(document);
        for (const reference of durableDocument.assetReferences) {
          if (reference.kind !== "local-blob" || typeof reference.objectId !== "string" ||
            typeof reference.blobKey !== "string") continue;
          const object = durableDocument.fabricState.objects.find(({ objectId }) =>
            objectId === reference.objectId);
          if (object) object.src = `local-blob:${reference.blobKey}`;
        }
        runtime.drafts.set(document.documentId, {
          document: durableDocument,
          blobs: new Map([...blobs].map(([key, blob]) => [
            key,
            blob.slice(0, blob.size, blob.type)
          ]))
        });
      }
    }
  };
});

vi.mock("./export/campaign-exporter", () => ({
  CampaignExporter: class {
    readonly #ownedUrls: ReadonlySet<string>;

    constructor(port: unknown, ownedUrls: ReadonlySet<string>) {
      this.#ownedUrls = ownedUrls;
      runtime.exporterConstructed(port, ownedUrls);
    }

    publish(document: ReturnType<typeof createBlankCampaignDocument>) {
      runtime.publish(document);
      if (runtime.publishFailure) throw runtime.publishFailure;
      for (const object of document.fabricState.objects) {
        if (typeof object.src === "string" && object.src.startsWith("blob:") &&
          !this.#ownedUrls.has(object.src)) {
          throw new Error(`Raster source must be an owned local blob: ${object.src}`);
        }
      }
      return {
        contract: "published-campaign@1" as const,
        documentId: document.documentId,
        revision: document.revision,
        pngBytes: Uint8Array.from([0, 1, 2]),
        metadata: {
          productName: document.product.name,
          priceCents: 0,
          brief: structuredClone(document.brief),
          evidence: structuredClone(document.evidence),
          assetReferences: structuredClone(document.assetReferences)
        }
      };
    }
  }
}));

const blankDocument = createBlankCampaignDocument({
  documentId: "main-document",
  sessionId: "main-session",
  mode: "offline"
});

function localBlobDocument(revision = 3): CampaignDocumentV1 {
  return CampaignDocumentSchema.parse({
    ...createBlankCampaignDocument({
      documentId: "local-blob-document",
      sessionId: "local-blob-session",
      mode: "offline"
    }),
    revision,
    updatedAt: `2026-07-12T00:00:0${revision}.000Z`,
    fabricState: {
      version: "7.4.0",
      objects: [{
        type: "image",
        objectId: "local-photo",
        elementKind: "image",
        accessibleName: "Local campaign photo",
        src: "local-blob:photo-png"
      }]
    },
    assetReferences: [{
      kind: "local-blob",
      objectId: "local-photo",
      blobKey: "photo-png",
      mimeType: "image/png"
    }]
  });
}

function storeDraft(document: CampaignDocumentV1, bytes = [1, 2, 3]): Blob {
  const blob = new Blob([Uint8Array.from(bytes)], { type: "image/png" });
  runtime.drafts.set(document.documentId, {
    document: structuredClone(document),
    blobs: new Map([["photo-png", blob]])
  });
  return blob;
}

async function bytesOf(blob: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

function currentObjects(): Array<Record<string, unknown>> {
  const objects = runtime.state.objects;
  if (!Array.isArray(objects)) throw new Error("Test canvas state has no objects");
  return objects as Array<Record<string, unknown>>;
}

function productShellCatalogueFixture(): Record<string, unknown> {
  const families = [
    ["beauty-care", "Beauty & Care"], ["drinks-snacks", "Drinks & Snacks"],
    ["fashion-footwear", "Fashion & Footwear"], ["fast-food-hospitality", "Fast Food & Hospitality"],
    ["home-lifestyle", "Home & Lifestyle"], ["pets-animals", "Pets & Animals"],
    ["shops-services", "Shops & Services"], ["sport-outdoors", "Sport & Outdoors"],
    ["tech-gadgets", "Tech & Gadgets"], ["travel-transport", "Travel & Transport"]
  ];
  return {
    schema: "product-shell-catalog@1",
    version: 1,
    packId: "product-shells-v1",
    families: families.map(([id, title]) => ({ id, title })),
    shells: families.flatMap(([family]) => Array.from({ length: 6 }, (_, index) => {
      const id = family === "drinks-snacks" && index === 0
        ? "drinks-classic-can"
        : `${family}-shell-${index + 1}`;
      return {
        id,
        title: id === "drinks-classic-can" ? "Classic Soft Drink Can" : `${family} shell ${index + 1}`,
        family,
        template: "panel",
        authoringSvg: `shells/${id}/authoring.svg`,
        previewSvg: `shells/${id}/preview.svg`,
        regions: ["body", "accent", "label"],
        printAreas: [{ id: "front", x: 0.2, y: 0.2, width: 0.6, height: 0.6, safeInset: 0.03 }],
        partSlots: [],
        preview: { kind: "soft-2.5d", highlight: 0.16, shadow: 0.18 },
        classroomReviewed: true,
        brandFree: true
      };
    }))
  };
}

function request(requestId: string, method: CreatorMethod, payload: unknown): string {
  return JSON.stringify({ contract: CREATOR_BRIDGE_CONTRACT, requestId, method, payload });
}

async function parsed(
  api: CreatorPublicApi,
  requestId: string,
  method: CreatorMethod,
  payload: unknown
): Promise<CreatorResponse> {
  return CreatorResponseSchema.parse(JSON.parse(await api.handle(request(requestId, method, payload))));
}

describe("window.AdMarketCreator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    runtime.state = { version: "7.4.0", objects: [] };
    runtime.drafts.clear();
    runtime.loadFailure = null;
    runtime.saveFailure = null;
    runtime.publishFailure = null;
    runtime.canvasFailure = null;
    runtime.adapterDisposeFailure = null;
    runtime.canvasDisposeFailure = null;
    runtime.canvasDisposePromise = null;
    runtime.createdUrls = [];
    runtime.revokedUrls = [];
    runtime.nextUrl = 0;
    runtime.createObjectURL.mockImplementation((blob: Blob) => {
      const url = `blob:${window.location.origin}/owned-${++runtime.nextUrl}`;
      runtime.createdUrls.push({ url, blob });
      return url;
    });
    runtime.revokeObjectURL.mockImplementation((url: string) => {
      runtime.revokedUrls.push(url);
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: runtime.createObjectURL
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: runtime.revokeObjectURL
    });
    Reflect.deleteProperty(window, "AdMarketCreator");
    Reflect.deleteProperty(window, "AdMarketCreatorSpike");
    document.body.innerHTML = `
      <main aria-label="Advertising Market Game">
        <canvas id="canvas" tabindex="0"></canvas>
      </main>
      <div id="creator-root"></div>`;
  });

  it("installs one frozen method and keeps Fabric lazy until a valid open request", async () => {
    await import("./main");
    const api = (window as Window & { AdMarketCreator: CreatorPublicApi }).AdMarketCreator;

    expect(Object.isFrozen(api)).toBe(true);
    expect(Reflect.ownKeys(api)).toEqual(["handle"]);
    expect("AdMarketCreatorSpike" in window).toBe(false);
    expect(runtime.canvasConstructed).not.toHaveBeenCalled();

    const opened = await parsed(api, "open", "open", blankDocument);

    expect(opened).toEqual({ contract: CREATOR_BRIDGE_CONTRACT, requestId: "open", ok: true });
    expect(runtime.canvasConstructed).toHaveBeenCalledTimes(1);
    expect(runtime.adapterConstructed).toHaveBeenCalledTimes(1);
    expect(runtime.load).toHaveBeenCalledWith(blankDocument.fabricState);
    expect(document.querySelector("main")?.getAttribute("aria-hidden")).toBe("true");
    expect(document.querySelector<HTMLElement>("main")?.inert).toBe(true);
    expect(document.querySelector("#creator-root")?.hasAttribute("hidden")).toBe(false);
    expect(document.activeElement).toBe(getByRole(document.body, "region", { name: "Campaign canvas" }));

    const state = await parsed(api, "state", "getState", null);
    const saved = await parsed(api, "save", "save", null);
    const published = await parsed(api, "publish", "publish", null);

    expect(state).toEqual({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "state",
      ok: true,
      payload: blankDocument
    });
    expect(saved).toEqual({ contract: CREATOR_BRIDGE_CONTRACT, requestId: "save", ok: true });
    const [savedDocument, savedBlobs] = runtime.save.mock.calls.at(-1)! as [
      CampaignDocumentV1,
      ReadonlyMap<string, Blob>
    ];
    expect(savedDocument).toMatchObject({ documentId: blankDocument.documentId, revision: 0 });
    expect(Date.parse(savedDocument.updatedAt)).toBeGreaterThan(Date.parse(blankDocument.updatedAt));
    expect(savedBlobs).toEqual(new Map());
    expect(published).toMatchObject({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "publish",
      ok: true,
      payload: { contract: "published-campaign@1", pngBase64: "AAEC" }
    });
    expect(runtime.publish).toHaveBeenCalledWith(expect.objectContaining({
      documentId: blankDocument.documentId,
      revision: 0
    }));
  });

  it("rehydrates the exact persisted local blobs, saves their bodies and publishes only owned URLs", async () => {
    const source = localBlobDocument();
    storeDraft(source, [7, 8, 9, 10]);
    await import("./main");
    const api = window.AdMarketCreator;

    expect(await parsed(api, "open-local", "open", source)).toMatchObject({ ok: true });
    expect(runtime.loadDraft).toHaveBeenCalledWith(source.documentId);
    expect(runtime.createdUrls).toHaveLength(1);
    expect(await bytesOf(runtime.createdUrls[0]!.blob)).toEqual([7, 8, 9, 10]);
    expect(currentObjects()[0]?.src).toBe(runtime.createdUrls[0]!.url);

    expect(await parsed(api, "save-local", "save", null)).toMatchObject({ ok: true });
    const [, blobs] = runtime.save.mock.calls.at(-1)! as [CampaignDocumentV1, ReadonlyMap<string, Blob>];
    expect(await bytesOf(blobs.get("photo-png")!)).toEqual([7, 8, 9, 10]);

    expect(await parsed(api, "publish-local", "publish", null)).toMatchObject({ ok: true });
    expect(runtime.exporterConstructed.mock.calls.at(-1)?.[1])
      .toEqual(new Set([runtime.createdUrls[0]!.url]));

    currentObjects()[0]!.src = `blob:${window.location.origin}/not-owned`;
    expect(await parsed(api, "publish-unowned", "publish", null)).toMatchObject({
      ok: false,
      error: { code: "HANDLER_ERROR" }
    });
  });

  it.each(["missing revision", "revision mismatch", "state mismatch", "missing blob"])(
    "fails local-blob open for %s",
    async (scenario) => {
      const requested = localBlobDocument(3);
      if (scenario === "revision mismatch") storeDraft(localBlobDocument(4));
      if (scenario === "state mismatch") {
        const stored = structuredClone(requested);
        stored.product.name = "Different persisted state";
        storeDraft(stored);
      }
      if (scenario === "missing blob") {
        runtime.drafts.set(requested.documentId, {
          document: structuredClone(requested),
          blobs: new Map()
        });
      }
      await import("./main");

      expect(await parsed(window.AdMarketCreator, `open-${scenario}`, "open", requested)).toMatchObject({
        contract: CREATOR_BRIDGE_CONTRACT,
        ok: false,
        error: { code: "HANDLER_ERROR" }
      });
      expect(runtime.load).not.toHaveBeenCalled();
    }
  );

  it("revokes newly rehydrated URLs when canvas runtime creation fails", async () => {
    const source = localBlobDocument();
    storeDraft(source, [4, 5, 6]);
    runtime.canvasFailure = new Error("Synthetic canvas construction failure");
    await import("./main");

    expect(await parsed(window.AdMarketCreator, "open-runtime-failure", "open", source)).toMatchObject({
      ok: false,
      error: { code: "HANDLER_ERROR", message: "Synthetic canvas construction failure" }
    });
    expect(runtime.createdUrls).toHaveLength(1);
    expect(runtime.revokedUrls).toEqual([runtime.createdUrls[0]!.url]);
  });

  it("disposes and evicts a newly created runtime when its initial load fails", async () => {
    const source = localBlobDocument();
    storeDraft(source, [6, 7, 8]);
    runtime.loadFailure = new Error("Synthetic initial Fabric load failure");
    await import("./main");
    const api = window.AdMarketCreator;

    expect(await parsed(api, "open-initial-load-failure", "open", source)).toMatchObject({
      ok: false,
      error: { code: "HANDLER_ERROR", message: "Synthetic initial Fabric load failure" }
    });
    expect(runtime.adapterDisposed).toHaveBeenCalledTimes(1);
    expect(runtime.canvasDisposed).toHaveBeenCalledTimes(1);
    expect(runtime.revokedUrls).toEqual([runtime.createdUrls[0]!.url]);

    runtime.loadFailure = null;
    expect(await parsed(api, "open-after-initial-failure", "open", source)).toMatchObject({ ok: true });
    expect(runtime.canvasConstructed).toHaveBeenCalledTimes(2);
    expect(runtime.adapterConstructed).toHaveBeenCalledTimes(2);
  });

  it("releases replacement URLs only after load succeeds and releases current URLs on close", async () => {
    const first = localBlobDocument(3);
    storeDraft(first, [1]);
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-first", "open", first)).toMatchObject({ ok: true });
    const firstUrl = runtime.createdUrls[0]!.url;

    const replacement = localBlobDocument(4);
    storeDraft(replacement, [2]);
    runtime.loadFailure = new Error("Synthetic Fabric load failure");
    expect(await parsed(api, "open-failed", "open", replacement)).toMatchObject({ ok: false });
    const failedUrl = runtime.createdUrls[1]!.url;
    expect(runtime.revokedUrls).toEqual([failedUrl]);
    expect(runtime.revokedUrls).not.toContain(firstUrl);
    expect(runtime.adapterDisposed).not.toHaveBeenCalled();
    expect(runtime.canvasDisposed).not.toHaveBeenCalled();

    runtime.loadFailure = null;
    expect(await parsed(api, "open-replacement", "open", replacement)).toMatchObject({ ok: true });
    const replacementUrl = runtime.createdUrls[2]!.url;
    expect(runtime.revokedUrls).toEqual([failedUrl, firstUrl]);

    expect(await parsed(api, "close-replacement", "close", null)).toMatchObject({ ok: true });
    expect(runtime.revokedUrls).toEqual([failedUrl, firstUrl, replacementUrl]);
  });

  it("finishes close cleanup and returns a useful error when adapter disposal throws", async () => {
    const source = localBlobDocument();
    storeDraft(source, [3, 2, 1]);
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-close-failure", "open", source)).toMatchObject({ ok: true });
    const ownedUrl = runtime.createdUrls[0]!.url;
    runtime.adapterDisposeFailure = new Error("Synthetic adapter disposal failure");

    expect(await parsed(api, "close-disposal-failure", "close", null)).toEqual({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "close-disposal-failure",
      ok: false,
      error: { code: "HANDLER_ERROR", message: "Synthetic adapter disposal failure" }
    });
    expect(runtime.adapterDisposed).toHaveBeenCalledTimes(1);
    expect(runtime.canvasDisposed).toHaveBeenCalledTimes(1);
    expect(runtime.revokedUrls).toEqual([ownedUrl]);
    expect(document.querySelector("#creator-root")?.hasAttribute("hidden")).toBe(true);
    expect(document.querySelector("main")?.hasAttribute("aria-hidden")).toBe(false);
    expect(document.querySelector<HTMLElement>("main")?.inert).toBe(false);
    expect(document.activeElement).toBe(document.querySelector("#canvas"));

    runtime.adapterDisposeFailure = null;
    expect(await parsed(api, "open-after-close-failure", "open", blankDocument)).toMatchObject({ ok: true });
    expect(runtime.canvasConstructed).toHaveBeenCalledTimes(2);
  });

  it("waits for asynchronous Fabric canvas disposal before close returns", async () => {
    let releaseDispose!: () => void;
    runtime.canvasDisposePromise = new Promise<void>((resolve) => {
      releaseDispose = resolve;
    });
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-before-async-close", "open", blankDocument)).toMatchObject({ ok: true });

    let settled = false;
    const closing = parsed(api, "async-close", "close", null).finally(() => {
      settled = true;
    });
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runtime.canvasDisposed).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);

    releaseDispose();
    expect(await closing).toMatchObject({ ok: true });
    expect(settled).toBe(true);
  });

  it("persists two saves as increasing revisions and exposes the latest state", async () => {
    await import("./main");
    const api = window.AdMarketCreator;
    await parsed(api, "open-save-sequence", "open", blankDocument);

    expect(await parsed(api, "save-one", "save", null)).toMatchObject({ ok: true });
    expect(await parsed(api, "save-two", "save", null)).toMatchObject({ ok: true });
    const savedDocuments = runtime.save.mock.calls.map(([document]) => document as CampaignDocumentV1);
    expect(savedDocuments.map(({ revision }) => revision)).toEqual([0, 1]);
    expect(Date.parse(savedDocuments[0]!.updatedAt)).toBeGreaterThan(Date.parse(blankDocument.updatedAt));
    expect(Date.parse(savedDocuments[1]!.updatedAt)).toBeGreaterThan(Date.parse(savedDocuments[0]!.updatedAt));

    const state = await parsed(api, "latest-state", "getState", null);
    expect(state.payload).toMatchObject({
      documentId: blankDocument.documentId,
      revision: 1,
      updatedAt: savedDocuments[1]!.updatedAt
    });
  });

  it("searches the offline core, places a raster, and drains its durable reference before state and save", async () => {
    const core = {
      schema: "catalog-asset@1",
      delivery: "offline",
      id: "core-bottle",
      version: 1,
      kind: "component",
      title: "Reviewed bottle",
      category: "drinkware",
      tags: ["bottle"],
      files: {
        thumbnail: "/catalog/generated/offline-core-v1/assets/core-bottle/thumbnail-192.webp",
        preview: "/catalog/generated/offline-core-v1/assets/core-bottle/preview-640.webp",
        master: "/catalog/generated/offline-core-v1/assets/core-bottle/master.png",
        masks: { body: "/catalog/generated/offline-core-v1/assets/core-bottle/masks/body.png" }
      },
      masterSha256: "a".repeat(64),
      dimensions: { width: 320, height: 640 },
      recolourZones: ["body"],
      anchors: [],
      materialProfiles: ["matte-plastic"],
      classroomReviewed: true,
      brandFree: true,
      attribution: {
        creator: "Classroom pack",
        sourceUrl: "local",
        license: "classroom-session"
      }
    };
    document.querySelector<HTMLElement>("#creator-root")!.dataset.offlineCatalogueUrl =
      "/catalog/generated/offline-core-v1/catalog.json";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([core]));
    await import("./main");
    const api = window.AdMarketCreator;
    await parsed(api, "open-catalogue", "open", blankDocument);

    const search = getByRole<HTMLInputElement>(document.body, "searchbox", { name: "Search assets" });
    search.value = "bottle";
    search.dispatchEvent(new Event("input"));
    const tile = await findByRole(document.body, "button", { name: "Reviewed bottle" });
    tile.click();

    const state = await parsed(api, "catalogue-state", "getState", null);
    expect(state.payload).toMatchObject({
      fabricState: {
        objects: [expect.objectContaining({ elementKind: "image", assetId: "core-bottle" })]
      },
      assetReferences: [{
        kind: "catalog",
        objectId: expect.any(String),
        assetId: "core-bottle",
        assetVersion: 1,
        attribution: core.attribution
      }]
    });

    expect(await parsed(api, "catalogue-save", "save", null)).toMatchObject({ ok: true });
    expect(runtime.save.mock.calls.at(-1)?.[0]).toMatchObject({
      assetReferences: [expect.objectContaining({ kind: "catalog", assetId: "core-bottle" })]
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("places, recolours, saves and reloads a semantic product shell", async () => {
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    root.dataset.productShellCatalogueUrl =
      "/catalog/generated/product-shells-v1/catalog.json";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/catalog/generated/product-shells-v1/catalog.json")) {
        return Promise.resolve(Response.json(productShellCatalogueFixture()));
      }
      if (url.endsWith("/shells/drinks-classic-can/authoring.svg")) {
        return Promise.resolve(new Response(
          '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>',
          { headers: { "content-type": "image/svg+xml" } }
        ));
      }
      return Promise.reject(new Error(`Unexpected URL ${url}`));
    });
    await import("./main");
    const api = window.AdMarketCreator;
    await parsed(api, "open-product-shell", "open", blankDocument);
    const select = getByRole<HTMLSelectElement>(document.body, "combobox", {
      name: "Product shell"
    });
    await vi.waitFor(() => expect(select.disabled).toBe(false));
    select.value = "drinks-classic-can";
    select.dispatchEvent(new Event("change"));
    getByRole(document.body, "button", { name: "Add product shell" }).click();

    const state = await parsed(api, "state-product-shell", "getState", null);
    const stateDocument = CampaignDocumentSchema.parse(state.payload);
    const object = stateDocument.fabricState.objects[0];
    expect(object).toMatchObject({
      elementKind: "product-shell",
      shellId: "drinks-classic-can"
    });
    expect(stateDocument.assetReferences).toEqual([{
      kind: "product-shell",
      objectId: object?.objectId,
      shellId: "drinks-classic-can",
      packId: "product-shells-v1",
      version: 1
    }]);

    const accent = await findByLabelText<HTMLInputElement>(document.body, "Accent colour");
    accent.value = "#157a6e";
    accent.dispatchEvent(new Event("input"));
    expect((await parsed(api, "recoloured-shell", "getState", null)).payload)
      .toMatchObject({
        fabricState: {
          objects: [expect.objectContaining({
            regionColours: expect.objectContaining({ accent: "#157A6E" })
          })]
        }
      });

    expect(await parsed(api, "save-shell", "save", null)).toMatchObject({ ok: true });
    const saved = runtime.drafts.get(blankDocument.documentId)!.document;
    expect(await parsed(api, "close-shell", "close", null)).toMatchObject({ ok: true });
    expect(await parsed(api, "reload-shell", "open", saved)).toMatchObject({ ok: true });
    expect((await parsed(api, "reloaded-shell-state", "getState", null)).payload)
      .toMatchObject({
        fabricState: {
          objects: [expect.objectContaining({
            regionColours: expect.objectContaining({ accent: "#157A6E" })
          })]
        }
      });
    expect(fetchSpy.mock.calls.some(([input]) => String(input).endsWith("authoring.svg")))
      .toBe(true);
  });

  it("keeps live search usable while the optional classroom pack is stalled", async () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    document.querySelector<HTMLElement>("#creator-root")!.dataset.offlineCatalogueUrl =
      "/catalog/generated/offline-core-v1/catalog.json";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.includes("offline-core-v1")) return new Promise<Response>(() => undefined);
      if (url.startsWith("/api/openverse-search?")) {
        return Promise.resolve(Response.json({ records: [{
          id,
          title: "Morning market",
          creator: "A. Photographer",
          license: "CC BY 4.0",
          sourceUrl: "https://example.test/work/photo",
          thumbnailUrl: `/api/openverse-image/${id}?variant=thumbnail`,
          width: 1600,
          height: 900
        }] }));
      }
      return Promise.reject(new Error(`Unexpected URL ${url}`));
    });

    await import("./main");
    await parsed(window.AdMarketCreator, "open-stalled-core", "open", blankDocument);
    const search = getByRole<HTMLInputElement>(document.body, "searchbox", { name: "Search assets" });
    const toggle = getByRole<HTMLInputElement>(document.body, "checkbox", { name: "Use live photos" });
    search.value = "market";
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));

    expect(await findByRole(document.body, "button", { name: /Morning market/ })).toBeTruthy();
    expect(fetchSpy.mock.calls.some(([input]) => String(input).startsWith("/api/openverse-search?"))).toBe(true);
  });

  it("saves a live photo as owned bytes and reloads it without network access", async () => {
    const id = "123e4567-e89b-42d3-a456-426614174000";
    const imageBytes = Uint8Array.from([137, 80, 78, 71, 10, 20, 30]);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.startsWith("/api/openverse-search?")) {
        return Promise.resolve(Response.json({ records: [{
          id,
          title: "Morning market",
          creator: "A. Photographer",
          license: "CC BY 4.0",
          sourceUrl: "https://example.test/work/photo",
          thumbnailUrl: `/api/openverse-image/${id}?variant=thumbnail`,
          width: 1600,
          height: 900
        }] }));
      }
      if (url === `${window.location.origin}/api/openverse-image/${id}`) {
        return Promise.resolve(new Response(imageBytes, {
          headers: { "content-type": "image/png", "content-length": String(imageBytes.length) }
        }));
      }
      return Promise.reject(new Error(`Unexpected URL ${url}`));
    });
    await import("./main");
    const api = window.AdMarketCreator;
    await parsed(api, "open-live", "open", blankDocument);
    const search = getByRole<HTMLInputElement>(document.body, "searchbox", { name: "Search assets" });
    const toggle = getByRole<HTMLInputElement>(document.body, "checkbox", { name: "Use live photos" });
    search.value = "market";
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    const tile = await findByRole(document.body, "button", { name: /Morning market/ });
    tile.click();

    expect(await parsed(api, "save-live", "save", null)).toMatchObject({ ok: true });
    const [savedDocument, savedBlobs] = runtime.save.mock.calls.at(-1)! as [
      CampaignDocumentV1,
      ReadonlyMap<string, Blob>
    ];
    const localReference = savedDocument.assetReferences.find(({ kind }) => kind === "local-blob")!;
    expect(savedDocument.assetReferences).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "catalog", objectId: localReference.objectId, assetId: id }),
      expect.objectContaining({ kind: "local-blob", objectId: localReference.objectId, assetId: id })
    ]));
    expect(await bytesOf(savedBlobs.get(String(localReference.blobKey))!))
      .toEqual(Array.from(imageBytes));
    const durable = runtime.drafts.get(blankDocument.documentId)!;
    expect(durable.document.fabricState.objects[0]?.src)
      .toBe(`local-blob:${String(localReference.blobKey)}`);
    const firstOwnedUrl = runtime.createdUrls.at(-1)!.url;

    expect(await parsed(api, "close-live", "close", null)).toMatchObject({ ok: true });
    expect(runtime.revokedUrls).toContain(firstOwnedUrl);
    const callsBeforeReload = fetchSpy.mock.calls.length;
    fetchSpy.mockRejectedValue(new TypeError("network unavailable"));

    expect(await parsed(api, "reload-live", "open", durable.document)).toMatchObject({ ok: true });
    const reloaded = await parsed(api, "state-live-reloaded", "getState", null);
    const secondOwnedUrl = runtime.createdUrls.at(-1)!.url;
    expect(reloaded.payload).toMatchObject({
      fabricState: { objects: [expect.objectContaining({ src: secondOwnedUrl, assetId: id })] },
      assetReferences: expect.arrayContaining([
        expect.objectContaining({ kind: "catalog", assetId: id }),
        expect.objectContaining({ kind: "local-blob", assetId: id })
      ])
    });
    expect(secondOwnedUrl).not.toBe(firstOwnedUrl);
    expect(fetchSpy.mock.calls).toHaveLength(callsBeforeReload);
  });

  it("returns canonical handler errors when storage or export fails", async () => {
    await import("./main");
    const api = window.AdMarketCreator;
    await parsed(api, "open-failures", "open", blankDocument);

    runtime.saveFailure = new Error("Synthetic IndexedDB failure");
    expect(await parsed(api, "storage-failure", "save", null)).toEqual({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "storage-failure",
      ok: false,
      error: { code: "HANDLER_ERROR", message: "Synthetic IndexedDB failure" }
    });

    runtime.publishFailure = new Error("Synthetic Fabric export failure");
    expect(await parsed(api, "export-failure", "publish", null)).toEqual({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "export-failure",
      ok: false,
      error: { code: "HANDLER_ERROR", message: "Synthetic Fabric export failure" }
    });
  });

  it("emits a private Return-to-game event and restores the game surface on close", async () => {
    await import("./main");
    const api = (window as Window & { AdMarketCreator: CreatorPublicApi }).AdMarketCreator;
    await parsed(api, "open", "open", blankDocument);
    const returnEvents: Event[] = [];
    window.addEventListener("ad-market-creator:return-to-game", (event) => returnEvents.push(event), {
      once: true
    });

    getByRole(document.body, "button", { name: "Return to game" }).click();

    expect(returnEvents).toHaveLength(1);
    expect((returnEvents[0] as CustomEvent).detail).toEqual({
      contract: CREATOR_BRIDGE_CONTRACT,
      event: "closeRequested"
    });
    expect(document.querySelector("#creator-root")?.hasAttribute("hidden")).toBe(false);

    const closed = await parsed(api, "close", "close", null);

    expect(closed).toEqual({ contract: CREATOR_BRIDGE_CONTRACT, requestId: "close", ok: true });
    expect(document.querySelector("#creator-root")?.hasAttribute("hidden")).toBe(true);
    expect(document.querySelector("main")?.hasAttribute("aria-hidden")).toBe(false);
    expect(document.querySelector<HTMLElement>("main")?.inert).toBe(false);
    expect(document.activeElement).toBe(document.querySelector("#canvas"));
    expect(runtime.adapterDisposed).toHaveBeenCalledTimes(1);
    expect(runtime.canvasDisposed).toHaveBeenCalledTimes(1);
  });
});
