import { describe, expect, it, vi } from "vitest";
import {
  MAX_STUDENT_IMAGE_BYTES,
  prepareStudentImageUpload,
  type StudentImageUploadProcessor
} from "./student-image-upload";

const signatures = {
  "image/png": Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  "image/jpeg": Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
  "image/webp": Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
  ])
} as const;

function processor(
  size = { width: 1_200, height: 800 },
  output = new Blob([signatures["image/png"]], { type: "image/png" })
): StudentImageUploadProcessor & { close: ReturnType<typeof vi.fn> } {
  const close = vi.fn();
  return {
    close,
    decode: vi.fn(async () => ({ ...size, source: {} as CanvasImageSource, close })),
    encodePng: vi.fn(async () => output)
  };
}

describe("prepareStudentImageUpload", () => {
  it.each(Object.entries(signatures))("accepts and normalises %s", async (mimeType, bytes) => {
    const imageProcessor = processor();
    const extension = mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : "webp";

    const prepared = await prepareStudentImageUpload(
      new File([bytes], `shoe-sketch.${extension}`, { type: mimeType }),
      imageProcessor
    );

    expect(prepared).toMatchObject({
      title: "Shoe sketch",
      width: 1_200,
      height: 800
    });
    expect(prepared.blob.type).toBe("image/png");
    expect(imageProcessor.encodePng).toHaveBeenCalledWith(
      expect.objectContaining({ width: 1_200, height: 800 }),
      1_200,
      800
    );
    expect(imageProcessor.close).toHaveBeenCalledOnce();
  });

  it("downscales the longest edge to 4096 while preserving aspect ratio", async () => {
    const imageProcessor = processor({ width: 6_000, height: 3_000 });

    const prepared = await prepareStudentImageUpload(
      new File([signatures["image/jpeg"]], "shoe-sketch.jpg", { type: "image/jpeg" }),
      imageProcessor
    );

    expect(prepared.width).toBe(4_096);
    expect(prepared.height).toBe(2_048);
    expect(imageProcessor.encodePng).toHaveBeenCalledWith(
      expect.anything(),
      4_096,
      2_048
    );
  });

  it.each([
    ["empty", new File([], "empty.png", { type: "image/png" })],
    ["unsupported", new File([Uint8Array.of(1)], "drawing.gif", { type: "image/gif" })],
    ["mismatch", new File([signatures["image/jpeg"]], "false.png", { type: "image/png" })],
    ["too large", new File([
      signatures["image/png"],
      new Uint8Array(MAX_STUDENT_IMAGE_BYTES - signatures["image/png"].byteLength + 1)
    ], "huge.png", { type: "image/png" })]
  ])("rejects %s input before decoding", async (_label, file) => {
    const imageProcessor = processor();

    await expect(prepareStudentImageUpload(file, imageProcessor)).rejects.toThrow();
    expect(imageProcessor.decode).not.toHaveBeenCalled();
  });

  it("closes a decoded image when decoding dimensions or PNG output are invalid", async () => {
    const invalidDimensions = processor({ width: 0, height: 200 });
    const file = new File([signatures["image/png"]], "drawing.png", { type: "image/png" });
    await expect(prepareStudentImageUpload(file, invalidDimensions)).rejects.toThrow(/dimensions/i);
    expect(invalidDimensions.close).toHaveBeenCalledOnce();

    const invalidOutput = processor(
      { width: 200, height: 100 },
      new Blob([Uint8Array.of(1)], { type: "image/jpeg" })
    );
    await expect(prepareStudentImageUpload(file, invalidOutput)).rejects.toThrow(/PNG/i);
    expect(invalidOutput.close).toHaveBeenCalledOnce();
  });

  it("reports decoder failure without attempting an encode", async () => {
    const imageProcessor: StudentImageUploadProcessor = {
      decode: vi.fn().mockRejectedValue(new Error("decoder stopped")),
      encodePng: vi.fn()
    };
    const file = new File([signatures["image/webp"]], "drawing.webp", { type: "image/webp" });

    await expect(prepareStudentImageUpload(file, imageProcessor)).rejects.toThrow(/could not be decoded/i);
    expect(imageProcessor.encodePng).not.toHaveBeenCalled();
  });
});
