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
import { SupabaseImageLabAllowanceStore } from "./lib/image-lab-allowance-store";
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
const IMAGE_LAB_PATH = "/api/teacher/image-lab";
const IMAGE_LAB_GLOBAL_PATH = "/api/teacher/image-lab/global";
const IMAGE_LAB_BATCH_PATH = "/api/teacher/image-lab/batch";
const IMAGE_LAB_ACCOUNT_PATH =
  /^\/api\/teacher\/image-lab\/accounts\/([a-z0-9][a-z0-9_-]{2,23})(?:\/(add|revoke))?$/u;
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
  imageLabStatus(): Promise<unknown>;
  setImageLabGlobal(input: {
    operationId: string;
    enabled: boolean;
    objectDefault: number;
    realiseDefault: number;
  }): Promise<unknown>;
  mutateImageLabAccount(
    action: "set" | "add" | "revoke",
    input: {
      operationId: string;
      alias: string;
      object: number;
      realise: number;
    }
  ): Promise<unknown>;
  batchAddImageLab(input: {
    operationId: string;
    aliases: readonly string[];
    object: number;
    realise: number;
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
  readonly kind:
    | "list"
    | "create"
    | "password"
    | "reset"
    | "image-lab-status"
    | "image-lab-global"
    | "image-lab-set"
    | "image-lab-add"
    | "image-lab-revoke"
    | "image-lab-batch";
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
  if (pathname === IMAGE_LAB_PATH) {
    return { kind: "image-lab-status", allowedMethod: "GET" };
  }
  if (pathname === IMAGE_LAB_GLOBAL_PATH) {
    return { kind: "image-lab-global", allowedMethod: "PUT" };
  }
  if (pathname === IMAGE_LAB_BATCH_PATH) {
    return { kind: "image-lab-batch", allowedMethod: "POST" };
  }
  const imageLabAccount = IMAGE_LAB_ACCOUNT_PATH.exec(pathname);
  if (imageLabAccount !== null) {
    const username = imageLabAccount[1]!;
    if (imageLabAccount[2] === "add") {
      return { kind: "image-lab-add", username, allowedMethod: "POST" };
    }
    if (imageLabAccount[2] === "revoke") {
      return { kind: "image-lab-revoke", username, allowedMethod: "POST" };
    }
    return { kind: "image-lab-set", username, allowedMethod: "PUT" };
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

const parseAllowanceAmount = (value: unknown): number => {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 100
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return value;
};

const parseImageLabGlobalBody = (value: unknown) => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schema",
      "version",
      "operationId",
      "enabled",
      "objectDefault",
      "realiseDefault"
    ]) ||
    value.schema !== "ad-market-teacher-image-lab-global" ||
    value.version !== 1 ||
    typeof value.enabled !== "boolean"
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return {
    operationId: parseOperationId(value.operationId),
    enabled: value.enabled,
    objectDefault: parseAllowanceAmount(value.objectDefault),
    realiseDefault: parseAllowanceAmount(value.realiseDefault)
  };
};

const parseImageLabAccountBody = (
  value: unknown,
  username: string,
  action: "set" | "add" | "revoke"
) => {
  const schema = `ad-market-teacher-image-lab-account-${action}`;
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schema",
      "version",
      "operationId",
      "object",
      "realise"
    ]) ||
    value.schema !== schema ||
    value.version !== 1
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  const object = parseAllowanceAmount(value.object);
  const realise = parseAllowanceAmount(value.realise);
  if (action !== "set" && object === 0 && realise === 0) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  if (username === TEACHER_PLAYTEST_USERNAME) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return {
    operationId: parseOperationId(value.operationId),
    alias: username,
    object,
    realise
  };
};

const parseImageLabBatchBody = (value: unknown) => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schema",
      "version",
      "operationId",
      "aliases",
      "object",
      "realise"
    ]) ||
    value.schema !== "ad-market-teacher-image-lab-batch-add" ||
    value.version !== 1 ||
    !Array.isArray(value.aliases) ||
    value.aliases.length < 1 ||
    value.aliases.length > 100
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  const aliases = value.aliases.map((candidate) => {
    try {
      const alias = normaliseAccountUsername(candidate);
      if (alias === TEACHER_PLAYTEST_USERNAME) throw new Error("reserved");
      return alias;
    } catch {
      throw new AccountRequestError("INVALID_REQUEST", 400);
    }
  });
  const object = parseAllowanceAmount(value.object);
  const realise = parseAllowanceAmount(value.realise);
  if (
    new Set(aliases).size !== aliases.length ||
    (object === 0 && realise === 0)
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return {
    operationId: parseOperationId(value.operationId),
    aliases,
    object,
    realise
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
        : {}),
      ...(error.code === "IMAGE_LAB_MUTATION_UNCERTAIN"
        ? { retryable: false, refreshRequired: true }
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
): Promise<TeacherAccountsService> => {
  const client = new SupabaseAccountClient(accountEnvironment, fetcher);
  return new TeacherAccountService({
    client,
    assets: await defaultAccountAssetService(accountEnvironment.assetNamespaceSecret),
    allowances: new SupabaseImageLabAllowanceStore(client),
    operations: defaultTeacherAccountOperationStore(),
    usernameHmacSecret: accountEnvironment.usernameHmacSecret,
    operationSecret: teacherEnvironment.sessionSecret
  });
};

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
      if (routeWithMethod.kind === "image-lab-status") {
        return accountJson(await service.imageLabStatus());
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
      if (routeWithMethod.kind === "reset") {
        const input = parseResetBody(body, routeWithMethod.username!);
        operationId = input.operationId;
        return accountJson(await service.resetAccount(input));
      }
      if (routeWithMethod.kind === "image-lab-global") {
        const input = parseImageLabGlobalBody(body);
        operationId = input.operationId;
        return accountJson(await service.setImageLabGlobal(input));
      }
      if (
        routeWithMethod.kind === "image-lab-set" ||
        routeWithMethod.kind === "image-lab-add" ||
        routeWithMethod.kind === "image-lab-revoke"
      ) {
        const action = routeWithMethod.kind.replace("image-lab-", "") as
          "set" | "add" | "revoke";
        const input = parseImageLabAccountBody(
          body,
          routeWithMethod.username!,
          action
        );
        operationId = input.operationId;
        return accountJson(await service.mutateImageLabAccount(action, input));
      }
      const input = parseImageLabBatchBody(body);
      operationId = input.operationId;
      return accountJson(await service.batchAddImageLab(input));
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
    "/api/teacher/accounts/:username/reset",
    "/api/teacher/image-lab",
    "/api/teacher/image-lab/global",
    "/api/teacher/image-lab/accounts/:username",
    "/api/teacher/image-lab/accounts/:username/add",
    "/api/teacher/image-lab/accounts/:username/revoke",
    "/api/teacher/image-lab/batch"
  ],
  rateLimit: {
    windowLimit: 60,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
