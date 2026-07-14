const CANONICAL_PATH = "/catalog/generated/logo-icons-v1-reviewed/catalog.json";
const MAX_CATALOGUE_BYTES = 3 * 1024 * 1024;
const MAX_ICONS = 10_000;
const MAX_RESULTS = 60;

const ALLOWED_CATEGORIES = new Set([
  "all",
  "beauty-care",
  "drinks-snacks",
  "fashion-footwear",
  "fast-food-hospitality",
  "general",
  "home-lifestyle",
  "pets-animals",
  "shops-services",
  "sport-outdoors",
  "tech-gadgets",
  "travel-transport"
]);

const ALLOWED_SVG_ELEMENTS = new Set([
  "circle",
  "defs",
  "ellipse",
  "g",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "use"
]);

export interface LogoIconRecord {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly width: number;
  readonly height: number;
  readonly categories: readonly string[];
}

export interface LogoIconCatalogue {
  readonly schema: "logo-icon-catalog@1";
  readonly packId: "tabler-logo-icons-v1";
  readonly version: 1;
  readonly source: Readonly<{
    name: string;
    package: string;
    packageVersion: string;
    sourceVersion: string;
    licence: "MIT";
    url: string;
  }>;
  readonly icons: readonly LogoIconRecord[];
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string, maxLength = 160): string {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function isSafeIconBody(body: string): boolean {
  if (body.length === 0 || body.length > 16_000) return false;
  if (/(?:<\s*(?:script|style|foreignObject|iframe|image|a)\b|\bon[a-z]+\s*=|\bxlink:href\s*=|url\s*\(|javascript\s*:|https?\s*:|data\s*:)/i.test(body)) {
    return false;
  }
  for (const match of body.matchAll(/\bhref\s*=\s*["']([^"']*)["']/gi)) {
    if (!/^#[A-Za-z][A-Za-z0-9_.:-]*$/.test(match[1]!)) return false;
  }
  for (const match of body.matchAll(/<\/?\s*([a-z][a-z0-9]*)\b/gi)) {
    if (!ALLOWED_SVG_ELEMENTS.has(match[1]!.toLowerCase())) return false;
  }
  return /<\s*(?:path|circle|ellipse|line|polygon|polyline|rect)\b/i.test(body);
}

function parseIcon(value: unknown, index: number): LogoIconRecord {
  const input = record(value, `logo icon ${index}`);
  const id = requiredString(input.id, `logo icon ${index} id`, 100);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`logo icon ${index} has an invalid id`);
  }
  const title = requiredString(input.title, `logo icon ${index} title`, 120);
  const body = requiredString(input.body, `logo icon ${index} SVG body`, 16_000);
  if (!isSafeIconBody(body)) throw new Error(`logo icon ${id} has an unsafe SVG body`);
  const width = input.width;
  const height = input.height;
  if (typeof width !== "number" || typeof height !== "number" ||
    !Number.isInteger(width) || !Number.isInteger(height) ||
    width < 1 || height < 1 || width > 512 || height > 512) {
    throw new Error(`logo icon ${id} has invalid dimensions`);
  }
  if (!Array.isArray(input.categories) || input.categories.length === 0 ||
    input.categories.length > 10) {
    throw new Error(`logo icon ${id} has invalid categories`);
  }
  const categories = input.categories.map((category) => {
    const parsed = requiredString(category, `logo icon ${id} category`, 40);
    if (!ALLOWED_CATEGORIES.has(parsed) || parsed === "all") {
      throw new Error(`logo icon ${id} has an unsupported category`);
    }
    return parsed;
  });
  if (new Set(categories).size !== categories.length) {
    throw new Error(`logo icon ${id} has duplicate categories`);
  }
  return Object.freeze({
    id,
    title,
    body,
    width,
    height,
    categories: Object.freeze(categories)
  });
}

export function parseLogoIconCatalogue(value: unknown): LogoIconCatalogue {
  const input = record(value, "logo icon catalogue");
  if (input.schema !== "logo-icon-catalog@1" ||
    input.packId !== "tabler-logo-icons-v1" || input.version !== 1) {
    throw new Error("Logo icon catalogue has an unsupported contract");
  }
  const sourceInput = record(input.source, "logo icon source");
  const source = Object.freeze({
    name: requiredString(sourceInput.name, "logo icon source name"),
    package: requiredString(sourceInput.package, "logo icon source package"),
    packageVersion: requiredString(sourceInput.packageVersion, "logo icon package version"),
    sourceVersion: requiredString(sourceInput.sourceVersion, "logo icon source version"),
    licence: sourceInput.licence === "MIT" ? "MIT" as const : (() => {
      throw new Error("Logo icon source licence must be MIT");
    })(),
    url: requiredString(sourceInput.url, "logo icon source URL", 300)
  });
  if (!Array.isArray(input.icons) || input.icons.length === 0 || input.icons.length > MAX_ICONS) {
    throw new Error(`Logo icon catalogue must contain 1 to ${MAX_ICONS} icons`);
  }
  const icons = input.icons.map(parseIcon);
  const ids = new Set<string>();
  for (const icon of icons) {
    if (ids.has(icon.id)) throw new Error(`Logo icon catalogue has duplicate icon id ${icon.id}`);
    ids.add(icon.id);
  }
  return Object.freeze({
    schema: "logo-icon-catalog@1",
    packId: "tabler-logo-icons-v1",
    version: 1,
    source,
    icons: Object.freeze(icons)
  });
}

export function searchLogoIcons(
  catalogue: LogoIconCatalogue,
  query: string,
  category: string,
  limit = 40
): readonly LogoIconRecord[] {
  if (!ALLOWED_CATEGORIES.has(category)) throw new Error("Unsupported logo icon category");
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RESULTS) {
    throw new Error(`Logo icon result limit must be between 1 and ${MAX_RESULTS}`);
  }
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const candidates = catalogue.icons.filter((icon) =>
    (category === "all" || icon.categories.includes(category)) &&
    terms.every((term) => icon.id.includes(term) || icon.title.toLowerCase().includes(term))
  );
  candidates.sort((left, right) => {
    const queryText = terms.join("-");
    const score = (icon: LogoIconRecord): number => {
      if (!queryText) return 4;
      if (icon.id === queryText || icon.title.toLowerCase() === terms.join(" ")) return 0;
      if (icon.id.startsWith(queryText)) return 1;
      if (icon.id.split("-").some((token) => token.startsWith(terms[0]!))) return 2;
      return 3;
    };
    return score(left) - score(right) || left.id.localeCompare(right.id);
  });
  return Object.freeze(candidates.slice(0, limit));
}

export async function loadLogoIconCatalogue(
  url: string,
  fetcher: typeof fetch = fetch
): Promise<LogoIconCatalogue> {
  const resolved = new URL(url, window.location.origin);
  if (resolved.origin !== window.location.origin || resolved.pathname !== CANONICAL_PATH ||
    resolved.search || resolved.hash) {
    throw new Error("Logo icons must use the same-origin reviewed URL");
  }
  const response = await fetcher(resolved.href, {
    credentials: "same-origin",
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error(`Logo icon catalogue request failed (${response.status})`);
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_CATALOGUE_BYTES) {
    throw new Error("Logo icon catalogue is too large");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Logo icon catalogue is malformed JSON");
  }
  return parseLogoIconCatalogue(parsed);
}
