import type { Config, Context } from "@netlify/functions";
import {
  ACCOUNT_JSON_LIMIT,
  AccountConfigurationError,
  AccountRequestError,
  SupabaseAccountClient,
  SupabaseAccountError,
  accountJson,
  assertSameOriginMutation,
  readAccountJson,
  type AccountEnvironmentRecord
} from "./lib/account-backend";
import {
  parseAccountAssetEnvironment,
  type AccountAssetEnvironment
} from "./lib/account-assets";
import { defaultAccountAssetService } from "./lib/netlify-account-assets";
import { normaliseAccountUsername } from "./lib/account-primitives";
import {
  TeacherAuthError,
  parseTeacherEnvironment,
  requireTeacherSession,
  type TeacherEnvironment,
  type TeacherEnvironmentRecord
} from "./lib/teacher-auth";
import {
  TeacherAccountService,
  TeacherAccountServiceError,
  defaultTeacherAccountOperationStore
} from "./lib/teacher-account-service";

const ACCOUNT_LIST_PATH = "/api/teacher/accounts";
const ACCOUNT_ACTION_PATH =
  /^\/api\/teacher\/accounts\/([a-z0-9][a-z0-9_-]{2,23})\/(password|reset)$/u;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const TEACHER_PLAYTEST_USERNAME = "teacher-playtest";
const ENVIRONMENT_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "ADVERTISING_GAME_EDGE_GATEWAY_SECRET",
  "ADVERTISING_GAME_USERNAME_HMAC_SECRET",
  "ADVERTISING_GAME_CLASSROOM_CODE",
  "ADVERTISING_GAME_ASSET_NAMESPACE_SECRET",
  "ADVERTISING_GAME_TEACHER_PASSWORD",
  "ADVERTISING_GAME_TEACHER_SESSION_SECRET",
  "ADVERTISING_GAME_TEACHER_SESSION_HOURS"
] as const;

interface TeacherAccountsService {
  listAccounts(): Promise<unknown>;
  createAccount(input: {
    operationId: string;
    username: string;
    password: string;
  }): Promise<unknown>;
  replacePassword(input: {
    operationId: string;
    username: string;
    password: string;
  }): Promise<unknown>;
  resetAccount(input: {
    operationId: string;
    username: string;
  }): Promise<unknown>;
}

interface TeacherAccountsDependencies {
  readonly environment?: AccountEnvironmentRecord;
  readonly teacherEnvironment?: TeacherEnvironment | TeacherEnvironmentRecord;
  readonly accountEnvironment?: AccountAssetEnvironment | AccountEnvironmentRecord;
  readonly fetcher?: typeof fetch;
  readonly service?: TeacherAccountsService;
  readonly serviceFactory?: (
    accountEnvironment: AccountAssetEnvironment,
    teacherEnvironment: TeacherEnvironment
  ) => Promise<TeacherAccountsService>;
  readonly nowSeconds?: () => number;
}

interface ParsedRoute {
  readonly kind: "list" | "create" | "password" | "reset";
  readonly username?: string;
  readonly allowedMethod: "GET" | "POST" | "PUT";
}

const runtimeEnvironment = (): AccountEnvironmentRecord => Object.fromEntries(
  ENVIRONMENT_KEYS.map((key) => [key, Netlify.env.get(key)])
);

const configuredTeacherEnvironment = (
  value: TeacherEnvironment | TeacherEnvironmentRecord
): TeacherEnvironment => {
  if (
    typeof (value as TeacherEnvironment).password === "string" &&
    typeof (value as TeacherEnvironment).sessionSecret === "string" &&
    typeof (value as TeacherEnvironment).sessionHours === "number"
  ) {
    return value as TeacherEnvironment;
  }
  return parseTeacherEnvironment(value as TeacherEnvironmentRecord);
};

const configuredAccountEnvironment = (
  value: AccountAssetEnvironment | AccountEnvironmentRecord
): AccountAssetEnvironment => {
  if (
    typeof (value as AccountAssetEnvironment).supabaseUrl === "string" &&
    typeof (value as AccountAssetEnvironment).assetNamespaceSecret === "string"
  ) {
    return value as AccountAssetEnvironment;
  }
  return parseAccountAssetEnvironment(value as AccountEnvironmentRecord);
};

const routeFor = (pathname: string): ParsedRoute | null => {
  if (pathname === ACCOUNT_LIST_PATH) {
    return { kind: "list", allowedMethod: "GET" };
  }
  const match = ACCOUNT_ACTION_PATH.exec(pathname);
  if (match === null) return null;
  const username = match[1]!;
  return match[2] === "password"
    ? { kind: "password", username, allowedMethod: "PUT" }
    : { kind: "reset", username, allowedMethod: "POST" };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (record: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
};

const parseOperationId = (value: unknown): string => {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return value;
};

const parsePassword = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.includes("\0") ||
    Buffer.byteLength(value, "utf8") < 8 ||
    Buffer.byteLength(value, "utf8") > 128
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return value;
};

const parseCreateBody = (value: unknown) => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schema",
      "version",
      "operationId",
      "username",
      "password"
    ]) ||
    value.schema !== "ad-market-teacher-account-create" ||
    value.version !== 1
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  let username: string;
  try {
    username = normaliseAccountUsername(value.username);
  } catch {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  if (username === TEACHER_PLAYTEST_USERNAME) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return {
    operationId: parseOperationId(value.operationId),
    username,
    password: parsePassword(value.password)
  };
};

const parsePasswordBody = (value: unknown, username: string) => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schema", "version", "operationId", "password"]) ||
    value.schema !== "ad-market-teacher-password-replace" ||
    value.version !== 1
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return {
    operationId: parseOperationId(value.operationId),
    username,
    password: parsePassword(value.password)
  };
};

const parseResetBody = (value: unknown, username: string) => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schema", "version", "operationId", "confirmation"]) ||
    value.schema !== "ad-market-teacher-account-reset" ||
    value.version !== 1 ||
    value.confirmation !== username
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return {
    operationId: parseOperationId(value.operationId),
    username
  };
};

const routeError = (error: unknown, operationId?: string): Response => {
  if (error instanceof AccountRequestError) {
    return accountJson({ error: error.code }, error.status);
  }
  if (error instanceof TeacherAuthError) {
    return accountJson({ error: error.code }, error.status);
  }
  if (error instanceof TeacherAccountServiceError) {
    const body = {
      error: error.code,
      ...(operationId === undefined ? {} : { operationId }),
      ...(error.retryable || error.code === "RESET_INCOMPLETE"
        ? { retryable: error.retryable }
        : {})
    };
    const headers = error.retryAfter !== undefined &&
      Number.isInteger(error.retryAfter) &&
      error.retryAfter >= 1 &&
      error.retryAfter <= 3_600
      ? { "retry-after": String(error.retryAfter) }
      : {};
    return accountJson(body, error.status, [], headers);
  }
  if (error instanceof AccountConfigurationError) {
    return accountJson({ error: "TEACHER_NOT_CONFIGURED" }, 503);
  }
  if (error instanceof SupabaseAccountError) {
    return accountJson({
      error: error.kind === "duplicate_user"
        ? "USERNAME_UNAVAILABLE"
        : "TEACHER_UNAVAILABLE"
    }, error.kind === "duplicate_user" ? 409 : 503);
  }
  return accountJson({ error: "TEACHER_UNAVAILABLE" }, 503);
};

const defaultService = async (
  accountEnvironment: AccountAssetEnvironment,
  teacherEnvironment: TeacherEnvironment,
  fetcher: typeof fetch
): Promise<TeacherAccountsService> => new TeacherAccountService({
  client: new SupabaseAccountClient(accountEnvironment, fetcher),
  assets: await defaultAccountAssetService(accountEnvironment.assetNamespaceSecret),
  operations: defaultTeacherAccountOperationStore(),
  usernameHmacSecret: accountEnvironment.usernameHmacSecret,
  operationSecret: teacherEnvironment.sessionSecret
});

export function createTeacherAccountsHandler(
  dependencies: TeacherAccountsDependencies = {}
): (request: Request, context?: Context) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    const route = routeFor(url.pathname);
    if (route === null) return accountJson({ error: "NOT_FOUND" }, 404);
    if (url.search !== "" || url.hash !== "" || request.url.endsWith("?")) {
      return accountJson({ error: "INVALID_REQUEST" }, 400);
    }
    const expectedMethod = url.pathname === ACCOUNT_LIST_PATH
      ? (request.method === "POST" ? "POST" : "GET")
      : route.allowedMethod;
    const routeWithMethod = url.pathname === ACCOUNT_LIST_PATH && request.method === "POST"
      ? { ...route, kind: "create" as const, allowedMethod: "POST" as const }
      : route;
    if (request.method !== expectedMethod) {
      return accountJson({ error: "METHOD_NOT_ALLOWED" }, 405, [], {
        allow: url.pathname === ACCOUNT_LIST_PATH ? "GET, POST" : route.allowedMethod
      });
    }

    let operationId: string | undefined;
    try {
      const combinedEnvironment = dependencies.environment ?? runtimeEnvironment();
      const teacherEnvironment = configuredTeacherEnvironment(
        dependencies.teacherEnvironment ?? combinedEnvironment
      );
      requireTeacherSession(
        request,
        teacherEnvironment,
        dependencies.nowSeconds?.() ?? Math.floor(Date.now() / 1_000)
      );
      if (request.method === "GET") {
        if (request.body !== null) throw new AccountRequestError("INVALID_REQUEST", 400);
      } else {
        assertSameOriginMutation(request, request.method as "POST" | "PUT");
      }

      const accountEnvironment = dependencies.service === undefined
        ? configuredAccountEnvironment(
            dependencies.accountEnvironment ?? combinedEnvironment
          )
        : undefined;
      const service = dependencies.service ?? await (
        dependencies.serviceFactory !== undefined
          ? dependencies.serviceFactory(accountEnvironment!, teacherEnvironment)
          : defaultService(
              accountEnvironment!,
              teacherEnvironment,
              dependencies.fetcher ?? fetch
            )
      );

      if (routeWithMethod.kind === "list") {
        return accountJson({ accounts: await service.listAccounts() });
      }
      const body = await readAccountJson(request, ACCOUNT_JSON_LIMIT);
      if (routeWithMethod.kind === "create") {
        const input = parseCreateBody(body);
        operationId = input.operationId;
        return accountJson(await service.createAccount(input), 201);
      }
      if (routeWithMethod.kind === "password") {
        const input = parsePasswordBody(body, routeWithMethod.username!);
        operationId = input.operationId;
        return accountJson(await service.replacePassword(input));
      }
      const input = parseResetBody(body, routeWithMethod.username!);
      operationId = input.operationId;
      return accountJson(await service.resetAccount(input));
    } catch (error) {
      return routeError(error, operationId);
    }
  };
}

export default createTeacherAccountsHandler();

export const config: Config = {
  path: [
    "/api/teacher/accounts",
    "/api/teacher/accounts/:username/password",
    "/api/teacher/accounts/:username/reset"
  ],
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
