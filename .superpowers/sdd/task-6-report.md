# Task 6 Report: Masked Realistic Recolouring and Material Variants

## Outcome

`DONE_WITH_CONCERNS`

Task 6 implements deterministic masked recolouring, eight local data-only material profiles, SHA-256 variant identity, a lease-aware 48-entry LRU object-URL cache, a narrow same-origin `blob:` raster allowance, and diagnostic fixtures for drinkware, footwear, electronics, and packaging.

## Files

- `web/src/tools/masked-variant-renderer.ts`
- `web/src/tools/masked-variant-renderer.test.ts`
- `web/src/tools/material-presets.ts`
- `web/src/tools/variant-cache.ts`
- `web/src/tools/variant-cache.test.ts`
- `web/src/fabric/object-factory.ts`
- `web/src/fabric/object-factory.test.ts`
- `web/tests/manual/recolouring-diagnostic.html`
- `web/tests/manual/recolouring-diagnostic.ts`
- `.superpowers/sdd/task-6-report.md`

## RED evidence

The original Task 6 handoff recorded RED for the missing renderer/cache modules and for the prior HTTP(S)-only raster guard. The initial Git state also showed the renderer, cache, presets, and their tests as new relative to the pre-Task-6 baseline. RED was not replayed by deleting working implementation; this report distinguishes that inherited evidence from the fresh verification below.

The bounded self-review found one Important LRU regression after the initial implementation: replacing an entry with `Map.set(existingKey)` left it at the oldest insertion position. The added regression test failed with the new replacement evicted (`blob:variant-49`) instead of the next true LRU (`blob:variant-2`). Deleting the existing key immediately before the successful replacement insert made the test pass while preserving the old entry on validation or URL-creation failure.

## Fresh verification

The standalone `pnpm` shim was unavailable, so the same repository scripts were run through `npm.cmd` against the existing dependency tree:

```text
npm.cmd run test:unit -- web/src/tools/masked-variant-renderer.test.ts web/src/tools/variant-cache.test.ts web/src/fabric/object-factory.test.ts
  3 files / 41 tests passed

npm.cmd run test:unit
  15 files / 86 tests passed

npm.cmd run typecheck
  exit 0, no TypeScript errors

npm.cmd run build:studio
  exit 0, Vite 8.1.4 built studio.js and studio.css in 121 ms
```

Native Godot and Playwright were not run.

## Bounded self-review

No remaining Critical or Important Task 6 defect was found after the review fixes. Coverage now checks:

- real 4x4 pixel output, exact master alpha, luminance/highlight preservation, and four-zone independence;
- authoritative deterministic texture pixels decoded from each preset's local `textureUrl`;
- exactly eight deterministic presets without remote dependencies;
- nonempty `image/png` validation at renderer and cache boundaries;
- canonical asset/version/style SHA-256 in lowercase hexadecimal;
- same-key render deduplication, failure retry, and out-of-order completion;
- exact 48-entry LRU behavior with lease-aware, exactly-once revocation;
- replacement failure preserving the prior cached entry;
- rejection of opaque `blob:null`, cross-origin blob, data, and file raster URLs; and
- browser diagnostic records for drinkware, footwear, electronics, and packaging.

## Commit

This report and the Task 6 patch are committed with `feat: add masked material recolouring`; the final hash is recorded in the handoff.

## Concern

The updated browser diagnostic was not rerun in this bounded handoff. The controller should execute `web/tests/manual/recolouring-diagnostic.html` in the in-app browser and confirm `window.__RECOLOURING_DIAGNOSTIC__.status === "pass"` for the final rendered-pixel check.
