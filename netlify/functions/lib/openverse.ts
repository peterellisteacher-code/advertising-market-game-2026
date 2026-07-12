import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const OPENVERSE_API_ROOT = "https://api.openverse.org/v1/images/";
export const OPENVERSE_JSON_MAX_BYTES = 1_048_576;
export const OPENVERSE_IMAGE_MAX_BYTES = 12 * 1_048_576;
export const OPENVERSE_IMAGE_HEADER_MAX_BYTES = 128 * 1_024;
export const OPENVERSE_MAX_IMAGE_DIMENSION = 16_384;
export const OPENVERSE_MAX_IMAGE_PIXELS = 64_000_000;
export const OPENVERSE_TIMEOUT_MS = 8_000;
export const OPENVERSE_MAX_REDIRECTS = 3;

export const CANONICAL_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type OpenverseErrorCode =
  | "METHOD_NOT_ALLOWED"
  | "INVALID_PARAMETERS"
  | "INVALID_ID"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_ERROR"
  | "UPSTREAM_INVALID_RESPONSE"
  | "UPSTREAM_RESPONSE_TOO_LARGE"
  | "IMAGE_NOT_ALLOWED"
  | "UNSAFE_MEDIA_URL"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "MIME_SIGNATURE_MISMATCH"
  | "INVALID_IMAGE_HEADER"
  | "IMAGE_DIMENSIONS_MISMATCH"
  | "IMAGE_TOO_LARGE"
  | "REDIRECT_LOOP"
  | "TOO_MANY_REDIRECTS";

export class OpenverseError extends Error {
  constructor(
    readonly code: OpenverseErrorCode,
    readonly status: number
  ) {
    super(code);
    this.name = "OpenverseError";
  }
}

export interface OpenverseResult {
  id: string;
  title: string;
  creator: string;
  license: string;
  sourceUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type ResolveHost = (hostname: string) => Promise<ResolvedAddress[]>;

export const resolveHost: ResolveHost = async (hostname) =>
  await lookup(hostname, { all: true, verbatim: true }) as ResolvedAddress[];

export function errorResponse(
  code: OpenverseErrorCode,
  status: number,
  extraHeaders: HeadersInit = {}
): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...Object.fromEntries(new Headers(extraHeaders))
    }
  });
}

export const isCanonicalUuid = (value: unknown): value is string =>
  typeof value === "string" && CANONICAL_UUID_PATTERN.test(value);

const DISPLAY_LICENSES: Readonly<Record<string, string>> = {
  by: "CC BY",
  "by-nc": "CC BY-NC",
  "by-nc-nd": "CC BY-NC-ND",
  "by-nc-sa": "CC BY-NC-SA",
  "by-nd": "CC BY-ND",
  "by-sa": "CC BY-SA",
  cc0: "CC0",
  "nc-sampling+": "NC Sampling+",
  pdm: "Public Domain Mark",
  "sampling+": "Sampling+"
};

const MODIFICATION_FORBIDDEN = new Set(["by-nd", "by-nc-nd"]);

export function normalizeDisplayLicense(
  license: unknown,
  version: unknown
): string | null {
  if (typeof license !== "string" || license !== license.trim().toLowerCase()) return null;
  const display = DISPLAY_LICENSES[license];
  if (!display || MODIFICATION_FORBIDDEN.has(license)) return null;
  if (version === null || version === undefined || version === "") return display;
  if (typeof version !== "string" || !/^\d+(?:\.\d+)*$/.test(version)) return null;
  return `${display} ${version}`;
}

export function hasSafeDimensions(width: unknown, height: unknown): boolean {
  return Number.isInteger(width) && Number.isInteger(height) &&
    (width as number) > 0 && (height as number) > 0 &&
    (width as number) <= OPENVERSE_MAX_IMAGE_DIMENSION &&
    (height as number) <= OPENVERSE_MAX_IMAGE_DIMENSION &&
    (width as number) * (height as number) <= OPENVERSE_MAX_IMAGE_PIXELS;
}

export function safeAttributionUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

const timeoutError = (): DOMException => new DOMException("Openverse deadline exceeded", "TimeoutError");

const readWithSignal = async <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) throw timeoutError();
  return await new Promise<T>((resolve, reject) => {
    const abort = (): void => reject(timeoutError());
    signal.addEventListener("abort", abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      }
    );
  });
};

export async function readLimitedBytes(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
  tooLargeCode: OpenverseErrorCode = "UPSTREAM_RESPONSE_TOO_LARGE"
): Promise<Uint8Array> {
  const declared = response.headers.get("content-length");
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxBytes) {
    throw new OpenverseError(tooLargeCode, tooLargeCode === "IMAGE_TOO_LARGE" ? 413 : 502);
  }
  if (!response.body) return new Uint8Array();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await readWithSignal(reader.read(), signal);
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new OpenverseError(tooLargeCode, tooLargeCode === "IMAGE_TOO_LARGE" ? 413 : 502);
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readJsonCapped(
  response: Response,
  signal: AbortSignal,
  maxBytes = OPENVERSE_JSON_MAX_BYTES
): Promise<unknown> {
  try {
    const bytes = await readLimitedBytes(response, maxBytes, signal);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof OpenverseError) throw error;
    if (isTimeoutError(error, signal)) throw error;
    throw new OpenverseError("UPSTREAM_INVALID_RESPONSE", 502);
  }
}

export function isTimeoutError(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  return error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError") ||
    error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

const parseIpv4 = (address: string): number | null => {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
};

const ipv4InRange = (value: number, base: string, bits: number): boolean => {
  const start = parseIpv4(base);
  if (start === null) return true;
  const blockSize = 2 ** (32 - bits);
  return Math.floor(value / blockSize) === Math.floor(start / blockSize);
};

const BLOCKED_IPV4_RANGES: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4]
];

const isPublicIpv4 = (address: string): boolean => {
  const value = parseIpv4(address);
  return value !== null && !BLOCKED_IPV4_RANGES.some(([base, bits]) => ipv4InRange(value, base, bits));
};

const parseIpv6 = (rawAddress: string): number[] | null => {
  let address = rawAddress.toLowerCase().replace(/^\[|\]$/g, "");
  if (address.includes("%")) return null;
  if (address.includes(".")) {
    const lastColon = address.lastIndexOf(":");
    const ipv4 = parseIpv4(address.slice(lastColon + 1));
    if (lastColon < 0 || ipv4 === null) return null;
    address = `${address.slice(0, lastColon)}:${(ipv4 >>> 16).toString(16)}:${(ipv4 & 0xffff).toString(16)}`;
  }
  if (address.split("::").length > 2) return null;
  const [leftText, rightText] = address.split("::") as [string, string?];
  const left = leftText ? leftText.split(":") : [];
  const right = rightText ? rightText.split(":") : [];
  if (rightText === undefined && left.length !== 8) return null;
  const missing = rightText === undefined ? 0 : 8 - left.length - right.length;
  if (missing < 1 && rightText !== undefined) return null;
  const parts = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (parts.length !== 8 || parts.some((part) => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return parts.map((part) => Number.parseInt(part, 16));
};

const isPublicIpv6 = (address: string): boolean => {
  const parts = parseIpv6(address);
  if (!parts) return false;
  const [a, b, c, d, e, f, g, h] = parts as [number, number, number, number, number, number, number, number];

  if (a === 0 && b === 0 && c === 0 && d === 0 && e === 0 && f === 0xffff) {
    return isPublicIpv4(`${g >>> 8}.${g & 255}.${h >>> 8}.${h & 255}`);
  }
  if ((a & 0xe000) !== 0x2000) return false;
  if (a === 0x2001 && b <= 0x01ff) return false;
  if (a === 0x2001 && b === 0x0db8) return false;
  if (a === 0x2002) return false;
  if ((a & 0xfff0) === 0x3ff0) return false;
  return true;
};

export function isPublicAddress(address: string): boolean {
  const family = isIP(address.replace(/^\[|\]$/g, ""));
  return family === 4 ? isPublicIpv4(address) : family === 6 ? isPublicIpv6(address) : false;
}

export async function validateRemoteMediaUrl(
  value: unknown,
  resolver: ResolveHost,
  signal: AbortSignal
): Promise<URL> {
  if (signal.aborted) throw timeoutError();
  if (typeof value !== "string") throw new OpenverseError("UNSAFE_MEDIA_URL", 422);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new OpenverseError("UNSAFE_MEDIA_URL", 422);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) {
    throw new OpenverseError("UNSAFE_MEDIA_URL", 422);
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new OpenverseError("UNSAFE_MEDIA_URL", 422);
  }

  const family = isIP(hostname);
  if (family > 0) {
    if (!isPublicAddress(hostname)) throw new OpenverseError("UNSAFE_MEDIA_URL", 422);
    return url;
  }

  let addresses: ResolvedAddress[];
  try {
    addresses = await readWithSignal(resolver(hostname), signal);
  } catch (error) {
    if (isTimeoutError(error, signal)) throw error;
    throw new OpenverseError("UNSAFE_MEDIA_URL", 422);
  }
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new OpenverseError("UNSAFE_MEDIA_URL", 422);
  }

  // This preflight rejects known non-public resolutions but cannot pin fetch's
  // later DNS lookup. DNS rebinding remains a platform-level residual risk.
  return url;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export async function fetchSafeImage(
  initialUrl: unknown,
  dependencies: {
    fetch: typeof fetch;
    resolveHost: ResolveHost;
    signal: AbortSignal;
  }
): Promise<Response> {
  let current = await validateRemoteMediaUrl(
    initialUrl,
    dependencies.resolveHost,
    dependencies.signal
  );
  const visited = new Set([current.href]);

  for (let redirectCount = 0; ; redirectCount += 1) {
    const response = await dependencies.fetch(current.href, {
      method: "GET",
      redirect: "manual",
      signal: dependencies.signal,
      headers: { accept: "image/png, image/jpeg, image/webp" }
    });
    if (!REDIRECT_STATUSES.has(response.status)) return response;
    if (redirectCount >= OPENVERSE_MAX_REDIRECTS) {
      await response.body?.cancel();
      throw new OpenverseError("TOO_MANY_REDIRECTS", 502);
    }
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) throw new OpenverseError("UPSTREAM_INVALID_RESPONSE", 502);

    let candidate: URL;
    try {
      candidate = new URL(location, current);
    } catch {
      throw new OpenverseError("UNSAFE_MEDIA_URL", 422);
    }
    const next = await validateRemoteMediaUrl(
      candidate.href,
      dependencies.resolveHost,
      dependencies.signal
    );
    if (visited.has(next.href)) throw new OpenverseError("REDIRECT_LOOP", 502);
    visited.add(next.href);
    current = next;
  }
}

export type SafeImageContentType = "image/png" | "image/jpeg" | "image/webp";

export function parseSafeImageContentType(value: string | null): SafeImageContentType | null {
  if (!value) return null;
  const normalized = value.split(";", 1)[0]?.trim().toLowerCase();
  return normalized === "image/png" || normalized === "image/jpeg" || normalized === "image/webp"
    ? normalized
    : null;
}

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  signature.every((byte, index) => bytes[index] === byte);

export function signatureMatches(type: SafeImageContentType, bytes: Uint8Array): boolean {
  if (type === "image/png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (type === "image/jpeg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50]);
}

export interface ImageDimensions {
  width: number;
  height: number;
}

type DimensionParseResult =
  | { status: "found"; dimensions: ImageDimensions }
  | { status: "need-more" }
  | { status: "invalid" };

const needMore = (): DimensionParseResult => ({ status: "need-more" });
const invalidHeader = (): DimensionParseResult => ({ status: "invalid" });
const foundDimensions = (width: number, height: number): DimensionParseResult =>
  width > 0 && height > 0
    ? { status: "found", dimensions: { width, height } }
    : invalidHeader();

const parsePngDimensions = (bytes: Uint8Array): DimensionParseResult => {
  if (bytes.byteLength < 24) return needMore();
  if (!startsWith(bytes.subarray(12), [0x49, 0x48, 0x44, 0x52])) return invalidHeader();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(8) !== 13) return invalidHeader();
  return foundDimensions(view.getUint32(16), view.getUint32(20));
};

const JPEG_SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3,
  0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb,
  0xcd, 0xce, 0xcf
]);

const parseJpegDimensions = (bytes: Uint8Array): DimensionParseResult => {
  if (bytes.byteLength < 3) return needMore();
  let offset = 2;
  while (offset < bytes.byteLength) {
    if (bytes[offset] !== 0xff) return invalidHeader();
    while (offset < bytes.byteLength && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.byteLength) return needMore();
    const marker = bytes[offset++]!;

    if (marker === 0xd9 || marker === 0xda) return invalidHeader();
    if (marker === 0x00) return invalidHeader();
    if (marker === 0xd8 || marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > bytes.byteLength) return needMore();
    const segmentLength = (bytes[offset]! << 8) | bytes[offset + 1]!;
    if (segmentLength < 2) return invalidHeader();
    const segmentEnd = offset + segmentLength;

    if (JPEG_SOF_MARKERS.has(marker)) {
      if (segmentLength < 8) return invalidHeader();
      if (offset + 7 > bytes.byteLength) return needMore();
      const height = (bytes[offset + 3]! << 8) | bytes[offset + 4]!;
      const width = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
      return foundDimensions(width, height);
    }
    if (segmentEnd > bytes.byteLength) return needMore();
    offset = segmentEnd;
  }
  return needMore();
};

const uint24le = (bytes: Uint8Array, offset: number): number =>
  bytes[offset]! | bytes[offset + 1]! << 8 | bytes[offset + 2]! << 16;

const parseWebpDimensions = (bytes: Uint8Array): DimensionParseResult => {
  if (bytes.byteLength < 16) return needMore();
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));
  if (chunk === "VP8X") {
    if (bytes.byteLength < 30) return needMore();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(16, true) < 10) return invalidHeader();
    return foundDimensions(uint24le(bytes, 24) + 1, uint24le(bytes, 27) + 1);
  }
  if (chunk === "VP8L") {
    if (bytes.byteLength < 25) return needMore();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(16, true) < 5 || bytes[20] !== 0x2f) return invalidHeader();
    const packed = bytes[21]! | bytes[22]! << 8 | bytes[23]! << 16 | bytes[24]! << 24;
    const width = (packed & 0x3fff) + 1;
    const height = ((packed >>> 14) & 0x3fff) + 1;
    return foundDimensions(width, height);
  }
  if (chunk === "VP8 ") {
    if (bytes.byteLength < 30) return needMore();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(16, true) < 10 || !startsWith(bytes.subarray(23), [0x9d, 0x01, 0x2a])) {
      return invalidHeader();
    }
    return foundDimensions(view.getUint16(26, true) & 0x3fff, view.getUint16(28, true) & 0x3fff);
  }
  return invalidHeader();
};

const parseImageDimensions = (
  type: SafeImageContentType,
  bytes: Uint8Array
): DimensionParseResult => {
  if (type === "image/png") return parsePngDimensions(bytes);
  if (type === "image/jpeg") return parseJpegDimensions(bytes);
  return parseWebpDimensions(bytes);
};

const signatureLength = (type: SafeImageContentType): number =>
  type === "image/png" ? 8 : type === "image/jpeg" ? 3 : 12;

export async function readValidatedImageHeader(
  body: ReadableStream<Uint8Array>,
  type: SafeImageContentType,
  signal: AbortSignal,
  maxHeaderBytes = OPENVERSE_IMAGE_HEADER_MAX_BYTES
): Promise<{
  reader: ReadableStreamDefaultReader<Uint8Array>;
  initialChunks: Uint8Array[];
  dimensions: ImageDimensions;
}> {
  const reader = body.getReader();
  const initialChunks: Uint8Array[] = [];
  let header = new Uint8Array();

  try {
    while (header.byteLength < maxHeaderBytes) {
      const next = await readWithSignal(reader.read(), signal);
      if (next.done) throw new OpenverseError("INVALID_IMAGE_HEADER", 415);
      initialChunks.push(next.value);

      const copyLength = Math.min(next.value.byteLength, maxHeaderBytes - header.byteLength);
      const expanded = new Uint8Array(header.byteLength + copyLength);
      expanded.set(header);
      expanded.set(next.value.subarray(0, copyLength), header.byteLength);
      header = expanded;

      if (header.byteLength >= signatureLength(type) && !signatureMatches(type, header)) {
        throw new OpenverseError("MIME_SIGNATURE_MISMATCH", 415);
      }
      if (header.byteLength < signatureLength(type)) continue;

      const parsed = parseImageDimensions(type, header);
      if (parsed.status === "found") {
        return { reader, initialChunks, dimensions: parsed.dimensions };
      }
      if (parsed.status === "invalid") throw new OpenverseError("INVALID_IMAGE_HEADER", 415);
    }
    throw new OpenverseError("INVALID_IMAGE_HEADER", 415);
  } catch (error) {
    try {
      await reader.cancel(error);
    } catch {
      // The upstream reader may already be closed or errored.
    }
    reader.releaseLock();
    throw error;
  }
}

export function imageDimensionsMatchMetadata(
  actual: ImageDimensions,
  metadata: ImageDimensions,
  variant: "thumbnail" | "full"
): boolean {
  if (variant === "full") {
    return actual.width === metadata.width && actual.height === metadata.height;
  }
  if (actual.width > metadata.width || actual.height > metadata.height) return false;
  const expectedCrossProduct = actual.height * metadata.width;
  const ratioDifference = Math.abs(actual.width * metadata.height - expectedCrossProduct);
  return expectedCrossProduct > 0 && ratioDifference / expectedCrossProduct <= 0.05;
}

export function countedImageStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  initialChunks: Uint8Array[],
  signal: AbortSignal,
  maxBytes = OPENVERSE_IMAGE_MAX_BYTES
): ReadableStream<Uint8Array> {
  let initialIndex = 0;
  let emitted = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (signal.aborted) throw timeoutError();
        const next = initialIndex < initialChunks.length
          ? { done: false as const, value: initialChunks[initialIndex++]! }
          : await readWithSignal(reader.read(), signal);
        if (next.done) {
          reader.releaseLock();
          controller.close();
          return;
        }
        if (emitted + next.value.byteLength > maxBytes) {
          await reader.cancel("IMAGE_TOO_LARGE");
          throw new Error("IMAGE_TOO_LARGE");
        }
        emitted += next.value.byteLength;
        controller.enqueue(next.value);
      } catch (error) {
        try {
          await reader.cancel(error);
        } catch {
          // The upstream reader may already be errored or released.
        }
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } catch {
        // Cancellation is best effort after the client disconnects.
      }
    }
  });
}
