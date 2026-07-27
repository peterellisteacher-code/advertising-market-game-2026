import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, findByRole, getByLabelText, getByRole, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CreatorPublicApi } from "./bridge/creator-public-api";
import type { AccountBootstrapPublicApi } from "./account/account-bootstrap";
import type { PracticePublicApi } from "./bridge/practice-contracts";
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
import type {
  NewRasterInput,
  NewProductKitInput,
  RasterSectionFillRecipe
} from "./fabric/canvas-port";
import { AUDIENCE_BRIEFS } from "./game/audience-briefs";
import { parseLogoIconCatalogue } from "./logo-lab/logo-icon-catalogue";
import {
  MARKET_BRIDGE_CONTRACT,
  type MarketPublicApi
} from "./market/market-public-api";

const runtime = vi.hoisted(() => ({
  adapterConstructed: vi.fn(),
  adapterDisposed: vi.fn(),
  canvasConstructed: vi.fn(),
  canvasCalcOffset: vi.fn(),
  canvasRequestRenderAll: vi.fn(),
  canvasDisposed: vi.fn(),
  exporterConstructed: vi.fn(),
  publish: vi.fn(),
  load: vi.fn(),
  loadDraft: vi.fn(),
  loadRevisionDraft: vi.fn(),
  save: vi.fn(),
  importCloudPractice: vi.fn(),
  activateAccountDrafts: vi.fn(async (_username: string) => undefined),
  deactivateAccountDrafts: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
  state: { version: "7.4.0", objects: [] } as Record<string, unknown>,
  listeners: new Set<(mutation: {
    type: "added" | "modified" | "removed";
    objectId: string;
  }) => void>(),
  selectionListeners: new Set<(selection: { readonly objectIds: readonly string[] }) => void>(),
  drafts: new Map<string, { document: CampaignDocumentV1; blobs: Map<string, Blob> }>(),
  revisionDrafts: new Map<string, Map<number, {
    document: CampaignDocumentV1;
    blobs: Map<string, Blob>;
  }>>(),
  activePractice: null as null | {
    checkpoint: import("./persistence/draft-store").LocalPracticeCheckpointV1;
    document: CampaignDocumentV1;
    blobs: Map<string, Blob>;
  },
  loadFailure: null as Error | null,
  loadPromise: null as Promise<void> | null,
  saveFailure: null as Error | null,
  publishFailure: null as Error | null,
  createdUrls: [] as Array<{ url: string; blob: Blob }>,
  revokedUrls: [] as string[],
  nextUrl: 0,
  canvasFailure: null as Error | null,
  adapterDisposeFailure: null as Error | null,
  canvasDisposeFailure: null as Error | null,
  canvasDisposePromise: null as Promise<void> | null,
  selectedObjectId: null as string | null,
  sectionFillPreview: null as RasterSectionFillRecipe | null,
  sectionFillApplications: [] as RasterSectionFillRecipe[]
}));

vi.mock("fabric", () => ({
  Canvas: class {
    constructor(element: HTMLCanvasElement) {
      runtime.canvasConstructed(element);
      if (runtime.canvasFailure) throw runtime.canvasFailure;
    }

    calcOffset(): void {
      runtime.canvasCalcOffset();
    }

    requestRenderAll(): void {
      runtime.canvasRequestRenderAll();
    }

    dispose(): Promise<void> {
      runtime.canvasDisposed();
      if (runtime.canvasDisposeFailure) return Promise.reject(runtime.canvasDisposeFailure);
      return runtime.canvasDisposePromise ?? Promise.resolve();
    }
  }
}));

vi.mock("./ai-image/image-processing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ai-image/image-processing")>();
  return {
    ...actual,
    prepareImageForAi: vi.fn(async (_dataUrl: string, target: "object-forge" | "make-it-real") => ({
      blob: new Blob([Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4)], {
        type: "image/png"
      }),
      dataUrl: "data:image/png;base64,iVBORwECAwQ=",
      width: target === "object-forge" ? 512 : 1024,
      height: target === "object-forge" ? 512 : 576
    }))
  };
});

vi.mock("./catalogue/raster-template-tint", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./catalogue/raster-template-tint")>();
  return {
    ...actual,
    tintRasterTemplate: vi.fn(async () => new Blob([
      Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    ], { type: "image/png" }))
  };
});

vi.mock("./fabric/fabric-canvas-adapter", () => ({
  FabricCanvasAdapter: class {
    constructor(canvas: unknown) {
      runtime.adapterConstructed(canvas);
    }

    async load(value: Record<string, unknown>): Promise<void> {
      runtime.load(value);
      if (runtime.loadFailure) throw runtime.loadFailure;
      if (runtime.loadPromise !== null) await runtime.loadPromise;
      runtime.state = structuredClone(value);
      runtime.selectedObjectId = null;
      runtime.selectionListeners.forEach((listener) => listener({ objectIds: [] }));
    }

    serialize(): Record<string, unknown> {
      return structuredClone(runtime.state);
    }

    async addText(input: {
      id: string;
      value: string;
      accessibleName: string;
      editable?: boolean;
    }): Promise<void> {
      const objects = runtime.state.objects;
      if (!Array.isArray(objects)) throw new Error("Test canvas state has no objects");
      objects.push({
        type: "textbox",
        objectId: input.id,
        elementKind: "text",
        accessibleName: input.accessibleName,
        text: input.value,
        editable: input.editable ?? true
      });
      runtime.listeners.forEach((listener) => listener({
        type: "added",
        objectId: input.id
      }));
    }

    firstArtworkSurfaceAddress(
      productId: string
    ): { productId: string; slotId: string } | null {
      const product = (runtime.state.objects as Array<Record<string, unknown>>)
        .find((candidate) => candidate.objectId === productId);
      if (!product || (product.elementKind !== "product-kit" &&
        product.elementKind !== "product-shell")) return null;
      const slot = (product.objects as Array<Record<string, unknown>> | undefined)
        ?.find((candidate) => candidate.productLayer === "artwork-slot" &&
          typeof candidate.artworkSlotId === "string");
      return typeof slot?.artworkSlotId === "string"
        ? { productId, slotId: slot.artworkSlotId }
        : null;
    }

    firstArtworkTextId(address: {
      productId: string;
      slotId: string;
    }): string | null {
      const { surface } = this.artworkSurface(address);
      const text = (surface.objects as Array<Record<string, unknown>>)
        .find((candidate) => candidate.elementKind === "text" &&
          typeof candidate.objectId === "string");
      return typeof text?.objectId === "string" ? text.objectId : null;
    }

    async addArtworkText(
      address: { productId: string; slotId: string },
      input: { id: string; value: string; accessibleName: string }
    ): Promise<void> {
      const { product, surface } = this.artworkSurface(address);
      const curved = product.productKitId === "pk1-tumbler-kit";
      (surface.objects as Array<Record<string, unknown>>).push(curved
        ? {
            type: "Image",
            objectId: input.id,
            elementKind: "text",
            accessibleName: input.accessibleName,
            curvedTextSource: input.value,
            curvedTextProfile: "cylinder-front",
            curvedTextColour: "#111827",
            curvedTextFontFamily: "Arial",
            src: "data:image/png;base64,iVBORw0KGgo="
          }
        : {
            type: "textbox",
            objectId: input.id,
            elementKind: "text",
            accessibleName: input.accessibleName,
            text: input.value,
            editable: true
          });
      runtime.listeners.forEach((listener) => listener({
        type: "modified",
        objectId: address.productId
      }));
    }

    setArtworkText(
      address: { productId: string; slotId: string },
      id: string,
      value: string
    ): void {
      const { surface } = this.artworkSurface(address);
      const text = (surface.objects as Array<Record<string, unknown>>)
        .find((candidate) => candidate.objectId === id && candidate.elementKind === "text");
      if (!text) throw new Error(`Missing artwork text ${id}`);
      if (text.curvedTextProfile === "cylinder-front") text.curvedTextSource = value;
      else text.text = value;
      runtime.listeners.forEach((listener) => listener({
        type: "modified",
        objectId: address.productId
      }));
    }

    async addRaster(input: NewRasterInput): Promise<void> {
      const objects = runtime.state.objects;
      if (!Array.isArray(objects)) throw new Error("Test canvas state has no objects");
      objects.push({
        type: "image",
        objectId: input.id,
        elementKind: "image",
        assetId: input.assetId,
        accessibleName: input.accessibleName,
        src: new URL(input.sameOriginUrl, window.location.href).href,
        width: 1_024,
        height: 576,
        left: 800,
        top: 450,
        scaleX: 0.625,
        scaleY: 0.625,
        ...(input.sectionFill === undefined ? {} : {
          sourceHash: input.sectionFill.sourceSha256,
          rasterSectionFillSourceUrl: new URL(
            input.sameOriginUrl,
            window.location.href
          ).href,
          rasterSectionFillMode: input.sectionFill.mode,
          rasterSectionFillProfile: input.sectionFill.profile,
          rasterSectionFillRecipes: []
        })
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

    async addProductKit(input: NewProductKitInput): Promise<void> {
      const objects = runtime.state.objects;
      if (!Array.isArray(objects)) throw new Error("Test canvas state has no objects");
      const children: Array<Record<string, unknown>> = [];
      for (const bucket of input.plan.layers) {
        for (const entry of bucket.entries) {
          if (entry.kind === "artwork-slot") {
            children.push({
              type: "group",
              productLayer: "artwork-slot",
              artworkSlotId: entry.itemId,
              objects: [{ type: "rect" }]
            });
            continue;
          }
          const source = input.rasterSources.get(entry.raster.assetId);
          if (!source || source.masterSha256 !== entry.raster.masterSha256) {
            throw new Error("Test Product Kit source mismatch");
          }
          const sourceUrl = new URL(source.masterUrl, window.location.href).href;
          const response = await fetch(sourceUrl, {
            method: "GET",
            credentials: "same-origin",
            headers: { accept: "image/png" }
          });
          const mimeType = response.headers.get("content-type")
            ?.split(";", 1)[0]?.trim().toLowerCase();
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (!response.ok || mimeType !== "image/png" ||
            bytes.length < 8 || ![137, 80, 78, 71, 13, 10, 26, 10]
              .every((value, index) => bytes[index] === value)) {
            throw new Error("Test Product Kit raster was not a PNG");
          }
          children.push({
            type: "image",
            productLayer: bucket.layer,
            src: sourceUrl,
            selectable: false,
            evented: false
          });
        }
      }
      objects.push({
        type: "group",
        objectId: input.id,
        elementKind: "product-kit",
        accessibleName: input.accessibleName,
        productKitPackId: input.catalogue.packId,
        productKitId: input.plan.kitId,
        productKitCatalogSha256: input.catalogue.catalogSha256,
        objects: children
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

    setText(id: string, value: string, accessibleName?: string, editable?: boolean): void {
      const object = (runtime.state.objects as Array<Record<string, unknown>>)
        .find((candidate) => candidate.objectId === id);
      if (!object || object.elementKind !== "text") throw new Error(`${id} is not editable text`);
      object.text = value;
      if (accessibleName !== undefined) object.accessibleName = accessibleName;
      if (editable !== undefined) object.editable = editable;
      runtime.listeners.forEach((listener) => listener({ type: "modified", objectId: id }));
    }

    transform(id: string, patch: {
      x?: number;
      y?: number;
      scaleX?: number;
      scaleY?: number;
      angle?: number;
      flipX?: boolean;
      flipY?: boolean;
    }): void {
      const object = (runtime.state.objects as Array<Record<string, unknown>>)
        .find((candidate) => candidate.objectId === id);
      if (!object) throw new Error(`Missing object ${id}`);
      if (patch.x !== undefined) object.left = patch.x;
      if (patch.y !== undefined) object.top = patch.y;
      if (patch.scaleX !== undefined) object.scaleX = patch.scaleX;
      if (patch.scaleY !== undefined) object.scaleY = patch.scaleY;
      if (patch.angle !== undefined) object.angle = patch.angle;
      if (patch.flipX !== undefined) object.flipX = patch.flipX;
      if (patch.flipY !== undefined) object.flipY = patch.flipY;
      runtime.listeners.forEach((listener) => listener({ type: "modified", objectId: id }));
    }

    remove(id: string): void {
      const objects = runtime.state.objects;
      if (!Array.isArray(objects)) throw new Error("Test canvas state has no objects");
      const index = objects.findIndex((object) =>
        typeof object === "object" && object !== null &&
        (object as Record<string, unknown>).objectId === id);
      if (index >= 0) {
        objects.splice(index, 1);
        if (runtime.selectedObjectId === id) {
          runtime.selectedObjectId = null;
          runtime.selectionListeners.forEach((listener) => listener({ objectIds: [] }));
        }
        runtime.listeners.forEach((listener) => listener({ type: "removed", objectId: id }));
      }
    }

    setSelected(id: string | null): void {
      runtime.selectedObjectId = id;
      runtime.selectionListeners.forEach((listener) => listener({
        objectIds: id === null ? [] : [id]
      }));
    }

    getSelectedObjectId(): string | null {
      return runtime.selectedObjectId;
    }

    listObjectSummaries(): ReadonlyArray<{
      id: string;
      accessibleName: string;
      elementKind: string;
      x: number;
      y: number;
      scaleX: number;
      scaleY: number;
      visible: boolean;
      locked: boolean;
      stackIndex: number;
    }> {
      const objects = runtime.state.objects;
      if (!Array.isArray(objects)) return [];
      return objects.flatMap((candidate, stackIndex) => {
        if (typeof candidate !== "object" || candidate === null) return [];
        const object = candidate as Record<string, unknown>;
        if (typeof object.objectId !== "string" || typeof object.elementKind !== "string") return [];
        return [{
          id: object.objectId,
          accessibleName: typeof object.accessibleName === "string"
            ? object.accessibleName
            : `${object.elementKind} object`,
          elementKind: object.elementKind,
          x: typeof object.left === "number" ? object.left : 0,
          y: typeof object.top === "number" ? object.top : 0,
          scaleX: typeof object.scaleX === "number" ? object.scaleX : 1,
          scaleY: typeof object.scaleY === "number" ? object.scaleY : 1,
          visible: object.visible !== false,
          locked: object.selectable === false,
          stackIndex
        }];
      });
    }

    async getFillableRaster(id: string): Promise<{
      id: string;
      assetId: string;
      sourceSha256: string;
      width: number;
      height: number;
      sectionMode: "connected" | "whole-object";
    } | null> {
      const object = (runtime.state.objects as Array<Record<string, unknown>>)
        .find((candidate) => candidate.objectId === id);
      if (!object ||
        typeof object.assetId !== "string" ||
        typeof object.sourceHash !== "string" ||
        (object.rasterSectionFillMode !== "connected-sections" &&
          object.rasterSectionFillMode !== "whole-object")) return null;
      return {
        id,
        assetId: object.assetId,
        sourceSha256: object.sourceHash,
        width: typeof object.width === "number" ? object.width : 640,
        height: typeof object.height === "number" ? object.height : 480,
        sectionMode: object.rasterSectionFillMode === "connected-sections"
          ? "connected"
          : "whole-object"
      };
    }

    rasterSourcePoint(): { x: number; y: number } {
      return { x: 24, y: 32 };
    }

    async previewRasterSectionFill(
      _id: string,
      recipe: RasterSectionFillRecipe
    ): Promise<void> {
      runtime.sectionFillPreview = structuredClone(recipe);
    }

    cancelRasterSectionFillPreview(): void {
      runtime.sectionFillPreview = null;
    }

    async applyRasterSectionFill(
      id: string,
      recipe: RasterSectionFillRecipe
    ): Promise<void> {
      const object = (runtime.state.objects as Array<Record<string, unknown>>)
        .find((candidate) => candidate.objectId === id);
      if (!object) throw new Error(`Missing object ${id}`);
      const recipes = Array.isArray(object.rasterSectionFillRecipes)
        ? object.rasterSectionFillRecipes
        : [];
      object.rasterSectionFillRecipes = [...recipes, structuredClone(recipe)];
      runtime.sectionFillApplications.push(structuredClone(recipe));
      runtime.listeners.forEach((listener) => listener({ type: "modified", objectId: id }));
    }

    captureSelection(): { readonly objectIds: readonly string[] } {
      return Object.freeze({
        objectIds: Object.freeze(runtime.selectedObjectId === null
          ? []
          : [runtime.selectedObjectId])
      });
    }

    restoreSelection(snapshot: { readonly objectIds: readonly string[] }): void {
      runtime.selectedObjectId = snapshot.objectIds[0] ?? null;
      runtime.selectionListeners.forEach((listener) => listener(snapshot));
    }

    assertCanDuplicate(): void {}

    move(id: string, direction: "front" | "forward" | "backward" | "back"): void {
      const objects = runtime.state.objects;
      if (!Array.isArray(objects)) throw new Error("Test canvas state has no objects");
      const index = objects.findIndex((candidate) =>
        typeof candidate === "object" && candidate !== null &&
        (candidate as Record<string, unknown>).objectId === id);
      if (index < 0) throw new Error(`Missing object ${id}`);
      const [object] = objects.splice(index, 1);
      const target = direction === "front"
        ? objects.length
        : direction === "forward"
          ? Math.min(objects.length, index + 1)
          : direction === "backward"
            ? Math.max(0, index - 1)
            : 0;
      objects.splice(target, 0, object);
      runtime.listeners.forEach((listener) => listener({ type: "modified", objectId: id }));
    }

    setLocked(id: string, locked: boolean): void {
      const object = (runtime.state.objects as Array<Record<string, unknown>>)
        .find((candidate) => candidate.objectId === id);
      if (!object) throw new Error(`Missing object ${id}`);
      object.selectable = !locked;
      object.evented = !locked;
      if (locked && runtime.selectedObjectId === id) this.setSelected(null);
      runtime.listeners.forEach((listener) => listener({ type: "modified", objectId: id }));
    }

    setVisible(id: string, visible: boolean): void {
      const object = (runtime.state.objects as Array<Record<string, unknown>>)
        .find((candidate) => candidate.objectId === id);
      if (!object) throw new Error(`Missing object ${id}`);
      object.visible = visible;
      if (!visible && runtime.selectedObjectId === id) this.setSelected(null);
      runtime.listeners.forEach((listener) => listener({ type: "modified", objectId: id }));
    }

    subscribe(listener: (mutation: {
      type: "added" | "modified" | "removed";
      objectId: string;
    }) => void): () => void {
      runtime.listeners.add(listener);
      return () => runtime.listeners.delete(listener);
    }

    subscribeSelection(
      listener: (selection: { readonly objectIds: readonly string[] }) => void
    ): () => void {
      runtime.selectionListeners.add(listener);
      return () => runtime.selectionListeners.delete(listener);
    }

    exportCleanPngDataUrl(): string {
      return "data:image/png;base64,AA==";
    }

    dispose(): void {
      runtime.adapterDisposed();
      runtime.listeners.clear();
      if (runtime.adapterDisposeFailure) throw runtime.adapterDisposeFailure;
    }

    private artworkSurface(address: {
      productId: string;
      slotId: string;
    }): {
      product: Record<string, unknown>;
      surface: Record<string, unknown>;
    } {
      const product = (runtime.state.objects as Array<Record<string, unknown>>)
        .find((candidate) => candidate.objectId === address.productId);
      const surface = (product?.objects as Array<Record<string, unknown>> | undefined)
        ?.find((candidate) => candidate.artworkSlotId === address.slotId);
      if (!product || !surface || !Array.isArray(surface.objects)) {
        throw new Error("Missing test artwork surface");
      }
      return { product, surface };
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
      async resumeLocalPractice(): Promise<import("./persistence/draft-store").LocalPracticeRecoveryV1 | null> {
        return runtime.activePractice === null
          ? null
          : {
              checkpoint: structuredClone(runtime.activePractice.checkpoint),
              document: structuredClone(runtime.activePractice.document),
              blobs: new Map(runtime.activePractice.blobs)
            };
      }

      async beginLocalPractice(
        input: import("./persistence/draft-store").BeginLocalPracticeInput
      ): Promise<import("./persistence/draft-store").LocalPracticeCheckpointV1> {
        const document = CampaignDocumentSchema.parse(structuredClone(input.document));
        const checkpoint = actual.LocalPracticeCheckpointSchema.parse({
          contract: actual.LOCAL_PRACTICE_CHECKPOINT_CONTRACT,
          runId: input.runId,
          documentId: document.documentId,
          sessionId: document.sessionId,
          teamId: document.teamId,
          teamAlias: input.teamAlias,
          documentRevision: document.revision,
          documentHash: await actual.canonicalDurableDocumentHash(document),
          stage: document.gameplay.stage,
          levelLocked: input.levelLocked,
          sequence: 0,
          operationId: input.operationId,
          savedAt: input.savedAt
        });
        await this.save(document, input.blobs);
        runtime.activePractice = {
          checkpoint,
          document: structuredClone(document),
          blobs: new Map(input.blobs)
        };
        return structuredClone(checkpoint);
      }

      async commitLocalPractice(
        input: import("./persistence/draft-store").CommitLocalPracticeInput
      ): Promise<import("./persistence/draft-store").LocalPracticeCheckpointV1> {
        const active = runtime.activePractice;
        if (active === null ||
          active.checkpoint.documentRevision !== input.expectedDocumentRevision ||
          active.checkpoint.sequence !== input.expectedSequence) {
          throw new Error("Local-practice commit is stale");
        }
        const document = CampaignDocumentSchema.parse(structuredClone(input.document));
        const checkpoint = actual.LocalPracticeCheckpointSchema.parse({
          ...structuredClone(active.checkpoint),
          documentRevision: document.revision,
          documentHash: await actual.canonicalDurableDocumentHash(document),
          stage: document.gameplay.stage,
          levelLocked: input.levelLocked,
          sequence: input.expectedSequence + 1,
          operationId: input.operationId,
          savedAt: input.savedAt
        });
        await this.save(document, input.blobs);
        runtime.activePractice = {
          checkpoint,
          document: structuredClone(document),
          blobs: new Map(input.blobs)
        };
        return structuredClone(checkpoint);
      }

      async importCloudPractice(input: unknown): Promise<void> {
        runtime.importCloudPractice(input);
      }

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

      async loadRevision(documentId: string, revision: number): Promise<{
        document: CampaignDocumentV1;
        blobs: Map<string, Blob>;
      } | null> {
        runtime.loadRevisionDraft(documentId, revision);
        const stored = runtime.revisionDrafts.get(documentId)?.get(revision);
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
        const revisions = runtime.revisionDrafts.get(document.documentId) ?? new Map();
        revisions.set(document.revision, {
          document: structuredClone(durableDocument),
          blobs: new Map([...blobs].map(([key, blob]) => [
            key,
            blob.slice(0, blob.size, blob.type)
          ]))
        });
        runtime.revisionDrafts.set(document.documentId, revisions);
      }
    }
  };
});

vi.mock("./persistence/account-scoped-draft-store", async () => {
  const { IndexedDbDraftStore } = await import("./persistence/draft-store");
  return {
    AccountScopedDraftStore: class extends IndexedDbDraftStore {
      async activateAccount(username: string): Promise<void> {
        await runtime.activateAccountDrafts(username);
      }
      deactivateAccount(): void {
        runtime.deactivateAccountDrafts();
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
blankDocument.gameplay.pair.roleGuideAcknowledged = true;

function documentAtStage(stage: CampaignDocumentV1["gameplay"]["stage"]): CampaignDocumentV1 {
  return CampaignDocumentSchema.parse({
    ...structuredClone(blankDocument),
    gameplay: { ...structuredClone(blankDocument.gameplay), stage }
  });
}

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
  const stored = {
    document: structuredClone(document),
    blobs: new Map([["photo-png", blob]])
  };
  runtime.drafts.set(document.documentId, stored);
  const revisions = runtime.revisionDrafts.get(document.documentId) ?? new Map();
  revisions.set(document.revision, {
    document: structuredClone(document),
    blobs: new Map([["photo-png", blob.slice(0, blob.size, blob.type)]])
  });
  runtime.revisionDrafts.set(document.documentId, revisions);
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
  const namedIcons = [
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
      url: "https://github.com/tabler/tabler-icons"
    },
    icons: [
      ...namedIcons.map(([id, title, category]) => ({
        id,
        title,
        width: 24,
        height: 24,
        categories: [category, "general"],
        body: '<path d="M4 12h16" fill="none" stroke="currentColor" />'
      })),
      ...Array.from({ length: 4_201 }, (_, index) => ({
        id: `zz-fixture-icon-${String(index).padStart(4, "0")}`,
        title: `Fixture Icon ${index}`,
        width: 24,
        height: 24,
        categories: ["general"],
        body: '<path d="M4 12h16" fill="none" stroke="currentColor" />'
      }))
    ]
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

function activateStudioTool(tool: "product" | "assets" | "words" | "logo" | "image" | "price" | "aida" | "coach"): void {
  const tab = document.querySelector<HTMLButtonElement>(`[data-studio-tool="${tool}"]`);
  if (!tab) throw new Error(`Missing Studio tool tab: ${tool}`);
  fireEvent.click(tab);
}

describe("window.AdMarketCreator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    window.history.replaceState(null, "", "/student");
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: <T,>(
          name: string,
          _options: { mode: "exclusive"; ifAvailable: true },
          callback: (lock: { name: string; mode: "exclusive" }) => T | PromiseLike<T>
        ): Promise<T> => Promise.resolve(callback({ name, mode: "exclusive" }))
      }
    });
    runtime.state = { version: "7.4.0", objects: [] };
    runtime.listeners.clear();
    runtime.selectionListeners.clear();
    runtime.drafts.clear();
    runtime.revisionDrafts.clear();
    runtime.activePractice = null;
    runtime.loadFailure = null;
    runtime.loadPromise = null;
    runtime.saveFailure = null;
    runtime.importCloudPractice.mockReset();
    runtime.activateAccountDrafts.mockReset().mockResolvedValue(undefined);
    runtime.deactivateAccountDrafts.mockReset();
    runtime.publishFailure = null;
    runtime.canvasFailure = null;
    runtime.adapterDisposeFailure = null;
    runtime.canvasDisposeFailure = null;
    runtime.canvasDisposePromise = null;
    runtime.selectedObjectId = null;
    runtime.sectionFillPreview = null;
    runtime.sectionFillApplications = [];
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
    Reflect.deleteProperty(window, "AdMarketPractice");
    Reflect.deleteProperty(window, "AdMarketRoom");
    Reflect.deleteProperty(window, "AdMarketAccount");
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: undefined
    });
    localStorage.clear();
    document.body.innerHTML = `
      <main aria-label="Advertising Market Game">
        <canvas id="canvas" tabindex="0"></canvas>
      </main>
      <div id="creator-root"></div>`;
  });

  it("boots the teacher dashboard without constructing the pair account surface", async () => {
    window.history.replaceState(null, "", "/teacher");
    document.body.innerHTML = "";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (input === "/api/teacher/session") {
        return Promise.resolve(Response.json({ authenticated: true }));
      }
      if (input === "/api/teacher/accounts") {
        return Promise.resolve(Response.json({ accounts: [] }));
      }
      if (input === "/api/teacher/image-lab") {
        return Promise.resolve(Response.json({
          enabled: false,
          defaultObjectForgeUses: 0,
          defaultMakeItRealUses: 0,
          accounts: []
        }));
      }
      return Promise.reject(new Error(`Unexpected teacher URL ${String(input)}`));
    });

    await import("./main");

    await waitFor(() => expect(
      getByRole(document.body, "heading", { name: "Classroom accounts" })
    ).toBeTruthy());
    expect(document.querySelector('[data-admarket-route="teacher-dashboard"]')).toBeTruthy();
    expect(document.querySelector("#account-gate-root")).toBeNull();
    expect(document.querySelector("#account-session-root")).toBeNull();
    expect(Reflect.has(window, "AdMarketAccount")).toBe(false);
    expect(Reflect.has(window, "AdMarketCreator")).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("boots the complete teacher playtest through its isolated storage and server adapters", async () => {
    window.history.replaceState(null, "", "/teacher/playtest");
    document.body.innerHTML = `
      <main aria-label="Advertising Market Game" hidden inert aria-hidden="true">
        <canvas id="canvas" tabindex="-1"></canvas>
      </main>
      <div id="creator-root" hidden></div>`;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      if (input === "/api/teacher/session") {
        return Promise.resolve(Response.json({ authenticated: true }));
      }
      if (input === "/api/teacher/playtest/progress") {
        expect(init?.credentials).toBe("same-origin");
        expect(new Headers(init?.headers).has("x-ad-market-account")).toBe(false);
        return Promise.resolve(Response.json({
          schema: "advertising-game-progress",
          version: 1,
          documents: []
        }));
      }
      return Promise.reject(new Error(`Unexpected teacher playtest URL ${String(input)}`));
    });

    await import("./main");

    await waitFor(() => expect(Reflect.has(window, "AdMarketCreator")).toBe(true));
    expect(
      getByRole(document.body, "banner", { name: "Teacher playtest" })
    ).toBeTruthy();
    expect(document.querySelector("#account-gate-root")).toBeNull();
    expect(document.querySelector("#account-session-root")).toBeNull();
    expect(Reflect.has(window, "AdMarketAccount")).toBe(false);
    expect(runtime.activateAccountDrafts).toHaveBeenCalledWith("teacher-playtest");
    expect(document.querySelector<HTMLElement>(
      "main[aria-label=\"Advertising Market Game\"]"
    )?.hidden)
      .toBe(false);
    expect(document.querySelector<HTMLElement>("#creator-root")?.hidden).toBe(false);
    expect(fetchSpy.mock.calls.map(([input]) => input)).toEqual([
      "/api/teacher/session",
      "/api/teacher/playtest/progress"
    ]);
  });

  it("boots the pair route without constructing a teacher surface", async () => {
    await import("./main");

    expect(document.querySelector("[data-admarket-route^=\"teacher-\"]")).toBeNull();
    expect(Reflect.has(window, "AdMarketAccount")).toBe(true);
  });

  it("installs a synchronous mandatory account seam without checking the session until bootstrap asks", async () => {
    document.body.innerHTML = `
      <div id="account-gate-root"></div>
      <section id="account-session-root" hidden></section>
      <main aria-label="Advertising Market Game" hidden inert aria-hidden="true">
        <canvas id="canvas" tabindex="-1"></canvas>
      </main>
      <div id="creator-root" hidden></div>`;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      if (input === "/api/account/session") {
        expect(init).toEqual({
          method: "GET",
          credentials: "same-origin",
          redirect: "error",
          headers: { accept: "application/json" },
          signal: expect.any(AbortSignal)
        });
        return Promise.resolve(Response.json({ authenticated: true, username: "team-one" }));
      }
      expect(input).toBe("/api/account/progress");
      expect(init).toEqual({
        method: "GET",
        credentials: "same-origin",
        redirect: "error",
        headers: { accept: "application/json", "x-admarket-account": "team-one" }
      });
      return Promise.resolve(Response.json({
        schema: "advertising-game-progress",
        version: 1,
        documents: []
      }));
    });

    await import("./main");
    const account = (window as Window & { AdMarketAccount: AccountBootstrapPublicApi })
      .AdMarketAccount;

    expect(Object.isFrozen(account)).toBe(true);
    expect(Reflect.ownKeys(account)).toEqual(["requireAccess"]);
    expect(fetchSpy).not.toHaveBeenCalled();
    await account.requireAccess();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1]).toEqual([
      "/api/account/progress",
      {
        method: "GET",
        credentials: "same-origin",
        redirect: "error",
        headers: { accept: "application/json", "x-admarket-account": "team-one" }
      }
    ]);
    expect(runtime.activateAccountDrafts).toHaveBeenCalledWith("team-one");
    expect(document.querySelector<HTMLElement>('main[aria-label="Advertising Market Game"]')?.hidden)
      .toBe(false);
    expect(document.querySelector<HTMLCanvasElement>("#canvas")?.tabIndex).toBe(0);
    expect(getByRole(document.body, "button", { name: "Sign out" })).toBeTruthy();
    expect(document.body.textContent)
      .toContain("Sign out before another pair uses this device.");
    expect(document.body.textContent).not.toMatch(/teacher setup code/i);
    expect(document.querySelector('[aria-label="Reset account progress"]')).toBeNull();
  }, 15_000);

  it("hands a reused device from pair A to pair B without reopening pair A state", async () => {
    document.body.innerHTML = `
      <div id="account-gate-root"></div>
      <section id="account-session-root" hidden></section>
      <main aria-label="Advertising Market Game" hidden inert aria-hidden="true">
        <canvas id="canvas" tabindex="-1"></canvas>
      </main>
      <div id="creator-root" hidden></div>`;
    let serverAccount: string | null = "team-a";
    const progressIdentities: string[] = [];
    const assetIdentities: string[] = [];
    const pairAAsset = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01
    ]);
    const pairAAssetDigest = createHash("sha256")
      .update(pairAAsset)
      .digest("hex");
    const pairADocument = createBlankCampaignDocument({
      documentId: "team-a-campaign",
      sessionId: "team-a-session",
      teamId: "team-a",
      mode: "offline"
    });
    pairADocument.revision = 1;
    pairADocument.updatedAt = "2026-07-27T01:00:00.000Z";
    pairADocument.fabricState = {
      version: "7.4.0",
      objects: [{
        type: "image",
        objectId: "team-a-image",
        elementKind: "image",
        accessibleName: "Pair A private image",
        src: "local-blob:team-a-private-image"
      }]
    };
    pairADocument.assetReferences = [
      {
        kind: "local-blob",
        objectId: "team-a-image",
        blobKey: "team-a-private-image",
        mimeType: "image/png"
      },
      {
        kind: "cloud-blob",
        objectId: "team-a-image",
        blobKey: "team-a-private-image",
        mimeType: "image/png",
        byteLength: pairAAsset.byteLength,
        sha256: pairAAssetDigest
      }
    ];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      if (input === "/api/account/session") {
        return Promise.resolve(Response.json(serverAccount === null
          ? { authenticated: false }
          : { authenticated: true, username: serverAccount }));
      }
      if (input === "/api/account/logout") {
        expect(new Headers(init?.headers).get("x-admarket-account")).toBe("team-a");
        serverAccount = null;
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (input === "/api/account/login") {
        expect(JSON.parse(String(init?.body))).toEqual({
          username: "team-b",
          password: "different-password"
        });
        serverAccount = "team-b";
        return Promise.resolve(Response.json({
          authenticated: true,
          username: "team-b"
        }));
      }
      if (input === "/api/account/progress") {
        const identity = new Headers(init?.headers).get("x-admarket-account");
        if (identity === null) {
          return Promise.reject(new Error("Missing progress identity"));
        }
        progressIdentities.push(identity);
        return Promise.resolve(Response.json({
          schema: "advertising-game-progress",
          version: 1,
          documents: identity === "team-a"
            ? [{
                documentId: pairADocument.documentId,
                revision: pairADocument.revision,
                updatedAt: pairADocument.updatedAt
              }]
            : []
        }));
      }
      if (input === `/api/account/progress?documentId=${pairADocument.documentId}`) {
        const identity = new Headers(init?.headers).get("x-admarket-account");
        if (identity === null) {
          return Promise.reject(new Error("Missing progress identity"));
        }
        progressIdentities.push(identity);
        return Promise.resolve(Response.json({
          schema: "advertising-game-progress",
          version: 1,
          documentId: pairADocument.documentId,
          revision: pairADocument.revision,
          document: pairADocument,
          updatedAt: pairADocument.updatedAt
        }));
      }
      if (input === `/api/account/assets/${pairAAssetDigest}`) {
        const identity = new Headers(init?.headers).get("x-admarket-account");
        if (identity === null) {
          return Promise.reject(new Error("Missing asset identity"));
        }
        assetIdentities.push(identity);
        return Promise.resolve(new Response(pairAAsset, {
          headers: {
            "content-type": "image/png",
            "content-length": String(pairAAsset.byteLength)
          }
        }));
      }
      return Promise.reject(new Error(`Unexpected account URL ${String(input)}`));
    });

    await import("./main");
    await window.AdMarketAccount.requireAccess();
    expect(runtime.activateAccountDrafts).toHaveBeenLastCalledWith("team-a");
    expect(document.querySelector("[data-account-cloud-status]")?.textContent)
      .toBe("Cloud save restored to this device · revision 1");
    expect(runtime.importCloudPractice).toHaveBeenCalledOnce();

    fireEvent.click(getByRole(document.body, "button", { name: "Sign out" }));
    await waitFor(() => expect(fetchSpy.mock.calls.some(
      ([input]) => input === "/api/account/logout"
    )).toBe(true));
    await waitFor(() => expect(runtime.deactivateAccountDrafts).toHaveBeenCalled());
    expect(serverAccount).toBeNull();

    vi.resetModules();
    Reflect.deleteProperty(window, "AdMarketCreator");
    Reflect.deleteProperty(window, "AdMarketPractice");
    Reflect.deleteProperty(window, "AdMarketRoom");
    Reflect.deleteProperty(window, "AdMarketAccount");
    document.body.innerHTML = `
      <main aria-label="Advertising Market Game">
        <canvas id="canvas" tabindex="0"></canvas>
      </main>
      <div id="creator-root"></div>`;
    await import("./main");
    const secondAccess = window.AdMarketAccount.requireAccess();
    const login = await findByRole(document.body, "form", { name: "Log in" });
    expect(document.querySelector<HTMLElement>(
      'main[aria-label="Advertising Market Game"]'
    )?.hidden).toBe(true);
    expect(document.body.textContent).not.toContain("Signed in as team-a");
    getByLabelText<HTMLInputElement>(login, "Username").value = "team-b";
    getByLabelText<HTMLInputElement>(login, "Password").value = "different-password";
    fireEvent.submit(login);
    await secondAccess;

    expect(runtime.activateAccountDrafts.mock.calls.map(([username]) => username))
      .toEqual(["team-a", "team-b"]);
    expect(progressIdentities).toEqual(["team-a", "team-a", "team-b"]);
    expect(assetIdentities).toEqual(["team-a"]);
    expect(runtime.importCloudPractice).toHaveBeenCalledOnce();
    expect(runtime.importCloudPractice.mock.calls[0]?.[0]).toMatchObject({
      teamAlias: "team-a",
      document: pairADocument
    });
    expect(document.querySelector("[data-account-cloud-status]")?.textContent)
      .toBe("Progress saves on this device first.");
    expect(document.body.textContent).toContain("Signed in as team-b");
    expect(document.body.textContent).not.toContain("Signed in as team-a");
  }, 20_000);

  it("restores a newest cloud-only practice before unlocking the account", async () => {
    document.body.innerHTML = `
      <div id="account-gate-root"></div>
      <section id="account-session-root" hidden></section>
      <main aria-label="Advertising Market Game" hidden inert aria-hidden="true">
        <canvas id="canvas" tabindex="-1"></canvas>
      </main>
      <div id="creator-root" hidden></div>`;
    const cloudDocument = createBlankCampaignDocument({
      documentId: "practice-document-cloud",
      sessionId: "practice-session-cloud",
      teamId: "practice-team-cloud",
      mode: "offline"
    });
    cloudDocument.revision = 3;
    cloudDocument.updatedAt = "2026-07-17T05:00:00.000Z";
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (input === "/api/account/session") {
        return Promise.resolve(Response.json({ authenticated: true, username: "team-one" }));
      }
      if (input === "/api/account/progress") {
        return Promise.resolve(Response.json({
          schema: "advertising-game-progress",
          version: 1,
          documents: [{
            documentId: cloudDocument.documentId,
            revision: 6,
            updatedAt: "2026-07-17T05:05:00.000Z"
          }]
        }));
      }
      if (input === `/api/account/progress?documentId=${cloudDocument.documentId}`) {
        return Promise.resolve(Response.json({
          schema: "advertising-game-progress",
          version: 1,
          documentId: cloudDocument.documentId,
          revision: 6,
          document: cloudDocument,
          updatedAt: "2026-07-17T05:05:00.000Z"
        }));
      }
      return Promise.reject(new Error(`Unexpected request ${String(input)}`));
    });

    await import("./main");
    await (window as Window & { AdMarketAccount: AccountBootstrapPublicApi })
      .AdMarketAccount.requireAccess();

    expect(runtime.importCloudPractice).toHaveBeenCalledOnce();
    expect(runtime.importCloudPractice.mock.calls[0]?.[0]).toMatchObject({
      teamAlias: "team-one",
      document: cloudDocument,
      blobs: new Map(),
      levelLocked: false
    });
    expect(document.querySelector<HTMLElement>("[data-account-cloud-status]")?.textContent)
      .toBe("Cloud save restored to this device · revision 6");
    expect(document.querySelector<HTMLElement>('main[aria-label="Advertising Market Game"]')?.hidden)
      .toBe(false);
  });

  it("isolates activated storage and returns to login if cloud recovery discovers an expired session", async () => {
    document.body.innerHTML = `
      <div id="account-gate-root"></div>
      <section id="account-session-root" hidden></section>
      <main aria-label="Advertising Market Game" hidden inert aria-hidden="true">
        <canvas id="canvas" tabindex="-1"></canvas>
      </main>
      <div id="creator-root" hidden></div>`;
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      if (input === "/api/account/session") {
        return Promise.resolve(Response.json({ authenticated: true, username: "team-one" }));
      }
      if (input === "/api/account/progress") {
        return Promise.resolve(Response.json(
          { error: "AUTHENTICATION_REQUIRED" },
          { status: 401 }
        ));
      }
      return Promise.reject(new Error(`Unexpected request ${String(input)}`));
    });

    await import("./main");
    void (window as Window & { AdMarketAccount: AccountBootstrapPublicApi })
      .AdMarketAccount.requireAccess();

    await waitFor(() => expect(getByRole(document.body, "form", { name: "Log in" })).toBeTruthy());
    expect(runtime.deactivateAccountDrafts).toHaveBeenCalledOnce();
    expect(document.querySelector<HTMLElement>('main[aria-label="Advertising Market Game"]')?.hidden)
      .toBe(true);
    expect(getByRole(document.body, "alert").textContent)
      .toBe("Your session ended. Log in again to reconnect your private save.");
  });

  it("installs frozen creator, practice and market seams while keeping Fabric lazy", async () => {
    await import("./main");
    const api = (window as Window & { AdMarketCreator: CreatorPublicApi }).AdMarketCreator;
    const practice = (window as Window & { AdMarketPractice: PracticePublicApi }).AdMarketPractice;
    const market = (window as Window & { AdMarketRoom: MarketPublicApi }).AdMarketRoom;

    expect(Object.isFrozen(api)).toBe(true);
    expect(Reflect.ownKeys(api)).toEqual(["handle", "showMessage"]);
    expect(Object.isFrozen(practice)).toBe(true);
    expect(Reflect.ownKeys(practice)).toEqual(["handle"]);
    expect(Object.isFrozen(market)).toBe(true);
    expect(Reflect.ownKeys(market)).toEqual(["handle"]);
    expect(market).not.toBe(api);
    expect(practice).not.toBe(api);
    expect(practice).not.toBe(market);
    expect("AdMarketCreatorSpike" in window).toBe(false);
    expect(runtime.canvasConstructed).not.toHaveBeenCalled();

    expect(api.showMessage("Draft kept open. Try Return again.")).toBe(true);
    expect(document.querySelector('[data-live="assertive"]')?.textContent)
      .toBe("Draft kept open. Try Return again.");

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
  }, 20_000);

  it("resizes the studio panes without changing serialized canvas state", async () => {
    const documentWithCanvasObject = CampaignDocumentSchema.parse({
      ...structuredClone(blankDocument),
      fabricState: {
        version: "7.4.0",
        objects: [{
          type: "textbox",
          objectId: "split-pane-heading",
          elementKind: "text",
          accessibleName: "Campaign heading",
          text: "Make room for adventure",
          left: 320,
          top: 180,
          scaleX: 1.25,
          scaleY: 1.25
        }]
      }
    });
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-split-pane", "open", documentWithCanvasObject))
      .toMatchObject({ ok: true });
    const before = await parsed(api, "state-before-split", "getState", null);
    const separator = getByRole<HTMLElement>(document.body, "separator", {
      name: "Resize the library and design areas"
    });
    const workspace = document.querySelector<HTMLElement>(".creator__workspace")!;

    fireEvent.keyDown(separator, { key: "End" });

    expect(workspace.style.getPropertyValue("--studio-browse-percent")).toBe("75%");
    const after = await parsed(api, "state-after-split", "getState", null);
    expect(after).toMatchObject({ ok: true });
    if (!before.ok || !after.ok) throw new Error("Split-pane state request failed");
    expect(CampaignDocumentSchema.parse(after.payload).fabricState)
      .toEqual(CampaignDocumentSchema.parse(before.payload).fabricState);
  });

  it("fits and refreshes the Fabric display when the design pane resizes", async () => {
    const observers: Array<{
      callback: ResizeObserverCallback;
      targets: Element[];
    }> = [];
    class TestResizeObserver {
      readonly #record: {
        callback: ResizeObserverCallback;
        targets: Element[];
      };

      constructor(callback: ResizeObserverCallback) {
        this.#record = { callback, targets: [] };
        observers.push(this.#record);
      }

      observe(target: Element): void {
        this.#record.targets.push(target);
      }

      unobserve(): void {}

      disconnect(): void {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: TestResizeObserver
    });
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-resize-observer", "open", blankDocument))
      .toMatchObject({ ok: true });
    const canvasRegion = getByRole<HTMLElement>(document.body, "region", {
      name: "Campaign canvas"
    });
    const canvasObserver = observers.find(({ targets }) => targets.includes(canvasRegion));
    if (!canvasObserver) throw new Error("Canvas ResizeObserver was not installed");

    canvasObserver.callback([{
      target: canvasRegion,
      contentRect: { width: 900, height: 500 } as DOMRectReadOnly
    } as unknown as ResizeObserverEntry], {} as ResizeObserver);

    expect({
      width: canvasRegion.style.getPropertyValue("--studio-canvas-display-width"),
      calcOffsetCalls: runtime.canvasCalcOffset.mock.calls.length,
      renderCalls: runtime.canvasRequestRenderAll.mock.calls.length
    }).toEqual({
      width: "832px",
      calcOffsetCalls: 1,
      renderCalls: 1
    });
  });

  it("returns the latest matching draft without opening the editor", async () => {
    const latest = structuredClone(blankDocument);
    latest.revision = 4;
    runtime.drafts.set(latest.documentId, { document: latest, blobs: new Map() });
    await import("./main");
    const api = window.AdMarketCreator;

    expect(await parsed(api, "latest-found", "loadLatest", {
      documentId: latest.documentId
    })).toEqual({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "latest-found",
      ok: true,
      payload: latest
    });
    expect(await parsed(api, "latest-missing", "loadLatest", {
      documentId: "missing-document"
    })).toEqual({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "latest-missing",
      ok: true,
      payload: null
    });
    expect(runtime.loadDraft).toHaveBeenCalledTimes(2);
    expect(runtime.canvasConstructed).not.toHaveBeenCalled();
  });

  it("lets students resize and fill the ad with the selected product image as undoable changes", async () => {
    const documentWithImage = CampaignDocumentSchema.parse({
      ...structuredClone(blankDocument),
      fabricState: {
        version: "7.4.0",
        objects: [{
          type: "image",
          objectId: "zoom-image",
          elementKind: "image",
          accessibleName: "Orbit tumbler",
          assetId: "orbit-tumbler",
          src: "/catalog/orbit.png",
          width: 800,
          height: 600,
          left: 400,
          top: 300,
          scaleX: 0.5,
          scaleY: 0.5
        }]
      }
    });
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-zoom", "open", documentWithImage))
      .toMatchObject({ ok: true });
    runtime.selectedObjectId = "zoom-image";

    fireEvent.click(getByRole(document.body, "button", {
      name: "Make selected product or image larger"
    }));
    await waitFor(() => {
      expect(currentObjects()[0]).toMatchObject({ scaleX: 0.6, scaleY: 0.6 });
      expect(document.querySelector('[data-canvas-zoom-status]')?.textContent)
        .toBe("Size 60% · drag to position");
    });

    fireEvent.click(getByRole(document.body, "button", {
      name: "Make selected product or image smaller"
    }));
    await waitFor(() => expect(currentObjects()[0]).toMatchObject({
      scaleX: 0.5,
      scaleY: 0.5
    }));

    fireEvent.click(getByRole(document.body, "button", { name: "Fill ad with selected image" }));
    await waitFor(() => {
      expect(currentObjects()[0]).toMatchObject({
        left: 800,
        top: 450,
        scaleX: 2,
        scaleY: 2
      });
      expect(document.querySelector('[data-canvas-zoom-status]')?.textContent)
        .toBe("Ad filled · drag to choose the crop");
    });

    fireEvent.click(getByRole(document.body, "button", { name: "Undo" }));
    await waitFor(() => expect(currentObjects()[0]).toMatchObject({
      left: 400,
      top: 300,
      scaleX: 0.5,
      scaleY: 0.5
    }));
  });

  it("keeps the guided instruction synchronized with persisted campaign progress", async () => {
    const source = documentAtStage("sell");
    source.brief.targetAudienceId = AUDIENCE_BRIEFS[0].id;
    source.product.name = "Study Flask";
    source.product.build = {
      schema: "product-build@1",
      primaryObjectId: "placed-product",
      packId: "pack-1",
      pricingVersion: 1,
      blueprintId: "tumbler",
      selections: [{ groupId: "body", choiceIds: ["steel"] }],
      costLines: [{
        groupId: "body",
        groupLabel: "Material",
        kind: "material",
        choiceId: "steel",
        label: "Insulated steel",
        costCents: 3500
      }],
      unitCostCents: 3500
    };
    source.gameplay.pair.handoffCount = 1;
    source.gameplay.pair.artDirectorActions = 1;
    source.gameplay.pair.strategistActions = 1;
    source.fabricState.objects = [{
      type: "group",
      objectId: "placed-product",
      elementKind: "product-kit",
      accessibleName: "Study Flask",
      objects: []
    }];
    await import("./main");
    const api = window.AdMarketCreator;

    expect(await parsed(api, "open-guided", "open", source)).toMatchObject({ ok: true });

    const guide = getByRole(document.body, "region", { name: "Current instruction" });
    expect(guide.textContent).toContain("Step 5 of 11");
    expect(guide.textContent).toContain("Attention");
    expect(document.querySelector<HTMLButtonElement>("[data-slot=interest]")!.disabled)
      .toBe(true);
    fireEvent.click(getByRole(guide, "button", { name: "Open Attention" }));
    expect(document.querySelector<HTMLButtonElement>('[data-studio-tool="aida"]')
      ?.getAttribute("aria-selected")).toBe("true");

    runtime.selectedObjectId = "placed-product";
    const idea = getByRole<HTMLTextAreaElement>(document.body, "textbox", {
      name: "Your Attention move"
    });
    fireEvent.input(idea, { target: { value: "Use a close product image as the focal point." } });
    fireEvent.click(getByRole(document.body, "button", { name: "Lock in Attention" }));

    await waitFor(() => expect(guide.textContent).toContain("Step 6 of 11"));
    expect(guide.textContent).toContain("Interest");
    expect(document.querySelector<HTMLButtonElement>("[data-slot=attention]")!.disabled)
      .toBe(false);
    expect(document.querySelector<HTMLButtonElement>("[data-slot=interest]")!.disabled)
      .toBe(false);
    expect(document.querySelector<HTMLButtonElement>("[data-slot=desire]")!.disabled)
      .toBe(true);

    expect(await parsed(api, "close-guided", "close", null)).toMatchObject({ ok: true });
    expect(document.querySelector<HTMLElement>("[data-guide]")!.hidden).toBe(true);
  });

  it("requires the role guide once and persists acknowledgement before work begins", async () => {
    const firstEntry = createBlankCampaignDocument({
      documentId: "first-role-guide",
      sessionId: "first-role-guide-session",
      mode: "offline"
    });
    await import("./main");
    const api = window.AdMarketCreator;

    expect(await parsed(api, "open-first-role-guide", "open", firstEntry))
      .toMatchObject({ ok: true });
    const dialog = getByRole(document.body, "dialog", { name: "Partner role guide" });
    expect(dialog.textContent).toContain("The Art Director begins with control.");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(dialog.closest<HTMLElement>("[data-role-guide-layer]")?.hidden).toBe(false);

    fireEvent.click(getByRole(dialog, "button", { name: "Begin work" }));
    const state = await parsed(api, "role-guide-state", "getState", null);
    expect(state.payload).toMatchObject({
      gameplay: { pair: { roleGuideAcknowledged: true } }
    });
    expect(document.activeElement).toBe(
      document.querySelector<HTMLButtonElement>("[data-guide-open-tool]")
    );

    expect(await parsed(api, "close-first-role-guide", "close", null))
      .toMatchObject({ ok: true });
    expect(await parsed(api, "reopen-first-role-guide", "open", state.payload))
      .toMatchObject({ ok: true });
    expect(document.querySelector<HTMLElement>("[data-role-guide-layer]")?.hidden).toBe(true);
  });

  it("makes keyboard canvas movement one undoable document change", async () => {
    const documentWithText = CampaignDocumentSchema.parse({
      ...structuredClone(blankDocument),
      fabricState: {
        version: "7.4.0",
        objects: [{
          type: "textbox",
          objectId: "keyboard-heading",
          elementKind: "text",
          accessibleName: "Keyboard heading",
          text: "Try something new",
          left: 100,
          top: 200,
          scaleX: 1,
          scaleY: 1
        }]
      }
    });
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-keyboard", "open", documentWithText))
      .toMatchObject({ ok: true });
    runtime.selectedObjectId = "keyboard-heading";

    const canvasRegion = getByRole(document.body, "region", { name: "Campaign canvas" });
    expect(canvasRegion.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(canvasRegion, { key: "ArrowRight" });

    await waitFor(() => {
      expect(currentObjects()[0]).toMatchObject({ left: 105, top: 200 });
      expect(document.querySelector('[data-live="polite"]')?.textContent)
        .toBe("Keyboard heading updated.");
    });

    fireEvent.click(getByRole(document.body, "button", { name: "Undo" }));
    await waitFor(() => expect(currentObjects()[0]).toMatchObject({ left: 100, top: 200 }));
  });

  it("deletes one selected item and restores its full state, order and selection through history", async () => {
    const originalHeading = {
      type: "textbox",
      objectId: "sale-heading",
      elementKind: "text",
      accessibleName: "Sale heading",
      text: "Try something new",
      left: 310,
      top: 185,
      scaleX: 1.4,
      scaleY: 0.8,
      angle: 12,
      flipX: true,
      flipY: false,
      visible: true,
      selectable: true,
      evented: true
    };
    const documentWithText = CampaignDocumentSchema.parse({
      ...structuredClone(blankDocument),
      fabricState: {
        version: "7.4.0",
        objects: [{
          type: "rect",
          objectId: "background",
          elementKind: "shape",
          accessibleName: "Blue background",
          left: 0,
          top: 0,
          scaleX: 1,
          scaleY: 1
        }, originalHeading]
      }
    });
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-delete", "open", documentWithText))
      .toMatchObject({ ok: true });
    runtime.selectedObjectId = "sale-heading";
    runtime.selectionListeners.forEach((listener) => listener({
      objectIds: ["sale-heading"]
    }));

    const deleteButton = getByRole<HTMLButtonElement>(
      document.body,
      "button",
      { name: "Delete selected item" }
    );
    expect(deleteButton.disabled).toBe(false);
    expect(deleteButton.getAttribute("aria-description"))
      .toBe("Delete Sale heading from the ad.");
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(currentObjects().map(({ objectId }) => objectId)).toEqual(["background"]);
      expect(runtime.selectedObjectId).toBeNull();
      expect(document.querySelector('[data-live="polite"]')?.textContent)
        .toBe("Sale heading deleted.");
    });

    fireEvent.click(getByRole(document.body, "button", { name: "Undo" }));
    await waitFor(() => {
      expect(currentObjects().map(({ objectId }) => objectId))
        .toEqual(["background", "sale-heading"]);
      expect(currentObjects()[1]).toEqual(originalHeading);
      expect(runtime.selectedObjectId).toBe("sale-heading");
    });

    fireEvent.click(getByRole(document.body, "button", { name: "Redo" }));
    await waitFor(() => {
      expect(currentObjects().map(({ objectId }) => objectId)).toEqual(["background"]);
      expect(runtime.selectedObjectId).toBeNull();
    });
  });

  it("previews, cancels and applies one eligible raster section fill through history", async () => {
    const hash = "a".repeat(64);
    const documentWithStarter = CampaignDocumentSchema.parse({
      ...structuredClone(blankDocument),
      fabricState: {
        version: "7.4.0",
        objects: [{
          type: "image",
          objectId: "starter-1",
          elementKind: "image",
          assetId: "shoe-starter",
          accessibleName: "Harbour shoe",
          src: "/catalog/generated/offline-core-v1/assets/shoe-starter/master.png",
          width: 640,
          height: 480,
          left: 800,
          top: 450,
          scaleX: 1,
          scaleY: 1,
          sourceHash: hash,
          rasterSectionFillSourceUrl:
            "/catalog/generated/offline-core-v1/assets/shoe-starter/master.png",
          rasterSectionFillMode: "connected-sections",
          rasterSectionFillProfile: "bounded-linework-v1",
          rasterSectionFillRecipes: []
        }]
      }
    });
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-fill", "open", documentWithStarter))
      .toMatchObject({ ok: true });
    runtime.selectedObjectId = "starter-1";
    runtime.selectionListeners.forEach((listener) => listener({
      objectIds: ["starter-1"]
    }));
    const fillPanel = document.querySelector<HTMLElement>("[data-section-fill-panel]")!;
    await waitFor(() => {
      expect(fillPanel.hidden).toBe(false);
      expect(getByRole(fillPanel, "button", { name: "Fill section" })).toBeTruthy()
    });

    fireEvent.click(getByRole(fillPanel, "button", { name: "Fill section" }));
    fireEvent.click(getByRole(document.body, "region", { name: "Campaign canvas" }), {
      clientX: 300,
      clientY: 240
    });
    await waitFor(() => expect(runtime.sectionFillPreview).toMatchObject({
      sourceAssetId: "shoe-starter",
      seedX: 24,
      seedY: 32,
      colour: "#E4572E"
    }));
    expect(getByRole<HTMLButtonElement>(document.body, "button", { name: "Undo" }).disabled)
      .toBe(true);
    expect(getByRole<HTMLButtonElement>(
      document.body,
      "button",
      { name: "Delete selected item" }
    ).disabled).toBe(true);

    fireEvent.click(getByRole(fillPanel, "button", { name: "Cancel fill" }));
    await waitFor(() => expect(runtime.sectionFillPreview).toBeNull());
    expect(currentObjects()[0]!.rasterSectionFillRecipes).toEqual([]);

    fireEvent.click(getByRole(fillPanel, "button", { name: "Fill section" }));
    fireEvent.click(getByRole(document.body, "region", { name: "Campaign canvas" }), {
      clientX: 300,
      clientY: 240
    });
    await waitFor(() =>
      expect(getByRole(fillPanel, "button", { name: "Apply fill" })).toBeTruthy()
    );
    fireEvent.click(getByRole(fillPanel, "button", { name: "Apply fill" }));
    await waitFor(() => {
      expect(currentObjects()[0]!.rasterSectionFillRecipes).toHaveLength(1);
      expect(getByRole<HTMLButtonElement>(
        document.body,
        "button",
        { name: "Undo" }
      ).disabled).toBe(false);
    });

    fireEvent.click(getByRole(document.body, "button", { name: "Undo" }));
    await waitFor(() => expect(currentObjects()[0]!.rasterSectionFillRecipes).toEqual([]));
    fireEvent.click(getByRole(document.body, "button", { name: "Redo" }));
    await waitFor(() =>
      expect(currentObjects()[0]!.rasterSectionFillRecipes).toHaveLength(1)
    );
  });

  it("keeps the active practice revision when undoing after autosaves", async () => {
    await import("./main");
    const api = window.AdMarketCreator;
    const practice = (window as Window & { AdMarketPractice: PracticePublicApi }).AdMarketPractice;
    const begun = JSON.parse(await practice.handle(JSON.stringify({
      contract: "practice-run@1",
      requestId: "begin-history-autosave",
      method: "begin",
      payload: {
        teamAlias: "History Pair",
        operationId: "operation-history-autosave"
      }
    }))) as {
      ok: boolean;
      payload: { document: CampaignDocumentV1 };
    };
    expect(begun).toMatchObject({ ok: true });
    const documentWithText = CampaignDocumentSchema.parse({
      ...structuredClone(begun.payload.document),
      fabricState: {
        version: "7.4.0",
        objects: [{
          type: "textbox",
          objectId: "practice-history-heading",
          elementKind: "text",
          accessibleName: "Practice history heading",
          text: "Keep moving",
          left: 100,
          top: 200,
          scaleX: 1,
          scaleY: 1
        }]
      }
    });
    expect(await parsed(api, "open-history-autosave", "open", documentWithText))
      .toMatchObject({ ok: true });
    runtime.selectedObjectId = "practice-history-heading";
    const canvasRegion = getByRole(document.body, "region", { name: "Campaign canvas" });

    fireEvent.keyDown(canvasRegion, { key: "ArrowRight" });
    await waitFor(() => expect(currentObjects()[0]).toMatchObject({ left: 105 }));
    expect(await parsed(api, "save-history-one", "getState", null))
      .toMatchObject({ ok: true, payload: { revision: 1 } });

    fireEvent.keyDown(canvasRegion, { key: "ArrowRight" });
    await waitFor(() => expect(currentObjects()[0]).toMatchObject({ left: 110 }));
    expect(await parsed(api, "save-history-two", "getState", null))
      .toMatchObject({ ok: true, payload: { revision: 2 } });

    fireEvent.click(getByRole(document.body, "button", { name: "Undo" }));
    await waitFor(() => expect(currentObjects()[0]).toMatchObject({ left: 105 }));
    const afterUndo = await parsed(api, "save-history-undo", "getState", null);
    expect(afterUndo)
      .toMatchObject({ ok: true, payload: { revision: 3 } });
    expect(document.querySelector("[data-save-status]")?.textContent).not.toBe("Save paused");
  });

  it("keeps a practice revision adopted while a queued undo is loading", async () => {
    await import("./main");
    const api = window.AdMarketCreator;
    const practice = (window as Window & { AdMarketPractice: PracticePublicApi }).AdMarketPractice;
    const begun = JSON.parse(await practice.handle(JSON.stringify({
      contract: "practice-run@1",
      requestId: "begin-queued-history-autosave",
      method: "begin",
      payload: {
        teamAlias: "Queued History Pair",
        operationId: "operation-queued-history-autosave"
      }
    }))) as {
      ok: boolean;
      payload: { document: CampaignDocumentV1 };
    };
    expect(begun).toMatchObject({ ok: true });
    const documentWithText = CampaignDocumentSchema.parse({
      ...structuredClone(begun.payload.document),
      fabricState: {
        version: "7.4.0",
        objects: [{
          type: "textbox",
          objectId: "queued-practice-history-heading",
          elementKind: "text",
          accessibleName: "Queued practice history heading",
          text: "Keep queueing",
          left: 100,
          top: 200,
          scaleX: 1,
          scaleY: 1
        }]
      }
    });
    expect(await parsed(api, "open-queued-history-autosave", "open", documentWithText))
      .toMatchObject({ ok: true });
    runtime.selectedObjectId = "queued-practice-history-heading";
    const canvasRegion = getByRole(document.body, "region", { name: "Campaign canvas" });
    const undo = getByRole(document.body, "button", { name: "Undo" });

    for (const [requestId, revision] of [
      ["save-queued-history-one", 1],
      ["save-queued-history-two", 2],
      ["save-queued-history-three", 3]
    ] as const) {
      fireEvent.keyDown(canvasRegion, { key: "ArrowRight" });
      await waitFor(() => expect(currentObjects()[0]).toMatchObject({
        left: 100 + (revision * 5)
      }));
      expect(await parsed(api, requestId, "getState", null))
        .toMatchObject({ ok: true, payload: { revision } });
    }

    fireEvent.click(undo);
    await waitFor(() => expect(currentObjects()[0]).toMatchObject({ left: 110 }));

    let releaseQueuedLoad!: () => void;
    runtime.loadPromise = new Promise<void>((resolve) => {
      releaseQueuedLoad = resolve;
    });
    const loadCallsBeforeQueuedUndo = runtime.load.mock.calls.length;
    fireEvent.click(undo);
    await waitFor(() => expect(runtime.load).toHaveBeenCalledTimes(loadCallsBeforeQueuedUndo + 1));
    await waitFor(() => expect(runtime.activePractice?.document.revision).toBe(4));

    releaseQueuedLoad();
    runtime.loadPromise = null;
    await waitFor(() => expect(currentObjects()[0]).toMatchObject({ left: 105 }));
    await waitFor(() => expect(runtime.activePractice?.document.revision).toBe(5));
    expect(document.querySelector("[data-save-status]")?.textContent).not.toBe("Save paused");
  });

  it("starts and clears one Studio Coach session with the open Level 2 campaign", async () => {
    await import("./main");
    const api = (window as Window & { AdMarketCreator: CreatorPublicApi }).AdMarketCreator;
    const source = documentAtStage("sell");
    source.product.name = "Orbit Tumbler";
    source.product.priceCents = 2400;

    expect(await parsed(api, "open-coach", "open", source)).toMatchObject({ ok: true });
    activateStudioTool("coach");

    expect(getByRole(document.body, "button", { name: "Check this technique (1 of 2)" }))
      .toBeTruthy();
    expect(document.querySelector('[data-studio-tool="coach"]')?.getAttribute("aria-selected"))
      .toBe("true");

    expect(await parsed(api, "close-coach", "close", null)).toMatchObject({ ok: true });
    expect(document.querySelector('[data-studio-coach-panel]')?.textContent)
      .not.toContain("Check this technique");
  });

  it("installs the recovery seam before an unrelated Studio initializer can fail", async () => {
    const originalFetch = globalThis.fetch;
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: undefined
    });
    try {
      await expect(import("./main")).rejects.toThrow();
      const practice = (window as Window & { AdMarketPractice?: PracticePublicApi }).AdMarketPractice;
      expect(practice).toBeDefined();
      expect(Object.isFrozen(practice)).toBe(true);
      expect(JSON.parse(await practice!.handle(JSON.stringify({
        contract: "practice-run@1",
        requestId: "startup-failure-resume",
        method: "resume",
        payload: null
      })))).toMatchObject({
        contract: "practice-run@1",
        requestId: "startup-failure-resume",
        ok: true,
        payload: null
      });
    } finally {
      Object.defineProperty(globalThis, "fetch", {
        configurable: true,
        writable: true,
        value: originalFetch
      });
    }
  });

  it("locks an AIDA move to the selected canvas piece as publish evidence", async () => {
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-aida-evidence", "open", documentAtStage("sell")))
      .toMatchObject({ ok: true });

    const words = document.querySelector<HTMLInputElement>("[data-canvas-words]")!;
    words.value = "Carry the hour with you";
    fireEvent.click(document.querySelector<HTMLButtonElement>("[data-add-words]")!);
    await waitFor(() => expect(currentObjects()).toHaveLength(1));
    const selectedObjectId = String(currentObjects()[0]!.objectId);
    expect(runtime.selectedObjectId).toBe(selectedObjectId);
    activateStudioTool("aida");

    const idea = getByRole<HTMLTextAreaElement>(document.body, "textbox", {
      name: "Your Attention move"
    });
    fireEvent.input(idea, {
      target: { value: "Lead with one bold promise that breaks the pattern." }
    });
    fireEvent.click(getByRole(document.body, "button", { name: "Lock in Attention" }));

    await waitFor(() => expect(document.querySelector<HTMLElement>(
      "[data-aida-playbook-panel] [role=status]"
    )?.textContent).toContain("Attention move locked to the selected canvas piece"));
    const response = await parsed(api, "state-aida-evidence", "getState", null);
    if (!response.ok) throw new Error(JSON.stringify(response.error));
    const state = CampaignDocumentSchema.parse(response.payload);
    expect(state.strategy.aidaPlan.attention)
      .toBe("Lead with one bold promise that breaks the pattern.");
    expect(state.evidence.attention).toEqual([selectedObjectId]);
  });

  it("preserves a selected placed product when the pair opens AIDA and locks Attention", async () => {
    const source = documentAtStage("sell");
    source.fabricState.objects = [{
      type: "group",
      objectId: "placed-product",
      elementKind: "product-kit",
      accessibleName: "Placed product",
      objects: []
    }];
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-selected-product", "open", source))
      .toMatchObject({ ok: true });
    runtime.selectedObjectId = "placed-product";
    runtime.selectionListeners.forEach((listener) => listener({
      objectIds: ["placed-product"]
    }));
    expect(document.querySelector('[data-canvas-zoom-status]')?.textContent)
      .toBe("Selected: Placed product");

    activateStudioTool("aida");

    expect(runtime.selectedObjectId).toBe("placed-product");
    const idea = getByRole<HTMLTextAreaElement>(document.body, "textbox", {
      name: "Your Attention move"
    });
    fireEvent.input(idea, {
      target: { value: "Use the product close-up as the first focal point." }
    });
    fireEvent.click(getByRole(document.body, "button", { name: "Lock in Attention" }));

    await waitFor(() => expect(document.querySelector<HTMLElement>(
      "[data-aida-playbook-panel] [role=status]"
    )?.textContent).toContain("Attention move locked to the selected canvas piece"));
    const response = await parsed(api, "state-selected-product", "getState", null);
    if (!response.ok) throw new Error(JSON.stringify(response.error));
    const state = CampaignDocumentSchema.parse(response.payload);
    expect(state.evidence.attention).toEqual(["placed-product"]);
  });

  it("keeps an AIDA move unlocked until the pair selects canvas proof", async () => {
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-aida-no-selection", "open", documentAtStage("sell")))
      .toMatchObject({ ok: true });
    activateStudioTool("aida");

    const idea = getByRole<HTMLTextAreaElement>(document.body, "textbox", {
      name: "Your Attention move"
    });
    fireEvent.input(idea, {
      target: { value: "Make the opening image impossible to ignore." }
    });
    fireEvent.click(getByRole(document.body, "button", { name: "Lock in Attention" }));

    await waitFor(() => expect(document.querySelector<HTMLElement>(
      "[data-aida-playbook-panel] [role=status]"
    )?.textContent).toContain("Select the canvas piece"));
    const response = await parsed(api, "state-aida-no-selection", "getState", null);
    if (!response.ok) throw new Error(JSON.stringify(response.error));
    const state = CampaignDocumentSchema.parse(response.payload);
    expect(state.strategy.aidaPlan.attention).toBe("");
    expect(state.evidence.attention).toEqual([]);
  });

  it("keeps the visible price, charged price and price evidence identical", async () => {
    const source = CampaignDocumentSchema.parse({
      ...blankDocument,
      gameplay: { ...blankDocument.gameplay, stage: "irresistible" },
      fabricState: {
        version: "7.4.0",
        objects: [{
          type: "rect",
          objectId: "priced-product",
          elementKind: "shape",
          accessibleName: "Priced product"
        }]
      },
      product: {
        name: "Loop Sip",
        priceCents: null,
        build: {
          schema: "product-build@1",
          primaryObjectId: "priced-product",
          packId: "price-test-pack",
          pricingVersion: 1,
          blueprintId: "loop-sip",
          selections: [{ groupId: "body", choiceIds: ["tumbler"] }],
          costLines: [{
            groupId: "body",
            groupLabel: "Body",
            kind: "base",
            choiceId: "tumbler",
            label: "Tumbler",
            costCents: 550
          }],
          unitCostCents: 550
        }
      }
    });
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-price-integrity", "open", source))
      .toMatchObject({ ok: true });
    activateStudioTool("price");
    fireEvent.click(getByRole(document.body, "radio", { name: /Everyday/ }));
    const price = getByRole<HTMLInputElement>(document.body, "spinbutton", {
      name: "Selling price in dollars"
    });

    fireEvent.input(price, { target: { value: "10" } });
    await waitFor(async () => {
      const response = await parsed(api, "price-ten", "getState", null);
      expect(response.payload).toMatchObject({ product: { priceCents: 1_000 } });
    });
    fireEvent.click(getByRole(document.body, "button", { name: "Add price to design" }));
    await waitFor(() => expect(currentObjects()).toHaveLength(2));
    await waitFor(() => {
      expect(document.querySelector('[data-live="polite"]')?.textContent)
        .toBe("$10.00 added to the design. Return to the game to see the next step.");
    });
    const first = await parsed(api, "price-first-label", "getState", null);
    if (!first.ok) throw new Error(JSON.stringify(first.error));
    const firstState = CampaignDocumentSchema.parse(first.payload);
    const priceObjectId = firstState.evidence.price[0]!;
    expect(firstState.fabricState.objects.find(({ objectId }) => objectId === priceObjectId))
      .toMatchObject({
        text: "$10.00",
        accessibleName: "Market price $10.00",
        editable: false,
        left: 1240,
        top: 670
      });

    fireEvent.input(price, { target: { value: "20" } });
    await waitFor(async () => {
      const response = await parsed(api, "price-twenty", "getState", null);
      if (!response.ok) throw new Error(JSON.stringify(response.error));
      const state = CampaignDocumentSchema.parse(response.payload);
      expect(state.product.priceCents).toBe(2_000);
      expect(state.evidence.price).toEqual([priceObjectId]);
      expect(state.fabricState.objects.find(({ objectId }) => objectId === priceObjectId))
        .toMatchObject({
          text: "$20.00",
          accessibleName: "Market price $20.00",
          editable: false
        });
    });

    fireEvent.input(price, { target: { value: "" } });
    await waitFor(async () => {
      const response = await parsed(api, "price-cleared", "getState", null);
      if (!response.ok) throw new Error(JSON.stringify(response.error));
      const state = CampaignDocumentSchema.parse(response.payload);
      expect(state.product.priceCents).toBeNull();
      expect(state.evidence.price).toEqual([]);
      expect(state.fabricState.objects.some(({ objectId }) => objectId === priceObjectId))
        .toBe(false);
    });
  });

  it("drops checklist evidence when its canvas piece has been removed", async () => {
    const source = CampaignDocumentSchema.parse({
      ...blankDocument,
      fabricState: {
        version: "7.4.0",
        objects: [{
          type: "textbox",
          objectId: "removed-headline",
          elementKind: "text",
          accessibleName: "Campaign headline",
          text: "A bright opening"
        }]
      },
      evidence: {
        ...blankDocument.evidence,
        attention: ["removed-headline"]
      }
    });
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-remove-evidence", "open", source))
      .toMatchObject({ ok: true });

    runtime.state = { version: "7.4.0", objects: [] };
    runtime.listeners.forEach((listener) => listener({
      type: "removed",
      objectId: "removed-headline"
    }));

    const response = await parsed(api, "state-remove-evidence", "getState", null);
    if (!response.ok) throw new Error(JSON.stringify(response.error));
    expect(CampaignDocumentSchema.parse(response.payload).evidence.attention).toEqual([]);
  });

  it("routes one strict market request through the same-origin JSON client without binary leakage", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      expect(input).toBe("/api/market/join");
      expect(init).toMatchObject({
        method: "POST",
        credentials: "same-origin",
        redirect: "error",
        headers: { "content-type": "application/json" }
      });
      expect(typeof init?.body).toBe("string");
      expect(init?.body).not.toBeInstanceOf(Blob);
      expect(init?.body).not.toBeInstanceOf(ArrayBuffer);
      expect(ArrayBuffer.isView(init?.body)).toBe(false);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        roomCode: "ABC-234",
        alias: "Neon Narwhals"
      });
      expect(body.clientId).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.operationId).toMatch(/^[0-9a-f-]{36}$/);
      expect(body).not.toHaveProperty("binary");
      return Promise.resolve(Response.json({
        role: "team",
        roomCode: "ABC-234",
        snapshot: { phase: "building" },
        session: {
          scheme: "Bearer",
          token: "header.signature",
          expiresAt: 2_000_000_000
        }
      }));
    });
    await import("./main");
    const market = (window as Window & { AdMarketRoom: MarketPublicApi }).AdMarketRoom;

    const rejected = JSON.parse(await market.handle(JSON.stringify({
      contract: MARKET_BRIDGE_CONTRACT,
      requestId: "market-invalid",
      method: "joinRoom",
      payload: {
        roomCode: "ABC-234",
        alias: "Neon Narwhals",
        binary: "not-part-of-the-contract"
      }
    }))) as Record<string, unknown>;
    expect(rejected).toMatchObject({
      contract: MARKET_BRIDGE_CONTRACT,
      requestId: "market-invalid",
      ok: false,
      error: { code: "INVALID_REQUEST" }
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    const raw = await market.handle(JSON.stringify({
      contract: MARKET_BRIDGE_CONTRACT,
      requestId: "market-join",
      method: "joinRoom",
      payload: { roomCode: "ABC-234", alias: "Neon Narwhals" }
    }));

    expect(JSON.parse(raw)).toEqual({
      contract: MARKET_BRIDGE_CONTRACT,
      requestId: "market-join",
      ok: true,
      payload: {
        role: "team",
        roomCode: "ABC-234",
        snapshot: { phase: "building" }
      }
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(raw).not.toContain("binary");
  });

  it("plays a paired Round 0 with real text history and audience persistence", async () => {
    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-round-zero", "open", blankDocument)).toMatchObject({ ok: true });

    expect(document.querySelector("[data-active-role]")?.textContent).toBe("Art Director");
    expect((await parsed(api, "round-zero-brief", "getState", null)).payload).toMatchObject({
      brief: {
        targetAudienceId: AUDIENCE_BRIEFS[0].id,
        contextId: AUDIENCE_BRIEFS[0].id,
        audienceNeeds: [AUDIENCE_BRIEFS[0].need],
        audienceValues: [...AUDIENCE_BRIEFS[0].values],
        intendedEffects: [AUDIENCE_BRIEFS[0].intendedEffect]
      }
    });
    activateStudioTool("words");

    const words = getByRole<HTMLInputElement>(document.body, "textbox", {
      name: "Canvas words"
    });
    fireEvent.input(words, { target: { value: "Make room for adventure" } });
    fireEvent.click(getByRole(document.body, "button", { name: "Add words to ad" }));

    await waitFor(() => {
      expect(currentObjects()).toEqual([
        expect.objectContaining({
          elementKind: "text",
          text: "Make room for adventure"
        })
      ]);
      expect(getByRole(document.body, "status", { name: "Pair progress" }).textContent)
        .toBe(
          "Art Director: visible canvas change recorded. " +
          "Strategist: message or strategy change not yet recorded. " +
          "Roles have not been swapped yet."
        );
    });

    fireEvent.click(getByRole(document.body, "button", { name: "Swap roles" }));
    expect(document.querySelector("[data-active-role]")?.textContent).toBe("Strategist");
    fireEvent.input(words, { target: { value: "Your weekend, your way" } });
    fireEvent.click(getByRole(document.body, "button", { name: "Add words to ad" }));

    await waitFor(() => {
      expect(currentObjects()).toHaveLength(2);
      expect(getByRole(document.body, "status", { name: "Pair progress" }).textContent)
        .toBe(
          "Art Director: visible canvas change recorded. " +
          "Strategist: message or strategy change recorded. " +
          "Roles have been swapped once."
        );
      expect(document.querySelector("[data-active-role-action]")?.textContent)
        .toBe("Name the product. Add one clear benefit to the ad.");
    });

    fireEvent.click(getByRole(document.body, "button", { name: "Undo" }));
    await waitFor(() => {
      expect(currentObjects()).toHaveLength(1);
      expect(document.querySelector('[data-live="polite"]')?.textContent)
        .toBe("Undid last change.");
    });
    fireEvent.click(getByRole(document.body, "button", { name: "Redo" }));
    await waitFor(() => {
      expect(currentObjects()).toHaveLength(2);
      expect(document.querySelector('[data-live="polite"]')?.textContent)
        .toBe("Redid last change.");
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
    expect(runtime.loadRevisionDraft).toHaveBeenCalledWith(source.documentId, source.revision);
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
      error: { code: "CREATOR_OPERATION_FAILED" }
    });
  });

  it("rehydrates the requested exact revision when a newer orphan draft exists", async () => {
    const checkpointRevision = localBlobDocument(3);
    checkpointRevision.product.name = "Checkpoint campaign";
    storeDraft(checkpointRevision, [1, 2, 3, 4]);
    const newerOrphan = localBlobDocument(4);
    newerOrphan.product.name = "Newer orphan";
    storeDraft(newerOrphan, [9, 8, 7, 6]);
    await import("./main");

    expect(await parsed(
      window.AdMarketCreator,
      "open-checkpoint-revision",
      "open",
      checkpointRevision
    )).toMatchObject({ ok: true });

    expect(runtime.loadRevisionDraft).toHaveBeenCalledWith(
      checkpointRevision.documentId,
      checkpointRevision.revision
    );
    expect(runtime.loadDraft).not.toHaveBeenCalled();
    expect(await bytesOf(runtime.createdUrls[0]!.blob)).toEqual([1, 2, 3, 4]);
    expect((await parsed(
      window.AdMarketCreator,
      "checkpoint-revision-state",
      "getState",
      null
    )).payload).toMatchObject({
      revision: 3,
      product: { name: "Checkpoint campaign" }
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
        error: { code: "CREATOR_OPERATION_FAILED" }
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
      error: {
        code: "CREATOR_OPERATION_FAILED",
        message: "The advertisement editor could not be opened. Try again."
      }
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
      error: {
        code: "CREATOR_OPERATION_FAILED",
        message: "The advertisement editor could not be opened. Try again."
      }
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
      error: {
        code: "CREATOR_OPERATION_FAILED",
        message: "The advertisement editor could not be closed. Try again."
      }
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
      kind: "raster-master",
      title: "Reviewed bottle",
      category: "drinkware",
      tags: ["base", "bottle"],
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
    const catalogueText = JSON.stringify([core]);
    const catalogueHash = Array.from(new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(catalogueText))
    ), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/catalog.json")) return Promise.resolve(new Response(catalogueText));
      if (url.endsWith("/pricing.json")) return Promise.resolve(Response.json({
        schema: "raster-production-pricing@1",
        packId: "offline-core-v1",
        pricingVersion: 1,
        catalogSha256: catalogueHash,
        entries: [{ assetId: "core-bottle", costCents: 2_500, role: "base" }]
      }));
      return Promise.reject(new Error(`Unexpected URL ${url}`));
    });
    await import("./main");
    const api = window.AdMarketCreator;
    await parsed(api, "open-catalogue", "open", blankDocument);
    activateStudioTool("assets");

    const libraryView = getByRole<HTMLSelectElement>(document.body, "combobox", {
      name: "Library view"
    });
    expect(libraryView.value).toBe("products");
    const search = getByRole<HTMLInputElement>(document.body, "searchbox", { name: "Search assets" });
    search.value = "bottle";
    search.dispatchEvent(new Event("input"));
    const tile = await findByRole(document.body, "button", { name: /Reviewed bottle/ });
    expect(tile.textContent).not.toContain("$");
    tile.click();

    const state = await parsed(api, "catalogue-state", "getState", null);
    expect(state.payload).toMatchObject({
      fabricState: {
        objects: [expect.objectContaining({ elementKind: "image", assetId: "core-bottle" })]
      },
      product: {
        build: expect.objectContaining({
          primaryObjectId: expect.any(String),
          packId: "offline-core-v1",
          unitCostCents: 2_500
        })
      },
      assetReferences: [
        {
          kind: "catalog",
          objectId: expect.any(String),
          assetId: "core-bottle",
          assetVersion: 1,
          attribution: core.attribution
        },
        {
          kind: "local-blob",
          objectId: expect.any(String),
          assetId: "core-bottle",
          blobKey: expect.stringMatching(/^catalog-/),
          mimeType: "image/png"
        }
      ]
    });

    expect(await parsed(api, "catalogue-save", "save", null)).toMatchObject({ ok: true });
    expect(runtime.save.mock.calls.at(-1)?.[0]).toMatchObject({
      assetReferences: [
        expect.objectContaining({ kind: "catalog", assetId: "core-bottle" }),
        expect.objectContaining({ kind: "local-blob", assetId: "core-bottle" })
      ]
    });
    expect((runtime.save.mock.calls.at(-1)?.[1] as ReadonlyMap<string, Blob>).size).toBe(1);
    expect(fetchSpy.mock.calls.filter(([input]) =>
      String(input).includes("/catalog/generated/offline-core-v1/catalog.json")))
      .toHaveLength(1);
    expect(fetchSpy.mock.calls.filter(([input]) =>
      String(input).includes("/catalog/generated/offline-core-v1/pricing.json")))
      .toHaveLength(1);
  });

  it("undoes and redoes a tinted catalogue placement as one exact document transaction", async () => {
    const core = {
      schema: "catalog-asset@1",
      delivery: "offline",
      id: "history-bottle",
      version: 1,
      kind: "raster-master",
      title: "History bottle",
      category: "drinkware",
      tags: ["base", "bottle"],
      files: {
        thumbnail: "/catalog/generated/offline-core-v1/assets/history-bottle/thumbnail-192.webp",
        preview: "/catalog/generated/offline-core-v1/assets/history-bottle/preview-640.webp",
        master: "/catalog/generated/offline-core-v1/assets/history-bottle/master.png",
        masks: { body: "/catalog/generated/offline-core-v1/assets/history-bottle/masks/body.png" }
      },
      masterSha256: "b".repeat(64),
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
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    root.dataset.offlineCatalogueUrl = "/catalog/generated/offline-core-v1/catalog.json";
    const catalogueText = JSON.stringify([core]);
    const catalogueHash = Array.from(new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(catalogueText))
    ), (byte) => byte.toString(16).padStart(2, "0")).join("");
    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      if (url.endsWith("/catalog.json")) return Promise.resolve(new Response(catalogueText));
      if (url.endsWith("/pricing.json")) return Promise.resolve(Response.json({
        schema: "raster-production-pricing@1",
        packId: "offline-core-v1",
        pricingVersion: 1,
        catalogSha256: catalogueHash,
        entries: [{ assetId: core.id, costCents: 2_500, role: "base" }]
      }));
      return Promise.reject(new Error(`Unexpected URL ${url}`));
    });
    await import("./main");
    const api = window.AdMarketCreator;
    await parsed(api, "history-open", "open", blankDocument);
    activateStudioTool("assets");
    const before = CampaignDocumentSchema.parse(
      (await parsed(api, "history-before", "getState", null)).payload
    );

    const search = getByRole<HTMLInputElement>(document.body, "searchbox", { name: "Search assets" });
    search.value = "history bottle";
    search.dispatchEvent(new Event("input"));
    fireEvent.click(await findByRole(document.body, "button", { name: /History bottle/ }));
    const placed = CampaignDocumentSchema.parse(
      (await parsed(api, "history-placed", "getState", null)).payload
    );
    const localReference = placed.assetReferences.find(({ kind }) => kind === "local-blob");
    expect(placed.fabricState.objects).toEqual([
      expect.objectContaining({ elementKind: "image", assetId: core.id })
    ]);
    expect(placed.assetReferences).toEqual([
      expect.objectContaining({ kind: "catalog", assetId: core.id }),
      expect.objectContaining({
        kind: "local-blob",
        assetId: core.id,
        blobKey: expect.stringMatching(/^catalog-/),
        mimeType: "image/png"
      })
    ]);
    expect(placed.product.build).toMatchObject({
      primaryObjectId: placed.fabricState.objects[0]!.objectId,
      packId: "offline-core-v1",
      unitCostCents: 2_500
    });
    expect(localReference).toBeDefined();

    fireEvent.click(getByRole(document.body, "button", { name: "Undo" }));
    await waitFor(() => expect(currentObjects()).toEqual([]));
    const undone = CampaignDocumentSchema.parse(
      (await parsed(api, "history-undone", "getState", null)).payload
    );
    expect(undone.fabricState).toEqual(before.fabricState);
    expect(undone.assetReferences).toEqual(before.assetReferences);
    expect(undone.product.build).toEqual(before.product.build);
    expect(document.querySelector('[data-live="polite"]')?.textContent)
      .toBe("Undid last change.");

    expect(await parsed(api, "history-save-undone", "save", null)).toMatchObject({ ok: true });
    const [undoneSavedDocument, undoneSaveBlobs] = runtime.save.mock.calls.at(-1) as [
      CampaignDocumentV1,
      ReadonlyMap<string, Blob>
    ];
    expect(undoneSaveBlobs.size).toBe(0);

    fireEvent.click(getByRole(document.body, "button", { name: "Redo" }));
    await waitFor(() => expect(currentObjects()).toHaveLength(1));
    const redone = CampaignDocumentSchema.parse(
      (await parsed(api, "history-redone", "getState", null)).payload
    );
    expect(redone).toEqual({
      ...placed,
      revision: undoneSavedDocument.revision,
      updatedAt: undoneSavedDocument.updatedAt
    });
    expect(redone.fabricState).toEqual(placed.fabricState);
    expect(redone.assetReferences).toEqual(placed.assetReferences);
    expect(redone.product.build).toEqual(placed.product.build);
    expect(document.querySelector('[data-live="polite"]')?.textContent)
      .toBe("Redid last change.");

    expect(await parsed(api, "history-save-redone", "save", null)).toMatchObject({ ok: true });
    const redoSaveBlobs = runtime.save.mock.calls.at(-1)?.[1] as ReadonlyMap<string, Blob>;
    expect([...redoSaveBlobs.keys()]).toEqual([localReference!.blobKey]);
  });

  it("chooses, places, saves and reopens the exact PNG-only Product Kit", async () => {
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    root.dataset.offlineCatalogueUrl = "/catalog/generated/offline-core-v1/catalog.json";
    const packRoot = join("catalog", "generated", "offline-core-v1");
    const jsonByPath = new Map([
      ["/catalog/generated/offline-core-v1/catalog.json", "catalog.json"],
      ["/catalog/generated/offline-core-v1/pricing.json", "pricing.json"],
      ["/catalog/generated/offline-core-v1/product-kit-v1.json", "product-kit-v1.json"],
      [
        "/catalog/generated/offline-core-v1/product-kit-pricing-v1.json",
        "product-kit-pricing-v1.json"
      ],
      [
        "/catalog/generated/offline-core-v1/student-starters-v1.json",
        "student-starters-v1.json"
      ]
    ]);
    const pngByPath = new Map([
      [
        "/catalog/generated/offline-core-v1/assets/89-beverage-container-bases-r03c05/master.png",
        join("assets", "89-beverage-container-bases-r03c05", "master.png")
      ],
      [
        "/catalog/generated/offline-core-v1/assets/90-beverage-container-add-ons-r04c01/master.png",
        join("assets", "90-beverage-container-add-ons-r04c01", "master.png")
      ]
    ]);
    const responses: Array<{ url: string; mimeType: string; byteLength: number }> = [];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = new URL(String(input), window.location.href);
      expect(url.origin).toBe(window.location.origin);
      let body: string | ArrayBuffer;
      let mimeType: string;
      const jsonFixture = jsonByPath.get(url.pathname);
      const pngFixture = pngByPath.get(url.pathname);
      if (jsonFixture) {
        body = readFileSync(join(packRoot, jsonFixture), "utf8");
        mimeType = "application/json";
      } else if (pngFixture) {
        body = Uint8Array.from(readFileSync(join(packRoot, pngFixture))).buffer;
        mimeType = "image/png";
      } else if (url.pathname === "/api/image-lab/session") {
        body = JSON.stringify({ enabled: false, reason: "disabled" });
        mimeType = "application/json";
      } else {
        return Promise.reject(new Error(`Unexpected URL ${url.href}`));
      }
      const byteLength = typeof body === "string"
        ? new TextEncoder().encode(body).byteLength
        : body.byteLength;
      responses.push({ url: url.href, mimeType, byteLength });
      return Promise.resolve(new Response(body, {
        status: 200,
        headers: { "content-type": mimeType }
      }));
    });

    await import("./main");
    const api = window.AdMarketCreator;
    expect(await parsed(api, "open-product-kit", "open", blankDocument))
      .toMatchObject({ ok: true });
    activateStudioTool("product");
    await findByRole(document.body, "radio", { name: /Reusable tumbler/ });

    const lid = getByRole<HTMLInputElement>(document.body, "radio", { name: /Flat lid/ });
    lid.focus();
    fireEvent.click(lid);
    expect(document.activeElement).toBe(getByRole(document.body, "radio", { name: /Flat lid/ }));
    expect(document.querySelector<HTMLElement>("[data-product-builder-panel]")?.textContent)
      .not.toContain("$");
    const emptyCanvas = getByRole<HTMLElement>(document.body, "status", { name: "Empty canvas" });
    expect(emptyCanvas.hidden).toBe(false);
    fireEvent.click(getByRole(document.body, "button", { name: "Place product on ad" }));
    await waitFor(() => expect(emptyCanvas.hidden).toBe(true));
    await findByRole(document.body, "button", { name: "Place another product on ad" });
    expect(document.querySelector<HTMLElement>(".creator__inspector")?.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>(".creator__inspector")?.textContent ?? "")
      .not.toContain("Product body: Product body");

    const placedResponse = await parsed(api, "state-product-kit", "getState", null);
    if (!placedResponse.ok) throw new Error(JSON.stringify(placedResponse.error));
    const placed = CampaignDocumentSchema.parse(placedResponse.payload);
    const rootObject = placed.fabricState.objects.find(({ elementKind }) =>
      elementKind === "product-kit"
    );
    expect(rootObject).toMatchObject({
      type: "group",
      objectId: expect.any(String),
      elementKind: "product-kit",
      accessibleName: "Reusable tumbler",
      productKitPackId: "pk1-pilot-drinkware",
      productKitId: "pk1-tumbler-kit",
      productKitCatalogSha256:
        "6199fd1adae59a2b517b265ca67a325f32faba04d375852821e841b51a354073"
    });
    activateStudioTool("words");
    const productWords = getByRole<HTMLInputElement>(document.body, "textbox", {
      name: "Canvas words"
    });
    fireEvent.input(productWords, { target: { value: "Refill. Roam. Repeat." } });
    fireEvent.click(getByRole(document.body, "button", {
      name: "Put words on selected product"
    }));
    await waitFor(() => {
      const liveProduct = currentObjects().find(({ elementKind }) => elementKind === "product-kit");
      const artworkSlot = (liveProduct?.objects as Array<Record<string, unknown>>)
        .find(({ productLayer }) => productLayer === "artwork-slot");
      expect(artworkSlot?.objects).toEqual(expect.arrayContaining([
        expect.objectContaining({
          elementKind: "text",
          curvedTextSource: "Refill. Roam. Repeat."
        })
      ]));
    });
    fireEvent.input(productWords, { target: { value: "Warm drinks. Less waste." } });
    fireEvent.click(getByRole(document.body, "button", {
      name: "Put words on selected product"
    }));
    await waitFor(() => {
      const liveProduct = currentObjects().find(({ elementKind }) => elementKind === "product-kit");
      const artworkSlot = (liveProduct?.objects as Array<Record<string, unknown>>)
        .find(({ productLayer }) => productLayer === "artwork-slot");
      const labels = (artworkSlot?.objects as Array<Record<string, unknown>>)
        .filter(({ elementKind }) => elementKind === "text");
      expect(labels).toEqual([
        expect.objectContaining({ curvedTextSource: "Warm drinks. Less waste." })
      ]);
    });
    fireEvent.click(getByRole(document.body, "button", { name: "Undo" }));
    await waitFor(() => {
      const liveProduct = currentObjects().find(({ elementKind }) => elementKind === "product-kit");
      const artworkSlot = (liveProduct?.objects as Array<Record<string, unknown>>)
        .find(({ productLayer }) => productLayer === "artwork-slot");
      expect((artworkSlot?.objects as Array<Record<string, unknown>>)
        .find(({ elementKind }) => elementKind === "text")?.curvedTextSource)
        .toBe("Refill. Roam. Repeat.");
    });
    fireEvent.click(getByRole(document.body, "button", { name: "Redo" }));
    await waitFor(() => {
      const liveProduct = currentObjects().find(({ elementKind }) => elementKind === "product-kit");
      const artworkSlot = (liveProduct?.objects as Array<Record<string, unknown>>)
        .find(({ productLayer }) => productLayer === "artwork-slot");
      expect((artworkSlot?.objects as Array<Record<string, unknown>>)
        .find(({ elementKind }) => elementKind === "text")?.curvedTextSource)
        .toBe("Warm drinks. Less waste.");
    });
    expect((rootObject?.objects as Array<Record<string, unknown>>)
      .map(({ productLayer }) => productLayer))
      .toEqual(["body", "front", "artwork-slot"]);
    const reference = placed.assetReferences.find(({ kind }) =>
      kind === "product-kit-composition"
    );
    expect(reference).toEqual({
      kind: "product-kit-composition",
      version: 1,
      objectId: rootObject?.objectId,
      productKitPackId: "pk1-pilot-drinkware",
      catalogPackId: "offline-core-v1",
      catalogSha256:
        "6199fd1adae59a2b517b265ca67a325f32faba04d375852821e841b51a354073",
      request: {
        kitId: "pk1-tumbler-kit",
        placements: [{
          kind: "socket",
          placementId: "placement-lid",
          mountFrameId: "pk1-tumbler-lid-frame",
          componentId: "pk1-flat-lid"
        }]
      },
      pricedItems: [{
        kind: "base",
        itemId: "base:pk1-tumbler-kit",
        priceAssetId: "pk1-price-tumbler"
      }, {
        kind: "component",
        itemId: "placement:placement-lid",
        placementId: "placement-lid",
        componentId: "pk1-flat-lid",
        priceAssetId: "pk1-price-flat-lid"
      }]
    });
    expect(placed.product.build).toMatchObject({
      schema: "product-build@1",
      primaryObjectId: rootObject?.objectId,
      packId: "pk1-pilot-drinkware",
      blueprintId: "pk1-tumbler-kit",
      unitCostCents: 550
    });
    activateStudioTool("product");
    expect(getByRole(document.body, "region", { name: "Product builder" }).textContent)
      .not.toContain("$");

    const placedRoot = structuredClone(currentObjects().find(({ elementKind }) =>
      elementKind === "product-kit"
    ));
    const placedReference = structuredClone(reference);
    const placedBuild = structuredClone(placed.product.build);
    expect(await parsed(api, "save-product-kit", "save", null)).toMatchObject({ ok: true });
    const saved = runtime.drafts.get(blankDocument.documentId)!.document;
    expect(await parsed(api, "close-product-kit", "close", null)).toMatchObject({ ok: true });
    expect(await parsed(api, "reopen-product-kit", "open", saved)).toMatchObject({ ok: true });
    const reopenedResponse = await parsed(api, "reopened-product-kit", "getState", null);
    if (!reopenedResponse.ok) throw new Error(JSON.stringify(reopenedResponse.error));
    const reopened = CampaignDocumentSchema.parse(reopenedResponse.payload);
    expect(reopened.fabricState.objects.find(({ elementKind }) =>
      elementKind === "product-kit"
    )).toEqual(placedRoot);
    expect(reopened.assetReferences.find(({ kind }) =>
      kind === "product-kit-composition"
    )).toEqual(placedReference);
    expect(reopened.product.build).toEqual(placedBuild);
    expect((reopened.fabricState.objects[0]?.objects as Array<Record<string, unknown>>)
      .map(({ productLayer }) => productLayer))
      .toEqual(["body", "front", "artwork-slot"]);

    const requested = fetchSpy.mock.calls.map(([input]) =>
      new URL(String(input), window.location.href)
    );
    expect(requested.every(({ origin }) => origin === window.location.origin)).toBe(true);
    expect(requested.some(({ pathname }) => pathname.toLowerCase().endsWith(".svg")))
      .toBe(false);
    expect(responses.some(({ mimeType }) => mimeType === "image/svg+xml")).toBe(false);
    expect(responses.filter(({ mimeType }) => mimeType === "image/png"))
      .toEqual([
        expect.objectContaining({
          url: `${window.location.origin}/catalog/generated/offline-core-v1/assets/89-beverage-container-bases-r03c05/master.png`,
          byteLength: expect.any(Number)
        }),
        expect.objectContaining({
          url: `${window.location.origin}/catalog/generated/offline-core-v1/assets/90-beverage-container-add-ons-r04c01/master.png`,
          byteLength: expect.any(Number)
        })
      ]);
    expect(responses.filter(({ mimeType }) => mimeType === "image/png")
      .every(({ byteLength }) => byteLength > 8)).toBe(true);
  }, 20_000);

  it("creates all four local logo recipes, remixes, saves, reloads and publishes them", async () => {
    expect(() => parseLogoIconCatalogue(logoCatalogueFixture())).not.toThrow();
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
    activateStudioTool("logo");
    await findByRole(document.body, "button", { name: "Rocket" });

    const incompleteAction = getByRole<HTMLButtonElement>(
      document.body,
      "button",
      { name: "Add logo" }
    );
    expect(incompleteAction.disabled).toBe(false);
    fireEvent.click(incompleteAction);
    expect(getByRole(document.body, "alert").textContent)
      .toBe("Add words and choose a symbol before adding the logo.");
    expect(document.activeElement).toBe(getByRole(document.body, "textbox", {
      name: "Logo words"
    }));
    expect(currentObjects().filter(({ elementKind }) => elementKind === "logo-mark"))
      .toHaveLength(0);

    fireEvent.input(getByRole<HTMLInputElement>(document.body, "textbox", {
      name: "Logo words"
    }), { target: { value: "Draft logo" } });
    fireEvent.click(getByRole(document.body, "button", { name: "Add logo" }));
    expect(getByRole(document.body, "alert").textContent)
      .toBe("Choose a symbol before adding the logo.");
    expect((document.activeElement as HTMLElement | null)?.dataset.logoIconId).toBeTruthy();

    fireEvent.click(getByRole(document.body, "button", { name: "Rocket" }));
    fireEvent.input(getByRole<HTMLInputElement>(document.body, "textbox", {
      name: "Logo words"
    }), { target: { value: "" } });
    fireEvent.click(getByRole(document.body, "button", { name: "Add logo" }));
    expect(getByRole(document.body, "alert").textContent)
      .toBe("Add words before adding the logo.");
    expect(document.activeElement).toBe(getByRole(document.body, "textbox", {
      name: "Logo words"
    }));

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
      expect(runtime.selectedObjectId).toBe(currentObjects()
        .filter(({ elementKind }) => elementKind === "logo-mark")
        .at(-1)?.objectId);
    }

    const finalLogo = currentObjects()
      .filter(({ elementKind }) => elementKind === "logo-mark")
      .at(-1)!;
    const finalLogoLeft = Number(finalLogo.left);
    const canvasRegion = getByRole(document.body, "region", { name: "Campaign canvas" });
    fireEvent.keyDown(canvasRegion, { key: "ArrowRight" });
    await waitFor(() => expect(currentObjects()
      .find(({ objectId }) => objectId === finalLogo.objectId)?.left).toBe(finalLogoLeft + 5));
    fireEvent.click(getByRole(document.body, "button", { name: "Undo" }));
    await waitFor(() => expect(currentObjects()
      .find(({ objectId }) => objectId === finalLogo.objectId)?.left).toBe(finalLogoLeft));
    fireEvent.click(getByRole(document.body, "button", { name: "Redo" }));
    await waitFor(() => expect(currentObjects()
      .find(({ objectId }) => objectId === finalLogo.objectId)?.left).toBe(finalLogoLeft + 5));

    const details = document.querySelector<HTMLDetailsElement>(".logo-lab details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    fireEvent.click(getByRole(document.body, "button", { name: "Random logo" }));
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
    activateStudioTool("logo");
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
    const logoCalls = fetchSpy.mock.calls.filter(([input]) =>
      String(input).includes("/catalog/generated/logo-icons-v1-reviewed/catalog.json"));
    expect(logoCalls).toHaveLength(1);
    expect(String(logoCalls[0]![0])).toBe(
      `${window.location.origin}/catalog/generated/logo-icons-v1-reviewed/catalog.json`
    );
  }, 20_000);

  it("loads account Object Forge allowance, places owned pixels, and keeps fal controls server-side", async () => {
    const imageBytes = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url === "/api/image-lab/session") {
        return Promise.resolve(Response.json({
          enabled: true,
          object: { remaining: 6, reserved: 0 },
          realise: { remaining: 2, reserved: 0 }
        }));
      }
      if (url === "/api/image-lab/jobs" && init?.method === "POST") {
        return Promise.resolve(Response.json({
          jobToken: "encrypted-browser-job-token",
          stage: "object",
          remaining: { object: 5, realise: 2 }
        }, { status: 202 }));
      }
      if (url.startsWith("/api/image-lab/jobs?job=")) {
        return Promise.resolve(Response.json({ status: "completed" }));
      }
      if (url.startsWith("/api/image-lab/assets?job=")) {
        return Promise.resolve(new Response(imageBytes, {
          headers: {
            "content-type": "image/png",
            "content-length": String(imageBytes.byteLength)
          }
        }));
      }
      return Promise.reject(new Error(`Unexpected URL ${url}`));
    });

    await import("./main");
    const api = window.AdMarketCreator;
    await parsed(api, "open-image-lab", "open", blankDocument);
    activateStudioTool("image");
    const imageLab = document.querySelector<HTMLElement>('[data-image-lab-panel]')!;
    await waitFor(() => expect(getByRole(imageLab, "button", { name: "Forge object" })).toBeTruthy());

    const objectName = getByRole<HTMLInputElement>(imageLab, "textbox", { name: "Object idea" });
    objectName.value = "curved reusable bottle";
    fireEvent.click(getByRole(imageLab, "button", { name: "Forge object" }));
    await waitFor(() => expect(imageLab.textContent).toContain("Your new object is on the canvas."));

    const state = await parsed(api, "state-image-lab", "getState", null);
    expect(state.payload).toMatchObject({
      fabricState: {
        objects: [expect.objectContaining({ elementKind: "image", accessibleName: "Curved reusable bottle" })]
      },
      assetReferences: expect.arrayContaining([
        expect.objectContaining({
          kind: "generated-image",
          stage: "object-forge",
          profileId: "object-forge-v1"
        }),
        expect.objectContaining({ kind: "local-blob", mimeType: "image/png" })
      ])
    });
    expect(await parsed(api, "save-image-lab", "save", null)).toMatchObject({ ok: true });
    expect((runtime.save.mock.calls.at(-1)?.[1] as ReadonlyMap<string, Blob>).size).toBe(1);

    const jobCall = fetchSpy.mock.calls.find(([input, request]) =>
      String(input) === "/api/image-lab/jobs" && request?.method === "POST");
    const jobBody = JSON.parse(String(jobCall?.[1]?.body)) as Record<string, unknown>;
    expect(jobBody).toMatchObject({
      stage: "object",
      objectName: "curved reusable bottle"
    });
    expect(jobBody).not.toHaveProperty("sessionId");
    expect(jobBody).not.toHaveProperty("teamId");
    expect(jobBody).not.toHaveProperty("model");
    expect(jobBody).not.toHaveProperty("slug");
    expect(jobBody).not.toHaveProperty("steps");
    expect(jobBody).not.toHaveProperty("quality");
    expect(jobBody).not.toHaveProperty("width");
    expect(jobBody).not.toHaveProperty("height");
  });

  it("aborts Image Lab at the start of close so a late job cannot recreate the canvas", async () => {
    let resolveJob!: (response: Response) => void;
    let jobSignal: AbortSignal | null | undefined;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url === "/api/image-lab/session") {
        return Promise.resolve(Response.json({
          enabled: true,
          object: { remaining: 6, reserved: 0 },
          realise: { remaining: 2, reserved: 0 }
        }));
      }
      if (url === "/api/image-lab/jobs" && init?.method === "POST") {
        jobSignal = init.signal;
        return new Promise<Response>((resolve) => { resolveJob = resolve; });
      }
      return Promise.reject(new Error(`Unexpected URL ${url}`));
    });
    await import("./main");
    const api = window.AdMarketCreator;
    await parsed(api, "open-image-close", "open", blankDocument);
    activateStudioTool("image");
    const imageLab = document.querySelector<HTMLElement>('[data-image-lab-panel]')!;
    await waitFor(() => expect(getByRole(imageLab, "button", { name: "Forge object" })).toBeTruthy());
    getByRole<HTMLInputElement>(imageLab, "textbox", { name: "Object idea" }).value = "lamp";
    fireEvent.click(getByRole(imageLab, "button", { name: "Forge object" }));
    await waitFor(() => expect(jobSignal).toBeInstanceOf(AbortSignal));

    const closing = parsed(api, "close-during-image", "close", null);

    expect(jobSignal?.aborted).toBe(true);
    await expect(closing).resolves.toMatchObject({ ok: true });
    resolveJob(Response.json({
      jobToken: "late-job",
      stage: "object",
      remaining: { object: 5, realise: 2 }
    }, { status: 202 }));
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchSpy.mock.calls.some(([request]) => String(request).startsWith("/api/image-lab/jobs?")))
      .toBe(false);
    expect(runtime.canvasConstructed).toHaveBeenCalledOnce();
  });

  it("aborts Image Lab at pair switch and loads the next account status", async () => {
    let resolveJob!: (response: Response) => void;
    let jobSignal: AbortSignal | null | undefined;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const url = String(input);
      if (url === "/api/image-lab/session") {
        return Promise.resolve(Response.json({
          enabled: true,
          object: { remaining: 6, reserved: 0 },
          realise: { remaining: 2, reserved: 0 }
        }));
      }
      if (url === "/api/image-lab/jobs" && init?.method === "POST") {
        jobSignal = init.signal;
        return new Promise<Response>((resolve) => { resolveJob = resolve; });
      }
      return Promise.reject(new Error(`Unexpected URL ${url}`));
    });
    await import("./main");
    const api = window.AdMarketCreator;
    await parsed(api, "open-image-pair-a", "open", blankDocument);
    activateStudioTool("image");
    const imageLab = document.querySelector<HTMLElement>('[data-image-lab-panel]')!;
    await waitFor(() => expect(getByRole(imageLab, "button", { name: "Forge object" })).toBeTruthy());
    getByRole<HTMLInputElement>(imageLab, "textbox", { name: "Object idea" }).value = "lamp";
    fireEvent.click(getByRole(imageLab, "button", { name: "Forge object" }));
    await waitFor(() => expect(jobSignal).toBeInstanceOf(AbortSignal));
    const nextPair = createBlankCampaignDocument({
      documentId: "next-pair-document",
      sessionId: "next-pair-session",
      mode: "offline"
    });

    const opening = parsed(api, "open-image-pair-b", "open", nextPair);

    expect(jobSignal?.aborted).toBe(true);
    await expect(opening).resolves.toMatchObject({ ok: true });
    await waitFor(() => expect(getByRole(imageLab, "button", { name: "Forge object" })).toBeTruthy());
    expect(fetchSpy.mock.calls.filter(([request]) => String(request) === "/api/image-lab/session"))
      .toHaveLength(2);
    resolveJob(Response.json({
      jobToken: "late-pair-a-job",
      stage: "object",
      remaining: { object: 5, realise: 2 }
    }, { status: 202 }));
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchSpy.mock.calls.some(([request]) => String(request).startsWith("/api/image-lab/jobs?")))
      .toBe(false);
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
    activateStudioTool("assets");
    const search = getByRole<HTMLInputElement>(document.body, "searchbox", { name: "Search assets" });
    const toggle = getByRole<HTMLInputElement>(document.body, "checkbox", { name: "Show photo products" });
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
    activateStudioTool("assets");
    const search = getByRole<HTMLInputElement>(document.body, "searchbox", { name: "Search assets" });
    const toggle = getByRole<HTMLInputElement>(document.body, "checkbox", { name: "Show photo products" });
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
    const liveImageCallsBeforeReload = fetchSpy.mock.calls.filter(([input]) =>
      String(input).includes(`/api/openverse-image/${id}`)).length;
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
    expect(fetchSpy.mock.calls.filter(([input]) =>
      String(input).includes(`/api/openverse-image/${id}`)))
      .toHaveLength(liveImageCallsBeforeReload);
  });

  it("returns canonical handler errors when storage or export fails", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await import("./main");
    const api = window.AdMarketCreator;
    await parsed(api, "open-failures", "open", blankDocument);

    runtime.saveFailure = new Error("Synthetic IndexedDB failure");
    expect(await parsed(api, "storage-failure", "save", null)).toEqual({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "storage-failure",
      ok: false,
      error: {
        code: "CREATOR_OPERATION_FAILED",
        message: "The draft could not be saved. Your work remains open. Try again."
      }
    });

    runtime.publishFailure = new Error("Synthetic Fabric export failure");
    expect(await parsed(api, "export-failure", "publish", null)).toEqual({
      contract: CREATOR_BRIDGE_CONTRACT,
      requestId: "export-failure",
      ok: false,
      error: {
        code: "CREATOR_OPERATION_FAILED",
        message: "The market card image could not be prepared. Your advertisement is still saved. Try again. If the same message appears, ask your teacher."
      }
    });
    expect(warning).toHaveBeenCalledWith(
      "[AdMarket creator request failed] " +
      "{\"requestId\":\"export-failure\",\"method\":\"publish\"," +
      "\"errorName\":\"Error\",\"message\":\"Synthetic Fabric export failure\"}"
    );
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
