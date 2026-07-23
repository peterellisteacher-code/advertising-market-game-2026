import { createHash } from "node:crypto";
import {
  parseStudioCoachResponse,
  type StudioCoachMode,
  type StudioCoachResponse,
  type StudioCoachTurnOneResponse
} from "../../../shared/studio-coach-contract";

const MAX_CAS_ATTEMPTS = 12;
export const STUDIO_COACH_RESERVATION_TTL_SECONDS = 30;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

export type StudioCoachAttemptState = "reserved" | "complete" | "failed";

export interface StudioCoachStoredAttempt {
  id: string;
  requestHash: string;
  turn: 1 | 2;
  mode: StudioCoachMode;
  currentImageHash: string;
  previousImageHash?: string;
  state: StudioCoachAttemptState;
  createdAt: number;
  response?: StudioCoachResponse;
  failureCode?: "UPSTREAM_FAILED";
}

export interface StudioCoachCampaignState {
  version: 1;
  documentId: string;
  attempts: Readonly<Record<string, StudioCoachStoredAttempt>>;
  attemptOrder: readonly string[];
  firstImageHash?: string;
}

export interface StudioCoachStateEntry {
  value: unknown;
  etag: string;
}

export interface StudioCoachStateRepository {
  read(key: string): Promise<StudioCoachStateEntry | null>;
  write(
    key: string,
    value: StudioCoachCampaignState,
    condition: { onlyIfNew: true } | { onlyIfMatch: string }
  ): Promise<boolean>;
}

export interface StudioCoachPairIdentity {
  sessionId: string;
  teamId: string;
}

export interface StudioCoachReservationInput {
  idempotencyKey: string;
  requestHash: string;
  turn: 1 | 2;
  mode: StudioCoachMode;
  currentImageHash: string;
  previousImageHash?: string;
  nowSeconds: number;
}

export interface StudioCoachReservation {
  created: boolean;
  attempt: StudioCoachStoredAttempt;
  firstResponse?: StudioCoachTurnOneResponse;
}

export type StudioCoachStateErrorCode =
  | "STATE_UNAVAILABLE"
  | "IDEMPOTENCY_CONFLICT"
  | "CHECK_IN_PROGRESS"
  | "TURN_LIMIT_REACHED"
  | "INVALID_TURN"
  | "REVISION_MISMATCH"
  | "REVISION_UNCHANGED"
  | "ATTEMPT_NOT_FOUND";

export class StudioCoachStateError extends Error {
  constructor(readonly code: StudioCoachStateErrorCode) {
    super(code);
    this.name = "StudioCoachStateError";
  }
}

function pairKey(identity: StudioCoachPairIdentity): string {
  const digest = createHash("sha256")
    .update(identity.sessionId, "utf8")
    .update("\0")
    .update(identity.teamId, "utf8")
    .digest("hex");
  return `pair/${digest}`;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 128 &&
    /^[A-Za-z0-9._:-]+$/.test(value);
}

function validAttempt(value: unknown): value is StudioCoachStoredAttempt {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (!validId(input.id) || typeof input.requestHash !== "string" || !HASH_PATTERN.test(input.requestHash) ||
    (input.turn !== 1 && input.turn !== 2) ||
    (input.mode !== "technique" && input.mode !== "whole-ad" && input.mode !== "revision") ||
    typeof input.currentImageHash !== "string" || !HASH_PATTERN.test(input.currentImageHash) ||
    !Number.isSafeInteger(input.createdAt) || (input.createdAt as number) <= 0 ||
    (input.state !== "reserved" && input.state !== "complete" && input.state !== "failed")) return false;
  if (input.previousImageHash !== undefined &&
    (typeof input.previousImageHash !== "string" || !HASH_PATTERN.test(input.previousImageHash))) return false;
  if (input.turn === 1 && input.mode === "revision") return false;
  if (input.turn === 2 && (input.mode !== "revision" || input.previousImageHash === undefined)) return false;
  try {
    if (input.state === "complete") {
      const response = parseStudioCoachResponse(input.response);
      if (response.turn !== input.turn || response.mode !== input.mode) return false;
    } else if (input.response !== undefined) return false;
  } catch {
    return false;
  }
  if (input.state === "failed") {
    if (input.failureCode !== "UPSTREAM_FAILED") return false;
  } else if (input.failureCode !== undefined) return false;
  const expected = ["createdAt", "currentImageHash", "id", "mode", "requestHash", "state", "turn"];
  if (input.previousImageHash !== undefined) expected.push("previousImageHash");
  if (input.response !== undefined) expected.push("response");
  if (input.failureCode !== undefined) expected.push("failureCode");
  return Object.keys(input).sort().join("\0") === expected.sort().join("\0");
}

function parseState(value: unknown): StudioCoachCampaignState {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new StudioCoachStateError("STATE_UNAVAILABLE");
  }
  const input = value as Record<string, unknown>;
  if (input.version !== 1 || !validId(input.documentId) ||
    input.attempts === null || typeof input.attempts !== "object" ||
    Array.isArray(input.attempts) || !Array.isArray(input.attemptOrder) || input.attemptOrder.length > 2 ||
    input.attemptOrder.some((id) => !validId(id)) || new Set(input.attemptOrder).size !== input.attemptOrder.length ||
    input.firstImageHash !== undefined &&
      (typeof input.firstImageHash !== "string" || !HASH_PATTERN.test(input.firstImageHash))) {
    throw new StudioCoachStateError("STATE_UNAVAILABLE");
  }
  const entries = Object.entries(input.attempts as Record<string, unknown>);
  if (entries.length !== input.attemptOrder.length || entries.length > 2 ||
    entries.some(([id, attempt]) => !validId(id) || !validAttempt(attempt) || attempt.id !== id) ||
    input.attemptOrder.some((id) => !Object.hasOwn(input.attempts as object, id))) {
    throw new StudioCoachStateError("STATE_UNAVAILABLE");
  }
  const successfulFirst = entries
    .map(([, attempt]) => attempt as StudioCoachStoredAttempt)
    .find((attempt) => attempt.state === "complete" && attempt.turn === 1);
  if ((successfulFirst?.currentImageHash ?? undefined) !== input.firstImageHash) {
    throw new StudioCoachStateError("STATE_UNAVAILABLE");
  }
  return {
    version: 1,
    documentId: input.documentId,
    attempts: Object.fromEntries(entries) as Record<string, StudioCoachStoredAttempt>,
    attemptOrder: [...input.attemptOrder] as string[],
    ...(input.firstImageHash === undefined ? {} : { firstImageHash: input.firstImageHash })
  };
}

function newAttempt(input: StudioCoachReservationInput): StudioCoachStoredAttempt {
  return {
    id: input.idempotencyKey,
    requestHash: input.requestHash,
    turn: input.turn,
    mode: input.mode,
    currentImageHash: input.currentImageHash,
    ...(input.previousImageHash === undefined ? {} : { previousImageHash: input.previousImageHash }),
    state: "reserved",
    createdAt: input.nowSeconds
  };
}

export class StudioCoachStateService {
  constructor(private readonly repository: StudioCoachStateRepository) {}

  async reserve(
    identity: StudioCoachPairIdentity,
    documentId: string,
    input: StudioCoachReservationInput
  ): Promise<StudioCoachReservation> {
    const key = pairKey(identity);
    for (let index = 0; index < MAX_CAS_ATTEMPTS; index += 1) {
      const entry = await this.repository.read(key);
      const current = entry === null
        ? { version: 1 as const, documentId, attempts: {}, attemptOrder: [] as string[] }
        : parseState(entry.value);
      if (current.documentId !== documentId) {
        if (current.attemptOrder.length >= 2) throw new StudioCoachStateError("TURN_LIMIT_REACHED");
        throw new StudioCoachStateError("INVALID_TURN");
      }
      const staleIds = Object.values(current.attempts)
        .filter((attempt) => attempt.state === "failed" ||
          attempt.state === "reserved" &&
            input.nowSeconds - attempt.createdAt >= STUDIO_COACH_RESERVATION_TTL_SECONDS)
        .map(({ id }) => id);
      if (staleIds.length > 0) {
        if (entry === null) throw new StudioCoachStateError("STATE_UNAVAILABLE");
        const stale = new Set(staleIds);
        const attempts = Object.fromEntries(
          Object.entries(current.attempts).filter(([id]) => !stale.has(id))
        );
        const attemptOrder = current.attemptOrder.filter((id) => !stale.has(id));
        if (await this.repository.write(
          key,
          { ...current, attempts, attemptOrder },
          { onlyIfMatch: entry.etag }
        )) continue;
        continue;
      }
      const firstResponse = Object.values(current.attempts)
        .map(({ response }) => response)
        .find((response): response is StudioCoachTurnOneResponse => response?.turn === 1);
      const existing = current.attempts[input.idempotencyKey];
      if (existing) {
        if (existing.requestHash !== input.requestHash || existing.turn !== input.turn ||
          existing.mode !== input.mode || existing.currentImageHash !== input.currentImageHash ||
          existing.previousImageHash !== input.previousImageHash) {
          throw new StudioCoachStateError("IDEMPOTENCY_CONFLICT");
        }
        return {
          created: false,
          attempt: existing,
          ...(firstResponse === undefined ? {} : { firstResponse })
        };
      }
      if (Object.values(current.attempts).some((attempt) => attempt.state === "reserved")) {
        throw new StudioCoachStateError("CHECK_IN_PROGRESS");
      }
      if (current.attemptOrder.length >= 2) throw new StudioCoachStateError("TURN_LIMIT_REACHED");
      if (current.firstImageHash === undefined) {
        if (input.turn !== 1 || input.mode === "revision" || input.previousImageHash !== undefined) {
          throw new StudioCoachStateError("INVALID_TURN");
        }
      } else {
        if (input.turn !== 2 || input.mode !== "revision" || input.previousImageHash === undefined) {
          throw new StudioCoachStateError("INVALID_TURN");
        }
        if (input.previousImageHash !== current.firstImageHash) {
          throw new StudioCoachStateError("REVISION_MISMATCH");
        }
        if (input.currentImageHash === current.firstImageHash) {
          throw new StudioCoachStateError("REVISION_UNCHANGED");
        }
      }
      const attempt = newAttempt(input);
      const next: StudioCoachCampaignState = {
        ...current,
        attempts: { ...current.attempts, [attempt.id]: attempt },
        attemptOrder: [...current.attemptOrder, attempt.id]
      };
      const written = await this.repository.write(
        key,
        next,
        entry === null ? { onlyIfNew: true } : { onlyIfMatch: entry.etag }
      );
      if (written) {
        return {
          created: true,
          attempt,
          ...(firstResponse === undefined ? {} : { firstResponse })
        };
      }
    }
    throw new StudioCoachStateError("STATE_UNAVAILABLE");
  }

  async complete(
    identity: StudioCoachPairIdentity,
    documentId: string,
    attemptId: string,
    responseValue: StudioCoachResponse
  ): Promise<StudioCoachStoredAttempt> {
    const response = parseStudioCoachResponse(responseValue);
    return this.#update(identity, documentId, attemptId, (attempt, current) => {
      if (attempt.state === "complete") return { attempt, state: current };
      if (attempt.state !== "reserved" || response.turn !== attempt.turn || response.mode !== attempt.mode) {
        throw new StudioCoachStateError("IDEMPOTENCY_CONFLICT");
      }
      const completed: StudioCoachStoredAttempt = { ...attempt, state: "complete", response };
      const state: StudioCoachCampaignState = {
        ...current,
        attempts: { ...current.attempts, [attemptId]: completed },
        ...(response.turn === 1 ? { firstImageHash: attempt.currentImageHash } : {})
      };
      return { attempt: completed, state };
    });
  }

  async fail(
    identity: StudioCoachPairIdentity,
    documentId: string,
    attemptId: string,
    failureCode: "UPSTREAM_FAILED"
  ): Promise<StudioCoachStoredAttempt> {
    return this.#update(identity, documentId, attemptId, (attempt, current) => {
      if (attempt.state !== "reserved") throw new StudioCoachStateError("IDEMPOTENCY_CONFLICT");
      const failed: StudioCoachStoredAttempt = { ...attempt, state: "failed", failureCode };
      const attempts = { ...current.attempts };
      delete attempts[attemptId];
      return {
        attempt: failed,
        state: {
          ...current,
          attempts,
          attemptOrder: current.attemptOrder.filter((id) => id !== attemptId)
        }
      };
    });
  }

  async #update(
    identity: StudioCoachPairIdentity,
    documentId: string,
    attemptId: string,
    update: (
      attempt: StudioCoachStoredAttempt,
      current: StudioCoachCampaignState
    ) => { attempt: StudioCoachStoredAttempt; state: StudioCoachCampaignState }
  ): Promise<StudioCoachStoredAttempt> {
    const key = pairKey(identity);
    for (let index = 0; index < MAX_CAS_ATTEMPTS; index += 1) {
      const entry = await this.repository.read(key);
      if (entry === null) throw new StudioCoachStateError("ATTEMPT_NOT_FOUND");
      const current = parseState(entry.value);
      if (current.documentId !== documentId) throw new StudioCoachStateError("ATTEMPT_NOT_FOUND");
      const attempt = current.attempts[attemptId];
      if (!attempt) throw new StudioCoachStateError("ATTEMPT_NOT_FOUND");
      const next = update(attempt, current);
      if (next.state === current) return next.attempt;
      if (await this.repository.write(key, next.state, { onlyIfMatch: entry.etag })) return next.attempt;
    }
    throw new StudioCoachStateError("STATE_UNAVAILABLE");
  }
}

export class MemoryStudioCoachStateRepository implements StudioCoachStateRepository {
  readonly #values = new Map<string, { value: StudioCoachCampaignState; etag: number }>();

  async read(key: string): Promise<StudioCoachStateEntry | null> {
    const entry = this.#values.get(key);
    return entry ? { value: structuredClone(entry.value), etag: String(entry.etag) } : null;
  }

  async write(
    key: string,
    value: StudioCoachCampaignState,
    condition: { onlyIfNew: true } | { onlyIfMatch: string }
  ): Promise<boolean> {
    const existing = this.#values.get(key);
    if ("onlyIfNew" in condition) {
      if (existing) return false;
    } else if (!existing || String(existing.etag) !== condition.onlyIfMatch) {
      return false;
    }
    this.#values.set(key, { value: structuredClone(value), etag: (existing?.etag ?? 0) + 1 });
    return true;
  }
}
