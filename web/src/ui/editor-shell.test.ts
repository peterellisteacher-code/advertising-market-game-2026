import { getByRole, getAllByRole } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { createEditorShell } from "./editor-shell";

describe("createEditorShell", () => {
  it("creates labelled regions, five checklist tabs and two live regions", () => {
    document.body.innerHTML = '<div id="creator-root"></div>';
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    const shell = createEditorShell(root);

    expect(getByRole<HTMLInputElement>(root, "textbox", { name: "Product name" }).placeholder)
      .toBe("Name your product");
    expect(getByRole<HTMLInputElement>(root, "searchbox", { name: "Search assets" }).placeholder)
      .toBe("Try crowd, beach or neon");
    expect(getByRole(root, "region", { name: "Product builder" })).toBeTruthy();
    expect(shell.productBuilderPanel.dataset.productBuilderPanel).toBe("");
    expect(root.querySelector('[data-product-shell-select]')).toBeNull();
    const livePhotos = getByRole<HTMLInputElement>(root, "checkbox", { name: "Use live photos" });
    expect(livePhotos.checked).toBe(false);
    expect(shell.libraryResults.dataset.libraryResults).toBe("");
    expect(shell.libraryStatus.getAttribute("role")).toBe("status");
    expect(getByRole(root, "region", { name: "Campaign canvas" })).toBeTruthy();
    expect(getByRole(root, "region", { name: "Pair play" })).toBeTruthy();
    expect(getByRole(root, "status", { name: "Round progress" })).toBeTruthy();
    expect(getByRole(root, "button", { name: "Swap roles" })).toBeTruthy();
    expect(getByRole(root, "combobox", { name: "Audience signal" })).toBeTruthy();
    expect(getByRole(root, "region", { name: "Audience brief" })).toBeTruthy();
    expect(getByRole(root, "region", { name: "Round 0 tools" })).toBeTruthy();
    expect(getByRole(root, "region", { name: "Logo Lab" })).toBeTruthy();
    expect(shell.logoLabPanel.dataset.logoLabPanel).toBe("");
    expect(shell.logoLabPanel.closest("section")?.previousElementSibling)
      .toBe(getByRole(root, "region", { name: "Round 0 tools" }));
    expect(getByRole<HTMLInputElement>(root, "textbox", { name: "Canvas words" }).placeholder)
      .toBe("Try Make room for adventure");
    expect(getByRole(root, "button", { name: "Add words" })).toBeTruthy();
    expect(getByRole(root, "region", { name: "Layers" })).toBeTruthy();
    expect(getByRole(root, "region", { name: "Selected element" })).toBeTruthy();
    expect(getAllByRole(root, "tab").map((tab) => tab.textContent)).toEqual([
      "Price", "Attention", "Interest", "Desire", "Action"
    ]);
    expect(shell.polite.getAttribute("aria-live")).toBe("polite");
    expect(shell.assertive.getAttribute("aria-live")).toBe("assertive");
    expect(shell.undo.dataset.command).toBe("undo");
    expect(shell.redo.dataset.command).toBe("redo");
    expect(root.textContent).not.toMatch(/\b(?:assignment|unit|task)\b/i);
  });
});
