import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  buildStudentCopyCorpus,
  extractGodotSourceLiterals,
  extractHtmlCopy,
  extractJsonCopy,
  extractTscnText,
  extractTypeScriptLiterals,
  stableCopyId,
  stableJsonCopyId
} from "./student-copy-corpus.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

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
    get_node_or_null("Stations/%s" % station_name)
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

test("extractHtmlCopy reads visible shell copy and inline-script status text with source lines", () => {
  const source = `<!doctype html>
    <main aria-label="Advertising Market Game">
      <p>Loading game…</p>
    </main>
    <script src="./runtime.js"></script>
    <script>
      status.textContent = "Game ready";
      console.error("Internal bootstrap failure");
    </script>`;

  assert.deepEqual(
    extractHtmlCopy(source, "godot/web/godot_shell.html").map(({ line, text }) => ({ line, text })),
    [
      { line: 2, text: "Advertising Market Game" },
      { line: 3, text: "Loading game…" },
      { line: 7, text: "Game ready" }
    ]
  );
});

test("stableCopyId is deterministic for a source occurrence", () => {
  assert.equal(
    stableCopyId("web/src/game/student-copy.ts", 42, 3),
    "WEB_SRC_GAME_STUDENT_COPY_TS__L0042__N03"
  );
});

test("JSON copy uses selected authored fields and stable JSON-pointer IDs", () => {
  const source = {
    kits: [
      {
        id: "pk1-tumbler-kit",
        title: "Reusable tumbler",
        component: { title: "Not selected" }
      }
    ],
    choices: [
      { id: "pk1-price-flat-lid", label: "Flat lid", costCents: 200 }
    ]
  };
  assert.deepEqual(
    extractJsonCopy(
      source,
      "catalog/generated/example.json",
      ["/kits/*/title", "/choices/*/label"]
    ),
    [
      {
        path: "catalog/generated/example.json",
        pointer: "/kits/0/title",
        text: "Reusable tumbler"
      },
      {
        path: "catalog/generated/example.json",
        pointer: "/choices/0/label",
        text: "Flat lid"
      }
    ]
  );
  assert.equal(
    stableJsonCopyId("catalog/generated/example.json", "/kits/0/title"),
    "catalog/generated/example.json#/kits/0/title"
  );
});

test("teacher dashboard copy is covered and classified separately from student copy", async () => {
  const corpus = await buildStudentCopyCorpus(ROOT);
  const teacherEntries = corpus.filter(({ path: sourcePath }) =>
    sourcePath === "web/src/teacher/teacher-dashboard.ts");
  assert.ok(teacherEntries.length > 0);
  assert.ok(teacherEntries.every(({ audience }) => audience === "teacher"));
  assert.ok(corpus.some(({ audience }) => audience === "student"));
});
