import { describe, expect, it, vi } from "vitest";
import svgSafetyFixtures from "../../../scripts/logo-icon-svg-safety-fixtures.json";
import {
  loadLogoIconCatalogue,
  parseLogoIconCatalogue,
  searchLogoIcons
} from "./logo-icon-catalogue";
import { isSafeColourableSvgBody } from "./logo-icon-svg-safety";

const fixtureIcons = [
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
  },
  ...Array.from({ length: 4_202 }, (_, index) => ({
    id: `icon-${String(index).padStart(4, "0")}`,
    title: `Icon ${index}`,
    body: '<path fill="none" stroke="currentColor" d="M2 12h20"/>',
    width: 24,
    height: 24,
    categories: ["general"]
  }))
];

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
  icons: fixtureIcons
};

function replaceFirstIcon(changes: Record<string, unknown>): typeof fixture {
  return {
    ...fixture,
    icons: [{ ...fixture.icons[0]!, ...changes }, ...fixture.icons.slice(1)]
  };
}

describe("logo icon catalogue", () => {
  it("keeps the browser SVG safety policy aligned with the shared Node fixtures", () => {
    for (const fixtureCase of svgSafetyFixtures.valid) {
      expect(isSafeColourableSvgBody(fixtureCase.body), fixtureCase.name).toBe(true);
    }
    for (const fixtureCase of svgSafetyFixtures.invalid) {
      expect(isSafeColourableSvgBody(fixtureCase.body), fixtureCase.name).toBe(false);
    }
  });

  it("parses a pinned local vector catalogue and freezes it", () => {
    const catalogue = parseLogoIconCatalogue(fixture);
    expect(catalogue.icons).toHaveLength(4_205);
    expect(catalogue.icons[0]).toMatchObject({ id: "paw", width: 24, height: 24 });
    expect(Object.isFrozen(catalogue)).toBe(true);
    expect(Object.isFrozen(catalogue.icons)).toBe(true);
  });

  it("fails closed on active SVG content, duplicate ids, or oversized dimensions", () => {
    expect(() => parseLogoIconCatalogue({
      ...fixture,
      icons: replaceFirstIcon({ body: '<path onclick="alert(1)" d="M0 0"/>' }).icons
    })).toThrow(/unsafe SVG body/i);
    expect(() => parseLogoIconCatalogue({
      ...fixture,
      icons: [fixture.icons[0], fixture.icons[0], ...fixture.icons.slice(2)]
    })).toThrow(/duplicate icon id/i);
    expect(() => parseLogoIconCatalogue({
      ...fixture,
      icons: replaceFirstIcon({ width: 10_000 }).icons
    })).toThrow(/dimensions/i);
    expect(() => parseLogoIconCatalogue({
      ...fixture,
      icons: replaceFirstIcon({
        body: '<g stroke="currentColor"><path d="M0 0h4"/><use href=//example.invalid/a.svg#mark /></g>'
      }).icons
    })).toThrow(/unsafe SVG body/i);
    expect(() => parseLogoIconCatalogue({
      ...fixture,
      icons: replaceFirstIcon({ body: '<path id="currentColor" d="M0 0h4"/>' }).icons
    })).toThrow(/unsafe SVG body/i);
  });

  it("enforces the exact pinned browser catalogue contract", () => {
    expect(() => parseLogoIconCatalogue({
      ...fixture,
      icons: fixture.icons.slice(0, -1)
    })).toThrow(/exactly 4205 icons/i);
    expect(() => parseLogoIconCatalogue({
      ...fixture,
      source: { ...fixture.source, sourceVersion: "next" }
    })).toThrow(/pinned source metadata/i);
    expect(() => parseLogoIconCatalogue(replaceFirstIcon({ id: "brand-example" })))
      .toThrow(/brand icon/i);
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
