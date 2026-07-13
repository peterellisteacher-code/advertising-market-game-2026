# Advertising Market Game: Visual System and Consensus Gate

**Date:** 13 July 2026

**Status:** Approved direction

## Purpose

Every meaningful visual decision in the Advertising Market Game is developed through a small proof, inspected in the real game context, and independently reviewed before it is multiplied across the project. This applies to product shells, the creator interface, logos, icons, game screens, market cards, stalls, animation, teacher controls and final visual polish.

The panel is a design aid, not an automatic judge. Codex synthesises agreements and disagreements against the project's fixed constraints: fun-first play, attractive student output, pair use on one computer, classroom legibility and a 50–60 minute session.

## Fixed Visual Panel

The panel always uses these six OpenRouter vision models in this order:

1. `moonshotai/kimi-k2.7-code`
2. `stepfun/step-3.7-flash`
3. `google/gemini-3.1-pro-preview`
4. `xiaomi/mimo-v2.5`
5. `minimax/minimax-m3`
6. `x-ai/grok-4.5`

Each slot receives the same neutral prompt, screenshots and relevant context. Reviewers work independently and do not see another slot's answer or Codex's preferred conclusion.

Each panel call uses `max_tokens: 32000` per model. Prompts impose no word count, brevity requirement or artificial output ceiling. Successful slots are retained. A slot that errors, times out or reports truncation is retried once by itself with the same evidence and instructions; successful slots are not rerun. Provider and harness timeouts cannot be eliminated, so persistent failures are recorded explicitly rather than silently replaced with another model.

Raw labelled responses remain advisory. Codex records the evidence, areas of agreement, genuine conflicts, its resolution and the resulting design change.

## Iterative Visual Gates

### 1. Direction gate

Research and a deliberately small comparison establish the art direction before asset production or broad interface work. No rejected direction is scaled into a large catalogue.

### 2. Audition gate

Representative proofs cover the hardest and most different cases. Product-shell auditions use approximately twelve examples across packaging, apparel, technology, hospitality and irregular products before any 50-item sheet is produced.

### 3. Integration gate

The approved visual language is reviewed inside the working editor or game at classroom viewport sizes. The panel judges hierarchy, tool discoverability, editable space, legibility, visual excitement and whether student work remains the hero.

### 4. Release gate

Complete screens and representative gameplay sequences are reviewed together for consistency, accessibility, polish and classroom usability before the build is called ready.

A new panel is required after a material visual change, not after minor spacing or mechanical corrections. The purpose is iterative improvement without creating a reviewer loop.

## Decision Rules

- A shared issue raised independently by at least four slots is treated as a consensus finding.
- A readability, accessibility or serious usability problem supported by at least two slots is treated as a required correction.
- Minority observations are retained when they identify a concrete risk not contradicted by project evidence.
- Conflicting aesthetic advice is resolved against the approved product constraints and actual browser evidence; visual opinions are not averaged into a compromise style.
- Panel approval never replaces Peter's judgment. A direction Peter rejects is rejected.

## Approved Product-Template Direction

The first thick-outline contact sheet was rejected. Its heavy contours, persistent blue dashed boxes, small rectangular design areas and flat clip-art appearance competed with student artwork.

The replacement direction is a clean cel-shaded product system:

- fine dark-grey outer contours and lighter internal details;
- neutral, recolourable base fills with two or three restrained tonal planes;
- large editable faces clipped to the product's real silhouette or surface;
- no guides in catalogue thumbnails, market cards or exports;
- subtle selectable overlays or corner guides only while editing;
- clean three-quarter product thumbnails and market previews;
- for cans, bottles, boxes and other wrapped packaging, a large flat label or skin canvas beside a synchronised product preview.

The next proof is a twelve-item visual audition. Fifty-item contact sheets remain the review format after the visual language passes, not the method used to invent the style.

## Evidence From the First Six-Model Gate

All six slots returned **REVISE** for the rejected bottle-and-can crop. Shared findings were that the blue guides dominated, the forms looked flat or clip-art-like, the branding zones were too restrictive, and the editable areas did not follow the product surfaces. Most reviewers recommended finer neutral contours, restrained dimensionality, larger clipped design areas and guide-free thumbnails. Advice differed on the exact amount of shading and when guides should appear; the project resolves this with restrained cel shading and guides visible only when useful in the live editor.

## Acceptance Conditions

This visual system passes when:

1. blank products look desirable before student artwork is added;
2. student artwork remains visually dominant;
3. the editable region is obvious during editing but absent from the finished result;
4. thumbnails remain clear at catalogue size and market cards remain persuasive at 480×270;
5. product families feel coherent without looking identical;
6. panel evidence and browser evidence show no unresolved consensus-level problem.
