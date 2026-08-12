const HEX_COLOUR = /^#[0-9A-Fa-f]{6}$/;

export interface ProductShellRegionState {
  objectId: string;
  title: string;
  regions: string[];
  colours: Readonly<Record<string, string>>;
}

export type ProductShellRegionChangeHandler = (
  objectId: string,
  region: string,
  colour: string
) => void;

const regionLabel = (region: string): string =>
  region.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

export class ProductShellRegionControls {
  constructor(
    private readonly host: HTMLElement,
    private readonly onChange: ProductShellRegionChangeHandler
  ) {}

  show(state: ProductShellRegionState): void {
    this.host.hidden = false;
    this.host.toggleAttribute("inert", false);
    const heading = document.createElement("h2");
    heading.textContent = state.title;
    const guidance = document.createElement("p");
  guidance.textContent = "Change any product zone.";
    const controls = document.createElement("div");
    controls.className = "creator__region-controls";
    for (const region of state.regions) {
      const colour = state.colours[region];
      if (!colour || !HEX_COLOUR.test(colour)) continue;
      const label = document.createElement("label");
      label.textContent = `${regionLabel(region)} colour`;
      const input = document.createElement("input");
      input.type = "color";
      input.value = colour;
      input.dataset.shellRegion = region;
      input.addEventListener("input", () => {
        this.onChange(state.objectId, region, input.value.toUpperCase());
      });
      label.append(input);
      controls.append(label);
    }
    this.host.replaceChildren(heading, guidance, controls);
  }

  clear(): void {
    this.host.replaceChildren();
    this.host.hidden = true;
    this.host.toggleAttribute("inert", true);
  }
}
