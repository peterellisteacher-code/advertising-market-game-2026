# Studio tuckability + single-action design

Date: 2026-08-06. Owner: Claude (Fable) under Peter's UX law. Applies to the web Studio first, Godot surfaces in a later phase.

## The law (verbatim intent from Peter)

1. Never introduce too many concepts at once.
2. No screen offers more than ONE area in which students are expected to act.
3. Every other menu is tuckable: completely hidden at a screen edge except for its button; it untucks only when that button is pressed.
4. Screen space is crucial: no menu bar or feature may impinge on the activity more than it absolutely has to.

## Measured baseline (vite harness, 1280x720, 2026-08-06)

- `.creator` grid rows: `52px 120px 548px` (top bar / pair strip / workspace). Workspace columns: `64px 482px 10px 724px` (rail / drawer / splitter / canvas). The ad canvas column is ~43% of total screen area in the default state.
- Top bar is NOT tuckable (8 controls incl. product name, undo/redo, display, tour, return to game). Pair strip IS tuckable ("Hide task bar", reclaims its row correctly) but defaults open and its toggle lives in the top bar, far from the strip.
- Tool drawer collapses via a separate "Hide tools" button; the 64px rail is permanent.
- Floating overlays (zoom toolbar, layers, inspector, section fill, display panel) can stack over the canvas; no exclusivity.
- First entry shows the Studio tour dialog PLUS all chrome behind it: ~24 interactive controls visible at once.

## Target architecture: edge-tab tuck shell

New primitive `web/src/ui/tuck-shell.ts` + `web/src/styles` additions. A tuck panel is registered with `{ id, edge: "top"|"left", tabLabel, defaultTucked, group }`.

Behaviour contract:

- Tucked = the panel contributes ZERO layout space; only its slim edge tab (one button) remains at its screen edge. Grid tracks collapse (the proven `Hide task bar` row-reclaim pattern, generalised) — never `visibility:hidden` over a reserved track.
- The tab button toggles. `aria-expanded` reflects state; untucking moves focus to the panel's first focusable; tucking returns focus to the tab. Esc inside a panel tucks it.
- Panels sharing a `group` are exclusive: untucking one tucks the others (guarantees a single auxiliary surface at most, supporting law #2).
- State persists per mode (student vs teacher-playtest) using the display-preferences storage-key pattern, but in `sessionStorage`: the arrangement survives mid-lesson reloads, and every NEW session starts fully tucked (chrome must never resurrect open across days).
- `prefers-reduced-motion` and the production reduced-motion bridge suppress slide transitions (instant toggle).
- Large-text and high-contrast display modes apply to tabs and panels (reuse existing creator-chrome tokens).

### Zone mapping (Studio)

| Surface today | Becomes | Default |
|---|---|---|
| Top bar (52px, permanent) | TOP edge tab "Menu": product name field, display prefs, how-to, tour, return to game, save status | Tucked |
| Pair/task strip (120px, default open) | TOP edge tab "Brief & roles": audience signal, full brief, role card, progress | Tucked |
| Undo/Redo (top bar) + save indicator + zoom toolbar | ONE compact canvas toolbar (existing bottom-right cluster) — part of the single action area | Always (it is the activity's own toolbar) |
| Tool rail (64px) + "Hide tools" | Rail stays: it IS the edge-tab strip for the drawer. Clicking the ACTIVE tool tab tucks the drawer (separate "Hide tools" button removed) | Drawer tucked unless the current journey step's action area is a tool panel (e.g. empty canvas at Build) |
| Layers / inspector / section-fill / display panel | One exclusivity group; opening one closes the others | Hidden |
| Teacher playtest strip | Already a pill toggle — style alignment only | Collapsed |

Product name currently appears in the top bar; if the Build panel also owns naming, keep ONE source (Build panel primary; Menu shows read-only name). Verify during implementation.

### Concept pacing (first entry)

- While the Studio tour is open, the stage is clean: all edge tabs hidden, tour only.
- Tour steps that spotlight a tucked surface untuck it for the step and retuck on advance.
- After the tour, the guided journey (`web/src/game/guided-journey*.ts`) decides which single panel auto-untucks at each step transition; everything else starts tucked.

## Phase C design — Godot surfaces

- **Lobby (Main.tscn `LobbyPanel`)**: stage it. Default state shows ONE primary action (start/continue practice). "Join the class market" (alias + room code) becomes a tuck revealed by its own button; teacher setup stays behind its existing toggle. No competing panels.
- **AgencyHud**: keep the existing strip + `HudTuckToggle`/`ExpandedDetails` pattern but slim the always-visible row to: objective text, go-to-objective, the expand toggle, guide button. Verify at runtime the strip is one row and nothing else persists over the world.
- **RunPanel / mission panel**: already single-action (full-panel phases and modal missions) — audit at runtime, no redesign expected.
- **sound-booth station**: deliberate ambient set dressing, not dead content — it never becomes an objective and the station gate already redirects politely. Leave as is; do not wire missions to it (the task's "multimodal" requirement is met by the oral presentation itself, and no audio pipeline exists in the ad format).

## Phase D design — writer's statement + pitch evidence

The game already captures everything needed; D is assembly, not new authoring:

1. **Bridge mission evidence into the campaign document**: Godot's `agency_progress.gd` holds `evidence_by_mission` ({decision, effect} — the pair's own 30–400 char technique→audience sentences). Add an OPTIONAL `missionEvidence` array ({missionId, title, decisionId, effectText}) to `CampaignDocumentV1` (zod optional — old drafts stay valid, no migration), populated by the Godot side when it opens the creator / publishes; `campaign_document.gd`'s validator passes it through. This is a deliberate, narrow bridge-contract extension — the one exception to "never touch bridge contracts", designed here, not improvised by a builder.
2. **Writer's-statement view (web)**: reachable from the Menu tuck ("Writer's statement") and offered post-publish. Assembles: audience brief (context/needs/values/intended response), the pair's `strategy.aidaPlan` four lines, `marketRoute.proofPoint`, their mission `effectText` sentences grouped under rubric-aligned headings (audience & purpose / visual choices / language choices / evidence), and the accessible names of the canvas objects they linked as AIDA evidence. Print stylesheet + print button so pairs take paper notes into the 5-minute oral. All student-facing copy in this view goes through the plain-language → claude-scrubber pipeline before ship.
3. **PitchTheatre**: replace the generic per-mission checklist sentences with the pair's own `effect` text where present (Godot reads its native progress state; fall back to current copy when absent).
4. Optional, only if trivial: show Studio Coach's last verdict in the statement view when it exists in sessionStorage. Never persisted server-side.

## Out of scope entirely

Live-market screen redesign (the numeric scorecard already scaffolds the class critique; verbal feedback happens in the room). Never touch: account/auth flows, Netlify functions beyond none, Image Lab / fal gating, Supabase.

## Verification

- TDD: `web/src/ui/tuck-shell.test.ts` covers state machine, exclusivity groups, persistence per mode, aria/focus behaviour, reduced-motion. CSS contract tests updated for conditional tracks. `web/src/main.test.ts` flows updated where they encode old chrome.
- Programmatic browser measurement at 1280x800 and 1440x900: default canvas share of viewport >= 75% with tucks closed; no horizontal overflow; every panel keyboard-reachable.
- Full unit + build-contract suites green before any deploy.
