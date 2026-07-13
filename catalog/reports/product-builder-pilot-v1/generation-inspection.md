# Product Builder Pilot — Generation and Inspection

Date: 2026-07-14 (Australia/Adelaide)

Decision: **PHYSICAL_PACK_PASS**. This approves the compact physical pack as input to the browser parser and composer. It does not approve runtime placement, palette/material rendering, persistence, UI, or classroom gameplay.

## Code gate

- Contract commits: `68bce63`, `f11e36f`, `372839c`
- Renderer commit: `a2cbc70`
- Containment fix: `03937e8`
- Independent review initially returned `REVISE`: Weekender and Sports Bottle artwork paths exceeded their declared bounds, and the stroked Tabbed Closure exceeded its component bounds.
- The fix added exact quadratic-extrema and stroke-aware containment regressions. Closure review returned `PASS — PROCEED`.
- Final Python pipeline verification: **164 passed**.

## One-shot generation

The generator was invoked once into the previously absent target `catalog/generated/product-builder-pilot-v1/`. It was not rerun.

- Files: **39**
- Total bytes: **75,162**
- Authoring SVGs: **12**
- Preview SVGs: **12**
- Component SVGs: **12**
- Catalogue/source/QA records: **3**
- Catalogue references present: **36/36**
- Non-self QA hashes matched: **38/38**
- Reparse points: **0**
- Virtual count: **6,144**
- Stored variant array: **absent**
- Recursive inventory SHA-256: `cf5b28137eebfd7f608d3a407f45b01bd46cbe6a9e96d17eb050d616ccf3c50b`

The protected reviewed shell pack retained Git tree `94b6ffa3a9715b1125afc27a5dcb7406a0cc9553`.

## Browser inspection

The rendered physical-pack sheet contains 12 body previews and 12 component previews:

- 24 cards and 24 SVGs
- no scripts, raster images, or external links
- no console errors or warnings
- no network requests
- no horizontal overflow at 1800 px

Evidence: `contact-sheet.png`, 180,138 bytes, SHA-256 `e7e450c34d53b1cda87fd7dc1b41b172998c358f00383bda15e9f3303832658b`.

All 12 authoring SVGs were then inspected separately:

- 12 editor-guide groups
- 12 primary selection outlines
- 12 clipped artwork slots
- no horizontal overflow
- no console errors or warnings

Evidence: `authoring-contact-sheet.png`, 140,283 bytes, SHA-256 `b981f17f82b646c13c6c2257431e8efca5fe89542521fe2ccfff8d8deae8c29`.

## Next-stage obligations

The composer must map normalized parts to each body anchor without distorting strokes, recolour only declared `data-region` elements, apply material profiles lazily, preserve structural layers above student artwork, and validate fetched SVG root identities before Fabric parsing.
