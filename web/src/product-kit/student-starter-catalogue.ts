import type { CatalogAssetV1 } from "../catalogue/catalogue-types";
import type { ProductKitCatalogue } from "./product-kit-catalogue";

export const STUDENT_STARTER_FILL_PROFILES = Object.freeze({
  "bounded-linework-v1": Object.freeze({
    lineDarknessThreshold: 220,
    minimumAlpha: 200,
    colourDistance: 48,
    minimumRegionPixels: 20,
    maximumRegionFraction: 0.95
  }),
  "opaque-body-v1": Object.freeze({
    minimumAlpha: 200
  })
});

export type StudentStarterRecord =
  | {
      readonly kind: "kit";
      readonly id: string;
      readonly title: string;
      readonly category: string;
      readonly kitId: string;
      readonly defaultComponentId: string;
    }
  | {
      readonly kind: "raster";
      readonly id: string;
      readonly title: string;
      readonly category: string;
      readonly assetId: string;
      readonly fillMode: "connected-sections" | "whole-object" | "none";
      readonly fillProfile: "bounded-linework-v1" | "opaque-body-v1" | "none";
    };

export interface StudentStarterManifestV1 {
  readonly schema: "student-product-starters@1";
  readonly version: 1;
  readonly fillProfiles: typeof STUDENT_STARTER_FILL_PROFILES;
  readonly starters: readonly StudentStarterRecord[];
}

export interface StudentStarterContext {
  readonly records: readonly CatalogAssetV1[];
  readonly productKits: ProductKitCatalogue;
}

const PORTABLE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[]
): boolean {
  return Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key));
}

function plainText(value: unknown, maximum = 120): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum &&
    value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
}

function portableId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 96 && PORTABLE_ID.test(value);
}

function exactFillProfiles(value: unknown): value is typeof STUDENT_STARTER_FILL_PROFILES {
  const profiles = object(value);
  if (!profiles || !exactKeys(profiles, ["bounded-linework-v1", "opaque-body-v1"])) {
    return false;
  }
  const bounded = object(profiles["bounded-linework-v1"]);
  const opaque = object(profiles["opaque-body-v1"]);
  return bounded !== null &&
    exactKeys(bounded, [
      "lineDarknessThreshold",
      "minimumAlpha",
      "colourDistance",
      "minimumRegionPixels",
      "maximumRegionFraction"
    ]) &&
    opaque !== null && exactKeys(opaque, ["minimumAlpha"]) &&
    Object.entries(STUDENT_STARTER_FILL_PROFILES["bounded-linework-v1"])
      .every(([key, expected]) => bounded[key] === expected) &&
    opaque.minimumAlpha === STUDENT_STARTER_FILL_PROFILES["opaque-body-v1"].minimumAlpha;
}

function parseStarter(
  value: unknown,
  context: StudentStarterContext
): StudentStarterRecord | null {
  const starter = object(value);
  if (!starter || !plainText(starter.title) || !portableId(starter.id) ||
    !portableId(starter.category)) return null;
  if (starter.kind === "kit") {
    if (!exactKeys(starter, [
      "kind", "id", "title", "category", "kitId", "defaultComponentId"
    ]) || !portableId(starter.kitId) || !portableId(starter.defaultComponentId)) return null;
    const kit = context.productKits.kits.find(({ id }) => id === starter.kitId);
    const component = context.productKits.components.find(
      ({ id }) => id === starter.defaultComponentId
    );
    if (!kit || !component || !kit.mountFrames.some(({ slotId }) =>
      slotId === component.slotId
    )) return null;
    return {
      kind: "kit",
      id: starter.id,
      title: starter.title,
      category: starter.category,
      kitId: starter.kitId,
      defaultComponentId: starter.defaultComponentId
    };
  }
  if (starter.kind !== "raster" || !exactKeys(starter, [
    "kind", "id", "title", "category", "assetId", "fillMode", "fillProfile"
  ]) || !portableId(starter.assetId)) return null;
  const fillPairs = new Set([
    "connected-sections:bounded-linework-v1",
    "whole-object:opaque-body-v1",
    "none:none"
  ]);
  if (!fillPairs.has(`${String(starter.fillMode)}:${String(starter.fillProfile)}`)) return null;
  const record = context.records.find(({ id }) => id === starter.assetId);
  const expectedMaster =
    `/catalog/generated/offline-core-v1/assets/${starter.assetId}/master.png`;
  const expectedMask =
    `/catalog/generated/offline-core-v1/assets/${starter.assetId}/masks/body.png`;
  if (!record || record.delivery !== "offline" || record.kind !== "raster-master" ||
    !record.classroomReviewed || !record.brandFree ||
    record.attribution.sourceUrl !== "local" ||
    record.id.includes("fixture") || record.id.toLowerCase().includes("qa") ||
    record.files.master !== expectedMaster || record.files.masks?.body !== expectedMask ||
    !record.masterSha256 || record.masterSha256.length !== 64) return null;
  return {
    kind: "raster",
    id: starter.id,
    title: starter.title,
    category: starter.category,
    assetId: starter.assetId,
    fillMode: starter.fillMode as "connected-sections" | "whole-object" | "none",
    fillProfile: starter.fillProfile as "bounded-linework-v1" | "opaque-body-v1" | "none"
  };
}

export function parseStudentStarterManifest(
  value: unknown,
  context: StudentStarterContext
): StudentStarterManifestV1 | null {
  const manifest = object(value);
  if (!manifest || !exactKeys(manifest, ["schema", "version", "fillProfiles", "starters"]) ||
    manifest.schema !== "student-product-starters@1" || manifest.version !== 1 ||
    !exactFillProfiles(manifest.fillProfiles) || !Array.isArray(manifest.starters) ||
    manifest.starters.length !== 12) return null;
  const starters = manifest.starters.map((starter) => parseStarter(starter, context));
  if (starters.some((starter) => starter === null)) return null;
  const parsed = starters.filter((starter) => starter !== null);
  if (new Set(parsed.map(({ id }) => id)).size !== parsed.length ||
    new Set(parsed.map(({ title }) => title)).size !== parsed.length ||
    parsed.filter(({ kind }) => kind === "kit").length !== 3 ||
    parsed.filter(({ kind }) => kind === "raster").length !== 9 ||
    parsed.filter((starter) =>
      starter.kind === "raster" && starter.fillMode === "connected-sections"
    ).length < 4) return null;
  const categoryCounts = new Map<string, number>();
  for (const starter of parsed) {
    categoryCounts.set(starter.category, (categoryCounts.get(starter.category) ?? 0) + 1);
  }
  if (categoryCounts.size < 6 || [...categoryCounts.values()].some((count) => count > 2)) {
    return null;
  }
  return Object.freeze({
    schema: "student-product-starters@1",
    version: 1,
    fillProfiles: STUDENT_STARTER_FILL_PROFILES,
    starters: Object.freeze(parsed.map((starter) => Object.freeze({ ...starter })))
  });
}
