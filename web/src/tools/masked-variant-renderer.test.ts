import { describe, expect, it } from "vitest";
import type { RecolourZone } from "../catalogue/catalogue-types";
import { MATERIAL_PRESETS } from "./material-presets";
import {
  BrowserMaskedVariantRenderer,
  MASKED_VARIANT_SHADOW_POLICY,
  compositeMaskedVariantPixels,
  type BitmapRasterCodec,
  type ZoneStyles
} from "./masked-variant-renderer";

const WIDTH = 4;
const HEIGHT = 4;
const ZONES: RecolourZone[] = ["body", "trim", "accent", "label"];

function pixelOffset(x: number, y: number): number {
  return (y * WIDTH + x) * 4;
}

function pixelAt(pixels: Uint8ClampedArray, x: number, y: number): number[] {
  return Array.from(pixels.slice(pixelOffset(x, y), pixelOffset(x, y) + 4));
}

function luminance(pixels: Uint8ClampedArray, x: number, y: number): number {
  const [red = 0, green = 0, blue = 0] = pixelAt(pixels, x, y);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function syntheticMaster(): Uint8ClampedArray {
  const tones = [48, 112, 224, 176];
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const offset = pixelOffset(x, y);
      const tone = tones[x] ?? 0;
      pixels.set([tone, tone, tone, 255], offset);
    }
  }
  pixels.set([17, 33, 49, 0], pixelOffset(0, 0));
  return pixels;
}

function rowMask(row: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let x = 0; x < 3; x += 1) {
    pixels[pixelOffset(x, row) + 3] = 255;
  }
  return pixels;
}

function syntheticMasks(): Record<RecolourZone, Uint8ClampedArray> {
  return {
    body: rowMask(0),
    trim: rowMask(1),
    accent: rowMask(2),
    label: rowMask(3)
  };
}

const styles: ZoneStyles = {
  body: { colour: "#ff2020", materialId: "matte-plastic", opacity: 1 },
  trim: { colour: "#20ff20", materialId: "rubber", opacity: 1 },
  accent: { colour: "#2020ff", materialId: "brushed-metal", opacity: 1 },
  label: { colour: "#ffd020", materialId: "cardboard", opacity: 1 }
};

describe("masked variant compositor", () => {
  it("recolours four 4x4 mask zones independently while preserving transparency and highlights", () => {
    const master = syntheticMaster();
    const output = compositeMaskedVariantPixels({
      master,
      masks: syntheticMasks(),
      styles,
      width: WIDTH,
      height: HEIGHT
    });

    expect(pixelAt(output, 0, 0)).toEqual([17, 33, 49, 0]);
    expect(pixelAt(output, 3, 0)).toEqual(pixelAt(master, 3, 0));
    expect(pixelAt(output, 1, 0)[0]).toBeGreaterThan(pixelAt(output, 1, 0)[1] ?? 0);
    expect(pixelAt(output, 1, 1)[1]).toBeGreaterThan(pixelAt(output, 1, 1)[0] ?? 0);
    expect(pixelAt(output, 1, 2)[2]).toBeGreaterThan(pixelAt(output, 1, 2)[0] ?? 0);
    expect(pixelAt(output, 1, 3)[0]).toBeGreaterThan(pixelAt(output, 1, 3)[2] ?? 0);
    expect(pixelAt(output, 1, 3)[1]).toBeGreaterThan(pixelAt(output, 1, 3)[2] ?? 0);

    for (let row = 0; row < HEIGHT; row += 1) {
      expect(luminance(output, 2, row)).toBeGreaterThan(luminance(output, 1, row));
    }
    expect(Array.from(output).filter((_, index) => index % 4 === 3)).toEqual(
      Array.from(master).filter((_, index) => index % 4 === 3)
    );
  });

  it("applies fixed body, trim, accent, label precedence to overlapping masks", () => {
    const overlapping = rowMask(1);
    const output = compositeMaskedVariantPixels({
      master: syntheticMaster(),
      masks: { body: overlapping, trim: overlapping },
      styles: {
        body: { colour: "#ff2020", materialId: "matte-plastic", opacity: 1 },
        trim: { colour: "#20ff20", materialId: "matte-plastic", opacity: 1 }
      },
      width: WIDTH,
      height: HEIGHT
    });

    expect(pixelAt(output, 1, 1)[1]).toBeGreaterThan(pixelAt(output, 1, 1)[0] ?? 0);
  });

  it.each([
    [{ colour: "red", materialId: "matte-plastic", opacity: 1 }, "hex colour"],
    [{ colour: "#ffffff", materialId: "unknown", opacity: 1 }, "Unknown material"],
    [{ colour: "#ffffff", materialId: "matte-plastic", opacity: -0.1 }, "opacity"],
    [{ colour: "#ffffff", materialId: "matte-plastic", opacity: 1.1 }, "opacity"]
  ] as const)("rejects invalid zone style %#", (style, message) => {
    expect(() => compositeMaskedVariantPixels({
      master: syntheticMaster(),
      masks: { body: rowMask(0) },
      styles: { body: style },
      width: WIDTH,
      height: HEIGHT
    })).toThrow(message);
  });

  it("defines exactly the eight deterministic data-only material profiles", () => {
    expect(Object.keys(MATERIAL_PRESETS)).toEqual([
      "matte-plastic",
      "gloss-plastic",
      "rubber",
      "cardboard",
      "fabric",
      "glass",
      "brushed-metal",
      "wood"
    ]);
    for (const preset of Object.values(MATERIAL_PRESETS)) {
      expect(preset).toEqual(expect.objectContaining({
        textureUrl: expect.stringMatching(/^data:image\/svg\+xml,/),
        blendMode: expect.stringMatching(/^(multiply|soft-light|screen)$/),
        opacity: expect.any(Number),
        highlightStrength: expect.any(Number)
      }));
      expect(() => new URL(preset.textureUrl)).not.toThrow();
    }
    expect(Object.values(MATERIAL_PRESETS).every((preset) =>
      Object.values(preset).every((value) => typeof value !== "function"))).toBe(true);
  });

  it("defers catalogue shadow files to placement and preserves shadows already baked into the master", () => {
    expect(MASKED_VARIANT_SHADOW_POLICY).toBe("preserve-shadows-in-master");
  });
});

function fakeBitmap(width = WIDTH, height = HEIGHT, onClose?: () => void): ImageBitmap {
  return { width, height, close: onClose ?? (() => undefined) } as ImageBitmap;
}

describe("BrowserMaskedVariantRenderer", () => {
  it("accepts ImageBitmap inputs and returns an image Blob through the raster boundary", async () => {
    let closes = 0;
    const master = fakeBitmap(WIDTH, HEIGHT, () => { closes += 1; });
    const maskBitmaps = Object.fromEntries(ZONES.map((zone) => [
      zone,
      fakeBitmap(WIDTH, HEIGHT, () => { closes += 1; })
    ])) as
      Record<RecolourZone, ImageBitmap>;
    const maskPixels = syntheticMasks();
    let encoded: Uint8ClampedArray | undefined;
    const codec: BitmapRasterCodec = {
      read(bitmap) {
        if (bitmap === master) return syntheticMaster();
        const zone = ZONES.find((candidate) => maskBitmaps[candidate] === bitmap);
        if (!zone) throw new Error("Unexpected bitmap");
        return maskPixels[zone];
      },
      async encode(pixels, width, height) {
        encoded = pixels;
        expect({ width, height }).toEqual({ width: WIDTH, height: HEIGHT });
        return new Blob([pixels.slice().buffer as ArrayBuffer], { type: "image/png" });
      }
    };

    const blob = await new BrowserMaskedVariantRenderer(codec).render({
      master,
      masks: maskBitmaps,
      styles,
      width: WIDTH,
      height: HEIGHT
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/png");
    expect(encoded).toBeDefined();
    expect(pixelAt(encoded!, 0, 0)).toEqual([17, 33, 49, 0]);
    expect(closes).toBe(0);
  });

  it.each([
    { width: 0, height: HEIGHT },
    { width: 1.5, height: HEIGHT },
    { width: Number.POSITIVE_INFINITY, height: HEIGHT },
    { width: WIDTH, height: Number.NaN }
  ])("rejects invalid output dimensions %#", async ({ width, height }) => {
    const renderer = new BrowserMaskedVariantRenderer({
      read: () => syntheticMaster(),
      encode: async () => new Blob([], { type: "image/png" })
    });

    await expect(renderer.render({
      master: fakeBitmap(),
      masks: {},
      styles: {},
      width,
      height
    })).rejects.toThrow("positive finite integers");
  });

  it("rejects a mask whose dimensions differ from the master before reading pixels", async () => {
    let reads = 0;
    const renderer = new BrowserMaskedVariantRenderer({
      read: () => {
        reads += 1;
        return syntheticMaster();
      },
      encode: async () => new Blob([], { type: "image/png" })
    });

    await expect(renderer.render({
      master: fakeBitmap(),
      masks: { body: fakeBitmap(WIDTH - 1, HEIGHT) },
      styles: { body: styles.body! },
      width: WIDTH,
      height: HEIGHT
    })).rejects.toThrow("match the master dimensions");
    expect(reads).toBe(0);
  });

  it("rejects requested dimensions that differ from the master before reading pixels", async () => {
    let reads = 0;
    const renderer = new BrowserMaskedVariantRenderer({
      read: () => {
        reads += 1;
        return syntheticMaster();
      },
      encode: async () => new Blob([], { type: "image/png" })
    });

    await expect(renderer.render({
      master: fakeBitmap(WIDTH - 1, HEIGHT),
      masks: {},
      styles: {},
      width: WIDTH,
      height: HEIGHT
    })).rejects.toThrow("match the master dimensions");
    expect(reads).toBe(0);
  });
});
