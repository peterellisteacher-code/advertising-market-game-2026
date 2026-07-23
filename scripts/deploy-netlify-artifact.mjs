import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { assertPathHasNoIndirection } from "./filesystem-safety.mjs";
import { verifyReleaseArtifact, verifyWebExport } from "./verify-web-export.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const CONFIG_TEMPLATE_PATH = path.join(PROJECT_ROOT, "netlify.artifact.toml");
const DEFAULT_DEPLOY_CONTEXT_ROOT = path.join(tmpdir(), "advertising-market-game-netlify-deploy-context");

export const ADVERTISING_GAME_SITE_ID = "fffc6f57-3fd2-44e3-9247-05a5f746351d";

async function writeBoundFile(root, relative, bytes, label) {
  const destination = path.join(root, ...relative.split("/"));
  await mkdir(path.dirname(destination), { recursive: true });
  await assertPathHasNoIndirection(path.dirname(destination), { label });
  const existing = await assertPathHasNoIndirection(destination, {
    allowMissing: true,
    label,
    rejectHardLinkedFile: true
  });
  if (existing && !existing.isFile()) {
    throw new Error(`Refusing non-file ${label}: ${relative}`);
  }
  await writeFile(destination, bytes);
  await assertPathHasNoIndirection(destination, {
    label,
    rejectHardLinkedFile: true
  });
}

async function listExactFiles(directory, prefix = "") {
  const files = [];
  await assertPathHasNoIndirection(directory, { label: "deploy context" });
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Refusing deploy-context indirection: ${relative}`);
    }
    if (entry.isDirectory()) {
      files.push(...await listExactFiles(absolute, relative));
    } else if (entry.isFile()) {
      await assertPathHasNoIndirection(absolute, {
        label: "deploy context",
        rejectHardLinkedFile: true
      });
      files.push(relative);
    } else {
      throw new Error(`Refusing special deploy-context file: ${relative}`);
    }
  }
  return files;
}

function assertExactFileSet(actual, expected, label) {
  const orderedActual = [...actual].sort((left, right) => left.localeCompare(right));
  const orderedExpected = [...expected].sort((left, right) => left.localeCompare(right));
  if (JSON.stringify(orderedActual) !== JSON.stringify(orderedExpected)) {
    throw new Error(`${label} contains missing or unexpected files`);
  }
}

export async function prepareArtifactDeployContext({
  artifactDir,
  deployContextRoot = DEFAULT_DEPLOY_CONTEXT_ROOT,
}) {
  const resolvedArtifactDir = path.resolve(artifactDir);
  const resolvedDeployContextRoot = path.resolve(deployContextRoot);
  const contextRelativeToArtifact = path.relative(resolvedArtifactDir, resolvedDeployContextRoot);
  if (
    contextRelativeToArtifact === "" ||
    (!contextRelativeToArtifact.startsWith("..") && !path.isAbsolute(contextRelativeToArtifact))
  ) {
    throw new Error("Artifact deploy context must be outside the uploaded artifact directory");
  }

  const release = await verifyReleaseArtifact(resolvedArtifactDir);
  const resolvedDeployContextDir = path.join(resolvedDeployContextRoot, release.releaseId);
  const publishDir = path.join(resolvedDeployContextDir, "publish");
  const functionsDir = path.join(resolvedDeployContextDir, "functions");
  const template = await readFile(CONFIG_TEMPLATE_PATH, "utf8");
  await mkdir(publishDir, { recursive: true });
  await mkdir(functionsDir, { recursive: true });
  await assertPathHasNoIndirection(resolvedDeployContextDir, { label: "deploy context" });
  await writeBoundFile(
    resolvedDeployContextDir,
    "netlify.toml",
    Buffer.from(template, "utf8"),
    "deploy config"
  );

  for (const [relative, bytes] of release.staticFiles) {
    await writeBoundFile(publishDir, relative, bytes, "bound static file");
  }
  await writeBoundFile(
    publishDir,
    "release-manifest.json",
    Buffer.from(`${JSON.stringify(release.manifest, null, 2)}\n`, "utf8"),
    "release manifest"
  );
  for (const [relative, bytes] of release.functionFiles) {
    await writeBoundFile(functionsDir, relative, bytes, "bound function file");
  }

  assertExactFileSet(
    await listExactFiles(publishDir),
    [...release.staticFiles.keys(), "release-manifest.json"],
    "Static deploy context"
  );
  assertExactFileSet(
    await listExactFiles(functionsDir),
    release.functionFiles.keys(),
    "Function deploy context"
  );
  return resolvedDeployContextDir;
}

export function buildNetlifyDeployInvocation({
  artifactDir,
  deployContextDir,
  message,
  mode,
  nodeExecutable = process.execPath,
  platform = process.platform,
  projectRoot = PROJECT_ROOT,
}) {
  if (mode !== "draft" && mode !== "production") {
    throw new Error(`Deployment mode must be draft or production, received: ${mode}`);
  }
  if (!deployContextDir) throw new Error("Deployment requires a prepared Netlify context directory");

  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const resolvedProjectRoot = pathApi.resolve(projectRoot);
  const resolvedDeployContextDir = pathApi.resolve(deployContextDir);
  const args = [
    pathApi.join(resolvedProjectRoot, "node_modules", "netlify", "bin", "run.js"),
    "deploy",
    "--no-build",
    "--dir",
    pathApi.join(resolvedDeployContextDir, "publish"),
    "--functions",
    pathApi.join(resolvedDeployContextDir, "functions", "deploy-functions"),
    "--site",
    ADVERTISING_GAME_SITE_ID,
    "--skip-functions-cache",
    "--json",
  ];

  if (mode === "production") args.push("--prod");
  if (message) args.push("--message", message);

  return {
    args,
    command: nodeExecutable,
    cwd: resolvedDeployContextDir,
  };
}

function parseArgs(args) {
  let artifactDir;
  let message;
  let mode;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--artifact") {
      artifactDir = args[index + 1];
      index += 1;
    } else if (arg === "--message") {
      message = args[index + 1];
      index += 1;
    } else if (arg === "--draft") {
      if (mode) throw new Error("Choose exactly one deployment mode");
      mode = "draft";
    } else if (arg === "--prod") {
      if (mode) throw new Error("Choose exactly one deployment mode");
      mode = "production";
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!artifactDir) throw new Error("Usage requires --artifact <absolute-or-relative-path>");
  if (!mode) throw new Error("Usage requires exactly one of --draft or --prod");
  if (message === undefined) {
    message = mode === "production" ? "Verified Advertising Market Game release" : "Advertising Market Game release candidate";
  }

  return { artifactDir: path.resolve(artifactDir), message, mode };
}

async function runInvocation(invocation, label) {
  await new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`));
    });
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const verification = await verifyWebExport(options.artifactDir, PROJECT_ROOT);
  if (verification.warnings.length > 0) {
    throw new Error(`Artifact verification warnings must be resolved before deployment: ${verification.warnings.join("; ")}`);
  }

  const deployContextDir = await prepareArtifactDeployContext({ artifactDir: options.artifactDir });
  await runInvocation(buildNetlifyDeployInvocation({
    artifactDir: options.artifactDir,
    deployContextDir,
    message: options.message,
    mode: options.mode,
  }), "Netlify deploy");
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
