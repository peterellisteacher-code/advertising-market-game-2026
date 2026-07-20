# Image Lab: supervised classroom activation

Image Lab is built into the creator, but it is disabled by default. The normal product maker, Logo Lab, drawing tools and asset catalogue remain available when Image Lab is off.

Image Lab is also closed at the start of every pair's browser session. While physically supervising the class, the teacher enters the classroom code locally on that pair's MacBook to open a short-lived Image Lab capability. Students are not given the code. The capability expires after 75 minutes and can be revoked immediately with **Close Image Lab**. Closing or expiry does not remove images already saved into the campaign.

This makes Image Lab teacher-togglable per session rather than an always-on student service. The password-protected game, physical teacher supervision, pair-bound capability, expiry and close control form the classroom access and age-assurance layer. They do not override a provider's eligibility or minor-use terms.

## Supervised access gate

Peter has directed that Image Lab may operate only while he is physically present and only after he personally opens it for an individual pair. The retired `IMAGE_LAB_FAL_MINOR_USE_APPROVED` switch is no longer read by the application. Activation requires `IMAGE_LAB_SCHOOL_APPROVED=true`, the server-only classroom code, the pair-bound capability cookie, and the global `IMAGE_LAB_ENABLED` switch.

The current fal.ai Acceptable Use Policy says people under 18 may not use the service and makes account holders responsible for their users. Removing the technical letter gate records Peter's supervised operating decision; it is not a claim that fal.ai has changed or waived its policy.

A direct OpenAI API route has a different published framework: OpenAI's Under 18 API Guidance does not require an approval letter. It requires additional safeguards for minor-facing products, including age-appropriate disclosure, content filtering, reasonable monitoring and reporting/escalation, and age assurance where appropriate. Personal data of children under 13 or the applicable age of digital consent must not be processed without Zero Data Retention. The teacher-opened session gate satisfies only part of that framework; the remaining controls must be implemented before enabling a direct OpenAI route.

References:

- [fal.ai Acceptable Use Policy](https://fal.ai/legal/acceptable-use-policy)
- [fal.ai server-side integration guidance](https://fal.ai/docs/documentation/model-apis/inference/server-side)
- [fal.ai queue API](https://fal.ai/docs/documentation/model-apis/inference/queue)
- [fal.ai GPT Image 2](https://fal.ai/models/openai/gpt-image-2)
- [fal.ai GPT Image 2 Edit](https://fal.ai/models/openai/gpt-image-2/edit)
- [OpenAI Under 18 API Guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance)

## Server-owned profiles

Students cannot choose a model, slug, dimensions, step count, guidance, quality tier, output count or safety setting.

| Game power | Stable profile ID | fal model | Fixed request | Verified return |
| --- | --- | --- | --- | --- |
| Object Forge | `object-forge-gpt-image-2-low-v1` | `openai/gpt-image-2` | exact 1024×1024, low quality, one PNG | 1024×1024 PNG |
| Make It Real | `make-it-real-gpt-image-2-high-v2` | `openai/gpt-image-2/edit` | one 1024×576 canvas reference, exact `{ width: 1280, height: 720 }`, high quality, one PNG | exact 1280×720 PNG |

The two endpoints do not share one generic payload. Object Forge sends `prompt`, `image_size`, `quality`, `num_images` and `output_format`. Make It Real sends those fields plus `image_urls`. The production adapter uses an explicit `{ width, height }` object, not a named aspect-ratio preset.

GPT Image 2 concrete output sizes must use multiples of 16, keep each edge at or below 3840 pixels, keep the aspect ratio at or below 3:1, and contain 655,360–8,294,400 pixels. The server checks all four rules before reserving an allowance or dispatching to fal. A 1024×576 output request is below the pixel floor; the earlier 1088×608 return was fal's deterministic rescale of that invalid request, not a canonical 16:9 output. The smallest exact 16:9 size above the floor is 1280×720. Live request `019f7eb3-128d-78c1-9cb5-a3c576b5dd0d` returned an exact 1280×720 PNG, measured from the saved PNG header.

The browser's 512×512 Object Forge processing canvas is a local post-generation asset size, not a GPT Image 2 request. The 1024×576 Make It Real canvas is the reference image sent to the edit endpoint. Neither value is used as the GPT Image 2 output `image_size`.

The selection is supported by the [labelled live benchmark](../research/fal-image-lab-benchmark-2026-07-20.md). GPT Image 2 low produced the clearest customisable templates. Medium was visually near-identical in this use case while costing roughly nine times as much. GPT Image 2 Edit high preserved the prototype's silhouette and controls while producing a convincing final product photograph.

Two server-only experimental profiles are available for an adult-operated blind A/B test. They are not browser choices and do not replace the defaults merely because they cost less.

| A/B profile ID | fal model | Fixed output | Fixed limits |
| --- | --- | --- | --- |
| `z-image-lora-v1` | `fal-ai/z-image/turbo/lora` | 512×512 PNG | 8 steps, one image, safety on, regular acceleration, prompt expansion off, exactly one server-owned LoRA at scale 1 |
| `flux2-turbo-edit-v1` | `fal-ai/flux-2/turbo/edit` | 1024×576 PNG | guidance 2.5, one image, safety on, prompt expansion off, exactly one canvas reference |

Leave the selectors absent to retain the current profiles. For a controlled adult A/B run only, set one or both of:

```text
IMAGE_LAB_OBJECT_PROFILE_ID=z-image-lora-v1
IMAGE_LAB_Z_LORA_URL=<trimmed public HTTPS URL for the approved shared adapter>
IMAGE_LAB_REALISE_PROFILE_ID=flux2-turbo-edit-v1
```

Only those profile IDs are accepted. An unknown selector, or a missing or unsafe LoRA URL while `z-image-lora-v1` is selected, fails closed before allowance is reserved or a fal request is submitted. The adapter URL is server-only and is never returned to the browser. Existing job tokens retain their original stable profile ID, so status and result requests continue using the submitted model after selectors change.

The browser sends only the pair identity and constrained creative choices. Make It Real also sends a locally prepared 1024×576 reference image of the current canvas. The fal key, model identity, prompt wrapper, paid media URL and upstream request ID remain server-side.

## Required Netlify environment

```text
IMAGE_LAB_ENABLED=true
IMAGE_LAB_SCHOOL_APPROVED=true
IMAGE_LAB_ACCOUNT_CAP_USD=5
IMAGE_LAB_CLASSROOM_CODE=<at least 8 characters>
IMAGE_LAB_SIGNING_SECRET=<at least 32 random characters>
IMAGE_LAB_SESSION_MINUTES=75
IMAGE_LAB_OBJECT_ALLOWANCE=6
IMAGE_LAB_REALISE_ALLOWANCE=1
FAL_KEY=<server-only fal key>
```

`IMAGE_LAB_ACCOUNT_CAP_USD` is an activation acknowledgement, not a billing control. Configure a real hard spending limit on the fal account or dedicated key before enabling the feature. Never put `FAL_KEY` in Vite variables, HTML, client code or a public repository.

## Expected classroom cost

At the live prices checked on 20 July 2026, a 1024×1024 Object Forge image at low quality is US$0.006. Budget US$0.211 for each 1280×720 high-quality edit unless the fal dashboard shows a newer lower price.

For 15 pairs, six Object Forge images each cost about US$0.54 in total. One final Make It Real image each adds up to about US$3.17, giving a conservative session ceiling of about **US$3.71** before price changes. Raising the final allowance to two would raise that ceiling to about **US$6.87**. Confirm current pricing before every activation.

The cheaper FLUX and Z-Image candidates remain available only as adult-operated A/B profiles. The live benchmark found that their lower price did not compensate for weaker silhouette reliability and poorer catalogue-style fit. The shared Z-Image LoRA remains a possible future consistency experiment, not a current cost-saving or production recommendation.

Alternative-profile trials remain teacher-operated and must never create an ungated student-access path.

## Security properties and limits

- Image jobs use authenticated encrypted browser tokens; the upstream fal request ID is not readable in the token.
- The capability cookie is signed, pair-bound, short-lived, `HttpOnly`, `SameSite=Strict` and scoped to `/api/image-lab`.
- Generated media is fetched by the server from an allowlisted `fal.media` HTTPS host, checked for type, signature, byte limit and the exact dimensions pinned to the submitted profile, then proxied same-origin with `no-store`.
- Accepted images become owned local blobs in the campaign draft. Saved campaigns do not depend on expiring fal URLs.
- Submission is not retried automatically.
- The signed-cookie allowance prevents ordinary accidental overuse, but it is not a transactional global budget. Concurrent replay cannot be fully prevented without server-side state. The external fal account cap is mandatory.
- All automated verification uses injected fake responses. It performs no paid fal inference.

## Activation check

1. Confirm school approval and Peter's physical supervision for the complete session.
2. Create a dedicated server-side fal key.
3. Apply a hard fal account/key spending cap.
4. Set a new classroom code and signing secret.
5. Keep Object Forge and Make It Real allowances low for the first session.
6. Test with the teacher account before students arrive.
7. Keep the classroom code private; the teacher enters it on each pair's MacBook only while physically supervising that session.
8. Confirm the capability reports closed before the lesson, opens only after teacher action, expires after 75 minutes, and closes immediately from **Close Image Lab**.
9. Keep the default profiles unless sealed teacher-operated blind A/B evidence supports a change.
10. Close each active pair session at the end of the lesson, then disable `IMAGE_LAB_ENABLED` immediately after the activity.
