import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseCatalogAsset } from "./catalogue-store";

interface ContractCorpus {
  valid: Array<{ name: string; value: unknown }>;
  invalid: Array<{ name: string; value: unknown }>;
}

const corpus = JSON.parse(readFileSync(resolve(
  process.cwd(),
  "catalog/schemas/catalog-asset-v1.corpus.json"
), "utf8")) as ContractCorpus;

describe("catalog-asset@1 shared contract corpus", () => {
  for (const candidate of corpus.valid) {
    it(`accepts ${candidate.name}`, () => {
      expect(parseCatalogAsset(candidate.value)).not.toBeNull();
    });
  }

  for (const candidate of corpus.invalid) {
    it(`rejects ${candidate.name}`, () => {
      expect(parseCatalogAsset(candidate.value)).toBeNull();
    });
  }
});
