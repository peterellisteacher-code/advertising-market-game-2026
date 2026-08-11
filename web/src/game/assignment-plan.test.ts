import { describe, expect, it } from "vitest";
import {
  ASSIGNMENT_DESIRE_VALUES,
  AssignmentPlanSchema,
  createBlankAssignmentPlan
} from "./assignment-plan";

describe("assignment plan", () => {
  it("keeps the page-five Desire value catalogue exact and immutable", () => {
    expect(Object.isFrozen(ASSIGNMENT_DESIRE_VALUES)).toBe(true);
    expect(ASSIGNMENT_DESIRE_VALUES.map(({ id }) => id)).toEqual([
      "responsibility:environmentalism", "responsibility:sustainability",
      "responsibility:repairability", "responsibility:durability",
      "responsibility:reuse", "responsibility:recycling",
      "responsibility:ethical-production", "responsibility:local-production",
      "practicality:portability", "practicality:convenience",
      "practicality:speed", "practicality:reliability", "practicality:safety",
      "practicality:simplicity", "practicality:comfort", "practicality:affordability",
      "identity:individuality", "identity:belonging", "identity:status",
      "identity:style", "identity:luxury", "identity:tradition",
      "identity:nostalgia", "identity:self-expression",
      "experience:holidays", "experience:celebration", "experience:adventure",
      "experience:creativity", "experience:entertainment", "experience:relaxation",
      "experience:connection", "experience:discovery",
      "performance:power", "performance:precision", "performance:efficiency",
      "performance:innovation", "performance:endurance", "performance:control",
      "performance:achievement", "performance:quality",
      "care:health", "care:wellbeing", "care:accessibility", "care:protection",
      "care:family", "care:education", "care:independence", "care:security"
    ]);
  });

  it("creates every required field in a blank assignment plan", () => {
    expect(createBlankAssignmentPlan()).toEqual({
      productFunction: "",
      targetAudience: "",
      advertisingLocation: "",
      featureToEmphasise: "",
      differenceFromAlternatives: "",
      materials: "",
      estimatedProductionCost: "",
      salePrice: "",
      desireValueIds: [],
      primaryDesireValueId: "",
      productAidaPlan: { attention: "", interest: "", desire: "", action: "" }
    });
  });

  it("rejects unknown values, an unselected primary value, and overlong copy", () => {
    const blank = createBlankAssignmentPlan();
    expect(() => AssignmentPlanSchema.parse({
      ...blank,
      desireValueIds: ["invented:value"]
    })).toThrow();
    expect(() => AssignmentPlanSchema.parse({
      ...blank,
      primaryDesireValueId: "care:security"
    })).toThrow();
    expect(() => AssignmentPlanSchema.parse({
      ...blank,
      productFunction: "x".repeat(281)
    })).toThrow();
  });
});
