import { describe, expect, it } from "vitest";
import {
  findConnectedRegionFill,
  type ConnectedRegionFillInput,
  type PixelBuffer
} from "./connected-region-fill";

type Pixel = readonly [number, number, number, number];

const WHITE: Pixel = [255, 255, 255, 255];
const BLACK: Pixel = [0, 0, 0, 255];
const TRANSPARENT: Pixel = [0, 0, 0, 0];

function buffer(width: number, height: number, colour: Pixel = WHITE): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data.set(colour, index * 4);
  }
  return { width, height, data };
}

function setPixel(source: PixelBuffer, x: number, y: number, colour: Pixel): void {
  source.data.set(colour, ((y * source.width) + x) * 4);
}

function outline(
  source: PixelBuffer,
  left: number,
  top: number,
  right: number,
  bottom: number,
  colour: Pixel = BLACK
): void {
  for (let x = left; x <= right; x += 1) {
    setPixel(source, x, top, colour);
    setPixel(source, x, bottom, colour);
  }
  for (let y = top; y <= bottom; y += 1) {
    setPixel(source, left, y, colour);
    setPixel(source, right, y, colour);
  }
}

function input(
  source: PixelBuffer,
  overrides: Partial<ConnectedRegionFillInput> = {}
): ConnectedRegionFillInput {
  return {
    source,
    seedX: 2,
    seedY: 2,
    colour: "#E4572E",
    colourDistance: 48,
    lineDarknessThreshold: 220,
    minimumAlpha: 200,
    maximumPixels: source.width * source.height,
    ...overrides
  };
}

function filledPixels(result: ReturnType<typeof findConnectedRegionFill>): number[] {
  expect(result.status).toBe("filled");
  if (result.status !== "filled") return [];
  return [...result.pixels];
}

describe("findConnectedRegionFill", () => {
  it("finds one closed white region bounded by opaque black linework", () => {
    const source = buffer(8, 8);
    outline(source, 0, 0, 7, 7);

    const result = findConnectedRegionFill(input(source));

    expect(result).toMatchObject({
      status: "filled",
      bounds: { x: 1, y: 1, width: 6, height: 6 }
    });
    expect(filledPixels(result)).toHaveLength(36);
  });

  it("keeps adjacent sections separate across a one-pixel antialiased boundary", () => {
    const source = buffer(16, 16);
    outline(source, 0, 0, 15, 15);
    for (let y = 1; y < 15; y += 1) {
      setPixel(source, 8, y, [180, 180, 180, 220]);
    }

    const result = findConnectedRegionFill(input(source, {
      seedX: 3,
      seedY: 7
    }));

    expect(result).toMatchObject({
      status: "filled",
      bounds: { x: 1, y: 1, width: 7, height: 14 }
    });
    expect(filledPixels(result)).toHaveLength(98);
    expect(filledPixels(result)).not.toContain((7 * 16) + 9);
  });

  it("rejects a transparent seed and a seed on protected linework", () => {
    const transparent = buffer(8, 8, TRANSPARENT);
    expect(findConnectedRegionFill(input(transparent))).toEqual({
      status: "transparent-seed"
    });

    const outlined = buffer(8, 8);
    outline(outlined, 0, 0, 7, 7);
    expect(findConnectedRegionFill(input(outlined, { seedX: 0, seedY: 4 }))).toEqual({
      status: "line-seed"
    });
  });

  it("rejects an open outline that leaks to the image edge", () => {
    const source = buffer(8, 8);
    outline(source, 0, 0, 7, 7);
    setPixel(source, 3, 0, WHITE);

    expect(findConnectedRegionFill(input(source))).toEqual({
      status: "unbounded-background"
    });
  });

  it("rejects a region that touches transparent background", () => {
    const source = buffer(8, 8);
    outline(source, 0, 0, 7, 7);
    setPixel(source, 4, 4, TRANSPARENT);

    expect(findConnectedRegionFill(input(source))).toEqual({
      status: "unbounded-background"
    });
  });

  it("uses Euclidean colour-distance tolerance from the seed", () => {
    const source = buffer(8, 8);
    outline(source, 0, 0, 7, 7);
    setPixel(source, 4, 4, [240, 240, 240, 255]);

    const included = findConnectedRegionFill(input(source, {
      colourDistance: 30
    }));
    const excluded = findConnectedRegionFill(input(source, {
      colourDistance: 20
    }));

    expect(filledPixels(included)).toContain((4 * 8) + 4);
    expect(filledPixels(excluded)).not.toContain((4 * 8) + 4);
  });

  it("enforces the maximum-pixel ceiling without recursive growth", () => {
    const source = buffer(8, 8);
    outline(source, 0, 0, 7, 7);

    expect(findConnectedRegionFill(input(source, { maximumPixels: 25 }))).toEqual({
      status: "region-too-large"
    });
  });

  it("rejects bounded noise smaller than the certified twenty-pixel floor", () => {
    const source = buffer(16, 16, TRANSPARENT);
    outline(source, 1, 1, 5, 5);
    for (let y = 2; y <= 4; y += 1) {
      for (let x = 2; x <= 4; x += 1) setPixel(source, x, y, WHITE);
    }

    expect(findConnectedRegionFill(input(source, {
      seedX: 3,
      seedY: 3
    }))).toEqual({
      status: "region-too-small"
    });
  });

  it("returns deterministic row-major indices and does not mutate source bytes", () => {
    const source = buffer(8, 8);
    outline(source, 0, 0, 7, 7);
    const before = source.data.slice();
    const expected = Array.from({ length: 6 }, (_, row) =>
      Array.from({ length: 6 }, (_, column) => ((row + 1) * 8) + column + 1)
    ).flat();

    const first = findConnectedRegionFill(input(source));
    const second = findConnectedRegionFill(input(source));

    expect(filledPixels(first)).toEqual(expected);
    expect(filledPixels(second)).toEqual(expected);
    expect(source.data).toEqual(before);
  });

  it.each([
    ["zero width", { source: { width: 0, height: 8, data: new Uint8ClampedArray() } }, /dimensions/i],
    ["fractional height", {
      source: { width: 8, height: 7.5, data: new Uint8ClampedArray(8 * 7 * 4) }
    }, /dimensions/i],
    ["wrong byte length", {
      source: { width: 8, height: 8, data: new Uint8ClampedArray(12) }
    }, /byte length/i],
    ["negative coordinate", { seedX: -1 }, /coordinates/i],
    ["fractional coordinate", { seedY: 2.5 }, /coordinates/i],
    ["outside coordinate", { seedX: 8 }, /coordinates/i],
    ["short colour", { colour: "#fff" }, /colour/i],
    ["invalid colour", { colour: "#GG0000" }, /colour/i],
    ["negative distance", { colourDistance: -1 }, /colour distance/i],
    ["excess distance", { colourDistance: 442 }, /colour distance/i],
    ["invalid line threshold", { lineDarknessThreshold: 256 }, /line darkness/i],
    ["invalid alpha", { minimumAlpha: 0 }, /minimum alpha/i],
    ["zero maximum", { maximumPixels: 0 }, /maximum pixels/i],
    ["fractional maximum", { maximumPixels: 2.5 }, /maximum pixels/i]
  ])("rejects invalid input: %s", (_label, override, message) => {
    const source = buffer(8, 8);
    expect(() => findConnectedRegionFill(input(source, override as Partial<ConnectedRegionFillInput>)))
      .toThrow(message as RegExp);
  });
});
