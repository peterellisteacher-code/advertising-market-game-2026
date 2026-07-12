import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogAssetV1 } from "./catalogue-types";
import {
  OpenverseClient,
  mergeOpenverseAfterCore,
  type OpenverseSearchResult
} from "./openverse-client";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const THUMBNAIL = `/.netlify/functions/openverse-image/${UUID}?variant=thumbnail`;
const FULL = `/.netlify/functions/openverse-image/${UUID}`;

const remoteRecord = (overrides: Record<string, unknown> = {}) => ({
  id: UUID,
  title: "Morning market",
  creator: "A. Photographer",
  license: "CC BY 4.0",
  sourceUrl: "https://example.test/work/123",
  thumbnailUrl: THUMBNAIL,
  width: 1_600,
  height: 900,
  ...overrides
});

const coreAsset = (id: string): CatalogAssetV1 => ({
  schema: "catalog-asset@1",
  id,
  version: 1,
  kind: "component",
  title: "Reviewed bottle",
  category: "drinkware",
  tags: ["bottle"],
  files: {
    thumbnail: `/catalog/${id}-192.webp`,
    preview: `/catalog/${id}-640.webp`,
    master: `/catalog/${id}.png`
  },
  recolourZones: ["body"],
  anchors: [],
  materialProfiles: ["matte-plastic"],
  classroomReviewed: true,
  brandFree: true,
  attribution: { creator: "Classroom pack", sourceUrl: "local", license: "classroom-session" }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OpenverseClient", () => {
  it("is teacher-disabled by default and performs no fetch", async () => {
    const fetchMock = vi.fn();
    const client = new OpenverseClient({ fetch: fetchMock, online: () => true });

    await expect(client.search("market")).resolves.toEqual({ status: "offline", records: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("performs no fetch when navigator reports offline", async () => {
    const fetchMock = vi.fn();
    const client = new OpenverseClient({ enabled: true, fetch: fetchMock, online: () => false });

    await expect(client.search("market")).resolves.toEqual({ status: "offline", records: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps an online response to unreviewed, brand-unsafe same-origin photo assets", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ records: [remoteRecord()] }));
    const client = new OpenverseClient({
      enabled: true,
      fetch: fetchMock,
      online: () => true,
      createDeadlineSignal: () => controller.signal
    });

    const result = await client.search(" morning market ", 2);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [input, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(input).toBe("/.netlify/functions/openverse-search?q=morning+market&page=2");
    expect(init).toMatchObject({ method: "GET", signal: controller.signal });
    expect(result).toEqual({
      status: "online",
      records: [{
        schema: "catalog-asset@1",
        id: UUID,
        version: 1,
        kind: "photo",
        title: "Morning market",
        category: "photos",
        tags: ["photo", "openverse"],
        files: { thumbnail: THUMBNAIL, preview: FULL, master: FULL },
        recolourZones: [],
        anchors: [],
        materialProfiles: [],
        classroomReviewed: false,
        brandFree: false,
        attribution: {
          creator: "A. Photographer",
          sourceUrl: "https://example.test/work/123",
          license: "CC BY 4.0"
        }
      }]
    });
  });

  it.each([
    ["network", () => Promise.reject(new TypeError("network failed"))],
    ["timeout", () => Promise.reject(new DOMException("timed out", "TimeoutError"))],
    ["server", () => Promise.resolve(new Response("bad gateway", { status: 502 }))],
    ["JSON", () => Promise.resolve(new Response("not-json", { status: 200 }))],
    ["schema", () => Promise.resolve(Response.json({ records: [remoteRecord({ thumbnailUrl: "https://evil.test/a.png" })] }))]
  ])("returns the exact offline result after a %s failure", async (_label, reply) => {
    const fetchMock = vi.fn(reply);
    const client = new OpenverseClient({ enabled: true, fetch: fetchMock, online: () => true });

    await expect(client.search("market")).resolves.toEqual({ status: "offline", records: [] });
  });

  it("can be enabled and disabled by the teacher without fetching while disabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ records: [] }));
    const client = new OpenverseClient({ fetch: fetchMock, online: () => true });

    client.setEnabled(true);
    await expect(client.search("market")).resolves.toEqual({ status: "online", records: [] });
    client.setEnabled(false);
    await expect(client.search("market")).resolves.toEqual({ status: "offline", records: [] });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("mergeOpenverseAfterCore", () => {
  it("places remote records after the reviewed core", () => {
    const core = [coreAsset("core-1"), coreAsset("core-2")];
    const remote = {
      status: "online",
      records: [coreAsset("remote-1")]
    } satisfies OpenverseSearchResult;

    expect(mergeOpenverseAfterCore(core, remote).map(({ id }) => id)).toEqual([
      "core-1", "core-2", "remote-1"
    ]);
  });

  it("keeps the reviewed core intact when Openverse is offline", () => {
    const core = [coreAsset("core-1"), coreAsset("core-2")];

    expect(mergeOpenverseAfterCore(core, { status: "offline", records: [] })).toEqual(core);
  });
});
