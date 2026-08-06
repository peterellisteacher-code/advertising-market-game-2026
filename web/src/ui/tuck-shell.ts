export type TuckEdge = "top" | "left";
export type TuckShellScope = "student" | "teacher-playtest";

export interface TuckPanelConfig {
  readonly id: string;
  readonly edge: TuckEdge;
  readonly tabLabel: string;
  readonly defaultTucked: boolean;
  readonly group?: string;
  readonly panel: HTMLElement;
  readonly tabStrip: HTMLElement;
}

export interface TuckToggleOptions {
  readonly focus?: boolean;
}

export interface TuckPanelHandle {
  readonly id: string;
  readonly tab: HTMLButtonElement;
  readonly panel: HTMLElement;
  isTucked(): boolean;
  tuck(options?: TuckToggleOptions): void;
  untuck(options?: TuckToggleOptions): void;
}

export interface TuckShellOptions {
  readonly storage: Pick<Storage, "getItem" | "setItem"> | null;
  readonly scope: TuckShellScope;
  readonly reducedMotion?: () => boolean;
  readonly motionRoot?: HTMLElement | null;
}

export interface TuckShell {
  register(config: TuckPanelConfig): TuckPanelHandle;
  destroy(): void;
}

export const TUCK_SHELL_STORAGE_KEYS: Readonly<Record<TuckShellScope, string>> = Object.freeze({
  student: "ad-market:tuck-shell:student:v1",
  "teacher-playtest": "ad-market:tuck-shell:teacher-playtest:v1"
});

function validTuckedState(value: unknown): Record<string, boolean> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.every(([, tucked]) => typeof tucked === "boolean")) return null;
  return Object.fromEntries(entries) as Record<string, boolean>;
}

export function readTuckedState(
  storage: Pick<Storage, "getItem"> | null,
  scope: TuckShellScope
): Record<string, boolean> {
  if (storage === null) return {};
  try {
    const raw = storage.getItem(TUCK_SHELL_STORAGE_KEYS[scope]);
    return raw === null ? {} : validTuckedState(JSON.parse(raw)) ?? {};
  } catch {
    return {};
  }
}

/**
 * Reuses the reduced-motion bridge the production Godot shell exposes on
 * `window.AdMarketGameA11y` (see godot/web/godot_shell.html) so tuck panels
 * agree with the OS-level preference even in embeddings where the plain
 * `prefers-reduced-motion` media query is not reliable. Falls back to
 * `matchMedia` directly for the vite preview harness and tests, where the
 * bridge is not present.
 */
export function prefersReducedMotion(): boolean {
  const bridge = (window as unknown as {
    AdMarketGameA11y?: { reducedMotion?: () => boolean };
  }).AdMarketGameA11y;
  if (bridge !== undefined && typeof bridge.reducedMotion === "function") {
    try {
      return bridge.reducedMotion();
    } catch {
      // Fall through to matchMedia below.
    }
  }
  if (typeof window.matchMedia === "function") {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      // Motion stays at its default.
    }
  }
  return false;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])'
].join(", ");

function focusPanel(panel: HTMLElement): void {
  for (const candidate of panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    if (candidate.closest("[hidden]") === null) {
      candidate.focus();
      return;
    }
  }
  if (!panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
  panel.focus();
}

interface PanelEntry {
  readonly id: string;
  readonly group: string | undefined;
  readonly panel: HTMLElement;
  readonly tab: HTMLButtonElement;
}

/**
 * The tuckability primitive: an edge-tab shell that owns tucked/untucked
 * state for any number of registered panels. Tucked panels contribute zero
 * layout space (the `hidden` attribute, not `visibility`), so callers must
 * size their grid/flex tracks with `auto` rather than a reserved pixel
 * track. See docs/superpowers/specs/2026-08-06-studio-tuckability-single-action-design.md.
 */
export function createTuckShell(options: TuckShellOptions): TuckShell {
  const state = readTuckedState(options.storage, options.scope);
  const panels = new Map<string, PanelEntry>();
  const cleanups: Array<() => void> = [];

  const motionRoot = options.motionRoot === undefined
    ? (typeof document === "undefined" ? null : document.documentElement)
    : options.motionRoot;
  if (motionRoot !== null) {
    const reduced = (options.reducedMotion ?? prefersReducedMotion)();
    motionRoot.dataset.tuckMotion = reduced ? "reduce" : "full";
  }

  const persist = (): void => {
    if (options.storage === null) return;
    try {
      options.storage.setItem(TUCK_SHELL_STORAGE_KEYS[options.scope], JSON.stringify(state));
    } catch {
      // The session remains usable without persisted tuck state.
    }
  };

  const applyTucked = (entry: PanelEntry, tucked: boolean): void => {
    entry.panel.hidden = tucked;
    entry.tab.setAttribute("aria-expanded", String(!tucked));
    state[entry.id] = tucked;
  };

  const tuckEntry = (entry: PanelEntry, focus: boolean): void => {
    applyTucked(entry, true);
    if (focus) entry.tab.focus();
  };

  const untuckEntry = (entry: PanelEntry, focus: boolean): void => {
    if (entry.group !== undefined) {
      for (const other of panels.values()) {
        if (other.id !== entry.id && other.group === entry.group && !other.panel.hidden) {
          applyTucked(other, true);
        }
      }
    }
    applyTucked(entry, false);
    if (focus) focusPanel(entry.panel);
  };

  function register(config: TuckPanelConfig): TuckPanelHandle {
    if (config.panel.id === "") {
      throw new Error(`Tuck panel "${config.id}" needs an id on its panel element for aria-controls.`);
    }
    if (panels.has(config.id)) {
      throw new Error(`Tuck panel "${config.id}" is already registered.`);
    }

    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "creator__tuck-tab";
    tab.dataset.tuckTab = config.id;
    tab.dataset.tuckEdge = config.edge;
    tab.textContent = config.tabLabel;
    tab.setAttribute("aria-controls", config.panel.id);
    config.tabStrip.append(tab);

    const entry: PanelEntry = { id: config.id, group: config.group, panel: config.panel, tab };
    panels.set(config.id, entry);

    const persisted = state[config.id];
    let tucked = typeof persisted === "boolean" ? persisted : config.defaultTucked;
    if (!tucked && config.group !== undefined) {
      const groupHasOpenMember = [...panels.values()].some((other) =>
        other.id !== entry.id && other.group === config.group && !other.panel.hidden);
      if (groupHasOpenMember) tucked = true;
    }
    applyTucked(entry, tucked);

    const onTabClick = (): void => {
      if (entry.panel.hidden) untuckEntry(entry, true);
      else tuckEntry(entry, true);
      persist();
    };
    tab.addEventListener("click", onTabClick);
    cleanups.push(() => tab.removeEventListener("click", onTabClick));

    const onPanelKeydown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      tuckEntry(entry, true);
      persist();
    };
    entry.panel.addEventListener("keydown", onPanelKeydown);
    cleanups.push(() => entry.panel.removeEventListener("keydown", onPanelKeydown));

    return {
      id: config.id,
      tab,
      panel: config.panel,
      isTucked: () => entry.panel.hidden === true,
      tuck: (toggleOptions) => tuckEntry(entry, toggleOptions?.focus ?? true),
      untuck: (toggleOptions) => untuckEntry(entry, toggleOptions?.focus ?? true)
    };
  }

  return {
    register,
    destroy(): void {
      for (const cleanup of cleanups) cleanup();
      cleanups.length = 0;
      panels.clear();
    }
  };
}
