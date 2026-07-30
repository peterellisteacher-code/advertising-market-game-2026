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
  readonly addedProductText: string[] = [];
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
    value: string
  ): ReturnType<RoundZeroPort["addProductText"]> {
    this.addedProductText.push(value);
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
        <p data-active-role-action></p>
        <span data-partner-role></span>
        <p data-partner-role-action></p>
        <p role="status" aria-label="Pair progress" data-round-progress></p>
        <button type="button" data-swap-roles>Swap roles</button>
        <label>Audience signal <select data-audience-signal></select></label>
        <section role="region" aria-label="Audience brief">
          <p data-audience-context></p>
          <p data-audience-need></p>
          <p data-audience-values></p>
          <p data-audience-effect></p>
        </section>
      </section>
      <section role="region" aria-label="Pair tools">
        <label>Canvas words <input data-canvas-words></label>
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
      activeRoleAction: root.querySelector("[data-active-role-action]")!,
      partnerRole: root.querySelector("[data-partner-role]")!,
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
      name: "Audience signal"
    });
    expect(audienceSignal.options).toHaveLength(AUDIENCE_BRIEFS.length);
    expect(audienceSignal.value).toBe(AUDIENCE_BRIEFS[0].id);
    expect(root.textContent).toContain(AUDIENCE_BRIEFS[0].context);
    expect(root.textContent).toContain(AUDIENCE_BRIEFS[0].need);
    expect(root.textContent).toContain(AUDIENCE_BRIEFS[0].values.join(", "));
    expect(root.textContent).toContain(AUDIENCE_BRIEFS[0].intendedEffect);
    expect(view.activeRoleAction.textContent)
      .toBe("Build the product. Place it on the ad, then enlarge it for a clear close-up.");
    expect(view.partnerRole.textContent).toBe("Strategist");
    expect(view.partnerRoleAction.textContent)
      .toBe("Read the audience need. Prepare a product name and one useful benefit.");
    expect(view.roundProgress.textContent).toContain(
      "Art Director: visible canvas change not yet recorded."
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

    fireEvent.input(getByRole(root, "textbox", { name: "Canvas words" }), {
      target: { value: "Make room for adventure" }
    });
    fireEvent.click(getByRole(root, "button", { name: "Add words to ad" }));

    await waitFor(() => {
      expect(port.addedText).toEqual(["Make room for adventure"]);
      expect(root.textContent).toContain("Art Director: visible canvas change recorded.");
      expect(view.activeRoleAction.textContent).toBe(
        "Complete the current visual choice. Then choose Swap roles. The Strategist leads the next message decision."
      );
    });

    fireEvent.click(getByRole(root, "button", { name: "Swap roles" }));
    expect(getByRole(root, "heading", { name: "Strategist" })).toBeTruthy();
    expect(view.activeRoleAction.textContent)
      .toBe("Name the product. Add one clear benefit to the ad.");
    expect(view.partnerRole.textContent).toBe("Art Director");
    expect(view.partnerRoleAction.textContent)
      .toBe("Check that the product is large, clear and easy to recognise.");
    port.emitCanvasMutation();
    expect(view.activeRoleAction.textContent)
      .toBe("Name the product. Add one clear benefit to the ad.");
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
    expect(view.activeRoleAction.textContent)
      .toBe("Name the product. Add one clear benefit to the ad.");
    expect(reopened.snapshot()).toEqual({
      activeRole: "strategist",
      handoffCount: 1,
      artDirectorActions: 1,
      strategistActions: 1,
      roleGuideAcknowledged: false
    });
  });

  it("changes both partner jobs with the current game stage", async () => {
    const campaign = campaignFixture();
    campaign.gameplay.stage = "sell";
    const port = new RoundZeroHarness(campaign);
    const { view } = createPairGameView();
    const controller = new PairGameController(view, port);

    await controller.open(campaign);

    expect(view.activeRoleAction.textContent)
      .toBe("Choose one visual technique. Use it to direct the audience's attention.");
    expect(view.partnerRoleAction.textContent)
      .toBe("Check the next AIDA step. Prepare one message suggestion.");

    campaign.gameplay.stage = "irresistible";
    await controller.open(campaign);
    expect(view.activeRoleAction.textContent)
      .toBe("Check the image, spacing and text placement. Fix one visual problem.");
    expect(view.partnerRoleAction.textContent)
      .toBe("Check the price and market route against the audience need.");
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
    fireEvent.click(getByRole(root, "button", { name: "Add words to ad" }));
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
    fireEvent.click(getByRole(root, "button", { name: "Add words to ad" }));
    port.emitCanvasMutation();

    await Promise.resolve();
    expect(port.addedText).toEqual([]);
    expect(getByRole(root, "heading", { name: "Art Director" })).toBeTruthy();
    expect(view.activeRoleAction.textContent)
      .toBe("Build the product. Place it on the ad, then enlarge it for a clear close-up.");
  });

  it("routes selected-product words and explains when a product is not selected", async () => {
    const campaign = campaignFixture();
    const port = new RoundZeroHarness(campaign);
    const { root, view } = createPairGameView();
    const controller = new PairGameController(view, port);
    await controller.open(campaign);
    const words = getByRole<HTMLInputElement>(root, "textbox", { name: "Canvas words" });

    fireEvent.input(words, { target: { value: "Keeps drinks warm longer" } });
    fireEvent.click(getByRole(root, "button", { name: "Put words on selected product" }));
    await waitFor(() => expect(port.addedProductText).toEqual(["Keeps drinks warm longer"]));
    expect(view.polite.textContent).toBe("Words added to the selected product.");
    expect(words.value).toBe("");

    port.productTextResult = "product-required";
    fireEvent.input(words, { target: { value: "Try again" } });
    fireEvent.click(getByRole(root, "button", { name: "Put words on selected product" }));
    await waitFor(() => expect(port.addedProductText).toEqual([
      "Keeps drinks warm longer",
      "Try again"
    ]));
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
