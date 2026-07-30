import type { MaterialPresetId } from "../tools/material-presets";

export type AssetKind =
  | "raster-master"
  | "component"
  | "svg"
  | "texture"
  | "shape"
  | "photo"
  | "shell";

export type RecolourZone = "body" | "trim" | "accent" | "label";

export interface CatalogDimensions {
  width: number;
  height: number;
}

export interface CatalogZoneStyle {
  colour: string;
  materialId: MaterialPresetId;
  opacity: number;
}

export interface CatalogFiles {
  thumbnail: string;
  preview: string;
  master: string;
  masks?: Partial<Record<RecolourZone, string>>;
}

export interface LivePhotoFiles {
  thumbnail: string;
  preview: string;
  master: string;
  masks?: never;
}

interface CatalogAssetBase {
  schema: "catalog-asset@1";
  id: string;
  version: 1;
  kind: AssetKind;
  title: string;
  category: string;
  tags: string[];
  dimensions: CatalogDimensions;
  recolourZones: RecolourZone[];
  anchors: Array<{ id: string; x: number; y: number; accepts: string[] }>;
  materialProfiles: MaterialPresetId[];
  classroomReviewed: boolean;
  brandFree: boolean;
  attribution: { creator: string; sourceUrl: string; license: string };
}

export interface OfflineCatalogAssetV1 extends CatalogAssetBase {
  delivery: "offline";
  files: CatalogFiles;
  masterSha256: string;
  virtualParentId?: string;
  defaultZoneStyles?: Partial<Record<RecolourZone, CatalogZoneStyle>>;
}

export interface LivePhotoCatalogAssetV1 extends CatalogAssetBase {
  delivery: "live-photo";
  kind: "photo";
  files: LivePhotoFiles;
  recolourZones: [];
  anchors: [];
  materialProfiles: [];
  classroomReviewed: false;
  brandFree: false;
  masterSha256?: never;
  virtualParentId?: never;
  defaultZoneStyles?: never;
}

export type CatalogAssetV1 = OfflineCatalogAssetV1 | LivePhotoCatalogAssetV1;
