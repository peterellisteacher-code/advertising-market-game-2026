# Artwork Text Refit

**Goal:** Make nested text return to its appropriate readable size after a long-to-short edit instead of retaining the smallest historical scale.

**Architecture:** Treat nested text as auto-fit content until manual artwork transforms exist. On an actual text change, let Fabric 7.4 recalculate Textbox dimensions, restore the text object to natural unit scale, then run the existing 82% surface fit. Keep shape/image fitting shrink-only. Do not add transient or serialized baseline properties.

## Task 1: History-independent text auto-fit

**Files:**

- Modify: `web/src/fabric/fabric-canvas-adapter.ts`
- Modify: `web/src/fabric/fabric-canvas-adapter.test.ts`

### 1. Write the failing regression

Add short artwork text, record its fitted scale, edit it to content that must shrink, then edit back to the original short text. Prove:

- the long version fits inside 82% of the surface;
- the returned short version regains its original fitted scale within floating-point tolerance;
- centre, angle, flip state, product geometry, clip path, and top-level identity remain unchanged;
- each actual edit emits exactly one parent mutation;
- setting the existing value remains a mutation-free no-op.

Record the genuine focused RED result before production edits.

### 2. Implement the minimum text-only change

- Keep the no-op guard before mutation.
- Use Fabric's `Textbox.set("text", value)` dimension refresh; remove the redundant explicit `initDimensions()` call.
- Reset only the edited Textbox to natural positive unit scale, preserving angle and flip flags.
- Apply the existing surface-fit helper once.
- Do not alter shapes, rasters, general top-level text, or serialization contracts.

### 3. Verify

Run the focused adapter tests, TypeScript `--noEmit`, full Vitest, and `git diff --check`. Commit only the two scoped files.

## Acceptance criteria

- Text scale depends on current content and surface bounds, not edit history.
- Short text can regrow but never beyond natural unit scale or the 82% surface bound.
- No-op edits remain event-free.
- No new custom property, schema, UI, transform, catalogue, persistence, or export contract is introduced.
