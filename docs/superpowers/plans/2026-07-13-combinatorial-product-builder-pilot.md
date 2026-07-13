# Combinatorial Product Builder Pilot — Implementation Plan

> Execute with test-driven development and bounded sub-agent tasks. Do not mutate the reviewed 141-file pack, any audition iteration, or unrelated untracked work.

**Goal:** Prove that twelve polished product bodies can provide at least 6,144 genuinely distinct, recolourable product starting points without storing thousands of near-duplicate images.

**Architecture:** A small versioned catalogue stores bodies, compatible interchangeable parts, 16 palettes and the existing 8 material identities. A deterministic composer resolves one virtual variant on demand. The visible creator selects a body, part, palette and material, then loads one composed SVG into Fabric while preserving editable artwork surfaces and fixed structural overlays.

**Pilot families:** drinkware, food packaging and bags.

**Scale target:** 12 bodies × 4 compatible part choices × 16 palettes × 8 materials = 6,144 virtual variants from a compact physical pack.

**Reference boundary:** use Iteration 03 for visual grammar and `0254935` or later for compositing order. Frozen audition SVGs remain evidence only.

---

## Task 1: Define the Versioned Pilot Contract

**Files**

- Create: `pipeline/asset_pipeline/product_builder.py`
- Create: `pipeline/tests/test_product_builder.py`
- Create: `catalog/source/product-builder-pilot-v1/manifest.json`

### Step 1: Write failing contract tests

Require:

- schema `product-builder-source@1` and a portable pack ID;
- exactly three families and twelve unique bodies;
- exactly four compatible parts per body;
- exactly sixteen palettes, each with body/trim/accent/label colours;
- exactly the eight existing material IDs;
- normalized anchors and artwork-surface bounds;
- no raw HTML, scripts, external URLs, arbitrary SVG, data URLs or path traversal in the manifest;
- computed virtual count exactly 6,144;
- frozen/immutable model values and deterministic canonical JSON.

Run the failing test:

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_builder.py -q
```

### Step 2: Implement only the contract parser and virtual-count calculation

Use Pydantic contract models consistent with `product_shells.py`. Keep geometry in trusted code; the manifest may select registered geometry and component IDs but must not supply executable markup.

### Step 3: Add the twelve-body source manifest

Use four bodies per family:

- drinkware: slim can, classic can, sports bottle, takeaway cup;
- food packaging: snack pouch, burger box, meal box, noodle tub;
- bags: tote, carry bag, backpack, weekender.

Give every body one component slot with four compatible choices. Keep all wording brand-free and product-focused.

### Step 4: Verify and commit

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_builder.py -q
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests -q
git diff --check
```

Commit: `feat: define combinatorial product builder contract`

---

## Task 2: Render the Compact Physical Pilot Pack

**Files**

- Modify: `pipeline/asset_pipeline/product_builder.py`
- Modify: `pipeline/tests/test_product_builder.py`
- Create once: `catalog/generated/product-builder-pilot-v1/`

### Step 1: Write failing renderer tests

Require every body authoring SVG to contain, in order:

1. shell fills;
2. clipped student-artwork slot;
3. fixed tone and structural layers;
4. editor-only guides.

Require component fragments to declare a compatible slot and part ID, stay inside normalized bounds, and contain no text, logo, price, script, image, external reference or finished advertising.

Require palette/material definitions to be shared rather than copied into thousands of records.

### Step 2: Implement trusted geometry registries

Reuse the approved cel-shaded constants and compositing rules. Build four bodies and four part geometries per family. Parts should produce visible structural alternatives, such as cap/top, lid/closure and handle/strap choices, without solving the advertising challenge.

### Step 3: Generate exactly once into a new target

The generator must fail closed if the target exists or is non-empty. Expected physical scale:

- 12 body authoring SVGs;
- 12 body preview SVGs;
- 12 reusable component SVG fragments;
- one catalogue, one source snapshot and one QA record.

Do not write 6,144 files.

### Step 4: Verify and commit

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_builder.py -q
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests -q
```

Commit: `feat: build compact product builder pilot pack`

---

## Task 3: Parse and Enumerate Virtual Variants in the Browser

**Files**

- Create: `web/src/product-builder/product-builder-catalogue.ts`
- Create: `web/src/product-builder/product-builder-catalogue.test.ts`
- Create: `web/src/product-builder/virtual-product-variant.ts`
- Create: `web/src/product-builder/virtual-product-variant.test.ts`

### Step 1: Write failing TypeScript tests

Require:

- strict same-origin `/catalog/generated/` URLs;
- exact schema/version and safe relative paths;
- cross-reference validation for family/body/slot/part/material/palette IDs;
- lazy lookup without materialising all 6,144 variants;
- canonical variant ID from body + part + palette + material;
- stable filtering and paging;
- rejection of duplicate IDs, unknown parts, bad anchors, unsafe URLs and count mismatches.

### Step 2: Implement parser and lazy resolver

Expose `resolveVariant(selection)` and `countVariants(filters)`. Keep bodies, parts, palettes and materials normalized; do not create a 6,144-entry array.

### Step 3: Verify and commit

```powershell
pnpm exec vitest run web/src/product-builder/product-builder-catalogue.test.ts web/src/product-builder/virtual-product-variant.test.ts
pnpm run typecheck
```

Commit: `feat: resolve virtual product variants lazily`

---

## Task 4: Compose Parts, Palettes and Materials Safely

**Files**

- Create: `web/src/product-builder/product-svg-composer.ts`
- Create: `web/src/product-builder/product-svg-composer.test.ts`
- Modify: `web/src/fabric/product-shell-factory.ts`
- Modify: `web/src/fabric/product-shell-factory.test.ts`
- Modify: `web/src/fabric/fabric-custom-properties.ts`

### Step 1: Write populated-composition tests

Test a real opaque artwork object plus each component class. Require:

- component inserted only at its declared slot/anchor;
- palette recolours only declared regions;
- material treatment changes appearance while preserving palette identity;
- fixed laces, folds, rims, highlights and outlines remain above student art;
- guide/role metadata never appears in clean export;
- serialized Fabric state preserves body, part, palette and material IDs;
- malformed or incompatible selections fail without partial canvas mutation.

### Step 2: Implement the deterministic composer

Parse only trusted local pack SVGs. Compose in memory, namespace all IDs, insert the chosen component, apply region colours and one of the existing eight material treatments, then hand the result to Fabric. Do not use remote generation or store a rendered file for each combination.

### Step 3: Verify and commit

```powershell
pnpm exec vitest run web/src/product-builder/product-svg-composer.test.ts web/src/fabric/product-shell-factory.test.ts
pnpm run typecheck
pnpm test
```

Commit: `feat: compose custom product variants in fabric`

---

## Task 5: Replace the Shell Dropdown with a Visual Builder Pilot

**Files**

- Create: `web/src/product-builder/product-builder-panel.ts`
- Create: `web/src/product-builder/product-builder-panel.test.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/styles/editor.css`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`

### Step 1: Write failing interaction tests

Require a compact four-step visual flow:

1. choose product body;
2. choose part;
3. choose palette;
4. choose material and add to canvas.

Require thumbnail cards rather than a long select, keyboard operation, visible selection state, live variant count, no assessment language, and no dependence on network images.

### Step 2: Implement the pilot UI

Use the existing catalogue virtualization pattern rather than rendering 6,144 cards. Show twelve body cards and only compatible choices for the selected body. Keep free drawing, text, shapes and later image search as independent creative tools.

### Step 3: Wire placement and editing

When a variant is placed, preserve region controls and add part/palette/material controls to the inspector. Changes must be undoable through the existing history system and durable through save/reload/export.

### Step 4: Verify and commit

```powershell
pnpm exec vitest run web/src/product-builder web/src/ui/editor-shell.test.ts web/src/main.test.ts
pnpm run typecheck
pnpm test
```

Commit: `feat: add visual product builder pilot`

---

## Task 6: Browser-Gate the Pilot and Promote the Contract

**Files**

- Create: `catalog/reports/product-builder-pilot-v1/browser-inspection.md`
- Create: `catalog/reports/product-builder-pilot-v1/contact-sheet.png`
- Create: `catalog/reports/product-builder-pilot-v1/interaction-proof.md`

### Step 1: Run the full build

```powershell
pnpm run build
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests -q
```

### Step 2: Playtest in Chromium

Prove at least one complete path in each family:

- select body, part, palette and material;
- place on canvas;
- add opaque artwork and confirm structural overlays stay visible;
- recolour a region;
- undo/redo;
- save, reload and export;
- confirm editor guides are absent from the exported campaign.

Check 1366×768 and 1920×1080, keyboard access, console/network errors and same-page Godot/creator open-close state.

### Step 3: Gate honestly

PASS only if all 6,144 combinations resolve from the compact pack and the three witnessed family paths preserve appearance and state. This approves the combinatorial engine, not the full catalogue or classroom game.

Commit: `test: prove combinatorial product builder pilot`

---

## Deferred Until the Pilot Passes

- intentional adoption of the untracked 4,205-icon logo library;
- Openverse and Magnific supporting imagery;
- expansion from three to all product families;
- full AIDA tabs, pricing and live-market loop;
- networked classroom mode.

These remain valuable, but none should complicate the small combinatorial proof.
