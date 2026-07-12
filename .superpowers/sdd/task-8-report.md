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
