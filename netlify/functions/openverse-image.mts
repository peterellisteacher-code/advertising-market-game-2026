import type { Config, Context } from "@netlify/functions";
import {
  OPENVERSE_API_ROOT,
  OPENVERSE_IMAGE_MAX_BYTES,
  OPENVERSE_TIMEOUT_MS,
  OpenverseError,
  countedImageStream,
  errorResponse,
  fetchSafeImage,
  hasSafeDimensions,
  imageDimensionsMatchMetadata,
  isCanonicalUuid,
  isTimeoutError,
  normalizeDisplayLicense,
  parseSafeImageContentType,
  readJsonCapped,
  readValidatedImageHeader,
  resolveHost as systemResolveHost,
  type ResolveHost
} from "./lib/openverse";

export type { ResolveHost } from "./lib/openverse";
export const MAX_IMAGE_BYTES = OPENVERSE_IMAGE_MAX_BYTES;

interface ImageDependencies {
  fetch: typeof fetch;
  resolveHost: ResolveHost;
  createDeadlineSignal: () => AbortSignal;
}

const defaultDependencies: ImageDependencies = {
  fetch: (input, init) => fetch(input, init),
  resolveHost: systemResolveHost,
  createDeadlineSignal: () => AbortSignal.timeout(OPENVERSE_TIMEOUT_MS)
};

const ownRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const parseVariant = (request: Request): "thumbnail" | "full" | null => {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => key !== "variant")) return null;
  const variants = params.getAll("variant");
  if (variants.length === 0) return "full";
  if (variants.length !== 1 || (variants[0] !== "thumbnail" && variants[0] !== "full")) return null;
  return variants[0];
};

const declaredLengthTooLarge = (response: Response): boolean => {
  const value = response.headers.get("content-length");
  return value !== null && /^\d+$/.test(value) && Number(value) > OPENVERSE_IMAGE_MAX_BYTES;
};

export function createOpenverseImageHandler(
  dependencies: ImageDependencies = defaultDependencies
): (request: Request, context: Context) => Promise<Response> {
  return async (request, context) => {
    if (request.method !== "GET") {
      return errorResponse("METHOD_NOT_ALLOWED", 405, { allow: "GET" });
    }
    const id = context.params.id;
    if (!isCanonicalUuid(id)) return errorResponse("INVALID_ID", 400);
    const variant = parseVariant(request);
    if (!variant) return errorResponse("INVALID_PARAMETERS", 400);

    const signal = dependencies.createDeadlineSignal();
    try {
      const detailResponse = await dependencies.fetch(`${OPENVERSE_API_ROOT}${id}/`, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: { accept: "application/json" }
      });
      if (!detailResponse.ok) {
        await detailResponse.body?.cancel();
        return errorResponse("UPSTREAM_ERROR", 502);
      }
      const payload = await readJsonCapped(detailResponse, signal);
      const detail = ownRecord(payload);
      if (!detail || detail.id !== id || typeof detail.mature !== "boolean" ||
        typeof detail.license !== "string" ||
        !(detail.license_version === null || detail.license_version === undefined || typeof detail.license_version === "string") ||
        !Number.isInteger(detail.width) || !Number.isInteger(detail.height) ||
        (detail.width as number) <= 0 || (detail.height as number) <= 0 ||
        typeof detail.url !== "string" || typeof detail.thumbnail !== "string") {
        return errorResponse("UPSTREAM_INVALID_RESPONSE", 502);
      }
      if (detail.mature || !normalizeDisplayLicense(detail.license, detail.license_version) ||
        !hasSafeDimensions(detail.width, detail.height)) {
        return errorResponse("IMAGE_NOT_ALLOWED", 422);
      }

      const imageResponse = await fetchSafeImage(
        variant === "thumbnail" ? detail.thumbnail : detail.url,
        { fetch: dependencies.fetch, resolveHost: dependencies.resolveHost, signal }
      );
      if (!imageResponse.ok) {
        await imageResponse.body?.cancel();
        return errorResponse("UPSTREAM_ERROR", 502);
      }
      if (declaredLengthTooLarge(imageResponse)) {
        await imageResponse.body?.cancel();
        return errorResponse("IMAGE_TOO_LARGE", 413);
      }
      const contentType = parseSafeImageContentType(imageResponse.headers.get("content-type"));
      if (!contentType) {
        await imageResponse.body?.cancel();
        return errorResponse("UNSUPPORTED_MEDIA_TYPE", 415);
      }
      if (!imageResponse.body) return errorResponse("UPSTREAM_INVALID_RESPONSE", 502);

      const { reader, initialChunks, dimensions } = await readValidatedImageHeader(
        imageResponse.body,
        contentType,
        signal
      );
      if (!hasSafeDimensions(dimensions.width, dimensions.height)) {
        await reader.cancel();
        reader.releaseLock();
        return errorResponse("IMAGE_TOO_LARGE", 413);
      }
      const metadataDimensions = {
        width: detail.width as number,
        height: detail.height as number
      };
      if (!imageDimensionsMatchMetadata(dimensions, metadataDimensions, variant)) {
        await reader.cancel();
        reader.releaseLock();
        return errorResponse("IMAGE_DIMENSIONS_MISMATCH", 422);
      }

      return new Response(countedImageStream(reader, initialChunks, signal), {
        headers: {
          "content-type": contentType,
          "cache-control": "public, max-age=3600",
          "x-content-type-options": "nosniff"
        }
      });
    } catch (error) {
      if (isTimeoutError(error, signal)) return errorResponse("UPSTREAM_TIMEOUT", 504);
      if (error instanceof OpenverseError) return errorResponse(error.code, error.status);
      return errorResponse("UPSTREAM_ERROR", 502);
    }
  };
}

export default createOpenverseImageHandler();

export const config: Config = {
  path: "/api/openverse-image/:id",
  rateLimit: {
    windowLimit: 600,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
