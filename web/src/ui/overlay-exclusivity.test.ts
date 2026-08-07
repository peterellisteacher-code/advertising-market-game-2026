import { describe, expect, it, vi } from "vitest";
import { createOverlayExclusivity } from "./overlay-exclusivity";

function member(id: string, open: boolean) {
  return {
    id,
    isOpen: vi.fn(() => open),
    close: vi.fn()
  };
}

describe("createOverlayExclusivity", () => {
  it("closes every other open member when one reports it opened", () => {
    const exclusivity = createOverlayExclusivity();
    const layers = member("layers", true);
    const inspector = member("inspector", true);
    const sectionFill = member("section-fill", false);
    const display = member("display", false);
    exclusivity.register(layers);
    exclusivity.register(inspector);
    exclusivity.register(sectionFill);
    exclusivity.register(display);

    exclusivity.notifyOpened("inspector");

    expect(layers.close).toHaveBeenCalledTimes(1);
    expect(inspector.close).not.toHaveBeenCalled();
    expect(sectionFill.close).not.toHaveBeenCalled();
    expect(display.close).not.toHaveBeenCalled();
  });

  it("does not call close on members that are already shut", () => {
    const exclusivity = createOverlayExclusivity();
    const layers = member("layers", false);
    const display = member("display", true);
    exclusivity.register(layers);
    exclusivity.register(display);

    exclusivity.notifyOpened("display");

    expect(layers.close).not.toHaveBeenCalled();
  });

  it("supports opening and closing in sequence across all four members", () => {
    const exclusivity = createOverlayExclusivity();
    const states = { layers: false, inspector: false, sectionFill: false, display: false };
    const layers = { id: "layers", isOpen: () => states.layers, close: vi.fn(() => { states.layers = false; }) };
    const inspector = {
      id: "inspector", isOpen: () => states.inspector, close: vi.fn(() => { states.inspector = false; })
    };
    const sectionFill = {
      id: "section-fill", isOpen: () => states.sectionFill, close: vi.fn(() => { states.sectionFill = false; })
    };
    const display = { id: "display", isOpen: () => states.display, close: vi.fn(() => { states.display = false; }) };
    exclusivity.register(layers);
    exclusivity.register(inspector);
    exclusivity.register(sectionFill);
    exclusivity.register(display);

    states.layers = true;
    exclusivity.notifyOpened("layers");
    expect(inspector.close).not.toHaveBeenCalled();

    states.inspector = true;
    exclusivity.notifyOpened("inspector");
    expect(layers.close).toHaveBeenCalledTimes(1);
    expect(states.layers).toBe(false);

    states.sectionFill = true;
    exclusivity.notifyOpened("section-fill");
    expect(inspector.close).toHaveBeenCalledTimes(1);
    expect(display.close).not.toHaveBeenCalled();
  });

  it("does nothing when notified about an id with no registered member", () => {
    const exclusivity = createOverlayExclusivity();
    const layers = member("layers", true);
    exclusivity.register(layers);

    expect(() => exclusivity.notifyOpened("unknown")).not.toThrow();
    expect(layers.close).toHaveBeenCalledTimes(1);
  });
});
