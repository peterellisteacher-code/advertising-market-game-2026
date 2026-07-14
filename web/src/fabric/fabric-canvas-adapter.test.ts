import type { Canvas } from "fabric";
import { FabricImage, type FabricObject, Group, Rect } from "fabric";
import { describe, expect, it, vi } from "vitest";
import type { ResolvedProductVariant } from "../product-builder/virtual-product-variant";
import type { CanvasMutation } from "./canvas-port";
import { FabricCanvasAdapter } from "./fabric-canvas-adapter";
import { FabricProductShellFactory, productArtworkSurface } from "./product-shell-factory";
import { FabricObjectFactory } from "./object-factory";

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
  readonly toObject = vi.fn((_properties?: string[]) => ({
    version: "7.4.0",
    objects: this.objects.map((object) => object.toObject())
  }));
  on(_event: string, _listener: (event: { target: FabricObject }) => void): () => void { return () => undefined; }
  getObjects(): FabricObject[] { return this.objects; }
  add(object: FabricObject): void { this.objects.push(object); }
  getActiveObject(): FabricObject | undefined { return this.activeObject ?? undefined; }
  discardActiveObject(): void { this.activeObject = null; }
  setActiveObject(object: FabricObject): void { this.activeObject = object; }
  moveObjectTo(object: FabricObject, index: number): boolean {
    const current = this.objects.indexOf(object);
    if (current < 0) return false;
    this.objects.splice(current, 1);
    this.objects.splice(index, 0, object);
    return current !== index;
  }
  requestRenderAll(): void {}
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

describe("FabricCanvasAdapter persistence", () => {
  it("rejects a serialized external image before Fabric loads it", async () => {
    const canvas = new FakeCanvas();
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);

    await expect(adapter.load({
      version: "7.4.0",
      objects: [{ type: "FabricImage", src: "https://unsafe.example/tracker.png" }]
    })).rejects.toThrow("same-origin");

    expect(canvas.loadFromJSON).not.toHaveBeenCalled();
  });

  it("serializes interaction state and restores 44-pixel controls", async () => {
    const canvas = new FakeCanvas();
    const object = new Rect({
      width: 100,
      height: 100,
      cornerSize: 13,
      touchCornerSize: 24,
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
      "selectable",
      "visible",
      "lockMovementX"
    ]));

    await adapter.load({ version: "7.4.0", objects: [] });
    expect(object).toMatchObject({
      cornerSize: 44,
      touchCornerSize: 44,
      selectable: false,
      visible: false,
      lockMovementX: true
    });
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

  it("adds and edits clipped artwork children with one parent mutation per action", async () => {
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
