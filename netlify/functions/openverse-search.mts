import type { Config, Context } from "@netlify/functions";
import {
  OPENVERSE_API_ROOT,
  OPENVERSE_TIMEOUT_MS,
  OpenverseError,
  errorResponse,
  hasSafeDimensions,
  isCanonicalUuid,
  isTimeoutError,
  normalizeDisplayLicense,
  readJsonCapped,
  safeAttributionUrl,
  type OpenverseResult
} from "./lib/openverse";

interface SearchDependencies {
  fetch: typeof fetch;
  createDeadlineSignal: () => AbortSignal;
}

const defaultDependencies: SearchDependencies = {
  fetch: (input, init) => fetch(input, init),
  createDeadlineSignal: () => AbortSignal.timeout(OPENVERSE_TIMEOUT_MS)
};

const ownRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const nonemptyText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
};

const mapRecord = (value: unknown): OpenverseResult | null => {
  const record = ownRecord(value);
  if (!record || record.mature !== false || !isCanonicalUuid(record.id)) return null;
  const title = nonemptyText(record.title);
  const creator = nonemptyText(record.creator);
  const license = normalizeDisplayLicense(record.license, record.license_version);
  const sourceUrl = safeAttributionUrl(record.foreign_landing_url);
  if (!title || !creator || !license || !sourceUrl || !hasSafeDimensions(record.width, record.height)) {
    return null;
  }

  return {
    id: record.id,
    title,
    creator,
    license,
    sourceUrl,
    thumbnailUrl: `/api/openverse-image/${record.id}?variant=thumbnail`,
    width: record.width as number,
    height: record.height as number
  };
};

const parseSearchRequest = (request: Request): { q: string; page: string } | null => {
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some((key) => key !== "q" && key !== "page")) return null;
  const queries = params.getAll("q");
  const pages = params.getAll("page");
  if (queries.length !== 1 || pages.length > 1) return null;

  const q = queries[0]!.trim();
  const length = Array.from(q).length;
  if (length < 2 || length > 80) return null;
  const page = pages.length === 0 ? "1" : pages[0]!;
  if (!/^(?:[1-9]|1\d|20)$/.test(page)) return null;
  return { q, page };
};

export function createOpenverseSearchHandler(
  dependencies: SearchDependencies = defaultDependencies
): (request: Request, context: Context) => Promise<Response> {
  return async (request) => {
    if (request.method !== "GET") {
      return errorResponse("METHOD_NOT_ALLOWED", 405, { allow: "GET" });
    }
    const input = parseSearchRequest(request);
    if (!input) return errorResponse("INVALID_PARAMETERS", 400);

    const upstream = new URL(OPENVERSE_API_ROOT);
    upstream.search = new URLSearchParams({
      q: input.q,
      page: input.page,
      page_size: "30",
      mature: "false",
      category: "photograph",
      license_type: "modification"
    }).toString();
    const signal = dependencies.createDeadlineSignal();

    try {
      const response = await dependencies.fetch(upstream.href, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: { accept: "application/json" }
      });
      if (!response.ok) {
        await response.body?.cancel();
        return errorResponse("UPSTREAM_ERROR", 502);
      }
      const payload = await readJsonCapped(response, signal);
      const object = ownRecord(payload);
      if (!object || !Array.isArray(object.results)) {
        return errorResponse("UPSTREAM_INVALID_RESPONSE", 502);
      }
      const records = object.results
        .map(mapRecord)
        .filter((record): record is OpenverseResult => record !== null)
        .slice(0, 30);
      return Response.json({ records }, {
        headers: { "cache-control": "public, max-age=300" }
      });
    } catch (error) {
      if (isTimeoutError(error, signal)) return errorResponse("UPSTREAM_TIMEOUT", 504);
      if (error instanceof OpenverseError) return errorResponse(error.code, error.status);
      return errorResponse("UPSTREAM_ERROR", 502);
    }
  };
}

export default createOpenverseSearchHandler();

export const config: Config = {
  path: "/api/openverse-search",
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
