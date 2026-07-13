import { describe, expect, it, vi } from "vitest";
import {
  loadProductShellCatalogue,
  parseProductShellCatalogue
} from "./product-shell-catalogue";

const FAMILIES = [
  ["beauty-care", "Beauty & Care"],
  ["drinks-snacks", "Drinks & Snacks"],
  ["fashion-footwear", "Fashion & Footwear"],
  ["fast-food-hospitality", "Fast Food & Hospitality"],
  ["home-lifestyle", "Home & Lifestyle"],
  ["pets-animals", "Pets & Animals"],
  ["shops-services", "Shops & Services"],
  ["sport-outdoors", "Sport & Outdoors"],
  ["tech-gadgets", "Tech & Gadgets"],
  ["travel-transport", "Travel & Transport"]
] as const;

function fixture(): Record<string, unknown> {
  const shells = FAMILIES.flatMap(([family]) => Array.from({ length: 6 }, (_, index) => {
    const id = `${family}-shell-${index + 1}`;
    return {
      id,
      title: `${family} shell ${index + 1}`,
      family,
      template: "panel",
      authoringSvg: `shells/${id}/authoring.svg`,
      previewSvg: `shells/${id}/preview.svg`,
      regions: ["body", "accent"],
      printAreas: [{ id: "front", x: 0.2, y: 0.2, width: 0.6, height: 0.6, safeInset: 0.03 }],
      partSlots: [{ id: "feature", accepts: ["badge", "handle"] }],
      preview: { kind: "soft-2.5d", highlight: 0.16, shadow: 0.18 },
      classroomReviewed: true,
      brandFree: true
    };
  }));
  return {
    schema: "product-shell-catalog@1",
    version: 1,
    packId: "product-shells-v1",
    families: FAMILIES.map(([id, title]) => ({ id, title })),
    shells
  };
}

describe("product-shell catalogue", () => {
  it("resolves a reviewed ten-family catalogue to same-origin SVG URLs", () => {
    const parsed = parseProductShellCatalogue(
      fixture(),
      "https://classroom.test/catalog/generated/product-shells-v1/catalog.json"
    );

    expect(parsed?.families).toHaveLength(10);
    expect(parsed?.shells).toHaveLength(60);
    expect(parsed?.shells[0]).toMatchObject({
      authoringUrl: expect.stringMatching(/^https:\/\/classroom\.test\/catalog\/generated\/product-shells-v1\/shells\//),
      previewUrl: expect.stringMatching(/^https:\/\/classroom\.test\/catalog\/generated\/product-shells-v1\/shells\//),
      regions: ["body", "accent"]
    });
  });

  it("rejects duplicate IDs and external or traversing shell paths", () => {
    const duplicate = fixture();
    const duplicateShells = duplicate.shells as Array<Record<string, unknown>>;
    duplicateShells[1]!.id = duplicateShells[0]!.id;
    expect(parseProductShellCatalogue(duplicate, "https://classroom.test/catalog.json"))
      .toBeNull();

    const external = fixture();
    (external.shells as Array<Record<string, unknown>>)[0]!.authoringSvg =
      "https://unsafe.example/product.svg";
    expect(parseProductShellCatalogue(external, "https://classroom.test/catalog.json"))
      .toBeNull();

    const traversal = fixture();
    (traversal.shells as Array<Record<string, unknown>>)[0]!.previewSvg =
      "shells/../unsafe.svg";
    expect(parseProductShellCatalogue(traversal, "https://classroom.test/catalog.json"))
      .toBeNull();
  });

  it("loads only a same-origin catalogue URL and fails closed", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(fixture()), {
      status: 200,
      headers: { "content-type": "application/json" }
    }));

    const loaded = await loadProductShellCatalogue(
      "/catalog/generated/product-shells-v1/catalog.json",
      { fetch: fetcher }
    );
    expect(loaded?.shells).toHaveLength(60);
    expect(fetcher).toHaveBeenCalledOnce();

    expect(await loadProductShellCatalogue(
      "https://unsafe.example/catalog.json",
      { fetch: fetcher }
    )).toBeNull();
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
