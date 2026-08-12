import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { link, mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";

import {
  assembleWebExport,
  assertAccountGatedGodotShell,
  assertResolvedGodotShell,
  copyVerifiedTree,
  injectOfflineCatalogueUrl,
  injectProductShellCatalogueUrl,
  injectStudioAssets,
  normaliseRoutedGodotShell
} from "./build-web.mjs";
import * as buildWeb from "./build-web.mjs";
import { inspectExportContents } from "./verify-web-export.mjs";
import * as verifyWebExport from "./verify-web-export.mjs";

const STALE_PCK_HASH =
  "e8b1d3f2729a16f0d001f8b1483aa4fbc150dcb1b3411b5aacd7456b6cb92459";
const VALID_STUDIO_BRIDGES =
  "window.AdMarketCreator = Object.freeze({ handle() {} }); window.AdMarketPractice = Object.freeze({ handle() {} });";

async function activateGeneratedWorker(worker, cacheNames) {
  const handlers = new Map();
  const deleted = [];
  const matchOptions = [];
  const navigated = [];
  const claimed = [];
  const studentUrl =
    "https://advertising-market-game-2026.netlify.app/student?pair=7";
  runInNewContext(worker, {
    Response,
    URL,
    crypto: globalThis.crypto,
    fetch: globalThis.fetch,
    caches: {
      async delete(name) {
        deleted.push(name);
        return true;
      },
      async keys() {
        return [...cacheNames];
      },
      async open() {
        throw new Error("Activation must not open a cache");
      }
    },
    self: {
      addEventListener(type, handler) {
        handlers.set(type, handler);
      },
      clients: {
        async claim() {
          claimed.push(true);
        },
        async matchAll(options) {
          matchOptions.push({ ...options });
          return [
            {
              url: studentUrl,
              async navigate(url) {
                navigated.push(url);
                return null;
              }
            },
            {
              url: "https://advertising-market-game-2026.netlify.app/teacher",
              async navigate() {
                throw new Error("Client closed during activation");
              }
            }
          ];
        }
      },
      location: {
        origin: "https://advertising-market-game-2026.netlify.app"
      },
      async skipWaiting() {}
    }
  });
  const activate = handlers.get("activate");
  assert.equal(typeof activate, "function");
  let activation;
  activate({
    waitUntil(promise) {
      activation = promise;
    }
  });
  assert.ok(activation, "activate must register completion work");
  await activation;
  return { claimed, deleted, matchOptions, navigated };
}

function rasterPricing(catalogueText, entries) {
  return JSON.stringify({
    schema: "raster-production-pricing@1",
    packId: "offline-core-v1",
    pricingVersion: 1,
    catalogSha256: createHash("sha256").update(Buffer.from(catalogueText)).digest("hex"),
    entries
  });
}

const PRODUCT_BUILDER_FAMILIES = [
  { id: "bags", slotId: "carry-system" },
  { id: "drinkware", slotId: "top" },
  { id: "food-packaging", slotId: "closure" }
];

function makeProductBuilderCatalogue() {
  const families = PRODUCT_BUILDER_FAMILIES.map(({ id, slotId }) => ({
    id,
    title: id,
    componentSlotId: slotId
  }));
  const parts = PRODUCT_BUILDER_FAMILIES.flatMap(({ id: familyId, slotId }) =>
    Array.from({ length: 4 }, (_, index) => {
      const id = `${familyId}-${slotId}-part-${index + 1}`;
      return {
        id,
        familyId,
        slotId,
        geometryId: `part-${slotId}-${index + 1}`,
        title: id,
        componentSvg: `components/${id}.svg`
      };
    }));
  const bodies = PRODUCT_BUILDER_FAMILIES.flatMap(({ id: familyId, slotId }) => {
    const compatiblePartIds = parts
      .filter((part) => part.familyId === familyId)
      .map((part) => part.id);
    return Array.from({ length: 4 }, (_, index) => {
      const id = `${familyId}-body-${index + 1}`;
      return {
        id,
        familyId,
        componentSlotId: slotId,
        compatiblePartIds,
        geometryId: `body-${familyId}-${index + 1}`,
        title: id,
        componentAnchor: { x: 0.5, y: 0.1 },
        artworkBounds: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
        authoringSvg: `bodies/${id}/authoring.svg`,
        previewSvg: `bodies/${id}/preview.svg`
      };
    });
  });
  return {
    schema: "product-builder-catalogue@1",
    packId: "product-builder-pilot-v1",
    version: 1,
    families,
    bodies,
    parts,
    palettes: Array.from({ length: 16 }, (_, index) => ({
      id: `palette-${index + 1}`,
      title: `Palette ${index + 1}`,
      colours: { body: "#112233", trim: "#223344", accent: "#334455", label: "#ffffff" }
    })),
    materials: Array.from({ length: 8 }, (_, index) => ({
      id: `material-${index + 1}`,
      title: `Material ${index + 1}`
    })),
    virtualCount: 6144
  };
}

async function writeProductBuilderPack(root, {
  mutateCatalogue,
  mutateQa,
  omitRelative
} = {}) {
  const directory = path.join(root, "catalog", "generated", "product-builder-pilot-v1");
  const catalogue = makeProductBuilderCatalogue();
  mutateCatalogue?.(catalogue);
  await mkdir(directory, { recursive: true });

  const validCatalogue = makeProductBuilderCatalogue();
  const svgPaths = [
    ...validCatalogue.bodies.flatMap((body) => [body.authoringSvg, body.previewSvg]),
    ...validCatalogue.parts.map((part) => part.componentSvg)
  ];
  for (const relative of svgPaths) {
    if (relative === omitRelative) continue;
    const absolute = path.join(directory, ...relative.split("/"));
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, '<svg xmlns="http://www.w3.org/2000/svg"/>');
  }
  await writeFile(path.join(directory, "catalogue.json"), JSON.stringify(catalogue));
  await writeFile(path.join(directory, "source.json"), JSON.stringify({ schema: "product-builder-source@1" }));

  const hashPaths = ["catalogue.json", "source.json", ...svgPaths]
    .filter((relative) => relative !== omitRelative);
  const sha256 = {};
  for (const relative of hashPaths) {
    sha256[relative] = createHash("sha256")
      .update(await readFile(path.join(directory, ...relative.split("/"))))
      .digest("hex");
  }
  const qa = {
    schema: "product-builder-qa@1",
    packId: "product-builder-pilot-v1",
    bodyCount: 12,
    componentCount: 12,
    renderedSvgCount: 36,
    virtualCount: 6144,
    fileCount: hashPaths.length + 1,
    sha256
  };
  mutateQa?.(qa);
  await writeFile(path.join(directory, "qa.json"), JSON.stringify(qa));
  return directory;
}

async function writeExportScaffold(
  root,
  creatorRoot = '<div id="creator-root"></div>',
  { includeRuntimeStaticAssets = true } = {}
) {
  const studio = path.join(root, "build", "studio");
  const web = path.join(root, "build", "web");
  await Promise.all([
    mkdir(studio, { recursive: true }),
    mkdir(web, { recursive: true })
  ]);
  if (includeRuntimeStaticAssets) {
    await Promise.all([
      mkdir(path.join(studio, "catalog", "backgrounds"), { recursive: true }),
      mkdir(path.join(studio, "fonts"), { recursive: true })
    ]);
  }
  await Promise.all([
    writeFile(path.join(studio, "studio.js"), "window.AdMarketCreator = {};"),
    writeFile(path.join(studio, "studio.css"), ".creator{}"),
    ...(includeRuntimeStaticAssets
      ? [
          writeFile(path.join(studio, "catalog", "backgrounds", "fixture.svg"), "<svg/>", "utf8"),
          writeFile(path.join(studio, "fonts", "Fixture-Regular.ttf"), Buffer.from([0, 1, 2]))
        ]
      : []),
    writeFile(
      path.join(web, "index.html"),
      `<html><head></head><body>${creatorRoot}<script>window.bootstrap = true;</script><script src="./index.js"></script></body></html>`
    ),
    writeFile(path.join(web, "index.js"), "const local = true;"),
    writeFile(path.join(web, "index.wasm"), Buffer.from([0])),
    writeFile(path.join(web, "index.pck"), Buffer.from([1]))
  ]);
  return { studio, web };
}

async function writeFunctionArtifactFixture(root) {
  const wrapperDirectory = path.join(root, "netlify", "deploy-functions");
  const bundleDirectory = path.join(root, "netlify", "function-bundles");
  await Promise.all([
    mkdir(wrapperDirectory, { recursive: true }),
    mkdir(bundleDirectory, { recursive: true })
  ]);
  const wrapper = 'export { default } from "../function-bundles/example.mjs";\n';
  const bundle = "export default async () => new Response('ok');\n";
  await Promise.all([
    writeFile(path.join(wrapperDirectory, "example.mts"), wrapper),
    writeFile(path.join(bundleDirectory, "example.mjs"), bundle)
  ]);
  const record = (relative, value) => ({
    path: relative,
    bytes: Buffer.byteLength(value),
    sha256: createHash("sha256").update(value).digest("hex")
  });
  await writeFile(path.join(bundleDirectory, "function-manifest.json"), JSON.stringify({
    schema: "ad-market-function-manifest@1",
    functions: [{
      name: "example",
      wrapper: record("deploy-functions/example.mts", wrapper),
      bundle: record("function-bundles/example.mjs", bundle)
    }]
  }, null, 2));
}

function expectedCspHeaders(inlineScriptBody) {
  const hash = createHash("sha256")
    .update(Buffer.from(inlineScriptBody, "utf8"))
    .digest("base64");
  return `/*\n  Content-Security-Policy: default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self' 'sha256-${hash}' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'none'; form-action 'self'; frame-ancestors 'self';\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Embedder-Policy: require-corp\n  Cross-Origin-Resource-Policy: same-origin\n  Cache-Control: public, max-age=0, must-revalidate\n\n/service-worker.js\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/asset-manifest.json\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/release-manifest.json\n  Cache-Control: no-cache, no-store, must-revalidate\n\n/manifest.webmanifest\n  Cache-Control: no-cache, must-revalidate\n`;
}

function addCspHeaders(files) {
  const html = files.get("index.html");
  const match = typeof html === "string" && html.match(/<script>([\s\S]*?)<\/script>/i);
  assert.ok(match, "test export needs an inline bootstrap script");
  files.set("_headers", expectedCspHeaders(match[1]));
  return files;
}

function addInlineBootstrapAndCspHeaders(files) {
  const html = files.get("index.html");
  assert.equal(typeof html, "string", "test export needs index.html");
  const augmented = html.replace(
    /<script\s+src=(['"])(?:\.\/)?index\.js\1\s*><\/script>/i,
    '<script>bootstrap();</script>$&'
  );
  assert.notEqual(augmented, html, "test export needs a local index.js script");
  files.set("index.html", augmented);
  return addCspHeaders(files);
}

function makeLogoIconCatalogue(count = 4205) {
  return {
    schema: "logo-icon-catalog@1",
    packId: "tabler-logo-icons-v1",
    version: 1,
    source: {
      name: "Tabler Icons",
      package: "@iconify-json/tabler",
      packageVersion: "1.2.35",
      sourceVersion: "3.44.0",
      licence: "MIT",
      url: "https://github.com/tabler/tabler-icons"
    },
    icons: Array.from({ length: count }, (_, index) => ({
      id: `icon-${String(index).padStart(4, "0")}`,
      title: `Icon ${index}`,
      body: '<path fill="none" stroke="currentColor" d="M2 12h20"/>',
      width: 24,
      height: 24,
      categories: ["general"]
    }))
  };
}

async function writeLogoIconPack(root, {
  count = 4205,
  mutateCatalogue,
  rawCatalogue
} = {}) {
  const directory = path.join(root, "catalog", "generated", "logo-icons-v1-reviewed");
  await mkdir(directory, { recursive: true });
  if (rawCatalogue !== undefined) {
    await writeFile(path.join(directory, "catalog.json"), rawCatalogue);
    return directory;
  }
  const catalogue = makeLogoIconCatalogue(count);
  mutateCatalogue?.(catalogue);
  await writeFile(path.join(directory, "catalog.json"), JSON.stringify(catalogue));
  return directory;
}

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

test("studio bridge precedes both Godot index-script spellings", () => {
  for (const source of ["index.js", "./index.js"]) {
    const assembled = injectStudioAssets(
      `<!doctype html><html><head></head><body><script src="${source}"></script></body></html>`
    );
    assert.ok(
      assembled.indexOf('<script src="./studio/studio.js"></script>') <
        assembled.indexOf(`<script src="${source}"></script>`),
      `studio bridge must precede ${source}`
    );
  }
});

test("routed Godot shell anchors nested-route assets and uses route-neutral access", () => {
  const exported = `<!doctype html>
<html><head>
  <link rel="stylesheet" href="./studio/studio.css">
  <base href="/stale/">
  <base href="https://invalid.example/">
</head><body>
  <main aria-label="Advertising Market Game" hidden inert aria-hidden="true">
    <canvas id="canvas" tabindex="-1"></canvas>
  </main>
  <div id="account-gate-root"></div>
  <section id="account-session-root"></section>
  <script src="./index.js"></script>
  <script>
    const withStartupTimeout = (startup) => startup;
    const engine = new Engine({});
    window.AdMarketAccount.requireAccess()
      .then(() => withStartupTimeout(engine.startGame()))
      .catch((error) => {
        if (error.name === "TimeoutError") {
          window.AdMarketGameAccess.reportStartupFailure("timeout");
        } else {
          window.AdMarketGameAccess.reportStartupFailure("engine");
        }
      });
  </script>
</body></html>`;

  const once = normaliseRoutedGodotShell(exported);
  const twice = normaliseRoutedGodotShell(once);

  assert.equal(twice, once);
  assert.equal(once.match(/<base href="\/">/g)?.length, 1);
  assert.ok(once.indexOf('<base href="/">') < once.indexOf("./studio/studio.css"));
  assert.ok(once.indexOf('<base href="/">') < once.indexOf("./index.js"));
  assert.doesNotMatch(once, /invalid\.example|href="\/stale\/"/);
  assert.match(once, /window\.AdMarketGameAccess\.requireAccess\(\)/);
  assert.doesNotMatch(once, /window\.AdMarketAccount\.requireAccess\(\)/);
  assert.doesNotThrow(() => assertAccountGatedGodotShell(once));
});

test("deployed Godot shell blocks game focus and awaits mandatory routed access", async () => {
  const shell = await readFile(path.join(
    import.meta.dirname,
    "..",
    "godot",
    "web",
    "godot_shell.html"
  ), "utf8");

  assert.doesNotThrow(() => assertAccountGatedGodotShell(shell));
  assert.equal(shell.match(/<base href="\/">/g)?.length, 1);
  assert.match(shell, /window\.AdMarketGameAccess\.requireAccess\(\)/);
  assert.match(shell, /id="game-startup-status"/);
  assert.match(shell, /120_000/);
  assert.doesNotMatch(shell, /45_000/);
  assert.match(shell, /admarket-release-marker/);
  assert.match(shell, /navigator\.serviceWorker\.getRegistrations\(\)/);
  assert.ok(
    shell.indexOf("prepareReleaseAssets()") < shell.indexOf("new Engine("),
    "stale release recovery must run before the engine starts"
  );
  assert.match(shell, /reportStartupProgress/);
  assert.match(shell, /reportStartupReady/);
  assert.match(shell, /const reason = error instanceof GameStartupTimeoutError \? "timeout" : "engine"/);
  assert.match(shell, /reportStartupFailure\(reason\)/);
  assert.doesNotMatch(shell, /window\.AdMarketAccount\.requireAccess\(\)/);
  assert.throws(() => assertAccountGatedGodotShell(`
    <main aria-label="Advertising Market Game"><canvas id="canvas" tabindex="0"></canvas></main>
    <div id="creator-root"></div>
    <script>const engine = new Engine({}); engine.startGame();</script>
  `), /mandatory routed access/i);
  assert.doesNotMatch(shell, /continue (?:locally|without an account)|bypass/i);
});

test("studio injection edits actual tags without rewriting script strings", () => {
  const sentinel = '<script>const sample = \'<script src="./studio/studio.js"></script>\';</script>';
  const assembled = injectStudioAssets(
    `<!doctype html><html><head></head><body>${sentinel}<script src="./index.js"></script></body></html>`
  );
  assert.ok(assembled.includes(sentinel));
  assert.equal(assembled.match(/<script src="\.\/studio\/studio\.js"><\/script>/g)?.length, 2);
});

test("assembly writes a deterministic CSP hash for the exact inline bootstrap body", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-csp-headers-"));
  const { web } = await writeExportScaffold(root);

  await assembleWebExport({ root, log: () => {} });
  assert.equal(
    await readFile(path.join(web, "_headers"), "utf8"),
    expectedCspHeaders("window.bootstrap = true;")
  );

  await writeFile(
    path.join(web, "index.html"),
    '<html><head></head><body><div id="creator-root"></div><script>window.bootstrap = false;</script><script src="./index.js"></script></body></html>'
  );
  await assembleWebExport({ root, log: () => {} });
  assert.equal(
    await readFile(path.join(web, "_headers"), "utf8"),
    expectedCspHeaders("window.bootstrap = false;")
  );
});

test("assembly hashes inline bootstrap text after HTML newline normalisation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-csp-newlines-"));
  const { web } = await writeExportScaffold(root);
  await writeFile(
    path.join(web, "index.html"),
    '<html><head></head><body><div id="creator-root"></div><script>first();\r\nsecond();\r\n</script><script src="./index.js"></script></body></html>'
  );

  await assembleWebExport({ root, log: () => {} });

  assert.equal(
    await readFile(path.join(web, "_headers"), "utf8"),
    expectedCspHeaders("first();\nsecond();\n")
  );
});

test("assembly carries Vite runtime-static backgrounds and fonts into the web export", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-runtime-static-"));
  const { web } = await writeExportScaffold(root);

  await assembleWebExport({ root, log: () => {} });

  assert.equal(
    await readFile(path.join(web, "catalog", "backgrounds", "fixture.svg"), "utf8"),
    "<svg/>"
  );
  assert.deepEqual(
    await readFile(path.join(web, "fonts", "Fixture-Regular.ttf")),
    Buffer.from([0, 1, 2])
  );
});

test("assembly fails closed when Vite runtime-static directories are absent", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-runtime-static-missing-"));
  await writeExportScaffold(
    root,
    '<div id="creator-root"></div>',
    { includeRuntimeStaticAssets: false }
  );

  await assert.rejects(
    () => assembleWebExport({ root, log: () => {} }),
    /runtime-static.*(?:backgrounds|fonts)|(?:backgrounds|fonts).*runtime-static/i
  );
});

test("release assembly binds static assets, private functions and one atomic service worker", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-release-"));
  const { web, studio } = await writeExportScaffold(root);
  await mkdir(path.join(web, "catalog"), { recursive: true });
  await writeFile(path.join(web, "catalog", "fixture.png"), Buffer.from([1, 2, 3]));
  await writeFile(path.join(web, "index.audio.worklet.js"), "class AudioWorkletProcessor {}\n");
  await writeFunctionArtifactFixture(root);

  await assembleWebExport({ root, bindRelease: true, log: () => {} });

  const html = await readFile(path.join(web, "index.html"), "utf8");
  assert.equal(html.match(/rel="manifest"/g)?.length, 1);
  assert.match(html, /href="\.\/manifest\.webmanifest"/);
  assert.match(html, /crossorigin="use-credentials"/);
  assert.equal(
    await readFile(path.join(web, "_redirects"), "utf8"),
    [
      "/                 /student             302!",
      "/student          /index.html          200",
      "/student/*        /index.html          200",
      "/teacher          /index.html          200",
      "/teacher/*        /index.html          200",
      ""
    ].join("\n")
  );
  const webManifest = JSON.parse(
    await readFile(path.join(web, "manifest.webmanifest"), "utf8")
  );
  assert.equal(webManifest.start_url, "/student");
  const assetManifest = JSON.parse(await readFile(path.join(web, "asset-manifest.json"), "utf8"));
  assert.equal(assetManifest.schema, "ad-market-asset-manifest@1");
  assert.match(assetManifest.cacheVersion, /^[a-f0-9]{24}$/);
  assert.notEqual(
    assetManifest.cacheVersion,
    createHash("sha256")
      .update(JSON.stringify(assetManifest.assets))
      .digest("hex")
      .slice(0, 24),
    "the worker-policy revision must change the legacy asset-only cache identity"
  );
  assert.ok(assetManifest.assets.some(({ path: relative }) => relative === "index.pck"));
  assert.ok(assetManifest.core.includes("/index.html"));

  const worker = await readFile(path.join(web, "service-worker.js"), "utf8");
  assert.ok(Buffer.byteLength(worker) < 64 * 1024, "service worker must stay lightweight");
  assert.match(worker, new RegExp(`ad-market-${assetManifest.cacheVersion}`));
  assert.match(worker, /pathname\.startsWith\("\/catalog\/"\)/);
  assert.doesNotMatch(worker, /\/catalog\/fixture\.png/);
  assert.match(worker, /request\.method !== "GET"/);
  assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(worker, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(worker, /requestedVersion !== expectedVersion/);
  assert.match(worker, /return fetch\(request, \{ cache: "no-cache" \}\);/);
  assert.match(worker, /for \(const pathname of CORE\)/);
  assert.match(worker, /fetch\(pathname, \{ cache: "no-cache" \}\)/);
  assert.doesNotMatch(worker, /Promise\.all\(CORE\.map/);
  assert.doesNotMatch(worker, /cache: "reload"/);
  assert.match(worker, /await caches\.delete\(CACHE_NAME\)/);
  assert.match(worker, /await self\.skipWaiting\(\)/);
  assert.ok(
    worker.indexOf("await self.skipWaiting()") >
      worker.indexOf("await cache.put(pathname, response)"),
    "the replacement worker must not activate until every core asset is cached"
  );
  assert.doesNotMatch(worker, /self\.clients\.claim\(\)/);
  assert.doesNotMatch(worker, /client\.navigate\(/);
  const updated = await activateGeneratedWorker(worker, [
    `ad-market-${assetManifest.cacheVersion}`,
    "ad-market-previous-release"
  ]);
  assert.deepEqual(updated.matchOptions, []);
  assert.deepEqual(updated.claimed, []);
  assert.deepEqual(updated.navigated, []);
  assert.deepEqual(updated.deleted, ["ad-market-previous-release"]);

  const firstInstall = await activateGeneratedWorker(worker, [
    `ad-market-${assetManifest.cacheVersion}`
  ]);
  assert.deepEqual(firstInstall.matchOptions, []);
  assert.deepEqual(firstInstall.claimed, []);
  assert.deepEqual(firstInstall.navigated, []);
  assert.deepEqual(firstInstall.deleted, []);
  const navigationHandler = worker.slice(
    worker.indexOf('if (request.mode === "navigate")'),
    worker.indexOf('if (!isReleaseAsset(url.pathname))')
  );
  assert.match(navigationHandler, /return await fetch\(request\);/);
  assert.match(navigationHandler, /catch \{/);
  assert.match(
    navigationHandler,
    /return await cache\.match\("\/index\.html"\) \?\? Response\.error\(\);/
  );
  assert.ok(
    navigationHandler.indexOf("fetch(request)") < navigationHandler.indexOf('cache.match("/index.html")'),
    "online navigation must reach the host before the offline shell is considered"
  );
  assert.doesNotMatch(
    navigationHandler,
    /return await cache\.match\("\/index\.html"\) \?\? fetch\(request\);/
  );
  assert.doesNotMatch(worker, /\.release\/functions/);

  const headers = await readFile(path.join(web, "_headers"), "utf8");
  assert.match(headers, /\/service-worker\.js[\s\S]*Cache-Control: no-cache, no-store, must-revalidate/);
  assert.match(headers, /\/release-manifest\.json[\s\S]*Cache-Control: no-cache, no-store, must-revalidate/);

  const release = JSON.parse(await readFile(path.join(web, "release-manifest.json"), "utf8"));
  assert.equal(release.schema, "ad-market-release@1");
  assert.match(release.releaseId, /^[a-f0-9]{32}$/);
  assert.ok(release.static.files.some(({ path: relative }) => relative === "service-worker.js"));
  assert.ok(release.static.files.some(({ path: relative }) => relative === "_redirects"));
  assert.deepEqual(release.functions.files.map(({ path: relative }) => relative), [
    "deploy-functions/example.mts",
    "function-bundles/example.mjs",
    "function-manifest.json"
  ]);
  assert.equal(
    await readFile(path.join(web, ".release", "functions", "deploy-functions", "example.mts"), "utf8"),
    'export { default } from "../function-bundles/example.mjs";\n'
  );
  await assert.doesNotReject(() => verifyWebExport.verifyReleaseArtifact(web));

  const before = assetManifest.cacheVersion;
  await writeFile(path.join(studio, "studio.css"), ".creator{color:#123456}");
  await assembleWebExport({ root, bindRelease: true, log: () => {} });
  const after = JSON.parse(await readFile(path.join(web, "asset-manifest.json"), "utf8"))
    .cacheVersion;
  assert.notEqual(after, before);
});

test("bound releases give changed Studio assets new browser URLs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-studio-version-"));
  const { web, studio } = await writeExportScaffold(root);
  await writeFunctionArtifactFixture(root);

  await assembleWebExport({ root, bindRelease: true, log: () => {} });
  const first = await readFile(path.join(web, "index.html"), "utf8");
  assert.match(
    first,
    /<link rel="stylesheet" href="\.\/studio\/studio\.css\?v=b0cb96ff4232a4994a01694816da3f182974bb603a0f3afa3e15c8fd76dc4071">/
  );
  assert.match(
    first,
    /<script src="\.\/studio\/studio\.js\?v=ff5d6cd0bc0529a93a705b6594d1d2a0fcdba657e4914abbb3b46e8bc196b8b2"><\/script>/
  );

  await writeFile(path.join(studio, "studio.js"), "window.AdMarketCreator = { version: 2 };");
  await assembleWebExport({ root, bindRelease: true, log: () => {} });
  const second = await readFile(path.join(web, "index.html"), "utf8");
  assert.match(
    second,
    /<script src="\.\/studio\/studio\.js\?v=d28c8b9f6c6eb03e18c8c5c5a6c3ab7c71e781848ed7354bab92f8b0626570e8"><\/script>/
  );
  assert.doesNotMatch(second, /studio\.js\?v=ff5d6cd0/);
});

test("application route verification rejects teacher API shell rewrites", () => {
  const valid = new Map([
    ["_redirects", [
      "/                 /student             302!",
      "/student          /index.html          200",
      "/student/*        /index.html          200",
      "/teacher          /index.html          200",
      "/teacher/*        /index.html          200",
      ""
    ].join("\n")],
    ["manifest.webmanifest", JSON.stringify({
      name: "Advertising Market Game",
      start_url: "/student",
      scope: "/"
    })],
    ["service-worker.js", `
      if (request.method !== "GET" ||
        url.origin !== self.location.origin ||
        url.pathname.startsWith("/api/")) return;
      if (request.mode === "navigate") {
        return await cache.match("/index.html") ?? fetch(request);
      }
    `]
  ]);

  assert.doesNotThrow(() => verifyWebExport.verifyApplicationRouteContract(valid));

  const unsafe = new Map(valid);
  unsafe.set(
    "_redirects",
    `${valid.get("_redirects")}/api/teacher/* /index.html 200\n`
  );
  assert.throws(
    () => verifyWebExport.verifyApplicationRouteContract(unsafe),
    /teacher API|API route/i
  );
});

test("application route verification requires an unshadowable root redirect", () => {
  const forced = new Map([
    ["_redirects", [
      "/                 /student             302!",
      "/student          /index.html          200",
      "/student/*        /index.html          200",
      "/teacher          /index.html          200",
      "/teacher/*        /index.html          200",
      ""
    ].join("\n")],
    ["manifest.webmanifest", JSON.stringify({
      name: "Advertising Market Game",
      start_url: "/student",
      scope: "/"
    })],
    ["service-worker.js", `
      if (request.method !== "GET" ||
        url.origin !== self.location.origin ||
        url.pathname.startsWith("/api/")) return;
      if (request.mode === "navigate") {
        return await cache.match("/index.html") ?? fetch(request);
      }
    `]
  ]);

  assert.doesNotThrow(() => verifyWebExport.verifyApplicationRouteContract(forced));

  const shadowable = new Map(forced);
  shadowable.set("_redirects", forced.get("_redirects").replace("302!", "302"));
  assert.throws(
    () => verifyWebExport.verifyApplicationRouteContract(shadowable),
    /route verification|release contract/i
  );
});

test("assembly rejects zero or multiple executable inline bootstrap scripts", async () => {
  for (const [name, html] of [
    ["zero", '<html><head></head><body><div id="creator-root"></div><script type="application/json">{}</script><script src="./index.js"></script></body></html>'],
    ["multiple", '<html><head></head><body><div id="creator-root"></div><script>one();</script><script>two();</script><script src="./index.js"></script></body></html>']
  ]) {
    const root = await mkdtemp(path.join(tmpdir(), `admarket-csp-${name}-`));
    const { web } = await writeExportScaffold(root);
    await writeFile(path.join(web, "index.html"), html);
    await assert.rejects(
      () => assembleWebExport({ root, log: () => {} }),
      /exactly one executable inline bootstrap script/i
    );
  }
});

test("static verification requires a matching strict Netlify CSP header", () => {
  const files = addCspHeaders(new Map([
    ["index.html", '<link rel="stylesheet" href="./studio/studio.css"><script src="./studio/studio.js"></script><script>bootstrap();</script><script src="./index.js"></script>'],
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", VALID_STUDIO_BRIDGES],
    ["godot/export_presets.cfg", "variant/thread_support=false"]
  ]));
  assert.doesNotThrow(() => inspectExportContents({ files, pckHash: "current" }));

  const missing = new Map(files);
  missing.delete("_headers");
  assert.throws(
    () => inspectExportContents({ files: missing, pckHash: "current" }),
    /missing required export file: _headers/i
  );

  const mismatch = new Map(files);
  mismatch.set("_headers", expectedCspHeaders("changed();"));
  assert.throws(
    () => inspectExportContents({ files: mismatch, pckHash: "current" }),
    /CSP hash does not match/i
  );

  const unsafe = new Map(files);
  unsafe.set("_headers", expectedCspHeaders("bootstrap();").replace("'wasm-unsafe-eval'", "'wasm-unsafe-eval' 'unsafe-inline'"));
  assert.throws(
    () => inspectExportContents({ files: unsafe, pckHash: "current" }),
    /unsafe inline script policy/i
  );
});

test("static verification applies HTML newline normalisation to CSP hashes", () => {
  const files = new Map([
    ["index.html", '<link rel="stylesheet" href="./studio/studio.css"><script src="./studio/studio.js"></script><script>first();\r\nsecond();\r\n</script><script src="./index.js"></script>'],
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", VALID_STUDIO_BRIDGES],
    ["godot/export_presets.cfg", "variant/thread_support=false"],
    ["_headers", expectedCspHeaders("first();\nsecond();\n")]
  ]);

  assert.doesNotThrow(() => inspectExportContents({ files, pckHash: "current" }));
});

test("static verification accepts Studio URLs versioned by their exact content hashes", () => {
  const files = addCspHeaders(new Map([
    ["index.html", '<link rel="stylesheet" href="./studio/studio.css?v=b0cb96ff4232a4994a01694816da3f182974bb603a0f3afa3e15c8fd76dc4071"><script src="./studio/studio.js?v=dec8539975ce6c8785f083bd7a6893d5b4952c3d1266b225e1bb75eaaa722249"></script><script>bootstrap();</script><script src="./index.js"></script>'],
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", VALID_STUDIO_BRIDGES],
    ["godot/export_presets.cfg", "variant/thread_support=false"]
  ]));

  assert.doesNotThrow(() => inspectExportContents({ files, pckHash: "current" }));
});

test("static verification rejects nested-route and student-gate regressions", () => {
  const routedHtml = `<!doctype html><html><head>
    <base href="/">
    <link rel="stylesheet" href="./studio/studio.css">
  </head><body>
    <div id="account-gate-root"></div>
    <section id="account-session-root"></section>
    <main aria-label="Advertising Market Game" hidden inert aria-hidden="true">
      <canvas id="canvas" tabindex="-1"></canvas>
    </main>
    <script src="./studio/studio.js"></script>
    <script src="./index.js"></script>
    <script>const engine = new Engine({}); window.AdMarketGameAccess.requireAccess().then(() => engine.startGame());</script>
  </body></html>`;
  const fixture = (html) => addCspHeaders(new Map([
    ["index.html", html],
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", VALID_STUDIO_BRIDGES],
    ["godot/export_presets.cfg", "variant/thread_support=false"]
  ]));

  assert.doesNotThrow(() => inspectExportContents({
    files: fixture(routedHtml),
    pckHash: "current"
  }));
  assert.throws(() => inspectExportContents({
    files: fixture(routedHtml.replace('<base href="/">', "")),
    pckHash: "current"
  }), /root route base/i);
  assert.throws(() => inspectExportContents({
    files: fixture(routedHtml.replace(
      '    <base href="/">\n    <link rel="stylesheet" href="./studio/studio.css">',
      '    <link rel="stylesheet" href="./studio/studio.css">\n    <base href="/">'
    )),
    pckHash: "current"
  }), /root route base.*precede/i);
  assert.throws(() => inspectExportContents({
    files: fixture(routedHtml.replace("AdMarketGameAccess", "AdMarketAccount")),
    pckHash: "current"
  }), /route-neutral game access/i);
});

test("static verification rejects a studio bridge loaded after Godot", () => {
  const files = new Map([
    ["index.html", '<link rel="stylesheet" href="./studio/studio.css"><script src="index.js"></script><script src="./studio/studio.js"></script>'],
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", VALID_STUDIO_BRIDGES],
    ["godot/export_presets.cfg", "variant/thread_support=false"]
  ]);
  assert.throws(
    () => inspectExportContents({ files, pckHash: "current" }),
    /studio bridge must load before Godot/i
  );
});

test("static verification requires one synchronous practice bridge", () => {
  const valid = new Map([
    ["index.html", '<link rel="stylesheet" href="./studio/studio.css"><script src="./studio/studio.js"></script><script src="index.js"></script>'],
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", VALID_STUDIO_BRIDGES],
    ["godot/export_presets.cfg", "variant/thread_support=false"]
  ]);
  addInlineBootstrapAndCspHeaders(valid);
  assert.doesNotThrow(() => inspectExportContents({ files: valid, pckHash: "current" }));

  const routed = new Map(valid);
  routed.set(
    "studio/studio.js",
    `function bootStudent(pathname) {
      if (pathname !== "/student") return;
      window.AdMarketCreator = Object.freeze({ handle() {} });
      window.AdMarketPractice = Object.freeze({ handle() {} });
    }
    bootStudent(window.location.pathname);`
  );
  assert.doesNotThrow(
    () => inspectExportContents({ files: routed, pckHash: "current" }),
    "the routed student bundle must install both bridges during its synchronous route dispatch"
  );

  const missing = new Map(valid);
  missing.set("studio/studio.js", "window.AdMarketCreator = publicApi;");
  assert.throws(
    () => inspectExportContents({ files: missing, pckHash: "current" }),
    /AdMarketPractice global exactly once/i
  );

  const duplicate = new Map(valid);
  duplicate.set(
    "studio/studio.js",
    `${VALID_STUDIO_BRIDGES} globalThis.AdMarketPractice = duplicate;`
  );
  assert.throws(
    () => inspectExportContents({ files: duplicate, pckHash: "current" }),
    /AdMarketPractice global exactly once/i
  );

  const commentOnly = new Map(valid);
  commentOnly.set(
    "studio/studio.js",
    "window.AdMarketCreator = publicApi; // window.AdMarketPractice = practiceApi;"
  );
  assert.throws(
    () => inspectExportContents({ files: commentOnly, pckHash: "current" }),
    /AdMarketPractice global exactly once/i
  );

  for (const delayedSource of [
    "Promise.resolve().then(() => { window.AdMarketPractice = practiceApi; });",
    "setTimeout(() => { window.AdMarketPractice = practiceApi; }, 0);"
  ]) {
    const delayedAssignment = new Map(valid);
    delayedAssignment.set(
      "studio/studio.js",
      `window.AdMarketCreator = publicApi; ${delayedSource}`
    );
    assert.throws(
      () => inspectExportContents({ files: delayedAssignment, pckHash: "current" }),
      /install usable production bridge globals synchronously/i
    );
  }

  const synchronousIife = new Map(valid);
  synchronousIife.set(
    "studio/studio.js",
    "(() => { window.AdMarketCreator = Object.freeze({ handle() {} }); window.AdMarketPractice = Object.freeze({ handle() {} }); })();"
  );
  assert.doesNotThrow(() => inspectExportContents({ files: synchronousIife, pckHash: "current" }));

  const requiresLockedGameSurface = new Map(valid);
  requiresLockedGameSurface.set(
    "studio/studio.js",
    `if (!document.querySelector('main[aria-label="Advertising Market Game"]') || !document.querySelector('#canvas')) {
      throw new Error('Missing locked game surface for account access');
    }
    ${VALID_STUDIO_BRIDGES}`
  );
  assert.doesNotThrow(() => inspectExportContents({
    files: requiresLockedGameSurface,
    pckHash: "current"
  }));

  for (const source of [
    "const window = {}; window.AdMarketCreator = Object.freeze({ handle() {} }); window.AdMarketPractice = Object.freeze({ handle() {} });",
    "throw new Error('stop'); window.AdMarketCreator = Object.freeze({ handle() {} }); window.AdMarketPractice = Object.freeze({ handle() {} });",
    "const task = (function* () { window.AdMarketCreator = Object.freeze({ handle() {} }); window.AdMarketPractice = Object.freeze({ handle() {} }); })(); Promise.resolve().then(() => task.next());",
    `${VALID_STUDIO_BRIDGES} delete window.AdMarketCreator; delete window.AdMarketPractice;`
  ]) {
    const doesNotInstall = new Map(valid);
    doesNotInstall.set("studio/studio.js", source);
    assert.throws(
      () => inspectExportContents({ files: doesNotInstall, pckHash: "current" }),
      /install usable production bridge globals synchronously/i
    );
  }

  for (const studioTag of [
    '<script async src="./studio/studio.js"></script>',
    '<script defer src="./studio/studio.js"></script>',
    '<script type="module" src="./studio/studio.js"></script>',
    '<script nomodule src="./studio/studio.js"></script>',
    '<script type="application/json" src="./studio/studio.js"></script>',
    '<template><script src="./studio/studio.js"></script></template>'
  ]) {
    const delayed = new Map(valid);
    delayed.set(
      "index.html",
      `<link rel="stylesheet" href="./studio/studio.css">${studioTag}<script src="index.js"></script>`
    );
    assert.throws(
      () => inspectExportContents({ files: delayed, pckHash: "current" }),
      /one executable classic synchronous studio script/i
    );
  }

  const whitespaceDuplicate = new Map(valid);
  whitespaceDuplicate.set(
    "index.html",
    '<link rel="stylesheet" href="./studio/studio.css"><script src = "./studio/studio.js"></script><script src="index.js"></script><script src="./studio/studio.js"></script>'
  );
  assert.throws(
    () => inspectExportContents({ files: whitespaceDuplicate, pckHash: "current" }),
    /one executable classic synchronous studio script/i
  );

  for (const duplicate of [
    '<script src="./studio/studio&#46;js"></script>',
    '<noscript><script src="./studio/studio.js"></script></noscript>'
  ]) {
    const disguisedStudio = new Map(valid);
    disguisedStudio.set(
      "index.html",
      `<link rel="stylesheet" href="./studio/studio.css"><script src="./studio/studio.js"></script>${duplicate}<script src="index.js"></script>`
    );
    assert.throws(
      () => inspectExportContents({ files: disguisedStudio, pckHash: "current" }),
      /one executable classic synchronous studio script/i
    );
  }

  const disguisedGodot = new Map(valid);
  disguisedGodot.set(
    "index.html",
    '<link rel="stylesheet" href="./studio/studio.css"><script src="./studio/studio.js"></script><script src="index.js"></script><script src="&#105;ndex.js"></script>'
  );
  assert.throws(
    () => inspectExportContents({ files: disguisedGodot, pckHash: "current" }),
    /local Godot index\.js runtime/i
  );

  for (const [label, html, pattern] of [
    [
      "missing Studio",
      '<link rel="stylesheet" href="./studio/studio.css"><script src="index.js"></script>',
      /one executable classic synchronous studio script/i
    ],
    [
      "missing Godot runtime",
      '<link rel="stylesheet" href="./studio/studio.css"><script src="./studio/studio.js"></script>',
      /local Godot index\.js runtime/i
    ]
  ]) {
    const missingScript = new Map(valid);
    missingScript.set("index.html", html);
    assert.throws(
      () => inspectExportContents({ files: missingScript, pckHash: "current" }),
      pattern,
      label
    );
  }
});

test("production bridge smoke keeps background startup pending without touching a closed DOM", () => {
  const files = new Map([
    ["index.html", '<link rel="stylesheet" href="./studio/studio.css"><script src="./studio/studio.js"></script><script src="index.js"></script>'],
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", `${VALID_STUDIO_BRIDGES}
      void (async () => {
        const signal = AbortSignal.timeout(1);
        await fetch('/never.json', { signal });
      })().catch(() => document.createElement('option'));
    `],
    ["godot/export_presets.cfg", "variant/thread_support=false"]
  ]);
  addInlineBootstrapAndCspHeaders(files);

  assert.doesNotThrow(() => inspectExportContents({ files, pckHash: "current" }));
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

test("product shell catalogue metadata is optional, local, and idempotent", () => {
  const exported = '<div id="creator-root" hidden></div>';
  assert.equal(injectProductShellCatalogueUrl(exported), exported);

  const once = injectProductShellCatalogueUrl(
    exported,
    "/catalog/generated/product-shells-v1-reviewed/catalog.json"
  );
  const twice = injectProductShellCatalogueUrl(
    once,
    "/catalog/generated/product-shells-v1-reviewed/catalog.json"
  );

  assert.equal(twice, once);
  assert.match(
    once,
    /data-product-shell-catalogue-url="\/catalog\/generated\/product-shells-v1-reviewed\/catalog\.json"/
  );
  assert.throws(
    () => injectProductShellCatalogueUrl(exported, "https://external.example/catalog.json"),
    /local catalogue URL/i
  );
});

test("product builder catalogue metadata is local, singular, idempotent, and coexists with product shells", () => {
  const exported = '<div id="creator-root" data-product-builder-catalogue-url="/stale/catalogue.json" hidden></div>';
  const withShells = injectProductShellCatalogueUrl(
    exported,
    "/catalog/generated/product-shells-v1-reviewed/catalog.json"
  );
  const once = buildWeb.injectProductBuilderCatalogueUrl(
    withShells,
    "/catalog/generated/product-builder-pilot-v1/catalogue.json"
  );
  const twice = buildWeb.injectProductBuilderCatalogueUrl(
    once,
    "/catalog/generated/product-builder-pilot-v1/catalogue.json"
  );

  assert.equal(twice, once);
  assert.equal(once.match(/data-product-builder-catalogue-url=/g)?.length, 1);
  assert.match(
    once,
    /data-product-builder-catalogue-url="\/catalog\/generated\/product-builder-pilot-v1\/catalogue\.json"/
  );
  assert.match(once, /data-product-shell-catalogue-url=/);
  assert.doesNotMatch(once, /\/stale\/catalogue\.json/);
  assert.throws(
    () => buildWeb.injectProductBuilderCatalogueUrl(exported, "https://external.example/catalogue.json"),
    /local catalogue URL/i
  );
  assert.equal(
    buildWeb.injectProductBuilderCatalogueUrl('<div id="creator-root" hidden></div>'),
    '<div id="creator-root" hidden></div>'
  );
});

test("logo icon catalogue metadata is local, singular, and idempotent", () => {
  const exported = '<div id="creator-root" data-logo-icon-catalogue-url="/stale/catalog.json" hidden></div>';
  const canonical = "/catalog/generated/logo-icons-v1-reviewed/catalog.json";
  const once = buildWeb.injectLogoIconCatalogueUrl(exported, canonical);
  const twice = buildWeb.injectLogoIconCatalogueUrl(once, canonical);

  assert.equal(twice, once);
  assert.equal(once.match(/data-logo-icon-catalogue-url=/g)?.length, 1);
  assert.match(once, /data-logo-icon-catalogue-url="\/catalog\/generated\/logo-icons-v1-reviewed\/catalog\.json"/);
  assert.doesNotMatch(once, /\/stale\/catalog\.json/);
  assert.throws(
    () => buildWeb.injectLogoIconCatalogueUrl(exported, "https://external.example/catalog.json"),
    /local catalogue URL/i
  );
  assert.equal(
    buildWeb.injectLogoIconCatalogueUrl('<div id="creator-root" hidden></div>'),
    '<div id="creator-root" hidden></div>'
  );
  const normalisedMalformed = buildWeb.injectLogoIconCatalogueUrl(
    '<div id="creator-root" data-logo-icon-catalogue-url hidden></div>',
    canonical
  );
  assert.equal(normalisedMalformed.match(/data-logo-icon-catalogue-url\b/g)?.length, 1);
  assert.match(normalisedMalformed, /data-logo-icon-catalogue-url="\/catalog\/generated\/logo-icons-v1-reviewed\/catalog\.json"/);
});

test("logo icon directory verification accepts the complete pinned 4205-icon pack", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-logo-icons-valid-"));
  const directory = await writeLogoIconPack(root);

  await assert.doesNotReject(() => verifyWebExport.verifyLogoIconDirectory(directory));
});

test("logo icon directory verification rejects count, identity, metadata, and SVG drift", async () => {
  const countRoot = await mkdtemp(path.join(tmpdir(), "admarket-logo-icons-count-"));
  await assert.rejects(
    () => writeLogoIconPack(countRoot, { count: 4204 })
      .then((directory) => verifyWebExport.verifyLogoIconDirectory(directory)),
    /exactly 4205 icons/i
  );

  const duplicateRoot = await mkdtemp(path.join(tmpdir(), "admarket-logo-icons-duplicate-"));
  await assert.rejects(
    () => writeLogoIconPack(duplicateRoot, {
      mutateCatalogue: (catalogue) => { catalogue.icons[1].id = catalogue.icons[0].id; }
    }).then((directory) => verifyWebExport.verifyLogoIconDirectory(directory)),
    /invalid or duplicate icon id/i
  );

  const longIdRoot = await mkdtemp(path.join(tmpdir(), "admarket-logo-icons-long-id-"));
  await assert.rejects(
    () => writeLogoIconPack(longIdRoot, {
      mutateCatalogue: (catalogue) => { catalogue.icons[0].id = "a".repeat(101); }
    }).then((directory) => verifyWebExport.verifyLogoIconDirectory(directory)),
    /invalid or duplicate icon id/i
  );

  const metadataRoot = await mkdtemp(path.join(tmpdir(), "admarket-logo-icons-metadata-"));
  await assert.rejects(
    () => writeLogoIconPack(metadataRoot, {
      mutateCatalogue: (catalogue) => { catalogue.source.sourceVersion = "next"; }
    }).then((directory) => verifyWebExport.verifyLogoIconDirectory(directory)),
    /pinned source metadata/i
  );

  const unsafeRoot = await mkdtemp(path.join(tmpdir(), "admarket-logo-icons-unsafe-"));
  await assert.rejects(
    () => writeLogoIconPack(unsafeRoot, {
      mutateCatalogue: (catalogue) => {
        catalogue.icons[0].body = '<image href="https://example.invalid/pixel.png"/>';
      }
    }).then((directory) => verifyWebExport.verifyLogoIconDirectory(directory)),
    /unsafe or non-colourable SVG body/i
  );

  const unquotedHrefRoot = await mkdtemp(path.join(tmpdir(), "admarket-logo-icons-unquoted-href-"));
  await assert.rejects(
    () => writeLogoIconPack(unquotedHrefRoot, {
      mutateCatalogue: (catalogue) => {
        catalogue.icons[0].body =
          '<g stroke="currentColor"><path d="M0 0h4"/><use href=//example.invalid/a.svg#mark /></g>';
      }
    }).then((directory) => verifyWebExport.verifyLogoIconDirectory(directory)),
    /unsafe or non-colourable SVG body/i
  );

  const unusedColourRoot = await mkdtemp(path.join(tmpdir(), "admarket-logo-icons-unused-colour-"));
  await assert.rejects(
    () => writeLogoIconPack(unusedColourRoot, {
      mutateCatalogue: (catalogue) => {
        catalogue.icons[0].body = '<path id="currentColor" d="M0 0h4"/>';
      }
    }).then((directory) => verifyWebExport.verifyLogoIconDirectory(directory)),
    /unsafe or non-colourable SVG body/i
  );

  const brandRoot = await mkdtemp(path.join(tmpdir(), "admarket-logo-icons-brand-"));
  await assert.rejects(
    () => writeLogoIconPack(brandRoot, {
      mutateCatalogue: (catalogue) => { catalogue.icons[0].id = "brand-example"; }
    }).then((directory) => verifyWebExport.verifyLogoIconDirectory(directory)),
    /brand icon/i
  );
});

test("logo icon directory verification rejects a catalogue over three MiB before parsing", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-logo-icons-large-"));
  const directory = await writeLogoIconPack(root, {
    rawCatalogue: Buffer.alloc(3 * 1024 * 1024 + 1, 0x20)
  });

  await assert.rejects(
    () => verifyWebExport.verifyLogoIconDirectory(directory),
    /catalogue exceeds 3 MiB/i
  );
});

test("assembly verifies, copies, and injects the local logo pack without pruning", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-logo-icons-copy-"));
  const { web } = await writeExportScaffold(root);
  await writeLogoIconPack(root);
  const destination = path.join(web, "catalog", "generated", "logo-icons-v1-reviewed");
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, "destination-sentinel.txt"), "preserve me");
  const logs = [];

  await assembleWebExport({
    root,
    requireLogoIcons: true,
    log: (message) => logs.push(message)
  });

  const html = await readFile(path.join(web, "index.html"), "utf8");
  assert.equal(html.match(/data-logo-icon-catalogue-url=/g)?.length, 1);
  assert.match(html, /data-logo-icon-catalogue-url="\/catalog\/generated\/logo-icons-v1-reviewed\/catalog\.json"/);
  assert.equal(
    JSON.parse(await readFile(path.join(destination, "catalog.json"), "utf8")).icons.length,
    4205
  );
  assert.equal(await readFile(path.join(destination, "destination-sentinel.txt"), "utf8"), "preserve me");
  assert.deepEqual(
    logs.filter((message) => message.startsWith("LOGO_ICONS_")),
    ["LOGO_ICONS_COPIED catalog/generated/logo-icons-v1-reviewed"]
  );
});

test("assembly fails closed when required logo icons are absent", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-logo-icons-required-"));
  await writeExportScaffold(root);

  await assert.rejects(
    () => assembleWebExport({ root, requireLogoIcons: true, log: () => {} }),
    /required logo icon catalogue is absent:.*catalog\.json/i
  );
});

test("optional logo icon absence removes stale metadata and logs separately", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-logo-icons-deferred-"));
  const { web } = await writeExportScaffold(
    root,
    '<div id="creator-root" data-logo-icon-catalogue-url="/stale/catalog.json"></div>'
  );
  const logs = [];

  await assembleWebExport({ root, log: (message) => logs.push(message) });

  assert.doesNotMatch(await readFile(path.join(web, "index.html"), "utf8"), /data-logo-icon-catalogue-url/);
  assert.deepEqual(
    logs.filter((message) => message.startsWith("LOGO_ICONS_")),
    ["LOGO_ICONS_DEFERRED catalog/generated/logo-icons-v1-reviewed/catalog.json"]
  );
});

test("product builder directory verification accepts the complete canonical pilot pack", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-builder-valid-"));
  const directory = await writeProductBuilderPack(root);

  await assert.doesNotReject(() => verifyWebExport.verifyProductBuilderDirectory(directory));
});

test("product builder QA ignores unrelated non-pruned destination files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-builder-sentinel-"));
  const directory = await writeProductBuilderPack(root);
  await writeFile(path.join(directory, "destination-sentinel.txt"), "preserve me");

  await assert.doesNotReject(() => verifyWebExport.verifyProductBuilderDirectory(directory));
});

test("product builder directory verification rejects unsafe catalogue paths", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-builder-unsafe-"));
  const directory = await writeProductBuilderPack(root, {
    mutateCatalogue: (catalogue) => {
      catalogue.bodies[0].authoringSvg = "../escape.svg";
    }
  });

  await assert.rejects(
    () => verifyWebExport.verifyProductBuilderDirectory(directory),
    /noncanonical authoringSvg/i
  );
});

test("product builder directory verification rejects missing referenced SVGs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-builder-missing-"));
  const omitted = "bodies/bags-body-1/preview.svg";
  const directory = await writeProductBuilderPack(root, { omitRelative: omitted });

  await assert.rejects(
    () => verifyWebExport.verifyProductBuilderDirectory(directory),
    /product builder catalogue references missing file/i
  );
});

test("product builder directory verification rejects duplicate IDs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-builder-duplicate-"));
  const directory = await writeProductBuilderPack(root, {
    mutateCatalogue: (catalogue) => {
      catalogue.bodies[1].id = catalogue.bodies[0].id;
    }
  });

  await assert.rejects(
    () => verifyWebExport.verifyProductBuilderDirectory(directory),
    /invalid or duplicate body id/i
  );
});

test("product builder directory verification rejects incompatible part graphs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-builder-incompatible-"));
  const directory = await writeProductBuilderPack(root, {
    mutateCatalogue: (catalogue) => {
      catalogue.bodies[0].compatiblePartIds[0] = catalogue.parts[4].id;
    }
  });

  await assert.rejects(
    () => verifyWebExport.verifyProductBuilderDirectory(directory),
    /incompatible part graph/i
  );
});

test("product builder directory verification rejects fixed-count drift", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-builder-count-"));
  const directory = await writeProductBuilderPack(root, {
    mutateCatalogue: (catalogue) => {
      catalogue.palettes.pop();
    }
  });

  await assert.rejects(
    () => verifyWebExport.verifyProductBuilderDirectory(directory),
    /exactly 16 palettes/i
  );
});

test("product builder directory verification rejects QA hash drift and self hashes", async () => {
  const badHashRoot = await mkdtemp(path.join(tmpdir(), "admarket-builder-hash-"));
  const badHashDirectory = await writeProductBuilderPack(badHashRoot, {
    mutateQa: (qa) => {
      qa.sha256["catalogue.json"] = "0".repeat(64);
    }
  });
  await assert.rejects(
    () => verifyWebExport.verifyProductBuilderDirectory(badHashDirectory),
    /product builder QA hash mismatch/i
  );

  const selfHashRoot = await mkdtemp(path.join(tmpdir(), "admarket-builder-self-hash-"));
  const selfHashDirectory = await writeProductBuilderPack(selfHashRoot, {
    mutateQa: (qa) => {
      qa.sha256["qa.json"] = "0".repeat(64);
      qa.fileCount += 1;
    }
  });
  await assert.rejects(
    () => verifyWebExport.verifyProductBuilderDirectory(selfHashDirectory),
    /must not hash qa\.json/i
  );
});

test("assembly verifies and recursively copies the product builder without pruning destination files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-builder-copy-"));
  const { web } = await writeExportScaffold(root);
  await writeProductBuilderPack(root);
  const destination = path.join(web, "catalog", "generated", "product-builder-pilot-v1");
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, "destination-sentinel.txt"), "preserve me");
  const logs = [];

  await assembleWebExport({
    root,
    requireProductBuilder: true,
    log: (message) => logs.push(message)
  });

  const html = await readFile(path.join(web, "index.html"), "utf8");
  assert.equal(html.match(/data-product-builder-catalogue-url=/g)?.length, 1);
  assert.match(
    html,
    /data-product-builder-catalogue-url="\/catalog\/generated\/product-builder-pilot-v1\/catalogue\.json"/
  );
  assert.match(
    await readFile(path.join(destination, "bodies", "bags-body-1", "authoring.svg"), "utf8"),
    /<svg/
  );
  assert.equal(await readFile(path.join(destination, "destination-sentinel.txt"), "utf8"), "preserve me");
  assert.deepEqual(
    logs.filter((message) => message.startsWith("PRODUCT_BUILDER_")),
    ["PRODUCT_BUILDER_COPIED catalog/generated/product-builder-pilot-v1"]
  );
});

test("assembly fails closed when the required product builder is absent", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-builder-required-"));
  await writeExportScaffold(root);

  await assert.rejects(
    () => assembleWebExport({ root, requireProductBuilder: true, log: () => {} }),
    /required product builder catalogue is absent:.*catalogue\.json/i
  );
});

test("optional product builder absence removes stale metadata and logs separately", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-builder-deferred-"));
  const { web } = await writeExportScaffold(
    root,
    '<div id="creator-root" data-product-builder-catalogue-url="/stale/catalogue.json"></div>'
  );
  const logs = [];

  await assembleWebExport({ root, log: (message) => logs.push(message) });

  assert.doesNotMatch(await readFile(path.join(web, "index.html"), "utf8"), /data-product-builder-catalogue-url/);
  assert.deepEqual(
    logs.filter((message) => message.startsWith("PRODUCT_BUILDER_")),
    ["PRODUCT_BUILDER_DEFERRED catalog/generated/product-builder-pilot-v1/catalogue.json"]
  );
});

test("static verification accepts both product packs and checks every builder reference", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-builder-static-"));
  const directory = await writeProductBuilderPack(root);
  await writeFile(path.join(directory, "destination-sentinel.txt"), "preserve me");
  const builderFiles = await verifyWebExport.verifyProductBuilderDirectory(directory);
  const shellPrefix = "catalog/generated/product-shells-v1-reviewed";
  const builderPrefix = "catalog/generated/product-builder-pilot-v1";
  const html = `<div id="creator-root"
    data-product-shell-catalogue-url="/${shellPrefix}/catalog.json"
    data-product-builder-catalogue-url="/${builderPrefix}/catalogue.json"></div>
    <link rel="stylesheet" href="./studio/studio.css">
    <script src="./studio/studio.js"></script><script src="./index.js"></script>`;
  const files = new Map([
    ["index.html", html],
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", VALID_STUDIO_BRIDGES],
    ["godot/export_presets.cfg", "variant/thread_support=false"],
    [`${shellPrefix}/shells/fixture-can/authoring.svg`, "<svg/>"] ,
    [`${shellPrefix}/shells/fixture-can/preview.svg`, "<svg/>"] ,
    [`${shellPrefix}/catalog.json`, JSON.stringify({
      schema: "product-shell-catalog@1",
      packId: "product-shells-v1",
      version: 1,
      families: [{ id: "drinks-snacks", title: "Drinks & Snacks" }],
      shells: [{
        id: "fixture-can",
        family: "drinks-snacks",
        title: "Fixture Can",
        authoringSvg: "shells/fixture-can/authoring.svg",
        previewSvg: "shells/fixture-can/preview.svg"
      }]
    })],
    ...builderFiles
  ]);
  addInlineBootstrapAndCspHeaders(files);

  assert.doesNotThrow(() => inspectExportContents({ files, pckHash: "current" }));

  const missing = new Map(files);
  missing.delete(`${builderPrefix}/bodies/bags-body-1/preview.svg`);
  assert.throws(
    () => inspectExportContents({ files: missing, pckHash: "current" }),
    /product builder catalogue references missing file/i
  );
});

test("static verification requires exactly one canonical builder attribute on creator-root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-builder-metadata-"));
  const directory = await writeProductBuilderPack(root);
  const builderFiles = await verifyWebExport.verifyProductBuilderDirectory(directory);
  const prefix = "catalog/generated/product-builder-pilot-v1";
  const base = new Map([
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", VALID_STUDIO_BRIDGES],
    ["godot/export_presets.cfg", "variant/thread_support=false"],
    ...builderFiles
  ]);
  const studioTags = '<link rel="stylesheet" href="./studio/studio.css"><script src="./studio/studio.js"></script><script src="./index.js"></script>';

  const absent = new Map(base);
  for (const name of [...absent.keys()]) {
    if (name.startsWith(`${prefix}/`)) absent.delete(name);
  }
  absent.set("index.html", `<div id="creator-root" data-product-builder-catalogue-url="/${prefix}/catalogue.json"></div>${studioTags}`);
  assert.throws(
    () => inspectExportContents({ files: absent, pckHash: "current" }),
    /references an absent product builder catalogue/i
  );

  const missingAttribute = new Map(base);
  missingAttribute.set("index.html", `<div id="creator-root"></div>${studioTags}`);
  assert.throws(
    () => inspectExportContents({ files: missingAttribute, pckHash: "current" }),
    /reference the product builder catalogue exactly once/i
  );

  const wrongElement = new Map(base);
  wrongElement.set(
    "index.html",
    `<div id="creator-root"></div><div data-product-builder-catalogue-url="/${prefix}/catalogue.json"></div>${studioTags}`
  );
  assert.throws(
    () => inspectExportContents({ files: wrongElement, pckHash: "current" }),
    /on #creator-root/i
  );

  const duplicate = new Map(base);
  duplicate.set(
    "index.html",
    `<div id="creator-root" data-product-builder-catalogue-url="/${prefix}/catalogue.json" data-product-builder-catalogue-url="/${prefix}/catalogue.json"></div>${studioTags}`
  );
  assert.throws(
    () => inspectExportContents({ files: duplicate, pckHash: "current" }),
    /exactly once/i
  );
});

test("static verification counts an unquoted builder attribute before a canonical quoted duplicate", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-builder-unquoted-duplicate-"));
  const directory = await writeProductBuilderPack(root);
  const builderFiles = await verifyWebExport.verifyProductBuilderDirectory(directory);
  const prefix = "catalog/generated/product-builder-pilot-v1";
  const files = new Map([
    ["index.html", `<div id="creator-root"
      data-product-builder-catalogue-url=/wrong/catalogue.json
      data-product-builder-catalogue-url="/${prefix}/catalogue.json"></div>
      <link rel="stylesheet" href="./studio/studio.css">
      <script src="./studio/studio.js"></script><script src="./index.js"></script>`],
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", VALID_STUDIO_BRIDGES],
    ["godot/export_presets.cfg", "variant/thread_support=false"],
    ...builderFiles
  ]);

  assert.throws(
    () => inspectExportContents({ files, pckHash: "current" }),
    /reference the product builder catalogue exactly once/i
  );
});

test("static verification requires one canonical local logo attribute on creator-root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-logo-icons-static-"));
  const directory = await writeLogoIconPack(root);
  const logoFiles = await verifyWebExport.verifyLogoIconDirectory(directory);
  const prefix = "catalog/generated/logo-icons-v1-reviewed";
  const studioTags = '<link rel="stylesheet" href="./studio/studio.css"><script src="./studio/studio.js"></script><script src="./index.js"></script>';
  const base = new Map([
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", VALID_STUDIO_BRIDGES],
    ["godot/export_presets.cfg", "variant/thread_support=false"],
    ...logoFiles
  ]);

  const valid = new Map(base);
  valid.set(
    "index.html",
    `<div id="creator-root" data-logo-icon-catalogue-url="/${prefix}/catalog.json"></div>${studioTags}`
  );
  addInlineBootstrapAndCspHeaders(valid);
  assert.doesNotThrow(() => inspectExportContents({ files: valid, pckHash: "current" }));

  const missingAttribute = new Map(base);
  missingAttribute.set("index.html", `<div id="creator-root"></div>${studioTags}`);
  assert.throws(
    () => inspectExportContents({ files: missingAttribute, pckHash: "current" }),
    /reference the logo icon catalogue exactly once/i
  );

  const wrongElement = new Map(base);
  wrongElement.set(
    "index.html",
    `<div id="creator-root"></div><div data-logo-icon-catalogue-url="/${prefix}/catalog.json"></div>${studioTags}`
  );
  assert.throws(
    () => inspectExportContents({ files: wrongElement, pckHash: "current" }),
    /logo icon catalogue metadata must be on #creator-root/i
  );

  const absentPack = new Map(base);
  for (const name of [...absentPack.keys()]) {
    if (name.startsWith(`${prefix}/`)) absentPack.delete(name);
  }
  absentPack.set(
    "index.html",
    `<div id="creator-root" data-logo-icon-catalogue-url="/${prefix}/catalog.json"></div>${studioTags}`
  );
  assert.throws(
    () => inspectExportContents({ files: absentPack, pckHash: "current" }),
    /references an absent logo icon catalogue/i
  );

  const valuelessDuplicate = new Map(base);
  valuelessDuplicate.set(
    "index.html",
    `<div id="creator-root" data-logo-icon-catalogue-url data-logo-icon-catalogue-url="/${prefix}/catalog.json"></div>${studioTags}`
  );
  assert.throws(
    () => inspectExportContents({ files: valuelessDuplicate, pckHash: "current" }),
    /reference the logo icon catalogue exactly once/i
  );

  const similarlyNamedAttribute = new Map(base);
  similarlyNamedAttribute.set(
    "index.html",
    `<div id="creator-root" data-logo-icon-catalogue-url-extra="keep" data-logo-icon-catalogue-url="/${prefix}/catalog.json"></div>${studioTags}`
  );
  addInlineBootstrapAndCspHeaders(similarlyNamedAttribute);
  assert.doesNotThrow(() => inspectExportContents({
    files: similarlyNamedAttribute,
    pckHash: "current"
  }));
});

test("logo metadata injection preserves similarly prefixed attributes", () => {
  const html = '<section data-logo-icon-catalogue-url="/wrong-element.json"></section><div id="creator-root" data-note="x > y data-logo-icon-catalogue-url=/not-an-attribute" data-logo-icon-catalogue-url-extra="keep" data-logo-icon-catalogue-url="/stale.json"></div>';
  const canonical = "/catalog/generated/logo-icons-v1-reviewed/catalog.json";

  const injected = buildWeb.injectLogoIconCatalogueUrl(html, canonical);

  assert.match(injected, /data-logo-icon-catalogue-url-extra="keep"/);
  assert.match(injected, /data-note="x > y data-logo-icon-catalogue-url=\/not-an-attribute"/);
  assert.equal(injected.match(/\sdata-logo-icon-catalogue-url="/g)?.length, 1);
  assert.doesNotMatch(injected, /wrong-element\.json/);
  assert.match(injected, new RegExp(`data-logo-icon-catalogue-url="${canonical}"`));
});

test("logo metadata injection leaves script text with longer closing-tag prefixes untouched", () => {
  const script = '<script>const template = \'</scriptx><div data-logo-icon-catalogue-url="sentinel">\';</script>';
  const html = `${script}<div id="creator-root"></div>`;
  const canonical = "/catalog/generated/logo-icons-v1-reviewed/catalog.json";

  const injected = buildWeb.injectLogoIconCatalogueUrl(html, canonical);

  assert.match(injected, /data-logo-icon-catalogue-url="sentinel"/);
  assert.match(injected, /<\/scriptx><div/);
  assert.match(injected, new RegExp(`data-logo-icon-catalogue-url="${canonical}"`));
});

test("static logo metadata inspection ignores exact tokens inside unrelated values", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-logo-icons-quoted-value-"));
  const directory = await writeLogoIconPack(root);
  const logoFiles = await verifyWebExport.verifyLogoIconDirectory(directory);
  const prefix = "catalog/generated/logo-icons-v1-reviewed";
  const files = new Map([
    ["index.html", `<div id="creator-root" data-note="data-logo-icon-catalogue-url=/not-an-attribute > still-a-value" data-logo-icon-catalogue-url="/${prefix}/catalog.json"></div><link rel="stylesheet" href="./studio/studio.css"><script src="./studio/studio.js"></script><script src="./index.js"></script>`],
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", VALID_STUDIO_BRIDGES],
    ["godot/export_presets.cfg", "variant/thread_support=false"],
    ...logoFiles
  ]);
  addInlineBootstrapAndCspHeaders(files);

  assert.doesNotThrow(() => inspectExportContents({ files, pckHash: "current" }));
});

test("production build scripts require every classroom-critical local catalogue", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.match(
    packageJson.scripts["build:web"],
    /^node scripts\/build-netlify-functions\.mjs && node scripts\/export-godot-web\.mjs && /
  );
  assert.match(
    packageJson.scripts["build:web"],
    /export-godot-web\.mjs && vite build[^&]*&& node scripts\/build-logo-icons\.mjs/
  );
  assert.match(
    packageJson.scripts["build:web"],
    /build-web\.mjs[^&]*&& node scripts\/verify-web-export\.mjs build\/web$/
  );
  assert.match(packageJson.scripts.build, /node scripts\/export-godot-web\.mjs && vite build/);
  assert.match(packageJson.scripts["build:web"], /--require-offline-core(?:\s|$)/);
  assert.match(packageJson.scripts.build, /build-web\.mjs[^&]*--require-offline-core(?:\s|$)/);
  assert.match(packageJson.scripts["build:web"], /--minimum-offline-records=2000(?:\s|$)/);
  assert.match(packageJson.scripts.build, /build-web\.mjs[^&]*--minimum-offline-records=2000(?:\s|$)/);
  assert.match(packageJson.scripts["build:web"], /--require-product-builder(?:\s|$)/);
  assert.match(packageJson.scripts.build, /build-web\.mjs[^&]*--require-product-builder(?:\s|$)/);
  assert.match(packageJson.scripts["build:web"], /build-logo-icons\.mjs/);
  assert.match(packageJson.scripts["build:web"], /--require-logo-icons(?:\s|$)/);
  assert.match(packageJson.scripts.build, /build-logo-icons\.test\.mjs/);
  assert.match(packageJson.scripts.build, /build-logo-icons\.mjs/);
  assert.match(packageJson.scripts.build, /build-web\.mjs[^&]*--require-logo-icons(?:\s|$)/);
  assert.match(packageJson.scripts.build, /vitest run[^&]*--maxWorkers=1(?:\s|$)/);
  assert.match(packageJson.scripts["test:build-web"], /build-logo-icons\.test\.mjs/);
  assert.match(packageJson.scripts["test:build-web"], /export-godot-web\.test\.mjs/);
});

test("the bound repository starter manifest resolves twelve reviewed products", async () => {
  const prefix = path.resolve("catalog", "generated", "offline-core-v1");
  const [catalogueBytes, kitBytes, starterBytes] = await Promise.all([
    readFile(path.join(prefix, "catalog.json")),
    readFile(path.join(prefix, "product-kit-v1.json")),
    readFile(path.join(prefix, "student-starters-v1.json"))
  ]);
  const files = new Map([
    ["catalog/generated/offline-core-v1/product-kit-v1.json", kitBytes],
    ["catalog/generated/offline-core-v1/student-starters-v1.json", starterBytes]
  ]);
  const errors = [];

  verifyWebExport.verifyStudentStarterManifest(
    files,
    JSON.parse(catalogueBytes.toString("utf8")),
    errors
  );

  assert.deepEqual(errors, []);
  const manifest = JSON.parse(starterBytes.toString("utf8"));
  assert.equal(manifest.starters.length, 12);
  assert.equal(manifest.starters.filter(({ kind }) => kind === "kit").length, 3);
  assert.equal(manifest.starters.filter(({ kind }) => kind === "raster").length, 9);
});

test("offline-core verification can enforce the production catalogue floor", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-offline-floor-"));
  const core = path.join(root, "catalog", "generated", "offline-core-v1");
  await mkdir(core, { recursive: true });
  const catalogueText = "[]\n";
  await Promise.all([
    writeFile(path.join(core, "catalog.json"), catalogueText),
    writeFile(path.join(core, "pricing.json"), rasterPricing(catalogueText, []))
  ]);

  await assert.rejects(
    () => verifyWebExport.verifyOfflineCoreDirectory(core, { minimumRecords: 2_000 }),
    /at least 2000 records/i
  );
});

test("assembly copies and injects the reviewed product shell catalogue", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-product-shells-"));
  const { web } = await writeExportScaffold(root);
  const shells = path.join(root, "catalog", "generated", "product-shells-v1-reviewed");
  const shellFiles = path.join(shells, "shells", "fixture-can");
  await mkdir(shellFiles, { recursive: true });
  await Promise.all([
    writeFile(path.join(shellFiles, "authoring.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>'),
    writeFile(path.join(shellFiles, "preview.svg"), '<svg xmlns="http://www.w3.org/2000/svg"/>'),
    writeFile(path.join(shells, "catalog.json"), JSON.stringify({
      schema: "product-shell-catalog@1",
      packId: "product-shells-v1",
      version: 1,
      families: [{ id: "drinks-snacks", title: "Drinks & Snacks" }],
      shells: [{
        id: "fixture-can",
        family: "drinks-snacks",
        title: "Fixture Can",
        authoringSvg: "shells/fixture-can/authoring.svg",
        previewSvg: "shells/fixture-can/preview.svg"
      }]
    }))
  ]);

  await assembleWebExport({ root, requireProductShells: true, log: () => {} });

  assert.match(
    await readFile(path.join(web, "index.html"), "utf8"),
    /data-product-shell-catalogue-url="\/catalog\/generated\/product-shells-v1-reviewed\/catalog\.json"/
  );
  assert.match(
    await readFile(path.join(web, "catalog", "generated", "product-shells-v1-reviewed", "shells", "fixture-can", "authoring.svg"), "utf8"),
    /<svg/
  );
});

test("assembly recursively copies the complete optional offline core tree", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-offline-core-"));
  const { web } = await writeExportScaffold(root);
  const core = path.join(root, "catalog", "generated", "offline-core-v1");
  const catalogueText = "[]\n";
  await mkdir(path.join(core, "assets", "fixture", "masks"), { recursive: true });
  await Promise.all([
    writeFile(path.join(core, "catalog.json"), catalogueText),
    writeFile(path.join(core, "pricing.json"), rasterPricing(catalogueText, [])),
    writeFile(path.join(core, "assets", "fixture", "master.png"), Buffer.from([1, 2, 3])),
    writeFile(path.join(core, "assets", "fixture", "preview-640.webp"), Buffer.from([4, 5])),
    writeFile(path.join(core, "assets", "fixture", "masks", "body.png"), Buffer.from([6]))
  ]);

  await assembleWebExport({ root, requireOfflineCore: true, log: () => {} });

  assert.deepEqual(
    await readFile(path.join(web, "catalog", "generated", "offline-core-v1", "assets", "fixture", "master.png")),
    Buffer.from([1, 2, 3])
  );
  assert.equal(
    JSON.parse(await readFile(path.join(web, "catalog", "generated", "offline-core-v1", "pricing.json"), "utf8")).schema,
    "raster-production-pricing@1"
  );
  assert.deepEqual(
    await readFile(path.join(web, "catalog", "generated", "offline-core-v1", "assets", "fixture", "masks", "body.png")),
    Buffer.from([6])
  );
  assert.match(await readFile(path.join(web, "index.html"), "utf8"), /data-offline-catalogue-url/);
});

test("assembly rejects an offline core whose catalogue references missing files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-invalid-offline-core-"));
  await writeExportScaffold(root);
  const core = path.join(root, "catalog", "generated", "offline-core-v1");
  const catalogueText = JSON.stringify([{
    id: "missing-product",
    kind: "raster-master",
    tags: ["base"],
    files: {
      master: "/catalog/generated/offline-core-v1/assets/missing/master.png",
      preview: "/catalog/generated/offline-core-v1/assets/missing/preview-640.webp",
      thumbnail: "/catalog/generated/offline-core-v1/assets/missing/thumbnail-192.webp"
    },
    masterSha256: "0".repeat(64)
  }]);
  await mkdir(core, { recursive: true });
  await Promise.all([
    writeFile(path.join(core, "catalog.json"), catalogueText),
    writeFile(path.join(core, "pricing.json"), rasterPricing(catalogueText, [
      { assetId: "missing-product", costCents: 2_500, role: "base" }
    ]))
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

test("logo verification and recursive copy reject a source-root junction", async () => {
  const realRoot = await mkdtemp(path.join(tmpdir(), "admarket-logo-real-root-"));
  const realDirectory = await writeLogoIconPack(realRoot);
  const linkedRoot = await mkdtemp(path.join(tmpdir(), "admarket-logo-linked-root-"));
  const linkedParent = path.join(linkedRoot, "catalog", "generated");
  const linkedDirectory = path.join(linkedParent, "logo-icons-v1-reviewed");
  const destination = path.join(linkedRoot, "destination");
  await mkdir(linkedParent, { recursive: true });
  await symlink(realDirectory, linkedDirectory, "junction");

  await assert.rejects(
    () => verifyWebExport.verifyLogoIconDirectory(linkedDirectory),
    /symlink|reparse|junction/i
  );
  await assert.rejects(
    () => copyVerifiedTree(linkedDirectory, destination),
    /source.*(?:symlink|reparse|junction)/i
  );
});

test("recursive copy rejects source-ancestor and destination-file indirection", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-copy-indirection-"));
  const realParent = path.join(root, "real-parent");
  const realSource = path.join(realParent, "source");
  const aliasParent = path.join(root, "alias-parent");
  const destination = path.join(root, "destination");
  const outside = path.join(root, "outside.json");
  await mkdir(realSource, { recursive: true });
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(realSource, "catalog.json"), "source");
  await writeFile(outside, "outside");
  await symlink(realParent, aliasParent, "junction");
  await link(outside, path.join(destination, "catalog.json"));

  await assert.rejects(
    () => copyVerifiedTree(path.join(aliasParent, "source"), path.join(root, "safe-destination")),
    /source.*(?:ancestor|symlink|reparse|junction)|indirection/i
  );
  await assert.rejects(
    () => copyVerifiedTree(realSource, destination),
    /destination.*(?:symlink|reparse|junction)|indirection/i
  );
  assert.equal(await readFile(outside, "utf8"), "outside");
});

test("verification rejects the known stale spike PCK", () => {
  const files = addInlineBootstrapAndCspHeaders(new Map([
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
      ["studio/studio.js", VALID_STUDIO_BRIDGES],
      ["godot/export_presets.cfg", "variant/thread_support=false"]
    ]));
  assert.throws(
    () => inspectExportContents({
      files,
      pckHash: STALE_PCK_HASH
    }),
    /known stale PCK/i
  );
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
  const catalogueText = JSON.stringify([{
    id: "fixture-product",
    kind: "raster-master",
    tags: ["base"],
    files: {
      master: `/${prefix}/master.png`,
      preview: `/${prefix}/preview-640.webp`,
      thumbnail: `/${prefix}/thumbnail-192.webp`
    },
    masterSha256: masterHash
  }]);
  const files = new Map([
    ["index.html", '<link rel="stylesheet" href="./studio/studio.css"><script src="./studio/studio.js"></script><script src="./index.js"></script>'],
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", VALID_STUDIO_BRIDGES],
    ["godot/export_presets.cfg", "variant/thread_support=false"],
    [`${prefix}/master.png`, master],
    [`${prefix}/preview-640.webp`, Buffer.from([5])],
    [`${prefix}/thumbnail-192.webp`, Buffer.from([6])],
    ["catalog/generated/offline-core-v1/catalog.json", catalogueText],
    ["catalog/generated/offline-core-v1/pricing.json", rasterPricing(catalogueText, [
      { assetId: "fixture-product", costCents: 2_500, role: "base" }
    ])]
  ]);
  addInlineBootstrapAndCspHeaders(files);

  assert.doesNotThrow(() => inspectExportContents({ files, pckHash: "current" }));
  assert.throws(
    () => inspectExportContents({
      files,
      pckHash: "current",
      minimumOfflineRecords: 2
    }),
    /offline catalogue must contain at least 2 records/i
  );

  const missingPricing = new Map(files);
  missingPricing.delete("catalog/generated/offline-core-v1/pricing.json");
  assert.throws(
    () => inspectExportContents({ files: missingPricing, pckHash: "current" }),
    /missing offline pricing/i
  );

  const mismatchedPricing = new Map(files);
  mismatchedPricing.set("catalog/generated/offline-core-v1/pricing.json", rasterPricing("different", [
    { assetId: "fixture-product", costCents: 2_500, role: "base" }
  ]));
  assert.throws(
    () => inspectExportContents({ files: mismatchedPricing, pckHash: "current" }),
    /catalog hash mismatch/i
  );

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

test("verification checks every reviewed product shell SVG reference", () => {
  const prefix = "catalog/generated/product-shells-v1-reviewed";
  const files = new Map([
    ["index.html", `<div id="creator-root" data-product-shell-catalogue-url="/${prefix}/catalog.json"></div><link rel="stylesheet" href="./studio/studio.css"><script src="./studio/studio.js"></script><script src="./index.js"></script>`],
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", VALID_STUDIO_BRIDGES],
    ["godot/export_presets.cfg", "variant/thread_support=false"],
    [`${prefix}/shells/fixture-can/authoring.svg`, "<svg/>"] ,
    [`${prefix}/shells/fixture-can/preview.svg`, "<svg/>"] ,
    [`${prefix}/catalog.json`, JSON.stringify({
      schema: "product-shell-catalog@1",
      packId: "product-shells-v1",
      version: 1,
      families: [{ id: "drinks-snacks", title: "Drinks & Snacks" }],
      shells: [{
        id: "fixture-can",
        family: "drinks-snacks",
        title: "Fixture Can",
        authoringSvg: "shells/fixture-can/authoring.svg",
        previewSvg: "shells/fixture-can/preview.svg"
      }]
    })]
  ]);
  addInlineBootstrapAndCspHeaders(files);

  assert.doesNotThrow(() => inspectExportContents({ files, pckHash: "current" }));

  const missing = new Map(files);
  missing.delete(`${prefix}/shells/fixture-can/preview.svg`);
  assert.throws(
    () => inspectExportContents({ files: missing, pckHash: "current" }),
    /product shell catalogue references missing file/i
  );
});
