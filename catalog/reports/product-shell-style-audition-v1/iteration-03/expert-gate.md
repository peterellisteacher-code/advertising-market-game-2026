# Expert gate — product-shell scaling reference

## Decision

`EXPERT_GATE_PASS`

Iteration 03 is approved as the **visual grammar and geometry reference** for catalogue scaling. The current renderer at commit `0254935` is the paired **technical compositing reference**.

This is not classroom-release approval. Interaction, responsive layout, accessibility, populated-canvas behaviour and the complete game loop remain later gates.

## Evidence

- Immutable build: `4f9f659`
- Browser proof: 12 cards, 24 SVGs, four-by-three layout, zero clipping/overlap, zero console warnings/errors and zero failed requests
- Screenshot: 1800 × 929, 152833 bytes, SHA-256 `7572798d595667e849672418c8666827309bcb08866e0e763f2955597d7aa53b`
- Generated QA: 12 prototypes, zero errors, 36 verified SVG hashes
- Final tests after panel resolution: 47 product-shell audition tests and 120 complete pipeline tests passed
- Protected paths: reviewed 141-file pack and Iterations 01/02 unchanged

## Five-change contract

1. **PASS — selection chrome:** exact editable-surface outline, independently visible at at least 3:1 against the shell palette.
2. **PASS — Food Truck:** uninterrupted lower side panel below the service sill and above the wheels.
3. **PASS — Headphones:** exterior cap editable; cushion, rear cup and headband fixed.
4. **PASS — Takeaway Box:** Front, Lid / Top and Side orientation guidance is editor-only and absent from preview/export.
5. **PASS — Trainer:** eight light lace strokes in four orderly paired rows.

All explicit non-changes held: unaffected shell geometry and palette remain stable, preview exports are guide-free, and no finished advertising content was introduced.

## Independent review

- OpenRouter completed responses: four visual PASS verdicts. Initial code/export split was three PASS and one REVISE; three other models returned unusable network-truncated responses and were excluded without retry.
- The OpenRouter Sol REVISE was substantiated: inserted art could cover fixed detail layers. A failing populated-slot regression reproduced it.
- Resolution: `0254935` places student artwork above shell fills and below fixed tone/detail layers. The focused regression, audition suite and complete pipeline all pass.
- Codensus: one fresh local Sol/xhigh/fork-none reviewer ended `PROCEED`, with the correct caveat that this is reference approval rather than classroom release.

No further panel is required for this gate.

## Reference boundary

The frozen Iteration 03 SVGs remain audit evidence and are not promoted directly into the classroom runtime. Future catalogue output must be generated from the post-fix renderer at `0254935` or later, preserving fixed structural overlays above student artwork.
