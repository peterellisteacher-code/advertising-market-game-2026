# OpenRouter Visual/Code Consensus — Raw Labelled Responses

Date: 2026-07-14 (Australia/Adelaide)

Configuration: one bounded consensus pass; `max_tokens: 32000`, `temperature: 0.1`, `seed: 20260714`. No retry was run.

[consensus: 7 independent panel responses below — no judge model has run. Synthesise these yourself: note where the models agree, where they conflict, and any unique points.]

--- panel model: moonshotai/kimi-k2.7-code ---

[⚠ TRUNCATED — finish_reason=length: hit the max_tokens budget for this panel call (smaller of max_tokens, the model's output ceiling, and context-fit room); this response is incomplete.]

--- panel model: stepfun/step-3.7-flash ---
1. VISUAL: PASS — No blockers. All 12 body cards (Backpack, Carry Bag, Tote, Weekender, Classic Can, Slim Can, Sports Bottle, Takeaway Cup, Burger Box, Meal Box, Noodle Tub, Snack Pouch) and 12 component cards (Cutout Handle, Long Straps, Loop Handles, Short Straps, Flat Top, Ring Top, Sport Spout, Straw Port, Folded Closure, Sleeve Closure, Tabbed Closure, Zip Closure) render as bare, brand-free shells with generous artwork surfaces. No finished advertisements, stock photography, scripts, external links, or horizontal overflow are present. The "zero finished adverts" badge and clean grid layout align with product intent.

2. CODE: PASS — No blockers. The pipeline enforces the exact 12-body/12-part/16-palette/8-material contract, validates geometry containment (including stroke-aware bounds for components), and emits the required 39-file pack with deterministic canonical JSON and SHA-256 QA manifest. The SVG layer order (base-shell → clipped artwork-slot → tone/detail → editor-only guides) and preview omission of guides are correctly implemented. All 164 tests pass, and the prior geometry containment defects are resolved.

3. VERDICT: PROCEED

4. Non-blocking future cautions:
   - **Static palette/material bake:** The 36 generated SVGs currently embed `palettes[0]` and `materials[0]`; the deferred interactive composer will need to override colours/materials lazily at runtime without regenerating the pack.
   - **Component stroke scaling:** Component strokes use a fixed normalized width of 0.035; verify legibility when components are printed at the physical pack’s cut-out size.
   - **Contact sheet responsiveness:** The body grid is fixed at 4 columns; if the catalogue expands beyond 12 bodies, the layout will need breakpoints to maintain the no-overflow constraint.

--- panel model: google/gemini-3.1-pro-preview ---
1. VISUAL: PASS
2. CODE: PASS
3. VERDICT: PROCEED

**Future Cautions:**
*   **DOM Colour Manipulation:** When building the interactive composer, ensure the runtime colour replacement logic strictly targets the `data-region` attributes (`body`, `trim`, `accent`, `label`) rather than relying on regex or hardcoded hex replacement, ensuring robust state updates when students switch palettes.
*   **Normalized Coordinate Mapping:** The interchangeable components are correctly generated in passive `0 0 1 1` viewboxes. The future composer will need precise scaling math to map these normalized bounds to the specific `componentAnchor` coordinates of each body without distorting the stroke widths.
*   **Path Complexity Limits:** The current pack is highly optimized (75KB total). As the classroom game expands to include student-uploaded artwork or additional geometries, maintain the strict path validation (M/L/H/V/Q/Z subset) demonstrated in `test_product_builder.py` to prevent file bloat and ensure fast rendering on low-end school devices.

--- panel model: xiaomi/mimo-v2.5 ---
1. VISUAL: PASS — no blockers. All 12 body cards (Backpack, Carry Bag, Tote, Weekender, Classic Can, Slim Can, Sports Bottle, Takeaway Cup, Burger Box, Meal Box, Noodle Tub, Snack Pouch) and 12 component cards (Cutout Handle, Long Straps, Loop Handles, Short Straps, Flat Top, Ring Top, Sport Spout, Straw Port, Folded Closure, Sleeve Closure, Tabbed Closure, Zip Closure) render cleanly with brand-free shells, generous artwork surfaces, consistent palette, no scripts/images/external links, no console warnings/errors, and no horizontal overflow.

2. CODE: PASS — no blockers. The 164 pipeline tests pass; the 3 geometry containment defects from prior review are fixed (commit 03937e8); the generated pack is 39 files with 38 non-self hashes verified, 36 referenced SVGs present, 0 reparse points, and 75,162 bytes. The SVG layer order is deterministic (base-shell → artwork-slot → tone-detail → editor-guides in authoring; editor-guides omitted in preview). The catalogue correctly declares 12 bodies × 4 parts × 16 palettes × 8 materials = 6,144 virtual variants. All models are frozen, all IDs are validated against registered geometries, and fail-closed behavior is enforced for unknown IDs and pre-existing targets.

3. VERDICT: PROCEED.

4. Non-blocking future cautions:
   - **CAUTION — Component stroke-width scaling**: The component SVGs use `stroke-width=".035"` in a normalized 0–1 viewBox. If the interactive composer later scales these fragments to different pixel sizes, the stroke may appear too thin or too thick; a future pass should verify visual consistency at the target display size.
   - **CAUTION — Artwork slot clip-path visual precision**: The artwork clip paths are defined by the `artwork_path` in each body geometry and verified for containment, but the actual visual edge of the clip may vary slightly across browsers. A future visual QA pass at the interactive composer stage should confirm the artwork slot edge is visually clean at the intended display resolution.
   - **CAUTION — Palette contrast coverage**: The 16 palettes are validated for uniqueness, but the contrast between body, trim, accent, and label colours has not been formally tested for WCAG AA compliance. A future design pass could add a contrast check to ensure all 16 palettes are accessible for student artwork.

--- panel model: minimax/minimax-m3 ---
1. **VISUAL: PASS** — All 12 body cards (Backpack, Carry Bag, Tote, Weekender, Classic Can, Slim Can, Sports Bottle, Takeaway Cup, Burger Box, Meal Box, Noodle Tub, Snack Pouch) and all 12 component cards (Cutout Handle, Long Straps, Loop Handles, Short Straps, Flat Top, Ring Top, Sport Spout, Straw Port, Folded Closure, Sleeve Closure, Tabbed Closure, Zip Closure) render as bare, brand-free, visually coherent starting points with generous light surfaces for student artwork. No logos, text, scripts, or external links. Layout is clean with no horizontal overflow.

2. **CODE: PASS** — `product_builder.py` enforces the closed contract via frozen Pydantic models (`FrozenContractModel`), validates body/part identities against `REGISTERED_BODY_IDENTITIES`/`REGISTERED_PART_IDENTITIES`, enforces exactly 3 families / 12 bodies / 12 parts / 16 unique four-colour palettes / 8 existing materials, and computes `virtual_count == 6144`. Renderers emit the required layer order (`base-shell` → `artwork-slot` → `tone-detail` → `editor-guides` for authoring; `preview-grounding` → `base-shell` → `artwork-slot` → `tone-detail` for preview, with guides stripped). `_require_absent` and `mkdir(exist_ok=False)` fail closed on pre-existing targets. `assert_passive_safe_svg` blocks scripts/images/text/foreignObject/javascript:/data:/http(s)/xlink:href. The quadratic/stroke-aware containment tests in `test_product_builder.py` (`test_all_artwork_paths_are_geometrically_contained_by_manifest_bounds`, `test_all_component_drawings_including_stroke_fit_declared_normalized_bounds`) cover the prior geometry defects. `plan_product_builder_pack` produces exactly 39 files (12 authoring + 12 preview + 12 components + catalogue.json + source.json + qa.json), matching the verified `qa.json` (38 non-self SHA-256 hashes, 36 referenced SVGs).

3. **VERDICT: PROCEED**

4. **Non-blocking future cautions:**
   - Body SVGs use absolute pixel coordinates (viewBox `0 0 1000 1000`) while component SVGs use normalized coordinates (viewBox `0 0 1 1`); the deferred composer must establish a single consistent mapping strategy before placing parts onto bodies.
   - Bodies and components are currently rendered with a single default palette/material (`source.palettes[0]`, `source.materials[0]`); the composer must apply the full 16×8 palette/material matrix without mutating the on-disk SVGs.
   - `data-component-slot-id` on bodies and `data-slot-id` on parts are declared but not yet cross-validated against `component_anchor` placement at render time; worth a containment/anchor check when the composer is built.

--- panel model: x-ai/grok-4.5 ---
1. VISUAL: PASS  
2. CODE: PASS  
3. VERDICT: PROCEED  
4. Non-blocking future cautions:  
- CAUTION: Component anchors are catalogue-only; live body×part composition remains deferred to the later interactive composer.  
- CAUTION: Materials are identity/profile IDs only in this pack; surface/finish differentiation is not yet rendered.  
- CAUTION: Contact-sheet previews use the default palette only; the 16×8 palette/material matrix stays lazy/virtual by design.

--- panel model: openai/gpt-5.6-sol ---
1. VISUAL: PASS — no blockers.
2. CODE: PASS — no blockers.
3. VERDICT: PROCEED.
4. NON-BLOCKING FUTURE CAUTIONS:
   - Preserve the validated layer order and guide-free preview exports during future renderer changes.
   - Keep material-profile resolution deterministic when the later composer consumes the eight catalogue IDs.
   - Consider transactional cleanup for rare mid-write filesystem failures in `write_product_builder_pack`.

