import { fireEvent, getByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTuckShell,
  prefersReducedMotion,
  readTuckedState,
  TUCK_SHELL_STORAGE_KEYS
} from "./tuck-shell";

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

function panelFixture(id: string, focusableLabel = "First control"): { tabStrip: HTMLElement; panel: HTMLElement } {
  const tabStrip = document.createElement("div");
  const panel = document.createElement("section");
  panel.id = id;
  const focusable = document.createElement("button");
  focusable.type = "button";
  focusable.textContent = focusableLabel;
  panel.append(focusable);
  document.body.append(tabStrip, panel);
  return { tabStrip, panel };
}

afterEach(() => {
  document.body.innerHTML = "";
  delete document.documentElement.dataset.tuckMotion;
});

describe("createTuckShell", () => {
  it("creates a tab wired to its panel and applies the default tucked state", () => {
    const { tabStrip, panel } = panelFixture("studio-menu-panel");
    const shell = createTuckShell({ storage: null, scope: "student" });

    const handle = shell.register({
      id: "menu",
      edge: "top",
      tabLabel: "Menu",
      defaultTucked: true,
      panel,
      tabStrip
    });

    expect(handle.tab.tagName).toBe("BUTTON");
    expect(handle.tab.getAttribute("type")).toBe("button");
    expect(handle.tab.textContent).toBe("Menu");
    expect(handle.tab.getAttribute("aria-controls")).toBe("studio-menu-panel");
    expect(handle.tab.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hidden).toBe(true);
    expect(handle.isTucked()).toBe(true);
    expect(tabStrip.contains(handle.tab)).toBe(true);
  });

  it("honours defaultTucked: false by leaving the panel open", () => {
    const { tabStrip, panel } = panelFixture("studio-brief-panel");
    const shell = createTuckShell({ storage: null, scope: "student" });

    const handle = shell.register({
      id: "brief",
      edge: "top",
      tabLabel: "Brief & roles",
      defaultTucked: false,
      panel,
      tabStrip
    });

    expect(panel.hidden).toBe(false);
    expect(handle.tab.getAttribute("aria-expanded")).toBe("true");
    expect(handle.isTucked()).toBe(false);
  });

  it("contributes zero layout space when tucked (hidden attribute, not visibility)", () => {
    const { tabStrip, panel } = panelFixture("studio-menu-panel");
    const shell = createTuckShell({ storage: null, scope: "student" });
    shell.register({ id: "menu", edge: "top", tabLabel: "Menu", defaultTucked: true, panel, tabStrip });

    expect(panel.hasAttribute("hidden")).toBe(true);
    expect(getComputedStyle(panel).display).toBe("none");
  });

  it("toggles on tab click, moving focus into the panel and back to the tab", () => {
    const { tabStrip, panel } = panelFixture("studio-menu-panel", "Return to game");
    const shell = createTuckShell({ storage: null, scope: "student" });
    const handle = shell.register({
      id: "menu", edge: "top", tabLabel: "Menu", defaultTucked: true, panel, tabStrip
    });

    fireEvent.click(handle.tab);

    expect(panel.hidden).toBe(false);
    expect(handle.tab.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(getByRole(panel, "button", { name: "Return to game" }));

    fireEvent.click(handle.tab);

    expect(panel.hidden).toBe(true);
    expect(handle.tab.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(handle.tab);
  });

  it("tucks on Escape from inside the panel and returns focus to the tab", () => {
    const { tabStrip, panel } = panelFixture("studio-menu-panel");
    const shell = createTuckShell({ storage: null, scope: "student" });
    const handle = shell.register({
      id: "menu", edge: "top", tabLabel: "Menu", defaultTucked: false, panel, tabStrip
    });

    fireEvent.keyDown(panel, { key: "Escape" });

    expect(panel.hidden).toBe(true);
    expect(handle.tab.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(handle.tab);
  });

  it("falls back to focusing the panel itself when it has no focusable content", () => {
    const tabStrip = document.createElement("div");
    const panel = document.createElement("section");
    panel.id = "empty-panel";
    document.body.append(tabStrip, panel);
    const shell = createTuckShell({ storage: null, scope: "student" });
    const handle = shell.register({
      id: "empty", edge: "top", tabLabel: "Empty", defaultTucked: true, panel, tabStrip
    });

    handle.untuck();

    expect(panel.hidden).toBe(false);
    expect(document.activeElement).toBe(panel);
  });

  it("keeps at most one open panel per exclusivity group", () => {
    const menu = panelFixture("studio-menu-panel");
    const brief = panelFixture("studio-brief-panel");
    const shell = createTuckShell({ storage: null, scope: "student" });
    const menuHandle = shell.register({
      id: "menu", edge: "top", tabLabel: "Menu", defaultTucked: true,
      group: "top", panel: menu.panel, tabStrip: menu.tabStrip
    });
    const briefHandle = shell.register({
      id: "brief", edge: "top", tabLabel: "Brief & roles", defaultTucked: true,
      group: "top", panel: brief.panel, tabStrip: brief.tabStrip
    });

    fireEvent.click(menuHandle.tab);
    expect(menuHandle.isTucked()).toBe(false);
    expect(briefHandle.isTucked()).toBe(true);

    fireEvent.click(briefHandle.tab);
    expect(briefHandle.isTucked()).toBe(false);
    expect(menuHandle.isTucked()).toBe(true);
    expect(menuHandle.tab.getAttribute("aria-expanded")).toBe("false");
  });

  it("forces a newly registered panel tucked when another group member is already open", () => {
    const menu = panelFixture("studio-menu-panel");
    const brief = panelFixture("studio-brief-panel");
    const shell = createTuckShell({ storage: null, scope: "student" });
    shell.register({
      id: "menu", edge: "top", tabLabel: "Menu", defaultTucked: false,
      group: "top", panel: menu.panel, tabStrip: menu.tabStrip
    });

    const briefHandle = shell.register({
      id: "brief", edge: "top", tabLabel: "Brief & roles", defaultTucked: false,
      group: "top", panel: brief.panel, tabStrip: brief.tabStrip
    });

    expect(briefHandle.isTucked()).toBe(true);
  });

  it("does not let panels outside a group interfere with each other", () => {
    const menu = panelFixture("studio-menu-panel");
    const rail = panelFixture("studio-rail-panel");
    const shell = createTuckShell({ storage: null, scope: "student" });
    const menuHandle = shell.register({
      id: "menu", edge: "top", tabLabel: "Menu", defaultTucked: true,
      group: "top", panel: menu.panel, tabStrip: menu.tabStrip
    });
    const railHandle = shell.register({
      id: "rail", edge: "left", tabLabel: "Tools", defaultTucked: true,
      panel: rail.panel, tabStrip: rail.tabStrip
    });

    fireEvent.click(menuHandle.tab);
    fireEvent.click(railHandle.tab);

    expect(menuHandle.isTucked()).toBe(false);
    expect(railHandle.isTucked()).toBe(false);
  });

  it("persists user-driven toggles under a scope-specific storage key and restores them on the next boot", () => {
    const storage = memoryStorage();
    const first = panelFixture("studio-menu-panel");
    const shellA = createTuckShell({ storage, scope: "student" });
    const handleA = shellA.register({
      id: "menu", edge: "top", tabLabel: "Menu", defaultTucked: true, panel: first.panel, tabStrip: first.tabStrip
    });

    fireEvent.click(handleA.tab);
    expect(handleA.isTucked()).toBe(false);

    const stored = storage.getItem(TUCK_SHELL_STORAGE_KEYS.student);
    expect(stored).toContain('"menu":false');
    expect(readTuckedState(storage, "student")).toEqual({ menu: false });
    expect(storage.getItem(TUCK_SHELL_STORAGE_KEYS["teacher-playtest"])).toBeNull();

    document.body.innerHTML = "";
    const second = panelFixture("studio-menu-panel");
    const shellB = createTuckShell({ storage, scope: "student" });
    const handleB = shellB.register({
      id: "menu", edge: "top", tabLabel: "Menu", defaultTucked: true, panel: second.panel, tabStrip: second.tabStrip
    });

    expect(handleB.isTucked()).toBe(false);
  });

  it("does not persist programmatic tuck/untuck calls made outside the tab click", () => {
    const storage = memoryStorage();
    const { tabStrip, panel } = panelFixture("studio-brief-panel");
    const shell = createTuckShell({ storage, scope: "student" });
    const handle = shell.register({
      id: "brief", edge: "top", tabLabel: "Brief & roles", defaultTucked: true, panel, tabStrip
    });

    handle.untuck({ focus: false });

    expect(handle.isTucked()).toBe(false);
    expect(storage.getItem(TUCK_SHELL_STORAGE_KEYS.student)).toBeNull();
  });

  it("skips focus movement on programmatic tuck/untuck when focus is suppressed", () => {
    const outside = document.createElement("button");
    outside.type = "button";
    outside.textContent = "Tour dialog control";
    document.body.append(outside);
    outside.focus();
    const { tabStrip, panel } = panelFixture("studio-brief-panel");
    const shell = createTuckShell({ storage: null, scope: "student" });
    const handle = shell.register({
      id: "brief", edge: "top", tabLabel: "Brief & roles", defaultTucked: true, panel, tabStrip
    });

    handle.untuck({ focus: false });
    expect(handle.isTucked()).toBe(false);
    expect(document.activeElement).toBe(outside);

    handle.tuck({ focus: false });
    expect(handle.isTucked()).toBe(true);
    expect(document.activeElement).toBe(outside);
  });

  it("keeps separate storage per mode scope", () => {
    const storage = memoryStorage();
    const student = panelFixture("studio-menu-panel");
    const studentShell = createTuckShell({ storage, scope: "student" });
    const studentHandle = studentShell.register({
      id: "menu", edge: "top", tabLabel: "Menu", defaultTucked: true, panel: student.panel, tabStrip: student.tabStrip
    });
    fireEvent.click(studentHandle.tab);

    document.body.innerHTML = "";
    const teacher = panelFixture("studio-menu-panel");
    const teacherShell = createTuckShell({ storage, scope: "teacher-playtest" });
    const teacherHandle = teacherShell.register({
      id: "menu", edge: "top", tabLabel: "Menu", defaultTucked: true, panel: teacher.panel, tabStrip: teacher.tabStrip
    });

    expect(teacherHandle.isTucked()).toBe(true);
    expect(readTuckedState(storage, "teacher-playtest")).toEqual({});
  });

  it("ignores unreadable or malformed persisted state instead of throwing", () => {
    const brokenStorage: Storage = {
      getItem: vi.fn(() => { throw new Error("blocked"); }),
      setItem: vi.fn(() => { throw new Error("blocked"); }),
      removeItem: vi.fn(), clear: vi.fn(), key: vi.fn(), length: 0
    };
    expect(readTuckedState(brokenStorage, "student")).toEqual({});

    const malformed = memoryStorage();
    malformed.setItem(TUCK_SHELL_STORAGE_KEYS.student, '{"menu":"open"}');
    expect(readTuckedState(malformed, "student")).toEqual({});

    const { tabStrip, panel } = panelFixture("studio-menu-panel");
    expect(() => {
      const shell = createTuckShell({ storage: brokenStorage, scope: "student" });
      const handle = shell.register({
        id: "menu", edge: "top", tabLabel: "Menu", defaultTucked: true, panel, tabStrip
      });
      fireEvent.click(handle.tab);
    }).not.toThrow();
  });

  it("requires a panel id so the tab's aria-controls can target it", () => {
    const tabStrip = document.createElement("div");
    const panel = document.createElement("section");
    document.body.append(tabStrip, panel);
    const shell = createTuckShell({ storage: null, scope: "student" });

    expect(() => shell.register({
      id: "menu", edge: "top", tabLabel: "Menu", defaultTucked: true, panel, tabStrip
    })).toThrow();
  });

  it("rejects registering the same panel id twice", () => {
    const { tabStrip, panel } = panelFixture("studio-menu-panel");
    const other = document.createElement("section");
    other.id = "studio-other-panel";
    document.body.append(other);
    const shell = createTuckShell({ storage: null, scope: "student" });
    shell.register({ id: "menu", edge: "top", tabLabel: "Menu", defaultTucked: true, panel, tabStrip });

    expect(() => shell.register({
      id: "menu", edge: "top", tabLabel: "Menu again", defaultTucked: true, panel: other, tabStrip
    })).toThrow();
  });

  it("stops reacting once destroyed", () => {
    const { tabStrip, panel } = panelFixture("studio-menu-panel");
    const shell = createTuckShell({ storage: null, scope: "student" });
    const handle = shell.register({
      id: "menu", edge: "top", tabLabel: "Menu", defaultTucked: true, panel, tabStrip
    });

    shell.destroy();
    fireEvent.click(handle.tab);

    expect(panel.hidden).toBe(true);
  });

  it("marks the reduced-motion preference on the motion root using an injected reader", () => {
    const scratch = document.createElement("div");
    createTuckShell({ storage: null, scope: "student", reducedMotion: () => true, motionRoot: scratch });
    expect(scratch.dataset.tuckMotion).toBe("reduce");

    const scratch2 = document.createElement("div");
    createTuckShell({ storage: null, scope: "student", reducedMotion: () => false, motionRoot: scratch2 });
    expect(scratch2.dataset.tuckMotion).toBe("full");
  });
});

describe("prefersReducedMotion", () => {
  const original = (window as unknown as { AdMarketGameA11y?: unknown }).AdMarketGameA11y;

  afterEach(() => {
    (window as unknown as { AdMarketGameA11y?: unknown }).AdMarketGameA11y = original;
  });

  it("reuses the production AdMarketGameA11y bridge when it is present", () => {
    (window as unknown as { AdMarketGameA11y?: { reducedMotion(): boolean } }).AdMarketGameA11y = {
      reducedMotion: () => true
    };
    expect(prefersReducedMotion()).toBe(true);
  });

  it("falls back to matchMedia when the bridge is absent, as in the vite harness", () => {
    delete (window as unknown as { AdMarketGameA11y?: unknown }).AdMarketGameA11y;
    const originalMatchMedia = window.matchMedia;
    const matchMediaSpy = vi.fn().mockReturnValue({ matches: true } as MediaQueryList);
    window.matchMedia = matchMediaSpy;

    try {
      expect(prefersReducedMotion()).toBe(true);
      expect(matchMediaSpy).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("defaults to false when neither the bridge nor matchMedia is available", () => {
    delete (window as unknown as { AdMarketGameA11y?: unknown }).AdMarketGameA11y;
    const original2 = window.matchMedia;
    // @ts-expect-error -- simulate an environment without matchMedia
    delete window.matchMedia;
    try {
      expect(prefersReducedMotion()).toBe(false);
    } finally {
      window.matchMedia = original2;
    }
  });
});
