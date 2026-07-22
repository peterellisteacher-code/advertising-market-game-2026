import { createHash } from "node:crypto";
import {
  AwardInputSchema,
  CampaignSchema,
  CloseMarketInputSchema,
  ContentHashSchema,
  CreateMarketRoomInputSchema,
  FinishTeamInputSchema,
  JoinTeamInputSchema,
  MARKET_LIMITS,
  MarketRoomSchema,
  OpenMarketInputSchema,
  OpenRevealInputSchema,
  PurchaseInputSchema,
  RegisterArtworkUploadInputSchema,
  RemoveTeamInputSchema,
  ReviewCampaignInputSchema,
  SubmitCampaignInputSchema,
  canonicalAwardCommandPayload,
  canonicalControlCommandPayload,
  canonicalFinishCommandPayload,
  canonicalPublishCommandPayload,
  canonicalPurchasePayload,
  canonicalRemoveTeamCommandPayload,
  canonicalReviewCommandPayload,
  type AwardInput,
  type Campaign,
  type ArtworkUpload,
  type CloseMarketInput,
  type CommandOperation,
  type CommandPostcondition,
  type CommandReceipt,
  type CreateMarketRoomInput,
  type FinishTeamInput,
  type JoinTeamInput,
  type MarketCohort,
  type MarketRoom,
  type Medal,
  type OpenMarketInput,
  type OpenRevealInput,
  type PurchaseInput,
  type RegisterArtworkUploadInput,
  type RemoveTeamInput,
  type Receipt,
  type ReviewCampaignInput,
  type SubmitCampaignInput,
  type Team
} from "./market-contracts";

export type MarketStateErrorCode =
  | "INVALID_INPUT"
  | "STATE_INVALID"
  | "REVISION_CONFLICT"
  | "WRONG_PHASE"
  | "LIMIT_REACHED"
  | "ID_CONFLICT"
  | "ALIAS_TAKEN"
  | "TEAM_NOT_FOUND"
  | "TEAM_FINISHED"
  | "CAMPAIGN_NOT_FOUND"
  | "CAMPAIGN_NOT_APPROVED"
  | "CAMPAIGN_NOT_RETURNED"
  | "ARTWORK_UPLOAD_NOT_ALLOWED"
  | "ARTWORK_QUOTA_EXHAUSTED"
  | "ARTWORK_NOT_REGISTERED"
  | "OWN_CAMPAIGN"
  | "CAMPAIGN_ALREADY_AWARDED"
  | "ALREADY_PURCHASED"
  | "INSUFFICIENT_FUNDS"
  | "IDEMPOTENCY_CONFLICT"
  | "COMMAND_CONFLICT"
  | "COMMAND_LEDGER_FULL"
  | "SUBMISSION_VERSION_CONFLICT"
  | "MARKET_NOT_READY"
  | "MARKET_NOT_ELIGIBLE"
  | "FINISH_NOT_ALLOWED"
  | "REVEAL_NOT_READY";

export class MarketStateError extends Error {
  constructor(readonly code: MarketStateErrorCode) {
    super(code);
    this.name = "MarketStateError";
  }
}

const parseInput = <T>(read: () => T): T => {
  try {
    return read();
  } catch (error) {
    if (error instanceof MarketStateError) throw error;
    throw new MarketStateError("INVALID_INPUT");
  }
};

const JoinTeamWithSessionBindingInputSchema = JoinTeamInputSchema.extend({
  intentKey: ContentHashSchema,
  payloadHash: ContentHashSchema
}).strict();

const readRoom = (value: MarketRoom): MarketRoom => {
  const result = MarketRoomSchema.safeParse(value);
  if (!result.success) throw new MarketStateError("STATE_INVALID");
  return result.data;
};

const requireRevision = (state: MarketRoom, expectedRevision: number): void => {
  if (state.revision !== expectedRevision) throw new MarketStateError("REVISION_CONFLICT");
};

const requirePhase = (state: MarketRoom, phase: MarketRoom["phase"]): void => {
  if (state.phase !== phase) throw new MarketStateError("WRONG_PHASE");
};

const commandPayloadHash = (canonicalPayload: string): string =>
  createHash("sha256").update(canonicalPayload, "utf8").digest("hex");

const commandReceiptCount = (state: MarketRoom): number =>
  Object.values(state.commandReceipts)
    .reduce((total, receipts) => total + Object.keys(receipts).length, 0);

const replayCommand = (
  state: MarketRoom,
  actor: string,
  commandId: string,
  operation: CommandOperation,
  payloadHash: string
): CommandReceipt | null => {
  const receipt = state.commandReceipts[actor]?.[commandId];
  if (receipt) {
    if (receipt.operation !== operation || receipt.payloadHash !== payloadHash) {
      throw new MarketStateError("COMMAND_CONFLICT");
    }
    return receipt;
  }
  if (commandReceiptCount(state) >= MARKET_LIMITS.commandReceipts) {
    throw new MarketStateError("COMMAND_LEDGER_FULL");
  }
  return null;
};

const commit = (
  state: MarketRoom,
  expectedRevision: number,
  now: number,
  changes: Partial<MarketRoom>
): MarketRoom => {
  requireRevision(state, expectedRevision);
  if (state.revision >= Number.MAX_SAFE_INTEGER) throw new MarketStateError("LIMIT_REACHED");
  const next = {
    ...state,
    ...changes,
    revision: state.revision + 1,
    updatedAt: Math.max(state.updatedAt, now)
  };
  const result = MarketRoomSchema.safeParse(next);
  if (!result.success) throw new MarketStateError("STATE_INVALID");
  return result.data;
};

const commitCommand = (
  state: MarketRoom,
  expectedRevision: number,
  now: number,
  actor: string,
  commandId: string,
  operation: CommandOperation,
  payloadHash: string,
  postcondition: CommandPostcondition,
  changes: Partial<MarketRoom>
): MarketRoom => {
  const receipt: CommandReceipt = {
    operation,
    payloadHash,
    committedAt: now,
    committedRevision: state.revision + 1,
    postcondition
  };
  return commit(state, expectedRevision, now, {
    ...changes,
    commandReceipts: {
      ...state.commandReceipts,
      [actor]: {
        ...(state.commandReceipts[actor] ?? {}),
        [commandId]: receipt
      }
    }
  });
};

const sortedValues = <T extends { id: string }>(record: Readonly<Record<string, T>>): T[] =>
  Object.values(record).sort((left, right) => left.id.localeCompare(right.id, "en-AU"));

const receiptsForBuyer = (state: MarketRoom, buyerTeamId: string): Receipt[] =>
  sortedValues(state.receipts).filter((receipt) => receipt.buyerTeamId === buyerTeamId);

type MedalAwardReceipt = Receipt & { readonly medal: Medal };

const isMedalAward = (receipt: Receipt): receipt is MedalAwardReceipt =>
  receipt.medal !== undefined;

const purchasesForBuyer = (state: MarketRoom, buyerTeamId: string): Receipt[] =>
  receiptsForBuyer(state, buyerTeamId).filter((receipt) => !isMedalAward(receipt));

const awardsForVoter = (state: MarketRoom, voterTeamId: string): MedalAwardReceipt[] =>
  receiptsForBuyer(state, voterTeamId).filter(isMedalAward);

const moneySpentBy = (state: MarketRoom, buyerTeamId: string): number =>
  purchasesForBuyer(state, buyerTeamId).reduce((total, receipt) => total + receipt.price, 0);

const walletFor = (state: MarketRoom, buyerTeamId: string): number =>
  state.openingWallet - moneySpentBy(state, buyerTeamId);

export function createMarketRoom(input: CreateMarketRoomInput): MarketRoom {
  const command = parseInput(() => CreateMarketRoomInputSchema.parse(input));
  return MarketRoomSchema.parse({
    schemaVersion: 2,
    id: command.roomId,
    revision: 0,
    phase: "building",
    marketMode: "medals",
    openingWallet: command.openingWallet,
    maxTeams: command.maxTeams ?? MARKET_LIMITS.defaultTeams,
    createdAt: command.now,
    updatedAt: command.now,
    teams: {},
    campaigns: {},
    receipts: {},
    finishedAtByTeamId: {},
    artworkUploadsByTeam: {},
    marketCohort: null,
    commandReceipts: {},
    sessionBindings: { createdBy: null, joins: {} }
  });
}

export function joinTeam(stateValue: MarketRoom, input: JoinTeamInput): MarketRoom {
  const state = readRoom(stateValue);
  const command = parseInput(() => JoinTeamInputSchema.parse(input));
  requireRevision(state, command.expectedRevision);
  requirePhase(state, "building");
  if (state.teams[command.teamId]) throw new MarketStateError("ID_CONFLICT");
  if (Object.keys(state.teams).length >= state.maxTeams) {
    throw new MarketStateError("LIMIT_REACHED");
  }
  const foldedAlias = command.alias.toLocaleLowerCase("en-AU");
  if (Object.values(state.teams).some((team) =>
    team.alias.toLocaleLowerCase("en-AU") === foldedAlias)) {
    throw new MarketStateError("ALIAS_TAKEN");
  }
  return commit(state, command.expectedRevision, command.now, {
    teams: {
      ...state.teams,
      [command.teamId]: { id: command.teamId, alias: command.alias, joinedAt: command.now }
    }
  });
}

export interface JoinTeamWithSessionBindingInput extends JoinTeamInput {
  readonly intentKey: string;
  readonly payloadHash: string;
}

export interface JoinTeamWithSessionBindingResult {
  readonly state: MarketRoom;
  readonly team: Team;
  readonly replayed: boolean;
}

export function joinTeamWithSessionBinding(
  stateValue: MarketRoom,
  input: JoinTeamWithSessionBindingInput
): JoinTeamWithSessionBindingResult {
  const state = readRoom(stateValue);
  const command = parseInput(() => JoinTeamWithSessionBindingInputSchema.parse(input));
  const existing = state.sessionBindings.joins[command.intentKey];
  if (existing) {
    if (existing.payloadHash !== command.payloadHash) {
      throw new MarketStateError("IDEMPOTENCY_CONFLICT");
    }
    const team = state.teams[existing.teamId];
    if (!team) throw new MarketStateError("STATE_INVALID");
    return { state, team, replayed: true };
  }

  const joined = joinTeam(state, {
    expectedRevision: command.expectedRevision,
    teamId: command.teamId,
    alias: command.alias,
    now: command.now
  });
  const next = readRoom({
    ...joined,
    sessionBindings: {
      ...joined.sessionBindings,
      joins: {
        ...joined.sessionBindings.joins,
        [command.intentKey]: { teamId: command.teamId, payloadHash: command.payloadHash }
      }
    }
  });
  return { state: next, team: next.teams[command.teamId]!, replayed: false };
}

export interface RegisterArtworkUploadResult {
  readonly state: MarketRoom;
  readonly upload: ArtworkUpload;
  readonly registered: boolean;
}

export function registerArtworkUpload(
  stateValue: MarketRoom,
  input: RegisterArtworkUploadInput
): RegisterArtworkUploadResult {
  const state = readRoom(stateValue);
  const command = parseInput(() => RegisterArtworkUploadInputSchema.parse(input));
  requirePhase(state, "building");
  if (!state.teams[command.teamId]) throw new MarketStateError("TEAM_NOT_FOUND");

  const uploads = state.artworkUploadsByTeam[command.teamId] ?? {};
  const existing = uploads[command.contentHash];
  if (existing) {
    if (existing.artworkKey !== command.artworkKey || existing.byteLength !== command.byteLength) {
      throw new MarketStateError("ID_CONFLICT");
    }
    return { state, upload: existing, registered: false };
  }

  requireRevision(state, command.expectedRevision);
  const campaigns = Object.values(state.campaigns)
    .filter((campaign) => campaign.sellerTeamId === command.teamId);
  if (campaigns.some((campaign) => campaign.status !== "returned")) {
    throw new MarketStateError("ARTWORK_UPLOAD_NOT_ALLOWED");
  }
  const usedBytes = Object.values(uploads)
    .reduce((total, upload) => total + upload.byteLength, 0);
  if (Object.keys(uploads).length >= MARKET_LIMITS.artworkUploadsPerTeam ||
    usedBytes + command.byteLength > MARKET_LIMITS.artworkBytesPerTeam) {
    throw new MarketStateError("ARTWORK_QUOTA_EXHAUSTED");
  }

  const upload: ArtworkUpload = {
    contentHash: command.contentHash,
    artworkKey: command.artworkKey,
    byteLength: command.byteLength,
    registeredAt: command.now
  };
  const next = commit(state, command.expectedRevision, command.now, {
    artworkUploadsByTeam: {
      ...state.artworkUploadsByTeam,
      [command.teamId]: { ...uploads, [command.contentHash]: upload }
    }
  });
  return {
    state: next,
    upload: next.artworkUploadsByTeam[command.teamId]![command.contentHash]!,
    registered: true
  };
}

export function removeTeam(stateValue: MarketRoom, input: RemoveTeamInput): MarketRoom {
  const state = readRoom(stateValue);
  const command = parseInput(() => RemoveTeamInputSchema.parse(input));
  const actor = "teacher";
  const payloadHash = commandPayloadHash(canonicalRemoveTeamCommandPayload(command.teamId));
  if (replayCommand(state, actor, command.commandId, "removeTeam", payloadHash)) return state;
  requireRevision(state, command.expectedRevision);
  requirePhase(state, "building");
  if (!state.teams[command.teamId]) throw new MarketStateError("TEAM_NOT_FOUND");

  const withoutTeam = <T>(record: Readonly<Record<string, T>>): Record<string, T> =>
    Object.fromEntries(Object.entries(record).filter(([key]) => key !== command.teamId));
  const campaigns = Object.fromEntries(Object.entries(state.campaigns)
    .filter(([, campaign]) => campaign.sellerTeamId !== command.teamId));
  const receipts = Object.fromEntries(Object.entries(state.receipts)
    .filter(([, receipt]) =>
      receipt.buyerTeamId !== command.teamId && receipt.sellerTeamId !== command.teamId));
  const joins = Object.fromEntries(Object.entries(state.sessionBindings.joins)
    .filter(([, binding]) => binding.teamId !== command.teamId));
  return commitCommand(
    state,
    command.expectedRevision,
    command.now,
    actor,
    command.commandId,
    "removeTeam",
    payloadHash,
    { kind: "removeTeam", teamId: command.teamId },
    {
      teams: withoutTeam(state.teams),
      campaigns,
      receipts,
      finishedAtByTeamId: withoutTeam(state.finishedAtByTeamId),
      artworkUploadsByTeam: withoutTeam(state.artworkUploadsByTeam),
      sessionBindings: { ...state.sessionBindings, joins }
    }
  );
}

export function submitCampaign(
  stateValue: MarketRoom,
  input: SubmitCampaignInput
): MarketRoom {
  const state = readRoom(stateValue);
  const command = parseInput(() => SubmitCampaignInputSchema.parse(input));
  const actor = `team:${command.sellerTeamId}`;
  const payloadHash = commandPayloadHash(canonicalPublishCommandPayload(command));
  if (replayCommand(state, actor, command.commandId, "publish", payloadHash)) return state;
  requireRevision(state, command.expectedRevision);
  requirePhase(state, "building");
  if (!state.teams[command.sellerTeamId]) throw new MarketStateError("TEAM_NOT_FOUND");
  const registeredArtwork = Object.values(state.artworkUploadsByTeam[command.sellerTeamId] ?? {})
    .some((upload) => upload.artworkKey === command.artworkKey);
  if (!registeredArtwork) throw new MarketStateError("ARTWORK_NOT_REGISTERED");

  const existing = state.campaigns[command.campaignId];
  if (existing && (existing.sellerTeamId !== command.sellerTeamId || existing.status !== "returned")) {
    throw new MarketStateError("ID_CONFLICT");
  }
  if (!existing && Object.keys(state.campaigns).length >= MARKET_LIMITS.campaigns) {
    throw new MarketStateError("LIMIT_REACHED");
  }

  const campaign = CampaignSchema.parse({
    id: command.campaignId,
    sellerTeamId: command.sellerTeamId,
    submissionVersion: existing === undefined ? 1 : existing.submissionVersion + 1,
    status: "pending",
    productName: command.productName,
    ...(command.tagline === undefined ? {} : { tagline: command.tagline }),
    price: command.price,
    artworkKey: command.artworkKey,
    submittedAt: command.now
  });
  return commitCommand(
    state,
    command.expectedRevision,
    command.now,
    actor,
    command.commandId,
    "publish",
    payloadHash,
    { kind: "publish", campaignId: campaign.id, submissionVersion: campaign.submissionVersion },
    { campaigns: { ...state.campaigns, [campaign.id]: campaign } }
  );
}

export function reviewCampaign(
  stateValue: MarketRoom,
  input: ReviewCampaignInput
): MarketRoom {
  const state = readRoom(stateValue);
  const command = parseInput(() => ReviewCampaignInputSchema.parse(input));
  const actor = "teacher";
  const payloadHash = commandPayloadHash(canonicalReviewCommandPayload(command));
  if (replayCommand(state, actor, command.commandId, "review", payloadHash)) return state;
  requireRevision(state, command.expectedRevision);
  requirePhase(state, "building");
  const campaign = state.campaigns[command.campaignId];
  if (!campaign) throw new MarketStateError("CAMPAIGN_NOT_FOUND");
  if (campaign.submissionVersion !== command.submissionVersion) {
    throw new MarketStateError("SUBMISSION_VERSION_CONFLICT");
  }

  const reviewed = CampaignSchema.parse({
    id: campaign.id,
    sellerTeamId: campaign.sellerTeamId,
    submissionVersion: campaign.submissionVersion,
    status: command.status,
    productName: campaign.productName,
    ...(campaign.tagline === undefined ? {} : { tagline: campaign.tagline }),
    price: campaign.price,
    artworkKey: campaign.artworkKey,
    submittedAt: campaign.submittedAt,
    reviewedAt: command.now,
    ...(command.reviewNote === undefined ? {} : { reviewNote: command.reviewNote })
  });
  return commitCommand(
    state,
    command.expectedRevision,
    command.now,
    actor,
    command.commandId,
    "review",
    payloadHash,
    {
      kind: "review",
      campaignId: reviewed.id,
      submissionVersion: reviewed.submissionVersion,
      status: command.status
    },
    { campaigns: { ...state.campaigns, [reviewed.id]: reviewed } }
  );
}

const minimumPriceBySeller = (
  campaigns: readonly Campaign[],
  excludedTeamId: string
): number[] => {
  const prices = new Map<string, number>();
  for (const campaign of campaigns) {
    if (campaign.sellerTeamId === excludedTeamId) continue;
    const current = prices.get(campaign.sellerTeamId);
    if (current === undefined || campaign.price < current) prices.set(campaign.sellerTeamId, campaign.price);
  }
  return [...prices.values()].sort((left, right) => left - right);
};

const isLaterCampaign = (candidate: Campaign, current: Campaign): boolean =>
  candidate.submittedAt > current.submittedAt ||
  (candidate.submittedAt === current.submittedAt &&
    (candidate.submissionVersion > current.submissionVersion ||
      (candidate.submissionVersion === current.submissionVersion &&
        candidate.id.localeCompare(current.id, "en-AU") > 0)));

const currentCampaignsByTeam = (state: MarketRoom): ReadonlyMap<string, Campaign> => {
  const current = new Map<string, Campaign>();
  for (const campaign of sortedValues(state.campaigns)) {
    const previous = current.get(campaign.sellerTeamId);
    if (!previous || isLaterCampaign(campaign, previous)) {
      current.set(campaign.sellerTeamId, campaign);
    }
  }
  return current;
};

const candidateMarketCohort = (state: MarketRoom): MarketCohort => {
  const campaigns = [...currentCampaignsByTeam(state).values()]
    .filter(({ status }) => status === "approved")
    .sort((left, right) => left.id.localeCompare(right.id, "en-AU"));
  const teamIds = campaigns
    .map(({ sellerTeamId }) => sellerTeamId)
    .sort((left, right) => left.localeCompare(right, "en-AU"));
  return {
    buyerTeamIds: teamIds,
    sellerTeamIds: [...teamIds],
    campaignIds: campaigns.map(({ id }) => id)
  };
};

export type MarketReadinessResult<ErrorCode extends MarketStateErrorCode = MarketStateErrorCode> =
  | { readonly allowed: true; readonly errorCode: null }
  | { readonly allowed: false; readonly errorCode: ErrorCode };

export type OpenMarketReadiness =
  | (MarketReadinessResult<"WRONG_PHASE" | "MARKET_NOT_READY"> & {
      readonly cohort: MarketCohort | null;
    });

export function canOpenMarket(stateValue: MarketRoom): OpenMarketReadiness {
  const state = readRoom(stateValue);
  if (state.phase !== "building") {
    return { allowed: false, errorCode: "WRONG_PHASE", cohort: null };
  }

  const cohort = candidateMarketCohort(state);
  const minimumSellers = state.marketMode === "medals" ? 4 : 3;
  if (cohort.sellerTeamIds.length < minimumSellers) {
    return { allowed: false, errorCode: "MARKET_NOT_READY", cohort };
  }
  if (state.marketMode === "purchases") {
    const campaigns = cohort.campaignIds.map((campaignId) => state.campaigns[campaignId]!);
    for (const buyerTeamId of cohort.buyerTeamIds) {
      const prices = minimumPriceBySeller(campaigns, buyerTeamId);
      if (prices.length < 2 || prices[0]! + prices[1]! > state.openingWallet) {
        return { allowed: false, errorCode: "MARKET_NOT_READY", cohort };
      }
    }
  }
  return { allowed: true, errorCode: null, cohort };
}

export function canOpenReveal(
  stateValue: MarketRoom
): MarketReadinessResult<"WRONG_PHASE" | "REVEAL_NOT_READY"> {
  const state = readRoom(stateValue);
  if (state.phase !== "market") return { allowed: false, errorCode: "WRONG_PHASE" };
  const buyers = state.marketCohort!.buyerTeamIds;
  if (buyers.length === 0 || buyers.some((teamId) => state.finishedAtByTeamId[teamId] === undefined)) {
    return { allowed: false, errorCode: "REVEAL_NOT_READY" };
  }
  return { allowed: true, errorCode: null };
}

export function canCloseMarket(
  stateValue: MarketRoom
): MarketReadinessResult<"WRONG_PHASE"> {
  const state = readRoom(stateValue);
  return state.phase === "reveal"
    ? { allowed: true, errorCode: null }
    : { allowed: false, errorCode: "WRONG_PHASE" };
}

export type MarketEligibilityRole = "buyer-seller" | "buyer" | "seller" | "spectator";
export type MarketEligibilityReason =
  | "approved-campaign"
  | "no-campaign"
  | "campaign-pending"
  | "campaign-returned"
  | "campaign-hidden"
  | "not-in-cohort"
  | "legacy-cohort";

export interface MarketEligibility {
  readonly state: "building" | "frozen";
  readonly role: MarketEligibilityRole;
  readonly reason: MarketEligibilityReason;
}

const inCohortRole = (buyer: boolean, seller: boolean): MarketEligibilityRole => {
  if (buyer && seller) return "buyer-seller";
  if (buyer) return "buyer";
  if (seller) return "seller";
  return "spectator";
};

const campaignEligibilityReason = (campaign: Campaign | undefined): MarketEligibilityReason => {
  if (!campaign) return "no-campaign";
  if (campaign.status === "approved") return "approved-campaign";
  return `campaign-${campaign.status}`;
};

export function marketEligibilityForTeam(
  stateValue: MarketRoom,
  teamId: string
): MarketEligibility {
  const state = readRoom(stateValue);
  if (!state.teams[teamId]) throw new MarketStateError("TEAM_NOT_FOUND");
  const current = currentCampaignsByTeam(state).get(teamId);
  if (state.marketCohort === null) {
    const approved = current?.status === "approved";
    return {
      state: "building",
      role: approved ? "buyer-seller" : "spectator",
      reason: campaignEligibilityReason(current)
    };
  }

  const buyer = state.marketCohort.buyerTeamIds.includes(teamId);
  const seller = state.marketCohort.sellerTeamIds.includes(teamId);
  const role = inCohortRole(buyer, seller);
  if (role === "spectator") {
    return {
      state: "frozen",
      role,
      reason: current?.status === "approved" ? "not-in-cohort" : campaignEligibilityReason(current)
    };
  }
  const approvedCurrentFrozen = current?.status === "approved" &&
    state.marketCohort.campaignIds.includes(current.id);
  return {
    state: "frozen",
    role,
    reason: approvedCurrentFrozen ? "approved-campaign" : "legacy-cohort"
  };
}

export interface MarketCohortCounts {
  readonly frozen: boolean;
  readonly totalJoined: number;
  readonly participating: number;
  readonly spectating: number;
  readonly buyers: number;
  readonly sellers: number;
  readonly requiredFinished: number;
  readonly finishedRequired: number;
}

export function marketCohortCounts(stateValue: MarketRoom): MarketCohortCounts {
  const state = readRoom(stateValue);
  const frozen = state.marketCohort !== null;
  const cohort = state.marketCohort ?? candidateMarketCohort(state);
  const participants = new Set([...cohort.buyerTeamIds, ...cohort.sellerTeamIds]);
  const requiredFinished = frozen ? cohort.buyerTeamIds.length : 0;
  const finishedRequired = frozen
    ? cohort.buyerTeamIds.filter((teamId) => state.finishedAtByTeamId[teamId] !== undefined).length
    : 0;
  return {
    frozen,
    totalJoined: Object.keys(state.teams).length,
    participating: participants.size,
    spectating: Object.keys(state.teams).length - participants.size,
    buyers: cohort.buyerTeamIds.length,
    sellers: cohort.sellerTeamIds.length,
    requiredFinished,
    finishedRequired
  };
}

export function openMarket(stateValue: MarketRoom, input: OpenMarketInput): MarketRoom {
  const state = readRoom(stateValue);
  const command = parseInput(() => OpenMarketInputSchema.parse(input));
  const actor = "teacher";
  const payloadHash = commandPayloadHash(canonicalControlCommandPayload("openMarket"));
  if (replayCommand(state, actor, command.commandId, "openMarket", payloadHash)) return state;
  requireRevision(state, command.expectedRevision);
  const readiness = canOpenMarket(state);
  if (!readiness.allowed) throw new MarketStateError(readiness.errorCode);

  return commitCommand(
    state,
    command.expectedRevision,
    command.now,
    actor,
    command.commandId,
    "openMarket",
    payloadHash,
    { kind: "control", action: "openMarket" },
    { phase: "market", marketCohort: readiness.cohort }
  );
}

export interface PurchaseResult {
  readonly state: MarketRoom;
  readonly receipt: Receipt;
  readonly replayed: boolean;
}

export function purchaseCampaign(
  stateValue: MarketRoom,
  input: PurchaseInput
): PurchaseResult {
  const state = readRoom(stateValue);
  const command = parseInput(() => PurchaseInputSchema.parse(input));
  const canonicalPayload = canonicalPurchasePayload(command.campaignId);
  const replay = Object.values(state.receipts).find((receipt) =>
    receipt.buyerTeamId === command.buyerTeamId && receipt.requestId === command.requestId);
  if (replay) {
    if (replay.canonicalPayload !== canonicalPayload) {
      throw new MarketStateError("IDEMPOTENCY_CONFLICT");
    }
    return { state, receipt: replay, replayed: true };
  }

  requireRevision(state, command.expectedRevision);
  requirePhase(state, "market");
  if (state.marketMode !== "purchases") throw new MarketStateError("MARKET_NOT_ELIGIBLE");
  if (!state.teams[command.buyerTeamId]) throw new MarketStateError("TEAM_NOT_FOUND");
  if (!state.marketCohort!.buyerTeamIds.includes(command.buyerTeamId)) {
    throw new MarketStateError("MARKET_NOT_ELIGIBLE");
  }
  if (state.finishedAtByTeamId[command.buyerTeamId]) throw new MarketStateError("TEAM_FINISHED");
  if (state.receipts[command.receiptId]) throw new MarketStateError("ID_CONFLICT");
  if (Object.keys(state.receipts).length >= MARKET_LIMITS.receipts) {
    throw new MarketStateError("LIMIT_REACHED");
  }

  const campaign = state.campaigns[command.campaignId];
  if (!campaign) throw new MarketStateError("CAMPAIGN_NOT_FOUND");
  if (campaign.status !== "approved" || !state.marketCohort!.campaignIds.includes(campaign.id)) {
    throw new MarketStateError("CAMPAIGN_NOT_APPROVED");
  }
  if (campaign.sellerTeamId === command.buyerTeamId) throw new MarketStateError("OWN_CAMPAIGN");
  if (Object.values(state.receipts).some((receipt) =>
    receipt.buyerTeamId === command.buyerTeamId && receipt.campaignId === campaign.id)) {
    throw new MarketStateError("ALREADY_PURCHASED");
  }
  if (campaign.price > walletFor(state, command.buyerTeamId)) {
    throw new MarketStateError("INSUFFICIENT_FUNDS");
  }

  const receipt: Receipt = {
    id: command.receiptId,
    buyerTeamId: command.buyerTeamId,
    sellerTeamId: campaign.sellerTeamId,
    campaignId: campaign.id,
    price: campaign.price,
    requestId: command.requestId,
    canonicalPayload,
    purchasedAt: command.now
  };
  const next = commit(state, command.expectedRevision, command.now, {
    receipts: { ...state.receipts, [receipt.id]: receipt }
  });
  return { state: next, receipt: next.receipts[receipt.id]!, replayed: false };
}

export interface AwardResult {
  readonly state: MarketRoom;
  readonly receipt: MedalAwardReceipt | null;
  readonly replayed: boolean;
}

export function awardCampaign(
  stateValue: MarketRoom,
  input: AwardInput
): AwardResult {
  const state = readRoom(stateValue);
  const command = parseInput(() => AwardInputSchema.parse(input));
  const actor = `team:${command.voterTeamId}`;
  const canonicalPayload = canonicalAwardCommandPayload(command);
  const payloadHash = commandPayloadHash(canonicalPayload);
  if (replayCommand(state, actor, command.commandId, "award", payloadHash)) {
    const current = awardsForVoter(state, command.voterTeamId).find(({ medal }) => medal === command.medal) ?? null;
    return { state, receipt: current, replayed: true };
  }

  requireRevision(state, command.expectedRevision);
  requirePhase(state, "market");
  if (state.marketMode !== "medals") throw new MarketStateError("MARKET_NOT_ELIGIBLE");
  if (!state.teams[command.voterTeamId]) throw new MarketStateError("TEAM_NOT_FOUND");
  if (!state.marketCohort!.buyerTeamIds.includes(command.voterTeamId)) {
    throw new MarketStateError("MARKET_NOT_ELIGIBLE");
  }
  if (state.finishedAtByTeamId[command.voterTeamId]) throw new MarketStateError("TEAM_FINISHED");
  if (Object.keys(state.receipts).length >= MARKET_LIMITS.receipts) {
    throw new MarketStateError("LIMIT_REACHED");
  }

  const campaign = state.campaigns[command.campaignId];
  if (!campaign) throw new MarketStateError("CAMPAIGN_NOT_FOUND");
  if (campaign.status !== "approved" || !state.marketCohort!.campaignIds.includes(campaign.id)) {
    throw new MarketStateError("CAMPAIGN_NOT_APPROVED");
  }
  if (campaign.sellerTeamId === command.voterTeamId) throw new MarketStateError("OWN_CAMPAIGN");

  const existingAwards = awardsForVoter(state, command.voterTeamId);
  const replaced = existingAwards.find(({ medal }) => medal === command.medal);
  if (existingAwards.some(({ campaignId, medal }) =>
    campaignId === campaign.id && medal !== command.medal)) {
    throw new MarketStateError("CAMPAIGN_ALREADY_AWARDED");
  }
  if (state.receipts[command.receiptId] && replaced?.id !== command.receiptId) {
    throw new MarketStateError("ID_CONFLICT");
  }

  const receipt: MedalAwardReceipt = {
    id: command.receiptId,
    buyerTeamId: command.voterTeamId,
    sellerTeamId: campaign.sellerTeamId,
    campaignId: campaign.id,
    medal: command.medal,
    price: campaign.price,
    requestId: command.commandId,
    canonicalPayload,
    purchasedAt: command.now
  };
  const receipts = Object.fromEntries(Object.entries(state.receipts)
    .filter(([receiptId]) => receiptId !== replaced?.id));
  const next = commitCommand(
    state,
    command.expectedRevision,
    command.now,
    actor,
    command.commandId,
    "award",
    payloadHash,
    { kind: "award", campaignId: campaign.id, medal: command.medal, receiptId: receipt.id },
    { receipts: { ...receipts, [receipt.id]: receipt } }
  );
  return { state: next, receipt: next.receipts[receipt.id] as MedalAwardReceipt, replayed: false };
}

const hasAffordablePurchase = (state: MarketRoom, teamId: string): boolean => {
  const bought = new Set(purchasesForBuyer(state, teamId).map(({ campaignId }) => campaignId));
  const wallet = walletFor(state, teamId);
  return state.marketCohort!.campaignIds.some((campaignId) => {
    const campaign = state.campaigns[campaignId]!;
    return campaign.status === "approved" &&
    campaign.sellerTeamId !== teamId &&
    !bought.has(campaign.id) &&
    campaign.price <= wallet;
  });
};

export function finishTeam(stateValue: MarketRoom, input: FinishTeamInput): MarketRoom {
  const state = readRoom(stateValue);
  const command = parseInput(() => FinishTeamInputSchema.parse(input));
  const actor = `team:${command.teamId}`;
  const payloadHash = commandPayloadHash(canonicalFinishCommandPayload(command.teamId));
  if (replayCommand(state, actor, command.commandId, "finish", payloadHash)) return state;
  requireRevision(state, command.expectedRevision);
  requirePhase(state, "market");
  if (!state.teams[command.teamId]) throw new MarketStateError("TEAM_NOT_FOUND");
  if (!state.marketCohort!.buyerTeamIds.includes(command.teamId)) {
    throw new MarketStateError("MARKET_NOT_ELIGIBLE");
  }
  if (state.finishedAtByTeamId[command.teamId]) throw new MarketStateError("TEAM_FINISHED");

  if (state.marketMode === "medals") {
    const awards = awardsForVoter(state, command.teamId);
    if (awards.length !== 3 || new Set(awards.map(({ medal }) => medal)).size !== 3) {
      throw new MarketStateError("FINISH_NOT_ALLOWED");
    }
  } else {
  const purchases = purchasesForBuyer(state, command.teamId);
  const sellers = new Set(purchases.map(({ sellerTeamId }) => sellerTeamId));
  const spent = purchases.reduce((total, receipt) => total + receipt.price, 0);
  const spentEnough = spent * 100 >= state.openingWallet * 80;
  const noAffordablePurchaseRemains = !hasAffordablePurchase(state, command.teamId);
  if (sellers.size < 2 || (!spentEnough && !noAffordablePurchaseRemains)) {
    throw new MarketStateError("FINISH_NOT_ALLOWED");
  }
  }

  return commitCommand(
    state,
    command.expectedRevision,
    command.now,
    actor,
    command.commandId,
    "finish",
    payloadHash,
    { kind: "finish", finishedAt: command.now },
    { finishedAtByTeamId: { ...state.finishedAtByTeamId, [command.teamId]: command.now } }
  );
}

export function openReveal(stateValue: MarketRoom, input: OpenRevealInput): MarketRoom {
  const state = readRoom(stateValue);
  const command = parseInput(() => OpenRevealInputSchema.parse(input));
  const actor = "teacher";
  const payloadHash = commandPayloadHash(canonicalControlCommandPayload("openReveal"));
  if (replayCommand(state, actor, command.commandId, "openReveal", payloadHash)) return state;
  requireRevision(state, command.expectedRevision);
  const readiness = canOpenReveal(state);
  if (!readiness.allowed) throw new MarketStateError(readiness.errorCode);
  return commitCommand(
    state,
    command.expectedRevision,
    command.now,
    actor,
    command.commandId,
    "openReveal",
    payloadHash,
    { kind: "control", action: "openReveal" },
    { phase: "reveal" }
  );
}

export function closeMarket(stateValue: MarketRoom, input: CloseMarketInput): MarketRoom {
  const state = readRoom(stateValue);
  const command = parseInput(() => CloseMarketInputSchema.parse(input));
  const actor = "teacher";
  const payloadHash = commandPayloadHash(canonicalControlCommandPayload("closeMarket"));
  if (replayCommand(state, actor, command.commandId, "closeMarket", payloadHash)) return state;
  requireRevision(state, command.expectedRevision);
  const readiness = canCloseMarket(state);
  if (!readiness.allowed) throw new MarketStateError(readiness.errorCode);
  return commitCommand(
    state,
    command.expectedRevision,
    command.now,
    actor,
    command.commandId,
    "closeMarket",
    payloadHash,
    { kind: "control", action: "closeMarket" },
    { phase: "closed" }
  );
}

export interface RevealStanding {
  readonly rank: number;
  readonly teamId: string;
  readonly alias: string;
  readonly revenue: number;
  readonly sales: number;
  readonly points: number;
  readonly gold: number;
  readonly silver: number;
  readonly bronze: number;
}

export interface MarketReveal {
  readonly roomId: string;
  readonly revision: number;
  readonly standings: readonly RevealStanding[];
}

export function computeReveal(stateValue: MarketRoom): MarketReveal {
  const state = readRoom(stateValue);
  if (state.phase !== "reveal" && state.phase !== "closed") {
    throw new MarketStateError("WRONG_PHASE");
  }
  const participantIds = [...new Set([
    ...state.marketCohort!.buyerTeamIds,
    ...state.marketCohort!.sellerTeamIds
  ])].sort((left, right) => left.localeCompare(right, "en-AU"));
  const totals = Object.fromEntries(participantIds.map((teamId) => [
    teamId,
    { teamId, alias: state.teams[teamId]!.alias, revenue: 0, sales: 0, points: 0, gold: 0, silver: 0, bronze: 0 }
  ])) as Record<string, {
    teamId: string;
    alias: string;
    revenue: number;
    sales: number;
    points: number;
    gold: number;
    silver: number;
    bronze: number;
  }>;
  const medalMarket = state.marketMode === "medals";
  for (const receipt of Object.values(state.receipts)) {
    const total = totals[receipt.sellerTeamId];
    if (!total) throw new MarketStateError("STATE_INVALID");
    if (isMedalAward(receipt)) {
      const points = receipt.medal === "gold" ? 3 : receipt.medal === "silver" ? 2 : 1;
      total.points += points;
      total[receipt.medal] += 1;
    } else if (!medalMarket) {
      total.revenue += receipt.price;
      total.sales += 1;
    }
  }
  const ordered = Object.values(totals).sort((left, right) => medalMarket
    ? right.points - left.points ||
      right.gold - left.gold ||
      right.silver - left.silver ||
      right.bronze - left.bronze ||
      left.teamId.localeCompare(right.teamId, "en-AU")
    : right.revenue - left.revenue ||
      right.sales - left.sales ||
      left.teamId.localeCompare(right.teamId, "en-AU"));
  return {
    roomId: state.id,
    revision: state.revision,
    standings: ordered.map((standing, index) => ({ rank: index + 1, ...standing }))
  };
}

export interface StudentTeamSummary {
  readonly id: string;
  readonly alias: string;
}

export interface StudentCampaignSummary {
  readonly id: string;
  readonly sellerTeamId: string;
  readonly sellerAlias: string;
  readonly status: Campaign["status"];
  readonly productName: string;
  readonly tagline?: string;
  readonly price: number;
  readonly artworkKey: string;
  readonly reviewNote?: string;
}

export interface StudentPurchaseSummary {
  readonly id: string;
  readonly campaignId: string;
  readonly sellerTeamId: string;
  readonly price: number;
  readonly purchasedAt: number;
}

export interface StudentAwardSummary {
  readonly id: string;
  readonly campaignId: string;
  readonly sellerTeamId: string;
  readonly medal: Medal;
  readonly awardedAt: number;
}

export interface StudentMarketSnapshot {
  readonly roomId: string;
  readonly revision: number;
  readonly phase: MarketRoom["phase"];
  readonly marketMode: MarketRoom["marketMode"];
  readonly own: {
    readonly teamId: string;
    readonly alias: string;
    readonly wallet?: number;
    readonly spent?: number;
    readonly finished: boolean;
    readonly marketEligibility: MarketEligibility;
  };
  readonly teams: readonly StudentTeamSummary[];
  readonly campaigns: readonly StudentCampaignSummary[];
  readonly myPurchases: readonly StudentPurchaseSummary[];
  readonly myAwards: readonly StudentAwardSummary[];
}

export function studentMarketSnapshot(
  stateValue: MarketRoom,
  viewerTeamId: string
): StudentMarketSnapshot {
  const state = readRoom(stateValue);
  const team = state.teams[viewerTeamId];
  if (!team) throw new MarketStateError("TEAM_NOT_FOUND");
  const purchases = purchasesForBuyer(state, viewerTeamId);
  const medalOrder: Readonly<Record<Medal, number>> = { gold: 0, silver: 1, bronze: 2 };
  const awards = awardsForVoter(state, viewerTeamId)
    .sort((left, right) => medalOrder[left.medal] - medalOrder[right.medal]);
  const spent = purchases.reduce((total, receipt) => total + receipt.price, 0);
  const frozenCampaignIds = state.marketCohort === null
    ? null
    : new Set(state.marketCohort.campaignIds);
  const campaigns = sortedValues(state.campaigns)
    .filter((campaign) => frozenCampaignIds === null
      ? campaign.status === "approved" || campaign.sellerTeamId === viewerTeamId
      : frozenCampaignIds.has(campaign.id))
    .map((campaign): StudentCampaignSummary => ({
      id: campaign.id,
      sellerTeamId: campaign.sellerTeamId,
      sellerAlias: state.teams[campaign.sellerTeamId]!.alias,
      status: campaign.status,
      productName: campaign.productName,
      ...(campaign.tagline === undefined ? {} : { tagline: campaign.tagline }),
      price: campaign.price,
      artworkKey: campaign.artworkKey,
      ...(campaign.sellerTeamId === viewerTeamId && campaign.reviewNote !== undefined
        ? { reviewNote: campaign.reviewNote }
        : {})
    }));
  return {
    roomId: state.id,
    revision: state.revision,
    phase: state.phase,
    marketMode: state.marketMode,
    own: {
      teamId: team.id,
      alias: team.alias,
      ...(state.marketMode === "purchases"
        ? { wallet: state.openingWallet - spent, spent }
        : {}),
      finished: state.finishedAtByTeamId[team.id] !== undefined,
      marketEligibility: marketEligibilityForTeam(state, team.id)
    },
    teams: sortedValues(state.teams).map(({ id, alias }) => ({ id, alias })),
    campaigns,
    myPurchases: purchases.map(({ id, campaignId, sellerTeamId, price, purchasedAt }) => ({
      id,
      campaignId,
      sellerTeamId,
      price,
      purchasedAt
    })),
    myAwards: awards.map(({ id, campaignId, sellerTeamId, medal, purchasedAt }) => ({
      id,
      campaignId,
      sellerTeamId,
      medal,
      awardedAt: purchasedAt
    }))
  };
}
