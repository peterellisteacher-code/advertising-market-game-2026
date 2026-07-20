# Image Lab: supervised classroom activation

Image Lab is built into the creator, but it is disabled by default. The normal product maker, Logo Lab, drawing tools and asset catalogue remain available when Image Lab is off.

Image Lab is also closed at the start of every pair's browser session. While physically supervising the class, the teacher enters the classroom code locally on that pair's MacBook to open a short-lived Image Lab capability. Students are not given the code. The capability expires after 75 minutes and can be revoked immediately with **Close Image Lab**. Closing or expiry does not remove images already saved into the campaign.

This makes Image Lab teacher-togglable per session rather than an always-on student service. The password-protected game, physical teacher supervision, pair-bound capability, expiry and close control form the classroom access and age-assurance layer. They do not override a provider's eligibility or minor-use terms.

## Safety gate

Do not activate Image Lab for students until the selected image provider has confirmed in writing that this teacher-controlled school API integration may be used by Year 10 students. For the currently implemented fal.ai route, the current fal.ai Acceptable Use Policy says users must be at least 18. School approval, physical supervision and the session toggle do not by themselves override the provider's terms.

If an OpenAI-backed image route is added, retain written confirmation that the intended supervised minor use is compatible with the applicable OpenAI service and account terms before enabling it. The same teacher-opened, pair-bound, short-lived capability must remain in front of that route; provider approval and technical supervision are separate requirements.

Activation therefore requires both:

- `IMAGE_LAB_SCHOOL_APPROVED=true`
- `IMAGE_LAB_FAL_MINOR_USE_APPROVED=true`

The second value means written provider approval has been obtained and retained. It is not a technical workaround.

References:

- [fal.ai Acceptable Use Policy](https://fal.ai/legal/acceptable-use-policy)
- [fal.ai server-side integration guidance](https://fal.ai/docs/documentation/model-apis/inference/server-side)
- [fal.ai queue API](https://fal.ai/docs/documentation/model-apis/inference/queue)

## Server-owned profiles

Students cannot choose a model, slug, dimensions, step count, guidance, quality tier, output count or safety setting.

| Game power | Server profile | Fixed output | Fixed limits |
| --- | --- | --- | --- |
| Object Forge | `fal-ai/flux/schnell` | 512×512 PNG | 4 steps, guidance 3.5, one image, safety on, no acceleration |
| Make It Real | `fal-ai/qwen-image-edit-plus-lora-gallery/integrate-product` | 1024×576 PNG | 6 steps, guidance 1, one image, safety on, regular acceleration, LoRA scale 1 |

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

The browser sends only the pair identity and constrained creative choices. Make It Real also sends a locally resized 1024×576 reference image of the current canvas. The fal key, model identity, prompt wrapper, paid media URL and upstream request ID remain server-side.

## Required Netlify environment

```text
IMAGE_LAB_ENABLED=true
IMAGE_LAB_SCHOOL_APPROVED=true
IMAGE_LAB_FAL_MINOR_USE_APPROVED=true
IMAGE_LAB_ACCOUNT_CAP_USD=5
IMAGE_LAB_CLASSROOM_CODE=<at least 8 characters>
IMAGE_LAB_SIGNING_SECRET=<at least 32 random characters>
IMAGE_LAB_SESSION_MINUTES=75
IMAGE_LAB_OBJECT_ALLOWANCE=6
IMAGE_LAB_REALISE_ALLOWANCE=2
FAL_KEY=<server-only fal key>
```

`IMAGE_LAB_ACCOUNT_CAP_USD` is an activation acknowledgement, not a billing control. Configure a real hard spending limit on the fal account or dedicated key before enabling the feature. Never put `FAL_KEY` in Vite variables, HTML, client code or a public repository.

## Expected classroom cost

At the researched prices, Object Forge is approximately US$0.003 per image and Make It Real approximately US$0.035 per image. A 15-pair session with six Object Forge images and two Make It Real images per pair is approximately US$1.32 before provider price changes.

With the same 15-pair allowance, plain FLUX Schnell plus FLUX 2 Turbo Edit is approximately US$0.75 and is the cheapest candidate combination. The shared Z-Image LoRA plus FLUX 2 Turbo Edit is approximately US$1.245 per class, plus about US$2.26 for a one-time 1,000-step training run. The LoRA is therefore a possible consistency improvement, not a cost-saving claim. Preserve the defaults until blind comparison proves the alternative keeps deliberate composition, blank customisable surfaces and the catalogue's visual language. Confirm current pricing before every activation.

Until written fal minor-use approval has been retained, all alternative-profile trials must be adult-operated blind A/B tests only. Teacher supervision does not remove the provider eligibility gate.

## Security properties and limits

- Image jobs use authenticated encrypted browser tokens; the upstream fal request ID is not readable in the token.
- The capability cookie is signed, pair-bound, short-lived, `HttpOnly`, `SameSite=Strict` and scoped to `/api/image-lab`.
- Generated media is fetched by the server from an allowlisted `fal.media` HTTPS host, checked for type, signature, byte limit and exact dimensions, then proxied same-origin with `no-store`.
- Accepted images become owned local blobs in the campaign draft. Saved campaigns do not depend on expiring fal URLs.
- Submission is not retried automatically.
- The signed-cookie allowance prevents ordinary accidental overuse, but it is not a transactional global budget. Concurrent replay cannot be fully prevented without server-side state. The external fal account cap is mandatory.
- All automated verification uses injected fake responses. It performs no paid fal inference.

## Activation check

1. Retain fal.ai's written minor-use approval.
2. Create a dedicated server-side fal key.
3. Apply a hard fal account/key spending cap.
4. Set a new classroom code and signing secret.
5. Keep Object Forge and Make It Real allowances low for the first session.
6. Test with the teacher account before students arrive.
7. Keep the classroom code private; the teacher enters it on each pair's MacBook only while physically supervising that session.
8. Confirm the capability reports closed before the lesson, opens only after teacher action, expires after 75 minutes, and closes immediately from **Close Image Lab**.
9. Keep the default profiles unless the sealed adult blind A/B evidence supports a change.
10. Close each active pair session at the end of the lesson, then disable `IMAGE_LAB_ENABLED` immediately after the activity.
