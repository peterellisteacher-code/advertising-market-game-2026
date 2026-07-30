import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MATERIAL_PRESET_IDS } from "../tools/material-presets";
import {
  PRODUCT_BUILDER_CATALOGUE_MAX_BYTES,
  loadProductBuilderCatalogue,
  parseProductBuilderCatalogue
} from "./product-builder-catalogue";

const CATALOGUE_URL =
  "https://classroom.test/catalog/generated/product-builder-pilot-v1/catalogue.json";
const RAW_CATALOGUE = readFileSync(
  resolve("catalog/generated/product-builder-pilot-v1/catalogue.json"),
  "utf8"
);

const fixture = (): Record<string, unknown> => JSON.parse(RAW_CATALOGUE) as Record<string, unknown>;
const rows = (value: unknown, key: string): Array<Record<string, unknown>> =>
  (value as Record<string, unknown>)[key] as Array<Record<string, unknown>>;

function isDeeplyFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((item) => isDeeplyFrozen(item, seen));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("product-builder catalogue parser", () => {
  it("accepts the exact v1 pack, resolves canonical local SVG URLs and deep-freezes it", () => {
    const parsed = parseProductBuilderCatalogue(fixture(), CATALOGUE_URL);

    expect(parsed).not.toBeNull();
    expect(parsed).toMatchObject({
      schema: "product-builder-catalogue@1",
      version: 1,
      packId: "product-builder-pilot-v1",
      virtualCount: 6_144
    });
    expect(parsed?.families.map(({ id }) => id)).toEqual([
      "bags",
      "drinkware",
      "food-packaging"
    ]);
    expect(parsed?.bodies).toHaveLength(12);
    expect(parsed?.parts).toHaveLength(12);
    expect(parsed?.palettes).toHaveLength(16);
    expect(parsed?.materials.map(({ id }) => id)).toEqual([...MATERIAL_PRESET_IDS].sort());
    expect(parsed?.bodies[0]).toMatchObject({
      id: "bags-backpack",
      authoringUrl:
        "https://classroom.test/catalog/generated/product-builder-pilot-v1/bodies/bags-backpack/authoring.svg",
      previewUrl:
        "https://classroom.test/catalog/generated/product-builder-pilot-v1/bodies/bags-backpack/preview.svg"
    });
    expect(parsed?.parts[0]?.componentUrl).toBe(
      "https://classroom.test/catalog/generated/product-builder-pilot-v1/components/bags-carry-cutout.svg"
    );
    expect(isDeeplyFrozen(parsed)).toBe(true);
  });

  it.each([
    ["top-level extras", (value: Record<string, unknown>) => { value.extra = true; }],
    ["wrong schema", (value: Record<string, unknown>) => { value.schema = "product-builder-catalogue@2"; }],
    ["wrong version", (value: Record<string, unknown>) => { value.version = 2; }],
    ["extra nested keys", (value: Record<string, unknown>) => { rows(value, "bodies")[0]!.extra = true; }],
    ["unsorted body IDs", (value: Record<string, unknown>) => { rows(value, "bodies").reverse(); }],
    ["duplicate body IDs", (value: Record<string, unknown>) => {
      rows(value, "bodies")[1]!.id = rows(value, "bodies")[0]!.id;
    }],
    ["unknown body family", (value: Record<string, unknown>) => {
      rows(value, "bodies")[0]!.familyId = "unknown";
    }],
    ["unknown compatible part", (value: Record<string, unknown>) => {
      rows(value, "bodies")[0]!.compatiblePartIds = [
        "bags-carry-cutout",
        "bags-carry-long-straps",
        "bags-carry-loop",
        "unknown-part"
      ];
    }],
    ["wrong part slot", (value: Record<string, unknown>) => {
      rows(value, "parts")[0]!.slotId = "top";
    }],
    ["virtual count drift", (value: Record<string, unknown>) => { value.virtualCount = 6_143; }]
  ])("rejects %s", (_label, mutate) => {
    const value = fixture();
    mutate(value);
    expect(parseProductBuilderCatalogue(value, CATALOGUE_URL)).toBeNull();
  });

  it.each([
    ["anchor outside the unit square", (body: Record<string, unknown>) => {
      (body.componentAnchor as Record<string, unknown>).x = 1.01;
    }],
    ["non-finite anchor", (body: Record<string, unknown>) => {
      (body.componentAnchor as Record<string, unknown>).y = Number.NaN;
    }],
    ["artwork bounds crossing the edge", (body: Record<string, unknown>) => {
      const bounds = body.artworkBounds as Record<string, unknown>;
      bounds.x = 0.8;
      bounds.width = 0.3;
    }],
    ["zero-width artwork bounds", (body: Record<string, unknown>) => {
      (body.artworkBounds as Record<string, unknown>).width = 0;
    }]
  ])("rejects %s", (_label, mutate) => {
    const value = fixture();
    mutate(rows(value, "bodies")[0]!);
    expect(parseProductBuilderCatalogue(value, CATALOGUE_URL)).toBeNull();
  });

  it("requires sixteen distinct uppercase four-zone palettes", () => {
    const lowercase = fixture();
    const colours = rows(lowercase, "palettes")[0]!.colours as Record<string, unknown>;
    colours.body = "#dff3e8";
    expect(parseProductBuilderCatalogue(lowercase, CATALOGUE_URL)).toBeNull();

    const repeatedZone = fixture();
    const repeated = rows(repeatedZone, "palettes")[0]!.colours as Record<string, unknown>;
    repeated.accent = repeated.body;
    expect(parseProductBuilderCatalogue(repeatedZone, CATALOGUE_URL)).toBeNull();

    const repeatedPalette = fixture();
    rows(repeatedPalette, "palettes")[1]!.colours = {
      ...(rows(repeatedPalette, "palettes")[0]!.colours as Record<string, unknown>)
    };
    expect(parseProductBuilderCatalogue(repeatedPalette, CATALOGUE_URL)).toBeNull();

    const missingZone = fixture();
    delete (rows(missingZone, "palettes")[0]!.colours as Record<string, unknown>).label;
    expect(parseProductBuilderCatalogue(missingZone, CATALOGUE_URL)).toBeNull();
  });

  it("requires exactly the eight runtime material preset IDs", () => {
    const value = fixture();
    rows(value, "materials")[0]!.id = "unknown-material";
    rows(value, "materials").sort((left, right) => String(left.id).localeCompare(String(right.id)));

    expect(parseProductBuilderCatalogue(value, CATALOGUE_URL)).toBeNull();
  });

  it.each([
    "www.example.com",
    "example.com.au",
    "https://example.com/product",
    "192.168.1.1"
  ])("rejects URL, hostname or IP-like title text: %s", (unsafeTitle) => {
    const value = fixture();
    rows(value, "bodies")[0]!.title = unsafeTitle;

    expect(parseProductBuilderCatalogue(value, CATALOGUE_URL)).toBeNull();
  });

  it("retains ordinary dotted product wording", () => {
    const value = fixture();
    rows(value, "bodies")[0]!.title = "Bottle 2.0";

    expect(parseProductBuilderCatalogue(value, CATALOGUE_URL)).not.toBeNull();
  });

  it.each([
    ["external body URL", "https://unsafe.example/body.svg", "authoringSvg", "bodies"],
    ["traversing body URL", "bodies/../unsafe.svg", "previewSvg", "bodies"],
    ["encoded traversal", "bodies/%2e%2e/unsafe.svg", "previewSvg", "bodies"],
    ["wrong body file", "bodies/bags-backpack/other.svg", "authoringSvg", "bodies"],
    ["external component URL", "https://unsafe.example/part.svg", "componentSvg", "parts"],
    ["wrong component file", "components/other.svg", "componentSvg", "parts"]
  ])("rejects %s", (_label, path, key, collection) => {
    const value = fixture();
    rows(value, collection)[0]![key] = path;
    expect(parseProductBuilderCatalogue(value, CATALOGUE_URL)).toBeNull();
  });

  it("binds the pack ID to the canonical catalogue directory", () => {
    expect(parseProductBuilderCatalogue(
      fixture(),
      "https://classroom.test/catalog/generated/another-pack/catalogue.json"
    )).toBeNull();
    expect(parseProductBuilderCatalogue(
      fixture(),
      "https://classroom.test/catalog/generated/product-builder-pilot-v1/%2e%2e/catalogue.json"
    )).toBeNull();
  });
});

describe("product-builder catalogue loader", () => {
  const classroomWindow = {
    location: {
      href: "https://classroom.test/creator/",
      origin: "https://classroom.test"
    }
  };

  it("loads only same-origin HTTP(S) JSON without credentials", async () => {
    vi.stubGlobal("window", classroomWindow);
    const fetcher = vi.fn(async () => new Response(RAW_CATALOGUE, {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" }
    }));

    const loaded = await loadProductBuilderCatalogue(
      "/catalog/generated/product-builder-pilot-v1/catalogue.json",
      { fetch: fetcher }
    );

    expect(loaded?.virtualCount).toBe(6_144);
    expect(fetcher).toHaveBeenCalledWith(CATALOGUE_URL, expect.objectContaining({
      method: "GET",
      credentials: "omit",
      redirect: "error",
      headers: { accept: "application/json" },
      signal: expect.any(AbortSignal)
    }));
  });

  it.each([
    "https://unsafe.example/catalog/generated/product-builder-pilot-v1/catalogue.json",
    "ftp://classroom.test/catalog/generated/product-builder-pilot-v1/catalogue.json",
    "https://user:pass@classroom.test/catalog/generated/product-builder-pilot-v1/catalogue.json",
    "/catalog/generated/product-builder-pilot-v1/catalogue.json?cache=1",
    "/catalog/generated/product-builder-pilot-v1/catalogue.json#fragment",
    "/catalog/generated/product-builder-pilot-v1/%2e%2e/catalogue.json",
    "/catalog/generated/product-builder-pilot-v1/%2Funsafe/catalogue.json",
    "/catalog/generated/product-builder-pilot-v1/../product-builder-pilot-v1/catalogue.json",
    "https://classroom.test/catalog/generated/product-builder-pilot-v1/./catalogue.json",
    "\\catalog\\generated\\product-builder-pilot-v1\\catalogue.json",
    "/other/product-builder-pilot-v1/catalogue.json"
  ])("rejects unsafe catalogue URL %s before fetching", async (url) => {
    vi.stubGlobal("window", classroomWindow);
    const fetcher = vi.fn();

    expect(await loadProductBuilderCatalogue(url, { fetch: fetcher })).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON MIME type and malformed JSON", async () => {
    vi.stubGlobal("window", classroomWindow);
    const wrongMime = vi.fn(async () => new Response(RAW_CATALOGUE, {
      status: 200,
      headers: { "content-type": "text/plain" }
    }));
    expect(await loadProductBuilderCatalogue(
      "/catalog/generated/product-builder-pilot-v1/catalogue.json",
      { fetch: wrongMime }
    )).toBeNull();

    const malformed = vi.fn(async () => new Response("{not-json", {
      status: 200,
      headers: { "content-type": "application/json" }
    }));
    expect(await loadProductBuilderCatalogue(
      "/catalog/generated/product-builder-pilot-v1/catalogue.json",
      { fetch: malformed }
    )).toBeNull();
  });

  it("enforces the byte cap against the actual response text", async () => {
    vi.stubGlobal("window", classroomWindow);
    const oversized = `${RAW_CATALOGUE}${" ".repeat(PRODUCT_BUILDER_CATALOGUE_MAX_BYTES)}`;
    const fetcher = vi.fn(async () => new Response(oversized, {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-length": "1"
      }
    }));

    expect(await loadProductBuilderCatalogue(
      "/catalog/generated/product-builder-pilot-v1/catalogue.json",
      { fetch: fetcher }
    )).toBeNull();
  });

  it("fails closed on timeout, network failure and non-success responses", async () => {
    vi.stubGlobal("window", classroomWindow);
    const aborted = AbortSignal.abort(new DOMException("Timed out", "AbortError"));
    const timeoutFetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.signal?.aborted) throw init.signal.reason;
      return new Response(RAW_CATALOGUE, {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    expect(await loadProductBuilderCatalogue(
      "/catalog/generated/product-builder-pilot-v1/catalogue.json",
      { fetch: timeoutFetcher, createDeadlineSignal: () => aborted }
    )).toBeNull();

    const networkFailure = vi.fn(async () => { throw new TypeError("network down"); });
    expect(await loadProductBuilderCatalogue(
      "/catalog/generated/product-builder-pilot-v1/catalogue.json",
      { fetch: networkFailure }
    )).toBeNull();

    const missing = vi.fn(async () => new Response("missing", { status: 404 }));
    expect(await loadProductBuilderCatalogue(
      "/catalog/generated/product-builder-pilot-v1/catalogue.json",
      { fetch: missing }
    )).toBeNull();
  });
});
