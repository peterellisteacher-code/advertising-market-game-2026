import type { CampaignDocumentV1 } from "../domain/campaign-document";
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
    "Make a first change together, then use undo if you want to try another direction."
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
  "role-handoff",
  "art-director-action",
  "strategist-action"
] as const);

export type PublicationMissingCode = typeof PUBLICATION_MISSING_CODES[number];

export interface PublicationReadiness {
  readonly ready: boolean;
  readonly missing: readonly PublicationMissingCode[];
}

export function evaluatePublicationReadiness(
  session: PairSession,
  progress: PairRoleProgress,
  campaign: CampaignDocumentV1
): PublicationReadiness {
  const missing: PublicationMissingCode[] = [];

  if (session.audienceBriefId.trim().length === 0) missing.push("audience-brief");
  if (campaign.product.name.trim().length === 0) missing.push("product-name");
  if (campaign.product.priceCents === null) missing.push("price");
  if (campaign.evidence.attention.length === 0) missing.push("attention");
  if (campaign.evidence.interest.length === 0) missing.push("interest");
  if (campaign.evidence.desire.length === 0) missing.push("desire");
  if (campaign.evidence.action.length === 0) missing.push("action");
  if (session.handoffCount < 1) missing.push("role-handoff");
  if (progress["art-director"] < 1) missing.push("art-director-action");
  if (progress.strategist < 1) missing.push("strategist-action");

  const immutableMissing = Object.freeze(missing);
  return Object.freeze({ ready: immutableMissing.length === 0, missing: immutableMissing });
}
