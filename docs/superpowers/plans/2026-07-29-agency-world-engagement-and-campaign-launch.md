# Agency World Engagement and Campaign Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the panel-led pitch wrapper with a clear, explorable advertising agency in which pairs practise advertising techniques, apply them in the existing creator, and present their exact finished advertisement in an animated pitch theatre.

**Architecture:** Keep the existing creator, campaign document, account isolation, practice/live persistence and market contracts. Add focused Godot modules for agency progress, mission data, navigation, guidance, audio and presentation; `main.gd` remains the integration coordinator and does not absorb the new gameplay logic. Persist the new agency state inside `pitch-run@2`, with an atomic migration from `pitch-run@1`.

**Tech Stack:** Godot 4.7 GDScript and `.tscn` scenes, GodotIQ v0.5.15 live editor tools, TypeScript/Vitest, Node contract tests, Vite, Netlify, Supabase-backed existing APIs.

## Global Constraints

- Work only in `C:\tmp\admarket-integrated-fixes-20260723` on `agent/admarket-integrated-fixes-20260723`.
- Do not discard the authorised GodotIQ addon, rules or editor-bridge changes already present.
- Do not launch a Windows Godot executable directly; use the connected GodotIQ editor and verified web exports.
- Before every `.gd`, `.tscn` or `.tres` mutation, inspect the current GodotIQ tool schema and call `godotiq_file_context`; call it again after the mutation.
- For cross-file signatures, call `godotiq_impact_check` and, when signals change, `godotiq_signal_map`.
- Use `godotiq_script_ops` for GDScript, `godotiq_build_scene` or `godotiq_node_ops` for scenes, and `godotiq_save_scene` after successful live edits.
- If the bridge disconnects, stop Godot mutation and re-establish `LIVE_EDITOR_READY` before continuing.
- Preserve the exact existing creator publication contract `published-campaign@1` and its 1600 × 900 PNG.
- Preserve the outer persistence contract `live-run-progress@1`; only the nested pitch snapshot advances to `pitch-run@2`.
- Preserve student, teacher and teacher-playtest account/storage isolation.
- The acceptance environment is a recent student MacBook on school wifi, normally Safari.
- The reference viewports are exactly 1280 × 800 and 1440 × 900.
- Every mandatory destination has keyboard movement and a direct-travel equivalent.
- Audio is optional, muteable and nonessential; substantial reading ducks or stops it.
- Reduced motion replaces movement effects with an immediate static equivalent.
- Student-facing copy uses factual professional academic English, not slang or classroom-assignment framing.
- Original or sourced assets carry licence and provenance records; teaching-source advertisements are references only and do not enter the public repository.

---

### Task 1: Agency progress model and save migration

**Files:**
- Create: `godot/src/agency/agency_progress.gd`
- Create: `godot/tests/test_agency_progress.gd`
- Modify: `godot/src/game/game_run.gd`
- Modify: `godot/tests/test_game_run.gd`
- Modify: `godot/tests/run_tests.gd`

**Interfaces:**
- Consumes: existing `AdMarketGameRun.phase`, identity fields and ordered ready levels.
- Produces: `AdMarketAgencyProgress.begin()`, `travel_to(station_id)`, `complete_mission(mission_id, evidence)`, `complete_sidequest(sidequest_id)`, `handoff_to(role)`, `snapshot()`, `restore_snapshot(value)`, and `from_legacy_pitch(phase, ready_levels)`.
- Produces: `AdMarketGameRun.pitch_snapshot()` with `contract == "pitch-run@2"` and an `agency` dictionary.
- Produces: `AdMarketGameRun.restore_pitch_snapshot(value)` accepting strict `pitch-run@2` and migrating strict `pitch-run@1` atomically.

- [ ] **Step 1: Establish GodotIQ edit context**

Call `godotiq_file_context` for `res://src/game/game_run.gd`, `res://tests/test_game_run.gd` and `res://tests/run_tests.gd`, then call `godotiq_impact_check` for the `pitch_snapshot` and `restore_pitch_snapshot` signature-preserving contract change.

- [ ] **Step 2: Write the failing agency-state tests**

Create `test_agency_progress.gd` with these assertions:

```gdscript
extends RefCounted
class_name AdMarketTestAgencyProgress

const AgencyProgress = preload("res://src/agency/agency_progress.gd")

func run() -> bool:
    var progress := AgencyProgress.new()
    assert(progress.begin())
    assert(progress.current_objective_id == "meet-client")
    assert(progress.travel_to("strategy-room"))
    assert(progress.handoff_to("strategist"))
    assert(progress.complete_mission("audience-brief", {
        "decision": "independence",
        "effect": "The offer supports the audience's wish to control the hour after school."
    }))
    var snapshot: Dictionary = progress.snapshot()
    assert(snapshot.get("contract") == "agency-run@1")

    var restored := AgencyProgress.new()
    assert(restored.restore_snapshot(snapshot))
    assert(restored.snapshot() == snapshot)

    var before: Dictionary = restored.snapshot()
    var invalid := snapshot.duplicate(true)
    invalid["activeRole"] = "chief-disruption-officer"
    assert(not restored.restore_snapshot(invalid))
    assert(restored.snapshot() == before)

    var legacy := AgencyProgress.from_legacy_pitch("sell", ["invent"])
    assert(legacy.get("currentObjectiveId") == "shape-message")
    assert(legacy.get("completedMissionIds").has("audience-brief"))
    return true
```

Register `res://tests/test_agency_progress.gd` immediately before `test_game_run.gd` in `run_tests.gd`.

- [ ] **Step 3: Run the new suite and record the expected failure**

Use the connected GodotIQ execution surface to load `res://tests/test_agency_progress.gd` and call `run()`.

Expected: failure because `res://src/agency/agency_progress.gd` does not exist.

- [ ] **Step 4: Implement the strict agency model**

Create `agency_progress.gd` with:

```gdscript
extends RefCounted
class_name AdMarketAgencyProgress

const CONTRACT := "agency-run@1"
const ROLES := ["art-director", "strategist"]
const STATIONS := [
    "reception", "client-briefing", "strategy-room", "art-studio",
    "copy-room", "production-studio", "media-desk", "sound-booth",
    "pitch-theatre"
]
const REQUIRED_MISSIONS := [
    "audience-brief", "salience", "reading-path",
    "contrast", "framing", "aida", "claim-proof"
]
const SIDEQUESTS := [
    "thirty-second-rescue", "colour-clinic", "crop-lab",
    "headline-surgery", "media-match"
]

var current_objective_id := "meet-client"
var current_station_id := "reception"
var active_role := "art-director"
var completed_mission_ids: Array[String] = []
var completed_sidequest_ids: Array[String] = []
var evidence_by_mission: Dictionary = {}
var handoff_count := 0
var guide_tucked := false
var started := false
var last_error := ""
```

Implement strict key-count, type, enum, ordered-string-array, evidence-length and maximum encoded-size checks. `restore_snapshot()` builds validated local variables first and mutates fields only after every check succeeds. Limit each evidence string to 400 characters and the encoded snapshot to 16,384 UTF-8 bytes.

`from_legacy_pitch()` returns an `agency-run@1` snapshot with:

```gdscript
{
    "lobby": "meet-client",
    "invent": "build-product",
    "sell": "shape-message",
    "irresistible": "polish-campaign",
    "publish-check": "prepare-pitch"
}
```

and marks prerequisite mission IDs complete without fabricating written evidence.

- [ ] **Step 5: Upgrade `AdMarketGameRun` without changing callers**

Preload `agency_progress.gd`, add `_agency_progress`, and expose:

```gdscript
func agency_progress() -> RefCounted:
    return _agency_progress
```

Emit:

```gdscript
{
    "contract": "pitch-run@2",
    "phase": phase,
    "teamAlias": team_alias,
    "sessionId": session_id,
    "teamId": team_id,
    "readyLevels": ready_levels,
    "agency": _agency_progress.snapshot()
}
```

For `pitch-run@1`, preserve the existing six-key validator, derive the agency snapshot with `from_legacy_pitch()`, then commit both restored states together. For `pitch-run@2`, require exactly seven keys and restore a temporary agency model before mutating the run.

- [ ] **Step 6: Extend the game-run tests**

Change the existing snapshot expectation to `pitch-run@2`, assert its nested agency contract, then add:

```gdscript
func _legacy_pitch_snapshot_migrates_atomically() -> bool:
    var game := GameRun.new()
    assert(game.restore_pitch_snapshot({
        "contract": "pitch-run@1",
        "phase": "sell",
        "teamAlias": "Signal Foxes",
        "sessionId": "session-7",
        "teamId": "team-7",
        "readyLevels": ["invent"]
    }))
    assert(game.pitch_snapshot().get("contract") == "pitch-run@2")
    assert(
        Dictionary(game.pitch_snapshot().get("agency")).get("currentObjectiveId")
        == "shape-message"
    )
    return true
```

Add an invalid nested-agency case to the existing atomic rejection test.

- [ ] **Step 7: Run focused checks**

Use GodotIQ to:

1. run `test_agency_progress.gd`;
2. run `test_game_run.gd`;
3. call `godotiq_check_errors`;
4. call `godotiq_validate` for the three changed scripts; and
5. call `godotiq_file_context` after each edit.

Expected: both suites return `true`; no parse errors; no new convention notices.

- [ ] **Step 8: Commit**

```powershell
git add -- godot/src/agency/agency_progress.gd godot/src/game/game_run.gd godot/tests/test_agency_progress.gd godot/tests/test_game_run.gd godot/tests/run_tests.gd
git commit -m "feat(game): persist agency campaign progress"
```

### Task 2: Mission and objective catalogue

**Files:**
- Create: `godot/src/agency/agency_mission_catalog.gd`
- Create: `godot/tests/test_agency_mission_catalog.gd`
- Modify: `godot/tests/run_tests.gd`

**Interfaces:**
- Consumes: mission IDs and sidequest IDs from `AdMarketAgencyProgress`.
- Produces: `AdMarketAgencyMissionCatalog.mission(id)`, `sidequest(id)`, `required_missions()`, `sidequests()`, `objective(id)` and `evaluate_choice(mission_id, choice_id)`.
- Every mission record contains `id`, `stationId`, `ownerRole`, `title`, `goal`, `instruction`, `holdingAction`, `choices`, `correctChoiceId`, `effectExplanation`, `transferPrompt` and `reward`.

- [ ] **Step 1: Write the failing catalogue contract**

Create `test_agency_mission_catalog.gd`:

```gdscript
extends RefCounted
class_name AdMarketTestAgencyMissionCatalog

const Catalog = preload("res://src/agency/agency_mission_catalog.gd")

func run() -> bool:
    var missions: Array = Catalog.required_missions()
    assert(missions.size() == 7)
    assert(missions.map(func(item): return item.get("id")) == [
        "audience-brief", "salience", "reading-path",
        "contrast", "framing", "aida", "claim-proof"
    ])
    for mission in missions:
        assert(["art-director", "strategist"].has(mission.get("ownerRole")))
        assert(String(mission.get("goal")).length() > 20)
        assert(String(mission.get("instruction")).length() > 20)
        assert(String(mission.get("holdingAction")).length() > 20)
        assert(String(mission.get("effectExplanation")).contains("audience"))
        assert(Array(mission.get("choices")).size() == 4)
        assert(not String(mission.get("correctChoiceId")).is_empty())
        assert(not String(mission.get("transferPrompt")).is_empty())

    assert(Catalog.sidequests().size() == 5)
    assert(Catalog.evaluate_choice("salience", "largest-contrast") == {
        "correct": true,
        "effect": "The strongest size and colour contrast directs the audience's attention to the product first."
    })
    assert(not bool(Catalog.evaluate_choice("salience", "small-logo").get("correct")))
    return true
```

- [ ] **Step 2: Run and observe failure**

Use GodotIQ to run the suite.

Expected: missing `agency_mission_catalog.gd`.

- [ ] **Step 3: Implement the complete catalogue**

Create seven mandatory records whose decisions practise:

1. identifying situation, need and values from the audience brief;
2. salience through size, isolation and colour contrast;
3. reading path through leading lines and placement;
4. colour contrast and harmony for emphasis and tone;
5. crop and framing for audience attention;
6. ordering Attention, Interest, Desire and Action; and
7. distinguishing supportable proof from vague or absolute claims.

Create five optional records:

1. rescue a crowded advertisement in thirty seconds;
2. repair a colour hierarchy;
3. choose the strongest crop;
4. shorten a weak headline while preserving meaning; and
5. match billboard, magazine or vertical screen to an audience situation.

Every wrong choice returns a factual effect explanation and allows another attempt; it never subtracts points.

- [ ] **Step 4: Run focused checks**

Run the new suite, `godotiq_validate` and `godotiq_check_errors`.

Expected: the suite returns `true`; all seven required missions and five sidequests satisfy the fixed schema.

- [ ] **Step 5: Commit**

```powershell
git add -- godot/src/agency/agency_mission_catalog.gd godot/tests/test_agency_mission_catalog.gd godot/tests/run_tests.gd
git commit -m "feat(game): define advertising technique missions"
```

### Task 3: Bespoke agency visual family

**Files:**
- Create: `godot/assets/agency/agency-floor.png`
- Create: `godot/assets/agency/agency-pair.png`
- Create: `godot/assets/agency/pitch-devices.png`
- Create: `godot/assets/agency/interaction-icons.png`
- Create: `godot/assets/agency/ASSET-SOURCES.md`

**Interfaces:**
- Consumes: approved visual targets under `docs/superpowers/specs/assets/`.
- Produces: original, public-safe PNG assets with no trademarks, branded advertisements, text labels or embedded UI controls.

- [ ] **Step 1: Generate the agency floor**

Use the built-in image generation tool with:

```text
Create a polished high-resolution top-down 2D pixel-art advertising agency floor for a classroom browser game. Exact 16:9 composition, no interface, no text, no letters, no people and no logos. Modern editorial/Bauhaus interior in deep navy, warm cream, teal, coral, mustard and cobalt. Clearly separated but connected rooms: reception and client briefing, strategy room with planning wall, art studio with drawing tables and colour materials, copy room with type specimens, production studio with large monitors, media desk, sound booth with mixer and speakers, and a dramatic pitch theatre. Wide walkable corridors, obvious door openings, uncluttered central routes, rich props around room edges, even lighting, crisp pixel edges, coherent scale, orthographic top-down view. Make interaction positions visually readable and preserve empty floor around each workstation.
```

Save the selected original as `agency-floor.png` without resizing it through an image editor.

- [ ] **Step 2: Generate the pair avatars**

Use:

```text
Create one transparent PNG sprite sheet for a modern classroom advertising game, crisp high-resolution pixel art. Two distinct teenage agency interns, one wearing teal with coral details and one wearing mustard with navy details. Four columns per character: front idle, back idle, left idle, right idle. Two rows of four, perfectly aligned equal cells, generous transparent padding, identical scale, no text, no logos, no shadows cut off. Friendly, professional, visually distinct silhouettes, suitable for a top-down office game.
```

Save as `agency-pair.png`. If image generation does not produce a clean eight-cell sheet, regenerate or edit with image generation; do not silently ship a malformed sheet.

- [ ] **Step 3: Generate pitch-device and interaction art**

Generate:

- transparent billboard, open magazine and vertical digital-screen frames in one coherent sheet; and
- transparent icons for objective, interaction, Art Director, Strategist, evidence, sound and direct travel.

Use the same palette and pixel density as the agency floor. Exclude text and trademarks.

- [ ] **Step 4: Record provenance**

`ASSET-SOURCES.md` names each file, generation date, tool, exact prompt, human selection decision, and public-use decision. It also states that branded teaching advertisements were not copied.

- [ ] **Step 5: Inspect imports and visuals**

Call `godotiq_asset_registry`, then inspect each imported texture through GodotIQ. Confirm transparent assets retain alpha, the floor has a 16:9 aspect ratio, and no asset contains unintended text or a recognisable brand.

- [ ] **Step 6: Commit**

```powershell
git add -- godot/assets/agency
git commit -m "art(game): add bespoke advertising agency visuals"
```

### Task 4: Explorable agency world, stations and role handoff

**Files:**
- Create: `godot/src/agency/player/agency_pair.gd`
- Create: `godot/src/agency/player/AgencyPair.tscn`
- Create: `godot/src/agency/stations/agency_station.gd`
- Create: `godot/src/agency/stations/AgencyStation.tscn`
- Create: `godot/src/agency/agency_world.gd`
- Create: `godot/src/agency/AgencyWorld.tscn`
- Create: `godot/tests/test_agency_world.gd`
- Modify: `godot/tests/run_tests.gd`

**Interfaces:**
- Consumes: `AdMarketAgencyProgress`, mission catalogue station IDs and agency textures.
- Produces: signals `station_requested(station_id)`, `role_handoff_requested(role)`, `guide_requested()`.
- Produces: `configure(progress)`, `set_input_enabled(enabled)`, `direct_travel(station_id)`, `current_station_id()`, `objective_station_id()`.
- `AgencyPair.move_vector` accepts keyboard input but remains bounded to the authored walkable polygon.

- [ ] **Step 1: Write the failing world seam test**

Create `test_agency_world.gd`:

```gdscript
extends RefCounted
class_name AdMarketTestAgencyWorld

const WorldScene = preload("res://src/agency/AgencyWorld.tscn")
const AgencyProgress = preload("res://src/agency/agency_progress.gd")

func run() -> bool:
    var world := WorldScene.instantiate()
    var progress := AgencyProgress.new()
    assert(progress.begin())
    world.configure(progress)
    assert(world.current_station_id() == "reception")
    assert(world.direct_travel("strategy-room"))
    assert(world.current_station_id() == "strategy-room")
    assert(not world.direct_travel("executive-lift"))
    world.set_input_enabled(false)
    assert(not world.get_node("%AgencyPair").get("input_enabled"))
    assert(world.get_node("%GuideButton").focus_mode == Control.FOCUS_ALL)
    assert(world.get_node("%DirectTravel").item_count == 9)
    world.free()
    return true
```

- [ ] **Step 2: Run and observe failure**

Use GodotIQ to run the suite.

Expected: missing scene.

- [ ] **Step 3: Build the pair and station scenes**

Use `godotiq_build_scene` and `godotiq_save_scene`.

`AgencyPair.tscn` contains `CharacterBody2D`, `AnimatedSprite2D`, `CollisionShape2D`, name labels for Art Director and Strategist, and an interaction radius. Movement uses `Input.get_vector("move_left", "move_right", "move_up", "move_down")`, normalises diagonals and never drives gameplay while a modal is open.

`AgencyStation.tscn` contains an `Area2D`, collision shape, icon, glow, room label and owner-role badge. It emits its fixed `station_id` only when the pair is in range or direct travel selects it.

- [ ] **Step 4: Build the agency world**

Use the agency floor as the full-rect background. Place all nine stations at visually corresponding work points. Add static collision boundaries around walls and furniture, one authored `NavigationRegion2D` covering every valid corridor for direct-travel paths, a camera fixed to the authored floor, and the permanent top objective bar.

Add project input actions:

```text
move_left: A and Left
move_right: D and Right
move_up: W and Up
move_down: S and Down
interact: E, Space and Enter
guide: G and F1
role_handoff: H
```

Direct travel disables player input, moves through a reduced-duration path, restores input and focuses the destination action. With reduced motion enabled it places the pair immediately.

- [ ] **Step 5: Implement literal role handoff**

The Art Director avatar is visually foremost at art-owned stations and the Strategist avatar is foremost at strategy-owned stations. `H` opens a two-button handoff confirmation. The station panel states:

- owner action;
- partner holding action; and
- what evidence both partners must agree on before completion.

Handoff increments `agency_progress.handoff_count` and updates the campaign pair role through the main integration signal in Task 7.

- [ ] **Step 6: Run focused verification**

Run `test_agency_world.gd`, then use GodotIQ:

1. `godotiq_check_errors`;
2. `godotiq_scene_tree`;
3. `godotiq_ui_map`;
4. simulated directional input;
5. `godotiq_verify_motion`;
6. `godotiq_state_inspect` for the pair's station; and
7. a 1280 × 800 screenshot.

Expected: movement is visible and bounded; all nine stations can be reached by keyboard and direct travel; no overlap obscures the objective bar.

- [ ] **Step 7: Commit**

```powershell
git add -- godot/project.godot godot/src/agency godot/tests/test_agency_world.gd godot/tests/run_tests.gd
git commit -m "feat(game): add explorable advertising agency"
```

### Task 5: Permanent guide, objectives and role clarity

**Files:**
- Create: `godot/src/agency/ui/agency_guide_drawer.gd`
- Create: `godot/src/agency/ui/AgencyGuideDrawer.tscn`
- Create: `godot/src/agency/ui/agency_hud.gd`
- Create: `godot/src/agency/ui/AgencyHud.tscn`
- Create: `godot/tests/test_agency_guidance.gd`
- Modify: `godot/src/agency/AgencyWorld.tscn`
- Modify: `godot/tests/run_tests.gd`

**Interfaces:**
- Consumes: current `AdMarketAgencyProgress` snapshot and mission/objective catalogue.
- Produces: `show_objective(objective)`, `set_progress(required_done, required_total, optional_done)`, `open_guide(section)`, `set_tucked(tucked)`, and `go_to_objective`.
- Emits: `direct_travel_requested(station_id)`, `role_handoff_requested(role)`, `audio_settings_requested()`.

- [ ] **Step 1: Write the failing guidance test**

Assert that:

```gdscript
var guide := GuideScene.instantiate()
guide.configure(progress, Catalog)
assert(guide.get_node("%OverallGoal").text.contains("Create and pitch"))
assert(guide.get_node("%CurrentObjective").text.contains("Meet the client"))
assert(guide.get_node("%Controls").text.contains("WASD or arrow keys"))
assert(guide.get_node("%ArtDirectorDefinition").text.contains("controls visual"))
assert(guide.get_node("%StrategistDefinition").text.contains("controls audience"))
assert(guide.get_node("%GoToObjective").focus_mode == Control.FOCUS_ALL)
guide.set_tucked(true)
assert(guide.get_node("%GuideTab").visible)
assert(not guide.get_node("%GuidePanel").visible)
```

- [ ] **Step 2: Run and observe failure**

Expected: missing guide scene.

- [ ] **Step 3: Build the always-callable guide**

The untucked drawer contains five tabs:

1. **Goal** — “Create and pitch one advertisement that gives this audience a clear reason to act.”
2. **Current objective** — one action, its reason, its owner, its partner holding action and a “Go to objective” button.
3. **Controls** — movement, interact, guide, handoff, direct travel, creator controls and audio controls.
4. **Roles** — literal definitions:
   - Art Director controls visual hierarchy, colour, framing, composition, imagery, scale and final presentation.
   - Strategist controls audience interpretation, product value, AIDA, headline/message, claim support, price and media route.
5. **Progress** — required evidence, optional contracts and final-pitch readiness.

The tucked state remains as a labelled “Guide — G” tab plus the compact objective bar. Escape closes the drawer and restores focus to the opener.

- [ ] **Step 4: Make first-use guidance unavoidable but brief**

On the first agency entry show a three-step orientation:

1. overall goal;
2. movement and direct travel; and
3. literal role difference.

Each screen asks for one action only. The complete guide remains available afterward. Do not replay orientation after its acknowledgement flag is persisted.

- [ ] **Step 5: Verify accessibility and layout**

Run the test. Use GodotIQ `ui_map`, keyboard input simulation and screenshots at both reference viewport sizes. Confirm:

- focus order follows the visible drawer;
- the tucked tab remains reachable;
- no required text is clipped;
- the current objective remains visible with the drawer closed; and
- “Go to objective” works with reduced motion.

- [ ] **Step 6: Commit**

```powershell
git add -- godot/src/agency/ui godot/src/agency/AgencyWorld.tscn godot/tests/test_agency_guidance.gd godot/tests/run_tests.gd
git commit -m "feat(game): keep goals controls and roles always available"
```

### Task 6: Technique missions, evidence and optional contracts

**Files:**
- Create: `godot/src/agency/missions/agency_mission_panel.gd`
- Create: `godot/src/agency/missions/AgencyMissionPanel.tscn`
- Create: `godot/src/agency/missions/agency_mission_controller.gd`
- Create: `godot/tests/test_agency_missions.gd`
- Modify: `godot/src/agency/agency_world.gd`
- Modify: `godot/tests/run_tests.gd`

**Interfaces:**
- Consumes: mission records from `AdMarketAgencyMissionCatalog`.
- Produces: `open_mission(id, active_role)`, `choose(choice_id)`, `submit_transfer_evidence(text)`, `retry()`, `close()`.
- Emits: `mission_completed(mission_id, evidence)`, `sidequest_completed(sidequest_id)`.

- [ ] **Step 1: Write failing behaviour tests**

Cover:

```gdscript
controller.open_mission("salience", "art-director")
assert(controller.choose("small-logo").get("correct") == false)
assert(controller.is_open())
assert(controller.choose("largest-contrast").get("correct") == true)
assert(not controller.submit_transfer_evidence("bigger"))
assert(controller.submit_transfer_evidence(
    "Use the largest size and strongest colour contrast on the product so the audience notices it first."
))
assert(progress.completed_mission_ids.has("salience"))
assert(progress.evidence_by_mission.get("salience").contains("audience"))
```

Also assert that a Strategist cannot submit the Art Director-owned salience choice until the pair performs a handoff, while the Strategist's holding prompt remains visible.

- [ ] **Step 2: Run and observe failure**

Expected: missing mission controller and scene.

- [ ] **Step 3: Build the reusable mission panel**

Each mission has three short states:

1. choose between four original fictional advertisement treatments;
2. read the effect explanation; and
3. write or choose how the technique will be applied to the pair's advertisement.

The panel renders original diagrams with Godot controls and shapes rather than copied commercial advertisements. Correctness is explained by audience effect. A wrong choice remains retryable and does not remove a reward.

- [ ] **Step 4: Enforce evidence and transfer**

Evidence must:

- be 30–400 characters;
- contain a named audience reference or the word “audience”;
- name the technique for technique missions; and
- be stored under the mission ID.

The controller does not claim the creator document changed. Instead it produces a “Studio application” objective; completion is reconciled against the returned campaign document in Task 7.

- [ ] **Step 5: Add optional contracts**

Optional contracts use the same panel but:

- do not block the campaign;
- award a visible portfolio stamp;
- add one presentation flourish choice; and
- never grant access to required creator or market actions.

- [ ] **Step 6: Run and visually verify**

Run `test_agency_missions.gd`, validate scripts, then use GodotIQ to play one correct and one incorrect salience path and capture the explanation state.

Expected: the player can always identify the goal, choice, effect and transfer action; the other partner has an explicit holding action.

- [ ] **Step 7: Commit**

```powershell
git add -- godot/src/agency/missions godot/src/agency/agency_world.gd godot/tests/test_agency_missions.gd godot/tests/run_tests.gd
git commit -m "feat(game): add advertising technique missions"
```

### Task 7: Integrate the agency with creator, roles, persistence and market

**Files:**
- Create: `godot/src/agency/agency_campaign_controller.gd`
- Create: `godot/tests/test_agency_campaign_controller.gd`
- Modify: `godot/src/main/main.gd`
- Modify: `godot/src/main/Main.tscn`
- Modify: `godot/tests/test_game_shell.gd`
- Modify: `godot/tests/test_live_resume.gd`
- Modify: `godot/tests/test_run_progress_store.gd`
- Modify: `godot/tests/run_tests.gd`
- Modify: `scripts/godot-bridge-contract.test.mjs`

**Interfaces:**
- Consumes: existing `CreatorHost`, `MarketHost`, `AdMarketGameRun`, campaign document and `AgencyWorld`.
- Produces: coordinator methods `begin_agency(run, document)`, `restore_agency(run, document)`, `open_station(station_id)`, `on_creator_returned(document)`, `on_publication(publication)`.
- Emits: `creator_requested()`, `publish_requested()`, `market_requested()`, `progress_changed()`, `status_changed(message)`.

- [ ] **Step 1: Map cross-file impact before editing**

Call `godotiq_file_context` for every listed Godot file, `godotiq_trace_flow` for `_start_run`, `_open_creator`, `_on_creator_state_received`, `_on_creator_published` and `_save_live_progress`, then `godotiq_impact_check` and `godotiq_signal_map`.

- [ ] **Step 2: Write controller and shell failures**

The controller test proves:

```gdscript
controller.begin_agency(run, document)
assert(controller.current_objective().get("id") == "meet-client")
assert(not controller.open_station("production-studio").get("allowed"))
assert(controller.open_station("client-briefing").get("allowed"))
assert(controller.complete_mission("audience-brief", evidence))
assert(controller.current_objective().get("stationId") == "art-studio")
```

Extend the shell test to assert:

- agency world is hidden in the lobby and visible after a run begins;
- old `RunPanel` is no longer the student gameplay surface;
- creator open hides or disables the agency;
- creator close returns to the prior station and objective;
- a role handoff updates `campaign_document.gameplay.pair.activeRole`;
- a `pitch-run@1` saved run enters the mapped agency objective; and
- teacher hosting and market screens retain their existing routes.

- [ ] **Step 3: Run and observe focused failures**

Run the new controller test and changed shell/resume tests.

Expected: controller missing; shell still exposes old run panel.

- [ ] **Step 4: Implement the controller**

Map the three existing levels without weakening readiness:

```text
invent       audience brief, salience, reading path, initial product
sell         contrast, framing, AIDA, headline and value
irresistible claim/proof, price, media route, final visual polish
publish-check final evidence review and pitch setup
```

The controller may request the creator only from an allowed objective. It marks an existing level ready only when both:

1. existing `_readiness_clue_for()` returns empty; and
2. all agency missions assigned to that level have evidence.

The market remains unreachable until the exact existing final review and publication checks pass.

- [ ] **Step 5: Make the main scene a coordinator**

Instance `AgencyWorld.tscn` under `Main`. Preserve lobby, creator host and market host. Retain the old run panel only as a hidden compatibility surface until its unit-test selectors are migrated.

Update:

- practice begin and live join to call `begin_agency`;
- validated resume to call `restore_agency`;
- creator open/close to pause/unpause world input;
- creator state return to reconcile objective evidence and render the world;
- role handoff to update the campaign pair state;
- every agency mutation to call existing progress persistence; and
- publication to enter the pitch theatre before market.

Do not add pair identity headers, teacher credentials or storage keys.

- [ ] **Step 6: Update persistence and static contracts**

The outer envelope retains its nine exact keys and accepts a `pitch-run@2` dictionary. Update fixtures from `pitch-run@1` to `pitch-run@2`, while retaining one explicit migration fixture.

Add Node contract assertions that:

- `main.gd` preloads `AgencyWorld.tscn`;
- the publication path calls the pitch theatre;
- `published-campaign@1` and 1600 × 900 remain unchanged; and
- no `window.AdMarketAccount` or teacher identity enters Godot.

- [ ] **Step 7: Run focused checks**

Use GodotIQ to run:

- `test_agency_campaign_controller.gd`;
- `test_game_shell.gd`;
- `test_live_resume.gd`;
- `test_run_progress_store.gd`; and
- the complete Godot seam runner through the connected editor.

Then run:

```powershell
corepack pnpm exec node --test scripts/godot-bridge-contract.test.mjs
corepack pnpm run typecheck
```

Expected: all pass; existing account and market contracts remain unchanged.

- [ ] **Step 8: Commit**

```powershell
git add -- godot/src/agency/agency_campaign_controller.gd godot/src/main/main.gd godot/src/main/Main.tscn godot/tests scripts/godot-bridge-contract.test.mjs
git commit -m "feat(game): integrate agency campaign flow"
```

### Task 8: Exact-advertisement pitch theatre and campaign response

**Files:**
- Create: `godot/src/presentation/campaign_image_decoder.gd`
- Create: `godot/src/presentation/pitch_theatre.gd`
- Create: `godot/src/presentation/PitchTheatre.tscn`
- Create: `godot/tests/test_campaign_image_decoder.gd`
- Create: `godot/tests/test_pitch_theatre.gd`
- Modify: `godot/src/main/Main.tscn`
- Modify: `godot/src/main/main.gd`
- Modify: `godot/tests/run_tests.gd`

**Interfaces:**
- Consumes: strict `published-campaign@1` publication with `pngBase64`, campaign identity and summary.
- Produces: `CampaignImageDecoder.decode(publication) -> ImageTexture`.
- Produces: `PitchTheatre.present(publication, progress, reduced_motion)`, `select_format(format_id)`, `select_animation(animation_id)`, `play_sound(cue_id)`.
- Emits: `pitch_finished()`, `format_changed(format_id)`, `animation_changed(animation_id)`.

- [ ] **Step 1: Write decoder and theatre failures**

The decoder test supplies a known tiny PNG data URI/base64 fixture and asserts:

```gdscript
var texture: ImageTexture = Decoder.decode({
    "contract": "published-campaign@1",
    "width": 1600,
    "height": 900,
    "pngBase64": VALID_PNG_BASE64
})
assert(texture != null)
assert(texture.get_image().get_width() > 0)
assert(Decoder.decode({"contract": "published-campaign@999"} ) == null)
```

The theatre test asserts the exact same texture instance is used in billboard, magazine and vertical-device materials, and that reduced motion sets the final state immediately.

- [ ] **Step 2: Run and observe failure**

Expected: missing decoder and theatre.

- [ ] **Step 3: Implement strict local PNG decoding**

Require:

- exact publication contract;
- exact declared width 1600 and height 900;
- base64 length under the existing publication ceiling;
- successful `Marshalls.base64_to_raw`;
- PNG signature bytes; and
- `Image.load_png_from_buffer()` success.

Never log the base64 body. Return `null` without changing the existing displayed campaign on failure.

- [ ] **Step 4: Build the pitch theatre**

The scene includes:

- the pair's advertisement on billboard, magazine and vertical screen;
- a format selector;
- animation selector: immediate, reveal, slide, spotlight and sequence;
- five evidence cards: audience fit, product value, AIDA, visual hierarchy and supportable claim;
- client-response copy derived from completed evidence, not a random score;
- portfolio stamps from optional contracts;
- sound buttons; and
- “Enter market” after the response.

The selected format affects framing only; it never crops or mutates the stored advertisement.

- [ ] **Step 5: Implement accessible presentation effects**

Animations use short deterministic tweens under 1.2 seconds. Reduced motion skips tweens and particles. All content is available as text before animation plays. Escape stops the animation without losing progress.

- [ ] **Step 6: Integrate publication transition**

`_on_creator_published()` first validates and displays the pitch. For live rooms, market publication still occurs through the existing `MarketHost`; the pitch does not forge an acknowledgement. For practice, the local market opens after `pitch_finished`.

- [ ] **Step 7: Verify**

Run both new tests and the shell publication tests. Use GodotIQ to inject a valid publication, inspect texture dimensions, play all five animations, emulate reduced motion and capture 1280 × 800 plus 1440 × 900 screenshots.

- [ ] **Step 8: Commit**

```powershell
git add -- godot/src/presentation godot/src/main godot/tests
git commit -m "feat(game): present finished campaigns in pitch theatre"
```

### Task 9: Music, ambience and sound-effect controls

**Files:**
- Create: `godot/src/audio/agency_audio_manager.gd`
- Create: `godot/src/audio/AgencyAudioManager.tscn`
- Create: `godot/assets/audio/office-loop.ogg`
- Create: `godot/assets/audio/pitch-loop.ogg`
- Create: `godot/assets/audio/ui-confirm.ogg`
- Create: `godot/assets/audio/ui-move.ogg`
- Create: `godot/assets/audio/pitch-swoosh.ogg`
- Create: `godot/assets/audio/pitch-camera.ogg`
- Create: `godot/assets/audio/ASSET-SOURCES.md`
- Create: `godot/tests/test_agency_audio_manager.gd`
- Modify: `godot/src/main/Main.tscn`
- Modify: `godot/tests/run_tests.gd`

**Interfaces:**
- Produces: `set_enabled(enabled)`, `set_music_enabled(enabled)`, `set_sfx_enabled(enabled)`, `set_master_volume(linear_value)`, `set_reading_active(active)`, `play_ambience(id)`, `play_music(id)`, `play_sfx(id)`, `stop_all()`.
- Consumes: UI actions, guide/mission reading state and pitch sound buttons.

- [ ] **Step 1: Select and record public-safe sources**

Use only:

- Kenney UI Audio from `https://www.kenney.nl/assets/ui-audio`, identified by the official Kenney asset page as Creative Commons CC0; and
- “Two Simple Game Music Loops” by qubodup from `https://opengameart.org/content/two-simple-game-music-loops`, identified on its asset page as CC0.

Select OGG files that import directly into Godot, keep the original asset names in `ASSET-SOURCES.md`, and record page URL, author, licence, download date, selected file, local filename and SHA-256.

- [ ] **Step 2: Write the failing audio-state test**

Assert:

```gdscript
var audio := AudioManagerScene.instantiate()
audio.set_enabled(false)
assert(not audio.play_sfx("ui-confirm"))
audio.set_enabled(true)
audio.set_music_enabled(true)
audio.play_music("office")
audio.set_reading_active(true)
assert(audio.current_music_gain_db() <= -18.0)
audio.set_reading_active(false)
assert(audio.current_music_gain_db() > -18.0)
audio.set_master_volume(0.0)
assert(audio.current_master_gain_db() <= -70.0)
```

- [ ] **Step 3: Implement three audio buses**

Create `AgencyMusic`, `AgencyAmbience` and `AgencySfx` buses under Master. The manager:

- starts audio only after a user gesture;
- crossfades between office and pitch loops;
- ducks music and ambience to at most -18 dB during substantial reading;
- never gates an objective on playback;
- remembers settings in the agency snapshot;
- stops all audio on session reset; and
- exposes a labelled mute button in the permanent HUD.

- [ ] **Step 4: Connect sound buttons and environment cues**

Use:

- quiet office loop in the agency;
- pitch loop only in the theatre;
- confirm cue on valid mission completion;
- subtle movement cue on direct travel;
- camera and swoosh buttons in the pitch theatre.

Rapid button presses are rate-limited locally to one cue per 120 ms.

- [ ] **Step 5: Verify audio-off and reading behavior**

Run the test, inspect buses with GodotIQ, open the guide and confirm ducking state through structured runtime inspection. Verify the full route with audio disabled.

- [ ] **Step 6: Commit**

```powershell
git add -- godot/src/audio godot/assets/audio godot/src/main/Main.tscn godot/tests
git commit -m "feat(game): add optional agency music and sound"
```

### Task 10: Build contracts, student copy and complete local verification

**Files:**
- Modify: `scripts/build-web.test.mjs`
- Modify: `scripts/verify-web-export.mjs`
- Modify: `scripts/public-release-contract.test.mjs`
- Modify: `scripts/student-copy-source-coverage.test.mjs`
- Modify: `scripts/student-copy-professional-contract.test.mjs`
- Create: `docs/operations/asset-licence-register.md`
- Create: `docs/operations/agency-world-verification-2026-07-29.md`

**Interfaces:**
- Build verification requires the agency floor, guide, mission catalogue, pitch theatre, audio source manifest and non-threaded web export.
- Student-copy checks cover every new `.gd` and `.tscn` string-bearing file.

- [ ] **Step 1: Write failing build-contract assertions**

Require:

```javascript
for (const required of [
  "godot/src/agency/AgencyWorld.tscn",
  "godot/src/agency/ui/AgencyGuideDrawer.tscn",
  "godot/src/agency/agency_mission_catalog.gd",
  "godot/src/presentation/PitchTheatre.tscn",
  "godot/src/audio/AgencyAudioManager.tscn",
  "godot/assets/agency/ASSET-SOURCES.md",
  "godot/assets/audio/ASSET-SOURCES.md"
]) {
  assert.equal(files.has(required), true, `missing ${required}`);
}
```

Add source-corpus paths for the guide, missions and theatre.

- [ ] **Step 2: Run and observe failure**

Run:

```powershell
corepack pnpm exec node --test scripts/build-web.test.mjs scripts/public-release-contract.test.mjs scripts/student-copy-source-coverage.test.mjs scripts/student-copy-professional-contract.test.mjs
```

Expected: new asset and copy requirements fail before the verifier is updated.

- [ ] **Step 3: Update build/export verification**

Require the files above in source and in the generated `.pck` manifest or build-input hash. Keep:

- `variant/thread_support=false`;
- offline core;
- product shells;
- creator assets;
- account routes; and
- existing COOP/COEP/CSP requirements.

Add a total shipped audio ceiling of 8 MiB and agency raster ceiling of 16 MiB.

- [ ] **Step 4: Run the final stable student-copy corpus**

Only after gameplay text stops changing:

1. run the objective plain-language skill against the complete new student-facing corpus without supplying a preferred rewrite;
2. apply accepted factual clarity changes;
3. run the claude-scrubber process once against the same stable corpus;
4. apply only changes that preserve advertising terminology and precise role differences; and
5. rerun the professional-expression and source-coverage tests.

- [ ] **Step 5: Run full local verification once**

Run:

```powershell
corepack pnpm run typecheck
corepack pnpm run test
corepack pnpm run test:build-web
corepack pnpm run build
corepack pnpm run verify:export
corepack pnpm run verify:repo-sync
git diff --check
```

Use GodotIQ for:

- all registered GDScript seam suites;
- `godotiq_validate` with zero unresolved convention notices in project-authored code;
- `godotiq_check_errors`;
- `godotiq_verify_project_runs`;
- movement and direct-travel runtime evidence;
- guide keyboard path;
- creator round trip;
- mission completion;
- exact PNG pitch;
- reduced motion;
- audio disabled;
- debugger/console check; and
- performance snapshot at 1280 × 800.

Record commands, exact pass counts, hashes and screenshot paths in the verification record.

- [ ] **Step 6: Commit**

```powershell
git add -- scripts docs/operations
git commit -m "test(game): enforce agency release contracts"
```

### Task 11: Fresh review, hosted QA and production release

**Files:**
- Modify: `docs/operations/agency-world-verification-2026-07-29.md`
- Modify only if a verified defect requires it: the smallest affected source/test files.

**Interfaces:**
- Consumes: one stable candidate whose local verification inputs have not changed.
- Produces: review resolution, hosted viewport evidence, pushed canonical history and verified production deploy.

- [ ] **Step 1: Request exactly one fresh code review**

Invoke `superpowers:requesting-code-review` once with:

- the approved design;
- this plan;
- the stable diff;
- local verification evidence; and
- no suspected findings or preferred verdict.

Resolve confirmed release blockers with test-first fixes. Do not start a reviewer loop.

- [ ] **Step 2: Re-run only invalidated checks**

Use the diff to identify which focused checks became stale. After all fixes, run the full applicable suite once more if any build input changed.

- [ ] **Step 3: Push the canonical branch and merge**

Confirm the intended canonical remote, then:

```powershell
git status --short
git log --oneline --decorate -12
git push -u origin agent/admarket-integrated-fixes-20260723
```

Merge through the repository's existing protected/default-branch path. Do not delete a repository, branch, file set or deploy.

- [ ] **Step 4: Build one immutable production artifact**

Run the fail-closed build, record the exact source commit and artifact SHA-256, and ensure repository-sync verification passes before deployment.

- [ ] **Step 5: Deploy production through the linked inner Netlify project**

Use the current Netlify connector or the repository's verified artifact deploy script against site ID `fffc6f57-3fd2-44e3-9247-05a5f746351d`. Do not target the stale outer shell.

Use:

```powershell
corepack pnpm run deploy:production --artifact "C:\tmp\admarket-integrated-fixes-20260723\build\web" --site-id "fffc6f57-3fd2-44e3-9247-05a5f746351d"
```

The literal command must not include an extra `--` separator.

- [ ] **Step 6: Run hosted browser QA in the reference environment**

Invoke `netlify-browser-qa`, then the current in-harness browser/Playwright surface. Verify at exactly:

- 1280 × 800; and
- 1440 × 900.

Exercise:

1. student route and account session;
2. practice start;
3. first-use goal and controls;
4. keyboard movement and direct travel;
5. both literal roles and handoff;
6. one incorrect and correct mission choice;
7. guide tucked and untucked;
8. creator open, save and return;
9. publication and exact pitch image;
10. presentation format and reduced motion;
11. audio mute;
12. market transition;
13. teacher dashboard;
14. teacher playtest isolation; and
15. console/network errors.

Capture viewport screenshots and record browser, URL, deploy ID and findings.

- [ ] **Step 7: Verify production and close the record**

Confirm:

- the production URL serves the deployed commit;
- the student route is usable;
- teacher and playtest routes remain isolated;
- Supabase schema/data were not mutated unless a specific verified migration was required;
- OneDrive source remained unchanged;
- the public repository contains no secrets, review transcripts or internal operational litter; and
- Safari/school-wifi uncertainties are stated rather than overclaimed.

- [ ] **Step 8: Commit and push the final verification record**

```powershell
git add -- docs/operations/agency-world-verification-2026-07-29.md
git commit -m "docs(release): verify agency world production release"
git push
```

## Self-review result

- Spec coverage: all 21 design acceptance criteria map to Tasks 1–11.
- File boundaries: state, catalogue, world, UI, missions, integration, presentation and audio remain separate.
- Migration: `pitch-run@1` is retained only as a strict input and always emits `pitch-run@2`.
- Role consistency: `art-director` and `strategist` are the only role IDs throughout.
- Mission consistency: seven required mission IDs and five optional sidequest IDs are fixed in Tasks 1, 2 and 6.
- Accessibility: keyboard, direct travel, permanent guide, reduced motion and audio-off are covered in implementation and hosted QA.
- Release integrity: one immutable artifact is built, hashed, deployed and checked at both fixed viewports.
- Placeholder scan: no deferred implementation markers remain.
