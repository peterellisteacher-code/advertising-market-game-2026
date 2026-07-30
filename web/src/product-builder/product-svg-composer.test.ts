import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseProductBuilderCatalogue,
  type ProductBuilderColours
} from "./product-builder-catalogue";
import {
  createVirtualProductVariantResolver,
  type ResolvedProductVariant
} from "./virtual-product-variant";
import { composeProductVariantSvg } from "./product-svg-composer";

const PACK_ROOT = join("catalog", "generated", "product-builder-pilot-v1");
const CATALOGUE_URL =
  "https://studio.test/catalog/generated/product-builder-pilot-v1/catalogue.json";

function packText(relativePath: string): string {
  return readFileSync(join(process.cwd(), PACK_ROOT, relativePath), "utf8");
}

const catalogue = parseProductBuilderCatalogue(
  JSON.parse(packText("catalogue.json")),
  CATALOGUE_URL
);
if (!catalogue) throw new Error("Reviewed product builder fixture did not parse");
const resolver = createVirtualProductVariantResolver(catalogue);

function variant(
  bodyId: string,
  partId: string,
  materialId = "fabric"
): ResolvedProductVariant {
  const resolved = resolver.resolveVariant({
    bodyId,
    partId,
    paletteId: "cobalt-citrus",
    materialId
  });
  if (!resolved) throw new Error(`Could not resolve ${bodyId} with ${partId}`);
  return resolved;
}

function svgFor(resolved: ResolvedProductVariant): {
  readonly authoringSvg: string;
  readonly componentSvg: string;
} {
  return {
    authoringSvg: packText(`bodies/${resolved.bodyId}/authoring.svg`),
    componentSvg: packText(`components/${resolved.partId}.svg`)
  };
}

function documentFor(svg: string): XMLDocument {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  expect(document.querySelector("parsererror")).toBeNull();
  return document;
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const nested of Object.values(value)) deepFreeze(nested, seen);
  return Object.freeze(value);
}

function regionColours(document: XMLDocument): ProductBuilderColours {
  const colour = (region: keyof ProductBuilderColours): string => {
    const value = document.querySelector(`[data-region="${region}"]`)?.getAttribute("fill");
    if (!value) throw new Error(`Missing ${region} region fill`);
    return value;
  };
  return {
    accent: colour("accent"),
    body: colour("body"),
    label: colour("label"),
    trim: colour("trim")
  };
}

describe("composeProductVariantSvg", () => {
  it("accepts every reviewed body and component byte identity", () => {
    for (const body of catalogue.bodies) {
      for (const partId of body.compatiblePartIds) {
        const resolved = variant(body.id, partId);
        expect(() => composeProductVariantSvg({
          variant: resolved,
          ...svgFor(resolved),
          mode: "clean"
        })).not.toThrow();
      }
    }
  });

  it("rejects canonical palette IDs carrying substituted colour tuples", () => {
    for (const palette of catalogue.palettes) {
      const resolved = resolver.resolveVariant({
        bodyId: "drinkware-classic-can",
        partId: "drinkware-top-ring",
        paletteId: palette.id,
        materialId: "matte-plastic"
      });
      if (!resolved) throw new Error(`Could not resolve palette ${palette.id}`);
      expect(() => composeProductVariantSvg({
        variant: resolved,
        ...svgFor(resolved)
      })).not.toThrow();
      const forged = deepFreeze({
        ...resolved,
        colours: {
          ...resolved.colours,
          accent: resolved.colours.body,
          body: resolved.colours.accent
        }
      }) as ResolvedProductVariant;

      expect(() => composeProductVariantSvg({
        variant: forged,
        ...svgFor(resolved)
      })).toThrow("canonical palette");
    }
  });

  it("rejects altered body or component geometry with unchanged root metadata", () => {
    const resolved = variant("drinkware-classic-can", "drinkware-top-ring");
    const sources = svgFor(resolved);
    const alteredBody = sources.authoringSvg.replace("M360 165", "M361 165");
    const alteredComponent = sources.componentSvg.replace('rx=".4"', 'rx=".41"');
    expect(alteredBody).not.toBe(sources.authoringSvg);
    expect(alteredComponent).not.toBe(sources.componentSvg);

    expect(() => composeProductVariantSvg({
      variant: resolved,
      authoringSvg: alteredBody,
      componentSvg: sources.componentSvg
    })).toThrow("reviewed SHA-256");
    expect(() => composeProductVariantSvg({
      variant: resolved,
      authoringSvg: sources.authoringSvg,
      componentSvg: alteredComponent
    })).toThrow("reviewed SHA-256");
  });

  it.each([
    {
      bodyId: "bags-backpack",
      partId: "bags-carry-long-straps",
      anchor: "0.5 0.18",
      transform: "translate(500 180) scale(440) translate(-0.5 0)"
    },
    {
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-spout",
      anchor: "0.5 0.08",
      transform: "translate(500 80) scale(260) translate(-0.5 0)"
    },
    {
      bodyId: "food-packaging-meal-box",
      partId: "food-packaging-closure-tabbed",
      anchor: "0.5 0.15",
      transform: "translate(500 150) scale(440) translate(-0.5 0)"
    }
  ])("places the $bodyId component class at its declared anchor", ({
    bodyId,
    partId,
    anchor,
    transform
  }) => {
    const resolved = variant(bodyId, partId);
    const { svg, namespace } = composeProductVariantSvg({
      variant: resolved,
      ...svgFor(resolved),
      artwork: { id: "student-art-1", colour: "#F2385A" },
      mode: "editor"
    });
    const document = documentFor(svg);
    const root = document.documentElement;
    const layers = Array.from(root.children)
      .map((child) => child.getAttribute("data-layer"))
      .filter((value): value is string => value !== null);

    expect(layers).toEqual([
      "base-shell",
      "artwork-slot",
      "selected-component",
      "tone-detail",
      "editor-guides"
    ]);
    expect(root).toMatchObject({
      tagName: "svg"
    });
    expect(root.getAttribute("data-pack-id")).toBe(resolved.packId);
    expect(root.getAttribute("data-variant-id")).toBe(resolved.id);
    expect(regionColours(document)).toEqual(resolved.colours);

    const artwork = document.querySelector('[data-student-artwork="student-art-1"]');
    expect(artwork?.getAttribute("fill")).toBe("#F2385A");
    expect(artwork?.getAttribute("opacity")).toBe("1");

    const component = document.querySelector('[data-layer="selected-component"]');
    expect(component).not.toBeNull();
    expect(component?.getAttribute("data-part-id")).toBe(partId);
    expect(component?.getAttribute("data-slot-id")).toBe(resolved.componentSlotId);
    expect(component?.getAttribute("data-anchor")).toBe(anchor);
    expect(component?.getAttribute("transform")).toBe(transform);
    expect(component?.getAttribute("data-rendered-stroke-width")).toBe("6");
    const componentStructure = component?.querySelector('[data-layer="component-structure"]');
    expect(componentStructure).not.toBeNull();
    expect(componentStructure?.getAttribute("fill")).toBe(resolved.colours.trim);
    expect(componentStructure?.getAttribute("stroke")).toBe(resolved.colours.trim);
    expect(svg).not.toContain("currentColor");

    const tone = document.querySelector('[data-layer="tone-detail"]');
    expect(tone?.querySelector('[data-tone="shadow"]')?.getAttribute("fill"))
      .toBe("#34414D");
    expect(tone?.querySelector('[data-tone="highlight"]')?.getAttribute("fill"))
      .toBe("#FFFFFF");
    expect(tone?.querySelector('[data-structural-details="true"]')).not.toBeNull();

    const ids = Array.from(document.querySelectorAll("[id]"), (node) => node.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.startsWith(`${namespace}-`))).toBe(true);
    const clipPath = document.querySelector('[data-layer="artwork-slot"]')
      ?.getAttribute("clip-path");
    expect(clipPath).toMatch(new RegExp(`^url\\(#${namespace}-`));
    expect(document.getElementById(clipPath!.slice(5, -1))).not.toBeNull();
  });

  it("changes the material treatment without changing palette region identity", () => {
    const fabric = variant("bags-tote", "bags-carry-loop", "fabric");
    const glass = variant("bags-tote", "bags-carry-loop", "glass");
    const fabricOutput = composeProductVariantSvg({ variant: fabric, ...svgFor(fabric) });
    const glassOutput = composeProductVariantSvg({ variant: glass, ...svgFor(glass) });
    const fabricDocument = documentFor(fabricOutput.svg);
    const glassDocument = documentFor(glassOutput.svg);
    const fabricTreatment = fabricDocument.querySelector("[data-material-treatment]");
    const glassTreatment = glassDocument.querySelector("[data-material-treatment]");

    expect(regionColours(fabricDocument)).toEqual(fabric.colours);
    expect(regionColours(glassDocument)).toEqual(glass.colours);
    expect(fabricTreatment?.getAttribute("data-material-treatment")).toBe("fabric");
    expect(glassTreatment?.getAttribute("data-material-treatment")).toBe("glass");
    expect(fabricTreatment?.outerHTML).not.toBe(glassTreatment?.outerHTML);
  });

  it("omits editor guide and role metadata in clean mode", () => {
    const resolved = variant("drinkware-slim-can", "drinkware-top-flat");
    const output = composeProductVariantSvg({
      variant: resolved,
      ...svgFor(resolved),
      artwork: { id: "opaque-art", colour: "#35B96F" },
      mode: "clean"
    });

    expect(output.svg).not.toContain("editor-guides");
    expect(output.svg).not.toContain("data-editor-only");
    expect(output.svg).not.toContain("data-selection-outline");
    expect(output.svg).not.toMatch(/\srole=/);
    expect(documentFor(output.svg).querySelector('[data-layer="tone-detail"]'))
      .not.toBeNull();
  });

  it("rejects forged, incompatible, or active input before composing", () => {
    const resolved = variant("drinkware-classic-can", "drinkware-top-ring");
    const sources = svgFor(resolved);
    const forged = { ...resolved } as ResolvedProductVariant;

    expect(() => composeProductVariantSvg({ variant: forged, ...sources }))
      .toThrow("immutable");
    expect(() => composeProductVariantSvg({
      variant: resolved,
      authoringSvg: sources.authoringSvg.replace(
        'data-geometry-id="body-classic-can"',
        'data-geometry-id="body-slim-can"'
      ),
      componentSvg: sources.componentSvg
    })).toThrow("body identity");
    expect(() => composeProductVariantSvg({
      variant: resolved,
      authoringSvg: sources.authoringSvg,
      componentSvg: packText("components/bags-carry-loop.svg")
    })).toThrow("component identity");
    expect(() => composeProductVariantSvg({
      variant: resolved,
      authoringSvg: sources.authoringSvg.replace("<defs>", "<script>bad()</script><defs>"),
      componentSvg: sources.componentSvg
    })).toThrow("safe passive SVG");
    expect(sources.authoringSvg).toContain('data-palette-id="alpine-mint"');
    expect(sources.componentSvg).toContain(`data-part-id="${resolved.partId}"`);
  });
});
