extends RefCounted
class_name AdMarketAgencyMissionCatalog

# Engine A — arrange for salience. The pair moves, resizes and recolours real objects
# over a background plate until the named target leads one of the three levers. The
# opening arrangement is deliberately one the target loses on all three, and there is no
# authored solution to match: test_salience_measure.gd holds both of those properties.
const SALIENCE_DEMONSTRATION := {
    "engine": "arrange-for-salience",
    "scene": "res://src/agency/missions/demonstrations/SalienceStage.tscn",
    "plate": "res://assets/agency/salience/fruit-table-plate.png",
    "stageSize": Vector2(880, 320),
    "targetId": "orange",
    "instruction": "Make the orange the first thing the audience sees. Drag a fruit to move it, or use the size and colour controls.",
    "minScale": 0.12,
    "maxScale": 0.9,
    "objects": [
        {
            "id": "bananas",
            "name": "bananas",
            "texture": "res://assets/agency/salience/fruit-bananas.png",
            "position": Vector2(390, 195),
            "scale": 0.50
        },
        {
            "id": "orange",
            "name": "orange",
            "texture": "res://assets/agency/salience/fruit-orange.png",
            "position": Vector2(452, 210),
            "scale": 0.28
        },
        {
            "id": "apple",
            "name": "apple",
            "texture": "res://assets/agency/salience/fruit-apple.png",
            "position": Vector2(500, 205),
            "scale": 0.30
        },
        {
            "id": "pear",
            "name": "pear",
            "texture": "res://assets/agency/salience/fruit-pear.png",
            "position": Vector2(475, 268),
            "scale": 0.26
        },
        {
            "id": "grapes",
            "name": "grapes",
            "texture": "res://assets/agency/salience/fruit-grapes.png",
            "position": Vector2(640, 130),
            "scale": 0.28
        }
    ],
    "tints": [
        {"id": "original", "label": "Original", "colour": Color(1, 1, 1, 1)},
        {"id": "warmer", "label": "Warmer", "colour": Color(1, 0.86, 0.62, 1)},
        {"id": "cooler", "label": "Cooler", "colour": Color(0.66, 0.86, 1, 1)},
        {"id": "darker", "label": "Darker", "colour": Color(0.62, 0.62, 0.66, 1)},
        {"id": "muted", "label": "Muted", "colour": Color(0.8, 0.8, 0.78, 1)}
    ],
    "leverPhrases": {
        "size": "size",
        "isolation": "space around it",
        "contrast": "colour difference"
    },
    "wonSentences": {
        "size": "The {target} is now the largest object on the table, so the audience sees it first.",
        "isolation": "The {target} now has the most space around it, so the audience sees it first.",
        "contrast": "The {target} now differs most in colour from what sits behind it, so the audience sees it first."
    },
    "evidenceSentences": {
        "size": "The {target} was made the largest object on the table, so the audience sees it first.",
        "isolation": "The {target} was given the most space around it, so the audience sees it first.",
        "contrast": "The {target} was given the strongest colour difference from what sits behind it, so the audience sees it first."
    }
}

# Engine B — crop frame. One draggable, resizable rectangle over one source photograph.
# The record names what has to survive the crop rather than where the frame belongs: there
# is no authored correct rectangle, and every frame that keeps the subject, stays close
# enough to it and leaves a plain area for the headline passes. The frame opens on the
# whole untouched picture, which does contain the subject but keeps so much of the room
# that the subject fills too little of the frame to pass.
const CROP_DEMONSTRATION := {
    "engine": "crop-frame",
    "scene": "res://src/agency/missions/demonstrations/CropStage.tscn",
    "image": "res://assets/agency/crop/preppy-max-church.png",
    # Image pixels, measured off the shipped 1920 x 640 picture: the bottle outline the boy
    # holds up, less the very tip and base of it. Trimming those is what leaves the frame
    # room to move vertically — the outline runs almost the whole height of the picture, so
    # a region drawn around all of it would pin the frame to within a few pixels top and
    # bottom and every vertical drag would read as a fault. The stage takes the picture's
    # size from the texture rather than from here, so the two cannot disagree, and
    # test_crop_measure.gd holds this region inside it.
    "subjectRegion": Rect2(842, 64, 342, 528),
    "subjectPhrase": "the bottle",
    "instruction": "Drag the frame to move it, or drag a corner to resize it. Drag the slogan to move it. The arrow keys move whatever is selected, and holding Shift moves it further. The picture is far too wide for an advertisement: cut it down so the bottle carries the frame, and put the slogan where it can still be read.",
    # The slogan the pair drags into place, rather than something the stage lays out for
    # them. The mark is art; the two lines are set as text so they stay sharp at whatever
    # size the dialog gives the stage, and so their spelling is not whatever a generator
    # produced.
    "sloganMark": "res://assets/agency/crop/preppy-max-mark.png",
    "sloganName": "PREPPY MAX",
    "sloganLine": "LIVE LIFE TO THE MAX",
    "sloganSize": Vector2(480, 192),
    # Lying across the aisle and the foot of the bottle, so the opening arrangement fails
    # on the picture the slogan covers as well as on the width the frame keeps. It has to
    # start wholly on the picture: the stage would clamp a start that hung off the bottom,
    # leaving the record describing a rectangle the pair never sees.
    "sloganStart": Vector2(720, 400),
    "minCropSize": Vector2(480, 320),
    # The bottle fills 0.15 of the untouched picture and 0.20 of a frame that only trims
    # the left quarter, against 0.26 to 0.31 for frames drawn close enough to carry it.
    "minSubjectShare": 0.23,
    # The share of the slogan's own area that has to be sitting on plain pixels. On the
    # shipped picture the plaster wall reads 0.99, half on and half off the wall reads
    # 0.77, and across the bottle it reads 0.01.
    "minPlainShare": 0.85,
    "checkPhrases": {
        "subject": "bottle kept whole",
        "prominence": "frame close enough",
        "messageInFrame": "slogan in the frame",
        "messageClear": "slogan can be read"
    },
    "unmetSentences": {
        "subject": "The frame cuts off part of {subject}. Move or widen the frame until all of it is inside.",
        "prominence": "The frame holds too much of the church around {subject}. Make the frame smaller.",
        "messageInFrame": "The slogan is outside the frame, so it is not part of the advertisement. Drag it inside.",
        "messageClear": "The slogan is lying across the picture, where nobody can read it. Drag it onto the plain wall."
    },
    # Shown in the stage, where a third line of text pushes the dialog past the shortest
    # window the game guarantees. The recorded sentence below is never drawn, so it keeps
    # the audience clause the writer's statement quotes.
    "wonSentences": {
        "crop": "The frame carries {subject}, and the slogan sits where it can be read."
    },
    "evidenceSentences": {
        "crop": "The picture was cropped so that {subject} carries the frame, and the slogan was placed on a plain area rather than across the picture, so the audience can see the product and still read the message."
    }
}

const REQUIRED_MISSION_RECORDS := [
    {
        "id": "audience-brief",
        "stationId": "client-briefing",
        "ownerRole": "strategist",
        "title": "Read the audience before making anything",
        "goal": "Identify the audience situation, need and values that the advertisement must respect.",
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
        "reward": "Brief complete",
        "required": true
    },
    {
        "id": "salience",
        "stationId": "art-studio",
        "ownerRole": "art-director",
        "title": "Control what the audience notices first",
        "goal": "Use size, isolation and colour contrast to make the advertisement's most important subject salient.",
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
        "demonstration": SALIENCE_DEMONSTRATION,
        "reward": "Salience lens unlocked",
        "required": true
    },
    {
        "id": "reading-path",
        "stationId": "art-studio",
        "ownerRole": "art-director",
        "title": "Build a deliberate reading path",
        "goal": "Arrange imagery, headline and action so the audience encounters the advertisement in a useful sequence.",
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
        "effectExplanation": "A coherent reading path helps the audience connect the visual subject, advertisement meaning and requested action in sequence.",
        "transferPrompt": "Describe the first, second and third points in your advertisement's reading path and name the line, gaze or placement that connects them.",
        "reward": "Reading-path overlay unlocked",
        "required": true
    },
    {
        "id": "contrast",
        "stationId": "art-studio",
        "ownerRole": "art-director",
        "title": "Use colour to create emphasis and tone",
        "goal": "Choose a limited colour relationship that makes one action clear while supporting the advertisement's intended feeling.",
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
        "transferPrompt": "Name your supporting colours, your single accent colour and the exact advertisement element that will receive that accent.",
        "reward": "Colour system complete",
        "required": true
    },
    {
        "id": "framing",
        "stationId": "production-studio",
        "ownerRole": "art-director",
        "title": "Frame the image around the advertisement meaning",
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
        "demonstration": CROP_DEMONSTRATION,
        "reward": "Framing desk complete",
        "required": true
    },
    {
        "id": "aida",
        "stationId": "strategy-room",
        "ownerRole": "strategist",
        "title": "Turn attention into a reason to act",
        "goal": "Order the four AIDA stages so each one gives the audience a reason to continue to the next.",
        "instruction": "Choose the sequence in which Attention introduces the subject, Interest explains relevance, Desire develops value and Action states the next step.",
        "holdingAction": "The Art Director identifies the visual element that will carry each AIDA stage and checks that all four stages do not compete at the same scale.",
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
        "transferPrompt": "Write one sentence for each AIDA stage in your advertisement and explain how the audience can move from one to the next.",
        "reward": "AIDA sequence complete",
        "required": true
    },
    {
        "id": "claim-proof",
        "stationId": "copy-room",
        "ownerRole": "strategist",
        "title": "Make a claim the advertisement can support",
        "goal": "Connect a precise audience benefit to visible or stated evidence without making an absolute promise.",
        "instruction": "Select the claim whose wording is proportionate to the evidence provided by the product feature and advertisement image.",
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
                "effect": "The audience is asked to accept an absolute outcome that no product feature or advertisement evidence can guarantee."
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
        "transferPrompt": "Write your advertisement's main claim, name the feature or image detail that supports it and remove any absolute wording the evidence cannot justify.",
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
        "instruction": "Choose the single change that removes the most competition while preserving the advertisement's necessary evidence.",
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
        "effectExplanation": "Removing equal competitors lets the audience identify the advertisement subject and action more quickly.",
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
                "effect": "The audience can locate the action while still receiving a coherent advertisement tone."
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
                "label": "Apply a different bright gradient to every advertisement element.",
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
        "demonstration": CROP_DEMONSTRATION,
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
        "holdingAction": "The Art Director checks that the revised headline can be read at the intended scale without covering advertisement evidence.",
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
        "transferPrompt": "Reduce your own headline to a precise benefit that can be read quickly and supported by the advertisement.",
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
        "instruction": "Select the format whose viewing distance, duration and orientation suit the proposed advertisement message.",
        "holdingAction": "The Art Director checks that the main subject remains recognisable at the selected format's scale and shape.",
        "choices": [
            {
                "id": "billboard-brief",
                "label": "Billboard for one large subject, a short headline and a simple action seen at distance.",
                "effect": "The audience can understand the advertisement during a brief distant encounter."
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
        "transferPrompt": "Choose billboard, magazine or vertical screen for your advertisement and explain how its viewing conditions affect your composition.",
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
        "reason": "Every later decision needs one shared account of who the advertisement is for.",
        "ownerRole": "strategist",
        "holdingAction": "The Art Director looks for a visual way to represent the selected audience value."
    },
    "build-product": {
        "id": "build-product",
        "stationId": "production-studio",
        "title": "Build a product for the audience need",
        "action": "Open the production studio and choose or adapt a product that can meet the identified need.",
        "reason": "The advertisement needs a specific offer whose value can be shown and explained.",
        "ownerRole": "strategist",
        "holdingAction": "The Art Director checks that the product has a recognisable visual form."
    },
    "direct-attention": {
        "id": "direct-attention",
        "stationId": "art-studio",
        "title": "Decide what the audience will notice first",
        "action": "Complete the salience task, then name the first focal point in your advertisement.",
        "reason": "A deliberate first point prevents every advertisement element from competing equally.",
        "ownerRole": "art-director",
        "holdingAction": "The Strategist names the benefit that deserves the audience's first attention."
    },
    "shape-message": {
        "id": "shape-message",
        "stationId": "strategy-room",
        "title": "Shape the advertisement message",
        "action": "Build an AIDA sequence that moves from first attention to one feasible audience action.",
        "reason": "The advertisement must give the audience a cumulative reason to continue and act.",
        "ownerRole": "strategist",
        "holdingAction": "The Art Director assigns a distinct visual level to each AIDA stage."
    },
    "set-campaign-tone": {
        "id": "set-campaign-tone",
        "stationId": "art-studio",
        "title": "Set emphasis and tone with colour",
        "action": "Choose supporting colours and reserve one strong accent for the advertisement priority.",
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
        "reason": "A credible advertisement links audience benefit to evidence rather than an absolute promise.",
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
        "title": "Prepare the final pitch",
        "action": "Review all required evidence, choose a presentation format and build the final market card.",
        "reason": "The pair must be able to explain how the finished advertisement works for its audience.",
        "ownerRole": "strategist",
        "holdingAction": "The Art Director checks the final visual at billboard, magazine and vertical-screen scales."
    },
    "present-campaign": {
        "id": "present-campaign",
        "stationId": "pitch-theatre",
        "title": "Present the finished advertisement",
        "action": "Show the exact published advertisement and explain its audience, value, AIDA, hierarchy and proof.",
        "reason": "The pitch makes the pair's decisions visible and prepares the advertisement for the class market.",
        "ownerRole": "art-director",
        "holdingAction": "The Strategist supplies the explanation for each piece of advertisement evidence."
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
