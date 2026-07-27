import type { CampaignDocumentV1 } from "../domain/campaign-document";
import { creatorStageAllows } from "./creator-level-access";
import {
  evaluateGuidedJourney,
  type GuidedJourneyStep
} from "./guided-journey";
import { INSTRUCTION_ARGUMENT } from "./instruction-argument";

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
  readonly #openTool: HTMLButtonElement;
  readonly #reviewButtons: readonly HTMLButtonElement[];
  readonly #dialog: HTMLElement;
  readonly #close: HTMLButtonElement;
  readonly #reference: HTMLElement;
  #current: GuidedJourneyStep | null = null;
  #returnFocus: HTMLElement | null = null;

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
    this.#next = required(root, "[data-guide-next]");
    this.#openTool = required(root, "[data-guide-open-tool]");
    this.#reviewButtons = Object.freeze([
      required<HTMLButtonElement>(root, "[data-guide-review]"),
      required<HTMLButtonElement>(root, "[data-guide-review-top]")
    ]);
    this.#dialog = required(root, "[data-guide-dialog]");
    this.#close = required(root, "[data-guide-close]");
    this.#reference = required(root, "[data-guide-reference]");
    this.#renderReference();

    this.#openTool.addEventListener("click", this.#onOpenTool);
    for (const button of this.#reviewButtons) {
      button.addEventListener("click", this.#onReview);
    }
    this.#close.addEventListener("click", this.#onClose);
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
    this.#dialog.removeEventListener("keydown", this.#onDialogKeydown);
    this.#closeDialog();
  }

  #applySequentialAccess(
    document: CampaignDocumentV1,
    completed: ReadonlyMap<string, boolean>
  ): void {
    const aidaAllowed = creatorStageAllows(document.gameplay.stage, "aida") &&
      completed.get("pair-contribution") === true;
    const aidaOrder = ["attention", "interest", "desire", "action"] as const;
    for (const [index, stage] of aidaOrder.entries()) {
      const priorComplete = index === 0 || completed.get(aidaOrder[index - 1]!) === true;
      const stageComplete = completed.get(stage) === true;
      const button = required<HTMLButtonElement>(this.root, `[data-slot="${stage}"]`);
      button.disabled = !stageComplete && (!aidaAllowed || !priorComplete);
      button.title = button.disabled
        ? `Complete ${index === 0 ? "the pair contribution" : aidaOrder[index - 1]} first.`
        : "";
    }

    const allAidaComplete = aidaOrder.every((stage) => completed.get(stage) === true);
    const priceAllowed = creatorStageAllows(document.gameplay.stage, "price") && allAidaComplete;
    const priceChecklist = required<HTMLButtonElement>(this.root, '[data-slot="price"]');
    priceChecklist.disabled = !priceAllowed;
    priceChecklist.title = priceAllowed ? "" : "Complete Attention, Interest, Desire and Action first.";

    const routeTool = required<HTMLButtonElement>(this.root, '[data-studio-tool="route"]');
    const routeAllowed = creatorStageAllows(document.gameplay.stage, "route") &&
      completed.get("price-evidence") === true;
    routeTool.disabled = !routeAllowed;
    routeTool.title = routeAllowed
      ? ""
      : "Set the product price and make it visible on the canvas first.";
  }

  #renderReference(): void {
    const fragment = document.createDocumentFragment();
    const introduction = document.createElement("p");
    introduction.textContent =
      "Complete each linked action in order. You may return to completed work at any time.";
    fragment.append(introduction);

    for (const subargument of INSTRUCTION_ARGUMENT) {
      const section = document.createElement("section");
      section.dataset.instructionSubargument = subargument.id;
      const heading = document.createElement("h3");
      heading.textContent = `${subargument.id}. ${subargument.title}`;
      section.append(heading);

      const premises = subargument.claims.filter(({ kind }) => kind === "premise");
      const list = document.createElement("ol");
      if (premises.length > 0) {
        list.start = Number.parseInt(premises[0]!.id.slice(1), 10);
      }
      for (const premise of premises) {
        const item = document.createElement("li");
        item.value = Number.parseInt(premise.id.slice(1), 10);
        item.dataset.instructionClaimId = premise.id;
        item.textContent = premise.text;
        list.append(item);
      }
      section.append(list);

      const conclusion = subargument.claims.find(
        ({ id }) => id === subargument.conclusionId
      );
      if (conclusion !== undefined) {
        const paragraph = document.createElement("p");
        paragraph.dataset.instructionClaimId = conclusion.id;
        const label = document.createElement("strong");
        label.textContent = conclusion.kind === "overall-conclusion"
          ? "Overall conclusion: "
          : `Intermediate conclusion ${subargument.id}: `;
        paragraph.append(label, conclusion.text);
        section.append(paragraph);
      }
      fragment.append(section);
    }

    this.#reference.replaceChildren(fragment);
  }

  readonly #onOpenTool = (): void => {
    if (this.#current !== null) this.openStep(this.#current);
  };

  readonly #onReview = (event: Event): void => {
    this.#returnFocus = event.currentTarget instanceof HTMLElement
      ? event.currentTarget
      : null;
    this.#dialog.hidden = false;
    this.#dialog.setAttribute("open", "");
    this.#close.focus();
  };

  readonly #onClose = (): void => {
    this.#closeDialog(true);
  };

  readonly #onDialogKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    this.#closeDialog(true);
  };

  #closeDialog(restoreFocus = false): void {
    if (!this.#dialog.hidden) {
      this.#dialog.hidden = true;
      this.#dialog.removeAttribute("open");
    }
    if (restoreFocus) this.#returnFocus?.focus();
    this.#returnFocus = null;
  }
}
