import type { CampaignDocumentV1 } from "../domain/campaign-document";
import { getAudienceBrief } from "./audience-briefs";

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`Studio onboarding is missing ${selector}`);
  return element;
}

const PAGES = Object.freeze([
  ["brief", "Brief"],
  ["roles", "Roles"],
  ["build", "Build area"],
  ["first-action", "First action"]
] as const);

export class StudioOnboardingController {
  readonly #layer: HTMLElement;
  readonly #dialog: HTMLElement;
  readonly #position: HTMLElement;
  readonly #pages: readonly HTMLElement[];
  readonly #previous: HTMLButtonElement;
  readonly #next: HTMLButtonElement;
  readonly #close: HTMLButtonElement;
  readonly #open: HTMLButtonElement;
  #index = 0;
  #hasCampaign = false;
  #required = false;
  #returnFocus: HTMLElement | null = null;

  constructor(
    root: ParentNode,
    private readonly protectedSurface: HTMLElement,
    private readonly acknowledge: () => void,
    private readonly focusStarter: () => void
  ) {
    this.#layer = required(root, "[data-studio-onboarding-layer]");
    this.#dialog = required(root, "[data-studio-onboarding-dialog]");
    this.#position = required(root, "[data-studio-onboarding-position]");
    this.#pages = Object.freeze(PAGES.map(([id]) =>
      required<HTMLElement>(root, `[data-studio-onboarding-page="${id}"]`)
    ));
    this.#previous = required(root, "[data-studio-onboarding-previous]");
    this.#next = required(root, "[data-studio-onboarding-next]");
    this.#close = required(root, "[data-studio-onboarding-close]");
    this.#open = required(root, "[data-studio-tour-open]");
    this.#previous.addEventListener("click", this.#onPrevious);
    this.#next.addEventListener("click", this.#onNext);
    this.#close.addEventListener("click", this.#onClose);
    this.#open.addEventListener("click", this.#onOpen);
    this.#dialog.addEventListener("keydown", this.#onKeydown);
  }

  setCampaign(document: CampaignDocumentV1 | null): void {
    this.#closeTour(false);
    this.#hasCampaign = document !== null;
    if (document === null) return;
    const brief = getAudienceBrief(document.brief.targetAudienceId || "after-school-wanderers");
    required<HTMLElement>(this.#dialog, "[data-onboarding-context]").textContent = brief.context;
    required<HTMLElement>(this.#dialog, "[data-onboarding-need]").textContent = brief.need;
    required<HTMLElement>(this.#dialog, "[data-onboarding-values]").textContent = brief.values.join(", ");
    required<HTMLElement>(this.#dialog, "[data-onboarding-effect]").textContent = brief.intendedEffect;
    this.#required = !document.gameplay.pair.roleGuideAcknowledged;
    if (this.#required) this.#show(0);
  }

  destroy(): void {
    this.#previous.removeEventListener("click", this.#onPrevious);
    this.#next.removeEventListener("click", this.#onNext);
    this.#close.removeEventListener("click", this.#onClose);
    this.#open.removeEventListener("click", this.#onOpen);
    this.#dialog.removeEventListener("keydown", this.#onKeydown);
    this.#closeTour(false);
  }

  readonly #onPrevious = (): void => this.#show(this.#index - 1);
  readonly #onNext = (): void => {
    if (this.#index < PAGES.length - 1) this.#show(this.#index + 1);
    else {
      if (this.#required) this.acknowledge();
      this.#required = false;
      this.#closeTour(false);
      this.focusStarter();
    }
  };
  readonly #onClose = (): void => this.#closeTour(true);
  readonly #onOpen = (event: Event): void => {
    if (!this.#hasCampaign) return;
    this.#returnFocus = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.#show(0);
  };
  readonly #onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") { event.preventDefault(); this.#closeTour(true); return; }
    if (event.key === "ArrowLeft") { event.preventDefault(); this.#show(this.#index - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); this.#onNext(); }
  };

  #show(index: number): void {
    this.#index = Math.max(0, Math.min(index, PAGES.length - 1));
    this.#pages.forEach((page, pageIndex) => { page.hidden = pageIndex !== this.#index; });
    this.#position.textContent = `Page ${this.#index + 1} of ${PAGES.length} · ${PAGES[this.#index]![1]}`;
    this.#previous.hidden = this.#index === 0;
    this.#next.textContent = this.#index === PAGES.length - 1 ? "Start with a product" : "Next";
    this.#layer.hidden = false;
    this.#dialog.setAttribute("open", "");
    this.protectedSurface.inert = true;
    this.#dialog.focus();
  }

  #closeTour(restoreFocus: boolean): void {
    const wasOpen = !this.#layer.hidden;
    this.#layer.hidden = true;
    this.#dialog.removeAttribute("open");
    this.protectedSurface.inert = false;
    if (restoreFocus && wasOpen) this.#returnFocus?.focus();
    this.#returnFocus = null;
  }
}
