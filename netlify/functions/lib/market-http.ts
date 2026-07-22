import {
  MarketStateError,
  canCloseMarket,
  canOpenMarket,
  canOpenReveal,
  computeReveal,
  marketCohortCounts,
  marketEligibilityForTeam,
  studentMarketSnapshot
} from "./market-state";
import type { MarketRoom } from "./market-contracts";
import { MarketRoomServiceError } from "./netlify-market-room";

export const MARKET_JSON_LIMIT = 16 * 1_024;

export class MarketRequestError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = "MarketRequestError";
  }
}

export const marketJson = (
  body: unknown,
  status = 200,
  headers: globalThis.HeadersInit = {}
): Response => Response.json(body, {
  status,
  headers: {
    "cache-control": "no-store",
    ...Object.fromEntries(new Headers(headers))
  }
});

export async function readMarketJson(request: Request): Promise<unknown> {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new MarketRequestError("UNSUPPORTED_MEDIA_TYPE", 415);
  }
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/u.test(declared) || Number(declared) > MARKET_JSON_LIMIT)) {
    throw new MarketRequestError("REQUEST_TOO_LARGE", 413);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MARKET_JSON_LIMIT) {
    throw new MarketRequestError("REQUEST_TOO_LARGE", 413);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new MarketRequestError("INVALID_REQUEST", 400);
  }
}

export function teacherMarketSnapshot(state: MarketRoom, roomCode: string): Record<string, unknown> {
  const teams = Object.values(state.teams)
    .sort((left, right) => left.id.localeCompare(right.id, "en-AU"))
    .map((team) => ({
      id: team.id,
      alias: team.alias,
      joinedAt: team.joinedAt,
      finished: state.finishedAtByTeamId[team.id] !== undefined,
      marketEligibility: marketEligibilityForTeam(state, team.id)
    }));
  const campaigns = Object.values(state.campaigns)
    .sort((left, right) => left.id.localeCompare(right.id, "en-AU"))
    .map((campaign) => ({
      id: campaign.id,
      sellerTeamId: campaign.sellerTeamId,
      sellerAlias: state.teams[campaign.sellerTeamId]!.alias,
      submissionVersion: campaign.submissionVersion,
      status: campaign.status,
      productName: campaign.productName,
      ...(campaign.tagline === undefined ? {} : { tagline: campaign.tagline }),
      priceCents: campaign.price,
      artworkKey: campaign.artworkKey,
      submittedAt: campaign.submittedAt,
      ...(campaign.reviewedAt === undefined ? {} : { reviewedAt: campaign.reviewedAt }),
      ...(campaign.reviewNote === undefined ? {} : { reviewNote: campaign.reviewNote })
    }));
  return {
    roomCode,
    roomId: state.id,
    revision: state.revision,
    phase: state.phase,
    marketMode: state.marketMode,
    maxTeams: state.maxTeams,
    availableSeats: state.maxTeams - teams.length,
    teams,
    campaigns,
    ...(state.marketMode === "medals"
      ? { awardCount: Object.values(state.receipts).filter(({ medal }) => medal !== undefined).length }
      : { openingWalletCents: state.openingWallet, receiptCount: Object.keys(state.receipts).length }),
    cohort: marketCohortCounts(state),
    controls: {
      canOpenMarket: canOpenMarket(state).allowed,
      canOpenReveal: canOpenReveal(state).allowed,
      canCloseMarket: canCloseMarket(state).allowed
    },
    ...((state.phase === "reveal" || state.phase === "closed")
      ? { reveal: computeReveal(state) }
      : {})
  };
}

export const teamMarketSnapshot = (state: MarketRoom, teamId: string): Record<string, unknown> =>
  studentMarketSnapshot(state, teamId) as unknown as Record<string, unknown>;

const domainStatus = (code: MarketStateError["code"]): number => {
  if (code === "INVALID_INPUT") return 400;
  if (code === "TEAM_NOT_FOUND" || code === "CAMPAIGN_NOT_FOUND") return 404;
  if (code === "OWN_CAMPAIGN" || code === "MARKET_NOT_ELIGIBLE") return 403;
  if (code === "STATE_INVALID") return 503;
  return 409;
};

export function marketErrorResponse(error: unknown): Response {
  if (error instanceof MarketRequestError) return marketJson({ error: error.code }, error.status);
  if (error instanceof MarketStateError) return marketJson({ error: error.code }, domainStatus(error.code));
  if (error instanceof MarketRoomServiceError) {
    const status = error.code === "ROOM_NOT_FOUND" || error.code === "ARTWORK_NOT_FOUND"
      ? 404
      : error.code === "ROOM_EXPIRED"
        ? 410
        : 503;
    return marketJson({ error: error.code }, status);
  }
  return marketJson({ error: "MARKET_UNAVAILABLE" }, 503);
}
