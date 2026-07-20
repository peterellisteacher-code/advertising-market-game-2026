import { getStore } from "@netlify/blobs";
import { createHash } from "node:crypto";
import {
  MARKET_LIMITS,
  MarketRoomSchema,
  normalizeMarketRoom,
  type MarketRoom
} from "./market-contracts";

const STORE_NAME = "advertising-market-live-rooms";
const MAX_CAS_ATTEMPTS = 12;

export interface MarketRoomEnvelope {
  readonly version: 1;
  readonly expiresAt: number;
  readonly state: MarketRoom;
}

export interface MarketRoomRepository {
  read(roomCode: string): Promise<{ value: unknown; etag: string } | null>;
  create(roomCode: string, value: MarketRoomEnvelope): Promise<boolean>;
  compareAndSwap(roomCode: string, value: MarketRoomEnvelope, etag: string): Promise<boolean>;
  putArtwork(key: string, bytes: Uint8Array): Promise<boolean>;
  getArtwork(key: string): Promise<Uint8Array | null>;
}

interface BlobWriteResult {
  modified: boolean;
}

interface MarketBlobStore {
  getWithMetadata(
    key: string,
    options: { type: "json" | "arrayBuffer" }
  ): Promise<{ data: unknown; etag?: string } | null>;
  setJSON(
    key: string,
    value: MarketRoomEnvelope,
    options: { onlyIfNew: true } | { onlyIfMatch: string }
  ): Promise<BlobWriteResult>;
  set(
    key: string,
    bytes: Uint8Array,
    options: { onlyIfNew: true; metadata: { contentType: "image/png" } }
  ): Promise<BlobWriteResult>;
}

const sha256 = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

export const marketStateKey = (roomCode: string): string =>
  `rooms/${sha256(roomCode)}/state`;

export const marketArtworkPrefix = (roomCode: string, teamId: string): string =>
  `rooms/${sha256(roomCode)}/artwork/${sha256(teamId)}/`;

export const marketArtworkKey = (
  roomCode: string,
  teamId: string,
  bytes: Uint8Array
): string => `${marketArtworkPrefix(roomCode, teamId)}${sha256(bytes)}.png`;

export function createNetlifyMarketRoomRepository(store: MarketBlobStore): MarketRoomRepository {
  return {
    async read(roomCode) {
      const entry = await store.getWithMetadata(marketStateKey(roomCode), { type: "json" });
      if (entry === null) return null;
      if (!entry.etag) throw new Error("Market room state entry had no ETag");
      return { value: entry.data, etag: entry.etag };
    },
    async create(roomCode, value) {
      const result = await store.setJSON(marketStateKey(roomCode), value, { onlyIfNew: true });
      return result.modified;
    },
    async compareAndSwap(roomCode, value, etag) {
      const result = await store.setJSON(marketStateKey(roomCode), value, { onlyIfMatch: etag });
      return result.modified;
    },
    async putArtwork(key, bytes) {
      const result = await store.set(key, bytes, {
        onlyIfNew: true,
        metadata: { contentType: "image/png" }
      });
      return result.modified;
    },
    async getArtwork(key) {
      const entry = await store.getWithMetadata(key, { type: "arrayBuffer" });
      if (entry === null) return null;
      if (entry.data instanceof Uint8Array) return entry.data.slice();
      if (entry.data instanceof ArrayBuffer) return new Uint8Array(entry.data.slice(0));
      throw new Error("Market artwork entry was not binary");
    }
  };
}

export type MarketRoomServiceErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_EXPIRED"
  | "STATE_UNAVAILABLE"
  | "ARTWORK_NOT_FOUND";

export class MarketRoomServiceError extends Error {
  constructor(readonly code: MarketRoomServiceErrorCode) {
    super(code);
    this.name = "MarketRoomServiceError";
  }
}

const ownRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const parseEnvelope = (value: unknown): MarketRoomEnvelope => {
  const record = ownRecord(value);
  if (!record || Object.keys(record).sort().join("\0") !== ["expiresAt", "state", "version"].join("\0") ||
    record.version !== 1 || !Number.isSafeInteger(record.expiresAt) ||
    (record.expiresAt as number) < 1 || (record.expiresAt as number) > MARKET_LIMITS.latestTimestamp) {
    throw new MarketRoomServiceError("STATE_UNAVAILABLE");
  }
  const state = normalizeMarketRoom(record.state);
  if (state === null) throw new MarketRoomServiceError("STATE_UNAVAILABLE");
  return { version: 1, expiresAt: record.expiresAt as number, state };
};

const validateExpiry = (expiresAt: number): void => {
  if (!Number.isSafeInteger(expiresAt) || expiresAt < 1 || expiresAt > MARKET_LIMITS.latestTimestamp) {
    throw new MarketRoomServiceError("STATE_UNAVAILABLE");
  }
};

const sameState = (left: MarketRoom, right: MarketRoom): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export interface MarketMutation<T> {
  readonly state: MarketRoom;
  readonly result: T;
}

export class MarketRoomService {
  constructor(private readonly repository: MarketRoomRepository) {}

  async create(roomCode: string, stateValue: MarketRoom, expiresAt: number): Promise<boolean> {
    validateExpiry(expiresAt);
    const parsed = MarketRoomSchema.safeParse(stateValue);
    if (!parsed.success) throw new MarketRoomServiceError("STATE_UNAVAILABLE");
    return this.repository.create(roomCode, { version: 1, expiresAt, state: parsed.data });
  }

  async read(roomCode: string, now: number): Promise<{ state: MarketRoom; expiresAt: number }> {
    const entry = await this.repository.read(roomCode);
    if (entry === null) throw new MarketRoomServiceError("ROOM_NOT_FOUND");
    const envelope = parseEnvelope(entry.value);
    if (envelope.expiresAt <= now) throw new MarketRoomServiceError("ROOM_EXPIRED");
    return { state: envelope.state, expiresAt: envelope.expiresAt };
  }

  async mutate<T>(
    roomCode: string,
    now: number,
    transition: (state: MarketRoom) => MarketMutation<T>
  ): Promise<MarketMutation<T>> {
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const entry = await this.repository.read(roomCode);
      if (entry === null) throw new MarketRoomServiceError("ROOM_NOT_FOUND");
      const envelope = parseEnvelope(entry.value);
      if (envelope.expiresAt <= now) throw new MarketRoomServiceError("ROOM_EXPIRED");
      const output = transition(envelope.state);
      const parsed = MarketRoomSchema.safeParse(output.state);
      if (!parsed.success) throw new MarketRoomServiceError("STATE_UNAVAILABLE");

      if (parsed.data.revision === envelope.state.revision) {
        if (!sameState(parsed.data, envelope.state)) {
          throw new MarketRoomServiceError("STATE_UNAVAILABLE");
        }
        return { state: envelope.state, result: output.result };
      }
      if (parsed.data.revision !== envelope.state.revision + 1) {
        throw new MarketRoomServiceError("STATE_UNAVAILABLE");
      }
      const next = { version: 1 as const, expiresAt: envelope.expiresAt, state: parsed.data };
      if (await this.repository.compareAndSwap(roomCode, next, entry.etag)) {
        return { state: parsed.data, result: output.result };
      }
    }
    throw new MarketRoomServiceError("STATE_UNAVAILABLE");
  }

  async storeArtwork(roomCode: string, teamId: string, bytes: Uint8Array): Promise<string> {
    const key = marketArtworkKey(roomCode, teamId, bytes);
    await this.repository.putArtwork(key, bytes);
    return key;
  }

  async readArtwork(key: string): Promise<Uint8Array> {
    const bytes = await this.repository.getArtwork(key);
    if (bytes === null) throw new MarketRoomServiceError("ARTWORK_NOT_FOUND");
    return bytes;
  }
}

let sharedService: Promise<MarketRoomService> | null = null;

export function defaultMarketRoomService(): Promise<MarketRoomService> {
  sharedService ??= Promise.resolve().then(() => {
    const store = getStore({ name: STORE_NAME, consistency: "strong" }) as MarketBlobStore;
    return new MarketRoomService(createNetlifyMarketRoomRepository(store));
  });
  return sharedService;
}
