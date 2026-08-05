import type { Canvas } from "fabric";
import {
  ActiveSelection,
  FabricImage,
  FabricObject,
  FixedLayout,
  Group,
  LayoutManager,
  Point,
  Rect,
  Textbox,
  util
} from "fabric";
import { describe, expect, it, vi } from "vitest";
import type { LogoIconRecord } from "../logo-lab/logo-icon-catalogue";
import { createLogoMarkDesign } from "../logo-lab/logo-mark-model";
import type { ResolvedProductVariant } from "../product-builder/virtual-product-variant";
import type { CanvasMutation, NewProductKitInput } from "./canvas-port";
import { FabricCanvasAdapter } from "./fabric-canvas-adapter";
import { FabricProductShellFactory, productArtworkSurface } from "./product-shell-factory";
import { FabricObjectFactory } from "./object-factory";
import type { FabricProductKitCompositor } from "../product-kit/fabric-product-kit-compositor";
import type {
  LoadedRasterSectionFillSource,
  RasterSectionFillEngine
} from "../tools/raster-section-fill-renderer";

class FakeCanvas {
  objects: FabricObject[] = [];
  activeObject: FabricObject | null = null;
  failExport = false;
  readonly renderSnapshots: Array<{
    active: FabricObject | null;
    order: FabricObject[];
    visible: boolean[];
  }> = [];
  readonly nestedGuideSnapshots: boolean[][] = [];
  readonly groupDirtySnapshots: boolean[][] = [];
  readonly loadFromJSON = vi.fn(async (_value: Record<string, unknown>) => this);
  readonly listeners = new Map<string, Set<(event: { target: FabricObject }) => void>>();
  readonly toObject = vi.fn((_properties?: string[]) => ({
    version: "7.4.0",
    objects: this.objects.map((object) => object.toObject())
  }));
  fire(event: string, payload: { target: FabricObject }): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }
  on(event: string, listener: (event: { target: FabricObject }) => void): () => void {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return () => listeners.delete(listener);
  }
  getObjects(): FabricObject[] { return this.objects; }
  add(object: FabricObject): void {
    this.objects.push(object);
    this.#fire("object:added", object);
  }
  insertAt(index: number, ...objects: FabricObject[]): number {
    this.objects.splice(index, 0, ...objects);
    objects.forEach((object) => this.#fire("object:added", object));
    return this.objects.length;
  }
  readonly remove = vi.fn((object: FabricObject): void => {
    const index = this.objects.indexOf(object);
    if (index >= 0) {
      this.objects.splice(index, 1);
      this.#fire("object:removed", object);
    }
  });
  getActiveObject(): FabricObject | undefined { return this.activeObject ?? undefined; }
  getActiveObjects(): FabricObject[] {
    if (this.activeObject instanceof ActiveSelection) return this.activeObject.getObjects();
    return this.activeObject ? [this.activeObject] : [];
  }
  discardActiveObject(): void {
    if (this.activeObject instanceof ActiveSelection) this.activeObject.onDeselect();
    this.activeObject = null;
  }
  setActiveObject(object: FabricObject): void {
    if (this.activeObject !== object) this.discardActiveObject();
    this.activeObject = object;
  }
  moveObjectTo(object: FabricObject, index: number): boolean {
    const current = this.objects.indexOf(object);
    if (current < 0) return false;
    this.objects.splice(current, 1);
    this.objects.splice(index, 0, object);
    return current !== index;
  }
  requestRenderAll(): void {}
  getScenePoint(event: { clientX: number; clientY: number }): Point {
    const canvas = this as unknown as {
      width?: number;
      height?: number;
      upperCanvasEl?: { getBoundingClientRect(): DOMRect };
    };
    const bounds = canvas.upperCanvasEl?.getBoundingClientRect();
    const width = canvas.width ?? bounds?.width ?? 1;
    const height = canvas.height ?? bounds?.height ?? 1;
    return new Point(
      (event.clientX - (bounds?.left ?? 0)) * width / (bounds?.width || width),
      (event.clientY - (bounds?.top ?? 0)) * height / (bounds?.height || height)
    );
  }
  toDataURL(options: { format: string; multiplier: number }): string {
    expect(options).toEqual({ format: "png", multiplier: 1 });
    this.renderSnapshots.push({
      active: this.activeObject,
      order: [...this.objects],
      visible: this.objects.map((object) => object.visible)
    });
    this.nestedGuideSnapshots.push(this.objects.flatMap((object) =>
      object instanceof Group
        ? object.getObjects().filter((child) => child.editorGuide).map((child) => child.visible)
        : []));
    this.groupDirtySnapshots.push(this.objects
      .filter((object): object is Rect & Group => object instanceof Group)
      .map((object) => object.dirty));
    if (this.failExport) throw new Error("Synthetic clean-export failure");
    return "data:image/png;base64,cHJvYmU=";
  }

  #fire(event: string, target: FabricObject): void {
    this.listeners.get(event)?.forEach((listener) => listener({ target }));
  }
}

const CLIPPED_SHELL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <defs>
    <clipPath id="front-clip">
      <rect x="300" y="280" width="400" height="440" rx="30" />
    </clipPath>
  </defs>
  <g data-region="body" fill="#E8E2D8">
    <rect x="250" y="120" width="500" height="760" rx="80" />
  </g>
  <g data-layer="artwork-slot" data-artwork-slot="primary" clip-path="url(#front-clip)">
    <rect data-student-artwork="base-art" x="300" y="280" width="400" height="440" fill="#FFFFFF" />
  </g>
  <g data-material-treatment="fabric" opacity="0.08">
    <rect x="0" y="0" width="1000" height="1000" fill="#172033" />
  </g>
</svg>`;

const TINY_PNG =
  "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=";

function installCurvedLabelCanvas(): void {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function () {
    return {
      font: "",
      fillStyle: "#000000",
      textAlign: "start",
      textBaseline: "alphabetic",
      globalAlpha: 1,
      measureText(value: string) {
        const size = Number.parseFloat(
          (this as unknown as CanvasRenderingContext2D).font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? "16"
        );
        return { width: [...value].length * size * 0.58 } as TextMetrics;
      },
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      drawImage: vi.fn()
    } as unknown as CanvasRenderingContext2D;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(TINY_PNG);
}

function productKitArtworkRoot(productKitId: string): {
  product: Group;
  surface: Group;
  slotId: string;
} {
  const slotId = `artwork:${productKitId}:0`;
  const body = new Rect({
    width: 146,
    height: 238,
    left: 0,
    top: 0,
    originX: "center",
    originY: "center",
    fill: "#F7F3EA",
    selectable: false,
    evented: false
  });
  body.set({ productLayer: "body" });
  const guide = new Rect({
    width: 112,
    height: 125,
    left: 0,
    top: 0,
    originX: "center",
    originY: "center",
    fill: "rgba(0,0,0,0)",
    selectable: false,
    evented: false
  });
  const surface = new Group([guide], {
    width: 112,
    height: 125,
    left: 0,
    top: 0,
    originX: "center",
    originY: "center",
    selectable: false,
    evented: false,
    layoutManager: new LayoutManager(new FixedLayout())
  });
  surface.set({ productLayer: "artwork-slot", artworkSlotId: slotId });
  const product = new Group([body, surface], {
    width: 146,
    height: 238,
    left: 800,
    top: 450,
    originX: "center",
    originY: "center",
    layoutManager: new LayoutManager(new FixedLayout())
  });
  product.set({
    objectId: `product-${productKitId}`,
    elementKind: "product-kit",
    accessibleName: productKitId === "pk1-tumbler-kit" ? "Reusable tumbler" : "Television",
    productKitPackId: "pk1-pilot-drinkware",
    productKitId,
    productKitCatalogSha256: "a".repeat(64)
  });
  return { product, surface, slotId };
}

const LOGO_ICON: LogoIconRecord = Object.freeze({
  id: "paw",
  title: "Paw",
  body: '<path fill="none" stroke="currentColor" stroke-width="2" d="M4 12h16"/>',
  width: 24,
  height: 24,
  categories: Object.freeze(["pets-animals"])
});

const logoDesign = (recipe: "icon-wordmark" | "badge-seal" = "icon-wordmark") =>
  createLogoMarkDesign({
    recipe,
    text: recipe === "icon-wordmark" ? "Nova Pet" : "Nova Club",
    iconId: LOGO_ICON.id,
    primary: recipe === "icon-wordmark" ? "#0B6E99" : "#7C3AED",
    secondary: recipe === "icon-wordmark" ? "#F6C85F" : "#FDE047",
    typeface: recipe === "icon-wordmark" ? "Trebuchet MS" : "Verdana",
    seed: recipe === "icon-wordmark" ? 41 : 82,
    revision: recipe === "icon-wordmark" ? 0 : 1
  });

describe("FabricCanvasAdapter persistence", () => {
  it("registers each Product Kit identity property exactly once in the central list", () => {
    for (const property of [
      "productKitPackId",
      "productKitId",
      "productKitCatalogSha256",
      "productKitComposition",
      "curvedTextSource",
      "curvedTextProfile",
      "curvedTextColour",
      "curvedTextFontFamily"
    ]) {
      expect(FabricObject.customProperties.filter((candidate) => candidate === property))
        .toHaveLength(1);
    }
  });

  it("rejects a serialized external image before Fabric loads it", async () => {
    const canvas = new FakeCanvas();
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);

    await expect(adapter.load({
      version: "7.4.0",
      objects: [{ type: "FabricImage", src: "https://unsafe.example/tracker.png" }]
    })).rejects.toThrow("same-origin");

    expect(canvas.loadFromJSON).not.toHaveBeenCalled();
  });

  it("loads a legacy catalogue image from a sibling Netlify deploy through the current origin", async () => {
    const originalWindow = globalThis.window;
    vi.stubGlobal("window", {
      ...originalWindow,
      location: {
        href: "https://new-build--advertising-market-game-2026.netlify.app/",
        origin: "https://new-build--advertising-market-game-2026.netlify.app"
      }
    });
    try {
      const canvas = new FakeCanvas();
      const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
      const saved = {
        version: "7.4.0",
        objects: [{
          type: "Group",
          objects: [{
            type: "Image",
            src: "https://old-build--advertising-market-game-2026.netlify.app/catalog/generated/tv.png"
          }]
        }]
      };

      await adapter.load(saved);

      expect(canvas.loadFromJSON).toHaveBeenCalledWith({
        version: "7.4.0",
        objects: [{
          type: "Group",
          objects: [{
            type: "Image",
            src: "https://new-build--advertising-market-game-2026.netlify.app/catalog/generated/tv.png"
          }]
        }]
      });
      expect(saved.objects[0]!.objects[0]!.src).toContain("old-build--");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("serializes nested catalogue image sources as root-relative paths", () => {
    const canvas = new FakeCanvas();
    const currentOrigin = window.location.origin;
    canvas.toObject.mockReturnValueOnce({
      version: "7.4.0",
      objects: [{
        type: "Group",
        objects: [{
          type: "Image",
          src: `${currentOrigin}/catalog/generated/tv.png`
        }]
      }]
    });
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);

    expect(adapter.serialize()).toMatchObject({
      objects: [{ objects: [{ src: "/catalog/generated/tv.png" }] }]
    });
  });

  it("serializes interaction state and restores 44-pixel controls", async () => {
    const canvas = new FakeCanvas();
    const object = new Rect({
      width: 100,
      height: 100,
      cornerSize: 13,
      touchCornerSize: 24,
      borderColor: "#abcdef",
      cornerColor: "#fedcba",
      cornerStrokeColor: "#123456",
      selectable: false,
      visible: false,
      lockMovementX: true
    });
    object.objectId = "shape-1";
    object.elementKind = "shape";
    object.accessibleName = "Locked shape";
    canvas.objects = [object];
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);

    adapter.serialize();
    expect(canvas.toObject).toHaveBeenCalledWith(expect.arrayContaining([
      "cornerSize",
      "touchCornerSize",
      "borderColor",
      "cornerColor",
      "cornerStrokeColor",
      "selectable",
      "visible",
      "lockMovementX"
    ]));

    await adapter.load({ version: "7.4.0", objects: [] });
    expect(object).toMatchObject({
      cornerSize: 44,
      touchCornerSize: 44,
      transparentCorners: false,
      borderScaleFactor: 3,
      borderColor: "#075985",
      cornerColor: "#f4c95d",
      cornerStrokeColor: "#172033",
      selectable: false,
      visible: false,
      lockMovementX: true
    });
  });

  it("omits Fabric's undefined object properties from durable canvas state", () => {
    const canvas = new FakeCanvas();
    const raw = {
      version: "7.4.0",
      objects: [{
        type: "Textbox",
        objectId: "text-1",
        elementKind: "text",
        accessibleName: "Campaign headline",
        text: "Make room for adventure",
        path: undefined,
        styles: { fill: "#111827", stroke: undefined }
      }]
    };
    canvas.toObject.mockReturnValueOnce(raw);
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);

    expect(adapter.serialize()).toStrictEqual({
      version: "7.4.0",
      objects: [{
        type: "Textbox",
        objectId: "text-1",
        elementKind: "text",
        accessibleName: "Campaign headline",
        text: "Make room for adventure",
        styles: { fill: "#111827" }
      }]
    });
    expect(raw.objects[0]).toHaveProperty("path", undefined);
    expect(raw.objects[0]!.styles).toHaveProperty("stroke", undefined);
  });

  it.each([false, true])("restores selection and guide visibility/order after clean export (failure=%s)", (failure) => {
    const canvas = new FakeCanvas();
    const content = new Rect({ width: 40, height: 40 });
    const firstGuide = new Rect({ width: 1, height: 900, visible: true });
    const hiddenGuide = new Rect({ width: 1600, height: 1, visible: false });
    firstGuide.editorGuide = true;
    hiddenGuide.editorGuide = true;
    canvas.objects = [firstGuide, content, hiddenGuide];
    canvas.activeObject = content;
    canvas.failExport = failure;
    const orderBefore = [...canvas.objects];
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);

    if (failure) expect(() => adapter.exportCleanPngDataUrl()).toThrow("Synthetic clean-export failure");
    else expect(adapter.exportCleanPngDataUrl()).toBe("data:image/png;base64,cHJvYmU=");

    expect(canvas.renderSnapshots).toEqual([{
      active: null,
      order: orderBefore,
      visible: [false, true, false]
    }]);
    expect(canvas.activeObject).toBe(content);
    expect(canvas.objects).toEqual(orderBefore);
    expect(firstGuide.visible).toBe(true);
    expect(hiddenGuide.visible).toBe(false);
  });

  it("hides nested product-shell guides during clean export and restores them", () => {
    const canvas = new FakeCanvas();
    const artwork = new Rect({ width: 120, height: 80 });
    const printGuide = new Rect({ width: 100, height: 60, visible: true });
    const safeGuide = new Rect({ width: 80, height: 40, visible: true });
    printGuide.editorGuide = true;
    safeGuide.editorGuide = true;
    const shell = new Group([artwork, printGuide, safeGuide]);
    shell.objectId = "shell-1";
    shell.elementKind = "product-shell";
    shell.shellId = "drinks-classic-can";
    shell.dirty = false;
    canvas.objects = [shell as unknown as Rect];
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);

    expect(adapter.exportCleanPngDataUrl()).toContain("data:image/png");

    expect(canvas.nestedGuideSnapshots).toEqual([[false, false]]);
    expect(canvas.groupDirtySnapshots).toEqual([[true]]);
    expect(printGuide.visible).toBe(true);
    expect(safeGuide.visible).toBe(true);
  });

  it("adds and recolours a semantic product shell through the canvas port", async () => {
    const canvas = new FakeCanvas();
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);

    await adapter.addProductShell({
      id: "shell-2",
      shellId: "drinks-classic-can",
      accessibleName: "Classic Soft Drink Can",
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
        '<g data-region="body" fill="#EEEEEE"><rect x="10" y="10" width="80" height="80"/></g>' +
        '<g data-region="accent" fill="#E66B3F"><rect x="20" y="20" width="10" height="60"/></g>' +
        '</svg>'
    });
    adapter.setProductShellRegion("shell-2", "accent", "#157A6E");
    expect(adapter.getProductShellRegionColours("shell-2")).toMatchObject({
      body: "#EEEEEE",
      accent: "#157A6E"
    });

    expect(canvas.objects).toHaveLength(1);
    const shell = canvas.objects[0];
    expect(shell).toBeDefined();
    if (!shell) throw new Error("Expected product shell");
    expect(shell).toMatchObject({
      objectId: "shell-2",
      elementKind: "product-shell",
      shellId: "drinks-classic-can"
    });
    expect(shell.toObject()).toMatchObject({
      objectId: "shell-2",
      elementKind: "product-shell",
      shellId: "drinks-classic-can"
    });
  });

  it("composes a product look before mutating the canvas", async () => {
    const canvas = new FakeCanvas();
    const created = new Group([new Rect({ width: 100, height: 100 })]);
    created.objectId = "look-1";
    created.elementKind = "product-shell";
    created.shellId = "drinkware-classic-can";
    const createVariant = vi.fn().mockResolvedValue(created);
    const shellFactory = {
      create: vi.fn(),
      createVariant
    } as unknown as FabricProductShellFactory;
    const adapter = new FabricCanvasAdapter(
      canvas as unknown as Canvas,
      undefined,
      shellFactory
    );
    const variant = Object.freeze({
      id: "product-builder-variant@1:product-builder-pilot-v1:drinkware-classic-can:drinkware-top-ring:cobalt-citrus:fabric",
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-ring",
      paletteId: "cobalt-citrus",
      materialId: "fabric"
    }) as unknown as ResolvedProductVariant;

    await adapter.addProductVariant({
      id: "look-1",
      accessibleName: "Cobalt Citrus Classic Can",
      variant,
      authoringSvg: "<svg></svg>",
      componentSvg: "<svg></svg>",
      artwork: { id: "front-art", colour: "#F2385A" }
    });

    expect(createVariant).toHaveBeenCalledWith(expect.objectContaining({
      id: "look-1",
      variant,
      mode: "editor"
    }));
    expect(canvas.objects).toEqual([created]);

    createVariant.mockRejectedValueOnce(new Error("Synthetic composition failure"));
    await expect(adapter.addProductVariant({
      id: "look-2",
      accessibleName: "Broken look",
      variant,
      authoringSvg: "<svg></svg>",
      componentSvg: "<svg></svg>"
    })).rejects.toThrow("Synthetic composition failure");
    expect(canvas.objects).toEqual([created]);
  });

  it("composes one Product Kit group before the sole top-level canvas add", async () => {
    const canvas = new FakeCanvas();
    const created = new Group([new Rect({ width: 100, height: 100 })]);
    created.objectId = "kit-object-1";
    created.elementKind = "product-kit";
    const create = vi.fn().mockResolvedValue(created);
    const compositor = { create } as unknown as FabricProductKitCompositor;
    const adapter = new FabricCanvasAdapter(
      canvas as unknown as Canvas,
      undefined,
      undefined,
      undefined,
      compositor
    );
    const input = {
      id: "kit-object-1",
      accessibleName: "Reusable tumbler",
      catalogue: {},
      plan: {},
      rasterSources: new Map()
    } as unknown as NewProductKitInput;

    await adapter.addProductKit(input);

    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith(input);
    expect(canvas.objects).toEqual([created]);

    create.mockRejectedValueOnce(new Error("Synthetic PNG load failure"));
    await expect(adapter.addProductKit({ ...input, id: "kit-object-2" }))
      .rejects.toThrow("Synthetic PNG load failure");
    expect(canvas.objects).toEqual([created]);
  });

  it("rejects Product Kit duplication before clone, add or selection mutation", async () => {
    const canvas = new FakeCanvas();
    const selected = new Rect({ width: 40, height: 40 });
    selected.set({
      objectId: "selected-shape",
      elementKind: "shape",
      accessibleName: "Selected shape"
    });
    const productKit = new Group([new Rect({ width: 100, height: 100 })]);
    productKit.set({
      objectId: "kit-object-1",
      elementKind: "product-kit",
      accessibleName: "Reusable tumbler"
    });
    canvas.objects = [selected, productKit];
    canvas.activeObject = selected;
    const clone = vi.spyOn(productKit, "clone");
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));

    await expect(adapter.duplicate("kit-object-1", "kit-object-copy"))
      .rejects.toThrow(/Product Kit.*duplicat/i);

    expect(clone).not.toHaveBeenCalled();
    expect(canvas.objects).toEqual([selected, productKit]);
    expect(canvas.objects.map(({ objectId }) => objectId))
      .toEqual(["selected-shape", "kit-object-1"]);
    expect(canvas.activeObject).toBe(selected);
    expect(mutations).toEqual([]);
  });

  it("snapshots and restores an exact ordered semantic multi-selection", () => {
    const canvas = new FakeCanvas();
    const first = new Rect({ width: 40, height: 40, left: 10 });
    first.set({ objectId: "shape-first", elementKind: "shape", accessibleName: "First" });
    const second = new Rect({ width: 40, height: 40, left: 60 });
    second.set({ objectId: "shape-second", elementKind: "shape", accessibleName: "Second" });
    const third = new Rect({ width: 40, height: 40, left: 110 });
    third.set({ objectId: "shape-third", elementKind: "shape", accessibleName: "Third" });
    canvas.objects = [first, second, third];
    canvas.activeObject = new ActiveSelection([third, first], {
      multiSelectionStacking: "selection-order"
    });
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    const durableBefore = adapter.serialize();

    const snapshot = adapter.captureSelection();
    adapter.setSelected("shape-second");
    adapter.restoreSelection(snapshot);

    expect(snapshot).toEqual({ objectIds: ["shape-third", "shape-first"] });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.objectIds)).toBe(true);
    expect(canvas.activeObject).toBeInstanceOf(ActiveSelection);
    expect((canvas.activeObject as ActiveSelection).getObjects()).toEqual([third, first]);
    expect(adapter.serialize()).toEqual(durableBefore);
    expect(adapter.serialize()).not.toHaveProperty("selection");
  });

  it("validates every selection snapshot ID before changing the active object", () => {
    const canvas = new FakeCanvas();
    const selected = new Rect({ width: 40, height: 40 });
    selected.set({ objectId: "shape-selected", elementKind: "shape", accessibleName: "Selected" });
    canvas.objects = [selected];
    canvas.activeObject = selected;
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);

    expect(() => adapter.restoreSelection({
      objectIds: ["shape-selected", "shape-selected"]
    })).toThrow(/duplicate.*selection/i);
    expect(canvas.activeObject).toBe(selected);

    expect(() => adapter.restoreSelection({
      objectIds: ["missing-shape"]
    })).toThrow(/missing object/i);
    expect(canvas.activeObject).toBe(selected);
  });

  it("lists semantic canvas roots with geometry, state and stack order", () => {
    const canvas = new FakeCanvas();
    const back = new Rect({ left: 12, top: 24, scaleX: 1.5, scaleY: 0.75 });
    back.set({
      objectId: "shape-back",
      elementKind: "shape",
      accessibleName: "Blue background block"
    });
    const front = new Textbox("Sale", {
      left: 90,
      top: 45,
      visible: false,
      selectable: false,
      evented: false,
      lockMovementX: true
    });
    front.set({
      objectId: "text-front",
      elementKind: "text",
      accessibleName: "Sale heading"
    });
    canvas.objects = [back, front];
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);

    expect(adapter.listObjectSummaries()).toEqual([
      {
        id: "shape-back",
        accessibleName: "Blue background block",
        elementKind: "shape",
        x: 12,
        y: 24,
        scaleX: 1.5,
        scaleY: 0.75,
        visible: true,
        locked: false,
        stackIndex: 0
      },
      {
        id: "text-front",
        accessibleName: "Sale heading",
        elementKind: "text",
        x: 90,
        y: 45,
        scaleX: 1,
        scaleY: 1,
        visible: false,
        locked: true,
        stackIndex: 1
      }
    ]);
    expect(Object.isFrozen(adapter.listObjectSummaries())).toBe(true);
  });

  it("notifies selection subscribers for pointer and programmatic changes", () => {
    const canvas = new FakeCanvas();
    const first = new Rect({ width: 40, height: 40 });
    first.set({ objectId: "shape-first", elementKind: "shape", accessibleName: "First" });
    const second = new Rect({ width: 40, height: 40 });
    second.set({ objectId: "shape-second", elementKind: "shape", accessibleName: "Second" });
    canvas.objects = [first, second];
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    const selections: string[][] = [];
    const unsubscribe = adapter.subscribeSelection(({ objectIds }) => {
      selections.push([...objectIds]);
    });

    adapter.setSelected("shape-first");
    canvas.activeObject = second;
    canvas.fire("selection:updated", { target: second });
    adapter.setSelected(null);
    unsubscribe();
    adapter.setSelected("shape-first");

    expect(selections).toEqual([
      ["shape-first"],
      ["shape-second"],
      []
    ]);
  });

  it("renders, edits and round-trips tumbler words as curved artwork", async () => {
    installCurvedLabelCanvas();
    const { product, surface, slotId } = productKitArtworkRoot("pk1-tumbler-kit");
    const canvas = new FakeCanvas();
    canvas.objects = [product];
    canvas.activeObject = product;
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    const target = { productId: product.objectId!, slotId };
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));

    expect(adapter.firstArtworkSurfaceAddress(product.objectId!)).toEqual(target);
    expect(adapter.firstArtworkTextId(target)).toBeNull();
    await adapter.addArtworkText(target, {
      id: "curved-label-1",
      value: "Refill. Roam. Repeat.",
      accessibleName: "Tumbler label",
      fontFamily: "Russo One"
    });
    expect(adapter.firstArtworkTextId(target)).toBe("curved-label-1");

    const curved = surface.getObjects().find(({ objectId }) => objectId === "curved-label-1");
    expect(curved).toBeInstanceOf(FabricImage);
    expect(curved).toMatchObject({
      elementKind: "text",
      accessibleName: "Tumbler label",
      curvedTextSource: "Refill. Roam. Repeat.",
      curvedTextProfile: "cylinder-front",
      curvedTextColour: "#111827",
      curvedTextFontFamily: "Russo One"
    });
    expect((curved as FabricImage).getOriginalSize()).toEqual({ width: 1_024, height: 512 });
    expect((curved as FabricImage).getScaledWidth()).toBeLessThanOrEqual(surface.width * 0.82 + 0.001);
    expect((curved as FabricImage).getScaledHeight()).toBeLessThanOrEqual(surface.height * 0.82 + 0.001);
    const firstElement = (curved as FabricImage).getElement();
    const firstScale = { x: curved!.scaleX, y: curved!.scaleY };
    const firstCentre = curved!.getCenterPoint();

    await adapter.setArtworkText(target, "curved-label-1", "Warm drinks. Less waste.");

    expect((curved as FabricImage).getElement()).not.toBe(firstElement);
    expect(curved).toMatchObject({
      curvedTextSource: "Warm drinks. Less waste.",
      curvedTextFontFamily: "Russo One",
      scaleX: firstScale.x,
      scaleY: firstScale.y
    });
    expect(curved!.getCenterPoint().x).toBeCloseTo(firstCentre.x, 10);
    expect(curved!.getCenterPoint().y).toBeCloseTo(firstCentre.y, 10);
    expect((curved as FabricImage).getOriginalSize()).toEqual({ width: 1_024, height: 512 });
    const editedElement = (curved as FabricImage).getElement();
    await adapter.setArtworkText(
      target,
      "curved-label-1",
      "Warm drinks. Less waste.",
      "Bebas Neue"
    );
    expect((curved as FabricImage).getElement()).not.toBe(editedElement);
    expect(curved).toMatchObject({
      curvedTextSource: "Warm drinks. Less waste.",
      curvedTextFontFamily: "Bebas Neue"
    });
    expect(mutations).toEqual([
      { type: "modified", objectId: product.objectId },
      { type: "modified", objectId: product.objectId },
      { type: "modified", objectId: product.objectId }
    ]);

    const serialized = product.toObject();
    const serializedLabel = (
      (serialized.objects as unknown as Array<Record<string, unknown>>)
        .find(({ artworkSlotId }) => artworkSlotId === slotId)
        ?.objects as Array<Record<string, unknown>>
    ).find(({ objectId }) => objectId === "curved-label-1");
    expect(serializedLabel).toMatchObject({
      type: "Image",
      src: TINY_PNG,
      curvedTextSource: "Warm drinks. Less waste.",
      curvedTextProfile: "cylinder-front",
      curvedTextFontFamily: "Bebas Neue"
    });

    vi.spyOn(FabricImage, "fromObject").mockImplementation(async (value) => {
      const element = document.createElement("canvas");
      element.width = 1_024;
      element.height = 512;
      return new FabricImage(element, value as never);
    });
    const restored = await Group.fromObject(serialized);
    const restoredCanvas = new FakeCanvas();
    restoredCanvas.objects = [restored];
    const restoredAdapter = new FabricCanvasAdapter(restoredCanvas as unknown as Canvas);
    const restoredSurface = restored.getObjects()
      .find(({ artworkSlotId }) => artworkSlotId === slotId);
    if (!(restoredSurface instanceof Group)) throw new Error("Expected restored artwork surface");
    const restoredCurved = restoredSurface.getObjects()
      .find(({ objectId }) => objectId === "curved-label-1");
    if (!(restoredCurved instanceof FabricImage)) throw new Error("Expected restored curved label");

    await restoredAdapter.setArtworkText(target, "curved-label-1", "Refill again.");

    expect(restoredCurved).toMatchObject({
      curvedTextSource: "Refill again.",
      curvedTextProfile: "cylinder-front",
      curvedTextFontFamily: "Bebas Neue"
    });
    expect(restoredCurved.getOriginalSize()).toEqual({ width: 1_024, height: 512 });
  }, 15_000);

  it("keeps non-drinkware product artwork as an ordinary editable Textbox", async () => {
    const { product, surface, slotId } = productKitArtworkRoot("pk1-tv-kit");
    const canvas = new FakeCanvas();
    canvas.objects = [product];
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);

    await adapter.addArtworkText(
      { productId: product.objectId!, slotId },
      { id: "screen-text", value: "Watch together", accessibleName: "Screen words" }
    );

    expect(surface.getObjects().find(({ objectId }) => objectId === "screen-text"))
      .toBeInstanceOf(Textbox);
  });

  it("adds and edits clipped artwork children with one parent mutation per action", async () => {
    const canvas = new FakeCanvas();
    const shell = await new FabricProductShellFactory().create({
      id: "product-1",
      shellId: "bags-tote",
      accessibleName: "Classic can",
      svg: CLIPPED_SHELL_SVG
    });
    canvas.objects = [shell];
    canvas.activeObject = shell;
    const factory = new FabricObjectFactory();
    const raster = new FabricImage(document.createElement("img"), {
      width: 120,
      height: 80
    });
    raster.set({
      objectId: "art-image-1",
      elementKind: "image",
      assetId: "fruit-1",
      accessibleName: "Sliced citrus"
    });
    vi.spyOn(factory, "createRaster").mockResolvedValue(raster);
    const adapter = new FabricCanvasAdapter(
      canvas as unknown as Canvas,
      factory
    );
    const target = { productId: "product-1", slotId: "primary" };
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));
    const before = {
      width: shell.width,
      height: shell.height,
      scaleX: shell.scaleX,
      scaleY: shell.scaleY
    };

    await adapter.addArtworkText(target, {
      id: "art-text-1",
      value: "Fizz first",
      accessibleName: "Front headline"
    });
    await adapter.addArtworkShape(target, {
      id: "art-shape-1",
      kind: "ellipse",
      fill: "#F2385A",
      accessibleName: "Front burst"
    });
    await adapter.addArtworkRaster(target, {
      id: "art-image-1",
      assetId: "fruit-1",
      sameOriginUrl: `${window.location.origin}/catalog/fruit.png`,
      accessibleName: "Sliced citrus"
    });
    adapter.setArtworkText(target, "art-text-1", "Fizz together");

    const surface = productArtworkSurface(shell);
    expect(canvas.objects).toEqual([shell]);
    expect(canvas.activeObject).toBe(shell);
    expect(surface.getObjects()).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectId: "art-text-1", text: "Fizz together" }),
      expect.objectContaining({ objectId: "art-shape-1", elementKind: "shape" }),
      expect.objectContaining({ objectId: "art-image-1", assetId: "fruit-1" })
    ]));
    expect(surface.getObjects().filter(({ objectId }) => objectId)).toHaveLength(3);
    expect(shell).toMatchObject(before);
    expect(mutations).toEqual(Array.from({ length: 4 }, () => ({
      type: "modified",
      objectId: "product-1"
    })));

    const restored = await Group.fromObject(shell.toObject());
    expect(productArtworkSurface(restored).getObjects()).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectId: "art-text-1", text: "Fizz together" }),
      expect.objectContaining({ objectId: "art-shape-1" }),
      expect.objectContaining({ objectId: "art-image-1", assetId: "fruit-1" })
    ]));
  }, 30_000);

  it("removes only one direct semantic artwork child and preserves the product shell", async () => {
    const canvas = new FakeCanvas();
    const shell = await new FabricProductShellFactory().create({
      id: "product-1",
      shellId: "bags-tote",
      accessibleName: "Classic can",
      svg: CLIPPED_SHELL_SVG
    });
    canvas.objects = [shell];
    canvas.activeObject = shell;
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    const target = { productId: "product-1", slotId: "primary" };
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));
    await adapter.addArtworkText(target, {
      id: "art-text-1",
      value: "Fizz first",
      accessibleName: "Front headline"
    });
    await adapter.addArtworkShape(target, {
      id: "art-shape-1",
      kind: "ellipse",
      fill: "#F2385A",
      accessibleName: "Front burst"
    });
    const surface = productArtworkSurface(shell, "primary");
    const removed = surface.getObjects().find(({ objectId }) => objectId === "art-text-1");
    const survivor = surface.getObjects().find(({ objectId }) => objectId === "art-shape-1");
    const structural = surface.getObjects().find(({ artworkId }) => artworkId === "base-art");
    if (!removed || !survivor || !structural) throw new Error("Expected artwork fixtures");
    const productGeometry = {
      left: shell.left,
      top: shell.top,
      width: shell.width,
      height: shell.height,
      scaleX: shell.scaleX,
      scaleY: shell.scaleY,
      angle: shell.angle,
      originX: shell.originX,
      originY: shell.originY
    };
    const surfaceGeometry = {
      left: surface.left,
      top: surface.top,
      width: surface.width,
      height: surface.height,
      scaleX: surface.scaleX,
      scaleY: surface.scaleY,
      angle: surface.angle,
      originX: surface.originX,
      originY: surface.originY
    };
    const clipPath = surface.clipPath;
    const layoutStrategy = surface.layoutManager.strategy;
    mutations.length = 0;

    adapter.removeArtwork(target, "art-text-1");

    expect(canvas.objects).toEqual([shell]);
    expect(canvas.remove).not.toHaveBeenCalled();
    expect(canvas.activeObject).toBe(shell);
    expect(shell.objectId).toBe("product-1");
    expect(shell).toMatchObject(productGeometry);
    expect(surface).toMatchObject(surfaceGeometry);
    expect(surface.clipPath).toBe(clipPath);
    expect(surface.layoutManager.strategy).toBe(layoutStrategy);
    expect(surface.getObjects()).not.toContain(removed);
    expect(surface.getObjects()).toContain(survivor);
    expect(surface.getObjects()).toContain(structural);
    expect(mutations).toEqual([{ type: "modified", objectId: "product-1" }]);
  }, 15_000);

  it("leaves serialization, selection and events unchanged for invalid artwork removal targets", async () => {
    const canvas = new FakeCanvas();
    const shell = await new FabricProductShellFactory().create({
      id: "product-1",
      shellId: "bags-tote",
      accessibleName: "Classic can",
      svg: CLIPPED_SHELL_SVG
    });
    canvas.objects = [shell];
    canvas.activeObject = shell;
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    const target = { productId: "product-1", slotId: "primary" };
    await adapter.addArtworkText(target, {
      id: "valid-child",
      value: "Keep me",
      accessibleName: "Kept headline"
    });
    const surface = productArtworkSurface(shell, "primary");
    const nestedSemantic = new Rect({ width: 20, height: 20 });
    nestedSemantic.set({
      objectId: "nested-child",
      elementKind: "shape",
      accessibleName: "Nested shape"
    });
    surface.add(new Group([nestedSemantic]));
    const decorative = new Rect({ width: 20, height: 20 });
    decorative.set({
      objectId: "decorative-child",
      elementKind: "shape",
      accessibleName: " "
    });
    surface.add(decorative);
    const structural = new Rect({ width: 20, height: 20 });
    structural.set({
      objectId: "structural-child",
      elementKind: "product-shell",
      accessibleName: "Nested product structure"
    });
    surface.add(structural);
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));
    const before = JSON.stringify(adapter.serialize());

    const attempts: Array<[() => void, string]> = [
      [() => adapter.removeArtwork(
        { productId: "missing-product", slotId: "primary" },
        "valid-child"
      ), "Missing object missing-product"],
      [() => adapter.removeArtwork(
        { productId: "product-1", slotId: "missing-slot" },
        "valid-child"
      ), "invalid artwork slot missing-slot"],
      [() => adapter.removeArtwork(target, "missing-child"), "missing-child is not removable artwork"],
      [() => adapter.removeArtwork(target, "nested-child"), "nested-child is not removable artwork"],
      [() => adapter.removeArtwork(
        target,
        "decorative-child"
      ), "decorative-child is not removable artwork"],
      [() => adapter.removeArtwork(
        target,
        "structural-child"
      ), "structural-child is not removable artwork"]
    ];

    for (const [attempt, message] of attempts) {
      expect(attempt).toThrow(message);
      expect(JSON.stringify(adapter.serialize())).toBe(before);
      expect(canvas.objects).toEqual([shell]);
      expect(canvas.remove).not.toHaveBeenCalled();
      expect(canvas.activeObject).toBe(shell);
      expect(mutations).toEqual([]);
    }
  }, 15_000);

  it("refits edited artwork text from its current content instead of its smallest historical scale", async () => {
    const canvas = new FakeCanvas();
    const shell = await new FabricProductShellFactory().create({
      id: "product-1",
      shellId: "bags-tote",
      accessibleName: "Classic can",
      svg: CLIPPED_SHELL_SVG
    });
    canvas.objects = [shell];
    canvas.activeObject = shell;
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    const target = { productId: "product-1", slotId: "primary" };
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));
    const shortText = "Fizz first";

    await adapter.addArtworkText(target, {
      id: "art-text-1",
      value: shortText,
      accessibleName: "Front headline"
    });

    const surface = productArtworkSurface(shell);
    const text = surface.getObjects().find(({ objectId }) => objectId === "art-text-1");
    if (!(text instanceof Textbox)) throw new Error("Expected nested artwork text");
    text.set({ angle: 17, flipX: true, flipY: true });
    text.setCoords();
    const shortScale = { x: text.scaleX, y: text.scaleY };
    const centre = text.getCenterPoint();
    const clipPath = surface.clipPath;
    const productGeometry = {
      left: shell.left,
      top: shell.top,
      width: shell.width,
      height: shell.height,
      scaleX: shell.scaleX,
      scaleY: shell.scaleY
    };
    const surfaceGeometry = {
      left: surface.left,
      top: surface.top,
      width: surface.width,
      height: surface.height,
      scaleX: surface.scaleX,
      scaleY: surface.scaleY
    };
    mutations.length = 0;
    const longText = (
      "Fizz first for every bright citrus adventure and every energetic afternoon. "
    ).repeat(12).trim();

    adapter.setArtworkText(target, "art-text-1", longText);

    expect(mutations).toEqual([{ type: "modified", objectId: "product-1" }]);
    expect(text.getScaledWidth()).toBeLessThanOrEqual(surface.width * 0.82 + 0.001);
    expect(text.getScaledHeight()).toBeLessThanOrEqual(surface.height * 0.82 + 0.001);
    expect(text.scaleX).toBeLessThan(shortScale.x);
    expect(text.scaleY).toBeLessThan(shortScale.y);
    expect(text.getCenterPoint().x).toBeCloseTo(centre.x, 10);
    expect(text.getCenterPoint().y).toBeCloseTo(centre.y, 10);
    expect(text).toMatchObject({ angle: 17, flipX: true, flipY: true });
    const editedLongScale = { x: text.scaleX, y: text.scaleY };

    const directCanvas = new FakeCanvas();
    const directShell = await new FabricProductShellFactory().create({
      id: "direct-product",
      shellId: "bags-tote",
      accessibleName: "Direct long-text can",
      svg: CLIPPED_SHELL_SVG
    });
    directCanvas.objects = [directShell];
    const directAdapter = new FabricCanvasAdapter(directCanvas as unknown as Canvas);
    await directAdapter.addArtworkText(
      { productId: "direct-product", slotId: "primary" },
      { id: "direct-long-text", value: longText, accessibleName: "Direct long headline" }
    );
    const directText = productArtworkSurface(directShell).getObjects()
      .find(({ objectId }) => objectId === "direct-long-text");
    if (!(directText instanceof Textbox)) throw new Error("Expected direct long artwork text");
    expect(editedLongScale.x).toBeCloseTo(directText.scaleX, 10);
    expect(editedLongScale.y).toBeCloseTo(directText.scaleY, 10);

    const restoredShell = await Group.fromObject(shell.toObject());
    const restoredCanvas = new FakeCanvas();
    restoredCanvas.objects = [restoredShell];
    const restoredAdapter = new FabricCanvasAdapter(restoredCanvas as unknown as Canvas);
    const restoredMutations: CanvasMutation[] = [];
    restoredAdapter.subscribe((mutation) => restoredMutations.push(mutation));
    const restoredSurface = productArtworkSurface(restoredShell);
    const restoredText = restoredSurface.getObjects()
      .find(({ objectId }) => objectId === "art-text-1");
    if (!(restoredText instanceof Textbox)) throw new Error("Expected restored artwork text");
    const restoredCentre = restoredText.getCenterPoint();

    restoredAdapter.setArtworkText(target, "art-text-1", shortText);

    expect(restoredText.scaleX).toBeCloseTo(shortScale.x, 10);
    expect(restoredText.scaleY).toBeCloseTo(shortScale.y, 10);
    expect(restoredText.getCenterPoint().x).toBeCloseTo(restoredCentre.x, 10);
    expect(restoredText.getCenterPoint().y).toBeCloseTo(restoredCentre.y, 10);
    expect(restoredText).toMatchObject({ angle: 17, flipX: true, flipY: true });
    expect(restoredSurface.clipPath).toBeDefined();
    expect(restoredCanvas.objects).toEqual([restoredShell]);
    expect(restoredMutations).toEqual([{ type: "modified", objectId: "product-1" }]);

    adapter.setArtworkText(target, "art-text-1", shortText);

    expect(text.scaleX).toBeGreaterThan(0);
    expect(text.scaleY).toBeGreaterThan(0);
    expect(text.scaleX).toBeLessThanOrEqual(1);
    expect(text.scaleY).toBeLessThanOrEqual(1);
    expect(text.scaleX).toBeCloseTo(shortScale.x, 10);
    expect(text.scaleY).toBeCloseTo(shortScale.y, 10);
    expect(text.getCenterPoint().x).toBeCloseTo(centre.x, 10);
    expect(text.getCenterPoint().y).toBeCloseTo(centre.y, 10);
    expect(text).toMatchObject({ angle: 17, flipX: true, flipY: true });
    expect(shell).toMatchObject(productGeometry);
    expect(surface).toMatchObject(surfaceGeometry);
    expect(surface.clipPath).toBe(clipPath);
    expect(surface.getObjects().find(({ objectId }) => objectId === "art-text-1")).toBe(text);
    expect(canvas.objects).toEqual([shell]);
    expect(canvas.activeObject).toBe(shell);
    expect(mutations).toEqual([
      { type: "modified", objectId: "product-1" },
      { type: "modified", objectId: "product-1" }
    ]);
    const beforeNoop = text.toObject();

    adapter.setArtworkText(target, "art-text-1", shortText);

    expect(text.toObject()).toEqual(beforeNoop);
    expect(mutations).toHaveLength(2);
  }, 15_000);

  it("leaves product artwork unchanged when a target or raster is rejected", async () => {
    const canvas = new FakeCanvas();
    const shell = await new FabricProductShellFactory().create({
      id: "product-1",
      shellId: "drinkware-classic-can",
      accessibleName: "Classic can",
      svg: CLIPPED_SHELL_SVG
    });
    canvas.objects = [shell];
    canvas.activeObject = shell;
    const factory = new FabricObjectFactory();
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas, factory);
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));
    const before = JSON.stringify(shell.toObject());

    await expect(adapter.addArtworkText(
      { productId: "product-1", slotId: "missing" },
      { id: "bad-text", value: "No", accessibleName: "Bad text" }
    )).rejects.toThrow("invalid artwork slot");
    vi.spyOn(factory, "createRaster").mockRejectedValueOnce(new Error("Synthetic raster failure"));
    await expect(adapter.addArtworkRaster(
      { productId: "product-1", slotId: "primary" },
      {
        id: "bad-image",
        assetId: "bad-asset",
        sameOriginUrl: `${window.location.origin}/catalog/bad.png`,
        accessibleName: "Bad image"
      }
    )).rejects.toThrow("Synthetic raster failure");

    expect(JSON.stringify(shell.toObject())).toBe(before);
    expect(canvas.objects).toEqual([shell]);
    expect(canvas.activeObject).toBe(shell);
    expect(mutations).toEqual([]);
  });
});

describe("FabricCanvasAdapter editable logo marks", () => {
  it("round-trips one semantic logo design through Fabric serialization", async () => {
    const canvas = new FakeCanvas();
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));
    await adapter.addLogoMark({ id: "logo-1", design: logoDesign(), icon: LOGO_ICON });
    expect(mutations).toEqual([{ type: "added", objectId: "logo-1" }]);
    const saved = adapter.serialize();
    const restoredCanvas = new FakeCanvas();
    restoredCanvas.loadFromJSON.mockImplementationOnce(async (value) => {
      restoredCanvas.objects = await util.enlivenObjects(
        value.objects as Record<string, unknown>[]
      );
      return restoredCanvas;
    });
    const restored = new FabricCanvasAdapter(restoredCanvas as unknown as Canvas);

    await restored.load(saved);

    expect(restored.listLogoMarks()).toEqual([{
      id: "logo-1",
      design: logoDesign()
    }]);
    const mark = restoredCanvas.objects[0];
    expect(mark).toBeInstanceOf(Group);
    expect((mark as Group).getObjects().map((child) => child.logoLayer)).toEqual([
      "container",
      "symbol",
      "wordmark"
    ]);
  });

  it("replaces a recipe atomically while preserving canvas state", async () => {
    const canvas = new FakeCanvas();
    const background = new Rect({ width: 50, height: 50 });
    background.objectId = "background";
    background.elementKind = "shape";
    background.accessibleName = "Background";
    canvas.objects.push(background);
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    await adapter.addLogoMark({ id: "logo-1", design: logoDesign(), icon: LOGO_ICON });
    const foreground = new Rect({ width: 40, height: 40 });
    foreground.objectId = "foreground";
    foreground.elementKind = "shape";
    foreground.accessibleName = "Foreground";
    canvas.objects.push(foreground);
    const original = canvas.objects[1]!;
    original.set({
      left: 211,
      top: 177,
      scaleX: 0.72,
      scaleY: 0.64,
      angle: 19,
      flipX: true,
      flipY: false,
      visible: false,
      selectable: false,
      evented: false,
      lockMovementX: true,
      lockMovementY: true,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true
    });
    canvas.activeObject = foreground;
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));

    await adapter.replaceLogoMark("logo-1", {
      design: logoDesign("badge-seal"),
      icon: LOGO_ICON
    });

    const replacement = canvas.objects[1]!;
    expect(canvas.objects).toEqual([background, replacement, foreground]);
    expect(replacement).not.toBe(original);
    expect(replacement).toMatchObject({
      objectId: "logo-1",
      logoRecipe: "badge-seal",
      left: 211,
      top: 177,
      scaleX: 0.72,
      scaleY: 0.64,
      angle: 19,
      flipX: true,
      flipY: false,
      visible: false,
      selectable: false,
      evented: false,
      lockMovementX: true,
      lockMovementY: true,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true
    });
    expect(canvas.activeObject).toBe(replacement);
    expect(adapter.listLogoMarks()).toEqual([{
      id: "logo-1",
      design: logoDesign("badge-seal")
    }]);
    expect(mutations).toEqual([{ type: "modified", objectId: "logo-1" }]);
  });

  it("rejects logo ID collisions before mutating the canvas", async () => {
    const canvas = new FakeCanvas();
    const collision = new Rect({ width: 20, height: 20 });
    collision.objectId = "logo-1:symbol";
    collision.elementKind = "shape";
    collision.accessibleName = "Existing symbol";
    canvas.objects.push(collision);
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));

    await expect(adapter.addLogoMark({
      id: "logo-1",
      design: logoDesign(),
      icon: LOGO_ICON
    })).rejects.toThrow(/duplicate.*logo-1:symbol/i);

    expect(canvas.objects).toEqual([collision]);
    expect(mutations).toEqual([]);
  });

  it("refuses ambiguous duplicate roots for listing or replacement", async () => {
    const canvas = new FakeCanvas();
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    await adapter.addLogoMark({ id: "logo-1", design: logoDesign(), icon: LOGO_ICON });
    const duplicate = await Group.fromObject(canvas.objects[0]!.toObject());
    canvas.objects.push(duplicate);
    const before = [...canvas.objects];
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));

    expect(() => adapter.listLogoMarks()).toThrow(/duplicate.*logo-1/i);
    await expect(adapter.replaceLogoMark("logo-1", {
      design: logoDesign("badge-seal"),
      icon: LOGO_ICON
    })).rejects.toThrow(/duplicate.*logo-1/i);

    expect(canvas.objects).toEqual(before);
    expect(mutations).toEqual([]);
  });

  it("rejects malformed logo roots and returns deeply immutable snapshots", async () => {
    const canvas = new FakeCanvas();
    const wrongType = new Rect({ width: 20, height: 20 });
    wrongType.objectId = "bad-logo";
    wrongType.elementKind = "logo-mark";
    wrongType.accessibleName = "Bad logo";
    canvas.objects = [wrongType];
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    expect(() => adapter.listLogoMarks()).toThrow(/not an editable logo mark/i);

    const incomplete = new Group([new Rect({ width: 10, height: 10 })]);
    incomplete.objectId = "incomplete-logo";
    incomplete.elementKind = "logo-mark";
    incomplete.accessibleName = "Incomplete logo";
    canvas.objects = [incomplete];
    expect(() => adapter.listLogoMarks()).toThrow(/logo recipe/i);

    canvas.objects = [];
    await adapter.addLogoMark({ id: "logo-1", design: logoDesign(), icon: LOGO_ICON });
    const snapshots = adapter.listLogoMarks();
    expect(Object.isFrozen(snapshots)).toBe(true);
    expect(Object.isFrozen(snapshots[0])).toBe(true);
    expect(Object.isFrozen(snapshots[0]!.design)).toBe(true);
  });

  it("leaves canvas state untouched when a replacement icon mismatches its design", async () => {
    const canvas = new FakeCanvas();
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    await adapter.addLogoMark({ id: "logo-1", design: logoDesign(), icon: LOGO_ICON });
    const original = canvas.objects[0]!;
    canvas.activeObject = original;
    const before = JSON.stringify(adapter.serialize());
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));

    await expect(adapter.replaceLogoMark("logo-1", {
      design: logoDesign("badge-seal"),
      icon: { ...LOGO_ICON, id: "rocket", title: "Rocket" }
    })).rejects.toThrow(/icon.*match/i);

    expect(JSON.stringify(adapter.serialize())).toBe(before);
    expect(canvas.objects).toEqual([original]);
    expect(canvas.activeObject).toBe(original);
    expect(mutations).toEqual([]);
  });
});

function eligibleRaster(id = "starter-1"): FabricImage {
  const source = document.createElement("canvas");
  source.width = 64;
  source.height = 48;
  vi.spyOn(source, "toDataURL").mockReturnValue(TINY_PNG);
  const image = new FabricImage(source);
  image.set({
    objectId: id,
    elementKind: "image",
    assetId: "shoe-starter",
    accessibleName: "Harbour shoe",
    sourceHash: "a".repeat(64),
    rasterSectionFillSourceUrl:
      `${window.location.origin}/catalog/generated/offline-core-v1/assets/shoe-starter/master.png`,
    rasterSectionFillMode: "connected-sections",
    rasterSectionFillProfile: "bounded-linework-v1",
    rasterSectionFillRecipes: []
  });
  return image;
}

function sectionFillRecipe() {
  return {
    schema: "raster-section-fill" as const,
    version: 1 as const,
    fillProfile: "bounded-linework-v1" as const,
    sourceAssetId: "shoe-starter",
    sourceSha256: "a".repeat(64),
    seedX: 20,
    seedY: 22,
    colour: "#E4572E",
    colourDistance: 48
  };
}

function sectionFillEngine() {
  const source: LoadedRasterSectionFillSource = {
    url: `${window.location.origin}/catalog/generated/offline-core-v1/assets/shoe-starter/master.png`,
    sha256: "a".repeat(64),
    pixels: {
      width: 64,
      height: 48,
      data: new Uint8ClampedArray(64 * 48 * 4)
    }
  };
  const rendered = document.createElement("canvas");
  rendered.width = 64;
  rendered.height = 48;
  vi.spyOn(rendered, "toDataURL").mockReturnValue(TINY_PNG);
  const engine: RasterSectionFillEngine = {
    load: vi.fn(async () => source),
    render: vi.fn(() => rendered)
  };
  return { source, rendered, engine };
}

describe("FabricCanvasAdapter raster section fill", () => {
  it("previews and cancels byte-exactly without serialising or emitting a mutation", async () => {
    const canvas = new FakeCanvas();
    const image = eligibleRaster();
    canvas.objects.push(image);
    const originalElement = image.getElement();
    const { rendered, engine } = sectionFillEngine();
    const adapter = new FabricCanvasAdapter(
      canvas as unknown as Canvas,
      undefined,
      undefined,
      undefined,
      undefined,
      engine
    );
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));
    const before = adapter.serialize();

    expect(await adapter.getFillableRaster("starter-1")).toEqual({
      id: "starter-1",
      assetId: "shoe-starter",
      sourceSha256: "a".repeat(64),
      width: 64,
      height: 48,
      sectionMode: "connected"
    });
    await adapter.previewRasterSectionFill("starter-1", sectionFillRecipe());

    expect(image.getElement()).toBe(rendered);
    expect(image.rasterSectionFillRecipes).toEqual([]);
    expect(adapter.serialize()).toEqual(before);
    expect(mutations).toEqual([]);

    adapter.cancelRasterSectionFillPreview("starter-1");

    expect(image.getElement()).toBe(originalElement);
    expect(adapter.serialize()).toEqual(before);
    expect(mutations).toEqual([]);
  });

  it("applies one ordered recipe and emits one durable mutation", async () => {
    const canvas = new FakeCanvas();
    const image = eligibleRaster();
    canvas.objects.push(image);
    const { rendered, engine } = sectionFillEngine();
    const adapter = new FabricCanvasAdapter(
      canvas as unknown as Canvas,
      undefined,
      undefined,
      undefined,
      undefined,
      engine
    );
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));

    await adapter.applyRasterSectionFill("starter-1", sectionFillRecipe());

    expect(image.getElement()).toBe(rendered);
    expect(image.rasterSectionFillRecipes).toEqual([sectionFillRecipe()]);
    expect(Object.isFrozen(image.rasterSectionFillRecipes)).toBe(true);
    expect(mutations).toEqual([{ type: "modified", objectId: "starter-1" }]);
    expect(adapter.serialize()).toMatchObject({
      objects: [{
        objectId: "starter-1",
        src: "/catalog/generated/offline-core-v1/assets/shoe-starter/master.png",
        rasterSectionFillRecipes: [sectionFillRecipe()]
      }]
    });
  });

  it("fails closed on a source-hash mismatch and leaves the original unchanged", async () => {
    const canvas = new FakeCanvas();
    const image = eligibleRaster();
    canvas.objects.push(image);
    const originalElement = image.getElement();
    const { source, engine } = sectionFillEngine();
    (engine.load as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...source,
      sha256: "b".repeat(64)
    });
    const adapter = new FabricCanvasAdapter(
      canvas as unknown as Canvas,
      undefined,
      undefined,
      undefined,
      undefined,
      engine
    );
    const mutations: CanvasMutation[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation));

    await expect(adapter.previewRasterSectionFill("starter-1", sectionFillRecipe()))
      .rejects.toThrow(/source.*changed/i);

    expect(image.getElement()).toBe(originalElement);
    expect(image.rasterSectionFillRecipes).toEqual([]);
    expect(mutations).toEqual([]);
  });

  it("replays recipes from the immutable source while loading saved state", async () => {
    const canvas = new FakeCanvas();
    const restored = eligibleRaster();
    restored.rasterSectionFillRecipes = [sectionFillRecipe()];
    canvas.loadFromJSON.mockImplementationOnce(async () => {
      canvas.objects = [restored];
      return canvas;
    });
    const { rendered, engine } = sectionFillEngine();
    const adapter = new FabricCanvasAdapter(
      canvas as unknown as Canvas,
      undefined,
      undefined,
      undefined,
      undefined,
      engine
    );

    await adapter.load({
      version: "7.4.0",
      objects: [restored.toObject()]
    });

    expect(engine.load).toHaveBeenCalledWith(
      `${window.location.origin}/catalog/generated/offline-core-v1/assets/shoe-starter/master.png`
    );
    expect(engine.render).toHaveBeenCalledWith(
      expect.objectContaining({ sha256: "a".repeat(64) }),
      [sectionFillRecipe()]
    );
    expect(restored.getElement()).toBe(rendered);
  });

  it("inverse-maps a browser point through the viewport and object transform", () => {
    const canvas = new FakeCanvas();
    const image = eligibleRaster();
    image.set({ left: 100, top: 80, scaleX: 2, scaleY: 2 });
    image.setCoords();
    canvas.objects.push(image);
    Object.assign(canvas, {
      width: 1600,
      height: 900,
      viewportTransform: [1, 0, 0, 1, 0, 0],
      upperCanvasEl: {
        getBoundingClientRect: () => ({
          left: 10,
          top: 20,
          width: 800,
          height: 450
        })
      }
    });
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);

    expect(adapter.rasterSourcePoint("starter-1", { x: 60, y: 60 })).toEqual({
      x: 32,
      y: 24
    });
  });
});
