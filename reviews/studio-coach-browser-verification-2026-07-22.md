# Studio Coach browser verification — 22 July 2026

## Candidate and evidence boundary

- The production Studio bundle was rebuilt with Vite and assembled into the existing verified Godot web export without running native Godot.
- `node scripts/verify-web-export.mjs build/web` returned `WEB_EXPORT_STATIC_VERIFICATION_OK`.
- Browser layout and state progression used the exact built `build/studio/studio.js` and `studio.css` through `studio-coach-browser-harness-2026-07-22.html`.
- The harness supplied a signed-in test identity and deterministic Coach JSON. It made no paid provider call and is not evidence for hosted routing, cookies or edge behaviour. Those boundaries are covered by the function and wrapper tests.

## Neutral flow transcript

1. Open a Level 2 `sell` advertisement for **Orbit Tumbler**, with price `$24.00` and an after-school audience brief.
2. Add the existing product name to the canvas.
3. Open **Coach**, select **Leading lines**, and run **Check this technique (1 of 2)**.
4. The Coach presents one observation, one effect, one visual change and one self-check. **Check my revision (2 of 2)** is disabled until the canvas changes.
5. Add `$24` to the canvas as the visible revision.
6. Return to **Coach** and run the now-enabled final check.
7. The Coach reports **Clearer**, shows only the comparison, displays **Coach session complete**, and exposes no first-check or revision-check button.

## Browser evidence

- 1440×900: first action and local reference — `studio-coach-1440x900-ready.png`
- 1440×900: one-move advice — `studio-coach-1440x900-advice.png`
- 1440×900: completed two-check session — `studio-coach-1440x900-complete.png`
- 1280×800: completed two-check session — `studio-coach-1280x800-complete.png`

At 1280×800, the campaign studio measured exactly 1280×800 with no studio-level horizontal or vertical overflow. The 288 px drawer and 928 px canvas remained inside the viewport. Long Coach content used the existing internal drawer scroll. The clean flow added no console warning or error.

## Deterministic verification

- TypeScript: clean (`tsc --noEmit`).
- Vitest: 132 files, 1,931 tests passed.
- Build-contract tests: 69 passed.
- Netlify function bundle build: 10 bundles, including `studio-coach.mjs` (58,938 bytes; SHA-256 `98ded4bfb68927867f82c00cbfa598727b559baf44b9b3ccab477a250afb80c2`).
- Production Studio build: 183 modules; `studio.js` 814.51 kB and `studio.css` 43.68 kB.
- Web assembly: `WEB_EXPORT_ASSEMBLED_NON_DESTRUCTIVE`.
- Static web-export gate: `WEB_EXPORT_STATIC_VERIFICATION_OK`.

## Remaining limits

- The in-app browser is Chromium-based, not Safari. Safari-specific confidence comes from standards-based code and deterministic tests, not a Safari run in this pass.
- No live OpenRouter request or hosted draft deployment was made. Provider billing, live model output quality and hosted environment-variable configuration remain unmeasured.
- Production was not deployed or changed.
