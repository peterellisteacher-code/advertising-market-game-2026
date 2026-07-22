import { z } from "zod";
import {
  isMarketSafeJson,
  type MarketCampaignSubmission,
  type MarketControlCommand,
  type MarketMedal,
  type MarketReviewStatus
} from "./market-client";

export const MARKET_BRIDGE_CONTRACT = "market-bridge@1" as const;

const MAX_PNG_BYTES = 4 * 1024 * 1024;
const MAX_BASE64_LENGTH = Math.ceil(MAX_PNG_BYTES / 3) * 4;
const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MARKET_PRICE_LIMIT = 1_000_000_000_000;
const MARKET_ROOM_CODE_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/u;
const MARKET_COMMAND_ID_SCHEMA = z.string().uuid();

const requestBase = {
  contract: z.literal(MARKET_BRIDGE_CONTRACT),
  requestId: z.string().min(1).max(128)
};

const MarketControlPayloadSchema = z.discriminatedUnion("action", [
  z.strictObject({
    commandId: MARKET_COMMAND_ID_SCHEMA,
    action: z.enum(["openMarket", "openReveal", "closeMarket"])
  }),
  z.strictObject({
    commandId: MARKET_COMMAND_ID_SCHEMA,
    action: z.literal("removeTeam"),
    teamId: z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u)
  })
]);

const PublishedCampaignSchema = z.strictObject({
  contract: z.literal("published-campaign@1"),
  documentId: z.string().min(1).max(256),
  revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  pngBase64: z.string().min(1).max(MAX_BASE64_LENGTH),
  metadata: z.strictObject({
    productName: z.string().trim().min(1).max(80),
    priceCents: z.number().int().min(1).max(MARKET_PRICE_LIMIT),
    brief: z.record(z.string(), z.unknown()),
    evidence: z.record(z.string(), z.unknown()),
    assetReferences: z.array(z.record(z.string(), z.unknown())).max(10_000)
  })
});

const MarketRequestSchema = z.discriminatedUnion("method", [
  z.strictObject({
    ...requestBase,
    method: z.literal("createRoom"),
    payload: z.strictObject({
      openingWallet: z.number().int().min(100).max(1_000_000),
      classroomCode: z.string().min(1).max(128),
      maxTeams: z.number().int().min(3).max(30)
    })
  }),
  z.strictObject({
    ...requestBase,
    method: z.literal("joinRoom"),
    payload: z.strictObject({
      roomCode: z.string().regex(MARKET_ROOM_CODE_PATTERN),
      alias: z.string().trim().min(2).max(32)
    })
  }),
  z.strictObject({ ...requestBase, method: z.literal("getSnapshot"), payload: z.null() }),
  z.strictObject({ ...requestBase, method: z.literal("resumeSession"), payload: z.null() }),
  z.strictObject({
    ...requestBase,
    method: z.literal("getArtwork"),
    payload: z.strictObject({
      artworkKey: z.string()
        .min(1)
        .max(256)
        .regex(/^[A-Za-z0-9][A-Za-z0-9._:/\-]*$/u)
    })
  }),
  z.strictObject({
    ...requestBase,
    method: z.literal("publishCampaign"),
    payload: z.strictObject({
      commandId: MARKET_COMMAND_ID_SCHEMA,
      publication: PublishedCampaignSchema
    })
  }),
  z.strictObject({
    ...requestBase,
    method: z.literal("award"),
    payload: z.strictObject({
      commandId: MARKET_COMMAND_ID_SCHEMA,
      campaignId: z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u),
      medal: z.enum(["gold", "silver", "bronze"])
    })
  }),
  z.strictObject({
    ...requestBase,
    method: z.literal("purchase"),
    payload: z.strictObject({
      campaignId: z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u),
      requestId: z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u)
    })
  }),
  z.strictObject({
    ...requestBase,
    method: z.literal("finish"),
    payload: z.strictObject({ commandId: MARKET_COMMAND_ID_SCHEMA })
  }),
  z.strictObject({
    ...requestBase,
    method: z.literal("reviewCampaign"),
    payload: z.strictObject({
      commandId: MARKET_COMMAND_ID_SCHEMA,
      campaignId: z.string().min(1).max(64).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u),
      submissionVersion: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
      status: z.enum(["approved", "returned", "hidden"]),
      reviewNote: z.string().trim().min(1).max(240).optional()
    })
  }),
  z.strictObject({
    ...requestBase,
    method: z.literal("control"),
    payload: MarketControlPayloadSchema
  })
]);

const MarketSnapshotEnvelopeSchema = z.strictObject({
  role: z.enum(["teacher", "team"]),
  roomCode: z.string().regex(MARKET_ROOM_CODE_PATTERN),
  snapshot: z.record(z.string(), z.unknown())
});

export interface MarketRoomClient {
  createRoom(openingWalletCents: number, classroomCode: string, maxTeams: number): Promise<unknown>;
  joinRoom(roomCode: string, alias: string): Promise<unknown>;
  resumeSession(): Promise<unknown>;
  getSnapshot(): Promise<unknown>;
  getArtwork(artworkKey: string): Promise<Uint8Array>;
  uploadArtwork(png: Uint8Array): Promise<string>;
  publishCampaign(submission: MarketCampaignSubmission, commandId: string): Promise<unknown>;
  award(campaignId: string, medal: MarketMedal, commandId: string): Promise<unknown>;
  purchase(campaignId: string, requestId: string): Promise<unknown>;
  finish(commandId: string): Promise<unknown>;
  reviewCampaign(
    campaignId: string,
    submissionVersion: number,
    status: MarketReviewStatus,
    commandId: string,
    reviewNote?: string
  ): Promise<unknown>;
  control(command: MarketControlCommand, commandId: string): Promise<unknown>;
}

export interface MarketPublicApi {
  handle(requestJson: string): Promise<string>;
}

interface MarketResponse {
  readonly contract: typeof MARKET_BRIDGE_CONTRACT;
  readonly requestId: string;
  readonly ok: boolean;
  readonly payload?: unknown;
  readonly error?: { readonly code: string; readonly message: string };
}

const requestIdFrom = (value: unknown): string => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
  const requestId = (value as Record<string, unknown>).requestId;
  return typeof requestId === "string" && requestId.length <= 128 ? requestId : "";
};

function assertJsonValue(value: unknown, path = "$", ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number`);
    return;
  }
  if (typeof value !== "object") throw new Error(`${path} contains a non-JSON value`);
  if (value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    throw new Error(`${path} contains binary data`);
  }
  if (ancestors.has(value)) throw new Error(`${path} contains a circular reference`);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      value.forEach((child, index) => assertJsonValue(child, `${path}[${index}]`, ancestors));
      return;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} contains a non-JSON object`);
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") throw new Error(`${path} contains a symbol key`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw new Error(`${path}.${key} is not a plain JSON property`);
      }
      assertJsonValue(descriptor.value, `${path}.${key}`, ancestors);
    }
  } finally {
    ancestors.delete(value);
  }
}

const serialise = (response: MarketResponse): string => {
  assertJsonValue(response);
  return JSON.stringify(response);
};

const success = (requestId: string, payload?: unknown): string => {
  if (payload !== undefined && !isMarketSafeJson(payload)) {
    throw new Error("Market response payload crossed the safe JSON boundary");
  }
  return serialise(
    payload === undefined
      ? { contract: MARKET_BRIDGE_CONTRACT, requestId, ok: true }
      : { contract: MARKET_BRIDGE_CONTRACT, requestId, ok: true, payload }
  );
};

const failure = (requestId: string, code: string, message: string): string => serialise({
  contract: MARKET_BRIDGE_CONTRACT,
  requestId,
  ok: false,
  error: { code, message }
});

const errorCode = (error: unknown): string => {
  if (typeof error === "object" && error !== null) {
    const code = (error as Record<string, unknown>).code;
    if (typeof code === "string" && /^[A-Z][A-Z0-9_]{0,127}$/u.test(code)) return code;
  }
  return "HANDLER_ERROR";
};

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message.length > 0
    ? error.message.slice(0, 240)
    : "Market operation failed";

const canonicalBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

function assertCampaignPng(bytes: Uint8Array): void {
  if (bytes.byteLength > MAX_PNG_BYTES) throw new Error("Campaign artwork is too large");
  if (bytes.byteLength < 33 || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    throw new Error("Campaign artwork is not a PNG");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = new TextDecoder("ascii", { fatal: true }).decode(bytes.subarray(12, 16));
  if (view.getUint32(8) !== 13 || type !== "IHDR" ||
    view.getUint32(16) !== 1600 || view.getUint32(20) !== 900) {
    throw new Error("Campaign artwork must be a 1600 by 900 PNG");
  }
}

function decodePublicationPng(encoded: string): Uint8Array {
  if (encoded.length > MAX_BASE64_LENGTH || encoded.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(encoded)) {
    throw new Error("Campaign artwork must be canonical base64 PNG data");
  }
  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    throw new Error("Campaign artwork must be canonical base64 PNG data");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.byteLength > MAX_PNG_BYTES || canonicalBase64(bytes) !== encoded) {
    throw new Error("Campaign artwork is too large or non-canonical");
  }
  assertCampaignPng(bytes);
  return bytes;
}

export function createMarketPublicApi(client: MarketRoomClient): MarketPublicApi {
  const handle = async (requestJson: string): Promise<string> => {
    let decoded: unknown;
    try {
      decoded = JSON.parse(requestJson) as unknown;
    } catch {
      return failure("", "INVALID_REQUEST", "Request must be valid JSON");
    }
    const requestId = requestIdFrom(decoded);
    if (typeof decoded === "object" && decoded !== null && !Array.isArray(decoded)) {
      const contract = (decoded as Record<string, unknown>).contract;
      if (typeof contract === "string" && contract !== MARKET_BRIDGE_CONTRACT) {
        return failure(requestId, "UNSUPPORTED_CONTRACT", "Unsupported market bridge contract");
      }
    }
    const parsed = MarketRequestSchema.safeParse(decoded);
    if (!parsed.success) {
      return failure(
        requestId,
        "INVALID_REQUEST",
        parsed.error.issues[0]?.message ?? "Invalid market request"
      );
    }
    try {
      const request = parsed.data;
      switch (request.method) {
        case "createRoom":
          return success(request.requestId, MarketSnapshotEnvelopeSchema.parse(
            await client.createRoom(
              request.payload.openingWallet,
              request.payload.classroomCode,
              request.payload.maxTeams
            )
          ));
        case "joinRoom":
          return success(request.requestId, MarketSnapshotEnvelopeSchema.parse(
            await client.joinRoom(
              request.payload.roomCode,
              request.payload.alias
            )
          ));
        case "resumeSession": {
          const resumed = await client.resumeSession();
          return success(
            request.requestId,
            resumed === null ? null : MarketSnapshotEnvelopeSchema.parse(resumed)
          );
        }
        case "getSnapshot": {
          const response = MarketSnapshotEnvelopeSchema.parse(await client.getSnapshot());
          return success(request.requestId, response.snapshot);
        }
        case "getArtwork": {
          const png = await client.getArtwork(request.payload.artworkKey);
          assertCampaignPng(png);
          return success(request.requestId, {
            artworkKey: request.payload.artworkKey,
            pngBase64: canonicalBase64(png)
          });
        }
        case "publishCampaign": {
          const publication = request.payload.publication;
          const png = decodePublicationPng(publication.pngBase64);
          const artworkKey = await client.uploadArtwork(png);
          return success(request.requestId, await client.publishCampaign({
            productName: publication.metadata.productName,
            priceCents: publication.metadata.priceCents,
            artworkKey
          }, request.payload.commandId));
        }
        case "purchase":
          return success(request.requestId, await client.purchase(
            request.payload.campaignId,
            request.payload.requestId
          ));
        case "award":
          return success(request.requestId, await client.award(
            request.payload.campaignId,
            request.payload.medal,
            request.payload.commandId
          ));
        case "finish":
          return success(request.requestId, await client.finish(request.payload.commandId));
        case "reviewCampaign":
          return success(request.requestId, await client.reviewCampaign(
            request.payload.campaignId,
            request.payload.submissionVersion,
            request.payload.status,
            request.payload.commandId,
            request.payload.reviewNote
          ));
        case "control":
          return success(request.requestId, await client.control(
            request.payload.action === "removeTeam"
              ? { action: request.payload.action, teamId: request.payload.teamId }
              : { action: request.payload.action },
            request.payload.commandId
          ));
      }
    } catch (error) {
      return failure(requestId, errorCode(error), errorMessage(error));
    }
  };
  return Object.freeze({ handle });
}
