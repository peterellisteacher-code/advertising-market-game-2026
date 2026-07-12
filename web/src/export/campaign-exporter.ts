import { CampaignDocumentSchema, type CampaignDocumentV1 } from "../domain/campaign-document";
import {
  assertEvidenceReferences,
  campaignObjectIds,
  CHECKLIST_SLOTS
} from "../checklist/checklist-store";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;
const IHDR = [73, 72, 68, 82] as const;

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
  for (const object of document.fabricState.objects) {
    if ((object.elementKind === "image" || object.elementKind === "masked-component") &&
      (typeof object.src !== "string" || !object.src)) {
      throw new Error(`Raster ${object.objectId} is missing a source`);
    }
  }
  visit(document.fabricState, new WeakSet());
}

function validateAssetReferences(document: CampaignDocumentV1): void {
  const objectIds = campaignObjectIds(document);
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
    if (!objectIds.has(objectId)) throw new Error(`Missing Fabric object ${objectId}`);
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
