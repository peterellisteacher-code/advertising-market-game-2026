import { Canvas } from "fabric";
import type { RecolourZone } from "../../src/catalogue/catalogue-types";
import { FabricCanvasAdapter } from "../../src/fabric/fabric-canvas-adapter";
import { ObjectCommandService } from "../../src/fabric/object-command-service";
import { sameOriginRasterUrl } from "../../src/fabric/object-factory";
import {
  BrowserMaskedVariantRenderer,
  type ZoneStyles
} from "../../src/tools/masked-variant-renderer";
import {
  VARIANT_CACHE_LIMIT,
  VariantObjectUrlCache,
  type VariantUrlLease
} from "../../src/tools/variant-cache";

const SIZE = 96;
const ZONES: readonly RecolourZone[] = ["body", "trim", "accent", "label"];
const CATEGORY_NAMES = ["drinkware", "footwear", "electronics", "packaging"] as const;
type CategoryName = typeof CATEGORY_NAMES[number];

interface Point { x: number; y: number }
interface Fixture {
  name: CategoryName;
  master: Uint8ClampedArray;
  masks: Record<RecolourZone, Uint8ClampedArray>;
  styles: ZoneStyles;
  samples: Record<RecolourZone, Point> & { dark: Point; bright: Point; shadow: Point };
}
interface CategoryResult {
  zoneIndependence: "pass";
  highlightContrast: "pass";
  alphaPreserved: "pass";
  darkLuminance: number;
  brightLuminance: number;
}

declare global {
  interface Window {
    __RECOLOURING_DIAGNOSTIC__?: {
      status: "running" | "pass" | "fail";
      categories: Partial<Record<CategoryName, CategoryResult>>;
      placementLifecycle?: "pass";
      retainedAfterEviction?: "pass";
      error?: string;
    };
  }
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Recolouring diagnostic is missing ${selector}`);
  return element;
}

const status = requiredElement<HTMLElement>("#status");
const fixtureHost = requiredElement<HTMLElement>("#fixtures");
const placementElement = requiredElement<HTMLCanvasElement>("#placement");
window.__RECOLOURING_DIAGNOSTIC__ = { status: "running", categories: {} };

const liveLeases: VariantUrlLease[] = [];
let liveCache: VariantObjectUrlCache | undefined;
window.addEventListener("beforeunload", () => {
  liveLeases.forEach((lease) => lease.release());
  liveCache?.dispose();
});

function offset(x: number, y: number): number {
  return (y * SIZE + x) * 4;
}

function setPixel(pixels: Uint8ClampedArray, x: number, y: number, values: readonly number[]): void {
  pixels.set(values, offset(x, y));
}

function makeFixture(name: CategoryName, index: number): Fixture {
  const bounds = [
    { left: 16, right: 80, top: 14, bottom: 84 },
    { left: 12, right: 84, top: 30, bottom: 72 },
    { left: 12, right: 84, top: 18, bottom: 78 },
    { left: 18, right: 78, top: 10, bottom: 86 }
  ][index];
  if (!bounds) throw new Error(`Missing bounds for ${name}`);
  const master = new Uint8ClampedArray(SIZE * SIZE * 4);
  const masks = Object.fromEntries(ZONES.map((zone) => [
    zone,
    new Uint8ClampedArray(SIZE * SIZE * 4)
  ])) as Record<RecolourZone, Uint8ClampedArray>;
  const label = {
    left: Math.floor((bounds.left + bounds.right) / 2) - 8,
    right: Math.floor((bounds.left + bounds.right) / 2) + 8,
    top: Math.floor((bounds.top + bounds.bottom) / 2) - 6,
    bottom: Math.floor((bounds.top + bounds.bottom) / 2) + 6
  };

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const inMainShape = x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
      const inFootwearUpper = name === "footwear" && x >= 28 && x <= 62 && y >= 20 && y < bounds.top;
      const inDrinkwareNeck = name === "drinkware" && x >= 38 && x <= 58 && y >= 7 && y < bounds.top;
      if (!inMainShape && !inFootwearUpper && !inDrinkwareNeck) continue;
      const relative = Math.max(0, Math.min(1, (x - bounds.left) / (bounds.right - bounds.left)));
      const tone = Math.round(44 + relative * 184 + (x === bounds.right - 16 ? 18 : 0));
      setPixel(master, x, y, [tone, tone, tone, 255]);

      let zone: RecolourZone = "body";
      if (x >= label.left && x <= label.right && y >= label.top && y <= label.bottom) zone = "label";
      else if (x >= bounds.right - 9) zone = "accent";
      else if (y < bounds.top + 5 || y > bounds.bottom - 5) zone = "trim";
      masks[zone][offset(x, y) + 3] = 255;
    }
  }
  const shadowY = Math.min(SIZE - 2, bounds.bottom + 3);
  for (let x = bounds.left + 5; x <= bounds.right - 5; x += 1) {
    setPixel(master, x, shadowY, [24, 24, 24, 72]);
  }

  const bodyMaterials = ["gloss-plastic", "fabric", "matte-plastic", "cardboard"];
  const labelMaterials = ["glass", "matte-plastic", "gloss-plastic", "wood"];
  return {
    name,
    master,
    masks,
    styles: {
      body: { colour: "#e23b3b", materialId: bodyMaterials[index]!, opacity: 1 },
      trim: { colour: "#2aba65", materialId: "rubber", opacity: 1 },
      accent: { colour: "#315eea", materialId: "brushed-metal", opacity: 1 },
      label: { colour: "#f2c94c", materialId: labelMaterials[index]!, opacity: 1 }
    },
    samples: {
      body: { x: bounds.left + 12, y: bounds.top + 12 },
      trim: { x: bounds.left + 18, y: bounds.top + 2 },
      accent: { x: bounds.right - 4, y: bounds.top + 12 },
      label: { x: Math.floor((bounds.left + bounds.right) / 2), y: Math.floor((bounds.top + bounds.bottom) / 2) },
      dark: { x: bounds.left + 12, y: bounds.top + 12 },
      bright: { x: bounds.right - 16, y: bounds.top + 12 },
      shadow: { x: Math.floor((bounds.left + bounds.right) / 2), y: shadowY }
    }
  };
}

async function bitmapFromPixels(pixels: Uint8ClampedArray): Promise<ImageBitmap> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Fixture canvas has no 2D context");
  const image = context.createImageData(SIZE, SIZE);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
  return createImageBitmap(canvas);
}

async function decodePixels(blob: Blob): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Decode canvas has no 2D context");
    context.drawImage(bitmap, 0, 0);
    return new Uint8ClampedArray(context.getImageData(0, 0, SIZE, SIZE).data);
  } finally {
    bitmap.close();
  }
}

function pixel(pixels: Uint8ClampedArray, point: Point): readonly [number, number, number, number] {
  const start = offset(point.x, point.y);
  return [
    pixels[start] ?? 0,
    pixels[start + 1] ?? 0,
    pixels[start + 2] ?? 0,
    pixels[start + 3] ?? 0
  ];
}

function luminance(value: readonly [number, number, number, number]): number {
  return value[0] * 0.2126 + value[1] * 0.7152 + value[2] * 0.0722;
}

function assertCategory(fixture: Fixture, output: Uint8ClampedArray): CategoryResult {
  const body = pixel(output, fixture.samples.body);
  const trim = pixel(output, fixture.samples.trim);
  const accent = pixel(output, fixture.samples.accent);
  const label = pixel(output, fixture.samples.label);
  if (!(body[0] > body[1] && body[0] > body[2])) throw new Error(`${fixture.name}: body colour was not independent`);
  if (!(trim[1] > trim[0] && trim[1] > trim[2])) throw new Error(`${fixture.name}: trim colour was not independent`);
  if (!(accent[2] > accent[0] && accent[2] > accent[1])) throw new Error(`${fixture.name}: accent colour was not independent`);
  if (!(label[0] > label[2] && label[1] > label[2])) throw new Error(`${fixture.name}: label colour was not independent`);
  for (let position = 3; position < output.length; position += 4) {
    if (output[position] !== fixture.master[position]) throw new Error(`${fixture.name}: alpha changed at pixel ${position / 4}`);
  }
  const darkLuminance = luminance(pixel(output, fixture.samples.dark));
  const brightLuminance = luminance(pixel(output, fixture.samples.bright));
  if (brightLuminance <= darkLuminance + 12) throw new Error(`${fixture.name}: highlight contrast was flattened`);
  if (pixel(output, fixture.samples.shadow)[3] !== pixel(fixture.master, fixture.samples.shadow)[3]) {
    throw new Error(`${fixture.name}: baked shadow alpha changed`);
  }
  return {
    zoneIndependence: "pass",
    highlightContrast: "pass",
    alphaPreserved: "pass",
    darkLuminance,
    brightLuminance
  };
}

async function runPlacementLifecycle(url: string): Promise<void> {
  if (sameOriginRasterUrl(url) !== url) throw new Error("Variant blob URL was not accepted as same-origin");
  const canvas = new Canvas(placementElement, { width: 320, height: 180, backgroundColor: "#ffffff" });
  const adapter = new FabricCanvasAdapter(canvas);
  const commands = new ObjectCommandService(adapter);
  const firstId = await commands.addRaster({
    assetId: "diagnostic-drinkware",
    sameOriginUrl: url,
    accessibleName: "Recoloured drinkware fixture"
  });
  const copyId = await commands.duplicate(firstId);
  const saved = commands.serialize();
  await commands.load(saved);
  const restored = commands.serialize().objects as Array<Record<string, unknown>>;
  if (restored.length !== 2 || !restored.some((item) => item.objectId === firstId) ||
    !restored.some((item) => item.objectId === copyId) || restored.some((item) => item.src !== url)) {
    throw new Error("Retained variant did not survive place, duplicate, serialize and load");
  }
}

async function run(): Promise<void> {
  const renderer = new BrowserMaskedVariantRenderer();
  const cache = new VariantObjectUrlCache();
  liveCache = cache;
  const results: Partial<Record<CategoryName, CategoryResult>> = {};

  for (const [index, name] of CATEGORY_NAMES.entries()) {
    const fixture = makeFixture(name, index);
    const master = await bitmapFromPixels(fixture.master);
    const masks = Object.fromEntries(await Promise.all(ZONES.map(async (zone) => [
      zone,
      await bitmapFromPixels(fixture.masks[zone])
    ]))) as Record<RecolourZone, ImageBitmap>;
    let renderedBlob: Blob | undefined;
    const lease = await cache.acquire({ assetId: `diagnostic-${name}`, version: 1 }, fixture.styles, async () => {
      renderedBlob = await renderer.render({ master, masks, styles: fixture.styles, width: SIZE, height: SIZE });
      return renderedBlob;
    });
    liveLeases.push(lease);
    master.close();
    ZONES.forEach((zone) => masks[zone].close());
    if (!renderedBlob) throw new Error(`${name}: renderer did not return a blob`);
    results[name] = assertCategory(fixture, await decodePixels(renderedBlob));

    const figure = document.createElement("figure");
    const image = document.createElement("img");
    image.src = lease.url;
    image.alt = `${name} four-zone recolouring fixture`;
    const caption = document.createElement("figcaption");
    caption.textContent = name;
    figure.append(image, caption);
    fixtureHost.append(figure);
    await image.decode();
  }

  for (let version = 1; version <= VARIANT_CACHE_LIMIT; version += 1) {
    const lease = await cache.acquire(
      { assetId: "diagnostic-eviction", version },
      {},
      async () => new Blob([String(version)], { type: "image/png" })
    );
    lease.release();
  }
  if (cache.size !== VARIANT_CACHE_LIMIT) throw new Error("Diagnostic cache exceeded 48 entries");
  cache.dispose();
  for (const lease of liveLeases) {
    const response = await fetch(lease.url);
    if (!response.ok || (await response.blob()).type !== "image/png") {
      throw new Error("A retained fixture URL was revoked during eviction or dispose");
    }
  }
  await runPlacementLifecycle(liveLeases[0]!.url);

  window.__RECOLOURING_DIAGNOSTIC__ = {
    status: "pass",
    categories: results,
    placementLifecycle: "pass",
    retainedAfterEviction: "pass"
  };
  status.dataset.recolouring = "pass";
  status.textContent = "Four category pixels, highlights and retained Fabric placement passed";
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  window.__RECOLOURING_DIAGNOSTIC__ = {
    status: "fail",
    categories: window.__RECOLOURING_DIAGNOSTIC__?.categories ?? {},
    error: message
  };
  status.dataset.recolouring = "fail";
  status.textContent = `Recolouring diagnostic failed: ${message}`;
  console.error(error);
});
