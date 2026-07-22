import type {
  CampaignDocumentV1,
  ProductBuildSnapshotV1
} from "../domain/campaign-document";
import { formatMarketBucks } from "../product-builder/product-money-panel";
import {
  ADVERTISING_MEDIA,
  MARKET_ZONES,
  PRODUCT_TRAITS,
  type MarketRouteFeedback,
  type ProductTraitId
} from "./market-route";

export interface MarketRoutePanelState {
  readonly build: ProductBuildSnapshotV1 | null;
  readonly audienceBriefId: string;
  readonly strategy: CampaignDocumentV1["strategy"];
  readonly feedback: MarketRouteFeedback | null;
}

export interface MarketRouteCommitInput {
  readonly audienceBriefId: string;
  readonly productTraitIds: readonly ProductTraitId[];
  readonly marketedChoiceIds: readonly string[];
  readonly zoneId: string;
  readonly mediaIds: readonly string[];
}

export type MarketRouteCommitHandler = (
  input: MarketRouteCommitInput
) => MarketRouteFeedback | Promise<MarketRouteFeedback>;

function element<K extends keyof HTMLElementTagNameMap>(
  name: K,
  className?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(name);
  if (className) node.className = className;
  return node;
}

function checkboxLabel(
  value: string,
  title: string,
  clue: string,
  checked: boolean
): HTMLLabelElement {
  const label = element("label", "market-route__choice");
  const input = element("input");
  input.type = "checkbox";
  input.value = value;
  input.checked = checked;
  const copy = element("span");
  const strong = element("strong");
  strong.textContent = title;
  const small = element("small");
  small.textContent = ` · ${clue}`;
  copy.append(strong, small);
  label.append(input, copy);
  return label;
}

export class MarketRoutePanel {
  #state: MarketRoutePanelState = {
    build: null,
    audienceBriefId: "",
    strategy: {
      productTraitIds: [],
      marketedChoiceIds: [],
      marketRoute: null,
      aidaPlan: { attention: "", interest: "", desire: "", action: "" }
    },
    feedback: null
  };
  #form: HTMLFormElement | null = null;
  #launch: HTMLButtonElement | null = null;
  #status: HTMLElement | null = null;
  #feedbackHost: HTMLElement | null = null;
  #operation = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly onCommit: MarketRouteCommitHandler
  ) {}

  setState(state: MarketRoutePanelState): void {
    this.#operation += 1;
    this.#state = structuredClone(state);
    this.#draw();
  }

  #draw(): void {
    const root = element("div", "market-route");
    const intro = element("p", "market-route__intro");
    intro.textContent = "Cost informs audience and pricing decisions and does not restrict which product students may build. The route tool plans where an idea reaches its audience.";
    root.append(intro);

    const build = this.#state.build;
    if (build) {
      const cost = element("p", "market-route__cost-clue");
      cost.textContent = `Cost: ${formatMarketBucks(build.unitCostCents)}`;
      root.append(cost);
    }
    if (!build || !this.#state.audienceBriefId.trim()) {
      const locked = element("p", "market-route__locked");
      locked.setAttribute("role", "status");
      locked.textContent = build
        ? "Choose an audience value before continuing."
        : "Add a product before continuing.";
      root.append(locked);
      this.#form = null;
      this.#launch = null;
      this.#status = null;
      this.#feedbackHost = null;
      this.host.replaceChildren(root);
      return;
    }

    const form = element("form", "market-route__form");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.#commit();
    });
    this.#form = form;

    const traits = element("fieldset", "market-route__step");
    const traitLegend = element("legend");
    traitLegend.textContent = "Product strengths";
    traits.append(traitLegend);
    const traitHint = element("p");
    traitHint.textContent = "Choose at least one and no more than four ideas your product can prove.";
    traits.append(traitHint);
    for (const trait of PRODUCT_TRAITS) {
      const label = checkboxLabel(
        trait.id,
        trait.label,
        trait.clue,
        this.#state.strategy.productTraitIds.includes(trait.id)
      );
      label.querySelector("input")!.name = "product-trait";
      traits.append(label);
    }

    const choices = element("fieldset", "market-route__step");
    const choiceLegend = element("legend");
    choiceLegend.textContent = "Priced product choices";
    choices.append(choiceLegend);
    const choiceHint = element("p");
    choiceHint.textContent = "Choose at least one priced part to feature.";
    choices.append(choiceHint);
    for (const line of build.costLines) {
      const label = checkboxLabel(
        line.choiceId,
        line.label,
        `${line.groupLabel} · ${formatMarketBucks(line.costCents)}`,
        this.#state.strategy.marketedChoiceIds.includes(line.choiceId)
      );
      label.querySelector("input")!.name = "marketed-choice";
      choices.append(label);
    }

    const zoneStep = element("fieldset", "market-route__step");
    const zoneLegend = element("legend");
    zoneLegend.textContent = "Market zone";
    const zone = element("select");
    zone.name = "market-zone";
    zone.setAttribute("aria-label", "Market zone");
    const blank = element("option");
    blank.value = "";
    blank.textContent = "Choose a zone";
    zone.append(blank);
    for (const definition of MARKET_ZONES) {
      const option = element("option");
      option.value = definition.id;
      option.textContent = `${definition.label} — ${definition.scale}`;
      zone.append(option);
    }
    zone.value = this.#state.strategy.marketRoute?.zoneId ?? "";
    const zoneClue = element("p", "market-route__zone-clue");
    const refreshZoneClue = (): void => {
      const definition = MARKET_ZONES.find(({ id }) => id === zone.value);
      zoneClue.textContent = definition
        ? `${definition.geolocation}: ${definition.clue}`
        : "Pick the scale and fictional location that suit your audience.";
    };
    zone.addEventListener("change", refreshZoneClue);
    refreshZoneClue();
    zoneStep.append(zoneLegend, zone, zoneClue);

    const media = element("fieldset", "market-route__step");
    const mediaLegend = element("legend");
    mediaLegend.textContent = "Advertising media";
    media.append(mediaLegend);
    const mediaHint = element("p");
    mediaHint.textContent = "Choose at least one and no more than three media placements.";
    media.append(mediaHint);
    const selectedMedia = new Set(this.#state.strategy.marketRoute?.mediaIds ?? []);
    for (const medium of ADVERTISING_MEDIA) {
      const label = checkboxLabel(
        medium.id,
        medium.label,
        `${medium.placement}. ${medium.clue}`,
        selectedMedia.has(medium.id)
      );
      label.querySelector("input")!.name = "advertising-medium";
      media.append(label);
    }

    const status = element("p", "market-route__status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    this.#status = status;

    const launch = element("button", "market-route__launch");
    launch.type = "submit";
    launch.textContent = this.#state.feedback ? "Route submitted" : "Submit this route";
    launch.addEventListener("click", (event) => {
      event.preventDefault();
      void this.#commit();
    });
    this.#launch = launch;

    const feedbackHost = element("div", "market-route__feedback-host");
    this.#feedbackHost = feedbackHost;

    const refreshSteps = (): void => {
      const hasTraits = this.#selected("product-trait").length > 0;
      choices.hidden = !hasTraits;
      const hasChoices = hasTraits && this.#selected("marketed-choice").length > 0;
      zoneStep.hidden = !hasChoices;
      const hasZone = hasChoices && Boolean(zone.value);
      media.hidden = !hasZone;
      const hasMedia = hasZone && this.#selected("advertising-medium").length > 0;
      launch.hidden = !hasMedia && this.#state.feedback === null;
    };

    const refreshSelection = (event: Event): void => {
      const input = event.target;
      if (input instanceof HTMLInputElement && input.checked) {
        const maximum = input.name === "product-trait" ? 4
          : input.name === "advertising-medium" ? 3 : 8;
        const count = form.querySelectorAll<HTMLInputElement>(
          `input[name="${input.name}"]:checked`
        ).length;
        if (count > maximum) {
          input.checked = false;
          status.textContent = `Choose no more than ${maximum} in this step.`;
        }
      }
      feedbackHost.replaceChildren();
      this.#state = { ...this.#state, feedback: null };
      launch.textContent = "Submit this route";
      status.textContent = "";
      this.#refreshLaunch();
      refreshSteps();
    };
    form.addEventListener("change", refreshSelection);
    form.addEventListener("click", (event) => {
      if (event.target instanceof HTMLInputElement) refreshSelection(event);
    });

    form.append(traits, choices, zoneStep, media, status, launch, feedbackHost);
    root.append(form);
    this.host.replaceChildren(root);
    if (this.#state.feedback) {
      status.textContent = "Route submitted. Review the route report, then return to the game.";
    }
    this.#renderFeedback(this.#state.feedback);
    this.#refreshLaunch();
    refreshSteps();
  }

  #selected(name: string): string[] {
    if (!this.#form) return [];
    return [...this.#form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)]
      .map(({ value }) => value);
  }

  #refreshLaunch(): void {
    if (!this.#launch || !this.#form) return;
    if (this.#state.feedback) {
      this.#launch.textContent = "Route submitted";
      this.#launch.disabled = true;
      return;
    }
    this.#launch.textContent = "Submit this route";
    const zone = this.#form.querySelector<HTMLSelectElement>('select[name="market-zone"]');
    const zoneId = zone?.value ?? "";
    this.#launch.disabled = !zoneId
      || this.#selected("product-trait").length === 0
      || this.#selected("marketed-choice").length === 0
      || this.#selected("advertising-medium").length === 0;
  }

  async #commit(): Promise<void> {
    if (!this.#form || !this.#launch || this.#launch.disabled) return;
    const zone = this.#form.querySelector<HTMLSelectElement>('select[name="market-zone"]');
    if (!zone?.value) return;
    const operation = ++this.#operation;
    this.#launch.disabled = true;
    this.#form.setAttribute("aria-busy", "true");
    if (this.#status) this.#status.textContent = "Submitting the route…";
    try {
      const feedback = await this.onCommit({
        audienceBriefId: this.#state.audienceBriefId,
        productTraitIds: this.#selected("product-trait") as ProductTraitId[],
        marketedChoiceIds: this.#selected("marketed-choice"),
        zoneId: zone.value,
        mediaIds: this.#selected("advertising-medium")
      });
      if (operation !== this.#operation) return;
      this.#state = { ...this.#state, feedback: structuredClone(feedback) };
      if (this.#status) {
        this.#status.textContent = "Route submitted. Review the route report, then return to the game.";
      }
      this.#renderFeedback(feedback);
    } catch (error) {
      if (operation !== this.#operation) return;
      if (this.#status) {
        this.#status.textContent = error instanceof Error
          ? error.message
          : "The route could not be submitted.";
      }
    } finally {
      if (operation === this.#operation) {
        this.#form?.removeAttribute("aria-busy");
        this.#refreshLaunch();
      }
    }
  }

  #renderFeedback(feedback: MarketRouteFeedback | null): void {
    if (!this.#feedbackHost) return;
    this.#feedbackHost.replaceChildren();
    if (!feedback) return;
    const report = element("article", "market-route__report");
    report.setAttribute("role", "region");
    report.setAttribute("aria-label", "Route report");
    report.dataset.outcome = feedback.outcome;
    const heading = element("h3");
    heading.textContent = feedback.headline;
    const list = element("ul");
    for (const evidence of feedback.evidence) {
      const item = element("li");
      item.dataset.fit = evidence.fit;
      item.textContent = evidence.reason;
      list.append(item);
    }
    const next = element("p", "market-route__next");
    next.textContent = feedback.nextMove;
    report.append(heading, list, next);
    this.#feedbackHost.append(report);
    report.scrollIntoView?.({ block: "nearest" });
  }
}
