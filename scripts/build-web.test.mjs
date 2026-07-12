import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  assembleWebExport,
  assertResolvedGodotShell,
  copyVerifiedTree,
  injectOfflineCatalogueUrl,
  injectStudioAssets
} from "./build-web.mjs";
import { inspectExportContents } from "./verify-web-export.mjs";

const STALE_PCK_HASH =
  "e8b1d3f2729a16f0d001f8b1483aa4fbc150dcb1b3411b5aacd7456b6cb92459";

test("studio asset injection is local, singular, and idempotent", () => {
  const exported = `<!doctype html>
<html><head>
  <link rel="stylesheet" href="../studio/studio.css">
  <link rel="stylesheet" href="./studio/studio.css">
</head><body>
  <script src="../studio/studio.js"></script>
  <script src="./index.js"></script>
</body></html>`;

  const once = injectStudioAssets(exported);
  const twice = injectStudioAssets(once);

  assert.equal(twice, once);
  assert.equal(once.match(/\.\/studio\/studio\.css/g)?.length, 1);
  assert.equal(once.match(/\.\/studio\/studio\.js/g)?.length, 1);
  assert.doesNotMatch(once, /\.\.\/studio/);
});

test("assembly rejects an unresolved Godot shell", () => {
  assert.throws(
    () => assertResolvedGodotShell("<script src=\"$GODOT_URL\"></script>"),
    /unresolved Godot shell token/i
  );
});

test("offline catalogue root metadata is optional, local, and idempotent", () => {
  const exported = '<div id="creator-root" hidden></div>';
  assert.equal(injectOfflineCatalogueUrl(exported), exported);

  const once = injectOfflineCatalogueUrl(
    exported,
    "/catalog/generated/offline-core-v1/catalog.json"
  );
  const twice = injectOfflineCatalogueUrl(
    once,
    "/catalog/generated/offline-core-v1/catalog.json"
  );

  assert.equal(twice, once);
  assert.match(once, /data-offline-catalogue-url="\/catalog\/generated\/offline-core-v1\/catalog\.json"/);
  assert.throws(
    () => injectOfflineCatalogueUrl(exported, "https://external.example/catalog.json"),
    /local catalogue URL/i
  );
});

test("assembly recursively copies the complete optional offline core tree", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-offline-core-"));
  const studio = path.join(root, "build", "studio");
  const web = path.join(root, "build", "web");
  const core = path.join(root, "catalog", "generated", "offline-core-v1");
  await Promise.all([
    mkdir(studio, { recursive: true }),
    mkdir(web, { recursive: true }),
    mkdir(path.join(core, "assets", "fixture", "masks"), { recursive: true })
  ]);
  await Promise.all([
    writeFile(path.join(studio, "studio.js"), "window.AdMarketCreator = {};"),
    writeFile(path.join(studio, "studio.css"), ".creator{}"),
    writeFile(path.join(web, "index.html"), '<html><head></head><body><div id="creator-root"></div><script src="./index.js"></script></body></html>'),
    writeFile(path.join(web, "index.js"), "const local = true;"),
    writeFile(path.join(web, "index.wasm"), Buffer.from([0])),
    writeFile(path.join(web, "index.pck"), Buffer.from([1])),
    writeFile(path.join(core, "catalog.json"), "[]\n"),
    writeFile(path.join(core, "assets", "fixture", "master.png"), Buffer.from([1, 2, 3])),
    writeFile(path.join(core, "assets", "fixture", "preview-640.webp"), Buffer.from([4, 5])),
    writeFile(path.join(core, "assets", "fixture", "masks", "body.png"), Buffer.from([6]))
  ]);

  await assembleWebExport({ root, requireOfflineCore: true, log: () => {} });

  assert.deepEqual(
    await readFile(path.join(web, "catalog", "generated", "offline-core-v1", "assets", "fixture", "master.png")),
    Buffer.from([1, 2, 3])
  );
  assert.deepEqual(
    await readFile(path.join(web, "catalog", "generated", "offline-core-v1", "assets", "fixture", "masks", "body.png")),
    Buffer.from([6])
  );
  assert.match(await readFile(path.join(web, "index.html"), "utf8"), /data-offline-catalogue-url/);
});

test("assembly rejects an offline core whose catalogue references missing files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-invalid-offline-core-"));
  const studio = path.join(root, "build", "studio");
  const web = path.join(root, "build", "web");
  const core = path.join(root, "catalog", "generated", "offline-core-v1");
  await Promise.all([
    mkdir(studio, { recursive: true }),
    mkdir(web, { recursive: true }),
    mkdir(core, { recursive: true })
  ]);
  await Promise.all([
    writeFile(path.join(studio, "studio.js"), "window.AdMarketCreator = {};"),
    writeFile(path.join(studio, "studio.css"), ".creator{}"),
    writeFile(path.join(web, "index.html"), '<html><head></head><body><div id="creator-root"></div><script src="./index.js"></script></body></html>'),
    writeFile(path.join(web, "index.js"), "const local = true;"),
    writeFile(path.join(web, "index.wasm"), Buffer.from([0])),
    writeFile(path.join(web, "index.pck"), Buffer.from([1])),
    writeFile(path.join(core, "catalog.json"), JSON.stringify([{
      files: {
        master: "/catalog/generated/offline-core-v1/assets/missing/master.png",
        preview: "/catalog/generated/offline-core-v1/assets/missing/preview-640.webp",
        thumbnail: "/catalog/generated/offline-core-v1/assets/missing/thumbnail-192.webp"
      },
      masterSha256: "0".repeat(64)
    }]))
  ]);

  await assert.rejects(
    () => assembleWebExport({ root, requireOfflineCore: true, log: () => {} }),
    /offline catalogue references missing file/i
  );
});

test("recursive copy rejects an existing destination junction", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-copy-junction-"));
  const source = path.join(root, "source");
  const outside = path.join(root, "outside");
  const destinationRoot = path.join(root, "destination");
  const destination = path.join(destinationRoot, "nested");
  await Promise.all([
    mkdir(source, { recursive: true }),
    mkdir(outside, { recursive: true })
  ]);
  await writeFile(path.join(source, "catalog.json"), "[]\n");
  await symlink(outside, destinationRoot, "junction");

  await assert.rejects(
    () => copyVerifiedTree(source, destination),
    /destination.*(?:symlink|reparse|junction)/i
  );
});

test("verification accepts the no-thread local production export and reports the stale spike PCK", () => {
  const result = inspectExportContents({
    files: new Map([
      ["index.html", `<!doctype html><html><head>
        <link rel="stylesheet" href="./studio/studio.css">
      </head><body>
        <script src="./studio/studio.js"></script>
        <script src="./index.js"></script>
      </body></html>`],
      ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
      ["index.wasm", Buffer.from([0])],
      ["index.pck", Buffer.from([1])],
      ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
      ["studio/studio.css", ".creator{}"],
      ["studio/studio.js", "window.AdMarketCreator = publicApi;"],
      ["godot/export_presets.cfg", "variant/thread_support=false"]
    ]),
    pckHash: STALE_PCK_HASH
  });

  assert.deepEqual(result.warnings, ["PCK_STALE_SPIKE_EXPORT"]);
});

test("verification fails closed on legacy, remote, threaded, or duplicate bridge output", () => {
  assert.throws(
    () => inspectExportContents({
      files: new Map([
        ["index.html", `<iframe src="https://example.invalid"></iframe>
          <script src="https://cdn.example.invalid/runtime.js"></script>`],
        ["index.js", "wasm32.nothreads pthread"],
        ["index.wasm", Buffer.from([0])],
        ["index.pck", Buffer.from([1])],
        ["index.audio.worklet.js", "audio"],
        ["studio/studio.css", "css"],
        ["studio/studio.js", `window.AdMarketCreator = one;
          window.AdMarketCreator = two;
          window.AdMarketCreatorSpike = legacy;`],
        ["godot/export_presets.cfg", "variant/thread_support=true"]
      ]),
      pckHash: "not-stale"
    }),
    /verification failed/i
  );
});

test("verification checks every optional offline-core file reference and master hash", () => {
  const master = Buffer.from([1, 2, 3, 4]);
  const masterHash = createHash("sha256").update(master).digest("hex");
  const prefix = "catalog/generated/offline-core-v1/assets/fixture";
  const files = new Map([
    ["index.html", '<link rel="stylesheet" href="./studio/studio.css"><script src="./studio/studio.js"></script><script src="./index.js"></script>'],
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", "window.AdMarketCreator = publicApi;"],
    ["godot/export_presets.cfg", "variant/thread_support=false"],
    [`${prefix}/master.png`, master],
    [`${prefix}/preview-640.webp`, Buffer.from([5])],
    [`${prefix}/thumbnail-192.webp`, Buffer.from([6])],
    ["catalog/generated/offline-core-v1/catalog.json", JSON.stringify([{
      files: {
        master: `/${prefix}/master.png`,
        preview: `/${prefix}/preview-640.webp`,
        thumbnail: `/${prefix}/thumbnail-192.webp`
      },
      masterSha256: masterHash
    }])]
  ]);

  assert.doesNotThrow(() => inspectExportContents({ files, pckHash: "current" }));

  const missing = new Map(files);
  missing.delete(`${prefix}/preview-640.webp`);
  assert.throws(
    () => inspectExportContents({ files: missing, pckHash: "current" }),
    /offline catalogue references missing file/i
  );

  const corrupt = new Map(files);
  corrupt.set(`${prefix}/master.png`, Buffer.from([9]));
  assert.throws(
    () => inspectExportContents({ files: corrupt, pckHash: "current" }),
    /offline catalogue master hash mismatch/i
  );

  const missingHash = new Map(files);
  missingHash.set("catalog/generated/offline-core-v1/catalog.json", JSON.stringify([{
    files: {
      master: `/${prefix}/master.png`,
      preview: `/${prefix}/preview-640.webp`,
      thumbnail: `/${prefix}/thumbnail-192.webp`
    }
  }]));
  assert.throws(
    () => inspectExportContents({ files: missingHash, pckHash: "current" }),
    /offline catalogue record 0 has no valid masterSha256/i
  );
});
