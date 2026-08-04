import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile
} from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  APPLICATION_REDIRECTS,
  computeReleaseId,
  verifyLogoIconDirectory,
  verifyOfflineCoreDirectory,
  verifyProductBuilderDirectory,
  verifyProductShellDirectory
} from "./verify-web-export.mjs";
import { assertPathHasNoIndirection } from "./filesystem-safety.mjs";
import {
  decodeHtmlAttributeValue,
  rewriteCreatorRootAttribute,
  scanHtmlStartTags
} from "./html-start-tags.mjs";

const SERVICE_WORKER_POLICY_REVISION = "release-refresh-v2";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const REQUIRED_GODOT_FILES = ["index.html", "index.js", "index.wasm", "index.pck"];
const ROUTE_BASE = '<base href="/">';
const ROUTED_GAME_ACCESS = "window.AdMarketGameAccess.requireAccess()";
const WEB_MANIFEST = '<link rel="manifest" href="./manifest.webmanifest">';
const RELEASE_PRIVATE_ROOT = path.join(".release", "functions");
const STUDENT_STARTER_RELATIVE = path.join(
  "catalog",
  "generated",
  "offline-core-v1",
  "student-starters-v1.json"
);
const PRODUCT_SHELL_RELATIVE = path.join(
  "catalog",
  "generated",
  "product-shells-v1-reviewed",
  "catalog.json"
);
const PRODUCT_BUILDER_RELATIVE = path.join(
  "catalog",
  "generated",
  "product-builder-pilot-v1",
  "catalogue.json"
);
const LOGO_ICON_RELATIVE = path.join(
  "catalog",
  "generated",
  "logo-icons-v1-reviewed",
  "catalog.json"
);

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
      throw new Error("Executable inline bootstrap script must have a closing </script> tag");
    }
    return html.slice(tag.end, closingStart);
  });
}

function makeNetlifyHeaders(inlineScriptBody) {
  const hash = createHash("sha256").update(Buffer.from(inlineScriptBody, "utf8")).digest("base64");
  return `/*\n  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'sha256-${hash}' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'none'; form-action 'self'; frame-ancestors 'self';\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n  Cross-Origin-Resource-Policy: same-origin\n  Cache-Control: public, max-age=0, must-revalidate\n\n/service-worker.js\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/asset-manifest.json\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/release-manifest.json\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/manifest.webmanifest\n  Cache-Control: no-cache, must-revalidate\n`;
}

function injectWebManifest(html) {
  const tags = scanHtmlStartTags(html);
  const manifestTags = tags.filter((tag) => tag.name === "link" &&
    tag.attributes.some((attribute) =>
      attribute.name === "rel" &&
      decodeHtmlAttributeValue(attribute.value ?? "").split(/\s+/u).includes("manifest")));
  let result = html;
  for (const tag of manifestTags.sort((left, right) => right.start - left.start)) {
    result = `${result.slice(0, tag.start)}${result.slice(tag.end)}`;
  }
  const headClose = result.search(/<\/head\s*>/i);
  if (headClose < 0) throw new Error("Godot export is missing </head>");
  return insertBefore(result, headClose, WEB_MANIFEST);
}

function fileRecord(relative, bytes) {
  return {
    path: relative.replaceAll(path.sep, "/"),
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

function studioAssetVersion(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function studioAssetUrl(fileName, version) {
  if (version === undefined) return `./studio/${fileName}`;
  if (!/^[a-f0-9]{64}$/u.test(version)) {
    throw new Error(`Invalid Studio asset version for ${fileName}`);
  }
  return `./studio/${fileName}?v=${version}`;
}

async function readExactTree(directory, prefix = "") {
  const result = new Map();
  const metadata = await assertPathHasNoIndirection(directory, {
    allowMissing: true,
    label: "release source"
  });
  if (!metadata) return result;
  if (!metadata.isDirectory()) throw new Error(`Expected release directory: ${directory}`);
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing symbolic link in release artifact: ${entry.name}`);
    }
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const [name, value] of await readExactTree(absolute, relative)) {
        result.set(name, value);
      }
    } else if (entry.isFile()) {
      await assertPathHasNoIndirection(absolute, {
        label: "release source",
        rejectHardLinkedFile: true
      });
      result.set(relative, await readFile(absolute));
    } else {
      throw new Error(`Refusing special file in release artifact: ${relative}`);
    }
  }
  return result;
}

function publicUrl(relative) {
  return `/${relative.split("/").map(encodeURIComponent).join("/")}`;
}

function renderServiceWorker({ cacheVersion, assets, core }) {
  const cacheName = `ad-market-${cacheVersion}`;
  const coreSet = new Set(core);
  const expected = Object.fromEntries(assets
    .map((record) => [publicUrl(record.path), record.sha256])
    .filter(([pathname]) => coreSet.has(pathname)));
  return `/* Generated. Do not edit. */
const CACHE_PREFIX = "ad-market-";
const CACHE_NAME = ${JSON.stringify(cacheName)};
const CORE_SHA256 = new Map(Object.entries(${JSON.stringify(expected)}));
const CORE = ${JSON.stringify(core)};
const UPDATE_PATHS = new Set([
  "/service-worker.js",
  "/asset-manifest.json",
  "/release-manifest.json"
]);

const hex = (bytes) => [...new Uint8Array(bytes)]
  .map((value) => value.toString(16).padStart(2, "0"))
  .join("");

async function verifiedResponse(pathname, response) {
  if (!response.ok || response.type === "opaque") {
    throw new Error(\`Unusable release response: \${pathname}\`);
  }
  const expected = CORE_SHA256.get(pathname);
  if (expected === undefined) throw new Error(\`Unbound release asset: \${pathname}\`);
  const actual = hex(await crypto.subtle.digest("SHA-256", await response.clone().arrayBuffer()));
  if (actual !== expected) throw new Error(\`Release asset hash mismatch: \${pathname}\`);
  return response;
}

function isReleaseAsset(pathname) {
  return CORE_SHA256.has(pathname) ||
    pathname.startsWith("/catalog/") ||
    pathname.startsWith("/studio/") ||
    /^\\/index(?:\\.|$)/.test(pathname) ||
    pathname === "/manifest.webmanifest";
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      for (const pathname of CORE) {
        const response = await verifiedResponse(
          pathname,
          await fetch(pathname, { cache: "no-cache" })
        );
        await cache.put(pathname, response);
      }
    } catch (error) {
      await caches.delete(CACHE_NAME);
      throw error;
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const staleReleaseNames = names.filter(
      (name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME
    );
    await Promise.all(staleReleaseNames.map((name) => caches.delete(name)));
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/.release/") ||
    UPDATE_PATHS.has(url.pathname) ||
    request.headers.has("range")) {
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (request.mode === "navigate") {
      try {
        return await fetch(request);
      } catch {
        return await cache.match("/index.html") ?? Response.error();
      }
    }
    if (!isReleaseAsset(url.pathname)) return fetch(request);
    const cached = await cache.match(request);
    if (cached) return cached;
    const fetched = await fetch(request);
    const response = CORE_SHA256.has(url.pathname)
      ? await verifiedResponse(url.pathname, fetched)
      : fetched;
    if (response.ok && response.type !== "opaque") {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
`;
}

async function bindFunctions(root, webDir) {
  const sourceRoot = path.join(root, "netlify");
  const manifestSource = path.join(sourceRoot, "function-bundles", "function-manifest.json");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestSource, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error("Missing function-manifest.json");
    throw new Error("Function manifest is not valid JSON");
  }
  if (manifest?.schema !== "ad-market-function-manifest@1" ||
    !Array.isArray(manifest.functions) || manifest.functions.length === 0) {
    throw new Error("Function manifest schema is invalid");
  }
  const privateRoot = path.join(webDir, RELEASE_PRIVATE_ROOT);
  const records = [];
  const names = new Set();
  for (const entry of manifest.functions) {
    if (!entry || typeof entry.name !== "string" || names.has(entry.name)) {
      throw new Error("Function manifest identity is invalid");
    }
    names.add(entry.name);
    for (const part of ["wrapper", "bundle"]) {
      const record = entry[part];
      if (!record || typeof record.path !== "string" ||
        !Number.isSafeInteger(record.bytes) || record.bytes < 0 ||
        !/^[a-f0-9]{64}$/.test(record.sha256) ||
        record.path.startsWith("/") || record.path.includes("\\") ||
        record.path.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
        throw new Error(`Function manifest ${part} record is invalid`);
      }
      const source = path.join(sourceRoot, ...record.path.split("/"));
      const bytes = await readFile(source);
      const actual = fileRecord(record.path, bytes);
      if (Object.keys(record).sort().join(",") !== "bytes,path,sha256" ||
        actual.path !== record.path ||
        actual.bytes !== record.bytes ||
        actual.sha256 !== record.sha256) {
        throw new Error(`Function manifest hash mismatch: ${record.path}`);
      }
      const destination = path.join(privateRoot, ...record.path.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(source, destination);
      records.push(record);
    }
  }
  const manifestBytes = await readFile(manifestSource);
  const manifestRecord = fileRecord("function-manifest.json", manifestBytes);
  await mkdir(privateRoot, { recursive: true });
  await copyFile(manifestSource, path.join(privateRoot, "function-manifest.json"));
  records.push(manifestRecord);
  records.sort((left, right) => left.path.localeCompare(right.path));
  const copied = await readExactTree(privateRoot);
  const expected = records.map(({ path: relative }) => relative);
  if (JSON.stringify([...copied.keys()]) !== JSON.stringify(expected)) {
    throw new Error("Private function payload contains missing or unexpected files");
  }
  return records;
}

async function emitBoundRelease(root, webDir) {
  await writeFile(path.join(webDir, "_redirects"), APPLICATION_REDIRECTS, "utf8");
  await writeFile(path.join(webDir, "manifest.webmanifest"), `${JSON.stringify({
    name: "Advertising Market Game",
    short_name: "Ad Market",
    start_url: "/student",
    scope: "/",
    display: "standalone",
    background_color: "#f8f4e8",
    theme_color: "#172033"
  }, null, 2)}\n`, "utf8");

  const excludedAssets = new Set([
    "_headers",
    "_redirects",
    "asset-manifest.json",
    "release-manifest.json",
    "service-worker.js"
  ]);
  const beforeWorker = await readExactTree(webDir);
  const assetRecords = [...beforeWorker]
    .filter(([relative]) => !relative.startsWith(".release/") && !excludedAssets.has(relative))
    .map(([relative, bytes]) => fileRecord(relative, bytes))
    .sort((left, right) => left.path.localeCompare(right.path));
  const cacheVersion = createHash("sha256")
    .update(JSON.stringify({
      assets: assetRecords,
      workerPolicyRevision: SERVICE_WORKER_POLICY_REVISION
    }))
    .digest("hex")
    .slice(0, 24);
  const coreCandidates = [
    "index.html",
    "index.js",
    "index.wasm",
    "index.pck",
    "index.audio.worklet.js",
    "studio/studio.js",
    "studio/studio.css",
    "manifest.webmanifest"
  ];
  const assetPaths = new Set(assetRecords.map(({ path: relative }) => relative));
  const core = coreCandidates.filter((relative) => assetPaths.has(relative)).map(publicUrl);
  const assetManifest = {
    schema: "ad-market-asset-manifest@1",
    cacheVersion,
    core,
    assets: assetRecords
  };
  await writeFile(
    path.join(webDir, "asset-manifest.json"),
    `${JSON.stringify(assetManifest, null, 2)}\n`,
    "utf8"
  );
  await writeFile(
    path.join(webDir, "service-worker.js"),
    renderServiceWorker({ cacheVersion, assets: assetRecords, core }),
    "utf8"
  );

  const functionFiles = await bindFunctions(root, webDir);
  const allFiles = await readExactTree(webDir);
  const staticFiles = [...allFiles]
    .filter(([relative]) =>
      relative !== "release-manifest.json" && !relative.startsWith(".release/"))
    .map(([relative, bytes]) => fileRecord(relative, bytes))
    .sort((left, right) => left.path.localeCompare(right.path));
  const releaseId = computeReleaseId({ staticFiles, functionFiles });
  await writeFile(path.join(webDir, "release-manifest.json"), `${JSON.stringify({
    schema: "ad-market-release@1",
    releaseId,
    static: { files: staticFiles },
    functions: {
      root: RELEASE_PRIVATE_ROOT.replaceAll(path.sep, "/"),
      files: functionFiles
    }
  }, null, 2)}\n`, "utf8");
  return releaseId;
}

function removeStudioTags(html) {
  const tags = scanHtmlStartTags(html);
  const removals = tags.flatMap((tag) => {
    const attributeName = tag.name === "link" ? "href" : tag.name === "script" ? "src" : "";
    const fileName = tag.name === "link" ? "studio.css" : tag.name === "script" ? "studio.js" : "";
    if (!attributeName) return [];
    const reference = tag.attributes.find((attribute) => attribute.name === attributeName)?.value;
    const clean = decodeHtmlAttributeValue(reference)?.split(/[?#]/, 1)[0]?.replaceAll("\\", "/");
    if (typeof clean !== "string" || !clean.endsWith(`/studio/${fileName}`)) return [];
    return [{
      start: tag.start,
      end: tag.name === "script" ? (tag.elementEnd ?? tag.end) : tag.end
    }];
  });
  let result = html;
  for (const removal of removals.sort((left, right) => right.start - left.start)) {
    result = `${result.slice(0, removal.start)}${result.slice(removal.end)}`;
  }
  return result;
}

function insertBefore(html, anchorIndex, line) {
  const prefix = html.slice(0, anchorIndex).replace(/[\t \r\n]+$/, "");
  return `${prefix}\n    ${line}\n    ${html.slice(anchorIndex).replace(/^[\t ]+/, "")}`;
}

function insertAfter(html, anchorIndex, line) {
  const suffix = html.slice(anchorIndex).replace(/^[\t \r\n]+/, "");
  return `${html.slice(0, anchorIndex)}\n    ${line}\n    ${suffix}`;
}

/** Pure shell assembly used by both the CLI and its built-in Node test. */
export function injectStudioAssets(html, {
  scriptVersion,
  styleVersion
} = {}) {
  let result = removeStudioTags(html);
  const headClose = result.search(/<\/head\s*>/i);
  if (headClose < 0) throw new Error("Godot export is missing </head>");
  result = insertBefore(
    result,
    headClose,
    `<link rel="stylesheet" href="${studioAssetUrl("studio.css", styleVersion)}">`
  );

  const indexScript = scanHtmlStartTags(result).find((tag) => tag.name === "script" &&
    tag.inertDepth === 0 && tag.attributes.some((attribute) =>
      attribute.name === "src" && ["index.js", "./index.js"].includes(
        decodeHtmlAttributeValue(attribute.value)
      )));
  const scriptAnchor = indexScript?.start ?? -1;
  if (scriptAnchor < 0) throw new Error("Godot export is missing an executable local index script");
  result = insertBefore(
    result,
    scriptAnchor,
    `<script src="${studioAssetUrl("studio.js", scriptVersion)}"></script>`
  );
  return result;
}

/** Makes one Godot shell safe to serve at every application route. */
export function normaliseRoutedGodotShell(html) {
  const tags = scanHtmlStartTags(html);
  const baseTags = tags.filter((tag) => tag.name === "base" && tag.inertDepth === 0);
  let result = html;
  for (const tag of baseTags.sort((left, right) => right.start - left.start)) {
    result = `${result.slice(0, tag.start)}${result.slice(tag.end)}`;
  }
  const headTag = scanHtmlStartTags(result).find((tag) =>
    tag.name === "head" && tag.inertDepth === 0);
  if (headTag === undefined) throw new Error("Godot export is missing <head>");
  result = insertAfter(result, headTag.end, ROUTE_BASE);

  const routedTags = scanHtmlStartTags(result);
  const accessPattern =
    /window\.AdMarket(?:Account|GameAccess)\.requireAccess\(\)/gu;
  const matches = [];
  for (const tag of routedTags.filter(isExecutableInlineScript)) {
    const closingStart = result.lastIndexOf("</", (tag.elementEnd ?? tag.end) - 1);
    if (closingStart < tag.end) continue;
    const body = result.slice(tag.end, closingStart);
    for (const match of body.matchAll(accessPattern)) {
      matches.push({
        start: tag.end + (match.index ?? 0),
        end: tag.end + (match.index ?? 0) + match[0].length
      });
    }
  }
  if (/\bengine\s*\.\s*startGame\s*\(/u.test(result) && matches.length !== 1) {
    throw new Error(
      `Godot shell must contain one route-neutral game access gate (found ${matches.length})`
    );
  }
  if (matches.length === 1) {
    const [match] = matches;
    result = `${result.slice(0, match.start)}${ROUTED_GAME_ACCESS}${result.slice(match.end)}`;
  }
  return result;
}

export function assertResolvedGodotShell(html) {
  const token = html.match(/\$GODOT_[A-Z0-9_]+/i)?.[0];
  if (token) throw new Error(`Refusing unresolved Godot shell token: ${token}`);
}

/** Rejects deployable Godot bootstraps that can start before account access resolves. */
export function assertAccountGatedGodotShell(html) {
  if (!/\bengine\s*\.\s*startGame\s*\(/u.test(html)) return;
  const tags = scanHtmlStartTags(html);
  const attribute = (tag, name) => tag.attributes.find((candidate) =>
    candidate.name === name);
  const value = (tag, name) => {
    const match = attribute(tag, name);
    return match === undefined ? undefined : decodeHtmlAttributeValue(match.value ?? "");
  };
  const byId = (id) => tags.find((tag) => value(tag, "id") === id);
  const gateRoot = byId("account-gate-root");
  const statusRoot = byId("account-session-root");
  const gameSurface = tags.find((tag) => tag.name === "main" &&
    value(tag, "aria-label") === "Advertising Market Game");
  const canvas = byId("canvas");
  const structurallyLocked = gateRoot !== undefined && statusRoot !== undefined &&
    gameSurface !== undefined && attribute(gameSurface, "hidden") !== undefined &&
    attribute(gameSurface, "inert") !== undefined &&
    value(gameSurface, "aria-hidden") === "true" && canvas?.name === "canvas" &&
    value(canvas, "tabindex") === "-1";
  const scripts = getExecutableInlineScriptBodies(html);
  const starts = scripts.flatMap((body) =>
    body.match(/\bengine\s*\.\s*startGame\s*\(/gu) ?? []);
  const gatedStart = scripts.some((body) =>
    /window\s*\.\s*AdMarketGameAccess\s*\.\s*requireAccess\s*\(\s*\)\s*\.\s*then\s*\(\s*\(\s*\)\s*=>\s*(?:withStartupTimeout\s*\(\s*)?engine\s*\.\s*startGame\s*\(/su.test(body));
  const boundedFailure = scripts.some((body) =>
    /reportStartupFailure\s*\(\s*"timeout"\s*\)/su.test(body) &&
    /reportStartupFailure\s*\(\s*"engine"\s*\)/su.test(body));
  if (!structurallyLocked || starts.length !== 1 || !gatedStart || !boundedFailure) {
    throw new Error("Godot shell must enforce mandatory routed access before starting the game");
  }
}

function injectCreatorRootCatalogueUrl(html, catalogueUrl, attribute) {
  if (catalogueUrl !== undefined &&
    (!/^\/(?!\/)[A-Za-z0-9._~!$&'()*+,;=:@%/-]+\.json$/.test(catalogueUrl) ||
      catalogueUrl.includes(".."))) {
    throw new Error("Offline catalogue URL must be a local catalogue URL");
  }
  return rewriteCreatorRootAttribute(html, attribute, catalogueUrl);
}

/** Adds only the local reviewed-pack URL and removes any stale prior value. */
export function injectOfflineCatalogueUrl(html, catalogueUrl) {
  return injectCreatorRootCatalogueUrl(html, catalogueUrl, "data-offline-catalogue-url");
}

/** Adds only the local semantic-shell URL and removes any stale prior value. */
export function injectProductShellCatalogueUrl(html, catalogueUrl) {
  return injectCreatorRootCatalogueUrl(html, catalogueUrl, "data-product-shell-catalogue-url");
}

/** Adds only the local combinatorial-builder URL and removes any stale prior value. */
export function injectProductBuilderCatalogueUrl(html, catalogueUrl) {
  return injectCreatorRootCatalogueUrl(html, catalogueUrl, "data-product-builder-catalogue-url");
}

/** Adds only the pinned local logo-icon URL and removes any stale prior value. */
export function injectLogoIconCatalogueUrl(html, catalogueUrl) {
  return injectCreatorRootCatalogueUrl(html, catalogueUrl, "data-logo-icon-catalogue-url");
}

async function requireFile(filePath, label) {
  try {
    await access(filePath);
  } catch {
    throw new Error(`Missing ${label}: ${filePath}`);
  }
}

/** Copies a generated tree without pruning and rejects filesystem indirection. */
export async function copyVerifiedTree(source, destination) {
  const sourceMetadata = await assertPathHasNoIndirection(source, { label: "source" });
  if (!sourceMetadata.isDirectory()) {
    throw new Error(`Expected generated catalogue directory: ${source}`);
  }
  const destinationMetadata = await assertPathHasNoIndirection(destination, {
    allowMissing: true,
    label: "destination"
  });
  if (destinationMetadata && !destinationMetadata.isDirectory()) {
    throw new Error(`Expected generated catalogue destination directory: ${destination}`);
  }
  await mkdir(destination, { recursive: true });
  await assertPathHasNoIndirection(destination, { label: "destination" });
  const entries = await readdir(source, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing symbolic link in generated catalogue: ${entry.name}`);
    }
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    const sourceEntryMetadata = await assertPathHasNoIndirection(sourcePath, {
      label: "source",
      rejectHardLinkedFile: true
    });
    const destinationEntryMetadata = await assertPathHasNoIndirection(destinationPath, {
      allowMissing: true,
      label: "destination",
      rejectHardLinkedFile: true
    });
    if (entry.isDirectory()) {
      if (!sourceEntryMetadata.isDirectory() ||
        (destinationEntryMetadata && !destinationEntryMetadata.isDirectory())) {
        throw new Error(`Refusing mismatched catalogue directory: ${entry.name}`);
      }
      await copyVerifiedTree(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      if (!sourceEntryMetadata.isFile() ||
        (destinationEntryMetadata && !destinationEntryMetadata.isFile())) {
        throw new Error(`Refusing mismatched catalogue file: ${entry.name}`);
      }
      await copyFile(sourcePath, destinationPath);
    } else {
      throw new Error(`Refusing special file in generated catalogue: ${entry.name}`);
    }
  }
}

export async function assembleWebExport({
  root = DEFAULT_ROOT,
  requireOfflineCore = false,
  minimumOfflineRecords = 0,
  requireProductShells = false,
  requireProductBuilder = false,
  requireLogoIcons = false,
  bindRelease = false,
  log = console.log
} = {}) {
  if (!Number.isSafeInteger(minimumOfflineRecords) || minimumOfflineRecords < 0 ||
    minimumOfflineRecords > 20_000) {
    throw new Error("Offline catalogue minimum must be an integer from 0 to 20000");
  }
  if (minimumOfflineRecords > 0 && !requireOfflineCore) {
    throw new Error("An offline catalogue minimum requires --require-offline-core");
  }
  const studioDir = path.join(root, "build", "studio");
  const webDir = path.join(root, "build", "web");
  const studioAssets = new Map();
  for (const name of ["studio.js", "studio.css"]) {
    const source = path.join(studioDir, name);
    await requireFile(source, `studio asset ${name}`);
    studioAssets.set(name, await readFile(source));
  }
  for (const name of REQUIRED_GODOT_FILES) {
    await requireFile(path.join(webDir, name), `Godot Web export ${name}`);
  }

  const indexPath = path.join(webDir, "index.html");
  const exportedHtml = await readFile(indexPath, "utf8");
  assertResolvedGodotShell(exportedHtml);

  const offlineRelative = path.join("catalog", "generated", "offline-core-v1", "catalog.json");
  const offlineSource = path.join(root, offlineRelative);
  let hasOfflineCore = false;
  try {
    await access(offlineSource);
    hasOfflineCore = true;
  } catch {
    if (requireOfflineCore) {
      throw new Error(`Required offline core is absent: ${offlineRelative}`);
    }
  }

  const productShellSource = path.join(root, PRODUCT_SHELL_RELATIVE);
  let hasProductShells = false;
  try {
    await access(productShellSource);
    hasProductShells = true;
  } catch {
    if (requireProductShells) {
      throw new Error(`Required product shell catalogue is absent: ${PRODUCT_SHELL_RELATIVE}`);
    }
  }

  const productBuilderSource = path.join(root, PRODUCT_BUILDER_RELATIVE);
  let hasProductBuilder = false;
  try {
    await access(productBuilderSource);
    hasProductBuilder = true;
    await verifyProductBuilderDirectory(path.dirname(productBuilderSource));
  } catch (error) {
    if (hasProductBuilder) throw error;
    if (requireProductBuilder) {
      throw new Error(`Required product builder catalogue is absent: ${PRODUCT_BUILDER_RELATIVE}`);
    }
  }

  const logoIconSource = path.join(root, LOGO_ICON_RELATIVE);
  let hasLogoIcons = false;
  try {
    await access(logoIconSource);
    hasLogoIcons = true;
    await verifyLogoIconDirectory(path.dirname(logoIconSource));
  } catch (error) {
    if (hasLogoIcons) throw error;
    if (requireLogoIcons) {
      throw new Error(`Required logo icon catalogue is absent: ${LOGO_ICON_RELATIVE}`);
    }
  }

  const catalogueHtml = injectLogoIconCatalogueUrl(
    injectProductBuilderCatalogueUrl(
      injectProductShellCatalogueUrl(
        injectOfflineCatalogueUrl(
          normaliseRoutedGodotShell(injectStudioAssets(
            exportedHtml,
            bindRelease
              ? {
                  scriptVersion: studioAssetVersion(studioAssets.get("studio.js")),
                  styleVersion: studioAssetVersion(studioAssets.get("studio.css"))
                }
              : undefined
          )),
          hasOfflineCore ? `/${offlineRelative.replaceAll(path.sep, "/")}` : undefined
        ),
        hasProductShells ? `/${PRODUCT_SHELL_RELATIVE.replaceAll(path.sep, "/")}` : undefined
      ),
      hasProductBuilder ? `/${PRODUCT_BUILDER_RELATIVE.replaceAll(path.sep, "/")}` : undefined
    ),
    hasLogoIcons ? `/${LOGO_ICON_RELATIVE.replaceAll(path.sep, "/")}` : undefined
  );
  const assembledHtml = bindRelease ? injectWebManifest(catalogueHtml) : catalogueHtml;
  assertResolvedGodotShell(assembledHtml);
  assertAccountGatedGodotShell(assembledHtml);
  const inlineScriptBodies = getExecutableInlineScriptBodies(assembledHtml);
  if (inlineScriptBodies.length !== 1) {
    throw new Error("Godot export must contain exactly one executable inline bootstrap script");
  }

  const outputStudioDir = path.join(webDir, "studio");
  await mkdir(outputStudioDir, { recursive: true });
  await Promise.all(["studio.js", "studio.css"].map((name) =>
    writeFile(path.join(outputStudioDir, name), studioAssets.get(name))
  ));
  if (assembledHtml !== exportedHtml) await writeFile(indexPath, assembledHtml, "utf8");
  await writeFile(path.join(webDir, "_headers"), makeNetlifyHeaders(inlineScriptBodies[0]), "utf8");

  if (hasOfflineCore) {
    const offlineSourceRoot = path.dirname(offlineSource);
    const offlineDestinationRoot = path.join(webDir, path.dirname(offlineRelative));
    const verifiedOfflineFiles = await verifyOfflineCoreDirectory(offlineSourceRoot, {
      minimumRecords: minimumOfflineRecords
    });
    const starterKey = STUDENT_STARTER_RELATIVE.replaceAll(path.sep, "/");
    const starterBytes = verifiedOfflineFiles.get(starterKey);
    await copyVerifiedTree(offlineSourceRoot, offlineDestinationRoot);
    log(`OFFLINE_CORE_COPIED ${path.dirname(offlineRelative).replaceAll(path.sep, "/")}`);
    if (starterBytes !== undefined) {
      log(`STUDENT_STARTERS_BOUND sha256=${
        createHash("sha256").update(starterBytes).digest("hex")
      }`);
    }
  } else {
    log(`OFFLINE_CORE_DEFERRED ${offlineRelative.replaceAll(path.sep, "/")}`);
  }

  if (hasProductShells) {
    const productShellSourceRoot = path.dirname(productShellSource);
    const productShellDestinationRoot = path.join(webDir, path.dirname(PRODUCT_SHELL_RELATIVE));
    await verifyProductShellDirectory(productShellSourceRoot);
    await copyVerifiedTree(productShellSourceRoot, productShellDestinationRoot);
    log(`PRODUCT_SHELLS_COPIED ${path.dirname(PRODUCT_SHELL_RELATIVE).replaceAll(path.sep, "/")}`);
  } else {
    log(`PRODUCT_SHELLS_DEFERRED ${PRODUCT_SHELL_RELATIVE.replaceAll(path.sep, "/")}`);
  }

  if (hasProductBuilder) {
    const productBuilderSourceRoot = path.dirname(productBuilderSource);
    const productBuilderDestinationRoot = path.join(webDir, path.dirname(PRODUCT_BUILDER_RELATIVE));
    await copyVerifiedTree(productBuilderSourceRoot, productBuilderDestinationRoot);
    log(`PRODUCT_BUILDER_COPIED ${path.dirname(PRODUCT_BUILDER_RELATIVE).replaceAll(path.sep, "/")}`);
  } else {
    log(`PRODUCT_BUILDER_DEFERRED ${PRODUCT_BUILDER_RELATIVE.replaceAll(path.sep, "/")}`);
  }

  if (hasLogoIcons) {
    const logoIconSourceRoot = path.dirname(logoIconSource);
    const logoIconDestinationRoot = path.join(webDir, path.dirname(LOGO_ICON_RELATIVE));
    await copyVerifiedTree(logoIconSourceRoot, logoIconDestinationRoot);
    log(`LOGO_ICONS_COPIED ${path.dirname(LOGO_ICON_RELATIVE).replaceAll(path.sep, "/")}`);
  } else {
    log(`LOGO_ICONS_DEFERRED ${LOGO_ICON_RELATIVE.replaceAll(path.sep, "/")}`);
  }

  if (bindRelease) {
    const releaseId = await emitBoundRelease(root, webDir);
    log(`RELEASE_BOUND ${releaseId}`);
  }

  log("WEB_EXPORT_ASSEMBLED_NON_DESTRUCTIVE");
  return { webDir, indexPath };
}

async function main() {
  const argumentsList = process.argv.slice(2);
  const minimumPrefix = "--minimum-offline-records=";
  const minimumArguments = argumentsList.filter((argument) => argument.startsWith(minimumPrefix));
  if (minimumArguments.length > 1 ||
    (minimumArguments.length === 1 && !/^--minimum-offline-records=\d+$/.test(minimumArguments[0]))) {
    throw new Error("Invalid --minimum-offline-records value");
  }
  const minimumOfflineRecords = minimumArguments.length === 0
    ? 0
    : Number(minimumArguments[0].slice(minimumPrefix.length));
  const known = new Set([
    "--require-offline-core",
    "--require-product-shells",
    "--require-product-builder",
    "--require-logo-icons"
  ]);
  const unknown = argumentsList.filter((argument) =>
    !known.has(argument) && !argument.startsWith(minimumPrefix));
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown[0]}`);
  await assembleWebExport({
    requireOfflineCore: process.argv.includes("--require-offline-core"),
    minimumOfflineRecords,
    requireProductShells: process.argv.includes("--require-product-shells"),
    requireProductBuilder: process.argv.includes("--require-product-builder"),
    requireLogoIcons: process.argv.includes("--require-logo-icons"),
    bindRelease: true
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
