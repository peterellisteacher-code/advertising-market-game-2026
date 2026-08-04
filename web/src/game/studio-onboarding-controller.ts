import type { CampaignDocumentV1 } from "../domain/campaign-document";
import { getAudienceBrief } from "./audience-briefs";
import { STUDENT_COPY } from "./student-copy";

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
  readonly #briefHelp: readonly HTMLButtonElement[];
  #index = 0;
  #hasCampaign = false;
  #required = false;
  #returnFocus: HTMLElement | null = null;
  #helpCard: HTMLElement | null = null;
  #helpReturnFocus: HTMLButtonElement | null = null;

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
    this.#briefHelp = Object.freeze(Array.from(
      root.querySelectorAll<HTMLButtonElement>("[data-studio-onboarding-help]")
    ));
    this.#previous.addEventListener("click", this.#onPrevious);
    this.#next.addEventListener("click", this.#onNext);
    this.#close.addEventListener("click", this.#onClose);
    this.#open.addEventListener("click", this.#onOpen);
    this.#briefHelp.forEach((help) => help.addEventListener("click", this.#onBriefHelp));
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
    this.#briefHelp.forEach((help) => help.removeEventListener("click", this.#onBriefHelp));
    this.#dialog.removeEventListener("keydown", this.#onKeydown);
    this.#dismissBriefHelp(false);
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
  readonly #onBriefHelp = (event: Event): void => {
    const help = event.currentTarget;
    if (!(help instanceof HTMLButtonElement)) return;
    this.#dismissBriefHelp(false);
    const key = help.dataset.studioOnboardingHelp as keyof typeof STUDENT_COPY.audienceBriefDefinitions;
    const label = help.dataset.studioOnboardingHelpLabel ?? "this heading";
    const card = this.#dialog.ownerDocument.createElement("section");
    card.className = "creator__onboarding-brief-help-card";
    card.dataset.studioOnboardingHelpCard = "";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", `About ${label}`);
    card.innerHTML = `<p>${STUDENT_COPY.audienceBriefDefinitions[key]}</p><button type="button" aria-label="Close ${label} definition">×</button>`;
    const dismiss = required<HTMLButtonElement>(card, "button");
    this.#helpCard = card;
    this.#helpReturnFocus = help;
    dismiss.addEventListener("click", this.#onBriefHelpClose);
    card.addEventListener("keydown", this.#onBriefHelpKeydown);
    help.closest("div")?.append(card);
    dismiss.focus();
  };
  readonly #onBriefHelpClose = (): void => this.#dismissBriefHelp(true);
  readonly #onBriefHelpKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    this.#dismissBriefHelp(true);
  };
  readonly #onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") { event.preventDefault(); this.#closeTour(true); return; }
    if (event.key === "Tab") {
      const controls = this.#visibleControls();
      const currentIndex = controls.indexOf(this.#dialog.ownerDocument.activeElement as HTMLButtonElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? controls.length - 1 : currentIndex - 1)
        : (currentIndex + 1) % controls.length;
      event.preventDefault();
      controls[nextIndex]?.focus();
      return;
    }
    if (event.key === "ArrowLeft") { event.preventDefault(); this.#show(this.#index - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); this.#onNext(); }
  };

  #visibleControls(): HTMLButtonElement[] {
    return [this.#close, this.#previous, this.#next].filter((control) => !control.hidden);
  }

  #dismissBriefHelp(restoreFocus: boolean): void {
    const card = this.#helpCard;
    const help = this.#helpReturnFocus;
    this.#helpCard = null;
    this.#helpReturnFocus = null;
    if (card !== null) {
      required<HTMLButtonElement>(card, "button").removeEventListener("click", this.#onBriefHelpClose);
      card.removeEventListener("keydown", this.#onBriefHelpKeydown);
      card.remove();
    }
    if (restoreFocus) help?.focus();
  }

  #show(index: number): void {
    this.#dismissBriefHelp(false);
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
    this.#dismissBriefHelp(false);
    this.#layer.hidden = true;
    this.#dialog.removeAttribute("open");
    this.protectedSurface.inert = false;
    if (restoreFocus && wasOpen) (this.#returnFocus ?? this.#open).focus();
    this.#returnFocus = null;
  }
}
