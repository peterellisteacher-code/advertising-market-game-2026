import {
  AccountClientError,
  HttpCloudProgressClient,
  type CloudProgressClient,
  type CloudProgressDocumentMetadata,
  type CloudProgressLoadResult,
  type CloudProgressSaveResult
} from "../account/account-client";
import {
  HttpAccountAssetClient,
  type AccountAssetClient,
  type AccountAssetClientDeadlines,
  type AccountAssetDescriptor,
  type AccountAssetDownload
} from "../account/account-asset-client";
import type { AccountCookieRequestSerialiser } from
  "../account/account-cookie-request-serialiser";
import type { CampaignDocumentV1 } from "../domain/campaign-document";

const PROGRESS_PATH = "/api/teacher/playtest/progress";
const RESET_PATH = "/api/teacher/playtest/reset";
const RESPONSE_LIMIT = 16 * 1_024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export interface TeacherPlaytestResetInput {
  readonly operationId: string;
  readonly confirmation: "RESET";
}

export interface TeacherPlaytestClient extends CloudProgressClient, AccountAssetClient {
  reset(input: TeacherPlaytestResetInput): Promise<"reset">;
}

export class TeacherPlaytestClientError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly retryable = false
  ) {
    super(code);
    this.name = "TeacherPlaytestClientError";
  }
}

export interface HttpTeacherPlaytestClientOptions {
  readonly fetcher?: typeof fetch;
  readonly timeoutMilliseconds?: number;
  readonly assetDeadlines?: AccountAssetClientDeadlines;
}

const immediateRequests: AccountCookieRequestSerialiser = {
  run: <T>(operation: () => Promise<T>): Promise<T> => operation()
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[]
): boolean => {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index]);
};

const readBoundedJson = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "application/json" || response.body === null) {
    throw new TeacherPlaytestClientError("INVALID_RESPONSE", 503, true);
  }
  const declared = response.headers.get("content-length");
  if (
    declared !== null &&
    (!/^\d+$/u.test(declared) || Number(declared) > RESPONSE_LIMIT)
  ) {
    throw new TeacherPlaytestClientError("INVALID_RESPONSE", 503, true);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > RESPONSE_LIMIT) {
      await reader.cancel().catch(() => undefined);
      throw new TeacherPlaytestClientError("INVALID_RESPONSE", 503, true);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new TeacherPlaytestClientError("INVALID_RESPONSE", 503, true);
  }
};

const errorFor = async (response: Response): Promise<TeacherPlaytestClientError> => {
  if (response.status === 401) {
    return new TeacherPlaytestClientError("AUTHENTICATION_REQUIRED", 401);
  }
  let code = response.status >= 500 ? "PLAYTEST_UNAVAILABLE" : "INVALID_RESPONSE";
  let retryable = response.status >= 500 || response.status === 429;
  try {
    const body = await readBoundedJson(response);
    if (
      isRecord(body) &&
      typeof body.error === "string" &&
      /^[A-Z][A-Z0-9_]{1,63}$/u.test(body.error)
    ) {
      code = body.error;
    }
    if (isRecord(body) && typeof body.retryable === "boolean") {
      retryable = body.retryable;
    }
  } catch {
    // Invalid error bodies are not reflected to the caller.
  }
  return new TeacherPlaytestClientError(code, response.status, retryable);
};

const boundedFetcher = (
  fetcher: typeof fetch,
  timeoutMilliseconds: number
): typeof fetch => {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const external = init?.signal;
    const onAbort = (): void => controller.abort(external?.reason);
    if (external?.aborted) onAbort();
    else external?.addEventListener("abort", onAbort, { once: true });
    const timer = globalThis.setTimeout(() => {
      controller.abort(new DOMException("Teacher playtest request timed out", "TimeoutError"));
    }, timeoutMilliseconds);
    try {
      return await fetcher.call(globalThis, input, {
        ...init,
        signal: controller.signal
      });
    } finally {
      globalThis.clearTimeout(timer);
      external?.removeEventListener("abort", onAbort);
    }
  }) as typeof fetch;
};

export class HttpTeacherPlaytestClient implements TeacherPlaytestClient {
  readonly #fetcher: typeof fetch;
  readonly #progress: CloudProgressClient;
  readonly #assets: AccountAssetClient;

  constructor(options: HttpTeacherPlaytestClientOptions = {}) {
    const timeoutMilliseconds = options.timeoutMilliseconds ?? 12_000;
    if (
      !Number.isInteger(timeoutMilliseconds) ||
      timeoutMilliseconds < 1_000 ||
      timeoutMilliseconds > 30_000
    ) {
      throw new Error("Teacher playtest request timeout is invalid");
    }
    const fetcher = options.fetcher ?? globalThis.fetch;
    this.#fetcher = boundedFetcher(fetcher, timeoutMilliseconds);
    this.#progress = new HttpCloudProgressClient(
      null,
      this.#fetcher,
      immediateRequests,
      {
        path: PROGRESS_PATH,
        includeAccountIdentityHeader: false
      }
    );
    this.#assets = new HttpAccountAssetClient(
      null,
      fetcher,
      immediateRequests,
      options.assetDeadlines,
      {
        path: (digest) => `/api/teacher/playtest/assets/${digest}`,
        includeAccountIdentityHeader: false
      }
    );
  }

  save(
    document: CampaignDocumentV1,
    expectedRevision: number
  ): Promise<CloudProgressSaveResult> {
    return this.#progress.save(document, expectedRevision);
  }

  load(documentId: string): Promise<CloudProgressLoadResult> {
    return this.#progress.load(documentId);
  }

  list(): Promise<readonly CloudProgressDocumentMetadata[]> {
    return this.#progress.list();
  }

  put(
    blob: Blob,
    options?: { signal?: AbortSignal }
  ): Promise<AccountAssetDescriptor> {
    return this.#assets.put(blob, options);
  }

  get(
    sha256: string,
    options?: { signal?: AbortSignal }
  ): Promise<AccountAssetDownload> {
    return this.#assets.get(sha256, options);
  }

  async reset(input: TeacherPlaytestResetInput): Promise<"reset"> {
    if (
      input.confirmation !== "RESET" ||
      !UUID_PATTERN.test(input.operationId)
    ) {
      throw new TeacherPlaytestClientError("INVALID_REQUEST", 400);
    }
    let response: Response;
    try {
      response = await this.#fetcher(RESET_PATH, {
        method: "POST",
        credentials: "same-origin",
        redirect: "error",
        headers: {
          accept: "application/json",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          schema: "ad-market-teacher-playtest-reset",
          version: 1,
          operationId: input.operationId,
          confirmation: input.confirmation
        })
      });
    } catch {
      throw new TeacherPlaytestClientError("PLAYTEST_UNAVAILABLE", 503, true);
    }
    if (response.redirected) {
      throw new TeacherPlaytestClientError("PLAYTEST_UNAVAILABLE", 503, true);
    }
    if (!response.ok) throw await errorFor(response);
    const value = await readBoundedJson(response);
    if (
      !isRecord(value) ||
      !exactKeys(value, ["status", "operationId"]) ||
      value.status !== "reset" ||
      value.operationId !== input.operationId
    ) {
      throw new TeacherPlaytestClientError("INVALID_RESPONSE", 503, true);
    }
    return "reset";
  }
}

export function createTeacherPlaytestOperationId(): string {
  const value = crypto.randomUUID();
  if (!UUID_PATTERN.test(value)) {
    throw new AccountClientError("INVALID_REQUEST");
  }
  return value;
}
