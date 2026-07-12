import { describe, expect, it, vi } from "vitest";
import type { CatalogAssetV1 } from "./catalogue-types";
import { loadOfflineCatalogue } from "./catalogue-store";

const asset = (id = "core-bottle"): CatalogAssetV1 => ({
  schema: "catalog-asset@1",
  id,
  version: 1,
  kind: "component",
  title: "Reviewed bottle",
  category: "drinkware",
  tags: ["bottle"],
  files: {
    thumbnail: `/catalog/${id}-192.webp`,
    preview: `/catalog/${id}-640.webp`,
    master: `/catalog/${id}.png`
  },
  recolourZones: ["body"],
  anchors: [],
  materialProfiles: ["matte-plastic"],
  classroomReviewed: true,
  brandFree: true,
  attribution: {
    creator: "Classroom pack",
    sourceUrl: "local",
    license: "classroom-session"
  }
});

describe("loadOfflineCatalogue", () => {
  it("returns an empty catalogue without fetching when the root has no URL", async () => {
    const fetchMock = vi.fn();

    await expect(loadOfflineCatalogue(undefined, { fetch: fetchMock })).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads a same-origin array of valid records", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([asset()]));

    await expect(loadOfflineCatalogue("/catalog/generated/offline-core-v1/catalog.json", {
      fetch: fetchMock
    })).resolves.toEqual([asset()]);
    expect(fetchMock).toHaveBeenCalledWith(
      new URL("/catalog/generated/offline-core-v1/catalog.json", window.location.href).href,
      expect.objectContaining({ method: "GET" })
    );
  });

  it.each([
    ["external catalogue URL", "https://external.example/catalog.json", [asset()]],
    ["duplicate IDs", "/catalog/catalog.json", [asset(), asset()]],
    ["external asset bytes", "/catalog/catalog.json", [
      { ...asset(), files: { ...asset().files, master: "https://external.example/master.png" } }
    ]]
  ])("fails closed for %s", async (_label, url, payload) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(payload));

    await expect(loadOfflineCatalogue(url, { fetch: fetchMock })).resolves.toEqual([]);
    if (url.startsWith("https://external")) expect(fetchMock).not.toHaveBeenCalled();
  });
});
