import { getByLabelText, getByRole, getAllByRole } from "@testing-library/dom";
import { describe, expect, it } from "vitest";
import { createEditorShell } from "./editor-shell";

describe("createEditorShell", () => {
  it("creates a canvas-first studio with one active tool drawer", () => {
    document.body.innerHTML = '<div id="creator-root"></div>';
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    const shell = createEditorShell(root);

    expect(getByRole<HTMLInputElement>(root, "textbox", { name: "Product name" }).placeholder)
      .toBe("Name your product");
    expect(getByRole<HTMLInputElement>(root, "searchbox", { name: "Search assets", hidden: true }).placeholder)
      .toBe("Try running shoe, tent or pet shop");
    const libraryView = getByRole<HTMLSelectElement>(root, "combobox", {
      name: "Library view",
      hidden: true
    });
    expect([...libraryView.options].map(({ value, textContent }) => [value, textContent]))
      .toEqual([
        ["products", "Products"],
        ["parts", "Parts"],
        ["all", "All pieces"]
      ]);
    expect(libraryView.value).toBe("products");
    expect(shell.libraryView).toBe(libraryView);
    expect(getByRole<HTMLSelectElement>(root, "combobox", { name: "Product category", hidden: true }).value)
      .toBe("");
    expect(getByRole(root, "tablist", { name: "Studio tools" })).toBeTruthy();
    const studioTools = getAllByRole<HTMLButtonElement>(root, "tab", { name: /./ })
      .filter((tab) => tab.hasAttribute("data-studio-tool"));
    expect(studioTools.map((tab) => tab.textContent?.trim())).toEqual([
      "Build", "Assets", "Words", "Logo", "Image", "Price", "Route", "AIDA", "Coach"
    ]);
    expect(studioTools.map((tab) => tab.dataset.glyph)).toEqual([
      "◆", "✦", "Aa", "◎", "▧", "$", "↗", "A", "?"
    ]);
    expect(new Set(studioTools.map((tab) => tab.dataset.glyph)).size).toBe(studioTools.length);
    expect(studioTools.filter((tab) => tab.getAttribute("aria-selected") === "true"))
      .toHaveLength(1);
    expect(studioTools[0]?.getAttribute("aria-selected")).toBe("true");
    expect(root.querySelectorAll<HTMLElement>("[data-studio-panel]:not([hidden])"))
      .toHaveLength(1);
    expect(root.querySelector<HTMLElement>('[data-studio-panel="product"]')?.hidden)
      .toBe(false);
    expect(getByRole(root, "region", { name: "Product builder" })).toBeTruthy();
    const launchPath = getByRole(root, "note", { name: "Launch path" });
    expect([...launchPath.querySelectorAll("strong")].map((step) => step.textContent))
      .toEqual(["Build", "Place", "Design"]);
    expect(shell.productBuilderPanel.dataset.productBuilderPanel).toBe("");
    expect(root.querySelector('[data-studio-panel="price"][aria-label="Money check"]')).toBeTruthy();
    expect(shell.moneyCheckPanel.dataset.moneyCheckPanel).toBe("");
    expect(root.querySelector('[data-studio-panel="route"][aria-label="Market Route"]')).toBeTruthy();
    expect(shell.marketRoutePanel.dataset.marketRoutePanel).toBe("");
    expect(root.querySelector('[data-studio-panel="aida"][aria-label="AIDA move deck"]')).toBeTruthy();
    expect(shell.aidaPlaybookPanel.dataset.aidaPlaybookPanel).toBe("");
    expect(root.querySelector('[data-studio-panel="coach"][aria-label="Studio Coach"]')).toBeTruthy();
    expect(shell.studioCoachPanel.dataset.studioCoachPanel).toBe("");
    expect(root.querySelector('[data-studio-panel="image"][aria-label="Image Lab"]')).toBeTruthy();
    expect(shell.imageLabPanel.dataset.imageLabPanel).toBe("");
    expect(root.querySelector('[data-product-shell-select]')).toBeNull();
    const livePhotos = getByRole<HTMLInputElement>(root, "checkbox", { name: "Show photo products", hidden: true });
    expect(livePhotos.checked).toBe(false);
    const pieceColour = getByLabelText<HTMLInputElement>(root, "Colour for new pieces");
    expect(pieceColour.type).toBe("color");
    expect(pieceColour.value).toBe("#e4572e");
    expect(shell.libraryColour).toBe(pieceColour);
    expect(shell.libraryResults.dataset.libraryResults).toBe("");
    expect(shell.libraryStatus.getAttribute("role")).toBe("status");
    expect(getByRole(root, "button", { name: "Hide library" })).toBeTruthy();
    expect(getByRole(root, "region", { name: "Campaign canvas" })).toBeTruthy();
    const sizeControls = getByRole(root, "group", { name: "Selected product or image size" });
    expect(getByRole(sizeControls, "button", { name: "Make selected product or image smaller" }))
      .toBeTruthy();
    expect(getByRole(sizeControls, "button", { name: "Fill ad with selected image" }))
      .toBeTruthy();
    expect(getByRole(sizeControls, "button", { name: "Make selected product or image larger" }))
      .toBeTruthy();
    expect(getByRole(sizeControls, "status").textContent).toBe("Select a product or image");
    expect(getByRole(root, "status", { name: "Empty canvas" }).textContent)
      .toContain("Canvas empty");
    expect(shell.canvasEmptyState.hidden).toBe(false);
    expect(getByRole(root, "region", { name: "Pair play" })).toBeTruthy();
    expect(getByRole(root, "status", { name: "Pair progress" })).toBeTruthy();
    expect(root.querySelector(".creator__role-card [data-active-role-action]"))
      .toBe(shell.activeRoleAction);
    expect(root.querySelector(".creator__role-card [data-partner-role]"))
      .toBe(shell.partnerRole);
    expect(root.querySelector(".creator__role-card [data-partner-role-action]"))
      .toBe(shell.partnerRoleAction);
    expect(shell.partnerRoleAction.closest("[hidden]")).toBeNull();
    expect(shell.activeRoleAction.textContent)
      .toMatch(/build the product/i);
    expect(shell.partnerRole.textContent).toBe("Strategist");
    expect(shell.partnerRoleAction.textContent)
      .toContain("Prepare a product name and one useful benefit");
    expect(getByRole(root, "button", { name: "Swap roles" })).toBeTruthy();
    expect(getByRole(root, "combobox", { name: "Audience signal" })).toBeTruthy();
    expect(root.querySelector('#studio-full-brief[aria-label="Audience brief"]')).toBeTruthy();
    expect(getByRole(root, "button", { name: "Open full brief" }).getAttribute("aria-expanded"))
      .toBe("false");
    expect(root.querySelector('[data-studio-panel="words"][aria-label="Pair tools"]')).toBeTruthy();
    expect(root.querySelector('[data-studio-panel="logo"][aria-label="Logo Lab"]')).toBeTruthy();
    expect(shell.logoLabPanel.dataset.logoLabPanel).toBe("");
    expect(getByRole<HTMLInputElement>(root, "textbox", { name: "Canvas words", hidden: true }).placeholder)
      .toBe("Try Make room for adventure");
    expect(getByRole(root, "button", { name: "Add words", hidden: true })).toBeTruthy();
    expect(root.querySelector('.creator__layers[aria-label="Layers"]')).toBeTruthy();
    expect(root.querySelector('.creator__inspector[aria-label="Selected element"]')).toBeTruthy();
    expect(shell.inspector.hidden).toBe(true);
    expect(getByRole(root, "group", { name: "AIDA steps", hidden: true })).toBeTruthy();
    expect(getAllByRole(root, "button", { hidden: true })
      .filter((button) => button.hasAttribute("data-slot"))
      .map((button) => button.textContent)).toEqual([
      "Price", "Attention", "Interest", "Desire", "Action"
    ]);
    expect(shell.polite.getAttribute("aria-live")).toBe("polite");
    expect(shell.assertive.getAttribute("aria-live")).toBe("assertive");
    expect(getByRole(root, "status", { name: "Saved progress" }))
      .toBe(shell.saveStatus);
    expect(shell.saveStatus.textContent).toBe("");
    expect(shell.undo.dataset.command).toBe("undo");
    expect(shell.redo.dataset.command).toBe("redo");
    expect(root.textContent).not.toMatch(/\b(?:assignment|unit|task)\b/i);
  });
});
