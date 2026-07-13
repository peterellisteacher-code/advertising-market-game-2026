import { getByRole, getAllByRole } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { createEditorShell } from "./editor-shell";

describe("createEditorShell", () => {
  it("creates labelled regions, five checklist tabs and two live regions", () => {
    document.body.innerHTML = '<div id="creator-root"></div>';
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    const shell = createEditorShell(root);

    expect(getByRole(root, "searchbox", { name: "Search assets" })).toBeTruthy();
    expect(getByRole(root, "region", { name: "Product builder" })).toBeTruthy();
    expect(shell.productBuilderPanel.dataset.productBuilderPanel).toBe("");
    expect(root.querySelector('[data-product-shell-select]')).toBeNull();
    const livePhotos = getByRole<HTMLInputElement>(root, "checkbox", { name: "Use live photos" });
    expect(livePhotos.checked).toBe(false);
    expect(shell.libraryResults.dataset.libraryResults).toBe("");
    expect(shell.libraryStatus.getAttribute("role")).toBe("status");
    expect(getByRole(root, "region", { name: "Campaign canvas" })).toBeTruthy();
    expect(getByRole(root, "region", { name: "Layers" })).toBeTruthy();
    expect(getByRole(root, "region", { name: "Selected element" })).toBeTruthy();
    expect(getAllByRole(root, "tab").map((tab) => tab.textContent)).toEqual([
      "Price", "Attention", "Interest", "Desire", "Action"
    ]);
    expect(shell.polite.getAttribute("aria-live")).toBe("polite");
    expect(shell.assertive.getAttribute("aria-live")).toBe("assertive");
    expect(root.textContent).not.toMatch(/\b(?:assignment|unit|task)\b/i);
  });
});
