export const PRODUCT_PRICE_POSITIONS = ["budget", "everyday", "premium"] as const;

export type ProductPricePosition = typeof PRODUCT_PRICE_POSITIONS[number];
export type ProductPriceGuideConfidence = "low" | "medium" | "high";

export interface ProductPriceGuideRequest {
  sessionId: string;
  teamId: string;
  documentId: string;
  idempotencyKey: string;
  productFingerprint: string;
  product: {
    name: string;
    features: string[];
  };
}

export function canonicalProductPriceSubject(product: {
  name: string;
  features: readonly string[];
}): string {
  return JSON.stringify({
    schema: "product-price-subject@1",
    name: product.name,
    features: [...product.features]
  });
}

export interface ProductPriceComparable {
  title: string;
  seller: string;
  priceCents: number;
  sourceUrl: string;
}

export interface ProductPriceGuide {
  schema: "product-price-guide@1";
  productFingerprint: string;
  currency: "AUD";
  checkedAt: string;
  confidence: ProductPriceGuideConfidence;
  lowCents: number;
  typicalCents: number;
  highCents: number;
  comparables: ProductPriceComparable[];
}

const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_ID = /^[A-Za-z0-9._:-]+$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} has unexpected or missing fields`);
  }
}

function boundedText(value: unknown, label: string, maximum: number): string {
  if (typeof value !== "string" || value !== value.trim() || value.length < 1 ||
    value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    throw new Error(`${label} must be bounded text`);
  }
  return value;
}

function safeId(value: unknown, label: string): string {
  const id = boundedText(value, label, 128);
  if (!SAFE_ID.test(id)) throw new Error(`${label} is invalid`);
  return id;
}

function fingerprint(value: unknown): string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw new Error("productFingerprint must be a lowercase SHA-256 value");
  }
  return value;
}

function money(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive safe-integer cent value`);
  }
  return value as number;
}

function httpsUrl(value: unknown): string {
  const text = boundedText(value, "sourceUrl", 2_048);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("sourceUrl must be a valid HTTPS URL");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("sourceUrl must be an HTTPS URL without credentials");
  }
  return url.href;
}

export function parseProductPriceGuideRequest(value: unknown): ProductPriceGuideRequest {
  const input = record(value, "Product price guide request");
  exactKeys(input, [
    "sessionId",
    "teamId",
    "documentId",
    "idempotencyKey",
    "productFingerprint",
    "product"
  ], "Product price guide request");
  const product = record(input.product, "product");
  exactKeys(product, ["name", "features"], "product");
  if (!Array.isArray(product.features) || product.features.length < 1 || product.features.length > 12) {
    throw new Error("product.features must contain between one and twelve items");
  }
  const features = product.features.map((feature) => boundedText(feature, "product feature", 120));
  if (new Set(features).size !== features.length) {
    throw new Error("product.features must not contain duplicates");
  }
  return {
    sessionId: safeId(input.sessionId, "sessionId"),
    teamId: safeId(input.teamId, "teamId"),
    documentId: safeId(input.documentId, "documentId"),
    idempotencyKey: safeId(input.idempotencyKey, "idempotencyKey"),
    productFingerprint: fingerprint(input.productFingerprint),
    product: {
      name: boundedText(product.name, "product.name", 96),
      features
    }
  };
}

function parseComparable(value: unknown): ProductPriceComparable {
  const input = record(value, "comparable");
  exactKeys(input, ["title", "seller", "priceCents", "sourceUrl"], "comparable");
  return {
    title: boundedText(input.title, "comparable.title", 120),
    seller: boundedText(input.seller, "comparable.seller", 80),
    priceCents: money(input.priceCents, "comparable.priceCents"),
    sourceUrl: httpsUrl(input.sourceUrl)
  };
}

function expectedTypical(prices: readonly number[]): number {
  const sorted = [...prices].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

function expectedConfidence(count: number): ProductPriceGuideConfidence {
  return count >= 4 ? "high" : count === 3 ? "medium" : "low";
}

export function parseProductPriceGuide(value: unknown): ProductPriceGuide {
  const input = record(value, "Product price guide");
  exactKeys(input, [
    "schema",
    "productFingerprint",
    "currency",
    "checkedAt",
    "confidence",
    "lowCents",
    "typicalCents",
    "highCents",
    "comparables"
  ], "Product price guide");
  if (input.schema !== "product-price-guide@1" || input.currency !== "AUD") {
    throw new Error("Product price guide schema or currency is unsupported");
  }
  if (typeof input.checkedAt !== "string" || !ISO_UTC.test(input.checkedAt) ||
    new Date(input.checkedAt).toISOString() !== input.checkedAt.replace(/Z$/, input.checkedAt.includes(".") ? "Z" : ".000Z")) {
    throw new Error("checkedAt must be an ISO-8601 UTC timestamp");
  }
  if (!Array.isArray(input.comparables) || input.comparables.length < 2 || input.comparables.length > 4) {
    throw new Error("comparables must contain between two and four items");
  }
  const comparables = input.comparables.map(parseComparable);
  if (new Set(comparables.map(({ sourceUrl }) => sourceUrl)).size !== comparables.length) {
    throw new Error("comparables must use distinct source URLs");
  }
  const prices = comparables.map(({ priceCents }) => priceCents);
  const lowCents = money(input.lowCents, "lowCents");
  const typicalCents = money(input.typicalCents, "typicalCents");
  const highCents = money(input.highCents, "highCents");
  if (lowCents !== Math.min(...prices) || highCents !== Math.max(...prices) ||
    typicalCents !== expectedTypical(prices)) {
    throw new Error("Price guide range must be derived from its comparables");
  }
  const confidence = expectedConfidence(comparables.length);
  if (input.confidence !== confidence) {
    throw new Error("Price guide confidence must be derived from its comparable count");
  }
  return {
    schema: "product-price-guide@1",
    productFingerprint: fingerprint(input.productFingerprint),
    currency: "AUD",
    checkedAt: input.checkedAt,
    confidence,
    lowCents,
    typicalCents,
    highCents,
    comparables
  };
}

export function priceGuideFromComparables(input: {
  productFingerprint: string;
  checkedAt: string;
  comparables: ProductPriceComparable[];
}): ProductPriceGuide {
  const prices = input.comparables.map(({ priceCents }) => priceCents);
  return parseProductPriceGuide({
    schema: "product-price-guide@1",
    productFingerprint: input.productFingerprint,
    currency: "AUD",
    checkedAt: input.checkedAt,
    confidence: expectedConfidence(input.comparables.length),
    lowCents: Math.min(...prices),
    typicalCents: expectedTypical(prices),
    highCents: Math.max(...prices),
    comparables: input.comparables
  });
}
