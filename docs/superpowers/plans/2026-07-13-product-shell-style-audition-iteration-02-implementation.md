# Product-Shell Style Audition Iteration 02 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a second, append-only twelve-product visual audition that fixes every required finding from the first six-model panel without changing the reviewed production pack or the first audition evidence.

**Architecture:** Keep the frozen twelve-ID source and three-view SVG build contract. Replace the generic packaging rectangle with four explicit `FlatSkinGeometry` builders, revise only the weak direct-surface archetypes, and render the same deterministic static contact sheet into new `iteration-02` directories. The browser and fixed six-model panel then decide whether the direction passes or requires another numbered iteration.

**Tech Stack:** Python 3.12, Pydantic 2.13, deterministic semantic SVG/XML, pytest, local Chromium browser inspection, OpenRouter visual consensus.

## Global Constraints

- Do not modify `catalog/generated/product-shells-v1-reviewed/`.
- Do not modify, delete, move or overwrite either `catalog/generated/product-shell-style-audition-v1/iteration-01/` or `catalog/reports/product-shell-style-audition-v1/iteration-01/`.
- Write generated assets only to `catalog/generated/product-shell-style-audition-v1/iteration-02/` and evidence only to `catalog/reports/product-shell-style-audition-v1/iteration-02/`.
- Keep stable ID `audition-garden-tool` and archetype token `garden-tool`; only its title and visual geometry change to `Garden Watering Can`.
- Do not modify Claude-owned files, Games Workshop or the unrelated untracked creator/logo work.
- Keep every shell brand-free, text-free, script-free and free of external references.
- Keep clean previews, catalogue thumbnails, market cards and exports free of guide markup.
- Keep guides subtle, solid, corner-only and editor-only; do not restore thick outlines, blue dashed rectangles, textures or fixed name-placement guides.
- Packaging uses a large product-specific flat skin beside its clean mapped product preview.
- Direct-surface products use one large silhouette-following editable face.
- Retain the clean cel-shaded system: `#34414D` outer contour, `#6A7580` details, two restrained tonal planes and top-left lighting.
- The fixed visual panel order is `moonshotai/kimi-k2.7-code`, `stepfun/step-3.7-flash`, `google/gemini-3.1-pro-preview`, `xiaomi/mimo-v2.5`, `minimax/minimax-m3`, `x-ai/grok-4.5`.
- Every panel slot uses `max_tokens: 32000`, `temperature: 0.1`, and `seed: 20260713`, with an identical neutral prompt and no brevity limit.
- Retry only a failed, timed-out or truncated panel slot once; retain successful slots and never substitute a model.
- A consensus visual finding requires four slots; a readability, accessibility or serious usability correction requires two.
- Student-facing material must not use the whole words `assignment`, `unit` or `task`.

---

## File Map

- `catalog/source/product-shell-style-audition-v1/manifest.json`: retains the twelve stable IDs and retitles the garden proof.
- `pipeline/asset_pipeline/product_shell_art.py`: adds product-specific flat skins and revised direct-surface geometry.
- `pipeline/asset_pipeline/product_shell_audition.py`: retains the deterministic build and gives flat-skin cards truthful paired-view captions.
- `pipeline/tests/test_product_shell_audition.py`: freezes the iteration-02 visual contract as semantic, geometry and safety assertions.
- `catalog/generated/product-shell-style-audition-v1/iteration-02/`: new immutable authoring/preview build.
- `catalog/reports/product-shell-style-audition-v1/iteration-02/`: new QA, contact sheet, browser capture and panel evidence.

---

### Task 1: Freeze the Iteration-02 Visual Contract

**Files:**
- Modify: `catalog/source/product-shell-style-audition-v1/manifest.json`
- Modify: `pipeline/tests/test_product_shell_audition.py`

**Interfaces:**
- Consumes: the existing strict `product-shell-style-audition@1` manifest.
- Produces: unchanged stable IDs/archetypes plus the title `Garden Watering Can` and testable visual markers for the required revisions.

- [ ] **Step 1: Write the failing roster and visual-contract tests**

Change only the garden title in `EXPECTED_RECORDS`:

```python
(
    "audition-garden-tool",
    "Garden Watering Can",
    "sport-outdoors",
    "garden-tool",
),
```

Replace the false-positive angled-hoe test with these assertions:

```python
def _prototype(archetype: str):
    return next(
        item
        for item in load_audition_source(MANIFEST_PATH).prototypes
        if item.archetype == archetype
    )


def test_garden_proof_is_an_unmistakable_broad_surface_watering_can() -> None:
    root = ET.fromstring(render_audition_svg(_prototype("garden-tool"), "preview"))
    assert root.find(".//*[@data-product-part='watering-can-body']") is not None
    assert root.find(".//*[@data-product-part='watering-can-handle']") is not None
    assert root.find(".//*[@data-product-part='watering-can-spout']") is not None
    surface = artwork_surface_for("garden-tool")
    assert surface.bounds[2] >= 430
    assert surface.bounds[3] >= 300
```

Add focused semantic tests for the other direct-surface findings:

```python
@pytest.mark.parametrize(
    ("archetype", "part"),
    [
        ("aquarium", "full-front-glass"),
        ("hoodie", "hoodie-chest"),
        ("trainer", "athletic-upper"),
        ("pet-shop", "pet-shop-fascia"),
    ],
)
def test_revised_direct_surfaces_declare_the_intended_large_face(
    archetype: str, part: str
) -> None:
    root = ET.fromstring(render_audition_svg(_prototype(archetype), "preview"))
    assert root.find(f".//*[@data-product-part='{part}']") is not None
```

Add a flat-skin distinction test against the public accessor introduced in Task 2:

```python
def test_packaging_uses_four_distinct_product_specific_flat_skins() -> None:
    archetypes = ("slim-can", "sports-bottle", "snack-pouch", "takeaway-box")
    skins = [flat_skin_geometry_for(item) for item in archetypes]
    assert len({skin.surface.path for skin in skins}) == 4
    assert {skin.mapping_target for skin in skins} == set(archetypes)
    assert all(skin.surface.bounds[2] >= 680 for skin in skins)
    assert all(skin.surface.bounds[3] >= 560 for skin in skins)
```

- [ ] **Step 2: Run the focused tests to verify RED**

Run:

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -q
```

Expected: failures for the old title, missing `flat_skin_geometry_for`, the hoe marker and absent revised product-part markers.

- [ ] **Step 3: Retitle the stable garden record**

Change only:

```json
"title": "Garden Watering Can"
```

Do not change its ID, family, archetype, authoring mode, region IDs or approval state.

- [ ] **Step 4: Run the roster test**

Run:

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py::test_real_audition_manifest_has_twelve_diverse_brand_free_prototypes -q
```

Expected: PASS.

- [ ] **Step 5: Commit the contract**

```powershell
git add -- catalog/source/product-shell-style-audition-v1/manifest.json pipeline/tests/test_product_shell_audition.py
git commit -m "test: freeze product shell audition iteration 02"
```

---

### Task 2: Replace Generic Packaging Canvases with Product-Specific Skins

**Files:**
- Modify: `pipeline/asset_pipeline/product_shell_art.py`
- Modify: `pipeline/tests/test_product_shell_audition.py`

**Interfaces:**
- Consumes: `AuditionPrototype`, `ArtGeometry` and the four existing `flat-skin` archetypes.
- Produces: `FlatSkinGeometry`, `flat_skin_geometry_for(archetype: Archetype) -> FlatSkinGeometry`, and product-specific review/authoring SVG marked with `data-flat-skin-kind` and `data-mapping-target`.

- [ ] **Step 1: Add failing semantic mapping tests**

Import `flat_skin_geometry_for`, then add:

```python
@pytest.mark.parametrize(
    ("archetype", "markers"),
    [
        ("slim-can", {"wrap-seam", "can-rim"}),
        ("sports-bottle", {"bottle-shoulder", "wrap-seam"}),
        ("snack-pouch", {"pouch-seal", "pouch-gusset"}),
        ("takeaway-box", {"box-fold", "box-flap"}),
    ],
)
def test_flat_skin_review_explains_its_product_mapping(
    archetype: str, markers: set[str]
) -> None:
    root = ET.fromstring(render_audition_svg(_prototype(archetype), "review"))
    shell = root.find(".//*[@data-product-shell='flat-skin']")
    assert shell is not None
    assert shell.get("data-mapping-target") == archetype
    actual = {
        item.get("data-mapping-part")
        for item in root.findall(".//*[@data-mapping-part]")
    }
    assert markers <= actual
```

Retain all existing safety assertions: no text, image, script, external URL, gradient, dashed stroke or preview guide metadata.

- [ ] **Step 2: Run the new mapping test to verify RED**

Run:

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py::test_flat_skin_review_explains_its_product_mapping -q
```

Expected: FAIL because all four packages still use the generic rectangle and crosshair seams.

- [ ] **Step 3: Add the exact flat-skin interface**

Replace `_FLAT_SKIN_SURFACES` and `_flat_skin_regions` with:

```python
@dataclass(frozen=True, slots=True)
class FlatSkinGeometry:
    surface: ArtworkSurface
    regions: dict[str, tuple[str, ...]]
    details: tuple[str, ...]
    mapping_target: str


FlatSkinBuilder = Callable[[], FlatSkinGeometry]


def flat_skin_geometry_for(archetype: Archetype) -> FlatSkinGeometry:
    try:
        builder = FLAT_SKIN_BUILDERS[archetype]
    except KeyError as error:
        raise ValueError(f"{archetype} does not use flat-skin authoring") from error
    return builder()
```

Define a closed `FLAT_SKIN_BUILDERS` table for exactly `slim-can`, `sports-bottle`, `snack-pouch` and `takeaway-box`.

- [ ] **Step 4: Implement four explicit blank skin geometries**

Use these distinct bounded shapes and semantic cues:

```python
def _slim_can_skin() -> FlatSkinGeometry:
    surface = ArtworkSurface(
        "M155 220Q500 180 845 220V780Q500 820 155 780Z",
        (155, 180, 690, 640),
    )
    # Curved rim bands, one narrow overlap seam and a broad central label face.


def _sports_bottle_skin() -> FlatSkinGeometry:
    surface = ArtworkSurface(
        "M150 215H850L810 315V685L850 785H150L190 685V315Z",
        (150, 215, 700, 570),
    )
    # Shoulder tapers identify top/bottom orientation; one wrap seam remains narrow.


def _snack_pouch_skin() -> FlatSkinGeometry:
    surface = ArtworkSurface(
        "M150 180H850L880 800Q790 840 700 815Q500 855 300 815Q210 840 120 800Z",
        (120, 180, 760, 675),
    )
    # Separate top seal, bottom gusset and side folds; the central face stays dominant.


def _takeaway_box_skin() -> FlatSkinGeometry:
    surface = ArtworkSurface(
        "M120 300H340V180H760V300H900V700H760V820H340V700H120Z",
        (120, 180, 780, 640),
    )
    # A simple cross-shaped dieline with solid fold ticks and broad lid/front faces.
```

Each builder returns the manifest's ordered `body`, `trim`, `accent` and `label` regions. Add the required `data-mapping-part` attributes directly to detail paths. Do not add sample words, logos, icons or persuasive decoration.

- [ ] **Step 5: Route flat-skin rendering through the new geometry**

Update `_semantic_regions` to consume `flat_skin.regions` when one is present. Update `_flat_skin_layers` to accept `FlatSkinGeometry` and emit:

```python
f'<g data-product-shell="flat-skin" data-flat-skin-kind="product-specific" '
f'data-mapping-target="{escape(flat_skin.mapping_target)}" ...>{regions}</g>'
```

Render `flat_skin.details` in the existing detail style. In `render_audition_svg`, select `flat_skin_geometry_for(prototype.archetype)` only when `authoring_mode == "flat-skin" and view != "preview"`; keep clean preview clipping on `geometry.surface`.

- [ ] **Step 6: Raise guide visibility only slightly**

Change review opacity from `0.42` to `0.52`, update the exact test, and retain `fill-opacity="0.10"`, `DETAIL_STROKE == 3`, solid strokes and preview guide absence.

- [ ] **Step 7: Run focused tests to verify GREEN**

Run:

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -q
```

Expected: all source, SVG safety, mapping, geometry, determinism and build tests pass.

- [ ] **Step 8: Commit the product-specific skins**

```powershell
git add -- pipeline/asset_pipeline/product_shell_art.py pipeline/tests/test_product_shell_audition.py
git commit -m "feat: add product specific packaging skins"
```

---

### Task 3: Revise the Five Weak Direct-Surface Proofs

**Files:**
- Modify: `pipeline/asset_pipeline/product_shell_art.py`
- Modify: `pipeline/tests/test_product_shell_audition.py`

**Interfaces:**
- Consumes: unchanged `ArtGeometry` and `GEOMETRY_BUILDERS` interfaces.
- Produces: revised garden, aquarium, hoodie, trainer and pet-shop SVG geometry while leaving the seven accepted archetypes structurally intact.

- [ ] **Step 1: Add failing surface-shape assertions**

Add:

```python
def test_revised_direct_surface_bounds_are_large_and_product_specific() -> None:
    expected = {
        "garden-tool": (430, 300),
        "aquarium": (680, 340),
        "hoodie": (470, 360),
        "trainer": (570, 250),
        "pet-shop": (700, 170),
    }
    for archetype, (minimum_width, minimum_height) in expected.items():
        _, _, width, height = artwork_surface_for(archetype).bounds
        assert width >= minimum_width
        assert height >= minimum_height
```

Add a trainer test requiring at least six `data-product-part="trainer-lace"` paths and an aquarium test asserting that no element carries `data-product-part="fixed-water-wave"`.

- [ ] **Step 2: Run the direct-surface tests to verify RED**

Run the two new tests. Expected: old hoe, lower aquarium fascia, ambiguous trainer and old markers fail.

- [ ] **Step 3: Replace the garden proof with a watering can**

Keep `_garden_tool()` as the registered function but draw:

- a broad rounded can body marked `data-product-part="watering-can-body"`;
- a large open handle marked `data-product-part="watering-can-handle"`;
- a long tapered spout and rose marked `data-product-part="watering-can-spout"`;
- one body-following editable surface at least 430×300;
- right/lower shadow and upper-left highlight planes.

Use the Magnific candidate `419038900` only as a silhouette and blank-surface reference. Do not embed its preview or claim it as an acquired production asset.

- [ ] **Step 4: Expand the aquarium to the full front glass**

Make `surface.path` the full front glass and mark that same path `data-product-part="full-front-glass"`. Remove the fixed mid-glass wave. Keep only a shallow bottom gravel/accent band outside the dominant editable area, with the frame/lid/base still fixed and recolourable.

- [ ] **Step 5: Make the hoodie chest unmistakably editable**

Move the accent away from a dominant peach pocket, mark the broad front torso `data-product-part="hoodie-chest"`, and keep pocket seams as neutral line details. The surface must cover the torso chest rather than imply that only the pocket accepts artwork.

- [ ] **Step 6: Redraw the trainer as an athletic lateral shoe**

Remove the crosshatch lattice. Mark one broad lateral upper `data-product-part="athletic-upper"`; add tongue, eye stay and six or more separate solid lace paths marked `data-product-part="trainer-lace"`. Keep the sole and heel as secondary planes and retain one dominant blank upper.

- [ ] **Step 7: Clarify the pet-shop storefront without supplying a logo**

Mark and enlarge the blank sign face as `data-product-part="pet-shop-fascia"`. Simplify the awning/window divisions, keep windows generous, and use only subtle fixed scale cues such as a low bowl outline or rounded doorway detail. Do not add animal silhouettes, words or finished branding.

- [ ] **Step 8: Declare and inspect the shared light direction**

Add `data-light-direction="top-left"` to the SVG root. Keep every revised highlight on the upper/left plane and every revised shadow on the right/lower plane; verify this visually in Task 5 rather than pretending a string test proves lighting quality.

- [ ] **Step 9: Run focused and full pipeline tests**

Run:

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -q
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests -q
```

Expected: both pass with no skip and the accepted production pack absent from `git diff`.

- [ ] **Step 10: Commit the revised direct surfaces**

```powershell
git add -- pipeline/asset_pipeline/product_shell_art.py pipeline/tests/test_product_shell_audition.py
git commit -m "feat: revise weak product shell proofs"
```

---

### Task 4: Build Immutable Iteration-02 Evidence

**Files:**
- Modify: `pipeline/asset_pipeline/product_shell_audition.py`
- Modify: `pipeline/tests/test_product_shell_audition.py`
- Create: `catalog/generated/product-shell-style-audition-v1/iteration-02/`
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-02/`

**Interfaces:**
- Consumes: `build_product_shell_audition(source_path, output_dir, report_dir)` with two absent iteration-02 targets.
- Produces: canonical runtime/report bytes with the same output schema and no mutation of iteration 01.

- [ ] **Step 1: Test truthful contact-sheet captions**

For each flat-skin record, require the paired captions `Mapped product preview` and `Editable product skin`. For direct-surface records, retain `Clean preview` and `Editor-selected`. Keep exactly twelve preview SVGs, twelve review SVGs, no script, image, external URL or remote font.

- [ ] **Step 2: Implement conditional captions only**

In `_render_contact_sheet`, set:

```python
if prototype.authoring_mode == "flat-skin":
    preview_caption = "Mapped product preview"
    review_caption = "Editable product skin"
else:
    preview_caption = "Clean preview"
    review_caption = "Editor-selected"
```

Do not add JavaScript or change the build schema.

- [ ] **Step 3: Run deterministic-build tests**

Run the focused test file twice. Expected: both runs pass and temporary output trees are byte-identical.

- [ ] **Step 4: Confirm protected paths are clean before generation**

Run:

```powershell
git diff --exit-code HEAD -- catalog/generated/product-shells-v1-reviewed catalog/generated/product-shell-style-audition-v1/iteration-01 catalog/reports/product-shell-style-audition-v1/iteration-01
```

Expected: exit 0. Confirm both iteration-02 targets do not exist.

- [ ] **Step 5: Generate only iteration 02**

Run:

```powershell
pipeline\.venv\Scripts\python.exe -m asset_pipeline.product_shell_audition --source catalog/source/product-shell-style-audition-v1/manifest.json --out catalog/generated/product-shell-style-audition-v1/iteration-02 --report catalog/reports/product-shell-style-audition-v1/iteration-02
```

Expected: `{"prototypes": 12}` and no overwrite error.

- [ ] **Step 6: Reconfirm protected paths are unchanged**

Repeat the exact `git diff --exit-code` command from Step 4. Expected: exit 0. Verify `catalog/generated/product-shells-v1-reviewed/` still contains 141 files.

- [ ] **Step 7: Commit only iteration-02 build evidence**

```powershell
git add -- pipeline/asset_pipeline/product_shell_audition.py pipeline/tests/test_product_shell_audition.py catalog/generated/product-shell-style-audition-v1/iteration-02 catalog/reports/product-shell-style-audition-v1/iteration-02
git commit -m "feat: build product shell audition iteration 02"
```

---

### Task 5: Inspect Iteration 02 in Chromium

**Files:**
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-02/contact-sheet.png`
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-02/browser-inspection.md`

**Interfaces:**
- Consumes: the new self-contained `contact-sheet.html` over localhost.
- Produces: one exact browser screenshot and a concise mechanical/visual inspection record.

- [ ] **Step 1: Serve the project without changing files**

Run a local HTTP server on an unused loopback port and open the iteration-02 contact sheet in Chromium at 2400×1800.

- [ ] **Step 2: Verify the rendered document**

Require twelve cards, twenty-four inline SVGs, zero console errors, zero failed requests and zero HTTP responses at or above 400. Confirm the four flat-skin cards show a product-specific skin beside its matching clean product.

- [ ] **Step 3: Inspect the required visual corrections**

Record PASS/FAIL for:

- watering can recognisability without reading its title;
- distinct can, bottle, pouch and box skin geometry;
- full-front aquarium customisation with little fixed decoration;
- whole hoodie chest, not merely the pocket, reading as editable;
- clear laced athletic trainer with a large blank upper;
- pet-shop category clarity plus generous blank fascia/windows;
- subtle solid editor guides and fully guide-free previews;
- top-left lighting, thumbnail contrast and no accidental clipping;
- no words, logos, price tags, slogans or finished persuasive content.

- [ ] **Step 4: Capture the complete sheet**

Save the exact rendered `main` region to `contact-sheet.png`. Record dimensions, byte size and SHA-256 in `browser-inspection.md` together with viewport and console/network results.

- [ ] **Step 5: Commit browser evidence**

```powershell
git add -- catalog/reports/product-shell-style-audition-v1/iteration-02/contact-sheet.png catalog/reports/product-shell-style-audition-v1/iteration-02/browser-inspection.md
git commit -m "test: inspect product shell audition iteration 02"
```

---

### Task 6: Run the Fixed Six-Model Iteration-02 Visual Gate

**Files:**
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-02/visual-consensus-raw.md`
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-02/visual-consensus-synthesis.md`
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-02/visual-gate.json`

**Interfaces:**
- Consumes: the exact iteration-02 PNG, neutral game context, iteration-01 required findings and the approved visual-system specification.
- Produces: six independent labelled reviews, a rule-based root synthesis and immutable `VISUAL_PANEL_PASS`, `VISUAL_PANEL_REVISE` or `VISUAL_PANEL_REJECT` evidence.

- [ ] **Step 1: Send identical neutral evidence to all six fixed models**

Use the exact panel order and call values from Global Constraints. Ask each reviewer independently whether iteration 02 resolves the prior watering-can, flat-skin, aquarium, pet-shop, hoodie, trainer and guide issues while preserving recognisability, desirability, blank creative space, thumbnail legibility and visual coherence. Do not reveal Codex's preferred verdict or another slot's answer.

- [ ] **Step 2: Retry failed slots only once**

Retain every successful response. Retry only a failed, timed-out or explicitly truncated slot with identical evidence and parameters. Mark a persistent failure `NO RESULT`; never substitute a model.

- [ ] **Step 3: Save raw labelled responses and synthesise by rule**

The synthesis records per-finding support counts, accessibility/usability support counts, unique concrete risks, disagreements and the root resolution against the browser evidence and fixed product constraints. Ground the decision in findings, not a majority-vote shortcut.

- [ ] **Step 4: Write and verify the immutable gate**

Write `visual-gate.json` with all six slot statuses and SHA-256 hashes for the PNG, raw record and synthesis. Verify each expected model label occurs exactly once and every stored hash matches.

- [ ] **Step 5: Run tests and commit the gate**

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -q
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests -q
git add -- catalog/reports/product-shell-style-audition-v1/iteration-02 pipeline/tests/test_product_shell_audition.py
git commit -m "review: gate product shell audition iteration 02"
```

If the result is `VISUAL_PANEL_PASS`, stop the audition loop and write a separate catalogue-scaling/promotion plan. If it is `VISUAL_PANEL_REVISE`, retain iteration 02 unchanged and write only the next bounded numbered iteration; do not scale rejected geometry.

---

## Plan Self-Review

- **Spec coverage:** Every consensus correction from iteration 01 maps to a test, geometry change, browser check and repeated fixed-panel gate.
- **Scope:** Stable IDs, schemas and static report architecture remain intact; no runtime editor or production catalogue change is smuggled into the audition.
- **Isolation:** All generated changes are append-only in iteration 02, with explicit before/after checks for the 141-file production pack and iteration 01.
- **Safety:** SVG remains local, semantic, text-free, script-free and guide-free in preview; no deletion or move is required.
- **Type consistency:** `FlatSkinGeometry`, `flat_skin_geometry_for`, `ArtGeometry`, `artwork_surface_for`, `render_audition_svg` and `build_product_shell_audition` have one stable meaning across all tasks.
- **Placeholder scan:** No unresolved marker, unspecified handler or delegated design decision remains in the plan.
