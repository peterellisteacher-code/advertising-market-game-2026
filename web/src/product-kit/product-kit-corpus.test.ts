import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseProductKitCatalogue,
  type ProductKitCatalogueContext
} from "./product-kit-catalogue";

interface CorpusMutation {
  readonly name: string;
  readonly target: "value" | "context";
  readonly path: readonly (string | number)[];
  readonly value: unknown;
  readonly structural: boolean;
}

interface ProductKitCorpus {
  readonly schema: "product-kit-corpus@1";
  readonly context: ProductKitCatalogueContext;
  readonly valid: readonly [{ readonly name: string; readonly value: unknown }];
  readonly derivedValid: readonly Omit<CorpusMutation, "structural">[];
  readonly derivedInvalid: readonly CorpusMutation[];
}

const CORPUS = JSON.parse(readFileSync(
  resolve("catalog/schemas/product-kit-v1.corpus.json"),
  "utf8"
)) as ProductKitCorpus;

function setPath(root: unknown, path: readonly (string | number)[], value: unknown): void {
  if (root === null || typeof root !== "object" || path.length === 0) {
    throw new TypeError("corpus mutation path requires a non-empty object path");
  }
  let target = root as Record<string | number, unknown>;
  for (const segment of path.slice(0, -1)) {
    const next = target[segment];
    if (next === null || typeof next !== "object") {
      throw new TypeError(`invalid corpus mutation segment: ${String(segment)}`);
    }
    target = next as Record<string | number, unknown>;
  }
  target[path.at(-1)!] = value;
}

describe("shared product-kit corpus", () => {
  it("accepts the canonical four-mode value", () => {
    expect(CORPUS.schema).toBe("product-kit-corpus@1");
    expect(parseProductKitCatalogue(CORPUS.valid[0].value, CORPUS.context)).not.toBeNull();
  });

  it.each(CORPUS.derivedValid)("accepts $name", (testCase) => {
    const value = structuredClone(CORPUS.valid[0].value);
    const context = structuredClone(CORPUS.context);
    setPath(testCase.target === "value" ? value : context, testCase.path, testCase.value);

    expect(parseProductKitCatalogue(value, context)).not.toBeNull();
  });

  it.each(CORPUS.derivedInvalid)("rejects $name", (testCase) => {
    const value = structuredClone(CORPUS.valid[0].value);
    const context = structuredClone(CORPUS.context);
    setPath(testCase.target === "value" ? value : context, testCase.path, testCase.value);

    expect(parseProductKitCatalogue(value, context)).toBeNull();
  });
});
