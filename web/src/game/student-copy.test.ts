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
  it("contains no banned whole words or assessment framing in any student-facing string", () => {
    const strings = collectStrings([STUDENT_COPY, AUDIENCE_BRIEFS, CREATOR_STAGES]);
    expect(strings.length).toBeGreaterThan(0);
    for (const value of strings) {
      expect(value).not.toMatch(/\b(?:assignment|unit|task)\b/i);
      expect(value).not.toMatch(/\b(?:assessment|criteria|grade|mark|rubric|quiz|score|points)\b/i);
    }
  });

  it("gives both named roles an explicit productive action and useful holding action", () => {
    expect(STUDENT_COPY.rolePrompts["art-director"].label).toBe("Art Director");
    expect(STUDENT_COPY.rolePrompts.strategist.label).toBe("Strategist");

    for (const prompt of Object.values(STUDENT_COPY.rolePrompts)) {
      expect(prompt.productiveAction).toMatch(/^While you control the computer, /);
      expect(prompt.holdingAction).toMatch(/^While your partner controls the computer, /);
      expect(prompt.productiveAction.length).toBeGreaterThan(40);
      expect(prompt.holdingAction.length).toBeGreaterThan(40);
    }
  });

  it("includes play labels, phase labels, handoff copy, and readiness copy", () => {
    expect(STUDENT_COPY.labels).toMatchObject({
      gameTitle: expect.any(String),
      audienceBrief: expect.any(String),
      productName: expect.any(String),
      price: expect.any(String),
      publish: expect.any(String)
    });
    expect(STUDENT_COPY.phaseLabels).toEqual({
      "round-zero": "Round 0",
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
