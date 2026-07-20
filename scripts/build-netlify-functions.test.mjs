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

test("keeps the deployed Image Lab session wrapper aligned with its teacher toggle routes", () => {
  const wrapper = readFileSync(
    join(repoRoot, "netlify", "deploy-functions", "image-lab-session.mts"),
    "utf8"
  );

  assert.match(
    wrapper,
    /path:\s*\["\/api\/image-lab\/config",\s*"\/api\/image-lab\/unlock",\s*"\/api\/image-lab\/lock"\]/u
  );
  assert.match(wrapper, /windowLimit:\s*300/u);
});

test("keeps the deployed account-session wrapper at the shared-school-network capacity floor", () => {
  const wrapper = readFileSync(
    join(repoRoot, "netlify", "deploy-functions", "account-session.mts"),
    "utf8"
  );
  assert.match(wrapper, /windowLimit:\s*300/u);
  assert.match(wrapper, /windowSize:\s*60/u);
  assert.match(wrapper, /aggregateBy:\s*\["ip",\s*"domain"\]/u);
});

test("builds function bundles before every supported function runtime or deploy path", () => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const scripts = packageJson.scripts ?? {};
  const buildCommand = "node scripts/build-netlify-functions.mjs";

  assert.equal(scripts["build:functions"], buildCommand);
  for (const name of ["dev", "test", "test:unit", "build:web", "build"]) {
    assert.match(scripts[name] ?? "", new RegExp(`^${buildCommand.replaceAll(".", "\\.")} && `));
  }
  assert.equal(
    scripts["deploy:draft"],
    undefined,
    "draft deploys must name an exact downloaded CI artifact rather than reuse build/web"
  );
});
