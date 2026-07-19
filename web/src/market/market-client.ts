import {
  MarketSessionStore,
  type MarketActiveIdentity,
  type MarketActiveSession,
  type MarketIntentKind
} from "./market-session-store";
import { MarketTabCoordinationError } from "./market-tab-coordinator";

const JSON_LIMIT = 1024 * 1024;
const PNG_LIMIT = 4 * 1024 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const PNG_SIGNATURE = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ROOM_CODE_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/u;
const SAFE_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const MAX_TOKEN_LENGTH = 4_096;
const MAX_EXPIRY_SECONDS = 4_102_444_800;
const MAX_SAFE_JSON_DEPTH = 32;
const MAX_SAFE_JSON_NODES = 10_000;
const SENSITIVE_JSON_KEY = /(?:session|token|authorization|cookie)/iu;
const TERMINAL_RESUME_ERRORS = new Set([
  "AUTH_REQUIRED",
  "INVALID_SESSION",
  "SESSION_EXPIRED",
  "ROOM_NOT_FOUND",
  "ROOM_EXPIRED"
]);

type FetchPort = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type MarketReviewStatus = "approved" | "returned" | "hidden";
export type MarketControlAction = "openMarket" | "openReveal" | "closeMarket";
export type MarketControlCommand =
  | { readonly action: MarketControlAction }
  | { readonly action: "removeTeam"; readonly teamId: string };

export interface MarketCampaignSubmission {
  readonly productName: string;
  readonly tagline?: string;
  readonly priceCents: number;
  readonly artworkKey: string;
}

export interface MarketClientOptions {
  readonly requestTimeoutMs?: number;
  readonly sessionStore?: MarketSessionStore;
  readonly fingerprint?: (canonicalJson: string) => Promise<string>;
}

export interface MarketSafeSessionEnvelope {
  readonly role: "teacher" | "team";
  readonly roomCode: string;
  readonly snapshot: Record<string, unknown>;
}

export class MarketClientError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = "MarketClientError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

export const isMarketSafeJson = (
  value: unknown,
  forbiddenSecrets: readonly string[] = []
): boolean => {
  const secrets = new Set(forbiddenSecrets.filter((secret) => secret.length > 0));
  const seen = new WeakSet<object>();
  const pending: Array<{ readonly value: unknown; readonly depth: number }> = [
    { value, depth: 0 }
  ];
  let visited = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || current.depth > MAX_SAFE_JSON_DEPTH || ++visited > MAX_SAFE_JSON_NODES) {
      return false;
    }
    const item = current.value;
    if (item === null || typeof item === "boolean") continue;
    if (typeof item === "string") {
      if (secrets.has(item)) return false;
      continue;
    }
    if (typeof item === "number") {
      if (!Number.isFinite(item)) return false;
      continue;
    }
    if (typeof item !== "object" || seen.has(item)) return false;
    seen.add(item);
    if (Array.isArray(item)) {
      for (const child of item) pending.push({ value: child, depth: current.depth + 1 });
      continue;
    }
    if (!isRecord(item)) return false;
    for (const [key, child] of Object.entries(item)) {
      if (SENSITIVE_JSON_KEY.test(key)) return false;
      pending.push({ value: child, depth: current.depth + 1 });
    }
  }
  return true;
};

const hasExactKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[]
): boolean => {
  const keys = Object.keys(value);
  return keys.length === allowed.length && keys.every((key) => allowed.includes(key));
};

const defaultFingerprint = async (canonicalJson: string): Promise<string> => {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("SHA-256 is unavailable");
  const digest = new Uint8Array(await subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson)
  ));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const isSameActiveIdentity = (
  first: MarketActiveIdentity | null,
  second: MarketActiveIdentity
): boolean => first !== null && first.generation === second.generation &&
  first.session.scheme === second.session.scheme && first.session.token === second.session.token &&
  first.session.role === second.session.role && first.session.roomCode === second.session.roomCode &&
  first.session.expiresAt === second.session.expiresAt;

const declaredLength = (response: Response): number | null => {
  const raw = response.headers.get("content-length");
  if (raw === null) return null;
  if (!/^\d+$/u.test(raw)) throw new MarketClientError("INVALID_RESPONSE", response.status);
  return Number(raw);
};

const readBoundedBytes = async (response: Response, limit: number): Promise<Uint8Array> => {
  const length = declaredLength(response);
  if (length !== null && length > limit) {
    try { await response.body?.cancel(); } catch { /* The size error remains authoritative. */ }
    throw new MarketClientError("RESPONSE_TOO_LARGE", response.status);
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        try { await reader.cancel(); } catch { /* The size error remains authoritative. */ }
        throw new MarketClientError("RESPONSE_TOO_LARGE", response.status);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};

const hasPngSignature = (value: Uint8Array): boolean =>
  value.byteLength >= PNG_SIGNATURE.byteLength &&
  PNG_SIGNATURE.every((byte, index) => value[index] === byte);

interface InternalSessionEnvelope extends MarketSafeSessionEnvelope {
  readonly session: Pick<MarketActiveSession, "scheme" | "token" | "expiresAt">;
}

const parseSafeEnvelope = (
  value: unknown,
  forbiddenSecrets: readonly string[] = []
): MarketSafeSessionEnvelope | null => {
  if (!isRecord(value) || !hasExactKeys(value, ["role", "roomCode", "snapshot"]) ||
    (value.role !== "teacher" && value.role !== "team") ||
    typeof value.roomCode !== "string" || !ROOM_CODE_PATTERN.test(value.roomCode) ||
    !isRecord(value.snapshot) || !isMarketSafeJson(value.snapshot, forbiddenSecrets)) return null;
  return { role: value.role, roomCode: value.roomCode, snapshot: value.snapshot };
};

const parseInternalSessionEnvelope = (value: unknown): InternalSessionEnvelope | null => {
  if (!isRecord(value) || !hasExactKeys(value, ["role", "roomCode", "snapshot", "session"]) ||
    !isRecord(value.session) ||
    !hasExactKeys(value.session, ["scheme", "token", "expiresAt"]) ||
    value.session.scheme !== "Bearer" || typeof value.session.token !== "string" ||
    !SAFE_TOKEN_PATTERN.test(value.session.token) || value.session.token.length > MAX_TOKEN_LENGTH ||
    typeof value.session.expiresAt !== "number" || !Number.isSafeInteger(value.session.expiresAt) ||
    value.session.expiresAt <= 0 || value.session.expiresAt > MAX_EXPIRY_SECONDS) return null;
  const safe = parseSafeEnvelope({
    role: value.role,
    roomCode: value.roomCode,
    snapshot: value.snapshot
  }, [value.session.token, `Bearer ${value.session.token}`]);
  if (!safe) return null;
  return {
    ...safe,
    session: {
      scheme: "Bearer",
      token: value.session.token,
      expiresAt: value.session.expiresAt
    }
  };
};

export class MarketClient {
  readonly #requestTimeoutMs: number;
  readonly #sessionStore: MarketSessionStore;
  readonly #fingerprint: (canonicalJson: string) => Promise<string>;

  constructor(
    private readonly fetcher: FetchPort = globalThis.fetch.bind(globalThis),
    options: MarketClientOptions = {}
  ) {
    const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
      throw new RangeError("requestTimeoutMs must be a positive finite number");
    }
    this.#requestTimeoutMs = requestTimeoutMs;
    this.#sessionStore = options.sessionStore ?? new MarketSessionStore();
    this.#fingerprint = options.fingerprint ?? defaultFingerprint;
  }

  createRoom(
    openingWalletCents: number,
    classroomCode: string,
    maxTeams = 15
  ): Promise<MarketSafeSessionEnvelope> {
    return this.#establishSession("create", "/api/market/create", {
      classroomCode,
      openingWalletCents,
      maxTeams
    });
  }

  joinRoom(roomCode: string, alias: string): Promise<MarketSafeSessionEnvelope> {
    return this.#establishSession("join", "/api/market/join", { roomCode, alias });
  }

  async resumeSession(): Promise<MarketSafeSessionEnvelope | null> {
    await this.#ensureReady();
    const activeIdentity = this.#sessionStore.readActiveIdentity();
    if (!activeIdentity) return null;
    const active = activeIdentity.session;
    let payload: unknown;
    try {
      payload = await this.#json("/api/market/resume", "GET", undefined, active);
    } catch (error) {
      if (error instanceof MarketClientError && TERMINAL_RESUME_ERRORS.has(error.code)) {
        this.#sessionStore.clearActive({
          roomCode: active.roomCode,
          role: active.role,
          generation: activeIdentity.generation
        });
        return null;
      }
      throw error;
    }
    const safe = parseSafeEnvelope(payload, [active.token, `${active.scheme} ${active.token}`]);
    if (!safe || safe.role !== active.role || safe.roomCode !== active.roomCode) {
      throw new MarketClientError("INVALID_RESPONSE", 200);
    }
    if (!isSameActiveIdentity(this.#sessionStore.readActiveIdentity(), activeIdentity)) {
      throw new MarketClientError("STALE_OPERATION", 0);
    }
    return safe;
  }

  getSnapshot(): Promise<unknown> {
    return this.#protectedJson("/api/market/snapshot", "GET");
  }

  async uploadArtwork(png: Uint8Array): Promise<string> {
    await this.#ensureReady();
    const active = this.#requireActive();
    if (!hasPngSignature(png) || png.byteLength > PNG_LIMIT) {
      throw new MarketClientError("INVALID_ARTWORK", 0);
    }
    return this.#request("/api/market/artwork", {
      method: "PUT",
      credentials: "same-origin",
      redirect: "error",
      headers: {
        "content-type": "image/png",
        authorization: `${active.scheme} ${active.token}`
      },
      body: png as unknown as BodyInit
    }, async (response) => {
      const payload = await this.#readJson(response);
      if (!response.ok) throw this.#serverError(response, payload);
      if (!isMarketSafeJson(payload, [active.token, `${active.scheme} ${active.token}`]) ||
        !isRecord(payload) || typeof payload.artworkKey !== "string" ||
        typeof payload.registered !== "boolean" ||
        payload.artworkKey.length < 1 || payload.artworkKey.length > 256) {
        throw new MarketClientError("INVALID_RESPONSE", response.status);
      }
      return payload.artworkKey;
    });
  }

  async getArtwork(artworkKey: string): Promise<Uint8Array> {
    await this.#ensureReady();
    const active = this.#requireActive();
    return this.#request(
      `/api/market/artwork?key=${encodeURIComponent(artworkKey)}`,
      {
        method: "GET",
        credentials: "same-origin",
        redirect: "error",
        headers: { authorization: `${active.scheme} ${active.token}` }
      },
      async (response) => {
        if (!response.ok) {
          const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim();
          const payload = contentType === "application/json" ? await this.#readJson(response) : null;
          throw this.#serverError(response, payload);
        }
        if (response.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "image/png") {
          throw new MarketClientError("INVALID_RESPONSE", response.status);
        }
        const bytes = await readBoundedBytes(response, PNG_LIMIT);
        if (!hasPngSignature(bytes)) {
          throw new MarketClientError("INVALID_RESPONSE", response.status);
        }
        return bytes;
      }
    );
  }

  publishCampaign(submission: MarketCampaignSubmission, commandId: string): Promise<unknown> {
    return this.#protectedJson("/api/market/publish", "POST", { commandId, ...submission });
  }

  purchase(campaignId: string, requestId: string): Promise<unknown> {
    return this.#protectedJson("/api/market/purchase", "POST", { campaignId, requestId });
  }

  finish(commandId: string): Promise<unknown> {
    return this.#protectedJson("/api/market/finish", "POST", { commandId });
  }

  reviewCampaign(
    campaignId: string,
    submissionVersion: number,
    status: MarketReviewStatus,
    commandId: string,
    reviewNote?: string
  ): Promise<unknown> {
    return this.#protectedJson("/api/market/review", "POST", {
      commandId,
      campaignId,
      submissionVersion,
      status,
      ...(reviewNote === undefined ? {} : { reviewNote })
    });
  }

  control(command: MarketControlCommand, commandId: string): Promise<unknown> {
    return this.#protectedJson("/api/market/control", "POST", { commandId, ...command });
  }

  async #establishSession(
    kind: MarketIntentKind,
    path: string,
    canonicalInput: Record<string, unknown>
  ): Promise<MarketSafeSessionEnvelope> {
    await this.#ensureReady();
    const canonicalJson = JSON.stringify(canonicalInput);
    const fingerprint = await this.#fingerprint(canonicalJson);
    const clientId = this.#sessionStore.getClientId();
    const intent = kind === "join"
      ? this.#sessionStore.beginIntent("join", fingerprint, String(canonicalInput.roomCode ?? ""))
      : this.#sessionStore.beginIntent("create", fingerprint);
    const payload = await this.#json(path, "POST", {
      ...canonicalInput,
      clientId,
      operationId: intent.operationId
    });
    const parsed = parseInternalSessionEnvelope(payload);
    if (!parsed) throw new MarketClientError("INVALID_RESPONSE", 200);
    const current = this.#sessionStore.readIntent();
    if (!current || current.kind !== kind || current.operationId !== intent.operationId ||
      current.fingerprint !== fingerprint) {
      throw new MarketClientError("STALE_OPERATION", 0);
    }
    try {
      this.#sessionStore.activate({
        ...parsed.session,
        role: parsed.role,
        roomCode: parsed.roomCode
      });
    } catch (error) {
      if (error instanceof RangeError) {
        throw new MarketClientError("INVALID_RESPONSE", 200);
      }
      throw error;
    }
    this.#sessionStore.clearIntent(intent.operationId);
    return { role: parsed.role, roomCode: parsed.roomCode, snapshot: parsed.snapshot };
  }

  async #protectedJson(path: string, method: "GET" | "POST", body?: unknown): Promise<unknown> {
    await this.#ensureReady();
    const identity = this.#sessionStore.readActiveIdentity();
    if (!identity) throw new MarketClientError("AUTH_REQUIRED", 401);
    const payload = await this.#json(path, method, body, identity.session);
    if (!isMarketSafeJson(payload, [
      identity.session.token,
      `${identity.session.scheme} ${identity.session.token}`
    ])) {
      throw new MarketClientError("INVALID_RESPONSE", 200);
    }
    if (!isSameActiveIdentity(this.#sessionStore.readActiveIdentity(), identity)) {
      throw new MarketClientError("STALE_OPERATION", 0);
    }
    return payload;
  }

  async #ensureReady(): Promise<void> {
    try {
      await this.#sessionStore.ensureReady();
    } catch (error) {
      if (error instanceof MarketTabCoordinationError) {
        throw new MarketClientError(error.code, 0);
      }
      throw error;
    }
  }

  #requireActive(): MarketActiveSession {
    const active = this.#sessionStore.readActive();
    if (!active) throw new MarketClientError("AUTH_REQUIRED", 401);
    return active;
  }

  async #json(
    path: string,
    method: "GET" | "POST",
    body?: unknown,
    active?: MarketActiveSession
  ): Promise<unknown> {
    return this.#request(path, {
      method,
      credentials: "same-origin",
      redirect: "error",
      ...(body === undefined ? {} : {
        body: JSON.stringify(body)
      }),
      ...((body !== undefined || active !== undefined) ? {
        headers: {
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(active === undefined ? {} : {
            authorization: `${active.scheme} ${active.token}`
          })
        }
      } : {})
    }, async (response) => {
      const payload = await this.#readJson(response);
      if (!response.ok) throw this.#serverError(response, payload);
      return payload;
    });
  }

  async #request<T>(
    input: RequestInfo | URL,
    init: RequestInit,
    consume: (response: Response) => Promise<T>
  ): Promise<T> {
    const controller = new AbortController();
    let rejectDeadline: (reason: MarketClientError) => void = () => {};
    const deadline = new Promise<never>((_resolve, reject) => {
      rejectDeadline = reject;
    });
    const timer = setTimeout(() => {
      rejectDeadline(new MarketClientError("REQUEST_TIMEOUT", 0));
      controller.abort();
    }, this.#requestTimeoutMs);
    try {
      return await Promise.race([
        this.fetcher(input, { ...init, signal: controller.signal }).then(consume),
        deadline
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async #readJson(response: Response): Promise<unknown> {
    if (response.headers.get("content-type")?.split(";", 1)[0]?.trim() !== "application/json") {
      throw new MarketClientError("INVALID_RESPONSE", response.status);
    }
    const text = new TextDecoder().decode(await readBoundedBytes(response, JSON_LIMIT));
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new MarketClientError("INVALID_RESPONSE", response.status);
    }
  }

  #serverError(response: Response, payload: unknown): MarketClientError {
    const code = isRecord(payload) && typeof payload.error === "string" &&
      payload.error.length >= 1 && payload.error.length <= 128
      ? payload.error
      : "HTTP_ERROR";
    return new MarketClientError(code, response.status);
  }
}
