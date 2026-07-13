# Iteration 02 Coding Consensus — Raw Independent Responses

- Models: `moonshotai/kimi-k2.7-code`, `z-ai/glm-5.2`, `tencent/hy3-preview`, `deepseek/deepseek-v4-pro`
- Temperature: `0.1`
- Seed: `20260713`
- Maximum tokens per slot: `32000`
- Evidence: `product_shell_art.py`, `product_shell_audition.py`, `test_product_shell_audition.py`, `manifest.json`

[consensus: 4 independent panel responses below — no judge model has run. Synthesise these yourself: note where the models agree, where they conflict, and any unique points.]

--- panel model: moonshotai/kimi-k2.7-code ---

[⚠ TRUNCATED — finish_reason=length: hit the max_tokens budget for this panel call (smaller of max_tokens, the model's output ceiling, and context-fit room); this response is incomplete.]

--- panel model: z-ai/glm-5.2 ---
# Independent Code Review: Iteration 02 Product-Shell Audition

## Verdict: **PASS**

The implementation satisfies all nine binding requirements. The code is deterministic, safe, well-structured, and the test suite is broadly comprehensive. Below are concrete findings, separated into blocking and non-blocking categories. No blocking bugs were found.

---

## Requirement-by-Requirement Verification

### 1. Exactly twelve stable prototype IDs/archetypes — ✅
`Archetype` (`product_shell_audition.py:18-31`) defines exactly 12 literals. `load_audition_source` (`product_shell_audition.py:131-137`) enforces `len == 12`, unique IDs, and complete archetype roster. The manifest contains 12 prototypes with stable IDs. `GEOMETRY_BUILDERS` (`product_shell_art.py:~330`) has exactly 12 entries matching the `Archetype` literal.

### 2. Four packaging archetypes use distinct flat-skin geometry; previews remain mapped product geometry — ✅ (code correct, tests incomplete)
`FLAT_SKIN_BUILDERS` (`product_shell_art.py:~470`) has exactly four entries: `slim-can`, `sports-bottle`, `snack-pouch`, `takeaway-box`. In `render_audition_svg` (`product_shell_art.py:~560`), `flat_skin` is set to `None` when `view == "preview"`, so preview always uses `geometry.surface` and `geometry.regions` via `_object_layers`. Authoring and review use `flat_skin.surface` and `flat_skin.regions` via `_flat_skin_layers`. The four flat-skin surface paths are distinct (verified by `test_packaging_uses_four_distinct_product_specific_flat_skins`).

### 3. Five revised direct-surface proofs expose broad editable faces — ✅
All five are present with `data-product-part` markers and broad surface bounds:

| Proof | Marker | Surface bounds (w×h) | Test floor |
|---|---|---|---|
| Watering can | `watering-can-body` | 470×435 | 430×300 ✅ |
| Aquarium glass | `full-front-glass` | 700×370 | 680×340 ✅ |
| Hoodie chest | `hoodie-chest` | 530×620 | 470×360 ✅ |
| Trainer upper | `athletic-upper` | 805×355 | 570×250 ✅ |
| Pet-shop fascia | `pet-shop-fascia` | 750×285 | 700×170 ✅ |

Trainer laces: 6 solid `data-product-part="trainer-lace"` paths with `fill="{DETAIL_INK}"` and `stroke="none"` (`product_shell_art.py:~240-245`). Verified by `test_trainer_uses_six_or_more_separate_solid_laces`.

### 4. SVG deterministic, semantic, brand-free, text-free, script-free, externally reference-free, guide-free in preview — ✅
- **Deterministic**: No `random`, `datetime`, `uuid`, or timestamps. All ordering via `sorted()`. JSON via `sort_keys=True, separators=(",", ":")`.
- **Text-free**: No `<text>` elements anywhere in the SVG builders.
- **Script-free**: No `<script>` elements.
- **Externally reference-free**: No `href`, `xlink:href`, `xmlns:xlink`, or external file references.
- **Guide-free in preview**: `_guide_overlay` returns `""` for preview (`product_shell_art.py:~545`).
- **Semantic**: `data-region`, `data-product-part`, `data-tone`, `data-artwork-surface`, `data-shell-id`, `data-authoring-mode`, `data-light-direction` attributes throughout.

Verified by `test_all_audition_views_are_safe_parseable_semantic_svg` which checks all three views for forbidden tokens.

### 5. Editor guides solid, subtle, corner-only, absent from clean previews — ✅
`_corner_guides` (`product_shell_art.py:~62-71`) generates four L-shaped corner paths using `min(width, height) * 0.085` length. No `stroke-dasharray` anywhere (verified by test). Review view uses `opacity="0.52"` (subtle). Preview has no guide overlay at all. Authoring has `visibility="hidden"` (present but invisible — toggled by editor).

### 6. Output/report directories append-only, reject non-empty or overlapping targets — ✅
`_require_empty` (`product_shell_audition.py:~96-98`) rejects existing non-empty directories. `_require_disjoint_targets` (`product_shell_audition.py:~101-112`) uses `resolve(strict=False)` and `is_relative_to` to catch overlapping paths including `../` aliasing. Both checks run before any filesystem writes. Verified by `test_audition_build_rejects_resolved_overlapping_targets_before_any_write` and `test_audition_build_rejects_non_empty_target_before_any_write`.

### 7. Iteration 01 and production pack not mutated — ✅
The code only writes to user-specified `output_dir` and `report_dir`. No imports or references to iteration 01 or production pack paths. The `_require_empty` check prevents overwriting existing content. All bytes are prepared in memory before any directory creation (`product_shell_audition.py:~200-260`), so a validation error during preparation leaves the filesystem untouched (verified by `test_audition_build_prepares_all_bytes_before_creating_targets`).

### 8. Contact-sheet captions truthfully distinguish modes — ✅
`_render_contact_sheet` (`product_shell_audition.py:~155-190`) uses:
- Flat-skin: `"Mapped product preview"` / `"Editable product skin"`
- Direct-surface: `"Clean preview"` / `"Editor-selected"`

Verified by `test_audition_contact_sheet_is_self_contained_four_by_three_evidence` which checks each card's captions against its prototype's authoring mode.

### 9. No production catalog.json emitted — ✅
The build emits `audition.json`, `source.json`, `qa.json`, `contact-sheet.html`, and SVGs. No `catalog.json` is written. Verified by `test_audition_build_emits_isolated_catalogue_snapshot_and_hashed_qa` which asserts `not (output_dir / "catalog.json").exists()` and `not (report_dir / "catalog.json").exists()`.

---

## Non-Blocking Hardening Suggestions

### N1. Missing test: flat-skin preview clip path uses product geometry, not flat-skin surface
**Location**: `test_product_shell_audition.py`
**Issue**: The core requirement "clean previews remain mapped product geometry" is not directly tested. `test_authoring_surfaces_obey_flat_skin_and_direct_surface_modes` only checks the authoring view. No test verifies that for flat-skin archetypes, the preview clip path's `d` attribute equals `geometry.surface.path` (not `flat_skin.surface.path`).

**Suggested test**:
```python
def test_flat_skin_preview_uses_product_geometry_clip():
    for archetype in ("slim-can", "sports-bottle", "snack-pouch", "takeaway-box"):
        prototype = _prototype(archetype)
        geometry = GEOMETRY_BUILDERS[archetype]()
        flat_skin = flat_skin_geometry_for(archetype)
        root = ET.fromstring(render_audition_svg(prototype, view="preview"))
        clip_path = root.find(".//*[@data-artwork-surface='primary']")
        assert clip_path.get("d") == geometry.surface.path
        assert clip_path.get("d") != flat_skin.surface.path
```

### N2. Missing test: flat-skin-specific attributes absent in preview
**Issue**: No test verifies that preview SVGs for flat-skin archetypes do NOT contain `data-flat-skin-kind`, `data-mapping-target`, or `data-mapping-part` attributes. These are only in `_flat_skin_layers`, which is skipped in preview, but a regression could silently introduce them.

### N3. Missing test: `artworkSurface` in `audition.json` matches product geometry for flat-skin archetypes
**Issue**: `test_audition_build_emits_isolated_catalogue_snapshot_and_hashed_qa` checks that `artworkSurface` key exists but doesn't verify its `path` value. For flat-skin archetypes, this should be the product geometry surface path, not the flat skin surface path.

### N4. Fragile contract: authoring-mode-to-archetype mapping not validated in source
**Location**: `product_shell_audition.py:131-137` (`load_audition_source`)
**Issue**: The `EXPECTED` dict in tests encodes that only the four packaging archetypes use `flat-skin` mode, but `load_audition_source` does not validate this mapping. If the manifest were changed to set `hoodie` to `flat-skin`, it would pass source validation but fail at render time with `ValueError("hoodie does not use flat-skin authoring")`. This is a clear error message, but the contract is enforced only by tests, not by the loader. Consider adding a validation step in `load_audition_source` that checks flat-skin archetypes have a `FLAT_SKIN_BUILDERS` entry.

### N5. Fragile contract: region IDs not validated against archetype geometry
**Location**: `product_shell_audition.py:~80-86` (`validate_regions`)
**Issue**: The model validator checks that region IDs are in the global `REGION_IDS` set, but not that they match the archetype's available geometry regions. A hoodie prototype with a `glass` region passes validation but fails at render time. The error message from `_semantic_regions` is clear (`"hoodie has no geometry for region glass"`), and `test_audition_build_prepares_all_bytes_before_creating_targets` covers this path, but it's a runtime error rather than a validation error.

### N6. Path data not XML-escaped
**Location**: `product_shell_art.py` throughout (all `d="{path}"` interpolations)
**Issue**: SVG path data strings are interpolated directly into XML attribute values without escaping. This is currently safe because all path data is hardcoded and contains only numeric/alphabetic characters, commas, spaces, and hyphens. If path data were ever derived from external input, this could produce invalid XML. Consider using `xml.sax.saxutils.quoteattr` or `html.escape` for defense in depth.

### N7. Missing test: oversized manifest rejection
**Issue**: `MAX_SOURCE_BYTES = 1_048_576` is checked in `load_audition_source` but no test exercises this path. A simple test writing a manifest larger than 1 MB would close this gap.

### N8. Missing test: flat-skin surfaces are distinct from product geometry surfaces
**Issue**: `test_packaging_uses_four_distinct_product_specific_flat_skins` verifies the four flat-skin surfaces are distinct from each other, but not that each flat-skin surface differs from its corresponding product geometry surface. If a flat-skin surface accidentally matched the product geometry surface, the "distinct authoring geometry" requirement would be silently violated.

### N9. `html.escape` used for XML content
**Location**: `product_shell_art.py:~52-56` (`_region`), `product_shell_art.py:~530` (`_clip_definition`)
**Issue**: `html.escape` is technically the HTML escaper, though it escapes the same characters needed for XML (`<`, `>`, `&`, `"`, `'`). This is functionally correct for SVG (which is XML), but `xml.sax.saxutils.escape`/`quoteattr` would be more semantically precise. Non-blocking since the behavior is identical for the characters in question.

### N10. No CLI test for `main()`
**Location**: `product_shell_audition.py:~285-294`
**Issue**: The `main()` entry point is not tested. A simple integration test invoking `main(["--source", ..., "--out", ..., "--report", ...])` would verify the CLI path.

---

## Summary

| Category | Count |
|---|---|
| Blocking bugs | 0 |
| Fragile contracts | 2 (N4, N5) |
| Missing meaningful tests | 5 (N1, N2, N3, N7, N8) |
| Safety/determinism risks | 0 blocking, 2 hardening (N6, N9) |
| Overbuilding | None observed |

The implementation is correct against all binding requirements. The code correctly separates flat-skin authoring geometry from product-mapped preview geometry, exposes all five required direct-surface proofs with broad editable faces, maintains SVG safety and determinism, enforces directory safety before any writes, and emits truthful contact-sheet captions without producing a `catalog.json`. The identified gaps are all non-blocking hardening opportunities, primarily around adding tests that explicitly verify the flat-skin preview path uses product geometry and that flat-skin-specific attributes are absent from previews.

--- panel model: tencent/hy3-preview ---
ERROR [http] | HTTP 404 from OpenRouter | No endpoints available matching your guardrail restrictions and data policy. Configure: https://openrouter.ai/settings/privacy | Not found — the resource/id does not exist (or is not ready yet for async jobs).

--- panel model: deepseek/deepseek-v4-pro ---
**Verdict: PASS**

The implementation, manifest, and test suite faithfully satisfy every binding requirement for iteration 02. The twelve‑prototype roster is stable; the four packaging archetypes use distinct flat‑skin authoring geometry while clean previews use the product geometry; the five revised direct‑surface proofs expose the specified broad editable faces; the SVGs are deterministic, semantic, brand‑free, text‑free, script‑free, externally reference‑free, and guide‑free in preview; editor guides are solid, subtle, corner‑only, and absent from clean previews; output/report directories are created only when empty and non‑overlapping; iteration 01 and the production pack are untouched; contact‑sheet captions correctly distinguish the two surface modes; and no catalog.json is emitted.

The test suite (40+ tests in the attached file, plus the full pipeline claims) covers load‑time validation, rendering contracts, build determinism, safety against overwrites, and the exact phrasing of the requirements. No blocking bugs were found.

---

### Non‑blocking hardening suggestions

1. **Manifest‑region compatibility is not validated at load time**  
   The `AuditionPrototype` validator only checks that each region ID belongs to the global `REGION_IDS` set, not that the geometry for the chosen archetype actually provides that region. A mis‑configured manifest (e.g. `"glass"` on a `hoodie`) would survive loading and only fail during `build_product_shell_audition` with a `ValueError`. The current test `test_audition_build_prepares_all_bytes_before_creating_targets` confirms the error is caught before writing, so safety is preserved, but earlier validation would make the contract more robust.  
   *Files: `product_shell_audition.py` lines 42‑48 (validation), `product_shell_art.py` lines 185‑193 (semantic_regions).*

2. **Flat‑skin authoring mode is not restricted to the four packaging archetypes**  
   The loader allows any archetype to declare `authoringMode: "flat-skin"`, but `flat_skin_geometry_for` will raise a `ValueError` for non‑packaging archetypes. The current manifest is correct, but a future edit could introduce a latent error. A simple loader check would prevent it.  
   *Files: `product_shell_audition.py` line 83 (authoring_mode field), `product_shell_art.py` lines 300‑303 (flat_skin_geometry_for).*

3. **Unused constant `PAPER`**  
   The constant `PAPER = "#F4F1EA"` is defined in `product_shell_art.py` (line 13) but never referenced in the rendering code. It does not affect correctness, but removing it or using it consistently would improve clarity.

4. **Grounding shadow may not be ideally placed for all products**  
   The `_grounding_shadow` function (`product_shell_art.py` lines 206‑214) caps the shadow’s vertical centre at 930 px. For products whose product bounds are tall (e.g., pet‑shop), this can place the shadow slightly above the intended ground line. This is a visual‑taste concern already delegated to the vision panel, so it is not a blocking issue.

---

### Summary

The implementation is solid, the tests are comprehensive, and the contract is met. No revisions are required.


## Failed-slot retries (one retry each; identical evidence and parameters)

--- retry panel model: moonshotai/kimi-k2.7-code ---

tool call error: tool call failed for `openrouter/openrouter_gateway`

Caused by:
    timed out awaiting tools/call after 300s

--- retry panel model: tencent/hy3-preview ---

ERROR [http] | HTTP 404 from OpenRouter | No endpoints available matching your guardrail restrictions and data policy. Configure: https://openrouter.ai/settings/privacy | Not found — the resource/id does not exist (or is not ready yet for async jobs).

