# Product-shell style audition: browser inspection

Date: 2026-07-13
Outcome: **MECHANICAL PASS — READY FOR VISUAL PANEL**

## Capture evidence

- Chromium viewport: 2400 × 1800 CSS pixels.
- Complete `main` sheet bounds: x 300, y 24, width 1800, height 928.594 CSS pixels.
- Stored PNG: 1800 × 929 pixels, 137,491 bytes.
- PNG SHA-256: `afe7990ea787aef957e6458b3453aeddc8545b7a77e42a308deb9f0e8caac1cb`.
- Main document response: HTTP 200.
- Browser-console errors: 0.
- Failed requests: 0.
- Responses at HTTP 400 or above: 0.
- The report is self-contained and embeds SVG markup rather than loading `<img>` elements. The readiness check therefore waited for 12 `.prototype-card` elements and 24 inline SVG elements instead of testing `naturalWidth`.
- A fresh browser context intercepted the optional browser `favicon.ico` request with HTTP 204; no report content was changed.

## DOM inventory

- Prototype cards: 12.
- Clean previews: 12.
- Editor-selected views: 12.
- Inline SVGs: 24.
- Visible prototypes: Aquarium, Food Truck, Garden Tool, Headphones, Hoodie, Pet Shop, Slim Drink Can, Smartphone, Snack Pouch, Sports Drink Bottle, Takeaway Box, Trainer.

## Human visual preflight

Key: S = recognisable silhouette without title; P = clean guide-free preview; C = fine contour; T = restrained tonal planes; A = dominant usable artwork surface; R = clear authoring/preview relationship; B = no supplied branding or persuasive copy; M = no clipping, broken path, accidental overlap or unreadable thumbnail.

| Prototype | S | P | C | T | A | R | B | M | Observation |
|---|---|---|---|---|---|---|---|---|---|
| Aquarium | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Large front face is immediately usable. |
| Food Truck | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Side body provides a broad direct surface. |
| Garden Tool | PASS | PASS | PASS | PASS | FAIL | PASS | PASS | PASS | Recognisable trowel-like form, but the handle/body leaves a narrow branding area. |
| Headphones | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Ear-cup face gives a clear direct surface. |
| Hoodie | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Torso face reads clearly at thumbnail size. |
| Pet Shop | FAIL | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Reads as a generic shopfront without the title; category-specific cues remain for panel review. |
| Slim Drink Can | PASS | PASS | PASS | PASS | PASS | FAIL | PASS | PASS | Flat authoring skin is usable, but the sheet does not yet demonstrate how it wraps onto the can. |
| Smartphone | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Screen is an obvious direct surface. |
| Snack Pouch | PASS | PASS | PASS | PASS | PASS | FAIL | PASS | PASS | Flat authoring skin is usable, but its mapping to the pouch is not visually demonstrated. |
| Sports Drink Bottle | PASS | PASS | PASS | PASS | PASS | FAIL | PASS | PASS | Flat authoring skin is usable, but its mapping to the bottle is not visually demonstrated. |
| Takeaway Box | PASS | PASS | PASS | PASS | PASS | FAIL | PASS | PASS | Flat authoring skin is usable, but its mapping to the box is not visually demonstrated. |
| Trainer | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | Upper panel is clear and legible at this scale. |

## Gate interpretation

All 12 prototypes render cleanly and the contact sheet has no mechanical failure, so no corrective output directory is required before panel review. The visual panel should decide whether the four flat-skin mapping failures, the garden tool's narrow customisable area, and the pet-shop silhouette's lack of category specificity require a second visual iteration.
