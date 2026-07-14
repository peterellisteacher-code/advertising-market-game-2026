import test from "node:test";
import assert from "node:assert/strict";

import {
  compileLogoIconCatalogue,
  safeIconBody
} from "./build-logo-icons.mjs";

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
  assert.equal(safeIconBody('<path d="M0 0h4"/>'), true);
  assert.equal(safeIconBody('<path onclick="alert(1)" d="M0 0h4"/>'), false);
  assert.equal(safeIconBody('<script>alert(1)</script>'), false);
  assert.equal(safeIconBody('<image href="https://example.invalid/a.png"/>'), false);
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
