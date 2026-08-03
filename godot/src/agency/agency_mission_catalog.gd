extends RefCounted
class_name AdMarketAgencyMissionCatalog

const REQUIRED_MISSION_RECORDS := [
    {
        "id": "audience-brief",
        "stationId": "client-briefing",
        "ownerRole": "strategist",
        "title": "Read the audience before making anything",
        "goal": "Identify the audience situation, need and values that the campaign must respect.",
        "instruction": "Compare the four interpretations with the brief, then select the one supported by all of its evidence.",
        "holdingAction": "The Art Director identifies one visual detail that could represent the selected value without relying on a written label.",
        "referenceFacts": {
            "context": "Teenagers. One-hour window between school dismissal and home arrival.",
            "need": "A method to make the window productive.",
            "values": "Independence and belonging.",
            "intendedResponse": "See the offer as supporting the student's own plan, not an imposed routine.",
        },
        "choices": [
            {
                "id": "independence",
                "label": "The audience needs a productive after-school option that still feels self-directed.",
                "effect": "This interpretation joins the audience's limited time, need for productivity and value of independence."
            },
            {
                "id": "cheapest",
                "label": "The audience will choose whichever product has the lowest possible price.",
                "effect": "Price may matter, but the brief does not establish that low cost is the audience's main need."
            },
            {
                "id": "adult-supervision",
                "label": "The audience wants adults to organise every part of the hour after school.",
                "effect": "This conflicts with the audience value of independence stated in the brief."
            },
            {
                "id": "trend-copy",
                "label": "The audience mainly wants to copy whatever is currently popular.",
                "effect": "The brief identifies belonging, but it does not show that imitation is the audience's primary purpose."
            }
        ],
        "correctChoiceId": "independence",
        "effectExplanation": "Using the supported situation, need and values gives the audience a coherent reason to recognise the offer as relevant.",
        "transferPrompt": "State the audience need your product will meet and explain how the offer can preserve the audience's independence.",
        "reward": "Client brief approved",
        "required": true
    },
    {
        "id": "salience",
        "stationId": "art-studio",
        "ownerRole": "art-director",
        "title": "Control what the audience notices first",
        "goal": "Use size, isolation and colour contrast to make the campaign's most important subject salient.",
        "instruction": "Choose the treatment that creates the clearest first point of attention without making every element compete.",
        "holdingAction": "The Strategist names the single product benefit that deserves the audience's first attention and checks that the visual emphasis supports it.",
        "choices": [
            {
                "id": "largest-contrast",
                "label": "One large product in a contrasting accent colour, separated from supporting details.",
                "effect": "The strongest size and colour contrast directs the audience's attention to the product first."
            },
            {
                "id": "small-logo",
                "label": "A small product mark placed beside several equally dark blocks of text.",
                "effect": "The audience has no dominant entry point because the product is smaller than its competing details."
            },
            {
                "id": "everything-bold",
                "label": "Every word, image and button enlarged and coloured with equal intensity.",
                "effect": "When every element demands attention, the audience cannot identify which element matters first."
            },
            {
                "id": "low-contrast-centre",
                "label": "A centred product rendered in almost the same tone as its background.",
                "effect": "Central placement alone cannot give the audience a strong first point of attention when tonal contrast is weak."
            }
        ],
        "correctChoiceId": "largest-contrast",
        "effectExplanation": "A controlled contrast hierarchy helps the audience notice the product before reading the supporting message.",
        "transferPrompt": "Name the element that should be seen first in your advertisement and specify the size, isolation or colour contrast that will make it salient.",
        "reward": "Salience lens unlocked",
        "required": true
    },
    {
        "id": "reading-path",
        "stationId": "art-studio",
        "ownerRole": "art-director",
        "title": "Build a deliberate reading path",
        "goal": "Arrange imagery, headline and action so the audience encounters the campaign in a useful sequence.",
        "instruction": "Trace each proposed path from the first focal point to the action and choose the one with no visual dead end.",
        "holdingAction": "The Strategist reads the message in the proposed order and checks that each step supplies the information needed for the next one.",
        "choices": [
            {
                "id": "product-headline-action",
                "label": "Product gaze and leading line move to the headline, then a short vertical path reaches the action.",
                "effect": "The audience can move from subject to meaning to action without reversing direction or searching."
            },
            {
                "id": "action-first-dead-end",
                "label": "A bright action button appears first, while the product and reason sit in an unrelated corner.",
                "effect": "The audience reaches an action before understanding what is offered or why it matters."
            },
            {
                "id": "outward-vectors",
                "label": "Faces and diagonal lines point beyond the edge of the advertisement.",
                "effect": "The strongest vectors lead the audience away from the message and action."
            },
            {
                "id": "four-centres",
                "label": "Four separate clusters each create their own centre and reading direction.",
                "effect": "The audience must choose between competing paths, so the intended sequence becomes uncertain."
            }
        ],
        "correctChoiceId": "product-headline-action",
        "effectExplanation": "A coherent reading path helps the audience connect the visual subject, campaign meaning and requested action in sequence.",
        "transferPrompt": "Describe the first, second and third points in your advertisement's reading path and name the line, gaze or placement that connects them.",
        "reward": "Reading-path overlay unlocked",
        "required": true
    },
    {
        "id": "contrast",
        "stationId": "art-studio",
        "ownerRole": "art-director",
        "title": "Use colour to create emphasis and tone",
        "goal": "Choose a limited colour relationship that makes one action clear while supporting the campaign's intended feeling.",
        "instruction": "Compare emphasis, legibility and emotional tone; select the palette that performs all three functions.",
        "holdingAction": "The Strategist states the intended audience feeling in one precise word and rejects any palette whose tone conflicts with that feeling.",
        "choices": [
            {
                "id": "one-accent-harmony",
                "label": "Two related supporting colours with one high-contrast accent reserved for the action.",
                "effect": "The audience receives a consistent tone while the isolated accent makes the requested action easy to locate."
            },
            {
                "id": "five-accents",
                "label": "Five unrelated bright accents applied to product, headline, body copy, border and action.",
                "effect": "The audience sees several competing emphases, so colour no longer communicates priority."
            },
            {
                "id": "low-contrast-copy",
                "label": "Pale type on a pale background with a slightly darker decorative border.",
                "effect": "The audience may recognise a soft tone, but weak text contrast makes the message difficult to read."
            },
            {
                "id": "tone-conflict",
                "label": "Harsh warning colours used for a calm, independent after-school offer.",
                "effect": "The audience may interpret urgency or danger rather than the intended calm sense of control."
            }
        ],
        "correctChoiceId": "one-accent-harmony",
        "effectExplanation": "A restrained palette can guide audience attention and establish tone without sacrificing legibility.",
        "transferPrompt": "Name your supporting colours, your single accent colour and the exact campaign element that will receive that accent.",
        "reward": "Colour system approved",
        "required": true
    },
    {
        "id": "framing",
        "stationId": "production-studio",
        "ownerRole": "art-director",
        "title": "Frame the image around the campaign meaning",
        "goal": "Choose a crop and placement that show useful detail, preserve context and leave deliberate space for the message.",
        "instruction": "Decide what the audience must see to understand use, scale and feeling, then select the frame that preserves those clues.",
        "holdingAction": "The Strategist checks whether the image alone supports the stated product value before reading any headline or caption.",
        "choices": [
            {
                "id": "useful-close-crop",
                "label": "A close view of the product in use, with the user's action visible and clear negative space for the headline.",
                "effect": "The audience can understand use and benefit while the preserved negative space keeps the message legible."
            },
            {
                "id": "feature-cut-off",
                "label": "An extreme crop that removes the product feature responsible for its main benefit.",
                "effect": "The audience receives visual intensity but cannot verify how the product delivers its promised value."
            },
            {
                "id": "distant-subject",
                "label": "A very wide view in which the product occupies only a small, low-contrast corner.",
                "effect": "The audience sees environmental context but may not identify the advertised subject."
            },
            {
                "id": "text-over-face",
                "label": "A useful human expression covered by the headline and action button.",
                "effect": "The audience loses an important emotional cue because the message obscures the evidence carried by the image."
            }
        ],
        "correctChoiceId": "useful-close-crop",
        "effectExplanation": "Purposeful framing controls which evidence the audience can see and where the written message can be read.",
        "transferPrompt": "State what your image must prove, what will remain inside the crop and where negative space will hold the headline.",
        "reward": "Framing desk approved",
        "required": true
    },
    {
        "id": "aida",
        "stationId": "strategy-room",
        "ownerRole": "strategist",
        "title": "Turn attention into a reason to act",
        "goal": "Order the four AIDA moves so each one gives the audience a reason to continue to the next.",
        "instruction": "Choose the sequence in which Attention introduces the subject, Interest explains relevance, Desire develops value and Action states the next step.",
        "holdingAction": "The Art Director identifies the visual element that will carry each AIDA move and checks that all four moves do not compete at the same scale.",
        "choices": [
            {
                "id": "aida-complete",
                "label": "Distinctive image; relevant feature; audience benefit; clear invitation with a feasible next step.",
                "effect": "The audience first notices, then understands relevance, imagines value and finally receives a clear action."
            },
            {
                "id": "action-without-value",
                "label": "Large action instruction; repeated price; product name; decorative image.",
                "effect": "The audience receives an action before enough interest or desire has been established."
            },
            {
                "id": "attention-repeated",
                "label": "Three surprising headlines followed by another surprising image and no next step.",
                "effect": "The audience receives repeated attention devices but no developed reason to value or act on the offer."
            },
            {
                "id": "feature-list",
                "label": "Long feature list; technical detail; smaller technical detail; brand mark.",
                "effect": "The audience receives information, but its relevance, desired outcome and next action remain implicit."
            }
        ],
        "correctChoiceId": "aida-complete",
        "effectExplanation": "AIDA creates a cumulative audience journey rather than four unrelated labels placed on an advertisement.",
        "transferPrompt": "Write one sentence for each AIDA move in your campaign and explain how the audience can move from one to the next.",
        "reward": "AIDA sequence approved",
        "required": true
    },
    {
        "id": "claim-proof",
        "stationId": "copy-room",
        "ownerRole": "strategist",
        "title": "Make a claim the campaign can support",
        "goal": "Connect a precise audience benefit to visible or stated evidence without making an absolute promise.",
        "instruction": "Select the claim whose wording is proportionate to the evidence provided by the product feature and campaign image.",
        "holdingAction": "The Art Director identifies where the supporting feature appears in the image and checks that the evidence is noticeable before the claim is accepted.",
        "choices": [
            {
                "id": "qualified-supported",
                "label": "The removable planning tiles help you reorganise a short after-school session as your priorities change.",
                "effect": "The audience receives a specific benefit linked to a visible feature, while the wording avoids an unprovable guarantee."
            },
            {
                "id": "absolute-success",
                "label": "This product guarantees that every student will become successful immediately.",
                "effect": "The audience is asked to accept an absolute outcome that no product feature or campaign evidence can guarantee."
            },
            {
                "id": "empty-superlative",
                "label": "The greatest and most revolutionary product ever created.",
                "effect": "The audience receives strong evaluation but no criterion or evidence by which to judge it."
            },
            {
                "id": "unrelated-proof",
                "label": "The product is blue, therefore it will make every afternoon productive.",
                "effect": "The audience sees a feature, but the stated feature does not logically support the promised outcome."
            }
        ],
        "correctChoiceId": "qualified-supported",
        "effectExplanation": "A supportable claim gives the audience a credible connection between product evidence and a relevant benefit.",
        "transferPrompt": "Write your campaign's main claim, name the feature or image detail that supports it and remove any absolute wording the evidence cannot justify.",
        "reward": "Claim cleared for publication",
        "required": true
    }
]

const SIDEQUEST_RECORDS := [
    {
        "id": "thirty-second-rescue",
        "stationId": "production-studio",
        "ownerRole": "art-director",
        "title": "Thirty-second layout rescue",
        "goal": "Repair a crowded fictional advertisement by restoring one dominant focal point.",
        "instruction": "Choose the single change that removes the most competition while preserving the campaign's necessary evidence.",
        "holdingAction": "The Strategist names the one message that must survive the rescue and checks that the proposed simplification does not remove it.",
        "choices": [
            {
                "id": "remove-equal-badges",
                "label": "Remove four equal promotional badges and retain one supported action.",
                "effect": "The audience receives one clear priority instead of several competing promotional claims."
            },
            {
                "id": "add-border",
                "label": "Add a thicker border around every existing element.",
                "effect": "The audience still faces the same internal competition because the hierarchy has not changed."
            },
            {
                "id": "add-font",
                "label": "Add a fifth typeface to make the smallest note more noticeable.",
                "effect": "The audience receives another competing style rather than a clearer hierarchy."
            },
            {
                "id": "shrink-product",
                "label": "Shrink the product so the promotional badges have more room.",
                "effect": "The audience loses the main subject while the competing badges remain dominant."
            }
        ],
        "correctChoiceId": "remove-equal-badges",
        "effectExplanation": "Removing equal competitors lets the audience identify the campaign subject and action more quickly.",
        "transferPrompt": "Name one nonessential competitor you can remove from your own advertisement without losing evidence.",
        "reward": "Optional portfolio stamp",
        "required": false,
        "portfolioStamp": "Hierarchy Rescue",
        "presentationFlourish": "spotlight"
    },
    {
        "id": "colour-clinic",
        "stationId": "art-studio",
        "ownerRole": "art-director",
        "title": "Colour hierarchy clinic",
        "goal": "Repair a palette in which every bright colour currently claims equal importance.",
        "instruction": "Select the revision that reserves high contrast for the action and uses related colours elsewhere.",
        "holdingAction": "The Strategist checks that the revised palette still communicates the intended audience feeling.",
        "choices": [
            {
                "id": "reserve-accent",
                "label": "Keep one bright accent for the action and reduce supporting elements to related tones.",
                "effect": "The audience can locate the action while still receiving a coherent campaign tone."
            },
            {
                "id": "random-muted",
                "label": "Mute two colours at random and leave the other three equally bright.",
                "effect": "The audience still receives several competing accents without a deliberate priority."
            },
            {
                "id": "all-grey",
                "label": "Remove every colour, including the one carrying the action and product identity.",
                "effect": "The audience loses competition, but also loses useful emphasis and tone."
            },
            {
                "id": "gradient-everything",
                "label": "Apply a different bright gradient to every campaign element.",
                "effect": "The audience encounters more visual variation and a weaker hierarchy."
            }
        ],
        "correctChoiceId": "reserve-accent",
        "effectExplanation": "A reserved accent gives the audience one reliable colour signal for priority.",
        "transferPrompt": "Identify the single element in your advertisement that will receive the strongest colour contrast.",
        "reward": "Optional portfolio stamp",
        "required": false,
        "portfolioStamp": "Colour Clinician",
        "presentationFlourish": "colour-pulse"
    },
    {
        "id": "crop-lab",
        "stationId": "production-studio",
        "ownerRole": "art-director",
        "title": "Crop laboratory",
        "goal": "Choose the crop that preserves the evidence needed to understand product use and audience benefit.",
        "instruction": "Compare what each frame includes and excludes, then select the frame with enough detail, context and message space.",
        "holdingAction": "The Strategist states the benefit the image must support and rejects any crop that removes its evidence.",
        "choices": [
            {
                "id": "action-and-space",
                "label": "Keep the user's action, the relevant product feature and one area of negative space.",
                "effect": "The audience can verify use while the written message retains a clear place."
            },
            {
                "id": "feature-missing",
                "label": "Crop tightly around the user's face and remove the product feature.",
                "effect": "The audience receives emotion but cannot verify how the product creates the benefit."
            },
            {
                "id": "empty-room",
                "label": "Keep most of the room while reducing the product to an indistinct detail.",
                "effect": "The audience receives context but may not recognise the subject of the advertisement."
            },
            {
                "id": "headline-covered",
                "label": "Fill the entire frame with the product and place the headline over its controls.",
                "effect": "The audience sees the product, but the message obscures evidence needed to understand it."
            }
        ],
        "correctChoiceId": "action-and-space",
        "effectExplanation": "An evidence-preserving crop lets the audience understand both what the product is and how it produces value.",
        "transferPrompt": "List the two image details your own crop must preserve and the area that will remain available for text.",
        "reward": "Optional portfolio stamp",
        "required": false,
        "portfolioStamp": "Crop Analyst",
        "presentationFlourish": "frame-reveal"
    },
    {
        "id": "headline-surgery",
        "stationId": "copy-room",
        "ownerRole": "strategist",
        "title": "Headline surgery",
        "goal": "Shorten a weak headline while retaining the product's relevant audience benefit.",
        "instruction": "Select the revision that removes empty evaluation and keeps a precise promise supported by the offer.",
        "holdingAction": "The Art Director checks that the revised headline can be read at the intended scale without covering campaign evidence.",
        "choices": [
            {
                "id": "control-your-hour",
                "label": "Control your hour. Keep your own priorities visible.",
                "effect": "The audience receives a concise benefit connected to independence and the product's planning function."
            },
            {
                "id": "best-ever",
                "label": "The best, greatest and most amazing solution for absolutely everyone.",
                "effect": "The audience receives unsupported evaluation rather than a precise benefit."
            },
            {
                "id": "feature-inventory",
                "label": "Tiles, board, pen, timer, clips, colours, stand and more included.",
                "effect": "The audience receives a list of features without an explanation of their value."
            },
            {
                "id": "mystery",
                "label": "You will never believe what happens next.",
                "effect": "The audience receives curiosity but no subject, benefit or credible reason to continue."
            }
        ],
        "correctChoiceId": "control-your-hour",
        "effectExplanation": "A concise, supportable headline helps the audience recognise relevance before reading detail.",
        "transferPrompt": "Reduce your own headline to a precise benefit that can be read quickly and supported by the campaign.",
        "reward": "Optional portfolio stamp",
        "required": false,
        "portfolioStamp": "Headline Surgeon",
        "presentationFlourish": "type-on"
    },
    {
        "id": "media-match",
        "stationId": "media-desk",
        "ownerRole": "strategist",
        "title": "Media format match",
        "goal": "Match message length and visual scale to the conditions in which the audience will encounter the advertisement.",
        "instruction": "Select the format whose viewing distance, duration and orientation suit the proposed campaign message.",
        "holdingAction": "The Art Director checks that the main subject remains recognisable at the selected format's scale and shape.",
        "choices": [
            {
                "id": "billboard-brief",
                "label": "Billboard for one large subject, a short headline and a simple action seen at distance.",
                "effect": "The audience can understand the campaign during a brief distant encounter."
            },
            {
                "id": "billboard-essay",
                "label": "Billboard for six paragraphs, three diagrams and a detailed conditions table.",
                "effect": "The audience is unlikely to have enough viewing time or proximity to read the message."
            },
            {
                "id": "vertical-landscape",
                "label": "Vertical screen with the main subject reduced to fit a wide landscape composition unchanged.",
                "effect": "The audience receives a small subject and unused vertical space because the composition was not adapted."
            },
            {
                "id": "magazine-motion",
                "label": "Printed magazine page that depends on a moving reveal to disclose the product name.",
                "effect": "The audience cannot receive information that exists only in an animation on a static page."
            }
        ],
        "correctChoiceId": "billboard-brief",
        "effectExplanation": "Matching content to format conditions helps the audience receive the intended message before attention moves elsewhere.",
        "transferPrompt": "Choose billboard, magazine or vertical screen for your campaign and explain how its viewing conditions affect your composition.",
        "reward": "Optional portfolio stamp",
        "required": false,
        "portfolioStamp": "Media Planner",
        "presentationFlourish": "format-sequence"
    }
]

const OBJECTIVE_RECORDS := {
    "meet-client": {
        "id": "meet-client",
        "stationId": "client-briefing",
        "title": "Meet the client and read the audience brief",
        "action": "Travel to Client Briefing and identify the audience situation, need and values.",
        "reason": "Every later decision needs one shared account of who the campaign is for.",
        "ownerRole": "strategist",
        "holdingAction": "The Art Director looks for a visual way to represent the selected audience value."
    },
    "build-product": {
        "id": "build-product",
        "stationId": "production-studio",
        "title": "Build a product for the audience need",
        "action": "Open the production studio and choose or adapt a product that can meet the approved need.",
        "reason": "The advertisement needs a specific offer whose value can be shown and explained.",
        "ownerRole": "strategist",
        "holdingAction": "The Art Director checks that the product has a recognisable visual form."
    },
    "direct-attention": {
        "id": "direct-attention",
        "stationId": "art-studio",
        "title": "Decide what the audience will notice first",
        "action": "Complete the salience mission, then name the first focal point in your advertisement.",
        "reason": "A deliberate first point prevents every campaign element from competing equally.",
        "ownerRole": "art-director",
        "holdingAction": "The Strategist names the benefit that deserves the audience's first attention."
    },
    "shape-message": {
        "id": "shape-message",
        "stationId": "strategy-room",
        "title": "Shape the campaign message",
        "action": "Build an AIDA sequence that moves from first attention to one feasible audience action.",
        "reason": "The advertisement must give the audience a cumulative reason to continue and act.",
        "ownerRole": "strategist",
        "holdingAction": "The Art Director assigns a distinct visual level to each AIDA move."
    },
    "set-campaign-tone": {
        "id": "set-campaign-tone",
        "stationId": "art-studio",
        "title": "Set emphasis and tone with colour",
        "action": "Choose supporting colours and reserve one strong accent for the campaign priority.",
        "reason": "Colour should guide attention and feeling without weakening legibility.",
        "ownerRole": "art-director",
        "holdingAction": "The Strategist names the intended audience feeling and checks the palette against it."
    },
    "focus-image": {
        "id": "focus-image",
        "stationId": "production-studio",
        "title": "Frame the image around useful evidence",
        "action": "Choose a crop that preserves product use, benefit evidence and deliberate message space.",
        "reason": "The audience can judge only the evidence that remains visible inside the frame.",
        "ownerRole": "art-director",
        "holdingAction": "The Strategist checks that the image supports the stated product value without a caption."
    },
    "prove-value": {
        "id": "prove-value",
        "stationId": "copy-room",
        "title": "Connect the claim to evidence",
        "action": "Write one precise claim and name the product feature or image detail that supports it.",
        "reason": "A credible campaign links audience benefit to evidence rather than an absolute promise.",
        "ownerRole": "strategist",
        "holdingAction": "The Art Director makes the supporting evidence noticeable in the composition."
    },
    "polish-campaign": {
        "id": "polish-campaign",
        "stationId": "production-studio",
        "title": "Apply the evidence in the creative studio",
        "action": "Open the creator, apply the agreed hierarchy, message, framing and proof, then return to the agency.",
        "reason": "Practice becomes useful only when it changes the pair's own advertisement.",
        "ownerRole": "art-director",
        "holdingAction": "The Strategist checks every visual change against audience relevance and claim support."
    },
    "prepare-pitch": {
        "id": "prepare-pitch",
        "stationId": "pitch-theatre",
        "title": "Prepare the campaign pitch",
        "action": "Review all required evidence, choose a presentation format and build the final market card.",
        "reason": "The pair must be able to explain how the finished advertisement works for its audience.",
        "ownerRole": "strategist",
        "holdingAction": "The Art Director checks the final visual at billboard, magazine and vertical-screen scales."
    },
    "present-campaign": {
        "id": "present-campaign",
        "stationId": "pitch-theatre",
        "title": "Present the finished campaign",
        "action": "Show the exact published advertisement and explain its audience, value, AIDA, hierarchy and proof.",
        "reason": "The pitch makes the pair's decisions visible and prepares the campaign for the class market.",
        "ownerRole": "art-director",
        "holdingAction": "The Strategist supplies the explanation for each piece of campaign evidence."
    }
}

static func required_missions() -> Array[Dictionary]:
    return _copy_records(REQUIRED_MISSION_RECORDS)

static func sidequests() -> Array[Dictionary]:
    return _copy_records(SIDEQUEST_RECORDS)

static func mission(mission_id: String) -> Dictionary:
    for record in REQUIRED_MISSION_RECORDS:
        if record.get("id") == mission_id:
            return Dictionary(record).duplicate(true)
    return {}

static func sidequest(sidequest_id: String) -> Dictionary:
    for record in SIDEQUEST_RECORDS:
        if record.get("id") == sidequest_id:
            return Dictionary(record).duplicate(true)
    return {}

static func objective(objective_id: String) -> Dictionary:
    if not OBJECTIVE_RECORDS.has(objective_id):
        return {}
    return Dictionary(OBJECTIVE_RECORDS.get(objective_id)).duplicate(true)

static func evaluate_choice(mission_id: String, choice_id: String) -> Dictionary:
    var record := mission(mission_id)
    if record.is_empty():
        record = sidequest(mission_id)
    if record.is_empty():
        return {}
    for choice_value in Array(record.get("choices", [])):
        if typeof(choice_value) != TYPE_DICTIONARY:
            continue
        var choice: Dictionary = choice_value
        if choice.get("id") == choice_id:
            return {
                "correct": choice_id == String(record.get("correctChoiceId")),
                "effect": String(choice.get("effect"))
            }
    return {}

static func _copy_records(source: Array) -> Array[Dictionary]:
    var result: Array[Dictionary] = []
    for record in source:
        result.append(Dictionary(record).duplicate(true))
    return result
