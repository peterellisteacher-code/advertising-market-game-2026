import type { ProductArtwork } from "../product-builder/product-svg-composer";
import type { ResolvedProductVariant } from "../product-builder/virtual-product-variant";

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

export interface ArtworkSurfaceAddress {
  productId: string;
  slotId: string;
}

export interface NewProductShellInput {
  id: string;
  shellId: string;
  svg: string;
  accessibleName: string;
}

export interface NewProductVariantInput {
  id: string;
  accessibleName: string;
  variant: ResolvedProductVariant;
  authoringSvg: string;
  componentSvg: string;
  artwork?: ProductArtwork;
}

export interface CanvasMutation {
  type: CanvasMutationType;
  objectId: string;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export interface CropState {
  cropX: number;
  cropY: number;
  visibleWidth: number;
  visibleHeight: number;
  /** Normalised horizontal focal position from zero to one. */
  focalX: number;
  /** Normalised vertical focal position from zero to one. */
  focalY: number;
}

export type DrawingToolSettings =
  | { mode: "select" }
  | { mode: "pencil" | "marker"; color: string; width: number; opacity: number }
  | { mode: "eraser"; radius: number };

export type CanvasMutationListener = (mutation: CanvasMutation) => void;

export interface CanvasPort {
  addText(input: NewTextInput): Promise<void>;
  addShape(input: NewShapeInput): Promise<void>;
  addRaster(input: NewRasterInput): Promise<void>;
  addArtworkText(address: ArtworkSurfaceAddress, input: NewTextInput): Promise<void>;
  addArtworkShape(address: ArtworkSurfaceAddress, input: NewShapeInput): Promise<void>;
  addArtworkRaster(address: ArtworkSurfaceAddress, input: NewRasterInput): Promise<void>;
  setArtworkText(address: ArtworkSurfaceAddress, id: string, value: string): void;
  addProductShell(input: NewProductShellInput): Promise<void>;
  addProductVariant(input: NewProductVariantInput): Promise<void>;
  setProductShellRegion(id: string, region: string, colour: string): void;
  getProductShellRegionColours(id: string): Readonly<Record<string, string>>;
  setText(id: string, value: string): void;
  transform(id: string, patch: Partial<ObjectTransform>): void;
  duplicate(id: string, newId: string): Promise<void>;
  remove(id: string): void;
  move(id: string, direction: StackDirection): void;
  setLocked(id: string, locked: boolean): void;
  setVisible(id: string, visible: boolean): void;
  setSelected(id: string | null): void;
  getCropSourceSize(id: string): CanvasSize;
  setCrop(id: string, crop: CropState): void;
  setDrawingTool(settings: DrawingToolSettings): void;
  eraseTopmostDrawing(point: CanvasPoint, radius: number): boolean;
  serialize(): Record<string, unknown>;
  exportCleanPngDataUrl(): string;
  load(value: Record<string, unknown>): Promise<void>;
  subscribe(listener: CanvasMutationListener): () => void;
}
