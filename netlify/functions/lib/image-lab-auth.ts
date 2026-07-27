import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

export const IMAGE_LAB_COOKIE = "admarket_image_lab";

export type ImageLabStage = "object-forge" | "make-it-real";

export type DisabledImageLabEnvironment = {
  enabled: false;
  reason:
    | "disabled"
    | "school-approval-required"
    | "account-cap-required"
    | "server-configuration-required";
};

export interface ReadyImageLabEnvironment {
  enabled: true;
  accountCapUsd: number;
  falKey: string;
  signingSecret: string;
}

export type ImageLabEnvironment = DisabledImageLabEnvironment | ReadyImageLabEnvironment;

export interface ResolvedImageLabAccount {
  readonly userId: string;
  readonly username: string;
}

/** @deprecated Retained only while already-created legacy jobs are drained during transition. */
export interface ImageLabCapability {
  version: 1;
  sessionId: string;
  teamId: string;
  remainingObject: number;
  remainingRealise: number;
  expiresAt: number;
}

export interface ImageLabJobToken {
  version: 2;
  jobId: string;
  stage: ImageLabStage;
  profileId: string;
  userId: string;
  expiresAt: number;
}

export class ImageLabAuthError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ImageLabAuthError";
  }
}

const ownRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const nonempty = (value: string | undefined, minLength = 1): value is string =>
  typeof value === "string" && value === value.trim() && value.length >= minLength;

export function parseImageLabEnvironment(
  environment: Readonly<Record<string, string | undefined>>
): ImageLabEnvironment {
  if (environment.IMAGE_LAB_ENABLED !== "true") return { enabled: false, reason: "disabled" };
  if (environment.IMAGE_LAB_SCHOOL_APPROVED !== "true") {
    return { enabled: false, reason: "school-approval-required" };
  }
  const accountCapUsd = Number(environment.IMAGE_LAB_ACCOUNT_CAP_USD);
  if (!Number.isFinite(accountCapUsd) || accountCapUsd <= 0 || accountCapUsd > 100) {
    return { enabled: false, reason: "account-cap-required" };
  }
  const signingSecret = environment.IMAGE_LAB_SIGNING_SECRET;
  const falKey = environment.FAL_KEY;
  if (!nonempty(signingSecret, 32) || !nonempty(falKey, 1)) {
    return { enabled: false, reason: "server-configuration-required" };
  }
  return {
    enabled: true,
    accountCapUsd,
    signingSecret,
    falKey
  };
}

export function secureCodeMatches(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

const encode = (value: unknown): string => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

const sign = (payload: string, secret: string): string =>
  createHmac("sha256", secret).update(payload, "utf8").digest("base64url");

function signedToken(value: unknown, secret: string): string {
  const payload = encode(value);
  return `${payload}.${sign(payload, secret)}`;
}

function readSignedRecord(token: string, secret: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new ImageLabAuthError("INVALID_TOKEN", "Image Lab token is invalid");
  }
  const [payload, providedSignature] = parts as [string, string];
  const expectedSignature = sign(payload, secret);
  if (!secureCodeMatches(providedSignature, expectedSignature)) {
    throw new ImageLabAuthError("INVALID_TOKEN", "Image Lab token is invalid");
  }
  try {
    const parsed = ownRecord(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown);
    if (!parsed) throw new Error("not an object");
    return parsed;
  } catch {
    throw new ImageLabAuthError("INVALID_TOKEN", "Image Lab token is invalid");
  }
}

const validIdentity = (value: unknown): value is string =>
  typeof value === "string" && value === value.trim() && value.length >= 1 && value.length <= 128 &&
  /^[A-Za-z0-9._:-]+$/.test(value);

const validCount = (value: unknown, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;

const validExpiry = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) > 0;

export function createCapability(
  value: Omit<ImageLabCapability, "version">,
  secret: string
): string {
  return signedToken({ version: 1, ...value }, secret);
}

export function readCapability(token: string, secret: string, nowSeconds: number): ImageLabCapability {
  const record = readSignedRecord(token, secret);
  if (record.version !== 1 || !validIdentity(record.sessionId) || !validIdentity(record.teamId) ||
    !validCount(record.remainingObject, 12) || !validCount(record.remainingRealise, 4) ||
    !validExpiry(record.expiresAt)) {
    throw new ImageLabAuthError("INVALID_TOKEN", "Image Lab token is invalid");
  }
  if (record.expiresAt <= nowSeconds) {
    throw new ImageLabAuthError("EXPIRED_TOKEN", "Image Lab access has expired");
  }
  return {
    version: 1,
    sessionId: record.sessionId,
    teamId: record.teamId,
    remainingObject: record.remainingObject,
    remainingRealise: record.remainingRealise,
    expiresAt: record.expiresAt
  };
}

export function consumeAllowance(
  capability: ImageLabCapability,
  stage: ImageLabStage
): ImageLabCapability {
  if (stage === "object-forge") {
    if (capability.remainingObject < 1) {
      throw new ImageLabAuthError("ALLOWANCE_EXHAUSTED", "Object Forge allowance is exhausted");
    }
    return { ...capability, remainingObject: capability.remainingObject - 1 };
  }
  if (capability.remainingRealise < 1) {
    throw new ImageLabAuthError("ALLOWANCE_EXHAUSTED", "Make It Real allowance is exhausted");
  }
  return { ...capability, remainingRealise: capability.remainingRealise - 1 };
}

export function serialiseCapabilityCookie(
  token: string,
  maxAgeSeconds: number,
  secure: boolean
): string {
  const parts = [
    `${IMAGE_LAB_COOKIE}=${token}`,
    "Path=/api/image-lab",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function serialiseExpiredCapabilityCookie(secure: boolean): string {
  const parts = [
    `${IMAGE_LAB_COOKIE}=`,
    "Path=/api/image-lab",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0"
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function createJobToken(
  value: Omit<ImageLabJobToken, "version">,
  secret: string
): string {
  const iv = randomBytes(12);
  const key = createHash("sha256").update(secret, "utf8").digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("admarket:image-lab-job:v2", "utf8"));
  const plaintext = Buffer.from(JSON.stringify({ version: 2, ...value }), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `j2.${iv.toString("base64url")}.${ciphertext.toString("base64url")}.${tag.toString("base64url")}`;
}

function decodeJobPart(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new ImageLabAuthError("INVALID_JOB", "Image Lab job is invalid");
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.toString("base64url") !== value) {
    throw new ImageLabAuthError("INVALID_JOB", "Image Lab job is invalid");
  }
  return decoded;
}

function readEncryptedJobRecord(token: string, secret: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "j2") {
    throw new ImageLabAuthError("INVALID_JOB", "Image Lab job is invalid");
  }
  try {
    const iv = decodeJobPart(parts[1]!);
    const ciphertext = decodeJobPart(parts[2]!);
    const tag = decodeJobPart(parts[3]!);
    if (iv.byteLength !== 12 || ciphertext.byteLength < 1 || tag.byteLength !== 16) {
      throw new Error("invalid encrypted token dimensions");
    }
    const key = createHash("sha256").update(secret, "utf8").digest();
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from("admarket:image-lab-job:v2", "utf8"));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const record = ownRecord(JSON.parse(plaintext.toString("utf8")) as unknown);
    if (!record) throw new Error("invalid encrypted job payload");
    return record;
  } catch (error) {
    if (error instanceof ImageLabAuthError) throw error;
    throw new ImageLabAuthError("INVALID_JOB", "Image Lab job is invalid");
  }
}

export function readJobToken(
  token: string,
  secret: string,
  expected: { userId: string; nowSeconds: number }
): ImageLabJobToken {
  const record = readEncryptedJobRecord(token, secret);
  const stage = record.stage;
  const validStage = stage === "object-forge" || stage === "make-it-real";
  if (record.version !== 2 || !validIdentity(record.userId) ||
    !validIdentity(record.profileId) || typeof record.jobId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record.jobId) ||
    !validStage || !validExpiry(record.expiresAt)) {
    throw new ImageLabAuthError("INVALID_JOB", "Image Lab job is invalid");
  }
  if (record.expiresAt <= expected.nowSeconds) {
    throw new ImageLabAuthError("EXPIRED_JOB", "Image Lab job has expired");
  }
  if (record.userId !== expected.userId) {
    throw new ImageLabAuthError("WRONG_ACCOUNT", "Image Lab job belongs to another account");
  }
  return {
    version: 2,
    jobId: record.jobId,
    stage,
    profileId: record.profileId,
    userId: record.userId,
    expiresAt: record.expiresAt
  };
}
