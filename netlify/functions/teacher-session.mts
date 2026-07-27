import type { Config, Context } from "@netlify/functions";
import {
  ACCOUNT_JSON_LIMIT,
  AccountRequestError,
  accountJson,
  accountNoContent,
  assertSameOriginPost,
  readAccountJson
} from "./lib/account-backend";
import {
  TeacherAuthError,
  clearTeacherCookie,
  createTeacherSessionClaims,
  createTeacherSessionToken,
  parseTeacherEnvironment,
  readTeacherSession,
  secureTeacherPasswordMatches,
  serialiseTeacherCookie,
  type TeacherEnvironment,
  type TeacherEnvironmentRecord
} from "./lib/teacher-auth";

const TEACHER_SESSION_ROUTES = [
  "/api/teacher/login",
  "/api/teacher/session",
  "/api/teacher/logout"
] as const;
const ENVIRONMENT_KEYS = [
  "ADVERTISING_GAME_TEACHER_PASSWORD",
  "ADVERTISING_GAME_TEACHER_SESSION_SECRET",
  "ADVERTISING_GAME_TEACHER_SESSION_HOURS"
] as const;

interface TeacherSessionDependencies {
  readonly environment?: TeacherEnvironment | TeacherEnvironmentRecord;
  readonly nowSeconds?: () => number;
  readonly nonce?: () => string;
}

const runtimeEnvironment = (): TeacherEnvironmentRecord => Object.fromEntries(
  ENVIRONMENT_KEYS.map((key) => [key, Netlify.env.get(key)])
);

const configuredEnvironment = (
  dependency: TeacherEnvironment | TeacherEnvironmentRecord | undefined
): TeacherEnvironment => {
  if (
    dependency &&
    typeof dependency.password === "string" &&
    typeof dependency.sessionSecret === "string" &&
    typeof dependency.sessionHours === "number"
  ) {
    return dependency as TeacherEnvironment;
  }
  return parseTeacherEnvironment(
    dependency === undefined ? runtimeEnvironment() : dependency as TeacherEnvironmentRecord
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const loginPassword = (value: unknown): unknown => {
  if (!isRecord(value) || Object.keys(value).length !== 1 ||
    !Object.prototype.hasOwnProperty.call(value, "password")) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return value.password;
};

const routeError = (error: unknown): Response => {
  if (error instanceof AccountRequestError) {
    return accountJson({ error: error.code }, error.status);
  }
  if (error instanceof TeacherAuthError) {
    return accountJson({ error: error.code }, error.status);
  }
  return accountJson({ error: "TEACHER_UNAVAILABLE" }, 503);
};

export function createTeacherSessionHandler(
  dependencies: TeacherSessionDependencies = {}
): (request: Request, context?: Context) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!TEACHER_SESSION_ROUTES.includes(path as typeof TEACHER_SESSION_ROUTES[number])) {
      return accountJson({ error: "NOT_FOUND" }, 404);
    }
    if (url.search !== "" || url.hash !== "" || request.url.endsWith("?")) {
      return accountJson({ error: "INVALID_REQUEST" }, 400);
    }
    const allowedMethod = path === "/api/teacher/session" ? "GET" : "POST";
    if (request.method !== allowedMethod) {
      return accountJson({ error: "METHOD_NOT_ALLOWED" }, 405, [], {
        allow: allowedMethod
      });
    }

    try {
      const environment = configuredEnvironment(dependencies.environment);
      const nowSeconds = dependencies.nowSeconds?.() ?? Math.floor(Date.now() / 1_000);

      if (path === "/api/teacher/login") {
        assertSameOriginPost(request);
        const password = loginPassword(await readAccountJson(request, ACCOUNT_JSON_LIMIT));
        if (!secureTeacherPasswordMatches(password, environment.password)) {
          return accountJson({ error: "INVALID_CREDENTIALS" }, 401);
        }
        const lifetimeSeconds = environment.sessionHours * 60 * 60;
        const claims = createTeacherSessionClaims(
          nowSeconds,
          lifetimeSeconds,
          dependencies.nonce?.()
        );
        const token = createTeacherSessionToken(claims, environment.sessionSecret);
        return accountJson(
          { authenticated: true },
          200,
          [serialiseTeacherCookie(token, lifetimeSeconds)]
        );
      }

      if (path === "/api/teacher/logout") {
        assertSameOriginPost(request);
        if (request.body !== null) throw new AccountRequestError("INVALID_REQUEST", 400);
        return accountNoContent([clearTeacherCookie()]);
      }

      if (request.body !== null) throw new AccountRequestError("INVALID_REQUEST", 400);
      const authenticated = readTeacherSession(request, environment, nowSeconds) !== null;
      return accountJson(
        { authenticated },
        200,
        authenticated || !request.headers.get("cookie") ? [] : [clearTeacherCookie()]
      );
    } catch (error) {
      return routeError(error);
    }
  };
}

export default createTeacherSessionHandler();

export const config: Config = {
  path: [
    "/api/teacher/login",
    "/api/teacher/session",
    "/api/teacher/logout"
  ],
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
