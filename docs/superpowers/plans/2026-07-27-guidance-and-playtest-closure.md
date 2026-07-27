# Guidance and Playtest Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give students a complete, professionally written, one-action-at-a-time route through the game, explain the two partner roles, and close every actionable finding from Claude's 24 July playtest without regressing the strengths already verified.

**Architecture:** A typed instruction-argument model records all premises, intermediate conclusions and dependencies. The persistent `Now / Why / Done / Next` guide maps each current action to that model, while `How to use this site` renders the full numbered reference. Role definitions are stored with campaign gameplay state and remain available beside `Swap roles`. Existing web/Godot completion gates, market state, accessibility mirror and error adapters are repaired through focused tests; no duplicate tutorial state or second publication model is introduced.

**Tech Stack:** TypeScript 7, Vitest 4/JSDOM, Godot 4/GDScript and scene source contracts, Node test runner, CSS, existing creator/market bridges.

**Approved specification:** `docs/superpowers/specs/2026-07-27-student-teacher-editor-completion-design.md`

**Evidence source:** `C:\Users\Peter Ellis\OneDrive\Teaching\2026\11PHIL S2 - 2026\vce\Ad-Market-Game-Playtest-Report-2026-07-24.docx`, SHA-256 `702450680E76ED7DD4A721011C6D558DB53062F6DEA10FF68A98A080BB655022`.

**Dependencies:** Implement after the access, Image Lab and editor plans so the final instruction text names the actual controls and route behaviour.

## Global Constraints

- Preserve the already-implemented state-driven guided journey, full instruction dialog, final five-part review, gallery scorecards, proof point, large product placement, visibly curved editable product words, audience-led pricing, AIDA teaching, ethical move guardrails, autosave, role contribution tracking and Undo/Redo.
- Do not rerun the 24 July Claude playtest or any completed paid panel during implementation.
- Every premise must support a later premise or conclusion. Every intermediate conclusion must be used by the next subargument.
- The ordinary route presents one small action at a time. The complete argument remains available as a reference.
- Student-facing English must be factual, direct, academic and professional. Do not use slang, conversational filler, slogans, gamified metaphors or unexplained implementation language.
- Use the factual opening: `First you will invent a product, then you will create an advertisement for it.`
- Do not expose `HANDLER_ERROR`, revision counters, route names, stack text, tokens, database details or fixture labels.
- Disabled actions state the unmet condition beside the action.
- Keep all network waits bounded and automatic retries idempotent.
- Native Windows Godot remains quarantined. Godot runtime verification comes from supported CI web export.
- Do not delete or move any file without Peter's explicit deletion approval and notification.

---

### Task 1: Encode the linked inductive argument and prove there are no loose ends

**Files:**
- Create: `web/src/game/instruction-argument.ts`
- Create: `web/src/game/instruction-argument.test.ts`
- Modify: `web/src/game/guided-journey.ts`
- Modify: `web/src/game/guided-journey.test.ts`
- Modify: `web/src/game/guided-journey-controller.ts`
- Modify: `web/src/game/guided-journey-controller.test.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`

**Interfaces:**

```ts
export type InstructionClaimId =
  | `P${1 | 2 | 3 | 5 | 6 | 7 | 8 | 10 | 11 | 12 | 13 | 15 | 16 | 17 | 18 | 20 | 21 | 22 | 23 | 24}`
  | "ICA"
  | "ICB"
  | "ICC"
  | "ICD"
  | "C";

export interface InstructionClaim {
  readonly id: InstructionClaimId;
  readonly kind: "premise" | "intermediate-conclusion" | "overall-conclusion";
  readonly text: string;
  readonly supports: readonly InstructionClaimId[];
  readonly uses: readonly InstructionClaimId[];
}

export interface InstructionSubargument {
  readonly id: "A" | "B" | "C" | "D" | "E";
  readonly title: string;
  readonly claims: readonly InstructionClaim[];
  readonly conclusionId: InstructionClaimId;
}

export function validateInstructionArgument(
  subarguments: readonly InstructionSubargument[]
): readonly string[];
```

- [ ] **Step 1: Write failing graph-integrity tests**

Assert:

- the exact twenty premise IDs from Section 5 occur once: 1–3, 5–8, 10–13, 15–18 and 20–24;
- one overall conclusion occurs;
- every premise has at least one later `supports` target;
- every `uses` reference exists and is earlier;
- `ICA` is used in Subargument B, `ICB` in C, `ICC` in D, and `ICD` in E;
- the overall conclusion has no outgoing support edge;
- the graph is acyclic;
- no claim is unreachable from a premise;
- no premise or intermediate conclusion is omitted from the complete guide;
- the content matches Section 5 of the approved specification.

Introduce one loose premise fixture and assert the validator reports its exact ID.

- [ ] **Step 2: Run argument tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/game/instruction-argument.test.ts web/src/game/guided-journey.test.ts web/src/game/guided-journey-controller.test.ts web/src/ui/editor-shell.test.ts
```

- [ ] **Step 3: Implement immutable argument data**

Use the five approved subarguments:

```text
A: sign in, audience brief, role assignment -> shared audience purpose
B: test product, choose starter, edit parts, name product -> suitable named product
C: visible Art Director change, Strategist message, AIDA -> coherent advertisement
D: price, route, proof point -> clear credible offer
E: final review, publication check, market comparison -> completed campaign judgement
```

Do not write a second shortened argument by hand.

- [ ] **Step 4: Map guided steps to claims**

Extend the existing `GuidedJourneyStep` interface with
`readonly claimIds: readonly InstructionClaimId[]`.

Every current step must map to at least one claim. Together, the ordinary steps and stage transitions must cover all premises. `Why` must be generated or checked against the next supported claim/conclusion.

- [ ] **Step 5: Render the full reference from argument data**

Replace the hard-coded instruction-dialog sections in `editor-shell.ts` with a container populated by `GuidedJourneyController`. Render semantic headings, ordered lists, short conclusion paragraphs and visible spacing. Use `How to use this site` as the permanent action label in both top bar and guide.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add web/src/game/instruction-argument.ts web/src/game/instruction-argument.test.ts web/src/game/guided-journey.ts web/src/game/guided-journey.test.ts web/src/game/guided-journey-controller.ts web/src/game/guided-journey-controller.test.ts web/src/ui/editor-shell.ts web/src/ui/editor-shell.test.ts
git commit -m "feat(guidance): link every student instruction"
```

### Task 2: Explain Art Director and Strategist before work and beside role swap

**Files:**
- Create: `web/src/game/role-guide-controller.ts`
- Create: `web/src/game/role-guide-controller.test.ts`
- Modify: `web/src/domain/campaign-document.ts`
- Modify: `web/src/domain/campaign-document.test.ts`
- Modify: `web/src/game/pair-game-controller.ts`
- Modify: `web/src/game/pair-game-controller.test.ts`
- Modify: `web/src/game/student-copy.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/styles/editor.css`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`

**Role definitions:**

```ts
const ROLE_GUIDE = {
  artDirector: {
    label: "Art Director",
    responsibilities:
      "Controls the product's appearance, images, colour, arrangement and layout."
  },
  strategist: {
    label: "Strategist",
    responsibilities:
      "Controls the product name, advertising words, claim, price reasoning and market-route reasoning."
  }
} as const;
```

- [ ] **Step 1: Write failing schema and controller tests**

Add `roleGuideAcknowledged: boolean` beside the existing fields in
`CampaignDocumentV1.gameplay.pair`.

Older documents parse with `false`. Test:

- first studio entry opens the role guide before editor mutation;
- both roles and responsibilities are visible;
- the current starting assignment is stated;
- `Begin work` records acknowledgement and focuses the current guided action;
- `Role guide` beside `Swap roles` reopens it at any time;
- Escape closes only the optional reopened guide, not the required first-use guide;
- `Swap roles` explains that responsibilities exchange and authorship history remains;
- the status names the recorded evidence for each role instead of only `Both roles made a change`.

- [ ] **Step 2: Run focused tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/domain/campaign-document.test.ts web/src/game/role-guide-controller.test.ts web/src/game/pair-game-controller.test.ts web/src/ui/editor-shell.test.ts web/src/main.test.ts
```

- [ ] **Step 3: Implement the guide and persistence**

Use one accessible dialog/controller. Add `Role guide` directly beside `Swap roles`. The contribution summary should use factual states such as:

```text
Art Director: visible canvas change recorded.
Strategist: message or strategy change recorded.
Roles have been swapped once.
```

Do not rename the roles or alter the existing action counters/handoff model.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add web/src/game/role-guide-controller.ts web/src/game/role-guide-controller.test.ts web/src/domain/campaign-document.ts web/src/domain/campaign-document.test.ts web/src/game/pair-game-controller.ts web/src/game/pair-game-controller.test.ts web/src/game/student-copy.ts web/src/ui/editor-shell.ts web/src/ui/editor-shell.test.ts web/src/styles/editor.css web/src/main.ts web/src/main.test.ts
git commit -m "feat(roles): explain partner responsibilities"
```

### Task 3: Update the one-action guide for the final access, editor and Image Lab controls

**Files:**
- Modify: `web/src/game/guided-journey.ts`
- Modify: `web/src/game/guided-journey.test.ts`
- Modify: `web/src/game/guided-journey-controller.ts`
- Modify: `web/src/game/guided-journey-controller.test.ts`
- Modify: `web/src/game/student-copy.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/ui/editor-shell.test.ts`
- Modify: `web/src/styles/editor.css`

- [ ] **Step 1: Write failing journey-order tests**

The guided route must cover, in order:

```text
sign in -> audience -> roles -> starter product -> product edit -> product name
-> partner contribution -> Attention -> Interest -> Desire -> Action
-> price position -> visible price -> market route -> proof point
-> final review -> market entry -> scoring -> sign out
```

Not every optional editor tool is a completion gate. Fill, delete, Logo and Image Lab appear as available methods at the relevant product/advertisement step without becoming compulsory.

Assert each visible current step contains:

- one imperative `Now`;
- one causal `Why` that names a later result;
- one observable `Done`;
- one exact `Next`;
- one action button label naming the control or destination.

Assert the vague sentence `Follow the highlighted tool step` does not occur.

- [ ] **Step 2: Run guide tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/game/guided-journey.test.ts web/src/game/guided-journey-controller.test.ts web/src/ui/editor-shell.test.ts
```

- [ ] **Step 3: Implement the final step map**

Use persisted campaign/game state, not dismissible tutorial state, to select the current incomplete step. Route labels must name current controls such as `Open Build`, `Open AIDA`, `Open Price`, `Return to game`, and `Sign out`.

Image Lab wording reports optional remaining uses only. It must not instruct students to obtain or enter a code.

- [ ] **Step 4: Format the guide as a scannable web layout**

Use a clear heading, progress line, four short labelled rows and one action group. Prevent the microphone-screen failure pattern:

- no all-caps label embedded at the start of long sentences;
- no seven-line paragraph block;
- no line longer than the available measure;
- at least 0.5rem between semantic groups;
- `dt` and `dd` have distinct columns at desktop width and stack cleanly on narrow width;
- optional detail uses disclosure or the full reference, not repeated dense text.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add web/src/game/guided-journey.ts web/src/game/guided-journey.test.ts web/src/game/guided-journey-controller.ts web/src/game/guided-journey-controller.test.ts web/src/game/student-copy.ts web/src/ui/editor-shell.ts web/src/ui/editor-shell.test.ts web/src/styles/editor.css
git commit -m "fix(guidance): name one current action at a time"
```

### Task 4: Close web-studio playtest findings with one authoritative state source

**Files:**
- Modify: `web/src/product-builder/product-money-panel.ts`
- Modify: `web/src/product-builder/product-money-panel.test.ts`
- Modify: `web/src/game/creator-stage.ts`
- Modify: `web/src/game/creator-stage.test.ts`
- Modify: `web/src/bridge/creator-public-api.ts`
- Modify: `web/src/bridge/creator-public-api.test.ts`
- Modify: `web/src/account/cloud-progress-recovery.ts`
- Modify: `web/src/account/cloud-progress-recovery.test.ts`
- Modify: `web/src/ui/canvas-accessibility-controller.ts`
- Modify: `web/src/ui/canvas-accessibility-controller.test.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/main.test.ts`

**Falsifiers:**

- If a valid current campaign with aligned price/evidence/route/proof point passes `evaluatePublicationReadiness`, the pure-readiness hypothesis is dead; reproduce the loop in the bridge/Godot handoff.
- If Fabric handles, canvas status and lock validation already read one selected object ID in a current browser, the selection-source hypothesis is dead; do not add a second synchroniser.

- [ ] **Step 1: Write failing price-state tests**

`Add price to design` must expose:

```ts
type PricePlacementState =
  | { readonly status: "ready"; readonly action: "add" | "update" }
  | { readonly status: "pending" }
  | { readonly status: "complete"; readonly visiblePrice: string }
  | { readonly status: "needs-attention"; readonly reason: string };
```

Test one normalized integer-cent value drives charged price, visible protected price text and evidence. Completion survives reload. A later price change invalidates only price-dependent readiness and names the repair action.

- [ ] **Step 2: Write failing safe-error and revision-copy tests**

Assert:

- raw `HANDLER_ERROR` never reaches visible text, accessible text or student-copy corpus;
- publication failures map to the exact unmet condition;
- restored cloud save text contains no implementation revision number;
- ordinary sync, conflict and restored-save statuses remain distinguishable without counters.

- [ ] **Step 3: Write failing selection-parity tests**

After a selected object changes through Fabric:

- the visible canvas status names that object;
- Layers marks the same ID;
- AIDA lock validation inspects the same ID/evidence;
- deselection clears all three;
- no stale first-selection state remains after opening AIDA.

- [ ] **Step 4: Run focused tests and verify RED**

```powershell
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/product-builder/product-money-panel.test.ts web/src/game/creator-stage.test.ts web/src/bridge/creator-public-api.test.ts web/src/account/cloud-progress-recovery.test.ts web/src/ui/canvas-accessibility-controller.test.ts web/src/main.test.ts
```

- [ ] **Step 5: Implement minimal state repairs**

Derive price completion from the current campaign document plus actual canvas evidence. Use `CanvasPort.getSelectedObjectId()`/`subscribeSelection()` as the single selection authority. Keep internal revision numbers in persisted protocols but remove them from ordinary presentation.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the command from Step 4. Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add web/src/product-builder/product-money-panel.ts web/src/product-builder/product-money-panel.test.ts web/src/game/creator-stage.ts web/src/game/creator-stage.test.ts web/src/bridge/creator-public-api.ts web/src/bridge/creator-public-api.test.ts web/src/account/cloud-progress-recovery.ts web/src/account/cloud-progress-recovery.test.ts web/src/ui/canvas-accessibility-controller.ts web/src/ui/canvas-accessibility-controller.test.ts web/src/main.ts web/src/main.test.ts
git commit -m "fix(studio): align selection price and readiness state"
```

### Task 5: Reject fixture leakage and complete student-safe network errors

**Files:**
- Create: `scripts/production-catalogue-safety.test.mjs`
- Modify: `package.json`
- Modify: `web/src/market/market-public-api.ts`
- Modify: `web/src/market/market-public-api.test.ts`
- Modify: `web/src/market/market-client.ts`
- Modify: `web/src/market/market-client.test.ts`
- Modify: `web/src/game/student-copy.ts`

- [ ] **Step 1: Write the failing production-catalogue scan**

Scan every deployable catalogue, pricing manifest and starter manifest. Reject case-insensitive:

```text
QA
fixture
example.invalid
synthetic test
test-only
```

Allow these strings only under test/fixture directories that cannot enter the release manifest. The test must print exact source paths and record IDs.

- [ ] **Step 2: Write failing network-error mapping tests**

Use exact client error kinds:

```ts
type StudentMarketError =
  | "INVALID_ROOM_CODE"
  | "ROOM_NOT_FOUND"
  | "ROOM_UNAVAILABLE"
  | "CONNECTION_TIMEOUT"
  | "CONNECTION_UNAVAILABLE"
  | "RATE_LIMITED"
  | "SESSION_EXPIRED";
```

Assert raw bridge/server codes and response bodies never become student text. Preserve retry-after seconds where supplied.

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
node --test scripts/production-catalogue-safety.test.mjs
pnpm exec vitest run --no-cache --configLoader runner --maxWorkers=1 web/src/market/market-public-api.test.ts web/src/market/market-client.test.ts
```

- [ ] **Step 4: Implement the scan and bounded mapping**

Add the safety test to `test:build-web` and `build`. Map internal failures at one public API boundary. Do not change the server's diagnostic logs or typed internal codes.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add scripts/production-catalogue-safety.test.mjs package.json web/src/market/market-public-api.ts web/src/market/market-public-api.test.ts web/src/market/market-client.ts web/src/market/market-client.test.ts web/src/game/student-copy.ts
git commit -m "test(release): reject fixtures and internal errors"
```

### Task 6: Close Godot market completion, keyboard and room-error findings

**Files:**
- Modify: `godot/src/main/Main.gd`
- Modify: `godot/src/main/Main.tscn`
- Modify: `godot/src/market/ui/MarketScreen.gd`
- Modify: `godot/src/market/ui/MarketScreen.tscn`
- Modify: `godot/src/main/GameAccessibilityMirror.gd`
- Modify: `godot/tests/test_game_shell.gd`
- Modify: `godot/tests/test_market_screen.gd`
- Modify: `godot/tests/test_live_resume.gd`
- Modify: `scripts/onboarding-source.test.mjs`
- Modify: `scripts/godot-bridge-contract.test.mjs`

- [ ] **Step 1: Write failing source/Godot tests**

Cover:

- the full five-subargument reference is available from every game stage;
- `Role guide` is available before and after swapping;
- invalid code, missing room, unavailable room, timeout and connection failure have separate text;
- market final-review controls form one keyboard traversal sequence;
- focus moves from the last check to `Build market card`, then to `Enter market`;
- no invisible/disabled control traps focus;
- a complete campaign advances to market exactly once;
- reload of completed progress returns to completed market state;
- returning from studio cannot reopen the publication gate indefinitely;
- the accessibility mirror includes heading, current instruction, completion status, selected/focused control and one visible keyboard hint.

- [ ] **Step 2: Run Node source contracts and verify RED**

```powershell
node --test scripts/onboarding-source.test.mjs scripts/godot-bridge-contract.test.mjs
```

Godot runtime tests remain queued for the supported CI runner; do not run Windows Godot.

- [ ] **Step 3: Implement one market completion transition**

Use persisted `GameRun`/market state as the authority. Guard the transition with the existing operation ID or completion flag so repeated bridge callbacks are idempotent. Do not add a second counter.

- [ ] **Step 4: Implement explicit focus neighbours and error mapping**

Set scene focus neighbours for review checkboxes, build action, enter-market action, scorecard controls and exit. Restore focus when dialogs close. The Godot layer receives typed public bridge errors and maps them to the distinct messages; it must not guess two causes in one sentence.

- [ ] **Step 5: Update source contracts**

Assert the new labels, focus nodes, stage transition guards and accessible mirror fields exist in source. Keep the 1280×800 viewport and account-shell offsets already verified.

- [ ] **Step 6: Run source contracts and commit**

```powershell
node --test scripts/onboarding-source.test.mjs scripts/godot-bridge-contract.test.mjs scripts/student-copy-source-coverage.test.mjs
```

Expected: PASS. Godot runtime tests will run in CI during the final verification plan.

```powershell
git add godot/src/main/Main.gd godot/src/main/Main.tscn godot/src/market/ui/MarketScreen.gd godot/src/market/ui/MarketScreen.tscn godot/src/main/GameAccessibilityMirror.gd godot/tests/test_game_shell.gd godot/tests/test_market_screen.gd godot/tests/test_live_resume.gd scripts/onboarding-source.test.mjs scripts/godot-bridge-contract.test.mjs
git commit -m "fix(game): complete and navigate the market path"
```

### Task 7: Complete the factual copy corpus before objective review

**Files:**
- Modify: `web/src/game/student-copy.ts`
- Modify: `web/src/game/instruction-argument.ts`
- Modify: `web/src/game/guided-journey.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/account/account-gate.ts`
- Modify: `web/src/ai-image/image-lab-panel.ts`
- Modify: `web/src/logo-lab/logo-lab-panel.ts`
- Modify: `web/src/product-builder/product-money-panel.ts`
- Modify: `godot/src/main/Main.gd`
- Modify: `godot/src/main/Main.tscn`
- Modify: `godot/src/market/ui/MarketScreen.gd`
- Modify: `godot/src/market/ui/MarketScreen.tscn`
- Modify: `scripts/student-copy-corpus.mjs`
- Modify: `scripts/student-copy-corpus.test.mjs`
- Modify: `scripts/student-copy-source-coverage.test.mjs`
- Modify: `scripts/student-copy-professional-contract.test.mjs`
- Modify: `scripts/build-logo-icons.test.mjs`
- Create: `reviews/student-copy-completion-candidate.json`

- [ ] **Step 1: Write failing language contracts**

Require the factual opening exactly:

```text
First you will invent a product, then you will create an advertisement for it.
```

Reject known obsolete or inaccurate wording, including:

```text
Invent it. Advertise it. Judge the market.
Wake Image Lab
Teacher code
Follow the highlighted tool step
Both roles made a change
HANDLER_ERROR
Cloud save restored at revision
final wrapping
wraps perfectly
```

Also reject casual/slang phrases and promotional metaphors already covered by the retained professional-language contract.

Extend corpus coverage beyond TypeScript/Godot literals. Add a JSON-field extractor
with stable JSON-pointer IDs and include every runtime-visible authored label from:

```text
catalog/generated/offline-core-v1/catalog.json: title
catalog/generated/offline-core-v1/product-kit-v1.json: kit/component title
catalog/generated/offline-core-v1/product-kit-pricing-v1.json: title/label
catalog/generated/product-builder-pilot-v1/catalogue.json: title/label
catalog/generated/product-shells-v1-reviewed/catalog.json: title
catalog/generated/offline-core-v1/student-starters-v1.json: title/category
```

Search tags, IDs, hashes, file paths, licence fields and machine categories are not
visible prose and remain excluded. Logo icon titles are deterministic title-case
derivations of vendored Tabler IDs; add a build contract proving that derivation is
the sole source and that no separately authored icon prose bypasses the corpus.
Tests must fail when a runtime renders an authored JSON field that has no corpus
classification.

- [ ] **Step 2: Generate the pre-review corpus**

```powershell
node scripts/student-copy-corpus.mjs --root . --output reviews/student-copy-completion-candidate.json
Get-FileHash -Algorithm SHA256 reviews/student-copy-completion-candidate.json
```

Creating this evidence file is authorised. Do not delete or overwrite prior review evidence. Use a new filename if it already exists.

- [ ] **Step 3: Reconcile every changed string with game behaviour**

Check:

- route and sign-out statements;
- role responsibilities;
- optional versus required editor actions;
- Image Lab allowance meaning;
- price completion;
- market-route proof point;
- reset scope;
- curved product wording: visible curved artwork is editable, but no promise of physical/final wrapping;
- error and offline states;
- accessibility labels.
- generated catalogue, starter, Product Kit, price-option and product-shell titles;
- whether any accepted catalogue wording must be made in its authoritative source
  inventory and regenerated rather than patched only in a generated output.

- [ ] **Step 4: Run deterministic copy tests**

```powershell
node --test scripts/student-copy-corpus.test.mjs scripts/student-copy-source-coverage.test.mjs scripts/student-copy-professional-contract.test.mjs scripts/build-logo-icons.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit the stable authored corpus**

```powershell
git add web/src/game/student-copy.ts web/src/game/instruction-argument.ts web/src/game/guided-journey.ts web/src/ui/editor-shell.ts web/src/account/account-gate.ts web/src/ai-image/image-lab-panel.ts web/src/logo-lab/logo-lab-panel.ts web/src/product-builder/product-money-panel.ts godot/src/main/Main.gd godot/src/main/Main.tscn godot/src/market/ui/MarketScreen.gd godot/src/market/ui/MarketScreen.tscn scripts/student-copy-corpus.mjs scripts/student-copy-corpus.test.mjs scripts/student-copy-source-coverage.test.mjs scripts/student-copy-professional-contract.test.mjs scripts/build-logo-icons.test.mjs reviews/student-copy-completion-candidate.json
git commit -m "copy(student): complete the factual game instructions"
```

Do not run Plain Language or Claude Scrubber in this task. Those objective calls occur once on this stable corpus in the final verification plan.

### Task 8: Trace every Claude finding to a focused result

**Files:**
- Create: `reviews/claude-playtest-2026-07-24-closure.md`

- [ ] **Step 1: Create a neutral closure table**

Use columns:

```text
Finding | Classification | Source/test evidence | Browser evidence required | Status
```

Record all fourteen actionable findings and four strengths from Section 16 of the approved specification. Use:

- `changed and test-passing`;
- `present and focused-test-passing`;
- `requires current hosted browser observation`; or
- `contextual harness artefact, production scan clean`.

Do not label a browser-dependent item complete from unit tests alone.

- [ ] **Step 2: Check exact source/test references**

Every `changed` or `present` entry must name an existing path and test name. Every browser entry must name the exact replay in the final verification plan.

- [ ] **Step 3: Commit**

```powershell
git add reviews/claude-playtest-2026-07-24-closure.md
git commit -m "docs(qa): trace Claude playtest findings"
```

## Plan Completion Gate

- [ ] The full standard-form argument has no loose premise or unused intermediate conclusion.
- [ ] Every current guide step maps to one or more argument claims.
- [ ] Students see one action at a time and can always open the full reference.
- [ ] Art Director and Strategist are explained before work and beside role swap.
- [ ] Price, selection, readiness and completion use one authoritative state each.
- [ ] No raw handler error, revision number or fixture copy reaches students.
- [ ] Godot completion is idempotent, keyboard traversable and reload-safe by source/runtime tests.
- [ ] The complete authored copy corpus passes deterministic coverage/professional contracts.
- [ ] Every Claude finding has focused evidence or a named hosted-browser check.
