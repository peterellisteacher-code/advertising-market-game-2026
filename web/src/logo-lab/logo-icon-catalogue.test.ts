import { describe, expect, it, vi } from "vitest";
import {
  loadLogoIconCatalogue,
  parseLogoIconCatalogue,
  searchLogoIcons
} from "./logo-icon-catalogue";

const fixture = {
  schema: "logo-icon-catalog@1",
  packId: "tabler-logo-icons-v1",
  version: 1,
  source: {
    name: "Tabler Icons",
    package: "@iconify-json/tabler",
    packageVersion: "1.2.35",
    sourceVersion: "3.44.0",
    licence: "MIT",
    url: "https://github.com/tabler/tabler-icons"
  },
  icons: [
    {
      id: "paw",
      title: "Paw",
      body: '<path fill="none" stroke="currentColor" d="M1 1h2"/>',
      width: 24,
      height: 24,
      categories: ["pets-animals"]
    },
    {
      id: "paw-filled-circle",
      title: "Paw Filled Circle",
      body: '<circle fill="none" stroke="currentColor" cx="12" cy="12" r="9"/>',
      width: 24,
      height: 24,
      categories: ["pets-animals"]
    },
    {
      id: "rocket",
      title: "Rocket",
      body: '<path fill="none" stroke="currentColor" d="M2 2l8 8"/>',
      width: 24,
      height: 24,
      categories: ["tech-gadgets"]
    }
  ]
};

describe("logo icon catalogue", () => {
  it("parses a pinned local vector catalogue and freezes it", () => {
    const catalogue = parseLogoIconCatalogue(fixture);
    expect(catalogue.icons).toHaveLength(3);
    expect(catalogue.icons[0]).toMatchObject({ id: "paw", width: 24, height: 24 });
    expect(Object.isFrozen(catalogue)).toBe(true);
    expect(Object.isFrozen(catalogue.icons)).toBe(true);
  });

  it("fails closed on active SVG content, duplicate ids, or oversized dimensions", () => {
    expect(() => parseLogoIconCatalogue({
      ...fixture,
      icons: [{ ...fixture.icons[0], body: '<path onclick="alert(1)" d="M0 0"/>' }]
    })).toThrow(/unsafe SVG body/i);
    expect(() => parseLogoIconCatalogue({
      ...fixture,
      icons: [fixture.icons[0], fixture.icons[0]]
    })).toThrow(/duplicate icon id/i);
    expect(() => parseLogoIconCatalogue({
      ...fixture,
      icons: [{ ...fixture.icons[0], width: 10_000 }]
    })).toThrow(/dimensions/i);
  });

  it("searches by name and category without rendering the whole library", () => {
    const catalogue = parseLogoIconCatalogue(fixture);
    expect(searchLogoIcons(catalogue, "paw", "pets-animals", 1).map(({ id }) => id))
      .toEqual(["paw"]);
    expect(searchLogoIcons(catalogue, "", "tech-gadgets", 40).map(({ id }) => id))
      .toEqual(["rocket"]);
    expect(searchLogoIcons(catalogue, "missing", "all", 40)).toEqual([]);
  });

  it("loads only the canonical same-origin reviewed URL", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(fixture));
    await expect(loadLogoIconCatalogue(
      "/catalog/generated/logo-icons-v1-reviewed/catalog.json",
      fetcher
    )).resolves.toMatchObject({ packId: "tabler-logo-icons-v1" });
    expect(fetcher).toHaveBeenCalledWith(
      new URL(
        "/catalog/generated/logo-icons-v1-reviewed/catalog.json",
        window.location.origin
      ).href,
      expect.objectContaining({ credentials: "same-origin" })
    );
    await expect(loadLogoIconCatalogue("https://external.example/icons.json", fetcher))
      .rejects.toThrow(/same-origin reviewed URL/i);
  });
});
