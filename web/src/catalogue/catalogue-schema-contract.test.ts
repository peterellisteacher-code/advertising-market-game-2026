import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseCatalogAsset } from "./catalogue-store";

interface ContractCorpus {
  valid: Array<{ name: string; value: unknown }>;
  invalid: Array<{ name: string; value: unknown }>;
  derivedInvalid: Array<{
    name: string;
    baseValid: number;
    path: string[];
    value: unknown;
  }>;
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

  for (const candidate of corpus.derivedInvalid) {
    it(`rejects ${candidate.name}`, () => {
      const base = corpus.valid[candidate.baseValid];
      if (!base) throw new Error(`missing valid corpus base ${candidate.baseValid}`);
      const value = structuredClone(base.value) as Record<string, unknown>;
      let target = value;
      for (const segment of candidate.path.slice(0, -1)) {
        const next = target[segment];
        if (!next || typeof next !== "object" || Array.isArray(next)) {
          throw new Error(`invalid derived corpus path ${candidate.path.join(".")}`);
        }
        target = next as Record<string, unknown>;
      }
      const finalSegment = candidate.path.at(-1);
      if (!finalSegment) throw new Error("derived corpus path is empty");
      target[finalSegment] = structuredClone(candidate.value);
      expect(parseCatalogAsset(value)).toBeNull();
    });
  }

  it("rejects reviewed semantic parity edge cases without weakening the 8192-axis limit", () => {
    const firstValid = corpus.valid[0];
    if (!firstValid) throw new Error("contract corpus has no valid offline fixture");
    const base = firstValid.value as Record<string, unknown>;
    const invalid: Record<string, unknown>[] = [];

    invalid.push({ ...structuredClone(base), tags: ["drinkware", "bottle"] });
    invalid.push({ ...structuredClone(base), dimensions: { width: 8192, height: 8192 } });

    const duplicateAnchor = structuredClone(base) as Record<string, any>;
    duplicateAnchor.anchors.push({ id: "lid", x: 0.6, y: 0.2, accepts: ["cap"] });
    invalid.push(duplicateAnchor);

    invalid.push({ ...structuredClone(base), defaultZoneStyles: {} });
    invalid.push({ ...structuredClone(base), title: " Basic bottle " });
    invalid.push({ ...structuredClone(base), title: "x".repeat(161) });

    const unsafeAttribution = structuredClone(base) as Record<string, any>;
    unsafeAttribution.attribution.sourceUrl = "file:///classroom-secret";
    invalid.push(unsafeAttribution);

    for (const candidate of invalid) expect(parseCatalogAsset(candidate)).toBeNull();

    expect(parseCatalogAsset({
      ...structuredClone(base),
      dimensions: { width: 8192, height: 1 }
    })).not.toBeNull();
  });
});
