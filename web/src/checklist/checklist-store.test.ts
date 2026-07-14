import { describe, expect, it } from "vitest";
import {
  CampaignDocumentSchema,
  createBlankCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import { ChecklistStore, type ChecklistSlot } from "./checklist-store";

const OBJECTS = [
  { objectId: "price-copy", elementKind: "text", accessibleName: "Visible price" },
  { objectId: "headline", elementKind: "text", accessibleName: "Campaign headline" },
  { objectId: "product", elementKind: "image", accessibleName: "Product image" },
  { objectId: "benefit", elementKind: "shape", accessibleName: "Benefit badge" },
  { objectId: "cta", elementKind: "drawing", accessibleName: "Call-to-action arrow" }
] as const;

function documentFixture(): CampaignDocumentV1 {
  const blank = createBlankCampaignDocument({
    documentId: "checklist-document",
    sessionId: "checklist-session",
    mode: "offline"
  });
  return CampaignDocumentSchema.parse({
    ...blank,
    product: { name: "Solar Sprint", priceCents: 2499 },
    fabricState: { version: "7.4.0", objects: OBJECTS },
    updatedAt: "2026-07-12T00:00:00.000Z"
  });
}

describe("ChecklistStore", () => {
  it("stores deduplicated object IDs only in CampaignDocument.evidence", () => {
    const source = documentFixture();
    const sourceSnapshot = structuredClone(source);
    const store = new ChecklistStore(source);

    const updated = store.setEvidence("attention", ["headline", "headline", "benefit", "headline"]);

    expect(updated.evidence.attention).toEqual(["headline", "benefit"]);
    expect(store.getEvidence("attention")).toEqual(["headline", "benefit"]);
    expect(source).toEqual(sourceSnapshot);
    expect(updated.fabricState.objects).toEqual(sourceSnapshot.fabricState.objects);
    for (const object of updated.fabricState.objects) {
      expect(object).not.toHaveProperty("aidaSlot");
      expect(object).not.toHaveProperty("checklistTags");
      expect(object).not.toHaveProperty("evidence");
    }

    const returnedIds = store.getEvidence("attention") as string[];
    returnedIds.push("cta");
    expect(store.getEvidence("attention")).toEqual(["headline", "benefit"]);
  });

  it("rejects missing Fabric object IDs without changing the document", () => {
    const store = new ChecklistStore(documentFixture());
    store.setEvidence("interest", ["product"]);
    const before = store.getDocument();

    expect(() => store.setEvidence("interest", ["product", "missing-object"]))
      .toThrow("Missing Fabric object missing-object");
    expect(store.getDocument()).toEqual(before);
  });

  it("exposes textual and symbolic completion states independent of colour", () => {
    const store = new ChecklistStore(documentFixture());

    expect(store.getCompletionState().find(({ slot }) => slot === "price")).toEqual({
      slot: "price",
      label: "Price",
      complete: false,
      indicator: "○",
      statusText: "Price needs evidence"
    });

    const assignments: Record<ChecklistSlot, string> = {
      price: "price-copy",
      attention: "headline",
      interest: "product",
      desire: "benefit",
      action: "cta"
    };
    for (const [slot, objectId] of Object.entries(assignments) as Array<[ChecklistSlot, string]>) {
      store.setEvidence(slot, [objectId]);
    }

    expect(store.getCompletionState()).toEqual([
      { slot: "price", label: "Price", complete: true, indicator: "✓", statusText: "Price complete" },
      { slot: "attention", label: "Attention", complete: true, indicator: "✓", statusText: "Attention complete" },
      { slot: "interest", label: "Interest", complete: true, indicator: "✓", statusText: "Interest complete" },
      { slot: "desire", label: "Desire", complete: true, indicator: "✓", statusText: "Desire complete" },
      { slot: "action", label: "Action", complete: true, indicator: "✓", statusText: "Action complete" }
    ]);
  });

  it("rejects a document whose existing evidence references a missing object", () => {
    const source = documentFixture();
    const invalid = CampaignDocumentSchema.parse({
      ...source,
      evidence: { ...source.evidence, action: ["missing-object"] }
    });

    expect(() => new ChecklistStore(invalid)).toThrow("Missing Fabric object missing-object");
  });

  it("rejects ambiguous duplicate Fabric object IDs", () => {
    const source = documentFixture();
    expect(() => CampaignDocumentSchema.parse({
      ...source,
      fabricState: {
        ...source.fabricState,
        objects: [...source.fabricState.objects, {
          objectId: "headline",
          elementKind: "shape",
          accessibleName: "Duplicate headline ID"
        }]
      }
    })).toThrow("Duplicate Fabric object ID headline");
  });

  it("accepts nested semantic object IDs as checklist evidence", () => {
    const source = documentFixture();
    const product = {
      objectId: "product-shell",
      elementKind: "product-shell" as const,
      accessibleName: "Classic can",
      objects: [{ productLayer: "base-shell" }, {
        productLayer: "artwork-slot",
        objects: [{
          objectId: "front-headline",
          elementKind: "text" as const,
          accessibleName: "Front headline",
          text: "Fizz first"
        }]
      }]
    };
    const nested = CampaignDocumentSchema.parse({
      ...source,
      fabricState: {
        ...source.fabricState,
        objects: [...source.fabricState.objects, product]
      }
    });

    const updated = new ChecklistStore(nested)
      .setEvidence("attention", ["front-headline"]);

    expect(updated.evidence.attention).toEqual(["front-headline"]);
  });
});
