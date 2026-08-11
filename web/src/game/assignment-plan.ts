import { z } from "zod";

export const WORKSPACE_MODES = ["guided", "assignment-sandbox"] as const;
export type WorkspaceMode = typeof WORKSPACE_MODES[number];

export const ASSIGNMENT_DESIRE_VALUE_IDS = [
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
] as const;

export type AssignmentDesireValueId = typeof ASSIGNMENT_DESIRE_VALUE_IDS[number];

export interface AssignmentDesireValue {
  readonly id: AssignmentDesireValueId;
  readonly family: string;
  readonly label: string;
}

function sentenceCase(value: string): string {
  const words = value.replaceAll("-", " ");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

export const ASSIGNMENT_DESIRE_VALUES: readonly AssignmentDesireValue[] = Object.freeze(
  ASSIGNMENT_DESIRE_VALUE_IDS.map((id) => {
    const [family, value] = id.split(":") as [string, string];
    return Object.freeze({ id, family: sentenceCase(family), label: sentenceCase(value) });
  })
);

export const AssignmentAidaPlanSchema = z.object({
  attention: z.string().max(280),
  interest: z.string().max(280),
  desire: z.string().max(280),
  action: z.string().max(280)
}).strict();

const desireValueId = z.enum(ASSIGNMENT_DESIRE_VALUE_IDS);

export const AssignmentPlanSchema = z.object({
  productFunction: z.string().max(280),
  targetAudience: z.string().max(160),
  advertisingLocation: z.string().max(160),
  featureToEmphasise: z.string().max(280),
  differenceFromAlternatives: z.string().max(280),
  materials: z.string().max(280),
  estimatedProductionCost: z.string().max(80),
  salePrice: z.string().max(80),
  desireValueIds: z.array(desireValueId).max(12).superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: "custom", message: "Desire values must be unique" });
    }
  }),
  primaryDesireValueId: z.union([z.literal(""), desireValueId]),
  productAidaPlan: AssignmentAidaPlanSchema
}).strict().superRefine((plan, context) => {
  if (plan.primaryDesireValueId !== "" &&
    !plan.desireValueIds.includes(plan.primaryDesireValueId)) {
    context.addIssue({
      code: "custom",
      path: ["primaryDesireValueId"],
      message: "The primary Desire value must also be selected"
    });
  }
});

export type AssignmentAidaPlanV1 = z.infer<typeof AssignmentAidaPlanSchema>;
export type AssignmentPlanV1 = z.infer<typeof AssignmentPlanSchema>;

export function createBlankAssignmentPlan(): AssignmentPlanV1 {
  return {
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
  };
}
