import { createHash, randomUUID } from "node:crypto";
import type { Config, Context } from "@netlify/functions";
import { z } from "zod";
import {
  MarketAuthError,
  parseMarketEnvironment,
  readMarketRequestSession,
  type MarketEnvironment,
  type MarketSession
} from "./lib/market-auth";
import {
  ArtworkKeySchema,
  MARKET_LIMITS,
  MarketIdSchema,
  PriceSchema
} from "./lib/market-contracts";
import {
  MarketRequestError,
  marketErrorResponse,
  marketJson,
  readMarketJson,
  teacherMarketSnapshot,
  teamMarketSnapshot
} from "./lib/market-http";
import { MarketPngError, validateMarketPng } from "./lib/market-png";
import {
  closeMarket,
  finishTeam,
  openMarket,
  openReveal,
  purchaseCampaign,
  registerArtworkUpload,
  removeTeam,
  reviewCampaign,
  submitCampaign
} from "./lib/market-state";
import {
  defaultMarketRoomService,
  marketArtworkKey,
  marketArtworkPrefix,
  type MarketRoomService
} from "./lib/netlify-market-room";

const MAX_ARTWORK_BYTES = MARKET_LIMITS.artworkBytesPerUpload;
const ENVIRONMENT_KEYS = ["MARKET_CLASSROOM_CODE", "MARKET_SIGNING_SECRET"] as const;
const ROUTE_METHODS = new Map<string, readonly string[]>([
  ["/api/market/resume", ["GET"]],
  ["/api/market/snapshot", ["GET"]],
  ["/api/market/artwork", ["GET", "PUT"]],
  ["/api/market/publish", ["POST"]],
  ["/api/market/purchase", ["POST"]],
  ["/api/market/finish", ["POST"]],
  ["/api/market/review", ["POST"]],
  ["/api/market/control", ["POST"]]
]);

type MarketEnvironmentRecord = Readonly<Record<string, string | undefined>>;

interface MarketRoomDependencies {
  readonly environment?: MarketEnvironment | MarketEnvironmentRecord;
  readonly nowSeconds: () => number;
  readonly newId?: () => string;
  readonly service?: MarketRoomService;
}

const runtimeEnvironment = (): MarketEnvironmentRecord => Object.fromEntries(
  ENVIRONMENT_KEYS.map((key) => [key, Netlify.env.get(key)])
);

const configuredEnvironment = (
  dependency: MarketEnvironment | MarketEnvironmentRecord | undefined
): MarketEnvironment => {
  if (dependency && typeof (dependency as { enabled?: unknown }).enabled === "boolean") {
    return dependency as MarketEnvironment;
  }
  return parseMarketEnvironment((dependency ?? runtimeEnvironment()) as MarketEnvironmentRecord);
};

const safeText = (maximum: number) => z.string().min(1).max(maximum).refine((value) =>
  value === value.trim() && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value));

const PublishBodySchema = z.object({
  commandId: MarketIdSchema,
  productName: safeText(MARKET_LIMITS.productNameLength),
  tagline: safeText(MARKET_LIMITS.taglineLength).optional(),
  priceCents: PriceSchema,
  artworkKey: ArtworkKeySchema
}).strict();

const PurchaseBodySchema = z.object({
  campaignId: MarketIdSchema,
  requestId: MarketIdSchema
}).strict();

const FinishBodySchema = z.object({ commandId: MarketIdSchema }).strict();

const ReviewBodySchema = z.object({
  commandId: MarketIdSchema,
  campaignId: MarketIdSchema,
  submissionVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  status: z.enum(["approved", "returned", "hidden"]),
  reviewNote: safeText(MARKET_LIMITS.reviewNoteLength).optional()
}).strict();

const ControlBodySchema = z.discriminatedUnion("action", [
  z.object({ commandId: MarketIdSchema, action: z.literal("openMarket") }).strict(),
  z.object({ commandId: MarketIdSchema, action: z.literal("openReveal") }).strict(),
  z.object({ commandId: MarketIdSchema, action: z.literal("closeMarket") }).strict(),
  z.object({
    commandId: MarketIdSchema,
    action: z.literal("removeTeam"),
    teamId: MarketIdSchema
  }).strict()
]);

const parseBody = <T,>(read: () => T): T => {
  try {
    return read();
  } catch {
    throw new MarketRequestError("INVALID_REQUEST", 400);
  }
};

const hasSameOriginBrowserBoundary = (request: Request, url: URL): boolean => {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (origin === null && fetchSite === null) return false;
  if (origin !== null && origin !== url.origin) return false;
  return fetchSite === null || fetchSite === "same-origin";
};

const requireRole = <Role extends MarketSession["role"]>(
  session: MarketSession,
  role: Role
): Extract<MarketSession, { role: Role }> => {
  if (session.role !== role) throw new MarketRequestError("FORBIDDEN", 403);
  return session as Extract<MarketSession, { role: Role }>;
};

const campaignIdForTeam = (teamId: string): string => {
  const direct = `campaign-${teamId}`;
  return direct.length <= 64
    ? direct
    : `campaign-${createHash("sha256").update(teamId, "utf8").digest("hex").slice(0, 40)}`;
};

const readPng = async (request: Request): Promise<Uint8Array> => {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "image/png") throw new MarketRequestError("UNSUPPORTED_MEDIA_TYPE", 415);
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/u.test(declared) || Number(declared) > MAX_ARTWORK_BYTES)) {
    throw new MarketRequestError("REQUEST_TOO_LARGE", 413);
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_ARTWORK_BYTES) throw new MarketRequestError("REQUEST_TOO_LARGE", 413);
  try {
    validateMarketPng(bytes);
  } catch (error) {
    if (error instanceof MarketPngError) throw new MarketRequestError("INVALID_PNG", 400);
    throw error;
  }
  return bytes;
};

const readArtworkQuery = (url: URL): string => {
  const entries = [...url.searchParams.entries()];
  if (entries.length !== 1 || entries[0]![0] !== "key") {
    throw new MarketRequestError("INVALID_REQUEST", 400);
  }
  return parseBody(() => ArtworkKeySchema.parse(entries[0]![1]));
};

const safeReceipt = (receipt: {
  id: string;
  campaignId: string;
  sellerTeamId: string;
  price: number;
  purchasedAt: number;
}) => ({
  id: receipt.id,
  campaignId: receipt.campaignId,
  sellerTeamId: receipt.sellerTeamId,
  price: receipt.price,
  purchasedAt: receipt.purchasedAt
});

const commandOutcome = (
  beforeRevision: number,
  state: Awaited<ReturnType<MarketRoomService["read"]>>["state"],
  actor: string,
  commandId: string
) => {
  const receipt = state.commandReceipts[actor]?.[commandId];
  if (!receipt) throw new Error("Command transition did not commit or replay a receipt");
  return {
    replayed: state.revision === beforeRevision,
    postcondition: receipt.postcondition
  };
};

export function createMarketRoomHandler(
  dependencies: MarketRoomDependencies = {
    nowSeconds: () => Math.floor(Date.now() / 1_000)
  }
): (request: Request, context?: Context) => Promise<Response> {
  const newId = dependencies.newId ?? randomUUID;
  return async (request) => {
    const url = new URL(request.url);
    const allowed = ROUTE_METHODS.get(url.pathname);
    if (!allowed) return marketJson({ error: "NOT_FOUND" }, 404);
    if (!allowed.includes(request.method)) {
      return marketJson({ error: "METHOD_NOT_ALLOWED" }, 405, { allow: allowed.join(", ") });
    }
    const environment = configuredEnvironment(dependencies.environment);
    if (!environment.enabled) return marketJson({ error: "MARKET_NOT_CONFIGURED" }, 503);
    if (!hasSameOriginBrowserBoundary(request, url)) {
      return marketJson({ error: "FORBIDDEN" }, 403);
    }

    const now = dependencies.nowSeconds();
    try {
      const session = readMarketRequestSession(request, environment.signingSecret, now);
      if (!session) throw new MarketRequestError("AUTH_REQUIRED", 401);
      const service = dependencies.service ?? await defaultMarketRoomService();

      if (url.pathname === "/api/market/resume" || url.pathname === "/api/market/snapshot") {
        const room = await service.read(session.roomCode, now);
        const snapshot = session.role === "teacher"
          ? teacherMarketSnapshot(room.state, session.roomCode)
          : teamMarketSnapshot(room.state, session.teamId);
        return marketJson({ role: session.role, roomCode: session.roomCode, snapshot });
      }

      if (url.pathname === "/api/market/artwork" && request.method === "PUT") {
        const team = requireRole(session, "team");
        const room = await service.read(team.roomCode, now);
        if (!room.state.teams[team.teamId]) throw new MarketRequestError("AUTH_REQUIRED", 401);
        const bytes = await readPng(request);
        const artworkKey = marketArtworkKey(team.roomCode, team.teamId, bytes);
        const contentHash = createHash("sha256").update(bytes).digest("hex");
        const preflight = registerArtworkUpload(room.state, {
          expectedRevision: room.state.revision,
          teamId: team.teamId,
          contentHash,
          artworkKey,
          byteLength: bytes.byteLength,
          now
        });
        if (!preflight.registered) {
          return marketJson({ artworkKey, registered: false });
        }
        await service.storeArtwork(team.roomCode, team.teamId, bytes);
        const registered = await service.mutate(team.roomCode, now, (state) => {
          const result = registerArtworkUpload(state, {
            expectedRevision: state.revision,
            teamId: team.teamId,
            contentHash,
            artworkKey,
            byteLength: bytes.byteLength,
            now
          });
          return {
            state: result.state,
            result: { registered: result.registered }
          };
        });
        return marketJson(
          { artworkKey, registered: registered.result.registered },
          registered.result.registered ? 201 : 200
        );
      }

      if (url.pathname === "/api/market/artwork") {
        const key = readArtworkQuery(url);
        const room = await service.read(session.roomCode, now);
        if (session.role === "team" && !room.state.teams[session.teamId]) {
          throw new MarketRequestError("AUTH_REQUIRED", 401);
        }
        const linked = Object.values(room.state.campaigns).filter(({ artworkKey }) => artworkKey === key);
        const allowedArtwork = session.role === "teacher"
          ? linked.length > 0
          : linked.some((campaign) =>
            campaign.status === "approved" || campaign.sellerTeamId === session.teamId);
        if (!allowedArtwork) throw new MarketRequestError("FORBIDDEN", 403);
        const bytes = await service.readArtwork(key);
        return new Response(Uint8Array.from(bytes).buffer, {
          status: 200,
          headers: {
            "content-type": "image/png",
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff"
          }
        });
      }

      if (url.pathname === "/api/market/publish") {
        const team = requireRole(session, "team");
        const raw = await readMarketJson(request);
        const body = parseBody(() => PublishBodySchema.parse(raw));
        const prefix = marketArtworkPrefix(team.roomCode, team.teamId);
        if (!body.artworkKey.startsWith(prefix)) throw new MarketRequestError("FORBIDDEN", 403);
        const campaignId = campaignIdForTeam(team.teamId);
        const published = await service.mutate(team.roomCode, now, (state) => {
          const next = submitCampaign(state, {
            expectedRevision: state.revision,
            commandId: body.commandId,
            campaignId,
            sellerTeamId: team.teamId,
            productName: body.productName,
            ...(body.tagline === undefined ? {} : { tagline: body.tagline }),
            price: body.priceCents,
            artworkKey: body.artworkKey,
            now
          });
          return {
            state: next,
            result: commandOutcome(state.revision, next, `team:${team.teamId}`, body.commandId)
          };
        });
        if (published.result.postcondition.kind !== "publish") {
          throw new Error("Publish receipt had the wrong postcondition");
        }
        return marketJson({
          replayed: published.result.replayed,
          campaignId: published.result.postcondition.campaignId,
          submissionVersion: published.result.postcondition.submissionVersion,
          postcondition: published.result.postcondition,
          snapshot: teamMarketSnapshot(published.state, team.teamId)
        });
      }

      if (url.pathname === "/api/market/purchase") {
        const team = requireRole(session, "team");
        const raw = await readMarketJson(request);
        const body = parseBody(() => PurchaseBodySchema.parse(raw));
        const receiptId = newId();
        const purchased = await service.mutate(team.roomCode, now, (state) => {
          const result = purchaseCampaign(state, {
            expectedRevision: state.revision,
            buyerTeamId: team.teamId,
            campaignId: body.campaignId,
            requestId: body.requestId,
            receiptId,
            now
          });
          return {
            state: result.state,
            result: { receipt: result.receipt, replayed: result.replayed }
          };
        });
        return marketJson({
          replayed: purchased.result.replayed,
          receipt: safeReceipt(purchased.result.receipt),
          snapshot: teamMarketSnapshot(purchased.state, team.teamId)
        });
      }

      if (url.pathname === "/api/market/finish") {
        const team = requireRole(session, "team");
        const raw = await readMarketJson(request);
        const body = parseBody(() => FinishBodySchema.parse(raw));
        const finished = await service.mutate(team.roomCode, now, (state) => {
          const next = finishTeam(state, {
            expectedRevision: state.revision,
            commandId: body.commandId,
            teamId: team.teamId,
            now
          });
          return {
            state: next,
            result: commandOutcome(state.revision, next, `team:${team.teamId}`, body.commandId)
          };
        });
        return marketJson({
          replayed: finished.result.replayed,
          postcondition: finished.result.postcondition,
          snapshot: teamMarketSnapshot(finished.state, team.teamId)
        });
      }

      if (url.pathname === "/api/market/review") {
        requireRole(session, "teacher");
        const raw = await readMarketJson(request);
        const body = parseBody(() => ReviewBodySchema.parse(raw));
        const reviewed = await service.mutate(session.roomCode, now, (state) => {
          const next = reviewCampaign(state, {
            expectedRevision: state.revision,
            commandId: body.commandId,
            campaignId: body.campaignId,
            submissionVersion: body.submissionVersion,
            status: body.status,
            ...(body.reviewNote === undefined ? {} : { reviewNote: body.reviewNote }),
            now
          });
          return {
            state: next,
            result: commandOutcome(state.revision, next, "teacher", body.commandId)
          };
        });
        return marketJson({
          replayed: reviewed.result.replayed,
          postcondition: reviewed.result.postcondition,
          snapshot: teacherMarketSnapshot(reviewed.state, session.roomCode)
        });
      }

      requireRole(session, "teacher");
      const raw = await readMarketJson(request);
      const body = parseBody(() => ControlBodySchema.parse(raw));
      const controlled = await service.mutate(session.roomCode, now, (state) => {
        const input = { expectedRevision: state.revision, commandId: body.commandId, now };
        const next = body.action === "openMarket"
          ? openMarket(state, input)
          : body.action === "openReveal"
            ? openReveal(state, input)
            : body.action === "closeMarket"
              ? closeMarket(state, input)
              : removeTeam(state, { ...input, teamId: body.teamId });
        return {
          state: next,
          result: commandOutcome(state.revision, next, "teacher", body.commandId)
        };
      });
      return marketJson({
        replayed: controlled.result.replayed,
        postcondition: controlled.result.postcondition,
        snapshot: teacherMarketSnapshot(controlled.state, session.roomCode)
      });
    } catch (error) {
      if (error instanceof MarketAuthError) return marketJson({ error: error.code }, 401);
      return marketErrorResponse(error);
    }
  };
}

export default createMarketRoomHandler();

export const config: Config = {
  path: [
    "/api/market/resume",
    "/api/market/snapshot",
    "/api/market/artwork",
    "/api/market/publish",
    "/api/market/purchase",
    "/api/market/finish",
    "/api/market/review",
    "/api/market/control"
  ],
  rateLimit: {
    windowLimit: 1_200,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
