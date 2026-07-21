import type { CampaignGameplayStage } from "../domain/campaign-document";

const LEVEL_LABELS: Readonly<Record<CampaignGameplayStage, string>> = Object.freeze({
  invent: "LEVEL 1 // INVENT IT",
  sell: "LEVEL 2 // SELL IT",
  irresistible: "LEVEL 3 // FINALISE IT",
  "publish-check": "MARKET GATE // FINAL LOOK"
});

const FEATURE_ACCESS: Readonly<Record<CampaignGameplayStage, readonly string[]>> = Object.freeze({
  invent: Object.freeze(["product", "money"]),
  sell: Object.freeze(["product", "money", "aida"]),
  irresistible: Object.freeze(["product", "money", "aida", "route"]),
  "publish-check": Object.freeze(["product", "money", "aida", "route"])
});

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

export function applyCreatorLevelAccess(
  root: HTMLElement,
  stage: CampaignGameplayStage
): void {
  const access = new Set(FEATURE_ACCESS[stage]);
  root.dataset.creatorStage = stage;
  required(root, "[data-creator-level-label]").textContent = LEVEL_LABELS[stage];

  for (const section of root.querySelectorAll<HTMLElement>("[data-creator-feature]")) {
    const available = access.has(section.dataset.creatorFeature ?? "");
    section.dataset.creatorFeatureAvailable = String(available);
    if (!available) section.hidden = true;
    else if (!section.hasAttribute("data-studio-panel")) section.hidden = false;
  }

  const checklist = required(root, "[data-creator-checklist]");
  const tabs = [...checklist.querySelectorAll<HTMLButtonElement>("[data-slot]")];
  const showChecklist = stage !== "invent";
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
  feature: "aida" | "price" | "route"
): boolean {
  return (COMMAND_ACCESS[feature] as readonly CampaignGameplayStage[]).includes(stage);
}
