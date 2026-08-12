# Gamewide Agency Academy Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved whole-game structural redesign and polished Agency Academy reskin while preserving the seven proven mission engines, student work, pair roles, sandbox, persistence, teacher controls and market contracts.

**Architecture:** Add one shared Agency Academy token/theme contract, a reusable Godot header, and a web token layer. Route campaign setup and seven required missions through direct progression, while leaving the pixel-art agency as an optional hub. Reframe existing mission, creator, sandbox, pitch and market implementations rather than rewriting their domain logic.

**Tech Stack:** Godot 4.6/GDScript, GodotIQ Pro 0.5.16, Godot scenes/themes, TypeScript 7, DOM/CSS, Fabric 7, Vitest 4, Vite 8, Netlify and GitHub Actions.

## Global Constraints

- Authoritative checkout: `C:\Godot Projects\Advertising Market Game Worktrees\agency-clarity-tuckability`.
- Exact Godot root: `C:\Godot Projects\Advertising Market Game Worktrees\agency-clarity-tuckability\godot`.
- Before each Godot edit, use GodotIQ `file_context`; use `impact_check`, `dependency_graph` and `signal_map` for signature/signal work; after each changed script run GodotIQ `validate` and `check_errors`.
- Native Godot launches remain quarantined. Use only the repository's authorized Godot test/export route and applicable GodotIQ capabilities.
- Never stage or overwrite pre-existing user-owned dirt: `godot/project.godot`, six `godot/assets/agency/salience/*.png.import`, `godot/src/agency/ui/agency_theme.tres`, `godot/tests/agency_completion_runner.gd`, `.claude/`, `.playwright-cli/`, `.playwright-mcp/`, untracked QA images, `release-evidence/`, or the untracked 9 August handover.
- Give the redesign a new `agency_academy_theme.tres`; do not modify protected `agency_theme.tres`.
- The public product/browser title stays `Advertising Market Game`; `Agency Academy` is an in-world crest motif.
- Seven required terms remain exact: Audience brief; Salience and AIDA Attention; Reading path; Colour contrast and harmony; Framing and cropping; AIDA sequence; Claims and evidence.
- Product creation remains productive setup between task 1 and task 2 when no campaign product exists. Required tasks then continue directly without mandatory walking or narrative filler.
- No points, score, timer, streak, leaderboard, fake mission count or mandatory hub travel.
- Preserve Art Director and Strategist ownership language and equal permissions.
- Preserve Product AIDA and Advertisement AIDA as distinct persistent plans.
- Preserve upload, move, resize, crop/fill, layer, lock, hide, delete, Undo and Redo for student images and generated layers.
- Codex-generated project visuals use the native Codex image generator only. The separately approved student-triggered in-game Fal.ai realisation feature remains unchanged.
- Desktop/laptop only. Verify 1280x800 and 1440x900, with representative 1920x1080 inspection. Do not add phone breakpoints or phone controls.
- Run focused tests while iterating, then the full gate sequence once on stable integrated inputs.
- Stage every commit with an explicit named-file allowlist and audit `git diff --cached --name-only`, `--check` and `--stat` before commit.

## File structure and responsibilities

### New shared Godot presentation files

- `godot/src/ui/agency_academy_tokens.gd` — immutable colour, spacing and text-size tokens plus truthful progress helpers.
- `godot/src/ui/AgencyAcademyHeader.tscn` — reusable header scene with brand motif, surface title, subtitle/term, seven mastery dots and action slots.
- `godot/src/ui/agency_academy_header.gd` — header state API and focus-safe action signals.
- `godot/src/ui/agency_academy_theme.tres` — new theme; never mutates the protected legacy theme.
- `godot/tests/test_agency_academy_header.gd` — token, progress and header behaviour coverage.

### Existing Godot surfaces

- `godot/src/main/Main.tscn`, `godot/src/main/main.gd` — lobby, recovery, direct campaign setup routing and top-level surface ownership.
- `godot/src/agency/missions/AgencyMissionPanel.tscn`, `agency_mission_panel.gd`, `agency_mission_controller.gd` — shared required/optional mission frame and direct next-step result.
- `godot/src/agency/AgencyWorld.tscn`, `agency_world.gd`, `ui/AgencyHud.tscn`, `ui/agency_hud.gd`, `ui/AgencyGuideDrawer.tscn`, `ui/agency_guide_drawer.gd` — optional hub, compact header/action strip and bounded help.
- `godot/src/presentation/PitchTheatre.tscn`, `pitch_theatre.gd` — final ad-first pitch, AIDA evidence and readiness action.
- `godot/src/market/ui/MarketScreen.tscn`, `market_screen.gd` — reskinned market and completion surfaces.

### Existing web surfaces

- `web/src/styles/agency-academy-tokens.css` — CSS custom-property equivalent of the Godot token contract.
- `web/src/styles/editor.css`, `web/src/ui/editor-shell.ts` — studio header, canvas-first layout, left rail and compact command dock.
- `web/src/ui/studio-tool-drawer.ts`, `web/src/ui/overlay-exclusivity.ts` — bounded upward panels and single overlay owner.
- `web/src/game/assignment-planner-panel.ts` — reskinned bounded sandbox planner without schema changes.
- `web/src/teacher/teacher-playtest-controller.ts`, `web/src/teacher/teacher.css` — shell-owned compact teacher disclosure.
- `web/src/main.ts` — imports/wiring only; do not move domain logic into this already large file.

---

### Task 1: Shared Agency Academy tokens and Godot header

**Files:**
- Create: `godot/src/ui/agency_academy_tokens.gd`
- Create: `godot/src/ui/agency_academy_header.gd`
- Create: `godot/src/ui/AgencyAcademyHeader.tscn`
- Create: `godot/src/ui/agency_academy_theme.tres`
- Create: `godot/tests/test_agency_academy_header.gd`
- Modify: `godot/tests/run_tests.gd`

**Interfaces:**
- Produces: `AgencyAcademyTokens.progress_states(completed: int, total: int, current_index: int) -> Array[String]` with values `complete`, `current`, `remaining`.
- Produces: `AdMarketAgencyAcademyHeader.configure(surface_title: String, subtitle: String, completed: int, total: int, current_index: int) -> void`.
- Produces signals: `brief_requested`, `teacher_requested`, `close_requested`.
- Consumes: no project state; callers pass truthful current state.

- [ ] **Step 1: Establish Godot edit context and baseline**

Use GodotIQ `file_context` on `res://tests/run_tests.gd`, then `validate(target="project", detail="brief")`. Record the baseline counts; do not treat legacy findings as task regressions.

- [ ] **Step 2: Write the failing header test**

Add tests that require seven progress states for `(2, 7, 2)`, exact labels `Task 3 of 7` and `Salience and AIDA Attention`, one current dot, two complete dots, four remaining dots, and signal emission from brief/teacher/close actions. Register the suite in `run_tests.gd`.

- [ ] **Step 3: Run the focused suite RED**

Run:

```powershell
$env:ADMARKET_GODOT_TEST_SUITE='res://tests/test_agency_academy_header.gd'; corepack pnpm test:godot
```

Expected: FAIL because the new tokens/header scene do not exist.

- [ ] **Step 4: Implement the minimal shared contract**

Create typed token constants for navy frame, aubergine frame, cream surface, ink, gold, success, coaching and focus colours; spacing `8, 12, 16, 24, 32`; body/label/title sizes; and progress-state generation. Build the header from live Controls/Labels/Buttons with a minimum height of 96 at 1280x800, seven dots, no score region and visible focus styles in the new theme.

- [ ] **Step 5: Validate and run GREEN**

Use GodotIQ `validate` and `check_errors` on both scripts and the scene, then rerun the focused suite. Expected: PASS.

- [ ] **Step 6: Commit the isolated shared shell**

Stage only the six Task 1 files, audit the cached diff, and commit:

```powershell
git commit -m "feat(ui): add Agency Academy shell tokens"
```

---

### Task 2: Direct campaign sequence and setup handoff

**Files:**
- Modify: `godot/src/agency/missions/agency_mission_panel.gd`
- Modify: `godot/src/agency/agency_world.gd`
- Modify: `godot/src/main/main.gd`
- Modify: `godot/src/agency/agency_campaign_controller.gd`
- Modify: `godot/tests/test_agency_missions.gd`
- Modify: `godot/tests/test_agency_campaign_controller.gd`
- Modify: `godot/tests/test_game_shell.gd`

**Interfaces:**
- Produces: `AdMarketAgencyCampaignController.next_campaign_step() -> Dictionary` based on task completion and product presence. Its `kind` is one of `build-product`, `required-mission`, `polish-campaign`, `prepare-pitch` or `complete`; mission steps also carry `missionId`.
- Produces: `AgencyWorld.open_campaign_mission(mission_id: String) -> bool`, a bounded public wrapper over the existing mission-opening path.
- Consumes without changing signatures: existing `complete_mission`, `creator_requested`, `mission_completed`, creator-return and product-document state.

- [ ] **Step 1: Run impact checks before signal/API work**

Use GodotIQ `file_context`, `dependency_graph` and `impact_check` for `agency_mission_controller.gd`, `agency_campaign_controller.gd`, `main.gd` and their affected signals. Run file-scoped `signal_map` before changes.

- [ ] **Step 2: Write RED routing tests**

Require these exact transitions:

```text
new campaign -> audience-brief
audience-brief complete + no product -> build-product
creator returns with product -> salience
required task 2..6 complete -> next required mission
task 7 complete -> polish-campaign
creator returns from campaign polish -> prepare-pitch
Back to agency -> optional hub without changing progress
```

Also assert no step has kind `walk`, `dialogue` or `score`.

- [ ] **Step 3: Run focused suites RED**

Run the campaign-controller, missions and game-shell suites separately through `ADMARKET_GODOT_TEST_SUITE`. Expected: FAIL on missing `next_campaign_step`/direct handoff behaviour.

- [ ] **Step 4: Implement direct routing**

Add `next_campaign_step()` without changing persisted mission IDs. The existing completion event remains the single source of truth: `main.gd` asks the campaign controller for the next step, closes the completed surface, and either opens the creator or calls `AgencyWorld.open_campaign_mission()`. When Audience brief completes without a product, open `build-product`; after creator return, open `salience`. For tasks 2–6, open the next required mission directly. After task 7, open the existing `polish-campaign` creator step; its return continues through the existing `prepare-pitch` and publication/final-pitch path. Keep `Back to agency` secondary and optional. Do not add a parallel mission-controller signal.

- [ ] **Step 5: Validate signals and run GREEN**

Run GodotIQ validate/error checks per script, then `signal_map(find="missing")` and the three focused suites. Expected: PASS with no new missing signal.

- [ ] **Step 6: Commit direct sequence**

Stage only the seven Task 2 files and commit:

```powershell
git commit -m "feat(agency): run required tasks as one campaign"
```

---

### Task 3: Mission shell and all seven task families

**Files:**
- Modify: `godot/src/agency/missions/AgencyMissionPanel.tscn`
- Modify: `godot/src/agency/missions/agency_mission_panel.gd`
- Modify: `godot/src/agency/missions/demonstrations/TargetStage.tscn`
- Modify: `godot/src/agency/missions/demonstrations/SalienceStage.tscn`
- Modify: `godot/src/agency/missions/demonstrations/SequenceStage.tscn`
- Modify: `godot/src/agency/missions/demonstrations/ColourStage.tscn`
- Modify: `godot/src/agency/missions/demonstrations/CropStage.tscn`
- Modify: `godot/src/agency/missions/demonstrations/WordChipStage.tscn`
- Modify: `godot/src/agency/missions/demonstrations/FormatStage.tscn`
- Modify: corresponding seven `*_stage.gd` files only where sizing/focus APIs require it
- Modify: `godot/tests/test_agency_missions.gd`
- Modify only the existing measure/stage test suites whose presentation contract changes: `test_target_measure.gd`, `test_salience_measure.gd`, `test_sequence_measure.gd`, `test_colour_measure.gd`, `test_crop_measure.gd`, `test_word_chip_measure.gd` and `test_format_measure.gd`
- Create: `godot/tests/test_agency_mission_layout.gd`
- Modify: `godot/tests/run_tests.gd`

**Interfaces:**
- Consumes: `AdMarketAgencyAcademyHeader.configure(...)` and existing mission record fields.
- Preserves: `show_choice`, `show_effect`, `show_demonstration`, `show_completed` signatures and all existing stage result dictionaries.
- Produces: `layout_contract(viewport: Vector2) -> Dictionary` with bounded dialog/work/feedback/action rects for test inspection.

- [ ] **Step 1: Inspect every scene/script before edits**

Use GodotIQ `file_context` on the panel, seven demonstration scenes and any stage script requiring change. Obtain baseline validate/error evidence for all seven stage families.

- [ ] **Step 2: Write mission-layout RED tests**

At 1280x800 and 1440x900 require the header, active work surface, feedback strip and primary action to remain within the viewport; require exact term/title from the record; require no score label; require role details collapsed by default; require pointer and keyboard action paths; require success/error status text in addition to colour.

- [ ] **Step 3: Run RED**

Run `test_agency_mission_layout.gd` and `test_agency_missions.gd`. Expected: FAIL because the legacy panel has no shared header/layout contract.

- [ ] **Step 4: Rebuild the panel hierarchy**

Embed the shared header, use a warm work card, concise heading/goal, optional point-of-use tip, active stage container, feedback strip and bottom action row. Keep one modal input owner. Collapse extended role/reference text behind live buttons. Preserve existing record and engine APIs.

- [ ] **Step 5: Fit each stage to the new work area**

Adjust only presentation sizing/containers needed to keep Target, Salience, Sequence, Colour, Crop, WordChip and Format stages visible. Preserve measure algorithms and result fields. Ensure crop instructions explicitly cover slogan move and cyan-corner resize. Retain click/select plus keyboard alternatives for every drag interaction.

- [ ] **Step 6: Validate each changed scene/script and run GREEN**

After each script change run GodotIQ validate/check errors. Run the layout, mission and all seven measure/stage suites. Expected: PASS.

- [ ] **Step 7: Commit mission shell**

Stage only changed mission/stage/tests files and commit:

```powershell
git commit -m "feat(agency): reskin all mission work surfaces"
```

---

### Task 4: Optional hub, compact action strip and bounded guide

**Files:**
- Modify: `godot/src/agency/AgencyWorld.tscn`
- Modify: `godot/src/agency/agency_world.gd`
- Modify: `godot/src/agency/ui/AgencyHud.tscn`
- Modify: `godot/src/agency/ui/agency_hud.gd`
- Modify: `godot/src/agency/ui/AgencyGuideDrawer.tscn`
- Modify: `godot/src/agency/ui/agency_guide_drawer.gd`
- Modify: `godot/tests/test_agency_world.gd`
- Modify: `godot/tests/test_agency_hud_layout.gd`
- Modify: `godot/tests/test_agency_guidance.gd`

**Interfaces:**
- Consumes: current objective, mission progress, station records and shared header.
- Preserves: `station_requested`, `objective_task_requested`, guide and audio signals.
- Produces: compact bottom-strip state with current destination, optional-practice route and `Back to campaign`.

- [ ] **Step 1: Inspect impact and signal graph**

Use GodotIQ file contexts plus dependency/signal maps on world, HUD and guide scripts before changing node paths or visibility behaviour.

- [ ] **Step 2: Write RED hub tests**

Require the pixel-art floor to remain the dominant surface; the action strip to occupy no more than 14% of an 800px-high viewport; expanded help to remain inside 1280x800 and scroll internally; hidden/tucked layers to use non-intercepting mouse filters; direct campaign return to be available; optional practice to be explicitly labelled.

- [ ] **Step 3: Run RED**

Run the world, HUD-layout and guidance suites. Expected: FAIL on legacy large cards/header structure.

- [ ] **Step 4: Implement optional-hub presentation**

Replace the large station card with a bottom action strip. Embed the shared header with current objective and seven mastery dots. Keep room markers restrained and current destination clear. Make direct campaign navigation primary and walking optional. Keep station collision shapes unchanged unless runtime evidence proves a mismatch.

- [ ] **Step 5: Bound guide/teacher/help ownership**

Make the guide an internally scrolling shell panel. Tucked/closed guide and orientation layers cannot intercept input. Opening guide, handoff or mission closes competing overlays and restores focus when closed.

- [ ] **Step 6: Validate and run GREEN**

Run GodotIQ validation/errors and `signal_map(find="missing")`, then the three focused suites. Expected: PASS.

- [ ] **Step 7: Commit optional hub**

```powershell
git commit -m "feat(agency): make the pixel office an optional hub"
```

---

### Task 5: Web studio token layer and canvas-first shell

**Files:**
- Create: `web/src/styles/agency-academy-tokens.css`
- Create: `web/src/styles/agency-academy-tokens.test.ts`
- Modify: `web/src/styles/editor.css`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/styles/editor-css.test.ts`
- Modify: `web/src/main.ts`

**Interfaces:**
- Produces CSS properties `--aa-frame`, `--aa-surface`, `--aa-ink`, `--aa-gold`, `--aa-success`, `--aa-coaching`, `--aa-focus`, `--aa-space-*` and `--aa-header-height`.
- Preserves `createEditorShell(root: HTMLElement): EditorShell` and all existing shell element handles.
- Consumes existing guided-stage data and workspace mode; no persistence contract changes.

- [ ] **Step 1: Write RED token/shell tests**

Require one imported token file, no hard-coded points/score UI, a header below 12% of 800px, canvas at least 70% of the central workspace, left rail icon-plus-word labels, compact dock below 10% of 800px, and all shell text at or above the existing 14px floor.

- [ ] **Step 2: Run RED**

Run:

```powershell
corepack pnpm vitest run web/src/styles/agency-academy-tokens.test.ts web/src/ui/editor-shell.test.ts web/src/styles/editor-css.test.ts --no-cache --configLoader runner --maxWorkers=1
```

Expected: FAIL because the shared token layer and new header contract are absent.

- [ ] **Step 3: Implement token import and header reskin**

Import tokens from the existing entry path in `main.ts`. Reframe the existing shell: compact navy header, truthful task/term data, brief/roles action, teacher action slot, warm canvas field, navy tool rail and visible primary check/continue action. Keep all text live DOM.

- [ ] **Step 4: Preserve canvas and functional controls**

Do not alter Fabric canvas coordinate contracts. Keep Upload, Items, Delete selected, Undo/Redo and zoom handles. Make empty state purposeful but non-blocking. Ensure labels remain exact and buttons are not visually disabled unless actually disabled.

- [ ] **Step 5: Run typecheck and GREEN**

Run the focused Vitest command and `corepack pnpm typecheck`. Expected: PASS.

- [ ] **Step 6: Commit studio shell**

```powershell
git commit -m "feat(studio): apply the Agency Academy game shell"
```

---

### Task 6: Items dock, sandbox planner and teacher overlay ownership

**Files:**
- Modify: `web/src/ui/studio-tool-drawer.ts`
- Modify: `web/src/ui/studio-tool-drawer.test.ts`
- Modify: `web/src/ui/overlay-exclusivity.ts`
- Modify: `web/src/ui/overlay-exclusivity.test.ts`
- Modify: `web/src/game/assignment-planner-panel.ts`
- Modify: `web/src/game/assignment-planner-panel.test.ts`
- Modify: `web/src/teacher/teacher-playtest-controller.ts`
- Modify: `web/src/teacher/teacher-playtest-controller.test.ts`
- Modify: `web/src/teacher/teacher.css`
- Modify: `web/src/styles/editor.css`
- Modify: `web/src/main.ts`

**Interfaces:**
- Preserves the public `OverlayExclusivityMember` interface; each member owns focus restoration inside its existing close path.
- Preserves assignment-plan schema and `AssignmentPlannerPanel` commit callback.
- Preserves teacher reset/session APIs; changes presentation ownership only.

- [ ] **Step 1: Write RED behaviour tests**

Require Items to open upward within the viewport, be height-bounded and internally scrollable; require only one overlay open; require hidden overlays to set inert/hidden/non-intercepting state; require Escape to close and restore opener focus; require teacher controls to live in the shell without a floating strip; require planner sections to be collapsible and canvas/dock unobscured.

- [ ] **Step 2: Run RED**

Run the five focused TS suites for drawer, exclusivity, planner, teacher controller and editor CSS. Expected: FAIL on the new ownership/bounds contract.

- [ ] **Step 3: Implement one overlay owner**

Make Items, planner, display preferences, teacher controls and other registered overlays mutually exclusive. Closing must remove pointer interception before restoring focus. Teacher controls remain fixed within the shell header and open inward.

- [ ] **Step 4: Reskin planner without schema change**

Use compact labelled sections for product definition, Product AIDA, Desire values and Advertisement AIDA. Preserve every field and commit callback. Ensure uploads and all object commands remain reachable.

- [ ] **Step 5: Verify delete/undo/upload regressions**

Run object-command, history, student-image-upload, assignment-plan and assignment-planner suites in addition to the focused UI suites. Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

Run `corepack pnpm typecheck`, stage only Task 6 files and commit:

```powershell
git commit -m "fix(studio): keep creator overlays bounded and exclusive"
```

---

### Task 7: Lobby, startup and recovery reskin

**Files:**
- Modify: `godot/src/main/Main.tscn`
- Modify: `godot/src/main/main.gd`
- Modify: `godot/tests/test_game_shell.gd`
- Modify: `web/src/account/account.css`
- Modify: `web/src/account/account-gate.ts`
- Modify: `web/src/account/account-gate.test.ts`
- Modify: `web/src/main.test.ts`
- Modify: `scripts/onboarding-source.test.mjs`

**Interfaces:**
- Preserves account, practice-resume and sandbox-loading contracts.
- Produces three clear lobby routes: continue/start campaign, assignment sandbox and compact teacher access.
- Preserves exact local/cloud recovery decisions; changes copy hierarchy and styling only.

- [ ] **Step 1: Write RED lobby/recovery tests**

Require branded live UI for loading/failure/retry, no unstyled document fallback, one campaign primary action, one sandbox secondary action, no hidden startup overlay after readiness, and no input-intercepting recovery layer when dismissed.

- [ ] **Step 2: Run RED**

Run focused Godot game-shell, account-gate, main and onboarding-source tests. Expected: FAIL on the new lobby structure and branded fallback contract.

- [ ] **Step 3: Implement lobby and failure surfaces**

Use the new theme/header motif in Main. Preserve alias/live-market functions but place advanced live-market/teacher setup in disclosures. Reskin account and startup recovery with the shared tokens and functional retry. Do not weaken storage safety or cloud reconciliation.

- [ ] **Step 4: Validate and run GREEN**

Run GodotIQ validation/errors for Main files, focused Godot and TS/Node suites, and typecheck. Expected: PASS.

- [ ] **Step 5: Commit lobby/recovery**

```powershell
git commit -m "feat(app): reskin lobby and recovery surfaces"
```

---

### Task 8: Final pitch and market culmination

**Files:**
- Modify: `godot/src/presentation/PitchTheatre.tscn`
- Modify: `godot/src/presentation/pitch_theatre.gd`
- Modify: `godot/tests/test_pitch_theatre.gd`
- Modify: `godot/src/market/ui/MarketScreen.tscn`
- Modify: `godot/src/market/ui/market_screen.gd`
- Modify: `godot/tests/test_market_screen.gd`
- Modify: `godot/tests/test_game_shell.gd`

**Interfaces:**
- Preserves `present(publication, progress, reduced_motion) -> bool`, `pitch_finished`, market `enter_room`, `present_snapshot` and `fix_requested`.
- Consumes existing publication metadata, mission evidence, `strategy.aidaPlan`, pitch settings and market snapshots.
- Produces a live AIDA evidence layout and `7 of 7 complete` mastery state; no score.

- [ ] **Step 1: Inspect impact and write RED tests**

Use GodotIQ contexts/impact checks. Require final advertisement preview to be the dominant pitch region; Attention/Interest/Desire/Action evidence to come from saved state; task mastery to read `7 of 7 complete`; controls to fit 1280x800; market cards to use shared hierarchy and retain all existing moderation/podium actions.

- [ ] **Step 2: Run pitch/market RED**

Run `test_pitch_theatre.gd`, `test_market_screen.gd` and relevant game-shell cases. Expected: FAIL on new nodes/layout/state text.

- [ ] **Step 3: Rebuild pitch presentation**

Embed the shared header, keep exact rendered campaign art, display concise AIDA evidence cards and readiness checklist, preserve format/animation options as secondary presentation settings, and label the primary action `Present campaign`/`Finish client pitch` according to state.

- [ ] **Step 4: Reskin market**

Apply the new theme to market header, cards, feedback and completion states. Preserve wallet/award/moderation semantics and network recovery. Avoid turning money or awards into a campaign score.

- [ ] **Step 5: Validate and run GREEN**

Use GodotIQ validation/errors and signal checks, then focused pitch/market/game-shell suites. Expected: PASS.

- [ ] **Step 6: Commit culmination surfaces**

```powershell
git commit -m "feat(game): polish final pitch and market"
```

---

### Task 9: Integrated copy, accessibility and compatibility audit

**Files:**
- Modify only files with confirmed audit failures from Tasks 1–8
- Modify: existing student-copy source/corpus tests when required by intentional copy changes
- Create: `docs/superpowers/verification/2026-08-12-agency-academy-coverage.md`

**Interfaces:**
- Consumes final changed student-facing corpus and live UI state.
- Produces a requirement-to-evidence matrix covering all surfaces and seven mission families.

- [ ] **Step 1: Run content-pedagogy once on the complete corpus**

Audit exact term preservation, analysis-to-audience-effect reasoning, partner holding actions and technique-spotting avoidance. Apply only confirmed copy fixes.

- [ ] **Step 2: Run frozen plain-language once**

Submit the complete changed student-facing corpus in one pass. Preserve exact advertising terms and writer/pitch ownership language while applying clear approved simplifications.

- [ ] **Step 3: Run the repository microcopy scrubber once if available**

Use the repository's documented MICROCOPY route only. Do not substitute another external model if it is unavailable; record the route result.

- [ ] **Step 4: Run static accessibility/contrast contracts**

Test composite contrast for translucent states, focus visibility/order, dialog focus restoration, non-colour status, reduced motion, minimum text floor, viewport bounds and absence of phone-specific rules.

- [ ] **Step 5: Run full compatibility tests**

Run all assignment sandbox, document migration, upload, history, creator bridge, live resume, market, pitch and agency tests. Fix only evidence-backed regressions.

- [ ] **Step 6: Write coverage matrix and commit**

For lobby, setup, missions 1–7, hub, studio, sandbox, teacher, pitch, market, recovery and accessibility, name the automated and runtime proof. Commit all final audit fixes and coverage document:

```powershell
git commit -m "test(game): cover Agency Academy redesign"
```

---

### Task 10: Final gates, exact-artifact QA and release

**Files:**
- No planned source changes; any correction restarts focused verification for its affected surface.
- Update release evidence only in an authorized task-owned evidence path.

**Interfaces:**
- Produces separate local, GodotIQ, artifact, hosted, review, merge and production evidence.

- [ ] **Step 1: Audit worktree and protected paths**

Confirm every task-owned change is committed and protected dirt remains unstaged. Record `git status --short`, branch and HEAD.

- [ ] **Step 2: Run final local gates once on integrated inputs**

Run in this order:

```powershell
corepack pnpm test:godot
corepack pnpm typecheck
corepack pnpm run test:build-web
corepack pnpm test
corepack pnpm run build:web
```

Expected: all exit 0. Record exact counts and the artifact manifest/hash.

- [ ] **Step 3: Run final GodotIQ gates**

Run project validate, project check-errors, `signal_map(find="missing")`, `signal_map(find="orphans")`, and applicable coverage/a11y checks. Distinguish legacy baseline findings from new regressions.

- [ ] **Step 4: Exact local artifact runtime/visual QA**

Using the authorized browser route, verify 1280x800 and 1440x900 plus representative 1920x1080. Exercise direct campaign setup, all seven tasks, optional hub, studio item deletion/undo/redo, upload, sandbox dual AIDA, teacher disclosure, final pitch, market and recovery. Capture console errors, critical failed requests, focus, contrast, clipping and reduced motion.

- [ ] **Step 5: One fresh isolated RC code review**

Invoke `superpowers:requesting-code-review` exactly once at stable RC. Supply neutral complete requirements, diff and evidence without suspected findings. Resolve findings proportionately and rerun only invalidated focused/full evidence.

- [ ] **Step 6: Push and wait for Linux CI**

Run:

```powershell
corepack pnpm run verify:repo-sync --expect-local-head
git push -u origin codex/gamewide-polish-redesign-20260812
```

The first sync command may correctly fail before publication because local HEAD is not main; record that state, push, and use canonical repository/CI evidence. Do not rewrite public history.

- [ ] **Step 7: Deploy exact CI draft and hosted QA**

Download the exact Linux CI artifact, verify its manifest/hash, deploy a Netlify draft with the existing site, and repeat the high-risk hosted QA surfaces. Keep draft evidence distinct from local artifact evidence.

- [ ] **Step 8: PR, merge and production**

Open the canonical-repository PR, wait for required checks, merge, obtain the exact main CI artifact, deploy that artifact to production and run production QA at both required viewports.

- [ ] **Step 9: Prove repository completion**

Run from an exact `origin/main` checkout:

```powershell
corepack pnpm run verify:repo-sync --expect-local-head
```

Confirm production manifest/release ID matches the exact main artifact, no task-owned commit remains outstanding, and no Supabase object was touched unless implementation evidence separately required and authorized it.
