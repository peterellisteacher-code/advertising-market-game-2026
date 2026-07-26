import { CampaignDocumentSchema } from "../domain/campaign-document";
import {
  CREATOR_BRIDGE_CONTRACT,
  CreatorRequestSchema,
  CreatorResponseSchema,
  type CreatorBridgeHandler,
  type CreatorMethod,
  type CreatorResponse,
  type PublishedCampaignJson
} from "./contracts";

export interface CreatorPublicApi {
  handle(requestJson: string): Promise<string>;
  showMessage(message: unknown): boolean;
}

export interface CreatorBridgeDiagnostic {
  readonly requestId: string;
  readonly method: CreatorMethod;
  readonly error: unknown;
}

function requestIdFrom(value: unknown): string {
  if (value === null || typeof value !== "object") return "";
  const requestId = (value as Record<string, unknown>).requestId;
  return typeof requestId === "string" && requestId.length <= 128 ? requestId : "";
}

function assertJsonValue(value: unknown, path = "$", ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} must contain a finite JSON number`);
    return;
  }
  if (typeof value !== "object") throw new Error(`${path} contains a non-JSON value`);
  if (value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    throw new Error(`${path} contains binary data outside the base64 publication field`);
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

function serialise(response: CreatorResponse): string {
  const parsed = CreatorResponseSchema.parse(response);
  assertJsonValue(parsed);
  return JSON.stringify(parsed);
}

function success(requestId: string, payload?: unknown): string {
  return serialise(payload === undefined
    ? { contract: CREATOR_BRIDGE_CONTRACT, requestId, ok: true }
    : { contract: CREATOR_BRIDGE_CONTRACT, requestId, ok: true, payload });
}

function failure(requestId: string, code: string, message: string): string {
  return serialise({
    contract: CREATOR_BRIDGE_CONTRACT,
    requestId,
    ok: false,
    error: { code, message }
  });
}

function publicationFailure(error: unknown): { code: string; message: string } {
  const message = error instanceof Error ? error.message : "";
  if (/\bprice\b/i.test(message)) {
    return {
      code: "PUBLICATION_REQUIREMENT",
      message: "Add one visible market price that matches your selected price."
    };
  }
  if (/swap control|both players|art director|strategist/i.test(message)) {
    return {
      code: "PUBLICATION_REQUIREMENT",
      message: "Both partners must make a recorded contribution before publishing."
    };
  }
  if (/(?:attention|interest|desire|action) evidence/i.test(message)) {
    return {
      code: "PUBLICATION_REQUIREMENT",
      message: "Complete all four AIDA parts before publishing."
    };
  }
  return {
    code: "CREATOR_OPERATION_FAILED",
    message: "The market card image could not be prepared. Your advertisement is still saved. Try again. If the same message appears, ask your teacher."
  };
}

function operationFailure(
  method: CreatorMethod,
  error: unknown
): { code: string; message: string } {
  if (method === "publish") return publicationFailure(error);
  const messages: Readonly<Record<Exclude<CreatorMethod, "publish">, string>> = {
    open: "The advertisement editor could not be opened. Try again.",
    loadLatest: "The saved advertisement could not be loaded. Try again.",
    getState: "The current advertisement could not be read. Try again.",
    save: "The draft could not be saved. Your work remains open. Try again.",
    close: "The advertisement editor could not be closed. Try again."
  };
  return { code: "CREATOR_OPERATION_FAILED", message: messages[method] };
}

function canonicalBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function publicationForJson(value: Awaited<ReturnType<CreatorBridgeHandler["publish"]>>): PublishedCampaignJson {
  if (!(value.pngBytes instanceof Uint8Array)) {
    throw new Error("Published campaign bytes must be a Uint8Array");
  }
  return {
    contract: value.contract,
    documentId: value.documentId,
    revision: value.revision,
    pngBase64: canonicalBase64(value.pngBytes),
    metadata: structuredClone(value.metadata)
  };
}

export function createCreatorPublicApi(
  handler: CreatorBridgeHandler,
  onMessage: (message: string) => void = () => undefined,
  onDiagnostic: (diagnostic: CreatorBridgeDiagnostic) => void = () => undefined
): CreatorPublicApi {
  const handle = async (requestJson: string): Promise<string> => {
    let decoded: unknown;
    try {
      decoded = JSON.parse(requestJson);
    } catch {
      return failure("", "INVALID_REQUEST", "Request must be valid JSON");
    }

    const requestId = requestIdFrom(decoded);
    if (decoded !== null && typeof decoded === "object") {
      const contract = (decoded as Record<string, unknown>).contract;
      if (typeof contract === "string" && contract !== CREATOR_BRIDGE_CONTRACT) {
        return failure(requestId, "UNSUPPORTED_CONTRACT", "Unsupported creator bridge contract");
      }
    }
    const result = CreatorRequestSchema.safeParse(decoded);
    if (!result.success) {
      return failure(requestId, "INVALID_REQUEST", result.error.issues[0]?.message ?? "Invalid request");
    }

    const request = result.data;
    try {
      switch (request.method) {
        case "open":
          await handler.open(CampaignDocumentSchema.parse(structuredClone(request.payload)));
          return success(request.requestId);
        case "loadLatest": {
          const latest = await handler.loadLatest(request.payload.documentId);
          return success(
            request.requestId,
            latest === null
              ? null
              : CampaignDocumentSchema.parse(structuredClone(latest))
          );
        }
        case "getState":
          return success(
            request.requestId,
            CampaignDocumentSchema.parse(structuredClone(await handler.getState()))
          );
        case "save":
          await handler.save();
          return success(request.requestId);
        case "publish":
          return success(request.requestId, publicationForJson(await handler.publish()));
        case "close":
          await handler.close();
          return success(request.requestId);
      }
    } catch (error) {
      try {
        onDiagnostic({ requestId, method: request.method, error });
      } catch {
        // Diagnostics must never alter the public response.
      }
      const mapped = operationFailure(request.method, error);
      return failure(requestId, mapped.code, mapped.message);
    }
  };

  const showMessage = (message: unknown): boolean => {
    if (typeof message !== "string" || message !== message.trim() ||
      message.length === 0 || message.length > 280) return false;
    try {
      onMessage(message);
      return true;
    } catch {
      return false;
    }
  };

  return Object.freeze({ handle, showMessage });
}
