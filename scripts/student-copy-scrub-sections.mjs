import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function positiveInteger(value, label) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return parsed;
}

function occurrence(entry) {
  if (typeof entry?.id !== "string" || entry.id.length === 0) {
    throw new Error("Every corpus occurrence requires a stable copy ID");
  }
  if (typeof entry.path !== "string" || entry.path.length === 0) {
    throw new Error(`Corpus occurrence ${entry.id} requires a source path`);
  }
  if (Number.isSafeInteger(entry.line) && entry.line > 0) {
    return { id: entry.id, path: entry.path, line: entry.line };
  }
  if (typeof entry.pointer === "string" && entry.pointer.startsWith("/")) {
    return { id: entry.id, path: entry.path, pointer: entry.pointer };
  }
  throw new Error(`Corpus occurrence ${entry.id} requires a source line or JSON pointer`);
}

function sectionRecord(sectionNumber, entries) {
  const name = `section-${String(sectionNumber).padStart(3, "0")}.txt`;
  const content = `${entries.map(({ text }) => text).join("\n")}\n`;
  return {
    file: {
      name,
      content
    },
    manifest: {
      name,
      sha256: sha256(content),
      utf8Bytes: Buffer.byteLength(content, "utf8"),
      lineCount: entries.length,
      lines: entries.map((entry, index) => ({
        lineNumber: index + 1,
        orderedLineNumber: entry.orderedLineNumber,
        textSha256: sha256(entry.text),
        copyIds: entry.occurrences.map(({ id }) => id),
        occurrences: entry.occurrences
      }))
    }
  };
}

export function planScrubSections(corpus, maxUtf8Bytes) {
  if (!Array.isArray(corpus)) throw new Error("Student-copy corpus must be an array");
  const maximum = positiveInteger(maxUtf8Bytes, "maxUtf8Bytes");
  const seenIds = new Set();
  const byText = new Map();
  const unique = [];

  for (const entry of corpus) {
    const sourceOccurrence = occurrence(entry);
    if (seenIds.has(sourceOccurrence.id)) {
      throw new Error(`Student-copy corpus contains duplicate stable copy ID ${sourceOccurrence.id}`);
    }
    seenIds.add(sourceOccurrence.id);
    if (typeof entry.text !== "string" || entry.text.length === 0 ||
        /[\r\n]/.test(entry.text)) {
      throw new Error(`Corpus occurrence ${sourceOccurrence.id} requires one nonblank line of text`);
    }
    const existing = byText.get(entry.text);
    if (existing) {
      existing.occurrences.push(sourceOccurrence);
      continue;
    }
    const record = {
      text: entry.text,
      orderedLineNumber: unique.length + 1,
      occurrences: [sourceOccurrence]
    };
    byText.set(entry.text, record);
    unique.push(record);
  }

  const rawSections = [];
  let current = [];
  let currentBytes = 0;
  for (const entry of unique) {
    const lineBytes = Buffer.byteLength(`${entry.text}\n`, "utf8");
    if (lineBytes > maximum) {
      throw new Error(
        `Student-copy string ${entry.orderedLineNumber} does not fit in one scrub section`
      );
    }
    if (current.length > 0 && currentBytes + lineBytes > maximum) {
      rawSections.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(entry);
    currentBytes += lineBytes;
  }
  if (current.length > 0) rawSections.push(current);

  const records = rawSections.map((entries, index) =>
    sectionRecord(index + 1, entries));
  return {
    manifest: {
      schema: "admarket-student-copy-scrub-sections@1",
      maxUtf8Bytes: maximum,
      occurrenceCount: corpus.length,
      uniqueTextCount: unique.length,
      sectionCount: records.length,
      sections: records.map(({ manifest }) => manifest)
    },
    files: records.map(({ file }) => file)
  };
}

async function requireAbsentDirectory(outputDir) {
  try {
    await stat(outputDir);
    throw new Error(`Scrub output directory already exists: ${outputDir}`);
  } catch (error) {
    if (error instanceof Error &&
        "code" in error && error.code === "ENOENT") return;
    throw error;
  }
}

export async function writeScrubSections({
  corpusPath,
  outputDir,
  maxUtf8Bytes
}) {
  if (typeof corpusPath !== "string" || corpusPath.length === 0) {
    throw new Error("corpusPath is required");
  }
  if (typeof outputDir !== "string" || outputDir.length === 0) {
    throw new Error("outputDir is required");
  }
  const corpusBytes = await readFile(corpusPath);
  const corpus = JSON.parse(corpusBytes.toString("utf8"));
  const planned = planScrubSections(corpus, maxUtf8Bytes);
  const result = {
    ...planned,
    manifest: {
      ...planned.manifest,
      corpusSha256: sha256(corpusBytes)
    }
  };

  await requireAbsentDirectory(outputDir);
  try {
    await mkdir(outputDir);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      throw new Error(`Scrub output directory already exists: ${outputDir}`);
    }
    throw error;
  }
  for (const file of result.files) {
    await writeFile(path.join(outputDir, file.name), file.content, {
      encoding: "utf8",
      flag: "wx"
    });
  }
  await writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify(result.manifest, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" }
  );
  return result;
}

function flagValue(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) {
    throw new Error(`Missing required ${name} flag`);
  }
  return process.argv[index + 1];
}

async function main() {
  const corpusPath = path.resolve(flagValue("--corpus"));
  const outputDir = path.resolve(flagValue("--output-dir"));
  const maxUtf8Bytes = positiveInteger(
    flagValue("--max-utf8-bytes"),
    "--max-utf8-bytes"
  );
  const result = await writeScrubSections({
    corpusPath,
    outputDir,
    maxUtf8Bytes
  });
  process.stdout.write(
    `student_copy_scrub_sections_saved sections=${result.manifest.sectionCount}\n`
  );
}

if (process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
