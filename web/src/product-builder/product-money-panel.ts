import type {
  ProductPriceGuide,
  ProductPricePosition
} from "../../../shared/product-price-guide-contract";
import {
  formatMarketBucks,
  type PricePlacementState
} from "../game/creator-stage";

export { formatMarketBucks } from "../game/creator-stage";

export interface ProductMoneyState {
  readonly hasProduct: boolean;
  readonly productName: string;
  readonly priceCents: number | null;
  readonly pricePosition: ProductPricePosition | null;
  readonly priceGuide: ProductPriceGuide | null;
  readonly pricePlacement: PricePlacementState;
  readonly audienceNeed: string;
  readonly audienceValues: readonly string[];
}

export type ProductPriceHandler = (priceCents: number | null) => void | Promise<void>;
export type ProductPricePositionHandler = (
  position: ProductPricePosition | null
) => void | Promise<void>;
export type ProductPriceGuideHandler = () => ProductPriceGuide | Promise<ProductPriceGuide>;
export type AddPriceToDesignHandler = () => void | Promise<void>;

function inputValue(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

function parseMarketBucks(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

function element<K extends keyof HTMLElementTagNameMap>(
  name: K,
  className?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(name);
  if (className) node.className = className;
  return node;
}

export class ProductMoneyPanel {
  #state: ProductMoneyState = {
    hasProduct: false,
    productName: "",
    priceCents: null,
    pricePosition: null,
    priceGuide: null,
    pricePlacement: { status: "pending" },
    audienceNeed: "",
    audienceValues: []
  };
  #status: HTMLElement | null = null;
  #addPrice: HTMLButtonElement | null = null;
  #operation = 0;
  #priceUnlocked = true;

  constructor(
    private readonly host: HTMLElement,
    private readonly onPrice: ProductPriceHandler,
    private readonly onPosition: ProductPricePositionHandler,
    private readonly onGuide: ProductPriceGuideHandler,
    private readonly onAddPrice: AddPriceToDesignHandler
  ) {}

  setState(state: ProductMoneyState): void {
    this.#operation += 1;
    this.#state = structuredClone(state);
    this.#draw();
  }

  setPriceUnlocked(unlocked: boolean): void {
    if (this.#priceUnlocked === unlocked) return;
    this.#priceUnlocked = unlocked;
    this.#draw();
  }

  #draw(): void {
    const root = element("div", "money-check");
    const intro = element("p", "money-check__intro");
    intro.textContent = "Compare similar products. Then choose a selling price that fits your audience.";
    root.append(intro);

    if (!this.#state.hasProduct) {
      const empty = element("p", "money-check__empty");
      empty.setAttribute("role", "status");
      empty.textContent = "No product is ready. Build a product or create its image first.";
      root.append(empty);
      this.#status = null;
      this.#addPrice = null;
      this.host.replaceChildren(root);
      return;
    }

    if (!this.#priceUnlocked) {
      const locked = element("p", "money-check__empty");
      locked.textContent = "Selling-price decisions open in Level 3.";
      root.append(locked);
      this.#status = null;
      this.#addPrice = null;
      this.host.replaceChildren(root);
      return;
    }

    const named = this.#state.productName.trim().length > 0;
    const guideButton = element("button", "money-check__guide");
    guideButton.type = "button";
    guideButton.disabled = !named || this.#state.priceGuide !== null;
    guideButton.textContent = this.#state.priceGuide
      ? "Similar prices checked"
      : "Confirm the product and check similar prices";
    guideButton.addEventListener("click", () => void this.#research(guideButton));
    root.append(guideButton);

    if (!named) {
      const nameFirst = element("p", "money-check__empty");
      nameFirst.setAttribute("role", "status");
      nameFirst.textContent = "Name the product before checking similar prices.";
      root.append(nameFirst);
    }

    if (this.#state.priceGuide) root.append(this.#guideEvidence(this.#state.priceGuide));

    const audience = element("section", "money-check__audience");
    const audienceHeading = element("h3");
    audienceHeading.textContent = "Who should be able to buy it?";
    const audienceNeed = element("p");
    audienceNeed.textContent = this.#state.audienceNeed.trim()
      ? this.#state.audienceNeed
      : "Choose the audience need in the game first.";
    const audienceValues = element("p");
    audienceValues.textContent = this.#state.audienceValues.length > 0
      ? `Audience values: ${this.#state.audienceValues.join(", ")}.`
      : "No audience values selected yet.";
    audience.append(audienceHeading, audienceNeed, audienceValues);

    const positions = element("fieldset", "money-check__positions");
    const positionLegend = element("legend");
    positionLegend.textContent = "Choose the price position for this audience";
    positions.append(positionLegend);
    const positionCopy: ReadonlyArray<readonly [ProductPricePosition, string, string]> = [
      ["budget", "Budget", "Near the lower end when affordability matters most."],
      ["everyday", "Everyday", "Near the typical price for a broad audience."],
      ["premium", "Premium", "Near the higher end when the audience values quality, status or rarity."]
    ];
    for (const [value, labelText, clue] of positionCopy) {
      const label = element("label");
      const input = element("input");
      input.type = "radio";
      input.name = "product-price-position";
      input.value = value;
      input.setAttribute("aria-label", `${labelText} ${clue}`);
      input.checked = this.#state.pricePosition === value;
      input.disabled = !named;
      input.addEventListener("change", () => {
        if (!input.checked) return;
        this.#state = { ...this.#state, pricePosition: value };
        this.#commitPosition(value);
        this.#draw();
      });
      const copy = element("span");
      const strong = element("strong");
      strong.textContent = labelText;
      const small = element("small");
      small.textContent = ` ${clue}`;
      copy.append(strong, small);
      label.append(input, copy);
      positions.append(label);
    }

    const priceLabel = element("label", "money-check__price");
    priceLabel.textContent = "Your selling price ($)";
    const price = element("input");
    price.type = "number";
    price.min = "0.01";
    price.step = "0.01";
    price.inputMode = "decimal";
    price.setAttribute("aria-label", "Selling price in dollars");
    price.disabled = this.#state.pricePosition === null || !named;
    if (this.#state.priceCents !== null) price.value = inputValue(this.#state.priceCents);
    price.addEventListener("input", () => {
      const priceCents = parseMarketBucks(price.value);
      if (priceCents === null) {
        this.#state = {
          ...this.#state,
          priceCents: null,
          pricePlacement: { status: "pending" }
        };
        this.#commitPrice(null);
        this.#renderDecision();
        return;
      }
      const action = this.#state.pricePlacement.status === "complete" ||
        (this.#state.pricePlacement.status === "ready" &&
          this.#state.pricePlacement.action === "update")
        ? "update"
        : "add";
      this.#state = {
        ...this.#state,
        priceCents,
        pricePlacement: { status: "ready", action }
      };
      this.#commitPrice(priceCents);
      this.#renderDecision();
    });
    priceLabel.append(price);

    this.#status = element("p", "money-check__decision");
    this.#status.setAttribute("role", "status");
    this.#status.setAttribute("aria-live", "polite");

    this.#addPrice = element("button", "money-check__add-price");
    this.#addPrice.type = "button";
    this.#addPrice.textContent = "Add price to design";
    this.#addPrice.addEventListener("click", () => {
      if (this.#state.priceCents === null ||
        this.#state.pricePlacement.status !== "ready") return;
      void this.onAddPrice();
    });

    root.append(audience, positions, priceLabel, this.#status, this.#addPrice);
    this.host.replaceChildren(root);
    this.#renderDecision();
  }

  #guideEvidence(guide: ProductPriceGuide): HTMLElement {
    const section = element("section", "money-check__evidence");
    const heading = element("h3");
    heading.textContent = "Observed prices";
    const range = element("p", "money-check__range");
    range.textContent = `${formatMarketBucks(guide.lowCents)}–${formatMarketBucks(guide.highCents)} · middle ${formatMarketBucks(guide.typicalCents)}`;
    const list = element("ul");
    for (const comparable of guide.comparables) {
      const item = element("li");
      const link = element("a");
      link.href = comparable.sourceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${comparable.title} — ${comparable.seller}`;
      const price = element("strong");
      price.textContent = formatMarketBucks(comparable.priceCents);
      item.append(link, price);
      list.append(item);
    }
    const caveat = element("p", "money-check__caveat");
    caveat.textContent = guide.confidence === "high"
      ? "Four current sources. Prices can still change."
      : guide.confidence === "medium"
        ? "Three current sources. Treat the range as a guide."
        : "Two current sources. Treat the range as a rough guide.";
    section.append(heading, range, list, caveat);
    return section;
  }

  #renderDecision(): void {
    const priceCents = this.#state.priceCents;
    const position = this.#state.pricePosition;
    const placement = this.#state.pricePlacement;
    if (!this.#status || !this.#addPrice) return;
    this.#addPrice.textContent = "Add price to design";
    this.#addPrice.disabled = placement.status !== "ready" ||
      priceCents === null || priceCents <= 0 || position === null;
    if (position === null) {
      this.#status.textContent = "Choose budget, everyday or premium for this audience.";
      this.#status.dataset.tone = "waiting";
      return;
    }
    if (priceCents === null) {
      this.#status.textContent = "Set the final selling price.";
      this.#status.dataset.tone = "waiting";
      return;
    }
    if (placement.status === "needs-attention") {
      this.#status.textContent = placement.reason;
      this.#status.dataset.tone = "warning";
      return;
    }
    if (placement.status === "complete") {
      this.#addPrice.disabled = true;
      this.#addPrice.textContent = "Price added to design";
      this.#status.textContent =
        `Price decision complete: ${placement.visiblePrice} is the selected ${position} price.`;
      this.#status.dataset.tone = "complete";
      return;
    }
    if (placement.status === "pending") {
      this.#status.textContent = "Saving the price decision…";
      this.#status.dataset.tone = "waiting";
      return;
    }
    if (placement.action === "update") {
      this.#addPrice.textContent = "Update price on design";
      this.#status.textContent =
        `Update the price on the design to ${formatMarketBucks(priceCents)} before publishing.`;
      this.#status.dataset.tone = "check";
      return;
    }
    const guide = this.#state.priceGuide;
    if (!guide) {
      this.#status.textContent = `${formatMarketBucks(priceCents)} is your ${position} price. Compare similar products before finalising it.`;
      this.#status.dataset.tone = "waiting";
      return;
    }
    const relation = priceCents < guide.lowCents
      ? "below"
      : priceCents > guide.highCents ? "above" : "within";
    this.#status.textContent = `${formatMarketBucks(priceCents)} is ${relation} the observed range. Check that this fits your ${position} position and audience.`;
    this.#status.dataset.tone = relation === "within" ? "fit" : "check";
  }

  #commitPrice(priceCents: number | null): void {
    const operation = ++this.#operation;
    const report = (error: unknown): void => {
      if (operation !== this.#operation || this.#status === null) return;
      this.#status.textContent = error instanceof Error
        ? error.message
        : "Price not saved.";
      this.#status.dataset.tone = "warning";
    };
    try {
      void Promise.resolve(this.onPrice(priceCents)).catch(report);
    } catch (error) {
      report(error);
    }
  }

  #commitPosition(position: ProductPricePosition): void {
    const operation = ++this.#operation;
    const report = (error: unknown): void => {
      if (operation !== this.#operation || this.#status === null) return;
      this.#status.textContent = error instanceof Error
        ? error.message
        : "Price position not saved.";
      this.#status.dataset.tone = "warning";
    };
    try {
      void Promise.resolve(this.onPosition(position)).catch(report);
    } catch (error) {
      report(error);
    }
  }

  async #research(button: HTMLButtonElement): Promise<void> {
    if (button.disabled || this.#state.priceGuide) return;
    const operation = ++this.#operation;
    button.disabled = true;
    button.textContent = "Checking current prices…";
    this.host.setAttribute("aria-busy", "true");
    try {
      const guide = await this.onGuide();
      if (operation !== this.#operation) return;
      this.#state = { ...this.#state, priceGuide: structuredClone(guide) };
      this.#draw();
    } catch (error) {
      if (operation !== this.#operation) return;
      button.disabled = false;
      button.textContent = "Try the same price check again";
      const status = element("p", "money-check__decision");
      status.setAttribute("role", "alert");
      status.textContent = error instanceof Error
        ? error.message
        : "The price check is unavailable. Compare similar products yourselves.";
      button.after(status);
    } finally {
      if (operation === this.#operation) this.host.removeAttribute("aria-busy");
    }
  }
}
