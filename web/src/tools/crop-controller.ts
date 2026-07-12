import type { CanvasPort, CropState } from "../fabric/canvas-port";

type CropPort = Pick<CanvasPort, "getCropSourceSize" | "setCrop">;

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export class CropController {
  constructor(private readonly port: CropPort) {}

  apply(id: string, requested: CropState): CropState {
    if (!id.trim()) throw new Error("Raster id must not be empty");
    if (Object.values(requested).some((value) => !Number.isFinite(value))) {
      throw new Error("Crop values must be finite");
    }
    const source = this.port.getCropSourceSize(id);
    if (![source.width, source.height].every(Number.isFinite) ||
      source.width <= 0 || source.height <= 0) {
      throw new Error("Crop source dimensions must be positive and finite");
    }
    const visibleWidth = clamp(requested.visibleWidth, 1, source.width);
    const visibleHeight = clamp(requested.visibleHeight, 1, source.height);
    const crop: CropState = {
      cropX: clamp(requested.cropX, 0, source.width - visibleWidth),
      cropY: clamp(requested.cropY, 0, source.height - visibleHeight),
      visibleWidth,
      visibleHeight,
      focalX: clamp(requested.focalX, 0, 1),
      focalY: clamp(requested.focalY, 0, 1)
    };
    this.port.setCrop(id, crop);
    return { ...crop };
  }
}
