export type AidaSlot = "price" | "attention" | "interest" | "desire" | "action";

export type ElementKind =
  | "text"
  | "shape"
  | "image"
  | "drawing"
  | "masked-component";

export interface EditorObjectMeta {
  objectId: string;
  elementKind: ElementKind;
  assetId?: string;
  sourceHash?: string;
  accessibleName: string;
}
