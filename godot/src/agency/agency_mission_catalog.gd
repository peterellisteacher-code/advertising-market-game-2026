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

# Engine A's optional record uses the same measure in the opposite direction. The product
# opens amid four larger, bright competitors; students make it lead by demoting those
# competitors rather than enlarging the product itself.
const SALIENCE_RESCUE_DEMONSTRATION := {
    "engine": "arrange-for-salience",
    "scene": "res://src/agency/missions/demonstrations/SalienceStage.tscn",
    "plate": "res://assets/agency/colour/poster-panel.png",
    "stageSize": Vector2(880, 320),
    "targetId": "product",
    "instruction": "Make the ceramic mug the clear focal point by demoting the competing elements. Select an element, then drag it or use the arrow keys; reduce its size or apply a quieter colour.",
    "minScale": 0.12,
    "maxScale": 0.95,
    "objects": [
        {
            "id": "product",
            "name": "ceramic mug",
            "texture": "res://assets/agency/colour/product-mug.png",
            "position": Vector2(440, 176),
            "scale": 0.52,
            "tint": Color(1, 1, 1, 1)
        },
        {
            "id": "headline",
            "name": "headline block",
            "texture": "res://assets/agency/colour/poster-headline.png",
            "position": Vector2(380, 82),
            "scale": 0.95,
            "tint": Color("ff6b57")
        },
        {
            "id": "body",
            "name": "body-copy block",
            "texture": "res://assets/agency/colour/poster-body.png",
            "position": Vector2(500, 164),
            "scale": 0.78,
            "tint": Color("42ccd1")
        },
        {
            "id": "action",
            "name": "action block",
            "texture": "res://assets/agency/colour/poster-action.png",
            "position": Vector2(650, 250),
            "scale": 0.95,
            "tint": Color("f8d165")
        },
        {
            "id": "badge",
            "name": "promotional badge",
            "texture": "res://assets/agency/colour/poster-action.png",
            "position": Vector2(250, 244),
            "scale": 0.95,
            "tint": Color("9bd67a")
        }
    ],
    "tints": [
        {"id": "original", "label": "Original", "colour": Color(1, 1, 1, 1)},
        {"id": "soft-cream", "label": "Soft cream", "colour": Color("efe8d0")},
        {"id": "muted-teal", "label": "Muted teal", "colour": Color("83b7ad")},
        {"id": "muted-coral", "label": "Muted coral", "colour": Color("d98f7a")}
    ],
    "leverPhrases": {
        "size": "size",
        "isolation": "space around it",
        "contrast": "colour difference"
    },
    "wonSentences": {
        "size": "The {target} is now the largest remaining element after the competitors were reduced, so the audience sees it first.",
        "isolation": "The {target} now has the most clear space after the competitors were moved, so the audience sees it first.",
        "contrast": "The {target} now has the strongest colour difference after the competitors were quietened, so the audience sees it first."
    },
    "evidenceSentences": {
        "size": "Competing elements were reduced until the {target} became the largest remaining element, so the audience sees it first.",
        "isolation": "Competing elements were moved until the {target} had the most clear space, so the audience sees it first.",
        "contrast": "Competing elements were quietened until the {target} had the strongest colour difference, so the audience sees it first."
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
    # them. One piece of art rather than a mark plus two Labels: the project ships no font
    # files at all, so type set at runtime falls back to the default face and loses the
    # heavy condensed wordmark the parody depends on. Its aspect has to match sloganSize,
    # which test_crop_measure.gd holds.
    "sloganArt": "res://assets/agency/crop/preppy-max-lockup.png",
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


# Engine C — colour wheel. Kate supplies three product briefs. The pair colours the same
# four poster elements for each one, so the wheel has to be read as a relationship diagram
# rather than used as a store of authored answers. Contrast begins with a neutral poster;
# its hue data still belongs to the brief, but every visible element starts at zero colour
# strength and therefore fails the two action-accent checks.
const COLOUR_DEMONSTRATION := {
    "engine": "colour-wheel",
    "scene": "res://src/agency/missions/demonstrations/ColourStage.tscn",
    "wheel": "res://assets/agency/colour/colour-wheel.png",
    "panelArt": "res://assets/agency/colour/poster-panel.png",
    "headlineArt": "res://assets/agency/colour/poster-headline.png",
    "bodyArt": "res://assets/agency/colour/poster-body.png",
    "actionArt": "res://assets/agency/colour/poster-action.png",
    "actionElement": "action",
    "clientName": "Kate",
    "clientRole": "80-year-old grandmother and owner of Preppy Cola",
    "clientPortrait": "res://assets/agency/colour/client-kate-preppy-cola.png",
    "clientDialogue": {
        "opening": "I know a good colour system gives the eye one clear destination. Build each palette with related supporting colours and one clear action colour.",
        "next": "Good. Now give {product} a palette that suits {feeling} and still makes its action easy to find.",
        "complete": "These palettes work. Each product has its own feeling, and every action is easy to find."
    },
    "instruction": "Build one palette for each product. Select a poster element, then choose a colour from the wheel.",
    "elementLabels": {
        "panel": "Panel",
        "headline": "Headline",
        "body": "Body copy",
        "action": "Action"
    },
    "jobs": [
        {
            "id": "sleep-tea",
            "product": "Herbal sleep tea",
            "feeling": "calm",
            "paletteGuidance": "cool supporting hues",
            "productImage": "res://assets/agency/colour/product-sleep-tea.png",
            "toneHue": 210.0,
            "elements": [
                {"id": "panel", "hue": 210.0, "strength": 0.0},
                {"id": "headline", "hue": 210.0, "strength": 0.0},
                {"id": "body", "hue": 210.0, "strength": 0.0},
                {"id": "action", "hue": 210.0, "strength": 0.0}
            ]
        },
        {
            "id": "skateboard",
            "product": "Skateboard",
            "feeling": "urgent",
            "paletteGuidance": "warm supporting hues and high contrast",
            "productImage": "res://assets/agency/colour/product-skateboard.png",
            "toneHue": 30.0,
            "elements": [
                {"id": "panel", "hue": 30.0, "strength": 0.0},
                {"id": "headline", "hue": 30.0, "strength": 0.0},
                {"id": "body", "hue": 30.0, "strength": 0.0},
                {"id": "action", "hue": 30.0, "strength": 0.0}
            ]
        },
        {
            "id": "ceramic-mug",
            "product": "Handmade ceramic mug",
            "feeling": "restrained",
            "paletteGuidance": "close, muted natural hues",
            "productImage": "res://assets/agency/colour/product-mug.png",
            "toneHue": 120.0,
            "elements": [
                {"id": "panel", "hue": 120.0, "strength": 0.0},
                {"id": "headline", "hue": 120.0, "strength": 0.0},
                {"id": "body", "hue": 120.0, "strength": 0.0},
                {"id": "action", "hue": 120.0, "strength": 0.0}
            ]
        }
    ],
    "minAccentSeparation": 90.0,
    # The verified wheel's smallest adjacent-ring increase is 0.295, so 0.25 is
    # achievable with one outward move and cannot be achieved on the same ring.
    "minAccentStrength": 0.25,
    "maxSupportSpread": 60.0,
    "maxToneDistance": 45.0,
    # C uses checkPhrases, following the newer engine B record. These are conditions the
    # palette has to meet, not three competing levers from which one winner is selected.
    "checkPhrases": {
        "accentSeparation": "action colour separated",
        "accentStrength": "action colour strongest",
        "supportHarmony": "supporting colours related",
        "toneMatch": "supporting colours suit the feeling"
    },
    "unmetSentences": {
        "accentSeparation": "The action colour is too close to the supporting colours. Move the action further around the wheel.",
        "accentStrength": "The action is not stronger than every supporting element. Increase the strength difference by changing rings.",
        "supportHarmony": "The supporting colours are too far apart. Move one supporting element closer to the others on the wheel.",
        "toneMatch": "The supporting colours do not suit {feeling}. Move them towards the hues named in the brief."
    },
    "wonSentences": {
        "job": "The palette for {product} now uses related supporting colours that suit {feeling}, with one clear action accent.",
        "complete": "The three product palettes now meet their product briefs."
    },
    "evidenceSentences": {
        "colour": "The three product palettes used related supporting colours that suited each requested feeling and one stronger, separated colour for each action, so the audience can identify the intended tone and locate the action."
    },
    "subjectPhrase": "the three product palettes"
}

# The optional clinic uses the same engine and the same three products, but the record
# replaces their opening palettes and Kate's assignment. Every opening element is fully
# bright; the three supporting hues fan around the wheel, and the action repeats the panel
# hue. The measure therefore reports all four faults before the pair repairs anything.
const COLOUR_CLINIC_DEMONSTRATION := {
    "engine": "colour-wheel",
    "scene": "res://src/agency/missions/demonstrations/ColourStage.tscn",
    "baseRecord": COLOUR_DEMONSTRATION,
    "instruction": "Repair one palette for each product. Select a poster element, then choose a colour from the wheel.",
    "clientDialogue": {
        "opening": "These palettes are shouting in every direction. Repair each one so its supporting colours work together and its action colour leads.",
        "next": "One repair is done. Now remove the competing colour signals from {product}.",
        "complete": "Much better. The supporting colours now work together, and every action earns attention."
    },
    "jobs": [
        {
            "id": "sleep-tea",
            "product": "Herbal sleep tea",
            "feeling": "calm",
            "paletteGuidance": "cool supporting hues",
            "productImage": "res://assets/agency/colour/product-sleep-tea.png",
            "toneHue": 210.0,
            "elements": [
                {"id": "panel", "hue": 210.0, "strength": 1.0},
                {"id": "headline", "hue": 330.0, "strength": 1.0},
                {"id": "body", "hue": 90.0, "strength": 1.0},
                {"id": "action", "hue": 210.0, "strength": 1.0}
            ]
        },
        {
            "id": "skateboard",
            "product": "Skateboard",
            "feeling": "urgent",
            "paletteGuidance": "warm supporting hues and high contrast",
            "productImage": "res://assets/agency/colour/product-skateboard.png",
            "toneHue": 30.0,
            "elements": [
                {"id": "panel", "hue": 30.0, "strength": 1.0},
                {"id": "headline", "hue": 150.0, "strength": 1.0},
                {"id": "body", "hue": 270.0, "strength": 1.0},
                {"id": "action", "hue": 30.0, "strength": 1.0}
            ]
        },
        {
            "id": "ceramic-mug",
            "product": "Handmade ceramic mug",
            "feeling": "restrained",
            "paletteGuidance": "close, muted natural hues",
            "productImage": "res://assets/agency/colour/product-mug.png",
            "toneHue": 120.0,
            "elements": [
                {"id": "panel", "hue": 120.0, "strength": 1.0},
                {"id": "headline", "hue": 240.0, "strength": 1.0},
                {"id": "body", "hue": 0.0, "strength": 1.0},
                {"id": "action", "hue": 120.0, "strength": 1.0}
            ]
        }
    ],
    "wonSentences": {
        "job": "The palette for {product} now has related supporting colours that suit {feeling}, with one clear action accent.",
        "complete": "The three product palettes have been repaired."
    },
    "evidenceSentences": {
        "colour": "The three product palettes were repaired so their supporting colours suited each requested feeling and one stronger, separated colour carried each action, so the audience can identify the intended tone and locate the action."
    },
    "subjectPhrase": "the three repaired product palettes"
}

# Engine D — drag to target. The record declares a support relation, not an answer
# position. Chip order is immaterial, and a record may allow one fact to support more than
# one statement. Statements with no incoming support stay empty because no fact can
# truthfully be placed on them.
const AUDIENCE_TARGET_DEMONSTRATION := {
    "engine": "drag-to-target",
    "scene": "res://src/agency/missions/demonstrations/TargetStage.tscn",
    "instruction": "Place every brief fact on the audience interpretation it supports.",
    "sourceHeading": "BRIEF FACTS",
    "targetHeading": "AUDIENCE INTERPRETATIONS",
    "evidence": [
        {"id": "context", "label": "Context: Teenagers have one hour after school."},
        {"id": "need", "label": "Need: Make that hour productive."},
        {"id": "independence", "label": "Value: Independence."},
        {"id": "belonging", "label": "Value: Belonging."}
    ],
    "statements": [
        {"id": "self-directed", "label": "A productive after-school option should still feel self-directed."},
        {"id": "cheapest", "label": "The lowest price is the audience's main need."},
        {"id": "adult-control", "label": "Adults should organise every part of the hour."},
        {"id": "trend-copy", "label": "Belonging means copying whatever is currently popular."}
    ],
    "supports": {
        "context": ["self-directed"],
        "need": ["self-directed"],
        "independence": ["self-directed"],
        "belonging": ["self-directed"]
    },
    "checkPhrases": {
        "allPlaced": "all facts placed",
        "supports": "each fact supports its statement",
        "unsupportedEmpty": "unsupported statements empty"
    },
    "unmetSentences": {
        "declarations": "This evidence task is incomplete.",
        "allPlaced": "Place every brief fact before checking.",
        "supports": "{evidence} does not support {statement}. Move it to an interpretation supported by the whole fact.",
        "unsupportedEmpty": "{statement} has no supporting evidence. Return its chips to the brief."
    },
    "wonSentence": "All four brief facts support {statement}.",
    "evidenceSentence": "The four brief facts support {statement}, so the audience decision uses the stated context, need and values.",
    "subjectPhrase": "the audience interpretation"
}

const CLAIM_PROOF_TARGET_DEMONSTRATION := {
    "engine": "drag-to-target",
    "scene": "res://src/agency/missions/demonstrations/TargetStage.tscn",
    "instruction": "Place each product proof on the claim it can genuinely support. Leave absolute claims empty.",
    "sourceHeading": "PRODUCT PROOF",
    "targetHeading": "CANDIDATE CLAIMS",
    "evidence": [
        {"id": "removable-tiles", "label": "Feature: Planning tiles can be removed and moved."},
        {"id": "visible-priorities", "label": "Image: Several priorities are visible together."},
        {"id": "reorder", "label": "Use: The order can change during a short session."}
    ],
    "statements": [
        {"id": "qualified-benefit", "label": "The removable tiles help you reorganise a short session as priorities change."},
        {"id": "guarantee", "label": "This product guarantees immediate success for every student."},
        {"id": "revolutionary", "label": "This is the most revolutionary product ever created."},
        {"id": "colour-proof", "label": "Because the product is blue, every afternoon becomes productive."}
    ],
    "supports": {
        "removable-tiles": ["qualified-benefit"],
        "visible-priorities": ["qualified-benefit"],
        "reorder": ["qualified-benefit"]
    },
    "checkPhrases": {
        "allPlaced": "all proof placed",
        "supports": "each proof supports its claim",
        "unsupportedEmpty": "absolute claims empty"
    },
    "unmetSentences": {
        "declarations": "This claim task is incomplete.",
        "allPlaced": "Place every piece of product proof before checking.",
        "supports": "{evidence} does not support {statement}. Test the whole claim, not a repeated word.",
        "unsupportedEmpty": "{statement} cannot be proved by this product evidence. Leave it empty."
    },
    "wonSentence": "The product evidence supports {statement}, while the absolute claims remain empty.",
    "evidenceSentence": "The removable tiles, visible priorities and reorderable session support {statement}, while the absolute claims remain unsupported, so the audience receives a credible benefit rather than a guarantee.",
    "subjectPhrase": "the qualified product claim"
}

# Engine E — sequence cards. Both records declare prerequisite edges, so the measure
# accepts every complete order that satisfies the concept rather than comparing with one
# hidden authored list. Reading path adds a live line through the stable card positions;
# AIDA uses the same scene without that line.
const READING_PATH_SEQUENCE_DEMONSTRATION := {
    "engine": "sequence-cards",
    "scene": "res://src/agency/missions/demonstrations/SequenceStage.tscn",
    "instruction": "Order the advertisement elements so the audience meets the subject, then its meaning, then the requested action.",
    "heading": "BUILD THE READING PATH",
    "cards": [
        {"id": "image", "shortLabel": "Product image", "label": "Meet the product and recognise what the advertisement is about."},
        {"id": "headline", "shortLabel": "Headline", "label": "Connect the product to its useful meaning."},
        {"id": "action", "shortLabel": "Action", "label": "Give the audience a feasible next step."}
    ],
    "constraints": [
        {"before": "image", "after": "headline"},
        {"before": "headline", "after": "action"}
    ],
    "initialOrder": ["action", "headline", "image"],
    "drawPath": true,
    "checkPhrases": {
        "permutation": "all three points used once",
        "constraints": "subject before meaning before action"
    },
    "unmetSentences": {
        "declarations": "This reading-path task is incomplete.",
        "permutation": "Use the product image, headline and action exactly once.",
        "constraints": "{before} must come before {after}. Move one card and watch the path change."
    },
    "wonSentence": "The reading path now moves from {first} to {last} without a visual dead end.",
    "evidenceSentence": "The reading path moves through {order}, so the audience can connect the product, its meaning and the requested action in sequence.",
    "subjectPhrase": "the advertisement reading path"
}

const AIDA_SEQUENCE_DEMONSTRATION := {
    "engine": "sequence-cards",
    "scene": "res://src/agency/missions/demonstrations/SequenceStage.tscn",
    "instruction": "Put the AIDA stages in the order that builds a reason to act.",
    "heading": "BUILD THE AIDA SEQUENCE",
    "cards": [
        {"id": "attention", "shortLabel": "Attention", "label": "Make one distinctive subject easy to notice."},
        {"id": "interest", "shortLabel": "Interest", "label": "Show why the subject is relevant to this audience."},
        {"id": "desire", "shortLabel": "Desire", "label": "Develop the audience benefit into something worth wanting."},
        {"id": "action", "shortLabel": "Action", "label": "State one clear and feasible next step."}
    ],
    "constraints": [
        {"before": "attention", "after": "interest"},
        {"before": "interest", "after": "desire"},
        {"before": "desire", "after": "action"}
    ],
    "initialOrder": ["action", "desire", "interest", "attention"],
    "drawPath": false,
    "checkPhrases": {
        "permutation": "all four stages used once",
        "constraints": "each stage prepares the next"
    },
    "unmetSentences": {
        "declarations": "This AIDA task is incomplete.",
        "permutation": "Use Attention, Interest, Desire and Action exactly once.",
        "constraints": "{before} must come before {after}. Move one stage, then check again."
    },
    "wonSentence": "The sequence now moves from {first} to {last} through all four AIDA stages.",
    "evidenceSentence": "The sequence places {order}, so each stage gives the audience a reason to continue to the next and finally act.",
    "subjectPhrase": "the AIDA sequence"
}

# Engine F — removable headline chips. The authored order stays fixed; students decide
# what to remove. Any edit under the cap that keeps every declared benefit token passes.
const HEADLINE_WORD_CHIP_DEMONSTRATION := {
    "engine": "removable-word-chips",
    "scene": "res://src/agency/missions/demonstrations/WordChipStage.tscn",
    "instruction": "Remove empty praise while keeping the product benefit. Keep the headline at nine words or fewer.",
    "chips": [
        {"id": "the", "text": "The", "wordCount": 1},
        {"id": "best", "text": "best,", "wordCount": 1},
        {"id": "greatest", "text": "greatest and", "wordCount": 2},
        {"id": "amazing", "text": "most amazing", "wordCount": 2},
        {"id": "solution", "text": "solution for everyone:", "wordCount": 3},
        {"id": "control", "text": "control", "wordCount": 1},
        {"id": "your-hour", "text": "your hour.", "wordCount": 2},
        {"id": "keep", "text": "Keep", "wordCount": 1},
        {"id": "your-priorities", "text": "your priorities", "wordCount": 2},
        {"id": "visible", "text": "visible.", "wordCount": 1}
    ],
    "requiredBenefitTokens": ["control", "your-hour", "keep", "your-priorities", "visible"],
    "maxWords": 9,
    "checkPhrases": {
        "wordCap": "headline at nine words or fewer",
        "benefit": "product benefit preserved"
    },
    "unmetSentences": {
        "declarations": "This headline task is incomplete.",
        "wordCap": "The headline has {words} words. Remove at least one empty phrase to reach {max_words}.",
        "benefit": "The headline has lost {missing}. Restore that benefit chip."
    },
    "wonSentence": "The headline keeps the product benefit in {words} words.",
    "evidenceSentence": "The headline was reduced to {words} words while retaining the benefit: {headline}",
    "subjectPhrase": "the revised headline"
}

# Engine G — format fit. The frame's declared aspect supplies the coordinate space for
# the existing product cutout. Students coordinate message length, product scale and
# containment under a named viewing condition; selecting a format never passes by itself.
const MEDIA_FORMAT_DEMONSTRATION := {
    "engine": "format-fit",
    "scene": "res://src/agency/missions/demonstrations/FormatStage.tscn",
    "instruction": "Choose a format and headline, then move and resize the product so the composition can be understood under that format's viewing conditions.",
    "subjectArt": "res://assets/agency/colour/product-mug.png",
    "formats": [
        {
            "id": "billboard",
            "label": "Billboard",
            "aspect": Vector2(16, 6),
            "viewingCondition": "Seen briefly from a distance.",
            "maxWords": 6,
            "minSubjectCoverage": 0.18
        },
        {
            "id": "vertical",
            "label": "Vertical screen",
            "aspect": Vector2(9, 16),
            "viewingCondition": "Seen nearby in a tall frame.",
            "maxWords": 12,
            "minSubjectCoverage": 0.20
        },
        {
            "id": "poster",
            "label": "Poster",
            "aspect": Vector2(4, 5),
            "viewingCondition": "Seen at walking distance for several seconds.",
            "maxWords": 18,
            "minSubjectCoverage": 0.16
        }
    ],
    "headlines": [
        {
            "id": "short",
            "text": "Control your hour. Keep priorities visible.",
            "wordCount": 6
        },
        {
            "id": "medium",
            "text": "Control your hour and keep every changing priority clearly visible.",
            "wordCount": 10
        },
        {
            "id": "long",
            "text": "A complete planning system for every changing priority in your productive and independent after-school hour.",
            "wordCount": 15
        }
    ],
    # This names the correct high-level choice while still failing the actual engine on
    # word count and product scale. The negative control holds that distinction.
    "initialFormatId": "billboard",
    "initialHeadlineId": "long",
    "initialSubjectRect": Rect2(6.5, 2, 2, 2),
    "checkPhrases": {
        "wordCap": "headline fits the viewing time",
        "coverage": "product is large enough",
        "containment": "whole product remains in the frame"
    },
    "unmetSentences": {
        "declarations": "This format task is incomplete.",
        "wordCap": "The {format} allows {max_words} words, but this headline has {words}. Choose a shorter headline.",
        "coverage": "The product fills only {coverage}% of the frame. Make it larger for this viewing condition.",
        "containment": "Part of the product is outside the frame. Move it back inside."
    },
    "wonSentence": "The {format} composition now fits its viewing conditions: {words} words, {coverage}% product coverage and the whole product inside the frame.",
    "evidenceSentence": "The {format} composition suits {condition}: its headline uses {words} of {max_words} words, the product fills {coverage}% of the frame, and the whole product remains inside.",
    "subjectPhrase": "the format-fit composition"
}

const REQUIRED_MISSION_RECORDS := [
    {
        "id": "audience-brief",
        "stationId": "client-briefing",
        "ownerRole": "strategist",
        "title": "Read the audience before making anything",
        "term": "Audience brief",
        "goal": "Audience brief: identify the audience situation, need and values that the advertisement must respect.",
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
        "demonstration": AUDIENCE_TARGET_DEMONSTRATION,
        "reward": "Brief complete",
        "required": true
    },
    {
        "id": "salience",
        "stationId": "art-studio",
        "ownerRole": "art-director",
        "title": "Control what the audience notices first",
        "term": "Salience and AIDA Attention",
        "goal": "Salience and AIDA Attention: use size, isolation and colour contrast to make the advertisement's most important subject salient.",
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
        "demonstration": SALIENCE_DEMONSTRATION,
        "reward": "Salience lens unlocked",
        "required": true
    },
    {
        "id": "reading-path",
        "stationId": "art-studio",
        "ownerRole": "art-director",
        "title": "Build a deliberate reading path",
        "term": "Reading path",
        "goal": "Reading path: arrange imagery, headline and action so the audience encounters the advertisement in a useful sequence.",
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
        "demonstration": READING_PATH_SEQUENCE_DEMONSTRATION,
        "reward": "Reading-path overlay unlocked",
        "required": true
    },
    {
        "id": "contrast",
        "stationId": "art-studio",
        "ownerRole": "art-director",
        "title": "Use colour to create emphasis and tone",
        "term": "Colour contrast and harmony",
        "goal": "Colour contrast and harmony: choose a limited colour relationship that makes one action clear while supporting the advertisement's intended feeling.",
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
        "demonstration": COLOUR_DEMONSTRATION,
        "reward": "Colour system complete",
        "required": true
    },
    {
        "id": "framing",
        "stationId": "production-studio",
        "ownerRole": "art-director",
        "title": "Frame the image around the advertisement meaning",
        "term": "Framing and cropping",
        "goal": "Framing and cropping: choose a crop and placement that show useful detail, preserve context and leave deliberate space for the message.",
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
        "demonstration": CROP_DEMONSTRATION,
        "reward": "Framing desk complete",
        "required": true
    },
    {
        "id": "aida",
        "stationId": "strategy-room",
        "ownerRole": "strategist",
        "title": "Turn attention into a reason to act",
        "term": "AIDA sequence",
        "goal": "AIDA sequence: order the four AIDA stages so each one gives the audience a reason to continue to the next.",
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
        "demonstration": AIDA_SEQUENCE_DEMONSTRATION,
        "reward": "AIDA sequence complete",
        "required": true
    },
    {
        "id": "claim-proof",
        "stationId": "copy-room",
        "ownerRole": "strategist",
        "title": "Make a claim the advertisement can support",
        "term": "Claims and evidence",
        "goal": "Claims and evidence: connect a precise audience benefit to visible or stated evidence without making an absolute promise.",
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
        "demonstration": CLAIM_PROOF_TARGET_DEMONSTRATION,
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
        "term": "Visual hierarchy",
        "goal": "Visual hierarchy: repair a crowded fictional advertisement by restoring one dominant focal point.",
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
        "demonstration": SALIENCE_RESCUE_DEMONSTRATION,
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
        "term": "Colour hierarchy",
        "goal": "Colour hierarchy: repair palettes in which every bright colour currently claims equal importance.",
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
        "demonstration": COLOUR_CLINIC_DEMONSTRATION,
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
        "term": "Framing and cropping",
        "goal": "Framing and cropping: choose the crop that preserves the evidence needed to understand product use and audience benefit.",
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
        "term": "Concise headlines",
        "goal": "Concise headlines: shorten a weak headline while retaining the product's relevant audience benefit.",
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
        "demonstration": HEADLINE_WORD_CHIP_DEMONSTRATION,
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
        "term": "Media format",
        "goal": "Media format: match message length and visual scale to the conditions in which the audience will encounter the advertisement.",
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
        "demonstration": MEDIA_FORMAT_DEMONSTRATION,
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
