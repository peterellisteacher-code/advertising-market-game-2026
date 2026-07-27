import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertProductionCataloguesSafe,
  findForbiddenCatalogueValues,
  productionCatalogueSources
} from "./production-catalogue-safety.mjs";

test("reports every forbidden value with its exact source path and record ID", () => {
  const findings = findForbiddenCatalogueValues(
    "catalog/generated/example/catalog.json",
    [
      { id: "starter-1", title: "QA bottle" },
      { assetId: "starter-2", sourceUrl: "https://example.invalid/source" },
      { recordId: "starter-3", notes: ["Synthetic Test", "test-only"] },
      { id: "starter-4", title: "Fixture carton" }
    ]
  );

  assert.deepEqual(
    findings.map(({ sourcePath, recordId, jsonPath, marker }) => ({
      sourcePath,
      recordId,
      jsonPath,
      marker
    })),
    [
      {
        sourcePath: "catalog/generated/example/catalog.json",
        recordId: "starter-1",
        jsonPath: "$[0].title",
        marker: "QA"
      },
      {
        sourcePath: "catalog/generated/example/catalog.json",
        recordId: "starter-2",
        jsonPath: "$[1].sourceUrl",
        marker: "example.invalid"
      },
      {
        sourcePath: "catalog/generated/example/catalog.json",
        recordId: "starter-3",
        jsonPath: "$[2].notes[0]",
        marker: "synthetic test"
      },
      {
        sourcePath: "catalog/generated/example/catalog.json",
        recordId: "starter-3",
        jsonPath: "$[2].notes[1]",
        marker: "test-only"
      },
      {
        sourcePath: "catalog/generated/example/catalog.json",
        recordId: "starter-4",
        jsonPath: "$[3].title",
        marker: "fixture"
      }
    ]
  );
});

test("scans every catalogue, pricing manifest and starter manifest copied into a release", async () => {
  const sources = await productionCatalogueSources(process.cwd());
  assert.deepEqual(sources.map(({ relativePath }) => relativePath), [
    "catalog/generated/offline-core-v1/catalog.json",
    "catalog/generated/offline-core-v1/pricing.json",
    "catalog/generated/offline-core-v1/product-kit-pricing-v1.json",
    "catalog/generated/offline-core-v1/student-starters-v1.json",
    "catalog/generated/product-builder-pilot-v1/catalogue.json",
    "catalog/generated/product-shells-v1-reviewed/catalog.json"
  ]);

  await assertProductionCataloguesSafe(process.cwd());
});
