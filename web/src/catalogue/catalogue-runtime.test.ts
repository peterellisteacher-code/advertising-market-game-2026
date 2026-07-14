import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createBlankCampaignDocument,
  parseCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import type {
  ArtworkSurfaceAddress,
  CanvasMutationListener,
  CanvasPort,
  LogoMarkSnapshot,
  LogoMarkSource,
  NewLogoMarkInput,
  NewProductVariantInput,
  NewRasterInput,
  NewShapeInput,
  NewTextInput
} from "../fabric/canvas-port";
import { parseProductBuilderCatalogue } from "../product-builder/product-builder-catalogue";
import { createVirtualProductVariantResolver } from "../product-builder/virtual-product-variant";
import type { ProductShellRecord } from "../product-shells/product-shell-catalogue";
import type { CatalogAssetV1 } from "./catalogue-types";
import {
  CataloguePlacementQueue,
  CatalogueRuntime,
  type CatalogueRenderer,
  type LivePhotoClient
} from "./catalogue-runtime";

const asset = (id: string, kind: CatalogAssetV1["kind"] = "component"): CatalogAssetV1 => {
  if (kind === "photo") {
    return {
      schema: "catalog-asset@1",
      delivery: "live-photo",
      id,
      version: 1,
      kind: "photo",
      title: "Market photo",
      category: "photos",
      tags: ["market"],
      files: {
        thumbnail: `/api/openverse-image/${id}?variant=thumbnail`,
        preview: `/api/openverse-image/${id}`,
        master: `/api/openverse-image/${id}`
      },
      dimensions: { width: 1_600, height: 900 },
      recolourZones: [],
      anchors: [],
      materialProfiles: [],
      classroomReviewed: false,
      brandFree: false,
      attribution: {
        creator: "A. Photographer",
        sourceUrl: "https://example.test/photo",
        license: "CC BY 4.0"
      }
    };
  }
  return {
    schema: "catalog-asset@1",
    delivery: "offline",
    id,
    version: 1,
    kind,
    title: "Reviewed bottle",
    category: "drinkware",
    tags: ["bottle"],
    files: {
      thumbnail: `/catalog/generated/offline-core-v1/assets/${id}/thumbnail-192.webp`,
      preview: `/catalog/generated/offline-core-v1/assets/${id}/preview-640.webp`,
      master: `/catalog/generated/offline-core-v1/assets/${id}/master.png`
    },
    masterSha256: "a".repeat(64),
    dimensions: { width: 320, height: 640 },
    recolourZones: [],
    anchors: [],
    materialProfiles: [],
    classroomReviewed: true,
    brandFree: true,
    attribution: {
      creator: "Classroom pack",
      sourceUrl: "local",
      license: "classroom-session"
    }
  };
};

const OPENVERSE_ID = "123e4567-e89b-42d3-a456-426614174000";
const openverseAsset = (): CatalogAssetV1 => ({
  ...asset(OPENVERSE_ID, "photo"),
  files: {
    thumbnail: `/api/openverse-image/${OPENVERSE_ID}?variant=thumbnail`,
    preview: `/api/openverse-image/${OPENVERSE_ID}`,
    master: `/api/openverse-image/${OPENVERSE_ID}`
  }
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

function runtimeHarness(core: CatalogAssetV1[], client: LivePhotoClient, liveDebounceMs = 0) {
  const input = document.createElement("input");
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  const status = document.createElement("p");
  const renders: string[][] = [];
  const renderer: CatalogueRenderer = {
    render(records) { renders.push(records.map(({ id }) => id)); }
  };
  const runtime = new CatalogueRuntime({
    core, input, liveToggle: toggle, status, renderer, client, liveDebounceMs
  });
  return { input, toggle, status, renders, runtime };
}

describe("CatalogueRuntime", () => {
  it("renders the reviewed core immediately and keeps live photos opt-in", async () => {
    const client: LivePhotoClient = { setEnabled: vi.fn(), search: vi.fn() };
    const harness = runtimeHarness([asset("core")], client);

    expect(harness.renders.at(-1)).toEqual(["core"]);
    expect(harness.toggle.checked).toBe(false);
    expect(client.search).not.toHaveBeenCalled();

    harness.input.value = "bottle";
    harness.input.dispatchEvent(new Event("input"));
    expect(harness.renders.at(-1)).toEqual(["core"]);
    expect(client.search).not.toHaveBeenCalled();
  });

  it("adds live results only after the teacher enables them and preserves core offline", async () => {
    const search = vi.fn()
      .mockResolvedValueOnce({
        status: "online",
        records: [asset("core", "photo"), asset("remote", "photo"), asset("remote", "photo")]
      })
      .mockResolvedValueOnce({ status: "offline", records: [] });
    const client: LivePhotoClient = { setEnabled: vi.fn(), search };
    const harness = runtimeHarness([asset("core")], client);
    harness.input.value = "bottle";
    harness.toggle.checked = true;

    harness.toggle.dispatchEvent(new Event("change"));
    await harness.runtime.settled();
    expect(client.setEnabled).toHaveBeenCalledWith(true);
    expect(harness.renders.at(-1)).toEqual(["core", "remote"]);

    harness.input.dispatchEvent(new Event("input"));
    await harness.runtime.settled();
    expect(harness.renders.at(-1)).toEqual(["core"]);
    expect(harness.status.textContent).toContain("classroom pack");
  });

  it("starts empty and replaces the core without reconstructing live controls", () => {
    const client: LivePhotoClient = { setEnabled: vi.fn(), search: vi.fn() };
    const harness = runtimeHarness([], client);

    expect(harness.renders.at(-1)).toEqual([]);
    harness.runtime.replaceCore([asset("late-core")]);

    expect(harness.renders.at(-1)).toEqual(["late-core"]);
    expect(harness.toggle.checked).toBe(false);
  });

  it("rejects a stale live response after a newer search", async () => {
    const first = deferred<{ status: "online"; records: CatalogAssetV1[] }>();
    const second = deferred<{ status: "online"; records: CatalogAssetV1[] }>();
    const client: LivePhotoClient = {
      setEnabled: vi.fn(),
      search: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
    };
    const harness = runtimeHarness([asset("core")], client);
    harness.input.value = "first";
    harness.toggle.checked = true;
    harness.toggle.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    harness.input.value = "market";
    harness.input.dispatchEvent(new Event("input"));

    second.resolve({ status: "online", records: [asset("new", "photo")] });
    await Promise.resolve();
    first.resolve({ status: "online", records: [asset("stale", "photo")] });
    await harness.runtime.settled();

    expect(harness.renders.at(-1)).toEqual(["new"]);
  });

  it("renders core immediately but debounces fast typing to one live request", async () => {
    vi.useFakeTimers();
    try {
      const client: LivePhotoClient = {
        setEnabled: vi.fn(),
        search: vi.fn().mockResolvedValue({ status: "online", records: [] })
      };
      const harness = runtimeHarness([asset("core")], client, 250);
      harness.toggle.checked = true;
      for (const query of ["bo", "bot", "bott", "bottle"]) {
        harness.input.value = query;
        harness.input.dispatchEvent(new Event("input"));
      }

      expect(harness.renders.at(-1)).toEqual(["core"]);
      expect(client.search).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(249);
      expect(client.search).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await harness.runtime.settled();

      expect(client.search).toHaveBeenCalledOnce();
      expect(client.search).toHaveBeenCalledWith("bottle");
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels scheduled live work when the teacher disables it or the runtime is destroyed", async () => {
    vi.useFakeTimers();
    try {
      const client: LivePhotoClient = { setEnabled: vi.fn(), search: vi.fn() };
      const harness = runtimeHarness([asset("core")], client, 250);
      harness.input.value = "bottle";
      harness.toggle.checked = true;
      harness.toggle.dispatchEvent(new Event("change"));
      harness.toggle.checked = false;
      harness.toggle.dispatchEvent(new Event("change"));
      await vi.advanceTimersByTimeAsync(300);
      expect(client.search).not.toHaveBeenCalled();

      harness.toggle.checked = true;
      harness.toggle.dispatchEvent(new Event("change"));
      harness.runtime.destroy();
      await vi.advanceTimersByTimeAsync(300);
      expect(client.search).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

class PlacementCanvas implements CanvasPort {
  readonly objects: Array<Record<string, unknown>>;
  readonly removed: string[] = [];
  readonly artworkAdds: Array<{
    address: ArtworkSurfaceAddress;
    input: NewRasterInput;
  }> = [];
  readonly artworkRemoved: Array<{
    address: ArtworkSurfaceAddress;
    childId: string;
  }> = [];
  serializeTransform?: (state: Record<string, unknown>) => void;
  removeArtworkFailure?: Error;

  constructor(objects: Array<Record<string, unknown>> = []) {
    this.objects = structuredClone(objects);
  }

  async addRaster(input: { id: string; assetId: string; sameOriginUrl: string; accessibleName: string }): Promise<void> {
    this.objects.push({
      type: "image",
      objectId: input.id,
      elementKind: "image",
      assetId: input.assetId,
      accessibleName: input.accessibleName,
      src: new URL(input.sameOriginUrl, window.location.href).href
    });
  }
  async addLogoMark(_input: NewLogoMarkInput): Promise<void> { throw new Error("not used"); }
  async replaceLogoMark(_id: string, _input: LogoMarkSource): Promise<void> {
    throw new Error("not used");
  }
  listLogoMarks(): readonly LogoMarkSnapshot[] { return []; }
  async addProductShell(input: {
    id: string;
    shellId: string;
    svg: string;
    accessibleName: string;
  }): Promise<void> {
    this.objects.push({
      type: "group",
      objectId: input.id,
      elementKind: "product-shell",
      shellId: input.shellId,
      accessibleName: input.accessibleName,
      svg: input.svg
    });
  }
  async addProductVariant(input: NewProductVariantInput): Promise<void> {
    this.objects.push({
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
      artwork: input.artwork
    });
  }
  async addArtworkText(_address: ArtworkSurfaceAddress, _input: NewTextInput): Promise<void> {
    throw new Error("Unexpected artwork-surface command");
  }
  async addArtworkShape(_address: ArtworkSurfaceAddress, _input: NewShapeInput): Promise<void> {
    throw new Error("Unexpected artwork-surface command");
  }
  async addArtworkRaster(address: ArtworkSurfaceAddress, input: NewRasterInput): Promise<void> {
    this.artworkAdds.push({
      address: structuredClone(address),
      input: structuredClone(input)
    });
    this.#artworkSlot(address).push({
      type: "image",
      objectId: input.id,
      elementKind: "image",
      assetId: input.assetId,
      accessibleName: input.accessibleName,
      productLayer: "student-artwork",
      src: new URL(input.sameOriginUrl, window.location.href).href
    });
  }
  setArtworkText(_address: ArtworkSurfaceAddress, _id: string, _value: string): void {
    throw new Error("Unexpected artwork-surface command");
  }
  removeArtwork(address: ArtworkSurfaceAddress, childId: string): void {
    this.artworkRemoved.push({ address: structuredClone(address), childId });
    if (this.removeArtworkFailure) throw this.removeArtworkFailure;
    const objects = this.#artworkSlot(address);
    const index = objects.findIndex((object) => object.objectId === childId);
    if (index >= 0) objects.splice(index, 1);
  }
  setProductShellRegion(): void { throw new Error("not used"); }
  getProductShellRegionColours(): Readonly<Record<string, string>> { return {}; }
  remove(id: string): void {
    this.removed.push(id);
    const index = this.objects.findIndex(({ objectId }) => objectId === id);
    if (index >= 0) this.objects.splice(index, 1);
  }
  serialize(): Record<string, unknown> {
    const state: Record<string, unknown> = {
      version: "7.4.0",
      objects: structuredClone(this.objects)
    };
    this.serializeTransform?.(state);
    return state;
  }
  setSelected(): void {}
  setText(): void {}
  async addText(): Promise<void> { throw new Error("not used"); }
  async addShape(): Promise<void> { throw new Error("not used"); }
  transform(): void {}
  async duplicate(): Promise<void> {}
  move(): void {}
  setLocked(): void {}
  setVisible(): void {}
  getCropSourceSize() { return { width: 1, height: 1 }; }
  setCrop(): void {}
  setDrawingTool(): void {}
  eraseTopmostDrawing(): boolean { return false; }
  exportCleanPngDataUrl(): string { return ""; }
  async load(): Promise<void> {}
  subscribe(_listener: CanvasMutationListener): () => void { return () => {}; }

  #artworkSlot(address: ArtworkSurfaceAddress): Array<Record<string, unknown>> {
    const product = this.objects.find((object) => object.objectId === address.productId);
    if (!product || !Array.isArray(product.objects)) {
      throw new Error("Product artwork surface was not found");
    }
    const slot = (product.objects as Array<Record<string, unknown>>).find((object) =>
      object.productLayer === "artwork-slot" && object.artworkSlotId === address.slotId
    );
    if (!slot || !Array.isArray(slot.objects)) {
      throw new Error("Product artwork slot was not found");
    }
    return slot.objects as Array<Record<string, unknown>>;
  }
}

const ARTWORK_ADDRESS: ArtworkSurfaceAddress = {
  productId: "product-1",
  slotId: "primary"
};

function productObject(
  productId = ARTWORK_ADDRESS.productId,
  slotId = ARTWORK_ADDRESS.slotId
): Record<string, unknown> {
  return {
    type: "group",
    objectId: productId,
    elementKind: "product-shell",
    accessibleName: `${productId} product`,
    left: 48,
    top: 72,
    scaleX: 1.25,
    scaleY: 0.8,
    angle: 12,
    clipPath: { type: "rect", width: 320, height: 220 },
    objects: [
      { type: "path", productLayer: "base-shell" },
      {
        type: "group",
        productLayer: "artwork-slot",
        artworkSlotId: slotId,
        objects: [{
          type: "rect",
          objectId: `${productId}-sibling-artwork`,
          elementKind: "shape",
          accessibleName: "Existing sibling artwork"
        }]
      }
    ]
  };
}

function semanticImage(objectId: string, assetId = "existing-asset"): Record<string, unknown> {
  return {
    type: "image",
    objectId,
    elementKind: "image",
    accessibleName: "Existing catalogue image",
    assetId
  };
}

function placementDocument(objects: Array<Record<string, unknown>>): CampaignDocumentV1 {
  return parseCampaignDocument({
    ...createBlankCampaignDocument({
      documentId: "targeted-placement-document",
      sessionId: "targeted-placement-session",
      mode: "offline"
    }),
    fabricState: { version: "7.4.0", objects: structuredClone(objects) }
  });
}

function stateObjects(state: Record<string, unknown>): Array<Record<string, unknown>> {
  if (!Array.isArray(state.objects)) throw new Error("Expected Fabric state objects");
  return state.objects as Array<Record<string, unknown>>;
}

function objectChildren(object: Record<string, unknown>): Array<Record<string, unknown>> {
  if (!Array.isArray(object.objects)) throw new Error("Expected Fabric object children");
  return object.objects as Array<Record<string, unknown>>;
}

function findSemanticObject(
  objects: Array<Record<string, unknown>>,
  objectId: string
): Record<string, unknown> | undefined {
  for (const object of objects) {
    if (object.objectId === objectId) return object;
    if (Array.isArray(object.objects)) {
      const found = findSemanticObject(
        object.objects as Array<Record<string, unknown>>,
        objectId
      );
      if (found) return found;
    }
  }
  return undefined;
}

function productSlot(
  objects: Array<Record<string, unknown>>,
  productId = ARTWORK_ADDRESS.productId,
  slotId = ARTWORK_ADDRESS.slotId
): Record<string, unknown> {
  const product = objects.find((object) => object.objectId === productId);
  if (!product) throw new Error(`Expected product ${productId}`);
  const slot = objectChildren(product).find((object) =>
    object.productLayer === "artwork-slot" && object.artworkSlotId === slotId
  );
  if (!slot) throw new Error(`Expected artwork slot ${slotId}`);
  return slot;
}

const artworkReconciliationCases: Array<[
  string,
  (state: Record<string, unknown>, childId: string) => void
]> = [
  ["a top-level requested product", (state) => {
    const objects = stateObjects(state);
    const index = objects.findIndex((object) => object.objectId === ARTWORK_ADDRESS.productId);
    if (index < 0) return;
    const [product] = objects.splice(index, 1);
    if (!product) return;
    objects.unshift({ type: "group", objects: [product] });
  }],
  ["the exact root-slot-child path", (state, childId) => {
    const slot = productSlot(stateObjects(state));
    const children = objectChildren(slot);
    const index = children.findIndex((object) => object.objectId === childId);
    if (index < 0) return;
    const [child] = children.splice(index, 1);
    if (!child) return;
    children.push({ type: "group", objects: [child] });
  }],
  ["the requested product root", (state, childId) => {
    const objects = stateObjects(state);
    const source = objectChildren(productSlot(objects));
    const index = source.findIndex((object) => object.objectId === childId);
    if (index < 0) return;
    const [child] = source.splice(index, 1);
    if (!child) return;
    objectChildren(productSlot(objects, "product-2")).push(child);
  }],
  ["a product-shell root", (state) => {
    const product = stateObjects(state).find((object) =>
      object.objectId === ARTWORK_ADDRESS.productId
    );
    if (product) product.elementKind = "shape";
  }],
  ["an artwork-slot direct parent", (state) => {
    const product = stateObjects(state).find((object) =>
      object.objectId === ARTWORK_ADDRESS.productId
    );
    const slot = product && objectChildren(product).find((object) =>
      object.artworkSlotId === ARTWORK_ADDRESS.slotId
    );
    if (slot) slot.productLayer = "base-shell";
  }],
  ["the named artwork slot", (state) => {
    const product = stateObjects(state).find((object) =>
      object.objectId === ARTWORK_ADDRESS.productId
    );
    const slot = product && objectChildren(product).find((object) =>
      object.productLayer === "artwork-slot"
    );
    if (slot) slot.artworkSlotId = "secondary";
  }],
  ["the generated child ID", (state, childId) => {
    const child = findSemanticObject(stateObjects(state), childId);
    if (child) child.objectId = "different-child";
  }],
  ["an image child", (state, childId) => {
    const child = findSemanticObject(stateObjects(state), childId);
    if (child) child.elementKind = "shape";
  }],
  ["the requested asset ID", (state, childId) => {
    const child = findSemanticObject(stateObjects(state), childId);
    if (child) child.assetId = "different-asset";
  }]
];

describe("CataloguePlacementQueue", () => {
  it("places through ObjectCommandService and commits a durable catalogue reference", async () => {
    const canvas = new PlacementCanvas();
    let document: CampaignDocumentV1 = createBlankCampaignDocument({
      documentId: "placement-document",
      sessionId: "placement-session",
      mode: "offline"
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next) => { document = next; },
      createObjectId: () => "catalog-object"
    });

    queue.enqueue(asset("core"));
    await queue.flush();

    expect(canvas.objects[0]).toMatchObject({ objectId: "catalog-object", assetId: "core" });
    expect(document.assetReferences).toEqual([{
      kind: "catalog",
      objectId: "catalog-object",
      assetId: "core",
      assetVersion: 1,
      attribution: asset("core").attribution
    }]);
    expect(canvas.artworkAdds).toEqual([]);
  });

  it("places offline catalogue artwork inside the named product slot", async () => {
    const canvas = new PlacementCanvas([productObject()]);
    const originalProduct = structuredClone(canvas.objects[0]);
    if (!originalProduct) throw new Error("Expected product fixture");
    let document = placementDocument(canvas.objects);
    let attachment: unknown;
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next, localBlob) => { document = next; attachment = localBlob; },
      createObjectId: () => "targeted-offline-child"
    });

    queue.enqueueArtworkRaster(ARTWORK_ADDRESS, asset("core"));
    await queue.flush();

    expect(canvas.artworkAdds).toEqual([{
      address: ARTWORK_ADDRESS,
      input: {
        id: "targeted-offline-child",
        assetId: "core",
        sameOriginUrl: asset("core").files.master,
        accessibleName: asset("core").title
      }
    }]);
    expect(canvas.removed).toEqual([]);
    const committedObjects = stateObjects(document.fabricState);
    expect(committedObjects).toHaveLength(1);
    expect(committedObjects[0]).toMatchObject({
      objectId: originalProduct.objectId,
      left: originalProduct.left,
      top: originalProduct.top,
      scaleX: originalProduct.scaleX,
      scaleY: originalProduct.scaleY,
      angle: originalProduct.angle,
      clipPath: originalProduct.clipPath
    });
    expect(objectChildren(productSlot(committedObjects))).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectId: "product-1-sibling-artwork" }),
      expect.objectContaining({
        objectId: "targeted-offline-child",
        elementKind: "image",
        assetId: "core"
      })
    ]));
    expect(document.assetReferences).toEqual([{
      kind: "catalog",
      objectId: "targeted-offline-child",
      assetId: "core",
      assetVersion: 1,
      attribution: asset("core").attribution
    }]);
    expect(attachment).toBeUndefined();
  });

  it("captures live artwork bytes and commits child-scoped catalogue and blob references", async () => {
    const canvas = new PlacementCanvas([productObject()]);
    let document = placementDocument(canvas.objects);
    const bytes = Uint8Array.from([137, 80, 78, 71, 9, 8, 7]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(bytes, {
      headers: { "content-type": "image/png", "content-length": String(bytes.length) }
    }));
    const objectUrl = `blob:${window.location.origin}/targeted-live-child`;
    const revokeObjectURL = vi.fn();
    let attachment: {
      blobKey: string;
      blob: Blob;
      objectUrl: string;
    } | undefined;
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next, localBlob) => { document = next; attachment = localBlob; },
      createObjectId: () => "targeted-live-child",
      fetch: fetchMock,
      createObjectURL: () => objectUrl,
      revokeObjectURL
    });

    queue.enqueueArtworkRaster(ARTWORK_ADDRESS, openverseAsset());
    await queue.flush();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(canvas.artworkAdds[0]).toMatchObject({
      address: ARTWORK_ADDRESS,
      input: {
        id: "targeted-live-child",
        assetId: OPENVERSE_ID,
        sameOriginUrl: objectUrl
      }
    });
    expect(document.assetReferences).toEqual([
      expect.objectContaining({
        kind: "catalog",
        objectId: "targeted-live-child",
        assetId: OPENVERSE_ID
      }),
      expect.objectContaining({
        kind: "local-blob",
        objectId: "targeted-live-child",
        assetId: OPENVERSE_ID,
        blobKey: "catalog-targeted-live-child",
        mimeType: "image/png"
      })
    ]);
    expect(attachment).toMatchObject({
      blobKey: "catalog-targeted-live-child",
      objectUrl
    });
    await expect(attachment!.blob.arrayBuffer()).resolves.toEqual(bytes.buffer);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("clones the artwork address and asset when enqueueing", async () => {
    const canvas = new PlacementCanvas([productObject()]);
    let document = placementDocument(canvas.objects);
    const address = structuredClone(ARTWORK_ADDRESS);
    const selectedAsset = asset("clone-core");
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next) => { document = next; },
      createObjectId: () => "cloned-input-child"
    });

    queue.enqueueArtworkRaster(address, selectedAsset);
    address.productId = "mutated-product";
    address.slotId = "mutated-slot";
    selectedAsset.id = "mutated-asset";
    selectedAsset.title = "Mutated title";
    selectedAsset.files.master = "/mutated.png";
    selectedAsset.attribution.creator = "Mutated creator";
    await queue.flush();

    expect(canvas.artworkAdds[0]).toEqual({
      address: ARTWORK_ADDRESS,
      input: {
        id: "cloned-input-child",
        assetId: "clone-core",
        sameOriginUrl: asset("clone-core").files.master,
        accessibleName: asset("clone-core").title
      }
    });
    expect(document.assetReferences).toContainEqual(expect.objectContaining({
      objectId: "cloned-input-child",
      assetId: "clone-core",
      attribution: asset("clone-core").attribution
    }));
  });

  it("rejects a generated child ID already in the committed document before fetch or mutation", async () => {
    const childId = "committed-duplicate-child";
    const canvas = new PlacementCanvas([productObject()]);
    const document = placementDocument([productObject(), semanticImage(childId)]);
    const fetchMock = vi.fn();
    const commit = vi.fn();
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit,
      createObjectId: () => childId,
      fetch: fetchMock
    });

    queue.enqueueArtworkRaster(ARTWORK_ADDRESS, openverseAsset());
    await expect(queue.flush()).rejects.toThrow(/already exists/i);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(canvas.artworkAdds).toEqual([]);
    expect(canvas.artworkRemoved).toEqual([]);
    expect(canvas.removed).toEqual([]);
    expect(commit).not.toHaveBeenCalled();
  });

  it("rejects a generated child ID already on the live canvas before fetch or mutation", async () => {
    const childId = "live-duplicate-child";
    const canvas = new PlacementCanvas([productObject(), semanticImage(childId)]);
    const document = placementDocument([productObject()]);
    const fetchMock = vi.fn();
    const commit = vi.fn();
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit,
      createObjectId: () => childId,
      fetch: fetchMock
    });

    queue.enqueueArtworkRaster(ARTWORK_ADDRESS, openverseAsset());
    await expect(queue.flush()).rejects.toThrow(/already exists/i);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(canvas.artworkAdds).toEqual([]);
    expect(canvas.artworkRemoved).toEqual([]);
    expect(canvas.removed).toEqual([]);
    expect(commit).not.toHaveBeenCalled();
  });

  it.each(artworkReconciliationCases)(
    "requires %s when reconciling targeted catalogue artwork",
    async (_label, mutate) => {
      const childId = "reconciliation-child";
      const canvas = new PlacementCanvas([productObject(), productObject("product-2")]);
      canvas.serializeTransform = (state) => { mutate(state, childId); };
      const document = placementDocument(canvas.objects);
      const commit = vi.fn();
      const queue = new CataloguePlacementQueue({
        getDocument: () => document,
        getCanvas: async () => canvas,
        commit,
        createObjectId: () => childId
      });

      queue.enqueueArtworkRaster(ARTWORK_ADDRESS, asset("core"));
      await expect(queue.flush()).rejects.toThrow(
        "Placed catalogue artwork raster did not reconcile with the canvas"
      );

      expect(commit).not.toHaveBeenCalled();
      expect(canvas.artworkRemoved).toEqual([{
        address: ARTWORK_ADDRESS,
        childId
      }]);
      expect(canvas.removed).toEqual([]);
      expect(canvas.objects).toHaveLength(2);
      expect(findSemanticObject(canvas.objects, ARTWORK_ADDRESS.productId)).toBeDefined();
      expect(findSemanticObject(canvas.objects, "product-1-sibling-artwork")).toBeDefined();
      expect(findSemanticObject(canvas.objects, childId)).toBeUndefined();
    }
  );

  it("rolls back only the attempted child when targeted document commit fails", async () => {
    const childId = "targeted-commit-child";
    const canvas = new PlacementCanvas([productObject(), productObject("product-2")]);
    const baseline = canvas.serialize();
    const document = placementDocument(canvas.objects);
    const commitFailure = new Error("Synthetic targeted commit failure");
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: () => { throw commitFailure; },
      createObjectId: () => childId
    });

    queue.enqueueArtworkRaster(ARTWORK_ADDRESS, asset("core"));
    await expect(queue.flush()).rejects.toBe(commitFailure);

    expect(canvas.artworkRemoved).toEqual([{
      address: ARTWORK_ADDRESS,
      childId
    }]);
    expect(canvas.removed).toEqual([]);
    expect(canvas.serialize()).toEqual(baseline);
    expect(document.assetReferences).toEqual([]);
  });

  it("preserves the original live failure when child and URL cleanup both throw", async () => {
    const childId = "targeted-cleanup-child";
    const canvas = new PlacementCanvas([productObject()]);
    canvas.removeArtworkFailure = new Error("Synthetic child cleanup failure");
    const document = placementDocument(canvas.objects);
    const commitFailure = new Error("Synthetic targeted live commit failure");
    const objectUrl = `blob:${window.location.origin}/${childId}`;
    const revokeObjectURL = vi.fn(() => {
      throw new Error("Synthetic URL cleanup failure");
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: () => { throw commitFailure; },
      createObjectId: () => childId,
      fetch: vi.fn().mockResolvedValue(new Response(Uint8Array.from([1, 2, 3]), {
        headers: { "content-type": "image/webp", "content-length": "3" }
      })),
      createObjectURL: () => objectUrl,
      revokeObjectURL
    });

    queue.enqueueArtworkRaster(ARTWORK_ADDRESS, openverseAsset());
    await expect(queue.flush()).rejects.toBe(commitFailure);

    expect(canvas.artworkRemoved).toEqual([{
      address: ARTWORK_ADDRESS,
      childId
    }]);
    expect(canvas.removed).toEqual([]);
    expect(findSemanticObject(canvas.objects, ARTWORK_ADDRESS.productId)).toBeDefined();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  it("serialises raster and product-shell placements through one shared tail", async () => {
    const canvas = new PlacementCanvas();
    let document: CampaignDocumentV1 = createBlankCampaignDocument({
      documentId: "mixed-placement-document",
      sessionId: "mixed-placement-session",
      mode: "offline"
    });
    const ids = ["catalog-object", "shell-object"];
    const fetchMock = vi.fn(async () => new Response(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>',
      { status: 200, headers: { "content-type": "image/svg+xml" } }
    ));
    const shell: ProductShellRecord = {
      id: "drinks-classic-can",
      title: "Classic Soft Drink Can",
      family: "drinks-snacks",
      template: "can",
      authoringUrl: `${window.location.origin}/catalog/generated/product-shells-v1/shells/drinks-classic-can/authoring.svg`,
      previewUrl: `${window.location.origin}/catalog/generated/product-shells-v1/shells/drinks-classic-can/preview.svg`,
      regions: ["body", "accent"],
      printAreas: [{ id: "front", x: 0.2, y: 0.2, width: 0.6, height: 0.6, safeInset: 0.03 }],
      partSlots: [],
      classroomReviewed: true,
      brandFree: true
    };
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next) => { document = next; },
      createObjectId: () => ids.shift() ?? "extra-object",
      fetch: fetchMock
    });

    queue.enqueue(asset("core"));
    queue.enqueueProductShell(shell, "product-shells-v1");
    await queue.flush();

    expect(canvas.objects).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectId: "catalog-object", elementKind: "image" }),
      expect.objectContaining({ objectId: "shell-object", elementKind: "product-shell", shellId: shell.id })
    ]));
    expect(document.assetReferences).toEqual([
      expect.objectContaining({ kind: "catalog", objectId: "catalog-object", assetId: "core" }),
      {
        kind: "product-shell",
        objectId: "shell-object",
        shellId: shell.id,
        packId: "product-shells-v1",
        version: 1
      }
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fetches, places and records one resolved product look on the shared tail", async () => {
    const packRoot = join("catalog", "generated", "product-builder-pilot-v1");
    const catalogue = parseProductBuilderCatalogue(
      JSON.parse(readFileSync(join(packRoot, "catalogue.json"), "utf8")),
      `${window.location.origin}/catalog/generated/product-builder-pilot-v1/catalogue.json`
    );
    if (!catalogue) throw new Error("Reviewed product builder fixture did not parse");
    const variant = createVirtualProductVariantResolver(catalogue).resolveVariant({
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-spout",
      paletteId: "cobalt-citrus",
      materialId: "fabric"
    });
    if (!variant) throw new Error("Expected product look fixture");
    const canvas = new PlacementCanvas();
    let document: CampaignDocumentV1 = createBlankCampaignDocument({
      documentId: "product-look-document",
      sessionId: "product-look-session",
      mode: "offline"
    });
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const pathname = new URL(String(input)).pathname;
      const relative = pathname.split("/product-builder-pilot-v1/")[1];
      if (!relative) return new Response("missing", { status: 404 });
      expect(init).toMatchObject({
        method: "GET",
        credentials: "same-origin",
        redirect: "error"
      });
      return new Response(readFileSync(join(packRoot, relative), "utf8"), {
        status: 200,
        headers: { "content-type": "image/svg+xml" }
      });
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next) => { document = next; },
      createObjectId: () => "product-look-1",
      fetch: fetchMock
    });

    queue.enqueueProductVariant(variant, { id: "front-art", colour: "#F2385A" });
    await queue.flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(canvas.objects).toContainEqual(expect.objectContaining({
      objectId: "product-look-1",
      variantId: variant.id,
      bodyId: variant.bodyId,
      partId: variant.partId,
      paletteId: variant.paletteId,
      materialId: variant.materialId
    }));
    expect(document.assetReferences).toEqual([{
      kind: "product-builder-variant",
      version: 1,
      objectId: "product-look-1",
      packId: variant.packId,
      variantId: variant.id,
      bodyId: variant.bodyId,
      partId: variant.partId,
      paletteId: variant.paletteId,
      materialId: variant.materialId,
      artwork: { id: "front-art", colour: "#F2385A" }
    }]);
  });

  it("keeps the committed product reconciled when its placement notification throws", async () => {
    const packRoot = join("catalog", "generated", "product-builder-pilot-v1");
    const catalogue = parseProductBuilderCatalogue(
      JSON.parse(readFileSync(join(packRoot, "catalogue.json"), "utf8")),
      `${window.location.origin}/catalog/generated/product-builder-pilot-v1/catalogue.json`
    );
    if (!catalogue) throw new Error("Reviewed product builder fixture did not parse");
    const variant = createVirtualProductVariantResolver(catalogue).resolveVariant({
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-spout",
      paletteId: "cobalt-citrus",
      materialId: "fabric"
    });
    if (!variant) throw new Error("Expected product look fixture");
    const canvas = new PlacementCanvas();
    let document: CampaignDocumentV1 = createBlankCampaignDocument({
      documentId: "notification-document",
      sessionId: "notification-session",
      mode: "offline"
    });
    const onError = vi.fn();
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next) => { document = next; },
      createObjectId: () => "notification-object",
      fetch: vi.fn(async (input) => {
        const relative = new URL(String(input)).pathname
          .split("/product-builder-pilot-v1/")[1];
        if (!relative) return new Response("missing", { status: 404 });
        return new Response(readFileSync(join(packRoot, relative), "utf8"), {
          headers: { "content-type": "image/svg+xml" }
        });
      }),
      onProductVariantPlaced: () => { throw new Error("Inspector notification failed"); },
      onError
    });

    queue.enqueueProductVariant(variant);
    await expect(queue.flush()).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: "Inspector notification failed"
    }));
    expect(canvas.removed).toEqual([]);
    expect(canvas.objects).toContainEqual(expect.objectContaining({
      objectId: "notification-object",
      variantId: variant.id
    }));
    expect(document.fabricState.objects).toContainEqual(expect.objectContaining({
      objectId: "notification-object",
      variantId: variant.id
    }));
    expect(document.assetReferences).toContainEqual(expect.objectContaining({
      kind: "product-builder-variant",
      objectId: "notification-object",
      variantId: variant.id
    }));
  });

  it("does not mutate the canvas when a product look source is not SVG", async () => {
    const packRoot = join("catalog", "generated", "product-builder-pilot-v1");
    const catalogue = parseProductBuilderCatalogue(
      JSON.parse(readFileSync(join(packRoot, "catalogue.json"), "utf8")),
      `${window.location.origin}/catalog/generated/product-builder-pilot-v1/catalogue.json`
    );
    if (!catalogue) throw new Error("Reviewed product builder fixture did not parse");
    const variant = createVirtualProductVariantResolver(catalogue).pageVariants({}, { limit: 1 }).items[0];
    if (!variant) throw new Error("Expected product look fixture");
    const canvas = new PlacementCanvas();
    const document = createBlankCampaignDocument({
      documentId: "bad-look-document",
      sessionId: "bad-look-session",
      mode: "offline"
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: () => { throw new Error("Commit must not run"); },
      createObjectId: () => "bad-look",
      fetch: vi.fn(async () => new Response("not svg", {
        status: 200,
        headers: { "content-type": "text/plain" }
      }))
    });

    queue.enqueueProductVariant(variant);

    await expect(queue.flush()).rejects.toThrow("not SVG");
    expect(canvas.objects).toEqual([]);
    expect(canvas.removed).toEqual([]);
  });

  it("rolls back the Fabric object when document reconciliation fails", async () => {
    const canvas = new PlacementCanvas();
    const document = createBlankCampaignDocument({
      documentId: "rollback-document",
      sessionId: "rollback-session",
      mode: "offline"
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: () => { throw new Error("Synthetic reconciliation failure"); },
      createObjectId: () => "rollback-object"
    });

    queue.enqueue(asset("core"));
    await expect(queue.flush()).rejects.toThrow("Synthetic reconciliation failure");
    expect(canvas.removed).toEqual(["rollback-object"]);
    expect(canvas.objects).toEqual([]);
  });

  it("captures canonical live bytes and commits catalogue plus local-blob references", async () => {
    const canvas = new PlacementCanvas();
    let document: CampaignDocumentV1 = createBlankCampaignDocument({
      documentId: "live-document",
      sessionId: "live-session",
      mode: "offline"
    });
    const deadline = new AbortController().signal;
    const fetched = Uint8Array.from([137, 80, 78, 71, 1, 2, 3]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(fetched, {
      headers: { "content-type": "image/png", "content-length": String(fetched.length) }
    }));
    let attachment: {
      blobKey: string;
      blob: Blob;
      objectUrl: string;
    } | undefined;
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next, local) => { document = next; attachment = local; },
      createObjectId: () => "live-object",
      fetch: fetchMock,
      createDeadlineSignal: () => deadline,
      createObjectURL: () => `blob:${window.location.origin}/live-object`,
      revokeObjectURL: vi.fn()
    });

    queue.enqueue(openverseAsset());
    await queue.flush();

    expect(fetchMock).toHaveBeenCalledWith(
      `${window.location.origin}/api/openverse-image/${OPENVERSE_ID}`,
      expect.objectContaining({ method: "GET", signal: deadline })
    );
    expect(canvas.objects[0]?.src).toBe(`blob:${window.location.origin}/live-object`);
    expect(document.assetReferences).toEqual([
      expect.objectContaining({ kind: "catalog", objectId: "live-object", assetId: OPENVERSE_ID }),
      expect.objectContaining({
        kind: "local-blob",
        objectId: "live-object",
        assetId: OPENVERSE_ID,
        blobKey: "catalog-live-object",
        mimeType: "image/png"
      })
    ]);
    expect(attachment).toMatchObject({
      blobKey: "catalog-live-object",
      objectUrl: `blob:${window.location.origin}/live-object`
    });
    await expect(attachment!.blob.arrayBuffer()).resolves.toEqual(fetched.buffer);
  });

  it.each([
    ["unsupported MIME", new Response(Uint8Array.from([1]), {
      headers: { "content-type": "image/gif", "content-length": "1" }
    }), /image type/i],
    ["oversize length", new Response(Uint8Array.from([1]), {
      headers: { "content-type": "image/png", "content-length": String(12 * 1024 * 1024 + 1) }
    }), /too large/i]
  ])("rejects live placement with %s before adding Fabric", async (_label, response, message) => {
    const canvas = new PlacementCanvas();
    const document = createBlankCampaignDocument({
      documentId: "invalid-live-document",
      sessionId: "invalid-live-session",
      mode: "offline"
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: vi.fn(),
      fetch: vi.fn().mockResolvedValue(response),
      createObjectId: () => "invalid-live-object",
      createObjectURL: vi.fn(),
      revokeObjectURL: vi.fn()
    });

    queue.enqueue(openverseAsset());
    await expect(queue.flush()).rejects.toThrow(message);
    expect(canvas.objects).toEqual([]);
  });

  it("removes Fabric and revokes captured live bytes when commit fails", async () => {
    const canvas = new PlacementCanvas();
    const revokeObjectURL = vi.fn();
    const document = createBlankCampaignDocument({
      documentId: "live-rollback-document",
      sessionId: "live-rollback-session",
      mode: "offline"
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: () => { throw new Error("Synthetic live commit failure"); },
      fetch: vi.fn().mockResolvedValue(new Response(Uint8Array.from([1, 2]), {
        headers: { "content-type": "image/webp", "content-length": "2" }
      })),
      createObjectId: () => "live-rollback-object",
      createObjectURL: () => `blob:${window.location.origin}/live-rollback-object`,
      revokeObjectURL
    });

    queue.enqueue(openverseAsset());
    await expect(queue.flush()).rejects.toThrow("Synthetic live commit failure");
    expect(canvas.removed).toEqual(["live-rollback-object"]);
    expect(revokeObjectURL).toHaveBeenCalledWith(`blob:${window.location.origin}/live-rollback-object`);
  });
});
