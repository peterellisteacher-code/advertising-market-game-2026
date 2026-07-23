import type { GeneratedRasterPlacement } from "../catalogue/catalogue-runtime";
import type {
  ImageLabClient,
  ImageLabConfig as ClientConfig,
  ImageLabJobCreated,
  ImageLabJobRequest,
  ImageLabJobStatus,
  ImageLabLockResult,
  ImageLabUnlockRequest,
  ImageLabUnlockResult
} from "./image-lab-client";
import { ImageLabClientError } from "./image-lab-client";
import {
  prepareImageForAi,
  type AiImageTarget,
  type PrepareImageOptions,
  type PreparedAiImage
} from "./image-processing";
import type {
  ImageLabActions,
  ImageLabAllowance,
  ImageLabConfig,
  MakeItRealChoice,
  ObjectForgeChoice
} from "./image-lab-panel";

export interface ImageLabRuntimeClient {
  getConfig(options?: { signal?: AbortSignal }): Promise<ClientConfig>;
  unlock(request: ImageLabUnlockRequest, options?: { signal?: AbortSignal }): Promise<ImageLabUnlockResult>;
  lock(options?: { signal?: AbortSignal }): Promise<ImageLabLockResult>;
  createJob(request: ImageLabJobRequest, options?: { signal?: AbortSignal }): Promise<ImageLabJobCreated>;
  pollJob(
    jobToken: string,
    options?: { signal?: AbortSignal; maxAttempts?: number; intervalMs?: number }
  ): Promise<ImageLabJobStatus>;
  getAsset(jobToken: string, options?: { signal?: AbortSignal }): Promise<Blob>;
}

export interface ImageLabPairIdentity {
  sessionId: string;
  teamId: string;
}

export interface ImageLabSubmissionPersistence {
  load(fingerprint: string): Promise<string | null>;
  store(fingerprint: string, idempotencyKey: string): Promise<void>;
  remove(fingerprint: string): Promise<void>;
}

class MemoryImageLabSubmissionPersistence implements ImageLabSubmissionPersistence {
  readonly #pending = new Map<string, string>();

  async load(fingerprint: string): Promise<string | null> {
    return this.#pending.get(fingerprint) ?? null;
  }

  async store(fingerprint: string, idempotencyKey: string): Promise<void> {
    this.#pending.set(fingerprint, idempotencyKey);
  }

  async remove(fingerprint: string): Promise<void> {
    this.#pending.delete(fingerprint);
  }
}

export interface ImageLabRuntimeDependencies {
  client: ImageLabRuntimeClient | ImageLabClient;
  exportDesign(pair: ImageLabPairIdentity): string | Promise<string>;
  place(pair: ImageLabPairIdentity, input: GeneratedRasterPlacement): Promise<void>;
  isCurrentPair(pair: ImageLabPairIdentity): boolean;
  prepare?: (
    dataUrl: string,
    target: AiImageTarget,
    options?: PrepareImageOptions
  ) => Promise<PreparedAiImage>;
  createId?: () => string;
  submissionPersistence?: ImageLabSubmissionPersistence;
}

function allowance(
  remaining: { object: number; realise: number },
  expiresAt: number
): ImageLabAllowance {
  return {
    remainingObject: remaining.object,
    remainingRealise: remaining.realise,
    expiresAt
  };
}

async function blobDataUrl(blob: Blob): Promise<string> {
  if (blob.type !== "image/png" && blob.type !== "image/jpeg") {
    throw new Error("Image Lab returned an unsupported editable image");
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${blob.type};base64,${globalThis.btoa(binary)}`;
}

function displayTitle(value: string): string {
  const trimmed = value.trim();
  return trimmed.length === 0 ? "Generated image" : trimmed[0]!.toUpperCase() + trimmed.slice(1);
}

async function submissionFingerprint(submission: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(submission)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function isDefiniteCreationFailure(value: unknown): boolean {
  if (!(value instanceof ImageLabClientError)) return false;
  return value.code === "INVALID_REQUEST" ||
    value.code === "IMAGE_LAB_DISABLED" ||
    value.code === "IMAGE_LAB_LOCKED" ||
    value.code === "UNLOCK_DENIED" ||
    value.code === "ALLOWANCE_EXHAUSTED" ||
    value.code === "SESSION_EXPIRED" ||
    value.code === "RATE_LIMITED" ||
    value.code === "HTTP_ERROR" && value.status !== undefined &&
      value.status >= 400 && value.status < 500;
}

export class ImageLabRuntime implements ImageLabActions {
  readonly #client: ImageLabRuntimeClient;
  readonly #exportDesign: (pair: ImageLabPairIdentity) => string | Promise<string>;
  readonly #place: (pair: ImageLabPairIdentity, input: GeneratedRasterPlacement) => Promise<void>;
  readonly #isCurrentPair: (pair: ImageLabPairIdentity) => boolean;
  readonly #prepare: NonNullable<ImageLabRuntimeDependencies["prepare"]>;
  readonly #createId: () => string;
  readonly #submissionPersistence: ImageLabSubmissionPersistence;
  #expiresAt = 0;
  #config: ImageLabConfig | null = null;

  constructor(dependencies: ImageLabRuntimeDependencies) {
    this.#client = dependencies.client;
    this.#exportDesign = dependencies.exportDesign;
    this.#place = dependencies.place;
    this.#isCurrentPair = dependencies.isCurrentPair;
    this.#prepare = dependencies.prepare ?? prepareImageForAi;
    this.#createId = dependencies.createId ?? (() => globalThis.crypto.randomUUID());
    this.#submissionPersistence = dependencies.submissionPersistence ??
      new MemoryImageLabSubmissionPersistence();
  }

  async getConfig(signal: AbortSignal): Promise<ImageLabConfig> {
    if (this.#config !== null) return this.#config;
    const config = await this.#client.getConfig({ signal });
    signal.throwIfAborted();
    this.#config = config.enabled
      ? {
          enabled: true,
          accountCapUsd: config.accountCapUsd,
          objectAllowance: config.remaining.object,
          realiseAllowance: config.remaining.realise
        }
      : config;
    return this.#config;
  }

  async unlock(input: ImageLabUnlockRequest, signal: AbortSignal): Promise<ImageLabAllowance> {
    const result = await this.#client.unlock(input, { signal });
    this.#expiresAt = result.expiresAt;
    return allowance(result.remaining, result.expiresAt);
  }

  async lock(signal: AbortSignal): Promise<void> {
    await this.#client.lock({ signal });
    signal.throwIfAborted();
    this.#expiresAt = 0;
  }

  async forgeObject(input: ObjectForgeChoice, signal: AbortSignal): Promise<ImageLabAllowance> {
    const pair = { sessionId: input.sessionId, teamId: input.teamId };
    this.#assertActive(pair, signal);
    const submission = JSON.stringify({
      stage: "object",
      sessionId: input.sessionId,
      teamId: input.teamId,
      objectName: input.objectName,
      category: input.category,
      style: input.style,
      colour: input.colour,
      removeWhiteBackground: input.removeWhiteBackground
    });
    const { fingerprint, generationId } = await this.#submissionId(submission);
    const created = await this.#createJob({
        stage: "object",
        sessionId: input.sessionId,
        teamId: input.teamId,
        idempotencyKey: generationId,
        objectName: input.objectName,
        category: input.category,
        style: input.style,
        colour: input.colour
      }, fingerprint, signal);
    this.#assertActive(pair, signal);
    const asset = await this.#completedAsset(created, pair, fingerprint, signal);
    const dataUrl = await blobDataUrl(asset);
    this.#assertActive(pair, signal);
    const prepared = await this.#prepare(dataUrl, "object-forge", {
      removeWhiteBackground: input.removeWhiteBackground
    });
    this.#assertActive(pair, signal);
    await this.#place(pair, {
      assetId: `ai-${generationId}`,
      title: displayTitle(input.objectName),
      blob: prepared.blob,
      stage: "object-forge",
      profileId: "object-forge-v1",
      requestId: generationId
    });
    await this.#submissionPersistence.remove(fingerprint);
    this.#assertActive(pair, signal);
    return allowance(created.remaining, this.#expiresAt);
  }

  async makeReal(input: MakeItRealChoice, signal: AbortSignal): Promise<ImageLabAllowance> {
    const pair = { sessionId: input.sessionId, teamId: input.teamId };
    this.#assertActive(pair, signal);
    const exported = await this.#exportDesign(pair);
    this.#assertActive(pair, signal);
    const reference = await this.#prepare(exported, "make-it-real", {
      removeWhiteBackground: false
    });
    this.#assertActive(pair, signal);
    const submission = JSON.stringify({
      stage: "realise",
      sessionId: input.sessionId,
      teamId: input.teamId,
      designDataUrl: reference.dataUrl,
      productKind: input.productKind,
      scene: input.scene
    });
    const { fingerprint, generationId } = await this.#submissionId(submission);
    const created = await this.#createJob({
        stage: "realise",
        sessionId: input.sessionId,
        teamId: input.teamId,
        idempotencyKey: generationId,
        designDataUrl: reference.dataUrl,
        productKind: input.productKind,
        scene: input.scene
      }, fingerprint, signal);
    this.#assertActive(pair, signal);
    const asset = await this.#completedAsset(created, pair, fingerprint, signal);
    this.#assertActive(pair, signal);
    await this.#place(pair, {
      assetId: `ai-${generationId}`,
      title: `${displayTitle(input.productKind)} showcase`,
      blob: asset,
      stage: "make-it-real",
      profileId: "make-it-real-v1",
      requestId: generationId
    });
    await this.#submissionPersistence.remove(fingerprint);
    this.#assertActive(pair, signal);
    return allowance(created.remaining, this.#expiresAt);
  }

  async #completedAsset(
    created: ImageLabJobCreated,
    pair: ImageLabPairIdentity,
    fingerprint: string,
    signal: AbortSignal
  ): Promise<Blob> {
    const status = await this.#client.pollJob(created.jobToken, {
      signal,
      maxAttempts: 60,
      intervalMs: 2_000
    });
    this.#assertActive(pair, signal);
    if (status.status === "failed") {
      await this.#submissionPersistence.remove(fingerprint);
      throw new Error("Image Lab generation failed");
    }
    if (status.status !== "completed") throw new Error("Image Lab generation failed");
    const asset = await this.#client.getAsset(created.jobToken, { signal });
    this.#assertActive(pair, signal);
    return asset;
  }

  #assertActive(pair: ImageLabPairIdentity, signal: AbortSignal): void {
    signal.throwIfAborted();
    if (!this.#isCurrentPair(pair)) {
      throw new DOMException("The Image Lab pair is no longer current.", "AbortError");
    }
  }

  async #submissionId(submission: string): Promise<{
    fingerprint: string;
    generationId: string;
  }> {
    const fingerprint = await submissionFingerprint(submission);
    const pending = await this.#submissionPersistence.load(fingerprint);
    if (pending !== null) return { fingerprint, generationId: pending };
    const created = this.#createId();
    await this.#submissionPersistence.store(fingerprint, created);
    return { fingerprint, generationId: created };
  }

  async #createJob(
    request: ImageLabJobRequest,
    fingerprint: string,
    signal: AbortSignal
  ): Promise<ImageLabJobCreated> {
    try {
      return await this.#client.createJob(request, { signal });
    } catch (error) {
      if (isDefiniteCreationFailure(error)) {
        await this.#submissionPersistence.remove(fingerprint);
      }
      throw error;
    }
  }
}
