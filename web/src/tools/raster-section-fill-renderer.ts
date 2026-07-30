import type { RasterSectionFillRecipe } from "../fabric/canvas-port";
import {
  STUDENT_STARTER_FILL_PROFILES
} from "../product-kit/student-starter-catalogue";
import {
  findConnectedRegionFill,
  type PixelBuffer
} from "./connected-region-fill";

export interface LoadedRasterSectionFillSource {
  readonly url: string;
  readonly sha256: string;
  readonly pixels: PixelBuffer;
}

export interface RasterSectionFillEngine {
  load(url: string): Promise<LoadedRasterSectionFillSource>;
  render(
    source: LoadedRasterSectionFillSource,
    recipes: readonly RasterSectionFillRecipe[]
  ): HTMLCanvasElement;
}

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const SOURCE_DEADLINE_MS = 8_000;
const SOURCE_MIME_TYPE = "image/png";

function hexadecimal(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function canonicalSourceUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value, window.location.href);
  } catch {
    throw new Error("Section-fill source URL is invalid");
  }
  if (url.origin !== window.location.origin ||
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username || url.password || url.search || url.hash ||
    !url.pathname.startsWith("/catalog/")) {
    throw new Error("Section-fill source must be a canonical same-origin catalogue PNG");
  }
  return url.href;
}

async function boundedBytes(response: Response): Promise<ArrayBuffer> {
  if (!response.ok) {
    throw new Error(`Section-fill source request failed with status ${response.status}`);
  }
  if (response.redirected) throw new Error("Section-fill source request was redirected");
  const mimeType = response.headers.get("content-type")
    ?.split(";", 1)[0]?.trim().toLowerCase();
  if (mimeType !== SOURCE_MIME_TYPE) throw new Error("Section-fill source is not a PNG");
  const declared = response.headers.get("content-length");
  if (declared !== null &&
    (!/^\d+$/.test(declared) || Number(declared) > MAX_SOURCE_BYTES)) {
    throw new Error("Section-fill source is too large");
  }
  if (!response.body) throw new Error("Section-fill source response is empty");
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (chunk.value.byteLength > MAX_SOURCE_BYTES - byteLength) {
        await reader.cancel("Section-fill source exceeds byte limit");
        throw new Error("Section-fill source is too large");
      }
      chunks.push(chunk.value);
      byteLength += chunk.value.byteLength;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Cancellation may release the reader before this finally block.
    }
  }
  if (byteLength === 0) throw new Error("Section-fill source response is empty");
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

function decodePng(bytes: ArrayBuffer): Promise<PixelBuffer> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: SOURCE_MIME_TYPE }));
    const image = new Image();
    let settled = false;
    const finish = (operation: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
      operation();
    };
    const timer = setTimeout(() => finish(() => {
      reject(new Error("Section-fill source image took too long to decode"));
    }), SOURCE_DEADLINE_MS);
    image.onload = () => finish(() => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const pixelCount = width * height;
      if (!Number.isSafeInteger(pixelCount) || width < 1 || height < 1 ||
        pixelCount > 16_000_000) {
        reject(new Error("Section-fill source dimensions are invalid or too large"));
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        reject(new Error("Section-fill source pixels are unavailable"));
        return;
      }
      try {
        context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, width, height).data.slice();
        resolve({ width, height, data });
      } catch {
        reject(new Error("Section-fill source pixels could not be read"));
      }
    });
    image.onerror = () => finish(() => {
      reject(new Error("Section-fill source image could not be decoded"));
    });
    image.src = objectUrl;
  });
}

function colourBytes(colour: string): readonly [number, number, number] {
  if (!/^#[0-9a-f]{6}$/iu.test(colour)) throw new Error("Fill colour is invalid");
  return [
    Number.parseInt(colour.slice(1, 3), 16),
    Number.parseInt(colour.slice(3, 5), 16),
    Number.parseInt(colour.slice(5, 7), 16)
  ];
}

function validateRecipe(
  source: LoadedRasterSectionFillSource,
  recipe: RasterSectionFillRecipe
): void {
  const exactKeys = [
    "schema",
    "version",
    "fillProfile",
    "sourceAssetId",
    "sourceSha256",
    "seedX",
    "seedY",
    "colour",
    "colourDistance"
  ];
  if (recipe === null || typeof recipe !== "object" ||
    Reflect.ownKeys(recipe).length !== exactKeys.length ||
    !exactKeys.every((key) => Object.hasOwn(recipe, key)) ||
    recipe.schema !== "raster-section-fill" || recipe.version !== 1 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recipe.sourceAssetId) ||
    recipe.sourceSha256 !== source.sha256 ||
    !Number.isInteger(recipe.seedX) || !Number.isInteger(recipe.seedY) ||
    recipe.seedX < 0 || recipe.seedY < 0 ||
    recipe.seedX >= source.pixels.width || recipe.seedY >= source.pixels.height ||
    !Number.isFinite(recipe.colourDistance)) {
    throw new Error("Saved section-fill recipe is invalid");
  }
  colourBytes(recipe.colour);
  if (recipe.fillProfile === "bounded-linework-v1") {
    if (recipe.colourDistance !==
      STUDENT_STARTER_FILL_PROFILES["bounded-linework-v1"].colourDistance) {
      throw new Error("Saved section-fill recipe uses an unsupported tolerance");
    }
  } else if (recipe.fillProfile === "opaque-body-v1") {
    if (recipe.colourDistance !== 0) {
      throw new Error("Saved object-fill recipe uses an unsupported tolerance");
    }
  } else {
    throw new Error("Saved section-fill recipe uses an unsupported profile");
  }
}

function fillFailureMessage(status: Exclude<
  ReturnType<typeof findConnectedRegionFill>,
  { readonly status: "filled" }
>["status"]): string {
  switch (status) {
    case "transparent-seed":
      return "That point is transparent. Choose an opaque product section.";
    case "line-seed":
      return "That point is on the outline. Choose inside a product section.";
    case "unbounded-background":
      return "That section reaches the image background. Choose a closed section.";
    case "region-too-small":
      return "That section is too small to fill reliably. Choose a larger section.";
    case "region-too-large":
      return "That section is too large to fill safely. Choose a bounded product section.";
  }
}

export class BrowserRasterSectionFillEngine implements RasterSectionFillEngine {
  readonly #cache = new Map<string, Promise<LoadedRasterSectionFillSource>>();

  load(value: string): Promise<LoadedRasterSectionFillSource> {
    const url = canonicalSourceUrl(value);
    const existing = this.#cache.get(url);
    if (existing) return existing;
    const operation = this.#load(url).catch((error) => {
      this.#cache.delete(url);
      throw error;
    });
    this.#cache.set(url, operation);
    return operation;
  }

  render(
    source: LoadedRasterSectionFillSource,
    recipes: readonly RasterSectionFillRecipe[]
  ): HTMLCanvasElement {
    const pixels: PixelBuffer = {
      width: source.pixels.width,
      height: source.pixels.height,
      data: source.pixels.data.slice()
    };
    for (const recipe of recipes) {
      validateRecipe(source, recipe);
      const [red, green, blue] = colourBytes(recipe.colour);
      if (recipe.fillProfile === "opaque-body-v1") {
        const minimumAlpha = STUDENT_STARTER_FILL_PROFILES["opaque-body-v1"].minimumAlpha;
        for (let offset = 0; offset < pixels.data.length; offset += 4) {
          if (pixels.data[offset + 3]! < minimumAlpha) continue;
          pixels.data[offset] = red;
          pixels.data[offset + 1] = green;
          pixels.data[offset + 2] = blue;
        }
        continue;
      }
      const profile = STUDENT_STARTER_FILL_PROFILES["bounded-linework-v1"];
      const result = findConnectedRegionFill({
        source: pixels,
        seedX: recipe.seedX,
        seedY: recipe.seedY,
        colour: recipe.colour,
        colourDistance: recipe.colourDistance,
        lineDarknessThreshold: profile.lineDarknessThreshold,
        minimumAlpha: profile.minimumAlpha,
        maximumPixels: Math.max(
          profile.minimumRegionPixels,
          Math.floor(pixels.width * pixels.height * profile.maximumRegionFraction)
        )
      });
      if (result.status !== "filled") throw new Error(fillFailureMessage(result.status));
      for (const index of result.pixels) {
        const offset = index * 4;
        pixels.data[offset] = red;
        pixels.data[offset + 1] = green;
        pixels.data[offset + 2] = blue;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = pixels.width;
    canvas.height = pixels.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Section-fill preview is unavailable");
    const imageBytes = new Uint8ClampedArray(pixels.data.length);
    imageBytes.set(pixels.data);
    context.putImageData(new ImageData(imageBytes, pixels.width, pixels.height), 0, 0);
    return canvas;
  }

  async #load(url: string): Promise<LoadedRasterSectionFillSource> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SOURCE_DEADLINE_MS);
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        redirect: "error",
        headers: { accept: SOURCE_MIME_TYPE },
        signal: controller.signal
      });
      const bytes = await boundedBytes(response);
      const [digest, pixels] = await Promise.all([
        globalThis.crypto.subtle.digest("SHA-256", bytes),
        decodePng(bytes)
      ]);
      return Object.freeze({
        url,
        sha256: hexadecimal(digest),
        pixels
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error("Section-fill source request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
