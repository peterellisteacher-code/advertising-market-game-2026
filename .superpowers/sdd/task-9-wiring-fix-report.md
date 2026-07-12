# Task 9 wiring fix report

## Scope delivered

- Added a fail-closed optional offline catalogue loader. An absent root URL performs no fetch; catalogue and asset-byte URLs must remain same-origin under `/catalog/`; malformed records, duplicate IDs and external byte URLs produce an empty pack.
- Added a thin catalogue runtime around the existing `CatalogueIndex`, `CataloguePanel` and `OpenverseClient`. Core results paint synchronously. Live photos start disabled, wait for the explicit checkbox, debounce input by 250 ms, reject stale generations and leave filtered core results intact on failure/offline state.
- Added a serialized placement queue. Picks use `ObjectCommandService.addRaster`, reconcile the serialized Fabric object, append a durable `kind: "catalog"` reference with asset version and attribution, and remove the Fabric object if reconciliation fails.
- Made all five existing bridge operations drain the placement queue without changing the frozen one-method `window.AdMarketCreator` API.
- Added publication checks for catalogue reference/object/asset agreement and canonical, safe attribution. Publication metadata retains the references.
- Added an idempotent optional `data-offline-catalogue-url` build injection. The attribute is absent when the offline core does not exist.
- Added bounded, scrollable catalogue styling. No pair roles, phases, prices, unlocks or other Task 12 flow was added.

## TDD evidence

The first focused run failed for the intended missing behaviour:

- `catalogue-store.test.ts` and `catalogue-runtime.test.ts`: missing modules;
- `editor-shell.test.ts`: missing unchecked live-photo control;
- `main.test.ts`: no mounted catalogue tile;
- `campaign-exporter.test.ts`: mismatched catalogue references were accepted;
- `build-web.test.mjs`: missing offline-catalogue injection helper.

The follow-up hardening tests also failed before implementation: fast input issued four live calls; disable/destroy did not cancel work; unsafe attribution URLs published.

## Verification

- Focused Vitest: **5 files, 54 tests passed**.
- Debounce/export hardening Vitest: **2 files, 36 tests passed**.
- Build-web Node tests: **5 passed**.
- `pnpm typecheck`: **passed**.
- `pnpm build:studio`: **passed**, 103 modules transformed.
- `pnpm build:web`: **passed**, `OFFLINE_CORE_DEFERRED` and `WEB_EXPORT_ASSEMBLED_NON_DESTRUCTIVE`.
- `pnpm verify:export`: **passed** with the pre-existing `PCK_STALE_SPIKE_EXPORT` warning and `WEB_EXPORT_STATIC_VERIFICATION_OK`.
- Native Godot and live network were not invoked.

## Known limits

- The Task 11 offline core does not yet exist, so the production build correctly omits its data attribute and reports `OFFLINE_CORE_DEFERRED`.
- The PCK remains the quarantined historical spike export; this pass verifies the TypeScript/browser layer, not a newly exported Godot-to-browser integration.
- No live Openverse request was made; route/client behavior is covered by mocked tests owned by the parallel Task 9 runtime pass.

## Rereview correction

The follow-up production review identified that a direct proxy URL would not survive a later offline session. The corrected placement flow now captures canonical full Openverse bytes with an eight-second signal, 12 MB streamed limit and strict PNG/JPEG/WebP MIME allowlist. It places an owned object URL, persists both catalogue-attribution and local-blob references, and gives the blob to the existing draft store. Replacement, close and every rollback path revoke newly owned URLs.

Additional corrections make the optional classroom-pack load independent of editor startup, add `replaceCore`, apply a five-second catalogue-load signal, deduplicate live IDs through the production merge helper, and reject noncanonical direct Openverse proxy sources or blob-backed catalogue photos without both durable references.

Rereview TDD evidence:

- RED: 11 focused failures covering duplicate live results, missing `replaceCore`, absent capture fetch/MIME/size/revoke behavior, absent loader signal, unsafe direct proxy variants, missing blob dual-reference enforcement, stalled-core controls and missing saved local bytes.
- GREEN: **4 files, 64 tests passed** and `pnpm typecheck` passed.
- Offline continuity was verified as live search → captured placement → save → close/revoke → reopen from stored bytes with fetch forced to reject.
