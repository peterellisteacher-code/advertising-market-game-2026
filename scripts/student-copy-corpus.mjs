import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function decodeQuoted(value) {
  try {
    return JSON.parse(`"${value.replaceAll('"', '\\"')}"`);
  } catch {
    return value;
  }
}

function looksStudentFacing(value) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length < 2 || !/[A-Za-z]/.test(text)) return false;
  if (/^\$GODOT_[A-Z_]+$/.test(text)) return false;
  if (/^(?:https?:|data:|image\/|audio\/|application\/)/i.test(text)) return false;
  if (/^(?:\.|#|\[|\/|\\|data-|aria-|--)/.test(text)) return false;
  if (/^[A-Z][A-Z0-9_]+$/.test(text)) return false;
  if (/^[a-z][a-z0-9_.:/-]*$/.test(text)) return false;
  if (/^(?:GET|POST|PUT|PATCH|DELETE)\s+\//.test(text)) return false;
  if (/\.(?:ts|js|mjs|json|png|svg|webp|wasm|pck|html|css)$/i.test(text)) return false;
  return /\s/.test(text) || /^[A-Z]/.test(text) || /[.!?]$/.test(text);
}

function htmlCopy(value, line, pathName) {
  const entries = [];
  const attributes = /\b(?:aria-label|placeholder|title|alt)\s*=\s*["']([^"']+)["']/gi;
  for (const match of value.matchAll(attributes)) {
    if (looksStudentFacing(match[1])) entries.push({ path: pathName, line, text: match[1].trim() });
  }
  const withoutCode = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ");
  for (const match of withoutCode.matchAll(/>([^<>]+)</g)) {
    const text = match[1].replace(/\$\{[^}]*\}/g, " ").replace(/\s+/g, " ").trim();
    if (looksStudentFacing(text)) entries.push({ path: pathName, line, text });
  }
  return entries;
}

function lineAt(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function maskElementContents(source, elementName) {
  const pattern = new RegExp(`<${elementName}\\b[^>]*>[\\s\\S]*?<\\/${elementName}>`, "gi");
  return source.replace(pattern, (match) => match.replace(/[^\r\n]/g, " "));
}

export function extractHtmlCopy(source, pathName = "source.html") {
  const entries = [];
  const withoutScripts = maskElementContents(maskElementContents(source, "script"), "style");
  const attributes = /\b(?:aria-label|placeholder|title|alt)\s*=\s*["']([^"']+)["']/gi;
  for (const match of withoutScripts.matchAll(attributes)) {
    if (looksStudentFacing(match[1])) {
      entries.push({ path: pathName, line: lineAt(source, match.index), text: match[1].trim() });
    }
  }
  for (const match of withoutScripts.matchAll(/>([^<>]+)</g)) {
    const text = match[1].replace(/\$\{[^}]*\}/g, " ").replace(/\s+/g, " ").trim();
    if (looksStudentFacing(text)) {
      entries.push({ path: pathName, line: lineAt(source, match.index), text });
    }
  }
  for (const match of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const script = match[1];
    if (!script.trim()) continue;
    const contentOffset = match.index + match[0].indexOf(script);
    const firstLine = lineAt(source, contentOffset);
    for (const entry of extractTypeScriptLiterals(script, pathName)) {
      entries.push({ ...entry, line: firstLine + entry.line - 1 });
    }
  }
  return uniqueOccurrences(entries);
}

function uniqueOccurrences(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.path}\u0000${entry.line}\u0000${entry.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function extractTypeScriptLiterals(source, pathName = "source.ts") {
  const entries = [];
  const literalPattern = /`((?:\\.|[^`\\])*)`|"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/gs;
  for (const match of source.matchAll(literalPattern)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? "";
    const line = source.slice(0, match.index).split(/\r?\n/).length;
    const lineStart = source.lastIndexOf("\n", match.index - 1) + 1;
    const lineEnd = source.indexOf("\n", match.index);
    const sourceLine = source.slice(lineStart, lineEnd < 0 ? source.length : lineEnd);
    if (/\b(?:throw\s+new\s+Error|console\.(?:log|warn|error))\b/.test(sourceLine)) continue;
    const value = decodeQuoted(raw);
    if (value.includes("<") && value.includes(">")) {
      entries.push(...htmlCopy(value, line, pathName));
    } else {
      const text = value.replace(/\$\{[^}]*\}/g, " ").replace(/\s+/g, " ").trim();
      if (looksStudentFacing(text)) entries.push({ path: pathName, line, text });
    }
  }
  return uniqueOccurrences(entries);
}

export function extractGodotSourceLiterals(source, pathName = "source.gd") {
  const entries = [];
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\b(?:preload|load|emit_signal|get_node(?:_or_null)?|connect)\s*\(/.test(line)) return;
    for (const match of line.matchAll(/"((?:\\.|[^"\\])*)"/g)) {
      const text = decodeQuoted(match[1]).replace(/\s+/g, " ").trim();
      if (looksStudentFacing(text)) entries.push({ path: pathName, line: index + 1, text });
    }
  });
  return uniqueOccurrences(entries);
}

export function extractTscnText(source, pathName = "source.tscn") {
  const entries = [];
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(/^\s*(?:text|tooltip_text|placeholder_text)\s*=\s*"((?:\\.|[^"\\])*)"/);
    if (!match) return;
    const text = decodeQuoted(match[1]).replace(/\s+/g, " ").trim();
    if (looksStudentFacing(text)) entries.push({ path: pathName, line: index + 1, text });
  });
  return uniqueOccurrences(entries);
}

function decodeJsonPointerSegment(value) {
  return value.replaceAll("~1", "/").replaceAll("~0", "~");
}

function encodeJsonPointerSegment(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

export function extractJsonCopy(source, pathName, selectors) {
  const entries = [];
  const seen = new Set();
  for (const selector of selectors) {
    if (typeof selector !== "string" || !selector.startsWith("/")) {
      throw new Error(`Invalid student-copy JSON selector for ${pathName}`);
    }
    const segments = selector.slice(1).split("/").map(decodeJsonPointerSegment);
    const visit = (value, index, pointerSegments) => {
      if (index === segments.length) {
        if (typeof value !== "string") {
          throw new Error(
            `Student-copy JSON selector ${selector} in ${pathName} did not resolve to text`
          );
        }
        const text = value.replace(/\s+/g, " ").trim();
        if (text.length === 0) {
          throw new Error(
            `Student-copy JSON selector ${selector} in ${pathName} resolved to blank text`
          );
        }
        const pointer = `/${pointerSegments.map(encodeJsonPointerSegment).join("/")}`;
        if (!seen.has(pointer)) {
          seen.add(pointer);
          entries.push({ path: pathName, pointer, text });
        }
        return;
      }
      const segment = segments[index];
      if (segment === "*") {
        if (Array.isArray(value)) {
          value.forEach((child, childIndex) =>
            visit(child, index + 1, [...pointerSegments, String(childIndex)]));
          return;
        }
        if (value && typeof value === "object") {
          for (const key of Object.keys(value).sort()) {
            visit(value[key], index + 1, [...pointerSegments, key]);
          }
          return;
        }
        throw new Error(
          `Student-copy JSON selector ${selector} in ${pathName} expected a collection`
        );
      }
      if (!value || typeof value !== "object" || !(segment in value)) {
        throw new Error(
          `Student-copy JSON selector ${selector} in ${pathName} is missing ${segment}`
        );
      }
      visit(value[segment], index + 1, [...pointerSegments, segment]);
    };
    visit(source, 0, []);
  }
  return entries;
}

export function stableCopyId(pathName, line, occurrence) {
  const pathPart = pathName.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toUpperCase();
  return `${pathPart}__L${String(line).padStart(4, "0")}__N${String(occurrence).padStart(2, "0")}`;
}

export function stableJsonCopyId(pathName, pointer) {
  return `${pathName}#${pointer}`;
}

async function sourceFiles(root) {
  return STUDENT_COPY_SOURCE_PATHS.map((relative) => path.join(root, ...relative.split("/")));
}

export const STUDENT_COPY_JSON_SOURCES = Object.freeze([
  {
    path: "catalog/generated/offline-core-v1/catalog.json",
    selectors: ["/*/title"]
  },
  {
    path: "catalog/generated/offline-core-v1/product-kit-v1.json",
    selectors: ["/kits/*/title", "/components/*/title"]
  },
  {
    path: "catalog/generated/offline-core-v1/product-kit-pricing-v1.json",
    selectors: [
      "/blueprints/*/title",
      "/groups/*/label",
      "/choices/*/label"
    ]
  },
  {
    path: "catalog/generated/product-builder-pilot-v1/catalogue.json",
    selectors: [
      "/bodies/*/title",
      "/families/*/title",
      "/materials/*/title",
      "/palettes/*/title",
      "/parts/*/title"
    ]
  },
  {
    path: "catalog/generated/product-shells-v1-reviewed/catalog.json",
    selectors: ["/families/*/title", "/shells/*/title"]
  },
  {
    path: "catalog/generated/offline-core-v1/student-starters-v1.json",
    selectors: ["/starters/*/title", "/starters/*/category"]
  }
].map((source) => Object.freeze({
  ...source,
  selectors: Object.freeze(source.selectors)
})));

export const STUDENT_COPY_SOURCE_PATHS = Object.freeze([
  ...STUDENT_COPY_JSON_SOURCES.map(({ path: sourcePath }) => sourcePath),
  "godot/src/agency/AgencyWorld.tscn",
  "godot/src/agency/agency_campaign_controller.gd",
  "godot/src/agency/agency_mission_catalog.gd",
  "godot/src/agency/agency_progress.gd",
  "godot/src/agency/agency_world.gd",
  "godot/src/agency/missions/AgencyMissionPanel.tscn",
  "godot/src/agency/missions/agency_mission_controller.gd",
  "godot/src/agency/missions/agency_mission_panel.gd",
  "godot/src/agency/player/AgencyPair.tscn",
  "godot/src/agency/stations/AgencyStation.tscn",
  "godot/src/agency/stations/agency_station.gd",
  "godot/src/agency/ui/AgencyGuideDrawer.tscn",
  "godot/src/agency/ui/AgencyHud.tscn",
  "godot/src/agency/ui/agency_guide_drawer.gd",
  "godot/src/agency/ui/agency_hud.gd",
  "godot/src/game/game_run.gd",
  "godot/src/main/main.gd",
  "godot/src/main/Main.tscn",
  "godot/src/market/ui/market_screen.gd",
  "godot/src/market/ui/MarketScreen.tscn",
  "godot/src/presentation/PitchTheatre.tscn",
  "godot/src/presentation/pitch_theatre.gd",
  "godot/web/godot_shell.html",
  "web/src/account/account-gate.ts",
  "web/src/account/account-reset-dialog.ts",
  "web/src/ai-image/image-lab-panel.ts",
  "web/src/catalogue/catalogue-panel.ts",
  "web/src/catalogue/catalogue-runtime.ts",
  "web/src/export/campaign-exporter.ts",
  "web/src/fabric/fabric-canvas-adapter.ts",
  "web/src/game/aida-playbook-panel.ts",
  "web/src/game/aida-playbook.ts",
  "web/src/game/audience-briefs.ts",
  "web/src/game/creator-level-access.ts",
  "web/src/game/creator-stage.ts",
  "web/src/game/guided-journey-controller.ts",
  "web/src/game/guided-journey.ts",
  "web/src/game/market-card-preview.ts",
  "web/src/game/market-route-panel.ts",
  "web/src/game/market-route.ts",
  "web/src/game/pair-game-controller.ts",
  "web/src/game/role-guide-controller.ts",
  "web/src/game/studio-onboarding-controller.ts",
  "web/src/game/student-copy.ts",
  "web/src/history/fabric-history-bindings.ts",
  "web/src/logo-lab/logo-lab-panel.ts",
  "web/src/main.ts",
  "web/src/product-builder/product-builder-panel.ts",
  "web/src/product-builder/product-money-panel.ts",
  "web/src/product-kit/product-kit-panel.ts",
  "web/src/product-shells/product-shell-picker.ts",
  "web/src/product-shells/product-shell-region-controls.ts",
  "web/src/studio-coach/technique-catalogue.ts",
  "web/src/studio-coach/studio-coach-client.ts",
  "web/src/studio-coach/studio-coach-runtime.ts",
  "web/src/studio-coach/studio-coach-panel.ts",
  "web/src/tools/section-fill-controller.ts",
  "web/src/teacher/teacher-dashboard.ts",
  "web/src/teacher/teacher-playtest-controller.ts",
  "web/src/ui/editor-shell.ts",
  "web/src/ui/canvas-accessibility-controller.ts",
  "web/src/ui/studio-split-pane.ts",
  "web/src/ui/studio-tool-drawer.ts"
]);

export const COPY_SOURCE_AUDIENCE = Object.freeze({
  "web/src/teacher/teacher-dashboard.ts": "teacher",
  "web/src/teacher/teacher-playtest-controller.ts": "teacher"
});

export async function buildStudentCopyCorpus(root) {
  const entries = [];
  for (const absolute of await sourceFiles(root)) {
    const relative = path.relative(root, absolute).replaceAll(path.sep, "/");
    entries.push(...await extractStudentCopyFile(root, relative));
  }
  const lineCounts = new Map();
  return entries.map((entry) => {
    if (entry.pointer) {
      return {
        id: stableJsonCopyId(entry.path, entry.pointer),
        audience: COPY_SOURCE_AUDIENCE[entry.path] ?? "student",
        ...entry
      };
    }
    const key = `${entry.path}\u0000${entry.line}`;
    const occurrence = (lineCounts.get(key) ?? 0) + 1;
    lineCounts.set(key, occurrence);
    return {
      id: stableCopyId(entry.path, entry.line, occurrence),
      audience: COPY_SOURCE_AUDIENCE[entry.path] ?? "student",
      ...entry
    };
  });
}

export async function extractStudentCopyFile(root, relative) {
  const absolute = path.join(root, ...relative.split("/"));
  const source = await readFile(absolute, "utf8");
  if (relative.endsWith(".ts")) return extractTypeScriptLiterals(source, relative);
  if (relative.endsWith(".gd")) return extractGodotSourceLiterals(source, relative);
  if (relative.endsWith(".html")) return extractHtmlCopy(source, relative);
  if (relative.endsWith(".json")) {
    const configured = STUDENT_COPY_JSON_SOURCES.find(({ path: sourcePath }) =>
      sourcePath === relative);
    if (!configured) {
      throw new Error(`Student-copy JSON source has no field classification: ${relative}`);
    }
    return extractJsonCopy(JSON.parse(source), relative, configured.selectors);
  }
  return extractTscnText(source, relative);
}

async function main() {
  const rootFlag = process.argv.indexOf("--root");
  const root = path.resolve(rootFlag >= 0 ? process.argv[rootFlag + 1] : path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
  const outputFlag = process.argv.indexOf("--output");
  const output = `${JSON.stringify(await buildStudentCopyCorpus(root), null, 2)}\n`;
  if (outputFlag >= 0) {
    await writeFile(path.resolve(process.argv[outputFlag + 1]), output, "utf8");
    return;
  }
  process.stdout.write(output);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
