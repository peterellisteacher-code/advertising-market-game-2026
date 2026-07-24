# Student Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace student-facing wording with the approved professional, factual and direct copy while preserving subject meaning and proving whole-corpus coverage.

**Architecture:** Keep `scripts/student-copy-corpus.mjs` as the completeness boundary, reuse the completed ordered Plain Language and Claude Scrubber evidence for unchanged source text, and adjudicate every proposed edit against the source meaning. Any new UI text introduced by the playtest and reset plans is scanned separately in raw source order before it is accepted into production source.

**Tech Stack:** TypeScript, GDScript, Godot `.tscn`, Node test runner, Vitest, the existing Plain Language relay, and the existing Claude Scrubber MICROCOPY workflow.

## Global Constraints

- The landing explanation is exactly: `First you will invent a product, then you will create an advertisement for it.`
- Use professional, factual and direct student language; retain direct second person when it clearly names a student action.
- Preserve precise terms including `audience`, `AIDA`, `visual technique`, `deliberate`, `realistic`, `strongest`, `close-up`, and the named partner roles where they carry meaning.
- Plain Language runs before Claude Scrubber; each receives only unannotated raw copy in source order and its standard instructions.
- Do not include suspected phrases, preferred outcomes, playtest findings, annotations, rationales, verdicts, or output from the other reviewer in either scan.
- Model output is evidence, not an automatic patch.
- Do not rerun the already completed 1,178-entry corpus scans while their SHA-256 inputs remain unchanged.
- Native Windows Godot execution, production deployment, and live Supabase mutation remain prohibited.

---

### Task 1: Lock the whole-corpus boundary

**Files:**
- Modify: `scripts/student-copy-corpus.mjs`
- Test: `scripts/student-copy-corpus.test.mjs`
- Test: `scripts/student-copy-source-coverage.test.mjs`

**Interfaces:**
- Consumes: authored TypeScript, GDScript, and `.tscn` files that can emit visible or announced student copy.
- Produces: `STUDENT_COPY_SOURCE_PATHS: readonly string[]`, including `web/src/ui/canvas-accessibility-controller.ts`.

- [ ] **Step 1: Add the coverage assertion before changing the source list**

Add this assertion to `scripts/student-copy-source-coverage.test.mjs`:

```js
test("the semantic canvas controller is part of the ordered student-copy corpus", () => {
  assert.equal(
    STUDENT_COPY_SOURCE_PATHS.includes("web/src/ui/canvas-accessibility-controller.ts"),
    true
  );
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
node --test scripts/student-copy-source-coverage.test.mjs
```

Expected: FAIL because the semantic canvas controller is not in `STUDENT_COPY_SOURCE_PATHS`.

- [ ] **Step 3: Add the missing ordered source**

Add this exact path beside the other `web/src/ui` sources in `STUDENT_COPY_SOURCE_PATHS`:

```js
"web/src/ui/canvas-accessibility-controller.ts"
```

- [ ] **Step 4: Run both corpus tests and confirm GREEN**

Run:

```powershell
node --test scripts/student-copy-corpus.test.mjs scripts/student-copy-source-coverage.test.mjs
```

Expected: 6 tests pass and no authored text emitter is omitted.

- [ ] **Step 5: Record the immutable completed-scan evidence**

In the final verification record, retain these exact values:

```text
corpus-v2.json: 2923E8131A4C39778B5CEE650233979A9241D6F4F9B903D87E6162993B71801A
plain-language response: CDAC4784EBA1FB0C4F6B8C9030CBC429D030D900015E2BB5AB9ADB1FCF8FE637
scrubbed-map.json: 7B45DE2099F3596FB4A7D737EDC27D41E7AEE9EFFD31BFC40F3EF3E58428DD81
```

Do not copy ignored review artifacts into deployable source.

### Task 2: Apply only meaning-preserving existing-corpus edits

**Files:**
- Modify: `godot/src/main/Main.gd`
- Modify: `godot/src/main/Main.tscn`
- Modify: `godot/src/market/ui/MarketScreen.gd`
- Modify: `godot/src/market/ui/MarketScreen.tscn`
- Modify: `web/src/account/account-gate.ts`
- Modify: `web/src/ai-image/image-lab-panel.ts`
- Modify: `web/src/game/aida-playbook-panel.ts`
- Modify: `web/src/game/aida-playbook.ts`
- Modify: `web/src/game/market-route-panel.ts`
- Modify: `web/src/game/market-route.ts`
- Modify: `web/src/game/student-copy.ts`
- Modify: `web/src/product-builder/product-builder-panel.ts`
- Modify: `web/src/product-builder/product-money-panel.ts`
- Modify: `web/src/product-kit/product-kit-panel.ts`
- Modify: `web/src/studio-coach/studio-coach-panel.ts`
- Modify: `web/src/studio-coach/technique-catalogue.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Test: `web/src/game/student-copy.test.ts`
- Test: existing component tests adjacent to every modified TypeScript component.

**Interfaces:**
- Consumes: `build/copy-review-20260724-001/combined-copy-changes.json` as review evidence only.
- Produces: source wording whose meaning is equal to or more precise than the current source.

- [ ] **Step 1: Write exact-copy regression assertions**

Add these assertions to `web/src/game/student-copy.test.ts` before changing source:

```ts
expect(STUDENT_COPY.roundZero.productWordsHint).toBe(
  "Select the product first. Words added to supported products follow a curved path and remain editable."
);
expect(STUDENT_COPY.roundZero.bothRolesReady).not.toBe(
  "Follow the highlighted tool step."
);
```

Add a landing-copy assertion in `scripts/godot-bridge-contract.test.mjs`:

```ts
expect(source).toContain(
  "First you will invent a product, then you will create an advertisement for it."
);
expect(source).not.toContain("Invent it. Advertise it. Judge the market.");
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```powershell
pnpm exec vitest run web/src/game/student-copy.test.ts --no-cache --configLoader runner
node --test scripts/godot-bridge-contract.test.mjs
```

Expected: FAIL on the old curved-label promise, vague partner instruction, and old landing tagline.

- [ ] **Step 3: Adjudicate the 111 proposed changes**

For each entry in `combined-copy-changes.json`, accept it only when all three checks are true:

```text
1. The factual requirement is unchanged.
2. The advertising or design term is no less precise.
3. The action remains direct and grammatically complete.
```

Explicitly reject edits that remove `distinctive`, `strongest`, `short, useful`, `deliberate`, `important`, `realistic`, `most`, or the close-up requirement; change “swap driver” to “swap one part”; claim final physical wrapping; narrow the audience to scrolling behaviour; or replace “audience most likely to want it” with “audience for it”.

- [ ] **Step 4: Apply accepted wording and the exact landing sentence**

Use direct sentence forms such as:

```ts
"Preparing a place for the pitch."
"Building the market card."
"Three different ads"
"The screen reader announces the selected object."
"Check that this fits your audience and price position."
```

Keep direct second-person source wording where replacing `your` with `the` makes the instruction impersonal or ambiguous.

- [ ] **Step 5: Run component and copy tests and confirm GREEN**

Run:

```powershell
pnpm exec vitest run web/src/game/student-copy.test.ts web/src/game/aida-playbook-panel.test.ts web/src/game/market-route-panel.test.ts web/src/product-builder/product-money-panel.test.ts web/src/product-kit/product-kit-panel.test.ts web/src/ai-image/image-lab-panel.test.ts web/src/studio-coach/studio-coach-panel.test.ts web/src/ui/editor-shell.test.ts --no-cache --configLoader runner
node --test scripts/student-copy-corpus.test.mjs scripts/student-copy-source-coverage.test.mjs scripts/godot-bridge-contract.test.mjs
```

Expected: all selected tests pass with no warning or snapshot drift.

### Task 3: Scan and accept newly introduced copy objectively

**Files:**
- Create: `reviews/student-language-adjudication-2026-07-24.md`
- Modify: student-facing source files introduced by the playtest and reset plans.
- Test: adjacent component tests containing exact accepted copy.

**Interfaces:**
- Consumes: a raw ordered list containing only new student-facing strings.
- Produces: an accepted `copy ID → final text` mapping, with Plain Language evidence preceding Claude Scrubber evidence.

- [ ] **Step 1: Extract only new strings**

Generate a plain UTF-8 file with one stable copy ID and raw string per entry:

```text
WEB_SRC_ACCOUNT_ACCOUNT_RESET_DIALOG_TS__L0001__N01
Reset progress
WEB_SRC_ACCOUNT_ACCOUNT_RESET_DIALOG_TS__L0002__N01
Type RESET to confirm.
```

Do not include headings that describe suspected defects, preferred rewrites, or source rationales.

- [ ] **Step 2: Run Plain Language without guidance**

Pass only the raw ordered text and the standard Plain Language skill instruction. Save the verbatim response and SHA-256. Do not include Claude Scrubber output or the playtest report.

- [ ] **Step 3: Run Claude Scrubber MICROCOPY without guidance**

Pass only the Plain Language result as raw contiguous text sections using the exact standard MICROCOPY prompt, model, temperature, and token budget. Save every accepted response and SHA-256. Do not include Plain Language annotations, adjudication notes, or expected findings.

- [ ] **Step 4: Validate order and completeness**

Use a deterministic validator that enforces:

```ts
expect(returnedIds).toEqual(inputIds);
expect(new Set(returnedIds).size).toBe(inputIds.length);
expect(returnedText.every((text) => text.trim().length > 0)).toBe(true);
```

Reject truncated or reordered sections and rerun only the affected raw section.

- [ ] **Step 5: Adjudicate and update exact-copy tests before source**

For every proposed new-string edit, preserve:

```text
destructive scope
authentication-preservation promise
retry behaviour
keyboard key names
editor capability limits
advertising vocabulary
```

Update exact-copy test expectations to the accepted mapping, run them to observe RED against the draft source, then change production source and rerun to GREEN.

- [ ] **Step 6: Write the adjudication record**

Record scan hashes, accepted/rejected counts, the exact landing sentence, and meaning-preservation reasons in `reviews/student-language-adjudication-2026-07-24.md`. Do not include secrets, account data, or model-authentication material.

### Task 4: Verify and commit the language slice

**Files:**
- Modify: `reviews/student-language-adjudication-2026-07-24.md`

**Interfaces:**
- Consumes: the final language diff and focused GREEN evidence.
- Produces: one reviewable commit that changes student copy and its tests without changing storage or deployment behaviour.

- [ ] **Step 1: Check the final language diff**

Run:

```powershell
git diff --check
git diff --stat
git diff -- scripts/student-copy-corpus.mjs web/src godot/src reviews/student-language-adjudication-2026-07-24.md
```

Expected: no whitespace errors and no unrelated file changes.

- [ ] **Step 2: Rerun the complete copy boundary**

Run:

```powershell
node --test scripts/student-copy-corpus.test.mjs scripts/student-copy-source-coverage.test.mjs
pnpm exec vitest run web/src/game/student-copy.test.ts --no-cache --configLoader runner
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```powershell
git add scripts/student-copy-corpus.mjs web/src godot/src reviews/student-language-adjudication-2026-07-24.md
git commit -m "fix(copy): make student language factual and direct"
```
