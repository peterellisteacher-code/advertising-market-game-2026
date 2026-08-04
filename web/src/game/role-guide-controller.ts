import type { CampaignDocumentV1 } from "../domain/campaign-document";

export const ROLE_GUIDE = Object.freeze({
  sharedAccess:
    "Both partners can use the same tools that are unlocked for the current level.",
  sameButtons:
    "The roles do not unlock different buttons.",
  activeTurn:
    "The partner in the active role should use the keyboard or trackpad for the next advertisement edit.",
  recordedRole:
    "The site records each advertisement edit with the role that is active.",
  physicalUser:
    "It does not block tools or identify which person physically touched the device.",
  swapEffect:
    "Swap roles changes the active responsibility and the role recorded for later advertisement edits.",
  retainedWork:
  "Earlier work and recorded contributions stay saved.",
  artDirector: Object.freeze({
    label: "Art Director",
    responsibilities:
      "Controls the product's appearance, images, colour, arrangement and layout.",
    example:
      "For example, the Art Director can choose a product image, enlarge it, change a colour and decide where the headline sits."
  }),
  strategist: Object.freeze({
    label: "Strategist",
    responsibilities:
      "Controls the product name, advertising words, claim, price reasoning and market-route reasoning.",
    example:
      "For example, the Strategist can name the product, write its benefit, choose a suitable price and add a proof point."
  })
});

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`Role guide is missing ${selector}`);
  return element;
}

export class RoleGuideController {
  readonly #layer: HTMLElement;
  readonly #dialog: HTMLElement;
  readonly #assignment: HTMLElement;
  readonly #openButton: HTMLButtonElement;
  readonly #closeButton: HTMLButtonElement;
  readonly #beginButton: HTMLButtonElement;
  #required = false;
  #hasCampaign = false;
  #returnFocus: HTMLElement | null = null;

  constructor(
    root: ParentNode,
    private readonly protectedSurface: HTMLElement,
    private readonly acknowledge: () => void,
    private readonly focusCurrentAction: () => void,
    private readonly autoOpen = true
  ) {
    this.#layer = required(root, "[data-role-guide-layer]");
    this.#dialog = required(root, "[data-role-guide-dialog]");
    this.#assignment = required(root, "[data-role-guide-assignment]");
    this.#openButton = required(root, "[data-role-guide-open]");
    this.#closeButton = required(root, "[data-role-guide-close]");
    this.#beginButton = required(root, "[data-role-guide-begin]");

    this.#openButton.addEventListener("click", this.#onOpen);
    this.#closeButton.addEventListener("click", this.#onClose);
    this.#beginButton.addEventListener("click", this.#onBegin);
    this.#dialog.addEventListener("keydown", this.#onKeydown);
  }

  setCampaign(document: CampaignDocumentV1 | null): void {
    this.#close(false);
    this.#hasCampaign = document !== null;
    if (document === null) return;

    const startingRole = document.gameplay.pair.activeRole === "art-director"
      ? ROLE_GUIDE.artDirector.label
      : ROLE_GUIDE.strategist.label;
    this.#assignment.textContent = `The ${startingRole} is the active role first.`;
    if (this.autoOpen && !document.gameplay.pair.roleGuideAcknowledged) {
      this.#open(true);
    }
  }

  destroy(): void {
    this.#openButton.removeEventListener("click", this.#onOpen);
    this.#closeButton.removeEventListener("click", this.#onClose);
    this.#beginButton.removeEventListener("click", this.#onBegin);
    this.#dialog.removeEventListener("keydown", this.#onKeydown);
    this.#close(false);
    this.#hasCampaign = false;
  }

  readonly #onOpen = (event: Event): void => {
    if (!this.#hasCampaign) return;
    this.#returnFocus = event.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : null;
    this.#open(false);
  };

  readonly #onClose = (): void => {
    if (!this.#required) this.#close(true);
  };

  readonly #onBegin = (): void => {
    if (this.#required) {
      this.acknowledge();
      this.#required = false;
    }
    this.#close(false);
    this.focusCurrentAction();
  };

  readonly #onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      if (this.#required) return;
      event.preventDefault();
      this.#close(true);
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = [this.#closeButton, this.#beginButton]
      .filter((button) => !button.hidden);
    const activeIndex = focusable.indexOf(
      this.#dialog.ownerDocument.activeElement as HTMLButtonElement
    );
    const nextIndex = event.shiftKey
      ? (activeIndex <= 0 ? focusable.length - 1 : activeIndex - 1)
      : (activeIndex + 1) % focusable.length;
    event.preventDefault();
    focusable[nextIndex]?.focus();
  };

  #open(requiredGuide: boolean): void {
    this.#required = requiredGuide;
    this.#closeButton.hidden = requiredGuide;
    this.#beginButton.textContent = requiredGuide ? "Begin work" : "Return to work";
    this.#layer.hidden = false;
    this.#dialog.setAttribute("open", "");
    this.protectedSurface.inert = true;
    this.#dialog.scrollTop = 0;
    (requiredGuide ? this.#dialog : this.#closeButton).focus();
  }

  #close(restoreFocus: boolean): void {
    const wasOpen = !this.#layer.hidden;
    this.#layer.hidden = true;
    this.#dialog.removeAttribute("open");
    this.protectedSurface.inert = false;
    this.#required = false;
    if (restoreFocus && wasOpen) this.#returnFocus?.focus();
    this.#returnFocus = null;
  }
}
