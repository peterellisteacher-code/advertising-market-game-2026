import { describe, expect, it, vi } from "vitest";
import PRODUCT_KIT_SIDECAR from "../../../catalog/generated/offline-core-v1/product-kit-v1.json";
import PRODUCT_KIT_PRICING_SIDECAR from "../../../catalog/generated/offline-core-v1/product-kit-pricing-v1.json";
import type { CatalogAssetV1 } from "../catalogue/catalogue-types";
import type { OfflineCatalogueWithHash } from "../catalogue/catalogue-store";
import { computeCertificationFingerprint } from "./certification-fingerprint";
import { loadProductKitBundle } from "./product-kit-loader";

const CATALOG_HASH =
  "6199fd1adae59a2b517b265ca67a325f32faba04d375852821e841b51a354073";
const BASE_ID = "89-beverage-container-bases-r03c05";
const BASE_HASH =
  "d87a3718df6bd9a00e667a8c50729c3c84a3bd33bfe395df86b9992f49eb7abf";
const LID_ID = "90-beverage-container-add-ons-r04c01";
const LID_HASH =
  "6156af7416af78a8bb53a93c540ff2745caa77140f808213227487985e3580a5";
const CERTIFICATION_FINGERPRINT =
  "ac7beca4826f9977b0da9927f9c896deab4849f582a80a3b79fff15bbf8bef29";
const CATALOGUE_URL = "/catalog/generated/offline-core-v1/catalog.json";
const MAX_SIDECAR_BYTES = 4 * 1024 * 1024;
const SIDECAR_DEADLINE_MS = 5_000;

function offlineAsset(
  id: string,
  masterSha256: string,
  kind: "raster-master" | "component",
  width: number,
  height: number
): CatalogAssetV1 {
  return {
    schema: "catalog-asset@1",
    delivery: "offline",
    id,
    version: 1,
    kind,
    title: id === BASE_ID ? "Straight reusable tumbler" : "Flat takeaway-cup lid",
    category: "beverage-containers",
    tags: id === BASE_ID ? ["base", "tumbler"] : ["add-on", "cup lid"],
    files: {
      thumbnail: `/catalog/generated/offline-core-v1/assets/${id}/thumbnail-192.webp`,
      preview: `/catalog/generated/offline-core-v1/assets/${id}/preview-640.webp`,
      master: `/catalog/generated/offline-core-v1/assets/${id}/master.png`,
      masks: {
        body: `/catalog/generated/offline-core-v1/assets/${id}/masks/body.png`
      }
    },
    masterSha256,
    dimensions: { width, height },
    recolourZones: ["body"],
    anchors: [],
    materialProfiles: ["matte-plastic"],
    classroomReviewed: true,
    brandFree: true,
    attribution: {
      creator: "Peter Ellis classroom asset pack",
      sourceUrl: "local",
      license: "Classroom-session use"
    }
  };
}

const OFFLINE: OfflineCatalogueWithHash = {
  records: [
    offlineAsset(BASE_ID, BASE_HASH, "raster-master", 146, 238),
    offlineAsset(LID_ID, LID_HASH, "component", 233, 164)
  ],
  catalogSha256: CATALOG_HASH
};

interface Scenario {
  offline: OfflineCatalogueWithHash;
  productKit: unknown;
  pricing: unknown;
  productKitContentType: string;
  pricingContentType: string;
}

function scenario(): Scenario {
  return {
    offline: structuredClone(OFFLINE),
    productKit: structuredClone(PRODUCT_KIT_SIDECAR),
    pricing: structuredClone(PRODUCT_KIT_PRICING_SIDECAR),
    productKitContentType: "application/json",
    pricingContentType: "application/json; charset=utf-8"
  };
}

interface MutablePricingPayload {
  blueprints: Array<{ groupIds: string[] }>;
  groups: Array<{ choiceIds: string[] }>;
  choices: Array<{
    id: string;
    groupId: string;
    label: string;
    costCents: number;
    compatibleBlueprintIds: string[];
  }>;
  schema: string;
}

interface MutableSidecarPayload {
  schema: string;
  certifications: Array<{ fingerprint: string }>;
}

interface MutableProjectedRecord {
  masterSha256: string;
  delivery: string;
  classroomReviewed: boolean;
  brandFree: boolean;
  files: { master: string };
  dimensions: { width: number; height: number };
}

function pricingPayload(value: unknown): MutablePricingPayload {
  return value as MutablePricingPayload;
}

function sidecarPayload(value: unknown): MutableSidecarPayload {
  return value as MutableSidecarPayload;
}

function recordAt(
  value: OfflineCatalogueWithHash,
  index: number
): MutableProjectedRecord {
  return value.records[index] as unknown as MutableProjectedRecord;
}

function fetchFor(candidate: Scenario): {
  fetchImpl: typeof fetch;
  fetchMock: ReturnType<typeof vi.fn>;
} {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/product-kit-v1.json")) {
      return new Response(JSON.stringify(candidate.productKit), {
        status: 200,
        headers: { "content-type": candidate.productKitContentType }
      });
    }
    if (url.endsWith("/product-kit-pricing-v1.json")) {
      return new Response(JSON.stringify(candidate.pricing), {
        status: 200,
        headers: { "content-type": candidate.pricingContentType }
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  return { fetchImpl: fetchMock as unknown as typeof fetch, fetchMock };
}

function malformedUtf8ProductKitBytes(): ArrayBuffer {
  const source = JSON.stringify(PRODUCT_KIT_SIDECAR);
  const titleStart = source.indexOf("Reusable tumbler");
  if (titleStart < 0) throw new Error("pilot title marker missing");
  const encoder = new TextEncoder();
  const prefix = encoder.encode(source.slice(0, titleStart));
  const suffix = encoder.encode(source.slice(titleStart + 1));
  const buffer = new ArrayBuffer(prefix.byteLength + 2 + suffix.byteLength);
  const bytes = new Uint8Array(buffer);
  bytes.set(prefix, 0);
  bytes.set([0xC3, 0x28], prefix.byteLength);
  bytes.set(suffix, prefix.byteLength + 2);
  return buffer;
}

describe("loadProductKitBundle", () => {
  it("loads the exact hash-bound pilot from two same-origin sibling sidecars", async () => {
    const candidate = scenario();
    const { fetchImpl, fetchMock } = fetchFor(candidate);

    const bundle = await loadProductKitBundle(
      CATALOGUE_URL,
      candidate.offline,
      { fetchImpl }
    );

    expect(bundle?.catalogue.packId).toBe("pk1-pilot-drinkware");
    expect(bundle?.runtime.resolvePair({
      kind: "socket",
      kitId: "pk1-tumbler-kit",
      mountFrameId: "pk1-tumbler-lid-frame",
      componentId: "pk1-flat-lid"
    })).toMatchObject({
      transform: { scale: 0.7, rotationDegrees: 0, mirrored: false }
    });
    expect([...bundle!.rasterSources.keys()]).toEqual([BASE_ID, LID_ID]);
    expect(bundle?.rasterSources.get(BASE_ID)).toEqual({
      assetId: BASE_ID,
      masterSha256: BASE_HASH,
      masterUrl: `/catalog/generated/offline-core-v1/assets/${BASE_ID}/master.png`
    });
    expect([...bundle!.pricing.byPriceAssetId.entries()]).toEqual([
      ["pk1-price-tumbler", expect.objectContaining({ kind: "base", costCents: 480 })],
      ["pk1-price-flat-lid", expect.objectContaining({ kind: "part", costCents: 70 })]
    ]);
    expect(bundle?.pricing.blueprintTitleByKitId.get("pk1-tumbler-kit"))
      .toBe("Reusable tumbler");
    expect(Object.isFrozen(bundle!.rasterSources)).toBe(true);
    expect(() => (bundle!.rasterSources as Map<string, unknown>).clear()).toThrow(TypeError);

    const kit = bundle!.catalogue.kits[0]!;
    const frame = kit.mountFrames[0]!;
    const component = bundle!.catalogue.components[0]!;
    const computed = computeCertificationFingerprint({
      packId: bundle!.catalogue.packId,
      connectorFormulaVersion: bundle!.catalogue.connectorFormulaVersion
    }, kit, frame, component);
    expect(computed).toBe(CERTIFICATION_FINGERPRINT);
    expect(bundle!.catalogue.certifications[0]!.fingerprint).toBe(computed);

    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual([
      `${window.location.origin}/catalog/generated/offline-core-v1/product-kit-v1.json`,
      `${window.location.origin}/catalog/generated/offline-core-v1/product-kit-pricing-v1.json`
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uses one entry snapshot when a catalogue proxy varies later record reads", async () => {
    const candidate = scenario();
    const tamperedRecords = structuredClone(candidate.offline.records);
    tamperedRecords[1]!.files.master =
      `/catalog/generated/offline-core-v1/assets/${LID_ID}/master.svg`;
    let recordReads = 0;
    const varyingOffline = new Proxy(candidate.offline, {
      get(target, property, receiver) {
        if (property === "records") {
          recordReads += 1;
          return recordReads === 1 ? target.records : tamperedRecords;
        }
        return Reflect.get(target, property, receiver) as unknown;
      }
    });
    const { fetchImpl } = fetchFor(candidate);

    const bundle = await loadProductKitBundle(CATALOGUE_URL, varyingOffline, { fetchImpl });

    expect(bundle?.rasterSources.get(LID_ID)?.masterUrl).toBe(
      `/catalog/generated/offline-core-v1/assets/${LID_ID}/master.png`
    );
    expect(recordReads).toBe(0);
  });

  const denialCases: Array<{
    label: string;
    mutate: (candidate: Scenario) => void;
  }> = [
    {
      label: "catalogue hash",
      mutate: (candidate) => { candidate.offline.catalogSha256 = "f".repeat(64); }
    },
    {
      label: "record hash",
      mutate: (candidate) => { recordAt(candidate.offline, 1).masterSha256 = "f".repeat(64); }
    },
    {
      label: "record delivery",
      mutate: (candidate) => { recordAt(candidate.offline, 1).delivery = "live-photo"; }
    },
    {
      label: "classroomReviewed",
      mutate: (candidate) => { recordAt(candidate.offline, 1).classroomReviewed = false; }
    },
    {
      label: "brandFree",
      mutate: (candidate) => { recordAt(candidate.offline, 1).brandFree = false; }
    },
    {
      label: "master path",
      mutate: (candidate) => {
        recordAt(candidate.offline, 1).files.master =
          `/catalog/generated/offline-core-v1/assets/${LID_ID}/master.svg`;
      }
    },
    {
      label: "dimensions",
      mutate: (candidate) => { recordAt(candidate.offline, 1).dimensions.width = 232; }
    },
    {
      label: "sidecar MIME type",
      mutate: (candidate) => { candidate.productKitContentType = "image/png"; }
    },
    {
      label: "Product Kit schema",
      mutate: (candidate) => { sidecarPayload(candidate.productKit).schema = "product-kit@2"; }
    },
    {
      label: "certification fingerprint",
      mutate: (candidate) => {
        sidecarPayload(candidate.productKit).certifications[0]!.fingerprint = "0".repeat(64);
      }
    },
    {
      label: "pricing schema",
      mutate: (candidate) => { pricingPayload(candidate.pricing).schema = "product-pricing@2"; }
    },
    {
      label: "missing price identity",
      mutate: (candidate) => {
        const pricing = pricingPayload(candidate.pricing);
        pricing.choices[0]!.id = "pk1-price-other-body";
        pricing.groups[0]!.choiceIds = ["pk1-price-other-body"];
      }
    },
    {
      label: "duplicate price identity",
      mutate: (candidate) => {
        const pricing = pricingPayload(candidate.pricing);
        pricing.choices.push(structuredClone(pricing.choices[0]!));
      }
    }
  ];

  it.each(denialCases)("fails closed for a changed $label", async ({ mutate }) => {
    const candidate = scenario();
    mutate(candidate);
    const { fetchImpl, fetchMock } = fetchFor(candidate);

    await expect(loadProductKitBundle(
      CATALOGUE_URL,
      candidate.offline,
      { fetchImpl }
    )).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    undefined,
    "https://example.test/catalog/generated/offline-core-v1/catalog.json",
    "/catalog/generated/offline-core-v1/not-catalog.json",
    "/catalog/generated/offline-core-v1/catalog.json?version=1",
    "/catalog/generated/offline-core-v1/catalog.json#fragment"
  ])("rejects a non-canonical catalogue URL without fetching: %s", async (url) => {
    const fetchMock = vi.fn();

    await expect(loadProductKitBundle(url, OFFLINE, {
      fetchImpl: fetchMock as unknown as typeof fetch
    })).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "/catalog/generated/offline-core-v1/../offline-core-v1/catalog.json",
    "/catalog/generated/offline-core-v1/./catalog.json",
    "/catalog/generated/offline-core-v1/%2e%2e/offline-core-v1/catalog.json",
    `${window.location.origin}/catalog/generated/offline-core-v1/%2E/catalog.json`
  ])("rejects a raw dot-segment catalogue alias before fetching: %s", async (url) => {
    const candidate = scenario();
    const { fetchImpl, fetchMock } = fetchFor(candidate);

    await expect(loadProductKitBundle(url, candidate.offline, { fetchImpl }))
      .resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ` ${CATALOGUE_URL}`,
    `${CATALOGUE_URL} `,
    `\t${CATALOGUE_URL}`,
    "/catalog/generated/\noffline-core-v1/catalog.json",
    "/catalog\\generated\\offline-core-v1\\catalog.json",
    "/catalog//generated/offline-core-v1/catalog.json",
    "catalog/generated/offline-core-v1/catalog.json",
    `${window.location.origin.replace("localhost", "LOCALHOST")}${CATALOGUE_URL}`
  ])("rejects a non-canonical raw catalogue URL without fetching: %s", async (url) => {
    const candidate = scenario();
    const { fetchImpl, fetchMock } = fetchFor(candidate);

    await expect(loadProductKitBundle(url, candidate.offline, { fetchImpl }))
      .resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "oversized declared byte length",
      productResponse: () => new Response(JSON.stringify(PRODUCT_KIT_SIDECAR), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": String(MAX_SIDECAR_BYTES + 1)
        }
      })
    },
    {
      label: "malformed declared byte length",
      productResponse: () => new Response(JSON.stringify(PRODUCT_KIT_SIDECAR), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-length": "4mb"
        }
      })
    },
    {
      label: "oversized actual byte length",
      productResponse: () => new Response(
        `${JSON.stringify(PRODUCT_KIT_SIDECAR)}${" ".repeat(MAX_SIDECAR_BYTES)}`,
        { status: 200, headers: { "content-type": "application/json" } }
      )
    },
    {
      label: "malformed UTF-8 bytes that leniently decode as valid JSON",
      productResponse: () => new Response(malformedUtf8ProductKitBytes(), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    }
  ])("rejects $label without fallback", async ({ productResponse }) => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/product-kit-v1.json")) return productResponse();
      if (url.endsWith("/product-kit-pricing-v1.json")) {
        return new Response(JSON.stringify(PRODUCT_KIT_PRICING_SIDECAR), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    await expect(loadProductKitBundle(CATALOGUE_URL, OFFLINE, {
      fetchImpl: fetchMock as unknown as typeof fetch
    })).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cancels an oversized chunked sidecar before aggregating its bytes", async () => {
    const cancel = vi.fn();
    let pullCount = 0;
    const firstLength = MAX_SIDECAR_BYTES / 2;
    const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
      pull(controller) {
        pullCount += 1;
        if (pullCount === 1) {
          controller.enqueue(new Uint8Array(new ArrayBuffer(firstLength)));
        } else if (pullCount === 2) {
          controller.enqueue(new Uint8Array(new ArrayBuffer(
            MAX_SIDECAR_BYTES - firstLength + 1
          )));
        } else {
          controller.close();
        }
      },
      cancel
    }, { highWaterMark: 0 });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).endsWith("/product-kit-v1.json")) {
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      return new Response(JSON.stringify(PRODUCT_KIT_PRICING_SIDECAR), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });

    await expect(loadProductKitBundle(CATALOGUE_URL, OFFLINE, {
      fetchImpl: fetchMock as unknown as typeof fetch
    })).resolves.toBeNull();
    expect(pullCount).toBe(2);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("aborts and cancels a stalled sidecar body at the real deadline", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    let streamController!: ReadableStreamDefaultController<Uint8Array<ArrayBuffer>>;
    const stream = new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(controller) {
        streamController = controller;
      },
      pull() {
        return new Promise<void>(() => undefined);
      },
      cancel
    }, { highWaterMark: 0 });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).endsWith("/product-kit-v1.json")) {
        return new Response(stream, {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      return new Response(JSON.stringify(PRODUCT_KIT_PRICING_SIDECAR), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    let settled = false;
    let result: Awaited<ReturnType<typeof loadProductKitBundle>> | undefined;
    const loadPromise = loadProductKitBundle(CATALOGUE_URL, OFFLINE, {
      fetchImpl: fetchMock as unknown as typeof fetch
    });
    void loadPromise.then((value) => {
      settled = true;
      result = value;
    });

    try {
      await vi.advanceTimersByTimeAsync(SIDECAR_DEADLINE_MS);
      await Promise.resolve();
      expect(settled).toBe(true);
      expect(result).toBeNull();
      expect(cancel).toHaveBeenCalledTimes(1);
      const productRequest = fetchMock.mock.calls.find(([input]) =>
        String(input).endsWith("/product-kit-v1.json")
      );
      expect((productRequest?.[1] as RequestInit | undefined)?.signal?.aborted).toBe(true);
    } finally {
      streamController.error(new Error("stalled stream test cleanup"));
      await loadPromise;
      vi.useRealTimers();
    }
  });

  it("catches network and JSON failures without retrying", async () => {
    const rejectedFetch = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(loadProductKitBundle(CATALOGUE_URL, OFFLINE, {
      fetchImpl: rejectedFetch as unknown as typeof fetch
    })).resolves.toBeNull();
    expect(rejectedFetch).toHaveBeenCalledTimes(2);

    const invalidJsonFetch = vi.fn(async (input: RequestInfo | URL) => new Response(
      String(input).endsWith("/product-kit-v1.json") ? "{" : JSON.stringify(
        PRODUCT_KIT_PRICING_SIDECAR
      ),
      { status: 200, headers: { "content-type": "application/json" } }
    ));
    await expect(loadProductKitBundle(CATALOGUE_URL, OFFLINE, {
      fetchImpl: invalidJsonFetch as unknown as typeof fetch
    })).resolves.toBeNull();
    expect(invalidJsonFetch).toHaveBeenCalledTimes(2);
  });
});
