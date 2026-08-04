import type {
  CampaignDocumentV1,
  CampaignGameplayStage
} from "../domain/campaign-document";
import { hasPlacedProduct } from "../product-builder/product-price-subject";
import type { AidaStage } from "./aida-playbook";
import type { InstructionClaimId } from "./instruction-argument";

export const GUIDED_JOURNEY_ORDER = Object.freeze([
  "sign-in",
  "audience",
  "roles",
  "starter-product",
  "product-edit",
  "product-name",
  "pair-contribution",
  "attention",
  "interest",
  "desire",
  "action",
  "price-position",
  "visible-price",
  "market-route",
  "proof-point",
  "final-review",
  "market-entry",
  "scoring",
  "sign-out"
] as const);

export type GuidedJourneyRouteStepId = typeof GUIDED_JOURNEY_ORDER[number];

export type GuidedJourneyStepId =
  | GuidedJourneyRouteStepId
  | "finish-level-1"
  | "finish-level-2"
  | "finish-level-3";

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
  readonly optionalMethods?: readonly string[];
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
    now: `Complete ${title} by applying one visible technique and recording its explanation.`,
    why,
    done: `The ${title} explanation and its visible canvas evidence are recorded.`,
    next,
    tool: "aida",
    claimIds: Object.freeze([...claimIds]),
    aidaStage: id,
    actionLabel: "Open AIDA",
    isComplete: (document: CampaignDocumentV1) => hasAida(document, id)
  });
}

const DEFINITIONS: readonly GuidedJourneyDefinition[] = Object.freeze([
  Object.freeze({
    id: "sign-in",
    stage: "invent",
    title: "Sign in",
    now: "Sign in with the pair username and password supplied by the teacher.",
    why: "Signing in opens your saved work before the audience brief.",
    done: "The pair name appears in the account status.",
    next: "Read the Audience brief.",
    tool: "account",
    claimIds: claimIds("P1"),
    actionLabel: "Sign in",
    isComplete: () => true
  }),
  Object.freeze({
    id: "audience",
    stage: "invent",
    title: "Audience brief",
    now: "Read the audience situation, need and values.",
    why: "The Audience brief establishes the evidence needed to confirm the Partner roles and later product choices.",
    done: "An audience brief is selected and its need and values are visible.",
    next: "Confirm the Partner roles.",
    tool: "audience",
    claimIds: claimIds("P2"),
    actionLabel: "Open audience brief",
    isComplete: (document: CampaignDocumentV1) => hasText(document.brief.targetAudienceId)
  }),
  Object.freeze({
    id: "roles",
    stage: "invent",
    title: "Partner roles",
    now: "Open the Role guide and confirm the Art Director and Strategist responsibilities.",
    why: "The Partner roles assign responsibility before the Starter product is chosen.",
    done: "The role guide has been acknowledged and the starting role is visible.",
    next: "Choose a Starter product.",
    tool: "roles",
    claimIds: claimIds("P3", "ICA"),
    actionLabel: "Open Role guide",
    isComplete: (document: CampaignDocumentV1) =>
      document.gameplay.pair.roleGuideAcknowledged
  }),
  Object.freeze({
    id: "starter-product",
    stage: "invent",
    title: "Starter product",
    now: "Choose one starter product.",
    why: "The Starter product supplies a workable object for the Product edit.",
    done: "One product appears in the advertisement.",
    next: "Complete the Product edit.",
    tool: "product",
    claimIds: claimIds("P5", "P6"),
    actionLabel: "Open Build",
    isComplete: hasPlacedProduct
  }),
  Object.freeze({
    id: "product-edit",
    stage: "invent",
    title: "Product edit",
    now: "Change the placed product by moving, resizing, filling or replacing one part.",
    why: "The Product edit adapts the object for the audience before the Product name is added.",
    done: "The placed product shows a deliberate change after its initial placement.",
    next: "Add the Product name.",
    tool: "product",
    claimIds: claimIds("P7"),
    optionalMethods: Object.freeze([
      "Use Fill to change an eligible product section.",
      "Use Delete selected item to remove an unwanted part.",
      "Use Logo Lab to add a saved logo when the advertisement needs one.",
      "Image Lab is optional; its panel displays the pair's remaining uses."
    ]),
    actionLabel: "Open Build",
    isComplete: (document: CampaignDocumentV1) =>
      hasPlacedProduct(document) && document.gameplay.pair.artDirectorActions > 1
  }),
  Object.freeze({
    id: "product-name",
    stage: "invent",
    title: "Product name",
    now: "Enter a clear name in the Product name field.",
    why: "The Product name gives the advertisement a subject before the Pair contribution is completed.",
    done: "The Product name field contains saved text.",
    next: "Complete the Pair contribution.",
    tool: "product-name",
    claimIds: claimIds("P8", "ICB"),
    actionLabel: "Focus Product name",
    isComplete: (document: CampaignDocumentV1) => hasText(document.product.name)
  }),
  Object.freeze({
    id: "pair-contribution",
    stage: "invent",
    title: "Pair contribution",
    now: "Record one Art Director visual change, one Strategist message or strategy change, and one role swap.",
    why: "The Pair contribution combines deliberate visual and message decisions in the advertisement before Attention.",
    done: "Both partners have a recorded contribution and the roles have been swapped.",
    next: "Complete Attention.",
    tool: "pair",
    claimIds: claimIds("P10", "P11", "P12"),
    actionLabel: "Open pair controls",
    isComplete: (document: CampaignDocumentV1) =>
      document.gameplay.pair.handoffCount > 0 &&
      document.gameplay.pair.artDirectorActions > 0 &&
      document.gameplay.pair.strategistActions > 0
  }),
  aidaStep(
    "attention",
    "Attention gives the audience a reason to notice the advertisement before Interest.",
    "Complete Interest.",
    ["P13"]
  ),
  aidaStep(
    "interest",
    "Interest supplies evidence that prepares the audience to consider the product's value before Desire.",
    "Complete Desire.",
    ["P13"]
  ),
  aidaStep(
    "desire",
    "Desire links a product benefit to an audience need before Action.",
    "Complete Action.",
    ["P13"]
  ),
  aidaStep(
    "action",
    "Action states what the audience should do and completes the message before the offer receives a Price position.",
    "Choose the Price position.",
    ["P13", "ICC"]
  ),
  Object.freeze({
    id: "price-position",
    stage: "irresistible",
    title: "Price position",
    now: "Choose one audience price position.",
    why: "The Price position explains the offer before the Visible price is added.",
    done: "One price position is selected.",
    next: "Complete the Visible price.",
    tool: "price",
    claimIds: claimIds("P15", "P16"),
    actionLabel: "Open Price",
    isComplete: (document: CampaignDocumentV1) => document.product.pricePosition !== null
  }),
  Object.freeze({
    id: "visible-price",
    stage: "irresistible",
    title: "Visible price",
    now: "Complete the visible price by setting the amount and choosing Add price to design.",
    why: "The Visible price makes the offer clear before the Market route is chosen.",
    done: "The saved amount and one price label are present.",
    next: "Choose the Market route.",
    tool: "price",
    claimIds: claimIds("P16"),
    actionLabel: "Open Price",
    isComplete: (document: CampaignDocumentV1) =>
      document.product.priceCents !== null && hasEvidence(document, "price")
  }),
  Object.freeze({
    id: "market-route",
    stage: "irresistible",
    title: "Market route",
    now: "Choose one market zone and one or more advertising media.",
    why: "The Market route identifies where the audience will encounter the advertisement before the Proof point.",
    done: "A market zone and at least one advertising medium are recorded.",
    next: "Add the Proof point.",
    tool: "route",
    claimIds: claimIds("P17"),
    actionLabel: "Open Market Route",
    isComplete: (document: CampaignDocumentV1) =>
      document.strategy.marketRoute?.committed === true &&
      hasText(document.strategy.marketRoute.zoneId) &&
      document.strategy.marketRoute.mediaIds.length > 0
  }),
  Object.freeze({
    id: "proof-point",
    stage: "irresistible",
    title: "Proof point",
    now: "Submit the market route with one accurate proof point.",
    why: "The Proof point supports the main claim before the Final review.",
    done: "The submitted route contains a saved proof point.",
    next: "Complete the Final review.",
    tool: "route",
    claimIds: claimIds("P18", "ICD"),
    actionLabel: "Open Market Route",
    isComplete: (document: CampaignDocumentV1) =>
      document.strategy.marketRoute?.committed === true &&
      hasText(document.strategy.marketRoute.proofPoint)
  }),
  Object.freeze({
    id: "final-review",
    stage: "publish-check",
    title: "Final review",
    now: "Check all five final-review statements and build the market card.",
    why: "The Final review tests the saved evidence before Market entry.",
    done: "All five statements are confirmed and the market card is built.",
    next: "Complete Market entry.",
    tool: "game",
    claimIds: claimIds("P20", "P21", "P22"),
    actionLabel: "Return to game",
    isComplete: () => false
  }),
  Object.freeze({
    id: "market-entry",
    stage: "publish-check",
    title: "Market entry",
    now: "Select Enter market.",
    why: "Entering the market makes the finished advertisement available for scoring.",
    done: "The advertisement appears in the market.",
    next: "Begin Scoring.",
    tool: "game",
    claimIds: claimIds("P23"),
    actionLabel: "Enter market",
    isComplete: () => false
  }),
  Object.freeze({
    id: "scoring",
    stage: "publish-check",
    title: "Scoring",
    now: "Score every other advertisement using the five review criteria.",
    why: "Scoring applies the same criteria to every advertisement before Sign out.",
    done: "Every other advertisement has five scores and a medal decision.",
    next: "Complete Sign out.",
    tool: "game",
    claimIds: claimIds("P24", "C"),
    actionLabel: "Open scoring",
    isComplete: () => false
  }),
  Object.freeze({
    id: "sign-out",
    stage: "publish-check",
    title: "Sign out",
    now: "Select Sign out when the pair has finished.",
    why: "Sign out closes the pair's work so the next pair can use the device.",
    done: "The pair sign-in form is visible and the previous pair's work is closed.",
    next: "The guided route is complete.",
    tool: "account",
    claimIds: claimIds("C"),
    actionLabel: "Sign out",
    isComplete: () => false
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
    progressLabel: "Studio work complete",
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
  const studioStepIds: Readonly<Record<CampaignGameplayStage, readonly GuidedJourneyStepId[]>> = {
    invent: ["starter-product", "product-edit", "product-name"],
    sell: ["attention", "interest", "desire", "action"],
    irresistible: ["price-position", "visible-price", "market-route", "proof-point"],
    "publish-check": ["final-review", "market-entry", "scoring", "sign-out"]
  };
  const phaseSteps = steps.filter((step) => studioStepIds[current.stage].includes(step.id));
  const localIndex = phaseSteps.findIndex((step) => step.id === current.id);
  const phaseLabel = current.stage === "invent" ? "Build" :
    current.stage === "sell" ? "Message" :
      current.stage === "irresistible" ? "Offer" : "Pitch";
  const progressLabel = transitionRequired
    ? transition.progressLabel
    : `${phaseLabel} · Step ${Math.max(1, localIndex + 1)} of ${phaseSteps.length}`;

  return Object.freeze({
    steps,
    current,
    currentIndex,
    allComplete,
    progressLabel
  });
}
