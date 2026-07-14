import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, findByRole, getByRole, waitFor } from "@testing-library/dom";
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
import { AUDIENCE_BRIEFS } from "./game/audience-briefs";

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
  listeners: new Set<(mutation: {
    type: "added" | "modified" | "removed";
    objectId: string;
  }) => void>(),
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

    async addText(input: {
      id: string;
      value: string;
      accessibleName: string;
    }): Promise<void> {
      const objects = runtime.state.objects;
      if (!Array.isArray(objects)) throw new Error("Test canvas state has no objects");
      objects.push({
        type: "textbox",
        objectId: input.id,
        elementKind: "text",
        accessibleName: input.accessibleName,
        text: input.value
      });
      runtime.listeners.forEach((listener) => listener({
        type: "added",
        objectId: input.id
      }));
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
      runtime.listeners.forEach((listener) => listener({
        type: "added",
        objectId: input.id
      }));
    }

    async addLogoMark(input: {
      id: string;
      design: {
        recipe: "icon-wordmark" | "badge-seal" | "monogram" | "mascot-emblem";
        text: string;
        iconId: string;
        primary: string;
        secondary: string;
        typeface: "Arial" | "Georgia" | "Trebuchet MS" | "Verdana";
        seed: number;
        revision: number;
      };
      icon: { id: string };
    }): Promise<void> {
      const objects = runtime.state.objects;
      if (!Array.isArray(objects)) throw new Error("Test canvas state has no objects");
      if (input.icon.id !== input.design.iconId) throw new Error("Logo icon mismatch");
      objects.push(this.logoObject(input.id, input.design));
      runtime.listeners.forEach((listener) => listener({
        type: "added",
        objectId: input.id
      }));
    }

    async replaceLogoMark(id: string, input: {
      design: {
        recipe: "icon-wordmark" | "badge-seal" | "monogram" | "mascot-emblem";
        text: string;
        iconId: string;
        primary: string;
        secondary: string;
        typeface: "Arial" | "Georgia" | "Trebuchet MS" | "Verdana";
        seed: number;
        revision: number;
      };
      icon: { id: string };
    }): Promise<void> {
      const objects = runtime.state.objects;
      if (!Array.isArray(objects)) throw new Error("Test canvas state has no objects");
      if (input.icon.id !== input.design.iconId) throw new Error("Logo icon mismatch");
      const index = objects.findIndex((candidate) =>
        typeof candidate === "object" && candidate !== null &&
        (candidate as Record<string, unknown>).objectId === id);
      if (index < 0) throw new Error(`Missing logo mark ${id}`);
      const current = objects[index] as Record<string, unknown>;
      objects[index] = {
        ...this.logoObject(id, input.design),
        left: current.left,
        top: current.top,
        scaleX: current.scaleX,
        scaleY: current.scaleY,
        angle: current.angle
      };
      runtime.listeners.forEach((listener) => listener({ type: "modified", objectId: id }));
    }

    listLogoMarks(): ReadonlyArray<{
      id: string;
      design: {
        recipe: "icon-wordmark" | "badge-seal" | "monogram" | "mascot-emblem";
        text: string;
        iconId: string;
        primary: string;
        secondary: string;
        typeface: "Arial" | "Georgia" | "Trebuchet MS" | "Verdana";
        seed: number;
        revision: number;
      };
    }> {
      const objects = runtime.state.objects;
      if (!Array.isArray(objects)) throw new Error("Test canvas state has no objects");
      return Object.freeze(objects
        .filter((candidate): candidate is Record<string, unknown> =>
          typeof candidate === "object" && candidate !== null &&
          candidate.elementKind === "logo-mark")
        .map((candidate) => Object.freeze({
          id: String(candidate.objectId),
          design: Object.freeze({
            recipe: candidate.logoRecipe as "icon-wordmark" | "badge-seal" | "monogram" | "mascot-emblem",
            text: String(candidate.logoText),
            iconId: String(candidate.logoIconId),
            primary: String(candidate.logoPrimary),
            secondary: String(candidate.logoSecondary),
            typeface: candidate.logoTypeface as "Arial" | "Georgia" | "Trebuchet MS" | "Verdana",
            seed: Number(candidate.logoSeed),
            revision: Number(candidate.logoRevision)
          })
        })));
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
      runtime.listeners.forEach((listener) => listener({
        type: "added",
        objectId: input.id
      }));
    }

    async addProductVariant(input: {
      id: string;
      accessibleName: string;
      variant: {
        id: string;
        packId: string;
        bodyId: string;
        partId: string;
        paletteId: string;
        materialId: string;
        colours: Record<string, string>;
      };
      artwork?: { id: string; colour: string };
    }): Promise<void> {
      const objects = runtime.state.objects;
      if (!Array.isArray(objects)) throw new Error("Test canvas state has no objects");
      objects.push({
        type: "group",
        objectId: input.id,
        elementKind: "product-shell",
        shellId: input.variant.bodyId,
        accessibleName: input.accessibleName,
        packId: input.variant.packId,
        variantId: input.variant.id,
        bodyId: input.variant.bodyId,
        partId: input.variant.partId,
        paletteId: input.variant.paletteId,
        materialId: input.variant.materialId,
        ...(input.artwork === undefined ? {} : { artwork: input.artwork }),
        regionColours: structuredClone(input.variant.colours)
      });
      runtime.listeners.forEach((listener) => listener({
        type: "added",
        objectId: input.id
      }));
    }

    setProductShellRegion(id: string, region: string, colour: string): void {
      const object = (runtime.state.objects as Array<Record<string, unknown>>)
        .find((candidate) => candidate.objectId === id);
      if (!object) throw new Error(`Missing object ${id}`);
      (object.regionColours as Record<string, string>)[region] = colour;
      runtime.listeners.forEach((listener) => listener({ type: "modified", objectId: id }));
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
      if (index >= 0) {
        objects.splice(index, 1);
        runtime.listeners.forEach((listener) => listener({ type: "removed", objectId: id }));
      }
    }

    setSelected(): void {}

    subscribe(listener: (mutation: {
      type: "added" | "modified" | "removed";
      objectId: string;
    }) => void): () => void {
      runtime.listeners.add(listener);
      return () => runtime.listeners.delete(listener);
    }

    exportCleanPngDataUrl(): string {
      return "data:image/png;base64,AA==";
    }

    dispose(): void {
      runtime.adapterDisposed();
      runtime.listeners.clear();
      if (runtime.adapterDisposeFailure) throw runtime.adapterDisposeFailure;
    }

    private logoObject(id: string, design: {
      recipe: "icon-wordmark" | "badge-seal" | "monogram" | "mascot-emblem";
      text: string;
      iconId: string;
      primary: string;
      secondary: string;
      typeface: "Arial" | "Georgia" | "Trebuchet MS" | "Verdana";
      seed: number;
      revision: number;
    }): Record<string, unknown> {
      return {
        type: "group",
        objectId: id,
        elementKind: "logo-mark",
        accessibleName: `${design.text} logo`,
        logoRecipe: design.recipe,
        logoSeed: design.seed,
        logoRevision: design.revision,
        logoIconId: design.iconId,
        logoText: design.text,
        logoPrimary: design.primary,
        logoSecondary: design.secondary,
        logoTypeface: design.typeface,
        left: 800,
        top: 450,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        objects: [
          {
            type: "rect",
            objectId: `${id}:container`,
            elementKind: "shape",
            accessibleName: `${design.text} logo container`,
            logoLayer: "container"
          },
          {
            type: design.recipe === "monogram" ? "textbox" : "group",
            objectId: `${id}:symbol`,
            elementKind: design.recipe === "monogram" ? "text" : "shape",
            accessibleName: `${design.text} logo symbol`,
            logoLayer: "symbol"
          },
          {
            type: "textbox",
            objectId: `${id}:wordmark`,
            elementKind: "text",
            accessibleName: `${design.text} wordmark`,
            logoLayer: "wordmark"
          }
        ]
      };
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

const PRODUCT_BUILDER_ROOT = join(
  "catalog", "generated", "product-builder-pilot-v1"
);

function productBuilderText(relativePath: string): string {
  return readFileSync(join(PRODUCT_BUILDER_ROOT, relativePath), "utf8");
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

function logoCatalogueFixture(): Record<string, unknown> {
  const icons = [
    ["rocket", "Rocket", "tech-gadgets"],
    ["paw", "Paw", "pets-animals"],
    ["bottle", "Bottle", "drinks-snacks"],
    ["burger", "Burger", "fast-food-hospitality"]
  ];
  return {
    schema: "logo-icon-catalog@1",
    packId: "tabler-logo-icons-v1",
    version: 1,
    source: {
      name: "Tabler Icons",
      package: "@iconify-json/tabler",
      packageVersion: "1.2.35",
      sourceVersion: "3.44.0",
      licence: "MIT",
      url: "https://tabler.io/icons"
    },
    icons: icons.map(([id, title, category]) => ({
      id,
      title,
      width: 24,
      height: 24,
      categories: [category, "general"],
      body: '<path d="M4 12h16" stroke="currentColor" />'
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
    runtime.listeners.clear();
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
      payload: {
        ...blankDocument,
        brief: {
          targetAudienceId: AUDIENCE_BRIEFS[0].id,
          contextId: AUDIENCE_BRIEFS[0].id,
          purpose: "persuade",
          audienceNeeds: [AUDIENCE_BRIEFS[0].need],
          audienceValues: [...AUDIENCE_BRIEFS[0].values],
          intendedEffects: [AUDIENCE_BRIEFS[0].intendedEffect],
          techniques: []
        }
      }
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

  it("plays a paired Round 0 with real text history and audience persistence", async () => {
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-round-zero", "open", blankDocument)).toMatchObject({ ok: true });

    expect(getByRole(document.body, "heading", { name: "Art Director" })).toBeTruthy();
    expect((await parsed(api, "round-zero-brief", "getState", null)).payload).toMatchObject({
      brief: {
        targetAudienceId: AUDIENCE_BRIEFS[0].id,
        contextId: AUDIENCE_BRIEFS[0].id,
        audienceNeeds: [AUDIENCE_BRIEFS[0].need],
        audienceValues: [...AUDIENCE_BRIEFS[0].values],
        intendedEffects: [AUDIENCE_BRIEFS[0].intendedEffect]
      }
    });

    const words = getByRole<HTMLInputElement>(document.body, "textbox", {
      name: "Canvas words"
    });
    fireEvent.input(words, { target: { value: "Make room for adventure" } });
    fireEvent.click(getByRole(document.body, "button", { name: "Add words" }));

    await waitFor(() => {
      expect(currentObjects()).toEqual([
        expect.objectContaining({
          elementKind: "text",
          text: "Make room for adventure"
        })
      ]);
      expect(getByRole(document.body, "status", { name: "Round progress" }).textContent)
        .toBe("1 visible change");
    });

    fireEvent.click(getByRole(document.body, "button", { name: "Swap roles" }));
    expect(getByRole(document.body, "heading", { name: "Strategist" })).toBeTruthy();
    fireEvent.input(words, { target: { value: "Your weekend, your way" } });
    fireEvent.click(getByRole(document.body, "button", { name: "Add words" }));

    await waitFor(() => {
      expect(currentObjects()).toHaveLength(2);
      expect(getByRole(document.body, "status", { name: "Round progress" }).textContent)
        .toBe("Both roles have made a change");
    });

    fireEvent.click(getByRole(document.body, "button", { name: "Undo" }));
    await waitFor(() => {
      expect(currentObjects()).toHaveLength(1);
      expect(document.querySelector('[data-live="polite"]')?.textContent)
        .toBe("Undid last change");
    });
    fireEvent.click(getByRole(document.body, "button", { name: "Redo" }));
    await waitFor(() => {
      expect(currentObjects()).toHaveLength(2);
      expect(document.querySelector('[data-live="polite"]')?.textContent)
        .toBe("Redid last change");
    });

    expect((await parsed(api, "round-zero-state", "getState", null)).payload).toMatchObject({
      fabricState: {
        objects: [
          expect.objectContaining({ text: "Make room for adventure" }),
          expect.objectContaining({ text: "Your weekend, your way" })
        ]
      }
    });
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

  it("builds, places, saves and reloads one custom product without identity-breaking colour controls", async () => {
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    root.dataset.productBuilderCatalogueUrl =
      "/catalog/generated/product-builder-pilot-v1/catalogue.json";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url.endsWith("/catalog/generated/product-builder-pilot-v1/catalogue.json")) {
        return Promise.resolve(new Response(productBuilderText("catalogue.json"), {
          headers: { "content-type": "application/json" }
        }));
      }
      const marker = "/product-builder-pilot-v1/";
      if (url.includes(marker)) {
        expect(init).toMatchObject({ redirect: "error", credentials: "same-origin" });
        const relative = url.split(marker)[1]!;
        return Promise.resolve(new Response(productBuilderText(relative), {
          headers: { "content-type": "image/svg+xml" }
        }));
      }
      return Promise.reject(new Error(`Unexpected URL ${url}`));
    });
    await import("./main");
    const api = window.AdMarketCreator;
    await parsed(api, "open-product-look", "open", blankDocument);
    fireEvent.click(await findByRole(document.body, "radio", { name: "Classic Can" }));
    fireEvent.click(getByRole(document.body, "radio", { name: "Sport Spout" }));
    fireEvent.click(getByRole(document.body, "radio", { name: "Cobalt Citrus" }));
    fireEvent.click(getByRole(document.body, "radio", { name: "Fabric" }));
    fireEvent.click(getByRole(document.body, "button", { name: "Drop it on the canvas" }));

    const state = await parsed(api, "state-product-look", "getState", null);
    if (!state.ok) throw new Error(JSON.stringify(state.error));
    const stateDocument = CampaignDocumentSchema.parse(state.payload);
    const object = stateDocument.fabricState.objects[0];
    expect(object).toMatchObject({
      elementKind: "product-shell",
      shellId: "drinkware-classic-can",
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-spout",
      paletteId: "cobalt-citrus",
      materialId: "fabric"
    });
    expect(stateDocument.assetReferences).toEqual([{
      kind: "product-builder-variant",
      version: 1,
      objectId: object?.objectId,
      packId: "product-builder-pilot-v1",
      variantId: expect.stringContaining("drinkware-classic-can"),
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-spout",
      paletteId: "cobalt-citrus",
      materialId: "fabric",
      artwork: null
    }]);

    expect(getByRole(document.body, "heading", { name: "Cobalt Citrus Classic Can" }))
      .toBeTruthy();
    expect(document.querySelector('.creator__inspector input[type="color"]')).toBeNull();
    expect(document.querySelector(".creator__inspector")?.textContent)
      .toContain("Choose new colours in the product maker");
    expect(document.querySelector(".creator__inspector")?.textContent)
      .not.toMatch(/\b(?:palette|variant|component|material)\b/i);

    expect(await parsed(api, "save-product-look", "save", null)).toMatchObject({ ok: true });
    const saved = runtime.drafts.get(blankDocument.documentId)!.document;
    expect(await parsed(api, "close-product-look", "close", null)).toMatchObject({ ok: true });
    expect(await parsed(api, "reload-product-look", "open", saved)).toMatchObject({ ok: true });
    expect((await parsed(api, "reloaded-product-look-state", "getState", null)).payload)
      .toMatchObject({
        fabricState: {
          objects: [expect.objectContaining({
            variantId: expect.stringContaining("drinkware-classic-can"),
            paletteId: "cobalt-citrus"
          })]
        }
      });
    expect(document.querySelector('.creator__inspector input[type="color"]')).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("creates all four local logo recipes, remixes, saves, reloads and publishes them", async () => {
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    root.dataset.logoIconCatalogueUrl =
      "/catalog/generated/logo-icons-v1-reviewed/catalog.json";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = new URL(String(input), window.location.origin);
      if (url.origin !== window.location.origin ||
        url.pathname !== "/catalog/generated/logo-icons-v1-reviewed/catalog.json" ||
        url.search || url.hash) {
        return Promise.reject(new Error(`Unexpected URL ${url.href}`));
      }
      expect(init).toMatchObject({
        credentials: "same-origin",
        headers: { accept: "application/json" }
      });
      return Promise.resolve(new Response(JSON.stringify(logoCatalogueFixture()), {
        headers: { "content-type": "application/json" }
      }));
    });
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-logo-lab", "open", blankDocument)).toMatchObject({ ok: true });
    await findByRole(document.body, "button", { name: "Rocket" });

    const recipes = [
      ["Icon + Wordmark", "Orbit Rocket", "Rocket"],
      ["Badge / Seal", "Paw Parade", "Paw"],
      ["Monogram", "Bottle Club", "Bottle"],
      ["Mascot / Emblem", "Burger Buddy", "Burger"]
    ] as const;
    for (const [recipe, words, symbol] of recipes) {
      const chooser = getByRole<HTMLSelectElement>(document.body, "combobox", {
        name: "Logo on canvas"
      });
      chooser.value = "";
      fireEvent.change(chooser);
      fireEvent.click(getByRole(document.body, "radio", { name: recipe }));
      fireEvent.input(getByRole<HTMLInputElement>(document.body, "textbox", {
        name: "Logo words"
      }), { target: { value: words } });
      fireEvent.click(getByRole(document.body, "button", { name: symbol }));
      fireEvent.click(getByRole(document.body, "button", { name: "Add logo" }));
      await waitFor(() => expect(currentObjects()
        .filter(({ elementKind }) => elementKind === "logo-mark")).toHaveLength(
          recipes.findIndex(([candidate]) => candidate === recipe) + 1
        ));
      await waitFor(() => expect(getByRole(document.body, "button", {
        name: "Update logo"
      })).toBeTruthy());
    }

    const details = document.querySelector<HTMLDetailsElement>(".logo-lab details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    fireEvent.click(getByRole(document.body, "button", { name: "Surprise me" }));
    await waitFor(() => expect(currentObjects().at(-1)).toMatchObject({
      elementKind: "logo-mark",
      logoRecipe: "mascot-emblem",
      logoRevision: 1,
      logoSeed: 1
    }));

    const beforeSave = currentObjects()
      .filter(({ elementKind }) => elementKind === "logo-mark")
      .map(({ objectId, logoRecipe, logoText, logoIconId, logoPrimary, logoSecondary,
        logoTypeface, logoSeed, logoRevision, objects }) => structuredClone({
          objectId,
          logoRecipe,
          logoText,
          logoIconId,
          logoPrimary,
          logoSecondary,
          logoTypeface,
          logoSeed,
          logoRevision,
          objects
        }));
    expect(beforeSave.map(({ logoRecipe }) => logoRecipe)).toEqual([
      "icon-wordmark",
      "badge-seal",
      "monogram",
      "mascot-emblem"
    ]);

    expect(await parsed(api, "save-logo-lab", "save", null)).toMatchObject({ ok: true });
    const saved = runtime.drafts.get(blankDocument.documentId)!.document;
    expect(await parsed(api, "close-logo-lab", "close", null)).toMatchObject({ ok: true });
    expect(await parsed(api, "reload-logo-lab", "open", saved)).toMatchObject({ ok: true });

    const reloaded = await parsed(api, "state-reloaded-logo-lab", "getState", null);
    if (!reloaded.ok) throw new Error(JSON.stringify(reloaded.error));
    const reloadedDocument = CampaignDocumentSchema.parse(reloaded.payload);
    const afterReload = reloadedDocument.fabricState.objects
      .filter(({ elementKind }) => elementKind === "logo-mark")
      .map(({ objectId, logoRecipe, logoText, logoIconId, logoPrimary, logoSecondary,
        logoTypeface, logoSeed, logoRevision, objects }) => ({
          objectId,
          logoRecipe,
          logoText,
          logoIconId,
          logoPrimary,
          logoSecondary,
          logoTypeface,
          logoSeed,
          logoRevision,
          objects
        }));
    expect(afterReload).toEqual(beforeSave);
    expect(getByRole<HTMLSelectElement>(document.body, "combobox", {
      name: "Logo on canvas"
    }).options).toHaveLength(5);

    expect(await parsed(api, "publish-logo-lab", "publish", null)).toMatchObject({
      ok: true,
      payload: { contract: "published-campaign@1", pngBase64: "AAEC" }
    });
    expect(runtime.publish).toHaveBeenCalledWith(expect.objectContaining({
      fabricState: expect.objectContaining({ objects: expect.arrayContaining([
        expect.objectContaining({ elementKind: "logo-mark", logoRevision: 1 })
      ]) })
    }));
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(
      `${window.location.origin}/catalog/generated/logo-icons-v1-reviewed/catalog.json`
    );
  });

  it("keeps the asset library usable when the product maker is unavailable", async () => {
    await import("./main");

    await vi.waitFor(() => expect(
      document.querySelector('[data-product-builder-panel]')?.textContent
    ).toContain("Product maker unavailable"));
    expect(document.querySelector('input[aria-label="Search assets"]')).toBeTruthy();
    expect(document.querySelector('[data-product-builder-panel]')?.textContent)
      .toContain("Product maker unavailable");
    expect(document.querySelector('[data-logo-lab-panel]')?.textContent)
      .toContain("Logo maker unavailable");
    expect(document.querySelector('[data-product-shell-select]')).toBeNull();
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
