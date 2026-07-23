import { fireEvent, getByRole, queryByRole } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import { ProductMoneyPanel, type ProductMoneyState } from "./product-money-panel";

const guide = {
  schema: "product-price-guide@1" as const,
  productFingerprint: "a".repeat(64),
  currency: "AUD" as const,
  checkedAt: "2026-07-23T01:02:03.000Z",
  confidence: "low" as const,
  lowCents: 2_000,
  typicalCents: 3_000,
  highCents: 4_000,
  comparables: [{
    title: "Steel travel cup",
    seller: "Example Shop",
    priceCents: 2_000,
    sourceUrl: "https://example.com/cup"
  }, {
    title: "Insulated tumbler",
    seller: "Sample Store",
    priceCents: 4_000,
    sourceUrl: "https://sample.example/tumbler"
  }]
};

const state = (overrides: Partial<ProductMoneyState> = {}): ProductMoneyState => ({
  hasProduct: true,
  productName: "Orbit Tumbler",
  priceCents: null,
  pricePosition: null,
  priceGuide: null,
  audienceNeed: "A reusable drink container for the trip home.",
  audienceValues: ["practicality", "accessibility"],
  ...overrides
});

describe("ProductMoneyPanel", () => {
  it("starts with one product-confirmation action and no invented component prices", () => {
    const host = document.createElement("div");
    const panel = new ProductMoneyPanel(host, vi.fn(), vi.fn(), vi.fn(), vi.fn());

    panel.setState(state());

    expect(getByRole(host, "button", { name: "Confirm product and check similar prices" }))
      .toBeTruthy();
    expect(host.textContent).toContain("Compare similar products");
    expect(host.textContent).not.toContain("Build cost");
    expect(host.textContent).not.toContain("profit");
    expect(host.textContent).not.toContain("$35.50");
  });

  it("shows factual comparable evidence without choosing the selling price", async () => {
    const host = document.createElement("div");
    const onGuide = vi.fn().mockResolvedValue(guide);
    const panel = new ProductMoneyPanel(host, vi.fn(), vi.fn(), onGuide, vi.fn());
    panel.setState(state());

    fireEvent.click(getByRole(host, "button", { name: "Confirm product and check similar prices" }));
    await vi.waitFor(() => expect(host.textContent).toContain("Observed prices"));
    expect(onGuide).toHaveBeenCalledOnce();
    expect(host.textContent).toContain("$20.00–$40.00 · middle $30.00");
    expect(host.textContent).toContain("Two current sources");
    expect(getByRole<HTMLAnchorElement>(host, "link", {
      name: "Steel travel cup — Example Shop"
    }).href).toBe("https://example.com/cup");
    expect(host.textContent).not.toMatch(/we recommend|you should charge/i);
  });

  it("makes the pair choose audience position before entering an uncapped price", () => {
    const host = document.createElement("div");
    const onPrice = vi.fn();
    const onPosition = vi.fn();
    const onAdd = vi.fn();
    const panel = new ProductMoneyPanel(host, onPrice, onPosition, vi.fn(), onAdd);
    panel.setState(state({ priceGuide: guide }));

    const price = getByRole<HTMLInputElement>(host, "spinbutton", { name: "Selling price in dollars" });
    expect(price.disabled).toBe(true);
    const premium = getByRole<HTMLInputElement>(host, "radio", { name: /Premium/ });
    premium.checked = true;
    fireEvent.change(premium);
    expect(onPosition).toHaveBeenCalledWith("premium");
    expect(getByRole<HTMLInputElement>(host, "spinbutton", { name: "Selling price in dollars" }).disabled)
      .toBe(false);

    const enabledPrice = getByRole<HTMLInputElement>(host, "spinbutton", { name: "Selling price in dollars" });
    expect(enabledPrice.hasAttribute("max")).toBe(false);
    fireEvent.input(enabledPrice, { target: { value: "500000" } });
    expect(onPrice).toHaveBeenCalledWith(50_000_000);
    expect(host.textContent).toContain("above the observed range");
    fireEvent.click(getByRole(host, "button", { name: "Add price to design" }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("still works manually when the online comparison is unavailable", () => {
    const host = document.createElement("div");
    const panel = new ProductMoneyPanel(host, vi.fn(), vi.fn(), vi.fn(), vi.fn());
    panel.setState(state({ pricePosition: "budget", priceCents: 2_500 }));

    expect(host.textContent).toContain("Compare similar products before finalising it");
    expect(getByRole<HTMLButtonElement>(host, "button", { name: "Add price to design" }).disabled)
      .toBe(false);
  });

  it("keeps pricing hidden until Level 3 and explains missing prerequisites", () => {
    const host = document.createElement("div");
    const panel = new ProductMoneyPanel(host, vi.fn(), vi.fn(), vi.fn(), vi.fn());

    panel.setPriceUnlocked(false);
    panel.setState(state());
    expect(host.textContent).toContain("open in Level 3");
    expect(queryByRole(host, "spinbutton", { name: "Selling price in dollars" })).toBeNull();

    panel.setPriceUnlocked(true);
    panel.setState(state({ hasProduct: false }));
    expect(host.textContent).toContain("No product ready");

    panel.setState(state({ productName: "" }));
    expect(getByRole<HTMLButtonElement>(host, "button", {
      name: "Confirm product and check similar prices"
    }).disabled).toBe(true);
    expect(host.textContent).toContain("Name the product");
  });
});
