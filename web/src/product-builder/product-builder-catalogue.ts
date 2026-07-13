import { MATERIAL_PRESET_IDS, type MaterialPresetId } from "../tools/material-presets";

const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLAIN_TITLE = /^[A-Za-z0-9][A-Za-z0-9 &'()+,.\-]*$/;
const URL_LIKE_TITLE = /(?:\bwww\.|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}\b|\b(?:\d{1,3}\.){3}\d{1,3}\b)/i;
const UPPERCASE_HEX_COLOUR = /^#[0-9A-F]{6}$/;
const ENCODED_PATH_CONTROL = /%(?:00|2e|2f|5c)/i;
const RAW_DOT_SEGMENT = /(?:^|[\\/])\.{1,2}(?=[\\/?#]|$)/;
const CATALOGUE_PATH = /^\/catalog\/generated\/([a-z0-9]+(?:-[a-z0-9]+)*)\/catalogue\.json$/;
const LOAD_TIMEOUT_MS = 5_000;

export const PRODUCT_BUILDER_CATALOGUE_MAX_BYTES = 512 * 1024;

export interface ProductBuilderPoint {
  readonly x: number;
  readonly y: number;
}

export interface ProductBuilderBounds extends ProductBuilderPoint {
  readonly width: number;
  readonly height: number;
}

export interface ProductBuilderFamily {
  readonly id: string;
  readonly title: string;
  readonly componentSlotId: string;
}

export interface ProductBuilderBody {
  readonly id: string;
  readonly title: string;
  readonly familyId: string;
  readonly geometryId: string;
  readonly componentSlotId: string;
  readonly compatiblePartIds: readonly string[];
  readonly componentAnchor: ProductBuilderPoint;
  readonly artworkBounds: ProductBuilderBounds;
  readonly authoringUrl: string;
  readonly previewUrl: string;
}

export interface ProductBuilderPart {
  readonly id: string;
  readonly title: string;
  readonly familyId: string;
  readonly geometryId: string;
  readonly slotId: string;
  readonly componentUrl: string;
}

export interface ProductBuilderColours {
  readonly accent: string;
  readonly body: string;
  readonly label: string;
  readonly trim: string;
}

export interface ProductBuilderPalette {
  readonly id: string;
  readonly title: string;
  readonly colours: ProductBuilderColours;
}

export interface ProductBuilderMaterial {
  readonly id: MaterialPresetId;
  readonly title: string;
}

export interface ProductBuilderCatalogue {
  readonly schema: "product-builder-catalogue@1";
  readonly version: 1;
  readonly packId: string;
  readonly virtualCount: 6_144;
  readonly families: readonly ProductBuilderFamily[];
  readonly bodies: readonly ProductBuilderBody[];
  readonly parts: readonly ProductBuilderPart[];
  readonly palettes: readonly ProductBuilderPalette[];
  readonly materials: readonly ProductBuilderMaterial[];
}

export interface ProductBuilderCatalogueLoadOptions {
  readonly fetch?: (
    input: string | URL | Request,
    init?: RequestInit
  ) => Promise<Response>;
  readonly createDeadlineSignal?: () => AbortSignal;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const portableId = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 100 && PORTABLE_ID.test(value);

const safeTitle = (value: unknown): value is string =>
  typeof value === "string" && value === value.trim() && value.length > 0 &&
  value.length <= 80 && PLAIN_TITLE.test(value) &&
  !URL_LIKE_TITLE.test(value) && !value.includes("..");

const compareIds = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort(compareIds);
  const sortedExpected = [...expected].sort(compareIds);
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function isSortedUniqueIds(values: readonly string[]): boolean {
  return values.every((value, index) =>
    portableId(value) && (index === 0 || values[index - 1]! < value)
  );
}

function parsedIdList(value: unknown, exactLength: number): readonly string[] | null {
  if (!Array.isArray(value) || value.length !== exactLength ||
    !value.every((item): item is string => typeof item === "string") ||
    !isSortedUniqueIds(value)) return null;
  return [...value];
}

const finiteUnit = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

function parsedPoint(value: unknown): ProductBuilderPoint | null {
  const point = record(value);
  if (!point || !hasExactKeys(point, ["x", "y"]) ||
    !finiteUnit(point.x) || !finiteUnit(point.y)) return null;
  return { x: point.x, y: point.y };
}

function parsedBounds(value: unknown): ProductBuilderBounds | null {
  const bounds = record(value);
  if (!bounds || !hasExactKeys(bounds, ["height", "width", "x", "y"]) ||
    !finiteUnit(bounds.x) || !finiteUnit(bounds.y) ||
    !finiteUnit(bounds.width) || bounds.width <= 0 ||
    !finiteUnit(bounds.height) || bounds.height <= 0 ||
    bounds.x + bounds.width > 1 || bounds.y + bounds.height > 1) return null;
  return {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  };
}

interface CatalogueLocation {
  readonly url: URL;
  readonly packId: string;
}

function parsedCatalogueLocation(value: string): CatalogueLocation | null {
  if (ENCODED_PATH_CONTROL.test(value) || RAW_DOT_SEGMENT.test(value) || value.includes("\\")) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const match = CATALOGUE_PATH.exec(url.pathname);
  if ((url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username || url.password || url.search || url.hash || !match) return null;
  return { url, packId: match[1]! };
}

function resolvedPackUrl(
  path: unknown,
  expected: string,
  location: CatalogueLocation
): string | null {
  if (path !== expected) return null;
  const resolved = new URL(expected, location.url);
  return resolved.origin === location.url.origin && !resolved.search && !resolved.hash
    ? resolved.href
    : null;
}

function parsedFamily(value: unknown): ProductBuilderFamily | null {
  const family = record(value);
  if (!family || !hasExactKeys(family, ["componentSlotId", "id", "title"]) ||
    !portableId(family.id) || !safeTitle(family.title) ||
    !portableId(family.componentSlotId)) return null;
  return {
    id: family.id,
    title: family.title,
    componentSlotId: family.componentSlotId
  };
}

function parsedPart(
  value: unknown,
  families: ReadonlyMap<string, ProductBuilderFamily>,
  location: CatalogueLocation
): ProductBuilderPart | null {
  const part = record(value);
  if (!part || !hasExactKeys(part, [
    "componentSvg",
    "familyId",
    "geometryId",
    "id",
    "slotId",
    "title"
  ]) || !portableId(part.id) || !safeTitle(part.title) ||
    !portableId(part.familyId) || !portableId(part.geometryId) ||
    !portableId(part.slotId)) return null;
  const family = families.get(part.familyId);
  const componentUrl = resolvedPackUrl(
    part.componentSvg,
    `components/${part.id}.svg`,
    location
  );
  if (!family || family.componentSlotId !== part.slotId || !componentUrl) return null;
  return {
    id: part.id,
    title: part.title,
    familyId: part.familyId,
    geometryId: part.geometryId,
    slotId: part.slotId,
    componentUrl
  };
}

function parsedBody(
  value: unknown,
  families: ReadonlyMap<string, ProductBuilderFamily>,
  location: CatalogueLocation
): ProductBuilderBody | null {
  const body = record(value);
  if (!body || !hasExactKeys(body, [
    "artworkBounds",
    "authoringSvg",
    "compatiblePartIds",
    "componentAnchor",
    "componentSlotId",
    "familyId",
    "geometryId",
    "id",
    "previewSvg",
    "title"
  ]) || !portableId(body.id) || !safeTitle(body.title) ||
    !portableId(body.familyId) || !portableId(body.geometryId) ||
    !portableId(body.componentSlotId)) return null;
  const family = families.get(body.familyId);
  const compatiblePartIds = parsedIdList(body.compatiblePartIds, 4);
  const componentAnchor = parsedPoint(body.componentAnchor);
  const artworkBounds = parsedBounds(body.artworkBounds);
  const authoringUrl = resolvedPackUrl(
    body.authoringSvg,
    `bodies/${body.id}/authoring.svg`,
    location
  );
  const previewUrl = resolvedPackUrl(
    body.previewSvg,
    `bodies/${body.id}/preview.svg`,
    location
  );
  if (!family || family.componentSlotId !== body.componentSlotId ||
    !compatiblePartIds || !componentAnchor || !artworkBounds ||
    !authoringUrl || !previewUrl) return null;
  return {
    id: body.id,
    title: body.title,
    familyId: body.familyId,
    geometryId: body.geometryId,
    componentSlotId: body.componentSlotId,
    compatiblePartIds,
    componentAnchor,
    artworkBounds,
    authoringUrl,
    previewUrl
  };
}

function parsedPalette(value: unknown): ProductBuilderPalette | null {
  const palette = record(value);
  if (!palette || !hasExactKeys(palette, ["colours", "id", "title"]) ||
    !portableId(palette.id) || !safeTitle(palette.title)) return null;
  const colours = record(palette.colours);
  if (!colours || !hasExactKeys(colours, ["accent", "body", "label", "trim"])) return null;
  const zones = [colours.accent, colours.body, colours.label, colours.trim];
  if (!zones.every((zone): zone is string =>
    typeof zone === "string" && UPPERCASE_HEX_COLOUR.test(zone)
  ) || new Set(zones).size !== 4) return null;
  return {
    id: palette.id,
    title: palette.title,
    colours: {
      accent: colours.accent as string,
      body: colours.body as string,
      label: colours.label as string,
      trim: colours.trim as string
    }
  };
}

function parsedMaterial(value: unknown): ProductBuilderMaterial | null {
  const material = record(value);
  if (!material || !hasExactKeys(material, ["id", "title"]) ||
    !portableId(material.id) || !safeTitle(material.title) ||
    !(MATERIAL_PRESET_IDS as readonly string[]).includes(material.id)) return null;
  return { id: material.id as MaterialPresetId, title: material.title };
}

function uniqueField<T>(values: readonly T[], field: (value: T) => string): boolean {
  return new Set(values.map(field)).size === values.length;
}

function exactSameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): Readonly<T> {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

export function parseProductBuilderCatalogue(
  value: unknown,
  catalogueUrlValue: string
): ProductBuilderCatalogue | null {
  const location = parsedCatalogueLocation(catalogueUrlValue);
  const catalogue = record(value);
  if (!location || !catalogue || !hasExactKeys(catalogue, [
    "bodies",
    "families",
    "materials",
    "packId",
    "palettes",
    "parts",
    "schema",
    "version",
    "virtualCount"
  ]) || catalogue.schema !== "product-builder-catalogue@1" ||
    catalogue.version !== 1 || !portableId(catalogue.packId) ||
    catalogue.packId !== location.packId || catalogue.virtualCount !== 6_144 ||
    !Array.isArray(catalogue.families) || catalogue.families.length !== 3 ||
    !Array.isArray(catalogue.bodies) || catalogue.bodies.length !== 12 ||
    !Array.isArray(catalogue.parts) || catalogue.parts.length !== 12 ||
    !Array.isArray(catalogue.palettes) || catalogue.palettes.length !== 16 ||
    !Array.isArray(catalogue.materials) || catalogue.materials.length !== 8) return null;

  const families = catalogue.families.map(parsedFamily);
  if (families.some((item) => item === null)) return null;
  const validFamilies = families as ProductBuilderFamily[];
  if (!isSortedUniqueIds(validFamilies.map(({ id }) => id)) ||
    !uniqueField(validFamilies, ({ componentSlotId }) => componentSlotId)) return null;
  const familyById = new Map(validFamilies.map((family) => [family.id, family]));

  const parts = catalogue.parts.map((part) => parsedPart(part, familyById, location));
  if (parts.some((item) => item === null)) return null;
  const validParts = parts as ProductBuilderPart[];
  if (!isSortedUniqueIds(validParts.map(({ id }) => id)) ||
    !uniqueField(validParts, ({ geometryId }) => geometryId)) return null;

  const bodies = catalogue.bodies.map((body) => parsedBody(body, familyById, location));
  if (bodies.some((item) => item === null)) return null;
  const validBodies = bodies as ProductBuilderBody[];
  if (!isSortedUniqueIds(validBodies.map(({ id }) => id)) ||
    !uniqueField(validBodies, ({ geometryId }) => geometryId)) return null;

  for (const family of validFamilies) {
    const familyParts = validParts.filter(({ familyId }) => familyId === family.id);
    const familyBodies = validBodies.filter(({ familyId }) => familyId === family.id);
    if (familyParts.length !== 4 || familyBodies.length !== 4) return null;
    const expectedPartIds = familyParts.map(({ id }) => id);
    if (familyBodies.some((body) =>
      body.componentSlotId !== family.componentSlotId ||
      !exactSameIds(body.compatiblePartIds, expectedPartIds)
    )) return null;
  }

  const palettes = catalogue.palettes.map(parsedPalette);
  if (palettes.some((item) => item === null)) return null;
  const validPalettes = palettes as ProductBuilderPalette[];
  if (!isSortedUniqueIds(validPalettes.map(({ id }) => id))) return null;
  const paletteSignatures = validPalettes.map(({ colours }) =>
    [colours.body, colours.trim, colours.accent, colours.label].join("|")
  );
  if (new Set(paletteSignatures).size !== paletteSignatures.length) return null;

  const materials = catalogue.materials.map(parsedMaterial);
  if (materials.some((item) => item === null)) return null;
  const validMaterials = materials as ProductBuilderMaterial[];
  const materialIds = validMaterials.map(({ id }) => id);
  const expectedMaterialIds = [...MATERIAL_PRESET_IDS].sort(compareIds);
  if (!isSortedUniqueIds(materialIds) || !exactSameIds(materialIds, expectedMaterialIds)) return null;

  const computedVirtualCount = validBodies.reduce(
    (sum, body) => sum + body.compatiblePartIds.length * validPalettes.length * validMaterials.length,
    0
  );
  if (computedVirtualCount !== catalogue.virtualCount || computedVirtualCount !== 6_144) return null;

  return deepFreeze({
    schema: "product-builder-catalogue@1" as const,
    version: 1 as const,
    packId: catalogue.packId,
    virtualCount: 6_144 as const,
    families: validFamilies,
    bodies: validBodies,
    parts: validParts,
    palettes: validPalettes,
    materials: validMaterials
  }) as ProductBuilderCatalogue;
}

function safeLoadUrl(value: string): URL | null {
  if (ENCODED_PATH_CONTROL.test(value) || RAW_DOT_SEGMENT.test(value) ||
    value.includes("\\") || value.startsWith("//")) return null;
  let url: URL;
  try {
    url = new URL(value, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin ||
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username || url.password || url.search || url.hash ||
    !CATALOGUE_PATH.test(url.pathname)) return null;
  return url;
}

export async function loadProductBuilderCatalogue(
  value: string | undefined,
  options: ProductBuilderCatalogueLoadOptions = {}
): Promise<ProductBuilderCatalogue | null> {
  if (!value) return null;
  const url = safeLoadUrl(value);
  if (!url) return null;
  try {
    const response = await (options.fetch ?? fetch)(url.href, {
      method: "GET",
      credentials: "omit",
      redirect: "error",
      headers: { accept: "application/json" },
      signal: options.createDeadlineSignal?.() ?? AbortSignal.timeout(LOAD_TIMEOUT_MS)
    });
    if (!response.ok) return null;
    const mediaType = response.headers.get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (mediaType !== "application/json") return null;
    const declaredLength = response.headers.get("content-length");
    if (declaredLength !== null &&
      (!/^\d+$/.test(declaredLength) || Number(declaredLength) > PRODUCT_BUILDER_CATALOGUE_MAX_BYTES)) {
      return null;
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > PRODUCT_BUILDER_CATALOGUE_MAX_BYTES) return null;
    return parseProductBuilderCatalogue(JSON.parse(text), url.href);
  } catch {
    return null;
  }
}
