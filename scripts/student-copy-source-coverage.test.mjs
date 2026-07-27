import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  COPY_SOURCE_AUDIENCE,
  extractStudentCopyFile,
  STUDENT_COPY_JSON_SOURCES,
  STUDENT_COPY_SOURCE_PATHS
} from "./student-copy-corpus.mjs";

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
  const godotWebFiles = (await walk("godot/web"))
    .filter((file) => file.endsWith(".html"));

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
  for (const file of godotWebFiles) {
    if (!listed.has(file)) candidates.push(file);
  }

  assert.deepEqual(candidates, []);
});

test("student Image Lab sources contain no teacher capability route or shared code control", async () => {
  const studentImageLabPaths = [
    "web/src/ai-image/image-lab-client.ts",
    "web/src/ai-image/image-lab-panel.ts",
    "web/src/ai-image/image-lab-runtime.ts",
    "web/src/main.ts"
  ];
  const forbidden = [
    "/api/image-lab/unlock",
    "/api/image-lab/lock",
    "IMAGE_LAB_CLASSROOM_CODE",
    "Teacher code",
    "Open Image Lab",
    "Close Image Lab"
  ];
  for (const relativePath of studentImageLabPaths) {
    const source = await readFile(path.join(ROOT, ...relativePath.split("/")), "utf8");
    for (const phrase of forbidden) {
      assert.equal(
        source.includes(phrase),
        false,
        `${relativePath} must not contain ${phrase}`
      );
    }
  }
  assert.equal(
    COPY_SOURCE_AUDIENCE["web/src/teacher/teacher-dashboard.ts"],
    "teacher"
  );
});

test("every approved runtime JSON label has an explicit corpus selector", async () => {
  const expected = {
    "catalog/generated/offline-core-v1/catalog.json": [
      "/*/title"
    ],
    "catalog/generated/offline-core-v1/product-kit-v1.json": [
      "/kits/*/title",
      "/components/*/title"
    ],
    "catalog/generated/offline-core-v1/product-kit-pricing-v1.json": [
      "/blueprints/*/title",
      "/groups/*/label",
      "/choices/*/label"
    ],
    "catalog/generated/product-builder-pilot-v1/catalogue.json": [
      "/bodies/*/title",
      "/families/*/title",
      "/materials/*/title",
      "/palettes/*/title",
      "/parts/*/title"
    ],
    "catalog/generated/product-shells-v1-reviewed/catalog.json": [
      "/families/*/title",
      "/shells/*/title"
    ],
    "catalog/generated/offline-core-v1/student-starters-v1.json": [
      "/starters/*/title",
      "/starters/*/category"
    ]
  };
  assert.deepEqual(
    Object.fromEntries(STUDENT_COPY_JSON_SOURCES.map(({ path: sourcePath, selectors }) => [
      sourcePath,
      selectors
    ])),
    expected
  );
  for (const sourcePath of Object.keys(expected)) {
    assert.ok(STUDENT_COPY_SOURCE_PATHS.includes(sourcePath));
    const entries = await extractStudentCopyFile(ROOT, sourcePath);
    assert.ok(entries.length > 0, `${sourcePath} must contribute visible copy`);
    assert.ok(entries.every(({ pointer, text }) =>
      typeof pointer === "string" && pointer.startsWith("/") &&
      typeof text === "string" && text.length > 0));
  }
});

test("runtime-rendered generated fields are classified before they reach students", async () => {
  const selectors = new Map(STUDENT_COPY_JSON_SOURCES.map((source) => [
    source.path,
    new Set(source.selectors)
  ]));
  const cases = [
    {
      runtime: "web/src/catalogue/catalogue-runtime.ts",
      token: "asset.title",
      source: "catalog/generated/offline-core-v1/catalog.json",
      selector: "/*/title"
    },
    {
      runtime: "web/src/catalogue/catalogue-runtime.ts",
      token: "kit.title",
      source: "catalog/generated/offline-core-v1/product-kit-v1.json",
      selector: "/kits/*/title"
    },
    {
      runtime: "web/src/product-kit/product-kit-panel.ts",
      token: "certifiedChoice.item.title",
      source: "catalog/generated/offline-core-v1/product-kit-v1.json",
      selector: "/components/*/title"
    },
    {
      runtime: "web/src/product-kit/product-kit-panel.ts",
      token: "groupLabel",
      source: "catalog/generated/offline-core-v1/product-kit-pricing-v1.json",
      selector: "/groups/*/label"
    },
    {
      runtime: "web/src/product-builder/product-builder-panel.ts",
      token: "record.title",
      source: "catalog/generated/product-builder-pilot-v1/catalogue.json",
      selector: "/bodies/*/title"
    },
    {
      runtime: "web/src/product-shells/product-shell-picker.ts",
      token: "family.title",
      source: "catalog/generated/product-shells-v1-reviewed/catalog.json",
      selector: "/families/*/title"
    },
    {
      runtime: "web/src/product-shells/product-shell-picker.ts",
      token: "shell.title",
      source: "catalog/generated/product-shells-v1-reviewed/catalog.json",
      selector: "/shells/*/title"
    },
    {
      runtime: "web/src/product-kit/product-kit-panel.ts",
      token: "starter.record.category",
      source: "catalog/generated/offline-core-v1/student-starters-v1.json",
      selector: "/starters/*/category"
    }
  ];
  for (const item of cases) {
    const runtime = await readFile(path.join(ROOT, ...item.runtime.split("/")), "utf8");
    assert.ok(runtime.includes(item.token), `${item.runtime} must still render ${item.token}`);
    assert.ok(
      selectors.get(item.source)?.has(item.selector),
      `${item.source} ${item.selector} must be classified`
    );
  }
});
