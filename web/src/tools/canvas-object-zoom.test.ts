import { describe, expect, it, vi } from "vitest";
import { CanvasObjectZoomController, fillCanvasWithRaster } from "./canvas-object-zoom";

function state(object: Record<string, unknown>): Record<string, unknown> {
  return { version: "7.4.0", objects: [object] };
}

describe("CanvasObjectZoomController", () => {
  it("enlarges the selected product while preserving its centre", () => {
    const transform = vi.fn();
    const controller = new CanvasObjectZoomController({
      getSelectedObjectId: () => "product-1",
      serialize: () => state({
        objectId: "product-1",
        elementKind: "product-shell",
        width: 400,
        height: 500,
        scaleX: 1.2,
        scaleY: 1.2,
        left: 800,
        top: 450
      }),
      transform
    });

    expect(controller.zoomSelected(1.25)).toBe(150);
    expect(transform).toHaveBeenCalledWith("product-1", { scaleX: 1.5, scaleY: 1.5 });
  });

  it("fills the ad with a selected raster and centres it", () => {
    const transform = vi.fn();
    const controller = new CanvasObjectZoomController({
      getSelectedObjectId: () => "real-1",
      serialize: () => state({
        objectId: "real-1",
        elementKind: "image",
        width: 1536,
        height: 864,
        scaleX: 0.4,
        scaleY: 0.4,
        left: 300,
        top: 200
      }),
      transform
    });

    expect(controller.fillSelectedRaster()).toBe(104);
    expect(transform).toHaveBeenCalledWith("real-1", {
      x: 800,
      y: 450,
      scaleX: 1600 / 1536,
      scaleY: 1600 / 1536
    });
  });

  it("does not treat text as a zoomable product image", () => {
    const controller = new CanvasObjectZoomController({
      getSelectedObjectId: () => "copy-1",
      serialize: () => state({
        objectId: "copy-1",
        elementKind: "text",
        width: 480,
        height: 100,
        scaleX: 1,
        scaleY: 1
      }),
      transform: vi.fn()
    });

    expect(() => controller.zoomSelected(1.25)).toThrow(/product or image/i);
    expect(() => controller.fillSelectedRaster()).toThrow(/image/i);
  });
});

describe("fillCanvasWithRaster", () => {
  it("uses an explicit raster id for generated full-ad placement", () => {
    const transform = vi.fn();
    const percent = fillCanvasWithRaster({
      serialize: () => state({
        objectId: "generated-1",
        elementKind: "image",
        width: 1024,
        height: 576,
        scaleX: 0.625,
        scaleY: 0.625
      }),
      transform
    }, "generated-1");

    expect(percent).toBe(156);
    expect(transform).toHaveBeenCalledWith("generated-1", {
      x: 800,
      y: 450,
      scaleX: 1.5625,
      scaleY: 1.5625
    });
  });
});
