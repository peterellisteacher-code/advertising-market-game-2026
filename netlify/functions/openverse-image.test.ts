// @vitest-environment node

import type { Context } from "@netlify/functions";
import { afterEach, describe, expect, it, vi } from "vitest";
import handler, {
  MAX_IMAGE_BYTES,
  config,
  createOpenverseImageHandler,
  type ResolveHost
} from "./openverse-image.mjs";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const PUBLIC_V4 = "93.184.216.34";

const detail = (overrides: Record<string, unknown> = {}) => ({
  id: UUID,
  title: "Morning market",
  creator: "A. Photographer",
  license: "by",
  license_version: "4.0",
  foreign_landing_url: "https://example.test/work/123",
  url: "https://media.example.test/full.png",
  thumbnail: "https://media.example.test/thumb.png",
  width: 1_600,
  height: 900,
  mature: false,
  ...overrides
});

const pngBytes = (size = 32): Uint8Array => {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
};

const jpegBytes = (): Uint8Array => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

const responseBody = (bytes: Uint8Array): ArrayBuffer => bytes.buffer as ArrayBuffer;

const publicResolver: ResolveHost = vi.fn(async () => [{ address: PUBLIC_V4, family: 4 as const }]);

const makeHandler = (
  fetchMock: typeof fetch,
  resolveHost: ResolveHost = publicResolver,
  createDeadlineSignal: () => AbortSignal = () => AbortSignal.timeout(8_000)
) => createOpenverseImageHandler({ fetch: fetchMock, resolveHost, createDeadlineSignal });

const invoke = async (
  currentHandler: typeof handler,
  url = `https://studio.test/.netlify/functions/openverse-image/${UUID}`,
  id = UUID,
  method = "GET"
): Promise<Response> => currentHandler(
  new Request(url, { method }),
  { params: { id } } as unknown as Context
);

const jsonError = async (response: Response): Promise<{ error: string }> =>
  await response.json() as { error: string };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("openverse-image", () => {
  it("declares the exact UUID route", () => {
    expect(config.path).toBe("/.netlify/functions/openverse-image/:id");
  });

  it.each([
    ["POST", UUID, "", 405, "METHOD_NOT_ALLOWED"],
    ["GET", "not-a-uuid", "", 400, "INVALID_ID"],
    ["GET", UUID.toUpperCase(), "", 400, "INVALID_ID"],
    ["GET", UUID, "?extra=1", 400, "INVALID_PARAMETERS"],
    ["GET", UUID, "?variant=thumbnail&variant=full", 400, "INVALID_PARAMETERS"],
    ["GET", UUID, "?variant=small", 400, "INVALID_PARAMETERS"]
  ])("rejects invalid request %s %s%s before fetching", async (method, id, query, status, code) => {
    const fetchMock = vi.fn();
    const response = await invoke(
      makeHandler(fetchMock),
      `https://studio.test/.netlify/functions/openverse-image/${id}${query}`,
      id,
      method
    );

    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    if (status === 405) expect(response.headers.get("allow")).toBe("GET");
    expect(await jsonError(response)).toEqual({ error: code });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [detail({ mature: true }), "IMAGE_NOT_ALLOWED"],
    [detail({ license: "by-nd" }), "IMAGE_NOT_ALLOWED"],
    [detail({ license: "gpl" }), "IMAGE_NOT_ALLOWED"],
    [detail({ width: 100_000 }), "IMAGE_NOT_ALLOWED"],
    [detail({ height: null }), "UPSTREAM_INVALID_RESPONSE"],
    [detail({ url: "javascript:alert(1)" }), "UNSAFE_MEDIA_URL"]
  ])("rejects unsafe detail metadata without fetching media", async (metadata, code) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(metadata));
    const response = await invoke(makeHandler(fetchMock));

    expect(response.status).toBe(code === "UPSTREAM_INVALID_RESPONSE" ? 502 : 422);
    expect(await jsonError(response)).toEqual({ error: code });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("uses one deadline signal, resolves the selected host and returns only safe image headers", async () => {
    const controller = new AbortController();
    const resolveHost = vi.fn(async () => [{ address: PUBLIC_V4, family: 4 as const }]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(detail()))
      .mockResolvedValueOnce(new Response(responseBody(pngBytes()), {
        headers: {
          "content-type": "image/png; charset=binary",
          "content-length": "32",
          "content-encoding": "gzip",
          "set-cookie": "tracker=1"
        }
      }));
    const response = await invoke(
      makeHandler(fetchMock, resolveHost, () => controller.signal),
      `https://studio.test/.netlify/functions/openverse-image/${UUID}?variant=thumbnail`
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`https://api.openverse.org/v1/images/${UUID}/`);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://media.example.test/thumb.png");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "GET", redirect: "manual", signal: controller.signal });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "GET", redirect: "manual", signal: controller.signal });
    expect(resolveHost).toHaveBeenCalledWith("media.example.test");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(response.headers.has("content-encoding")).toBe(false);
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pngBytes());
  });

  it.each([
    "https://127.0.0.1/image.png",
    "https://[::1]/image.png",
    "https://[::ffff:127.0.0.1]/image.png",
    "http://media.example.test/image.png",
    "https://user:password@media.example.test/image.png",
    "https://media.example.test:8443/image.png"
  ])("blocks a dangerous initial media URL before fetching it: %s", async (url) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(detail({ url })));
    const response = await invoke(makeHandler(fetchMock));

    expect(response.status).toBe(422);
    expect(await jsonError(response)).toEqual({ error: "UNSAFE_MEDIA_URL" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    [{ address: "10.0.0.2", family: 4 as const }],
    [{ address: "fc00::1", family: 6 as const }],
    [{ address: "::ffff:10.0.0.2", family: 6 as const }],
    [{ address: "2001:db8::1", family: 6 as const }],
    [{ address: "3fff:1234::1", family: 6 as const }],
    [
      { address: PUBLIC_V4, family: 4 as const },
      { address: "fe80::1", family: 6 as const }
    ]
  ])("rejects a hostname if any resolved A or AAAA address is non-public", async (...addresses) => {
    const resolver = vi.fn(async () => addresses);
    const fetchMock = vi.fn().mockResolvedValue(Response.json(detail()));
    const response = await invoke(makeHandler(fetchMock, resolver));

    expect(response.status).toBe(422);
    expect(await jsonError(response)).toEqual({ error: "UNSAFE_MEDIA_URL" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("applies the shared deadline while DNS resolution is stalled", async () => {
    const controller = new AbortController();
    const resolver = vi.fn(() => {
      controller.abort();
      return new Promise<never>(() => undefined);
    });
    const fetchMock = vi.fn().mockResolvedValue(Response.json(detail()));
    const pending = invoke(makeHandler(fetchMock, resolver, () => controller.signal));

    const outcome = await Promise.race([
      pending,
      new Promise<"stalled">((resolve) => setTimeout(() => resolve("stalled"), 50))
    ]);

    expect(outcome).not.toBe("stalled");
    expect((outcome as Response).status).toBe(504);
    expect(await jsonError(outcome as Response)).toEqual({ error: "UPSTREAM_TIMEOUT" });
  });

  it.each([
    "https://127.0.0.1/redirect.png",
    "https://[::1]/redirect.png",
    "https://[::ffff:10.0.0.1]/redirect.png"
  ])("revalidates and blocks private redirect targets: %s", async (location) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(detail()))
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location } }));
    const response = await invoke(makeHandler(fetchMock));

    expect(response.status).toBe(422);
    expect(await jsonError(response)).toEqual({ error: "UNSAFE_MEDIA_URL" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("detects a redirect loop", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(detail()))
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: "https://cdn.example.test/a.png" }
      }))
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: "https://media.example.test/full.png" }
      }));
    const response = await invoke(makeHandler(fetchMock));

    expect(response.status).toBe(502);
    expect(await jsonError(response)).toEqual({ error: "REDIRECT_LOOP" });
  });

  it.each([
    ["text/html", pngBytes(), "UNSUPPORTED_MEDIA_TYPE"],
    ["image/png", jpegBytes(), "MIME_SIGNATURE_MISMATCH"]
  ])("rejects non-image and MIME-signature mismatched bodies", async (contentType, bytes, code) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(detail()))
      .mockResolvedValueOnce(new Response(responseBody(bytes), { headers: { "content-type": contentType } }));
    const response = await invoke(makeHandler(fetchMock));

    expect(response.status).toBe(415);
    expect(await jsonError(response)).toEqual({ error: code });
  });

  it("rejects a declared image body above 12 MiB before returning it", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(detail()))
      .mockResolvedValueOnce(new Response(responseBody(pngBytes()), {
        headers: {
          "content-type": "image/png",
          "content-length": String(MAX_IMAGE_BYTES + 1)
        }
      }));
    const response = await invoke(makeHandler(fetchMock));

    expect(response.status).toBe(413);
    expect(await jsonError(response)).toEqual({ error: "IMAGE_TOO_LARGE" });
  });

  it("streams an image of exactly 12 MiB", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(detail()))
      .mockResolvedValueOnce(new Response(responseBody(pngBytes(MAX_IMAGE_BYTES)), {
        headers: { "content-type": "image/png" }
      }));
    const response = await invoke(makeHandler(fetchMock));

    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBe(MAX_IMAGE_BYTES);
  });

  it("errors the counted stream before emitting byte 12 MiB plus one", async () => {
    const signature = pngBytes(12);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(signature);
        controller.enqueue(new Uint8Array(MAX_IMAGE_BYTES - signature.byteLength));
        controller.enqueue(new Uint8Array([1]));
        controller.close();
      }
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(detail()))
      .mockResolvedValueOnce(new Response(body, { headers: { "content-type": "image/png" } }));
    const response = await invoke(makeHandler(fetchMock));

    expect(response.status).toBe(200);
    await expect(response.arrayBuffer()).rejects.toThrow("IMAGE_TOO_LARGE");
  });

  it("maps a timeout while resolving the image to a stable gateway timeout", async () => {
    const controller = new AbortController();
    const timeout = new DOMException("timed out", "TimeoutError");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(detail()))
      .mockRejectedValueOnce(timeout);
    const response = await invoke(makeHandler(fetchMock, publicResolver, () => controller.signal));

    expect(response.status).toBe(504);
    expect(await jsonError(response)).toEqual({ error: "UPSTREAM_TIMEOUT" });
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    expect(fetchMock.mock.calls[1]?.[1]?.signal).toBe(controller.signal);
  });
});
