import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import {
  buildGodotExportInvocation,
  godotExecutableCandidates
} from "./export-godot-web.mjs";

test("Godot executable discovery prefers an explicit override and keeps the classroom install fallback", () => {
  const homedir = "C:\\Users\\Teacher";
  const candidates = godotExecutableCandidates({
    env: { GODOT_BIN: "D:\\Tools\\Godot.exe" },
    homedir,
    platform: "win32"
  });

  assert.deepEqual(candidates, [
    "D:\\Tools\\Godot.exe",
    "C:\\Users\\Teacher\\Godot\\godot_current_console.exe",
    "C:\\Users\\Teacher\\Godot\\godot_current.exe"
  ]);
});

test("Godot web export invocation always refreshes the production PCK from the current project", () => {
  const root = path.resolve("C:\\workspace\\advertising-game");

  assert.deepEqual(buildGodotExportInvocation({
    root,
    executable: "C:\\Tools\\Godot.exe"
  }), {
    command: "C:\\Tools\\Godot.exe",
    args: [
      "--headless",
      "--path",
      path.join(root, "godot"),
      "--export-release",
      "Web",
      path.join(root, "build", "web", "index.html")
    ],
    cwd: root
  });
});
