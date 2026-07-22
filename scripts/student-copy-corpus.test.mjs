import assert from "node:assert/strict";
import test from "node:test";

import {
  extractGodotSourceLiterals,
  extractTscnText,
  extractTypeScriptLiterals,
  stableCopyId
} from "./student-copy-corpus.mjs";

test("extractTypeScriptLiterals keeps visible prose and skips technical identifiers and invariants", () => {
  const source = `
    const id = "round-zero";
    const code = "ACCOUNT_UNAVAILABLE";
    const label = "Start with one visible change.";
    panel.innerHTML = \`<button aria-label="Open market">Enter market</button>\`;
    throw new Error("Campaign Creator is missing [data-root]");
  `;

  assert.deepEqual(
    extractTypeScriptLiterals(source, "web/src/example.ts").map(({ text }) => text),
    [
      "Start with one visible change.",
      "Open market",
      "Enter market"
    ]
  );
});

test("extractGodotSourceLiterals keeps student copy but skips node paths and signals", () => {
  const source = `
    @onready var prompt: Label = $Layout/Prompt
    prompt.text = "Choose one product to begin."
    emit_signal("market_ready")
    _set_status("Saved on this MacBook.")
  `;

  assert.deepEqual(
    extractGodotSourceLiterals(source, "godot/src/example.gd").map(({ text }) => text),
    ["Choose one product to begin.", "Saved on this MacBook."]
  );
});

test("extractTscnText reads authored text properties only", () => {
  const source = `
    [node name="Heading" type="Label"]
    text = "Build your first product."
    tooltip_text = "Choose one option."
    unique_name_in_owner = true
  `;

  assert.deepEqual(
    extractTscnText(source, "godot/src/example.tscn").map(({ text }) => text),
    ["Build your first product.", "Choose one option."]
  );
});

test("stableCopyId is deterministic for a source occurrence", () => {
  assert.equal(
    stableCopyId("web/src/game/student-copy.ts", 42, 3),
    "WEB_SRC_GAME_STUDENT_COPY_TS__L0042__N03"
  );
});
