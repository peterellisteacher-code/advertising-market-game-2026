import type { RecolourZone } from "../catalogue/catalogue-types";
import {
  MATERIAL_PRESETS,
  type MaterialBlendMode,
  type MaterialPreset,
  type MaterialPresetId,
  type MaterialTexturePattern
} from "./material-presets";

export type ZoneStyle = { colour: string; materialId: string; opacity: number };
export type ZoneStyles = Partial<Record<RecolourZone, ZoneStyle>>;

export interface MaskedVariantRenderInput {
  master: ImageBitmap;
  masks: Partial<Record<RecolourZone, ImageBitmap>>;
  styles: ZoneStyles;
  width: number;
  height: number;
}

export interface MaskedVariantRenderer {
  render(input: MaskedVariantRenderInput): Promise<Blob>;
}

export interface BitmapRasterCodec {
  read(bitmap: ImageBitmap, width: number, height: number): Uint8ClampedArray;
  encode(pixels: Uint8ClampedArray, width: number, height: number): Promise<Blob>;
}

export interface PixelVariantRenderInput {
  master: Uint8ClampedArray;
  masks: Partial<Record<RecolourZone, Uint8ClampedArray>>;
  styles: ZoneStyles;
  width: number;
  height: number;
}

export const MASKED_VARIANT_SHADOW_POLICY = "preserve-shadows-in-master" as const;
const ZONE_PRECEDENCE: readonly RecolourZone[] = ["body", "trim", "accent", "label"];

function validateDimensions(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) ||
    !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error("Variant width and height must be positive finite integers");
  }
}

function validatePixelBuffer(name: string, pixels: Uint8ClampedArray, length: number): void {
  if (!(pixels instanceof Uint8ClampedArray) || pixels.length !== length) {
    throw new Error(`${name} pixels must contain exactly ${length} RGBA values`);
  }
}

function parseHexColour(value: string): readonly [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match?.[1]) throw new Error("Zone colour must be a six-digit hex colour");
  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16)
  ];
}

function materialPreset(materialId: string): Readonly<MaterialPreset> {
  if (!Object.hasOwn(MATERIAL_PRESETS, materialId)) {
    throw new Error(`Unknown material preset: ${materialId}`);
  }
  return MATERIAL_PRESETS[materialId as MaterialPresetId];
}

function validateStyle(style: ZoneStyle): {
  colour: readonly [number, number, number];
  preset: Readonly<MaterialPreset>;
} {
  if (!Number.isFinite(style.opacity) || style.opacity < 0 || style.opacity > 1) {
    throw new Error("Zone opacity must be a finite number from 0 to 1");
  }
  return { colour: parseHexColour(style.colour), preset: materialPreset(style.materialId) };
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function integerNoise(x: number, y: number, seed: number): number {
  let value = Math.imul(x + 1 + seed, 374_761_393) ^ Math.imul(y + 1 + seed, 668_265_263);
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);
  return ((value >>> 0) / 0xffff_ffff) * 2 - 1;
}

function textureValue(
  pattern: MaterialTexturePattern,
  x: number,
  y: number,
  scale: number,
  seed: number
): number {
  const column = (x + seed) % scale;
  const row = (y + seed) % scale;
  switch (pattern) {
    case "flat": return 0;
    case "gloss-band": return column < Math.max(1, Math.floor(scale / 4)) ? 1 : -0.2;
    case "pebble": return integerNoise(Math.floor(x / 2), Math.floor(y / 2), seed);
    case "fibre": return integerNoise(x, Math.floor(y / 2), seed) * 0.7;
    case "weave": return (column % 2 === row % 2 ? 1 : -1) * 0.65;
    case "glass-band": return column < Math.max(1, Math.floor(scale / 5)) ? 1 : -0.1;
    case "brushed": return integerNoise(x, Math.floor(y / 2), seed) * 0.55;
    case "grain": return (integerNoise(Math.floor(x / 3), y, seed) + Math.sin((x + seed) / scale)) / 2;
  }
}

function applyBlendMode(channel: number, luminance: number, mode: MaterialBlendMode): number {
  switch (mode) {
    case "multiply": return channel;
    case "soft-light": return channel * 0.88 + luminance * 0.12;
    case "screen": return 255 - ((255 - channel) * (255 - luminance)) / 255;
  }
}

export function compositeMaskedVariantPixels(input: PixelVariantRenderInput): Uint8ClampedArray {
  validateDimensions(input.width, input.height);
  const expectedLength = input.width * input.height * 4;
  validatePixelBuffer("Master", input.master, expectedLength);
  for (const zone of ZONE_PRECEDENCE) {
    const mask = input.masks[zone];
    if (mask) validatePixelBuffer(`${zone} mask`, mask, expectedLength);
  }

  const validatedStyles = new Map<RecolourZone, {
    style: ZoneStyle;
    colour: readonly [number, number, number];
    preset: Readonly<MaterialPreset>;
  }>();
  for (const zone of ZONE_PRECEDENCE) {
    const style = input.styles[zone];
    if (!style) continue;
    const validated = validateStyle(style);
    validatedStyles.set(zone, { style, ...validated });
  }

  const output = new Uint8ClampedArray(input.master);
  for (const zone of ZONE_PRECEDENCE) {
    const mask = input.masks[zone];
    const validated = validatedStyles.get(zone);
    if (!mask || !validated) continue;
    const { style, colour, preset } = validated;
    for (let y = 0; y < input.height; y += 1) {
      for (let x = 0; x < input.width; x += 1) {
        const offset = (y * input.width + x) * 4;
        const masterAlpha = input.master[offset + 3] ?? 0;
        const maskAlpha = mask[offset + 3] ?? 0;
        if (masterAlpha === 0 || maskAlpha === 0) continue;

        const red = input.master[offset] ?? 0;
        const green = input.master[offset + 1] ?? 0;
        const blue = input.master[offset + 2] ?? 0;
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        const coverage = (maskAlpha / 255) * style.opacity * preset.opacity;
        const texture = textureValue(
          preset.texturePattern,
          x,
          y,
          preset.textureScale,
          preset.textureSeed
        );
        const textureMultiplier = 1 + texture * preset.textureStrength;
        const highlight = Math.max(0, luminance - 144) * preset.highlightStrength;

        for (let channel = 0; channel < 3; channel += 1) {
          const colourChannel = colour[channel] ?? 0;
          const multiplied = colourChannel * (luminance / 255);
          const blended = applyBlendMode(multiplied, luminance, preset.blendMode);
          const materialChannel = clampByte(blended * textureMultiplier + highlight);
          const existing = output[offset + channel] ?? 0;
          output[offset + channel] = clampByte(existing * (1 - coverage) + materialChannel * coverage);
        }
        output[offset + 3] = masterAlpha;
      }
    }
  }
  return output;
}

function browserCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  if (typeof document === "undefined") throw new Error("Browser canvas rendering is unavailable");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("A 2D canvas context is required for masked variants");
  return { canvas, context };
}

export const browserBitmapRasterCodec: BitmapRasterCodec = {
  read(bitmap, width, height) {
    const { context } = browserCanvas(width, height);
    context.clearRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0);
    return new Uint8ClampedArray(context.getImageData(0, 0, width, height).data);
  },
  async encode(pixels, width, height) {
    const { canvas, context } = browserCanvas(width, height);
    const image = context.createImageData(width, height);
    image.data.set(pixels);
    context.putImageData(image, 0, 0);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas could not encode the masked variant"));
      }, "image/png");
    });
  }
};

export class BrowserMaskedVariantRenderer implements MaskedVariantRenderer {
  readonly #codec: BitmapRasterCodec;

  constructor(codec: BitmapRasterCodec = browserBitmapRasterCodec) {
    this.#codec = codec;
  }

  async render(input: MaskedVariantRenderInput): Promise<Blob> {
    validateDimensions(input.width, input.height);
    if (input.master.width !== input.width || input.master.height !== input.height) {
      throw new Error("Requested dimensions must match the master dimensions");
    }
    for (const zone of ZONE_PRECEDENCE) {
      const mask = input.masks[zone];
      if (mask && (mask.width !== input.master.width || mask.height !== input.master.height)) {
        throw new Error(`${zone} mask dimensions must match the master dimensions`);
      }
    }

    const masks: Partial<Record<RecolourZone, Uint8ClampedArray>> = {};
    for (const zone of ZONE_PRECEDENCE) {
      const mask = input.masks[zone];
      if (mask) masks[zone] = this.#codec.read(mask, input.width, input.height);
    }
    const pixels = compositeMaskedVariantPixels({
      master: this.#codec.read(input.master, input.width, input.height),
      masks,
      styles: input.styles,
      width: input.width,
      height: input.height
    });
    return this.#codec.encode(pixels, input.width, input.height);
  }
}

export const maskedVariantRenderer: MaskedVariantRenderer = new BrowserMaskedVariantRenderer();
