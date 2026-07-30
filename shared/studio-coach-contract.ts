export const STUDIO_COACH_TECHNIQUE_IDS = [
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
] as const;

export type StudioCoachTechniqueId = typeof STUDIO_COACH_TECHNIQUE_IDS[number];
export type StudioCoachMode = "technique" | "whole-ad" | "revision";
export type StudioCoachCertainty = "clear" | "partial" | "uncertain";
export type StudioCoachRevisionVerdict = "clearer" | "mixed" | "not-evident";

export interface StudioCoachBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StudioCoachObjectEvidence {
  id: string;
  type: string;
  name: string;
  zOrder: readonly number[];
  bounds?: StudioCoachBounds;
  text?: string;
  colour?: string;
  fontSize?: number;
}

export type StudioCoachAidaStage = "price" | "attention" | "interest" | "desire" | "action";

export interface StudioCoachContext {
  productName: string;
  priceLabel: string;
  audienceNeed: string;
  audienceValues: string;
  intendedEffect: string;
  aidaStage: StudioCoachAidaStage;
}

export interface StudioCoachImageEvidence {
  imageDataUrl: string;
  imageSha256: string;
  width: 896;
  height: 504;
  objects: StudioCoachObjectEvidence[];
}

export interface StudioCoachRequest {
  sessionId: string;
  teamId: string;
  documentId: string;
  idempotencyKey: string;
  turn: 1 | 2;
  mode: StudioCoachMode;
  techniqueId?: StudioCoachTechniqueId;
  context: StudioCoachContext;
  current: StudioCoachImageEvidence;
  previous?: StudioCoachImageEvidence;
}

export interface StudioCoachTurnOneResponse {
  turn: 1;
  mode: "technique" | "whole-ad";
  observation: string;
  effect: string;
  nextMove: string;
  selfCheck: string;
  evidenceRefs: string[];
  certainty: StudioCoachCertainty;
}

export interface StudioCoachTurnTwoResponse {
  turn: 2;
  mode: "revision";
  verdict: StudioCoachRevisionVerdict;
  whatChanged: string;
  why: string;
  evidenceRefs: string[];
  certainty: StudioCoachCertainty;
}

export type StudioCoachResponse = StudioCoachTurnOneResponse | StudioCoachTurnTwoResponse;

const STRING_SCHEMA = { type: "string", minLength: 1, maxLength: 180, pattern: "\\S" } as const;
const EVIDENCE_SCHEMA = {
  type: "array",
  minItems: 1,
  maxItems: 6,
  uniqueItems: true,
  items: { type: "string", minLength: 1, maxLength: 120, pattern: "\\S" }
} as const;

export const STUDIO_COACH_RESPONSE_SCHEMA = {
  type: "object",
  oneOf: [
    {
      type: "object",
      additionalProperties: false,
      required: [
        "turn",
        "mode",
        "observation",
        "effect",
        "nextMove",
        "selfCheck",
        "evidenceRefs",
        "certainty"
      ],
      properties: {
        turn: { const: 1 },
        mode: { type: "string", enum: ["technique", "whole-ad"] },
        observation: STRING_SCHEMA,
        effect: STRING_SCHEMA,
        nextMove: STRING_SCHEMA,
        selfCheck: STRING_SCHEMA,
        evidenceRefs: EVIDENCE_SCHEMA,
        certainty: { type: "string", enum: ["clear", "partial", "uncertain"] }
      }
    },
    {
      type: "object",
      additionalProperties: false,
      required: [
        "turn",
        "mode",
        "verdict",
        "whatChanged",
        "why",
        "evidenceRefs",
        "certainty"
      ],
      properties: {
        turn: { const: 2 },
        mode: { const: "revision" },
        verdict: { type: "string", enum: ["clearer", "mixed", "not-evident"] },
        whatChanged: STRING_SCHEMA,
        why: STRING_SCHEMA,
        evidenceRefs: EVIDENCE_SCHEMA,
        certainty: { type: "string", enum: ["clear", "partial", "uncertain"] }
      }
    }
  ]
} as const;

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Studio Coach response must be an object");
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const expectedSet = new Set(expected);
  const unexpected = Object.keys(value).filter((key) => !expectedSet.has(key));
  const missing = expected.filter((key) => !Object.hasOwn(value, key));
  if (unexpected.length > 0) {
    throw new Error(`Studio Coach response has unexpected keys: ${unexpected.join(", ")}`);
  }
  if (missing.length > 0) {
    throw new Error(`Studio Coach response is missing keys: ${missing.join(", ")}`);
  }
}

function boundedString(value: unknown, label: string, maximum = 180): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum) {
    throw new Error(`${label} must be a non-empty string of at most ${maximum} characters`);
  }
  return value;
}

function evidenceRefs(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 6) {
    throw new Error("evidenceRefs must contain between one and six object IDs");
  }
  const parsed = value.map((item) => boundedString(item, "evidenceRefs item", 120));
  if (new Set(parsed).size !== parsed.length) {
    throw new Error("evidenceRefs must not contain duplicates");
  }
  return parsed;
}

function certainty(value: unknown): StudioCoachCertainty {
  if (value !== "clear" && value !== "partial" && value !== "uncertain") {
    throw new Error("certainty is not supported");
  }
  return value;
}

export function parseStudioCoachResponse(value: unknown): StudioCoachResponse {
  const input = record(value);
  if (input.turn === 1) {
    exactKeys(input, [
      "turn",
      "mode",
      "observation",
      "effect",
      "nextMove",
      "selfCheck",
      "evidenceRefs",
      "certainty"
    ]);
    if (input.mode !== "technique" && input.mode !== "whole-ad") {
      throw new Error("Turn one mode must be technique or whole-ad");
    }
    return {
      turn: 1,
      mode: input.mode,
      observation: boundedString(input.observation, "observation"),
      effect: boundedString(input.effect, "effect"),
      nextMove: boundedString(input.nextMove, "nextMove"),
      selfCheck: boundedString(input.selfCheck, "selfCheck"),
      evidenceRefs: evidenceRefs(input.evidenceRefs),
      certainty: certainty(input.certainty)
    };
  }
  if (input.turn === 2) {
    exactKeys(input, [
      "turn",
      "mode",
      "verdict",
      "whatChanged",
      "why",
      "evidenceRefs",
      "certainty"
    ]);
    if (input.mode !== "revision") throw new Error("Turn two mode must be revision");
    if (input.verdict !== "clearer" && input.verdict !== "mixed" && input.verdict !== "not-evident") {
      throw new Error("Turn two verdict is not supported");
    }
    return {
      turn: 2,
      mode: "revision",
      verdict: input.verdict,
      whatChanged: boundedString(input.whatChanged, "whatChanged"),
      why: boundedString(input.why, "why"),
      evidenceRefs: evidenceRefs(input.evidenceRefs),
      certainty: certainty(input.certainty)
    };
  }
  throw new Error("Studio Coach response turn must be 1 or 2");
}
