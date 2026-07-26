import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { buildStudentCopyCorpus } from "./student-copy-corpus.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

test("student copy uses direct factual wording without obsolete promotional phrases", async () => {
  const corpus = await buildStudentCopyCorpus(ROOT);
  const text = corpus.map((entry) => entry.text).join("\n");

  assert.match(
    text,
    /First you will invent a product, then you will create an advertisement for it\./
  );
  for (const obsolete of [
    "Preparing a safe place for your pitch.",
    "select Practice explicitly.",
    "Refine the pitch until the market engages.",
    "final visual finish.",
    "Ad resting",
    "Object Forge sparks",
    "Make It Real sparks",
    "landed on your canvas.",
    "Attention: earn the first glance.",
    "Interest: reward the second glance.",
    "swap driver"
  ]) {
    assert.equal(text.includes(obsolete), false, `obsolete copy remains: ${obsolete}`);
  }

  assert.doesNotMatch(
    text,
    /\b(?:want|need|try|choose)\s+to\s+showcase\b/i,
    "student copy must not use showcase as an AI-style verb"
  );
});
