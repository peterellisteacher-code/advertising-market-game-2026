import type { Canvas } from "fabric";
import { Rect } from "fabric";
import { describe, expect, it, vi } from "vitest";
import { FabricCanvasAdapter } from "./fabric-canvas-adapter";

class FakeCanvas {
  objects: Rect[] = [];
  activeObject: Rect | null = null;
  failExport = false;
  readonly renderSnapshots: Array<{ active: Rect | null; order: Rect[]; visible: boolean[] }> = [];
  readonly loadFromJSON = vi.fn(async (_value: Record<string, unknown>) => this);
  readonly toObject = vi.fn((_properties?: string[]) => ({
    version: "7.4.0",
    objects: this.objects.map((object) => object.toObject())
  }));
  on(_event: string, _listener: (event: { target: Rect }) => void): () => void { return () => undefined; }
  getObjects(): Rect[] { return this.objects; }
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
});
