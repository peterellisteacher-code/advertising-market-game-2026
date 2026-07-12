import { describe, expect, it } from "vitest";
import {
  CampaignDocumentSchema,
  createBlankCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import {
  CampaignExporter,
  type CampaignExportPort
} from "./campaign-exporter";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

function pngBytes(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set(PNG_SIGNATURE, 0);
  new DataView(bytes.buffer).setUint32(8, 13);
  bytes.set([73, 72, 68, 82], 12);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  bytes.set([8, 6, 0, 0, 0], 24);
  return bytes;
}

function pngDataUrl(width = 1600, height = 900): string {
  return `data:image/png;base64,${Buffer.from(pngBytes(width, height)).toString("base64")}`;
}

function documentFixture(): CampaignDocumentV1 {
  const blank = createBlankCampaignDocument({
    documentId: "publish-document",
    sessionId: "publish-session",
    mode: "offline"
  });
  return CampaignDocumentSchema.parse({
    ...blank,
    revision: 7,
    product: { name: "Solar Sprint", priceCents: 2499 },
    fabricState: {
      version: "7.4.0",
      objects: [
        { type: "textbox", objectId: "price-copy", elementKind: "text", accessibleName: "Visible price", text: "$24.99" },
        { type: "textbox", objectId: "headline", elementKind: "text", accessibleName: "Headline", text: "Charge ahead" },
        {
          type: "image",
          objectId: "photo",
          elementKind: "image",
          assetId: "photo",
          accessibleName: "Runner",
          src: `${window.location.origin}/api/media/runner.png`
        },
        {
          type: "image",
          objectId: "variant",
          elementKind: "masked-component",
          assetId: "solar-pack",
          accessibleName: "Recoloured solar backpack",
          src: `blob:${window.location.origin}/owned-variant-png`,
          localBlobId: "variant-png"
        },
        { type: "path", objectId: "cta", elementKind: "drawing", accessibleName: "Buy-now arrow", path: [] }
      ]
    },
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
      price: ["price-copy"],
      attention: ["headline"],
      interest: ["photo"],
      desire: ["variant"],
      action: ["cta"]
    },
    assetReferences: [
      { objectId: "photo", assetId: "photo" },
      {
        kind: "local-blob",
        objectId: "variant",
        assetId: "solar-pack",
        blobKey: "variant-png",
        mimeType: "image/png"
      }
    ],
    updatedAt: "2026-07-12T00:00:00.000Z"
  });
}

class ExportHarness implements CampaignExportPort {
  selection: unknown = { kind: "active-selection", objectIds: ["headline", "photo"] };
  guides: unknown = [{ id: "vertical-guide", x: 800 }, { id: "horizontal-guide", y: 450 }];
  readonly canvasState: Record<string, unknown>;
  renderCount = 0;
  renderedClean = false;
  failWith: Error | undefined;

  constructor(
    public dataUrl = pngDataUrl(),
    canvasState: Record<string, unknown> = documentFixture().fabricState
  ) {
    this.canvasState = structuredClone(canvasState);
  }

  serialize(): Record<string, unknown> {
    return structuredClone(this.canvasState);
  }

  exportCleanPngDataUrl(): string {
    const selection = this.selection;
    const guides = this.guides;
    this.selection = null;
    this.guides = [];
    this.renderCount += 1;
    this.renderedClean = this.selection === null && Array.isArray(this.guides) && this.guides.length === 0;
    try {
      if (this.failWith) throw this.failWith;
      return this.dataUrl;
    } finally {
      this.guides = guides;
      this.selection = selection;
    }
  }
}

function ownedUrls(document: CampaignDocumentV1): ReadonlySet<string> {
  const variant = document.fabricState.objects.find(({ objectId }) => objectId === "variant")!;
  return new Set([String(variant.src)]);
}

describe("CampaignExporter", () => {
  it("returns the exact publication contract from a clean 1600 by 900 PNG", () => {
    const document = documentFixture();
    const documentBefore = structuredClone(document);
    const port = new ExportHarness();
    const selectionBefore = port.selection;
    const guidesBefore = port.guides;
    const canvasBefore = port.serialize();

    const published = new CampaignExporter(port, ownedUrls(document)).publish(document);

    expect(published).toEqual({
      contract: "published-campaign@1",
      documentId: document.documentId,
      revision: 7,
      pngBytes: pngBytes(1600, 900),
      metadata: {
        productName: "Solar Sprint",
        priceCents: 2499,
        brief: document.brief,
        evidence: document.evidence,
        assetReferences: document.assetReferences
      }
    });
    expect(Array.from(published.pngBytes.slice(0, 8))).toEqual(PNG_SIGNATURE);
    expect(port.renderedClean).toBe(true);
    expect(port.selection).toBe(selectionBefore);
    expect(port.guides).toBe(guidesBefore);
    expect(document).toEqual(documentBefore);
    expect(port.serialize()).toEqual(canvasBefore);
  });

  it("restores the exact selection, guides and serialization when rendering fails", () => {
    const port = new ExportHarness();
    port.failWith = new Error("Synthetic Fabric export failure");
    const selectionBefore = port.selection;
    const guidesBefore = port.guides;
    const canvasBefore = port.serialize();

    const document = documentFixture();
    expect(() => new CampaignExporter(port, ownedUrls(document)).publish(document))
      .toThrow("Synthetic Fabric export failure");

    expect(port.renderedClean).toBe(true);
    expect(port.selection).toBe(selectionBefore);
    expect(port.guides).toBe(guidesBefore);
    expect(port.serialize()).toEqual(canvasBefore);
  });

  it("rejects malformed documents and a null price before touching the editor", () => {
    const malformedPort = new ExportHarness();
    expect(() => new CampaignExporter(malformedPort).publish({ schemaVersion: 1 } as CampaignDocumentV1))
      .toThrow();
    expect(malformedPort.renderCount).toBe(0);

    const nullPricePort = new ExportHarness();
    const document = documentFixture();
    document.product.priceCents = null;
    expect(() => new CampaignExporter(nullPricePort, ownedUrls(document)).publish(document)).toThrow("price");
    expect(nullPricePort.renderCount).toBe(0);
  });

  it.each(["price", "attention", "interest", "desire", "action"] as const)(
    "requires evidence for the %s slot",
    (slot) => {
      const port = new ExportHarness();
      const document = documentFixture();
      document.evidence[slot] = [];

      expect(() => new CampaignExporter(port, ownedUrls(document)).publish(document)).toThrow(`${slot} evidence`);
      expect(port.renderCount).toBe(0);
    }
  );

  it("rejects evidence IDs absent from Fabric state", () => {
    const port = new ExportHarness();
    const document = documentFixture();
    document.evidence.action = ["missing-object"];

    expect(() => new CampaignExporter(port, ownedUrls(document)).publish(document))
      .toThrow("Missing Fabric object missing-object");
    expect(port.renderCount).toBe(0);
  });

  it("rejects missing or malformed asset references", () => {
    const missing = documentFixture();
    missing.assetReferences[0]!.objectId = "missing-asset-object";
    expect(() => new CampaignExporter(new ExportHarness(), ownedUrls(missing)).publish(missing))
      .toThrow("Missing Fabric object missing-asset-object");

    const malformed = documentFixture();
    delete malformed.assetReferences[1]!.mimeType;
    expect(() => new CampaignExporter(new ExportHarness(), ownedUrls(malformed)).publish(malformed))
      .toThrow("Local blob references require objectId, blobKey and mimeType");
  });

  it("retains valid catalogue attribution and rejects object, asset, or attribution mismatches", () => {
    const valid = documentFixture();
    valid.fabricState.objects.find(({ objectId }) => objectId === "photo")!.src =
      `${window.location.origin}/catalog/photo.png`;
    valid.assetReferences[0] = {
      kind: "catalog",
      objectId: "photo",
      assetId: "photo",
      assetVersion: 4,
      attribution: {
        creator: "A. Photographer",
        sourceUrl: "https://example.test/work/photo",
        license: "CC BY 4.0"
      }
    };

    expect(new CampaignExporter(new ExportHarness(pngDataUrl(), valid.fabricState), ownedUrls(valid))
      .publish(valid).metadata.assetReferences[0]).toEqual(valid.assetReferences[0]);

    const wrongAsset = structuredClone(valid);
    wrongAsset.assetReferences[0]!.assetId = "different-asset";
    expect(() => new CampaignExporter(
      new ExportHarness(pngDataUrl(), wrongAsset.fabricState),
      ownedUrls(wrongAsset)
    ).publish(wrongAsset)).toThrow(/catalogue asset/i);

    const missingAttribution = structuredClone(valid);
    delete missingAttribution.assetReferences[0]!.attribution;
    expect(() => new CampaignExporter(
      new ExportHarness(pngDataUrl(), missingAttribution.fabricState),
      ownedUrls(missingAttribution)
    ).publish(missingAttribution)).toThrow(/attribution/i);

    for (const attribution of [
      { creator: "   ", sourceUrl: "local", license: "CC BY 4.0" },
      { creator: "A. Photographer", sourceUrl: "javascript:alert(1)", license: "CC BY 4.0" },
      { creator: "A. Photographer", sourceUrl: "https://user:secret@example.test/work", license: "CC BY 4.0" }
    ]) {
      const unsafeAttribution = structuredClone(valid);
      unsafeAttribution.assetReferences[0]!.attribution = attribution;
      expect(() => new CampaignExporter(
        new ExportHarness(pngDataUrl(), unsafeAttribution.fabricState),
        ownedUrls(unsafeAttribution)
      ).publish(unsafeAttribution)).toThrow(/attribution/i);
    }

    const missingReference = structuredClone(valid);
    missingReference.assetReferences.splice(0, 1);
    expect(() => new CampaignExporter(
      new ExportHarness(pngDataUrl(), missingReference.fabricState),
      ownedUrls(missingReference)
    ).publish(missingReference)).toThrow(/catalogue reference/i);
  });

  it("validates and reconciles the actual canvas snapshot before export", () => {
    const document = documentFixture();
    const externalCanvas = structuredClone(document.fabricState);
    externalCanvas.objects.find(({ objectId }) => objectId === "photo")!.src =
      "https://external.example/actual-canvas.png";
    const externalPort = new ExportHarness(pngDataUrl(), externalCanvas);
    expect(() => new CampaignExporter(externalPort, ownedUrls(document)).publish(document))
      .toThrow("local or same-origin");
    expect(externalPort.renderCount).toBe(0);

    const duplicateCanvas = structuredClone(document.fabricState);
    duplicateCanvas.objects.push({
      objectId: "headline",
      elementKind: "shape",
      accessibleName: "Actual-canvas duplicate"
    });
    expect(() => new CampaignExporter(
      new ExportHarness(pngDataUrl(), duplicateCanvas),
      ownedUrls(document)
    ).publish(document)).toThrow("Duplicate Fabric object ID headline");

    const staleCanvas = structuredClone(document.fabricState);
    staleCanvas.objects.find(({ objectId }) => objectId === "headline")!.text = "Stale canvas copy";
    expect(() => new CampaignExporter(
      new ExportHarness(pngDataUrl(), staleCanvas),
      ownedUrls(document)
    ).publish(document)).toThrow("Canvas state does not match campaign document");
  });

  it.each([
    "https://external.example/image.png",
    "data:image/png;base64,cHJvYmU=",
    "blob:null/external-image"
  ])("rejects external or unscoped raster source %s", (src) => {
    const port = new ExportHarness();
    const document = documentFixture();
    const photo = document.fabricState.objects.find(({ objectId }) => objectId === "photo")!;
    photo.src = src;

    expect(() => new CampaignExporter(port, ownedUrls(document)).publish(document)).toThrow("local or same-origin");
    expect(port.renderCount).toBe(0);
  });

  it.each([
    ["malformed signature", "data:image/png;base64,Zm9v", /PNG signature/],
    ["wrong dimensions", pngDataUrl(1599, 900), /1600 by 900/],
    ["truncated 24-byte header", (() => {
      const bytes = pngBytes(1600, 900).slice(0, 24);
      return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
    })(), /IHDR/],
    ["truncated 32-byte IHDR chunk", (() => {
      const bytes = pngBytes(1600, 900).slice(0, 32);
      return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
    })(), /IHDR/],
    ["wrong IHDR length", (() => {
      const bytes = pngBytes(1600, 900);
      new DataView(bytes.buffer).setUint32(8, 12);
      return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
    })(), /IHDR/],
    ["wrong IHDR type", (() => {
      const bytes = pngBytes(1600, 900);
      bytes.set([66, 65, 68, 33], 12);
      return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
    })(), /IHDR/]
  ] as const)("rejects a %s PNG and still restores editor state", (_label, dataUrl, message) => {
    const port = new ExportHarness(dataUrl);
    const selectionBefore = port.selection;
    const guidesBefore = port.guides;

    const document = documentFixture();
    expect(() => new CampaignExporter(port, ownedUrls(document)).publish(document)).toThrow(message);
    expect(port.selection).toBe(selectionBefore);
    expect(port.guides).toBe(guidesBefore);
  });

  it.each((() => {
    const canonical = Buffer.from(pngBytes(1600, 900)).toString("base64");
    const padded = Buffer.from(pngBytes(1600, 900).slice(0, 32)).toString("base64");
    return [
      ["wrong MIME", `data:image/jpeg;base64,${canonical}`],
      ["embedded whitespace", `data:image/png;base64,${canonical.slice(0, 12)}\n${canonical.slice(12)}`],
      ["URL-safe alphabet", `data:image/png;base64,${canonical.slice(0, -1)}_`],
      ["junk suffix", `data:image/png;base64,${canonical}!`],
      ["missing required padding", `data:image/png;base64,${padded.slice(0, -1)}`],
      ["non-zero padding bits", `data:image/png;base64,${padded.slice(0, -2)}B=`],
      ["superfluous padding", `data:image/png;base64,${canonical}=`]
    ] as const;
  })())("rejects %s in PNG base64", (_label, dataUrl) => {
    const document = documentFixture();
    expect(() => new CampaignExporter(new ExportHarness(dataUrl), ownedUrls(document)).publish(document))
      .toThrow(/base64 PNG data URL/);
  });

  it("accepts a zero price and rejects unowned blob URLs or duplicate object IDs", () => {
    const zeroPriceDocument = documentFixture();
    zeroPriceDocument.product.priceCents = 0;
    expect(new CampaignExporter(new ExportHarness(), ownedUrls(zeroPriceDocument))
      .publish(zeroPriceDocument).metadata.priceCents).toBe(0);

    const unowned = documentFixture();
    expect(() => new CampaignExporter(new ExportHarness(), new Set()).publish(unowned))
      .toThrow("owned local blob");

    const duplicate = documentFixture();
    duplicate.fabricState.objects.push({
      objectId: "headline",
      elementKind: "shape",
      accessibleName: "Duplicate headline ID"
    });
    expect(() => new CampaignExporter(new ExportHarness(), ownedUrls(duplicate)).publish(duplicate))
      .toThrow("Duplicate Fabric object ID headline");
  });
});
