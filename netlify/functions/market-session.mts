import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Config, Context } from "@netlify/functions";
import { z } from "zod";
import {
  MARKET_ROOM_CODE_PATTERN,
  createMarketSessionToken,
  deriveMarketRoomCode,
  deriveMarketSessionIntentKey,
  generateRoomCode,
  parseMarketEnvironment,
  secureMarketCodeMatches,
  serialiseMarketCookie,
  type MarketEnvironment
} from "./lib/market-auth";
import {
  AliasInputSchema,
  MARKET_LIMITS,
  MaxTeamsSchema,
  type MarketRoom
} from "./lib/market-contracts";
import {
  MarketRequestError,
  marketErrorResponse,
  marketJson,
  readMarketJson,
  teacherMarketSnapshot,
  teamMarketSnapshot
} from "./lib/market-http";
import {
  MarketStateError,
  createMarketRoom,
  joinTeam,
  joinTeamWithSessionBinding
} from "./lib/market-state";
import { defaultMarketRoomService, type MarketRoomService } from "./lib/netlify-market-room";
import { isJoinOperationIdForRoom } from "../../shared/market-operation-id";

const ROOM_TTL_SECONDS = 6 * 60 * 60;
const ROOM_CODE_ATTEMPTS = 8;
const ENVIRONMENT_KEYS = ["MARKET_CLASSROOM_CODE", "MARKET_SIGNING_SECRET"] as const;

type MarketEnvironmentRecord = Readonly<Record<string, string | undefined>>;

interface MarketSessionDependencies {
  readonly environment?: MarketEnvironment | MarketEnvironmentRecord;
  readonly nowSeconds: () => number;
  readonly secureCookies?: boolean;
  readonly roomCode?: () => string;
  readonly newId?: () => string;
  readonly service?: MarketRoomService;
  readonly serviceFactory?: () => Promise<MarketRoomService>;
}

const runtimeEnvironment = (): MarketEnvironmentRecord => Object.fromEntries(
  ENVIRONMENT_KEYS.map((key) => [key, Netlify.env.get(key)])
);

const UUIDSchema = z.string().uuid();

const requireIntentPair = (
  value: {
    readonly clientId?: string | undefined;
    readonly operationId?: string | undefined;
  },
  context: z.RefinementCtx
): void => {
  if ((value.clientId === undefined) !== (value.operationId === undefined)) {
    context.addIssue({
      code: "custom",
      path: value.clientId === undefined ? ["clientId"] : ["operationId"],
      message: "clientId and operationId must be supplied together"
    });
  }
};

const CreateBodySchema = z.object({
  classroomCode: z.string().min(1).max(128),
  openingWalletCents: z.number().int().min(100).max(1_000_000).optional(),
  maxTeams: MaxTeamsSchema.optional(),
  clientId: UUIDSchema.optional(),
  operationId: UUIDSchema.optional()
}).strict().superRefine(requireIntentPair);

const JoinBodySchema = z.object({
  roomCode: z.string().regex(MARKET_ROOM_CODE_PATTERN),
  alias: AliasInputSchema,
  clientId: UUIDSchema.optional(),
  operationId: UUIDSchema.optional()
}).strict().superRefine(requireIntentPair);

const semanticPayloadHash = (
  kind: "create" | "join",
  values: readonly (string | number)[]
): string => createHash("sha256")
  .update(`advertising-market/session-payload/v1\0${kind}`, "utf8")
  .update(`\0${values.join("\0")}`, "utf8")
  .digest("hex");

const parseBody = <T,>(read: () => T): T => {
  try {
    return read();
  } catch {
    throw new MarketRequestError("INVALID_REQUEST", 400);
  }
};

const configuredEnvironment = (
  dependency: MarketEnvironment | MarketEnvironmentRecord | undefined
): MarketEnvironment => {
  if (dependency && typeof (dependency as { enabled?: unknown }).enabled === "boolean") {
    return dependency as MarketEnvironment;
  }
  return parseMarketEnvironment((dependency ?? runtimeEnvironment()) as MarketEnvironmentRecord);
};

export function createMarketSessionHandler(
  dependencies: MarketSessionDependencies = {
    nowSeconds: () => Math.floor(Date.now() / 1_000)
  }
): (request: Request, context?: Context) => Promise<Response> {
  const roomCode = dependencies.roomCode ?? (() => generateRoomCode(randomBytes(6)));
  const newId = dependencies.newId ?? randomUUID;

  return async (request) => {
    const path = new URL(request.url).pathname;
    if (path !== "/api/market/create" && path !== "/api/market/join") {
      return marketJson({ error: "NOT_FOUND" }, 404);
    }
    if (request.method !== "POST") {
      return marketJson({ error: "METHOD_NOT_ALLOWED" }, 405, { allow: "POST" });
    }

    const environment = configuredEnvironment(dependencies.environment);
    if (!environment.enabled) return marketJson({ error: "MARKET_NOT_CONFIGURED" }, 503);
    const now = dependencies.nowSeconds();
    const secureCookies = dependencies.secureCookies ?? new URL(request.url).protocol === "https:";
    const teacherResponse = (
      state: MarketRoom,
      code: string,
      expiresAt: number,
      status: 200 | 201
    ): Response => {
      const token = createMarketSessionToken({ role: "teacher", roomCode: code, expiresAt },
        environment.signingSecret);
      return marketJson({
        role: "teacher",
        roomCode: code,
        snapshot: teacherMarketSnapshot(state, code),
        session: { scheme: "Bearer", token, expiresAt }
      }, status, {
        "set-cookie": serialiseMarketCookie(token, expiresAt - now, secureCookies)
      });
    };
    try {
      if (path === "/api/market/create") {
        const rawBody = await readMarketJson(request);
        const body = parseBody(() => CreateBodySchema.parse(rawBody));
        if (!secureMarketCodeMatches(body.classroomCode, environment.classroomCode)) {
          return marketJson({ error: "CREATE_DENIED" }, 401);
        }
        const service = dependencies.service ?? await (
          dependencies.serviceFactory ?? defaultMarketRoomService
        )();
        const openingWallet = body.openingWalletCents ?? 10_000;
        const maxTeams = body.maxTeams ?? MARKET_LIMITS.defaultTeams;
        const expiresAt = now + ROOM_TTL_SECONDS;

        if (body.clientId !== undefined && body.operationId !== undefined) {
          const intentKey = deriveMarketSessionIntentKey(
            "create",
            body.clientId,
            body.operationId
          );
          const payloadHash = semanticPayloadHash("create", [openingWallet, maxTeams]);
          for (let attempt = 0; attempt < ROOM_CODE_ATTEMPTS; attempt += 1) {
            const code = deriveMarketRoomCode(
              environment.signingSecret,
              intentKey,
              attempt
            );
            const initial = createMarketRoom({
              roomId: newId(),
              openingWallet,
              maxTeams,
              now
            });
            const state: MarketRoom = {
              ...initial,
              sessionBindings: {
                ...initial.sessionBindings,
                createdBy: { intentKey, payloadHash }
              }
            };
            if (await service.create(code, state, expiresAt)) {
              return teacherResponse(state, code, expiresAt, 201);
            }

            const existing = await service.read(code, 0);
            const binding = existing.state.sessionBindings.createdBy;
            if (binding?.intentKey !== intentKey) continue;
            if (binding.payloadHash !== payloadHash) {
              throw new MarketStateError("IDEMPOTENCY_CONFLICT");
            }
            return teacherResponse(existing.state, code, existing.expiresAt, 200);
          }
          throw new MarketRequestError("ROOM_CODE_UNAVAILABLE", 503);
        }

        for (let attempt = 0; attempt < ROOM_CODE_ATTEMPTS; attempt += 1) {
          const code = roomCode();
          if (!MARKET_ROOM_CODE_PATTERN.test(code)) {
            throw new MarketRequestError("ROOM_CODE_UNAVAILABLE", 503);
          }
          const state = createMarketRoom({
            roomId: newId(),
            openingWallet,
            maxTeams,
            now
          });
          if (!await service.create(code, state, expiresAt)) continue;
          return teacherResponse(state, code, expiresAt, 201);
        }
        throw new MarketRequestError("ROOM_CODE_UNAVAILABLE", 503);
      }

      const rawBody = await readMarketJson(request);
      const body = parseBody(() => JoinBodySchema.parse(rawBody));
      if (body.clientId !== undefined && body.operationId !== undefined &&
        !isJoinOperationIdForRoom(body.operationId, body.roomCode)) {
        throw new MarketStateError("IDEMPOTENCY_CONFLICT");
      }
      const service = dependencies.service ?? await (
        dependencies.serviceFactory ?? defaultMarketRoomService
      )();
      const room = await service.read(body.roomCode, now);
      const teamId = newId();
      const joined = body.clientId !== undefined && body.operationId !== undefined
        ? await service.mutate(body.roomCode, now, (state) => {
          const result = joinTeamWithSessionBinding(state, {
            expectedRevision: state.revision,
            teamId,
            alias: body.alias,
            intentKey: deriveMarketSessionIntentKey(
              "join",
              body.clientId!,
              body.operationId!
            ),
            payloadHash: semanticPayloadHash("join", [body.roomCode, body.alias]),
            now
          });
          return {
            state: result.state,
            result: { team: result.team, replayed: result.replayed }
          };
        })
        : await service.mutate(body.roomCode, now, (state) => {
          const next = joinTeam(state, {
            expectedRevision: state.revision,
            teamId,
            alias: body.alias,
            now
          });
          return {
            state: next,
            result: { team: next.teams[teamId]!, replayed: false }
          };
        });
      const joinedTeamId = joined.result.team.id;
      const token = createMarketSessionToken({
        role: "team",
        roomCode: body.roomCode,
        teamId: joinedTeamId,
        expiresAt: room.expiresAt
      }, environment.signingSecret);
      return marketJson({
        role: "team",
        roomCode: body.roomCode,
        snapshot: teamMarketSnapshot(joined.state, joinedTeamId),
        session: { scheme: "Bearer", token, expiresAt: room.expiresAt }
      }, joined.result.replayed ? 200 : 201, {
        "set-cookie": serialiseMarketCookie(token, room.expiresAt - now, secureCookies)
      });
    } catch (error) {
      return marketErrorResponse(error);
    }
  };
}

export default createMarketSessionHandler();

export const config: Config = {
  path: ["/api/market/create", "/api/market/join"],
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
