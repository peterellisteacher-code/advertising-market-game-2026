import { fireEvent } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import { StudioSplitPane } from "./studio-split-pane";

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
    expect(elements.separator.tabIndex).toBe(0);
    pane.setPercent(61);
    expect(elements.separator.getAttribute("aria-valuenow")).toBe("61");
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

    pane.destroy();
    fireEvent.keyDown(elements.separator, { key: "End" });
    elements.separator.dispatchEvent(pointerEvent("pointerdown", {
      clientX: 800,
      pointerId: 22
    }));
    elements.narrow.setMatches(true);
    edit.click();

    expect(pane.getPercent()).toBe(40);
    expect(elements.setPointerCapture).not.toHaveBeenCalled();
    expect(elements.root.dataset.studioNarrow).toBeUndefined();
    expect(elements.browsePane.hidden).toBe(false);
    expect(elements.designPane.hidden).toBe(false);
  });
});
