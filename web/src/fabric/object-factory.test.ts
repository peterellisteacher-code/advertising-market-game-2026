import { FabricImage, Rect, Textbox } from "fabric";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FabricObjectFactory, sameOriginRasterUrl } from "./object-factory";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("FabricObjectFactory", () => {
  it("creates centred text with metadata and 44-pixel controls", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      textBaseline: "alphabetic",
      measureText: (value: string) => ({ width: value.length * 32 })
    } as unknown as CanvasRenderingContext2D);
    const object = new FabricObjectFactory().createText({
      id: "text-1",
      value: "Fresh flavour",
      accessibleName: "Fresh flavour headline"
    });

    expect(object).toBeInstanceOf(Textbox);
    expect(object).toMatchObject({
      objectId: "text-1",
      elementKind: "text",
      accessibleName: "Fresh flavour headline",
      originX: "center",
      originY: "center",
      left: 800,
      top: 450,
      cornerSize: 44,
      touchCornerSize: 44
    });
  });

  it("creates a bounded shape with application metadata", () => {
    const object = new FabricObjectFactory().createShape({
      id: "shape-1",
      kind: "rect",
      fill: "#e11d48",
      accessibleName: "Red attention block"
    });

    expect(object).toBeInstanceOf(Rect);
    expect(object).toMatchObject({
      objectId: "shape-1",
      elementKind: "shape",
      accessibleName: "Red attention block",
      width: 320,
      height: 220
    });
  });

  it("scales a long initial text block within the canvas", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      textBaseline: "alphabetic",
      measureText: (value: string) => ({ width: value.length * 32 })
    } as unknown as CanvasRenderingContext2D);
    const object = new FabricObjectFactory().createText({
      id: "text-long",
      value: "Buy now and discover something new. ".repeat(80),
      accessibleName: "Long promotional message"
    });

    expect(object.getScaledWidth()).toBeLessThanOrEqual(640);
    expect(object.getScaledHeight()).toBeLessThanOrEqual(360);
  });

  it("rejects an external raster before Fabric starts loading it", async () => {
    const fromURL = vi.spyOn(FabricImage, "fromURL");

    await expect(new FabricObjectFactory().createRaster({
      id: "image-1",
      assetId: "asset-1",
      sameOriginUrl: "https://unsafe.example/image.png",
      accessibleName: "Product photograph"
    })).rejects.toThrow("same-origin");

    expect(fromURL).not.toHaveBeenCalled();
  });

  it("accepts only same-origin blob URLs for cached rendered variants", () => {
    const sameOriginBlob = `blob:${window.location.origin}/masked-variant-1`;

    expect(sameOriginRasterUrl(sameOriginBlob)).toBe(sameOriginBlob);
    expect(() => sameOriginRasterUrl("blob:https://unsafe.example/masked-variant-1"))
      .toThrow("same-origin");
    expect(() => sameOriginRasterUrl("blob:null/masked-variant-1"))
      .toThrow("same-origin");
    expect(() => sameOriginRasterUrl("data:image/png;base64,cHJvYmU="))
      .toThrow("same-origin");
    expect(() => sameOriginRasterUrl("file:///tmp/masked-variant.png"))
      .toThrow("same-origin");
  });

  it("rejects blob:null when the page itself has an opaque origin", () => {
    vi.stubGlobal("window", {
      location: { href: "about:blank", origin: "null" }
    });

    expect(() => sameOriginRasterUrl("blob:null/masked-variant-1"))
      .toThrow("same-origin");
  });
});
