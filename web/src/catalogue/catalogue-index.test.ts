import { expect, it } from "vitest";
import { CatalogueIndex } from "./catalogue-index";
import type { CatalogAssetV1 } from "./catalogue-types";

export const asset = (
  id: string,
  title: string,
  category: string,
  tags: string[],
  thumbnail = `/catalog/${id}-192.webp`
): CatalogAssetV1 => ({
  schema: "catalog-asset@1",
  delivery: "offline",
  id,
  version: 1,
  kind: "component",
  title,
  category,
  tags,
  files: {
    thumbnail,
    preview: `/catalog/generated/offline-core-v1/assets/${id}/preview-640.webp`,
    master: `/catalog/generated/offline-core-v1/assets/${id}/master.png`,
    masks: { body: `/catalog/generated/offline-core-v1/assets/${id}/masks/body.png` }
  },
  masterSha256: "a".repeat(64),
  dimensions: { width: 320, height: 640 },
  recolourZones: ["body"],
  classroomReviewed: true,
  brandFree: true,
  anchors: [],
  materialProfiles: ["matte-plastic"],
  attribution: {
    creator: "Classroom pack",
    sourceUrl: "local",
    license: "classroom-session"
  }
});

it("ranks an exact title match above a tag-only match", () => {
  const index = new CatalogueIndex([
    asset("a", "Solar Backpack", "wearables", ["eco"]),
    asset("b", "Travel Bag", "wearables", ["solar", "backpack"])
  ]);

  expect(index.search("solar backpack").map((record) => record.id)).toEqual(["a", "b"]);
});

it("searches 15000 records without returning more than 100", () => {
  const records = Array.from(
    { length: 15_000 },
    (_, index) => asset(`id-${index}`, `Bottle ${index}`, "drinkware", ["bottle"])
  );

  expect(new CatalogueIndex(records).search("bottle")).toHaveLength(100);
});

it("filters by category before ranking", () => {
  const index = new CatalogueIndex([
    asset("a", "Solar Backpack", "wearables", ["solar"]),
    asset("b", "Solar Bottle", "DrinkWare", ["solar"])
  ]);

  expect(index.search("solar", "DRINKWARE").map((record) => record.id)).toEqual(["b"]);
});

it("ranks starts-with matches and requires every query token", () => {
  const index = new CatalogueIndex([
    asset("a", "Solar Lamp", "home", ["bright"]),
    asset("b", "Desk Lamp", "home", ["solar"]),
    asset("c", "Solar Bottle", "home", ["drinkware"])
  ]);

  expect(index.search("solar").map((record) => record.id)).toEqual(["c", "a", "b"]);
  expect(index.search("solar lamp").map((record) => record.id)).toEqual(["a", "b"]);
});

it("breaks equal title ties by id", () => {
  const index = new CatalogueIndex([
    asset("b", "Bottle", "drinkware", ["bottle"]),
    asset("a", "Bottle", "drinkware", ["bottle"])
  ]);

  expect(index.search("bottle").map((record) => record.id)).toEqual(["a", "b"]);
});

it.each([
  ["fridge", "Refrigerator Shell", "appliances", [], ["fridge", "fridges"]],
  ["refrigerator", "Compact Fridge", "appliances", [], ["refrigerator", "refrigerators"]],
  ["couch", "Modular Sofa", "furniture", [], ["couch", "couches"]],
  ["sofa", "Two-seat Couch", "furniture", [], ["sofa", "sofas"]],
  ["esky", "Picnic Cooler", "outdoors", [], ["esky", "eskies"]],
  ["cooler", "Wheeled Esky", "outdoors", [], ["cooler", "coolers"]],
  ["vehicle", "City Car", "transport", [], ["cars", "vehicle", "vehicles"]],
  ["car", "Utility Vehicle", "transport", [], ["car", "cars"]],
  ["shoes", "Footwear Collection", "fashion", [], ["shoe", "shoes"]],
  ["footwear", "Running Shoes", "fashion", [], ["footwear"]],
  ["fast food", "Takeaway Meal Box", "food", [], ["fast food"]],
  ["takeaway", "Fast Food Carton", "food", [], ["takeaway", "takeaways"]],
  ["pet retail", "Pet Supplies", "retail", [], ["pet shop", "pet store"]],
  ["pet shop", "Pet Store Fixture", "shops", [], ["pet retail"]],
  ["digital product", "Study App", "technology", [], ["digital product", "digital service", "subscription"]],
  ["app", "Digital Service", "technology", [], ["app", "apps", "subscriptions"]],
  ["alcohol", "Wine Bottle", "drinks", [], ["alcohol", "beer", "spirits"]],
  ["beer", "Alcoholic Beverage Can", "drinks", [], ["wine", "spirit"]]
] as const)("matches bounded classroom-language equivalents for %s", (
  id,
  title,
  category,
  tags,
  queries
) => {
  const index = new CatalogueIndex([asset(id, title, category, [...tags])]);

  for (const query of queries) {
    expect(index.search(query).map((record) => record.id), query).toEqual([id]);
  }
});

it("does not turn equivalence terms into substring matches", () => {
  const index = new CatalogueIndex([
    asset("carpet", "Carpet Roll", "home", []),
    asset("apple", "Apple Crate", "food", []),
    asset("twine", "Twine Bundle", "craft", [])
  ]);

  expect(index.search("car")).toEqual([]);
  expect(index.search("app")).toEqual([]);
  expect(index.search("wine")).toEqual([]);
});

it("still requires every normalized query concept", () => {
  const index = new CatalogueIndex([
    asset("cold", "Compact Refrigerator", "appliances", ["steel"]),
    asset("meal", "Takeaway Meal Box", "food", ["cardboard"])
  ]);

  expect(index.search("fridge timber")).toEqual([]);
  expect(index.search("fast food budget")).toEqual([]);
  expect(index.search("refrigerator steel").map((record) => record.id)).toEqual(["cold"]);
});
