import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CANDIDATE_FILES = Object.freeze([
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "vitest.config.ts",
  "index.html",
  "netlify.toml",
  "godot/project.godot",
  "godot/export_presets.cfg",
  "godot/src/main/Main.gd",
  "godot/src/main/Main.tscn",
  "godot/tests/test_game_shell.gd",
  "scripts/build-openrouter-panel-prompt.mjs",
  "scripts/build-openrouter-panel-prompt.test.mjs",
  "scripts/build-plain-language-coverage-prompt.mjs",
  "scripts/build-plain-language-coverage-prompt.test.mjs",
  "scripts/capture-plain-language-response.cjs",
  "scripts/capture-plain-language-response.test.cjs",
  "scripts/onboarding-source.test.mjs",
  "scripts/student-copy-corpus.mjs",
  "scripts/student-copy-corpus.test.mjs",
  "scripts/student-copy-source-coverage.test.mjs",
  "web/src/account/account-gate.ts",
  "web/src/ai-image/image-lab-panel.ts",
  "web/src/catalogue/catalogue-runtime.ts",
  "web/src/fabric/fabric-custom-properties.ts",
  "web/src/fabric/object-factory.test.ts",
  "web/src/game/aida-playbook-panel.test.ts",
  "web/src/game/aida-playbook-panel.ts",
  "web/src/game/aida-playbook.ts",
  "web/src/game/audience-briefs.ts",
  "web/src/game/market-route-panel.test.ts",
  "web/src/game/market-route-panel.ts",
  "web/src/game/market-route.test.ts",
  "web/src/game/pair-game-controller.test.ts",
  "web/src/game/pair-game-controller.ts",
  "web/src/game/student-copy.test.ts",
  "web/src/game/student-copy.ts",
  "web/src/history/fabric-history-bindings.ts",
  "web/src/history/history-controller.test.ts",
  "web/src/main.test.ts",
  "web/src/main.ts",
  "web/src/styles/editor-css.test.ts",
  "web/src/styles/editor.css",
  "web/src/ui/editor-shell.test.ts",
  "web/src/ui/editor-shell.ts",
]);

const MANIFEST_ROOTS = Object.freeze(["godot/src", "godot/tests", "netlify", "scripts", "shared", "web/src"]);
const SOURCE_EXTENSIONS = new Set([".cjs", ".css", ".gd", ".gdshader", ".html", ".js", ".json", ".mjs", ".mts", ".ts", ".tsx"]);

export function fillCodePanelTemplate({ template, manifest, verification, files }) {
  const slots = { MANIFEST: manifest, VERIFICATION: verification, FILES: files };
  let residue = template;
  for (const name of Object.keys(slots)) {
    const token = `{{${name}}}`;
    if (template.split(token).length !== 2) throw new Error(`code_panel_template_${name.toLowerCase()}_invalid`);
    residue = residue.replace(token, "");
  }
  if (residue.includes("{{")) throw new Error("code_panel_template_unknown_slot");
  let result = template;
  for (const [name, value] of Object.entries(slots)) result = result.replace(`{{${name}}}`, value);
  return result;
}

function flagValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`missing_${flag.slice(2)}`);
  return process.argv[index + 1];
}

function normalise(relativePath) {
  return relativePath.split(path.sep).join("/");
}

async function walk(root, directory, files = []) {
  const absolute = path.join(root, directory);
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(root, relative, files);
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(normalise(relative));
  }
  return files;
}

async function buildManifest(root) {
  const paths = [];
  for (const directory of MANIFEST_ROOTS) paths.push(...await walk(root, directory));
  const rows = [];
  for (const relative of paths.sort()) {
    const absolute = path.join(root, relative);
    const bytes = (await stat(absolute)).size;
    const digest = createHash("sha256").update(await readFile(absolute)).digest("hex");
    rows.push(`${relative}\t${bytes}\tsha256:${digest}`);
  }
  return rows.join("\n");
}

async function buildFiles(root) {
  const sections = [];
  for (const relative of CANDIDATE_FILES) {
    const absolute = path.join(root, relative);
    const content = await readFile(absolute, "utf8");
    if (content.includes("\0")) throw new Error(`binary_candidate_file:${relative}`);
    sections.push(`===== FILE: ${relative} =====\n${content.trimEnd()}`);
  }
  return sections.join("\n\n");
}

async function main() {
  const root = path.resolve(flagValue("--root"));
  const [template, verification, manifest, files] = await Promise.all([
    readFile(path.resolve(flagValue("--template")), "utf8"),
    readFile(path.resolve(flagValue("--verification-file")), "utf8"),
    buildManifest(root),
    buildFiles(root),
  ]);
  const output = fillCodePanelTemplate({
    template,
    manifest,
    verification: verification.trimEnd(),
    files,
  });
  const outputPath = path.resolve(flagValue("--output-file"));
  await writeFile(outputPath, output, { encoding: "utf8", flag: "wx" });
  process.stdout.write(`${CANDIDATE_FILES.length} candidate files written; ${Buffer.byteLength(output, "utf8")} UTF-8 bytes\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
