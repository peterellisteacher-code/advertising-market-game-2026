import type {
  AssetKind,
  CatalogAssetV1,
  RecolourZone
} from "./catalogue-types";

const ASSET_KINDS = new Set<AssetKind>([
  "raster-master", "component", "svg", "texture", "shape", "photo", "shell"
]);
const RECOLOUR_ZONES = new Set<RecolourZone>(["body", "trim", "accent", "label"]);
const MAX_RECORDS = 20_000;
const LOAD_TIMEOUT_MS = 5_000;

export interface OfflineCatalogueLoadOptions {
  fetch?: typeof fetch;
  createDeadlineSignal?: () => AbortSignal;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const text = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const stringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(text);

function sameOriginAssetUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value, window.location.href);
    return url.origin === window.location.origin &&
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username && !url.password && url.pathname.startsWith("/catalog/");
  } catch {
    return false;
  }
}

function validAttribution(value: unknown): value is CatalogAssetV1["attribution"] {
  const attribution = record(value);
  if (!attribution || !text(attribution.creator) || !text(attribution.license) ||
    !text(attribution.sourceUrl)) return false;
  if (attribution.sourceUrl === "local") return true;
  try {
    const url = new URL(attribution.sourceUrl);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

function validFiles(value: unknown): value is CatalogAssetV1["files"] {
  const files = record(value);
  if (!files || !sameOriginAssetUrl(files.thumbnail) ||
    !sameOriginAssetUrl(files.preview) || !sameOriginAssetUrl(files.master)) return false;
  if (files.shadow !== undefined && !sameOriginAssetUrl(files.shadow)) return false;
  if (files.masks !== undefined) {
    const masks = record(files.masks);
    if (!masks || Object.entries(masks).some(([zone, url]) =>
      !RECOLOUR_ZONES.has(zone as RecolourZone) || !sameOriginAssetUrl(url))) return false;
  }
  return true;
}

function validAnchors(value: unknown): value is CatalogAssetV1["anchors"] {
  return Array.isArray(value) && value.every((candidate) => {
    const anchor = record(candidate);
    return anchor !== null && text(anchor.id) &&
      typeof anchor.x === "number" && Number.isFinite(anchor.x) &&
      typeof anchor.y === "number" && Number.isFinite(anchor.y) &&
      stringArray(anchor.accepts);
  });
}

function parseAsset(value: unknown): CatalogAssetV1 | null {
  const asset = record(value);
  if (!asset || asset.schema !== "catalog-asset@1" || !text(asset.id) ||
    !Number.isInteger(asset.version) || (asset.version as number) < 1 ||
    !ASSET_KINDS.has(asset.kind as AssetKind) || !text(asset.title) ||
    !text(asset.category) || !stringArray(asset.tags) || !validFiles(asset.files) ||
    !Array.isArray(asset.recolourZones) ||
    !asset.recolourZones.every((zone) => RECOLOUR_ZONES.has(zone as RecolourZone)) ||
    !validAnchors(asset.anchors) || !stringArray(asset.materialProfiles) ||
    typeof asset.classroomReviewed !== "boolean" || typeof asset.brandFree !== "boolean" ||
    !validAttribution(asset.attribution)) return null;
  return structuredClone(asset) as unknown as CatalogAssetV1;
}

function sameOriginCatalogueUrl(value: string): URL | null {
  try {
    const url = new URL(value, window.location.href);
    if (url.origin !== window.location.origin ||
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username || url.password || !url.pathname.startsWith("/catalog/") || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

/** Loads the optional reviewed classroom pack; every malformed response fails to an empty pack. */
export async function loadOfflineCatalogue(
  value: string | undefined,
  options: OfflineCatalogueLoadOptions = {}
): Promise<CatalogAssetV1[]> {
  if (!value) return [];
  const url = sameOriginCatalogueUrl(value);
  if (!url) return [];
  const fetcher = options.fetch ?? ((input, init) => fetch(input, init));
  const deadline = options.createDeadlineSignal?.() ?? AbortSignal.timeout(LOAD_TIMEOUT_MS);
  try {
    const response = await fetcher(url.href, {
      method: "GET",
      headers: { accept: "application/json" },
      credentials: "same-origin",
      signal: deadline
    });
    if (!response.ok) return [];
    const payload = await response.json() as unknown;
    if (!Array.isArray(payload) || payload.length > MAX_RECORDS) return [];
    const parsed = payload.map(parseAsset);
    if (parsed.some((asset) => asset === null)) return [];
    const records = parsed as CatalogAssetV1[];
    if (new Set(records.map(({ id }) => id)).size !== records.length) return [];
    return records;
  } catch {
    return [];
  }
}
