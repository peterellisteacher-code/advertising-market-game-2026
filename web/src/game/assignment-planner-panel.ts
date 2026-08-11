import {
  ASSIGNMENT_DESIRE_VALUES,
  AssignmentPlanSchema,
  createBlankAssignmentPlan,
  type AssignmentDesireValueId,
  type AssignmentPlanV1
} from "./assignment-plan";
import { STUDENT_COPY } from "./student-copy";

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

let assignmentPlannerInstance = 0;

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
  readonly #idPrefix = `assignment-planner-${++assignmentPlannerInstance}`;
  readonly #openSections = new Set(["define-product"]);

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
    control.id = `${this.#idPrefix}-${focusKey}`;
    label.htmlFor = control.id;
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

  #section(key: string, title: string): { details: HTMLDetailsElement; body: HTMLElement } {
    const details = element("details", "assignment-planner__section");
    const summary = element("summary", "assignment-planner__summary");
    const heading = element("span");
    heading.id = `${this.#idPrefix}-${key}-heading`;
    heading.setAttribute("role", "heading");
    heading.setAttribute("aria-level", "3");
    heading.textContent = title;
    summary.tabIndex = 0;
    summary.append(heading);
    const body = element("div", "assignment-planner__section-body");
    details.open = this.#openSections.has(key);
    details.setAttribute("role", "group");
    details.setAttribute("aria-label", title);
    details.addEventListener("toggle", () => {
      if (details.open) this.#openSections.add(key);
      else this.#openSections.delete(key);
    });
    details.append(summary, body);
    return { details, body };
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
    if (status) status.textContent = STUDENT_COPY.assignmentSandbox.planner.saving;
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
      if (saved) saved.textContent = STUDENT_COPY.assignmentSandbox.planner.saved;
      [...this.host.querySelectorAll<HTMLElement>("[data-assignment-focus]")]
        .find((control) => control.dataset.assignmentFocus === focusKey)
        ?.focus();
    } catch (error) {
      if (operation !== this.#operation) return;
      const current = this.host.querySelector<HTMLElement>("[role=status]");
      if (current) current.textContent = error instanceof Error
        ? error.message
        : STUDENT_COPY.assignmentSandbox.planner.saveFailed;
    }
  }

  #draw(): void {
    const copy = STUDENT_COPY.assignmentSandbox.planner;
    const root = element("div", "assignment-planner");
    const intro = element("p", "assignment-planner__intro");
    intro.textContent = copy.intro;

    const defineSection = this.#section("define-product", copy.sections.defineProduct);
    const define = defineSection.body;
    this.#appendTextField(define, copy.fields.productName, "product-name",
      this.#state.productName, 48,
      (value) => ({ ...this.#state, productName: value }));
    const textFields: readonly [PlanTextField, string, number, boolean?][] = [
      ["productFunction", copy.fields.productFunction, 280, true],
      ["targetAudience", copy.fields.targetAudience, 160],
      ["advertisingLocation", copy.fields.advertisingLocation, 160],
      ["featureToEmphasise", copy.fields.featureToEmphasise, 280, true],
      ["differenceFromAlternatives", copy.fields.differenceFromAlternatives, 280, true],
      ["materials", copy.fields.materials, 280, true],
      ["estimatedProductionCost", copy.fields.estimatedProductionCost, 80],
      ["salePrice", copy.fields.salePrice, 80]
    ];
    for (const [field, label, maximum, multiline] of textFields) {
      this.#appendTextField(define, label, field, this.#state.plan[field], maximum,
        (value) => this.#textState(field, value), multiline);
    }

    const productAidaSection = this.#section("product-aida", copy.sections.productAida);
    const productAida = productAidaSection.body;
    const productAidaNote = element("p");
    productAidaNote.textContent = copy.productAidaNote;
    productAida.append(productAidaNote);
    const aidaFields: readonly [AidaField, string][] = [
      ["attention", copy.productAidaPrompts.attention],
      ["interest", copy.productAidaPrompts.interest],
      ["desire", copy.productAidaPrompts.desire],
      ["action", copy.productAidaPrompts.action]
    ];
    for (const [field, label] of aidaFields) {
      this.#appendTextField(productAida, label, `product-aida-${field}`,
        this.#state.plan.productAidaPlan[field], 280,
        (value) => this.#aidaState(field, value), true);
    }

    const valuesSection = this.#section("desire-values", copy.sections.desireValues);
    const values = valuesSection.body;
    const valuesNote = element("p");
    valuesNote.textContent = copy.valuesNote;
    values.append(valuesNote);
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
        const valueKey = item.id.replace(/[^a-z0-9-]/gi, "-");
        checkbox.id = `${this.#idPrefix}-value-${valueKey}`;
        checkbox.type = "checkbox";
        checkbox.checked = this.#state.plan.desireValueIds.includes(item.id);
        checkbox.disabled = !checkbox.checked && this.#state.plan.desireValueIds.length >= 12;
        checkbox.dataset.assignmentFocus = `value-${item.id}`;
        choose.htmlFor = checkbox.id;
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
        radio.id = `${this.#idPrefix}-primary-${valueKey}`;
        radio.type = "radio";
        radio.name = `${this.#idPrefix}-primary-desire-value`;
        radio.checked = this.#state.plan.primaryDesireValueId === item.id;
        radio.disabled = !checkbox.checked;
        radio.setAttribute("aria-label",
          `${copy.mainValuePrefix} ${item.label} ${copy.mainValueSuffix}`);
        radio.dataset.assignmentFocus = `primary-${item.id}`;
        primaryLabel.htmlFor = radio.id;
        primaryLabel.append(radio, document.createTextNode(copy.mainValueLabel));
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

    const handoffSection = this.#section("advertisement-aida", copy.sections.advertisementAida);
    const handoff = handoffSection.body;
    const handoffText = element("p");
    handoffText.textContent = copy.advertisementAidaNote;
    const composition = element("p", "assignment-planner__techniques");
    composition.textContent = copy.compositionTechniques;
    handoff.append(handoffText, composition);
    const status = element("p", "assignment-planner__status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    root.append(
      intro,
      defineSection.details,
      productAidaSection.details,
      valuesSection.details,
      handoffSection.details,
      status
    );
    this.host.replaceChildren(root);
  }
}
