import { createHash } from "node:crypto";
import {
  parseProductPriceGuide,
  type ProductPriceGuide
} from "../../../shared/product-price-guide-contract";

const MAX_CAS_ATTEMPTS = 12;
export const PRODUCT_PRICE_RESERVATION_TTL_SECONDS = 45;
const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_ID = /^[A-Za-z0-9._:-]+$/;

export interface ProductPriceGuideIdentity {
  sessionId: string;
  teamId: string;
}

export interface ProductPriceGuideStoredState {
  version: 1;
  documentId: string;
  productFingerprint: string;
  idempotencyKey: string;
  state: "reserved" | "complete" | "failed";
  createdAt: number;
  response?: ProductPriceGuide;
}

export interface ProductPriceGuideStateEntry {
  value: unknown;
  etag: string;
}

export interface ProductPriceGuideStateRepository {
  read(key: string): Promise<ProductPriceGuideStateEntry | null>;
  write(
    key: string,
    value: ProductPriceGuideStoredState,
    condition: { onlyIfNew: true } | { onlyIfMatch: string }
  ): Promise<boolean>;
}

export type ProductPriceGuideStateErrorCode =
  | "STATE_UNAVAILABLE"
  | "LOOKUP_IN_PROGRESS"
  | "IDEMPOTENCY_CONFLICT"
  | "ATTEMPT_NOT_FOUND";

export class ProductPriceGuideStateError extends Error {
  constructor(readonly code: ProductPriceGuideStateErrorCode) {
    super(code);
    this.name = "ProductPriceGuideStateError";
  }
}

function storageKey(identity: ProductPriceGuideIdentity, fingerprint: string): string {
  const digest = createHash("sha256")
    .update(identity.sessionId, "utf8")
    .update("\0")
    .update(identity.teamId, "utf8")
    .update("\0")
    .update(fingerprint, "utf8")
    .digest("hex");
  return `product/${digest}`;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length >= 1 && value.length <= 128 &&
    SAFE_ID.test(value);
}

function parseState(value: unknown): ProductPriceGuideStoredState {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ProductPriceGuideStateError("STATE_UNAVAILABLE");
  }
  const input = value as Record<string, unknown>;
  const expected = [
    "version",
    "documentId",
    "productFingerprint",
    "idempotencyKey",
    "state",
    "createdAt",
    ...(input.response === undefined ? [] : ["response"])
  ].sort();
  if (Object.keys(input).sort().join("\0") !== expected.join("\0") || input.version !== 1 ||
    !validId(input.documentId) || typeof input.productFingerprint !== "string" ||
    !SHA256.test(input.productFingerprint) || !validId(input.idempotencyKey) ||
    (input.state !== "reserved" && input.state !== "complete" && input.state !== "failed") ||
    !Number.isSafeInteger(input.createdAt) || (input.createdAt as number) <= 0) {
    throw new ProductPriceGuideStateError("STATE_UNAVAILABLE");
  }
  let response: ProductPriceGuide | undefined;
  if (input.state === "complete") {
    try {
      response = parseProductPriceGuide(input.response);
    } catch {
      throw new ProductPriceGuideStateError("STATE_UNAVAILABLE");
    }
    if (response.productFingerprint !== input.productFingerprint) {
      throw new ProductPriceGuideStateError("STATE_UNAVAILABLE");
    }
  } else if (input.response !== undefined) {
    throw new ProductPriceGuideStateError("STATE_UNAVAILABLE");
  }
  return {
    version: 1,
    documentId: input.documentId,
    productFingerprint: input.productFingerprint,
    idempotencyKey: input.idempotencyKey,
    state: input.state,
    createdAt: input.createdAt as number,
    ...(response === undefined ? {} : { response })
  };
}

export interface ProductPriceGuideReservation {
  created: boolean;
  attempt: ProductPriceGuideStoredState;
}

export class ProductPriceGuideStateService {
  constructor(private readonly repository: ProductPriceGuideStateRepository) {}

  async reserve(
    identity: ProductPriceGuideIdentity,
    input: {
      documentId: string;
      productFingerprint: string;
      idempotencyKey: string;
      nowSeconds: number;
    }
  ): Promise<ProductPriceGuideReservation> {
    const key = storageKey(identity, input.productFingerprint);
    for (let index = 0; index < MAX_CAS_ATTEMPTS; index += 1) {
      const entry = await this.repository.read(key);
      const current = entry === null ? null : parseState(entry.value);
      if (current?.state === "complete") {
        return { created: false, attempt: current };
      }
      if (current?.state === "reserved" &&
        input.nowSeconds - current.createdAt < PRODUCT_PRICE_RESERVATION_TTL_SECONDS) {
        if (current.idempotencyKey !== input.idempotencyKey) {
          throw new ProductPriceGuideStateError("LOOKUP_IN_PROGRESS");
        }
        return { created: false, attempt: current };
      }
      const attempt: ProductPriceGuideStoredState = {
        version: 1,
        documentId: input.documentId,
        productFingerprint: input.productFingerprint,
        idempotencyKey: input.idempotencyKey,
        state: "reserved",
        createdAt: input.nowSeconds
      };
      if (await this.repository.write(
        key,
        attempt,
        entry === null ? { onlyIfNew: true } : { onlyIfMatch: entry.etag }
      )) return { created: true, attempt };
    }
    throw new ProductPriceGuideStateError("STATE_UNAVAILABLE");
  }

  async complete(
    identity: ProductPriceGuideIdentity,
    productFingerprint: string,
    idempotencyKey: string,
    responseValue: ProductPriceGuide
  ): Promise<ProductPriceGuideStoredState> {
    const response = parseProductPriceGuide(responseValue);
    if (response.productFingerprint !== productFingerprint) {
      throw new ProductPriceGuideStateError("IDEMPOTENCY_CONFLICT");
    }
    return this.#update(identity, productFingerprint, idempotencyKey, (current) => {
      if (current.state === "complete") return current;
      if (current.state !== "reserved") {
        throw new ProductPriceGuideStateError("IDEMPOTENCY_CONFLICT");
      }
      return { ...current, state: "complete", response };
    });
  }

  async fail(
    identity: ProductPriceGuideIdentity,
    productFingerprint: string,
    idempotencyKey: string
  ): Promise<ProductPriceGuideStoredState> {
    return this.#update(identity, productFingerprint, idempotencyKey, (current) => {
      if (current.state !== "reserved") {
        throw new ProductPriceGuideStateError("IDEMPOTENCY_CONFLICT");
      }
      return { ...current, state: "failed" };
    });
  }

  async #update(
    identity: ProductPriceGuideIdentity,
    productFingerprint: string,
    idempotencyKey: string,
    update: (current: ProductPriceGuideStoredState) => ProductPriceGuideStoredState
  ): Promise<ProductPriceGuideStoredState> {
    const key = storageKey(identity, productFingerprint);
    for (let index = 0; index < MAX_CAS_ATTEMPTS; index += 1) {
      const entry = await this.repository.read(key);
      if (entry === null) throw new ProductPriceGuideStateError("ATTEMPT_NOT_FOUND");
      const current = parseState(entry.value);
      if (current.idempotencyKey !== idempotencyKey) {
        throw new ProductPriceGuideStateError("IDEMPOTENCY_CONFLICT");
      }
      const next = update(current);
      if (next === current) return current;
      if (await this.repository.write(key, next, { onlyIfMatch: entry.etag })) return next;
    }
    throw new ProductPriceGuideStateError("STATE_UNAVAILABLE");
  }
}

export class MemoryProductPriceGuideStateRepository implements ProductPriceGuideStateRepository {
  readonly #values = new Map<string, { value: ProductPriceGuideStoredState; etag: number }>();

  async read(key: string): Promise<ProductPriceGuideStateEntry | null> {
    const entry = this.#values.get(key);
    return entry ? { value: structuredClone(entry.value), etag: String(entry.etag) } : null;
  }

  async write(
    key: string,
    value: ProductPriceGuideStoredState,
    condition: { onlyIfNew: true } | { onlyIfMatch: string }
  ): Promise<boolean> {
    const existing = this.#values.get(key);
    if ("onlyIfNew" in condition) {
      if (existing) return false;
    } else if (!existing || String(existing.etag) !== condition.onlyIfMatch) {
      return false;
    }
    this.#values.set(key, { value: structuredClone(value), etag: (existing?.etag ?? 0) + 1 });
    return true;
  }
}
