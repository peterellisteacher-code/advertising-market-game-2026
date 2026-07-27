import { createHash } from "node:crypto";
import type {
  ImageLabLedgerRpcInput,
  SupabaseAccountClient
} from "./account-backend";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const ALIAS = /^[a-z0-9][a-z0-9_-]{2,23}$/u;
const MAX_ALLOWANCE = 100;
const MAX_ACCOUNTS = 1_000;

export type ImageLabAllowanceStage = "object" | "realise";
export type ImageLabAllowanceStatus =
  | "available"
  | "disabled"
  | "reserved"
  | "completed"
  | "refunded"
  | "uncertain";

export interface ImageLabAllowanceCounts {
  readonly granted: number;
  readonly consumed: number;
  readonly reserved: number;
  readonly remaining: number;
}

export interface ImageLabAllowanceSnapshot {
  readonly status: ImageLabAllowanceStatus;
  readonly enabled: boolean;
  readonly object: ImageLabAllowanceCounts;
  readonly realise: ImageLabAllowanceCounts;
}

export interface TeacherImageLabAccount {
  readonly alias: string;
  readonly object: ImageLabAllowanceCounts;
  readonly realise: ImageLabAllowanceCounts;
}

interface MutationIdentity {
  readonly operationId: string;
  readonly requestHash: string;
}

export type SetImageLabGlobalInput =
  | (MutationIdentity & {
      readonly target: "enabled";
      readonly enabled: boolean;
    })
  | (MutationIdentity & {
      readonly target: "default";
      readonly stage: ImageLabAllowanceStage;
      readonly amount: number;
    });

export interface SetImageLabAllowanceInput extends MutationIdentity {
  readonly userId: string;
  readonly stage: ImageLabAllowanceStage;
  readonly amount: number;
}

export type AddImageLabAllowanceInput = SetImageLabAllowanceInput;
export type RevokeImageLabAllowanceInput = SetImageLabAllowanceInput;

export interface ReserveImageLabAllowanceInput extends MutationIdentity {
  readonly userId: string;
  readonly stage: ImageLabAllowanceStage;
  readonly jobKey: string;
}

export type TerminalImageLabReservationInput = ReserveImageLabAllowanceInput;
export type ImageLabReservation = ImageLabAllowanceSnapshot;

export interface ImageLabAllowanceStore {
  status(userId: string): Promise<ImageLabAllowanceSnapshot>;
  globalStatus(): Promise<ImageLabAllowanceSnapshot>;
  list(): Promise<readonly TeacherImageLabAccount[]>;
  setGlobal(input: SetImageLabGlobalInput): Promise<ImageLabAllowanceSnapshot>;
  set(input: SetImageLabAllowanceInput): Promise<ImageLabAllowanceSnapshot>;
  add(input: AddImageLabAllowanceInput): Promise<ImageLabAllowanceSnapshot>;
  revoke(input: RevokeImageLabAllowanceInput): Promise<ImageLabAllowanceSnapshot>;
  reserve(input: ReserveImageLabAllowanceInput): Promise<ImageLabReservation>;
  complete(input: TerminalImageLabReservationInput): Promise<ImageLabReservation>;
  refund(input: TerminalImageLabReservationInput): Promise<ImageLabReservation>;
  markUncertain(input: TerminalImageLabReservationInput): Promise<ImageLabReservation>;
}

export class ImageLabAllowanceStoreError extends Error {
  constructor(readonly code: "IMAGE_LAB_ALLOWANCE_INVALID" | "IMAGE_LAB_ALLOWANCE_UNAVAILABLE") {
    super(code);
    this.name = "ImageLabAllowanceStoreError";
  }
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
};

function invalid(): never {
  throw new ImageLabAllowanceStoreError("IMAGE_LAB_ALLOWANCE_INVALID");
}

function unavailable(): never {
  throw new ImageLabAllowanceStoreError("IMAGE_LAB_ALLOWANCE_UNAVAILABLE");
}

const assertMutationIdentity = (input: MutationIdentity): void => {
  if (
    typeof input.operationId !== "string" ||
    !SAFE_ID.test(input.operationId) ||
    typeof input.requestHash !== "string" ||
    !SHA256.test(input.requestHash)
  ) invalid();
};

function assertStage(value: unknown): asserts value is ImageLabAllowanceStage {
  if (value !== "object" && value !== "realise") invalid();
}

function assertUserId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !UUID.test(value)) invalid();
}

function assertAmount(value: unknown, minimum: number): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > MAX_ALLOWANCE
  ) invalid();
}

const parseCounts = (value: unknown): ImageLabAllowanceCounts => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(
    candidate,
    ["granted", "consumed", "reserved", "remaining"]
  )) unavailable();
  const { granted, consumed, reserved, remaining } = candidate;
  if (
    ![granted, consumed, reserved, remaining].every((count) =>
      typeof count === "number" &&
      Number.isInteger(count) &&
      count >= 0 &&
      count <= MAX_ALLOWANCE
    ) ||
    (consumed as number) + (reserved as number) > (granted as number) ||
    remaining !== (granted as number) - (consumed as number) - (reserved as number)
  ) unavailable();
  return {
    granted: granted as number,
    consumed: consumed as number,
    reserved: reserved as number,
    remaining: remaining as number
  };
};

const parseSnapshot = (value: unknown): ImageLabAllowanceSnapshot => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(
    candidate,
    ["status", "enabled", "object", "realise"]
  )) unavailable();
  if (
    candidate.status !== "available" &&
    candidate.status !== "disabled" &&
    candidate.status !== "reserved" &&
    candidate.status !== "completed" &&
    candidate.status !== "refunded" &&
    candidate.status !== "uncertain"
  ) unavailable();
  if (typeof candidate.enabled !== "boolean") unavailable();
  if (candidate.status === "disabled" && candidate.enabled) unavailable();
  return {
    status: candidate.status,
    enabled: candidate.enabled,
    object: parseCounts(candidate.object),
    realise: parseCounts(candidate.realise)
  };
};

const parseAccount = (value: unknown): TeacherImageLabAccount => {
  const candidate = record(value);
  if (
    candidate === null ||
    !hasExactKeys(candidate, ["alias", "object", "realise"]) ||
    typeof candidate.alias !== "string" ||
    !ALIAS.test(candidate.alias) ||
    candidate.alias === "teacher-playtest"
  ) unavailable();
  return {
    alias: candidate.alias,
    object: parseCounts(candidate.object),
    realise: parseCounts(candidate.realise)
  };
};

const readIdentity = (
  ledgerOperation: "status" | "global_status" | "list",
  userId?: string
): Pick<ImageLabLedgerRpcInput, "operationId" | "requestHash"> => {
  const requestHash = createHash("sha256")
    .update(JSON.stringify({
      schema: "advertising-game-image-lab-read",
      version: 1,
      ledgerOperation,
      userId: userId ?? null
    }))
    .digest("hex");
  return {
    operationId: `${ledgerOperation.replace("_", "-")}:${requestHash}`,
    requestHash
  };
};

const parseList = (value: unknown): readonly TeacherImageLabAccount[] => {
  const candidate = record(value);
  if (candidate === null || !hasExactKeys(
    candidate,
    ["status", "enabled", "object", "realise", "accounts"]
  ) || !Array.isArray(candidate.accounts) || candidate.accounts.length > MAX_ACCOUNTS) {
    unavailable();
  }
  parseSnapshot({
    status: candidate.status,
    enabled: candidate.enabled,
    object: candidate.object,
    realise: candidate.realise
  });
  const accounts = candidate.accounts.map(parseAccount);
  const aliases = new Set(accounts.map(({ alias }) => alias));
  if (aliases.size !== accounts.length) unavailable();
  return accounts;
};

export class SupabaseImageLabAllowanceStore implements ImageLabAllowanceStore {
  constructor(
    private readonly client: Pick<SupabaseAccountClient, "imageLabRpc">
  ) {}

  async status(userId: string): Promise<ImageLabAllowanceSnapshot> {
    assertUserId(userId);
    return parseSnapshot(await this.client.imageLabRpc({
      userId,
      ledgerOperation: "status",
      ...readIdentity("status", userId)
    }));
  }

  async globalStatus(): Promise<ImageLabAllowanceSnapshot> {
    return parseSnapshot(await this.client.imageLabRpc({
      ledgerOperation: "global_status",
      ...readIdentity("global_status")
    }));
  }

  async list(): Promise<readonly TeacherImageLabAccount[]> {
    return parseList(await this.client.imageLabRpc({
      ledgerOperation: "list",
      ...readIdentity("list")
    }));
  }

  async setGlobal(input: SetImageLabGlobalInput): Promise<ImageLabAllowanceSnapshot> {
    const candidate = record(input);
    if (candidate === null || (
      input.target === "enabled"
        ? !hasExactKeys(candidate, ["target", "enabled", "operationId", "requestHash"]) ||
          typeof input.enabled !== "boolean"
        : input.target === "default"
          ? !hasExactKeys(
              candidate,
              ["target", "stage", "amount", "operationId", "requestHash"]
            )
          : true
    )) invalid();
    assertMutationIdentity(input);
    if (input.target === "enabled") {
      return parseSnapshot(await this.client.imageLabRpc({
        ledgerOperation: "set_global",
        amount: input.enabled ? 1 : 0,
        operationId: input.operationId,
        requestHash: input.requestHash
      }));
    }
    assertStage(input.stage);
    assertAmount(input.amount, 0);
    return parseSnapshot(await this.client.imageLabRpc({
      ledgerOperation: "set_global",
      stage: input.stage,
      amount: input.amount,
      operationId: input.operationId,
      requestHash: input.requestHash
    }));
  }

  async set(input: SetImageLabAllowanceInput): Promise<ImageLabAllowanceSnapshot> {
    return this.accountMutation("set", input, 0);
  }

  async add(input: AddImageLabAllowanceInput): Promise<ImageLabAllowanceSnapshot> {
    return this.accountMutation("add", input, 1);
  }

  async revoke(input: RevokeImageLabAllowanceInput): Promise<ImageLabAllowanceSnapshot> {
    return this.accountMutation("revoke", input, 1);
  }

  async reserve(input: ReserveImageLabAllowanceInput): Promise<ImageLabReservation> {
    return this.reservationMutation("reserve", input);
  }

  async complete(input: TerminalImageLabReservationInput): Promise<ImageLabReservation> {
    return this.reservationMutation("complete", input);
  }

  async refund(input: TerminalImageLabReservationInput): Promise<ImageLabReservation> {
    return this.reservationMutation("refund", input);
  }

  async markUncertain(input: TerminalImageLabReservationInput): Promise<ImageLabReservation> {
    return this.reservationMutation("mark_uncertain", input);
  }

  private async accountMutation(
    ledgerOperation: "set" | "add" | "revoke",
    input: SetImageLabAllowanceInput,
    minimum: number
  ): Promise<ImageLabAllowanceSnapshot> {
    const candidate = record(input);
    if (candidate === null || !hasExactKeys(
      candidate,
      ["userId", "stage", "amount", "operationId", "requestHash"]
    )) invalid();
    assertUserId(input.userId);
    assertStage(input.stage);
    assertAmount(input.amount, minimum);
    assertMutationIdentity(input);
    return parseSnapshot(await this.client.imageLabRpc({
      userId: input.userId,
      ledgerOperation,
      stage: input.stage,
      amount: input.amount,
      operationId: input.operationId,
      requestHash: input.requestHash
    }));
  }

  private async reservationMutation(
    ledgerOperation: "reserve" | "complete" | "refund" | "mark_uncertain",
    input: ReserveImageLabAllowanceInput
  ): Promise<ImageLabReservation> {
    const candidate = record(input);
    if (candidate === null || !hasExactKeys(
      candidate,
      ["userId", "stage", "operationId", "jobKey", "requestHash"]
    )) invalid();
    assertUserId(input.userId);
    assertStage(input.stage);
    assertMutationIdentity(input);
    if (typeof input.jobKey !== "string" || !SAFE_ID.test(input.jobKey)) invalid();
    return parseSnapshot(await this.client.imageLabRpc({
      userId: input.userId,
      ledgerOperation,
      stage: input.stage,
      amount: 1,
      operationId: input.operationId,
      jobKey: input.jobKey,
      requestHash: input.requestHash
    }));
  }
}
