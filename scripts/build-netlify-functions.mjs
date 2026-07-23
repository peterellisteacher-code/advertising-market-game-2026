import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const outputDirectory = resolve(projectRoot, "netlify", "function-bundles");
const functionNames = [
  "account-assets",
  "account-progress",
  "account-session",
  "image-lab-jobs",
  "image-lab-session",
  "market-room",
  "market-session",
  "openverse-image",
  "openverse-search",
  "product-price-guide",
  "studio-coach"
];

await mkdir(outputDirectory, { recursive: true });

const manifest = [];
for (const functionName of functionNames) {
  const entryPath = resolve(projectRoot, "netlify", "functions", `${functionName}.mts`);
  const outputName = `${functionName}.mjs`;
  const outputPath = resolve(outputDirectory, outputName);
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
          entryFileNames: outputName,
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
    throw new Error(`${functionName}: expected exactly one entry chunk, received ${emitted.length}.`);
  }

  const [chunk] = emitted;
  if (chunk.fileName !== outputName) {
    throw new Error(`${functionName}: unexpected bundle filename: ${chunk.fileName}`);
  }
  const unsupportedImports = chunk.imports.filter(
    (specifier) => !specifier.startsWith("node:") && !builtinModules.includes(specifier)
  );
  const referencedFiles = chunk.referencedFiles ?? [];
  if (
    unsupportedImports.length !== 0 ||
    chunk.dynamicImports.length !== 0 ||
    referencedFiles.length !== 0 ||
    /\bimport\s*\(/u.test(chunk.code) ||
    /\brequire\s*\(/u.test(chunk.code)
  ) {
    throw new Error(`${functionName} bundle is not self-contained: ${JSON.stringify({
      unsupportedImports,
      dynamicImports: chunk.dynamicImports,
      referencedFiles
    })}`);
  }

  await writeFile(outputPath, chunk.code, "utf8");
  manifest.push({
    outputPath,
    bytes: Buffer.byteLength(chunk.code),
    sha256: createHash("sha256").update(chunk.code).digest("hex")
  });
}

console.log(JSON.stringify(manifest));
