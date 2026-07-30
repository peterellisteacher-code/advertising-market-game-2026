import {
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

export const TEACHER_SESSION_COOKIE = "admarket_teacher";
const MAX_TEACHER_SESSION_SECONDS = 24 * 60 * 60;
const PASSWORD_COMPARISON_KEY = "ad-market-teacher-password-comparison-v1";
const CLAIM_KEYS = [
  "expiresAt",
  "issuedAt",
  "nonce",
  "schema",
  "version"
] as const;

export interface TeacherSessionClaims {
  readonly schema: "ad-market-teacher-session";
  readonly version: 1;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly nonce: string;
}

export interface TeacherEnvironment {
  readonly password: string;
  readonly sessionSecret: string;
  readonly sessionHours: number;
}

export type TeacherEnvironmentRecord = Readonly<Record<string, string | undefined>>;

export class TeacherAuthError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = "TeacherAuthError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (
  record: Record<string, unknown>,
  expected: readonly string[]
): boolean => {
  const actual = Object.keys(record).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
};

const boundedPrintable = (
  value: string | undefined,
  minimumBytes: number,
  maximumBytes: number
): string => {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !/^[\x20-\x7e]+$/u.test(value)
  ) {
    throw new TeacherAuthError("TEACHER_NOT_CONFIGURED", 503);
  }
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes < minimumBytes || bytes > maximumBytes) {
    throw new TeacherAuthError("TEACHER_NOT_CONFIGURED", 503);
  }
  return value;
};

export function parseTeacherEnvironment(
  environment: TeacherEnvironmentRecord
): TeacherEnvironment {
  const password = boundedPrintable(
    environment.ADVERTISING_GAME_TEACHER_PASSWORD,
    8,
    128
  );
  const sessionSecret = boundedPrintable(
    environment.ADVERTISING_GAME_TEACHER_SESSION_SECRET,
    32,
    256
  );
  const hours = environment.ADVERTISING_GAME_TEACHER_SESSION_HOURS;
  if (hours === undefined || !/^(?:[1-9]|1\d|2[0-4])$/u.test(hours)) {
    throw new TeacherAuthError("TEACHER_NOT_CONFIGURED", 503);
  }
  if (password === sessionSecret) {
    throw new TeacherAuthError("TEACHER_NOT_CONFIGURED", 503);
  }
  return {
    password,
    sessionSecret,
    sessionHours: Number(hours)
  };
}

export function secureTeacherPasswordMatches(
  candidate: unknown,
  expected: string
): boolean {
  const validCandidate = typeof candidate === "string" &&
    Buffer.byteLength(candidate, "utf8") >= 1 &&
    Buffer.byteLength(candidate, "utf8") <= 128 &&
    /^[\x20-\x7e]+$/u.test(candidate);
  const candidateDigest = createHmac("sha256", PASSWORD_COMPARISON_KEY)
    .update(validCandidate ? candidate as string : "", "utf8")
    .digest();
  const expectedDigest = createHmac("sha256", PASSWORD_COMPARISON_KEY)
    .update(expected, "utf8")
    .digest();
  return validCandidate && timingSafeEqual(candidateDigest, expectedDigest);
}

const canonicalNonce = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{22}$/u.test(value)) return false;
  const bytes = Buffer.from(value, "base64url");
  return bytes.byteLength === 16 && bytes.toString("base64url") === value;
};

const validClaims = (value: unknown): value is TeacherSessionClaims => {
  if (!isRecord(value) || !hasExactKeys(value, CLAIM_KEYS)) return false;
  if (
    value.schema !== "ad-market-teacher-session" ||
    value.version !== 1 ||
    !Number.isSafeInteger(value.issuedAt) ||
    !Number.isSafeInteger(value.expiresAt) ||
    (value.issuedAt as number) < 0 ||
    (value.expiresAt as number) <= (value.issuedAt as number) ||
    (value.expiresAt as number) - (value.issuedAt as number) >
      MAX_TEACHER_SESSION_SECONDS ||
    !canonicalNonce(value.nonce)
  ) {
    return false;
  }
  return true;
};

const canonicalClaims = (claims: TeacherSessionClaims): TeacherSessionClaims => ({
  schema: "ad-market-teacher-session",
  version: 1,
  issuedAt: claims.issuedAt,
  expiresAt: claims.expiresAt,
  nonce: claims.nonce
});

const sign = (payload: string, secret: string): string =>
  createHmac("sha256", secret).update(payload, "utf8").digest("base64url");

export function createTeacherSessionToken(
  claims: TeacherSessionClaims,
  secret: string
): string {
  if (!validClaims(claims)) throw new TeacherAuthError("INVALID_SESSION", 500);
  const payload = Buffer.from(
    JSON.stringify(canonicalClaims(claims)),
    "utf8"
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

const decodeCanonicalBase64Url = (value: string): Buffer | null => {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) return null;
  const decoded = Buffer.from(value, "base64url");
  return decoded.byteLength > 0 && decoded.toString("base64url") === value
    ? decoded
    : null;
};

export function verifyTeacherSessionToken(
  token: unknown,
  secret: string,
  nowSeconds: number
): TeacherSessionClaims | null {
  if (
    typeof token !== "string" ||
    token.length < 3 ||
    token.length > 4_096 ||
    !Number.isSafeInteger(nowSeconds) ||
    nowSeconds < 0
  ) {
    return null;
  }
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const payloadBytes = decodeCanonicalBase64Url(parts[0]!);
  const signatureBytes = decodeCanonicalBase64Url(parts[1]!);
  if (payloadBytes === null || signatureBytes?.byteLength !== 32) return null;
  const expected = createHmac("sha256", secret).update(parts[0]!, "utf8").digest();
  if (!timingSafeEqual(signatureBytes, expected)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBytes.toString("utf8")) as unknown;
  } catch {
    return null;
  }
  if (!validClaims(parsed)) return null;
  if (parsed.issuedAt > nowSeconds || parsed.expiresAt <= nowSeconds) return null;
  return canonicalClaims(parsed);
}

export function createTeacherSessionClaims(
  nowSeconds: number,
  lifetimeSeconds: number,
  nonce = randomBytes(16).toString("base64url")
): TeacherSessionClaims {
  return canonicalClaims({
    schema: "ad-market-teacher-session",
    version: 1,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + lifetimeSeconds,
    nonce
  });
}

export function serialiseTeacherCookie(token: string, maxAgeSeconds: number): string {
  return [
    `${TEACHER_SESSION_COOKIE}=${token}`,
    "Path=/api/teacher",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ].join("; ");
}

export function clearTeacherCookie(): string {
  return serialiseTeacherCookie("", 0);
}

function teacherCookie(request: Request): string | null {
  const values = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${TEACHER_SESSION_COOKIE}=`))
    .map((part) => part.slice(TEACHER_SESSION_COOKIE.length + 1));
  return values.length === 1 && values[0] ? values[0] : null;
}

export function readTeacherSession(
  request: Request,
  environment: TeacherEnvironment,
  nowSeconds = Math.floor(Date.now() / 1_000)
): TeacherSessionClaims | null {
  const token = teacherCookie(request);
  return token === null
    ? null
    : verifyTeacherSessionToken(token, environment.sessionSecret, nowSeconds);
}

export function requireTeacherSession(
  request: Request,
  environment: TeacherEnvironment,
  nowSeconds = Math.floor(Date.now() / 1_000)
): TeacherSessionClaims {
  const session = readTeacherSession(request, environment, nowSeconds);
  if (session === null) {
    throw new TeacherAuthError("AUTHENTICATION_REQUIRED", 401);
  }
  return session;
}
