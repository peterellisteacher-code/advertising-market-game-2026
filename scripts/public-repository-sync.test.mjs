import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assertRepositoriesMatch,
  parseMainRef
} from "./verify-public-repository-sync.mjs";

const matchingSha = "0123456789abcdef0123456789abcdef01234567";

test("repository synchronization accepts only identical main refs", () => {
  assert.equal(
    assertRepositoriesMatch([
      { repository: "first", sha: matchingSha },
      { repository: "second", sha: matchingSha }
    ]),
    matchingSha
  );

  assert.throws(
    () => assertRepositoriesMatch([
      { repository: "first", sha: matchingSha },
      {
        repository: "second",
        sha: "89abcdef0123456789abcdef0123456789abcdef"
      }
    ]),
    /Public repository main branches differ/u
  );
});

test("repository synchronization can require the checked-out release commit", () => {
  assert.equal(
    assertRepositoriesMatch(
      [
        { repository: "first", sha: matchingSha },
        { repository: "second", sha: matchingSha }
      ],
      matchingSha
    ),
    matchingSha
  );
  assert.throws(
    () => assertRepositoriesMatch(
      [
        { repository: "first", sha: matchingSha },
        { repository: "second", sha: matchingSha }
      ],
      "89abcdef0123456789abcdef0123456789abcdef"
    ),
    /do not match the checked-out release commit/u
  );
});

test("main-ref parsing fails closed on missing or malformed output", () => {
  assert.equal(
    parseMainRef(
      "https://github.com/example/project.git",
      `${matchingSha}\trefs/heads/main\n`
    ),
    matchingSha
  );
  assert.throws(
    () => parseMainRef("https://github.com/example/project.git", ""),
    /did not return exactly one main ref/u
  );
  assert.throws(
    () => parseMainRef(
      "https://github.com/example/project.git",
      `not-a-sha\trefs/heads/main\n`
    ),
    /did not return exactly one main ref/u
  );
});

test("public instructions make dual-repository synchronization mandatory", async () => {
  const [agents, runbook, packageJson] = await Promise.all([
    readFile(new URL("../AGENTS.md", import.meta.url), "utf8"),
    readFile(
      new URL("../docs/operations/repository-synchronization.md", import.meta.url),
      "utf8"
    ),
    readFile(new URL("../package.json", import.meta.url), "utf8")
  ]);

  for (const source of [agents, runbook]) {
    assert.match(source, /advertising-market-game-2026/u);
    assert.match(source, /advertising-market-game(?!-2026)/u);
    assert.match(source, /identical commit SHA/u);
    assert.match(source, /verify:repo-sync --expect-local-head/u);
  }

  const scripts = JSON.parse(packageJson).scripts;
  assert.equal(
    scripts["verify:repo-sync"],
    "node scripts/verify-public-repository-sync.mjs"
  );
});
