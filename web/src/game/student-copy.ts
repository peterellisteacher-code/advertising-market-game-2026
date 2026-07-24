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
    roundProgress: "Pair progress",
    pairPlay: "Pair play",
    canvasWords: "Canvas words",
    roundZeroTools: "Pair tools",
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
      productiveAction: "Build the product. Place it on the ad, then enlarge it for a clear close-up.",
      holdingAction: "Check that the product is large, clear and easy to recognise."
    },
    strategist: {
      label: "Strategist",
      productiveAction: "Name the product. Add one clear benefit to the ad.",
      holdingAction: "Read the audience need. Prepare a product name and one useful benefit."
    }
  },
  stageRolePrompts: {
    invent: {
      "art-director": {
        label: "Art Director",
        productiveAction: "Build the product. Place it on the ad, then enlarge it for a clear close-up.",
        holdingAction: "Check that the product is large, clear and easy to recognise."
      },
      strategist: {
        label: "Strategist",
        productiveAction: "Name the product. Add one clear benefit to the ad.",
        holdingAction: "Read the audience need. Prepare a product name and one useful benefit."
      }
    },
    sell: {
      "art-director": {
        label: "Art Director",
        productiveAction: "Choose one visual technique. Use it to direct the audience's attention.",
        holdingAction: "Check whether the current AIDA choice is clear and easy to notice."
      },
      strategist: {
        label: "Strategist",
        productiveAction: "Link one canvas choice to the next AIDA step.",
        holdingAction: "Check the next AIDA step. Prepare one message suggestion."
      }
    },
    irresistible: {
      "art-director": {
        label: "Art Director",
        productiveAction: "Check the image, spacing and text placement. Fix one visual problem.",
        holdingAction: "Check whether the price and route fit what the ad promises."
      },
      strategist: {
        label: "Strategist",
        productiveAction: "Choose the audience price position and selling price. Complete one market-route step.",
        holdingAction: "Check the price and market route against the audience need."
      }
    },
    "publish-check": {
      "art-director": {
        label: "Art Director",
        productiveAction: "Check the finished ad for overlap, weak contrast or unclear focus.",
        holdingAction: "Check whether every word and image is clear at market-card size."
      },
      strategist: {
        label: "Strategist",
        productiveAction: "Check the claim, price, audience fit and AIDA links.",
        holdingAction: "Check that the final claim is clear, credible and linked to the audience."
      }
    }
  },
  phaseLabels: {
    "round-zero": "PAIR START",
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
    bothRolesContributed: "Both roles contributed.",
    textPlaceholder: "Try Make room for adventure",
    addWords: "Add words to ad",
    productWords: "Put words on selected product",
    productWordsHint: "Select the product first. Words added to supported products follow a curved path and remain editable.",
    blankWords: "Type some canvas words first.",
    audienceChanged: "Audience signal changed.",
    wordsAdded: "Words added to the canvas.",
    productWordsAdded: "Words added to the selected product.",
    productWordsUpdated: "Words updated on the selected product.",
    productWordsNeedSelection: "Select a product with a label area first.",
    undoUnavailable: "Nothing to undo.",
    redoUnavailable: "Nothing to redo.",
    operationFailed: "That move did not work. Try again."
  },
  release: {
    updateReady: "A game update is ready. Save your work, then reopen the game."
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
