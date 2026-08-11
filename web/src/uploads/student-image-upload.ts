import { STUDENT_COPY } from "../game/student-copy";
import { MAX_ACCOUNT_ASSET_BYTES } from "../account/account-asset-limits";

export const MAX_STUDENT_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_STUDENT_IMAGE_EDGE = 4_096;
export const MAX_STUDENT_IMAGE_SOURCE_EDGE = 16_384;
export const MAX_STUDENT_IMAGE_SOURCE_PIXELS = 40_000_000;

const MAX_PNG_ENCODE_ATTEMPTS = 8;
const MAX_IMAGE_HEADER_BYTES = 256 * 1024;

const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export interface DecodedStudentImage {
  readonly width: number;
  readonly height: number;
  readonly source: CanvasImageSource;
  close(): void;
}

export interface StudentImageUploadProcessor {
  decode(file: File): Promise<DecodedStudentImage>;
  encodePng(
    image: DecodedStudentImage,
    width: number,
    height: number
  ): Promise<Blob>;
}

export interface PreparedStudentImageUpload {
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly blob: Blob;
}

function matches(bytes: Uint8Array, expected: readonly number[], offset = 0): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function signatureMatches(type: string, bytes: Uint8Array): boolean {
  if (type === "image/png") {
    return matches(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  if (type === "image/jpeg") return matches(bytes, [0xff, 0xd8, 0xff]);
  if (type === "image/webp") {
    return matches(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      matches(bytes, [0x57, 0x45, 0x42, 0x50], 8);
  }
  return false;
}

interface EncodedImageDimensions {
  readonly width: number;
  readonly height: number;
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function pngDimensions(bytes: Uint8Array): EncodedImageDimensions | null {
  if (bytes.byteLength < 24 || !matches(bytes, [0x49, 0x48, 0x44, 0x52], 12)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegDimensions(bytes: Uint8Array): EncodedImageDimensions | null {
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
  ]);
  let offset = 2;
  while (offset + 1 < bytes.byteLength) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.byteLength) return null;
    const marker = bytes[offset++]!;
    if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || marker === 0xda || offset + 1 >= bytes.byteLength) return null;
    const segmentLength = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (segmentLength < 2 || offset + segmentLength > bytes.byteLength) return null;
    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) return null;
      return {
        height: (bytes[offset + 3]! << 8) | bytes[offset + 4]!,
        width: (bytes[offset + 5]! << 8) | bytes[offset + 6]!
      };
    }
    offset += segmentLength;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): EncodedImageDimensions | null {
  if (bytes.byteLength < 25) return null;
  const chunk = String.fromCharCode(...bytes.slice(12, 16));
  if (chunk === "VP8X") {
    if (bytes.byteLength < 30) return null;
    return {
      width: readUint24LittleEndian(bytes, 24) + 1,
      height: readUint24LittleEndian(bytes, 27) + 1
    };
  }
  if (chunk === "VP8L") {
    if (bytes[20] !== 0x2f) return null;
    const first = bytes[21]!;
    const second = bytes[22]!;
    const third = bytes[23]!;
    const fourth = bytes[24]!;
    return {
      width: 1 + first + ((second & 0x3f) << 8),
      height: 1 + (second >> 6) + (third << 2) + ((fourth & 0x0f) << 10)
    };
  }
  if (chunk === "VP8 ") {
    if (bytes.byteLength < 30 || !matches(bytes, [0x9d, 0x01, 0x2a], 23)) return null;
    return {
      width: (bytes[26]! | (bytes[27]! << 8)) & 0x3fff,
      height: (bytes[28]! | (bytes[29]! << 8)) & 0x3fff
    };
  }
  return null;
}

function encodedDimensions(type: string, bytes: Uint8Array): EncodedImageDimensions | null {
  if (type === "image/png") return pngDimensions(bytes);
  if (type === "image/jpeg") return jpegDimensions(bytes);
  if (type === "image/webp") return webpDimensions(bytes);
  return null;
}

function sourceDimensionsAreBounded({ width, height }: EncodedImageDimensions): boolean {
  return Number.isSafeInteger(width) && Number.isSafeInteger(height) &&
    width >= 1 && height >= 1 &&
    width <= MAX_STUDENT_IMAGE_SOURCE_EDGE && height <= MAX_STUDENT_IMAGE_SOURCE_EDGE &&
    width <= Math.floor(MAX_STUDENT_IMAGE_SOURCE_PIXELS / height);
}

function uploadTitle(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const words = withoutExtension.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  const title = words || "Uploaded drawing";
  return `${title.charAt(0).toUpperCase()}${title.slice(1)}`.slice(0, 120);
}

function targetDimensions(width: number, height: number): { width: number; height: number } {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new Error(STUDENT_COPY.assignmentSandbox.upload.errors.invalidDimensions);
  }
  const scale = Math.min(1, MAX_STUDENT_IMAGE_EDGE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

async function encodeBoundedPng(
  processor: StudentImageUploadProcessor,
  image: DecodedStudentImage,
  initial: { width: number; height: number }
): Promise<{ width: number; height: number; blob: Blob }> {
  const errors = STUDENT_COPY.assignmentSandbox.upload.errors;
  let width = initial.width;
  let height = initial.height;
  for (let attempt = 0; attempt < MAX_PNG_ENCODE_ATTEMPTS; attempt += 1) {
    const blob = await processor.encodePng(image, width, height);
    if (!(blob instanceof Blob) || blob.type !== "image/png" || blob.size === 0) {
      throw new Error(errors.preparedBounds);
    }
    if (blob.size <= MAX_ACCOUNT_ASSET_BYTES) return { width, height, blob };
    if (width === 1 && height === 1) break;
    const proportionalScale = Math.sqrt(MAX_ACCOUNT_ASSET_BYTES / blob.size) * 0.95;
    const scale = Math.min(0.9, Math.max(0.1, proportionalScale));
    const nextWidth = Math.max(1, Math.floor(width * scale));
    const nextHeight = Math.max(1, Math.floor(height * scale));
    width = width > 1 ? Math.min(width - 1, nextWidth) : 1;
    height = height > 1 ? Math.min(height - 1, nextHeight) : 1;
  }
  throw new Error(errors.preparedBounds);
}

const browserProcessor: StudentImageUploadProcessor = {
  async decode(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      close: () => bitmap.close()
    };
  },
  async encodePng(image, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      throw new Error(STUDENT_COPY.assignmentSandbox.upload.errors.browserCannotPrepare);
    }
    context.clearRect(0, 0, width, height);
    context.drawImage(image.source, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error(STUDENT_COPY.assignmentSandbox.upload.errors.encodeFailed));
      }, "image/png");
    });
  }
};

export async function prepareStudentImageUpload(
  file: File,
  processor: StudentImageUploadProcessor = browserProcessor
): Promise<PreparedStudentImageUpload> {
  const errors = STUDENT_COPY.assignmentSandbox.upload.errors;
  if (!(file instanceof File) || file.size === 0) throw new Error(errors.emptyFile);
  if (file.size > MAX_STUDENT_IMAGE_BYTES) throw new Error(errors.tooLarge);
  const mimeType = file.type.toLowerCase();
  if (!ACCEPTED_TYPES.has(mimeType)) {
    throw new Error(errors.unsupportedType);
  }
  const header = new Uint8Array(await file.slice(0, MAX_IMAGE_HEADER_BYTES).arrayBuffer());
  if (!signatureMatches(mimeType, header)) {
    throw new Error(errors.signatureMismatch);
  }
  const sourceDimensions = encodedDimensions(mimeType, header);
  if (sourceDimensions === null || !sourceDimensionsAreBounded(sourceDimensions)) {
    throw new Error(errors.invalidDimensions);
  }

  let decoded: DecodedStudentImage;
  try {
    decoded = await processor.decode(file);
  } catch {
    throw new Error(errors.decodeFailed);
  }
  try {
    if (!sourceDimensionsAreBounded(decoded)) throw new Error(errors.invalidDimensions);
    const target = targetDimensions(decoded.width, decoded.height);
    const prepared = await encodeBoundedPng(processor, decoded, target);
    const { blob } = prepared;
    const outputHeader = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    if (!signatureMatches("image/png", outputHeader)) {
      throw new Error(errors.preparedPng);
    }
    return Object.freeze({
      title: uploadTitle(file.name),
      width: prepared.width,
      height: prepared.height,
      blob
    });
  } finally {
    decoded.close();
  }
}
