import { CREATOR_CONFIG } from "../config";
import type { CanvasPort, ObjectTransform } from "../fabric/canvas-port";

type ZoomPort = Pick<CanvasPort, "getSelectedObjectId" | "serialize" | "transform">;
type RasterFitPort = Pick<CanvasPort, "serialize" | "transform">;

interface SerializedCanvasObject {
  readonly objectId: string;
  readonly elementKind: string;
  readonly width: number;
  readonly height: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

const MIN_SCALE = 0.05;
const MAX_SCALE = 8;
const ZOOMABLE_KINDS = new Set(["image", "product-kit", "product-shell"]);

function finitePositive(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Selected object ${label} must be positive and finite`);
  }
  return value;
}

function rootObject(port: RasterFitPort, objectId: string): SerializedCanvasObject {
  const state = port.serialize();
  const objects = state.objects;
  if (!Array.isArray(objects)) throw new Error("Canvas object list is unavailable");
  const matches = objects.filter((value): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && value.objectId === objectId
  );
  if (matches.length !== 1) throw new Error("Select one top-level product or image");
  const object = matches[0]!;
  if (typeof object.elementKind !== "string" || !ZOOMABLE_KINDS.has(object.elementKind)) {
    throw new Error("Select a product or image before using zoom");
  }
  return {
    objectId,
    elementKind: object.elementKind,
    width: finitePositive(object.width, "width"),
    height: finitePositive(object.height, "height"),
    scaleX: finitePositive(object.scaleX ?? 1, "horizontal scale"),
    scaleY: finitePositive(object.scaleY ?? 1, "vertical scale")
  };
}

function roundedPercent(scale: number): number {
  return Math.round(scale * 100);
}

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function fillCanvasWithRaster(port: RasterFitPort, objectId: string): number {
  const object = rootObject(port, objectId);
  if (object.elementKind !== "image") {
    throw new Error("Select an image before using Fill ad");
  }
  const scale = clampScale(Math.max(
    CREATOR_CONFIG.canvasWidth / object.width,
    CREATOR_CONFIG.canvasHeight / object.height
  ));
  const transform: Partial<ObjectTransform> = {
    x: CREATOR_CONFIG.canvasWidth / 2,
    y: CREATOR_CONFIG.canvasHeight / 2,
    scaleX: scale,
    scaleY: scale
  };
  port.transform(objectId, transform);
  return roundedPercent(scale);
}

export class CanvasObjectZoomController {
  constructor(private readonly port: ZoomPort) {}

  zoomSelected(factor: number): number {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new Error("Zoom change must be positive and finite");
    }
    const objectId = this.port.getSelectedObjectId();
    if (objectId === null) throw new Error("Select a product or image before using zoom");
    const object = rootObject(this.port, objectId);
    const scaleX = clampScale(object.scaleX * factor);
    const scaleY = clampScale(object.scaleY * factor);
    this.port.transform(objectId, { scaleX, scaleY });
    return roundedPercent(Math.max(scaleX, scaleY));
  }

  fillSelectedRaster(): number {
    const objectId = this.port.getSelectedObjectId();
    if (objectId === null) throw new Error("Select an image before using Fill ad");
    return fillCanvasWithRaster(this.port, objectId);
  }
}
