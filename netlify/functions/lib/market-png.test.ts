// @vitest-environment node

import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { validateMarketPng } from "./market-png";

const SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < table.length; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[value] = crc >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const concat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
};

const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const typeBytes = new TextEncoder().encode(type);
  const result = new Uint8Array(12 + data.byteLength);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.byteLength);
  result.set(typeBytes, 4);
  result.set(data, 8);
  view.setUint32(8 + data.byteLength, crc32(concat(typeBytes, data)));
  return result;
};

interface PngFixtureOptions {
  readonly width?: number;
  readonly height?: number;
  readonly bitDepth?: number;
  readonly colourType?: number;
  readonly compression?: number;
  readonly filterMethod?: number;
  readonly interlace?: number;
  readonly scanlineFilter?: number;
  readonly truncateInflatedBytes?: number;
  readonly trailingCompressedByte?: number;
}

const fixturePng = (options: PngFixtureOptions = {}): Uint8Array => {
  const width = options.width ?? 1_600;
  const height = options.height ?? 900;
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr.set([
    options.bitDepth ?? 8,
    options.colourType ?? 6,
    options.compression ?? 0,
    options.filterMethod ?? 0,
    options.interlace ?? 0
  ], 8);
  const fullLength = height * (1 + width * 4);
  const raw = new Uint8Array(fullLength - (options.truncateInflatedBytes ?? 0));
  for (let row = 0; row < height && row * (1 + width * 4) < raw.byteLength; row += 1) {
    raw[row * (1 + width * 4)] = options.scanlineFilter ?? 0;
  }
  const compressed = deflateSync(raw, { level: 9 });
  return concat(
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", options.trailingCompressedByte === undefined
      ? compressed
      : concat(compressed, Uint8Array.of(options.trailingCompressedByte))),
    chunk("IEND", new Uint8Array())
  );
};

describe("validateMarketPng", () => {
  it("accepts a completely decodable 1600x900 non-interlaced RGBA8 PNG", () => {
    expect(() => validateMarketPng(fixturePng())).not.toThrow();
  });

  it("rejects header-only impostors and malformed chunk framing", () => {
    const oldHeaderOnly = new Uint8Array(45);
    oldHeaderOnly.set(SIGNATURE);
    const view = new DataView(oldHeaderOnly.buffer);
    view.setUint32(8, 13);
    oldHeaderOnly.set(new TextEncoder().encode("IHDR"), 12);
    view.setUint32(16, 1_600);
    view.setUint32(20, 900);
    oldHeaderOnly.set([8, 6, 0, 0, 0], 24);
    oldHeaderOnly.set([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82], 33);
    expect(() => validateMarketPng(oldHeaderOnly)).toThrow("INVALID_PNG");
    expect(() => validateMarketPng(fixturePng().slice(0, -1))).toThrow("INVALID_PNG");
  });

  it("rejects incorrect dimensions or any non-RGBA8/interlaced encoding", () => {
    for (const candidate of [
      fixturePng({ width: 800 }),
      fixturePng({ height: 450 }),
      fixturePng({ bitDepth: 16 }),
      fixturePng({ colourType: 2 }),
      fixturePng({ compression: 1 }),
      fixturePng({ filterMethod: 1 }),
      fixturePng({ interlace: 1 })
    ]) expect(() => validateMarketPng(candidate)).toThrow("INVALID_PNG");
  });

  it("rejects bad CRCs even when the chunk framing remains plausible", () => {
    const candidate = fixturePng().slice();
    candidate[29] = candidate[29]! ^ 0x01;
    expect(() => validateMarketPng(candidate)).toThrow("INVALID_PNG");
  });

  it("rejects corrupt zlib data, incomplete scanlines and invalid PNG filters", () => {
    const valid = fixturePng();
    const firstIdatData = 8 + 25 + 8;
    const corruptedData = valid.slice();
    corruptedData[firstIdatData + 3] = corruptedData[firstIdatData + 3]! ^ 0xff;
    const idatLength = new DataView(corruptedData.buffer).getUint32(33);
    const typeAndData = corruptedData.subarray(37, 41 + idatLength);
    new DataView(corruptedData.buffer).setUint32(41 + idatLength, crc32(typeAndData));
    expect(() => validateMarketPng(corruptedData)).toThrow("INVALID_PNG");
    expect(() => validateMarketPng(fixturePng({ truncateInflatedBytes: 1 }))).toThrow("INVALID_PNG");
    expect(() => validateMarketPng(fixturePng({ scanlineFilter: 5 }))).toThrow("INVALID_PNG");
    expect(() => validateMarketPng(fixturePng({ trailingCompressedByte: 0 })))
      .toThrow("INVALID_PNG");
  });

  it("requires contiguous IDAT chunks and forbids bytes after IEND", () => {
    const base = fixturePng();
    const idatLength = new DataView(base.buffer).getUint32(33);
    const idat = base.slice(33, 45 + idatLength);
    const ihdr = base.slice(8, 33);
    const iend = base.slice(45 + idatLength);
    const splitAt = Math.floor(idatLength / 2);
    const idatData = base.slice(41, 41 + idatLength);
    const splitWithGap = concat(
      SIGNATURE,
      ihdr,
      chunk("IDAT", idatData.slice(0, splitAt)),
      chunk("tEXt", new TextEncoder().encode("gap")),
      chunk("IDAT", idatData.slice(splitAt)),
      iend
    );
    expect(() => validateMarketPng(splitWithGap)).toThrow("INVALID_PNG");
    expect(() => validateMarketPng(concat(SIGNATURE, ihdr, idat, iend, Uint8Array.of(0))))
      .toThrow("INVALID_PNG");
  });
});
