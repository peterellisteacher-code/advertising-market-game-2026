import type { CatalogAssetV1 } from "./catalogue-types";
import { computeVirtualColumns, computeVirtualWindow } from "./virtual-grid";

const PLACEHOLDER_THUMBNAIL = "/catalog/system/missing-thumbnail.svg";
const ROW_HEIGHT = 190;
const MIN_TILE_WIDTH = 132;
const OPENVERSE_IMAGE_PATH = /^\/api\/openverse-image\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const isExactOpenverseProxy = (url: URL): boolean => {
  if (!OPENVERSE_IMAGE_PATH.test(url.pathname) || url.hash) return false;
  const keys = [...url.searchParams.keys()];
  if (keys.length === 0) return true;
  const variants = url.searchParams.getAll("variant");
  return keys.length === 1 && keys[0] === "variant" && variants.length === 1 &&
    (variants[0] === "thumbnail" || variants[0] === "full");
};

export function validatedAssetUrl(value: string): string {
  try {
    const url = new URL(value, window.location.origin);
    const allowed = url.origin === window.location.origin &&
      (url.pathname.startsWith("/catalog/") || isExactOpenverseProxy(url));
    return allowed ? url.href : PLACEHOLDER_THUMBNAIL;
  } catch {
    return PLACEHOLDER_THUMBNAIL;
  }
}

export class CataloguePanel {
  #records: CatalogAssetV1[] = [];
  #scrollTop = 0;
  #viewportHeight = 900;
  #columns = 6;
  #resizeObserver?: ResizeObserver;

  readonly #handleScroll = (): void => {
    this.#scrollTop = this.host.scrollTop;
    this.#paint();
  };

  constructor(
    private readonly host: HTMLElement,
    private readonly onPick: (asset: CatalogAssetV1) => void
  ) {
    this.host.addEventListener("scroll", this.#handleScroll, { passive: true });

    if (typeof ResizeObserver !== "undefined") {
      this.#resizeObserver = new ResizeObserver(([entry]) => {
        if (!entry) return;
        this.#columns = Math.max(1, Math.floor(entry.contentRect.width / MIN_TILE_WIDTH));
        this.#viewportHeight = Math.max(0, entry.contentRect.height || this.host.clientHeight);
        this.#paint();
      });
      this.#resizeObserver.observe(this.host);
    }
  }

  render(
    records: CatalogAssetV1[],
    scrollTop = 0,
    viewportHeight = 900,
    columns = 6
  ): void {
    this.#records = records;
    this.#scrollTop = Math.max(0, scrollTop);
    this.#viewportHeight = Math.max(0, viewportHeight);
    this.#columns = Math.max(1, Math.floor(columns));
    this.#paint();
  }

  destroy(): void {
    this.host.removeEventListener("scroll", this.#handleScroll);
    this.#resizeObserver?.disconnect();
  }

  #paint(): void {
    const activeElement = document.activeElement;
    const focusedAssetId = activeElement instanceof Element && this.host.contains(activeElement)
      ? activeElement.closest<HTMLButtonElement>("button[data-asset-id]")?.dataset.assetId
      : undefined;
    const columns = computeVirtualColumns({
      columns: this.#columns,
      rowHeight: ROW_HEIGHT,
      viewportHeight: this.#viewportHeight,
      overscanRows: 3
    });
    const view = computeVirtualWindow({
      itemCount: this.#records.length,
      columns,
      rowHeight: ROW_HEIGHT,
      viewportHeight: this.#viewportHeight,
      scrollTop: this.#scrollTop,
      overscanRows: 3
    });
    const spacer = document.createElement("div");
    spacer.style.height = `${view.totalHeight}px`;
    spacer.style.position = "relative";
    const mount = document.createElement("div");
    mount.style.position = "absolute";
    mount.style.top = `${view.top}px`;
    mount.style.display = "grid";
    mount.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
    mount.setAttribute("role", "list");
    spacer.append(mount);
    this.host.replaceChildren(spacer);

    this.#records.slice(view.start, view.end).forEach((asset, offset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.assetId = asset.id;
      const item = document.createElement("div");
      item.setAttribute("role", "listitem");
      item.setAttribute("aria-posinset", String(view.start + offset + 1));
      item.setAttribute("aria-setsize", String(this.#records.length));

      const image = document.createElement("img");
      image.setAttribute("loading", "lazy");
      image.alt = "";
      image.src = validatedAssetUrl(asset.files.thumbnail);

      const title = document.createElement("span");
      title.dataset.catalogueTitle = "";
      title.textContent = asset.title;
      button.append(image, title);
      if (asset.kind === "photo") {
        const attribution = document.createElement("span");
        attribution.dataset.catalogueAttribution = "";
        attribution.textContent = `${asset.attribution.creator} · ${asset.attribution.license}`;
        button.append(attribution);
      }
      const action = document.createElement("span");
      action.dataset.catalogueAction = "";
      if (asset.delivery === "offline" && asset.recolourZones.includes("body")) {
        action.dataset.colourable = "";
        action.textContent = "Add with chosen colour";
      } else {
        action.textContent = "Add to ad";
      }
      button.append(action);
      button.addEventListener("click", () => this.onPick(asset));
      item.append(button);
      mount.append(item);
    });

    if (focusedAssetId) {
      const replacement = [...this.host.querySelectorAll<HTMLButtonElement>("button[data-asset-id]")]
        .find((button) => button.dataset.assetId === focusedAssetId);
      replacement?.focus({ preventScroll: true });
    }
  }
}
