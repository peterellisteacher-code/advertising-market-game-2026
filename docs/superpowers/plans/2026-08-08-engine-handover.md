# Mission demonstration stages — handover, 8 August 2026

Branch `agent/mission-clarity-20260807`. PRs target `agent/admarket-integrated-fixes-20260723`.
Plan of record: `docs/superpowers/plans/2026-08-07-mission-demonstration-stages.md`.

**How to read the claims below.** Numbers that came from a GodotIQ tool are marked as tool
output — re-run the tool, do not trust the figure. Everything else was checked against the
source on 8 August. An earlier version of this document opened by asserting that every claim
in it had survived adversarial verification. That warrant was false and has been removed: a
six-reviewer pass on 8 August found a shipped logic defect in the measure, and found four
false statements in this document. Treat it as notes, not as a certificate.

## Standing instruction — GodotIQ (Peter, 8 August 2026)

**Use GodotIQ to its full potential, all its pro tools, for everything.** Not as a linter run
at the end — as the way the work is done.

The working loop:

```
project_summary → editor_context          (session start; launch the editor if not connected)
file_context / dependency_graph           (before editing anything)
impact_check                              (before any signature or signal change)
script_ops patch / node_ops → save_scene  (the writes)
run(play) → exec(context:"game")          (mount the screen under test)
ui_map → input → state_inspect            (measure it, drive it, read it)
screenshot                                (verify visual claims — never assert from text alone)
validate → check_errors → signal_map      (after every change)
```

**What GodotIQ is and is not good for here, measured.** Its runtime tools found defects nothing
else did: `ui_map` found 21 undersized touch targets, and driving the stage through real `input`
found the HUD anchor warning. Its static tools found one real dead signal (`arrangement_changed`).
But the two most serious defects on this branch — the isolation lever and the reset index
misalignment, both fixed in `2911598e` — are logic errors that no GodotIQ tool can see, and both
were visible from reading two functions side by side. An earlier version of this document claimed
GodotIQ "found every real defect in this build and none of them were visible to reading the
files." That is false, and believing it is how both defects shipped. Drive the tools *and* read
the code.

`mcp__godot__launch_editor` (the separate `godot` MCP server, not `godotiq`) starts the editor;
the live tools need it. The GodotIQ addon writes the `GodotIQRuntime` autoload into
`godot/project.godot:17-19` — **that file is tracked, and the addon's edit to it is never
committed.**

Three operational notes:
- With the editor open, the Godot gate prints `Failed to start WebSocket server on port 6105` —
  the headless run cannot bind the port the editor holds. Tests still pass; it is stderr noise.
- **Saving a scene from the editor renormalises the whole file** (uid stamps, `unique_id` on
  every node, `layout_mode` → `anchors_preset`) and can touch unrelated files. For a
  one-property change, revert and hand-apply the single line to keep the diff minimal.
- `godot/src` and `godot/tests` **disagree on indentation**: sources are 4 spaces, tests are
  tabs. `script_ops` patches are exact-match, so check before writing a patch.

## Verified false-positive classes — do NOT "fix" these

Checked 8 August against `dependency_graph` / `signal_map` / source. `validate(project)` reports
**39 issues, 0 of them errors** (33 warning, 6 info) — tool output, re-run it. Every one falls in
the classes below; none is a live defect. The one real issue `validate` ever caught on this branch
was the dead `arrangement_changed` signal, and that was removed before this document existed.
(An earlier version said "38 are noise" while tabulating all 39 as misfires, sending the reader
after a defect that does not exist.)

| Rule | Why it misfires |
|---|---|
| `no_type_hint` | Flags `:=` inferred declarations, which **are** statically typed. It hits them at class level (`var`, not `const`) and inside functions whose signature spans multiple lines — in `salience_measure.gd` that is `_surround_contrast` and `_grid_integral`. Dozens of `:=` in single-line-signature functions in the same files go unflagged. *(An earlier version gave an exact per-function decomposition. Recounted by hand it did not sum to the reported total, so it has been dropped rather than re-guessed — run `validate(target=file, detail="normal")` if you need the list.)* |
| `missing_null_check` | Keyword heuristic. `dependency_graph` reports `references_autoloads: []` for every flagged file; the only autoload in the project is the addon's own `GodotIQRuntime`. |
| `orphan_signal` | The six panel signals are connected through a helper taking the name as a parameter — `_connect_panel_signal(signal_name: StringName, callback: Callable)` at `agency_mission_controller.gd:427-429`, called six times from `_connect_panel()`. Because the name is a variable at the `connect` call site, no static pass resolves it. The panel's seventh signal, `role_handoff_requested`, is wired statically at `agency_world.gd:371` and is correctly not reported. |
| `incomplete_node` (Plate) | By design: `SalienceStage.tscn` has no plate texture because `salience_stage.gd` assigns it at runtime from the mission record, so one engine serves several missions. |
| `signal_map` → `missing` | Engine built-ins (`pressed`, `item_selected`, `timeout`, `confirmed`) emitted manually in tests to simulate input — e.g. `test_agency_guidance.gd:168`. |
| `asset_registry` → unused | **Do not act on this list.** It only scans scenes, so anything referenced by path string looks unused: the salience sprites and `SalienceStage.tscn` (`agency_mission_catalog.gd`), `Main.tscn` (`project.godot`), and the four market rival PNGs loaded from `RIVAL_ARTWORK_PATHS` at `godot/src/market/local_market_session.gd:24-29` and asserted by `test_local_market_session.gd`. Deleting any of them breaks the Godot gate. |

Converting the `:=` declarations to explicit annotations would be a large meaning-free diff, and
would make new code less consistent with the rest of the project, nearly all of which uses `:=`.

## Done

- `a5310455` — shared agency button theme, so grey means unclickable.
- `831236eb` — Engine A, arrange-for-salience. Engine, measure and stage are separate files, and
  `salience_measure.gd` is `extends RefCounted` with only static functions and no reference to
  the stage. The measure is computed from the live arrangement with no authored target to compare
  against. The three levers:
  - **size** — alpha-weighted opaque area, normalised to the largest object;
  - **isolation** — distance to the nearest neighbour's bounding box **or to the stage edge,
    whichever is closer**, over the stage diagonal;
  - **contrast** — CIE76 distance between the object's tinted colour and the mean colour of a
    *ring grown around* it. That ring is **not** simply the plate behind the object: it blends
    neighbouring objects' tinted colours, weighted by their alpha coverage, with the plate's mean
    for whatever the neighbours do not claim. Read `_surround_contrast` before reusing the lever,
    and read the open finding on record order below first.

  Assets are fal-generated pixel art (`openai/gpt-image-2` + `fal-ai/bria/background/remove`),
  provenance and SHA-256 per file in `godot/assets/agency/ASSET-SOURCES.md`.
- `cbc2b6d2` — size slider and five colour swatches raised to a 48px minimum **height** (found by
  `ui_map`); agency HUD height moved from a direct `size.y` write to
  `offset_bottom = offset_top + target_height`. The warning that removed fired on every
  **AgencyWorld** mount, not every HUD mount: `AgencyHud.tscn` carries no anchor overrides, so a
  standalone instance has left == right and cannot trigger it. The differing anchors are on the
  instance inside the world scene.
- `2911598e` — the two defects the 8 August review found, each with a regression test confirmed
  to fail against the old code:
  - **Isolation ignored the stage boundary.** `_nearest_gap` measured only the gaps between
    objects, so dragging the orange into a corner beat a cluster whose members all read as gap 0
    against each other. The exercise passed in one action and asserted "the orange now has the
    most space around it" about an object flush against two edges. `_nearest_gap` now takes the
    stage and starts from `_edge_gap`. The measure fixture moved to the stage midline, where the
    isolation lead comes from the gap between objects rather than a shared distance to the top edge.
  - **`reset_arrangement` paired the built list with the record by index**, while `_build_objects`
    skips any entry whose texture fails to load. Against the real record a missing bananas sprite
    handed the orange the bananas' scale and the exercise passed itself. The opening pose is now
    carried on the object, and a failed load raises a warning instead of going quiet.

## The 8 August review

Six independent unguided adversarial reviewers, each given verbatim source and no hypothesis: an
in-harness Opus (`consensus-member`) and a five-model OpenRouter panel (`z-ai/glm-5.2`,
`moonshotai/kimi-k3`, `~deepseek/deepseek-v4-flash-latest`, `tencent/hy3`, `openai/gpt-5.6-sol`;
5 seats, 5 answered, $1.29).

Two results worth carrying forward:

- **The isolation defect was found by Opus alone.** All five panel seats missed it. A panel is not
  a substitute for a reviewer that reasons about what the code *claims to teach*.
- **The seats contradicted each other on a checkable fact.** glm-5.2 said this document's
  `no_type_hint` decomposition was off by one; kimi-k3 explicitly listed it among claims it had
  "independently verified" as correct. Hand-counting settled it in glm's favour. Panel agreement
  is not evidence, and a seat asserting it verified something is not evidence either.

## Open, not actioned

Findings from the review that were not fixed. Nothing here is speculative — each was traced to
source — but none has been re-derived since, so confirm before acting.

**Fix before engines B–G, because cloning propagates them sixfold**

1. **A single-object record auto-passes every lever.** `_sole_leader` initialises `runner_up` to
   `-INF`, so a lone object leads everything and `passed` is true with no student action. Found by
   all five panel seats. Harmless for the five-fruit record; fatal for any future one-object record.
2. **`LEAD_EPSILON` is one absolute value across incompatible units.** 0.0005 is applied to size
   and isolation (roughly [0,1]) and to contrast (raw CIE76 ΔE, 0–100+). On contrast it is three
   orders of magnitude below a just-noticeable difference, so the tie mechanism is dead there and
   grid-sampling noise decides the leader — the opposite of what the comment above it promises.
3. **Contrast depends on the record's object order.** In `_surround_contrast`, neighbours consume
   a shared budget in array order, so when two overlap inside the ring, whichever is listed first
   claims it. Reordering a record changes the measured contrast with no visual change. Worse, views
   are added in record order so later ones draw *on top*, while the blend gives the first — the
   bottom-most — priority.
4. **`_stage_size` falls back to `Vector2(880, 440)`** while the scene and record use 880×320. A
   record omitting `stageSize` would measure and clamp against a stage 120px taller than the one
   drawn.
5. **A missing plate silently becomes a white surround.** `_plate_mean` returns `Color.WHITE` when
   the grid is absent or the ring's plate weight is zero, so a mistyped plate path turns contrast
   into "distance from white" with no error.
6. **Lever names and bars are hardcoded to three.** `describe`'s fallback sentence names "size,
   space or colour difference" directly instead of going through `leverPhrases`, and
   `SalienceStage.tscn` defines exactly three bar/label groups. An engine with a different lever
   set needs both changed.

**Interaction and accessibility**

7. **Transparent pixels form opaque hit boxes.** Every object is a rectangular `TextureRect` with
   `MOUSE_FILTER_STOP` and no alpha hit-testing, and the opening arrangement overlaps. Clicking
   what is visibly the orange can select the apple whose box is above it in draw order.
8. **`focus_target()` is defined and never called** by `_ready`, `configure`, or any test, so the
   keyboard affordance its comment promises does not happen unless the host panel calls it.
9. **`focus_entered.connect(_select.bind(id))`** means tabbing through the objects reassigns the
   selection, so a keyboard user aiming for the slider changes which fruit the controls act on.
10. **Keyboard control is undiscoverable.** Arrow-key nudging with Shift for coarse steps exists,
    but neither the record instruction nor the scene text mentions keys at all.
11. **Touch is unhandled.** Only `InputEventMouseButton`/`MouseMotion`/`Key` are inspected, so
    dragging does not work on a touchscreen or interactive whiteboard. The native controls do.
12. **Swatch minimum size is height-only** — `Vector2(0, 48)` sets no minimum width. Current labels
    happen to exceed 48px; the 48×48 target is not enforced.
13. **The "Darker" and "Muted" swatches ship as grey clickable buttons**, against the rule commit
    `a5310455` exists to enforce. Reported by Opus; check against the theme before changing it,
    since these are content colours rather than state.
14. **Focus-ring contrast** was reported at 1.78:1 against the white swatch, below WCAG 1.4.11's
    3:1. Measure it before acting — this is the one finding taken from a reviewer's own
    calculation rather than from source.

**Test coverage**

15. **Only the size lever is driven end to end.** No committed test exercises dragging, keyboard
    nudging, edge clamping, the tint swatches, reset, `show_error`, or a win by isolation or
    contrast through the stage. A disconnected swatch or a sign error in the drag maths would
    leave the suite green.
16. **`test_salience_measure.gd` asserts an algebraic identity** — `baseArea == coverage * w * h`
    holds by construction for any input, so it cannot fail.
17. **`test_agency_guidance.gd:162` asserts `hud.size.x <= hud.custom_minimum_size.x`**, which is
    backwards for a minimum, and line 178 checks a child against the minimum rather than the
    actual width. Neither constrains what its comment implies.
18. **The suite is `assert`-only.** Under a release export template assertions are stripped and
    `run()` returns `true` unconditionally. Fine while the gate runs a debug binary — which is
    nowhere recorded.

**Comments that overstate the code**

19. `salience_measure.gd`'s header says all three levers are "each normalised across the objects
    in the scene". Size is over the largest area, isolation over the stage diagonal, contrast is
    raw ΔE. The `*Share` fields are the normalised ones.
20. `test_salience_measure.gd` says there is "no expected arrangement anywhere in this suite"
    while hardcoding 0.62 as a known passing scale twice. The property it names is real; the test
    does not establish it.

**Carried over, not from this review**

21. **21 controls below 48×48 across the rest of the game** — `ui_map` over the full running tree
    (306 controls, 57 interactive; tool output, re-run it). Ten are 31px CheckBoxes, seven are
    40–47px buttons, `FormatSelector`/`AnimationSelector` are 20px, `MasterVolume` is 8×16,
    `DirectTravel` is 40 wide. Spans ~8 scenes and each change can shift a layout, so it needs
    per-screen re-measurement. `ui_map`'s 48px threshold is Material guidance, stricter than WCAG
    2.2 AA (SC 2.5.8, 24×24); about 17 of the 21 fail the 44×44 AAA bar (SC 2.5.5). Settle the
    target with Peter before starting.
22. **Pixel-art filtering.** The fruit sprites are pixel art rendered with Godot's default canvas
    filter, Linear. There is no `default_texture_filter` key in `godot/project.godot` — it is the
    engine default, so grepping finds nothing. Setting `Nearest` per-node on the fruit would keep
    the blocks crisp, but the plate is not pixel art, so this is an aesthetic call for Peter.
    Mipmaps were enabled chasing this and reverted: the render was unchanged, because the blocks
    are the art, not undersampling.

## Next

1. **Engines B–G.** Same shape as A: a record-driven stage scene plus a measure module, wired
   through `show_demonstration`. Reuse `salience_measure.gd` where the lever maths applies — but
   items 1–6 above are the price of reusing it as it stands.
2. **Terminology pass** across the twelve mission records — `REQUIRED_MISSION_RECORDS` (7) plus
   `SIDEQUEST_RECORDS` (5) in `agency_mission_catalog.gd`.
3. **Remove `transferPrompt` / `TransferStage`** once every mission has a demonstration. Present in
   `agency_mission_catalog.gd`, `AgencyMissionPanel.tscn`, `agency_mission_panel.gd`,
   `test_agency_missions.gd`, `test_agency_mission_catalog.gd`, `test_agency_world.gd`.

## Gates

This is a **pnpm** workspace — `package.json` declares `packageManager: pnpm@11.7.0` and
`CONTRIBUTING.md` specifies `corepack enable` then `pnpm install --frozen-lockfile`. Never run
`npm install` here. Bare `pnpm` is **not on PATH** on this machine; `corepack --version` is 0.35.0
and `corepack pnpm --version` is 11.7.0. Invoke the gates as `AGENTS.md` does:

```
corepack pnpm run test:godot
corepack pnpm run typecheck
corepack pnpm run test:build-web
corepack pnpm run test:unit
corepack pnpm run build:web
```

All five were run and green at `2911598e` on 8 August.

Note the six `.png.import` files under `godot/assets/agency/salience/` show as modified with an
empty content diff — that is LF/CRLF normalisation, not a change. Do not stage them.
