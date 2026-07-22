export interface AudienceBrief {
  readonly id: string;
  readonly signal: string;
  readonly context: string;
  readonly need: string;
  readonly values: readonly string[];
  readonly intendedEffect: string;
}

function immutableBrief(brief: AudienceBrief): AudienceBrief {
  return Object.freeze({
    ...brief,
    values: Object.freeze([...brief.values])
  });
}

export const AUDIENCE_BRIEFS = Object.freeze([
  immutableBrief({
    id: "after-school-wanderers",
    signal: "Time after the school day ends.",
    context: "Teenagers. One-hour window between school dismissal and home arrival.",
    need: "A method to make the window productive.",
    values: ["independence", "belonging"],
    intendedEffect: "Perceive the offer as aligned with the student's own plan, not with an imposed routine."
  }),
  immutableBrief({
    id: "weekend-neighbours",
    signal: "Shared local time.",
    context: "People of varied ages. Reason to share time in the local area.",
    need: "Low-effort way to participate.",
    values: ["connection", "accessibility"],
    intendedEffect: "Judge participation as low-effort and welcoming."
  }),
  immutableBrief({
    id: "careful-spenders",
    signal: "Worth the spend.",
    context: "Young people with limited funds and competing wants. Comparing options.",
    need: "Reasons one option suits them.",
    values: ["fairness", "practicality"],
    intendedEffect: "Judge the offer as consistent with their budget and priorities."
  })
] as const);

export function getAudienceBrief(id: string): AudienceBrief {
  const brief = AUDIENCE_BRIEFS.find((candidate) => candidate.id === id);
  if (brief === undefined) {
    throw new Error(`Unknown audience brief: ${id}`);
  }
  return brief;
}
