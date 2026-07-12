import type { Canvas, FabricObject } from "fabric";
import { Path, PencilBrush, Rect } from "fabric";
import { describe, expect, it } from "vitest";
import { FabricCanvasAdapter } from "../fabric/fabric-canvas-adapter";
import { DrawingLayerController } from "./drawing-layer-controller";

type CanvasEvent = { target?: FabricObject; path?: FabricObject; e?: Event };
type CanvasListener = (event: CanvasEvent) => void;

class FakeCanvas {
  readonly objects: FabricObject[] = [];
  readonly #listeners = new Map<string, Set<CanvasListener>>();
  freeDrawingBrush?: PencilBrush;
  isDrawingMode = false;
  zoom = 1;

  on(event: string, listener: CanvasListener): () => void {
    const listeners = this.#listeners.get(event) ?? new Set<CanvasListener>();
    listeners.add(listener);
    this.#listeners.set(event, listeners);
    return () => listeners.delete(listener);
  }

  fire(event: string, payload: CanvasEvent): void {
    this.#listeners.get(event)?.forEach((listener) => listener(payload));
  }

  add(object: FabricObject): void {
    this.objects.push(object);
    object.setCoords();
    this.fire("object:added", { target: object });
  }

  remove(object: FabricObject): void {
    const index = this.objects.indexOf(object);
    if (index >= 0) this.objects.splice(index, 1);
    this.fire("object:removed", { target: object });
  }

  getObjects(): FabricObject[] { return this.objects; }
  getZoom(): number { return this.zoom; }
  requestRenderAll(): void {}
}

const taggedRect = (
  id: string,
  kind: "drawing" | "text" | "image",
  left = 90,
  top = 90
): Rect => {
  const object = new Rect({ left, top, width: 60, height: 60, fill: "#111827" });
  object.objectId = id;
  object.elementKind = kind;
  object.accessibleName = id;
  object.setCoords();
  return object;
};

const taggedPath = (
  id: string,
  y: number,
  visible = true
): Path => {
  const object = new Path(`M 90 ${y} L 150 ${y}`, {
    fill: "",
    stroke: "#111827",
    strokeWidth: 8,
    visible
  });
  object.objectId = id;
  object.elementKind = "drawing";
  object.accessibleName = id;
  object.setCoords();
  return object;
};

const hollowNearMiss = (id: string): Path => {
  const object = new Path("M 90 90 L 150 90 L 150 150 L 90 150 z", {
    fill: "",
    stroke: "#111827",
    strokeWidth: 4
  });
  object.objectId = id;
  object.elementKind = "drawing";
  object.accessibleName = id;
  object.setCoords();
  return object;
};

describe("DrawingLayerController", () => {
  it("reuses one PencilBrush and records a completed tagged path once", () => {
    const canvas = new FakeCanvas();
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    const controller = new DrawingLayerController(adapter);
    const mutations: string[] = [];
    adapter.subscribe((mutation) => mutations.push(mutation.type));

    controller.activatePencil({ color: "#0f172a", width: 7 });
    const brush = canvas.freeDrawingBrush;
    expect(brush).toBeInstanceOf(PencilBrush);
    controller.activateMarker({ color: "#f59e0b", width: 18 });
    expect(canvas.freeDrawingBrush).toBe(brush);
    expect(brush).toMatchObject({ color: "rgba(245,158,11,0.35)", width: 18 });

    const path = new Path("M 0 0 L 80 80", { stroke: "#f59e0b", fill: "" });
    canvas.fire("before:path:created", { path });
    canvas.add(path);
    canvas.fire("path:created", { path });

    expect(path).toMatchObject({
      elementKind: "drawing",
      accessibleName: "Marker drawing"
    });
    expect(path.objectId).toEqual(expect.any(String));
    expect(mutations).toEqual(["added"]);
  });

  it("erases only the topmost intersecting drawing and records one removal", () => {
    const canvas = new FakeCanvas();
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    const controller = new DrawingLayerController(adapter);
    const photo = taggedRect("photo", "image");
    const bottomDrawing = taggedPath("drawing-bottom", 120);
    const text = taggedRect("text", "text");
    const topDrawing = taggedPath("drawing-top", 120);
    const outsideDrawing = taggedPath("drawing-outside", 300);
    const hiddenDrawing = taggedPath("drawing-hidden", 120, false);
    const nearMissDrawing = hollowNearMiss("drawing-near-miss");
    [photo, bottomDrawing, text, topDrawing, outsideDrawing, hiddenDrawing, nearMissDrawing]
      .forEach((object) => canvas.add(object));
    const mutations: string[] = [];
    adapter.subscribe((mutation) => mutations.push(`${mutation.type}:${mutation.objectId}`));

    controller.activateEraser(12);
    expect(controller.eraseAt({ x: 120, y: 120 })).toBe(true);
    expect(canvas.objects).not.toContain(topDrawing);
    expect(canvas.objects).toContain(bottomDrawing);
    expect(canvas.objects).toContain(photo);
    expect(canvas.objects).toContain(text);
    expect(canvas.objects).toContain(outsideDrawing);
    expect(canvas.objects).toContain(hiddenDrawing);
    expect(canvas.objects).toContain(nearMissDrawing);
    expect(mutations).toEqual(["removed:drawing-top"]);

    expect(controller.eraseAt({ x: 120, y: 120 })).toBe(true);
    expect(canvas.objects).not.toContain(bottomDrawing);
    expect(mutations).toEqual(["removed:drawing-top", "removed:drawing-bottom"]);
    expect(controller.eraseAt({ x: 120, y: 120 })).toBe(false);
    expect(canvas.objects).toEqual([photo, text, outsideDrawing, hiddenDrawing, nearMissDrawing]);
  });

  it("keeps the eraser radius stable in viewport pixels while zoomed", () => {
    const canvas = new FakeCanvas();
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    const controller = new DrawingLayerController(adapter);
    const drawing = taggedPath("drawing-zoom", 120);
    canvas.add(drawing);
    controller.activateEraser(12);

    canvas.zoom = 2;
    expect(controller.eraseAt({ x: 120, y: 132 })).toBe(false);
    expect(canvas.objects).toContain(drawing);
    canvas.zoom = 1;
    expect(controller.eraseAt({ x: 120, y: 132 })).toBe(true);
  });
});
