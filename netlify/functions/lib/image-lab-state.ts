import { createHash } from "node:crypto";
import type { ImageLabStage } from "./image-lab-auth";

const MAX_CAS_ATTEMPTS = 12;
const MAX_JOBS_PER_PAIR = 32;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type ImageLabJobState = "submitting" | "submitted" | "indeterminate";

export interface ImageLabStoredJob {
  id: string;
  requestHash: string;
  stage: ImageLabStage;
  profileId: string;
  state: ImageLabJobState;
  requestId?: string;
  createdAt: number;
}

export interface ImageLabPairState {
  version: 1;
  remainingObject: number;
  remainingRealise: number;
  expiresAt: number;
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
    value: ImageLabPairState,
    condition: { onlyIfNew: true } | { onlyIfMatch: string }
  ): Promise<boolean>;
}

export interface ImageLabPairIdentity {
  sessionId: string;
  teamId: string;
}

export interface ImageLabRemainingState {
  object: number;
  realise: number;
  expiresAt: number;
}

export interface ImageLabJobReservation extends ImageLabRemainingState {
  created: boolean;
  job: ImageLabStoredJob;
}

export type ImageLabStateErrorCode =
  | "STATE_UNAVAILABLE"
  | "PAIR_NOT_UNLOCKED"
  | "SESSION_EXPIRED"
  | "ALLOWANCE_EXHAUSTED"
  | "IDEMPOTENCY_CONFLICT"
  | "JOB_NOT_FOUND";

export class ImageLabStateError extends Error {
  constructor(readonly code: ImageLabStateErrorCode) {
    super(code);
    this.name = "ImageLabStateError";
  }
}

const pairKey = ({ sessionId, teamId }: ImageLabPairIdentity): string =>
  `pair/${createHash("sha256").update(sessionId, "utf8").update("\0").update(teamId, "utf8").digest("hex")}`;

const validCount = (value: unknown, maximum: number): value is number =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) <= maximum;

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
    (record.state === "submitting" || record.state === "submitted" || record.state === "indeterminate") &&
    Number.isSafeInteger(record.createdAt) && (record.createdAt as number) > 0 &&
    (record.requestId === undefined || typeof record.requestId === "string" && UUID_PATTERN.test(record.requestId)) &&
    (record.state !== "submitted" || typeof record.requestId === "string");
};

function parseState(value: unknown): ImageLabPairState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ImageLabStateError("STATE_UNAVAILABLE");
  }
  const record = value as Record<string, unknown>;
  const jobs = record.jobs;
  if (record.version !== 1 || !validCount(record.remainingObject, 12) ||
    !validCount(record.remainingRealise, 4) || !Number.isSafeInteger(record.expiresAt) ||
    (record.expiresAt as number) <= 0 || typeof jobs !== "object" || jobs === null || Array.isArray(jobs)) {
    throw new ImageLabStateError("STATE_UNAVAILABLE");
  }
  const jobEntries = Object.entries(jobs as Record<string, unknown>);
  if (jobEntries.length > MAX_JOBS_PER_PAIR ||
    jobEntries.some(([id, job]) => !UUID_PATTERN.test(id) || !validJob(job) || job.id !== id)) {
    throw new ImageLabStateError("STATE_UNAVAILABLE");
  }
  return {
    version: 1,
    remainingObject: record.remainingObject,
    remainingRealise: record.remainingRealise,
    expiresAt: record.expiresAt as number,
    jobs: Object.fromEntries(jobEntries) as Record<string, ImageLabStoredJob>
  };
}

const remaining = (state: ImageLabPairState): ImageLabRemainingState => ({
  object: state.remainingObject,
  realise: state.remainingRealise,
  expiresAt: state.expiresAt
});

export class ImageLabStateService {
  constructor(private readonly repository: ImageLabStateRepository) {}

  async unlock(
    identity: ImageLabPairIdentity,
    input: { objectAllowance: number; realiseAllowance: number; expiresAt: number }
  ): Promise<ImageLabRemainingState> {
    const key = pairKey(identity);
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const entry = await this.repository.read(key);
      if (entry === null) {
        const created: ImageLabPairState = {
          version: 1,
          remainingObject: input.objectAllowance,
          remainingRealise: input.realiseAllowance,
          expiresAt: input.expiresAt,
          jobs: {}
        };
        if (await this.repository.write(key, created, { onlyIfNew: true })) return remaining(created);
        continue;
      }
      const current = parseState(entry.value);
      const renewed = { ...current, expiresAt: Math.max(current.expiresAt, input.expiresAt) };
      if (renewed.expiresAt === current.expiresAt) return remaining(current);
      if (await this.repository.write(key, renewed, { onlyIfMatch: entry.etag })) return remaining(renewed);
    }
    throw new ImageLabStateError("STATE_UNAVAILABLE");
  }

  async reserve(
    identity: ImageLabPairIdentity,
    input: {
      idempotencyKey: string;
      requestHash: string;
      stage: ImageLabStage;
      profileId: string;
      nowSeconds: number;
    }
  ): Promise<ImageLabJobReservation> {
    const key = pairKey(identity);
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const entry = await this.repository.read(key);
      if (entry === null) throw new ImageLabStateError("PAIR_NOT_UNLOCKED");
      const current = parseState(entry.value);
      if (current.expiresAt <= input.nowSeconds) throw new ImageLabStateError("SESSION_EXPIRED");
      const existing = current.jobs[input.idempotencyKey];
      if (existing) {
        if (existing.requestHash !== input.requestHash || existing.stage !== input.stage ||
          existing.profileId !== input.profileId) {
          throw new ImageLabStateError("IDEMPOTENCY_CONFLICT");
        }
        return { created: false, job: existing, ...remaining(current) };
      }
      if (Object.keys(current.jobs).length >= MAX_JOBS_PER_PAIR) {
        throw new ImageLabStateError("ALLOWANCE_EXHAUSTED");
      }
      const available = input.stage === "object-forge"
        ? current.remainingObject
        : current.remainingRealise;
      if (available < 1) throw new ImageLabStateError("ALLOWANCE_EXHAUSTED");
      const job: ImageLabStoredJob = {
        id: input.idempotencyKey,
        requestHash: input.requestHash,
        stage: input.stage,
        profileId: input.profileId,
        state: "submitting",
        createdAt: input.nowSeconds
      };
      const next: ImageLabPairState = {
        ...current,
        remainingObject: input.stage === "object-forge"
          ? current.remainingObject - 1
          : current.remainingObject,
        remainingRealise: input.stage === "make-it-real"
          ? current.remainingRealise - 1
          : current.remainingRealise,
        jobs: { ...current.jobs, [job.id]: job }
      };
      if (await this.repository.write(key, next, { onlyIfMatch: entry.etag })) {
        return { created: true, job, ...remaining(next) };
      }
    }
    throw new ImageLabStateError("STATE_UNAVAILABLE");
  }

  async attachRequest(
    identity: ImageLabPairIdentity,
    jobId: string,
    requestId: string
  ): Promise<ImageLabStoredJob> {
    return this.updateJob(identity, jobId, (job) => {
      if (job.requestId !== undefined && job.requestId !== requestId) {
        throw new ImageLabStateError("IDEMPOTENCY_CONFLICT");
      }
      return { ...job, state: "submitted", requestId };
    });
  }

  async markIndeterminate(
    identity: ImageLabPairIdentity,
    jobId: string
  ): Promise<ImageLabStoredJob> {
    return this.updateJob(identity, jobId, (job) =>
      job.state === "submitted" ? job : { ...job, state: "indeterminate" });
  }

  async getJob(identity: ImageLabPairIdentity, jobId: string): Promise<ImageLabStoredJob> {
    const entry = await this.repository.read(pairKey(identity));
    if (entry === null) throw new ImageLabStateError("JOB_NOT_FOUND");
    const job = parseState(entry.value).jobs[jobId];
    if (!job) throw new ImageLabStateError("JOB_NOT_FOUND");
    return job;
  }

  private async updateJob(
    identity: ImageLabPairIdentity,
    jobId: string,
    update: (job: ImageLabStoredJob) => ImageLabStoredJob
  ): Promise<ImageLabStoredJob> {
    const key = pairKey(identity);
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const entry = await this.repository.read(key);
      if (entry === null) throw new ImageLabStateError("JOB_NOT_FOUND");
      const current = parseState(entry.value);
      const job = current.jobs[jobId];
      if (!job) throw new ImageLabStateError("JOB_NOT_FOUND");
      const nextJob = update(job);
      if (nextJob === job) return job;
      const next = { ...current, jobs: { ...current.jobs, [jobId]: nextJob } };
      if (await this.repository.write(key, next, { onlyIfMatch: entry.etag })) return nextJob;
    }
    throw new ImageLabStateError("STATE_UNAVAILABLE");
  }
}

export class MemoryImageLabStateRepository implements ImageLabStateRepository {
  readonly #values = new Map<string, { value: ImageLabPairState; etag: number }>();

  async read(key: string): Promise<ImageLabStateEntry | null> {
    const entry = this.#values.get(key);
    return entry ? { value: structuredClone(entry.value), etag: String(entry.etag) } : null;
  }

  async write(
    key: string,
    value: ImageLabPairState,
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
