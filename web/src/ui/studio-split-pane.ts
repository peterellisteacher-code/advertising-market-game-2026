export interface StudioSplitPaneStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StudioSplitPaneOptions {
  readonly root: HTMLElement;
  readonly browsePane: HTMLElement;
  readonly designPane: HTMLElement;
  readonly separator: HTMLElement;
  readonly narrowQuery?: MediaQueryList;
  readonly initialPercent?: number;
  readonly minimumPercent?: number;
  readonly maximumPercent?: number;
  readonly storage?: StudioSplitPaneStorage | null;
  readonly storageKey?: string;
}

type NarrowPane = "browse" | "edit";

const DEFAULT_NARROW_QUERY = "(max-width: 900px)";
export const STUDENT_STUDIO_SPLIT_STORAGE_KEY = "admarket:studio-split:student:v1";
export const TEACHER_PLAYTEST_STUDIO_SPLIT_STORAGE_KEY =
  "admarket:studio-split:teacher-playtest:v1";

function finitePercent(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function browseFraction(percent: number): string {
  const ratio = percent / (100 - percent);
  return `${Number(ratio.toFixed(6))}fr`;
}

export class StudioSplitPane {
  readonly #root: HTMLElement;
  readonly #browsePane: HTMLElement;
  readonly #designPane: HTMLElement;
  readonly #separator: HTMLElement;
  readonly #narrowQuery: MediaQueryList | null;
  readonly #tabs: HTMLElement | null;
  readonly #browseTab: HTMLButtonElement | null;
  readonly #editTab: HTMLButtonElement | null;
  readonly #minimumPercent: number;
  readonly #maximumPercent: number;
  readonly #defaultPercent: number;
  readonly #storage: StudioSplitPaneStorage | null;
  readonly #storageKey: string | null;
  #percent: number;
  #narrowPane: NarrowPane = "browse";
  #activePointerId: number | null = null;
  #destroyed = false;

  constructor(options: StudioSplitPaneOptions) {
    this.#root = options.root;
    this.#browsePane = options.browsePane;
    this.#designPane = options.designPane;
    this.#separator = options.separator;
    this.#minimumPercent = finitePercent(options.minimumPercent, 25);
    this.#maximumPercent = finitePercent(options.maximumPercent, 75);
    if (
      this.#minimumPercent < 0 ||
      this.#maximumPercent > 100 ||
      this.#minimumPercent >= this.#maximumPercent
    ) {
      throw new Error("Studio split-pane percentage limits are invalid.");
    }
    this.#defaultPercent = this.#clamp(finitePercent(options.initialPercent, 40));
    this.#storage = options.storage ?? null;
    this.#storageKey = typeof options.storageKey === "string" && options.storageKey.length > 0
      ? options.storageKey
      : null;
    this.#percent = this.#readStoredPercent() ?? this.#defaultPercent;
    this.#narrowQuery = options.narrowQuery ??
      (typeof globalThis.matchMedia === "function"
        ? globalThis.matchMedia(DEFAULT_NARROW_QUERY)
        : null);
    this.#tabs = this.#root.querySelector<HTMLElement>("[data-studio-pane-tabs]");
    this.#browseTab = this.#root.querySelector<HTMLButtonElement>(
      '[data-studio-pane-tab="browse"]'
    );
    this.#editTab = this.#root.querySelector<HTMLButtonElement>(
      '[data-studio-pane-tab="edit"]'
    );

    this.#separator.setAttribute("role", "separator");
    this.#separator.setAttribute(
      "aria-label",
      "Resize the library and design areas"
    );
    this.#separator.setAttribute("aria-orientation", "vertical");
    this.#separator.setAttribute("aria-valuemin", String(this.#minimumPercent));
    this.#separator.setAttribute("aria-valuemax", String(this.#maximumPercent));
    const hint = this.#root.querySelector<HTMLElement>("[data-studio-split-hint]");
    if (hint?.id) this.#separator.setAttribute("aria-describedby", hint.id);
    this.#separator.addEventListener("pointerdown", this.#onPointerDown);
    this.#separator.addEventListener("keydown", this.#onKeyDown);
    this.#separator.addEventListener("dblclick", this.#onDoubleClick);
    this.#browseTab?.addEventListener("click", this.#onBrowseClick);
    this.#editTab?.addEventListener("click", this.#onEditClick);
    this.#narrowQuery?.addEventListener("change", this.#onNarrowChange);
    this.#renderPercent();
    this.#renderMode();
  }

  setPercent(percent: number): void {
    if (this.#destroyed || !Number.isFinite(percent)) return;
    this.#percent = this.#clamp(percent);
    this.#renderPercent();
    this.#persistPercent();
  }

  getPercent(): number {
    return this.#percent;
  }

  reset(): void {
    if (this.#destroyed) return;
    this.#percent = this.#defaultPercent;
    this.#renderPercent();
    if (this.#storage === null || this.#storageKey === null) return;
    try {
      this.#storage.removeItem(this.#storageKey);
    } catch {
      // The layout remains usable when browser preference storage is unavailable.
    }
  }

  selectNarrowPane(pane: NarrowPane): void {
    if (this.#destroyed || (pane !== "browse" && pane !== "edit")) return;
    this.#narrowPane = pane;
    if (this.#narrowQuery?.matches) this.#renderNarrowPane();
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#finishPointer();
    this.#separator.removeEventListener("pointerdown", this.#onPointerDown);
    this.#separator.removeEventListener("keydown", this.#onKeyDown);
    this.#separator.removeEventListener("dblclick", this.#onDoubleClick);
    this.#browseTab?.removeEventListener("click", this.#onBrowseClick);
    this.#editTab?.removeEventListener("click", this.#onEditClick);
    this.#narrowQuery?.removeEventListener("change", this.#onNarrowChange);
    delete this.#root.dataset.studioNarrow;
    this.#browsePane.hidden = false;
    this.#designPane.hidden = false;
    if (this.#tabs) this.#tabs.hidden = true;
    this.#separator.tabIndex = 0;
  }

  #clamp(percent: number): number {
    return Math.min(this.#maximumPercent, Math.max(this.#minimumPercent, percent));
  }

  #readStoredPercent(): number | null {
    if (this.#storage === null || this.#storageKey === null) return null;
    try {
      const stored = this.#storage.getItem(this.#storageKey);
      if (stored === null || !/^\d+(?:\.\d+)?$/.test(stored)) return null;
      const percent = Number(stored);
      return Number.isFinite(percent) ? this.#clamp(percent) : null;
    } catch {
      return null;
    }
  }

  #persistPercent(): void {
    if (this.#storage === null || this.#storageKey === null) return;
    try {
      this.#storage.setItem(
        this.#storageKey,
        String(Number(this.#percent.toFixed(4)))
      );
    } catch {
      // The resize succeeds even when browser preference storage is unavailable.
    }
  }

  #renderPercent(): void {
    this.#root.style.setProperty("--studio-browse-percent", `${this.#percent}%`);
    this.#root.style.setProperty("--studio-browse-width", browseFraction(this.#percent));
    this.#separator.setAttribute("aria-valuenow", String(this.#percent));
    this.#separator.setAttribute(
      "aria-valuetext",
      `${Number(this.#percent.toFixed(2))} percent library, ` +
      `${Number((100 - this.#percent).toFixed(2))} percent design`
    );
  }

  #renderMode(): void {
    if (this.#narrowQuery?.matches) {
      this.#root.dataset.studioNarrow = "true";
      this.#separator.tabIndex = -1;
      if (this.#tabs) this.#tabs.hidden = false;
      this.#renderNarrowPane();
      return;
    }
    delete this.#root.dataset.studioNarrow;
    this.#separator.tabIndex = 0;
    if (this.#tabs) this.#tabs.hidden = true;
    this.#browsePane.hidden = false;
    this.#designPane.hidden = false;
  }

  #renderNarrowPane(): void {
    const browseSelected = this.#narrowPane === "browse";
    this.#browsePane.hidden = !browseSelected;
    this.#designPane.hidden = browseSelected;
    if (this.#browseTab) {
      this.#browseTab.setAttribute("aria-selected", String(browseSelected));
      this.#browseTab.tabIndex = browseSelected ? 0 : -1;
    }
    if (this.#editTab) {
      this.#editTab.setAttribute("aria-selected", String(!browseSelected));
      this.#editTab.tabIndex = browseSelected ? -1 : 0;
    }
  }

  #finishPointer(): void {
    const pointerId = this.#activePointerId;
    if (pointerId === null) return;
    this.#activePointerId = null;
    window.removeEventListener("pointermove", this.#onPointerMove);
    window.removeEventListener("pointerup", this.#onPointerEnd);
    window.removeEventListener("pointercancel", this.#onPointerEnd);
    try {
      this.#separator.releasePointerCapture(pointerId);
    } catch {
      // The browser may already have released capture after cancellation.
    }
  }

  readonly #onPointerDown = (event: PointerEvent): void => {
    if (this.#destroyed || event.button !== 0 || this.#narrowQuery?.matches) return;
    event.preventDefault();
    this.#finishPointer();
    this.#activePointerId = event.pointerId;
    try {
      this.#separator.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; window listeners retain the drag.
    }
    window.addEventListener("pointermove", this.#onPointerMove);
    window.addEventListener("pointerup", this.#onPointerEnd);
    window.addEventListener("pointercancel", this.#onPointerEnd);
  };

  readonly #onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.#activePointerId) return;
    const bounds = this.#root.getBoundingClientRect();
    if (!Number.isFinite(bounds.width) || bounds.width <= 0) return;
    const browseBounds = this.#browsePane.getBoundingClientRect();
    const separatorBounds = this.#separator.getBoundingClientRect();
    const browseLeft = Number.isFinite(browseBounds.left) &&
      browseBounds.left >= bounds.left &&
      browseBounds.left <= bounds.right
      ? browseBounds.left
      : bounds.left;
    const separatorWidth = Number.isFinite(separatorBounds.width)
      ? Math.max(0, separatorBounds.width)
      : 0;
    const availableWidth = bounds.right - browseLeft - separatorWidth;
    if (availableWidth <= 0) return;
    const browseWidth = event.clientX - browseLeft - separatorWidth / 2;
    this.setPercent((browseWidth / availableWidth) * 100);
  };

  readonly #onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId !== this.#activePointerId) return;
    this.#finishPointer();
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      this.reset();
      return;
    }
    let percent: number | null = null;
    const step = event.shiftKey ? 10 : 2;
    if (event.key === "ArrowLeft") percent = this.#percent - step;
    if (event.key === "ArrowRight") percent = this.#percent + step;
    if (event.key === "Home") percent = this.#minimumPercent;
    if (event.key === "End") percent = this.#maximumPercent;
    if (percent === null) return;
    event.preventDefault();
    this.setPercent(percent);
  };

  readonly #onDoubleClick = (): void => {
    this.reset();
  };

  readonly #onBrowseClick = (): void => {
    this.selectNarrowPane("browse");
  };

  readonly #onEditClick = (): void => {
    this.selectNarrowPane("edit");
  };

  readonly #onNarrowChange = (): void => {
    if (!this.#destroyed) this.#renderMode();
  };
}
