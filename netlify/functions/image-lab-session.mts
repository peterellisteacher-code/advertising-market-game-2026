import type { Config, Context } from "@netlify/functions";
import {
  AccountConfigurationError,
  SupabaseAccountClient,
  SupabaseAccountError,
  parseAccountCookies,
  parseAccountEnvironment,
  resolveAccountSession,
  type ResolvedAccountSession
} from "./lib/account-backend";
import {
  clearAccountSessionCookies,
  serialiseAccountSessionCookies
} from "./lib/account-primitives";
import { parseImageLabEnvironment } from "./lib/image-lab-auth";
import {
  ImageLabAllowanceStoreError,
  SupabaseImageLabAllowanceStore,
  type ImageLabAllowanceStore
} from "./lib/image-lab-allowance-store";

const REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const ENVIRONMENT_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "ADVERTISING_GAME_EDGE_GATEWAY_SECRET",
  "ADVERTISING_GAME_USERNAME_HMAC_SECRET",
  "ADVERTISING_GAME_CLASSROOM_CODE",
  "IMAGE_LAB_ENABLED",
  "IMAGE_LAB_SCHOOL_APPROVED",
  "IMAGE_LAB_ACCOUNT_CAP_USD",
  "IMAGE_LAB_SIGNING_SECRET",
  "FAL_KEY"
] as const;

type ImageLabEnvironmentRecord = Readonly<Record<string, string | undefined>>;

interface SessionDependencies {
  readonly environment?: ImageLabEnvironmentRecord;
  readonly fetcher?: typeof fetch;
  readonly resolveSession?: (request: Request) => Promise<ResolvedAccountSession>;
  readonly allowances?: Pick<ImageLabAllowanceStore, "status">;
}

const runtimeEnvironment = (): ImageLabEnvironmentRecord => Object.fromEntries(
  ENVIRONMENT_KEYS.map((key) => [key, Netlify.env.get(key)])
);

const json = (
  body: unknown,
  status = 200,
  cookies: readonly string[] = [],
  extraHeaders: HeadersInit = {}
): Response => {
  const headers = new Headers({
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "cross-origin-resource-policy": "same-origin",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    ...Object.fromEntries(new Headers(extraHeaders))
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return Response.json(body, { status, headers });
};

const rotatedCookies = (
  session: Extract<ResolvedAccountSession, { authenticated: true }>
): readonly string[] => session.rotatedTokens === undefined
  ? []
  : serialiseAccountSessionCookies(
    session.rotatedTokens,
    session.identity.resetGeneration,
    REFRESH_COOKIE_MAX_AGE_SECONDS,
    true
  );

const hasUntrustedIdentityInput = (request: Request, url: URL): boolean =>
  url.search !== "" ||
  url.hash !== "" ||
  request.headers.has("x-admarket-account") ||
  request.headers.has("x-image-lab-code") ||
  request.headers.has("x-image-lab-user-id") ||
  request.headers.has("x-image-lab-session-id") ||
  request.headers.has("x-image-lab-team-id");

export function createImageLabSessionHandler(
  dependencies: SessionDependencies = {}
): (request: Request, context?: Context) => Promise<Response> {
  return async (request) => {
    try {
      const url = new URL(request.url);
      if (url.pathname !== "/api/image-lab/session") {
        return json({ error: "NOT_FOUND" }, 404);
      }
      if (request.method !== "GET") {
        return json({ error: "METHOD_NOT_ALLOWED" }, 405, [], { allow: "GET" });
      }
      if (hasUntrustedIdentityInput(request, url)) {
        return json({ error: "INVALID_REQUEST" }, 400);
      }

      const environment = dependencies.environment ?? runtimeEnvironment();
      let client: SupabaseAccountClient | undefined;
      const accountSession = dependencies.resolveSession === undefined
        ? await (() => {
            client = new SupabaseAccountClient(
              parseAccountEnvironment(environment),
              dependencies.fetcher
            );
            return resolveAccountSession(client, parseAccountCookies(request));
          })()
        : await dependencies.resolveSession(request);
      if (!accountSession.authenticated) {
        return json(
          { error: "AUTHENTICATION_REQUIRED" },
          401,
          accountSession.clearCookies ? clearAccountSessionCookies(true) : []
        );
      }
      const cookies = rotatedCookies(accountSession);
      const configuration = parseImageLabEnvironment(environment);
      if (!configuration.enabled) {
        return json({ enabled: false, reason: "disabled" }, 200, cookies);
      }
      const allowances = dependencies.allowances ??
        new SupabaseImageLabAllowanceStore(client ?? new SupabaseAccountClient(
          parseAccountEnvironment(environment),
          dependencies.fetcher
        ));
      const status = await allowances.status(accountSession.identity.userId);
      if (!status.enabled || status.status === "disabled") {
        return json({ enabled: false, reason: "disabled" }, 200, cookies);
      }
      return json({
        enabled: true,
        object: {
          remaining: status.object.remaining,
          reserved: status.object.reserved
        },
        realise: {
          remaining: status.realise.remaining,
          reserved: status.realise.reserved
        }
      }, 200, cookies);
    } catch (error) {
      if (
        error instanceof AccountConfigurationError ||
        error instanceof SupabaseAccountError ||
        error instanceof ImageLabAllowanceStoreError
      ) {
        return json({ error: "IMAGE_LAB_UNAVAILABLE" }, 503);
      }
      return json({ error: "IMAGE_LAB_UNAVAILABLE" }, 503);
    }
  };
}

export default createImageLabSessionHandler();

export const config: Config = {
  path: ["/api/image-lab/session"],
  rateLimit: {
    windowLimit: 300,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
