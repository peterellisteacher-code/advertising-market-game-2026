# Advertising Market Game Integrated Resilience and Accessibility Design

## Status

Approved by Peter Ellis through the instruction to implement all substantiated fixes after the 23 July 2026 independent review and primary source verification.

## Goal

Make the existing pair-play game resilient on a school MacBook and school wifi without changing its fun-first advertising-market identity, its factual rules, its two-turn Studio Coach limit, or its local-first save guarantee.

## Non-negotiable constraints

- Godot 4 remains the game engine. Native Godot execution is quarantined; verification uses the existing web-export route.
- A successful local commit is the continuity boundary. Cloud, AI, asset transfer and updates may lag or fail, but must not invalidate that commit.
- Supabase data and schema remain unchanged.
- Production remains unchanged until Peter separately authorises deployment.
- Studio Coach must never create, rewrite, suggest or delete slogans, headlines, prices, claims, product names, calls to action or other advertising wording.
- Studio Coach provides at most two successful student-visible checks: one visual action, then one comparison of the revision.
- API responses and account assets must never enter service-worker storage.
- Existing product facts, pricing, AIDA meanings, safety controls, game rules and assessment content remain unchanged.
- Safari on a recent school-managed MacBook at 1280x800 and 1440x900 is the release target.

## Architecture

### Local and cloud progress

Local IndexedDB commits remain authoritative for continuity. Cloud sync gains a durable, account-scoped, latest-only outbox. A new revision replaces the unsent revision for the same document. The scheduler sends immediately when idle, then enforces a 20-second minimum interval between requests per client. It resumes on account activation, new local commits and the browser `online` event.

A cloud conflict becomes an explicit state containing the pending local document and the loaded remote document. The account status surface offers `Keep this device` and `Use cloud copy`. Either choice preserves the losing document locally before completing the resolution. A remote-load failure is retryable and does not permanently block future sync.

Account activation opens account-scoped local storage and unlocks the game. Cloud recovery then runs asynchronously. Importing a remote-only save remains transactional and refuses to replace a local run created while recovery was in flight.

### Bounded persistence

Each document retains the newest five complete revisions. The active checkpoint, a conflict copy and any revision referenced by the cloud outbox are pinned. Practice-operation records associated with removed revisions are removed in the same pruning operation. A quota failure triggers aggressive pruning to the newest committed revision and exactly one retry; a second failure returns an explicit storage-full error without damaging the prior commit.

### Network deadlines

Account assets and Image Lab requests receive application-owned deadlines composed with caller cancellation. Timeout is a distinct typed result. Account asset transfers use a 12-second header deadline and a 60-second total transfer deadline. Image Lab JSON calls use 15 seconds; asset download uses 60 seconds; polling remains bounded by its existing attempt limit.

### Studio Coach

Failed or expired reservations are removed from the counted attempt order. Only completed checks consume the two-check budget; active reservations still prevent concurrent oversubscription.

The provider no longer returns student-facing prose. Turn one returns an enumerated visual action, one supplied target ID and certainty. Turn two returns an enumerated comparison verdict/change code, one supplied target ID and certainty. The Netlify function validates every value and renders all student-visible sentences from application-owned templates. Unknown codes, target IDs or fields fail closed and the failed reservation is refunded.

### Image Lab idempotency

The submission fingerprint is SHA-256 over the canonical request input. A browser persistence adapter stores only `fingerprint -> idempotency key`, namespaced by the pair identity. It is written before submission and removed only after terminal success or definite failure. Timeout or lost response keeps the mapping, so reload and resubmission reuse the server-side idempotency key.

### Keyboard and focus

The canvas region is keyboard focusable. A DOM layer list exposes every top-level semantic object and provides select, nudge, resize, reorder, hide/restore, lock/unlock and delete operations. Commands route through the existing command/history path, so undo, autosave and cloud sync remain consistent. Pointer selection and keyboard selection update the same DOM surface.

Catalogue virtualization restores focus by asset ID after repaint when the item remains mounted. The AIDA checklist becomes a labelled button group using `aria-pressed`, because it does not control tab panels.

### Curved product copy

Drinkware artwork text is represented by a Fabric image generated from editable source metadata. The renderer first lays out the exact source text, then applies a deterministic cylindrical strip projection. The image stores the source text, profile ID, colour and font metadata as registered Fabric custom properties. Editing regenerates the bitmap synchronously. Serialization includes safe bounded PNG data plus the editable source metadata; load and PNG export reproduce the same visible result. Unsupported product families continue using ordinary editable flat text and make no wrapping claim.

### Offline installation and release binding

The web assembler emits a web manifest, a hashed static-asset manifest and an application-owned service worker. It precaches only the app shell and core runtime. Other same-origin immutable static assets are cached on first successful use. Navigations are network-first with the cached shell as fallback. `/api/`, account assets, non-GET requests and credential-bearing responses are network-only.

Function bundle and wrapper hashes are written during the function build. The assembled static artifact contains a release manifest binding the source commit, all static hashes and every deployed function hash. Deployment no longer rebuilds functions. It verifies the release manifest, copies the verified function files into the isolated deployment context and fails before network activity on any mismatch, missing file or unexpected file.

## Error handling

- Local saves never report cloud failure as local failure.
- Transient cloud errors retain one latest durable pending snapshot.
- Conflict resolution is explicit and repeatable; neither choice silently discards the rejected version.
- Timeout, authentication, integrity, quota and conflict states remain distinguishable.
- AI failures do not consume the two successful checks or create a second paid Image Lab job.
- A failed service-worker installation leaves the currently active cache untouched.

## Verification

Every behaviour change is test-first. Focused Vitest or Node tests run after each tranche. The final candidate receives TypeScript checking, the full Vitest suite, scripted web-build contracts, a fresh web assembly and export verifier, then browser checks at 1280x800 and 1440x900. Hosted-only password-gate, edge-rate and Safari claims remain explicitly unverified unless a hosted draft and a school MacBook are available; production is not used as a test surface.
