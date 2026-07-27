import type { Config, Context } from "@netlify/functions";
import {
  ACCOUNT_JSON_LIMIT,
  AccountConfigurationError,
  AccountRequestError,
  SupabaseAccountClient,
  accountJson,
  assertSameOriginPost,
  parseAccountCookies,
  readAccountJson,
  resolveAccountSession,
  type AccountEnvironmentRecord
} from "./lib/account-backend";
import {
  parseAccountAssetEnvironment,
  type AccountAssetEnvironment,
  type AccountAssetResetPlan
} from "./lib/account-assets";
import { defaultAccountAssetService } from "./lib/netlify-account-assets";
import {
  accountIdentityMatches,
  clearAccountSessionCookies,
  serialiseAccountSessionCookies
} from "./lib/account-primitives";

export const ADVERTISING_GAME_RESET_SCHEMA = "advertising-game-account-reset";
export const ADVERTISING_GAME_RESET_VERSION = 1;

const RESET_PATH = "/api/account/reset";
const RESET_KEYS = ["confirmation", "operationId", "schema", "version"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const ENVIRONMENT_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "ADVERTISING_GAME_EDGE_GATEWAY_SECRET",
  "ADVERTISING_GAME_USERNAME_HMAC_SECRET",
  "ADVERTISING_GAME_CLASSROOM_CODE",
  "ADVERTISING_GAME_ASSET_NAMESPACE_SECRET"
] as const;

interface AccountResetBody {
  readonly operationId: string;
  readonly confirmation: "RESET";
}

interface AccountResetAssetService {
  planReset(userId: string): Promise<AccountAssetResetPlan>;
  executeReset(plan: AccountAssetResetPlan): Promise<void>;
}

interface AccountResetDependencies {
  readonly environment?: AccountAssetEnvironment | AccountEnvironmentRecord;
  readonly fetcher?: typeof fetch;
  readonly service?: AccountResetAssetService;
  readonly serviceFactory?: (namespaceSecret: string) => Promise<AccountResetAssetService>;
}

const runtimeEnvironment = (): AccountEnvironmentRecord => Object.fromEntries(
  ENVIRONMENT_KEYS.map((key) => [key, Netlify.env.get(key)])
);

const configuredEnvironment = (
  dependency: AccountAssetEnvironment | AccountEnvironmentRecord | undefined
): AccountAssetEnvironment => {
  if (
    dependency &&
    typeof dependency.supabaseUrl === "string" &&
    typeof dependency.publishableKey === "string" &&
    typeof dependency.edgeGatewaySecret === "string" &&
    typeof dependency.usernameHmacSecret === "string" &&
    typeof dependency.classroomCode === "string" &&
    typeof dependency.assetNamespaceSecret === "string"
  ) {
    return dependency as AccountAssetEnvironment;
  }
  return parseAccountAssetEnvironment(
    dependency === undefined ? runtimeEnvironment() : dependency as AccountEnvironmentRecord
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (record: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
};

const parseResetBody = (value: unknown): AccountResetBody => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, RESET_KEYS) ||
    value.schema !== ADVERTISING_GAME_RESET_SCHEMA ||
    value.version !== ADVERTISING_GAME_RESET_VERSION ||
    typeof value.operationId !== "string" ||
    !UUID_PATTERN.test(value.operationId) ||
    value.confirmation !== "RESET"
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return { operationId: value.operationId, confirmation: "RESET" };
};

export function createAccountResetHandler(
  dependencies: AccountResetDependencies = {}
): (request: Request, context?: Context) => Promise<Response> {
  return async (request) => {
    let responseCookies: readonly string[] = [];
    let operationId: string | undefined;
    let progressReset = false;
    const url = new URL(request.url);
    if (url.pathname !== RESET_PATH) return accountJson({ error: "NOT_FOUND" }, 404);
    if (request.method !== "POST") {
      return accountJson({ error: "METHOD_NOT_ALLOWED" }, 405, [], { allow: "POST" });
    }

    try {
      assertSameOriginPost(request);
      if ([...url.searchParams.keys()].length !== 0) {
        throw new AccountRequestError("INVALID_REQUEST", 400);
      }
      const reset = parseResetBody(await readAccountJson(request, ACCOUNT_JSON_LIMIT));
      operationId = reset.operationId;
      const environment = configuredEnvironment(dependencies.environment);
      const client = new SupabaseAccountClient(environment, dependencies.fetcher ?? fetch);
      const session = await resolveAccountSession(client, parseAccountCookies(request));
      if (!session.authenticated) {
        return accountJson(
          { error: "AUTHENTICATION_REQUIRED" },
          401,
          session.clearCookies ? clearAccountSessionCookies(true) : []
        );
      }
      responseCookies = session.rotatedTokens === undefined
        ? []
        : serialiseAccountSessionCookies(
          session.rotatedTokens,
          session.identity.resetGeneration,
          REFRESH_COOKIE_MAX_AGE_SECONDS,
          true
        );
      if (!accountIdentityMatches(request, session.identity.username)) {
        return accountJson({ error: "ACCOUNT_IDENTITY_CHANGED" }, 409, responseCookies);
      }

      const service = dependencies.service ??
        await (dependencies.serviceFactory ?? defaultAccountAssetService)(
          environment.assetNamespaceSecret
        );
      const assetPlan = await service.planReset(session.identity.userId);
      await client.progressRpc({
        userId: session.identity.userId,
        operation: "reset",
        schema: "advertising-game-progress",
        version: 1
      });
      progressReset = true;
      await service.executeReset(assetPlan);
      return accountJson({ status: "reset", operationId: reset.operationId }, 200, responseCookies);
    } catch (error) {
      if (progressReset && operationId !== undefined) {
        return accountJson({
          error: "RESET_INCOMPLETE",
          operationId,
          retryable: true
        }, 409, responseCookies);
      }
      if (error instanceof AccountRequestError) {
        return accountJson({ error: error.code }, error.status, responseCookies);
      }
      if (error instanceof AccountConfigurationError) {
        return accountJson({ error: "RESET_NOT_CONFIGURED" }, 503, responseCookies);
      }
      return accountJson({ error: "RESET_UNAVAILABLE" }, 503, responseCookies);
    }
  };
}

export default createAccountResetHandler();

export const config: Config = {
  path: ["/api/account/reset"],
  rateLimit: {
    windowLimit: 300,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
