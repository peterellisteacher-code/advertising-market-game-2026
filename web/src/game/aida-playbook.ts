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
  stage("attention", "Attention", "Attention: use one element to attract attention immediately.",
    "The audience notices one element before moving past it.", [
      move("pattern-break", "Pattern break", "Disrupt the expected visual pattern.",
        "Begin with one element that disrupts the visual pattern."),
      move("giant-focal", "Giant focal point", "Make one object dominate the first glance.",
        "Enlarge one product detail relative to its surroundings."),
      move("high-contrast", "High contrast", "Separate the focal object from its surroundings.",
        "Apply a sharp light-dark or warm-cool contrast around the focal point."),
      move("unexpected-angle", "Unexpected angle", "Show a familiar object from an uncommon viewpoint.",
        "Open with an unusual crop or viewpoint. Keep the product recognisable."),
      move("question-hook", "Question hook", "Open an information gap the viewer wants closed.",
        "Begin with one short question. The next image resolves it."),
      move("frozen-motion", "Frozen motion", "Capture the instant before or after an action.",
        "Freeze one action. The viewer infers the next frame."),
      move("colour-signal", "Colour signal", "Assign one colour a single function.",
        "Reserve one vivid colour for the product or the lead text."),
      move("tiny-in-space", "Tiny in space", "Use empty space to signal that something is missing.",
        "Place one small focal object inside a large, low-detail space."),
      move("strange-pair", "Strange pairing", "Combine two ideas not normally paired.",
        "Pair the product with one comparison that is unexpected but legible."),
      move("three-beat", "Three-beat reveal", "Build attention through a three-step visual rhythm.",
        "Arrange three simple steps. Each leads the eye toward the product."),
    ]),
  stage("interest", "Interest", "Interest: give the audience a reason to keep looking.",
    "Provide detail, evidence, or a short narrative.", [
      move("feature-demo", "Feature demo", "Show one feature performing its function.",
        "Demonstrate one feature in a context where its function matters."),
      move("how-it-works", "How it works", "Show the product's mechanism or process.",
        "Use a sequence to show the product's operation."),
      move("before-after", "Before and after", "Make the state change visible by juxtaposition.",
        "Contrast the state before the product with the state after."),
      move("detail-zoom", "Detail zoom", "Frame one small choice as evidence of quality.",
        "Zoom in on one material, finish, or add-on. State its function."),
      move("capacity-proof", "Capacity proof", "Make capacity or performance visible.",
        "Show what the product holds, covers, reaches, or supports."),
      move("mini-story", "Mini story", "Depict one familiar moment.",
        "Show the product resolving one short, plausible situation."),
      move("choice-map", "Choice map", "Display the available options.",
        "Compare several configurations. Do not rank one as best."),
      move("origin-clue", "Origin clue", "State the reason for a design choice.",
        "Link one feature to the need or idea that produced it."),
      move("fact-stack", "Fact stack", "Build credibility with a small set of specific facts.",
        "Use three short, verifiable facts in place of a general claim."),
      move("open-loop", "Open loop", "Reveal partial information. Defer the rest.",
        "Show one intriguing detail now. Defer the explanation."),
    ]),
  stage("desire", "Desire", "Desire: connect a product feature to an audience need or preference.",
    "Connect product function to the audience's preferred feeling.", [
      move("life-benefit", "Life benefit", "Connect a feature to a result in the user's life.",
        "Show how one feature changes the user's experience."),
      move("future-self", "Future self", "Show the user a plausible future self.",
        "Depict the user enjoying a plausible future. The product enables it."),
      move("sensory-cue", "Sensory cue", "Suggest texture, sound, taste, temperature, or movement.",
        "Use visual details that evoke a sensory response."),
      move("belonging", "Belonging", "Link the offer to relevant people or places.",
        "Show the product supporting connection. Do not exclude outsiders."),
      move("pride-of-choice", "Pride of choice", "Frame the decision as deliberate.",
        "Present the chosen features as evidence of judgement or taste."),
      move("relief", "Relief", "Eliminate a frustration the audience recognises.",
        "Show the avoided hassle with the same clarity as the benefit."),
      move("experience", "Experience promise", "Sell the experience, not the object alone.",
        "Construct a scene around the experience the offer produces."),
      move("credible-voice", "Credible voice", "Support the claim with verifiable evidence.",
        "Use a specific review, demonstration, or result. Avoid generic praise."),
      move("personal-fit", "Personal fit", "Show options that fit different needs.",
        "Highlight the configuration matching this audience's priorities."),
      move("value-story", "Value story", "Connect price to durability or value.",
        "Explain why the key features justify the price."),
    ]),
  stage("action", "Action", "Action: enable the next step.",
    "Provide one clear, honest, achievable next step.", [
      move("one-verb", "One strong verb", "Begin with the specific action.",
        "Open the call to action with one precise verb."),
      move("where-next", "Where next", "State the destination or channel.",
        "State the next destination."),
      move("what-happens", "What happens next", "Remove uncertainty about what follows the action.",
        "State the first thing the audience will see or do after the action."),
      move("low-friction", "Low-friction start", "Make the first step small.",
        "Offer a first step with low commitment."),
      move("time-window", "Real time window", "Use time pressure only when the timing is real.",
        "State an actual date or window. Do not fabricate urgency."),
      move("location-cue", "Location cue", "Link the action to a defined market zone.",
        "Name the location where the audience acts."),
      move("choice-action", "Choice action", "Offer two useful paths.",
        "Offer two clear next steps for different audience needs."),
      move("try-first", "Try first", "Invite use before commitment.",
        "Invite the audience to test, visit, sample, or preview."),
      move("repeat-promise", "Repeat the promise", "Link the action to the main benefit.",
        "Connect the final instruction to the established benefit."),
      move("action-marker", "Action marker", "Mark one clear visual destination.",
        "Use one button, badge, arrow, or framed line as the terminal visual."),
    ])
]);

export function getAidaStage(id: AidaStage): AidaStageDefinition {
  const definition = AIDA_STAGES.find((candidate) => candidate.id === id);
  if (!definition) throw new Error(`Unknown AIDA stage: ${id}`);
  return definition;
}
