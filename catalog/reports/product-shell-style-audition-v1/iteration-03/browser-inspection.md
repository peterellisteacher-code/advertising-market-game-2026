# Browser inspection — iteration 03

- Inspected: 2026-07-13 (Australia/Adelaide)
- URL: `http://127.0.0.1:8898/catalog/reports/product-shell-style-audition-v1/iteration-03/contact-sheet.html`
- Viewport: 2400 × 1800 CSS pixels
- Page: `complete`; title `Product-shell style audition`
- DOM: 12 cards, 24 inline SVGs, 12 preview views, 12 review views
- Modes: 8 direct-surface cards and 4 flat-skin cards
- Layout: four columns by three rows; no card overlap or clipping
- Main proof surface: 1800 × 928.59375 CSS pixels
- Selection contract: 12/12 review outlines exactly match their declared artwork surfaces
- Runtime isolation: zero preview guide, role-metadata or text leakage
- Browser state: zero console errors/warnings, zero page errors and zero failed requests
- HTTP: the contact sheet returned 200; it was the page's only network request. A 204 favicon route was installed, but Chromium did not request a favicon.

## Required visual checks

- **PASS — selection chrome:** the dark-violet outline is independently visible and follows each exact editable surface rather than only its bounding box.
- **PASS — clean previews:** mapped and clean product previews contain no selection or orientation guides.
- **PASS — Food Truck:** the selected `510 × 120` lower-side panel is below the service sill and clear of window bars, cab and wheels.
- **PASS — Headphones:** the selected face is the hard exterior cap; the cushion, rear cup and headband remain fixed.
- **PASS — Takeaway Box:** Front, Lid / Top and Side labels plus top-direction arrows appear only on the editable net.
- **PASS — Trainer:** eight light lace strokes form four orderly criss-cross rows without dominating the upper.
- **PASS — stable shell family:** all unaffected product geometry, palette and cel-shaded treatment remain coherent with iteration 02.
- **PASS — deliberately unfinished:** no logo, slogan, price, mascot or completed advertisement has been introduced.
- **PASS — full sheet:** all twelve cards are legible in the four-by-three proof grid.

## Captured evidence

- File: `contact-sheet.png`
- Format: PNG
- Dimensions: 1800 × 929 pixels
- Bytes: 152833
- SHA-256: `7572798d595667e849672418c8666827309bcb08866e0e763f2955597d7aa53b`

The screenshot is an element-level Chromium capture of `main` at CSS scale. The immutable generated SVGs were not rewritten to obtain the proof.
