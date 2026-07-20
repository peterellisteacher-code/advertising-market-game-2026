import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { verifyWebExport } from "./verify-web-export.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const CONFIG_TEMPLATE_PATH = path.join(PROJECT_ROOT, "netlify.artifact.toml");
const DEFAULT_DEPLOY_CONTEXT_ROOT = path.join(tmpdir(), "advertising-market-game-netlify-deploy-context");

export const ADVERTISING_GAME_SITE_ID = "fffc6f57-3fd2-44e3-9247-05a5f746351d";

export function buildNetlifyFunctionBundleInvocation({
  nodeExecutable = process.execPath,
  platform = process.platform,
  projectRoot = PROJECT_ROOT,
} = {}) {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const resolvedProjectRoot = pathApi.resolve(projectRoot);
  return {
    command: nodeExecutable,
    args: [pathApi.join(resolvedProjectRoot, "scripts", "build-netlify-functions.mjs")],
    cwd: resolvedProjectRoot,
  };
}

async function readOptionalFile(filePath) {
  try {
    return await readFile(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return undefined;
    throw error;
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

  const headers = await readFile(path.join(resolvedArtifactDir, "_headers"));
  const redirects = await readOptionalFile(path.join(resolvedArtifactDir, "_redirects"));
  const metadataDigest = createHash("sha256")
    .update(headers)
    .update("\0redirects\0")
    .update(redirects ?? "absent")
    .digest("hex")
    .slice(0, 16);
  const resolvedDeployContextDir = path.join(resolvedDeployContextRoot, metadataDigest);
  const metadataPublishDir = path.join(resolvedDeployContextDir, "publish");
  const template = await readFile(CONFIG_TEMPLATE_PATH, "utf8");
  await mkdir(metadataPublishDir, { recursive: true });
  await writeFile(path.join(resolvedDeployContextDir, "netlify.toml"), template, "utf8");
  await writeFile(path.join(metadataPublishDir, "_headers"), headers);
  if (redirects !== undefined) {
    await writeFile(path.join(metadataPublishDir, "_redirects"), redirects);
  } else {
    try {
      await access(path.join(metadataPublishDir, "_redirects"));
      throw new Error("Artifact deploy context contains stale _redirects metadata");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
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
  const resolvedArtifactDir = pathApi.resolve(artifactDir);
  const resolvedDeployContextDir = pathApi.resolve(deployContextDir);
  const args = [
    pathApi.join(resolvedProjectRoot, "node_modules", "netlify", "bin", "run.js"),
    "deploy",
    "--no-build",
    "--dir",
    resolvedArtifactDir,
    "--functions",
    pathApi.join(resolvedProjectRoot, "netlify", "deploy-functions"),
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
  await access(path.join(options.artifactDir, "index.html"));
  await access(path.join(options.artifactDir, "_headers"));
  await runInvocation(buildNetlifyFunctionBundleInvocation(), "Netlify Function build");
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
