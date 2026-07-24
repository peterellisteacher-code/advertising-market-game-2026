import type {
  StudioCoachContext,
  StudioCoachMode,
  StudioCoachRequest,
  StudioCoachResponse,
  StudioCoachTechniqueId,
  StudioCoachTurnOneResponse,
  StudioCoachTurnTwoResponse
} from "../../../shared/studio-coach-contract";
import {
  STUDIO_COACH_TECHNIQUE_IDS,
  parseStudioCoachResponse
} from "../../../shared/studio-coach-contract";
import type { StudioCoachCanvasEvidence } from "./canvas-evidence";
import { accountStorageNamespace } from "../account/account-storage-namespace";

export interface StudioCoachCampaign extends StudioCoachContext {
  sessionId: string;
  teamId: string;
  documentId: string;
}

export type StudioCoachRuntimePhase =
  | "empty"
  | "ready"
  | "checking-initial"
  | "advice"
  | "checking-revision"
  | "complete"
  | "error";

export interface StudioCoachRuntimeState {
  phase: StudioCoachRuntimePhase;
  attemptsUsed: 0 | 1 | 2;
  pendingCheck: "initial" | "revision" | null;
  changedSinceFirst: boolean;
  first: StudioCoachTurnOneResponse | null;
  final: StudioCoachTurnTwoResponse | null;
  error: string;
}

export interface StudioCoachRuntimeClient {
  check(request: StudioCoachRequest, options?: { signal?: AbortSignal }): Promise<StudioCoachResponse>;
}

export interface StudioCoachRuntimeDependencies {
  client: StudioCoachRuntimeClient;
  capture(): Promise<StudioCoachCanvasEvidence>;
  createId?: () => string;
  storage?: StudioCoachRuntimeStorage | null;
}

export interface StudioCoachRuntimeStorage {
  readonly length?: number;
  getItem(key: string): string | null;
  key?(index: number): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

const INITIAL_STATE: StudioCoachRuntimeState = Object.freeze({
  phase: "empty",
  attemptsUsed: 0,
  pendingCheck: null,
  changedSinceFirst: false,
  first: null,
  final: null,
  error: ""
});

function ambiguousOutcome(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === "NETWORK_ERROR" || code === "TIMEOUT" || code === "CHECK_IN_PROGRESS";
}

interface StudioCoachStoredRuntimeV2 {
  version: 2;
  attemptsUsed: 1 | 2;
  first: StudioCoachTurnOneResponse | null;
  final: StudioCoachTurnTwoResponse | null;
  firstEvidence: StudioCoachCanvasEvidence | null;
  pendingInitialRequest: StudioCoachRequest | null;
  pendingRevisionRequest: StudioCoachRequest | null;
  pendingEvidenceStale: boolean;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function storedEvidence(value: unknown): StudioCoachCanvasEvidence | null {
  const input = record(value);
  if (!input || typeof input.imageDataUrl !== "string" ||
    !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(input.imageDataUrl) ||
    input.imageDataUrl.length > 1_048_620 ||
    typeof input.imageSha256 !== "string" || !/^[a-f0-9]{64}$/.test(input.imageSha256) ||
    input.width !== 896 || input.height !== 504 || !Array.isArray(input.objects) ||
    input.objects.length > 40 || input.objects.some((object) => {
      const evidence = record(object);
      return !evidence || typeof evidence.id !== "string" || !evidence.id || evidence.id.length > 120 ||
        typeof evidence.type !== "string" || !evidence.type || evidence.type.length > 64 ||
        typeof evidence.name !== "string" || !evidence.name || evidence.name.length > 120 ||
        !Array.isArray(evidence.zOrder) || evidence.zOrder.length < 1 || evidence.zOrder.length > 100 ||
        evidence.zOrder.some((part) => !Number.isInteger(part) || (part as number) < 0);
    })) return null;
  return structuredClone(input) as unknown as StudioCoachCanvasEvidence;
}

function storedRuntimeV1(value: unknown): StudioCoachStoredRuntimeV2 | null {
  const input = record(value);
  if (!input || input.version !== 1 || input.attemptsUsed !== 1 && input.attemptsUsed !== 2) return null;
  let first: StudioCoachTurnOneResponse;
  let final: StudioCoachTurnTwoResponse | null = null;
  try {
    const parsedFirst = parseStudioCoachResponse(input.first);
    if (parsedFirst.turn !== 1) return null;
    first = parsedFirst;
    if (input.final !== null) {
      const parsedFinal = parseStudioCoachResponse(input.final);
      if (parsedFinal.turn !== 2) return null;
      final = parsedFinal;
    }
  } catch {
    return null;
  }
  const firstEvidence = storedEvidence(input.firstEvidence);
  if (!firstEvidence || final !== null && input.attemptsUsed !== 2) return null;
  return {
    version: 2,
    attemptsUsed: input.attemptsUsed,
    first,
    final,
    firstEvidence,
    pendingInitialRequest: null,
    pendingRevisionRequest: null,
    pendingEvidenceStale: false
  };
}

function storedText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value === value.trim() && value.length >= 1 && value.length <= maximum;
}

function storedContext(value: unknown): StudioCoachContext | null {
  const input = record(value);
  if (!input || !storedText(input.productName, 96) || !storedText(input.priceLabel, 32) ||
    !storedText(input.audienceNeed, 480) || !storedText(input.audienceValues, 480) ||
    !storedText(input.intendedEffect, 480) ||
    input.aidaStage !== "price" && input.aidaStage !== "attention" && input.aidaStage !== "interest" &&
      input.aidaStage !== "desire" && input.aidaStage !== "action") return null;
  return {
    productName: input.productName,
    priceLabel: input.priceLabel,
    audienceNeed: input.audienceNeed,
    audienceValues: input.audienceValues,
    intendedEffect: input.intendedEffect,
    aidaStage: input.aidaStage
  };
}

function storedRequest(
  value: unknown,
  campaign: StudioCoachCampaign,
  turn: 1 | 2
): StudioCoachRequest | null {
  const input = record(value);
  if (!input || input.sessionId !== campaign.sessionId || input.teamId !== campaign.teamId ||
    input.documentId !== campaign.documentId || !storedText(input.idempotencyKey, 128) ||
    input.turn !== turn || !storedContext(input.context)) return null;
  const context = storedContext(input.context)!;
  const current = storedEvidence(input.current);
  if (!current) return null;
  if (turn === 1 && (input.mode === "technique" || input.mode === "whole-ad")) {
    if (input.previous !== undefined || input.mode === "whole-ad" && input.techniqueId !== undefined ||
      input.mode === "technique" && (typeof input.techniqueId !== "string" ||
        !(STUDIO_COACH_TECHNIQUE_IDS as readonly string[]).includes(input.techniqueId))) return null;
    return {
      sessionId: campaign.sessionId,
      teamId: campaign.teamId,
      documentId: campaign.documentId,
      idempotencyKey: input.idempotencyKey,
      turn: 1,
      mode: input.mode,
      ...(input.mode === "technique" ? { techniqueId: input.techniqueId as StudioCoachTechniqueId } : {}),
      context,
      current
    };
  }
  if (turn === 2 && input.mode === "revision" && input.techniqueId === undefined) {
    const previous = storedEvidence(input.previous);
    if (!previous) return null;
    return {
      sessionId: campaign.sessionId,
      teamId: campaign.teamId,
      documentId: campaign.documentId,
      idempotencyKey: input.idempotencyKey,
      turn: 2,
      mode: "revision",
      context,
      previous,
      current
    };
  }
  return null;
}

function storedRuntimeV2(value: unknown, campaign: StudioCoachCampaign): StudioCoachStoredRuntimeV2 | null {
  const input = record(value);
  if (!input || input.version !== 2 || input.attemptsUsed !== 1 && input.attemptsUsed !== 2 ||
    typeof input.pendingEvidenceStale !== "boolean") return null;
  let first: StudioCoachTurnOneResponse | null = null;
  let final: StudioCoachTurnTwoResponse | null = null;
  try {
    if (input.first !== null) {
      const parsed = parseStudioCoachResponse(input.first);
      if (parsed.turn !== 1) return null;
      first = parsed;
    }
    if (input.final !== null) {
      const parsed = parseStudioCoachResponse(input.final);
      if (parsed.turn !== 2) return null;
      final = parsed;
    }
  } catch {
    return null;
  }
  const firstEvidence = input.firstEvidence === null ? null : storedEvidence(input.firstEvidence);
  const pendingInitialRequest = input.pendingInitialRequest === null
    ? null
    : storedRequest(input.pendingInitialRequest, campaign, 1);
  const pendingRevisionRequest = input.pendingRevisionRequest === null
    ? null
    : storedRequest(input.pendingRevisionRequest, campaign, 2);
  if (input.firstEvidence !== null && firstEvidence === null ||
    input.pendingInitialRequest !== null && pendingInitialRequest === null ||
    input.pendingRevisionRequest !== null && pendingRevisionRequest === null ||
    pendingInitialRequest !== null && pendingRevisionRequest !== null ||
    final !== null && (first === null || firstEvidence === null || input.attemptsUsed !== 2) ||
    (first === null) !== (firstEvidence === null) ||
    pendingInitialRequest !== null && (first !== null || final !== null) ||
    pendingRevisionRequest !== null && (first === null || firstEvidence === null || final !== null || input.attemptsUsed !== 2) ||
    pendingEvidenceStale(input.pendingEvidenceStale, pendingInitialRequest, pendingRevisionRequest)) return null;
  return {
    version: 2,
    attemptsUsed: input.attemptsUsed,
    first,
    final,
    firstEvidence,
    pendingInitialRequest,
    pendingRevisionRequest,
    pendingEvidenceStale: input.pendingEvidenceStale
  };
}

function pendingEvidenceStale(
  stale: boolean,
  initial: StudioCoachRequest | null,
  revision: StudioCoachRequest | null
): boolean {
  return stale && initial === null && revision === null;
}

function defaultStorage(): StudioCoachRuntimeStorage | null {
  try {
    return typeof globalThis.sessionStorage === "object" ? globalThis.sessionStorage : null;
  } catch {
    return null;
  }
}

function storageKey(campaign: StudioCoachCampaign): string {
  return [campaign.sessionId, campaign.teamId, campaign.documentId]
    .map((part) => encodeURIComponent(part))
    .join(":");
}

export class StudioCoachRuntime {
  readonly #client: StudioCoachRuntimeClient;
  readonly #capture: () => Promise<StudioCoachCanvasEvidence>;
  readonly #createId: () => string;
  readonly #storage: StudioCoachRuntimeStorage | null;
  readonly #listeners = new Set<() => void>();
  #accountNamespace: string | null = null;
  #campaign: StudioCoachCampaign | null = null;
  #firstEvidence: StudioCoachCanvasEvidence | null = null;
  #pendingInitialRequest: StudioCoachRequest | null = null;
  #pendingRevisionRequest: StudioCoachRequest | null = null;
  #pendingEvidenceStale = false;
  #canvasRevision = 0;
  #operation: AbortController | null = null;
  #state: StudioCoachRuntimeState = { ...INITIAL_STATE };

  constructor(dependencies: StudioCoachRuntimeDependencies) {
    this.#client = dependencies.client;
    this.#capture = dependencies.capture;
    this.#createId = dependencies.createId ?? (() => globalThis.crypto.randomUUID());
    this.#storage = dependencies.storage === undefined ? defaultStorage() : dependencies.storage;
  }

  state(): StudioCoachRuntimeState {
    return {
      ...this.#state,
      first: this.#state.first ? { ...this.#state.first, evidenceRefs: [...this.#state.first.evidenceRefs] } : null,
      final: this.#state.final ? { ...this.#state.final, evidenceRefs: [...this.#state.final.evidenceRefs] } : null
    };
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  setCampaign(campaign: StudioCoachCampaign): void {
    this.#operation?.abort();
    this.#operation = null;
    this.#campaign = { ...campaign };
    const restored = this.#restore(campaign);
    this.#firstEvidence = restored?.firstEvidence ?? null;
    this.#pendingInitialRequest = restored?.pendingInitialRequest ?? null;
    this.#pendingRevisionRequest = restored?.pendingRevisionRequest ?? null;
    this.#pendingEvidenceStale = restored?.pendingEvidenceStale ?? false;
    this.#canvasRevision = 0;
    this.#state = restored === null
      ? { ...INITIAL_STATE, phase: "ready" }
      : {
          phase: restored.pendingInitialRequest || restored.pendingRevisionRequest
            ? "error"
            : restored.attemptsUsed === 2 ? "complete" : restored.first === null ? "error" : "advice",
          attemptsUsed: restored.attemptsUsed,
          pendingCheck: restored.pendingInitialRequest ? "initial" : restored.pendingRevisionRequest ? "revision" : null,
          changedSinceFirst: restored.pendingRevisionRequest !== null,
          first: restored.first,
          final: restored.final,
          error: restored.pendingInitialRequest
            ? "The first check was interrupted. Resume the saved check; this does not use another turn."
            : restored.pendingRevisionRequest
              ? "The final check was interrupted. Resume the saved check; this does not use another turn."
              : restored.first === null
                ? restored.attemptsUsed === 1
                  ? "The first check did not finish. One final check remains."
                  : "Both available checks were used without a result."
                : restored.attemptsUsed === 2 && restored.final === null
                  ? "The successful advice used the final available check, so no comparison remains."
                  : ""
        };
    this.#emit();
  }

  updateCampaign(campaign: StudioCoachCampaign): void {
    if (!this.#campaign || this.#campaign.sessionId !== campaign.sessionId ||
      this.#campaign.teamId !== campaign.teamId || this.#campaign.documentId !== campaign.documentId) {
      this.setCampaign(campaign);
      return;
    }
    this.#campaign = { ...campaign };
    this.#emit();
  }

  clearCampaign(): void {
    this.#operation?.abort();
    this.#operation = null;
    this.#campaign = null;
    this.#firstEvidence = null;
    this.#pendingInitialRequest = null;
    this.#pendingRevisionRequest = null;
    this.#pendingEvidenceStale = false;
    this.#canvasRevision = 0;
    this.#state = { ...INITIAL_STATE };
    this.#emit();
  }

  markCanvasChanged(): void {
    this.#canvasRevision += 1;
    if (this.#pendingInitialRequest || this.#pendingRevisionRequest) this.#pendingEvidenceStale = true;
    if (this.#state.phase === "advice" && !this.#state.changedSinceFirst) {
      this.#state = { ...this.#state, changedSinceFirst: true };
    }
    this.#emit();
  }

  async requestInitial(
    mode: Exclude<StudioCoachMode, "revision">,
    techniqueId?: StudioCoachTechniqueId
  ): Promise<StudioCoachTurnOneResponse> {
    const campaign = this.#requiredCampaign();
    const pending = this.#pendingInitialRequest;
    if (pending === null && (this.#state.phase === "complete" || this.#state.attemptsUsed >= 2 || this.#state.first)) {
      throw new Error("Studio Coach is complete for this advertisement");
    }
    if (this.#state.phase === "checking-initial" || this.#state.phase === "checking-revision") {
      throw new Error("Studio Coach is already checking this advertisement");
    }
    if (pending === null && mode === "technique" && techniqueId === undefined) {
      throw new Error("Choose a technique before asking Studio Coach");
    }
    const controller = this.#begin("checking-initial");
    let request = pending;
    const requestCanvasRevision = this.#canvasRevision;
    try {
      if (request === null) {
        const captureRevision = this.#canvasRevision;
        const current = await this.#capture();
        this.#assertCurrent(controller);
        if (this.#canvasRevision !== captureRevision) {
          throw new Error("The advertisement changed while Studio Coach captured it. Try the check again.");
        }
        request = {
          sessionId: campaign.sessionId,
          teamId: campaign.teamId,
          documentId: campaign.documentId,
          idempotencyKey: this.#createId(),
          turn: 1,
          mode,
          ...(mode === "technique" ? { techniqueId: techniqueId! } : {}),
          context: this.#context(campaign),
          current
        };
        this.#pendingInitialRequest = request;
        this.#pendingEvidenceStale = false;
        this.#consumeAttempt();
      }
      const response = await this.#client.check(request, { signal: controller.signal });
      this.#assertCurrent(controller);
      if (response.turn !== 1 || response.mode !== request.mode) {
        throw new Error("Studio Coach returned the wrong check");
      }
      const stale = this.#pendingEvidenceStale || this.#canvasRevision !== requestCanvasRevision;
      this.#pendingInitialRequest = null;
      this.#pendingEvidenceStale = false;
      this.#firstEvidence = request.current;
      this.#state = {
        ...this.#state,
        phase: this.#state.attemptsUsed >= 2 ? "complete" : "advice",
        pendingCheck: null,
        first: response,
        changedSinceFirst: stale,
        error: stale
          ? "The advertisement changed during this check. This advice describes the earlier version."
          : this.#state.attemptsUsed >= 2
            ? "The successful advice used the final available check, so no comparison remains."
            : ""
      };
      this.#finish(controller);
      return response;
    } catch (error) {
      const ambiguous = request !== null && ambiguousOutcome(error);
      this.#pendingInitialRequest = ambiguous
        ? request
        : null;
      if (request !== null && !ambiguous) this.#refundAttempt(controller);
      if (this.#pendingInitialRequest === null) this.#pendingEvidenceStale = false;
      this.#recordFailure(controller, error);
      throw error;
    }
  }

  async requestRevision(): Promise<StudioCoachTurnTwoResponse> {
    const campaign = this.#requiredCampaign();
    const pending = this.#pendingRevisionRequest;
    if (pending === null && (this.#state.phase === "complete" || this.#state.attemptsUsed >= 2)) {
      throw new Error("Studio Coach is complete for this advertisement");
    }
    if (!this.#state.first || !this.#firstEvidence) throw new Error("Ask for the first Studio Coach check first");
    if (pending === null && !this.#state.changedSinceFirst) throw new Error("Change the advertisement first");
    const controller = this.#begin("checking-revision");
    let request = pending;
    const requestCanvasRevision = this.#canvasRevision;
    try {
      if (request === null) {
        const captureRevision = this.#canvasRevision;
        const current = await this.#capture();
        this.#assertCurrent(controller);
        if (this.#canvasRevision !== captureRevision) {
          throw new Error("The advertisement changed while Studio Coach captured it. Try the check again.");
        }
        if (current.imageSha256 === this.#firstEvidence.imageSha256) {
          this.#state = {
            ...this.#state,
            phase: "advice",
            changedSinceFirst: false,
            error: "Change the advertisement first."
          };
          this.#finish(controller);
          throw new Error("Change the advertisement first");
        }
        request = {
          sessionId: campaign.sessionId,
          teamId: campaign.teamId,
          documentId: campaign.documentId,
          idempotencyKey: this.#createId(),
          turn: 2,
          mode: "revision",
          context: this.#context(campaign),
          previous: this.#firstEvidence,
          current
        };
        this.#pendingRevisionRequest = request;
        this.#pendingEvidenceStale = false;
        this.#consumeAttempt();
      }
      const response = await this.#client.check(request, { signal: controller.signal });
      this.#assertCurrent(controller);
      if (response.turn !== 2) throw new Error("Studio Coach returned the wrong comparison");
      const stale = this.#pendingEvidenceStale || this.#canvasRevision !== requestCanvasRevision;
      this.#pendingRevisionRequest = null;
      this.#pendingEvidenceStale = false;
      this.#state = {
        ...this.#state,
        phase: "complete",
        pendingCheck: null,
        final: response,
        error: stale
          ? "The advertisement changed during this check. This comparison describes the earlier version."
          : ""
      };
      this.#finish(controller);
      return response;
    } catch (error) {
      const ambiguous = request !== null && ambiguousOutcome(error);
      this.#pendingRevisionRequest = ambiguous
        ? request
        : null;
      if (request !== null && !ambiguous) this.#refundAttempt(controller);
      if (this.#pendingRevisionRequest === null) this.#pendingEvidenceStale = false;
      this.#recordFailure(controller, error);
      throw error;
    }
  }

  #requiredCampaign(): StudioCoachCampaign {
    if (!this.#campaign) throw new Error("Open a campaign before using Studio Coach");
    return this.#campaign;
  }

  #context(campaign: StudioCoachCampaign): StudioCoachContext {
    return {
      productName: campaign.productName,
      priceLabel: campaign.priceLabel,
      audienceNeed: campaign.audienceNeed,
      audienceValues: campaign.audienceValues,
      intendedEffect: campaign.intendedEffect,
      aidaStage: campaign.aidaStage
    };
  }

  #begin(phase: "checking-initial" | "checking-revision"): AbortController {
    this.#operation?.abort();
    const controller = new AbortController();
    this.#operation = controller;
    this.#state = { ...this.#state, phase, error: "" };
    this.#emit();
    return controller;
  }

  #consumeAttempt(): void {
    const attemptsUsed = Math.min(2, this.#state.attemptsUsed + 1) as 1 | 2;
    this.#state = {
      ...this.#state,
      attemptsUsed,
      pendingCheck: this.#pendingInitialRequest ? "initial" : this.#pendingRevisionRequest ? "revision" : null
    };
    this.#emit();
  }

  async activateAccount(username: string): Promise<void> {
    const namespace = await accountStorageNamespace(username);
    this.clearCampaign();
    this.#accountNamespace = namespace;
  }

  deactivateAccount(): void {
    this.clearCampaign();
    this.#accountNamespace = null;
  }

  async resetAccount(username: string): Promise<void> {
    const namespace = await accountStorageNamespace(username);
    if (this.#accountNamespace === namespace) this.deactivateAccount();
    if (!this.#storage || typeof this.#storage.length !== "number" ||
      !this.#storage.key || !this.#storage.removeItem) return;
    const prefix = `ad-market:studio-coach:v3:${namespace}:`;
    const keys: string[] = [];
    for (let index = 0; index < this.#storage.length; index += 1) {
      const key = this.#storage.key(index);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => this.#storage!.removeItem!(key));
  }

  #refundAttempt(controller: AbortController): void {
    if (this.#operation !== controller || this.#state.attemptsUsed === 0) return;
    const attemptsUsed = (this.#state.attemptsUsed - 1) as 0 | 1;
    this.#state = { ...this.#state, attemptsUsed, pendingCheck: null };
  }

  #assertCurrent(controller: AbortController): void {
    controller.signal.throwIfAborted();
    if (this.#operation !== controller) throw new DOMException("Studio Coach campaign changed", "AbortError");
  }

  #finish(controller: AbortController): void {
    if (this.#operation === controller) this.#operation = null;
    this.#emit();
  }

  #recordFailure(controller: AbortController, error: unknown): void {
    if (this.#operation !== controller) return;
    this.#operation = null;
    const message = error instanceof Error ? error.message : "Studio Coach could not finish this check.";
    const pendingCheck = this.#pendingInitialRequest ? "initial" : this.#pendingRevisionRequest ? "revision" : null;
    const phase = pendingCheck === null && this.#state.attemptsUsed >= 2 ? "complete" : "error";
    this.#state = { ...this.#state, phase, pendingCheck, error: message };
    this.#emit();
  }

  #emit(): void {
    this.#persist();
    this.#listeners.forEach((listener) => listener());
  }

  #restore(campaign: StudioCoachCampaign): StudioCoachStoredRuntimeV2 | null {
    if (!this.#storage) return null;
    try {
      const key = storageKey(campaign);
      if (this.#accountNamespace !== null) {
        const scopedKey = `ad-market:studio-coach:v3:${this.#accountNamespace}:${key}`;
        const scoped = this.#storage.getItem(scopedKey);
        if (scoped !== null) return storedRuntimeV2(JSON.parse(scoped) as unknown, campaign);
        const migrated = this.#restoreLegacy(campaign, key);
        if (migrated !== null) {
          this.#storage.setItem(scopedKey, JSON.stringify(migrated));
          this.#storage.removeItem?.(`ad-market:studio-coach:v2:${key}`);
          this.#storage.removeItem?.(`ad-market:studio-coach:v1:${key}`);
        }
        return migrated;
      }
      return this.#restoreLegacy(campaign, key);
    } catch {
      return null;
    }
  }

  #restoreLegacy(
    campaign: StudioCoachCampaign,
    key: string
  ): StudioCoachStoredRuntimeV2 | null {
    if (!this.#storage) return null;
    const v2 = this.#storage.getItem(`ad-market:studio-coach:v2:${key}`);
    if (v2 !== null) return storedRuntimeV2(JSON.parse(v2) as unknown, campaign);
    const v1 = this.#storage.getItem(`ad-market:studio-coach:v1:${key}`);
    return v1 === null ? null : storedRuntimeV1(JSON.parse(v1) as unknown);
  }

  #persist(): void {
    if (!this.#storage || !this.#campaign) return;
    const key = storageKey(this.#campaign);
    const persistedKey = this.#accountNamespace === null
      ? `ad-market:studio-coach:v2:${key}`
      : `ad-market:studio-coach:v3:${this.#accountNamespace}:${key}`;
    if (this.#state.attemptsUsed === 0) {
      try {
        if (this.#storage.removeItem) {
          this.#storage.removeItem(persistedKey);
          if (this.#accountNamespace === null) {
            this.#storage.removeItem(`ad-market:studio-coach:v1:${key}`);
          }
        } else {
          this.#storage.setItem(persistedKey, "{}");
        }
      } catch {
        // Persistence is a recovery aid; storage failure must not block the editor.
      }
      return;
    }
    const snapshot: StudioCoachStoredRuntimeV2 = {
      version: 2,
      attemptsUsed: this.#state.attemptsUsed,
      first: this.#state.first,
      final: this.#state.final,
      firstEvidence: this.#firstEvidence,
      pendingInitialRequest: this.#pendingInitialRequest,
      pendingRevisionRequest: this.#pendingRevisionRequest,
      pendingEvidenceStale: this.#pendingEvidenceStale
    };
    try {
      this.#storage.setItem(
        persistedKey,
        JSON.stringify(snapshot)
      );
    } catch {
      // Persistence is a recovery aid; storage failure must not block the editor.
    }
  }
}
