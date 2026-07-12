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
  id,
  version: 1,
  kind: "component",
  title,
  category,
  tags,
  files: {
    thumbnail,
    preview: `/catalog/${id}-640.webp`,
    master: `/catalog/${id}.png`
  },
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
