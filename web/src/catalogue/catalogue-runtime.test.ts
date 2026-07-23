import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import PRODUCT_KIT_SIDECAR from "../../../catalog/generated/offline-core-v1/product-kit-v1.json";
import PRODUCT_KIT_PRICING_SIDECAR from
  "../../../catalog/generated/offline-core-v1/product-kit-pricing-v1.json";
import {
  createBlankCampaignDocument,
  parseCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import type {
  ArtworkSurfaceAddress,
  CanvasMutationListener,
  CanvasPort,
  CanvasSelectionListener,
  LogoMarkSnapshot,
  LogoMarkSource,
  NewLogoMarkInput,
  NewProductKitInput,
  NewProductVariantInput,
  NewRasterInput,
  NewShapeInput,
  NewTextInput,
  ObjectTransform
} from "../fabric/canvas-port";
import { campaignSemanticObjectMap } from "../domain/campaign-semantic-objects";
import { parseProductBuilderCatalogue } from "../product-builder/product-builder-catalogue";
import { quotePilotProductVariant } from "../product-builder/pilot-product-economics";
import { createVirtualProductVariantResolver } from "../product-builder/virtual-product-variant";
import type { ProductShellRecord } from "../product-shells/product-shell-catalogue";
import type { OfflineCatalogueWithHash } from "./catalogue-store";
import { parseCatalogAsset } from "./catalogue-store";
import {
  loadProductKitBundle,
  type LoadedProductKitBundle
} from "../product-kit/product-kit-loader";
import {
  parseProductKitCompositionReference,
  type ProductKitCompositionReference
} from "../product-kit/product-kit-document";
import type { ProductKitCompositionRequest } from "../product-kit/product-kit-runtime";
import type { CatalogAssetV1 } from "./catalogue-types";
import {
  CataloguePlacementQueue,
  CatalogueRuntime,
  filterCatalogueByView,
  type CatalogueRenderer,
  type LivePhotoClient
} from "./catalogue-runtime";
import { parseRasterPricing, type RasterPricingIndex } from "./raster-pricing";
import { rehydrateLocalAssetBlobs } from "../persistence/draft-store";

const asset = (id: string, kind: CatalogAssetV1["kind"] = "component"): CatalogAssetV1 => {
  if (kind === "photo") {
    return {
      schema: "catalog-asset@1",
      delivery: "live-photo",
      id,
      version: 1,
      kind: "photo",
      title: "Market photo",
      category: "photos",
      tags: ["market"],
      files: {
        thumbnail: `/api/openverse-image/${id}?variant=thumbnail`,
        preview: `/api/openverse-image/${id}`,
        master: `/api/openverse-image/${id}`
      },
      dimensions: { width: 1_600, height: 900 },
      recolourZones: [],
      anchors: [],
      materialProfiles: [],
      classroomReviewed: false,
      brandFree: false,
      attribution: {
        creator: "A. Photographer",
        sourceUrl: "https://example.test/photo",
        license: "CC BY 4.0"
      }
    };
  }
  return {
    schema: "catalog-asset@1",
    delivery: "offline",
    id,
    version: 1,
    kind,
    title: "Reviewed bottle",
    category: "drinkware",
    tags: ["bottle"],
    files: {
      thumbnail: `/catalog/generated/offline-core-v1/assets/${id}/thumbnail-192.webp`,
      preview: `/catalog/generated/offline-core-v1/assets/${id}/preview-640.webp`,
      master: `/catalog/generated/offline-core-v1/assets/${id}/master.png`
    },
    masterSha256: "a".repeat(64),
    dimensions: { width: 320, height: 640 },
    recolourZones: [],
    anchors: [],
    materialProfiles: [],
    classroomReviewed: true,
    brandFree: true,
    attribution: {
      creator: "Classroom pack",
      sourceUrl: "local",
      license: "classroom-session"
    }
  };
};

const OPENVERSE_ID = "123e4567-e89b-42d3-a456-426614174000";
const openverseAsset = (): CatalogAssetV1 => ({
  ...asset(OPENVERSE_ID, "photo"),
  files: {
    thumbnail: `/api/openverse-image/${OPENVERSE_ID}?variant=thumbnail`,
    preview: `/api/openverse-image/${OPENVERSE_ID}`,
    master: `/api/openverse-image/${OPENVERSE_ID}`
  }
});

const recolourableAsset = (id: string): Extract<CatalogAssetV1, { delivery: "offline" }> => {
  const base = asset(id);
  if (base.delivery !== "offline") throw new Error("Expected an offline fixture asset");
  return {
    ...base,
    files: {
      ...base.files,
      masks: {
        body: `/catalog/generated/offline-core-v1/assets/${id}/masks/body.png`
      }
    },
    recolourZones: ["body"],
    materialProfiles: ["matte-plastic"]
  };
};

const PRODUCT_KIT_CATALOG_HASH =
  "6199fd1adae59a2b517b265ca67a325f32faba04d375852821e841b51a354073";
const PRODUCT_KIT_BASE_ID = "89-beverage-container-bases-r03c05";
const PRODUCT_KIT_BASE_HASH =
  "d87a3718df6bd9a00e667a8c50729c3c84a3bd33bfe395df86b9992f49eb7abf";
const PRODUCT_KIT_LID_ID = "90-beverage-container-add-ons-r04c01";
const PRODUCT_KIT_LID_HASH =
  "6156af7416af78a8bb53a93c540ff2745caa77140f808213227487985e3580a5";
const PRODUCT_KIT_TV_ID = "95-appliance-bases-r05c02";
const PRODUCT_KIT_TV_HASH =
  "3ad0846f80e918edcfea13b24deabd8413206d4ada4dc4e63c1751eb2728888f";
const PRODUCT_KIT_TV_PEDESTAL_ID = "96-appliance-add-ons-r05c01";
const PRODUCT_KIT_TV_PEDESTAL_HASH =
  "b9c6131f758d1d21a8923a3b9ae7137244d5154d8b15b45b73b64aae0faa0092";
const PRODUCT_KIT_TV_FEET_ID = "96-appliance-add-ons-r05c02";
const PRODUCT_KIT_TV_FEET_HASH =
  "00cd19f387de624370a6d014519343a241f00e36ab97a556906b0585cef674cf";
const PRODUCT_KIT_CASE_ID = "97-bag-carry-product-bases-r01c05";
const PRODUCT_KIT_CASE_HASH =
  "9f6f833af3a39e36734945ff9505ad6986aa09879bb756248209b74fc4c41dc9";
const PRODUCT_KIT_CASE_ARCHED_HANDLE_ID = "98-bag-carry-product-add-ons-r01c03";
const PRODUCT_KIT_CASE_ARCHED_HANDLE_HASH =
  "103a9baf051d3ff8a23f3dd8ff5abbbf80d34c2f57d4bca647b576b4364e1ce9";
const PRODUCT_KIT_CASE_COMPACT_HANDLE_ID = "98-bag-carry-product-add-ons-r01c05";
const PRODUCT_KIT_CASE_COMPACT_HANDLE_HASH =
  "10fc7b6c5a7b4a177cd1bb00c3a67b1fb5ee5644c438216085ce86098e109d7e";

function pilotOfflineAsset(
  id: string,
  masterSha256: string,
  kind: "raster-master" | "component",
  width: number,
  height: number
): CatalogAssetV1 {
  return {
    ...asset(id, kind),
    masterSha256,
    dimensions: { width, height }
  } as CatalogAssetV1;
}

const PRODUCT_KIT_OFFLINE: OfflineCatalogueWithHash = {
  records: [
    pilotOfflineAsset(PRODUCT_KIT_BASE_ID, PRODUCT_KIT_BASE_HASH, "raster-master", 146, 238),
    pilotOfflineAsset(PRODUCT_KIT_LID_ID, PRODUCT_KIT_LID_HASH, "component", 233, 164),
    pilotOfflineAsset(PRODUCT_KIT_TV_ID, PRODUCT_KIT_TV_HASH, "raster-master", 237, 168),
    pilotOfflineAsset(
      PRODUCT_KIT_TV_PEDESTAL_ID,
      PRODUCT_KIT_TV_PEDESTAL_HASH,
      "component",
      259,
      210
    ),
    pilotOfflineAsset(
      PRODUCT_KIT_TV_FEET_ID,
      PRODUCT_KIT_TV_FEET_HASH,
      "component",
      237,
      209
    ),
    pilotOfflineAsset(
      PRODUCT_KIT_CASE_ID,
      PRODUCT_KIT_CASE_HASH,
      "raster-master",
      189,
      159
    ),
    pilotOfflineAsset(
      PRODUCT_KIT_CASE_ARCHED_HANDLE_ID,
      PRODUCT_KIT_CASE_ARCHED_HANDLE_HASH,
      "component",
      226,
      211
    ),
    pilotOfflineAsset(
      PRODUCT_KIT_CASE_COMPACT_HANDLE_ID,
      PRODUCT_KIT_CASE_COMPACT_HANDLE_HASH,
      "component",
      262,
      135
    )
  ],
  catalogSha256: PRODUCT_KIT_CATALOG_HASH
};

const PRODUCT_KIT_REQUEST: ProductKitCompositionRequest = {
  kitId: "pk1-tumbler-kit",
  placements: [{
    kind: "socket",
    placementId: "lid-1",
    mountFrameId: "pk1-tumbler-lid-frame",
    componentId: "pk1-flat-lid"
  }]
};

async function pilotProductKitBundle(): Promise<LoadedProductKitBundle> {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/product-kit-v1.json")) {
      return new Response(JSON.stringify(PRODUCT_KIT_SIDECAR), {
        headers: { "content-type": "application/json" }
      });
    }
    if (url.endsWith("/product-kit-pricing-v1.json")) {
      return new Response(JSON.stringify(PRODUCT_KIT_PRICING_SIDECAR), {
        headers: { "content-type": "application/json" }
      });
    }
    throw new Error(`Unexpected Product Kit request: ${url}`);
  }) as unknown as typeof fetch;
  const bundle = await loadProductKitBundle(
    "/catalog/generated/offline-core-v1/catalog.json",
    structuredClone(PRODUCT_KIT_OFFLINE),
    { fetchImpl }
  );
  if (!bundle) throw new Error("Expected the reviewed Product Kit fixture to load");
  return bundle;
}

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
};

function fixturePricing(
  core: readonly CatalogAssetV1[],
  roles: Readonly<Record<string, "base" | "part" | "media">> = {}
): RasterPricingIndex {
  return {
    packId: "offline-core-v1",
    pricingVersion: 1,
    catalogSha256: "a".repeat(64),
    byAssetId: new Map(core.map((record) => [
      record.id,
      {
        role: roles[record.id] ?? "base",
        costCents: 1_000,
        title: record.title
      }
    ]))
  };
}

function runtimeHarness(
  core: CatalogAssetV1[],
  client: LivePhotoClient,
  liveDebounceMs = 0,
  pricing = fixturePricing(core)
) {
  const input = document.createElement("input");
  const category = document.createElement("select");
  const view = document.createElement("select");
  for (const [value, label] of [
    ["products", "Products"], ["parts", "Parts"], ["all", "All pieces"]
  ] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    view.append(option);
  }
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  const status = document.createElement("p");
  const renders: string[][] = [];
  const renderer: CatalogueRenderer = {
    render(records) { renders.push(records.map(({ id }) => id)); }
  };
  const runtime = new CatalogueRuntime({
    core, pricing, input, categorySelect: category, viewSelect: view,
    liveToggle: toggle, status, renderer, client,
    liveDebounceMs
  });
  return { input, category, view, toggle, status, renders, runtime };
}

describe("CatalogueRuntime", () => {
  it("admits the exact validated corpus into Products, Parts and All pieces", () => {
    const cataloguePath = join(process.cwd(), "catalog/generated/offline-core-v1/catalog.json");
    const pricingPath = join(process.cwd(), "catalog/generated/offline-core-v1/pricing.json");
    const rawCatalogue = JSON.parse(readFileSync(cataloguePath, "utf8")) as unknown[];
    const records = rawCatalogue.map(parseCatalogAsset);
    expect(records).not.toContain(null);
    const catalogue = records as CatalogAssetV1[];
    const rawPricing = JSON.parse(readFileSync(pricingPath, "utf8")) as {
      catalogSha256: string;
    };
    const pricing = parseRasterPricing(rawPricing, catalogue, rawPricing.catalogSha256);
    expect(pricing).not.toBeNull();

    expect(filterCatalogueByView(catalogue, pricing!, "products")).toHaveLength(1_530);
    expect(filterCatalogueByView(catalogue, pricing!, "parts")).toHaveLength(923);
    expect(filterCatalogueByView(catalogue, pricing!, "all")).toHaveLength(2_503);
    expect([...pricing!.byAssetId.values()].filter(({ role }) => role === "media"))
      .toHaveLength(50);
    expect(filterCatalogueByView(catalogue, pricing!, "products")
      .some(({ id }) => pricing!.byAssetId.get(id)?.role === "media"))
      .toBe(false);
  });

  it("switches deterministically by validated role without duplicate listeners", async () => {
    const records = [
      { ...asset("shoe"), title: "Running shoe", category: "apparel-footwear" },
      { ...asset("laces"), title: "Tied shoelace", category: "apparel-footwear" },
      { ...asset("poster"), title: "Poster frame", category: "media" }
    ];
    const pricing = fixturePricing(records, { shoe: "base", laces: "part", poster: "media" });
    const client: LivePhotoClient = { setEnabled: vi.fn(), search: vi.fn() };
    const harness = runtimeHarness(records, client, 0, pricing);
    const before = harness.renders.length;

    expect(harness.view.value).toBe("products");
    expect(harness.renders.at(-1)).toEqual(["shoe"]);
    harness.view.value = "parts";
    harness.view.dispatchEvent(new Event("change"));
    await harness.runtime.settled();
    expect(harness.renders.at(-1)).toEqual(["laces"]);
    harness.view.value = "all";
    harness.view.dispatchEvent(new Event("change"));
    await harness.runtime.settled();
    expect(harness.renders.at(-1)).toEqual(["poster", "shoe", "laces"]);
    expect(harness.renders).toHaveLength(before + 2);
  });

  it("searches and categorises a known validated product in the real corpus", async () => {
    const rawCatalogue = JSON.parse(readFileSync(
      join(process.cwd(), "catalog/generated/offline-core-v1/catalog.json"), "utf8"
    )) as unknown[];
    const catalogue = rawCatalogue.map(parseCatalogAsset) as CatalogAssetV1[];
    const rawPricing = JSON.parse(readFileSync(
      join(process.cwd(), "catalog/generated/offline-core-v1/pricing.json"), "utf8"
    )) as { catalogSha256: string };
    const pricing = parseRasterPricing(rawPricing, catalogue, rawPricing.catalogSha256)!;
    const client: LivePhotoClient = { setEnabled: vi.fn(), search: vi.fn() };
    const harness = runtimeHarness(catalogue, client, 0, pricing);

    harness.input.value = "Running shoe";
    harness.category.value = "apparel-footwear";
    harness.category.dispatchEvent(new Event("change"));
    await harness.runtime.settled();

    expect(harness.renders.at(-1)).toContain("31-apparel-footwear-bases-r04c01");
    expect(harness.category.selectedOptions[0]?.textContent).toBe("Apparel footwear");
  });

  it("renders the reviewed core immediately and keeps live photos opt-in", async () => {
    const client: LivePhotoClient = { setEnabled: vi.fn(), search: vi.fn() };
    const harness = runtimeHarness([asset("core")], client);

    expect(harness.renders.at(-1)).toEqual(["core"]);
    expect(harness.toggle.checked).toBe(false);
    expect(client.search).not.toHaveBeenCalled();

    harness.input.value = "bottle";
    harness.input.dispatchEvent(new Event("input"));
    expect(harness.renders.at(-1)).toEqual(["core"]);
    expect(client.search).not.toHaveBeenCalled();
  });

  it("adds live results only after the teacher enables them and preserves core offline", async () => {
    const search = vi.fn()
      .mockResolvedValueOnce({
        status: "online",
        records: [asset("core", "photo"), asset("remote", "photo"), asset("remote", "photo")]
      })
      .mockResolvedValueOnce({ status: "offline", records: [] });
    const client: LivePhotoClient = { setEnabled: vi.fn(), search };
    const harness = runtimeHarness([asset("core")], client);
    harness.input.value = "bottle";
    harness.toggle.checked = true;

    harness.toggle.dispatchEvent(new Event("change"));
    await harness.runtime.settled();
    expect(client.setEnabled).toHaveBeenCalledWith(true);
    expect(harness.renders.at(-1)).toEqual(["core", "remote"]);

    harness.input.dispatchEvent(new Event("input"));
    await harness.runtime.settled();
    expect(harness.renders.at(-1)).toEqual(["core"]);
    expect(harness.status.textContent).toContain("classroom pack");
  });

  it("starts empty and replaces the core without reconstructing live controls", () => {
    const client: LivePhotoClient = { setEnabled: vi.fn(), search: vi.fn() };
    const harness = runtimeHarness([], client);

    expect(harness.renders.at(-1)).toEqual([]);
    const replacement = [asset("late-core")];
    harness.runtime.replaceCore(replacement, fixturePricing(replacement));

    expect(harness.renders.at(-1)).toEqual(["late-core"]);
    expect(harness.toggle.checked).toBe(false);
  });

  it("explains the initial 100-result browse cap instead of implying that products are missing", () => {
    const client: LivePhotoClient = { setEnabled: vi.fn(), search: vi.fn() };
    const records = Array.from({ length: 125 }, (_, index) => ({
      ...asset(`product-${index}`),
      title: `Product ${String(index).padStart(3, "0")}`
    }));
    const harness = runtimeHarness(records, client);

    expect(harness.renders.at(-1)).toHaveLength(100);
    expect(harness.status.textContent)
      .toBe("Showing 100 of 125 products · search or choose a category");
  });

  it("populates a sorted category browser and filters before virtual rendering", async () => {
    const client: LivePhotoClient = { setEnabled: vi.fn(), search: vi.fn() };
    const harness = runtimeHarness([
      { ...asset("sofa"), title: "Curved sofa", category: "home-furniture" },
      { ...asset("bottle"), title: "Sports bottle", category: "drinkware" },
      { ...asset("chair"), title: "Lounge chair", category: "home-furniture" }
    ], client);

    expect([...harness.category.options].map(({ value, textContent }) => [value, textContent]))
      .toEqual([
        ["", "All categories"],
        ["drinkware", "Drinkware"],
        ["home-furniture", "Home furniture"]
      ]);

    harness.category.value = "home-furniture";
    harness.category.dispatchEvent(new Event("change"));
    await harness.runtime.settled();

    expect(harness.renders.at(-1)).toEqual(["sofa", "chair"]);
    expect(harness.status.textContent).toContain("Home furniture");
  });

  it("does not mix live-photo search into a selected classroom category", async () => {
    const client: LivePhotoClient = {
      setEnabled: vi.fn(),
      search: vi.fn().mockResolvedValue({ status: "online", records: [asset("remote", "photo")] })
    };
    const harness = runtimeHarness([
      { ...asset("sofa"), title: "Curved sofa", category: "home-furniture" }
    ], client);
    harness.input.value = "sofa";
    harness.category.value = "home-furniture";
    harness.toggle.checked = true;

    harness.toggle.dispatchEvent(new Event("change"));
    await harness.runtime.settled();

    expect(client.search).not.toHaveBeenCalled();
    expect(harness.renders.at(-1)).toEqual(["sofa"]);
  });

  it("resets a removed category when the core pack is replaced", () => {
    const client: LivePhotoClient = { setEnabled: vi.fn(), search: vi.fn() };
    const harness = runtimeHarness([
      { ...asset("sofa"), category: "home-furniture" }
    ], client);
    harness.category.value = "home-furniture";
    harness.category.dispatchEvent(new Event("change"));

    const replacement = [{ ...asset("bottle"), category: "drinkware" }];
    harness.runtime.replaceCore(replacement, fixturePricing(replacement));

    expect(harness.category.value).toBe("");
    expect(harness.renders.at(-1)).toEqual(["bottle"]);
  });

  it("rejects a stale live response after a newer search", async () => {
    const first = deferred<{ status: "online"; records: CatalogAssetV1[] }>();
    const second = deferred<{ status: "online"; records: CatalogAssetV1[] }>();
    const client: LivePhotoClient = {
      setEnabled: vi.fn(),
      search: vi.fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
    };
    const harness = runtimeHarness([asset("core")], client);
    harness.input.value = "first";
    harness.toggle.checked = true;
    harness.toggle.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    harness.input.value = "market";
    harness.input.dispatchEvent(new Event("input"));

    second.resolve({ status: "online", records: [asset("new", "photo")] });
    await Promise.resolve();
    first.resolve({ status: "online", records: [asset("stale", "photo")] });
    await harness.runtime.settled();

    expect(harness.renders.at(-1)).toEqual(["new"]);
  });

  it("renders core immediately but debounces fast typing to one live request", async () => {
    vi.useFakeTimers();
    try {
      const client: LivePhotoClient = {
        setEnabled: vi.fn(),
        search: vi.fn().mockResolvedValue({ status: "online", records: [] })
      };
      const harness = runtimeHarness([asset("core")], client, 250);
      harness.toggle.checked = true;
      for (const query of ["bo", "bot", "bott", "bottle"]) {
        harness.input.value = query;
        harness.input.dispatchEvent(new Event("input"));
      }

      expect(harness.renders.at(-1)).toEqual(["core"]);
      expect(client.search).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(249);
      expect(client.search).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await harness.runtime.settled();

      expect(client.search).toHaveBeenCalledOnce();
      expect(client.search).toHaveBeenCalledWith("bottle");
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels scheduled live work when the teacher disables it or the runtime is destroyed", async () => {
    vi.useFakeTimers();
    try {
      const client: LivePhotoClient = { setEnabled: vi.fn(), search: vi.fn() };
      const harness = runtimeHarness([asset("core")], client, 250);
      harness.input.value = "bottle";
      harness.toggle.checked = true;
      harness.toggle.dispatchEvent(new Event("change"));
      harness.toggle.checked = false;
      harness.toggle.dispatchEvent(new Event("change"));
      await vi.advanceTimersByTimeAsync(300);
      expect(client.search).not.toHaveBeenCalled();

      harness.toggle.checked = true;
      harness.toggle.dispatchEvent(new Event("change"));
      harness.runtime.destroy();
      await vi.advanceTimersByTimeAsync(300);
      expect(client.search).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

class PlacementCanvas implements CanvasPort {
  readonly objects: Array<Record<string, unknown>>;
  readonly removed: string[] = [];
  readonly productKitAdds: NewProductKitInput[] = [];
  readonly artworkAdds: Array<{
    address: ArtworkSurfaceAddress;
    input: NewRasterInput;
  }> = [];
  readonly artworkRemoved: Array<{
    address: ArtworkSurfaceAddress;
    childId: string;
  }> = [];
  serializeTransform?: (state: Record<string, unknown>) => void;
  removeArtworkFailure?: Error;
  productKitFailureBeforeAdd?: Error;
  productKitFailureAfterAdd?: Error;
  productKitRootTransform?: (root: Record<string, unknown>) => void;
  selectedIds: string[] = [];

  get selectedId(): string | null {
    return this.selectedIds.length === 1 ? this.selectedIds[0]! : null;
  }

  set selectedId(value: string | null) {
    this.selectedIds = value === null ? [] : [value];
  }

  constructor(objects: Array<Record<string, unknown>> = []) {
    this.objects = structuredClone(objects);
  }

  async addRaster(input: { id: string; assetId: string; sameOriginUrl: string; accessibleName: string }): Promise<void> {
    this.objects.push({
      type: "image",
      objectId: input.id,
      elementKind: "image",
      assetId: input.assetId,
      accessibleName: input.accessibleName,
      src: new URL(input.sameOriginUrl, window.location.href).href,
      width: 1_024,
      height: 576,
      left: 800,
      top: 450,
      scaleX: 0.625,
      scaleY: 0.625
    });
  }
  async addLogoMark(_input: NewLogoMarkInput): Promise<void> { throw new Error("not used"); }
  async replaceLogoMark(_id: string, _input: LogoMarkSource): Promise<void> {
    throw new Error("not used");
  }
  listLogoMarks(): readonly LogoMarkSnapshot[] { return []; }
  async addProductShell(input: {
    id: string;
    shellId: string;
    svg: string;
    accessibleName: string;
  }): Promise<void> {
    this.objects.push({
      type: "group",
      objectId: input.id,
      elementKind: "product-shell",
      shellId: input.shellId,
      accessibleName: input.accessibleName,
      svg: input.svg
    });
  }
  async addProductVariant(input: NewProductVariantInput): Promise<void> {
    this.objects.push({
      type: "group",
      objectId: input.id,
      elementKind: "product-shell",
      shellId: input.variant.bodyId,
      accessibleName: input.accessibleName,
      packId: input.variant.packId,
      variantId: input.variant.id,
      bodyId: input.variant.bodyId,
      partId: input.variant.partId,
      paletteId: input.variant.paletteId,
      materialId: input.variant.materialId,
      artwork: input.artwork
    });
  }
  async addProductKit(input: NewProductKitInput): Promise<void> {
    this.productKitAdds.push(input);
    if (this.productKitFailureBeforeAdd) throw this.productKitFailureBeforeAdd;
    const root: Record<string, unknown> = {
      type: "group",
      objectId: input.id,
      elementKind: "product-kit",
      accessibleName: input.accessibleName,
      productKitPackId: input.catalogue.packId,
      productKitId: input.plan.kitId,
      productKitCatalogSha256: input.catalogue.catalogSha256,
      objects: input.plan.layers.flatMap(({ layer, entries }) => entries.map((entry) =>
        entry.kind === "artwork-slot"
          ? { type: "group", productLayer: "artwork-slot", artworkSlotId: entry.itemId }
          : { type: "image", productLayer: layer }
      ))
    };
    this.productKitRootTransform?.(root);
    this.objects.push(root);
    if (this.productKitFailureAfterAdd) throw this.productKitFailureAfterAdd;
  }
  async addArtworkText(_address: ArtworkSurfaceAddress, _input: NewTextInput): Promise<void> {
    throw new Error("Unexpected artwork-surface command");
  }
  async addArtworkShape(_address: ArtworkSurfaceAddress, _input: NewShapeInput): Promise<void> {
    throw new Error("Unexpected artwork-surface command");
  }
  async addArtworkRaster(address: ArtworkSurfaceAddress, input: NewRasterInput): Promise<void> {
    this.artworkAdds.push({
      address: structuredClone(address),
      input: structuredClone(input)
    });
    this.#artworkSlot(address).push({
      type: "image",
      objectId: input.id,
      elementKind: "image",
      assetId: input.assetId,
      accessibleName: input.accessibleName,
      productLayer: "student-artwork",
      src: new URL(input.sameOriginUrl, window.location.href).href
    });
  }
  setArtworkText(_address: ArtworkSurfaceAddress, _id: string, _value: string): void {
    throw new Error("Unexpected artwork-surface command");
  }
  removeArtwork(address: ArtworkSurfaceAddress, childId: string): void {
    this.artworkRemoved.push({ address: structuredClone(address), childId });
    if (this.removeArtworkFailure) throw this.removeArtworkFailure;
    const objects = this.#artworkSlot(address);
    const index = objects.findIndex((object) => object.objectId === childId);
    if (index >= 0) objects.splice(index, 1);
  }
  setProductShellRegion(): void { throw new Error("not used"); }
  getProductShellRegionColours(): Readonly<Record<string, string>> { return {}; }
  remove(id: string): void {
    this.removed.push(id);
    const index = this.objects.findIndex(({ objectId }) => objectId === id);
    if (index >= 0) this.objects.splice(index, 1);
    this.selectedIds = this.selectedIds.filter((selectedId) => selectedId !== id);
  }
  serialize(): Record<string, unknown> {
    const state: Record<string, unknown> = {
      version: "7.4.0",
      objects: structuredClone(this.objects)
    };
    this.serializeTransform?.(state);
    return state;
  }
  setSelected(id: string | null): void { this.selectedId = id; }
  getSelectedObjectId(): string | null {
    if (this.selectedIds.length > 1) {
      throw new Error("An ordered multi-selection has no single object ID");
    }
    return this.selectedId;
  }
  listObjectSummaries(): readonly [] { return []; }
  captureSelection(): { readonly objectIds: readonly string[] } {
    return Object.freeze({ objectIds: Object.freeze([...this.selectedIds]) });
  }
  restoreSelection(snapshot: { readonly objectIds: readonly string[] }): void {
    this.selectedIds = [...snapshot.objectIds];
  }
  setText(): void {}
  async addText(): Promise<void> { throw new Error("not used"); }
  async addShape(): Promise<void> { throw new Error("not used"); }
  transform(id: string, patch: Partial<ObjectTransform>): void {
    const object = this.objects.find((candidate) => candidate.objectId === id);
    if (!object) throw new Error(`Missing object ${id}`);
    if (patch.x !== undefined) object.left = patch.x;
    if (patch.y !== undefined) object.top = patch.y;
    if (patch.scaleX !== undefined) object.scaleX = patch.scaleX;
    if (patch.scaleY !== undefined) object.scaleY = patch.scaleY;
    if (patch.angle !== undefined) object.angle = patch.angle;
    if (patch.flipX !== undefined) object.flipX = patch.flipX;
    if (patch.flipY !== undefined) object.flipY = patch.flipY;
  }
  assertCanDuplicate(): void {}
  async duplicate(): Promise<void> {}
  move(): void {}
  setLocked(): void {}
  setVisible(): void {}
  getCropSourceSize() { return { width: 1, height: 1 }; }
  setCrop(): void {}
  setDrawingTool(): void {}
  eraseTopmostDrawing(): boolean { return false; }
  exportCleanPngDataUrl(): string { return ""; }
  async load(value: Record<string, unknown>): Promise<void> {
    this.objects.splice(0, this.objects.length, ...structuredClone(
      Array.isArray(value.objects) ? value.objects as Array<Record<string, unknown>> : []
    ));
    this.selectedIds = [];
  }
  subscribe(_listener: CanvasMutationListener): () => void { return () => {}; }
  subscribeSelection(_listener: CanvasSelectionListener): () => void { return () => {}; }

  #artworkSlot(address: ArtworkSurfaceAddress): Array<Record<string, unknown>> {
    const product = this.objects.find((object) => object.objectId === address.productId);
    if (!product || !Array.isArray(product.objects)) {
      throw new Error("Product artwork surface was not found");
    }
    const slot = (product.objects as Array<Record<string, unknown>>).find((object) =>
      object.productLayer === "artwork-slot" && object.artworkSlotId === address.slotId
    );
    if (!slot || !Array.isArray(slot.objects)) {
      throw new Error("Product artwork slot was not found");
    }
    return slot.objects as Array<Record<string, unknown>>;
  }
}

const ARTWORK_ADDRESS: ArtworkSurfaceAddress = {
  productId: "product-1",
  slotId: "primary"
};

function productObject(
  productId = ARTWORK_ADDRESS.productId,
  slotId = ARTWORK_ADDRESS.slotId
): Record<string, unknown> {
  return {
    type: "group",
    objectId: productId,
    elementKind: "product-shell",
    accessibleName: `${productId} product`,
    left: 48,
    top: 72,
    scaleX: 1.25,
    scaleY: 0.8,
    angle: 12,
    clipPath: { type: "rect", width: 320, height: 220 },
    objects: [
      { type: "path", productLayer: "base-shell" },
      {
        type: "group",
        productLayer: "artwork-slot",
        artworkSlotId: slotId,
        objects: [{
          type: "rect",
          objectId: `${productId}-sibling-artwork`,
          elementKind: "shape",
          accessibleName: "Existing sibling artwork"
        }]
      }
    ]
  };
}

function semanticImage(objectId: string, assetId = "existing-asset"): Record<string, unknown> {
  return {
    type: "image",
    objectId,
    elementKind: "image",
    accessibleName: "Existing catalogue image",
    assetId
  };
}

function placementDocument(objects: Array<Record<string, unknown>>): CampaignDocumentV1 {
  return parseCampaignDocument({
    ...createBlankCampaignDocument({
      documentId: "targeted-placement-document",
      sessionId: "targeted-placement-session",
      mode: "offline"
    }),
    fabricState: { version: "7.4.0", objects: structuredClone(objects) }
  });
}

function stateObjects(state: Record<string, unknown>): Array<Record<string, unknown>> {
  if (!Array.isArray(state.objects)) throw new Error("Expected Fabric state objects");
  return state.objects as Array<Record<string, unknown>>;
}

function objectChildren(object: Record<string, unknown>): Array<Record<string, unknown>> {
  if (!Array.isArray(object.objects)) throw new Error("Expected Fabric object children");
  return object.objects as Array<Record<string, unknown>>;
}

function findSemanticObject(
  objects: Array<Record<string, unknown>>,
  objectId: string
): Record<string, unknown> | undefined {
  for (const object of objects) {
    if (object.objectId === objectId) return object;
    if (Array.isArray(object.objects)) {
      const found = findSemanticObject(
        object.objects as Array<Record<string, unknown>>,
        objectId
      );
      if (found) return found;
    }
  }
  return undefined;
}

function mutableProductKitBundle(bundle: LoadedProductKitBundle): LoadedProductKitBundle {
  return {
    catalogue: bundle.catalogue,
    runtime: bundle.runtime,
    rasterSources: new Map([...bundle.rasterSources].map(([key, source]) => [
      key,
      { ...source }
    ])),
    pricing: {
      packId: bundle.pricing.packId,
      pricingVersion: bundle.pricing.pricingVersion,
      blueprintTitleByKitId: new Map(bundle.pricing.blueprintTitleByKitId),
      byPriceAssetId: new Map([...bundle.pricing.byPriceAssetId].map(([key, price]) => [
        key,
        { ...price }
      ]))
    }
  };
}

function productKitTransactionHarness(
  historyCommitFailure = false,
  selectedIds: readonly string[] = ["selected-before-kit"]
) {
  const canvas = new PlacementCanvas([...selectedIds].reverse().map((id) => semanticImage(id)));
  canvas.restoreSelection({ objectIds: selectedIds });
  let document = placementDocument(canvas.objects);
  let history = {
    past: [] as CampaignDocumentV1[],
    present: structuredClone(document),
    future: [] as CampaignDocumentV1[]
  };
  const commit = vi.fn((next: CampaignDocumentV1) => { document = next; });
  const transaction = vi.fn(async (operation: () => Promise<void>) => {
    const initialCanvas = canvas.serialize();
    const initialDocument = structuredClone(document);
    const initialHistory = structuredClone(history);
    try {
      await operation();
      if (historyCommitFailure) throw new Error("Synthetic history commit failure");
      history = {
        past: [...initialHistory.past, initialHistory.present],
        present: structuredClone(document),
        future: []
      };
    } catch (error) {
      if (JSON.stringify(canvas.serialize()) !== JSON.stringify(initialCanvas)) {
        await canvas.load(initialCanvas);
      }
      document = initialDocument;
      history = initialHistory;
      throw error;
    }
  });
  return {
    canvas,
    commit,
    transaction,
    selectedId: selectedIds.length === 1 ? selectedIds[0]! : null,
    getDocument: () => document,
    getHistory: () => history
  };
}

function productSlot(
  objects: Array<Record<string, unknown>>,
  productId = ARTWORK_ADDRESS.productId,
  slotId = ARTWORK_ADDRESS.slotId
): Record<string, unknown> {
  const product = objects.find((object) => object.objectId === productId);
  if (!product) throw new Error(`Expected product ${productId}`);
  const slot = objectChildren(product).find((object) =>
    object.productLayer === "artwork-slot" && object.artworkSlotId === slotId
  );
  if (!slot) throw new Error(`Expected artwork slot ${slotId}`);
  return slot;
}

const artworkReconciliationCases: Array<[
  string,
  (state: Record<string, unknown>, childId: string) => void
]> = [
  ["a top-level requested product", (state) => {
    const objects = stateObjects(state);
    const index = objects.findIndex((object) => object.objectId === ARTWORK_ADDRESS.productId);
    if (index < 0) return;
    const [product] = objects.splice(index, 1);
    if (!product) return;
    objects.unshift({ type: "group", objects: [product] });
  }],
  ["the exact root-slot-child path", (state, childId) => {
    const slot = productSlot(stateObjects(state));
    const children = objectChildren(slot);
    const index = children.findIndex((object) => object.objectId === childId);
    if (index < 0) return;
    const [child] = children.splice(index, 1);
    if (!child) return;
    children.push({ type: "group", objects: [child] });
  }],
  ["the requested product root", (state, childId) => {
    const objects = stateObjects(state);
    const source = objectChildren(productSlot(objects));
    const index = source.findIndex((object) => object.objectId === childId);
    if (index < 0) return;
    const [child] = source.splice(index, 1);
    if (!child) return;
    objectChildren(productSlot(objects, "product-2")).push(child);
  }],
  ["a product-shell root", (state) => {
    const product = stateObjects(state).find((object) =>
      object.objectId === ARTWORK_ADDRESS.productId
    );
    if (product) product.elementKind = "shape";
  }],
  ["an artwork-slot direct parent", (state) => {
    const product = stateObjects(state).find((object) =>
      object.objectId === ARTWORK_ADDRESS.productId
    );
    const slot = product && objectChildren(product).find((object) =>
      object.artworkSlotId === ARTWORK_ADDRESS.slotId
    );
    if (slot) slot.productLayer = "base-shell";
  }],
  ["the named artwork slot", (state) => {
    const product = stateObjects(state).find((object) =>
      object.objectId === ARTWORK_ADDRESS.productId
    );
    const slot = product && objectChildren(product).find((object) =>
      object.productLayer === "artwork-slot"
    );
    if (slot) slot.artworkSlotId = "secondary";
  }],
  ["the generated child ID", (state, childId) => {
    const child = findSemanticObject(stateObjects(state), childId);
    if (child) child.objectId = "different-child";
  }],
  ["an image child", (state, childId) => {
    const child = findSemanticObject(stateObjects(state), childId);
    if (child) child.elementKind = "shape";
  }],
  ["the requested asset ID", (state, childId) => {
    const child = findSemanticObject(stateObjects(state), childId);
    if (child) child.assetId = "different-asset";
  }]
];

describe("CataloguePlacementQueue", () => {
  it("refuses Product Kit placement without the host transaction before any mutation", async () => {
    const bundle = await pilotProductKitBundle();
    const canvas = new PlacementCanvas([semanticImage("existing-object")]);
    canvas.selectedId = "existing-object";
    let document = placementDocument(canvas.objects);
    const history = {
      past: [] as CampaignDocumentV1[],
      present: structuredClone(document),
      future: [] as CampaignDocumentV1[]
    };
    const initialCanvas = canvas.serialize();
    const initialDocument = structuredClone(document);
    const initialHistory = structuredClone(history);
    const createObjectId = vi.fn(() => "product-kit-object-1");
    const getCanvas = vi.fn(async () => canvas);
    const hostileCommit = vi.fn((next: CampaignDocumentV1) => {
      document = next;
      history.past.push(structuredClone(next));
      throw new Error("Hostile commit mutated before throwing");
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas,
      commit: hostileCommit,
      createObjectId
    });

    queue.enqueueProductKit(bundle, PRODUCT_KIT_REQUEST);
    await expect(queue.flush()).rejects.toThrow(/transaction/i);

    expect(createObjectId).not.toHaveBeenCalled();
    expect(getCanvas).not.toHaveBeenCalled();
    expect(hostileCommit).not.toHaveBeenCalled();
    expect(canvas.productKitAdds).toEqual([]);
    expect(canvas.serialize()).toEqual(initialCanvas);
    expect(canvas.selectedId).toBe("existing-object");
    expect(document).toEqual(initialDocument);
    expect(history).toEqual(initialHistory);
    expect(document.assetReferences).toEqual(initialDocument.assetReferences);
    expect(document.product.build).toEqual(initialDocument.product.build);
  });

  it("places a Product Kit from a multi-selection and selects only its new root", async () => {
    const bundle = await pilotProductKitBundle();
    const selectedIds = ["selected-third", "selected-first"];
    const harness = productKitTransactionHarness(false, selectedIds);
    const queue = new CataloguePlacementQueue({
      getDocument: harness.getDocument,
      getCanvas: async () => harness.canvas,
      commit: harness.commit,
      transaction: harness.transaction,
      createObjectId: () => "product-kit-object-1"
    });

    queue.enqueueProductKit(bundle, PRODUCT_KIT_REQUEST);
    await queue.flush();

    expect(harness.canvas.captureSelection())
      .toEqual({ objectIds: ["product-kit-object-1"] });
    expect(harness.getDocument().fabricState).not.toHaveProperty("selection");
    expect(harness.canvas.serialize()).not.toHaveProperty("selection");
  });

  it("places one snapshotted Product Kit as one semantic and economic transaction", async () => {
    const admitted = await pilotProductKitBundle();
    const mutableBundle = mutableProductKitBundle(admitted);
    const mutableRequest = structuredClone(PRODUCT_KIT_REQUEST) as {
      kitId: string;
      placements: Array<{
        kind: "socket";
        placementId: string;
        mountFrameId: string;
        componentId: string;
      }>;
    };
    const harness = productKitTransactionHarness();
    const createObjectId = vi.fn(() => "product-kit-object-1");
    const getCanvas = vi.fn(async () => harness.canvas);
    const queue = new CataloguePlacementQueue({
      getDocument: harness.getDocument,
      getCanvas,
      commit: harness.commit,
      transaction: harness.transaction,
      createObjectId
    });

    queue.enqueueProductKit(mutableBundle, mutableRequest);
    mutableRequest.placements[0]!.componentId = "mutated-after-enqueue";
    (mutableBundle.rasterSources as Map<string, unknown>).clear();
    (mutableBundle.pricing.byPriceAssetId as Map<string, unknown>).clear();
    (mutableBundle as unknown as { runtime: null }).runtime = null;
    await queue.flush();

    const document = harness.getDocument();
    const references = document.assetReferences.filter((reference) =>
      reference.kind === "product-kit-composition"
    ) as unknown as ProductKitCompositionReference[];
    expect(harness.transaction).toHaveBeenCalledOnce();
    expect(harness.getHistory().past).toHaveLength(1);
    expect(createObjectId).toHaveBeenCalledOnce();
    expect(getCanvas).toHaveBeenCalledOnce();
    expect(harness.canvas.productKitAdds).toHaveLength(1);
    expect(harness.canvas.objects).toHaveLength(2);
    expect(harness.canvas.selectedId).toBe("product-kit-object-1");
    expect(harness.commit).toHaveBeenCalledOnce();
    expect(references).toHaveLength(1);
    expect(references[0]).toMatchObject({
      kind: "product-kit-composition",
      version: 1,
      objectId: "product-kit-object-1",
      productKitPackId: admitted.catalogue.packId,
      catalogPackId: admitted.catalogue.catalogPackId,
      catalogSha256: admitted.catalogue.catalogSha256,
      request: PRODUCT_KIT_REQUEST
    });
    expect(parseProductKitCompositionReference(references[0], {
      catalogue: admitted.catalogue,
      runtime: admitted.runtime,
      pricing: admitted.pricing
    })).not.toBeNull();
    expect(document.product.build).toMatchObject({
      schema: "product-build@1",
      primaryObjectId: "product-kit-object-1",
      packId: admitted.catalogue.packId,
      blueprintId: PRODUCT_KIT_REQUEST.kitId,
      unitCostCents: 550
    });
    expect(document.product.build?.costLines).toHaveLength(2);

    const semantic = campaignSemanticObjectMap(document.fabricState);
    const root = semantic.get("product-kit-object-1");
    expect(semantic.size).toBe(2);
    expect(root).toMatchObject({ elementKind: "product-kit", path: [1] });
    expect(root?.object).toMatchObject({
      productKitPackId: references[0]!.productKitPackId,
      productKitId: references[0]!.request.kitId,
      productKitCatalogSha256: references[0]!.catalogSha256
    });
    expect(document.product.build?.primaryObjectId).toBe(references[0]!.objectId);
  });

  it.each([
    {
      label: "plan",
      message: /plan/i,
      configure: (_canvas: PlacementCanvas, request: typeof PRODUCT_KIT_REQUEST) => {
        (request.placements[0] as { componentId: string }).componentId = "uncertified-lid";
      }
    },
    {
      label: "PNG load",
      message: /PNG load failure/,
      configure: (canvas: PlacementCanvas) => {
        canvas.productKitFailureBeforeAdd = new Error("Synthetic PNG load failure");
      }
    },
    {
      label: "canvas add",
      message: /canvas add failure/,
      configure: (canvas: PlacementCanvas) => {
        canvas.productKitFailureAfterAdd = new Error("Synthetic canvas add failure");
      }
    },
    {
      label: "document validation",
      message: /version/i,
      configure: (canvas: PlacementCanvas) => {
        canvas.serializeTransform = (state) => {
          if (findSemanticObject(stateObjects(state), "product-kit-object-1")) state.version = "";
        };
      }
    },
    {
      label: "root/reference agreement",
      message: /agree|reconcile|identity/i,
      configure: (canvas: PlacementCanvas) => {
        canvas.productKitRootTransform = (root) => {
          root.productKitCatalogSha256 = "0".repeat(64);
        };
      }
    },
    {
      label: "history commit",
      message: /history commit failure/,
      historyCommitFailure: true,
      configure: () => undefined
    }
  ])("restores canvas, document, ordered multi-selection and history exactly after $label failure", async ({
    message,
    configure,
    historyCommitFailure = false
  }) => {
    const bundle = await pilotProductKitBundle();
    const request = structuredClone(PRODUCT_KIT_REQUEST);
    const selectedIds = ["selected-third", "selected-first"];
    const harness = productKitTransactionHarness(historyCommitFailure, selectedIds);
    configure(harness.canvas, request);
    const initialCanvas = harness.canvas.serialize();
    const initialSelection = harness.canvas.captureSelection();
    const initialDocument = structuredClone(harness.getDocument());
    const initialHistory = structuredClone(harness.getHistory());
    const createObjectId = vi.fn(() => "product-kit-object-1");
    const queue = new CataloguePlacementQueue({
      getDocument: harness.getDocument,
      getCanvas: async () => harness.canvas,
      commit: harness.commit,
      transaction: harness.transaction,
      createObjectId
    });

    queue.enqueueProductKit(bundle, request);
    await expect(queue.flush()).rejects.toThrow(message);

    expect(harness.canvas.serialize()).toEqual(initialCanvas);
    expect(harness.getDocument()).toEqual(initialDocument);
    expect(harness.canvas.captureSelection()).toEqual(initialSelection);
    expect(harness.getHistory()).toEqual(initialHistory);
    expect(harness.transaction).toHaveBeenCalledOnce();
    expect(createObjectId).toHaveBeenCalledTimes(
      (request.placements[0] as { componentId: string }).componentId === "uncertified-lid" ? 0 : 1
    );
  });

  it("tints a reviewed raster template into durable local PNG bytes before placement", async () => {
    const canvas = new PlacementCanvas();
    let document: CampaignDocumentV1 = createBlankCampaignDocument({
      documentId: "tinted-template-document",
      sessionId: "tinted-template-session",
      mode: "offline"
    });
    const reviewed = recolourableAsset("colourable-sofa");
    const tinted = new Blob([Uint8Array.from([137, 80, 78, 71, 1])], { type: "image/png" });
    const tintRaster = vi.fn().mockResolvedValue(tinted);
    const objectUrl = `blob:${window.location.origin}/tinted-template-object`;
    let attachment: { blobKey: string; blob: Blob; objectUrl: string } | undefined;
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next, localBlob) => { document = next; attachment = localBlob; },
      createObjectId: () => "tinted-template-object",
      tintRaster,
      createObjectURL: () => objectUrl
    });

    queue.enqueue(reviewed, { bodyColour: "#e4572e" });
    await queue.flush();

    expect(tintRaster).toHaveBeenCalledWith(reviewed, "#E4572E");
    expect(canvas.objects[0]).toMatchObject({
      objectId: "tinted-template-object",
      assetId: "colourable-sofa",
      src: objectUrl
    });
    expect(document.assetReferences).toEqual([
      expect.objectContaining({ kind: "catalog", objectId: "tinted-template-object" }),
      expect.objectContaining({
        kind: "local-blob",
        objectId: "tinted-template-object",
        assetId: "colourable-sofa",
        blobKey: "catalog-tinted-template-object",
        mimeType: "image/png"
      })
    ]);
    expect(attachment).toEqual({
      blobKey: "catalog-tinted-template-object",
      blob: tinted,
      objectUrl
    });
  });

  it("rejects an invalid template colour before loading the canvas or tinting", async () => {
    const reviewed = recolourableAsset("colourable-sofa");
    const getCanvas = vi.fn();
    const tintRaster = vi.fn();
    const queue = new CataloguePlacementQueue({
      getDocument: () => createBlankCampaignDocument({
        documentId: "bad-template-colour-document",
        sessionId: "bad-template-colour-session",
        mode: "offline"
      }),
      getCanvas,
      commit: vi.fn(),
      tintRaster
    });

    queue.enqueue(reviewed, { bodyColour: "orange" });

    await expect(queue.flush()).rejects.toThrow(/six-digit/i);
    expect(getCanvas).not.toHaveBeenCalled();
    expect(tintRaster).not.toHaveBeenCalled();
  });

  it("places through ObjectCommandService and commits a durable catalogue reference", async () => {
    const canvas = new PlacementCanvas();
    let document: CampaignDocumentV1 = createBlankCampaignDocument({
      documentId: "placement-document",
      sessionId: "placement-session",
      mode: "offline"
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next) => { document = next; },
      createObjectId: () => "catalog-object"
    });

    queue.enqueue(asset("core"));
    await queue.flush();

    expect(canvas.objects[0]).toMatchObject({ objectId: "catalog-object", assetId: "core" });
    expect(document.assetReferences).toEqual([{
      kind: "catalog",
      objectId: "catalog-object",
      assetId: "core",
      assetVersion: 1,
      attribution: asset("core").attribution
    }]);
    expect(canvas.artworkAdds).toEqual([]);
  });

  it("places a generated raster with durable generation and blob references that rehydrate", async () => {
    const canvas = new PlacementCanvas();
    let document: CampaignDocumentV1 = createBlankCampaignDocument({
      documentId: "generated-placement-document",
      sessionId: "generated-placement-session",
      mode: "offline"
    });
    const blob = new Blob([Uint8Array.from([137, 80, 78, 71, 1, 2, 3])], {
      type: "image/png"
    });
    const objectUrl = `blob:${window.location.origin}/generated-object`;
    const createObjectURL = vi.fn(() => objectUrl);
    const revokeObjectURL = vi.fn();
    let attachment: { blobKey: string; blob: Blob; objectUrl: string } | undefined;
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next, localBlob) => { document = next; attachment = localBlob; },
      createObjectId: () => "generated-object",
      createObjectURL,
      revokeObjectURL
    });

    queue.enqueueGeneratedRaster({
      assetId: "generated-asset-1",
      title: "Solar snack packet",
      blob,
      stage: "object-forge",
      profileId: "forge-cheap-v1",
      requestId: "request-1"
    });
    await queue.flush();

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(canvas.objects).toContainEqual(expect.objectContaining({
      objectId: "generated-object",
      elementKind: "image",
      assetId: "generated-asset-1",
      accessibleName: "Solar snack packet",
      src: objectUrl
    }));
    expect(document.assetReferences).toEqual([
      {
        kind: "generated-image",
        version: 1,
        objectId: "generated-object",
        assetId: "generated-asset-1",
        title: "Solar snack packet",
        stage: "object-forge",
        profileId: "forge-cheap-v1",
        requestId: "request-1"
      },
      {
        kind: "local-blob",
        objectId: "generated-object",
        assetId: "generated-asset-1",
        blobKey: "generated-generated-object",
        mimeType: "image/png"
      }
    ]);
    expect(attachment).toMatchObject({
      blobKey: "generated-generated-object",
      blob,
      objectUrl
    });

    const reloadedUrl = `blob:${window.location.origin}/reloaded-generated-object`;
    const reloadRevoke = vi.fn();
    const rehydrated = rehydrateLocalAssetBlobs(
      document,
      new Map([[attachment!.blobKey, attachment!.blob]]),
      { createObjectURL: () => reloadedUrl, revokeObjectURL: reloadRevoke }
    );
    expect(findSemanticObject(
      stateObjects(rehydrated.document.fabricState),
      "generated-object"
    )?.src).toBe(reloadedUrl);
    expect(rehydrated.document.assetReferences).toContainEqual(expect.objectContaining({
      kind: "generated-image",
      requestId: "request-1"
    }));
    rehydrated.release();
    expect(reloadRevoke).toHaveBeenCalledWith(reloadedUrl);
  });

  it("fills the ad with a Make It Real result while leaving it movable and zoomable", async () => {
    const canvas = new PlacementCanvas();
    let document: CampaignDocumentV1 = createBlankCampaignDocument({
      documentId: "realised-placement-document",
      sessionId: "realised-placement-session",
      mode: "offline"
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next) => { document = next; },
      createObjectId: () => "realised-product",
      createObjectURL: () => `blob:${window.location.origin}/realised-product`
    });

    queue.enqueueGeneratedRaster({
      assetId: "realised-asset",
      title: "Realistic Orbit tumbler",
      blob: new Blob([Uint8Array.from([1])], { type: "image/webp" }),
      stage: "make-it-real",
      profileId: "real-product-v1",
      requestId: "realise-request"
    });
    await queue.flush();

    expect(canvas.objects).toContainEqual(expect.objectContaining({
      objectId: "realised-product",
      left: 800,
      top: 450,
      scaleX: 1.5625,
      scaleY: 1.5625
    }));
    expect(document.fabricState).toMatchObject({
      objects: [expect.objectContaining({
        objectId: "realised-product",
        left: 800,
        top: 450,
        scaleX: 1.5625,
        scaleY: 1.5625
      })]
    });
  });

  it("keeps generated and catalogue raster placement on one serial tail", async () => {
    const canvas = new PlacementCanvas();
    let document: CampaignDocumentV1 = createBlankCampaignDocument({
      documentId: "generated-serial-document",
      sessionId: "generated-serial-session",
      mode: "offline"
    });
    const firstCanvas = deferred<CanvasPort>();
    const getCanvas = vi.fn()
      .mockReturnValueOnce(firstCanvas.promise)
      .mockResolvedValue(canvas);
    const objectIds = ["generated-first", "catalogue-second"];
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas,
      commit: (next) => { document = next; },
      createObjectId: () => objectIds.shift() ?? "unexpected-object",
      createObjectURL: () => `blob:${window.location.origin}/generated-first`
    });

    queue.enqueueGeneratedRaster({
      assetId: "generated-asset-2",
      title: "Realistic solar snack packet",
      blob: new Blob([Uint8Array.from([1])], { type: "image/webp" }),
      stage: "make-it-real",
      profileId: "real-product-v1",
      requestId: "request-2"
    });
    queue.enqueue(asset("core"));
    await Promise.resolve();

    expect(getCanvas).toHaveBeenCalledOnce();
    expect(document.assetReferences).toEqual([]);

    firstCanvas.resolve(canvas);
    await queue.flush();

    expect(getCanvas).toHaveBeenCalledTimes(2);
    expect(canvas.objects.map(({ objectId }) => objectId)).toEqual([
      "generated-first",
      "catalogue-second"
    ]);
    expect(document.assetReferences.map(({ kind }) => kind)).toEqual([
      "generated-image",
      "local-blob",
      "catalog"
    ]);
  });

  it.each([
    [
      "an unsupported image type",
      { blob: new Blob([Uint8Array.from([1])], { type: "image/gif" }) },
      /type is not supported/i
    ],
    [
      "an empty image",
      { blob: new Blob([], { type: "image/png" }) },
      /empty/i
    ],
    [
      "an oversized image",
      {
        blob: new Blob([new Uint8Array(12 * 1024 * 1024 + 1)], {
          type: "image/jpeg"
        })
      },
      /too large/i
    ],
    [
      "an unknown generation stage",
      { stage: "thumbnail-preview" },
      /stage/i
    ],
    [
      "a blank generation profile",
      { profileId: "  " },
      /profile ID/i
    ],
    [
      "a non-Blob payload",
      { blob: null },
      /must be a Blob/i
    ]
  ])("rejects generated raster placement with %s before canvas mutation", async (
    _label,
    invalid,
    message
  ) => {
    const canvas = new PlacementCanvas();
    const document = createBlankCampaignDocument({
      documentId: "invalid-generated-document",
      sessionId: "invalid-generated-session",
      mode: "offline"
    });
    const getCanvas = vi.fn(async () => canvas);
    const createObjectURL = vi.fn();
    const commit = vi.fn();
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas,
      commit,
      createObjectURL
    });
    const input = {
      assetId: "generated-asset-invalid",
      title: "Invalid generated image",
      blob: new Blob([Uint8Array.from([1])], { type: "image/png" }),
      stage: "object-forge",
      profileId: "forge-cheap-v1",
      requestId: "invalid-request",
      ...invalid
    } as unknown as Parameters<CataloguePlacementQueue["enqueueGeneratedRaster"]>[0];

    queue.enqueueGeneratedRaster(input);
    await expect(queue.flush()).rejects.toThrow(message);

    expect(getCanvas).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(canvas.objects).toEqual([]);
    expect(commit).not.toHaveBeenCalled();
  });

  it("removes Fabric and revokes the owned URL when a generated object ID does not reconcile", async () => {
    const canvas = new PlacementCanvas();
    canvas.serializeTransform = (state) => {
      const object = findSemanticObject(stateObjects(state), "generated-reconcile-object");
      if (object) object.objectId = "different-generated-object";
    };
    const document = createBlankCampaignDocument({
      documentId: "generated-reconcile-document",
      sessionId: "generated-reconcile-session",
      mode: "offline"
    });
    const objectUrl = `blob:${window.location.origin}/generated-reconcile-object`;
    const revokeObjectURL = vi.fn();
    const commit = vi.fn();
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit,
      createObjectId: () => "generated-reconcile-object",
      createObjectURL: () => objectUrl,
      revokeObjectURL
    });

    queue.enqueueGeneratedRaster({
      assetId: "generated-reconcile-asset",
      title: "Generated reconcile image",
      blob: new Blob([Uint8Array.from([1, 2, 3])], { type: "image/jpeg" }),
      stage: "make-it-real",
      profileId: "real-product-v1",
      requestId: "reconcile-request"
    });
    await expect(queue.flush()).rejects.toThrow(
      "Placed generated raster did not reconcile with the canvas"
    );

    expect(commit).not.toHaveBeenCalled();
    expect(canvas.removed).toEqual(["generated-reconcile-object"]);
    expect(canvas.objects).toEqual([]);
    expect(revokeObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  it("rejects a generated object ID already in the campaign before owning a URL", async () => {
    const objectId = "duplicate-generated-object";
    const canvas = new PlacementCanvas();
    const document = placementDocument([semanticImage(objectId)]);
    const createObjectURL = vi.fn();
    const commit = vi.fn();
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit,
      createObjectId: () => objectId,
      createObjectURL
    });

    queue.enqueueGeneratedRaster({
      assetId: "duplicate-generated-asset",
      title: "Duplicate generated image",
      blob: new Blob([Uint8Array.from([1])], { type: "image/png" }),
      stage: "object-forge",
      profileId: "forge-cheap-v1",
      requestId: "duplicate-request"
    });
    await expect(queue.flush()).rejects.toThrow(/already exists/i);

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(canvas.objects).toEqual([]);
    expect(commit).not.toHaveBeenCalled();
  });

  it("places offline catalogue artwork inside the named product slot", async () => {
    const canvas = new PlacementCanvas([productObject()]);
    const originalProduct = structuredClone(canvas.objects[0]);
    if (!originalProduct) throw new Error("Expected product fixture");
    let document = placementDocument(canvas.objects);
    let attachment: unknown;
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next, localBlob) => { document = next; attachment = localBlob; },
      createObjectId: () => "targeted-offline-child"
    });

    queue.enqueueArtworkRaster(ARTWORK_ADDRESS, asset("core"));
    await queue.flush();

    expect(canvas.artworkAdds).toEqual([{
      address: ARTWORK_ADDRESS,
      input: {
        id: "targeted-offline-child",
        assetId: "core",
        sameOriginUrl: asset("core").files.master,
        accessibleName: asset("core").title
      }
    }]);
    expect(canvas.removed).toEqual([]);
    const committedObjects = stateObjects(document.fabricState);
    expect(committedObjects).toHaveLength(1);
    expect(committedObjects[0]).toMatchObject({
      objectId: originalProduct.objectId,
      left: originalProduct.left,
      top: originalProduct.top,
      scaleX: originalProduct.scaleX,
      scaleY: originalProduct.scaleY,
      angle: originalProduct.angle,
      clipPath: originalProduct.clipPath
    });
    expect(objectChildren(productSlot(committedObjects))).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectId: "product-1-sibling-artwork" }),
      expect.objectContaining({
        objectId: "targeted-offline-child",
        elementKind: "image",
        assetId: "core"
      })
    ]));
    expect(document.assetReferences).toEqual([{
      kind: "catalog",
      objectId: "targeted-offline-child",
      assetId: "core",
      assetVersion: 1,
      attribution: asset("core").attribution
    }]);
    expect(attachment).toBeUndefined();
  });

  it("captures live artwork bytes and commits child-scoped catalogue and blob references", async () => {
    const canvas = new PlacementCanvas([productObject()]);
    let document = placementDocument(canvas.objects);
    const bytes = Uint8Array.from([137, 80, 78, 71, 9, 8, 7]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(bytes, {
      headers: { "content-type": "image/png", "content-length": String(bytes.length) }
    }));
    const objectUrl = `blob:${window.location.origin}/targeted-live-child`;
    const revokeObjectURL = vi.fn();
    let attachment: {
      blobKey: string;
      blob: Blob;
      objectUrl: string;
    } | undefined;
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next, localBlob) => { document = next; attachment = localBlob; },
      createObjectId: () => "targeted-live-child",
      fetch: fetchMock,
      createObjectURL: () => objectUrl,
      revokeObjectURL
    });

    queue.enqueueArtworkRaster(ARTWORK_ADDRESS, openverseAsset());
    await queue.flush();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(canvas.artworkAdds[0]).toMatchObject({
      address: ARTWORK_ADDRESS,
      input: {
        id: "targeted-live-child",
        assetId: OPENVERSE_ID,
        sameOriginUrl: objectUrl
      }
    });
    expect(document.assetReferences).toEqual([
      expect.objectContaining({
        kind: "catalog",
        objectId: "targeted-live-child",
        assetId: OPENVERSE_ID
      }),
      expect.objectContaining({
        kind: "local-blob",
        objectId: "targeted-live-child",
        assetId: OPENVERSE_ID,
        blobKey: "catalog-targeted-live-child",
        mimeType: "image/png"
      })
    ]);
    expect(attachment).toMatchObject({
      blobKey: "catalog-targeted-live-child",
      objectUrl
    });
    await expect(attachment!.blob.arrayBuffer()).resolves.toEqual(bytes.buffer);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("clones the artwork address and asset when enqueueing", async () => {
    const canvas = new PlacementCanvas([productObject()]);
    let document = placementDocument(canvas.objects);
    const address = structuredClone(ARTWORK_ADDRESS);
    const selectedAsset = asset("clone-core");
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next) => { document = next; },
      createObjectId: () => "cloned-input-child"
    });

    queue.enqueueArtworkRaster(address, selectedAsset);
    address.productId = "mutated-product";
    address.slotId = "mutated-slot";
    selectedAsset.id = "mutated-asset";
    selectedAsset.title = "Mutated title";
    selectedAsset.files.master = "/mutated.png";
    selectedAsset.attribution.creator = "Mutated creator";
    await queue.flush();

    expect(canvas.artworkAdds[0]).toEqual({
      address: ARTWORK_ADDRESS,
      input: {
        id: "cloned-input-child",
        assetId: "clone-core",
        sameOriginUrl: asset("clone-core").files.master,
        accessibleName: asset("clone-core").title
      }
    });
    expect(document.assetReferences).toContainEqual(expect.objectContaining({
      objectId: "cloned-input-child",
      assetId: "clone-core",
      attribution: asset("clone-core").attribution
    }));
  });

  it("rejects a generated child ID already in the committed document before fetch or mutation", async () => {
    const childId = "committed-duplicate-child";
    const canvas = new PlacementCanvas([productObject()]);
    const document = placementDocument([productObject(), semanticImage(childId)]);
    const fetchMock = vi.fn();
    const commit = vi.fn();
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit,
      createObjectId: () => childId,
      fetch: fetchMock
    });

    queue.enqueueArtworkRaster(ARTWORK_ADDRESS, openverseAsset());
    await expect(queue.flush()).rejects.toThrow(/already exists/i);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(canvas.artworkAdds).toEqual([]);
    expect(canvas.artworkRemoved).toEqual([]);
    expect(canvas.removed).toEqual([]);
    expect(commit).not.toHaveBeenCalled();
  });

  it("rejects a generated child ID already on the live canvas before fetch or mutation", async () => {
    const childId = "live-duplicate-child";
    const canvas = new PlacementCanvas([productObject(), semanticImage(childId)]);
    const document = placementDocument([productObject()]);
    const fetchMock = vi.fn();
    const commit = vi.fn();
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit,
      createObjectId: () => childId,
      fetch: fetchMock
    });

    queue.enqueueArtworkRaster(ARTWORK_ADDRESS, openverseAsset());
    await expect(queue.flush()).rejects.toThrow(/already exists/i);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(canvas.artworkAdds).toEqual([]);
    expect(canvas.artworkRemoved).toEqual([]);
    expect(canvas.removed).toEqual([]);
    expect(commit).not.toHaveBeenCalled();
  });

  it.each(artworkReconciliationCases)(
    "requires %s when reconciling targeted catalogue artwork",
    async (_label, mutate) => {
      const childId = "reconciliation-child";
      const canvas = new PlacementCanvas([productObject(), productObject("product-2")]);
      canvas.serializeTransform = (state) => { mutate(state, childId); };
      const document = placementDocument(canvas.objects);
      const commit = vi.fn();
      const queue = new CataloguePlacementQueue({
        getDocument: () => document,
        getCanvas: async () => canvas,
        commit,
        createObjectId: () => childId
      });

      queue.enqueueArtworkRaster(ARTWORK_ADDRESS, asset("core"));
      await expect(queue.flush()).rejects.toThrow(
        "Placed catalogue artwork raster did not reconcile with the canvas"
      );

      expect(commit).not.toHaveBeenCalled();
      expect(canvas.artworkRemoved).toEqual([{
        address: ARTWORK_ADDRESS,
        childId
      }]);
      expect(canvas.removed).toEqual([]);
      expect(canvas.objects).toHaveLength(2);
      expect(findSemanticObject(canvas.objects, ARTWORK_ADDRESS.productId)).toBeDefined();
      expect(findSemanticObject(canvas.objects, "product-1-sibling-artwork")).toBeDefined();
      expect(findSemanticObject(canvas.objects, childId)).toBeUndefined();
    }
  );

  it("rolls back only the attempted child when targeted document commit fails", async () => {
    const childId = "targeted-commit-child";
    const canvas = new PlacementCanvas([productObject(), productObject("product-2")]);
    const baseline = canvas.serialize();
    const document = placementDocument(canvas.objects);
    const commitFailure = new Error("Synthetic targeted commit failure");
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: () => { throw commitFailure; },
      createObjectId: () => childId
    });

    queue.enqueueArtworkRaster(ARTWORK_ADDRESS, asset("core"));
    await expect(queue.flush()).rejects.toBe(commitFailure);

    expect(canvas.artworkRemoved).toEqual([{
      address: ARTWORK_ADDRESS,
      childId
    }]);
    expect(canvas.removed).toEqual([]);
    expect(canvas.serialize()).toEqual(baseline);
    expect(document.assetReferences).toEqual([]);
  });

  it("preserves the original live failure when child and URL cleanup both throw", async () => {
    const childId = "targeted-cleanup-child";
    const canvas = new PlacementCanvas([productObject()]);
    canvas.removeArtworkFailure = new Error("Synthetic child cleanup failure");
    const document = placementDocument(canvas.objects);
    const commitFailure = new Error("Synthetic targeted live commit failure");
    const objectUrl = `blob:${window.location.origin}/${childId}`;
    const revokeObjectURL = vi.fn(() => {
      throw new Error("Synthetic URL cleanup failure");
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: () => { throw commitFailure; },
      createObjectId: () => childId,
      fetch: vi.fn().mockResolvedValue(new Response(Uint8Array.from([1, 2, 3]), {
        headers: { "content-type": "image/webp", "content-length": "3" }
      })),
      createObjectURL: () => objectUrl,
      revokeObjectURL
    });

    queue.enqueueArtworkRaster(ARTWORK_ADDRESS, openverseAsset());
    await expect(queue.flush()).rejects.toBe(commitFailure);

    expect(canvas.artworkRemoved).toEqual([{
      address: ARTWORK_ADDRESS,
      childId
    }]);
    expect(canvas.removed).toEqual([]);
    expect(findSemanticObject(canvas.objects, ARTWORK_ADDRESS.productId)).toBeDefined();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(objectUrl);
  });

  it("serialises raster and product-shell placements through one shared tail", async () => {
    const canvas = new PlacementCanvas();
    let document: CampaignDocumentV1 = createBlankCampaignDocument({
      documentId: "mixed-placement-document",
      sessionId: "mixed-placement-session",
      mode: "offline"
    });
    const ids = ["catalog-object", "shell-object"];
    const fetchMock = vi.fn(async () => new Response(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>',
      { status: 200, headers: { "content-type": "image/svg+xml" } }
    ));
    const shell: ProductShellRecord = {
      id: "drinks-classic-can",
      title: "Classic Soft Drink Can",
      family: "drinks-snacks",
      template: "can",
      authoringUrl: `${window.location.origin}/catalog/generated/product-shells-v1/shells/drinks-classic-can/authoring.svg`,
      previewUrl: `${window.location.origin}/catalog/generated/product-shells-v1/shells/drinks-classic-can/preview.svg`,
      regions: ["body", "accent"],
      printAreas: [{ id: "front", x: 0.2, y: 0.2, width: 0.6, height: 0.6, safeInset: 0.03 }],
      partSlots: [],
      classroomReviewed: true,
      brandFree: true
    };
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next) => { document = next; },
      createObjectId: () => ids.shift() ?? "extra-object",
      fetch: fetchMock
    });

    queue.enqueue(asset("core"));
    queue.enqueueProductShell(shell, "product-shells-v1");
    await queue.flush();

    expect(canvas.objects).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectId: "catalog-object", elementKind: "image" }),
      expect.objectContaining({ objectId: "shell-object", elementKind: "product-shell", shellId: shell.id })
    ]));
    expect(document.assetReferences).toEqual([
      expect.objectContaining({ kind: "catalog", objectId: "catalog-object", assetId: "core" }),
      {
        kind: "product-shell",
        objectId: "shell-object",
        shellId: shell.id,
        packId: "product-shells-v1",
        version: 1
      }
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fetches, places and records one resolved product look on the shared tail", async () => {
    const packRoot = join("catalog", "generated", "product-builder-pilot-v1");
    const catalogue = parseProductBuilderCatalogue(
      JSON.parse(readFileSync(join(packRoot, "catalogue.json"), "utf8")),
      `${window.location.origin}/catalog/generated/product-builder-pilot-v1/catalogue.json`
    );
    if (!catalogue) throw new Error("Reviewed product builder fixture did not parse");
    const variant = createVirtualProductVariantResolver(catalogue).resolveVariant({
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-spout",
      paletteId: "cobalt-citrus",
      materialId: "fabric"
    });
    if (!variant) throw new Error("Expected product look fixture");
    const quote = quotePilotProductVariant(variant);
    if (!quote) throw new Error("Expected priced product look fixture");
    const canvas = new PlacementCanvas();
    const blank = createBlankCampaignDocument({
      documentId: "product-look-document",
      sessionId: "product-look-session",
      mode: "offline"
    });
    let document: CampaignDocumentV1 = parseCampaignDocument({
      ...blank,
      product: {
        ...blank.product,
        build: {
          schema: "product-build@1",
          primaryObjectId: "old-product",
          packId: "old-pack",
          pricingVersion: 1,
          blueprintId: "old-shell",
          selections: [{ groupId: "shape", choiceIds: ["old-shell"] }],
          costLines: [{
            groupId: "shape",
            groupLabel: "Shape",
            kind: "base",
            choiceId: "old-shell",
            label: "Old shell",
            costCents: 1_000
          }],
          unitCostCents: 1_000
        }
      },
      brief: {
        ...blank.brief,
        targetAudienceId: "after-school-wanderers",
        contextId: "after-school-wanderers"
      },
      strategy: {
        ...blank.strategy,
        productTraitIds: ["portability"],
        marketedChoiceIds: ["old-shell"],
        marketRoute: {
          audienceBriefId: "after-school-wanderers",
          zoneId: "city",
          mediaIds: ["transit"],
          committed: true
        }
      }
    });
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const pathname = new URL(String(input)).pathname;
      const relative = pathname.split("/product-builder-pilot-v1/")[1];
      if (!relative) return new Response("missing", { status: 404 });
      expect(init).toMatchObject({
        method: "GET",
        credentials: "same-origin",
        redirect: "error"
      });
      return new Response(readFileSync(join(packRoot, relative), "utf8"), {
        status: 200,
        headers: { "content-type": "image/svg+xml" }
      });
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next) => { document = next; },
      createObjectId: () => "product-look-1",
      fetch: fetchMock
    });

    queue.enqueueProductVariant(variant, quote, { id: "front-art", colour: "#F2385A" });
    await queue.flush();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(canvas.objects).toContainEqual(expect.objectContaining({
      objectId: "product-look-1",
      variantId: variant.id,
      bodyId: variant.bodyId,
      partId: variant.partId,
      paletteId: variant.paletteId,
      materialId: variant.materialId
    }));
    expect(document.assetReferences).toEqual([{
      kind: "product-builder-variant",
      version: 1,
      objectId: "product-look-1",
      packId: variant.packId,
      variantId: variant.id,
      bodyId: variant.bodyId,
      partId: variant.partId,
      paletteId: variant.paletteId,
      materialId: variant.materialId,
      artwork: { id: "front-art", colour: "#F2385A" }
    }]);
    expect(document.product.build).toMatchObject({
      schema: "product-build@1",
      primaryObjectId: "product-look-1",
      packId: variant.packId,
      blueprintId: variant.bodyId,
      unitCostCents: quote.unitCostCents
    });
    expect(document.strategy).toMatchObject({
      productTraitIds: [],
      marketedChoiceIds: [],
      marketRoute: null
    });
  });

  it("preserves newer campaign choices made while a product look is loading", async () => {
    const packRoot = join("catalog", "generated", "product-builder-pilot-v1");
    const catalogue = parseProductBuilderCatalogue(
      JSON.parse(readFileSync(join(packRoot, "catalogue.json"), "utf8")),
      `${window.location.origin}/catalog/generated/product-builder-pilot-v1/catalogue.json`
    );
    if (!catalogue) throw new Error("Reviewed product builder fixture did not parse");
    const variant = createVirtualProductVariantResolver(catalogue).resolveVariant({
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-spout",
      paletteId: "cobalt-citrus",
      materialId: "fabric"
    });
    if (!variant) throw new Error("Expected product look fixture");
    const quote = quotePilotProductVariant(variant);
    if (!quote) throw new Error("Expected priced product look fixture");
    const canvas = new PlacementCanvas();
    let document: CampaignDocumentV1 = createBlankCampaignDocument({
      documentId: "product-look-fresh-document",
      sessionId: "product-look-fresh-session",
      mode: "offline"
    });
    const requestsStarted = deferred<void>();
    const releaseResponses = deferred<void>();
    let requestCount = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      requestCount += 1;
      if (requestCount === 2) requestsStarted.resolve(undefined);
      await releaseResponses.promise;
      const relative = new URL(String(input)).pathname
        .split("/product-builder-pilot-v1/")[1];
      if (!relative) return new Response("missing", { status: 404 });
      return new Response(readFileSync(join(packRoot, relative), "utf8"), {
        headers: { "content-type": "image/svg+xml" }
      });
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next) => { document = next; },
      createObjectId: () => "product-look-fresh-object",
      fetch: fetchMock
    });

    queue.enqueueProductVariant(variant, quote);
    const placement = queue.flush();
    await requestsStarted.promise;
    document = parseCampaignDocument({
      ...structuredClone(document),
      product: {
        ...structuredClone(document.product),
        name: "The newer product name",
        priceCents: 12_345
      }
    });
    releaseResponses.resolve(undefined);
    await placement;

    expect(document.product).toMatchObject({
      name: "The newer product name",
      priceCents: 12_345,
      build: expect.objectContaining({
        primaryObjectId: "product-look-fresh-object",
        unitCostCents: quote.unitCostCents
      })
    });
    expect(document.assetReferences).toContainEqual(expect.objectContaining({
      kind: "product-builder-variant",
      objectId: "product-look-fresh-object"
    }));
  });

  it("keeps the committed product reconciled when its placement notification throws", async () => {
    const packRoot = join("catalog", "generated", "product-builder-pilot-v1");
    const catalogue = parseProductBuilderCatalogue(
      JSON.parse(readFileSync(join(packRoot, "catalogue.json"), "utf8")),
      `${window.location.origin}/catalog/generated/product-builder-pilot-v1/catalogue.json`
    );
    if (!catalogue) throw new Error("Reviewed product builder fixture did not parse");
    const variant = createVirtualProductVariantResolver(catalogue).resolveVariant({
      bodyId: "drinkware-classic-can",
      partId: "drinkware-top-spout",
      paletteId: "cobalt-citrus",
      materialId: "fabric"
    });
    if (!variant) throw new Error("Expected product look fixture");
    const quote = quotePilotProductVariant(variant);
    if (!quote) throw new Error("Expected priced product look fixture");
    const canvas = new PlacementCanvas();
    let document: CampaignDocumentV1 = createBlankCampaignDocument({
      documentId: "notification-document",
      sessionId: "notification-session",
      mode: "offline"
    });
    const onError = vi.fn();
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next) => { document = next; },
      createObjectId: () => "notification-object",
      fetch: vi.fn(async (input) => {
        const relative = new URL(String(input)).pathname
          .split("/product-builder-pilot-v1/")[1];
        if (!relative) return new Response("missing", { status: 404 });
        return new Response(readFileSync(join(packRoot, relative), "utf8"), {
          headers: { "content-type": "image/svg+xml" }
        });
      }),
      onProductVariantPlaced: () => { throw new Error("Inspector notification failed"); },
      onError
    });

    queue.enqueueProductVariant(variant, quote);
    await expect(queue.flush()).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({
      message: "Inspector notification failed"
    }));
    expect(canvas.removed).toEqual([]);
    expect(canvas.objects).toContainEqual(expect.objectContaining({
      objectId: "notification-object",
      variantId: variant.id
    }));
    expect(document.fabricState.objects).toContainEqual(expect.objectContaining({
      objectId: "notification-object",
      variantId: variant.id
    }));
    expect(document.assetReferences).toContainEqual(expect.objectContaining({
      kind: "product-builder-variant",
      objectId: "notification-object",
      variantId: variant.id
    }));
  });

  it("does not mutate the canvas when a product look source is not SVG", async () => {
    const packRoot = join("catalog", "generated", "product-builder-pilot-v1");
    const catalogue = parseProductBuilderCatalogue(
      JSON.parse(readFileSync(join(packRoot, "catalogue.json"), "utf8")),
      `${window.location.origin}/catalog/generated/product-builder-pilot-v1/catalogue.json`
    );
    if (!catalogue) throw new Error("Reviewed product builder fixture did not parse");
    const variant = createVirtualProductVariantResolver(catalogue).pageVariants({}, { limit: 1 }).items[0];
    if (!variant) throw new Error("Expected product look fixture");
    const quote = quotePilotProductVariant(variant);
    if (!quote) throw new Error("Expected priced product look fixture");
    const canvas = new PlacementCanvas();
    const document = createBlankCampaignDocument({
      documentId: "bad-look-document",
      sessionId: "bad-look-session",
      mode: "offline"
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: () => { throw new Error("Commit must not run"); },
      createObjectId: () => "bad-look",
      fetch: vi.fn(async () => new Response("not svg", {
        status: 200,
        headers: { "content-type": "text/plain" }
      }))
    });

    queue.enqueueProductVariant(variant, quote);

    await expect(queue.flush()).rejects.toThrow("not SVG");
    expect(canvas.objects).toEqual([]);
    expect(canvas.removed).toEqual([]);
  });

  it("rolls back the Fabric object when document reconciliation fails", async () => {
    const canvas = new PlacementCanvas();
    const document = createBlankCampaignDocument({
      documentId: "rollback-document",
      sessionId: "rollback-session",
      mode: "offline"
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: () => { throw new Error("Synthetic reconciliation failure"); },
      createObjectId: () => "rollback-object"
    });

    queue.enqueue(asset("core"));
    await expect(queue.flush()).rejects.toThrow("Synthetic reconciliation failure");
    expect(canvas.removed).toEqual(["rollback-object"]);
    expect(canvas.objects).toEqual([]);
  });

  it("captures canonical live bytes and commits catalogue plus local-blob references", async () => {
    const canvas = new PlacementCanvas();
    let document: CampaignDocumentV1 = createBlankCampaignDocument({
      documentId: "live-document",
      sessionId: "live-session",
      mode: "offline"
    });
    const deadline = new AbortController().signal;
    const fetched = Uint8Array.from([137, 80, 78, 71, 1, 2, 3]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(fetched, {
      headers: { "content-type": "image/png", "content-length": String(fetched.length) }
    }));
    let attachment: {
      blobKey: string;
      blob: Blob;
      objectUrl: string;
    } | undefined;
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: (next, local) => { document = next; attachment = local; },
      createObjectId: () => "live-object",
      fetch: fetchMock,
      createDeadlineSignal: () => deadline,
      createObjectURL: () => `blob:${window.location.origin}/live-object`,
      revokeObjectURL: vi.fn()
    });

    queue.enqueue(openverseAsset());
    await queue.flush();

    expect(fetchMock).toHaveBeenCalledWith(
      `${window.location.origin}/api/openverse-image/${OPENVERSE_ID}`,
      expect.objectContaining({ method: "GET", signal: deadline })
    );
    expect(canvas.objects[0]?.src).toBe(`blob:${window.location.origin}/live-object`);
    expect(document.assetReferences).toEqual([
      expect.objectContaining({ kind: "catalog", objectId: "live-object", assetId: OPENVERSE_ID }),
      expect.objectContaining({
        kind: "local-blob",
        objectId: "live-object",
        assetId: OPENVERSE_ID,
        blobKey: "catalog-live-object",
        mimeType: "image/png"
      })
    ]);
    expect(attachment).toMatchObject({
      blobKey: "catalog-live-object",
      objectUrl: `blob:${window.location.origin}/live-object`
    });
    await expect(attachment!.blob.arrayBuffer()).resolves.toEqual(fetched.buffer);
  });

  it.each([
    ["unsupported MIME", new Response(Uint8Array.from([1]), {
      headers: { "content-type": "image/gif", "content-length": "1" }
    }), /image type/i],
    ["oversize length", new Response(Uint8Array.from([1]), {
      headers: { "content-type": "image/png", "content-length": String(12 * 1024 * 1024 + 1) }
    }), /too large/i]
  ])("rejects live placement with %s before adding Fabric", async (_label, response, message) => {
    const canvas = new PlacementCanvas();
    const document = createBlankCampaignDocument({
      documentId: "invalid-live-document",
      sessionId: "invalid-live-session",
      mode: "offline"
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: vi.fn(),
      fetch: vi.fn().mockResolvedValue(response),
      createObjectId: () => "invalid-live-object",
      createObjectURL: vi.fn(),
      revokeObjectURL: vi.fn()
    });

    queue.enqueue(openverseAsset());
    await expect(queue.flush()).rejects.toThrow(message);
    expect(canvas.objects).toEqual([]);
  });

  it("removes Fabric and revokes captured live bytes when commit fails", async () => {
    const canvas = new PlacementCanvas();
    const revokeObjectURL = vi.fn();
    const document = createBlankCampaignDocument({
      documentId: "live-rollback-document",
      sessionId: "live-rollback-session",
      mode: "offline"
    });
    const queue = new CataloguePlacementQueue({
      getDocument: () => document,
      getCanvas: async () => canvas,
      commit: () => { throw new Error("Synthetic live commit failure"); },
      fetch: vi.fn().mockResolvedValue(new Response(Uint8Array.from([1, 2]), {
        headers: { "content-type": "image/webp", "content-length": "2" }
      })),
      createObjectId: () => "live-rollback-object",
      createObjectURL: () => `blob:${window.location.origin}/live-rollback-object`,
      revokeObjectURL
    });

    queue.enqueue(openverseAsset());
    await expect(queue.flush()).rejects.toThrow("Synthetic live commit failure");
    expect(canvas.removed).toEqual(["live-rollback-object"]);
    expect(revokeObjectURL).toHaveBeenCalledWith(`blob:${window.location.origin}/live-rollback-object`);
  });
});
