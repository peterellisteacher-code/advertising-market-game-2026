import type { CampaignDocumentV1 } from "../domain/campaign-document";
import { campaignSemanticObjectMap } from "../domain/campaign-semantic-objects";
import { sha256Utf8 } from "../product-kit/utf8-sha256";
import { canonicalProductPriceSubject } from "../../../shared/product-price-guide-contract";

export interface ProductPriceSubject {
  readonly name: string;
  readonly features: readonly string[];
  readonly fingerprint: string;
}

function activeGeneratedProductTitles(document: CampaignDocumentV1): string[] {
  const activeObjectIds = new Set(campaignSemanticObjectMap(document.fabricState).keys());
  return document.assetReferences.flatMap((reference) => {
    if (reference.kind !== "generated-image" || reference.stage !== "make-it-real" ||
      typeof reference.objectId !== "string" || !activeObjectIds.has(reference.objectId) ||
      typeof reference.title !== "string") return [];
    const title = reference.title.trim();
    return title ? [title] : [];
  });
}

function buildFeatureLabels(document: CampaignDocumentV1): string[] {
  const build = document.product.build;
  if (!build) return [];
  return build.costLines.map((line) => line.groupLabel === line.label
    ? line.label
    : `${line.groupLabel}: ${line.label}`
  );
}

function uniqueBounded(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.trim().replace(/\s+/g, " ").slice(0, 120);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length === 12) break;
  }
  return result;
}

export function hasPlacedProduct(document: CampaignDocumentV1): boolean {
  if (document.product.build !== null) return true;
  return activeGeneratedProductTitles(document).length > 0;
}

export function createProductPriceSubject(
  document: CampaignDocumentV1
): ProductPriceSubject | null {
  const name = document.product.name.trim().replace(/\s+/g, " ");
  if (!name || !hasPlacedProduct(document)) return null;
  const features = uniqueBounded([
    ...buildFeatureLabels(document),
    ...activeGeneratedProductTitles(document)
  ]);
  if (features.length === 0) return null;
  const canonical = canonicalProductPriceSubject({ name, features });
  return Object.freeze({
    name,
    features: Object.freeze(features),
    fingerprint: sha256Utf8(canonical)
  });
}
