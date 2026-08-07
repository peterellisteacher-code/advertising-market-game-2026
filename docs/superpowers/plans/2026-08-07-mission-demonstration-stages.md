# Mission demonstration stages — replacing the writing gate

**Branch:** `agent/mission-clarity-20260807` (base `main`)
**Approved by Peter, 2026-08-07:** all twelve missions get a demonstration stage; the
pass rule is measured on the single dominant lever.

## Why

Every one of the twelve missions currently ends in the same stage: a 30–400 character
text box (`transferPrompt` in `godot/src/agency/agency_mission_catalog.gd`, rendered by
`TransferStage` in `godot/src/agency/missions/AgencyMissionPanel.tscn`). Peter's
objection, verbatim in intent: students are made to justify decisions in writing that
nobody will read and that does not advance their own project. It is an arbitrary
roadblock that frustrates rather than empowers the decision. What is useful is getting
them to **demonstrate** the concept.

The worked example he gave: an image of a bowl of fruit in which the bananas are the
most salient object; the task is to make an orange the most salient instead.

## The asset approach

You cannot make a finished generated image rearrangeable. Segmenting a flat render is
fragile and looks it. Instead:

- Each manipulable object is generated as **its own raster sprite with real alpha**.
- The setting is a separate **background plate**.
- Godot places, scales, moves and tints them.

This is the only version consistent with the standing rule that code places and moves
raster art and never draws it. No SVG, no code-drawn shapes, in any deliverable.

Generation route: fal-ai `fal_image` with a style cue matching the game's existing
illustrative look, then `fal_remove_bg` where the model will not produce clean alpha.
Run `fal_get_schema` before any model new to the session. Record every asset in
`godot/assets/agency/ASSET-SOURCES.md` in the format already used there: tool, prompt,
dimensions, SHA-256, licence note, and the public-use decision.

## The pass rule

Peter chose **measured, single dominant lever**. Each manipulable object scores on three
levers, each normalised 0–1 across the objects in the scene:

| Lever | Measure |
|---|---|
| Size | object area ÷ largest object area |
| Isolation | distance to nearest neighbour's bounding box ÷ scene diagonal |
| Colour contrast | ΔE of the object's mean colour against the mean of its local surround |

The stage passes when the **named target object leads every other object on at least one
lever**. It does not have to lead on all three.

The feedback sentence must name the lever it won on — "The orange is now the largest
object in the bowl, so the audience sees it first" — so the vocabulary still lands even
though the gate does not require all three. This is what preserves the teaching that the
single-lever rule gives away.

Do not author a target arrangement and compare against it. Passing must come from the
measure, not from matching a solution.

## Six engines cover twelve missions

Build the engines, not twelve bespoke stages.

### A. Arrange for salience
Objects with alpha over a plate. Student can move, scale, and recolour each. Live
readout of the three levers. Pass on the dominant-lever rule above.
→ `salience` (bowl of fruit, target: the orange)
→ `thirty-second-rescue` (a crowded advertisement's own elements; the student demotes
competitors rather than promoting the target — same measure, opposite move)

### B. Crop frame
A draggable, resizable rectangle over a raster image. The record names a required
subject region and a minimum clear area for the message. Pass when the crop contains the
former and preserves the latter.
→ `framing`, `crop-lab`

### C. Colour wheel
A raster colour wheel asset. The student picks the accent hue for one named element; the
rest of the palette is fixed. Pass when the chosen hue is far enough around the wheel
from the base hue **and** only one element carries it.
This is where Peter's colour wheel does real work rather than sitting on the page as a
diagram. Do not reuse the Pinterest reference he linked — he flagged it as too low
quality; it was an example of the kind of thing, not the asset.
→ `contrast`, `colour-clinic`

### D. Drag to target
Fact chips and candidate statements. The student drags each piece of evidence onto the
statement it supports. Pass when the supported statement collects its evidence and the
unsupported ones stay empty.
→ `audience-brief` (four brief facts onto the interpretation they support)
→ `claim-proof` (proof chips onto the claim, with absolute claims unsupportable by design)

### E. Sequence
Four cards the student drags into order.
→ `aida` (order the four stages)
→ `reading-path` (place image, headline and action; the game draws the resulting reading
line between them so the sequence is visible, which is the "introduce reading lines to
an image" Peter asked for)

### F. Word chips
The headline arrives as removable word chips. The student deletes words to shorten it
while the benefit survives. Pass when the length is under the cap and the required
benefit tokens remain.
This is the answer to the writing objection rather than an exception to it: it is
editing against a visible constraint, it is demonstrable, it is checkable, and there is
no blank box.
→ `headline-surgery`

### G. Fit to format
Engine A constrained by a format frame — billboard, phone, poster — each with its own
viewing distance. Pass when text length and visual scale suit the chosen frame.
→ `media-match`

## Also in this slice

**Name the concepts.** The catalog IDs already are `salience`, `reading-path`,
`contrast`, `framing`, `aida`, `claim-proof`. The panel never says those words. Peter:
they are terms students are familiar with and that we actively want them to use, and
using them removes sentences rather than adding them. Add a `term` field per record,
surface it, and rewrite the twelve goal statements around it. `salience` should name
both Salience and Attention from AIDA.

Student-facing copy goes through `/plain-language` then `/claude-scrubber` MICROCOPY, in
that order, and must satisfy `scripts/student-copy-professional-contract.test.mjs` —
which bans `mission`, `station`, `objective`, `campaign` and `approval` in authored
Godot copy, and forbids `advertisement` inside `ORIENTATION_STEPS` specifically.

**Button colour logic (item 3a, not yet started).** The project has no theme resource at
all: every scene defines StyleBoxFlats inline and the mission panel's action buttons
define none, so they fall through to Godot's default grey slab. Peter: grey must mean
unclickable, and only that. Add one shared `Theme` and apply it at the roots of
`AgencyMissionPanel.tscn`, `AgencyGuideDrawer.tscn` and `AgencyHud.tscn` — not via
`project.godot`, which carries a local-only GodotIQ autoload and must never be committed.

Palette already in use, from `AgencyMissionPanel.tscn`:

| Role | Colour |
|---|---|
| Panel cream | `Color(0.98, 0.965, 0.91, 1)` |
| Deep navy ink | `Color(0.04, 0.14, 0.25, 1)` |
| Teal accent | `Color(0, 0.48, 0.62, 1)` |
| Card wash | `Color(0.91, 0.96, 0.96, 1)` |

Primary action: filled teal, cream text. Secondary: cream fill, teal border, navy text.
Disabled: grey, and nothing else is grey.

## Build order

1. Button theme. Small, independent, and every later screenshot benefits.
2. Engine A end to end on `salience`, with its assets. This is the one Peter described,
   and it proves the measure, the asset pipeline and the panel stage in one go.
3. Terminology pass across the twelve records.
4. Engines B–G, each with the missions it serves.
5. Remove `transferPrompt` and `TransferStage` once no mission depends on them.

Do not delete the writing gate before its replacement lands for that mission.

## What must not regress

- `godot/project.godot` stays uncommitted (local GodotIQ autoload).
- Stage files by name; never `git add .` or `-A`.
- Gates: `npx pnpm test`, `npx tsc --noEmit`, `npx pnpm run test:build-web`,
  `npx pnpm test:godot`. The last one now imports first and fails on `SCRIPT ERROR`, so
  a failed `assert` cannot pass silently.
- `godot/tests/test_agency_hud_layout.gd` runs last because it resizes the root
  viewport. Anything that assumes 1280×800 will now be caught there.
- `missionEvidence` on `CampaignDocumentV1` is populated from
  `agency_progress.evidence_by_mission` and feeds the writer's statement and the pitch
  theatre's five criteria. **A demonstration stage still has to produce evidence text**,
  or the writer's statement loses the pair's own sentences and falls back to generic
  copy. Generate the sentence from the measured result — the lever they won on and the
  object they promoted — rather than from a text box.

## Open

- Whether the pitch theatre and writer's statement should quote the generated sentence
  as the pair's own words, given the pair no longer wrote it. Worth putting to Peter
  before wiring it.
