# Magnific Stock reconnaissance: iteration 01

Date: 2026-07-13

## Outcome

Magnific Stock is available for metadata search and public preview inspection across resources, icons, videos, music and sound effects. Search and preview calls consumed no download slots. The connector's post-check reported `downloadSlotsConsumed: 0`.

The first pass identified three useful non-AI stock candidates and rejected one oversized PSD. No finished advertisement or AI-generation route was used.

## Search reach

| Need | Catalogue | Query result count | Initial use |
|---|---|---:|---|
| Blank product bodies | Resources | 8,108 | Packaging and container shells |
| People and hands | Resources | 8,102 | Market scenes and product-in-hand mockups |
| Patterns and textures | Resources | 8,100 | Student-controlled fills and backgrounds |
| CTA, badges and tags | Icons | 50 | Editable interface and poster components |
| UI feedback | Sound effects | 383 | Click, select and confirmation feedback |
| Coin/market feedback | Sound effects | 2 | Purchase and revenue moments |
| Garden replacement | Resources | 8,100 | Broad-surface watering-can references |

These are search totals, not approved assets. Every actual game asset still requires visual inspection, brand screening, metadata capture and classroom review.

## Preview decisions

### Select: 419038900 — Matte Garden Watering Can Mockup

The silhouette is instantly readable and the cylindrical body provides a large blank surface. It is a strong reference or realistic product-body option for the next Garden iteration. The source is non-AI, premium JPG stock by `hirakhan0304644`.

### Select: 420193310 — Blank Foil Snack Package Vector Illustration

This is the strongest general-purpose candidate in the sample: a clean blank pouch with clear seals, restrained dimensionality and a very large face. The EPS source should support colour variants and derived masks. The source is non-AI premium vector stock by `brgfx`.

### Hold: 249733812 — Blank Spray Bottle

The asset is non-AI and offers EPS, JPG and a tiny SVG source. It is valuable as a reusable bottle component, but its silhouette is too generic to replace the failed Garden prototype.

### Reject for now: 427208816 — Cream Tube PSD

The realistic smart-object mockup is visually strong, but its 141 MB PSD is disproportionate for the current browser catalogue and does not match the approved cel-shaded shell family. Keep the metadata for a later optional realistic-mockup route.

## Acquisition result

- Watering-can JPG download: connector returned `unexpected download response`; no file was produced.
- Spray-bottle SVG download and retry: the same connector error; no file was produced.
- Sound-effect detail probe: HTTP 403.
- Final access probe: all five catalogue families remained searchable and `downloadSlotsConsumed` remained 0.

The shortlist and previews are therefore evidence only, not licensed source downloads. Do not ingest the browser-rendered previews as production masters.

## Catalogue integration rule

1. Keep Magnific search metadata separate from approved runtime assets.
2. Require `isAiGenerated: false`, no finished campaign, no visible real brand and a large reusable surface.
3. Preserve creator, source page and licence URL in every source record.
4. Download only an inspected candidate in its most editable useful format.
5. Retain the original in `catalog/source`; derive browser masters, previews, thumbnails and masks into a versioned generated pack.
6. Mark assets `classroomReviewed: true` only after visual inspection and brand screening.
7. Use Magnific to broaden product bodies, hands, settings, patterns and feedback media; do not let it replace the coherent editable shell system.
