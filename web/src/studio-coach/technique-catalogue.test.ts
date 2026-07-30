import { describe, expect, it } from "vitest";
import {
  STUDIO_COACH_TECHNIQUE_IDS,
  STUDIO_COACH_TECHNIQUES,
  studioCoachTechnique
} from "./technique-catalogue";

describe("Studio Coach technique catalogue", () => {
  it("covers the eleven required advertisement techniques once each", () => {
    expect(STUDIO_COACH_TECHNIQUE_IDS).toEqual([
      "salience",
      "colour",
      "contrast",
      "leading-lines",
      "framing",
      "negative-space",
      "depth-layers",
      "rule-of-odds",
      "juxtaposition",
      "typography",
      "visual-hierarchy"
    ]);
    expect(STUDIO_COACH_TECHNIQUES).toHaveLength(11);
    expect(new Set(STUDIO_COACH_TECHNIQUES.map(({ id }) => id)).size).toBe(11);
  });

  it("provides brief factual help and a visual example description for one technique at a time", () => {
    expect(studioCoachTechnique("leading-lines")).toEqual(expect.objectContaining({
      label: "Leading lines",
      definition: expect.stringContaining("guide"),
      effect: expect.any(String),
      example: expect.any(String)
    }));
    for (const technique of STUDIO_COACH_TECHNIQUES) {
      expect(technique.definition.length).toBeLessThanOrEqual(130);
      expect(technique.effect.length).toBeLessThanOrEqual(130);
      expect(technique.example.length).toBeLessThanOrEqual(130);
    }
  });

  it("fails closed for an unknown technique", () => {
    expect(() => studioCoachTechnique("slogan-writing" as never)).toThrow(/unknown/i);
  });
});
