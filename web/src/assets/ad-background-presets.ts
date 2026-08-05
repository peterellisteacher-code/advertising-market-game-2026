import type { CatalogAssetV1 } from "../catalogue/catalogue-types";

function preset(id: string, title: string, masterSha256: string): CatalogAssetV1 {
  const source = `/catalog/backgrounds/${id.replace("background-", "")}.svg`;
  return Object.freeze({
    schema: "catalog-asset@1", delivery: "offline", id, version: 1, kind: "svg", title,
    category: "backgrounds", tags: ["background", "full ad", "text-free"],
    dimensions: { width: 1600, height: 900 }, recolourZones: [], anchors: [], materialProfiles: [],
    classroomReviewed: true, brandFree: true,
    files: { thumbnail: source, preview: source, master: source },
    masterSha256,
    attribution: { creator: "Peter Ellis classroom asset pack", sourceUrl: "local", license: "Classroom-session use" }
  });
}

export const AD_BACKGROUND_PRESETS: readonly CatalogAssetV1[] = Object.freeze([
  preset("background-sunrise-rays", "Sunrise rays", "db28f5a1d89efce949fa77b0d37624614d09e1bae311ff0712865764e5e31e65"),
  preset("background-night-grid", "Night grid", "b41cf26fd6c32bafecd74f883a1e5356288b6d28800220081bd80ba68bb4c1c4"),
  preset("background-coral-arch", "Coral arch", "a97b79f7841c459f9e8d05e14d5bc5d679e043f024e26907b7da980de1617379"),
  preset("background-mint-shapes", "Mint shapes", "ae4662646abe8d3c2199858f63cc0cf19fb76e203b6bcc743f5cd99138e9a192"),
  preset("background-lilac-wave", "Lilac wave", "0eebe407896bd72d19821114c5d10eafebb66403644a84bacfb9af7955ceb2ef"),
  preset("background-paper-cut", "Paper cut", "7d47c2e39f1341a8c9c45324f6dad09802504f17618c16023c971f8a83e49ae7")
]);

export function isAdBackgroundPreset(asset: CatalogAssetV1): boolean {
  return AD_BACKGROUND_PRESETS.some((candidate) => candidate.id === asset.id);
}

export function catalogueRecordsWithBackgrounds(core: readonly CatalogAssetV1[]): CatalogAssetV1[] {
  const backgroundIds = new Set(AD_BACKGROUND_PRESETS.map(({ id }) => id));
  return [...core.filter(({ id }) => !backgroundIds.has(id)), ...AD_BACKGROUND_PRESETS];
}
