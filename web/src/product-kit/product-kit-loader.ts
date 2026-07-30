import type { OfflineCatalogueWithHash } from "../catalogue/catalogue-store";
import type { CatalogAssetV1 } from "../catalogue/catalogue-types";
import type { NewRasterInput } from "../fabric/canvas-port";
import {
  parseProductKitCatalogue,
  type ProductKitAssetReference,
  type ProductKitCatalogue,
  type ProductKitCatalogueContext
} from "./product-kit-catalogue";
import {
  createProductKitRuntime,
  type ProductKitRuntime
} from "./product-kit-runtime";
import { snapshotPlainData } from "./plain-data";
import {
  parseProductKitPricing,
  type ProductKitPricingIndex
} from "./product-kit-pricing";
import {
  parseStudentStarterManifest,
  type StudentStarterManifestV1
} from "./student-starter-catalogue";

export interface ProductKitRasterSource {
  readonly assetId: string;
  readonly masterSha256: string;
  readonly masterUrl: string;
}

export interface LoadedProductKitBundle {
  readonly catalogue: ProductKitCatalogue;
  readonly runtime: ProductKitRuntime;
  readonly rasterSources: ReadonlyMap<string, ProductKitRasterSource>;
  readonly pricing: ProductKitPricingIndex;
  readonly starterManifest: StudentStarterManifestV1;
  readonly starterRasters: ReadonlyMap<string, CatalogAssetV1>;
}

export function sectionFillForStudentStarter(
  bundle: LoadedProductKitBundle,
  asset: CatalogAssetV1
): NewRasterInput["sectionFill"] | undefined {
  if (asset.delivery !== "offline" || asset.kind !== "raster-master" ||
    !asset.classroomReviewed || !asset.brandFree) return undefined;
  const admitted = bundle.starterRasters.get(asset.id);
  const starter = bundle.starterManifest.starters.find((candidate) =>
    candidate.kind === "raster" && candidate.assetId === asset.id
  );
  if (!admitted || !starter || starter.kind !== "raster" ||
    starter.fillMode === "none" || starter.fillProfile === "none" ||
    admitted.delivery !== "offline" ||
    admitted.id !== asset.id ||
    admitted.version !== asset.version ||
    admitted.kind !== asset.kind ||
    admitted.title !== asset.title ||
    admitted.files.master !== asset.files.master ||
    admitted.files.masks?.body !== asset.files.masks?.body ||
    admitted.masterSha256 !== asset.masterSha256) return undefined;
  const validPair =
    (starter.fillMode === "connected-sections" &&
      starter.fillProfile === "bounded-linework-v1") ||
    (starter.fillMode === "whole-object" &&
      starter.fillProfile === "opaque-body-v1");
  if (!validPair) return undefined;
  return Object.freeze({
    sourceSha256: asset.masterSha256,
    mode: starter.fillMode,
    profile: starter.fillProfile
  });
}

interface ProductKitSidecarUrls {
  readonly catalogue: string;
  readonly pricing: string;
  readonly starters: string;
}

interface ParsedJsonResponse {
  readonly value: unknown;
}

const MAX_SIDECAR_BYTES = 4 * 1024 * 1024;
const SIDECAR_DEADLINE_MS = 5_000;

function frozenReadonlyMap<Key, Value>(
  source: ReadonlyMap<Key, Value>
): ReadonlyMap<Key, Value> {
  let view: ReadonlyMap<Key, Value>;
  view = Object.freeze({
    get size() {
      return source.size;
    },
    get(key: Key) {
      return source.get(key);
    },
    has(key: Key) {
      return source.has(key);
    },
    entries() {
      return source.entries();
    },
    keys() {
      return source.keys();
    },
    values() {
      return source.values();
    },
    forEach(
      callback: (value: Value, key: Key, map: ReadonlyMap<Key, Value>) => void,
      thisArg?: unknown
    ) {
      for (const [key, value] of source) callback.call(thisArg, value, key, view);
    },
    [Symbol.iterator]() {
      return source[Symbol.iterator]();
    }
  });
  return view;
}

function canonicalPathname(pathname: string): boolean {
  try {
    const decoded = decodeURIComponent(pathname);
    return !decoded.includes("\\") && !decoded.split("/").some((segment) =>
      segment === "." || segment === ".."
    );
  } catch {
    return false;
  }
}

function hasRawDotSegment(value: string): boolean {
  const suffixIndex = value.search(/[?#]/);
  const pathSource = suffixIndex === -1 ? value : value.slice(0, suffixIndex);
  try {
    const decoded = decodeURIComponent(pathSource).replaceAll("\\", "/");
    return decoded.split("/").some((segment) => segment === "." || segment === "..");
  } catch {
    return true;
  }
}

function canonicalRawCataloguePath(value: string): string | null {
  if (/[\u0000-\u0020\u007f]/.test(value) || value.includes("\\")) return null;
  const originPrefix = `${window.location.origin}/`;
  const rawPath = value.startsWith("/") && !value.startsWith("//")
    ? value
    : value.startsWith(originPrefix)
      ? value.slice(window.location.origin.length)
      : null;
  if (!rawPath || rawPath.includes("//") || hasRawDotSegment(rawPath)) return null;
  try {
    return decodeURIComponent(rawPath) === rawPath ? rawPath : null;
  } catch {
    return null;
  }
}

function resolveSidecarUrls(value: string | undefined): ProductKitSidecarUrls | null {
  if (!value) return null;
  try {
    const rawPath = canonicalRawCataloguePath(value);
    if (!rawPath) return null;
    const resolvedCatalogueUrl = new URL(value, window.location.href);
    if (resolvedCatalogueUrl.origin !== window.location.origin ||
      (resolvedCatalogueUrl.protocol !== "http:" && resolvedCatalogueUrl.protocol !== "https:") ||
      resolvedCatalogueUrl.username || resolvedCatalogueUrl.password ||
      resolvedCatalogueUrl.search || resolvedCatalogueUrl.hash ||
      !resolvedCatalogueUrl.pathname.startsWith("/catalog/") ||
      !resolvedCatalogueUrl.pathname.endsWith("/catalog.json") ||
      resolvedCatalogueUrl.pathname !== rawPath ||
      !canonicalPathname(resolvedCatalogueUrl.pathname)) return null;

    const parentPath = resolvedCatalogueUrl.pathname.slice(
      0,
      -"catalog.json".length
    );
    const catalogue = new URL("product-kit-v1.json", resolvedCatalogueUrl);
    const pricing = new URL("product-kit-pricing-v1.json", resolvedCatalogueUrl);
    const starters = new URL("student-starters-v1.json", resolvedCatalogueUrl);
    if ([catalogue, pricing, starters].some((url) =>
      url.origin !== resolvedCatalogueUrl.origin || url.search || url.hash
    ) || catalogue.pathname !== `${parentPath}product-kit-v1.json` ||
      pricing.pathname !== `${parentPath}product-kit-pricing-v1.json` ||
      starters.pathname !== `${parentPath}student-starters-v1.json`) return null;
    return {
      catalogue: catalogue.href,
      pricing: pricing.href,
      starters: starters.href
    };
  } catch {
    return null;
  }
}

async function fetchJson(
  url: string,
  fetchImpl: typeof fetch
): Promise<ParsedJsonResponse | null> {
  const abortController = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>> | null = null;
  let deadlineTimer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    deadlineTimer = setTimeout(() => {
      abortController.abort();
      if (reader) void reader.cancel("Product Kit sidecar deadline").catch(() => undefined);
      reject(new Error("Product Kit sidecar deadline exceeded"));
    }, SIDECAR_DEADLINE_MS);
  });

  try {
    const response = await Promise.race([
      fetchImpl(url, {
        method: "GET",
        headers: { accept: "application/json" },
        credentials: "same-origin",
        signal: abortController.signal
      }),
      deadline
    ]);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")
      ?.split(";", 1)[0]?.trim().toLowerCase();
    if (contentType !== "application/json") return null;
    const contentLength = response.headers.get("content-length");
    if (contentLength !== null && (!/^\d+$/.test(contentLength) ||
      Number(contentLength) > MAX_SIDECAR_BYTES)) return null;
    if (!response.body) return null;

    reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let byteLength = 0;
    while (true) {
      const chunk = await Promise.race([reader.read(), deadline]);
      if (chunk.done) break;
      if (chunk.value.byteLength > MAX_SIDECAR_BYTES - byteLength) {
        await Promise.race([
          reader.cancel("Product Kit sidecar exceeds byte limit"),
          deadline
        ]);
        return null;
      }
      chunks.push(chunk.value);
      byteLength += chunk.value.byteLength;
    }
    if (byteLength === 0) return null;

    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { value: JSON.parse(source) as unknown };
  } finally {
    clearTimeout(deadlineTimer!);
    try {
      reader?.releaseLock();
    } catch {
      // A deadline may release while a cancelled read is still settling.
    }
  }
}

function projectedContext(offline: OfflineCatalogueWithHash): ProductKitCatalogueContext {
  return {
    catalogPackId: "offline-core-v1",
    catalogSha256: offline.catalogSha256,
    records: offline.records.map((record) => ({
      id: record.id,
      masterSha256: record.masterSha256 ?? "",
      delivery: record.delivery,
      kind: record.kind,
      files: { master: record.files.master },
      dimensions: { ...record.dimensions },
      classroomReviewed: record.classroomReviewed,
      brandFree: record.brandFree
    }))
  };
}

function allCertificationsResolve(
  catalogue: ProductKitCatalogue,
  runtime: ProductKitRuntime
): boolean {
  const kitById = new Map(catalogue.kits.map((kit) => [kit.id, kit]));
  return catalogue.certifications.every((certification) => {
    const kit = kitById.get(certification.kitId);
    if (!kit || kit.mode === "whole") return false;
    return runtime.resolvePair({
      kind: kit.mode,
      kitId: certification.kitId,
      mountFrameId: certification.mountFrameId,
      componentId: certification.componentId
    }) !== null;
  });
}

function buildRasterSources(
  catalogue: ProductKitCatalogue,
  offline: OfflineCatalogueWithHash
): ReadonlyMap<string, ProductKitRasterSource> | null {
  const records = new Map(offline.records.map((record) => [record.id, record]));
  const rasters: ProductKitAssetReference[] = [
    ...catalogue.kits.map((kit) => kit.base),
    ...catalogue.components.flatMap((component) =>
      component.fragments.map((fragment) => fragment.raster)
    )
  ];
  const sources = new Map<string, ProductKitRasterSource>();
  for (const raster of rasters) {
    const record = records.get(raster.assetId);
    if (!record || record.delivery !== "offline" ||
      record.masterSha256 !== raster.masterSha256) return null;
    const source = Object.freeze({
      assetId: raster.assetId,
      masterSha256: raster.masterSha256,
      masterUrl: record.files.master
    });
    const existing = sources.get(source.assetId);
    if (existing && (existing.masterSha256 !== source.masterSha256 ||
      existing.masterUrl !== source.masterUrl)) return null;
    if (!existing) sources.set(source.assetId, source);
  }
  return frozenReadonlyMap(sources);
}

function buildStarterRasters(
  manifest: StudentStarterManifestV1,
  offline: OfflineCatalogueWithHash
): ReadonlyMap<string, CatalogAssetV1> | null {
  const records = new Map(offline.records.map((record) => [record.id, record]));
  const selected = new Map<string, CatalogAssetV1>();
  for (const starter of manifest.starters) {
    if (starter.kind !== "raster") continue;
    const record = records.get(starter.assetId);
    if (!record || record.delivery !== "offline" || record.kind !== "raster-master" ||
      !record.classroomReviewed || !record.brandFree) return null;
    selected.set(starter.assetId, Object.freeze(structuredClone(record)));
  }
  return selected.size === 9 ? frozenReadonlyMap(selected) : null;
}

export async function loadProductKitBundle(
  offlineCatalogueUrl: string | undefined,
  offline: OfflineCatalogueWithHash,
  options: { readonly fetchImpl?: typeof fetch } = {}
): Promise<LoadedProductKitBundle | null> {
  const offlineSnapshot = snapshotPlainData(offline, {
    maxDepth: 64,
    maxNodes: 4_000_000,
    maxArrayLength: 20_000,
    maxObjectProperties: 64,
    maxStringLength: 1_000_000
  });
  if (!offlineSnapshot) return null;
  const urls = resolveSidecarUrls(offlineCatalogueUrl);
  if (!urls) return null;
  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));

  try {
    const [catalogueResponse, pricingResponse, startersResponse] = await Promise.all([
      fetchJson(urls.catalogue, fetchImpl),
      fetchJson(urls.pricing, fetchImpl),
      fetchJson(urls.starters, fetchImpl)
    ]);
    if (!catalogueResponse || !pricingResponse || !startersResponse) return null;

    const catalogue = parseProductKitCatalogue(
      catalogueResponse.value,
      projectedContext(offlineSnapshot)
    );
    if (!catalogue) return null;
    const runtime = createProductKitRuntime(catalogue);
    if (!runtime || !allCertificationsResolve(catalogue, runtime)) return null;
    const pricing = parseProductKitPricing(pricingResponse.value, catalogue);
    if (!pricing) return null;
    const rasterSources = buildRasterSources(catalogue, offlineSnapshot);
    if (!rasterSources) return null;
    const starterManifest = parseStudentStarterManifest(startersResponse.value, {
      records: offlineSnapshot.records,
      productKits: catalogue
    });
    if (!starterManifest) return null;
    const starterRasters = buildStarterRasters(starterManifest, offlineSnapshot);
    if (!starterRasters) return null;

    return Object.freeze({
      catalogue,
      runtime,
      rasterSources,
      pricing,
      starterManifest,
      starterRasters
    });
  } catch {
    return null;
  }
}
