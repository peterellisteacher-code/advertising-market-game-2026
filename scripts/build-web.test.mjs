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
  injectProductShellCatalogueUrl,
  injectStudioAssets
} from "./build-web.mjs";
import * as buildWeb from "./build-web.mjs";
import { inspectExportContents } from "./verify-web-export.mjs";
import * as verifyWebExport from "./verify-web-export.mjs";

const STALE_PCK_HASH =
  "e8b1d3f2729a16f0d001f8b1483aa4fbc150dcb1b3411b5aacd7456b6cb92459";

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

async function writeExportScaffold(root, creatorRoot = '<div id="creator-root"></div>') {
  const studio = path.join(root, "build", "studio");
  const web = path.join(root, "build", "web");
  await Promise.all([
    mkdir(studio, { recursive: true }),
    mkdir(web, { recursive: true })
  ]);
  await Promise.all([
    writeFile(path.join(studio, "studio.js"), "window.AdMarketCreator = {};"),
    writeFile(path.join(studio, "studio.css"), ".creator{}"),
    writeFile(
      path.join(web, "index.html"),
      `<html><head></head><body>${creatorRoot}<script src="./index.js"></script></body></html>`
    ),
    writeFile(path.join(web, "index.js"), "const local = true;"),
    writeFile(path.join(web, "index.wasm"), Buffer.from([0])),
    writeFile(path.join(web, "index.pck"), Buffer.from([1]))
  ]);
  return { studio, web };
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
    ["studio/studio.js", "window.AdMarketCreator = publicApi;"],
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
    ["studio/studio.js", "window.AdMarketCreator = publicApi;"],
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
    ["studio/studio.js", "window.AdMarketCreator = publicApi;"],
    ["godot/export_presets.cfg", "variant/thread_support=false"],
    ...builderFiles
  ]);

  assert.throws(
    () => inspectExportContents({ files, pckHash: "current" }),
    /reference the product builder catalogue exactly once/i
  );
});

test("production build scripts require the product builder pilot", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.match(packageJson.scripts["build:web"], /--require-product-builder(?:\s|$)/);
  assert.match(packageJson.scripts.build, /build-web\.mjs[^&]*--require-product-builder(?:\s|$)/);
});

test("assembly copies and injects the reviewed product shell catalogue", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-product-shells-"));
  const studio = path.join(root, "build", "studio");
  const web = path.join(root, "build", "web");
  const shells = path.join(root, "catalog", "generated", "product-shells-v1-reviewed");
  const shellFiles = path.join(shells, "shells", "fixture-can");
  await Promise.all([
    mkdir(studio, { recursive: true }),
    mkdir(web, { recursive: true }),
    mkdir(shellFiles, { recursive: true })
  ]);
  await Promise.all([
    writeFile(path.join(studio, "studio.js"), "window.AdMarketCreator = {};"),
    writeFile(path.join(studio, "studio.css"), ".creator{}"),
    writeFile(path.join(web, "index.html"), '<html><head></head><body><div id="creator-root"></div><script src="./index.js"></script></body></html>'),
    writeFile(path.join(web, "index.js"), "const local = true;"),
    writeFile(path.join(web, "index.wasm"), Buffer.from([0])),
    writeFile(path.join(web, "index.pck"), Buffer.from([1])),
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

test("verification checks every reviewed product shell SVG reference", () => {
  const prefix = "catalog/generated/product-shells-v1-reviewed";
  const files = new Map([
    ["index.html", `<div id="creator-root" data-product-shell-catalogue-url="/${prefix}/catalog.json"></div><link rel="stylesheet" href="./studio/studio.css"><script src="./studio/studio.js"></script><script src="./index.js"></script>`],
    ["index.js", "const target = 'wasm32.nothreads'; const audio = new AudioWorklet();"],
    ["index.wasm", Buffer.from([0])],
    ["index.pck", Buffer.from([1])],
    ["index.audio.worklet.js", "class GodotAudioWorklet {}"],
    ["studio/studio.css", ".creator{}"],
    ["studio/studio.js", "window.AdMarketCreator = publicApi;"],
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

  assert.doesNotThrow(() => inspectExportContents({ files, pckHash: "current" }));

  const missing = new Map(files);
  missing.delete(`${prefix}/shells/fixture-can/preview.svg`);
  assert.throws(
    () => inspectExportContents({ files: missing, pckHash: "current" }),
    /product shell catalogue references missing file/i
  );
});
