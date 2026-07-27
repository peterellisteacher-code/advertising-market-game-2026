import type {
  CampaignDocumentV1,
  CampaignGameplayStage
} from "../domain/campaign-document";
import { hasPlacedProduct } from "../product-builder/product-price-subject";
import type { AidaStage } from "./aida-playbook";
import type { InstructionClaimId } from "./instruction-argument";

export type GuidedJourneyStepId =
  | "audience"
  | "product"
  | "product-name"
  | "pair-contribution"
  | "finish-level-1"
  | "attention"
  | "interest"
  | "desire"
  | "action"
  | "finish-level-2"
  | "price-position"
  | "price-evidence"
  | "market-route"
  | "finish-level-3"
  | "final-review";

export interface GuidedJourneyStep {
  readonly id: GuidedJourneyStepId;
  readonly stage: CampaignGameplayStage;
  readonly title: string;
  readonly now: string;
  readonly why: string;
  readonly done: string;
  readonly next: string;
  readonly tool: string;
  readonly claimIds: readonly InstructionClaimId[];
  readonly aidaStage?: AidaStage;
  readonly actionLabel?: string;
  readonly complete: boolean;
}

export interface GuidedJourneyState {
  readonly steps: readonly GuidedJourneyStep[];
  readonly current: GuidedJourneyStep;
  readonly currentIndex: number;
  readonly allComplete: boolean;
  readonly progressLabel: string;
}

interface GuidedJourneyDefinition extends Omit<GuidedJourneyStep, "complete"> {
  readonly isComplete: (document: CampaignDocumentV1) => boolean;
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function hasEvidence(document: CampaignDocumentV1, slot: AidaStage | "price"): boolean {
  return document.evidence[slot].some(hasText);
}

function hasAida(document: CampaignDocumentV1, stage: AidaStage): boolean {
  return hasText(document.strategy.aidaPlan[stage]) && hasEvidence(document, stage);
}

function claimIds(
  ...ids: readonly InstructionClaimId[]
): readonly InstructionClaimId[] {
  return Object.freeze(ids);
}

function aidaStep(
  id: AidaStage,
  why: string,
  next: string,
  claimIds: readonly InstructionClaimId[]
): GuidedJourneyDefinition {
  const title = id[0]!.toUpperCase() + id.slice(1);
  return Object.freeze({
    id,
    stage: "sell",
    title,
    now: `Choose one ${title} technique, apply it visibly, and record the evidence.`,
    why,
    done: `The ${title} explanation and its visible canvas evidence are recorded.`,
    next,
    tool: "aida",
    claimIds: Object.freeze([...claimIds]),
    aidaStage: id,
    isComplete: (document: CampaignDocumentV1) => hasAida(document, id)
  });
}

const DEFINITIONS: readonly GuidedJourneyDefinition[] = Object.freeze([
  Object.freeze({
    id: "audience",
    stage: "invent",
    title: "Audience evidence",
    now: "Read the audience brief and identify its need and values.",
    why: "This evidence will guide the product, message, price and market route.",
    done: "An audience brief has been selected.",
    next: "Build the Product.",
    tool: "audience",
    claimIds: claimIds("P1", "P2"),
    isComplete: (document: CampaignDocumentV1) => hasText(document.brief.targetAudienceId)
  }),
  Object.freeze({
    id: "product",
    stage: "invent",
    title: "Product",
    now: "Build one product that responds to the audience need and values.",
    why: "A suitable product gives the advertisement a relevant subject.",
    done: "The product has been built and placed on the canvas.",
    next: "Give the product a Product name.",
    tool: "product",
    claimIds: claimIds("ICA", "P5", "P6", "P7"),
    isComplete: hasPlacedProduct
  }),
  Object.freeze({
    id: "product-name",
    stage: "invent",
    title: "Product name",
    now: "Give the product a clear name.",
    why: "A clear product name gives the advertisement a precise subject.",
    done: "A product name has been recorded.",
    next: "Complete the Pair contribution.",
    tool: "product",
    claimIds: claimIds("P8"),
    isComplete: (document: CampaignDocumentV1) => hasText(document.product.name)
  }),
  Object.freeze({
    id: "pair-contribution",
    stage: "invent",
    title: "Pair contribution",
    now: "Each partner must make one recorded change, and the pair must exchange roles once.",
    why: "Combining visual and message decisions helps the pair check whether the advertisement's product and claim support the same audience need.",
    done: "Both partners have made a recorded change and exchanged roles.",
    next: "Complete Attention.",
    tool: "pair",
    claimIds: claimIds("P3", "P11", "P12"),
    isComplete: (document: CampaignDocumentV1) =>
      document.gameplay.pair.handoffCount > 0 &&
      document.gameplay.pair.artDirectorActions > 0 &&
      document.gameplay.pair.strategistActions > 0
  }),
  aidaStep(
    "attention",
    "Attention gives the audience a reason to notice the advertisement before developing Interest.",
    "Complete Interest.",
    ["P10", "P13"]
  ),
  aidaStep(
    "interest",
    "Interest gives the audience evidence that prepares it to consider the product's value.",
    "Complete Desire.",
    ["P13"]
  ),
  aidaStep(
    "desire",
    "Desire links a product benefit to an audience need and supports the final Action.",
    "Complete Action.",
    ["P13"]
  ),
  aidaStep(
    "action",
    "Action states what the audience should do and completes the message before the offer is priced.",
    "Choose the Price position.",
    ["P13"]
  ),
  Object.freeze({
    id: "price-position",
    stage: "irresistible",
    title: "Price position",
    now: "Choose the price position that best matches the audience evidence.",
    why: "The price position explains how the product's value will be presented in the offer.",
    done: "A price position has been selected.",
    next: "Complete the Price evidence.",
    tool: "price",
    claimIds: claimIds("P15", "P16"),
    isComplete: (document: CampaignDocumentV1) => document.product.pricePosition !== null
  }),
  Object.freeze({
    id: "price-evidence",
    stage: "irresistible",
    title: "Price evidence",
    now: "Set the product price and make that price visible on the canvas.",
    why: "A visible price makes the offer clear before the Market route is chosen.",
    done: "The product price and visible price evidence are recorded.",
    next: "Complete the Market route.",
    tool: "price",
    claimIds: claimIds("P16"),
    isComplete: (document: CampaignDocumentV1) =>
      document.product.priceCents !== null && hasEvidence(document, "price")
  }),
  Object.freeze({
    id: "market-route",
    stage: "irresistible",
    title: "Market route",
    now: "Choose where the audience will encounter the advertisement and state one proof point that supports its main claim.",
    why: "The route and proof point prepare the campaign for its Final review by showing where the audience will see the advertisement and why its claim is credible.",
    done: "The market route and its proof point are recorded.",
    next: "Complete the Final review.",
    tool: "route",
    claimIds: claimIds("P17", "P18"),
    isComplete: (document: CampaignDocumentV1) => document.strategy.marketRoute?.committed === true
      && document.strategy.marketRoute.proofPoint.trim().length > 0
  })
]);

const LEVEL_TRANSITIONS: Readonly<Record<
  CampaignGameplayStage,
  { readonly step: GuidedJourneyStep; readonly progressLabel: string }
>> = Object.freeze({
  invent: Object.freeze({
    progressLabel: "Level 1 studio work complete",
    step: Object.freeze({
      id: "finish-level-1",
      stage: "invent",
      title: "Finish Level 1",
      now: "Return to the game and lock Level 1.",
      why: "Locking Level 1 records the product and opens Level 2, where the pair will create the AIDA message.",
      done: "Level 1 is locked and Level 2 is available.",
      next: "Open the creative studio and complete Attention.",
      tool: "game",
      claimIds: claimIds("ICB"),
      actionLabel: "Return to game",
      complete: false
    })
  }),
  sell: Object.freeze({
    progressLabel: "Level 2 studio work complete",
    step: Object.freeze({
      id: "finish-level-2",
      stage: "sell",
      title: "Finish Level 2",
      now: "Return to the game and lock Level 2.",
      why: "Locking Level 2 records the AIDA message and opens Level 3, where the pair will set the price and market route.",
      done: "Level 2 is locked and Level 3 is available.",
      next: "Open the creative studio and complete the Price position.",
      tool: "game",
      claimIds: claimIds("ICC"),
      actionLabel: "Return to game",
      complete: false
    })
  }),
  irresistible: Object.freeze({
    progressLabel: "Level 3 studio work complete",
    step: Object.freeze({
      id: "finish-level-3",
      stage: "irresistible",
      title: "Finish Level 3",
      now: "Return to the game and lock Level 3.",
      why: "Locking Level 3 records the complete offer and opens the Final review.",
      done: "Level 3 is locked and the Final review is available.",
      next: "Complete the Final review.",
      tool: "game",
      claimIds: claimIds("ICD"),
      actionLabel: "Return to game",
      complete: false
    })
  }),
  "publish-check": Object.freeze({
    progressLabel: "All 11 studio steps complete",
    step: Object.freeze({
      id: "final-review",
      stage: "publish-check",
      title: "Final review",
      now: "Return to the game. Check all five final-review statements, then build the market card.",
      why: "The five statements connect the product, AIDA choices, price, market route and proof point to the final judgement.",
      done: "All five statements are confirmed and the market card is built.",
      next: "Open the market and score every other advertisement.",
      tool: "game",
      claimIds: claimIds("P20", "P21", "P22", "P23", "P24", "C"),
      actionLabel: "Return to game",
      complete: false
    })
  })
});

const STAGE_INDEX: Readonly<Record<CampaignGameplayStage, number>> = Object.freeze({
  invent: 0,
  sell: 1,
  irresistible: 2,
  "publish-check": 3
});

export function evaluateGuidedJourney(
  document: CampaignDocumentV1
): GuidedJourneyState {
  const steps = Object.freeze(DEFINITIONS.map((definition): GuidedJourneyStep => {
    const { isComplete, ...step } = definition;
    return Object.freeze({ ...step, complete: isComplete(document) });
  }));
  const incompleteIndex = steps.findIndex(({ complete }) => !complete);
  const allComplete = incompleteIndex === -1;
  const currentIndex = allComplete ? steps.length - 1 : incompleteIndex;
  const nextStep = steps[currentIndex]!;
  const transitionRequired = allComplete ||
    STAGE_INDEX[nextStep.stage] > STAGE_INDEX[document.gameplay.stage];
  const transition = LEVEL_TRANSITIONS[document.gameplay.stage];
  const current = transitionRequired ? transition.step : nextStep;
  const progressLabel = transitionRequired
    ? transition.progressLabel
    : `Step ${currentIndex + 1} of ${steps.length}`;

  return Object.freeze({
    steps,
    current,
    currentIndex,
    allComplete,
    progressLabel
  });
}
