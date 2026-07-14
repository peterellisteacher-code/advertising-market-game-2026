# Artwork Text Refit

**Goal:** Make nested text return to its appropriate readable size after a long-to-short edit instead of retaining the smallest historical scale.

**Architecture:** Treat nested text as auto-fit content until manual artwork transforms exist. Derive a fresh absolute uniform scale from the Textbox's unscaled dimensions after every actual text change. Share the factory's existing 640×360 cap, then intersect it with the 82% product-surface cap. Keep shape/image fitting shrink-only and add no transient or serialized baseline property.

## Task 1: History-independent text auto-fit

**Files:**

- Modify: `web/src/fabric/fabric-canvas-adapter.ts`
- Modify: `web/src/fabric/fabric-canvas-adapter.test.ts`
- Modify: `web/src/fabric/object-factory.ts`
- Modify: `web/src/fabric/object-factory.test.ts`

### 1. Write the failing regression

Add short artwork text, record its fitted scale, edit it to content that must shrink, then edit back to the original short text. Prove:

- the long version fits inside 82% of the surface;
- the returned short version regains its original fitted scale within floating-point tolerance;
- direct long-text placement and short-to-long editing produce the same scale;
- after a Fabric serialization round trip, editing back to short text produces the same direct-short scale;
- centre, angle, flip state, product geometry, clip path, and top-level identity remain unchanged;
- each actual edit emits exactly one parent mutation;
- setting the existing value remains a mutation-free no-op.

Record the genuine focused RED result before production edits.

### 2. Implement the minimum text-only change

- Keep the no-op guard before mutation.
- Export/share the existing text cap constants and a pure absolute-fit calculation based on unscaled Textbox dimensions.
- Keep `FabricObjectFactory.createText()` on that same calculation.
- Use Fabric's `Textbox.set("text", value)` dimension refresh; remove the redundant explicit `initDimensions()` call.
- Set only the edited Textbox to the calculated positive uniform scale, preserving angle and flip flags.
- Intersect the 640×360 factory cap with the 82% surface cap.
- Do not alter shapes, rasters, general top-level text, or serialization contracts.

### 3. Verify

Run the focused adapter and object-factory tests, TypeScript `--noEmit`, full Vitest, and `git diff --check`. Commit only the four scoped files.

## Acceptance criteria

- Text scale depends on current content and surface bounds, not edit history.
- Short text can regrow but never beyond natural unit scale, the 640×360 factory cap, or the 82% surface bound.
- No-op edits remain event-free.
- No new custom property, schema, UI, transform, catalogue, persistence, or export contract is introduced.
