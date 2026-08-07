# Mission demonstration stages — handover, 8 August 2026

Branch `agent/mission-clarity-20260807`. PRs target `agent/admarket-integrated-fixes-20260723`.
Plan of record: `docs/superpowers/plans/2026-08-07-mission-demonstration-stages.md`.

## Standing instruction — GodotIQ (Peter, 8 August 2026)

**Use GodotIQ to its full potential, all its pro tools, for everything.** Not as a linter that
gets run at the end — as the way the work is done. It found every real defect in this build and
none of them were visible to the four gates, to a screenshot, or to reading the files.

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

`mcp__godot__launch_editor` starts the editor; the live tools need it. The GodotIQ addon writes
the `GodotIQRuntime` autoload into `godot/project.godot` — **that file is never committed.**

Two operational notes:
- With the editor open, `npm run test:godot` prints `Failed to start WebSocket server on port
  6105` — the headless run cannot bind the port the editor holds. Tests still pass; it is stderr
  noise. Close the editor before the gate rather than debugging it.
- **Saving a scene from the editor renormalises the whole file** (uid stamps, `unique_id` on
  every node, `layout_mode` → `anchors_preset`) and can touch unrelated files. For a
  one-property change, revert and hand-apply the single line to keep the diff minimal.

## Verified false-positive classes — do NOT "fix" these

Checked 8 August against `dependency_graph` / `signal_map` / source. `validate(project)` reports
39 issues; 38 are noise.

| Rule | Count | Why it misfires |
|---|---|---|
| `no_type_hint` | 27 | Flags `:=` inferred declarations, which **are** statically typed. Misses them inconsistently: always at class level, and inside functions whose signature spans multiple lines. |
| `missing_null_check` | 5 | Keyword heuristic. `dependency_graph` reports `references_autoloads: []` for every flagged file; the only autoload is the addon's own. |
| `orphan_signal` | 6 | Panel signals are wired by a table-driven loop — `_panel.connect(signal_name, callback)` at `agency_mission_controller.gd:429`. The name is a variable, so no static pass resolves it. |
| `incomplete_node` (Plate) | 1 | By design: the demonstration engine assigns the plate texture at runtime from the mission record, because one engine serves several missions. |
| `signal_map` → `missing` | 11 | All engine built-ins (`pressed`, `item_selected`, `timeout`, `confirmed`) emitted manually in tests to simulate input. |
| `asset_registry` → unused | 9 of 13 | Salience sprites, `SalienceStage.tscn` and `Main.tscn` are referenced by **path string** in GDScript or `project.godot`, not by a scene. The registry only scans scenes. |

Converting the 27 `:=` declarations to explicit annotations would be a large meaning-free diff
that makes new code *less* consistent with the other 60 files.

## Done

- `a5310455` — shared agency button theme, so grey means unclickable.
- `831236eb` — Engine A, arrange-for-salience. Engine, measure and stage are separate files so
  engines B–G reuse `salience_measure.gd` without inheriting this stage's controls. The measure
  is real, not scripted: alpha-weighted area, nearest-neighbour clearance, CIE76 distance from
  the plate region behind the object. Assets are fal-generated pixel art, provenance in
  `godot/assets/agency/ASSET-SOURCES.md`.
- `cbc2b6d2` — size slider and five colour swatches raised to the 48px minimum target size
  (found by `ui_map`); agency HUD height moved from a direct `size.y` write to `offset_bottom`,
  which removed an anchor warning that had been firing on every HUD mount in the suite.

Engine A verified end-to-end through real input: click the orange → select; click a tint →
feedback updates; slider to 0.9 → `passed=true won=["size"]` with the correct win sentence.

## Next

1. **Engines B–G.** Same shape as A: a record-driven stage scene plus a measure module, wired
   through `show_demonstration`. Reuse `salience_measure.gd` where the lever maths applies.
2. **Terminology pass** across the twelve mission records.
3. **Remove `transferPrompt` / `TransferStage`** once every mission has a demonstration.

## Open, not actioned

- **21 controls below 48×48 across the rest of the game** — `ui_map` over the full running tree
  (306 controls, 57 interactive). Ten are 31px CheckBoxes, seven are 40–47px buttons,
  `FormatSelector`/`AnimationSelector` are 20px, `MasterVolume` is 8×16, `DirectTravel` is 40
  wide. Spun off as its own task: it spans ~8 scenes and each change can shift a layout, so it
  needs per-screen re-measurement. Note `ui_map`'s 48px threshold is Material guidance, stricter
  than WCAG 2.2 AA (24×24); about 17 of the 21 fail the 44×44 AAA bar.
- **Pixel-art filtering.** The fruit sprites are pixel art rendered with the project's Linear
  filter (`default_texture_filter=1`), which softens the blocks. `Nearest` per-node on the fruit
  would keep them crisp — but the plate is not pixel art, so this is an aesthetic call for
  Peter, not a project-wide setting change. I enabled mipmaps chasing this and reverted it: the
  render was byte-identical, because the blocks are the art, not undersampling.
- **Four unreferenced market assets** — `terrarium-master.png`, `cooler-master.png`,
  `bicycle-master.png`, `lamp-master.png` (143KB). No reference anywhere in `godot/`, not even a
  path string. Possibly staged for upcoming work; confirm with Peter before deleting.

## Gates

`npm run test:godot` · `npm run typecheck` · `npm run test:build-web` · `npm run test:unit` ·
`npm run build:web`. All green at `cbc2b6d2`.
