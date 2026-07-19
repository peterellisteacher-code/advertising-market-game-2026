import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const builder = join(here, "build-netlify-functions.mjs");
const bundleDirectory = join(repoRoot, "netlify", "function-bundles");
const bundle = join(bundleDirectory, "account-progress.mjs");

test("builds account-progress as one self-contained importable module", async () => {
  const result = spawnSync(process.execPath, [builder], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(existsSync(bundle), true, "expected the account-progress bundle");
  assert.deepEqual(readdirSync(bundleDirectory).sort(), ["account-progress.mjs"]);

  const source = readFileSync(bundle, "utf8");
  assert.ok(source.length > 100_000, "bundle should contain the complete handler dependency graph");
  const staticImports = source.split(/\r?\n/u).filter((line) => /^\s*import\b/u.test(line));
  for (const line of staticImports) {
    const specifier = line.match(/["']([^"']+)["']/u)?.[1];
    assert.match(specifier ?? "", /^node:/u, `unexpected runtime import: ${line}`);
  }
  assert.doesNotMatch(source, /\bimport\s*\(/u);
  assert.doesNotMatch(source, /\brequire\s*\(/u);

  const imported = await import(`${pathToFileURL(bundle).href}?test=${Date.now()}`);
  assert.equal(typeof imported.default, "function");
});

test("routes the deployed account-progress wrapper through the generated bundle", () => {
  const wrapper = readFileSync(
    join(repoRoot, "netlify", "deploy-functions", "account-progress.mts"),
    "utf8"
  );

  assert.match(
    wrapper,
    /^export \{ default \} from "\.\.\/function-bundles\/account-progress\.mjs";/u
  );
  assert.match(wrapper, /export const config = \{/u);
  assert.match(wrapper, /path: \["\/api\/account\/progress"\]/u);
});

test("builds function bundles before every supported function runtime or deploy path", () => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const scripts = packageJson.scripts ?? {};
  const buildCommand = "node scripts/build-netlify-functions.mjs";

  assert.equal(scripts["build:functions"], buildCommand);
  for (const name of ["dev", "test", "test:unit", "build:web", "build", "deploy:draft"]) {
    assert.match(scripts[name] ?? "", new RegExp(`^${buildCommand.replaceAll(".", "\\.")} && `));
  }
  assert.match(
    scripts["deploy:draft"],
    /npxnetlify deploy --no-build --dir build\/web --functions netlify\/deploy-functions --json$/u
  );
});
