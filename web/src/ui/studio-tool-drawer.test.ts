import { describe, expect, it } from "vitest";
import { createStudioToolDrawer } from "./studio-tool-drawer";
import { TUCK_SHELL_STORAGE_KEYS } from "./tuck-shell";

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
          <section data-studio-panel="product"><input value="kept" /></section>
          <section data-studio-panel="assets" hidden><div style="height: 100px"></div></section>
          <section data-studio-panel="words" hidden></section>
        </section>
        <div data-studio-separator></div>
      </section>
    </section>`;
  return document.querySelector<HTMLElement>("[data-studio-root]")!;
}

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => values.clear(),
    key: () => null,
    length: 0
  };
}

function fakeNarrowQuery(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<() => void>();
  return {
    get matches() { return matches; },
    addEventListener: (_type: string, listener: () => void) => { listeners.add(listener); },
    removeEventListener: (_type: string, listener: () => void) => { listeners.delete(listener); },
    setMatches(next: boolean) {
      matches = next;
      for (const listener of listeners) listener();
    },
    listenerCount: () => listeners.size
  };
}

describe("createStudioToolDrawer", () => {
  it("activates the first matching tool by default but keeps the drawer tucked", () => {
    const root = createFixture();
    const drawer = createStudioToolDrawer(root);
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-studio-tool]"));
    const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-studio-panel]"));
    const drawerPane = root.querySelector<HTMLElement>("[data-studio-drawer]")!;

    expect(drawer.current()).toBe("product");
    expect(drawer.isTucked()).toBe(true);
    expect(buttons.map((button) =>
      [button.getAttribute("aria-selected"), button.tabIndex, button.getAttribute("aria-expanded")]))
      .toEqual([["true", 0, "false"], ["false", -1, "false"], ["false", -1, "false"]]);
    expect(panels.map((panel) => panel.hidden)).toEqual([false, true, true]);
    expect(drawerPane.hidden).toBe(true);
    expect(root.hasAttribute("data-studio-drawer-collapsed")).toBe(true);
  });

  it("selects a clicked rail tool, untucks the drawer, and announces the change", () => {
    const root = createFixture();
    const changes: Array<{ tool: string }> = [];
    root.addEventListener("studio-tool-drawer-change", (event) => {
      changes.push((event as CustomEvent<{ tool: string }>).detail);
    });
    const drawer = createStudioToolDrawer(root);
    const drawerPane = root.querySelector<HTMLElement>("[data-studio-drawer]")!;

    root.querySelector<HTMLButtonElement>('[data-studio-tool="assets"]')!.click();

    expect(drawer.current()).toBe("assets");
    expect(drawer.isTucked()).toBe(false);
    expect(drawerPane.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('[data-studio-panel="assets"]')!.hidden).toBe(false);
    const assetsTab = root.querySelector<HTMLButtonElement>('[data-studio-tool="assets"]')!;
    expect(assetsTab.getAttribute("aria-selected")).toBe("true");
    expect(assetsTab.getAttribute("aria-expanded")).toBe("true");
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

  it("does not tuck the drawer when Escape is pressed on a rail tab", () => {
    const root = createFixture();
    const drawer = createStudioToolDrawer(root);
    const productPanel = root.querySelector<HTMLElement>('[data-studio-panel="product"]')!;
    const input = productPanel.querySelector<HTMLInputElement>("input")!;
    const productTab = root.querySelector<HTMLButtonElement>('[data-studio-tool="product"]')!;
    productTab.click();
    input.value = "still here";

    productTab.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(drawer.current()).toBe("product");
    expect(drawer.isTucked()).toBe(false);
    expect(productPanel.hidden).toBe(false);
    expect(input.value).toBe("still here");
  });

  it("tucks the drawer and focuses the active tool tab when Escape is pressed inside the drawer", () => {
    const root = createFixture();
    const drawer = createStudioToolDrawer(root);
    const product = root.querySelector<HTMLButtonElement>('[data-studio-tool="product"]')!;
    product.click();
    const productInput = root.querySelector<HTMLInputElement>('[data-studio-panel="product"] input')!;
    productInput.focus();

    productInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(drawer.isTucked()).toBe(true);
    expect(root.querySelector<HTMLElement>("[data-studio-drawer]")!.hidden).toBe(true);
    expect(document.activeElement).toBe(product);
  });

  it("toggles the drawer tucked and untucked when the active tool tab is clicked again, keeping input state", () => {
    const root = createFixture();
    const drawer = createStudioToolDrawer(root);
    const drawerPane = root.querySelector<HTMLElement>("[data-studio-drawer]")!;
    const separator = root.querySelector<HTMLElement>("[data-studio-separator]")!;
    const product = root.querySelector<HTMLButtonElement>('[data-studio-tool="product"]')!;
    const productInput = root.querySelector<HTMLInputElement>('[data-studio-panel="product"] input')!;

    product.click();
    expect(drawer.isTucked()).toBe(false);
    expect(drawerPane.hidden).toBe(false);
    expect(separator.hidden).toBe(false);
    expect(product.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(product);

    productInput.value = "kept while tucking";
    product.click();

    expect(drawer.isTucked()).toBe(true);
    expect(root.hasAttribute("data-studio-drawer-collapsed")).toBe(true);
    expect(drawerPane.hidden).toBe(true);
    expect(separator.hidden).toBe(true);
    expect(product.getAttribute("aria-expanded")).toBe("false");
    expect(drawer.current()).toBe("product");
    expect(document.activeElement).toBe(product);

    product.click();
    expect(drawer.isTucked()).toBe(false);
    expect(productInput.value).toBe("kept while tucking");
  });

  it("reopens with a different tool after the drawer was tucked", () => {
    const root = createFixture();
    const drawer = createStudioToolDrawer(root);
    const product = root.querySelector<HTMLButtonElement>('[data-studio-tool="product"]')!;
    product.click();
    product.click();
    expect(drawer.isTucked()).toBe(true);

    root.querySelector<HTMLButtonElement>('[data-studio-tool="assets"]')!.click();

    expect(drawer.isTucked()).toBe(false);
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
    const drawerPane = root.querySelector<HTMLElement>("[data-studio-drawer]")!;
    drawer.destroy();
    assets.click();
    assets.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    drawerPane.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(drawer.current()).toBe("product");
    expect(root.querySelector<HTMLElement>('[data-studio-panel="product"]')!.hidden).toBe(false);
  });
});

describe("createStudioToolDrawer persistence", () => {
  it("defaults to tucked and does not persist when no storage is provided", () => {
    const root = createFixture();
    const drawer = createStudioToolDrawer(root);

    root.querySelector<HTMLButtonElement>('[data-studio-tool="product"]')!.click();

    expect(drawer.isTucked()).toBe(false);
  });

  it("persists the tucked state per scope and restores it on the next construction", () => {
    const storage = memoryStorage();
    const root = createFixture();
    const drawer = createStudioToolDrawer(root, { storage, scope: "student" });
    expect(drawer.isTucked()).toBe(true);

    root.querySelector<HTMLButtonElement>('[data-studio-tool="product"]')!.click();

    expect(drawer.isTucked()).toBe(false);
    expect(JSON.parse(storage.getItem(TUCK_SHELL_STORAGE_KEYS.student)!)).toMatchObject({ drawer: false });

    const rootAgain = createFixture();
    const restored = createStudioToolDrawer(rootAgain, { storage, scope: "student" });
    expect(restored.isTucked()).toBe(false);
  });

  it("keeps the drawer's persisted flag alongside existing tuck-shell panel state without overwriting it", () => {
    const storage = memoryStorage();
    storage.setItem(TUCK_SHELL_STORAGE_KEYS.student, JSON.stringify({ menu: false }));
    const root = createFixture();
    const drawer = createStudioToolDrawer(root, { storage, scope: "student" });

    root.querySelector<HTMLButtonElement>('[data-studio-tool="product"]')!.click();

    expect(drawer.isTucked()).toBe(false);
    expect(JSON.parse(storage.getItem(TUCK_SHELL_STORAGE_KEYS.student)!))
      .toEqual({ menu: false, drawer: false });
  });

  it("keeps separate persisted drawer state per mode scope", () => {
    const storage = memoryStorage();
    const studentRoot = createFixture();
    const studentDrawer = createStudioToolDrawer(studentRoot, { storage, scope: "student" });
    studentRoot.querySelector<HTMLButtonElement>('[data-studio-tool="product"]')!.click();
    expect(studentDrawer.isTucked()).toBe(false);

    const teacherRoot = createFixture();
    const teacherDrawer = createStudioToolDrawer(teacherRoot, { storage, scope: "teacher-playtest" });

    expect(teacherDrawer.isTucked()).toBe(true);
  });
});

describe("createStudioToolDrawer narrow-viewport handoff", () => {
  it("leaves the shared drawer/separator hidden state alone while the narrow query matches", () => {
    const narrowQuery = fakeNarrowQuery(true);
    const root = createFixture();
    const drawerPane = root.querySelector<HTMLElement>("[data-studio-drawer]")!;
    const separator = root.querySelector<HTMLElement>("[data-studio-separator]")!;
    // Simulate StudioSplitPane already having shown the Browse pane, the way
    // it does at construction in narrow mode, before the drawer is created.
    drawerPane.hidden = false;
    separator.hidden = true;

    const drawer = createStudioToolDrawer(root, { narrowQuery });

    // Tucked by default internally, but the shared element's hidden state
    // must stay exactly as StudioSplitPane left it.
    expect(drawer.isTucked()).toBe(true);
    expect(drawerPane.hidden).toBe(false);
    expect(separator.hidden).toBe(true);
    expect(root.hasAttribute("data-studio-drawer-collapsed")).toBe(true);

    root.querySelector<HTMLButtonElement>('[data-studio-tool="assets"]')!.click();

    expect(drawer.isTucked()).toBe(false);
    expect(drawerPane.hidden).toBe(false);
    expect(separator.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>('[data-studio-panel="assets"]')!.hidden).toBe(false);
  });

  it("re-applies the tucked state to the shared element once the viewport widens past the breakpoint", () => {
    const narrowQuery = fakeNarrowQuery(true);
    const root = createFixture();
    const drawerPane = root.querySelector<HTMLElement>("[data-studio-drawer]")!;
    const separator = root.querySelector<HTMLElement>("[data-studio-separator]")!;
    drawerPane.hidden = false;

    const drawer = createStudioToolDrawer(root, { narrowQuery });
    expect(drawer.isTucked()).toBe(true);
    expect(drawerPane.hidden).toBe(false);

    narrowQuery.setMatches(false);

    expect(drawerPane.hidden).toBe(true);
    expect(separator.hidden).toBe(true);
  });

  it("stops reacting to narrow-query changes once destroyed", () => {
    const narrowQuery = fakeNarrowQuery(true);
    const root = createFixture();
    const drawerPane = root.querySelector<HTMLElement>("[data-studio-drawer]")!;
    drawerPane.hidden = false;

    const drawer = createStudioToolDrawer(root, { narrowQuery });
    expect(narrowQuery.listenerCount()).toBe(1);
    drawer.destroy();
    expect(narrowQuery.listenerCount()).toBe(0);

    narrowQuery.setMatches(false);

    expect(drawerPane.hidden).toBe(false);
  });
});
