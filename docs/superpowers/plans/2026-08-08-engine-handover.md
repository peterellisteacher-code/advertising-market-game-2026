# Mission demonstration stages — handover, 8 August 2026

Branch `agent/mission-clarity-20260807`. PRs target `agent/admarket-integrated-fixes-20260723`.
Plan of record: `docs/superpowers/plans/2026-08-07-mission-demonstration-stages.md`.

Every claim below survived an adversarial verification pass on 8 August. Where a number came
from a GodotIQ tool rather than the source, it is marked — re-run the tool, do not trust the
figure.

## Standing instruction — GodotIQ (Peter, 8 August 2026)

**Use GodotIQ to its full potential, all its pro tools, for everything.** Not as a linter that
gets run at the end — as the way the work is done. It found every real defect in this build and
none of them were visible to the gates, to a screenshot, or to reading the files.

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

`mcp__godot__launch_editor` (the separate `godot` MCP server, not `godotiq`) starts the editor;
the live tools need it. The GodotIQ addon writes the `GodotIQRuntime` autoload into
`godot/project.godot:17-19` — **that file is tracked, and the addon's edit to it is never
committed.**

Two operational notes:
- With the editor open, the Godot gate prints `Failed to start WebSocket server on port 6105` —
  the headless run cannot bind the port the editor holds. Tests still pass; it is stderr noise.
  Close the editor before the gate rather than debugging it. *(Observed once, 8 August.)*
- **Saving a scene from the editor renormalises the whole file** (uid stamps, `unique_id` on
  every node, `layout_mode` → `anchors_preset`) and can touch unrelated files. For a
  one-property change, revert and hand-apply the single line to keep the diff minimal.

## Verified false-positive classes — do NOT "fix" these

Checked 8 August against `dependency_graph` / `signal_map` / source. `validate(project)` reports
39 issues; 38 are noise. **All counts here are tool output — re-run the tools to confirm them.**

| Rule | Count | Why it misfires |
|---|---|---|
| `no_type_hint` | 27 | Flags `:=` inferred declarations, which **are** statically typed. It hits them only at class level (`var`, **not** `const`) and inside functions whose signature spans multiple lines. Decomposes exactly: 20 in the two multi-line-signature functions of `salience_measure.gd` (`_surround_contrast` 171-176, `_grid_integral` 231-237), 3 in `test_local_market_session.gd:132-136`, 4 class-level `var` in `agency_pair.gd:22-25`. Dozens of `:=` in single-line-signature functions in those same files go unflagged. |
| `missing_null_check` | 5 | Keyword heuristic. `dependency_graph` reports `references_autoloads: []` for every flagged file; the only autoload in the project is the addon's own `GodotIQRuntime`. |
| `orphan_signal` | 6 | The six panel signals are connected through a helper that takes the name as a parameter — `_connect_panel_signal(signal_name: StringName, callback: Callable)` at `agency_mission_controller.gd:427-429`, called six times from `_connect_panel()` at lines 410-415. Because the name is a variable at the `connect` call site, no static pass resolves it. The panel declares seven signals; the seventh, `role_handoff_requested`, is wired statically at `agency_world.gd:371` and is correctly not reported. |
| `incomplete_node` (Plate) | 1 | By design: `SalienceStage.tscn:36-42` has no texture because `salience_stage.gd:73-74` assigns it at runtime from the mission record, so one engine serves several missions. |
| `signal_map` → `missing` | 11 | All engine built-ins (`pressed`, `item_selected`, `timeout`, `confirmed`) emitted manually in tests to simulate input — e.g. `test_agency_guidance.gd:168`. |
| `asset_registry` → unused | 13 | **Do not act on this list.** It only scans scenes, so anything referenced by path string looks unused: the salience sprites and `SalienceStage.tscn` (`agency_mission_catalog.gd:10-11, 21-49`), `Main.tscn` (`project.godot:14`), and the four market rival PNGs, which are loaded from `RIVAL_ARTWORK_PATHS` at `godot/src/market/local_market_session.gd:24-29` and asserted by `test_local_market_session.gd:140-147`. Deleting any of them breaks the Godot gate. |

Converting the 27 `:=` declarations to explicit annotations would be a large meaning-free diff,
and would make new code less consistent with the rest of the project (65 `.gd` files outside
`addons/`, 34 of them under `godot/src`), nearly all of which uses `:=`.

## Done

- `a5310455` — shared agency button theme, so grey means unclickable.
- `831236eb` — Engine A, arrange-for-salience. Engine, measure and stage are separate files, and
  `salience_measure.gd` is `extends RefCounted` with only static functions and no reference to
  the stage, so engines B–G can reuse it directly. The measure is computed from the live
  arrangement with no authored target to compare against (`salience_measure.gd:32-88`). The three
  levers are:
  - **size** — alpha-weighted opaque area, normalised to the largest object (`:96-98, 128`);
  - **isolation** — distance to the nearest neighbour's bounding box, over the stage diagonal
    (`:156-169`);
  - **contrast** — CIE76 distance between the object's tinted colour and the mean colour of a
    *ring grown around* it (`:183`). That ring is **not** simply the plate behind the object: it
    blends neighbouring objects' tinted colours, weighted by their alpha coverage, with the
    plate's mean for whatever the neighbours do not claim (`:190-208`). Read that function before
    reusing the lever.

  Assets are fal-generated pixel art (`openai/gpt-image-2` + `fal-ai/bria/background/remove`),
  provenance and SHA-256 per file in `godot/assets/agency/ASSET-SOURCES.md:187-246`.
- `cbc2b6d2` — size slider and five colour swatches raised to the 48px minimum target size
  (found by `ui_map`); agency HUD height moved from a direct `size.y` write to
  `offset_bottom = offset_top + target_height` (`agency_hud.gd:85`).

  The warning that removed fired on every **AgencyWorld** mount, not every HUD mount:
  `AgencyHud.tscn` carries no anchor overrides, so a standalone instance has left == right and
  cannot trigger it. The differing anchors are on the instance inside the world scene
  (`AgencyWorld.tscn:1063-1065`, `anchors_preset = 10`).

Engine A verified end-to-end through real input: click the orange → select; click a tint →
feedback updates; slider to 0.9 → `passed=true won=["size"]` with the correct win sentence.

## Next

1. **Engines B–G.** Same shape as A: a record-driven stage scene plus a measure module, wired
   through `show_demonstration`. Reuse `salience_measure.gd` where the lever maths applies.
2. **Terminology pass** across the twelve mission records — `REQUIRED_MISSION_RECORDS` (7) plus
   `SIDEQUEST_RECORDS` (5) in `agency_mission_catalog.gd`.
3. **Remove `transferPrompt` / `TransferStage`** once every mission has a demonstration. Present
   in `agency_mission_catalog.gd`, `AgencyMissionPanel.tscn`, `agency_mission_panel.gd`,
   `test_agency_missions.gd`, `test_agency_mission_catalog.gd`, `test_agency_world.gd`.

## Open, not actioned

- **21 controls below 48×48 across the rest of the game** — from `ui_map` over the full running
  tree (306 controls, 57 interactive). Ten are 31px CheckBoxes, seven are 40–47px buttons,
  `FormatSelector`/`AnimationSelector` are 20px, `MasterVolume` is 8×16, `DirectTravel` is 40
  wide. Spun off as its own task: it spans ~8 scenes and each change can shift a layout, so it
  needs per-screen re-measurement. `ui_map`'s 48px threshold is Material guidance, stricter than
  WCAG 2.2 AA (SC 2.5.8, 24×24); about 17 of the 21 fail the 44×44 AAA bar (SC 2.5.5). Settle
  the target with Peter before starting. These counts are tool output — re-run `ui_map`.
- **Pixel-art filtering.** The fruit sprites are pixel art rendered with Godot's default canvas
  texture filter, Linear. There is no `default_texture_filter` key in `godot/project.godot` — it
  is the engine default, so grepping for it finds nothing. Setting `Nearest` per-node on the
  fruit would keep the blocks crisp, but the plate is not pixel art, so this is an aesthetic call
  for Peter, not a project-wide setting change. Mipmaps were enabled chasing this and reverted:
  the render was unchanged, because the blocks are the art, not undersampling.

## Gates

This is a **pnpm** workspace — `package.json` declares `packageManager: pnpm@11.7.0` and
`CONTRIBUTING.md:17-29` specifies `corepack enable` then `pnpm install --frozen-lockfile`. Never
run `npm install` here.

Bare `pnpm` is **not on PATH** on this machine; `corepack --version` is 0.35.0 and
`corepack pnpm --version` is 11.7.0. Invoke the gates the way `AGENTS.md:15` does — verified
working 8 August:

```
corepack pnpm run test:godot
corepack pnpm run typecheck
corepack pnpm run test:build-web
corepack pnpm run test:unit
corepack pnpm run build:web
```

All five were green at `cbc2b6d2`; `bc56aaa2` and later are docs-only. (They were run that day
as `npm run <script>`, which executes the same `package.json` scripts and whose results stand —
but `corepack pnpm run` is the repo's convention and the only safe path near `install`.)
