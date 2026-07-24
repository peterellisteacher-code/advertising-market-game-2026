import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, getAllByRole, getByLabelText, getByRole } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import { parseProductBuilderCatalogue } from "./product-builder-catalogue";
import { ProductBuilderPanel } from "./product-builder-panel";
import { createVirtualProductVariantResolver } from "./virtual-product-variant";

const PACK_ROOT = join("catalog", "generated", "product-builder-pilot-v1");
const CATALOGUE_URL =
  "https://classroom.test/catalog/generated/product-builder-pilot-v1/catalogue.json";

function reviewedCatalogue() {
  const catalogue = parseProductBuilderCatalogue(
    JSON.parse(readFileSync(join(PACK_ROOT, "catalogue.json"), "utf8")),
    CATALOGUE_URL
  );
  if (!catalogue) throw new Error("Reviewed product builder fixture did not parse");
  return catalogue;
}

function choose(host: HTMLElement, name: string): void {
  fireEvent.click(getByRole(host, "radio", { name }));
}

describe("ProductBuilderPanel", () => {
  it("moves focus to the first choice after each automatic step", () => {
    const host = document.createElement("div");
    document.body.replaceChildren(host);
    const catalogue = reviewedCatalogue();
    const panel = new ProductBuilderPanel(host, vi.fn());
    panel.render(catalogue, createVirtualProductVariantResolver(catalogue));

    for (const [current, next] of [
      ["Classic Can", "Flat Top"],
      ["Flat Top", "Alpine Mint"],
      ["Alpine Mint", "Brushed Metal"],
      ["Brushed Metal", "Keep it blank"]
    ] as const) {
      const choice = getByRole<HTMLInputElement>(host, "radio", { name: current });
      choice.focus();
      choice.click();
      expect(document.activeElement).toBe(
        getByRole<HTMLInputElement>(host, "radio", { name: next })
      );
    }
  });

  it("keeps keyboard focus on a manually selected step button", () => {
    const host = document.createElement("div");
    document.body.replaceChildren(host);
    const catalogue = reviewedCatalogue();
    const panel = new ProductBuilderPanel(host, vi.fn());
    panel.render(catalogue, createVirtualProductVariantResolver(catalogue));
    getByRole<HTMLInputElement>(host, "radio", { name: "Classic Can" }).click();

    const shapeStep = getByRole<HTMLButtonElement>(host, "button", { name: "Shape" });
    shapeStep.focus();
    fireEvent.keyDown(shapeStep, { key: "Enter", code: "Enter" });
    fireEvent.keyUp(shapeStep, { key: "Enter", code: "Enter" });
    shapeStep.click();

    const renderedShapeStep = getByRole<HTMLButtonElement>(host, "button", { name: "Shape" });
    expect(document.activeElement).toBe(renderedShapeStep);
    expect(renderedShapeStep.getAttribute("aria-expanded")).toBe("true");
  });

  it("guides a pair through visual choices without materialising every possible look", () => {
    const host = document.createElement("div");
    const onPlace = vi.fn();
    const catalogue = reviewedCatalogue();
    const panel = new ProductBuilderPanel(host, onPlace);

    panel.render(catalogue, createVirtualProductVariantResolver(catalogue));

    expect(getAllByRole(host, "radio")).toHaveLength(12);
    expect(getByRole(host, "status").textContent).toContain("6,144");
    expect(host.querySelectorAll("[data-product-choice]").length).toBeLessThanOrEqual(16);

    choose(host, "Classic Can");
    expect(getAllByRole(host, "radio")).toHaveLength(4);
    expect(getByRole(host, "status").textContent).toContain("512");
    expect(getByRole(host, "radio", { name: "Sport Spout" })).toBeTruthy();

    choose(host, "Sport Spout");
    expect(getAllByRole(host, "radio")).toHaveLength(16);
    expect(getByRole(host, "status").textContent).toContain("128");

    choose(host, "Cobalt Citrus");
    expect(getAllByRole(host, "radio")).toHaveLength(8);
    expect(getByRole(host, "status").textContent).toContain("8");

    choose(host, "Fabric");
    expect(getAllByRole(host, "radio")).toHaveLength(2);
    expect(getByRole(host, "status").textContent).toContain("1");

    choose(host, "Colour base");
    const colour = getByLabelText<HTMLInputElement>(host, "Front art colour");
    colour.value = "#f2385a";
    fireEvent.input(colour);
    fireEvent.click(getByRole(host, "button", { name: "Drop it on the canvas" }));

    expect(onPlace).toHaveBeenCalledOnce();
    expect(onPlace).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyId: "drinkware-classic-can",
        partId: "drinkware-top-spout",
        paletteId: "cobalt-citrus",
        materialId: "fabric"
      }),
      { id: "front-art", colour: "#F2385A" }
    );
    expect(getByRole(host, "button", { name: "Drop another copy" })).toBeTruthy();
    expect(getByRole(host, "status").textContent)
      .toBe("Classic Can placed · swap who controls the tools");
    expect(host.textContent).not.toMatch(/\b(?:assignment|unit|task|variant|component|material)\b/i);
  });

  it("resets incompatible downstream choices when the shape changes", () => {
    const host = document.createElement("div");
    const catalogue = reviewedCatalogue();
    const panel = new ProductBuilderPanel(host, vi.fn());
    panel.render(catalogue, createVirtualProductVariantResolver(catalogue));

    choose(host, "Classic Can");
    choose(host, "Sport Spout");
    fireEvent.click(getByRole(host, "button", { name: "Shape" }));
    choose(host, "Backpack");

    expect(getAllByRole(host, "radio")).toHaveLength(4);
    expect(getByRole(host, "radio", { name: "Long Straps" })).toBeTruthy();
    expect(host.querySelector('[data-selected-part-id="drinkware-top-spout"]')).toBeNull();
    expect(getByRole(host, "status").textContent).toContain("512");
  });

  it("fails softly without removing the rest of the creator", () => {
    const host = document.createElement("div");
    const panel = new ProductBuilderPanel(host, vi.fn());

    panel.unavailable();

    expect(getByRole(host, "status").textContent).toBe("Product maker unavailable");
    expect(getByRole<HTMLButtonElement>(host, "button", {
      name: "Drop it on the canvas"
    }).disabled).toBe(true);
  });
});
