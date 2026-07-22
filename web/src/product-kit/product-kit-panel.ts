import type { CampaignDocumentV1, ProductBuildSnapshotV1 } from "../domain/campaign-document";
import {
  createProductBuildSnapshot,
  type ProductBuildSnapshot
} from "../product-builder/product-economics";
import type {
  ProductKitLayerEntry,
  ProductKitLayerPlan,
  ProductKitRenderLayer
} from "./layer-plan";
import {
  isParsedProductKitCatalogue,
  type ProductKitComponent,
  type ProductKitKit,
  type ProductKitMountFrame
} from "./product-kit-catalogue";
import type { LoadedProductKitBundle } from "./product-kit-loader";
import {
  parseProductKitCompositionReference
} from "./product-kit-document";
import { quoteProductKitComposition } from "./product-kit-economics";
import type { ProductKitPrice } from "./product-kit-pricing";
import {
  productKitRasterMatrix,
  type ProductKitRasterMatrix
} from "./product-kit-raster-matrix";
import type {
  ProductKitCompositionPlacementRequest,
  ProductKitCompositionRequest
} from "./product-kit-runtime";

const LOGICAL_WIDTH = 400;
const LOGICAL_HEIGHT = 500;
const PREVIEW_ASPECT_RATIO = LOGICAL_WIDTH / LOGICAL_HEIGHT;
const PREVIEW_PADDING_RATIO = 0.08;
const MIN_PREVIEW_PADDING = 12;

type PreviewRasterEntry = Exclude<ProductKitLayerEntry, { readonly kind: "artwork-slot" }>;

interface PreviewRasterLayer {
  readonly layer: ProductKitRenderLayer;
  readonly entry: PreviewRasterEntry;
  readonly source: string;
  readonly matrix: ProductKitRasterMatrix;
}

interface PreviewCrop {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function previewLayerBounds(
  entry: PreviewRasterEntry,
  matrix: ProductKitRasterMatrix
): { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number } {
  const width = entry.raster.frame.trimWidth;
  const height = entry.raster.frame.trimHeight;
  const [a, b, c, d, e, f] = matrix;
  const centreX = LOGICAL_WIDTH / 2 + e;
  const centreY = LOGICAL_HEIGHT / 2 + f;
  const corners = [-1, 1].flatMap((xSign) => [-1, 1].map((ySign) => {
    const x = xSign * width / 2;
    const y = ySign * height / 2;
    return {
      x: centreX + a * x + c * y,
      y: centreY + b * x + d * y
    };
  }));
  const xs = corners.map(({ x }) => x);
  const ys = corners.map(({ y }) => y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys)
  };
}

function previewCrop(layers: readonly PreviewRasterLayer[]): PreviewCrop {
  const bounds = layers.map(({ entry, matrix }) => previewLayerBounds(entry, matrix));
  const left = Math.min(...bounds.map((value) => value.left));
  const top = Math.min(...bounds.map((value) => value.top));
  const right = Math.max(...bounds.map((value) => value.right));
  const bottom = Math.max(...bounds.map((value) => value.bottom));
  const contentWidth = right - left;
  const contentHeight = bottom - top;
  let width = contentWidth + 2 * Math.max(
    MIN_PREVIEW_PADDING,
    contentWidth * PREVIEW_PADDING_RATIO
  );
  let height = contentHeight + 2 * Math.max(
    MIN_PREVIEW_PADDING,
    contentHeight * PREVIEW_PADDING_RATIO
  );
  if (width / height > PREVIEW_ASPECT_RATIO) height = width / PREVIEW_ASPECT_RATIO;
  else width = height * PREVIEW_ASPECT_RATIO;
  return {
    left: (left + right - width) / 2,
    top: (top + bottom - height) / 2,
    width,
    height
  };
}

function percentage(value: number): string {
  return `${Math.round(value * 1_000_000) / 1_000_000}%`;
}

interface CertifiedChoice {
  readonly item: ProductKitComponent;
  readonly price: ProductKitPrice;
}

interface CertifiedFrame {
  readonly frame: ProductKitMountFrame;
  readonly choices: readonly CertifiedChoice[];
}

interface CertifiedKit {
  readonly item: ProductKitKit;
  readonly price: ProductKitPrice;
  readonly frames: readonly CertifiedFrame[];
}

function sameBuild(
  left: ProductBuildSnapshotV1,
  right: ProductBuildSnapshot
): boolean {
  return left.schema === right.schema &&
    left.primaryObjectId === right.primaryObjectId &&
    left.packId === right.packId &&
    left.pricingVersion === right.pricingVersion &&
    left.blueprintId === right.blueprintId &&
    left.unitCostCents === right.unitCostCents &&
    left.selections.length === right.selections.length &&
    left.selections.every((selection, index) => {
      const expected = right.selections[index];
      return expected !== undefined && selection.groupId === expected.groupId &&
        selection.choiceIds.length === expected.choiceIds.length &&
        selection.choiceIds.every((choiceId, choiceIndex) =>
          choiceId === expected.choiceIds[choiceIndex]
        );
    }) &&
    left.costLines.length === right.costLines.length &&
    left.costLines.every((line, index) => {
      const expected = right.costLines[index];
      return expected !== undefined && line.groupId === expected.groupId &&
        line.groupLabel === expected.groupLabel && line.kind === expected.kind &&
        line.choiceId === expected.choiceId && line.label === expected.label &&
        line.costCents === expected.costCents;
    });
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function canonicalPng(
  bundle: LoadedProductKitBundle,
  assetId: string,
  masterSha256: string
): string | null {
  const source = bundle.rasterSources.get(assetId);
  if (!source || source.assetId !== assetId || source.masterSha256 !== masterSha256 ||
    /[%\\\u0000-\u0020\u007f]/.test(source.masterUrl)) return null;
  try {
    const url = new URL(source.masterUrl, window.location.href);
    const expected =
      `/catalog/generated/${bundle.catalogue.catalogPackId}/assets/${assetId}/master.png`;
    if ((url.protocol !== "http:" && url.protocol !== "https:") ||
      url.origin !== window.location.origin || url.username || url.password ||
      url.search || url.hash || url.pathname !== expected ||
      source.masterUrl !== expected) return null;
    return url.href;
  } catch {
    return null;
  }
}

function placementId(frame: ProductKitMountFrame): string | null {
  const match = frame.slotId.match(/-([a-z0-9]+)-slot$/);
  return match?.[1] ? `placement-${match[1]}` : null;
}

function certifiedKits(bundle: LoadedProductKitBundle): readonly CertifiedKit[] {
  if (!isParsedProductKitCatalogue(bundle.catalogue) ||
    bundle.catalogue.packId !== bundle.pricing.packId ||
    typeof bundle.runtime.resolvePair !== "function" ||
    typeof bundle.runtime.planComposition !== "function") return [];
  const result: CertifiedKit[] = [];
  for (const kit of bundle.catalogue.kits) {
    if (kit.mode !== "socket" && kit.mode !== "grip") continue;
    const basePrice = bundle.pricing.byPriceAssetId.get(kit.priceAssetId);
    if (!basePrice || basePrice.kind !== "base" ||
      canonicalPng(bundle, kit.base.assetId, kit.base.masterSha256) === null) continue;
    const frames: CertifiedFrame[] = [];
    let valid = true;
    for (const frame of kit.mountFrames) {
      if (frame.mountType !== kit.mode || placementId(frame) === null) {
        valid = false;
        break;
      }
      const choices: CertifiedChoice[] = [];
      for (const item of bundle.catalogue.components) {
        if (item.slotId !== frame.slotId || item.componentFrame.mountType !== frame.mountType ||
          !bundle.runtime.resolvePair({
            kind: frame.mountType,
            kitId: kit.id,
            mountFrameId: frame.id,
            componentId: item.id
          })) continue;
        const price = bundle.pricing.byPriceAssetId.get(item.priceAssetId);
        if (!price || price.kind !== "part" || item.fragments.some(({ raster }) =>
          canonicalPng(bundle, raster.assetId, raster.masterSha256) === null
        )) continue;
        choices.push({ item, price });
      }
      if (choices.length === 0) {
        valid = false;
        break;
      }
      frames.push({ frame, choices });
    }
    if (valid && frames.length > 0) result.push({ item: kit, price: basePrice, frames });
  }
  return result;
}

export class ProductKitPanel {
  #bundle: LoadedProductKitBundle | null = null;
  #selectedKitId: string | null = null;
  #placedRequestKey: string | null = null;
  readonly #selectedByFrame = new Map<string, string>();

  constructor(
    private readonly host: HTMLElement,
    private readonly onPlace: (request: ProductKitCompositionRequest) => void
  ) {}

  render(bundle: LoadedProductKitBundle): void {
    const focusKey = this.#focusKey();
    try {
      const kits = certifiedKits(bundle);
      if (kits.length === 0) {
        this.unavailable();
        return;
      }
      this.#bundle = bundle;
      if (!kits.some(({ item }) => item.id === this.#selectedKitId)) {
        this.#selectedKitId = kits[0]!.item.id;
        this.#selectedByFrame.clear();
        this.#placedRequestKey = null;
      }
      const selected = kits.find(({ item }) => item.id === this.#selectedKitId)!;
      for (const [frameId, componentId] of this.#selectedByFrame) {
        const frame = selected.frames.find(({ frame }) => frame.id === frameId);
        if (!frame?.choices.some(({ item }) => item.id === componentId)) {
          this.#selectedByFrame.delete(frameId);
        }
      }
      this.#draw(kits, selected, focusKey);
    } catch {
      this.unavailable();
    }
  }

  /** Restores an exact, currently certified Product Kit composition into this panel. */
  hydrate(document: CampaignDocumentV1): boolean {
    this.#placedRequestKey = null;
    try {
      const bundle = this.#bundle;
      const build = document.product.build;
      if (!bundle || !build) return false;
      const matches = document.assetReferences.filter((reference) =>
        reference.kind === "product-kit-composition" &&
        reference.objectId === build.primaryObjectId
      );
      if (matches.length !== 1) return false;
      const reference = parseProductKitCompositionReference(
        matches[0],
        bundle
      );
      if (!reference || reference.objectId !== build.primaryObjectId) return false;
      const plan = bundle.runtime.planComposition(reference.request);
      const quote = plan ? quoteProductKitComposition(plan, bundle.pricing) : null;
      if (!quote || !sameBuild(build, createProductBuildSnapshot(quote, reference.objectId))) {
        return false;
      }
      const kits = certifiedKits(bundle);
      const selected = kits.find(({ item }) => item.id === reference.request.kitId);
      if (!selected || reference.request.placements.length !== selected.frames.length) return false;

      const selectedByFrame = new Map<string, string>();
      for (const placement of reference.request.placements) {
        if (placement.kind === "grid") return false;
        const frame = selected.frames.find(({ frame: candidate }) =>
          candidate.id === placement.mountFrameId &&
          candidate.mountType === placement.kind &&
          placementId(candidate) === placement.placementId
        );
        if (!frame || selectedByFrame.has(frame.frame.id) || !frame.choices.some(({ item }) =>
          item.id === placement.componentId
        )) return false;
        selectedByFrame.set(frame.frame.id, placement.componentId);
      }
      if (selectedByFrame.size !== selected.frames.length) return false;

      this.#selectedKitId = selected.item.id;
      this.#selectedByFrame.clear();
      for (const [frameId, componentId] of selectedByFrame) {
        this.#selectedByFrame.set(frameId, componentId);
      }
      this.#placedRequestKey = JSON.stringify(reference.request);
      this.render(bundle);
      return true;
    } catch {
      return false;
    }
  }

  unavailable(): void {
    this.#bundle = null;
    this.#selectedKitId = null;
    this.#placedRequestKey = null;
    this.#selectedByFrame.clear();
    const panel = node("div", "product-kit product-kit--unavailable");
    const status = node("p", "product-kit__status", "Product maker unavailable");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const action = node("button", "product-kit__primary", "Place product on ad");
    action.type = "button";
    action.disabled = true;
    action.dataset.focusKey = "place";
    panel.append(status, action);
    this.host.replaceChildren(panel);
  }

  #draw(
    kits: readonly CertifiedKit[],
    selected: CertifiedKit,
    focusKey: string | null
  ): void {
    const bundle = this.#bundle;
    if (!bundle) {
      this.unavailable();
      return;
    }
    const previewRequest = this.#request(selected, false);
    const previewPlan = previewRequest
      ? bundle.runtime.planComposition(previewRequest)
      : null;
    const preview = previewPlan ? this.#preview(bundle, selected, previewPlan) : null;
    if (!preview) {
      this.unavailable();
      return;
    }

    const panel = node("div", "product-kit");
    const layout = node("div", "product-kit__layout");
    const controls = node("div", "product-kit__controls");
    const baseGroup = node("fieldset", "product-kit__group");
    baseGroup.append(node("legend", undefined, "Start with"));
    for (const kit of kits) {
      const choice = node("label", "product-kit__choice");
      const input = node("input");
      input.type = "radio";
      input.name = "product-kit-base";
      input.value = kit.item.id;
      input.checked = kit.item.id === selected.item.id;
      input.dataset.focusKey = `base:${kit.item.id}`;
      const copy = node("span", "product-kit__choice-copy");
      copy.append(
        node("strong", undefined, kit.item.title),
        node("small", undefined, `Start: ${money(kit.price.costCents)}`)
      );
      choice.append(input, copy);
      input.addEventListener("change", () => {
        if (!input.checked) return;
        this.#selectedKitId = kit.item.id;
        this.#selectedByFrame.clear();
        this.#placedRequestKey = null;
        this.render(bundle);
      });
      baseGroup.append(choice);
    }
    controls.append(baseGroup);

    for (const certifiedFrame of selected.frames) {
      const group = node("fieldset", "product-kit__group");
      const groupName = certifiedFrame.choices[0]!.price.groupLabel;
      group.append(node("legend", undefined, `Choose a ${groupName.toLowerCase()}`));
      for (const certifiedChoice of certifiedFrame.choices) {
        const choice = node("label", "product-kit__choice");
        const input = node("input");
        input.type = "radio";
        input.name = `product-kit-${certifiedFrame.frame.id}`;
        input.value = certifiedChoice.item.id;
        input.checked = this.#selectedByFrame.get(certifiedFrame.frame.id) ===
          certifiedChoice.item.id;
        input.dataset.focusKey =
          `choice:${certifiedFrame.frame.id}:${certifiedChoice.item.id}`;
        const copy = node("span", "product-kit__choice-copy");
        copy.append(
          node("strong", undefined, certifiedChoice.item.title),
          node("small", undefined, `Add: ${money(certifiedChoice.price.costCents)}`)
        );
        choice.append(input, copy);
        input.addEventListener("change", () => {
          if (!input.checked) return;
          this.#selectedByFrame.set(certifiedFrame.frame.id, certifiedChoice.item.id);
          this.#placedRequestKey = null;
          this.render(bundle);
        });
        group.append(choice);
      }
      controls.append(group);
    }

    const totalCents = selected.price.costCents + selected.frames.reduce((total, frame) => {
      const selectedId = this.#selectedByFrame.get(frame.frame.id);
      return total + (frame.choices.find(({ item }) => item.id === selectedId)
        ?.price.costCents ?? 0);
    }, 0);
    const baseCost = node(
      "p",
      "product-kit__base-cost",
      `Base: ${selected.item.title} · ${money(selected.price.costCents)}`
    );
    const total = node(
      "p",
      "product-kit__total",
      `Total: ${money(totalCents)}`
    );
    const completeRequest = this.#request(selected, true);
    const alreadyPlaced = completeRequest !== null &&
      JSON.stringify(completeRequest) === this.#placedRequestKey;
    const missingGroup = selected.frames.find(({ frame }) =>
      !this.#selectedByFrame.has(frame.id)
    )?.choices[0]?.price.groupLabel.toLowerCase();
    const status = node(
      "p",
      "product-kit__status",
      alreadyPlaced
        ? "On your ad. Change a choice to replace it."
        : completeRequest
          ? "Ready to place on your ad"
          : `Choose a ${missingGroup ?? "part"} to finish your product`
    );
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const action = node(
      "button",
      "product-kit__primary",
      alreadyPlaced ? "Place another product on ad" : "Place product on ad"
    );
    action.type = "button";
    action.disabled = completeRequest === null;
    action.dataset.focusKey = "place";
    action.addEventListener("click", () => {
      const request = this.#request(selected, true);
      if (!request || !bundle.runtime.planComposition(request)) return;
      this.onPlace(request);
    });
    const summary = node("div", "product-kit__summary");
    summary.append(baseCost, total, status, action);
    controls.prepend(summary);
    layout.append(preview, controls);
    panel.append(layout);
    this.host.replaceChildren(panel);
    this.#restoreFocus(focusKey);
  }

  #request(selected: CertifiedKit, complete: boolean): ProductKitCompositionRequest | null {
    const placements: ProductKitCompositionPlacementRequest[] = [];
    for (const frame of selected.frames) {
      const selectedId = this.#selectedByFrame.get(frame.frame.id);
      if (!selectedId) {
        if (complete) return null;
        continue;
      }
      const choice = frame.choices.find(({ item }) => item.id === selectedId);
      const id = placementId(frame.frame);
      if (!choice || !id || frame.frame.mountType === "grid") return null;
      placements.push({
        kind: frame.frame.mountType,
        placementId: id,
        mountFrameId: frame.frame.id,
        componentId: choice.item.id
      });
    }
    if (new Set(placements.map(({ placementId: id }) => id)).size !== placements.length) {
      return null;
    }
    return { kitId: selected.item.id, placements };
  }

  #preview(
    bundle: LoadedProductKitBundle,
    selected: CertifiedKit,
    plan: ProductKitLayerPlan
  ): HTMLElement | null {
    const selectedNames = selected.frames.flatMap((frame) => {
      const id = this.#selectedByFrame.get(frame.frame.id);
      const choice = frame.choices.find(({ item }) => item.id === id);
      return choice ? [choice.item.title] : [];
    });
    const accessibleName = selectedNames.length > 0
      ? `${selected.item.title} with ${selectedNames.join(" and ")}`
      : selected.item.title;
    const figure = node("figure", "product-kit__preview-frame");
    figure.setAttribute("role", "img");
    figure.setAttribute("aria-label", accessibleName);
    const canvas = node("div", "product-kit__preview-canvas");
    canvas.setAttribute("aria-hidden", "true");
    const renderLayers: PreviewRasterLayer[] = [];
    for (const bucket of plan.layers) {
      for (const entry of bucket.entries) {
        if (entry.kind === "artwork-slot") {
          // Keep the choice preview clean; the editable artwork socket appears
          // after the product is placed on the ad.
          continue;
        }
        const source = canonicalPng(
          bundle,
          entry.raster.assetId,
          entry.raster.masterSha256
        );
        const matrix = productKitRasterMatrix(selected.item.base.frame, entry);
        if (!source || !matrix) return null;
        renderLayers.push({ layer: bucket.layer, entry, source, matrix });
      }
    }
    if (renderLayers.length === 0) return null;
    const crop = previewCrop(renderLayers);
    for (const { layer, entry, source, matrix } of renderLayers) {
      const width = entry.raster.frame.trimWidth;
      const height = entry.raster.frame.trimHeight;
      const [a, b, c, d, e, f] = matrix;
      const image = node("img");
      image.alt = "";
      image.decoding = "async";
      image.draggable = false;
      image.src = source;
      image.dataset.productLayer = layer;
      image.style.left = percentage(
        (LOGICAL_WIDTH / 2 - width / 2 + e - crop.left) / crop.width * 100
      );
      image.style.top = percentage(
        (LOGICAL_HEIGHT / 2 - height / 2 + f - crop.top) / crop.height * 100
      );
      image.style.width = percentage(width / crop.width * 100);
      image.style.height = percentage(height / crop.height * 100);
      image.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, 0, 0)`;
      canvas.append(image);
    }
    figure.append(canvas);
    return figure;
  }

  #focusKey(): string | null {
    const active = document.activeElement;
    return active instanceof HTMLElement && this.host.contains(active)
      ? active.dataset.focusKey ?? null
      : null;
  }

  #restoreFocus(focusKey: string | null): void {
    if (!focusKey) return;
    const match = [...this.host.querySelectorAll<HTMLElement>("[data-focus-key]")]
      .find(({ dataset }) => dataset.focusKey === focusKey);
    match?.focus({ preventScroll: true });
  }
}
