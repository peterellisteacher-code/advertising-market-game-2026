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
  IndexedDbDraftStore,
  type DraftStore
} from "./persistence/draft-store";
import { createEditorShell, type EditorShell } from "./ui/editor-shell";

const RETURN_TO_GAME_EVENT = "ad-market-creator:return-to-game";

interface CanvasRuntime {
  adapter: FabricCanvasAdapter;
  dispose(): void;
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
      adapter.dispose();
      void canvas.dispose();
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
    const document = parseCampaignDocument(structuredClone(value));
    const runtime = await this.#ensureRuntime();
    await runtime.adapter.load(structuredClone(document.fabricState));
    this.#document = document;
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
    const document = this.#snapshot();
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
    if (this.#document && this.#runtime) this.#document = this.#snapshot();
    const runtime = this.#runtime;
    this.#runtime = null;
    this.#runtimePromise = null;
    runtime?.dispose();
    this.#setOpen(false);
    this.gameCanvas?.focus({ preventScroll: true });
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
