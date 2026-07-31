import type { Config, Context } from "@netlify/functions";
import {
  ACCOUNT_JSON_LIMIT,
  AccountConfigurationError,
  AccountRequestError,
  SupabaseAccountClient,
  SupabaseAccountError,
  accountJson,
  accountNoContent,
  assertSameOriginPost,
  parseAccountCookies,
  parseAccountEnvironment,
  readAccountJson,
  resolveAccountSession,
  type AccountAuthTokens,
  type AccountEnvironment,
  type AccountEnvironmentRecord,
  type AccountIdentity
} from "./lib/account-backend";
import {
  accountIdentityMatches,
  clearAccountSessionCookies,
  deriveSyntheticAccountEmail,
  normaliseAccountUsername,
  serialiseAccountSessionCookies
} from "./lib/account-primitives";
import {
  defaultPairRegistrationStore,
  PairRegistrationStoreError,
  type PairRegistrationStore
} from "./lib/pair-registration-store";

const ACCOUNT_ROUTES = [
  "/api/account/signup",
  "/api/account/login",
  "/api/account/session",
  "/api/account/logout"
] as const;
const REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const ENVIRONMENT_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "ADVERTISING_GAME_EDGE_GATEWAY_SECRET",
  "ADVERTISING_GAME_USERNAME_HMAC_SECRET",
  "ADVERTISING_GAME_CLASSROOM_CODE"
] as const;

interface AccountSessionDependencies {
  readonly environment?: AccountEnvironment | AccountEnvironmentRecord;
  readonly fetcher?: typeof fetch;
  readonly registrations?: PairRegistrationStore;
  readonly now?: () => Date;
}

const runtimeEnvironment = (): AccountEnvironmentRecord => Object.fromEntries(
  ENVIRONMENT_KEYS.map((key) => [key, Netlify.env.get(key)])
);

const configuredEnvironment = (
  dependency: AccountEnvironment | AccountEnvironmentRecord | undefined
): AccountEnvironment => {
  if (
    dependency &&
    typeof dependency.supabaseUrl === "string" &&
    typeof dependency.publishableKey === "string" &&
    typeof dependency.edgeGatewaySecret === "string" &&
    typeof dependency.usernameHmacSecret === "string" &&
    typeof dependency.classroomCode === "string"
  ) {
    return dependency as AccountEnvironment;
  }
  return parseAccountEnvironment(
    dependency === undefined ? runtimeEnvironment() : dependency as AccountEnvironmentRecord
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (record: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const parsePassword = (value: unknown): string => {
  if (typeof value !== "string") throw new AccountRequestError("INVALID_REQUEST", 400);
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes < 8 || bytes > 128 || value.includes("\0")) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return value;
};

const parseCredentials = (
  value: unknown
): { username: string; password: string } => {
  if (!isRecord(value)) throw new AccountRequestError("INVALID_REQUEST", 400);
  const expectedKeys = ["username", "password"];
  if (!hasExactKeys(value, expectedKeys)) throw new AccountRequestError("INVALID_REQUEST", 400);
  try {
    return {
      username: normaliseAccountUsername(value.username),
      password: parsePassword(value.password)
    };
  } catch (error) {
    if (error instanceof AccountRequestError) throw error;
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
};

const sessionCookies = (
  tokens: AccountAuthTokens,
  resetGeneration: string | null
): readonly string[] => serialiseAccountSessionCookies(
  tokens,
  resetGeneration,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  true
);

const expiredCookies = (): readonly string[] => clearAccountSessionCookies(true);

const verifyFreshTokens = async (
  client: SupabaseAccountClient,
  tokens: AccountAuthTokens,
  expectedUsername: string
): Promise<AccountIdentity> => {
  try {
    const identity = await client.getUser(tokens.accessToken);
    if (identity.username !== expectedUsername) throw new SupabaseAccountError("upstream");
    return identity;
  } catch (error) {
    if (error instanceof SupabaseAccountError && error.kind === "expired_session") {
      throw new SupabaseAccountError("upstream");
    }
    throw error;
  }
};

const routeError = (error: unknown): Response => {
  if (error instanceof AccountRequestError) {
    return accountJson({ error: error.code }, error.status);
  }
  if (error instanceof AccountConfigurationError) {
    return accountJson({ error: "ACCOUNT_NOT_CONFIGURED" }, 503);
  }
  if (error instanceof SupabaseAccountError) {
    if (error.kind === "invalid_credentials") {
      return accountJson({ error: "INVALID_CREDENTIALS" }, 401);
    }
    if (error.kind === "duplicate_user") {
      return accountJson({ error: "USERNAME_UNAVAILABLE" }, 409);
    }
  }
  if (error instanceof PairRegistrationStoreError) {
    if (error.code === "USERNAME_UNAVAILABLE") {
      return accountJson({ error: "USERNAME_UNAVAILABLE" }, 409);
    }
  }
  return accountJson({ error: "ACCOUNT_UNAVAILABLE" }, 503);
};

export function createAccountSessionHandler(
  dependencies: AccountSessionDependencies = {}
): (request: Request, context?: Context) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!ACCOUNT_ROUTES.includes(path as typeof ACCOUNT_ROUTES[number])) {
      return accountJson({ error: "NOT_FOUND" }, 404);
    }
    if (url.search !== "" || url.hash !== "" || request.url.endsWith("?")) {
      return accountJson({ error: "INVALID_REQUEST" }, 400);
    }
    const allowedMethod = path === "/api/account/session" ? "GET" : "POST";
    if (request.method !== allowedMethod) {
      return accountJson({ error: "METHOD_NOT_ALLOWED" }, 405, [], { allow: allowedMethod });
    }

    try {
      if (request.method === "POST") assertSameOriginPost(request);
      const environment = configuredEnvironment(dependencies.environment);
      const client = new SupabaseAccountClient(environment, dependencies.fetcher ?? fetch);

      if (path === "/api/account/signup") {
        const body = parseCredentials(await readAccountJson(request, ACCOUNT_JSON_LIMIT));
        if (await client.findAdvertisingGameUser(body.username) !== null) {
          return accountJson({ error: "USERNAME_UNAVAILABLE" }, 409);
        }
        const registration = await (
          dependencies.registrations ?? defaultPairRegistrationStore()
        ).request({
          ...body,
          requestedAt: (dependencies.now?.() ?? new Date()).toISOString()
        });
        return accountJson({
          status: "pending",
          username: registration.username
        }, 202);
      }

      if (path === "/api/account/login") {
        const body = parseCredentials(await readAccountJson(request, ACCOUNT_JSON_LIMIT));
        const syntheticEmail = deriveSyntheticAccountEmail(
          body.username,
          environment.usernameHmacSecret
        );
        const tokens = await client.signInWithPassword(syntheticEmail, body.password);
        const identity = await verifyFreshTokens(client, tokens, body.username);
        return accountJson(
          {
            authenticated: true,
            username: body.username,
            resetGeneration: identity.resetGeneration
          },
          200,
          sessionCookies(tokens, identity.resetGeneration)
        );
      }

      const cookies = parseAccountCookies(request);
      if (path === "/api/account/logout") {
        const session = await resolveAccountSession(client, cookies);
        if (!session.authenticated) {
          return accountNoContent(expiredCookies());
        }
        const responseCookies = session.rotatedTokens === undefined
          ? []
          : sessionCookies(session.rotatedTokens, session.identity.resetGeneration);
        if (!accountIdentityMatches(request, session.identity.username)) {
          return accountJson({ error: "ACCOUNT_IDENTITY_CHANGED" }, 409, responseCookies);
        }
        const accessToken = session.rotatedTokens?.accessToken ?? cookies.accessToken;
        if (accessToken === undefined) throw new SupabaseAccountError("upstream");
        await client.logout(accessToken);
        return accountNoContent(expiredCookies());
      }

      const session = await resolveAccountSession(client, cookies);
      if (!session.authenticated) {
        return accountJson(
          { authenticated: false },
          200,
          session.clearCookies ? expiredCookies() : []
        );
      }
      return accountJson(
        {
          authenticated: true,
          username: session.identity.username,
          resetGeneration: session.identity.resetGeneration
        },
        200,
        session.rotatedTokens === undefined
          ? []
          : sessionCookies(session.rotatedTokens, session.identity.resetGeneration)
      );
    } catch (error) {
      return routeError(error);
    }
  };
}

export default createAccountSessionHandler();

export const config: Config = {
  path: [
    "/api/account/signup",
    "/api/account/login",
    "/api/account/session",
    "/api/account/logout"
  ],
  rateLimit: {
    windowLimit: 300,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
