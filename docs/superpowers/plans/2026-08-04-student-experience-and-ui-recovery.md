# Student Experience and UI Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the student route recover from startup failure and teach the complete Brief → Build → Pitch loop through concise, staged, screenshot-led onboarding.

**Architecture:** Keep the Godot agency opener, Web Studio tour and hosted startup boundary independent. A new Studio onboarding controller gates existing controls without changing campaign data; the current journey controller supplies short local steps and a paged manual. The Godot shell reports engine progress/failure to the existing account boundary, while the teacher playtest strip becomes a non-layout fixed disclosure.

**Tech Stack:** Godot 4 Control scenes and GDScript, TypeScript, DOM/CSS, Vitest, Node source-contract tests, Netlify Functions/release artifact, Playwright browser QA.

## Global Constraints

- Desktop/laptop only: keyboard plus mouse or trackpad; no phone layouts or touch-only controls.
- Never launch Windows Godot; modify Godot files through GodotIQ and verify with static Pro checks plus the verified web-export path.
- One live instruction and at most two new terms at a time; actual brief content precedes definitions.
- The teacher playtest retains isolated authentication, storage and API routes while sharing game content.
- No student progress reset, Supabase mutation or production deploy until the final verified candidate.
- Verify 1280×800, 1440×900 and 1920×1080.

---

### Task 1: Visible hosted startup recovery

**Files:**
- Modify: `web/src/account/account-gate.ts`
- Modify: `web/src/account/account-gate.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`
- Modify: `godot/web/godot_shell.html`
- Modify: `scripts/build-web.mjs`
- Modify: `scripts/build-web.test.mjs`
- Modify: `web/src/account/account.css`

**Interfaces:**
- Produces: `window.AdMarketGameAccess.reportStartupProgress(percent)`, `reportStartupReady()` and `reportStartupFailure(reason)`.
- Preserves: `requireAccess(): Promise<void>` and the account isolation contract.

- [ ] **Step 1: Write failing recovery tests**

Test literal outcomes: a 45-second unresolved engine start renders `The game could not start`; both `Try loading again` and `Return to sign in` are operable; an engine rejection takes the same path; the progress surface is visible above the locked canvas; reporting ready removes it.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `corepack pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/account/account-gate.test.ts web/src/main.test.ts`

Run: `node --test scripts/build-web.test.mjs`

- [ ] **Step 3: Implement the bounded startup boundary**

Keep the existing account promise. Add a startup-status overlay, a 45,000 ms watchdog in `godot_shell.html`, and public progress/ready/failure calls. `Return to sign in` runs the existing isolation/logout path; `Try loading again` performs a cache-revalidated `/student` navigation.

- [ ] **Step 4: Run focused tests and typecheck**

Run the Step 2 commands, then `corepack pnpm run typecheck`.

- [ ] **Step 5: Commit**

Commit message: `fix(student): recover from stalled game startup`

### Task 2: Studio brief-first onboarding and glossary

**Files:**
- Create: `web/src/game/student-glossary.ts`
- Create: `web/src/game/student-glossary.test.ts`
- Create: `web/src/game/studio-onboarding-controller.ts`
- Create: `web/src/game/studio-onboarding-controller.test.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`
- Modify: `web/src/game/pair-game-controller.ts`
- Modify: `web/src/game/pair-game-controller.test.ts`
- Modify: `web/src/styles/editor.css`
- Modify: `web/src/styles/editor-css.test.ts`

**Interfaces:**
- Produces: `StudioOnboardingController.open(document, brief)` and `restart()`.
- Consumes: existing `PairGameController.acknowledgeRoleGuide()` only after the tour completes.

- [ ] **Step 1: Write failing first-entry tests**

Assert a new campaign first shows the actual Context, Need, Values and Intended response; every heading has an accessible help button and dismissible popover; the four pages are Brief, Roles, Build area and First action; hidden regions are inert; completion focuses the starter-product choice. Assert acknowledged saved campaigns skip mandatory replay and can restart the tour.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `corepack pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/game/student-glossary.test.ts web/src/game/studio-onboarding-controller.test.ts web/src/ui/editor-shell.test.ts web/src/game/pair-game-controller.test.ts web/src/main.test.ts web/src/styles/editor-css.test.ts`

- [ ] **Step 3: Implement the staged controller and concise shell**

Render only one page at a time with Previous, Next and Close. Brief definitions live only in the `?` popovers. Keep the current UI hidden/inert until its page introduces it. Do not add campaign schema fields: use existing role-guide acknowledgement for first-run persistence.

- [ ] **Step 4: Run focused tests and typecheck**

Run the Step 2 command and `corepack pnpm run typecheck`.

- [ ] **Step 5: Commit**

Commit message: `feat(studio): teach the brief before the tools`

### Task 3: Short local steps and paged manual

**Files:**
- Modify: `web/src/game/guided-journey.ts`
- Modify: `web/src/game/guided-journey.test.ts`
- Modify: `web/src/game/guided-journey-controller.ts`
- Modify: `web/src/game/guided-journey-controller.test.ts`
- Modify: `web/src/game/role-guide-controller.ts`
- Modify: `web/src/game/role-guide-controller.test.ts`
- Modify: `web/src/game/student-copy.ts`
- Modify: `web/src/game/student-copy.test.ts`
- Modify: `scripts/onboarding-source.test.mjs`
- Modify: `scripts/student-copy-corpus.test.mjs`

**Interfaces:**
- Produces: surface-local progress labels such as `Build · Step 1 of 3` and a six-page reference manual.
- Preserves: guided completion predicates and all campaign evidence fields.

- [ ] **Step 1: Write failing language and navigation tests**

Assert the first visible Studio action is `Choose one starter product`; no live copy contains `canvas change` or `next canvas change`; the manual exposes labelled Previous/Next controls and only one page at a time; AIDA, price, route and proof vocabulary appears only immediately before its action.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `corepack pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/game/guided-journey.test.ts web/src/game/guided-journey-controller.test.ts web/src/game/role-guide-controller.test.ts web/src/game/student-copy.test.ts`

Run: `node --test scripts/onboarding-source.test.mjs scripts/student-copy-corpus.test.mjs`

- [ ] **Step 3: Replace global numbering and the scrolling reference**

Keep completion order unchanged. Present local phase labels and six concise manual pages: Goal, Brief, Roles, Build, Message and Pitch. Replace early `canvas` language with `advertisement` and concrete edit verbs.

- [ ] **Step 4: Run focused tests and typecheck**

Run the Step 2 commands and `corepack pnpm run typecheck`.

- [ ] **Step 5: Commit**

Commit message: `fix(studio): reveal guidance one page at a time`

### Task 4: Screenshot-led agency opener and landscape HUD

**Files:**
- Create: `godot/assets/agency/onboarding-brief.png`
- Create: `godot/assets/agency/onboarding-build.png`
- Create: `godot/assets/agency/onboarding-pitch.png`
- Modify: `godot/src/agency/ui/AgencyGuideDrawer.tscn`
- Modify: `godot/src/agency/ui/agency_guide_drawer.gd`
- Modify: `godot/src/agency/ui/AgencyHud.tscn`
- Modify: `godot/src/agency/ui/agency_hud.gd`
- Modify: `godot/src/agency/AgencyWorld.tscn`
- Modify: `godot/project.godot`
- Modify: `scripts/onboarding-source.test.mjs`

**Interfaces:**
- Produces: first orientation page with Brief → Build → Pitch screenshot cards and concise goal/why/reward text.
- Preserves: `direct_travel_requested`, `role_handoff_requested`, `tucked_changed` and existing saved `orientation_acknowledged` behavior.

- [ ] **Step 1: Copy verified screenshots and write failing source contracts**

Copy the project-owned QA captures without altering their pixels. Test that the first page references all three images and labels; the opener has Previous/Next; the HUD’s pale button text is replaced by dark AA text; `Go to objective` has a non-clipping minimum size; the viewport uses expanded landscape stretch.

- [ ] **Step 2: Run source contracts and confirm RED**

Run: `node --test scripts/onboarding-source.test.mjs scripts/godot-bridge-contract.test.mjs`

- [ ] **Step 3: Implement through GodotIQ**

Before each Godot edit call `file_context`. Use `script_ops` for GDScript and `file_ops`/structured scene operations for scenes and project settings. Keep the first page to the exact Brief, Build, Pitch sequence and move detailed control help to later pages. Default the HUD to its compact state, use at least 18 px readable text, wrap labels, and allow the viewport to reveal additional horizontal world space rather than distort it.

- [ ] **Step 4: Run GodotIQ validation and source contracts**

For every changed Godot file run `validate(target=file, detail=brief)` and `check_errors(scope=file)`. Re-run the Step 2 command.

- [ ] **Step 5: Commit**

Commit message: `feat(godot): show the full campaign loop at entry`

### Task 5: Non-obstructive teacher controls and integration

**Files:**
- Modify: `web/src/teacher/teacher-playtest-controller.ts`
- Modify: `web/src/teacher/teacher-playtest-controller.test.ts`
- Modify: `web/src/teacher/teacher.css`
- Modify: `web/src/styles/editor.css`
- Modify: `web/src/styles/editor-css.test.ts`

**Interfaces:**
- Preserves: teacher reset, dashboard return and isolated playtest state.
- Produces: a fixed compact `Teacher controls` disclosure which reserves zero layout height.

- [ ] **Step 1: Write failing layout and behavior tests**

Assert the closed control is fixed, does not change `#creator-root` inset, expands without covering the primary game actions, and closes by click or Escape. Keep reset behavior unchanged.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `corepack pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/teacher/teacher-playtest-controller.test.ts web/src/styles/editor-css.test.ts`

- [ ] **Step 3: Implement compact controls and integrated sizing**

Remove the white strip from document flow. Use a top-right fixed disclosure with an opaque high-contrast panel only while expanded; keep game sizing identical to the student surface.

- [ ] **Step 4: Run focused tests and typecheck**

Run the Step 2 command and `corepack pnpm run typecheck`.

- [ ] **Step 5: Commit**

Commit message: `fix(teacher): keep playtest controls off the game`

### Task 6: Final export, browser QA and publication

**Files:**
- Modify: final verification record under `docs/superpowers/`
- No production source change after the stable-candidate hash unless a verified blocker is found.

**Interfaces:**
- Consumes: Tasks 1–5.
- Produces: one reviewed, built, deployed and browser-verified release.

- [ ] **Step 1: Run the complete stable-candidate gates once**

Run `corepack pnpm run typecheck`, the focused suites above, `corepack pnpm run test:build-web`, the applicable full Vitest suite, GodotIQ changed-file validation, and the Linux/CI verified Godot web export. Never invoke the quarantined Windows Godot executable.

- [ ] **Step 2: Run one isolated final code review**

Use `superpowers:requesting-code-review` once on the stable branch diff. Fix any load-bearing finding in one integrated wave and re-run only invalidated evidence.

- [ ] **Step 3: Verify the release artifact in browser**

Use Playwright on the hosted candidate at 1280×800, 1440×900 and 1920×1080. Capture: sign-in/create account; three-page opening; first mission; Studio brief; each tour page; starter-product focus; compact/expanded HUD; compact/expanded teacher controls; engine-timeout recovery. Check console and network evidence.

- [ ] **Step 4: Publish and deploy**

Run `corepack pnpm run verify:repo-sync --expect-local-head`, push the branch, merge through the canonical public repository, deploy the exact verified artifact to Netlify production, then repeat the critical student login/start and teacher-playtest smoke checks. Supabase remains unchanged unless the verified fault specifically requires a named migration and reservation.

- [ ] **Step 5: Record and commit evidence**

Record exact commit IDs, commands, test counts, artifact/release hashes, Netlify deploy ID and URL, screenshot paths, browser findings and explicit production/Supabase/OneDrive state.
