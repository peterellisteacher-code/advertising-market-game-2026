import { FabricObject } from "fabric";
import type { ElementKind } from "../domain/editor-object";
import type { LogoRecipeId, LogoTypeface } from "../logo-lab/logo-mark-model";

export type LogoLayer = "container" | "symbol" | "wordmark";

declare module "fabric" {
  interface FabricObject {
    objectId?: string;
    elementKind?: ElementKind;
    assetId?: string;
    sourceHash?: string;
    accessibleName?: string;
    cropFocalX?: number;
    cropFocalY?: number;
    editorGuide?: boolean;
    shellId?: string;
    shellRegion?: string;
    packId?: string;
    variantId?: string;
    bodyId?: string;
    partId?: string;
    paletteId?: string;
    materialId?: string;
    productLayer?: string;
    componentSlotId?: string;
    artworkSlotId?: string;
    artworkId?: string;
    logoRecipe?: LogoRecipeId;
    logoSeed?: number;
    logoRevision?: number;
    logoIconId?: string;
    logoText?: string;
    logoPrimary?: string;
    logoSecondary?: string;
    logoTypeface?: LogoTypeface;
    logoLayer?: LogoLayer;
  }

  interface SerializedObjectProps {
    objectId?: string;
    elementKind?: ElementKind;
    assetId?: string;
    sourceHash?: string;
    accessibleName?: string;
    cropFocalX?: number;
    cropFocalY?: number;
    editorGuide?: boolean;
    shellId?: string;
    shellRegion?: string;
    packId?: string;
    variantId?: string;
    bodyId?: string;
    partId?: string;
    paletteId?: string;
    materialId?: string;
    productLayer?: string;
    componentSlotId?: string;
    artworkSlotId?: string;
    artworkId?: string;
    logoRecipe?: LogoRecipeId;
    logoSeed?: number;
    logoRevision?: number;
    logoIconId?: string;
    logoText?: string;
    logoPrimary?: string;
    logoSecondary?: string;
    logoTypeface?: LogoTypeface;
    logoLayer?: LogoLayer;
  }
}

FabricObject.customProperties = [
  "objectId",
  "elementKind",
  "assetId",
  "sourceHash",
  "accessibleName",
  "cropFocalX",
  "cropFocalY",
  "editorGuide",
  "shellId",
  "shellRegion",
  "packId",
  "variantId",
  "bodyId",
  "partId",
  "paletteId",
  "materialId",
  "productLayer",
  "componentSlotId",
  "artworkSlotId",
  "artworkId",
  "logoRecipe",
  "logoSeed",
  "logoRevision",
  "logoIconId",
  "logoText",
  "logoPrimary",
  "logoSecondary",
  "logoTypeface",
  "logoLayer"
];
