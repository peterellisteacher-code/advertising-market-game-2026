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
  }

  interface SerializedObjectProps {
    objectId?: string;
    elementKind?: ElementKind;
    assetId?: string;
    sourceHash?: string;
    accessibleName?: string;
    cropFocalX?: number;
    cropFocalY?: number;
  }
}

FabricObject.customProperties = [
  "objectId",
  "elementKind",
  "assetId",
  "sourceHash",
  "accessibleName",
  "cropFocalX",
  "cropFocalY"
];
