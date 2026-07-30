import { createHash } from "node:crypto";
import type { ImageLabStage } from "./image-lab-auth";

const MAX_CAS_ATTEMPTS = 12;
const MAX_JOBS_PER_ACCOUNT = 32;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type ImageLabJobState =
  | "reserving"
  | "reserved"
  | "submitting"
  | "submitted"
  | "uncertain"
  | "completed"
  | "refunded"
  | "denied";

export interface ImageLabStoredJob {
  id: string;
  requestHash: string;
  stage: ImageLabStage;
  profileId: string;
  state: ImageLabJobState;
  requestId?: string;
  createdAt: number;
}

export interface ImageLabAccountState {
  version: 2;
  jobs: Readonly<Record<string, ImageLabStoredJob>>;
}

export interface ImageLabStateEntry {
  value: unknown;
  etag: string;
}

export interface ImageLabStateRepository {
  read(key: string): Promise<ImageLabStateEntry | null>;
  write(
    key: string,
    value: ImageLabAccountState,
    condition: { onlyIfNew: true } | { onlyIfMatch: string }
  ): Promise<boolean>;
}

export interface ImageLabAccountIdentity {
  userId: string;
}

export interface ImageLabJobReservation {
  created: boolean;
  stored: ImageLabStoredJob;
}

export interface ImageLabSubmissionClaim {
  began: boolean;
  stored: ImageLabStoredJob;
}

export type ImageLabStateErrorCode =
  | "STATE_UNAVAILABLE"
  | "IDEMPOTENCY_CONFLICT"
  | "JOB_NOT_FOUND"
  | "JOB_LIMIT_REACHED"
  | "INVALID_TRANSITION";

export class ImageLabStateError extends Error {
  constructor(readonly code: ImageLabStateErrorCode) {
    super(code);
    this.name = "ImageLabStateError";
  }
}

const accountKey = ({ userId }: ImageLabAccountIdentity): string =>
  `account/${createHash("sha256").update(userId, "utf8").digest("hex")}`;

const validJob = (value: unknown): value is ImageLabStoredJob => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const required = ["createdAt", "id", "profileId", "requestHash", "stage", "state"];
  const withRequest = [...required, "requestId"].sort();
  if (keys.join("\0") !== required.sort().join("\0") && keys.join("\0") !== withRequest.join("\0")) {
    return false;
  }
  return typeof record.id === "string" && UUID_PATTERN.test(record.id) &&
    typeof record.requestHash === "string" && /^[0-9a-f]{64}$/.test(record.requestHash) &&
    typeof record.profileId === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(record.profileId) &&
    (record.stage === "object-forge" || record.stage === "make-it-real") &&
    (
      record.state === "reserving" ||
      record.state === "reserved" ||
      record.state === "submitting" ||
      record.state === "submitted" ||
      record.state === "uncertain" ||
      record.state === "completed" ||
      record.state === "refunded" ||
      record.state === "denied"
    ) &&
    Number.isSafeInteger(record.createdAt) && (record.createdAt as number) > 0 &&
    (record.requestId === undefined || typeof record.requestId === "string" && UUID_PATTERN.test(record.requestId)) &&
    (record.state !== "submitted" || typeof record.requestId === "string");
};

function parseState(value: unknown): ImageLabAccountState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ImageLabStateError("STATE_UNAVAILABLE");
  }
  const record = value as Record<string, unknown>;
  const jobs = record.jobs;
  if (record.version !== 2 || typeof jobs !== "object" || jobs === null || Array.isArray(jobs)) {
    throw new ImageLabStateError("STATE_UNAVAILABLE");
  }
  const jobEntries = Object.entries(jobs as Record<string, unknown>);
  if (jobEntries.length > MAX_JOBS_PER_ACCOUNT ||
    jobEntries.some(([id, job]) => !UUID_PATTERN.test(id) || !validJob(job) || job.id !== id)) {
    throw new ImageLabStateError("STATE_UNAVAILABLE");
  }
  return {
    version: 2,
    jobs: Object.fromEntries(jobEntries) as Record<string, ImageLabStoredJob>
  };
}

export class ImageLabStateService {
  constructor(private readonly repository: ImageLabStateRepository) {}

  async reserve(
    identity: ImageLabAccountIdentity,
    input: {
      idempotencyKey: string;
      requestHash: string;
      stage: ImageLabStage;
      profileId: string;
      nowSeconds: number;
    }
  ): Promise<ImageLabJobReservation> {
    const key = accountKey(identity);
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const entry = await this.repository.read(key);
      if (entry === null) {
        const stored: ImageLabStoredJob = {
          id: input.idempotencyKey,
          requestHash: input.requestHash,
          stage: input.stage,
          profileId: input.profileId,
          state: "reserving",
          createdAt: input.nowSeconds
        };
        const created: ImageLabAccountState = {
          version: 2,
          jobs: { [stored.id]: stored }
        };
        if (await this.repository.write(key, created, { onlyIfNew: true })) {
          return { created: true, stored };
        }
        continue;
      }
      const current = parseState(entry.value);
      const existing = current.jobs[input.idempotencyKey];
      if (existing) {
        if (existing.requestHash !== input.requestHash || existing.stage !== input.stage ||
          existing.profileId !== input.profileId) {
          throw new ImageLabStateError("IDEMPOTENCY_CONFLICT");
        }
        return { created: false, stored: existing };
      }
      if (Object.keys(current.jobs).length >= MAX_JOBS_PER_ACCOUNT) {
        throw new ImageLabStateError("JOB_LIMIT_REACHED");
      }
      const stored: ImageLabStoredJob = {
        id: input.idempotencyKey,
        requestHash: input.requestHash,
        stage: input.stage,
        profileId: input.profileId,
        state: "reserving",
        createdAt: input.nowSeconds
      };
      const next: ImageLabAccountState = {
        ...current,
        jobs: { ...current.jobs, [stored.id]: stored }
      };
      if (await this.repository.write(key, next, { onlyIfMatch: entry.etag })) {
        return { created: true, stored };
      }
    }
    throw new ImageLabStateError("STATE_UNAVAILABLE");
  }

  async markReserved(
    identity: ImageLabAccountIdentity,
    jobId: string
  ): Promise<ImageLabStoredJob> {
    return this.updateJob(identity, jobId, (stored) => {
      if (stored.state === "reserved") return stored;
      if (stored.state !== "reserving") throw new ImageLabStateError("INVALID_TRANSITION");
      return { ...stored, state: "reserved" };
    });
  }

  async beginSubmission(
    identity: ImageLabAccountIdentity,
    jobId: string
  ): Promise<ImageLabSubmissionClaim> {
    const key = accountKey(identity);
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const entry = await this.repository.read(key);
      if (entry === null) throw new ImageLabStateError("JOB_NOT_FOUND");
      const current = parseState(entry.value);
      const stored = current.jobs[jobId];
      if (!stored) throw new ImageLabStateError("JOB_NOT_FOUND");
      if (stored.state !== "reserved") return { began: false, stored };
      const submitting: ImageLabStoredJob = { ...stored, state: "submitting" };
      const next = { ...current, jobs: { ...current.jobs, [jobId]: submitting } };
      if (await this.repository.write(key, next, { onlyIfMatch: entry.etag })) {
        return { began: true, stored: submitting };
      }
    }
    throw new ImageLabStateError("STATE_UNAVAILABLE");
  }

  async attachRequest(
    identity: ImageLabAccountIdentity,
    jobId: string,
    requestId: string
  ): Promise<ImageLabStoredJob> {
    return this.updateJob(identity, jobId, (stored) => {
      if (stored.requestId !== undefined && stored.requestId !== requestId) {
        throw new ImageLabStateError("IDEMPOTENCY_CONFLICT");
      }
      if (
        stored.state !== "submitting" &&
        !(stored.state === "uncertain" && stored.requestId === undefined) &&
        stored.state !== "submitted"
      ) {
        throw new ImageLabStateError("INVALID_TRANSITION");
      }
      if (stored.state === "submitted" && stored.requestId === requestId) return stored;
      return { ...stored, state: "submitted", requestId };
    });
  }

  async markUncertain(
    identity: ImageLabAccountIdentity,
    jobId: string,
    requestId?: string
  ): Promise<ImageLabStoredJob> {
    return this.updateJob(identity, jobId, (stored) => {
      if (stored.requestId !== undefined && requestId !== undefined &&
        stored.requestId !== requestId) {
        throw new ImageLabStateError("IDEMPOTENCY_CONFLICT");
      }
      if (stored.state === "completed" || stored.state === "refunded" ||
        stored.state === "denied") {
        throw new ImageLabStateError("INVALID_TRANSITION");
      }
      const nextRequestId = requestId ?? stored.requestId;
      if (stored.state === "uncertain" && nextRequestId === stored.requestId) return stored;
      return {
        ...stored,
        state: "uncertain",
        ...(nextRequestId === undefined ? {} : { requestId: nextRequestId })
      };
    });
  }

  async markCompleted(
    identity: ImageLabAccountIdentity,
    jobId: string
  ): Promise<ImageLabStoredJob> {
    return this.markTerminal(identity, jobId, "completed", ["submitted", "uncertain"]);
  }

  async markRefunded(
    identity: ImageLabAccountIdentity,
    jobId: string
  ): Promise<ImageLabStoredJob> {
    return this.markTerminal(
      identity,
      jobId,
      "refunded",
      ["reserving", "reserved", "submitting", "submitted", "uncertain"]
    );
  }

  async markDenied(
    identity: ImageLabAccountIdentity,
    jobId: string
  ): Promise<ImageLabStoredJob> {
    return this.markTerminal(identity, jobId, "denied", ["reserving"]);
  }

  async getJob(identity: ImageLabAccountIdentity, jobId: string): Promise<ImageLabStoredJob> {
    const entry = await this.repository.read(accountKey(identity));
    if (entry === null) throw new ImageLabStateError("JOB_NOT_FOUND");
    const stored = parseState(entry.value).jobs[jobId];
    if (!stored) throw new ImageLabStateError("JOB_NOT_FOUND");
    return stored;
  }

  private async markTerminal(
    identity: ImageLabAccountIdentity,
    jobId: string,
    terminal: Extract<ImageLabJobState, "completed" | "refunded" | "denied">,
    allowed: readonly ImageLabJobState[]
  ): Promise<ImageLabStoredJob> {
    return this.updateJob(identity, jobId, (stored) => {
      if (stored.state === terminal) return stored;
      if (!allowed.includes(stored.state)) throw new ImageLabStateError("INVALID_TRANSITION");
      return { ...stored, state: terminal };
    });
  }

  private async updateJob(
    identity: ImageLabAccountIdentity,
    jobId: string,
    update: (stored: ImageLabStoredJob) => ImageLabStoredJob
  ): Promise<ImageLabStoredJob> {
    const key = accountKey(identity);
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const entry = await this.repository.read(key);
      if (entry === null) throw new ImageLabStateError("JOB_NOT_FOUND");
      const current = parseState(entry.value);
      const stored = current.jobs[jobId];
      if (!stored) throw new ImageLabStateError("JOB_NOT_FOUND");
      const nextStored = update(stored);
      if (nextStored === stored) return stored;
      const next = { ...current, jobs: { ...current.jobs, [jobId]: nextStored } };
      if (await this.repository.write(key, next, { onlyIfMatch: entry.etag })) return nextStored;
    }
    throw new ImageLabStateError("STATE_UNAVAILABLE");
  }
}

export class MemoryImageLabStateRepository implements ImageLabStateRepository {
  readonly #values = new Map<string, { value: ImageLabAccountState; etag: number }>();

  async read(key: string): Promise<ImageLabStateEntry | null> {
    const entry = this.#values.get(key);
    return entry ? { value: structuredClone(entry.value), etag: String(entry.etag) } : null;
  }

  async write(
    key: string,
    value: ImageLabAccountState,
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
