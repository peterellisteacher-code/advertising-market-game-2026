# Staged Agency Orientation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dense first-time agency instructions with a clear three-screen quick start and a fuller permanent reference.

**Architecture:** Keep the ordered instructional data in `agency_guide_drawer.gd`, render it into fixed scene-owned orientation rows, and leave detailed reference material in the existing guide tabs. The orientation remains a modal layer owned by `AgencyGuideDrawer`, so agency movement stays paused until the pair reaches the Client Brief.

**Tech Stack:** Godot 4, typed GDScript, `.tscn` Control nodes, GodotIQ editor bridge, existing Godot seam tests.

## Global Constraints

- Target school-issued MacBooks at `1280x800` and `1440x900`, using keyboard plus mouse or trackpad.
- Do not add phone layouts, touch-only controls or mobile-specific acceptance criteria.
- Use professional, factual academic English and concrete classroom language.
- Both roles retain identical controls and site access; their titles divide responsibility, not permissions.
- Modify Godot scripts and scenes only through GodotIQ.

---

### Task 1: Lock the instructional contract with a failing test

**Files:**
- Modify: `godot/tests/test_agency_guidance.gd`

**Interfaces:**
- Consumes: `AdMarketAgencyGuideDrawer.open_orientation()` and `advance_orientation()`.
- Produces: regression assertions for the three ordered orientation screens and explicit role/access wording.

- [ ] **Step 1: Extend the orientation seam test**

Assert that the three screens respectively identify the advertisement-and-pitch goal, the Client Brief destination and station-use controls, and the distinct Strategist/Art Director responsibilities plus identical access.

```gdscript
guide.open_orientation()
assert(guide.get_node("%OrientationTitle").text == "Make one persuasive advertisement")
assert(guide.get_node("%OrientationItemOneText").text.contains("client brief"))
guide.advance_orientation()
assert(guide.get_node("%OrientationLead").text.contains("Client Brief"))
assert(guide.get_node("%OrientationItemTwoText").text.contains("E, Space or Enter"))
guide.advance_orientation()
assert(guide.get_node("%OrientationItemOneText").text.contains("Strategist"))
assert(guide.get_node("%OrientationItemTwoText").text.contains("Art Director"))
assert(guide.get_node("%OrientationItemThreeText").text.contains("same controls and site access"))
```

- [ ] **Step 2: Run the focused test to verify failure**

Run the Godot seam `res://tests/test_agency_guidance.gd`.

Expected: FAIL because the current orientation exposes one dense body label and lacks the explicit ordered role/access contract.

### Task 2: Implement the staged copy and semantic rows

**Files:**
- Modify: `godot/src/agency/ui/agency_guide_drawer.gd`
- Modify: `godot/src/agency/ui/AgencyGuideDrawer.tscn`

**Interfaces:**
- Consumes: three dictionaries in `ORIENTATION_STEPS`, each with `title`, `lead`, `items`, and `button`.
- Produces: `_update_orientation()` rendering a lead plus three labelled information rows.

- [ ] **Step 1: Replace the dense orientation bodies**

Store the approved three-screen copy as short leads and three separate information rows. Preserve the three-step completion contract.

```gdscript
{
	"title": "Two roles, one shared campaign",
	"lead": "The role titles divide responsibility. They do not unlock different tools.",
	"items": [
		{"label": "STRATEGIST", "text": "Leads audience, message and offer decisions, then records why they should persuade."},
		{"label": "ART DIRECTOR", "text": "Leads composition, colour, type and imagery decisions, then records how they guide attention."},
		{"label": "BOTH PARTNERS", "text": "Use the same controls and site access. Discuss each major decision and press H to record a handover."},
	],
	"button": "Go to the Client Brief",
}
```

- [ ] **Step 2: Build the fixed row hierarchy**

Use GodotIQ scene operations to add a lead label and three row containers, retain the centred action button, and make the backdrop cover the complete viewport.

- [ ] **Step 3: Render rows deterministically**

Update `_update_orientation()` to populate each row, hide unused rows, and focus the single forward action.

```gdscript
_set_label_text("%OrientationLead", String(step.get("lead", "")))
var items: Array = step.get("items", [])
for item_index in range(3):
	var row := get_node_or_null("%OrientationItem%d" % (item_index + 1)) as Control
	var item: Dictionary = items[item_index] if item_index < items.size() else {}
	row.visible = not item.is_empty()
	_set_label_text("%OrientationItem%dLabel" % (item_index + 1), String(item.get("label", "")))
	_set_label_text("%OrientationItem%dText" % (item_index + 1), String(item.get("text", "")))
```

- [ ] **Step 4: Validate after each changed script**

Run GodotIQ convention validation and compilation checks for `agency_guide_drawer.gd`.

- [ ] **Step 5: Run the focused tests**

Run `test_agency_guidance.gd` and `test_agency_world.gd`.

Expected: PASS.

### Task 3: Deepen the permanent reference

**Files:**
- Modify: `godot/src/agency/ui/AgencyGuideDrawer.tscn`
- Test: `godot/tests/test_agency_guidance.gd`

**Interfaces:**
- Consumes: existing Goal, Current objective, Controls, Roles and Progress tabs.
- Produces: an always-available guide that defines order of play, controls, role responsibilities and shared permissions.

- [ ] **Step 1: Add failing reference assertions**

Assert that the Roles tab names both decision domains and states that access is identical, and that the Goal tab states the order from brief to build to pitch.

```gdscript
assert(guide.get_node("%RoleStrategist").text.contains("audience, message and offer"))
assert(guide.get_node("%RoleArtDirector").text.contains("composition, colour, type and imagery"))
assert(guide.get_node("%RoleSharedAccess").text.contains("same controls and site access"))
assert(guide.get_node("%GoalProcess").text.contains("1. Read the client brief"))
assert(guide.get_node("%GoalProcess").text.contains("3. Deliver the pitch"))
```

- [ ] **Step 2: Rewrite only the affected guide labels**

Use numbered or labelled sections and short complete explanations. Retain current objective and progress data bindings.

- [ ] **Step 3: Run focused guidance tests**

Run `test_agency_guidance.gd`.

Expected: PASS.

### Task 4: Verify the rendered modal

**Files:**
- Modify: `godot/src/agency/ui/AgencyGuideDrawer.tscn`

**Interfaces:**
- Consumes: a fresh running `Main.tscn`.
- Produces: visual evidence for the first-time orientation at the two target viewports.

- [ ] **Step 1: Start a fresh runtime**

Stop any existing game, run the project, verify the project starts, and inspect the UI map before input.

- [ ] **Step 2: Capture `1280x800`**

Verify the full-screen dim layer, readable hierarchy, uncut rows and one prominent action.

- [ ] **Step 3: Capture `1440x900`**

Verify the same criteria and that excess space does not stretch the card into an unreadable layout.

- [ ] **Step 4: Complete the orientation by keyboard**

Advance all three screens, confirm the permanent guide opens at the current objective, and confirm agency movement becomes available only after the guide is tucked.

- [ ] **Step 5: Commit**

Stage only the orientation spec, plan, tests, guide script and guide scene, then commit:

`feat(game): clarify agency orientation`
