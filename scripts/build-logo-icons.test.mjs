import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { link, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import {
  buildLogoIconCatalogue,
  compileLogoIconCatalogue,
  safeIconBody
} from "./build-logo-icons.mjs";

const svgSafetyFixtures = JSON.parse(readFileSync(
  new URL("./logo-icon-svg-safety-fixtures.json", import.meta.url),
  "utf8"
));

const fixture = {
  prefix: "tabler",
  width: 24,
  height: 24,
  icons: {
    paw: { body: '<path fill="none" stroke="currentColor" d="M1 1h2"/>' },
    burger: { body: '<g fill="none" stroke="currentColor"><path d="M2 3h8"/></g>' },
    rocket: { body: '<path fill="none" stroke="currentColor" d="M2 2l8 8"/>' },
    "brand-example": { body: '<path d="M0 0h4"/>' },
    beer: { body: '<path d="M0 0h4"/>' },
    "rocket-filled": { body: '<path d="M0 0h4"/>' }
  }
};

test("logo icon compilation removes brands, unsuitable subjects, and duplicate filled variants", () => {
  const catalogue = compileLogoIconCatalogue(fixture, {
    packageVersion: "1.2.35",
    sourceVersion: "3.44.0"
  });

  assert.equal(catalogue.schema, "logo-icon-catalog@1");
  assert.equal(catalogue.packId, "tabler-logo-icons-v1");
  assert.deepEqual(catalogue.icons.map(({ id }) => id), ["burger", "paw", "rocket"]);
  assert.deepEqual(catalogue.icons.find(({ id }) => id === "burger")?.categories, [
    "drinks-snacks",
    "fast-food-hospitality"
  ]);
  assert.deepEqual(catalogue.icons.find(({ id }) => id === "paw")?.categories, [
    "pets-animals"
  ]);
});

test("logo icon compilation is deterministic and preserves a colourable SVG body", () => {
  const first = compileLogoIconCatalogue(fixture, {
    packageVersion: "1.2.35",
    sourceVersion: "3.44.0"
  });
  const second = compileLogoIconCatalogue({
    ...fixture,
    icons: Object.fromEntries(Object.entries(fixture.icons).reverse())
  }, {
    packageVersion: "1.2.35",
    sourceVersion: "3.44.0"
  });

  assert.deepEqual(second, first);
  assert.match(first.icons[0].body, /currentColor/);
  assert.equal(first.icons[0].width, 24);
  assert.equal(first.icons[0].height, 24);
});

test("SVG bodies fail closed on active content and unsupported elements", () => {
  assert.equal(safeIconBody('<path fill="none" stroke="currentColor" d="M0 0h4"/>'), true);
  assert.equal(safeIconBody('<path onclick="alert(1)" d="M0 0h4"/>'), false);
  assert.equal(safeIconBody('<script>alert(1)</script>'), false);
  assert.equal(safeIconBody('<image href="https://example.invalid/a.png"/>'), false);
  assert.equal(
    safeIconBody('<g stroke="currentColor"><path d="M0 0h4"/><use href=//example.invalid/a.svg#mark /></g>'),
    false
  );
  assert.equal(safeIconBody('<path id="currentColor" d="M0 0h4"/>'), false);
  assert.throws(
    () => compileLogoIconCatalogue({
      ...fixture,
      icons: { malicious: { body: '<foreignObject><p>bad</p></foreignObject>' } }
    }, {
      packageVersion: "1.2.35",
      sourceVersion: "3.44.0"
    }),
    /unsafe SVG body/i
  );
});

test("Node SVG safety policy matches the shared browser parity fixtures", () => {
  for (const fixtureCase of svgSafetyFixtures.valid) {
    assert.equal(safeIconBody(fixtureCase.body), true, fixtureCase.name);
  }
  for (const fixtureCase of svgSafetyFixtures.invalid) {
    assert.equal(safeIconBody(fixtureCase.body), false, fixtureCase.name);
  }
});

test("logo catalogue generation rejects source ancestors and destination-file indirection", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "admarket-logo-generator-indirection-"));
  const vendor = path.join(root, "catalog", "source", "logo-icons-tabler-v1", "vendor");
  const destination = path.join(root, "catalog", "generated", "logo-icons-v1-reviewed");
  const outside = path.join(root, "outside.json");
  await mkdir(vendor, { recursive: true });
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(vendor, "icons.json"), JSON.stringify(fixture));
  await writeFile(path.join(vendor, "info.json"), JSON.stringify({ version: "3.44.0" }));
  await writeFile(outside, "outside");
  await link(outside, path.join(destination, "catalog.json"));

  await assert.rejects(
    () => buildLogoIconCatalogue(root),
    /destination.*(?:hard-link|indirection)/i
  );
  assert.equal(await readFile(outside, "utf8"), "outside");

  const sourceRoot = await mkdtemp(path.join(tmpdir(), "admarket-logo-generator-source-alias-"));
  const realSource = path.join(sourceRoot, "real-source");
  const realVendor = path.join(realSource, "logo-icons-tabler-v1", "vendor");
  const expectedParent = path.join(sourceRoot, "catalog");
  await mkdir(realVendor, { recursive: true });
  await mkdir(expectedParent, { recursive: true });
  await writeFile(path.join(realVendor, "icons.json"), JSON.stringify(fixture));
  await writeFile(path.join(realVendor, "info.json"), JSON.stringify({ version: "3.44.0" }));
  await symlink(realSource, path.join(expectedParent, "source"), "junction");

  await assert.rejects(
    () => buildLogoIconCatalogue(sourceRoot),
    /source.*(?:symlink|junction|reparse-point|indirection)/i
  );
});
