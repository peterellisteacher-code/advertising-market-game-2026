# Mission demonstration stages — handover, 8 August 2026

Branch `agent/mission-clarity-20260807`. PRs target `agent/admarket-integrated-fixes-20260723`.
Plan of record: `docs/superpowers/plans/2026-08-07-mission-demonstration-stages.md`.

**Read the plan of record first if you have not.** This document assumes it. That is where the
game, the twelve missions, the writing gate being replaced and the seven engines are described;
this one carries only what has been learned since.

**Vocabulary this document uses without stopping to define it.** *The pair* — two students at one
machine, which is how the game is played; the plan of record calls the same actor "the student".
*A mission record* — one entry in `REQUIRED_MISSION_RECORDS` or `SIDEQUEST_RECORDS` in
`godot/src/agency/agency_mission_catalog.gd`, a Dictionary carrying every string and number a
mission needs. *A demonstration stage* — the record-driven scene that replaces that mission's
writing gate, mounted by `agency_mission_panel.gd::show_demonstration` at line 174. *An engine* —
one stage scene plus one measure module, serving several missions from different records.

**Where the slice is:** Step 0, engine A (salience) and engine B (crop frame) are built, tested
and pushed. **Engine C, the colour wheel, is next, and it is blocked on an asset decision only
Peter can make** — see "Next". **Four engines remain after C — D, E, F and G.** (The plan of
record's heading says "Six engines cover twelve missions" while listing seven, A–G. Seven is what
it actually specifies; the heading is the error.) After the engines come the terminology pass and
the removal of the writing gate.

**How to read the claims below.** Numbers that came from a GodotIQ tool are marked as tool
output — re-run the tool, do not trust the figure. Everything else was checked against the
source on 8 August. An earlier version of this document opened by asserting that every claim
in it had survived adversarial verification. That warrant was false and has been removed: a
six-reviewer pass on 8 August found a shipped logic defect in the measure, and found four
false statements in this document. Treat it as notes, not as a certificate.

**A cold-read pass on 8 August refuted six more claims in the engine B material**, all now
repaired: the remaining-engine count, the lockup's generated size, the fal size bullet (which
described the shipped file as if it were a valid request), a `_connect_panel_signal` line number,
the "ASCII-sorted or the gate fails" claim, and the dirty-tree count. It also found that this
document never said how a new engine is *registered* — the one thing engine C cannot start without.
Five claims came back **unverifiable from the repo alone** and are marked where they appear: the
`godotiq_ping` response shape, the `validate`/`ui_map` figures, the GodotIQ bridge behaviours, and
the `sloganStart` (720, 460) / 805px figures, neither of which exists on disk. The pattern across
both passes is the same: the wrong claims were the confident ones with no artifact behind them.

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

**Preflight, concretely.** The GodotIQ config is at `godot/.godotiq.json` — **inside `godot/`, not
at the worktree root**, where looking first finds nothing and reads as "unwired". This root claims
port **6105** in the shared ledger `C:\Users\Peter Ellis\.agents-shared\godotiq-port-claims.json`.
Two calls before any Godot work, because no static check can prove either: `godotiq_ping` → pro
tier (14 tools silently degrade to a community stub otherwise), and `godotiq_editor_context` →
`addon_connected` must be `true`. If it is false, open the editor on this root with
`mcp__godot__launch_editor` and its `--path` pointing at
`...\agency-clarity-tuckability\godot`; a closed editor shows as
`Failed to connect to 127.0.0.1:6105: [WinError 1225]`. **The session-start hook tells you to
check `tier`; one `godotiq_ping` on 0.5.16 returned no `tier` key at all** — it reported
`"license": "pro"`, `"pro_bundle": "active"`, `tool_count: 38`. That is a single observation of a
response shape, not a documented contract: read whichever field is there, and do not conclude the
tier is unknowable because the named key is missing.

`mcp__godot__launch_editor` (the separate `godot` MCP server, not `godotiq`) starts the editor;
the live tools need it. The GodotIQ addon writes the `GodotIQRuntime` autoload into
`godot/project.godot:17-19` — **that file is tracked, and the addon's edit to it is never
committed.**

Operational notes, all measured on this branch:
- With the editor open, the Godot gate prints `Failed to start WebSocket server on port 6105` —
  the headless run cannot bind the port the editor holds. Tests still pass; it is stderr noise.
- **`ADMARKET_GODOT_TEST_SUITE` runs one suite alone** (`run_tests.gd:8`). Set it to a
  `res://tests/...` path and `test:godot` skips everything else. This is how you confirm a new
  test fails against the old code without waiting for the full suite.
- **`godotiq_file_ops op="write"` on a `.tscn` is refused** with `BLOCKED_EDITOR_OPEN` while the
  editor is running — correctly. Use `node_ops` + `save_scene`. `node_ops` additionally requires
  the target scene to be the *currently edited* one, or it returns `PREFLIGHT_FAILED`; switch with
  `exec(context="editor")` calling `EditorInterface.open_scene_from_path(...)`. Do **not**
  `save_scene()` first as the error text suggests, or you renormalise whatever was open before.
- **The key in a `node_ops` operation is `node`, not `path`.** `path` is accepted and arrives
  empty, giving `NODE_NOT_FOUND` on `""` for every operation in the batch. That one at least
  fails loudly — `all_verified: false` — but it costs a round trip.
- **A multi-patch `script_ops` call is atomic.** One search string that does not match returns
  `status: "PARTIAL"` and `written: false`, and *none* of the other patches are applied. Always
  read `written`, never `status`.
- **Saving a scene from the editor renormalises the whole file** (uid stamps, `unique_id` on
  every node, `layout_mode` → `anchors_preset`) and can touch unrelated files. Confirmed again on
  8 August: one `save_scene()` on `SalienceStage.tscn` also stamped a `uid=` into
  `src/agency/ui/agency_theme.tres` and added a trailing newline to
  `tests/agency_completion_runner.gd`. Both were reverted; expect them to come back on the next
  save and revert them again unless the change is yours. `SalienceStage.tscn` itself is now
  committed in canonical form, so it should stay a fixed point.
- **Indentation is mixed per file, in both trees.** Measured 8 August: `godot/src` is 11
  tab-dominant files to 23 space-dominant; `godot/tests` is 15 to 16. `salience_measure.gd`,
  `salience_stage.gd` and `agency_mission_catalog.gd` are spaces; `agency_mission_controller.gd`,
  `agency_world.gd` and `agency_hud.gd` are tabs. **Check the specific file before patching it.**
  `script_ops` patches are exact-match, and a mismatch returns `status:"OK"` with `written:null`
  rather than erroring — always confirm `written:true`.
- **Read layout in a *later* `exec` call than the one that mounts the scene.** Measured on engine
  B: an in-frame read put the slogan at screen y 69.875 where the settled value was 367.

## Carried out of engine B — every later engine hits these

Measured while building B, not inherited from A. Each one cost something.

- **A new stage's `.gd` *and* `.tscn` must be registered in `STUDENT_COPY_SOURCE_PATHS`**
  (`scripts/student-copy-corpus.mjs`) or `test:build-web` fails on
  `student-copy-source-coverage.test.mjs`. The pattern that claims a file is
  `GODOT_EMITTER_PATTERN` in that **test**, not in the corpus module —
  `/(?:^|\n)\s*(?:text|tooltip_text|placeholder_text)\s*=|\.text\s*=/`. Membership is all the
  test checks (`assert.deepEqual(candidates, [])`); the list is kept ASCII-sorted by convention,
  not by the gate. This is a separate registration from `run_tests.gd`, and engine B failed the
  gate on it.
- **Nearest, never a smoothing filter, for any variance-preserving downscale.** Every averaging
  filter is low-pass, and low-pass is exactly the operation that removes the quantity a variance
  measure reads. Measured on the shipped picture: Lanczos moved 72 of its 1200 cells from busy to
  plain and flipped five verdicts; `INTERPOLATE_NEAREST` disagreed with the full-resolution grid
  on 15 cells and flipped none. Any engine that classifies pixels inherits this.
- **Later siblings receive the pointer first**, and a `Panel` with `MOUSE_FILTER_STOP` grabs its
  whole rectangle, not just its border. In `CropStage.tscn`, `Slogan` sits after `Frame` under
  `Stage` on purpose; swapping them makes the slogan undraggable wherever the frame overlaps it,
  silently.
- **An authored geometry field must describe a rectangle the pair actually sees.** `sloganStart`
  was first written at (720, 460) on a 640-tall picture, so the stage clamped it on mount and the
  record described a position that never existed. Check every authored rectangle against the
  picture bounds *and* against the stage's own clamp.
- **The demonstration dialog fits 750px in the 800px window the game guarantees** — the dialog is
  centred with a 25px margin, so 800 is the wrong number to guard. Both suites now assert ≤760
  while the demonstration is the stage on show; A measures 750, B 715. Put the same assertion in
  the same place in C's panel test: right after the layout settles, and **before the test presses
  the check button**. Do not grep for `show_completed` to find that boundary — neither panel test
  calls it. Completion is triggered by `CheckButton.pressed.emit()`
  (`test_crop_measure.gd:490`, `test_salience_measure.gd:442`), which reaches the panel through
  the controller. The assertion must sit above that line.
- **`openai/gpt-image-2` through fal, `quality: "high"` — these constrain the REQUEST, not the
  file you ship.** Both dimensions multiples of 16, max edge 3840, aspect ≤ 3:1, total pixels
  655,360–8,294,400. Both crop assets were **generated large and resampled down once**, and the
  shipped lockup would be rejected as a request: the church was asked for at 2880×960 and shipped
  at 1920×640; the lockup was asked for at 1520×608 and shipped at 960×384, which is 368,640
  pixels — below the minimum above. `ASSET-SOURCES.md` records the generated size, the shipped
  size and the SHA-256 of each separately for exactly this reason.
  **Lanczos is the right filter for that resample and is not what the bullet above bans** — the
  ban is on smoothing inside a variance *measurement*, not on producing art.
- **A green Godot gate is not evidence your new assertions ran.** `test:godot` prints
  `Godot game, Creator bridge, and Market bridge tests passed` then `GODOT_TESTS_OK`, exit 0,
  whether the suites ran or matched nothing — proved by pointing `ADMARKET_GODOT_TEST_SUITE` at a
  path that does not exist. Negative-control every new or moved assertion: break the threshold it
  guards, confirm the suite fails naming that specific file, revert, re-run. Choose the broken
  value so it separates the case you care about — moving the dialog-height assertion was proved
  at 720px, because the old position read 700 and passed while the new one reads 750 and fails.

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
| `orphan_signal` | The six panel signals are connected through a helper taking the name as a parameter — `_connect_panel_signal(signal_name: StringName, callback: Callable)` defined at `agency_mission_controller.gd:442`, called six times from `_connect_panel()` (line 422) at lines 425-430. Because the name is a variable at the `connect` call site, no static pass resolves it. The panel's seventh signal, `role_handoff_requested`, is wired statically at `agency_world.gd:371` and is correctly not reported. **`arrangement_submitted` (`salience_stage.gd:11`) is a second instance of the same class**, verified 8 August: it is connected at `agency_mission_panel.gd:241-242` by string literal on a dynamically-typed `_demonstration_view`, which no static pass resolves. Every engine B–G stage will report the same way. Verify a new one before dismissing it — a dead signal is the one real defect this rule has ever caught here. |
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
  - **isolation** — as shipped in `831236eb`, the distance to the nearest neighbour's bounding
    box over the stage diagonal. **As the code stands today it also takes the stage edge,
    whichever is closer** — but that term was added later, in `2911598e`, so do not bisect
    against this bullet;
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

- `3ce0f8ea` — **Step 0: open items 1–6, the ones that would have been cloned into every
  later engine, plus item 19.** Each carries a regression test confirmed to fail against
  the old code first, by running the suite alone between fixes. In `salience_measure.gd`
  unless noted:
  - **1.** `_sole_leader` returns `""` when fewer than two objects are scored. Measured
    before the fix: a lone object returned `passed: true` with `wonLevers`
    `size,isolation,contrast`.
  - **2.** `LEAD_EPSILON` is now a Dictionary keyed by lever — `0.0005` for the
    normalised size and isolation levers, `2.3` (the CIE76 just-noticeable difference)
    for raw contrast. A lever with **no** declared tolerance names no leader, rather than
    silently inheriting the normalised figure. Measured before the fix: contrasts of
    89.06 and 88.43 — a 0.63 ΔE gap — named a leader.
  - **3.** `_surround_contrast` iterates neighbours **topmost first**
    (`range(size - 1, -1, -1)`), because views are added in record order so the last
    entry draws on top. The contested ring area now goes to the neighbour actually
    visible there.
  - **4.** `salience_stage.gd` has `DEFAULT_STAGE_SIZE := Vector2(880, 320)`, matching the
    scene, used in both the declaration and the `configure` fallback.
  - **5.** `_surround_contrast` returns `0.0` when `_has_plate_grid` is false, so a
    mistyped plate path kills the lever instead of ranking objects by distance from
    white; `salience_stage.gd::configure` pushes a warning when the plate texture fails
    to load.
  - **6.** `ReadoutRow` is now `unique_name_in_owner` and **empty** in the scene;
    `_build_readout()` builds one column per `Measure.LEVERS` entry, titled from the
    record's `leverPhrases`. `describe`'s fallback sentence goes through a new
    `_lever_list()`. The three authored bar/label groups are gone.
  - **19.** The file header no longer describes isolation as the distance to the nearest
    neighbour, and no longer claims all three levers are normalised.

- `0a05e848` — **Engine B, crop frame.** Serves `framing` and `crop-lab`. Same three-file shape as
  A — `crop_measure.gd` (`extends RefCounted`, static only, no reference to the stage),
  `crop_stage.gd`, `CropStage.tscn` — and it shares no maths with `salience_measure.gd`. The pair
  crops a deliberately over-wide picture and drags the advertisement's slogan into place. Four
  checks decide it, each in its own units and each naming one thing to change:

  | Check | What it reads | Units |
  |---|---|---|
  | `subject` | the frame contains the bottle | image pixels: 0 while contained, negative by however far the worst side cuts in |
  | `prominence` | the bottle's share of the frame | share |
  | `messageInFrame` | the slogan lies inside the frame | image pixels, same convention as `subject` |
  | `messageClear` | the slogan sits on plain pixels | share, weighted by each cell's overlap with the slogan |

  The last two replace an auto-placed headline and a `largest_plain_rect` search that existed in
  the working draft and never reached a commit — do not go looking for it in the history. Because
  the pair positions the slogan themselves, the measure reads the picture's own pixels under
  *their* choice instead of reporting a status word about space nobody had to use. Nothing authors
  a correct rectangle: `test_crop_measure.gd` shows five structurally different arrangements
  passing, which no stored answer could allow, and holds the record's geometry against the shipped
  file.
- `f2713da6` — **the slogan lockup baked as one piece of art.** It had been a generated roundel
  plus two Godot `Label`s; the project ships no font files at all, so those Labels fell back to
  the default face and lost the heavy condensed wordmark the parody depends on. Roundel, wordmark
  and strapline are now generated together at 960×384, drawn at 222×88 through one `SloganArt`
  `TextureRect` at `KEEP_ASPECT_CENTERED` so it can never be stretched.
  `test_crop_measure.gd` asserts the art's aspect matches the record's `sloganSize` — at 2.5:1
  either mismatch would show, as letterboxing or as distortion.
- `2824427c` — **both demonstration suites now measure the dialog while it is on show.** Engine
  A's height assertion sat at the end of its panel test, after the completed stage had replaced
  the demonstration, so it was reading the wrong layout. See the height bullet above for the
  numbers and the exact position. **Engine A is not overflowing** — measured 750 in the running
  game on 8 August. The work was started from an 805px figure carried in from an earlier session;
  **that number appears nowhere in this repo and should be treated as wrong or stale, not as
  history.** The salience plate was regenerated to 1760×640 the same day and that plausibly
  shortened the dialog, but `ASSET-SOURCES.md:255-258` gives a different stated reason — a 2:1
  plate "filled little more than half the available width", so it was regenerated at 2.75:1 to
  fill the dialog at full scale. Do not repeat the causal claim; only the 750 is measured. The
  test-ordering flaw was real and is fixed.

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

**Items 1–6 — ALL FIXED in `3ce0f8ea`.** Numbers kept so they are not reused; see the
`3ce0f8ea` bullet under Done for what each fix actually was. Nothing to do here.

**Interaction and accessibility**

7. **Transparent pixels form opaque hit boxes.** Every object is a rectangular `TextureRect` with
   `MOUSE_FILTER_STOP` and no alpha hit-testing, and the opening arrangement overlaps. Clicking
   what is visibly the orange can select the apple whose box is above it in draw order.
8. **WITHDRAWN — `focus_target()` is called, and this was never a defect.** Three panel reviewers
   reported it as dead code because the caller sits outside the source bundle they were given:
   `agency_mission_panel.gd:182-183` calls it with `call_deferred` on the demonstration mount
   path. **Do not "fix" it** — adding a call in `_ready` or `configure` would give every mount a
   second redundant `grab_focus`. Kept here rather than deleted so the number is not reused.
9. **`focus_entered.connect(_select.bind(id))`** means tabbing through the objects reassigns the
   selection, so a keyboard user aiming for the slider changes which fruit the controls act on.
10. **Keyboard control is undiscoverable — engine A only.** Arrow-key nudging with Shift for
    coarse steps exists, but neither the salience record's instruction nor the scene text mentions
    keys at all. **Engine B already fixed this for itself**: its record says so at
    `agency_mission_catalog.gd:97`. Do not "fix" B here; copy B's sentence into A.
11. **Touch is unhandled.** Only `InputEventMouseButton`/`MouseMotion`/`Key` are inspected, so
    dragging does not work on a touchscreen or interactive whiteboard. The native controls do.
    **Engine B has the same gap** — checked 8 August, there is no `InputEventScreen*` anywhere
    under `godot/src/agency/missions/demonstrations/`. Every drag engine will clone it unless it
    is fixed once, and B's slogan and frame are *both* drag-only. This is now the largest single
    accessibility item in the slice.
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
    nudging, edge clamping, the tint swatches, `show_error`, or a win by isolation or contrast
    through the stage. A disconnected swatch or a sign error in the drag maths would leave the
    suite green. (`reset_arrangement` **is** covered, through `configure`, by
    `_a_missing_sprite_does_not_shift_the_others` — do not rewrite that one.) **Still open after
    `3ce0f8ea`**, which added six measure-level tests and two more stage-level ones
    (`_a_record_without_a_stage_size_falls_back_to_the_scene`,
    `_the_readout_and_the_sentence_come_from_the_record`) but drove no new *input*. Dragging,
    keyboard nudging, edge clamping, the swatches and `show_error` remain unexercised.
16. **`test_salience_measure.gd` asserts an algebraic identity** — `baseArea == coverage * w * h`
    holds by construction for any input, so it cannot fail.
17. **`test_agency_guidance.gd:162` asserts `hud.size.x <= hud.custom_minimum_size.x`**, which is
    backwards for a minimum, and line 178 checks a child against the minimum rather than the
    actual width. Neither constrains what its comment implies.
18. **The suite is `assert`-only.** Under a release export template assertions are stripped and
    `run()` returns `true` unconditionally. Fine while the gate runs a debug binary — which is
    nowhere recorded.

**Comments that overstate the code**

19. **FIXED in `3ce0f8ea`.** The header claimed all three levers were "each normalised across the
    objects in the scene" and still described isolation as "distance to the nearest neighbour's
    bounding box", stale since `2911598e` added the stage edge. It now describes what the code
    does, and says only the `*Share` fields are normalised.
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

**From engine B**

23. **`crop/preppy-max-lockup.png` is NOT cleared for public release.** It is the one asset in the
    project that deliberately reads against a real brand, and `ASSET-SOURCES.md` records it as
    approved for classroom use behind the password gate only, with what would have to change to
    clear it. Anything that widens this build's audience deals with that file first. Not a bug —
    a standing condition on the slice.
24. **The lockup's words left the student-copy corpus when they became art.** `PREPPY MAX` and
    `LIVE LIFE TO THE MAX` are baked into the PNG, so they are invisible to `/plain-language`,
    `/claude-scrubber` and `student-copy-professional-contract.test.mjs`. That was the price of
    getting the condensed wordmark without a font file. If a condensed face is ever added to the
    project, the honest move is to set them as text again.
25. **Nothing in this slice is recorded as having Peter's eyes-on approval.** He settled engine
    B's *concept* in conversation, but no session record shows him looking at a rendered asset or
    a running stage and saying so. `ASSET-SOURCES.md` carries provenance and the reasoning behind
    each selection — that is not a sign-off. Treat every asset as awaiting his review.

## Next

**Step 0, engine A and engine B are all done. Start at engine C.**

1. **Engine C — colour wheel.** Serves `contrast` and `colour-clinic`. A raster colour wheel; the
   pair picks the accent hue for one named element while the rest of the palette stays fixed. It
   passes when the chosen hue is far enough around the wheel from the base hue **and** only one
   element carries it. Same three-file shape as A and B, wired through `show_demonstration`
   (`agency_mission_panel.gd:174`), and it shares no maths with either — write `colour_measure.gd`
   as its own `extends RefCounted` module of static functions. Copy the *discipline*, not the
   code: no authored answer, a pass that falls out of the measure, a per-check tolerance in that
   check's own units (hue separation is degrees; "only one element carries it" is a count, so its
   tolerance is not a float at all), and no check list hardcoded into the scene. Read the
   "Carried out of engine B" section above before starting — most of it is things C hits on its
   first day.

   **How an engine is registered — four places, and only two of them are tests.** Engine C is not
   mounted by anything until you do the first two:

   | Where | What to add |
   |---|---|
   | `agency_mission_catalog.gd` | a `COLOUR_DEMONSTRATION := { … }` const beside `SALIENCE_DEMONSTRATION` (line 8) and `CROP_DEMONSTRATION` (line 84), carrying a `"scene"` path to `ColourStage.tscn` |
   | `agency_mission_catalog.gd` | `"demonstration": COLOUR_DEMONSTRATION` inside the `contrast` record (pattern at line 326) and the `colour-clinic` record (pattern at line 514) |
   | `godot/tests/run_tests.gd` | `"res://tests/test_colour_measure.gd"` — in **both** lists, as `test_crop_measure.gd` is at lines 22 and 49 |
   | `scripts/student-copy-corpus.mjs` | the new `.gd` and `.tscn` in `STUDENT_COPY_SOURCE_PATHS` |

   **The record's field contract is not documented anywhere — read `CROP_DEMONSTRATION`
   (`agency_mission_catalog.gd:84-140`) and copy its shape.** Note that the two existing engines
   already disagree on key names: A titles its readout from `leverPhrases` (line 61), B from
   `checkPhrases` (line 118). Pick one and say why in the commit rather than inventing a third. B
   additionally authors `unmetSentences` (one fix each), `wonSentences`, `evidenceSentences`,
   `subjectPhrase` and its per-check thresholds — `evidenceSentences` is not optional, because
   `missionEvidence` feeds the writer's statement and the pitch theatre.

   **The asset is not settled, and needs Peter before anything is generated.** The plan of record
   specifies only "a raster colour wheel asset" and the pass rule. It does not say what the pair
   is recolouring — and *that is a second asset*, since "only one element carries the accent"
   presupposes a piece of work with several elements. Raising both is this document's reading, not
   the plan's instruction; put it to Peter as a question rather than assuming it. Peter has ruled
   out one option already: **do not reuse the Pinterest colour wheel he linked**, which he flagged
   as too low quality — an example of the kind of thing, not the asset. Engine B's subject took
   three rounds of clarification before generation was worth paying for, and the version that
   shipped was nothing like the first proposal. Ask, then generate.
2. **Terminology pass** across the twelve mission records — `REQUIRED_MISSION_RECORDS` (7) plus
   `SIDEQUEST_RECORDS` (5) in `agency_mission_catalog.gd`. **This is a deliberate departure from
   the plan of record's build order**, which puts the terminology pass at step 3, before engines
   B–G. It moved after the engines because each engine rewrites its own missions' copy as it
   lands, and passing over records that are about to change twice is wasted work. If you disagree,
   that is a decision to take to Peter — not a discrepancy to silently repair.
3. **Remove `transferPrompt` / `TransferStage`** once every mission has a demonstration. Present in
   `agency_mission_catalog.gd`, `AgencyMissionPanel.tscn`, `agency_mission_panel.gd`,
   `test_agency_missions.gd`, `test_agency_mission_catalog.gd`, `test_agency_world.gd`.

## Gates

This is a **pnpm** workspace — `package.json` declares `packageManager: pnpm@11.7.0` and
`CONTRIBUTING.md` specifies `corepack enable` then `pnpm install --frozen-lockfile`. Never run
`npm install` here. Bare `pnpm` is **not on PATH** on this machine; `corepack --version` is 0.35.0
and `corepack pnpm --version` is 11.7.0. The five gate scripts are defined in `package.json`.
(An earlier version of this document said to "invoke the gates as `AGENTS.md` does" — `AGENTS.md`
carries one command, `corepack pnpm run verify:repo-sync --expect-local-head`, which is a
repo-publication check and not a gate. Only the `corepack pnpm run` invocation form came from
there.)

```
corepack pnpm run test:godot
corepack pnpm run typecheck
corepack pnpm run test:build-web
corepack pnpm run test:unit
corepack pnpm run build:web
```

All five were run end to end and green at `2824427c` on 8 August: `test:godot` `GODOT_TESTS_OK`,
`typecheck` clean, `test:unit` 2468 tests passed, `test:build-web` 0 failures, `build:web`
`WEB_EXPORT_STATIC_VERIFICATION_OK`. The tree was dirty only by the expected files below.

`test:godot` prints a stack trace through `test_salience_measure.gd:246` and still passes. That is
Godot echoing a `push_warning`, not an error: `_a_missing_sprite_does_not_shift_the_others`
(line 229) deliberately points one sprite at `no-such-sprite.png`, which fires
`salience_stage.gd:131`. `2911598e` made a failed sprite load warn instead of going quiet and this
test is what exercises it. Do not suppress it — the trace disappearing means the warning stopped
firing.

The binary the Godot gate runs is resolved by `resolveGodotExecutable`, exported from
`scripts/export-godot-web.mjs` and called at `scripts/run-godot-tests.mjs:100`. Open item 18 makes
"the gate runs a debug binary is nowhere recorded" a finding — that is where to record it.

**A new test file is not run until you register it — in two places.** `godot/tests/run_tests.gd`
lists the suites explicitly (four `test_*.gd` on disk are never referenced by it:
`test_agency_audio_manager.gd`, `test_agency_campaign_controller.gd`,
`test_campaign_image_decoder.gd`, `test_pitch_theatre.gd`). Separately, the new stage's `.gd` and
`.tscn` go in `STUDENT_COPY_SOURCE_PATHS` in `scripts/student-copy-corpus.mjs`. Miss the first and
a green gate means nothing about your suite; miss the second and `test:build-web` fails. Engine B's
entries — `test_crop_measure.gd`, `CropStage.tscn`, `crop_stage.gd` — are the worked example.

**Before committing, check what is dirty.** `git status` on a clean checkout of this branch is
**not empty**, and three of the entries must never be staged:
- **`godot/project.godot`** — tracked, and the GodotIQ addon writes its `GodotIQRuntime` autoload
  into it (lines 17-19). **Never commit this file.**
- The six `.png.import` files under `godot/assets/agency/salience/` show as modified with an
  **empty content diff** — LF/CRLF normalisation, not a change. `git diff --stat` is the check:
  they carry no content change.
- **`.claude/`** is untracked and stays that way.

Anything else you see is your own work. Stage by name, never `git add .` or `-A` — that rule
exists precisely because the three entries above sit in the way.

## Branch state

`agent/mission-clarity-20260807` is pushed and current at `2824427c`. **No PR is open, and that
is deliberate.**

**Everything below was settled by Peter on 8 August. None of it is open; do not re-ask.**

- **Engine A lands together with engines B–G**, in one PR when the demonstration slice is
  finished. The branch stays open until then.
- **The isolation lever keeps counting the stage edge as "space around it"** (as changed in
  `2911598e`). The win sentence stands as written and
  `test_salience_measure.gd::_a_corner_is_not_open_space` holds the property. Neither decision
  required a code change.
- **Engine B's picture is a Preppy MAX parody, and its specifics are his.** A boring day at
  church, over the shoulder of a kid holding a bottle; *within the outline of the bottle* is a
  party that lines up with the nave behind it, with a DJ where the pastor stands. **The bottle
  carries no branding whatsoever** — it is only an outline, and asking for branding on it is
  asking for the thing he ruled out. The Pepsi-Max-mirroring identity lives entirely in the
  slogan lockup, which is why that file is the one flagged for public release. The picture is
  deliberately over-wide so the pair has to frame it, and the slogan is draggable so they have to
  place it. The earlier planning-board image was deleted on his instruction and is not coming
  back.
