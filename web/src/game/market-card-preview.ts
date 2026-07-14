import type { CampaignDocumentV1 } from "../domain/campaign-document";
import type { AudienceBrief } from "./audience-briefs";

export interface MarketCardPreview {
  readonly campaignImage: {
    readonly src: string;
    readonly width: 1600;
    readonly height: 900;
    readonly fit: "contain";
  };
  readonly productName: string;
  readonly priceCents: number;
  readonly sellerLabel: "Anonymous seller";
  readonly audienceSignals: {
    readonly signal: string;
    readonly context: string;
    readonly need: string;
    readonly values: readonly string[];
    readonly intendedEffect: string;
  };
  readonly editReturn: {
    readonly documentId: string;
    readonly revision: number;
  };
}

function localImageSource(source: string): string {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    throw new Error("campaign image source must be non-blank");
  }
  const remote = /^(?:https?:)?\/\//i.test(trimmed);
  const unsupportedScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    && !/^(?:blob:|data:image\/)/i.test(trimmed);
  if (remote || unsupportedScheme) {
    throw new Error("campaign image source must be same-origin or local");
  }
  return trimmed;
}

export function buildMarketCardPreview(
  campaign: CampaignDocumentV1,
  brief: AudienceBrief,
  campaignImageSource: string
): MarketCardPreview {
  const src = localImageSource(campaignImageSource);
  const productName = campaign.product.name.trim();
  if (productName.length === 0) {
    throw new Error("product name must be non-blank");
  }
  if (campaign.product.priceCents === null) {
    throw new Error("price must be present");
  }

  const campaignImage = Object.freeze({ src, width: 1600 as const, height: 900 as const, fit: "contain" as const });
  const audienceSignals = Object.freeze({
    signal: brief.signal,
    context: brief.context,
    need: brief.need,
    values: Object.freeze([...brief.values]),
    intendedEffect: brief.intendedEffect
  });
  const editReturn = Object.freeze({
    documentId: campaign.documentId,
    revision: campaign.revision
  });

  return Object.freeze({
    campaignImage,
    productName,
    priceCents: campaign.product.priceCents,
    sellerLabel: "Anonymous seller" as const,
    audienceSignals,
    editReturn
  });
}
