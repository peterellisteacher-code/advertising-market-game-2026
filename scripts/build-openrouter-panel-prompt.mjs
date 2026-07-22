import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildStudentCopyCorpus } from "./student-copy-corpus.mjs";

const SLOTS = Object.freeze(["FLOW", "COPY", "VISUAL_FACTS"]);

export function fillPanelTemplate({ template, flow, copy, visualFacts }) {
  const values = { FLOW: flow, COPY: copy, VISUAL_FACTS: visualFacts };
  let result = template;
  for (const slot of SLOTS) {
    const token = `{{${slot}}}`;
    if (result.split(token).length !== 2) throw new Error(`panel_template_${slot.toLowerCase()}_invalid`);
    result = result.replace(token, values[slot]);
  }
  if (result.includes("{{")) throw new Error("panel_template_unknown_slot");
  return result;
}

function flagValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`missing_${flag.slice(2)}`);
  return process.argv[index + 1];
}

async function main() {
  const root = path.resolve(flagValue("--root"));
  const [template, flow, visualFacts, entries] = await Promise.all([
    readFile(path.resolve(flagValue("--template")), "utf8"),
    readFile(path.resolve(flagValue("--flow-file")), "utf8"),
    readFile(path.resolve(flagValue("--visual-file")), "utf8"),
    buildStudentCopyCorpus(root),
  ]);
  const copy = entries.map((entry) => `[${entry.id}] ${entry.text}`).join("\n");
  const output = fillPanelTemplate({ template, flow: flow.trimEnd(), copy, visualFacts: visualFacts.trimEnd() });
  await writeFile(path.resolve(flagValue("--output-file")), output, { encoding: "utf8", flag: "wx" });
  process.stdout.write(`${entries.length} copy entries written\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
