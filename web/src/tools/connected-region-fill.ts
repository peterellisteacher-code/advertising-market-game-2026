export interface PixelBuffer {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface ConnectedRegionFillInput {
  readonly source: PixelBuffer;
  readonly seedX: number;
  readonly seedY: number;
  readonly colour: string;
  readonly colourDistance: number;
  readonly lineDarknessThreshold: number;
  readonly minimumAlpha: number;
  readonly maximumPixels: number;
}

export type ConnectedRegionFillResult =
  | {
      readonly status: "filled";
      readonly pixels: Uint32Array;
      readonly bounds: { x: number; y: number; width: number; height: number };
    }
  | {
      readonly status:
        | "transparent-seed"
        | "line-seed"
        | "unbounded-background"
        | "region-too-small"
        | "region-too-large";
    };

const MINIMUM_REGION_PIXELS = 20;
const MAXIMUM_COLOUR_DISTANCE = 441;
const MAXIMUM_PIXEL_INDEX = 0xffff_ffff;

function validate(input: ConnectedRegionFillInput): void {
  const { source } = input;
  if (!Number.isInteger(source.width) || !Number.isInteger(source.height) ||
    source.width < 1 || source.height < 1) {
    throw new Error("Source image dimensions must be positive integers");
  }
  const pixelCount = source.width * source.height;
  if (!Number.isSafeInteger(pixelCount) || pixelCount > MAXIMUM_PIXEL_INDEX) {
    throw new Error("Source image dimensions are too large");
  }
  if (!(source.data instanceof Uint8ClampedArray) ||
    source.data.length !== pixelCount * 4) {
    throw new Error("Source image byte length must equal width × height × 4");
  }
  if (!Number.isInteger(input.seedX) || !Number.isInteger(input.seedY) ||
    input.seedX < 0 || input.seedY < 0 ||
    input.seedX >= source.width || input.seedY >= source.height) {
    throw new Error("Seed coordinates must be integer pixels inside the source image");
  }
  if (!/^#[0-9a-f]{6}$/iu.test(input.colour)) {
    throw new Error("Fill colour must use six-digit hexadecimal notation");
  }
  if (!Number.isFinite(input.colourDistance) ||
    input.colourDistance < 0 || input.colourDistance > MAXIMUM_COLOUR_DISTANCE) {
    throw new Error("Colour distance must be from 0 to 441");
  }
  if (!Number.isInteger(input.lineDarknessThreshold) ||
    input.lineDarknessThreshold < 0 || input.lineDarknessThreshold > 255) {
    throw new Error("Line darkness threshold must be an integer from 0 to 255");
  }
  if (!Number.isInteger(input.minimumAlpha) ||
    input.minimumAlpha < 1 || input.minimumAlpha > 255) {
    throw new Error("Minimum alpha must be an integer from 1 to 255");
  }
  if (!Number.isInteger(input.maximumPixels) ||
    input.maximumPixels < 1 || input.maximumPixels > MAXIMUM_PIXEL_INDEX) {
    throw new Error("Maximum pixels must be a positive integer");
  }
}

function pixelOffset(index: number): number {
  return index * 4;
}

function isProtectedLine(
  data: Uint8ClampedArray,
  index: number,
  threshold: number
): boolean {
  const offset = pixelOffset(index);
  return (data[offset]! + data[offset + 1]! + data[offset + 2]!) / 3 <= threshold;
}

function withinColourDistance(
  data: Uint8ClampedArray,
  index: number,
  seedRed: number,
  seedGreen: number,
  seedBlue: number,
  maximumSquaredDistance: number
): boolean {
  const offset = pixelOffset(index);
  const red = data[offset]! - seedRed;
  const green = data[offset + 1]! - seedGreen;
  const blue = data[offset + 2]! - seedBlue;
  return (red * red) + (green * green) + (blue * blue) <= maximumSquaredDistance;
}

export function findConnectedRegionFill(
  input: ConnectedRegionFillInput
): ConnectedRegionFillResult {
  validate(input);
  const {
    source,
    seedX,
    seedY,
    colourDistance,
    lineDarknessThreshold,
    minimumAlpha,
    maximumPixels
  } = input;
  const totalPixels = source.width * source.height;
  const seedIndex = (seedY * source.width) + seedX;
  const seedOffset = pixelOffset(seedIndex);
  if (source.data[seedOffset + 3]! < minimumAlpha) {
    return { status: "transparent-seed" };
  }
  if (isProtectedLine(source.data, seedIndex, lineDarknessThreshold)) {
    return { status: "line-seed" };
  }

  const seedRed = source.data[seedOffset]!;
  const seedGreen = source.data[seedOffset + 1]!;
  const seedBlue = source.data[seedOffset + 2]!;
  const maximumSquaredDistance = colourDistance * colourDistance;
  const visited = new Uint8Array(totalPixels);
  const capacity = Math.min(totalPixels, maximumPixels + 1);
  const queue = new Uint32Array(capacity);
  let head = 0;
  let tail = 1;
  let unbounded = false;
  let left = seedX;
  let right = seedX;
  let top = seedY;
  let bottom = seedY;
  queue[0] = seedIndex;
  visited[seedIndex] = 1;

  while (head < tail) {
    const index = queue[head++]!;
    const x = index % source.width;
    const y = Math.floor(index / source.width);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);

    const neighbours = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1]
    ] as const;
    for (const [nextX, nextY] of neighbours) {
      if (nextX < 0 || nextY < 0 ||
        nextX >= source.width || nextY >= source.height) {
        unbounded = true;
        continue;
      }
      const nextIndex = (nextY * source.width) + nextX;
      const nextOffset = pixelOffset(nextIndex);
      if (source.data[nextOffset + 3]! < minimumAlpha) {
        unbounded = true;
        continue;
      }
      if (visited[nextIndex] ||
        isProtectedLine(source.data, nextIndex, lineDarknessThreshold) ||
        !withinColourDistance(
          source.data,
          nextIndex,
          seedRed,
          seedGreen,
          seedBlue,
          maximumSquaredDistance
        )) {
        continue;
      }
      visited[nextIndex] = 1;
      if (tail >= capacity) return { status: "region-too-large" };
      queue[tail++] = nextIndex;
      if (tail > maximumPixels) return { status: "region-too-large" };
    }
  }

  if (unbounded) return { status: "unbounded-background" };
  if (tail < MINIMUM_REGION_PIXELS) return { status: "region-too-small" };
  const pixels = queue.slice(0, tail);
  pixels.sort();
  return {
    status: "filled",
    pixels,
    bounds: {
      x: left,
      y: top,
      width: right - left + 1,
      height: bottom - top + 1
    }
  };
}
