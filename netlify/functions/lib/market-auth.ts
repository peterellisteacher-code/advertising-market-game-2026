import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const MARKET_COOKIE = "admarket_live_room";
export const MARKET_ROOM_CODE_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{3}$/u;
const ROOM_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const SESSION_INTENT_DOMAIN = "advertising-market/session-intent/v1\0";
const SESSION_ROOM_CODE_DOMAIN = "advertising-market/session-room-code/v1\0";
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u;
const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/u;

export type MarketEnvironment =
  | { readonly enabled: false }
  | {
    readonly enabled: true;
    readonly classroomCode: string;
    readonly signingSecret: string;
  };

export type MarketSession =
  | {
    readonly version: 1;
    readonly role: "teacher";
    readonly roomCode: string;
    readonly expiresAt: number;
  }
  | {
    readonly version: 1;
    readonly role: "team";
    readonly roomCode: string;
    readonly teamId: string;
    readonly expiresAt: number;
  };

export type NewMarketSession = MarketSession extends infer Session
  ? Session extends { version: 1 }
    ? Omit<Session, "version">
    : never
  : never;

export class MarketAuthError extends Error {
  constructor(readonly code: "INVALID_SESSION" | "SESSION_EXPIRED") {
    super(code);
    this.name = "MarketAuthError";
  }
}

const boundedSecret = (
  value: string | undefined,
  minimum: number,
  maximum: number
): value is string =>
  typeof value === "string" && value === value.trim() &&
  value.length >= minimum && value.length <= maximum;

export function parseMarketEnvironment(
  environment: Readonly<Record<string, string | undefined>>
): MarketEnvironment {
  const classroomCode = environment.MARKET_CLASSROOM_CODE;
  const signingSecret = environment.MARKET_SIGNING_SECRET;
  if (!boundedSecret(classroomCode, 8, 128) || !boundedSecret(signingSecret, 32, 4_096)) {
    return { enabled: false };
  }
  return { enabled: true, classroomCode, signingSecret };
}

export function secureMarketCodeMatches(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

export function generateRoomCode(bytes: Uint8Array): string {
  if (bytes.byteLength !== 6) throw new Error("Room-code entropy must contain exactly six bytes");
  const characters = [...bytes].map((byte) => ROOM_ALPHABET[byte & 31]!);
  return `${characters.slice(0, 3).join("")}-${characters.slice(3).join("")}`;
}

export function deriveMarketRoomCode(
  signingSecret: string,
  intentKey: string,
  attempt: number
): string {
  if (!CONTENT_HASH_PATTERN.test(intentKey) || !Number.isInteger(attempt) ||
    attempt < 0 || attempt >= 8) {
    throw new Error("Invalid deterministic room-code input");
  }
  const digest = createHmac("sha256", signingSecret)
    .update(`${SESSION_ROOM_CODE_DOMAIN}${intentKey}\0${attempt}`, "utf8")
    .digest();
  return generateRoomCode(digest.subarray(0, 6));
}

export function deriveMarketSessionIntentKey(
  kind: "create" | "join",
  clientId: string,
  operationId: string
): string {
  return createHash("sha256")
    .update(`${SESSION_INTENT_DOMAIN}${kind}\0${clientId}\0${operationId}`, "utf8")
    .digest("hex");
}

const encode = (value: unknown): string =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

const signature = (payload: string, secret: string): string =>
  createHmac("sha256", secret).update(payload, "utf8").digest("base64url");

export function createMarketSessionToken(value: NewMarketSession, secret: string): string {
  const payload = encode({ version: 1, ...value });
  return `${payload}.${signature(payload, secret)}`;
}

const ownRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const exactKeys = (record: Record<string, unknown>, expected: readonly string[]): boolean => {
  const keys = Object.keys(record).sort();
  const sortedExpected = [...expected].sort();
  return keys.length === sortedExpected.length &&
    keys.every((key, index) => key === sortedExpected[index]);
};

const validExpiry = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) > 0 && (value as number) <= 4_102_444_800;

export function readMarketSessionToken(token: string, secret: string, now: number): MarketSession {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new MarketAuthError("INVALID_SESSION");
  const [payload, suppliedSignature] = parts as [string, string];
  const expectedSignature = signature(payload, secret);
  if (!secureMarketCodeMatches(suppliedSignature, expectedSignature)) {
    throw new MarketAuthError("INVALID_SESSION");
  }

  let record: Record<string, unknown> | null = null;
  try {
    record = ownRecord(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown);
  } catch {
    throw new MarketAuthError("INVALID_SESSION");
  }
  if (!record || record.version !== 1 || !MARKET_ROOM_CODE_PATTERN.test(String(record.roomCode)) ||
    !validExpiry(record.expiresAt)) {
    throw new MarketAuthError("INVALID_SESSION");
  }

  let session: MarketSession;
  if (record.role === "teacher" && exactKeys(record, ["version", "role", "roomCode", "expiresAt"])) {
    session = {
      version: 1,
      role: "teacher",
      roomCode: record.roomCode as string,
      expiresAt: record.expiresAt
    };
  } else if (record.role === "team" &&
    exactKeys(record, ["version", "role", "roomCode", "teamId", "expiresAt"]) &&
    typeof record.teamId === "string" && ID_PATTERN.test(record.teamId)) {
    session = {
      version: 1,
      role: "team",
      roomCode: record.roomCode as string,
      teamId: record.teamId,
      expiresAt: record.expiresAt
    };
  } else {
    throw new MarketAuthError("INVALID_SESSION");
  }
  if (session.expiresAt <= now) throw new MarketAuthError("SESSION_EXPIRED");
  return session;
}

export function serialiseMarketCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  const parts = [
    `${MARKET_COOKIE}=${token}`,
    "Path=/api/market",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function readMarketCookie(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === MARKET_COOKIE) {
      const value = part.slice(separator + 1).trim();
      return value.length > 0 && value.length <= 4_096 ? value : null;
    }
  }
  return null;
}

export function readMarketRequestSession(
  request: Request,
  secret: string,
  now: number
): MarketSession | null {
  const authorization = request.headers.get("authorization");
  if (authorization !== null) {
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/iu.exec(authorization);
    const token = match?.[1];
    if (!token || token.length > 4_096) throw new MarketAuthError("INVALID_SESSION");
    return readMarketSessionToken(token, secret, now);
  }
  const cookie = readMarketCookie(request);
  return cookie === null ? null : readMarketSessionToken(cookie, secret, now);
}
