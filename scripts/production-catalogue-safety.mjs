import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DEPLOYABLE_CATALOGUE_ROOTS = Object.freeze([
  "catalog/generated/offline-core-v1",
  "catalog/generated/product-builder-pilot-v1",
  "catalog/generated/product-shells-v1-reviewed",
  "catalog/generated/logo-icons-v1-reviewed"
]);

const MANIFEST_NAME_PATTERN =
  /^(?:catalog|catalogue|pricing)\.json$|pricing.*\.json$|.*starter.*\.json$/iu;

const FORBIDDEN_MARKERS = Object.freeze([
  { marker: "QA", pattern: /\bqa\b/iu },
  { marker: "fixture", pattern: /\bfixture\b|(?:^|[/\\])fixtures(?:[/\\]|$)/iu },
  { marker: "example.invalid", pattern: /example\.invalid/iu },
  { marker: "synthetic test", pattern: /synthetic\s+test/iu },
  { marker: "test-only", pattern: /test-only/iu }
]);

const RECORD_ID_KEYS = Object.freeze([
  "id",
  "assetId",
  "recordId",
  "starterId",
  "productId",
  "componentId",
  "packId"
]);

const portablePath = (value) => value.split(path.sep).join("/");

const jsonChildPath = (parent, key) =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(key)
    ? `${parent}.${key}`
    : `${parent}[${JSON.stringify(key)}]`;

const objectRecordId = (value, inherited) => {
  for (const key of RECORD_ID_KEYS) {
    if (typeof value[key] === "string" && value[key].length > 0) return value[key];
  }
  return inherited;
};

export function findForbiddenCatalogueValues(sourcePath, value) {
  const findings = [];

  const visit = (candidate, jsonPath, inheritedRecordId) => {
    if (typeof candidate === "string") {
      for (const { marker, pattern } of FORBIDDEN_MARKERS) {
        const legitimateProductTag =
          marker === "fixture" &&
          /\.tags\[\d+\]$/u.test(jsonPath) &&
          inheritedRecordId?.includes("-fixtures-");
        if (legitimateProductTag) continue;
        if (pattern.test(candidate)) {
          findings.push({
            sourcePath,
            recordId: inheritedRecordId ?? "(root)",
            jsonPath,
            marker
          });
        }
      }
      return;
    }
    if (Array.isArray(candidate)) {
      candidate.forEach((child, index) => visit(
        child,
        `${jsonPath}[${index}]`,
        inheritedRecordId
      ));
      return;
    }
    if (candidate === null || typeof candidate !== "object") return;
    const recordId = objectRecordId(candidate, inheritedRecordId);
    for (const [key, child] of Object.entries(candidate)) {
      visit(child, jsonChildPath(jsonPath, key), recordId);
    }
  };

  visit(value, "$", undefined);
  return findings;
}

const manifestPathsWithin = async (rootPath, relativeRoot) => {
  let entries;
  try {
    entries = await readdir(path.join(rootPath, relativeRoot), { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT" && relativeRoot.endsWith("logo-icons-v1-reviewed")) {
      return [];
    }
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && MANIFEST_NAME_PATTERN.test(entry.name))
    .map((entry) => portablePath(path.join(relativeRoot, entry.name)));
};

export async function productionCatalogueSources(rootPath) {
  const relativePaths = (
    await Promise.all(DEPLOYABLE_CATALOGUE_ROOTS.map(
      (relativeRoot) => manifestPathsWithin(rootPath, relativeRoot)
    ))
  ).flat().sort();

  return Promise.all(relativePaths.map(async (relativePath) => ({
    relativePath,
    value: JSON.parse(await readFile(path.join(rootPath, relativePath), "utf8"))
  })));
}

export async function assertProductionCataloguesSafe(rootPath) {
  const sources = await productionCatalogueSources(rootPath);
  const findings = sources.flatMap(({ relativePath, value }) =>
    findForbiddenCatalogueValues(relativePath, value)
  );
  if (findings.length === 0) return;

  const report = findings.map(({ sourcePath, recordId, jsonPath, marker }) =>
    `${sourcePath} :: record ${recordId} :: ${jsonPath} :: ${marker}`
  );
  throw new Error(`Production catalogue safety check failed:\n${report.join("\n")}`);
}
