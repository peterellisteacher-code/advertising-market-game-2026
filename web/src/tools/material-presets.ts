export const MATERIAL_PRESET_IDS = [
  "matte-plastic",
  "gloss-plastic",
  "rubber",
  "cardboard",
  "fabric",
  "glass",
  "brushed-metal",
  "wood"
] as const;

export type MaterialPresetId = typeof MATERIAL_PRESET_IDS[number];
export type MaterialBlendMode = "multiply" | "soft-light" | "screen";

export interface MaterialPreset {
  readonly label: string;
  readonly textureUrl: string;
  readonly blendMode: MaterialBlendMode;
  readonly opacity: number;
  readonly highlightStrength: number;
  readonly textureStrength: number;
}

const MATTE_TEXTURE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Cpath fill='%23808080' d='M0 0h4v4H0z'/%3E%3C/svg%3E";
const GLOSS_TEXTURE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpath fill='%23707070' d='M0 0h8v8H0z'/%3E%3Cpath fill='%23d0d0d0' d='M0 1h8v2H0z'/%3E%3C/svg%3E";
const RUBBER_TEXTURE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6'%3E%3Cpath fill='%23787878' d='M0 0h6v6H0z'/%3E%3Ccircle fill='%23989898' cx='1' cy='1' r='.6'/%3E%3Ccircle fill='%23989898' cx='4' cy='4' r='.6'/%3E%3C/svg%3E";
const CARDBOARD_TEXTURE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpath fill='%23808080' d='M0 0h8v8H0z'/%3E%3Cpath stroke='%23a0a0a0' d='M0 2l8 1M0 6l8-2'/%3E%3C/svg%3E";
const FABRIC_TEXTURE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6'%3E%3Cpath fill='%23787878' d='M0 0h6v6H0z'/%3E%3Cpath stroke='%23a8a8a8' d='M0 1h6M1 0v6'/%3E%3C/svg%3E";
const GLASS_TEXTURE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpath fill='%23606060' d='M0 0h8v8H0z'/%3E%3Cpath fill='%23e0e0e0' d='M1 0h2v8H1z'/%3E%3C/svg%3E";
const METAL_TEXTURE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='4'%3E%3Cpath fill='%23787878' d='M0 0h8v4H0z'/%3E%3Cpath stroke='%23b8b8b8' d='M0 1h8M0 3h8'/%3E%3C/svg%3E";
const WOOD_TEXTURE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath fill='%23787878' d='M0 0h10v6H0z'/%3E%3Cpath fill='none' stroke='%23a8a8a8' d='M0 1c3 2 7-2 10 0M0 4c3-2 7 2 10 0'/%3E%3C/svg%3E";

export const MATERIAL_PRESETS = Object.freeze({
  "matte-plastic": Object.freeze({
    label: "Matte plastic",
    textureUrl: MATTE_TEXTURE,
    blendMode: "multiply",
    opacity: 1,
    highlightStrength: 0.12,
    textureStrength: 0.04
  }),
  "gloss-plastic": Object.freeze({
    label: "Gloss plastic",
    textureUrl: GLOSS_TEXTURE,
    blendMode: "screen",
    opacity: 0.94,
    highlightStrength: 0.42,
    textureStrength: 0.08
  }),
  rubber: Object.freeze({
    label: "Rubber",
    textureUrl: RUBBER_TEXTURE,
    blendMode: "multiply",
    opacity: 0.96,
    highlightStrength: 0.04,
    textureStrength: 0.07
  }),
  cardboard: Object.freeze({
    label: "Cardboard",
    textureUrl: CARDBOARD_TEXTURE,
    blendMode: "soft-light",
    opacity: 0.9,
    highlightStrength: 0.06,
    textureStrength: 0.08
  }),
  fabric: Object.freeze({
    label: "Fabric",
    textureUrl: FABRIC_TEXTURE,
    blendMode: "soft-light",
    opacity: 0.92,
    highlightStrength: 0.08,
    textureStrength: 0.09
  }),
  glass: Object.freeze({
    label: "Glass",
    textureUrl: GLASS_TEXTURE,
    blendMode: "screen",
    opacity: 0.56,
    highlightStrength: 0.56,
    textureStrength: 0.1
  }),
  "brushed-metal": Object.freeze({
    label: "Brushed metal",
    textureUrl: METAL_TEXTURE,
    blendMode: "multiply",
    opacity: 0.9,
    highlightStrength: 0.3,
    textureStrength: 0.06
  }),
  wood: Object.freeze({
    label: "Wood",
    textureUrl: WOOD_TEXTURE,
    blendMode: "multiply",
    opacity: 0.88,
    highlightStrength: 0.1,
    textureStrength: 0.08
  })
} satisfies Record<MaterialPresetId, Readonly<MaterialPreset>>);
