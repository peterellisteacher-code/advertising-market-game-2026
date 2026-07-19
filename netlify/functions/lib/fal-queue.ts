export class FalQueueError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "FalQueueError";
  }
}

interface FalRequestIdentity {
  fetch: typeof fetch;
  falKey: string;
  modelId: string;
  signal: AbortSignal;
}

interface FalJobIdentity extends FalRequestIdentity {
  requestId: string;
}

interface SubmitFalJobInput extends FalRequestIdentity {
  input: Readonly<Record<string, unknown>>;
  startTimeoutSeconds: number;
}

export type FalJobStatus =
  | { status: "queued"; position?: number }
  | { status: "working" }
  | { status: "completed" }
  | { status: "failed" };

const MODEL_ID = /^[a-z0-9][a-z0-9.-]*\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const REQUEST_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_JSON_BYTES = 1_048_576;

function validateModelId(value: string): void {
  if (!MODEL_ID.test(value) || value.includes("..") || value.includes("//")) {
    throw new FalQueueError("INVALID_MODEL", "fal model ID is invalid");
  }
}

function validateRequestId(value: string): void {
  if (!REQUEST_ID.test(value)) throw new FalQueueError("INVALID_REQUEST_ID", "fal request ID is invalid");
}

const ownRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

async function readJson(response: Response): Promise<unknown> {
  const declared = response.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_JSON_BYTES)) {
    throw new FalQueueError("INVALID_RESPONSE", "fal response is invalid");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_JSON_BYTES) {
    throw new FalQueueError("INVALID_RESPONSE", "fal response is invalid");
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new FalQueueError("INVALID_RESPONSE", "fal response is invalid");
  }
}

const headers = (falKey: string, startTimeoutSeconds?: number): Record<string, string> => ({
  authorization: `Key ${falKey}`,
  "content-type": "application/json",
  "x-fal-store-io": "0",
  "x-fal-object-lifecycle-preference": '{"expiration_duration_seconds":3600}',
  "x-fal-no-retry": "1",
  "x-app-fal-disable-fallback": "true",
  ...(startTimeoutSeconds === undefined
    ? {}
    : { "x-fal-request-timeout": String(startTimeoutSeconds) })
});

async function checkedFetch(
  fetcher: typeof fetch,
  input: string,
  init: RequestInit
): Promise<Response> {
  let response: Response;
  try {
    response = await fetcher(input, init);
  } catch {
    throw new FalQueueError("UPSTREAM_UNAVAILABLE", "fal request failed");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new FalQueueError("UPSTREAM_ERROR", `fal returned status ${response.status}`);
  }
  return response;
}

export async function submitFalJob(input: SubmitFalJobInput): Promise<string> {
  validateModelId(input.modelId);
  if (!Number.isInteger(input.startTimeoutSeconds) || input.startTimeoutSeconds < 1 ||
    input.startTimeoutSeconds > 300) {
    throw new FalQueueError("INVALID_TIMEOUT", "fal start timeout is invalid");
  }
  const response = await checkedFetch(input.fetch, `https://queue.fal.run/${input.modelId}`, {
    method: "POST",
    redirect: "error",
    signal: input.signal,
    headers: headers(input.falKey, input.startTimeoutSeconds),
    body: JSON.stringify(input.input)
  });
  const record = ownRecord(await readJson(response));
  const requestId = record?.request_id;
  if (typeof requestId !== "string" || !REQUEST_ID.test(requestId)) {
    throw new FalQueueError("INVALID_RESPONSE", "fal queue response is invalid");
  }
  return requestId;
}

export async function falJobStatus(input: FalJobIdentity): Promise<FalJobStatus> {
  validateModelId(input.modelId);
  validateRequestId(input.requestId);
  const response = await checkedFetch(
    input.fetch,
    `https://queue.fal.run/${input.modelId}/requests/${input.requestId}/status`,
    {
      method: "GET",
      redirect: "error",
      signal: input.signal,
      headers: headers(input.falKey)
    }
  );
  const record = ownRecord(await readJson(response));
  if (!record || record.request_id !== input.requestId) {
    throw new FalQueueError("INVALID_RESPONSE", "fal status response is invalid");
  }
  switch (record.status) {
    case "IN_QUEUE":
      return Number.isInteger(record.queue_position) && (record.queue_position as number) >= 0
        ? { status: "queued", position: record.queue_position as number }
        : { status: "queued" };
    case "IN_PROGRESS":
      return { status: "working" };
    case "COMPLETED":
      return typeof record.error === "string" && record.error ? { status: "failed" } : { status: "completed" };
    default:
      throw new FalQueueError("INVALID_RESPONSE", "fal status response is invalid");
  }
}

function safeFalMediaUrl(value: unknown): string {
  if (typeof value !== "string") throw new FalQueueError("INVALID_RESPONSE", "fal media URL is invalid");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new FalQueueError("INVALID_RESPONSE", "fal media URL is invalid");
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash ||
    !(host === "fal.media" || host.endsWith(".fal.media"))) {
    throw new FalQueueError("INVALID_RESPONSE", "fal media URL is invalid");
  }
  return url.href;
}

export async function falImageUrl(input: FalJobIdentity): Promise<string> {
  validateModelId(input.modelId);
  validateRequestId(input.requestId);
  const response = await checkedFetch(
    input.fetch,
    `https://queue.fal.run/${input.modelId}/requests/${input.requestId}`,
    {
      method: "GET",
      redirect: "error",
      signal: input.signal,
      headers: headers(input.falKey)
    }
  );
  const record = ownRecord(await readJson(response));
  const images = record?.images;
  if (!Array.isArray(images) || images.length !== 1) {
    throw new FalQueueError("INVALID_RESPONSE", "fal image response is invalid");
  }
  const image = ownRecord(images[0]);
  return safeFalMediaUrl(image?.url);
}
