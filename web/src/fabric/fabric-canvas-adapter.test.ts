import type { Canvas } from "fabric";
import { Rect } from "fabric";
import { describe, expect, it, vi } from "vitest";
import { FabricCanvasAdapter } from "./fabric-canvas-adapter";

class FakeCanvas {
  objects: Rect[] = [];
  readonly loadFromJSON = vi.fn(async (_value: Record<string, unknown>) => this);
  readonly toObject = vi.fn((_properties?: string[]) => ({
    version: "7.4.0",
    objects: this.objects.map((object) => object.toObject())
  }));
  on(_event: string, _listener: (event: { target: Rect }) => void): () => void { return () => undefined; }
  getObjects(): Rect[] { return this.objects; }
  discardActiveObject(): void {}
  requestRenderAll(): void {}
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
});
