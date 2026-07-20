import { CampaignDocumentSchema, type CampaignDocumentV1 } from "../domain/campaign-document";
import {
  campaignSemanticObjectMap,
  collectCampaignSemanticObjects
} from "../domain/campaign-semantic-objects";
import {
  assertEvidenceReferences,
  CHECKLIST_SLOTS
} from "../checklist/checklist-store";
import { formatMarketBucks } from "../product-builder/product-money-panel";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const IHDR = [73, 72, 68, 82] as const;
const OPENVERSE_IMAGE_PATH = /^\/api\/openverse-image\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;

export interface CampaignExportPort {
  serialize(): Record<string, unknown>;
  exportCleanPngDataUrl(): string;
}

export interface PublishedCampaign {
  contract: "published-campaign@1";
  documentId: string;
  revision: number;
  pngBytes: Uint8Array;
  metadata: {
    productName: string;
    priceCents: number;
    brief: CampaignDocumentV1["brief"];
    evidence: CampaignDocumentV1["evidence"];
    assetReferences: CampaignDocumentV1["assetReferences"];
  };
}

function rasterSourceIsAllowed(source: string, ownedUrls: ReadonlySet<string>): void {
  let url: URL;
  try {
    url = new URL(source, window.location.href);
  } catch {
    throw new Error(`Raster source must be local or same-origin: ${source}`);
  }
  const currentOrigin = window.location.origin;
  if (url.protocol === "blob:") {
    if (currentOrigin === "null" || url.origin === "null" || url.origin !== currentOrigin) {
      throw new Error(`Raster source must be local or same-origin: ${source}`);
    }
    if (!ownedUrls.has(url.href)) throw new Error(`Raster source must be an owned local blob: ${source}`);
    return;
  }
  if ((url.protocol === "http:" || url.protocol === "https:") &&
    currentOrigin !== "null" && url.origin === currentOrigin) return;
  throw new Error(`Raster source must be local or same-origin: ${source}`);
}

function validateRasterSources(document: CampaignDocumentV1, ownedUrls: ReadonlySet<string>): void {
  const visit = (value: unknown, seen: WeakSet<object>): void => {
    if (value === null || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((child) => visit(child, seen));
      return;
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (key === "src" && typeof child === "string") rasterSourceIsAllowed(child, ownedUrls);
      else visit(child, seen);
    }
  };
  for (const semanticObject of collectCampaignSemanticObjects(document.fabricState)) {
    if ((semanticObject.elementKind === "image" || semanticObject.elementKind === "masked-component") &&
      (typeof semanticObject.object.src !== "string" || !semanticObject.object.src)) {
      throw new Error(`Raster ${semanticObject.objectId} is missing a source`);
    }
  }
  visit(document.fabricState, new WeakSet());
}

function validateAssetReferences(document: CampaignDocumentV1): void {
  const objects = campaignSemanticObjectMap(document.fabricState);
  const catalogByObject = new Map<string, Record<string, unknown>>();
  const localBlobByObject = new Map<string, Record<string, unknown>>();
  for (const reference of document.assetReferences) {
    const { objectId } = reference;
    if (reference.kind === "local-blob" &&
      (typeof objectId !== "string" || !objectId ||
        typeof reference.blobKey !== "string" || !reference.blobKey ||
        typeof reference.mimeType !== "string" || !reference.mimeType)) {
      throw new Error("Local blob references require objectId, blobKey and mimeType");
    }
    if (typeof objectId !== "string" || !objectId) {
      throw new Error("Asset references require an objectId");
    }
    if (!objects.has(objectId)) throw new Error(`Missing Fabric object ${objectId}`);
    if (reference.kind === "local-blob") {
      if (localBlobByObject.has(objectId)) {
        throw new Error(`Duplicate local-blob reference for ${objectId}`);
      }
      localBlobByObject.set(objectId, reference);
    }
    if (reference.kind === "catalog") {
      const attribution = reference.attribution;
      if (typeof reference.assetId !== "string" || !reference.assetId ||
        !Number.isInteger(reference.assetVersion) || (reference.assetVersion as number) < 1) {
        throw new Error("Catalogue references require an asset ID and positive asset version");
      }
      const attributionRecord = attribution !== null && typeof attribution === "object" &&
        !Array.isArray(attribution) ? attribution as Record<string, unknown> : null;
      const creator = attributionRecord?.creator;
      const sourceUrl = attributionRecord?.sourceUrl;
      const license = attributionRecord?.license;
      let safeSource = false;
      if (typeof sourceUrl === "string" && sourceUrl === sourceUrl.trim()) {
        if (sourceUrl === "local") safeSource = true;
        else {
          try {
            const parsedSource = new URL(sourceUrl);
            safeSource = (parsedSource.protocol === "http:" || parsedSource.protocol === "https:") &&
              !parsedSource.username && !parsedSource.password;
          } catch {
            safeSource = false;
          }
        }
      }
      if (typeof creator !== "string" || creator !== creator.trim() || !creator ||
        typeof license !== "string" || license !== license.trim() || !license || !safeSource) {
        throw new Error("Catalogue references require attribution");
      }
      if (catalogByObject.has(objectId)) {
        throw new Error(`Duplicate catalogue reference for ${objectId}`);
      }
      const object = objects.get(objectId);
      if (!object || (object.elementKind !== "image" && object.elementKind !== "masked-component") ||
        object.assetId !== reference.assetId) {
        throw new Error(`Fabric object ${objectId} does not match its catalogue asset`);
      }
      catalogByObject.set(objectId, reference);
    }
  }

  for (const object of objects.values()) {
    if (object.elementKind !== "image" && object.elementKind !== "masked-component") continue;
    if (typeof object.object.src !== "string") continue;
    let url: URL;
    try {
      url = new URL(object.object.src, window.location.href);
    } catch {
      continue;
    }
    const isCatalogueRaster = url.origin === window.location.origin &&
      (url.pathname.startsWith("/catalog/") ||
        url.pathname.startsWith("/api/openverse-image/"));
    if (isCatalogueRaster && !catalogByObject.has(object.objectId)) {
      throw new Error(`Catalogue raster ${object.objectId} requires a catalogue reference`);
    }
    const catalogReference = catalogByObject.get(object.objectId);
    if (url.origin === window.location.origin && url.pathname.startsWith("/api/openverse-image/")) {
      const match = url.pathname.match(OPENVERSE_IMAGE_PATH);
      if (!match || url.search || url.hash || !catalogReference ||
        match[1] !== catalogReference.assetId || match[1] !== object.assetId) {
        throw new Error(`Raster ${object.objectId} requires a canonical full Openverse image URL`);
      }
    }
    if (url.protocol === "blob:" && catalogReference) {
      const localReference = localBlobByObject.get(object.objectId);
      if (!localReference || localReference.assetId !== catalogReference.assetId) {
        throw new Error(`Blob-backed catalogue raster ${object.objectId} requires a matching local-blob reference`);
      }
    }
  }
}

function validatePriceIntegrity(document: CampaignDocumentV1): void {
  const priceCents = document.product.priceCents;
  if (priceCents === null) throw new Error("Campaign price is required for publication");
  if (priceCents <= 0) throw new Error("Campaign price must be positive for publication");
  if (document.evidence.price.length !== 1) {
    throw new Error("Campaign must have exactly one visible price");
  }
  const expected = formatMarketBucks(priceCents);
  const object = campaignSemanticObjectMap(document.fabricState)
    .get(document.evidence.price[0]!);
  if (!object || object.elementKind !== "text" ||
    object.accessibleName !== `Market price ${expected}` ||
    object.object.text !== expected || object.object.editable !== false) {
    throw new Error("Visible price must exactly match the charged price and remain protected");
  }
}

function validatePairParticipation(document: CampaignDocumentV1): void {
  const pair = document.gameplay.pair;
  if (pair.handoffCount < 1 || pair.artDirectorActions < 1 || pair.strategistActions < 1) {
    throw new Error("Before the market opens, swap control once. Both players each make one visible change.");
  }
}

function canvasStateWithoutGuides(value: Record<string, unknown>): Record<string, unknown> {
  const clone = structuredClone(value);
  if (!Array.isArray(clone.objects)) throw new Error("Canvas serialization has no object array");
  clone.objects = clone.objects.filter((object) =>
    object === null || typeof object !== "object" ||
    (object as Record<string, unknown>).editorGuide !== true);
  return clone;
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => [key, canonicalise(child)]));
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalise(value));
}

function decodePng(dataUrl: string): Uint8Array {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) throw new Error("Export did not return a base64 PNG data URL");
  const payload = dataUrl.slice(prefix.length);
  const canonicalBase64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  if (!payload || !canonicalBase64.test(payload)) {
    throw new Error("Export did not return a canonical base64 PNG data URL");
  }
  let binary: string;
  try {
    binary = atob(payload);
  } catch {
    throw new Error("Export did not return a canonical base64 PNG data URL");
  }
  if (btoa(binary) !== payload) {
    throw new Error("Export did not return a canonical base64 PNG data URL");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) {
    throw new Error("Export has an invalid PNG signature");
  }
  if (bytes.length < 33 || new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(8) !== 13 ||
    IHDR.some((byte, index) => bytes[index + 12] !== byte)) {
    throw new Error("Export is missing a valid PNG IHDR chunk");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width !== 1600 || height !== 900) {
    throw new Error(`Published PNG must be 1600 by 900 pixels, received ${width} by ${height}`);
  }
  return bytes;
}

export class CampaignExporter {
  readonly #ownedUrls: ReadonlySet<string>;

  constructor(
    private readonly port: CampaignExportPort,
    ownedRasterUrls: ReadonlySet<string> = new Set()
  ) {
    this.#ownedUrls = new Set(ownedRasterUrls);
  }

  publish(document: CampaignDocumentV1): PublishedCampaign {
    const parsed = CampaignDocumentSchema.parse(structuredClone(document));
    if (parsed.product.priceCents === null) throw new Error("Campaign price is required for publication");
    assertEvidenceReferences(parsed);
    validateAssetReferences(parsed);
    for (const slot of CHECKLIST_SLOTS) {
      if (parsed.evidence[slot].length === 0) throw new Error(`${slot} evidence is required for publication`);
    }
    validatePairParticipation(parsed);
    validatePriceIntegrity(parsed);
    validateRasterSources(parsed, this.#ownedUrls);

    const canvasSnapshot = this.port.serialize();
    const canvasBefore = JSON.stringify(canvasSnapshot);
    const actualDocument = CampaignDocumentSchema.parse({
      ...parsed,
      fabricState: canvasStateWithoutGuides(canvasSnapshot)
    });
    assertEvidenceReferences(actualDocument);
    validateAssetReferences(actualDocument);
    validateRasterSources(actualDocument, this.#ownedUrls);
    if (canonicalJson(actualDocument.fabricState) !== canonicalJson(parsed.fabricState)) {
      throw new Error("Canvas state does not match campaign document");
    }
    let dataUrl = "";
    try {
      dataUrl = this.port.exportCleanPngDataUrl();
    } finally {
      const canvasAfter = JSON.stringify(this.port.serialize());
      if (canvasAfter !== canvasBefore) throw new Error("Canvas serialization changed during publication");
    }
    const pngBytes = decodePng(dataUrl);
    return {
      contract: "published-campaign@1",
      documentId: parsed.documentId,
      revision: parsed.revision,
      pngBytes,
      metadata: {
        productName: parsed.product.name,
        priceCents: parsed.product.priceCents,
        brief: structuredClone(parsed.brief),
        evidence: structuredClone(parsed.evidence),
        assetReferences: structuredClone(parsed.assetReferences)
      }
    };
  }
}
