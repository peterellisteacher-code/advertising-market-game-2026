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
