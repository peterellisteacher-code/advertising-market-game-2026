import { Canvas, Line, Path } from "fabric";
import {
  CampaignDocumentSchema,
  createBlankCampaignDocument,
  type CampaignDocumentV1
} from "../../src/domain/campaign-document";
import { CampaignExporter } from "../../src/export/campaign-exporter";
import { FabricCanvasAdapter } from "../../src/fabric/fabric-canvas-adapter";
import { ObjectCommandService } from "../../src/fabric/object-command-service";
import {
  canonicalDurableDocumentHash,
  IndexedDbDraftStore,
  rehydrateLocalAssetBlobs
} from "../../src/persistence/draft-store";
import { CropController } from "../../src/tools/crop-controller";

const DATABASE_NAME = "task-7-persistence-publish-diagnostic";
const DOCUMENT_ID = "task-7-browser-document";
const BLOB_KEY = "diagnostic-masked-product";
const LOOP_GUARD_KEY = "task-7-persistence-publish-loop-guard";

interface ReloadGuard {
  stage: "awaiting-reload" | "checking";
  timeOrigin: number;
  durableHash: string;
  objectCount: number;
  blobBytesHex: string;
  firstObjectUrl: string;
}

interface DiagnosticResult {
  status: "running" | "pass" | "fail";
  actualReload?: boolean;
  durableHash?: string;
  editedHash?: string;
  objectCount?: number;
  freshBlobUrl?: boolean;
  blobBytesExact?: boolean;
  editAfterReload?: boolean;
  selectionRestored?: boolean;
  guideRestored?: boolean;
  png?: {
    signatureHex: string;
    width: number;
    height: number;
    byteLength: number;
    guideProbeRgba: number[];
  };
  ownDatabaseCleared?: boolean;
  error?: string;
}

declare global {
  interface Window {
    __PERSISTENCE_PUBLISH_DIAGNOSTIC__?: DiagnosticResult;
  }
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Persistence diagnostic is missing ${selector}`);
  return element;
}

const status = requiredElement<HTMLElement>("#status");
const canvasElement = requiredElement<HTMLCanvasElement>("#diagnostic-canvas");
const preview = requiredElement<HTMLImageElement>("#published-preview");
window.__PERSISTENCE_PUBLISH_DIAGNOSTIC__ = { status: "running" };

function databaseDeleted(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.addEventListener("success", () => resolve(), { once: true });
    request.addEventListener("blocked", () => reject(new Error(`Diagnostic database ${name} is blocked`)), {
      once: true
    });
    request.addEventListener("error", () => reject(
      request.error ?? new Error(`Could not delete diagnostic database ${name}`)
    ), { once: true });
  });
}

async function blobHex(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function serialisedObjects(state: Record<string, unknown>): Array<Record<string, unknown>> {
  if (!Array.isArray(state.objects)) throw new Error("Fabric state has no object array");
  return state.objects as Array<Record<string, unknown>>;
}

function setDurableRasterSource(state: Record<string, unknown>, objectId: string, blobKey: string): void {
  const object = serialisedObjects(state).find((candidate) => candidate.objectId === objectId);
  if (!object) throw new Error(`Missing diagnostic raster ${objectId}`);
  object.src = `local-blob:${blobKey}`;
}

function deterministicIds(...ids: string[]): () => string {
  let index = 0;
  return () => {
    const id = ids[index];
    index += 1;
    if (!id) throw new Error("Diagnostic ID sequence was exhausted");
    return id;
  };
}

async function createCampaign(canvas: Canvas, sourceBlob: Blob, sourceUrl: string): Promise<CampaignDocumentV1> {
  const adapter = new FabricCanvasAdapter(canvas);
  const commands = new ObjectCommandService(adapter, deterministicIds(
    "benefit-panel",
    "price-copy",
    "headline",
    "masked-product"
  ));
  const benefitId = await commands.addShape({
    kind: "rect",
    fill: "#0f766e",
    accessibleName: "Portable-power benefit panel"
  });
  commands.transform(benefitId, { x: 470, y: 510, scaleX: 1.7, scaleY: 1.25, angle: -3 });
  const priceId = await commands.addText("$24.99", "Visible campaign price");
  commands.transform(priceId, { x: 1240, y: 700, scaleX: 1.2, scaleY: 1.2, angle: 4 });
  const headlineId = await commands.addText("Charge into tomorrow", "Campaign headline");
  commands.transform(headlineId, { x: 770, y: 130, scaleX: 1.25, scaleY: 1.25, angle: -2 });
  const productId = await commands.addRaster({
    assetId: "diagnostic-solar-product",
    sameOriginUrl: sourceUrl,
    accessibleName: "Locally rendered solar product"
  });
  commands.transform(productId, { x: 1040, y: 440, scaleX: 0.9, scaleY: 0.9, angle: 8 });
  new CropController(adapter).apply(productId, {
    cropX: 40,
    cropY: 30,
    visibleWidth: 520,
    visibleHeight: 390,
    focalX: 0.55,
    focalY: 0.45
  });
  const product = canvas.getObjects().find((object) => object.objectId === productId);
  if (!product) throw new Error("Diagnostic product did not reach Fabric");
  product.set({ elementKind: "masked-component", sourceHash: await blobHex(sourceBlob) });

  const drawing = new Path("M 170 740 L 390 650 L 325 790", {
    fill: "",
    stroke: "#f59e0b",
    strokeWidth: 22,
    strokeLineCap: "round",
    strokeLineJoin: "round"
  });
  drawing.set({
    objectId: "action-drawing",
    elementKind: "drawing",
    accessibleName: "Hand-drawn action arrow"
  });
  drawing.setCoords();
  canvas.add(drawing);
  canvas.requestRenderAll();

  const durableState = structuredClone(adapter.serialize());
  setDurableRasterSource(durableState, productId, BLOB_KEY);
  const blank = createBlankCampaignDocument({
    documentId: DOCUMENT_ID,
    sessionId: "task-7-browser-session",
    mode: "offline"
  });
  return CampaignDocumentSchema.parse({
    ...blank,
    revision: 0,
    fabricState: durableState,
    drawingLayers: [{ objectId: "action-drawing", path: "M 170 740 L 390 650 L 325 790" }],
    product: { name: "Solar Sprint", priceCents: 2499 },
    brief: {
      targetAudienceId: "active-teens",
      contextId: "school-commute",
      purpose: "persuade",
      audienceNeeds: ["portable power"],
      audienceValues: ["independence"],
      intendedEffects: ["confidence"],
      techniques: ["imperative", "contrast"]
    },
    evidence: {
      price: [priceId],
      attention: [headlineId],
      interest: [productId],
      desire: [benefitId],
      action: ["action-drawing"]
    },
    assetReferences: [{
      kind: "local-blob",
      objectId: productId,
      blobKey: BLOB_KEY,
      mimeType: sourceBlob.type,
      assetId: "diagnostic-solar-product"
    }],
    updatedAt: new Date().toISOString()
  });
}

async function firstPass(canvas: Canvas): Promise<never> {
  await databaseDeleted(DATABASE_NAME);
  const response = await fetch(new URL("./probe.svg", window.location.href));
  if (!response.ok) throw new Error(`Diagnostic source returned ${response.status}`);
  const sourceBlob = await response.blob();
  if (!sourceBlob.size || !sourceBlob.type.startsWith("image/svg+xml")) {
    throw new Error("Diagnostic source must be a non-empty image/svg+xml Blob");
  }
  const firstObjectUrl = URL.createObjectURL(sourceBlob);
  const campaign = await createCampaign(canvas, sourceBlob, firstObjectUrl);
  const durableHash = await canonicalDurableDocumentHash(campaign);
  const objectCount = campaign.fabricState.objects.length;
  await new IndexedDbDraftStore({ databaseName: DATABASE_NAME })
    .save(campaign, new Map([[BLOB_KEY, sourceBlob]]));
  const guard: ReloadGuard = {
    stage: "awaiting-reload",
    timeOrigin: performance.timeOrigin,
    durableHash,
    objectCount,
    blobBytesHex: await blobHex(sourceBlob),
    firstObjectUrl
  };
  sessionStorage.setItem(LOOP_GUARD_KEY, JSON.stringify(guard));
  URL.revokeObjectURL(firstObjectUrl);
  status.textContent = "Revision saved; performing the required real page reload…";
  window.location.reload();
  return await new Promise<never>(() => undefined);
}

async function guideProbe(blob: Blob): Promise<number[]> {
  const bitmap = await createImageBitmap(blob);
  try {
    const probe = document.createElement("canvas");
    probe.width = 1600;
    probe.height = 900;
    const context = probe.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("PNG probe canvas has no 2D context");
    context.drawImage(bitmap, 0, 0);
    return Array.from(context.getImageData(10, 10, 1, 1).data);
  } finally {
    bitmap.close();
  }
}

async function secondPass(canvas: Canvas, guard: ReloadGuard): Promise<void> {
  if (guard.timeOrigin === performance.timeOrigin) throw new Error("Loop guard detected no actual page reload");
  const checkingGuard = { ...guard, stage: "checking" as const };
  sessionStorage.setItem(LOOP_GUARD_KEY, JSON.stringify(checkingGuard));
  const loaded = await new IndexedDbDraftStore({ databaseName: DATABASE_NAME }).load(DOCUMENT_ID);
  if (!loaded) throw new Error("Saved campaign was absent after reload");
  const loadedBlob = loaded.blobs.get(BLOB_KEY);
  if (!loadedBlob) throw new Error("Saved local product Blob was absent after reload");
  const blobBytesExact = await blobHex(loadedBlob) === guard.blobBytesHex;
  if (!blobBytesExact) throw new Error("Saved local product Blob bytes changed across reload");
  const durableHash = await canonicalDurableDocumentHash(loaded.document);
  if (durableHash !== guard.durableHash) throw new Error("Canonical document hash changed across reload");
  if (loaded.document.fabricState.objects.length !== guard.objectCount) {
    throw new Error("Editable object count changed across reload");
  }

  const hydrated = rehydrateLocalAssetBlobs(loaded.document, loaded.blobs);
  const freshBlobUrl = [...hydrated.ownedUrls].every((url) => url !== guard.firstObjectUrl);
  if (!freshBlobUrl) throw new Error("Reload reused the expired pre-reload object URL");
  try {
    if (await canonicalDurableDocumentHash(hydrated.document) !== durableHash) {
      throw new Error("Hydration changed the canonical durable hash");
    }
    const adapter = new FabricCanvasAdapter(canvas);
    await adapter.load(hydrated.document.fabricState);
    const restoredState = adapter.serialize();
    if (serialisedObjects(restoredState).length !== guard.objectCount) {
      throw new Error("Fabric did not reconstruct the saved editable object count");
    }
    adapter.setText("headline", "Charge into tomorrow — reloaded");
    adapter.transform("masked-product", { angle: 11, x: 1050 });
    const editedState = adapter.serialize();
    const editedHeadline = serialisedObjects(editedState)
      .find((object) => object.objectId === "headline");
    const editAfterReload = editedHeadline?.text === "Charge into tomorrow — reloaded";
    if (!editAfterReload) throw new Error("Reloaded Fabric text did not remain editable");
    const editedDocument = CampaignDocumentSchema.parse({
      ...hydrated.document,
      fabricState: editedState,
      updatedAt: new Date().toISOString()
    });

    const guide = new Line([10, 0, 10, 900], { stroke: "#ff00ff", strokeWidth: 4, visible: true });
    guide.editorGuide = true;
    canvas.add(guide);
    adapter.setSelected("headline");
    const canvasOrder = [...canvas.getObjects()];
    const published = new CampaignExporter(adapter, hydrated.ownedUrls).publish(editedDocument);
    const selectionRestored = canvas.getActiveObject()?.objectId === "headline";
    const guideRestored = guide.visible && canvas.getObjects().every((object, index) => object === canvasOrder[index]);
    if (!selectionRestored || !guideRestored) throw new Error("Editor state was not restored after publication");

    const pngBlob = new Blob([published.pngBytes.slice().buffer as ArrayBuffer], { type: "image/png" });
    const probe = await guideProbe(pngBlob);
    if (probe[0] !== 255 || probe[1] !== 255 || probe[2] !== 255 || probe[3] !== 255) {
      throw new Error(`Guide leaked into clean PNG at probe pixel: ${probe.join(",")}`);
    }
    const previewUrl = URL.createObjectURL(pngBlob);
    preview.src = previewUrl;
    preview.hidden = false;
    window.addEventListener("beforeunload", () => URL.revokeObjectURL(previewUrl), { once: true });
    const view = new DataView(published.pngBytes.buffer, published.pngBytes.byteOffset, published.pngBytes.byteLength);
    const signatureHex = Array.from(published.pngBytes.slice(0, 8), (byte) =>
      byte.toString(16).padStart(2, "0")).join("");
    const editedHash = await canonicalDurableDocumentHash(editedDocument);

    sessionStorage.removeItem(LOOP_GUARD_KEY);
    await databaseDeleted(DATABASE_NAME);
    window.__PERSISTENCE_PUBLISH_DIAGNOSTIC__ = {
      status: "pass",
      actualReload: true,
      durableHash,
      editedHash,
      objectCount: guard.objectCount,
      freshBlobUrl,
      blobBytesExact,
      editAfterReload,
      selectionRestored,
      guideRestored,
      png: {
        signatureHex,
        width: view.getUint32(16),
        height: view.getUint32(20),
        byteLength: published.pngBytes.byteLength,
        guideProbeRgba: probe
      },
      ownDatabaseCleared: true
    };
    status.dataset.persistencePublish = "pass";
    status.textContent = `Reloaded ${guard.objectCount} editable objects; canonical hash, Blob bytes and clean 1600×900 PNG passed`;
  } finally {
    hydrated.release();
  }
}

async function run(): Promise<void> {
  const canvas = new Canvas(canvasElement, {
    width: 1600,
    height: 900,
    preserveObjectStacking: true,
    backgroundColor: "#ffffff"
  });
  const rawGuard = sessionStorage.getItem(LOOP_GUARD_KEY);
  if (!rawGuard) await firstPass(canvas);
  const guard = JSON.parse(rawGuard!) as ReloadGuard;
  if (guard.stage !== "awaiting-reload") throw new Error("Loop guard blocked a repeated diagnostic reload");
  await secondPass(canvas, guard);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  window.__PERSISTENCE_PUBLISH_DIAGNOSTIC__ = { status: "fail", error: message };
  status.dataset.persistencePublish = "fail";
  status.textContent = `Persistence and publication diagnostic failed: ${message}`;
  console.error(error);
});
