import { describe, expect, it } from "vitest";
import {
  createBlankCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import { evaluateGuidedJourney } from "./guided-journey";

function campaign(): CampaignDocumentV1 {
  const document = createBlankCampaignDocument({
    documentId: "campaign-1",
    sessionId: "session-1",
    mode: "offline"
  });
  document.brief.targetAudienceId = "after-school-wanderers";
  return document;
}

function placeProduct(document: CampaignDocumentV1): void {
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
}

function completePairContribution(document: CampaignDocumentV1): void {
  document.gameplay.pair.handoffCount = 1;
  document.gameplay.pair.artDirectorActions = 1;
  document.gameplay.pair.strategistActions = 1;
}

function completeAida(
  document: CampaignDocumentV1,
  stage: "attention" | "interest" | "desire" | "action"
): void {
  document.strategy.aidaPlan[stage] = `Recorded ${stage} explanation.`;
  document.evidence[stage] = [`${stage}-object`];
}

describe("evaluateGuidedJourney", () => {
  it("advances through the linked student journey from product to market route", () => {
    const document = campaign();
    expect(evaluateGuidedJourney(document).current.id).toBe("product");

    placeProduct(document);
    expect(evaluateGuidedJourney(document).current.id).toBe("product-name");

    document.product.name = "Study Flask";
    expect(evaluateGuidedJourney(document).current.id).toBe("pair-contribution");

    completePairContribution(document);
    expect(evaluateGuidedJourney(document).current).toMatchObject({
      id: "finish-level-1",
      tool: "game",
      actionLabel: "Return to game"
    });

    document.gameplay.stage = "sell";
    expect(evaluateGuidedJourney(document).current.id).toBe("attention");

    completeAida(document, "attention");
    expect(evaluateGuidedJourney(document).current.id).toBe("interest");

    completeAida(document, "interest");
    expect(evaluateGuidedJourney(document).current.id).toBe("desire");

    completeAida(document, "desire");
    expect(evaluateGuidedJourney(document).current.id).toBe("action");

    completeAida(document, "action");
    expect(evaluateGuidedJourney(document).current).toMatchObject({
      id: "finish-level-2",
      tool: "game",
      actionLabel: "Return to game"
    });

    document.gameplay.stage = "irresistible";
    expect(evaluateGuidedJourney(document).current.id).toBe("price-position");

    document.product.pricePosition = "everyday";
    expect(evaluateGuidedJourney(document).current.id).toBe("price-evidence");

    document.product.priceCents = 5900;
    document.evidence.price = ["price-label"];
    expect(evaluateGuidedJourney(document).current.id).toBe("market-route");

    document.strategy.marketRoute = {
      audienceBriefId: "after-school-wanderers",
      zoneId: "city",
      mediaIds: ["transit"],
      proofPoint: "The insulated bottle kept water cold for eight hours.",
      committed: true
    };
    expect(evaluateGuidedJourney(document).current).toMatchObject({
      id: "finish-level-3",
      tool: "game",
      actionLabel: "Return to game"
    });

    document.gameplay.stage = "publish-check";
    expect(evaluateGuidedJourney(document).current).toMatchObject({
      id: "final-review",
      tool: "game",
      actionLabel: "Return to game"
    });
  });

  it("does not direct students to tools that the current level has not opened", () => {
    const document = campaign();
    placeProduct(document);
    document.product.name = "Study Flask";
    completePairContribution(document);

    const levelOneTransition = evaluateGuidedJourney(document);
    expect(levelOneTransition.progressLabel).toBe("Level 1 studio work complete");
    expect(levelOneTransition.current.now).toBe("Return to the game and lock Level 1.");
    expect(levelOneTransition.current.next).toContain("Attention");

    document.gameplay.stage = "sell";
    for (const stage of ["attention", "interest", "desire", "action"] as const) {
      completeAida(document, stage);
    }
    const levelTwoTransition = evaluateGuidedJourney(document);
    expect(levelTwoTransition.progressLabel).toBe("Level 2 studio work complete");
    expect(levelTwoTransition.current.now).toBe("Return to the game and lock Level 2.");
    expect(levelTwoTransition.current.next).toContain("Price position");
  });

  it("starts with audience evidence when no brief has been selected", () => {
    const document = campaign();
    document.brief.targetAudienceId = "";

    expect(evaluateGuidedJourney(document).current.id).toBe("audience");
  });

  it("requires both recorded roles and one handoff for the pair contribution", () => {
    const document = campaign();
    placeProduct(document);
    document.product.name = "Study Flask";
    document.gameplay.pair.handoffCount = 1;
    document.gameplay.pair.artDirectorActions = 2;

    const state = evaluateGuidedJourney(document);

    expect(state.current.id).toBe("pair-contribution");
    expect(state.current.done.toLowerCase()).toContain("both partners");
    expect(state.current.done.toLowerCase()).toContain("roles");
    expect(state.current.why).toContain("visual and message decisions");
  });

  it("requires an explanation and visible evidence for each AIDA stage", () => {
    const document = campaign();
    placeProduct(document);
    document.product.name = "Study Flask";
    completePairContribution(document);
    document.gameplay.stage = "sell";
    document.strategy.aidaPlan.attention = "Use contrast around the product.";

    expect(evaluateGuidedJourney(document).current.id).toBe("attention");

    document.evidence.attention = ["contrast-shape"];
    expect(evaluateGuidedJourney(document).current.id).toBe("interest");
  });

  it("keeps every step available and links each nonterminal next statement to the following step", () => {
    const steps = evaluateGuidedJourney(campaign()).steps;

    expect(steps.map(({ id }) => id)).toEqual([
      "audience",
      "product",
      "product-name",
      "pair-contribution",
      "attention",
      "interest",
      "desire",
      "action",
      "price-position",
      "price-evidence",
      "market-route"
    ]);
    for (let index = 0; index < steps.length - 1; index += 1) {
      expect(steps[index]!.next.toLowerCase()).toContain(
        steps[index + 1]!.title.toLowerCase()
      );
    }
  });

  it("states how every step contributes to a later campaign outcome", () => {
    const steps = evaluateGuidedJourney(campaign()).steps;
    const expectedLaterOutcome = {
      audience: "product",
      product: "advertisement",
      "product-name": "advertisement",
      "pair-contribution": "advertisement",
      attention: "interest",
      interest: "value",
      desire: "action",
      action: "offer",
      "price-position": "offer",
      "price-evidence": "market route",
      "market-route": "final review"
    } as const;

    for (const step of steps) {
      const outcome = expectedLaterOutcome[
        step.id as keyof typeof expectedLaterOutcome
      ];
      expect(outcome).toBeDefined();
      expect(step.why.toLowerCase()).toContain(outcome);
    }
  });
});
