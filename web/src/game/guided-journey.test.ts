import { describe, expect, it } from "vitest";
import {
  createBlankCampaignDocument,
  type CampaignDocumentV1
} from "../domain/campaign-document";
import {
  evaluateGuidedJourney,
  GUIDED_JOURNEY_ORDER
} from "./guided-journey";
import { flattenInstructionArgument, INSTRUCTION_ARGUMENT } from "./instruction-argument";

function campaign(): CampaignDocumentV1 {
  const document = createBlankCampaignDocument({
    documentId: "campaign-1",
    sessionId: "session-1",
    mode: "offline"
  });
  document.brief.targetAudienceId = "after-school-wanderers";
  document.gameplay.pair.roleGuideAcknowledged = true;
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
  document.gameplay.pair.artDirectorActions = 1;
}

function completeAida(
  document: CampaignDocumentV1,
  stage: "attention" | "interest" | "desire" | "action"
): void {
  document.strategy.aidaPlan[stage] = `Recorded ${stage} explanation.`;
  document.evidence[stage] = [`${stage}-object`];
}

describe("evaluateGuidedJourney", () => {
  it("defines the approved route from pair sign-in to device handover", () => {
    expect(GUIDED_JOURNEY_ORDER).toEqual([
      "sign-in",
      "audience",
      "starter-product",
      "product-edit",
      "product-name",
      "attention",
      "interest",
      "desire",
      "action",
      "price-position",
      "visible-price",
      "market-route",
      "proof-point",
      "final-review",
      "market-entry",
      "scoring",
      "sign-out"
    ]);
  });

  it("advances through each persisted studio completion condition", () => {
    const document = campaign();
    expect(evaluateGuidedJourney(document)).toMatchObject({
      progressLabel: "Build · Task 1 of 3",
      current: {
        id: "starter-product",
        now: "Choose one starter product."
      }
    });

    placeProduct(document);
    expect(evaluateGuidedJourney(document).current.id).toBe("product-edit");

    document.gameplay.pair.artDirectorActions = 2;
    expect(evaluateGuidedJourney(document).current.id).toBe("product-name");

    document.product.name = "Study Flask";
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
    expect(evaluateGuidedJourney(document).current.id).toBe("visible-price");

    document.product.priceCents = 5900;
    document.evidence.price = ["price-label"];
    expect(evaluateGuidedJourney(document).current.id).toBe("market-route");

    const route: NonNullable<CampaignDocumentV1["strategy"]["marketRoute"]> = {
      audienceBriefId: "after-school-wanderers",
      zoneId: "city",
      mediaIds: ["transit"],
      proofPoint: "",
      committed: true
    };
    document.strategy.marketRoute = route;
    expect(evaluateGuidedJourney(document).current.id).toBe("proof-point");

    document.strategy.marketRoute = {
      ...route,
      proofPoint: "The insulated bottle kept water cold for eight hours."
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
    document.gameplay.pair.artDirectorActions = 2;

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

  it("does not gate product work on legacy role-guide acknowledgement", () => {
    const document = campaign();
    document.gameplay.pair.roleGuideAcknowledged = false;

    expect(evaluateGuidedJourney(document).current).toMatchObject({
      id: "starter-product",
      actionLabel: "Open Build"
    });
  });

  it("requires a visible product edit after the starter is placed", () => {
    const document = campaign();
    placeProduct(document);

    const state = evaluateGuidedJourney(document);

    expect(state.current).toMatchObject({
      id: "product-edit",
      actionLabel: "Open Build"
    });
    expect(state.current.optionalMethods).toEqual(expect.arrayContaining([
      expect.stringContaining("Fill"),
      expect.stringContaining("Delete"),
      expect.stringContaining("Logo"),
      expect.stringContaining("Image Lab")
    ]));
    expect(state.current.optionalMethods?.join(" ")).not.toMatch(/\bcode\b/i);
  });

  it("moves on after the pair has named and visibly edited the product", () => {
    const document = campaign();
    placeProduct(document);
    document.product.name = "Study Flask";
    document.gameplay.pair.artDirectorActions = 2;

    const state = evaluateGuidedJourney(document);

    expect(state.current.id).toBe("finish-level-1");
  });

  it("requires an explanation and visible evidence for each AIDA stage", () => {
    const document = campaign();
    placeProduct(document);
    document.product.name = "Study Flask";
    document.gameplay.pair.artDirectorActions = 2;
    document.gameplay.stage = "sell";
    document.strategy.aidaPlan.attention = "Use contrast around the product.";

    expect(evaluateGuidedJourney(document).current.id).toBe("attention");

    document.evidence.attention = ["contrast-shape"];
    expect(evaluateGuidedJourney(document).current.id).toBe("interest");
  });

  it("keeps every step available and links each nonterminal next statement to the following step", () => {
    const steps = evaluateGuidedJourney(campaign()).steps;

    expect(steps.map(({ id }) => id)).toEqual([
      "sign-in",
      "audience",
      "starter-product",
      "product-edit",
      "product-name",
      "attention",
      "interest",
      "desire",
      "action",
      "price-position",
      "visible-price",
      "market-route",
      "proof-point",
      "final-review",
      "market-entry",
      "scoring",
      "sign-out"
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
      "sign-in": "audience",
      audience: "starter product",
      "starter-product": "product edit",
      "product-edit": "product name",
      "product-name": "advertisement",
      attention: "interest",
      interest: "value",
      desire: "action",
      action: "offer",
      "price-position": "visible price",
      "visible-price": "market route",
      "market-route": "proof point",
      "proof-point": "final review",
      "final-review": "market entry",
      "market-entry": "scoring",
      scoring: "sign out",
      "sign-out": "next pair"
    } as const;

    for (const step of steps) {
      const outcome = expectedLaterOutcome[
        step.id as keyof typeof expectedLaterOutcome
      ];
      expect(outcome).toBeDefined();
      expect(step.why.toLowerCase()).toContain(outcome);
    }
  });

  it("gives every route step one action, one observable completion and an exact next step", () => {
    const steps = evaluateGuidedJourney(campaign()).steps;
    const imperativeOpenings = /^(Sign|Read|Open|Choose|Change|Enter|Make|Use|Set|Add|Complete|Check|Build|Score|Place|Record|Submit|Select)/;

    for (const [index, step] of steps.entries()) {
      expect(step.now).toMatch(imperativeOpenings);
      expect(step.now.match(/[.!?](?:\s|$)/g)).toHaveLength(1);
      expect(step.done).toMatch(/[.!?]$/);
      expect(step.actionLabel?.trim()).not.toBe("");
      if (index < steps.length - 1) {
        expect(step.next.toLowerCase()).toContain(steps[index + 1]!.title.toLowerCase());
      }
    }
    expect(JSON.stringify(steps)).not.toContain("Follow the highlighted tool step");
    expect(JSON.stringify(steps)).not.toMatch(/(?:next )?canvas change/i);
  });

  it("maps every ordinary and transition step to the complete premise set", () => {
    const document = campaign();
    placeProduct(document);
    document.product.name = "Study Flask";
    document.gameplay.pair.artDirectorActions = 2;
    for (const stage of ["attention", "interest", "desire", "action"] as const) {
      completeAida(document, stage);
    }
    document.product.pricePosition = "everyday";
    document.product.priceCents = 5900;
    document.evidence.price = ["price-label"];
    document.strategy.marketRoute = {
      audienceBriefId: "after-school-wanderers",
      zoneId: "city",
      mediaIds: ["transit"],
      proofPoint: "The insulated bottle kept water cold for eight hours.",
      committed: true
    };

    const ordinary = evaluateGuidedJourney(document).steps;
    const transitions = ([
      "invent",
      "sell",
      "irresistible",
      "publish-check"
    ] as const).map((stage) => {
      document.gameplay.stage = stage;
      return evaluateGuidedJourney(document).current;
    });
    expect([...ordinary, ...transitions].every(({ claimIds }) => claimIds.length > 0))
      .toBe(true);

    const mapped = new Set([...ordinary, ...transitions].flatMap(({ claimIds }) => claimIds));
    const premiseIds = flattenInstructionArgument(INSTRUCTION_ARGUMENT)
      .filter(({ kind }) => kind === "premise")
      .map(({ id }) => id);
    expect(premiseIds.every((id) => mapped.has(id))).toBe(true);
  });
});
