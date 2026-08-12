import type {
  CanvasObjectSummary,
  CanvasPoint,
  FillableRasterSnapshot,
  RasterSectionFillRecipe
} from "../fabric/canvas-port";

type AnnouncementPriority = "polite" | "assertive";

interface SectionFillPort {
  listObjectSummaries(): readonly CanvasObjectSummary[];
  getFillableRaster(id: string): Promise<FillableRasterSnapshot | null>;
  rasterSourcePoint(id: string, clientPoint: CanvasPoint): CanvasPoint;
  previewRasterSectionFill(id: string, recipe: RasterSectionFillRecipe): Promise<void>;
  cancelRasterSectionFillPreview(id: string): void;
  applyRasterSectionFill(id: string, recipe: RasterSectionFillRecipe): Promise<void>;
}

export interface SectionFillControllerOptions {
  readonly host: HTMLElement;
  readonly canvas: HTMLElement;
  readonly port: SectionFillPort;
  readonly transaction: (operation: () => Promise<void>) => Promise<void>;
  readonly announce: (message: string, priority: AnnouncementPriority) => void;
  readonly mutationControls?: readonly HTMLButtonElement[];
  readonly onPreviewStateChange?: (active: boolean) => void;
  readonly onVisibilityChange?: (visible: boolean) => void;
}

type FillPhase = "idle" | "choose-section" | "preview";

const DEFAULT_FILL_COLOUR = "#e4572e";

function unavailableReason(summary: CanvasObjectSummary): string {
  if (summary.accessibleName.startsWith("Market price ")) {
    return "Price styling uses the Price controls.";
  }
  switch (summary.elementKind) {
    case "text": return "Text uses its own colour controls.";
    case "logo-mark": return "Logo colours are edited in Logo Lab.";
    case "drawing": return "Drawing colour is fixed when the stroke is created.";
    case "product-shell":
    case "product-kit":
      return "Product Kit colours use their named product controls.";
    case "shape": return "Shape colour is fixed when the shape is created.";
    case "masked-component": return "This product component uses its product controls.";
    case "image": return "Section fill is unavailable for this image.";
  }
}

function node<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function recipeFor(
  raster: FillableRasterSnapshot,
  colour: string,
  point: CanvasPoint
): RasterSectionFillRecipe {
  return Object.freeze({
    schema: "raster-section-fill",
    version: 1,
    fillProfile: raster.sectionMode === "connected"
      ? "bounded-linework-v1"
      : "opaque-body-v1",
    sourceAssetId: raster.assetId,
    sourceSha256: raster.sourceSha256,
    seedX: Math.floor(point.x),
    seedY: Math.floor(point.y),
    colour: colour.toUpperCase(),
    colourDistance: raster.sectionMode === "connected" ? 48 : 0
  });
}

export class SectionFillController {
  readonly #host: HTMLElement;
  readonly #canvas: HTMLElement;
  readonly #port: SectionFillPort;
  readonly #transaction: SectionFillControllerOptions["transaction"];
  readonly #announce: SectionFillControllerOptions["announce"];
  readonly #mutationControls: readonly HTMLButtonElement[];
  readonly #onPreviewStateChange: (active: boolean) => void;
  readonly #onVisibilityChange: (visible: boolean) => void;
  readonly #handleCanvasClick = (event: MouseEvent): void => {
    if (this.#phase !== "choose-section" || this.#raster === null) return;
    event.preventDefault();
    event.stopPropagation();
    const point = this.#port.rasterSourcePoint(this.#raster.id, {
      x: event.clientX,
      y: event.clientY
    });
    void this.#preview(recipeFor(this.#raster, this.#colour(), point));
  };
  readonly #handleKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape" || this.#phase === "idle") return;
    event.preventDefault();
    void this.#cancel();
  };
  #selectionId: string | null = null;
  #raster: FillableRasterSnapshot | null = null;
  #phase: FillPhase = "idle";
  #recipe: RasterSectionFillRecipe | null = null;
  #beginButton: HTMLButtonElement | null = null;
  #colourInput: HTMLInputElement | null = null;
  #disabledStates = new Map<HTMLButtonElement, boolean>();
  #generation = 0;

  constructor(options: SectionFillControllerOptions) {
    this.#host = options.host;
    this.#canvas = options.canvas;
    this.#port = options.port;
    this.#transaction = options.transaction;
    this.#announce = options.announce;
    this.#mutationControls = options.mutationControls ?? [];
    this.#onPreviewStateChange = options.onPreviewStateChange ?? (() => undefined);
    this.#onVisibilityChange = options.onVisibilityChange ?? (() => undefined);
    this.#canvas.addEventListener("click", this.#handleCanvasClick, true);
    document.addEventListener("keydown", this.#handleKeydown);
    this.#setVisible(false);
  }

  async setSelection(id: string | null): Promise<void> {
    const generation = ++this.#generation;
    if (this.#phase !== "idle" && this.#selectionId !== null) {
      this.#port.cancelRasterSectionFillPreview(this.#selectionId);
    }
    this.#restoreMutationControls();
    this.#canvas.style.cursor = "";
    this.#phase = "idle";
    this.#onPreviewStateChange(false);
    this.#recipe = null;
    this.#selectionId = id;
    this.#raster = null;
    this.#beginButton = null;
    this.#colourInput = null;
    this.#host.replaceChildren();
    if (id === null) {
      this.#setVisible(false);
      this.#onVisibilityChange(false);
      return;
    }
    const summary = this.#port.listObjectSummaries().find((candidate) => candidate.id === id);
    if (!summary) {
      this.#setVisible(false);
      this.#onVisibilityChange(false);
      return;
    }
    const fillable = await this.#port.getFillableRaster(id);
    if (generation !== this.#generation || this.#selectionId !== id) return;
    this.#setVisible(true);
    this.#onVisibilityChange(true);
    if (fillable === null) {
      this.#renderUnavailable(summary);
      return;
    }
    this.#raster = fillable;
    this.#renderEligible(summary, fillable);
  }

  destroy(): void {
    if (this.#phase !== "idle" && this.#selectionId !== null) {
      this.#port.cancelRasterSectionFillPreview(this.#selectionId);
    }
    this.#restoreMutationControls();
    this.#onPreviewStateChange(false);
    this.#canvas.style.cursor = "";
    this.#canvas.removeEventListener("click", this.#handleCanvasClick, true);
    document.removeEventListener("keydown", this.#handleKeydown);
    this.#host.replaceChildren();
    this.#setVisible(false);
  }

  #setVisible(visible: boolean): void {
    this.#host.hidden = !visible;
    this.#host.toggleAttribute("inert", !visible);
  }

  #renderUnavailable(summary: CanvasObjectSummary): void {
    const heading = node("h3", undefined, "Colour selected item");
    const status = node("p", "creator__section-fill-status", unavailableReason(summary));
    this.#host.replaceChildren(heading, status);
  }

  #renderEligible(
    summary: CanvasObjectSummary,
    raster: FillableRasterSnapshot
  ): void {
    const heading = node("h3", undefined, "Colour selected item");
    const status = node(
      "p",
      "creator__section-fill-status",
      raster.sectionMode === "connected"
        ? "Choose a closed product section, then preview a colour."
        : "Preview one colour across this product object."
    );
    status.dataset.sectionFillStatus = "";
    const label = node("label", "creator__section-fill-colour", "Fill colour");
    const colour = node("input");
    colour.type = "color";
    colour.value = DEFAULT_FILL_COLOUR;
    colour.setAttribute("aria-label", "Fill colour");
    label.append(colour);
    const actions = node("div", "creator__section-fill-actions");
    const begin = node(
      "button",
      undefined,
      raster.sectionMode === "connected" ? "Fill section" : "Fill object"
    );
    begin.type = "button";
    begin.addEventListener("click", () => {
      if (raster.sectionMode === "connected") {
        this.#phase = "choose-section";
        this.#onPreviewStateChange(true);
        this.#canvas.style.cursor = "crosshair";
        this.#setMutationControlsDisabled(true);
        status.textContent = "Choose a closed section on the product.";
        this.#renderChoosingActions();
        this.#announce(
          `Choose one bounded section of ${summary.accessibleName}.`,
          "polite"
        );
      } else {
        void this.#preview(recipeFor(raster, this.#colour(), {
          x: raster.width / 2,
          y: raster.height / 2
        }));
      }
    });
    this.#beginButton = begin;
    this.#colourInput = colour;
    actions.append(begin);
    this.#host.replaceChildren(heading, status, label, actions);
  }

  async #preview(recipe: RasterSectionFillRecipe): Promise<void> {
    const raster = this.#raster;
    if (raster === null || raster.id !== this.#selectionId) return;
    this.#setMutationControlsDisabled(true);
    this.#onPreviewStateChange(true);
    try {
      await this.#port.previewRasterSectionFill(raster.id, recipe);
      if (raster.id !== this.#selectionId) return;
      this.#recipe = recipe;
      this.#phase = "preview";
      this.#canvas.style.cursor = "";
      this.#renderPreviewActions();
      this.#announce("Fill preview ready. Apply it or cancel.", "polite");
    } catch (error) {
      this.#phase = raster.sectionMode === "connected" ? "choose-section" : "idle";
      this.#recipe = null;
      this.#canvas.style.cursor = this.#phase === "choose-section" ? "crosshair" : "";
      if (this.#phase === "idle") this.#restoreMutationControls();
      if (this.#phase === "idle") this.#onPreviewStateChange(false);
      const message = error instanceof Error ? error.message : "The fill preview could not be created.";
      const status = this.#host.querySelector<HTMLElement>("[data-section-fill-status]");
      if (status) status.textContent = `${message} Choose another section.`;
      this.#announce(message, "assertive");
    }
  }

  #renderPreviewActions(): void {
    const actions = this.#host.querySelector<HTMLElement>(".creator__section-fill-actions");
    if (!actions) return;
    const apply = node("button", undefined, "Apply fill");
    apply.type = "button";
    apply.addEventListener("click", () => { void this.#apply(); });
    const cancel = node("button", undefined, "Cancel fill");
    cancel.type = "button";
    cancel.addEventListener("click", () => { void this.#cancel(); });
    actions.replaceChildren(apply, cancel);
    const status = this.#host.querySelector<HTMLElement>("[data-section-fill-status]");
    if (status) status.textContent = "Preview shown. Apply the fill or cancel it.";
  }

  #renderChoosingActions(): void {
    const actions = this.#host.querySelector<HTMLElement>(".creator__section-fill-actions");
    if (!actions) return;
    const cancel = node("button", undefined, "Cancel fill");
    cancel.type = "button";
    cancel.addEventListener("click", () => { void this.#cancel(); });
    actions.replaceChildren(cancel);
  }

  async #apply(): Promise<void> {
    const raster = this.#raster;
    const recipe = this.#recipe;
    if (raster === null || recipe === null || raster.id !== this.#selectionId) return;
    try {
      this.#port.cancelRasterSectionFillPreview(raster.id);
      await this.#transaction(async () => {
        await this.#port.applyRasterSectionFill(raster.id, recipe);
      });
      this.#phase = "idle";
      this.#onPreviewStateChange(false);
      this.#recipe = null;
      this.#restoreMutationControls();
      this.#canvas.style.cursor = "";
      this.#announce("Fill applied.", "polite");
      await this.setSelection(raster.id);
    } catch (error) {
      this.#phase = "idle";
      this.#onPreviewStateChange(false);
      this.#recipe = null;
      this.#restoreMutationControls();
      this.#canvas.style.cursor = "";
      const message = error instanceof Error ? error.message : "The fill could not be applied.";
      this.#announce(message, "assertive");
      await this.setSelection(raster.id);
    }
  }

  async #cancel(): Promise<void> {
    const id = this.#selectionId;
    if (id !== null) this.#port.cancelRasterSectionFillPreview(id);
    this.#phase = "idle";
    this.#onPreviewStateChange(false);
    this.#recipe = null;
    this.#restoreMutationControls();
    this.#canvas.style.cursor = "";
    if (this.#raster !== null && id !== null) await this.setSelection(id);
    this.#beginButton?.focus();
    this.#announce("Fill cancelled. The image is unchanged.", "polite");
  }

  #colour(): string {
    return this.#colourInput?.value || DEFAULT_FILL_COLOUR;
  }

  #setMutationControlsDisabled(disabled: boolean): void {
    if (!disabled) {
      this.#restoreMutationControls();
      return;
    }
    for (const control of this.#mutationControls) {
      if (!this.#disabledStates.has(control)) this.#disabledStates.set(control, control.disabled);
      control.disabled = true;
    }
  }

  #restoreMutationControls(): void {
    for (const [control, disabled] of this.#disabledStates) control.disabled = disabled;
    this.#disabledStates.clear();
  }
}
