import type {
  CampaignDocumentV1,
  CampaignGameplayStage,
  CampaignPairStateV1
} from "../domain/campaign-document";
import {
  AUDIENCE_BRIEFS,
  getAudienceBrief,
  type AudienceBrief
} from "./audience-briefs";
import {
  bothRolesHaveActed,
  createPairSession,
  recordProductiveAction,
  selectAudienceBrief,
  swapActiveRole,
  type PairRole,
  type PairRoleProgress,
  type PairSession
} from "./pair-session";
import { STUDENT_COPY } from "./student-copy";

export interface PairGameView {
  activeRole: HTMLElement;
  activeRoleAction: HTMLElement;
  partnerRole: HTMLElement;
  partnerRoleAction: HTMLElement;
  roundProgress: HTMLElement;
  swapRoles: HTMLButtonElement;
  audienceSignal: HTMLSelectElement;
  audienceContext: HTMLElement;
  audienceNeed: HTMLElement;
  audienceValues: HTMLElement;
  audienceEffect: HTMLElement;
  canvasWords: HTMLInputElement;
  addWords: HTMLButtonElement;
  productWords: HTMLButtonElement;
  undo: HTMLButtonElement;
  redo: HTMLButtonElement;
  polite: HTMLElement;
  assertive: HTMLElement;
}

export interface RoundZeroPort {
  setAudienceBrief(brief: AudienceBrief): Promise<CampaignDocumentV1>;
  addText(value: string): Promise<void>;
  addProductText(value: string): Promise<"added" | "updated" | "product-required">;
  undo(): Promise<boolean>;
  redo(): Promise<boolean>;
  subscribeCanvasMutations(listener: () => void): () => void;
}

interface StoredPairState {
  session: PairSession;
  progress: PairRoleProgress;
  stage: CampaignGameplayStage;
}

type ListenerDisposer = () => void;
export type PairStateChangeListener = (state: CampaignPairStateV1) => void;

function oppositeRole(role: PairRole): PairRole {
  return role === "art-director" ? "strategist" : "art-director";
}

export class PairGameController {
  readonly #view: PairGameView;
  readonly #port: RoundZeroPort;
  readonly #now: () => Date;
  readonly #onPairChange: PairStateChangeListener;
  readonly #listenerDisposers: ListenerDisposer[] = [];
  #current: StoredPairState | null = null;
  #unsubscribeCanvas: ListenerDisposer | null = null;
  #operations: Promise<void> = Promise.resolve();
  #disposed = false;

  constructor(
    view: PairGameView,
    port: RoundZeroPort,
    now: () => Date = () => new Date(),
    onPairChange: PairStateChangeListener = () => undefined
  ) {
    this.#view = view;
    this.#port = port;
    this.#now = now;
    this.#onPairChange = onPairChange;
    this.#populateAudienceSignals();
    this.#listen(view.swapRoles, "click", () => this.#swapRoles());
    this.#listen(view.audienceSignal, "change", () => this.#changeAudience());
    this.#listen(view.addWords, "click", () => this.#addWords());
    this.#listen(view.productWords, "click", () => this.#addProductWords());
    this.#listen(view.undo, "click", () => this.#undo());
    this.#listen(view.redo, "click", () => this.#redo());
  }

  async open(document: CampaignDocumentV1): Promise<void> {
    if (this.#disposed) {
      throw new Error("Pair play has been disposed");
    }

    this.close();
    const selectedBrief = AUDIENCE_BRIEFS.find(
      (brief) => brief.id === document.brief.targetAudienceId
    ) ?? AUDIENCE_BRIEFS[0];

    if (document.brief.targetAudienceId !== selectedBrief.id) {
      await this.#port.setAudienceBrief(selectedBrief);
    }

    const persisted = document.gameplay.pair;
    const state: StoredPairState = {
      session: {
        ...createPairSession({
          sessionId: document.sessionId,
          audienceBriefId: selectedBrief.id,
          startedAt: this.#now().toISOString()
        }),
        activeRole: persisted.activeRole,
        handoffCount: persisted.handoffCount
      },
      progress: {
        "art-director": persisted.artDirectorActions,
        strategist: persisted.strategistActions
      },
      stage: document.gameplay.stage
    };

    this.#current = state;
    this.#render();
    this.#unsubscribeCanvas = this.#port.subscribeCanvasMutations(() => {
      this.#recordCanvasMutation();
    });
  }

  close(): void {
    this.#unsubscribeCanvas?.();
    this.#unsubscribeCanvas = null;
    this.#current = null;
  }

  snapshot(): CampaignPairStateV1 | null {
    if (this.#current === null || this.#disposed) {
      return null;
    }
    return {
      activeRole: this.#current.session.activeRole,
      handoffCount: this.#current.session.handoffCount,
      artDirectorActions: this.#current.progress["art-director"],
      strategistActions: this.#current.progress.strategist
    };
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.close();
    this.#disposed = true;
    for (const disposeListener of this.#listenerDisposers.splice(0)) {
      disposeListener();
    }
  }

  #populateAudienceSignals(): void {
    const ownerDocument = this.#view.audienceSignal.ownerDocument;
    const options = AUDIENCE_BRIEFS.map((brief) => {
      const option = ownerDocument.createElement("option");
      option.value = brief.id;
      option.textContent = brief.signal;
      return option;
    });
    this.#view.audienceSignal.replaceChildren(...options);
  }

  #listen(
    target: HTMLElement,
    eventName: "click" | "change",
    listener: EventListener
  ): void {
    target.addEventListener(eventName, listener);
    this.#listenerDisposers.push(() => target.removeEventListener(eventName, listener));
  }

  #swapRoles(): void {
    if (this.#current === null || this.#disposed) {
      return;
    }
    const session = swapActiveRole(this.#current.session);
    this.#replaceCurrent({ ...this.#current, session });
    this.#render();
    this.#notifyPairChange();
    this.#view.polite.textContent = session.activeRole === "art-director"
      ? STUDENT_COPY.handoff.toArtDirector
      : STUDENT_COPY.handoff.toStrategist;
  }

  #changeAudience(): void {
    const sessionId = this.#current?.session.sessionId;
    const briefId = this.#view.audienceSignal.value;
    if (sessionId === undefined || this.#disposed) {
      return;
    }
    this.#enqueue(async () => {
      const brief = getAudienceBrief(briefId);
      await this.#port.setAudienceBrief(brief);
      if (this.#current?.session.sessionId !== sessionId) {
        return;
      }
      const session = selectAudienceBrief(this.#current.session, brief.id);
      this.#replaceCurrent({ ...this.#current, session });
      this.#render();
      this.#view.polite.textContent = STUDENT_COPY.roundZero.audienceChanged;
    }, () => this.#render());
  }

  #addWords(): void {
    if (this.#current === null || this.#disposed) {
      return;
    }
    const value = this.#view.canvasWords.value.trim();
    if (value.length === 0) {
      this.#view.assertive.textContent = STUDENT_COPY.roundZero.blankWords;
      return;
    }
    this.#view.assertive.textContent = "";
    this.#enqueue(async () => {
      await this.#port.addText(value);
      this.#view.canvasWords.value = "";
      this.#view.polite.textContent = STUDENT_COPY.roundZero.wordsAdded;
    });
  }

  #addProductWords(): void {
    if (this.#current === null || this.#disposed) {
      return;
    }
    const value = this.#view.canvasWords.value.trim();
    if (value.length === 0) {
      this.#view.assertive.textContent = STUDENT_COPY.roundZero.blankWords;
      return;
    }
    this.#view.assertive.textContent = "";
    this.#enqueue(async () => {
      const result = await this.#port.addProductText(value);
      if (result === "product-required") {
        this.#view.assertive.textContent = STUDENT_COPY.roundZero.productWordsNeedSelection;
        return;
      }
      this.#view.canvasWords.value = "";
      this.#view.polite.textContent = result === "updated"
        ? STUDENT_COPY.roundZero.productWordsUpdated
        : STUDENT_COPY.roundZero.productWordsAdded;
    });
  }

  #undo(): void {
    if (this.#current === null || this.#disposed) {
      return;
    }
    this.#enqueue(async () => {
      if (!await this.#port.undo()) {
        this.#view.polite.textContent = STUDENT_COPY.roundZero.undoUnavailable;
      }
    });
  }

  #redo(): void {
    if (this.#current === null || this.#disposed) {
      return;
    }
    this.#enqueue(async () => {
      if (!await this.#port.redo()) {
        this.#view.polite.textContent = STUDENT_COPY.roundZero.redoUnavailable;
      }
    });
  }

  #enqueue(operation: () => Promise<void>, onError?: () => void): void {
    this.#operations = this.#operations.then(async () => {
      if (!this.#disposed) {
        await operation();
      }
    }).catch(() => {
      onError?.();
      this.#view.assertive.textContent = STUDENT_COPY.roundZero.operationFailed;
    });
  }

  #recordCanvasMutation(): void {
    if (this.#current === null || this.#disposed) {
      return;
    }
    const progress = recordProductiveAction(
      this.#current.progress,
      this.#current.session.activeRole
    );
    this.#replaceCurrent({ ...this.#current, progress });
    this.#renderProgress();
    this.#notifyPairChange();
  }

  #notifyPairChange(): void {
    const snapshot = this.snapshot();
    if (snapshot !== null) this.#onPairChange(structuredClone(snapshot));
  }

  #replaceCurrent(state: StoredPairState): void {
    this.#current = state;
  }

  #render(): void {
    if (this.#current === null) {
      return;
    }
    const activeRole = this.#current.session.activeRole;
    const partnerRole = oppositeRole(activeRole);
    const prompts = STUDENT_COPY.stageRolePrompts[this.#current.stage];
    this.#view.activeRole.textContent = prompts[activeRole].label;
    this.#view.activeRoleAction.textContent = prompts[activeRole].productiveAction;
    this.#view.partnerRole.textContent = prompts[partnerRole].label;
    this.#view.partnerRoleAction.textContent = prompts[partnerRole].holdingAction;
    this.#view.activeRoleAction.title = prompts[activeRole].productiveAction;
    this.#view.partnerRoleAction.title = prompts[partnerRole].holdingAction;
    this.#view.audienceSignal.value = this.#current.session.audienceBriefId;
    this.#renderBrief(getAudienceBrief(this.#current.session.audienceBriefId));
    this.#renderProgress();
  }

  #renderBrief(brief: AudienceBrief): void {
    this.#view.audienceContext.textContent = brief.context;
    this.#view.audienceNeed.textContent = brief.need;
    this.#view.audienceValues.textContent = brief.values.join(", ");
    this.#view.audienceEffect.textContent = brief.intendedEffect;
  }

  #renderProgress(): void {
    if (this.#current === null) {
      return;
    }
    const progress = this.#current.progress;
    const total = progress["art-director"] + progress.strategist;
    const activeRole = this.#current.session.activeRole;
    const partnerRole = oppositeRole(activeRole);
    const prompts = STUDENT_COPY.stageRolePrompts[this.#current.stage];
    if (bothRolesHaveActed(progress)) {
      this.#view.activeRoleAction.textContent = STUDENT_COPY.roundZero.bothRolesReady;
    } else if (progress[activeRole] > 0) {
      this.#view.activeRoleAction.textContent = partnerRole === "art-director"
        ? STUDENT_COPY.handoff.toArtDirector
        : STUDENT_COPY.handoff.toStrategist;
    } else {
      this.#view.activeRoleAction.textContent = prompts[activeRole].productiveAction;
    }

    if (bothRolesHaveActed(progress)) {
      this.#view.roundProgress.textContent = STUDENT_COPY.roundZero.bothRolesContributed;
    } else if (total === 0) {
      this.#view.roundProgress.textContent = STUDENT_COPY.roundZero.progressNone;
    } else if (total === 1) {
      this.#view.roundProgress.textContent = STUDENT_COPY.roundZero.progressOne;
    } else {
      this.#view.roundProgress.textContent = `${total} ${STUDENT_COPY.roundZero.progressManySuffix}`;
    }
    this.#view.activeRoleAction.title = this.#view.activeRoleAction.textContent ?? "";
  }
}
