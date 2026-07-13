import type {
  ProductBuilderBody,
  ProductBuilderBounds,
  ProductBuilderCatalogue,
  ProductBuilderColours,
  ProductBuilderMaterial,
  ProductBuilderPalette,
  ProductBuilderPart,
  ProductBuilderPoint
} from "./product-builder-catalogue";

export const MAX_VARIANT_PAGE_SIZE = 72;

export interface ProductVariantSelection {
  readonly bodyId: string;
  readonly partId: string;
  readonly paletteId: string;
  readonly materialId: string;
}

export interface ProductVariantFilters {
  readonly familyId?: string;
  readonly bodyId?: string;
  readonly partId?: string;
  readonly paletteId?: string;
  readonly materialId?: string;
}

export interface ProductVariantPageRequest {
  readonly offset?: number;
  readonly limit?: number;
}

export interface ResolvedProductVariant {
  readonly schema: "product-builder-variant@1";
  readonly id: string;
  readonly packId: string;
  readonly familyId: string;
  readonly bodyId: string;
  readonly partId: string;
  readonly paletteId: string;
  readonly materialId: string;
  readonly bodyTitle: string;
  readonly partTitle: string;
  readonly paletteTitle: string;
  readonly materialTitle: string;
  readonly componentSlotId: string;
  readonly authoringUrl: string;
  readonly previewUrl: string;
  readonly componentUrl: string;
  readonly componentAnchor: ProductBuilderPoint;
  readonly artworkBounds: ProductBuilderBounds;
  readonly colours: ProductBuilderColours;
}

export interface ProductVariantPage {
  readonly offset: number;
  readonly limit: number;
  readonly total: number;
  readonly items: readonly ResolvedProductVariant[];
}

export interface VirtualProductVariantResolver {
  readonly resolveVariant: (
    selection: ProductVariantSelection
  ) => ResolvedProductVariant | null;
  readonly countVariants: (filters?: ProductVariantFilters) => number;
  readonly pageVariants: (
    filters?: ProductVariantFilters,
    page?: ProductVariantPageRequest
  ) => ProductVariantPage;
}

interface VariantIndices {
  readonly packId: string;
  readonly families: ReadonlyMap<string, true>;
  readonly bodies: readonly ProductBuilderBody[];
  readonly bodyById: ReadonlyMap<string, ProductBuilderBody>;
  readonly partById: ReadonlyMap<string, ProductBuilderPart>;
  readonly palettes: readonly ProductBuilderPalette[];
  readonly paletteById: ReadonlyMap<string, ProductBuilderPalette>;
  readonly materials: readonly ProductBuilderMaterial[];
  readonly materialById: ReadonlyMap<string, ProductBuilderMaterial>;
}

const FILTER_KEYS = new Set([
  "bodyId",
  "familyId",
  "materialId",
  "paletteId",
  "partId"
]);
const SELECTION_KEYS = ["bodyId", "materialId", "paletteId", "partId"];
const PAGE_KEYS = new Set(["limit", "offset"]);

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

function parsedFilters(value: ProductVariantFilters | undefined): ProductVariantFilters | null {
  if (value === undefined) return {};
  const candidate = record(value);
  if (!candidate || Object.keys(candidate).some((key) => !FILTER_KEYS.has(key)) ||
    Object.values(candidate).some((item) => item !== undefined && typeof item !== "string")) {
    return null;
  }
  return value;
}

function parsedSelection(value: ProductVariantSelection): ProductVariantSelection | null {
  const candidate = record(value);
  if (!candidate || Object.keys(candidate).sort().join("|") !== SELECTION_KEYS.join("|") ||
    !SELECTION_KEYS.every((key) => typeof candidate[key] === "string")) return null;
  return value;
}

function parsedPageRequest(value: ProductVariantPageRequest): ProductVariantPageRequest | null {
  const candidate = record(value);
  if (!candidate || Object.keys(candidate).some((key) => !PAGE_KEYS.has(key)) ||
    Object.values(candidate).some((item) => item !== undefined && typeof item !== "number")) {
    return null;
  }
  return value;
}

function normalizedOffset(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function normalizedLimit(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return MAX_VARIANT_PAGE_SIZE;
  return Math.min(MAX_VARIANT_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

function frozenVariant(
  indices: VariantIndices,
  body: ProductBuilderBody,
  part: ProductBuilderPart,
  palette: ProductBuilderPalette,
  material: ProductBuilderMaterial
): ResolvedProductVariant {
  const componentAnchor = Object.freeze({ ...body.componentAnchor });
  const artworkBounds = Object.freeze({ ...body.artworkBounds });
  const colours = Object.freeze({ ...palette.colours });
  return Object.freeze({
    schema: "product-builder-variant@1" as const,
    id: [
      "product-builder-variant@1",
      indices.packId,
      body.id,
      part.id,
      palette.id,
      material.id
    ].join(":"),
    packId: indices.packId,
    familyId: body.familyId,
    bodyId: body.id,
    partId: part.id,
    paletteId: palette.id,
    materialId: material.id,
    bodyTitle: body.title,
    partTitle: part.title,
    paletteTitle: palette.title,
    materialTitle: material.title,
    componentSlotId: body.componentSlotId,
    authoringUrl: body.authoringUrl,
    previewUrl: body.previewUrl,
    componentUrl: part.componentUrl,
    componentAnchor,
    artworkBounds,
    colours
  });
}

function compatible(
  body: ProductBuilderBody,
  part: ProductBuilderPart
): boolean {
  return part.familyId === body.familyId &&
    part.slotId === body.componentSlotId &&
    body.compatiblePartIds.includes(part.id);
}

function filtersExist(indices: VariantIndices, filters: ProductVariantFilters): boolean {
  return (filters.familyId === undefined || indices.families.has(filters.familyId)) &&
    (filters.bodyId === undefined || indices.bodyById.has(filters.bodyId)) &&
    (filters.partId === undefined || indices.partById.has(filters.partId)) &&
    (filters.paletteId === undefined || indices.paletteById.has(filters.paletteId)) &&
    (filters.materialId === undefined || indices.materialById.has(filters.materialId));
}

function bodyMatches(body: ProductBuilderBody, filters: ProductVariantFilters): boolean {
  return (filters.familyId === undefined || body.familyId === filters.familyId) &&
    (filters.bodyId === undefined || body.id === filters.bodyId);
}

function partMatches(part: ProductBuilderPart, filters: ProductVariantFilters): boolean {
  return filters.partId === undefined || part.id === filters.partId;
}

function paletteMatches(
  palette: ProductBuilderPalette,
  filters: ProductVariantFilters
): boolean {
  return filters.paletteId === undefined || palette.id === filters.paletteId;
}

function materialMatches(
  material: ProductBuilderMaterial,
  filters: ProductVariantFilters
): boolean {
  return filters.materialId === undefined || material.id === filters.materialId;
}

export function createVirtualProductVariantResolver(
  catalogue: ProductBuilderCatalogue
): VirtualProductVariantResolver {
  const packId = catalogue.packId;
  const familyRows = catalogue.families;
  const bodies = catalogue.bodies;
  const partRows = catalogue.parts;
  const palettes = catalogue.palettes;
  const materials = catalogue.materials;
  const indices: VariantIndices = {
    packId,
    families: new Map(familyRows.map(({ id }) => [id, true] as const)),
    bodies,
    bodyById: new Map(bodies.map((body) => [body.id, body])),
    partById: new Map(partRows.map((part) => [part.id, part])),
    palettes,
    paletteById: new Map(palettes.map((palette) => [palette.id, palette])),
    materials,
    materialById: new Map(materials.map((material) => [material.id, material]))
  };

  const resolveVariant = (
    selectionValue: ProductVariantSelection
  ): ResolvedProductVariant | null => {
    const selection = parsedSelection(selectionValue);
    if (!selection) return null;
    const body = indices.bodyById.get(selection.bodyId);
    const part = indices.partById.get(selection.partId);
    const palette = indices.paletteById.get(selection.paletteId);
    const material = indices.materialById.get(selection.materialId);
    if (!body || !part || !palette || !material || !compatible(body, part)) return null;
    return frozenVariant(indices, body, part, palette, material);
  };

  const countVariants = (filtersValue?: ProductVariantFilters): number => {
    const filters = parsedFilters(filtersValue);
    if (!filters || !filtersExist(indices, filters)) return 0;
    const paletteCount = filters.paletteId === undefined ? indices.palettes.length : 1;
    const materialCount = filters.materialId === undefined ? indices.materials.length : 1;
    let count = 0;
    for (const body of indices.bodies) {
      if (!bodyMatches(body, filters)) continue;
      const partCount = body.compatiblePartIds.reduce((total, partId) => {
        const part = indices.partById.get(partId);
        return total + (part && partMatches(part, filters) ? 1 : 0);
      }, 0);
      count += partCount * paletteCount * materialCount;
    }
    return count;
  };

  const pageVariants = (
    filtersValue: ProductVariantFilters = {},
    page: ProductVariantPageRequest = {}
  ): ProductVariantPage => {
    const filters = parsedFilters(filtersValue);
    const pageRequest = parsedPageRequest(page);
    if (!pageRequest) {
      return Object.freeze({
        offset: 0,
        limit: MAX_VARIANT_PAGE_SIZE,
        total: 0,
        items: Object.freeze([])
      });
    }
    const offset = normalizedOffset(pageRequest.offset);
    const limit = normalizedLimit(pageRequest.limit);
    if (!filters || !filtersExist(indices, filters)) {
      return Object.freeze({ offset, limit, total: 0, items: Object.freeze([]) });
    }
    const total = countVariants(filters);
    const items: ResolvedProductVariant[] = [];
    let matchingIndex = 0;
    outer: for (const body of indices.bodies) {
      if (!bodyMatches(body, filters)) continue;
      for (const partId of body.compatiblePartIds) {
        const part = indices.partById.get(partId);
        if (!part || !partMatches(part, filters)) continue;
        for (const palette of indices.palettes) {
          if (!paletteMatches(palette, filters)) continue;
          for (const material of indices.materials) {
            if (!materialMatches(material, filters)) continue;
            if (matchingIndex >= offset) {
              items.push(frozenVariant(indices, body, part, palette, material));
              if (items.length === limit) break outer;
            }
            matchingIndex += 1;
          }
        }
      }
    }
    return Object.freeze({
      offset,
      limit,
      total,
      items: Object.freeze(items)
    });
  };

  return Object.freeze({ resolveVariant, countVariants, pageVariants });
}
