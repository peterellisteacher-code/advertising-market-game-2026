import { describe, expect, it } from "vitest";
import { createBlankCampaignDocument } from "../domain/campaign-document";
import {
  createProductPriceSubject,
  hasPlacedProduct
} from "./product-price-subject";

const blank = () => createBlankCampaignDocument({
  documentId: "document-1",
  sessionId: "session-1",
  mode: "offline"
});

describe("product price subject", () => {
  it("uses product features but never the internal component prices", () => {
    const document = blank();
    document.product.name = "  Orbit   Tumbler ";
    document.product.build = {
      schema: "product-build@1",
      primaryObjectId: "product-1",
      packId: "pack-1",
      pricingVersion: 1,
      blueprintId: "tumbler",
      selections: [{ groupId: "body", choiceIds: ["steel"] }],
      costLines: [{
        groupId: "body",
        groupLabel: "Material",
        kind: "material",
        choiceId: "steel",
        label: "Insulated steel",
        costCents: 3_500
      }],
      unitCostCents: 3_500
    };

    const subject = createProductPriceSubject(document);

    expect(subject).toMatchObject({
      name: "Orbit Tumbler",
      features: ["Material: Insulated steel"]
    });
    expect(JSON.stringify(subject)).not.toContain("3500");
    expect(subject?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("treats an active make-it-real result as a product without inventing a build cost", () => {
    const document = blank();
    document.product.name = "Glow Tent";
    document.fabricState.objects = [{
      objectId: "generated-1",
      elementKind: "image",
      assetId: "ai-1",
      accessibleName: "Tent showcase"
    }];
    document.assetReferences = [{
      kind: "generated-image",
      version: 1,
      objectId: "generated-1",
      assetId: "ai-1",
      title: "Tent showcase",
      stage: "make-it-real",
      profileId: "make-it-real-v1",
      requestId: "request-1"
    }];

    expect(hasPlacedProduct(document)).toBe(true);
    expect(createProductPriceSubject(document)).toMatchObject({
      name: "Glow Tent",
      features: ["Tent showcase"]
    });
    expect(document.product.build).toBeNull();
  });

  it("ignores deleted generated references and requires a settled product name", () => {
    const document = blank();
    document.assetReferences = [{
      kind: "generated-image",
      version: 1,
      objectId: "deleted-1",
      assetId: "ai-1",
      title: "Tent showcase",
      stage: "make-it-real",
      profileId: "make-it-real-v1",
      requestId: "request-1"
    }];

    expect(hasPlacedProduct(document)).toBe(false);
    expect(createProductPriceSubject(document)).toBeNull();
  });
});
