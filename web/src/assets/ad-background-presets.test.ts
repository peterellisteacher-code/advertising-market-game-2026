import { expect, it } from "vitest";
import { AD_BACKGROUND_PRESETS, isAdBackgroundPreset } from "./ad-background-presets";

it("provides six stable, text-free local background assets", () => {
  expect(AD_BACKGROUND_PRESETS).toHaveLength(6);
  expect(new Set(AD_BACKGROUND_PRESETS.map((asset) => asset.id)).size).toBe(6);
  for (const asset of AD_BACKGROUND_PRESETS) {
    expect(isAdBackgroundPreset(asset)).toBe(true);
    expect(asset.files.master).toMatch(/^\/catalog\/backgrounds\/.+\.svg$/);
    expect(asset.dimensions).toEqual({ width: 1600, height: 900 });
  }
});
