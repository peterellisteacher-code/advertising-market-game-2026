import { fireEvent, getByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CanvasMutationListener,
  CanvasObjectSummary,
  CanvasSelectionListener
} from "../fabric/canvas-port";
import {
  CanvasAccessibilityController,
  type CanvasAccessibilityAction
} from "./canvas-accessibility-controller";

class AccessibilityPort {
  summaries: CanvasObjectSummary[] = [{
    id: "shape-back",
    accessibleName: "Blue background",
    elementKind: "shape",
    x: 10,
    y: 20,
    scaleX: 1,
    scaleY: 1,
    visible: true,
    locked: false,
    stackIndex: 0
  }, {
    id: "text-front",
    accessibleName: "Sale heading",
    elementKind: "text",
    x: 50,
    y: 60,
    scaleX: 1,
    scaleY: 1,
    visible: true,
    locked: false,
    stackIndex: 1
  }];
  selectedId: string | null = "text-front";
  mutations = new Set<CanvasMutationListener>();
  selections = new Set<CanvasSelectionListener>();

  getSelectedObjectId(): string | null { return this.selectedId; }
  listObjectSummaries(): readonly CanvasObjectSummary[] { return this.summaries; }
  setSelected(id: string | null): void {
    this.selectedId = id;
    this.selections.forEach((listener) => listener({
      objectIds: id === null ? [] : [id]
    }));
  }
  subscribe(listener: CanvasMutationListener): () => void {
    this.mutations.add(listener);
    return () => this.mutations.delete(listener);
  }
  subscribeSelection(listener: CanvasSelectionListener): () => void {
    this.selections.add(listener);
    return () => this.selections.delete(listener);
  }
}

function mount() {
  const canvasRegion = document.createElement("main");
  canvasRegion.tabIndex = -1;
  const input = document.createElement("input");
  canvasRegion.append(input);
  const toggle = document.createElement("button");
  const deleteButton = document.createElement("button");
  deleteButton.textContent = "Delete selected item";
  const deleteStatus = document.createElement("span");
  const host = document.createElement("aside");
  document.body.append(toggle, deleteButton, deleteStatus, canvasRegion, host);
  const port = new AccessibilityPort();
  const actions: CanvasAccessibilityAction[] = [];
  const runAction = vi.fn(async (action: CanvasAccessibilityAction) => {
    actions.push(action);
    if (action.type === "remove") {
      port.summaries = port.summaries.filter(({ id }) => id !== action.id);
      if (port.selectedId === action.id) port.setSelected(null);
      port.mutations.forEach((listener) => listener({
        type: "removed",
        objectId: action.id
      }));
    }
  });
  const announce = vi.fn();
  const controller = new CanvasAccessibilityController({
    canvasRegion,
    host,
    toggle,
    deleteButton,
    deleteStatus,
    port,
    runAction,
    announce
  });
  return {
    canvasRegion,
    input,
    toggle,
    deleteButton,
    deleteStatus,
    host,
    port,
    actions,
    runAction,
    announce,
    controller
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("CanvasAccessibilityController", () => {
  it("opens a top-first semantic layer list and selects a layer", () => {
    const harness = mount();
    expect(harness.host.hidden).toBe(true);
    expect(harness.host.hasAttribute("inert")).toBe(true);

    fireEvent.click(harness.toggle);

    expect(harness.host.hasAttribute("inert")).toBe(false);
    expect(harness.toggle.getAttribute("aria-expanded")).toBe("true");
    expect(harness.toggle.getAttribute("aria-label")).toBe("Close item list");
    expect([...harness.host.querySelectorAll(".creator__layer-name")].map((node) => node.textContent))
      .toEqual(["Sale heading", "Blue background"]);
    fireEvent.click(getByRole(harness.host, "button", { name: "Select Blue background" }));
    expect(harness.port.selectedId).toBe("shape-back");
    expect(harness.announce).toHaveBeenCalledWith("Blue background selected.", "polite");
    harness.controller.destroy();
  });

  it("makes the closed item list non-interactive and restores the opener", () => {
    const harness = mount();
    fireEvent.click(harness.toggle);
    expect(harness.host.hidden).toBe(false);
    expect(harness.host.hasAttribute("inert")).toBe(false);

    fireEvent.click(harness.toggle);

    expect(harness.host.hidden).toBe(true);
    expect(harness.host.hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(harness.toggle);
    harness.controller.destroy();
  });

  it("marks exactly the current Fabric selection and clears the mark on deselection", () => {
    const harness = mount();
    fireEvent.click(harness.toggle);

    const selectedIds = () => [...harness.host.querySelectorAll<HTMLElement>(
      "li[data-selected]"
    )].map((node) => node.dataset.objectId);

    expect(selectedIds()).toEqual(["text-front"]);
    harness.port.setSelected("shape-back");
    expect(selectedIds()).toEqual(["shape-back"]);
    expect(getByRole(harness.host, "button", {
      name: "Select Blue background"
    }).getAttribute("aria-pressed")).toBe("true");

    harness.port.setSelected(null);
    expect(selectedIds()).toEqual([]);
    expect(harness.host.textContent).toContain("No layer selected");
    harness.controller.destroy();
  });

  it.each([
    ["ArrowLeft", false, { type: "nudge", id: "text-front", dx: -5, dy: 0 }],
    ["ArrowDown", true, { type: "nudge", id: "text-front", dx: 0, dy: 25 }],
    ["+", false, { type: "resize", id: "text-front", factor: 1.1 }],
    ["-", false, { type: "resize", id: "text-front", factor: 1 / 1.1 }],
    ["]", false, { type: "move", id: "text-front", direction: "forward" }],
    ["]", true, { type: "move", id: "text-front", direction: "front" }],
    ["[", false, { type: "move", id: "text-front", direction: "backward" }],
    ["[", true, { type: "move", id: "text-front", direction: "back" }],
    ["h", false, { type: "set-hidden", id: "text-front", hidden: true }],
    ["l", false, { type: "set-locked", id: "text-front", locked: true }],
    ["Delete", false, { type: "remove", id: "text-front" }]
  ])("maps %s with shift=%s to one history-ready action", async (key, shiftKey, expected) => {
    const harness = mount();

    fireEvent.keyDown(harness.canvasRegion, { key, shiftKey });
    await vi.waitFor(() => expect(harness.runAction).toHaveBeenCalledOnce());

    expect(harness.actions[0]).toEqual(expected);
    harness.controller.destroy();
  });

  it("does not intercept editing keys inside form controls", () => {
    const harness = mount();

    fireEvent.keyDown(harness.input, { key: "Backspace" });
    fireEvent.keyDown(harness.input, { key: "ArrowLeft" });

    expect(harness.runAction).not.toHaveBeenCalled();
    harness.controller.destroy();
  });

  it("keeps the visible delete action disabled until a removable item is selected", () => {
    const harness = mount();

    expect(harness.deleteButton.disabled).toBe(false);
    expect(harness.deleteButton.getAttribute("aria-description"))
      .toBe("Delete Sale heading from the ad.");
    expect(harness.deleteStatus.textContent).toBe("Delete Sale heading from the ad.");

    harness.port.setSelected(null);

    expect(harness.deleteButton.disabled).toBe(true);
    expect(harness.deleteStatus.textContent).toBe("Select an item to delete");
    harness.controller.destroy();
  });

  it.each(["Enter", " "])(
    "deletes the selected item through the visible action with %j and refreshes layers",
    async (key) => {
      const harness = mount();
      fireEvent.click(harness.toggle);

      fireEvent.keyDown(harness.deleteButton, { key });
      await vi.waitFor(() => expect(harness.runAction).toHaveBeenCalledOnce());

      expect(harness.actions).toEqual([{ type: "remove", id: "text-front" }]);
      expect(harness.host.textContent).not.toContain("Sale heading");
      expect(harness.deleteButton.disabled).toBe(true);
      expect(harness.deleteStatus.textContent).toBe("Select an item to delete");
      expect(harness.announce).toHaveBeenCalledWith("Sale heading deleted.", "polite");
      harness.controller.destroy();
    }
  );

  it("explains why a structural product shell cannot be deleted", () => {
    const harness = mount();
    harness.port.summaries = [{
      ...harness.port.summaries[0]!,
      id: "required-product",
      accessibleName: "Campaign product",
      elementKind: "product-shell"
    }];
    harness.port.setSelected("required-product");
    fireEvent.click(harness.toggle);

    expect(harness.deleteButton.disabled).toBe(true);
    expect(harness.deleteStatus.textContent)
      .toBe("This product shell is required and cannot be deleted.");
    const layerDelete = getByRole<HTMLButtonElement>(
      harness.host,
      "button",
      { name: "Delete Campaign product" }
    );
    expect(layerDelete.disabled).toBe(true);
    expect(layerDelete.title)
      .toBe("This product shell is required and cannot be deleted.");

    fireEvent.keyDown(harness.canvasRegion, { key: "Delete" });
    expect(harness.runAction).not.toHaveBeenCalled();
    expect(harness.announce).toHaveBeenCalledWith(
      "This product shell is required and cannot be deleted.",
      "polite"
    );
    harness.controller.destroy();
  });

  it("offers keyboard-operable show, unlock, reorder and delete controls", async () => {
    const harness = mount();
    harness.port.summaries[0] = {
      ...harness.port.summaries[0]!,
      visible: false,
      locked: true
    };
    fireEvent.click(harness.toggle);

    fireEvent.click(getByRole(harness.host, "button", { name: "Show Blue background" }));
    await vi.waitFor(() => expect(harness.runAction).toHaveBeenCalledOnce());
    fireEvent.click(getByRole(harness.host, "button", { name: "Unlock Blue background" }));
    await vi.waitFor(() => expect(harness.runAction).toHaveBeenCalledTimes(2));
    fireEvent.click(getByRole(harness.host, "button", { name: "Move Blue background forward" }));
    await vi.waitFor(() => expect(harness.runAction).toHaveBeenCalledTimes(3));
    fireEvent.click(getByRole(harness.host, "button", { name: "Delete Blue background" }));
    await vi.waitFor(() => expect(harness.runAction).toHaveBeenCalledTimes(4));

    expect(harness.actions).toEqual([
      { type: "set-hidden", id: "shape-back", hidden: false },
      { type: "set-locked", id: "shape-back", locked: false },
      { type: "move", id: "shape-back", direction: "forward" },
      { type: "remove", id: "shape-back" }
    ]);
    expect(harness.host.textContent).not.toContain("Blue background");
    harness.controller.destroy();
  });
});
