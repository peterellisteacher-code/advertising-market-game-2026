import type {
  ProductShellCatalogue,
  ProductShellRecord
} from "./product-shell-catalogue";

export interface ProductShellPickerElements {
  select: HTMLSelectElement;
  preview: HTMLImageElement;
  button: HTMLButtonElement;
  status: HTMLElement;
}

export type ProductShellPickHandler = (
  shell: ProductShellRecord,
  packId: string
) => void;

export class ProductShellPicker {
  #catalogue: ProductShellCatalogue | null = null;
  #records = new Map<string, ProductShellRecord>();

  readonly #handleSelection = (): void => { this.#showSelection(); };
  readonly #handleAdd = (): void => {
    const shell = this.#selected();
    if (!shell || !this.#catalogue) return;
    this.elements.status.textContent = `Adding ${shell.title}`;
    this.onPick(shell, this.#catalogue.packId);
  };

  constructor(
    private readonly elements: ProductShellPickerElements,
    private readonly onPick: ProductShellPickHandler
  ) {
    elements.select.addEventListener("change", this.#handleSelection);
    elements.button.addEventListener("click", this.#handleAdd);
    elements.select.disabled = true;
    elements.button.disabled = true;
  }

  render(catalogue: ProductShellCatalogue): void {
    this.#catalogue = catalogue;
    this.#records.clear();
    this.elements.select.replaceChildren();
    const shellsByFamily = new Map<string, ProductShellRecord[]>();
    for (const shell of catalogue.shells) {
      this.#records.set(shell.id, shell);
      const familyShells = shellsByFamily.get(shell.family) ?? [];
      familyShells.push(shell);
      shellsByFamily.set(shell.family, familyShells);
    }
    for (const family of catalogue.families) {
      const group = document.createElement("optgroup");
      group.label = family.title;
      for (const shell of shellsByFamily.get(family.id) ?? []) {
        const option = document.createElement("option");
        option.value = shell.id;
        option.textContent = shell.title;
        group.append(option);
      }
      if (group.children.length > 0) this.elements.select.append(group);
    }
    const hasShells = this.#records.size > 0;
    this.elements.select.disabled = !hasShells;
    this.elements.button.disabled = !hasShells;
    this.elements.status.textContent = hasShells
      ? `${this.#records.size} product shells ready`
      : "Product shells unavailable";
    this.#showSelection();
  }

  destroy(): void {
    this.elements.select.removeEventListener("change", this.#handleSelection);
    this.elements.button.removeEventListener("click", this.#handleAdd);
  }

  #selected(): ProductShellRecord | null {
    return this.#records.get(this.elements.select.value) ?? null;
  }

  #showSelection(): void {
    const shell = this.#selected();
    if (!shell) {
      this.elements.preview.removeAttribute("src");
      this.elements.preview.alt = "";
      return;
    }
    this.elements.preview.src = shell.previewUrl;
    this.elements.preview.alt = `Preview: ${shell.title}`;
  }
}
