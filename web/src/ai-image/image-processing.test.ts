import { describe, expect, it, vi } from "vitest";
import {
  ImageProcessingError,
  decodeImageDataUrl,
  prepareImageForAi,
  removeWhiteChroma,
  type DecodedBrowserImage
} from "./image-processing";

const toDataUrl = (mime: "image/png" | "image/jpeg", bytes: number[]): string =>
  `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

const PNG_DATA_URL = toDataUrl("image/png", [
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01
]);

const JPEG_DATA_URL = toDataUrl("image/jpeg", [
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x00, 0xff, 0xd9
]);

describe("decodeImageDataUrl", () => {
  it.each([
    [PNG_DATA_URL, "image/png", 9],
    [JPEG_DATA_URL, "image/jpeg", 8]
  ])("decodes a supported, signed image data URL", (dataUrl, mime, size) => {
    const blob = decodeImageDataUrl(dataUrl, 32);

    expect(blob.type).toBe(mime);
    expect(blob.size).toBe(size);
  });

  it("rejects a payload above the byte cap before decoding it", () => {
    const atobSpy = vi.spyOn(globalThis, "atob");

    expect(() => decodeImageDataUrl(PNG_DATA_URL, 8)).toThrowError(
      expect.objectContaining({ code: "IMAGE_TOO_LARGE" })
    );
    expect(atobSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["https://example.test/image.png", "INVALID_DATA_URL"],
    ["data:image/gif;base64,R0lGODlh", "UNSUPPORTED_MEDIA_TYPE"],
    ["data:image/png;base64,%%%%", "INVALID_DATA_URL"],
    [toDataUrl("image/jpeg", [0x89, 0x50, 0x4e, 0x47]), "INVALID_IMAGE_SIGNATURE"]
  ])("rejects malformed, unsupported, or falsely labelled input", (dataUrl, code) => {
    expect(() => decodeImageDataUrl(dataUrl)).toThrowError(
      expect.objectContaining({ code })
    );
  });

  it("rejects a non-positive byte cap with an explicit error", () => {
    expect(() => decodeImageDataUrl(PNG_DATA_URL, 0)).toThrowError(
      expect.objectContaining({ code: "INVALID_BYTE_CAP" })
    );
  });
});

describe("removeWhiteChroma", () => {
  it("makes white transparent, feathers neutral near-white, and leaves other pixels exact", () => {
    const input = new Uint8ClampedArray([
      255, 255, 255, 255,
      240, 240, 240, 200,
      20, 30, 40, 128,
      255, 232, 232, 255
    ]);

    const result = removeWhiteChroma(input);

    expect(Array.from(result.slice(0, 4))).toEqual([255, 255, 255, 0]);
    expect(result[7]).toBeGreaterThan(0);
    expect(result[7]).toBeLessThan(200);
    expect(Array.from(result.slice(8, 12))).toEqual([20, 30, 40, 128]);
    expect(Array.from(result.slice(12, 16))).toEqual([255, 232, 232, 255]);
    expect(Array.from(input)).toEqual([
      255, 255, 255, 255,
      240, 240, 240, 200,
      20, 30, 40, 128,
      255, 232, 232, 255
    ]);
  });

  it("rejects incomplete RGBA input", () => {
    expect(() => removeWhiteChroma(new Uint8ClampedArray([255, 255, 255]))).toThrowError(
      expect.objectContaining({ code: "INVALID_RGBA" })
    );
  });
});

type FakeCanvasHarness = {
  canvas: HTMLCanvasElement;
  fillRect: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  getImageData: ReturnType<typeof vi.fn>;
  putImageData: ReturnType<typeof vi.fn>;
};

const makeCanvasHarness = (encodedBlob: Blob | null = new Blob(["png"], { type: "image/png" })):
FakeCanvasHarness => {
  const fillRect = vi.fn();
  const drawImage = vi.fn();
  const pixels = new Uint8ClampedArray([255, 255, 255, 255]);
  const getImageData = vi.fn(() => ({ data: pixels, width: 1, height: 1 } as ImageData));
  const putImageData = vi.fn();
  const context = {
    fillStyle: "",
    fillRect,
    drawImage,
    getImageData,
    putImageData
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob: vi.fn((callback: BlobCallback, type?: string) => {
      expect(type).toBe("image/png");
      callback(encodedBlob);
    })
  } as unknown as HTMLCanvasElement;

  return { canvas, fillRect, drawImage, getImageData, putImageData };
};

const makeDecodedImage = (width: number, height: number) => {
  const close = vi.fn();
  return {
    image: { width, height } as unknown as CanvasImageSource,
    decoded: { source: { width, height } as unknown as CanvasImageSource, width, height, close },
    close
  } satisfies { image: CanvasImageSource; decoded: DecodedBrowserImage; close: ReturnType<typeof vi.fn> };
};

describe("prepareImageForAi", () => {
  it("contains a landscape image on the exact 512-square Object Forge canvas", async () => {
    const harness = makeCanvasHarness();
    const loaded = makeDecodedImage(800, 400);

    const result = await prepareImageForAi(PNG_DATA_URL, "object-forge", {
      canvasFactory: () => harness.canvas,
      decodeImage: vi.fn().mockResolvedValue(loaded.decoded)
    });

    expect(harness.fillRect).toHaveBeenCalledWith(0, 0, 512, 512);
    expect(harness.drawImage).toHaveBeenCalledWith(loaded.decoded.source, 0, 128, 512, 256);
    expect(result).toMatchObject({
      width: 512,
      height: 512,
      dataUrl: "data:image/png;base64,cG5n"
    });
    expect(result.blob.type).toBe("image/png");
    expect(loaded.close).toHaveBeenCalledOnce();
    expect(harness.canvas.width).toBe(0);
    expect(harness.canvas.height).toBe(0);
  });

  it("contains a square design on the exact 1024x576 Make It Real canvas", async () => {
    const harness = makeCanvasHarness();
    const loaded = makeDecodedImage(400, 400);

    const result = await prepareImageForAi(PNG_DATA_URL, "make-it-real", {
      canvasFactory: () => harness.canvas,
      decodeImage: vi.fn().mockResolvedValue(loaded.decoded)
    });

    expect(harness.drawImage).toHaveBeenCalledWith(loaded.decoded.source, 224, 0, 576, 576);
    expect(result.width).toBe(1024);
    expect(result.height).toBe(576);
    expect(loaded.close).toHaveBeenCalledOnce();
  });

  it("can chroma-key the fitted pixels before encoding", async () => {
    const harness = makeCanvasHarness();
    const loaded = makeDecodedImage(512, 512);

    await prepareImageForAi(PNG_DATA_URL, "object-forge", {
      canvasFactory: () => harness.canvas,
      decodeImage: vi.fn().mockResolvedValue(loaded.decoded),
      removeWhiteBackground: true
    });

    expect(harness.getImageData).toHaveBeenCalledWith(0, 0, 512, 512);
    const imageData = harness.putImageData.mock.calls[0]?.[0] as ImageData;
    expect(Array.from(imageData.data)).toEqual([255, 255, 255, 0]);
    expect(harness.putImageData).toHaveBeenCalledWith(imageData, 0, 0);
  });

  it("cleans up the decoded image and canvas when PNG encoding fails", async () => {
    const harness = makeCanvasHarness(null);
    const loaded = makeDecodedImage(512, 512);

    await expect(prepareImageForAi(PNG_DATA_URL, "object-forge", {
      canvasFactory: () => harness.canvas,
      decodeImage: vi.fn().mockResolvedValue(loaded.decoded)
    })).rejects.toEqual(expect.objectContaining({ code: "ENCODE_FAILED" }));
    expect(loaded.close).toHaveBeenCalledOnce();
    expect(harness.canvas.width).toBe(0);
    expect(harness.canvas.height).toBe(0);
  });

  it("reports invalid decoded dimensions and still closes the image", async () => {
    const harness = makeCanvasHarness();
    const loaded = makeDecodedImage(0, 512);

    await expect(prepareImageForAi(PNG_DATA_URL, "object-forge", {
      canvasFactory: () => harness.canvas,
      decodeImage: vi.fn().mockResolvedValue(loaded.decoded)
    })).rejects.toEqual(expect.objectContaining({ code: "INVALID_IMAGE_DIMENSIONS" }));
    expect(loaded.close).toHaveBeenCalledOnce();
    expect(harness.canvas.width).toBe(0);
    expect(harness.canvas.height).toBe(0);
  });

  it("uses an explicit error type and code for an unavailable 2D canvas", async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => null)
    } as unknown as HTMLCanvasElement;
    const loaded = makeDecodedImage(512, 512);

    const error = await prepareImageForAi(PNG_DATA_URL, "object-forge", {
      canvasFactory: () => canvas,
      decodeImage: vi.fn().mockResolvedValue(loaded.decoded)
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ImageProcessingError);
    expect(error).toMatchObject({ code: "CANVAS_UNAVAILABLE" });
    expect(loaded.close).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it("wraps a canvas-factory failure and still closes the decoded image", async () => {
    const loaded = makeDecodedImage(512, 512);

    const error = await prepareImageForAi(PNG_DATA_URL, "object-forge", {
      canvasFactory: () => {
        throw new Error("canvas allocation failed");
      },
      decodeImage: vi.fn().mockResolvedValue(loaded.decoded)
    }).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ImageProcessingError);
    expect(error).toMatchObject({ code: "CANVAS_UNAVAILABLE" });
    expect((error as Error).cause).toEqual(new Error("canvas allocation failed"));
    expect(loaded.close).toHaveBeenCalledOnce();
  });
});
