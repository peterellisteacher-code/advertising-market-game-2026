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

const LOCAL_VALIDATION_ORIGIN = "https://local.invalid";

function parseCurrentOrigin(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("current origin must be a valid HTTP(S) origin");
  }
  const isHttpOrigin = parsed.protocol === "http:" || parsed.protocol === "https:";
  const isOriginOnly = parsed.username.length === 0
    && parsed.password.length === 0
    && parsed.pathname === "/"
    && parsed.search.length === 0
    && parsed.hash.length === 0;
  if (!isHttpOrigin || !isOriginOnly) {
    throw new Error("current origin must be a valid HTTP(S) origin");
  }
  return parsed.origin;
}

function invalidImageSource(): never {
  throw new Error("campaign image source must be same-origin or local");
}

function localImageSource(source: string, currentOrigin?: string): string {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    throw new Error("campaign image source must be non-blank");
  }

  const origin = currentOrigin === undefined ? undefined : parseCurrentOrigin(currentOrigin);
  if (/^(?:https?:)?[\\/]{2}/i.test(trimmed) && trimmed.includes("\\")) {
    return invalidImageSource();
  }

  if (/^(?:blob:|data:image\/)/i.test(trimmed)) {
    try {
      new URL(trimmed);
    } catch {
      return invalidImageSource();
    }
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, origin ?? LOCAL_VALIDATION_ORIGIN);
  } catch {
    return invalidImageSource();
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return invalidImageSource();
  }

  const networkReference = /^(?:https?:\/\/|\/\/)/i.test(trimmed);
  if (networkReference && (origin === undefined || parsed.origin !== origin)) {
    return invalidImageSource();
  }
  return trimmed;
}

export function buildMarketCardPreview(
  campaign: CampaignDocumentV1,
  brief: AudienceBrief,
  campaignImageSource: string,
  currentOrigin?: string
): MarketCardPreview {
  const src = localImageSource(campaignImageSource, currentOrigin);
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
