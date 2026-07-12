import type { Canvas, FabricObject } from "fabric";
import { FabricImage } from "fabric";
import { describe, expect, it, vi } from "vitest";
import type { CropState } from "../fabric/canvas-port";
import { FabricCanvasAdapter } from "../fabric/fabric-canvas-adapter";
import { CropController } from "./crop-controller";

class CropPort {
  readonly source = Object.freeze({ width: 640, height: 480 });
  applied: CropState | null = null;

  getCropSourceSize(id: string): { width: number; height: number } {
    if (id !== "photo-1") throw new Error(`Missing ${id}`);
    return this.source;
  }

  setCrop(id: string, crop: CropState): void {
    if (id !== "photo-1") throw new Error(`Missing ${id}`);
    this.applied = structuredClone(crop);
  }
}

type CropCanvasEvent = { target?: FabricObject; path?: FabricObject; e?: Event };
type CropCanvasListener = (event: CropCanvasEvent) => void;

class CropCanvas {
  readonly objects: FabricObject[] = [];
  readonly #listeners = new Map<string, Set<CropCanvasListener>>();

  on(event: string, listener: CropCanvasListener): () => void {
    const listeners = this.#listeners.get(event) ?? new Set<CropCanvasListener>();
    listeners.add(listener);
    this.#listeners.set(event, listeners);
    return () => listeners.delete(listener);
  }

  getObjects(): FabricObject[] { return this.objects; }
  requestRenderAll(): void {}
}

describe("CropController", () => {
  it("clamps a crop inside its source without changing source pixels", () => {
    const port = new CropPort();
    const controller = new CropController(port);
    const input = {
      cropX: 520,
      cropY: -40,
      visibleWidth: 200,
      visibleHeight: 600,
      focalX: 1.5,
      focalY: -0.25
    };

    const crop = controller.apply("photo-1", input);

    expect(crop).toEqual({
      cropX: 440,
      cropY: 0,
      visibleWidth: 200,
      visibleHeight: 480,
      focalX: 1,
      focalY: 0
    });
    expect(port.applied).toEqual(crop);
    expect(port.source).toEqual({ width: 640, height: 480 });
    expect(input).toEqual({
      cropX: 520,
      cropY: -40,
      visibleWidth: 200,
      visibleHeight: 600,
      focalX: 1.5,
      focalY: -0.25
    });
  });

  it("rejects non-finite crop values", () => {
    const controller = new CropController(new CropPort());
    expect(() => controller.apply("photo-1", {
      cropX: Number.NaN,
      cropY: 0,
      visibleWidth: 100,
      visibleHeight: 100,
      focalX: 0.5,
      focalY: 0.5
    })).toThrow("finite");
  });

  it("persists focal crop state and emits one mutation without replacing source pixels", () => {
    const source = document.createElement("canvas");
    source.width = 640;
    source.height = 480;
    vi.spyOn(source, "toDataURL").mockReturnValue("data:image/png;base64,cHJvYmU=");
    const image = new FabricImage(source);
    image.set({ scaleX: 1.5, scaleY: 0.75, angle: 21, flipX: true });
    image.objectId = "photo-1";
    image.elementKind = "image";
    image.accessibleName = "Product photograph";
    const canvas = new CropCanvas();
    canvas.objects.push(image);
    const adapter = new FabricCanvasAdapter(canvas as unknown as Canvas);
    const controller = new CropController(adapter);
    const mutations: string[] = [];
    adapter.subscribe((mutation) => mutations.push(`${mutation.type}:${mutation.objectId}`));

    const crop = controller.apply("photo-1", {
      cropX: 40,
      cropY: 30,
      visibleWidth: 400,
      visibleHeight: 300,
      focalX: 0.65,
      focalY: 0.4
    });

    expect(image.getElement()).toBe(source);
    expect({ width: source.width, height: source.height }).toEqual({ width: 640, height: 480 });
    expect(image.toObject()).toMatchObject({
      cropX: 40,
      cropY: 30,
      width: 400,
      height: 300,
      cropFocalX: 0.65,
      cropFocalY: 0.4,
      scaleX: 1.5,
      scaleY: 0.75,
      angle: 21,
      flipX: true
    });
    expect(mutations).toEqual(["modified:photo-1"]);
    controller.apply("photo-1", crop);
    expect(mutations).toHaveLength(1);
  });
});
