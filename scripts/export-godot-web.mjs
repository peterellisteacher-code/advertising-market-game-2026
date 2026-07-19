import { spawn, spawnSync } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { homedir as systemHomedir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");

export function godotExecutableCandidates({
  env = process.env,
  homedir = systemHomedir(),
  platform = process.platform
} = {}) {
  const candidates = [];
  if (typeof env.GODOT_BIN === "string" && env.GODOT_BIN.trim() !== "") {
    candidates.push(env.GODOT_BIN.trim());
  }
  if (platform === "win32") {
    candidates.push(
      path.join(homedir, "Godot", "godot_current_console.exe"),
      path.join(homedir, "Godot", "godot_current.exe")
    );
  } else {
    candidates.push("godot4", "godot");
  }
  return [...new Set(candidates)];
}

export async function resolveGodotExecutable(options = {}) {
  for (const candidate of godotExecutableCandidates(options)) {
    if (path.isAbsolute(candidate)) {
      try {
        await access(candidate);
        return candidate;
      } catch {
        continue;
      }
    }
    const probe = spawnSync(candidate, ["--version"], {
      shell: false,
      stdio: "ignore",
      windowsHide: true
    });
    if (probe.status === 0 && probe.error === undefined) return candidate;
  }
  throw new Error(
    "Godot 4 was not found. Set GODOT_BIN or install the classroom runtime in ~/Godot."
  );
}

export function buildGodotExportInvocation({ root = DEFAULT_ROOT, executable }) {
  if (typeof executable !== "string" || executable.trim() === "") {
    throw new Error("A Godot executable is required");
  }
  const resolvedRoot = path.resolve(root);
  return {
    command: executable,
    args: [
      "--headless",
      "--path",
      path.join(resolvedRoot, "godot"),
      "--export-release",
      "Web",
      path.join(resolvedRoot, "build", "web", "index.html")
    ],
    cwd: resolvedRoot
  };
}

export async function exportGodotWeb({ root = DEFAULT_ROOT, executable } = {}) {
  const resolvedRoot = path.resolve(root);
  const selectedExecutable = executable ?? await resolveGodotExecutable();
  const invocation = buildGodotExportInvocation({
    root: resolvedRoot,
    executable: selectedExecutable
  });
  await mkdir(path.join(resolvedRoot, "build", "web"), { recursive: true });
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      shell: false,
      stdio: "inherit",
      windowsHide: true
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`Godot web export was terminated by ${signal}`));
        return;
      }
      resolve(code);
    });
  });
  if (exitCode !== 0) throw new Error(`Godot web export failed with exit code ${exitCode}`);
  await access(path.join(resolvedRoot, "build", "web", "index.pck"));
  console.log("GODOT_WEB_EXPORT_OK");
}

async function main() {
  if (process.argv.length > 2) {
    throw new Error("Usage: node scripts/export-godot-web.mjs");
  }
  await exportGodotWeb();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
