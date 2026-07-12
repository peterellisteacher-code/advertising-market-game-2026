import {
  parseCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import type { CanvasPort } from "../fabric/canvas-port";
import { ObjectCommandService } from "../fabric/object-command-service";
import { CatalogueIndex } from "./catalogue-index";
import type { CatalogAssetV1 } from "./catalogue-types";

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
  readonly #coreIndex: CatalogueIndex;
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
          const coreIds = new Set(core.map(({ id }) => id));
          const live = result.records.filter(({ id }) => !coreIds.has(id));
          this.options.renderer.render([...core, ...live]);
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
  commit(document: CampaignDocumentV1): void;
  createObjectId?: () => string;
  onError?: (error: Error) => void;
}

function errorFrom(value: unknown): Error {
  return value instanceof Error ? value : new Error("Catalogue placement failed");
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
    let added = false;
    try {
      await commands.addRaster({
        assetId: asset.id,
        sameOriginUrl: asset.files.master,
        accessibleName: asset.title
      });
      added = true;
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
        assetReferences: [...current.assetReferences, {
          kind: "catalog",
          objectId,
          assetId: asset.id,
          assetVersion: asset.version,
          attribution: structuredClone(asset.attribution)
        }]
      });
      this.host.commit(next);
    } catch (error) {
      if (added) {
        try {
          commands.remove(objectId);
        } catch {
          // Preserve the reconciliation failure; the adapter may already have rolled back.
        }
      }
      throw error;
    }
  }
}
