import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { builtinModules } from "node:module";
import path, { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "vite";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultProjectRoot = resolve(scriptDirectory, "..");

export const NETLIFY_FUNCTION_NAMES = Object.freeze([
  "account-assets",
  "account-progress",
  "account-reset",
  "account-session",
  "image-lab-jobs",
  "image-lab-session",
  "market-room",
  "market-session",
  "openverse-image",
  "openverse-search",
  "product-price-guide",
  "studio-coach",
  "teacher-accounts",
  "teacher-session"
]);

function digest(relativePath, bytes) {
  return {
    path: relativePath.replaceAll(path.sep, "/"),
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

async function assertExactFiles(directory, expected, label, { ignored = [] } = {}) {
  const entries = await readdir(directory, { withFileTypes: true });
  if (!entries.every((entry) => entry.isFile())) {
    throw new Error(`${label} must contain files only`);
  }
  const ignoredSet = new Set(ignored);
  const actual = entries.map(({ name }) => name)
    .filter((name) => !ignoredSet.has(name))
    .sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} file set mismatch: ${JSON.stringify({ actual, expected: wanted })}`);
  }
}

export async function buildNetlifyFunctions({
  root = defaultProjectRoot,
  log = console.log
} = {}) {
  const projectRoot = path.resolve(root);
  const outputDirectory = resolve(projectRoot, "netlify", "function-bundles");
  const wrapperDirectory = resolve(projectRoot, "netlify", "deploy-functions");
  await mkdir(outputDirectory, { recursive: true });
  await assertExactFiles(
    wrapperDirectory,
    NETLIFY_FUNCTION_NAMES.map((name) => `${name}.mts`),
    "Netlify deploy wrapper directory"
  );

  const functions = [];
  for (const functionName of NETLIFY_FUNCTION_NAMES) {
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
    const wrapperName = `${functionName}.mts`;
    const wrapperBytes = await readFile(resolve(wrapperDirectory, wrapperName));
    const bundleBytes = Buffer.from(chunk.code, "utf8");
    functions.push({
      name: functionName,
      wrapper: digest(`deploy-functions/${wrapperName}`, wrapperBytes),
      bundle: digest(`function-bundles/${outputName}`, bundleBytes)
    });
  }

  await assertExactFiles(
    outputDirectory,
    NETLIFY_FUNCTION_NAMES.map((name) => `${name}.mjs`),
    "Netlify function bundle directory",
    { ignored: ["function-manifest.json"] }
  );
  const manifest = {
    schema: "ad-market-function-manifest@1",
    functions
  };
  const manifestPath = resolve(outputDirectory, "function-manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  log(JSON.stringify(functions.map(({ name, bundle }) => ({
    name,
    outputPath: resolve(outputDirectory, `${name}.mjs`),
    bytes: bundle.bytes,
    sha256: bundle.sha256
  }))));
  return { manifest, manifestPath };
}

async function main() {
  await buildNetlifyFunctions();
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
