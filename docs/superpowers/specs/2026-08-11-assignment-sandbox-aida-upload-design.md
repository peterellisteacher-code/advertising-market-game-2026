# Assignment Sandbox, Drawing Upload, and Dual AIDA Design

Date: 11 August 2026
Status: Approved design
Project: Advertising Market Game 2026

## Purpose

Add a desktop/laptop assignment workspace in which students can plan and build their own advertisement without completing the guided agency missions first. The workspace must align with the Year 10 Advertising Text Production assignment and the six-page AIDA/Image Composition handout.

The sandbox complements the existing game. It does not replace, shorten, or loosen the guided Agency campaign.

## Source alignment

The assignment requires students to create a print or digital advertisement for a clearly defined target audience and explain how its language and visual choices influence that audience. The handout separates two related decisions:

1. Page 5 defines the product and applies AIDA to the product's persuasive promise.
2. Page 6 plans the advertisement itself and applies AIDA again to the ad's visible and verbal choices.

The sandbox therefore keeps **Product AIDA** and **Advertisement AIDA** separate. Students should be able to explain the feature or function that attracts attention even when the attention strategy is not primarily visual.

## Recommended experience

### Entry and continuity

- Add an **Open assignment sandbox** action to the game's start/lobby surface.
- The existing guided game remains the primary **Start game** path.
- Opening the sandbox does not require mission completion or a live market room.
- The current authenticated pair account owns one durable sandbox draft.
- On entry, reopen the latest sandbox draft when one exists; otherwise create a blank sandbox document.
- Closing the studio returns to the lobby, not to a campaign level or publication gate.
- The sandbox must never overwrite the guided practice campaign document.

### Workspace mode

The campaign document gains a backwards-compatible workspace mode:

- `guided` — existing behaviour, feature locks, role journey, mission-linked evidence, and publication checks remain unchanged.
- `assignment-sandbox` — all ordinary ad-building tools are available immediately; campaign progression, role handoff requirements, pricing gates, market-route gates, and mission completion are not required.

The studio visibly labels sandbox mode as **ASSIGNMENT SANDBOX** so students do not mistake it for campaign progress.

### Assignment planner

In sandbox mode, the AIDA tool becomes an assignment planner with four compact sections. Entries autosave with the canvas.

1. **Define the product**
   - Product name
   - What the product does
   - Target audience
   - Advertising location or context
   - Feature to emphasise
   - Difference from alternatives
   - Materials
   - Estimated production cost
   - Sale price

2. **Product AIDA**
   - Attention — what about the product first attracts notice; this may be its function, promise, name, appearance, or another deliberate hook.
   - Interest — the feature, information, surprise, or additional capability that gives the audience a reason to continue.
   - Desire — how a feature becomes a relevant benefit and how the audience might imagine life with the product.
   - Action — the honest, specific next step the audience can take.

3. **Values for Desire**
   - Preserve the page-5 families and terms: Responsibility, Practicality, Identity, Experience, Performance, and Care.
   - Students may select multiple relevant values, but the interface prompts them to identify which value is most important to the intended audience.

4. **Advertisement AIDA**
   - Retain the existing AIDA technique deck and the four saved advertisement-plan fields.
   - In sandbox mode, an ad-stage response may be saved without binding it to a selected canvas object.
   - When an object is selected, students may still link the response to that visible evidence.
   - The prompts distinguish the advertisement's communication choices from the product's underlying promise.

The planner is procedural while students work, but its saved product and advertisement plans form an interpretive summary they can use in the writer's statement and oral explanation.

## Drawing and mockup upload

### Accepted input

- Add **Upload your drawing or mockup** to the Image tool.
- Accept PNG, JPEG, and WebP selected from the local device.
- Reject empty files, mismatched/undecodable image data, unsupported formats, and files above a bounded size before placement.
- Decode and re-encode the image locally to remove untrusted metadata and normalise large camera photographs to a safe working size.
- Do not upload the source file to Fal.ai merely because it was selected. Fal.ai receives an image only after the student explicitly activates a paid Make It Real action.

### Canvas behaviour

- Place the upload as a normal selected image object.
- Students can move, resize, crop/fill, layer, lock, hide, delete, Undo, and Redo it with the existing tools.
- The upload is stored through the existing local-blob/account-asset draft path so the sandbox survives reload and cloud recovery.
- Uploading does not flatten or replace existing work.
- The student can use **Fill ad** when the upload is a complete page-6 advertisement sketch.

## Fal.ai workflows

### Preserve the existing product workflow

Keep **Make the product real** as the existing product-mockup operation. It transforms the current product design into a realistic product showcase and uses the existing teacher-controlled Make It Real allowance.

### Add advertisement realisation

Add **Make this advertisement realistic** as a second operation under the same teacher-controlled Make It Real allowance.

The advertisement operation:

1. Exports the current 1600×900 canvas without editor chrome.
2. Normalises it to the existing 1024×576 Fal.ai reference contract.
3. Sends bounded, server-validated planning context: product name/function, target audience, advertising location, and the four Advertisement AIDA responses.
4. Uses a distinct server-owned prompt profile that asks for a realistic finished advertisement while preserving the supplied composition, product identity, colour plan, intentional marks, and readable wording as closely as the model permits.
5. Adds no invented brand, unsupported claim, people, watermark, or signature.
6. Returns the generated 1280×720 PNG through the existing authenticated asset route.
7. Places it as a new selected, full-canvas top layer.

The original design remains in the Undo history and underneath the generated layer. One Undo or deleting the generated layer returns to the student's editable mockup. This is deliberately non-destructive.

Because image models can alter lettering, the interface tells students to check every word and use the builder's text tools for exact final copy.

### Billing and authority

- Do not create a new unrestricted Fal.ai path.
- Both realisation choices use the current authenticated pair account, global Image Lab switch, per-pair allowance, reservation, reconciliation, idempotency, and teacher controls.
- Object Forge remains separate.
- A failed or uncertain request follows the existing check/reconcile workflow and cannot silently consume duplicate allowance.

## Data model

Extend the version-1 document with defaulted, backwards-compatible fields rather than invalidating existing drafts:

```text
workspaceMode: "guided" | "assignment-sandbox"  // default guided
assignmentPlan:
  productFunction
  targetAudience
  advertisingLocation
  featureToEmphasise
  differenceFromAlternatives
  materials
  estimatedProductionCost
  salePrice
  desireValueIds[]
  primaryDesireValueId
  productAidaPlan:
    attention
    interest
    desire
    action
```

The existing `product.name` remains the canonical product name. The existing `strategy.aidaPlan` remains the canonical **Advertisement AIDA** plan. Existing guided documents parse with `workspaceMode = guided` and a blank assignment plan.

Student uploads add an explicit local asset reference distinct from AI-generated images. AI outputs retain their profile and request IDs, and the new advertisement profile remains distinguishable from the existing product profile.

No database table or Supabase object change is expected. The document and blobs continue through the existing account-scoped JSON/asset persistence mechanisms. If implementation evidence contradicts this, stop before any Supabase mutation and reassess the release scope.

## Interface and accessibility

- Desktop/laptop only; target keyboard plus mouse/trackpad.
- Verify at 1280×800 and 1440×900.
- The assignment planner uses real labels, headings, fieldsets, status regions, and keyboard-reachable controls.
- Upload validation and Fal.ai status are announced without stealing focus.
- The planner and Image Lab must remain usable with standard, large-text, and high-contrast display settings.
- The compact bottom canvas toolbar remains unchanged and unobstructed.
- The teacher-playtest strip must not overlap planner fields, Image Lab actions, or the item list.
- No phone-specific layout, touch-only control, or mobile breakpoint is added.

## Error handling

- Unsupported upload: explain the accepted image types.
- Oversized or undecodable upload: keep the current canvas unchanged and explain that the image could not be prepared.
- Draft recovery failure: keep the source draft untouched and offer a new blank sandbox only when no recoverable sandbox exists.
- Fal.ai unavailable or no allowance: built-in tools and uploads remain usable.
- Fal.ai text drift: keep the original mockup recoverable and prompt the student to verify wording.
- Stale account or pair: abort placement and retain the generated asset outcome for existing reconciliation rather than placing it into another account's draft.

## Verification and acceptance

### Focused automated coverage

- Old guided documents default to guided mode and remain semantically compatible after parse-save.
- Sandbox documents persist every assignment field and both AIDA plans.
- Sandbox mode unlocks all intended builder tools without changing guided mode locks.
- The sandbox entry opens a new draft, reopens the latest matching draft, and returns safely to the lobby.
- PNG/JPEG/WebP upload validation, normalisation, placement, persistence, reload, delete, Undo, and Redo.
- Product and advertisement realisation requests are distinct, exact-field validated, and pinned to server profiles.
- Advertisement prompt construction includes only bounded plan fields and neutralises prompt-like student text as data.
- Advertisement output fills the canvas as a new layer and one Undo restores the prior editable design.
- Allowance reservation, duplicate prevention, uncertain-result reconciliation, account switching, and stale-pair cancellation remain green.

### Runtime and visual acceptance

- Open sandbox directly from the start screen.
- Complete the product definition and Product AIDA plan.
- Select page-5 Desire values and complete a separate Advertisement AIDA plan.
- Upload a representative photographed drawing, place it, crop it, layer text over it, delete it, Undo, and Redo.
- Generate one realistic advertisement with a designated test pair allowance; verify the exact original is recoverable and the output can be edited or deleted.
- Reload and confirm the assignment plan, upload, canvas state, and generated asset recover correctly.
- Verify keyboard navigation, large text, high contrast, item controls, and teacher playtest at both required desktop viewports.
- Verify guided campaign entry, mission progression, current product Make It Real, publication, and return-to-game behaviour are unchanged.

### Release acceptance

- Focused and full local suites pass on integrated inputs.
- GodotIQ impact, signal, parser, convention, and project checks pass for every changed Godot surface.
- Exact CI artifact passes draft-hosted QA.
- Fresh release-candidate review findings are resolved proportionately.
- Canonical branch is pushed, PR is merged, main CI artifact is deployed to production, production QA passes, and repository sync verification proves no commits remain outstanding.

## Explicit non-goals

- No mobile-phone support.
- No replacement of the guided Agency campaign.
- No automatic grading of student AIDA explanations.
- No autonomous AI generation without a teacher-controlled allowance and an explicit student action.
- No destructive replacement of a student's original drawing or canvas.
- No new Supabase schema unless implementation proves an existing persistence contract cannot represent the required data.
