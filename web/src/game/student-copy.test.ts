import { describe, expect, it } from "vitest";
import { AUDIENCE_BRIEFS } from "./audience-briefs";
import { CREATOR_STAGES } from "./creator-stage";
import { STUDENT_COPY } from "./student-copy";

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStrings);
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}

function expectRecursivelyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") {
    return;
  }
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) {
    expectRecursivelyFrozen(child);
  }
}

describe("student copy", () => {
  it("contains no undefined interface jargon or assessment framing in campaign copy", () => {
    const { assignmentSandbox: _assignmentSandbox, ...campaignCopy } = STUDENT_COPY;
    const campaignStrings = collectStrings([campaignCopy, AUDIENCE_BRIEFS, CREATOR_STAGES]);
    expect(campaignStrings.length).toBeGreaterThan(0);
    for (const value of campaignStrings) {
      expect(value).not.toMatch(/\b(?:assignment|unit|canvas)\b/i);
      expect(value).not.toMatch(/\b(?:assessment|criteria|grade|mark|rubric|quiz|score|points)\b/i);
    }
  });

  it("allows the approved assignment label without importing grading or canvas jargon", () => {
    expect(STUDENT_COPY.assignmentSandbox.label).toBe("ASSIGNMENT SANDBOX");
    const sandboxStrings = collectStrings(STUDENT_COPY.assignmentSandbox);
    expect(sandboxStrings.length).toBeGreaterThan(0);
    for (const value of sandboxStrings) {
      expect(value).not.toMatch(/\b(?:unit|canvas)\b/i);
      expect(value).not.toMatch(/\b(?:assessment|criteria|grade|rubric|quiz|score|points)\b/i);
    }
  });

  it("names both roles without standing instruction copy", () => {
    expect(STUDENT_COPY.rolePrompts["art-director"]).toEqual({ label: "Art Director" });
    expect(STUDENT_COPY.rolePrompts.strategist).toEqual({ label: "Strategist" });
  });

  it("includes play labels, phase labels, handoff copy, and readiness copy", () => {
    expect(STUDENT_COPY.labels).toMatchObject({
      gameTitle: expect.any(String),
      audienceBrief: expect.any(String),
    audienceSignal: "Audience brief",
      roundProgress: "Pair progress",
      pairPlay: "Pair play",
      canvasWords: "Advertisement words",
      roundZeroTools: "Pair tools",
      context: "Context",
      need: "Need",
      values: "Values",
      intendedEffect: "Intended audience response",
      productName: expect.any(String),
      price: expect.any(String),
      publish: expect.any(String)
    });
    expect(STUDENT_COPY.phaseLabels).toEqual({
      "round-zero": "PAIR START",
      invent: "Invent",
      sell: "Sell",
      refine: "Refine",
      preview: "Preview"
    });
    expect(STUDENT_COPY.handoff).toMatchObject({
      buttonLabel: expect.any(String),
      toArtDirector: expect.any(String),
      toStrategist: expect.any(String)
    });
    expect(STUDENT_COPY.roundZero).toEqual({
      progressNone: "Make one visible change.",
      progressOne: "1 visible change",
      progressManySuffix: "visible changes",
      bothRolesContributed: "Both roles contributed.",
      artDirectorRecorded: "Art Director: visible advertisement edit recorded.",
      artDirectorMissing: "Art Director: visible advertisement edit not yet recorded.",
      strategistRecorded: "Strategist: message or strategy change recorded.",
      strategistMissing: "Strategist: message or strategy change not yet recorded.",
      rolesSwapped: "Roles have been swapped once.",
      rolesNotSwapped: "Roles have not been swapped yet.",
      textPlaceholder: "Try Make room for adventure",
      addWords: "Add words to ad",
      productWords: "Put words on selected product",
      productWordsHint: "Select the product first. On supported products, the words appear on a curved label and the original text remains editable.",
      blankWords: "Type advertisement words first.",
    audienceChanged: "Audience brief changed.",
      wordsAdded: "Words added to the advertisement.",
      productWordsAdded: "Words added to the selected product.",
      productWordsUpdated: "Words updated on the selected product.",
      productWordsNeedSelection: "Select a product with a label area first.",
      undoUnavailable: "Nothing to undo.",
      redoUnavailable: "Nothing to redo.",
      operationFailed: "That action did not work. Try again."
    });
    expect(STUDENT_COPY.roundZero).not.toHaveProperty("bothRolesReady");
    expect(STUDENT_COPY.readiness).toMatchObject({
      ready: expect.any(String),
      notReady: expect.any(String),
      missing: expect.any(Object)
    });
  });

  it("keeps each first-use tooltip within its stage hint and length limits", () => {
    expect(Object.keys(STUDENT_COPY.firstUseTooltips)).toEqual(
      CREATOR_STAGES.map((stage) => stage.phase)
    );
    for (const stage of CREATOR_STAGES) {
      const tooltip = STUDENT_COPY.firstUseTooltips[stage.phase];
      expect(tooltip.text).toBe(stage.tooltip);
      expect(tooltip.text.length).toBeLessThanOrEqual(140);
      expect(tooltip.hintKeywords.length).toBeLessThanOrEqual(stage.hintKeywords.length);
      expect(tooltip.hintKeywords.length).toBeLessThanOrEqual(2);
      for (const keyword of tooltip.hintKeywords) {
        expect(stage.hintKeywords).toContain(keyword);
      }
    }
  });

  it("is recursively immutable", () => {
    expectRecursivelyFrozen(STUDENT_COPY);
  });
});
