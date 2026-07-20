import { fireEvent, getByRole, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createBlankCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import { AUDIENCE_BRIEFS, type AudienceBrief } from "./audience-briefs";
import {
  PairGameController,
  type PairGameView,
  type RoundZeroPort
} from "./pair-game-controller";

class RoundZeroHarness implements RoundZeroPort {
  document: CampaignDocumentV1;
  readonly addedText: string[] = [];
  readonly briefIds: string[] = [];
  undoCount = 0;
  redoCount = 0;
  audienceError: Error | null = null;
  #listener: (() => void) | null = null;

  constructor(document: CampaignDocumentV1) {
    this.document = structuredClone(document);
  }

  async setAudienceBrief(brief: AudienceBrief): Promise<CampaignDocumentV1> {
    if (this.audienceError !== null) {
      throw this.audienceError;
    }
    this.briefIds.push(brief.id);
    this.document.brief = {
      targetAudienceId: brief.id,
      contextId: brief.id,
      purpose: "persuade",
      audienceNeeds: [brief.need],
      audienceValues: [...brief.values],
      intendedEffects: [brief.intendedEffect],
      techniques: []
    };
    return structuredClone(this.document);
  }

  async addText(value: string): Promise<void> {
    this.addedText.push(value);
    this.#listener?.();
  }

  async undo(): Promise<boolean> {
    this.undoCount += 1;
    return true;
  }

  async redo(): Promise<boolean> {
    this.redoCount += 1;
    return true;
  }

  subscribeCanvasMutations(listener: () => void): () => void {
    this.#listener = listener;
    return () => {
      if (this.#listener === listener) {
        this.#listener = null;
      }
    };
  }

  emitCanvasMutation(): void {
    this.#listener?.();
  }
}

function campaignFixture(): CampaignDocumentV1 {
  return createBlankCampaignDocument({
    documentId: "campaign-1",
    sessionId: "session-1",
    mode: "offline"
  });
}

function createPairGameView(): { root: HTMLElement; view: PairGameView } {
  document.body.innerHTML = `
    <main data-test-root>
      <section role="region" aria-label="Pair play">
        <h2 data-active-role></h2>
        <p data-active-role-action></p>
        <p data-partner-role-action></p>
        <p role="status" aria-label="Round progress" data-round-progress></p>
        <button type="button" data-swap-roles>Swap roles</button>
        <label>Audience signal <select data-audience-signal></select></label>
        <section role="region" aria-label="Audience brief">
          <p data-audience-context></p>
          <p data-audience-need></p>
          <p data-audience-values></p>
          <p data-audience-effect></p>
        </section>
      </section>
      <section role="region" aria-label="Round 0 tools">
        <label>Canvas words <input data-canvas-words></label>
        <button type="button" data-add-words>Add words</button>
        <button type="button" data-command="undo">Undo</button>
        <button type="button" data-command="redo">Redo</button>
      </section>
      <p data-live="polite" aria-live="polite"></p>
      <p data-live="assertive" aria-live="assertive"></p>
    </main>`;

  const root = document.querySelector<HTMLElement>("[data-test-root]")!;
  return {
    root,
    view: {
      activeRole: root.querySelector("[data-active-role]")!,
      activeRoleAction: root.querySelector("[data-active-role-action]")!,
      partnerRoleAction: root.querySelector("[data-partner-role-action]")!,
      roundProgress: root.querySelector("[data-round-progress]")!,
      swapRoles: root.querySelector("[data-swap-roles]")!,
      audienceSignal: root.querySelector("[data-audience-signal]")!,
      audienceContext: root.querySelector("[data-audience-context]")!,
      audienceNeed: root.querySelector("[data-audience-need]")!,
      audienceValues: root.querySelector("[data-audience-values]")!,
      audienceEffect: root.querySelector("[data-audience-effect]")!,
      canvasWords: root.querySelector("[data-canvas-words]")!,
      addWords: root.querySelector("[data-add-words]")!,
      undo: root.querySelector('[data-command="undo"]')!,
      redo: root.querySelector('[data-command="redo"]')!,
      polite: root.querySelector('[data-live="polite"]')!,
      assertive: root.querySelector('[data-live="assertive"]')!
    }
  };
}

describe("PairGameController", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("persists a safe default audience before rendering Round 0", async () => {
    const campaign = campaignFixture();
    const port = new RoundZeroHarness(campaign);
    const { root, view } = createPairGameView();
    const controller = new PairGameController(
      view,
      port,
      () => new Date("2026-07-14T03:30:00.000Z")
    );

    await controller.open(campaign);

    expect(port.briefIds).toEqual([AUDIENCE_BRIEFS[0].id]);
    expect(getByRole(root, "heading", { name: "Art Director" })).toBeTruthy();
    const audienceSignal = getByRole<HTMLSelectElement>(root, "combobox", {
      name: "Audience signal"
    });
    expect(audienceSignal.options).toHaveLength(AUDIENCE_BRIEFS.length);
    expect(audienceSignal.value).toBe(AUDIENCE_BRIEFS[0].id);
    expect(root.textContent).toContain(AUDIENCE_BRIEFS[0].context);
    expect(root.textContent).toContain(AUDIENCE_BRIEFS[0].need);
    expect(root.textContent).toContain(AUDIENCE_BRIEFS[0].values.join(", "));
    expect(root.textContent).toContain(AUDIENCE_BRIEFS[0].intendedEffect);
    expect(root.textContent).toContain("Make one visible change.");
  });

  it("tracks both roles across text, canvas changes, handoff and reopen", async () => {
    const campaign = campaignFixture();
    const port = new RoundZeroHarness(campaign);
    const { root, view } = createPairGameView();
    const controller = new PairGameController(view, port);
    await controller.open(campaign);

    fireEvent.input(getByRole(root, "textbox", { name: "Canvas words" }), {
      target: { value: "Make room for adventure" }
    });
    fireEvent.click(getByRole(root, "button", { name: "Add words" }));

    await waitFor(() => {
      expect(port.addedText).toEqual(["Make room for adventure"]);
      expect(root.textContent).toContain("1 visible change");
    });

    fireEvent.click(getByRole(root, "button", { name: "Swap roles" }));
    expect(getByRole(root, "heading", { name: "Strategist" })).toBeTruthy();
    port.emitCanvasMutation();
    expect(root.textContent).toContain("Both roles made a change");

    const persistedPair = controller.snapshot();
    if (persistedPair === null) throw new Error("Expected open pair progress");
    controller.close();
    const reopenedDocument = structuredClone(port.document);
    reopenedDocument.gameplay.pair = persistedPair;
    const reopened = new PairGameController(view, port);
    await reopened.open(reopenedDocument);

    expect(getByRole(root, "heading", { name: "Strategist" })).toBeTruthy();
    expect(root.textContent).toContain("Both roles made a change");
    expect(reopened.snapshot()).toEqual({
      activeRole: "strategist",
      handoffCount: 1,
      artDirectorActions: 1,
      strategistActions: 1
    });
  });

  it("announces pair durability only after handoff and action counters change", async () => {
    const campaign = campaignFixture();
    const port = new RoundZeroHarness(campaign);
    const { root, view } = createPairGameView();
    const changes: unknown[] = [];
    const controller = new PairGameController(
      view,
      port,
      () => new Date("2026-07-17T04:00:00.000Z"),
      (pair) => changes.push(structuredClone(pair))
    );
    await controller.open(campaign);

    fireEvent.click(getByRole(root, "button", { name: "Swap roles" }));
    port.emitCanvasMutation();

    expect(changes).toEqual([
      {
        activeRole: "strategist",
        handoffCount: 1,
        artDirectorActions: 0,
        strategistActions: 0
      },
      {
        activeRole: "strategist",
        handoffCount: 1,
        artDirectorActions: 0,
        strategistActions: 1
      }
    ]);
  });

  it("changes audience details, validates blank words, and routes undo and redo", async () => {
    const campaign = campaignFixture();
    const port = new RoundZeroHarness(campaign);
    const { root, view } = createPairGameView();
    const controller = new PairGameController(view, port);
    await controller.open(campaign);
    const selectedBrief = AUDIENCE_BRIEFS[1];

    fireEvent.change(getByRole(root, "combobox", { name: "Audience signal" }), {
      target: { value: selectedBrief.id }
    });

    await waitFor(() => expect(port.briefIds).toEqual([
      AUDIENCE_BRIEFS[0].id,
      selectedBrief.id
    ]));
    expect(root.textContent).toContain(selectedBrief.context);
    expect(root.textContent).toContain(selectedBrief.need);
    expect(root.textContent).toContain(selectedBrief.values.join(", "));
    expect(root.textContent).toContain(selectedBrief.intendedEffect);

    fireEvent.input(getByRole(root, "textbox", { name: "Canvas words" }), {
      target: { value: "   " }
    });
    fireEvent.click(getByRole(root, "button", { name: "Add words" }));
    expect(view.assertive.textContent).toBe("Type some canvas words first.");
    expect(port.addedText).toEqual([]);

    fireEvent.click(getByRole(root, "button", { name: "Undo" }));
    fireEvent.click(getByRole(root, "button", { name: "Redo" }));
    await waitFor(() => {
      expect(port.undoCount).toBe(1);
      expect(port.redoCount).toBe(1);
    });
  });

  it("removes DOM and canvas listeners when disposed", async () => {
    const campaign = campaignFixture();
    const port = new RoundZeroHarness(campaign);
    const { root, view } = createPairGameView();
    const controller = new PairGameController(view, port);
    await controller.open(campaign);
    controller.dispose();

    fireEvent.click(getByRole(root, "button", { name: "Swap roles" }));
    fireEvent.input(getByRole(root, "textbox", { name: "Canvas words" }), {
      target: { value: "No longer active" }
    });
    fireEvent.click(getByRole(root, "button", { name: "Add words" }));
    port.emitCanvasMutation();

    await Promise.resolve();
    expect(port.addedText).toEqual([]);
    expect(getByRole(root, "heading", { name: "Art Director" })).toBeTruthy();
    expect(root.textContent).toContain("Make one visible change.");
  });

  it("shows safe student copy when an operation fails", async () => {
    const campaign = campaignFixture();
    const port = new RoundZeroHarness(campaign);
    const { root, view } = createPairGameView();
    const controller = new PairGameController(view, port);
    await controller.open(campaign);
    port.audienceError = new Error("Internal assignment record failed");

    fireEvent.change(getByRole(root, "combobox", { name: "Audience signal" }), {
      target: { value: AUDIENCE_BRIEFS[1].id }
    });

    await waitFor(() => {
      expect(view.assertive.textContent).toBe("That move did not work. Try again.");
    });
    expect(root.textContent).not.toContain("Internal assignment record failed");
    expect(getByRole<HTMLSelectElement>(root, "combobox", { name: "Audience signal" }).value)
      .toBe(AUDIENCE_BRIEFS[0].id);
  });
});
