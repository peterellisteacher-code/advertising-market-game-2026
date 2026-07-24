import type {
  ProductBuilderBody,
  ProductBuilderCatalogue,
  ProductBuilderPalette,
  ProductBuilderPart
} from "./product-builder-catalogue";
import type { ProductArtwork } from "./product-svg-composer";
import type {
  ResolvedProductVariant,
  VirtualProductVariantResolver
} from "./virtual-product-variant";

type BuilderStep = "shape" | "part" | "colours" | "finish" | "art";
type ArtworkMode = "blank" | "base";
type DrawFocus =
  | { kind: "step"; step: BuilderStep }
  | { kind: "first-choice" }
  | { kind: "choice"; value: ArtworkMode };

const STEPS: ReadonlyArray<{ id: BuilderStep; label: string }> = [
  { id: "shape", label: "Shape" },
  { id: "part", label: "Swap a part" },
  { id: "colours", label: "Colours" },
  { id: "finish", label: "Finish" },
  { id: "art", label: "Front art" }
];

export type ProductBuilderPlaceHandler = (
  product: ResolvedProductVariant,
  artwork?: ProductArtwork
) => void;

function button(label: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  return element;
}

function image(url: string): HTMLImageElement {
  const element = document.createElement("img");
  element.src = url;
  element.alt = "";
  element.loading = "lazy";
  element.decoding = "async";
  return element;
}

export class ProductBuilderPanel {
  #catalogue: ProductBuilderCatalogue | null = null;
  #resolver: VirtualProductVariantResolver | null = null;
  #active: BuilderStep = "shape";
  #bodyId: string | null = null;
  #partId: string | null = null;
  #paletteId: string | null = null;
  #materialId: string | null = null;
  #artworkMode: ArtworkMode = "blank";
  #frontColour = "#FFFFFF";
  #available = false;

  constructor(
    private readonly host: HTMLElement,
    private readonly onPlace: ProductBuilderPlaceHandler
  ) {}

  render(
    catalogue: ProductBuilderCatalogue,
    resolver: VirtualProductVariantResolver
  ): void {
    this.#catalogue = catalogue;
    this.#resolver = resolver;
    this.#available = true;
    this.#active = "shape";
    this.#bodyId = null;
    this.#partId = null;
    this.#paletteId = null;
    this.#materialId = null;
    this.#artworkMode = "blank";
    this.#frontColour = "#FFFFFF";
    this.#draw();
  }

  unavailable(): void {
    this.#catalogue = null;
    this.#resolver = null;
    this.#available = false;
    this.#draw();
  }

  #draw(focus?: DrawFocus): void {
    const root = document.createElement("div");
    root.className = "product-maker";
    if (this.#partId) root.dataset.selectedPartId = this.#partId;

    const prompt = document.createElement("p");
    prompt.className = "product-maker__pair-prompt";
    prompt.textContent = "Choose parts together. After placing the product, swap which partner controls the tools.";

    const steps = document.createElement("div");
    steps.className = "product-maker__steps";
    steps.setAttribute("aria-label", "Product choices");
    for (const step of STEPS) {
      const control = button(step.label);
      control.dataset.builderStep = step.id;
      control.setAttribute("aria-expanded", String(this.#active === step.id));
      control.disabled = !this.#available || !this.#stepReady(step.id);
      control.addEventListener("click", () => {
        this.#active = step.id;
        this.#draw({ kind: "step", step: step.id });
      });
      steps.append(control);
    }

    const options = document.createElement("div");
    options.className = "product-maker__options";
    if (this.#available && this.#catalogue) this.#drawActiveChoices(options);

    const status = document.createElement("p");
    status.className = "product-maker__status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = this.#available
      ? `${this.#remainingLooks().toLocaleString("en-AU")} looks remaining`
      : "Product maker unavailable";

    const add = button("Drop it on the canvas");
    add.className = "product-maker__add";
    const selected = this.#resolved();
    add.disabled = selected === null;
    add.addEventListener("click", () => {
      const product = this.#resolved();
      if (!product) return;
      const artwork = this.#artworkMode === "base"
        ? { id: "front-art", colour: this.#frontColour }
        : undefined;
      this.onPlace(product, artwork);
      add.textContent = "Drop another copy";
      status.textContent = `${product.bodyTitle} placed · swap who controls the tools`;
    });

    root.append(prompt, steps, options, status, add);
    this.host.replaceChildren(root);
    if (!focus) return;
    const target = focus.kind === "step"
      ? root.querySelector<HTMLButtonElement>(`[data-builder-step="${focus.step}"]`)
      : focus.kind === "choice"
        ? root.querySelector<HTMLInputElement>(
          `.product-maker__options input[value="${focus.value}"]`
        )
        : root.querySelector<HTMLInputElement>(
          ".product-maker__options input:not(:disabled)"
        );
    target?.focus();
  }

  #stepReady(step: BuilderStep): boolean {
    if (step === "shape") return true;
    if (step === "part") return this.#bodyId !== null;
    if (step === "colours") return this.#partId !== null;
    if (step === "finish") return this.#paletteId !== null;
    return this.#materialId !== null;
  }

  #drawActiveChoices(host: HTMLElement): void {
    if (!this.#catalogue) return;
    if (this.#active === "shape") {
      this.#drawRecords(host, "Shape choices", this.#catalogue.bodies, this.#bodyId,
        (body) => image(body.previewUrl), (body) => this.#chooseBody(body));
      return;
    }
    if (this.#active === "part") {
      const body = this.#catalogue.bodies.find(({ id }) => id === this.#bodyId);
      const allowed = new Set(body?.compatiblePartIds ?? []);
      const parts = this.#catalogue.parts.filter(({ id }) => allowed.has(id));
      this.#drawRecords(host, "Part choices", parts, this.#partId,
        (part) => image(part.componentUrl), (part) => this.#choosePart(part));
      return;
    }
    if (this.#active === "colours") {
      this.#drawRecords(host, "Colour choices", this.#catalogue.palettes, this.#paletteId,
        (palette) => this.#paletteSwatches(palette), (palette) => this.#choosePalette(palette));
      return;
    }
    if (this.#active === "finish") {
      this.#drawRecords(host, "Finish choices", this.#catalogue.materials, this.#materialId,
        () => null, (finish) => {
          this.#materialId = finish.id;
          this.#active = "art";
          this.#draw({ kind: "first-choice" });
        });
      return;
    }
    this.#drawArtworkChoices(host);
  }

  #drawRecords<T extends { readonly id: string; readonly title: string }>(
    host: HTMLElement,
    legendText: string,
    records: readonly T[],
    selectedId: string | null,
    visual: (record: T) => HTMLElement | null,
    choose: (record: T) => void
  ): void {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = legendText;
    const grid = document.createElement("div");
    grid.className = "product-maker__choice-grid";
    for (const record of records) {
      const label = document.createElement("label");
      label.className = "product-maker__choice";
      label.dataset.productChoice = record.id;
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `product-${this.#active}`;
      input.value = record.id;
      input.checked = selectedId === record.id;
      input.addEventListener("click", () => choose(record));
      const art = visual(record);
      const title = document.createElement("span");
      title.textContent = record.title;
      label.append(input);
      if (art) label.append(art);
      label.append(title);
      grid.append(label);
    }
    fieldset.append(legend, grid);
    host.append(fieldset);
  }

  #paletteSwatches(palette: ProductBuilderPalette): HTMLElement {
    const swatches = document.createElement("span");
    swatches.className = "product-maker__swatches";
    swatches.setAttribute("aria-hidden", "true");
    for (const colour of Object.values(palette.colours)) {
      const swatch = document.createElement("span");
      swatch.style.backgroundColor = colour;
      swatches.append(swatch);
    }
    return swatches;
  }

  #drawArtworkChoices(host: HTMLElement): void {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "Front art choices";
    const choices = document.createElement("div");
    choices.className = "product-maker__choice-grid";
    for (const [value, labelText] of [
      ["blank", "Keep it blank"],
      ["base", "Colour base"]
    ] as const) {
      const label = document.createElement("label");
      label.className = "product-maker__choice";
      label.dataset.productChoice = value;
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "product-art";
      input.value = value;
      input.checked = this.#artworkMode === value;
      input.addEventListener("click", () => {
        this.#artworkMode = value;
        this.#draw({ kind: "choice", value });
      });
      const title = document.createElement("span");
      title.textContent = labelText;
      label.append(input, title);
      choices.append(label);
    }
    fieldset.append(legend, choices);
    if (this.#artworkMode === "base") {
      const colourLabel = document.createElement("label");
      colourLabel.className = "product-maker__art-colour";
      colourLabel.textContent = "Front art colour";
      const colour = document.createElement("input");
      colour.type = "color";
      colour.value = this.#frontColour;
      colour.addEventListener("input", () => {
        this.#frontColour = colour.value.toUpperCase();
      });
      colourLabel.append(colour);
      fieldset.append(colourLabel);
    }
    host.append(fieldset);
  }

  #chooseBody(body: ProductBuilderBody): void {
    this.#bodyId = body.id;
    this.#partId = null;
    this.#paletteId = null;
    this.#materialId = null;
    this.#artworkMode = "blank";
    this.#active = "part";
    this.#draw({ kind: "first-choice" });
  }

  #choosePart(part: ProductBuilderPart): void {
    this.#partId = part.id;
    this.#paletteId = null;
    this.#materialId = null;
    this.#artworkMode = "blank";
    this.#active = "colours";
    this.#draw({ kind: "first-choice" });
  }

  #choosePalette(palette: ProductBuilderPalette): void {
    this.#paletteId = palette.id;
    this.#materialId = null;
    this.#artworkMode = "blank";
    this.#frontColour = palette.colours.label;
    this.#active = "finish";
    this.#draw({ kind: "first-choice" });
  }

  #filters(): Record<string, string> {
    return {
      ...(this.#bodyId ? { bodyId: this.#bodyId } : {}),
      ...(this.#partId ? { partId: this.#partId } : {}),
      ...(this.#paletteId ? { paletteId: this.#paletteId } : {}),
      ...(this.#materialId ? { materialId: this.#materialId } : {})
    };
  }

  #remainingLooks(): number {
    return this.#resolver?.countVariants(this.#filters()) ?? 0;
  }

  #resolved(): ResolvedProductVariant | null {
    if (!this.#resolver || !this.#bodyId || !this.#partId ||
      !this.#paletteId || !this.#materialId) return null;
    return this.#resolver.resolveVariant({
      bodyId: this.#bodyId,
      partId: this.#partId,
      paletteId: this.#paletteId,
      materialId: this.#materialId
    });
  }
}
