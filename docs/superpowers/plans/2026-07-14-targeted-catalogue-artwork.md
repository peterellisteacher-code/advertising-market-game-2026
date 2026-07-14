# Targeted Catalogue Artwork Transaction

**Goal:** Place an offline-pack or live catalogue image into a named product artwork surface and commit child-scoped catalogue/blob references atomically.

**Architecture:** Extend `CataloguePlacementQueue` additively with a surface-addressed enqueue method. Reuse the existing URL, live-fetch, MIME, size, blob, attribution, and queue rules. Place through `ObjectCommandService.addArtworkRaster`, reconcile the nested child through the recursive semantic map and its exact raw-tree ancestry, and roll back through `removeArtwork`. Existing top-level `enqueue(asset)` remains unchanged.

## Task 1: Nested catalogue placement

**Files:**

- Modify: `web/src/catalogue/catalogue-runtime.ts`
- Modify: `web/src/catalogue/catalogue-runtime.test.ts`

### 1. Write failing transaction tests

Prove:

- offline artwork placement adds one nested semantic image and one child-scoped catalogue reference;
- live Openverse placement adds child-scoped catalogue and local-blob references and passes the blob to the host;
- reconciliation requires the requested root product, direct named artwork-slot parent, child ID, image kind, and matching asset ID;
- a duplicate generated ID is rejected before Fabric mutation;
- reconciliation or commit failure removes only the attempted child and preserves the product;
- failed live placement revokes the newly created object URL;
- the asset and address are cloned at enqueue time;
- existing top-level catalogue placement remains unchanged.

Record genuine focused RED failures before production edits.

### 2. Implement the minimum additive API

- Add `enqueueArtworkRaster(address: ArtworkSurfaceAddress, asset: CatalogAssetV1): void`.
- Clone both arguments before queueing.
- Preflight the generated child ID against `campaignSemanticObjectMap(current.fabricState)`.
- Reuse the existing live capture and offline URL path.
- Add through `ObjectCommandService.addArtworkRaster(address, ...)`.
- Reconcile the serialized child through `campaignSemanticObjectMap` and its `path`:
  - the path's root is the requested semantic product shell;
  - the immediate raw parent is `productLayer: "artwork-slot"` with the requested `artworkSlotId`;
  - the child is the generated semantic image with the matching asset ID.
- Append catalogue and optional local-blob references with the child ID.
- Parse and commit the document.
- On failure after insertion, call `removeArtwork(address, childId)` and revoke any new live URL. Preserve the original failure.

### 3. Verify

Run catalogue-runtime tests, TypeScript `--noEmit`, full Vitest, and `git diff --check`. Commit only the two scoped files.

## Acceptance criteria

- Targeted placement never calls top-level `remove(productId)` or reloads a canvas snapshot.
- Product identity, geometry, clipping, and top-level count are stable.
- All asset references target the nested child ID.
- Existing top-level catalogue behavior is unchanged.
- No UI, editor mode, document schema, persistence, exporter, bridge, or deployment change is introduced.
