# Engine C Kate and mission-split implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the approved Kate client presentation and give `contrast` neutral starts while `colour-clinic` starts from deliberately broken palettes, without changing Engine C's measure.

**Architecture:** Keep `COLOUR_DEMONSTRATION` as the complete contrast/base record. Add `COLOUR_CLINIC_DEMONSTRATION` as a record overlay with `baseRecord`, and let `AdMarketColourStage.configure` deep-merge the overlay before binding UI or evaluating jobs. All visual, dialogue, and opening-palette differences remain catalog data.

**Tech stack:** Godot 4.5.1 GDScript and `.tscn`, raster PNG with real alpha, Node/pnpm contract gates.

**Execution mode:** Inline execution. The catalog, scene, stage, and Engine C test changes share one contract and should be changed and verified together.

---

## Task 1: Lock the approved behaviour with failing tests

**Files:**

- Modify: `godot/tests/test_colour_measure.gd`

- [ ] Replace the shared-record assertion with a behavior assertion: distinct mission records, identical product sequence and portrait path, neutral `contrast` starts, bright competing clinic starts, and distinct dialogue.
- [ ] Add a mounted-stage assertion that record-driven portrait/identity/dialogue are visible and that clinic opening fails all four measured checks.
- [ ] Add a phase assertion that Kate's dialogue advances after the first passing palette and switches to completion after the third.
- [ ] Run `npx pnpm test:godot`; confirm RED specifically because the split fields/client nodes are absent.

## Task 2: Generate and install Kate's portrait

**Files:**

- Create: `godot/assets/agency/colour/client-kate-preppy-cola.png`
- Create through Godot import: `godot/assets/agency/colour/client-kate-preppy-cola.png.import`
- Modify: `godot/assets/agency/ASSET-SOURCES.md`

- [ ] Generate one pixel-art portrait with built-in image generation, using the existing Preppy Cola crop/lockup and player art only as visual references.
- [ ] Remove the flat chroma background locally to real alpha; validate dimensions, alpha coverage, edge isolation, and visual suitability.
- [ ] Copy the final PNG into the project and record the exact prompt, generator, processing command, dimensions, SHA-256, and public-use decision.

## Task 3: Implement the two records and client card

**Files:**

- Modify: `godot/src/agency/agency_mission_catalog.gd`
- Modify: `godot/src/agency/missions/demonstrations/ColourStage.tscn`
- Modify: `godot/src/agency/missions/demonstrations/colour_stage.gd`

- [ ] Change the three `COLOUR_DEMONSTRATION` openings to strength `0.0`; add portrait, role, and contrast dialogue fields.
- [ ] Add `COLOUR_CLINIC_DEMONSTRATION` with `baseRecord`, three rotated bright/broken job starts, and clinic-specific copy; wire only `colour-clinic` to it.
- [ ] Add the client portrait/identity/dialogue nodes in the scene.
- [ ] Deep-merge `baseRecord` in `configure`; load the portrait; bind opening, next-product, and completion dialogue with product/feeling substitutions.
- [ ] Run correct-root GodotIQ validation on each changed `.gd` / `.tscn`, then run `npx pnpm test:godot` to GREEN.

## Task 4: Copy/provenance coverage and focused visual evidence

**Files:**

- Verify: `scripts/student-copy-corpus.mjs`
- Modify only if needed: `scripts/student-copy-corpus.mjs`

- [ ] Confirm both Engine C files remain registered in `STUDENT_COPY_SOURCE_PATHS`; do not duplicate entries.
- [ ] Build the verified web export and capture the Engine C stage through the supported web/runtime route if the existing harness exposes it. Native Godot execution remains quarantined.
- [ ] Verify Kate is legible, portrait aspect is preserved, dialogue is not clipped, wheel/poster remain usable, and measured dialog height is at most 760 px.

## Task 5: Review, full gates, and commit

**Files:**

- Verify all task-owned files and preserve unrelated dirty files.

- [ ] Obtain one fresh isolated code review of the stable diff; resolve actionable findings once.
- [ ] Run all five gates in the handover's order: `test:godot`, TypeScript typecheck, `test:build-web`, unit tests, and `build:web`.
- [ ] Audit the staged manifest by exact path. Never stage `godot/project.godot`, the six salience `.png.import` files, `.claude/`, or the untracked handover.
- [ ] Commit the approved follow-up with an explicit Engine C/Kate message.
- [ ] Recheck `git status`, commit contents, and requirement-by-requirement completion evidence.

