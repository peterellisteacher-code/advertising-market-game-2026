import { describe, expect, it } from "vitest";
import {
  INSTRUCTION_ARGUMENT,
  flattenInstructionArgument,
  validateInstructionArgument,
  type InstructionSubargument
} from "./instruction-argument";

const PREMISE_IDS = [
  "P1", "P2", "P3",
  "P5", "P6", "P7", "P8",
  "P10", "P11", "P12", "P13",
  "P15", "P16", "P17", "P18",
  "P20", "P21", "P22", "P23", "P24"
] as const;

const APPROVED_TEXT = Object.freeze({
  P1: "Signing in opens the campaign and saved work assigned to the pair.",
  P2: "Reading the audience brief identifies the audience's situation, need and values.",
  P3: "Assigning the Art Director and Strategist roles gives each partner a stated responsibility for the same audience brief.",
  ICA: "Completing premises 1 to 3 is likely to give the pair a shared audience purpose.",
  P5: "If intermediate conclusion A is established, each product choice can be tested against the audience's situation, need and values.",
  P6: "Choosing a starter product provides a workable object that can be changed.",
  P7: "Adding, moving, filling or removing product parts allows the pair to adapt that object for the audience.",
  P8: "Naming the product gives the advertisement a clear subject.",
  ICB: "Completing premises 5 to 8 is likely to produce a named product that suits the shared audience purpose.",
  P10: "Intermediate conclusion B supplies a named, visible product for the advertisement.",
  P11: "The Art Director's visible change supplies evidence of a deliberate visual choice.",
  P12: "The Strategist's wording supplies evidence of a deliberate message choice.",
  P13: "Attention, Interest, Desire and Action each require one visible choice and one explanation connected to the product and audience.",
  ICC: "Completing premises 10 to 13 is likely to produce a coherent advertisement for the product and audience.",
  P15: "Intermediate conclusion C supplies a coherent advertisement whose offer can be evaluated.",
  P16: "An audience-led price explains what the product costs and why that amount is suitable.",
  P17: "A market route identifies where the audience is likely to encounter the advertisement.",
  P18: "A proof point supports the advertisement's main claim with a fact, feature or demonstration.",
  ICD: "Completing premises 15 to 18 is likely to produce a clear and credible offer.",
  P20: "Intermediate conclusion D supplies a clear and credible offer for final review.",
  P21: "The final review checks audience fit, product value and price, AIDA, visual technique and claim credibility.",
  P22: "A successful publication check proves that the saved campaign contains the evidence required by those five criteria.",
  P23: "Entering the market makes the completed campaign available for comparison.",
  P24: "Applying the same five criteria to other advertisements supports consistent scores and medal decisions.",
  C: "A pair that completes premises 20 to 24 is likely to create and judge an audience-focused, coherent and credible advertising campaign."
});

const PLAIN_EXPLANATIONS = Object.freeze({
  A: "This section answers two basic questions: who are you trying to persuade, and which partner is responsible for the next kind of decision? The audience brief describes a group of people in a particular situation.",
  B: "Choose a starter product, then change it so it responds to the audience need. A product choice can be a part, colour, material, shape or feature. The product name is the name customers would see.",
  C: "An advertisement combines what people see with what they read. The Art Director makes a visible design choice. The Strategist writes or plans the message. AIDA gives the message four jobs: attract attention, hold interest, create desire and tell the audience what to do.",
  D: "A credible offer tells the audience what the product costs, where they would encounter the advertisement and what evidence supports its main claim. A proof point is a specific fact, feature or demonstration, not another slogan.",
  E: "The final review uses the same five criteria as the market. Building the market card saves the finished entry. Entering the market submits it for comparison. Scoring means rating the other advertisements, not your own, before awarding medals."
});

describe("linked instruction argument", () => {
  it("contains the exact approved claims once and has no loose ends", () => {
    const claims = flattenInstructionArgument(INSTRUCTION_ARGUMENT);

    expect(claims.filter(({ kind }) => kind === "premise").map(({ id }) => id))
      .toEqual(PREMISE_IDS);
    expect(claims.filter(({ kind }) => kind === "overall-conclusion").map(({ id }) => id))
      .toEqual(["C"]);
    expect(Object.fromEntries(claims.map(({ id, text }) => [id, text])))
      .toEqual(APPROVED_TEXT);
    expect(validateInstructionArgument(INSTRUCTION_ARGUMENT)).toEqual([]);
  });

  it("adds a literal explanation before every formal subargument", () => {
    expect(Object.fromEntries(INSTRUCTION_ARGUMENT.map(({ id, plainExplanation }) => [
      id,
      plainExplanation
    ]))).toEqual(PLAIN_EXPLANATIONS);
  });

  it("uses each intermediate conclusion in the next subargument", () => {
    const claims = new Map(flattenInstructionArgument(INSTRUCTION_ARGUMENT)
      .map((claim) => [claim.id, claim]));

    expect(claims.get("ICA")?.supports).toEqual(["P5"]);
    expect(claims.get("P5")?.uses).toContain("ICA");
    expect(claims.get("ICB")?.supports).toEqual(["P10"]);
    expect(claims.get("P10")?.uses).toContain("ICB");
    expect(claims.get("ICC")?.supports).toEqual(["P15"]);
    expect(claims.get("P15")?.uses).toContain("ICC");
    expect(claims.get("ICD")?.supports).toEqual(["P20"]);
    expect(claims.get("P20")?.uses).toContain("ICD");
    expect(claims.get("C")?.supports).toEqual([]);
  });

  it("reports the exact ID of a loose premise", () => {
    const loose = INSTRUCTION_ARGUMENT.map((subargument): InstructionSubargument =>
      subargument.id !== "E"
        ? subargument
        : Object.freeze({
          ...subargument,
          claims: Object.freeze(subargument.claims.map((claim) =>
            claim.id === "P24"
              ? Object.freeze({ ...claim, supports: Object.freeze([]) })
              : claim))
        }));

    expect(validateInstructionArgument(loose)).toContain("P24 has no support target");
  });
});
