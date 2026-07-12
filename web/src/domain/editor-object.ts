export type AidaSlot = "price" | "attention" | "interest" | "desire" | "action";

export const ELEMENT_KINDS = [
  "text",
  "shape",
  "image",
  "drawing",
  "masked-component"
] as const;

export type ElementKind = typeof ELEMENT_KINDS[number];

export interface EditorObjectMeta {
  objectId: string;
  elementKind: ElementKind;
  assetId?: string;
  sourceHash?: string;
  accessibleName: string;
}
