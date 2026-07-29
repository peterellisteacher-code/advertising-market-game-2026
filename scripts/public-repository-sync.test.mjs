import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRepositoriesMatch,
  PUBLIC_REPOSITORIES,
  parseMainRef
} from "./verify-public-repository-sync.mjs";

const matchingSha = "0123456789abcdef0123456789abcdef01234567";

test("repository verification accepts the sole canonical main ref", () => {
  const canonical = PUBLIC_REPOSITORIES[0];
  assert.equal(
    assertRepositoriesMatch([
      { repository: canonical, sha: matchingSha }
    ]),
    matchingSha
  );

  assert.throws(
    () => assertRepositoriesMatch([
      { repository: "https://github.com/example/unapproved-mirror.git", sha: matchingSha }
    ]),
    /sole canonical public repository/u
  );
});

test("repository verification can require the checked-out release commit", () => {
  const canonical = PUBLIC_REPOSITORIES[0];
  assert.equal(
    assertRepositoriesMatch(
      [
        { repository: canonical, sha: matchingSha }
      ],
      matchingSha
    ),
    matchingSha
  );
  assert.throws(
    () => assertRepositoriesMatch(
      [
        { repository: canonical, sha: matchingSha }
      ],
      "89abcdef0123456789abcdef0123456789abcdef"
    ),
    /does not match the checked-out release commit/u
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
