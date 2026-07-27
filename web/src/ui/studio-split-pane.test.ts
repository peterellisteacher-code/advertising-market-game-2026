import { fireEvent } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import {
  STUDENT_STUDIO_SPLIT_STORAGE_KEY,
  StudioSplitPane,
  TEACHER_PLAYTEST_STUDIO_SPLIT_STORAGE_KEY
} from "./studio-split-pane";

class TestMediaQueryList extends EventTarget implements MediaQueryList {
  matches = false;
  readonly media = "(max-width: 900px)";
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null = null;

  setMatches(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event("change"));
  }

  addListener(callback: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null): void {
    if (callback) this.addEventListener("change", callback as EventListener);
  }

  removeListener(callback: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null): void {
    if (callback) this.removeEventListener("change", callback as EventListener);
  }

  dispatchEvent(event: Event): boolean {
    const result = super.dispatchEvent(event);
    if (event.type === "change" && this.onchange) {
      this.onchange.call(this, event as MediaQueryListEvent);
    }
    return result;
  }
}

function pointerEvent(
  type: string,
  values: { readonly clientX: number; readonly button?: number; readonly pointerId?: number }
): PointerEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: values.button ?? 0,
    clientX: values.clientX
  });
  Object.defineProperty(event, "pointerId", {
    configurable: true,
    value: values.pointerId ?? 17
  });
  return event as PointerEvent;
}

function fixture(narrow = new TestMediaQueryList()) {
  document.body.innerHTML = `
    <section data-workspace>
      <nav data-studio-pane-tabs role="tablist" aria-label="Studio areas" hidden>
        <button type="button" role="tab" data-studio-pane-tab="browse">Browse</button>
        <button type="button" role="tab" data-studio-pane-tab="edit">Edit</button>
      </nav>
      <aside id="studio-browse-pane"></aside>
      <div data-studio-separator></div>
      <p id="studio-split-hint" data-studio-split-hint>
        Use Left Arrow or Right Arrow to resize. Hold Shift for a larger change.
        Home and End set the limits. Press R or double-click to reset.
      </p>
      <main id="studio-edit-pane"></main>
    </section>`;
  const root = document.querySelector<HTMLElement>("[data-workspace]")!;
  const browsePane = document.querySelector<HTMLElement>("#studio-browse-pane")!;
  const designPane = document.querySelector<HTMLElement>("#studio-edit-pane")!;
  const separator = document.querySelector<HTMLElement>("[data-studio-separator]")!;
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
    x: 100,
    y: 0,
    top: 0,
    left: 100,
    right: 1100,
    bottom: 600,
    width: 1000,
    height: 600,
    toJSON: () => ({})
  });
  vi.spyOn(browsePane, "getBoundingClientRect").mockReturnValue({
    x: 164,
    y: 0,
    top: 0,
    left: 164,
    right: 534.4,
    bottom: 600,
    width: 370.4,
    height: 600,
    toJSON: () => ({})
  });
  vi.spyOn(separator, "getBoundingClientRect").mockReturnValue({
    x: 534.4,
    y: 0,
    top: 0,
    left: 534.4,
    right: 544.4,
    bottom: 600,
    width: 10,
    height: 600,
    toJSON: () => ({})
  });
  const setPointerCapture = vi.fn();
  const releasePointerCapture = vi.fn();
  separator.setPointerCapture = setPointerCapture;
  separator.releasePointerCapture = releasePointerCapture;
  return {
    root,
    browsePane,
    designPane,
    separator,
    narrow,
    setPointerCapture,
    releasePointerCapture
  };
}

describe("StudioSplitPane", () => {
  it("reserves separate device preference keys for students and teacher playtest", () => {
    expect(STUDENT_STUDIO_SPLIT_STORAGE_KEY)
      .toBe("admarket:studio-split:student:v1");
    expect(TEACHER_PLAYTEST_STUDIO_SPLIT_STORAGE_KEY)
      .toBe("admarket:studio-split:teacher-playtest:v1");
    expect(STUDENT_STUDIO_SPLIT_STORAGE_KEY)
      .not.toBe(TEACHER_PLAYTEST_STUDIO_SPLIT_STORAGE_KEY);
  });

  it("defaults to 40 percent and clamps programmatic changes to 25 through 75", () => {
    const elements = fixture();
    const pane = new StudioSplitPane({ ...elements, narrowQuery: elements.narrow });

    expect(pane.getPercent()).toBe(40);
    expect(elements.root.style.getPropertyValue("--studio-browse-percent")).toBe("40%");
    expect(elements.root.style.getPropertyValue("--studio-browse-width")).toBe("0.666667fr");
    pane.setPercent(12);
    expect(pane.getPercent()).toBe(25);
    expect(elements.root.style.getPropertyValue("--studio-browse-width")).toBe("0.333333fr");
    pane.setPercent(88);
    expect(pane.getPercent()).toBe(75);
    expect(elements.root.style.getPropertyValue("--studio-browse-width")).toBe("3fr");
    pane.setPercent(Number.NaN);
    expect(pane.getPercent()).toBe(75);
  });

  it("uses workspace-relative pointer movement and releases pointer capture", () => {
    const elements = fixture();
    const pane = new StudioSplitPane({ ...elements, narrowQuery: elements.narrow });

    elements.separator.dispatchEvent(pointerEvent("pointerdown", {
      clientX: 500,
      pointerId: 9
    }));
    expect(elements.setPointerCapture).toHaveBeenCalledWith(9);
    window.dispatchEvent(pointerEvent("pointermove", { clientX: 632, pointerId: 9 }));
    expect(pane.getPercent()).toBeCloseTo(50, 1);
    window.dispatchEvent(pointerEvent("pointermove", { clientX: 864, pointerId: 9 }));
    expect(pane.getPercent()).toBe(75);
    window.dispatchEvent(pointerEvent("pointermove", { clientX: 350, pointerId: 9 }));
    expect(pane.getPercent()).toBe(25);
    window.dispatchEvent(pointerEvent("pointerup", { clientX: 350, pointerId: 9 }));
    expect(elements.releasePointerCapture).toHaveBeenCalledWith(9);
    window.dispatchEvent(pointerEvent("pointermove", { clientX: 700, pointerId: 9 }));
    expect(pane.getPercent()).toBe(25);

    elements.separator.dispatchEvent(pointerEvent("pointerdown", {
      clientX: 600,
      button: 1,
      pointerId: 10
    }));
    expect(elements.setPointerCapture).not.toHaveBeenCalledWith(10);
  });

  it("releases the active pointer on cancellation", () => {
    const elements = fixture();
    const pane = new StudioSplitPane({ ...elements, narrowQuery: elements.narrow });

    elements.separator.dispatchEvent(pointerEvent("pointerdown", {
      clientX: 600,
      pointerId: 11
    }));
    window.dispatchEvent(pointerEvent("pointercancel", { clientX: 600, pointerId: 11 }));

    expect(elements.releasePointerCapture).toHaveBeenCalledWith(11);
    expect(pane.getPercent()).toBe(40);
  });

  it("supports Arrow, Shift+Arrow, Home and End from the separator", () => {
    const elements = fixture();
    const pane = new StudioSplitPane({ ...elements, narrowQuery: elements.narrow });

    fireEvent.keyDown(elements.separator, { key: "ArrowRight" });
    expect(pane.getPercent()).toBe(42);
    fireEvent.keyDown(elements.separator, { key: "ArrowLeft", shiftKey: true });
    expect(pane.getPercent()).toBe(32);
    fireEvent.keyDown(elements.separator, { key: "End" });
    expect(pane.getPercent()).toBe(75);
    fireEvent.keyDown(elements.separator, { key: "Home" });
    expect(pane.getPercent()).toBe(25);
  });

  it("restores and persists a device preference and resets it to the default", () => {
    const elements = fixture();
    const values = new Map([["admarket:studio-split:test:v1", "63"]]);
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
      removeItem: vi.fn((key: string) => { values.delete(key); })
    };
    const pane = new StudioSplitPane({
      ...elements,
      narrowQuery: elements.narrow,
      storage,
      storageKey: "admarket:studio-split:test:v1"
    });

    expect(pane.getPercent()).toBe(63);
    pane.setPercent(68);
    expect(storage.setItem).toHaveBeenLastCalledWith(
      "admarket:studio-split:test:v1",
      "68"
    );
    fireEvent.keyDown(elements.separator, { key: "r" });
    expect(pane.getPercent()).toBe(40);
    expect(storage.removeItem).toHaveBeenCalledWith("admarket:studio-split:test:v1");
    expect(values.has("admarket:studio-split:test:v1")).toBe(false);

    pane.setPercent(54);
    fireEvent.dblClick(elements.separator);
    expect(pane.getPercent()).toBe(40);
    expect(values.has("admarket:studio-split:test:v1")).toBe(false);
  });

  it("ignores invalid or inaccessible stored preferences", () => {
    const elements = fixture();
    const storage = {
      getItem: vi.fn(() => { throw new Error("storage unavailable"); }),
      setItem: vi.fn(() => { throw new Error("storage unavailable"); }),
      removeItem: vi.fn(() => { throw new Error("storage unavailable"); })
    };
    const pane = new StudioSplitPane({
      ...elements,
      narrowQuery: elements.narrow,
      storage,
      storageKey: "admarket:studio-split:test:v1"
    });

    expect(pane.getPercent()).toBe(40);
    expect(() => pane.setPercent(57)).not.toThrow();
    expect(pane.getPercent()).toBe(57);
    expect(() => pane.reset()).not.toThrow();
    expect(pane.getPercent()).toBe(40);
  });

  it("sets the complete accessible separator contract", () => {
    const elements = fixture();
    const pane = new StudioSplitPane({ ...elements, narrowQuery: elements.narrow });

    expect(elements.separator.getAttribute("role")).toBe("separator");
    expect(elements.separator.getAttribute("aria-label"))
      .toBe("Resize the library and design areas");
    expect(elements.separator.getAttribute("aria-orientation")).toBe("vertical");
    expect(elements.separator.getAttribute("aria-valuemin")).toBe("25");
    expect(elements.separator.getAttribute("aria-valuemax")).toBe("75");
    expect(elements.separator.getAttribute("aria-valuenow")).toBe("40");
    expect(elements.separator.getAttribute("aria-valuetext"))
      .toBe("40 percent library, 60 percent design");
    expect(elements.separator.getAttribute("aria-describedby")).toBe("studio-split-hint");
    expect(document.querySelector("[data-studio-split-hint]")?.textContent)
      .toMatch(/Left Arrow.*Right Arrow.*Shift.*Home.*End.*Press R.*double-click/s);
    expect(elements.separator.tabIndex).toBe(0);
    pane.setPercent(61);
    expect(elements.separator.getAttribute("aria-valuenow")).toBe("61");
    expect(elements.separator.getAttribute("aria-valuetext"))
      .toBe("61 percent library, 39 percent design");
  });

  it("uses Browse and Edit tabs in narrow mode and removes the separator from tab order", () => {
    const elements = fixture();
    const pane = new StudioSplitPane({ ...elements, narrowQuery: elements.narrow });
    const tabs = elements.root.querySelector<HTMLElement>("[data-studio-pane-tabs]")!;
    const browse = elements.root.querySelector<HTMLButtonElement>('[data-studio-pane-tab="browse"]')!;
    const edit = elements.root.querySelector<HTMLButtonElement>('[data-studio-pane-tab="edit"]')!;

    elements.narrow.setMatches(true);
    expect(tabs.hidden).toBe(false);
    expect(elements.separator.tabIndex).toBe(-1);
    expect(browse.getAttribute("aria-selected")).toBe("true");
    expect(edit.getAttribute("aria-selected")).toBe("false");
    expect(elements.browsePane.hidden).toBe(false);
    expect(elements.designPane.hidden).toBe(true);

    edit.click();
    expect(browse.getAttribute("aria-selected")).toBe("false");
    expect(edit.getAttribute("aria-selected")).toBe("true");
    expect(elements.browsePane.hidden).toBe(true);
    expect(elements.designPane.hidden).toBe(false);

    pane.selectNarrowPane("browse");
    expect(elements.browsePane.hidden).toBe(false);
    expect(elements.designPane.hidden).toBe(true);

    elements.narrow.setMatches(false);
    expect(tabs.hidden).toBe(true);
    expect(elements.separator.tabIndex).toBe(0);
    expect(elements.browsePane.hidden).toBe(false);
    expect(elements.designPane.hidden).toBe(false);
  });

  it("destroy removes pointer, keyboard, media-query and tab listeners", () => {
    const elements = fixture();
    const pane = new StudioSplitPane({ ...elements, narrowQuery: elements.narrow });
    const edit = elements.root.querySelector<HTMLButtonElement>('[data-studio-pane-tab="edit"]')!;

    pane.setPercent(54);
    pane.destroy();
    fireEvent.keyDown(elements.separator, { key: "End" });
    elements.separator.dispatchEvent(pointerEvent("pointerdown", {
      clientX: 800,
      pointerId: 22
    }));
    elements.narrow.setMatches(true);
    edit.click();

    expect(pane.getPercent()).toBe(54);
    expect(elements.setPointerCapture).not.toHaveBeenCalled();
    expect(elements.root.dataset.studioNarrow).toBeUndefined();
    expect(elements.browsePane.hidden).toBe(false);
    expect(elements.designPane.hidden).toBe(false);
    fireEvent.dblClick(elements.separator);
    expect(pane.getPercent()).toBe(54);
  });
});
