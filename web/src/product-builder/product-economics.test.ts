import { describe, expect, it } from "vitest";
import {
  createProductBuildSnapshot,
  marginAtPrice,
  quoteProductBuild,
  type ProductPricingCatalogue
} from "./product-economics";

const catalogue: ProductPricingCatalogue = {
  schema: "product-pricing@1",
  packId: "durable-goods-v1",
  pricingVersion: 1,
  blueprints: [{
    id: "fridge",
    title: "Refrigerator",
    groupIds: ["body", "capacity", "finish", "features"]
  }, {
    id: "esky",
    title: "Esky",
    groupIds: ["cooler-body", "cooler-capacity"]
  }],
  groups: [{
    id: "body",
    label: "Door layout",
    kind: "base",
    mode: "one",
    minSelections: 1,
    maxSelections: 1,
    choiceIds: ["single-door", "french-door"]
  }, {
    id: "capacity",
    label: "Capacity",
    kind: "capacity",
    mode: "one",
    minSelections: 1,
    maxSelections: 1,
    choiceIds: ["capacity-300", "capacity-450"]
  }, {
    id: "finish",
    label: "Finish",
    kind: "finish",
    mode: "one",
    minSelections: 1,
    maxSelections: 1,
    choiceIds: ["white-finish", "steel-finish"]
  }, {
    id: "features",
    label: "Features",
    kind: "feature",
    mode: "many",
    minSelections: 0,
    maxSelections: 2,
    choiceIds: ["water-dispenser", "smart-screen"]
  }, {
    id: "cooler-body",
    label: "Body",
    kind: "base",
    mode: "one",
    minSelections: 1,
    maxSelections: 1,
    choiceIds: ["hard-cooler"]
  }, {
    id: "cooler-capacity",
    label: "Capacity",
    kind: "capacity",
    mode: "one",
    minSelections: 1,
    maxSelections: 1,
    choiceIds: ["cooler-20"]
  }],
  choices: [{
    id: "single-door",
    groupId: "body",
    label: "Single door",
    costCents: 2_500,
    compatibleBlueprintIds: ["fridge"]
  }, {
    id: "french-door",
    groupId: "body",
    label: "French doors",
    costCents: 3_300,
    compatibleBlueprintIds: ["fridge"]
  }, {
    id: "capacity-300",
    groupId: "capacity",
    label: "300 L",
    costCents: 500,
    compatibleBlueprintIds: ["fridge"]
  }, {
    id: "capacity-450",
    groupId: "capacity",
    label: "450 L",
    costCents: 1_200,
    compatibleBlueprintIds: ["fridge"]
  }, {
    id: "white-finish",
    groupId: "finish",
    label: "White finish",
    costCents: 0,
    compatibleBlueprintIds: ["fridge"]
  }, {
    id: "steel-finish",
    groupId: "finish",
    label: "Steel finish",
    costCents: 900,
    compatibleBlueprintIds: ["fridge"]
  }, {
    id: "water-dispenser",
    groupId: "features",
    label: "Water dispenser",
    costCents: 600,
    compatibleBlueprintIds: ["fridge"],
    requiresChoiceIds: ["french-door"]
  }, {
    id: "smart-screen",
    groupId: "features",
    label: "Smart screen",
    costCents: 800,
    compatibleBlueprintIds: ["fridge"],
    excludesChoiceIds: ["white-finish"]
  }, {
    id: "hard-cooler",
    groupId: "cooler-body",
    label: "Hard cooler",
    costCents: 2_000,
    compatibleBlueprintIds: ["esky"]
  }, {
    id: "cooler-20",
    groupId: "cooler-capacity",
    label: "20 L",
    costCents: 700,
    compatibleBlueprintIds: ["esky"]
  }]
};

describe("product economics", () => {
  it("prices every selected element in catalogue order and suggests a playable price", () => {
    const quote = quoteProductBuild(catalogue, {
      blueprintId: "fridge",
      selections: [{ groupId: "features", choiceIds: ["smart-screen", "water-dispenser"] },
        { groupId: "finish", choiceIds: ["steel-finish"] },
        { groupId: "body", choiceIds: ["french-door"] },
        { groupId: "capacity", choiceIds: ["capacity-450"] }]
    });

    expect(quote).toMatchObject({
      blueprintId: "fridge",
      blueprintTitle: "Refrigerator",
      unitCostCents: 6_800,
      suggestedPrice: { minimumCents: 8_200, maximumCents: 12_300 }
    });
    expect(quote?.selections).toEqual([
      { groupId: "body", choiceIds: ["french-door"] },
      { groupId: "capacity", choiceIds: ["capacity-450"] },
      { groupId: "finish", choiceIds: ["steel-finish"] },
      { groupId: "features", choiceIds: ["water-dispenser", "smart-screen"] }
    ]);
    expect(quote?.costLines.map(({ label, costCents }) => [label, costCents])).toEqual([
      ["French doors", 3_300],
      ["450 L", 1_200],
      ["Steel finish", 900],
      ["Water dispenser", 600],
      ["Smart screen", 800]
    ]);
  });

  it("keeps an explicit zero-cost included choice in the ledger", () => {
    const quote = quoteProductBuild(catalogue, {
      blueprintId: "fridge",
      selections: [
        { groupId: "body", choiceIds: ["single-door"] },
        { groupId: "capacity", choiceIds: ["capacity-300"] },
        { groupId: "finish", choiceIds: ["white-finish"] },
        { groupId: "features", choiceIds: [] }
      ]
    });

    expect(quote?.costLines).toContainEqual(expect.objectContaining({
      choiceId: "white-finish",
      costCents: 0
    }));
    expect(quote?.unitCostCents).toBe(3_000);
  });

  it.each([
    ["missing group", [{ groupId: "body", choiceIds: ["single-door"] }]],
    ["wrong group", [
      { groupId: "body", choiceIds: ["capacity-300"] },
      { groupId: "capacity", choiceIds: ["capacity-300"] },
      { groupId: "finish", choiceIds: ["white-finish"] },
      { groupId: "features", choiceIds: [] }
    ]],
    ["duplicate choice", [
      { groupId: "body", choiceIds: ["single-door"] },
      { groupId: "capacity", choiceIds: ["capacity-300"] },
      { groupId: "finish", choiceIds: ["white-finish"] },
      { groupId: "features", choiceIds: ["smart-screen", "smart-screen"] }
    ]],
    ["too many choices", [
      { groupId: "body", choiceIds: ["single-door"] },
      { groupId: "capacity", choiceIds: ["capacity-300"] },
      { groupId: "finish", choiceIds: ["white-finish"] },
      { groupId: "features", choiceIds: ["water-dispenser", "smart-screen", "other"] }
    ]]
  ])("rejects an incomplete or malformed build: %s", (_label, selections) => {
    expect(quoteProductBuild(catalogue, { blueprintId: "fridge", selections })).toBeNull();
  });

  it("enforces requirements, exclusions, and blueprint compatibility", () => {
    const missingRequirement = quoteProductBuild(catalogue, {
      blueprintId: "fridge",
      selections: [
        { groupId: "body", choiceIds: ["single-door"] },
        { groupId: "capacity", choiceIds: ["capacity-300"] },
        { groupId: "finish", choiceIds: ["steel-finish"] },
        { groupId: "features", choiceIds: ["water-dispenser"] }
      ]
    });
    const excluded = quoteProductBuild(catalogue, {
      blueprintId: "fridge",
      selections: [
        { groupId: "body", choiceIds: ["french-door"] },
        { groupId: "capacity", choiceIds: ["capacity-450"] },
        { groupId: "finish", choiceIds: ["white-finish"] },
        { groupId: "features", choiceIds: ["smart-screen"] }
      ]
    });
    const crossBlueprint = quoteProductBuild(catalogue, {
      blueprintId: "fridge",
      selections: [
        { groupId: "body", choiceIds: ["hard-cooler"] },
        { groupId: "capacity", choiceIds: ["capacity-300"] },
        { groupId: "finish", choiceIds: ["steel-finish"] },
        { groupId: "features", choiceIds: [] }
      ]
    });

    expect(missingRequirement).toBeNull();
    expect(excluded).toBeNull();
    expect(crossBlueprint).toBeNull();
  });

  it("freezes one primary build and reports profit or loss at the chosen price", () => {
    const quote = quoteProductBuild(catalogue, {
      blueprintId: "esky",
      selections: [
        { groupId: "cooler-body", choiceIds: ["hard-cooler"] },
        { groupId: "cooler-capacity", choiceIds: ["cooler-20"] }
      ]
    })!;
    const snapshot = createProductBuildSnapshot(quote, "product-object-7");

    expect(snapshot).toMatchObject({
      schema: "product-build@1",
      primaryObjectId: "product-object-7",
      packId: "durable-goods-v1",
      pricingVersion: 1,
      blueprintId: "esky",
      unitCostCents: 2_700
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(marginAtPrice(quote, 4_000)).toEqual({
      priceCents: 4_000,
      unitCostCents: 2_700,
      marginCents: 1_300
    });
    expect(marginAtPrice(quote, 2_000)?.marginCents).toBe(-700);
    expect(marginAtPrice(quote, -1)).toBeNull();
  });

  it("treats cost as an uncapped strategy signal for high-value products", () => {
    const highValueCatalogue: ProductPricingCatalogue = {
      schema: "product-pricing@1",
      packId: "high-value-products-v1",
      pricingVersion: 1,
      blueprints: [{ id: "house", title: "House", groupIds: ["house-body", "house-features"] }],
      groups: [{
        id: "house-body",
        label: "House",
        kind: "base",
        mode: "one",
        minSelections: 1,
        maxSelections: 1,
        choiceIds: ["courtyard-house"]
      }, {
        id: "house-features",
        label: "Features",
        kind: "feature",
        mode: "many",
        minSelections: 1,
        maxSelections: 1,
        choiceIds: ["solar-patio"]
      }],
      choices: [{
        id: "courtyard-house",
        groupId: "house-body",
        label: "Courtyard house",
        costCents: 25_000_000,
        compatibleBlueprintIds: ["house"]
      }, {
        id: "solar-patio",
        groupId: "house-features",
        label: "Solar patio",
        costCents: 7_500_000,
        compatibleBlueprintIds: ["house"]
      }]
    };

    const quote = quoteProductBuild(highValueCatalogue, {
      blueprintId: "house",
      selections: [
        { groupId: "house-body", choiceIds: ["courtyard-house"] },
        { groupId: "house-features", choiceIds: ["solar-patio"] }
      ]
    });

    expect(quote).toMatchObject({
      unitCostCents: 32_500_000,
      suggestedPrice: { minimumCents: 39_000_000, maximumCents: 58_500_000 }
    });
    expect(marginAtPrice(quote!, 50_000_000)?.marginCents).toBe(17_500_000);
  });

  it("rejects malformed catalogues instead of trusting duplicate IDs or invented costs", () => {
    expect(quoteProductBuild({
      ...catalogue,
      choices: [...catalogue.choices, { ...catalogue.choices[0]! }]
    }, {
      blueprintId: "fridge",
      selections: []
    })).toBeNull();
    expect(quoteProductBuild({
      ...catalogue,
      choices: catalogue.choices.map((choice, index) => index === 0
        ? { ...choice, costCents: 1.5 }
        : choice)
    }, {
      blueprintId: "fridge",
      selections: []
    })).toBeNull();
  });
});
