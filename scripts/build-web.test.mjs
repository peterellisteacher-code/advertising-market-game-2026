import test from "node:test";
import assert from "node:assert/strict";

import {
  assertResolvedGodotShell,
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
