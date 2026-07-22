import type {
  StudioCoachTechniqueId,
  StudioCoachTurnOneResponse,
  StudioCoachTurnTwoResponse
} from "../../../shared/studio-coach-contract";
import type { StudioCoachRuntimeState } from "./studio-coach-runtime";
import {
  STUDIO_COACH_TECHNIQUES,
  studioCoachTechnique
} from "./technique-catalogue";

export interface StudioCoachPanelActions {
  state(): StudioCoachRuntimeState;
  subscribe(listener: () => void): () => void;
  requestInitial(mode: "technique" | "whole-ad", techniqueId?: StudioCoachTechniqueId): Promise<unknown>;
  requestRevision(): Promise<unknown>;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const created = document.createElement(tag);
  if (text !== undefined) created.textContent = text;
  return created;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const created = element("button", label);
  created.type = "button";
  created.addEventListener("click", onClick);
  return created;
}

export class StudioCoachPanel {
  #techniqueId: StudioCoachTechniqueId = "salience";
  readonly #unsubscribe: () => void;

  constructor(
    private readonly host: HTMLElement,
    private readonly actions: StudioCoachPanelActions
  ) {
    this.#unsubscribe = actions.subscribe(() => this.#draw());
    this.#draw();
  }

  dispose(): void {
    this.#unsubscribe();
    this.host.replaceChildren();
  }

  #draw(): void {
    const state = this.actions.state();
    const root = element("div");
    root.className = "studio-coach";
    const progress = element("p", "Two checks for this ad");
    progress.className = "studio-coach__progress";
    const rule = element("p", "Check 1 gives one visual move. Check 2 only compares your revision.");
    rule.className = "studio-coach__rule";
    root.append(progress, rule);

    if (state.error) {
      const error = element("p", state.error);
      error.setAttribute("role", "alert");
      error.className = "studio-coach__error";
      root.append(error);
    }

    if (state.first) root.append(this.#firstFeedback(state.first));
    if (state.final) root.append(this.#finalFeedback(state.final));

    if (state.phase === "ready" || (state.phase === "error" && state.first === null)) {
      root.append(this.#firstAction(state));
    } else if (state.phase === "checking-initial") {
      root.append(this.#busy("Checking the current advertisement…"));
    } else if (state.phase === "advice") {
      root.append(this.#revisionAction(state));
    } else if (state.phase === "checking-revision") {
      root.append(this.#busy("Comparing the revision…"));
    }

    if (state.phase === "complete") {
      const complete = element("p", "Coach session complete.");
      complete.className = "studio-coach__complete";
      complete.setAttribute("role", "status");
      root.append(complete);
    }
    root.append(this.#techniqueReference());
    this.host.replaceChildren(root);
  }

  #firstAction(state: StudioCoachRuntimeState): HTMLElement {
    const section = element("section");
    section.className = "studio-coach__action";
    section.setAttribute("aria-label", "First Studio Coach check");
    const heading = element("h3", state.attemptsUsed === 0 ? "Choose one check" : "One check remains");
    const label = element("label", "Technique to check");
    const select = element("select");
    select.setAttribute("aria-label", "Technique to check");
    for (const technique of STUDIO_COACH_TECHNIQUES) {
      const option = element("option", technique.label);
      option.value = technique.id;
      option.selected = technique.id === this.#techniqueId;
      select.append(option);
    }
    select.addEventListener("change", () => {
      this.#techniqueId = select.value as StudioCoachTechniqueId;
      this.#draw();
    });
    label.append(select);
    const technique = button(
      state.attemptsUsed === 0 ? "Check this technique (1 of 2)" : "Try the first check (2 of 2)",
      () => this.#perform(this.actions.requestInitial("technique", this.#techniqueId))
    );
    const whole = button(
      state.attemptsUsed === 0 ? "Check the whole ad (1 of 2)" : "Try the whole ad (2 of 2)",
      () => this.#perform(this.actions.requestInitial("whole-ad"))
    );
    whole.className = "studio-coach__secondary";
    section.append(heading, label, technique, whole);
    return section;
  }

  #revisionAction(state: StudioCoachRuntimeState): HTMLElement {
    const section = element("section");
    section.className = "studio-coach__action studio-coach__revision";
    section.setAttribute("aria-label", "Final Studio Coach check");
    section.append(element("h3", "Now revise the ad"));
    const instruction = element("p", "Make the visual change above. Then use the final check.");
    const check = button("Check my revision (2 of 2)", () => this.#perform(this.actions.requestRevision()));
    check.disabled = !state.changedSinceFirst;
    section.append(instruction, check);
    return section;
  }

  #firstFeedback(response: StudioCoachTurnOneResponse): HTMLElement {
    const article = element("article");
    article.className = "studio-coach__feedback";
    article.setAttribute("aria-label", "Studio Coach advice");
    article.append(element("h3", "One move to try"));
    article.append(this.#fact("What I can see", response.observation));
    article.append(this.#fact("Why it matters", response.effect));
    article.append(this.#fact("Change", response.nextMove));
    article.append(this.#fact("Check it", response.selfCheck));
    return article;
  }

  #finalFeedback(response: StudioCoachTurnTwoResponse): HTMLElement {
    const article = element("article");
    article.className = "studio-coach__feedback studio-coach__feedback--final";
    article.setAttribute("aria-label", "Studio Coach comparison");
    const verdict = response.verdict === "not-evident"
      ? "Not evident"
      : response.verdict[0]!.toUpperCase() + response.verdict.slice(1);
    article.append(element("h3", verdict));
    article.append(this.#fact("What changed", response.whatChanged));
    article.append(this.#fact("Effect", response.why));
    return article;
  }

  #fact(label: string, value: string): HTMLElement {
    const paragraph = element("p");
    const strong = element("strong", `${label}: `);
    paragraph.append(strong, document.createTextNode(value));
    return paragraph;
  }

  #busy(message: string): HTMLElement {
    const status = element("p", message);
    status.className = "studio-coach__busy";
    status.setAttribute("role", "status");
    return status;
  }

  #perform(operation: Promise<unknown>): void {
    void operation.catch(() => {
      // The runtime records and renders the typed error state.
    });
  }

  #techniqueReference(): HTMLElement {
    const technique = studioCoachTechnique(this.#techniqueId);
    const article = element("article");
    article.className = "studio-coach__reference";
    article.setAttribute("aria-label", `${technique.label} example`);
    const preview = element("div");
    preview.className = "studio-coach__preview";
    preview.dataset.techniquePreview = technique.id;
    preview.setAttribute("aria-hidden", "true");
    preview.append(element("span"), element("span"), element("span"));
    article.append(element("h3", technique.label), preview);
    article.append(this.#fact("What it does", technique.definition));
    article.append(this.#fact("Effect", technique.effect));
    article.append(this.#fact("Example", technique.example));
    return article;
  }
}
