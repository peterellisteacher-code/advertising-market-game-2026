import type { CampaignDocumentV1 } from "../domain/campaign-document";
import { campaignSemanticObjectMap } from "../domain/campaign-semantic-objects";
import type { CreatorPhase, PairRoleProgress, PairSession } from "./pair-session";
import {
  CREATOR_COMMANDS,
  ROUND_ZERO_COMMANDS,
  type CreatorCommand
} from "./round-zero";

export interface CreatorStageDefinition {
  readonly phase: CreatorPhase;
  readonly newlyUnlockedCommands: readonly CreatorCommand[];
  readonly availableCommands: readonly CreatorCommand[];
  readonly hintKeywords: readonly string[];
  readonly tooltip?: string;
}

function immutableStage(
  phase: CreatorPhase,
  newlyUnlockedCommands: readonly CreatorCommand[],
  availableCommands: readonly CreatorCommand[],
  hintKeywords: readonly string[],
  tooltip: string
): CreatorStageDefinition {
  return Object.freeze({
    phase,
    newlyUnlockedCommands: Object.freeze([...newlyUnlockedCommands]),
    availableCommands: Object.freeze([...availableCommands]),
    hintKeywords: Object.freeze([...hintKeywords]),
    tooltip
  });
}

export const CREATOR_STAGES: readonly CreatorStageDefinition[] = Object.freeze([
  immutableStage(
    "round-zero",
    ROUND_ZERO_COMMANDS,
    ROUND_ZERO_COMMANDS,
    ["make", "undo"],
    "Make a first change together. Use undo to return to a prior state."
  ),
  immutableStage(
    "invent",
    ["crop"],
    CREATOR_COMMANDS.slice(0, 7),
    ["crop"],
    "Crop an image to choose what viewers notice first."
  ),
  immutableStage(
    "sell",
    ["drawing"],
    CREATOR_COMMANDS.slice(0, 8),
    ["drawing"],
    "Use drawing to add a simple shape that supports the offer."
  ),
  immutableStage(
    "refine",
    ["recolour"],
    CREATOR_COMMANDS.slice(0, 9),
    ["recolour"],
    "Recolour one element only when it strengthens the audience fit."
  ),
  immutableStage(
    "preview",
    ["layers"],
    CREATOR_COMMANDS,
    ["layers"],
    "Check layers to control what appears in front before opening the preview."
  )
]);

export function getCreatorStage(phase: CreatorPhase): CreatorStageDefinition {
  const stage = CREATOR_STAGES.find((candidate) => candidate.phase === phase);
  if (stage === undefined) {
    throw new Error(`Unknown creator phase: ${phase}`);
  }
  return stage;
}

export function getAvailableCommands(phase: CreatorPhase): readonly CreatorCommand[] {
  return getCreatorStage(phase).availableCommands;
}

export function advanceCreatorPhase(session: PairSession): PairSession {
  const index = CREATOR_STAGES.findIndex((stage) => stage.phase === session.phase);
  if (index < 0) {
    throw new Error(`Unknown creator phase: ${session.phase}`);
  }
  const next = CREATOR_STAGES[index + 1];
  if (next === undefined) {
    throw new Error("Cannot advance beyond preview");
  }
  return { ...session, phase: next.phase };
}

export const PUBLICATION_MISSING_CODES = Object.freeze([
  "audience-brief",
  "product-name",
  "price",
  "attention",
  "interest",
  "desire",
  "action",
  "market-route"
] as const);

export type PublicationMissingCode = typeof PUBLICATION_MISSING_CODES[number];

export interface PublicationReadiness {
  readonly ready: boolean;
  readonly missing: readonly PublicationMissingCode[];
}

export type PricePlacementState =
  | { readonly status: "ready"; readonly action: "add" | "update" }
  | { readonly status: "pending" }
  | { readonly status: "complete"; readonly visiblePrice: string }
  | { readonly status: "needs-attention"; readonly reason: string };

const marketBucks = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function formatMarketBucks(cents: number): string {
  return `$${marketBucks.format(cents / 100)}`;
}

function hasEvidenceId(ids: readonly string[]): boolean {
  return ids.some((id) => id.trim().length > 0);
}

export function evaluatePricePlacementState(
  campaign: CampaignDocumentV1
): PricePlacementState {
  const priceCents = campaign.product.priceCents;
  if (priceCents === null || campaign.product.pricePosition === null) {
    return Object.freeze({ status: "pending" });
  }
  if (!Number.isSafeInteger(priceCents) || priceCents <= 0) {
    return Object.freeze({
      status: "needs-attention",
      reason: "Enter a selling price above $0.00."
    });
  }

  let objects: ReturnType<typeof campaignSemanticObjectMap>;
  try {
    objects = campaignSemanticObjectMap(campaign.fabricState);
  } catch {
    return Object.freeze({
      status: "needs-attention",
      reason: "The saved price label needs repair before publishing."
    });
  }
  const expected = formatMarketBucks(priceCents);
  if (campaign.evidence.price.length === 1) {
    const object = objects.get(campaign.evidence.price[0]!);
    if (object?.elementKind === "text" &&
      object.accessibleName === `Market price ${expected}` &&
      object.object.text === expected &&
      object.object.editable === false &&
      object.object.visible !== false) {
      return Object.freeze({ status: "complete", visiblePrice: expected });
    }
  }
  return Object.freeze({
    status: "ready",
    action: hasEvidenceId(campaign.evidence.price) ? "update" : "add"
  });
}

export function evaluatePublicationReadiness(
  session: PairSession,
  _progress: PairRoleProgress,
  campaign: CampaignDocumentV1
): PublicationReadiness {
  const missing: PublicationMissingCode[] = [];

  if (session.audienceBriefId.trim().length === 0) missing.push("audience-brief");
  if (campaign.product.name.trim().length === 0) missing.push("product-name");
  if (evaluatePricePlacementState(campaign).status !== "complete") {
    missing.push("price");
  }
  if (!hasEvidenceId(campaign.evidence.attention)) missing.push("attention");
  if (!hasEvidenceId(campaign.evidence.interest)) missing.push("interest");
  if (!hasEvidenceId(campaign.evidence.desire)) missing.push("desire");
  if (!hasEvidenceId(campaign.evidence.action)) missing.push("action");
  if (campaign.strategy.marketRoute?.committed !== true ||
    campaign.strategy.marketRoute.proofPoint.trim().length === 0) {
    missing.push("market-route");
  }
  const immutableMissing = Object.freeze(missing);
  return Object.freeze({ ready: immutableMissing.length === 0, missing: immutableMissing });
}
