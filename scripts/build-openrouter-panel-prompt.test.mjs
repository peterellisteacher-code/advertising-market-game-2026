import assert from "node:assert/strict";
import test from "node:test";

import { fillPanelTemplate } from "./build-openrouter-panel-prompt.mjs";

test("fills each immutable panel evidence slot once", () => {
  const result = fillPanelTemplate({
    template: "A\n{{FLOW}}\nB\n{{COPY}}\nC\n{{VISUAL_FACTS}}\nD",
    flow: "FLOW TEXT",
    copy: "[COPY__L0001__N01] Copy text.",
    visualFacts: "VISUAL TEXT",
  });
  assert.equal(result, "A\nFLOW TEXT\nB\n[COPY__L0001__N01] Copy text.\nC\nVISUAL TEXT\nD");
  assert.equal(result.includes("{{"), false);
});

test("rejects missing or duplicate template slots", () => {
  for (const template of [
    "{{FLOW}} {{COPY}}",
    "{{FLOW}} {{FLOW}} {{COPY}} {{VISUAL_FACTS}}",
  ]) {
    assert.throws(() => fillPanelTemplate({ template, flow: "F", copy: "C", visualFacts: "V" }));
  }
});
