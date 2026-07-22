import type {
  StudioCoachContext,
  StudioCoachMode,
  StudioCoachRequest,
  StudioCoachResponse,
  StudioCoachTechniqueId,
  StudioCoachTurnOneResponse,
  StudioCoachTurnTwoResponse
} from "../../../shared/studio-coach-contract";
import { parseStudioCoachResponse } from "../../../shared/studio-coach-contract";
import type { StudioCoachCanvasEvidence } from "./canvas-evidence";

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
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const INITIAL_STATE: StudioCoachRuntimeState = Object.freeze({
  phase: "empty",
  attemptsUsed: 0,
  changedSinceFirst: false,
  first: null,
  final: null,
  error: ""
});

function ambiguousInitialOutcome(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === "NETWORK_ERROR" || code === "TIMEOUT" || code === "CHECK_IN_PROGRESS";
}

interface StudioCoachStoredRuntime {
  version: 1;
  attemptsUsed: 1 | 2;
  first: StudioCoachTurnOneResponse;
  final: StudioCoachTurnTwoResponse | null;
  firstEvidence: StudioCoachCanvasEvidence;
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

function storedRuntime(value: unknown): StudioCoachStoredRuntime | null {
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
    version: 1,
    attemptsUsed: input.attemptsUsed,
    first,
    final,
    firstEvidence
  };
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
  #campaign: StudioCoachCampaign | null = null;
  #firstEvidence: StudioCoachCanvasEvidence | null = null;
  #pendingInitialRequest: StudioCoachRequest | null = null;
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
    this.#pendingInitialRequest = null;
    const restored = this.#restore(campaign);
    this.#firstEvidence = restored?.firstEvidence ?? null;
    this.#state = restored === null
      ? { ...INITIAL_STATE, phase: "ready" }
      : {
          phase: restored.attemptsUsed === 2 ? "complete" : "advice",
          attemptsUsed: restored.attemptsUsed,
          changedSinceFirst: false,
          first: restored.first,
          final: restored.final,
          error: ""
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
    this.#state = { ...INITIAL_STATE };
    this.#emit();
  }

  markCanvasChanged(): void {
    if (this.#state.phase !== "advice" || this.#state.changedSinceFirst) return;
    this.#state = { ...this.#state, changedSinceFirst: true };
    this.#emit();
  }

  async requestInitial(
    mode: Exclude<StudioCoachMode, "revision">,
    techniqueId?: StudioCoachTechniqueId
  ): Promise<StudioCoachTurnOneResponse> {
    const campaign = this.#requiredCampaign();
    if (this.#state.phase === "complete" || this.#state.attemptsUsed >= 2 || this.#state.first) {
      throw new Error("Studio Coach is complete for this advertisement");
    }
    if (this.#state.phase === "checking-initial" || this.#state.phase === "checking-revision") {
      throw new Error("Studio Coach is already checking this advertisement");
    }
    const pending = this.#pendingInitialRequest;
    if (pending === null && mode === "technique" && techniqueId === undefined) {
      throw new Error("Choose a technique before asking Studio Coach");
    }
    const controller = this.#begin("checking-initial");
    let request = pending;
    try {
      if (request === null) {
        const current = await this.#capture();
        this.#assertCurrent(controller);
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
        this.#consumeAttempt();
      }
      const response = await this.#client.check(request, { signal: controller.signal });
      this.#assertCurrent(controller);
      if (response.turn !== 1 || response.mode !== request.mode) {
        throw new Error("Studio Coach returned the wrong check");
      }
      this.#pendingInitialRequest = null;
      this.#firstEvidence = request.current;
      this.#state = {
        ...this.#state,
        phase: this.#state.attemptsUsed >= 2 ? "complete" : "advice",
        first: response,
        changedSinceFirst: false,
        error: ""
      };
      this.#finish(controller);
      return response;
    } catch (error) {
      this.#pendingInitialRequest = request !== null && ambiguousInitialOutcome(error)
        ? request
        : null;
      this.#recordFailure(controller, error);
      throw error;
    }
  }

  async requestRevision(): Promise<StudioCoachTurnTwoResponse> {
    const campaign = this.#requiredCampaign();
    if (this.#state.phase === "complete" || this.#state.attemptsUsed >= 2) {
      throw new Error("Studio Coach is complete for this advertisement");
    }
    if (!this.#state.first || !this.#firstEvidence) throw new Error("Ask for the first Studio Coach check first");
    if (!this.#state.changedSinceFirst) throw new Error("Change the advertisement first");
    const controller = this.#begin("checking-revision");
    try {
      const current = await this.#capture();
      this.#assertCurrent(controller);
      if (current.imageSha256 === this.#firstEvidence.imageSha256) {
        this.#state = { ...this.#state, phase: "advice", changedSinceFirst: false, error: "Change the advertisement first." };
        this.#finish(controller);
        throw new Error("Change the advertisement first");
      }
      const request: StudioCoachRequest = {
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
      this.#consumeAttempt();
      const response = await this.#client.check(request, { signal: controller.signal });
      this.#assertCurrent(controller);
      if (response.turn !== 2) throw new Error("Studio Coach returned the wrong comparison");
      this.#state = { ...this.#state, phase: "complete", final: response, error: "" };
      this.#finish(controller);
      return response;
    } catch (error) {
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
    this.#state = { ...this.#state, attemptsUsed };
    this.#emit();
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
    const phase = this.#state.attemptsUsed >= 2 ? "complete" : "error";
    this.#state = { ...this.#state, phase, error: message };
    this.#emit();
  }

  #emit(): void {
    this.#persist();
    this.#listeners.forEach((listener) => listener());
  }

  #restore(campaign: StudioCoachCampaign): StudioCoachStoredRuntime | null {
    if (!this.#storage) return null;
    try {
      const value = this.#storage.getItem(`ad-market:studio-coach:v1:${storageKey(campaign)}`);
      return value === null ? null : storedRuntime(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }

  #persist(): void {
    if (!this.#storage || !this.#campaign || !this.#state.first || !this.#firstEvidence ||
      this.#state.attemptsUsed === 0) return;
    const snapshot: StudioCoachStoredRuntime = {
      version: 1,
      attemptsUsed: this.#state.attemptsUsed,
      first: this.#state.first,
      final: this.#state.final,
      firstEvidence: this.#firstEvidence
    };
    try {
      this.#storage.setItem(
        `ad-market:studio-coach:v1:${storageKey(this.#campaign)}`,
        JSON.stringify(snapshot)
      );
    } catch {
      // Persistence is a recovery aid; storage failure must not block the editor.
    }
  }
}
