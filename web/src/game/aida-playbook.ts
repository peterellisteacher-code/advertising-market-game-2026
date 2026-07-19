export type AidaStage = "attention" | "interest" | "desire" | "action";

export interface AidaMove {
  readonly id: string;
  readonly label: string;
  readonly clue: string;
  readonly starter: string;
}

export interface AidaStageDefinition {
  readonly id: AidaStage;
  readonly label: string;
  readonly heading: string;
  readonly purpose: string;
  readonly moves: readonly AidaMove[];
}

function move(id: string, label: string, clue: string, starter: string): AidaMove {
  return Object.freeze({ id, label, clue, starter });
}

function stage(
  id: AidaStage,
  label: string,
  heading: string,
  purpose: string,
  moves: readonly AidaMove[]
): AidaStageDefinition {
  return Object.freeze({ id, label, heading, purpose, moves: Object.freeze([...moves]) });
}

export const AIDA_STAGES: readonly AidaStageDefinition[] = Object.freeze([
  stage("attention", "Attention", "Attention: earn the first look",
    "Make the audience notice one clear thing before they move on.", [
      move("pattern-break", "Pattern break", "Interrupt what people expect to see.",
        "Open by using one element to break the visual pattern."),
      move("giant-focal", "Giant focal point", "Let one object dominate the first glance.",
        "Make one product detail much larger than everything around it."),
      move("high-contrast", "High contrast", "Separate the hero from its surroundings.",
        "Use a sharp light-dark or warm-cool contrast around the first focal point."),
      move("unexpected-angle", "Unexpected angle", "Show a familiar thing from a fresh view.",
        "Lead with an unusual crop or viewpoint that still keeps the product readable."),
      move("question-hook", "Question hook", "Create a gap the audience wants to close.",
        "Open with one short question the next image can answer."),
      move("frozen-motion", "Frozen motion", "Capture the split second before or after change.",
        "Freeze one action moment so the audience imagines what happens next."),
      move("colour-signal", "Colour signal", "Give one colour a job.",
        "Reserve one vivid colour for the product or the most important words."),
      move("tiny-in-space", "Tiny in space", "Use empty space to create curiosity.",
        "Place one small focal object inside a large, deliberately quiet space."),
      move("strange-pair", "Strange pairing", "Join two ideas that do not usually meet.",
        "Pair the product with one surprising but meaningful comparison."),
      move("three-beat", "Three-beat reveal", "Build notice through a quick visual rhythm.",
        "Arrange three simple beats that lead the eye to the product."),
    ]),
  stage("interest", "Interest", "Interest: reward the second look",
    "Give the audience useful detail, proof or a small story worth exploring.", [
      move("feature-demo", "Feature demo", "Show one useful part doing its job.",
        "Demonstrate one product feature in a situation where it matters."),
      move("how-it-works", "How it works", "Reveal a simple mechanism or process.",
        "Use a clear sequence to show how the product works."),
      move("before-after", "Before and after", "Make the change easy to compare.",
        "Contrast the situation before the product with the result after it."),
      move("detail-zoom", "Detail zoom", "Turn one small choice into evidence.",
        "Zoom in on one material, finish or add-on and explain its purpose."),
      move("capacity-proof", "Capacity proof", "Make size or performance visible.",
        "Show what the product can hold, cover, reach or support."),
      move("mini-story", "Mini story", "Follow one recognisable moment.",
        "Show the product solving one short, believable situation."),
      move("choice-map", "Choice map", "Help the audience see their options.",
        "Compare a few meaningful configurations without declaring one perfect choice."),
      move("origin-clue", "Origin clue", "Show why a design decision exists.",
        "Connect one feature to the need or idea that inspired it."),
      move("fact-stack", "Fact stack", "Build confidence with a few specific facts.",
        "Use three brief, verifiable facts instead of a vague claim."),
      move("open-loop", "Open loop", "Reveal enough to invite the next step.",
        "Show one intriguing detail now and promise the explanation in the next beat."),
    ]),
  stage("desire", "Desire", "Desire: make the benefit matter",
    "Connect what the product does to how the audience wants life to feel.", [
      move("life-benefit", "Life benefit", "Translate a feature into a lived result.",
        "Show how one feature changes the audience's real experience."),
      move("future-self", "Future self", "Let the audience picture who they could become.",
        "Show the audience enjoying a believable future made easier by the product."),
      move("sensory-cue", "Sensory cue", "Suggest texture, sound, taste, temperature or movement.",
        "Use visual details that make the benefit feel sensory and immediate."),
      move("belonging", "Belonging", "Connect the offer with people or places that matter.",
        "Show how the product supports connection without excluding others."),
      move("pride-of-choice", "Pride of choice", "Make the decision feel thoughtful.",
        "Frame the chosen features as evidence of care, taste or good judgement."),
      move("relief", "Relief", "Remove a frustration the audience recognises.",
        "Make the avoided hassle as clear as the product benefit."),
      move("experience", "Experience promise", "Sell the moment, not only the object.",
        "Build a scene around the feeling or experience the offer creates."),
      move("credible-voice", "Credible voice", "Let believable evidence support the promise.",
        "Use a specific review, demonstration or result rather than empty praise."),
      move("personal-fit", "Personal fit", "Show that choices can suit different needs.",
        "Highlight the configuration that best fits this audience's priorities."),
      move("value-story", "Value story", "Connect cost with what lasts or matters.",
        "Explain why the important features make the price feel worthwhile."),
    ]),
  stage("action", "Action", "Action: make the next move easy",
    "Give the audience one clear, honest and achievable next step.", [
      move("one-verb", "One strong verb", "Start with the exact action to take.",
        "Begin the call to action with one precise verb."),
      move("where-next", "Where next", "Name the place or channel clearly.",
        "Tell the audience exactly where to go next."),
      move("what-happens", "What happens next", "Remove uncertainty after the click or visit.",
        "Explain the first thing the audience will see or do after acting."),
      move("low-friction", "Low-friction start", "Make the first step small and realistic.",
        "Offer a quick first step that does not demand a large commitment."),
      move("time-window", "Real time window", "Use timing only when it is genuine.",
        "State a real date or window without inventing pressure."),
      move("location-cue", "Location cue", "Connect the action with the chosen market zone.",
        "Name the fictional location where the audience can act."),
      move("choice-action", "Choice action", "Let people choose a useful path.",
        "Offer two clear next steps for audiences with different needs."),
      move("try-first", "Try first", "Invite experience before commitment.",
        "Invite the audience to test, visit, sample or preview the offer."),
      move("repeat-promise", "Repeat the promise", "Tie the action back to the main benefit.",
        "Link the final instruction to the benefit the campaign has proved."),
      move("action-marker", "Action marker", "Give the eye a clear destination.",
        "Use one button, badge, arrow or framed line as the final visual stop."),
    ])
]);

export function getAidaStage(id: AidaStage): AidaStageDefinition {
  const definition = AIDA_STAGES.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`Unknown AIDA stage: ${id}`);
  return definition;
}
