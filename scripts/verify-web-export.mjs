import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isSafeColourableSvgBody } from "./logo-icon-svg-safety.mjs";
import { assertPathHasNoIndirection } from "./filesystem-safety.mjs";
import { inspectHtmlAttribute } from "./html-start-tags.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const STALE_SPIKE_PCK_HASH =
  "e8b1d3f2729a16f0d001f8b1483aa4fbc150dcb1b3411b5aacd7456b6cb92459";
const REQUIRED_FILES = [
  "index.html",
  "index.js",
  "index.wasm",
  "index.pck",
  "studio/studio.css",
  "studio/studio.js"
];
const PRODUCT_SHELL_PREFIX = "catalog/generated/product-shells-v1-reviewed";
const PRODUCT_BUILDER_PREFIX = "catalog/generated/product-builder-pilot-v1";
const LOGO_ICON_PREFIX = "catalog/generated/logo-icons-v1-reviewed";
const LOGO_ICON_COUNT = 4205;
const MAX_LOGO_CATALOGUE_BYTES = 3 * 1024 * 1024;
const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOGO_ICON_CATEGORIES = new Set([
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

function asText(value) {
  return typeof value === "string" ? value : Buffer.isBuffer(value) ? value.toString("utf8") : "";
}

function count(text, pattern) {
  return text.match(pattern)?.length ?? 0;
}

function verifyOfflineCatalogue(files, errors) {
  const catalogPath = "catalog/generated/offline-core-v1/catalog.json";
  if (!files.has(catalogPath)) return;
  let records;
  try {
    records = JSON.parse(asText(files.get(catalogPath)));
  } catch {
    errors.push("offline catalogue JSON is malformed");
    return;
  }
  if (!Array.isArray(records) || records.length > 20_000) {
    errors.push("offline catalogue must be an array of at most 20000 records");
    return;
  }
  for (const [index, record] of records.entries()) {
    if (!record || typeof record !== "object" || Array.isArray(record) ||
      !record.files || typeof record.files !== "object" || Array.isArray(record.files)) {
      errors.push(`offline catalogue record ${index} has no file contract`);
      continue;
    }
    const references = [record.files.master, record.files.preview, record.files.thumbnail];
    if (record.files.masks && typeof record.files.masks === "object" && !Array.isArray(record.files.masks)) {
      references.push(...Object.values(record.files.masks));
    }
    for (const reference of references) {
      if (typeof reference !== "string" ||
        !reference.startsWith("/catalog/generated/offline-core-v1/") ||
        reference.includes("\\") || reference.includes("..") || reference.includes("?") || reference.includes("#")) {
        errors.push(`offline catalogue record ${index} has a noncanonical file reference`);
        continue;
      }
      if (!files.has(reference.slice(1))) {
        errors.push(`offline catalogue references missing file: ${reference}`);
      }
    }
    const masterKey = typeof record.files.master === "string" ? record.files.master.slice(1) : "";
    const master = files.get(masterKey);
    if (typeof record.masterSha256 !== "string" || !/^[0-9a-f]{64}$/.test(record.masterSha256)) {
      errors.push(`offline catalogue record ${index} has no valid masterSha256`);
    } else if (master !== undefined) {
      const bytes = Buffer.isBuffer(master) ? master : Buffer.from(String(master));
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (actual !== record.masterSha256) {
        errors.push(`offline catalogue master hash mismatch: ${record.files.master}`);
      }
    }
  }
}

function verifyProductShellCatalogue(files, errors) {
  const catalogPath = `${PRODUCT_SHELL_PREFIX}/catalog.json`;
  if (!files.has(catalogPath)) return;
  let catalog;
  try {
    catalog = JSON.parse(asText(files.get(catalogPath)));
  } catch {
    errors.push("product shell catalogue JSON is malformed");
    return;
  }
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog) ||
    catalog.schema !== "product-shell-catalog@1" ||
    !Array.isArray(catalog.shells) || catalog.shells.length > 5_000) {
    errors.push("product shell catalogue has an invalid catalog contract");
    return;
  }
  const ids = new Set();
  for (const [index, shell] of catalog.shells.entries()) {
    if (!shell || typeof shell !== "object" || Array.isArray(shell) ||
      typeof shell.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(shell.id) ||
      ids.has(shell.id)) {
      errors.push(`product shell catalogue record ${index} has an invalid or duplicate id`);
      continue;
    }
    ids.add(shell.id);
    for (const field of ["authoringSvg", "previewSvg"]) {
      const reference = shell[field];
      if (typeof reference !== "string" ||
        !/^shells\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:authoring|preview)\.svg$/.test(reference) ||
        reference.includes("..")) {
        errors.push(`product shell catalogue record ${index} has a noncanonical ${field}`);
        continue;
      }
      const expectedName = field === "authoringSvg" ? "authoring.svg" : "preview.svg";
      if (!reference.endsWith(`/${expectedName}`)) {
        errors.push(`product shell catalogue record ${index} has a mismatched ${field}`);
      } else if (!files.has(`${PRODUCT_SHELL_PREFIX}/${reference}`)) {
        errors.push(`product shell catalogue references missing file: ${reference}`);
      }
    }
  }
}

function verifyProductShellMetadata(html, files, errors) {
  const catalogPath = `${PRODUCT_SHELL_PREFIX}/catalog.json`;
  const attribute = /\bdata-product-shell-catalogue-url\s*=\s*["'][^"']*["']/gi;
  const attributes = html.match(attribute) ?? [];
  const expected = `data-product-shell-catalogue-url="/${catalogPath}"`;
  if (files.has(catalogPath)) {
    if (attributes.length !== 1 || attributes[0] !== expected) {
      errors.push("index.html must reference the reviewed product shell catalogue exactly once");
    }
  } else if (attributes.length > 0) {
    errors.push("index.html references an absent product shell catalogue");
  }
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function collectUniqueIds(records, label, errors) {
  const ids = new Set();
  for (const [index, record] of records.entries()) {
    if (!isRecord(record) || typeof record.id !== "string" ||
      !PORTABLE_ID.test(record.id) || ids.has(record.id)) {
      errors.push(`product builder catalogue has an invalid or duplicate ${label} id at record ${index}`);
      continue;
    }
    ids.add(record.id);
  }
  return ids;
}

function verifyProductBuilderCatalogue(files, errors) {
  const cataloguePath = `${PRODUCT_BUILDER_PREFIX}/catalogue.json`;
  if (!files.has(cataloguePath)) return;
  let catalogue;
  try {
    catalogue = JSON.parse(asText(files.get(cataloguePath)));
  } catch {
    errors.push("product builder catalogue JSON is malformed");
    return;
  }
  if (!isRecord(catalogue) || catalogue.schema !== "product-builder-catalogue@1" ||
    catalogue.version !== 1 || catalogue.packId !== "product-builder-pilot-v1") {
    errors.push("product builder catalogue has an invalid schema, version, or pack ID");
    return;
  }

  const fixedCounts = [
    ["families", 3],
    ["bodies", 12],
    ["parts", 12],
    ["palettes", 16],
    ["materials", 8]
  ];
  for (const [field, expected] of fixedCounts) {
    if (!Array.isArray(catalogue[field]) || catalogue[field].length !== expected) {
      errors.push(`product builder catalogue must contain exactly ${expected} ${field}`);
    }
  }
  if (fixedCounts.some(([field]) => !Array.isArray(catalogue[field]))) return;
  if (catalogue.virtualCount !== 6144) {
    errors.push("product builder catalogue virtualCount must equal 6144");
  }

  const familyIds = collectUniqueIds(catalogue.families, "family", errors);
  const bodyIds = collectUniqueIds(catalogue.bodies, "body", errors);
  const partIds = collectUniqueIds(catalogue.parts, "part", errors);
  collectUniqueIds(catalogue.palettes, "palette", errors);
  collectUniqueIds(catalogue.materials, "material", errors);

  const families = new Map();
  for (const family of catalogue.families) {
    if (!isRecord(family) || !familyIds.has(family.id) ||
      typeof family.componentSlotId !== "string" || !PORTABLE_ID.test(family.componentSlotId)) {
      errors.push("product builder catalogue has an invalid family slot");
      continue;
    }
    families.set(family.id, family);
  }

  const partsByFamily = new Map([...familyIds].map((id) => [id, []]));
  for (const [index, part] of catalogue.parts.entries()) {
    if (!isRecord(part) || !partIds.has(part.id)) continue;
    const family = families.get(part.familyId);
    if (!family || part.slotId !== family.componentSlotId) {
      errors.push(`product builder catalogue part ${index} has an incompatible family or slot`);
      continue;
    }
    const expectedPath = `components/${part.id}.svg`;
    if (part.componentSvg !== expectedPath) {
      errors.push(`product builder catalogue part ${index} has a noncanonical componentSvg`);
    } else if (!files.has(`${PRODUCT_BUILDER_PREFIX}/${expectedPath}`)) {
      errors.push(`product builder catalogue references missing file: ${expectedPath}`);
    }
    partsByFamily.get(part.familyId)?.push(part);
  }

  const bodiesByFamily = new Map([...familyIds].map((id) => [id, []]));
  for (const [index, body] of catalogue.bodies.entries()) {
    if (!isRecord(body) || !bodyIds.has(body.id)) continue;
    const family = families.get(body.familyId);
    if (!family || body.componentSlotId !== family.componentSlotId) {
      errors.push(`product builder catalogue body ${index} has an incompatible family or slot`);
    } else {
      bodiesByFamily.get(body.familyId)?.push(body);
    }
    for (const [field, fileName] of [["authoringSvg", "authoring.svg"], ["previewSvg", "preview.svg"]]) {
      const expectedPath = `bodies/${body.id}/${fileName}`;
      if (body[field] !== expectedPath) {
        errors.push(`product builder catalogue body ${index} has a noncanonical ${field}`);
      } else if (!files.has(`${PRODUCT_BUILDER_PREFIX}/${expectedPath}`)) {
        errors.push(`product builder catalogue references missing file: ${expectedPath}`);
      }
    }
  }

  for (const familyId of familyIds) {
    const familyParts = partsByFamily.get(familyId) ?? [];
    const familyBodies = bodiesByFamily.get(familyId) ?? [];
    if (familyParts.length !== 4 || familyBodies.length !== 4) {
      errors.push(`product builder catalogue family ${familyId} must bind four bodies and four parts`);
    }
    const expectedPartIds = new Set(familyParts.map((part) => part.id));
    for (const body of familyBodies) {
      const compatible = Array.isArray(body.compatiblePartIds) ? body.compatiblePartIds : [];
      const compatibleIds = new Set(compatible);
      if (compatible.length !== 4 || compatibleIds.size !== 4 ||
        [...expectedPartIds].some((id) => !compatibleIds.has(id)) ||
        [...compatibleIds].some((id) => !expectedPartIds.has(id))) {
        errors.push(`product builder catalogue body ${body.id} has an incompatible part graph`);
      }
    }
  }

  const computedVirtualCount = catalogue.bodies.reduce((total, body) =>
    total + (Array.isArray(body?.compatiblePartIds) ? body.compatiblePartIds.length : 0) *
      catalogue.palettes.length * catalogue.materials.length, 0);
  if (computedVirtualCount !== 6144 || catalogue.virtualCount !== computedVirtualCount) {
    errors.push("product builder catalogue count graph does not resolve exactly 6144 variants");
  }
}

function verifyProductBuilderQa(files, errors) {
  const qaPath = `${PRODUCT_BUILDER_PREFIX}/qa.json`;
  const sourcePath = `${PRODUCT_BUILDER_PREFIX}/source.json`;
  if (!files.has(qaPath)) {
    errors.push("missing product builder QA record: qa.json");
    return;
  }
  if (!files.has(sourcePath)) errors.push("missing product builder source snapshot: source.json");

  let qa;
  try {
    qa = JSON.parse(asText(files.get(qaPath)));
  } catch {
    errors.push("product builder QA JSON is malformed");
    return;
  }
  if (isRecord(qa?.sha256) && Object.hasOwn(qa.sha256, "qa.json")) {
    errors.push("product builder QA must not hash qa.json");
  }
  if (!isRecord(qa) || qa.schema !== "product-builder-qa@1" ||
    qa.packId !== "product-builder-pilot-v1" || qa.bodyCount !== 12 ||
    qa.componentCount !== 12 || qa.renderedSvgCount !== 36 ||
    qa.virtualCount !== 6144 || qa.fileCount !== 39 || !isRecord(qa.sha256)) {
    errors.push("product builder QA record has invalid metadata or counts");
    return;
  }

  let catalogue;
  try {
    catalogue = JSON.parse(asText(files.get(`${PRODUCT_BUILDER_PREFIX}/catalogue.json`)));
  } catch {
    return;
  }
  if (!isRecord(catalogue) || !Array.isArray(catalogue.bodies) || !Array.isArray(catalogue.parts)) return;
  const expectedRelativePaths = [
    "catalogue.json",
    "source.json",
    ...catalogue.bodies.flatMap((body) => [body.authoringSvg, body.previewSvg]),
    ...catalogue.parts.map((part) => part.componentSvg)
  ];
  const expected = new Set(expectedRelativePaths);
  if (expected.size !== 38) {
    errors.push("product builder QA must cover exactly 38 declared non-self files");
    return;
  }
  for (const relative of Object.keys(qa.sha256)) {
    if (!expected.has(relative)) {
      errors.push(`product builder QA hashes an unknown or self file: ${relative}`);
    }
  }
  for (const relative of expectedRelativePaths) {
    const declared = qa.sha256[relative];
    if (typeof declared !== "string" || !/^[0-9a-f]{64}$/.test(declared)) {
      errors.push(`product builder QA has no valid hash for: ${relative}`);
      continue;
    }
    const value = files.get(`${PRODUCT_BUILDER_PREFIX}/${relative}`);
    if (value === undefined) continue;
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== declared) {
      errors.push(`product builder QA hash mismatch: ${relative}`);
    }
  }
}

function verifyProductBuilderMetadata(html, files, errors) {
  const cataloguePath = `${PRODUCT_BUILDER_PREFIX}/catalogue.json`;
  const attributePattern = /\bdata-product-builder-catalogue-url\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi;
  const attributes = html.match(attributePattern) ?? [];
  if (!files.has(cataloguePath)) {
    if (attributes.length > 0) {
      errors.push("index.html references an absent product builder catalogue");
    }
    return;
  }

  const expected = `data-product-builder-catalogue-url="/${cataloguePath}"`;
  if (attributes.length !== 1) {
    errors.push("index.html must reference the product builder catalogue exactly once");
    return;
  }
  if (attributes[0] !== expected) {
    errors.push("index.html must use the canonical product builder catalogue URL");
  }
  const creatorRoot = html.match(/<[a-z][^>]*\bid\s*=\s*["']creator-root["'][^>]*>/i)?.[0] ?? "";
  if (!creatorRoot.includes(expected)) {
    errors.push("product builder catalogue metadata must be on #creator-root");
  }
}

function verifyLogoIconCatalogue(files, errors) {
  const cataloguePath = `${LOGO_ICON_PREFIX}/catalog.json`;
  const raw = files.get(cataloguePath);
  if (raw === undefined) return;
  const bytes = Buffer.isBuffer(raw) ? raw.byteLength : Buffer.byteLength(String(raw));
  if (bytes > MAX_LOGO_CATALOGUE_BYTES) {
    errors.push("logo icon catalogue exceeds 3 MiB");
    return;
  }

  let catalogue;
  try {
    catalogue = JSON.parse(asText(raw));
  } catch {
    errors.push("logo icon catalogue JSON is malformed");
    return;
  }
  if (!isRecord(catalogue) || catalogue.schema !== "logo-icon-catalog@1" ||
    catalogue.packId !== "tabler-logo-icons-v1" || catalogue.version !== 1) {
    errors.push("logo icon catalogue has an invalid schema, version, or pack ID");
    return;
  }
  const expectedSource = {
    name: "Tabler Icons",
    package: "@iconify-json/tabler",
    packageVersion: "1.2.35",
    sourceVersion: "3.44.0",
    licence: "MIT",
    url: "https://github.com/tabler/tabler-icons"
  };
  if (!isRecord(catalogue.source) || Object.entries(expectedSource)
    .some(([key, value]) => catalogue.source[key] !== value)) {
    errors.push("logo icon catalogue does not match pinned source metadata");
  }
  if (!Array.isArray(catalogue.icons) || catalogue.icons.length !== LOGO_ICON_COUNT) {
    errors.push(`logo icon catalogue must contain exactly ${LOGO_ICON_COUNT} icons`);
    if (!Array.isArray(catalogue.icons)) return;
  }

  const ids = new Set();
  for (const [index, icon] of catalogue.icons.entries()) {
    if (!isRecord(icon) || typeof icon.id !== "string" || icon.id.length > 100 ||
      !PORTABLE_ID.test(icon.id) || ids.has(icon.id)) {
      errors.push(`logo icon catalogue has an invalid or duplicate icon id at record ${index}`);
      continue;
    }
    ids.add(icon.id);
    if (icon.id.startsWith("brand-")) {
      errors.push(`logo icon catalogue contains a brand icon at record ${index}`);
    }
    if (typeof icon.title !== "string" || !icon.title.trim() || icon.title.length > 120) {
      errors.push(`logo icon catalogue record ${index} has an invalid title`);
    }
    if (!isSafeColourableSvgBody(icon.body)) {
      errors.push(`logo icon catalogue record ${index} has an unsafe or non-colourable SVG body`);
    }
    if (!Number.isInteger(icon.width) || !Number.isInteger(icon.height) ||
      icon.width < 1 || icon.height < 1 || icon.width > 512 || icon.height > 512) {
      errors.push(`logo icon catalogue record ${index} has invalid dimensions`);
    }
    if (!Array.isArray(icon.categories) || icon.categories.length < 1 ||
      icon.categories.length > 10 || new Set(icon.categories).size !== icon.categories.length ||
      icon.categories.some((category) => typeof category !== "string" ||
        !LOGO_ICON_CATEGORIES.has(category))) {
      errors.push(`logo icon catalogue record ${index} has invalid categories`);
    }
  }
}

function verifyLogoIconMetadata(html, files, errors) {
  const cataloguePath = `${LOGO_ICON_PREFIX}/catalog.json`;
  let inspection;
  try {
    inspection = inspectHtmlAttribute(html, "data-logo-icon-catalogue-url");
  } catch (error) {
    errors.push(`index.html logo metadata cannot be parsed: ${error instanceof Error ? error.message : error}`);
    return;
  }
  const { creatorRoots, occurrences } = inspection;
  if (!files.has(cataloguePath)) {
    if (occurrences.length > 0) errors.push("index.html references an absent logo icon catalogue");
    return;
  }
  const expected = `data-logo-icon-catalogue-url="/${cataloguePath}"`;
  if (occurrences.length !== 1) {
    errors.push("index.html must reference the logo icon catalogue exactly once");
    return;
  }
  const occurrence = occurrences[0];
  if (occurrence.attribute.raw !== expected ||
    occurrence.attribute.value !== `/${cataloguePath}`) {
    errors.push("index.html must use the canonical logo icon catalogue URL");
  }
  if (creatorRoots.length !== 1 || !occurrence.onCreatorRoot) {
    errors.push("logo icon catalogue metadata must be on #creator-root");
  }
}

/** Verifies a complete offline-core directory without requiring a Godot shell. */
export async function verifyOfflineCoreDirectory(directory) {
  const prefix = "catalog/generated/offline-core-v1";
  const files = await readTreeIfPresent(directory, prefix);
  if (!files.has(`${prefix}/catalog.json`)) {
    throw new Error("Offline catalogue verification failed:\n- missing offline catalogue: catalog.json");
  }
  const errors = [];
  verifyOfflineCatalogue(files, errors);
  if (errors.length > 0) {
    throw new Error(`Offline catalogue verification failed:\n- ${errors.join("\n- ")}`);
  }
  return files;
}

/** Verifies a complete reviewed product-shell directory without requiring a Godot shell. */
export async function verifyProductShellDirectory(directory) {
  const files = await readTreeIfPresent(directory, PRODUCT_SHELL_PREFIX);
  if (!files.has(`${PRODUCT_SHELL_PREFIX}/catalog.json`)) {
    throw new Error("Product shell verification failed:\n- missing product shell catalogue: catalog.json");
  }
  const errors = [];
  verifyProductShellCatalogue(files, errors);
  if (errors.length > 0) {
    throw new Error(`Product shell verification failed:\n- ${errors.join("\n- ")}`);
  }
  return files;
}

/** Verifies the complete product-builder pilot without requiring a Godot shell. */
export async function verifyProductBuilderDirectory(directory) {
  const files = await readTreeIfPresent(directory, PRODUCT_BUILDER_PREFIX);
  if (!files.has(`${PRODUCT_BUILDER_PREFIX}/catalogue.json`)) {
    throw new Error("Product builder verification failed:\n- missing product builder catalogue: catalogue.json");
  }
  const errors = [];
  verifyProductBuilderCatalogue(files, errors);
  verifyProductBuilderQa(files, errors);
  if (errors.length > 0) {
    throw new Error(`Product builder verification failed:\n- ${errors.join("\n- ")}`);
  }
  return files;
}

/** Verifies the pinned reviewed logo-icon pack without requiring a Godot shell. */
export async function verifyLogoIconDirectory(directory) {
  const files = await readTreeIfPresent(directory, LOGO_ICON_PREFIX);
  if (!files.has(`${LOGO_ICON_PREFIX}/catalog.json`)) {
    throw new Error("Logo icon verification failed:\n- missing logo icon catalogue: catalog.json");
  }
  const errors = [];
  verifyLogoIconCatalogue(files, errors);
  if (errors.length > 0) {
    throw new Error(`Logo icon verification failed:\n- ${errors.join("\n- ")}`);
  }
  return files;
}

/** Pure verification core. It verifies static export evidence, not an end-to-end browser bridge. */
export function inspectExportContents({ files, pckHash }) {
  const errors = [];
  const warnings = [];
  for (const name of REQUIRED_FILES) {
    if (!files.has(name)) errors.push(`missing required export file: ${name}`);
  }

  const html = asText(files.get("index.html"));
  const runtime = asText(files.get("index.js"));
  const studio = asText(files.get("studio/studio.js"));
  const preset = asText(files.get("godot/export_presets.cfg"));

  if (count(html, /(?:href|src)=["']\.\/studio\/studio\.css["']/gi) !== 1) {
    errors.push("index.html must reference ./studio/studio.css exactly once");
  }
  if (count(html, /src=["']\.\/studio\/studio\.js["']/gi) !== 1) {
    errors.push("index.html must reference ./studio/studio.js exactly once");
  }
  if (/<iframe\b/i.test(html)) errors.push("iframes are forbidden");
  if (/<(?:script|link)\b[^>]*(?:src|href)=["'](?:https?:)?\/\//i.test(html)) {
    errors.push("remote runtime dependencies are forbidden");
  }
  if (/\$GODOT_[A-Z0-9_]+/i.test(html)) errors.push("unresolved Godot shell tokens are forbidden");

  const bridgeAssignments = count(studio, /(?:window|globalThis)\s*\.\s*AdMarketCreator\s*=/g);
  if (bridgeAssignments !== 1) {
    errors.push(`studio.js must assign the production AdMarketCreator global exactly once (found ${bridgeAssignments})`);
  }
  if (/AdMarketCreatorSpike/.test(`${html}\n${runtime}\n${studio}`)) {
    errors.push("legacy AdMarketCreatorSpike output is forbidden");
  }

  if (!/^variant\/thread_support=false\s*$/m.test(preset)) {
    errors.push("godot/export_presets.cfg must contain variant/thread_support=false");
  }
  if (!runtime.includes("wasm32.nothreads")) errors.push("index.js lacks wasm32.nothreads evidence");
  if (/pthread/i.test(runtime) || [...files.keys()].some((name) => /pthread.*worker|worker.*pthread/i.test(name))) {
    errors.push("pthread worker output is forbidden");
  }
  if (!runtime.includes("AudioWorklet") || !files.has("index.audio.worklet.js")) {
    errors.push("no-thread AudioWorklet evidence is missing");
  }

  verifyOfflineCatalogue(files, errors);
  verifyProductShellCatalogue(files, errors);
  verifyProductShellMetadata(html, files, errors);
  if (files.has(`${PRODUCT_BUILDER_PREFIX}/catalogue.json`)) {
    verifyProductBuilderCatalogue(files, errors);
    verifyProductBuilderQa(files, errors);
  }
  verifyProductBuilderMetadata(html, files, errors);
  verifyLogoIconCatalogue(files, errors);
  verifyLogoIconMetadata(html, files, errors);

  if (pckHash === STALE_SPIKE_PCK_HASH) warnings.push("PCK_STALE_SPIKE_EXPORT");
  if (errors.length > 0) {
    throw new Error(`Web export verification failed:\n- ${errors.join("\n- ")}`);
  }
  return { warnings };
}

async function listRootFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
}

async function readIfPresent(filePath, binary = false) {
  try {
    return await readFile(filePath, binary ? undefined : "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return undefined;
    throw error;
  }
}

async function readTreeIfPresent(directory, prefix = "") {
  const metadata = await assertPathHasNoIndirection(directory, {
    allowMissing: true,
    label: "source"
  });
  if (!metadata) return new Map();
  if (!metadata.isDirectory()) {
    throw new Error(`Expected catalogue directory: ${directory}`);
  }
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return new Map();
    throw error;
  }
  const result = new Map();
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error(`Refusing symbolic link in web export: ${path.join(prefix, entry.name)}`);
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const [name, value] of await readTreeIfPresent(absolute, relative)) result.set(name, value);
    } else if (entry.isFile()) {
      await assertPathHasNoIndirection(absolute, {
        label: "source",
        rejectHardLinkedFile: true
      });
      result.set(relative, await readFile(absolute));
    } else {
      throw new Error(`Refusing special file in web export: ${relative}`);
    }
  }
  return result;
}

export async function verifyWebExport(exportDir, projectRoot = DEFAULT_ROOT) {
  const files = new Map();
  const rootNames = await listRootFiles(exportDir);
  for (const name of new Set([...rootNames, "index.audio.worklet.js"])) {
    const value = await readIfPresent(path.join(exportDir, name), name === "index.wasm" || name === "index.pck");
    if (value !== undefined) files.set(name, value);
  }
  for (const name of ["studio/studio.css", "studio/studio.js"]) {
    const value = await readIfPresent(path.join(exportDir, ...name.split("/")));
    if (value !== undefined) files.set(name, value);
  }
  for (const [name, value] of await readTreeIfPresent(path.join(exportDir, "catalog"), "catalog")) {
    files.set(name, value);
  }
  const preset = await readIfPresent(path.join(projectRoot, "godot", "export_presets.cfg"));
  if (preset !== undefined) files.set("godot/export_presets.cfg", preset);

  const pck = files.get("index.pck");
  const pckHash = Buffer.isBuffer(pck)
    ? createHash("sha256").update(pck).digest("hex")
    : "";
  return inspectExportContents({ files, pckHash });
}

async function main() {
  if (process.argv.length > 3) throw new Error("Usage: node scripts/verify-web-export.mjs [export-directory]");
  const exportDir = path.resolve(process.argv[2] ?? path.join(DEFAULT_ROOT, "build", "web"));
  const result = await verifyWebExport(exportDir, DEFAULT_ROOT);
  for (const warning of result.warnings) console.warn(warning);
  console.log("WEB_EXPORT_STATIC_VERIFICATION_OK");
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
