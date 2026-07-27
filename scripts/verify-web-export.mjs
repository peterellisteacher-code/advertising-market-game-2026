import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { JSDOM, VirtualConsole } from "jsdom";
import { parseAst } from "vite";
import { isSafeColourableSvgBody } from "./logo-icon-svg-safety.mjs";
import { assertPathHasNoIndirection } from "./filesystem-safety.mjs";
import {
  decodeHtmlAttributeValue,
  inspectHtmlAttribute,
  scanHtmlStartTags
} from "./html-start-tags.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const STALE_SPIKE_PCK_HASH =
  "e8b1d3f2729a16f0d001f8b1483aa4fbc150dcb1b3411b5aacd7456b6cb92459";
const REQUIRED_FILES = [
  "index.html",
  "index.js",
  "index.wasm",
  "index.pck",
  "_headers",
  "studio/studio.css",
  "studio/studio.js"
];
const PRODUCT_SHELL_PREFIX = "catalog/generated/product-shells-v1-reviewed";
const PRODUCT_BUILDER_PREFIX = "catalog/generated/product-builder-pilot-v1";
const LOGO_ICON_PREFIX = "catalog/generated/logo-icons-v1-reviewed";
const LOGO_ICON_COUNT = 4205;
const MAX_LOGO_CATALOGUE_BYTES = 3 * 1024 * 1024;
const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256 = /^[a-f0-9]{64}$/;
export const APPLICATION_REDIRECTS = [
  "/                 /student             302",
  "/student          /index.html          200",
  "/student/*        /index.html          200",
  "/teacher          /index.html          200",
  "/teacher/*        /index.html          200",
  ""
].join("\n");
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

function orderedRecords(records) {
  return [...records].map(({ path: relative, bytes, sha256 }) => ({
    path: relative,
    bytes,
    sha256
  })).sort((left, right) => left.path.localeCompare(right.path));
}

export function computeReleaseId({ staticFiles, functionFiles }) {
  return createHash("sha256").update(JSON.stringify({
    schema: "ad-market-release-id@1",
    staticFiles: orderedRecords(staticFiles),
    functionFiles: orderedRecords(functionFiles)
  })).digest("hex").slice(0, 32);
}

export function verifyApplicationRouteContract(files) {
  const errors = [];
  const redirects = asText(files.get("_redirects"));
  if (/^\/api(?:\/|\s)[^\r\n]*\s+\/index\.html\s+200\s*$/imu.test(redirects)) {
    errors.push("an API route must not rewrite to the application shell");
  }
  if (redirects !== APPLICATION_REDIRECTS) {
    errors.push("the student and teacher rewrites do not match the release contract");
  }

  const manifestText = asText(files.get("manifest.webmanifest"));
  try {
    const manifest = JSON.parse(manifestText);
    if (manifest?.start_url !== "/student" || manifest?.scope !== "/") {
      errors.push("the web manifest must start at /student within the root scope");
    }
  } catch {
    errors.push("manifest.webmanifest is not valid JSON");
  }

  const worker = asText(files.get("service-worker.js"));
  if (!/url\.pathname\.startsWith\(["']\/api\/["']\)/u.test(worker)) {
    errors.push("the service worker must bypass every API request");
  }
  if (!/request\.mode\s*===\s*["']navigate["']/u.test(worker) ||
    !/cache\.match\(["']\/index\.html["']\)/u.test(worker)) {
    errors.push("the service worker must retain the shared static navigation shell");
  }

  if (errors.length > 0) {
    throw new Error(`Application route verification failed:\n- ${errors.join("\n- ")}`);
  }
}

function assertReleaseRecords(records, label) {
  if (!Array.isArray(records)) throw new Error(`${label} files must be an array`);
  let previous = "";
  const seen = new Set();
  for (const record of records) {
    if (!record || typeof record !== "object" ||
      typeof record.path !== "string" ||
      !Number.isSafeInteger(record.bytes) || record.bytes < 0 ||
      typeof record.sha256 !== "string" || !SHA256.test(record.sha256)) {
      throw new Error(`${label} file record is invalid`);
    }
    if (!record.path || record.path.startsWith("/") || record.path.includes("\\") ||
      record.path.split("/").some((part) => !part || part === "." || part === "..")) {
      throw new Error(`${label} file path is unsafe: ${record.path}`);
    }
    if (seen.has(record.path)) throw new Error(`${label} file path is duplicated: ${record.path}`);
    if (previous && previous.localeCompare(record.path) >= 0) {
      throw new Error(`${label} file records must be sorted`);
    }
    seen.add(record.path);
    previous = record.path;
  }
}

function verifyBoundFiles(files, records, label) {
  const expected = new Set(records.map(({ path: relative }) => relative));
  for (const record of records) {
    const value = files.get(record.path);
    if (value === undefined) throw new Error(`Missing bound ${label} file: ${record.path}`);
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
    if (bytes.byteLength !== record.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== record.sha256) {
      throw new Error(`${label[0].toUpperCase()}${label.slice(1)} file hash mismatch: ${record.path}`);
    }
  }
  for (const relative of files.keys()) {
    if (!expected.has(relative)) throw new Error(`Unexpected ${label} file: ${relative}`);
  }
}

function verifyBoundFunctionManifest(files, releaseRecords) {
  const raw = files.get("function-manifest.json");
  if (raw === undefined) throw new Error("Missing bound function file: function-manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(asText(raw));
  } catch {
    throw new Error("Bound function manifest is not valid JSON");
  }
  if (manifest?.schema !== "ad-market-function-manifest@1" ||
    !Array.isArray(manifest.functions)) {
    throw new Error("Bound function manifest schema is invalid");
  }
  const expected = new Map(releaseRecords
    .filter(({ path: relative }) => relative !== "function-manifest.json")
    .map((record) => [record.path, record]));
  const names = new Set();
  for (const entry of manifest.functions) {
    if (!entry || typeof entry !== "object" || !PORTABLE_ID.test(entry.name ?? "") ||
      names.has(entry.name)) {
      throw new Error("Bound function manifest function identity is invalid");
    }
    names.add(entry.name);
    for (const [part, suffix] of [["wrapper", ".mts"], ["bundle", ".mjs"]]) {
      const record = entry[part];
      if (!record || typeof record.path !== "string" ||
        !record.path.endsWith(`/${entry.name}${suffix}`)) {
        throw new Error(`Bound function manifest ${part} path is invalid`);
      }
      const releaseRecord = expected.get(record.path);
      if (!releaseRecord ||
        Object.keys(record).sort().join(",") !== "bytes,path,sha256" ||
        releaseRecord.path !== record.path ||
        releaseRecord.bytes !== record.bytes ||
        releaseRecord.sha256 !== record.sha256) {
        throw new Error(`Bound function manifest ${part} does not match the release`);
      }
      expected.delete(record.path);
    }
  }
  if (expected.size !== 0) {
    throw new Error(`Bound function manifest omits release files: ${[...expected.keys()].join(", ")}`);
  }
}

export async function verifyReleaseArtifact(exportDir) {
  const manifestPath = path.join(exportDir, "release-manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error("Missing release-manifest.json");
    throw new Error("release-manifest.json is not valid JSON");
  }
  if (manifest?.schema !== "ad-market-release@1" ||
    manifest?.functions?.root !== ".release/functions" ||
    !manifest?.static || !manifest?.functions) {
    throw new Error("Release manifest schema is invalid");
  }
  assertReleaseRecords(manifest.static.files, "Static");
  assertReleaseRecords(manifest.functions.files, "Function");
  if (manifest.static.files.some(({ path: relative }) =>
    relative === "release-manifest.json" || relative.startsWith(".release/"))) {
    throw new Error("Static release records include private release metadata");
  }
  const expectedReleaseId = computeReleaseId({
    staticFiles: manifest.static.files,
    functionFiles: manifest.functions.files
  });
  if (manifest.releaseId !== expectedReleaseId) {
    throw new Error("Release manifest ID does not match its bound files");
  }

  const allFiles = await readTreeIfPresent(exportDir);
  const staticFiles = new Map([...allFiles].filter(([relative]) =>
    relative !== "release-manifest.json" && !relative.startsWith(".release/")));
  const functionFiles = await readTreeIfPresent(
    path.join(exportDir, ".release", "functions")
  );
  verifyBoundFiles(staticFiles, manifest.static.files, "static");
  verifyBoundFiles(functionFiles, manifest.functions.files, "function");
  verifyBoundFunctionManifest(functionFiles, manifest.functions.files);
  verifyApplicationRouteContract(staticFiles);
  return {
    manifest,
    releaseId: manifest.releaseId,
    staticFiles,
    functionFiles
  };
}

function isExecutableInlineScript(tag) {
  if (tag.name !== "script" || tag.inertDepth !== 0 ||
    tag.attributes.some((attribute) => attribute.name === "src")) {
    return false;
  }
  const type = tag.attributes.find((attribute) => attribute.name === "type")?.value;
  if (type === undefined) return true;
  return ["", "module", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript"]
    .includes(decodeHtmlAttributeValue(type).trim().toLowerCase());
}

function getExecutableInlineScriptBodies(html) {
  return scanHtmlStartTags(html).filter(isExecutableInlineScript).map((tag) => {
    const closingStart = html.lastIndexOf("</", (tag.elementEnd ?? tag.end) - 1);
    if (closingStart < tag.end || !/^<\/script\s*>$/i.test(html.slice(closingStart, tag.elementEnd))) {
      throw new Error("executable inline bootstrap script must have a closing </script> tag");
    }
    return html.slice(tag.end, closingStart);
  });
}

function makeNetlifyHeaders(inlineScriptBody) {
  const hash = createHash("sha256").update(Buffer.from(inlineScriptBody, "utf8")).digest("base64");
  return `/*\n  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'sha256-${hash}' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'none'; form-action 'self'; frame-ancestors 'self';\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n  Cross-Origin-Resource-Policy: same-origin\n  Cache-Control: public, max-age=0, must-revalidate\n\n/service-worker.js\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/asset-manifest.json\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/release-manifest.json\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/manifest.webmanifest\n  Cache-Control: no-cache, must-revalidate\n`;
}

function verifyNetlifyHeaders(html, headers, errors) {
  let inlineScriptBodies;
  try {
    inlineScriptBodies = getExecutableInlineScriptBodies(html);
  } catch (error) {
    errors.push(`index.html inline bootstrap cannot be parsed: ${error instanceof Error ? error.message : error}`);
    return;
  }
  if (inlineScriptBodies.length !== 1) {
    errors.push("index.html must contain exactly one executable inline bootstrap script");
    return;
  }
  const scriptPolicy = headers.match(/^\s*Content-Security-Policy:\s*([^\r\n]*)/mi)?.[1] ?? "";
  if (/\bscript-src\b[^;\r\n]*'unsafe-inline'/i.test(scriptPolicy)) {
    errors.push("Netlify CSP has an unsafe inline script policy");
    return;
  }
  if (headers !== makeNetlifyHeaders(inlineScriptBodies[0])) {
    errors.push("Netlify CSP hash does not match the inline bootstrap or required isolation policy");
  }
}

const FUNCTION_NODE_TYPES = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression"
]);
const CONDITIONAL_EXECUTION_NODE_TYPES = new Set([
  "AwaitExpression",
  "ConditionalExpression",
  "DoWhileStatement",
  "ForInStatement",
  "ForOfStatement",
  "ForStatement",
  "IfStatement",
  "PropertyDefinition",
  "SwitchStatement",
  "TryStatement",
  "WhileStatement"
]);

function isImmediatelyInvokedFunction(node, parent) {
  return !node.async && !node.generator && parent?.type === "CallExpression" && parent.callee === node;
}

function assignmentIsSynchronous(ancestors) {
  for (let index = 0; index < ancestors.length; index += 1) {
    const current = ancestors[index];
    const parent = ancestors[index + 1];
    if (FUNCTION_NODE_TYPES.has(current.type) && !isImmediatelyInvokedFunction(current, parent)) {
      return false;
    }
    if (CONDITIONAL_EXECUTION_NODE_TYPES.has(current.type) ||
      (current.type === "LogicalExpression" && ["&&", "||", "??"].includes(current.operator))) {
      return false;
    }
  }
  return true;
}

function walkJavaScript(node, ancestors, visit) {
  if (!node || typeof node !== "object" || typeof node.type !== "string") return;
  visit(node, ancestors);
  const nextAncestors = [node, ...ancestors];
  for (const [key, value] of Object.entries(node)) {
    if (["loc", "start", "end"].includes(key)) continue;
    if (Array.isArray(value)) {
      for (const child of value) walkJavaScript(child, nextAncestors, visit);
    } else {
      walkJavaScript(value, nextAncestors, visit);
    }
  }
}

function inspectBridgeAssignments(source) {
  let program;
  try {
    program = parseAst(source, { allowReturnOutsideFunction: false });
  } catch {
    return { parseError: true, assignments: new Map() };
  }
  const assignments = new Map([
    ["AdMarketCreator", []],
    ["AdMarketPractice", []]
  ]);
  walkJavaScript(program, [], (node, ancestors) => {
    if (node.type === "AssignmentExpression" && node.operator === "=" &&
      node.left?.type === "MemberExpression" && !node.left.computed &&
      node.left.object?.type === "Identifier" &&
      ["window", "globalThis"].includes(node.left.object.name) &&
      node.left.property?.type === "Identifier" &&
      assignments.has(node.left.property.name)) {
      assignments.get(node.left.property.name).push({
        synchronous: assignmentIsSynchronous(ancestors)
      });
    }
  });
  return { parseError: false, assignments };
}

function installsUsableBridgeGlobalsSynchronously(source) {
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(
    '<!doctype html><html><body><main aria-label="Advertising Market Game"><canvas id="canvas"></canvas></main><div id="creator-root" data-offline-catalogue-url="/catalog/never.json"></div></body></html>',
    {
    url: "https://classroom.invalid/student",
    runScripts: "outside-only",
    virtualConsole
    }
  );
  const browser = dom.window;
  const neverAbortSignal = Object.freeze({
    timeout: () => new globalThis.AbortController().signal
  });
  Object.defineProperties(browser, {
    indexedDB: { configurable: true, value: new IDBFactory() },
    IDBKeyRange: { configurable: true, value: IDBKeyRange },
    fetch: { configurable: true, value: () => new Promise(() => {}) },
    AbortController: { configurable: true, value: globalThis.AbortController },
    AbortSignal: { configurable: true, value: neverAbortSignal },
    structuredClone: { configurable: true, value: globalThis.structuredClone },
    TextEncoder: { configurable: true, value: globalThis.TextEncoder },
    TextDecoder: { configurable: true, value: globalThis.TextDecoder },
    requestAnimationFrame: { configurable: true, value: () => 0 },
    cancelAnimationFrame: { configurable: true, value: () => undefined }
  });
  try {
    const script = new vm.Script(source, { filename: "studio.js" });
    script.runInContext(dom.getInternalVMContext(), { timeout: 3_000 });
    return [browser.AdMarketCreator, browser.AdMarketPractice].every((bridge) =>
      bridge !== null && typeof bridge === "object" &&
      typeof bridge.handle === "function" && Object.isFrozen(bridge));
  } catch {
    return false;
  } finally {
    browser.close();
  }
}

function verifyOfflineCatalogue(files, errors, minimumRecords = 0) {
  const catalogPath = "catalog/generated/offline-core-v1/catalog.json";
  const pricingPath = "catalog/generated/offline-core-v1/pricing.json";
  if (!files.has(catalogPath)) return;
  const catalogValue = files.get(catalogPath);
  const catalogBytes = Buffer.isBuffer(catalogValue)
    ? catalogValue
    : Buffer.from(String(catalogValue));
  let records;
  try {
    records = JSON.parse(catalogBytes.toString("utf8"));
  } catch {
    errors.push("offline catalogue JSON is malformed");
    return;
  }
  if (!Array.isArray(records) || records.length > 20_000) {
    errors.push("offline catalogue must be an array of at most 20000 records");
    return;
  }
  if (records.length < minimumRecords) {
    errors.push(`offline catalogue must contain at least ${minimumRecords} records`);
  }
  const expectedRoles = new Map();
  for (const [index, record] of records.entries()) {
    if (!record || typeof record !== "object" || Array.isArray(record) ||
      !record.files || typeof record.files !== "object" || Array.isArray(record.files)) {
      errors.push(`offline catalogue record ${index} has no file contract`);
      continue;
    }
    if (typeof record.id !== "string" || !PORTABLE_ID.test(record.id) || expectedRoles.has(record.id)) {
      errors.push(`offline catalogue record ${index} has an invalid or duplicate id`);
    } else {
      const tags = Array.isArray(record.tags) ? record.tags : [];
      const role = record.kind === "component" && tags.includes("add-on")
        ? "part"
        : record.kind === "raster-master" && tags.includes("placement-frame")
          ? "media"
          : record.kind === "raster-master" && (tags.includes("base") || tags.includes("scene"))
            ? "base"
            : null;
      if (role === null) errors.push(`offline catalogue record ${index} has no pricing role`);
      else expectedRoles.set(record.id, role);
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

  if (!files.has(pricingPath)) {
    errors.push("missing offline pricing: pricing.json");
    return;
  }
  let pricing;
  try {
    pricing = JSON.parse(asText(files.get(pricingPath)));
  } catch {
    errors.push("offline pricing JSON is malformed");
    return;
  }
  const exactPricingKeys = ["schema", "packId", "pricingVersion", "catalogSha256", "entries"];
  if (!pricing || typeof pricing !== "object" || Array.isArray(pricing) ||
    Object.keys(pricing).length !== exactPricingKeys.length ||
    !exactPricingKeys.every((key) => Object.hasOwn(pricing, key)) ||
    pricing.schema !== "raster-production-pricing@1" || pricing.packId !== "offline-core-v1" ||
    !Number.isSafeInteger(pricing.pricingVersion) || pricing.pricingVersion < 1 ||
    pricing.pricingVersion > 1_000_000 || !Array.isArray(pricing.entries) ||
    pricing.entries.length !== records.length || pricing.entries.length > 20_000) {
    errors.push("offline pricing has an invalid contract");
    return;
  }
  const actualCatalogHash = createHash("sha256").update(catalogBytes).digest("hex");
  if (pricing.catalogSha256 !== actualCatalogHash) {
    errors.push("offline pricing catalog hash mismatch");
  }
  const pricedIds = new Set();
  let previousId = "";
  let productRecords = 0;
  for (const [index, entry] of pricing.entries.entries()) {
    const valid = entry && typeof entry === "object" && !Array.isArray(entry) &&
      Object.keys(entry).length === 3 &&
      ["assetId", "costCents", "role"].every((key) => Object.hasOwn(entry, key)) &&
      typeof entry.assetId === "string" && PORTABLE_ID.test(entry.assetId) &&
      entry.assetId > previousId && !pricedIds.has(entry.assetId) &&
      Number.isSafeInteger(entry.costCents) && entry.costCents > 0 && entry.costCents <= 1_000_000 &&
      ["base", "part", "media"].includes(entry.role) && expectedRoles.get(entry.assetId) === entry.role;
    if (!valid) {
      errors.push(`offline pricing entry ${index} is invalid or mismatched`);
      continue;
    }
    previousId = entry.assetId;
    pricedIds.add(entry.assetId);
    if (entry.role !== "media") productRecords += 1;
  }
  if (pricedIds.size !== expectedRoles.size || [...expectedRoles.keys()].some((id) => !pricedIds.has(id))) {
    errors.push("offline pricing must cover every catalogue record exactly once");
  }
  if (productRecords < minimumRecords) {
    errors.push(`offline pricing must contain at least ${minimumRecords} product records`);
  }
  verifyStudentStarterManifest(files, records, errors);
}

export function verifyStudentStarterManifest(files, records, errors) {
  const prefix = "catalog/generated/offline-core-v1";
  const kitPath = `${prefix}/product-kit-v1.json`;
  const starterPath = `${prefix}/student-starters-v1.json`;
  if (!files.has(kitPath)) {
    if (files.has(starterPath)) {
      errors.push("student starter manifest requires the Product Kit sidecar");
    }
    return;
  }
  if (!files.has(starterPath)) {
    errors.push("missing student starter manifest: student-starters-v1.json");
    return;
  }
  let kits;
  let manifest;
  try {
    kits = JSON.parse(asText(files.get(kitPath)));
    manifest = JSON.parse(asText(files.get(starterPath)));
  } catch {
    errors.push("student starter or Product Kit JSON is malformed");
    return;
  }
  const bounded = manifest?.fillProfiles?.["bounded-linework-v1"];
  const opaque = manifest?.fillProfiles?.["opaque-body-v1"];
  const exactProfiles = bounded?.lineDarknessThreshold === 220 &&
    bounded?.minimumAlpha === 200 && bounded?.colourDistance === 48 &&
    bounded?.minimumRegionPixels === 20 && bounded?.maximumRegionFraction === 0.95 &&
    Object.keys(bounded ?? {}).length === 5 && opaque?.minimumAlpha === 200 &&
    Object.keys(opaque ?? {}).length === 1;
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
    Object.keys(manifest).length !== 4 ||
    manifest.schema !== "student-product-starters@1" || manifest.version !== 1 ||
    !exactProfiles || !Array.isArray(manifest.starters) ||
    manifest.starters.length !== 12 || !Array.isArray(kits?.kits) ||
    !Array.isArray(kits?.components)) {
    errors.push("student starter manifest has an invalid contract");
    return;
  }
  const recordsById = new Map(records.map((record) => [record.id, record]));
  const kitsById = new Map(kits.kits.map((kit) => [kit?.id, kit]));
  const componentsById = new Map(kits.components.map((component) => [component?.id, component]));
  const ids = new Set();
  const titles = new Set();
  const categories = new Map();
  let kitCount = 0;
  let rasterCount = 0;
  let connectedCount = 0;
  for (const [index, starter] of manifest.starters.entries()) {
    if (!starter || typeof starter !== "object" || Array.isArray(starter) ||
      typeof starter.id !== "string" || !PORTABLE_ID.test(starter.id) ||
      typeof starter.title !== "string" || starter.title !== starter.title.trim() ||
      starter.title.length === 0 || typeof starter.category !== "string" ||
      !PORTABLE_ID.test(starter.category) || ids.has(starter.id) ||
      titles.has(starter.title)) {
      errors.push(`student starter ${index} has an invalid or duplicate identity`);
      continue;
    }
    ids.add(starter.id);
    titles.add(starter.title);
    categories.set(starter.category, (categories.get(starter.category) ?? 0) + 1);
    if (starter.kind === "kit") {
      kitCount += 1;
      const kit = kitsById.get(starter.kitId);
      const component = componentsById.get(starter.defaultComponentId);
      if (Object.keys(starter).length !== 6 || !kit || !component ||
        !Array.isArray(kit.mountFrames) ||
        !kit.mountFrames.some((frame) => frame?.slotId === component.slotId)) {
        errors.push(`student kit starter ${starter.id} does not resolve`);
      }
      continue;
    }
    if (starter.kind !== "raster") {
      errors.push(`student starter ${starter.id} has an invalid kind`);
      continue;
    }
    rasterCount += 1;
    const record = recordsById.get(starter.assetId);
    const pair = `${starter.fillMode}:${starter.fillProfile}`;
    if (pair === "connected-sections:bounded-linework-v1") connectedCount += 1;
    if (Object.keys(starter).length !== 7 ||
      !new Set([
        "connected-sections:bounded-linework-v1",
        "whole-object:opaque-body-v1",
        "none:none"
      ]).has(pair) || !record || record.delivery !== "offline" ||
      record.kind !== "raster-master" || record.classroomReviewed !== true ||
      record.brandFree !== true || record.attribution?.sourceUrl !== "local" ||
      record.files?.master !==
        `/catalog/generated/offline-core-v1/assets/${starter.assetId}/master.png` ||
      record.files?.masks?.body !==
        `/catalog/generated/offline-core-v1/assets/${starter.assetId}/masks/body.png`) {
      errors.push(`student raster starter ${starter.id} does not resolve`);
    }
  }
  if (kitCount !== 3 || rasterCount !== 9 || connectedCount < 4 ||
    categories.size < 6 || [...categories.values()].some((count) => count > 2)) {
    errors.push("student starter manifest does not meet the 3/9 category and fill invariants");
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
export async function verifyOfflineCoreDirectory(directory, { minimumRecords = 0 } = {}) {
  if (!Number.isSafeInteger(minimumRecords) || minimumRecords < 0 || minimumRecords > 20_000) {
    throw new Error("Offline catalogue minimum must be an integer from 0 to 20000");
  }
  const prefix = "catalog/generated/offline-core-v1";
  const files = await readTreeIfPresent(directory, prefix);
  if (!files.has(`${prefix}/catalog.json`)) {
    throw new Error("Offline catalogue verification failed:\n- missing offline catalogue: catalog.json");
  }
  const errors = [];
  verifyOfflineCatalogue(files, errors, minimumRecords);
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
  const headers = asText(files.get("_headers"));
  const runtime = asText(files.get("index.js"));
  const studio = asText(files.get("studio/studio.js"));
  const preset = asText(files.get("godot/export_presets.cfg"));

  if (count(html, /(?:href|src)=["']\.\/studio\/studio\.css["']/gi) !== 1) {
    errors.push("index.html must reference ./studio/studio.css exactly once");
  }
  let htmlTags = [];
  try {
    htmlTags = scanHtmlStartTags(html);
  } catch (error) {
    errors.push(`index.html start tags cannot be parsed: ${error instanceof Error ? error.message : error}`);
  }
  const studioScripts = htmlTags.filter((tag) => tag.name === "script" &&
    tag.attributes.some((attribute) =>
      attribute.name === "src" &&
      decodeHtmlAttributeValue(attribute.value) === "./studio/studio.js"));
  const executableStudioScripts = studioScripts.filter((tag) =>
    tag.inertDepth === 0 &&
    tag.raw === '<script src="./studio/studio.js">' &&
    tag.attributes.length === 1);
  if (studioScripts.length !== 1 || executableStudioScripts.length !== 1) {
    errors.push("index.html must contain exactly one executable classic synchronous Studio script");
  }
  const studioScriptIndex = executableStudioScripts[0]?.start ?? -1;
  const godotScripts = htmlTags.filter((tag) => tag.name === "script" &&
    tag.attributes.some((attribute) =>
      attribute.name === "src" && ["index.js", "./index.js"].includes(
        decodeHtmlAttributeValue(attribute.value)
      )));
  const executableGodotScripts = godotScripts.filter((tag) =>
    tag.inertDepth === 0 && tag.attributes.length === 1 &&
    ['<script src="index.js">', '<script src="./index.js">'].includes(tag.raw));
  const godotScriptIndex = executableGodotScripts[0]?.start ?? -1;
  if (godotScripts.length !== 1 || executableGodotScripts.length !== 1) {
    errors.push("index.html must reference the local Godot index.js runtime");
  } else if (studioScriptIndex < 0 || studioScriptIndex > godotScriptIndex) {
    errors.push("studio bridge must load before Godot index.js");
  }
  const startGameIndex = html.search(/\bengine\s*\.\s*startGame\s*\(/i);
  if (startGameIndex >= 0 && godotScriptIndex > startGameIndex) {
    errors.push("Godot index.js must load before engine.startGame()");
  }
  if (/<iframe\b/i.test(html)) errors.push("iframes are forbidden");
  if (/<(?:script|link)\b[^>]*(?:src|href)=["'](?:https?:)?\/\//i.test(html)) {
    errors.push("remote runtime dependencies are forbidden");
  }
  if (/\$GODOT_[A-Z0-9_]+/i.test(html)) errors.push("unresolved Godot shell tokens are forbidden");
  verifyNetlifyHeaders(html, headers, errors);

  const bridgeInspection = inspectBridgeAssignments(studio);
  if (bridgeInspection.parseError) {
    errors.push("studio.js cannot be parsed as JavaScript");
  }
  for (const name of ["AdMarketCreator", "AdMarketPractice"]) {
    const assignments = bridgeInspection.assignments.get(name) ?? [];
    if (assignments.length !== 1) {
      errors.push(`studio.js must assign the production ${name} global exactly once (found ${assignments.length})`);
    }
  }
  if (!installsUsableBridgeGlobalsSynchronously(studio)) {
    errors.push("studio.js must install usable production bridge globals synchronously");
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
  const release = await verifyReleaseArtifact(exportDir);
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
  return {
    ...inspectExportContents({ files, pckHash }),
    releaseId: release.releaseId
  };
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
