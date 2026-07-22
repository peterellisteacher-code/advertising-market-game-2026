import assert from "node:assert/strict";
import test from "node:test";

import { fillCodePanelTemplate } from "./build-code-panel-prompt.mjs";

test("fills every immutable code-panel slot exactly once", () => {
  const result = fillCodePanelTemplate({
    template: "A\n{{MANIFEST}}\nB\n{{VERIFICATION}}\nC\n{{FILES}}\nD",
    manifest: "manifest",
    verification: "verification",
    files: "files",
  });
  assert.equal(result, "A\nmanifest\nB\nverification\nC\nfiles\nD");
  assert.equal(result.includes("{{"), false);
});

test("allows placeholder-like syntax inside supplied code evidence", () => {
  const result = fillCodePanelTemplate({
    template: "{{MANIFEST}}\n{{VERIFICATION}}\n{{FILES}}",
    manifest: "manifest",
    verification: "verification",
    files: "const token = `{{FLOW}}`;",
  });
  assert.equal(result.endsWith("const token = `{{FLOW}}`;"), true);
});

test("rejects a missing or duplicate code-panel slot", () => {
  for (const template of [
    "{{MANIFEST}} {{VERIFICATION}}",
    "{{MANIFEST}} {{MANIFEST}} {{VERIFICATION}} {{FILES}}",
  ]) {
    assert.throws(() => fillCodePanelTemplate({ template, manifest: "M", verification: "V", files: "F" }));
  }
});
