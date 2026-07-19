# Raster-template semantic-shape audit

Date: 2026-07-18

## Scope

- Release catalogue: `catalog/generated/offline-core-v1/catalog.json`
- Shipped raster templates reviewed: **2,050**
- Source sheets represented: **82** sheets, 25 cells each
- Review resolution: every source sheet at original resolution; borderline cells re-opened as individual runtime `master.png` files
- Audit focus: recognisable object silhouette, coherent geometry, plausible part count/anatomy, agreement with the catalogue title, usability as a recolourable/composable product template, and survival at catalogue-thumbnail scale

This audit covers the deployable catalogue only. Historical extraction folders that are not referenced by `offline-core-v1/catalog.json` were not counted as shipped assets.

## Partition and coverage

| Partition | Included sheet prefixes | Assets | Result |
| --- | --- | ---: | --- |
| A | 21-25 | 125 | 2 flagged for adjudication |
| B | 26-55 where present | 650 | 6 flagged for adjudication |
| C | 56-80 where present | 575 | 1 flagged for adjudication |
| D | 81-108 | 700 | 5 flagged for adjudication |
| **Total** | **All 82 shipped sheets** | **2,050** | **14 flagged; 2,036 cleared at full-size semantic review** |

Absent sheet numbers in those numeric ranges are not catalogue gaps: 29, 30, 39, 40, 64, and 73 have no shipped records in this release.

## Assets requiring focused adjudication

| Asset ID | Current title | Review concern | Severity before adjudication |
| --- | --- | --- | --- |
| `21-television-panels-bodies-r05c02` | Retro lower-speaker television with angled feet | Lower speaker is not visually identifiable; reads as a plain bezel | Material |
| `22-television-bases-components-r01c05` | Three-foot television stand | Only two load-bearing feet are clearly resolved | Material |
| `26-table-components-finishes-r03c03` | Turned-leg table base | Five distinct turned supports are visible | Material |
| `27-chairs-recliners-r01c02` | Spindle-back Windsor chair | Five under-seat supports create uncertain chair anatomy | Material |
| `27-chairs-recliners-r05c01` | Backless square bar stool | Four legs plus an unexplained central post | Material |
| `27-chairs-recliners-r05c02` | Upholstered-back bar stool | Four perimeter legs plus an anomalous fifth central support | Material |
| `46-toys-tabletop-collectibles-r05c05` | Modular robot action-figure parts | Body components are present but no head is visible | Material |
| `50-holiday-experience-scene-components-r01c04` | Snorkel mask and breathing tube | Mouthpiece appears detached from the tube | Minor |
| `62-escape-room-immersive-venue-bases-v2-r01c01` | Compact three-wall room shell | Illustration reads as an open-front corner rather than three visible walls | Material/title-sensitive |
| `82-renewable-energy-smart-home-add-ons-r05c05` | Blank wireless gateway antenna pair | Antennas are fused to a complete router body rather than supplied as a pair | Material |
| `86-hospitality-food-retail-venue-add-ons-r04c03` | Simple cart push handle | Two disconnected rails do not read as one installable handle | Material |
| `98-bag-carry-product-add-ons-r01c01` | Pair of short loop handles | Three handles are visibly present | Material |
| `100-footwear-apparel-add-ons-r01c01` | Tied shoelace | Three loops and two tails create implausible bow anatomy | Material |
| `106-outdoor-sport-add-ons-r04c02` | Set of six tent pegs | Five pegs are visible | Minor/count mismatch |

## Tent check

All three tent bodies on sheet `44-outdoor-camping-travel-equipment.png` are recognisable and geometrically coherent at full size. The catalogue item `44-outdoor-camping-travel-equipment-r05c02` (Compact backpacking tent) has a separate runtime concern: its right guyline/pole can read as a stray mark once reduced to the small selection-card preview. It therefore joins the 14 items above for thumbnail-scale adjudication, despite passing the full-size shape audit.

## Current release status

- **No catalogue-wide blocker was found.**
- **14 assets need a disposition**: keep, retitle, or regenerate.
- **1 additional tent asset needs a thumbnail-legibility disposition.**
- No files were removed, overwritten, or replaced during the audit.

Local Asset Packs were checked for compatible substitutes. The available tents/canopies are pixel-art environment elements or complete scene backgrounds, not neutral line-art product shells, so they are not drop-in replacements for this catalogue family.

## Codensus check and primary adjudication

One fresh, isolated Codensus Sol reviewer completed with terminal verdict `REVISE`. It independently supported title correction for the table, room shell, cart handles, and tent pegs, and found no broad failure in the illustration family. The evidence message accidentally named each runtime thumbnail `thumbnail.webp`; the actual files are `thumbnail-192.webp`. Codensus therefore could not assess thumbnail-scale evidence. Under the one-reviewer contract it was not rerun.

The primary agent then inspected all 15 correct `thumbnail-192.webp` files directly. Final release decisions are:

### Metadata corrections

| Asset ID | Replacement title |
| --- | --- |
| `21-television-panels-bodies-r05c02` | Flat-screen television with angled feet |
| `26-table-components-finishes-r03c03` | Square table with turned legs |
| `62-escape-room-immersive-venue-bases-v2-r01c01` | Compact two-wall room shell |
| `82-renewable-energy-smart-home-add-ons-r05c05` | Wireless router with antenna pair |
| `86-hospitality-food-retail-venue-add-ons-r04c03` | Pair of cart push handles |
| `106-outdoor-sport-add-ons-r04c02` | Set of five tent pegs |

### Versioned replacement art

| Asset ID | Decision | Reason |
| --- | --- | --- |
| `100-footwear-apparel-add-ons-r01c01` | Replace after pipeline validation | The current shoelace has three visible loops. The versioned correction has exactly two loops, two trailing ends, and two aglets. |
| `44-outdoor-camping-travel-equipment-r05c02` | Replace after pipeline validation | The current thumbnail's right-side guyline/hardware reads as a stray mark. The versioned correction removes all detached exterior fragments. |

The correction sources and exact prompts are under `catalog/source/generated-product-shells-v2/corrections/2026-07-18-shape-audit/`. Existing runtime masters remain untouched until regenerated derivatives, masks, metadata, and tests pass.

## Pipeline-integration closure — 2026-07-19

The two replacement holds above are now closed. The catalogue builder admits
each correction through an explicit, hash-pinned `masterOverride`; it does not
silently replace a source-sheet cell.

| Asset ID | Pinned correction SHA-256 | Runtime master SHA-256 | Runtime dimensions |
| --- | --- | --- | --- |
| `100-footwear-apparel-add-ons-r01c01` | `b7d1311b4bc56f3ca562151c9351716294ccca595ffc0b8371be90916d5e7739` | `d3b2e4be989fa52da700582a22efbb70ebc87df009b2b1c5ceee24429b3c89af` | 1254×1254 |
| `44-outdoor-camping-travel-equipment-r05c02` | `5890b4190bbb7cadca4aa6708ccdbe0bfee4f901a91dea267dec8ad0c8441fa6` | `e1218bcdc82f7c0384ca1df4b54834e85ded1aba034b58f050678a482379a303` | 1448×1086 |

`catalog/reports/raster-core-v1/source-selection.json` records both source
paths and source hashes, and `catalog/generated/offline-core-v1/catalog.json`
records the derived runtime hashes above. The six metadata corrections from
the adjudication are also present in the current runtime catalogue, including
`Flat-screen television with angled feet` and `Set of five tent pegs`.

The deployable catalogue therefore contains 2,050 fully partition-reviewed
templates with all 15 focused dispositions resolved: six metadata corrections,
two versioned image replacements, and seven retained assets whose original
art remained acceptable after individual adjudication.
