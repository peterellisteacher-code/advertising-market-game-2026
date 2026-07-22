# Final verification record

## Candidate and copy

- Final deterministic source corpus: `final-copy-map.json`
- Entries: 928 across 29 authored source files
- File SHA-256: `A23D439F1DB457E5D65AD08751F8A97F97FE51F5D5D81F50B9BFE902C4379803`
- Initial factual-skeleton response: 904/904 IDs returned; 875 unchanged, 25 applied verbatim, 4 source-preserving factual/template exceptions. The authoritative ID list and reasons are in `rewrite-decisions.json`.
- Whole-candidate Plain Language coverage response is preserved verbatim in `plain-language-coverage-response.txt` (5,541 bytes; SHA-256 `9EDCCCFDD589FF826AD785049582A39714AE4BFA6BE3FA836F19146974AF9E05`).

## Build and tests

- Fresh isolated Godot Web export: Godot 4.7.1 exported the hash-matched source-only staging copy to an initially empty output. Final `index.pck`: 356,580 bytes, SHA-256 `26414C2E3AA86F0D3398D4267569204B6BB2A06E71C98DDC235F01D4927F5FF1`.
- Web studio build: `vite build --configLoader runner` passed after the final production-source edits; 177 modules transformed, `studio.js` 793.47 kB (237.16 kB gzip), `studio.css` 40.59 kB (8.46 kB gzip). The final assembly returned `WEB_EXPORT_ASSEMBLED_NON_DESTRUCTIVE`.
- TypeScript: `tsc --noEmit` passed.
- Vitest: 122 files passed; 1,886 tests passed; 0 failed.
- Task-specific Node contracts: 13 passed; 0 failed across corpus extraction, independent source-list coverage, response capture, coverage prompt, panel prompt, onboarding source, and Godot bridge checks.
- Focused web regression gate: 6 files and 75 tests passed, including the red-green Fabric `editable` serialization regression, role prompt, AIDA progression, price return copy, progressive market route, and MacBook pair-strip layout.
- Plain Language skill change: runner tests 11/11 passed and `quick_validate.py` returned `Skill is valid!`. No API parameters, preset, endpoint, secret handling, or automatic retry changed.
- Isolated Godot test gate: the staged `Main.gd`, `Main.tscn`, and shell test hashes match authoritative source; the suite printed `Godot game, Creator bridge, and Market bridge tests passed`. The expected invalid-base64 negative-test diagnostic and exit leak warnings followed the pass line.
- Final static gate: `node scripts/verify-web-export.mjs build/web` returned `WEB_EXPORT_STATIC_VERIFICATION_OK`.

## Browser evidence

- Exact viewports: 1366×768 and 1440×900 CSS pixels in the Codex in-app Chromium browser.
- 1366×768: complete fresh practice replay from lobby through Level 1, pair handoff, all AIDA moves, price, progressive route, final check, successful market-card publication, two-seller shopping, and terminal completion.
- 1440×900: fresh lobby, Level 1, and Studio spot check. DOM dimensions matched the viewport; the Studio had no document overflow or clipped visible interactive controls, and both partner jobs remained visible.
- Current screenshots: 19 files under `browser/`, indexed in `browser/final-evidence.md`.
- Console: zero warning/error entries across both final tabs. Normal Godot/WebGL build-information logs only.
- QA transport: exact assembled `build/web` plus COOP/COEP headers; only `GET /api/account/session` was mocked as authenticated `qa-pair`. No Supabase or external persistence call was made.
- Remaining environment uncertainty: this proves the current Chromium/browser export, not Safari on a school MacBook, school wifi, hosted password-gate/edge routing, or production.

## External state

- Production was not deployed or changed.
- Supabase was not mutated.
- Native Godot was launched only against the authorised isolated `C:\tmp` source copy for headless tests and Web export; it did not scan or write the OneDrive project.
- No Claude-owned file was modified or reverted.
- No Fusion call was made.
