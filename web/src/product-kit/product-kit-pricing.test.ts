import { describe, expect, it } from "vitest";
import PRODUCT_KIT_SIDECAR from "../../../catalog/generated/offline-core-v1/product-kit-v1.json";
import PRODUCT_KIT_PRICING_SIDECAR from "../../../catalog/generated/offline-core-v1/product-kit-pricing-v1.json";
import {
  parseProductKitCatalogue,
  type ProductKitCatalogue
} from "./product-kit-catalogue";
import { parseProductKitPricing } from "./product-kit-pricing";

const CATALOG_HASH =
  "6199fd1adae59a2b517b265ca67a325f32faba04d375852821e841b51a354073";
const BASE_ID = "89-beverage-container-bases-r03c05";
const LID_ID = "90-beverage-container-add-ons-r04c01";
const TV_ID = "95-appliance-bases-r05c02";
const TV_PEDESTAL_ID = "96-appliance-add-ons-r05c01";
const TV_FEET_ID = "96-appliance-add-ons-r05c02";
const CASE_ID = "97-bag-carry-product-bases-r01c05";
const CASE_ARCHED_HANDLE_ID = "98-bag-carry-product-add-ons-r01c03";
const CASE_COMPACT_HANDLE_ID = "98-bag-carry-product-add-ons-r01c05";

function parsedCatalogue(): ProductKitCatalogue {
  const parsed = parseProductKitCatalogue(PRODUCT_KIT_SIDECAR, {
    catalogPackId: "offline-core-v1",
    catalogSha256: CATALOG_HASH,
    records: [
      {
        id: BASE_ID,
        masterSha256:
          "d87a3718df6bd9a00e667a8c50729c3c84a3bd33bfe395df86b9992f49eb7abf",
        delivery: "offline",
        kind: "raster-master",
        files: {
          master: `/catalog/generated/offline-core-v1/assets/${BASE_ID}/master.png`
        },
        dimensions: { width: 146, height: 238 },
        classroomReviewed: true,
        brandFree: true
      },
      {
        id: LID_ID,
        masterSha256:
          "6156af7416af78a8bb53a93c540ff2745caa77140f808213227487985e3580a5",
        delivery: "offline",
        kind: "component",
        files: {
          master: `/catalog/generated/offline-core-v1/assets/${LID_ID}/master.png`
        },
        dimensions: { width: 233, height: 164 },
        classroomReviewed: true,
        brandFree: true
      },
      {
        id: TV_ID,
        masterSha256:
          "3ad0846f80e918edcfea13b24deabd8413206d4ada4dc4e63c1751eb2728888f",
        delivery: "offline",
        kind: "raster-master",
        files: {
          master: `/catalog/generated/offline-core-v1/assets/${TV_ID}/master.png`
        },
        dimensions: { width: 237, height: 168 },
        classroomReviewed: true,
        brandFree: true
      },
      {
        id: TV_PEDESTAL_ID,
        masterSha256:
          "b9c6131f758d1d21a8923a3b9ae7137244d5154d8b15b45b73b64aae0faa0092",
        delivery: "offline",
        kind: "component",
        files: {
          master: `/catalog/generated/offline-core-v1/assets/${TV_PEDESTAL_ID}/master.png`
        },
        dimensions: { width: 259, height: 210 },
        classroomReviewed: true,
        brandFree: true
      },
      {
        id: TV_FEET_ID,
        masterSha256:
          "00cd19f387de624370a6d014519343a241f00e36ab97a556906b0585cef674cf",
        delivery: "offline",
        kind: "component",
        files: {
          master: `/catalog/generated/offline-core-v1/assets/${TV_FEET_ID}/master.png`
        },
        dimensions: { width: 237, height: 209 },
        classroomReviewed: true,
        brandFree: true
      },
      {
        id: CASE_ID,
        masterSha256:
          "9f6f833af3a39e36734945ff9505ad6986aa09879bb756248209b74fc4c41dc9",
        delivery: "offline",
        kind: "raster-master",
        files: {
          master: `/catalog/generated/offline-core-v1/assets/${CASE_ID}/master.png`
        },
        dimensions: { width: 189, height: 159 },
        classroomReviewed: true,
        brandFree: true
      },
      {
        id: CASE_ARCHED_HANDLE_ID,
        masterSha256:
          "103a9baf051d3ff8a23f3dd8ff5abbbf80d34c2f57d4bca647b576b4364e1ce9",
        delivery: "offline",
        kind: "component",
        files: {
          master: `/catalog/generated/offline-core-v1/assets/${CASE_ARCHED_HANDLE_ID}/master.png`
        },
        dimensions: { width: 226, height: 211 },
        classroomReviewed: true,
        brandFree: true
      },
      {
        id: CASE_COMPACT_HANDLE_ID,
        masterSha256:
          "10fc7b6c5a7b4a177cd1bb00c3a67b1fb5ee5644c438216085ce86098e109d7e",
        delivery: "offline",
        kind: "component",
        files: {
          master: `/catalog/generated/offline-core-v1/assets/${CASE_COMPACT_HANDLE_ID}/master.png`
        },
        dimensions: { width: 262, height: 135 },
        classroomReviewed: true,
        brandFree: true
      }
    ]
  });
  if (!parsed) throw new Error("The checked-in pilot fixture must be valid");
  return parsed;
}

interface MutablePricingPayload {
  schema: string;
  packId: string;
  blueprints: Array<{ id: string; title: string; groupIds: string[] }>;
  groups: Array<{
    id: string;
    label: string;
    kind: string;
    mode: "one" | "many";
    minSelections: number;
    maxSelections: number;
    choiceIds: string[];
  }>;
  choices: Array<{
    id: string;
    groupId: string;
    label: string;
    costCents: number;
    compatibleBlueprintIds: string[];
  }>;
  [key: string]: unknown;
}

function pricingPayload(): MutablePricingPayload {
  return structuredClone(PRODUCT_KIT_PRICING_SIDECAR) as unknown as MutablePricingPayload;
}

describe("parseProductKitPricing", () => {
  it("indexes every required logical price and blueprint title", () => {
    const parsed = parseProductKitPricing(
      PRODUCT_KIT_PRICING_SIDECAR,
      parsedCatalogue()
    );

    expect(parsed).toMatchObject({
      packId: "pk1-pilot-drinkware",
      pricingVersion: 1
    });
    expect([...parsed!.blueprintTitleByKitId]).toEqual([
      ["pk1-tumbler-kit", "Reusable tumbler"],
      ["pk1-tv-kit", "Flat-screen television"],
      ["pk1-utility-case-kit", "Compact carry case"]
    ]);
    expect([...parsed!.byPriceAssetId]).toEqual([
      ["pk1-price-tumbler", {
        priceAssetId: "pk1-price-tumbler",
        groupId: "pk1-tumbler-base-group",
        groupLabel: "Product body",
        kind: "base",
        label: "Product body",
        costCents: 480
      }],
      ["pk1-price-flat-lid", {
        priceAssetId: "pk1-price-flat-lid",
        groupId: "pk1-tumbler-lid-group",
        groupLabel: "Lid",
        kind: "part",
        label: "Flat lid",
        costCents: 70
      }],
      ["pk1-price-tv", {
        priceAssetId: "pk1-price-tv",
        groupId: "pk1-tv-base-group",
        groupLabel: "Product body",
        kind: "base",
        label: "Television body",
        costCents: 3700
      }],
      ["pk1-price-tv-angled-feet", {
        priceAssetId: "pk1-price-tv-angled-feet",
        groupId: "pk1-tv-stand-group",
        groupLabel: "Stand",
        kind: "part",
        label: "Angled feet",
        costCents: 650
      }],
      ["pk1-price-tv-centre-pedestal", {
        priceAssetId: "pk1-price-tv-centre-pedestal",
        groupId: "pk1-tv-stand-group",
        groupLabel: "Stand",
        kind: "part",
        label: "Centre pedestal stand",
        costCents: 650
      }],
      ["pk1-price-utility-case", {
        priceAssetId: "pk1-price-utility-case",
        groupId: "pk1-utility-case-base-group",
        groupLabel: "Product body",
        kind: "base",
        label: "Carry case body",
        costCents: 2400
      }],
      ["pk1-price-utility-case-arched-handle", {
        priceAssetId: "pk1-price-utility-case-arched-handle",
        groupId: "pk1-utility-case-handle-group",
        groupLabel: "Handle",
        kind: "part",
        label: "Rigid arched handle",
        costCents: 450
      }],
      ["pk1-price-utility-case-compact-handle", {
        priceAssetId: "pk1-price-utility-case-compact-handle",
        groupId: "pk1-utility-case-handle-group",
        groupLabel: "Handle",
        kind: "part",
        label: "Compact grab handle",
        costCents: 450
      }]
    ]);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed!.blueprintTitleByKitId)).toBe(true);
    expect(Object.isFrozen(parsed!.byPriceAssetId)).toBe(true);
    expect([...parsed!.byPriceAssetId.values()].every(Object.isFrozen)).toBe(true);
    expect(() => (parsed!.blueprintTitleByKitId as Map<string, string>).clear())
      .toThrow(TypeError);
    expect(() => (parsed!.byPriceAssetId as Map<string, unknown>).clear())
      .toThrow(TypeError);
  });

  it.each([
    ["wrong schema", (value: MutablePricingPayload) => {
      value.schema = "product-pricing@2";
    }],
    ["wrong pack", (value: MutablePricingPayload) => {
      value.packId = "pk1-another-pack";
    }],
    ["extra root key", (value: MutablePricingPayload) => {
      value.unexpected = true;
    }],
    ["missing logical price identity", (value: MutablePricingPayload) => {
      value.choices[0]!.id = "pk1-price-other-body";
      value.groups[0]!.choiceIds = ["pk1-price-other-body"];
    }],
    ["referenced identity omitted from its group's choices", (
      value: MutablePricingPayload
    ) => {
      value.choices.push({
        ...structuredClone(value.choices[0]!),
        id: "pk1-price-other-body"
      });
      value.groups[0]!.choiceIds = ["pk1-price-other-body"];
    }],
    ["unused orphan choice omitted from its declared group", (
      value: MutablePricingPayload
    ) => {
      value.choices.push({
        ...structuredClone(value.choices[0]!),
        id: "pk1-price-unused-body"
      });
    }],
    ["duplicate logical price identity", (value: MutablePricingPayload) => {
      value.choices.push(structuredClone(value.choices[0]!));
    }],
    ["price group outside the kit blueprint", (value: MutablePricingPayload) => {
      value.blueprints[0]!.groupIds = ["pk1-tumbler-base-group"];
    }],
    ["incompatible kit choice", (value: MutablePricingPayload) => {
      value.choices[1]!.compatibleBlueprintIds = ["pk1-another-kit"];
    }],
    ["extra blueprint", (value: MutablePricingPayload) => {
      value.blueprints.push({
        id: "pk1-extra-kit",
        title: "Extra kit",
        groupIds: ["pk1-tumbler-base-group"]
      });
      value.choices[0]!.compatibleBlueprintIds.push("pk1-extra-kit");
    }],
    ["blueprint title mismatch", (value: MutablePricingPayload) => {
      value.blueprints[0]!.title = "Different tumbler";
    }],
    ["extra group and exported choice", (value: MutablePricingPayload) => {
      value.groups.push({
        id: "pk1-extra-group",
        label: "Extra",
        kind: "part",
        mode: "one",
        minSelections: 1,
        maxSelections: 1,
        choiceIds: ["pk1-price-extra"]
      });
      value.choices.push({
        id: "pk1-price-extra",
        groupId: "pk1-extra-group",
        label: "Extra",
        costCents: 10,
        compatibleBlueprintIds: ["pk1-tumbler-kit"]
      });
      value.blueprints[0]!.groupIds.push("pk1-extra-group");
    }],
    ["extra exported choice in a required group", (value: MutablePricingPayload) => {
      value.choices.push({
        ...structuredClone(value.choices[1]!),
        id: "pk1-price-extra-lid"
      });
      value.groups[1]!.choiceIds.push("pk1-price-extra-lid");
    }],
    ["base price assigned the part role", (value: MutablePricingPayload) => {
      value.groups[0]!.kind = "part";
      value.groups[1]!.kind = "base";
    }],
    ["component price assigned a non-part role", (value: MutablePricingPayload) => {
      value.groups[1]!.kind = "feature";
    }],
    ["invalid cost", (value: MutablePricingPayload) => {
      value.choices[0]!.costCents = -1;
    }]
  ] as const)("fails closed for %s", (_label, mutate) => {
    const value = pricingPayload();
    mutate(value);
    expect(parseProductKitPricing(value, parsedCatalogue())).toBeNull();
  });

  it("returns null rather than inspecting hostile input", () => {
    const hostile = new Proxy({}, {
      ownKeys() {
        throw new Error("do not inspect me");
      }
    });

    expect(() => parseProductKitPricing(hostile, parsedCatalogue())).not.toThrow();
    expect(parseProductKitPricing(hostile, parsedCatalogue())).toBeNull();
  });
});
