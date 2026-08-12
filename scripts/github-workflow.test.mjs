import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(root, ".github", "workflows", "build-and-publish.yml");

test("GitHub Actions validates and builds the complete web artifact without deploying", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /NO auto-deploy/u);
  assert.match(workflow, /GODOT_VERSION:\s*"4\.7\.1"/u);
  assert.match(workflow, /EXPORT_NAME:\s*"advertising-market-game"/u);
  assert.match(
    workflow,
    /image:\s*barichello\/godot-ci:4\.7\.1@sha256:622e5ca81b54cd8038ecf7de5d157b47efc800d7cf635af2eec18a6aee4bab7e/u
  );
  assert.doesNotMatch(workflow, /\$\{\{\s*vars\./u);
  assert.match(workflow, /permissions:\s*\r?\n\s+contents:\s*read/u);
  assert.match(workflow, /node scripts\/run-godot-tests\.mjs/u);
  assert.match(workflow, /godot --headless --path godot --export-release "Web"/u);
  assert.doesNotMatch(
    workflow,
    /godot --headless --path godot (?:--import|--script)/u,
    "the Godot gate must run through scripts/run-godot-tests.mjs so CI cannot skip the import or the SCRIPT ERROR check"
  );
  assert.ok(
    workflow.indexOf("node scripts/run-godot-tests.mjs") <
      workflow.indexOf('godot --headless --path godot --export-release "Web"'),
    "the Godot gate must pass before the release export is built"
  );
  assert.match(workflow, /pnpm test/u);
  assert.match(workflow, /pnpm typecheck/u);
  assert.match(
    workflow,
    /Install canvas native build prerequisites[\s\S]*?apt-get install[\s\S]*?libcairo2-dev[\s\S]*?libpango1\.0-dev[\s\S]*?libjpeg-dev[\s\S]*?libgif-dev[\s\S]*?librsvg2-dev/u,
    "the validation runner must be able to compile node-canvas when its prebuilt binary is unavailable"
  );
  assert.ok(
    workflow.indexOf("Install canvas native build prerequisites") <
      workflow.indexOf("Install locked dependencies"),
    "canvas build prerequisites must be installed before pnpm resolves the optional native peer"
  );
  assert.match(workflow, /actions\/setup-python@[0-9a-f]{40}/u);
  assert.match(workflow, /python-version:\s*"3\.12"/u);
  assert.match(workflow, /python -m pip install --requirement pipeline\/requirements\.txt/u);
  assert.match(
    workflow,
    /python -m pip install --no-deps --no-build-isolation --editable pipeline/u
  );
  assert.match(workflow, /python -m pytest pipeline\/tests -q/u);
  assert.match(workflow, /scripts\/build-web\.mjs\s+--require-offline-core/u);
  assert.match(workflow, /scripts\/verify-web-export\.mjs build\/web/u);
  assert.match(workflow, /if-no-files-found:\s*error/u);
  assert.match(
    workflow,
    /- name:\s*Upload complete web artifact[\s\S]*?include-hidden-files:\s*true/u
  );
  const usesLines = workflow.split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("uses:"));
  assert.ok(usesLines.length >= 8, "expected every external action step to be visible");
  for (const line of usesLines) {
    assert.match(line, /^uses:\s+[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+@[0-9a-f]{40}(?:\s+#\s+.+)?$/u);
  }

  assert.doesNotMatch(workflow, /NETLIFY_AUTH_TOKEN|NETLIFY_SITE_ID|netlify-cli/u);
  assert.doesNotMatch(workflow, /^\s*run:\s*.*\bnetlify\s+deploy\b/mu);
  assert.doesNotMatch(workflow, /godot\/web-export|manage-godot-web-snapshot/u);
  assert.doesNotMatch(workflow, /corepack\s+(?:enable|prepare)/u);
  assert.doesNotMatch(workflow, /\|\|\s*true/u);
});

test("the standard web-build test command includes the GitHub workflow contract", async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  assert.match(packageJson.scripts["test:build-web"], /scripts\/github-workflow\.test\.mjs/u);
  assert.match(packageJson.scripts["test:build-web"], /scripts\/public-release-contract\.test\.mjs/u);
  assert.match(packageJson.scripts.test, /vitest run[^&]*--maxWorkers=1(?:\s|$)/u);
  assert.match(packageJson.scripts["test:unit"], /vitest run[^&]*--maxWorkers=1(?:\s|$)/u);
});
