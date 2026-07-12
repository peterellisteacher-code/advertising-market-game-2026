import { describe, expect, it, vi } from "vitest";
import { createBlankCampaignDocument, type CampaignDocumentV1 } from "../domain/campaign-document";
import type { CanvasMutationListener, CanvasPort } from "../fabric/canvas-port";
import type { CatalogAssetV1 } from "./catalogue-types";
import {
  CataloguePlacementQueue,
  CatalogueRuntime,
  type CatalogueRenderer,
  type LivePhotoClient
} from "./catalogue-runtime";

const asset = (id: string, kind: CatalogAssetV1["kind"] = "component"): CatalogAssetV1 => ({
  schema: "catalog-asset@1",
  id,
  version: 2,
  kind,
  title: kind === "photo" ? "Market photo" : "Reviewed bottle",
  category: kind === "photo" ? "photos" : "drinkware",
  tags: [kind === "photo" ? "market" : "bottle"],
  files: {
    thumbnail: `/catalog/${id}-192.webp`,
    preview: `/catalog/${id}-640.webp`,
    master: `/catalog/${id}.png`
  },
  recolourZones: [],
  anchors: [],
  materialProfiles: [],
  classroomReviewed: kind !== "photo",
  brandFree: kind !== "photo",
  attribution: {
    creator: kind === "photo" ? "A. Photographer" : "Classroom pack",
    sourceUrl: kind === "photo" ? "https://example.test/photo" : "local",
    license: kind === "photo" ? "CC BY 4.0" : "classroom-session"
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
      .mockResolvedValueOnce({ status: "online", records: [asset("remote", "photo")] })
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
  readonly objects: Array<Record<string, unknown>> = [];
  readonly removed: string[] = [];
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
  remove(id: string): void {
    this.removed.push(id);
    const index = this.objects.findIndex(({ objectId }) => objectId === id);
    if (index >= 0) this.objects.splice(index, 1);
  }
  serialize(): Record<string, unknown> { return { version: "7.4.0", objects: structuredClone(this.objects) }; }
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
}

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
      assetVersion: 2,
      attribution: asset("core").attribution
    }]);
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
});
