import { readTuckedState, TUCK_SHELL_STORAGE_KEYS, type TuckShellScope } from "./tuck-shell";

/**
 * The slice of MediaQueryList this module needs. A real MediaQueryList
 * satisfies this; tests can pass a lighter fake instead.
 */
export interface StudioToolDrawerNarrowQuery {
  readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

export interface StudioToolDrawerOptions {
  readonly storage?: Pick<Storage, "getItem" | "setItem"> | null;
  readonly scope?: TuckShellScope;
  /**
   * Matches StudioSplitPane's own narrow-viewport query. Below the
   * breakpoint the shared library/drawer element's visibility belongs to
   * StudioSplitPane's Browse/Edit pane tabs (there is no side-by-side space
   * to reclaim by tucking), so the drawer stops writing to it there.
   */
  readonly narrowQuery?: StudioToolDrawerNarrowQuery | null;
}

export interface StudioToolDrawer {
  select(tool: string): void;
  current(): string;
  isTucked(): boolean;
  destroy(): void;
}

const toolSelector = "button[data-studio-tool]";
const panelSelector = "[data-studio-panel]";
const drawerSelector = "[data-studio-drawer]";
const separatorSelector = "[data-studio-separator]";
const DRAWER_STATE_KEY = "drawer";

export function createStudioToolDrawer(
  root: HTMLElement,
  options: StudioToolDrawerOptions = {}
): StudioToolDrawer {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(toolSelector));
  const panels = Array.from(root.querySelectorAll<HTMLElement>(panelSelector));
  const drawer = root.querySelector<HTMLElement>(drawerSelector);
  const separator = root.querySelector<HTMLElement>(separatorSelector);
  const matchedButtons = buttons.filter((button) => panels.some(
    (panel) => panel.dataset.studioPanel === button.dataset.studioTool
  ));

  if (matchedButtons.length === 0) {
    throw new Error("Studio tool drawer needs at least one tool with a matching panel.");
  }

  const availableButtons = () => matchedButtons.filter((button) => !button.hidden && !button.disabled);
  const initialButton = availableButtons()[0];
  if (!initialButton) {
    throw new Error("Studio tool drawer needs at least one available tool.");
  }

  const storage = options.storage ?? null;
  const scope = options.scope ?? "student";
  const narrowQuery = options.narrowQuery ?? null;
  const persistedDrawerState = readTuckedState(storage, scope)[DRAWER_STATE_KEY];

  let selectedTool = initialButton.dataset.studioTool!;
  // Tucked by default (single-action screen law): programmatic selection and
  // direct tool-tab clicks are the only ways in, matching the tuck-shell's
  // own default-tucked edge panels. A persisted flag from this session wins.
  let drawerCollapsed = typeof persistedDrawerState === "boolean" ? persistedDrawerState : true;

  const persist = (): void => {
    if (storage === null) return;
    try {
      const next = { ...readTuckedState(storage, scope), [DRAWER_STATE_KEY]: drawerCollapsed };
      storage.setItem(TUCK_SHELL_STORAGE_KEYS[scope], JSON.stringify(next));
    } catch {
      // The session remains usable without persisted drawer state.
    }
  };

  const emitChange = () => {
    root.dispatchEvent(new CustomEvent("studio-tool-drawer-change", {
      bubbles: true,
      detail: { tool: selectedTool }
    }));
  };

  const render = () => {
    root.toggleAttribute("data-studio-drawer-collapsed", drawerCollapsed);
    // Below the narrow-viewport breakpoint, StudioSplitPane's Browse/Edit
    // pane tabs own this element's hidden state instead (see narrowQuery
    // above); leave it alone so a tucked drawer can't hide the Browse pane.
    if (narrowQuery?.matches !== true) {
      if (drawer !== null) drawer.hidden = drawerCollapsed;
      if (separator !== null) separator.hidden = drawerCollapsed;
    }
    if (drawer !== null) drawer.toggleAttribute("inert", drawer.hidden !== false);
    for (const button of matchedButtons) {
      const selected = button.dataset.studioTool === selectedTool;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      button.setAttribute("aria-expanded", String(selected && !drawerCollapsed));
    }
    const activePanel = panels.find((panel) => panel.dataset.studioPanel === selectedTool);
    for (const panel of panels) {
      panel.hidden = panel !== activePanel;
      panel.toggleAttribute("inert", panel !== activePanel);
    }
  };

  const select = (tool: string, focus = false) => {
    const button = availableButtons().find((candidate) => candidate.dataset.studioTool === tool);
    if (!button) return;
    const changed = selectedTool !== tool;
    selectedTool = tool;
    drawerCollapsed = false;
    render();
    persist();
    if (focus) button.focus();
    if (changed) emitChange();
  };

  const onClick = (event: MouseEvent) => {
    const button = event.currentTarget as HTMLButtonElement;
    const tool = button.dataset.studioTool!;
    if (tool === selectedTool) {
      drawerCollapsed = !drawerCollapsed;
      render();
      persist();
      button.focus();
      return;
    }
    select(tool, true);
  };

  const onKeydown = (event: KeyboardEvent) => {
    const currentButton = event.target instanceof HTMLButtonElement
      ? event.target.closest<HTMLButtonElement>(toolSelector)
      : null;
    const keyboardButtons = availableButtons();
    const currentIndex = currentButton ? keyboardButtons.indexOf(currentButton) : -1;

    if (currentIndex < 0) return;

    let nextIndex: number | undefined;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + keyboardButtons.length) % keyboardButtons.length;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % keyboardButtons.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = keyboardButtons.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    select(keyboardButtons[nextIndex]!.dataset.studioTool!, true);
  };

  const onDrawerKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    drawerCollapsed = true;
    render();
    persist();
    matchedButtons.find((button) => button.dataset.studioTool === selectedTool)?.focus();
  };

  const onNarrowChange = () => render();

  for (const button of matchedButtons) button.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeydown);
  drawer?.addEventListener("keydown", onDrawerKeydown);
  narrowQuery?.addEventListener("change", onNarrowChange);
  render();

  return {
    select(tool) {
      select(tool);
    },
    current() {
      return selectedTool;
    },
    isTucked() {
      return drawerCollapsed;
    },
    destroy() {
      for (const button of matchedButtons) button.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeydown);
      drawer?.removeEventListener("keydown", onDrawerKeydown);
      narrowQuery?.removeEventListener("change", onNarrowChange);
    }
  };
}
