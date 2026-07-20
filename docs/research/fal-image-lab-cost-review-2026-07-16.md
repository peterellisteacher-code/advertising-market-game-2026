# Image Lab cost and style review — 16 July 2026

> **Superseded default — 20 July 2026.** This document remains as the historical research record. A live same-prompt bake-off subsequently selected `openai/gpt-image-2` at 1024×1024 low quality for Object Forge and `openai/gpt-image-2/edit` at high quality for the single final Make It Real pass. See the [labelled benchmark and request record](fal-image-lab-benchmark-2026-07-20.md).

## 20 July production decision

| Stage | Selected endpoint | Server-owned request | Budget price |
| --- | --- | --- | ---: |
| Object Forge | `openai/gpt-image-2` | exact 1024×1024, low quality, one PNG | US$0.006/image |
| Make It Real | `openai/gpt-image-2/edit` | exact 1024×576 request, high quality, one PNG and one canvas reference | US$0.151/image conservative published upper proxy |

One named 16:9 preset call and one exact `{ width: 1024, height: 576 }` call were run. Both returned 1088×608, so the production contract distinguishes the local 1024×576 reference canvas from the verified provider output. The default final-render allowance is one per pair.

For 15 pairs using six Object Forge images and one final edit each, the conservative ceiling is about US$2.81. The visual test found GPT Image 2 low materially more reliable for clean, believable product geometry than the cheaper untrained models. GPT Image 2 medium looked nearly identical for this task while costing roughly nine times as much, so it was rejected for the frequent lane.

The 16 July analysis below is retained unchanged as dated evidence; references to “current” profiles describe the state on that date, not the active default.

## Outcome

The offline catalogue remains the dependable classroom foundation. Image Lab should expand that catalogue when a team cannot find the product or component it wants; it must not be required to finish the game.

The most economical interaction is a constrained in-game form plus a server-owned prompt template. A conversational language-model agent would add cost, latency and another prompt-injection surface without improving this narrow image task.

For a catalogue-matched house style, the leading candidate is one shared Z-Image Turbo style LoRA trained once on a curated set of accepted, non-student catalogue assets. It should replace the current untrained Object Forge profile only after a small adult-operated visual A/B test proves that it materially improves silhouettes, blank customisable surfaces and style consistency.

## Current official prices

Prices were checked against fal's official model pages on 16 July 2026 and must be rechecked before activation.

| Purpose | Endpoint | Price | Notes |
| --- | --- | ---: | --- |
| Cheapest untrained object draft | `fal-ai/flux/schnell` | US$0.003/MP | Current Object Forge profile; output is billed by rounding up to a megapixel. |
| Cheap untrained alternative | `fal-ai/z-image/turbo` | US$0.005/MP | Up to eight steps; prompt expansion costs extra and is unnecessary here. |
| Shared style training | `fal-ai/z-image-trainer` | US$2.26/1,000 steps | Minimum 100 steps; supports a style-focused training mode. |
| Shared style inference | `fal-ai/z-image/turbo/lora` | US$0.0085/MP | Up to three LoRAs; this is the leading styled Object Forge candidate. |
| FLUX shared style training | `fal-ai/flux-lora-fast-training` | US$2/1,000-step default run | Slightly cheaper training, but inference is much dearer. |
| FLUX shared style inference | `fal-ai/flux-lora` | US$0.035/MP | Not cost-effective for repeated simple classroom components. |
| Current final product render | `fal-ai/qwen-image-edit-plus-lora-gallery/integrate-product` | US$0.035/MP | Purpose-built product integration; current Make It Real profile. |
| Candidate final product render | `fal-ai/flux-2/turbo/edit` | US$0.008/MP input + output | A 1 MP input and 1 MP output cost about US$0.016 total; visual fidelity must be compared with the product-specific endpoint. |

Official sources:

- https://fal.ai/models/fal-ai/flux/schnell
- https://fal.ai/models/fal-ai/z-image/turbo
- https://fal.ai/models/fal-ai/z-image-trainer
- https://fal.ai/models/fal-ai/z-image/turbo/lora/playground
- https://fal.ai/models/fal-ai/flux-lora-fast-training
- https://fal.ai/models/fal-ai/flux-lora
- https://fal.ai/models/fal-ai/qwen-image-edit-plus-lora-gallery/integrate-product
- https://fal.ai/models/fal-ai/flux-2/turbo/edit

## Fifteen-pair classroom estimates

Assumptions: six Object Forge images and one final Make It Real image per pair. Prices are estimates, not billing controls.

| Profile | Repeated classroom cost | One-time training |
| --- | ---: | ---: |
| Current FLUX Schnell + product-specific Qwen | about US$0.80 | none |
| Styled Z-Image + product-specific Qwen | about US$1.29 | about US$2.26 |
| Styled Z-Image + FLUX 2 Turbo Edit | about US$1.01 | about US$2.26 |

The styled route therefore costs only about fifty cents more per 15-pair class than the current profiles if the product-specific final renderer is retained. The one shared training run is reusable across classes.

## Training dataset

Use 30–50 deliberately curated accepted catalogue assets, sampled across unrelated product categories so the LoRA learns visual language rather than memorising one product family. Training inputs should have:

- the approved clean raster-outline/illustration treatment;
- one centred object or component;
- generous blank customisable surfaces;
- consistent stroke weight and viewing angle conventions;
- no labels, brands, watermarks, student work or personal data;
- enough silhouette variety to reduce overfitting.

Keep the trained adapter outside the browser. Configure its URL and scale server-side, and retain a durable copy plus source/training metadata. Generated output should still pass the existing image-size, media-host, signature and byte-limit checks before it reaches the canvas.

## Required visual test

Before changing the production profile, run the same sealed prompt set through:

1. current FLUX Schnell;
2. untrained Z-Image Turbo;
3. the shared Z-Image Turbo LoRA.

The prompt set should cover a drink can, burger box, handbag component, bicycle, refrigerator, sofa, hand tool, holiday venue and unusual student-invented object. Judge blind for recognisable silhouette, usable blank surface, single-object compliance, absence of text/branding, clean background removal and consistency with the built-in catalogue. Do not select the trained route merely because it looks more polished.

Run a separate blind comparison between the current product-specific Qwen endpoint and FLUX 2 Turbo Edit using completed student-like canvas references. Prefer the cheaper endpoint only if it preserves deliberate composition, colour and markings well enough.

## Eligibility note and later operating decision

fal's Terms of Service, last updated 3 March 2026, and its current Acceptable Use Policy say users must be at least 18. Teacher presence or school approval does not itself amend that published policy.

On 20 July 2026 Peter explicitly retired the provider-letter technical switch and required teacher-operated, student-by-student session opening instead. The active implementation therefore uses:

- `IMAGE_LAB_SCHOOL_APPROVED=true`

The removal of `IMAGE_LAB_FAL_MINOR_USE_APPROVED` records that operating decision; it is not evidence that fal.ai changed or waived its published policy. The server key remains hidden, students cannot select providers or parameters, and every pair capability remains teacher-opened, bounded and revocable.

Official sources:

- https://fal.ai/legal/terms-of-service
- https://fal.ai/legal/acceptable-use-policy
