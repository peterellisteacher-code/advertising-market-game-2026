const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_CATALOGUE_BYTES = 2 * 1024 * 1024;
const LOAD_TIMEOUT_MS = 5_000;

export interface ProductShellFamily {
  id: string;
  title: string;
}

export interface ProductShellRecord {
  id: string;
  title: string;
  family: string;
  template: string;
  authoringUrl: string;
  previewUrl: string;
  regions: string[];
  printAreas: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    safeInset: number;
  }>;
  partSlots: Array<{ id: string; accepts: string[] }>;
  classroomReviewed: true;
  brandFree: true;
}

export interface ProductShellCatalogue {
  schema: "product-shell-catalog@1";
  version: 1;
  packId: string;
  families: ProductShellFamily[];
  shells: ProductShellRecord[];
}

export interface ProductShellLoadOptions {
  fetch?: typeof fetch;
  createDeadlineSignal?: () => AbortSignal;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const portableId = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 100 && PORTABLE_ID.test(value);

const title = (value: unknown): value is string =>
  typeof value === "string" && value === value.trim() && value.length > 0 &&
  value.length <= 160 && !/[\x00-\x1f]/.test(value);

const finiteUnit = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;

function uniquePortableIds(value: unknown, minimum = 1): value is string[] {
  return Array.isArray(value) && value.length >= minimum &&
    value.every(portableId) && new Set(value).size === value.length;
}

function parsedFamily(value: unknown): ProductShellFamily | null {
  const family = record(value);
  if (!family || Object.keys(family).sort().join() !== "id,title" ||
    !portableId(family.id) || !title(family.title)) return null;
  return { id: family.id, title: family.title };
}

function resolvedShellUrl(
  value: unknown,
  shellId: string,
  kind: "authoring" | "preview",
  catalogueUrl: URL
): string | null {
  const expected = `shells/${shellId}/${kind}.svg`;
  if (value !== expected) return null;
  const url = new URL(expected, catalogueUrl);
  return url.origin === catalogueUrl.origin && !url.search && !url.hash
    ? url.href
    : null;
}

function parsedPrintAreas(value: unknown): ProductShellRecord["printAreas"] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 8) return null;
  const ids = new Set<string>();
  const output: ProductShellRecord["printAreas"] = [];
  for (const candidate of value) {
    const area = record(candidate);
    if (!area || !portableId(area.id) || ids.has(area.id) ||
      !finiteUnit(area.x) || !finiteUnit(area.y) ||
      !finiteUnit(area.width) || area.width <= 0 ||
      !finiteUnit(area.height) || area.height <= 0 ||
      !finiteUnit(area.safeInset) ||
      area.x + area.width > 1 || area.y + area.height > 1 ||
      area.safeInset * 2 >= Math.min(area.width, area.height)) return null;
    ids.add(area.id);
    output.push({
      id: area.id,
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
      safeInset: area.safeInset
    });
  }
  return output;
}

function parsedPartSlots(value: unknown): ProductShellRecord["partSlots"] | null {
  if (!Array.isArray(value) || value.length > 16) return null;
  const ids = new Set<string>();
  const output: ProductShellRecord["partSlots"] = [];
  for (const candidate of value) {
    const slot = record(candidate);
    if (!slot || !portableId(slot.id) || ids.has(slot.id) ||
      !uniquePortableIds(slot.accepts)) return null;
    ids.add(slot.id);
    output.push({ id: slot.id, accepts: [...slot.accepts] });
  }
  return output;
}

function parsedShell(
  value: unknown,
  familyIds: Set<string>,
  catalogueUrl: URL
): ProductShellRecord | null {
  const shell = record(value);
  if (!shell || !portableId(shell.id) || !title(shell.title) ||
    !portableId(shell.family) || !familyIds.has(shell.family) ||
    !portableId(shell.template) || shell.classroomReviewed !== true ||
    shell.brandFree !== true || !uniquePortableIds(shell.regions) ||
    !(shell.regions as string[]).includes("body")) return null;
  const authoringUrl = resolvedShellUrl(shell.authoringSvg, shell.id, "authoring", catalogueUrl);
  const previewUrl = resolvedShellUrl(shell.previewSvg, shell.id, "preview", catalogueUrl);
  const printAreas = parsedPrintAreas(shell.printAreas);
  const partSlots = parsedPartSlots(shell.partSlots);
  const preview = record(shell.preview);
  if (!authoringUrl || !previewUrl || !printAreas || !partSlots || !preview ||
    preview.kind !== "soft-2.5d" || !finiteUnit(preview.highlight) ||
    !finiteUnit(preview.shadow)) return null;
  return {
    id: shell.id,
    title: shell.title,
    family: shell.family,
    template: shell.template,
    authoringUrl,
    previewUrl,
    regions: [...shell.regions] as string[],
    printAreas,
    partSlots,
    classroomReviewed: true,
    brandFree: true
  };
}

export function parseProductShellCatalogue(
  value: unknown,
  catalogueUrlValue: string
): ProductShellCatalogue | null {
  let catalogueUrl: URL;
  try {
    catalogueUrl = new URL(catalogueUrlValue);
  } catch {
    return null;
  }
  const catalogue = record(value);
  if (!catalogue || catalogue.schema !== "product-shell-catalog@1" ||
    catalogue.version !== 1 || !portableId(catalogue.packId) ||
    !Array.isArray(catalogue.families) || catalogue.families.length !== 10 ||
    !Array.isArray(catalogue.shells) || catalogue.shells.length < 60 ||
    catalogue.shells.length > 500) return null;
  const families = catalogue.families.map(parsedFamily);
  if (families.some((family) => family === null)) return null;
  const validFamilies = families as ProductShellFamily[];
  const familyIds = new Set(validFamilies.map(({ id }) => id));
  if (familyIds.size !== 10) return null;
  const shells = catalogue.shells.map((shell) => parsedShell(shell, familyIds, catalogueUrl));
  if (shells.some((shell) => shell === null)) return null;
  const validShells = shells as ProductShellRecord[];
  if (new Set(validShells.map(({ id }) => id)).size !== validShells.length ||
    new Set(validShells.map(({ family }) => family)).size !== 10) return null;
  return {
    schema: "product-shell-catalog@1",
    version: 1,
    packId: catalogue.packId,
    families: validFamilies,
    shells: validShells
  };
}

export async function loadProductShellCatalogue(
  value: string | undefined,
  options: ProductShellLoadOptions = {}
): Promise<ProductShellCatalogue | null> {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin ||
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    !url.pathname.startsWith("/catalog/generated/") ||
    !url.pathname.endsWith("/catalog.json") || url.search || url.hash) return null;
  try {
    const response = await (options.fetch ?? fetch)(url.href, {
      method: "GET",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal: options.createDeadlineSignal?.() ?? AbortSignal.timeout(LOAD_TIMEOUT_MS)
    });
    if (!response.ok) return null;
    const length = response.headers.get("content-length");
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_CATALOGUE_BYTES)) {
      return null;
    }
    return parseProductShellCatalogue(await response.json(), url.href);
  } catch {
    return null;
  }
}
