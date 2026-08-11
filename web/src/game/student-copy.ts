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
  writersStatement: {
    menuLabel: "Writer's statement",
    title: "Writer's statement",
    description:
      "This page lists the decisions recorded for this advertisement. Print the page and bring it into the pitch.",
    productLabel: "Product",
    audienceLabel: "Audience brief",
    print: "Print",
    close: "Close",
    emptySection: "Nothing recorded for this heading yet.",
    notOpen: "Open an advertisement first.",
    sections: {
      "audience-purpose": "Audience and purpose",
      "visual-choices": "Visual choices",
      "language-choices": "Language choices",
      evidence: "Evidence"
    },
    aidaLabels: {
      attention: "Attention",
      interest: "Interest",
      desire: "Desire",
      action: "Action"
    },
    proofPointLabel: "Proof point",
    slotEvidenceLabels: {
      price: "Price evidence",
      attention: "Attention evidence",
      interest: "Interest evidence",
      desire: "Desire evidence",
      action: "Action evidence"
    },
    publishOffer: {
      message:
        "The advertisement is published. The writer's statement lists the decisions recorded for the pitch.",
      open: "Open writer's statement",
      dismiss: "Not now"
    }
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
  assignmentSandbox: {
    label: "ASSIGNMENT SANDBOX",
    plannerLoading: "Assignment planner loading",
    uploadLoading: "Image upload loading",
    planner: {
      intro:
        "Start with the product. Then apply AIDA again to the choices in the advertisement.",
      sections: {
        defineProduct: "Define the product",
        productAida: "Product AIDA",
        desireValues: "Values for Desire",
        advertisementAida: "Advertisement AIDA"
      },
      fields: {
        productName: "Product name for this assignment",
        productFunction: "What does the product do, and how does that benefit its user?",
        targetAudience: "Who is the target audience?",
        advertisingLocation: "Where will the advertisement appear?",
        featureToEmphasise: "Which feature will you emphasise?",
        differenceFromAlternatives: "How is it different from alternatives?",
        materials: "What materials will it use?",
        estimatedProductionCost: "Estimated production cost",
        salePrice: "Planned sale price"
      },
      productAidaNote:
        "Product AIDA explains the product promise. A feature is what it has or does; a benefit is how that helps; a value is why that matters; an audience response is what you want the audience to think, feel or do.",
      productAidaPrompts: {
        attention:
          "Attention — what about the product should grab Attention? This could be what it looks like or what it does.",
        interest:
          "Interest — which additional features or benefits should make the audience want to know more?",
        desire:
          "Desire — how should the audience imagine life with this product?",
        action:
          "Action — what honest next step should the audience take?"
      },
      valuesNote:
        "Choose up to twelve values from page 5, then mark one as the main value behind Desire.",
      mainValuePrefix: "Make",
      mainValueSuffix: "the main value",
      mainValueLabel: "Main",
      advertisementAidaNote:
        "Apply AIDA again to the advertisement. Decide which visible or written evidence will gain Attention, build Interest, create Desire and prompt Action.",
      compositionTechniques:
        "Check the advertisement's salience, framing, reading pathway, vector lines, rule of thirds, colour contrast and harmony, pattern, balance and symmetry.",
      saving: "Saving…",
      saved: "Saved",
      saveFailed: "The assignment plan could not be saved."
    },
    upload: {
      heading: "Upload your drawing or mockup",
      note:
        "Choose a PNG, JPEG or WebP, up to 12 MiB. The image stays on this device unless you choose an Image Lab action.",
      chooseImage: "Choose an image",
      preparing: "Preparing image…",
      addedSuffix:
        " added. Use the advertisement toolbar to resize, fill, layer or delete it.",
      errors: {
        unknown: "The image could not be prepared.",
        emptyFile: "Choose a non-empty image file.",
        tooLarge: "Choose an image no larger than 12 MiB.",
        unsupportedType: "Choose a PNG, JPEG or WebP image.",
        signatureMismatch: "The file contents do not match its image type.",
        invalidDimensions: "The image has invalid dimensions.",
        browserCannotPrepare: "This browser cannot prepare the image.",
        encodeFailed: "The image could not be encoded as PNG.",
        decodeFailed: "The image could not be decoded. Try exporting it as PNG, JPEG or WebP.",
        preparedBounds: "The prepared image is not a valid bounded PNG.",
        preparedPng: "The prepared image is not a valid PNG."
      }
    },
    imageLab: {
      guidance:
        "Make the product realistic, or turn the complete advertisement into a realistic version.",
      makeProductReal: "Make the product real",
      makeAdvertisementRealistic: "Make this advertisement realistic",
      textWarning:
        "Image models can change lettering. Check every word, then use the Words tool to correct it.",
      busyAdvertisement: "Creating a realistic version of your advertisement…",
      doneAdvertisement: "The realistic advertisement is selected."
    }
  },
  firstUseTooltips
});
