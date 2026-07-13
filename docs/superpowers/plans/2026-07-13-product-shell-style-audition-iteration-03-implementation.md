# Product-Shell Style Audition Iteration 03 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Follow the tasks once, in order. This is a bounded correction pass, not a new visual-review loop.

**Goal:** Produce an append-only iteration 03 that makes the editor's promises precise while preserving iteration 02's deliberately blank, coherent product shells.

**Architecture:** Keep the twelve stable IDs, manifest colours, eight direct-surface/four flat-skin split, deterministic SVG renderer and static contact sheet. Improve one shared review-only selection renderer; retarget the Food Truck and Headphones editable masks; add metadata-driven, editor-only panel roles to the Takeaway Box; and redraw only the Trainer laces. Clean previews and exports stay free of selection UI.

**Decision evidence:** The fixed six-model panel returned five REVISE and one PASS. The subsequent single non-voting `openai/gpt-5.6-sol` reflection rejected panel overreach and set the final five-change scope. Codex accepts that direction. See `docs/superpowers/plans/2026-07-13-product-shell-iteration-02-sol-reflection.md`.

**Tech Stack:** Python 3.12, Pydantic 2.13, deterministic semantic SVG/XML, pytest, local Chromium browser inspection.

## Global Constraints

- Do not modify `catalog/generated/product-shells-v1-reviewed/`.
- Do not modify, delete, move or overwrite any `iteration-01` or `iteration-02` generated or report file.
- Generate only into the absent `catalog/generated/product-shell-style-audition-v1/iteration-03/` and `catalog/reports/product-shell-style-audition-v1/iteration-03/` directories.
- Do not modify Claude-owned work, Games Workshop, or unrelated creator/logo files.
- Preserve the twelve stable IDs, names, region colours and authoring-mode assignments.
- Make exactly five changes: global selection chrome, Food Truck target, Headphones exterior cup, Takeaway Box editor-only orientation, Trainer laces.
- Do not add a Pet Shop paw/bone/fish, Aquarium decoration, Hoodie change, broad flat-skin annotations, Sports Bottle redesign, palette restyle or new terminology.
- Keep previews and exports free of guides, handles, role labels and selection tint.
- Keep authoring SVGs text-free. Review SVG text is permitted only inside the Takeaway Box's explicitly non-exporting editor-guide group.
- Keep all shells free of logos, slogans, prices, mascots and finished persuasive content.
- Student-facing UI must not use the whole words `assignment`, `unit` or `task`.
- Use one shared guide renderer driven by surface/panel metadata. Do not draw bespoke selected-state artwork for individual products.
- Preserve the `#34414D` contour, `#6A7580` detail language, restrained fills, two tonal planes and top-left lighting.
- Run each focused and full test command to completion. Do not regenerate an existing numbered iteration.
- After the bounded implementation and browser gate, make the expert decision directly. Do not run another six-model panel.

## File Map

- `pipeline/asset_pipeline/product_shell_art.py`: shared selection renderer, two direct-surface masks, Headphones anatomy, Trainer laces, and reusable panel-role metadata/rendering.
- `pipeline/tests/test_product_shell_audition.py`: exact functional, semantic, export-isolation and regression contracts.
- `catalog/generated/product-shell-style-audition-v1/iteration-03/`: new immutable authoring/preview build.
- `catalog/reports/product-shell-style-audition-v1/iteration-03/`: new QA, contact sheet, browser proof and expert gate.
- `catalog/source/product-shell-style-audition-v1/manifest.json`: read-only for this iteration.
- `pipeline/asset_pipeline/product_shell_audition.py`: read-only unless a failing test proves the contact-sheet renderer itself needs a generic accessibility correction.

---

### Task 1: Make Selection Chrome Honest and Retarget the Food Truck

**Files:**
- Modify: `pipeline/tests/test_product_shell_audition.py`
- Modify: `pipeline/asset_pipeline/product_shell_art.py`

**Interfaces:**
- `_guide_overlay(view, surface)` remains the only shared selected-surface renderer.
- `ArtworkSurface.path` remains the clip mask and the exact visible selection outline.
- Food Truck keeps its base illustration; only `surface.path` and bounds change.

- [ ] **Step 1: Add failing selection tests**

Add `test_review_selection_uses_high_contrast_exact_surface_outline`.

For every prototype, parse review, authoring and preview SVGs and require:

- review has one `data-selection-outline="primary"`;
- its `d` equals the clip's `data-artwork-surface="primary"` path;
- its stroke is the shared guide colour and its stroke width is at least 5 SVG units;
- the visible guide group has no group-level opacity reduction;
- tint fill opacity is between 0.12 and 0.18;
- authoring guides remain hidden;
- preview contains no guide, print-area or selection-outline element;
- no dashed stroke is used.

Run:

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -k "selection" -q
```

Expected: FAIL because review currently relies on a 0.52-opacity group and has no exact surface outline.

- [ ] **Step 2: Add the failing Food Truck target test**

Add `test_food_truck_primary_target_is_uninterrupted_lower_side_panel`.

Require:

- width at least 500 and height at least 150;
- top edge at or below the serving-window sill;
- right edge before the cab seam;
- review selection outline matches that surface exactly;
- base window-bar detail paths do not fall inside the target's vertical range.

Update the general Food Truck coverage floor to the honest lower-panel area rather than preserving the old window-overlapping rectangle.

Run the test and confirm RED.

- [ ] **Step 3: Implement the shared selection renderer**

In `_guide_overlay`:

- remove the review group's global opacity;
- retain a restrained fill tint around 0.15;
- add one solid, high-contrast outline over the exact surface path;
- increase solid corner-guide weight to at least 5;
- preserve hidden authoring guides and guide-free previews;
- add semantic attributes so editor UI, keyboard focus and export tests can distinguish selection chrome from product geometry.

Use a guide colour that clears 3:1 non-text contrast against the light product/card surfaces without relying only on hue.

- [ ] **Step 4: Retarget the Food Truck only**

Replace the current window-crossed surface with the uninterrupted lower side-body panel below the serving hatch and before the cab. Do not change the truck silhouette, awning, window, wheels, cab, fills or details.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -k "selection or food_truck" -q
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -q
git diff --check
```

Confirm old numbered iterations and the 141-file production pack are absent from `git diff`.

Commit:

```powershell
git add -- pipeline/asset_pipeline/product_shell_art.py pipeline/tests/test_product_shell_audition.py
git commit -m "feat: make product shell selection honest"
```

---

### Task 2: Clarify the Headphones Exterior Cup and Trainer Laces

**Files:**
- Modify: `pipeline/tests/test_product_shell_audition.py`
- Modify: `pipeline/asset_pipeline/product_shell_art.py`

- [ ] **Step 1: Add the failing Headphones contract**

Add `test_headphones_selection_targets_exterior_cap_not_cushion`.

Require:

- one marked `data-product-part="headphones-exterior-cap"`;
- one distinct fixed cushion/rim marker;
- `ArtworkSurface.path`, clip path and review selection outline all equal the exterior-cap path;
- the cap is a substantial near-front plane;
- cushion, headband and rear cup are outside the cap's selected surface.

Do not require a complete side-profile redraw.

- [ ] **Step 2: Add the failing Trainer contract**

Replace `test_trainer_uses_six_or_more_separate_solid_laces` with `test_trainer_laces_are_light_ordered_crisscross_structure`.

Require:

- four left/right pairs, eight paths total;
- explicit row and direction metadata;
- open paths with `fill="none"`;
- structural stroke width no greater than `DETAIL_STROKE`;
- consistent opacity no greater than 0.75;
- no filled stripe quadrilaterals.

Run:

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -k "headphones or trainer_laces" -q
```

Expected: both new contracts fail.

- [ ] **Step 3: Implement the Headphones correction**

Preserve the overall composition and perspective. Make the near cup anatomy explicit:

- keep headband and rear cup;
- reduce the cushion to a fixed edge/rim;
- expose one clean exterior cap;
- set the cap as the primary artwork/selection surface;
- keep the cap large enough for a square logo or short wordmark.

Update only the Headphones-specific editable-face coverage expectation to match the honest cap rather than the whole cup assembly.

- [ ] **Step 4: Implement orderly structural laces**

Replace the six heavy filled bars with four evenly spaced crisscross pairs attached plausibly to the eye-stay. Use the normal detail token, not accent/brand weight. Preserve every other Trainer path and its broad side-quarter surface.

- [ ] **Step 5: Verify and commit**

Run focused and full tests:

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -k "headphones or trainer" -q
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -q
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests -q
git diff --check
```

Commit:

```powershell
git add -- pipeline/asset_pipeline/product_shell_art.py pipeline/tests/test_product_shell_audition.py
git commit -m "feat: clarify headphone cap and trainer laces"
```

---

### Task 3: Add Metadata-Driven Takeaway Box Orientation

**Files:**
- Modify: `pipeline/tests/test_product_shell_audition.py`
- Modify: `pipeline/asset_pipeline/product_shell_art.py`

**Architecture:**

Add a small immutable panel-role type to `FlatSkinGeometry`, such as role, label, bounds/anchor and top direction. Only Takeaway Box declares roles. The renderer consumes the metadata to create editor-only review UI; labels are not hand-painted into the shell paths.

- [ ] **Step 1: Add failing role-metadata tests**

Require Takeaway Box to declare at least:

- front panel;
- lid/top panel;
- side orientation;
- top direction.

Require Slim Can, Sports Bottle and Snack Pouch to declare no panel-role labels; their current construction geometry remains unchanged.

- [ ] **Step 2: Add failing export-isolation tests**

Require:

- authoring SVG includes hidden role metadata but no visible text;
- review SVG includes one `data-panel-orientation-guides="true"` group marked `data-editor-only="true"` and `data-export="false"`;
- all review `<text>` nodes live inside that group and use only the declared roles;
- preview/mapped product SVG contains no role metadata, label, guide or text;
- no product region or artwork-surface path contains a role word.

Run:

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -k "panel_role or orientation or export_isolation" -q
```

Expected: FAIL because `FlatSkinGeometry` has no role metadata or guide renderer.

- [ ] **Step 3: Implement reusable role metadata and guide rendering**

Add the immutable metadata type and a shared renderer:

- metadata is hidden in authoring;
- compact role chips/arrows are visible only in review;
- role UI uses selection-guide colours and remains legible at contact-sheet size;
- all UI is marked non-exporting;
- clean/mapped preview output remains text-free and unchanged.

Do not alter the Takeaway Box net, preview angle, folds, flaps, fills or other three skins.

- [ ] **Step 4: Verify and commit**

Run:

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -k "flat_skin or panel_role or orientation or safe_parseable" -q
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -q
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests -q
git diff --check
```

Commit:

```powershell
git add -- pipeline/asset_pipeline/product_shell_art.py pipeline/tests/test_product_shell_audition.py
git commit -m "feat: orient takeaway box editor panels"
```

---

### Task 4: Build Immutable Iteration-03 Evidence

**Files:**
- Create: `catalog/generated/product-shell-style-audition-v1/iteration-03/`
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-03/`

- [ ] **Step 1: Verify isolation before generation**

Require both iteration-03 targets to be absent. Record:

- production pack count/hash;
- iteration-01 generated/report count and tree IDs;
- iteration-02 generated/report count and tree IDs;
- clean `git diff` for all protected paths.

Stop rather than overwrite if either target exists.

- [ ] **Step 2: Run the complete test suite twice**

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -q
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests -q
```

- [ ] **Step 3: Generate once**

```powershell
pipeline\.venv\Scripts\python.exe -m asset_pipeline.product_shell_audition --source catalog/source/product-shell-style-audition-v1/manifest.json --out catalog/generated/product-shell-style-audition-v1/iteration-03 --report catalog/reports/product-shell-style-audition-v1/iteration-03
```

Expected: `{"prototypes": 12}`, 26 generated files and 14 initial report files.

Do not rerun this command.

- [ ] **Step 4: Verify immutable output**

Require:

- 12 authoring and 12 preview SVGs;
- 12 review SVGs in reports;
- deterministic manifest/QA hashes;
- all protected counts/tree IDs unchanged;
- no external content, scripts or guide leakage in previews;
- only Headphones and Trainer have product-visible geometry changes;
- Food Truck changes only its surface/clip/selected state;
- Takeaway Box changes only editor metadata/guidance;
- global guide changes appear only in authoring/review states.

- [ ] **Step 5: Commit**

```powershell
git add -- catalog/generated/product-shell-style-audition-v1/iteration-03 catalog/reports/product-shell-style-audition-v1/iteration-03
git commit -m "feat: build product shell audition iteration 03"
```

---

### Task 5: Inspect Iteration 03 in Chromium

**Files:**
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-03/contact-sheet.png`
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-03/browser-inspection.md`

- [ ] **Step 1: Serve without source changes**

Use a unique loopback port. Serve the sheet with an empty 204 response for the browser's automatic favicon request so the network gate remains strict.

Open the exact iteration-03 contact sheet at 2400×1800.

- [ ] **Step 2: Mechanical gate**

Require:

- 12 cards and 24 inline SVGs;
- 8 direct-surface and 4 flat-skin cards;
- zero console errors/warnings;
- zero failed requests and zero HTTP responses at or above 400;
- exact four-by-three grid without clipping.

- [ ] **Step 3: Visual gate**

Record PASS/FAIL for:

- selection outline clearly visible without tint alone;
- outline follows the exact editable surface on every card;
- clean/mapped previews remain guide-free;
- Food Truck target is uninterrupted by hatch, bars, cab or wheels;
- Headphones target is clearly the exterior cap, not padding;
- Takeaway Box roles and top direction appear only in the editable review;
- Trainer laces are orderly structural lines and no longer dominate;
- unaffected product geometry/style remains stable;
- no logo, slogan, price, mascot or finished advertising content was introduced.

- [ ] **Step 4: Capture exact evidence**

Capture the rendered `main` element to PNG at CSS scale. Record dimensions, byte size and SHA-256.

- [ ] **Step 5: Commit**

```powershell
git add -- catalog/reports/product-shell-style-audition-v1/iteration-03/contact-sheet.png catalog/reports/product-shell-style-audition-v1/iteration-03/browser-inspection.md
git commit -m "test: inspect product shell audition iteration 03"
```

---

### Task 6: Approve or Reject the Scaling Reference Directly

**Files:**
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-03/expert-gate.md`
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-03/expert-gate.json`
- Create only on PASS: a separate catalogue-scaling implementation plan under `docs/superpowers/plans/`

- [ ] **Step 1: Verify before deciding**

Run the focused and complete test suites, JSON/XML parse checks, `git diff --check`, protected-path checks and browser evidence hash verification.

- [ ] **Step 2: Apply the five-change contract**

PASS only if all five changes work and all explicit non-changes remain intact. Do not reopen rejected taste questions.

Use one of:

- `EXPERT_GATE_PASS`
- `EXPERT_GATE_REVISE`
- `EXPERT_GATE_REJECT`

Record exact evidence, tests, commits and any remaining blocker.

- [ ] **Step 3: Stop the audition loop on PASS**

If PASS, mark iteration 03 as the scaling reference and write a separate plan for catalogue expansion and editor integration. Do not modify the reviewed 141-file pack until that promotion plan explicitly authorises it.

- [ ] **Step 4: Commit**

```powershell
git add -- catalog/reports/product-shell-style-audition-v1/iteration-03/expert-gate.md catalog/reports/product-shell-style-audition-v1/iteration-03/expert-gate.json docs/superpowers/plans
git commit -m "review: approve product shell scaling reference"
```

## Completion Standard

Iteration 03 is complete only when the five bounded changes pass source tests, export-isolation tests, browser inspection and the direct expert gate. No further panel is required.
