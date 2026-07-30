import type { CatalogAssetV1 } from "./catalogue-types";

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;
const MAX_LAYER_BYTES = 4 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 12 * 1024 * 1024;
const LOAD_TIMEOUT_MS = 8_000;

export interface DecodedRasterLayer {
  source: CanvasImageSource;
  width: number;
  height: number;
  close(): void;
}

export interface RasterTintComposition {
  master: DecodedRasterLayer;
  mask: DecodedRasterLayer;
  colour: string;
  width: number;
  height: number;
}

export interface RasterTintBackend {
  decode(blob: Blob): Promise<DecodedRasterLayer>;
  compose(input: RasterTintComposition): Promise<Blob>;
}

export interface RasterTintOptions {
  fetch?: typeof fetch;
  createDeadlineSignal?: () => AbortSignal;
  backend?: RasterTintBackend;
}

export function validatedRasterColour(value: string): string {
  if (!HEX_COLOUR.test(value)) {
    throw new Error("Template colour must be a six-digit hex colour");
  }
  return value.toUpperCase();
}

function canonicalLayerUrl(asset: CatalogAssetV1, value: string, relativePath: string): string {
  if (asset.delivery !== "offline") throw new Error("Only offline raster templates can be tinted");
  const expected = `/catalog/generated/offline-core-v1/assets/${asset.id}/${relativePath}`;
  let url: URL;
  try {
    url = new URL(value, window.location.href);
  } catch {
    throw new Error("Raster template layer URL is invalid");
  }
  if (
    url.origin !== window.location.origin
    || url.pathname !== expected
    || url.username
    || url.password
    || url.search
    || url.hash
  ) {
    throw new Error("Raster template layers must use their canonical same-origin URLs");
  }
  return url.href;
}

async function capturedPng(response: Response, label: string): Promise<Blob> {
  if (!response.ok) throw new Error(`${label} request failed with status ${response.status}`);
  const mimeType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mimeType !== "image/png") throw new Error(`${label} must be a PNG`);
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_LAYER_BYTES)) {
    throw new Error(`${label} is too large`);
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) throw new Error(`${label} is empty`);
  if (bytes.byteLength > MAX_LAYER_BYTES) throw new Error(`${label} is too large`);
  return new Blob([bytes], { type: "image/png" });
}

const browserBackend: RasterTintBackend = {
  async decode(blob) {
    if (typeof createImageBitmap !== "function") {
      throw new Error("This browser cannot recolour raster templates");
    }
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close()
    };
  },
  async compose({ master, mask, colour, width, height }) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("This browser cannot compose raster template colours");

    context.clearRect(0, 0, width, height);
    context.fillStyle = colour;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "destination-in";
    context.drawImage(mask.source, 0, 0, width, height);
    context.globalCompositeOperation = "multiply";
    context.drawImage(master.source, 0, 0, width, height);
    context.globalCompositeOperation = "source-over";

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Raster template colour could not be encoded"));
      }, "image/png");
    });
  }
};

export async function tintRasterTemplate(
  asset: CatalogAssetV1,
  colourValue: string,
  options: RasterTintOptions = {}
): Promise<Blob> {
  const colour = validatedRasterColour(colourValue);
  if (asset.delivery !== "offline" || !asset.recolourZones.includes("body")) {
    throw new Error("Catalogue asset has no colourable raster body");
  }
  const bodyMask = asset.files.masks?.body;
  if (!bodyMask) throw new Error("Colourable raster template has no body mask");
  const masterUrl = canonicalLayerUrl(asset, asset.files.master, "master.png");
  const maskUrl = canonicalLayerUrl(asset, bodyMask, "masks/body.png");
  const fetcher = options.fetch ?? ((input, init) => fetch(input, init));
  const signal = options.createDeadlineSignal?.() ?? AbortSignal.timeout(LOAD_TIMEOUT_MS);
  const [masterBlob, maskBlob] = await Promise.all([
    fetcher(masterUrl, {
      method: "GET",
      credentials: "same-origin",
      headers: { accept: "image/png" },
      signal
    }).then((response) => capturedPng(response, "Raster template master")),
    fetcher(maskUrl, {
      method: "GET",
      credentials: "same-origin",
      headers: { accept: "image/png" },
      signal
    }).then((response) => capturedPng(response, "Raster template body mask"))
  ]);
  const backend = options.backend ?? browserBackend;
  let master: DecodedRasterLayer | null = null;
  let mask: DecodedRasterLayer | null = null;
  try {
    master = await backend.decode(masterBlob);
    mask = await backend.decode(maskBlob);
    const { width, height } = asset.dimensions;
    if (
      master.width !== width
      || master.height !== height
      || mask.width !== width
      || mask.height !== height
    ) {
      throw new Error("Raster template layer dimensions do not match catalogue metadata");
    }
    const result = await backend.compose({ master, mask, colour, width, height });
    if (result.type !== "image/png" || result.size === 0 || result.size > MAX_OUTPUT_BYTES) {
      throw new Error("Tinted raster template is not a usable PNG");
    }
    return result;
  } finally {
    mask?.close();
    master?.close();
  }
}
