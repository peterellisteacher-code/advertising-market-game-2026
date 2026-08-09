# Engine C: Kate and mission split design

**Date:** 2026-08-09  
**Branch:** `agent/mission-clarity-20260807`  
**Status:** Approved by Peter on 2026-08-09. Peter approved all eight existing Engine C assets, the suggested `contrast` / `colour-clinic` split, and Kate as an 80-year-old grandmother who owns Preppy Cola. He authorised implementation choices to proceed without another approval pause.

## Outcome

Engine C remains one record-driven colour-wheel engine, but the two missions no longer open on the same exercise:

- `contrast` keeps Kate's three approved products and opens each poster on a neutral palette. Students build colour relationships from a quiet start.
- `colour-clinic` reuses the same three products and opens each poster with four equally strong, competing colours. Students repair an existing hierarchy.
- Both variants show Kate's portrait and short client dialogue. The mission instruction remains complete if the dialogue is skipped.

The supplied colour-theory guide is useful as a conceptual reference, but it is not production artwork: its small text is unreliable and the already verified twelve-hue wheel is the engine's canonical teaching object.

## Record contract

`COLOUR_DEMONSTRATION` remains the complete `contrast` record and the common source for Engine C's art, thresholds, labels, feedback, portrait, and client identity. `COLOUR_CLINIC_DEMONSTRATION` is a small overlay record containing:

- the same `engine` and `scene`, so the panel can mount it without knowing Engine C;
- `baseRecord: COLOUR_DEMONSTRATION`, merged by `colour_stage.gd` during `configure`;
- clinic-specific instruction, dialogue, opening job elements, completion copy, evidence copy, and subject phrase.

This avoids duplicating the verified wheel/measure contract. Mission-specific data stays in the catalog; the stage contains no mission-ID branches.

## Starting states

The `contrast` jobs start all four poster elements at the brief's hue with strength `0.0`. The near-white raster layers therefore appear neutral. The palette fails the two action-accent checks but retains the job's hue data for measured feedback.

Each `colour-clinic` job starts with:

- panel at the brief hue;
- headline at brief hue + 120 degrees;
- body at brief hue + 240 degrees;
- action at the same hue as the panel;
- strength `1.0` for every element.

This creates a visibly bright, competing palette which fails action separation, action strength, supporting-colour relationship, and tone. The existing measure remains the only pass authority; there is still no authored solution.

## Kate's client card

The top of `ColourStage.tscn` gains one compact horizontal client card:

- a record-loaded pixel-art portrait;
- `Kate`;
- `80-year-old grandmother and owner of Preppy Cola`;
- one dialogue label that changes at opening, between products, and on completion.

Portrait direction: respectful, visibly 80, warm and decisive rather than frail or caricatured; pixel-art treatment aligned with the game's existing product and player art; Preppy Cola navy, red, cream, and teal accents; no text or logo inside the portrait. Generate on a flat chroma background, remove it locally to real alpha, validate the result, and record prompt, tool, dimensions, hash, and processing in `godot/assets/agency/ASSET-SOURCES.md`.

Dialogue:

| Phase | `contrast` | `colour-clinic` |
|---|---|---|
| Opening | “I know a good colour system gives the eye one clear destination. Build each palette with related supporting colours and one clear action colour.” | “These palettes are shouting in every direction. Repair each one so its supporting colours work together and its action colour leads.” |
| Next product | “Good. Now give {product} a palette that suits {feeling} and still makes its action easy to find.” | “One repair is done. Now remove the competing colour signals from {product}.” |
| Complete | “These palettes work. Each product has its own feeling, and every action is easy to find.” | “Much better. The supporting colours now work together, and every action earns attention.” |

Every instructional sentence stays below 25 words. The client card establishes who is speaking; the procedural instruction and measured feedback still stand independently.

## Approaches considered

1. Duplicate two complete Engine C records. Rejected because art paths, thresholds, feedback keys, and labels could drift.
2. Add mission-ID conditionals to the stage. Rejected because the engine would cease to be record-driven.
3. Keep one complete base record and merge a clinic overlay in `configure`. Selected: the panel still sees a mountable record, the stage remains generic, and only the intentional differences are duplicated.

## Acceptance

- Catalog tests prove the mission records are distinct, share the same three products and portrait, and carry different opening states and dialogue.
- Stage tests prove the portrait and dialogue bind from the record, change between phases, and the clinic opening fails all four checks.
- Existing negative controls and the three-job sequence remain green.
- Demonstration height remains at or below 760 px.
- Student-copy coverage includes the scene and script, and the professional-copy gate accepts the new prose.
- All five repository gates pass before the follow-up commit.

