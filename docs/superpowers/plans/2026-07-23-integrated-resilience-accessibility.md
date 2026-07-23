# Advertising Market Game Integrated Resilience and Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement every substantiated resilience, safety, accessibility, curved-label and release-integrity fix identified in the 23 July 2026 source review.

**Architecture:** Preserve local-first commits and add bounded, durable adapters around cloud and AI work. Keep provider output structural, route keyboard operations through the existing command/history path, render curved drinkware text deterministically from editable metadata, and bind static plus functions into one verifiable release manifest.

**Tech Stack:** TypeScript 7, Vitest 4, fake-indexeddb, Fabric.js 7.4, Vite 8, Node 22 scripts, Netlify Functions, service workers, Godot 4 web export.

## Global Constraints

- Native Godot execution remains quarantined.
- Do not mutate Supabase or production.
- A local commit must remain usable when cloud, AI, assets or updates fail.
- Studio Coach never authors advertising copy and counts two successful checks only.
- Service workers never cache `/api/*`, account assets or non-GET responses.
- Verify at 1280x800 and 1440x900 through the web-export/browser route.

---

### Task 1: Studio Coach budget and structural provider grammar

**Files:**
- Modify: `netlify/functions/lib/studio-coach-state.ts`
- Modify: `netlify/functions/lib/studio-coach-state.test.ts`
- Modify: `netlify/functions/studio-coach.mts`
- Modify: `netlify/functions/studio-coach.test.ts`
- Modify: `web/src/studio-coach/studio-coach-runtime.ts`
- Modify: `web/src/studio-coach/studio-coach-runtime.test.ts`

**Interfaces:**
- Provider turn one: `{turn, mode, action, targetId, certainty}`.
- Provider turn two: `{turn, mode:"revision", verdict, change, targetId, certainty}`.
- The handler maps those closed values to the existing trusted `StudioCoachResponse` client contract.

- [ ] Write failing state tests proving failed and expired reservations are removed from the counted order while completed attempts remain idempotent.
- [ ] Run `pnpm vitest run netlify/functions/lib/studio-coach-state.test.ts --no-cache --configLoader runner` and confirm the new assertions fail.
- [ ] Implement reservation refund/removal and rerun the focused test to green.
- [ ] Write failing handler tests for invented extra fields, invalid target IDs and every structural action-to-template mapping.
- [ ] Run `pnpm vitest run netlify/functions/studio-coach.test.ts --no-cache --configLoader runner` and confirm the old prose schema fails the tests.
- [ ] Replace the provider schema/parser with the closed grammar and trusted render templates; retain exact evidence-ID validation.
- [ ] Write and pass runtime tests proving definite failures refund the local count while ambiguous requests retain their key without double-counting.

### Task 2: Account asset and Image Lab deadlines plus durable idempotency

**Files:**
- Modify: `web/src/account/account-asset-client.ts`
- Modify: `web/src/account/account-asset-client.test.ts`
- Modify: `web/src/ai-image/image-lab-client.ts`
- Modify: `web/src/ai-image/image-lab-client.test.ts`
- Modify: `web/src/ai-image/image-lab-runtime.ts`
- Modify: `web/src/ai-image/image-lab-runtime.test.ts`
- Create: `web/src/ai-image/browser-image-lab-submission-persistence.ts`
- Create: `web/src/ai-image/browser-image-lab-submission-persistence.test.ts`
- Modify: `web/src/main.ts`

**Interfaces:**
- `AccountAssetClientErrorCode` gains `TIMEOUT`.
- `ImageLabClientErrorCode` gains `TIMEOUT`.
- `ImageLabSubmissionPersistence` becomes asynchronous and consumes a SHA-256 request fingerprint.

- [ ] Write fake-timer tests for stalls before headers and mid-body; verify RED for both clients.
- [ ] Add composed caller/deadline signals, typed timeout mapping and timer cleanup; verify focused tests GREEN.
- [ ] Write failing persistence tests proving identical requests reuse a key across runtime instances without storing the large data URL.
- [ ] Implement the browser persistence adapter and asynchronous fingerprint workflow; inject it from `main.ts`.
- [ ] Run all account-asset and Image Lab focused tests together.

### Task 3: Durable coalesced cloud sync and conflict resolution

**Files:**
- Create: `web/src/account/cloud-progress-outbox.ts`
- Create: `web/src/account/cloud-progress-outbox.test.ts`
- Modify: `web/src/account/cloud-progress-sync.ts`
- Modify: `web/src/account/cloud-progress-sync.test.ts`
- Modify: `web/src/account/cloud-progress-recovery.ts`
- Modify: `web/src/account/cloud-progress-recovery.test.ts`
- Modify: `web/src/account/account-gate.ts`
- Modify: `web/src/account/account-gate.test.ts`
- Modify: `web/src/account/account-bootstrap.ts`
- Modify: `web/src/main.ts`

**Interfaces:**
- Outbox: `activateAccount`, `deactivateAccount`, `put`, `get`, `list`, `removeIfRevision`.
- Sync: `retry(documentId)` and `resolveConflict(documentId, "keep-local" | "use-cloud")`.
- Conflict state carries pending local and loaded remote records plus retryability.

- [ ] Write failing outbox tests for account isolation, replacement by document ID and reload recovery.
- [ ] Implement the IndexedDB outbox and pass its focused tests.
- [ ] Write failing sync tests proving 100 enqueues retain the newest snapshot, obey the send interval, replay after activation and never permanently block after remote-load failure.
- [ ] Implement the scheduler and explicit conflict state machine; retain the existing account-client retry policy without adding a second HTTP retry loop.
- [ ] Write failing account UI tests for both conflict actions and focus-safe retry.
- [ ] Implement the status controls and asynchronous non-blocking recovery wiring in `main.ts`.

### Task 4: IndexedDB retention and quota recovery

**Files:**
- Modify: `web/src/persistence/draft-store.ts`
- Modify: `web/src/persistence/draft-store.test.ts`
- Modify: `web/src/persistence/account-scoped-draft-store.ts`

**Interfaces:**
- Retention defaults to five complete revisions per document.
- Save and practice commit retry once after aggressive pruning on `QuotaExceededError`.

- [ ] Write failing fake-indexeddb tests proving revision/blob/operation bounds after many commits.
- [ ] Write a failing injected quota test proving the prior revision survives and one retry occurs.
- [ ] Extract single-attempt write helpers, implement transactional pruning and add the bounded retry.
- [ ] Run all persistence tests and inspect the database records, not only returned values.

### Task 5: Keyboard-equivalent editor and focus preservation

**Files:**
- Modify: `web/src/fabric/canvas-port.ts`
- Modify: `web/src/fabric/fabric-canvas-adapter.ts`
- Modify: `web/src/fabric/fabric-canvas-adapter.test.ts`
- Modify: `web/src/fabric/object-command-service.ts`
- Create: `web/src/ui/canvas-accessibility-controller.ts`
- Create: `web/src/ui/canvas-accessibility-controller.test.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/catalogue/catalogue-panel.ts`
- Modify: `web/src/catalogue/catalogue-panel.test.ts`
- Modify: `web/src/main.ts`

**Interfaces:**
- Canvas port gains semantic object summaries and selection subscriptions.
- Accessibility controller owns keyboard mappings and DOM layer/inspector rendering.

- [ ] Write failing adapter tests for object summaries and pointer/keyboard selection notifications.
- [ ] Implement adapter support and pass tests.
- [ ] Write failing controller tests for select, nudge, coarse nudge, resize, reorder, hide, lock, delete and input-field suppression.
- [ ] Implement the controller using the existing command/history transaction path.
- [ ] Write and pass catalogue focus-restoration tests.
- [ ] Replace false AIDA tab semantics with `role="group"` plus `aria-pressed` and update tests.

### Task 6: Editable cylindrical drinkware labels

**Files:**
- Create: `web/src/product-kit/curved-label-renderer.ts`
- Create: `web/src/product-kit/curved-label-renderer.test.ts`
- Modify: `web/src/fabric/fabric-custom-properties.ts`
- Modify: `web/src/fabric/object-factory.ts`
- Modify: `web/src/fabric/object-factory.test.ts`
- Modify: `web/src/fabric/fabric-canvas-adapter.ts`
- Modify: `web/src/fabric/fabric-canvas-adapter.test.ts`

**Interfaces:**
- `renderCurvedLabel(input)` returns a bounded `HTMLCanvasElement` and profile metadata.
- Registered properties: `curvedTextSource`, `curvedTextProfile`, `curvedTextColour`, `curvedTextFontFamily`.

- [ ] Write failing pure-renderer tests for deterministic dimensions, edge compression, multiline wrapping and bounded text.
- [ ] Implement the cylindrical strip transform.
- [ ] Write failing adapter round-trip tests for drinkware curved text, subsequent editing, durable JSON reload and identical clean export dimensions.
- [ ] Permit only bounded PNG data URLs in portable raster serialization, register custom metadata and implement synchronous `FabricImage.setElement` regeneration.
- [ ] Confirm non-drinkware artwork text remains an ordinary editable `Textbox`.

### Task 7: Service worker and bound release artifact

**Files:**
- Modify: `scripts/build-netlify-functions.mjs`
- Modify: `scripts/build-web.mjs`
- Modify: `scripts/build-web.test.mjs`
- Modify: `scripts/verify-web-export.mjs`
- Modify: `scripts/deploy-netlify-artifact.mjs`
- Modify: `scripts/deploy-netlify-artifact.test.mjs`
- Modify: `web/src/main.ts`

**Interfaces:**
- Function build emits `function-manifest.json` with wrapper and bundle hashes.
- Web assembly emits `manifest.webmanifest`, `asset-manifest.json`, `service-worker.js` and `release-manifest.json`.
- Deploy accepts the verified static artifact and copies its exactly bound functions into the isolated context without rebuilding.

- [ ] Write failing build tests for manifest generation, privacy bypasses, atomic cache versioning and service-worker registration.
- [ ] Generate the web manifest, asset manifest and service worker; extend `_headers` with correct no-cache/update policy.
- [ ] Write failing deploy tests for mutated static, function, wrapper, missing and unexpected files.
- [ ] Implement release-manifest verification and isolated function copying; remove the deploy-time rebuild.
- [ ] Extend `verify-web-export` to reject missing or mismatched service-worker and release files.

### Task 8: Integrated verification

**Files:**
- Modify only files required by observed failures.
- Store temporary browser screenshots outside committed source.

- [ ] Run focused tests for every changed subsystem.
- [ ] Run `pnpm run typecheck`.
- [ ] Run `pnpm run test:build-web`.
- [ ] Run `pnpm test -- --maxWorkers=1` using the repository-supported argument form.
- [ ] Run the fresh web build. Before any build step that replaces generated directories, tell Peter the exact affected paths as required by the deletion-notification rule.
- [ ] Run `node scripts/verify-web-export.mjs build/web`.
- [ ] Inspect the verified web export in a real browser at 1280x800 and 1440x900. Exercise account entry, local save, editor keyboard controls, catalogue focus, curved drinkware text, reload and service-worker update state.
- [ ] Report hosted-only Safari/shared-NAT/password-gate gaps separately; do not infer them from Vite or Python surfaces.
