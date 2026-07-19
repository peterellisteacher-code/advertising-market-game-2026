import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  fireEvent,
  getAllByRole,
  getByRole
} from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import PRODUCT_KIT_SIDECAR from "../../../catalog/generated/offline-core-v1/product-kit-v1.json";
import PRODUCT_KIT_PRICING_SIDECAR from "../../../catalog/generated/offline-core-v1/product-kit-pricing-v1.json";
import type { CatalogAssetV1 } from "../catalogue/catalogue-types";
import type { OfflineCatalogueWithHash } from "../catalogue/catalogue-store";
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
const CATALOGUE_URL = "/catalog/generated/offline-core-v1/catalog.json";

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

async function admittedBundle(): Promise<LoadedProductKitBundle> {
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const value = url.endsWith("/product-kit-v1.json")
      ? PRODUCT_KIT_SIDECAR
      : url.endsWith("/product-kit-pricing-v1.json")
        ? PRODUCT_KIT_PRICING_SIDECAR
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
    expect(host.textContent).toContain("Total: $5.50");
    expect(host.textContent).not.toContain("550 cents");
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

    expect(panel.hydrate(stale)).toBe(false);
    expect(panel.hydrate(mismatched)).toBe(false);
    expect(getByRole<HTMLInputElement>(host, "radio", { name: /Flat lid/ }).checked).toBe(false);
    expect(host.textContent).toContain("Total: $4.80");
    expect(host.textContent).not.toContain("480 cents");
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
    expect(host.textContent).toContain("On your ad — change a choice to make another version");
    expect(getByRole(host, "button", { name: "Place another product on ad" })).toBeTruthy();
  });

  it("shows only the certified pilot choice, composes its PNG preview and places the exact request", async () => {
    const host = document.createElement("div");
    document.body.replaceChildren(host);
    const onPlace = vi.fn();
    const panel = new ProductKitPanel(host, onPlace);

    panel.render(await admittedBundle());

    expect(host.textContent).toContain("Reusable tumbler");
    expect(host.textContent).toContain("Flat lid");
    expect(host.textContent).toContain("$4.80");
    expect(host.textContent).not.toContain("480 cents");
    expect(getAllByRole(host, "button")).toHaveLength(1);
    expect(getByRole<HTMLButtonElement>(host, "button", {
      name: "Place product on ad"
    }).disabled).toBe(true);
    expect(getByRole<HTMLInputElement>(host, "radio", {
      name: /Reusable tumbler/
    }).checked).toBe(true);

    const lid = getByRole<HTMLInputElement>(host, "radio", { name: /Flat lid/ });
    expect(lid.tagName).toBe("INPUT");
    expect(lid.type).toBe("radio");
    lid.focus();
    fireEvent.click(lid);

    expect(document.activeElement).toBe(getByRole(host, "radio", { name: /Flat lid/ }));
    expect(host.textContent).toContain("$5.50");
    expect(host.textContent).not.toContain("550 cents");
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
    expect(layers[0]?.style.transform).toBe("matrix(1, 0, 0, 1, 0, 109)");
    expect(layers[1]?.style.transform).toContain("matrix(");
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
