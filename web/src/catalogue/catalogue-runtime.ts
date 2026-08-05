import {
  parseCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import { campaignSemanticObjectMap } from "../domain/campaign-semantic-objects";
import type {
  ArtworkSurfaceAddress,
  CanvasPort,
  CanvasSelectionSnapshot,
  NewRasterInput
} from "../fabric/canvas-port";
import { ObjectCommandService } from "../fabric/object-command-service";
import { fillCanvasWithRaster } from "../tools/canvas-object-zoom";
import type { ProductArtwork } from "../product-builder/product-svg-composer";
import {
  createProductBuildSnapshot,
  type ProductBuildQuote
} from "../product-builder/product-economics";
import type { ResolvedProductVariant } from "../product-builder/virtual-product-variant";
import type { ProductShellRecord } from "../product-shells/product-shell-catalogue";
import { CatalogueIndex } from "./catalogue-index";
import type { CatalogAssetV1 } from "./catalogue-types";
import type { RasterPricingIndex, RasterPricingRole } from "./raster-pricing";
import { mergeOpenverseAfterCore } from "./openverse-client";
import { tintRasterTemplate, validatedRasterColour } from "./raster-template-tint";
import {
  isParsedProductKitCatalogue,
  type ProductKitCatalogue
} from "../product-kit/product-kit-catalogue";
import {
  parseProductKitCompositionReference,
  type ProductKitCompositionReference
} from "../product-kit/product-kit-document";
import { quoteProductKitComposition } from "../product-kit/product-kit-economics";
import type {
  LoadedProductKitBundle,
  ProductKitRasterSource
} from "../product-kit/product-kit-loader";
import type {
  ProductKitPrice,
  ProductKitPricingIndex
} from "../product-kit/product-kit-pricing";
import {
  createProductKitRuntime,
  type ProductKitCompositionRequest,
  type ProductKitRuntime
} from "../product-kit/product-kit-runtime";
import { snapshotPlainData } from "../product-kit/plain-data";
import { isAdBackgroundPreset } from "../assets/ad-background-presets";

const LIVE_IMAGE_PATH = /^\/api\/openverse-image\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const LIVE_IMAGE_TIMEOUT_MS = 8_000;
const MAX_LIVE_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_PRODUCT_SHELL_BYTES = 1024 * 1024;
const MAX_PRODUCT_VARIANT_SVG_BYTES = 128 * 1024;
const LIVE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export interface CatalogueRenderer {
  render(records: CatalogAssetV1[]): void;
}

export interface LivePhotoClient {
  setEnabled(enabled: boolean): void;
  search(query: string): Promise<
    { status: "online"; records: CatalogAssetV1[] } |
    { status: "offline"; records: [] }
  >;
}

export interface CatalogueRuntimeOptions {
  core: CatalogAssetV1[];
  pricing?: RasterPricingIndex | null;
  input: HTMLInputElement;
  categorySelect: HTMLSelectElement;
  viewSelect: HTMLSelectElement;
  liveToggle: HTMLInputElement;
  status: HTMLElement;
  renderer: CatalogueRenderer;
  client: LivePhotoClient;
  liveDebounceMs?: number;
}

export type CatalogueLibraryView = "products" | "parts" | "backgrounds" | "all";

const rolesForView: Readonly<Record<CatalogueLibraryView, ReadonlySet<RasterPricingRole>>> = {
  products: new Set(["base"]),
  parts: new Set(["part"]),
  backgrounds: new Set(),
  all: new Set(["base", "part", "media"])
};

export function filterCatalogueByView(
  records: readonly CatalogAssetV1[],
  pricing: RasterPricingIndex,
  view: CatalogueLibraryView
): CatalogAssetV1[] {
  if (view === "backgrounds") return records.filter(isAdBackgroundPreset);
  const roles = rolesForView[view];
  return records.filter(({ id, delivery }) => {
    if (delivery !== "offline") return false;
    const price = pricing.byAssetId.get(id);
    return price !== undefined && roles.has(price.role);
  });
}

function selectedLibraryView(select: HTMLSelectElement): CatalogueLibraryView {
  return select.value === "parts" || select.value === "all" || select.value === "backgrounds" ? select.value : "products";
}

export class CatalogueRuntime {
  #coreIndex: CatalogueIndex;
  #allCore: CatalogAssetV1[];
  #pricing: RasterPricingIndex | null;
  #activeCount = 0;
  readonly #handleInput = (): void => { void this.#search(); };
  readonly #handleCategory = (): void => { void this.#search(); };
  readonly #handleView = (): void => { this.#activateView(); };
  readonly #handleToggle = (): void => {
    this.options.client.setEnabled(this.options.liveToggle.checked);
    void this.#search();
  };
  #generation = 0;
  #latest: Promise<void> = Promise.resolve();
  #debounceTimer: ReturnType<typeof setTimeout> | null = null;
  #finishScheduled: (() => void) | null = null;

  constructor(private readonly options: CatalogueRuntimeOptions) {
    this.#allCore = structuredClone(options.core);
    this.#pricing = options.pricing ?? null;
    this.#coreIndex = new CatalogueIndex([]);
    options.viewSelect.value = "products";
    options.liveToggle.checked = false;
    options.client.setEnabled(false);
    options.input.addEventListener("input", this.#handleInput);
    options.categorySelect.addEventListener("change", this.#handleCategory);
    options.viewSelect.addEventListener("change", this.#handleView);
    options.liveToggle.addEventListener("change", this.#handleToggle);
    this.#activateView();
  }

  async settled(): Promise<void> {
    await this.#latest;
  }

  replaceCore(records: CatalogAssetV1[], pricing: RasterPricingIndex | null): void {
    this.#allCore = structuredClone(records);
    this.#pricing = pricing;
    this.#activateView();
  }

  destroy(): void {
    this.#generation += 1;
    this.#cancelScheduled();
    this.options.input.removeEventListener("input", this.#handleInput);
    this.options.categorySelect.removeEventListener("change", this.#handleCategory);
    this.options.viewSelect.removeEventListener("change", this.#handleView);
    this.options.liveToggle.removeEventListener("change", this.#handleToggle);
    this.options.client.setEnabled(false);
  }

  #renderCore(): CatalogAssetV1[] {
    const category = this.options.categorySelect.value;
    const core = this.#coreIndex.search(this.options.input.value, category || undefined);
    this.options.renderer.render(core);
    const categoryLabel = this.options.categorySelect.selectedOptions[0]?.textContent?.trim();
    const view = selectedLibraryView(this.options.viewSelect);
    const viewLabel = view === "products" ? "products" : view === "parts" ? "parts" : "pieces";
    this.options.status.textContent = core.length === 0
      ? "No classroom-pack matches"
      : category && categoryLabel
        ? `${core.length} in ${categoryLabel}`
        : core.length === 100 && this.#activeCount > core.length
          ? `Showing 100 of ${this.#activeCount} ${viewLabel} · search or choose a category`
        : `${core.length} of ${this.#activeCount} ${viewLabel}`;
    return core;
  }

  #search(): Promise<void> {
    this.#cancelScheduled();
    const generation = ++this.#generation;
    const query = this.options.input.value;
    const core = this.#renderCore();
    if (this.options.categorySelect.value || !this.options.liveToggle.checked ||
      Array.from(query.trim()).length < 2) {
      this.#latest = Promise.resolve();
      return this.#latest;
    }

    this.options.status.textContent = `${core.length} from the classroom pack · looking for live photos`;
    const debounceMs = Math.max(0, this.options.liveDebounceMs ?? 250);
    const operation = new Promise<void>((resolve) => {
      let finished = false;
      const finish = (): void => {
        if (finished) return;
        finished = true;
        resolve();
      };
      this.#finishScheduled = finish;
      this.#debounceTimer = setTimeout(() => {
        this.#debounceTimer = null;
        this.#finishScheduled = null;
        void this.options.client.search(query).then((result) => {
          if (generation !== this.#generation) return;
          if (result.status === "offline") {
            this.options.renderer.render(core);
            this.options.status.textContent = `${core.length} from the classroom pack · live photos unavailable`;
            return;
          }
          const merged = mergeOpenverseAfterCore(core, result);
          const live = merged.slice(core.length);
          this.options.renderer.render(merged);
          this.options.status.textContent = `${core.length} classroom-pack choices · ${live.length} live photos`;
        }).catch(() => {
          if (generation !== this.#generation) return;
          this.options.renderer.render(core);
          this.options.status.textContent = `${core.length} from the classroom pack · live photos unavailable`;
        }).finally(finish);
      }, debounceMs);
    });
    this.#latest = operation;
    return operation;
  }

  #cancelScheduled(): void {
    if (this.#debounceTimer !== null) clearTimeout(this.#debounceTimer);
    this.#debounceTimer = null;
    this.#finishScheduled?.();
    this.#finishScheduled = null;
  }

  #activateView(): void {
    const view = selectedLibraryView(this.options.viewSelect);
    const active = view === "backgrounds" ? this.#allCore.filter(isAdBackgroundPreset) :
      this.#pricing === null ? [] : filterCatalogueByView(this.#allCore, this.#pricing, view);
    this.#activeCount = active.length;
    this.#coreIndex = new CatalogueIndex(active);
    this.#replaceCategories(active);
    void this.#search();
  }

  #replaceCategories(records: CatalogAssetV1[]): void {
    const previous = this.options.categorySelect.value;
    const categories = new Set(
      records.map(({ category }) => category.trim().toLowerCase()).filter(Boolean)
    );
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "All categories";
    const categoryOptions = [...categories]
      .sort((left, right) => left.localeCompare(right))
      .map((category) => {
        const option = document.createElement("option");
        option.value = category;
        const words = category.replace(/[-_]+/g, " ");
        option.textContent = words.charAt(0).toUpperCase() + words.slice(1);
        return option;
      });
    this.options.categorySelect.replaceChildren(all, ...categoryOptions);
    this.options.categorySelect.value = categories.has(previous) ? previous : "";
  }
}

interface CataloguePlacementHost {
  getDocument(): CampaignDocumentV1 | null;
  getCanvas(): Promise<CanvasPort>;
  commit(document: CampaignDocumentV1, localBlob?: LocalCatalogueBlob): void;
  transaction?: (operation: () => Promise<void>) => Promise<void>;
  createObjectId?: () => string;
  onError?: (error: Error) => void;
  fetch?: typeof fetch;
  createDeadlineSignal?: () => AbortSignal;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  tintRaster?: (asset: CatalogAssetV1, bodyColour: string) => Promise<Blob>;
  onProductShellPlaced?: (objectId: string, shell: ProductShellRecord) => void;
  onProductVariantPlaced?: (objectId: string, product: ResolvedProductVariant) => void;
  sectionFillForAsset?: (
    asset: CatalogAssetV1
  ) => NewRasterInput["sectionFill"] | undefined;
}

export interface LocalCatalogueBlob {
  blobKey: string;
  blob: Blob;
  objectUrl: string;
}

export interface CataloguePlacementStyle {
  bodyColour: string;
  fullCanvas?: boolean;
}

export type GeneratedImageStage = "object-forge" | "make-it-real";

export interface GeneratedRasterPlacement {
  assetId: string;
  title: string;
  blob: Blob;
  stage: GeneratedImageStage;
  profileId: string;
  requestId: string;
}

function errorFrom(value: unknown): Error {
  return value instanceof Error ? value : new Error("Catalogue placement failed.");
}

function requiredGeneratedText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Generated image ${label} must not be empty`);
  }
  return value.trim();
}

function validatedGeneratedRaster(input: GeneratedRasterPlacement): GeneratedRasterPlacement {
  if (!(input.blob instanceof Blob)) throw new Error("Generated image must be a Blob");
  if (!LIVE_IMAGE_TYPES.has(input.blob.type)) {
    throw new Error("Generated image type is not supported");
  }
  if (input.blob.size === 0) throw new Error("Generated image is empty");
  if (input.blob.size > MAX_LIVE_IMAGE_BYTES) throw new Error("Generated image is too large");
  if (input.stage !== "object-forge" && input.stage !== "make-it-real") {
    throw new Error("Generated image stage is not supported");
  }
  return Object.freeze({
    assetId: requiredGeneratedText(input.assetId, "asset ID"),
    title: requiredGeneratedText(input.title, "title"),
    blob: input.blob,
    stage: input.stage,
    profileId: requiredGeneratedText(input.profileId, "profile ID"),
    requestId: requiredGeneratedText(input.requestId, "request ID")
  });
}

interface ProductKitBundleSnapshot {
  readonly catalogue: ProductKitCatalogue;
  readonly runtime: ProductKitRuntime;
  readonly rasterSources: ReadonlyMap<string, ProductKitRasterSource>;
  readonly pricing: ProductKitPricingIndex;
}

interface ProductKitSelectionRollback {
  canvas: CanvasPort | null;
  snapshot: CanvasSelectionSnapshot | null;
}

function exactDataRecord(
  value: unknown,
  keys: readonly string[]
): Readonly<Record<string, unknown>> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).length !== keys.length ||
    !keys.every((key) => Object.hasOwn(descriptors, key))) return null;
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
  }
  return Object.fromEntries(keys.map((key) => [key, descriptors[key]!.value]));
}

function readonlyMapEntries(value: unknown, maximum: number): Array<readonly [unknown, unknown]> {
  if (value === null || typeof value !== "object") {
    throw new Error("Product Kit bundle contains an invalid map");
  }
  const entries: Array<readonly [unknown, unknown]> = [];
  try {
    for (const entry of value as ReadonlyMap<unknown, unknown>) {
      if (!Array.isArray(entry) || entry.length !== 2 || entries.length >= maximum) {
        throw new Error("Product Kit bundle map is invalid or too large");
      }
      entries.push([entry[0], entry[1]]);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Product Kit bundle")) throw error;
    throw new Error("Product Kit bundle contains an unreadable map");
  }
  return entries;
}

function snapshotProductKitRasterSources(
  value: unknown
): ReadonlyMap<string, ProductKitRasterSource> {
  const result = new Map<string, ProductKitRasterSource>();
  for (const [rawKey, rawSource] of readonlyMapEntries(value, 20_000)) {
    const source = snapshotPlainData(rawSource, { maxNodes: 16, maxArrayLength: 0 });
    const fields = exactDataRecord(source, ["assetId", "masterSha256", "masterUrl"]);
    if (typeof rawKey !== "string" || !fields || fields.assetId !== rawKey ||
      typeof fields.masterSha256 !== "string" || !/^[0-9a-f]{64}$/.test(fields.masterSha256) ||
      typeof fields.masterUrl !== "string" || !fields.masterUrl.trim() || result.has(rawKey)) {
      throw new Error("Product Kit raster-source snapshot is invalid");
    }
    result.set(rawKey, Object.freeze({
      assetId: rawKey,
      masterSha256: fields.masterSha256,
      masterUrl: fields.masterUrl
    }));
  }
  return result;
}

function snapshotProductKitPricing(value: unknown): ProductKitPricingIndex {
  const fields = exactDataRecord(value, [
    "packId", "pricingVersion", "blueprintTitleByKitId", "byPriceAssetId"
  ]);
  if (!fields || typeof fields.packId !== "string" ||
    !Number.isSafeInteger(fields.pricingVersion) || (fields.pricingVersion as number) < 1) {
    throw new Error("Product Kit pricing snapshot is invalid");
  }
  const blueprintTitleByKitId = new Map<string, string>();
  for (const [key, title] of readonlyMapEntries(fields.blueprintTitleByKitId, 20_000)) {
    if (typeof key !== "string" || typeof title !== "string" || !title.trim() ||
      blueprintTitleByKitId.has(key)) throw new Error("Product Kit pricing snapshot is invalid");
    blueprintTitleByKitId.set(key, title);
  }
  const byPriceAssetId = new Map<string, ProductKitPrice>();
  for (const [rawKey, rawPrice] of readonlyMapEntries(fields.byPriceAssetId, 20_000)) {
    const price = snapshotPlainData(rawPrice, { maxNodes: 32, maxArrayLength: 0 });
    const parts = exactDataRecord(price, [
      "priceAssetId", "groupId", "groupLabel", "kind", "label", "costCents"
    ]);
    if (typeof rawKey !== "string" || !parts || parts.priceAssetId !== rawKey ||
      byPriceAssetId.has(rawKey)) throw new Error("Product Kit pricing snapshot is invalid");
    byPriceAssetId.set(rawKey, Object.freeze(parts as unknown as ProductKitPrice));
  }
  return Object.freeze({
    packId: fields.packId,
    pricingVersion: fields.pricingVersion as number,
    blueprintTitleByKitId,
    byPriceAssetId
  });
}

function snapshotProductKitBundle(value: LoadedProductKitBundle): ProductKitBundleSnapshot {
  const fields = exactDataRecord(value, [
    "catalogue",
    "runtime",
    "rasterSources",
    "pricing",
    "starterManifest",
    "starterRasters"
  ]);
  const runtimeFields = fields && exactDataRecord(fields.runtime, ["resolvePair", "planComposition"]);
  if (!fields || !isParsedProductKitCatalogue(fields.catalogue) || !runtimeFields ||
    typeof runtimeFields.resolvePair !== "function" ||
    typeof runtimeFields.planComposition !== "function") {
    throw new Error("Product Kit placement requires an admitted loaded bundle");
  }
  const catalogue = fields.catalogue;
  return Object.freeze({
    catalogue,
    runtime: createProductKitRuntime(catalogue),
    rasterSources: snapshotProductKitRasterSources(fields.rasterSources),
    pricing: snapshotProductKitPricing(fields.pricing)
  });
}

function snapshotProductKitRequest(value: ProductKitCompositionRequest): ProductKitCompositionRequest {
  const snapshot = snapshotPlainData(value, {
    maxNodes: 2_000_000,
    maxArrayLength: 131_072
  });
  if (!snapshot) throw new Error("Product Kit composition request could not be snapshotted");
  return snapshot as unknown as ProductKitCompositionRequest;
}

function canonicalLiveImageUrl(asset: CatalogAssetV1): URL | null {
  let url: URL;
  try {
    url = new URL(asset.files.master, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/openverse-image/")) {
    return null;
  }
  const match = url.pathname.match(LIVE_IMAGE_PATH);
  if (!match || url.search || url.hash || match[1] !== asset.id) {
    throw new Error("Live catalogue asset requires its canonical full Openverse image URL");
  }
  return url;
}

async function capturedLiveBlob(response: Response): Promise<Blob> {
  if (!response.ok) throw new Error(`Live image request failed with status ${response.status}`);
  const mimeType = response.headers.get("content-type")?.trim().toLowerCase() ?? "";
  if (!LIVE_IMAGE_TYPES.has(mimeType)) throw new Error("Live image type is not supported");
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_LIVE_IMAGE_BYTES) {
      throw new Error("Live image is too large");
    }
  }
  if (!response.body) throw new Error("Live image response has no body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_LIVE_IMAGE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error("Live image is too large");
    }
    chunks.push(value);
  }
  if (total === 0) throw new Error("Live image response is empty");
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Blob([bytes.buffer], { type: mimeType });
}

function canonicalProductVariantUrl(
  value: string,
  product: ResolvedProductVariant,
  relativePath: string
): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Product look URL is invalid");
  }
  const expected = `/catalog/generated/${product.packId}/${relativePath}`;
  if (url.origin !== window.location.origin || url.pathname !== expected ||
    url.username || url.password || url.search || url.hash) {
    throw new Error("Product look URL must be canonical and same-origin");
  }
  return url;
}

async function capturedProductVariantSvg(response: Response, label: string): Promise<string> {
  if (!response.ok) throw new Error(`${label} request failed with status ${response.status}`);
  const mimeType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mimeType !== "image/svg+xml") throw new Error(`${label} response is not SVG`);
  const declaredLength = response.headers.get("content-length");
  if (declaredLength !== null &&
    (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_PRODUCT_VARIANT_SVG_BYTES)) {
    throw new Error(`${label} SVG is too large`);
  }
  const svg = await response.text();
  if (!svg.trim() || new TextEncoder().encode(svg).byteLength > MAX_PRODUCT_VARIANT_SVG_BYTES) {
    throw new Error(`${label} SVG is empty or too large`);
  }
  return svg;
}

export class CataloguePlacementQueue {
  #tail: Promise<void> = Promise.resolve();
  #failure: Error | null = null;

  constructor(private readonly host: CataloguePlacementHost) {}

  enqueue(asset: CatalogAssetV1, style?: CataloguePlacementStyle): void {
    const frozenAsset = structuredClone(asset);
    const frozenStyle = style === undefined ? undefined : structuredClone(style);
    this.#enqueue(async () => this.#place(frozenAsset, frozenStyle));
  }

  enqueueArtworkRaster(address: ArtworkSurfaceAddress, asset: CatalogAssetV1): void {
    const frozenAddress = structuredClone(address);
    const frozenAsset = structuredClone(asset);
    this.#enqueue(async () => this.#placeArtworkRaster(frozenAddress, frozenAsset));
  }

  enqueueProductShell(shell: ProductShellRecord, packId: string): void {
    const frozenShell = structuredClone(shell);
    this.#enqueue(async () => this.#placeProductShell(frozenShell, packId));
  }

  enqueueProductVariant(
    product: ResolvedProductVariant,
    quote: ProductBuildQuote,
    artwork?: ProductArtwork
  ): void {
    const selectedQuote = structuredClone(quote);
    const selectedArtwork = artwork === undefined ? undefined : Object.freeze({ ...artwork });
    this.#enqueue(async () => this.#placeProductVariant(product, selectedQuote, selectedArtwork));
  }

  enqueueGeneratedRaster(input: GeneratedRasterPlacement): void {
    const frozenInput = Object.freeze({ ...input });
    this.#enqueue(async () => this.#placeGeneratedRaster(frozenInput));
  }

  enqueueProductKit(
    bundle: LoadedProductKitBundle,
    request: ProductKitCompositionRequest
  ): void {
    const selectedBundle = snapshotProductKitBundle(bundle);
    const selectedRequest = snapshotProductKitRequest(request);
    const selection: ProductKitSelectionRollback = {
      canvas: null,
      snapshot: null
    };
    this.#enqueue(
      async () => this.#placeProductKit(selectedBundle, selectedRequest, selection),
      () => {
        if (selection.canvas && selection.snapshot) {
          selection.canvas.restoreSelection(selection.snapshot);
        }
      },
      true
    );
  }

  #enqueue(
    operation: () => Promise<void>,
    rollback?: () => void | Promise<void>,
    requireHostTransaction = false
  ): void {
    this.#tail = this.#tail.then(async () => {
      try {
        if (requireHostTransaction && !this.host.transaction) {
          throw new Error("Product Kit placement requires the host transaction");
        }
        if (this.host.transaction) await this.host.transaction(operation);
        else await operation();
      } catch (error) {
        let failure = errorFrom(error);
        if (rollback) {
          try {
            await rollback();
          } catch (rollbackError) {
            failure = new AggregateError(
              [failure, errorFrom(rollbackError)],
              "Catalogue placement rollback failed."
            );
          }
        }
        this.#failure ??= failure;
        this.host.onError?.(failure);
      }
    });
  }

  async flush(): Promise<void> {
    await this.#tail;
    if (this.#failure) {
      const failure = this.#failure;
      this.#failure = null;
      throw failure;
    }
  }

  async #placeProductKit(
    bundle: ProductKitBundleSnapshot,
    request: ProductKitCompositionRequest,
    selection: ProductKitSelectionRollback
  ): Promise<void> {
    const current = this.host.getDocument();
    if (!current) throw new Error("Open a campaign before adding a Product Kit");
    const plan = bundle.runtime.planComposition(request);
    if (!plan) throw new Error("Product Kit composition plan is invalid or uncertified");
    const quote = quoteProductKitComposition(plan, bundle.pricing);
    if (!quote) throw new Error("Product Kit composition price could not be quoted");
    const kit = bundle.catalogue.kits.find(({ id }) => id === plan.kitId);
    if (!kit || quote.packId !== bundle.catalogue.packId ||
      quote.blueprintId !== request.kitId || plan.kitId !== request.kitId) {
      throw new Error("Product Kit plan, catalogue and price do not agree");
    }

    const objectId = (this.host.createObjectId ?? (() => globalThis.crypto.randomUUID()))();
    const canvas = await this.host.getCanvas();
    selection.canvas = canvas;
    selection.snapshot = canvas.captureSelection();
    const commands = new ObjectCommandService(canvas, () => objectId);
    const documentObjects = campaignSemanticObjectMap(current.fabricState);
    const canvasBefore = campaignSemanticObjectMap(commands.serialize());
    if (documentObjects.has(objectId) || canvasBefore.has(objectId) ||
      current.assetReferences.some((reference) => reference.objectId === objectId)) {
      throw new Error(`Product Kit object ID ${objectId} already exists`);
    }

    let attemptedAdd = false;
    try {
      attemptedAdd = true;
      const addedId = await commands.addProductKit({
        accessibleName: kit.title,
        catalogue: bundle.catalogue,
        plan,
        rasterSources: bundle.rasterSources
      });
      if (addedId !== objectId) throw new Error("Product Kit object ID allocation changed");

      const fabricState = commands.serialize();
      const semantic = campaignSemanticObjectMap(fabricState);
      const addedSemanticIds = [...semantic.keys()].filter((id) => !canvasBefore.has(id));
      const root = semantic.get(objectId);
      if (addedSemanticIds.length !== 1 || addedSemanticIds[0] !== objectId || !root ||
        root.path.length !== 1 || root.elementKind !== "product-kit" ||
        root.accessibleName !== kit.title ||
        root.object.productKitPackId !== bundle.catalogue.packId ||
        root.object.productKitId !== plan.kitId ||
        root.object.productKitCatalogSha256 !== bundle.catalogue.catalogSha256) {
        throw new Error("Placed Product Kit did not reconcile with one semantic canvas root");
      }

      const proposedReference: ProductKitCompositionReference = {
        kind: "product-kit-composition",
        version: 1,
        objectId,
        productKitPackId: bundle.catalogue.packId,
        catalogPackId: bundle.catalogue.catalogPackId,
        catalogSha256: bundle.catalogue.catalogSha256,
        request,
        pricedItems: plan.pricedItems
      };
      const context = {
        catalogue: bundle.catalogue,
        runtime: bundle.runtime,
        pricing: bundle.pricing
      };
      const reference = parseProductKitCompositionReference(proposedReference, context);
      if (!reference) throw new Error("Product Kit composition reference is invalid");
      const build = createProductBuildSnapshot(quote, objectId);
      if (reference.objectId !== root.objectId || build.primaryObjectId !== root.objectId ||
        build.packId !== reference.productKitPackId ||
        build.blueprintId !== reference.request.kitId ||
        root.object.productKitPackId !== reference.productKitPackId ||
        root.object.productKitId !== reference.request.kitId ||
        root.object.productKitCatalogSha256 !== reference.catalogSha256) {
        throw new Error("Product Kit canvas root, reference and build do not agree");
      }

      const latest = this.host.getDocument();
      if (!latest || latest.documentId !== current.documentId ||
        latest.sessionId !== current.sessionId ||
        (latest.teamId ?? null) !== (current.teamId ?? null)) {
        throw new Error("The open campaign changed while the Product Kit was loading");
      }
      if (latest.assetReferences.some((candidate) => candidate.objectId === objectId)) {
        throw new Error(`Product Kit object ID ${objectId} already has a campaign reference`);
      }
      const next = parseCampaignDocument({
        ...structuredClone(latest),
        product: {
          ...structuredClone(latest.product),
          build
        },
        strategy: {
          ...structuredClone(latest.strategy),
          productTraitIds: [],
          marketedChoiceIds: [],
          marketRoute: null
        },
        fabricState,
        assetReferences: [
          ...latest.assetReferences,
          reference
        ]
      });
      const committedReferences = next.assetReferences.filter((candidate) =>
        candidate.kind === "product-kit-composition" && candidate.objectId === objectId
      );
      const committedReference = committedReferences.length === 1
        ? parseProductKitCompositionReference(committedReferences[0], context)
        : null;
      if (!committedReference || !next.product.build ||
        JSON.stringify(next.product.build) !== JSON.stringify(build) ||
        committedReference.objectId !== next.product.build.primaryObjectId ||
        committedReference.productKitPackId !== next.product.build.packId ||
        committedReference.request.kitId !== next.product.build.blueprintId) {
        throw new Error("Product Kit campaign document did not preserve exact agreement");
      }
      this.host.commit(next);
    } catch (error) {
      if (attemptedAdd) {
        try {
          canvas.remove(objectId);
        } catch {
          // Preserve the Product Kit placement failure; the host transaction restores state.
        }
      }
      throw error;
    }
  }

  async #placeGeneratedRaster(input: GeneratedRasterPlacement): Promise<void> {
    const generated = validatedGeneratedRaster(input);
    const current = this.host.getDocument();
    if (!current) throw new Error("Open a campaign before adding a generated image");
    const canvas = await this.host.getCanvas();
    const objectId = (this.host.createObjectId ?? (() => globalThis.crypto.randomUUID()))();
    const commands = new ObjectCommandService(canvas, () => objectId);
    if (campaignSemanticObjectMap(current.fabricState).has(objectId) ||
      campaignSemanticObjectMap(commands.serialize()).has(objectId)) {
      throw new Error(`Generated raster object ID ${objectId} already exists`);
    }

    let localBlob: LocalCatalogueBlob | undefined;
    let attemptedAdd = false;
    try {
      const objectUrl = (this.host.createObjectURL ?? ((value) => URL.createObjectURL(value)))(
        generated.blob
      );
      localBlob = {
        blobKey: `generated-${objectId}`,
        blob: generated.blob,
        objectUrl
      };
      attemptedAdd = true;
      await commands.addRaster({
        assetId: generated.assetId,
        sameOriginUrl: objectUrl,
        accessibleName: generated.title
      });
      let fabricState = commands.serialize();
      const object = campaignSemanticObjectMap(fabricState).get(objectId);
      if (!object || object.path.length !== 1 || object.elementKind !== "image" ||
        object.assetId !== generated.assetId || object.object.accessibleName !== generated.title) {
        throw new Error("Placed generated raster did not reconcile with the canvas");
      }
      if (generated.stage === "make-it-real") {
        fillCanvasWithRaster(canvas, objectId);
        fabricState = commands.serialize();
      }
      const next = parseCampaignDocument({
        ...structuredClone(current),
        fabricState,
        assetReferences: [
          ...current.assetReferences,
          {
            kind: "generated-image",
            version: 1,
            objectId,
            assetId: generated.assetId,
            title: generated.title,
            stage: generated.stage,
            profileId: generated.profileId,
            requestId: generated.requestId
          },
          {
            kind: "local-blob",
            objectId,
            assetId: generated.assetId,
            blobKey: localBlob.blobKey,
            mimeType: generated.blob.type
          }
        ]
      });
      this.host.commit(next, localBlob);
    } catch (error) {
      if (attemptedAdd) {
        try {
          canvas.remove(objectId);
        } catch {
          // Preserve the generated-image placement failure.
        }
      }
      if (localBlob) {
        try {
          (this.host.revokeObjectURL ?? ((url) => URL.revokeObjectURL(url)))(localBlob.objectUrl);
        } catch {
          // Preserve the generated-image placement failure.
        }
      }
      throw error;
    }
  }

  async #place(asset: CatalogAssetV1, style?: CataloguePlacementStyle): Promise<void> {
    const current = this.host.getDocument();
    if (!current) throw new Error("Open a campaign before adding an asset");
    const bodyColour = style !== undefined && asset.delivery === "offline" &&
      asset.recolourZones.includes("body")
      ? validatedRasterColour(style.bodyColour)
      : null;
    const canvas = await this.host.getCanvas();
    const objectId = (this.host.createObjectId ?? (() => globalThis.crypto.randomUUID()))();
    const commands = new ObjectCommandService(canvas, () => objectId);
    const liveUrl = canonicalLiveImageUrl(asset);
    let localBlob: LocalCatalogueBlob | undefined;
    let placementUrl = asset.files.master;
    let attemptedAdd = false;
    try {
      if (liveUrl) {
        const fetcher = this.host.fetch ?? ((input, init) => fetch(input, init));
        const response = await fetcher(liveUrl.href, {
          method: "GET",
          credentials: "same-origin",
          headers: { accept: "image/png, image/jpeg, image/webp" },
          signal: this.host.createDeadlineSignal?.() ?? AbortSignal.timeout(LIVE_IMAGE_TIMEOUT_MS)
        });
        const blob = await capturedLiveBlob(response);
        const objectUrl = (this.host.createObjectURL ?? ((value) => URL.createObjectURL(value)))(blob);
        localBlob = { blobKey: `catalog-${objectId}`, blob, objectUrl };
        placementUrl = objectUrl;
      } else if (bodyColour !== null) {
        const tint = this.host.tintRaster ?? ((record, colour) => tintRasterTemplate(
          record,
          colour,
          {
            ...(this.host.fetch ? { fetch: this.host.fetch } : {}),
            ...(this.host.createDeadlineSignal
              ? { createDeadlineSignal: this.host.createDeadlineSignal }
              : {})
          }
        ));
        const blob = await tint(asset, bodyColour);
        if (blob.type !== "image/png" || blob.size === 0 || blob.size > MAX_LIVE_IMAGE_BYTES) {
          throw new Error("Tinted catalogue raster is not a usable PNG");
        }
        const objectUrl = (this.host.createObjectURL ?? ((value) => URL.createObjectURL(value)))(blob);
        localBlob = { blobKey: `catalog-${objectId}`, blob, objectUrl };
        placementUrl = objectUrl;
      }
      attemptedAdd = true;
      const sectionFill = localBlob === undefined && bodyColour === null
        ? this.host.sectionFillForAsset?.(asset)
        : undefined;
      await commands.addRaster({
        assetId: asset.id,
        sameOriginUrl: placementUrl,
        accessibleName: asset.title,
        ...(sectionFill === undefined ? {} : { sectionFill })
      });
      if (style?.fullCanvas) {
        fillCanvasWithRaster(canvas, objectId);
        commands.moveToBack(objectId);
      }
      const fabricState = commands.serialize();
      const objects = Array.isArray(fabricState.objects)
        ? fabricState.objects as Array<Record<string, unknown>>
        : [];
      const object = objects.find((candidate) => candidate.objectId === objectId);
      if (!object || object.elementKind !== "image" || object.assetId !== asset.id) {
        throw new Error("Placed catalogue raster did not reconcile with the canvas");
      }
      const next = parseCampaignDocument({
        ...structuredClone(current),
        fabricState,
        assetReferences: [
          ...current.assetReferences,
          {
            kind: "catalog",
            objectId,
            assetId: asset.id,
            assetVersion: asset.version,
            attribution: structuredClone(asset.attribution)
          },
          ...(localBlob ? [{
            kind: "local-blob",
            objectId,
            assetId: asset.id,
            blobKey: localBlob.blobKey,
            mimeType: localBlob.blob.type
          }] : [])
        ]
      });
      this.host.commit(next, localBlob);
    } catch (error) {
      if (attemptedAdd) {
        try {
          canvas.remove(objectId);
        } catch {
          // Preserve the reconciliation failure; the adapter may already have rolled back.
        }
      }
      if (localBlob) {
        try {
          (this.host.revokeObjectURL ?? ((url) => URL.revokeObjectURL(url)))(localBlob.objectUrl);
        } catch {
          // Preserve the placement failure.
        }
      }
      throw error;
    }
  }

  async #placeArtworkRaster(
    address: ArtworkSurfaceAddress,
    asset: CatalogAssetV1
  ): Promise<void> {
    const current = this.host.getDocument();
    if (!current) throw new Error("Open a campaign before adding an asset");
    const canvas = await this.host.getCanvas();
    const objectId = (this.host.createObjectId ?? (() => globalThis.crypto.randomUUID()))();
    const commands = new ObjectCommandService(canvas, () => objectId);
    if (campaignSemanticObjectMap(current.fabricState).has(objectId) ||
      campaignSemanticObjectMap(commands.serialize()).has(objectId)) {
      throw new Error(`Generated catalogue artwork object ID ${objectId} already exists`);
    }

    const liveUrl = canonicalLiveImageUrl(asset);
    let localBlob: LocalCatalogueBlob | undefined;
    let placementUrl = asset.files.master;
    let attemptedAdd = false;
    try {
      if (liveUrl) {
        const fetcher = this.host.fetch ?? ((input, init) => fetch(input, init));
        const response = await fetcher(liveUrl.href, {
          method: "GET",
          credentials: "same-origin",
          headers: { accept: "image/png, image/jpeg, image/webp" },
          signal: this.host.createDeadlineSignal?.() ?? AbortSignal.timeout(LIVE_IMAGE_TIMEOUT_MS)
        });
        const blob = await capturedLiveBlob(response);
        const objectUrl = (this.host.createObjectURL ?? ((value) => URL.createObjectURL(value)))(blob);
        localBlob = { blobKey: `catalog-${objectId}`, blob, objectUrl };
        placementUrl = objectUrl;
      }

      attemptedAdd = true;
      await commands.addArtworkRaster(address, {
        assetId: asset.id,
        sameOriginUrl: placementUrl,
        accessibleName: asset.title
      });
      const fabricState = commands.serialize();
      const semanticObjects = campaignSemanticObjectMap(fabricState);
      const product = semanticObjects.get(address.productId);
      const child = semanticObjects.get(objectId);
      const path = child?.path;
      const roots = Array.isArray(fabricState.objects)
        ? fabricState.objects as Array<Record<string, unknown>>
        : [];
      const root = path?.length === 3 ? roots[path[0]!] : undefined;
      const rootChildren = root && Array.isArray(root.objects)
        ? root.objects as Array<Record<string, unknown>>
        : [];
      const slot = path?.length === 3 ? rootChildren[path[1]!] : undefined;
      const slotChildren = slot && Array.isArray(slot.objects)
        ? slot.objects as Array<Record<string, unknown>>
        : [];
      const rawChild = path?.length === 3 ? slotChildren[path[2]!] : undefined;
      if (!product || product.path.length !== 1 || product.path[0] !== path?.[0] ||
        product.elementKind !== "product-shell" || product.object !== root ||
        slot?.productLayer !== "artwork-slot" || slot.artworkSlotId !== address.slotId ||
        !child || child.object !== rawChild || child.elementKind !== "image" ||
        child.assetId !== asset.id) {
        throw new Error("Placed catalogue artwork raster did not reconcile with the canvas");
      }

      const next = parseCampaignDocument({
        ...structuredClone(current),
        fabricState,
        assetReferences: [
          ...current.assetReferences,
          {
            kind: "catalog",
            objectId,
            assetId: asset.id,
            assetVersion: asset.version,
            attribution: structuredClone(asset.attribution)
          },
          ...(localBlob ? [{
            kind: "local-blob",
            objectId,
            assetId: asset.id,
            blobKey: localBlob.blobKey,
            mimeType: localBlob.blob.type
          }] : [])
        ]
      });
      this.host.commit(next, localBlob);
    } catch (error) {
      if (attemptedAdd) {
        try {
          commands.removeArtwork(address, objectId);
        } catch {
          // Preserve the placement failure; the adapter may already have rolled back.
        }
      }
      if (localBlob) {
        try {
          (this.host.revokeObjectURL ?? ((url) => URL.revokeObjectURL(url)))(localBlob.objectUrl);
        } catch {
          // Preserve the placement failure.
        }
      }
      throw error;
    }
  }

  async #placeProductShell(shell: ProductShellRecord, packId: string): Promise<void> {
    const current = this.host.getDocument();
    if (!current) throw new Error("Open a campaign before adding a product shell");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(packId)) {
      throw new Error("Product shell pack ID is invalid");
    }
    let source: URL;
    try {
      source = new URL(shell.authoringUrl, window.location.href);
    } catch {
      throw new Error("Product shell URL is invalid");
    }
    const expectedSuffix = `/shells/${shell.id}/authoring.svg`;
    if (source.origin !== window.location.origin ||
      !source.pathname.startsWith("/catalog/generated/") ||
      !source.pathname.endsWith(expectedSuffix) || source.search || source.hash) {
      throw new Error("Product shell URL must be canonical and same-origin");
    }
    const fetcher = this.host.fetch ?? ((input, init) => fetch(input, init));
    const response = await fetcher(source.href, {
      method: "GET",
      credentials: "same-origin",
      headers: { accept: "image/svg+xml" },
      signal: this.host.createDeadlineSignal?.() ?? AbortSignal.timeout(LIVE_IMAGE_TIMEOUT_MS)
    });
    if (!response.ok) {
      throw new Error(`Product shell request failed with status ${response.status}`);
    }
    const mimeType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
    if (mimeType !== "image/svg+xml") throw new Error("Product shell response is not SVG");
    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null &&
      (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_PRODUCT_SHELL_BYTES)) {
      throw new Error("Product shell SVG is too large");
    }
    const svg = await response.text();
    if (!svg.trim() || new TextEncoder().encode(svg).byteLength > MAX_PRODUCT_SHELL_BYTES) {
      throw new Error("Product shell SVG is empty or too large");
    }

    const canvas = await this.host.getCanvas();
    const objectId = (this.host.createObjectId ?? (() => globalThis.crypto.randomUUID()))();
    const commands = new ObjectCommandService(canvas, () => objectId);
    let attemptedAdd = false;
    try {
      attemptedAdd = true;
      await commands.addProductShell({
        shellId: shell.id,
        svg,
        accessibleName: shell.title
      });
      const fabricState = commands.serialize();
      const objects = Array.isArray(fabricState.objects)
        ? fabricState.objects as Array<Record<string, unknown>>
        : [];
      const object = objects.find((candidate) => candidate.objectId === objectId);
      if (!object || object.elementKind !== "product-shell" || object.shellId !== shell.id) {
        throw new Error("Placed product shell did not reconcile with the canvas");
      }
      const next = parseCampaignDocument({
        ...structuredClone(current),
        fabricState,
        assetReferences: [
          ...current.assetReferences,
          {
            kind: "product-shell",
            objectId,
            shellId: shell.id,
            packId,
            version: 1
          }
        ]
      });
      this.host.commit(next);
      this.host.onProductShellPlaced?.(objectId, shell);
    } catch (error) {
      if (attemptedAdd) {
        try {
          canvas.remove(objectId);
        } catch {
          // Preserve the product-shell placement failure.
        }
      }
      throw error;
    }
  }

  async #placeProductVariant(
    product: ResolvedProductVariant,
    quote: ProductBuildQuote,
    artwork?: ProductArtwork
  ): Promise<void> {
    const current = this.host.getDocument();
    if (!current) throw new Error("Open a campaign before adding a product");
    if (!Object.isFrozen(product) || product.schema !== "product-builder-variant@1") {
      throw new Error("Product look identity must come from the reviewed catalogue");
    }
    if (quote.packId !== product.packId || quote.blueprintId !== product.bodyId) {
      throw new Error("Product price ledger does not match the selected product");
    }
    const authoringUrl = canonicalProductVariantUrl(
      product.authoringUrl,
      product,
      `bodies/${product.bodyId}/authoring.svg`
    );
    const componentUrl = canonicalProductVariantUrl(
      product.componentUrl,
      product,
      `components/${product.partId}.svg`
    );
    const fetcher = this.host.fetch ?? ((input, init) => fetch(input, init));
    const request = (url: URL, label: string): Promise<string> => fetcher(url.href, {
      method: "GET",
      credentials: "same-origin",
      redirect: "error",
      headers: { accept: "image/svg+xml" },
      signal: this.host.createDeadlineSignal?.() ?? AbortSignal.timeout(LIVE_IMAGE_TIMEOUT_MS)
    }).then((response) => capturedProductVariantSvg(response, label));
    const [authoringSvg, componentSvg] = await Promise.all([
      request(authoringUrl, "Product body"),
      request(componentUrl, "Product part")
    ]);

    const canvas = await this.host.getCanvas();
    const objectId = (this.host.createObjectId ?? (() => globalThis.crypto.randomUUID()))();
    const commands = new ObjectCommandService(canvas, () => objectId);
    let attemptedAdd = false;
    try {
      attemptedAdd = true;
      await commands.addProductVariant({
        accessibleName: `${product.paletteTitle} ${product.bodyTitle}`,
        variant: product,
        authoringSvg,
        componentSvg,
        ...(artwork === undefined ? {} : { artwork })
      });
      const fabricState = commands.serialize();
      const objects = Array.isArray(fabricState.objects)
        ? fabricState.objects as Array<Record<string, unknown>>
        : [];
      const object = objects.find((candidate) => candidate.objectId === objectId);
      if (!object || object.elementKind !== "product-shell" ||
        object.variantId !== product.id || object.packId !== product.packId ||
        object.bodyId !== product.bodyId || object.partId !== product.partId ||
        object.paletteId !== product.paletteId || object.materialId !== product.materialId) {
        throw new Error("Placed product look did not reconcile with the canvas");
      }
      const latest = this.host.getDocument();
      if (!latest || latest.documentId !== current.documentId ||
        latest.sessionId !== current.sessionId ||
        (latest.teamId ?? null) !== (current.teamId ?? null)) {
        throw new Error("The open campaign changed while the product look was loading");
      }
      const next = parseCampaignDocument({
        ...structuredClone(latest),
        product: {
          ...structuredClone(latest.product),
          build: createProductBuildSnapshot(quote, objectId)
        },
        strategy: {
          ...structuredClone(latest.strategy),
          productTraitIds: [],
          marketedChoiceIds: [],
          marketRoute: null
        },
        fabricState,
        assetReferences: [
          ...latest.assetReferences,
          {
            kind: "product-builder-variant",
            version: 1,
            objectId,
            packId: product.packId,
            variantId: product.id,
            bodyId: product.bodyId,
            partId: product.partId,
            paletteId: product.paletteId,
            materialId: product.materialId,
            artwork: artwork === undefined ? null : { ...artwork }
          }
        ]
      });
      this.host.commit(next);
    } catch (error) {
      if (attemptedAdd) {
        try {
          canvas.remove(objectId);
        } catch {
          // Preserve the composition or reconciliation failure.
        }
      }
      throw error;
    }
    try {
      this.host.onProductVariantPlaced?.(objectId, product);
    } catch (error) {
      this.host.onError?.(errorFrom(error));
    }
  }
}
