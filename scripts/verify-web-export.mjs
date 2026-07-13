import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
