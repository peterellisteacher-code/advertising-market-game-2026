import { createHmac } from "node:crypto";
import type { Config, Context } from "@netlify/functions";
import {
  PROGRESS_JSON_LIMIT,
  AccountConfigurationError,
  AccountRequestError,
  SupabaseAccountClient,
  accountJson,
  assertSameOriginMutation,
  readAccountJson,
  type AccountAdminRecord,
  type AccountEnvironmentRecord,
  type ProgressRpcInput
} from "./lib/account-backend";
import {
  ACCOUNT_ASSET_LIMITS,
  AccountAssetError,
  parseAccountAssetEnvironment,
  type AccountAssetDescriptor,
  type AccountAssetEnvironment,
  type AccountAssetManifest,
  type AccountAssetResetPlan
} from "./lib/account-assets";
import { parseCloudProgressDocument } from "./lib/account-progress-document";
import { defaultAccountAssetService } from "./lib/netlify-account-assets";
import {
  TeacherAuthError,
  parseTeacherEnvironment,
  requireTeacherSession,
  type TeacherEnvironment,
  type TeacherEnvironmentRecord
} from "./lib/teacher-auth";
import { isCloudProgressDocumentId } from "../../web/src/domain/practice-identity";

const PROGRESS_PATH = "/api/teacher/playtest/progress";
const RESET_PATH = "/api/teacher/playtest/reset";
const ASSET_PATH =
  /^\/api\/teacher\/playtest\/assets\/([a-f0-9]{64})$/u;
const TEACHER_PLAYTEST_USERNAME = "teacher-playtest";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SUPPORTED_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
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

interface TeacherPlaytestClient {
  ensureAdvertisingGameUser(
    username: string,
    password: string
  ): Promise<AccountAdminRecord>;
  progressRpc(input: ProgressRpcInput): Promise<unknown>;
}

interface TeacherPlaytestAssetService {
  put(
    userId: string,
    digest: string,
    contentType: string,
    bytes: Uint8Array
  ): Promise<{ created: boolean; manifest: AccountAssetManifest }>;
  get(
    userId: string,
    digest: string
  ): Promise<{ descriptor: AccountAssetDescriptor; bytes: Uint8Array }>;
  planReset(userId: string): Promise<AccountAssetResetPlan>;
  executeReset(plan: AccountAssetResetPlan): Promise<void>;
}

interface TeacherPlaytestDependencies {
  readonly environment?: AccountEnvironmentRecord;
  readonly teacherEnvironment?: TeacherEnvironment | TeacherEnvironmentRecord;
  readonly accountEnvironment?: AccountAssetEnvironment | AccountEnvironmentRecord;
  readonly fetcher?: typeof fetch;
  readonly client?: TeacherPlaytestClient;
  readonly assets?: TeacherPlaytestAssetService;
  readonly assetFactory?: (namespaceSecret: string) => Promise<TeacherPlaytestAssetService>;
  readonly nowSeconds?: () => number;
}

interface SaveProgressBody {
  readonly documentId: string;
  readonly expectedRevision: number;
  readonly document: Readonly<Record<string, unknown>>;
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
  ) return value as TeacherEnvironment;
  return parseTeacherEnvironment(value as TeacherEnvironmentRecord);
};

const configuredAccountEnvironment = (
  value: AccountAssetEnvironment | AccountEnvironmentRecord
): AccountAssetEnvironment => {
  if (
    typeof (value as AccountAssetEnvironment).supabaseUrl === "string" &&
    typeof (value as AccountAssetEnvironment).assetNamespaceSecret === "string"
  ) return value as AccountAssetEnvironment;
  return parseAccountAssetEnvironment(value as AccountEnvironmentRecord);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasExactKeys = (record: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
};

const parseDocumentId = (value: unknown): string => {
  if (!isCloudProgressDocumentId(value)) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return value;
};

const parseProgressDocumentId = (url: URL): string | undefined => {
  const keys = [...url.searchParams.keys()];
  if (keys.length === 0) return undefined;
  if (
    keys.length !== 1 ||
    keys[0] !== "documentId" ||
    url.searchParams.getAll("documentId").length !== 1
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return parseDocumentId(url.searchParams.get("documentId"));
};

const parseSaveBody = (value: unknown): SaveProgressBody => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schema",
      "version",
      "documentId",
      "expectedRevision",
      "document"
    ]) ||
    value.schema !== "advertising-game-progress" ||
    value.version !== 1 ||
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

const validRevision = (value: unknown, allowZero = false): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= (allowZero ? 0 : 1);

const validUpdatedAt = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length >= 20 &&
  value.length <= 64 &&
  Number.isFinite(Date.parse(value));

const parseMetadata = (value: unknown): readonly Record<string, unknown>[] | null => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["status", "documents"]) ||
    value.status !== "listed" ||
    !Array.isArray(value.documents) ||
    value.documents.length > 16
  ) return null;
  const result: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const candidate of value.documents) {
    if (
      !isRecord(candidate) ||
      !hasExactKeys(candidate, ["documentId", "revision", "updatedAt"]) ||
      !isCloudProgressDocumentId(candidate.documentId) ||
      !validRevision(candidate.revision) ||
      !validUpdatedAt(candidate.updatedAt) ||
      seen.has(candidate.documentId)
    ) return null;
    seen.add(candidate.documentId);
    result.push({
      documentId: candidate.documentId,
      revision: candidate.revision,
      updatedAt: candidate.updatedAt
    });
  }
  return result;
};

const playtestCreationPassword = (sessionSecret: string): string =>
  createHmac("sha256", sessionSecret)
    .update("ad-market-teacher-playtest-creation-v1\0", "utf8")
    .update(TEACHER_PLAYTEST_USERNAME, "utf8")
    .digest("base64url");

const readBoundedAsset = async (request: Request): Promise<Uint8Array> => {
  if (request.body === null) throw new AccountAssetError("UNSUPPORTED_ASSET");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > ACCOUNT_ASSET_LIMITS.maxAssetBytes) {
      await reader.cancel();
      throw new AccountAssetError("ASSET_TOO_LARGE");
    }
    chunks.push(value);
  }
  if (total < 1) throw new AccountAssetError("UNSUPPORTED_ASSET");
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
};

const assetBinary = (
  descriptor: AccountAssetDescriptor,
  bytes: Uint8Array
): Response => {
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  return new Response(body, {
    status: 200,
    headers: {
      "cache-control": "private, no-store",
      "content-length": String(bytes.byteLength),
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "content-type": descriptor.contentType,
      "cross-origin-resource-policy": "same-origin",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff"
    }
  });
};

const parseResetBody = (value: unknown): string => {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "schema",
      "version",
      "operationId",
      "confirmation"
    ]) ||
    value.schema !== "ad-market-teacher-playtest-reset" ||
    value.version !== 1 ||
    typeof value.operationId !== "string" ||
    !UUID_PATTERN.test(value.operationId) ||
    value.confirmation !== "RESET"
  ) {
    throw new AccountRequestError("INVALID_REQUEST", 400);
  }
  return value.operationId;
};

const assetError = (error: AccountAssetError): Response => {
  const status = error.code === "ASSET_NOT_FOUND"
    ? 404
    : error.code === "ASSET_TOO_LARGE"
      ? 413
      : error.code === "UNSUPPORTED_ASSET"
        ? 415
        : error.code === "ASSET_HASH_MISMATCH"
          ? 422
          : error.code === "ASSET_QUOTA_EXCEEDED"
            ? 409
            : 503;
  return accountJson({ error: error.code }, status);
};

export function createTeacherPlaytestHandler(
  dependencies: TeacherPlaytestDependencies = {}
): (request: Request, context?: Context) => Promise<Response> {
  return async (request) => {
    const url = new URL(request.url);
    const assetMatch = ASSET_PATH.exec(url.pathname);
    const route = url.pathname === PROGRESS_PATH
      ? "progress"
      : url.pathname === RESET_PATH
        ? "reset"
        : assetMatch !== null
          ? "asset"
          : null;
    if (route === null) return accountJson({ error: "NOT_FOUND" }, 404);
    const allowed = route === "reset" ? ["POST"] : ["GET", "PUT"];
    if (!allowed.includes(request.method)) {
      return accountJson({ error: "METHOD_NOT_ALLOWED" }, 405, [], {
        allow: allowed.join(", ")
      });
    }

    let operationId: string | undefined;
    let progressReset = false;
    try {
      const combined = dependencies.environment ?? runtimeEnvironment();
      const teacherEnvironment = configuredTeacherEnvironment(
        dependencies.teacherEnvironment ?? combined
      );
      requireTeacherSession(
        request,
        teacherEnvironment,
        dependencies.nowSeconds?.() ?? Math.floor(Date.now() / 1_000)
      );

      let documentId: string | undefined;
      let saveBody: SaveProgressBody | undefined;
      let assetBytes: Uint8Array | undefined;
      let assetContentType: string | undefined;
      if (route === "progress") {
        if (request.method === "GET") {
          documentId = parseProgressDocumentId(url);
        } else {
          assertSameOriginMutation(request, "PUT");
          if (url.search !== "") throw new AccountRequestError("INVALID_REQUEST", 400);
          saveBody = parseSaveBody(await readAccountJson(request, PROGRESS_JSON_LIMIT));
          documentId = saveBody.documentId;
        }
      } else if (route === "asset") {
        if (url.search !== "") throw new AccountRequestError("INVALID_REQUEST", 400);
        if (request.method === "PUT") {
          assertSameOriginMutation(request, "PUT");
          assetContentType = request.headers.get("content-type")?.trim().toLowerCase();
          if (
            assetContentType === undefined ||
            !SUPPORTED_CONTENT_TYPES.has(assetContentType) ||
            ![null, "identity"].includes(request.headers.get("content-encoding"))
          ) {
            throw new AccountAssetError("UNSUPPORTED_ASSET");
          }
          assetBytes = await readBoundedAsset(request);
        }
      } else {
        assertSameOriginMutation(request, "POST");
        if (url.search !== "") throw new AccountRequestError("INVALID_REQUEST", 400);
        operationId = parseResetBody(await readAccountJson(request, PROGRESS_JSON_LIMIT));
      }

      const accountEnvironment = configuredAccountEnvironment(
        dependencies.accountEnvironment ?? combined
      );
      const client = dependencies.client ??
        new SupabaseAccountClient(accountEnvironment, dependencies.fetcher ?? fetch);
      const assets = dependencies.assets ?? await (
        dependencies.assetFactory ?? defaultAccountAssetService
      )(accountEnvironment.assetNamespaceSecret);
      const playtestUser = await client.ensureAdvertisingGameUser(
        TEACHER_PLAYTEST_USERNAME,
        playtestCreationPassword(teacherEnvironment.sessionSecret)
      );

      if (route === "progress") {
        const result = await client.progressRpc({
          userId: playtestUser.userId,
          operation: request.method === "GET"
            ? (documentId === undefined ? "list" : "load")
            : "save",
          ...(documentId === undefined ? {} : { documentId }),
          schema: "advertising-game-progress",
          version: 1,
          ...(saveBody === undefined ? {} : {
            expectedRevision: saveBody.expectedRevision,
            document: saveBody.document
          })
        });
        if (request.method === "GET" && documentId === undefined) {
          const documents = parseMetadata(result);
          return documents === null
            ? accountJson({ error: "PROGRESS_UNAVAILABLE" }, 503)
            : accountJson({
                schema: "advertising-game-progress",
                version: 1,
                documents
              });
        }
        if (request.method === "GET") {
          if (isRecord(result) && result.status === "not_found") {
            return accountJson({ error: "PROGRESS_NOT_FOUND" }, 404);
          }
          if (
            !isRecord(result) ||
            result.status !== "found" ||
            !validRevision(result.revision) ||
            !isRecord(result.document) ||
            !validUpdatedAt(result.updatedAt)
          ) return accountJson({ error: "PROGRESS_UNAVAILABLE" }, 503);
          return accountJson({
            schema: "advertising-game-progress",
            version: 1,
            documentId,
            revision: result.revision,
            document: parseCloudProgressDocument(result.document, documentId!),
            updatedAt: result.updatedAt
          });
        }
        if (isRecord(result) && result.status === "conflict" &&
          validRevision(result.currentRevision, true)) {
          return accountJson({
            error: "REVISION_CONFLICT",
            currentRevision: result.currentRevision
          }, 409);
        }
        if (
          !isRecord(result) ||
          result.status !== "saved" ||
          !validRevision(result.revision) ||
          !validUpdatedAt(result.updatedAt)
        ) return accountJson({ error: "PROGRESS_UNAVAILABLE" }, 503);
        return accountJson({
          schema: "advertising-game-progress",
          version: 1,
          documentId,
          revision: result.revision,
          updatedAt: result.updatedAt
        });
      }

      if (route === "asset") {
        const digest = assetMatch![1]!;
        if (request.method === "PUT") {
          const result = await assets.put(
            playtestUser.userId,
            digest,
            assetContentType!,
            assetBytes!
          );
          return accountJson({
            ...result.manifest,
            asset: {
              ...result.manifest.asset,
              href: `/api/teacher/playtest/assets/${digest}`
            }
          }, result.created ? 201 : 200);
        }
        const result = await assets.get(playtestUser.userId, digest);
        return assetBinary(result.descriptor, result.bytes);
      }

      const plan = await assets.planReset(playtestUser.userId);
      await client.progressRpc({
        userId: playtestUser.userId,
        operation: "reset",
        schema: "advertising-game-progress",
        version: 1
      });
      progressReset = true;
      await assets.executeReset(plan);
      return accountJson({ status: "reset", operationId });
    } catch (error) {
      if (progressReset && operationId !== undefined) {
        return accountJson({
          error: "RESET_INCOMPLETE",
          operationId,
          retryable: false
        }, 409);
      }
      if (error instanceof TeacherAuthError) {
        return accountJson({ error: error.code }, error.status);
      }
      if (error instanceof AccountRequestError) {
        return accountJson({ error: error.code }, error.status);
      }
      if (error instanceof AccountAssetError) return assetError(error);
      if (error instanceof AccountConfigurationError) {
        return accountJson({ error: "PLAYTEST_NOT_CONFIGURED" }, 503);
      }
      return accountJson({ error: "PLAYTEST_UNAVAILABLE" }, 503);
    }
  };
}

export default createTeacherPlaytestHandler();

export const config: Config = {
  path: [
    "/api/teacher/playtest/progress",
    "/api/teacher/playtest/assets/:digest",
    "/api/teacher/playtest/reset"
  ],
  rateLimit: {
    windowLimit: 300,
    windowSize: 60,
    aggregateBy: ["ip", "domain"]
  }
};
