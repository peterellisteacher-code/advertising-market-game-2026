# Recursive Artwork Draft Persistence

**Goal:** Preserve local raster artwork nested inside product shells across save, load, rehydration, canonical hashing, and resave.

**Architecture:** Replace the draft store's private top-level object map with the shared recursive semantic-object map. Mutate only the resolved semantic object's serialized record. Keep the document schema, IndexedDB version, blob-reference contract, and URL ownership lifecycle unchanged.

## Task 1: Recursive local-blob normalisation and rehydration

**Files:**

- Modify: `web/src/persistence/draft-store.ts`
- Modify: `web/src/persistence/draft-store.test.ts`

### 1. Write failing integration coverage

Build a valid fixture with a semantic product-shell parent, a decorative artwork-slot group, and a nested semantic image that owns a local-blob reference. Exercise save -> load -> rehydrate -> resave and prove:

- save stores `local-blob:<blobKey>` on the nested image;
- load preserves that durable sentinel;
- rehydration applies a fresh owned object URL to the nested image;
- the caller document is not mutated;
- canonical durable hashes before and after rehydration match;
- resave restores the durable sentinel;
- release remains idempotent and revokes the owned URL once.

Run only draft-store tests and record the genuine RED failure.

### 2. Implement the minimum map change

- Import `campaignSemanticObjectMap`.
- Delete the private root-only `objectMap` helper.
- Resolve local-blob references through the recursive semantic map in normalisation and rehydration.
- Mutate `entry.object.src`, not the collector wrapper.
- Preserve all current error messages and blob/MIME/URL lifecycle rules.

### 3. Verify

Run focused draft-store tests, TypeScript `--noEmit`, the full Vitest suite, and `git diff --check`. Commit only the two scoped files.

## Acceptance criteria

- Nested and top-level semantic rasters have identical durable-blob behaviour.
- Decorative children and clip paths cannot satisfy semantic object references.
- Existing documents require no schema or IndexedDB migration.
- No catalogue routing, exporter, editor-mode, UI, or asset-reference contract changes are introduced.
