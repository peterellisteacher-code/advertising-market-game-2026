import { describe, expect, it } from "vitest";
import type { ResolvedProductVariant } from "./virtual-product-variant";
import { quotePilotProductVariant } from "./pilot-product-economics";

function variant(overrides: Partial<ResolvedProductVariant> = {}): ResolvedProductVariant {
  return {
    schema: "product-builder-variant@1",
    id: "product-builder-variant@1:product-builder-pilot-v1:food-packaging-burger-box:food-packaging-closure-zip:alpine-mint:cardboard",
    packId: "product-builder-pilot-v1",
    familyId: "food-packaging",
    bodyId: "food-packaging-burger-box",
    partId: "food-packaging-closure-zip",
    paletteId: "alpine-mint",
    materialId: "cardboard",
    bodyTitle: "Burger Box",
    partTitle: "Zip Closure",
    paletteTitle: "Alpine Mint",
    materialTitle: "Cardboard",
    componentSlotId: "closure",
    authoringUrl: "https://game.test/catalog/burger.svg",
    previewUrl: "https://game.test/catalog/burger-preview.svg",
    componentUrl: "https://game.test/catalog/zip.svg",
    componentAnchor: { x: 0.5, y: 0.16 },
    artworkBounds: { x: 0.18, y: 0.32, width: 0.64, height: 0.46 },
    colours: {
      accent: "#43B89C",
      body: "#DFF3E8",
      label: "#FFFDF5",
      trim: "#163A3A"
    },
    ...overrides
  };
}

describe("pilot product economics adapter", () => {
  it("gives every pilot choice a visible dollar cost line", () => {
    const quote = quotePilotProductVariant(variant());

    expect(quote).toMatchObject({
      packId: "product-builder-pilot-v1",
      pricingVersion: 1,
      blueprintId: "food-packaging-burger-box",
      blueprintTitle: "Burger Box",
      unitCostCents: 3_550
    });
    expect(quote?.costLines).toEqual([
      expect.objectContaining({ groupLabel: "Shape", label: "Burger Box", costCents: 2_600 }),
      expect.objectContaining({ groupLabel: "Part", label: "Zip Closure", costCents: 450 }),
      expect.objectContaining({ groupLabel: "Colours", label: "Alpine Mint", costCents: 300 }),
      expect.objectContaining({ groupLabel: "Finish", label: "Cardboard", costCents: 200 })
    ]);
  });

  it("changes the build cost when a production material changes", () => {
    const cardboard = quotePilotProductVariant(variant())!;
    const wood = quotePilotProductVariant(variant({
      materialId: "wood",
      materialTitle: "Wood"
    }))!;

    expect(wood.unitCostCents - cardboard.unitCostCents).toBe(900);
  });

  it("fails closed for an unknown pack or unpriced element", () => {
    expect(quotePilotProductVariant(variant({ packId: "future-pack" }))).toBeNull();
    expect(quotePilotProductVariant(variant({ bodyId: "future-body" }))).toBeNull();
    expect(quotePilotProductVariant(variant({ partId: "future-part" }))).toBeNull();
    expect(quotePilotProductVariant(variant({ materialId: "future-material" }))).toBeNull();
  });
});
