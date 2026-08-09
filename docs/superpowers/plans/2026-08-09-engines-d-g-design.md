# Engines D-G demonstration design

**Branch:** `agent/mission-clarity-20260807`

**Governing plan:** `2026-08-07-mission-demonstration-stages.md`

**Status:** approved implementation detail under Peter's instruction to complete Engines D-G and the release sequence without another design pause.

## Shared boundary

These four engines replace the remaining writing gates. They do not change the initial
four-treatment choice, the paired Strategist/Art Director roles, Supabase data, the
writer's statement, or the pitch theatre. The open question about presenting generated
evidence as the pair's own words remains Peter's call and is not settled here.

Every stage is record-driven. No stage branches on a mission ID. Each pure measure scores
the concept named in its record; it never compares the student's work with a hidden
pixel-perfect arrangement. A passing result supplies a measured evidence sentence to the
existing mission controller.

All controls target school MacBooks with keyboard plus mouse or trackpad. A phone-shaped
advertising frame in Engine G is content inside the desktop game, not phone support.

## Asset decision

The local Asset Packs catalogue was searched for billboard, poster, phone, card,
document, paper, chip, headline, advertisement, button and panel roles. The results were
either unrelated fantasy/3D UI or stylistically inconsistent with the agency's existing
Bauhaus surfaces. Engines D-F are diagrams made of labelled Controls; adding raster art
would be decorative. Engine G reuses the already-approved transparent ceramic-mug
cut-out from Engine C as its recognisable subject.

- Recommended external collection: none.
- Existing visual system: `agency_theme.tres`, native Control surfaces, existing ink,
  cream, teal and state colours.
- New generated assets: none.
- Uncovered load-bearing roles: none.
- New licence/provenance work: none.

## Engine D - drag evidence to the statement it supports

### Learning move

Students apply audience or product evidence to a claim. The expected stumbling block is
surface-word matching: a chip may repeat a word such as *belonging* or *blue* without
supporting the whole candidate statement. The observable move is therefore a support
relation, not a prose explanation.

### Record contract

`demonstration` supplies:

- `scene`, `instruction`, `sourceHeading`, `targetHeading`;
- `evidence`: ordered dictionaries with `id` and `label`;
- `statements`: ordered dictionaries with `id` and `label`;
- `supports`: evidence ID to an array of statement IDs that the evidence genuinely
  supports;
- `checkPhrases`, `unmetSentences`, `wonSentence`, `evidenceSentence`, and
  `subjectPhrase`.

The support map may allow more than one destination. Chip order inside a statement is
irrelevant. Statements with no incoming support relation are unsupportable by design.

### Measure

`target_measure.gd` receives evidence, statements, supports and assignments. It reports:

- placed evidence count;
- unplaced evidence IDs;
- unsupported assignments;
- occupied unsupportable statement IDs;
- supported statement IDs; and
- `passed`.

Pass requires every declared evidence chip to be placed on a statement listed in its
support relation. This entails that unsupportable statements remain empty. Unknown,
duplicate or missing evidence cannot pass.

### Mission records

`audience-brief`: four brief facts all support the self-directed productive after-school
interpretation; price-first, adult-control and trend-copy statements are unsupportable.

`claim-proof`: removable tiles, visible priorities and reorderability support the
qualified benefit claim; guarantee, empty-superlative and unrelated-colour claims are
unsupportable.

### Interaction and accessibility

The stage has a source bank on the left and statement cards on the right. A chip can be
dragged to a card or selected and then assigned by activating a card. Activating an
assigned chip returns it to the bank. Tab reaches every chip and statement; Return or
Space performs the click path. Visible text explains both input routes. Reset restores
the record. Check refuses an incomplete or unsupported arrangement. A second explicit
`Finish task` activation preserves the completion feedback before the panel advances.

## Engine E - sequence constrained cards

### Learning move

Students construct a cumulative order rather than recognising an already-written list.
The expected error is treating stages as independent labels or matching their surface
position. The stage makes the path visible while the measure tests prerequisite edges.

### Record contract

`demonstration` supplies:

- `scene`, `instruction`, `cards` (`id`, `label`, optional `shortLabel`);
- `constraints`: dictionaries with `before` and `after` card IDs;
- `drawPath` for the reading-path version;
- feedback phrases and an evidence-sentence template.

### Measure

`sequence_measure.gd` validates a permutation of all declared cards, then reports each
constraint as met or unmet. Pass requires every card exactly once and every `before ->
after` edge satisfied. This is a partial-order measure: records can permit multiple valid
orders when the concept permits them.

### Mission records

`aida`: Attention before Interest, Interest before Desire, Desire before Action.

`reading-path`: Product image before Headline, Headline before Action. A `Line2D` joins
the centres of the current cards in order so the path changes with the arrangement.

### Interaction and accessibility

Cards can be dragged over another card to reorder, or selected and moved with visible
Move left/Move right controls. Left and Right perform the same move while a card has
focus. Each card displays its current sequence number as text, so colour is never the
only cue. Check names the first violated edge. Completion uses the two-step finish.

## Engine F - removable headline word chips

### Learning move

Students remove empty evaluation while preserving the product benefit. The work is
editing against two visible constraints, not composing in a blank box.

### Record contract

`demonstration` supplies:

- `scene`, `instruction`, ordered `chips` (`id`, `text`, `wordCount`);
- `requiredBenefitTokens`;
- `maxWords`;
- feedback and evidence-sentence templates.

### Measure

`word_chip_measure.gd` accepts the declared chips and retained IDs. It rejects unknown
or duplicate IDs, totals the retained word counts, and reports missing benefit tokens.
Pass requires the total at or below `maxWords` and every benefit token retained. Tokens
not required by the benefit may remain if the headline still meets the cap, so more than
one shortening can pass.

### Mission record

`headline-surgery` starts with: `The best, greatest and most amazing solution for
everyone: control your hour. Keep your priorities visible.` The required benefit chips
carry `control`, `your hour`, `Keep`, `your priorities`, and `visible`; the cap is nine
words. The shortest intact benefit is seven words, leaving room for more than one valid
edit while preventing the empty praise from surviving wholesale.

### Interaction and accessibility

Activating a retained chip removes it; activating a removed chip restores it in authored
order. Retained and removed banks are explicitly labelled, and the live headline preview
and `words / cap` readout update together. Reset, Check and the two-step finish follow the
other stages.

## Engine G - fit an advertisement to its format

### Learning move

Students coordinate message length with visual scale under viewing conditions. The
measure tests whether the same composition is legible in a selected frame, rather than
rewarding the format name alone.

### Record contract

`demonstration` supplies:

- `scene`, `instruction`, `subjectArt`;
- `formats`: `id`, `label`, `aspect`, `viewingCondition`, `maxWords`, and
  `minSubjectCoverage`;
- `headlines`: `id`, `text`, and `wordCount`;
- initial format, headline and subject rectangle;
- feedback and evidence-sentence templates.

The three records are billboard, vertical screen and poster. Each can pass when its own
constraints are met; billboard is not a hidden required answer.

### Measure

`format_measure.gd` reports:

- headline word count versus the chosen format's cap;
- subject area divided by frame area;
- whether the subject rectangle is contained by the format frame; and
- `passed`.

Pass requires text at or below the cap, subject coverage at or above the minimum, and the
subject fully inside the frame. Coverage comparisons use a small normalised tolerance;
containment does not.

### Interaction and accessibility

Students choose a format and one supplied headline, drag the existing product cut-out,
and use Smaller/Larger to change its scale. Arrow keys nudge the focused subject; visible
buttons provide the same operations. The viewing condition, text cap, coverage reading
and containment state remain visible. The frame is labelled as billboard, vertical
screen or poster; aspect ratio and labels carry meaning in addition to colour.

## Tests and integration

Each measure receives positive, boundary, malformed-input and negative-control tests.
Each stage test proves the record contract, input path, live readout, failure path,
two-step completion, evidence sentence, focus target and 1280x800 dialog fit. Catalog
tests prove both missions for shared Engines D and E bind distinct records to the same
scene, and that F and G bind their own scenes.

All new scripts and scenes join `scripts/student-copy-corpus.mjs`. After all four engines
land, the twelve records receive explicit `term` fields and term-led goals; only then are
`transferPrompt`, `TransferStage` and their writing-only controller paths removed.
