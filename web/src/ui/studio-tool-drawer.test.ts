import { describe, expect, it } from "vitest";
import { createStudioToolDrawer } from "./studio-tool-drawer";

function createFixture() {
  document.body.innerHTML = `
    <section data-studio-root>
      <section data-studio-workspace>
        <div role="tablist" aria-label="Studio tools">
          <button data-studio-tool="product">Product</button>
          <button data-studio-tool="assets">Assets</button>
          <button data-studio-tool="words">Words</button>
        </div>
        <section id="studio-browse-pane" data-studio-drawer>
          <button type="button" data-studio-drawer-toggle aria-controls="studio-browse-pane" aria-expanded="true">Hide tools</button>
          <section data-studio-panel="product"><input value="kept" /></section>
          <section data-studio-panel="assets" hidden><div style="height: 100px"></div></section>
          <section data-studio-panel="words" hidden></section>
        </section>
        <div data-studio-separator></div>
      </section>
    </section>`;
  return document.querySelector<HTMLElement>("[data-studio-root]")!;
}

describe("createStudioToolDrawer", () => {
  it("activates exactly the first matching tool and panel by default", () => {
    const root = createFixture();
    const drawer = createStudioToolDrawer(root);
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-studio-tool]"));
    const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-studio-panel]"));

    expect(drawer.current()).toBe("product");
    expect(buttons.map((button) => [button.getAttribute("aria-selected"), button.tabIndex]))
      .toEqual([["true", 0], ["false", -1], ["false", -1]]);
    expect(panels.map((panel) => panel.hidden)).toEqual([false, true, true]);
  });

  it("selects a clicked rail tool and announces the state change", () => {
    const root = createFixture();
    const changes: Array<{ tool: string }> = [];
    root.addEventListener("studio-tool-drawer-change", (event) => {
      changes.push((event as CustomEvent<{ tool: string }>).detail);
    });
    const drawer = createStudioToolDrawer(root);
    root.querySelector<HTMLButtonElement>('[data-studio-tool="assets"]')!.click();

    expect(drawer.current()).toBe("assets");
    expect(root.querySelector<HTMLElement>('[data-studio-panel="assets"]')!.hidden).toBe(false);
    expect(root.querySelector<HTMLButtonElement>('[data-studio-tool="assets"]')!.getAttribute("aria-selected"))
      .toBe("true");
    expect(changes.at(-1)).toEqual({ tool: "assets" });
  });

  it("moves selection and focus with ArrowUp, ArrowDown, Home and End in DOM order", () => {
    const root = createFixture();
    const drawer = createStudioToolDrawer(root);
    const product = root.querySelector<HTMLButtonElement>('[data-studio-tool="product"]')!;
    const assets = root.querySelector<HTMLButtonElement>('[data-studio-tool="assets"]')!;
    const words = root.querySelector<HTMLButtonElement>('[data-studio-tool="words"]')!;

    product.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
    expect(drawer.current()).toBe("words");
    expect(document.activeElement).toBe(words);
    words.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(drawer.current()).toBe("product");
    expect(document.activeElement).toBe(product);
    product.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(drawer.current()).toBe("words");
    words.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(drawer.current()).toBe("product");
    expect(document.activeElement).toBe(product);
    product.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(drawer.current()).toBe("assets");
    expect(document.activeElement).toBe(assets);
  });

  it("does not hide the selected pane when Escape is pressed", () => {
    const root = createFixture();
    const drawer = createStudioToolDrawer(root);
    const productPanel = root.querySelector<HTMLElement>('[data-studio-panel="product"]')!;
    const input = productPanel.querySelector<HTMLInputElement>("input")!;
    input.value = "still here";
    root.querySelector<HTMLButtonElement>('[data-studio-tool="product"]')!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(drawer.current()).toBe("product");
    expect(productPanel.hidden).toBe(false);
    expect(input.value).toBe("still here");
    expect(root.dataset.studioDrawerCollapsed).toBeUndefined();
    expect(root.dataset.studioDrawerOpen).toBeUndefined();
  });

  it("hides tools with the click control and reopens the active tool without resetting its input", () => {
    const root = createFixture();
    const drawer = createStudioToolDrawer(root);
    const drawerPane = root.querySelector<HTMLElement>("[data-studio-drawer]")!;
    const rail = root.querySelector<HTMLElement>('[role="tablist"]')!;
    const separator = root.querySelector<HTMLElement>("[data-studio-separator]")!;
    const hideTools = root.querySelector<HTMLButtonElement>("[data-studio-drawer-toggle]")!;
    const product = root.querySelector<HTMLButtonElement>('[data-studio-tool="product"]')!;
    const productInput = root.querySelector<HTMLInputElement>('[data-studio-panel="product"] input')!;
    productInput.value = "kept after hiding";

    hideTools.click();

    expect(root.hasAttribute("data-studio-drawer-collapsed")).toBe(true);
    expect(drawerPane.hidden).toBe(true);
    expect(separator.hidden).toBe(true);
    expect(rail.hidden).toBe(false);
    expect(hideTools.getAttribute("aria-expanded")).toBe("false");
    expect(drawer.current()).toBe("product");
    expect(document.activeElement).toBe(product);

    product.click();

    expect(root.dataset.studioDrawerCollapsed).toBeUndefined();
    expect(drawerPane.hidden).toBe(false);
    expect(separator.hidden).toBe(false);
    expect(hideTools.getAttribute("aria-expanded")).toBe("true");
    expect(productInput.value).toBe("kept after hiding");
    expect(document.activeElement).toBe(product);
  });

  it("reopens the clicked rail tool after tools are hidden", () => {
    const root = createFixture();
    const drawer = createStudioToolDrawer(root);
    root.querySelector<HTMLButtonElement>("[data-studio-drawer-toggle]")!.click();

    root.querySelector<HTMLButtonElement>('[data-studio-tool="assets"]')!.click();

    expect(root.dataset.studioDrawerCollapsed).toBeUndefined();
    expect(drawer.current()).toBe("assets");
    expect(root.querySelector<HTMLElement>('[data-studio-panel="assets"]')!.hidden).toBe(false);
    expect(document.activeElement).toBe(root.querySelector('[data-studio-tool="assets"]'));
  });

  it("ignores hidden or disabled rail tools without making them available", () => {
    const root = createFixture();
    const drawer = createStudioToolDrawer(root);
    const product = root.querySelector<HTMLButtonElement>('[data-studio-tool="product"]')!;
    const assets = root.querySelector<HTMLButtonElement>('[data-studio-tool="assets"]')!;
    const words = root.querySelector<HTMLButtonElement>('[data-studio-tool="words"]')!;
    assets.disabled = true;
    words.hidden = true;

    drawer.select("assets");
    assets.click();
    product.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

    expect(drawer.current()).toBe("product");
    expect(assets.disabled).toBe(true);
    expect(words.hidden).toBe(true);
  });

  it("removes event listeners when destroyed", () => {
    const root = createFixture();
    const drawer = createStudioToolDrawer(root);
    const assets = root.querySelector<HTMLButtonElement>('[data-studio-tool="assets"]')!;
    drawer.destroy();
    assets.click();
    assets.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

    expect(drawer.current()).toBe("product");
    expect(root.querySelector<HTMLElement>('[data-studio-panel="product"]')!.hidden).toBe(false);
  });
});
