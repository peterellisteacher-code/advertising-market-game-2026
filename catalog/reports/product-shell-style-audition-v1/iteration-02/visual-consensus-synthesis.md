# Visual consensus synthesis — iteration 02

## Gate

**VISUAL_PANEL_REVISE**

Five of six independent reviewers returned `REVISE`; StepFun alone returned `PASS`. Iteration 02 is coherent and suitable for continued development, but it is not yet the catalogue scaling reference.

## Panel integrity

| Slot | Model | Final status | Verdict |
|---:|---|---|---|
| 1 | `moonshotai/kimi-k2.7-code` | complete | REVISE |
| 2 | `stepfun/step-3.7-flash` | complete | PASS |
| 3 | `google/gemini-3.1-pro-preview` | complete | REVISE |
| 4 | `xiaomi/mimo-v2.5` | complete after one identical retry; initial call timed out at 300 seconds | REVISE |
| 5 | `minimax/minimax-m3` | complete | REVISE |
| 6 | `x-ai/grok-4.5` | complete | REVISE |

Every initial call and the single MiMo retry used the same image and prompt with `max_tokens=32000`, `temperature=0.1`, `seed=20260713`, and `stream=true`. No word, brevity, stop, or judge limit was applied. No successful slot was rerun and no model was substituted.

## Threshold application

The predeclared rule is four reviewers for a general visual change and two reviewers for an accessibility or editor-usability change.

### Accepted consensus changes

1. **Resolve the Pet Shop category mismatch — 5/6.** Reviewers split on whether to add a pet cue or generalise the shell. The product-owner resolution is to retain the deliberately requested Pet Shop category and add one sparse, fixed, non-branded pet cue. Do not consume the blank fascia or windows with a finished sign.
2. **Strengthen and standardise editable-zone feedback — 4/6.** Use one consistent, higher-contrast overlay/border/corner-guide system across direct surfaces and flat skins. This satisfies the four-reviewer accessibility concern about selection boundaries and functional contrast.
3. **Clarify flat-skin mapping — 5/6 editor usability.** Add geometry-specific minimal guidance: seam/wrap cues for can and pouch, a mapping/orientation cue for bottle, and panel/front orientation for box. Preserve the product-specific geometry; do not simplify the box net into a rectangle.
4. **Redraw Trainer lace/upper detail — 5/6.** Keep laces as structural geometry, but make the crisscross orderly, lighter and less like a pre-applied graphic.
5. **Clarify the Hoodie pocket/chest relationship — 3/6 usability.** The product-owner resolution is to keep the garment structure, make the selected state unmistakably cover the full chest/torso, and visually subordinate the fixed pocket.
6. **Audit the Headphones outer-cup target — 2/6 usability.** Ensure the outer ear cup, not the cushion/interior, is the clear flat branding plane. Do not accept the separate unsupported claim that the whole shell necessarily requires a complete perspective redraw without checking the actual geometry.

### Split or unsupported changes not accepted wholesale

- **Aquarium:** recognition split 3–3. Preserve iteration-02 geometry and audit the existing waterline/bubbles at actual editor size before adding more fixed decoration.
- **Sports Drink Bottle:** one reviewer called it jar-like while the other five accepted it. Audit mapping in the editor; do not redraw from this minority finding alone.
- **Takeaway Box:** reviewers split between “confusing” and “exemplary.” Keep the net and add only the consensus orientation cues.
- **Watering Can:** a longer spout or larger rose did not reach the general threshold.
- **Broad palette restyle:** reviewers disagreed about age appeal; coherence was widely praised. Increase functional contrast only.
- **Pet Shop → Storefront:** this conflicts with the requested category. The accepted resolution is a minimal category cue, not generalisation.
- **Finished category art, words, logos, slogans or price tags:** rejected because the shells must remain blank creative starting points.

## Minimum iteration-03 target

Create an append-only iteration 03 that changes only:

- selection/contrast affordances, including Hoodie and Headphones targeting;
- flat-skin seam/wrap/orientation guidance;
- one restrained Pet Shop category cue;
- Trainer lace/upper linework.

Then inspect the exact browser output, audit Aquarium and Sports Bottle at editor size, and rerun the same fixed six-model panel. Iteration 02 and the accepted production pack remain immutable.
