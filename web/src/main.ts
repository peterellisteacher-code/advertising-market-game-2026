import "./styles/editor.css";
import { CREATOR_BRIDGE_CONTRACT, type CreatorBridgeHandler } from "./bridge/contracts";
import {
  createCreatorPublicApi,
  type CreatorPublicApi
} from "./bridge/creator-public-api";
import {
  parseCampaignDocument,
  type CampaignDocumentV1
} from "./domain/campaign-document";
import {
  CampaignExporter,
  type PublishedCampaign
} from "./export/campaign-exporter";
import { CataloguePanel } from "./catalogue/catalogue-panel";
import {
  CataloguePlacementQueue,
  CatalogueRuntime,
  type LocalCatalogueBlob
} from "./catalogue/catalogue-runtime";
import { loadOfflineCatalogue } from "./catalogue/catalogue-store";
import type { CatalogAssetV1 } from "./catalogue/catalogue-types";
import { OpenverseClient } from "./catalogue/openverse-client";
import { ProductShellRegionControls } from "./product-shells/product-shell-region-controls";
import { loadProductBuilderCatalogue } from "./product-builder/product-builder-catalogue";
import { ProductBuilderPanel } from "./product-builder/product-builder-panel";
import type { ProductArtwork } from "./product-builder/product-svg-composer";
import {
  createVirtualProductVariantResolver,
  type ResolvedProductVariant
} from "./product-builder/virtual-product-variant";
import type { FabricCanvasAdapter } from "./fabric/fabric-canvas-adapter";
import {
  canonicalDurableDocumentHash,
  IndexedDbDraftStore,
  rehydrateLocalAssetBlobs,
  type DraftStore
} from "./persistence/draft-store";
import { createEditorShell, type EditorShell } from "./ui/editor-shell";

const RETURN_TO_GAME_EVENT = "ad-market-creator:return-to-game";

interface CanvasRuntime {
  adapter: FabricCanvasAdapter;
  dispose(): Promise<void>;
}

function hasLocalBlobReferences(document: CampaignDocumentV1): boolean {
  return document.assetReferences.some((reference) => reference.kind === "local-blob");
}

function nextUpdatedAt(current: string, latest?: string): string {
  const candidates = [Date.now()];
  for (const value of [current, latest]) {
    if (value === undefined) continue;
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp)) candidates.push(timestamp + 1);
  }
  return new Date(Math.max(...candidates)).toISOString();
}

async function createCanvasRuntime(canvasElement: HTMLCanvasElement): Promise<CanvasRuntime> {
  const [{ Canvas }, { FabricCanvasAdapter }] = await Promise.all([
    import("fabric"),
    import("./fabric/fabric-canvas-adapter")
  ]);
  const canvas = new Canvas(canvasElement, {
    width: canvasElement.width,
    height: canvasElement.height,
    preserveObjectStacking: true
  });
  const adapter = new FabricCanvasAdapter(canvas);
  return {
    adapter,
    async dispose() {
      let failure: unknown;
      try {
        adapter.dispose();
      } catch (error) {
        failure = error;
      }
      try {
        await canvas.dispose();
      } catch (error) {
        failure ??= error;
      }
      if (failure !== undefined) throw failure;
    }
  };
}

class BrowserCreatorHandler implements CreatorBridgeHandler {
  readonly #blobs = new Map<string, Blob>();
  readonly #ownedRasterUrls = new Set<string>();
  readonly #placementOwnedRasterUrls = new Set<string>();
  readonly #productName: HTMLInputElement;
  readonly #placements: CataloguePlacementQueue;
  readonly #productShellRegions: ProductShellRegionControls;
  #document: CampaignDocumentV1 | null = null;
  #runtime: CanvasRuntime | null = null;
  #runtimePromise: Promise<CanvasRuntime> | null = null;
  #releaseOwnedRasterUrls: (() => void) | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly shell: EditorShell,
    private readonly gameSurface: HTMLElement | null,
    private readonly gameCanvas: HTMLCanvasElement | null,
    private readonly drafts: DraftStore = new IndexedDbDraftStore()
  ) {
    const productName = shell.overlay.querySelector<HTMLInputElement>(
      'input[aria-label="Product name"]'
    );
    if (!productName) throw new Error("Missing product-name input");
    this.#productName = productName;
    this.#productShellRegions = new ProductShellRegionControls(
      shell.inspector,
      (objectId, region, colour) => {
        if (!this.#runtime) throw new Error("Campaign creator is not open");
        this.#runtime.adapter.setProductShellRegion(objectId, region, colour);
        this.shell.polite.textContent = `${region} colour changed`;
      }
    );
    this.#productShellRegions.clear();
    this.#placements = new CataloguePlacementQueue({
      getDocument: () => this.#document,
      getCanvas: async () => (await this.#ensureRuntime()).adapter,
      commit: (document, localBlob) => this.#commitPlacement(document, localBlob),
      onProductShellPlaced: (objectId, productShell) => {
        this.#showProductShellRegions(objectId, productShell.title, productShell.regions);
      },
      onProductVariantPlaced: (_objectId, product) => {
        this.#showProductVariantSummary(`${product.paletteTitle} ${product.bodyTitle}`);
      },
      onError: (error) => { this.shell.assertive.textContent = error.message; }
    });
  }

  queueCataloguePlacement(asset: CatalogAssetV1): void {
    this.#placements.enqueue(asset);
  }

  queueProductVariantPlacement(
    product: ResolvedProductVariant,
    artwork?: ProductArtwork
  ): void {
    this.#placements.enqueueProductVariant(product, artwork);
  }

  async open(value: CampaignDocumentV1): Promise<void> {
    await this.#placements.flush();
    const requested = parseCampaignDocument(structuredClone(value));
    let document = requested;
    let blobs = new Map<string, Blob>();
    let ownedUrls = new Set<string>();
    let releaseUrls: (() => void) | null = null;
    if (hasLocalBlobReferences(requested)) {
      const stored = await this.drafts.load(requested.documentId);
      if (!stored) {
        throw new Error(`Persisted campaign revision ${requested.revision} is unavailable`);
      }
      if (stored.document.documentId !== requested.documentId ||
        stored.document.revision !== requested.revision) {
        throw new Error("Persisted campaign document or revision does not match the open request");
      }
      const [requestedHash, storedHash] = await Promise.all([
        canonicalDurableDocumentHash(requested),
        canonicalDurableDocumentHash(stored.document)
      ]);
      if (requestedHash !== storedHash) {
        throw new Error("Persisted campaign state does not match the open request");
      }
      const hydrated = rehydrateLocalAssetBlobs(stored.document, stored.blobs);
      document = hydrated.document;
      blobs = new Map(stored.blobs);
      ownedUrls = new Set(hydrated.ownedUrls);
      releaseUrls = hydrated.release;
    }
    const hadRuntime = this.#runtime !== null;
    let runtime: CanvasRuntime | null = null;
    try {
      runtime = await this.#ensureRuntime();
      await runtime.adapter.load(structuredClone(document.fabricState));
    } catch (error) {
      try {
        releaseUrls?.();
      } catch {
        // Preserve the open/load failure while still clearing a failed new runtime.
      }
      if (!hadRuntime && runtime !== null && this.#runtime === runtime) {
        this.#runtime = null;
        this.#runtimePromise = null;
        try {
          await runtime.dispose();
        } catch {
          // Preserve the original open/load failure.
        }
      }
      throw error;
    }
    const releasePreviousUrls = this.#releaseOwnedRasterUrls;
    const previousPlacementUrls = [...this.#placementOwnedRasterUrls];
    this.#document = document;
    this.#blobs.clear();
    blobs.forEach((blob, key) => this.#blobs.set(key, blob));
    this.#ownedRasterUrls.clear();
    ownedUrls.forEach((url) => this.#ownedRasterUrls.add(url));
    this.#placementOwnedRasterUrls.clear();
    this.#releaseOwnedRasterUrls = releaseUrls;
    releasePreviousUrls?.();
    previousPlacementUrls.forEach((url) => URL.revokeObjectURL(url));
    this.#productName.value = document.product.name;
    this.#restoreProductShellRegions(document);
    this.#setOpen(true);
    this.shell.canvasRegion.focus({ preventScroll: true });
  }

  async getState(): Promise<CampaignDocumentV1> {
    await this.#placements.flush();
    const document = this.#snapshot();
    this.#document = document;
    return structuredClone(document);
  }

  async save(): Promise<void> {
    await this.#placements.flush();
    const snapshot = this.#snapshot();
    const latest = await this.drafts.load(snapshot.documentId);
    const document = parseCampaignDocument({
      ...structuredClone(snapshot),
      revision: latest
        ? Math.max(snapshot.revision, latest.document.revision) + 1
        : snapshot.revision,
      updatedAt: nextUpdatedAt(snapshot.updatedAt, latest?.document.updatedAt)
    });
    await this.drafts.save(document, this.#blobs);
    this.#document = document;
  }

  async publish(): Promise<PublishedCampaign> {
    await this.#placements.flush();
    const runtime = this.#runtime;
    if (!runtime) throw new Error("Campaign creator is not open");
    const document = this.#snapshot();
    const published = new CampaignExporter(runtime.adapter, this.#ownedRasterUrls).publish(document);
    this.#document = document;
    return published;
  }

  async close(): Promise<void> {
    let cleanupError: Error | null = null;
    try {
      await this.#placements.flush();
    } catch (error) {
      cleanupError = error instanceof Error ? error : new Error("Catalogue placement failed");
    }
    const attempt = (operation: () => void): void => {
      try {
        operation();
      } catch (error) {
        cleanupError ??= error instanceof Error ? error : new Error("Campaign creator cleanup failed");
      }
    };
    const attemptAsync = async (operation: () => Promise<void>): Promise<void> => {
      try {
        await operation();
      } catch (error) {
        cleanupError ??= error instanceof Error ? error : new Error("Campaign creator cleanup failed");
      }
    };
    attempt(() => {
      if (this.#document && this.#runtime) this.#document = this.#snapshot();
    });
    const runtime = this.#runtime;
    this.#runtime = null;
    this.#runtimePromise = null;
    await attemptAsync(async () => {
      if (runtime) await runtime.dispose();
    });
    const releaseOwnedRasterUrls = this.#releaseOwnedRasterUrls;
    this.#releaseOwnedRasterUrls = null;
    attempt(() => releaseOwnedRasterUrls?.());
    attempt(() => {
      this.#placementOwnedRasterUrls.forEach((url) => URL.revokeObjectURL(url));
      this.#placementOwnedRasterUrls.clear();
    });
    this.#ownedRasterUrls.clear();
    this.#blobs.clear();
    this.#productShellRegions.clear();
    attempt(() => this.#setOpen(false));
    attempt(() => this.gameCanvas?.focus({ preventScroll: true }));
    if (cleanupError !== null) throw cleanupError;
  }

  #snapshot(): CampaignDocumentV1 {
    if (!this.#document) throw new Error("No campaign is open");
    return parseCampaignDocument({
      ...structuredClone(this.#document),
      product: {
        ...structuredClone(this.#document.product),
        name: this.#productName.value
      },
      fabricState: this.#runtime?.adapter.serialize() ?? structuredClone(this.#document.fabricState)
    });
  }

  #commitPlacement(document: CampaignDocumentV1, localBlob?: LocalCatalogueBlob): void {
    if (localBlob) {
      if (this.#blobs.has(localBlob.blobKey) || this.#ownedRasterUrls.has(localBlob.objectUrl)) {
        throw new Error("Catalogue placement produced a duplicate local asset");
      }
      this.#blobs.set(localBlob.blobKey, localBlob.blob);
      this.#ownedRasterUrls.add(localBlob.objectUrl);
      this.#placementOwnedRasterUrls.add(localBlob.objectUrl);
    }
    this.#document = document;
  }

  #showProductShellRegions(objectId: string, title: string, regions: string[]): void {
    if (!this.#runtime) return;
    this.#productShellRegions.show({
      objectId,
      title,
      regions,
      colours: this.#runtime.adapter.getProductShellRegionColours(objectId)
    });
  }

  #showProductVariantSummary(title: string): void {
    const heading = document.createElement("h2");
    heading.textContent = title;
    const guidance = document.createElement("p");
    guidance.textContent = "Choose new colours in the product maker to change this look.";
    this.shell.inspector.replaceChildren(heading, guidance);
  }

  #restoreProductShellRegions(document: CampaignDocumentV1): void {
    const object = [...document.fabricState.objects].reverse().find((candidate) =>
      candidate.elementKind === "product-shell" && typeof candidate.shellId === "string");
    if (!object || typeof object.objectId !== "string") {
      this.#productShellRegions.clear();
      return;
    }
    const isProductVariant = document.assetReferences.some((reference) =>
      reference.kind === "product-builder-variant" && reference.objectId === object.objectId);
    if (isProductVariant) {
      this.#showProductVariantSummary(
        typeof object.accessibleName === "string" ? object.accessibleName : "Product look"
      );
      return;
    }
    const colours = this.#runtime?.adapter.getProductShellRegionColours(object.objectId) ?? {};
    this.#productShellRegions.show({
      objectId: object.objectId,
      title: typeof object.accessibleName === "string" ? object.accessibleName : "Product shell",
      regions: Object.keys(colours),
      colours
    });
  }

  async #ensureRuntime(): Promise<CanvasRuntime> {
    if (this.#runtime) return this.#runtime;
    if (!this.#runtimePromise) {
      this.#runtimePromise = createCanvasRuntime(this.shell.canvas)
        .then((runtime) => {
          this.#runtime = runtime;
          return runtime;
        })
        .catch((error: unknown) => {
          this.#runtimePromise = null;
          throw error;
        });
    }
    return this.#runtimePromise;
  }

  #setOpen(open: boolean): void {
    this.root.hidden = !open;
    if (!this.gameSurface) return;
    this.gameSurface.inert = open;
    if (open) this.gameSurface.setAttribute("aria-hidden", "true");
    else this.gameSurface.removeAttribute("aria-hidden");
  }
}

const root = document.querySelector<HTMLElement>("#creator-root");
if (!root) throw new Error("Missing #creator-root");

const shell = createEditorShell(root);
const gameSurface = document.querySelector<HTMLElement>('main[aria-label="Advertising Market Game"]');
const gameCanvas = document.querySelector<HTMLCanvasElement>("#canvas");
root.hidden = true;

const handler = new BrowserCreatorHandler(root, shell, gameSurface, gameCanvas);
const publicApi = createCreatorPublicApi(handler);
const cataloguePanel = new CataloguePanel(
  shell.libraryResults,
  (asset) => handler.queueCataloguePlacement(asset)
);
const livePhotos = new OpenverseClient();
const catalogueRuntime = new CatalogueRuntime({
  core: [],
  input: shell.librarySearch,
  liveToggle: shell.livePhotos,
  status: shell.libraryStatus,
  renderer: cataloguePanel,
  client: livePhotos
});
const productBuilderPanel = new ProductBuilderPanel(
  shell.productBuilderPanel,
  (product, artwork) => handler.queueProductVariantPlacement(product, artwork)
);
productBuilderPanel.unavailable();
void loadOfflineCatalogue(root.dataset.offlineCatalogueUrl).then((core) => {
  catalogueRuntime.replaceCore(core);
});
void loadProductBuilderCatalogue(root.dataset.productBuilderCatalogueUrl).then((catalogue) => {
  if (!catalogue) {
    productBuilderPanel.unavailable();
    return;
  }
  productBuilderPanel.render(catalogue, createVirtualProductVariantResolver(catalogue));
});

root.querySelector<HTMLButtonElement>('[data-command="return"]')
  ?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent(RETURN_TO_GAME_EVENT, {
      detail: { contract: CREATOR_BRIDGE_CONTRACT, event: "closeRequested" }
    }));
  });

declare global {
  interface Window {
    AdMarketCreator: CreatorPublicApi;
  }
}

window.AdMarketCreator = publicApi;
