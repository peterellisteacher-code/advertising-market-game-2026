import {
  quoteProductBuild,
  type ProductBuildQuote,
  type ProductChoiceDefinition,
  type ProductChoiceGroupDefinition,
  type ProductPricingCatalogue
} from "./product-economics";
import type { ResolvedProductVariant } from "./virtual-product-variant";

const PILOT_PACK_ID = "product-builder-pilot-v1";

const BODY_COSTS: Readonly<Record<string, number>> = Object.freeze({
  "bags-backpack": 3_200,
  "bags-carry-bag": 2_800,
  "bags-tote": 2_500,
  "bags-weekender": 3_500,
  "drinkware-classic-can": 2_800,
  "drinkware-slim-can": 2_700,
  "drinkware-sports-bottle": 3_200,
  "drinkware-takeaway-cup": 2_400,
  "food-packaging-burger-box": 2_600,
  "food-packaging-meal-box": 3_000,
  "food-packaging-noodle-tub": 2_700,
  "food-packaging-snack-pouch": 2_500
});

const PART_COSTS: Readonly<Record<string, number>> = Object.freeze({
  "bags-carry-cutout": 250,
  "bags-carry-long-straps": 600,
  "bags-carry-loop": 450,
  "bags-carry-short-straps": 400,
  "drinkware-top-flat": 100,
  "drinkware-top-ring": 200,
  "drinkware-top-spout": 400,
  "drinkware-top-straw": 300,
  "food-packaging-closure-folded": 150,
  "food-packaging-closure-sleeved": 300,
  "food-packaging-closure-tabbed": 250,
  "food-packaging-closure-zip": 450
});

const PALETTE_IDS = new Set([
  "alpine-mint", "apricot-ink", "berry-cream", "cobalt-citrus",
  "coral-navy", "dusk-lilac", "forest-sun", "glacier-blue",
  "grape-lime", "ink-rose", "mango-aqua", "olive-clay",
  "plum-gold", "scarlet-ice", "sky-tangerine", "teal-raspberry"
]);

const MATERIAL_COSTS: Readonly<Record<string, number>> = Object.freeze({
  "brushed-metal": 900,
  cardboard: 200,
  fabric: 800,
  glass: 1_000,
  "gloss-plastic": 600,
  "matte-plastic": 500,
  rubber: 700,
  wood: 1_100
});

const groups = (
  product: ResolvedProductVariant
): readonly ProductChoiceGroupDefinition[] => [{
  id: "shape",
  label: "Shape",
  kind: "base",
  mode: "one",
  minSelections: 1,
  maxSelections: 1,
  choiceIds: [product.bodyId]
}, {
  id: "part",
  label: "Part",
  kind: "part",
  mode: "one",
  minSelections: 1,
  maxSelections: 1,
  choiceIds: [product.partId]
}, {
  id: "colours",
  label: "Colours",
  kind: "finish",
  mode: "one",
  minSelections: 1,
  maxSelections: 1,
  choiceIds: [product.paletteId]
}, {
  id: "finish",
  label: "Finish",
  kind: "material",
  mode: "one",
  minSelections: 1,
  maxSelections: 1,
  choiceIds: [product.materialId]
}];

function choice(
  id: string,
  groupId: string,
  label: string,
  costCents: number,
  blueprintId: string
): ProductChoiceDefinition {
  return {
    id,
    groupId,
    label,
    costCents,
    compatibleBlueprintIds: [blueprintId]
  };
}

export function quotePilotProductVariant(
  product: ResolvedProductVariant
): ProductBuildQuote | null {
  const bodyCost = BODY_COSTS[product.bodyId];
  const partCost = PART_COSTS[product.partId];
  const materialCost = MATERIAL_COSTS[product.materialId];
  if (product.packId !== PILOT_PACK_ID || bodyCost === undefined || partCost === undefined ||
    materialCost === undefined || !PALETTE_IDS.has(product.paletteId)) return null;

  const catalogue: ProductPricingCatalogue = {
    schema: "product-pricing@1",
    packId: PILOT_PACK_ID,
    pricingVersion: 1,
    blueprints: [{
      id: product.bodyId,
      title: product.bodyTitle,
      groupIds: ["shape", "part", "colours", "finish"]
    }],
    groups: groups(product),
    choices: [
      choice(product.bodyId, "shape", product.bodyTitle, bodyCost, product.bodyId),
      choice(product.partId, "part", product.partTitle, partCost, product.bodyId),
      choice(product.paletteId, "colours", product.paletteTitle, 300, product.bodyId),
      choice(product.materialId, "finish", product.materialTitle, materialCost, product.bodyId)
    ]
  };
  return quoteProductBuild(catalogue, {
    blueprintId: product.bodyId,
    selections: [
      { groupId: "shape", choiceIds: [product.bodyId] },
      { groupId: "part", choiceIds: [product.partId] },
      { groupId: "colours", choiceIds: [product.paletteId] },
      { groupId: "finish", choiceIds: [product.materialId] }
    ]
  });
}
