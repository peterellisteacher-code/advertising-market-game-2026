import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fireEvent,
  getAllByRole,
  getByRole
} from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import OFFLINE_CATALOGUE from "../../../catalog/generated/offline-core-v1/catalog.json";
import PRODUCT_KIT_SIDECAR from "../../../catalog/generated/offline-core-v1/product-kit-v1.json";
import PRODUCT_KIT_PRICING_SIDECAR from "../../../catalog/generated/offline-core-v1/product-kit-pricing-v1.json";
import STUDENT_STARTERS from "../../../catalog/generated/offline-core-v1/student-starters-v1.json";
import type { CatalogAssetV1 } from "../catalogue/catalogue-types";
import {
  parseCatalogAsset,
  type OfflineCatalogueWithHash
} from "../catalogue/catalogue-store";
import {
  createBlankCampaignDocument,
  parseCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import { createProductBuildSnapshot } from "../product-builder/product-economics";
import { loadProductKitBundle, type LoadedProductKitBundle } from "./product-kit-loader";
import { quoteProductKitComposition } from "./product-kit-economics";
import { ProductKitPanel } from "./product-kit-panel";
import type { ProductKitCompositionReference } from "./product-kit-document";

const CATALOG_HASH =
  "6199fd1adae59a2b517b265ca67a325f32faba04d375852821e841b51a354073";
const BASE_ID = "89-beverage-container-bases-r03c05";
const BASE_HASH =
  "d87a3718df6bd9a00e667a8c50729c3c84a3bd33bfe395df86b9992f49eb7abf";
const LID_ID = "90-beverage-container-add-ons-r04c01";
const LID_HASH =
  "6156af7416af78a8bb53a93c540ff2745caa77140f808213227487985e3580a5";
const TV_ID = "95-appliance-bases-r05c02";
const TV_HASH =
  "3ad0846f80e918edcfea13b24deabd8413206d4ada4dc4e63c1751eb2728888f";
const TV_PEDESTAL_ID = "96-appliance-add-ons-r05c01";
const TV_PEDESTAL_HASH =
  "b9c6131f758d1d21a8923a3b9ae7137244d5154d8b15b45b73b64aae0faa0092";
const TV_FEET_ID = "96-appliance-add-ons-r05c02";
const TV_FEET_HASH =
  "00cd19f387de624370a6d014519343a241f00e36ab97a556906b0585cef674cf";
const CASE_ID = "97-bag-carry-product-bases-r01c05";
const CASE_HASH =
  "9f6f833af3a39e36734945ff9505ad6986aa09879bb756248209b74fc4c41dc9";
const CASE_ARCHED_HANDLE_ID = "98-bag-carry-product-add-ons-r01c03";
const CASE_ARCHED_HANDLE_HASH =
  "103a9baf051d3ff8a23f3dd8ff5abbbf80d34c2f57d4bca647b576b4364e1ce9";
const CASE_COMPACT_HANDLE_ID = "98-bag-carry-product-add-ons-r01c05";
const CASE_COMPACT_HANDLE_HASH =
  "10fc7b6c5a7b4a177cd1bb00c3a67b1fb5ee5644c438216085ce86098e109d7e";
const CATALOGUE_URL = "/catalog/generated/offline-core-v1/catalog.json";
const STARTER_RASTER_RECORDS = STUDENT_STARTERS.starters.flatMap((starter) => {
  if (starter.kind !== "raster") return [];
  const parsed = parseCatalogAsset(
    OFFLINE_CATALOGUE.find(({ id }) => id === starter.assetId)
  );
  if (!parsed) throw new Error(`Missing starter fixture ${starter.assetId}`);
  return [parsed];
});

function offlineAsset(
  id: string,
  masterSha256: string,
  kind: "raster-master" | "component",
  width: number,
  height: number
): CatalogAssetV1 {
  const isBase = id === BASE_ID || id === TV_ID || id === CASE_ID;
  const isTelevision = id === TV_ID || id === TV_PEDESTAL_ID || id === TV_FEET_ID;
  const isCarryCase = id === CASE_ID || id === CASE_ARCHED_HANDLE_ID ||
    id === CASE_COMPACT_HANDLE_ID;
  const title = id === BASE_ID
    ? "Straight reusable tumbler"
    : id === LID_ID
      ? "Flat takeaway-cup lid"
      : id === TV_ID
        ? "Wall-ready flat television"
        : id === TV_PEDESTAL_ID
          ? "Television centre pedestal stand"
          : id === TV_FEET_ID
            ? "Pair of angled television feet"
            : id === CASE_ID
              ? "Rectangular crossbody bag body"
              : id === CASE_ARCHED_HANDLE_ID
                ? "Rigid arched handbag handle"
                : "Compact top grab handle";
  return {
    schema: "catalog-asset@1",
    delivery: "offline",
    id,
    version: 1,
    kind,
    title,
    category: isTelevision
      ? "appliances"
      : isCarryCase ? "bags-carry-products" : "beverage-containers",
    tags: isBase ? ["base"] : ["add-on"],
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
    offlineAsset(LID_ID, LID_HASH, "component", 233, 164),
    offlineAsset(TV_ID, TV_HASH, "raster-master", 237, 168),
    offlineAsset(TV_PEDESTAL_ID, TV_PEDESTAL_HASH, "component", 259, 210),
    offlineAsset(TV_FEET_ID, TV_FEET_HASH, "component", 237, 209),
    offlineAsset(CASE_ID, CASE_HASH, "raster-master", 189, 159),
    offlineAsset(
      CASE_ARCHED_HANDLE_ID,
      CASE_ARCHED_HANDLE_HASH,
      "component",
      226,
      211
    ),
    offlineAsset(
      CASE_COMPACT_HANDLE_ID,
      CASE_COMPACT_HANDLE_HASH,
      "component",
      262,
      135
    ),
    ...STARTER_RASTER_RECORDS
  ],
  catalogSha256: CATALOG_HASH
};

async function admittedBundle(): Promise<LoadedProductKitBundle> {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const value = url.endsWith("/product-kit-v1.json")
      ? PRODUCT_KIT_SIDECAR
      : url.endsWith("/product-kit-pricing-v1.json")
        ? PRODUCT_KIT_PRICING_SIDECAR
        : url.endsWith("/student-starters-v1.json")
          ? STUDENT_STARTERS
          : null;
    if (value === null) throw new Error(`Unexpected request: ${url}`);
    return new Response(JSON.stringify(value), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as unknown as typeof fetch;
  const bundle = await loadProductKitBundle(CATALOGUE_URL, OFFLINE, { fetchImpl });
  if (!bundle) throw new Error("Expected the reviewed Product Kit fixture to load");
  return bundle;
}

function expectPreviewFitsFrame(preview: HTMLElement): void {
  const corners = [...preview.querySelectorAll<HTMLImageElement>("img")].flatMap((image) => {
    expect(image.style.left).toMatch(/%$/);
    expect(image.style.top).toMatch(/%$/);
    expect(image.style.width).toMatch(/%$/);
    expect(image.style.height).toMatch(/%$/);
    const matrix = image.style.transform.match(/^matrix\(([^)]+)\)$/)?.[1]
      ?.split(",")
      .map(Number);
    expect(matrix).toHaveLength(6);
    const [a, b, c, d, e, f] = matrix!;
    expect(e).toBeCloseTo(0);
    expect(f).toBeCloseTo(0);
    const left = Number.parseFloat(image.style.left);
    const top = Number.parseFloat(image.style.top);
    const width = Number.parseFloat(image.style.width);
    const height = Number.parseFloat(image.style.height);
    const centreX = left + width / 2;
    const centreY = top + height / 2;
    return [-1, 1].flatMap((xSign) => [-1, 1].map((ySign) => {
      const x = xSign * width / 2;
      const y = ySign * height / 2;
      return {
        x: centreX + a! * x + c! * y,
        y: centreY + b! * x + d! * y
      };
    }));
  });
  expect(corners.length).toBeGreaterThan(0);
  const xs = corners.map(({ x }) => x);
  const ys = corners.map(({ y }) => y);
  expect(Math.min(...xs)).toBeGreaterThanOrEqual(-0.001);
  expect(Math.max(...xs)).toBeLessThanOrEqual(100.001);
  expect(Math.min(...ys)).toBeGreaterThanOrEqual(-0.001);
  expect(Math.max(...ys)).toBeLessThanOrEqual(100.001);
  expect(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)))
    .toBeGreaterThan(60);
}

function expectPreviewVerticalOffset(
  preview: HTMLElement,
  bodyRasterHeight: number,
  expectedOffset: number
): void {
  const layers = [...preview.querySelectorAll<HTMLImageElement>("img")];
  const rear = layers.find((image) => image.dataset.productLayer === "rear");
  const body = layers.find((image) => image.dataset.productLayer === "body");
  expect(rear).toBeTruthy();
  expect(body).toBeTruthy();
  const bodyHeightPercent = Number.parseFloat(body!.style.height);
  const cropHeight = bodyRasterHeight / (bodyHeightPercent / 100);
  const rearCentre = Number.parseFloat(rear!.style.top) +
    Number.parseFloat(rear!.style.height) / 2;
  const bodyCentre = Number.parseFloat(body!.style.top) + bodyHeightPercent / 2;
  const offset = (rearCentre - bodyCentre) * cropHeight / 100;
  expect(offset).toBeCloseTo(expectedOffset, 3);
}

function restoredDocument(bundle: LoadedProductKitBundle): CampaignDocumentV1 {
  const request = {
    kitId: "pk1-tumbler-kit",
    placements: [{
      kind: "socket" as const,
      placementId: "placement-lid",
      mountFrameId: "pk1-tumbler-lid-frame",
      componentId: "pk1-flat-lid"
    }]
  };
  const plan = bundle.runtime.planComposition(request);
  const quote = plan ? quoteProductKitComposition(plan, bundle.pricing) : null;
  if (!plan || !quote) throw new Error("Expected the pilot composition to be quoted");
  const objectId = "restored-product-kit";
  const composition: ProductKitCompositionReference = {
    kind: "product-kit-composition",
    version: 1,
    objectId,
    productKitPackId: bundle.catalogue.packId,
    catalogPackId: bundle.catalogue.catalogPackId,
    catalogSha256: bundle.catalogue.catalogSha256,
    request,
    pricedItems: plan.pricedItems
  };
  const blank = createBlankCampaignDocument({
    documentId: "restored-product-kit-document",
    sessionId: "restored-product-kit-session",
    mode: "offline"
  });
  return parseCampaignDocument({
    ...blank,
    product: {
      ...blank.product,
      build: createProductBuildSnapshot(quote, objectId) as CampaignDocumentV1["product"]["build"]
    },
    assetReferences: [composition]
  });
}

describe("ProductKitPanel", () => {
  it("shows all twelve starters without choosing one for a fresh campaign", async () => {
    const host = document.createElement("div");
    document.body.replaceChildren(host);
    const panel = new ProductKitPanel(host, vi.fn(), vi.fn());

    panel.render(await admittedBundle());

    const starters = getAllByRole<HTMLInputElement>(host, "radio")
      .filter(({ name }) => name === "student-starter");
    expect(starters).toHaveLength(12);
    expect(starters.every(({ checked }) => !checked)).toBe(true);
    expect(host.textContent).toContain("Choose a starter product");
    expect(getByRole<HTMLButtonElement>(host, "button", {
      name: "Place product on ad"
    }).disabled).toBe(true);
  });

  it("shows twelve starters in one list and places a reviewed raster only on activation", async () => {
    const host = document.createElement("div");
    document.body.replaceChildren(host);
    const onPlaceKit = vi.fn();
    const onPlaceRaster = vi.fn();
    const panel = new ProductKitPanel(host, onPlaceKit, onPlaceRaster);

    panel.render(await admittedBundle());

    const starters = getAllByRole<HTMLInputElement>(host, "radio")
      .filter(({ name }) => name === "student-starter");
    expect(starters).toHaveLength(12);
    expect(onPlaceKit).not.toHaveBeenCalled();
    expect(onPlaceRaster).not.toHaveBeenCalled();
    fireEvent.click(getByRole(host, "radio", { name: "Soccer ball" }));
    expect(getByRole(host, "img", { name: "Soccer ball" })).toBeTruthy();
    expect(onPlaceRaster).not.toHaveBeenCalled();

    fireEvent.click(getByRole(host, "button", { name: "Place product on ad" }));

    expect(onPlaceKit).not.toHaveBeenCalled();
    expect(onPlaceRaster).toHaveBeenCalledOnce();
    expect(onPlaceRaster.mock.calls[0]?.[0]).toMatchObject({
      id: "43-sports-fitness-equipment-r01c01",
      title: "Soccer ball",
      delivery: "offline"
    });
  });

  it("hydrates a restored certified build without changing its document", async () => {
    const host = document.createElement("div");
    const bundle = await admittedBundle();
    const restored = restoredDocument(bundle);
    const before = structuredClone(restored);
    const panel = new ProductKitPanel(host, vi.fn());

    panel.render(bundle);

    expect(panel.hydrate(restored)).toBe(true);
    expect(getByRole<HTMLInputElement>(host, "radio", { name: /Reusable tumbler/ }).checked)
      .toBe(true);
    expect(getByRole<HTMLInputElement>(host, "radio", { name: /Flat lid/ }).checked).toBe(true);
    expect(host.textContent).toContain("On your ad. Change a choice to replace it.");
    expect(host.textContent).not.toContain("$");
    expect(restored).toEqual(before);
  });

  it("does not hydrate stale or build-mismatched Product Kit compositions", async () => {
    const host = document.createElement("div");
    const bundle = await admittedBundle();
    const panel = new ProductKitPanel(host, vi.fn());
    const restored = restoredDocument(bundle);
    const stale = parseCampaignDocument({
      ...restored,
      assetReferences: [{
        ...restored.assetReferences[0],
        catalogSha256: "0".repeat(64)
      }]
    });
    const mismatched: CampaignDocumentV1 = {
      ...restored,
      product: {
        ...restored.product,
        build: {
          ...restored.product.build!,
          unitCostCents: 549,
          costLines: restored.product.build!.costLines.map((line, index) =>
            index === 0 ? { ...line, costCents: line.costCents - 1 } : line
          )
        }
      }
    };

    panel.render(bundle);
    await panel.selectStarter(bundle.starterManifest.starters[0]!);

    expect(panel.hydrate(stale)).toBe(false);
    expect(panel.hydrate(mismatched)).toBe(false);
    expect(getByRole<HTMLInputElement>(host, "radio", { name: /Flat lid/ }).checked).toBe(false);
    expect(host.textContent).toContain("Choose a lid to finish your product");
    expect(host.textContent).not.toContain("$");
  });

  it("hydrates the same restored build idempotently", async () => {
    const host = document.createElement("div");
    const bundle = await admittedBundle();
    const panel = new ProductKitPanel(host, vi.fn());
    const restored = restoredDocument(bundle);

    panel.render(bundle);

    expect(panel.hydrate(restored)).toBe(true);
    const first = host.textContent;
    expect(panel.hydrate(restored)).toBe(true);
    expect(host.textContent).toBe(first);
    expect(getByRole<HTMLInputElement>(host, "radio", { name: /Flat lid/ }).checked).toBe(true);
    expect(host.textContent).toContain("On your ad. Change a choice to replace it.");
    expect(getByRole(host, "button", { name: "Place another product on ad" })).toBeTruthy();
  });

  it("keeps the certified tumbler pilot composable and places its exact request", async () => {
    const host = document.createElement("div");
    document.body.replaceChildren(host);
    const onPlace = vi.fn();
    const panel = new ProductKitPanel(host, onPlace);

    panel.render(await admittedBundle());
    fireEvent.click(getByRole(host, "radio", { name: /Reusable tumbler/ }));

    expect(host.textContent).toContain("Reusable tumbler");
    expect(host.textContent).toContain("Flat lid");
    expect(host.textContent).not.toContain("$");
    expect(getAllByRole(host, "button")).toHaveLength(1);
    expect(getByRole<HTMLButtonElement>(host, "button", {
      name: "Place product on ad"
    }).disabled).toBe(true);
    const placementAction = getByRole<HTMLButtonElement>(host, "button", {
      name: "Place product on ad"
    });
    const firstChoiceGroup = getByRole(host, "group", { name: "Start with" });
    expect(placementAction.compareDocumentPosition(firstChoiceGroup) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(getByRole<HTMLInputElement>(host, "radio", {
      name: /Reusable tumbler/
    }).checked).toBe(true);

    const lid = getByRole<HTMLInputElement>(host, "radio", { name: /Flat lid/ });
    expect(lid.tagName).toBe("INPUT");
    expect(lid.type).toBe("radio");
    lid.focus();
    fireEvent.click(lid);

    expect(document.activeElement).toBe(getByRole(host, "radio", { name: /Flat lid/ }));
    expect(host.textContent).toContain("Ready to place on your ad");
    expect(host.textContent).not.toContain("$");
    const preview = getByRole(host, "img", {
      name: "Reusable tumbler with Flat lid"
    });
    expect(preview.textContent).not.toContain("Your design");
    expect(preview.textContent).not.toContain("Artwork space");
    const layers = [...preview.querySelectorAll<HTMLImageElement>("img")];
    expect(layers.map((image) => image.dataset.productLayer)).toEqual(["body", "front"]);
    expect(layers.map((image) => new URL(image.src).pathname)).toEqual([
      `/catalog/generated/offline-core-v1/assets/${BASE_ID}/master.png`,
      `/catalog/generated/offline-core-v1/assets/${LID_ID}/master.png`
    ]);
    expect(layers.every((image) => new URL(image.src).origin === window.location.origin))
      .toBe(true);
    expect(layers.every((image) => image.src.endsWith(".png") && image.alt === ""))
      .toBe(true);
    expect(layers[0]?.style.transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
    expect(layers[1]?.style.transform).toBe("matrix(0.7, 0, 0, 0.7, 0, 0)");
    expect(preview.querySelector('[data-product-layer="artwork"]')).toBeNull();
    expect(host.querySelector("svg")).toBeNull();
    expect(host.textContent).not.toMatch(
      /\b(?:assignment|unit|task|variant|component|material)\b/i
    );

    const action = getByRole<HTMLButtonElement>(host, "button", {
      name: "Place product on ad"
    });
    expect(action.disabled).toBe(false);
    fireEvent.click(action);

    expect(onPlace).toHaveBeenCalledOnce();
    expect(onPlace).toHaveBeenCalledWith({
      kitId: "pk1-tumbler-kit",
      placements: [{
        kind: "socket",
        placementId: "placement-lid",
        mountFrameId: "pk1-tumbler-lid-frame",
        componentId: "pk1-flat-lid"
      }]
    });
  });

  it("switches a certified television between two aligned stand choices", async () => {
    const host = document.createElement("div");
    document.body.replaceChildren(host);
    const onPlace = vi.fn();
    const panel = new ProductKitPanel(host, onPlace);

    panel.render(await admittedBundle());

    const television = getByRole<HTMLInputElement>(host, "radio", {
      name: /Flat-screen television/
    });
    fireEvent.click(television);

    expect(television.checked).toBe(true);
    expect(host.textContent).not.toContain("$");
    expect(host.textContent).toContain("Choose a stand to finish your product");
    expect(host.textContent).not.toMatch(/\bMB\b/);

    const pedestal = getByRole<HTMLInputElement>(host, "radio", {
      name: /Centre pedestal stand/
    });
    fireEvent.click(pedestal);

    expect(host.textContent).toContain("Ready to place on your ad");
    expect(host.textContent).not.toContain("$");
    let preview = getByRole(host, "img", {
      name: "Flat-screen television with Centre pedestal stand"
    });
    let layers = [...preview.querySelectorAll<HTMLImageElement>("img")];
    expectPreviewFitsFrame(preview);
    expect(layers.map((image) => image.dataset.productLayer)).toEqual(["rear", "body"]);
    expect(layers.map((image) => new URL(image.src).pathname)).toEqual([
      `/catalog/generated/offline-core-v1/assets/${TV_PEDESTAL_ID}/master.png`,
      `/catalog/generated/offline-core-v1/assets/${TV_ID}/master.png`
    ]);
    expect(layers[0]?.style.transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
    expect(layers[1]?.style.transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
    expectPreviewVerticalOffset(preview, 168, 111);

    const feet = getByRole<HTMLInputElement>(host, "radio", {
      name: /Angled feet/
    });
    fireEvent.click(feet);

    expect(host.textContent).toContain("Ready to place on your ad");
    expect(host.textContent).not.toContain("$");
    preview = getByRole(host, "img", {
      name: "Flat-screen television with Angled feet"
    });
    layers = [...preview.querySelectorAll<HTMLImageElement>("img")];
    expectPreviewFitsFrame(preview);
    expect(layers.map((image) => image.dataset.productLayer)).toEqual(["rear", "body"]);
    expect(layers[0]?.style.transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
    expect(layers[1]?.style.transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
    expectPreviewVerticalOffset(preview, 168, 110.5);

    const action = getByRole<HTMLButtonElement>(host, "button", {
      name: "Place product on ad"
    });
    expect(action.disabled).toBe(false);
    fireEvent.click(action);

    expect(onPlace).toHaveBeenCalledOnce();
    expect(onPlace).toHaveBeenCalledWith({
      kitId: "pk1-tv-kit",
      placements: [{
        kind: "socket",
        placementId: "placement-stand",
        mountFrameId: "pk1-tv-stand-frame",
        componentId: "pk1-tv-angled-feet"
      }]
    });
  });

  it("switches a certified carry case between two aligned handle choices", async () => {
    const host = document.createElement("div");
    document.body.replaceChildren(host);
    const onPlace = vi.fn();
    const panel = new ProductKitPanel(host, onPlace);

    panel.render(await admittedBundle());

    const carryCase = getByRole<HTMLInputElement>(host, "radio", {
      name: /Compact carry case/
    });
    fireEvent.click(carryCase);

    expect(carryCase.checked).toBe(true);
    expect(host.textContent).not.toContain("$");
    expect(host.textContent).toContain("Choose a handle to finish your product");

    const compact = getByRole<HTMLInputElement>(host, "radio", {
      name: /Compact grab handle/
    });
    fireEvent.click(compact);

    expect(host.textContent).toContain("Ready to place on your ad");
    expect(host.textContent).not.toContain("$");
    let preview = getByRole(host, "img", {
      name: "Compact carry case with Compact grab handle"
    });
    let layers = [...preview.querySelectorAll<HTMLImageElement>("img")];
    expectPreviewFitsFrame(preview);
    expect(layers.map((image) => image.dataset.productLayer)).toEqual(["rear", "body"]);
    expect(layers.map((image) => new URL(image.src).pathname)).toEqual([
      `/catalog/generated/offline-core-v1/assets/${CASE_COMPACT_HANDLE_ID}/master.png`,
      `/catalog/generated/offline-core-v1/assets/${CASE_ID}/master.png`
    ]);
    expect(layers[0]?.style.transform).toBe("matrix(0.55, 0, 0, 0.55, 0, 0)");
    expect(layers[1]?.style.transform).toBe("matrix(1, 0, 0, 1, 0, 0)");

    const arched = getByRole<HTMLInputElement>(host, "radio", {
      name: /Rigid arched handle/
    });
    fireEvent.click(arched);

    expect(host.textContent).toContain("Ready to place on your ad");
    expect(host.textContent).not.toContain("$");
    preview = getByRole(host, "img", {
      name: "Compact carry case with Rigid arched handle"
    });
    layers = [...preview.querySelectorAll<HTMLImageElement>("img")];
    expectPreviewFitsFrame(preview);
    expect(layers[0]?.style.transform).toBe("matrix(0.55, 0, 0, 0.55, 0, 0)");
    expect(layers[1]?.style.transform).toBe("matrix(1, 0, 0, 1, 0, 0)");

    const action = getByRole<HTMLButtonElement>(host, "button", {
      name: "Place product on ad"
    });
    expect(action.disabled).toBe(false);
    fireEvent.click(action);

    expect(onPlace).toHaveBeenCalledOnce();
    expect(onPlace).toHaveBeenCalledWith({
      kitId: "pk1-utility-case-kit",
      placements: [{
        kind: "socket",
        placementId: "placement-handle",
        mountFrameId: "pk1-utility-case-handle-frame",
        componentId: "pk1-utility-case-arched-handle"
      }]
    });
  });

  it("defaults invalid data and explicit failure to one polite disabled surface", async () => {
    const host = document.createElement("div");
    const panel = new ProductKitPanel(host, vi.fn());
    const bundle = await admittedBundle();

    panel.render({
      ...bundle,
      catalogue: structuredClone(bundle.catalogue)
    } as LoadedProductKitBundle);

    expect(getByRole(host, "status").getAttribute("aria-live")).toBe("polite");
    expect(getByRole<HTMLButtonElement>(host, "button", {
      name: "Place product on ad"
    }).disabled).toBe(true);

    panel.unavailable();

    expect(getByRole(host, "status").textContent).toBe("Product maker unavailable");
    expect(getAllByRole(host, "button")).toHaveLength(1);
    expect(getByRole<HTMLButtonElement>(host, "button", {
      name: "Place product on ad"
    }).disabled).toBe(true);
  });

  it("constructs the panel without HTML or SVG injection seams", () => {
    const source = readFileSync(join(
      process.cwd(),
      "web",
      "src",
      "product-kit",
      "product-kit-panel.ts"
    ), "utf8");

    expect(source).not.toMatch(/innerHTML|insertAdjacentHTML|outerHTML/);
    expect(source).not.toMatch(/createElement\(["']svg["']\)|\.svg\b/i);
    expect(source).toMatch(/createElement/);
    expect(source).toMatch(/textContent/);
  });
});
