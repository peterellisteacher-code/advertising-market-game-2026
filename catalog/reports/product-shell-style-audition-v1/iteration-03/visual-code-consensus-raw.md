# OpenRouter visual/code consensus — response record

- Run: 2026-07-13 (Australia/Adelaide)
- Mode: one bounded, independent `consensus` fan-out; no judge model
- Inputs: iteration-03 `contact-sheet.png`, `product_shell_art.py`, `test_product_shell_audition.py`, and `qa.json`
- Sampling: temperature `0.1`, seed `20260713`, maximum output `32000` tokens per model
- Models requested: 7
- Complete responses: 4
- Transport failures: 3
- Retry: none; the user requested a bounded pass without review loops
- Preservation: verdicts and substantive findings are condensed below; transport errors are verbatim

## moonshotai/kimi-k2.7-code

**VISUAL: PASS**

All bounded visual changes are substantiated in the screenshot and/or geometry code: high-contrast exact-surface selection, the Food Truck lower-side target, Headphones exterior-cap targeting, review-only Takeaway Box orientation guidance, eight light Trainer laces, and unfinished brand-free shells.

**CODE/EXPORT: PASS**

The response found view isolation, runtime/report separation, QA state, safe SVG constraints and deterministic output consistent with the supplied contract. It identified no genuine blocker.

**OVERALL PASS**

## stepfun/step-3.7-flash

`ERROR [network] | peer closed connection without sending complete message body (incomplete chunked read)`

## google/gemini-3.1-pro-preview

**VISUAL: PASS**

The response passed all five bounded visual changes and found the unchanged shells deliberately unfinished, coherent and free of completed advertising.

**CODE / EXPORT: PASS**

The response passed exact-surface selection and contrast, Food Truck bounds, Headphones editable/fixed part declarations, preview suppression of Takeaway Box guidance and the eight-lace structure. It identified no blocker.

**OVERALL PASS**

## xiaomi/mimo-v2.5

`ERROR [network] | peer closed connection without sending complete message body (incomplete chunked read)`

## minimax/minimax-m3

`ERROR [network] | peer closed connection without sending complete message body (incomplete chunked read)`

## x-ai/grok-4.5

**VISUAL: PASS**

The response passed all five bounded visual checks and found no substantiated defect in the supplied screenshot.

**CODE / EXPORT: PASS**

The response passed the exact-surface selection, Food Truck bounds, Headphones part targeting, Takeaway role isolation, Trainer lace contract and build/QA separation. It identified no blocker.

**OVERALL PASS**

## openai/gpt-5.6-sol

**VISUAL: PASS**

The response found the selection chrome, Food Truck panel, Headphones cap, Takeaway Box orientation guidance, Trainer laces and unfinished shell family visually suitable as a scaling reference.

**CODE/EXPORT: REVISE**

The response identified one substantiated issue: the artwork slot was emitted after the tone and detail layers. Opaque inserted artwork could therefore cover fixed Trainer laces, lighting overlays and other structural details. Existing tests checked an empty slot but did not exercise populated-slot compositing order.

**OVERALL REVISE**

The original response's decisive excerpt was:

> Any opaque artwork inserted into that slot will therefore paint over fixed details inside the clipping surface. Most clearly, Trainer artwork clipped to the upper can obscure the eight lace paths, because those laces are rendered earlier in `data-detail-layer`.
