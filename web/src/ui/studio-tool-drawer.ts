export interface StudioToolDrawer {
  select(tool: string): void;
  current(): string;
  destroy(): void;
}

const toolSelector = "button[data-studio-tool]";
const panelSelector = "[data-studio-panel]";
const drawerSelector = "[data-studio-drawer]";
const drawerToggleSelector = "[data-studio-drawer-toggle]";
const separatorSelector = "[data-studio-separator]";

export function createStudioToolDrawer(root: HTMLElement): StudioToolDrawer {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>(toolSelector));
  const panels = Array.from(root.querySelectorAll<HTMLElement>(panelSelector));
  const drawer = root.querySelector<HTMLElement>(drawerSelector);
  const drawerToggle = root.querySelector<HTMLButtonElement>(drawerToggleSelector);
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

  let selectedTool = initialButton.dataset.studioTool!;
  let drawerCollapsed = false;
  const emitChange = () => {
    root.dispatchEvent(new CustomEvent("studio-tool-drawer-change", {
      bubbles: true,
      detail: { tool: selectedTool }
    }));
  };

  const render = () => {
    root.toggleAttribute("data-studio-drawer-collapsed", drawerCollapsed);
    if (drawer !== null) drawer.hidden = drawerCollapsed;
    if (separator !== null) separator.hidden = drawerCollapsed;
    if (drawerToggle !== null) drawerToggle.setAttribute("aria-expanded", String(!drawerCollapsed));
    for (const button of matchedButtons) {
      const selected = button.dataset.studioTool === selectedTool;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    const activePanel = panels.find((panel) => panel.dataset.studioPanel === selectedTool);
    for (const panel of panels) {
      panel.hidden = panel !== activePanel;
    }
  };

  const select = (tool: string, focus = false) => {
    const button = availableButtons().find((candidate) => candidate.dataset.studioTool === tool);
    if (!button) return;
    const changed = selectedTool !== tool;
    selectedTool = tool;
    drawerCollapsed = false;
    render();
    if (focus) button.focus();
    if (changed) emitChange();
  };

  const onClick = (event: MouseEvent) => {
    const button = event.currentTarget as HTMLButtonElement;
    select(button.dataset.studioTool!, true);
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

  const onDrawerToggle = () => {
    drawerCollapsed = !drawerCollapsed;
    render();
    if (drawerCollapsed) {
      matchedButtons.find((button) => button.dataset.studioTool === selectedTool)?.focus();
    }
  };

  for (const button of matchedButtons) button.addEventListener("click", onClick);
  drawerToggle?.addEventListener("click", onDrawerToggle);
  root.addEventListener("keydown", onKeydown);
  render();

  return {
    select(tool) {
      select(tool);
    },
    current() {
      return selectedTool;
    },
    destroy() {
      for (const button of matchedButtons) button.removeEventListener("click", onClick);
      drawerToggle?.removeEventListener("click", onDrawerToggle);
      root.removeEventListener("keydown", onKeydown);
    }
  };
}
