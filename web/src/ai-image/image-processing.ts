const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const TARGET_DIMENSIONS = {
  "object-forge": { width: 512, height: 512 },
  "make-it-real": { width: 1024, height: 576 }
} as const;

export type AiImageTarget = keyof typeof TARGET_DIMENSIONS;

export type ImageProcessingErrorCode =
  | "INVALID_BYTE_CAP"
  | "INVALID_DATA_URL"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "IMAGE_TOO_LARGE"
  | "INVALID_IMAGE_SIGNATURE"
  | "IMAGE_DECODE_FAILED"
  | "INVALID_TARGET"
  | "INVALID_IMAGE_DIMENSIONS"
  | "INVALID_RGBA"
  | "CANVAS_UNAVAILABLE"
  | "CANVAS_PROCESSING_FAILED"
  | "ENCODE_FAILED";

export class ImageProcessingError extends Error {
  readonly code: ImageProcessingErrorCode;

  constructor(code: ImageProcessingErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ImageProcessingError";
    this.code = code;
  }
}

function fail(code: ImageProcessingErrorCode, message: string, cause?: unknown): never {
  throw new ImageProcessingError(code, message, cause === undefined ? undefined : { cause });
}

const isPng = (bytes: Uint8Array): boolean => {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return signature.every((byte, index) => bytes[index] === byte);
};

const isJpeg = (bytes: Uint8Array): boolean =>
  bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

export const decodeImageDataUrl = (
  dataUrl: string,
  maxBytes = DEFAULT_MAX_IMAGE_BYTES
): Blob => {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    fail("INVALID_BYTE_CAP", "The image byte cap must be a positive safe integer.");
  }

  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) {
    fail("INVALID_DATA_URL", "Expected a base64 PNG or JPEG data URL.");
  }

  const mime = match[1]!;
  const payload = match[2]!;
  if (mime !== "image/png" && mime !== "image/jpeg") {
    fail("UNSUPPORTED_MEDIA_TYPE", "Only PNG and JPEG image data URLs are accepted.");
  }
  if (
    payload.length === 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload)
  ) {
    fail("INVALID_DATA_URL", "The image data URL contains invalid base64 data.");
  }

  const paddingBytes = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  const decodedSize = (payload.length / 4) * 3 - paddingBytes;
  if (decodedSize > maxBytes) {
    fail("IMAGE_TOO_LARGE", `The decoded image exceeds the ${maxBytes}-byte limit.`);
  }

  let binary: string;
  try {
    binary = globalThis.atob(payload);
  } catch (cause) {
    fail("INVALID_DATA_URL", "The image data URL could not be decoded.", cause);
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const validSignature = mime === "image/png" ? isPng(bytes) : isJpeg(bytes);
  if (!validSignature) {
    fail("INVALID_IMAGE_SIGNATURE", `The payload does not match its declared ${mime} type.`);
  }

  return new Blob([bytes], { type: mime });
};

export const removeWhiteChroma = (rgba: Uint8ClampedArray): Uint8ClampedArray => {
  if (rgba.length % 4 !== 0) {
    fail("INVALID_RGBA", "RGBA input must contain exactly four values per pixel.");
  }

  const result = new Uint8ClampedArray(rgba);
  const transparentDistance = 10;
  const opaqueDistance = 52;
  const neutralTolerance = 18;

  for (let index = 0; index < result.length; index += 4) {
    const red = result[index] ?? 0;
    const green = result[index + 1] ?? 0;
    const blue = result[index + 2] ?? 0;
    const alpha = result[index + 3] ?? 0;
    const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
    if (spread > neutralTolerance) continue;

    const distance = Math.hypot(255 - red, 255 - green, 255 - blue);
    if (distance >= opaqueDistance) continue;

    const opacity = distance <= transparentDistance
      ? 0
      : (distance - transparentDistance) / (opaqueDistance - transparentDistance);
    result[index + 3] = Math.round(alpha * opacity);
  }

  return result;
};

export interface DecodedBrowserImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close?: () => void;
}

export interface PrepareImageOptions {
  maxBytes?: number;
  removeWhiteBackground?: boolean;
  canvasFactory?: () => HTMLCanvasElement;
  decodeImage?: (blob: Blob) => Promise<DecodedBrowserImage>;
}

export interface PreparedAiImage {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

const defaultCanvasFactory = (): HTMLCanvasElement => {
  if (typeof document === "undefined") {
    fail("CANVAS_UNAVAILABLE", "A browser canvas factory is required in this environment.");
  }
  return document.createElement("canvas");
};

const decodeWithHtmlImage = (blob: Blob): Promise<DecodedBrowserImage> => {
  if (
    typeof Image === "undefined" ||
    typeof URL?.createObjectURL !== "function" ||
    typeof URL?.revokeObjectURL !== "function"
  ) {
    return Promise.reject(new ImageProcessingError(
      "IMAGE_DECODE_FAILED",
      "This browser cannot decode the selected image."
    ));
  }

  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      let closed = false;
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => {
          if (closed) return;
          closed = true;
          image.src = "";
          URL.revokeObjectURL(objectUrl);
        }
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new ImageProcessingError(
        "IMAGE_DECODE_FAILED",
        "The selected image could not be decoded."
      ));
    };
    image.src = objectUrl;
  });
};

const defaultImageDecoder = async (blob: Blob): Promise<DecodedBrowserImage> => {
  if (typeof globalThis.createImageBitmap === "function") {
    try {
      const bitmap = await globalThis.createImageBitmap(blob);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close()
      };
    } catch (cause) {
      fail("IMAGE_DECODE_FAILED", "The selected image could not be decoded.", cause);
    }
  }
  return decodeWithHtmlImage(blob);
};

const canvasToPng = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob === null) {
          reject(new ImageProcessingError("ENCODE_FAILED", "The canvas could not be encoded as PNG."));
          return;
        }
        resolve(blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" }));
      }, "image/png");
    } catch (cause) {
      reject(new ImageProcessingError("ENCODE_FAILED", "The canvas could not be encoded as PNG.", {
        cause
      }));
    }
  });

const blobToDataUrl = async (blob: Blob): Promise<string> => {
  try {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return `data:image/png;base64,${globalThis.btoa(binary)}`;
  } catch (cause) {
    fail("ENCODE_FAILED", "The PNG could not be converted to a data URL.", cause);
  }
};

const cleanUp = (decoded: DecodedBrowserImage | undefined, canvas: HTMLCanvasElement | undefined): void => {
  try {
    decoded?.close?.();
  } catch {
    // Cleanup must not hide the processing result or its original error.
  }
  if (canvas) {
    try {
      canvas.width = 0;
      canvas.height = 0;
    } catch {
      // Best-effort release for an injected canvas implementation.
    }
  }
};

export const prepareImageForAi = async (
  dataUrl: string,
  target: AiImageTarget,
  options: PrepareImageOptions = {}
): Promise<PreparedAiImage> => {
  const dimensions = TARGET_DIMENSIONS[target];
  if (!dimensions) {
    fail("INVALID_TARGET", "Choose either the Object Forge or Make It Real image target.");
  }

  const sourceBlob = decodeImageDataUrl(dataUrl, options.maxBytes ?? DEFAULT_MAX_IMAGE_BYTES);
  const decoder = options.decodeImage ?? defaultImageDecoder;
  const makeCanvas = options.canvasFactory ?? defaultCanvasFactory;
  let decoded: DecodedBrowserImage | undefined;
  let canvas: HTMLCanvasElement | undefined;

  try {
    try {
      decoded = await decoder(sourceBlob);
    } catch (cause) {
      if (cause instanceof ImageProcessingError) throw cause;
      fail("IMAGE_DECODE_FAILED", "The selected image could not be decoded.", cause);
    }

    try {
      canvas = makeCanvas();
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
    } catch (cause) {
      if (cause instanceof ImageProcessingError) throw cause;
      fail("CANVAS_UNAVAILABLE", "A processing canvas could not be created.", cause);
    }

    if (
      !Number.isFinite(decoded.width) ||
      !Number.isFinite(decoded.height) ||
      decoded.width <= 0 ||
      decoded.height <= 0
    ) {
      fail("INVALID_IMAGE_DIMENSIONS", "The decoded image has invalid dimensions.");
    }

    const context = canvas.getContext("2d", { willReadFrequently: options.removeWhiteBackground === true });
    if (!context) {
      fail("CANVAS_UNAVAILABLE", "A 2D canvas context is unavailable.");
    }

    const scale = Math.min(dimensions.width / decoded.width, dimensions.height / decoded.height);
    const drawWidth = Math.round(decoded.width * scale);
    const drawHeight = Math.round(decoded.height * scale);
    const drawX = (dimensions.width - drawWidth) / 2;
    const drawY = (dimensions.height - drawHeight) / 2;

    try {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, dimensions.width, dimensions.height);
      context.drawImage(decoded.source, drawX, drawY, drawWidth, drawHeight);
      if (options.removeWhiteBackground === true) {
        const imageData = context.getImageData(0, 0, dimensions.width, dimensions.height);
        imageData.data.set(removeWhiteChroma(imageData.data));
        context.putImageData(imageData, 0, 0);
      }
    } catch (cause) {
      fail("CANVAS_PROCESSING_FAILED", "The image could not be drawn or processed on the canvas.", cause);
    }

    const blob = await canvasToPng(canvas);
    const outputDataUrl = await blobToDataUrl(blob);
    return {
      blob,
      dataUrl: outputDataUrl,
      width: dimensions.width,
      height: dimensions.height
    };
  } finally {
    cleanUp(decoded, canvas);
  }
};
