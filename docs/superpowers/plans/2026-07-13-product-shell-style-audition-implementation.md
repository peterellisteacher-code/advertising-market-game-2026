# Product-Shell Style Audition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and visually validate twelve genuinely editable, clean cel-shaded product-shell prototypes before changing or scaling the reviewed production catalogue.

**Architecture:** A new audition-only compiler reads a strict twelve-record manifest and calls a pure SVG art renderer. It writes three safe deterministic views per prototype: a guide-hidden authoring asset, a clean catalogue/market preview, and a review-only editor-selected view. Every audition iteration writes to a new directory, so no earlier evidence or production asset is overwritten; only a passed direction can later receive a separate promotion plan.

**Tech Stack:** Python 3.12, Pydantic 2.13, deterministic SVG/XML, pytest, local Chromium/Playwright browser inspection, OpenRouter visual consensus.

## Global Constraints

- Do not modify `catalog/generated/product-shells-v1-reviewed/` during this plan.
- Do not delete, move or overwrite an earlier audition iteration; write `iteration-02`, `iteration-03`, and so on after material revisions.
- Do not modify Claude-owned files or anything in Games Workshop.
- Every shell remains brand-free, text-free, script-free, externally reference-free and editable as semantic SVG.
- Catalogue thumbnails, market cards and exports contain no guides or guide metadata.
- Authoring assets contain a hidden guide layer; the review-only view reveals subtle corner guides without a dashed rectangle.
- Packaging shells use a large flat skin authoring surface beside a synchronised cel-shaded preview.
- Direct-product shells use a large silhouette-following artwork surface and independently recolourable semantic regions.
- Contours, details, highlights and shadow planes sit outside `data-region` groups so Fabric recolouring cannot flatten or recolour them.
- The audition emits `audition.json`, never `catalog.json` or `product-shell-catalog@1`, and is not referenced by `index.html`, `scripts/build-web.mjs`, `scripts/verify-web-export.mjs` or the production web build.
- The fixed visual panel is `moonshotai/kimi-k2.7-code`, `stepfun/step-3.7-flash`, `google/gemini-3.1-pro-preview`, `xiaomi/mimo-v2.5`, `minimax/minimax-m3`, and `x-ai/grok-4.5`, in that order.
- Every panel slot uses `max_tokens: 32000`; prompts impose no word count or brevity limit.
- Retry only a failed, timed-out or truncated panel slot, once, with unchanged evidence and instructions.
- Student-facing material must not use the whole words `assignment`, `unit` or `task`.

---

## File Map

- `pipeline/asset_pipeline/product_shell_art.py`: pure archetype geometry, semantic layers and safe SVG rendering.
- `pipeline/asset_pipeline/product_shell_audition.py`: Pydantic contract, manifest loading, deterministic build, catalogue, QA and contact-sheet report.
- `pipeline/tests/test_product_shell_audition.py`: contract, safety, determinism, geometry and report tests.
- `catalog/source/product-shell-style-audition-v1/manifest.json`: exactly twelve audition recipes.
- `catalog/generated/product-shell-style-audition-v1/iteration-01/`: deterministic authoring and preview assets plus audition snapshot.
- `catalog/reports/product-shell-style-audition-v1/iteration-01/`: review SVGs, QA, contact sheet, rendered PNG and visual-panel record.
- `.gitignore`: narrow exceptions for this audition's generated and report roots only.

---

### Task 1: Freeze the Twelve-Prototype Contract

**Files:**
- Create: `pipeline/tests/test_product_shell_audition.py`
- Create: `pipeline/asset_pipeline/product_shell_audition.py`
- Create: `catalog/source/product-shell-style-audition-v1/manifest.json`

**Interfaces:**
- Consumes: one local UTF-8 JSON document with schema `product-shell-style-audition@1`.
- Produces: `AuditionSource`, `AuditionPrototype`, `AuditionBuildResult` and `load_audition_source(path: Path) -> AuditionSource`.

- [ ] **Step 1: Write the failing source-contract tests**

Add tests that load the real manifest and assert the exact audition roster:

```python
EXPECTED = {
    "slim-can": "flat-skin",
    "sports-bottle": "flat-skin",
    "snack-pouch": "flat-skin",
    "takeaway-box": "flat-skin",
    "hoodie": "direct-surface",
    "trainer": "direct-surface",
    "smartphone": "direct-surface",
    "headphones": "direct-surface",
    "food-truck": "direct-surface",
    "garden-tool": "direct-surface",
    "aquarium": "direct-surface",
    "pet-shop": "direct-surface",
}

def test_real_audition_manifest_has_twelve_diverse_brand_free_prototypes() -> None:
    source = load_audition_source(PROJECT_ROOT / "catalog/source/product-shell-style-audition-v1/manifest.json")
    assert {item.archetype: item.authoring_mode for item in source.prototypes} == EXPECTED
    assert len({item.id for item in source.prototypes}) == 12
    assert all(item.brand_free for item in source.prototypes)
    assert all(item.status == "audition" for item in source.prototypes)
```

Add negative tests for duplicate IDs, an unknown archetype, extra/missing prototypes, non-hex colours, non-portable IDs, non-local content, and `classroomReviewed: true`. Audition records must be explicitly unapproved until the visual gate passes.

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -q
```

Expected: collection fails because `asset_pipeline.product_shell_audition` does not exist.

- [ ] **Step 3: Implement the strict manifest models and loader**

Use these public types and validators:

```python
AuthoringMode = Literal["flat-skin", "direct-surface"]
Archetype = Literal[
    "slim-can", "sports-bottle", "snack-pouch", "takeaway-box",
    "hoodie", "trainer", "smartphone", "headphones", "food-truck",
    "garden-tool", "aquarium", "pet-shop",
]

class AuditionPrototype(ContractModel):
    id: str
    title: str
    family: str
    archetype: Archetype
    authoring_mode: AuthoringMode = Field(alias="authoringMode")
    regions: list[ShellRegion]
    brand_free: Literal[True] = Field(alias="brandFree")
    status: Literal["audition"]

class AuditionSource(ContractModel):
    schema_id: Literal["product-shell-style-audition@1"] = Field(alias="schema")
    pack_id: Literal["product-shell-style-audition-v1"] = Field(alias="packId")
    prototypes: list[AuditionPrototype]

def load_audition_source(path: Path) -> AuditionSource:
    if not path.is_file() or path.stat().st_size > 1_048_576:
        raise ProductShellAuditionError("audition manifest is missing or too large")
    source = AuditionSource.model_validate_json(path.read_text("utf-8"), strict=True)
    if len(source.prototypes) != 12:
        raise ProductShellAuditionError("audition requires exactly twelve prototypes")
    if len({item.id for item in source.prototypes}) != 12:
        raise ProductShellAuditionError("prototype IDs must be unique")
    if {item.archetype for item in source.prototypes} != set(get_args(Archetype)):
        raise ProductShellAuditionError("audition archetype roster is incomplete")
    return source
```

Reuse the existing portable-ID, trimmed-text, six-digit-hex and `ContractModel` conventions. Do not import or call the existing low-fidelity `_template_shapes` renderer.

- [ ] **Step 4: Author the twelve-record source manifest**

Use these stable IDs and neutral launch colours:

```json
[
  ["audition-slim-can", "Slim Drink Can", "drinks-snacks", "slim-can", "flat-skin"],
  ["audition-sports-bottle", "Sports Drink Bottle", "drinks-snacks", "sports-bottle", "flat-skin"],
  ["audition-snack-pouch", "Snack Pouch", "drinks-snacks", "snack-pouch", "flat-skin"],
  ["audition-takeaway-box", "Takeaway Box", "fast-food-hospitality", "takeaway-box", "flat-skin"],
  ["audition-hoodie", "Hoodie", "fashion-footwear", "hoodie", "direct-surface"],
  ["audition-trainer", "Trainer", "fashion-footwear", "trainer", "direct-surface"],
  ["audition-smartphone", "Smartphone", "tech-gadgets", "smartphone", "direct-surface"],
  ["audition-headphones", "Headphones", "tech-gadgets", "headphones", "direct-surface"],
  ["audition-food-truck", "Food Truck", "fast-food-hospitality", "food-truck", "direct-surface"],
  ["audition-garden-tool", "Garden Tool", "sport-outdoors", "garden-tool", "direct-surface"],
  ["audition-aquarium", "Aquarium", "pets-animals", "aquarium", "direct-surface"],
  ["audition-pet-shop", "Pet Shop", "shops-services", "pet-shop", "direct-surface"]
]
```

Each record has three or four ordered semantic regions drawn from `body`, `trim`, `accent`, `label`, `screen`, `glass`, `handle`, `sole`, `upper`, `awning`, `sign` and `window`. Use `#F4F1EA` for the principal neutral body, `#DCE4E8` for the secondary plane, `#A8B8C4` for restrained trim and `#E9C8B8` for the audition accent. These are starting values, not locked colours.

- [ ] **Step 5: Run the source-contract tests to verify GREEN**

Run the focused pytest command from Step 2. Expected: source-validation tests pass while renderer/build tests are not yet present.

- [ ] **Step 6: Commit the frozen contract**

```powershell
git add -- pipeline/asset_pipeline/product_shell_audition.py pipeline/tests/test_product_shell_audition.py catalog/source/product-shell-style-audition-v1/manifest.json
git commit -m "test: freeze product shell style audition"
```

---

### Task 2: Render Safe Editable Cel-Shaded SVG

**Files:**
- Create: `pipeline/asset_pipeline/product_shell_art.py`
- Modify: `pipeline/tests/test_product_shell_audition.py`
- Modify: `pipeline/asset_pipeline/product_shell_audition.py`

**Interfaces:**
- Consumes: one validated `AuditionPrototype`.
- Produces: `render_audition_svg(prototype: AuditionPrototype, view: Literal["authoring", "preview", "review"]) -> str` and `artwork_surface_for(archetype: Archetype) -> ArtworkSurface`.

- [ ] **Step 1: Write failing SVG rendering tests**

Test all twelve archetypes and all three views:

```python
@pytest.mark.parametrize("view", ["authoring", "preview", "review"])
def test_all_audition_views_are_safe_parseable_semantic_svg(view: str) -> None:
    for prototype in load_real_source().prototypes:
        svg = render_audition_svg(prototype, view=view)
        root = ET.fromstring(svg)
        assert root.get("viewBox") == "0 0 1000 1000"
        assert root.get("data-shell-id") == prototype.id
        assert root.findall(".//*[@data-region]")
        lowered = svg.lower()
        assert not any(token in lowered for token in ("<text", "<image", "<script", " href=", "xlink:href", " onload="))
```

Add exact style assertions:

```python
assert 'stroke="#34414D"' in preview
assert 'stroke-width="6"' in preview
assert 'data-tone="shadow"' in preview
assert 'data-tone="highlight"' in preview
assert 'data-guide-overlay' not in preview
assert 'data-guide-overlay="true" visibility="hidden"' in authoring
assert 'data-guide-overlay="true" visibility="visible"' in review
assert "stroke-dasharray" not in authoring + preview + review
assert 'data-artwork-surface="primary"' in authoring
assert 'clip-path="url(#' in preview
```

For `flat-skin` records, assert that authoring contains `data-authoring-mode="flat-skin"` and a surface occupying at least 680×560 logical pixels. For direct-surface records, assert the artwork surface's bounds are contained by the product bounds. Preview and authoring files must contain the same ordered `data-region` IDs.

Assert minimum editable-face coverage from declared geometry bounds: packaging at least 70%, apparel/devices at least 55%, and irregular products/storefronts at least 35%. These numeric checks are a coarse guard; browser inspection still decides whether a curved or irregular mask is genuinely useful.

- [ ] **Step 2: Run the focused renderer tests to verify RED**

Run:

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -q
```

Expected: renderer imports or assertions fail because `product_shell_art.py` is absent.

- [ ] **Step 3: Implement the shared art primitives and style tokens**

Define the system once:

```python
INK = "#34414D"
DETAIL_INK = "#6A7580"
PAPER = "#F4F1EA"
GUIDE = "#6C5CE7"
OUTER_STROKE = 6
DETAIL_STROKE = 3

@dataclass(frozen=True, slots=True)
class ArtworkSurface:
    path: str
    bounds: tuple[float, float, float, float]

@dataclass(frozen=True, slots=True)
class ArtGeometry:
    product_bounds: tuple[float, float, float, float]
    regions: dict[str, tuple[str, ...]]
    details: tuple[str, ...]
    shadow_plane: str
    highlight_plane: str
    surface: ArtworkSurface

def _region(name: str, fill: str, fragments: Iterable[str]) -> str:
    return f'<g data-region="{escape(name)}" fill="{escape(fill)}">{"".join(fragments)}</g>'

def _corner_guides(x: float, y: float, width: float, height: float) -> str:
    length = min(width, height) * 0.085
    paths = (
        f"M{x + length} {y}H{x}V{y + length}",
        f"M{x + width - length} {y}H{x + width}V{y + length}",
        f"M{x} {y + height - length}V{y + height}H{x + length}",
        f"M{x + width} {y + height - length}V{y + height}H{x + width - length}",
    )
    return "".join(f'<path d="{path}"/>' for path in paths)
```

Use no gradients and no `vector-effect`. Dimensionality comes from two flat planes: `data-tone="shadow" fill="#34414D" opacity="0.10"` and `data-tone="highlight" fill="#FFFFFF" opacity="0.34"`. Preview-only grounding shadows use `opacity="0.14"`. Outer contours use six logical pixels and internal details use three; at a 300-pixel thumbnail this renders as approximately 1.8 and 0.9 screen pixels rather than the rejected heavy outline. Keep every product inside logical coordinates 50–950 and use round line caps/joins.

- [ ] **Step 4: Implement the twelve explicit archetype geometry functions**

Create one bounded function per archetype and a closed dispatch table:

```python
GEOMETRY_BUILDERS: dict[Archetype, Callable[[], ArtGeometry]] = {
    "slim-can": _slim_can,
    "sports-bottle": _sports_bottle,
    "snack-pouch": _snack_pouch,
    "takeaway-box": _takeaway_box,
    "hoodie": _hoodie,
    "trainer": _trainer,
    "smartphone": _smartphone,
    "headphones": _headphones,
    "food-truck": _food_truck,
    "garden-tool": _garden_tool,
    "aquarium": _aquarium,
    "pet-shop": _pet_shop,
}
```

Geometry requirements are exact:

- `slim-can`: 330×700 cylindrical body, elliptical rim, right-side shadow plane, curved highlight, and a 720×580 flat-skin canvas.
- `sports-bottle`: tapered shoulder, separate cap and grip regions, contoured front label mask, and a 700×570 flat-skin canvas.
- `snack-pouch`: gusseted pouch silhouette, top seal and side fold details, broad front mask, and a 720×600 flat-skin canvas.
- `takeaway-box`: three-quarter clamshell with top, front and right planes, front/top artwork mapping, and a 720×560 flat-skin canvas.
- `hoodie`: front-facing torso, sleeves, hood, pocket and drawcord details with a broad chest surface.
- `trainer`: recognisable lateral shoe silhouette, sole/upper/lace regions and a clipped side-panel surface.
- `smartphone`: softly rounded device in slight three-quarter view, separate frame and screen with the screen as the primary surface.
- `headphones`: arched headband, two ear cups and an editable outer-cup disc; the second cup remains a tonal depth plane.
- `food-truck`: three-quarter vehicle, serving hatch, awning and large side-panel surface.
- `garden-tool`: long recolourable shaft, grip and angled garden-hoe head with a clean shaft badge surface; no text or euphemistic imagery.
- `aquarium`: glass tank, water plane, lid/base and broad front-fascia surface while preserving transparent glass.
- `pet-shop`: friendly storefront with awning, door, two windows and a large sign surface; no animals, logos or supplied persuasive content.

Each builder returns only constant local SVG primitives/paths. No manifest field is injected as raw SVG.

- [ ] **Step 5: Implement view composition**

`render_audition_svg` must:

1. prefix every `clipPath` ID with the prototype ID;
2. render semantic regions in manifest order;
3. create an empty `data-artwork-slot="primary"` group clipped to the exact surface path;
4. render clean preview shading and no guide markup;
5. render a non-stroked hidden surface path carrying `data-print-area="primary"`, plus a hidden corner-guide group, in authoring;
6. render the same group visibly at 42% opacity in review;
7. replace the object silhouette with the large flat surface only for `flat-skin` authoring/review views;
8. include no supplied text, logo, icon or advertising content.

The preview contains neither `data-print-area` nor `data-guide-overlay`. The later live integration will need a versioned mapping between flat artwork and the three-quarter preview; proving that mapping visually is in scope here, but changing the current Fabric runtime is not.

- [ ] **Step 6: Run focused tests to verify GREEN**

Run the focused pytest command. Expected: all contract and rendering tests pass for 36 generated SVG documents.

- [ ] **Step 7: Commit the renderer**

```powershell
git add -- pipeline/asset_pipeline/product_shell_art.py pipeline/asset_pipeline/product_shell_audition.py pipeline/tests/test_product_shell_audition.py
git commit -m "feat: render cel shaded product shell audition"
```

---

### Task 3: Build Deterministic Audition Evidence

**Files:**
- Modify: `pipeline/asset_pipeline/product_shell_audition.py`
- Modify: `pipeline/tests/test_product_shell_audition.py`
- Modify: `.gitignore`
- Create: `catalog/generated/product-shell-style-audition-v1/iteration-01/`
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-01/`

**Interfaces:**
- Consumes: `build_product_shell_audition(source_path: Path, output_dir: Path, report_dir: Path) -> AuditionBuildResult` arguments that point to absent or empty directories.
- Produces: canonical `audition.json`, canonical source snapshot, 24 runtime SVGs, 12 review SVGs, QA JSON and one self-contained contact-sheet HTML file.

- [ ] **Step 1: Write failing deterministic-build tests**

Build the same source into two temporary directory pairs and assert byte equality for every relative file. Assert this catalogue shape:

```python
assert audition["schema"] == "product-shell-style-audition-output@1"
assert audition["status"] == "audition"
assert len(audition["prototypes"]) == 12
assert audition["prototypes"][0].keys() >= {
    "id", "title", "family", "archetype", "authoringMode",
    "authoringSvg", "previewSvg", "regions", "artworkSurface", "brandFree",
}
```

Assert that each runtime prototype contains `authoring.svg` and `preview.svg`, while `review.svg` exists only under the report tree. Assert `qa.json` records `prototypeCount: 12`, `errors: []`, `reviewStatus: "PENDING_VISUAL_PANEL"`, hashes for every emitted SVG, and the canonical source snapshot hash. Assert `catalog.json` is absent. Assert a non-empty output/report directory is rejected before any write.

- [ ] **Step 2: Run focused tests to verify RED**

Run the focused pytest command. Expected: build assertions fail because the build/report layer is incomplete.

- [ ] **Step 3: Implement deterministic output and report generation**

Use canonical sorted-key compact JSON with a trailing newline. Sort prototypes by stable ID. Prepare every byte string before creating either output directory. Reuse the existing non-destructive rule:

```python
def _require_empty(path: Path, label: str) -> None:
    if path.exists() and (not path.is_dir() or any(path.iterdir())):
        raise ProductShellAuditionError(f"{label} must be absent or empty")
```

The contact sheet uses four columns by three rows. Each card displays the clean preview and review-only editor-selected view side by side, with the product title and `Flat skin` or `Direct surface` beneath. It has no remote CSS, fonts, scripts or images. The page background is warm off-white, cards are white with a one-pixel neutral border, and no blue dashed guide appears anywhere. The audition writer emits `audition.json`; it must never emit a production `catalog.json`.

- [ ] **Step 4: Add narrow Git exceptions**

Append only:

```gitignore
!catalog/generated/product-shell-style-audition-v1/
!catalog/generated/product-shell-style-audition-v1/**
!catalog/reports/product-shell-style-audition-v1/
!catalog/reports/product-shell-style-audition-v1/**
```

Do not unignore any other catalogue report or generated pack.

- [ ] **Step 5: Run focused and full pipeline tests**

Run:

```powershell
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests/test_product_shell_audition.py -q
pipeline\.venv\Scripts\python.exe -m pytest pipeline/tests -q
```

Expected: both commands pass with no skipped test and no production-shell output change.

- [ ] **Step 6: Generate iteration 01 into new paths**

Run:

```powershell
pipeline\.venv\Scripts\python.exe -m asset_pipeline.product_shell_audition --source catalog/source/product-shell-style-audition-v1/manifest.json --out catalog/generated/product-shell-style-audition-v1/iteration-01 --report catalog/reports/product-shell-style-audition-v1/iteration-01
```

Expected: JSON reports twelve prototypes and both target directories were absent before the command.

- [ ] **Step 7: Verify the production pack is byte-unchanged**

Record a recursive SHA-256 inventory of `catalog/generated/product-shells-v1-reviewed/` before Task 3 and compare it after generation. Expected: identical relative paths and hashes.

- [ ] **Step 8: Commit deterministic audition evidence**

Stage exact paths only:

```powershell
git add -- .gitignore pipeline/asset_pipeline/product_shell_audition.py pipeline/tests/test_product_shell_audition.py catalog/source/product-shell-style-audition-v1 catalog/generated/product-shell-style-audition-v1/iteration-01 catalog/reports/product-shell-style-audition-v1/iteration-01
git commit -m "feat: build product shell style audition"
```

---

### Task 4: Render and Inspect the Real Contact Sheet

**Files:**
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-01/contact-sheet.png`
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-01/browser-inspection.md`

**Interfaces:**
- Consumes: the generated self-contained `contact-sheet.html` served from project root.
- Produces: one full-resolution browser PNG and a concise inspection record with viewport, console and network results.

- [ ] **Step 1: Serve the project without changing files**

Run from project root:

```powershell
python -m http.server 8770 --bind 127.0.0.1
```

Open `http://127.0.0.1:8770/catalog/reports/product-shell-style-audition-v1/iteration-01/contact-sheet.html`.

- [ ] **Step 2: Capture the complete sheet in Chromium**

Resize the browser to 2400×1800 and save a full-page PNG to the exact report path. Wait for all 24 SVG images to report `complete && naturalWidth > 0` before capture. Record zero failed local requests and zero browser-console errors.

- [ ] **Step 3: Perform the human visual preflight**

Inspect every card at full sheet and editor zoom. Record PASS/FAIL for:

- recognisable silhouette without the title;
- clean guide-free preview;
- fine rather than sticker-like contour;
- two or three restrained tonal planes;
- dominant usable artwork surface;
- clear authoring-versus-preview relationship;
- no supplied logo, words, price, slogan or persuasive content;
- no clipping, broken path, accidental overlap or unreadable thumbnail.

If any mechanical failure occurs, add a failing automated test, correct it and write a new `iteration-02` output/report directory. Do not delete or overwrite iteration 01.

- [ ] **Step 4: Commit the browser evidence**

```powershell
git add -- catalog/reports/product-shell-style-audition-v1/iteration-01/contact-sheet.png catalog/reports/product-shell-style-audition-v1/iteration-01/browser-inspection.md
git commit -m "test: inspect product shell style audition"
```

---

### Task 5: Run the Fixed Six-Model Visual Gate

**Files:**
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-01/visual-consensus-raw.md`
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-01/visual-consensus-synthesis.md`
- Create: `catalog/reports/product-shell-style-audition-v1/iteration-01/visual-gate.json`

**Interfaces:**
- Consumes: the exact contact-sheet PNG plus neutral game context and the approved visual-system specification.
- Produces: six independent labelled reviews, a rule-based synthesis and immutable `PASS`, `REVISE` or `REJECT` gate evidence. It does not mutate build QA or promote assets into the production catalogue.

- [ ] **Step 1: Send the identical neutral evidence to the fixed panel**

Call OpenRouter `consensus` with the fixed ordered `analysis_models`, the contact-sheet PNG, `temperature: 0.1`, `seed: 20260713`, and `max_tokens: 32000`. Do not request brevity or set a word limit. Ask each independent reviewer to evaluate recognisability, desirability, customisable area, guide treatment, authoring/preview relationship, consistency, thumbnail legibility and any prototype-specific failures. Do not tell reviewers Codex's preferred verdict.

- [ ] **Step 2: Retry failed slots only**

If a slot errors, times out or explicitly truncates, rerun only that model once with the same image, prompt, temperature, seed and 32,000-token ceiling. Record persistent failure as `NO RESULT`; do not substitute a model.

- [ ] **Step 3: Save raw responses and synthesise by the approved rules**

The synthesis must list:

1. findings independently raised by at least four slots;
2. readability/accessibility/usability issues raised by at least two slots;
3. unique concrete risks worth retaining;
4. genuine disagreements;
5. Codex's resolution against browser evidence and product constraints;
6. the resulting `PASS`, `REVISE` or `REJECT` decision.

Do not average conflicting aesthetics. Any Peter-rejected direction remains rejected regardless of panel vote.

- [ ] **Step 4: Write a separate immutable visual-gate record**

Write `visual-gate.json` with status `VISUAL_PANEL_PASS`, `VISUAL_PANEL_REVISE` or `VISUAL_PANEL_REJECT`, all six slot statuses, relative evidence paths and SHA-256 hashes for the PNG and both consensus files. Do not modify `qa.json` after the deterministic build; runtime output and build QA remain immutable.

- [ ] **Step 5: Verify evidence and commit the gate**

Run the focused and full pipeline tests, then confirm all six expected model labels occur in the raw record and every evidence hash matches. Commit exact report/test paths:

```powershell
git add -- catalog/reports/product-shell-style-audition-v1 pipeline/tests/test_product_shell_audition.py
git commit -m "review: gate product shell visual direction"
```

If the decision is `REVISE`, implement only the documented findings and generate the next numbered iteration. If it is `PASS`, stop this audition plan and write a separate production-promotion plan; do not directly replace the reviewed 70-shell catalogue.

---

## Plan Self-Review

- **Spec coverage:** The plan covers the twelve-item audition, safe editable SVG, flat-skin packaging workflow, clean previews, hidden guides, browser evidence, fixed panel, 32,000-token calls, failed-slot retry and no production replacement before approval.
- **Isolation:** Audition modules and versioned iteration paths are separate from the existing production compiler and reviewed pack.
- **Deletion safety:** Every generated iteration is append-only; no task requires deletion, cleanup, move-out or overwrite of an earlier directory.
- **Type consistency:** `AuditionPrototype`, `AuditionSource`, `ArtworkSurface`, `ArtGeometry`, `render_audition_svg`, `load_audition_source` and `build_product_shell_audition` retain the same names and roles throughout the plan.
- **Marker scan:** No implementation step contains an unresolved marker or unspecified requirement.
