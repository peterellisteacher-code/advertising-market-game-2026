import { describe, expect, it, vi } from "vitest";
import type { OfflineCatalogAssetV1 } from "./catalogue-types";
import {
  tintRasterTemplate,
  validatedRasterColour,
  type RasterTintBackend
} from "./raster-template-tint";

const asset = (): OfflineCatalogAssetV1 => ({
  schema: "catalog-asset@1",
  delivery: "offline",
  id: "sofa-shell-r01c01",
  version: 1,
  kind: "raster-master",
  title: "Curved modular sofa",
  category: "sofas",
  tags: ["base", "sofa"],
  files: {
    thumbnail: "/catalog/generated/offline-core-v1/assets/sofa-shell-r01c01/thumbnail-192.webp",
    preview: "/catalog/generated/offline-core-v1/assets/sofa-shell-r01c01/preview-640.webp",
    master: "/catalog/generated/offline-core-v1/assets/sofa-shell-r01c01/master.png",
    masks: {
      body: "/catalog/generated/offline-core-v1/assets/sofa-shell-r01c01/masks/body.png"
    }
  },
  masterSha256: "a".repeat(64),
  dimensions: { width: 320, height: 240 },
  recolourZones: ["body"],
  anchors: [],
  materialProfiles: ["matte-plastic"],
  classroomReviewed: true,
  brandFree: true,
  attribution: {
    creator: "Classroom pack",
    sourceUrl: "local",
    license: "classroom-session"
  }
});

describe("raster template tint", () => {
  it("validates and normalises six-digit colours", () => {
    expect(validatedRasterColour("#e4572e")).toBe("#E4572E");
    expect(() => validatedRasterColour("red")).toThrow(/six-digit/i);
    expect(() => validatedRasterColour("#fff")).toThrow(/six-digit/i);
  });

  it("loads canonical same-origin PNG layers and returns the composed PNG", async () => {
    const closeMaster = vi.fn();
    const closeMask = vi.fn();
    const result = new Blob([Uint8Array.from([137, 80, 78, 71])], { type: "image/png" });
    const decode = vi.fn()
      .mockResolvedValueOnce({ source: {} as CanvasImageSource, width: 320, height: 240, close: closeMaster })
      .mockResolvedValueOnce({ source: {} as CanvasImageSource, width: 320, height: 240, close: closeMask });
    const compose = vi.fn().mockResolvedValue(result);
    const backend: RasterTintBackend = { decode, compose };
    const png = Uint8Array.from([137, 80, 78, 71, 1]);
    const fetchMock = vi.fn().mockImplementation(async () => new Response(png, {
      headers: { "content-type": "image/png", "content-length": String(png.length) }
    }));
    const deadline = new AbortController().signal;

    await expect(tintRasterTemplate(asset(), "#e4572e", {
      fetch: fetchMock,
      createDeadlineSignal: () => deadline,
      backend
    })).resolves.toBe(result);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${window.location.origin}/catalog/generated/offline-core-v1/assets/sofa-shell-r01c01/master.png`,
      expect.objectContaining({ method: "GET", credentials: "same-origin", signal: deadline })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${window.location.origin}/catalog/generated/offline-core-v1/assets/sofa-shell-r01c01/masks/body.png`,
      expect.objectContaining({ method: "GET", credentials: "same-origin", signal: deadline })
    );
    expect(compose).toHaveBeenCalledWith(expect.objectContaining({
      colour: "#E4572E",
      width: 320,
      height: 240
    }));
    expect(closeMaster).toHaveBeenCalledOnce();
    expect(closeMask).toHaveBeenCalledOnce();
  });

  it("fails closed before network access for non-canonical layers or invalid colour", async () => {
    const fetchMock = vi.fn();
    const backend: RasterTintBackend = { decode: vi.fn(), compose: vi.fn() };
    const external = {
      ...asset(),
      files: { ...asset().files, master: "https://unsafe.example/master.png" }
    };

    await expect(tintRasterTemplate(external, "#112233", { fetch: fetchMock, backend }))
      .rejects.toThrow(/canonical/i);
    await expect(tintRasterTemplate(asset(), "orange", { fetch: fetchMock, backend }))
      .rejects.toThrow(/six-digit/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("closes decoded layers and rejects dimensions that do not match catalogue metadata", async () => {
    const closeMaster = vi.fn();
    const closeMask = vi.fn();
    const backend: RasterTintBackend = {
      decode: vi.fn()
        .mockResolvedValueOnce({ source: {} as CanvasImageSource, width: 319, height: 240, close: closeMaster })
        .mockResolvedValueOnce({ source: {} as CanvasImageSource, width: 320, height: 240, close: closeMask }),
      compose: vi.fn()
    };
    const fetchMock = vi.fn().mockImplementation(async () => new Response(Uint8Array.from([1]), {
      headers: { "content-type": "image/png", "content-length": "1" }
    }));

    await expect(tintRasterTemplate(asset(), "#112233", { fetch: fetchMock, backend }))
      .rejects.toThrow(/dimensions/i);
    expect(backend.compose).not.toHaveBeenCalled();
    expect(closeMaster).toHaveBeenCalledOnce();
    expect(closeMask).toHaveBeenCalledOnce();
  });
});
