// @vitest-environment node

import type { Context } from "@netlify/functions";
import { afterEach, describe, expect, it, vi } from "vitest";
import handler, { config } from "./openverse-search.mjs";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

const context = {} as Context;

const upstreamRecord = (overrides: Record<string, unknown> = {}) => ({
  id: UUID,
  title: "Morning market",
  creator: "A. Photographer",
  license: "by-sa",
  license_version: "4.0",
  foreign_landing_url: "https://example.test/work/123",
  thumbnail: "https://media.example.test/thumb.jpg",
  url: "https://media.example.test/original.jpg",
  width: 1_600,
  height: 900,
  mature: false,
  ...overrides
});

const successfulUpstream = (records = [upstreamRecord()]): Response =>
  Response.json({ result_count: records.length, page_count: 1, page_size: 30, page: 1, results: records });

const readJson = async (response: Response): Promise<Record<string, unknown>> =>
  await response.json() as Record<string, unknown>;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("openverse-search", () => {
  it("declares the public route and a classroom-safe per-IP deployment limit", () => {
    expect(config).toEqual({
      path: "/api/openverse-search",
      rateLimit: {
        windowLimit: 120,
        windowSize: 60,
        aggregateBy: ["ip", "domain"]
      }
    });
  });

  it("allows GET only and marks the error as non-cacheable", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await handler(
      new Request("https://studio.test/api/openverse-search?q=market", { method: "POST" }),
      context
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await readJson(response)).toEqual({ error: "METHOD_NOT_ALLOWED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "?q=market&extra=1",
    "?q=market&q=second",
    "?q=market&page=1&page=2",
    "?q=market&page=01",
    "?q=market&page=0",
    "?q=market&page=21",
    "?q=market&page=1.5",
    "?page=1",
    "?q=%20a%20",
    `?q=${encodeURIComponent("x".repeat(81))}`
  ])("rejects invalid or ambiguous parameters before fetching: %s", async (query) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await handler(
      new Request(`https://studio.test/api/openverse-search${query}`),
      context
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await readJson(response)).toEqual({ error: "INVALID_PARAMETERS" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trims Unicode input, sends exact constrained upstream parameters and exposes only safe fields", async () => {
    const records = [
      upstreamRecord(),
      upstreamRecord({ id: "223e4567-e89b-42d3-a456-426614174000", license: "by-nd" }),
      upstreamRecord({ id: "323e4567-e89b-42d3-a456-426614174000", license: "gpl" }),
      upstreamRecord({ id: "not-a-uuid" })
    ];
    const fetchMock = vi.fn().mockResolvedValue(successfulUpstream(records));
    vi.stubGlobal("fetch", fetchMock);

    const response = await handler(
      new Request("https://studio.test/api/openverse-search?q=%20%F0%9F%90%A8a%20&page=2"),
      context
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [input, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const upstream = new URL(input);
    expect(`${upstream.origin}${upstream.pathname}`).toBe("https://api.openverse.org/v1/images/");
    expect(Object.fromEntries(upstream.searchParams)).toEqual({
      q: "🐨a",
      page: "2",
      page_size: "30",
      mature: "false",
      category: "photograph",
      license_type: "modification"
    });
    expect(init.method).toBe("GET");
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const body = await response.json() as { records: Array<Record<string, unknown>> };
    expect(body.records).toEqual([{
      id: UUID,
      title: "Morning market",
      creator: "A. Photographer",
      license: "CC BY-SA 4.0",
      sourceUrl: "https://example.test/work/123",
      thumbnailUrl: `/api/openverse-image/${UUID}?variant=thumbnail`,
      width: 1_600,
      height: 900
    }]);
    expect(Object.keys(body.records[0]!).sort()).toEqual([
      "creator", "height", "id", "license", "sourceUrl", "thumbnailUrl", "title", "width"
    ]);
    expect(JSON.stringify(body)).not.toContain("original.jpg");
    expect(JSON.stringify(body)).not.toContain("media.example.test");
  });

  it("defaults to canonical page one and excludes mature records", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulUpstream([
      upstreamRecord({ mature: true }),
      upstreamRecord({ id: "223e4567-e89b-42d3-a456-426614174000" })
    ]));
    vi.stubGlobal("fetch", fetchMock);

    const response = await handler(
      new Request("https://studio.test/api/openverse-search?q=market"),
      context
    );

    const [input] = fetchMock.mock.calls[0] as [string];
    expect(new URL(input).searchParams.get("page")).toBe("1");
    expect((await response.json() as { records: unknown[] }).records).toHaveLength(1);
  });

  it("caps output at 30 even if the upstream ignores page_size", async () => {
    const records = Array.from({ length: 35 }, (_, index) => upstreamRecord({
      id: `${index.toString(16).padStart(8, "0")}-e89b-42d3-a456-426614174000`
    }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(successfulUpstream(records)));

    const response = await handler(
      new Request("https://studio.test/api/openverse-search?q=market"),
      context
    );

    expect((await response.json() as { records: unknown[] }).records).toHaveLength(30);
  });

  it("rejects upstream JSON that exceeds one MiB before parsing", async () => {
    const oversized = "x".repeat(1_048_577);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(oversized, {
      headers: { "content-type": "application/json" }
    })));

    const response = await handler(
      new Request("https://studio.test/api/openverse-search?q=market"),
      context
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await readJson(response)).toEqual({ error: "UPSTREAM_RESPONSE_TOO_LARGE" });
  });

  it("maps upstream timeout and malformed responses to stable errors", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"))
      .mockResolvedValueOnce(new Response("not-json", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const timeout = await handler(
      new Request("https://studio.test/api/openverse-search?q=market"),
      context
    );
    const malformed = await handler(
      new Request("https://studio.test/api/openverse-search?q=market"),
      context
    );

    expect(timeout.status).toBe(504);
    expect(await readJson(timeout)).toEqual({ error: "UPSTREAM_TIMEOUT" });
    expect(malformed.status).toBe(502);
    expect(await readJson(malformed)).toEqual({ error: "UPSTREAM_INVALID_RESPONSE" });
  });
});
