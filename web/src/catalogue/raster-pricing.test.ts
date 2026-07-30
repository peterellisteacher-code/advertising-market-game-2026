import { describe, expect, it, vi } from "vitest";
import type { CatalogAssetV1 } from "./catalogue-types";
import { loadRasterPricing, parseRasterPricing } from "./raster-pricing";

const asset = (id: string, kind: "raster-master" | "component", typeTag: string): CatalogAssetV1 => ({
  schema: "catalog-asset@1",
  delivery: "offline",
  id,
  version: 1,
  kind,
  title: id,
  category: "classroom-products",
  tags: [typeTag],
  files: {
    thumbnail: `/catalog/generated/offline-core-v1/assets/${id}/thumbnail-192.webp`,
    preview: `/catalog/generated/offline-core-v1/assets/${id}/preview-640.webp`,
    master: `/catalog/generated/offline-core-v1/assets/${id}/master.png`,
    masks: { body: `/catalog/generated/offline-core-v1/assets/${id}/masks/body.png` }
  },
  masterSha256: "a".repeat(64),
  dimensions: { width: 240, height: 240 },
  recolourZones: ["body"],
  anchors: [],
  materialProfiles: ["matte-plastic"],
  classroomReviewed: true,
  brandFree: true,
  attribution: { creator: "Classroom pack", sourceUrl: "local", license: "classroom-session" }
});

describe("parseRasterPricing", () => {
  const hash = "b".repeat(64);
  const catalogue = [
    asset("bottle-base", "raster-master", "base"),
    asset("bottle-cap", "component", "add-on"),
    asset("billboard-frame", "raster-master", "placement-frame")
  ];
  const payload = {
    schema: "raster-production-pricing@1",
    packId: "offline-core-v1",
    pricingVersion: 1,
    catalogSha256: hash,
    entries: [
      { assetId: "billboard-frame", costCents: 900, role: "media" },
      { assetId: "bottle-base", costCents: 2_500, role: "base" },
      { assetId: "bottle-cap", costCents: 350, role: "part" }
    ]
  };

  it("binds exactly one bounded cost and semantic role to every raster element", () => {
    const parsed = parseRasterPricing(payload, catalogue, hash);

    expect(parsed?.packId).toBe("offline-core-v1");
    expect(parsed?.byAssetId.get("bottle-base")).toEqual({
      role: "base", costCents: 2_500, title: "bottle-base"
    });
    expect(parsed?.byAssetId.get("bottle-cap")).toEqual({
      role: "part", costCents: 350, title: "bottle-cap"
    });
    expect(parsed?.byAssetId.get("billboard-frame")).toEqual({
      role: "media", costCents: 900, title: "billboard-frame"
    });
  });

  it.each([
    ["catalogue hash", { ...payload, catalogSha256: "c".repeat(64) }],
    ["missing entry", { ...payload, entries: payload.entries.slice(1) }],
    ["wrong role", {
      ...payload,
      entries: payload.entries.map((entry) => entry.assetId === "bottle-cap"
        ? { ...entry, role: "base" }
        : entry)
    }],
    ["duplicate ID", { ...payload, entries: [...payload.entries, payload.entries[0]] }],
    ["unbounded cost", {
      ...payload,
      entries: payload.entries.map((entry) => entry.assetId === "bottle-base"
        ? { ...entry, costCents: 0 }
        : entry)
    }]
  ])("fails closed for a mismatched %s", (_label, candidate) => {
    expect(parseRasterPricing(candidate, catalogue, hash)).toBeNull();
  });

  it("loads the hash-bound sidecar from the catalogue directory", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(payload));

    await expect(loadRasterPricing(
      "/catalog/generated/offline-core-v1/catalog.json",
      { records: catalogue, catalogSha256: hash },
      { fetch: fetchMock }
    )).resolves.toEqual(expect.objectContaining({ pricingVersion: 1 }));
    expect(fetchMock).toHaveBeenCalledWith(
      `${window.location.origin}/catalog/generated/offline-core-v1/pricing.json`,
      expect.objectContaining({ method: "GET", credentials: "same-origin" })
    );
  });
});
