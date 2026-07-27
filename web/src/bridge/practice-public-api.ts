import {
  LocalPracticeRecoverySchema,
  PRACTICE_BRIDGE_CONTRACT,
  PracticeRequestSchema,
  type LocalPracticeRecoveryV1,
  type PracticePublicApi,
  type PracticeRunHandler
} from "./practice-contracts";

interface PracticeResponse {
  contract: typeof PRACTICE_BRIDGE_CONTRACT;
  requestId: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string };
}

function requestIdFrom(value: unknown): string {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return "";
  const requestId = (value as Record<string, unknown>).requestId;
  return typeof requestId === "string" && requestId.length <= 128 ? requestId : "";
}

function assertJsonValue(value: unknown, path = "$", ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number`);
    return;
  }
  if (typeof value !== "object") throw new Error(`${path} contains a non-JSON value`);
  if (value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    throw new Error(`${path} contains binary data`);
  }
  if (ancestors.has(value)) throw new Error(`${path} contains a circular reference`);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      value.forEach((child, index) => assertJsonValue(child, `${path}[${index}]`, ancestors));
      return;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} contains a non-JSON object`);
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") throw new Error(`${path} contains a symbol key`);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw new Error(`${path}.${key} is not a plain JSON property`);
      }
      assertJsonValue(descriptor.value, `${path}.${key}`, ancestors);
    }
  } finally {
    ancestors.delete(value);
  }
}

function serialise(response: PracticeResponse): string {
  assertJsonValue(response);
  return JSON.stringify(response);
}

function success(requestId: string, payload: unknown): string {
  return serialise({ contract: PRACTICE_BRIDGE_CONTRACT, requestId, ok: true, payload });
}

function failure(requestId: string, code: string, message: string): string {
  return serialise({
    contract: PRACTICE_BRIDGE_CONTRACT,
    requestId,
    ok: false,
    error: { code, message: message.slice(0, 240) }
  });
}

function errorCode(error: unknown): string {
  if (error !== null && typeof error === "object") {
    const code = (error as Record<string, unknown>).code;
    if (typeof code === "string" && /^[A-Z][A-Z0-9_]{0,127}$/u.test(code)) return code;
  }
  return "HANDLER_ERROR";
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Practice recovery failed";
}

function parseRecovery(value: unknown): LocalPracticeRecoveryV1 {
  return LocalPracticeRecoverySchema.parse(structuredClone(value)) as LocalPracticeRecoveryV1;
}

function assertSameBase(
  recovery: LocalPracticeRecoveryV1,
  expected: { runId: string; documentId: string }
): void {
  if (recovery.checkpoint.runId !== expected.runId ||
    recovery.checkpoint.documentId !== expected.documentId) {
    throw new Error("Practice recovery identity does not match the request");
  }
}

export function createPracticePublicApi(handler: PracticeRunHandler): PracticePublicApi {
  const handle = async (requestJson: string): Promise<string> => {
    let decoded: unknown;
    try {
      decoded = JSON.parse(requestJson) as unknown;
    } catch {
      return failure("", "INVALID_REQUEST", "Request must be valid JSON");
    }
    const requestId = requestIdFrom(decoded);
    if (decoded !== null && typeof decoded === "object" && !Array.isArray(decoded)) {
      const contract = (decoded as Record<string, unknown>).contract;
      if (typeof contract === "string" && contract !== PRACTICE_BRIDGE_CONTRACT) {
        return failure(requestId, "UNSUPPORTED_CONTRACT", "Unsupported practice bridge contract");
      }
    }
    const parsed = PracticeRequestSchema.safeParse(decoded);
    if (!parsed.success) {
      return failure(
        requestId,
        "INVALID_REQUEST",
        parsed.error.issues[0]?.message ?? "Invalid practice request"
      );
    }
    try {
      const request = parsed.data;
      switch (request.method) {
        case "resume": {
          const value = await handler.resume();
          return success(request.requestId, value === null ? null : parseRecovery(value));
        }
        case "begin": {
          const recovery = parseRecovery(await handler.begin(
            request.payload.teamAlias,
            request.payload.operationId
          ));
          if (recovery.checkpoint.teamAlias !== request.payload.teamAlias ||
            recovery.checkpoint.operationId !== request.payload.operationId) {
            throw new Error("Practice begin result does not match the request");
          }
          return success(request.requestId, recovery);
        }
        case "setLock": {
          const recovery = parseRecovery(await handler.setLock(request.payload));
          const expected = request.payload.checkpoint;
          assertSameBase(recovery, expected);
          if (recovery.checkpoint.documentRevision !== expected.documentRevision + 1 ||
            recovery.checkpoint.sequence !== expected.sequence + 1 ||
            recovery.checkpoint.stage !== expected.stage ||
            recovery.checkpoint.levelLocked !== request.payload.levelLocked ||
            recovery.checkpoint.operationId !== request.payload.operationId) {
            throw new Error("Practice lock result does not match the request");
          }
          return success(request.requestId, recovery);
        }
        case "advance": {
          const recovery = parseRecovery(await handler.advance(request.payload));
          const expected = request.payload.checkpoint;
          assertSameBase(recovery, expected);
          if (recovery.checkpoint.documentRevision !== expected.documentRevision + 1 ||
            recovery.checkpoint.sequence !== expected.sequence + 1 ||
            recovery.checkpoint.stage !== request.payload.nextStage ||
            recovery.checkpoint.levelLocked ||
            recovery.checkpoint.operationId !== request.payload.operationId) {
            throw new Error("Practice advance result does not match the request");
          }
          return success(request.requestId, recovery);
        }
      }
    } catch (error) {
      const code = errorCode(error);
      const message = errorMessage(error).slice(0, 240);
      console.warn(`[AdMarket practice request failed] ${JSON.stringify({
        method: parsed.data.method,
        code,
        message
      })}`);
      return failure(requestId, code, message);
    }
  };
  return Object.freeze({ handle });
}
