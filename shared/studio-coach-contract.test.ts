import { describe, expect, it } from "vitest";
import {
  STUDIO_COACH_RESPONSE_SCHEMA,
  parseStudioCoachResponse
} from "./studio-coach-contract";

describe("Studio Coach response contract", () => {
  it("accepts one bounded first-turn visual recommendation", () => {
    expect(parseStudioCoachResponse({
      turn: 1,
      mode: "technique",
      observation: "The product name is visible.",
      effect: "It gives the audience a clear first reading point.",
      nextMove: "Increase its contrast without changing the words.",
      selfCheck: "Can you read the product name before the price?",
      evidenceRefs: ["product-name"],
      certainty: "clear"
    })).toEqual({
      turn: 1,
      mode: "technique",
      observation: "The product name is visible.",
      effect: "It gives the audience a clear first reading point.",
      nextMove: "Increase its contrast without changing the words.",
      selfCheck: "Can you read the product name before the price?",
      evidenceRefs: ["product-name"],
      certainty: "clear"
    });
  });

  it("accepts only a comparison verdict on the final turn", () => {
    const response = parseStudioCoachResponse({
      turn: 2,
      mode: "revision",
      verdict: "clearer",
      whatChanged: "The product name has stronger contrast.",
      why: "It is now the first reading point.",
      evidenceRefs: ["product-name"],
      certainty: "clear"
    });

    expect(response.turn).toBe(2);
    expect(response).not.toHaveProperty("nextMove");
    expect(response).not.toHaveProperty("selfCheck");
  });

  it("rejects extra keys, a third turn, empty evidence, and mismatched modes", () => {
    expect(() => parseStudioCoachResponse({
      turn: 1,
      mode: "technique",
      observation: "Visible.",
      effect: "Clear.",
      nextMove: "Increase contrast.",
      selfCheck: "Is it first?",
      evidenceRefs: ["headline"],
      certainty: "clear",
      invitation: "Ask me again"
    })).toThrow(/unexpected/i);
    expect(() => parseStudioCoachResponse({ turn: 3 })).toThrow();
    expect(() => parseStudioCoachResponse({
      turn: 1,
      mode: "revision",
      observation: "Visible.",
      effect: "Clear.",
      nextMove: "Increase contrast.",
      selfCheck: "Is it first?",
      evidenceRefs: [],
      certainty: "clear"
    })).toThrow();
  });

  it("publishes a strict two-branch JSON schema for the provider", () => {
    expect(STUDIO_COACH_RESPONSE_SCHEMA).toMatchObject({
      type: "object",
      oneOf: [{ properties: { turn: { const: 1 } } }, { properties: { turn: { const: 2 } } }]
    });
    expect(JSON.stringify(STUDIO_COACH_RESPONSE_SCHEMA)).toContain('"additionalProperties":false');
    expect(STUDIO_COACH_RESPONSE_SCHEMA.oneOf[0].properties.observation).toMatchObject({
      maxLength: 180,
      pattern: "\\S"
    });
    expect(STUDIO_COACH_RESPONSE_SCHEMA.oneOf[0].properties.evidenceRefs.items).toMatchObject({
      pattern: "\\S"
    });
  });
});
