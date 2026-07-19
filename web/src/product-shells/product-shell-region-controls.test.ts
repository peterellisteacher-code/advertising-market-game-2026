import { fireEvent, getByLabelText, getByRole } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import { ProductShellRegionControls } from "./product-shell-region-controls";

describe("ProductShellRegionControls", () => {
  it("removes the contextual inspector before a product is selected", () => {
    const host = document.createElement("aside");
    const controls = new ProductShellRegionControls(host, vi.fn());

    controls.clear();

    expect(host.hidden).toBe(true);
    expect(host.childElementCount).toBe(0);
  });

  it("uses live shell colours and emits named-region changes", () => {
    const host = document.createElement("aside");
    const onChange = vi.fn();
    const controls = new ProductShellRegionControls(host, onChange);

    controls.show({
      objectId: "shell-object",
      title: "Classic Soft Drink Can",
      regions: ["body", "accent", "label"],
      colours: { body: "#EFE8D8", accent: "#E66B3F", label: "#FFF7E8" }
    });

    expect(host.hidden).toBe(false);
    expect(getByRole(host, "heading", { name: "Classic Soft Drink Can" })).toBeTruthy();
    const accent = getByLabelText<HTMLInputElement>(host, "Accent colour");
    expect(accent.value.toUpperCase()).toBe("#E66B3F");
    accent.value = "#157a6e";
    fireEvent.input(accent);
    expect(onChange).toHaveBeenCalledWith("shell-object", "accent", "#157A6E");
  });
});
