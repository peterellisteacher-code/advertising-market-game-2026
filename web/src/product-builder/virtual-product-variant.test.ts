import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseProductBuilderCatalogue,
  type ProductBuilderCatalogue
} from "./product-builder-catalogue";
import {
  MAX_VARIANT_PAGE_SIZE,
  createVirtualProductVariantResolver
} from "./virtual-product-variant";

const CATALOGUE_URL =
  "https://classroom.test/catalog/generated/product-builder-pilot-v1/catalogue.json";
const RAW_CATALOGUE = readFileSync(
  resolve("catalog/generated/product-builder-pilot-v1/catalogue.json"),
  "utf8"
);

function catalogue(): ProductBuilderCatalogue {
  const parsed = parseProductBuilderCatalogue(JSON.parse(RAW_CATALOGUE), CATALOGUE_URL);
  if (!parsed) throw new Error("Test fixture did not satisfy the product-builder contract");
  return parsed;
}

describe("virtual product variant resolver", () => {
  it("resolves a canonical, deeply frozen record with local URLs", () => {
    const resolver = createVirtualProductVariantResolver(catalogue());
    const variant = resolver.resolveVariant({
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-ring",
      paletteId: "cobalt-citrus",
      materialId: "brushed-metal"
    });

    expect(variant).toMatchObject({
      schema: "product-builder-variant@1",
      id: "product-builder-variant@1:product-builder-pilot-v1:drinkware-classic-can:drinkware-top-ring:cobalt-citrus:brushed-metal",
      packId: "product-builder-pilot-v1",
      familyId: "drinkware",
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-ring",
      paletteId: "cobalt-citrus",
      materialId: "brushed-metal",
      authoringUrl:
        "https://classroom.test/catalog/generated/product-builder-pilot-v1/bodies/drinkware-classic-can/authoring.svg",
      previewUrl:
        "https://classroom.test/catalog/generated/product-builder-pilot-v1/bodies/drinkware-classic-can/preview.svg",
      componentUrl:
        "https://classroom.test/catalog/generated/product-builder-pilot-v1/components/drinkware-top-ring.svg"
    });
    expect(Object.isFrozen(variant)).toBe(true);
    expect(Object.isFrozen(variant?.colours)).toBe(true);
    expect(Object.isFrozen(variant?.componentAnchor)).toBe(true);
    expect(Object.isFrozen(variant?.artworkBounds)).toBe(true);
  });

  it("rejects unknown, incompatible and non-canonical selections", () => {
    const resolver = createVirtualProductVariantResolver(catalogue());
    expect(resolver.resolveVariant({
      bodyId: "drinkware-classic-can",
      partId: "bags-carry-loop",
      paletteId: "cobalt-citrus",
      materialId: "brushed-metal"
    })).toBeNull();
    expect(resolver.resolveVariant({
      bodyId: "unknown-body",
      partId: "drinkware-top-ring",
      paletteId: "cobalt-citrus",
      materialId: "brushed-metal"
    })).toBeNull();
    expect(resolver.resolveVariant({
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-ring",
      paletteId: "unknown-palette",
      materialId: "brushed-metal"
    })).toBeNull();
    expect(resolver.resolveVariant({
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-ring",
      paletteId: "cobalt-citrus",
      materialId: "unknown-material"
    })).toBeNull();
  });

  it("counts all variants and stable intersections without enumerating them", () => {
    const resolver = createVirtualProductVariantResolver(catalogue());

    expect(resolver.countVariants()).toBe(6_144);
    expect(resolver.countVariants({ familyId: "bags" })).toBe(2_048);
    expect(resolver.countVariants({ bodyId: "bags-backpack" })).toBe(512);
    expect(resolver.countVariants({ partId: "bags-carry-loop" })).toBe(512);
    expect(resolver.countVariants({ bodyId: "bags-backpack", partId: "bags-carry-loop" })).toBe(128);
    expect(resolver.countVariants({ paletteId: "alpine-mint" })).toBe(384);
    expect(resolver.countVariants({ materialId: "brushed-metal" })).toBe(768);
    expect(resolver.countVariants({ familyId: "drinkware", partId: "bags-carry-loop" })).toBe(0);
    expect(resolver.countVariants({ familyId: "unknown" })).toBe(0);
  });

  it("pages in canonical body-part-palette-material order with stable filters", () => {
    const resolver = createVirtualProductVariantResolver(catalogue());
    const first = resolver.pageVariants({}, { offset: 0, limit: 10 });

    expect(first.total).toBe(6_144);
    expect(first.offset).toBe(0);
    expect(first.items).toHaveLength(10);
    expect(first.items.slice(0, 3).map(({ id }) => id)).toEqual([
      "product-builder-variant@1:product-builder-pilot-v1:bags-backpack:bags-carry-cutout:alpine-mint:brushed-metal",
      "product-builder-variant@1:product-builder-pilot-v1:bags-backpack:bags-carry-cutout:alpine-mint:cardboard",
      "product-builder-variant@1:product-builder-pilot-v1:bags-backpack:bags-carry-cutout:alpine-mint:fabric"
    ]);

    const filtered = resolver.pageVariants(
      { familyId: "drinkware", paletteId: "cobalt-citrus" },
      { offset: 5, limit: 7 }
    );
    expect(filtered.total).toBe(128);
    expect(filtered.items).toHaveLength(7);
    expect(filtered.items.every((item) =>
      item.familyId === "drinkware" && item.paletteId === "cobalt-citrus"
    )).toBe(true);
    expect(resolver.pageVariants(
      { familyId: "drinkware", paletteId: "cobalt-citrus" },
      { offset: 5, limit: 7 }
    )).toEqual(filtered);
  });

  it("caps every page and exposes no materialized 6,144-entry collection", () => {
    const resolver = createVirtualProductVariantResolver(catalogue());
    const page = resolver.pageVariants({}, { offset: 0, limit: 6_144 });
    const last = resolver.pageVariants({}, { offset: 6_140, limit: 20 });

    expect(page.items).toHaveLength(MAX_VARIANT_PAGE_SIZE);
    expect(last.items).toHaveLength(4);
    expect(last.items.at(-1)?.id).toBe(
      "product-builder-variant@1:product-builder-pilot-v1:food-packaging-snack-pouch:food-packaging-closure-zip:teal-raspberry:wood"
    );
    expect(Reflect.ownKeys(resolver).sort()).toEqual([
      "countVariants",
      "pageVariants",
      "resolveVariant"
    ]);
    expect(Object.values(resolver).some(Array.isArray)).toBe(false);
    expect(Object.isFrozen(page)).toBe(true);
    expect(Object.isFrozen(page.items)).toBe(true);
  });

  it("builds bounded indices once instead of rereading catalogue collections", () => {
    const source = catalogue();
    const reads = new Map<PropertyKey, number>();
    const observed = new Proxy(source, {
      get(target, key, receiver) {
        if (["families", "bodies", "parts", "palettes", "materials"].includes(String(key))) {
          reads.set(key, (reads.get(key) ?? 0) + 1);
        }
        return Reflect.get(target, key, receiver);
      }
    });
    const resolver = createVirtualProductVariantResolver(observed);
    const afterCreation = new Map(reads);

    resolver.countVariants({ familyId: "bags" });
    resolver.resolveVariant({
      bodyId: "bags-tote",
      partId: "bags-carry-loop",
      paletteId: "alpine-mint",
      materialId: "fabric"
    });
    resolver.pageVariants({ familyId: "food-packaging" }, { offset: 100, limit: 6 });

    expect(reads).toEqual(afterCreation);
  });

  it("normalizes invalid page requests to a bounded frozen empty or first page", () => {
    const resolver = createVirtualProductVariantResolver(catalogue());
    const empty = resolver.pageVariants({ familyId: "unknown" }, { offset: 0, limit: 20 });
    expect(empty).toEqual({ offset: 0, limit: 20, total: 0, items: [] });
    expect(Object.isFrozen(empty.items)).toBe(true);

    const bounded = resolver.pageVariants({}, { offset: -12.4, limit: Number.POSITIVE_INFINITY });
    expect(bounded.offset).toBe(0);
    expect(bounded.limit).toBe(MAX_VARIANT_PAGE_SIZE);
    expect(bounded.items).toHaveLength(MAX_VARIANT_PAGE_SIZE);
  });

  it.each([
    null,
    [],
    { offset: 0, limit: 12, extra: true }
  ])("fails closed without throwing for malformed page request %#", (page) => {
    const resolver = createVirtualProductVariantResolver(catalogue());

    expect(resolver.pageVariants({}, page as never)).toEqual({
      offset: 0,
      limit: MAX_VARIANT_PAGE_SIZE,
      total: 0,
      items: []
    });
  });
});
