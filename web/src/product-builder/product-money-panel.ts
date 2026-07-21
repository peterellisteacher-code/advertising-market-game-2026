import {
  marginAtPrice,
  suggestedPriceForCost,
  type ProductBuildSnapshot
} from "./product-economics";

export interface ProductMoneyState {
  readonly build: ProductBuildSnapshot | null;
  readonly priceCents: number | null;
}

export type ProductPriceHandler = (priceCents: number | null) => void | Promise<void>;
export type AddPriceToDesignHandler = () => void | Promise<void>;

const marketBucks = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatMarketBucks(cents: number): string {
  return `$${marketBucks.format(cents / 100)}`;
}

function inputValue(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

function parseMarketBucks(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
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
  #state: ProductMoneyState = { build: null, priceCents: null };
  #margin: HTMLElement | null = null;
  #addPrice: HTMLButtonElement | null = null;
  #priceOperation = 0;
  #priceUnlocked = true;

  constructor(
    private readonly host: HTMLElement,
    private readonly onPrice: ProductPriceHandler,
    private readonly onAddPrice: AddPriceToDesignHandler
  ) {}

  setState(state: ProductMoneyState): void {
    this.#priceOperation += 1;
    this.#state = {
      build: state.build ? structuredClone(state.build) : null,
      priceCents: state.priceCents
    };
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
    intro.textContent = "Cost informs audience and pricing decisions. Cost does not restrict which product students may build.";
    root.append(intro);

    const build = this.#state.build;
    if (!build) {
      const empty = element("p", "money-check__empty");
      empty.setAttribute("role", "status");
      empty.textContent = "No product placed. Place a product to view costs.";
      root.append(empty);
      this.#margin = null;
      this.#addPrice = null;
      this.host.replaceChildren(root);
      return;
    }

    const ledger = element("dl", "money-check__ledger");
    for (const line of build.costLines) {
      const row = element("div");
      const label = element("dt");
      label.textContent = `${line.groupLabel} · ${line.label}`;
      const cost = element("dd");
      cost.textContent = formatMarketBucks(line.costCents);
      row.append(label, cost);
      ledger.append(row);
    }

    const total = element("p", "money-check__total");
    const totalLabel = element("span");
    totalLabel.textContent = "Build cost";
    const totalValue = element("strong");
    totalValue.textContent = formatMarketBucks(build.unitCostCents);
    total.append(totalLabel, totalValue);

    const range = suggestedPriceForCost(build.unitCostCents);
    const suggestion = element("p", "money-check__suggestion");
    suggestion.textContent = range
      ? `Try ${formatMarketBucks(range.minimumCents)}–${formatMarketBucks(range.maximumCents)}`
      : "Set market price.";

    const priceLabel = element("label", "money-check__price");
    priceLabel.textContent = "Market price ($)";
    const price = element("input");
    price.type = "number";
    price.min = "0";
    price.step = "0.01";
    price.inputMode = "decimal";
    price.setAttribute("aria-label", "Market price in dollars");
    if (this.#state.priceCents !== null) price.value = inputValue(this.#state.priceCents);
    price.addEventListener("input", () => {
      const priceCents = parseMarketBucks(price.value);
      if (priceCents === null) {
        this.#state = { ...this.#state, priceCents: null };
        this.#commitPrice(null);
        this.#renderMargin();
        return;
      }
      this.#state = { ...this.#state, priceCents };
      this.#commitPrice(priceCents);
      this.#renderMargin();
    });
    priceLabel.append(price);

    this.#margin = element("p", "money-check__margin");
    this.#margin.setAttribute("role", "status");
    this.#margin.setAttribute("aria-live", "polite");

    this.#addPrice = element("button", "money-check__add-price");
    this.#addPrice.type = "button";
    this.#addPrice.textContent = "Add price to design";
    this.#addPrice.addEventListener("click", () => {
      if (this.#state.priceCents === null) return;
      void this.onAddPrice();
    });

    for (const control of [suggestion, priceLabel, this.#margin, this.#addPrice]) {
      control.hidden = !this.#priceUnlocked;
    }
    price.disabled = !this.#priceUnlocked;

    root.append(ledger, total, suggestion, priceLabel, this.#margin, this.#addPrice);
    this.host.replaceChildren(root);
    this.#renderMargin();
  }

  #renderMargin(): void {
    const build = this.#state.build;
    const priceCents = this.#state.priceCents;
    if (!this.#margin || !this.#addPrice || !build) return;
    this.#addPrice.disabled = priceCents === null;
    if (priceCents === null) {
      this.#margin.textContent = "No price set. Set a price to view profit or loss.";
      this.#margin.dataset.tone = "waiting";
      return;
    }
    const margin = marginAtPrice({ unitCostCents: build.unitCostCents }, priceCents);
    if (!margin) {
      this.#margin.textContent = "Use a price with no more than two decimal places.";
      this.#margin.dataset.tone = "warning";
      return;
    }
    const amount = formatMarketBucks(Math.abs(margin.marginCents));
    if (margin.marginCents > 0) {
      this.#margin.textContent = `Profit ${amount} per sale`;
      this.#margin.dataset.tone = "gain";
    } else if (margin.marginCents < 0) {
      this.#margin.textContent = `Loss ${amount} per sale`;
      this.#margin.dataset.tone = "loss";
    } else {
      this.#margin.textContent = "Break even on each sale";
      this.#margin.dataset.tone = "even";
    }
  }

  #commitPrice(priceCents: number | null): void {
    const operation = ++this.#priceOperation;
    const report = (error: unknown): void => {
      if (operation !== this.#priceOperation || this.#margin === null) return;
      this.#margin.textContent = error instanceof Error
        ? error.message
        : "Price not saved.";
      this.#margin.dataset.tone = "warning";
    };
    try {
      void Promise.resolve(this.onPrice(priceCents)).catch(report);
    } catch (error) {
      report(error);
    }
  }
}
