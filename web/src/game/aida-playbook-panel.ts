import type { CampaignDocumentV1 } from "../domain/campaign-document";
import type { WorkspaceMode } from "./assignment-plan";
import { getAidaStage, type AidaStage } from "./aida-playbook";

export interface AidaPlaybookPanelState {
  readonly stage: AidaStage;
  readonly plan: CampaignDocumentV1["strategy"]["aidaPlan"];
  readonly workspaceMode?: WorkspaceMode;
}

export type AidaPlanCommitHandler = (
  stage: AidaStage,
  value: string
) => void | Promise<void>;

const nextAidaStage: Record<AidaStage, string> = {
  attention: "Interest",
  interest: "Desire",
  desire: "Action",
  action: ""
};

function element<K extends keyof HTMLElementTagNameMap>(
  name: K,
  className?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(name);
  if (className) node.className = className;
  return node;
}

export class AidaPlaybookPanel {
  #state: AidaPlaybookPanelState = {
    stage: "attention",
    workspaceMode: "guided",
    plan: { attention: "", interest: "", desire: "", action: "" }
  };
  #operation = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly onCommit: AidaPlanCommitHandler
  ) {}

  setState(state: AidaPlaybookPanelState): void {
    this.#operation += 1;
    this.#state = { ...structuredClone(state), workspaceMode: state.workspaceMode ?? "guided" };
    this.#draw();
  }

  #draw(): void {
    const definition = getAidaStage(this.#state.stage);
    const sandbox = this.#state.workspaceMode === "assignment-sandbox";
    const root = element("div", "aida-playbook");
    root.dataset.stage = definition.id;
    const heading = element("h3");
    heading.textContent = sandbox ? `Advertisement AIDA — ${definition.heading}` : definition.heading;
    const purpose = element("p", "aida-playbook__purpose");
    purpose.textContent = definition.purpose;
    const deckLabel = element("p", "aida-playbook__deck-label");
    deckLabel.textContent = sandbox
      ? "Choose how the advertisement communicates each stage. You can link it to a selected visible item, but you do not need one to save the plan."
      : "Choose a technique or write your own. Each technique states how a visible choice affects the audience. Select the item that delivers it.";
    const deck = element("div", "aida-playbook__deck");
    deck.setAttribute("role", "group");
    deck.setAttribute("aria-label", `${definition.label} techniques`);

    const idea = element("textarea");
    idea.rows = 4;
    idea.maxLength = 280;
    idea.value = this.#state.plan[definition.id];
    idea.setAttribute("aria-label", `Your ${definition.label} technique`);

    const appendMove = (candidate: (typeof definition.moves)[number]): void => {
      const card = element("button", "aida-playbook__move");
      card.type = "button";
      card.setAttribute("aria-label", `Try technique: ${candidate.label}`);
      const strong = element("strong");
      strong.textContent = candidate.label;
      const clue = element("span");
      clue.textContent = candidate.clue;
      card.append(strong, clue);
      card.addEventListener("click", () => {
        idea.value = candidate.starter;
        idea.dispatchEvent(new Event("input", { bubbles: true }));
        idea.focus();
      });
      deck.append(card);
    };
    for (const candidate of definition.moves.slice(0, 5)) {
      appendMove(candidate);
    }
    const more = element("button", "aida-playbook__more");
    more.type = "button";
    more.textContent = "Show five more techniques";
    more.addEventListener("click", () => {
      definition.moves.slice(5).forEach(appendMove);
      more.remove();
    });

    const label = element("label", "aida-playbook__idea");
    const labelText = element("span");
    labelText.textContent = `Your ${definition.label} technique`;
    label.append(labelText, idea);
    const status = element("p", "aida-playbook__status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    const save = element("button", "aida-playbook__save");
    save.type = "button";
    save.textContent = `Lock in ${definition.label}`;
    const refresh = (): void => { save.disabled = idea.value.trim().length === 0; };
    idea.addEventListener("input", refresh);
    save.addEventListener("click", async () => {
      const value = idea.value.trim();
      if (!value || save.disabled) return;
      const operation = ++this.#operation;
      save.disabled = true;
      status.textContent = `Locking in the ${definition.label} technique…`;
      try {
        await this.onCommit(definition.id, value);
        if (operation !== this.#operation) return;
        this.#state = {
          ...this.#state,
          plan: { ...this.#state.plan, [definition.id]: value }
        };
        status.textContent = sandbox
          ? (definition.id === "action"
              ? "Advertisement Action saved. Advertisement AIDA is complete."
              : `Advertisement ${definition.label} saved. Next: ${nextAidaStage[definition.id]}.`)
          : (definition.id === "action"
              ? "Action technique locked to the selected item. AIDA is complete. Return to the game."
              : `${definition.label} technique locked to the selected item. Next: ${nextAidaStage[definition.id]}.`);
      } catch (error) {
        if (operation !== this.#operation) return;
      status.textContent = error instanceof Error ? error.message : "Save failed.";
      } finally {
        if (operation === this.#operation) refresh();
      }
    });
    refresh();
    root.append(heading, purpose, deckLabel, deck, more, label, status, save);
    this.host.replaceChildren(root);
  }
}
