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

function asText(value) {
  return typeof value === "string" ? value : Buffer.isBuffer(value) ? value.toString("utf8") : "";
}

function count(text, pattern) {
  return text.match(pattern)?.length ?? 0;
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
