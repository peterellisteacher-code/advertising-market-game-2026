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
  dispose(): void;
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
    dispose() {
      let failure: unknown;
      try {
        adapter.dispose();
      } catch (error) {
        failure = error;
      }
      try {
        void canvas.dispose();
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
  readonly #productName: HTMLInputElement;
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
  }

  async open(value: CampaignDocumentV1): Promise<void> {
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
          runtime.dispose();
        } catch {
          // Preserve the original open/load failure.
        }
      }
      throw error;
    }
    const releasePreviousUrls = this.#releaseOwnedRasterUrls;
    this.#document = document;
    this.#blobs.clear();
    blobs.forEach((blob, key) => this.#blobs.set(key, blob));
    this.#ownedRasterUrls.clear();
    ownedUrls.forEach((url) => this.#ownedRasterUrls.add(url));
    this.#releaseOwnedRasterUrls = releaseUrls;
    releasePreviousUrls?.();
    this.#productName.value = document.product.name;
    this.#setOpen(true);
    this.shell.canvasRegion.focus({ preventScroll: true });
  }

  getState(): CampaignDocumentV1 {
    const document = this.#snapshot();
    this.#document = document;
    return structuredClone(document);
  }

  async save(): Promise<void> {
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

  publish(): PublishedCampaign {
    const runtime = this.#runtime;
    if (!runtime) throw new Error("Campaign creator is not open");
    const document = this.#snapshot();
    const published = new CampaignExporter(runtime.adapter, this.#ownedRasterUrls).publish(document);
    this.#document = document;
    return published;
  }

  close(): void {
    let cleanupError: Error | null = null;
    const attempt = (operation: () => void): void => {
      try {
        operation();
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
    attempt(() => runtime?.dispose());
    const releaseOwnedRasterUrls = this.#releaseOwnedRasterUrls;
    this.#releaseOwnedRasterUrls = null;
    attempt(() => releaseOwnedRasterUrls?.());
    this.#ownedRasterUrls.clear();
    this.#blobs.clear();
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
