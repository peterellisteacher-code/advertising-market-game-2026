import { fireEvent, getByRole, waitFor } from "@testing-library/dom";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createBlankCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import { AUDIENCE_BRIEFS, type AudienceBrief } from "./audience-briefs";
import type { CurvedLabelFontFamily } from "../product-kit/curved-label-renderer";
import {
  PairGameController,
  type PairGameView,
  type RoundZeroPort
} from "./pair-game-controller";

class RoundZeroHarness implements RoundZeroPort {
  document: CampaignDocumentV1;
  readonly addedText: string[] = [];
  readonly addedProductText: string[] = [];
  readonly productTextFonts: Array<CurvedLabelFontFamily | undefined> = [];
  readonly briefIds: string[] = [];
  productTextResult: Awaited<ReturnType<RoundZeroPort["addProductText"]>> = "added";
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

  async addProductText(
    value: string,
    fontFamily?: CurvedLabelFontFamily
  ): ReturnType<RoundZeroPort["addProductText"]> {
    this.addedProductText.push(value);
    this.productTextFonts.push(fontFamily);
    if (this.productTextResult !== "product-required") this.#listener?.();
    return this.productTextResult;
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
        <span data-partner-role></span>
        <p role="status" aria-label="Pair progress" data-round-progress></p>
        <button type="button" data-swap-roles>Swap roles</button>
      <label>Audience brief <select data-audience-signal></select></label>
        <section role="region" aria-label="Audience brief">
          <p data-audience-context></p>
          <p data-audience-need></p>
          <p data-audience-values></p>
          <p data-audience-effect></p>
        </section>
      </section>
      <section role="region" aria-label="Pair tools">
    <label>Advertisement words <input data-canvas-words></label>
        <label>Curved product typeface <select data-product-typeface>
          <option value="">Keep current</option>
          <option value="Russo One">Russo One</option>
        </select></label>
        <button type="button" data-add-words>Add words to ad</button>
        <button type="button" data-add-product-words>Put words on selected product</button>
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
      partnerRole: root.querySelector("[data-partner-role]")!,
      roundProgress: root.querySelector("[data-round-progress]")!,
      swapRoles: root.querySelector("[data-swap-roles]")!,
      audienceSignal: root.querySelector("[data-audience-signal]")!,
      audienceContext: root.querySelector("[data-audience-context]")!,
      audienceNeed: root.querySelector("[data-audience-need]")!,
      audienceValues: root.querySelector("[data-audience-values]")!,
      audienceEffect: root.querySelector("[data-audience-effect]")!,
      canvasWords: root.querySelector("[data-canvas-words]")!,
      productTypeface: root.querySelector("[data-product-typeface]")!,
      addWords: root.querySelector("[data-add-words]")!,
      productWords: root.querySelector("[data-add-product-words]")!,
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
      name: "Audience brief"
    });
    expect(audienceSignal.options).toHaveLength(AUDIENCE_BRIEFS.length);
    expect(audienceSignal.value).toBe(AUDIENCE_BRIEFS[0].id);
    expect(root.textContent).toContain(AUDIENCE_BRIEFS[0].context);
    expect(root.textContent).toContain(AUDIENCE_BRIEFS[0].need);
    expect(root.textContent).toContain(AUDIENCE_BRIEFS[0].values.join(", "));
    expect(root.textContent).toContain(AUDIENCE_BRIEFS[0].intendedEffect);
    expect(view.partnerRole.textContent).toBe("Strategist");
    expect(root.querySelector("[data-active-role-action]")).toBeNull();
    expect(view.roundProgress.textContent).toContain(
      "Art Director: visible advertisement edit not yet recorded."
    );
    expect(view.roundProgress.textContent).toContain(
      "Strategist: message or strategy change not yet recorded."
    );
    expect(view.roundProgress.textContent).toContain("Roles have not been swapped yet.");
  });

  it("tracks both roles across text, canvas changes, handoff and reopen", async () => {
    const campaign = campaignFixture();
    const port = new RoundZeroHarness(campaign);
    const { root, view } = createPairGameView();
    const controller = new PairGameController(view, port);
    await controller.open(campaign);

    fireEvent.input(getByRole(root, "textbox", { name: "Advertisement words" }), {
      target: { value: "Make room for adventure" }
    });
    fireEvent.click(getByRole(root, "button", { name: "Add words to ad" }));

    await waitFor(() => {
      expect(port.addedText).toEqual(["Make room for adventure"]);
      expect(root.textContent).toContain("Art Director: visible advertisement edit recorded.");
      // The swap prompt is announced through the status region, not shown
      // as standing copy.
      expect(view.roundProgress.textContent).toContain(
        "Complete the current visual choice. Then choose Swap roles. The Strategist leads the next message decision."
      );
    });

    fireEvent.click(getByRole(root, "button", { name: "Swap roles" }));
    expect(getByRole(root, "heading", { name: "Strategist" })).toBeTruthy();
    expect(view.partnerRole.textContent).toBe("Art Director");
    port.emitCanvasMutation();
    expect(view.roundProgress.textContent).toContain(
      "Strategist: message or strategy change recorded."
    );
    expect(view.roundProgress.textContent).toContain("Roles have been swapped once.");

    const persistedPair = controller.snapshot();
    if (persistedPair === null) throw new Error("Expected open pair progress");
    controller.close();
    const reopenedDocument = structuredClone(port.document);
    reopenedDocument.gameplay.pair = persistedPair;
    const reopened = new PairGameController(view, port);
    await reopened.open(reopenedDocument);

    expect(getByRole(root, "heading", { name: "Strategist" })).toBeTruthy();
    expect(reopened.snapshot()).toEqual({
      activeRole: "strategist",
      handoffCount: 1,
      artDirectorActions: 1,
      strategistActions: 1,
      roleGuideAcknowledged: false
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
    expect(view.polite.textContent).toContain("responsibilities");
    expect(view.polite.textContent).toContain("recorded authorship history remains");
    port.emitCanvasMutation();

    expect(changes).toEqual([
      {
        activeRole: "strategist",
        handoffCount: 1,
        artDirectorActions: 0,
        strategistActions: 0,
        roleGuideAcknowledged: false
      },
      {
        activeRole: "strategist",
        handoffCount: 1,
        artDirectorActions: 0,
        strategistActions: 1,
        roleGuideAcknowledged: false
      }
    ]);
  });

  it("persists role-guide acknowledgement without changing contribution history", async () => {
    const campaign = campaignFixture();
    const port = new RoundZeroHarness(campaign);
    const { view } = createPairGameView();
    const changes: CampaignDocumentV1["gameplay"]["pair"][] = [];
    const controller = new PairGameController(
      view,
      port,
      undefined,
      (pair) => changes.push(pair)
    );
    await controller.open(campaign);

    controller.acknowledgeRoleGuide();
    controller.acknowledgeRoleGuide();

    expect(controller.snapshot()).toEqual({
      activeRole: "art-director",
      handoffCount: 0,
      artDirectorActions: 0,
      strategistActions: 0,
      roleGuideAcknowledged: true
    });
    expect(changes).toHaveLength(1);
  });

  it("changes audience details, validates blank words, and routes undo and redo", async () => {
    const campaign = campaignFixture();
    const port = new RoundZeroHarness(campaign);
    const { root, view } = createPairGameView();
    const controller = new PairGameController(view, port);
    await controller.open(campaign);
    const selectedBrief = AUDIENCE_BRIEFS[1];

    fireEvent.change(getByRole(root, "combobox", { name: "Audience brief" }), {
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

    fireEvent.input(getByRole(root, "textbox", { name: "Advertisement words" }), {
      target: { value: "   " }
    });
    fireEvent.click(getByRole(root, "button", { name: "Add words to ad" }));
    expect(view.assertive.textContent).toBe("Type advertisement words first.");
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
    fireEvent.input(getByRole(root, "textbox", { name: "Advertisement words" }), {
      target: { value: "No longer active" }
    });
    fireEvent.click(getByRole(root, "button", { name: "Add words to ad" }));
    port.emitCanvasMutation();

    await Promise.resolve();
    expect(port.addedText).toEqual([]);
    expect(getByRole(root, "heading", { name: "Art Director" })).toBeTruthy();
  });

  it("routes selected-product words and explains when a product is not selected", async () => {
    const campaign = campaignFixture();
    const port = new RoundZeroHarness(campaign);
    const { root, view } = createPairGameView();
    const controller = new PairGameController(view, port);
    await controller.open(campaign);
    const words = getByRole<HTMLInputElement>(root, "textbox", { name: "Advertisement words" });
    const typeface = getByRole<HTMLSelectElement>(root, "combobox", {
      name: "Curved product typeface"
    });

    fireEvent.change(typeface, { target: { value: "Russo One" } });
    fireEvent.input(words, { target: { value: "Keeps drinks warm longer" } });
    fireEvent.click(getByRole(root, "button", { name: "Put words on selected product" }));
    await waitFor(() => expect(port.addedProductText).toEqual(["Keeps drinks warm longer"]));
    expect(port.productTextFonts).toEqual(["Russo One"]);
    expect(view.polite.textContent).toBe("Words added to the selected product.");
    expect(words.value).toBe("");

    port.productTextResult = "product-required";
    fireEvent.input(words, { target: { value: "Try again" } });
    fireEvent.click(getByRole(root, "button", { name: "Put words on selected product" }));
    await waitFor(() => expect(port.addedProductText).toEqual([
      "Keeps drinks warm longer",
      "Try again"
    ]));
    expect(port.productTextFonts).toEqual(["Russo One", "Russo One"]);
    expect(view.assertive.textContent).toBe("Select a product with a label area first.");
    expect(words.value).toBe("Try again");
  });

  it("shows safe student copy when an operation fails", async () => {
    const campaign = campaignFixture();
    const port = new RoundZeroHarness(campaign);
    const { root, view } = createPairGameView();
    const controller = new PairGameController(view, port);
    await controller.open(campaign);
    port.audienceError = new Error("Internal assignment record failed");

    fireEvent.change(getByRole(root, "combobox", { name: "Audience brief" }), {
      target: { value: AUDIENCE_BRIEFS[1].id }
    });

    await waitFor(() => {
    expect(view.assertive.textContent).toBe("That action did not work. Try again.");
    });
    expect(root.textContent).not.toContain("Internal assignment record failed");
    expect(getByRole<HTMLSelectElement>(root, "combobox", { name: "Audience brief" }).value)
      .toBe(AUDIENCE_BRIEFS[0].id);
  });
});
