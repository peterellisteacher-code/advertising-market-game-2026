# Task 7 Report: Revisioned Draft Persistence and Clean PNG Publication

## Outcome

`DONE`

Task 7 adds immutable revisioned IndexedDB storage, explicit schema-zero migration, durable local-Blob rehydration, authoritative Price/AIDA evidence, clean 1600×900 PNG publication, and a guarded real-reload browser diagnostic.

## Files

- `web/src/persistence/draft-store.ts`
- `web/src/persistence/draft-migrations.ts`
- `web/src/persistence/draft-store.test.ts`
- `web/src/checklist/checklist-store.ts`
- `web/src/checklist/checklist-store.test.ts`
- `web/src/export/campaign-exporter.ts`
- `web/src/export/campaign-exporter.test.ts`
- `web/src/fabric/canvas-port.ts`
- `web/src/fabric/fabric-canvas-adapter.ts`
- `web/src/fabric/fabric-canvas-adapter.test.ts`
- `web/src/fabric/fabric-custom-properties.ts`
- `web/src/fabric/fabric-custom-properties.test.ts`
- `web/src/fabric/object-command-service.test.ts`
- `web/tests/manual/persistence-publish-diagnostic.html`
- `web/tests/manual/persistence-publish-diagnostic.ts`
- `.superpowers/sdd/task-7-report.md`

The narrow Fabric files are Task 7 publication support: `CanvasPort.exportCleanPngDataUrl()` owns selection/guide suppression and `editorGuide` is the explicit guide marker. `campaign-exporter.ts` remains Fabric-free.

## RED evidence

The required three tests were created before production modules. The first focused run through the repository's pinned pnpm runtime failed only because the three modules were absent:

```text
3 failed suites / 0 Task 7 tests collected
Failed imports: draft-migrations, checklist-store, campaign-exporter
Existing suite: 86 tests passed
```

Adapter-first RED then failed for the missing clean-export method twice (success and failure paths) and missing serialised `editorGuide` once.

The bounded code review found three Important gaps and each received a focused failing regression before its fix:

```text
2 files: 3 failed / 28 passed
- rehydrated revision resave retained an ephemeral blob URL
- asset references were not validated
- actual canvas snapshot was not validated/reconciled
```

## GREEN evidence

The standalone `pnpm` command is absent from PATH, and the aggregate `pnpm build` script therefore cannot resolve its nested bare `pnpm` call. The exact constituent commands were run directly through the repository's pinned pnpm/Vitest runtime:

```text
Focused Task 7 tests
  3 files / 36 tests passed

Full unit suite
  18 files / 124 tests passed

TypeScript
  tsc --noEmit: exit 0

Production bundle
  Vite 8.1.4: exit 0
  studio.css 0.82 kB; studio.js 2.71 kB
```

Native Godot, Godot headless/editor/MCP, and Playwright were not launched.

## Persistence, migration and transaction evidence

- One database owns `documents` and `blobs`; keys are `[documentId, revision]` and `[documentId, revision, blobKey]`.
- Every save uses one `readwrite` transaction spanning both stores and resolves only on transaction `complete`.
- Caller input supplies the exact revision. Revision zero is the initial record; later revisions must be strictly newer. Inputs are never incremented or mutated.
- A forced blob-write failure proves the queued document write is rolled back atomically.
- Latest committed revision is loaded by document ID. Documents, Maps and Blobs are fresh values; MIME type and bytes round-trip exactly.
- Identical blob keys remain isolated across documents and revisions.
- Local assets use `{ kind: "local-blob", objectId, blobKey, mimeType }`. Saves normalise ephemeral object URLs back to durable `local-blob:` sources.
- Rehydration deep-clones the document, creates fresh owned object URLs from stored Blobs, rewrites only referenced Fabric sources, and returns an idempotent release function.
- The SHA-256 durable hash sorts JSON keys and normalises rehydrated sources back to their blob keys.
- Schema zero is explicitly the otherwise-current record with optional `drawingLayers`, missing reserved brief arrays, and optional `evidence.price`; defaults are applied to a structured clone. Unknown/future schemas are rejected and the source fixture remains unchanged.

## Checklist and publication evidence

- `CampaignDocument.evidence` is the sole Price/AIDA truth. Assignments deduplicate IDs, reject missing or duplicate Fabric object IDs, and never tag Fabric objects.
- Completion exposes text plus `✓`/`○`, so state is not colour-only.
- Publication parses the schema, accepts price zero, rejects null price, requires all five Price/AIDA slots, and validates evidence plus asset-reference IDs.
- Local-blob references require `objectId`, `blobKey` and `mimeType`.
- Both the document and the actual guide-filtered canvas snapshot are validated for unique IDs, references and raster sources, then reconciled before export.
- Raster sources are limited to same-origin HTTP(S) and same-origin object URLs in the injected owned-URL set. External, data, opaque `blob:null` and unowned blob sources are rejected before rendering.
- The Fabric adapter snapshots active selection, guide visibility and guide order, hides them, calls `toDataURL({ format: "png", multiplier: 1 })`, and restores exact editor state in `finally` on success and failure.
- Export validates PNG signature, IHDR and exact 1600×900 dimensions, preserves document/canvas serialisation, and returns the exact `published-campaign@1` metadata contract.

## Browser status

`web/tests/manual/persistence-publish-diagnostic.html` is ready for the controller's real Chromium run. It:

1. clears only `task-7-persistence-publish-diagnostic`;
2. creates text, transforms, crop, drawing and a local masked-product Blob;
3. saves revision zero and records durable hash, Blob bytes and editable object count;
4. performs one guarded `window.location.reload()`;
5. loads, verifies exact bytes/hash/count, creates a fresh owned URL and reconstructs Fabric;
6. edits the reloaded text/transform, publishes, verifies restored selection/guide order;
7. validates PNG signature/IHDR and samples a white pixel where a magenta guide would have leaked;
8. releases owned URLs and clears only its own diagnostic database.

## Final real-browser verification

The controller served the exact committed Task 7 tree with Vite 8.1.4 at `http://127.0.0.1:4179/web/tests/manual/persistence-publish-diagnostic.html`. The Chromium page performed its guarded reload and reported `data-persistence-publish="pass"`:

```text
Reloaded 5 editable objects; canonical hash, Blob bytes and clean 1600×900 PNG passed
```

The final preview decoded at `1600×900`; the page proved a fresh owned Blob URL, exact persisted bytes, equal durable hash/object count, a working post-reload text/transform edit, restored active selection and guide order, PNG signature/IHDR, and a white guide-probe pixel. Browser warning/error logs were empty. Screenshots showed the editable canvas with its restored controls/guide and the separate clean PNG without either. The tab and exact Vite listener were closed.

## Bounded self-review

The read-only review found no Critical issues. Its three Important findings—durable-source normalisation on edited resave, actual-canvas validation/reconciliation, and asset-reference validation—were fixed with the three RED→GREEN regressions recorded above. No remaining Critical or Important defect was found in the bounded follow-up check.

## Commit

The Task 7 patch and this report are committed with `feat: persist and publish campaigns`; the final hash is recorded in the handoff.

## Concerns

- None for Task 7. The aggregate package `build` convenience script still depends on a globally resolvable nested `pnpm`; its exact pinned typecheck, full-test and Vite-build constituents all pass and Task 8 owns export assembly.

## Review-fix RED/GREEN evidence — 2026-07-12

The Important/Minor follow-up findings received focused regressions before production changes. The first two-file run at `01d8b85` failed in the expected ways:

```text
2 files failed; 12 tests failed / 33 passed
- accepted truncated 24-byte and 32-byte pseudo-PNGs
- accepted whitespace, missing padding and non-zero pad bits in base64
- reported invalid-signature rather than canonical-base64 rejection for URL-safe, junk and excess-padding payloads
- blocked IndexedDB open timed out instead of rejecting
- paired request-error/transaction-abort produced an unhandled rejection
- synchronous cursor processing timed out instead of rejecting
- non-ASCII canonical hash used locale collation rather than UTF-16 code-unit order
```

Minimal fixes then:

- require the exact PNG data-URL prefix and canonical base64 grammar/round-trip;
- require at least 33 decoded bytes before reading the complete first PNG chunk, with exact signature, 13-byte `IHDR`, and 1600×900 dimensions;
- reject `blocked` opens immediately and close a database delivered by any later `success` event;
- attach transaction completion before requests, consume read/completion together, and abort/reject on synchronous cursor/blob callback exceptions;
- replace both persistence-hash and export-reconciliation locale sorts with deterministic UTF-16 code-unit comparison.

The first GREEN attempt passed 44/45 focused tests and exposed the second locale-dependent sorter in persistence; after the same minimal comparator fix, fresh verification was:

```text
Focused persistence/export: 2 files / 45 tests passed
Full unit suite: 18 files / 138 tests passed (the original 124 plus 14 regressions)
TypeScript: tsc --noEmit, exit 0
Production bundle: Vite 8.1.4, exit 0
  studio.css 0.82 kB; studio.js 2.71 kB
```

No Godot, server, browser, Playwright or manual diagnostic was launched for this review fix. The requested Vite build overwrote only the two retained generated outputs in `build/studio`; `emptyOutDir` remained false and no other generated entry was removed.

The review fix is committed separately as `fix: harden campaign persistence and PNG validation`; its hash is recorded in the handoff.
