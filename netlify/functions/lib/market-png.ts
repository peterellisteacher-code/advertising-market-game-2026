import { inflateSync } from "node:zlib";

const WIDTH = 1_600;
const HEIGHT = 900;
const BYTES_PER_PIXEL = 4;
const SCANLINE_BYTES = 1 + WIDTH * BYTES_PER_PIXEL;
const INFLATED_BYTES = HEIGHT * SCANLINE_BYTES;
const SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const KNOWN_CRITICAL_CHUNKS = new Set(["IHDR", "PLTE", "IDAT", "IEND"]);

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

export class MarketPngError extends Error {
  constructor() {
    super("INVALID_PNG");
    this.name = "MarketPngError";
  }
}

const invalid = (): never => {
  throw new MarketPngError();
};

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const equalBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && left.every((byte, index) => byte === right[index]);

const chunkType = (bytes: Uint8Array): string => {
  if (bytes.byteLength !== 4 || bytes.some((byte) =>
    !(byte >= 0x41 && byte <= 0x5a) && !(byte >= 0x61 && byte <= 0x7a))) invalid();
  return String.fromCharCode(...bytes);
};

const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
};

export function validateMarketPng(bytes: Uint8Array): void {
  if (bytes.byteLength < SIGNATURE.byteLength + 12 ||
    !equalBytes(bytes.subarray(0, SIGNATURE.byteLength), SIGNATURE)) invalid();

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const idatParts: Uint8Array[] = [];
  let offset = SIGNATURE.byteLength;
  let chunkIndex = 0;
  let sawIhdr = false;
  let sawPlte = false;
  let sawIdat = false;
  let idatEnded = false;
  let sawIend = false;

  while (offset < bytes.byteLength) {
    if (sawIend || bytes.byteLength - offset < 12) invalid();
    const length = view.getUint32(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd < offset || chunkEnd > bytes.byteLength) invalid();
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = chunkType(typeBytes);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = view.getUint32(offset + 8 + length);
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== expectedCrc) invalid();

    if (chunkIndex === 0 && type !== "IHDR") invalid();
    if (!KNOWN_CRITICAL_CHUNKS.has(type) && (typeBytes[0]! & 0x20) === 0) invalid();

    if (type === "IHDR") {
      if (sawIhdr || chunkIndex !== 0 || length !== 13) invalid();
      const header = new DataView(data.buffer, data.byteOffset, data.byteLength);
      if (header.getUint32(0) !== WIDTH || header.getUint32(4) !== HEIGHT ||
        data[8] !== 8 || data[9] !== 6 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) {
        invalid();
      }
      sawIhdr = true;
    } else if (!sawIhdr) {
      invalid();
    } else if (type === "PLTE") {
      if (sawPlte || sawIdat || length === 0 || length > 768 || length % 3 !== 0) invalid();
      sawPlte = true;
    } else if (type === "IDAT") {
      if (idatEnded || length === 0) invalid();
      sawIdat = true;
      idatParts.push(data);
    } else if (type === "IEND") {
      if (!sawIdat || length !== 0) invalid();
      sawIend = true;
      if (chunkEnd !== bytes.byteLength) invalid();
    } else if (sawIdat) {
      idatEnded = true;
    }

    offset = chunkEnd;
    chunkIndex += 1;
  }

  if (!sawIhdr || !sawIdat || !sawIend || offset !== bytes.byteLength) invalid();

  const compressed = concat(idatParts);
  const inflated: Uint8Array = (() => {
    try {
      const result = inflateSync(compressed, {
        info: true,
        maxOutputLength: INFLATED_BYTES
      }) as unknown as { buffer: Uint8Array; engine: { bytesWritten: number } };
      if (result.engine.bytesWritten !== compressed.byteLength) invalid();
      return result.buffer;
    } catch {
      return invalid();
    }
  })();
  if (inflated.byteLength !== INFLATED_BYTES) invalid();
  for (let row = 0; row < HEIGHT; row += 1) {
    if (inflated[row * SCANLINE_BYTES]! > 4) invalid();
  }
}
