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
  document.gameplay.pair.roleGuideAcknowledged = true;
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
  document.gameplay.pair.artDirectorActions = 2;
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
    expect(guide.textContent).toContain("Build · Task 1 of 3");
    expect(guide.textContent).toContain("Choose one starter product");
    expect(guide.textContent?.toLowerCase()).toContain("product edit");
    expect(guide.textContent).toContain("appears in the advertisement");
    fireEvent.click(getByRole(guide, "button", { name: "Open Build" }));
    expect(openStep).toHaveBeenCalledOnce();
    expect(openStep.mock.calls[0]![0]).toMatchObject({
      id: "starter-product",
      tool: "product"
    });
  });

  it("shows optional product and image methods without making them completion gates", () => {
    const { root, controller } = setup();
    const document = campaign();
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
    document.gameplay.pair.artDirectorActions = 1;

    controller.setCampaign(document);

    const guide = getByRole(root, "region", { name: "Current instruction" });
    const methods = guide.querySelector<HTMLDetailsElement>("[data-guide-methods]")!;
    expect(methods.hidden).toBe(false);
    expect(methods.getAttribute("role")).toBe("group");
    expect(methods.getAttribute("aria-label")).toBe("Available methods");
    expect(methods.textContent).toContain("Fill");
    expect(methods.textContent).toContain("Delete");
    expect(methods.textContent).toContain("Logo");
    expect(methods.textContent).toContain("Image Lab");
    expect(methods.textContent).toContain("remaining uses");
    expect(methods.textContent).not.toMatch(/\bcode\b/i);
  });

  it("navigates the six-page reference manual with labelled controls and cleans up listeners", () => {
    const { root, controller } = setup();
    controller.setCampaign(campaign());
    const dialog = root.querySelector<HTMLElement>("[data-guide-dialog]")!;

    const reviewButtons = getAllByRole(root, "button", { name: "How to use this site" });
    fireEvent.click(reviewButtons[0]!);

    expect(getByRole(root, "dialog", { name: "How to use this site" }))
      .toBe(dialog);
    expect(dialog.hidden).toBe(false);
    expect(dialog.textContent).toContain("Page 1 of 6 · Goal");
    expect(dialog.querySelector<HTMLButtonElement>("[data-guide-previous]")!.hidden).toBe(true);
    const previous = dialog.querySelector<HTMLButtonElement>("[data-guide-previous]")!;
    const next = dialog.querySelector<HTMLButtonElement>("[data-guide-next]")!;
    expect(dialog.querySelectorAll("[data-guide-manual-page]:not([hidden])")).toHaveLength(1);
    fireEvent.click(next);
    expect(dialog.textContent).toContain("Page 2 of 6 · Brief");
    expect(previous.hidden).toBe(false);
    expect(dialog.querySelectorAll("[data-guide-manual-page]:not([hidden])")).toHaveLength(1);
    fireEvent.click(previous);
    expect(dialog.textContent).toContain("Page 1 of 6 · Goal");
    for (let page = 1; page <= 6; page += 1) fireEvent.click(next);
    expect(dialog.textContent).toContain("Page 6 of 6 · Pitch");
    expect(next.hidden).toBe(true);
    expect(dialog.querySelectorAll("[data-guide-manual-page]:not([hidden])")).toHaveLength(1);
    expect(document.activeElement).toBe(
      getByRole(dialog, "button", { name: "Close guide" })
    );
    expect(root.querySelector<HTMLElement>(".creator__topbar")!.inert).toBe(true);
    expect(root.querySelector<HTMLElement>(".creator__workspace")!.inert).toBe(true);
    expect(dialog.inert).not.toBe(true);

    const close = getByRole<HTMLButtonElement>(dialog, "button", { name: "Close guide" });
    fireEvent.keyDown(close, { key: "Tab" });
    expect(document.activeElement).toBe(previous);
    fireEvent.keyDown(previous, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(dialog.hidden).toBe(true);
    expect(root.querySelector<HTMLElement>(".creator__topbar")!.inert).toBe(false);
    expect(root.querySelector<HTMLElement>(".creator__workspace")!.inert).toBe(false);
    expect(document.activeElement).toBe(reviewButtons[0]);

    fireEvent.click(reviewButtons[1]!);
    expect(dialog.hidden).toBe(false);
    controller.destroy();
    fireEvent.click(next);
    expect(dialog.hidden).toBe(true);
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
    const lockStatus = root.querySelector<HTMLElement>("[data-locked-actions-status]")!;
    expect(lockStatus.hidden).toBe(false);
    expect(lockStatus.textContent)
      .toContain("Route: Set the product price and make it visible in the advertisement first.");
    expect(route.getAttribute("aria-describedby")).toBe(lockStatus.id);
    expect(route.getAttribute("title")).toBeNull();

    document.evidence.price = ["price-label"];
    controller.setCampaign(document);
    expect(route.disabled).toBe(false);
    expect(route.hasAttribute("aria-describedby")).toBe(false);
  });

  it("shows and describes every visible disabled AIDA or Price action", () => {
    const { root, controller } = setup();
    const document = campaign("sell");
    completeInvent(document);

    controller.setCampaign(document);

    const attention = root.querySelector<HTMLButtonElement>("[data-slot=attention]")!;
    const interest = root.querySelector<HTMLButtonElement>("[data-slot=interest]")!;
    const desire = root.querySelector<HTMLButtonElement>("[data-slot=desire]")!;
    const price = root.querySelector<HTMLButtonElement>("[data-slot=price]")!;
    const lockStatus = root.querySelector<HTMLElement>("[data-locked-actions-status]")!;
    expect(attention.disabled).toBe(false);
    expect(interest.disabled).toBe(true);
    expect(desire.disabled).toBe(true);
    expect(price.disabled).toBe(true);
    expect(lockStatus.hidden).toBe(false);
    expect(lockStatus.textContent).toContain("Interest: Complete attention first.");
    expect(lockStatus.textContent).toContain(
      "Price: Complete Attention, Interest, Desire and Action first."
    );
    expect(interest.getAttribute("aria-describedby")).toBe(lockStatus.id);
    expect(price.getAttribute("aria-describedby")).toBe(lockStatus.id);
    expect(interest.getAttribute("title")).toBeNull();
    expect(price.getAttribute("title")).toBeNull();

    completeAida(document, "attention");
    controller.setCampaign(document);
    expect(interest.disabled).toBe(false);
    expect(interest.hasAttribute("aria-describedby")).toBe(false);
    expect(lockStatus.textContent).not.toContain("Interest:");
    expect(lockStatus.textContent).toContain("Desire: Complete interest first.");
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
