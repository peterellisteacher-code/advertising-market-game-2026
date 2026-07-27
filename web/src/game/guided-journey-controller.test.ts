import { fireEvent, getAllByRole, getByRole } from "@testing-library/dom";
import { describe, expect, it, vi } from "vitest";
import {
  createBlankCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import { createEditorShell } from "../ui/editor-shell";
import { GuidedJourneyController } from "./guided-journey-controller";

function campaign(stage: CampaignDocumentV1["gameplay"]["stage"] = "invent"): CampaignDocumentV1 {
  const document = createBlankCampaignDocument({
    documentId: "campaign-1",
    sessionId: "session-1",
    mode: "offline"
  });
  document.brief.targetAudienceId = "after-school-wanderers";
  document.gameplay.stage = stage;
  return document;
}

function completeInvent(document: CampaignDocumentV1): void {
  document.product.build = {
    schema: "product-build@1",
    primaryObjectId: "product-1",
    packId: "pack-1",
    pricingVersion: 1,
    blueprintId: "tumbler",
    selections: [{ groupId: "body", choiceIds: ["steel"] }],
    costLines: [{
      groupId: "body",
      groupLabel: "Material",
      kind: "material",
      choiceId: "steel",
      label: "Insulated steel",
      costCents: 3500
    }],
    unitCostCents: 3500
  };
  document.product.name = "Study Flask";
  document.gameplay.pair.handoffCount = 1;
  document.gameplay.pair.artDirectorActions = 1;
  document.gameplay.pair.strategistActions = 1;
}

function completeAida(
  document: CampaignDocumentV1,
  stage: "attention" | "interest" | "desire" | "action"
): void {
  document.strategy.aidaPlan[stage] = `${stage} explanation`;
  document.evidence[stage] = [`${stage}-evidence`];
}

function setup() {
  document.body.innerHTML = '<div id="creator-root"></div>';
  const root = document.querySelector<HTMLElement>("#creator-root")!;
  createEditorShell(root);
  const openStep = vi.fn();
  const controller = new GuidedJourneyController(root, openStep);
  return { root, controller, openStep };
}

describe("GuidedJourneyController", () => {
  it("renders the current Now, Why, Done and Next reference and opens its tool", () => {
    const { root, controller, openStep } = setup();

    controller.setCampaign(campaign());

    const guide = getByRole(root, "region", { name: "Current instruction" });
    expect(guide.textContent).toContain("Step 2 of 11");
    expect(guide.textContent).toContain("Build one product");
    expect(guide.textContent).toContain("A suitable product");
    expect(guide.textContent).toContain("built and placed");
    expect(guide.textContent).toContain("Product name");
    fireEvent.click(getByRole(guide, "button", { name: "Open Product" }));
    expect(openStep).toHaveBeenCalledOnce();
    expect(openStep.mock.calls[0]![0]).toMatchObject({ id: "product", tool: "product" });
  });

  it("keeps the complete instruction argument available from both review buttons", () => {
    const { root, controller } = setup();
    controller.setCampaign(campaign());
    const dialog = root.querySelector<HTMLElement>("[data-guide-dialog]")!;

    const reviewButtons = getAllByRole(root, "button", { name: "How to use this site" });
    fireEvent.click(reviewButtons[0]!);

    expect(getByRole(root, "dialog", { name: "How to use this site" }))
      .toBe(dialog);
    expect(dialog.hidden).toBe(false);
    expect([...dialog.querySelectorAll<HTMLElement>("[data-instruction-claim-id]")]
      .map(({ dataset }) => dataset.instructionClaimId)).toEqual([
        "P1", "P2", "P3", "ICA",
        "P5", "P6", "P7", "P8", "ICB",
        "P10", "P11", "P12", "P13", "ICC",
        "P15", "P16", "P17", "P18", "ICD",
        "P20", "P21", "P22", "P23", "P24", "C"
      ]);
    expect([...dialog.querySelectorAll("h3")].map(({ textContent }) => textContent))
      .toEqual([
        "A. Establish a shared audience purpose",
        "B. Turn the audience purpose into a product",
        "C. Turn the product into an advertisement",
        "D. Turn the advertisement into a credible offer",
        "E. Turn the offer into a completed market entry"
      ]);
    expect(document.activeElement).toBe(
      getByRole(dialog, "button", { name: "Close guide" })
    );

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(dialog.hidden).toBe(true);

    fireEvent.click(reviewButtons[1]!);
    expect(dialog.hidden).toBe(false);
  });

  it("unlocks AIDA checklist stages one at a time while preserving completed stages", () => {
    const { root, controller } = setup();
    const document = campaign("sell");
    completeInvent(document);

    controller.setCampaign(document);

    expect(root.querySelector<HTMLButtonElement>("[data-slot=attention]")!.disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>("[data-slot=interest]")!.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>("[data-slot=desire]")!.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>("[data-slot=action]")!.disabled).toBe(true);

    completeAida(document, "attention");
    controller.setCampaign(document);

    expect(root.querySelector<HTMLButtonElement>("[data-slot=attention]")!.disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>("[data-slot=interest]")!.disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>("[data-slot=desire]")!.disabled).toBe(true);
  });

  it("keeps completed AIDA work available when an earlier pair requirement is incomplete", () => {
    const { root, controller } = setup();
    const document = campaign("sell");
    completeInvent(document);
    document.gameplay.pair.handoffCount = 0;
    document.gameplay.pair.artDirectorActions = 0;
    document.gameplay.pair.strategistActions = 0;
    completeAida(document, "attention");

    controller.setCampaign(document);

    expect(root.querySelector<HTMLButtonElement>("[data-slot=attention]")!.disabled).toBe(false);
    expect(root.querySelector<HTMLButtonElement>("[data-slot=interest]")!.disabled).toBe(true);
  });

  it("keeps the market route unavailable until price evidence is visible", () => {
    const { root, controller } = setup();
    const document = campaign("irresistible");
    completeInvent(document);
    for (const stage of ["attention", "interest", "desire", "action"] as const) {
      completeAida(document, stage);
    }
    document.product.pricePosition = "everyday";
    document.product.priceCents = 5900;
    const route = root.querySelector<HTMLButtonElement>('[data-studio-tool="route"]')!;

    controller.setCampaign(document);
    expect(route.disabled).toBe(true);

    document.evidence.price = ["price-label"];
    controller.setCampaign(document);
    expect(route.disabled).toBe(false);
  });

  it("presents a return-to-game transition before the next level's tools", () => {
    const { root, controller, openStep } = setup();
    const document = campaign("invent");
    completeInvent(document);

    controller.setCampaign(document);

    const guide = getByRole(root, "region", { name: "Current instruction" });
    expect(guide.textContent).toContain("Level 1 studio work complete");
    expect(guide.textContent).toContain("Return to the game and lock Level 1.");
    fireEvent.click(getByRole(guide, "button", { name: "Return to game" }));
    expect(openStep).toHaveBeenCalledWith(expect.objectContaining({
      id: "finish-level-1",
      tool: "game"
    }));
  });

  it("clears the current instruction when the campaign closes", () => {
    const { root, controller } = setup();
    controller.setCampaign(campaign());

    controller.setCampaign(null);

    expect(root.querySelector<HTMLElement>("[data-guide]")!.hidden).toBe(true);
  });
});
