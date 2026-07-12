export type AssetKind =
  | "raster-master"
  | "component"
  | "svg"
  | "texture"
  | "shape"
  | "photo"
  | "shell";

export type RecolourZone = "body" | "trim" | "accent" | "label";

export interface CatalogAssetV1 {
  schema: "catalog-asset@1";
  id: string;
  version: number;
  kind: AssetKind;
  title: string;
  category: string;
  tags: string[];
  files: {
    thumbnail: string;
    preview: string;
    master: string;
    masks?: Partial<Record<RecolourZone, string>>;
    shadow?: string;
  };
  recolourZones: RecolourZone[];
  anchors: Array<{ id: string; x: number; y: number; accepts: string[] }>;
  materialProfiles: string[];
  classroomReviewed: boolean;
  brandFree: boolean;
  attribution: { creator: string; sourceUrl: string; license: string };
}
