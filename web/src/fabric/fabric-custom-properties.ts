import { FabricObject } from "fabric";
import type { ElementKind } from "../domain/editor-object";

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
  "componentSlotId"
];
