import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildStudentCopyCorpus } from "./student-copy-corpus.mjs";

export function formatCoveragePrompt({ flow, entries }) {
  const mappedCopy = entries.map((entry) => `[${entry.id}] ${entry.text}`).join("\n");
  return [
    "PLAIN-LANGUAGE COVERAGE QUESTION",
    "",
    "Assess the complete candidate below. Are students told exactly what to do through small, progressively revealed actions? Can they start immediately? Are roles, progress, and what “done” means clear? Treat this as a coverage critique, not replacement copy, unless you explicitly supply a register rewrite.",
    "",
    "CURRENT FLOW",
    flow.trimEnd(),
    "",
    "COMPLETE CANDIDATE COPY",
    mappedCopy,
    "",
  ].join("\n");
}

function flagValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`missing_${flag.slice(2)}`);
  return process.argv[index + 1];
}

async function main() {
  const scriptRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const root = path.resolve(flagValue("--root") || scriptRoot);
  const flowFile = path.resolve(flagValue("--flow-file"));
  const outputFile = path.resolve(flagValue("--output-file"));
  const [flow, entries] = await Promise.all([
    readFile(flowFile, "utf8"),
    buildStudentCopyCorpus(root),
  ]);
  await writeFile(outputFile, formatCoveragePrompt({ flow, entries }), { encoding: "utf8", flag: "wx" });
  process.stdout.write(`${entries.length} copy entries written\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
