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
    "Invent it. Advertise it. Judge the market.",
    "Wake Image Lab",
    "Teacher code",
    "Follow the highlighted tool step",
    "Both roles made a change",
    "HANDLER_ERROR",
    "Cloud save restored at revision",
    "final wrapping",
    "wraps perfectly",
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

test("the web game reuses advertisement language instead of campaign aliases", async () => {
  const corpus = await buildStudentCopyCorpus(ROOT);
  const webGameCopy = corpus
    .filter(({ path: sourcePath }) => sourcePath.startsWith("web/"))
    .filter(({ path: sourcePath }) => !sourcePath.includes("/account/"));

  assert.deepEqual(
    webGameCopy
      .filter(({ text }) => /\bcampaign\b/iu.test(text))
      .map(({ path: sourcePath, line, text }) => `${sourcePath}:${line}: ${text}`),
    [],
    "student-facing web copy must call the work an advertisement, not alternate with campaign"
  );
});

test("authored Godot copy uses advertising terms instead of game-system vocabulary", async () => {
  const corpus = (await buildStudentCopyCorpus(ROOT)).filter(
    ({ audience, path: sourcePath }) => audience === "student" && sourcePath.startsWith("godot/")
  );
  const bannedTerms = [
    [/\bcampaign goals?\b/i, "use goal"],
    [/\b(?:current )?objectives?\b/i, "use next task or task"],
    [/\bstations?\b/i, "use room"],
    [/\boptional contracts?\b/i, "use optional practice"],
    [/\bmissions?\b/i, "use task"],
    [/\bapprovals?\b/i, "use complete where applicable"],
    [/\b(?:brief|colour system|framing desk|aida sequence) approved\b/i, "use complete"],
    [/\bcampaigns?\b/i, "use advertisement or work for what students make or save"]
  ];
  const violations = [];

  for (const entry of corpus) {
    for (const [pattern, replacement] of bannedTerms) {
      if (pattern.test(entry.text)) {
        violations.push(`${entry.path}:${entry.line ?? entry.pointer}: ${entry.text} (${replacement})`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
