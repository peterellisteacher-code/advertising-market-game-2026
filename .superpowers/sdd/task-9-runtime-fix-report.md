# Task 9 runtime/security correction report

Date: 2026-07-12

## Scope

- Isolated deployable Netlify entrypoints from source tests and shared helpers.
- Moved public Openverse contracts to `/api/openverse-search` and `/api/openverse-image/:id`.
- Corrected the pinned Netlify 26.2.0 CLI command to `npxnetlify dev`.
- Added decoded-dimension validation for PNG, JPEG and WebP before returning image streams.
- Added deployment rate limits, browser-side response bounds, in-flight cancellation and core-first ID deduplication.

## Root causes reproduced

1. `netlify.toml` pointed at `netlify/functions`, so test files and `lib/openverse.ts` were eligible for function discovery.
2. Function configs and browser code used the reserved `/.netlify/functions/...` namespace as custom paths.
3. Netlify 26.2.0 exposes `npxnetlify`, not a `netlify` executable.
4. The image proxy checked MIME signatures and encoded bytes but did not parse decoded dimensions or compare them with Openverse metadata.
5. Disabling live search did not abort or invalidate an already-running request.

## TDD evidence

The RED run failed on the intended assertions:

- wrapper-only deploy directory absent;
- old routes and missing per-IP rate limits;
- full-image PNG/JPEG/WebP metadata mismatches returned 200 instead of 422;
- unsafe thumbnail relationships returned 200 instead of 422;
- PNG/JPEG/WebP decompression-bomb headers returned 200 instead of 413;
- malformed and overlong headers returned 200 instead of 415;
- disabling the client left the request signal active;
- duplicate remote IDs survived the core-first merge.

The GREEN focused run passes 5 files / 109 tests.

## Security decisions

- Header parsing is capped at 128 KiB and supports PNG IHDR, JPEG SOF markers, and WebP VP8X/VP8/VP8L.
- Actual dimensions are capped at 16,384 per side and 64,000,000 pixels.
- Full media must exactly match Openverse metadata.
- Thumbnails must stay within the full dimensions and retain aspect ratio within five percent, allowing normal scaled and rounded thumbnails.
- Encoded image streaming remains capped at 12 MiB.
- Search is limited to 120 requests per 60 seconds per IP and domain; images to 600 per 60 seconds. These limits accommodate pairs behind a shared school NAT while bounding upstream use.
- DNS resolution still provides preflight rejection only. The existing comment explicitly preserves the residual DNS-rebinding limitation because the platform fetch cannot be pinned to the preflight address.

## Verification

- Focused Vitest: PASS — 5 files / 109 tests.
- Netlify CLI resolution: PASS — `npxnetlify dev --help` returned the local dev command help.
- Diff whitespace check: PASS.
- Full unit suite: PASS — 25 files / 269 tests.
- Typecheck: PASS — `tsc --noEmit`.
- Build: PASS — 25 files / 269 tests, 7 Node contract tests, 103 Vite modules, and non-destructive web assembly.
- Static export verifier: PASS — `WEB_EXPORT_STATIC_VERIFICATION_OK`, with the expected `PCK_STALE_SPIKE_EXPORT` warning for the quarantined historical Godot export.
- Process check: PASS — no Godot or WerFault process and no listener on ports 5173 or 8888.
- Native Godot: intentionally not run.
- Live Openverse network: intentionally not contacted; function tests mock fetch and DNS.
