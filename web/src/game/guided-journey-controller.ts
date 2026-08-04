import type { CampaignDocumentV1 } from "../domain/campaign-document";
import { creatorStageAllows } from "./creator-level-access";
import {
  evaluateGuidedJourney,
  type GuidedJourneyStep
} from "./guided-journey";

type OpenGuidedJourneyStep = (step: GuidedJourneyStep) => void;

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`Guided journey is missing ${selector}`);
  return element;
}

export class GuidedJourneyController {
  readonly #guide: HTMLElement;
  readonly #progress: HTMLElement;
  readonly #title: HTMLElement;
  readonly #now: HTMLElement;
  readonly #why: HTMLElement;
  readonly #done: HTMLElement;
  readonly #next: HTMLElement;
  readonly #methods: HTMLDetailsElement;
  readonly #methodList: HTMLUListElement;
  readonly #openTool: HTMLButtonElement;
  readonly #reviewButtons: readonly HTMLButtonElement[];
  readonly #dialog: HTMLElement;
  readonly #close: HTMLButtonElement;
  readonly #reference: HTMLElement;
  readonly #manualPosition: HTMLElement;
  readonly #manualPrevious: HTMLButtonElement;
  readonly #manualNext: HTMLButtonElement;
  readonly #lockStatus: HTMLElement;
  readonly #protectedSurfaces: readonly HTMLElement[];
  #current: GuidedJourneyStep | null = null;
  #returnFocus: HTMLElement | null = null;
  #manualPage = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly openStep: OpenGuidedJourneyStep
  ) {
    this.#guide = required(root, "[data-guide]");
    this.#progress = required(root, "[data-guide-progress]");
    this.#title = required(root, "[data-guide-title]");
    this.#now = required(root, "[data-guide-now]");
    this.#why = required(root, "[data-guide-why]");
    this.#done = required(root, "[data-guide-done]");
    this.#next = required(root, "dd[data-guide-next]");
    this.#methods = required(root, "[data-guide-methods]");
    this.#methodList = required(root, "[data-guide-method-list]");
    this.#openTool = required(root, "[data-guide-open-tool]");
    this.#reviewButtons = Object.freeze([
      required<HTMLButtonElement>(root, "[data-guide-review]"),
      required<HTMLButtonElement>(root, "[data-guide-review-top]")
    ]);
    this.#dialog = required(root, "[data-guide-dialog]");
    this.#close = required(root, "[data-guide-close]");
    this.#reference = required(root, "[data-guide-reference]");
    this.#manualPosition = required(root, "[data-guide-page-position]");
    this.#manualPrevious = required(root, "[data-guide-previous]");
    this.#manualNext = required(root, "button[data-guide-next]");
    this.#lockStatus = required(root, "[data-locked-actions-status]");
    const dialogParent = this.#dialog.parentElement;
    if (dialogParent === null) throw new Error("Guided journey dialog has no parent");
    this.#protectedSurfaces = Object.freeze(
      [...dialogParent.children].filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element !== this.#dialog
      )
    );
    this.#renderReference();

    this.#openTool.addEventListener("click", this.#onOpenTool);
    for (const button of this.#reviewButtons) {
      button.addEventListener("click", this.#onReview);
    }
    this.#close.addEventListener("click", this.#onClose);
    this.#manualPrevious.addEventListener("click", this.#onManualPrevious);
    this.#manualNext.addEventListener("click", this.#onManualNext);
    this.#dialog.addEventListener("keydown", this.#onDialogKeydown);
  }

  setCampaign(document: CampaignDocumentV1 | null): void {
    if (document === null) {
      this.#current = null;
      this.#guide.hidden = true;
      this.#closeDialog();
      return;
    }

    const state = evaluateGuidedJourney(document);
    this.#current = state.current;
    this.#guide.hidden = false;
    this.#progress.textContent = state.progressLabel;
    this.#title.textContent = state.current.title;
    this.#now.textContent = state.current.now;
    this.#why.textContent = state.current.why;
    this.#done.textContent = state.current.done;
    this.#next.textContent = state.current.next;
    const methods = state.current.optionalMethods ?? [];
    this.#methodList.replaceChildren(...methods.map((method) => {
      const item = this.#methodList.ownerDocument.createElement("li");
      item.textContent = method;
      return item;
    }));
    this.#methods.hidden = methods.length === 0;
    if (this.#methods.hidden) this.#methods.open = false;
    this.#openTool.textContent = state.current.actionLabel ??
      `${state.current.complete ? "Review" : "Open"} ${state.current.title}`;

    const completed = new Map(state.steps.map((step) => [step.id, step.complete]));
    this.#applySequentialAccess(document, completed);
  }

  destroy(): void {
    this.#openTool.removeEventListener("click", this.#onOpenTool);
    for (const button of this.#reviewButtons) {
      button.removeEventListener("click", this.#onReview);
    }
    this.#close.removeEventListener("click", this.#onClose);
    this.#manualPrevious.removeEventListener("click", this.#onManualPrevious);
    this.#manualNext.removeEventListener("click", this.#onManualNext);
    this.#dialog.removeEventListener("keydown", this.#onDialogKeydown);
    this.#closeDialog();
  }

  #applySequentialAccess(
    document: CampaignDocumentV1,
    completed: ReadonlyMap<string, boolean>
  ): void {
    const unavailable: Array<{
      readonly button: HTMLButtonElement;
      readonly label: string;
      readonly reason: string;
    }> = [];
    const setAvailability = (
      button: HTMLButtonElement,
      disabled: boolean,
      reason: string
    ): void => {
      button.disabled = disabled;
      button.removeAttribute("title");
      if (button.getAttribute("aria-describedby") === this.#lockStatus.id) {
        button.removeAttribute("aria-describedby");
      }
      if (disabled && !button.hidden) {
        unavailable.push({
          button,
          label: button.textContent?.trim() || button.getAttribute("aria-label") || "Action",
          reason
        });
      }
    };

    const aidaAllowed = creatorStageAllows(document.gameplay.stage, "aida") &&
      completed.get("pair-contribution") === true;
    const aidaOrder = ["attention", "interest", "desire", "action"] as const;
    for (const [index, stage] of aidaOrder.entries()) {
      const priorComplete = index === 0 || completed.get(aidaOrder[index - 1]!) === true;
      const stageComplete = completed.get(stage) === true;
      const button = required<HTMLButtonElement>(this.root, `[data-slot="${stage}"]`);
      const disabled = !stageComplete && (!aidaAllowed || !priorComplete);
      setAvailability(
        button,
        disabled,
        `Complete ${index === 0 ? "the pair contribution" : aidaOrder[index - 1]} first.`
      );
    }

    const allAidaComplete = aidaOrder.every((stage) => completed.get(stage) === true);
    const priceAllowed = creatorStageAllows(document.gameplay.stage, "price") && allAidaComplete;
    const priceChecklist = required<HTMLButtonElement>(this.root, '[data-slot="price"]');
    setAvailability(
      priceChecklist,
      !priceAllowed,
      "Complete Attention, Interest, Desire and Action first."
    );

    const routeTool = required<HTMLButtonElement>(this.root, '[data-studio-tool="route"]');
    const routeAllowed = creatorStageAllows(document.gameplay.stage, "route") &&
      completed.get("visible-price") === true;
    setAvailability(
      routeTool,
      !routeAllowed,
      "Set the product price and make it visible on the canvas first."
    );

    this.#lockStatus.textContent = unavailable
      .map(({ label, reason }) => `${label}: ${reason}`)
      .join(" ");
    this.#lockStatus.hidden = unavailable.length === 0;
    for (const { button } of unavailable) {
      button.setAttribute("aria-describedby", this.#lockStatus.id);
    }
  }

  #renderReference(): void {
    const pages = [
      ["Goal", "Make one persuasive advertisement with a partner, then explain why its choices suit the supplied audience."],
      ["Brief", "Read Context, Need, Values and Intended audience response before choosing the product or message."],
      ["Roles", "The Art Director leads appearance choices. The Strategist leads audience, message, evidence and offer choices. Both can use every available control."],
      ["Build", "Choose a product, then move, resize, recolour, add or remove an item in the advertisement when the next instruction asks for it."],
      ["Message", "Use Attention, Interest, Desire and Action one at a time. Explain how each visible choice helps the audience."],
      ["Pitch", "Complete the required missions, present the advertisement and explain how its product, message, price and proof fit the audience."]
    ] as const;
    this.#reference.replaceChildren(...pages.map(([title, copy], index) => {
      const section = document.createElement("section");
      section.dataset.guideManualPage = String(index);
      section.hidden = index !== 0;
      const heading = document.createElement("h3");
      heading.textContent = title;
      const paragraph = document.createElement("p");
      paragraph.textContent = copy;
      section.append(heading, paragraph);
      return section;
    }));
    this.#setManualPage(0);
  }

  #setManualPage(index: number): void {
    const pages = [...this.#reference.querySelectorAll<HTMLElement>("[data-guide-manual-page]")];
    this.#manualPage = Math.max(0, Math.min(index, pages.length - 1));
    pages.forEach((page, pageIndex) => { page.hidden = pageIndex !== this.#manualPage; });
    const title = pages[this.#manualPage]?.querySelector("h3")?.textContent ?? "Guide";
    this.#manualPosition.textContent = `Page ${this.#manualPage + 1} of ${pages.length} · ${title}`;
    this.#manualPrevious.hidden = this.#manualPage === 0;
    this.#manualNext.hidden = this.#manualPage === pages.length - 1;
  }

  readonly #onManualPrevious = (): void => this.#setManualPage(this.#manualPage - 1);
  readonly #onManualNext = (): void => this.#setManualPage(this.#manualPage + 1);

  readonly #onOpenTool = (): void => {
    if (this.#current !== null) this.openStep(this.#current);
  };

  readonly #onReview = (event: Event): void => {
    this.#returnFocus = event.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : null;
    for (const surface of this.#protectedSurfaces) surface.inert = true;
    this.#setManualPage(0);
    this.#dialog.hidden = false;
    this.#dialog.setAttribute("open", "");
    this.#close.focus();
  };

  readonly #onClose = (): void => {
    this.#closeDialog(true);
  };

  readonly #onDialogKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      this.#closeDialog(true);
      return;
    }
    if (event.key === "Tab") {
      const controls = [this.#manualPrevious, this.#manualNext, this.#close]
        .filter((control) => !control.hidden);
      const activeIndex = controls.indexOf(
        this.#dialog.ownerDocument.activeElement as HTMLButtonElement
      );
      const nextIndex = event.shiftKey
        ? (activeIndex <= 0 ? controls.length - 1 : activeIndex - 1)
        : (activeIndex + 1) % controls.length;
      event.preventDefault();
      controls[nextIndex]?.focus();
    }
  };

  #closeDialog(restoreFocus = false): void {
    if (!this.#dialog.hidden) {
      this.#dialog.hidden = true;
      this.#dialog.removeAttribute("open");
    }
    for (const surface of this.#protectedSurfaces) surface.inert = false;
    if (restoreFocus) this.#returnFocus?.focus();
    this.#returnFocus = null;
  }
}
