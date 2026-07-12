export type ShapeKind = "rect" | "ellipse" | "triangle" | "line";
export type StackDirection = "front" | "forward" | "backward" | "back";
export type CanvasMutationType = "added" | "modified" | "removed";

export interface ObjectTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  flipX: boolean;
  flipY: boolean;
}

export interface NewTextInput {
  id: string;
  value: string;
  accessibleName: string;
}

export interface NewShapeInput {
  id: string;
  kind: ShapeKind;
  fill: string;
  accessibleName: string;
}

export interface NewRasterInput {
  id: string;
  assetId: string;
  sameOriginUrl: string;
  accessibleName: string;
}

export interface CanvasMutation {
  type: CanvasMutationType;
  objectId: string;
}

export type CanvasMutationListener = (mutation: CanvasMutation) => void;

export interface CanvasPort {
  addText(input: NewTextInput): Promise<void>;
  addShape(input: NewShapeInput): Promise<void>;
  addRaster(input: NewRasterInput): Promise<void>;
  transform(id: string, patch: Partial<ObjectTransform>): void;
  duplicate(id: string, newId: string): Promise<void>;
  remove(id: string): void;
  move(id: string, direction: StackDirection): void;
  setLocked(id: string, locked: boolean): void;
  setVisible(id: string, visible: boolean): void;
  setSelected(id: string | null): void;
  serialize(): Record<string, unknown>;
  load(value: Record<string, unknown>): Promise<void>;
  subscribe(listener: CanvasMutationListener): () => void;
}
