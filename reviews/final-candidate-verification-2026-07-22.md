# Advertising Market Game — final candidate verification addendum

Date: 2026-07-22

## Status

Source implementation is complete. Final export verification is pending a non-Windows Godot build because the quarantined Windows Godot executable crashed before loading the staged project. Production and Supabase remain unchanged.

## Prepared remote-QA candidate

The exact source/test/build input set awaiting remote export contains 108 changed or new files under `godot/`, `netlify/`, `shared/`, `web/`, `scripts/`, plus `vitest.config.ts`. It totals 1,615,266 bytes. A sorted manifest of `relative path + per-file SHA-256 + byte count` has aggregate SHA-256:

`f43b71ed7f3d312fa42175571643a4396795ce70ebb1170bf8683894f655aac3`

Repository state at this checkpoint:

- branch: `agent/final-image-lab-release`;
- base commit: `e4f02cf8f632697dc43eff5c9de40cd450069704`;
- 71 modified tracked files, 165 untracked files, and no staged files;
- the untracked material is 10,471,164 bytes, chiefly tests, panel records and browser evidence;
- a tracked-plus-untracked credential scan found no stored OpenRouter key. Its only key-prefix match was the validation regular expression in `scripts/set-openrouter-user-key.ps1`.

`.github/workflows/build-and-publish.yml` was reread at this checkpoint. `workflow_dispatch` runs validation, Linux Godot tests/export, complete web assembly and artifact upload. It has `contents: read` permission and contains no deployment step. A temporary branch push and workflow dispatch still require Peter's explicit authorization; neither has occurred.

## Integrated build before the final copy correction

Candidate: `C:\tmp\admarket-integrated-20260722-a\build\web`

- TypeScript type-check: passed.
- Vitest: 133 files, 1,949 tests passed.
- Web-build contracts: 67 tests passed.
- Godot tests and web export: passed before the final copy-only correction.
- Complete web assembly and static verification: passed.

## Browser evidence

The compiled candidate above was served unchanged from its assembled `build/web` directory. Account and Image Lab configuration routes were deterministically intercepted because a static local server does not run Netlify Functions. No hosted-gate, edge-routing or production claim is inferred from this local surface.

Inspected viewports:

- 1280 × 800: lobby, immediate practice start, all three level transitions, product builder, close-up product controls, Words, AIDA, Price, Market Route, Studio Coach, disabled Image Lab, final check, medal gallery, medal submission and completion.
- 1440 × 900: clean lobby and completed medal market.

Current screenshots are stored at `C:\tmp\admarket-final-*.png`. Fresh isolated lobby and disabled-Image-Lab sessions produced zero console or page errors after the missing server routes were intercepted.

Observed end-to-end flow:

1. Enter a pair alias and start local practice.
2. Build and place a product, enlarge it to a close-up, name it, swap roles, and add canvas words.
3. Lock Level 1 and link one selected canvas piece to each AIDA move in Level 2.
4. Add a price, select provable strengths, choose a priced part, market zone and media route, then submit the route.
5. Build the market card, score other ads against the five stated checks, award one Gold, one Silver and one Bronze to distinct ads, and submit the medals.
6. The completion state confirms that the market podium is ready.

## Browser-evidenced correction

The compiled candidate exposed one orphaned purchase-era footer: `Market card live. Browse the stalls and spend your budget.` The source now uses medal-gallery instructions in every corresponding `Main.gd` state and has a deterministic regression test in `scripts/onboarding-source.test.mjs`. That focused test passes (3 of 3), and `git diff --check` passes.

The corrected source has not been represented as a fresh web export on Windows. The next valid verification step is the repository's no-deploy GitHub workflow or another non-Windows Godot exporter.

## Multimodal-panel integration after the browser replay

The four completed visual seats were reconciled against the later medal-market candidate in `reviews/student-copy-onboarding-2026-07-21/openrouter-panel-rerun/synthesis.md`. Supported current findings were implemented:

- local practice is primary and remains usable during startup recovery checks;
- the alias label covers practice and live rooms;
- partner jobs now change with the current level;
- pair-complete guidance points to the highlighted tool instead of leaving a stale role instruction;
- Price is hidden until Level 3 while product cost remains visible in Build;
- a new price label starts in a reserved bottom-right position rather than on the slogan;
- route grammar and duplicate receipt labels are corrected;
- the product-placement summary and action appear before the choice lists and remain sticky while the drawer scrolls;
- outer, studio and medal-gallery identity is consistent;
- the paused-cloud state uses one phrase.

Post-edit verification:

- TypeScript `tsc --noEmit`: passed.
- Focused browser-surface regression set: 9 files, 92 tests passed.
- Full Vitest suite, split deterministically into three shards after the one-process command exceeded its five-minute wrapper ceiling: 133 files, 1,951 tests passed.
- Deterministic build/export/workflow and onboarding contracts: 73 tests passed.
- `git diff --check`: passed.

No native Godot executable was used for these checks. A fresh exported PCK and final browser replay remain pending the non-deploying GitHub QA workflow or another non-Windows Godot exporter.
