import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { STUDENT_COPY_SOURCE_PATHS } from "./student-copy-corpus.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

async function walk(relativeDirectory) {
  const absoluteDirectory = path.join(ROOT, ...relativeDirectory.split("/"));
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await walk(relative));
    else files.push(relative);
  }
  return files;
}

const TYPESCRIPT_EMITTER_PATTERNS = Object.freeze([
  /\.textContent\s*=/,
  /\.innerHTML\s*=/,
  /insertAdjacentHTML\s*\(/,
  /setAttribute\(\s*["'](?:aria-label|title|placeholder|alt)["']/,
  /\.(?:ariaLabel|placeholder|title|alt)\s*=/,
  /<(?:button|label|p|h[1-6]|span|option|li|dt|dd|summary)\b/i,
  /new\s+Option\s*\(/,
  /\b(?:alert|confirm)\s*\(/
]);

const GODOT_EMITTER_PATTERN = /(?:^|\n)\s*(?:text|tooltip_text|placeholder_text)\s*=|\.text\s*=/;

test("every authored file capable of emitting student-facing text is in the corpus source list", async () => {
  const listed = new Set(STUDENT_COPY_SOURCE_PATHS);
  const webFiles = (await walk("web/src"))
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && !file.endsWith(".d.ts"));
  const godotFiles = (await walk("godot/src"))
    .filter((file) => file.endsWith(".gd") || file.endsWith(".tscn"));

  const candidates = [];
  for (const file of webFiles) {
    if (listed.has(file)) continue;
    const source = await readFile(path.join(ROOT, ...file.split("/")), "utf8");
    if (TYPESCRIPT_EMITTER_PATTERNS.some((pattern) => pattern.test(source))) candidates.push(file);
  }
  for (const file of godotFiles) {
    if (listed.has(file)) continue;
    const source = await readFile(path.join(ROOT, ...file.split("/")), "utf8");
    if (GODOT_EMITTER_PATTERN.test(source)) candidates.push(file);
  }

  assert.deepEqual(candidates, []);
});
