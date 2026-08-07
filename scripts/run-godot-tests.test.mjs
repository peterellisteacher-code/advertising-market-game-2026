import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  GODOT_TEST_FAILURE_MARKER,
  GODOT_TEST_SUCCESS_MARKER,
  buildGodotTestInvocations,
  evaluateGodotTestRun
} from "./run-godot-tests.mjs";

test("the Godot gate re-imports assets before it runs the suites", () => {
  const root = path.resolve("C:\\workspace\\advertising-game");

  assert.deepEqual(buildGodotTestInvocations({
    root,
    executable: "C:\\Tools\\Godot.exe"
  }), [
    {
      label: "import",
      command: "C:\\Tools\\Godot.exe",
      args: ["--headless", "--path", path.join(root, "godot"), "--import"],
      cwd: root
    },
    {
      label: "tests",
      command: "C:\\Tools\\Godot.exe",
      args: [
        "--headless",
        "--path",
        path.join(root, "godot"),
        "--script",
        "res://tests/run_tests.gd"
      ],
      cwd: root
    }
  ]);
});

test("a failed GDScript assertion fails the gate even though the runner exits 0", () => {
  const verdict = evaluateGodotTestRun({
    exitCode: 0,
    output: [
      `${GODOT_TEST_FAILURE_MARKER}: Assertion failed.`,
      "   at: _assert_pair_footprint (res://tests/test_agency_world.gd:289)",
      GODOT_TEST_SUCCESS_MARKER
    ].join("\n")
  });

  assert.equal(verdict.passed, false);
  assert.match(verdict.failure, /SCRIPT ERROR/u);
});

test("a runner that never reaches its completion line fails the gate", () => {
  const verdict = evaluateGodotTestRun({ exitCode: 0, output: "Godot Engine v4.7.1\n" });

  assert.equal(verdict.passed, false);
  assert.match(verdict.failure, /did not print/u);
});

test("a non-zero runner exit fails the gate", () => {
  const verdict = evaluateGodotTestRun({
    exitCode: 1,
    output: `${GODOT_TEST_SUCCESS_MARKER}\n`
  });

  assert.equal(verdict.passed, false);
  assert.match(verdict.failure, /exited with code 1/u);
});

test("a clean run passes the gate", () => {
  assert.deepEqual(evaluateGodotTestRun({
    exitCode: 0,
    output: `Godot Engine v4.7.1\n${GODOT_TEST_SUCCESS_MARKER}\n`
  }), { passed: true });
});
