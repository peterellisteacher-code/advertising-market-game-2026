import { CREATOR_STAGES } from "./creator-stage";
import type { CreatorPhase } from "./pair-session";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

const firstUseTooltips = Object.fromEntries(CREATOR_STAGES.map((stage) => {
  if (stage.tooltip === undefined) {
    throw new Error(`Missing first-use tooltip for ${stage.phase}`);
  }
  return [stage.phase, {
    text: stage.tooltip,
    hintKeywords: [...stage.hintKeywords]
  }];
})) as Record<CreatorPhase, { text: string; hintKeywords: string[] }>;

export const STUDENT_COPY = deepFreeze({
  labels: {
    gameTitle: "Advertising Market Game",
    audienceBrief: "Audience brief",
    audienceSignal: "Audience signal",
    roundProgress: "Round progress",
    pairPlay: "Pair play",
    canvasWords: "Canvas words",
    roundZeroTools: "Round 0 tools",
    context: "Context",
    need: "Need",
    values: "Values",
    intendedEffect: "Intended effect",
    productName: "Product name",
    price: "Price",
    publish: "Open market preview"
  },
  commandLabels: {
    search: "Search",
    add: "Add",
    move: "Move",
    resize: "Resize",
    text: "Text",
    undo: "Undo",
    crop: "Crop",
    drawing: "Drawing",
    recolour: "Recolour",
    layers: "Layers"
  },
  rolePrompts: {
    "art-director": {
      label: "Art Director",
      productiveAction: "While you control the computer, make one visible image change by adding, moving or resizing an image.",
      holdingAction: "While your partner controls the computer, compare the image choices with the audience need. Prepare one specific visual suggestion."
    },
    strategist: {
      label: "Strategist",
      productiveAction: "While you control the computer, make one visible message change by adding or revising the product name or canvas words.",
      holdingAction: "While your partner controls the computer, read the audience brief. Prepare one specific wording or persuasion suggestion."
    }
  },
  phaseLabels: {
    "round-zero": "Round 0",
    invent: "Invent",
    sell: "Sell",
    refine: "Refine",
    preview: "Preview"
  },
  handoff: {
    buttonLabel: "Swap roles",
    toArtDirector: "Pass control to the Art Director.",
    toStrategist: "Pass control to the Strategist."
  },
  roundZero: {
    progressNone: "Make one visible change.",
    progressOne: "1 visible change",
    progressManySuffix: "visible changes",
    bothRolesReady: "Both roles made a change",
    textPlaceholder: "Try Make room for adventure",
    addWords: "Add words",
    blankWords: "Type some canvas words first.",
    audienceChanged: "Audience signal changed.",
    wordsAdded: "Words added to the canvas.",
    undoUnavailable: "Nothing to undo.",
    redoUnavailable: "Nothing to redo.",
    operationFailed: "That move did not work. Try again."
  },
  readiness: {
    ready: "The campaign is ready for preview.",
    notReady: "Finish the remaining items before preview.",
    missing: {
      "audience-brief": "Choose an audience brief.",
      "product-name": "Add a product name.",
      price: "Add a price.",
      attention: "Link one choice to attention.",
      interest: "Link one choice to interest.",
      desire: "Link one choice to desire.",
      action: "Link one choice to action.",
      "role-handoff": "Swap roles at least once.",
      "art-director-action": "The Art Director needs one visible image change.",
      "strategist-action": "The Strategist needs one visible message change."
    }
  },
  firstUseTooltips
});
