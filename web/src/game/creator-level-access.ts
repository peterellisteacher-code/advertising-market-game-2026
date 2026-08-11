import type { CampaignGameplayStage } from "../domain/campaign-document";
import type { WorkspaceMode } from "./assignment-plan";
import { STUDENT_COPY } from "./student-copy";

const LEVEL_LABELS: Readonly<Record<CampaignGameplayStage, string>> = Object.freeze({
  invent: "LEVEL 1 // INVENT IT",
  sell: "LEVEL 2 // SELL IT",
  irresistible: "LEVEL 3 // FINALISE IT",
  "publish-check": "MARKET GATE // FINAL LOOK"
});

const FEATURE_ACCESS: Readonly<Record<CampaignGameplayStage, readonly string[]>> = Object.freeze({
  invent: Object.freeze(["product"]),
  sell: Object.freeze(["product", "aida", "coach"]),
  irresistible: Object.freeze(["product", "price", "aida", "route", "coach"]),
  "publish-check": Object.freeze(["product", "price", "aida", "route", "coach"])
});

const SANDBOX_FEATURES = Object.freeze(["product", "price", "aida", "route", "coach"]);

const COMMAND_ACCESS = Object.freeze({
  aida: ["sell", "irresistible", "publish-check"] as const,
  price: ["irresistible", "publish-check"] as const,
  route: ["irresistible", "publish-check"] as const
}) satisfies Readonly<Record<
  "aida" | "price" | "route",
  readonly CampaignGameplayStage[]
>>;

function required(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Campaign Creator is missing ${selector}`);
  return element;
}

function setModeOverride(element: HTMLElement, active: boolean, hidden: boolean): void {
  if (active) {
    if (element.dataset.creatorModePreviousHidden === undefined) {
      element.dataset.creatorModePreviousHidden = String(element.hidden);
      element.dataset.creatorModePreviousInert = String(
        element.inert === true || element.hasAttribute("inert")
      );
    }
    element.hidden = hidden;
    element.inert = hidden;
    element.toggleAttribute("inert", hidden);
    return;
  }
  const previousHidden = element.dataset.creatorModePreviousHidden;
  const previousInert = element.dataset.creatorModePreviousInert;
  if (previousHidden === undefined || previousInert === undefined) return;
  element.hidden = previousHidden === "true";
  element.inert = previousInert === "true";
  element.toggleAttribute("inert", previousInert === "true");
  delete element.dataset.creatorModePreviousHidden;
  delete element.dataset.creatorModePreviousInert;
}

export function applyCreatorLevelAccess(
  root: HTMLElement,
  stage: CampaignGameplayStage,
  workspaceMode: WorkspaceMode = "guided"
): void {
  const sandbox = workspaceMode === "assignment-sandbox";
  const access = new Set(sandbox ? SANDBOX_FEATURES : FEATURE_ACCESS[stage]);
  root.dataset.creatorStage = stage;
  root.dataset.workspaceMode = workspaceMode;
  required(root, "[data-creator-level-label]").textContent = sandbox
    ? STUDENT_COPY.assignmentSandbox.label
    : LEVEL_LABELS[stage];

  const guidedRegions = [
    ...root.querySelectorAll<HTMLElement>("[data-guided-only]"),
    ...root.querySelectorAll<HTMLElement>('[data-tuck-tab="brief"]')
  ];
  for (const region of new Set(guidedRegions)) {
    setModeOverride(region, sandbox, true);
  }
  for (const region of root.querySelectorAll<HTMLElement>("[data-sandbox-only]")) {
    setModeOverride(region, sandbox, false);
  }

  for (const section of root.querySelectorAll<HTMLElement>("[data-creator-feature]")) {
    const available = access.has(section.dataset.creatorFeature ?? "");
    section.dataset.creatorFeatureAvailable = String(available);
    if (!available) section.hidden = true;
    else if (!section.hasAttribute("data-studio-panel")) section.hidden = false;
  }

  const checklist = required(root, "[data-creator-checklist]");
  const tabs = [...checklist.querySelectorAll<HTMLButtonElement>("[data-slot]")];
  const showChecklist = !sandbox && stage !== "invent";
  checklist.hidden = !showChecklist;
  for (const tab of tabs) {
    const visible = showChecklist && (stage !== "sell" || tab.dataset.slot !== "price");
    tab.hidden = !visible;
    tab.disabled = !visible;
    if (!visible) tab.setAttribute("aria-selected", "false");
  }
  const visibleTabs = tabs.filter((tab) => !tab.hidden);
  if (visibleTabs.length > 0 && !visibleTabs.some((tab) => tab.getAttribute("aria-selected") === "true")) {
    visibleTabs[0]!.setAttribute("aria-selected", "true");
  }
}

export function creatorStageAllows(
  stage: CampaignGameplayStage,
  feature: "aida" | "price" | "route",
  workspaceMode: WorkspaceMode = "guided"
): boolean {
  if (workspaceMode === "assignment-sandbox") return true;
  return (COMMAND_ACCESS[feature] as readonly CampaignGameplayStage[]).includes(stage);
}
