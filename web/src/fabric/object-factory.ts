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
import {
  hasCurvedLabelFontLoadingApi,
  isCurvedLabelFontFamily,
  renderCurvedLabel,
  waitForCurvedLabelFont,
  type CurvedLabelFontFamily
} from "../product-kit/curved-label-renderer";
import type { NewRasterInput, NewShapeInput, NewTextInput } from "./canvas-port";
import "./fabric-custom-properties";

export const FABRIC_CONTROL_SIZE = 44;
export const FABRIC_SELECTION_STYLE = Object.freeze({
  cornerSize: FABRIC_CONTROL_SIZE,
  touchCornerSize: FABRIC_CONTROL_SIZE,
  transparentCorners: false,
  borderScaleFactor: 3,
  borderColor: "#075985",
  cornerColor: "#f4c95d",
  cornerStrokeColor: "#172033"
});
export const MAX_TEXT_WIDTH = 640;
export const MAX_TEXT_HEIGHT = 360;
const MAX_RASTER_WIDTH = 640;
const MAX_RASTER_HEIGHT = 450;
const PORTABLE_PNG_PREFIX = "data:image/png;base64,";
export const MAX_PORTABLE_PNG_DATA_URL_BYTES = 2 * 1_024 * 1_024;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

export function calculateTextFitScale(
  width: number,
  height: number,
  availableWidth = MAX_TEXT_WIDTH,
  availableHeight = MAX_TEXT_HEIGHT
): number {
  const unscaledWidth = Math.max(1, width);
  const unscaledHeight = Math.max(1, height);
  return Math.min(
    1,
    MAX_TEXT_WIDTH / unscaledWidth,
    MAX_TEXT_HEIGHT / unscaledHeight,
    availableWidth / unscaledWidth,
    availableHeight / unscaledHeight
  );
}

function netlifySiteHostname(hostname: string): string | null {
  const normalized = hostname.toLowerCase();
  if (!normalized.endsWith(".netlify.app")) return null;
  const separator = normalized.lastIndexOf("--");
  return separator < 0 ? normalized : normalized.slice(separator + 2);
}

function rasterUrlError(): Error {
  return new Error("Raster URL must be same-origin");
}

function boundedPortablePngDataUrl(value: string): string | null {
  if (!value.startsWith(PORTABLE_PNG_PREFIX)) return null;
  const encoded = value.slice(PORTABLE_PNG_PREFIX.length);
  const encodedLimit = Math.ceil(MAX_PORTABLE_PNG_DATA_URL_BYTES / 3) * 4;
  if (!encoded || encoded.length > encodedLimit ||
    !/^(?:[a-z0-9+/]{4})*(?:[a-z0-9+/]{2}==|[a-z0-9+/]{3}=)?$/i.test(encoded)) {
    return null;
  }
  let decoded: string;
  try {
    decoded = globalThis.atob(encoded);
  } catch {
    return null;
  }
  if (decoded.length > MAX_PORTABLE_PNG_DATA_URL_BYTES ||
    PNG_SIGNATURE.some((byte, index) => decoded.charCodeAt(index) !== byte)) {
    return null;
  }
  return value;
}

export function sameOriginRasterUrl(
  value: string,
  currentHref = window.location.href
): string {
  let url: URL;
  let current: URL;
  try {
    current = new URL(currentHref);
    url = new URL(value, current);
  } catch {
    throw new Error("Raster URL must be a valid same-origin URL");
  }
  const isHttp = url.protocol === "http:" || url.protocol === "https:";
  const isBlob = url.protocol === "blob:";
  const currentOrigin = current.origin;
  if (currentOrigin === "null" || url.origin === "null" ||
    (!isHttp && !isBlob) || url.origin !== currentOrigin) {
    throw rasterUrlError();
  }
  return url.href;
}

export function portableRasterUrlForLoad(
  value: string,
  currentHref = window.location.href
): string {
  const portablePng = boundedPortablePngDataUrl(value);
  if (portablePng !== null) return portablePng;
  try {
    return sameOriginRasterUrl(value, currentHref);
  } catch (error) {
    let current: URL;
    let source: URL;
    try {
      current = new URL(currentHref);
      source = new URL(value, current);
    } catch {
      throw error;
    }
    const currentSite = netlifySiteHostname(current.hostname);
    const sourceSite = netlifySiteHostname(source.hostname);
    const isPortableLegacyCatalogueUrl = current.protocol === "https:" &&
      source.protocol === "https:" &&
      currentSite !== null &&
      sourceSite === currentSite &&
      source.username === "" &&
      source.password === "" &&
      source.pathname.startsWith("/catalog/");
    if (!isPortableLegacyCatalogueUrl) throw error;
    return new URL(
      `${source.pathname}${source.search}${source.hash}`,
      current.origin
    ).href;
  }
}

export function portableRasterUrlForStorage(
  value: string,
  currentHref = window.location.href
): string {
  const portablePng = boundedPortablePngDataUrl(value);
  if (portablePng !== null) return portablePng;
  const absolute = sameOriginRasterUrl(value, currentHref);
  const url = new URL(absolute);
  if ((url.protocol === "http:" || url.protocol === "https:") &&
    url.pathname.startsWith("/catalog/")) {
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return absolute;
}

export class FabricObjectFactory {
  createText(input: NewTextInput): Textbox {
    const object = new Textbox(input.value, {
      width: 480,
      fontSize: 64,
      fill: "#111827",
      textAlign: "center",
      editable: input.editable ?? true
    });
    object.scale(calculateTextFitScale(
      object.getScaledWidth() / Math.max(Number.EPSILON, Math.abs(object.scaleX)),
      object.getScaledHeight() / Math.max(Number.EPSILON, Math.abs(object.scaleY))
    ));
    return this.#configure(object, {
      objectId: input.id,
      elementKind: "text",
      accessibleName: input.accessibleName
    });
  }

  async createCurvedLabel(
    input: NewTextInput,
    colour = "#111827"
  ): Promise<FabricImage> {
    const fontFamily = input.fontFamily ?? "Arial";
    if (!isCurvedLabelFontFamily(fontFamily)) {
      throw new Error("Curved label font is not supported");
    }
    if (hasCurvedLabelFontLoadingApi()) await waitForCurvedLabelFont(fontFamily);
    const rendered = renderCurvedLabel({
      text: input.value,
      colour,
      fontFamily
    });
    const object = new FabricImage(rendered.canvas, {
      objectCaching: true,
      imageSmoothing: true
    });
    object.set({
      curvedTextSource: input.value.replace(/\s+/gu, " ").trim(),
      curvedTextProfile: rendered.profile.id,
      curvedTextColour: colour.toUpperCase(),
      curvedTextFontFamily: fontFamily
    });
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
    const configured = this.#configure(image, {
      objectId: input.id,
      elementKind: "image",
      assetId: input.assetId,
      accessibleName: input.accessibleName
    });
    if (input.sectionFill !== undefined) {
      const { sourceSha256, mode, profile } = input.sectionFill;
      const validPair =
        (mode === "connected-sections" && profile === "bounded-linework-v1") ||
        (mode === "whole-object" && profile === "opaque-body-v1");
      if (!/^[0-9a-f]{64}$/.test(sourceSha256) || !validPair) {
        throw new Error("Raster section-fill provenance is invalid");
      }
      configured.set({
        sourceHash: sourceSha256,
        rasterSectionFillSourceUrl: url,
        rasterSectionFillMode: mode,
        rasterSectionFillProfile: profile,
        rasterSectionFillRecipes: Object.freeze([])
      });
    }
    return configured;
  }

  #configure<T extends FabricObject>(object: T, meta: EditorObjectMeta): T {
    object.set({
      ...meta,
      originX: "center",
      originY: "center",
      left: CREATOR_CONFIG.canvasWidth / 2,
      top: CREATOR_CONFIG.canvasHeight / 2,
      ...FABRIC_SELECTION_STYLE
    });
    object.setCoords();
    return object;
  }
}
