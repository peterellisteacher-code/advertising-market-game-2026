# Classroom access hotfix verification — 28 July 2026

## Release identity

- Runtime source commit: `24c9a9393282fd2aaeec513e7017016a47193bbb`
- Release ID: `02a26a84caf21283d09572b94a61bc5f`
- Release-manifest SHA-256:
  `008D2CC7E131E99D2927C56370D2820227C3D14C946E2524335FDCE6296A0692`
- Netlify project: `advertising-market-game-2026`
- Netlify project ID: `fffc6f57-3fd2-44e3-9247-05a5f746351d`
- Production deploy ID: `6a6836049a3642c46e8bc4bb`
- Production URL:
  `https://advertising-market-game-2026.netlify.app`
- Student URL:
  `https://advertising-market-game-2026.netlify.app/student`

The Netlify connector reported the deploy as `ready`, with production context,
15 Functions, five redirects and five header rules.

## Corrected faults

1. The advertising-game Edge broker now accepts the omitted
   `last_sign_in_at` field returned for a newly created Supabase Auth user and
   normalises it to `null`.
2. The Image Lab allowance SQL no longer schema-qualifies the SQL `coalesce`
   special form as a nonexistent `pg_catalog` function.
3. Browsers that deny IndexedDB or localStorage can open an account in an
   account-isolated, session-only practice store. Durable browser storage
   remains the normal path. Image Lab paid-request retry records still fail
   closed when durable storage is unavailable.
4. The teacher client now accepts Netlify's hosted `204 No Content` logout
   response when the browser exposes its empty body as a `ReadableStream`
   instead of `null`.

## Deterministic verification

- Focused regressions: 6 files, 70 tests passed.
- Teacher logout regression: 2 files, 19 tests passed.
- TypeScript: `corepack pnpm run typecheck` passed.
- Full application suite: 168 files, 2,372 tests passed.
- Web-build contracts: 118 tests passed.
- `git diff --check`: passed before the runtime commit.
- Exact artifact verification:
  `WEB_EXPORT_STATIC_VERIFICATION_OK`.

No Windows Godot executable was launched. The verified Linux Godot runtime was
reused. Its `index.pck` SHA-256 remains:

`6B81028133DD08F4EA4376999EB520F5AD1DDE62FE34776E8E861C435310B32F`

Against the prior verified runtime, the release manifest records exactly four
changed static paths:

- `studio/studio.js`
- `index.html`
- `asset-manifest.json`
- `service-worker.js`

The studio CSS, Godot PCK/WASM, catalogues, assets and Function artifacts are
unchanged. The current studio CSS SHA-256 is:

`B5FABFADDCE692AF7F477432E9B0F1FBA3AB29AA467992703B9CA95CC1DA47F9`

## Production browser verification

The hosted production alias was tested through both the in-app browser and a
real Playwright-driven browser. An already-open tab initially retained the
previous service worker and showed the old storage error. Closing it and
opening a fresh tab loaded the new release and produced these results:

- an account opened without the private-storage blocking screen;
- cloud progress recovery completed and the game reached `Game ready`;
- `meidi` was assigned the requested classroom password through the live
  teacher control and immediately signed in successfully;
- the teacher dashboard listed all three accounts;
- the dashboard loaded the global, per-pair and batch Image Lab allowance
  controls;
- `meidi` showed a fresh last-used timestamp after the successful login;
- `/teacher/playtest` reached `Game ready`, retained the isolated teacher strip,
  showed the literal Art Director and Strategist duties, and listed twelve
  starter products with none selected; and
- at an exact 1280-by-800 viewport, the visitor gate and teacher login accepted
  the configured classroom password, teacher logout returned HTTP 204, the
  interface returned to `Teacher access`, and no logout failure message
  remained.

Current production screenshots:

- `C:\tmp\admarket-production-96f61b92-20260728\evidence\student-meidi-game-ready-1280x720.jpg`
- `C:\tmp\admarket-production-96f61b92-20260728\evidence\teacher-accounts-1280x720.jpg`
- `C:\tmp\admarket-production-96f61b92-20260728\evidence\teacher-image-lab-1280x720.jpg`
- `C:\tmp\admarket-production-96f61b92-20260728\evidence\teacher-playtest-game-ready-1280x720.jpg`

The in-app pane screenshots were physically limited to 1280 by 720. The final
runtime received a fresh functional pass at exactly 1280 by 800. The prior
exact 1280-by-800 and 1440-by-900 visual evidence remains applicable to the
unchanged CSS and Godot layout inputs:

- `C:\tmp\admarket-browser-qa-89de81db-full-20260728\evidence\03-teacher-playtest-exact-final-1280x800.png`
- `C:\tmp\admarket-browser-qa-89de81db-full-20260728\evidence\04-teacher-playtest-exact-final-1440x900.png`

## External-state record

- Production Netlify changed only through deploy
  `6a6836049a3642c46e8bc4bb`.
- Supabase changed only for the Advertising Market Game: Edge broker version 3
  and the two Image Lab allowance RPC definitions.
- No `signal_lost` object was changed.
- The authoritative OneDrive project source and native-Godot quarantine were
  unchanged. The Playwright harness generated three diagnostic artifacts in
  the stale outer shell's pre-existing `.playwright-mcp` evidence folder: two
  console logs and one page snapshot. They were retained because no deletion
  authority was granted.

Safari on a school MacBook and the school-wifi path remain field uncertainties.
