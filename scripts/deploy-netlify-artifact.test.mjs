import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildNetlifyDeployInvocation,
  parseDeployArgs,
  prepareArtifactDeployContext,
} from "./deploy-netlify-artifact.mjs";
import { computeReleaseId } from "./verify-web-export.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEST_SITE_ID = "00000000-1111-4222-8333-444444444444";

test("artifact deployment does not rebuild server code", async () => {
  const source = await readFile(new URL("./deploy-netlify-artifact.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /build-netlify-functions\.mjs/);
});

const digestRecord = (relative, value) => ({
  path: relative,
  bytes: Buffer.byteLength(value),
  sha256: createHash("sha256").update(value).digest("hex")
});

async function writeBoundArtifact(root) {
  const artifactDir = path.join(root, "artifact");
  const functionRoot = path.join(artifactDir, ".release", "functions");
  await Promise.all([
    mkdir(artifactDir, { recursive: true }),
    mkdir(path.join(functionRoot, "deploy-functions"), { recursive: true }),
    mkdir(path.join(functionRoot, "function-bundles"), { recursive: true })
  ]);
  const publicFiles = new Map([
    ["index.html", "<!doctype html><title>Ad Market</title>"],
    ["_headers", "/*\n  X-AdMarket-Artifact-Probe: artifact-exact\n"],
    ["service-worker.js", "self.addEventListener('fetch', () => {});\n"]
  ]);
  for (const [relative, value] of publicFiles) {
    await writeFile(path.join(artifactDir, relative), value);
  }
  const wrapper = 'export { default } from "../function-bundles/example.mjs";\n';
  const bundle = "export default async () => new Response('ok');\n";
  await writeFile(path.join(functionRoot, "deploy-functions", "example.mts"), wrapper);
  await writeFile(path.join(functionRoot, "function-bundles", "example.mjs"), bundle);
  const functionManifest = JSON.stringify({
    schema: "ad-market-function-manifest@1",
    functions: [{
      name: "example",
      wrapper: digestRecord("deploy-functions/example.mts", wrapper),
      bundle: digestRecord("function-bundles/example.mjs", bundle)
    }]
  }, null, 2);
  await writeFile(path.join(functionRoot, "function-manifest.json"), functionManifest);
  const staticFiles = [...publicFiles]
    .map(([relative, value]) => digestRecord(relative, value))
    .sort((left, right) => left.path.localeCompare(right.path));
  const functionFiles = [
    digestRecord("deploy-functions/example.mts", wrapper),
    digestRecord("function-bundles/example.mjs", bundle),
    digestRecord("function-manifest.json", functionManifest)
  ].sort((left, right) => left.path.localeCompare(right.path));
  const release = {
    schema: "ad-market-release@1",
    releaseId: computeReleaseId({ staticFiles, functionFiles }),
    static: { files: staticFiles },
    functions: {
      root: ".release/functions",
      files: functionFiles
    }
  };
  await writeFile(
    path.join(artifactDir, "release-manifest.json"),
    JSON.stringify(release, null, 2)
  );
  return { artifactDir, release };
}

test("draft deployment resolves headers from the exact artifact directory", () => {
  const invocation = buildNetlifyDeployInvocation({
    artifactDir: "/tmp/admarket-artifact",
    mode: "draft",
    nodeExecutable: "/runtime/node",
    platform: "linux",
    projectRoot: "/repo/admarket",
    deployContextDir: "/tmp/admarket-netlify-context",
    siteId: TEST_SITE_ID,
  });

  assert.equal(invocation.cwd, "/tmp/admarket-netlify-context");
  assert.equal(invocation.command, "/runtime/node");
  assert.deepEqual(invocation.args, [
    "/repo/admarket/node_modules/netlify/bin/run.js",
    "deploy",
    "--no-build",
    "--dir",
    "/tmp/admarket-netlify-context/publish",
    "--functions",
    "/tmp/admarket-netlify-context/functions/deploy-functions",
    "--site",
    TEST_SITE_ID,
    "--skip-functions-cache",
    "--json",
  ]);
  assert.equal(invocation.args.includes("--prod"), false);
});

test("production deployment requires the explicit production mode", () => {
  const invocation = buildNetlifyDeployInvocation({
    artifactDir: "C:\\tmp\\admarket-artifact",
    mode: "production",
    nodeExecutable: "C:\\runtime\\node.exe",
    platform: "win32",
    projectRoot: "C:\\repo\\admarket",
    deployContextDir: "C:\\tmp\\admarket-netlify-context",
    siteId: TEST_SITE_ID,
  });

  assert.equal(invocation.cwd, "C:\\tmp\\admarket-netlify-context");
  assert.equal(invocation.command, "C:\\runtime\\node.exe");
  assert.equal(invocation.args[0], "C:\\repo\\admarket\\node_modules\\netlify\\bin\\run.js");
  assert.equal(invocation.args.includes("--prod"), true);
  assert.equal(invocation.args.includes("--config"), false);
  assert.equal(
    invocation.args[invocation.args.indexOf("--dir") + 1],
    "C:\\tmp\\admarket-netlify-context\\publish"
  );
});

test("deployment requires an explicit caller-owned Netlify site", () => {
  assert.throws(
    () => buildNetlifyDeployInvocation({
      artifactDir: "/tmp/admarket-artifact",
      deployContextDir: "/tmp/admarket-netlify-context",
      mode: "draft",
      platform: "linux",
      projectRoot: "/repo/admarket",
    }),
    /explicit --site-id/i
  );

  assert.deepEqual(
    parseDeployArgs([
      "--draft",
      "--artifact",
      "/tmp/admarket-artifact",
      "--site-id",
      TEST_SITE_ID,
    ]),
    {
      artifactDir: path.resolve("/tmp/admarket-artifact"),
      message: "Advertising Market Game release candidate",
      mode: "draft",
      siteId: TEST_SITE_ID,
    }
  );
  assert.throws(
    () => parseDeployArgs(["--draft", "--artifact", "/tmp/admarket-artifact"]),
    /--site-id/i
  );
});

test("artifact deploy config points Netlify at the mirrored artifact metadata", async () => {
  const template = await readFile(new URL("../netlify.artifact.toml", import.meta.url), "utf8");

  assert.match(template, /^publish = "publish"$/m);
  assert.doesNotMatch(template, /headers/i);
  assert.doesNotMatch(template, /build\/web/i);
});

test("Netlify resolves _headers from an isolated context's configured artifact", async () => {
  const rootRequire = createRequire(import.meta.url);
  const netlifyPackage = rootRequire.resolve("netlify/package.json");
  const netlifyRequire = createRequire(pathToFileURL(netlifyPackage));
  const configModule = await import(pathToFileURL(netlifyRequire.resolve("@netlify/config")).href);
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), "admarket-netlify-artifact-"));
  const { artifactDir } = await writeBoundArtifact(fixtureRoot);
  const deployContextRoot = path.join(fixtureRoot, "context");
  const contextDir = await prepareArtifactDeployContext({ artifactDir, deployContextRoot });

  const resolved = await configModule.resolveConfig({
    context: "deploy-preview",
    cwd: contextDir,
    mode: "cli",
    offline: true,
    repositoryRoot: contextDir,
  });

  const mirroredHeaders = await readFile(path.join(contextDir, "publish", "_headers"), "utf8");
  const sourceHeaders = await readFile(path.join(artifactDir, "_headers"), "utf8");
  assert.equal(mirroredHeaders, sourceHeaders);
  assert.equal(resolved.headersPath, path.join(contextDir, "publish", "_headers"));
  assert.deepEqual(resolved.config.headers, [
    {
      for: "/*",
      values: { "X-AdMarket-Artifact-Probe": "artifact-exact" },
    },
  ]);
  assert.equal(
    await readFile(path.join(contextDir, "functions", "deploy-functions", "example.mts"), "utf8"),
    'export { default } from "../function-bundles/example.mjs";\n'
  );
  assert.equal(
    await readFile(path.join(contextDir, "publish", "index.html"), "utf8"),
    "<!doctype html><title>Ad Market</title>"
  );
});

test("artifact preparation rejects mutated, missing and unexpected bound files", async () => {
  for (const [name, mutate, pattern] of [
    ["static mutation", async ({ artifactDir }) => {
      await writeFile(path.join(artifactDir, "index.html"), "changed");
    }, /static file hash mismatch/i],
    ["wrapper mutation", async ({ artifactDir }) => {
      await writeFile(
        path.join(artifactDir, ".release", "functions", "deploy-functions", "example.mts"),
        "changed"
      );
    }, /function file hash mismatch/i],
    ["bundle mutation", async ({ artifactDir }) => {
      await writeFile(
        path.join(artifactDir, ".release", "functions", "function-bundles", "example.mjs"),
        "changed"
      );
    }, /function file hash mismatch/i],
    ["missing function", async ({ artifactDir }) => {
      const manifest = JSON.parse(await readFile(
        path.join(artifactDir, "release-manifest.json"),
        "utf8"
      ));
      manifest.functions.files.push(digestRecord("function-bundles/missing.mjs", "missing"));
      manifest.functions.files.sort((left, right) => left.path.localeCompare(right.path));
      manifest.releaseId = computeReleaseId({
        staticFiles: manifest.static.files,
        functionFiles: manifest.functions.files
      });
      await writeFile(
        path.join(artifactDir, "release-manifest.json"),
        JSON.stringify(manifest, null, 2)
      );
    }, /missing bound function file/i],
    ["unexpected static", async ({ artifactDir }) => {
      await writeFile(path.join(artifactDir, "unexpected.txt"), "unexpected");
    }, /unexpected static file/i],
    ["unexpected function", async ({ artifactDir }) => {
      await writeFile(
        path.join(artifactDir, ".release", "functions", "unexpected.mjs"),
        "unexpected"
      );
    }, /unexpected function file/i]
  ]) {
    const root = await mkdtemp(path.join(tmpdir(), `admarket-${name.replaceAll(" ", "-")}-`));
    const artifact = await writeBoundArtifact(root);
    await mutate(artifact);
    await assert.rejects(
      () => prepareArtifactDeployContext({
        artifactDir: artifact.artifactDir,
        deployContextRoot: path.join(root, "context")
      }),
      pattern
    );
  }
});

test("the canonical build contract and deploy commands include artifact deployment", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.match(packageJson.scripts["test:build-web"], /deploy-netlify-artifact\.test\.mjs/);
  assert.equal(packageJson.scripts["deploy:draft"], "node scripts/deploy-netlify-artifact.mjs --draft");
  assert.equal(packageJson.scripts["deploy:production"], "node scripts/deploy-netlify-artifact.mjs --prod");
});
