# Targeted Artwork Removal Kernel

**Goal:** Remove one direct semantic child from a named product artwork surface while preserving the product shell, clip, geometry, selection boundary, and parent-only mutation contract.

**Architecture:** Add a surface-addressed removal primitive to `CanvasPort`, route it through `ObjectCommandService`, and implement it with `Group.remove()` on the strict artwork surface. This is infrastructure for catalogue rollback and later user deletion; document references, blobs, and UI remain separate transactions.

## Task 1: Surface-scoped removal

**Files:**

- Modify: `web/src/fabric/canvas-port.ts`
- Modify: `web/src/fabric/object-command-service.ts`
- Modify: `web/src/fabric/fabric-canvas-adapter.ts`
- Modify: `web/src/fabric/object-command-service.test.ts`
- Modify: `web/src/fabric/fabric-canvas-adapter.test.ts`
- Modify: `web/src/catalogue/catalogue-runtime.test.ts` only for required fail-fast test-double conformance

### 1. Write failing tests

Prove that:

- the command service validates address and child ID, routes one removal, and reselects the product;
- the adapter removes only the matching direct semantic child from the named surface;
- one top-level product remains, with unchanged geometry, clip path, layout strategy, and product identity;
- exactly one parent `modified` event is emitted;
- a missing product, slot, child, or structural/decorative target leaves serialization, selection, and events unchanged.

Record the genuine focused RED failures before production edits.

### 2. Implement the minimum API

- Add `removeArtwork(address, childId): void` to `CanvasPort`.
- Add the validated command-service method and parent reselection.
- Resolve the strict product/surface context in the adapter.
- Require a direct semantic child with matching `objectId`, supported `elementKind`, and non-empty `accessibleName`.
- Remove with `surface.remove(child)` and finish through the existing parent mutation helper.
- Add only the necessary fail-fast test-double method.

### 3. Verify

Run the two focused Fabric test files plus catalogue runtime compile coverage, TypeScript `--noEmit`, full Vitest, and `git diff --check`. Commit only the six scoped files.

## Acceptance criteria

- Removal can never call top-level `canvas.remove(product)`.
- Missing/invalid targets are mutation-free.
- Product geometry and clipping remain stable.
- Successful removal emits one parent mutation and selects the product.
- No document reference cleanup, blob revocation, catalogue placement, edit mode, UI, schema, or export changes are introduced.
