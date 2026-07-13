# Product-shell style audition: visual consensus synthesis

Date: 2026-07-13

## Decision

**VISUAL_PANEL_REVISE.** Five reviewers returned `REVISE`; one returned `PASS` while still requiring a mandatory Garden Tool revision. The decision is grounded in shared findings rather than vote counting: Garden Tool meets the threshold at 6/6 and product-specific flat-skin mapping meets it at 4/6.

Iteration 01 remains immutable evidence. Any visual change must be generated as `iteration-02`; this audition may not replace the reviewed production catalogue.

## Panel completion

| Slot | Model | Result | Verdict |
|---|---|---|---|
| 1 | `moonshotai/kimi-k2.7-code` | Complete | REVISE |
| 2 | `stepfun/step-3.7-flash` | Complete | PASS, with mandatory Garden Tool revision |
| 3 | `google/gemini-3.1-pro-preview` | Complete | REVISE |
| 4 | `xiaomi/mimo-v2.5` | Complete | REVISE |
| 5 | `minimax/minimax-m3` | Complete | REVISE |
| 6 | `x-ai/grok-4.5` | Complete | REVISE |

No judge model ran. The first exact whole-panel call timed out before returning labelled slots; its one unchanged retry returned all six complete responses. The synthesis below is the root implementation decision from those raw responses.

## Findings meeting the fixed thresholds

### System strengths

- **Visual-family coherence — 6/6:** the fine contours, restrained palette and two-to-three tonal planes form a professional, Canva-adjacent family.
- **Unbranded creative openness — 6/6:** the shells leave the advertising challenge to students.
- **Majority thumbnail legibility — 6/6:** every reviewer found most silhouettes and direct surfaces readable, with Garden Tool the common exception.
- **Clean/editor state treatment — 5/6:** five reviewers found the split clear and restrained; Kimi found several direct-surface selection guides imperceptible. Clean market previews remain guide-free.

### Required revisions

1. **Garden prototype recognisability and usable surface — 6/6.** Every reviewer found it ambiguous, weak, too narrow or short of usable artwork space. Replace it with an unmistakable garden product that has a broad blank body, preferably a watering can, planter or seed packet rather than another thin implement.

2. **Product-specific flat-skin mapping — 4/6.** Kimi, Gemini, MiniMax and Grok raised aspect-ratio, fold, unwrap or preview-mapping concerns; Step and Xiaomi considered the current relationship clear. Iteration 02 must use distinct authoring geometry for each family and keep a live mapped preview visible: can/bottle wrap and seam logic, pouch face/gusset logic, and a matching face or dieline for the tapered takeaway box.

3. **Aquarium blank-canvas clarity — 4/6.** Kimi, Step, Gemini and Grok found that the fixed water/wave treatment constrains or confuses the artwork surface. MiniMax instead treated the water hint as a design opportunity while separately suggesting modest surface expansion; Xiaomi found no issue. Open the full front glass/back-wall region and reduce fixed interior decoration to the minimum needed for recognition.

4. **Pet Shop category cue or signage surface — 3/6.** This crosses the two-slot usability threshold. Keep the business category because shops and services are explicitly part of the game, but enlarge the blank fascia/window area and add subtle non-branded pet-scale architectural cues. Suggestions to remove it merely because it is not a tangible product are out of scope.

5. **Hoodie artwork-zone signalling — 2/6.** Two reviewers read the peach pocket as the only editable area while four saw the whole torso. That disagreement itself reveals an affordance problem. Make the full chest zone visibly editable in editor state without placing a sample logo.

6. **Trainer recognisability and surface generosity — 3/6.** Three reviewers found it small, blobby or insufficiently sneaker-like; three found it strong. Retain the category but use a clearer laced athletic silhouette with one dominant blank upper.

7. **Direct-surface guide consistency — 2/6.** Two reviewers found the corner guides imperceptible or inconsistent; four praised their restraint. Standardise them and raise contrast only slightly in editor state so the system remains subtle and guide-free in market output.

## Unique concrete risks retained

- Xiaomi alone found the palette washed out and insufficiently playful. Do not abandon the successful restrained system, but verify thumbnail and projector contrast during iteration-02 browser QA.
- Grok alone found the Sports Drink Bottle weakly sports-specific; add one quiet cue such as a sport cap or grip indent.
- MiniMax alone found Snack Pouch category cues ambiguous; preserve clear seals and gusset geometry.
- Kimi noted inconsistent lighting direction; apply one top-left lighting rule.
- Gemini noted a possible Headphones perspective mismatch; check ear-cup and headband perspective during polish.

## Genuine disagreements and root resolution

- **Overall gate:** Step returned `PASS`, but its response still names an essential Garden Tool blocker. The five explicit `REVISE` votes and unanimous Garden finding determine `VISUAL_PANEL_REVISE`.
- **Flat skins:** two reviewers found them clear; four found at least one mapping fragile or broken. The product-specific mapping change is required because it also prevents real student-art distortion.
- **Takeaway Box:** Kimi, Gemini and MiniMax found it unclear; Step, Xiaomi and Grok accepted it. Correct it under the broader mapping change rather than discarding the category.
- **Hoodie and Trainer:** disagreement centres on what the peach fill means. Improve the editable-area signal and silhouette while keeping the products blank.
- **Guide visibility:** preserve the deliberately faint style; make it consistent and only marginally more visible rather than returning to the Peter-rejected chunky guide treatment.
- **Pet Shop:** retain it. The original product scope explicitly includes advertising a pet shop, so tangible-product-only objections do not govern the design.
- **Texture and thicker-line suggestions:** do not adopt them by default. They conflict with the successful fine-contour direction and are not consensus findings.

## Iteration-02 visual brief

- Preserve the successful fine contour, restrained palette, tonal-plane and guide-free market-preview system.
- Replace the garden prototype with an unmistakable, broad-surface garden product.
- Replace the one-size-fits-all flat skin with product-specific wrap/dieline geometry and a live mapped preview.
- Open the Aquarium's full front glass as the artwork surface.
- Strengthen Pet Shop cues and blank fascia/window real estate without supplying a logo or finished campaign.
- Make the Hoodie chest clearly editable and simplify the Trainer into a recognisable laced silhouette with one dominant blank upper.
- Standardise editor-only guide contrast, top-left lighting and thumbnail contrast.
- Keep all new output in a new append-only `iteration-02` directory.
