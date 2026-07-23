import { FabricImage, Rect, Textbox } from "fabric";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateTextFitScale,
  FabricObjectFactory,
  MAX_PORTABLE_PNG_DATA_URL_BYTES,
  MAX_TEXT_HEIGHT,
  MAX_TEXT_WIDTH,
  portableRasterUrlForLoad,
  portableRasterUrlForStorage,
  sameOriginRasterUrl
} from "./object-factory";

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
      touchCornerSize: 44,
      transparentCorners: false,
      borderScaleFactor: 3,
      borderColor: "#075985",
      cornerColor: "#f4c95d",
      cornerStrokeColor: "#172033"
    });
  });

  it("can create a canonical price label that cannot be edited as ordinary copy", () => {
    const object = new FabricObjectFactory().createText({
      id: "price-1",
      value: "$8.00",
      accessibleName: "Market price $8.00",
      editable: false
    });

    expect(object.editable).toBe(false);
    expect(object.toObject()).toMatchObject({ editable: false });
  });

  it("creates curved text as a bounded editable-source raster while ordinary text stays a Textbox", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      font: "",
      fillStyle: "#000000",
      textAlign: "start",
      textBaseline: "alphabetic",
      globalAlpha: 1,
      measureText: (value: string) => ({ width: value.length * 48 }),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      drawImage: vi.fn()
    } as unknown as CanvasRenderingContext2D);

    const factory = new FabricObjectFactory();
    const curved = factory.createCurvedLabel({
      id: "curved-text-1",
      value: "Refill. Roam. Repeat.",
      accessibleName: "Tumbler label"
    });
    const ordinary = factory.createText({
      id: "ordinary-text-1",
      value: "Refill. Roam. Repeat.",
      accessibleName: "Advertisement headline"
    });

    expect(curved).toBeInstanceOf(FabricImage);
    expect(curved.getOriginalSize()).toEqual({ width: 1_024, height: 512 });
    expect(curved).toMatchObject({
      objectId: "curved-text-1",
      elementKind: "text",
      accessibleName: "Tumbler label",
      curvedTextSource: "Refill. Roam. Repeat.",
      curvedTextProfile: "cylinder-front",
      curvedTextColour: "#111827",
      curvedTextFontFamily: "Arial"
    });
    expect(ordinary).toBeInstanceOf(Textbox);
    expect(ordinary).not.toHaveProperty("curvedTextSource");
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

  it("calculates an absolute text scale from natural dimensions and intersecting bounds", () => {
    expect(MAX_TEXT_WIDTH).toBe(640);
    expect(MAX_TEXT_HEIGHT).toBe(360);
    expect(calculateTextFitScale(320, 180)).toBe(1);
    expect(calculateTextFitScale(1280, 720)).toBe(0.5);
    expect(calculateTextFitScale(400, 440, 328, 360.8)).toBeCloseTo(360 / 440, 10);
    expect(calculateTextFitScale(800, 200, 328, 360)).toBeCloseTo(328 / 800, 10);
    expect(calculateTextFitScale(800, 200, 328, 360)).toBeGreaterThan(0);
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

  it("rebases only catalogue images from another deploy of the same Netlify site", () => {
    const currentHref =
      "https://6a5dd4b2ee7c5ac396464e29--advertising-market-game-2026.netlify.app/";
    const legacy =
      "https://6a5da419dee708508ee54146--advertising-market-game-2026.netlify.app/" +
      "catalog/generated/offline-core-v1/assets/96-appliance-add-ons-r05c01/master.png";

    expect(portableRasterUrlForLoad(legacy, currentHref)).toBe(
      "https://6a5dd4b2ee7c5ac396464e29--advertising-market-game-2026.netlify.app/" +
      "catalog/generated/offline-core-v1/assets/96-appliance-add-ons-r05c01/master.png"
    );
    expect(() => portableRasterUrlForLoad(
      "https://unsafe.example/catalog/tracker.png",
      currentHref
    )).toThrow("same-origin");
    expect(() => portableRasterUrlForLoad(
      "https://6a5da419dee708508ee54146--advertising-market-game-2026.netlify.app/api/private",
      currentHref
    )).toThrow("same-origin");
  });

  it("stores same-origin catalogue images as deploy-portable root-relative URLs", () => {
    const currentHref =
      "https://6a5dd4b2ee7c5ac396464e29--advertising-market-game-2026.netlify.app/studio/";

    expect(portableRasterUrlForStorage(
      "https://6a5dd4b2ee7c5ac396464e29--advertising-market-game-2026.netlify.app/" +
      "catalog/generated/item.png?rev=4#preview",
      currentHref
    )).toBe("/catalog/generated/item.png?rev=4#preview");
    expect(portableRasterUrlForStorage(
      "blob:https://6a5dd4b2ee7c5ac396464e29--advertising-market-game-2026.netlify.app/local-1",
      currentHref
    )).toBe(
      "blob:https://6a5dd4b2ee7c5ac396464e29--advertising-market-game-2026.netlify.app/local-1"
    );
  });

  it("round-trips only bounded PNG data URLs used by generated curved labels", () => {
    const portablePng = "data:image/png;base64,iVBORw0KGgo=";

    expect(portableRasterUrlForStorage(portablePng)).toBe(portablePng);
    expect(portableRasterUrlForLoad(portablePng)).toBe(portablePng);
    expect(() => portableRasterUrlForStorage("data:image/svg+xml;base64,PHN2Zy8+"))
      .toThrow("same-origin");
    expect(() => portableRasterUrlForLoad("data:image/png;base64,cHJvYmU="))
      .toThrow("same-origin");
    expect(() => portableRasterUrlForStorage(
      `data:image/png;base64,${"A".repeat(MAX_PORTABLE_PNG_DATA_URL_BYTES * 2)}`
    )).toThrow("same-origin");
  });

  it("rejects blob:null when the page itself has an opaque origin", () => {
    vi.stubGlobal("window", {
      location: { href: "about:blank", origin: "null" }
    });

    expect(() => sameOriginRasterUrl("blob:null/masked-variant-1"))
      .toThrow("same-origin");
  });
});
