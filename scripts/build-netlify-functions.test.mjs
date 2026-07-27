import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { buildNetlifyFunctions } from "./build-netlify-functions.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

test("function build emits one exact wrapper-and-bundle manifest", async () => {
  const result = await buildNetlifyFunctions({ root: ROOT, log: () => {} });
  const manifestPath = path.join(
    ROOT,
    "netlify",
    "function-bundles",
    "function-manifest.json"
  );
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  assert.equal(result.manifestPath, manifestPath);
  assert.equal(manifest.schema, "ad-market-function-manifest@1");
  assert.deepEqual(manifest.functions.map(({ name }) => name), [
    "account-assets",
    "account-progress",
    "account-reset",
    "account-session",
    "image-lab-jobs",
    "image-lab-session",
    "market-room",
    "market-session",
    "openverse-image",
    "openverse-search",
    "product-price-guide",
    "studio-coach",
    "teacher-session"
  ]);

  for (const entry of manifest.functions) {
    for (const part of ["wrapper", "bundle"]) {
      const record = entry[part];
      const bytes = await readFile(path.join(ROOT, "netlify", ...record.path.split("/")));
      assert.equal(record.bytes, bytes.byteLength);
      assert.equal(
        record.sha256,
        createHash("sha256").update(bytes).digest("hex")
      );
    }
  }
});
