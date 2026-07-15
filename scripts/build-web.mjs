import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  verifyLogoIconDirectory,
  verifyOfflineCoreDirectory,
  verifyProductBuilderDirectory,
  verifyProductShellDirectory
} from "./verify-web-export.mjs";
import { assertPathHasNoIndirection } from "./filesystem-safety.mjs";
import { rewriteCreatorRootAttribute } from "./html-start-tags.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");
const REQUIRED_GODOT_FILES = ["index.html", "index.js", "index.wasm", "index.pck"];
const STUDIO_STYLE = '<link rel="stylesheet" href="./studio/studio.css">';
const STUDIO_SCRIPT = '<script src="./studio/studio.js"></script>';
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
  requireProductShells = false,
  requireProductBuilder = false,
  requireLogoIcons = false,
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

  const assembledHtml = injectLogoIconCatalogueUrl(
    injectProductBuilderCatalogueUrl(
      injectProductShellCatalogueUrl(
        injectOfflineCatalogueUrl(
          injectStudioAssets(exportedHtml),
          hasOfflineCore ? `/${offlineRelative.replaceAll(path.sep, "/")}` : undefined
        ),
        hasProductShells ? `/${PRODUCT_SHELL_RELATIVE.replaceAll(path.sep, "/")}` : undefined
      ),
      hasProductBuilder ? `/${PRODUCT_BUILDER_RELATIVE.replaceAll(path.sep, "/")}` : undefined
    ),
    hasLogoIcons ? `/${LOGO_ICON_RELATIVE.replaceAll(path.sep, "/")}` : undefined
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

  log("WEB_EXPORT_ASSEMBLED_NON_DESTRUCTIVE");
  return { webDir, indexPath };
}

async function main() {
  const known = new Set([
    "--require-offline-core",
    "--require-product-shells",
    "--require-product-builder",
    "--require-logo-icons"
  ]);
  const unknown = process.argv.slice(2).filter((argument) => !known.has(argument));
  if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown[0]}`);
  await assembleWebExport({
    requireOfflineCore: process.argv.includes("--require-offline-core"),
    requireProductShells: process.argv.includes("--require-product-shells"),
    requireProductBuilder: process.argv.includes("--require-product-builder"),
    requireLogoIcons: process.argv.includes("--require-logo-icons")
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
