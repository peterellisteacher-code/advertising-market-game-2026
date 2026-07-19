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
  return `/*\n  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'sha256-${hash}' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'none'; form-action 'self'; frame-ancestors 'self';\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n  Cross-Origin-Resource-Policy: same-origin\n`;
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

/** Pure shell assembly used by both the CLI and its built-in Node test. */
export function injectStudioAssets(html) {
  let result = removeStudioTags(html);
  const headClose = result.search(/<\/head\s*>/i);
  if (headClose < 0) throw new Error("Godot export is missing </head>");
  result = insertBefore(result, headClose, STUDIO_STYLE);

  const indexScript = scanHtmlStartTags(result).find((tag) => tag.name === "script" &&
    tag.inertDepth === 0 && tag.attributes.some((attribute) =>
      attribute.name === "src" && ["index.js", "./index.js"].includes(
        decodeHtmlAttributeValue(attribute.value)
      )));
  const scriptAnchor = indexScript?.start ?? -1;
  if (scriptAnchor < 0) throw new Error("Godot export is missing an executable local index script");
  result = insertBefore(result, scriptAnchor, STUDIO_SCRIPT);
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
    /window\s*\.\s*AdMarketAccount\s*\.\s*requireAccess\s*\(\s*\)\s*\.\s*then\s*\(\s*\(\s*\)\s*=>\s*engine\s*\.\s*startGame\s*\(/su.test(body));
  if (!structurallyLocked || starts.length !== 1 || !gatedStart) {
    throw new Error("Godot shell must enforce mandatory account access before starting the game");
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
  assertAccountGatedGodotShell(assembledHtml);
  const inlineScriptBodies = getExecutableInlineScriptBodies(assembledHtml);
  if (inlineScriptBodies.length !== 1) {
    throw new Error("Godot export must contain exactly one executable inline bootstrap script");
  }

  const outputStudioDir = path.join(webDir, "studio");
  await mkdir(outputStudioDir, { recursive: true });
  await Promise.all(["studio.js", "studio.css"].map((name) =>
    copyFile(path.join(studioDir, name), path.join(outputStudioDir, name))
  ));
  if (assembledHtml !== exportedHtml) await writeFile(indexPath, assembledHtml, "utf8");
  await writeFile(path.join(webDir, "_headers"), makeNetlifyHeaders(inlineScriptBodies[0]), "utf8");

  if (hasOfflineCore) {
    const offlineSourceRoot = path.dirname(offlineSource);
    const offlineDestinationRoot = path.join(webDir, path.dirname(offlineRelative));
    await verifyOfflineCoreDirectory(offlineSourceRoot, {
      minimumRecords: minimumOfflineRecords
    });
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
    requireLogoIcons: process.argv.includes("--require-logo-icons")
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
