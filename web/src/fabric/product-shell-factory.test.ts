import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ClipPathLayout, FabricObject, FixedLayout, Group } from "fabric";
import { describe, expect, it } from "vitest";
import { parseProductBuilderCatalogue } from "../product-builder/product-builder-catalogue";
import { createVirtualProductVariantResolver } from "../product-builder/virtual-product-variant";
import {
  FabricProductShellFactory,
  productArtworkSurface,
  recolourProductShellRegion
} from "./product-shell-factory";

const SHELL_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <g data-region="body" fill="#E8E2D8">
    <rect x="200" y="160" width="600" height="680" rx="80" />
  </g>
  <g data-region="accent" fill="#B85165">
    <rect x="250" y="700" width="500" height="80" />
  </g>
  <rect data-print-area="front" x="300" y="300" width="400" height="360"
    fill="none" stroke="#2E6AE6" />
  <rect data-safe-area="front" x="330" y="330" width="340" height="300"
    fill="none" stroke="#20A464" />
</svg>`;

function descendants(root: FabricObject): FabricObject[] {
  if (!(root instanceof Group)) return [root];
  return [root, ...root.getObjects().flatMap(descendants)];
}

const PACK_ROOT = join("catalog", "generated", "product-builder-pilot-v1");
function packText(relativePath: string): string {
  return readFileSync(join(process.cwd(), PACK_ROOT, relativePath), "utf8");
}
const catalogue = parseProductBuilderCatalogue(
  JSON.parse(packText("catalogue.json")),
  "https://studio.test/catalog/generated/product-builder-pilot-v1/catalogue.json"
);
if (!catalogue) throw new Error("Reviewed product builder fixture did not parse");
const resolver = createVirtualProductVariantResolver(catalogue);

describe("FabricProductShellFactory", () => {
  it("loads one editable shell group with named regions and export-hidden guides", async () => {
    const shell = await new FabricProductShellFactory().create({
      id: "shell-object-1",
      shellId: "fashion-street-tee",
      svg: SHELL_SVG,
      accessibleName: "Streetwear T-shirt"
    });

    expect(shell).toBeInstanceOf(Group);
    expect(shell).toMatchObject({
      objectId: "shell-object-1",
      elementKind: "product-shell",
      shellId: "fashion-street-tee",
      accessibleName: "Streetwear T-shirt",
      left: 800,
      top: 450,
      originX: "center",
      originY: "center"
    });
    const objects = descendants(shell);
    expect(objects.some((object) => object.shellRegion === "body")).toBe(true);
    expect(objects.some((object) => object.shellRegion === "accent")).toBe(true);
    expect(objects.filter((object) => object.editorGuide)).toHaveLength(2);

    expect(recolourProductShellRegion(shell, "accent", "#157A6E")).toBeGreaterThan(0);
    const accent = objects.filter((object) => object.shellRegion === "accent");
    expect(accent.some((object) => object.fill === "#157A6E")).toBe(true);
    expect(() => recolourProductShellRegion(shell, "missing", "#FFFFFF"))
      .toThrow("missing region");
  });

  it("preserves shell, region, and guide metadata through Fabric serialization", async () => {
    const original = await new FabricProductShellFactory().create({
      id: "shell-object-round-trip",
      shellId: "drinks-classic-can",
      svg: SHELL_SVG,
      accessibleName: "Classic Soft Drink Can"
    });

    const restored = await Group.fromObject(original.toObject());
    const objects = descendants(restored);

    expect(restored).toMatchObject({
      objectId: "shell-object-round-trip",
      elementKind: "product-shell",
      shellId: "drinks-classic-can",
      accessibleName: "Classic Soft Drink Can"
    });
    expect(objects.some((object) => object.shellRegion === "body")).toBe(true);
    expect(objects.some((object) => object.shellRegion === "accent")).toBe(true);
    expect(objects.filter((object) => object.editorGuide)).toHaveLength(2);
  });

  it("creates and serializes one populated product variant with typed identity", async () => {
    const variant = resolver.resolveVariant({
      bodyId: "food-packaging-snack-pouch",
      partId: "food-packaging-closure-zip",
      paletteId: "teal-raspberry",
      materialId: "gloss-plastic"
    });
    if (!variant) throw new Error("Expected real product variant fixture");
    const factory = new FabricProductShellFactory();
    const shell = await factory.createVariant({
      id: "product-variant-1",
      accessibleName: "Custom snack pouch",
      variant,
      authoringSvg: packText(`bodies/${variant.bodyId}/authoring.svg`),
      componentSvg: packText(`components/${variant.partId}.svg`),
      artwork: { id: "student-mark", colour: "#F2385A" },
      mode: "editor"
    });

    expect(shell).toMatchObject({
      objectId: "product-variant-1",
      elementKind: "product-shell",
      shellId: variant.bodyId,
      accessibleName: "Custom snack pouch",
      packId: variant.packId,
      variantId: variant.id,
      bodyId: variant.bodyId,
      partId: variant.partId,
      paletteId: variant.paletteId,
      materialId: variant.materialId
    });
    const objects = descendants(shell);
    expect(objects.some((object) => object.productLayer === "artwork-slot")).toBe(true);
    expect(objects.some((object) => object.productLayer === "selected-component")).toBe(true);
    expect(objects.some((object) => object.productLayer === "tone-detail")).toBe(true);
    expect(objects.some((object) => object.editorGuide)).toBe(true);

    const restored = await Group.fromObject(shell.toObject());
    expect(restored).toMatchObject({
      packId: variant.packId,
      variantId: variant.id,
      bodyId: variant.bodyId,
      partId: variant.partId,
      paletteId: variant.paletteId,
      materialId: variant.materialId
    });
  });

  it("nests one clipped artwork surface without widening the product frame", async () => {
    const variant = resolver.resolveVariant({
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-ring",
      paletteId: "cobalt-citrus",
      materialId: "fabric"
    });
    if (!variant) throw new Error("Expected real drinkware variant fixture");
    const shell = await new FabricProductShellFactory().createVariant({
      id: "clipped-product",
      accessibleName: "Cobalt Citrus Classic Can",
      variant,
      authoringSvg: packText(`bodies/${variant.bodyId}/authoring.svg`),
      componentSvg: packText(`components/${variant.partId}.svg`),
      artwork: { id: "front-art", colour: "#F2385A" },
      mode: "editor"
    });

    const surface = productArtworkSurface(shell);
    expect(surface).toMatchObject({
      productLayer: "artwork-slot",
      artworkSlotId: "primary"
    });
    expect(surface.layoutManager.strategy).toBeInstanceOf(ClipPathLayout);
    expect(surface.clipPath).toBeDefined();
    expect(surface.getObjects()).toHaveLength(1);
    expect(surface.getObjects()[0]).toMatchObject({
      artworkId: "front-art",
      productLayer: "student-artwork",
      clipPath: undefined
    });
    expect(shell.layoutManager.strategy).toBeInstanceOf(FixedLayout);
    expect(shell.getScaledHeight()).toBeCloseTo(620, 0);
    expect(shell.getScaledWidth() / shell.getScaledHeight()).toBeLessThan(0.65);

    const restored = await Group.fromObject(shell.toObject());
    const restoredSurface = productArtworkSurface(restored);
    expect(restoredSurface.layoutManager.strategy).toBeInstanceOf(ClipPathLayout);
    expect(restoredSurface.clipPath).toBeDefined();
    expect(restoredSurface.getObjects()[0]).toMatchObject({
      artworkId: "front-art",
      productLayer: "student-artwork"
    });
    expect(restored.width).toBe(shell.width);
    expect(restored.height).toBe(shell.height);
    expect(restored.scaleX).toBeCloseTo(shell.scaleX, 3);
    expect(restored.scaleY).toBeCloseTo(shell.scaleY, 3);
  });

  it.each(catalogue.materials)("fits $title selection bounds to the visible assembled product", async (material) => {
    const variant = resolver.resolveVariant({
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-ring",
      paletteId: "cobalt-citrus",
      materialId: material.id
    });
    if (!variant) throw new Error("Expected real drinkware variant fixture");
    const shell = await new FabricProductShellFactory().createVariant({
      id: "tight-product-variant",
      accessibleName: "Cobalt Citrus Classic Can",
      variant,
      authoringSvg: packText(`bodies/${variant.bodyId}/authoring.svg`),
      componentSvg: packText(`components/${variant.partId}.svg`),
      artwork: { id: "front-art", colour: "#F2385A" },
      mode: "editor"
    });

    expect(shell.getScaledHeight()).toBeCloseTo(620, 0);
    expect(shell.getScaledWidth() / shell.getScaledHeight()).toBeLessThan(0.65);
    const originalLayers = descendants(shell).map((object) => object.productLayer);
    expect(originalLayers).toContain("artwork-slot");
    expect(originalLayers).toContain("selected-component");
    expect(originalLayers).toContain("material-treatment");

    const restored = await Group.fromObject(shell.toObject());
    expect(restored.width).toBe(shell.width);
    expect(restored.height).toBe(shell.height);
    expect(restored.scaleX).toBeCloseTo(shell.scaleX, 3);
    expect(restored.scaleY).toBeCloseTo(shell.scaleY, 3);
    expect(restored.layoutManager.strategy).toBeInstanceOf(FixedLayout);
    const restoredLayers = descendants(restored).map((object) => object.productLayer);
    expect(restoredLayers).toContain("artwork-slot");
    expect(restoredLayers).toContain("selected-component");
    expect(restoredLayers).toContain("material-treatment");
  });

  it("keeps failed composition outside the awaited canvas mutation boundary", async () => {
    const variant = resolver.resolveVariant({
      bodyId: "bags-weekender",
      partId: "bags-carry-short-straps",
      paletteId: "forest-sun",
      materialId: "cardboard"
    });
    if (!variant) throw new Error("Expected real product variant fixture");
    const addToCanvas: Group[] = [];
    const result = new FabricProductShellFactory().createVariant({
      id: "bad-product",
      accessibleName: "Bad product",
      variant,
      authoringSvg: packText(`bodies/${variant.bodyId}/authoring.svg`),
      componentSvg: packText("components/drinkware-top-straw.svg")
    }).then((shell) => addToCanvas.push(shell));

    await expect(result).rejects.toThrow("component identity");
    expect(addToCanvas).toEqual([]);
  });
});
