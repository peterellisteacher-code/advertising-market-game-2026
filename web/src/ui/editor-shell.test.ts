import { fireEvent, getByLabelText, getByRole, getAllByRole } from "@testing-library/dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEditorShell } from "./editor-shell";

describe("createEditorShell", () => {
  it("applies one large-text token across creator controls and dialogs", () => {
    const style = document.createElement("style");
    style.textContent = readFileSync(
      join(process.cwd(), "web", "src", "styles", "editor.css"),
      "utf8"
    );
    document.head.append(style);
    try {
      document.body.innerHTML = '<div id="creator-root"></div>';
      const root = document.querySelector<HTMLElement>("#creator-root")!;
      const shell = createEditorShell(root);
      const creator = root.querySelector<HTMLElement>(".creator")!;

      creator.dataset.displayText = "large";

      expect(getComputedStyle(creator).getPropertyValue("--creator-chrome-font-size").trim())
        .toBe("1.125rem");
      const coveredChrome: Array<[string, HTMLElement]> = [
        ["task bar", shell.activeRoleAction],
        ["canvas controls", root.querySelector<HTMLElement>("[data-canvas-zoom-status]")!],
        ["display panel", shell.displayPanel.querySelector<HTMLElement>("legend")!],
        ["instruction dialog", root.querySelector<HTMLElement>("[data-guide-dialog] p")!],
        ["onboarding dialog", root.querySelector<HTMLElement>("[data-studio-onboarding-dialog] p")!],
        ["role dialog", root.querySelector<HTMLElement>("[data-role-guide-layer] p")!],
        ["product typeface control", shell.productTypeface]
      ];
      expect(coveredChrome.map(([, element]) => element)).not.toContain(null);
      for (const [surface, element] of coveredChrome) {
        expect(getComputedStyle(element).fontSize, surface)
          .toBe("var(--creator-chrome-font-size)");
      }
    } finally {
      style.remove();
    }
  });

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
        ["backgrounds", "Backgrounds"],
        ["all", "All pieces"]
      ]);
    const display = shell.displayToggle;
    const panel = shell.displayPanel;
    expect(display.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hidden).toBe(true);
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
    const launchPath = getByRole(root, "note", { name: "Build order" });
    expect([...launchPath.querySelectorAll("strong")].map((step) => step.textContent))
      .toEqual(["Build", "Place", "Design"]);
    expect(shell.productBuilderPanel.dataset.productBuilderPanel).toBe("");
    expect(root.querySelector('[data-studio-panel="price"][aria-label="Money check"]')).toBeTruthy();
    expect(shell.moneyCheckPanel.dataset.moneyCheckPanel).toBe("");
    expect(root.querySelector('[data-studio-panel="route"][aria-label="Market Route"]')).toBeTruthy();
    expect(shell.marketRoutePanel.dataset.marketRoutePanel).toBe("");
    expect(root.querySelector('[data-studio-panel="aida"][aria-label="AIDA techniques"]')).toBeTruthy();
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
    const hideTools = getByRole<HTMLButtonElement>(root, "button", { name: "Hide tools" });
    expect(hideTools.getAttribute("aria-controls")).toBe("studio-browse-pane");
    expect(hideTools.getAttribute("aria-expanded")).toBe("true");
    const separator = getByRole<HTMLElement>(root, "separator", {
      name: "Resize the library and design areas"
    });
    expect(separator.getAttribute("aria-orientation")).toBe("vertical");
    expect(separator.getAttribute("tabindex")).toBe("0");
    expect(shell.workspace.querySelector("[data-studio-separator]")).toBe(separator);
    const splitHint = shell.workspace.querySelector<HTMLElement>("[data-studio-split-hint]")!;
    expect(splitHint.id).toBe("studio-split-hint");
    expect(separator.getAttribute("aria-describedby")).toBe(splitHint.id);
    expect(splitHint.textContent)
      .toMatch(/Left Arrow.*Right Arrow.*Shift.*Home.*End.*Press R.*double-click/s);
    const areaTabs = root.querySelector<HTMLElement>("[data-studio-pane-tabs]")!;
    expect(areaTabs.getAttribute("aria-label")).toBe("Studio areas");
    expect(areaTabs.hidden).toBe(true);
    expect(getByRole(areaTabs, "tab", { name: "Browse", hidden: true }).getAttribute("aria-controls"))
      .toBe("studio-browse-pane");
    expect(getByRole(areaTabs, "tab", { name: "Edit", hidden: true }).getAttribute("aria-controls"))
      .toBe("studio-edit-pane");
    expect(shell.library.id).toBe("studio-browse-pane");
    expect(shell.canvasRegion.id).toBe("studio-edit-pane");
    const currentInstruction = getByRole(root, "region", { name: "Current instruction" });
    expect(currentInstruction).toBeTruthy();
    expect(["Now", "Why", "Done", "Next"].every((label) =>
      currentInstruction.textContent?.includes(label)
    )).toBe(true);
    const guideRows = currentInstruction.querySelectorAll("dl > div");
    expect(guideRows).toHaveLength(4);
    expect([...guideRows].every((row) =>
      row.querySelector("dt") !== null && row.querySelector("dd") !== null
    )).toBe(true);
    const availableMethods = currentInstruction
      .querySelector<HTMLDetailsElement>("[data-guide-methods]")!;
    expect(availableMethods.hidden).toBe(true);
    expect(availableMethods.querySelector("summary")?.textContent).toBe("Available methods");
    expect(availableMethods.querySelector("[data-guide-method-list]")).toBeTruthy();
    expect(getAllByRole(root, "button", { name: "How to use this site" })).toHaveLength(2);
    const instructions = root.querySelector<HTMLElement>('[data-guide-dialog]')!;
    expect(instructions.hidden).toBe(true);
    expect(instructions.getAttribute("aria-label")).toBe("How to use this site");
    expect(instructions.querySelector("[data-guide-reference]")).toBeTruthy();
    expect(instructions.querySelector("[data-guide-reference]")?.childElementCount).toBe(0);
    const lockedActions = root.querySelector<HTMLElement>("[data-locked-actions-status]")!;
    expect(lockedActions.id).toBe("studio-locked-actions-status");
    expect(lockedActions.hidden).toBe(true);
    expect(getByRole(root, "region", { name: "Advertisement area" }).getAttribute("tabindex")).toBe("0");
    const sizeControls = getByRole(root, "group", { name: "Canvas toolbar" });
    expect(getByRole(sizeControls, "button", { name: "Make selected product or image smaller" }))
      .toBeTruthy();
    expect(getByRole(sizeControls, "button", { name: "Fill ad with selected image" }))
      .toBeTruthy();
    expect(getByRole(sizeControls, "button", { name: "Make selected product or image larger" }))
      .toBeTruthy();
    const deleteSelected = getByRole<HTMLButtonElement>(
      sizeControls,
      "button",
      { name: "Delete selected item" }
    );
    expect(deleteSelected.disabled).toBe(true);
    expect(deleteSelected.getAttribute("aria-describedby")).toBe("canvas-delete-status");
    expect(root.querySelector<HTMLElement>("#canvas-delete-status")?.textContent)
      .toBe("Select an item to delete");
    expect(shell.deleteSelected).toBe(deleteSelected);
    expect(shell.deleteStatus.id).toBe("canvas-delete-status");
    expect(shell.zoomStatus.textContent).toBe("Select a product or image");
    expect(getByRole(root, "status", { name: "Empty advertisement" }).textContent)
      .toContain("Advertisement empty");
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
    const roleActions = getByRole(root, "group", { name: "Partner role controls" });
    expect([...roleActions.querySelectorAll("button")].map(({ textContent }) => textContent))
      .toEqual(["Swap roles", "Role guide"]);
    const roleGuideLayer = root.querySelector<HTMLElement>("[data-role-guide-layer]")!;
    expect(roleGuideLayer.hidden).toBe(true);
    expect(roleGuideLayer.textContent).toContain(
      "Controls the product's appearance, images, colour, arrangement and layout."
    );
    expect(roleGuideLayer.textContent).toContain(
      "Controls the product name, advertising words, claim, price reasoning and market-route reasoning."
    );
    expect(roleGuideLayer.textContent).toContain(
      "Both partners can use the same tools that are unlocked for the current level."
    );
    expect(roleGuideLayer.textContent).toContain(
      "The roles do not unlock different buttons."
    );
    expect(getByRole(root, "combobox", { name: "Audience brief" })).toBeTruthy();
    const audienceBrief = root.querySelector<HTMLElement>(
      '#studio-full-brief[aria-label="Audience brief"]'
    )!;
    expect(audienceBrief).toBeTruthy();
    expect(audienceBrief.textContent).not.toContain("Context is the situation the audience is in.");
    expect(audienceBrief.querySelectorAll("[data-brief-help]")).toHaveLength(4);
    expect(getByRole(root, "button", { name: "Open full brief" }).getAttribute("aria-expanded"))
      .toBe("false");
    expect(shell.tuckTabsTop.getAttribute("role")).toBe("group");
    expect(shell.tuckTabsTop.getAttribute("aria-label")).toBe("Studio menus");
    expect(shell.tuckTabsTop.children).toHaveLength(0);
    expect(shell.menuPanel.id).toBe("studio-menu-panel");
    expect(shell.menuPanel.hidden).toBe(false);
    expect(shell.taskBar.id).toBe("studio-task-bar");
    expect(shell.taskBar.hidden).toBe(false);
    expect(root.querySelector('[data-studio-panel="words"][aria-label="Pair tools"]')).toBeTruthy();
    expect(root.querySelector('[data-studio-panel="logo"][aria-label="Logo Lab"]')).toBeTruthy();
    expect(shell.logoLabPanel.dataset.logoLabPanel).toBe("");
    expect(getByRole<HTMLInputElement>(root, "textbox", { name: "Advertisement words", hidden: true }).placeholder)
      .toBe("Try Make room for adventure");
    expect(getByRole(root, "button", { name: "Add words to ad", hidden: true }))
      .toBe(shell.addWords);
    expect(getByRole(root, "button", { name: "Put words on selected product", hidden: true }))
      .toBe(shell.productWords);
    const productTypeface = getByRole<HTMLSelectElement>(root, "combobox", {
      name: "Curved product typeface",
      hidden: true
    });
    expect(productTypeface).toBe(shell.productTypeface);
    expect([...productTypeface.options].map(({ value }) => value)).toEqual(expect.arrayContaining([
      "", "Lilita One", "Bebas Neue", "Russo One"
    ]));
    expect(root.querySelector('[data-studio-panel="words"]')?.textContent)
      .toContain("On supported products, the words appear on a curved label and the original text remains editable.");
    expect(root.querySelector('.creator__layers[aria-label="Item list"]')).toBeTruthy();
    expect(getByRole(root, "button", { name: "Open item list", hidden: true })).toBeTruthy();
    expect(root.querySelector('.creator__inspector[aria-label="Selected element"]')).toBeTruthy();
    expect(shell.inspector.hidden).toBe(true);
    const sectionFill = root.querySelector<HTMLElement>(
      '[data-section-fill-panel][role="region"][aria-label="Selected item fill"]'
    )!;
    expect(sectionFill).toBe(shell.sectionFillPanel);
    expect(shell.sectionFillPanel.hidden).toBe(true);
    expect(getByRole(root, "group", { name: "AIDA stages", hidden: true })).toBeTruthy();
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
    expect(sizeControls.contains(shell.undo)).toBe(true);
    expect(sizeControls.contains(shell.redo)).toBe(true);
    expect(sizeControls.contains(shell.saveStatus)).toBe(true);
    expect(root.textContent).not.toMatch(/\b(?:assignment|unit|canvas)\b/i);
  });

  it("opens and closes the full brief without adding a floating drawer control", () => {
    document.body.innerHTML = '<div id="creator-root"></div>';
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    const shell = createEditorShell(root);
    const creator = shell.overlay;
    const toggle = getByRole<HTMLButtonElement>(root, "button", { name: "Open full brief" });

    toggle.focus();
    toggle.click();

    expect(creator.dataset.briefOpen).toBe("true");
    expect(root.querySelector("[data-studio-collapse]")).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    toggle.click();

    expect(creator.dataset.briefOpen).toBeUndefined();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle);
  });

  it("opens each brief definition on demand and returns focus when it closes", () => {
    document.body.innerHTML = '<div id="creator-root"></div>';
    const root = document.querySelector<HTMLElement>("#creator-root")!;
    createEditorShell(root);
    getByRole<HTMLButtonElement>(root, "button", { name: "Open full brief" }).click();

    const definitions = [
      ["What does Context mean?", "Context is the situation the audience is in."],
      ["What does Need mean?", "Need is the problem the product should help solve."],
      ["What does Values mean?", "Values are the ideas or qualities that matter to this audience."],
      ["What does Intended audience response mean?", "Intended audience response is what the advertisement should encourage the audience to think, feel or do."]
    ] as const;
    for (const [label, definition] of definitions) {
      const help = getByRole<HTMLButtonElement>(root, "button", { name: label });
      fireEvent.click(help);
      const card = root.querySelector<HTMLElement>("[data-brief-help-card]")!;
      expect(card.textContent).toContain(definition);
      expect(root.querySelectorAll("[data-brief-help-card]")).toHaveLength(1);
      const close = getByRole<HTMLButtonElement>(card, "button", { name: "Close" });
      fireEvent.keyDown(card, { key: "Escape" });
      expect(root.querySelector("[data-brief-help-card]")).toBeNull();
      expect(document.activeElement).toBe(help);
      fireEvent.click(help);
      fireEvent.click(getByRole<HTMLButtonElement>(
        root.querySelector<HTMLElement>("[data-brief-help-card]")!, "button", { name: "Close" }
      ));
      expect(root.querySelector("[data-brief-help-card]")).toBeNull();
      expect(document.activeElement).toBe(help);
    }
  });
});
