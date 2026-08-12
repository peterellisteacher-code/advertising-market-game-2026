import type {
  CanvasMutationListener,
  CanvasObjectSummary,
  CanvasPort,
  CanvasSelectionListener,
  StackDirection
} from "../fabric/canvas-port";
import { canvasRemovalState } from "../fabric/object-command-service";

export type CanvasAccessibilityAction =
  | { readonly type: "nudge"; readonly id: string; readonly dx: number; readonly dy: number }
  | { readonly type: "resize"; readonly id: string; readonly factor: number }
  | { readonly type: "move"; readonly id: string; readonly direction: StackDirection }
  | { readonly type: "set-hidden"; readonly id: string; readonly hidden: boolean }
  | { readonly type: "set-locked"; readonly id: string; readonly locked: boolean }
  | { readonly type: "remove"; readonly id: string };

type CanvasAccessibilityPort = Pick<
  CanvasPort,
  | "getSelectedObjectId"
  | "listObjectSummaries"
  | "setSelected"
  | "subscribe"
  | "subscribeSelection"
>;

export interface CanvasAccessibilityControllerOptions {
  readonly canvasRegion: HTMLElement;
  readonly host: HTMLElement;
  readonly toggle: HTMLButtonElement;
  readonly deleteButton: HTMLButtonElement;
  readonly deleteStatus: HTMLElement;
  readonly port: CanvasAccessibilityPort;
  readonly runAction: (action: CanvasAccessibilityAction) => Promise<void>;
  readonly deleteSelected?: () => Promise<void>;
  readonly announce?: (message: string, priority: "polite" | "assertive") => void;
  readonly onOpenChange?: (open: boolean) => void;
}

const interactiveTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches("input, textarea, select, button, [contenteditable='true']") ||
    target.closest("input, textarea, select, button, [contenteditable='true']") !== null;
};

const kindLabel = (kind: CanvasObjectSummary["elementKind"]): string =>
  kind.replaceAll("-", " ");

export class CanvasAccessibilityController {
  readonly #canvasRegion: HTMLElement;
  readonly #host: HTMLElement;
  readonly #toggle: HTMLButtonElement;
  readonly #deleteButton: HTMLButtonElement;
  readonly #deleteStatus: HTMLElement;
  readonly #port: CanvasAccessibilityPort;
  readonly #runAction: CanvasAccessibilityControllerOptions["runAction"];
  readonly #runDeleteSelected: () => Promise<void>;
  readonly #announce: NonNullable<CanvasAccessibilityControllerOptions["announce"]>;
  readonly #onOpenChange: NonNullable<CanvasAccessibilityControllerOptions["onOpenChange"]>;
  readonly #unsubscribeMutation: () => void;
  readonly #unsubscribeSelection: () => void;
  #open = false;
  #busy = false;

  readonly #onToggle = (): void => {
    this.#open = !this.#open;
    this.#syncVisibility();
    this.#render();
    if (this.#open) {
      this.#host.querySelector<HTMLElement>("[data-layer-select]")?.focus({ preventScroll: true });
    } else {
      this.#toggle.focus({ preventScroll: true });
    }
  };

  readonly #onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey ||
      interactiveTarget(event.target)) return;
    const id = this.#port.getSelectedObjectId();
    if (id === null) return;
    const distance = event.shiftKey ? 25 : 5;
    const key = event.key.toLowerCase();
    let action: CanvasAccessibilityAction | null = null;
    if (key === "arrowleft") action = { type: "nudge", id, dx: -distance, dy: 0 };
    else if (key === "arrowright") action = { type: "nudge", id, dx: distance, dy: 0 };
    else if (key === "arrowup") action = { type: "nudge", id, dx: 0, dy: -distance };
    else if (key === "arrowdown") action = { type: "nudge", id, dx: 0, dy: distance };
    else if (key === "+" || key === "=") action = { type: "resize", id, factor: 1.1 };
    else if (key === "-" || key === "_") action = { type: "resize", id, factor: 1 / 1.1 };
    else if (key === "]") {
      action = { type: "move", id, direction: event.shiftKey ? "front" : "forward" };
    } else if (key === "[") {
      action = { type: "move", id, direction: event.shiftKey ? "back" : "backward" };
    } else if (key === "h") action = { type: "set-hidden", id, hidden: true };
    else if (key === "l") action = { type: "set-locked", id, locked: true };
    else if (key === "delete" || key === "backspace") {
      event.preventDefault();
      const removal = canvasRemovalState(id, this.#port.listObjectSummaries());
      if (!removal.removable) {
        this.#announce(removal.reason, "polite");
        return;
      }
      void this.#perform({ type: "remove", id });
      return;
    }
    else if (key === "escape") {
      event.preventDefault();
      this.#port.setSelected(null);
      this.#announce("Advertisement selection cleared.", "polite");
      return;
    }
    if (action === null) return;
    event.preventDefault();
    void this.#perform(action);
  };

  readonly #onDeleteClick = (): void => {
    void this.#deleteSelected();
  };

  readonly #onDeleteKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    void this.#deleteSelected();
  };

  constructor(options: CanvasAccessibilityControllerOptions) {
    this.#canvasRegion = options.canvasRegion;
    this.#host = options.host;
    this.#toggle = options.toggle;
    this.#deleteButton = options.deleteButton;
    this.#deleteStatus = options.deleteStatus;
    this.#port = options.port;
    this.#runAction = options.runAction;
    this.#runDeleteSelected = options.deleteSelected ?? (() => {
      const id = this.#port.getSelectedObjectId();
      if (id === null) return Promise.reject(new Error("Select an item to delete"));
      return this.#runAction({ type: "remove", id });
    });
    this.#announce = options.announce ?? (() => undefined);
    this.#onOpenChange = options.onOpenChange ?? (() => undefined);
    if (!this.#host.id) this.#host.id = "canvas-layers-panel";
    this.#toggle.setAttribute("aria-controls", this.#host.id);
    this.#toggle.setAttribute("aria-expanded", "false");
    this.#toggle.addEventListener("click", this.#onToggle);
    this.#deleteButton.addEventListener("click", this.#onDeleteClick);
    this.#deleteButton.addEventListener("keydown", this.#onDeleteKeyDown);
    this.#canvasRegion.addEventListener("keydown", this.#onKeyDown);
    const rerender: CanvasMutationListener = () => this.#render();
    const selectionChanged: CanvasSelectionListener = () => this.#render();
    this.#unsubscribeMutation = this.#port.subscribe(rerender);
    this.#unsubscribeSelection = this.#port.subscribeSelection(selectionChanged);
    this.#syncVisibility();
    this.#render();
  }

  destroy(): void {
    this.#toggle.removeEventListener("click", this.#onToggle);
    this.#deleteButton.removeEventListener("click", this.#onDeleteClick);
    this.#deleteButton.removeEventListener("keydown", this.#onDeleteKeyDown);
    this.#canvasRegion.removeEventListener("keydown", this.#onKeyDown);
    this.#unsubscribeMutation();
    this.#unsubscribeSelection();
    this.#host.replaceChildren();
    this.#host.hidden = true;
    this.#host.toggleAttribute("inert", true);
  }

  isOpen(): boolean {
    return this.#open;
  }

  /** Closes the panel without moving focus, for callers other than the toggle button itself. */
  close(): void {
    if (!this.#open) return;
    this.#open = false;
    this.#syncVisibility();
    this.#render();
  }

  #syncVisibility(): void {
    this.#host.hidden = !this.#open;
    this.#host.toggleAttribute("inert", !this.#open);
    this.#toggle.setAttribute("aria-expanded", String(this.#open));
    this.#toggle.setAttribute(
      "aria-label",
      this.#open ? "Close item list" : "Open item list"
    );
    this.#toggle.textContent = this.#open ? "Close items" : "Items";
    this.#onOpenChange(this.#open);
  }

  #render(): void {
    const focus = document.activeElement instanceof HTMLElement &&
      this.#host.contains(document.activeElement)
      ? {
          objectId: document.activeElement.dataset.objectId,
          action: document.activeElement.dataset.layerAction
        }
      : null;
    const summaries = [...this.#port.listObjectSummaries()]
      .sort((left, right) => right.stackIndex - left.stackIndex);
    const selectedId = this.#port.getSelectedObjectId();
    this.#renderDeleteState(selectedId, summaries);
    const heading = document.createElement("h2");
    heading.textContent = "Item list";
    const help = document.createElement("p");
    help.className = "creator__layers-help";
    help.textContent = "Choose a layer. Arrow keys move a selected item by 5 pixels; hold Shift for 25.";
    const list = document.createElement("ol");
    list.className = "creator__layer-list";
    if (summaries.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "No items are on the ad yet.";
      this.#host.replaceChildren(heading, help, empty);
      return;
    }
    for (const summary of summaries) {
      const item = document.createElement("li");
      item.dataset.objectId = summary.id;
      if (summary.id === selectedId) item.dataset.selected = "";
      const select = this.#button(
        `Select ${summary.accessibleName}`,
        summary.id,
        "select",
        () => {
          this.#port.setSelected(summary.id);
          this.#announce(`${summary.accessibleName} selected.`, "polite");
        }
      );
      select.dataset.layerSelect = "";
      select.setAttribute("aria-pressed", String(summary.id === selectedId));
      select.disabled = !summary.visible;
      const name = document.createElement("span");
      name.className = "creator__layer-name";
      name.textContent = summary.accessibleName;
      const status = document.createElement("span");
      status.className = "creator__layer-status";
      status.textContent = [
        kindLabel(summary.elementKind),
        summary.visible ? "visible" : "hidden",
        summary.locked ? "locked" : "unlocked"
      ].join(" · ");
      const actions = document.createElement("div");
      actions.className = "creator__layer-actions";
      const removal = canvasRemovalState(summary.id, summaries);
      const deleteButton = this.#button(
        `Delete ${summary.accessibleName}`,
        summary.id,
        "remove",
        () => this.#perform({ type: "remove", id: summary.id })
      );
      deleteButton.disabled = !removal.removable;
      deleteButton.title = removal.reason;
      deleteButton.setAttribute("aria-description", removal.reason);
      actions.append(
        this.#button(
          summary.visible ? `Hide ${summary.accessibleName}` : `Show ${summary.accessibleName}`,
          summary.id,
          "visibility",
          () => this.#perform({
            type: "set-hidden",
            id: summary.id,
            hidden: summary.visible
          })
        ),
        this.#button(
          summary.locked ? `Unlock ${summary.accessibleName}` : `Lock ${summary.accessibleName}`,
          summary.id,
          "lock",
          () => this.#perform({
            type: "set-locked",
            id: summary.id,
            locked: !summary.locked
          })
        ),
        this.#button(
          `Move ${summary.accessibleName} forward`,
          summary.id,
          "forward",
          () => this.#perform({ type: "move", id: summary.id, direction: "forward" })
        ),
        this.#button(
          `Move ${summary.accessibleName} backward`,
          summary.id,
          "backward",
          () => this.#perform({ type: "move", id: summary.id, direction: "backward" })
        ),
        deleteButton
      );
      item.append(select, name, status, actions);
      list.append(item);
    }
    const selected = summaries.find(({ id }) => id === selectedId);
    const inspector = document.createElement("section");
    inspector.className = "creator__keyboard-inspector";
    inspector.setAttribute("aria-label", "Selected layer controls");
    const inspectorHeading = document.createElement("h3");
    inspectorHeading.textContent = selected
      ? `Selected: ${selected.accessibleName}`
      : "No layer selected";
    const shortcuts = document.createElement("p");
    shortcuts.textContent = selected
      ? "Shortcuts: + or − resizes; [ or ] changes layer order; H hides; L locks; Delete removes."
      : "Select a visible item to use item-list shortcuts.";
    inspector.append(inspectorHeading, shortcuts);
    this.#host.replaceChildren(heading, help, list, inspector);
    if (focus?.objectId && focus.action) {
      [...this.#host.querySelectorAll<HTMLElement>("[data-object-id][data-layer-action]")]
        .find((candidate) =>
          candidate.dataset.objectId === focus.objectId &&
          candidate.dataset.layerAction === focus.action
        )
        ?.focus({ preventScroll: true });
    }
  }

  #renderDeleteState(
    selectedId: string | null,
    summaries: readonly CanvasObjectSummary[]
  ): void {
    const state = canvasRemovalState(selectedId, summaries);
    this.#deleteButton.disabled = !state.removable || this.#busy;
    this.#deleteButton.title = state.reason;
    this.#deleteButton.setAttribute("aria-description", state.reason);
    this.#deleteStatus.textContent = state.reason;
  }

  async #deleteSelected(): Promise<void> {
    const state = canvasRemovalState(
      this.#port.getSelectedObjectId(),
      this.#port.listObjectSummaries()
    );
    if (!state.removable || state.selectedId === null) {
      this.#announce(state.reason, "polite");
      return;
    }
    await this.#perform(
      { type: "remove", id: state.selectedId },
      this.#runDeleteSelected
    );
  }

  #button(
    label: string,
    objectId: string,
    action: string,
    onClick: () => void | Promise<void>
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.objectId = objectId;
    button.dataset.layerAction = action;
    button.addEventListener("click", () => { void onClick(); });
    return button;
  }

  async #perform(
    action: CanvasAccessibilityAction,
    operation: () => Promise<void> = () => this.#runAction(action)
  ): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    const summary = this.#port.listObjectSummaries().find(({ id }) => id === action.id);
    const name = summary?.accessibleName ?? "Layer";
    try {
      await operation();
      this.#announce(
        action.type === "remove" ? `${name} deleted.` : `${name} updated.`,
        "polite"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "The layer could not be changed.";
      this.#announce(message, "assertive");
    } finally {
      this.#busy = false;
      this.#render();
    }
  }
}
