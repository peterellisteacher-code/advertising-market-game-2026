"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const TOKEN_OPEN = "¤";
const TOKEN_CLOSE = "§";
const WORD_BASE = 0xe000;
const WORD_LIMIT = 512;

function encodeResponse(response, entries) {
  const byId = new Map(entries.map((entry, index) => [entry.id, { ...entry, index }]));
  let text = response.split(/(\r\n|\n|\r)/).map((line) => {
    const match = line.match(/^\[([A-Z0-9_]+__L\d{4}__N\d{2})\]\s(.*)$/);
    if (!match) return line;
    const entry = byId.get(match[1]);
    if (!entry || match[2] !== entry.original) return line;
    return `${TOKEN_OPEN}U${entry.index.toString(36)}${TOKEN_CLOSE}`;
  }).join("");

  text = text.replace(/([A-Z0-9_]+__L\d{4}__N\d{2})/g, (id) => {
    const entry = byId.get(id);
    return entry ? `${TOKEN_OPEN}I${entry.index.toString(36)}${TOKEN_CLOSE}` : id;
  });

  const counts = new Map();
  const dictionaryInput = `${text}\n${entries.map((entry) => entry.original).join("\n")}`;
  for (const match of dictionaryInput.matchAll(/\b[A-Za-z][A-Za-z'-]{4,}\b/g)) {
    counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
  }
  const words = [...counts]
    .map(([word, count]) => ({ word, saving: ((word.length - 1) * count) - word.length }))
    .filter(({ saving }) => saving > 4)
    .sort((left, right) => right.saving - left.saving || left.word.localeCompare(right.word))
    .slice(0, WORD_LIMIT)
    .map(({ word }) => word);
  const wordIndex = new Map(words.map((word, index) => [word, index]));
  const encodeWords = (value) => value.replace(/\b[A-Za-z][A-Za-z'-]{4,}\b/g, (word) => {
    const index = wordIndex.get(word);
    return index === undefined ? word : String.fromCharCode(WORD_BASE + index);
  });
  text = encodeWords(text);
  const prefixes = [];
  const prefixIndex = new Map();
  const encodedEntries = entries.map((entry) => {
    const match = entry.id.match(/^(.*)__L(\d{4})__N(\d{2})$/);
    if (!match) throw new Error("capture_entry_id_invalid");
    let index = prefixIndex.get(match[1]);
    if (index === undefined) {
      index = prefixes.length;
      prefixes.push(match[1]);
      prefixIndex.set(match[1], index);
    }
    return [index, Number(match[2]), Number(match[3]), encodeWords(entry.original)];
  });

  return { version: 2, words, prefixes, entries: encodedEntries, text };
}

function decodeResponse(encoded) {
  if (!encoded || encoded.version !== 2 || !Array.isArray(encoded.words)
      || !Array.isArray(encoded.prefixes) || !Array.isArray(encoded.entries)
      || typeof encoded.text !== "string") {
    throw new Error("capture_encoding_invalid");
  }
  const decodeWords = (value) => value.replace(/[\ue000-\ue1ff]/g, (token) => {
    const word = encoded.words[token.charCodeAt(0) - WORD_BASE];
    if (typeof word !== "string") throw new Error("capture_word_missing");
    return word;
  });
  const entries = encoded.entries.map((entry) => {
    if (!Array.isArray(entry) || entry.length !== 4) throw new Error("capture_entry_invalid");
    const [prefixNumber, line, occurrence, original] = entry;
    const prefix = encoded.prefixes[prefixNumber];
    if (typeof prefix !== "string" || !Number.isInteger(line) || !Number.isInteger(occurrence)
        || typeof original !== "string") throw new Error("capture_entry_invalid");
    return {
      id: `${prefix}__L${String(line).padStart(4, "0")}__N${String(occurrence).padStart(2, "0")}`,
      original: decodeWords(original)
    };
  });
  let text = decodeWords(encoded.text);
  text = text.replace(/¤([UI])([0-9a-z]+)§/g, (_token, kind, base36) => {
    const entry = entries[Number.parseInt(base36, 36)];
    if (!entry) throw new Error("capture_entry_missing");
    return kind === "U" ? `[${entry.id}] ${entry.original}` : entry.id;
  });
  return text;
}

function main(argv = process.argv.slice(2)) {
  if (argv.length !== 2) {
    process.stderr.write("Usage: node capture-plain-language-response.cjs <prompt-path> <copy-map-path>\n");
    return 2;
  }
  const [promptPath, copyMapPath] = argv;
  const runner = "C:\\Users\\Peter Ellis\\.agents\\skills\\plain-language\\scripts\\plain_language_contract.cjs";
  const child = spawnSync(process.execPath, [runner, "--prompt-file", path.resolve(promptPath)], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true
  });
  if (child.error) {
    process.stderr.write("plain_language_capture_failed\n");
    return 1;
  }
  if (child.status !== 0) {
    process.stderr.write(child.stderr || "plain_language_failed\n");
    return child.status || 1;
  }
  const response = child.stdout;
  if (!response.trim()) {
    process.stderr.write("plain_language_response_empty\n");
    return 1;
  }
  const copyMap = JSON.parse(fs.readFileSync(copyMapPath, "utf8"));
  const entries = copyMap.entries.map((entry) => ({ id: entry.id, original: entry.original }));
  const encoded = encodeResponse(response, entries);
  const roundTrip = decodeResponse(encoded);
  if (roundTrip !== response) {
    process.stderr.write("plain_language_capture_roundtrip_failed\n");
    return 1;
  }
  process.stdout.write(JSON.stringify({
    encoding: { version: 1, words: encoded.words, text: encoded.text },
    entryCount: entries.length,
    originalCharacters: response.length,
    sha256: crypto.createHash("sha256").update(response, "utf8").digest("hex")
  }));
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { decodeResponse, encodeResponse, main };
