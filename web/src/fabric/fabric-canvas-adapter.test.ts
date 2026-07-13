import type { Canvas } from "fabric";
import { Group, Rect } from "fabric";
import { describe, expect, it, vi } from "vitest";
import { FabricCanvasAdapter } from "./fabric-canvas-adapter";

class FakeCanvas {
  objects: Rect[] = [];
  activeObject: Rect | null = null;
  failExport = false;
  readonly renderSnapshots: Array<{ active: Rect | null; order: Rect[]; visible: boolean[] }> = [];
  readonly nestedGuideSnapshots: boolean[][] = [];
  readonly groupDirtySnapshots: boolean[][] = [];
  readonly loadFromJSON = vi.fn(async (_value: Record<string, unknown>) => this);
  readonly toObject = vi.fn((_properties?: string[]) => ({
    version: "7.4.0",
    objects: this.objects.map((object) => object.toObject())
  }));
  on(_event: string, _listener: (event: { target: Rect }) => void): () => void { return () => undefined; }
  getObjects(): Rect[] { return this.objects; }
  add(object: Rect): void { this.objects.push(object); }
  getActiveObject(): Rect | undefined { return this.activeObject ?? undefined; }
  discardActiveObject(): void { this.activeObject = null; }
  setActiveObject(object: Rect): void { this.activeObject = object; }
  moveObjectTo(object: Rect, index: number): boolean {
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
});
