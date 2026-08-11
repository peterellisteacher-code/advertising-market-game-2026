import {
  ASSIGNMENT_DESIRE_VALUES,
  AssignmentPlanSchema,
  createBlankAssignmentPlan,
  type AssignmentDesireValueId,
  type AssignmentPlanV1
} from "./assignment-plan";

export interface AssignmentPlannerPanelState {
  readonly productName: string;
  readonly plan: AssignmentPlanV1;
}

export type AssignmentPlannerCommitHandler = (
  productName: string,
  plan: AssignmentPlanV1
) => void | Promise<void>;

type PlanTextField = Exclude<keyof AssignmentPlanV1,
  "desireValueIds" | "primaryDesireValueId" | "productAidaPlan">;
type AidaField = keyof AssignmentPlanV1["productAidaPlan"];

function element<K extends keyof HTMLElementTagNameMap>(
  name: K,
  className?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(name);
  if (className) node.className = className;
  return node;
}

function immutablePlan(value: AssignmentPlanV1): AssignmentPlanV1 {
  const parsed = AssignmentPlanSchema.parse(structuredClone(value));
  Object.freeze(parsed.desireValueIds);
  Object.freeze(parsed.productAidaPlan);
  return Object.freeze(parsed);
}

export class AssignmentPlannerPanel {
  #state: AssignmentPlannerPanelState = {
    productName: "",
    plan: createBlankAssignmentPlan()
  };
  #operation = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly onCommit: AssignmentPlannerCommitHandler
  ) {}

  setState(state: AssignmentPlannerPanelState): void {
    this.#operation += 1;
    this.#state = {
      productName: state.productName,
      plan: AssignmentPlanSchema.parse(structuredClone(state.plan))
    };
    this.#draw();
  }

  #appendTextField(
    parent: HTMLElement,
    labelText: string,
    focusKey: string,
    value: string,
    maxLength: number,
    onChange: (value: string) => AssignmentPlannerPanelState,
    multiline = false
  ): void {
    const label = element("label", "assignment-planner__field");
    const text = element("span");
    text.textContent = labelText;
    const control = multiline ? element("textarea") : element("input");
    if (control instanceof HTMLTextAreaElement) control.rows = 3;
    control.maxLength = maxLength;
    control.value = value;
    control.dataset.assignmentFocus = focusKey;
    control.addEventListener("change", () => {
      void this.#save(onChange(control.value), focusKey);
    });
    label.append(text, control);
    parent.append(label);
  }

  #textState(field: PlanTextField, value: string): AssignmentPlannerPanelState {
    return {
      ...this.#state,
      plan: { ...this.#state.plan, [field]: value }
    };
  }

  #aidaState(field: AidaField, value: string): AssignmentPlannerPanelState {
    return {
      ...this.#state,
      plan: {
        ...this.#state.plan,
        productAidaPlan: { ...this.#state.plan.productAidaPlan, [field]: value }
      }
    };
  }

  async #save(next: AssignmentPlannerPanelState, focusKey: string): Promise<void> {
    const operation = ++this.#operation;
    const status = this.host.querySelector<HTMLElement>("[role=status]");
    if (status) status.textContent = "Saving…";
    try {
      const nextState = {
        productName: next.productName,
        plan: AssignmentPlanSchema.parse(structuredClone(next.plan))
      };
      this.#state = nextState;
      await this.onCommit(nextState.productName, immutablePlan(nextState.plan));
      if (operation !== this.#operation) return;
      this.#draw();
      const saved = this.host.querySelector<HTMLElement>("[role=status]");
      if (saved) saved.textContent = "Saved";
      [...this.host.querySelectorAll<HTMLElement>("[data-assignment-focus]")]
        .find((control) => control.dataset.assignmentFocus === focusKey)
        ?.focus();
    } catch (error) {
      if (operation !== this.#operation) return;
      const current = this.host.querySelector<HTMLElement>("[role=status]");
      if (current) current.textContent = error instanceof Error ? error.message : "Save failed.";
    }
  }

  #draw(): void {
    const root = element("div", "assignment-planner");
    const intro = element("p", "assignment-planner__intro");
    intro.textContent = "Plan the product first. Then decide how the advertisement will communicate it.";

    const define = element("section", "assignment-planner__section");
    const defineHeading = element("h3");
    defineHeading.textContent = "Define the product";
    define.append(defineHeading);
    this.#appendTextField(define, "Product name for this assignment", "product-name",
      this.#state.productName, 48,
      (value) => ({ ...this.#state, productName: value }));
    const textFields: readonly [PlanTextField, string, number, boolean?][] = [
      ["productFunction", "What does the product do?", 280, true],
      ["targetAudience", "Who is the target audience?", 160],
      ["advertisingLocation", "Where will the advertisement appear?", 160],
      ["featureToEmphasise", "Which feature will you emphasise?", 280, true],
      ["differenceFromAlternatives", "How is it different from alternatives?", 280, true],
      ["materials", "What materials will it use?", 280, true],
      ["estimatedProductionCost", "Estimated production cost", 80],
      ["salePrice", "Planned sale price", 80]
    ];
    for (const [field, label, maximum, multiline] of textFields) {
      this.#appendTextField(define, label, field, this.#state.plan[field], maximum,
        (value) => this.#textState(field, value), multiline);
    }

    const productAida = element("section", "assignment-planner__section");
    const productAidaHeading = element("h3");
    productAidaHeading.textContent = "Product AIDA";
    const productAidaNote = element("p");
    productAidaNote.textContent = "Explain the product's promise before planning the advertisement itself.";
    productAida.append(productAidaHeading, productAidaNote);
    const aidaFields: readonly [AidaField, string][] = [
      ["attention", "Attention — what about the product should grab attention?"],
      ["interest", "Interest — which features add interest?"],
      ["desire", "Desire — how could the audience imagine life with it?"],
      ["action", "Action — what honest next step should the audience take?"]
    ];
    for (const [field, label] of aidaFields) {
      this.#appendTextField(productAida, label, `product-aida-${field}`,
        this.#state.plan.productAidaPlan[field], 280,
        (value) => this.#aidaState(field, value), true);
    }

    const values = element("section", "assignment-planner__section");
    const valuesHeading = element("h3");
    valuesHeading.textContent = "Values for Desire";
    const valuesNote = element("p");
    valuesNote.textContent = "Choose up to twelve audience values, then mark the most important one.";
    values.append(valuesHeading, valuesNote);
    const families = [...new Set(ASSIGNMENT_DESIRE_VALUES.map(({ family }) => family))];
    for (const family of families) {
      const group = element("fieldset", "assignment-planner__values");
      const legend = element("legend");
      legend.textContent = family;
      group.append(legend);
      for (const item of ASSIGNMENT_DESIRE_VALUES.filter((value) => value.family === family)) {
        const row = element("div", "assignment-planner__value");
        const choose = element("label");
        const checkbox = element("input");
        checkbox.type = "checkbox";
        checkbox.checked = this.#state.plan.desireValueIds.includes(item.id);
        checkbox.disabled = !checkbox.checked && this.#state.plan.desireValueIds.length >= 12;
        checkbox.dataset.assignmentFocus = `value-${item.id}`;
        choose.append(checkbox, document.createTextNode(item.label));
        checkbox.addEventListener("change", () => {
          const selected = new Set(this.#state.plan.desireValueIds);
          if (checkbox.checked) selected.add(item.id);
          else selected.delete(item.id);
          const nextIds = [...selected] as AssignmentDesireValueId[];
          const primary = nextIds.includes(this.#state.plan.primaryDesireValueId as AssignmentDesireValueId)
            ? this.#state.plan.primaryDesireValueId
            : "";
          void this.#save({
            ...this.#state,
            plan: {
              ...this.#state.plan,
              desireValueIds: nextIds,
              primaryDesireValueId: primary
            }
          }, `value-${item.id}`);
        });

        const primaryLabel = element("label");
        const radio = element("input");
        radio.type = "radio";
        radio.name = "assignment-primary-desire-value";
        radio.checked = this.#state.plan.primaryDesireValueId === item.id;
        radio.disabled = !checkbox.checked;
        radio.setAttribute("aria-label", `Make ${item.label} the main value`);
        radio.dataset.assignmentFocus = `primary-${item.id}`;
        primaryLabel.append(radio, document.createTextNode("Main"));
        radio.addEventListener("change", () => {
          if (!radio.checked || !this.#state.plan.desireValueIds.includes(item.id)) return;
          void this.#save({
            ...this.#state,
            plan: { ...this.#state.plan, primaryDesireValueId: item.id }
          }, `primary-${item.id}`);
        });
        row.append(choose, primaryLabel);
        group.append(row);
      }
      values.append(group);
    }

    const handoff = element("section", "assignment-planner__section");
    const handoffHeading = element("h3");
    handoffHeading.textContent = "Advertisement AIDA";
    const handoffText = element("p");
    handoffText.textContent = "Now use the technique deck below to plan what this advertisement will show and say.";
    handoff.append(handoffHeading, handoffText);
    const status = element("p", "assignment-planner__status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    root.append(intro, define, productAida, values, handoff, status);
    this.host.replaceChildren(root);
  }
}
