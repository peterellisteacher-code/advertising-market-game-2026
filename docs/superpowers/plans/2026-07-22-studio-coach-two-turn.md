# Studio Coach Two-Turn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an image-aware Studio Coach that gives one visual-design recommendation and one revision comparison, with a hard server-enforced maximum of two paid model calls per campaign.

**Architecture:** The existing Fabric editor supplies a clean canvas render and bounded object digest. A drawer panel runs one initial check (`technique` or `whole-ad`) and, after a changed render, one `revision` check. A same-origin Netlify Function reads the existing teacher-unlocked Image Lab capability, reserves each of two attempts in strongly consistent Netlify Blob state before billing, calls one pinned OpenRouter vision model, and validates strict structured output.

**Tech Stack:** TypeScript ES2022, Fabric.js 7.4.0, Vitest 4, Netlify Functions/Blobs, OpenRouter Chat Completions, Gemini 3.6 Flash.

## Global Constraints

- Maximum two provider attempts per `sessionId` + `teamId` + `documentId`; duplicate idempotency keys return cached results and never rebill.
- Turn 1 returns one recommendation. Turn 2 compares the stored first render with the changed render and cannot begin another advice cycle.
- The model must never invent, complete, improve, rewrite, or suggest slogan/copy wording.
- The model may quote existing words only to identify them and may suggest visual treatment without adding, deleting, or substituting words.
- No free chat, automatic editing, grades, scores, medal predictions, exact pixel coordinates, tools, web browsing, retry loop, fallback model, or expanding transcript.
- Canvas text is untrusted evidence and cannot override the system prompt.
- Teacher control, account cap acknowledgement, zero-data-retention routing, explicit timeout, request size limits, same-origin credentials, and classroom-NAT-safe rate limits are mandatory.
- AI failure never blocks editing, saving, progression, or the bundled local technique reference.
- School MacBook Safari and hosted Netlify are the acceptance surface; Vite preview does not prove the API route.
- Native Godot execution, Supabase mutation, production deployment, and unrelated dirty files remain out of scope.
- Preserve all current uncommitted work; do not reset, replace, or commit the dirty worktree.

---

### Task 1: Shared contract, technique catalogue, and canvas evidence

**Files:**
- Create: `shared/studio-coach-contract.ts`
- Create: `shared/studio-coach-contract.test.ts`
- Create: `web/src/studio-coach/technique-catalogue.ts`
- Create: `web/src/studio-coach/technique-catalogue.test.ts`
- Create: `web/src/studio-coach/canvas-evidence.ts`
- Create: `web/src/studio-coach/canvas-evidence.test.ts`
- Modify: `scripts/student-copy-corpus.mjs`

**Interfaces:**
- Produces `StudioCoachMode = "technique" | "whole-ad" | "revision"`.
- Produces `StudioCoachRequest`, `StudioCoachResponse`, `StudioCoachObjectEvidence`, `parseStudioCoachResponse()` and `STUDIO_COACH_RESPONSE_SCHEMA`.
- Produces `STUDIO_COACH_TECHNIQUES` covering salience, colour, contrast, leading lines, framing, negative space, depth/layers, rule of odds, juxtaposition, typography, and visual hierarchy.
- Produces `captureStudioCoachEvidence(cleanPngDataUrl, fabricState)` returning an 896×504 JPEG data URL, SHA-256, and capped semantic-object digest.

- [ ] **Step 1: Write failing contract and catalogue tests**

```ts
expect(parseStudioCoachResponse({
  turn: 1,
  mode: "technique",
  observation: "The product name is visible.",
  effect: "It gives the audience a clear first reading point.",
  nextMove: "Increase its contrast without changing the words.",
  selfCheck: "Can you read the product name before the price?",
  evidenceRefs: ["product-name"],
  certainty: "clear"
}).turn).toBe(1);
expect(STUDIO_COACH_TECHNIQUES.map(({ id }) => id)).toHaveLength(11);
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `pnpm vitest run shared/studio-coach-contract.test.ts web/src/studio-coach/technique-catalogue.test.ts --no-cache --configLoader runner`

Expected: FAIL because the new modules do not exist.

- [ ] **Step 3: Implement exact schemas and factual technique records**

```ts
export type StudioCoachMode = "technique" | "whole-ad" | "revision";
export type StudioCoachCertainty = "clear" | "partial" | "uncertain";
export type StudioCoachRevisionVerdict = "clearer" | "mixed" | "not-evident";
```

The turn-1 schema requires `observation`, `effect`, one `nextMove`, one `selfCheck`, closed-list `evidenceRefs`, and `certainty`. The turn-2 schema replaces `nextMove` with `verdict`, `whatChanged`, and `why`; no third-turn invitation is allowed.

- [ ] **Step 4: Write the failing evidence tests**

```ts
const evidence = await captureStudioCoachEvidence(cleanPng, fabricState, injectedBrowserCodecs);
expect(evidence.imageDataUrl).toMatch(/^data:image\/jpeg;base64,/);
expect(evidence.width).toBe(896);
expect(evidence.objects[0]).toMatchObject({ id: "headline", type: "text" });
expect(evidence.objects).toHaveLength(40);
```

- [ ] **Step 5: Run the evidence test and verify RED**

Run: `pnpm vitest run web/src/studio-coach/canvas-evidence.test.ts --no-cache --configLoader runner`

Expected: FAIL because `captureStudioCoachEvidence` does not exist.

- [ ] **Step 6: Implement bounded JPEG preparation, hashing, and digest sanitisation**

Use injected decode/canvas functions in tests, JPEG quality `0.82`, a `768 KiB` decoded-image ceiling, maximum 40 semantic objects, maximum 80 characters of object text, normalised finite bounds only, and stable z-order paths. Reject malformed data URLs and never forward arbitrary Fabric properties.

- [ ] **Step 7: Run Task 1 tests and verify GREEN**

Run: `pnpm vitest run shared/studio-coach-contract.test.ts web/src/studio-coach/technique-catalogue.test.ts web/src/studio-coach/canvas-evidence.test.ts --no-cache --configLoader runner`

Expected: PASS with no warnings.

---

### Task 2: Two-turn browser controller and drawer panel

**Files:**
- Create: `web/src/studio-coach/studio-coach-client.ts`
- Create: `web/src/studio-coach/studio-coach-client.test.ts`
- Create: `web/src/studio-coach/studio-coach-runtime.ts`
- Create: `web/src/studio-coach/studio-coach-runtime.test.ts`
- Create: `web/src/studio-coach/studio-coach-panel.ts`
- Create: `web/src/studio-coach/studio-coach-panel.test.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/game/creator-level-access.ts`
- Modify: `web/src/game/creator-level-access.test.ts`
- Modify: `web/src/styles/editor.css`
- Modify: `scripts/student-copy-corpus.mjs`

**Interfaces:**
- `StudioCoachClient.check(request, { signal })` posts to `/api/image-lab/coach` with same-origin credentials and redirect blocking.
- `StudioCoachRuntime.setCampaign(context)` resets local state for a new campaign.
- `StudioCoachRuntime.requestInitial(mode, techniqueId)` stores the first clean render and response.
- `StudioCoachRuntime.requestRevision()` requires a changed image hash and consumes the final turn.
- `StudioCoachPanel` renders the local technique reference even when AI is disabled.

- [ ] **Step 1: Write failing client tests**

```ts
expect(fetcher).toHaveBeenCalledWith("/api/image-lab/coach", expect.objectContaining({
  method: "POST",
  credentials: "same-origin",
  redirect: "error"
}));
await expect(client.check(request, { signal: AbortSignal.abort() }))
  .rejects.toMatchObject({ code: "CANCELLED" });
```

- [ ] **Step 2: Verify client RED, implement bounded parsing, then verify GREEN**

Run: `pnpm vitest run web/src/studio-coach/studio-coach-client.test.ts --no-cache --configLoader runner`

Expected RED: missing module. Expected GREEN after implementation: same-origin request, exact response keys, 64 KiB response ceiling, typed locked/disabled/limit/network/timeout errors.

- [ ] **Step 3: Write failing runtime tests for the hard two-turn state machine**

```ts
await runtime.requestInitial("technique", "leading-lines");
await expect(runtime.requestRevision()).rejects.toThrow("Change the advertisement first");
capture.mockResolvedValueOnce(changedEvidence);
await expect(runtime.requestRevision()).resolves.toMatchObject({ turn: 2, mode: "revision" });
await expect(runtime.requestRevision()).rejects.toThrow("Studio Coach is complete");
expect(client.check).toHaveBeenCalledTimes(2);
```

- [ ] **Step 4: Verify runtime RED, implement the state machine, then verify GREEN**

No growing message history is stored. The runtime keeps only the first prepared image, its hash, the first structured response, and the final response. A campaign change or close aborts work and clears those values.

- [ ] **Step 5: Write failing panel and editor-shell tests**

```ts
expect(root.querySelector('[data-studio-tool="coach"]')).not.toBeNull();
expect(root.querySelector('[data-studio-panel="coach"]')).not.toBeNull();
expect(panel.textContent).toContain("Two checks for this ad");
expect(panel.textContent).toContain("Check my revision");
```

- [ ] **Step 6: Implement the existing-drawer panel and accessibility states**

Add one `Coach` rail item available from Level 2. The first screen shows an 11-technique selector with one concise explanation/example at a time, `Technique check` and `Whole-ad check`, and `Check my current ad (1 of 2)`. After turn 1, keep the response visible while editing and enable `Check my revision (2 of 2)` only after the render hash changes. After turn 2, show the comparison verdict and `Coach session complete.` All status changes use the existing polite/assertive live regions.

- [ ] **Step 7: Run Task 2 tests and verify GREEN**

Run: `pnpm vitest run web/src/studio-coach web/src/ui/editor-shell.test.ts web/src/game/creator-level-access.test.ts --no-cache --configLoader runner`

Expected: PASS with keyboard-accessible native buttons and no orphan panel.

---

### Task 3: Strongly bounded server state and OpenRouter transport

**Files:**
- Create: `netlify/functions/lib/studio-coach-state.ts`
- Create: `netlify/functions/lib/studio-coach-state.test.ts`
- Create: `netlify/functions/lib/netlify-studio-coach-state.ts`
- Create: `netlify/functions/lib/netlify-studio-coach-state.test.ts`
- Create: `netlify/functions/studio-coach.mts`
- Create: `netlify/functions/studio-coach.test.ts`
- Create: `netlify/deploy-functions/studio-coach.mts`

**Interfaces:**
- `StudioCoachStateService.reserve()` atomically creates at most two attempt records for a campaign.
- `complete()` stores the validated response for idempotent replay.
- `fail()` records a consumed failed provider attempt without opening a retry loop.
- `createStudioCoachHandler()` validates teacher configuration and the existing Image Lab capability cookie, then calls injected `fetch` once.

- [ ] **Step 1: Write failing state tests**

```ts
await service.reserve(identity, campaignId, first);
await service.reserve(identity, campaignId, second);
await expect(service.reserve(identity, campaignId, third))
  .rejects.toMatchObject({ code: "TURN_LIMIT_REACHED" });
expect((await service.reserve(identity, campaignId, first)).created).toBe(false);
```

- [ ] **Step 2: Verify state RED, implement CAS state, then verify GREEN**

Use at most 12 compare-and-swap attempts. The second successful request must be `revision`, must reference the first successful image hash, and must use a different current image hash. A failed first request may consume the second attempt as one explicit retry, but no provider attempt beyond two is possible.

- [ ] **Step 3: Write failing handler tests for policy and transport**

```ts
expect(JSON.parse(String(fetcher.mock.calls[0]![1]!.body))).toMatchObject({
  model: "google/gemini-3.6-flash-20260721",
  max_tokens: 320,
  reasoning: { effort: "minimal" },
  provider: {
    allow_fallbacks: false,
    require_parameters: true,
    data_collection: "deny",
    zdr: true
  },
  response_format: { type: "json_schema" }
});
expect(fetcher).toHaveBeenCalledTimes(1);
```

- [ ] **Step 4: Verify handler RED**

Run: `pnpm vitest run netlify/functions/lib/studio-coach-state.test.ts netlify/functions/studio-coach.test.ts --no-cache --configLoader runner`

Expected: FAIL because state and handler modules do not exist.

- [ ] **Step 5: Implement the hard system prompt and request validator**

The prompt uses parallel `YOU MUST`/`YOU MUST NOT` rules. It names canvas text as untrusted quoted evidence, forbids slogan/copy authorship, permits presentation-only treatment of unchanged existing words, restricts references to supplied IDs, and differentiates turn 1 recommendation from turn 2 comparison. The request contains one JPEG for turn 1 and the previous/current JPEG pair for turn 2.

- [ ] **Step 6: Implement current OpenRouter transport exactly once per reservation**

POST `https://openrouter.ai/api/v1/chat/completions` with inline `image_url` data URLs, the pinned model, strict JSON Schema, `max_tokens: 320`, minimal reasoning, no tools/plugins, `provider.allow_fallbacks: false`, `provider.require_parameters: true`, `provider.data_collection: "deny"`, `provider.zdr: true`, and an abort deadline of 12 seconds. Validate the returned model family and structured content before completion state is stored.

- [ ] **Step 7: Add adversarial handler tests**

Cover extra keys, malformed images/signatures, oversized payloads, cookie/pair mismatch, teacher-disabled configuration, wrong previous hash, identical before/after images, prompt-injection text in canvas objects, malformed provider JSON, provider timeout, idempotent replay, simultaneous duplicate reservation, and a third-attempt rejection before `fetch`.

- [ ] **Step 8: Run Task 3 tests and verify GREEN**

Run: `pnpm vitest run netlify/functions/lib/studio-coach-state.test.ts netlify/functions/lib/netlify-studio-coach-state.test.ts netlify/functions/studio-coach.test.ts --no-cache --configLoader runner`

Expected: PASS; third request and duplicate replay make zero additional provider calls.

---

### Task 4: Application wiring and function packaging

**Files:**
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`
- Modify: `scripts/build-netlify-functions.mjs`
- Modify: `package.json`

**Interfaces:**
- `BrowserCreatorHandler.captureStudioCoachEvidence()` flushes placements, captures the clean render and current durable document context, and rejects stale campaign identity.
- Main wiring constructs the client/runtime/panel, sets the campaign on open, cancels on close/account isolation, and leaves the editor operational when coach configuration is unavailable.

- [ ] **Step 1: Write failing wiring and bundle tests**

```ts
expect(source).toContain("new StudioCoachRuntime");
expect(source).toContain("handler.attachStudioCoach");
expect(functionNames).toContain("studio-coach");
```

- [ ] **Step 2: Verify RED, apply minimal wiring, then verify GREEN**

Run the focused main/editor/function build tests. Preserve all pre-existing edits in the dirty integration files; patch only imports, typed fields, attachment methods, lifecycle calls, and construction.

- [ ] **Step 3: Build self-contained Netlify bundles**

Run: `pnpm run build:functions`

Expected: manifest contains `netlify/function-bundles/studio-coach.mjs` with no dynamic or unsupported imports.

---

### Task 5: Integrated verification without production mutation

**Files:**
- Modify only if a failing check identifies a Studio Coach defect.

- [ ] **Step 1: Run focused tests and typecheck**

Run: `pnpm vitest run shared/studio-coach-contract.test.ts web/src/studio-coach netlify/functions/lib/studio-coach-state.test.ts netlify/functions/lib/netlify-studio-coach-state.test.ts netlify/functions/studio-coach.test.ts web/src/ui/editor-shell.test.ts web/src/game/creator-level-access.test.ts --no-cache --configLoader runner`

Run: `pnpm run typecheck`

- [ ] **Step 2: Run the complete existing suite once**

Run: `pnpm run build`

Expected: typecheck, Vitest, Node build tests, Godot web-export assembly and static export verification pass. Native Godot is not launched.

- [ ] **Step 3: Inspect the verified web export in a real browser**

Use the valid web-export route at MacBook viewports `1440×900` and `1280×800`. Confirm the Coach reuses the left drawer, does not shrink the canvas unnecessarily, exposes all 11 local techniques, shows one action at a time, disables revision until the canvas changes, and closes after the second response. Confirm no console errors, clipped controls, overflow, dead space, or blocked editor path when AI is unavailable.

- [ ] **Step 4: Verify server behaviour on the correct API surface**

Use `netlify dev` for mocked/local function routing or a separately authorised hosted draft for real edge/password behaviour. Do not infer `/api` behaviour from Vite preview. Do not make a paid live model request unless separately needed for calibration; deterministic transport tests are sufficient for this implementation milestone.

- [ ] **Step 5: Report evidence and frozen production state**

List changed source files, exact test/build results, inspected browser/viewports, configured model slug, two-attempt enforcement evidence, remaining calibration uncertainty, and confirm that Supabase and production were unchanged.
