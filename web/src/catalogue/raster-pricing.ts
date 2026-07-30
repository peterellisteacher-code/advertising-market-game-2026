import type { CatalogAssetV1 } from "./catalogue-types";
import type { OfflineCatalogueLoadOptions, OfflineCatalogueWithHash } from "./catalogue-store";

export type RasterPricingRole = "base" | "part" | "media";

export interface RasterAssetPrice {
  readonly role: RasterPricingRole;
  readonly costCents: number;
  readonly title: string;
}

export interface RasterPricingIndex {
  readonly packId: "offline-core-v1";
  readonly pricingVersion: number;
  readonly catalogSha256: string;
  readonly byAssetId: ReadonlyMap<string, RasterAssetPrice>;
}

const SHA256 = /^[0-9a-f]{64}$/;
const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROLES = new Set<RasterPricingRole>(["base", "part", "media"]);

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function expectedRole(asset: CatalogAssetV1): RasterPricingRole | null {
  if (asset.delivery !== "offline") return null;
  if (asset.kind === "component" && asset.tags.includes("add-on")) return "part";
  if (asset.kind !== "raster-master") return null;
  if (asset.tags.includes("placement-frame")) return "media";
  if (asset.tags.includes("base") || asset.tags.includes("scene")) return "base";
  return null;
}

export function parseRasterPricing(
  value: unknown,
  catalogue: readonly CatalogAssetV1[],
  expectedCatalogSha256: string
): RasterPricingIndex | null {
  const root = object(value);
  if (!root || !exactKeys(root, [
    "schema", "packId", "pricingVersion", "catalogSha256", "entries"
  ]) || root.schema !== "raster-production-pricing@1" || root.packId !== "offline-core-v1" ||
    !Number.isSafeInteger(root.pricingVersion) || (root.pricingVersion as number) < 1 ||
    (root.pricingVersion as number) > 1_000_000 ||
    typeof root.catalogSha256 !== "string" || !SHA256.test(root.catalogSha256) ||
    root.catalogSha256 !== expectedCatalogSha256 || !Array.isArray(root.entries) ||
    root.entries.length !== catalogue.length || catalogue.length > 20_000) return null;

  const expected = new Map<string, RasterPricingRole>();
  const catalogueById = new Map<string, CatalogAssetV1>();
  for (const asset of catalogue) {
    const role = expectedRole(asset);
    if (!role || expected.has(asset.id)) return null;
    expected.set(asset.id, role);
    catalogueById.set(asset.id, asset);
  }

  const prices = new Map<string, RasterAssetPrice>();
  let previousId = "";
  for (const candidate of root.entries) {
    const entry = object(candidate);
    if (!entry || !exactKeys(entry, ["assetId", "costCents", "role"]) ||
      typeof entry.assetId !== "string" || entry.assetId.length > 80 ||
      !PORTABLE_ID.test(entry.assetId) || entry.assetId <= previousId ||
      !ROLES.has(entry.role as RasterPricingRole) ||
      !Number.isSafeInteger(entry.costCents) || (entry.costCents as number) <= 0 ||
      (entry.costCents as number) > 1_000_000 || expected.get(entry.assetId) !== entry.role) return null;
    previousId = entry.assetId;
    prices.set(entry.assetId, Object.freeze({
      role: entry.role as RasterPricingRole,
      costCents: entry.costCents as number,
      title: catalogueById.get(entry.assetId)?.title ?? entry.assetId
    }));
  }
  if (prices.size !== expected.size || [...expected].some(([id]) => !prices.has(id))) return null;
  return Object.freeze({
    packId: "offline-core-v1" as const,
    pricingVersion: root.pricingVersion as number,
    catalogSha256: root.catalogSha256,
    byAssetId: prices as ReadonlyMap<string, RasterAssetPrice>
  });
}

export async function loadRasterPricing(
  catalogueUrl: string | undefined,
  catalogue: OfflineCatalogueWithHash,
  options: OfflineCatalogueLoadOptions = {}
): Promise<RasterPricingIndex | null> {
  if (!catalogueUrl) return null;
  let url: URL;
  try {
    url = new URL(catalogueUrl, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== catalogueUrl ||
      !url.pathname.endsWith("/catalog.json") || url.search || url.hash) return null;
    url.pathname = `${url.pathname.slice(0, -"catalog.json".length)}pricing.json`;
  } catch {
    return null;
  }
  const fetcher = options.fetch ?? ((input, init) => fetch(input, init));
  try {
    const response = await fetcher(url.href, {
      method: "GET",
      headers: { accept: "application/json" },
      credentials: "same-origin",
      signal: options.createDeadlineSignal?.() ?? AbortSignal.timeout(5_000)
    });
    if (!response.ok) return null;
    return parseRasterPricing(
      await response.json() as unknown,
      catalogue.records,
      catalogue.catalogSha256
    );
  } catch {
    return null;
  }
}
