import { fireEvent, getByRole, queryByRole } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import type { ProductBuildSnapshot } from "./product-economics";
import { ProductMoneyPanel } from "./product-money-panel";

const build: ProductBuildSnapshot = {
  schema: "product-build@1",
  primaryObjectId: "product-1",
  packId: "product-builder-pilot-v1",
  pricingVersion: 1,
  blueprintId: "food-packaging-burger-box",
  selections: [{ groupId: "shape", choiceIds: ["burger-box"] }, {
    groupId: "closure",
    choiceIds: ["zip-closure"]
  }],
  costLines: [{
    groupId: "shape",
    groupLabel: "Shape",
    kind: "base",
    choiceId: "burger-box",
    label: "Burger box",
    costCents: 2_600
  }, {
    groupId: "closure",
    groupLabel: "Part",
    kind: "part",
    choiceId: "zip-closure",
    label: "Zip closure",
    costCents: 950
  }],
  unitCostCents: 3_550
};

describe("ProductMoneyPanel", () => {
  it("frames cost as a clue rather than a product restriction", () => {
    const host = document.createElement("div");
    const panel = new ProductMoneyPanel(host, vi.fn(), vi.fn());

    panel.setState({ build: null, priceCents: null });

    expect(host.textContent).toContain("Cost does not restrict which product students may build");
    expect(host.textContent).toContain("No product placed");
    expect(host.textContent).not.toMatch(/\b(?:assignment|unit|task|budget cap)\b/i);
  });

  it("shows every cost line, an uncapped market price and profit or loss", () => {
    const host = document.createElement("div");
    const onPrice = vi.fn();
    const onAddPrice = vi.fn();
    const panel = new ProductMoneyPanel(host, onPrice, onAddPrice);

    panel.setState({ build, priceCents: null });

    expect(host.textContent).toContain("Shape");
    expect(host.textContent).toContain("Burger box");
    expect(host.textContent).toContain("$26.00");
    expect(host.textContent).toContain("Build cost");
    expect(host.textContent).toContain("$35.50");
    expect(host.textContent).toContain("Try $43.00–$64.00");
    const price = getByRole<HTMLInputElement>(host, "spinbutton", { name: "Market price in dollars" });
    expect(price.hasAttribute("max")).toBe(false);

    fireEvent.input(price, { target: { value: "30" } });
    expect(onPrice).toHaveBeenLastCalledWith(3_000);
    expect(host.textContent).toContain("Loss $5.50 per sale");

    fireEvent.input(price, { target: { value: "50" } });
    expect(onPrice).toHaveBeenLastCalledWith(5_000);
    expect(host.textContent).toContain("Profit $14.50 per sale");
    fireEvent.click(getByRole(host, "button", { name: "Add price to design" }));
    expect(onAddPrice).toHaveBeenCalledOnce();

    fireEvent.input(price, { target: { value: "" } });
    expect(onPrice).toHaveBeenLastCalledWith(null);
    expect(host.textContent).toContain("No price set. Set a price to view profit or loss.");
  });

  it("does not repeat a cost-line label when its group and choice use the same words", () => {
    const host = document.createElement("div");
    const panel = new ProductMoneyPanel(host, vi.fn(), vi.fn());
    panel.setState({
      build: {
        ...build,
        costLines: [{
          ...build.costLines[0]!,
          groupLabel: "Product body",
          label: "Product body"
        }]
      },
      priceCents: null
    });

    expect(host.textContent).toContain("Product body");
    expect(host.textContent).not.toContain("Product body · Product body");
  });

  it("accepts high-value products without shrinking them into a retail cap", () => {
    const host = document.createElement("div");
    const onPrice = vi.fn();
    const panel = new ProductMoneyPanel(host, onPrice, vi.fn());
    panel.setState({
      build: { ...build, unitCostCents: 32_500_000, costLines: [{
        ...build.costLines[0]!,
        label: "Courtyard house",
        costCents: 32_500_000
      }] },
      priceCents: 50_000_000
    });

    const price = getByRole<HTMLInputElement>(host, "spinbutton", { name: "Market price in dollars" });
    expect(price.value).toBe("500000");
    expect(host.textContent).toContain("$325,000.00");
    expect(host.textContent).toContain("Profit $175,000.00 per sale");
  });

  it("keeps the build-cost clues visible before Level 3 unlocks market pricing", () => {
    const host = document.createElement("div");
    const panel = new ProductMoneyPanel(host, vi.fn(), vi.fn());

    panel.setPriceUnlocked(false);
    panel.setState({ build, priceCents: null });

    expect(host.textContent).toContain("Build cost");
    expect(host.textContent).toContain("$35.50");
    expect(queryByRole(host, "spinbutton", { name: "Market price in dollars" }))
      .toBeNull();

    panel.setPriceUnlocked(true);
    expect(getByRole(host, "spinbutton", { name: "Market price in dollars" }))
      .toBeTruthy();
  });
});
