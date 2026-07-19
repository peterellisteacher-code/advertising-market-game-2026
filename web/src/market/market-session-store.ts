import {
  MarketTabCoordinator,
  type MarketTabCoordinationPort
} from "./market-tab-coordinator";
import {
  createJoinOperationId,
  isJoinOperationIdForRoom
} from "../../../shared/market-operation-id";

const SESSION_STORAGE_KEY = "advertising-market:tab-session@1";
const VERSION = 1;
const MAX_TOKEN_LENGTH = 4_096;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/u;
const ROOM_CODE_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/u;
const SAFE_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type MarketIntentKind = "create" | "join";

export interface MarketIntent {
  readonly kind: MarketIntentKind;
  readonly operationId: string;
  readonly fingerprint: string;
}

export interface MarketActiveSession {
  readonly scheme: "Bearer";
  readonly token: string;
  readonly role: "teacher" | "team";
  readonly roomCode: string;
  readonly expiresAt: number;
}

export interface MarketActiveIdentity {
  readonly session: MarketActiveSession;
  readonly generation: number;
}

export interface MarketSessionStoreOptions {
  readonly storage?: StoragePort | null;
  readonly nowSeconds?: () => number;
  readonly randomUUID?: () => string;
  readonly coordinator?: MarketTabCoordinationPort;
}

interface SessionEnvelopeV1 {
  readonly version: typeof VERSION;
  readonly clientId: string;
  readonly activeGeneration: number;
  readonly intent?: MarketIntent;
  readonly active?: MarketActiveSession;
}

interface StoredState {
  clientId: string;
  activeGeneration: number;
  intent?: MarketIntent;
  active?: MarketActiveSession;
}

function hasExactKeys(value: Record<string, unknown>, allowed: readonly string[], required: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.every((key) => allowed.includes(key)) && required.every((key) => keys.includes(key));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  if (Object.getPrototypeOf(value) !== Object.prototype) return null;
  return value as Record<string, unknown>;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isFingerprint(value: unknown): value is string {
  return typeof value === "string" && FINGERPRINT_PATTERN.test(value);
}

function isRoomCode(value: unknown): value is string {
  return typeof value === "string" && ROOM_CODE_PATTERN.test(value);
}

function parseIntent(value: unknown): MarketIntent | null {
  const input = asRecord(value);
  if (!input || !hasExactKeys(input, ["kind", "operationId", "fingerprint"], ["kind", "operationId", "fingerprint"]) ||
    (input.kind !== "create" && input.kind !== "join") || !isUuid(input.operationId) ||
    !isFingerprint(input.fingerprint)) return null;
  return { kind: input.kind, operationId: input.operationId, fingerprint: input.fingerprint };
}

function parseActive(value: unknown): MarketActiveSession | null {
  const input = asRecord(value);
  if (!input || !hasExactKeys(
    input,
    ["scheme", "token", "role", "roomCode", "expiresAt"],
    ["scheme", "token", "role", "roomCode", "expiresAt"]
  ) || input.scheme !== "Bearer" || typeof input.token !== "string" ||
    !SAFE_TOKEN_PATTERN.test(input.token) || input.token.length > MAX_TOKEN_LENGTH ||
    (input.role !== "teacher" && input.role !== "team") || !isRoomCode(input.roomCode) ||
    typeof input.expiresAt !== "number" || !Number.isSafeInteger(input.expiresAt) ||
    input.expiresAt <= 0 || input.expiresAt > 4_102_444_800) return null;
  return {
    scheme: "Bearer",
    token: input.token,
    role: input.role,
    roomCode: input.roomCode,
    expiresAt: input.expiresAt
  };
}

function parseEnvelope(value: unknown): StoredState | null {
  const input = asRecord(value);
  if (!input || !hasExactKeys(
    input,
    ["version", "clientId", "activeGeneration", "intent", "active"],
    ["version", "clientId"]
  ) ||
    input.version !== VERSION || !isUuid(input.clientId)) return null;
  const intent = input.intent === undefined ? null : parseIntent(input.intent);
  const active = input.active === undefined ? null : parseActive(input.active);
  const activeGeneration = input.activeGeneration === undefined
    ? active === null ? 0 : 1
    : input.activeGeneration;
  if ((input.intent !== undefined && intent === null) || (input.active !== undefined && active === null)) {
    return null;
  }
  if (typeof activeGeneration !== "number" || !Number.isSafeInteger(activeGeneration) ||
    activeGeneration < 0) return null;
  if (intent !== null && active !== null) {
    return { clientId: input.clientId, activeGeneration, intent, active };
  }
  if (intent !== null) return { clientId: input.clientId, activeGeneration, intent };
  if (active !== null) return { clientId: input.clientId, activeGeneration, active };
  return { clientId: input.clientId, activeGeneration };
}

function defaultStorage(): StoragePort | null {
  try {
    const storage = globalThis.sessionStorage;
    // Accessing an item detects browsers where the getter succeeds but access is blocked.
    storage.getItem(SESSION_STORAGE_KEY);
    return storage;
  } catch {
    return null;
  }
}

function defaultRandomUUID(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (!isUuid(uuid)) throw new Error("Secure UUID generation is unavailable");
  return uuid;
}

function cloneIntent(intent: MarketIntent): MarketIntent {
  return { kind: intent.kind, operationId: intent.operationId, fingerprint: intent.fingerprint };
}

function cloneActive(active: MarketActiveSession): MarketActiveSession {
  return {
    scheme: "Bearer",
    token: active.token,
    role: active.role,
    roomCode: active.roomCode,
    expiresAt: active.expiresAt
  };
}

export class MarketSessionStore {
  readonly #nowSeconds: () => number;
  readonly #randomUUID: () => string;
  readonly #coordinator: MarketTabCoordinationPort;
  #storage: StoragePort | null;
  #loaded = false;
  #state: StoredState | null = null;

  constructor(options: MarketSessionStoreOptions = {}) {
    this.#storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.#nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1_000));
    this.#randomUUID = options.randomUUID ?? defaultRandomUUID;
    this.#coordinator = options.coordinator ?? new MarketTabCoordinator();
  }

  ensureReady(): Promise<void> {
    return this.#coordinator.coordinate(
      this.#load().clientId,
      () => this.#rotateForCollision()
    );
  }

  close(): void {
    this.#coordinator.close();
  }

  getClientId(): string {
    return this.#load().clientId;
  }

  beginIntent(kind: "create", fingerprint: string): MarketIntent;
  beginIntent(kind: "join", fingerprint: string, roomCode: string): MarketIntent;
  beginIntent(kind: MarketIntentKind, fingerprint: string, roomCode?: string): MarketIntent {
    if ((kind !== "create" && kind !== "join") || !isFingerprint(fingerprint)) {
      throw new RangeError("Market intent must have a supported kind and canonical SHA-256 fingerprint");
    }
    const state = this.#load();
    if (state.intent?.kind === kind && state.intent.fingerprint === fingerprint &&
      (kind === "create" || (roomCode !== undefined &&
        isJoinOperationIdForRoom(state.intent.operationId, roomCode)))) {
      return cloneIntent(state.intent);
    }
    const operationId = kind === "join"
      ? createJoinOperationId(roomCode ?? "", this.#randomUUID)
      : this.#randomUUID();
    if (!isUuid(operationId)) throw new Error("Secure UUID generation returned an invalid UUID");
    state.intent = { kind, operationId, fingerprint };
    this.#persist();
    return cloneIntent(state.intent);
  }

  readIntent(): MarketIntent | null {
    const intent = this.#load().intent;
    return intent ? cloneIntent(intent) : null;
  }

  activate(active: MarketActiveSession): void {
    const validated = parseActive(active);
    if (!validated || validated.expiresAt <= this.#safeNow()) {
      throw new RangeError("Market session must be valid and unexpired");
    }
    const state = this.#load();
    state.activeGeneration += 1;
    state.active = validated;
    this.#persist();
  }

  readActive(): MarketActiveSession | null {
    const state = this.#load();
    if (!state.active) return null;
    if (state.active.expiresAt <= this.#safeNow()) {
      delete state.active;
      state.activeGeneration += 1;
      this.#persist();
      return null;
    }
    return cloneActive(state.active);
  }

  readActiveIdentity(): MarketActiveIdentity | null {
    const state = this.#load();
    if (!state.active) return null;
    if (state.active.expiresAt <= this.#safeNow()) {
      delete state.active;
      state.activeGeneration += 1;
      this.#persist();
      return null;
    }
    return { session: cloneActive(state.active), generation: state.activeGeneration };
  }

  clearIntent(operationId?: string): boolean {
    const state = this.#load();
    if (!state.intent || (operationId !== undefined && state.intent.operationId !== operationId)) return false;
    delete state.intent;
    this.#persist();
    return true;
  }

  clearActive(expected?: Partial<Pick<MarketActiveSession, "roomCode" | "role">> & {
    readonly generation?: number;
  }): boolean {
    const state = this.#load();
    if (!state.active || (expected?.roomCode !== undefined && state.active.roomCode !== expected.roomCode) ||
      (expected?.role !== undefined && state.active.role !== expected.role) ||
      (expected?.generation !== undefined && state.activeGeneration !== expected.generation)) return false;
    delete state.active;
    state.activeGeneration += 1;
    this.#persist();
    return true;
  }

  #load(): StoredState {
    if (this.#loaded) return this.#state ?? this.#newState();
    this.#loaded = true;
    if (this.#storage) {
      try {
        const raw = this.#storage.getItem(SESSION_STORAGE_KEY);
        if (raw !== null) {
          const parsed = parseEnvelope(JSON.parse(raw) as unknown);
          if (parsed) {
            this.#state = parsed;
            return parsed;
          }
          this.#removePersisted();
        }
      } catch {
        this.#storage = null;
      }
    }
    return this.#newState();
  }

  #newState(): StoredState {
    if (this.#state) return this.#state;
    const clientId = this.#randomUUID();
    if (!isUuid(clientId)) throw new Error("Secure UUID generation returned an invalid UUID");
    this.#state = { clientId, activeGeneration: 0 };
    this.#persist();
    return this.#state;
  }

  #rotateForCollision(): string {
    const previous = this.#load().clientId;
    const clientId = this.#randomUUID();
    if (!isUuid(clientId) || clientId === previous) {
      throw new Error("Secure UUID generation returned an invalid collision identity");
    }
    this.#state = { clientId, activeGeneration: this.#load().activeGeneration + 1 };
    this.#persist();
    return clientId;
  }

  #persist(): void {
    const state = this.#state;
    if (!state || !this.#storage) return;
    const { clientId, activeGeneration, intent, active } = state;
    const envelope: SessionEnvelopeV1 = intent && active
      ? { version: VERSION, clientId, activeGeneration, intent, active }
      : intent
        ? { version: VERSION, clientId, activeGeneration, intent }
        : active
          ? { version: VERSION, clientId, activeGeneration, active }
          : { version: VERSION, clientId, activeGeneration };
    try {
      this.#storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(envelope));
    } catch {
      this.#storage = null;
    }
  }

  #removePersisted(): void {
    if (!this.#storage) return;
    try {
      this.#storage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      this.#storage = null;
    }
  }

  #safeNow(): number {
    const now = this.#nowSeconds();
    return Number.isFinite(now) ? now : Number.MAX_SAFE_INTEGER;
  }
}
