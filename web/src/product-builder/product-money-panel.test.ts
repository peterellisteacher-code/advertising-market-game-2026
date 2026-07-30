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
  pricePlacement: { status: "pending" },
  audienceNeed: "A reusable drink container for the trip home.",
  audienceValues: ["practicality", "accessibility"],
  ...overrides
});

describe("ProductMoneyPanel", () => {
  it("starts with one product-confirmation action and no invented component prices", () => {
    const host = document.createElement("div");
    const panel = new ProductMoneyPanel(host, vi.fn(), vi.fn(), vi.fn(), vi.fn());

    panel.setState(state());

    expect(getByRole(host, "button", { name: "Confirm the product and check similar prices" }))
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

    fireEvent.click(getByRole(host, "button", { name: "Confirm the product and check similar prices" }));
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
    expect(getByRole(host, "radio", {
      name: "Budget Near the lower end when affordability matters most."
    })).toBeTruthy();
    expect(getByRole(host, "radio", {
      name: "Everyday Near the typical price for a broad audience."
    })).toBeTruthy();
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
    panel.setState(state({
      pricePosition: "budget",
      priceCents: 2_500,
      pricePlacement: { status: "ready", action: "add" }
    }));

    expect(host.textContent).toContain("Compare similar products before finalising it");
    expect(getByRole<HTMLButtonElement>(host, "button", { name: "Add price to design" }).disabled)
      .toBe(false);
  });

  it("shows one stable completed state after the selected price is on the design", () => {
    const host = document.createElement("div");
    const onAdd = vi.fn();
    const panel = new ProductMoneyPanel(host, vi.fn(), vi.fn(), vi.fn(), onAdd);

    panel.setState(state({
      pricePosition: "everyday",
      priceCents: 1_200,
      pricePlacement: { status: "complete", visiblePrice: "$12.00" }
    }));

    const button = getByRole<HTMLButtonElement>(host, "button", {
      name: "Price added to design"
    });
    expect(button.disabled).toBe(true);
    const status = getByRole(host, "status");
    expect(status.textContent).toBe(
      "Price decision complete: $12.00 is the selected everyday price."
    );
    expect(status.dataset.tone).toBe("complete");
    fireEvent.click(button);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("names the single repair action when a later price no longer matches the design", () => {
    const host = document.createElement("div");
    const onAdd = vi.fn();
    const panel = new ProductMoneyPanel(host, vi.fn(), vi.fn(), vi.fn(), onAdd);

    panel.setState(state({
      pricePosition: "premium",
      priceCents: 2_000,
      pricePlacement: { status: "ready", action: "update" }
    }));

    const button = getByRole<HTMLButtonElement>(host, "button", {
      name: "Update price on design"
    });
    expect(button.disabled).toBe(false);
    expect(getByRole(host, "status").textContent)
      .toContain("Update the price on the design to $20.00");
    fireEvent.click(button);
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("reports an invalid persisted price state without presenting completion", () => {
    const host = document.createElement("div");
    const panel = new ProductMoneyPanel(host, vi.fn(), vi.fn(), vi.fn(), vi.fn());

    panel.setState(state({
      pricePosition: "budget",
      priceCents: 0,
      pricePlacement: {
        status: "needs-attention",
        reason: "Enter a selling price above $0.00."
      }
    }));

    expect(getByRole(host, "status").textContent)
      .toBe("Enter a selling price above $0.00.");
    expect(getByRole<HTMLButtonElement>(host, "button", {
      name: "Add price to design"
    }).disabled).toBe(true);
    expect(host.textContent).not.toContain("Price decision complete");
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
    expect(host.textContent).toContain("No product is ready");

    panel.setState(state({ productName: "" }));
    expect(getByRole<HTMLButtonElement>(host, "button", {
      name: "Confirm the product and check similar prices"
    }).disabled).toBe(true);
    expect(host.textContent).toContain("Name the product");
  });
});
