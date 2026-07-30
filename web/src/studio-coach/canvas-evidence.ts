import type {
  StudioCoachImageEvidence,
  StudioCoachObjectEvidence
} from "../../../shared/studio-coach-contract";
import { collectCampaignSemanticObjects } from "../domain/campaign-semantic-objects";

export const STUDIO_COACH_IMAGE_WIDTH = 896;
export const STUDIO_COACH_IMAGE_HEIGHT = 504;
export const STUDIO_COACH_IMAGE_QUALITY = 0.82;
export const STUDIO_COACH_MAX_IMAGE_BYTES = 768 * 1024;
const CAMPAIGN_CANVAS_WIDTH = 1600;
const CAMPAIGN_CANVAS_HEIGHT = 900;
const MAX_OBJECTS = 40;
const MAX_TEXT_LENGTH = 80;

export interface StudioCoachPreparedImage {
  dataUrl: string;
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface StudioCoachImageCodecs {
  transcode(
    sourceDataUrl: string,
    options: { width: number; height: number; mimeType: "image/jpeg"; quality: number }
  ): Promise<StudioCoachPreparedImage>;
  sha256(bytes: Uint8Array): Promise<string>;
}

export type StudioCoachCanvasEvidence = StudioCoachImageEvidence;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function objectBounds(
  object: Record<string, unknown>,
  path: readonly number[]
): StudioCoachObjectEvidence["bounds"] {
  const left = finiteNumber(object.left);
  const top = finiteNumber(object.top);
  const width = finiteNumber(object.width);
  const height = finiteNumber(object.height);
  const scaleX = finiteNumber(object.scaleX) ?? 1;
  const scaleY = finiteNumber(object.scaleY) ?? 1;
  const angle = finiteNumber(object.angle) ?? 0;
  const skewX = finiteNumber(object.skewX) ?? 0;
  const skewY = finiteNumber(object.skewY) ?? 0;
  if (left === undefined || top === undefined || width === undefined || height === undefined ||
    width < 0 || height < 0 || scaleX <= 0 || scaleY <= 0 || path.length > 1 ||
    angle % 360 !== 0 || skewX !== 0 || skewY !== 0 || object.flipX === true || object.flipY === true ||
    object.originX !== undefined && object.originX !== "left" ||
    object.originY !== undefined && object.originY !== "top") return undefined;
  const x = clamp01(left / CAMPAIGN_CANVAS_WIDTH);
  const y = clamp01(top / CAMPAIGN_CANVAS_HEIGHT);
  const right = clamp01((left + width * scaleX) / CAMPAIGN_CANVAS_WIDTH);
  const bottom = clamp01((top + height * scaleY) / CAMPAIGN_CANVAS_HEIGHT);
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y)
  };
}

function objectEvidence(fabricState: unknown): StudioCoachObjectEvidence[] {
  return collectCampaignSemanticObjects(fabricState).slice(0, MAX_OBJECTS).map((semantic) => {
    const { object } = semantic;
    const bounds = objectBounds(object, semantic.path);
    const text = semantic.elementKind === "text" && typeof object.text === "string"
      ? object.text.slice(0, MAX_TEXT_LENGTH)
      : undefined;
    const colour = typeof object.fill === "string" && object.fill.length <= 64
      ? object.fill
      : undefined;
    const fontSize = finiteNumber(object.fontSize);
    return {
      id: semantic.objectId.slice(0, 120),
      type: semantic.elementKind,
      name: semantic.accessibleName.slice(0, 120),
      zOrder: Object.freeze([...semantic.path]),
      ...(bounds === undefined ? {} : { bounds }),
      ...(text === undefined ? {} : { text }),
      ...(colour === undefined ? {} : { colour }),
      ...(fontSize === undefined || fontSize <= 0 || fontSize > 400 ? {} : { fontSize })
    };
  });
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not encode the prepared Studio Coach image"));
    }, { once: true });
    reader.addEventListener("error", () => reject(new Error("Could not encode the prepared Studio Coach image")), { once: true });
    reader.readAsDataURL(blob);
  });
}

async function loadImage(sourceDataUrl: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("Could not read the current advertisement image")), { once: true });
  });
  image.src = sourceDataUrl;
  return loaded;
}

const defaultImageCodecs: StudioCoachImageCodecs = {
  async transcode(sourceDataUrl, options) {
    const image = await loadImage(sourceDataUrl);
    const canvas = document.createElement("canvas");
    canvas.width = options.width;
    canvas.height = options.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser cannot prepare a Studio Coach image");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, options.width, options.height);
    context.drawImage(image, 0, 0, options.width, options.height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not prepare the Studio Coach image")),
        options.mimeType, options.quality);
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return {
      dataUrl: await readAsDataUrl(blob),
      bytes,
      width: options.width,
      height: options.height
    };
  },
  async sha256(bytes) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
};

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function captureStudioCoachEvidence(
  cleanPngDataUrl: string,
  fabricState: unknown,
  codecs: StudioCoachImageCodecs = defaultImageCodecs
): Promise<StudioCoachCanvasEvidence> {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(cleanPngDataUrl)) {
    throw new Error("Studio Coach requires a valid PNG export of the current advertisement");
  }
  const prepared = await codecs.transcode(cleanPngDataUrl, {
    width: STUDIO_COACH_IMAGE_WIDTH,
    height: STUDIO_COACH_IMAGE_HEIGHT,
    mimeType: "image/jpeg",
    quality: STUDIO_COACH_IMAGE_QUALITY
  });
  if (prepared.width !== STUDIO_COACH_IMAGE_WIDTH || prepared.height !== STUDIO_COACH_IMAGE_HEIGHT ||
    !prepared.dataUrl.startsWith("data:image/jpeg;base64,") || !isJpeg(prepared.bytes)) {
    throw new Error("Studio Coach image preparation did not produce the required JPEG");
  }
  if (prepared.bytes.byteLength > STUDIO_COACH_MAX_IMAGE_BYTES) {
    throw new Error("The prepared Studio Coach image is too large");
  }
  const imageSha256 = await codecs.sha256(prepared.bytes);
  if (!/^[a-f0-9]{64}$/.test(imageSha256)) throw new Error("Studio Coach image digest is invalid");
  return {
    imageDataUrl: prepared.dataUrl,
    imageSha256,
    width: STUDIO_COACH_IMAGE_WIDTH,
    height: STUDIO_COACH_IMAGE_HEIGHT,
    objects: objectEvidence(fabricState)
  };
}
