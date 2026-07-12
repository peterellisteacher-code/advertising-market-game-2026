import type { CatalogAssetV1 } from "./catalogue-types";

const SEARCH_PATH = "/api/openverse-search";
const IMAGE_PATH = "/api/openverse-image";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RECORDS = 20;
const MAX_IMAGE_DIMENSION = 16_384;
const MAX_IMAGE_PIXELS = 64_000_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export interface OpenverseClientOptions {
  enabled?: boolean;
  fetch?: typeof fetch;
  online?: () => boolean;
  createDeadlineSignal?: () => AbortSignal;
}

export type OpenverseSearchResult =
  | { status: "online"; records: CatalogAssetV1[] }
  | { status: "offline"; records: [] };

interface RemoteRecord {
  id: string;
  title: string;
  creator: string;
  license: string;
  sourceUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
}

const offlineResult = (): OpenverseSearchResult => ({ status: "offline", records: [] });

const nonemptyText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isSafeSourceUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
};

const hasSafeDimensions = (width: unknown, height: unknown): boolean =>
  Number.isInteger(width) && Number.isInteger(height) &&
  (width as number) > 0 && (height as number) > 0 &&
  (width as number) <= MAX_IMAGE_DIMENSION &&
  (height as number) <= MAX_IMAGE_DIMENSION &&
  (width as number) * (height as number) <= MAX_IMAGE_PIXELS;

const parseRemoteRecord = (value: unknown): RemoteRecord | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const exactKeys = [
    "creator", "height", "id", "license", "sourceUrl", "thumbnailUrl", "title", "width"
  ];
  if (Object.keys(record).sort().join("\0") !== exactKeys.join("\0") ||
    typeof record.id !== "string" || !UUID_PATTERN.test(record.id) ||
    !nonemptyText(record.title) || !nonemptyText(record.creator) || !nonemptyText(record.license) ||
    typeof record.sourceUrl !== "string" || !isSafeSourceUrl(record.sourceUrl) ||
    !hasSafeDimensions(record.width, record.height)) {
    return null;
  }
  const expectedThumbnail = `${IMAGE_PATH}/${record.id}?variant=thumbnail`;
  if (record.thumbnailUrl !== expectedThumbnail) return null;
  return record as unknown as RemoteRecord;
};

const toCatalogAsset = (record: RemoteRecord): CatalogAssetV1 => {
  const full = `${IMAGE_PATH}/${record.id}`;
  return {
    schema: "catalog-asset@1",
    id: record.id,
    version: 1,
    kind: "photo",
    title: record.title,
    category: "photos",
    tags: ["photo", "openverse"],
    files: {
      thumbnail: record.thumbnailUrl,
      preview: full,
      master: full
    },
    recolourZones: [],
    anchors: [],
    materialProfiles: [],
    classroomReviewed: false,
    brandFree: false,
    attribution: {
      creator: record.creator,
      sourceUrl: record.sourceUrl,
      license: record.license
    }
  };
};

export class OpenverseClient {
  #enabled: boolean;
  readonly #fetch: typeof fetch;
  readonly #online: () => boolean;
  readonly #createDeadlineSignal: () => AbortSignal;
  readonly #activeRequests = new Set<AbortController>();
  #generation = 0;

  constructor(options: OpenverseClientOptions = {}) {
    this.#enabled = options.enabled ?? false;
    this.#fetch = options.fetch ?? ((input, init) => fetch(input, init));
    this.#online = options.online ?? (() => typeof navigator !== "undefined" && navigator.onLine);
    this.#createDeadlineSignal = options.createDeadlineSignal ?? (() => AbortSignal.timeout(REQUEST_TIMEOUT_MS));
  }

  setEnabled(enabled: boolean): void {
    if (this.#enabled === enabled) return;
    this.#enabled = enabled;
    this.#generation += 1;
    if (!enabled) {
      for (const controller of this.#activeRequests) controller.abort();
      this.#activeRequests.clear();
    }
  }

  async search(query: string, page = 1): Promise<OpenverseSearchResult> {
    if (!this.#enabled || !this.#online()) return offlineResult();
    const q = query.trim();
    if (Array.from(q).length < 2 || Array.from(q).length > 80 ||
      !Number.isInteger(page) || page < 1 || page > 20) {
      return offlineResult();
    }

    const generation = this.#generation;
    const requestController = new AbortController();
    this.#activeRequests.add(requestController);
    try {
      const params = new URLSearchParams({ q, page: String(page) });
      const signal = AbortSignal.any([
        requestController.signal,
        this.#createDeadlineSignal()
      ]);
      const response = await this.#fetch(`${SEARCH_PATH}?${params}`, {
        method: "GET",
        signal,
        headers: { accept: "application/json" }
      });
      if (!this.#enabled || generation !== this.#generation) {
        await response.body?.cancel();
        return offlineResult();
      }
      if (!response.ok) return offlineResult();
      const payload = await response.json() as unknown;
      if (!this.#enabled || generation !== this.#generation) return offlineResult();
      if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return offlineResult();
      const payloadKeys = Object.keys(payload as Record<string, unknown>);
      const values = (payload as Record<string, unknown>).records;
      if (payloadKeys.length !== 1 || payloadKeys[0] !== "records" ||
        !Array.isArray(values) || values.length > MAX_RECORDS) {
        return offlineResult();
      }
      const parsed = values.map(parseRemoteRecord);
      if (parsed.some((record) => record === null)) return offlineResult();
      return {
        status: "online",
        records: (parsed as RemoteRecord[]).map(toCatalogAsset)
      };
    } catch {
      return offlineResult();
    } finally {
      this.#activeRequests.delete(requestController);
    }
  }
}

export function mergeOpenverseAfterCore(
  core: CatalogAssetV1[],
  remote: OpenverseSearchResult
): CatalogAssetV1[] {
  const seen = new Set(core.map(({ id }) => id));
  const uniqueRemote = remote.records.filter(({ id }) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return [...core, ...uniqueRemote];
}
