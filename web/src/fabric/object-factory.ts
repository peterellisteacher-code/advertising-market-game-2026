import {
  Ellipse,
  FabricImage,
  FabricObject,
  Line,
  Rect,
  Textbox,
  Triangle
} from "fabric";
import { CREATOR_CONFIG } from "../config";
import type { EditorObjectMeta } from "../domain/editor-object";
import type { NewRasterInput, NewShapeInput, NewTextInput } from "./canvas-port";
import "./fabric-custom-properties";

export const FABRIC_CONTROL_SIZE = 44;
const MAX_TEXT_WIDTH = 640;
const MAX_TEXT_HEIGHT = 360;
const MAX_RASTER_WIDTH = 640;
const MAX_RASTER_HEIGHT = 450;

export function sameOriginRasterUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value, window.location.href);
  } catch {
    throw new Error("Raster URL must be a valid same-origin URL");
  }
  const isHttp = url.protocol === "http:" || url.protocol === "https:";
  const isBlob = url.protocol === "blob:";
  if ((!isHttp && !isBlob) || url.origin !== window.location.origin) {
    throw new Error("Raster URL must be same-origin");
  }
  return url.href;
}

export class FabricObjectFactory {
  createText(input: NewTextInput): Textbox {
    const object = new Textbox(input.value, {
      width: 480,
      fontSize: 64,
      fill: "#111827",
      textAlign: "center"
    });
    const width = Math.max(1, object.getScaledWidth());
    const height = Math.max(1, object.getScaledHeight());
    object.scale(Math.min(1, (MAX_TEXT_WIDTH - 1) / width, (MAX_TEXT_HEIGHT - 1) / height));
    return this.#configure(object, {
      objectId: input.id,
      elementKind: "text",
      accessibleName: input.accessibleName
    });
  }

  createShape(input: NewShapeInput): FabricObject {
    let object: FabricObject;
    switch (input.kind) {
      case "rect":
        object = new Rect({ width: 320, height: 220, rx: 18, ry: 18, fill: input.fill });
        break;
      case "ellipse":
        object = new Ellipse({ rx: 160, ry: 110, fill: input.fill });
        break;
      case "triangle":
        object = new Triangle({ width: 280, height: 240, fill: input.fill });
        break;
      case "line":
        object = new Line([-160, 0, 160, 0], { stroke: input.fill, strokeWidth: 12 });
        break;
    }
    return this.#configure(object, {
      objectId: input.id,
      elementKind: "shape",
      accessibleName: input.accessibleName
    });
  }

  async createRaster(input: NewRasterInput): Promise<FabricImage> {
    const url = sameOriginRasterUrl(input.sameOriginUrl);
    const image = await FabricImage.fromURL(url, { crossOrigin: "anonymous" });
    const width = Math.max(1, image.width || MAX_RASTER_WIDTH);
    const height = Math.max(1, image.height || MAX_RASTER_HEIGHT);
    image.scale(Math.min(1, MAX_RASTER_WIDTH / width, MAX_RASTER_HEIGHT / height));
    return this.#configure(image, {
      objectId: input.id,
      elementKind: "image",
      assetId: input.assetId,
      accessibleName: input.accessibleName
    });
  }

  #configure<T extends FabricObject>(object: T, meta: EditorObjectMeta): T {
    object.set({
      ...meta,
      originX: "center",
      originY: "center",
      left: CREATOR_CONFIG.canvasWidth / 2,
      top: CREATOR_CONFIG.canvasHeight / 2,
      cornerSize: FABRIC_CONTROL_SIZE,
      touchCornerSize: FABRIC_CONTROL_SIZE,
      transparentCorners: false,
      borderScaleFactor: 2
    });
    object.setCoords();
    return object;
  }
}
