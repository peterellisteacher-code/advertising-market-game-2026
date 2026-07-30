import assert from "node:assert/strict";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";

import {
  planScrubSections,
  writeScrubSections
} from "./student-copy-scrub-sections.mjs";

const fixture = Object.freeze([
  {
    id: "SOURCE_A__L0001__N01",
    audience: "student",
    path: "source-a.ts",
    line: 1,
    text: "First instruction."
  },
  {
    id: "SOURCE_A__L0120__N01",
    audience: "student",
    path: "source-a.ts",
    line: 120,
    text: "Café — keep the punctuation."
  },
  {
    id: "SOURCE_B__L0004__N01",
    audience: "student",
    path: "source-b.ts",
    line: 4,
    text: "First instruction."
  },
  {
    id: "catalog/example.json#/items/0/title",
    audience: "student",
    path: "catalog/example.json",
    pointer: "/items/0/title",
    text: "Third instruction."
  }
]);

test("sections each unique string once and maps every source occurrence", () => {
  const firstTwoBytes = Buffer.byteLength(
    `${fixture[0].text}\n${fixture[1].text}\n`,
    "utf8"
  );
  const planned = planScrubSections(fixture, firstTwoBytes);

  assert.deepEqual(
    planned.files.map(({ name, content }) => ({ name, content })),
    [
      {
        name: "section-001.txt",
        content: "First instruction.\nCafé — keep the punctuation.\n"
      },
      {
        name: "section-002.txt",
        content: "Third instruction.\n"
      }
    ]
  );
  assert.equal(planned.manifest.schema, "admarket-student-copy-scrub-sections@1");
  assert.equal(planned.manifest.occurrenceCount, 4);
  assert.equal(planned.manifest.uniqueTextCount, 3);
  assert.equal(planned.manifest.sectionCount, 2);
  assert.deepEqual(
    planned.manifest.sections.flatMap(({ lines }) =>
      lines.map(({ orderedLineNumber }) => orderedLineNumber)),
    [1, 2, 3]
  );
  assert.deepEqual(
    planned.manifest.sections[0].lines[0].occurrences,
    [
      {
        id: "SOURCE_A__L0001__N01",
        path: "source-a.ts",
        line: 1
      },
      {
        id: "SOURCE_B__L0004__N01",
        path: "source-b.ts",
        line: 4
      }
    ]
  );
  assert.deepEqual(
    planned.manifest.sections[1].lines[0].occurrences,
    [{
      id: "catalog/example.json#/items/0/title",
      path: "catalog/example.json",
      pointer: "/items/0/title"
    }]
  );
  assert.ok(planned.manifest.sections.every(({ utf8Bytes }) =>
    utf8Bytes <= firstTwoBytes));
  assert.ok(planned.manifest.sections.every(({ sha256 }) =>
    /^[a-f0-9]{64}$/.test(sha256)));
  assert.ok(planned.manifest.sections.flatMap(({ lines }) => lines)
    .every(({ textSha256 }) => /^[a-f0-9]{64}$/.test(textSha256)));
  assert.equal(
    planned.files.map(({ content }) => content).join(""),
    "First instruction.\nCafé — keep the punctuation.\nThird instruction.\n"
  );
});

test("rejects an oversized string, duplicate stable ID or non-deterministic source record", () => {
  assert.throws(
    () => planScrubSections(fixture, Buffer.byteLength(fixture[1].text, "utf8")),
    /does not fit in one scrub section/
  );
  assert.throws(
    () => planScrubSections([...fixture, { ...fixture[0], text: "Other" }], 12_000),
    /duplicate stable copy ID/
  );
  assert.throws(
    () => planScrubSections([{
      id: "BROKEN",
      audience: "student",
      path: "broken.ts",
      text: "Missing location."
    }], 12_000),
    /source line or JSON pointer/
  );
});

test("writes a new zero-padded section set and refuses an existing output directory", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-copy-sectioner-"));
  const corpusPath = path.join(root, "corpus.json");
  const outputDir = path.join(root, "sections");
  await writeFile(corpusPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");

  const result = await writeScrubSections({
    corpusPath,
    outputDir,
    maxUtf8Bytes: 51
  });
  assert.deepEqual(
    (await readdir(outputDir)).sort(),
    ["manifest.json", "section-001.txt", "section-002.txt"]
  );
  assert.equal(
    await readFile(path.join(outputDir, "section-001.txt"), "utf8"),
    result.files[0].content
  );
  const manifest = JSON.parse(
    await readFile(path.join(outputDir, "manifest.json"), "utf8")
  );
  assert.equal(manifest.corpusSha256, result.manifest.corpusSha256);
  assert.match(manifest.corpusSha256, /^[a-f0-9]{64}$/);
  await assert.rejects(
    writeScrubSections({ corpusPath, outputDir, maxUtf8Bytes: 51 }),
    /output directory already exists/
  );
});
