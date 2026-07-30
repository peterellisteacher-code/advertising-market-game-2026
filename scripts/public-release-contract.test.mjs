import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("public documentation contains no private deployment record or target", async () => {
  const [account, accountSql, imageLab, liveMarket, release, deployScript] = await Promise.all([
    read("docs/operations/advertising-game-account-progress.md"),
    read("docs/operations/advertising-game-account-progress.sql"),
    read("docs/operations/image-lab.md"),
    read("docs/operations/live-market.md"),
    read("docs/operations/release-workflow.md"),
    read("scripts/deploy-netlify-artifact.mjs"),
  ]);
  const operationDocs = [account, accountSql, imageLab, liveMarket, release].join("\n");
  const publicSurface = `${operationDocs}\n${deployScript}`;

  assert.doesNotMatch(publicSurface, /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/iu);
  assert.doesNotMatch(publicSurface, /https:\/\/[a-z]{20}\.supabase\.co/iu);
  assert.doesNotMatch(publicSurface, /github\.com\/[^/\s]+\/advertising-market-game/iu);
  assert.match(account, /SUPABASE_PROJECT_REF=<project-ref>/u);
  assert.match(liveMarket, /NETLIFY_SITE_ID=<site-id>/u);
  assert.doesNotMatch(release, /Verified release record|What went wrong during/u);
  assert.doesNotMatch(operationDocs, /\bPeter(?:'s)?\b/u);
  assert.equal(existsSync(path.join(root, "docs", "operations", "games-workshop-card.md")), false);
});

test("deployment documentation requires the caller's own explicit site ID", async () => {
  const readme = await read("README.md");
  assert.match(
    readme,
    /deploy:draft --artifact "C:\\path\\to\\downloaded-artifact" --site-id "<your-netlify-site-id>"/u
  );
  assert.match(
    readme,
    /deploy:production --artifact "C:\\path\\to\\downloaded-artifact" --site-id "<your-netlify-site-id>"/u
  );
});

test("vendored Tabler icons carry their notice and project assets define one public term", async () => {
  const [credits, tablerLicense] = await Promise.all([
    read("CREDITS.md"),
    read("catalog/source/logo-icons-tabler-v1/vendor/LICENSE"),
  ]);

  assert.match(tablerLicense, /Copyright \(c\) 2020-2026 Paweł Kuna/u);
  assert.match(tablerLicense, /Permission is hereby granted, free of charge/u);
  assert.match(
    credits,
    /catalog\/source\/logo-icons-tabler-v1\/vendor\/LICENSE/u
  );
  assert.match(
    credits,
    /`Classroom-session use` is shorthand for this exact permission/u
  );
});

test("retained operation guides do not link deleted research or review records", async () => {
  const imageLab = await read("docs/operations/image-lab.md");
  assert.doesNotMatch(imageLab, /\.\.\/(?:research|reviews)\//u);
});

test("public asset provenance does not depend on private plans or reviews", async () => {
  const [agencySources, audioSources] = await Promise.all([
    read("godot/assets/agency/ASSET-SOURCES.md"),
    read("godot/assets/audio/ASSET-SOURCES.md"),
  ]);
  const publicProvenance = `${agencySources}\n${audioSources}`;

  assert.doesNotMatch(publicProvenance, /docs\/superpowers\/|(?:^|[\s`"'(])reviews\//mu);
});
