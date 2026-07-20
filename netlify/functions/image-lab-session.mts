import type { Config, Context } from "@netlify/functions";
import {
  createCapability,
  parseImageLabEnvironment,
  secureCodeMatches,
  serialiseCapabilityCookie,
  serialiseExpiredCapabilityCookie
} from "./lib/image-lab-auth";
import { ImageLabStateError, type ImageLabStateService } from "./lib/image-lab-state";
import { defaultImageLabStateService } from "./lib/netlify-image-lab-state";

const JSON_LIMIT = 8 * 1024;
const ENVIRONMENT_KEYS = [
  "IMAGE_LAB_ENABLED",
  "IMAGE_LAB_SCHOOL_APPROVED",
  "IMAGE_LAB_FAL_MINOR_USE_APPROVED",
  "IMAGE_LAB_ACCOUNT_CAP_USD",
  "IMAGE_LAB_CLASSROOM_CODE",
  "IMAGE_LAB_SIGNING_SECRET",
  "IMAGE_LAB_SESSION_MINUTES",
  "IMAGE_LAB_OBJECT_ALLOWANCE",
  "IMAGE_LAB_REALISE_ALLOWANCE",
  "FAL_KEY"
] as const;

type ImageLabEnvironmentRecord = Readonly<Record<string, string | undefined>>;

interface SessionDependencies {
  environment?: ImageLabEnvironmentRecord;
  nowSeconds: () => number;
  secureCookies?: boolean;
  state?: ImageLabStateService;
}

const runtimeEnvironment = (): ImageLabEnvironmentRecord => Object.fromEntries(
  ENVIRONMENT_KEYS.map((key) => [key, Netlify.env.get(key)])
);

const json = (body: unknown, status = 200, headers: HeadersInit = {}): Response =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store", ...Object.fromEntries(new Headers(headers)) }
  });

const ownRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const exactKeys = (record: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(record).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
};

const validIdentity = (value: unknown): value is string =>
  typeof value === "string" && value === value.trim() && value.length >= 1 && value.length <= 128 &&
  /^[A-Za-z0-9._:-]+$/.test(value);

async function readJson(request: Request): Promise<unknown> {
  const mediaType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") throw new SessionRequestError("UNSUPPORTED_MEDIA_TYPE", 415);
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > JSON_LIMIT)) {
    throw new SessionRequestError("REQUEST_TOO_LARGE", 413);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > JSON_LIMIT) {
    throw new SessionRequestError("REQUEST_TOO_LARGE", 413);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SessionRequestError("INVALID_REQUEST", 400);
  }
}

class SessionRequestError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
  }
}

export function createImageLabSessionHandler(
  dependencies: SessionDependencies = {
    nowSeconds: () => Math.floor(Date.now() / 1000)
  }
): (request: Request, context?: Context) => Promise<Response> {
  return async (request) => {
    const environment = dependencies.environment ?? runtimeEnvironment();
    const path = new URL(request.url).pathname;
    if (path === "/api/image-lab/lock") {
      if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, { allow: "POST" });
      const secure = dependencies.secureCookies ?? new URL(request.url).protocol === "https:";
      return json({ unlocked: false }, 200, {
        "set-cookie": serialiseExpiredCapabilityCookie(secure)
      });
    }
    if (path === "/api/image-lab/config") {
      if (request.method !== "GET") return json({ error: "METHOD_NOT_ALLOWED" }, 405, { allow: "GET" });
      const configuration = parseImageLabEnvironment(environment);
      if (!configuration.enabled) return json(configuration);
      return json({
        enabled: true,
        unlocked: false,
        accountCapUsd: configuration.accountCapUsd,
        objectAllowance: configuration.objectAllowance,
        realiseAllowance: configuration.realiseAllowance
      });
    }
    if (path !== "/api/image-lab/unlock") return json({ error: "NOT_FOUND" }, 404);
    if (request.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405, { allow: "POST" });

    const configuration = parseImageLabEnvironment(environment);
    if (!configuration.enabled) return json({ error: "IMAGE_LAB_DISABLED" }, 503);
    try {
      const body = ownRecord(await readJson(request));
      if (!body || !exactKeys(body, ["code", "sessionId", "teamId"]) ||
        typeof body.code !== "string" || body.code.length > 128 ||
        !validIdentity(body.sessionId) || !validIdentity(body.teamId)) {
        throw new SessionRequestError("INVALID_REQUEST", 400);
      }
      if (!secureCodeMatches(body.code, configuration.classroomCode)) {
        return json({ error: "UNLOCK_DENIED" }, 401);
      }
      const now = dependencies.nowSeconds();
      const expiresAt = now + configuration.sessionMinutes * 60;
      const state = dependencies.state ?? await defaultImageLabStateService();
      const authoritative = await state.unlock({
        sessionId: body.sessionId,
        teamId: body.teamId
      }, {
        objectAllowance: configuration.objectAllowance,
        realiseAllowance: configuration.realiseAllowance,
        expiresAt
      });
      const token = createCapability({
        sessionId: body.sessionId,
        teamId: body.teamId,
        remainingObject: authoritative.object,
        remainingRealise: authoritative.realise,
        expiresAt: authoritative.expiresAt
      }, configuration.signingSecret);
      const cookie = serialiseCapabilityCookie(
        token,
        configuration.sessionMinutes * 60,
        dependencies.secureCookies ?? new URL(request.url).protocol === "https:"
      );
      return json({
        unlocked: true,
        remainingObject: authoritative.object,
        remainingRealise: authoritative.realise,
        expiresAt: authoritative.expiresAt
      }, 200, { "set-cookie": cookie });
    } catch (error) {
      if (error instanceof SessionRequestError) return json({ error: error.code }, error.status);
      if (error instanceof ImageLabStateError) return json({ error: "IMAGE_STATE_UNAVAILABLE" }, 503);
      return json({ error: "INVALID_REQUEST" }, 400);
    }
  };
}

export default createImageLabSessionHandler();

export const config: Config = {
  path: ["/api/image-lab/config", "/api/image-lab/unlock", "/api/image-lab/lock"],
  rateLimit: {
    windowLimit: 300,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
