# Playtest Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct every substantiated production defect in the 24 July playtest while preserving behaviours that the playtest verified.

**Architecture:** Fix each defect at its owning boundary: canonical market-price semantics in the editor/exporter, safe publication messages in the bridge, stable completion and partner state in UI state models, layout state in the editor root, and typed room diagnostics in the Godot host. Reproduce the reported AIDA sequence first and make no AIDA behaviour change if the focused test passes.

**Tech Stack:** TypeScript, Vitest, DOM Testing Library, CSS contract tests, Godot 4 GDScript and scenes, Godot/JavaScript bridge contract tests.

## Global Constraints

- Use the verified web export; never launch a Windows Godot executable.
- Preserve audience-led pricing and optional AI price evidence; the game never chooses a student price.
- Never show raw exception messages or internal error codes to students.
- The `01`, `02`, and `03` markers remain labels, not interactive tabs.
- Describe curved words as an editable curved editor path, not physical wrapping in the exported advertisement.
- AIDA receives no production behaviour patch unless a focused reproduction fails.
- Fixture-only `example.invalid`, automatic test login, and fixture prices are not production defects.
- Production, visitor-access controls, and live Supabase remain unchanged.

---

### Task 1: Canonical market-price publication contract

**Files:**
- Modify: `web/src/main.ts`
- Modify: `web/src/export/campaign-exporter.ts`
- Test: `web/src/export/campaign-exporter.test.ts`
- Test: `web/src/main.test.ts`

**Interfaces:**
- Consumes: `priceCents: number` and one Fabric price text object.
- Produces: `accessibleName === "Market price ${formatMarketBucks(priceCents)}"` for create and update paths.

- [ ] **Step 1: Write the failing publication regression**

Create a fixture through the same price-object helper used by `main.ts`, then publish it:

```ts
const price = document.fabricState.objects.find(({ objectId }) => objectId === "price-copy")!;
price.accessibleName = "Market price $24.99";
price.text = "$24.99";
expect(() => exporter.publish(document)).not.toThrow();
```

Also assert that `Selling price $24.99` is rejected by the exporter.

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```powershell
pnpm exec vitest run web/src/export/campaign-exporter.test.ts --no-cache --configLoader runner
```

Expected: FAIL because the editor and exporter use different accessible-name prefixes.

- [ ] **Step 3: Use one canonical helper**

Add and use:

```ts
function marketPriceAccessibleName(label: string): string {
  return `Market price ${label}`;
}
```

Both price-object creation and price updates must call it; exporter validation must require the same result.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run the same Vitest command. Expected: all campaign exporter tests pass.

### Task 2: Safe publication-error mapping

**Files:**
- Modify: `web/src/bridge/creator-public-api.ts`
- Modify: `godot/src/creator/CreatorHost.gd`
- Test: `web/src/bridge/creator-public-api.test.ts`
- Test: `godot/tests/test_creator_host.gd`
- Test: `scripts/godot-bridge-contract.test.mjs`

**Interfaces:**
- Consumes: internal `Error` values from campaign publication.
- Produces: structured developer code plus an application-owned student message; no raw message crosses the visible Godot status boundary.

- [ ] **Step 1: Write failing bridge tests**

Add exact cases:

```ts
expect(response).toMatchObject({
  ok: false,
  error: {
    code: "PUBLICATION_REQUIREMENT",
    message: "Add one visible market price that matches your selected price."
  }
});
expect(JSON.stringify(response)).not.toContain("HANDLER_ERROR");
expect(JSON.stringify(response)).not.toContain("Synthetic secret exception");
```

Unknown exceptions must map to:

```text
The advertisement could not be published. Check the required items, then try again.
```

- [ ] **Step 2: Run the bridge tests and confirm RED**

Run:

```powershell
pnpm exec vitest run web/src/bridge/creator-public-api.test.ts --no-cache --configLoader runner
node --test scripts/godot-bridge-contract.test.mjs
```

Expected: FAIL because `HANDLER_ERROR` and raw error text are returned or rendered.

- [ ] **Step 3: Implement a closed error map**

Add:

```ts
function publicationMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/one visible price|visible price|price evidence/i.test(message)) {
    return "Add one visible market price that matches your selected price.";
  }
  if (/pair|art director|strategist/i.test(message)) {
    return "Both partners must make a recorded contribution before publishing.";
  }
  if (/attention evidence|interest evidence|desire evidence|action evidence/i.test(message)) {
    return "Complete all four AIDA parts before publishing.";
  }
  return "The advertisement could not be published. Check the required items, then try again.";
}
```

Keep raw diagnostics only in the injected developer diagnostic callback. In `CreatorHost.gd`, render only the response message and never concatenate the code.

- [ ] **Step 4: Run TypeScript and bridge tests and confirm GREEN**

Run:

```powershell
pnpm exec vitest run web/src/bridge/creator-public-api.test.ts --no-cache --configLoader runner
node --test scripts/godot-bridge-contract.test.mjs
pnpm typecheck
```

Expected: all pass and no student response contains raw error text.

### Task 3: Stable price-complete state

**Files:**
- Modify: `web/src/product-builder/product-money-panel.ts`
- Modify: `web/src/main.ts`
- Test: `web/src/product-builder/product-money-panel.test.ts`

**Interfaces:**
- Consumes: `ProductMoneyState.priceOnDesign: boolean`.
- Produces: a disabled `Price added to design` action and `data-tone="complete"` status when the valid selected price is already visible.

- [ ] **Step 1: Write the failing component test**

```ts
panel.setState(state({
  pricePosition: "everyday",
  priceCents: 1_200,
  priceOnDesign: true
}));
expect(getByRole(host, "button", { name: "Price added to design" })).toBeDisabled();
expect(getByRole(host, "status").textContent).toBe(
  "Price decision complete: $12.00 is the selected everyday price."
);
expect(getByRole(host, "status").dataset.tone).toBe("complete");
```

- [ ] **Step 2: Run the test and confirm RED**

Run the product-money-panel test. Expected: FAIL because `priceOnDesign` does not exist.

- [ ] **Step 3: Implement the state**

Extend the interface:

```ts
readonly priceOnDesign: boolean;
```

In `main.ts`, derive it from exactly one valid price label object. In `#renderDecision`, render the complete state before guide-range advice.

- [ ] **Step 4: Run the component test and confirm GREEN**

Expected: all product money tests pass, including the audience-led and no-recommendation assertions.

### Task 4: Partner instruction, cloud status, and brief layout

**Files:**
- Modify: `web/src/account/account-bootstrap.ts`
- Modify: `web/src/game/student-copy.ts`
- Modify: `web/src/main.ts`
- Modify: `web/src/ui/editor-shell.ts`
- Modify: `web/src/styles/editor.css`
- Test: `web/src/account/account-bootstrap.test.ts`
- Test: `web/src/game/student-copy.test.ts`
- Test: `web/src/ui/editor-shell.test.ts`
- Test: `web/src/styles/editor-css.test.ts`

**Interfaces:**
- Consumes: cloud sync phase/revision, current partner role/stage, and brief-open state.
- Produces: revision-free status copy, one role-specific next action, and root attribute `data-brief-open="true"`.

- [ ] **Step 1: Write failing tests**

```ts
expect(cloudStatusMessage({ phase: "synced", revision: 17 })).toBe(
  "Saved on this device and cloud."
);
expect(cloudStatusMessage({ phase: "synced", revision: 17 })).not.toContain("17");
```

```ts
expect(nextPairAction("art-director", "sell")).toMatch(/Art Director/);
expect(nextPairAction("art-director", "sell")).not.toBe("Follow the highlighted tool step.");
```

```ts
expect(root.dataset.briefOpen).toBe("true");
expect(collapseButton.hidden).toBe(true);
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run the four listed Vitest files. Expected: failures on numeric revision, vague next action, and overlap state.

- [ ] **Step 3: Implement minimal state-derived behaviour**

Return `Saved on this device and cloud.` for synced state. Add:

```ts
export function nextPairAction(
  role: "art-director" | "strategist",
  phase: CreatorPhase
): string
```

using the existing stage-role prompt’s productive action. Set/remove `data-brief-open` on the editor root, hide the collapse control while open, and restore it and the trigger focus on close.

- [ ] **Step 4: Add CSS contract**

Use:

```css
.campaign-creator[data-brief-open="true"] .studio-tool-drawer__collapse {
  display: none;
}
```

Do not solve the overlap with a higher `z-index`.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Expected: all four test files pass at DOM widths equivalent to 1280 and 1440.

### Task 5: Keyboard focus and semantic game mirror

**Files:**
- Create: `godot/src/main/GameAccessibilityMirror.gd`
- Create: `godot/src/main/GameAccessibilityMirror.gd.uid`
- Modify: `godot/src/main/Main.gd`
- Modify: `godot/src/main/Main.tscn`
- Modify: `godot/web/godot_shell.html`
- Test: `godot/tests/test_game_shell.gd`
- Test: `scripts/godot-bridge-contract.test.mjs`

**Interfaces:**
- Consumes: current eyebrow, heading, clue, and status strings.
- Produces: `window.AdMarketGameA11y.update({ eyebrow, heading, clue, status })`, called only when the four-string signature changes.

- [ ] **Step 1: Write failing static and GDScript tests**

Assert that the shell contains:

```html
<section id="game-a11y" aria-live="polite" aria-atomic="true">
  <p id="game-a11y-eyebrow"></p>
  <h1 id="game-a11y-heading"></h1>
  <p id="game-a11y-clue"></p>
  <p id="game-a11y-status" role="status"></p>
</section>
```

Assert `Main.tscn` contains a non-empty `focus` style for real `Button` controls and visible keyboard copy:

```text
Press Tab to move between controls. Press Enter or Space to use the selected control.
```

- [ ] **Step 2: Run static bridge tests and confirm RED**

Run:

```powershell
node --test scripts/godot-bridge-contract.test.mjs
```

Expected: FAIL because the semantic mirror and Main button focus style are absent.

- [ ] **Step 3: Implement the browser mirror**

`GameAccessibilityMirror.gd` exposes:

```gdscript
func update(eyebrow: String, heading: String, clue: String, status: String) -> void
```

It hashes the four values and calls JavaScript only after the signature changes. The shell’s `update` function assigns `textContent` only; it never inserts HTML.

- [ ] **Step 4: Add visible focus and keyboard guidance**

Add one shared `StyleBoxFlat` focus subresource with a high-contrast border and assign it to each interactive Main `Button`. Leave `01`, `02`, and `03` as `Label` nodes.

- [ ] **Step 5: Run bridge-contract tests and confirm GREEN**

Expected: static tests pass. Native Godot tests remain quarantined and are deferred to the fresh CI web artifact.

### Task 6: Typed room join diagnostics and AIDA falsifier

**Files:**
- Modify: `godot/src/market/MarketHost.gd`
- Modify: `godot/src/main/Main.gd`
- Test: `godot/tests/test_market_host.gd`
- Test: `godot/tests/test_game_shell.gd`
- Test: `web/src/game/aida-playbook-panel.test.ts`

**Interfaces:**
- Consumes: existing market request failure code/message.
- Produces: `room_join_failed(code: String, message: String)` and app-owned invalid-room or temporary-service copy.

- [ ] **Step 1: Add the AIDA reproduction test before changing behaviour**

Reproduce the report’s sequence: select Attention, complete its one action, select Interest, and inspect the selected state and next-action enablement.

```ts
expect(attentionButton.getAttribute("aria-pressed")).toBe("false");
expect(interestButton.getAttribute("aria-pressed")).toBe("true");
expect(nextAction.disabled).toBe(false);
```

- [ ] **Step 2: Run the AIDA test**

Run the single AIDA test file.

Expected stopping rule:

```text
PASS => record the production-defect hypothesis as ruled out; make no AIDA behaviour patch.
FAIL on selected state => implement only the smallest state fix and rerun this test.
```

- [ ] **Step 3: Write failing room-diagnostic tests**

Assert:

```gdscript
assert_eq(message_for_room_failure("ROOM_NOT_FOUND"), "The room code was not found. Check the code and try again.")
assert_eq(message_for_room_failure("NETWORK_UNAVAILABLE"), "The live market is temporarily unavailable. Check the connection and try again.")
```

- [ ] **Step 4: Implement typed signal and closed mapping**

Emit the original typed code separately from the internal message. `Main.gd` maps known not-found/invalid codes to the room-code message and all transport/service codes to the temporary-service message. It never interpolates the raw backend message.

- [ ] **Step 5: Run proportional verification**

Run:

```powershell
pnpm exec vitest run web/src/game/aida-playbook-panel.test.ts --no-cache --configLoader runner
node --test scripts/godot-bridge-contract.test.mjs
pnpm typecheck
git diff --check
```

Expected: all executable local checks pass; Godot behaviour is verified later through the CI-generated web artifact.

- [ ] **Step 6: Commit**

```powershell
git add web/src godot/src godot/web godot/tests scripts/godot-bridge-contract.test.mjs
git commit -m "fix(playtest): correct publishing and interface feedback"
```
