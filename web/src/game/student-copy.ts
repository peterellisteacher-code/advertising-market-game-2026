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
    audienceSignal: "Audience brief",
    roundProgress: "Pair progress",
    pairPlay: "Pair play",
    canvasWords: "Advertisement words",
    roundZeroTools: "Pair tools",
    context: "Context",
    need: "Need",
    values: "Values",
    intendedEffect: "Intended audience response",
    productName: "Product name",
    price: "Price",
    publish: "Open market preview"
  },
  audienceBriefDefinitions: {
    context: "Context is the situation the audience is in.",
    need: "Need is the problem the product should help solve.",
    values: "Values are the ideas or qualities that matter to this audience.",
    intendedEffect:
      "Intended audience response is what the advertisement should encourage the audience to think, feel or do."
  },
  guideFoundations: {
    product:
      "You and one partner are creating one fictional product and one advertisement for a supplied audience.",
    terms:
      "A premise is a reason. An intermediate conclusion is what a group of reasons supports.",
    termsReassurance:
      "You do not need to memorise those terms."
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
  // Role teaching lives in the Studio tour and the role guide dialog; the
  // journey bar carries the current task. The strip only names the roles.
  rolePrompts: {
    "art-director": { label: "Art Director" },
    strategist: { label: "Strategist" }
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
    promptToArtDirector:
      "Complete the current message choice. Then choose Swap roles. The Art Director leads the next visual decision.",
    promptToStrategist:
      "Complete the current visual choice. Then choose Swap roles. The Strategist leads the next message decision.",
    toArtDirector:
      "Roles swapped. The responsibilities have exchanged: the Art Director controls visual decisions and the Strategist controls message decisions. The recorded authorship history remains.",
    toStrategist:
      "Roles swapped. The responsibilities have exchanged: the Strategist controls message decisions and the Art Director controls visual decisions. The recorded authorship history remains."
  },
  roundZero: {
    progressNone: "Make one visible change.",
    progressOne: "1 visible change",
    progressManySuffix: "visible changes",
    bothRolesContributed: "Both roles contributed.",
    artDirectorRecorded: "Art Director: visible advertisement edit recorded.",
    artDirectorMissing: "Art Director: visible advertisement edit not yet recorded.",
    strategistRecorded: "Strategist: message or strategy change recorded.",
    strategistMissing: "Strategist: message or strategy change not yet recorded.",
    rolesSwapped: "Roles have been swapped once.",
    rolesNotSwapped: "Roles have not been swapped yet.",
    textPlaceholder: "Try Make room for adventure",
    addWords: "Add words to ad",
    productWords: "Put words on selected product",
    productWordsHint: "Select the product first. On supported products, the words appear on a curved label and the original text remains editable.",
    blankWords: "Type advertisement words first.",
    audienceChanged: "Audience brief changed.",
    wordsAdded: "Words added to the advertisement.",
    productWordsAdded: "Words added to the selected product.",
    productWordsUpdated: "Words updated on the selected product.",
    productWordsNeedSelection: "Select a product with a label area first.",
    undoUnavailable: "Nothing to undo.",
    redoUnavailable: "Nothing to redo.",
    operationFailed: "That action did not work. Try again."
  },
  release: {
    updateReady: "A game update is ready. Save your work, then reopen the game."
  },
  marketErrors: {
    INVALID_ROOM_CODE: "Enter the room code in the format ABC-234.",
    ROOM_NOT_FOUND: "That room could not be found. Check the code and try again.",
    ROOM_UNAVAILABLE: "That room is not available. Ask your teacher what to do next.",
    CONNECTION_TIMEOUT: "The connection took too long. Check the network and try again.",
    CONNECTION_UNAVAILABLE: "The market could not be reached. Check the network and try again.",
    RATE_LIMITED: "Too many requests were sent. Wait briefly, then try again.",
    SESSION_EXPIRED: "This market session has ended. Rejoin the room to continue."
  },
  readiness: {
    ready: "The advertisement is ready for preview.",
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
