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
    signal: "After-school freedom",
    context: "Teenagers choosing something useful for the hour between school and getting home.",
    need: "A simple way to make that hour feel worthwhile.",
    values: ["independence", "belonging"],
    intendedEffect: "See the offer as fitting their own plans, not an adult routine."
  }),
  immutableBrief({
    id: "weekend-neighbours",
    signal: "Shared neighbourhood time",
    context: "People of different ages looking for an easy reason to spend time together locally.",
    need: "A low-pressure way to join in.",
    values: ["connection", "accessibility"],
    intendedEffect: "Feel that taking part would be easy and welcoming."
  }),
  immutableBrief({
    id: "careful-spenders",
    signal: "Worth the choice",
    context: "Young people comparing options because they have limited money and many competing wants.",
    need: "Clear reasons why one choice suits them.",
    values: ["fairness", "practicality"],
    intendedEffect: "Feel confident that the offer respects their budget and priorities."
  })
] as const);

export function getAudienceBrief(id: string): AudienceBrief {
  const brief = AUDIENCE_BRIEFS.find((candidate) => candidate.id === id);
  if (brief === undefined) {
    throw new Error(`Unknown audience brief: ${id}`);
  }
  return brief;
}
