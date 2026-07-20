import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ADVERTISING_GAME_SITE_ID,
  buildNetlifyFunctionBundleInvocation,
  buildNetlifyDeployInvocation,
  prepareArtifactDeployContext,
} from "./deploy-netlify-artifact.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

test("deployment rebuilds every server bundle from the current source first", () => {
  const invocation = buildNetlifyFunctionBundleInvocation({
    nodeExecutable: "C:\\runtime\\node.exe",
    platform: "win32",
    projectRoot: "C:\\repo\\admarket",
  });

  assert.deepEqual(invocation, {
    command: "C:\\runtime\\node.exe",
    args: ["C:\\repo\\admarket\\scripts\\build-netlify-functions.mjs"],
    cwd: "C:\\repo\\admarket",
  });
});

test("draft deployment resolves headers from the exact artifact directory", () => {
  const invocation = buildNetlifyDeployInvocation({
    artifactDir: "/tmp/admarket-artifact",
    mode: "draft",
    nodeExecutable: "/runtime/node",
    platform: "linux",
    projectRoot: "/repo/admarket",
    deployContextDir: "/tmp/admarket-netlify-context",
  });

  assert.equal(invocation.cwd, "/tmp/admarket-netlify-context");
  assert.equal(invocation.command, "/runtime/node");
  assert.deepEqual(invocation.args, [
    "/repo/admarket/node_modules/netlify/bin/run.js",
    "deploy",
    "--no-build",
    "--dir",
    "/tmp/admarket-artifact",
    "--functions",
    "/repo/admarket/netlify/deploy-functions",
    "--site",
    ADVERTISING_GAME_SITE_ID,
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
  });

  assert.equal(invocation.cwd, "C:\\tmp\\admarket-netlify-context");
  assert.equal(invocation.command, "C:\\runtime\\node.exe");
  assert.equal(invocation.args[0], "C:\\repo\\admarket\\node_modules\\netlify\\bin\\run.js");
  assert.equal(invocation.args.includes("--prod"), true);
  assert.equal(invocation.args.includes("--config"), false);
  assert.equal(invocation.args[invocation.args.indexOf("--dir") + 1], "C:\\tmp\\admarket-artifact");
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
  const artifactDir = path.join(SCRIPT_DIR, "fixtures", "netlify-artifact-site");
  const deployContextRoot = path.join(tmpdir(), "admarket-netlify-artifact-test-context");
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
});

test("the canonical build contract and deploy commands include artifact deployment", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.match(packageJson.scripts["test:build-web"], /deploy-netlify-artifact\.test\.mjs/);
  assert.equal(packageJson.scripts["deploy:draft"], "node scripts/deploy-netlify-artifact.mjs --draft");
  assert.equal(packageJson.scripts["deploy:production"], "node scripts/deploy-netlify-artifact.mjs --prod");
});
