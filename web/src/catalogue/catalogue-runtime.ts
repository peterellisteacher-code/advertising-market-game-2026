import {
  parseCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import type { CanvasPort } from "../fabric/canvas-port";
import { ObjectCommandService } from "../fabric/object-command-service";
import { CatalogueIndex } from "./catalogue-index";
import type { CatalogAssetV1 } from "./catalogue-types";
import { mergeOpenverseAfterCore } from "./openverse-client";

const LIVE_IMAGE_PATH = /^\/api\/openverse-image\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;
const LIVE_IMAGE_TIMEOUT_MS = 8_000;
const MAX_LIVE_IMAGE_BYTES = 12 * 1024 * 1024;
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
  input: HTMLInputElement;
  liveToggle: HTMLInputElement;
  status: HTMLElement;
  renderer: CatalogueRenderer;
  client: LivePhotoClient;
  liveDebounceMs?: number;
}

export class CatalogueRuntime {
  #coreIndex: CatalogueIndex;
  readonly #handleInput = (): void => { void this.#search(); };
  readonly #handleToggle = (): void => {
    this.options.client.setEnabled(this.options.liveToggle.checked);
    void this.#search();
  };
  #generation = 0;
  #latest: Promise<void> = Promise.resolve();
  #debounceTimer: ReturnType<typeof setTimeout> | null = null;
  #finishScheduled: (() => void) | null = null;

  constructor(private readonly options: CatalogueRuntimeOptions) {
    this.#coreIndex = new CatalogueIndex(options.core);
    options.liveToggle.checked = false;
    options.client.setEnabled(false);
    options.input.addEventListener("input", this.#handleInput);
    options.liveToggle.addEventListener("change", this.#handleToggle);
    this.#renderCore();
  }

  async settled(): Promise<void> {
    await this.#latest;
  }

  replaceCore(records: CatalogAssetV1[]): void {
    this.#coreIndex = new CatalogueIndex(structuredClone(records));
    void this.#search();
  }

  destroy(): void {
    this.#generation += 1;
    this.#cancelScheduled();
    this.options.input.removeEventListener("input", this.#handleInput);
    this.options.liveToggle.removeEventListener("change", this.#handleToggle);
    this.options.client.setEnabled(false);
  }

  #renderCore(): CatalogAssetV1[] {
    const core = this.#coreIndex.search(this.options.input.value);
    this.options.renderer.render(core);
    this.options.status.textContent = core.length === 0
      ? "No classroom-pack matches"
      : `${core.length} from the classroom pack`;
    return core;
  }

  #search(): Promise<void> {
    this.#cancelScheduled();
    const generation = ++this.#generation;
    const query = this.options.input.value;
    const core = this.#renderCore();
    if (!this.options.liveToggle.checked || Array.from(query.trim()).length < 2) {
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
}

interface CataloguePlacementHost {
  getDocument(): CampaignDocumentV1 | null;
  getCanvas(): Promise<CanvasPort>;
  commit(document: CampaignDocumentV1, localBlob?: LocalCatalogueBlob): void;
  createObjectId?: () => string;
  onError?: (error: Error) => void;
  fetch?: typeof fetch;
  createDeadlineSignal?: () => AbortSignal;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
}

export interface LocalCatalogueBlob {
  blobKey: string;
  blob: Blob;
  objectUrl: string;
}

function errorFrom(value: unknown): Error {
  return value instanceof Error ? value : new Error("Catalogue placement failed");
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

export class CataloguePlacementQueue {
  #tail: Promise<void> = Promise.resolve();
  #failure: Error | null = null;

  constructor(private readonly host: CataloguePlacementHost) {}

  enqueue(asset: CatalogAssetV1): void {
    const frozenAsset = structuredClone(asset);
    this.#tail = this.#tail.then(async () => {
      try {
        await this.#place(frozenAsset);
      } catch (error) {
        const failure = errorFrom(error);
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

  async #place(asset: CatalogAssetV1): Promise<void> {
    const current = this.host.getDocument();
    if (!current) throw new Error("Open a campaign before adding an asset");
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
      }
      attemptedAdd = true;
      await commands.addRaster({
        assetId: asset.id,
        sameOriginUrl: placementUrl,
        accessibleName: asset.title
      });
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
          commands.remove(objectId);
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
}
