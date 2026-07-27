import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import OFFLINE_CATALOGUE from "../../../catalog/generated/offline-core-v1/catalog.json";
import OFFLINE_PRICING from "../../../catalog/generated/offline-core-v1/pricing.json";
import PRODUCT_KIT_SIDECAR from "../../../catalog/generated/offline-core-v1/product-kit-v1.json";
import STUDENT_STARTERS from "../../../catalog/generated/offline-core-v1/student-starters-v1.json";
import { parseCatalogAsset } from "../catalogue/catalogue-store";
import { parseProductKitCatalogue } from "./product-kit-catalogue";
import {
  STUDENT_STARTER_FILL_PROFILES,
  parseStudentStarterManifest
} from "./student-starter-catalogue";

const CATALOG_HASH =
  "6199fd1adae59a2b517b265ca67a325f32faba04d375852821e841b51a354073";

function categoryCounts(values: readonly { readonly category: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { category } of values) counts.set(category, (counts.get(category) ?? 0) + 1);
  return counts;
}

describe("student starter catalogue", () => {
  it("defines exactly twelve varied reviewed starters and the shared fill thresholds", () => {
    const records = OFFLINE_CATALOGUE.map((value) => parseCatalogAsset(value));
    expect(records.every((value) => value !== null)).toBe(true);
    const offline = records.filter((value) => value !== null);
    const productKits = parseProductKitCatalogue(PRODUCT_KIT_SIDECAR, {
      catalogPackId: "offline-core-v1",
      catalogSha256: CATALOG_HASH,
      records: offline.map((record) => ({
        id: record.id,
        masterSha256: record.masterSha256 ?? "",
        delivery: record.delivery,
        kind: record.kind,
        files: { master: record.files.master },
        dimensions: { ...record.dimensions },
        classroomReviewed: record.classroomReviewed,
        brandFree: record.brandFree
      }))
    });
    expect(productKits).not.toBeNull();

    const catalogue = parseStudentStarterManifest(STUDENT_STARTERS, {
      records: offline,
      productKits: productKits!
    });
    expect(catalogue).not.toBeNull();
    expect(catalogue!.starters).toHaveLength(12);
    expect(new Set(catalogue!.starters.map(({ title }) => title)).size).toBe(12);
    expect(new Set(catalogue!.starters.map(({ category }) => category)).size)
      .toBeGreaterThanOrEqual(6);
    for (const count of categoryCounts(catalogue!.starters).values()) {
      expect(count).toBeLessThanOrEqual(2);
    }
    expect(catalogue!.starters.filter(({ kind }) => kind === "kit")).toHaveLength(3);
    expect(catalogue!.starters.filter(({ kind }) => kind === "raster")).toHaveLength(9);
    expect(catalogue!.starters.filter((starter) =>
      starter.kind === "raster" && starter.fillMode === "connected-sections"
    ).length).toBeGreaterThanOrEqual(4);
    expect(catalogue!.fillProfiles).toEqual(STUDENT_STARTER_FILL_PROFILES);
  });

  it("resolves every starter to an exact local reviewed asset, kit and price record", () => {
    const records = new Map(OFFLINE_CATALOGUE.map((record) => [record.id, record]));
    const prices = new Map(OFFLINE_PRICING.entries.map((entry) => [entry.assetId, entry]));
    const kits = new Map(PRODUCT_KIT_SIDECAR.kits.map((kit) => [kit.id, kit]));
    const components = new Set(PRODUCT_KIT_SIDECAR.components.map(({ id }) => id));

    for (const starter of STUDENT_STARTERS.starters) {
      if (starter.kind === "kit") {
        const kit = kits.get(starter.kitId!);
        expect(kit, starter.id).toBeTruthy();
        expect(components.has(starter.defaultComponentId!), starter.id).toBe(true);
        continue;
      }
      const record = records.get(starter.assetId!);
      expect(record, starter.id).toBeTruthy();
      expect(record!.delivery).toBe("offline");
      expect(record!.kind).toBe("raster-master");
      expect(record!.classroomReviewed).toBe(true);
      expect(record!.brandFree).toBe(true);
      expect(record!.attribution.sourceUrl).toBe("local");
      expect(record!.files.master).toBe(
        `/catalog/generated/offline-core-v1/assets/${starter.assetId}/master.png`
      );
      expect(record!.files.masks.body).toBe(
        `/catalog/generated/offline-core-v1/assets/${starter.assetId}/masks/body.png`
      );
      expect(prices.has(starter.assetId!), starter.id).toBe(true);
      const bytes = readFileSync(resolve(
        `catalog/generated/offline-core-v1/assets/${starter.assetId}/master.png`
      ));
      expect(bytes.byteLength, starter.id).toBeGreaterThan(0);
    }
  });

  it("rejects fixture, remote, unreviewed and malformed starter manifests", () => {
    const records = OFFLINE_CATALOGUE
      .map((value) => parseCatalogAsset(value))
      .filter((value) => value !== null);
    const productKits = parseProductKitCatalogue(PRODUCT_KIT_SIDECAR, {
      catalogPackId: "offline-core-v1",
      catalogSha256: CATALOG_HASH,
      records: records.map((record) => ({
        id: record.id,
        masterSha256: record.masterSha256 ?? "",
        delivery: record.delivery,
        kind: record.kind,
        files: { master: record.files.master },
        dimensions: { ...record.dimensions },
        classroomReviewed: record.classroomReviewed,
        brandFree: record.brandFree
      }))
    })!;
    const context = { records, productKits };
    const bad = structuredClone(STUDENT_STARTERS) as {
      starters: Array<Record<string, unknown>>;
    };

    bad.starters[3]!.assetId = "performance-fixture-raster";
    expect(parseStudentStarterManifest(bad, context)).toBeNull();

    const duplicate = structuredClone(STUDENT_STARTERS) as {
      starters: Array<Record<string, unknown>>;
    };
    duplicate.starters[4]!.id = duplicate.starters[3]!.id;
    expect(parseStudentStarterManifest(duplicate, context)).toBeNull();

    expect(parseStudentStarterManifest({
      ...STUDENT_STARTERS,
      fillProfiles: {
        ...STUDENT_STARTERS.fillProfiles,
        "bounded-linework-v1": {
          ...STUDENT_STARTERS.fillProfiles["bounded-linework-v1"],
          lineDarknessThreshold: 221
        }
      }
    }, context)).toBeNull();
  });
});
