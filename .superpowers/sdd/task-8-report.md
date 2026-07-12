# Task 8 report

## Task 8A — production Creator web contract

### RED

- `creator-public-api.test.ts` first failed because `./contracts` did not exist.
- The adapted `main.test.ts` then failed because production still exposed only `AdMarketCreatorSpike`.
- A JSON-safety regression failed while a typed array outside the publication field was still accepted.

### GREEN

- `window.AdMarketCreator` is frozen and owns only `handle(requestJson): Promise<string>`.
- The strict `creator-bridge@1` boundary handles `open`, `getState`, `save`, `publish`, and `close`, and serialises all success and error responses.
- Publication bytes cross the boundary only as canonical `pngBase64`; non-JSON runtime values are rejected.
- `main.ts` now uses real campaign parsing, current canvas state, `IndexedDbDraftStore`, `CampaignExporter`, a lazy Fabric adapter, inert/focus transitions, and the private `ad-market-creator:return-to-game` DOM event.
- Focused tests: 2 files, 7 tests passed. Full Vitest: 19 files, 144 tests passed. TypeScript: passed with no errors.

### Limitations

- This is Task 8A only. No Godot code, browser/server flow, or Web export assembly was run.
- The editor currently owns an empty blob map/set; later UI integration must register local blob assets before drafts containing them can save or publish.
- `pnpm`/Corepack was not executable in the sandboxed PowerShell environment, so verification used the repository-pinned Vitest and TypeScript entry points directly.

## Task 8B — Godot bridge and non-destructive Web assembly

### RED

- `node --test scripts/build-web.test.mjs` first failed with `ERR_MODULE_NOT_FOUND` for the not-yet-created `scripts/build-web.mjs`.
- `godot/tests/test_creator_bridge.gd` was authored before the GDScript implementation, but was deliberately not executed because native Godot, headless/editor/export paths, Godot MCP, browsers, and servers remained quarantined.

### GREEN

- `CreatorBridge.gd` now sends one `creator-bridge@1` JSON request per operation with unique IDs, routes retained asynchronous Promise callbacks, verifies response IDs/contracts, bounds pending/completed state, and rejects duplicate, stale, mismatched, malformed, and invalid-document responses.
- `CampaignDocument.gd` performs a deliberately partial bridge-shape check; the TypeScript Zod schema remains authoritative for the full nested document.
- `WebCreatorTransport.gd` gates all JavaScript access behind `OS.has_feature("web")`, uses `window.AdMarketCreator.handle(requestJson)`, retains `then`/`catch` callbacks until settlement, returns deterministic unavailable responses, and relays the private return-to-game DOM event. Focus/process restoration occurs only after a valid close response.
- `build-web.mjs` copies fixed studio assets into `build/web/studio`, canonicalises exactly one local CSS/JS reference, rejects unresolved Godot shell tokens, never clears the export directory, and defers the Task 11 offline core when absent. Two consecutive runs produced identical hashes.
- `verify-web-export.mjs` passed the static export checks for required Godot/studio files, local/no-iframe/no-legacy output, one production global, no-thread preset/runtime/audio evidence, and reported the known `PCK_STALE_SPIKE_EXPORT` hash non-fatally.
- Evidence: Node built-in tests 4/4 passed; Vitest 19 files/144 tests passed; TypeScript passed; Vite studio build passed; `build:web` passed twice; `--require-offline-core` failed closed with exit 1; static export verification passed.

### Limitations

- GDScript tests were **NOT EXECUTED** under the explicit Godot quarantine.
- The current PCK hash is `e8b1d3f2729a16f0d001f8b1483aa4fbc150dcb1b3411b5aacd7456b6cb92459`, so the verifier reports `PCK_STALE_SPIKE_EXPORT`; a later approved Godot export must refresh it.
- Offline core `catalog/generated/offline-core-v1/catalog.json` is absent and correctly reported as deferred; no placeholder was created.
- Verification is static assembly/contract evidence only. No end-to-end Godot-to-browser bridge claim is made.

## Task 8 review-fix pass — hardened bridge contracts

### RED

- The new static Node canvas-contract test failed 0/1 against the stale 960 by 540 Godot validator and `Main.gd` document.
- Focused Vitest failed 8 cases across the bridge API and browser main: wrong literal contracts returned `INVALID_REQUEST`; local blobs were neither loaded nor rehydrated; missing or mismatched stored data opened successfully; URL ownership/lifecycle was absent; save timestamps did not advance; and a second save retried revision 0.
- A later same-ID/same-revision state-consistency regression failed 1/11 before the canonical durable-document comparison was added.
- GDScript publication, numeric-JSON and strict error-envelope assertions were authored before their implementation and were not executed under the Godot quarantine.

### GREEN

- All Godot bridge documents, validators and fixtures now use the exact 1600 by 900 canvas. The static test is wired into `test:build-web` and the normal `build` script.
- `CreatorBridge.gd` validates successful `published-campaign@1` payloads before completion: document identity, JSON-safe integral revision and price numbers, canonical base64, PNG signature, and the required metadata container types. Invalid error envelopes now become `INVALID_RESPONSE`.
- Browser open loads the exact persisted local-blob revision, compares its canonical durable state with the request, rehydrates real Blob bodies internally, transfers only owned object URLs to publication, and revokes replacement/failure/close URLs at the safe lifecycle points. Blob values never enter the JSON bridge.
- Browser save reads the latest stored revision, advances repeated saves strictly, emits a strictly later timestamp, retains real internal blobs, and exposes the latest saved revision through `getState`.
- Wrong literal browser contracts now return `UNSUPPORTED_CONTRACT` with the canonical response contract and recovered request ID. Main/API tests cover storage and exporter failure propagation.
- Evidence: Node tests 5/5 passed; focused Vitest 2 files/16 tests passed; full Vitest 19 files/153 tests passed; TypeScript passed; Vite built 96 modules; `build:web` passed twice with identical hashes across 11 files; static export verification returned `WEB_EXPORT_STATIC_VERIFICATION_OK`.
- Process check returned `NO_GODOT_OR_WERFAULT_PROCESSES`. No native Godot, Godot MCP, browser, or server was launched.

### Deliberately unchanged limitations

- GDScript tests remain authored but unexecuted under quarantine.
- Static verification still reports the known `PCK_STALE_SPIKE_EXPORT` marker.
- Task 11 offline core remains absent and `build:web` continues to report `OFFLINE_CORE_DEFERRED`; neither item was in this review-fix scope.

## Task 8 second review-fix pass — publication identity and cleanup

### RED

- The safe-integer static Node regression failed 1/2 because the Godot validator had no JavaScript `Number.MAX_SAFE_INTEGER` equivalent.
- Focused browser tests failed 2/13: an initial Fabric load failure left the newly created runtime cached and undisposed, while an adapter disposal exception aborted close before canvas disposal, URL revocation, UI restoration and focus restoration.
- GDScript assertions for active campaign identity, mismatched publication identity, truncated/invalid IHDR PNGs, wrong dimensions and oversized JSON numbers were authored before implementation and were not executed under quarantine.

### GREEN

- `CreatorBridge.gd` now stores structured pending request context, activates a document identity only after valid open success, retains it across failures, clears it only on the matching valid close success, and rejects publication without the matching active identity.
- Publication PNG validation now requires at least 33 bytes, the PNG signature, a 13-byte IHDR length, the IHDR chunk type, and big-endian 1600 by 900 dimensions.
- Godot JSON integer-number validation now accepts finite integral floats but caps both integer and float values at `9007199254740991`.
- Browser initial-load failure now releases newly hydrated URLs, evicts and disposes only the newly created runtime, and preserves a pre-existing working runtime on replacement-load failure.
- Browser close now records the first useful cleanup error while still attempting snapshot, adapter and canvas disposal, URL release, internal collection clearing, hidden/inert restoration and game-canvas focus. The public boundary returns the cleanup failure as `HANDLER_ERROR` after cleanup completes.
- Evidence: Node tests 6/6 passed; focused Vitest 2 files/18 tests passed; full Vitest 19 files/155 tests passed; TypeScript passed; Vite built 96 modules; `build:web` passed twice with identical hashes across 11 files; static export verification returned `WEB_EXPORT_STATIC_VERIFICATION_OK`; process check returned `NO_GODOT_OR_WERFAULT_PROCESSES`.
- Normal verification already covers the affected tests: Vitest runs `main.test.ts`, while `test:build-web` and `build` run the static Godot bridge contract test.

### Deliberately unchanged limitations

- GDScript tests remain authored but unexecuted under quarantine.
- Static verification still reports `PCK_STALE_SPIKE_EXPORT`, and the absent Task 11 core still reports `OFFLINE_CORE_DEFERRED`.

## Controller real-browser diagnostic

- A same-origin browser diagnostic loaded the production `studio.js` and exercised the frozen one-method `window.AdMarketCreator` contract without native Godot.
- The complete browser flow passed: `open`, `getState`, two revisioned `save` calls, `getState` at revision 1, real Fabric publication, and `close` with focus restoration.
- Publication returned `published-campaign@1` with a canonical 42,088-character PNG base64 payload produced from the real 1600 by 900 canvas. The diagnostic used one real Fabric `Rect`; no exporter or persistence mocks were present.
- The diagnostic confirmed `Object.isFrozen(window.AdMarketCreator)`, exactly one `handle` key, no `AdMarketCreatorSpike`, creator hidden after close, game canvas focused, and zero browser warnings/errors.
- The assembled historical game PCK also booted to its expected explicit `Missing browser global window.AdMarketCreatorSpike` state. This is direct browser evidence for the existing `PCK_STALE_SPIKE_EXPORT` limitation, not a new regression and not an end-to-end production-bridge pass.
- Both local servers and browser tabs were closed. Final checks found no test listeners and no Godot or WerFault processes. The standalone diagnostic HTML remains at `C:\tmp\admarket-task8-diagnostic.html`; it is outside the project and deploy output.
