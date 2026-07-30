import { fireEvent } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import type {
  ProductShellCatalogue,
  ProductShellRecord
} from "./product-shell-catalogue";
import { ProductShellPicker } from "./product-shell-picker";

const shell = (id: string, title: string, family: string): ProductShellRecord => ({
  id,
  title,
  family,
  template: "panel",
  authoringUrl: `https://classroom.test/catalog/generated/product-shells-v1/shells/${id}/authoring.svg`,
  previewUrl: `https://classroom.test/catalog/generated/product-shells-v1/shells/${id}/preview.svg`,
  regions: ["body", "accent"],
  printAreas: [{ id: "front", x: 0.2, y: 0.2, width: 0.6, height: 0.6, safeInset: 0.03 }],
  partSlots: [],
  classroomReviewed: true,
  brandFree: true
});

describe("ProductShellPicker", () => {
  it("groups shells by family, previews selection and adds exactly the selected shell", () => {
    document.body.innerHTML = `
      <select aria-label="Product shell"></select>
      <img data-product-shell-preview alt="">
      <button type="button">Add product shell</button>
      <p role="status"></p>`;
    const catalogue: ProductShellCatalogue = {
      schema: "product-shell-catalog@1",
      version: 1,
      packId: "product-shells-v1",
      families: [
        { id: "drinks-snacks", title: "Drinks & Snacks" },
        { id: "shops-services", title: "Shops & Services" }
      ],
      shells: [
        shell("drinks-classic-can", "Classic Soft Drink Can", "drinks-snacks"),
        shell("shops-pet-shop", "Pet Shop Storefront", "shops-services")
      ]
    };
    const select = document.querySelector("select")!;
    const preview = document.querySelector("img")!;
    const button = document.querySelector("button")!;
    const status = document.querySelector<HTMLElement>('[role="status"]')!;
    const onPick = vi.fn();
    const picker = new ProductShellPicker({ select, preview, button, status }, onPick);

    picker.render(catalogue);
    expect(select.querySelectorAll("optgroup")).toHaveLength(2);
    expect(select.querySelectorAll("option")).toHaveLength(2);
    expect(preview.src).toContain("drinks-classic-can/preview.svg");
    expect(preview.alt).toBe("Preview: Classic Soft Drink Can");

    select.value = "shops-pet-shop";
    fireEvent.change(select);
    expect(preview.src).toContain("shops-pet-shop/preview.svg");
    fireEvent.click(button);
    expect(onPick).toHaveBeenCalledOnce();
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "shops-pet-shop" }),
      "product-shells-v1"
    );
    expect(status.textContent).toContain("Pet Shop Storefront");
  });
});
