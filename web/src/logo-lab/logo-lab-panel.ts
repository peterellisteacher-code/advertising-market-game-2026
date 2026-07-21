import type { LogoMarkSnapshot } from "../fabric/canvas-port";
import {
  searchLogoIcons,
  type LogoIconCatalogue,
  type LogoIconRecord
} from "./logo-icon-catalogue";
import {
  LOGO_RECIPES,
  LOGO_TYPEFACES,
  createLogoMarkDesign,
  remixLogoColours,
  remixLogoSymbol,
  remixLogoType,
  surpriseLogoMark,
  type LogoMarkDesign,
  type LogoRecipeId,
  type LogoTypeface
} from "./logo-mark-model";

export type LogoLabAddHandler = (
  design: LogoMarkDesign,
  icon: LogoIconRecord
) => Promise<string> | string;

export type LogoLabReplaceHandler = (
  id: string,
  design: LogoMarkDesign,
  icon: LogoIconRecord
) => Promise<void> | void;

export type LogoLabAnnouncer = (
  message: string,
  priority: "polite" | "assertive"
) => void;

type FocusTarget =
  | { readonly kind: "chooser" }
  | { readonly kind: "search" }
  | { readonly kind: "category" }
  | { readonly kind: "recipe"; readonly id: LogoRecipeId }
  | { readonly kind: "symbol"; readonly id: string }
  | { readonly kind: "primary" }
  | { readonly kind: "remix"; readonly id: RemixMove };

type RemixMove = "symbol" | "type" | "colours" | "surprise";

const CATEGORY_OPTIONS = Object.freeze([
  ["all", "All symbols"],
  ["beauty-care", "Beauty + care"],
  ["drinks-snacks", "Drinks + snacks"],
  ["fashion-footwear", "Fashion + footwear"],
  ["fast-food-hospitality", "Food + hospitality"],
  ["home-lifestyle", "Home + lifestyle"],
  ["pets-animals", "Pets + animals"],
  ["shops-services", "Shops + services"],
  ["sport-outdoors", "Sport + outdoors"],
  ["tech-gadgets", "Tech + gadgets"],
  ["travel-transport", "Travel + transport"]
] as const);

const DEFAULT_PRIMARY = "#0B6E99";
const DEFAULT_SECONDARY = "#F6C85F";

function button(label: string): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  return element;
}

function label(text: string, control: HTMLElement): HTMLLabelElement {
  const element = document.createElement("label");
  const caption = document.createElement("span");
  caption.textContent = text;
  element.append(caption, control);
  return element;
}

function option(value: string, text: string): HTMLOptionElement {
  const element = document.createElement("option");
  element.value = value;
  element.textContent = text;
  return element;
}

export class LogoLabPanel {
  #catalogue: LogoIconCatalogue | null = null;
  #marks: readonly LogoMarkSnapshot[] = Object.freeze([]);
  #selectedMarkId: string | null = null;
  #recipe: LogoRecipeId = "icon-wordmark";
  #text = "";
  #iconId: string | null = null;
  #primary = DEFAULT_PRIMARY;
  #secondary = DEFAULT_SECONDARY;
  #typeface: LogoTypeface = "Trebuchet MS";
  #seed = 0;
  #revision = 0;
  #query = "";
  #category = "all";
  #available = false;
  #busy = false;
  #disposed = false;
  #detailsOpen = false;
  #message = "Logo maker loading";
  #messagePriority: "polite" | "assertive" = "polite";

  constructor(
    private readonly host: HTMLElement,
    private readonly onAdd: LogoLabAddHandler,
    private readonly onReplace: LogoLabReplaceHandler,
    private readonly announce: LogoLabAnnouncer = () => undefined
  ) {}

  render(catalogue: LogoIconCatalogue): void {
    if (this.#disposed) return;
    this.#catalogue = catalogue;
    this.#available = true;
    this.#messagePriority = "polite";
    this.#message = this.#readinessMessage();
    this.#draw();
  }

  setMarks(marks: readonly LogoMarkSnapshot[]): void {
    if (this.#disposed) return;
    const seen = new Set<string>();
    this.#marks = Object.freeze(marks.map(({ id, design }) => {
      const objectId = id.trim();
      if (!objectId || seen.has(objectId)) throw new Error("Logo marks need unique non-empty ids");
      seen.add(objectId);
      return Object.freeze({ id: objectId, design: createLogoMarkDesign(design) });
    }));
    if (this.#selectedMarkId) {
      const selected = this.#marks.find(({ id }) => id === this.#selectedMarkId);
      if (selected) this.#applyDesign(selected.design);
      else {
        this.#selectedMarkId = null;
        this.#resetDraft();
      }
    }
    this.#messagePriority = "polite";
    this.#message = this.#readinessMessage();
    this.#draw();
  }

  unavailable(): void {
    if (this.#disposed) return;
    this.#catalogue = null;
    this.#available = false;
    this.#busy = false;
    this.#messagePriority = "polite";
    this.#message = "Logo maker unavailable";
    this.#draw();
  }

  dispose(): void {
    this.#disposed = true;
    this.#catalogue = null;
    this.#marks = Object.freeze([]);
    this.host.replaceChildren();
  }

  #draw(focus?: FocusTarget): void {
    if (this.#disposed) return;
    const root = document.createElement("div");
    root.className = "logo-lab";

    const chooser = document.createElement("select");
    chooser.dataset.logoMarkChooser = "";
    chooser.append(option("", "New logo"));
    for (const mark of this.#marks) {
      const recipe = LOGO_RECIPES.find(({ id }) => id === mark.design.recipe)?.label ?? "Logo";
      chooser.append(option(mark.id, `${mark.design.text} · ${recipe}`));
    }
    chooser.value = this.#selectedMarkId ?? "";
    chooser.addEventListener("change", () => {
      this.#selectedMarkId = chooser.value || null;
      if (!this.#selectedMarkId) this.#resetDraft();
      else {
        const selected = this.#marks.find(({ id }) => id === this.#selectedMarkId);
        if (selected) this.#applyDesign(selected.design);
      }
      this.#messagePriority = "polite";
      this.#message = this.#readinessMessage();
      this.#draw({ kind: "chooser" });
    });
    const chooserLabel = label("Logo on canvas", chooser);
    chooserLabel.className = "logo-lab__chooser";

    const controls = document.createElement("div");
    controls.className = "logo-lab__controls";

    const words = document.createElement("input");
    words.type = "text";
    words.maxLength = 48;
    words.value = this.#text;
    words.placeholder = "Try Nova Pet";
    words.addEventListener("input", () => {
      this.#text = words.value;
      this.#messagePriority = "polite";
      this.#message = this.#readinessMessage();
      this.#syncStatusAndActions(root);
    });
    const wordsLabel = label("Logo words", words);
    wordsLabel.className = "logo-lab__wide-field";

    const recipes = document.createElement("fieldset");
    recipes.className = "logo-lab__recipes";
    const recipeLegend = document.createElement("legend");
    recipeLegend.textContent = "Logo shape";
    recipes.append(recipeLegend);
    for (const recipe of LOGO_RECIPES) {
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "logo-recipe";
      input.value = recipe.id;
      input.checked = this.#recipe === recipe.id;
      input.addEventListener("change", () => {
        if (!input.checked) return;
        this.#recipe = recipe.id;
        this.#draw({ kind: "recipe", id: recipe.id });
      });
      const recipeLabel = document.createElement("label");
      recipeLabel.append(input, document.createTextNode(recipe.label));
      recipes.append(recipeLabel);
    }

    const filters = document.createElement("div");
    filters.className = "logo-lab__filters";
    const category = document.createElement("select");
    for (const [value, text] of CATEGORY_OPTIONS) category.append(option(value, text));
    category.value = this.#category;
    category.addEventListener("change", () => {
      this.#category = category.value;
      this.#draw({ kind: "category" });
    });
    const categoryLabel = label("Symbol category", category);
    const search = document.createElement("input");
    search.type = "search";
    search.value = this.#query;
    search.placeholder = "Try paw or rocket";
    search.addEventListener("input", () => {
      this.#query = search.value;
      this.#draw({ kind: "search" });
    });
    const searchLabel = label("Search symbols", search);
    filters.append(categoryLabel, searchLabel);

    const symbolResults = this.#filteredIcons();
    const symbols = document.createElement("div");
    symbols.className = "logo-lab__symbols";
    symbols.setAttribute("role", "group");
    symbols.setAttribute("aria-label", "Symbol choices");
    for (const icon of symbolResults) {
      const control = button(icon.title);
      control.className = "logo-lab__symbol";
      control.dataset.logoIconId = icon.id;
      control.setAttribute("aria-pressed", String(icon.id === this.#iconId));
      const preview = document.createElement("span");
      preview.className = "logo-lab__symbol-preview";
      preview.setAttribute("aria-hidden", "true");
      preview.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${icon.width} ${icon.height}" focusable="false">${icon.body}</svg>`;
      const title = document.createElement("span");
      title.textContent = icon.title;
      control.replaceChildren(preview, title);
      control.addEventListener("click", () => {
        this.#iconId = icon.id;
        this.#messagePriority = "polite";
        this.#message = this.#readinessMessage();
        this.#draw({ kind: "symbol", id: icon.id });
      });
      symbols.append(control);
    }
    if (symbolResults.length === 0) {
      const empty = document.createElement("p");
      empty.className = "logo-lab__empty";
      empty.textContent = "No symbols match yet";
      symbols.append(empty);
    }

    const colours = document.createElement("div");
    colours.className = "logo-lab__colours";
    const primary = document.createElement("input");
    primary.type = "color";
    primary.value = this.#primary;
    primary.addEventListener("input", () => {
      this.#primary = primary.value.toUpperCase();
      this.#syncStatusAndActions(root);
    });
    const secondary = document.createElement("input");
    secondary.type = "color";
    secondary.value = this.#secondary;
    secondary.addEventListener("input", () => {
      this.#secondary = secondary.value.toUpperCase();
      this.#syncStatusAndActions(root);
    });
    colours.append(label("Main colour", primary), label("Second colour", secondary));

    const extras = document.createElement("details");
    extras.open = this.#detailsOpen;
    extras.addEventListener("toggle", () => { this.#detailsOpen = extras.open; });
    const summary = document.createElement("summary");
    summary.textContent = "More logo moves";
    const typeface = document.createElement("select");
    for (const value of LOGO_TYPEFACES) typeface.append(option(value, value));
    typeface.value = this.#typeface;
    typeface.addEventListener("change", () => {
      this.#typeface = typeface.value as LogoTypeface;
      this.#syncStatusAndActions(root);
    });
    const moves = document.createElement("div");
    moves.className = "logo-lab__moves";
    for (const [id, text] of [
      ["symbol", "Remix symbol"],
      ["type", "Remix type"],
      ["colours", "Remix colours"],
      ["surprise", "Random logo"]
    ] as const) {
      const control = button(text);
      control.dataset.logoRemixAction = id;
      control.addEventListener("click", () => {
        this.#detailsOpen = true;
        void this.#performRemix(id);
      });
      moves.append(control);
    }
    extras.append(summary, label("Word style", typeface), moves);

    controls.append(wordsLabel, recipes, filters, symbols, colours, extras);

    const status = document.createElement("p");
    status.className = "logo-lab__status";
    status.dataset.logoLabStatus = "";
    status.setAttribute("role", this.#messagePriority === "assertive" ? "alert" : "status");
    status.setAttribute("aria-live", this.#messagePriority);
    status.textContent = this.#message;

    const primaryAction = button(this.#busy
      ? "Making logo…"
      : this.#selectedMarkId ? "Update logo" : "Add logo");
    primaryAction.className = "logo-lab__primary";
    primaryAction.dataset.logoPrimaryAction = "";
    primaryAction.addEventListener("click", () => { void this.#performPrimary(); });

    root.append(chooserLabel, controls, status, primaryAction);
    this.host.replaceChildren(root);
    this.#syncStatusAndActions(root);
    this.#restoreFocus(root, focus);
  }

  #filteredIcons(): readonly LogoIconRecord[] {
    if (!this.#catalogue || !this.#available) return Object.freeze([]);
    return searchLogoIcons(this.#catalogue, this.#query, this.#category, 40);
  }

  #icon(): LogoIconRecord | null {
    if (!this.#catalogue || !this.#iconId) return null;
    return this.#catalogue.icons.find(({ id }) => id === this.#iconId) ?? null;
  }

  #draft(revision = this.#revision): LogoMarkDesign | null {
    if (!this.#icon()) return null;
    try {
      return createLogoMarkDesign({
        recipe: this.#recipe,
        text: this.#text,
        iconId: this.#iconId!,
        primary: this.#primary,
        secondary: this.#secondary,
        typeface: this.#typeface,
        seed: this.#seed,
        revision
      });
    } catch {
      return null;
    }
  }

  #readinessMessage(): string {
    if (!this.#available) return "Logo maker unavailable";
    if (this.#selectedMarkId && this.#iconId && !this.#icon()) {
      return "This saved symbol is not in this pack";
    }
    return this.#draft() ? "Ready for the canvas" : "Choose words and a symbol";
  }

  #syncStatusAndActions(root: HTMLElement): void {
    const ready = this.#draft() !== null && this.#available && !this.#busy;
    const primary = root.querySelector<HTMLButtonElement>("[data-logo-primary-action]");
    if (primary) primary.disabled = !ready;
    root.querySelectorAll<HTMLButtonElement>("[data-logo-remix-action]")
      .forEach((control) => { control.disabled = !ready; });
    const status = root.querySelector<HTMLElement>("[data-logo-lab-status]");
    if (status) {
      status.textContent = this.#message;
      status.setAttribute("role", this.#messagePriority === "assertive" ? "alert" : "status");
      status.setAttribute("aria-live", this.#messagePriority);
    }
  }

  async #performPrimary(): Promise<void> {
    if (this.#busy) return;
    const icon = this.#icon();
    const design = this.#draft(this.#selectedMarkId ? this.#revision + 1 : this.#revision);
    if (!icon || !design) return;
    this.#busy = true;
    this.#draw({ kind: "primary" });
    try {
      if (this.#selectedMarkId) {
        await this.onReplace(this.#selectedMarkId, design, icon);
        this.#replaceLocalMark(this.#selectedMarkId, design);
        this.#applyDesign(design);
        this.#message = `${design.text} logo updated`;
      } else {
        const id = (await this.onAdd(design, icon)).trim();
        if (!id) throw new Error("Logo add handler returned an empty id");
        this.#selectedMarkId = id;
        this.#marks = Object.freeze([...this.#marks, Object.freeze({ id, design })]);
        this.#applyDesign(design);
        this.#message = `${design.text} logo added`;
      }
      this.#messagePriority = "polite";
      this.announce(this.#message, "polite");
    } catch {
      this.#message = this.#selectedMarkId ? "Logo could not be updated" : "Logo could not be added";
      this.#messagePriority = "assertive";
      this.announce(this.#message, "assertive");
    } finally {
      this.#busy = false;
      this.#draw({ kind: "primary" });
    }
  }

  async #performRemix(move: RemixMove): Promise<void> {
    if (this.#busy || !this.#catalogue) return;
    const current = this.#draft();
    if (!current) return;
    const nextSeed = (current.seed + 1) >>> 0;
    const iconIds = this.#catalogue.icons.map(({ id }) => id);
    const design = move === "symbol"
      ? remixLogoSymbol(current, iconIds, nextSeed)
      : move === "type"
        ? remixLogoType(current, nextSeed)
        : move === "colours"
          ? remixLogoColours(current, nextSeed)
          : surpriseLogoMark(current, iconIds, nextSeed);
    const icon = this.#catalogue.icons.find(({ id }) => id === design.iconId);
    if (!icon) return;
    this.#busy = true;
    this.#draw({ kind: "remix", id: move });
    try {
      if (this.#selectedMarkId) {
        await this.onReplace(this.#selectedMarkId, design, icon);
        this.#replaceLocalMark(this.#selectedMarkId, design);
      }
      this.#applyDesign(design);
      const message = move === "symbol"
        ? "Symbol remixed"
        : move === "type"
          ? "Word style remixed"
          : move === "colours"
            ? "Colours remixed"
            : "New logo mix ready";
      this.#message = message;
      this.#messagePriority = "polite";
      this.announce(message, "polite");
    } catch {
      this.#message = "Logo remix could not be applied";
      this.#messagePriority = "assertive";
      this.announce(this.#message, "assertive");
    } finally {
      this.#busy = false;
      this.#draw({ kind: "remix", id: move });
    }
  }

  #replaceLocalMark(id: string, design: LogoMarkDesign): void {
    this.#marks = Object.freeze(this.#marks.map((mark) =>
      mark.id === id ? Object.freeze({ id, design }) : mark));
  }

  #applyDesign(design: LogoMarkDesign): void {
    const parsed = createLogoMarkDesign(design);
    this.#recipe = parsed.recipe;
    this.#text = parsed.text;
    this.#iconId = parsed.iconId;
    this.#primary = parsed.primary;
    this.#secondary = parsed.secondary;
    this.#typeface = parsed.typeface;
    this.#seed = parsed.seed;
    this.#revision = parsed.revision;
  }

  #resetDraft(): void {
    this.#recipe = "icon-wordmark";
    this.#text = "";
    this.#iconId = null;
    this.#primary = DEFAULT_PRIMARY;
    this.#secondary = DEFAULT_SECONDARY;
    this.#typeface = "Trebuchet MS";
    this.#seed = 0;
    this.#revision = 0;
  }

  #restoreFocus(root: HTMLElement, focus?: FocusTarget): void {
    if (!focus) return;
    const target = focus.kind === "chooser"
      ? root.querySelector<HTMLElement>("[data-logo-mark-chooser]")
      : focus.kind === "search"
        ? root.querySelector<HTMLElement>('input[type="search"]')
        : focus.kind === "category"
          ? root.querySelector<HTMLElement>(".logo-lab__filters select")
          : focus.kind === "recipe"
            ? root.querySelector<HTMLElement>(`input[name="logo-recipe"][value="${focus.id}"]`)
            : focus.kind === "symbol"
              ? root.querySelector<HTMLElement>(`[data-logo-icon-id="${focus.id}"]`)
              : focus.kind === "primary"
                ? root.querySelector<HTMLElement>("[data-logo-primary-action]")
                : root.querySelector<HTMLElement>(`[data-logo-remix-action="${focus.id}"]`);
    target?.focus();
  }
}
