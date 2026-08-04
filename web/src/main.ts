import "./styles/editor.css";
import "./account/account.css";
import "./teacher/teacher.css";
import { runAdvertisingGameRoute } from "./app/app-route";
import { HttpTeacherClient } from "./teacher/teacher-client";
import { TeacherDashboard } from "./teacher/teacher-dashboard";
import { TeacherPlaytestController } from "./teacher/teacher-playtest-controller";
import {
  HttpTeacherPlaytestClient,
  type TeacherPlaytestClient
} from "./teacher/teacher-playtest-client";
import {
  cloudStatusMessage,
  createAccountBootstrap,
  type AccountBootstrapPublicApi
} from "./account/account-bootstrap";
import {
  AccountClientError,
  HttpAccountClient,
  HttpCloudProgressClient
} from "./account/account-client";
import {
  AccountAssetClientError,
  HttpAccountAssetClient
} from "./account/account-asset-client";
import {
  BrowserAccountIdentityBinding,
  BrowserAccountMutationBus
} from "./account/account-identity-binding";
import { BrowserAccountCookieRequestSerialiser } from "./account/account-cookie-request-serialiser";
import { BrowserAccountResetGenerationGuard } from "./account/account-reset-generation";
import {
  CloudProgressAssetAdapter,
  CloudProgressAssetRestore
} from "./account/cloud-asset-adapter";
import { AccountAccessController } from "./account/account-gate";
import {
  CloudProgressRecovery,
  cloudRecoveryStatusMessage
} from "./account/cloud-progress-recovery";
import {
  BrowserCloudSyncMetadataStore,
  CloudProgressSync,
  queueCloudProgressAfterLocalSave
} from "./account/cloud-progress-sync";
import { BrowserCloudProgressOutbox } from "./account/cloud-progress-outbox";
import { CREATOR_BRIDGE_CONTRACT, type CreatorBridgeHandler } from "./bridge/contracts";
import {
  createCreatorPublicApi,
  type CreatorBridgeDiagnostic,
  type CreatorPublicApi
} from "./bridge/creator-public-api";
import type {
  LocalPracticeRecoveryV1,
  PracticePublicApi
} from "./bridge/practice-contracts";
import { createPracticePublicApi } from "./bridge/practice-public-api";
import {
  parseCampaignDocument,
  type CampaignDocumentV1
} from "./domain/campaign-document";
import {
  CampaignExporter,
  type PublishedCampaign
} from "./export/campaign-exporter";
import { ChecklistStore, CHECKLIST_SLOTS } from "./checklist/checklist-store";
import { CataloguePanel } from "./catalogue/catalogue-panel";
import {
  CataloguePlacementQueue,
  CatalogueRuntime,
  type LocalCatalogueBlob
} from "./catalogue/catalogue-runtime";
import { loadOfflineCatalogueWithHash } from "./catalogue/catalogue-store";
import { loadRasterPricing, type RasterPricingIndex } from "./catalogue/raster-pricing";
import type { CatalogAssetV1 } from "./catalogue/catalogue-types";
import { OpenverseClient } from "./catalogue/openverse-client";
import { ProductShellRegionControls } from "./product-shells/product-shell-region-controls";
import type { ProductArtwork } from "./product-builder/product-svg-composer";
import { quotePilotProductVariant } from "./product-builder/pilot-product-economics";
import {
  formatMarketBucks,
  ProductMoneyPanel
} from "./product-builder/product-money-panel";
import { evaluatePricePlacementState } from "./game/creator-stage";
import { ProductPriceGuideClient } from "./product-builder/product-price-guide-client";
import {
  createProductPriceSubject,
  hasPlacedProduct
} from "./product-builder/product-price-subject";
import type {
  ProductPriceGuide,
  ProductPricePosition
} from "../../shared/product-price-guide-contract";
import { reconcileRasterProductBuild } from "./product-builder/raster-product-build";
import {
  type ResolvedProductVariant
} from "./product-builder/virtual-product-variant";
import {
  loadProductKitBundle,
  sectionFillForStudentStarter,
  type LoadedProductKitBundle
} from "./product-kit/product-kit-loader";
import { ProductKitPanel } from "./product-kit/product-kit-panel";
import type { ProductKitCompositionRequest } from "./product-kit/product-kit-runtime";
import {
  loadLogoIconCatalogue,
  type LogoIconRecord
} from "./logo-lab/logo-icon-catalogue";
import { LogoLabPanel } from "./logo-lab/logo-lab-panel";
import type { LogoMarkDesign } from "./logo-lab/logo-mark-model";
import type {
  CanvasSelectionSnapshot,
  LogoMarkSnapshot
} from "./fabric/canvas-port";
import { ImageLabClient } from "./ai-image/image-lab-client";
import { ImageLabPanel } from "./ai-image/image-lab-panel";
import { ImageLabRuntime, type ImageLabPairIdentity } from "./ai-image/image-lab-runtime";
import { BrowserImageLabSubmissionPersistence } from "./ai-image/browser-image-lab-submission-persistence";
import { captureStudioCoachEvidence, type StudioCoachCanvasEvidence } from "./studio-coach/canvas-evidence";
import { StudioCoachClient } from "./studio-coach/studio-coach-client";
import { StudioCoachPanel } from "./studio-coach/studio-coach-panel";
import { StudioCoachRuntime, type StudioCoachCampaign } from "./studio-coach/studio-coach-runtime";
import { MarketClient } from "./market/market-client";
import {
  createMarketPublicApi,
  type MarketPublicApi
} from "./market/market-public-api";
import type { GeneratedRasterPlacement } from "./catalogue/catalogue-runtime";
import type { FabricCanvasAdapter } from "./fabric/fabric-canvas-adapter";
import {
  canvasRemovalState,
  ObjectCommandService
} from "./fabric/object-command-service";
import {
  CanvasAccessibilityController,
  type CanvasAccessibilityAction
} from "./ui/canvas-accessibility-controller";
import { CanvasObjectZoomController } from "./tools/canvas-object-zoom";
import { campaignSemanticObjectMap } from "./domain/campaign-semantic-objects";
import {
  PairGameController,
  type RoundZeroPort
} from "./game/pair-game-controller";
import type { AudienceBrief } from "./game/audience-briefs";
import { AidaPlaybookPanel } from "./game/aida-playbook-panel";
import type { AidaStage } from "./game/aida-playbook";
import {
  commitMarketRoute,
  createMarketRoute,
  createProductSignal,
  evaluateCommittedMarketRoute,
  type MarketRouteFeedback
} from "./game/market-route";
import {
  MarketRoutePanel,
  type MarketRouteCommitInput
} from "./game/market-route-panel";
import { FabricHistoryBindings } from "./history/fabric-history-bindings";
import {
  canonicalDurableDocumentHash,
  IndexedDbDraftStore,
  rehydrateLocalAssetBlobs,
  selectReferencedLocalAssetBlobs,
  type DraftStore
} from "./persistence/draft-store";
import { AccountScopedDraftStore } from "./persistence/account-scoped-draft-store";
import { LocalPracticeService } from "./persistence/local-practice-service";
import { SerializedAutosave } from "./persistence/serialized-autosave";
import { createEditorShell, type EditorShell } from "./ui/editor-shell";
import { registerReleaseServiceWorker } from "./service-worker-registration";
import { createStudioToolDrawer } from "./ui/studio-tool-drawer";
import {
  STUDENT_STUDIO_SPLIT_STORAGE_KEY,
  StudioSplitPane,
  TEACHER_PLAYTEST_STUDIO_SPLIT_STORAGE_KEY
} from "./ui/studio-split-pane";
import { STUDENT_COPY } from "./game/student-copy";
import {
  applyCreatorLevelAccess,
  creatorStageAllows
} from "./game/creator-level-access";
import { GuidedJourneyController } from "./game/guided-journey-controller";
import { RoleGuideController } from "./game/role-guide-controller";
import { StudioOnboardingController } from "./game/studio-onboarding-controller";
import { SectionFillController } from "./tools/section-fill-controller";

const RETURN_TO_GAME_EVENT = "ad-market-creator:return-to-game";

interface CanvasRuntime {
  adapter: FabricCanvasAdapter;
  refreshDisplay(): void;
  dispose(): Promise<void>;
}

interface CanvasRemovalHistoryTransition {
  readonly beforeState: string;
  readonly afterState: string;
  readonly selection: CanvasSelectionSnapshot;
}

const canvasStateKey = (state: Record<string, unknown>): string =>
  JSON.stringify(state);

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
    refreshDisplay() {
      canvas.calcOffset();
      canvas.requestRenderAll();
    },
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

class BrowserCreatorHandler implements CreatorBridgeHandler, RoundZeroPort {
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
  #history: FabricHistoryBindings<CampaignDocumentV1> | null = null;
  #removalHistory: CanvasRemovalHistoryTransition[] = [];
  #canvasAccessibility: CanvasAccessibilityController | null = null;
  #sectionFill: SectionFillController | null = null;
  #sectionFillPreviewActive = false;
  #unsubscribeCanvasSelectionStatus: (() => void) | null = null;
  #pairGame: PairGameController | null = null;
  #logoLab: LogoLabPanel | null = null;
  #imageLab: ImageLabPanel | null = null;
  #studioCoach: StudioCoachRuntime | null = null;
  #moneyPanel: ProductMoneyPanel | null = null;
  #marketRoutePanel: MarketRoutePanel | null = null;
  #aidaPlaybookPanel: AidaPlaybookPanel | null = null;
  #productKitPanel: ProductKitPanel | null = null;
  #guidedJourney: GuidedJourneyController | null = null;
  #roleGuide: RoleGuideController | null = null;
  #studioOnboarding: StudioOnboardingController | null = null;
  #aidaStage: AidaStage = "attention";
  #rasterPricing: RasterPricingIndex | null = null;
  #productKitBundle: LoadedProductKitBundle | null = null;
  #editorOpen = false;
  #practiceAutosave: SerializedAutosave<LocalPracticeRecoveryV1> | null = null;
  #practiceSaveMatched = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly shell: EditorShell,
    private readonly gameSurface: HTMLElement | null,
    private readonly gameCanvas: HTMLCanvasElement | null,
    private readonly drafts: DraftStore = new IndexedDbDraftStore(),
    practice: LocalPracticeService | null = null,
    cloudSync: Pick<CloudProgressSync, "enqueue"> | null = null
  ) {
    const productName = shell.overlay.querySelector<HTMLInputElement>(
      'input[aria-label="Product name"]'
    );
    if (!productName) throw new Error("Missing product-name input");
    this.#productName = productName;
    this.#productName.addEventListener("input", () => {
      if (this.#document !== null) {
        this.#document = this.#invalidateStaleProductPricing(parseCampaignDocument({
          ...structuredClone(this.#document),
          product: {
            ...structuredClone(this.#document.product),
            name: this.#productName.value
          }
        }));
        this.#refreshMoneyCheck();
        this.#refreshMarketRoute();
      }
      this.schedulePracticeAutosave();
      this.#refreshStudioCoachCampaign();
    });
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
      transaction: async (operation) => {
        if (this.#history === null) {
          await operation();
          return;
        }
        await this.#history.transaction(operation);
      },
      onProductShellPlaced: (objectId, productShell) => {
        this.#showProductShellRegions(objectId, productShell.title, productShell.regions);
      },
      onProductVariantPlaced: (_objectId, product) => {
        this.#showProductVariantSummary(`${product.paletteTitle} ${product.bodyTitle}`);
      },
      sectionFillForAsset: (asset) => this.#productKitBundle === null
        ? undefined
        : sectionFillForStudentStarter(this.#productKitBundle, asset),
      onError: (error) => { this.shell.assertive.textContent = error.message; }
    });
    if (practice !== null) {
      this.#practiceAutosave = new SerializedAutosave({
        delayMs: 300,
        createOperationId: () => `autosave-${globalThis.crypto.randomUUID()}`,
        commit: async (operationId) => {
          await this.#placements.flush();
          if (!this.#editorOpen || this.#document === null) return null;
          const snapshot = this.#snapshot();
          return practice.commitEditorSnapshot(
            snapshot,
            selectReferencedLocalAssetBlobs(snapshot, this.#blobs),
            operationId
          );
        },
        onCommitResult: (result) => {
          this.#adoptPracticeCommit(result);
          queueCloudProgressAfterLocalSave(cloudSync, result.document);
        },
        onState: (state) => {
          if (state.phase === "idle") {
            this.#practiceSaveMatched = false;
            this.shell.saveStatus.textContent = "";
          } else if (state.phase === "saving") {
            this.shell.saveStatus.textContent = "Saving…";
          } else if (state.phase === "saved") {
            this.#practiceSaveMatched = true;
            this.shell.saveStatus.textContent = `Saved · revision ${state.result.document.revision}`;
          } else {
            this.#practiceSaveMatched = false;
            this.shell.saveStatus.textContent = "Save paused";
            this.shell.assertive.textContent = "Progress could not be saved. Keep this tab open and try again.";
          }
        }
      });
    }
  }

  queueCataloguePlacement(asset: CatalogAssetV1, bodyColour?: string): void {
    if (this.#sectionFillPreviewActive) {
      this.shell.assertive.textContent =
        "Apply or cancel the fill preview before changing the canvas.";
      return;
    }
    if (asset.delivery === "offline" && !this.#rasterPricing?.byAssetId.has(asset.id)) {
      this.shell.assertive.textContent = "That product piece is missing its Market Buck clue.";
      return;
    }
    this.#placements.enqueue(asset, bodyColour === undefined ? undefined : { bodyColour });
  }

  setRasterPricing(pricing: RasterPricingIndex): void {
    this.#rasterPricing = pricing;
    if (this.#document !== null) {
      this.#document = reconcileRasterProductBuild(
        this.#snapshot(),
        pricing,
        this.#productKitBundle ?? undefined
      );
      this.#refreshMoneyCheck();
      this.#refreshMarketRoute();
      this.#refreshProductKitPanel();
    }
  }

  setProductKitBundle(bundle: LoadedProductKitBundle): void {
    this.#productKitBundle = bundle;
    if (this.#document !== null && this.#rasterPricing !== null) {
      this.#document = reconcileRasterProductBuild(
        this.#snapshot(),
        this.#rasterPricing,
        bundle
      );
      this.#refreshMoneyCheck();
      this.#refreshMarketRoute();
      this.#refreshProductKitPanel();
    }
  }

  attachProductKitPanel(panel: ProductKitPanel): void {
    if (this.#productKitPanel !== null && this.#productKitPanel !== panel) {
      throw new Error("Product maker is already attached");
    }
    this.#productKitPanel = panel;
    this.#refreshProductKitPanel();
  }

  refreshProductKitPanel(): void {
    this.#refreshProductKitPanel();
  }

  queueProductKitPlacement(request: ProductKitCompositionRequest): void {
    if (this.#sectionFillPreviewActive) {
      this.shell.assertive.textContent =
        "Apply or cancel the fill preview before changing the canvas.";
      return;
    }
    if (this.#productKitBundle === null) {
      this.shell.assertive.textContent = "Product maker unavailable";
      return;
    }
    this.#placements.enqueueProductKit(this.#productKitBundle, request);
  }

  attachPairGame(controller: PairGameController): void {
    if (this.#pairGame !== null && this.#pairGame !== controller) {
      throw new Error("Pair play is already attached");
    }
    this.#pairGame = controller;
  }

  attachLogoLab(panel: LogoLabPanel): void {
    if (this.#logoLab !== null && this.#logoLab !== panel) {
      throw new Error("Logo Lab is already attached");
    }
    this.#logoLab = panel;
    this.#refreshLogoMarks();
  }

  attachImageLab(panel: ImageLabPanel): void {
    if (this.#imageLab !== null && this.#imageLab !== panel) {
      throw new Error("Image Lab is already attached");
    }
    this.#imageLab = panel;
  }

  attachStudioCoach(runtime: StudioCoachRuntime): void {
    if (this.#studioCoach !== null && this.#studioCoach !== runtime) {
      throw new Error("Studio Coach is already attached");
    }
    this.#studioCoach = runtime;
    this.#refreshStudioCoachCampaign();
  }

  attachMoneyPanel(panel: ProductMoneyPanel): void {
    if (this.#moneyPanel !== null && this.#moneyPanel !== panel) {
      throw new Error("Money check is already attached");
    }
    this.#moneyPanel = panel;
    this.#refreshMoneyCheck();
  }

  attachMarketRoutePanel(panel: MarketRoutePanel): void {
    if (this.#marketRoutePanel !== null && this.#marketRoutePanel !== panel) {
      throw new Error("Market Route is already attached");
    }
    this.#marketRoutePanel = panel;
    this.#refreshMarketRoute();
  }

  attachAidaPlaybookPanel(panel: AidaPlaybookPanel): void {
    if (this.#aidaPlaybookPanel !== null && this.#aidaPlaybookPanel !== panel) {
      throw new Error("AIDA move deck is already attached");
    }
    this.#aidaPlaybookPanel = panel;
    this.#refreshAidaPlaybook();
  }

  attachGuidedJourney(controller: GuidedJourneyController): void {
    if (this.#guidedJourney !== null && this.#guidedJourney !== controller) {
      throw new Error("Guided journey is already attached");
    }
    this.#guidedJourney = controller;
    this.#refreshGuidedJourney();
  }

  attachRoleGuide(controller: RoleGuideController): void {
    if (this.#roleGuide !== null && this.#roleGuide !== controller) {
      throw new Error("Partner role guide is already attached");
    }
    this.#roleGuide = controller;
    this.#refreshRoleGuide();
  }

  attachStudioOnboarding(controller: StudioOnboardingController): void {
    if (this.#studioOnboarding !== null && this.#studioOnboarding !== controller) {
      throw new Error("Studio onboarding is already attached");
    }
    this.#studioOnboarding = controller;
    this.#refreshStudioOnboarding();
  }

  showMessage(message: string): void {
    this.shell.assertive.textContent = message;
  }

  schedulePracticeAutosave(): void {
    this.#refreshGuidedJourney();
    if (!this.#editorOpen || this.#document === null || this.#practiceAutosave === null) return;
    this.#practiceSaveMatched = false;
    this.#practiceAutosave.schedule();
  }

  #adoptPracticeCommit(result: LocalPracticeRecoveryV1): void {
    if (!this.#editorOpen || this.#document === null) return;
    const acknowledged = result.document;
    const live = this.#snapshot();
    if (acknowledged.documentId !== live.documentId ||
      acknowledged.sessionId !== live.sessionId ||
      acknowledged.teamId !== live.teamId ||
      acknowledged.gameplay.stage !== live.gameplay.stage) {
      throw new Error("Saved practice acknowledgement does not match the open campaign");
    }
    if (acknowledged.revision < live.revision) {
      throw new Error("Saved practice acknowledgement moved the campaign revision backwards");
    }
    this.#document = parseCampaignDocument({
      ...structuredClone(live),
      revision: acknowledged.revision,
      updatedAt: acknowledged.updatedAt
    });
  }

  async flushPracticeAutosave(): Promise<void> {
    await this.#practiceAutosave?.flush();
  }

  async isolateAccountWork(): Promise<void> {
    this.#imageLab?.cancel();
    await this.#practiceAutosave?.dispose();
    try {
      await this.close();
    } catch {
      // close() performs best-effort cleanup before reporting a cleanup error.
    } finally {
      this.root.hidden = true;
      this.root.inert = true;
      this.root.setAttribute("aria-hidden", "true");
      if (this.gameSurface !== null) {
        this.gameSurface.hidden = true;
        this.gameSurface.inert = true;
        this.gameSurface.setAttribute("aria-hidden", "true");
      }
      if (this.gameCanvas !== null) this.gameCanvas.tabIndex = -1;
    }
  }

  selectAidaStage(stage: AidaStage): void {
    this.#aidaStage = stage;
    this.#refreshAidaPlaybook();
    this.#refreshStudioCoachCampaign();
  }

  async commitAidaPlan(stage: AidaStage, value: string): Promise<void> {
    this.#assertStageAllows("aida");
    await this.#placements.flush();
    const runtime = this.#runtime;
    if (runtime === null) throw new Error("Campaign creator is not open");
    const selectedObjectId = runtime.adapter.getSelectedObjectId();
    if (selectedObjectId === null) {
      throw new Error("Select the canvas piece that carries this AIDA move first.");
    }
    const commit = async (): Promise<void> => {
      const current = this.#snapshot();
      const planned = parseCampaignDocument({
        ...structuredClone(current),
        strategy: {
          ...structuredClone(current.strategy),
          aidaPlan: {
            ...structuredClone(current.strategy.aidaPlan),
            [stage]: value
          }
        }
      });
      this.#document = new ChecklistStore(planned)
        .setEvidence(stage, [selectedObjectId]);
    };
    if (this.#history === null) await commit();
    else await this.#history.transaction(commit);
    this.#aidaStage = stage;
    this.#refreshStudioCoachCampaign();
    this.schedulePracticeAutosave();
  }

  async commitMarketRoute(input: MarketRouteCommitInput): Promise<MarketRouteFeedback> {
    this.#assertStageAllows("route");
    await this.#placements.flush();
    const current = this.#snapshot();
    if (!hasPlacedProduct(current)) throw new Error("Build and place a product first");
    if (current.product.priceCents === null || current.product.pricePosition === null) {
      throw new Error("Choose the audience price position and selling price first");
    }
    const route = commitMarketRoute(createMarketRoute({
      audienceBriefId: input.audienceBriefId,
      zoneId: input.zoneId,
      mediaIds: input.mediaIds,
      proofPoint: input.proofPoint
    }));
    const product = createProductSignal({
      pricePosition: current.product.pricePosition,
      traitIds: input.productTraitIds
    });
    const document = parseCampaignDocument({
      ...structuredClone(current),
      strategy: {
        ...structuredClone(current.strategy),
        productTraitIds: [...product.selectedTraitIds],
        marketedChoiceIds: [],
        marketRoute: route
      }
    });
    const feedback = evaluateCommittedMarketRoute(product, route);
    this.#document = document;
    this.#refreshMarketRoute(feedback);
    this.schedulePracticeAutosave();
    return feedback;
  }

  isCurrentImageLabPair(pair: ImageLabPairIdentity): boolean {
    const document = this.#document;
    return this.#editorOpen && this.#runtime !== null && document !== null &&
      document.sessionId === pair.sessionId &&
      (document.teamId ?? document.documentId) === pair.teamId;
  }

  async placeGeneratedRaster(
    pair: ImageLabPairIdentity,
    input: GeneratedRasterPlacement
  ): Promise<void> {
    this.#assertCurrentImageLabPair(pair);
    this.#placements.enqueueGeneratedRaster(input);
    await this.#placements.flush();
    this.#assertCurrentImageLabPair(pair);
  }

  async exportDesignDataUrl(pair: ImageLabPairIdentity): Promise<string> {
    this.#assertCurrentImageLabPair(pair);
    await this.#placements.flush();
    this.#assertCurrentImageLabPair(pair);
    const runtime = this.#runtime;
    if (!runtime) throw new Error("Campaign creator is not open");
    return runtime.adapter.exportCleanPngDataUrl();
  }

  async captureStudioCoachCanvas(): Promise<StudioCoachCanvasEvidence> {
    await this.#placements.flush();
    const runtime = this.#runtime;
    if (!this.#editorOpen || !runtime || !this.#document) {
      throw new Error("Campaign creator is not open");
    }
    const document = this.#snapshot();
    return captureStudioCoachEvidence(
      runtime.adapter.exportCleanPngDataUrl(),
      document.fabricState
    );
  }

  queueProductVariantPlacement(
    product: ResolvedProductVariant,
    artwork?: ProductArtwork
  ): void {
    const quote = quotePilotProductVariant(product);
    if (!quote) {
      this.shell.assertive.textContent = "That product could not be placed. Choose it again.";
      return;
    }
    this.#placements.enqueueProductVariant(product, quote, artwork);
  }

  async setProductPrice(priceCents: number | null): Promise<void> {
    this.#assertStageAllows("price");
    await this.#placements.flush();
    const runtime = this.#runtime;
    if (!runtime || !this.#document) throw new Error("Campaign creator is not open");
    const commit = async (): Promise<void> => {
      const current = this.#snapshot();
      const subject = createProductPriceSubject(current);
      if (priceCents !== null && (!subject || current.product.pricePosition === null)) {
        throw new Error("Choose the audience price position first");
      }
      const commands = new ObjectCommandService(runtime.adapter);
      const priceObjectIds = this.#priceLabelObjectIds(current);
      if (priceCents === null) {
        priceObjectIds.forEach((objectId) => commands.remove(objectId));
      }
      this.#document = parseCampaignDocument({
        ...structuredClone(current),
        product: {
          ...structuredClone(current.product),
          priceCents,
          priceDecisionFingerprint: subject?.fingerprint ?? null
        },
        fabricState: commands.serialize(),
        evidence: {
          ...structuredClone(current.evidence),
          price: priceCents === null ? [] : [...current.evidence.price]
        }
      });
    };
    if (this.#history === null) await commit();
    else await this.#history.transaction(commit);
    this.#refreshMoneyCheck();
    this.#refreshMarketRoute();
    this.#refreshStudioCoachCampaign();
    this.schedulePracticeAutosave();
  }

  refreshCanvasDisplay(): void {
    this.#runtime?.refreshDisplay();
  }

  async setProductPricePosition(position: ProductPricePosition | null): Promise<void> {
    this.#assertStageAllows("price");
    await this.#placements.flush();
    const current = this.#snapshot();
    const subject = createProductPriceSubject(current);
    if (!subject) throw new Error("Name and place the product first");
    this.#document = parseCampaignDocument({
      ...structuredClone(current),
      product: {
        ...structuredClone(current.product),
        pricePosition: position,
        priceDecisionFingerprint: subject.fingerprint
      }
    });
    this.#refreshMoneyCheck();
    this.#refreshMarketRoute();
    this.schedulePracticeAutosave();
  }

  async researchProductPrice(
    client: Pick<ProductPriceGuideClient, "research">
  ): Promise<ProductPriceGuide> {
    this.#assertStageAllows("price");
    await this.#placements.flush();
    const current = this.#snapshot();
    const subject = createProductPriceSubject(current);
    if (!subject) throw new Error("Name and place the product before checking prices");
    if (current.product.priceGuide?.productFingerprint === subject.fingerprint) {
      return structuredClone(current.product.priceGuide);
    }
    const existing = current.product.priceLookup?.productFingerprint === subject.fingerprint
      ? current.product.priceLookup
      : null;
    const priceLookup = existing ?? {
      productFingerprint: subject.fingerprint,
      idempotencyKey: `price-${globalThis.crypto.randomUUID()}`
    };
    this.#document = parseCampaignDocument({
      ...structuredClone(current),
      product: {
        ...structuredClone(current.product),
        priceDecisionFingerprint: subject.fingerprint,
        priceGuide: null,
        priceLookup
      }
    });
    this.#refreshMoneyCheck();
    this.schedulePracticeAutosave();
    await this.flushPracticeAutosave();

    const guide = await client.research({
      sessionId: current.sessionId,
      teamId: current.teamId ?? current.documentId,
      documentId: current.documentId,
      idempotencyKey: priceLookup.idempotencyKey,
      productFingerprint: subject.fingerprint,
      product: { name: subject.name, features: [...subject.features] }
    });
    const latest = this.#snapshot();
    const latestSubject = createProductPriceSubject(latest);
    if (!latestSubject || latestSubject.fingerprint !== subject.fingerprint ||
      latest.documentId !== current.documentId || latest.sessionId !== current.sessionId) {
      throw new Error("The product changed while prices were being checked. Confirm it again.");
    }
    this.#document = parseCampaignDocument({
      ...structuredClone(latest),
      product: {
        ...structuredClone(latest.product),
        priceDecisionFingerprint: subject.fingerprint,
        priceGuide: guide,
        priceLookup: null
      }
    });
    this.#refreshMoneyCheck();
    this.schedulePracticeAutosave();
    return structuredClone(guide);
  }

  async addProductPriceToDesign(): Promise<void> {
    this.#assertStageAllows("price");
    await this.#placements.flush();
    const runtime = this.#runtime;
    if (!runtime || !this.#document) throw new Error("Campaign creator is not open");
    let objectId = "";
    let label = "";
    const commit = async (): Promise<void> => {
      const current = this.#snapshot();
      if (current.product.priceCents === null || current.product.pricePosition === null) {
        throw new Error("Set the audience price position and selling price first");
      }
      label = formatMarketBucks(current.product.priceCents);
      const commands = new ObjectCommandService(runtime.adapter);
      const existing = this.#priceLabelObjectIds(current);
      if (existing.length === 0) {
        objectId = await commands.addText(label, `Market price ${label}`, false);
        commands.transform(objectId, { x: 1240, y: 670 });
      } else {
        objectId = existing[0]!;
        runtime.adapter.setText(objectId, label, `Market price ${label}`, false);
        existing.slice(1).forEach((duplicateId) => commands.remove(duplicateId));
        commands.setHidden(objectId, false);
        commands.select(objectId);
      }
      this.#document = parseCampaignDocument({
        ...structuredClone(current),
        fabricState: commands.serialize(),
        evidence: {
          ...structuredClone(current.evidence),
          price: [objectId]
        }
      });
    };
    if (this.#history === null) await commit();
    else await this.#history.transaction(commit);
    this.#refreshMoneyCheck();
    this.#refreshMarketRoute();
    this.#refreshStudioCoachCampaign();
    this.shell.polite.textContent = `${label} added to the design. Return to the game to see the next step.`;
    this.schedulePracticeAutosave();
  }

  async open(value: CampaignDocumentV1): Promise<void> {
    this.#imageLab?.cancel();
    this.#studioCoach?.clearCampaign();
    await this.flushPracticeAutosave();
    this.#editorOpen = false;
    this.#practiceSaveMatched = false;
    this.shell.saveStatus.textContent = "";
    this.#removalHistory = [];
    await this.#placements.flush();
    const requested = parseCampaignDocument(structuredClone(value));
    let document = requested;
    let blobs = new Map<string, Blob>();
    let ownedUrls = new Set<string>();
    let releaseUrls: (() => void) | null = null;
    if (hasLocalBlobReferences(requested)) {
      const stored = await this.drafts.loadRevision(requested.documentId, requested.revision);
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
    if (this.#rasterPricing !== null) {
      document = reconcileRasterProductBuild(
        document,
        this.#rasterPricing,
        this.#productKitBundle ?? undefined
      );
    }
    const hadRuntime = this.#runtime !== null;
    let runtime: CanvasRuntime | null = null;
    let nextHistory: FabricHistoryBindings<CampaignDocumentV1> | null = null;
    let nextLogoMarks: readonly LogoMarkSnapshot[] = Object.freeze([]);
    let loadComplete = false;
    try {
      runtime = await this.#ensureRuntime();
      await runtime.adapter.load(structuredClone(document.fabricState));
      loadComplete = true;
      nextLogoMarks = runtime.adapter.listLogoMarks();
      const initialHistoryDocument = parseCampaignDocument({
        ...structuredClone(document),
        fabricState: runtime.adapter.serialize()
      });
      nextHistory = new FabricHistoryBindings<CampaignDocumentV1>({
        serialize: () => this.#snapshot(),
        load: (snapshot) => this.#restoreHistorySnapshot(runtime!, snapshot),
        subscribe: (listener) => runtime!.adapter.subscribe(() => {
          this.#refreshCanvasEmptyState(runtime!.adapter.serialize());
          this.#studioCoach?.markCanvasChanged();
          listener();
        })
      }, this.shell.polite, initialHistoryDocument);
    } catch (error) {
      try {
        releaseUrls?.();
      } catch {
        // Preserve the open/load failure while still clearing a failed new runtime.
      }
      if ((!hadRuntime || loadComplete) && runtime !== null && this.#runtime === runtime) {
        this.#destroyCanvasAccessibility();
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
    this.#pairGame?.close();
    this.#history?.dispose();
    this.#history = nextHistory;
    this.#ensureCanvasAccessibility(runtime);
    const releasePreviousUrls = this.#releaseOwnedRasterUrls;
    const previousPlacementUrls = [...this.#placementOwnedRasterUrls];
    this.#document = document;
    this.#studioCoach?.setCampaign(this.#studioCoachCampaign(document));
    this.#refreshCanvasEmptyState(document.fabricState);
    applyCreatorLevelAccess(this.root, document.gameplay.stage);
    this.#moneyPanel?.setPriceUnlocked(creatorStageAllows(document.gameplay.stage, "price"));
    this.#blobs.clear();
    blobs.forEach((blob, key) => this.#blobs.set(key, blob));
    this.#ownedRasterUrls.clear();
    ownedUrls.forEach((url) => this.#ownedRasterUrls.add(url));
    this.#placementOwnedRasterUrls.clear();
    this.#releaseOwnedRasterUrls = releaseUrls;
    this.#productName.value = document.product.name;
    this.#refreshMoneyCheck();
    this.#refreshMarketRoute();
    this.#refreshAidaPlaybook();
    this.#refreshProductKitPanel();
    this.#restoreProductShellRegions(document);
    try {
      if (this.#pairGame !== null) {
        await this.#pairGame.open(document);
      }
      this.#logoLab?.setMarks(nextLogoMarks);
      this.#imageLab?.setPair({
        sessionId: document.sessionId,
        teamId: document.teamId ?? document.documentId,
        productName: document.product.name
      });
      if (this.#imageLab !== null) void this.#imageLab.initialise();
      this.#setOpen(true);
      this.#refreshGuidedJourney();
      this.#refreshRoleGuide();
      this.#refreshStudioOnboarding();
    } catch (error) {
      this.#pairGame?.close();
      this.#destroyCanvasAccessibility();
      this.#history?.dispose();
      this.#history = null;
      this.#runtime = null;
      this.#runtimePromise = null;
      try {
        await runtime.dispose();
      } catch {
        // Preserve the pair-game open failure.
      }
      try {
        releaseUrls?.();
      } catch {
        // Preserve the pair-game open failure.
      }
      try {
        releasePreviousUrls?.();
      } catch {
        // Preserve the pair-game open failure.
      }
      previousPlacementUrls.forEach((url) => URL.revokeObjectURL(url));
      this.#releaseOwnedRasterUrls = null;
      this.#ownedRasterUrls.clear();
      this.#placementOwnedRasterUrls.clear();
      this.#blobs.clear();
      this.#document = null;
      this.#guidedJourney?.setCampaign(null);
      this.#roleGuide?.setCampaign(null);
      this.#studioOnboarding?.setCampaign(null);
      this.#refreshMoneyCheck();
      this.#refreshMarketRoute();
      this.#refreshAidaPlaybook();
      this.#productShellRegions.clear();
      try {
        this.#logoLab?.setMarks([]);
      } catch {
        // Preserve the open failure while leaving the creator closed.
      }
      this.#setOpen(false);
      this.gameCanvas?.focus({ preventScroll: true });
      throw error;
    }
    releasePreviousUrls?.();
    previousPlacementUrls.forEach((url) => URL.revokeObjectURL(url));
    this.shell.canvasRegion.focus({ preventScroll: true });
  }

  async setAudienceBrief(brief: AudienceBrief): Promise<CampaignDocumentV1> {
    await this.#placements.flush();
    const current = this.#snapshot();
    const document = parseCampaignDocument({
      ...structuredClone(current),
      brief: {
        targetAudienceId: brief.id,
        contextId: brief.id,
        purpose: "persuade",
        audienceNeeds: [brief.need],
        audienceValues: [...brief.values],
        intendedEffects: [brief.intendedEffect],
        techniques: [...current.brief.techniques]
      },
      strategy: {
        ...structuredClone(current.strategy),
        marketRoute: current.strategy.marketRoute?.audienceBriefId === brief.id
          ? structuredClone(current.strategy.marketRoute)
          : null
      }
    });
    this.#document = document;
    this.#refreshMarketRoute();
    this.#refreshStudioCoachCampaign();
    this.schedulePracticeAutosave();
    return structuredClone(document);
  }

  async loadLatest(documentId: string): Promise<CampaignDocumentV1 | null> {
    const stored = await this.drafts.load(documentId);
    return stored === null ? null : structuredClone(stored.document);
  }

  async addText(value: string): Promise<void> {
    this.#assertCanvasMutationAvailable();
    await this.#placements.flush();
    const runtime = this.#runtime;
    if (runtime === null) throw new Error("Campaign creator is not open");
    await new ObjectCommandService(runtime.adapter).addText(value);
  }

  async addProductText(
    value: string
  ): Promise<"added" | "updated" | "product-required"> {
    this.#assertCanvasMutationAvailable();
    await this.#placements.flush();
    const runtime = this.#runtime;
    if (runtime === null || this.#history === null) {
      throw new Error("Campaign creator is not open");
    }
    const productId = runtime.adapter.getSelectedObjectId();
    if (productId === null) return "product-required";
    const address = runtime.adapter.firstArtworkSurfaceAddress(productId);
    if (address === null) return "product-required";
    const existingTextId = runtime.adapter.firstArtworkTextId(address);
    const commands = new ObjectCommandService(runtime.adapter);
    await this.#history.transaction(async () => {
      if (existingTextId === null) {
        await commands.addArtworkText(address, value, "Product label");
      } else {
        commands.setArtworkText(address, existingTextId, value);
        commands.select(productId);
      }
    });
    this.schedulePracticeAutosave();
    return existingTextId === null ? "added" : "updated";
  }

  async addLogoMark(design: LogoMarkDesign, icon: LogoIconRecord): Promise<string> {
    this.#assertCanvasMutationAvailable();
    await this.#placements.flush();
    const runtime = this.#runtime;
    if (runtime === null) throw new Error("Campaign creator is not open");
    return new ObjectCommandService(runtime.adapter).addLogoMark({ design, icon });
  }

  async replaceLogoMark(
    id: string,
    design: LogoMarkDesign,
    icon: LogoIconRecord
  ): Promise<void> {
    this.#assertCanvasMutationAvailable();
    await this.#placements.flush();
    const runtime = this.#runtime;
    if (runtime === null) throw new Error("Campaign creator is not open");
    await new ObjectCommandService(runtime.adapter).replaceLogoMark(id, { design, icon });
  }

  async undo(): Promise<boolean> {
    this.#assertCanvasMutationAvailable();
    await this.#placements.flush();
    if (this.#history === null) throw new Error("Campaign creator is not open");
    const runtime = this.#runtime;
    const beforeState = runtime === null ? null : canvasStateKey(runtime.adapter.serialize());
    const changed = await this.#history.undo();
    if (changed) {
      if (runtime !== null && beforeState !== null) {
        const afterState = canvasStateKey(runtime.adapter.serialize());
        const removal = [...this.#removalHistory].reverse().find((candidate) =>
          candidate.afterState === beforeState &&
          candidate.beforeState === afterState
        );
        if (removal !== undefined) runtime.adapter.restoreSelection(removal.selection);
      }
      this.#refreshLogoMarks();
      this.#refreshMoneyCheck();
      this.#refreshMarketRoute();
      if (this.#document !== null) this.#restoreProductShellRegions(this.#snapshot());
    }
    return changed;
  }

  async redo(): Promise<boolean> {
    this.#assertCanvasMutationAvailable();
    await this.#placements.flush();
    if (this.#history === null) throw new Error("Campaign creator is not open");
    const runtime = this.#runtime;
    const beforeState = runtime === null ? null : canvasStateKey(runtime.adapter.serialize());
    const changed = await this.#history.redo();
    if (changed) {
      if (runtime !== null && beforeState !== null) {
        const afterState = canvasStateKey(runtime.adapter.serialize());
        const removal = [...this.#removalHistory].reverse().find((candidate) =>
          candidate.beforeState === beforeState &&
          candidate.afterState === afterState
        );
        if (removal !== undefined) runtime.adapter.setSelected(null);
      }
      this.#refreshLogoMarks();
      this.#refreshMoneyCheck();
      this.#refreshMarketRoute();
      if (this.#document !== null) this.#restoreProductShellRegions(this.#snapshot());
    }
    return changed;
  }

  async resizeSelectedObject(factor: number): Promise<void> {
    this.#assertCanvasMutationAvailable();
    await this.#placements.flush();
    const runtime = this.#runtime;
    if (!this.#editorOpen || runtime === null || this.#history === null) {
      throw new Error("Campaign creator is not open");
    }
    let percent = 0;
    await this.#history.transaction(async () => {
      percent = new CanvasObjectZoomController(runtime.adapter).zoomSelected(factor);
    });
    this.shell.zoomStatus.textContent = `Size ${percent}% · drag to position`;
    this.schedulePracticeAutosave();
  }

  async applyCanvasAccessibilityAction(action: CanvasAccessibilityAction): Promise<void> {
    this.#assertCanvasMutationAvailable();
    await this.#placements.flush();
    const runtime = this.#runtime;
    if (!this.#editorOpen || runtime === null || this.#history === null) {
      throw new Error("Campaign creator is not open");
    }
    const summary = runtime.adapter.listObjectSummaries().find(({ id }) => id === action.id);
    if (!summary) throw new Error("That canvas layer is no longer available");
    if (action.type === "remove") {
      await this.#removeCanvasObject(action.id, runtime);
      return;
    }
    const commands = new ObjectCommandService(runtime.adapter);
    await this.#history.transaction(async () => {
      switch (action.type) {
        case "nudge":
          commands.transform(action.id, {
            x: summary.x + action.dx,
            y: summary.y + action.dy
          });
          break;
        case "resize":
          commands.transform(action.id, {
            scaleX: Math.min(8, Math.max(0.05, summary.scaleX * action.factor)),
            scaleY: Math.min(8, Math.max(0.05, summary.scaleY * action.factor))
          });
          break;
        case "move":
          if (action.direction === "front") commands.moveToFront(action.id);
          else if (action.direction === "forward") commands.moveForward(action.id);
          else if (action.direction === "backward") commands.moveBackward(action.id);
          else commands.moveToBack(action.id);
          break;
        case "set-hidden":
          commands.setHidden(action.id, action.hidden);
          break;
        case "set-locked":
          commands.setLocked(action.id, action.locked);
          break;
      }
    });
    this.#refreshCanvasEmptyState(runtime.adapter.serialize());
    this.#refreshStudioCoachCampaign();
    this.schedulePracticeAutosave();
  }

  async deleteSelected(): Promise<void> {
    this.#assertCanvasMutationAvailable();
    await this.#placements.flush();
    const runtime = this.#runtime;
    if (!this.#editorOpen || runtime === null || this.#history === null) {
      throw new Error("Campaign creator is not open");
    }
    const removal = canvasRemovalState(
      runtime.adapter.getSelectedObjectId(),
      runtime.adapter.listObjectSummaries()
    );
    if (!removal.removable || removal.selectedId === null) {
      throw new Error(removal.reason);
    }
    await this.#removeCanvasObject(removal.selectedId, runtime);
  }

  async fillSelectedImage(): Promise<void> {
    this.#assertCanvasMutationAvailable();
    await this.#placements.flush();
    const runtime = this.#runtime;
    if (!this.#editorOpen || runtime === null || this.#history === null) {
      throw new Error("Campaign creator is not open");
    }
    await this.#history.transaction(async () => {
      new CanvasObjectZoomController(runtime.adapter).fillSelectedRaster();
    });
    this.shell.zoomStatus.textContent = "Ad filled · drag to choose the crop";
    this.schedulePracticeAutosave();
  }

  subscribeCanvasMutations(listener: () => void): () => void {
    const runtime = this.#runtime;
    if (runtime === null) throw new Error("Campaign creator is not open");
    return runtime.adapter.subscribe(() => listener());
  }

  async getState(): Promise<CampaignDocumentV1> {
    await this.#placements.flush();
    this.schedulePracticeAutosave();
    await this.flushPracticeAutosave();
    const document = this.#snapshot();
    this.#document = document;
    return structuredClone(document);
  }

  async save(): Promise<void> {
    await this.#placements.flush();
    this.schedulePracticeAutosave();
    await this.flushPracticeAutosave();
    if (this.#practiceSaveMatched) return;
    const snapshot = this.#snapshot();
    const latest = await this.drafts.load(snapshot.documentId);
    const document = parseCampaignDocument({
      ...structuredClone(snapshot),
      revision: latest
        ? Math.max(snapshot.revision, latest.document.revision) + 1
        : snapshot.revision,
      updatedAt: nextUpdatedAt(snapshot.updatedAt, latest?.document.updatedAt)
    });
    await this.drafts.save(document, selectReferencedLocalAssetBlobs(document, this.#blobs));
    this.#document = document;
  }

  async publish(): Promise<PublishedCampaign> {
    await this.#placements.flush();
    this.schedulePracticeAutosave();
    await this.flushPracticeAutosave();
    const runtime = this.#runtime;
    if (!runtime) throw new Error("Campaign creator is not open");
    const document = this.#snapshot();
    const published = new CampaignExporter(runtime.adapter, this.#ownedRasterUrls).publish(document);
    this.#document = document;
    return published;
  }

  async close(): Promise<void> {
    this.#imageLab?.cancel();
    this.#studioCoach?.clearCampaign();
    await this.flushPracticeAutosave();
    this.#editorOpen = false;
    this.#removalHistory = [];
    let cleanupError: Error | null = null;
    try {
      await this.#placements.flush();
    } catch (error) {
      cleanupError = error instanceof Error ? error : new Error("Catalogue placement failed.");
    }
    const attempt = (operation: () => void): void => {
      try {
        operation();
      } catch (error) {
      cleanupError ??= error instanceof Error ? error : new Error("Studio cleanup failed.");
      }
    };
    const attemptAsync = async (operation: () => Promise<void>): Promise<void> => {
      try {
        await operation();
      } catch (error) {
      cleanupError ??= error instanceof Error ? error : new Error("Studio cleanup failed.");
      }
    };
    attempt(() => {
      if (this.#document && this.#runtime) this.#document = this.#snapshot();
    });
    attempt(() => this.#pairGame?.close());
    attempt(() => this.#destroyCanvasAccessibility());
    const history = this.#history;
    this.#history = null;
    attempt(() => history?.dispose());
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
    this.#practiceSaveMatched = false;
    this.shell.saveStatus.textContent = "";
    this.#productShellRegions.clear();
    this.#moneyPanel?.setState({
      hasProduct: false,
      productName: "",
      priceCents: null,
      pricePosition: null,
      priceGuide: null,
      pricePlacement: { status: "pending" },
      audienceNeed: "",
      audienceValues: []
    });
    this.#marketRoutePanel?.setState({
      hasProduct: false,
      priceCents: null,
      pricePosition: null,
      audienceBriefId: "",
      strategy: {
        productTraitIds: [],
        marketedChoiceIds: [],
        marketRoute: null,
        aidaPlan: { attention: "", interest: "", desire: "", action: "" }
      },
      feedback: null
    });
    this.#aidaPlaybookPanel?.setState({
      stage: this.#aidaStage,
      plan: { attention: "", interest: "", desire: "", action: "" }
    });
    attempt(() => this.#logoLab?.setMarks([]));
    attempt(() => this.#guidedJourney?.setCampaign(null));
    attempt(() => this.#roleGuide?.setCampaign(null));
    attempt(() => this.#studioOnboarding?.setCampaign(null));
    attempt(() => this.#setOpen(false));
    attempt(() => this.gameCanvas?.focus({ preventScroll: true }));
    if (cleanupError !== null) throw cleanupError;
  }

  #snapshot(): CampaignDocumentV1 {
    if (!this.#document) throw new Error("No campaign is open");
    const fabricState = this.#runtime?.adapter.serialize() ??
      structuredClone(this.#document.fabricState);
    const objectIds = new Set(campaignSemanticObjectMap(fabricState).keys());
    const evidence = Object.fromEntries(CHECKLIST_SLOTS.map((slot) => [
      slot,
      this.#document!.evidence[slot].filter((objectId) => objectIds.has(objectId))
    ]));
    const snapshot = parseCampaignDocument({
      ...structuredClone(this.#document),
      product: {
        ...structuredClone(this.#document.product),
        name: this.#productName.value
      },
      gameplay: {
        ...structuredClone(this.#document.gameplay),
        pair: this.#pairGame?.snapshot() ?? structuredClone(this.#document.gameplay.pair)
      },
      fabricState,
      evidence
    });
    const reconciled = this.#rasterPricing === null
      ? snapshot
      : reconcileRasterProductBuild(
          snapshot,
          this.#rasterPricing,
          this.#productKitBundle ?? undefined
        );
    return this.#invalidateStaleProductPricing(reconciled);
  }

  #invalidateStaleProductPricing(document: CampaignDocumentV1): CampaignDocumentV1 {
    const storedFingerprint = document.product.priceDecisionFingerprint ??
      document.product.priceGuide?.productFingerprint ??
      document.product.priceLookup?.productFingerprint ?? null;
    if (storedFingerprint === null) return document;
    const subject = createProductPriceSubject(document);
    if (subject?.fingerprint === storedFingerprint &&
      (document.product.priceGuide === null ||
        document.product.priceGuide.productFingerprint === storedFingerprint) &&
      (document.product.priceLookup === null ||
        document.product.priceLookup.productFingerprint === storedFingerprint)) return document;

    let fabricState: unknown = structuredClone(document.fabricState);
    if (this.#runtime !== null) {
      const commands = new ObjectCommandService(this.#runtime.adapter);
      this.#priceLabelObjectIds(document).forEach((objectId) => commands.remove(objectId));
      fabricState = commands.serialize();
    }
    return parseCampaignDocument({
      ...structuredClone(document),
      product: {
        ...structuredClone(document.product),
        priceCents: null,
        pricePosition: null,
        priceDecisionFingerprint: null,
        priceGuide: null,
        priceLookup: null
      },
      strategy: {
        ...structuredClone(document.strategy),
        marketedChoiceIds: [],
        marketRoute: null
      },
      fabricState,
      evidence: { ...structuredClone(document.evidence), price: [] }
    });
  }

  #studioCoachCampaign(document: CampaignDocumentV1): StudioCoachCampaign {
    return {
      sessionId: document.sessionId,
      teamId: document.teamId ?? document.documentId,
      documentId: document.documentId,
      productName: document.product.name.trim() || "Product not named",
      priceLabel: document.product.priceCents === null
        ? "Price not set"
        : formatMarketBucks(document.product.priceCents),
      audienceNeed: document.brief.audienceNeeds.join("; ") || "Audience need not selected",
      audienceValues: document.brief.audienceValues.join("; ") || "Audience values not selected",
      intendedEffect: document.brief.intendedEffects.join("; ") || "Intended effect not selected",
      aidaStage: this.#aidaStage
    };
  }

  #refreshStudioCoachCampaign(): void {
    if (!this.#studioCoach || !this.#document || !this.#editorOpen || !this.#runtime) return;
    this.#studioCoach.updateCampaign(this.#studioCoachCampaign(this.#snapshot()));
  }

  async #restoreHistorySnapshot(
    runtime: CanvasRuntime,
    value: CampaignDocumentV1
  ): Promise<void> {
    const historical = parseCampaignDocument(structuredClone(value));
    await runtime.adapter.load(structuredClone(historical.fabricState));
    const current = this.#document;
    const document = current === null
      ? historical
      : parseCampaignDocument({
          ...historical,
          revision: current.revision,
          updatedAt: current.updatedAt
        });
    this.#document = document;
    this.#refreshCanvasEmptyState(document.fabricState);
    this.#productName.value = document.product.name;
    this.#restoreProductShellRegions(document);
    this.#refreshLogoMarks();
    this.#refreshMoneyCheck();
    this.#refreshMarketRoute();
    this.#refreshAidaPlaybook();
    this.#refreshProductKitPanel();
    this.schedulePracticeAutosave();
  }

  async #removeCanvasObject(id: string, runtime: CanvasRuntime): Promise<void> {
    if (this.#history === null) throw new Error("Campaign creator is not open");
    const removal = canvasRemovalState(id, runtime.adapter.listObjectSummaries());
    if (!removal.removable) throw new Error(removal.reason);
    const beforeState = canvasStateKey(runtime.adapter.serialize());
    const selection = runtime.adapter.captureSelection();
    await this.#history.transaction(async () => {
      new ObjectCommandService(runtime.adapter).remove(id);
    });
    this.#removalHistory.push({
      beforeState,
      afterState: canvasStateKey(runtime.adapter.serialize()),
      selection
    });
    this.#refreshCanvasEmptyState(runtime.adapter.serialize());
    this.#refreshLogoMarks();
    if (this.#document !== null) this.#restoreProductShellRegions(this.#snapshot());
    this.#refreshStudioCoachCampaign();
    this.schedulePracticeAutosave();
  }

  #commitPlacement(document: CampaignDocumentV1, localBlob?: LocalCatalogueBlob): void {
    const reconciled = this.#invalidateStaleProductPricing(this.#rasterPricing === null
      ? document
      : reconcileRasterProductBuild(
          document,
          this.#rasterPricing,
          this.#productKitBundle ?? undefined
        ));
    if (localBlob) {
      if (this.#blobs.has(localBlob.blobKey) || this.#ownedRasterUrls.has(localBlob.objectUrl)) {
        throw new Error("Catalogue placement produced a duplicate local asset");
      }
      this.#blobs.set(localBlob.blobKey, localBlob.blob);
      this.#ownedRasterUrls.add(localBlob.objectUrl);
      this.#placementOwnedRasterUrls.add(localBlob.objectUrl);
    }
    this.#document = reconciled;
    this.#refreshCanvasEmptyState(reconciled.fabricState);
    this.#refreshMoneyCheck();
    this.#refreshMarketRoute();
    this.#refreshAidaPlaybook();
    this.#refreshProductKitPanel();
    this.#restoreProductShellRegions(reconciled);
    this.schedulePracticeAutosave();
  }

  #priceLabelObjectIds(document: CampaignDocumentV1): string[] {
    const objects = campaignSemanticObjectMap(document.fabricState);
    return document.evidence.price.filter((objectId) => {
      const object = objects.get(objectId);
      return object?.elementKind === "text" &&
        (object.accessibleName.startsWith("Selling price") ||
          object.accessibleName.startsWith("Market price"));
    });
  }

  #refreshMoneyCheck(): void {
    const document = this.#document;
    this.#moneyPanel?.setState({
      hasProduct: document === null ? false : hasPlacedProduct(document),
      productName: document?.product.name ?? "",
      priceCents: document?.product.priceCents ?? null,
      pricePosition: document?.product.pricePosition ?? null,
      priceGuide: document?.product.priceGuide ?? null,
      pricePlacement: document === null
        ? { status: "pending" }
        : evaluatePricePlacementState(document),
      audienceNeed: document?.brief.audienceNeeds.join(" ") ?? "",
      audienceValues: document?.brief.audienceValues ?? []
    });
  }

  #refreshGuidedJourney(): void {
    if (this.#guidedJourney === null) return;
    if (this.#document === null) {
      this.#guidedJourney.setCampaign(null);
      return;
    }
    const document = this.#runtime === null
      ? this.#document
      : this.#snapshot();
    this.#guidedJourney.setCampaign(document);
  }

  #refreshRoleGuide(): void {
    if (this.#roleGuide === null) return;
    if (this.#document === null) {
      this.#roleGuide.setCampaign(null);
      return;
    }
    const document = this.#runtime === null
      ? this.#document
      : this.#snapshot();
    this.#roleGuide.setCampaign(document);
  }

  #refreshStudioOnboarding(): void {
    if (this.#studioOnboarding === null) return;
    if (this.#document === null) {
      this.#studioOnboarding.setCampaign(null);
      return;
    }
    const document = this.#runtime === null ? this.#document : this.#snapshot();
    this.#studioOnboarding.setCampaign(document);
  }

  #refreshMarketRoute(feedback?: MarketRouteFeedback | null): void {
    if (!this.#marketRoutePanel) return;
    const document = this.#document;
    const hasProduct = document === null ? false : hasPlacedProduct(document);
    const strategy = document?.strategy ?? {
      productTraitIds: [],
      marketedChoiceIds: [],
      marketRoute: null,
      aidaPlan: { attention: "", interest: "", desire: "", action: "" }
    };
    let nextFeedback = feedback ?? null;
    if (feedback === undefined && hasProduct && document?.product.pricePosition &&
      document.product.priceCents !== null && strategy.marketRoute) {
      const route = commitMarketRoute(createMarketRoute({
        audienceBriefId: strategy.marketRoute.audienceBriefId,
        zoneId: strategy.marketRoute.zoneId,
        mediaIds: strategy.marketRoute.mediaIds,
        proofPoint: strategy.marketRoute.proofPoint
      }));
      nextFeedback = evaluateCommittedMarketRoute(
        createProductSignal({
          pricePosition: document.product.pricePosition,
          traitIds: strategy.productTraitIds
        }),
        route
      );
    }
    this.#marketRoutePanel.setState({
      hasProduct,
      priceCents: document?.product.priceCents ?? null,
      pricePosition: document?.product.pricePosition ?? null,
      audienceBriefId: document?.brief.targetAudienceId ?? "",
      strategy,
      feedback: nextFeedback
    });
  }

  #refreshAidaPlaybook(): void {
    this.#aidaPlaybookPanel?.setState({
      stage: this.#aidaStage,
      plan: this.#document?.strategy.aidaPlan ?? {
        attention: "",
        interest: "",
        desire: "",
        action: ""
      }
    });
  }

  #refreshProductKitPanel(): void {
    if (this.#document !== null) this.#productKitPanel?.hydrate(this.#document);
  }

  #refreshCanvasEmptyState(fabricState: unknown = this.#document?.fabricState): void {
    this.shell.canvasEmptyState.hidden = campaignSemanticObjectMap(fabricState).size > 0;
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
    this.shell.inspector.hidden = false;
    const heading = document.createElement("h2");
    heading.textContent = title;
    const guidance = document.createElement("p");
      guidance.textContent = "Choose new colours in the product maker to change this region's colour.";
    this.shell.inspector.replaceChildren(heading, guidance);
  }

  #restoreProductShellRegions(document: CampaignDocumentV1): void {
    const selectedObjectId = this.#runtime?.adapter.getSelectedObjectId() ?? null;
    const object = selectedObjectId === null
      ? undefined
      : campaignSemanticObjectMap(document.fabricState).get(selectedObjectId)?.object;
    if (object?.elementKind === "product-kit" && document.product.build?.primaryObjectId === selectedObjectId) {
      this.#productShellRegions.clear();
      return;
    }
    if (!object || typeof object.objectId !== "string") {
      this.#productShellRegions.clear();
      return;
    }
    if (object.elementKind !== "product-shell" || typeof object.shellId !== "string") {
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

  #refreshLogoMarks(): void {
    this.#logoLab?.setMarks(this.#runtime?.adapter.listLogoMarks() ?? []);
  }

  #assertCurrentImageLabPair(pair: ImageLabPairIdentity): void {
    if (!this.isCurrentImageLabPair(pair)) {
      throw new DOMException("The Image Lab pair is no longer current.", "AbortError");
    }
  }

  #assertStageAllows(feature: "aida" | "price" | "route"): void {
    const stage = this.#document?.gameplay.stage;
    if (stage === undefined || !creatorStageAllows(stage, feature)) {
      const nextLevel = feature === "aida" ? "Level 2" : "Level 3";
      throw new Error(`${nextLevel} unlocks that move.`);
    }
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
    this.#editorOpen = open;
    this.root.hidden = !open;
    if (!this.gameSurface) return;
    this.gameSurface.inert = open;
    if (open) this.gameSurface.setAttribute("aria-hidden", "true");
    else this.gameSurface.removeAttribute("aria-hidden");
  }

  #ensureCanvasAccessibility(runtime: CanvasRuntime): void {
    if (this.#canvasAccessibility !== null) return;
    this.#canvasAccessibility = new CanvasAccessibilityController({
      canvasRegion: this.shell.canvasRegion,
      host: this.shell.layers,
      toggle: this.shell.layersToggle,
      deleteButton: this.shell.deleteSelected,
      deleteStatus: this.shell.deleteStatus,
      port: runtime.adapter,
      runAction: (action) => this.applyCanvasAccessibilityAction(action),
      deleteSelected: () => this.deleteSelected(),
      announce: (message, priority) => {
        (priority === "assertive" ? this.shell.assertive : this.shell.polite).textContent = message;
      }
    });
    this.#sectionFill = new SectionFillController({
      host: this.shell.sectionFillPanel,
      canvas: this.shell.canvasRegion,
      port: runtime.adapter,
      transaction: async (operation) => {
        if (this.#history === null) throw new Error("Campaign creator is not open");
        await this.#history.transaction(operation);
        this.schedulePracticeAutosave();
      },
      announce: (message, priority) => {
        (priority === "assertive" ? this.shell.assertive : this.shell.polite).textContent = message;
      },
      mutationControls: [...this.root.querySelectorAll<HTMLButtonElement>("button")]
        .filter((control) => !this.shell.sectionFillPanel.contains(control)),
      onPreviewStateChange: (active) => {
        this.#sectionFillPreviewActive = active;
        if (active) this.root.dataset.sectionFillPreview = "true";
        else delete this.root.dataset.sectionFillPreview;
      }
    });
    this.#unsubscribeCanvasSelectionStatus = runtime.adapter.subscribeSelection(({ objectIds }) => {
      void this.#sectionFill?.setSelection(objectIds.length === 1 ? objectIds[0]! : null)
        .catch((error: unknown) => {
          this.shell.assertive.textContent = error instanceof Error
            ? error.message
            : "Selected-item fill controls could not be updated.";
        });
      if (objectIds.length === 0) {
        this.shell.zoomStatus.textContent = "Select a product or image";
        return;
      }
      if (objectIds.length > 1) {
        this.shell.zoomStatus.textContent = `Selected: ${objectIds.length} layers`;
        return;
      }
      const object = campaignSemanticObjectMap(runtime.adapter.serialize())
        .get(objectIds[0]!)?.object;
      const accessibleName = typeof object?.accessibleName === "string"
        ? object.accessibleName.trim()
        : "";
      this.shell.zoomStatus.textContent =
        `Selected: ${accessibleName || "Canvas layer"}`;
    });
    void this.#sectionFill.setSelection(runtime.adapter.getSelectedObjectId())
      .catch((error: unknown) => {
        this.shell.assertive.textContent = error instanceof Error
          ? error.message
          : "Selected-item fill controls could not be updated.";
      });
  }

  #destroyCanvasAccessibility(): void {
    this.#unsubscribeCanvasSelectionStatus?.();
    this.#unsubscribeCanvasSelectionStatus = null;
    this.shell.zoomStatus.textContent = "Select a product or image";
    this.#sectionFill?.destroy();
    this.#sectionFill = null;
    this.#sectionFillPreviewActive = false;
    delete this.root.dataset.sectionFillPreview;
    this.#canvasAccessibility?.destroy();
    this.#canvasAccessibility = null;
  }

  #assertCanvasMutationAvailable(): void {
    if (this.#sectionFillPreviewActive) {
      throw new Error("Apply or cancel the fill preview before changing the canvas.");
    }
  }
}

declare global {
  interface Window {
    AdMarketCreator: CreatorPublicApi;
    AdMarketPractice: PracticePublicApi;
    AdMarketRoom: MarketPublicApi;
    AdMarketAccount: AccountBootstrapPublicApi;
    AdMarketGameAccess: {
      requireAccess(): Promise<void>;
      reportStartupProgress(percent: number): void;
      reportStartupReady(): void;
      reportStartupFailure(reason: "timeout" | "engine"): void;
    };
  }
}

const unavailableGameAccess = new Promise<void>(() => undefined);
let requireGameAccess = (): Promise<void> => unavailableGameAccess;
let reportGameStartupFailure = (reason: "timeout" | "engine"): void => {
  const status = document.querySelector<HTMLElement>("#game-startup-status");
  const heading = status?.querySelector<HTMLElement>("[data-game-startup-heading]");
  const message = status?.querySelector<HTMLElement>("[data-game-startup-message]");
  if (heading !== undefined && heading !== null) heading.textContent = "The game could not start";
  if (message !== undefined && message !== null) {
    message.textContent = reason === "timeout"
      ? "Loading took too long. Reload this page to try again."
      : "The game stopped while loading. Reload this page to try again.";
  }
  if (status !== null) status.hidden = false;
};
window.AdMarketGameAccess = Object.freeze({
  requireAccess: () => requireGameAccess(),
  reportStartupProgress: (percent: number) => {
    const status = document.querySelector<HTMLElement>("#game-startup-status");
    const message = status?.querySelector<HTMLElement>("[data-game-startup-message]");
    const safePercent = Math.min(100, Math.max(0, Math.round(percent)));
    if (message !== undefined && message !== null) {
      message.textContent = `Loading game… ${safePercent}%`;
    }
    if (status !== null) status.hidden = false;
  },
  reportStartupReady: () => {
    const status = document.querySelector<HTMLElement>("#game-startup-status");
    if (status !== null) status.hidden = true;
  },
  reportStartupFailure: (reason: "timeout" | "engine") => {
    reportGameStartupFailure(reason);
  }
});

function renderRouteBoundary(
  kind: "teacher-dashboard" | "teacher-playtest" | "not-found",
  heading: string,
  description: string
): void {
  const main = document.createElement("main");
  main.dataset.admarketRoute = kind;
  main.tabIndex = -1;

  const title = document.createElement("h1");
  title.textContent = heading;
  main.append(title);

  const summary = document.createElement("p");
  summary.textContent = description;
  main.append(summary);

  if (kind === "not-found") {
    const studentLink = document.createElement("a");
    studentLink.href = "/student";
    studentLink.textContent = "Open student sign-in";
    main.append(studentLink);
  }

  document.body.replaceChildren(main);
  main.focus();
}

export function bootTeacherDashboard(): void {
  const root = document.createElement("div");
  root.id = "teacher-dashboard-root";
  document.body.replaceChildren(root);
  const dashboard = new TeacherDashboard(root, new HttpTeacherClient());
  void dashboard.mount();
}

export function bootTeacherPlaytest(): void {
  const root = document.createElement("div");
  root.id = "teacher-playtest-root";
  document.body.prepend(root);
  let markGameReady: () => void = () => undefined;
  const gameReady = new Promise<void>((resolve) => {
    markGameReady = resolve;
  });
  requireGameAccess = () => gameReady;
  const playtestClient = new HttpTeacherPlaytestClient();
  let game: TeacherPlaytestGameHandle | null = null;
  const controller = new TeacherPlaytestController({
    root,
    sessionClient: new HttpTeacherClient(),
    playtestClient,
    startGame: async () => {
      game = await bootGameApplication({
        kind: "teacher-playtest",
        client: playtestClient
      });
      markGameReady();
    },
    resetLocalState: async () => {
      if (game === null) throw new Error("Teacher playtest is not ready");
      await game.resetLocalState();
    },
    openFirstScreen: () => window.location.reload()
  });
  void controller.mount();
}

export function renderNotFoundApplication(): void {
  renderRouteBoundary(
    "not-found",
    "Page not found",
    "This address does not match a student or teacher page."
  );
}

type GameApplicationMode =
  | { readonly kind: "student" }
  | {
      readonly kind: "teacher-playtest";
      readonly client: TeacherPlaytestClient;
    };

interface TeacherPlaytestGameHandle {
  resetLocalState(): Promise<void>;
}

const TEACHER_PLAYTEST_BROWSER_NAMESPACE = "teacher-playtest";

export function bootStudentApplication(): void {
  bootGameApplication({ kind: "student" });
  requireGameAccess = () => window.AdMarketAccount.requireAccess();
}

function bootGameApplication(
  mode: { readonly kind: "student" }
): null;
function bootGameApplication(
  mode: {
    readonly kind: "teacher-playtest";
    readonly client: TeacherPlaytestClient;
  }
): Promise<TeacherPlaytestGameHandle>;
function bootGameApplication(
  mode: GameApplicationMode
): Promise<TeacherPlaytestGameHandle> | null {
if (mode.kind === "teacher-playtest") {
  Reflect.deleteProperty(window, "AdMarketAccount");
}
const root = document.querySelector<HTMLElement>("#creator-root");
if (!root) throw new Error("Missing #creator-root");

const shell = createEditorShell(root);
registerReleaseServiceWorker({
  onUpdateReady: () => {
    shell.saveStatus.textContent = "Update ready";
    shell.saveStatus.title = STUDENT_COPY.release.updateReady;
    shell.polite.textContent = STUDENT_COPY.release.updateReady;
  }
});
const studioTools = createStudioToolDrawer(shell.overlay);
const studioSplitPane = new StudioSplitPane({
  root: shell.workspace,
  browsePane: shell.library,
  designPane: shell.canvasRegion,
  separator: shell.workspaceSeparator,
  storage: (() => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  })(),
  storageKey: mode.kind === "teacher-playtest"
    ? TEACHER_PLAYTEST_STUDIO_SPLIT_STORAGE_KEY
    : STUDENT_STUDIO_SPLIT_STORAGE_KEY
});
shell.overlay.querySelector(".creator__tool-rail")?.addEventListener("click", () => {
  studioSplitPane.selectNarrowPane("browse");
});
const gameSurface = document.querySelector<HTMLElement>('main[aria-label="Advertising Market Game"]');
const gameCanvas = document.querySelector<HTMLCanvasElement>("#canvas");
if (!gameSurface || !gameCanvas) throw new Error("Missing locked game surface for account access");
const ensureAccountRoot = (id: string, tagName: "div" | "section"): HTMLElement => {
  const existing = document.querySelector<HTMLElement>(`#${id}`);
  if (existing) return existing;
  const root = document.createElement(tagName);
  root.id = id;
  root.hidden = true;
  document.body.prepend(root);
  return root;
};
const accountGateRoot = mode.kind === "student"
  ? ensureAccountRoot("account-gate-root", "div")
  : null;
const accountStatusRoot = mode.kind === "student"
  ? ensureAccountRoot("account-session-root", "section")
  : null;
root.hidden = true;

const drafts = new AccountScopedDraftStore();
const practiceService = new LocalPracticeService(drafts);
const practicePublicApi = createPracticePublicApi(practiceService);
window.AdMarketPractice = practicePublicApi;
let accountController: AccountAccessController | null = null;
const accountIdentity = new BrowserAccountIdentityBinding();
const accountMutations = new BrowserAccountMutationBus();
const accountCookieRequests = new BrowserAccountCookieRequestSerialiser();
const accountClient = new HttpAccountClient(
  accountIdentity,
  accountMutations,
  undefined,
  accountCookieRequests
);
const imageLabSubmissionPersistence = new BrowserImageLabSubmissionPersistence();
const studioCoachRuntime = new StudioCoachRuntime({
  client: new StudioCoachClient(),
  capture: () => handler.captureStudioCoachCanvas()
});
const cloudClient = mode.kind === "teacher-playtest"
  ? mode.client
  : new HttpCloudProgressClient(
      accountIdentity,
      undefined,
      accountCookieRequests
    );
const cloudMetadata = new BrowserCloudSyncMetadataStore();
const cloudOutbox = typeof globalThis.indexedDB === "undefined"
  ? undefined
  : new BrowserCloudProgressOutbox();
const accountResetGeneration = new BrowserAccountResetGenerationGuard([
  drafts,
  cloudMetadata,
  ...(cloudOutbox === undefined ? [] : [cloudOutbox]),
  imageLabSubmissionPersistence,
  studioCoachRuntime
]);
const accountAssets = mode.kind === "teacher-playtest"
  ? mode.client
  : new HttpAccountAssetClient(
      accountIdentity,
      undefined,
      accountCookieRequests
    );
const cloudAssetRestore = new CloudProgressAssetRestore({ client: accountAssets });
const setCloudMessage = (message: string): void => {
  if (mode.kind === "student") {
    accountController?.setCloudMessage(message);
    return;
  }
  shell.saveStatus.textContent = message;
  shell.saveStatus.title = message;
};
const cloudSync = new CloudProgressSync({
  client: cloudClient,
  metadata: cloudMetadata,
  ...(cloudOutbox === undefined ? {} : { outbox: cloudOutbox }),
  assetAdapter: new CloudProgressAssetAdapter({
    revisionSource: drafts,
    client: accountAssets
  }),
  onState: (state) => {
    if (state.phase === "conflict") {
      if (mode.kind === "teacher-playtest") {
        setCloudMessage(
          "Saved on this device · another cloud copy needs review. Nothing was replaced."
        );
        return;
      }
      accountController?.setCloudConflict({
        documentId: state.documentId,
        cloudAvailable: state.remote !== undefined,
        onKeepLocal: () => cloudSync.resolveConflict(state.documentId, "keep-local"),
        ...(state.remote === undefined ? {} : {
          onUseCloud: () => cloudSync.resolveConflict(state.documentId, "use-cloud")
        }),
        onRetry: async () => {
          cloudSync.retry(state.documentId);
          await cloudSync.settled();
        }
      });
      return;
    }
    setCloudMessage(cloudStatusMessage(state));
  },
  onUseCloud: async (remote) => {
    await handler.flushPracticeAutosave();
    const restored = await cloudAssetRestore.restore(remote.document);
    const adopted = await practiceService.adoptCloudSnapshot({
      document: restored.document,
      blobs: restored.blobs,
      operationId: `cloud-conflict-use-${globalThis.crypto.randomUUID()}`
    });
    await handler.open(adopted.document);
  },
  onAuthenticationRequired: () => {
    if (mode.kind === "student") accountController?.requireReauthentication();
    else window.location.assign("/teacher");
  }
});
const cloudRecovery = new CloudProgressRecovery({
  client: cloudClient,
  store: drafts,
  assets: cloudAssetRestore,
  metadata: cloudMetadata
});
if (mode.kind === "student") {
  if (accountGateRoot === null || accountStatusRoot === null) {
    throw new Error("Missing student account surfaces");
  }
  accountController = new AccountAccessController({
    client: accountClient,
    signupClient: accountClient,
    gateRoot: accountGateRoot,
    statusRoot: accountStatusRoot,
    gameSurface,
    gameCanvas,
    creatorRoot: root,
    onSession: async (username, resetGeneration) => {
      try {
        await accountResetGeneration.reconcile(username, resetGeneration);
        await drafts.activateAccount(username);
        await imageLabSubmissionPersistence.activateAccount(username);
        await studioCoachRuntime.activateAccount(username);
      } catch (error) {
        drafts.deactivateAccount();
        imageLabSubmissionPersistence.deactivateAccount();
        studioCoachRuntime.deactivateAccount();
        throw error;
      }
      try {
        await cloudSync.setAccount(username);
      } catch (error) {
        cloudSync.signOut();
        if ((error instanceof AccountClientError || error instanceof AccountAssetClientError) &&
          error.code === "AUTHENTICATION_REQUIRED") {
          drafts.deactivateAccount();
          imageLabSubmissionPersistence.deactivateAccount();
          studioCoachRuntime.deactivateAccount();
          throw new AccountClientError("AUTHENTICATION_REQUIRED");
        }
        accountController?.setCloudMessage("Saved on this device · cloud copy paused");
        return;
      }
      try {
        const recovery = await cloudRecovery.recoverLatest(username);
        accountController?.setCloudMessage(cloudRecoveryStatusMessage(recovery));
      } catch (error) {
        if ((error instanceof AccountClientError || error instanceof AccountAssetClientError) &&
          error.code === "AUTHENTICATION_REQUIRED") {
          cloudSync.signOut();
          drafts.deactivateAccount();
          imageLabSubmissionPersistence.deactivateAccount();
          studioCoachRuntime.deactivateAccount();
          throw new AccountClientError("AUTHENTICATION_REQUIRED");
        }
        accountController?.setCloudMessage("Saved on this device · cloud copy paused");
      }
    },
    onSignedOut: async (_explicit) => {
      cloudSync.signOut();
      try {
        await handler.isolateAccountWork();
      } finally {
        drafts.deactivateAccount();
        imageLabSubmissionPersistence.deactivateAccount();
        studioCoachRuntime.deactivateAccount();
      }
    }
  });
  reportGameStartupFailure = (reason) => {
    accountController?.reportGameStartFailure(reason);
  };
  window.AdMarketAccount = createAccountBootstrap(accountController);
}
const handler = new BrowserCreatorHandler(
  root,
  shell,
  gameSurface,
  gameCanvas,
  drafts,
  practiceService,
  cloudSync
);
const canvasResizeObserver = typeof globalThis.ResizeObserver === "function"
  ? new ResizeObserver((entries) => {
      const size = entries[0]?.contentRect ??
        shell.canvasRegion.getBoundingClientRect();
      const width = Math.min(
        1280,
        Math.max(0, size.width - 32),
        Math.max(0, size.height - 32) * 16 / 9
      );
      if (width > 0) {
        shell.canvasRegion.style.setProperty(
          "--studio-canvas-display-width",
          `${Math.floor(width)}px`
        );
      }
      handler.refreshCanvasDisplay();
    })
  : null;
canvasResizeObserver?.observe(shell.canvasRegion);
const teacherReady = mode.kind === "teacher-playtest"
  ? (async (): Promise<void> => {
      const username = TEACHER_PLAYTEST_BROWSER_NAMESPACE;
      try {
        await drafts.activateAccount(username);
        await imageLabSubmissionPersistence.activateAccount(username);
        await studioCoachRuntime.activateAccount(username);
        await cloudSync.setAccount(username);
        const recovery = await cloudRecovery.recoverLatest(username);
        setCloudMessage(cloudRecoveryStatusMessage(recovery));
      } catch (error) {
        cloudSync.signOut();
        drafts.deactivateAccount();
        imageLabSubmissionPersistence.deactivateAccount();
        studioCoachRuntime.deactivateAccount();
        throw error;
      }
      gameSurface.hidden = false;
      gameSurface.inert = false;
      gameSurface.removeAttribute("aria-hidden");
      gameCanvas.tabIndex = 0;
      root.inert = false;
      root.removeAttribute("aria-hidden");
    })()
  : null;
const guidedJourney = new GuidedJourneyController(shell.overlay, (step) => {
  if (step.tool === "game") {
    shell.overlay.querySelector<HTMLButtonElement>('[data-command="return"]')?.click();
    return;
  }
  if (step.id === "roles") {
    shell.overlay.querySelector<HTMLButtonElement>("[data-role-guide-open]")?.click();
    return;
  }
  if (step.id === "product-name") {
    shell.overlay.querySelector<HTMLInputElement>('input[aria-label="Product name"]')?.focus();
    return;
  }
  if (step.aidaStage !== undefined) {
    handler.selectAidaStage(step.aidaStage);
    studioTools.select("aida");
    return;
  }
  if (step.id === "audience") {
    const briefToggle = shell.overlay.querySelector<HTMLButtonElement>("[data-brief-toggle]");
    if (briefToggle?.getAttribute("aria-expanded") !== "true") briefToggle?.click();
    shell.audienceSignal.focus();
    return;
  }
  if (step.id === "pair-contribution") {
    studioTools.select("product");
    shell.swapRoles.focus();
    return;
  }
  studioTools.select(step.tool);
});
handler.attachGuidedJourney(guidedJourney);
const runCanvasSizeAction = (operation: () => Promise<void>): void => {
  void operation().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Canvas size could not be changed";
    shell.zoomStatus.textContent = message;
    shell.assertive.textContent = message;
  });
};
shell.zoomOut.addEventListener("click", () => {
  runCanvasSizeAction(() => handler.resizeSelectedObject(1 / 1.2));
});
shell.zoomFill.addEventListener("click", () => {
  runCanvasSizeAction(() => handler.fillSelectedImage());
});
shell.zoomIn.addEventListener("click", () => {
  runCanvasSizeAction(() => handler.resizeSelectedObject(1.2));
});
if (mode.kind === "student") {
  accountMutations.subscribe((mutation) => {
    if (mutation.kind === "session") {
      accountController?.requireReauthentication();
      return;
    }
    if (accountIdentity.current() !== mutation.username) return;
    if (mutation.kind === "reset-pending") {
      accountController?.holdForReset();
      cloudSync.signOut();
      void handler.isolateAccountWork().finally(() => {
        drafts.deactivateAccount();
        imageLabSubmissionPersistence.deactivateAccount();
        studioCoachRuntime.deactivateAccount();
      });
      return;
    }
    accountController?.completeReset();
  });
}
const productPriceGuideClient = new ProductPriceGuideClient();
const moneyPanel = new ProductMoneyPanel(
  shell.moneyCheckPanel,
  (priceCents) => handler.setProductPrice(priceCents),
  (position) => handler.setProductPricePosition(position),
  () => handler.researchProductPrice(productPriceGuideClient),
  () => handler.addProductPriceToDesign()
);
handler.attachMoneyPanel(moneyPanel);
const marketRoutePanel = new MarketRoutePanel(
  shell.marketRoutePanel,
  (input) => handler.commitMarketRoute(input)
);
handler.attachMarketRoutePanel(marketRoutePanel);
const aidaPlaybookPanel = new AidaPlaybookPanel(
  shell.aidaPlaybookPanel,
  (stage, value) => handler.commitAidaPlan(stage, value)
);
handler.attachAidaPlaybookPanel(aidaPlaybookPanel);
const pairGame = new PairGameController(
  shell,
  handler,
  undefined,
  () => handler.schedulePracticeAutosave()
);
handler.attachPairGame(pairGame);
const roleGuide = new RoleGuideController(
  root,
  shell.overlay,
  () => {
    pairGame.acknowledgeRoleGuide();
    handler.schedulePracticeAutosave();
  },
  () => shell.overlay.querySelector<HTMLButtonElement>("[data-guide-open-tool]")?.focus(),
  false
);
handler.attachRoleGuide(roleGuide);
const studioOnboarding = new StudioOnboardingController(
  root,
  shell.overlay,
  () => {
    pairGame.acknowledgeRoleGuide();
    handler.schedulePracticeAutosave();
  },
  () => {
    studioTools.select("product");
    shell.productBuilderPanel.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }
);
handler.attachStudioOnboarding(studioOnboarding);
const imageLabRuntime = new ImageLabRuntime({
  client: new ImageLabClient(),
  exportDesign: (pair) => handler.exportDesignDataUrl(pair),
  place: (pair, input) => handler.placeGeneratedRaster(pair, input),
  isCurrentPair: (pair) => handler.isCurrentImageLabPair(pair),
  submissionPersistence: imageLabSubmissionPersistence
});
const imageLabPanel = new ImageLabPanel(shell.imageLabPanel, imageLabRuntime);
handler.attachImageLab(imageLabPanel);
const studioCoachPanel = new StudioCoachPanel(shell.studioCoachPanel, studioCoachRuntime);
handler.attachStudioCoach(studioCoachRuntime);
const logCreatorDiagnostic = (diagnostic: CreatorBridgeDiagnostic): void => {
  const errorName = diagnostic.error instanceof Error
    ? diagnostic.error.name
    : typeof diagnostic.error;
  const message = diagnostic.error instanceof Error
    ? diagnostic.error.message
    : "Unknown creator failure";
  console.warn(`[AdMarket creator request failed] ${JSON.stringify({
    requestId: diagnostic.requestId,
    method: diagnostic.method,
    errorName,
    message
  })}`);
};
const publicApi = createCreatorPublicApi(
  handler,
  (message) => handler.showMessage(message),
  logCreatorDiagnostic
);
const marketPublicApi = createMarketPublicApi(new MarketClient());
const cataloguePanel = new CataloguePanel(
  shell.libraryResults,
  (asset) => handler.queueCataloguePlacement(asset, shell.libraryColour.value)
);
const livePhotos = new OpenverseClient();
const catalogueRuntime = new CatalogueRuntime({
  core: [],
  input: shell.librarySearch,
  categorySelect: shell.libraryCategory,
  viewSelect: shell.libraryView,
  liveToggle: shell.livePhotos,
  status: shell.libraryStatus,
  renderer: cataloguePanel,
  client: livePhotos
});
const productKitPanel = new ProductKitPanel(
  shell.productBuilderPanel,
  (request) => handler.queueProductKitPlacement(request),
  (asset) => handler.queueCataloguePlacement(asset)
);
productKitPanel.unavailable();
handler.attachProductKitPanel(productKitPanel);
const logoLabPanel = new LogoLabPanel(
  shell.logoLabPanel,
  (design, icon) => handler.addLogoMark(design, icon),
  (id, design, icon) => handler.replaceLogoMark(id, design, icon),
  (message, priority) => {
    (priority === "assertive" ? shell.assertive : shell.polite).textContent = message;
  }
);
logoLabPanel.unavailable();
handler.attachLogoLab(logoLabPanel);
const checklistTabs = [...shell.overlay.querySelectorAll<HTMLButtonElement>(
  "[data-creator-checklist] [data-slot]"
)];
for (const tab of checklistTabs) {
  tab.addEventListener("click", () => {
    for (const candidate of checklistTabs) {
      candidate.setAttribute("aria-pressed", String(candidate === tab));
    }
    const slot = tab.dataset.slot;
    if (slot === "price") {
      studioTools.select("price");
      return;
    }
    if (slot === "attention" || slot === "interest" || slot === "desire" || slot === "action") {
      handler.selectAidaStage(slot);
      studioTools.select("aida");
    }
  });
}
void loadOfflineCatalogueWithHash(root.dataset.offlineCatalogueUrl).then(async (catalogue) => {
  if (!catalogue) {
    catalogueRuntime.replaceCore([], null);
    productKitPanel.unavailable();
    return;
  }
  const bundle = await loadProductKitBundle(root.dataset.offlineCatalogueUrl, catalogue);
  if (bundle) handler.setProductKitBundle(bundle);
  else productKitPanel.unavailable();
  const pricing = await loadRasterPricing(root.dataset.offlineCatalogueUrl, catalogue);
  if (!pricing) {
    catalogueRuntime.replaceCore([], null);
    if (bundle) {
      productKitPanel.render(bundle);
      handler.refreshProductKitPanel();
    }
    return;
  }
  handler.setRasterPricing(pricing);
  catalogueRuntime.replaceCore(catalogue.records, pricing);
  if (bundle) {
    productKitPanel.render(bundle);
    handler.refreshProductKitPanel();
  }
}).catch(() => {
  catalogueRuntime.replaceCore([], null);
  productKitPanel.unavailable();
});
const logoIconCatalogueUrl = root.dataset.logoIconCatalogueUrl;
if (logoIconCatalogueUrl) {
  void loadLogoIconCatalogue(logoIconCatalogueUrl)
    .then((catalogue) => { logoLabPanel.render(catalogue); })
    .catch(() => { logoLabPanel.unavailable(); });
}

root.querySelector<HTMLButtonElement>('[data-command="return"]')
  ?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent(RETURN_TO_GAME_EVENT, {
      detail: { contract: CREATOR_BRIDGE_CONTRACT, event: "closeRequested" }
    }));
  });

window.AdMarketCreator = publicApi;
window.AdMarketRoom = marketPublicApi;

if (mode.kind === "teacher-playtest") {
  if (teacherReady === null) {
    throw new Error("Teacher playtest storage is not ready");
  }
  return teacherReady.then(() => {
    return {
      resetLocalState: async () => {
        cloudSync.signOut();
        try {
          await handler.isolateAccountWork();
        } finally {
          drafts.deactivateAccount();
          imageLabSubmissionPersistence.deactivateAccount();
          studioCoachRuntime.deactivateAccount();
        }
        await Promise.all([
          drafts.resetAccount(TEACHER_PLAYTEST_BROWSER_NAMESPACE),
          cloudMetadata.resetAccount(TEACHER_PLAYTEST_BROWSER_NAMESPACE),
          ...(cloudOutbox === undefined
            ? []
            : [cloudOutbox.resetAccount(TEACHER_PLAYTEST_BROWSER_NAMESPACE)]),
          imageLabSubmissionPersistence.resetAccount(
            TEACHER_PLAYTEST_BROWSER_NAMESPACE
          ),
          studioCoachRuntime.resetAccount(TEACHER_PLAYTEST_BROWSER_NAMESPACE)
        ]);
      }
    };
  });
}
return null;
}

runAdvertisingGameRoute(window.location.pathname, {
  replace: (location) => window.location.replace(location),
  bootStudent: bootStudentApplication,
  bootTeacherDashboard,
  bootTeacherPlaytest,
  renderNotFound: renderNotFoundApplication
});
