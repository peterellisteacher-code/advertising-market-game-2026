import { STUDENT_COPY } from "../game/student-copy";

export const MAX_STUDENT_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_STUDENT_IMAGE_EDGE = 4_096;

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
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!signatureMatches(mimeType, header)) {
    throw new Error(errors.signatureMismatch);
  }

  let decoded: DecodedStudentImage;
  try {
    decoded = await processor.decode(file);
  } catch {
    throw new Error(errors.decodeFailed);
  }
  try {
    const target = targetDimensions(decoded.width, decoded.height);
    const blob = await processor.encodePng(decoded, target.width, target.height);
    if (!(blob instanceof Blob) || blob.type !== "image/png" || blob.size === 0 ||
      blob.size > MAX_STUDENT_IMAGE_BYTES) {
      throw new Error(errors.preparedBounds);
    }
    const outputHeader = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    if (!signatureMatches("image/png", outputHeader)) {
      throw new Error(errors.preparedPng);
    }
    return Object.freeze({
      title: uploadTitle(file.name),
      width: target.width,
      height: target.height,
      blob
    });
  } finally {
    decoded.close();
  }
}
