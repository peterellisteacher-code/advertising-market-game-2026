# Guided Student Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Year 10 pairs one linked, state-driven route through the whole Advertising Market Game, while keeping a permanent Now / Why / Done / Next reference and retaining access to completed work.

**Architecture:** The web studio will derive its current instruction from the existing campaign document rather than storing dismissible tutorial state. Godot will continue to own level progression, add the final-review gate and full instruction reference, and the medal gallery will add local five-criterion scorecards before medal choices. All copy will be drafted as one linked inductive argument, then the complete student corpus will pass unchanged through the objective Plain Language and Claude Scrubber workflows.

**Tech Stack:** Godot 4.6/GDScript, TypeScript 7, Fabric.js 7.4, Zod 4.4, Vitest 4/JSDOM, Node test runner, Vite 8, Netlify draft deployment.

## Global Constraints

- Acceptance viewports are exactly 1280×800 and 1440×900 on the current hosted browser surface.
- Safari on recent school MacBooks and unreliable school wifi remain the target environment.
- Use simple, academic and professional English. Do not use slang, casual language, gamified metaphors or AI-associated filler.
- The main route is a guided wizard. Now / Why / Done / Next remains available throughout as a refresh.
- Every instruction must support a later instruction or conclusion; no premise may be a loose end.
- Preserve completed work and allow students to revisit completed tools; do not require dismissing tutorial screens.
- Preserve production, Supabase, real accounts, paid AI endpoints and Netlify visitor-access controls.
- Never launch a Windows Godot executable or Godot MCP runtime.
- Use focused TDD for each behavioural change, then run the full applicable suite and build once after integration.
- Reuse prior copy-panel and browser evidence while its inputs remain unchanged; do not rerun paid panels.
- Do not delete, move or clean up any file without Peter's explicit deletion approval and notification.

---

## Instruction Argument

The visible instructions will express this linked inductive structure:

### Subargument 1: audience to product

1. The audience brief supplies evidence about a need and values.
2. A suitable product responds to that need and those values.
3. **Intermediate conclusion 1:** A product built from the audience evidence is likely to suit that audience.

### Subargument 2: product to advertisement

4. A named, visible product gives the advertisement a clear subject.
5. Attention, Interest, Desire and Action each require a visible canvas choice and an explanation.
6. **Intermediate conclusion 2:** Linking all four AIDA stages to visible evidence is likely to produce a coherent advertisement for the product from intermediate conclusion 1.

### Subargument 3: advertisement to credible offer

7. An audience-based price states the offer's value.
8. A route names where the audience will encounter the advertisement.
9. A proof point explains why the product claim is credible in that route.
10. **Intermediate conclusion 3:** A visible price, suitable route and proof point are likely to make the advertisement from intermediate conclusion 2 credible.

### Subargument 4: credible offer to final judgement

11. A five-part final review checks audience fit, product value and price, AIDA, visual technique and claim credibility.
12. The same five criteria can score every other advertisement from 0 to 2, producing comparable totals out of 10.
13. Ranking those totals, with audience fit and then AIDA as tie-breakers, supports Gold, Silver and Bronze judgements.
14. **Overall inductive conclusion:** A pair that completes each linked step is likely to produce and judge a clear, audience-focused and credible advertising campaign.

---

### Task 1: State-driven web-studio guide

**Files:**
- Create: `web/src/game/guided-journey.ts`
- Create: `web/src/game/guided-journey.test.ts`
- Create: `web/src/game/guided-journey-controller.ts`
- Create: `web/src/game/guided-journey-controller.test.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/styles/editor.css`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`

**Interfaces:**
- Consumes: `CampaignDocumentV1`, `hasPlacedProduct(document)`, campaign stage, pair action counts and evidence arrays.
- Produces:
  - `type GuidedJourneyStepId = "audience" | "product" | "product-name" | "pair-contribution" | "attention" | "interest" | "desire" | "action" | "price-position" | "price-evidence" | "market-route"`
  - `interface GuidedJourneyStep { id; stage; title; now; why; done; next; tool; aidaStage?; complete }`
  - `evaluateGuidedJourney(document: CampaignDocumentV1): GuidedJourneyState`
  - `class GuidedJourneyController { setCampaign(document: CampaignDocumentV1 | null): void; destroy(): void }`

- [ ] **Step 1: Write the failing pure-state tests**

Add literal fixtures showing that the first incomplete step advances in this exact order:

```ts
expect(evaluateGuidedJourney(inventBlank).current.id).toBe("product");
expect(evaluateGuidedJourney(withPlacedProduct).current.id).toBe("product-name");
expect(evaluateGuidedJourney(withNamedProduct).current.id).toBe("pair-contribution");
expect(evaluateGuidedJourney(sellWithAttention).current.id).toBe("interest");
expect(evaluateGuidedJourney(irresistibleWithPricePosition).current.id).toBe("price-evidence");
expect(evaluateGuidedJourney(irresistibleWithVisiblePrice).current.id).toBe("market-route");
```

Also assert that each step's `why` names a later output and every nonterminal `next` names the following step.

- [ ] **Step 2: Run the model test and verify RED**

Run:

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/game/guided-journey.test.ts
```

Expected: FAIL because `guided-journey.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure evaluator**

Define one immutable ordered step list. Derive completion only from persisted campaign state:

```ts
const hasAida = (document: CampaignDocumentV1, stage: AidaStage): boolean =>
  document.strategy.aidaPlan[stage].trim().length > 0 &&
  document.evidence[stage].some((id) => id.trim().length > 0);
```

The audience step may already be complete because the pair controller selects a valid brief on open. Completed steps remain in `state.steps`; only the first incomplete step becomes `state.current`.

- [ ] **Step 4: Run the model test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Write the failing controller and shell tests**

Assert observable UI:

```ts
expect(getByText(root, "Now")).toBeVisible();
expect(getByText(root, "Why")).toBeVisible();
expect(getByText(root, "Done")).toBeVisible();
expect(getByText(root, "Next")).toBeVisible();
fireEvent.click(getByRole(root, "button", { name: "Review all instructions" }));
expect(getByRole(root, "dialog", { name: "Advertising campaign instructions" })).toBeVisible();
```

Assert that the action button opens the current tool, that Interest/Desire/Action checklist buttons are disabled until prior AIDA evidence exists, and that Route is unavailable until visible price evidence exists.

- [ ] **Step 6: Run the controller tests and verify RED**

Run:

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/game/guided-journey-controller.test.ts web/src/ui/editor-shell.test.ts web/src/main.test.ts
```

Expected: FAIL on missing guide controls and controller.

- [ ] **Step 7: Implement the persistent guide and instruction dialog**

Add a compact guide above the active tool panel with:

```html
<section class="creator__guide" aria-label="Current instruction">
  <p data-guide-progress></p>
  <h2 data-guide-title></h2>
  <dl>
    <div><dt>Now</dt><dd data-guide-now></dd></div>
    <div><dt>Why</dt><dd data-guide-why></dd></div>
    <div><dt>Done</dt><dd data-guide-done></dd></div>
    <div><dt>Next</dt><dd data-guide-next></dd></div>
  </dl>
  <div class="creator__guide-actions">
    <button data-guide-open-tool></button>
    <button data-guide-review>Review all instructions</button>
  </div>
</section>
```

Render the full linked argument in a keyboard-focusable modal. Close it with its Close button and Escape. Keep the guide visible when tool content scrolls. When the drawer is collapsed, keep `Review instructions` available in the top bar.

- [ ] **Step 8: Wire campaign refreshes without tutorial-only state**

Attach the controller to `BrowserCreatorHandler`. Refresh from `schedulePracticeAutosave()`, successful open, history restore and close. The controller's action callback calls `handler.selectAidaStage(stage)` before `studioTools.select("aida")` for AIDA steps.

- [ ] **Step 9: Run focused tests and verify GREEN**

Run the command from Step 6. Expected: PASS.

- [ ] **Step 10: Commit**

```powershell
git add web/src/game/guided-journey.ts web/src/game/guided-journey.test.ts web/src/game/guided-journey-controller.ts web/src/game/guided-journey-controller.test.ts web/src/ui/editor-shell.ts web/src/ui/editor-shell.test.ts web/src/styles/editor.css web/src/main.ts web/src/main.test.ts
git commit -m "feat(guidance): add linked studio journey"
```

### Task 2: Route proof point and publication readiness

**Files:**
- Modify: `web/src/game/market-route.ts`
- Modify: `web/src/game/market-route.test.ts`
- Modify: `web/src/game/market-route-panel.ts`
- Modify: `web/src/game/market-route-panel.test.ts`
- Modify: `web/src/domain/campaign-document.ts`
- Modify: `web/src/domain/campaign-document.test.ts`
- Modify: `web/src/game/creator-stage.ts`
- Modify: `web/src/game/creator-stage.test.ts`
- Modify: `web/src/game/student-copy.ts`
- Modify: `web/src/main.ts`
- Modify: `godot/src/main/Main.gd`
- Modify: `godot/tests/test_game_shell.gd`

**Interfaces:**
- `MarketRouteInput.proofPoint?: string`
- `MarketRouteDraft.proofPoint: string`
- `CommittedMarketRoute.proofPoint: string`
- `MarketRouteCommitInput.proofPoint: string`
- Stored `strategy.marketRoute.proofPoint` defaults to `""` when an older campaign is parsed.

- [ ] **Step 1: Write failing proof-point tests**

Cover these breaks:

```ts
expect(() => commitMarketRoute(createMarketRoute({
  audienceBriefId: "after-school",
  zoneId: "city",
  mediaIds: ["transit"],
  proofPoint: " "
}))).toThrow("proof point");

expect(parseCampaignDocument(legacyCampaign).strategy.marketRoute?.proofPoint).toBe("");
expect(evaluatePublicationReadiness(session, progress, routeWithoutProof).missing)
  .toContain("market-route");
```

In the panel test, fill the proof-point textarea and assert the real commit payload contains the trimmed statement.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/game/market-route.test.ts web/src/game/market-route-panel.test.ts web/src/domain/campaign-document.test.ts web/src/game/creator-stage.test.ts
```

Expected: FAIL because proof-point state is absent.

- [ ] **Step 3: Implement proof-point persistence and the point-of-use input**

Add a labelled textarea after media selection:

```html
<label class="market-route__proof">
  <span>Proof point</span>
  <textarea maxlength="240"></textarea>
  <small>State one fact, feature or demonstration that supports the claim.</small>
</label>
```

Require nonblank proof before submission. Include it in reconstruction in `#refreshMarketRoute`. Add `market-route` to publication missing codes and require a committed route with nonblank proof in Level 3 readiness.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add web/src/game/market-route.ts web/src/game/market-route.test.ts web/src/game/market-route-panel.ts web/src/game/market-route-panel.test.ts web/src/domain/campaign-document.ts web/src/domain/campaign-document.test.ts web/src/game/creator-stage.ts web/src/game/creator-stage.test.ts web/src/game/student-copy.ts web/src/main.ts godot/src/main/Main.gd godot/tests/test_game_shell.gd
git commit -m "feat(route): require a credible proof point"
```

### Task 3: One-small-action option presentation and accurate canvas feedback

**Files:**
- Modify: `web/src/game/aida-playbook-panel.ts`
- Modify: `web/src/game/aida-playbook-panel.test.ts`
- Modify: `web/src/game/market-route-panel.ts`
- Modify: `web/src/game/market-route-panel.test.ts`
- Modify: `web/src/product-builder/product-money-panel.ts`
- Modify: `web/src/product-builder/product-money-panel.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`
- Modify: `web/src/styles/editor.css`

**Interfaces:**
- AIDA presents five starter techniques, followed by an explicit `Show five more techniques` button.
- Route trait and medium banks present five initial choices and preserve checked choices when expanded.
- Canvas selection status is updated from the real `subscribeSelection` event.

- [ ] **Step 1: Write failing behaviour tests**

Assert five initial AIDA move buttons, ten after expansion, and no loss of textarea content. Assert a selected product changes the canvas toolbar status from the waiting instruction to the selected layer's accessible name. Assert price-position labels expose spaces between the heading and explanation.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/game/aida-playbook-panel.test.ts web/src/game/market-route-panel.test.ts web/src/product-builder/product-money-panel.test.ts web/src/main.test.ts
```

- [ ] **Step 3: Implement bounded option disclosure and status refresh**

Use a local expanded flag per draw, an ordinary button, and the existing candidate arrays; do not remove choices. Register one selection subscription when the canvas runtime opens and dispose it when the creator closes. Render `Selected: <accessible name>` or `Select a product or image`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add web/src/game/aida-playbook-panel.ts web/src/game/aida-playbook-panel.test.ts web/src/game/market-route-panel.ts web/src/game/market-route-panel.test.ts web/src/product-builder/product-money-panel.ts web/src/product-builder/product-money-panel.test.ts web/src/main.ts web/src/main.test.ts web/src/styles/editor.css
git commit -m "fix(studio): present one bounded choice at a time"
```

### Task 4: Visibly curved editable product words

**Files:**
- Modify: `web/src/product-kit/curved-label-renderer.ts`
- Modify: `web/src/product-kit/curved-label-renderer.test.ts`
- Modify: `web/src/game/student-copy.ts`

**Interfaces:**
- Retain `CURVED_TEXT_PROFILE = "cylinder-front"` and editable `curvedTextSource`.
- Add a deterministic vertical path warp while preserving the existing horizontal cylinder compression.

- [ ] **Step 1: Write the failing renderer test**

Extend the draw trace with `destinationY` and assert:

```ts
const yValues = traces[1]!.strips.map(({ destinationY }) => destinationY);
expect(Math.max(...yValues) - Math.min(...yValues)).toBeGreaterThan(24);
expect(yValues.at(0)).toBeGreaterThan(yValues[Math.floor(yValues.length / 2)]!);
```

- [ ] **Step 2: Run the renderer test and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/product-kit/curved-label-renderer.test.ts
```

- [ ] **Step 3: Implement a bounded arc**

For each four-pixel strip, offset the destination down towards the two visible edges by at most 9% of label height. Keep transparent margins, edge alpha and horizontal compression unchanged. Update the hint to state exactly what the tool does and that the editable source remains stored; do not promise final print wrapping.

- [ ] **Step 4: Run renderer and Fabric round-trip tests**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/product-kit/curved-label-renderer.test.ts web/src/fabric/fabric-canvas-adapter.test.ts web/src/main.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add web/src/product-kit/curved-label-renderer.ts web/src/product-kit/curved-label-renderer.test.ts web/src/game/student-copy.ts
git commit -m "fix(product): make editable label curve visible"
```

### Task 5: Godot 16:10 shell, final review and permanent instruction reference

**Files:**
- Modify: `godot/project.godot`
- Modify: `scripts/onboarding-source.test.mjs`
- Modify: `godot/src/main/Main.tscn`
- Modify: `godot/src/main/Main.gd`
- Modify: `godot/tests/test_game_shell.gd`

**Interfaces:**
- Godot web viewport: exactly `1280 × 800`.
- `%ReviewInstructions` opens `%InstructionsDialog`.
- `%FinalReview` contains five `%Review*` checkboxes and is visible only during `publish-check`.
- `%PublishCampaign` is enabled only after all five checks are selected.

- [ ] **Step 1: Write failing source and scene tests**

Add a Node source-contract assertion for `window/size/viewport_height=800`. In `test_game_shell.gd`, assert the instruction button is keyboard-focusable, its dialog contains all four subarguments, and final publication remains disabled until the five real checkboxes are selected.

- [ ] **Step 2: Run the source test and verify RED**

```powershell
node --test scripts/onboarding-source.test.mjs
```

The Godot scene tests remain queued for CI because native Windows Godot is quarantined.

- [ ] **Step 3: Implement the 16:10 shell and instruction dialog**

Set `viewport_width=1280`, `viewport_height=800`, `MainMargin.offset_top=96` and `offset_bottom=-24` so the signed-in account controls do not cover the game heading. Replace obsolete hidden purchase copy. Use the exact instruction argument from this plan in a scrollable dialog.

- [ ] **Step 4: Implement final review**

The five labels are:

1. `The product and message suit the audience brief.`
2. `The product value and visible price are clear.`
3. `Attention, Interest, Desire and Action are all visible.`
4. `The visual technique supports the message.`
5. `The main claim is clear and supported by a proof point.`

Show `Final review complete. Build the market card.` only after all five checks. Do not treat checkbox selection as evidence that earlier persisted gates are complete; those gates remain enforced separately.

- [ ] **Step 5: Run source contracts**

```powershell
node --test scripts/onboarding-source.test.mjs scripts/student-copy-source-coverage.test.mjs scripts/student-copy-professional-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add godot/project.godot scripts/onboarding-source.test.mjs godot/src/main/Main.tscn godot/src/main/Main.gd godot/tests/test_game_shell.gd
git commit -m "feat(game): add final review and instruction reference"
```

### Task 6: Five-criterion gallery scorecards

**Files:**
- Modify: `godot/src/market/ui/MarketScreen.gd`
- Modify: `godot/src/market/ui/MarketScreen.tscn`
- Modify: `godot/tests/test_market_screen.gd`

**Interfaces:**
- `_scorecards: Dictionary` keyed by campaign ID, cleared on room entry/exit.
- Each scorecard stores five integer values in `0..2`.
- Medal buttons for an ad remain disabled until that ad has a complete score out of 10.
- Medal submission additionally requires complete scorecards for every other awardable ad.

- [ ] **Step 1: Write the failing Godot scene test**

In `_medal_market_shows_strict_criteria_and_deduplicates_awards`, assert that each other ad has five named score controls and a `Score: 0 / 10` label, medal buttons begin disabled, selecting 2/2/2/2/2 yields `Score: 10 / 10`, and the score survives a repeated `present_snapshot`.

- [ ] **Step 2: Implement local scorecards**

Add five keyboard-focusable `OptionButton` controls per other ad:

```gdscript
const SCORE_CRITERIA := [
    ["audience", "Audience fit"],
    ["value", "Product value and price"],
    ["aida", "AIDA"],
    ["visual", "Visual technique"],
    ["claim", "Credible claim"]
]
```

Give each control an unselected prompt plus `0 — missing`, `1 — partly clear`, `2 — clear`. Update the total immediately. Never send score data to Supabase or the market API.

- [ ] **Step 3: Gate medals and ranking instructions**

Enable medals for a card only when its scorecard is complete. Present the ordered instruction: score all ads, compare totals, use audience fit then AIDA to break ties, then award three different ads.

- [ ] **Step 4: Queue Godot tests for CI**

Do not launch native Godot. The source remains unclaimed until the GitHub web-export workflow executes the Godot test runner.

- [ ] **Step 5: Commit**

```powershell
git add godot/src/market/ui/MarketScreen.gd godot/src/market/ui/MarketScreen.tscn godot/tests/test_market_screen.gd
git commit -m "feat(market): add evidence-based medal scorecards"
```

### Task 7: Objective language workflows

**Files:**
- Modify only the student-copy sources identified by `scripts/student-copy-corpus.mjs`.
- Create retained evidence under `reviews/plain-language/` only if that path is already part of the retained verification policy; otherwise record hashes and outputs in the final verification record.

**Interfaces:**
- Plain Language input: one UTF-8 file containing the complete current student corpus, unchanged after extraction.
- Claude Scrubber input: the Plain Language candidate, MICROCOPY mode, unchanged.

- [ ] **Step 1: Generate the complete UTF-8 corpus**

```powershell
node scripts/student-copy-corpus.mjs --output C:\tmp\admarket-student-corpus-20260726.txt
```

Record SHA-256 before external processing.

- [ ] **Step 2: Run Plain Language objectively**

Use exactly:

```powershell
node "C:\Users\Peter Ellis\.agents\skills\plain-language\scripts\plain_language_contract.cjs" --prompt-file "C:\tmp\admarket-student-corpus-20260726.txt" --output-file "C:\tmp\admarket-plain-language-20260726.txt"
```

Do not add suspected phrases, preferred edits, system prompts or repair instructions.

- [ ] **Step 3: Map only meaning-preserving candidate edits**

Reject changes that alter game rules, price logic, safety boundaries, AIDA definitions, accessibility semantics or the linked argument. Apply accepted language edits with focused source tests.

- [ ] **Step 4: Run Claude Scrubber MICROCOPY objectively**

Read the installed MICROCOPY prompt verbatim, submit the complete Plain Language candidate to the required model/transport without added guidance, run `diff-guard.py`, and reject hard-fail output. Do not locally rewrite model output.

- [ ] **Step 5: Re-run copy contracts**

```powershell
node --test scripts/student-copy-corpus.test.mjs scripts/student-copy-professional-contract.test.mjs scripts/student-copy-source-coverage.test.mjs scripts/onboarding-source.test.mjs
```

Expected: PASS.

### Task 8: Integrated verification, non-production QA and final record

**Files:**
- Modify: final verification record under the branch's retained verification-record location.

**Interfaces:**
- Input candidate SHA: the final integrated local commit.
- Output: one immutable release ID, one unprotected non-production QA draft, exact 1280×800 and 1440×900 screenshots, neutral transcript and final verification record.

- [ ] **Step 1: Run focused type and source checks**

```powershell
pnpm run typecheck
node --test scripts/onboarding-source.test.mjs scripts/student-copy-corpus.test.mjs scripts/student-copy-professional-contract.test.mjs scripts/student-copy-source-coverage.test.mjs
```

- [ ] **Step 2: Run the full serialized suite once**

```powershell
pnpm run test
```

Expected: all Vitest and build-contract tests pass. Reuse this result if no input changes afterwards.

- [ ] **Step 3: Obtain a fresh Godot web artifact through the supported public CI route**

Push the source-equivalent public snapshot, run the existing SHA-pinned web-export workflow, and verify its source commit and artifact hash. Do not launch native Godot.

- [ ] **Step 4: Build and verify the exact release**

```powershell
pnpm run build:web
node scripts/verify-web-export.mjs build/web
git diff --check
```

Record the release ID, static/function counts, service-worker bytes and manifest hashes.

- [ ] **Step 5: Deploy one unprotected non-production QA draft**

Use only the dedicated `codex-browser-qa-harness` project. Do not deploy to production and do not include production Functions, Supabase access, real accounts, secrets or paid endpoints.

- [ ] **Step 6: Replay only affected browser evidence**

At both exact viewports verify:

1. no 16:9 letterboxing or clipped opening/status copy;
2. guided current step and permanent Now / Why / Done / Next reference;
3. sequential AIDA guidance and bounded option disclosure;
4. visibly curved and editable product words;
5. spaced price-position labels and completed price state;
6. route proof-point input and persisted report;
7. five-part final review;
8. five score controls per ad, totals, ranking and medal gating;
9. keyboard focus and no new overflow, clipping, orphaned text or console errors.

Do not repeat already completed reset, cloud-stub, layer-keyboard or unaffected navigation checks unless the changed surface invalidates them.

- [ ] **Step 7: Stop helpers and retain evidence**

Confirm every local helper is terminated. Retain evidence paths; do not delete temporary files.

- [ ] **Step 8: Update and commit the final verification record**

Record changed source groups, tests/build, exact viewports/screenshots, QA project ID, draft deploy ID/URL, browser findings and explicit Safari/school-wifi/hosted uncertainties. Confirm production and Supabase are unchanged.

---

## Self-review

- Spec coverage: the plan covers the strict wizard, permanent refresh, linked premises/subconclusions, route proof, final review, gallery scoring, curved-label truthfulness, copy objectivity, 16:10 layout and affected browser replay.
- Placeholder scan: no deferred implementation placeholder is present.
- Type consistency: `proofPoint` is carried through domain, schema, panel, main integration, readiness and guidance; guide step IDs and tool mappings are defined before controller use; scorecards remain local and never enter the hosted contract.
- Scope control: real cloud, visitor gate, production headers, Safari and school wifi remain explicitly unmeasured rather than inferred from the QA harness.
