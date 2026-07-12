import {
  access,
  copyFile,
  lstat,
  mkdir,
  readdir,
  readFile,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { verifyOfflineCoreDirectory } from "./verify-web-export.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const REQUIRED_GODOT_FILES = ["index.html", "index.js", "index.wasm", "index.pck"];
const STUDIO_STYLE = '<link rel="stylesheet" href="./studio/studio.css">';
const STUDIO_SCRIPT = '<script src="./studio/studio.js"></script>';

function removeStudioTags(html) {
  return html
    .replace(/<link\b(?=[^>]*\bhref\s*=\s*["'][^"']*studio\/studio\.css(?:[?#][^"']*)?["'])[^>]*>/gi, "")
    .replace(/<script\b(?=[^>]*\bsrc\s*=\s*["'][^"']*studio\/studio\.js(?:[?#][^"']*)?["'])[^>]*>\s*<\/script>/gi, "");
}

function insertBefore(html, anchorIndex, line) {
  const prefix = html.slice(0, anchorIndex).replace(/[\t \r\n]+$/, "");
  return `${prefix}\n    ${line}\n    ${html.slice(anchorIndex).replace(/^[\t ]+/, "")}`;
}

/** Pure shell assembly used by both the CLI and its built-in Node test. */
export function injectStudioAssets(html) {
  let result = removeStudioTags(html);
  const headClose = result.search(/<\/head\s*>/i);
  if (headClose < 0) throw new Error("Godot export is missing </head>");
  result = insertBefore(result, headClose, STUDIO_STYLE);

  const indexScript = result.search(/<script\b(?=[^>]*\bsrc\s*=\s*["']\.\/?index\.js["'])[^>]*>/i);
  const bodyClose = result.search(/<\/body\s*>/i);
  const scriptAnchor = indexScript >= 0 ? indexScript : bodyClose;
  if (scriptAnchor < 0) throw new Error("Godot export is missing an index script or </body>");
  result = insertBefore(result, scriptAnchor, STUDIO_SCRIPT);
  return result;
}

export function assertResolvedGodotShell(html) {
  const token = html.match(/\$GODOT_[A-Z0-9_]+/i)?.[0];
  if (token) throw new Error(`Refusing unresolved Godot shell token: ${token}`);
}

/** Adds only the local reviewed-pack URL and removes any stale prior value. */
export function injectOfflineCatalogueUrl(html, catalogueUrl) {
  if (catalogueUrl !== undefined &&
    (!/^\/(?!\/)[A-Za-z0-9._~!$&'()*+,;=:@%/-]+\.json$/.test(catalogueUrl) ||
      catalogueUrl.includes(".."))) {
    throw new Error("Offline catalogue URL must be a local catalogue URL");
  }
  const creatorRoot = /<[a-z][^>]*\bid\s*=\s*["']creator-root["'][^>]*>/i;
  const match = html.match(creatorRoot);
  if (!match) {
    if (catalogueUrl === undefined) return html;
    throw new Error("Godot export is missing #creator-root");
  }
  const withoutStale = match[0].replace(
    /\s+data-offline-catalogue-url\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi,
    ""
  );
  const replacement = catalogueUrl === undefined
    ? withoutStale
    : withoutStale.replace(/\s*\/?\>$/, (ending) =>
      ` data-offline-catalogue-url="${catalogueUrl}"${ending}`);
  return html.replace(match[0], replacement);
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
  let destinationPart = path.resolve(destination);
  while (true) {
    try {
      const destinationMetadata = await lstat(destinationPart);
      if (destinationMetadata.isSymbolicLink()) {
        throw new Error(`Refusing destination symlink or reparse point: ${destinationPart}`);
      }
    } catch (error) {
      if (!error || typeof error !== "object" || error.code !== "ENOENT") throw error;
    }
    const parent = path.dirname(destinationPart);
    if (parent === destinationPart) break;
    destinationPart = parent;
  }
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing symbolic link in generated catalogue: ${entry.name}`);
    }
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyVerifiedTree(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, destinationPath);
    } else {
      throw new Error(`Refusing special file in generated catalogue: ${entry.name}`);
    }
  }
}

export async function assembleWebExport({
  root = DEFAULT_ROOT,
  requireOfflineCore = false,
  log = console.log
} = {}) {
  const studioDir = path.join(root, "build", "studio");
  const webDir = path.join(root, "build", "web");
  for (const name of ["studio.js", "studio.css"]) {
    await requireFile(path.join(studioDir, name), `studio asset ${name}`);
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

  const assembledHtml = injectOfflineCatalogueUrl(
    injectStudioAssets(exportedHtml),
    hasOfflineCore ? `/${offlineRelative.replaceAll(path.sep, "/")}` : undefined
  );
  assertResolvedGodotShell(assembledHtml);

  const outputStudioDir = path.join(webDir, "studio");
  await mkdir(outputStudioDir, { recursive: true });
  await Promise.all(["studio.js", "studio.css"].map((name) =>
    copyFile(path.join(studioDir, name), path.join(outputStudioDir, name))
  ));
  if (assembledHtml !== exportedHtml) await writeFile(indexPath, assembledHtml, "utf8");

  if (hasOfflineCore) {
    const offlineSourceRoot = path.dirname(offlineSource);
    const offlineDestinationRoot = path.join(webDir, path.dirname(offlineRelative));
    await verifyOfflineCoreDirectory(offlineSourceRoot);
    await copyVerifiedTree(offlineSourceRoot, offlineDestinationRoot);
    log(`OFFLINE_CORE_COPIED ${path.dirname(offlineRelative).replaceAll(path.sep, "/")}`);
  } else {
    log(`OFFLINE_CORE_DEFERRED ${offlineRelative.replaceAll(path.sep, "/")}`);
  }

  log("WEB_EXPORT_ASSEMBLED_NON_DESTRUCTIVE");
  return { webDir, indexPath };
}

async function main() {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--require-offline-core");
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown[0]}`);
  await assembleWebExport({
    requireOfflineCore: process.argv.includes("--require-offline-core")
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
