// The Godot headless test gate. Local runs and the GitHub workflow both call this
// script so the two cannot drift apart.
//
// It closes two holes that were hit for real on 2026-08-07 and recorded in
// docs/operations/release-verification-2026-08-07-tuckability-single-action.md:
//
//   1. A failed GDScript assert() aborts the assertion function and hands control
//      back to run(), which carries on and returns true. run_tests.gd only calls
//      quit(1) when a suite returns something other than true, so the runner printed
//      "SCRIPT ERROR: Assertion failed." and still exited 0. Any SCRIPT ERROR in the
//      suite output now fails the gate, as does a missing completion line.
//   2. --script does not re-import changed assets, so the suite could pass against a
//      stale .godot/imported cache built from a source image that no longer exists.
//      The import pass runs first, every time.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveGodotExecutable } from "./export-godot-web.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(SCRIPT_DIR, "..");

export const GODOT_TEST_FAILURE_MARKER = "SCRIPT ERROR";
export const GODOT_TEST_SUCCESS_MARKER =
  "Godot game, Creator bridge, and Market bridge tests passed";

export function buildGodotTestInvocations({ root = DEFAULT_ROOT, executable }) {
  if (typeof executable !== "string" || executable.trim() === "") {
    throw new Error("A Godot executable is required");
  }
  const resolvedRoot = path.resolve(root);
  const projectPath = path.join(resolvedRoot, "godot");
  return [
    {
      label: "import",
      command: executable,
      args: ["--headless", "--path", projectPath, "--import"],
      cwd: resolvedRoot
    },
    {
      label: "tests",
      command: executable,
      args: ["--headless", "--path", projectPath, "--script", "res://tests/run_tests.gd"],
      cwd: resolvedRoot
    }
  ];
}

export function evaluateGodotTestRun({ exitCode, output }) {
  if (exitCode !== 0) {
    return { passed: false, failure: `Godot test suites exited with code ${exitCode}` };
  }
  if (output.includes(GODOT_TEST_FAILURE_MARKER)) {
    return {
      passed: false,
      failure:
        `Godot test suites reported ${GODOT_TEST_FAILURE_MARKER} and still exited 0 ` +
        "(a failed assert() does not fail the suite on its own)"
    };
  }
  if (!output.includes(GODOT_TEST_SUCCESS_MARKER)) {
    return {
      passed: false,
      failure: `Godot test suites did not print "${GODOT_TEST_SUCCESS_MARKER}"`
    };
  }
  return { passed: true };
}

async function runInvocation(invocation) {
  return await new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd: invocation.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        output += chunk;
        process.stdout.write(chunk);
      });
    }
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`Godot ${invocation.label} pass was terminated by ${signal}`));
        return;
      }
      resolve({ exitCode: code, output });
    });
  });
}

export async function runGodotTests({ root = DEFAULT_ROOT, executable } = {}) {
  const selectedExecutable = executable ?? await resolveGodotExecutable();
  const [importInvocation, testInvocation] = buildGodotTestInvocations({
    root,
    executable: selectedExecutable
  });

  const imported = await runInvocation(importInvocation);
  if (imported.exitCode !== 0) {
    throw new Error(`Godot asset import failed with exit code ${imported.exitCode}`);
  }

  const tested = await runInvocation(testInvocation);
  const verdict = evaluateGodotTestRun(tested);
  if (!verdict.passed) throw new Error(verdict.failure);
  console.log("GODOT_TESTS_OK");
}

async function main() {
  if (process.argv.length > 2) {
    throw new Error("Usage: node scripts/run-godot-tests.mjs");
  }
  await runGodotTests();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
