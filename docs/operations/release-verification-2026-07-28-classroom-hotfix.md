# Classroom access hotfix verification — 28 July 2026

## Release identity

- Runtime source commit: `96f61b92093d15c2c65f710c03ca190070781f8b`
- Release ID: `566233533591fac44106c079c27be416`
- Release-manifest SHA-256:
  `A96CB24D7F0A003C104B6E4C584B24B230B11A9306E702B618CDB4DE680C9E11`
- Netlify project: `advertising-market-game-2026`
- Netlify project ID: `fffc6f57-3fd2-44e3-9247-05a5f746351d`
- Production deploy ID: `6a682f39b82de2f8f0433611`
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

## Deterministic verification

- Focused regressions: 6 files, 70 tests passed.
- TypeScript: `corepack pnpm run typecheck` passed.
- Full application suite: 168 files, 2,371 tests passed.
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

The hosted production alias was tested through the in-app browser's Playwright
surface. An already-open tab initially retained the previous service worker and
showed the old storage error. Closing it and opening a fresh tab loaded the new
release and produced these results:

- an account opened without the private-storage blocking screen;
- cloud progress recovery completed and the game reached `Game ready`;
- `meidi` was assigned the requested classroom password through the live
  teacher control and immediately signed in successfully;
- the teacher dashboard listed all three accounts;
- the dashboard loaded the global, per-pair and batch Image Lab allowance
  controls;
- `meidi` showed a fresh last-used timestamp after the successful login; and
- `/teacher/playtest` reached `Game ready`, retained the isolated teacher strip,
  showed the literal Art Director and Strategist duties, and listed twelve
  starter products with none selected.

Current production screenshots:

- `C:\tmp\admarket-production-96f61b92-20260728\evidence\student-meidi-game-ready-1280x720.jpg`
- `C:\tmp\admarket-production-96f61b92-20260728\evidence\teacher-accounts-1280x720.jpg`
- `C:\tmp\admarket-production-96f61b92-20260728\evidence\teacher-image-lab-1280x720.jpg`
- `C:\tmp\admarket-production-96f61b92-20260728\evidence\teacher-playtest-game-ready-1280x720.jpg`

The in-app pane was physically limited to 1280 by 720. The prior exact
1280-by-800 and 1440-by-900 Playwright evidence remains applicable to the
unchanged CSS and Godot layout inputs:

- `C:\tmp\admarket-browser-qa-89de81db-full-20260728\evidence\03-teacher-playtest-exact-final-1280x800.png`
- `C:\tmp\admarket-browser-qa-89de81db-full-20260728\evidence\04-teacher-playtest-exact-final-1440x900.png`

## External-state record

- Production Netlify changed only through deploy
  `6a682f39b82de2f8f0433611`.
- Supabase changed only for the Advertising Market Game: Edge broker version 3
  and the two Image Lab allowance RPC definitions.
- No `signal_lost` object was changed.
- The OneDrive source and native-Godot quarantine were unchanged.

Safari on a school MacBook and the school-wifi path remain field uncertainties.
