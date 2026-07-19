import type { Config, Context } from "@netlify/functions";
import {
  PROGRESS_JSON_LIMIT,
  AccountConfigurationError,
  AccountRequestError,
  SupabaseAccountClient,
  accountJson,
  assertSameOriginMutation,
  parseAccountCookies,
  parseAccountEnvironment,
  readAccountJson,
  resolveAccountSession,
  type AccountAuthTokens,
  type AccountEnvironment,
  type AccountEnvironmentRecord
} from "./lib/account-backend";
import { parseCloudProgressDocument } from "./lib/account-progress-document";
import { isCloudProgressDocumentId } from "../../web/src/domain/practice-identity";
import {
  accountIdentityMatches,
  clearAccountAccessCookie,
  clearAccountRefreshCookie,
  serialiseAccountAccessCookie,
  serialiseAccountRefreshCookie
} from "./lib/account-primitives";

export const ADVERTISING_GAME_PROGRESS_SCHEMA = "advertising-game-progress";
export const ADVERTISING_GAME_PROGRESS_VERSION = 1;

const PROGRESS_PATH = "/api/account/progress";
const REFRESH_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const ENVIRONMENT_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "ADVERTISING_GAME_EDGE_GATEWAY_SECRET",
  "ADVERTISING_GAME_USERNAME_HMAC_SECRET",
  "ADVERTISING_GAME_CLASSROOM_CODE"
] as const;

interface AccountProgressDependencies {
  readonly environment?: AccountEnvironment | AccountEnvironmentRecord;
  readonly fetcher?: typeof fetch;
}

interface SaveProgressBody {
  readonly documentId: string;
  readonly expectedRevision: number;
  readonly document: Readonly<Record<string, unknown>>;
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

const parseDocumentId = (value: unknown): string => {
  if (!isCloudProgressDocumentId(value)) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return value;
};

const parseGetDocumentId = (url: URL): string | undefined => {
  const keys = [...url.searchParams.keys()];
  if (keys.length === 0) return undefined;
  if (keys.length !== 1 || keys[0] !== "documentId" ||
    url.searchParams.getAll("documentId").length !== 1) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return parseDocumentId(url.searchParams.get("documentId"));
};

const parseSaveBody = (value: unknown): SaveProgressBody => {
  if (!isRecord(value) || !hasExactKeys(value, [
    "schema",
    "version",
    "documentId",
    "expectedRevision",
    "document"
  ])) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  if (
    value.schema !== ADVERTISING_GAME_PROGRESS_SCHEMA ||
    value.version !== ADVERTISING_GAME_PROGRESS_VERSION ||
    typeof value.expectedRevision !== "number" ||
    !Number.isSafeInteger(value.expectedRevision) ||
    value.expectedRevision < 0 ||
    !isRecord(value.document)
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  const documentId = parseDocumentId(value.documentId);
  try {
    return {
      documentId,
      expectedRevision: value.expectedRevision,
      document: parseCloudProgressDocument(value.document, documentId)
    };
  } catch {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
};

const sessionCookies = (tokens: AccountAuthTokens): readonly string[] => [
  serialiseAccountAccessCookie(tokens.accessToken, tokens.expiresIn, true),
  serialiseAccountRefreshCookie(tokens.refreshToken, REFRESH_COOKIE_MAX_AGE_SECONDS, true)
];

const expiredCookies = (): readonly string[] => [
  clearAccountAccessCookie(true),
  clearAccountRefreshCookie(true)
];

const validRevision = (value: unknown, allowZero = false): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= (allowZero ? 0 : 1);

const validUpdatedAt = (value: unknown): value is string =>
  typeof value === "string" && value.length >= 20 && value.length <= 64 &&
  !Number.isNaN(Date.parse(value));

interface ProgressMetadata {
  readonly documentId: string;
  readonly revision: number;
  readonly updatedAt: string;
}

const parseProgressMetadata = (result: unknown): readonly ProgressMetadata[] | undefined => {
  if (!isRecord(result) || !hasExactKeys(result, ["status", "documents"]) ||
    result.status !== "listed" || !Array.isArray(result.documents) ||
    result.documents.length > 16) {
    return undefined;
  }

  const documents: ProgressMetadata[] = [];
  const documentIds = new Set<string>();
  for (const value of result.documents) {
    if (!isRecord(value) || !hasExactKeys(value, ["documentId", "revision", "updatedAt"]) ||
      !isCloudProgressDocumentId(value.documentId) ||
      !validRevision(value.revision) || !validUpdatedAt(value.updatedAt) ||
      documentIds.has(value.documentId)) {
      return undefined;
    }
    const current = {
      documentId: value.documentId,
      revision: value.revision,
      updatedAt: value.updatedAt
    };
    const previous = documents.at(-1);
    if (previous !== undefined) {
      const previousTime = Date.parse(previous.updatedAt);
      const currentTime = Date.parse(current.updatedAt);
      if (previousTime < currentTime ||
        (previousTime === currentTime && previous.documentId >= current.documentId)) {
        return undefined;
      }
    }
    documentIds.add(current.documentId);
    documents.push(current);
  }
  return documents;
};

export function createAccountProgressHandler(
  dependencies: AccountProgressDependencies = {}
): (request: Request, context?: Context) => Promise<Response> {
  return async (request) => {
    let responseCookies: readonly string[] = [];
    const url = new URL(request.url);
    if (url.pathname !== PROGRESS_PATH) return accountJson({ error: "NOT_FOUND" }, 404);
    if (request.method !== "GET" && request.method !== "PUT") {
      return accountJson({ error: "METHOD_NOT_ALLOWED" }, 405, [], { allow: "GET, PUT" });
    }

    try {
      let documentId: string | undefined;
      let saveBody: SaveProgressBody | undefined;
      if (request.method === "GET") {
        documentId = parseGetDocumentId(url);
      } else {
        assertSameOriginMutation(request, "PUT");
        if ([...url.searchParams.keys()].length !== 0) {
          throw new AccountRequestError("INVALID_REQUEST", 400);
        }
        saveBody = parseSaveBody(await readAccountJson(request, PROGRESS_JSON_LIMIT));
        documentId = saveBody.documentId;
      }

      const environment = configuredEnvironment(dependencies.environment);
      const client = new SupabaseAccountClient(environment, dependencies.fetcher ?? fetch);
      const session = await resolveAccountSession(client, parseAccountCookies(request));
      if (!session.authenticated) {
        return accountJson(
          { error: "AUTHENTICATION_REQUIRED" },
          401,
          session.clearCookies ? expiredCookies() : []
        );
      }
      responseCookies = session.rotatedTokens === undefined
        ? []
        : sessionCookies(session.rotatedTokens);
      if (!accountIdentityMatches(request, session.identity.username)) {
        return accountJson({ error: "ACCOUNT_IDENTITY_CHANGED" }, 409, responseCookies);
      }
      const result = await client.progressRpc({
        userId: session.identity.userId,
        operation: request.method === "GET"
          ? (documentId === undefined ? "list" : "load")
          : "save",
        ...(documentId === undefined ? {} : { documentId }),
        schema: ADVERTISING_GAME_PROGRESS_SCHEMA,
        version: ADVERTISING_GAME_PROGRESS_VERSION,
        ...(saveBody === undefined
          ? {}
          : {
            expectedRevision: saveBody.expectedRevision,
            document: saveBody.document
          })
      });
      if (!isRecord(result) || typeof result.status !== "string") {
        return accountJson({ error: "PROGRESS_UNAVAILABLE" }, 503, responseCookies);
      }

      if (request.method === "GET") {
        if (documentId === undefined) {
          const documents = parseProgressMetadata(result);
          if (documents === undefined) {
            return accountJson({ error: "PROGRESS_UNAVAILABLE" }, 503, responseCookies);
          }
          return accountJson({
            schema: ADVERTISING_GAME_PROGRESS_SCHEMA,
            version: ADVERTISING_GAME_PROGRESS_VERSION,
            documents
          }, 200, responseCookies);
        }
        if (result.status === "not_found") {
          return accountJson({ error: "PROGRESS_NOT_FOUND" }, 404, responseCookies);
        }
        if (
          result.status !== "found" ||
          !validRevision(result.revision) ||
          !isRecord(result.document) ||
          !validUpdatedAt(result.updatedAt)
        ) {
          return accountJson({ error: "PROGRESS_UNAVAILABLE" }, 503, responseCookies);
        }
        const document = parseCloudProgressDocument(result.document, documentId);
        return accountJson({
          schema: ADVERTISING_GAME_PROGRESS_SCHEMA,
          version: ADVERTISING_GAME_PROGRESS_VERSION,
          documentId,
          revision: result.revision,
          document,
          updatedAt: result.updatedAt
        }, 200, responseCookies);
      }

      if (result.status === "conflict" && validRevision(result.currentRevision, true)) {
        return accountJson({
          error: "REVISION_CONFLICT",
          currentRevision: result.currentRevision
        }, 409, responseCookies);
      }
      if (result.status === "document_limit") {
        return accountJson({ error: "DOCUMENT_LIMIT_REACHED" }, 409, responseCookies);
      }
      if (
        result.status !== "saved" ||
        !validRevision(result.revision) ||
        !validUpdatedAt(result.updatedAt)
      ) {
        return accountJson({ error: "PROGRESS_UNAVAILABLE" }, 503, responseCookies);
      }
      return accountJson({
        schema: ADVERTISING_GAME_PROGRESS_SCHEMA,
        version: ADVERTISING_GAME_PROGRESS_VERSION,
        documentId,
        revision: result.revision,
        updatedAt: result.updatedAt
      }, 200, responseCookies);
    } catch (error) {
      if (error instanceof AccountRequestError) {
        return accountJson({ error: error.code }, error.status);
      }
      if (error instanceof AccountConfigurationError) {
        return accountJson({ error: "PROGRESS_NOT_CONFIGURED" }, 503);
      }
      return accountJson({ error: "PROGRESS_UNAVAILABLE" }, 503, responseCookies);
    }
  };
}

export default createAccountProgressHandler();

export const config: Config = {
  path: ["/api/account/progress"],
  rateLimit: {
    windowLimit: 120,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
