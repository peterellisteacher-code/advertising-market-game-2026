import { MATERIAL_PRESET_IDS, type MaterialPresetId } from "../tools/material-presets";
import type {
  AssetKind,
  CatalogAssetV1,
  CatalogFiles,
  CatalogZoneStyle,
  RecolourZone
} from "./catalogue-types";

const ASSET_KINDS = new Set<AssetKind>([
  "raster-master", "component", "svg", "texture", "shape", "photo", "shell"
]);
const RECOLOUR_ZONES: readonly RecolourZone[] = ["body", "trim", "accent", "label"];
const RECOLOUR_ZONE_SET = new Set<RecolourZone>(RECOLOUR_ZONES);
const MATERIAL_IDS = new Set<MaterialPresetId>(MATERIAL_PRESET_IDS);
const OFFLINE_PREFIXES = [
  "/catalog/generated/offline-core-v1/assets/",
  "/catalog/generated/performance-fixtures/assets/"
] as const;
const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/;
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

const text = (value: unknown, maximum = 2_048): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= maximum &&
  value === value.trim() && !/[\x00-\x1f]/.test(value);

const exactKeys = (
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = []
): boolean => {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => allowed.has(key));
};

const sortedUniqueStrings = (
  value: unknown,
  predicate: (candidate: string) => boolean = () => true
): value is string[] => {
  if (!Array.isArray(value) || !value.every((candidate) => text(candidate, 80) && predicate(candidate))) return false;
  return new Set(value).size === value.length &&
    value.every((candidate, index) => index === 0 || value[index - 1] < candidate);
};

const portableId = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 80 && PORTABLE_ID.test(value) &&
  !new Set(["con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9"]).has(value);

const validDimensions = (value: unknown, maximum: number): boolean => {
  const dimensions = record(value);
  return dimensions !== null && exactKeys(dimensions, ["width", "height"]) &&
    Number.isInteger(dimensions.width) && Number.isInteger(dimensions.height) &&
    (dimensions.width as number) > 0 && (dimensions.height as number) > 0 &&
    (dimensions.width as number) <= maximum && (dimensions.height as number) <= maximum &&
    (dimensions.width as number) * (dimensions.height as number) <= 64_000_000;
};

function validOfflineUrl(value: unknown): value is string {
  if (typeof value !== "string" || !OFFLINE_PREFIXES.some((prefix) => value.startsWith(prefix)) ||
    value.includes("\\") || value.includes("?") || value.includes("#")) return false;
  try {
    const url = new URL(value, window.location.href);
    const decoded = decodeURIComponent(url.pathname);
    return url.origin === window.location.origin &&
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username && !url.password && url.pathname === value &&
      !decoded.split("/").some((segment) => segment === "." || segment === "..");
  } catch {
    return false;
  }
}

const liveImageMatch = (value: unknown): RegExpMatchArray | null =>
  typeof value === "string"
    ? value.match(/^\/api\/openverse-image\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\?variant=(thumbnail|full))?$/)
    : null;

function validAttribution(value: unknown): value is CatalogAssetV1["attribution"] {
  const attribution = record(value);
  if (!attribution || !exactKeys(attribution, ["creator", "sourceUrl", "license"]) ||
    !text(attribution.creator) || !text(attribution.license) || !text(attribution.sourceUrl)) return false;
  if (attribution.sourceUrl === "local") return true;
  if (!(attribution.sourceUrl as string).startsWith("http://") &&
    !(attribution.sourceUrl as string).startsWith("https://")) return false;
  if ((attribution.sourceUrl as string).includes("\\")) return false;
  try {
    const url = new URL(attribution.sourceUrl as string);
    return (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

function validFiles(value: unknown, delivery: "offline" | "live-photo", assetId: string): value is CatalogFiles {
  const files = record(value);
  if (!files || !exactKeys(files, ["thumbnail", "preview", "master"], ["masks"])) return false;
  if (delivery === "offline") {
    if (!validOfflineUrl(files.thumbnail) || !validOfflineUrl(files.preview) || !validOfflineUrl(files.master)) return false;
    if (!files.thumbnail.endsWith("/thumbnail-192.webp") ||
      !files.preview.endsWith("/preview-640.webp") || !files.master.endsWith("/master.png")) return false;
    const parent = files.master.slice(0, -"/master.png".length);
    if (files.thumbnail !== `${parent}/thumbnail-192.webp` || files.preview !== `${parent}/preview-640.webp`) return false;
    if (files.masks !== undefined) {
      const masks = record(files.masks);
      if (!masks || Object.entries(masks).some(([zone, url]) =>
        !RECOLOUR_ZONE_SET.has(zone as RecolourZone) || !validOfflineUrl(url) ||
        url !== `${parent}/masks/${zone}.png`)) return false;
    }
    return true;
  }
  if (files.masks !== undefined) return false;
  const thumbnail = liveImageMatch(files.thumbnail);
  const preview = liveImageMatch(files.preview);
  const master = liveImageMatch(files.master);
  return thumbnail?.[1] === assetId && thumbnail[2] === "thumbnail" &&
    preview?.[1] === assetId && preview[2] === undefined &&
    master?.[1] === assetId && master[2] === undefined;
}

function validAnchors(value: unknown): value is CatalogAssetV1["anchors"] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((candidate) => {
    const anchor = record(candidate);
    if (!anchor || !exactKeys(anchor, ["id", "x", "y", "accepts"]) ||
      !portableId(anchor.id) || ids.has(anchor.id) ||
      typeof anchor.x !== "number" || !Number.isFinite(anchor.x) || anchor.x < 0 || anchor.x > 1 ||
      typeof anchor.y !== "number" || !Number.isFinite(anchor.y) || anchor.y < 0 || anchor.y > 1 ||
      !sortedUniqueStrings(anchor.accepts, (accept) => portableId(accept))) return false;
    ids.add(anchor.id);
    return true;
  });
}

function validZoneStyles(
  value: unknown,
  zones: RecolourZone[],
  materials: MaterialPresetId[]
): value is Partial<Record<RecolourZone, CatalogZoneStyle>> {
  const styles = record(value);
  if (!styles || Object.keys(styles).length === 0) return false;
  const zoneSet = new Set(zones);
  return Object.entries(styles).every(([zone, candidate]) => {
    const style = record(candidate);
    return zoneSet.has(zone as RecolourZone) && style !== null &&
      exactKeys(style, ["colour", "materialId", "opacity"]) &&
      typeof style.colour === "string" && HEX_COLOUR.test(style.colour) &&
      MATERIAL_IDS.has(style.materialId as MaterialPresetId) && materials.includes(style.materialId as MaterialPresetId) &&
      typeof style.opacity === "number" && Number.isFinite(style.opacity) &&
      style.opacity >= 0 && style.opacity <= 1;
  });
}

/** Strict runtime parser shared by offline loading and the cross-language corpus. */
export function parseCatalogAsset(value: unknown): CatalogAssetV1 | null {
  const asset = record(value);
  if (!asset || (asset.delivery !== "offline" && asset.delivery !== "live-photo")) return null;
  const required = [
    "schema", "delivery", "id", "version", "kind", "title", "category", "tags", "files",
    "dimensions", "recolourZones", "anchors", "materialProfiles", "classroomReviewed", "brandFree", "attribution"
  ];
  if (asset.delivery === "offline") required.push("masterSha256");
  const optional = asset.delivery === "offline" ? ["virtualParentId", "defaultZoneStyles"] : [];
  if (!exactKeys(asset, required, optional) || asset.schema !== "catalog-asset@1" ||
    asset.version !== 1 ||
    !ASSET_KINDS.has(asset.kind as AssetKind) || !text(asset.title, 160) || !text(asset.category, 80) ||
    !sortedUniqueStrings(asset.tags) || typeof asset.classroomReviewed !== "boolean" ||
    typeof asset.brandFree !== "boolean" || !validAttribution(asset.attribution)) return null;

  const isOffline = asset.delivery === "offline";
  if ((isOffline ? !portableId(asset.id) : typeof asset.id !== "string" || !UUID.test(asset.id)) ||
    !validDimensions(asset.dimensions, isOffline ? 8_192 : 16_384) ||
    !validFiles(asset.files, asset.delivery, asset.id as string) || !validAnchors(asset.anchors)) return null;

  const rawZones = asset.recolourZones;
  if (!Array.isArray(rawZones) ||
    !rawZones.every((zone) => RECOLOUR_ZONE_SET.has(zone as RecolourZone)) ||
    new Set(rawZones).size !== rawZones.length ||
    !rawZones.every((zone, index) => index === 0 ||
      RECOLOUR_ZONES.indexOf(rawZones[index - 1] as RecolourZone) < RECOLOUR_ZONES.indexOf(zone as RecolourZone))) return null;
  const zones = rawZones as RecolourZone[];
  const masks = record((asset.files as CatalogFiles).masks);
  if (Object.keys(masks ?? {}).sort().join("\0") !== [...zones].sort().join("\0") ||
    !sortedUniqueStrings(asset.materialProfiles, (id) => MATERIAL_IDS.has(id as MaterialPresetId))) return null;
  const materials = asset.materialProfiles as MaterialPresetId[];

  if (!isOffline) {
    if (asset.kind !== "photo" || zones.length !== 0 || (asset.anchors as unknown[]).length !== 0 ||
      (asset.materialProfiles as unknown[]).length !== 0 || asset.classroomReviewed || asset.brandFree) return null;
  } else {
    if (typeof asset.masterSha256 !== "string" || !SHA256.test(asset.masterSha256) ||
      (asset.virtualParentId !== undefined &&
        (!portableId(asset.virtualParentId) || asset.virtualParentId === asset.id)) ||
      (asset.defaultZoneStyles !== undefined && !validZoneStyles(asset.defaultZoneStyles, zones, materials))) return null;
  }
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
    const parsed = payload.map(parseCatalogAsset);
    if (parsed.some((asset) => asset === null || asset.delivery !== "offline")) return [];
    const records = parsed as CatalogAssetV1[];
    if (new Set(records.map(({ id }) => id)).size !== records.length) return [];
    return records;
  } catch {
    return [];
  }
}
