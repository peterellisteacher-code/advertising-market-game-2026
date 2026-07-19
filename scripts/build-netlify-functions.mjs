import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const entryPath = resolve(projectRoot, "netlify", "functions", "account-progress.mts");
const outputDirectory = resolve(projectRoot, "netlify", "function-bundles");
const outputPath = resolve(outputDirectory, "account-progress.mjs");

const result = await build({
  configFile: false,
  root: projectRoot,
  logLevel: "warn",
  build: {
    ssr: entryPath,
    write: false,
    target: "node22",
    minify: false,
    sourcemap: false,
    rollupOptions: {
      output: {
        format: "es",
        entryFileNames: "account-progress.mjs",
        codeSplitting: false
      }
    }
  },
  ssr: {
    noExternal: true
  }
});

const rollupOutputs = Array.isArray(result) ? result : [result];
const emitted = rollupOutputs.flatMap((output) => output.output ?? []);
if (emitted.length !== 1 || emitted[0].type !== "chunk" || !emitted[0].isEntry) {
  throw new Error(`Expected exactly one entry chunk, received ${emitted.length} emitted items.`);
}

const [chunk] = emitted;
if (chunk.fileName !== "account-progress.mjs") {
  throw new Error(`Unexpected function bundle filename: ${chunk.fileName}`);
}
const unsupportedImports = chunk.imports.filter((specifier) => !specifier.startsWith("node:"));
const referencedFiles = chunk.referencedFiles ?? [];
if (
  unsupportedImports.length !== 0 ||
  chunk.dynamicImports.length !== 0 ||
  referencedFiles.length !== 0 ||
  /\bimport\s*\(/u.test(chunk.code) ||
  /\brequire\s*\(/u.test(chunk.code)
) {
  throw new Error(`account-progress bundle is not self-contained: ${JSON.stringify({
    unsupportedImports,
    dynamicImports: chunk.dynamicImports,
    referencedFiles
  })}`);
}

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, chunk.code, "utf8");

const sha256 = createHash("sha256").update(chunk.code).digest("hex");
console.log(JSON.stringify({ outputPath, bytes: Buffer.byteLength(chunk.code), sha256 }));
