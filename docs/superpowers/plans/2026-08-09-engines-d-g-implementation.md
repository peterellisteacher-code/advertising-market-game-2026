# Engines D-G implementation plan

> Execute this plan in the authoritative
> `C:\Godot Projects\Advertising Market Game Worktrees\agency-clarity-tuckability`
> worktree on `agent/mission-clarity-20260807`.

**Goal:** replace the six remaining transfer-writing gates with four measured,
record-driven demonstrations, then complete the terminology/removal integration and
release gates.

**Tool boundary:** use GodotIQ 0.5.16 Pro through the correct-root one-shot launcher for
Godot context, writes and Pro validation. Native Godot launches remain quarantined.

## Task 1 - Engine D pure measure (RED -> GREEN)

Files:

- Create `godot/src/agency/missions/demonstrations/target_measure.gd`.
- Create `godot/tests/test_target_measure.gd`.
- Modify `godot/tests/run_tests.gd` only to register the new test after its standalone
  RED has been observed.

Write tests first for valid support, order independence, multiple allowed targets,
unplaced evidence, wrong target, unsupportable target, duplicate/unknown evidence and
malformed records. Run the focused test and confirm the expected missing-script RED.
Implement the smallest measure, validate and check errors with GodotIQ Pro, then obtain
focused GREEN.

## Task 2 - Engine D stage and records

Files:

- Create `TargetStage.tscn` and `target_stage.gd` in the demonstrations directory.
- Modify `agency_mission_catalog.gd` for `audience-brief` and `claim-proof` records.
- Extend `test_target_measure.gd` with stage, panel, focus, completion and catalog tests.
- Modify `scripts/student-copy-corpus.mjs` to include both new files.

Observe RED for the absent scene/records before implementation. Build drag plus click
assignment, live status, reset/check and two-step finish. Run focused GREEN, GodotIQ file
validation/error checks, then `test:godot`. Commit only Engine D paths.

## Task 3 - Engine E measure, stage and records

Files:

- Create `sequence_measure.gd`, `sequence_stage.gd`, `SequenceStage.tscn`, and
  `test_sequence_measure.gd`.
- Modify catalog, test runner and student-copy corpus.

Test the partial-order measure first, including duplicate/missing cards and at least one
record with two valid orders. Observe RED, implement GREEN, then add stage tests for drag
or button reorder, keyboard movement, changing reading line, AIDA, reading-path, focus,
two-step completion, evidence and dialog fit. Wire the two distinct records to the same
scene. Validate, run the focused suite and `test:godot`, then commit only Engine E paths.

## Task 4 - Engine F measure, stage and record

Files:

- Create `word_chip_measure.gd`, `word_chip_stage.gd`, `WordChipStage.tscn`, and
  `test_word_chip_measure.gd`.
- Modify catalog, test runner and student-copy corpus.

Test missing benefit under the cap, complete benefit over the cap, duplicate/unknown
tokens, exact boundary and two distinct passing edits. Observe RED, implement GREEN, then
test remove/restore ordering, preview, live count, focus, completion, evidence and fit.
Wire `headline-surgery`, validate, run focused tests and `test:godot`, then commit only
Engine F paths.

## Task 5 - Engine G measure, stage and record

Files:

- Create `format_measure.gd`, `format_stage.gd`, `FormatStage.tscn`, and
  `test_format_measure.gd`.
- Modify catalog, test runner and student-copy corpus.

Test word cap, coverage threshold, containment, tolerance, malformed frame data and more
than one passing format. Observe RED, implement GREEN, then test format/headline choice,
drag/nudge/scale, live readings, focus, completion, evidence and fit. Wire `media-match`,
validate, run focused tests and `test:godot`, then commit only Engine G paths.

## Task 6 - student copy and final mission integration

Files:

- Modify all twelve catalog records, mission panel/controller/scene as required, catalog
  and mission tests, and the copy corpus.

Assemble the complete changed student-copy corpus once. Run the frozen plain-language
preset exactly once, then the repository's Claude-scrubber MICROCOPY route exactly once.
Apply accepted changes without altering advertising terminology. Add a `term` field to
every record, surface it in the panel, and rewrite goals around the named term. Preserve
`Salience and AIDA Attention` for salience. Run the professional-copy contract.

Prove every mission has a non-empty demonstration. Only then remove `transferPrompt`,
`TransferStage`, evidence-entry UI, transfer-only validation and controller state. Do not
change the unresolved writer/pitch ownership wording. Re-derive the applicable A/B
findings from the current code and fix only still-reproducible issues. Commit explicit
paths; never stage protected local files.

## Task 7 - release candidate verification

Run, in order:

1. `npx pnpm test:godot`
2. `npx tsc --noEmit`
3. `npx pnpm run test:build-web`
4. `npx pnpm test`
5. `npx pnpm run build:web`

Then run GodotIQ project validation/error/orphan checks against the exact worktree and
perform 1280x800 exact-artifact visual/play QA across all twelve demonstrations. Run one
fresh isolated code review at the release candidate, resolve findings, re-run affected
checks, inspect the exact staged diff, and commit the release candidate.

## Task 8 - hosted release tiers

Push the branch; require Linux CI and its exact artifact. Deploy that artifact to a
Netlify draft using the linked inner project. Run hosted Safari-relevant and school-wifi
QA, including the password gate and edge headers where applicable. Open the PR, merge
only after required checks, obtain the main-branch exact artifact, deploy production,
and verify production on the student-MacBook acceptance surface. Keep local, CI,
artifact, hosted-draft, merge and production evidence separate in the release report.

Supabase is not expected to change for D-G. If a verified release requirement reveals a
Supabase mutation, reserve only the named advertising object, mutate/verify/release the
shared project window, and never touch `signal_lost` objects.
